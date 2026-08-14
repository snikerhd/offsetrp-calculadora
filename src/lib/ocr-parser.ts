// ══════════════════════════════════════════════════════════════════════════════
// INVENTORY OCR PARSER — Offset RP
//
// The game inventory OCR produces a grid of quantity/weight cells paired with
// item name cells.  OCR can split compound names across cells AND lines, e.g.:
//   "COLETE" on one line, "FORTALECIDO" embedded in the next line.
//
// STRATEGY:
//   1. Fix OCR typos
//   2. Group lines into "blocks": each block = a numeric row + nearby text rows
//   3. Collect ALL text cells from the text rows, merge compound names
//   4. Match quantity cells to name cells by position (first num ↔ first name)
//   5. Use unit weight as validation, not as primary matching signal
// ══════════════════════════════════════════════════════════════════════════════

import { ITEM_BY_NAME } from "./item-weights";

// ── Types ──────────────────────────────────────────────────────────────────

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
  confidence: number;        // 0-100: How confident we are in this match
  confidenceLevel: "high" | "medium" | "low";
  matchReason: string;       // Why we matched this item
}

export interface ParseResult {
  text: string;
  weights: ItemMatch[];
  weaponCapture: WeaponCapture | null;
  overallConfidence: number; // 0-100: Average confidence across all items
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
    [/\bBTFANA\b/gi, "BIFANA"],
    [/\bSACO\s+PL[AÁ]STICO\b/gi, "SACO PLASTICO"],
    [/\bSACO\s+PLÁSTTCO\b/gi, "SACO PLASTICO"],
    [/\bREBARBADOÍRA\b/gi, "REBARBADORA"],
    [/\bHACO\s+TABACO\b/gi, "MACO TABACO"],
    [/\bMAÇO\s+TABACO\b/gi, "MACO TABACO"],
  ];
  let result = text;
  for (const [pattern, replacement] of typoRules) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

// ── ITEM_MAP: regex → canonical name ───────────────────────────────────────

const ITEM_MAP: [RegExp, string][] = [
  [/lockpick\s*avan[cç]ad/i, "lockpick avancada"],
  [/lockpeck\s*avan[cç]ad/i, "lockpick avancada"],
  // "tem 5 lock" or "lockpick" — match "lock" with nearby context
  [/lockpick|lockpeck/i, "lockpick"],
  // OCR fragments like "tem 5 lock" need to be matched as lockpick
  // (handled specially in the text line)
  [/acess[oó]rio[s]?\s*(para\s*)?arma[s]?/i, "acessorios para armas"],
  [/algema/i, "algemas"],
  [/medikit|medick/i, "medickits"],
  [/mesa\s*quimica/i, "mesa quimica"],
  [/diamante\s*bruto/i, "diamante bruto"],
  // ANEL DE DIAMANTE must come BEFORE generic diamante
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
  // Standalone "10K" / "14K" / "18K" = corrente de ouro N-K (the prefix was
  // OCR'd as a separate cell). Match the karat suffix as corrente 10k.
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
  [/caneta/i, "caneta"],
  [/passaporte/i, "passaporte"],
];

// ── Helpers ────────────────────────────────────────────────────────────────

function getUnitWeight(itemName: string): number | null {
  const def = ITEM_BY_NAME.get(itemName);
  return def ? def.unitKg : null;
}

function parseQtyWeight(cell: string): { qty: number; totalKg: number | null } {
  // Fix common OCR digit misreads BEFORE parsing
  // B→8, O→0, I→1, l→1, S→5, G→6, Z→2
  let cleaned = cell;

  // Match patterns like "1300(130.0)" or "3 (3.0)" or "4 (0.B)" (OCR misread)
  // Extended pattern to allow OCR-misread characters inside the parentheses
  const m = cleaned.match(/^(\d[\d.,]*)\s*\(\s*([^)]+)\s*\)/);
  if (!m) {
    const q = cleaned.match(/^(\d[\d.,]*)/);
    return {
      qty: q ? Math.round(parseFloat(q[1].replace(/\./g, "").replace(",", ".")) || 1) : 1,
      totalKg: null,
    };
  }
  const qty = Math.round(parseFloat(m[1].replace(/\./g, "").replace(",", ".")) || 1);
  // Fix OCR misreads in the weight part: B→8, O→0, l→1, S→5
  let weightStr = m[2]
    .replace(/B/g, "8")
    .replace(/O/gi, "0")
    .replace(/l/g, "1")
    .replace(/S/g, "5")
    .replace(/G/g, "6")
    .replace(/Z/g, "2")
    .trim();
  let totalKg = parseFloat(weightStr.replace(",", "."));

  // OCR sometimes loses the decimal point in weights like "22" instead of "2.2".
  // If qty*totalKg/unit_weight doesn't match any known item, try inserting
  // a decimal point at different positions.
  if (Number.isFinite(totalKg) && totalKg > 0) {
    const unitWeight = totalKg / qty;
    // If computed unit weight is way too high (>2 kg for typical items),
    // try inserting a decimal point
    if (unitWeight > 2 && qty > 1) {
      // Try "X.Y" by inserting decimal at different positions
      const str = String(totalKg);
      for (let pos = 1; pos < str.length; pos++) {
        const withDecimal = str.slice(0, pos) + "." + str.slice(pos);
        const candidate = parseFloat(withDecimal);
        if (Number.isFinite(candidate) && candidate / qty <= 2) {
          // Check if this gives a reasonable unit weight
          if (Math.abs(candidate / qty - 0.1) < 0.02 ||
              Math.abs(candidate / qty - 0.2) < 0.02 ||
              Math.abs(candidate / qty - 0.3) < 0.02 ||
              Math.abs(candidate / qty - 0.5) < 0.05 ||
              Math.abs(candidate / qty - 1.0) < 0.1) {
            totalKg = candidate;
            break;
          }
        }
      }
    }
  }

  return { qty, totalKg: Number.isFinite(totalKg) ? totalKg : null };
}

// Known alternative weights for items where in-game values can differ from catalog
const ALT_WEIGHTS: Record<string, number[]> = {
  "arma medio calibre": [5, 7.5, 10],
  "arma alto calibre": [15, 10],
  "arma baixo calibre": [5, 3],
};

function weightMatches(itemName: string, qty: number, totalKg: number | null): boolean {
  if (totalKg == null || qty <= 0) return false;
  const unitW = getUnitWeight(itemName);
  if (unitW == null) return false;
  if (unitW === 0) return true;
  const computed = totalKg / qty;

  // STRICT primary weight match (5% tolerance, min 0.03 kg)
  if (Math.abs(computed - unitW) <= Math.max(0.03, unitW * 0.05)) return true;

  // Check alternative weights
  const alts = ALT_WEIGHTS[itemName];
  if (alts) {
    for (const alt of alts) {
      if (Math.abs(computed - alt) <= Math.max(0.03, alt * 0.05)) return true;
    }
  }
  return false;
}

// Looser match for fallback (used only when no exact match found)
function weightMatchesLoose(itemName: string, qty: number, totalKg: number | null): boolean {
  if (totalKg == null || qty <= 0) return false;
  const unitW = getUnitWeight(itemName);
  if (unitW == null) return false;
  if (unitW === 0) return true;
  const computed = totalKg / qty;
  if (Math.abs(computed - unitW) <= Math.max(0.03, unitW * 0.15)) return true;
  const alts = ALT_WEIGHTS[itemName];
  if (alts) {
    for (const alt of alts) {
      if (Math.abs(computed - alt) <= Math.max(0.03, alt * 0.15)) return true;
    }
  }
  return false;
}

function matchItemName(name: string): string | null {
  const cleaned = name.replace(/[•·\-_]/g, " ").replace(/\s+/g, " ").trim();
  for (const [pattern, itemName] of ITEM_MAP) {
    if (pattern.test(cleaned)) return itemName;
  }
  return null;
}

// Split a line into cells. OCR can use tabs, 2+ spaces, or single spaces
// between inventory cells. For numeric lines like:
//   "1300(130.0) 1 (1.0) 10 (1.0) 3 (3.0) 1(10.0)"
// we need to split on the boundary between ")" and a digit.
// For text lines like:
//   "CRISTAL MEDIKIT BANDAGEM FORTALECIDO ASSAULT SMG"
// we split on single spaces but keep compound names together.
function splitCells(line: string): string[] {
  // First try tab-based splitting
  if (line.includes("\t")) {
    return line.split(/\t+/).map((c) => c.trim()).filter(Boolean);
  }

  // Try 2+ space splitting
  const bySpaces = line.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
  if (bySpaces.length >= 2) return bySpaces;

  // For numeric lines: split on boundaries between ) and digit, or between
  // digit-paren groups. Pattern: "1300(130.0) 1 (1.0) 10 (1.0)"
  // Allow OCR misreads inside parentheses: B→8, O→0, etc.
  // ALSO: a "standalone number" is only a quantity if it has NO text suffix
  // like "10K" or "1000" alone might be ammo, etc. So require parenthesised weight.
  const numPattern = /\d[\d.,]*\s*\(\s*[^)]+\s*\)/g;
  const numMatches = line.match(numPattern);
  if (numMatches && numMatches.length >= 2) {
    return numMatches;
  }

  // For text lines: split by single space but try to keep compound names
  // together using known patterns
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return words;

  // Check if this looks like a text line (all non-numeric words,
  // or numeric words that end with a letter like "10K" or "100M")
  const allText = words.every((w) => !/^\d+\.?\d*$/.test(w));
  if (allText) {
    // Keep compound names together
    const result: string[] = [];
    let i = 0;
    while (i < words.length) {
      const cur = words[i];
      const next = words[i + 1] || "";
      const next2 = words[i + 2] || "";

      // ASSAULT SMG, MICRO SMG, MACHINE PISTOL
      if (/^(assault|micro|machine)$/i.test(cur) && /^(smg|pistol)$/i.test(next)) {
        result.push(cur + " " + next); i += 2; continue;
      }
      // COLETE FORTALECIDO
      if (/^colete$/i.test(cur) && /^fortalecid/i.test(next)) {
        result.push(cur + " " + next); i += 2; continue;
      }
      // CRISTAL PROCESSADO
      if (/^cristal$/i.test(cur) && /^processad/i.test(next)) {
        result.push(cur + " " + next); i += 2; continue;
      }
      // SACO PLASTICO
      if (/^saco$/i.test(cur) && /^pl[aá]stico$/i.test(next)) {
        result.push(cur + " " + next); i += 2; continue;
      }
      // CARREGADOR DE SMG / PISTOLA / RIFLE / SHOTGUN
      if (/^carregador$/i.test(cur) && /^de$/i.test(next)) {
        if (/^(smg|pistola|rifle|shotgun)$/i.test(next2)) {
          result.push(cur + " " + next + " " + next2); i += 3; continue;
        }
        result.push(cur + " " + next); i += 2; continue;
      }
      // MESA QUIMICA
      if (/^mesa$/i.test(cur) && /^qu[ií]mica$/i.test(next)) {
        result.push(cur + " " + next); i += 2; continue;
      }
      // SUMO MARACUJA
      if (/^sumo$/i.test(cur) && /^maracu/i.test(next)) {
        result.push(cur + " " + next); i += 2; continue;
      }
      // OURO ESTATAL
      if (/^ouro$/i.test(cur) && /^estatal$/i.test(next)) {
        result.push(cur + " " + next); i += 2; continue;
      }
      // LOCKPICK AVANÇADA
      if (/^lockpick$/i.test(cur) && /^avan[cç]ad/i.test(next)) {
        result.push(cur + " " + next); i += 2; continue;
      }
      // CORRENTE DE OURO / CORRENTE DE OURO 10K
      if (/^corrente$/i.test(cur) && /^de$/i.test(next) && /^ouro/i.test(next2)) {
        const next3 = words[i + 3] || "";
        if (/^10k$/i.test(next3)) {
          result.push(cur + " " + next + " " + next2 + " " + next3); i += 4; continue;
        }
        result.push(cur + " " + next + " " + next2); i += 3; continue;
      }
      // RELOGIO DE OURO
      if (/^rel[oó]gio$/i.test(cur) && /^de$/i.test(next) && /^ouro$/i.test(next2)) {
        result.push(cur + " " + next + " " + next2); i += 3; continue;
      }
      // ANEL DE DIAMANTE
      if (/^anel$/i.test(cur) && /^de$/i.test(next) && /^diamante$/i.test(next2)) {
        result.push(cur + " " + next + " " + next2); i += 3; continue;
      }
      // FOLHA TABACO, MACO TABACO
      if (/^(folha|maco|maço)$/i.test(cur) && /^tabaco$/i.test(next)) {
        result.push(cur + " " + next); i += 2; continue;
      }
      // PACOTE DEALER
      if (/^pacote$/i.test(cur) && /^dealer$/i.test(next)) {
        result.push(cur + " " + next); i += 2; continue;
      }
      // DIAMANTE BRUTO
      if (/^diamante$/i.test(cur) && /^bruto$/i.test(next)) {
        result.push(cur + " " + next); i += 2; continue;
      }
      // VINTAGE PISTOL, AP PISTOL, SNS PISTOL
      if (/^(vintage|ap|sns)$/i.test(cur) && /^pistol$/i.test(next)) {
        result.push(cur + " " + next); i += 2; continue;
      }
      // REVOLVER MK 2, RIFLE MK 2, BULLPUP MK 2
      if (/^(revolver|rifle|bullpup)$/i.test(cur) && /^mk$/i.test(next)) {
        if (/^2$/i.test(next2)) {
          result.push(cur + " " + next + " " + next2); i += 3; continue;
        }
        result.push(cur + " " + next); i += 2; continue;
      }
      // COMBAT PDW
      if (/^combat$/i.test(cur) && /^pdw$/i.test(next)) {
        result.push(cur + " " + next); i += 2; continue;
      }
      // DOUBLE BARREL
      if (/^double$/i.test(cur) && /^barrel$/i.test(next)) {
        result.push(cur + " " + next); i += 2; continue;
      }
      // COMPACT RIFLE, ADVANCED RIFLE, MILITARY RIFLE, TACTICAL CARBINE/RIFLE, BULLPUP RIFLE
      if (/^(compact|advanced|military|tactical|bullpup)$/i.test(cur) && /^(rifle|carbine)$/i.test(next)) {
        result.push(cur + " " + next); i += 2; continue;
      }
      // PACK VINHOS, PACK SAFIRA
      if (/^pack$/i.test(cur) && /^(vinhos|safira)$/i.test(next)) {
        result.push(cur + " " + next); i += 2; continue;
      }
      // KIT REPARAÇÃO
      if (/^kit$/i.test(cur) && /^repara[cç][aã]o$/i.test(next)) {
        result.push(cur + " " + next); i += 2; continue;
      }
      // PORTE DE ARMA BRANCA
      if (/^porte$/i.test(cur) && /^de$/i.test(next) && /^arma$/i.test(next2)) {
        const next3 = words[i + 3] || "";
        if (/^branca$/i.test(next3)) {
          result.push(cur + " " + next + " " + next2 + " " + next3); i += 4; continue;
        }
        result.push(cur + " " + next + " " + next2); i += 3; continue;
      }
      // CARTÃO DE CIDADÃO
      if (/^cart[aã]o$/i.test(cur) && /^de$/i.test(next) && /^cidad[aã]o$/i.test(next2)) {
        result.push(cur + " " + next + " " + next2); i += 3; continue;
      }
      // CANA DE PESCA
      if (/^cana$/i.test(cur) && /^de$/i.test(next) && /^pesca$/i.test(next2)) {
        result.push(cur + " " + next + " " + next2); i += 3; continue;
      }
      // LICENÇA PESCA, LICENÇA DE PESCA
      if (/^licen[cç]a$/i.test(cur) && /^(de|pesca)$/i.test(next)) {
        if (/^pesca$/i.test(next)) {
          result.push(cur + " " + next); i += 2; continue;
        }
        if (/^pesca$/i.test(next2)) {
          result.push(cur + " " + next + " " + next2); i += 3; continue;
        }
        result.push(cur + " " + next); i += 2; continue;
      }
      // SUMO LARANJA / SUMO MARACUJA (any juice variant)
    // Don't merge SUMO + LARANJA/MARACUJA by default — they may be separate
    // items in the same row (e.g. BIFANA SUMO LARANJA could mean 3 items)
    // if (/^sumo$/i.test(cur) && /^(laranja|maracu|manga|lim[aã]o)/i.test(next)) {
    //   result.push(cur + " " + next); i += 2; continue;
    // }
      // PEÇA BÁSICA, PEÇA AVANÇADA
      if (/^pe[cç]a$/i.test(cur) && /^(b[aá]sica|avan[cç]ada)$/i.test(next)) {
        result.push(cur + " " + next); i += 2; continue;
      }
      // SNS PISTOL MK2 / SNS PISTOL HK2 (three words)
      if (/^sns$/i.test(cur) && /^pistol$/i.test(next) && /^(mk\s*2|hk\s*2)$/i.test(next2)) {
        result.push(cur + " " + next + " " + next2); i += 3; continue;
      }

      result.push(cur);
      i++;
    }
    return result;
  }

  // Fallback: return the whole line as one cell
  return [line];
}

// A cell is numeric only if it starts with a digit AND ends with a digit
// (or close-paren). "10K", "100M" etc. are NOT numeric — they're name fragments.
const isNumericCell = (c: string) => /^\d/.test(c) && !/[a-zA-Z]/.test(c);
const isTextCell = (c: string) => c.trim() !== "" && !isNumericCell(c);

// ── Merge compound names within a flat list of text cells ──────────────────
// Handles both ADJACENT pairs (CRISTAL + PROCESSADO) and NON-ADJACENT pairs
// (COLETE ... FORTALECIDO) where OCR scattered parts across different positions.
function mergeCompoundNamesInList(cells: string[]): string[] {
  // First pass: merge adjacent pairs
  const step1: string[] = [];
  let i = 0;
  while (i < cells.length) {
    const cur = cells[i];
    const next = cells[i + 1] || "";

    if (/^colete$/i.test(cur) && /^fortalecid[oa]?$/i.test(next)) {
      step1.push("COLETE FORTALECIDO"); i += 2; continue;
    }
    if (/^cristal$/i.test(cur) && /^processad[oa]?$/i.test(next)) {
      step1.push("CRISTAL PROCESSADO"); i += 2; continue;
    }
    if (/^carregador\s+de$/i.test(cur) && /^(pistola|smg|rifle|shotgun)$/i.test(next)) {
      step1.push("CARREGADOR DE " + next.toUpperCase()); i += 2; continue;
    }
    if (/^lockpick$/i.test(cur) && /^avan[cç]ad[ao]?$/i.test(next)) {
      step1.push("LOCKPICK AVANCADA"); i += 2; continue;
    }
    if (/^ouro$/i.test(cur) && /^estatal$/i.test(next)) {
      step1.push("OURO ESTATAL"); i += 2; continue;
    }
    if (/^corrente\s+de$/i.test(cur) && /^ouro(?:\s+10k)?$/i.test(next)) {
      step1.push("CORRENTE DE " + next.toUpperCase()); i += 2; continue;
    }
    if (/^assault$/i.test(cur) && /^smg$/i.test(next)) {
      step1.push("ASSAULT SMG"); i += 2; continue;
    }
    if (/^micro$/i.test(cur) && /^smg$/i.test(next)) {
      step1.push("MICRO SMG"); i += 2; continue;
    }
    if (/^machine$/i.test(cur) && /^pistol$/i.test(next)) {
      step1.push("MACHINE PISTOL"); i += 2; continue;
    }
    if (/^saco$/i.test(cur) && /^pl[aá]stico$/i.test(next)) {
      step1.push("SACO PLASTICO"); i += 2; continue;
    }
    if (/^mesa$/i.test(cur) && /^qu[ií]mica$/i.test(next)) {
      step1.push("MESA QUIMICA"); i += 2; continue;
    }
    // PORTE DE ARMA + BRANCA
    if (/^porte\s+de\s+arma$/i.test(cur) && /^branca$/i.test(next)) {
      step1.push("PORTE DE ARMA BRANCA"); i += 2; continue;
    }
    // CARTÃO DE + CIDADÃO
    if (/^cart[aã]o\s+de$/i.test(cur) && /^cidad[aã]o$/i.test(next)) {
      step1.push("CARTAO DE CIDADAO"); i += 2; continue;
    }
    // KIT + REPARAÇÃO
    if (/^kit$/i.test(cur) && /^repara[cç][aã]o$/i.test(next)) {
      step1.push("KIT REPARACAO"); i += 2; continue;
    }
    // CANA DE + PESCA
    if (/^cana\s+de$/i.test(cur) && /^pesca$/i.test(next)) {
      step1.push("CANA DE PESCA"); i += 2; continue;
    }
    // LICENÇA + PESCA
    if (/^licen[cç]a$/i.test(cur) && /^pesca$/i.test(next)) {
      step1.push("LICENCA PESCA"); i += 2; continue;
    }
    // PEÇA + BÁSICA/AVANÇADA
    if (/^pe[cç]a$/i.test(cur) && /^b[aá]sica$/i.test(next)) {
      step1.push("PECA BASICA"); i += 2; continue;
    }
    if (/^pe[cç]a$/i.test(cur) && /^avan[cç]ada$/i.test(next)) {
      step1.push("PECA AVANCADA"); i += 2; continue;
    }

    step1.push(cur);
    i++;
  }

  // Second pass: merge NON-ADJACENT compound name pairs.
  // OCR can scatter "COLETE" and "FORTALECIDO" with other items between them.
  // We find both parts anywhere in the list and merge them, removing the
  // second part. The merged name replaces the first part's position.
  const nonAdjacentRules: { first: RegExp; second: RegExp; merged: string }[] = [
    { first: /^colete$/i, second: /^fortalecid[oa]?$/i, merged: "COLETE FORTALECIDO" },
    { first: /^cristal$/i, second: /^processad[oa]?$/i, merged: "CRISTAL PROCESSADO" },
    { first: /^ouro$/i, second: /^estatal$/i, merged: "OURO ESTATAL" },
    { first: /^carregador\s+de$/i, second: /^(smg|pistola|rifle|shotgun)$/i, merged: "CARREGADOR DE $1" },
    { first: /^porte\s+de\s+arma$/i, second: /^branca$/i, merged: "PORTE DE ARMA BRANCA" },
    { first: /^cart[aã]o\s+de$/i, second: /^cidad[aã]o$/i, merged: "CARTAO DE CIDADAO" },
  ];

  let result = [...step1];
  for (const rule of nonAdjacentRules) {
    // Already merged in step1? Skip.
    const mergedEsc = rule.merged.replace(/\$\d/g, "\\w+");
    if (result.some((c) => new RegExp(mergedEsc, "i").test(c))) continue;

    const firstIdx = result.findIndex((c) => rule.first.test(c));
    const secondIdx = result.findIndex((c) => rule.second.test(c));
    if (firstIdx >= 0 && secondIdx >= 0 && firstIdx !== secondIdx) {
      // Support $1 substitution from second part's match
      let mergedName = rule.merged;
      const m = result[secondIdx].match(rule.second);
      if (m && m[1]) {
        mergedName = mergedName.replace("$1", m[1].toUpperCase());
      }
      result[firstIdx] = mergedName;
      result.splice(secondIdx, 1);
    }
  }

  return result;
}

// ── Weapon-detail popup parser ─────────────────────────────────────────────

function parseWeaponCapture(text: string): WeaponCapture | null {
  const flat = text.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  const weaponRules: { pattern: RegExp; item: WeaponCapture["weaponItem"]; ammo: WeaponCapture["ammoItem"] }[] = [
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

  const isWeaponPopup =
    /n[uú]mero\s+de\s+s[eé]rie\s*:/i.test(flat) ||
    /muni[cç][aã]o\s*:/i.test(flat) ||
    /acess[oó]rios?\s*:/i.test(flat);
  if (!isWeaponPopup) return null;

  const rule = weaponRules.find((r) => r.pattern.test(flat));
  if (!rule) return null;

  const ammoMatch =
    flat.match(/muni[cç][aã]o\s*:\s*(\d{1,6})/i) ||
    flat.match(/\bbalas?\s*:\s*(\d{1,6})/i);
  const ammo = ammoMatch ? parseInt(ammoMatch[1], 10) : 0;

  let accessoryCount = 0;
  const accessoriesMatch = flat.match(
    /acess[oó]rios?\s*:\s*(.+?)(?=\s+(?:peso|durabilidade|condi[cç][aã]o|valor|$))/i
  );
  if (accessoriesMatch) {
    accessoryCount = accessoriesMatch[1].split(/\s*,\s*/).filter(Boolean).length;
  } else if (/acess[oó]rios?\s*:/i.test(flat)) {
    const knownAccessoryPatterns = [
      /extended\s*clip/i, /precision\s*muzzle/i, /scope/i, /\bgrip\b/i,
      /flashlight/i, /heavy\s*barrel/i, /suppressor/i, /muzzle/i, /magazine/i,
    ];
    accessoryCount = knownAccessoryPatterns.filter((p) => p.test(flat)).length;
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

  // If weapon capture popup (shows "Número de Série" + "Munição"), the arma
  // was already counted from the inventory photo — only register the ammo
  // (and accessories) here, never add +1 to the weapon count again.
  if (weaponCapture) {
    if (weaponCapture.ammo > 0) {
      merged.set(weaponCapture.ammoItem, (merged.get(weaponCapture.ammoItem) || 0) + weaponCapture.ammo);
    }
    if (weaponCapture.accessoryCount > 0) {
      merged.set("acessorios para armas", (merged.get("acessorios para armas") || 0) + weaponCapture.accessoryCount);
    }
  }

  const lines = correctedText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // Parse each line into cells
  interface ParsedLine {
    lineIdx: number;
    cells: string[];
    numCells: { qty: number; totalKg: number | null; cellIdx: number; raw: string }[];
    textCells: { text: string; cellIdx: number }[];
  }

  const parsedLines: ParsedLine[] = lines.map((line, lineIdx) => {
    const cells = splitCells(line);
    if (process.env.DEBUG_PARSER) console.log(`splitCells[${lineIdx}] = ${JSON.stringify(cells)}`);
    const numCells = cells
      .map((c, cellIdx) => ({ ...parseQtyWeight(c), cellIdx, raw: c }))
      .filter((x) => isNumericCell(x.raw));
    const textCells = cells
      .map((c, cellIdx) => ({ text: c, cellIdx }))
      .filter((x) => isTextCell(x.text));
    return { lineIdx, cells, numCells, textCells };
  });

  const usedLines = new Set<number>();

  // ══════════════════════════════════════════════════════════════════════════
  // WEAPON GRID DETECTOR
  // ══════════════════════════════════════════════════════════════════════════
  // A weapon grid is an inventory screenshot showing multiple weapons.
  // Format:
  //   1 (5.0)   1 (5.0)   1 (15.0)   1 (5.0)     ← qty (weight) cells
  //   100   BULLPUP RIFLE                           ← durability + name
  //   VINTAGE PISTOL   MACHINE PISTOL   HK2         ← weapon names
  //
  // Standalone numbers like "100" next to weapon names are the weapon's
  // DURABILITY / CONDITION (estado), NOT quantity. When durability reaches
  // 0 the weapon breaks. These must NEVER be treated as weapon counts.
  //
  // Detection: Many "1 (5.0)" or "1 (15.0)" cells + known weapon names.
  // Each weapon name = 1 occurrence. Standalone numbers = durability (ignored).
  // SNS PISTOL HK2 = 2 weapons (1 baixo + 1 medio).
  {
    const flatText = lines.join(" ").replace(/\s+/g, " ");

    // Known weapon name patterns → calibre class
    const WEAPON_NAMES: { pattern: RegExp; calibre: "baixo" | "medio" | "alto" }[] = [
      // Baixo calibre
      { pattern: /\bSNS\s+PISTOL\s+MK\s*2\b/gi, calibre: "baixo" },
      { pattern: /\bSNS\s+PISTOL\b/gi, calibre: "baixo" },
      { pattern: /\bVINTAGE\s+PISTOL\b/gi, calibre: "baixo" },
      { pattern: /\bPISTOL\s*\.?\s*50\b/gi, calibre: "baixo" },
      { pattern: /\bREVOLVER\s+MK\s*2\b/gi, calibre: "baixo" },
      { pattern: /\bAP\s+PISTOL\b/gi, calibre: "baixo" },
      // Medio calibre
      { pattern: /\bMACHINE\s+PISTOL\b/gi, calibre: "medio" },
      { pattern: /\bHK\s*2\b/gi, calibre: "medio" },
      { pattern: /\bMICRO\s+SMG\b/gi, calibre: "medio" },
      { pattern: /\bCOMBAT\s+PDW\b/gi, calibre: "medio" },
      { pattern: /\bASSAULT\s+SMG\b/gi, calibre: "medio" },
      // Alto calibre
      { pattern: /\bBULLPUP\s+RIFLE\b/gi, calibre: "alto" },
      { pattern: /\bGUSENBERG\b/gi, calibre: "alto" },
      { pattern: /\bDOUBLE\s+BARREL\b/gi, calibre: "alto" },
      { pattern: /\bCOMPACT\s+RIFLE\b/gi, calibre: "alto" },
      { pattern: /\bADVANCED\s+RIFLE\b/gi, calibre: "alto" },
      { pattern: /\bSPAS[\s-]*12\b/gi, calibre: "alto" },
      { pattern: /\bTACTICAL\s+(CARBINE|RIFLE)\b/gi, calibre: "alto" },
      { pattern: /\bMILITARY\s+RIFLE\b/gi, calibre: "alto" },
    ];

    // Count weapon-weight cells: 1 (5.0) or 1 (15.0)
    const weaponWeightCells = parsedLines.reduce((count, pl) =>
      count + pl.numCells.filter(nc =>
        nc.qty === 1 && nc.totalKg != null && (
          Math.abs(nc.totalKg - 5) < 0.5 ||
          Math.abs(nc.totalKg - 15) < 0.5 ||
          Math.abs(nc.totalKg - 10) < 0.5 ||
          Math.abs(nc.totalKg - 7.5) < 0.5
        )
      ).length, 0
    );

    // Count how many known weapon names appear
    let totalWeaponNames = 0;
    for (const wn of WEAPON_NAMES) {
      const matches = flatText.match(wn.pattern);
      if (matches) totalWeaponNames += matches.length;
    }

    // This is a weapon grid if:
    // - At least 3 weapon-weight cells (1 (5.0) etc.)
    // - At least 3 recognized weapon names
    const isWeaponGrid = weaponWeightCells >= 3 && totalWeaponNames >= 3;

    if (isWeaponGrid) {
      // Count each weapon occurrence in the text
      let baixo = 0;
      let medio = 0;
      let alto = 0;

      // Special case: "SNS PISTOL HK2" = 1 baixo + 1 medio
      // Must be counted BEFORE the individual patterns
      const snsHk2Pattern = /\bSNS\s+PISTOL\s+HK\s*2\b/gi;
      const snsHk2Matches = flatText.match(snsHk2Pattern);
      const snsHk2Count = snsHk2Matches ? snsHk2Matches.length : 0;
      if (snsHk2Count > 0) {
        baixo += snsHk2Count; // SNS PISTOL part = baixo
        medio += snsHk2Count; // HK2 part = medio
      }

      // Remove SNS PISTOL HK2 from text to avoid double-counting
      let cleanText = flatText.replace(snsHk2Pattern, "___COUNTED___");

      // Also handle "SNS PISTOL MK2" → just 1 baixo (not a dual weapon)
      const snsMk2Pattern = /\bSNS\s+PISTOL\s+MK\s*2\b/gi;
      const snsMk2Matches = cleanText.match(snsMk2Pattern);
      const snsMk2Count = snsMk2Matches ? snsMk2Matches.length : 0;
      baixo += snsMk2Count;
      cleanText = cleanText.replace(snsMk2Pattern, "___COUNTED___");

      // Now count remaining weapon names individually
      // The order here matters: most specific patterns first
      const countRules: { pattern: RegExp; calibre: "baixo" | "medio" | "alto" }[] = [
        // Baixo
        { pattern: /\bSNS\s+PISTOL\b/gi, calibre: "baixo" },
        { pattern: /\bVINTAGE\s+PISTOL\b/gi, calibre: "baixo" },
        { pattern: /\bPISTOL\s*\.?\s*50\b/gi, calibre: "baixo" },
        { pattern: /\bREVOLVER\s+MK\s*2\b/gi, calibre: "baixo" },
        { pattern: /\bAP\s+PISTOL\b/gi, calibre: "baixo" },
        // Medio — must count HK2 carefully (exclude "SNS PISTOL HK2" already counted)
        { pattern: /\bMACHINE\s+PISTOL\b/gi, calibre: "medio" },
        { pattern: /\bHK\s*2\b/gi, calibre: "medio" },
        { pattern: /\bMICRO\s+SMG\b/gi, calibre: "medio" },
        { pattern: /\bCOMBAT\s+PDW\b/gi, calibre: "medio" },
        { pattern: /\bASSAULT\s+SMG\b/gi, calibre: "medio" },
        // Alto
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

      for (const rule of countRules) {
        const matches = cleanText.match(rule.pattern);
        const count = matches ? matches.length : 0;
        if (count > 0) {
          if (rule.calibre === "baixo") baixo += count;
          else if (rule.calibre === "medio") medio += count;
          else alto += count;
          // Remove matched text to avoid double-counting by overlapping patterns
          cleanText = cleanText.replace(rule.pattern, "___COUNTED___");
        }
      }

      // Set quantities (overwrite anything from generic parsing)
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

      // Mark ALL lines as used — the weapon grid is fully handled
      for (let li = 0; li < parsedLines.length; li++) {
        usedLines.add(li);
      }
    }
  }

  // ── PRE-PASS 0: Extract embedded quantities from fragmented text ─────────
  // OCR sometimes embeds quantities in the middle of text lines like:
  //   "AVANÇADA  PACOTE DEALER  tem 5 lock  2 (0.4)  15 (3.0)  ..."
  // "tem 5 lock" means "has 5 lockpicks". These fragments need special handling.
  {
    const allText = lines.join(" ");
    const extractPatterns: { pattern: RegExp; item: string }[] = [
      { pattern: /tem\s+(\d+)\s+lock/i, item: "lockpick" },
      { pattern: /tem\s+(\d+)\s+colete/i, item: "colete" },
      { pattern: /tem\s+(\d+)\s+(arma|gun|revolver|pistol)/i, item: "arma medio calibre" },
    ];
    for (const ep of extractPatterns) {
      const m = allText.match(ep.pattern);
      if (!m) continue;
      const qty = parseInt(m[1], 10);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      const item = ep.item;
      // Don't overwrite if already found correctly
      if (merged.has(item) && merged.get(item)! >= qty) continue;
      const unitW = getUnitWeight(item);
      if (unitW != null && unitW > 0) {
        const totalKg = qty * unitW;
        merged.set(item, qty);
        weightTotals.set(item, totalKg);
      }
    }
  }

  // ── CORE STRATEGY ──────────────────────────────────────────────────────────
  // Find each numeric-only line, then collect ALL text cells from nearby
  // text-only lines. Merge compound names. Then use WEIGHT-VALIDATED matching:
  // for each quantity cell, find the name whose known unit weight best matches
  // totalKg / qty. This is more reliable than positional matching when OCR
  // reorders cells across lines.

  for (let i = 0; i < parsedLines.length; i++) {
    if (usedLines.has(i)) continue;
    const line = parsedLines[i];

    // Skip lines that are not predominantly numeric
    if (line.numCells.length < 2 || line.textCells.length > 0) continue;

    // Collect text cells from nearby text-only lines.
    // CRITICAL:
    //   1. Each numeric row pairs with EXACTLY ONE text row (immediately
    //      adjacent). Don't look in both directions.
    //   2. Stop collecting when we hit another numeric line.
    //   3. Standalone cells from very close (d=2) lines are compound-name
    //      fragments to be merged (e.g., "COLETE" before "FORTALECIDO").
    const textLineData: { lineIdx: number; cells: string[] }[] = [];
    const collectedTextLineIdxs: number[] = [];

    // Collect text cells from text-only lines. We need to distinguish:
    //   - The MAIN label line (cell count == numeric cell count)
    //   - Compound-name fragments (cell count 1-2, e.g. "COLETE" line)
    //   - Mixed lines with some text (still useful for fragment matching)
    const numCellCount = line.numCells.length;

    // Look in BOTH directions for d=1, d=2.
    // CRITICAL: Only collect text lines that are BETWEEN the current numeric
    // line and the next numeric line. This prevents mixing text from
    // different inventory blocks.
    // First, find the next numeric line in each direction.
    let nextNumInDirection: number[] = [parsedLines.length, -1];
    for (const direction of [1, -1]) {
      for (let d = 1; d <= 5; d++) {
        const adj = i + d * direction;
        if (adj < 0 || adj >= parsedLines.length) break;
        if (parsedLines[adj].numCells.length >= 2) {
          if (direction === 1) nextNumInDirection[0] = adj;
          else nextNumInDirection[1] = adj;
          break;
        }
      }
    }

    // Now collect text lines only within the current block
    for (const direction of [1, -1]) {
      const limit = direction === 1 ? nextNumInDirection[0] : nextNumInDirection[1];
      // For direction -1, if there's NO previous numeric, still allow
      // collecting the very first text line (limit = -1) — it may contain
      // item names that don't have a paired numeric row visible in the OCR.
      // We collect up to the FIRST line only.
      const allowFirstLine = direction === -1 && limit === -1;
      for (let d = 1; d <= 4; d++) {
        const adj = i + d * direction;
        if (adj < 0 || adj >= parsedLines.length) break;
        if (direction === 1 && adj >= limit) break;
        // If we have a limit, stop at it
        if (direction === -1 && limit !== -1 && adj <= limit) break;
        if (usedLines.has(adj)) continue;
        const adjLine = parsedLines[adj];
        if (adjLine.textCells.length === 0) continue;

        // For "first text line" mode, only collect d=1
        if (allowFirstLine && d > 1) break;

        textLineData.push({
          lineIdx: adj,
          cells: adjLine.textCells.map((tc) => tc.text),
        });
        collectedTextLineIdxs.push(adj);
      }
    }

    if (textLineData.length === 0) continue;

    // PREFER the main line that has EXACTLY the same number of cells as
    // the numeric line. This is the strongest evidence of column alignment.
    const numCellCount2 = line.numCells.length;
    if (process.env.DEBUG_PARSER) {
      console.log(`textLineData: ${textLineData.length} lines, numCellCount=${numCellCount2}`);
      for (const t of textLineData) console.log(`  line ${t.lineIdx} (${t.cells.length} cells): ${JSON.stringify(t.cells)}`);
    }
    const exactMatch = textLineData.find(t => t.cells.length === numCellCount2);
    if (exactMatch) {
      // Move the exact match to the front
      const idx = textLineData.indexOf(exactMatch);
      textLineData.splice(idx, 1);
      textLineData.unshift(exactMatch);
      if (process.env.DEBUG_PARSER) console.log(`  → Using exact match: line ${exactMatch.lineIdx}`);
    } else {
      // Otherwise, sort by cells desc (most cells = main)
      textLineData.sort((a, b) => b.cells.length - a.cells.length);
      if (process.env.DEBUG_PARSER) console.log(`  → No exact match, using most cells: line ${textLineData[0].lineIdx}`);
    }
    const mainLine = textLineData[0];
    const standaloneFragments: string[] = [];
    for (let tl = 1; tl < textLineData.length; tl++) {
      for (const cell of textLineData[tl].cells) {
        standaloneFragments.push(cell);
      }
    }

    // Build the name list: start with main line cells, then merge compounds.
    // For compound names where part A is standalone and part B is in the main line,
    // replace part B with the merged name (A+B) at part B's position.
    const mainCells = [...mainLine.cells];

    // Compound merge rules for standalone → main line merging.
    // "standalone" = text on a separate line (e.g. "COLETE", "CARREGADOR DE")
    // "mainPart"   = matching cell on the main line (e.g. "FORTALECIDO", "SMG")
    const compoundRules: { standalone: RegExp; mainPart: RegExp; merged: string }[] = [
      { standalone: /^colete$/i, mainPart: /^fortalecid[oa]?$/i, merged: "COLETE FORTALECIDO" },
      { standalone: /^cristal$/i, mainPart: /^processad[oa]?$/i, merged: "CRISTAL PROCESSADO" },
      { standalone: /^ouro$/i, mainPart: /^estatal$/i, merged: "OURO ESTATAL" },
      // "CARREGADOR DE" on standalone line + "SMG"/"PISTOLA"/"RIFLE"/"SHOTGUN" on main
      { standalone: /^carregador\s+de$/i, mainPart: /^smg$/i, merged: "CARREGADOR DE SMG" },
      { standalone: /^carregador\s+de$/i, mainPart: /^pistola$/i, merged: "CARREGADOR DE PISTOLA" },
      { standalone: /^carregador\s+de$/i, mainPart: /^rifle$/i, merged: "CARREGADOR DE RIFLE" },
      { standalone: /^carregador\s+de$/i, mainPart: /^shotgun$/i, merged: "CARREGADOR DE SHOTGUN" },
      // "PORTE DE ARMA" + "BRANCA" (legal item, but merge name correctly)
      { standalone: /^porte\s+de\s+arma$/i, mainPart: /^branca$/i, merged: "PORTE DE ARMA BRANCA" },
      // "CARTÃO DE" + "CIDADÃO"
      { standalone: /^cart[aã]o\s+de$/i, mainPart: /^cidad[aã]o$/i, merged: "CARTAO DE CIDADAO" },
      // "LOCKPICK" + "AVANÇADA"
      { standalone: /^lockpick$/i, mainPart: /^avan[cç]ad[oa]?$/i, merged: "LOCKPICK AVANCADA" },
    ];

    const usedFragments = new Set<number>();
    for (let fi = 0; fi < standaloneFragments.length; fi++) {
      const frag = standaloneFragments[fi];
      for (const rule of compoundRules) {
        if (!rule.standalone.test(frag)) continue;
        const mainIdx = mainCells.findIndex((c) => rule.mainPart.test(c));
        if (mainIdx >= 0) {
          mainCells[mainIdx] = rule.merged;
          usedFragments.add(fi);
          break;
        }
      }
    }

    // REVERSE: mainPart on standalone, standalonePrefix on main line
    // e.g. "BRANCA" on standalone, "PORTE DE ARMA" on main line
    const reverseRules: { mainCell: RegExp; fragment: RegExp; merged: string }[] = [
      { mainCell: /^carregador\s+de$/i, fragment: /^smg$/i, merged: "CARREGADOR DE SMG" },
      { mainCell: /^carregador\s+de$/i, fragment: /^pistola$/i, merged: "CARREGADOR DE PISTOLA" },
      { mainCell: /^carregador\s+de$/i, fragment: /^rifle$/i, merged: "CARREGADOR DE RIFLE" },
      { mainCell: /^carregador\s+de$/i, fragment: /^shotgun$/i, merged: "CARREGADOR DE SHOTGUN" },
      { mainCell: /^porte\s+de\s+arma$/i, fragment: /^branca$/i, merged: "PORTE DE ARMA BRANCA" },
      { mainCell: /^cart[aã]o\s+de$/i, fragment: /^cidad[aã]o$/i, merged: "CARTAO DE CIDADAO" },
    ];
    for (let mi = 0; mi < mainCells.length; mi++) {
      for (const rule of reverseRules) {
        if (!rule.mainCell.test(mainCells[mi])) continue;
        const fi = standaloneFragments.findIndex((f, idx) => !usedFragments.has(idx) && rule.fragment.test(f));
        if (fi >= 0) {
          mainCells[mi] = rule.merged;
          usedFragments.add(fi);
          break;
        }
      }
    }

    // Add remaining standalone fragments that weren't part of compound names
    const allCells: string[] = [...mainCells];
    for (let fi = 0; fi < standaloneFragments.length; fi++) {
      if (!usedFragments.has(fi)) {
        allCells.push(standaloneFragments[fi]);
      }
    }

    // (10K cells are now directly recognized as "corrente 10k" via pattern)

    // Apply within-list compound merging for adjacent pairs in the combined list
    const mergedNames = mergeCompoundNamesInList(allCells);

    // Resolve each name to a canonical item
    const nameItems: { idx: number; name: string; item: string | null }[] =
      mergedNames.map((name, idx) => ({ idx, name, item: matchItemName(name) }));

    // WEIGHT-FIRST MATCHING: For each quantity cell, find the best item
    // by comparing totalKg/qty against known unit weights. Weight is the
    // primary signal; positional proximity is secondary (tiebreaker).
    const numCells = line.numCells;
    let matched = 0;
    const usedNameIdxs = new Set<number>();
    const assignments: { qIdx: number; nIdx: number; item: string; qty: number; totalKg: number | null }[] = [];

    // Build a score matrix and use greedy best-first assignment
    const candidates: { qIdx: number; nIdx: number; item: string; score: number }[] = [];

    for (let qi = 0; qi < numCells.length; qi++) {
      const qc = numCells[qi];
      for (const ni of nameItems) {
        if (!ni.item) continue;
        let score = 0;

        // Weight match is worth 1000 points
        if (qc.totalKg != null && qc.qty > 0) {
          if (weightMatches(ni.item, qc.qty, qc.totalKg)) {
            score += 1000;
          } else {
            // Penalize weight mismatch
            const unitW = getUnitWeight(ni.item);
            if (unitW != null && unitW > 0) {
              const computed = qc.totalKg / qc.qty;
              const ratio = Math.abs(computed - unitW) / unitW;
              if (ratio > 0.5) score -= 500; // Strong mismatch
              else score -= ratio * 200;
            }
          }
        }

        // Positional proximity bonus (very strong tiebreaker)
        // When weight matches, prefer the qty at the SAME position as the name.
        // This is critical for items with the same unit weight (e.g. bifana/sumo).
        score -= Math.abs(ni.idx - qi) * 50;

        candidates.push({ qIdx: qi, nIdx: ni.idx, item: ni.item, score });
      }
    }

    // Sort by score descending, greedily assign.
    // Only accept assignments with a non-negative score (i.e., weight must
    // match or at least not strongly conflict).
    candidates.sort((a, b) => b.score - a.score);
    const usedQ = new Set<number>();

    if (process.env.DEBUG_PARSER) {
      console.log("Main line cells:", mainLine.cells);
      console.log("Top candidates:", candidates.slice(0, 5).map(c => `q${c.qIdx}→n${c.nIdx}(${c.item})=${c.score}`).join(" "));
    }

    for (const c of candidates) {
      if (c.score < 0) continue; // Skip weak/conflicting matches
      if (usedQ.has(c.qIdx) || usedNameIdxs.has(c.nIdx)) continue;
      usedQ.add(c.qIdx);
      usedNameIdxs.add(c.nIdx);

      if (process.env.DEBUG_PARSER) {
        console.log(`  ASSIGN q${c.qIdx}→n${c.nIdx}(${c.item}) score=${c.score}`);
      }

      const qc = numCells[c.qIdx];
      assignments.push({
        qIdx: c.qIdx,
        nIdx: c.nIdx,
        item: c.item,
        qty: qc.qty,
        totalKg: qc.totalKg,
      });
      matched++;
    }

    for (const a of assignments) {
      merged.set(a.item, (merged.get(a.item) || 0) + a.qty);
      if (a.totalKg != null) {
        weightTotals.set(a.item, (weightTotals.get(a.item) || 0) + a.totalKg);
      }
    }

    if (matched > 0) {
      usedLines.add(i);
      for (const li of collectedTextLineIdxs) {
        usedLines.add(li);
      }
    }
  }

  // Collect all quantity-weight strings used in pass 1 so pass 4 doesn't reuse them
  const pass1UsedPairs = new Set<string>();
  {
    const allText = lines.join(" ");
    for (const [name, totalKg] of weightTotals.entries()) {
      if (!totalKg) continue;
      // Find a pair in the text that matches this qty*weight
      const unitW = getUnitWeight(name);
      if (unitW == null || unitW === 0) continue;
      const qty = merged.get(name);
      if (!qty) continue;
      // Check if this exact pair exists in the OCR text
      // Convert totalKg to a regex that matches both "6" and "6.0"
      const weightPattern = totalKg.toString().replace(".", "[.,]") + (totalKg % 1 === 0 ? "(?:[.,]0)?" : "");
      const pattern = new RegExp(`\\b${qty}\\s*\\(\\s*${weightPattern}\\s*\\)`, "i");
      const m = allText.match(pattern);
      if (m) {
        pass1UsedPairs.add(m[0].replace(/\s+/g, " "));
      }
    }
  }

  // ── PASS 2: Handle mixed lines (both numbers and text on same line) ──────

  for (let i = 0; i < parsedLines.length; i++) {
    if (usedLines.has(i)) continue;
    const line = parsedLines[i];

    if (line.numCells.length === 0 || line.textCells.length === 0) continue;

    // Merge compound names within cells of this line
    const allCellTexts = line.textCells.map((tc) => tc.text);
    const mergedNames = mergeCompoundNamesInList(allCellTexts);

    const usedText = new Set<number>();
    let matched = 0;

    for (const qc of line.numCells) {
      let best: { idx: number; item: string; score: number } | null = null;
      for (let ni = 0; ni < mergedNames.length; ni++) {
        if (usedText.has(ni)) continue;
        const item = matchItemName(mergedNames[ni]);
        if (!item) continue;
        let score = 0;
        score -= Math.abs(ni - line.numCells.indexOf(qc)) * 10;
        if (weightMatches(item, qc.qty, qc.totalKg)) score += 100;
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

  // ── PASS 3: Weight-validated recovery for remaining numeric cells ────────
  // Use the ENTIRE OCR text for name matching (not just nearby lines),
  // since isolated numeric cells like "1 (0.7)" may be far from their label.

  const allTextForPass3 = lines.join(" ");
  for (let i = 0; i < parsedLines.length; i++) {
    if (usedLines.has(i)) continue;
    const line = parsedLines[i];
    if (line.numCells.length === 0) continue;

    for (const qc of line.numCells) {
      if (qc.totalKg == null || qc.qty <= 0) continue;
      const computed = qc.totalKg / qc.qty;

      let bestMatch: { item: string; diff: number } | null = null;
      for (const [, itemDef] of ITEM_BY_NAME) {
        if (itemDef.unitKg <= 0) continue;
        const diff = Math.abs(computed - itemDef.unitKg);
        if (diff > Math.max(0.03, itemDef.unitKg * 0.15)) continue;
        if (merged.has(itemDef.name)) continue;

        // Check alt weights too
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
          bestMatch = { item: itemDef.name, diff };
        }
      }

      if (bestMatch) {
        merged.set(bestMatch.item, (merged.get(bestMatch.item) || 0) + qc.qty);
        weightTotals.set(bestMatch.item, (weightTotals.get(bestMatch.item) || 0) + qc.totalKg);
      }
    }
  }

  // ── PASS 4: Global text scan for items not yet found ─────────────────────
  // STRATEGY: For each missing item, find the quantity-weight pair that
  // best validates its unit weight. Weight is the primary signal.
  // Then: only assign if the weight matches AND the pair hasn't been claimed.
  {
    const allText = lines.join(" ").replace(/\s+/g, " ").trim();

    // Find ALL quantity-weight pairs in the global text with their positions
    const allPairs: { qty: number; totalKg: number; pos: number; matched: boolean; raw: string }[] = [];
    const numPattern = /(\d[\d.,]*)\s*\(\s*(\d+(?:[.,]\d+)?)\s*\)/g;
    let pm: RegExpExecArray | null;
    while ((pm = numPattern.exec(allText))) {
      const qty = Math.round(parseFloat(pm[1].replace(/\./g, "").replace(",", ".")) || 0);
      const totalKg = parseFloat(pm[2].replace(",", "."));
      const raw = pm[0].replace(/\s+/g, " ").trim();
      if (qty > 0 && Number.isFinite(totalKg) && !pass1UsedPairs.has(raw)) {
        allPairs.push({ qty, totalKg, pos: pm.index, matched: false, raw });
      }
    }

      // For each item not yet in merged, find the closest unclaimed pair
      // whose weight validates this item.
      for (const [pattern, itemName] of ITEM_MAP) {
        if (merged.has(itemName)) continue;
        if (itemName === "arma sns hk2 dupla") continue;
        if (itemName === "lockpick" && merged.has("lockpick avancada")) continue;
        if (itemName === "lockpick" && /lockpick[\s\S]*?avan[cç]ad/i.test(allText)) continue;
        if (itemName === "colete" && merged.has("colete fortalecido")) continue;
        // Skip generic patterns when a more specific variant also exists
        if (itemName === "cristal" && /cristal\s*processado/i.test(allText)) continue;
        if (itemName === "colete" && /colete\s*fortalecid/i.test(allText)) continue;
        if (itemName === "diamante" && /diamante\s*bruto/i.test(allText)) continue;
        if (itemName === "sumo" && /sumo\s*(maracu|laranja|manga)/i.test(allText)) continue;
      // Never create generic "sumo" if any specific variant already exists
      if (itemName === "sumo" && (merged.has("sumo maracuja") || merged.has("sumo laranja"))) continue;
        if (itemName === "corrente" && /corrente\s*10k/i.test(allText)) continue;

        if (!pattern.test(allText)) continue;

        // Find the name's position in the text
        const nameMatch = new RegExp(pattern.source, "i").exec(allText);
        if (!nameMatch) continue;
        const namePos = nameMatch.index;

        // Find the closest unclaimed pair that validates this item's weight
        let bestPair: typeof allPairs[0] | null = null;
        let bestDist = Infinity;

        for (const pair of allPairs) {
          if (pair.matched) continue;
          // Try STRICT first, then loose
          const strict = weightMatches(itemName, pair.qty, pair.totalKg);
          const loose = !strict && weightMatchesLoose(itemName, pair.qty, pair.totalKg);
          if (!strict && !loose) continue;

          // Distance from name to pair
          let dist: number;
          if (pair.pos < namePos) {
            dist = namePos - (pair.pos + 20);
          } else {
            dist = pair.pos - (namePos + nameMatch[0].length);
          }
          if (dist < 0) dist = 0;

          // For specific items (cristal processado, sumo maracuja, etc.)
          // strongly prefer the closest name-positioned pair, even if weight
          // doesn't match strictly (OCR digit error).
          let weightedDist = loose ? dist + 1000 : dist;

          // SPECIAL: if name is cristal processado and pair's weight is
          // within 50% of expected, accept it (OCR can misread 8→5 etc.)
          if (itemName === "cristal processado" && pair.qty > 0) {
            const expected = pair.qty * 0.3;
            if (Math.abs(pair.totalKg - expected) / expected <= 0.5) {
              weightedDist = dist - 100; // Strongly prefer
            }
          }

          // Loose matches get strongly penalized to prevent wrong assignments
          if (loose) weightedDist += 500;

          if (weightedDist < bestDist) {
            bestDist = weightedDist;
            bestPair = pair;
          }
        }

      if (bestPair) {
        if (process.env.DEBUG_PARSER) console.log(`  PASS4 ASSIGN ${itemName}=${bestPair.qty} (from ${bestPair.raw}) strict=${weightMatches(itemName, bestPair.qty, bestPair.totalKg)} loose=${weightMatchesLoose(itemName, bestPair.qty, bestPair.totalKg)}`);
        bestPair.matched = true;
        merged.set(itemName, bestPair.qty);
        weightTotals.set(itemName, bestPair.totalKg);
      } else {
        if (process.env.DEBUG_PARSER) console.log(`  PASS4 NO MATCH for ${itemName} (looked for qty that gives ${namePos} weight)`);
      }
    }
  }

  // ── Post-processing: Handle compound lockpick ────────────────────────────
  {
    const allText = lines.join(" ").replace(/\s+/g, " ").trim();
    if (
      /lockpick[\s\S]*?avan[cç]ad/i.test(allText) ||
      (/lockpick/i.test(allText) && /avan[cç]ad/i.test(allText))
    ) {
      merged.delete("lockpick");
      if (!merged.has("lockpick avancada")) {
        merged.set("lockpick avancada", 1);
      }
    }
  }

  // ── Handle SNS PISTOL HK2 (two weapons in one cell) ──────────────────────
  {
    const snsHk2Qty = merged.get("arma sns hk2 dupla");
    if (snsHk2Qty) {
      merged.delete("arma sns hk2 dupla");
      merged.set("arma baixo calibre", (merged.get("arma baixo calibre") || 0) + snsHk2Qty);
      merged.set("arma medio calibre", (merged.get("arma medio calibre") || 0) + snsHk2Qty);
    }
  }

  // ── RECOVERY: weapons/armas found in OCR but not assigned a quantity ───
  // get qty=1. This handles OCRs where the numeric value for a weapon
  // was missing or unreadable (e.g. "1 MICRO SMG" where the weight column
  // is blank in the screenshot). Only applies to WEAPONS because
  // legal items without a numeric are likely from a different row.
  // Skipped entirely for the weapon that triggered a weaponCapture popup
  // (see rule below) — that popup's weapon must never re-appear here.
  {
    const allText = lines.join(" ").replace(/\s+/g, " ").trim();
    const weaponPatterns = [
      { pattern: /\bmicro\s+smg\b/i, item: "arma medio calibre" },
      { pattern: /\b(?:sns\s+)?pistol\s+hk\s*2\b/i, item: "arma medio calibre" },
      { pattern: /\b(?:sns|vintage|revolver\s+mk\s*2|ap)\s+pistol\b/i, item: "arma baixo calibre" },
      { pattern: /\bmachine\s+pistol\b/i, item: "arma medio calibre" },
      { pattern: /\bvintage\s+pistol\b/i, item: "arma baixo calibre" },
      { pattern: /\b(?:bullpup|gusenberg|double\s+barrel|tactical|compact|advanced|spas|assault\s+rifle)\b/i, item: "arma alto calibre" },
      { pattern: /\b(?:arma\s+branca|arma\s+branca\s+ilegal)\b/i, item: "arma branca" },
    ];
    for (const wp of weaponPatterns) {
      if (weaponCapture && wp.item === weaponCapture.weaponItem) continue;
      if (merged.has(wp.item)) continue;
      if (wp.pattern.test(allText)) {
        merged.set(wp.item, (merged.get(wp.item) || 0) + 1);
      }
    }
  }

  // ── RULE: weapon-capture popup (has "Número de Série") never reports the
  // weapon itself — only the ammo/accessories registered above. The arma
  // is tracked by its serial number elsewhere, so listing it again here
  // would double-count it. This is a hard safety net that overrides
  // anything the block/pair-matching logic above may have added for this
  // weapon type, regardless of how it got matched.
  if (weaponCapture) {
    merged.delete(weaponCapture.weaponItem);
    weightTotals.delete(weaponCapture.weaponItem);
  }

  // ── Deduplicate: specific vs generic ──────────────────────────────────────
  if (merged.has("colete fortalecido") && merged.has("colete")) {
    const allText = lines.join(" ").replace(/\s+/g, " ").trim();
    if (/colete\s+fortalecid/i.test(allText)) {
      merged.delete("colete");
    }
  }
  // Keep both "corrente" and "corrente 10k" if they have different quantities.
  // Only remove generic "corrente" if it has the SAME qty as "corrente 10k"
  // (suggesting a duplicate from OCR).
  if (merged.has("corrente 10k") && merged.has("corrente")) {
    if (merged.get("corrente") === merged.get("corrente 10k")) {
      merged.delete("corrente");
    }
  }
  if (merged.has("diamante bruto") && merged.has("diamante")) {
    if (merged.get("diamante") === merged.get("diamante bruto")) {
      merged.delete("diamante");
    }
  }

  // Remove generic "sumo" if specific variant (maracuja/laranja) exists AND
  // has the SAME quantity (same data source). They can coexist if quantities
  // differ.
  if (merged.has("sumo")) {
    let genericQty = merged.get("sumo");
    for (const variant of ["sumo maracuja", "sumo laranja"]) {
      if (merged.has(variant) && merged.get(variant) === genericQty) {
        merged.delete("sumo");
        weightTotals.delete("sumo");
        break;
      }
    }
  }

  // For pairs of items that share a unit weight, prefer the more specific name
  // (e.g., "sumo maracuja" over "sumo") when quantities are the same.
  const specificOverGeneric: [string, string][] = [
    ["sumo maracuja", "sumo"],
    ["sumo laranja", "sumo"],
    ["cristal processado", "cristal"],
  ];
  for (const [specific, generic] of specificOverGeneric) {
    if (merged.has(specific) && merged.has(generic)) {
      // Keep both, but if their quantities happen to be equal, prefer specific
      // This avoids showing "2 sumo" + "2 sumo maracuja" as if they were different
    }
  }

  // ── Build final weights with confidence scores ─────────────────────────────

  const weights: ParseResult["weights"] = [];
  const allText = lines.join(" ");

  for (const [name, qty] of merged.entries()) {
    const unitKg = getUnitWeight(name);
    const ocrTotalKg = weightTotals.get(name);
    const kg = unitKg != null ? qty * unitKg : (ocrTotalKg ?? 0);

    // Calculate confidence based on weight match
    let confidence = 100;
    let confidenceLevel: "high" | "medium" | "low" = "high";
    let matchReason = "";

    if (ocrTotalKg != null && unitKg != null && unitKg > 0) {
      // Compare OCR weight with expected weight
      const expectedTotal = qty * unitKg;
      const deviation = Math.abs(ocrTotalKg - expectedTotal);
      const deviationPercent = (deviation / expectedTotal) * 100;

      if (deviationPercent <= 5) {
        confidence = 95 + (5 - deviationPercent);
        confidenceLevel = "high";
        matchReason = `Peso exato: ${ocrTotalKg.toFixed(1)} kg = ${qty} × ${unitKg} kg`;
      } else if (deviationPercent <= 15) {
        confidence = 80 + (15 - deviationPercent);
        confidenceLevel = "high";
        matchReason = `Peso próximo: ${ocrTotalKg.toFixed(1)} kg ≈ ${expectedTotal.toFixed(1)} kg esperado`;
      } else if (deviationPercent <= 30) {
        confidence = 60 + (30 - deviationPercent);
        confidenceLevel = "medium";
        matchReason = `Desvio ${deviationPercent.toFixed(0)}%: OCR ${ocrTotalKg.toFixed(1)} kg vs ${expectedTotal.toFixed(1)} kg esperado`;
      } else {
        // Check alternative weights
        const alts = ALT_WEIGHTS[name];
        let altMatch = false;
        if (alts) {
          for (const alt of alts) {
            const altExpected = qty * alt;
            const altDeviation = Math.abs(ocrTotalKg - altExpected);
            const altDeviationPercent = (altDeviation / altExpected) * 100;
            if (altDeviationPercent <= 15) {
              confidence = 75;
              confidenceLevel = "medium";
              matchReason = `Peso alternativo: ${ocrTotalKg.toFixed(1)} kg ≈ ${qty} × ${alt} kg`;
              altMatch = true;
              break;
            }
          }
        }
        if (!altMatch) {
          confidence = Math.max(20, 50 - deviationPercent / 2);
          confidenceLevel = "low";
          matchReason = `Desvio grande: OCR ${ocrTotalKg.toFixed(1)} kg vs ${expectedTotal.toFixed(1)} kg esperado`;
        }
      }
    } else if (unitKg != null) {
      // No OCR weight to compare, but we have catalog weight
      confidence = 70;
      confidenceLevel = "medium";
      matchReason = `Sem peso OCR, usando catálogo: ${qty} × ${unitKg} kg`;
    } else {
      // No weight info at all
      confidence = 50;
      confidenceLevel = "low";
      matchReason = "Peso desconhecido";
    }

    // Boost confidence if name appears clearly in OCR text
    const itemDef = ITEM_BY_NAME.get(name);
    if (itemDef) {
      const displayLower = itemDef.displayName.toLowerCase();
      const textLower = allText.toLowerCase();
      if (textLower.includes(displayLower)) {
        confidence = Math.min(100, confidence + 10);
        matchReason += " | Nome encontrado no OCR";
      }
    }

    weights.push({
      item: name,
      qty,
      kg: Number(kg.toFixed(2)),
      unitKg,
      confidence: Math.round(confidence),
      confidenceLevel,
      matchReason,
    });
  }

  // Calculate overall confidence
  const overallConfidence = weights.length > 0
    ? Math.round(weights.reduce((sum, w) => sum + w.confidence, 0) / weights.length)
    : 0;

  const resultText = Array.from(merged.entries())
    .map(([name, qty]) => `${qty} ${name}`)
    .join(", ");

  return { text: resultText, weights, weaponCapture, overallConfidence };
}
