// Teste E2E do POST /api/ocr: arranca `next dev`, cria a cookie de sessão
// HMAC (ACCESS_PASSWORD de .env.local) e envia uma imagem sintética gerada
// localmente. Valida a cadeia de motores (OCR.space → Tesseract → …) sem
// usar o Gyazo. E2E_DEADLINE_MS aborta o pedido (simula o limite de tempo da
// função serverless: se estourar aqui, em produção seria HTTP 504).
import { spawn } from "child_process";
import { createHmac } from "crypto";
import { readFileSync } from "fs";
import sharp from "sharp";

const ROOT = "C:/Users/steam/offsetrp-calculadora";
const PORT = Number(process.env.E2E_PORT || 3210);
const BASE = `http://localhost:${PORT}`;
// Com E2E_NO_SPAWN=1 usa um servidor já em execução (ex.: `next start` de produção).
const spawnServer = !process.env.E2E_NO_SPAWN;
// Aborta o pedido após este tempo (ms) — deve ser inferior ao maxDuration.
const deadlineMs = Number(process.env.E2E_DEADLINE_MS || 0);

function loadEnv(file) {
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnv(`${ROOT}/.env.local`);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="240">
  <rect width="900" height="240" fill="white"/>
  <text x="40" y="120" font-size="44" font-family="Arial" fill="black">CAIXA ELETRONICOS 2 (1.5kg)</text>
</svg>`;
// E2E_IMAGE=<ficheiro> usa uma imagem real (ex.: screenshot Imgur descarregada)
// em vez da sintética; neste caso exige-se apenas ocrRaw não-vazio.
const e2eImageFile = process.env.E2E_IMAGE || "";
// E2E_URL=<url> testa o modo imageUrl (download server-side).
const e2eUrl = process.env.E2E_URL || "";
const png = e2eImageFile
  ? readFileSync(e2eImageFile)
  : await sharp(Buffer.from(svg)).png().toBuffer();
const imageBase64 = png.toString("base64");

const server = spawnServer
  ? spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", String(PORT)], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    })
  : null;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitForServer(timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      // Qualquer resposta HTTP (mesmo 500 de rotas que dependem da BD local)
      // significa que o servidor está a aceitar pedidos.
      await fetch(BASE, { redirect: "manual" });
      return true;
    } catch {}
    await wait(500);
    if (server?.killed) throw new Error("servidor morreu ao arrancar");
  }
  throw new Error("timeout à espera do servidor");
}

try {
  await waitForServer();

  // Sessão: mesmo esquema de src/lib/auth.ts (payload.timestamp + HMAC-SHA256)
  const secret = process.env.ACCESS_SECRET || process.env.ACCESS_PASSWORD || "offsetrp-secret";
  const payload = String(Date.now() + 1000 * 60 * 60);
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  const cookie = `oc_session=${payload}.${sig}`;

  const body = e2eUrl
    ? { imageUrl: e2eUrl }
    : { imageBase64, mimeType: "image/png" };
  let resp;
  try {
    resp = await fetch(`${BASE}/api/ocr`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(body),
      signal: deadlineMs ? AbortSignal.timeout(deadlineMs) : undefined,
    });
  } catch (err) {
    console.log(`PEDIDO ABORTADO APÓS ${deadlineMs}ms — em produção isto seria HTTP 504`);
    throw err;
  }
  console.log("HTTP", resp.status);
  const json = await resp.json();
  console.log("ocrRaw:", JSON.stringify(json.ocrRaw || ""));
  console.log("result:", JSON.stringify(json.result || ""));
  console.log("error:", json.error || "(nenhum)");
  // O critério é a extração OCR (ocrRaw com texto) — a imagem sintética não
  // contém itens de inventário válidos, pelo que parsed.text vazio é esperado.
  const realImage = e2eImageFile || e2eUrl;
  const ok = realImage
    ? resp.status === 200 && (json.ocrRaw || "").length >= 3 && !/not\s+viewable|region|forbidden/i.test(json.ocrRaw || "")
    : resp.status === 200 && (json.ocrRaw || "").includes("CAIXA");
  if (ok) {
    console.log("TESTE E2E: PASS ✅");
  } else {
    console.log("TESTE E2E: FAIL ❌");
    process.exitCode = 1;
  }
} finally {
  server?.kill();
  if (spawnServer) await wait(500);
}
