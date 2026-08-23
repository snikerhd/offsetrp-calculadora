import { createWorker } from "tesseract.js";
import sharp from "sharp";

const SRC = process.argv[2] || "C:/Users/steam/AppData/Local/Temp/ocrtest/img.png";

async function preprocess(input: string): Promise<Buffer> {
  const buf = await sharp(input).toBuffer();
  const meta = await sharp(buf).metadata();
  const w = meta.width || 0, h = meta.height || 0;
  const scale = Math.min(2, 2400 / Math.max(w || 1, h || 1));
  return sharp(buf)
    .resize(Math.round(Math.max(1, (w || 1) * scale)), Math.round(Math.max(1, (h || 1) * scale)))
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 90 })
    .toBuffer();
}

async function main() {
  const processed = await preprocess(SRC);
  for (const lang of ["por", "eng"]) {
    const worker = await createWorker(lang, 1, { cachePath: ".cache/tessdata", logger: () => {} });
    const { data } = await worker.recognize(processed);
    console.log(`\n===== TESSERACT ${lang} =====`);
    console.log((data.text || "").trim());
    await worker.terminate();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
