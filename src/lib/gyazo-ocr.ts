// OCR do Gyazo via API oficial: GET https://api.gyazo.com/api/images/:image_id
// Devolve os metadados da captura, incluindo o campo `ocr` (texto extraído
// pelo OCR do Gyazo nas capturas da tua conta — Gyazo Pro). O token vem da
// env var GYAZO_ACCESS_TOKEN. Se não houver token ou o texto não existir,
// devolve "" e o chamador cai para o Tesseract local.
const GYAZO_API = process.env.GYAZO_API_ORIGIN || "https://api.gyazo.com";
const GYAZO_UPLOAD = process.env.GYAZO_UPLOAD_ORIGIN || "https://upload.gyazo.com";
const GYAZO_TIMEOUT_MS = 15_000;

/** Extrai o image_id de qualquer forma de link do Gyazo (ou aceita o id direto). */
export function extractGyazoId(urlOrId: string): string | null {
  const value = urlOrId.trim();
  if (/^[a-f0-9]{32}$/i.test(value)) return value;
  try {
    const url = new URL(value);
    if (!/(^|\.)gyazo\.com$/i.test(url.hostname)) return null;
    const id = url.pathname.split("/").filter(Boolean).pop()?.split("?")[0] || "";
    return /^[a-f0-9]{32}$/i.test(id) ? id : null;
  } catch {
    return null;
  }
}

interface GyazoMetadata {
  image_id?: string;
  permalink_url?: string;
  ocr?: {
    description?: string;
    localized?: Record<string, string>;
  };
  metadata?: {
    ocr?: {
      locale?: string;
      description?: string;
    };
  };
}

/** Pede os metadados (com OCR) de uma captura Gyazo à API, usando o token da conta. */
export async function gyazoOcr(gyazoUrlOrId: string): Promise<string> {
  const token = process.env.GYAZO_ACCESS_TOKEN;
  if (!token || token.length < 10) return "";
  const imageId = extractGyazoId(gyazoUrlOrId);
  if (!imageId) return "";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GYAZO_TIMEOUT_MS);
  try {
    const resp = await fetch(`${GYAZO_API}/api/images/${imageId}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!resp.ok) {
      console.error(`Gyazo API HTTP ${resp.status} para image_id ${imageId}`);
      return "";
    }
    const data = (await resp.json()) as GyazoMetadata;
    // O OCR vem em metadata.ocr.description (endpoint GET /api/images/:id)
    const text =
      (data.metadata?.ocr?.description || "").trim() ||
      (data.ocr?.description || "").trim() ||
      Object.values(data.ocr?.localized || {})
        .map(t => (t || "").trim())
        .find(t => t.length >= 3) ||
      "";
    return text;
  } catch (error) {
    console.error("Gyazo OCR error:", error);
    return "";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Faz upload de uma imagem (buffer) para a tua conta Gyazo e devolve o image_id.
 * Usa GYAZO_ACCESS_TOKEN. Devolve null em caso de falha. É usado para que uploads
 * de ficheiro locais também passem pelo OCR do Gyazo (e não só links gyazo.com).
 */
export async function uploadToGyazo(imageBuffer: Buffer): Promise<string | null> {
  const token = process.env.GYAZO_ACCESS_TOKEN;
  if (!token || token.length < 10) return null;

  const form = new FormData();
  form.append(
    "imagedata",
    new Blob([new Uint8Array(imageBuffer)], { type: "image/png" }),
    "inventory.png"
  );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GYAZO_TIMEOUT_MS);
  try {
    const resp = await fetch(`${GYAZO_UPLOAD}/api/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal: controller.signal,
    });
    if (!resp.ok) {
      console.error(`Gyazo upload HTTP ${resp.status}`);
      return null;
    }
    const data = (await resp.json()) as { image_id?: string };
    return data.image_id || null;
  } catch (error) {
    console.error("Gyazo upload error:", error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}