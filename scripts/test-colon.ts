import { parseInventoryOCR } from "../src/lib/ocr-parser";

const text = [
  "• Caixa Eletrónicos: x6",
  "• Caixa Tabaco: x12",
  "• Computador: x115",
  "• Crypto Pen: x3",
  "• Documentos: x382",
  "• Joias: x1",
  "• Mala Diamantes: x1",
  "• Mala Gruppe6: x50",
  "• Monitor: x71",
  "• Ouro Estatal: x196",
].join("\n");

const r = parseInventoryOCR(text);
console.log("Items:", r.weights.length);
for (const w of r.weights) console.log(`  ${w.qty}x ${w.item} = ${w.kg} kg (un ${w.unitKg}, conf ${w.confidence}%)`);
const total = r.weights.reduce((s, w) => s + w.kg, 0);
console.log(`Total: ${r.weights.length} itens, ${total.toFixed(2)} kg`);
console.log("Text:", r.text);