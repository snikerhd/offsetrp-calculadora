// Motor de OCR via Gemini vision (Google AI Studio) — a abordagem que o teu
// projeto-teste "ai-image-data-extraction" validou a 100% na grelha do
// inventário. Requer GEMINI_API_KEY (https://aistudio.google.com/app/apikey);
// sem chave devolve "" de imediatamente e a cadeia grátis continua intacta.
// Os itens estruturados (name + qty) são convertidos em linhas "• Nome (xN)" —
// formato que o parser qty-only (extractQtyOnlyPairs) processa a 100%.
export let lastGeminiError = "";

// Cascata de modelos (o Google descontinua nomes antigos para chaves novas).
const MODELS = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-2.5-flash-lite"];

// Escada de geração (alguns modelos rejeitam certos parâmetros).
const GENERATION_CONFIGS: Record<string, unknown>[] = [
  {
    temperature: 0.2,
    maxOutputTokens: 2048,
    responseMimeType: "application/json",
    thinkingConfig: { thinkingLevel: "low" },
  },
  { temperature: 0.2, maxOutputTokens: 2048, responseMimeType: "application/json" },
  { temperature: 0.2, maxOutputTokens: 2048 },
];

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

// Prompt focado no inventário: só interessa name+qty, com os nomes EXATOS do
// jogo (o parser tem aliases para variações, mas o literal é o ideal).
const PROMPT = `És um leitor de inventário de GTA V (FiveM). Analisa a imagem e devolve APENAS JSON válido, sem markdown:
{ "items": [ { "name": "nome do item EXATAMENTE como escrito na imagem", "qty": 123 } ] }
Regras:
- Lista TODOS os quadrados/itens visíveis, por ordem de leitura (esquerda→direita, cima→baixo).
- "name" = texto literal do jogo (português), sem traduzir nem corrigir a grafia.
- "qty" = o número visível no quadrado (ex.: x64 → 64). Se não houver quantidade, usa 1.
- Máximo 80 itens. Se a imagem não for um inventário, devolve { "items": [] }.`;

class GeminiHttpError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(`Gemini HTTP ${status}`);
    this.status = status;
    this.detail = detail;
  }
}

// sharp é ESM: default export É o construtor Sharp
let SharpConstructor: ((buf: Buffer | string | Uint8Array) => any) | null = null;
async function getSharp(): Promise<((buf: Buffer | string | Uint8Array) => any) | null> {
  if (SharpConstructor) return SharpConstructor;
  try {
    const mod = await import("sharp");
    SharpConstructor = mod.default ?? mod;
    return SharpConstructor;
  } catch {
    return null;
  }
}

/** Reduz custo/tempo de visão: ~896px em JPEG é suficiente para texto+ícones. */
async function optimizeForVision(base64Data: string): Promise<{ base64: string; mime: string }> {
  const buf = Buffer.from(base64Data, "base64");
  const Sharp = await getSharp();
  if (!Sharp) return { base64: base64Data, mime: "image/png" };
  try {
    const meta = await Sharp(buf).metadata();
    let img = Sharp(buf).rotate().resize(896, 896, { fit: "inside", withoutEnlargement: true });
    if (meta.hasAlpha) img = img.flatten({ background: "#111827" });
    const jpeg = await img.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    return { base64: jpeg.toString("base64"), mime: "image/jpeg" };
  } catch {
    return { base64: base64Data, mime: "image/png" };
  }
}

function parseItems(raw: string): Array<{ name: string; qty: number }> {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  let obj: unknown;
  try { obj = JSON.parse(cleaned); } catch { return []; }
  const rec = (obj ?? {}) as Record<string, unknown>;
  const arr = Array.isArray(rec.items) ? rec.items : [];
  const out: Array<{ name: string; qty: number }> = [];
  for (const it of arr) {
    if (!it || typeof it !== "object") continue;
    const r = it as Record<string, unknown>;
    const name = String(r.name ?? "").trim().slice(0, 80);
    if (!name) continue;
    const qty = Math.floor(Number(String(r.qty ?? "1").replace(/[^\d]/g, "")));
    out.push({ name, qty: Number.isFinite(qty) && qty > 0 ? qty : 1 });
    if (out.length >= 80) break;
  }
  return out;
}

/**
 * Devolve linhas "• Nome (xN)" prontas para o parser, ou "" quando falha /
 * não está configurado. O chamador decide se substitui o texto existente.
 */
export async function geminiOcr(base64Data: string, timeoutMs = 15_000): Promise<string> {
  lastGeminiError = "";
  const key = process.env.GEMINI_API_KEY;
  if (!key) return "";
  const optimized = await optimizeForVision(base64Data);
  let lastError = "falha desconhecida";
  for (const model of MODELS) {
    for (const cfg of GENERATION_CONFIGS) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              contents: [{
                role: "user",
                parts: [
                  { inline_data: { mime_type: optimized.mime, data: optimized.base64 } },
                  { text: PROMPT },
                ],
              }],
              generationConfig: cfg,
            }),
            signal: AbortSignal.timeout(timeoutMs),
          },
        );
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          // Chave/quota: repetir com outros modelos não resolve — sai já.
          if (res.status === 401 || res.status === 403) { lastGeminiError = `chave rejeitada (HTTP ${res.status})`; return ""; }
          if (res.status === 429) { lastGeminiError = "quota gratuita esgotada (HTTP 429)"; return ""; }
          if (res.status === 404) { lastError = `${model} indisponível`; break; } // próximo modelo
          lastError = `HTTP ${res.status}: ${detail.slice(0, 120)}`;
          continue; // próxima configuração
        }
        const json = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
          promptFeedback?: { blockReason?: string };
        };
        if (json.promptFeedback?.blockReason) {
          lastGeminiError = `bloqueado (${json.promptFeedback.blockReason})`;
          return "";
        }
        const raw = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p?.text ?? "").join("").trim();
        const items = parseItems(raw);
        if (items.length === 0) { lastError = "resposta sem itens"; continue; }
        return items.map((i) => `• ${i.name} (x${i.qty})`).join("\n");
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }
    }
  }
  lastGeminiError = lastError;
  return "";
}