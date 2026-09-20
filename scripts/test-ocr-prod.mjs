// Testa o /api/ocr em PRODUÇÃO (Vercel). PROD_URL=<url> obrigatório.
// PROD_IMAGE=<ficheiro> envia upload base64; senão PROD_URL_IMG=<link> (catbox).
import { createHmac } from "crypto";
import { readFileSync } from "fs";

const env = {};
for (const line of readFileSync("C:/Users/steam/offsetrp-calculadora/.env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const BASE = (process.env.PROD_URL || "").replace(/\/$/, "");
if (!BASE) { console.log("falta PROD_URL"); process.exit(1); }
const IMAGE_FILE = process.env.PROD_IMAGE || "C:/Users/steam/catbox-test.png";
const IMAGE_URL = process.env.PROD_URL_IMG || "";
const DEADLINE = Number(process.env.PROD_DEADLINE_MS || 50_000);

const secret = env.ACCESS_SECRET || env.ACCESS_PASSWORD || "offsetrp-secret";
const payload = String(Date.now() + 1000 * 60 * 60);
const sig = createHmac("sha256", secret).update(payload).digest("hex");
const cookie = `oc_session=${payload}.${sig}`;

const body = IMAGE_URL ? { imageUrl: IMAGE_URL } : { imageBase64: readFileSync(IMAGE_FILE).toString("base64"), mimeType: "image/png" };
const t0 = Date.now();
let resp;
try {
  resp = await fetch(`${BASE}/api/ocr`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(DEADLINE),
  });
} catch (e) {
  console.log(`ABORTADO após ${((Date.now() - t0) / 1000).toFixed(1)}s — seria HTTP 504`);
  process.exit(1);
}
const ms = ((Date.now() - t0) / 1000).toFixed(1);
const j = await resp.json().catch(() => ({ error: "(resposta não-JSON)" }));
console.log(`HTTP ${resp.status} em ${ms}s`);
console.log("ocrRaw:", JSON.stringify((j.ocrRaw || "").slice(0, 120)));
console.log("result:", JSON.stringify((j.result || "").slice(0, 200)));
console.log("error:", j.error || "(nenhum)");
console.log(resp.ok && (j.ocrRaw || "").length >= 3 && !j.error ? "PRODUÇÃO: OCR OK ✅" : "PRODUÇÃO: FALHOU ❌");
