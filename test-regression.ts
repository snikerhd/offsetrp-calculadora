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

// Cartão de Cidadão e Carta de Condução (0 kg) não podem ser confundidos com
// o "cartão" genérico (0.1 kg), que antes roubava o par 295 (29.5) da semente.
const ocr10 = `Jogador-1254
Peso: 40.50	120.00
1(1.0)	3 (0.6)	2 (0.4)	1 (5.0)
RADIO	SUMO ANANAS	BIFANA	MACHINE PISTOL
1(0.0)	1 (0.0)	4 (2.0)	1 (1.0)	1 (0.7)
CARTA DE	CARTÃO DE	92
CONDUÇÃO	CIDADÃO	ÁGUA	PETROL CAN	TELEMÓVEL
295 (29.5)	1 (0.3)
SEMENTE ERVA	TESOURA
`;
const r10 = parseInventoryOCR(ocr10);
const e10: [string, number][] = [["semente erva", 295], ["tesoura", 1], ["cartao de cidadao", 1], ["carta de conducao", 1]];
for (const [i, q] of e10) {
  const x = r10.weights.find(w => w.item === i);
  if (x && x.qty === q) { p++; console.log("PASS " + i); } else { f++; console.log("FAIL " + i + " got " + (x?.qty ?? "N/A") + " exp " + q); }
}
const cartaoFalso = r10.weights.find(w => w.item === "cartao");
if (!cartaoFalso) { p++; console.log("PASS sem cartao falso"); } else { f++; console.log("FAIL cartao falso qty=" + cartaoFalso.qty); }

// Popup de arma com "Número de Série:" é apenas identificação — não pode gerar
// "1 arma medio calibre" nem "1 balas baixo" falsos a partir de "Munição: 0".
const ocr11 = `Machine Pistol
Numero de Serie: 10Sop9Kn941|gzf
Munição: 0`;
const r11 = parseInventoryOCR(ocr11);
if (r11.weights.length === 0) { p++; console.log("PASS popup arma sem itens"); } else { f++; console.log("FAIL popup arma gerou itens: " + JSON.stringify(r11.weights)); }
const armaFalsa = r11.weights.find(w => w.item === "arma medio calibre" || w.item === "balas baixo");
if (!armaFalsa) { p++; console.log("PASS sem arma/balas falsos no popup"); } else { f++; console.log("FAIL arma/balas falsos: " + armaFalsa.item); }
if (r11.weaponCapture && r11.weaponCapture.weaponItem === "arma medio calibre" && r11.weaponCapture.ammo === 0) { p++; console.log("PASS weaponCapture mantido (arma medio, ammo 0)"); } else { f++; console.log("FAIL weaponCapture: " + JSON.stringify(r11.weaponCapture)); }

// Popup com munição > 0 conta a munição (via capture) mas NÃO a arma em si.
const ocr12 = `Machine Pistol
Numero de Serie: 10Sop9Kn941|gzf
Munição: 30
Acessórios: Precision Muzzle`;
const r12 = parseInventoryOCR(ocr12);
if (r12.weights.some(w => w.item === "arma medio calibre")) { f++; console.log("FAIL popup contou a arma"); } else { p++; console.log("PASS popup não conta a arma"); }
const m12 = r12.weights.find(w => w.item === "balas medio");
if (m12 && m12.qty === 30) { p++; console.log("PASS popup conta 30 balas medio"); } else { f++; console.log("FAIL popup balas medio got " + (m12?.qty ?? "N/A") + " exp 30"); }
const a12 = r12.weights.find(w => w.item === "acessorios para armas");
if (a12 && a12.qty === 1) { p++; console.log("PASS popup conta 1 acessorio"); } else { f++; console.log("FAIL popup acessorios got " + (a12?.qty ?? "N/A") + " exp 1"); }

// Duas linhas de ruído (POLICIA + CORRENTE DE OURO) entre os números e a linha
// de nomes certa: a fila "8 71 31 12 29" pertence a BANDAGEM/CORRENTE 10K/ANEL/
// RELOGIO/CORRENTE (que aparece 3 linhas abaixo). Antes a fila era atribuída à
// linha de cima (BIFANA/SUMO/RADIO/MICRO), dando "sumo laranja 71 (40%)",
// "bandagem 31" e "anel 29".
const ocr13 = `BIFANA	SUMO LARANJA	RADIO	MICRO SMG	
8 (0.8)	71 (10.7)	31 (3.1)	12(1.2)	29 (2.9)	
POLICIA	
CORRENTE DE OURO	
BANDAGEM	10K	ANEL DE DIAMANTE	RELOGIO DE OURO	CORRENTE DE OURO	
1 (1.0)	
FLASHLIGHT	
1 (1.0)	1 (0.7)	
17:23	`;
const r13 = parseInventoryOCR(ocr13);
const e13: [string, number][] = [["bandagem", 8], ["corrente 10k", 71], ["anel", 31], ["relogio ouro", 12], ["corrente", 29], ["radio", 1]];
for (const [i, q] of e13) {
  const x = r13.weights.find(w => w.item === i);
  if (x && x.qty === q) { p++; console.log("PASS " + i); } else { f++; console.log("FAIL " + i + " got " + (x?.qty ?? "N/A") + " exp " + q); }
}
const sumoFalso = r13.weights.find(w => w.item === "sumo laranja");
if (!sumoFalso) { p++; console.log("PASS sem sumo laranja falso"); } else { f++; console.log("FAIL sumo laranja falso qty=" + sumoFalso.qty + " conf=" + sumoFalso.confidence); }

// A célula "3 (4.5)." tem um ponto final que a fazia cair para texto, excluindo a
// linha toda do CORE — os nomes da linha 1 (PACOTE DEALER/CHIFRES/MOMOSHU...) eram
// depois casados por peso à linha de baixo (199/2/5/1). O ponto final é agora
// tolerado e a linha volta a ser numérica.
const ocr14 = `Vinewood Park Drive, Hipó	Bagageira-07PF35WO	
Peso: 48.48 / 208.08	
33 (3.3)	30 (6.0)	3 (0.6)	3 (4.5).	1(1.0)	
PACOTE DEALER	CHIFRES	MOMOSHU	SACO DO GINÁSIO	HAMMER	
199 (19.9)	2 (1.0)	5 (0.5)	1(1.0)	
LOCKPICK	
SACO PLÁSTICO	AVANÇADA	CASCA DE BANANA	PETROL CAN	
1 (0.2)	10(1.0)	2 (1.4)	
17:23	
CARREGADOR DE	
PISTOLA	BANDAGEM	TELEMÓVEL	`;
const r14 = parseInventoryOCR(ocr14);
const e14: [string, number][] = [["pacote dealer", 33], ["chifres", 30], ["monoshu", 3], ["saco do ginasio", 3], ["hammer", 1], ["saco plastico", 199], ["lockpick avancada", 2], ["casca de banana", 5], ["petrol can", 1], ["carregador baixo calibre", 1], ["bandagem", 10], ["telemovel", 2]];
for (const [i, q] of e14) {
  const x = r14.weights.find(w => w.item === i);
  if (x && x.qty === q) { p++; console.log("PASS " + i); } else { f++; console.log("FAIL " + i + " got " + (x?.qty ?? "N/A") + " exp " + q); }
}
const lpFalso = r14.weights.find(w => w.item === "lockpick");
if (!lpFalso) { p++; console.log("PASS sem lockpick genérico"); } else { f++; console.log("FAIL lockpick genérico qty=" + lpFalso.qty); }

// Linha de ruído "92" entre os números e os nomes; o cristal (droga) e a mesa
// química (ilegal) têm de ser detetados juntamente com a arma.
const ocr15 = `Jogador-1122	
Peso: 171.30 / 120.00	
1 (5.0)	12 (1.2)	3 (0.6)	3 (0.6)	1 (1.0)	
92	
MACHINE PISTOL	BANDAGEM	SUMO ANANAS	HAMBURG STEAK	PETROL CAN	
1 (5.0)	1420 (142.0)	142 (14.2)	
MESA QUÍMICA	CRISTAL	SACO PLÁSTICO	
0 (0.0)	0 (0.0)	
`;
const r15 = parseInventoryOCR(ocr15);
const e15: [string, number][] = [["arma medio calibre", 1], ["bandagem", 12], ["sumo ananas", 3], ["petrol can", 1], ["cristal", 1420], ["saco plastico", 142], ["mesa quimica", 1]];
for (const [i, q] of e15) {
  const x = r15.weights.find(w => w.item === i);
  if (x && x.qty === q) { p++; console.log("PASS " + i); } else { f++; console.log("FAIL " + i + " got " + (x?.qty ?? "N/A") + " exp " + q); }
}
const hamburgFalso = r15.weights.find(w => w.item === "hamburg steak");
if (!hamburgFalso) { p++; console.log("PASS sem hamburg steak falso"); } else { f++; console.log("FAIL hamburg steak falso qty=" + hamburgFalso.qty); }

// OCR com "TELEHÖVEL" (trema), "KIT REPARAÇAD" (truncado) e uma coluna sem nome
// (a célula "1 (1.0)" do C4 entre BANDAGEM e BIFANA). O nome do C4 não foi lido —
// só o temporizador do C4 armado "1:23"; o parser deve detetá-lo via esse token.
const ocr16 = `Peso\t18.18\t128.08\t
1 (5.0)\t28 (2.8)\t1 (1.0)\t12 (2.4)\t16 (3.2)\t
8809\t
MACHINE PISTOL\tBANDAGEM\tBIFANA\tSUMO ANANAS\t
1 (1.0)\t1 (0.7)\t1 (2.0)\t
1:23\t
88\t
PETROL CAN\tTELEHÖVEL\tKIT REPARAÇAD`;
const r16 = parseInventoryOCR(ocr16);
const e16: [string, number][] = [["arma medio calibre", 1], ["bandagem", 28], ["bifana", 12], ["sumo ananas", 16], ["petrol can", 1], ["telemovel", 1], ["kit reparacao", 1], ["c4", 1]];
for (const [i, q] of e16) {
  const x = r16.weights.find(w => w.item === i);
  if (x && x.qty === q) { p++; console.log("PASS " + i); } else { f++; console.log("FAIL " + i + " got " + (x?.qty ?? "N/A") + " exp " + q); }
}

// C4 com nome lido com espaço ("C 4") e peso real 1.0 kg/un.
const ocr17 = `1 (5.0)\t28 (2.8)\t1 (1.0)\t12 (2.4)\t16 (3.2)\t
MACHINE PISTOL\tBANDAGEM\tC 4\tBIFANA\tSUMO ANANAS\t`;
const r17 = parseInventoryOCR(ocr17);
const x17 = r17.weights.find(w => w.item === "c4");
if (x17 && x17.qty === 1 && x17.kg === 1) { p++; console.log("PASS c4 (1x1.0kg)"); } else { f++; console.log("FAIL c4 got qty=" + (x17?.qty ?? "N/A") + " kg=" + (x17?.kg ?? "N/A") + " exp 1x1.0"); }

// Bagageira com semente de tabaco, mining drill, minério, barras, estanho,
// diamante bruto e pepitas. Pepita pesa 0.1 kg (o total "Peso: 151.10" confirma:
// 122.8+0.2+15+5+5.4+1.1+1.6). Antes, o "16 (1.6)" da pepita era atribuído a
// "diamante" e criava um "pepitas 1x0.3" falso.
const ocr18 = `Bagageira-07XU86YK\t
Peso: 151.10 / 200.00\t
1228 (122.8)\t1 (0.2)\t30 (15.0)\t5 (5.0)\t54 (5.4)\t
31\t
SEMENTE TABACO\tMINING DRILL\tMINÉRIO\tBARRA DE OURO\tESTANHO\t
11 (1.1)\t16 (1.6)\t
TARE\t
NET\t
DIAMANTE BRUTO\tPEPITA\t
CU.CAP, 1228× Semente Tabaco — 122,8 kg
1× Mining Drill — 0,2 kg
30× Minério — 15,0 kg
5× Barra de Ouro — 5,0 kg
54× Estanho — 5,4 kg
11× Diamante Bruto — 1,1 kg
16× Pepita — 1,6 kg`;
const r18 = parseInventoryOCR(ocr18);
const e18: [string, number, number][] = [
  ["semente tabaco", 1228, 122.8],
  ["mining drill", 1, 0.2],
  ["minerios", 30, 15],
  ["barras ouro", 5, 5],
  ["estanho", 54, 5.4],
  ["diamante bruto", 11, 1.1],
  ["pepitas", 16, 1.6],
];
for (const [item, qty, kg] of e18) {
  const w = r18.weights.find(x => x.item === item);
  if (w && w.qty === qty && Math.abs(w.kg - kg) < 0.01) { p++; console.log("PASS " + item + " " + qty + "x" + kg); }
  else { f++; console.log("FAIL " + item + " got " + (w ? w.qty + "x" + w.kg : "N/A") + " exp " + qty + "x" + kg); }
}
const fakeDiamante = r18.weights.find(w => w.item === "diamante");
if (!fakeDiamante) { p++; console.log("PASS sem diamante falso da pepita"); } else { f++; console.log("FAIL diamante falso qty=" + fakeDiamante.qty); }
const fakePepita = r18.weights.find(w => w.item === "pepitas" && w.qty === 1);
if (!fakePepita) { p++; console.log("PASS sem pepitas 1x0.3 falsa"); } else { f++; console.log("FAIL pepitas 1x0.3 falsa"); }
const totalKg18 = r18.weights.reduce((s, w) => s + w.kg, 0);
if (Math.abs(totalKg18 - 151.1) < 0.05) { p++; console.log("PASS total 151.1 kg"); } else { f++; console.log("FAIL total got " + totalKg18.toFixed(2) + " exp 151.1"); }

// A lista-síntese do jogo ("N× Item — X,kg") é autoritativa sobre a grelha.
// Ruído na grelha (64, 80, SANTOS, CRIANE) desalinhava colunas e gerava
// "cartao 64×0.1", "pack vinhos 26×0.2" e "sumo 6×0.2" falsos; a síntese dá
// "1× Cartão de Cidadão", "26× Bifana", "6× Pack Vinho(s)" e "3× TV LED 75".
const ocr19 = `Jogador-2763
Peso: 32.98 / 120.00
1 (0.0)	26 (5.2)	1 (1.0)	1 (1.0)	1 (1.0)
CARTÃO DE	64	80
CIDADÃO	BIFANA	PETROL CAN	RADIO	REBARBADORA
44 (8.8).	1 (0.7)	38 (3.8)	2(4.0)	11(2.2)
17:23
SUMO ANANAS	TELEMÓVEL	BANDAGEM	KIT REPARAÇÃO	PERFUME
SANTOS	3 (3.0)	6 (1.2)	10 (1.0)
CRIANE
TV LED 75	PACK VINHOS	PACOTE DEALER
1× Cartão de Cidadão — 0,0 kg
26× Bifana — 5,2 kg
1× Petrol Can — 1,0 kg
1× Rádio — 1,0 kg
1× Rebarbadora — 1,0 kg
44× Sumo Ananás — 8,8 kg
1× Telemóvel — 0,7 kg
38× Bandagem — 3,8 kg
2× Kit Reparação — 4,0 kg
11× Perfume — 2,2 kg
3× TV LED 75 — 3,0 kg
6× Pack Vinho(s) — 1,2 kg
10× Pacote Dealer — 1,0 kg
TOTAL: 32,9 kg`;
const r19 = parseInventoryOCR(ocr19);
const e19: [string, number, number][] = [
  ["cartao de cidadao", 1, 0],
  ["bifana", 26, 5.2],
  ["petrol can", 1, 1],
  ["radio", 1, 1],
  ["rebarbadora", 1, 1],
  ["sumo ananas", 44, 8.8],
  ["telemovel", 1, 0.7],
  ["bandagem", 38, 3.8],
  ["kit reparacao", 2, 4],
  ["perfume", 11, 2.2],
  ["tv led 75", 3, 3],
  ["pack vinhos", 6, 1.2],
  ["pacote dealer", 10, 1],
];
for (const [item, qty, kg] of e19) {
  const w = r19.weights.find(x => x.item === item);
  if (w && w.qty === qty && Math.abs(w.kg - kg) < 0.01) { p++; console.log("PASS " + item + " " + qty + "x" + kg); }
  else { f++; console.log("FAIL " + item + " got " + (w ? w.qty + "x" + w.kg : "N/A") + " exp " + qty + "x" + kg); }
}
const cartaoFalso19 = r19.weights.find(w => w.item === "cartao");
if (!cartaoFalso19) { p++; console.log("PASS sem cartao generico falso na síntese"); } else { f++; console.log("FAIL cartao generico falso qty=" + cartaoFalso19.qty); }
const totalKg19 = r19.weights.reduce((s, w) => s + w.kg, 0);
if (Math.abs(totalKg19 - 32.9) < 0.05) { p++; console.log("PASS total síntese 32.9 kg"); } else { f++; console.log("FAIL total síntese got " + totalKg19.toFixed(2) + " exp 32.9"); }

// Grelha de 1 célula por linha: os stacks "65 (13.0)" (Meowchi Mochi lido como
// "HEOWCHI MOCHI") e "187 (37.4)" (HOHOSHU) têm de ser somados ao MONOSHU
// (0.2 kg/un) — total 252×0.2 = 50.4 kg — sem perder nenhuma célula.
const ocr20 = `27 (2.7)
1 (1.0)
65 (13.0)
187 (37.4)
44
BANDAGEN
PETROL CAN
HEOWCHI MOCHI
HOHOSHU
6 (3.0)
3 (6.0)
1 (5.0)
1 (0.5)
1 (1.0)
ÁGUA
KIT REPARAÇÃO
MACHINE PISTOL
LOCKPICK AVANÇADA
RADIO
1 (0.7)
17:23
TELENÓVEL Repo offset calculadora 65 mochi`;
const r20 = parseInventoryOCR(ocr20);
const e20: [string, number, number][] = [
  ["agua", 6, 3],
  ["kit reparacao", 3, 6],
  ["arma medio calibre", 1, 5],
  ["lockpick avancada", 1, 0.5],
  ["radio", 1, 1],
  ["bandagem", 27, 2.7],
  ["petrol can", 1, 1],
  ["monoshu", 252, 50.4],
  ["telemovel", 1, 0.7],
];
for (const [item, qty, kg] of e20) {
  const w = r20.weights.find(x => x.item === item);
  if (w && w.qty === qty && Math.abs(w.kg - kg) < 0.01) { p++; console.log("PASS " + item + " " + qty + "x" + kg); }
  else { f++; console.log("FAIL " + item + " got " + (w ? w.qty + "x" + w.kg : "N/A") + " exp " + qty + "x" + kg); }
}
const totalQty20 = r20.weights.reduce((s, w) => s + w.qty, 0);
const totalKg20 = r20.weights.reduce((s, w) => s + w.kg, 0);
if (totalQty20 === 293 && Math.abs(totalKg20 - 70.3) < 0.05) { p++; console.log("PASS total grelha 293×70.3 kg"); } else { f++; console.log("FAIL total got " + totalQty20 + "x" + totalKg20.toFixed(2) + " exp 293x70.3"); }

// Bag da Fleeca com linhas de ruído "G" (guias da grelha lidas pelo OCR) entre
// as quantidades e os nomes. Antes, o "G" quebrava o alinhamento por blocos do
// PASS 3.5: LOCKPICK+AVANÇADA sumiam, o telemóvel roubava o "1 (0.5)" (ficava
// 2×0.7≈1.2 a 80%) e o sumo laranja duplicava para 49. Agora: lockpick avançada
// 1×0.5, telemóvel 1×0.7, tudo a 95% e total 134×35.6 kg preservado.
const ocr21 = `FLEECA
Armario-bag686377
Peso: 35.60 / 500.00
1 (10.0)
10 (2.0)
26 (2.6)
1 (1.0)
1 (0.7)
17:23
G
ASSAULT SMG
SUMO LARANJA
BANDAGEM
RADIO
TELEMÓVEL
39 (7.8)
44 (8.8)
1 (0.5)
11 (2.2)
G
LOCKPICK
BIFANA
SUMO ANANAS
AVANÇADA
BIFANA`;
const r21 = parseInventoryOCR(ocr21);
const e21: [string, number, number][] = [
  ["arma medio calibre", 1, 10],
  ["sumo laranja", 10, 2],
  ["bandagem", 26, 2.6],
  ["radio", 1, 1],
  ["telemovel", 1, 0.7],
  ["bifana", 50, 10],
  ["sumo ananas", 44, 8.8],
  ["lockpick avancada", 1, 0.5],
];
for (const [item, qty, kg] of e21) {
  const w = r21.weights.find(x => x.item === item);
  if (w && w.qty === qty && Math.abs(w.kg - kg) < 0.01 && w.confidence >= 80) { p++; console.log("PASS " + item + " " + qty + "x" + kg + " conf=" + w.confidence); }
  else { f++; console.log("FAIL " + item + " got " + (w ? w.qty + "x" + w.kg + " conf=" + w.confidence : "N/A") + " exp " + qty + "x" + kg); }
}
const lp21 = r21.weights.find(w => w.item === "lockpick");
if (!lp21) { p++; console.log("PASS sem lockpick genérico na Fleeca"); } else { f++; console.log("FAIL lockpick genérico qty=" + lp21.qty); }
const totalQty21 = r21.weights.reduce((s, w) => s + w.qty, 0);
const totalKg21 = r21.weights.reduce((s, w) => s + w.kg, 0);
if (totalQty21 === 134 && Math.abs(totalKg21 - 35.6) < 0.05) { p++; console.log("PASS total Fleeca 134×35.6 kg"); } else { f++; console.log("FAIL total Fleeca got " + totalQty21 + "x" + totalKg21.toFixed(2) + " exp 134x35.6"); }

// Bag com crafting (PLÁSTICO/TECIDO) que não estavam no catálogo. Sem eles, o
// PASS 3.5 saltava o bloco todo (exigia todos os nomes conhecidos) e o PASS 4/3
// somavam as células por peso: "bandagem 327×0.1" (8+188+131), "encomenda
// 21×0.2" (18+2+1) e um "telemóvel 1×0.7" falso do "1 (0.7)" órfão do fundo
// (que é uma coluna sem nomes — sem peso unitário único com nome presente já
// não é atribuído). Agora: arma 1, bandagem 8, plástico 188, tecido 131,
// encomenda 18 e dinheiro 57974.
const ocr22 = `Peso: 45.18 / 120.00
1 (5.0)
8 (0.8)
188 (18.8)
131 (13.1)
18 (3.6)
MACHINE PISTOL
BANDAGEM
PLASTICO
TECIDO
ENCOMENDA
57974 (0.6)
DINHEIRO
2(0.4)
1 (0.2)
1 (1.0)
1 (0.7)
1 (1.0)`;
const r22 = parseInventoryOCR(ocr22);
const e22: [string, number, number][] = [
  ["arma medio calibre", 1, 5],
  ["bandagem", 8, 0.8],
  ["plastico", 188, 18.8],
  ["tecido", 131, 13.1],
  ["encomenda", 18, 3.6],
  ["dinheiro", 57974, 0.6],
];
for (const [item, qty, kg] of e22) {
  const w = r22.weights.find(x => x.item === item);
  if (w && w.qty === qty && Math.abs(w.kg - kg) < 0.01 && w.confidence >= 80) { p++; console.log("PASS " + item + " " + qty + "x" + kg + " conf=" + w.confidence); }
  else { f++; console.log("FAIL " + item + " got " + (w ? w.qty + "x" + w.kg + " conf=" + w.confidence : "N/A") + " exp " + qty + "x" + kg); }
}
const telemovelFalso22 = r22.weights.find(w => w.item === "telemovel");
if (!telemovelFalso22) { p++; console.log("PASS sem telemovel falso no bag 22"); } else { f++; console.log("FAIL telemovel falso qty=" + telemovelFalso22.qty); }
// As células do fundo (2(0.4), 1(0.2), 1(1.0), 1(0.7), 1(1.0) = 3.3 kg) são
// itens reais com o nome cortado na imagem — não são descartadas como antes
// (total 41.9). Agora preservam-se como "item nao identificado" e o total bate
// com o Peso 45.18 do jogo.
const cortados22 = r22.weights.filter(w => w.item.startsWith("item nao identificado"));
const cortadoKg22 = cortados22.reduce((s, w) => s + w.kg, 0);
if (cortados22.length >= 1 && Math.abs(cortadoKg22 - 3.3) < 0.05) { p++; console.log("PASS peso cortado bag 22 (" + cortadoKg22.toFixed(2) + " kg)"); } else { f++; console.log("FAIL peso cortado bag 22 got " + cortadoKg22.toFixed(2) + " exp 3.3"); }
const totalKg22 = r22.weights.reduce((s, w) => s + w.kg, 0);
if (Math.abs(totalKg22 - 45.2) < 0.05) { p++; console.log("PASS total bag 22 45.2 kg (≈ Peso 45.18)"); } else { f++; console.log("FAIL total bag 22 got " + totalKg22.toFixed(2) + " exp 45.2"); }

// Bag com síntese do jogo onde os últimos itens vêm cortados ("5× [item cortado]
// — 10,0 kg", "8× — 1,6 kg", "6× — 1,2 kg"). Antes eram descartados (nome não
// identificável → peso perdido: total 37.2 em vez do Peso 49.95) e os "1× —
// 0,0 kg" viravam um "dinheiro 2×0" falso. Agora o peso cortado é mantido como
// "item nao identificado (X kg/un)" → total 50.0 kg ≈ Peso 49.95.
const ocr23 = `Jogador-4113
iiii
Peso: 49.95 / 120.00
1(1.0)
1 (15.0)
H
88
ASSAULT RIFLE MK
PETROL CAN
II
1 (0.2)
2(0.2)
CARREGADOR DE
RIFLE
BANDAGEM
1 (0.7)
11 (1.1)
12(1.2)
101 (15.2)
26 (2.6)
17:23
CORRENTE DE OURO
TELEMOVEL
ANEL DE DIAMANTE
RELOGIO DE OURO
10K
CORRENTE DE OURO
5(10.0)
1 (0.0)
1 (0.0)
8(1.6)
6(1.2) 1× Petrol Can — 1,0 kg
1× Assault Rifle MK II — 15,0 kg
1× Carregador de Rifle — 0,2 kg
2× Bandagem — 0,2 kg
1× Telemóvel — 0,7 kg
11× Anel de Diamante — 1,1 kg
12× Relógio de Ouro — 1,2 kg
101× Corrente de Ouro 10K — 15,2 kg
26× Corrente de Ouro — 2,6 kg
5× [item cortado] — 10,0 kg
1× [item cortado] — 0,0 kg
1× [item cortado] — 0,0 kg
8× [item cortado] — 1,6 kg
6× [item cortado] — 1,2 kg`;
const r23 = parseInventoryOCR(ocr23);
const e23: [string, number, number][] = [
  ["petrol can", 1, 1],
  ["arma alto calibre", 1, 15],
  ["carregador alto calibre", 1, 0.2],
  ["bandagem", 2, 0.2],
  ["telemovel", 1, 0.7],
  ["anel", 11, 1.1],
  ["relogio ouro", 12, 1.2],
  ["corrente 10k", 101, 15.2],
  ["corrente", 26, 2.6],
];
for (const [item, qty, kg] of e23) {
  const w = r23.weights.find(x => x.item === item);
  if (w && w.qty === qty && Math.abs(w.kg - kg) < 0.01) { p++; console.log("PASS " + item + " " + qty + "x" + kg); }
  else { f++; console.log("FAIL " + item + " got " + (w ? w.qty + "x" + w.kg : "N/A") + " exp " + qty + "x" + kg); }
}
const cortados23 = r23.weights.filter(w => w.item.startsWith("item nao identificado"));
const cortadoKg23 = cortados23.reduce((s, w) => s + w.kg, 0);
if (cortados23.length >= 1 && Math.abs(cortadoKg23 - 12.8) < 0.05) { p++; console.log("PASS peso cortado contabilizado (" + cortadoKg23.toFixed(2) + " kg)"); } else { f++; console.log("FAIL peso cortado got " + cortadoKg23.toFixed(2) + " exp 12.8"); }
const dinheiroFalso23 = r23.weights.find(w => w.item === "dinheiro");
if (!dinheiroFalso23) { p++; console.log("PASS sem dinheiro falso (cortado 0 kg)"); } else { f++; console.log("FAIL dinheiro falso qty=" + dinheiroFalso23.qty); }
const totalKg23 = r23.weights.reduce((s, w) => s + w.kg, 0);
if (Math.abs(totalKg23 - 50) < 0.05) { p++; console.log("PASS total bag 23 50.0 kg (≈ Peso 49.95)"); } else { f++; console.log("FAIL total bag 23 got " + totalKg23.toFixed(2) + " exp 50.0"); }
if (r23.text.includes("item nao identificado")) { f++; console.log("FAIL texto de coimas contém item cortado"); } else { p++; console.log("PASS texto de coimas sem item cortado"); }

// ocr24: o MESMO bag, mas SEM as linhas da síntese (o OCR nem sempre as lê).
// Sem síntese o parser usa a grelha — antes do fix dos blocos, o "RELOGIO DE
// OURO" partia-se (splitCells) e "10K"+"CORRENTE DE OURO" fundiam-se na ordem
// errada → o bloco era descartado e o PASS 4 misturava células: anel 26,
// relógio 19 (11+8), 10K 107 (101+6), corrente 12, total 40 kg. Agora: anel
// 11, relógio 12, 10K 101, corrente 26, + cortados → total 50.0 kg.
const ocr24 = `Jogador-4113
iiii
Peso: 49.95 / 120.00
1(1.0)
1 (15.0)
H
88
ASSAULT RIFLE MK
PETROL CAN
II
1 (0.2)
2(0.2)
CARREGADOR DE
RIFLE
BANDAGEM
1 (0.7)
11 (1.1)
12(1.2)
101 (15.2)
26 (2.6)
17:23
CORRENTE DE OURO
TELEMOVEL
ANEL DE DIAMANTE
RELOGIO DE OURO
10K
CORRENTE DE OURO
5(10.0)
1 (0.0)
1 (0.0)
8(1.6)
6(1.2)`;
const r24 = parseInventoryOCR(ocr24);
const e24: [string, number, number][] = [
  ["petrol can", 1, 1],
  ["arma alto calibre", 1, 15],
  ["carregador alto calibre", 1, 0.2],
  ["bandagem", 2, 0.2],
  ["telemovel", 1, 0.7],
  ["anel", 11, 1.1],
  ["relogio ouro", 12, 1.2],
  ["corrente 10k", 101, 15.2],
  ["corrente", 26, 2.6],
];
for (const [item, qty, kg] of e24) {
  const w = r24.weights.find(x => x.item === item);
  if (w && w.qty === qty && Math.abs(w.kg - kg) < 0.01) { p++; console.log("PASS24 " + item + " " + qty + "x" + kg); }
  else { f++; console.log("FAIL24 " + item + " got " + (w ? w.qty + "x" + w.kg : "N/A") + " exp " + qty + "x" + kg); }
}
const cortados24 = r24.weights.filter(w => w.item.startsWith("item nao identificado"));
const cortadoKg24 = cortados24.reduce((s, w) => s + w.kg, 0);
if (cortados24.length >= 1 && Math.abs(cortadoKg24 - 12.8) < 0.05) { p++; console.log("PASS24 peso cortado contabilizado (" + cortadoKg24.toFixed(2) + " kg)"); } else { f++; console.log("FAIL24 peso cortado got " + cortadoKg24.toFixed(2) + " exp 12.8"); }
const totalKg24 = r24.weights.reduce((s, w) => s + w.kg, 0);
if (Math.abs(totalKg24 - 50) < 0.05) { p++; console.log("PASS24 total bag 24 50.0 kg (≈ Peso 49.95)"); } else { f++; console.log("FAIL24 total bag 24 got " + totalKg24.toFixed(2) + " exp 50.0"); }
if (r24.text.includes("item nao identificado")) { f++; console.log("FAIL24 texto de coimas contém item cortado"); } else { p++; console.log("PASS24 texto de coimas sem item cortado"); }

// ocr25: bag com item novo CAIPIRINHA (7×1.4 = 0.2 kg/un). Sem estar no
// catálogo, o nome desconhecido descartava o bloco e a célula 7(1.4) da
// caipirinha ia parar ao bifana/sumo. Com o item no catálogo, o bloco alinha
// por linha: kit 15×30, medwchi 42×8.4, caipirinha 7×1.4, bifana 7×1.4,
// sumo laranja 5×1.0 → total 69.4 = Peso.
const ocr25 = `Jogador-3762
Peso: 69.40 / 120.00
1 (0.7)
3 (0.3)
1(5.0)
1
(1.0)
17:23
88
TELEMOVEL
BANDAGEM
MACHINE PISTOL
PETROL CAN
102(15.3)
11 (1.1)
13(1.3)
25 (2.5)
CORRENTE DE OURO
10K
ANEL DE DIAMANTE
RELOGIO DE OURO
CORRENTE DE OURO
15(30.0)
42 (8.4)
7(1.4)
7(1.4)
5(1.0)
KIT REPARACAO
MEOWCHI MOCHI
CAIPIRINHA
BIFANA
SUMO LARANJA`;
const r25 = parseInventoryOCR(ocr25);
const e25: [string, number, number][] = [
  ["petrol can", 1, 1],
  ["corrente 10k", 102, 15.3],
  ["anel", 11, 1.1],
  ["relogio ouro", 13, 1.3],
  ["corrente", 25, 2.5],
  ["arma medio calibre", 1, 5],
  ["kit reparacao", 15, 30],
  ["bandagem", 3, 0.3],
  ["sumo laranja", 5, 1],
  ["bifana", 7, 1.4],
  ["telemovel", 1, 0.7],
  ["medwchi mochi", 42, 8.4],
  ["caipirinha", 7, 1.4],
];
for (const [item, qty, kg] of e25) {
  const w = r25.weights.find(x => x.item === item);
  if (w && w.qty === qty && Math.abs(w.kg - kg) < 0.01) { p++; console.log("PASS25 " + item + " " + qty + "x" + kg); }
  else { f++; console.log("FAIL25 " + item + " got " + (w ? w.qty + "x" + w.kg : "N/A") + " exp " + qty + "x" + kg); }
}
const totalKg25 = r25.weights.reduce((s, w) => s + w.kg, 0);
if (Math.abs(totalKg25 - 69.4) < 0.05) { p++; console.log("PASS25 total bag 25 69.4 kg (≈ Peso 69.40)"); } else { f++; console.log("FAIL25 total bag 25 got " + totalKg25.toFixed(2) + " exp 69.4"); }

console.log("\n=== TOTAL: " + p + " PASS, " + f + " FAIL ===");
