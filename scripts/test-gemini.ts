// Verificação local do motor Gemini: corre a imagem de referência, mostra o
// texto "• Nome (xN)" devolvido e o resultado do parser.
// Uso: npx tsx scripts/test-gemini.ts [caminho-da-imagem]
// Requer GEMINI_API_KEY no ambiente ou num .env.local na raiz do repo.
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { parseInventoryOCR } from "../src/lib/ocr-parser";
import { geminiOcr, geminiConfigured, lastGeminiError } from "../src/lib/gemini-ocr";

// dotenv manual (o repo pode correr sem node_modules local)
const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  if (!geminiConfigured()) {
    console.log("GEMINI_API_KEY em falta — define-a em .env.local (GEMINI_API_KEY=...) ou no ambiente.");
    process.exit(2);
  }
  const imgPath = process.argv[2] ?? "C:\\Users\\Public\\calculadora-fix\\gyazo-inventory.png";
  const b64 = readFileSync(imgPath).toString("base64");
  const t0 = Date.now();
  const text = await geminiOcr(b64, 25_000);
  console.log(`Gemini devolveu ${text.length} chars em ${Date.now() - t0}ms${lastGeminiError ? ` (último erro: ${lastGeminiError})` : ""}`);
  console.log("--- texto convertido ---");
  console.log(text || "(vazio)");
  const parsed = parseInventoryOCR(text);
  console.log("--- itens parseados ---");
  for (const w of parsed.weights) console.log(`  ${w.qty}x ${w.item} = ${w.kg} kg (conf ${w.confidence}%)`);
  const total = parsed.weights.reduce((s, w) => s + w.kg, 0);
  console.log(`Total: ${parsed.weights.length} itens, ${total.toFixed(2)} kg`);
}

main().catch((e) => { console.error("ERRO:", e instanceof Error ? e.message : e); process.exit(1); });