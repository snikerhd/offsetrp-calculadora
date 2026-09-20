// Teste local do OCR: replica exatamente as opções do worker usadas em
// src/app/api/ocr/route.ts para diagnosticar falhas do Tesseract.
import sharp from "sharp";
import { join } from "path";
import { createWorker } from "tesseract.js";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="240">
  <rect width="900" height="240" fill="white"/>
  <text x="40" y="120" font-size="44" font-family="Arial" fill="black">CAIXA ELETRONICOS 2 (1.5kg)</text>
</svg>`;

const processed = await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();

const worker = await createWorker("por", 1, {
  workerPath: join(process.cwd(), "node_modules", "tesseract.js", "src", "worker-script", "node", "index.js"),
  langPath: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/por/4.0.0_best_int",
  cachePath: join(process.cwd(), ".cache", "tessdata"),
  errorHandler: (e) => console.error("worker error:", e),
});

const { data } = await worker.recognize(processed);
console.log("=== TEXTO EXTRAÍDO ===");
console.log((data.text || "").trim());
await worker.terminate();
