import { parseInventoryOCR } from "../src/lib/ocr-parser";

const caseGrid = `1 (15.0)
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

const sintese = `COMPACT RIFLE — Quantidade: 1 — Peso de cada: 15,0 kg — Peso total: 15,0 kg
CARREGADOR DE RIFLE — Quantidade: 1 — Peso de cada: 0,2 kg — Peso total: 0,2 kg
PETROL CAN — Quantidade: 1 — Peso de cada: 1,0 kg — Peso total: 1,0 kg
RESTOS ELETRÓNICOS — Quantidade: 1 — Peso de cada: 0,5 kg — Peso total: 0,5 kg
SUMO ANANÁS — Quantidade: 25 — Peso de cada: 0,2 kg — Peso total: 5,0 kg
CANDY CANE — Quantidade: 24 — Peso de cada: 0,2 kg — Peso total: 4,8 kg
CORRENTE DE OURO 10K — Quantidade: 178 — Peso de cada: 0,15 kg — Peso total: 26,7 kg
CORRENTE DE OURO — Quantidade: 114 — Peso de cada: 0,1 kg — Peso total: 11,4 kg
ANEL DE DIAMANTE — Quantidade: 18 — Peso de cada: 0,1 kg — Peso total: 1,8 kg
BIFANA — Quantidade: 5 — Peso de cada: 0,2 kg — Peso total: 1,0 kg
RÁDIO — Quantidade: 1 — Peso de cada: 1,0 kg — Peso total: 1,0 kg
TELEMÓVEL — Quantidade: 1 — Peso de cada: 0,7 kg — Peso total: 0,7 kg
CANDY CANE — Quantidade: 3 — Peso de cada: 0,2 kg — Peso total: 0,6 kg
SUMO ANANÁS — Quantidade: 4 — Peso de cada: 0,2 kg — Peso total: 0,8 kg
PETROL CAN — Quantidade: 1 — Peso de cada: 1,0 kg — Peso total: 1,0 kg`;

const caseSintese = `VINTAGE PISTOL
TELEMÓVEL
17:23
1 (5.0)
1 (0.7)
KIT REPARAÇÃO
2 (4.0)
NOBEL TUDO
4 (0.8)
SMG
CARREGADOR DE
1 (0.2)
ÁGI TELEMÓVEL — Quantidade: 1 — Peso de cada: 0,7 kg — Peso total: 0,7 kg
KIT REPARAÇÃO — Quantidade: 2 — Peso de cada: 2,0 kg — Peso total: 4,0 kg
NOBEL TUDO — Quantidade: 4 — Peso de cada: 0,2 kg — Peso total: 0,8 kg
CARREGADOR DE SMG — Quantidade: 1 — Peso de cada: 0,2 kg — Peso total: 0,2 kg
ÁGUA — Quantidade: 3 — Peso de cada: 0,5 kg — Peso total: 1,5 kg
VINTAGE PISTOL — Quantidade: 1 — Peso de cada: 5,0 kg — Peso total: 5,0 kg`;

const caseSemSintese = `VINTAGE PISTOL
TELEMÓVEL
17:23
1 (5.0)
1 (0.7)
KIT REPARAÇÃO
2 (4.0)
NOBEL TUDO
4 (0.8)
SMG
CARREGADOR DE
1 (0.2)
ÁGI`;

// O mesmo, mas com o par da água capturado e o nome cortado ("ÁGI")
const caseAguaCortada = `VINTAGE PISTOL
TELEMÓVEL
17:23
1 (5.0)
1 (0.7)
3 (1.5)
KIT REPARAÇÃO
2 (4.0)
NOBEL TUDO
4 (0.8)
SMG
CARREGADOR DE
1 (0.2)
ÁGI`;

function run(label: string, raw: string, expect: Record<string, [number, number]>, totQty: number, totKg: number) {
  const r = parseInventoryOCR(raw);
  const q = r.weights.reduce((s, w) => s + w.qty, 0);
  const k = r.weights.reduce((s, w) => s + w.kg, 0);
  console.log(`\n== ${label} ==`);
  let fail = 0;
  if (q !== totQty || Math.abs(k - totKg) > 0.01) {
    console.log(`FALHOU totais: obtido ${q}/${k.toFixed(2)}, esperado ${totQty}/${totKg}`);
    fail++;
  }
  for (const [name, [qty, kg]] of Object.entries(expect)) {
    const w = r.weights.find((x) => x.item === name);
    if (!w || w.qty !== qty || Math.abs(w.kg - kg) > 0.01) {
      console.log(`FALHOU ${name}: obtido ${w ? `${w.qty} / ${w.kg}` : "ausente"}, esperado ${qty} / ${kg}`);
      fail++;
    }
  }
  console.log(fail === 0 ? `OK ✓ (total ${q} itens, ${k.toFixed(2)} kg)` : `${fail} falhas`);
  return fail;
}

let fails = 0;
fails += run(
  "caso 1: grelha",
  caseGrid,
  {
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
  },
  378,
  71.5,
);
fails += run(
  "caso 1b: grelha + síntese do jogo",
  `${caseGrid}\n${sintese}`,
  {
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
  },
  378,
  71.5,
);
fails += run(
  "caso 2: vintage pistol / smg",
  caseSintese,
  {
    "arma baixo calibre": [1, 5],
    telemovel: [1, 0.7],
    "kit reparacao": [2, 4],
    "nobel tudo": [4, 0.8],
    "carregador medio calibre": [1, 0.2],
    agua: [3, 1.5],
  },
  12,
  12.2,
);
fails += run(
  "caso 3: grelha sem síntese (nomes antes dos pares)",
  caseSemSintese,
  {
    "arma baixo calibre": [1, 5],
    telemovel: [1, 0.7],
    "kit reparacao": [2, 4],
    "nobel tudo": [4, 0.8],
    "carregador medio calibre": [1, 0.2],
  },
  9,
  10.7,
);
fails += run(
  "caso 4: água cortada (ÁGI) com par capturado",
  caseAguaCortada,
  {
    "arma baixo calibre": [1, 5],
    telemovel: [1, 0.7],
    agua: [3, 1.5],
    "kit reparacao": [2, 4],
    "nobel tudo": [4, 0.8],
    "carregador medio calibre": [1, 0.2],
  },
  12,
  12.2,
);
console.log(fails === 0 ? "\nTODOS OK ✓" : `\n${fails} FALHAS TOTAIS`);
process.exit(fails === 0 ? 0 : 1);
