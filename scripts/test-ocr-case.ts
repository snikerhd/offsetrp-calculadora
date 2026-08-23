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

const casePolice = `Armario-policeevidence5_1
Peso: 482.70 / 5000.00
317 (63.4)
76 (15.2)
22 (22.0)
110 (55.0)
198 (39.6)
PERFUME
PHONE 7
TV LED 75
COMPUTADOR
PACK VINHOS
98 (147.0)
39 (39.0)
12 (6.0)
99 (19.8)
78 (7.8)
OURO ESTATAL
ARMA DE COLEÇÃO
TIGRE
QUADRO
DOCUMENTOS
39 (7.8)
38 (7.6)
1 (2.0)
5 (0.5)
48 (48.0)
RELÓGIO OURO
PULSEIRA OURO
AGUIA DE BRONZE
CRYPTO PEN
BARRA DE OURO
2 (2.0) PERFUME — Quantidade: 317 — Peso de cada: 0,2 kg — Peso total: 63,4 kg
PHONE 7 — Quantidade: 76 — Peso de cada: 0,2 kg — Peso total: 15,2 kg
TV LED 75 — Quantidade: 22 — Peso de cada: 1,0 kg — Peso total: 22,0 kg
COMPUTADOR — Quantidade: 110 — Peso de cada: 0,5 kg — Peso total: 55,0 kg
PACK VINHOS — Quantidade: 198 — Peso de cada: 0,2 kg — Peso total: 39,6 kg
OURO ESTATAL — Quantidade: 98 — Peso de cada: 1,5 kg — Peso total: 147,0 kg
ARMA DE COLEÇÃO — Quantidade: 39 — Peso de cada: 1,0 kg — Peso total: 39,0 kg
TIGRE — Quantidade: 12 — Peso de cada: 0,5 kg — Peso total: 6,0 kg
QUADRO — Quantidade: 99 — Peso de cada: 0,2 kg — Peso total: 19,8 kg
DOCUMENTOS — Quantidade: 78 — Peso de cada: 0,1 kg — Peso total: 7,8 kg
RELÓGIO OURO — Quantidade: 39 — Peso de cada: 0,2 kg — Peso total: 7,8 kg
PULSEIRA OURO — Quantidade: 38 — Peso de cada: 0,2 kg — Peso total: 7,6 kg
ÁGUIA DE BRONZE — Quantidade: 1 — Peso de cada: 2,0 kg — Peso total: 2,0 kg
CRYPTO PEN — Quantidade: 5 — Peso de cada: 0,1 kg — Peso total: 0,5 kg
BARRA DE OURO — Quantidade: 48 — Peso de cada: 1,0 kg — Peso total: 48,0 kg`;

// O mesmo armário, mas sem o bloco de síntese (OCR não o capturou)
const casePoliceSemSintese = `Armario-policeevidence5_1
Peso: 482.70 / 5000.00
317 (63.4)
76 (15.2)
22 (22.0)
110 (55.0)
198 (39.6)
PERFUME
PHONE 7
TV LED 75
COMPUTADOR
PACK VINHOS
98 (147.0)
39 (39.0)
12 (6.0)
99 (19.8)
78 (7.8)
OURO ESTATAL
ARMA DE COLEÇÃO
TIGRE
QUADRO
DOCUMENTOS
39 (7.8)
38 (7.6)
1 (2.0)
5 (0.5)
48 (48.0)
RELÓGIO OURO
PULSEIRA OURO
AGUIA DE BRONZE
CRYPTO PEN
BARRA DE OURO
2 (2.0)`;

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

// Armazém de tabaco (caso real): grelha parcialmente rotacionada + síntese do jogo
const caseTabaco = `(0'L) L
(0'L) L
SVNVNV OWNS
BIFANA
BANDAGEM
(9'0) €
(6'0) 6
FOLHA TABACO
CARTÃO
SECAGEM
ESTANHO
MAÇO TABACO
SUPORTE DE
L
)1020-0 510
(L'S) IS
7
126 (12.6)
374 (112.2) MAÇO TABACO — Quantidade: 374 — Peso de cada: 0,3 kg — Peso total: 112,2 kg
ESTANHO — Quantidade: 126 — Peso de cada: 0,1 kg — Peso total: 12,6 kg
SUPORTE DE SECAGEM — Quantidade: 4 — Peso de cada: 5,0 kg — Peso total: 20,0 kg
CARTÃO — Quantidade: 51 — Peso de cada: 0,1 kg — Peso total: 5,1 kg
FOLHA TABACO — Quantidade: 510 — Peso de cada: 0,2 kg — Peso total: 102,0 kg
BANDAGEM — Quantidade: 9 — Peso de cada: 0,1 kg — Peso total: 0,9 kg
BIFANA — Quantidade: 3 — Peso de cada: 0,2 kg — Peso total: 0,6 kg
SUMO ANANÁS — Quantidade: 7 — Peso de cada: 0,2 kg — Peso total: 1,4 kg`;

// Síntese com hífens em vez de travessões (OCR troca o traço)
const caseSinteseHifens = `ESTANHO - Quantidade: 126 - Peso de cada: 0,1 kg - Peso total: 12,6 kg
MAÇO TABACO - Quantidade: 374 - Peso de cada: 0,3 kg - Peso total: 112,2 kg`;

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
fails += run(
  "caso 5: armário police evidence (síntese autoritativa)",
  casePolice,
  {
    perfume: [317, 63.4],
    "phone 7": [76, 15.2],
    "tv led 75": [22, 22],
    computador: [110, 55],
    "pack vinhos": [198, 39.6],
    "ouro estatal": [98, 147],
    "arma de colecao": [39, 39],
    tigre: [12, 6],
    quadro: [99, 19.8],
    documentos: [78, 7.8],
    "relogio ouro": [39, 7.8],
    "pulseira ouro": [38, 7.6],
    "aguia de bronze": [1, 2],
    "crypto pen": [5, 0.5],
    "barras ouro": [48, 48],
  },
  1180,
  480.7,
);
fails += run(
  "caso 6: armário sem síntese (blocos grelha)",
  casePoliceSemSintese,
  {
    perfume: [317, 63.4],
    "phone 7": [76, 15.2],
    "tv led 75": [22, 22],
    computador: [110, 55],
    "pack vinhos": [198, 39.6],
    "ouro estatal": [98, 147],
    "arma de colecao": [39, 39],
    tigre: [12, 6],
    quadro: [99, 19.8],
    documentos: [78, 7.8],
    "relogio ouro": [39, 7.8],
    "pulseira ouro": [38, 7.6],
    "aguia de bronze": [1, 2],
    "crypto pen": [5, 0.5],
    "barras ouro": [48, 48],
    // "2 (2.0)" fica como nao identificado: peso 1 kg/un e ambiguo (colete,
    // radio, c4...) e adivinhar inventava um item errado
  },
  1182,
  482.7,
);
fails += run(
  "caso 7: armazém de tabaco (grelha rodada + síntese)",
  caseTabaco,
  {
    estanho: [126, 12.6],
    "maço": [374, 112.2],
    cartao: [51, 5.1],
    "folha tabaco": [510, 102],
    bandagem: [9, 0.9],
    bifana: [3, 0.6],
    "sumo ananas": [7, 1.4],
    "suporte de secagem": [4, 20],
  },
  1084,
  254.8,
);
fails += run(
  "caso 8: síntese com hífens em vez de travessões",
  caseSinteseHifens,
  {
    estanho: [126, 12.6],
    "maço": [374, 112.2],
  },
  500,
  124.8,
);
console.log(fails === 0 ? "\nTODOS OK ✓" : `\n${fails} FALHAS TOTAIS`);
process.exit(fails === 0 ? 0 : 1);

