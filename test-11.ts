import { parseInventoryOCR } from "./src/lib/ocr-parser";
const ocr = `11 (22)\t30 (6.0)\t
PETROL CAN\tBIFANA\tSUMO MARACUJA\t`;
const r = parseInventoryOCR(ocr);
for (const w of r.weights) {
  console.log("  " + w.item.padEnd(30) + " qty=" + String(w.qty).padStart(6) + "  kg=" + String(w.kg).padStart(8) + "  " + w.matchReason);
}
