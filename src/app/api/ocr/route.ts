import { NextRequest, NextResponse } from "next/server";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { parseInventoryOCR } from "@/lib/ocr-parser";
import { gyazoOcr, uploadToGyazo, extractGyazoId } from "@/lib/gyazo-ocr";
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

const IMAGE_FETCH_TIMEOUT_MS = 20_000;
const TESS_CACHE_PATH = join(process.cwd(), ".cache", "tessdata");
try { mkdirSync(TESS_CACHE_PATH, { recursive: true }); } catch {}

type SharpModule = typeof import("sharp");
type Sharp = { default?: SharpModule } & SharpModule;
let sharpModule: Sharp | null = null;
async function getSharp(): Promise<Sharp | null> {
  if (sharpModule) return sharpModule;
  try { sharpModule = (await import("sharp")) as unknown as Sharp; return sharpModule; }
  catch (e) { console.error("sharp import failed:", e); return null; }
}

type TesseractWorker = { recognize: (input: Buffer) => Promise<{ data: { text?: string } }> };
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
  try { return await fetch(url, { ...init, signal: controller.signal }); } finally { clearTimeout(timer); }
}
async function tesseractOcr(processed: Buffer): Promise<string> {
  try { const worker = await getWorker(); if (!worker) return ""; const { data } = await worker.recognize(processed); return (data.text || "").trim(); }
  catch { return ""; }
}

export async function POST(req: NextRequest) {
  try {
    if (!isAuthed(req)) {
      return NextResponse.json({ error: "Sessão inválida. Inicia sessão novamente." }, { status: 401 });
    }
    const body = await req.json();
    const { imageUrl, imageBase64, mimeType: inputMime, rawText, mode } = body as { imageUrl?: string; imageBase64?: string; mimeType?: string; rawText?: string; mode?: string };
    // Modo "coimas" (aba Coimas Rápidas): inclui a arma inspecionada + todo o
    // inventário. Modo "relatorio" (aba Relatórios): só balas/acessórios do popup.
    const includeWeapon = mode === "coimas";
    if (rawText && typeof rawText === "string" && rawText.trim().length >= 3) {
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
    // Motor principal: OCR do Gyazo (usa a tua conta via GYAZO_ACCESS_TOKEN).
    // - Link gyazo.com -> pede o OCR diretamente dos metadados da captura.
    // - Upload local / outro link -> faz upload para a tua conta Gyazo e depois
    //   usa o OCR deles (o OCR do Gyazo só existe em capturas da tua conta).
    // Fallback final: Tesseract local.
    let ocrText = "";
    let gyazoId: string | null = null;
    if (imageUrl && typeof imageUrl === "string") {
      gyazoId = extractGyazoId(imageUrl) || null;
      if (gyazoId) {
        ocrText = await gyazoOcr(gyazoId);
      }
    }
            // Nota: o OCR do Gyazo processa-se de forma assíncrona (~10s) APÓS o upload
    // via API — mesmo em contas free. Capturas feitas pelo desktop app podem não
    // ter OCR. Estratégia: 1) tentar metadados do link; 2) sem OCR, FAZER UPLOAD
    // da imagem para a conta (dispara o processamento de OCR); 3) se o Gyazo
    // devolver a mesma captura (dedup de imagem idêntica, sem OCR), modifica a
    // imagem ligeiramente (1 canal) e volta a subir — a captura nova ganha OCR.
    // 4) fallback final: Tesseract local.
    if (ocrText.length < 3) {
      // Orçamento de tempo global: o Gyazo pode precisar de vários retries
      // (upload + esperas + metadados), mas a função tem um limite de wall-time
      // (504 se passar). Reservamos sempre espaço para o Tesseract local correr.
      const startedAt = Date.now();
      // 38s para a fase Gyazo (uploads + esperas) e ~20s reservados para o
      // Tesseract local — a função tem um limite de wall-time (~60s), e passar
      // desse limite devolve HTTP 504 ao cliente.
      const BUDGET_MS = 38_000;
      const left = () => BUDGET_MS - (Date.now() - startedAt);
      const buf = Buffer.from(base64Data, "base64");
      const uploadedId = gyazoId ?? (left() > 20_000 ? await uploadToGyazo(buf) : null);
      const targetId = uploadedId ?? gyazoId;
      if (targetId && left() > 15_000) ocrText = await gyazoOcr(targetId);
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
    }
    if (ocrText.length < 3) {
      const processed = await preprocessImage(base64Data);
      ocrText = await tesseractOcr(processed);
      if (ocrText.length >= 3) console.log("OCR: recuperado via Tesseract local");
    }
    if (ocrText.length < 3) {
      const diag = [
        gyazoId ? "gyazo-metadata:sem-ocr" : "sem-link-gyazo",
        "tesseract:falhou",
      ].join(" | ");
      console.error(`OCR esgotado [${diag}] imagem=${base64Data.length}b`);
      return NextResponse.json({ result: "", ocrRaw: "", preview, error: `Não foi possível extrair texto da imagem (${diag}). Tenta: 1) colar de novo o link Gyazo (confirma que abre no browser e é uma captura NOVA); 2) fazer upload da screenshot diretamente; 3) esperar ~15s e voltar a tentar (o OCR do Gyazo processa de forma assíncrona).` });
    }
    const parsed = parseInventoryOCR(mergeCaixaMultiline(ocrText), { includeWeapon });
    return NextResponse.json({ result: parsed.text, detectedWeights: parsed.weights, overallConfidence: parsed.overallConfidence, weaponCapture: parsed.weaponCapture ?? null, ocrRaw: ocrText, preview, error: parsed.text || parsed.weaponCapture ? undefined : "Não foram identificados itens automaticamente." });
  } catch (error) { const msg = error instanceof Error ? error.message : "Erro desconhecido"; console.error("API error:", msg); return NextResponse.json({ error: `Falha: ${msg}` }, { status: 500 }); }
}
