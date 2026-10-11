// Motor de OCR via Gemini vision (Google AI Studio) — a abordagem que o teu
// projeto-teste "ai-image-data-extraction" validou a 100% na grelha do
// inventário. Requer GEMINI_API_KEY (https://aistudio.google.com/app/apikey);
// sem chave devolve "" de imediatamente e a cadeia grátis continua intacta.
// Os itens estruturados (name + qty) são convertidos em linhas "• Nome (xN)" —
// formato que o parser qty-only (extractQtyOnlyPairs) processa a 100%.
export let lastGeminiError = "";

// Cascata de modelos (o Google descontinua nomes antigos para chaves novas).
// gemini-2.5-flash-lite está deprecated para chaves novas (404) — removido.
const MODELS = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-flash-lite-latest"];

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
// Regras anti-prosa EXPLÍCITAS: o Gemini por vezes descreve a imagem em vez de
// listar; isto força-o a devolver SEMPRE o JSON de itens.
const PROMPT = `És um extrator de inventário de GTA V (FiveM). A tua ÚNICA tarefa é ler os itens da imagem e devolver JSON.

REGRAS ABSOLUTAS (segue-as à risca):
- NUNCA escrevas frases, descrições, explicações, resumos ou introduções.
- NUNCA comeces com "A imagem", "The image", "Isto é", "This is", "Este menu", etc.
- Devolve EXCLUSIVAMENTE um objeto JSON válido, sem markdown, sem texto antes ou depois.
- NUNCA traduzas os nomes para inglês. Usa o nome EXACTO em PORTUGUÊS da imagem.
- NUNCA adiciones nomes em inglês (ex.: NÃO "Pistol .50 (Desert Eagle)", só "Pistol .50").

Formato exacto:
{ "items": [ { "name": "nome EXACTO em português", "qty": 123 } ] }

- "name": texto literal do jogo em PORTUGUÊS, sem traduzir, sem inglês, sem corrigir a grafia.
- "qty": o número de unidades visível no item (ex.: x64 → 64). Se não houver, usa 1.
- Para ARMAS com munição visível (ex.: "Munição: 243" ao lado da arma): o "qty" da arma é 1, e adiciona um item separado com nome EXACTO "balas alto calibre" (arma Classe 3/rifle), "balas medio calibre" (Classe 2/SMG) ou "balas baixo calibre" (Classe 1/pistola), com "qty" = o número da munição. Exemplo: { "name": "balas alto calibre", "qty": 243 }.
- Lista TODOS os itens visíveis, por ordem de leitura. Máximo 80.
- Se a imagem NÃO for um inventário de itens, devolve { "items": [] } e nada mais.`;

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
  try { obj = JSON.parse(cleaned); } catch { return parseItemsFromProse(cleaned); }
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

// Fallback: quando o Gemini devolve prosa em vez de JSON (ex.: "The image
// shows ... containing items like a Bifana, Sumo Maracujá, ..."), extrai os
// nomes de itens de frases descritivas. A prosa raramente traz quantidades,
// por isso assume 1 salvo quando há "(xN)"/"xN" explícito.
function parseItemsFromProse(raw: string): Array<{ name: string; qty: number }> {
  const text = raw.replace(/\s+/g, " ");
  // Frases que introduzem a lista de itens, da mais específica para a mais
  // genérica. "such as" vem POR ÚLTIMO porque aparece cedo em descrições
  // genéricas ("such as a FiveM server") e não na lista de itens.
  const introducers = [
    /items?\s+like\s+(.+)/i,
    /itens?\s+como\s+(.+)/i,
    /containing\s+(.+)/i,
    /contendo\s+(.+)/i,
    /including\s+(.+)/i,
    /incluindo\s+(.+)/i,
    /featuring\s+(.+)/i,
    /consists?\s+of\s+(.+)/i,
    /such\s+as\s+(.+)/i,
  ];
  let src = "";
  for (const re of introducers) {
    const m = text.match(re);
    if (m && m[1]) { src = m[1]; break; }
  }
  if (!src) src = text;
  src = src.split(/\.\s|\.$/)[0]; // corta no fim da frase (fim da lista)
  const out: Array<{ name: string; qty: number }> = [];
  const seen = new Set<string>();
  for (const part of src.split(/,|\band\b|\be\b/i)) {
    let s = part.trim().replace(/^(a|an|o|os|as|the|um|uma|uns|umas)\s+/i, "");
    if (!s) continue;
    let qty = 1;
    const qm = s.match(/\(?\s*x\s*(\d{1,6})\s*\)?\s*$/i) || s.match(/\bx\s*(\d{1,6})\b/i);
    if (qm) { qty = Number(qm[1]) || 1; s = s.replace(/\s*\(?\s*x\s*\d{1,6}\s*\)?\s*$/i, "").trim(); }
    s = s.replace(/[.;:)\]]+$/, "").trim();
    if (s.length < 2 || s.length > 60 || !/[a-zà-ú]/i.test(s)) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: s, qty });
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
          // 401/403 = chave inválida (sai já). 429 = rate limit do free tier, que
          // é POR-MODELO (ex.: gemini-3.8-flash esgotado mas gemini-flash-lite-
          // latest ainda tem quota) — por isso NÃO desiste, tenta o próximo modelo.
          if (res.status === 401 || res.status === 403) { lastGeminiError = `chave rejeitada (HTTP ${res.status})`; return ""; }
          if (res.status === 429) { lastGeminiError = `rate-limited (HTTP 429) em ${model}`; break; }
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