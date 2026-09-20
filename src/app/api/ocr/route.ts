import { NextRequest, NextResponse } from "next/server";
import { join } from "path";
import { tmpdir } from "os";
import { copyFileSync, existsSync, mkdirSync } from "fs";
import { parseInventoryOCR } from "@/lib/ocr-parser";
import { gyazoOcr, uploadToGyazo, extractGyazoId } from "@/lib/gyazo-ocr";
import { ocrSpaceOcr } from "@/lib/openai-ocr";
import { openaiOcr } from "@/lib/openai-ocr";
import { puterOcr } from "@/lib/puter-ocr";
import { isAuthed } from "@/lib/auth";

// O OCR do Gyazo parte nomes como "CAIXA ELETRÓNICOS" em duas linhas
// ("CAIXA" + "ELETRÓNICOS"), e items seguidos de caixa partilham o prefixo
// "CAIXA", o que faz as regras de tipografia do parser re-casarem em cadeia.
// Aqui faz-se uma fusão numa única passagem (sem re-processamento), devolvendo
// cada item "CAIXA X" numa linha própria. Usa \u0001 como separador temporário
// para que as regras seguintes não voltem a fundir.
const S = "\u0001";
const CAIXA_MULTILINE = /(?:^|\n)\s*\bCAIXA\s*\n\s*(ELETR[OÓ]NICOS|TABACO|CONTRABANDO)\b|\b(ELETR[OÓ]NICOS|TABACO|CONTRABANDO)\s*\n\s*CAIXA\b/gi;
function mergeCaixaMultiline(text: string): string {
  const cleaned = text.replace(CAIXA_MULTILINE, (m: string, a: string | undefined, b: string | undefined) => {
    const w = ((a || b || "") + "").toUpperCase().replace(/^ELETR.*/i, "ELETRONICOS");
    const name = w.startsWith("ELETR") ? "ELETRONICOS" : w;
    return "\nCAIXA" + S + name;
  });
  return cleaned.split(S).join(" ").replace(/\n{2,}/g, "\n");
}

export const maxDuration = 60;
export const runtime = "nodejs";

const IMAGE_FETCH_TIMEOUT_MS = 12_000;
// Dados de língua do Tesseract: `por.traineddata` está commitado na raiz do
// projeto. É copiado para a pasta de cache do worker na primeira execução
// (em /tmp no Vercel, porque o resto do filesystem é read-only), para o OCR
// funcionar sem depender da rede (CDN do jsdelivr) nem do Gyazo.
const TESS_CACHE_PATH = process.env.VERCEL ? join(tmpdir(), "tessdata") : join(process.cwd(), ".cache", "tessdata");
const LOCAL_TRAINEDDATA = join(process.cwd(), "por.traineddata");
try {
  mkdirSync(TESS_CACHE_PATH, { recursive: true });
  const cached = join(TESS_CACHE_PATH, "por.traineddata");
  if (!existsSync(cached) && existsSync(LOCAL_TRAINEDDATA)) copyFileSync(LOCAL_TRAINEDDATA, cached);
} catch {}

// Circuit breaker do Gyazo (motor SECUNDÁRIO — o primário é o Tesseract
// local): se o upload/metadados falharem (serviço em baixo, ex.: HTTP 502 no
// upload.gyazo.com), evita martelar o Gyazo durante 60s e responde via
// Tesseract em vez de esgotar o orçamento de tempo com retries inúteis.
let gyazoDownUntil = 0;
const GYAZO_COOLDOWN_MS = 60_000;
// Orçamento global de wall-time do pedido (função Vercel ~60s). Começa no
// início do POST e governa TODOS os motores — cada um só corre se existir
// tempo para o seu timeout + folga, garantindo que a resposta JSON sai
// sempre antes do 504 da plataforma.
const REQUEST_BUDGET_MS = 48_000;

type SharpModule = typeof import("sharp");
type Sharp = { default?: SharpModule } & SharpModule;
let sharpModule: Sharp | null = null;
async function getSharp(): Promise<Sharp | null> {
  if (sharpModule) return sharpModule;
  try { sharpModule = (await import("sharp")) as unknown as Sharp; return sharpModule; }
  catch (e) { console.error("sharp import failed:", e); return null; }
}

type TesseractWorker = { recognize: (input: Buffer) => Promise<{ data: { text?: string } }>; terminate?: () => Promise<unknown> };
let tesseractModule: typeof import("tesseract.js") | null = null;
async function getTesseractModule(): Promise<typeof import("tesseract.js") | null> {
  if (tesseractModule) return tesseractModule;
  try { tesseractModule = await import("tesseract.js"); return tesseractModule; }
  catch (e) { console.error("tesseract.js import failed:", e); return null; }
}
let workerPromise: Promise<TesseractWorker | null> | null = null;
function resolveTesseractWorkerPath(): string {
  const viaCwd = join(process.cwd(), "node_modules", "tesseract.js", "src", "worker-script", "node", "index.js");
  if (existsSync(viaCwd)) return viaCwd;
  try { return require.resolve("tesseract.js/src/worker-script/node/index.js"); } catch { return viaCwd; }
}
function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const tesseract = await getTesseractModule();
      if (!tesseract) return null;
      return tesseract.createWorker("por", 1, {
        workerPath: resolveTesseractWorkerPath(),
        langPath: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/por/4.0.0_best_int",
        cachePath: TESS_CACHE_PATH,
        errorHandler: (e: unknown) => console.error("tesseract worker error:", e),
      });
    })().catch(e => { console.error("tesseract worker init failed:", e); workerPromise = null; throw e; });
  }
  return workerPromise;
}
async function preprocessImage(base64Data: string): Promise<Buffer> {
  const buf = Buffer.from(base64Data, "base64");
  const sharpFn = await getSharp();
  if (!sharpFn) return buf;
  try {
    const s = sharpFn.default ?? sharpFn;
    const meta = await s(buf).metadata();
    const w = meta.width || 0, h = meta.height || 0;
    const scale = Math.min(2, 2400 / Math.max(w || 1, h || 1));
    return s(buf).resize(Math.round(Math.max(1, w * scale)), Math.round(Math.max(1, h * scale))).flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer();
  } catch { return buf; }
}
async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), ms);
  try { return await fetch(url, { ...init, signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36", ...(init.headers || {}) } }); } finally { clearTimeout(timer); }
}
async function tesseractOcr(processed: Buffer, timeoutMs: number): Promise<string> {
  const job = (async (): Promise<string> => {
    try { const worker = await getWorker(); if (!worker) return ""; const { data } = await worker.recognize(processed); return (data.text || "").trim(); }
    catch { return ""; }
  })();
  let timedOut = false;
  const timer = new Promise<string>((resolve) => { setTimeout(() => { timedOut = true; resolve(""); }, timeoutMs); });
  const result = await Promise.race([job, timer]);
  if (timedOut) {
    // Worker pendurado — termina-o para não bloquear pedidos futuros no
    // mesmo processo (será recriado na próxima chamada).
    try { const w = await workerPromise; await w?.terminate?.(); } catch {}
    workerPromise = null;
  }
  return result;
}
// OCR.space free tem limite de ~1MB por pedido: imagens maiores são
// recomprimidas (max 2000px, JPEG q82) para caber no limite e carregar mais
// depressa (menos tempo de upload = menos risco de timeout).
async function compressForOcrSpace(base64Data: string): Promise<string> {
  if (base64Data.length <= 1_200_000) return base64Data;
  const sharpFn = await getSharp();
  if (!sharpFn) return base64Data;
  try {
    const s = sharpFn.default ?? sharpFn;
    const buf = Buffer.from(base64Data, "base64");
    const meta = await s(buf).metadata();
    const w = meta.width || 0, h = meta.height || 0;
    const scale = Math.min(1, 2000 / Math.max(w || 1, h || 1));
    const out = await s(buf).resize(Math.round(Math.max(1, w * scale)), Math.round(Math.max(1, h * scale))).jpeg({ quality: 82 }).toBuffer();
    return out.toString("base64");
  } catch { return base64Data; }
}

export async function POST(req: NextRequest) {
  try {
    // Relógio global do pedido: todos os motores (incluindo downloads)
    // respeitam este orçamento para nunca ultrapassar o limite da função.
    const requestStartedAt = Date.now();
    const left = () => REQUEST_BUDGET_MS - (Date.now() - requestStartedAt);
    if (!isAuthed(req)) {
      return NextResponse.json({ error: "Sessão inválida. Inicia sessão novamente." }, { status: 401 });
    }
    const body = await req.json();
    const { imageUrl, imageBase64, mimeType: inputMime, rawText, mode } = body as { imageUrl?: string; imageBase64?: string; mimeType?: string; rawText?: string; mode?: string };
    // Modo "coimas" (aba Coimas Rápidas): inclui a arma inspecionada + todo o
    // inventário. Modo "relatorio" (aba Relatórios): só balas/acessórios do popup.
    const includeWeapon = mode === "coimas";
    // Texto que veio de um host bloqueado/erro (ex.: Imgur "Content not viewable
    // in your region") não é inventário — rejeita para não "parsear" lixo.
    const HOST_ERROR_RE = /not\s+viewable|not\s+available\s+in\s+your\s+region|content\s+unavailable|region\s+(?:lock|block)|removed\s+from\s+imgur|40[34]\s+(?:not\s+)?found|forbidden|access\s+denied/i;
    if (rawText && typeof rawText === "string" && rawText.trim().length >= 3 && !HOST_ERROR_RE.test(rawText)) {
      const parsed = parseInventoryOCR(mergeCaixaMultiline(rawText.trim()), { includeWeapon });
      let rawPreview: string | undefined;
      if (imageUrl) {
        try {
          let directUrl = imageUrl as string;
          if (directUrl.includes("gyazo.com") && !directUrl.includes("i.gyazo.com")) { const id = directUrl.split("/").pop()?.split("?")[0]; if (id) directUrl = `https://i.gyazo.com/${id}.png`; }
          if (directUrl.includes("imgur.com") && !directUrl.includes("i.imgur.com")) { const id = directUrl.split("/").pop()?.split("?")[0]; if (id) directUrl = `https://i.imgur.com/${id}.png`; }
          const r = await fetchWithTimeout(directUrl, { headers: { "User-Agent": "Mozilla/5.0" }, redirect: "follow" }, IMAGE_FETCH_TIMEOUT_MS);
          if (r.ok) rawPreview = `data:${r.headers.get("content-type") || "image/png"};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
        } catch {}
      }
      return NextResponse.json({ result: parsed.text, detectedWeights: parsed.weights, overallConfidence: parsed.overallConfidence, weaponCapture: parsed.weaponCapture ?? null, ocrRaw: rawText.trim(), preview: rawPreview, error: parsed.text || parsed.weaponCapture ? undefined : "Não foram identificados itens automaticamente." });
    }
    let base64Data: string, mimeType: string;
    if (imageBase64) { base64Data = imageBase64; mimeType = inputMime || "image/png"; }
    else if (imageUrl) {
      let directUrl = imageUrl as string;
      if (directUrl.includes("gyazo.com") && !directUrl.includes("i.gyazo.com")) { const id = directUrl.split("/").pop()?.split("?")[0]; if (id) directUrl = `https://i.gyazo.com/${id}.png`; }
      if (directUrl.includes("imgur.com") && !directUrl.includes("i.imgur.com")) { const id = directUrl.split("/").pop()?.split("?")[0]; if (id) directUrl = `https://i.imgur.com/${id}.png`; }
      const r = await fetchWithTimeout(directUrl, { headers: { "User-Agent": "Mozilla/5.0", Accept: "image/*,*/*" }, redirect: "follow" }, IMAGE_FETCH_TIMEOUT_MS);
      if (!r.ok) return NextResponse.json({ error: `Falha ao obter imagem: ${r.status} ${r.statusText}` }, { status: 400 });
      base64Data = Buffer.from(await r.arrayBuffer()).toString("base64"); mimeType = r.headers.get("content-type") || "image/png";
    } else return NextResponse.json({ error: "imageUrl ou imageBase64 necessário" }, { status: 400 });
    const preview = `data:${mimeType};base64,${base64Data}`;
    // Motor PRIMÁRIO: OCR.space (melhor qualidade nas fontes estilizadas do
    // jogo; key em OCRSPACE_API_KEY, free 500 req/dia). Timeout próprio +
    // portão de tempo global: nenhum motor corre sem tempo para o seu timeout
    // + folga, por isso o pedido nunca acaba em 504.
    let ocrText = "";
    let ocrspaceTried = false;
    let tesseractTried = false;
    let puterTried = false;
    if (left() > 12_000) {
      ocrspaceTried = true;
      const input = await compressForOcrSpace(base64Data);
      ocrText = await ocrSpaceOcr(input, Math.min(20_000, Math.max(8_000, left() - 18_000)));
      if (ocrText.length >= 3) console.log("OCR: sucesso via OCR.space (primário)");
    }
    // Motor SECUNDÁRIO: Tesseract local (offline — usa o por.traineddata
    // commitado; funciona mesmo sem rede/chaves). Com timeout duro: um worker
    // pendurado não pode consumir o orçamento da função.
    if (ocrText.length < 3 && left() > 12_000) {
      tesseractTried = true;
      const processed = await preprocessImage(base64Data);
      ocrText = await tesseractOcr(processed, Math.min(20_000, Math.max(8_000, left() - 6_000)));
      if (ocrText.length >= 3) console.log("OCR: sucesso via Tesseract local (secundário)");
    }
    // Motor TERCIÁRIO: Puter HTTP (ai-ocr via API — usa PUTER_AUTH_TOKEN).
    if (ocrText.length < 3 && left() > 12_000) {
      puterTried = true;
      ocrText = await puterOcr(base64Data, 10_000);
      if (ocrText.length >= 3) console.log("OCR: sucesso via Puter (terciário)");
    }
    let gyazoId: string | null = null;
    if (imageUrl && typeof imageUrl === "string") {
      gyazoId = extractGyazoId(imageUrl) || null;
    }
    // Motor TERCIÁRIO: OCR do Gyazo (usa a tua conta via GYAZO_ACCESS_TOKEN),
    // só se o Puter e o Tesseract não conseguirem:
    // - Link gyazo.com -> pede o OCR dos metadados da captura.
    // - Upload local / outro link -> faz upload para a tua conta Gyazo (o OCR
    //   deles processa de forma assíncrona, ~10s) e re-tenta com esperas.
    // Fallbacks finais: OpenAI/Puter (se houver chaves em .env).
    if (ocrText.length < 3 && Date.now() >= gyazoDownUntil && left() > 25_000) {
      // Orçamento de tempo: conta desde o INÍCIO do pedido — o Tesseract
      // primário e o download da imagem já gastaram parte do wall-time da
      // função (~60s no Vercel; 504 se passar). Reserva folga para terminar.
      const buf = Buffer.from(base64Data, "base64");
      let attempted = false;
      let uploadedId: string | null = gyazoId;
      if (!uploadedId && left() > 20_000) { attempted = true; uploadedId = await uploadToGyazo(buf); }
      const targetId = uploadedId ?? gyazoId;
      if (targetId && left() > 15_000) { attempted = true; ocrText = await gyazoOcr(targetId); }
      // Dedup: se o upload devolveu o MESMO id do link original e ele não tem
      // OCR, o Gyazo não vai processar — modifica a imagem e sobe como nova.
      if (ocrText.length < 3 && gyazoId && uploadedId === gyazoId && left() > 35_000) {
        try {
          const sharpFn = await getSharp();
          if (sharpFn) {
            const s = sharpFn.default ?? sharpFn;
            const modified = await s(buf).modulate({ brightness: 1.001 }).png().toBuffer();
            const newId = await uploadToGyazo(modified);
            if (newId && newId !== gyazoId) {
              // Espera o processamento assíncrono do OCR (~10s comprovado),
              // respeitando o orçamento (mínimo 15s guardados p/ Tesseract).
              for (const ms of [2000, 4000, 6000]) {
                if (left() < 20_000) break;
                await new Promise(r => setTimeout(r, Math.min(ms, Math.max(0, left() - 15_000))));
                ocrText = await gyazoOcr(newId);
                if (ocrText.length >= 3) break;
              }
            }
          }
        } catch (e) {
          console.error("gyazo re-upload modificado falhou:", e);
        }
      }
      // Upload novo (não-duplicado): re-tenta com esperas crescentes.
      if (ocrText.length < 3 && uploadedId && uploadedId !== gyazoId) {
        const waits = [2000, 4000, 6000];
        for (const ms of waits) {
          if (ocrText.length >= 3 || left() < 15_000) break;
          await new Promise(r => setTimeout(r, Math.min(ms, Math.max(0, left() - 12_000))));
          ocrText = await gyazoOcr(uploadedId);
        }
      }
      // Gyazo continua sem OCR após todas as tentativas reais — provável
      // serviço em baixo. Arma o cooldown para as próximas chamadas ficarem
      // no motor primário (Tesseract) em vez de repetir uploads que falham.
      if (ocrText.length < 3 && attempted) gyazoDownUntil = Date.now() + GYAZO_COOLDOWN_MS;
    }
    // Fallbacks finais (usam chaves em .env se existirem; devolvem ""
    // imediatamente quando não estão configurados).
    if (ocrText.length < 3 && left() > 8_000) ocrText = await openaiOcr(base64Data, requestStartedAt + REQUEST_BUDGET_MS);
    if (ocrText.length < 3) {
      const gyazoState = Date.now() < gyazoDownUntil
        ? "gyazo:down(cooldown)"
        : gyazoId ? "gyazo-metadata:sem-ocr" : "sem-link-gyazo";
      const diag = [
        ocrspaceTried ? "ocrspace:falhou" : "ocrspace:sem-tempo",
        tesseractTried ? "tesseract:falhou" : "tesseract:sem-tempo",
        puterTried ? "puter-http:falhou" : "puter-http:sem-tempo",
        gyazoState,
      ].join(" | ");
      console.error(`OCR esgotado [${diag}] imagem=${base64Data.length}b`);
      return NextResponse.json({ result: "", ocrRaw: "", preview, error: `Não foi possível extrair texto da imagem (${diag}). O OCR local e o Gyazo falharam — tenta: 1) upload de uma screenshot mais nítida/completa; 2) colar de novo o link Gyazo daqui a ~1 minuto (pode estar em baixo — status.gyazo.com); 3) colar o texto manualmente.` });
    }
    const parsed = parseInventoryOCR(mergeCaixaMultiline(ocrText), { includeWeapon });
    return NextResponse.json({ result: parsed.text, detectedWeights: parsed.weights, overallConfidence: parsed.overallConfidence, weaponCapture: parsed.weaponCapture ?? null, ocrRaw: ocrText, preview, error: parsed.text || parsed.weaponCapture ? undefined : "Não foram identificados itens automaticamente." });
  } catch (error) { const msg = error instanceof Error ? error.message : "Erro desconhecido"; console.error("API error:", msg); return NextResponse.json({ error: `Falha: ${msg}` }, { status: 500 }); }
}
