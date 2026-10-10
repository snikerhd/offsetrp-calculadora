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
// Scraper do AI Overview do Google Lens via Puppeteer (browser headless).
// Abre o Lens com o URL da imagem, aceita cookies se pedir, espera o AI
// Overview renderizar e extrai o texto. Sem API key, sem conta.
// Requer @sparticuz/chromium + puppeteer-core em serverless (Vercel).
export let lastLensOverviewError = "";

// Chromium serverless para Vercel; em dev usa o puppeteer normal se disponível.
async function getBrowser() {
  const isVercel = Boolean(process.env.VERCEL);
  if (isVercel) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteer = (await import("puppeteer-core")).default;
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  }
  // Dev local: tenta puppeteer completo, senão puppeteer-core sem path
  try {
    const puppeteer = (await import("puppeteer")).default;
    return puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  } catch {
    const puppeteer = (await import("puppeteer-core")).default;
    return puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  }
}

/**
 * Abre o Lens com o URL da imagem, espera o AI Overview e devolve o texto.
 * Devolve "" se falhar/timeout — o caller decide se usa fallback.
 */
export async function lensOverviewOcr(imageUrl: string, timeoutMs = 25_000): Promise<string> {
  lastLensOverviewError = "";
  const url = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrl)}`;
  let browser: Awaited<ReturnType<typeof getBrowser>> | null = null;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();
    // Bloqueia recursos pesados para acelerar (imagens, fonts, media)
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const t = req.resourceType();
      if (["image", "media", "font", "stylesheet"].includes(t)) req.abort();
      else req.continue();
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });

    // Aceitar cookies se o banner aparecer (botão "Aceitar todos" / "Accept all")
    for (const sel of [
      'button:has-text("Aceitar todos")',
      'button:has-text("Accept all")',
      'button[aria-label*="Aceitar"]',
      'button[aria-label*="Accept"]',
    ]) {
      try {
        const btn = await page.$(sel);
        if (btn) { await btn.click(); break; }
      } catch {}
    }

    // Espera o AI Overview aparecer (selectors do Google Lens)
    const aiSelectors = [
      '[data-attrid*="ai_overview"]',
      ".AOVhaf", // classe do AI Overview container no Lens
      "[jsname][data-ai-overview]",
      "div[role='region'][aria-label*='Overview']",
      ".wDYxhc", // resultado AI genérico do Google
    ];
    let found = false;
    for (const sel of aiSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: Math.min(8_000, timeoutMs / 2) });
        found = true;
        break;
      } catch {}
    }
    // Fallback: espera um tempo fixo para o JS carregar
    if (!found) await new Promise((r) => setTimeout(r, 5_000));

    // Extrai todo o texto visível da página (AI Overview + texto OCR)
    const text = await page.evaluate(() => {
      // Prioriza o AI Overview se existir
      const ai =
        document.querySelector(".AOVhaf") ??
        document.querySelector("[data-attrid*='ai_overview']") ??
        document.querySelector("[jsname][data-ai-overview]");
      if (ai?.textContent) return (ai.textContent as string).trim();
      // Fallback: texto principal da página
      const main = document.querySelector("main") ?? document.body;
      return (main?.textContent ?? "").replace(/\s+/g, " ").trim();
    });

    await browser.close();
    browser = null;
    if (text.length < 10) { lastLensOverviewError = "AI Overview vazio ou não encontrado"; return ""; }
    return text;
  } catch (e) {
    lastLensOverviewError = e instanceof Error ? e.message : String(e);
    if (browser) { try { await browser.close(); } catch {} }
    return "";
  }
}
