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

// Sumo ananás (0.2 kg), mesa química a 5 kg e linha de ruído "1- піо:" que
// não pode roubar o alinhamento de CRISTAL/SACO PLÁSTICO. A anotação no final
// da célula do saco plástico não pode duplicar o cristal.
const ocr6 = `Jogador-3080	
Peso: 127.50 / 128.00	
1 (1.0)	34 (3.4)	2(10.0)	32 (6.4)	35 (7.0)	
20	
PETROL CAN	BANDAGEM	MESA QUÍMICA	SUNO ANANAS	BIFANA	
500 (50.0)	50 (5.0)	
1- піо:	
CRISTAL	SACO PLÁSTICO tem 500 cristal com peso de 50kg saco de plastico 50 5kg`;
const r6 = parseInventoryOCR(ocr6);
const e6: [string, number][] = [["petrol can", 1], ["bandagem", 34], ["sumo ananas", 32], ["bifana", 35], ["mesa quimica", 2], ["cristal", 500], ["saco plastico", 50]];
for (const [i, q] of e6) {
  const x = r6.weights.find(w => w.item === i);
  if (x && x.qty === q) { p++; console.log("PASS " + i); } else { f++; console.log("FAIL " + i + " got " + (x?.qty ?? "N/A") + " exp " + q); }
}

// Micro SMG pesa 10 kg/un e Machine Pistol 5 kg/un. Um mix (5+10) dá 7.5 kg —
// todos pesos válidos de "arma medio calibre" — e NÃO pode dar 40% de
// confiança ("Peso divergente") por usar apenas o peso primário (5 kg).
const ocr7 = `1 (10.0)\t1 (5.0)\t
MICRO SMG\tMACHINE PISTOL\t`;
const r7 = parseInventoryOCR(ocr7);
const x7 = r7.weights.find(w => w.item === "arma medio calibre");
if (x7 && x7.qty === 2 && x7.confidence >= 80) { p++; console.log("PASS arma medio calibre (micro+machine) conf=" + x7.confidence); } else { f++; console.log("FAIL arma medio calibre got qty=" + (x7?.qty ?? "N/A") + " conf=" + (x7?.confidence ?? "N/A") + " exp qty 2 conf>=80"); }

// Itens novos + "1BK" é "10K" (não 18K). Tudo a 95%.
const ocr8 = `1 (5.0)	1(2.0)	19 (3.8)	15(3.0)	1(1.0)	
HACHINE PISTOL	KIT REPARAÇÃO	HEDACHI MOCHI	HOHOSHU	PETROL CAN	
64 (6.4)	1 (0.2)	3 (1.5)	4 (0.4)	1 (0.7)	
CARTAD	ENCOHENDA	AGUA	ANEL DE DIAMANTE	TELEHOVEL	
1 (0.2)	1(1.0)	42 (4.2)	65 (9.8)	
CORRENTE DE DURO	
NOBEL TUDO	RADIO	CORRENTE DE OURO	1BK`;
const r8 = parseInventoryOCR(ocr8);
const e8: [string, number][] = [["arma medio calibre", 1], ["kit reparacao", 1], ["medwchi mochi", 19], ["monoshu", 15], ["petrol can", 1], ["cartao", 64], ["encomenda", 1], ["agua", 3], ["anel", 4], ["telemovel", 1], ["nobel tudo", 1], ["radio", 1], ["corrente", 42], ["corrente 10k", 65]];
for (const [i, q] of e8) {
  const x = r8.weights.find(w => w.item === i);
  if (x && x.qty === q) { p++; console.log("PASS " + i); } else { f++; console.log("FAIL " + i + " got " + (x?.qty ?? "N/A") + " exp " + q); }
}

// Coimas rápidas: números e nomes em linhas separadas, com linha de ruído
// (timestamp "17:23") a tentar roubar a linha principal, e um par (qty, peso)
// único dividido em duas linhas. Antes detetava 34 cristal / 1 saco / 1
// telemovel / 1 estimulante (4.4 kg). Agora deve dar 330/33/1/102/102 (88 kg).
const ocr9 = `330(33.0)\t33 (3.3)\t1 (0.7)\t102 (30.6)\t
17:23\t
CRISTAL\t
CRISTAL\tSACO PLÁSTICO\tTELEMÓVEL\tPROCESSADO\t
102 (20.4)\t
ESTIMULANTE\t
ACETONE`;
const r9 = parseInventoryOCR(ocr9);
const e9: [string, number][] = [["cristal", 330], ["saco plastico", 33], ["telemovel", 1], ["cristal processado", 102], ["estimulante", 102]];
for (const [i, q] of e9) {
  const x = r9.weights.find(w => w.item === i);
  if (x && x.qty === q) { p++; console.log("PASS " + i); } else { f++; console.log("FAIL " + i + " got " + (x?.qty ?? "N/A") + " exp " + q); }
}

console.log("\n=== TOTAL: " + p + " PASS, " + f + " FAIL ===");
