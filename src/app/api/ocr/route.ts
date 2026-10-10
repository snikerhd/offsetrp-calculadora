import { NextRequest, NextResponse } from "next/server";
import { parseInventoryOCR } from "@/lib/ocr-parser";
import { lensOcr, lastLensError } from "@/lib/lens-ocr";
import { geminiOcr, geminiConfigured, lastGeminiError } from "@/lib/gemini-ocr";
import { isAuthed } from "@/lib/auth";

// Certos motores de OCR partem nomes como "CAIXA ELETRÓNICOS" em duas linhas
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
// Trace da última execução (até onde o pedido chegou) — fica nos logs do
// runtime da Vercel quando o browser só recebe um 504 opaco.
let lastRunTrace = "";
// Orçamento global de wall-time do pedido (função Vercel ~60s). Começa no
// início do POST e governa TODOS os motores — cada um só corre se existir
// tempo para o seu timeout + folga, garantindo que a resposta JSON sai
// sempre antes do 504 da plataforma.
const REQUEST_BUDGET_MS = 48_000;

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), ms);
  try { return await fetch(url, { ...init, signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36", ...(init.headers || {}) } }); } finally { clearTimeout(timer); }
}
export async function POST(req: NextRequest) {
  // Hard timeout wrapper: garante que a resposta sai antes do 504 do Vercel (60s)
  const HARD_TIMEOUT_MS = 55_000;
  const hardTimeout = new Promise<NextResponse>((resolve) => {
    setTimeout(() => {
      resolve(NextResponse.json({ result: "", ocrRaw: "", preview: "", error: "Tempo esgotado (55s). Tenta imagem menor ou cola o texto manualmente." }, { status: 504 }));
    }, HARD_TIMEOUT_MS);
  });

  try {
    // Race: ou a lógica principal termina, ou o hard timeout dispara
    return await Promise.race([(async () => {
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
    // Cadeia de OCR enxuta: Google Lens (primário, grátis) → Gemini vision
    // (secundário, com GEMINI_API_KEY). Portão de tempo global: nenhum motor
    // corre sem tempo para o seu timeout + folga — o pedido nunca dá 504.
    let ocrText = "";
    let lensTried = false;
    let geminiTried = false;
    // "Utilizável" = há texto E o parser consegue extrair itens dele. O Lens do
    // novo layout devolve só nomes (badges "x64" sem parênteses não formam
    // pares), por isso o critério de sucesso passa a ser o parse, não o tamanho.
    const parsedCount = (t: string): number => {
      try { return parseInventoryOCR(mergeCaixaMultiline(t)).weights.length; } catch { return 0; }
    };
    const ocrUsable = (): boolean => ocrText.length >= 3 && parsedCount(ocrText) > 0;
    // Motor PRIMÁRIO: Google Lens via API do Chromium (chrome-lens-ocr) —
    // grátis, sem chave, sem conta. Qualidade comprovada igual ao Lens do
    // browser (~3s na imagem de referência, texto + pesos).
    if (left() > 12_000) {
      lensTried = true;
      ocrText = await lensOcr(base64Data, 15_000);
      if (ocrText.length >= 3) console.log("OCR: sucesso via Google Lens (primário)");
    }
    // Motor SECUNDÁRIO (com chave): Gemini vision (GEMINI_API_KEY do Google AI
    // Studio) — lê a grelha como o Lens manual e devolve itens estruturados,
    // convertidos em "• Nome (xN)" para o parser qty-only. Só substitui o
    // texto do Lens se o resultado do Gemini parsear (nunca perde texto bom).
    if (!ocrUsable() && geminiConfigured() && left() > 14_000) {
      geminiTried = true;
      const g = await geminiOcr(base64Data, Math.min(18_000, Math.max(8_000, left() - 12_000)));
      if (parsedCount(g) > 0) ocrText = g;
      if (ocrUsable()) console.log("OCR: sucesso via Gemini vision (secundário com chave)");
    }
    lastRunTrace = `lens=${lensTried ? "tentado" : "saltado"} gemini=${geminiTried ? `tentado(${lastGeminiError || "ok"})` : geminiConfigured() ? "saltado" : "sem-chave"} @${((Date.now() - requestStartedAt) / 1000).toFixed(1)}s`;
    console.log(`OCR trace: ${lastRunTrace}`);
    if (!ocrUsable()) {
      const diag = [
        lensTried ? `lens:falhou(${lastLensError || "sem texto"})` : "lens:sem-tempo",
        geminiTried ? `gemini:falhou(${lastGeminiError || "sem itens"})` : (geminiConfigured() ? "gemini:sem-tempo" : "gemini:sem-chave"),
      ].join(" | ");
      console.error(`OCR esgotado [${diag}] imagem=${base64Data.length}b`);
      return NextResponse.json({ result: "", ocrRaw: "", preview, error: `Não foi possível extrair itens da imagem (${diag}). Tenta: 1) uma screenshot mais nítida/completa; 2) definir GEMINI_API_KEY para leitura inteligente da grelha; 3) colar o texto manualmente.` });
    }
    const parsed = parseInventoryOCR(mergeCaixaMultiline(ocrText), { includeWeapon });
    return NextResponse.json({ result: parsed.text, detectedWeights: parsed.weights, overallConfidence: parsed.overallConfidence, weaponCapture: parsed.weaponCapture ?? null, ocrRaw: ocrText, preview, error: parsed.text || parsed.weaponCapture ? undefined : "Não foram identificados itens automaticamente." });
  })(), hardTimeout]);
} catch (error) { const msg = error instanceof Error ? error.message : "Erro desconhecido"; console.error("API error:", msg); return NextResponse.json({ error: `Falha: ${msg}` }, { status: 500 }); }
}
