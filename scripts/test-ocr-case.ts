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

// Inventário misto com itens novos do jogo (sushi, herbal tea, bao bun,
// paraquedas, furadora, broca) — síntese verbosa autoritativa
const caseNovosItens = `1 (5.0)
1 (1.0)
51 (10.2)
47 (9.4)
5(1.0)
MACHINE PISTOL
RADIO
SUSHI
MOMOSHU
SUMO LARANJA
4(0.8)
16(3.2)
9(1.8)
1 (0.2)
1 (10.0)
Y
HERBAL TEA
MEOWCHI MOCHI
BAO BUN
SUMO MARACUJA
PARAQUEDAS
1 (0.7)
1(1.5)
1(1.5)
1(1.5)
1 (0.1)
17:23
TELEMOVEL
FURADORA BÁSICA
SACO DO GINÁSIO
BROCA BÁSICA
BANDAGEM MACHINE PISTOL — Quantidade: 1 — Peso de cada: 5,0 kg — Peso total: 5,0 kg
RÁDIO — Quantidade: 1 — Peso de cada: 1,0 kg — Peso total: 1,0 kg
SUSHI — Quantidade: 51 — Peso de cada: 0,2 kg — Peso total: 10,2 kg
MOMOSHU — Quantidade: 47 — Peso de cada: 0,2 kg — Peso total: 9,4 kg
SUMO LARANJA — Quantidade: 5 — Peso de cada: 0,2 kg — Peso total: 1,0 kg
HERBAL TEA — Quantidade: 4 — Peso de cada: 0,2 kg — Peso total: 0,8 kg
MEOWCHI MOCHI — Quantidade: 16 — Peso de cada: 0,2 kg — Peso total: 3,2 kg
BAO BUN — Quantidade: 9 — Peso de cada: 0,2 kg — Peso total: 1,8 kg
SUMO MARACUJÁ — Quantidade: 1 — Peso de cada: 0,2 kg — Peso total: 0,2 kg
PARAQUEDAS — Quantidade: 1 — Peso de cada: 10,0 kg — Peso total: 10,0 kg
TELEMÓVEL — Quantidade: 1 — Peso de cada: 0,7 kg — Peso total: 0,7 kg
FURADORA BÁSICA — Quantidade: 1 — Peso de cada: 1,5 kg — Peso total: 1,5 kg
SACO DO GINÁSIO — Quantidade: 1 — Peso de cada: 1,5 kg — Peso total: 1,5 kg
BROCA BÁSICA — Quantidade: 1 — Peso de cada: 1,5 kg — Peso total: 1,5 kg
BANDAGEM — Quantidade: 1 — Peso de cada: 0,1 kg — Peso total: 0,1 kg`;

// Jogador-806: CARTÃO DE/CIDADÃO partido em duas linhas + relógio 0.1 kg
const caseJogador806 = `Jogador-806
Peso: 34.60 / 120.00
1 (5.0)
16 (1.6)
22 (4.4)
24(4.8)
MACHINE PISTOL
BANDAGEM
BIFANA
SUMO ANANAS
1 (0.7)
1 (0.1)
1 (2.0)
66 (9.9)
17:23
CORRENTE DE OURO
TELEMÓVEL
ALGEMAS
KIT REPARAÇÃO
10K
13 (1.3)
2(2.0)
22 (2.2)
1 (0.0)
6 (0.6)
CARTÃO DE
ANEL DE DIAMANTE
RADIO
CORRENTE DE OURO
CIDADÃO
RELOGIO DE OURO`;

// Jogador-1938: parafusos (7x0.2) junto da bifana — sem catalogo, o par
// 7(1.4) era absorvido pela bifana (13+7=20)
const caseJogador1938 = `Jogador - 1938
Peso: 44.35 / 120.00
1 (0.7)
44954 (0.4)
11 (2.2)
1 (0.0)
1 (0.5)
87
TELENOVEL
DINHEIRO
SUMO MARACUJA
CARTÃO DE CIDADÃO
CANA DE PESCA
13 (2.6)
7(1.4)
1 (1.0)
5(0.5)
25 (2.5)
32
BIFANA
PARAFUSOS
PETROL CAN
CARTÃO
CASCA DE BANANA
3 (1.5)
10(20.0)
6(9.0)
2(2.0)
RESTOS
ELETRÓNICOS
KIT REPARAÇÃO
OURO ESTATAL
ARMA DE COLEÇÃO`;

// Pager a 0.5 kg (peso atual) + itens de pesca/reparação
const casePager05 = `1
(0.5)
1 (1.0)
2(4.0)
16 (4.8)
50
80
PAGER
PETROL CAN
KIT REPARAÇÃO
DIARIO DE BORDO`;

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
fails += run(
  "caso 9: itens novos do jogo (sushi, herbal tea, bao bun, paraquedas, furadora, broca)",
  caseNovosItens,
  {
    "arma medio calibre": [1, 5],
    radio: [1, 1],
    sushi: [51, 10.2],
    monoshu: [47, 9.4],
    "sumo laranja": [5, 1],
    "herbal tea": [4, 0.8],
    "medwchi mochi": [16, 3.2],
    "bao bun": [9, 1.8],
    "sumo maracuja": [1, 0.2],
    paraquedas: [1, 10],
    telemovel: [1, 0.7],
    "furadora basica": [1, 1.5],
    "saco do ginasio": [1, 1.5],
    "broca basica": [1, 1.5],
    bandagem: [1, 0.1],
  },
  141,
  47.9,
);
fails += run(
  "caso 10: jogador-806 (anel 13, relogio 6, cartao de cidadao partido)",
  caseJogador806,
  {
    "arma medio calibre": [1, 5],
    bandagem: [16, 1.6],
    bifana: [22, 4.4],
    "sumo ananas": [24, 4.8],
    telemovel: [1, 0.7],
    algemas: [1, 0.1],
    "kit reparacao": [1, 2],
    "corrente 10k": [66, 9.9],
    anel: [13, 1.3],
    radio: [2, 2],
    corrente: [22, 2.2],
    "cartao de cidadao": [1, 0],
    "relogio ouro": [6, 0.6],
  },
  176,
  34.6,
);
fails += run(
  "caso 11: jogador-1938 (parafusos separado da bifana)",
  caseJogador1938,
  {
    telemovel: [1, 0.7],
    dinheiro: [44954, 0.4],
    "sumo maracuja": [11, 2.2],
    "cartao de cidadao": [1, 0],
    "cana de pesca": [1, 0.5],
    bifana: [13, 2.6],
    parafusos: [7, 1.4],
    "petrol can": [1, 1],
    cartao: [5, 0.5],
    "casca de banana": [25, 2.5],
    eletronicos: [3, 1.5],
    "kit reparacao": [10, 20],
    "ouro estatal": [6, 9],
    "arma de colecao": [2, 2],
  },
  45040,
  44.3,
);
fails += run(
  "caso 12: pager a 0.5 kg + itens de pesca/reparação",
  casePager05,
  {
    pager: [1, 0.5],
    "petrol can": [1, 1],
    "kit reparacao": [2, 4],
    diario: [16, 4.8],
  },
  20,
  10.3,
);
console.log(fails === 0 ? "\nTODOS OK ✓" : `\n${fails} FALHAS TOTAIS`);
process.exit(fails === 0 ? 0 : 1);

