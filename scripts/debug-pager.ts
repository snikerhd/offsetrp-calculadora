import { parseInventoryOCR } from "../src/lib/ocr-parser";
const r = parseInventoryOCR(`1
(0.5)
1 (1.0)
2(4.0)
16 (4.8)
50
80
PAGER
PETROL CAN
KIT REPARAÇÃO
DIARIO DE BORDO`);
for (const w of r.weights) console.log(`${w.item}: ${w.qty} / ${w.kg} | ${w.matchReason}`);
console.log("TOTAL", r.weights.reduce((s, w) => s + w.qty, 0), r.weights.reduce((s, w) => s + w.kg, 0));
