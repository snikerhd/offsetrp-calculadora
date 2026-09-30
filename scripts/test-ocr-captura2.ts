import { parseInventoryOCR } from "../src/lib/ocr-parser";

// Captura 2: Monitor/Machine Pistol/Camarão/etc.
const raw = `8 (4.0) MONITOR
1 (1.0) 28 PETROL CAN
3 (0.6) RELÓGIO OURO
1 (5.0) MACHINE PISTOL
1 (2.0) KIT REPARAÇÃO
1 (0.5) MALA GRUPPE6
25 (5.0) CAMARÃO PANADO
2 (1.0) COMPUTADOR
16740 (0.2) DINHEIRO
23 (4.6) MOMOSHU
3 (0.6) QUADRO
2 (0.2) PATENTES
40 (4.0) BANDAGEM
1 (0.5) LOCKPICK AVANÇADA
1 (0.5) TIGRE`;

const res = parseInventoryOCR(raw);
for (const w of res.weights) {
  console.log(`${w.item} | qty=${w.qty} | kg=${w.kg} | conf=${w.confidence} | ${w.matchReason}`);
}
console.log(`TOTAL itens: ${res.weights.length}`);