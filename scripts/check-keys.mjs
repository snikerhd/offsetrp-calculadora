// Verifica as chaves de OCR.space e Gyazo em .env.local contra os serviços reais.
import { readFileSync } from "fs";

const env = {};
for (const line of readFileSync("C:/Users/steam/offsetrp-calculadora/.env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

// 1) OCR.space
try {
  const b64 = readFileSync("C:/Users/steam/catbox-test.png").toString("base64");
  const resp = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    headers: { apikey: env.OCRSPACE_API_KEY, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ base64Image: `data:image/png;base64,${b64}`, language: "por", OCREngine: "2", scale: "true", isTable: "true" }),
  });
  const j = await resp.json();
  const text = (j.ParsedResults || []).map((r) => r.ParsedText || "").join("\n").trim();
  console.log(`OCRSPACE: HTTP ${resp.status} | erro=${j.IsErroredOnProcessing} | msg=${Array.isArray(j.ErrorMessage) ? j.ErrorMessage.join("; ") : j.ErrorMessage || "(nenhuma)"} | texto=${text.length} chars`);
  if (text) console.log("OCRSPACE amostra:", JSON.stringify(text.slice(0, 100)));
} catch (e) {
  console.log("OCRSPACE falhou:", e.message);
}

// 2) Gyazo (validade do token)
try {
  const resp = await fetch("https://api.gyazo.com/api/images?per_page=1", {
    headers: { Authorization: `Bearer ${env.GYAZO_ACCESS_TOKEN}` },
  });
  console.log(`GYAZO: HTTP ${resp.status} ${resp.ok ? "(token VÁLIDO)" : "(token INVÁLIDO/expirado)"}`);
} catch (e) {
  console.log("GYAZO falhou:", e.message);
}
