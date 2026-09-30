import { parseInventoryOCR } from "../src/lib/ocr-parser";

// Texto OCR bruto da captura do utilizador
const raw = `4 (1.2) FOGO ARTIFÍCIO
1 (1.0) 92 PETROL CAN
19 (1.9) BANDAGEM
1 (0.0) CARTÃO DE CIDADÃO
1 (1.0) COLETE FORTALECIDO
2 (4.0) COROA
5 (10.0) KIT REPARAÇÃO
2 (2.0) ARMA DE COLEÇÃO
91 (18.2) MOMOSHU
30056 (0.3) DINHEIRO
14 (2.8) QUADRO
1 (1.0) MEDICKIT
10 (15.0) OURO ESTATAL`;

const res = parseInventoryOCR(raw);
for (const w of res.weights) {
  console.log(
    `${w.item} | qty=${w.qty} | kg=${w.kg} | unit=${w.unitKg} | conf=${w.confidence}`
  );
}
const unknown = res.weights.filter((w) => w.item.startsWith("item nao identificado"));
console.log(`\nTOTAL: ${res.weights.length} itens, ${unknown.length} nao identificados`);