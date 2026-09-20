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
  const resp = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
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
}

function isExhaustedKey(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status === 429 || status === 401) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /quota|insufficient|usage limit|billing|out of tokens|credit|too many/i.test(msg);
}

// Percorre as chaves em rotação até obter texto útil. Quando uma chave esgota,
// salta para a seguinte (e guarda a posição da última que funcionou).
export async function openaiOcr(imageBase64: string): Promise<string> {
  if (OCR_KEYS.length === 0) return "";

  const start = lastWorkingKeyIndex >= 0 ? lastWorkingKeyIndex : 0;
  const order = Array.from({ length: OCR_KEYS.length }, (_, i) => (start + i) % OCR_KEYS.length);

  for (const idx of order) {
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
