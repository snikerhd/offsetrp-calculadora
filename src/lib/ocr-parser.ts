// ══════════════════════════════════════════════════════════════════════════════
// INVENTORY OCR PARSER — Offset RP
//
// The game inventory OCR produces a grid of quantity/weight cells paired with
// item name cells. OCR can split compound names across cells AND lines.
//
// STRATEGY:
// 1. Fix OCR typos
// 2. Group lines into "blocks": each block = a numeric row + nearby text rows
// 3. Collect ALL text cells from the text rows, merge compound names
// 4. Match quantity cells to name cells by position (first num ↔ first name)
// 5. Use unit weight as validation, not as primary matching signal
// ══════════════════════════════════════════════════════════════════════════════
import { ITEM_BY_NAME, ITEM_CATALOG } from "./item-weights";

// ── Types ────────────────────────────────────────────────────────────────
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

// ── OCR typo corrections ───────────────────────────────────────────────────
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
    // OCR: "HEDACHI/HOHOSHU/CARTAD/ENCOHENDA" são misreads de itens
    [/\bHEDACHI\s+MOCHI\b/gi, "MEDWCHI MOCHI"],
    [/\bHOHOSHU\b/gi, "MONOSHU"],
    [/\bMOMOSHU\b/gi, "MONOSHU"],
    [/\bCARTAD\b/gi, "CARTAO"],
    [/\bENCOHENDA\b/gi, "ENCOMENDA"],
    [/\bBTFANA\b/gi, "BIFANA"],
    [/\bSACO\s+PL[AÁ]STICO\b/gi, "SACO PLASTICO"],
    [/\bSACO\s+PLÁSTTCO\b/gi, "SACO PLASTICO"],
    [/\bREBARBADOÍRA\b/gi, "REBARBADORA"],
    [/\bHACO\s+TABACO\b/gi, "MACO TABACO"],
    [/\bMAÇO\s+TABACO\b/gi, "MACO TABACO"],
    // OCR: "OURO" is often misread as "DURO"
    [/\bCORRENTE\s+DE\s+DURO\b/gi, "CORRENTE DE OURO"],
    // OCR: "TELENOVEL" is a misread of "TELEMOVEL"
    [/\bTELENOVEL\b/gi, "TELEMOVEL"],
    // OCR: "TELEHOVEL" is a misread of "TELEMOVEL"
    [/\bTELEHOVEL\b/gi, "TELEMOVEL"],
    // OCR: "1BK" é misread de "10K" (o jogo só tem corrente 10K, não 18K)
    [/\b1BK\b/gi, "10K"],
    // OCR: "1OK" → "10K", "14K" etc. digit misreads in karat labels
    [/\b1OK\b/gi, "10K"],
  ];
  let result = text;
  for (const [pattern, replacement] of typoRules) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

// ── ITEM_MAP: regex → canonical name ─────────────────────────────────────
const ITEM_MAP: [RegExp, string][] = [
  [/lockpick\s*avan[cç]ad/i, "lockpick avancada"],
  [/lockpeck\s*avan[cç]ad/i, "lockpick avancada"],
  [/lockpick|lockpeck/i, "lockpick"],
  [/acess[oó]rio[s]?\s*(para\s*)?arma[s]?/i, "acessorios para armas"],
  [/algema/i, "algemas"],
  [/medikit|medick/i, "medickits"],
  [/mesa\s*quimica/i, "mesa quimica"],
  [/diamante\s*bruto/i, "diamante bruto"],
  [/anel\s*(de\s*)?diamante/i, "anel"],
  [/diamante/i, "diamante"],
  [/safira/i, "safiras"],
  [/barra[s]?\s*(de\s*)?(ouro|outro)/i, "barras ouro"],
  [/pepita/i, "pepitas"],
  [/p[oó]lvora/i, "polvora"],
  [/esquema/i, "esquemas"],
  [/pe[cç]as?\s*(de\s*)?arma/i, "pecas"],
  [/rebarbadora/i, "rebarbadora"],
  [/quadro/i, "quadro"],
  [/pulseira/i, "pulseira ouro"],
  [/rel[oó]gio\s*(de\s*)?ouro/i, "relogio ouro"],
  [/corrente\s*(de\s*)?ouro\s*10k|(?:^|\s)10k\s*corrente/i, "corrente 10k"],
  [/corrente\s*(de\s*)?ouro/i, "corrente"],
  [/^(?:10|14|18|22)k$/i, "corrente 10k"],
  [/anel\s*(de\s*)?diamante/i, "anel"],
  [/perfume/i, "perfume"],
  [/phone\s*7/i, "phone 7"],
  [/tv\s*led/i, "tv led 75"],
  [/computador/i, "computador"],
  [/pack\s*vinhos/i, "pack vinhos"],
  [/ouro\s*estatal/i, "ouro estatal"],
  [/arma\s*de\s*cole[cç]/i, "arma de colecao"],
  [/tigre/i, "tigre"],
  [/documento/i, "documentos"],
  [/[aá]guia\s*(de\s*)?bronze/i, "aguia de bronze"],
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
  [/ma[cç]o\s*tabaco/i, "maço"],
  [/maco\s*tabaco/i, "maço"],
  [/ma[cç]o/i, "maço"],
  [/estimulante/i, "estimulante"],
  [/semente\s*(de\s*)?(erva|cannabis)/i, "semente erva"],
  [/cabe[cç]o\s*(de\s*)?(erva|cannabis)/i, "cabeco erva"],
  [/cabe[cç]o/i, "cabeco erva"],
  [/[oó]leo\s*medicinal/i, "oleo medicinal"],
  [/saco\s*(de\s*)?(erva|cannabis)/i, "saco erva"],
  [/saco\s*pl[aá]stico/i, "saco plastico"],
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
  [/sns\s*pistol/i, "arma baixo calibre"],
  [/vintage\s*pistol/i, "arma baixo calibre"],
  [/pistol\s*\.?50/i, "arma baixo calibre"],
  [/revolver\s*mk\s*2/i, "arma baixo calibre"],
  [/ap\s*pistol/i, "arma baixo calibre"],
  // Médio calibre
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
  // "CARREGADOR DE" e "RIFLE" podem ficar separados por outra célula quando o
  // OCR parte a linha (ex.: "CARREGADOR DE" ... "RIFLE").
  [/carregador\s+de\b[\s\S]*?\brifle\b/i, "carregador alto calibre"],
  [/carregador\s*(de\s*)?shotgun/i, "carregador alto calibre"],
  [/carregador\s*(de\s*)?baixo\s*calibre/i, "carregador baixo calibre"],
  [/carregador\s*(de\s*)?m[eé]dio\s*calibre/i, "carregador medio calibre"],
  [/carregador\s*(de\s*)?alto\s*calibre/i, "carregador alto calibre"],
  // Blueprints
  [/blueprint\s*pistola/i, "blueprint pistola"],
  [/blueprint\s*smg/i, "blueprint smg"],
  [/blueprint\s*rifle/i, "blueprint rifle"],
  [/esquemas?\s+de\s+armas/i, "esquemas"],
  [/pe[cç]a\s*avan[cç]ada/i, "peca avancada"],
  [/pe[cç]a\s*b[aá]sica/i, "peca basica"],
  // Outros ilegais
  [/colete\s*fortalecido/i, "colete fortalecido"],
  [/colete/i, "colete"],
  [/pager/i, "pager"],
  [/garrafa/i, "garrafa de nitro"],
  [/nitro/i, "nitro"],
  [/adaga/i, "adaga"],
  [/idolo|[ií]dolo/i, "idolo"],
  [/enxofre/i, "enxofre"],
  [/estanho/i, "estanho"],
  [/n[ií]quel/i, "niquel"],
  [/min[eé]rio/i, "minerios"],
  [/chifre/i, "chifres"],
  [/anel/i, "anel"],
  [/corrente/i, "corrente"],
  [/rel[oó]gio/i, "relogio ouro"],
  [/bomba/i, "bomba"],
  [/orca/i, "orca"],
  [/tubar[aã]o\s*martelo/i, "tubarao martelo"],
  [/tubar[aã]o\s*branco/i, "tubarao branco"],
  [/tubar[aã]o/i, "tubarao branco"],
  [/raia/i, "raia"],
  [/polvo/i, "polvo"],
  [/ba[uú]\s*(de\s*)?especiaria/i, "bau"],
  [/di[aá]rio\s*(de\s*)?bordo/i, "diario"],
  [/pacote\s*ilegal/i, "pacote ilegal"],
  [/muni[cç][aã]o/i, "balas baixo"],
  [/bala\b/i, "balas baixo"],
  [/c4/i, "c4"],
  [/pack\s*safira/i, "pack safira"],
  // Pesca
  [/truta/i, "truta"],
  [/salm[aã]o/i, "salmao"],
  [/atum/i, "atum"],
  [/sardinha/i, "sardinha"],
  [/cana\s*(de\s*)?pesca/i, "cana de pesca"],
  [/licen[cç]a\s*(de\s*)?pesca/i, "licenca pesca"],
  // Crafting / Materiais
  [/alum[ií]nio/i, "aluminio"],
  [/borracha/i, "borracha"],
  [/kit\s*repara[cç][aã]o/i, "kit reparacao"],
  // Itens legais comuns
  [/bandagem/i, "bandagem"],
  [/sumo\s*ananas/i, "sumo ananas"],
  [/sumo\s*maracu/i, "sumo maracuja"],
  [/sumo\s*laranja/i, "sumo laranja"],
  [/sumo/i, "sumo"],
  [/bifana/i, "bifana"],
  [/r[aá]dio/i, "radio"],
  [/telem[oó]vel/i, "telemovel"],
  [/petrol\s*can/i, "petrol can"],
  [/tuna\s*deluxe/i, "tuna deluxe"],
  [/tesoura/i, "tesoura"],
  [/peda[cç]o\s*de\s*metal/i, "pedaco de metal"],
  [/fotografia/i, "fotografia"],
  [/cart[aã]o\s*de\s*cidad[aã]o/i, "cartao de cidadao"],
  [/carta\s*de\s*condu[cç][aã]o/i, "carta de conducao"],
  [/cart[aã]o\b/i, "cartao"],
  [/carta\s+de\b/i, "carta de conducao"],
  [/encomenda/i, "encomenda"],
  [/[aá]gua\b/i, "agua"],
  [/medwch[ií]\s*mochi|hedach[ií]\s*mochi/i, "medwchi mochi"],
  [/monoshu|momoshu|moonshine/i, "monoshu"],
  [/saco\s*do\s*gin[aá]sio/i, "saco do ginasio"],
  [/\bhammer\b/i, "hammer"],
  [/casca\s*de\s*banana/i, "casca de banana"],
  [/nobel\s*tudo/i, "nobel tudo"],
  [/caneta/i, "caneta"],
  [/passaporte/i, "passaporte"],
];

// ── Helpers ──────────────────────────────────────────────────────────────
// Linhas de ruído OCR que nunca são nomes de itens (timestamps, peso do
// jogador, header do inventário). Se entrassem na coleção de nomes podiam
// roubar o papel de "linha principal" e desalinhar as quantidades.
const NOISE_LINE_RE =
  /^(\d{1,2}:\d{2}\s*$|peso\s*:.*|jogador\s*[-:].*|(?:invent[aá]rio|mochila|equipamento)\s*$)/i;

function getUnitWeight(itemName: string): number | null {
  const def = ITEM_BY_NAME.get(itemName);
  return def ? def.unitKg : null;
}

function parseQtyWeight(cell: string): { qty: number; totalKg: number | null } {
  const cleaned = cell;
  const m = cleaned.match(/^(\d[\d.,]*)\s*\(\s*([^)]+)\s*\)/);
  if (!m) {
    const q = cleaned.match(/^(\d[\d.,]*)/);
    return {
      qty: q ? Math.round(parseFloat(q[1].replace(/\./g, "").replace(",", ".")) || 1) : 1,
      totalKg: null,
    };
  }
  const qty = Math.round(parseFloat(m[1].replace(/\./g, "").replace(",", ".")) || 1);
  let weightStr = m[2]
    .replace(/B/g, "8")
    .replace(/O/gi, "0")
    .replace(/l/g, "1")
    .replace(/S/g, "5")
    .replace(/G/g, "6")
    .replace(/Z/g, "2")
    .trim();
  let totalKg = parseFloat(weightStr.replace(",", "."));

  if (Number.isFinite(totalKg) && totalKg > 0) {
    const unitWeight = totalKg / qty;
    if (unitWeight > 2 && qty > 1 && !unitWeightMatchesKnown(unitWeight)) {
      const str = String(totalKg);
      for (let pos = 1; pos < str.length; pos++) {
        const candidate = parseFloat(str.slice(0, pos) + "." + str.slice(pos));
        if (Number.isFinite(candidate) && candidate > 0) {
          const candUnit = candidate / qty;
          if (candUnit >= 0.05 && unitWeightMatchesKnown(candUnit)) {
            totalKg = candidate;
            break;
          }
        }
      }
    }
  }

  return { qty, totalKg: Number.isFinite(totalKg) ? totalKg : null };
}

const ALT_WEIGHTS: Record<string, number[]> = {
  "arma medio calibre": [5, 7.5, 10],
  "arma alto calibre": [15, 10],
  "arma baixo calibre": [5, 3],
  // O relógio de ouro pesa 0.1 kg/un no jogo (ex.: 5 un = 0.5 kg), mas alguns
  // screenshots antigos/catálogo apontam 0.2 kg/un. Aceitamos ambos para o
  // peso não "vazar" para outro item com o mesmo peso (ex.: corrente de ouro).
  "relogio ouro": [0.1, 0.2],
};

// Alguns itens pesam >2 kg/un (ex.: mesa química = 5 kg). A correção de
// "ponto decimal perdido" no OCR (ex.: "2 (10.0)" lido como "2 (1.0)") só é
// aplicada quando o resultado bate com um peso conhecido do catálogo.
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

// Peso unitário de referência mais próximo do OCR (primário ou alternativo).
// Ex.: Micro SMG pesa 10 kg e Machine Pistol 5 kg — um mix (5+10) dá 7.5,
// todos pesos válidos de "arma medio calibre".
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
  const normalized = text.trim();
  let best: { name: string; len: number } | null = null;
  for (const [pattern, name] of ITEM_MAP) {
    const m = pattern.exec(normalized);
    if (m && m[0].length > (best ? best.len : -1)) {
      best = { name, len: m[0].length };
    }
  }
  return best ? best.name : normalized.toLowerCase();
}

// ── Split a line into cells ──────────────────────────────────────────────
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
        /^(ANEL|CORRENTE|COLETE|MESA|SACO|LOCKPICK|SUMO|CARREGADOR|DIAMANTE|KIT|MICRO|ASSAULT|MACHINE|BULLPUP|DOUBLE|COMPACT|ADVANCED|TACTICAL|MILITARY|SNS|VINTAGE|AP|COMBAT|FOLHA|CABE[CÇ]O|SEMENTE|[OÓ]LEO|PACOTE|BLUEPRINT|TACO|CHAVE|GARRAFA|PEDACO|CART[AÃ]O|ARMA|TV|BA[UÚ]|DI[AÁ]RIO|CRYPTO|[AÁ]GUIA|TUBAR[AÃ]O|REVOLVER|RIFLE|PETROL|TUNA|LICEN[CÇ]A|CANA|PACK)$/i,
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
// OCR can misread digits inside parentheses as letters (B→8, O→0, S→5, etc.)
// so we must allow letters INSIDE the parenthesised weight portion.
const isNumericCell = (c: string): boolean => {
  if (!/^\d/.test(c)) return false;
  // OCR pode deixar um ponto final a seguir à célula (ex.: "3 (4.5).") —
  // isso não a torna texto.
  const s = c.trim().replace(/\.$/, "");
  // If the cell matches the qty(weight) pattern, it's numeric even with OCR letter misreads
  if (/^\d[\d.,]*\s*\(\s*[^)]+\s*\)$/.test(s)) return true;
  // Plain number without parentheses
  if (/^\d[\d.,]*$/.test(s)) return true;
  // Otherwise, if it contains actual letters outside parens, it's text
  return false;
};
const isTextCell = (c: string) => c.trim() !== "" && !isNumericCell(c);

// ── Merge compound names within a flat list of text cells ──────────────
function mergeCompoundNamesInList(cells: string[]): string[] {
  const step1: string[] = [];
  let i = 0;
  while (i < cells.length) {
    if (i + 1 < cells.length) {
      const mergedStr = cells[i] + " " + cells[i + 1];
      // Only merge if the pattern match actually spans BOTH cells.
      // A substring match of just one cell (e.g. /micro\s*smg/ matching
      // "MICRO SMG" inside "TELEMOVEL MICRO SMG") should NOT trigger merging.
      // The match must cover characters from BOTH the first AND second cell.
      const isCompound = ITEM_MAP.some(([p]) => {
        const m = mergedStr.match(p);
        if (!m) return false;
        // The match must start within the first cell and extend into the second
        const matchStart = m.index ?? 0;
        const matchEnd = matchStart + m[0].length;
        const firstCellEnd = cells[i].length;
        // Match must span the boundary between the two cells
        return matchStart < firstCellEnd && matchEnd > firstCellEnd;
      }) || /^CARREGADOR\s+DE$/i.test(mergedStr);
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
    { first: /^kit$/i, second: /^repara[cç][aã]o$/i, merged: "KIT REPARACAO" },
    { first: /^carregador\s+de$/i, second: /^(pistola|smg|rifle|shotgun)$/i, merged: "CARREGADOR DE $1" },
    { first: /^cart[aã]o\s+de$/i, second: /^cidad[aã]o$/i, merged: "CARTAO DE CIDADAO" },
    { first: /^carta\s+de$/i, second: /^condu[cç][aã]o$/i, merged: "CARTA DE CONDUCAO" },
    { first: /^lockpick$/i, second: /^avan[cç]ad/i, merged: "LOCKPICK AVANCADA" },
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
  return result;
}

// ── Weapon-detail popup parser ───────────────────────────────────────────
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

// Linhas de identificação do popup de arma (nº de série, munição, balas,
// acessórios). São apenas texto de identificação — não são itens do inventário.
const WEAPON_POPUP_FIELD_RE =
  /^(?:n[uú]mero\s+de\s+s[eé]rie|muni[cç][aã]o|\bbalas?|acess[oó]rios?)\s*:/i;

function parseWeaponCapture(text: string): WeaponCapture | null {
  const flat = text.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();

  const isWeaponPopup =
    /n[uú]mero\s+de\s+s[eé]rie\s*:/i.test(flat) ||
    /muni[cç][aã]o\s*:/i.test(flat) ||
    /acess[oó]rios?\s*:/i.test(flat);
  if (!isWeaponPopup) return null;

  const rule = WEAPON_RULES.find((r) => r.pattern.test(flat));
  if (!rule) return null;

  const ammoMatch =
    flat.match(/muni[cç][aã]o\s*:\s*(\d{1,6})/i) ||
    flat.match(/\bbalas?\s*:\s*(\d{1,6})/i);
  const ammo = ammoMatch ? parseInt(ammoMatch[1], 10) : 0;

  let accessoryCount = 0;
  // Primeiro tenta sempre ler a lista explícita depois de "Acessórios:".
  // O regex anterior exigia whitespace antes do fim da string, falhava quando
  // a lista acabava diretamente no último acessório e caía no fallback.
  // Nesse fallback, "Precision Muzzle" também fazia match em "Muzzle",
  // contando o mesmo acessório duas vezes.
  const accessoriesMatch = flat.match(
    /acess[oó]rios?\s*:\s*(.+?)(?=\s+(?:peso|durabilidade|condi[cç][aã]o|valor)\b|$)/i
  );
  if (accessoriesMatch) {
    accessoryCount = accessoriesMatch[1]
      .split(/\s*,\s*/)
      .map((item) => item.trim())
      .filter(Boolean)
      .length;
  } else if (/acess[oó]rios?\s*:/i.test(flat)) {
    const knownAccessoryPatterns = [
      /extended\s*clip/i, /precision\s*muzzle/i, /scope/i, /\bgrip\b/i,
      /flashlight/i, /heavy\s*barrel/i, /suppressor/i, /magazine/i,
    ];
    accessoryCount = knownAccessoryPatterns.filter((p) => p.test(flat)).length;
    // "Muzzle" genérico não é contado separadamente quando já existe
    // "Precision Muzzle". Cada acessório físico vale apenas 1.
  }

  return {
    weapon: rule.pattern.source.replace(/\\s\*/g, " "),
    weaponItem: rule.item,
    ammo,
    ammoItem: rule.ammo,
    accessoryCount,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PARSER
// ══════════════════════════════════════════════════════════════════════════════
export function parseInventoryOCR(rawText: string): ParseResult {
  const correctedText = fixOcrTypos(rawText);
  const weaponCapture = parseWeaponCapture(rawText);
  const merged = new Map<string, number>();
  const weightTotals = new Map<string, number>();
  // Pares "qty (peso)" já atribuídos pelo CORE/PASS 3 — o PASS 4 não pode
  // reutilizá-los noutro item (ex.: "71 (10.7)" é da corrente 10K, não do
  // sumo laranja).
  const consumedPairKeys = new Set<string>();
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
    .filter(Boolean)
    .filter((l) => !NOISE_LINE_RE.test(l))
    .filter((l) => {
      // Quando o OCR é o popup de identificação de uma arma ("Número de Série:",
      // "Munição:", "Acessórios:"), a arma e esses campos são apenas texto de
      // identificação — não são itens do inventário com peso. Exclui essas
      // linhas para não aparecer um "1 arma medio calibre" falso nem um
      // "1 balas baixo" falso derivados da munição (ex.: "Munição: 0").
      if (!weaponCapture) return true;
      if (WEAPON_POPUP_FIELD_RE.test(l)) return false;
      if (WEAPON_RULES.some((r) => r.pattern.test(l))) return false;
      return true;
    });

  interface ParsedLine {
    lineIdx: number;
    cells: string[];
    numCells: { qty: number; totalKg: number | null; cellIdx: number; raw: string }[];
    textCells: { text: string; cellIdx: number }[];
  }

  const parsedLines: ParsedLine[] = lines.map((line, lineIdx) => {
    const cells = splitCells(line);
    const numCells = cells
      .map((c, cellIdx) => ({ ...parseQtyWeight(c), cellIdx, raw: c }))
      .filter((x) => isNumericCell(x.raw));
    const textCells = cells
      .map((c, cellIdx) => ({ text: c, cellIdx }))
      .filter((x) => isTextCell(x.text));
    return { lineIdx, cells, numCells, textCells };
  });

  const usedLines = new Set<number>();

  // ══════════════════════════════════════════════════════════════════════
  // WEAPON GRID DETECTOR
  // ══════════════════════════════════════════════════════════════════════
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

  // If weapon grid took all lines, skip standard parsing
  if (usedLines.size < parsedLines.length) {
    // ── PASS 0: Standalone item names without numeric cells ──────────────
    // Only process text-only lines that are NOT adjacent to a numeric line.
    // If a text line is next to a numeric line, the Core Strategy will pair them.
    const allNumCells = parsedLines.flatMap((pl) => pl.numCells);
    for (let i = 0; i < parsedLines.length; i++) {
      if (usedLines.has(i)) continue;
      const line = parsedLines[i];
      if (line.numCells.length > 0) continue;
      if (line.textCells.length === 0) continue;
      // Check if any adjacent line (within 2 lines) has >= 2 numeric cells.
      // If so, this text line will be collected by the Core Strategy — skip it here.
      let adjacentToNumeric = false;
      for (let d = 1; d <= 2; d++) {
        const above = i - d;
        const below = i + d;
        if (above >= 0 && parsedLines[above].numCells.length >= 2) {
          adjacentToNumeric = true;
          break;
        }
        if (below < parsedLines.length && parsedLines[below].numCells.length >= 2) {
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
          // Se existe uma célula numérica noutro local cujo peso bate com este
          // item, a quantidade real vem dessa célula (Core Strategy / PASS 3) —
          // não adivinhar qty=1 aqui (ex.: "ESTIMULANTE" solto + "102 (20.4)").
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

    // ── CORE STRATEGY ────────────────────────────────────────────────────
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
        if (above >= 0 && parsedLines[above].numCells.length >= 2 && nextNumAbove === -1) {
          nextNumAbove = above;
        }
        if (below < parsedLines.length && parsedLines[below].numCells.length >= 2 && nextNumBelow === parsedLines.length) {
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
          if (adjLine.numCells.length >= 2) break;
          if (adjLine.textCells.length === 0) continue;
          // Allow d=3 text lines even with multiple cells — they may contain
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
        // Se várias linhas têm o número certo de células, preferir a que tem
        // mais nomes de itens reais (evita linhas de ruído OCR, ex.: "1- піо:",
        // ganharem à linha de nomes quando ambas têm a mesma contagem).
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
        { standalonePrefix: /^reparação$/i, mainPart: /kit/i, merged: "KIT REPARACAO" },
        { standalonePrefix: /^carta\s+de$/i, mainPart: /^condu[cç][aã]o$/i, merged: "CARTA DE CONDUCAO" },
        { standalonePrefix: /^cart[aã]o\s+de$/i, mainPart: /^cidad[aã]o$/i, merged: "CARTAO DE CIDADAO" },
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
        { mainCell: /^avan[cç]ada$/i, fragment: /^lockpick$/i, merged: "LOCKPICK AVANCADA" },
        { mainCell: /^cart[aã]o\s+de$/i, fragment: /^cidad[aã]o$/i, merged: "CARTAO DE CIDADAO" },
        { mainCell: /^carta\s+de$/i, fragment: /^condu[cç][aã]o$/i, merged: "CARTA DE CONDUCAO" },
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
        if (qc.totalKg != null) consumedPairKeys.add(qc.qty + "|" + qc.totalKg);
        matched++;
      }

      if (matched > 0) {
        usedLines.add(i);
        for (const li of collectedTextLineIdxs) {
          usedLines.add(li);
        }
      }
    }

    // ── PASS 2: Handle mixed lines (both numbers and text on same line) ──
    for (let i = 0; i < parsedLines.length; i++) {
      if (usedLines.has(i)) continue;
      const line = parsedLines[i];
      if (line.numCells.length === 0 || line.textCells.length === 0) continue;

      const allCellTexts = line.textCells.map((tc) => tc.text);
      const mergedNames = mergeCompoundNamesInList(allCellTexts);
      const usedText = new Set<number>();
      let matched = 0;

      for (const qc of line.numCells) {
        let best: { idx: number; item: string; score: number } | null = null;
        for (let ni = 0; ni < mergedNames.length; ni++) {
          if (usedText.has(ni)) continue;
          const item = matchItemName(mergedNames[ni]);
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
          matched++;
        }
      }
      if (matched > 0) usedLines.add(i);
    }

    // ── PASS 3: Weight-validated recovery for remaining numeric cells ──
    const allTextForPass3 = lines.join(" ");
    for (let i = 0; i < parsedLines.length; i++) {
      if (usedLines.has(i)) continue;
      const line = parsedLines[i];
      for (const qc of line.numCells) {
        if (qc.totalKg == null || qc.totalKg <= 0) continue;
        const computed = qc.totalKg / qc.qty;

        let bestMatch: { name: string; diff: number } | null = null;
        for (const itemDef of ITEM_CATALOG) {
          if (itemDef.unitKg <= 0) continue;
          if (itemDef.name === "cartao" && /cart[aã]o\s*de\b[\s\S]*?\bcidad[aã]o\b/i.test(allTextForPass3)) continue;
          if (itemDef.name === "cartao" && /carta\s*de\b[\s\S]*?\bcondu[cç][aã]o\b/i.test(allTextForPass3)) continue;
          const diff = Math.abs(computed - itemDef.unitKg);
          if (diff > Math.max(0.03, itemDef.unitKg * 0.15)) continue;
          if (merged.has(itemDef.name)) continue;

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
          const nameFound = ITEM_MAP.some(
            ([pattern, name]) => name === itemDef.name && pattern.test(allTextForPass3)
          );
          if (!nameFound) continue;

          if (!bestMatch || diff < bestMatch.diff) {
            bestMatch = { name: itemDef.name, diff };
          }
        }
        if (bestMatch) {
          merged.set(bestMatch.name, (merged.get(bestMatch.name) || 0) + qc.qty);
          weightTotals.set(bestMatch.name, (weightTotals.get(bestMatch.name) || 0) + qc.totalKg);
          consumedPairKeys.add(qc.qty + "|" + qc.totalKg);
          usedLines.add(i);
        }
      }
    }

    // ── PASS 4: Name-based recovery from full text ──
    {
      const allText = lines.join(" ");
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
        if (itemName === "lockpick" && /lockpick[\s\S]*?avan[cç]ad/i.test(allText)) continue;
        if (itemName === "colete" && merged.has("colete fortalecido")) continue;
        if (itemName === "cristal" && /cristal\s*processado/i.test(allText)) continue;
        if (itemName === "colete" && /colete\s*fortalecid/i.test(allText)) continue;
        if (itemName === "diamante" && /diamante\s*bruto/i.test(allText)) continue;
        // Skip generic "diamante" if "anel" (from "anel de diamante") is already matched
        if (itemName === "diamante" && merged.has("anel") && /anel\s*(de\s*)?diamante/i.test(allText)) continue;
        if (itemName === "sumo" && /sumo\s*(maracu|laranja|manga|ananas)/i.test(allText)) continue;
        if (itemName === "sumo" && (merged.has("sumo maracuja") || merged.has("sumo laranja") || merged.has("sumo ananas"))) continue;
        if (itemName === "corrente" && /corrente\s*10k/i.test(allText)) continue;
        // Skip do "cartão" genérico (peso 0.1kg) quando o texto tem "cartão de
        // cidadão" ou "carta de condução" (documentos sem peso) — evita roubar
        // pares (qty, peso) de outros itens (ex.: semente de erva 295 (29.5)).
        if (itemName === "cartao" && /cart[aã]o\s*de\b[\s\S]*?\bcidad[aã]o\b/i.test(allText)) continue;
        if (itemName === "cartao" && /carta\s*de\b[\s\S]*?\bcondu[cç][aã]o\b/i.test(allText)) continue;
        if (!pattern.test(allText)) continue;

        const nameMatch = new RegExp(pattern.source, "i").exec(allText);
        if (!nameMatch) continue;
        const namePos = nameMatch.index;

        let bestPair: (typeof allPairs)[0] | null = null;
        let bestDist = Infinity;
        for (const pair of allPairs) {
          if (pair.matched) continue;
          if (consumedPairKeys.has(pair.qty + "|" + pair.totalKg)) continue;
          const strict = weightMatches(itemName, pair.qty, pair.totalKg);
          const loose = !strict && weightMatchesLoose(itemName, pair.qty, pair.totalKg);
          if (!strict && !loose) continue;
          const dist = Math.abs(pair.pos - namePos);
          if (dist < bestDist) {
            bestDist = dist;
            bestPair = pair;
          }
        }
        if (bestPair) {
          bestPair.matched = true;
          merged.set(itemName, (merged.get(itemName) || 0) + bestPair.qty);
          weightTotals.set(itemName, (weightTotals.get(itemName) || 0) + bestPair.totalKg);
        }
      }
    }
  }

  // ── Build result ──
  // Normaliza nomes (sem acentos) para tolerar diferenças entre o texto OCR
  // (ex.: "kit reparação") e as chaves do catálogo (ex.: "kit reparacao").
  const normKey = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const catalogByNorm = new Map<string, (typeof ITEM_CATALOG)[number]>();
  for (const def of ITEM_CATALOG) catalogByNorm.set(normKey(def.name), def);

  // Remove ruído/truncamentos de OCR que não correspondem a itens reais
  // (ex.: "jogador-", "peso:", "/", "(1 (15.0)"), para que nem o texto nem
  // os pesos os incluam. Todos os itens legítimos estão no catálogo.
  for (const name of [...merged.keys()]) {
    if (!catalogByNorm.has(normKey(name))) merged.delete(name);
  }

  const weights: ItemMatch[] = [];
  for (const [name, qty] of merged.entries()) {
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
      if (deviationPercent < 5) {
        confidence = 95;
        matchReason = `Peso perfeito: ${ocrTotalKg}kg = ${qty}x${refUnit}kg`;
      } else if (deviationPercent < 20) {
        confidence = 80;
        matchReason = `Peso próximo: ${ocrTotalKg}kg ≈ ${qty}x${refUnit}kg`;
      } else {
        confidence = 40;
        matchReason = `Peso divergente: ${ocrTotalKg}kg vs ${qty}x${refUnit}kg`;
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
    .map(([name, qty]) => `${qty} ${name}`)
    .join(", ");

  return { text: resultText, weights, weaponCapture, overallConfidence };
}
