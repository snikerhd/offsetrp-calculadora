import { parseInventoryOCR } from "../src/lib/ocr-parser";

// Formato exacto do AI Overview do Lens:
// "○ Caixa Eletrónicos (Electronics Box) – x6"
const text = [
  "○ Arma de Coleção (Collection Gun) – x64",
  "○ Barra de Ouro (Gold Bar) – x5",
  "○ C4 (C4 Explosive) – x3",
  "○ Caixa Arma (Weapon Box) – x1",
  "○ Computador (Computer) – x115",
  "○ Crypto Pen (Crypto Pen) – x3",
  "○ Documentos (Documents) – x382",
  "○ Mala Gruppe6 (Gruppe6 Case) – x50",
  "○ Monitor (Monitor) – x71",
  "○ Ouro Estatal (State Gold) – x196",
].join("\n");

const r = parseInventoryOCR(text);
console.log("Items:", r.weights.length);
for (const w of r.weights) console.log(`  ${w.qty}x ${w.item} = ${w.kg} kg (conf ${w.confidence}%)`);
const total = r.weights.reduce((s, w) => s + w.kg, 0);
console.log(`Total: ${r.weights.length} itens, ${total.toFixed(2)} kg`);