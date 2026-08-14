import { parseInventoryOCR } from "./src/lib/ocr-parser";

// Test: 11 (22) should be detected as 11 (2.2) since 2.0 kg/un doesn't match any item
const ocr = `11 (22)\t30 (6.0)\t
PETROL CAN\tBIFANA\tSUMO MARACUJA\t`;
const r = parseInventoryOCR(ocr);
for (const w of r.weights) {
  console.log("  " + w.item.padEnd(30) + " qty=" + String(w.qty).padStart(6) + "  kg=" + String(w.kg).padStart(8));
}
