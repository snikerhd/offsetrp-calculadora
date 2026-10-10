/**
 * Best-effort server-side extraction of text already embedded in the Google
 * Lens/Search response. Google renders AI Overview dynamically in many cases,
 * so this is opportunistic: if the response doesn't contain the answer HTML,
 * callers should fall back to the normal Lens OCR path.
 */
const TIMEOUT_MS = 8_000;

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\\u003c/gi, "<")
    .replace(/\\u003e/gi, ">")
    .replace(/\\u0026/gi, "&")
    .replace(/\\n/g, "\n")
    .replace(/\\\\/g, "\\");
}

function htmlToText(html: string): string {
  // Keep script JSON as Google sometimes serializes answer text in its payload.
  return decodeEntities(
    html
      .replace(/<\/(?:div|p|li|tr|h[1-6]|br|section|article)>/gi, "\n")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[\t\r ]+/g, " ")
      .replace(/\n\s+/g, "\n")
  );
}

export async function fetchLensOverviewText(imageUrl: string): Promise<string> {
  let image: URL;
  try { image = new URL(imageUrl); } catch { return ""; }
  if (image.protocol !== "https:" || !/(^|\.)gyazo\.com$|(^|\.)imgur\.com$/.test(image.hostname)) return "";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const lensUrl = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(image.toString())}`;
    const response = await fetch(lensUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
      },
    });
    if (!response.ok) return "";
    const html = await response.text();
    if (!html || html.length > 15_000_000) return "";
    const text = htmlToText(html);
    // Only return a candidate when it resembles an inventory summary. Avoid
    // feeding the entire Google page into the inventory parser.
    const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const inventoryLines = lines.filter((line) =>
      line.length < 180 &&
      /(?:\bx\s*\d{1,7}\b|\b\d{1,7}\s*x\b|:\s*x?\s*\d{1,7}\b|\bquantity\b|\bquantidade\b)/i.test(line) &&
      !/google|privacy|terms|feedback|sign in|pesquisa/i.test(line)
    );
    return inventoryLines.length >= 2 ? inventoryLines.join("\n") : "";
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}
