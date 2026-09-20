const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OCR_MODEL = process.env.OPENAI_OCR_MODEL || "gpt-4o-mini";
// 3 chaves em rotação: se a primeira esgotar tokens (429/quota), tenta as seguintes.
const OCR_KEYS = [
  process.env.OPENAI_API_KEY_1,
  process.env.OPENAI_API_KEY_2,
  process.env.OPENAI_API_KEY_3,
].filter((k): k is string => Boolean(k));

// Estado por processo: lembra a última chave que funcionou para não voltar
// sempre à primeira depois de um 429.
let lastWorkingKeyIndex = -1;

const OCR_SYSTEM_PROMPT = `Você é um OCR de inventário de jogo de roleplay.
Extraia todo o texto da imagem de forma exata, linha a linha, mantendo nomes de
itens, quantidades e pesos. Formato típico: "NOME_DO_ITEM quantidade (peso) kg".
Inclua a linha de peso total se existir. Não invente, não traduza, não explique.
Responda apenas com o texto extraído.`;

async function openaiVisionRequest(apiKey: string, imageBase64: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const resp = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    body: JSON.stringify({
      model: OCR_MODEL,
      max_tokens: 4000,
      temperature: 0,
      messages: [
        { role: "system", content: OCR_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
            },
          ],
        },
      ],
    }),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    const err = new Error(`OpenAI HTTP ${resp.status}: ${detail.slice(0, 300)}`);
    (err as unknown as { status: number }).status = resp.status;
    throw err;
  }

  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content;
  return (typeof text === "string" ? text : "").trim();
  } finally {
    clearTimeout(timer);
  }
}

function isExhaustedKey(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status === 429 || status === 401) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /quota|insufficient|usage limit|billing|out of tokens|credit|too many/i.test(msg);
}

// OCR.space (api.ocr.space/parse/image) — free tier com key, até 25.000
// pedidos/mês (500 requests/dia por key free). Lê bem fontes estilizadas
// que o Tesseract apanha mal. Devolve "" em falha (o chamador segue a cadeia).
// Causa da última falha (aparece no diagnóstico do erro no browser).
export let lastOcrSpaceError = "";
export async function ocrSpaceOcr(imageBase64: string, timeoutMs = 20_000): Promise<string> {
  lastOcrSpaceError = "";
  const apiKey = process.env.OCRSPACE_API_KEY || process.env.OCRSPACE_API_KEY_2 || "";
  if (!apiKey) { lastOcrSpaceError = "sem OCRSPACE_API_KEY"; return ""; }
  // Sem timeout o pedido podia ficar pendurado até a plataforma cortar (504).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body = new URLSearchParams({
      base64Image: `data:image/jpeg;base64,${imageBase64}`,
      language: "por",
      OCREngine: "2",
      scale: "true",
      isTable: "true",
    });
    const resp = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: { apikey: apiKey, "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
    });
    if (!resp.ok) {
      const body = (await resp.text().catch(() => "")).slice(0, 200);
      lastOcrSpaceError = `HTTP ${resp.status}: ${body}`;
      console.error("OCR.space HTTP", resp.status, body);
      return "";
    }
    const data = (await resp.json()) as {
      ParsedResults?: Array<{ ParsedText?: string }>;
      IsErroredOnProcessing?: boolean;
      ErrorMessage?: string | string[];
    };
    if (data.IsErroredOnProcessing) {
      const msg = Array.isArray(data.ErrorMessage) ? data.ErrorMessage.join("; ") : data.ErrorMessage;
      lastOcrSpaceError = `erro: ${msg || "?"}`;
      console.error("OCR.space erro:", msg);
      return "";
    }
    const text = (data.ParsedResults || []).map((r) => r.ParsedText || "").join("\n").trim();
    if (!text) lastOcrSpaceError = "resposta sem texto";
    return text;
  } catch (err) {
    lastOcrSpaceError = err instanceof Error ? err.message : String(err);
    console.error("OCR.space falhou:", err);
    return "";
  } finally {
    clearTimeout(timer);
  }
}

// salta para a seguinte (e guarda a posição da última que funcionou).
// Percorre as chaves em rotação até obter texto útil. Quando uma chave esgota,
// salta para a seguinte (e guarda a posição da última que funcionou).
export async function openaiOcr(imageBase64: string, deadlineMs?: number): Promise<string> {
  if (OCR_KEYS.length === 0) return "";

  const start = lastWorkingKeyIndex >= 0 ? lastWorkingKeyIndex : 0;
  const order = Array.from({ length: OCR_KEYS.length }, (_, i) => (start + i) % OCR_KEYS.length);

  for (const idx of order) {
    // Respeita o orçamento global do pedido: não inicia uma chamada nova
    // se já não houver tempo para o timeout (12s) + folga.
    if (deadlineMs && Date.now() > deadlineMs - 15_000) break;
    try {
      const text = await openaiVisionRequest(OCR_KEYS[idx], imageBase64);
      if (text.length >= 3) {
        lastWorkingKeyIndex = idx;
        return text;
      }
    } catch (err) {
      console.error(`OpenAI OCR key ${idx + 1} failed:`, err);
      if (!isExhaustedKey(err)) break;
    }
  }

  // Nenhuma chave OpenAI devolveu texto útil — o chamador esgota a cadeia
  // de motores (Puter / Tesseract / Gyazo) antes de desistir.
  return "";
}
