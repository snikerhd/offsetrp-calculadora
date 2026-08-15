import { parseInventoryOCR } from "./src/lib/ocr-parser";

const ocr1 = `Jogador-4520
Peso: 251.38 120.00
1300(130.0) 1 (1.0) 10 (1.0) 3 (3.0) 1(10.0)
COLETE
CRISTAL HEDICKIT BANDAGEN FORTALECIDO ASSAULT SHG
1 (0.2) 1 (1.0) 3 (0.6) 4 (0.B) 1 (5.0)
SUMO HARACUJA RADIO BIFANA CARREGADOR DE SHG HESA QUIHICA
170(51.0) 130 (13.0) 170 (34.0)
CRISTAL
PROCESSADO SACO PLÁSTICO ESTIHULANTE
1 (0.7)`;

const ocr2 = `1 (5.0)\t1 (5.0)\t1 (5.0)\t1 (15.0)\t1 (5.0)
100\tBULLPUP RIFLE
VINTAGE PISTOL\tMACHINE PISTOL\tVINTAGE PISTOL\tHK2\tAP PISTOL
1 (5.0)\t1 (5.0)\t1 (5.0)\t1 (5.0)\t1 (5.0)
SNS PISTOL MK2\tSNS PISTOL HK2\tMACHINE PISTOL\tVINTAGE PISTOL\tMACHINE PISTOL
1 (5.0)\t1 (5.0)\t1 (15.0)\t1 (5.0)\t1 (5.0)
GUSENBERG
REVOLVER MK2\tMACHINE PISTOL`;

const ocr3 = `Jogador-3393\t
Peso: 63.78 /\t120.00\t
6 (1.2)\t18 (1.8)\t1 (5.0)\t57851 (0.6)\t19 (3.8)\t
CARREGADOR DE\t
SMG\tPEÇA BÁSICA\tMACHINE PISTOL\tDINHEIRO\tSUMO LARANJA\t
1 (0.7)\t1 (0.0)\t3 (6.0)\t29 (29)\t1 (0.0)\t
PORTE DE ARMA\tCARTÃO DE\t
TELEMÓVEL\tBRANCA\tKIT REPARAÇÃO\tBANDAGEM\tCIDADÃO\t
1 (0.1)\t1 (0.5)\t18 (3.6)\t61 (6.1)\t61 (6.1)\t
31\t
LICENÇA PESCA\tCANA DE PESCA\tTRUTA\tALUMINIO\tBORRACHA\t
1 (0.5)\t1 (0.5)\t8 (1.6)\t200 (20.0)\t14(2.8)\t`;

console.log("=== TEST 1: ORIGINAL ===");
const r1 = parseInventoryOCR(ocr1);
const e1: [string, number][] = [["cristal", 1300], ["colete fortalecido", 3], ["medickits", 1], ["arma medio calibre", 1], ["carregador medio calibre", 4], ["cristal processado", 170], ["estimulante", 170]];
let p = 0, f = 0;
for (const [i, q] of e1) {
  const x = r1.weights.find(w => w.item === i);
  if (x && x.qty === q) { p++; console.log("PASS " + i); } else { f++; console.log("FAIL " + i + " got " + (x?.qty ?? "N/A") + " exp " + q); }
}

console.log("\n=== TEST 2: WEAPONS ===");
const r2 = parseInventoryOCR(ocr2);
const e2: [string, number][] = [["arma baixo calibre", 7], ["arma medio calibre", 6], ["arma alto calibre", 2]];
for (const [i, q] of e2) {
  const x = r2.weights.find(w => w.item === i);
  if (x && x.qty === q) { p++; console.log("PASS " + i); } else { f++; console.log("FAIL " + i + " got " + (x?.qty ?? "N/A") + " exp " + q); }
}

console.log("\n=== TEST 3: INVENTORY ===");
const r3 = parseInventoryOCR(ocr3);
const e3: [string, number][] = [["carregador medio calibre", 6], ["peca basica", 18], ["arma medio calibre", 1], ["dinheiro", 57851], ["aluminio", 61], ["borracha", 61], ["truta", 18], ["kit reparacao", 3], ["telemovel", 1], ["sumo laranja", 19]];
for (const [i, q] of e3) {
  const x = r3.weights.find(w => w.item === i);
  if (x && x.qty === q) { p++; console.log("PASS " + i); } else { f++; console.log("FAIL " + i + " got " + (x?.qty ?? "N/A") + " exp " + q); }
}

// Corrente 10k / anel / corrente / relógio de ouro lado a lado.
// Antes: "5 (0.5)" de relógio de ouro (0.1 kg/un) era atribuído à corrente
// (28 em vez de 23) e o relógio acabava com 103x. O relógio de ouro pesa
// 0.1 kg/un no jogo, não 0.2.
const ocr4 = `1 (1.0)\t1 (5.0)\t1 (1.0)\t
96\t
RADID\tHACHINE PISTOL\tPETROL CAN\t
1 (0.7)\t103 (15.4)\t20 (2.0)\t23 (2.3)\t5 (0.5)\t
CORRENTE DE DURO\t
TELEHOVEL\t1BK\tANEL DE DIAHANTE\tCORRENTE DE DURO\tRELOGIO DE DURO\t`;
const r4 = parseInventoryOCR(ocr4);
const e4: [string, number][] = [["corrente 10k", 103], ["anel", 20], ["corrente", 23], ["relogio ouro", 5], ["telemovel", 1]];
for (const [i, q] of e4) {
  const x = r4.weights.find(w => w.item === i);
  if (x && x.qty === q) { p++; console.log("PASS " + i); } else { f++; console.log("FAIL " + i + " got " + (x?.qty ?? "N/A") + " exp " + q); }
}

// Mesa química pesa 5 kg/un (não 0.7). Multi-unidades como "2 (10.0)" e
// "3 (15.0)" não podem ser "corrigidas" para "2 (1.0)"/3 (1.5) pela heurística
// de ponto decimal perdido.
const ocr5 = `2 (10.0)\t1 (5.0)\t3 (15.0)\t
MESA QUIMICA\tMESA QUIMICA\tMESA QUIMICA\t`;
const r5 = parseInventoryOCR(ocr5);
const e5: [string, number][] = [["mesa quimica", 6]];
for (const [i, q] of e5) {
  const x = r5.weights.find(w => w.item === i);
  if (x && x.qty === q) { p++; console.log("PASS " + i); } else { f++; console.log("FAIL " + i + " got " + (x?.qty ?? "N/A") + " exp " + q); }
}

console.log("\n=== TOTAL: " + p + " PASS, " + f + " FAIL ===");
