// Teste E2E do POST /api/ocr: arranca `next dev`, cria a cookie de sessão
// HMAC (ACCESS_PASSWORD de .env.local) e envia uma imagem sintética gerada
// localmente. Valida o motor primário (Tesseract) sem usar o Gyazo.
import { spawn } from "child_process";
import { createHmac } from "crypto";
import { readFileSync } from "fs";
import sharp from "sharp";

const ROOT = "C:/Users/steam/offsetrp-calculadora";
const PORT = 3210;
const BASE = `http://localhost:${PORT}`;

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
const png = await sharp(Buffer.from(svg)).png().toBuffer();
const imageBase64 = png.toString("base64");

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", String(PORT)], {
  cwd: ROOT,
  stdio: ["ignore", "pipe", "pipe"],
  env: process.env,
});
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
    if (server.killed) throw new Error("servidor morreu ao arrancar");
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

  const resp = await fetch(`${BASE}/api/ocr`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ imageBase64, mimeType: "image/png" }),
  });
  console.log("HTTP", resp.status);
  const json = await resp.json();
  console.log("ocrRaw:", JSON.stringify(json.ocrRaw || ""));
  console.log("result:", JSON.stringify(json.result || ""));
  console.log("error:", json.error || "(nenhum)");
  // O critério é a extração OCR (ocrRaw com texto) — a imagem sintética não
  // contém itens de inventário válidos, pelo que parsed.text vazio é esperado.
  if (resp.status === 200 && (json.ocrRaw || "").includes("CAIXA")) {
    console.log("TESTE E2E: PASS ✅");
  } else {
    console.log("TESTE E2E: FAIL ❌");
    process.exitCode = 1;
  }
} finally {
  server.kill();
  await wait(500);
}
