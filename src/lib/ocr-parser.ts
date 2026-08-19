// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// INVENTORY OCR PARSER â€” Offset RP
//
// The game inventory OCR produces a grid of quantity/weight cells paired with
// item name cells. OCR can split compound names across cells AND lines.
//
// STRATEGY:
// 1. Fix OCR typos
// 2. Group lines into "blocks": each block = a numeric row + nearby text rows
// 3. Collect ALL text cells from the text rows, merge compound names
// 4. Match quantity cells to name cells by position (first num â†” first name)
// 5. Use unit weight as validation, not as primary matching signal
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
import { ITEM_BY_NAME, ITEM_CATALOG } from "./item-weights";

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface WeaponCapture {
  weapon: string;
  weaponItem: "arma baixo calibre" | "arma medio calibre" | "arma alto calibre";
  ammo: number;
  ammoItem: "balas baixo" | "balas medio" | "balas alto";
  accessoryCount: number;
}

export interface ItemMatch {
  item: string;
  qty: number;
  kg: number;
  unitKg: number | null;
  confidence: number;
  confidenceLevel: "high" | "medium" | "low";
  matchReason: string;
}

export interface ParseResult {
  text: string;
  weights: ItemMatch[];
  weaponCapture: WeaponCapture | null;
  overallConfidence: number;
}

// â”€â”€ OCR typo corrections â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function fixOcrTypos(text: string): string {
  const typoRules: [RegExp, string][] = [
    [/\bHEDIC?KIT\b/gi, "MEDIKIT"],
    [/\bMEDIC?KTT\b/gi, "MEDIKIT"],
    [/\bHEDICK?IT\b/gi, "MEDIKIT"],
    [/\bMEDTCKIT\b/gi, "MEDIKIT"],
    [/\bMEDTKIT\b/gi, "MEDIKIT"],
    [/\bMEDIC?K1T\b/gi, "MEDIKIT"],
    [/\bBANDAGEN\b/gi, "BANDAGEM"],
    [/\bBANDAGEH\b/gi, "BANDAGEM"],
    [/\bBAHDAGEM\b/gi, "BANDAGEM"],
    [/\bESTIHULANTE\b/gi, "ESTIMULANTE"],
    [/\bESTIMULAHTE\b/gi, "ESTIMULANTE"],
    [/\bESTINULANTE\b/gi, "ESTIMULANTE"],
    [/\bESTIHULAHTE\b/gi, "ESTIMULANTE"],
    [/\bESTTMULANTE\b/gi, "ESTIMULANTE"],
    [/\bESTIMULAMTE\b/gi, "ESTIMULANTE"],
    [/\bASSAULT\s+SHG\b/gi, "ASSAULT SMG"],
    [/\bASSAULT\s+SNG\b/gi, "ASSAULT SMG"],
    [/\bASSAULT\s+SHC\b/gi, "ASSAULT SMG"],
    [/\bCARREGADOR\s+DE\s+SHG\b/gi, "CARREGADOR DE SMG"],
    [/\bCARREGADOR\s+DE\s+SNG\b/gi, "CARREGADOR DE SMG"],
    [/\bHICRO\s+SMG\b/gi, "MICRO SMG"],
    [/\bMICRO\s+SHG\b/gi, "MICRO SMG"],
    [/\bHICRO\s+SHG\b/gi, "MICRO SMG"],
    [/\bHACHINE\s+PISTOL\b/gi, "MACHINE PISTOL"],
    [/\bMACHTNE\s+PISTOL\b/gi, "MACHINE PISTOL"],
    [/\bCRTSTAL\b/gi, "CRISTAL"],
    [/\bDINHETRO\b/gi, "DINHEIRO"],
    [/\bDINEIRO\b/gi, "DINHEIRO"],
    [/\bDTNHEIRO\b/gi, "DINHEIRO"],
    [/\bFORTALECTDO\b/gi, "FORTALECIDO"],
    [/\bPULSETRA\b/gi, "PULSEIRA"],
    [/\bLOCKPECK\b/gi, "LOCKPICK"],
    [/\bHESA\s+QUIH?ICA\b/gi, "MESA QUIMICA"],
    [/\bMESA\s+QUIH?ICA\b/gi, "MESA QUIMICA"],
    [/\bHESA\s+QUIMICA\b/gi, "MESA QUIMICA"],
    [/\bSUMO\s+HARACUJA\b/gi, "SUMO MARACUJA"],
    [/\bSUHO\s+MARACUJA\b/gi, "SUMO MARACUJA"],
    [/\bSUHO\s+HARACUJA\b/gi, "SUMO MARACUJA"],
    [/\bSUNO\b/gi, "SUMO"],
    // OCR: "HEDACHI/HOHOSHU/CARTAD/ENCOHENDA" sÃ£o misreads de itens
    [/\bHEDACHI\s+MOCHI\b/gi, "MEDWCHI MOCHI"],
    [/\bMEOWCHI\s+MOCHI\b/gi, "MEDWCHI MOCHI"],
    [/\bHOHOSHU\b/gi, "MONOSHU"],
    [/\bMOMOSHU\b/gi, "MONOSHU"],
    [/\bCARTAD\b/gi, "CARTAO"],
    [/\bENCOHENDA\b/gi, "ENCOMENDA"],
    [/\bBTFANA\b/gi, "BIFANA"],
    [/\bSACO\s+PL[AÃ]STICO\b/gi, "SACO PLASTICO"],
    [/\bSACO\s+PLÃSTTCO\b/gi, "SACO PLASTICO"],
    [/\bREBARBADOÃRA\b/gi, "REBARBADORA"],
    [/\bHACO\s+TABACO\b/gi, "MACO TABACO"],
    [/\bMAÃ‡O\s+TABACO\b/gi, "MACO TABACO"],
    // OCR: "OURO" is often misread as "DURO"
    [/\bCORRENTE\s+DE\s+DURO\b/gi, "CORRENTE DE OURO"],
    // OCR: "TELENOVEL" is a misread of "TELEMOVEL"
    [/\bTELENOVEL\b/gi, "TELEMOVEL"],
    // Variante acentuada ("TELENÃ“VEL"): o Ã“ agudo nÃ£o casa na regra sem acento
    // nem no trema Ã–â†’O, logo precisa da sua prÃ³pria regra.
    [/\bTELEN[OÃ“]VEL\b/gi, "TELEMOVEL"],
    // OCR: "TELEHOVEL" is a misread of "TELEMOVEL"
    [/\bTELEHOVEL\b/gi, "TELEMOVEL"],
    // OCR: "1BK" Ã© misread de "10K" (o jogo sÃ³ tem corrente 10K, nÃ£o 18K)
    [/\b1BK\b/gi, "10K"],
    // OCR: "1OK" â†’ "10K", "14K" etc. digit misreads in karat labels
    [/\b1OK\b/gi, "10K"],
    // OCR lÃª trema/acentos errados: "TELEHÃ–VEL" Ã© "TELEMOVEL", etc.
    [/\bTELEH[OÃ–]VEL\b/gi, "TELEMOVEL"],
    // Nomes truncados no canto direito da imagem (ex.: "KIT REPARAÃ‡AD").
    [/\bREPARA[CÃ‡]AD\b/gi, "REPARACAO"],
    [/\bREPARA[CÃ‡]AR\b/gi, "REPARACAO"],
    // C4 lido com espaÃ§o ou como outro carÃ¡ter (ex.: "C 4", "L4").
    [/\bC\s*4\b/gi, "C4"],
    [/\bL4\b/gi, "C4"],
    // C4 armado mostra um temporizador (ex.: "1:23") em vez do nome â€” o OCR lÃª
    // esse token isolado. Tratamo-lo como C4; o PASS 3 liga-o Ã  cÃ©lula de peso
    // Ã³rfÃ£ "1 (1.0)".
    [/(^|[\t \n])1:23(?=[\t \n]|$)/g, "$1C4"],
  ];
  let result = text;
  // Trema comum em texto OCR (Ã–â†’O, Ãœâ†’U, Ã„â†’A) para os padrÃµes abaixo casarem.
  result = result
    .replace(/Ã–/g, "O").replace(/Ã¶/g, "o")
    .replace(/Ãœ/g, "U").replace(/Ã¼/g, "u")
    .replace(/Ã„/g, "A").replace(/Ã¤/g, "a");
  for (const [pattern, replacement] of typoRules) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

// â”€â”€ ITEM_MAP: regex â†’ canonical name â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ITEM_MAP: [RegExp, string][] = [
  [/lockpick\s*avan[cÃ§]ad/i, "lockpick avancada"],
  [/lockpeck\s*avan[cÃ§]ad/i, "lockpick avancada"],
  [/lockpick|lockpeck/i, "lockpick"],
  [/acess[oÃ³]rio[s]?\s*(para\s*)?arma[s]?/i, "acessorios para armas"],
  [/algema/i, "algemas"],
  [/medikit|medick/i, "medickits"],
  [/mesa\s*quimica/i, "mesa quimica"],
  [/diamante\s*bruto/i, "diamante bruto"],
  [/anel\s*(de\s*)?diamante/i, "anel"],
  [/diamante/i, "diamante"],
  [/safira/i, "safiras"],
  [/barra[s]?\s*(de\s*)?(ouro|outro)/i, "barras ouro"],
  [/pepita/i, "pepitas"],
  [/p[oÃ³]lvora/i, "polvora"],
  [/esquema/i, "esquemas"],
  [/pe[cÃ§]as?\s*(de\s*)?arma/i, "pecas"],
  [/rebarbadora/i, "rebarbadora"],
  [/mining\s*drill/i, "mining drill"],
  [/quadro/i, "quadro"],
  [/pulseira/i, "pulseira ouro"],
  [/rel[oÃ³]gio\s*(de\s*)?ouro/i, "relogio ouro"],
  [/corrente\s*(de\s*)?ouro\s*10k|(?:^|\s)10k\s*corrente/i, "corrente 10k"],
  [/corrente\s*(de\s*)?ouro/i, "corrente"],
  [/^(?:10|14|18|22)k$/i, "corrente 10k"],
  [/anel\s*(de\s*)?diamante/i, "anel"],
  [/perfume/i, "perfume"],
  [/phone\s*7/i, "phone 7"],
  [/tv\s*led/i, "tv led 75"],
  [/computador/i, "computador"],
  [/pack\s*vinho/i, "pack vinhos"],
  [/ouro\s*estatal/i, "ouro estatal"],
  [/arma\s*de\s*cole[cÃ§]/i, "arma de colecao"],
  [/tigre/i, "tigre"],
  [/documento/i, "documentos"],
  [/[aÃ¡]guia\s*(de\s*)?bronze/i, "aguia de bronze"],
  [/crypto?\s*pen/i, "crypto pen"],
  [/coroa/i, "coroa"],
  [/garrafa\s*(de\s*)?nitro/i, "garrafa de nitro"],
  [/pacote\s*dealer/i, "pacote dealer"],
  [/pacote\s*(de\s*)?droga/i, "pacote dealer"],
  [/dinheiro/i, "dinheiro"],
  [/charro/i, "charros"],
  [/cristal\s*processado/i, "cristal processado"],
  [/cristal/i, "cristal"],
  [/folha\s*tabaco/i, "folha tabaco"],
  [/ma[cÃ§]o\s*tabaco/i, "maÃ§o"],
  [/maco\s*tabaco/i, "maÃ§o"],
  [/ma[cÃ§]o/i, "maÃ§o"],
  [/estimulante/i, "estimulante"],
  [/semente\s*(de\s*)?(erva|cannabis)/i, "semente erva"],
  [/semente\s*(de\s*)?tabaco/i, "semente tabaco"],
  [/cabe[cÃ§]o\s*(de\s*)?(erva|cannabis)/i, "cabeco erva"],
  [/cabe[cÃ§]o/i, "cabeco erva"],
  [/[oÃ³]leo\s*medicinal/i, "oleo medicinal"],
  [/saco\s*(de\s*)?(erva|cannabis)/i, "saco erva"],
  [/saco\s*pl[aÃ¡]stico/i, "saco plastico"],
  // Armas brancas ilegais
  [/taco\s*(de\s*)?baseball/i, "arma branca ilegal"],
  [/taco\s*(de\s*)?snooker/i, "arma branca ilegal"],
  [/machado/i, "arma branca ilegal"],
  [/lucille/i, "arma branca ilegal"],
  // Armas brancas legais
  [/chave\s*inglesa/i, "arma branca"],
  [/faca\b/i, "arma branca"],
  [/canivete/i, "arma branca"],
  [/martelo/i, "arma branca"],
  // Baixo calibre
  [/sns\s*pistol\s+hk\s*2/i, "arma sns hk2 dupla"],
  [/sns\s*pistol\s+mk\s*2/i, "arma baixo calibre"],
  [/sns\s*pistol/i, "arma baixo calibre"],
  [/vintage\s*pistol/i, "arma baixo calibre"],
  [/pistol\s*\.?50/i, "arma baixo calibre"],
  [/revolver\s*mk\s*2/i, "arma baixo calibre"],
  [/ap\s*pistol/i, "arma baixo calibre"],
  // MÃ©dio calibre
  [/machine\s*pistol/i, "arma medio calibre"],
  [/hk\s*2\b|hk2\b/i, "arma medio calibre"],
  [/micro\s*smg/i, "arma medio calibre"],
  [/combat\s*pdw/i, "arma medio calibre"],
  [/assault\s*smg/i, "arma medio calibre"],
  // Alto calibre
  [/assault\s*rifle(?:\s*mk(?:\s*(?:2|ii))?)?/i, "arma alto calibre"],
  [/rifle\s*mk\s*2/i, "arma alto calibre"],
  [/bullpup\s*(mk\s*2|rifle)/i, "arma alto calibre"],
  [/gusenberg/i, "arma alto calibre"],
  [/double\s*barrel/i, "arma alto calibre"],
  [/compact\s*rifle/i, "arma alto calibre"],
  [/advanced\s*rifle/i, "arma alto calibre"],
  [/spas[\s-]*12/i, "arma alto calibre"],
  [/tactical\s*(carbine|rifle)/i, "arma alto calibre"],
  [/military\s*rifle/i, "arma alto calibre"],
  // Carregadores
  [/carregador\s*(de\s*)?pistola/i, "carregador baixo calibre"],
  [/carregador\s*(de\s*)?smg/i, "carregador medio calibre"],
  [/carregador\s*(de\s*)?rifle/i, "carregador alto calibre"],
  // "CARREGADOR DE" e "RIFLE" podem ficar separados por outra cÃ©lula quando o
  // OCR parte a linha (ex.: "CARREGADOR DE" ... "RIFLE").
  [/carregador\s+de\b[\s\S]*?\brifle\b/i, "carregador alto calibre"],
  [/carregador\s*(de\s*)?shotgun/i, "carregador alto calibre"],
  [/carregador\s*(de\s*)?baixo\s*calibre/i, "carregador baixo calibre"],
  [/carregador\s*(de\s*)?m[eÃ©]dio\s*calibre/i, "carregador medio calibre"],
  [/carregador\s*(de\s*)?alto\s*calibre/i, "carregador alto calibre"],
  // Blueprints
  [/blueprint\s*pistola/i, "blueprint pistola"],
  [/blueprint\s*smg/i, "blueprint smg"],
  [/blueprint\s*rifle/i, "blueprint rifle"],
  [/esquemas?\s+de\s+armas/i, "esquemas"],
  [/pe[cÃ§]a\s*avan[cÃ§]ada/i, "peca avancada"],
  [/pe[cÃ§]a\s*b[aÃ¡]sica/i, "peca basica"],
  // Outros ilegais
  [/colete\s*fortalecido/i, "colete fortalecido"],
  [/colete/i, "colete"],
  [/pager/i, "pager"],
  [/garrafa/i, "garrafa de nitro"],
  [/nitro/i, "nitro"],
  [/adaga/i, "adaga"],
  [/idolo|[iÃ­]dolo/i, "idolo"],
  [/enxofre/i, "enxofre"],
  [/estanho/i, "estanho"],
  [/n[iÃ­]quel/i, "niquel"],
  [/min[eÃ©]rio/i, "minerios"],
  [/chifre/i, "chifres"],
  [/anel/i, "anel"],
  [/corrente/i, "corrente"],
  [/rel[oÃ³]gio/i, "relogio ouro"],
  [/bomba/i, "bomba"],
  [/orca/i, "orca"],
  [/tubar[aÃ£]o\s*martelo/i, "tubarao martelo"],
  [/tubar[aÃ£]o\s*branco/i, "tubarao branco"],
  [/tubar[aÃ£]o/i, "tubarao branco"],
  [/raia/i, "raia"],
  [/polvo/i, "polvo"],
  [/ba[uÃº]\s*(de\s*)?especiaria/i, "bau"],
  [/di[aÃ¡]rio\s*(de\s*)?bordo/i, "diario"],
  [/pacote\s*ilegal/i, "pacote ilegal"],
  [/muni[cÃ§][aÃ£]o/i, "balas baixo"],
  [/bala\b/i, "balas baixo"],
  [/c4/i, "c4"],
  [/c\s*4\b/i, "c4"],
  [/pack\s*safira/i, "pack safira"],
  // Pesca
  [/truta/i, "truta"],
  [/salm[aÃ£]o/i, "salmao"],
  [/atum/i, "atum"],
  [/sardinha/i, "sardinha"],
  [/cana\s*(de\s*)?pesca/i, "cana de pesca"],
  [/licen[cÃ§]a\s*(de\s*)?pesca/i, "licenca pesca"],
  // Crafting / Materiais
  [/alum[iÃ­]nio/i, "aluminio"],
  [/borracha/i, "borracha"],
  [/pl[aÃ¡]stic[o0]/i, "plastico"],
  [/tecido/i, "tecido"],
  [/ferro\s*-?\s*velho/i, "ferro velho"],
  [/kit\s*repara[cÃ§][aÃ£]?[o]?[d]?/i, "kit reparacao"],
  // Itens legais comuns
  [/bandagem/i, "bandagem"],
  [/sumo\s*ananas/i, "sumo ananas"],
  [/sumo\s*maracu/i, "sumo maracuja"],
  [/sumo\s*laranja/i, "sumo laranja"],
  [/sumo/i, "sumo"],
  [/bifana/i, "bifana"],
  [/caipirinha|c[aÃ¡]ipirinha|caipirina/i, "caipirinha"],
  [/copo\s*(de\s*)?cart[aÃ£]o/i, "copo de cartao"],
  [/r[aÃ¡]dio/i, "radio"],
  [/telem[oÃ³]vel/i, "telemovel"],
  [/petrol\s*can/i, "petrol can"],
  [/tuna\s*deluxe/i, "tuna deluxe"],
  [/tesoura/i, "tesoura"],
  [/peda[cÃ§]o\s*de\s*metal/i, "pedaco de metal"],
  [/fotografia/i, "fotografia"],
  [/cart[aÃ£]o\s*de\s*cidad[aÃ£]o/i, "cartao de cidadao"],
  [/carta\s*de\s*condu[cÃ§][aÃ£]o/i, "carta de conducao"],
  [/cart[aÃ£]o\b/i, "cartao"],
  [/carta\s+de\b/i, "carta de conducao"],
  [/encomenda/i, "encomenda"],
  [/[aÃ¡]gua\b/i, "agua"],
  [/meowch[iÃ­]\s*mochi|medwch[iÃ­]\s*mochi|hedach[iÃ­]\s*mochi/i, "medwchi mochi"],
  [/monoshu|momoshu|moonshine/i, "monoshu"],
  [/saco\s*do\s*gin[aÃ¡]sio/i, "saco do ginasio"],
  [/\bhammer\b/i, "hammer"],
  [/casca\s*de\s*banana/i, "casca de banana"],
  [/nobel\s*tudo/i, "nobel tudo"],
  [/caneta/i, "caneta"],
  [/passaporte/i, "passaporte"],
];

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Linhas de ruÃ­do OCR que nunca sÃ£o nomes de itens (timestamps, peso do
// jogador, header do inventÃ¡rio). Se entrassem na coleÃ§Ã£o de nomes podiam
// roubar o papel de "linha principal" e desalinhar as quantidades.
const NOISE_LINE_RE =
  /^(\d{1,2}:\d{2}\s*$|peso\s*:.*|jogador\s*[-:].*|(?:invent[aÃ¡]rio|mochila|equipamento)\s*$)/i;

function getUnitWeight(itemName: string): number | null {
  const def = ITEM_BY_NAME.get(itemName);
  return def ? def.unitKg : null;
}

// â”€â”€ Noise detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function isNoiseCell(cell: string): boolean {
  const s = cell.trim();
  if (/^\d{1,2}:\d{2}$/.test(s)) return true; // timestamps
  if (/peso\s*:/i.test(s)) return true;
  if (/jogador\s*[-:]/i.test(s)) return true;
  if (/^(invent[aÃ¡]rio|mochila|equipamento)$/i.test(s)) return true;
  // Standalone numbers >20 without parenthesized weight = OCR noise (e.g., "56", "64", "80")
  if (/^\d+$/.test(s) && parseInt(s, 10) > 20) return true;
  // Standalone decimals >20 (e.g., "83.00", "120.00" from weight bar)
  if (/^\d+\.\d+$/.test(s) && parseFloat(s) > 20) return true;
  // Single letter noise
  if (/^[a-z]$/i.test(s)) return true;
  return false;
}

// â”€â”€ Qty/weight parsing with decimal-correction alternatives â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface QtyWeightParsed {
  qty: number;
  totalKg: number | null;
  altWeights: number[]; // decimal-corrected alternatives
  raw: string;
}

function parseQtyWeight(cell: string): QtyWeightParsed {
  const raw = cell.trim();
  const m = raw.match(/^(\d[\d.,]*)\s*\(\s*([^)]+)\s*\)/);
  if (!m) {
    const q = raw.match(/^(\d[\d.,]*)/);
    return {
      qty: q ? Math.round(parseFloat(q[1].replace(/\./g, "").replace(",", ".")) || 1) : 1,
      totalKg: null, altWeights: [], raw,
    };
  }

  const qty = Math.round(parseFloat(m[1].replace(/\./g, "").replace(",", ".")) || 1);
  let weightStr = m[2]
    .replace(/B/g, "8").replace(/O/gi, "0").replace(/l/g, "1")
    .replace(/S/g, "5").replace(/G/g, "6").replace(/Z/g, "2")
    .trim();

  const totalKg = parseFloat(weightStr.replace(",", "."));
  if (!Number.isFinite(totalKg) || totalKg <= 0) {
    return { qty, totalKg: null, altWeights: [], raw };
  }

  // â”€â”€ Aggressive decimal recovery â”€â”€
  // Always try decimal insertion when weight has no decimal and 2+ digits
  const altWeights: number[] = [];
  const hasDecimal = weightStr.includes(".") || weightStr.includes(",");

  if (!hasDecimal) {
    const digits = weightStr.replace(/[^0-9]/g, "");
    if (digits.length >= 2) {
      for (let pos = 1; pos < digits.length; pos++) {
        const candidate = parseFloat(digits.slice(0, pos) + "." + digits.slice(pos));
        if (candidate > 0 && candidate !== totalKg) {
          const candUnit = candidate / qty;
          if (unitWeightMatchesKnown(candUnit)) {
            altWeights.push(candidate);
          }
        }
      }
    }
  }

  // Also try when unit weight is suspiciously large (>2kg and qty>1)
  if (totalKg / qty > 2 && qty > 1) {
    const str = String(totalKg).replace(".", "");
    for (let pos = 1; pos < str.length; pos++) {
      const candidate = parseFloat(str.slice(0, pos) + "." + str.slice(pos));
      if (candidate > 0 && candidate !== totalKg && !altWeights.includes(candidate)) {
        const candUnit = candidate / qty;
        if (candUnit >= 0.05 && unitWeightMatchesKnown(candUnit)) {
          altWeights.push(candidate);
        }
      }
    }
  }

  return { qty, totalKg, altWeights, raw };
}

// Try decimal correction to match a specific item
function tryDecimalCorrection(
  itemName: string, qty: number, totalKg: number, altWeights: number[]
): number | null {
  if (weightMatches(itemName, qty, totalKg)) return null; // already matches
  for (const alt of altWeights) {
    // Only allow corrections that don't change totalKg by more than 50%
    const changeRatio = Math.abs(alt - totalKg) / totalKg;
    if (changeRatio > 0.5) continue;
    if (weightMatches(itemName, qty, alt)) return alt;
  }
  // Manual fallback: try inserting decimal at every position
  const def = ITEM_BY_NAME.get(itemName);
  if (!def || def.unitKg <= 0) return null;
  const allTargets = [def.unitKg, ...(ALT_WEIGHTS[itemName] || [])];
  const str = String(totalKg).replace(".", "");
  for (let pos = 1; pos < str.length; pos++) {
    const candidate = parseFloat(str.slice(0, pos) + "." + str.slice(pos));
    if (candidate > 0 && candidate !== totalKg) {
      // Only allow corrections that don't change totalKg by more than 50%
      const changeRatio = Math.abs(candidate - totalKg) / totalKg;
      if (changeRatio > 0.5) continue;
      const candUnit = candidate / qty;
      for (const target of allTargets) {
        if (Math.abs(candUnit - target) <= Math.max(0.03, target * 0.15)) return candidate;
      }
    }
  }
  return null;
}

const ALT_WEIGHTS: Record<string, number[]> = {
  "arma medio calibre": [5, 7.5, 10],
  "arma alto calibre": [15, 10],
  "arma baixo calibre": [5, 3],
  // O relÃ³gio de ouro pesa 0.1 kg/un no jogo (ex.: 5 un = 0.5 kg), mas alguns
  // screenshots antigos/catÃ¡logo apontam 0.2 kg/un. Aceitamos ambos para o
  // peso nÃ£o "vazar" para outro item com o mesmo peso (ex.: corrente de ouro).
  "relogio ouro": [0.1, 0.2],
};

// Alguns itens pesam >2 kg/un (ex.: mesa quÃ­mica = 5 kg). A correÃ§Ã£o de
// "ponto decimal perdido" no OCR (ex.: "2 (10.0)" lido como "2 (1.0)") sÃ³ Ã©
// aplicada quando o resultado bate com um peso conhecido do catÃ¡logo.
let knownUnitWeightsCache: Set<number> | null = null;
function getKnownUnitWeights(): Set<number> {
  if (!knownUnitWeightsCache) {
    const s = new Set<number>();
    for (const item of ITEM_CATALOG) if (item.unitKg > 0) s.add(item.unitKg);
    for (const alts of Object.values(ALT_WEIGHTS)) for (const alt of alts) if (alt > 0) s.add(alt);
    knownUnitWeightsCache = s;
  }
  return knownUnitWeightsCache;
}
function unitWeightMatchesKnown(w: number): boolean {
  const known = getKnownUnitWeights();
  for (const kw of known) {
    if (Math.abs(w - kw) <= Math.max(0.03, kw * 0.15)) return true;
  }
  return false;
}

function weightMatches(itemName: string, qty: number, totalKg: number | null): boolean {
  if (totalKg == null || qty <= 0) return false;
  const unitW = getUnitWeight(itemName);
  if (unitW == null || unitW <= 0) return false;
  const computed = totalKg / qty;
  const tolerance = Math.max(0.03, unitW * 0.15);
  if (Math.abs(computed - unitW) <= tolerance) return true;
  const alts = ALT_WEIGHTS[itemName];
  if (alts) {
    for (const alt of alts) {
      if (Math.abs(computed - alt) <= Math.max(0.03, alt * 0.15)) return true;
    }
  }
  return false;
}

function weightMatchesLoose(itemName: string, qty: number, totalKg: number | null): boolean {
  if (totalKg == null || qty <= 0) return false;
  const unitW = getUnitWeight(itemName);
  if (unitW == null || unitW <= 0) return false;
  const computed = totalKg / qty;
  const tolerance = Math.max(0.05, unitW * 0.3);
  if (Math.abs(computed - unitW) <= tolerance) return true;
  const alts = ALT_WEIGHTS[itemName];
  if (alts) {
    for (const alt of alts) {
      if (Math.abs(computed - alt) <= Math.max(0.05, alt * 0.3)) return true;
    }
  }
  return false;
}

// Peso unitÃ¡rio de referÃªncia mais prÃ³ximo do OCR (primÃ¡rio ou alternativo).
// Ex.: Micro SMG pesa 10 kg e Machine Pistol 5 kg â€” um mix (5+10) dÃ¡ 7.5,
// todos pesos vÃ¡lidos de "arma medio calibre".
function bestUnitWeight(itemName: string, qty: number, totalKg: number | null): number | null {
  if (totalKg == null || qty <= 0) return null;
  const computed = totalKg / qty;
  const cands = [...(ALT_WEIGHTS[itemName] || [])];
  const unitW = getUnitWeight(itemName);
  if (unitW != null && unitW > 0) cands.unshift(unitW);
  let best: number | null = null;
  let bestDiff = Infinity;
  for (const w of cands) {
    if (w <= 0) continue;
    const diff = Math.abs(computed - w);
    if (diff <= Math.max(0.03, w * 0.15) && diff < bestDiff) {
      bestDiff = diff;
      best = w;
    }
  }
  return best;
}

function matchItemName(text: string): string {
  // A sÃ­ntese do jogo usa acentos ("Sumo AnanÃ¡s") que os padrÃµes do ITEM_MAP
  // nÃ£o tÃªm â€” normaliza (remove diacrÃ­ticos) antes de casar.
  const normalized = text.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let best: { name: string; len: number } | null = null;
  for (const [pattern, name] of ITEM_MAP) {
    const m = pattern.exec(normalized);
    if (m && m[0].length > (best ? best.len : -1)) {
      best = { name, len: m[0].length };
    }
  }
  return best ? best.name : normalized.toLowerCase();
}

// Remove acentos preservando o comprimento (1:1): NFD adiciona combining marks
// que mudariam os Ã­ndices; este replace troca cada carÃ¡cter acentuado pelo seu
// carÃ¡cter base sem alterar a posiÃ§Ã£o no texto.
function deaccent(text: string): string {
  return text.replace(/[\u00C0-\u024F\u1E00-\u1EFF]/g, (ch) => ch.normalize("NFD").charAt(0));
}

// â”€â”€ Split a line into cells â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function splitCells(line: string): string[] {
  if (line.includes("\t")) {
    return line.split("\t").map((c) => c.trim()).filter(Boolean);
  }
  const bySpaces = line.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
  if (bySpaces.length >= 2) return bySpaces;

  const numPattern = /\d[\d.,]*\s*\(\s*[^)]+\s*\)/g;
  const numMatches = line.match(numPattern);
  if (numMatches && numMatches.length >= 2) {
    return numMatches;
  }
  // A single "qty (weight)" cell on its own line (ex.: "102 (20.4)") must stay
  // as one cell instead of splitting into "102" + "(20.4)".
  if (numMatches && numMatches.length === 1 && numMatches[0] === line.trim()) {
    return numMatches;
  }

  const words = line.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return words;

  const allText = words.every((w) => !/^\d+\.?\d*$/.test(w));
  if (allText) {
    const result: string[] = [];
    let i = 0;
    while (i < words.length) {
      const compoundRules = [
        /^(ANEL|CORRENTE|COLETE|MESA|SACO|LOCKPICK|SUMO|CARREGADOR|DIAMANTE|KIT|MICRO|ASSAULT|MACHINE|BULLPUP|DOUBLE|COMPACT|ADVANCED|TACTICAL|MILITARY|SNS|VINTAGE|AP|COMBAT|FOLHA|CABE[CÃ‡]O|SEMENTE|[OÃ“]LEO|PACOTE|BLUEPRINT|TACO|CHAVE|GARRAFA|PEDACO|CART[AÃƒ]O|ARMA|TV|BA[UÃš]|DI[AÃ]RIO|CRYPTO|[AÃ]GUIA|TUBAR[AÃƒ]O|REVOLVER|RIFLE|PETROL|TUNA|LICEN[CÃ‡]A|CANA|PACK|COPO|RELOGIO)$/i,
      ];
      let merged = false;
      for (const rule of compoundRules) {
        if (rule.test(words[i]) && i + 1 < words.length) {
          // Try LONGEST match first (3-word), then 2-word.
          // But ONLY accept a match if the pattern actually consumes most of the
          // candidate string (i.e., the matched portion covers all key words).
          // This prevents "/anel/i" from matching "ANEL DE" as a valid 2-word compound.
          const twoWord = words[i] + " " + words[i + 1];

          // Try 3-word first
          let did3 = false;
          if (i + 2 < words.length) {
            const threeWord = twoWord + " " + words[i + 2];
            // Check if a pattern matches the 3-word string AND the match covers
            // significantly more than just the first word (prevents prefix-only matches)
            const threeMatch = ITEM_MAP.some(([p]) => {
              const m = threeWord.match(p);
              if (!m) return false;
              // The match must include content from the 3rd word
              // (i.e., matched text length > 2-word length)
              return m[0].length > twoWord.length;
            });
            if (threeMatch) {
              result.push(threeWord);
              i += 3;
              merged = true;
              did3 = true;
              break;
            }
          }

          if (!did3) {
            // Try 2-word: the match must cover more than just the first word
            const twoMatch = ITEM_MAP.some(([p]) => {
              const m = twoWord.match(p);
              if (!m) return false;
              // The match must extend beyond the first word
              return m[0].length > words[i].length;
            });
            if (twoMatch) {
              result.push(twoWord);
              i += 2;
              merged = true;
              break;
            }
          }
        }
      }
      if (!merged) {
        result.push(words[i]);
        i++;
      }
    }
    return result;
  }

  return words;
}

// A numeric cell is a qty/weight pair like "28 (2.B)" or "1 (0.7)" or "24".
// OCR can misread digits inside parentheses as letters (Bâ†’8, Oâ†’0, Sâ†’5, etc.)
// so we must allow letters INSIDE the parenthesised weight portion.
const isNumericCell = (c: string): boolean => {
  if (!/^\d/.test(c)) return false;
  // OCR pode deixar um ponto final a seguir Ã  cÃ©lula (ex.: "3 (4.5).") â€”
  // isso nÃ£o a torna texto.
  const s = c.trim().replace(/\.$/, "");
  // If the cell matches the qty(weight) pattern, it's numeric even with OCR letter misreads
  if (/^\d[\d.,]*\s*\(\s*[^)]+\s*\)$/.test(s)) return true;
  // Plain number without parentheses
  if (/^\d[\d.,]*$/.test(s)) return true;
  // Otherwise, if it contains actual letters outside parens, it's text
  return false;
};
const isTextCell = (c: string) => c.trim() !== "" && !isNumericCell(c);

// Uma linha Ã© uma "fila numÃ©rica real" se tiver pelo menos 2 cÃ©lulas com peso
// (ex.: "26 (5.2)"). NÃºmeros puros sem peso sÃ£o ruÃ­do OCR (ex.: "64", "80",
// "SANTOS" noutras colunas) e nÃ£o devem bloquear o alinhamento do CORE.
const isRealNumericLine = (pl: { numCells: { totalKg: number | null }[] }): boolean =>
  pl.numCells.filter((nc) => nc.totalKg != null).length >= 2;

// â”€â”€ Merge compound names within a flat list of text cells â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function mergeCompoundNamesInList(cells: string[]): string[] {
  const step1: string[] = [];
  let i = 0;
  while (i < cells.length) {
    if (i + 1 < cells.length) {
      const mergedStr = cells[i] + " " + cells[i + 1];
      // Um "10K"/"14K" isolado Ã© um sufixo de quilates (ex.: "CORRENTE DE OURO
      // 10K") e nunca o inÃ­cio de um composto. Sem este guard, o padrÃ£o
      // /10k\s*corrente/ do ITEM_MAP fundia "10K"+"CORRENTE DE OURO" em
      // "10K CORRENTE DE OURO" (ordem errada) e o matchItemName devolvia
      // "corrente" em vez de "corrente 10k" â€” o bloco de grelha trocava os
      // itens de 0.1 kg (anel/relÃ³gio/corrente) e a 10K perdia o "101 (15.2)".
      const isRatingSuffix = /^\d{1,2}k$/i.test(cells[i]);
      // Only merge if the pattern match actually spans BOTH cells.
      // A substring match of just one cell (e.g. /micro\s*smg/ matching
      // "MICRO SMG" inside "TELEMOVEL MICRO SMG") should NOT trigger merging.
      // The match must cover characters from BOTH the first AND second cell.
      const isCompound = !isRatingSuffix && (
        ITEM_MAP.some(([p]) => {
          const m = mergedStr.match(p);
          if (!m) return false;
          // The match must start within the first cell and extend into the second
          const matchStart = m.index ?? 0;
          const matchEnd = matchStart + m[0].length;
          const firstCellEnd = cells[i].length;
          // Match must span the boundary between the two cells
          return matchStart < firstCellEnd && matchEnd > firstCellEnd;
        }) || /^CARREGADOR\s+DE$/i.test(mergedStr)
      );
      if (isCompound) {
        step1.push(mergedStr);
        i += 2;
        continue;
      }
    }
    step1.push(cells[i]);
    i++;
  }

  const result = [...step1];
  const nonAdjacentRules = [
    { first: /^colete$/i, second: /^fortalecido$/i, merged: "COLETE FORTALECIDO" },
    { first: /^cristal$/i, second: /^processado$/i, merged: "CRISTAL PROCESSADO" },
    { first: /^corrente$/i, second: /^(10|14|18|22)k$/i, merged: "CORRENTE DE OURO $1K" },
    { first: /^diamante$/i, second: /^bruto$/i, merged: "DIAMANTE BRUTO" },
    { first: /^anel$/i, second: /^diamante$/i, merged: "ANEL DE DIAMANTE" },
    { first: /^kit$/i, second: /^repara[cÃ§][aÃ£]?[o]?[d]?$/i, merged: "KIT REPARACAO" },
    { first: /^carregador\s+de$/i, second: /^(pistola|smg|rifle|shotgun)$/i, merged: "CARREGADOR DE $1" },
    { first: /^cart[aÃ£]o\s+de$/i, second: /^cidad[aÃ£]o$/i, merged: "CARTAO DE CIDADAO" },
    { first: /^carta\s+de$/i, second: /^condu[cÃ§][aÃ£]o$/i, merged: "CARTA DE CONDUCAO" },
    { first: /^lockpick$/i, second: /^avan[cÃ§]ad/i, merged: "LOCKPICK AVANCADA" },
  ];

  for (const rule of nonAdjacentRules) {
    const mergedEsc = rule.merged.replace(/\$1/g, "\\w+");
    if (result.some((c) => new RegExp(mergedEsc, "i").test(c))) continue;
    const firstIdx = result.findIndex((c) => rule.first.test(c));
    const secondIdx = result.findIndex((c) => rule.second.test(c));
    if (firstIdx >= 0 && secondIdx >= 0 && firstIdx !== secondIdx) {
      let mergedName = rule.merged;
      const m2 = result[secondIdx].match(rule.second);
      if (m2 && m2[1]) {
        mergedName = mergedName.replace("$1", m2[1].toUpperCase());
      }
      const keepIdx = Math.min(firstIdx, secondIdx);
      const removeIdx = Math.max(firstIdx, secondIdx);
      result[keepIdx] = mergedName;
      result.splice(removeIdx, 1);
    }
  }

  // "CARREGADOR DE" pode aparecer dividido em N cÃ©lulas quando hÃ¡ N
  // carregadores lado a lado (ex.: "CARREGADOR DE | CARREGADOR DE" + colunas
  // "SMG | PISTOLA"). A regra genÃ©rica acima sÃ³ junta UM par; aqui emparelhamos
  // cada fragmento "CARREGADOR DE" com a cÃ©lula do tipo seguinte, na ordem.
  {
    const weaponType = /^(pistola|smg|rifle|shotgun)$/i;
    const carregadorFrag = /^CARREGADOR\s+DE$/i;
    const carregadorIdxs: number[] = [];
    const weaponIdxs: number[] = [];
    result.forEach((c, i) => {
      if (carregadorFrag.test(c)) carregadorIdxs.push(i);
      else if (weaponType.test(c)) weaponIdxs.push(i);
    });
    const pairs = Math.min(carregadorIdxs.length, weaponIdxs.length);
    for (let k = 0; k < pairs; k++) {
      result[weaponIdxs[k]] = "CARREGADOR DE " + result[weaponIdxs[k]].toUpperCase();
    }
    for (let k = pairs - 1; k >= 0; k--) {
      result.splice(carregadorIdxs[k], 1);
    }
  }
  return result;
}

// â”€â”€ Weapon-detail popup parser â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const WEAPON_RULES: {
  pattern: RegExp;
  item: WeaponCapture["weaponItem"];
  ammo: WeaponCapture["ammoItem"];
}[] = [
  { pattern: /revolver\s*mk\s*2/i, item: "arma baixo calibre", ammo: "balas baixo" },
  { pattern: /bullpup\s*rifle\s*mk\s*2/i, item: "arma alto calibre", ammo: "balas alto" },
  { pattern: /bullpup\s*mk\s*2/i, item: "arma alto calibre", ammo: "balas alto" },
  { pattern: /machine\s*pistol/i, item: "arma medio calibre", ammo: "balas medio" },
  { pattern: /hk\s*2|hk2/i, item: "arma medio calibre", ammo: "balas medio" },
  { pattern: /micro\s*smg/i, item: "arma medio calibre", ammo: "balas medio" },
  { pattern: /assault\s*smg/i, item: "arma medio calibre", ammo: "balas medio" },
  { pattern: /tactical\s*(carbine|rifle)/i, item: "arma alto calibre", ammo: "balas alto" },
  { pattern: /double\s*barrel/i, item: "arma alto calibre", ammo: "balas alto" },
  { pattern: /gusenberg/i, item: "arma alto calibre", ammo: "balas alto" },
  { pattern: /compact\s*rifle/i, item: "arma alto calibre", ammo: "balas alto" },
  { pattern: /assault\s*rifle\s*mk\s*2/i, item: "arma alto calibre", ammo: "balas alto" },
  { pattern: /sns\s*pistol/i, item: "arma baixo calibre", ammo: "balas baixo" },
  { pattern: /vintage\s*pistol/i, item: "arma baixo calibre", ammo: "balas baixo" },
  { pattern: /pistol\s*\.\s*50/i, item: "arma baixo calibre", ammo: "balas baixo" },
];

// Linhas de identificaÃ§Ã£o do popup de arma (nÂº de sÃ©rie, muniÃ§Ã£o, balas,
// acessÃ³rios). SÃ£o apenas texto de identificaÃ§Ã£o â€” nÃ£o sÃ£o itens do inventÃ¡rio.
const WEAPON_POPUP_FIELD_RE =
  /^(?:n[uÃº]mero\s+de\s+s[eÃ©]rie|muni[cÃ§][aÃ£]o|\bbalas?|acess[oÃ³]rios?)\s*:/i;

function parseWeaponCapture(text: string): WeaponCapture | null {
  const flat = text.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();

  const isWeaponPopup =
    /n[uÃº]mero\s+de\s+s[eÃ©]rie\s*:/i.test(flat) ||
    /muni[cÃ§][aÃ£]o\s*:/i.test(flat) ||
    /acess[oÃ³]rios?\s*:/i.test(flat);
  if (!isWeaponPopup) return null;

  const rule = WEAPON_RULES.find((r) => r.pattern.test(flat));
  if (!rule) return null;

  const ammoMatch =
    flat.match(/muni[cÃ§][aÃ£]o\s*:\s*(\d{1,6})/i) ||
    flat.match(/\bbalas?\s*:\s*(\d{1,6})/i);
  const ammo = ammoMatch ? parseInt(ammoMatch[1], 10) : 0;

  let accessoryCount = 0;
  // Primeiro tenta sempre ler a lista explÃ­cita depois de "AcessÃ³rios:".
  // O regex anterior exigia whitespace antes do fim da string, falhava quando
  // a lista acabava diretamente no Ãºltimo acessÃ³rio e caÃ­a no fallback.
  // Nesse fallback, "Precision Muzzle" tambÃ©m fazia match em "Muzzle",
  // contando o mesmo acessÃ³rio duas vezes.
  const accessoriesMatch = flat.match(
    /acess[oÃ³]rios?\s*:\s*(.+?)(?=\s+(?:peso|durabilidade|condi[cÃ§][aÃ£]o|valor)\b|$)/i
  );
  if (accessoriesMatch) {
    accessoryCount = accessoriesMatch[1]
      .split(/\s*,\s*/)
      .map((item) => item.trim())
      .filter(Boolean)
      .length;
  } else if (/acess[oÃ³]rios?\s*:/i.test(flat)) {
    const knownAccessoryPatterns = [
      /extended\s*clip/i, /precision\s*muzzle/i, /scope/i, /\bgrip\b/i,
      /flashlight/i, /heavy\s*barrel/i, /suppressor/i, /magazine/i,
    ];
    accessoryCount = knownAccessoryPatterns.filter((p) => p.test(flat)).length;
    // "Muzzle" genÃ©rico nÃ£o Ã© contado separadamente quando jÃ¡ existe
    // "Precision Muzzle". Cada acessÃ³rio fÃ­sico vale apenas 1.
  }

  return {
    weapon: rule.pattern.source.replace(/\\s\*/g, " "),
    weaponItem: rule.item,
    ammo,
    ammoItem: rule.ammo,
    accessoryCount,
  };
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MAIN PARSER
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export function parseInventoryOCR(rawText: string): ParseResult {
  const correctedText = fixOcrTypos(rawText);
  const weaponCapture = parseWeaponCapture(rawText);
  const merged = new Map<string, number>();
  const weightTotals = new Map<string, number>();
  // CÃ©lulas numÃ©ricas jÃ¡ atribuÃ­das a um item (linha:Ã­ndice da cÃ©lula). Usada
  // por TODOS os passes como fonte Ãºnica de verdade para "quem jÃ¡ foi
  // consumido": dois pares idÃªnticos no OCR (ex.: dois "2(1.0)") sÃ£o cÃ©lulas
  // distintas, por isso consumir um nÃ£o bloqueia o outro (ex.: computador
  // consome um "2(1.0)" e o tigre fica com o segundo; relÃ³gio com "2(0.4)"
  // e o medwchi mochi com o outro).
  const consumedCells = new Set<string>();
  if (weaponCapture) {
    if (weaponCapture.ammo > 0) {
      merged.set(weaponCapture.ammoItem, (merged.get(weaponCapture.ammoItem) || 0) + weaponCapture.ammo);
    }
    if (weaponCapture.accessoryCount > 0) {
      merged.set("acessorios para armas", (merged.get("acessorios para armas") || 0) + weaponCapture.accessoryCount);
    }
  }

  const lines = correctedText
    .split(/\r?\n/)
    .map((l) => l.trim())
    // Remove acentos preservando o comprimento (1:1): os padrÃµes do ITEM_MAP
    // e a mesclagem de compostos (splitCells, mergeCompoundNamesInList) sÃ£o
    // sem acentos, e o OCR traz "MESA QUÃMICA", "Sumo AnanÃ¡s", etc. Sem isto,
    // "MESA QUÃMICA" fica dividido em "MESA"+"QUÃMICA" e o bloco Ã© perdido.
    .map(deaccent)
    .filter(Boolean)
    .filter((l) => !NOISE_LINE_RE.test(l))
    // Linhas de 1 letra (ex.: "G" que o OCR lÃª de separadores/guias da grelha
    // do bag) nunca sÃ£o nomes de itens â€” o catÃ¡logo nÃ£o tem nomes de 1 letra.
    // Se entrarem num nameRun, quebram o alinhamento por blocos do PASS 3.5
    // (ex.: o bag da Fleeca com "G" entre as quantidades e os nomes fazia o
    // LOCKPICK + AVANÃ‡ADA sumirem e o telemÃ³vel roubar o "1 (0.5)").
    .filter((l) => !/^[a-z]{1}$/i.test(l))
    .filter((l) => {
      // Quando o OCR Ã© o popup de identificaÃ§Ã£o de uma arma ("NÃºmero de SÃ©rie:",
      // "MuniÃ§Ã£o:", "AcessÃ³rios:"), a arma e esses campos sÃ£o apenas texto de
      // identificaÃ§Ã£o â€” nÃ£o sÃ£o itens do inventÃ¡rio com peso. Exclui essas
      // linhas para nÃ£o aparecer um "1 arma medio calibre" falso nem um
      // "1 balas baixo" falso derivados da muniÃ§Ã£o (ex.: "MuniÃ§Ã£o: 0").
      if (!weaponCapture) return true;
      if (WEAPON_POPUP_FIELD_RE.test(l)) return false;
      if (WEAPON_RULES.some((r) => r.pattern.test(l))) return false;
      return true;
    });

  // "CARREGADOR DE" e o tipo (SMG/PISTOLA/RIFLE/SHOTGUN) podem ser lidos pelo
  // OCR em linhas separadas (grelha lida cÃ©lula a cÃ©lula). Cada fragmento
  // "CARREGADOR DE" Ã© fundido com o primeiro tipo livre numa linha seguinte,
  // na ordem â€” como o mergeCompoundNamesInList, mas entre linhas distintas.
  {
    const carregadorFrag = /^CARREGADOR\s+DE$/i;
    const weaponType = /^(pistola|smg|rifle|shotgun)$/i;
    let n = 0;
    while (n < lines.length) {
      if (carregadorFrag.test(lines[n])) {
        const typeIdx = lines.findIndex((l, j) => j > n && weaponType.test(l));
        if (typeIdx >= 0) {
          lines[n] = "CARREGADOR DE " + lines[typeIdx].toUpperCase();
          lines.splice(typeIdx, 1);
        }
      }
      n++;
    }
  }

  interface ParsedLine {
    lineIdx: number;
    cells: string[];
    numCells: { qty: number; totalKg: number | null; cellIdx: number; raw: string; altWeights: number[] }[];
    textCells: { text: string; cellIdx: number }[];
  }

  const parsedLines: ParsedLine[] = lines.map((line, lineIdx) => {
    const cells = splitCells(line);
    // Filter out noise cells first
    const filteredCells = cells.filter((c) => !isNoiseCell(c));
    const numCells = filteredCells
      .map((c, cellIdx) => ({ ...parseQtyWeight(c), cellIdx, raw: c }))
      .filter((x) => isNumericCell(x.raw));
    const textCells = filteredCells
      .map((c, cellIdx) => ({ text: c, cellIdx }))
      .filter((x) => isTextCell(x.text));
    return { lineIdx, cells: filteredCells, numCells, textCells };
  });
  if (process.env.OCR_DEBUG) {
    console.error("LINES:", JSON.stringify(lines));
    console.error("PARSED:", parsedLines.map((pl, i) => `[${i}] num=${pl.numCells.map((c) => `${c.qty}(${c.totalKg})`).join(",")} txt=${pl.textCells.map((c) => c.text).join("|")}`).join("\n"));
  }

  const usedLines = new Set<number>();

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // WEAPON GRID DETECTOR
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  {
    const flatText = lines.join(" ").replace(/\s+/g, " ");

    const WEAPON_NAMES: { pattern: RegExp; calibre: "baixo" | "medio" | "alto" }[] = [
      { pattern: /\bSNS\s+PISTOL\s+MK\s*2\b/gi, calibre: "baixo" },
      { pattern: /\bSNS\s+PISTOL\b/gi, calibre: "baixo" },
      { pattern: /\bVINTAGE\s+PISTOL\b/gi, calibre: "baixo" },
      { pattern: /\bPISTOL\s*\.?\s*50\b/gi, calibre: "baixo" },
      { pattern: /\bREVOLVER\s+MK\s*2\b/gi, calibre: "baixo" },
      { pattern: /\bAP\s+PISTOL\b/gi, calibre: "baixo" },
      { pattern: /\bMACHINE\s+PISTOL\b/gi, calibre: "medio" },
      { pattern: /\bHK\s*2\b/gi, calibre: "medio" },
      { pattern: /\bMICRO\s+SMG\b/gi, calibre: "medio" },
      { pattern: /\bCOMBAT\s+PDW\b/gi, calibre: "medio" },
      { pattern: /\bASSAULT\s+SMG\b/gi, calibre: "medio" },
      { pattern: /\bBULLPUP\s+RIFLE\b/gi, calibre: "alto" },
      { pattern: /\bGUSENBERG\b/gi, calibre: "alto" },
      { pattern: /\bDOUBLE\s+BARREL\b/gi, calibre: "alto" },
      { pattern: /\bCOMPACT\s+RIFLE\b/gi, calibre: "alto" },
      { pattern: /\bADVANCED\s+RIFLE\b/gi, calibre: "alto" },
      { pattern: /\bSPAS[\s-]*12\b/gi, calibre: "alto" },
      { pattern: /\bTACTICAL\s+(CARBINE|RIFLE)\b/gi, calibre: "alto" },
      { pattern: /\bMILITARY\s+RIFLE\b/gi, calibre: "alto" },
    ];

    const weaponWeightCells = parsedLines.reduce(
      (count, pl) =>
        count +
        pl.numCells.filter(
          (nc) =>
            nc.qty === 1 &&
            nc.totalKg != null &&
            (Math.abs(nc.totalKg - 5) < 1 || Math.abs(nc.totalKg - 15) < 2)
        ).length,
      0
    );

    let totalWeaponNames = 0;
    for (const wn of WEAPON_NAMES) {
      const m = flatText.match(wn.pattern);
      if (m) totalWeaponNames += m.length;
    }

    const isWeaponGrid = weaponWeightCells >= 3 && totalWeaponNames >= 3;

    if (isWeaponGrid) {
      let baixo = 0;
      let medio = 0;
      let alto = 0;

      const snsHk2Pattern = /\bSNS\s+PISTOL\s+HK\s*2\b/gi;
      const snsHk2Matches = flatText.match(snsHk2Pattern);
      const snsHk2Count = snsHk2Matches ? snsHk2Matches.length : 0;
      if (snsHk2Count > 0) {
        baixo += snsHk2Count;
        medio += snsHk2Count;
      }

      let cleanText = flatText.replace(snsHk2Pattern, "___COUNTED___");

      const snsMk2Pattern = /\bSNS\s+PISTOL\s+MK\s*2\b/gi;
      const snsMk2Matches = cleanText.match(snsMk2Pattern);
      const snsMk2Count = snsMk2Matches ? snsMk2Matches.length : 0;
      baixo += snsMk2Count;
      cleanText = cleanText.replace(snsMk2Pattern, "___COUNTED___");

      const countRules: { pattern: RegExp; calibre: "baixo" | "medio" | "alto" }[] = [
        { pattern: /\bSNS\s+PISTOL\b/gi, calibre: "baixo" },
        { pattern: /\bVINTAGE\s+PISTOL\b/gi, calibre: "baixo" },
        { pattern: /\bPISTOL\s*\.?\s*50\b/gi, calibre: "baixo" },
        { pattern: /\bREVOLVER\s+MK\s*2\b/gi, calibre: "baixo" },
        { pattern: /\bAP\s+PISTOL\b/gi, calibre: "baixo" },
        { pattern: /\bMACHINE\s+PISTOL\b/gi, calibre: "medio" },
        { pattern: /\bHK\s*2\b/gi, calibre: "medio" },
        { pattern: /\bMICRO\s+SMG\b/gi, calibre: "medio" },
        { pattern: /\bCOMBAT\s+PDW\b/gi, calibre: "medio" },
        { pattern: /\bASSAULT\s+SMG\b/gi, calibre: "medio" },
        { pattern: /\bBULLPUP\s+RIFLE\b/gi, calibre: "alto" },
        { pattern: /\bBULLPUP\s+MK\s*2\b/gi, calibre: "alto" },
        { pattern: /\bGUSENBERG\b/gi, calibre: "alto" },
        { pattern: /\bDOUBLE\s+BARREL\b/gi, calibre: "alto" },
        { pattern: /\bCOMPACT\s+RIFLE\b/gi, calibre: "alto" },
        { pattern: /\bADVANCED\s+RIFLE\b/gi, calibre: "alto" },
        { pattern: /\bSPAS[\s-]*12\b/gi, calibre: "alto" },
        { pattern: /\bTACTICAL\s+(CARBINE|RIFLE)\b/gi, calibre: "alto" },
        { pattern: /\bMILITARY\s+RIFLE\b/gi, calibre: "alto" },
      ];

      for (const countRule of countRules) {
        const matches = cleanText.match(countRule.pattern);
        const count = matches ? matches.length : 0;
        if (count > 0) {
          if (countRule.calibre === "baixo") baixo += count;
          else if (countRule.calibre === "medio") medio += count;
          else alto += count;
          cleanText = cleanText.replace(countRule.pattern, "___COUNTED___");
        }
      }

      if (baixo > 0) {
        merged.set("arma baixo calibre", baixo);
        weightTotals.set("arma baixo calibre", baixo * 5);
      }
      if (medio > 0) {
        merged.set("arma medio calibre", medio);
        weightTotals.set("arma medio calibre", medio * 5);
      }
      if (alto > 0) {
        merged.set("arma alto calibre", alto);
        weightTotals.set("arma alto calibre", alto * 15);
      }

      for (let li = 0; li < parsedLines.length; li++) usedLines.add(li);
    }
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PASS SUMMARY: Lista-sÃ­ntese do jogo ("NÃ— Item â€” X,kg")
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // O jogo mostra por baixo da grelha uma lista de cada item com a sua
  // quantidade e peso total ("44Ã— Sumo AnanÃ¡s â€” 8,8 kg"). O OCR lÃª-a de forma
  // muito mais fiÃ¡vel do que a grelha, onde ruÃ­do ("64", "80", "SANTOS",
  // "CRIANE") desalinha colunas e gera itens falsos (ex.: "cartao 64Ã—0.1"
  // em vez de "1Ã— CartÃ£o de CidadÃ£o â€” 0,0 kg"). Quando sÃ£o detetadas pelo
  // menos 2 linhas de sÃ­ntese, sÃ£o a fonte autoritativa e a grelha Ã© ignorada.
  const SUMMARY_RE = /(\d[\d.,]*)\s*[Ã—x]\s*(.+?)\s*[â€”â€“-]\s*([\d.,]+)\s*kg\s*$/i;
  const summaryItems: { name: string; qty: number; totalKg: number; lineIdx: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(SUMMARY_RE);
    if (!m) continue;
    const qty = Math.round(parseFloat(m[1].replace(".", "").replace(",", ".")) || 1);
    const totalKg = parseFloat(m[3].replace(".", "").replace(",", "."));
    if (!Number.isFinite(totalKg)) continue;
    const item = matchItemName(m[2]);
    if (ITEM_BY_NAME.get(item)) {
      summaryItems.push({ name: item, qty, totalKg, lineIdx: i });
    } else if (Number.isFinite(totalKg) && totalKg > 0) {
      // Nome cortado/ilegÃ­vel na sÃ­ntese (ex.: "2Ã— [item cortado na imagem] â€”
      // 1,4 kg"). O item fica irrecuperÃ¡vel por nome, mas o peso unitÃ¡rio pode
      // ser distintivo: se casa com EXATAMENTE UM item do catÃ¡logo, Ã© seguro
      // atribuir (ex.: 1.4 kg / 2 = 0.7 kg sÃ³ existe no telemÃ³vel).
      const unit = totalKg / qty;
      const uniques = ITEM_CATALOG.filter((def) => {
        if (def.unitKg <= 0) return false;
        return Math.abs(unit - def.unitKg) <= Math.max(0.03, def.unitKg * 0.15);
      });
      if (uniques.length === 1) {
        summaryItems.push({ name: uniques[0].name, qty, totalKg, lineIdx: i });
      } else {
        // Peso unitÃ¡rio partilhado (ex.: 2.0 kg = Ã¡guia de bronze/kit reparaÃ§Ã£o;
        // 0.2 kg = muitos itens) com nome cortado: nÃ£o hÃ¡ item certo, mas o peso
        // Ã© real. MantÃ©m-se como "item nÃ£o identificado" para o total nÃ£o perder
        // o peso â€” senÃ£o o total da app ficava sempre abaixo do Peso do jogo.
        // Itens de 0 kg (ex.: "1Ã— [cortado] â€” 0,0 kg") sÃ£o descartados: sem peso
        // nÃ£o afetam o total e eram atribuÃ­dos a "dinheiro" por engano.
        summaryItems.push({
          name: `item nao identificado (${Math.round(unit * 100) / 100} kg/un)`,
          qty,
          totalKg,
          lineIdx: i,
        });
      }
    }
  }

  const useSummaryOnly = summaryItems.length >= 2;
  if (useSummaryOnly) {
    for (const s of summaryItems) {
      merged.set(s.name, (merged.get(s.name) || 0) + s.qty);
      weightTotals.set(s.name, (weightTotals.get(s.name) || 0) + s.totalKg);
      usedLines.add(s.lineIdx);
    }
    // Marca todas as linhas como usadas para a grelha nÃ£o ser processada.
    for (let i = 0; i < parsedLines.length; i++) usedLines.add(i);
  }

  // If weapon grid took all lines, skip standard parsing
  if (usedLines.size < parsedLines.length) {
    // â”€â”€ PASS 0: Standalone item names without numeric cells â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Only process text-only lines that are NOT adjacent to a numeric line.
    // If a text line is next to a numeric line, the Core Strategy will pair them.
    const allNumCells = parsedLines.flatMap((pl) => pl.numCells);
    for (let i = 0; i < parsedLines.length; i++) {
      if (usedLines.has(i)) continue;
      const line = parsedLines[i];
      if (line.numCells.length > 0) continue;
      if (line.textCells.length === 0) continue;
      // Check if any adjacent line (within 2 lines) has >= 2 numeric cells.
      // If so, this text line will be collected by the Core Strategy â€” skip it here.
      let adjacentToNumeric = false;
      for (let d = 1; d <= 2; d++) {
        const above = i - d;
        const below = i + d;
        if (above >= 0 && isRealNumericLine(parsedLines[above])) {
          adjacentToNumeric = true;
          break;
        }
        if (below < parsedLines.length && isRealNumericLine(parsedLines[below])) {
          adjacentToNumeric = true;
          break;
        }
      }
      if (adjacentToNumeric) continue;
      for (const tc of line.textCells) {
        const item = matchItemName(tc.text);
        const qty = 1;
        const existing = merged.get(item) || 0;
        if (existing >= qty) continue;
        const unitW = getUnitWeight(item);
        if (unitW != null && unitW > 0) {
          // Se existe uma cÃ©lula numÃ©rica noutro local cujo peso bate com este
          // item, a quantidade real vem dessa cÃ©lula (Core Strategy / PASS 3) â€”
          // nÃ£o adivinhar qty=1 aqui (ex.: "ESTIMULANTE" solto + "102 (20.4)").
          const hasMatchingCell = allNumCells.some(
            (nc) => nc.totalKg != null && nc.qty > 0 && weightMatchesLoose(item, nc.qty, nc.totalKg)
          );
          if (hasMatchingCell) continue;
          const totalKg = qty * unitW;
          merged.set(item, qty);
          weightTotals.set(item, totalKg);
        }
      }
    }

    // â”€â”€ PASS 1V: Vertical list format (qty/weight lines followed by name lines) â”€â”€
    // OCR sometimes outputs each cell on its own line:
    //   1 (0.5)
    //   1 (1.0)
    //   LOCKPICK
    //   AVANÃ‡ADA
    // This pass detects consecutive single-cell numeric lines followed by
    // consecutive text lines, merges compound names across lines, and pairs them in order.
    {
      const knownItem = (name: string): boolean => !!ITEM_BY_NAME.get(name);

      // Infer item from weight alone (for cells without a corresponding name, e.g., 5(25))
      const inferItemFromWeight = (qty: number, totalKg: number): string | null => {
        const unitKg = totalKg / qty;
        if (unitKg <= 0) return null;
        
        // Collect all matching items
        const matches: string[] = [];
        for (const def of ITEM_CATALOG) {
          if (def.unitKg > 0 && Math.abs(def.unitKg - unitKg) <= Math.max(0.03, def.unitKg * 0.15)) {
            matches.push(def.name);
          }
        }
        
        if (matches.length === 0) return null;
        if (matches.length === 1) return matches[0];
        
        // Multiple items with same weight (e.g., arma baixo/medio calibre both 5kg)
        // Prefer "arma medio calibre" over "arma baixo calibre" when no weapon name in text
        if (matches.includes("arma medio calibre") && matches.includes("arma baixo calibre")) {
          // Check if any weapon name appears in the full OCR text
          const hasWeaponName = /\b(SNS|VINTAGE|AP\s+PISTOL|REVOLVER|MICRO\s+SMG|MACHINE\s+PISTOL|HK\s*2|COMBAT\s+PDW|ASSAULT\s+SMG|BULLPUP|GUSENBERG|DOUBLE\s+BARREL|COMPACT\s+RIFLE|ADVANCED\s+RIFLE|SPAS|TACTICAL|MILITARY)\b/i.test(correctedText);
          if (!hasWeaponName) {
            return "arma medio calibre"; // default to medio when ambiguous
          }
        }
        
        return matches[0];
      };

      let vi = 0;
      while (vi < parsedLines.length) {
        if (usedLines.has(vi)) { vi++; continue; }
        const pl = parsedLines[vi];
        // Skip empty lines
        if (pl.numCells.length === 0 && pl.textCells.length === 0) { vi++; continue; }
        // Start of a vertical numeric run: lines with exactly 1 numeric cell (with weight) and no text
        if (!(pl.numCells.length === 1 && pl.textCells.length === 0 && pl.numCells[0].totalKg != null)) {
          vi++; continue;
        }

        // Collect consecutive numeric lines (single cell, with OR without weight)
        // Include qty-only cells (e.g., "56" for Ãgua) since they may pair with names
        // Skip empty lines
        const numRun: { lineIdx: number; qty: number; totalKg: number | null; cellIdx: number; altWeights: number[]; raw: string }[] = [];
        let p = vi;
        while (p < parsedLines.length && !usedLines.has(p)) {
          const pl2 = parsedLines[p];
          // Skip empty lines
          if (pl2.numCells.length === 0 && pl2.textCells.length === 0) { p++; continue; }
          if (pl2.numCells.length === 1 && pl2.textCells.length === 0) {
            const nc = pl2.numCells[0];
            numRun.push({ lineIdx: p, qty: nc.qty, totalKg: nc.totalKg, cellIdx: nc.cellIdx, altWeights: nc.altWeights || [], raw: nc.raw });
            p++;
          } else break;
        }
        // Require at least 2 cells with weight to consider it a vertical block
        if (numRun.filter(n => n.totalKg != null).length < 2) { vi++; continue; }

        // Collect consecutive text lines after the numeric run
        // Skip noise lines that are just a number without weight (e.g., "1" between LOCKPICK and AVANÃ‡ADA)
        // Also skip empty lines
        const isNoiseLine = (pl: ParsedLine): boolean =>
          pl.textCells.length === 0 &&
          pl.numCells.length === 1 &&
          pl.numCells[0].totalKg == null &&
          /^\d+$/.test(pl.numCells[0].raw.trim());

        const textRun: { lineIdx: number; text: string }[] = [];
        while (p < parsedLines.length && !usedLines.has(p)) {
          const pl2 = parsedLines[p];
          // Skip empty lines
          if (pl2.numCells.length === 0 && pl2.textCells.length === 0) { p++; continue; }
          if (pl2.textCells.length > 0 && pl2.numCells.length === 0) {
            for (const tc of pl2.textCells) textRun.push({ lineIdx: p, text: tc.text });
            p++;
          } else if (isNoiseLine(pl2)) {
            // Skip noise line but continue collecting
            p++;
          } else break;
        }
        if (textRun.length < 2) { vi = p; continue; }

        // Merge compound names across adjacent text lines (e.g., LOCKPICK + AVANÃ‡ADA)
        const mergedNames = mergeCompoundNamesInList(textRun.map((n) => n.text))
          .filter((m) => !/^[a-z]{1}$/i.test(m));

        if (mergedNames.length < 2) { vi = p; continue; }

        // Require all merged names to be known items (avoid noise)
        if (!mergedNames.every((m) => knownItem(matchItemName(m)))) {
          if (process.env.OCR_DEBUG) console.error("[1V] block skipped (unknown name):", mergedNames.join(" | "));
          vi = p; continue;
        }

        // STRICT ORDER MATCHING: numeric[i] â†” name[i], validated by weight
        // Track which indices were matched
        const matchedNumIndices = new Set<number>();
        const matchedNameIndices = new Set<number>();
        const blockMatched: { item: string; qty: number; totalKg: number; lineIdx: number; cellIdx: number }[] = [];

        // Pass 1: positional match with weight validation + decimal correction
        for (let qi = 0; qi < numRun.length && qi < mergedNames.length; qi++) {
          const nc = numRun[qi];
          const name = mergedNames[qi];
          const item = matchItemName(name);

          if (nc.totalKg != null) {
            // Has weight: try strict validation, then decimal correction
            if (weightMatches(item, nc.qty, nc.totalKg)) {
              blockMatched.push({ item, qty: nc.qty, totalKg: nc.totalKg, lineIdx: nc.lineIdx, cellIdx: nc.cellIdx });
              matchedNumIndices.add(qi);
              matchedNameIndices.add(qi);
            } else {
              const corrected = tryDecimalCorrection(item, nc.qty, nc.totalKg, nc.altWeights);
              if (corrected != null) {
                blockMatched.push({ item, qty: nc.qty, totalKg: corrected, lineIdx: nc.lineIdx, cellIdx: nc.cellIdx });
                matchedNumIndices.add(qi);
                matchedNameIndices.add(qi);
                if (process.env.OCR_DEBUG) {
                  console.error(`[1V] decimal corrected: ${item} ${nc.raw} â†’ ${nc.qty}Ã—${(corrected/nc.qty).toFixed(2)}=${corrected}kg`);
                }
              } else if (process.env.OCR_DEBUG) {
                console.error(`[1V] weight mismatch: ${item} qty=${nc.qty} totalKg=${nc.totalKg} (expected unit ~${getUnitWeight(item)})`);
              }
            }
          } else {
            // Qty-only cell: infer totalKg from item's unit weight
            const unitW = getUnitWeight(item);
            if (unitW != null && unitW > 0) {
              const totalKg = Math.round(nc.qty * unitW * 100) / 100;
              blockMatched.push({ item, qty: nc.qty, totalKg, lineIdx: nc.lineIdx, cellIdx: nc.cellIdx });
              matchedNumIndices.add(qi);
              matchedNameIndices.add(qi);
              if (process.env.OCR_DEBUG) {
                console.error(`[1V] qty-only match: ${item} qty=${nc.qty} â†’ totalKg=${totalKg} (unit=${unitW})`);
              }
            }
          }
}

        // Pass 1.5: detect swapped quantities between variants of same base item
        // (e.g., "corrente" 0.1kg and "corrente 10k" 0.15kg with swapped qtys)
        // Must run BEFORE Pass 2 to prevent weight-only inference from stealing cells
        if (numRun.length === 2 && mergedNames.length === 2) {
          const item0 = matchItemName(mergedNames[0]);
          const item1 = matchItemName(mergedNames[1]);
          const base0 = item0.replace(/\s+(10|14|18|22)k$/, "");
          const base1 = item1.replace(/\s+(10|14|18|22)k$/, "");
          const nc0 = numRun[0];
          const nc1 = numRun[1];
          
          // Check if they're variants of the same base item (one has k suffix, one doesn't)
          const isVariantPair = base0 === base1 && 
            ((item0.endsWith("k") && !item1.endsWith("k")) || (!item0.endsWith("k") && item1.endsWith("k"))) &&
            nc0.totalKg != null && nc1.totalKg != null;
          
          if (isVariantPair) {
            const unit0 = getUnitWeight(item0);
            const unit1 = getUnitWeight(item1);
            if (unit0 && unit1 && unit0 !== unit1) {
              // Check if swapping makes both match
              const match0as1 = weightMatches(item0, nc1.qty, nc1.totalKg);
              const match1as0 = weightMatches(item1, nc0.qty, nc0.totalKg);
              const match0as0 = weightMatches(item0, nc0.qty, nc0.totalKg);
              const match1as1 = weightMatches(item1, nc1.qty, nc1.totalKg);
              
              if (!match0as0 && !match1as1 && match0as1 && match1as0) {
                // Swap matches perfectly
                // nc0.totalKg and nc1.totalKg are guaranteed non-null by isVariantPair check
                const totalKg0 = nc0.totalKg!;
                const totalKg1 = nc1.totalKg!;
                blockMatched.push(
                  { item: item0, qty: nc1.qty, totalKg: totalKg1, lineIdx: nc1.lineIdx, cellIdx: nc1.cellIdx },
                  { item: item1, qty: nc0.qty, totalKg: totalKg0, lineIdx: nc0.lineIdx, cellIdx: nc0.cellIdx }
                );
                matchedNumIndices.add(0);
                matchedNumIndices.add(1);
                matchedNameIndices.add(0);
                matchedNameIndices.add(1);
                if (process.env.OCR_DEBUG) {
                  console.error(`[1V] SWAP DETECTED: ${item0}↔${item1} (${nc0.raw}↔${nc1.raw})`);
                }
              }
            }
          }
        }

        // Pass 2: for unmatched numeric cells WITH weight, try weight-only inference
        for (let qi = 0; qi < numRun.length; qi++) {
          if (matchedNumIndices.has(qi)) continue;
          const nc = numRun[qi];
          if (nc.totalKg == null) continue; // qty-only without name match can't be inferred
          const inferred = inferItemFromWeight(nc.qty, nc.totalKg);
          if (inferred && weightMatches(inferred, nc.qty, nc.totalKg)) {
            blockMatched.push({ item: inferred, qty: nc.qty, totalKg: nc.totalKg, lineIdx: nc.lineIdx, cellIdx: nc.cellIdx });
            matchedNumIndices.add(qi);
          }
        }

        // Pass 3: for unmatched qty-only cells that have a corresponding name (by position)
        for (let qi = 0; qi < numRun.length && qi < mergedNames.length; qi++) {
          if (matchedNumIndices.has(qi)) continue;
          const nc = numRun[qi];
          if (nc.totalKg != null) continue; // already handled
          // Qty-only cell at position qi with a name at same position
          const name = mergedNames[qi];
          const item = matchItemName(name);
          const unitW = getUnitWeight(item);
          if (unitW != null && unitW > 0) {
            const totalKg = Math.round(nc.qty * unitW * 100) / 100;
            blockMatched.push({ item, qty: nc.qty, totalKg, lineIdx: nc.lineIdx, cellIdx: nc.cellIdx });
            matchedNumIndices.add(qi);
            if (process.env.OCR_DEBUG) {
              console.error(`[1V] qty-only match (pass 3): ${item} qty=${nc.qty} â†’ totalKg=${totalKg} (unit=${unitW})`);
            }
          }
        }

        // Pass 4: for remaining unmatched qty-only cells, try to match with any unmatched name
        // by unit weight compatibility (handles misalignment from extra numeric cells)
        const unmatchedNameIndices: number[] = [];
        for (let ni = 0; ni < mergedNames.length; ni++) {
          if (!matchedNameIndices.has(ni)) unmatchedNameIndices.push(ni);
        }

        for (let qi = 0; qi < numRun.length; qi++) {
          if (matchedNumIndices.has(qi)) continue;
          const nc = numRun[qi];
          if (nc.totalKg != null) continue; // only qty-only cells

          // Try each unmatched name, pick the one with matching unit weight
          let bestMatch: { ni: number; item: string; unitW: number } | null = null;
          for (const ni of unmatchedNameIndices) {
            const name = mergedNames[ni];
            const item = matchItemName(name);
            const unitW = getUnitWeight(item);
            if (unitW != null && unitW > 0) {
              // Check if this unit weight is plausible for the qty (no way to verify totalKg, but prefer unique weights)
              if (!bestMatch || unitW < bestMatch.unitW) {
                // Prefer more distinctive weights (less common)
                bestMatch = { ni, item, unitW };
              }
            }
          }

          if (bestMatch) {
            const totalKg = Math.round(nc.qty * bestMatch.unitW * 100) / 100;
            blockMatched.push({ item: bestMatch.item, qty: nc.qty, totalKg, lineIdx: nc.lineIdx, cellIdx: nc.cellIdx });
            matchedNumIndices.add(qi);
            matchedNameIndices.add(bestMatch.ni);
            if (process.env.OCR_DEBUG) {
              console.error(`[1V] qty-only match (pass 4): ${bestMatch.item} qty=${nc.qty} â†’ totalKg=${totalKg} (unit=${bestMatch.unitW})`);
            }
          }
        }

        if (blockMatched.length > 0) {
          for (const m of blockMatched) {
            merged.set(m.item, (merged.get(m.item) || 0) + m.qty);
            weightTotals.set(m.item, (weightTotals.get(m.item) || 0) + m.totalKg);
            consumedCells.add(m.lineIdx + ":" + m.cellIdx);
          }
          if (process.env.OCR_DEBUG) {
            console.error("[1V] vertical block num=", numRun.map((n) => `${n.qty}(${n.totalKg})`).join(" "), "names=", mergedNames.join(" | "), "â†’", blockMatched.map((m) => `${m.item} ${m.qty}x${m.totalKg}`).join(", "));
          }
          for (const n of textRun) usedLines.add(n.lineIdx);
          for (const n of numRun) usedLines.add(n.lineIdx);
        }

        vi = p;
      }
    }

    // â”€â”€ CORE STRATEGY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    for (let i = 0; i < parsedLines.length; i++) {
      if (usedLines.has(i)) continue;
      const line = parsedLines[i];
      if (line.numCells.length < 2) continue;
      if (line.textCells.length > 0) continue;

      const textLineData: { lineIdx: number; cells: string[] }[] = [];
      const collectedTextLineIdxs: number[] = [];

      const numCellCount = line.numCells.length;

      let nextNumAbove = -1;
      let nextNumBelow = parsedLines.length;
      for (let d = 1; d <= 3; d++) {
        const above = i - d;
        const below = i + d;
        if (above >= 0 && isRealNumericLine(parsedLines[above]) && nextNumAbove === -1) {
          nextNumAbove = above;
        }
        if (below < parsedLines.length && isRealNumericLine(parsedLines[below]) && nextNumBelow === parsedLines.length) {
          nextNumBelow = below;
        }
      }

      for (const direction of [1, -1]) {
        for (let d = 1; d <= 3; d++) {
          const adj = i + d * direction;
          if (adj < 0 || adj >= parsedLines.length) break;
          if (direction === 1 && adj >= nextNumBelow) break;
          if (direction === -1 && adj <= nextNumAbove) break;
          if (usedLines.has(adj)) continue;
          const adjLine = parsedLines[adj];
          if (isRealNumericLine(adjLine)) break;
          if (adjLine.textCells.length === 0) continue;
          // Allow d=3 text lines even with multiple cells â€” they may contain
          // compound-name fragments (e.g., "CORRENTE DE OURO" + "10K") or the
          // real name row several lines below the numeric row (e.g., after
          // noise lines like "POLICIA"), and the exact-match logic below
          // prefers the line whose cell count equals the numeric count.
          textLineData.push({
            lineIdx: adj,
            cells: adjLine.textCells.map((tc) => tc.text),
          });
          collectedTextLineIdxs.push(adj);
        }
      }

      if (textLineData.length === 0) continue;

      const numCellCount2 = numCellCount;

      const exactMatch = textLineData.find((t) => t.cells.length === numCellCount2);
      if (exactMatch) {
        // Se vÃ¡rias linhas tÃªm o nÃºmero certo de cÃ©lulas, preferir a que tem
        // mais nomes de itens reais (evita linhas de ruÃ­do OCR, ex.: "1- Ð¿Ñ–Ð¾:",
        // ganharem Ã  linha de nomes quando ambas tÃªm a mesma contagem).
        const knownName = (c: string) => !!ITEM_BY_NAME.get(matchItemName(c));
        const exactMatches = textLineData.filter((t) => t.cells.length === numCellCount2);
        const scoreLine = (t: { cells: string[] }) => t.cells.filter((c) => knownName(c)).length;
        const bestExact = exactMatches.reduce((a, b) => (scoreLine(b) > scoreLine(a) ? b : a));
        const idx = textLineData.indexOf(bestExact);
        textLineData.splice(idx, 1);
        textLineData.unshift(bestExact);
      } else {
        textLineData.sort((a, b) => b.cells.length - a.cells.length);
      }

      const mainLine = textLineData[0];
      const standaloneFragments: string[] = [];
      for (let tl = 1; tl < textLineData.length; tl++) {
        for (const c of textLineData[tl].cells) {
          standaloneFragments.push(c);
        }
      }

      const mainCells = [...mainLine.cells];

      // Merge standalone fragments into main cells
      const usedFragments = new Set<number>();
      const fragmentRules = [
        { standalonePrefix: /^fortalecido$/i, mainPart: /colete/i, merged: "COLETE FORTALECIDO" },
        { standalonePrefix: /^processado$/i, mainPart: /cristal/i, merged: "CRISTAL PROCESSADO" },
        { standalonePrefix: /^bruto$/i, mainPart: /diamante/i, merged: "DIAMANTE BRUTO" },
        { standalonePrefix: /^(10|14|18|22)k$/i, mainPart: /corrente/i, merged: "CORRENTE DE OURO $1K" },
        { standalonePrefix: /^reparacao$/i, mainPart: /kit/i, merged: "KIT REPARACAO" },
        { standalonePrefix: /^reparaÃ§Ã£o$/i, mainPart: /kit/i, merged: "KIT REPARACAO" },
        { standalonePrefix: /^carta\s+de$/i, mainPart: /^condu[cÃ§][aÃ£]o$/i, merged: "CARTA DE CONDUCAO" },
        { standalonePrefix: /^cart[aÃ£]o\s+de$/i, mainPart: /^cidad[aÃ£]o$/i, merged: "CARTAO DE CIDADAO" },
      ];

      for (let fi = 0; fi < standaloneFragments.length; fi++) {
        if (usedFragments.has(fi)) continue;
        const frag = standaloneFragments[fi];
        for (const rule of fragmentRules) {
          if (!rule.standalonePrefix.test(frag)) continue;
          const mainIdx = mainCells.findIndex((c) => rule.mainPart.test(c));
          if (mainIdx >= 0) {
            mainCells[mainIdx] = rule.merged;
            usedFragments.add(fi);
            break;
          }
        }
      }

      // Reverse rules
      const reverseRules = [
        { mainCell: /^carregador\s+de$/i, fragment: /^smg$/i, merged: "CARREGADOR DE SMG" },
        { mainCell: /^carregador\s+de$/i, fragment: /^pistola$/i, merged: "CARREGADOR DE PISTOLA" },
        { mainCell: /^carregador\s+de$/i, fragment: /^rifle$/i, merged: "CARREGADOR DE RIFLE" },
        { mainCell: /^carregador\s+de$/i, fragment: /^shotgun$/i, merged: "CARREGADOR DE SHOTGUN" },
        { mainCell: /^porte\s+de\s+arma$/i, fragment: /^branca$/i, merged: "PORTE DE ARMA BRANCA" },
        { mainCell: /^avan[cÃ§]ada$/i, fragment: /^lockpick$/i, merged: "LOCKPICK AVANCADA" },
        { mainCell: /^cart[aÃ£]o\s+de$/i, fragment: /^cidad[aÃ£]o$/i, merged: "CARTAO DE CIDADAO" },
        { mainCell: /^carta\s+de$/i, fragment: /^condu[cÃ§][aÃ£]o$/i, merged: "CARTA DE CONDUCAO" },
      ];
      for (let mi = 0; mi < mainCells.length; mi++) {
        for (const rule of reverseRules) {
          if (!rule.mainCell.test(mainCells[mi])) continue;
          const fi = standaloneFragments.findIndex(
            (f, idx) => !usedFragments.has(idx) && rule.fragment.test(f)
          );
          if (fi >= 0) {
            mainCells[mi] = rule.merged;
            usedFragments.add(fi);
            break;
          }
        }
      }

      // Add remaining standalone fragments
      const allCells: string[] = [...mainCells];
      for (let fi = 0; fi < standaloneFragments.length; fi++) {
        if (!usedFragments.has(fi)) {
          allCells.push(standaloneFragments[fi]);
        }
      }

      const mergedNames = mergeCompoundNamesInList(allCells);
      const nameInfos = mergedNames.map((name, idx) => ({
        idx,
        name,
        item: matchItemName(name),
      }));

      // WEIGHT-FIRST MATCHING
      const numCells = line.numCells;
      const usedNameIdxs = new Set<number>();
      let matched = 0;

      const candidates: { qIdx: number; nIdx: number; item: string; score: number }[] = [];
      for (let qi = 0; qi < numCells.length; qi++) {
        const qc = numCells[qi];
        for (const ni of nameInfos) {
          if (ni.item === "arma sns hk2 dupla") continue;
          let score = 0;
          if (qc.totalKg != null && qc.totalKg > 0) {
            if (weightMatches(ni.item, qc.qty, qc.totalKg)) {
              score += 1000;
            } else {
              const unitW = getUnitWeight(ni.item);
              if (unitW != null && unitW > 0) {
                const computed = qc.totalKg / qc.qty;
                const ratio = Math.abs(computed - unitW) / unitW;
                if (ratio > 0.5) score -= 500;
                else score -= ratio * 200;
              }
            }
          }
          score -= Math.abs(ni.idx - qi) * 50;
          candidates.push({ qIdx: qi, nIdx: ni.idx, item: ni.item, score });
        }
      }

      candidates.sort((a, b) => b.score - a.score);
      const usedQ = new Set<number>();

      for (const c of candidates) {
        if (c.score < 0) continue;
        if (usedQ.has(c.qIdx) || usedNameIdxs.has(c.nIdx)) continue;
        usedQ.add(c.qIdx);
        usedNameIdxs.add(c.nIdx);
        const qc = numCells[c.qIdx];
        merged.set(c.item, (merged.get(c.item) || 0) + qc.qty);
        if (qc.totalKg != null) {
          weightTotals.set(c.item, (weightTotals.get(c.item) || 0) + qc.totalKg);
        }
        consumedCells.add(i + ":" + qc.cellIdx);
        matched++;
      }

      if (matched > 0) {
        usedLines.add(i);
        for (const li of collectedTextLineIdxs) {
          usedLines.add(li);
        }
      }
    }

    // â”€â”€ PASS 2: Handle mixed lines (both numbers and text on same line) â”€â”€
    for (let i = 0; i < parsedLines.length; i++) {
      if (usedLines.has(i)) continue;
      const line = parsedLines[i];
      if (line.numCells.length === 0 || line.textCells.length === 0) continue;

      const allCellTexts = line.textCells.map((tc) => tc.text);
      const mergedNames = mergeCompoundNamesInList(allCellTexts);
      const usedText = new Set<number>();
      let matched = 0;

      for (const qc of line.numCells) {
        // NÃºmeros puros sem peso (ex.: "65" numa linha mista com o nome de um
        // item) sÃ£o ruÃ­do OCR, nÃ£o quantidades reais â€” sÃ³ pares (qty, peso)
        // alinham aqui. Sem isto, o "65" de uma linha suja era somado ao item
        // cujo nome estava na mesma linha (ex.: telemÃ³vel 65Ã—0.7 no ocr20).
        if (qc.totalKg == null) continue;
        let best: { idx: number; item: string; score: number } | null = null;
        for (let ni = 0; ni < mergedNames.length; ni++) {
          if (usedText.has(ni)) continue;
          const item = matchItemName(mergedNames[ni]);
          // SÃ³ alinhar com itens conhecidos do catÃ¡logo. Nomes desconhecidos
          // (ruÃ­do OCR como "SANTOS", "CRIANE") nÃ£o devem consumir cÃ©lulas
          // numÃ©ricas com peso â€” deixÃ¡-las para o PASS 3 recuperar por peso.
          if (!ITEM_BY_NAME.get(item)) continue;
          let score = 0;
          if (qc.totalKg != null && qc.totalKg > 0) {
            if (weightMatches(item, qc.qty, qc.totalKg)) score += 1000;
          }
          score -= Math.abs(ni - line.numCells.indexOf(qc)) * 50;
          if (!best || score > best.score) {
            best = { idx: ni, item, score };
          }
        }
        if (best) {
          usedText.add(best.idx);
          merged.set(best.item, (merged.get(best.item) || 0) + qc.qty);
          if (qc.totalKg != null) {
            weightTotals.set(best.item, (weightTotals.get(best.item) || 0) + qc.totalKg);
          }
          consumedCells.add(i + ":" + qc.cellIdx);
          matched++;
        }
      }
      if (matched > 0) usedLines.add(i);
    }

    // â”€â”€ PASS 3.5: Alinhamento por blocos (OCR em grelha) â”€â”€
    // No inventÃ¡rio em grelha as quantidades aparecem em linhas consecutivas
    // ("1 (5.0)", "30 (3.0)", ...) e os nomes logo a seguir noutras ("SNS
    // PISTOL MK2", "BANDAGEM", ...), uma cÃ©lula por linha. A posiÃ§Ã£o relativa
    // engana nesta forma â€” o "par mais prÃ³ximo" do PASS 4 troca itens de peso
    // igual (cristal 430 ficava com 43 de saco). Aqui alinham-se os dois
    // blocos pela ordem de apariÃ§Ã£o (Ã­ndice + penalizaÃ§Ã£o posicional), tal
    // como o CORE faz com linhas de vÃ¡rias cÃ©lulas.
    {
      const knownItem = (name: string): boolean => !!ITEM_BY_NAME.get(name);
      const mergeBlockNames = (names: string[]): string[] => {
        // splitCells pode dividir um nome composto em vÃ¡rias cÃ©lulas ("SNS
        // PISTOL"+"MK2", "MESA"+"QUÃMICA", "MEDWCHI"+"MOCHI"). Reutiliza a
        // mesma mesclagem geral do CORE, que junta compostos adjacentes e nÃ£o
        // adjacentes (ex.: "CRISTAL ... PROCESSADO").
        return mergeCompoundNamesInList(names);
      };

      let bi = 0;
      while (bi < parsedLines.length) {
        if (usedLines.has(bi)) { bi++; continue; }
        const numRun: { lineIdx: number; qty: number; totalKg: number | null; cellIdx: number }[] = [];
        let p = bi;
        while (p < parsedLines.length && !usedLines.has(p)) {
          const pl = parsedLines[p];
          if (pl.numCells.length > 0 && pl.textCells.length === 0) {
            for (const nc of pl.numCells) {
              numRun.push({ lineIdx: p, qty: nc.qty, totalKg: nc.totalKg, cellIdx: nc.cellIdx });
            }
            p++;
          } else break;
        }
        if (numRun.length < 2) { bi++; continue; }
        const nameRun: { lineIdx: number; text: string }[] = [];
        while (p < parsedLines.length && !usedLines.has(p)) {
          const pl = parsedLines[p];
          if (pl.textCells.length > 0 && pl.numCells.length === 0) {
            for (const tc of pl.textCells) nameRun.push({ lineIdx: p, text: tc.text });
            p++;
          } else break;
        }
        bi = p;
        if (nameRun.length < 2) continue;

        const mergedNames = mergeBlockNames(nameRun.map((n) => n.text))
          // CÃ©lulas de ruÃ­do de 1 letra (ex.: "G") no meio de uma fila de nomes
          // nÃ£o sÃ£o itens â€” removÃª-las permite que o bloco seja alinhado quando
          // o OCR as lÃª na mesma linha dos nomes (ex.: "G\tASSAULT SMG").
          .filter((m) => !/^[a-z]{1}$/i.test(m));
        if (mergedNames.length < 2) continue;
        // SÃ³ alinhar se TODOS os nomes forem itens conhecidos â€” caso contrÃ¡rio
        // o bloco Ã© ruÃ­do OCR e o PASS 4 (posiÃ§Ã£o relativa) decide melhor.
        if (!mergedNames.every((m) => knownItem(matchItemName(m)))) {
          if (process.env.OCR_DEBUG) console.error("[3.5] block skipped (unknown name):", mergedNames.join(" | "));
          continue;
        }

        const usedName = new Set<number>();
        const blockMatched: { item: string; qty: number; totalKg: number; lineIdx: number; cellIdx: number }[] = [];
        for (let qi = 0; qi < numRun.length; qi++) {
          const nc = numRun[qi];
          let best: { ni: number; item: string; score: number } | null = null;
          for (let ni = 0; ni < mergedNames.length; ni++) {
            if (usedName.has(ni)) continue;
            const item = matchItemName(mergedNames[ni]);
            let score = 0;
            let strong = false;
            if (nc.totalKg != null && nc.totalKg > 0) {
              if (weightMatches(item, nc.qty, nc.totalKg)) {
                score += 1000;
                strong = true;
              } else if (weightMatchesLoose(item, nc.qty, nc.totalKg)) score += 900;
            }
            // O peso perfeito Ã© o sinal mais forte: o nome e a cÃ©lula podem
            // estar desfasados (ex.: "CORRENTE DE OURO 10K" no topo do bloco
            // mas "101 (15.2)" na 4Âª cÃ©lula) â€” penalidade pequena. Sem match de
            // peso, a posiÃ§Ã£o decide (penalidade maior).
            score -= Math.abs(ni - qi) * (strong ? 20 : 50);
            // Em empate, o nome mais abaixo ganha: quando o OCR lÃª mais nomes
            // do que cÃ©lulas, o nome "extra" fica no topo da coluna (ex.: o
            // "CORRENTE DE OURO" partido de "CORRENTE DE OURO 10K") e o mapa
            // verdadeiro Ã© nome[i] â†” cÃ©lula[i+1].
            if (!best || score > best.score || (score === best.score && ni > best.ni)) {
              best = { ni, item, score };
            }
          }
          if (best && best.score >= 900) {
            usedName.add(best.ni);
            blockMatched.push({ item: best.item, qty: nc.qty, totalKg: nc.totalKg ?? 0, lineIdx: nc.lineIdx, cellIdx: nc.cellIdx });
          }
        }
        if (blockMatched.length === 0) continue;
        for (const m of blockMatched) {
          merged.set(m.item, (merged.get(m.item) || 0) + m.qty);
          weightTotals.set(m.item, (weightTotals.get(m.item) || 0) + m.totalKg);
          consumedCells.add(m.lineIdx + ":" + m.cellIdx);
        }
        if (process.env.OCR_DEBUG) {
          console.error("[3.5] block num=", numRun.map((n) => `${n.qty}(${n.totalKg})`).join(" "), "names=", mergedNames.join(" | "), "â†’", blockMatched.map((m) => `${m.item} ${m.qty}x${m.totalKg}`).join(", "));
        }
        for (const n of nameRun) usedLines.add(n.lineIdx);
        for (const n of numRun) usedLines.add(n.lineIdx);
      }
    }

    // â”€â”€ PASS 4: Name-based recovery from full text â”€â”€
    {
      const allText = lines.join(" ");
      // Texto sem acentos mas com o MESMO comprimento (posiÃ§Ãµes 1:1) â€” os
      // padrÃµes do ITEM_MAP sÃ£o sem acentos e o OCR traz "MESA QUÃMICA",
      // "Sumo AnanÃ¡s", etc.; sem normalizaÃ§Ã£o o /mesa\s*quimica/i nÃ£o casa.
      const allTextNorm = deaccent(allText);
      // Deslocamento de cada linha no allText, para mapear a posiÃ§Ã£o de um par
      // "qty (peso)" de volta Ã  cÃ©lula exata (linha:cÃ©lula) que o gerou. Assim o
      // PASS 4 marca em consumedCells apenas a cÃ©lula que consumiu â€” e um par
      // idÃªntico repetido noutra cÃ©lula continua disponÃ­vel para outro item.
      const lineStarts: number[] = [];
      {
        let acc = 0;
        for (const l of lines) {
          lineStarts.push(acc);
          acc += l.length + 1;
        }
      }
      const cellOf = (pos: number): string => {
        let i = 0;
        while (i < lines.length - 1 && pos >= lineStarts[i] + lines[i].length) i++;
        const charInLine = pos - lineStarts[i];
        let searchFrom = 0;
        for (let c = 0; c < parsedLines[i].cells.length; c++) {
          const cell = parsedLines[i].cells[c];
          const idx = lines[i].indexOf(cell, searchFrom);
          const start = idx >= 0 ? idx : searchFrom;
          const end = start + cell.length;
          if (charInLine >= start && charInLine < end) return i + ":" + c;
          searchFrom = Math.max(searchFrom, end);
        }
        return i + ":0";
      };
      const pairPattern = /(\d[\d.,]*)\s*\(\s*([^)]+)\s*\)/g;
      const allPairs: { qty: number; totalKg: number; pos: number; matched: boolean; raw: string }[] = [];
      let pm: RegExpExecArray | null;
      while ((pm = pairPattern.exec(allText))) {
        const { qty, totalKg } = parseQtyWeight(pm[0]);
        const raw = pm[0];
        if (qty > 0 && totalKg != null && Number.isFinite(totalKg)) {
          allPairs.push({ qty, totalKg, pos: pm.index, matched: false, raw });
        }
      }

      for (const [pattern, itemName] of ITEM_MAP) {
        if (merged.has(itemName)) continue;
        if (itemName === "arma sns hk2 dupla") continue;
        if (itemName === "lockpick" && merged.has("lockpick avancada")) continue;
        if (itemName === "lockpick" && /lockpick[\s\S]*?avan[cÃ§]ad/i.test(allTextNorm)) continue;
        if (itemName === "colete" && merged.has("colete fortalecido")) continue;
        // cristal puro (0.1 kg/un) NÃƒO Ã© sombreado pelo cristal processado
        // (0.3 kg/un): pesos distintos, nunca hÃ¡ cross-match. Sombrear faria
        // perder o stack real de cristal puro (ex.: "65 (6.5)" junto de um
        // "140 (42.0)" de cristal processado).
        if (itemName === "colete" && /colete\s*fortalecid/i.test(allTextNorm)) continue;
        if (itemName === "diamante" && /diamante\s*bruto/i.test(allTextNorm)) continue;
        // Skip generic "diamante" if "anel" (from "anel de diamante") is already matched
        if (itemName === "diamante" && merged.has("anel") && /anel\s*(de\s*)?diamante/i.test(allTextNorm)) continue;
        if (itemName === "sumo" && /sumo\s*(maracu|laranja|manga|ananas)/i.test(allTextNorm)) continue;
        if (itemName === "sumo" && (merged.has("sumo maracuja") || merged.has("sumo laranja") || merged.has("sumo ananas"))) continue;
        if (itemName === "corrente" && /corrente\s*10k/i.test(allTextNorm)) continue;
        // Skip do "cartÃ£o" genÃ©rico (peso 0.1kg) quando o texto tem "cartÃ£o de
        // cidadÃ£o" ou "carta de conduÃ§Ã£o" (documentos sem peso) â€” evita roubar
        // pares (qty, peso) de outros itens (ex.: semente de erva 295 (29.5)).
        if (itemName === "cartao" && /cart[aÃ£]o\s*de\b[\s\S]*?\bcidad[aÃ£]o\b/i.test(allTextNorm)) continue;
        if (itemName === "cartao" && /carta\s*de\b[\s\S]*?\bcondu[cÃ§][aÃ£]o\b/i.test(allTextNorm)) continue;

        // Nome do item no texto. Compostos podem aparecer separados na grelha
        // (ex.: "CRISTAL" e "PROCESSADO" em linhas diferentes com outras palavras
        // pelo meio), por isso hÃ¡ um fallback amplo; o par sÃ³ casa por peso, o
        // que torna o match amplo seguro.
        const findName = (pattern: RegExp, itemName: string, text: string): RegExpExecArray | null => {
          const m = new RegExp(pattern.source, "i").exec(text);
          if (m) return m;
          switch (itemName) {
            case "cristal processado": return /cristal[\s\S]*?processad/i.exec(text);
            case "colete fortalecido": return /colete[\s\S]*?fortalecid/i.exec(text);
            case "diamante bruto": return /diamante[\s\S]*?brut/i.exec(text);
            case "corrente 10k": return /corrente[\s\S]*?10k/i.exec(text);
            default: return null;
          }
        };
        const nameMatch = findName(pattern, itemName, allTextNorm);
        if (!nameMatch) continue;
        const namePos = nameMatch.index;

        let bestPair: (typeof allPairs)[0] | null = null;
        let bestDist = Infinity;
        // Lockpicks sÃ£o ferramentas: o jogador carrega poucas unidades, enquanto
        // outros itens de 0.5 kg (ex.: minÃ©rios) acumulam em stacks grandes. Com
        // o OCR em grelha (quantidades primeiro, nomes depois), a distÃ¢ncia
        // posicional Ã© enganadora â€” preferir o par de menor quantidade resolve
        // "lockpick e 1 e minÃ©rios e 61" (lockpick=1, minerios=61).
        const preferSmallQty = itemName === "lockpick avancada" || itemName === "lockpick";
        let bestPairQty = Infinity;
        for (const pair of allPairs) {
          if (pair.matched) continue;
          if (consumedCells.has(cellOf(pair.pos))) continue;
          const strict = weightMatches(itemName, pair.qty, pair.totalKg);
          const loose = !strict && weightMatchesLoose(itemName, pair.qty, pair.totalKg);
          if (!strict && !loose) continue;
          const dist = Math.abs(pair.pos - namePos);
          if (preferSmallQty) {
            if (pair.qty < bestPairQty || (pair.qty === bestPairQty && dist < bestDist)) {
              bestPairQty = pair.qty;
              bestDist = dist;
              bestPair = pair;
            }
          } else if (dist < bestDist) {
            bestDist = dist;
            bestPair = pair;
          }
        }
        if (bestPair) {
          bestPair.matched = true;
          consumedCells.add(cellOf(bestPair.pos));
          merged.set(itemName, (merged.get(itemName) || 0) + bestPair.qty);
          weightTotals.set(itemName, (weightTotals.get(itemName) || 0) + bestPair.totalKg);
        }
      }
    }

    // â”€â”€ PASS 3: Weight-validated recovery for remaining numeric cells â”€â”€
    const allTextForPass3 = lines.join(" ");
    // Nomes genÃ©ricos que NÃƒO podem casar quando a variante especÃ­fica jÃ¡ estÃ¡
    // no texto (ex.: "lockpick" quando existe "LOCKPICK AVANÃ‡ADA"). Sem isto,
    // "4 (2.0)" de um stack de tigres era atribuÃ­do a "lockpick" porque o peso
    // unitÃ¡rio (0.5 kg) Ã© igual e "LOCKPICK AVANÃ‡ADA" aparece no texto.
    const genericShadow = (itemName: string): boolean => {
      switch (itemName) {
        case "lockpick":
          return /lockpick[\s\S]*?avan[cÃ§]ad/i.test(allTextForPass3);
        case "colete":
          return /colete\s*fortalecid/i.test(allTextForPass3);
        case "cristal":
          // cristal (0.1) e cristal processado (0.3) tÃªm pesos distintos â€” o
          // sombreamento deixaria perder o stack de cristal puro quando o
          // processado tambÃ©m existe. Nunca sombreia.
          return false;
        case "diamante":
          return /diamante\s*bruto/i.test(allTextForPass3) ||
            (merged.has("anel") && /anel\s*(de\s*)?diamante/i.test(allTextForPass3));
        case "sumo":
          return /sumo\s*(maracu|laranja|manga|ananas)/i.test(allTextForPass3) ||
            merged.has("sumo maracuja") || merged.has("sumo laranja") || merged.has("sumo ananas");
        case "corrente":
          return /corrente\s*10k/i.test(allTextForPass3);
        case "cartao":
          return /cart[aÃ£]o\s*de\b[\s\S]*?\bcidad[aÃ£]o\b/i.test(allTextForPass3) ||
            /carta\s*de\b[\s\S]*?\bcondu[cÃ§][aÃ£]o\b/i.test(allTextForPass3) ||
            /copo\s*de\s*cart[aÃ£]o/i.test(allTextForPass3) ||
            merged.has("copo de cartao");
        default:
          return false;
      }
    };

    // Proximidade entre a cÃ©lula Ã³rfÃ£ e o nome do item: procura a linha de
    // texto vizinha (atÃ© 3 linhas) que contenha o nome e pontua com a coluna
    // (peso 100) e a distÃ¢ncia da linha (peso 1). A coluna Ã© o sinal mais
    // forte: na grelha do jogo a cÃ©lula numÃ©rica N alinha com o nome N. Isto
    // resolve stacks Ã³rfÃ£os (ex.: "4 (2.0)" â†’ TIGRE e nÃ£o LOCKPICK AVANÃ‡ADA,
    // apesar de ambos pesarem 0.5 kg). Sem nome perto, cai no comportamento
    // antigo (nome em qualquer parte do texto) com pontuaÃ§Ã£o pior.
    const proximityScore = (itemName: string, cellLine: number, cellCol: number): number => {
      let best = Infinity;
      for (let d = 1; d <= 3; d++) {
        for (const dir of [-1, 1]) {
          const adj = cellLine + dir * d;
          if (adj < 0 || adj >= parsedLines.length) continue;
          const adjLine = parsedLines[adj];
          if (adjLine.textCells.length === 0) continue;
          // Uma linha de nomes jÃ¡ consumida pelo CORE/PASS 3.5 (ex.: a fila
          // "LICENÃ‡A PESCA â€¦ TRUTA" que jÃ¡ serviu a linha numÃ©rica de cima) nÃ£o
          // pode voltar a atribuir itens a cÃ©lulas Ã³rfÃ£s de outra fila â€” senÃ£o
          // "8 (1.6)"/"14 (2.8)" de uma segunda fila sem nomes eram somados Ã 
          // TRUTA (regressÃ£o introduzida em 3bb3af5).
          if (usedLines.has(adj)) continue;
          for (const tc of adjLine.textCells) {
            if (matchItemName(tc.text) !== itemName) continue;
            best = Math.min(best, Math.abs(tc.cellIdx - cellCol) * 100 + d);
          }
        }
      }
      if (Number.isFinite(best)) return best;
      // Fallback amplo de texto (nome em qualquer parte do OCR, pontuaÃ§Ã£o
      // fraca) â€” mas sÃ³ quando ainda existe um nome do item numa linha livre.
      // Se TODOS os nomes jÃ¡ foram consumidos (ex.: a TRUTA da fila de cima),
      // o fallback reutilizaria um nome jÃ¡ atribuÃ­do e duplicaria o item.
      const patterns = ITEM_MAP.filter(([, name]) => name === itemName).map(([p]) => p);
      if (patterns.length === 0) return Infinity;
      const freeText = parsedLines
        .filter((pl) => !usedLines.has(pl.lineIdx))
        .map((pl) => pl.cells.join(" "))
        .join(" ");
      if (patterns.some((p) => p.test(deaccent(freeText)))) return 1000;
      return Infinity;
    };

    for (let i = 0; i < parsedLines.length; i++) {
      const line = parsedLines[i];
      for (const qc of line.numCells) {
        if (consumedCells.has(i + ":" + qc.cellIdx)) continue;
        if (qc.totalKg == null || qc.totalKg <= 0) continue;
        const computed = qc.totalKg / qc.qty;

        let bestMatch: { name: string; diff: number; score: number } | null = null;
        for (const itemDef of ITEM_CATALOG) {
          if (itemDef.unitKg <= 0) continue;
          if (itemDef.name === "cartao" && /cart[aÃ£]o\s*de\b[\s\S]*?\bcidad[aÃ£]o\b/i.test(allTextForPass3)) continue;
          if (itemDef.name === "cartao" && /carta\s*de\b[\s\S]*?\bcondu[cÃ§][aÃ£]o\b/i.test(allTextForPass3)) continue;
          if (genericShadow(itemDef.name)) continue;

          const diff = Math.abs(computed - itemDef.unitKg);
          if (diff > Math.max(0.03, itemDef.unitKg * 0.15)) continue;

          let altMatch = false;
          const alts = ALT_WEIGHTS[itemDef.name];
          if (alts) {
            for (const alt of alts) {
              if (Math.abs(computed - alt) <= Math.max(0.03, alt * 0.15)) {
                altMatch = true;
                break;
              }
            }
          }
          if (!altMatch && diff > Math.max(0.03, itemDef.unitKg * 0.15)) continue;

          const score = proximityScore(itemDef.name, i, qc.cellIdx);
          if (!Number.isFinite(score)) continue;

          if (
            !bestMatch ||
            diff < bestMatch.diff - 1e-9 ||
            (Math.abs(diff - bestMatch.diff) <= 1e-9 && score < bestMatch.score)
          ) {
            bestMatch = { name: itemDef.name, diff, score };
          }
        }
        if (!bestMatch) {
          // Fallback por peso unitÃ¡rio Ãºnico: quando o nome estÃ¡ cortado no OCR
          // (ex.: telemÃ³vel a "1 (0.7)"), o PASS 3 nÃ£o encontra proximidade de
          // nome. Se o peso calculado da cÃ©lula Ã³rfÃ£ casa com EXATAMENTE UM item
          // do catÃ¡logo, atribuÃ­mo-lo â€” Ã© seguro porque o peso Ã© distintivo
          // (0.7 kg sÃ³ existe no telemÃ³vel). Pesos partilhados (ex.: 1.0 kg,
          // 0.5 kg) ficam sem match e a cÃ©lula Ã© ignorada.
          const unique: { name: string; diff: number }[] = [];
          for (const itemDef of ITEM_CATALOG) {
            if (itemDef.unitKg <= 0) continue;
            if (itemDef.name === "cartao" && /cart[aÃ£]o\s*de\b[\s\S]*?\bcidad[aÃ£]o\b/i.test(allTextForPass3)) continue;
            if (itemDef.name === "cartao" && /carta\s*de\b[\s\S]*?\bcondu[cÃ§][aÃ£]o\b/i.test(allTextForPass3)) continue;
            if (genericShadow(itemDef.name)) continue;
            let ok = Math.abs(computed - itemDef.unitKg) <= Math.max(0.03, itemDef.unitKg * 0.15);
            if (!ok && ALT_WEIGHTS[itemDef.name]) {
              ok = ALT_WEIGHTS[itemDef.name].some(
                (alt) => Math.abs(computed - alt) <= Math.max(0.03, alt * 0.15)
              );
            }
            if (!ok) continue;
            unique.push({ name: itemDef.name, diff: Math.abs(computed - itemDef.unitKg) });
          }
          if (unique.length === 1) {
            // SÃ³ atribuir por peso Ãºnico se o nome do item aparecer algures no
            // OCR. Quando uma coluna/fila de cÃ©lulas nÃ£o tem NENHUM nome lido
            // (ex.: o fundo de um bag cortado na imagem), o fallback por peso
            // Ãºnico adivinhava itens falsos â€” "1 (0.7)" virava um telemÃ³vel
            // que nÃ£o estÃ¡ no inventÃ¡rio. O nome cortado ainda aparece no
            // texto (ex.: "TELEMOVEL"), o que preserva o caso legÃ­timo.
            const patterns = ITEM_MAP.filter(([, n]) => n === unique[0].name).map(([p]) => p);
            if (patterns.some((p) => p.test(deaccent(allTextForPass3)))) {
              bestMatch = { name: unique[0].name, diff: unique[0].diff, score: Infinity };
            }
          }
          // CÃ©lula Ã³rfÃ£ sem nome lido (itens do fundo de um bag cortado na
          // imagem â€” ex.: "5(10.0)"). Preserva-se como "item nao identificado
          // (X kg/un)" para o total nunca ficar abaixo do Peso do jogo. SÃ³
          // quando o peso unitÃ¡rio Ã© plausÃ­vel (casa com â‰¥1 item do catÃ¡logo):
          // "88" sem peso, "1 (0.0)" ou timestamps ficam de fora.
          if (!bestMatch && qc.totalKg > 0) {
            const plausible = ITEM_CATALOG.some(
              (itemDef) =>
                itemDef.unitKg > 0 &&
                Math.abs(computed - itemDef.unitKg) <= Math.max(0.05, itemDef.unitKg * 0.3)
            );
            if (plausible) {
              bestMatch = {
                name: `item nao identificado (${Math.round(computed * 100) / 100} kg/un)`,
                diff: 0,
                score: 900,
              };
            }
          }
        }
        // Match fraco (score 1000 = o nome do item existe noutra parte do texto,
        // nÃ£o junto Ã  cÃ©lula; ex.: uma "1 (1.0)" no canto cortado). Para uma
        // cÃ©lula Ã³rfÃ£ de ~1.0 kg, a ordem do catÃ¡logo decidiria entre arma de
        // coleÃ§Ã£o/hammer â€” mas o rÃ¡dio Ã© quase universal no inventÃ¡rio do jogo,
        // logo Ã© o palpite mais provÃ¡vel para um "1 (1.0)" sem nome lido.
        if (
          bestMatch &&
          bestMatch.score >= 1000 &&
          !merged.has("radio") &&
          Math.abs(computed - 1) <= Math.max(0.03, 1 * 0.15)
        ) {
          bestMatch = { name: "radio", diff: Math.abs(computed - 1), score: Infinity };
        }
        if (bestMatch) {
          merged.set(bestMatch.name, (merged.get(bestMatch.name) || 0) + qc.qty);
          weightTotals.set(bestMatch.name, (weightTotals.get(bestMatch.name) || 0) + qc.totalKg);
          consumedCells.add(i + ":" + qc.cellIdx);
          usedLines.add(i);
        }
      }
    }
  }

  // â”€â”€ Build result â”€â”€
  // Normaliza nomes (sem acentos) para tolerar diferenÃ§as entre o texto OCR
  // (ex.: "kit reparaÃ§Ã£o") e as chaves do catÃ¡logo (ex.: "kit reparacao").
  const normKey = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const catalogByNorm = new Map<string, (typeof ITEM_CATALOG)[number]>();
  for (const def of ITEM_CATALOG) catalogByNorm.set(normKey(def.name), def);

  // Remove ruÃ­do/truncamentos de OCR que nÃ£o correspondem a itens reais
  // (ex.: "jogador-", "peso:", "/", "(1 (15.0)"), para que nem o texto nem
  // os pesos os incluam. Todos os itens legÃ­timos estÃ£o no catÃ¡logo â€” exceto
  // os "item nao identificado (X kg/un)" da sÃ­ntese, que sÃ£o peso real sem
  // nome (cortado no OCR) e tÃªm de sobreviver para o total bater com o Peso.
  const CUT_ITEM = "item nao identificado";

  // â”€â”€ Post-process: detect and fix swapped quantities between similar items â”€â”€
  // Ex.: "corrente" (0.1kg) with qty=178 (total=17.8) and "corrente 10k" (0.15kg) with qty=114 (total=17.1)
  // but OCR shows corrente=26.7kg (should be 10k qty) and corrente 10k=11.4kg (should be corrente qty)
  // If swapping qty makes BOTH weights match perfectly, do the swap.
  function tryFixSwappedQuantities(): void {
    const items = Array.from(merged.entries()).map(([name, qty]) => {
      const def = catalogByNorm.get(normKey(name));
      const totalKg = weightTotals.get(name) ?? 0;
      return { name, qty, totalKg, unitKg: def?.unitKg ?? 0, def };
    }).filter(x => x.def && x.unitKg > 0 && x.qty > 0 && x.totalKg > 0);

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];

        // Check if they're variants of the same base item (e.g., "corrente" vs "corrente 10k")
        const baseA = a.name.replace(/\s+(10|14|18|22)k$/, "");
        const baseB = b.name.replace(/\s+(10|14|18|22)k$/, "");
        if (baseA !== baseB) continue;

        // Current deviation
        const devA = Math.abs(a.totalKg - a.qty * a.unitKg) / (a.qty * a.unitKg);
        const devB = Math.abs(b.totalKg - b.qty * b.unitKg) / (b.qty * b.unitKg);

        // Deviation if swapped
        const devASwapped = Math.abs(a.totalKg - b.qty * a.unitKg) / (b.qty * a.unitKg);
        const devBSwapped = Math.abs(b.totalKg - a.qty * b.unitKg) / (a.qty * b.unitKg);

        // Both currently bad (>15%), both would be good (<5%) if swapped
        if (devA > 0.15 && devB > 0.15 && devASwapped < 0.05 && devBSwapped < 0.05) {
          // Swap quantities AND weight totals together.
          // The OCR cell pairs (qty, totalKg) belong to specific items; when
          // the names are misassigned, the entire pair must move — keeping
          // totalKg with the original cell (as the old comment said) leaves
          // mismatched qty/kg that breaks the per-unit weight display.
          merged.set(a.name, b.qty);
          merged.set(b.name, a.qty);
          weightTotals.set(a.name, b.totalKg);
          weightTotals.set(b.name, a.totalKg);
          if (process.env.OCR_DEBUG) {
            console.error(`[SWAP-FIX] Swapped qty+kg: ${a.name} ${a.qty}(${a.totalKg}kg)â†”${b.qty}(${b.totalKg}kg) ${b.name}`);
          }
        }
      }
    }
  }

  tryFixSwappedQuantities();

  for (const name of [...merged.keys()]) {
    if (name.startsWith(CUT_ITEM)) continue;
    if (!catalogByNorm.has(normKey(name))) merged.delete(name);
  }

  const weights: ItemMatch[] = [];
  for (const [name, qty] of merged.entries()) {
    if (name.startsWith(CUT_ITEM)) {
      const ocrTotalKg = weightTotals.get(name) ?? 0;
      const unitKg = qty > 0 ? Math.round((ocrTotalKg / qty) * 100) / 100 : null;
      weights.push({
        item: name,
        qty,
        kg: ocrTotalKg,
        unitKg: unitKg != null && unitKg > 0 ? unitKg : null,
        confidence: 50,
        confidenceLevel: "medium",
        matchReason: "Nome cortado no OCR â€” peso contabilizado",
      });
      continue;
    }
    const itemDef = catalogByNorm.get(normKey(name));
    if (!itemDef) continue;
    const unitKg = itemDef.unitKg;
    const ocrTotalKg = weightTotals.get(name);
    let confidence = 50;
    let matchReason = "Nome detetado no OCR";

    if (unitKg != null && unitKg > 0 && ocrTotalKg != null && ocrTotalKg > 0) {
      const refUnit = bestUnitWeight(itemDef.name, qty, ocrTotalKg) ?? unitKg;
      const expectedTotal = qty * refUnit;
      const deviation = Math.abs(ocrTotalKg - expectedTotal);
      const deviationPercent = (deviation / expectedTotal) * 100;
      const fmtNum = (n: number) => n.toLocaleString("pt-PT");
      if (deviationPercent < 5) {
        confidence = 95;
        matchReason = `Peso perfeito: ${fmtNum(ocrTotalKg)} kg = ${fmtNum(qty)} Ã— ${fmtNum(refUnit)} kg`;
      } else if (deviationPercent < 20) {
        confidence = 80;
        matchReason = `Peso prÃ³ximo: ${fmtNum(ocrTotalKg)} kg â‰ˆ ${fmtNum(qty)} Ã— ${fmtNum(refUnit)} kg`;
      } else {
        confidence = 40;
        matchReason = `Peso divergente: ${fmtNum(ocrTotalKg)} kg vs ${fmtNum(qty)} Ã— ${fmtNum(refUnit)} kg`;
      }
    }

    weights.push({
      item: itemDef.name,
      qty,
      kg: ocrTotalKg ?? qty * (unitKg ?? 0),
      unitKg,
      confidence,
      confidenceLevel: confidence >= 80 ? "high" : confidence >= 50 ? "medium" : "low",
      matchReason,
    });
  }

  const overallConfidence =
    weights.length > 0 ? Math.round(weights.reduce((sum, w) => sum + w.confidence, 0) / weights.length) : 0;

  const resultText = Array.from(merged.entries())
    // Itens cortados sem nome ficam de fora do texto de coimas (nÃ£o tÃªm
    // multa), mas continuam na tabela de pesos para o total bater.
    .filter(([name]) => !name.startsWith(CUT_ITEM))
    .map(([name, qty]) => `${qty} ${name}`)
    .join(", ");

  return { text: resultText, weights, weaponCapture, overallConfidence };
}
