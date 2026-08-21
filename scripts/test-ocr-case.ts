import { parseInventoryOCR } from "../src/lib/ocr-parser";

const raw = `1 (15.0)
1 (0.2)
1
(1.0)
1 (0.5)
25 (5.0)
CARREGADOR DE
76
RESTOS
COMPACT RIFLE
RIFLE
PETROL CAN
ELETRONICOS
SUMO ANANAS
24(4.8)
178 (26.7)
114 (11.4)
18 (1.8)
5(1.0)
CORRENTE DE OURO
CANDY CANE
10K
CORRENTE DE OURO
ANEL DE DIAMANTE
BIFANA
1 (1.0)
1 (0.7)
3 (0.6)
4(0.8)
1(1.0)
17:23
72
RADIO
TELEMOVEL
CANDY CANE
SUMO ANANAS
PETROL CAN`;

const r = parseInventoryOCR(raw);
const totQ = r.weights.reduce((s, w) => s + w.qty, 0);
const totK = r.weights.reduce((s, w) => s + w.kg, 0);
for (const w of r.weights) {
  console.log(
    `${w.item.padEnd(28)} qty=${String(w.qty).padStart(4)}  kg=${w.kg.toFixed(2).padStart(6)}  ${w.confidence}%`
  );
}
console.log(`TOTAL qty=${totQ} kg=${totK.toFixed(2)}`);
console.log(`esperado : qty=378 kg=71.50`);

const expect: Record<string, [number, number]> = {
  "arma alto calibre": [1, 15],
  "carregador alto calibre": [1, 0.2],
  "petrol can": [2, 2],
  eletronicos: [1, 0.5],
  "sumo ananas": [29, 5.8],
  "candy cane": [27, 5.4],
  "corrente 10k": [178, 26.7],
  corrente: [114, 11.4],
  anel: [18, 1.8],
  bifana: [5, 1],
  radio: [1, 1],
  telemovel: [1, 0.7],
};
let fail = 0;
for (const [k, [q, kg]] of Object.entries(expect)) {
  const w = r.weights.find((x) => x.item === k);
  if (!w || w.qty !== q || Math.abs(w.kg - kg) > 0.01) {
    console.log(`FALHOU ${k}: obtido ${w ? `${w.qty}/${w.kg}` : "ausente"}, esperado ${q}/${kg}`);
    fail++;
  }
}
console.log(fail === 0 ? "OK ✓" : `${fail} falhas`);
