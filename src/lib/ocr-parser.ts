import { ITEM_BY_NAME, ITEM_CATALOG } from "./item-weights";

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

type Hint = { item: string; pos: number; line: number; unitKg: number; frag: boolean; span: number; timer?: boolean };
type Pair = { qty: number; kg: number; pos: number; line: number };

// ─────────────────────────────────────────────────────────────────────────────
// Correção de typos comuns de OCR (nomes de itens do jogo)
// ─────────────────────────────────────────────────────────────────────────────
const TYPO_RULES: Array<[RegExp, string]> = [
  [/\bLOCKPECK\b/gi, "LOCKPICK"],
  [/\bLOCKPICK\s+AVANCAD[AO]\b/gi, "LOCKPICK AVANCADA"],
  [/\bTELEN[OÓ]VEL\b/gi, "TELEMOVEL"],
  [/\bTELEHOVEL\b/gi, "TELEMOVEL"],
  [/\bTELEH[OÓ]VEL\b/gi, "TELEMOVEL"],
  [/\bHEDACHI\s+MOCHI\b/gi, "MEDWCHI MOCHI"],
  [/\bHEOWCHI\s+MOCHI\b/gi, "MONOSHU"],
  [/\bMEOWCHI\s+MOCHI\b/gi, "MEDWCHI MOCHI"],
  [/\bMOMOSHU\b/gi, "MONOSHU"],
  [/\bHOHOSHU\b/gi, "MONOSHU"],
  [/\bSTRAWBELLY\b/gi, "STRAWBERRY"],
  [/\bBTFANA\b/gi, "BIFANA"],
  [/\bHA[CÇ]O\b/gi, "MACO"],
  [/\bSECAGEH\b/gi, "SECAGEM"],
  [/\bCHOCOCAE\b/gi, "CHOCOLATE"],
  [/\bCORRENTE\s+DE\s+DURO\b/gi, "CORRENTE DE OURO"],
  [/\bRELOGIO\s+DE\s+DURO\b/gi, "RELOGIO DE OURO"],
  [/\bREPARA[CÇ]AD\b/gi, "REPARACAO"],
  [/\bSUMO\s+HARACUJA\b/gi, "SUMO MARACUJA"],
  [/\bSUHO\s+MARACUJA\b/gi, "SUMO MARACUJA"],
  [/\bHACHINE\b/gi, "MACHINE"],
  [/\bSHG\b/gi, "SMG"],
  [/\bSUNO\b/gi, "SUMO"],
  [/\bHEDICKIT\b/gi, "MEDICKIT"],
  [/\bBANDAGEN\b/gi, "BANDAGEM"],
  [/\bBANDAGEH\b/gi, "BANDAGEM"],
  [/\bESTIHULANTE\b/gi, "ESTIMULANTE"],
  [/\bQUIHICA\b/gi, "QUIMICA"],
  [/\bHESA\b/gi, "MESA"],
  [/\bCIDADAD\b/gi, "CIDADAO"],
  [/\bCONDUCAD\b/gi, "CONDUCAO"],
  [/\bENCOHENDA\b/gi, "ENCOMENDA"],
  [/\bCARTAD\b/gi, "CARTAO"],
  [/\bDIAHANTE\b/gi, "DIAMANTE"],
  [/\b1BK\b/gi, "10K"],
  [/\b1OK\b/gi, "10K"],
  [/\b0\.B\b/gi, "0.8"],
  [/\bHISKY\b/gi, "WHISKY"],
  [/\bONTRABANDO\b/gi, "CONTRABANDO"],
  [/\bISKY\b/gi, "WHISKY"],
  [/\bCAXA\b/gi, "CAIXA"],
  [/\bHOGO\s+ARTIF[\wÀ-ÿ]*/gi, "FOGO DE ARTIFICIO"],
  [/\bFOGO\s+ARTIF[\wÀ-ÿ]*/gi, "FOGO DE ARTIFICIO"],
  [/\bFOGOS\s+ARTIF[\wÀ-ÿ]*/gi, "FOGO DE ARTIFICIO"],
  [/\bFOGO\s+(?:DE\s+)?ARTIF[\wÀ-ÿ]*/gi, "FOGO DE ARTIFICIO"],
];

function fixOcrTypos(text: string): string {
  let s = text;
  for (const [r, x] of TYPO_RULES) s = s.replace(r, x);
  return s;
}

function normalizeLine(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Junta um par partido em duas linhas: "1\n(1.0)" → "1 (1.0)".
function mergeSplitPairs(text: string): string {
  return text.replace(/(\d{1,7})\s*\n\s*\(\s*(\d+(?:\.\d+)?)\s*\)/g, "$1 ($2)");
}

// Recupera fragmentos "N0-D)" -> "N (0.D) NOME": o OCR corrompe o par
// "7 (0.7)" como "70-7)" ("(" vira "0-").
function recoverFragmentQty(text: string, used: Set<string>): string {
  const lower = text.toLowerCase();
  return text.replace(
    /\b(\d{1,4})0-(\d)\)/g,
    (m: string, qtyStr: string, d: string) => {
      const qty = Number(qtyStr);
      const total = Number(`0.${d}`);
      const unit = total / qty;
      const cands = ITEM_CATALOG.filter(
        (c) => Math.abs(c.unitKg - unit) < 0.001 && lower.includes(c.name) && !used.has(c.name)
      );
      if (cands.length !== 1) return m;
      used.add(cands[0].name);
      return `${qty} (${total}) ${cands[0].name}`;
    }
  );
}

// Recupera pares com o qty corrompido pelo OCR.
function recoverCorruptedQty(text: string, used: Set<string>): string {
  const lower = text.toLowerCase();
  return text.replace(
    /\b([A-Za-z])\s*\(\s*(\d+(?:\.\d+)?)\s*\)\s*\n\s*(\d{1,7})\b/g,
    (m: string, letter: string, peso: string, qty: string) => {
      const u = Number(peso);
      const cands = ITEM_CATALOG.filter(
        (d) =>
          d.illegal &&
          d.name.startsWith(letter.toLowerCase()) &&
          Math.abs(d.unitKg - u) < 0.001 &&
          lower.includes(d.name) &&
          !used.has(d.name)
      );
      if (cands.length !== 1) return m;
      used.add(cands[0].name);
      return `${qty} (${peso}) ${cands[0].name}`;
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pistas de nomes: geradas a partir do catálogo + aliases + fragmentos
// ─────────────────────────────────────────────────────────────────────────────
const ALIASES: Array<[string, string, number?]> = [
  ["acessorios", "acessorios para armas", 0.1],
  ["porte de arma", "porte de arma branca"],
  ["strawberry shortcake", "strawberry shortcake"],
  ["strawberry", "strawberry shortcake"],
  ["vintage pistol", "arma baixo calibre", 5],
  ["vintage", "arma baixo calibre", 5],
  ["knife", "knife"],
  ["faca", "knife"],
  ["copo cartao", "copo de cartao", 0.2],
  ["copo", "copo de cartao", 0.2],
  ["carregador de smg", "carregador medio calibre"],
  ["carregador smg", "carregador medio calibre"],
  ["carregador de rifle", "carregador alto calibre"],
  ["carregador de pistola", "carregador baixo calibre"],
  ["balas 5.56", "carregador alto calibre"],
  ["balas 556", "carregador alto calibre"],
  ["bala 5.56", "carregador alto calibre"],
  ["balas 5,56", "carregador alto calibre"],
  ["balas 0.45", "carregador medio calibre"],
  ["bala 0.45", "carregador medio calibre"],
  ["balas 045", "carregador medio calibre"],
  ["balas 45", "carregador medio calibre"],
  ["balas 9mm", "carregador baixo calibre"],
  ["bala 9mm", "carregador baixo calibre"],
  ["balas 9 mm", "carregador baixo calibre"],
  ["cartuchos 12", "carregador alto calibre"],
  ["cartucho 12", "carregador alto calibre"],
  ["cartuchos 12 gauge", "carregador alto calibre"],
  ["cartucho 12 gauge", "carregador alto calibre"],
  ["tactical carbine", "arma alto calibre", 15],
  ["bullpup rifle mk2", "arma alto calibre", 15],
  ["bullpup mk2", "arma alto calibre", 15],
  ["bullpup rifle", "arma alto calibre", 15],
  ["advanced rifle", "arma alto calibre", 15],
  ["military rifle", "arma alto calibre", 15],
  ["tactical rifle", "arma alto calibre", 15],
  ["rifle mk2", "arma alto calibre", 15],
  ["double barrel", "arma alto calibre", 15],
  ["pistol 50", "arma baixo calibre", 5],
  ["sns", "arma baixo calibre", 5],
  ["revolver mk2", "arma baixo calibre", 5],
  ["machine pistol", "arma medio calibre", 5],
  ["micro smg", "arma medio calibre", 10],
  ["assault smg", "arma medio calibre", 10],
  ["combat pdw", "arma medio calibre", 10],
  ["p90", "arma medio calibre", 5],
  ["tec9", "arma medio calibre", 5],
  ["tec 9", "arma medio calibre", 5],
  ["mini uzi", "arma medio calibre", 5],
  ["hk2", "arma medio calibre", 5],
  ["ap pistol", "arma baixo calibre", 5],
  ["sns pistol", "arma baixo calibre", 5],
  ["revolver", "arma baixo calibre", 5],
  ["pistol", "arma baixo calibre", 5],
  ["compact rifle", "arma alto calibre", 15],
  ["assault rifle", "arma alto calibre", 15],
  ["carbine rifle", "arma alto calibre", 15],
  ["bullpup", "arma alto calibre", 15],
  ["gusenberg", "arma alto calibre", 15],
  ["famas", "arma alto calibre", 15],
  ["shotgun", "arma alto calibre", 15],
  ["spas", "arma alto calibre", 15],
  ["draco", "arma alto calibre", 15],
  ["mesa quimica", "mesa quimica"],
  ["c4", "c4"],
  ["c 4", "c4"],
  ["sumo de ananas", "sumo ananas"],
  ["maço tabaco", "maço"],
  ["maço de tabaco", "maço"],
  ["suporte secagem", "suporte de secagem"],
  ["restos eletronicos", "eletronicos"],
  ["resto eletronico", "eletronicos"],
  ["candy cane", "candy cane"],
  ["candy", "candy cane"],
  ["agi", "agua"],
  ["oilpetroleo", "petroleo"],
  ["oil petroleo", "petroleo"],
  ["oil", "petroleo"],
  ["oilp", "petroleo"],
  // Aliases para o formato do AI Overview
  ["petrol can", "petroleo"],
  ["petrolcan", "petroleo"],
  ["petrol", "petroleo"],
  ["relogio ouro", "relogio de ouro"],
  ["medickit", "medickits"],
  ["medickits", "medickits"],
  ["barra de ouro", "barras ouro"],
  ["barra ouro", "barras ouro"],
  ["cartao de cidadao", "cartao de cidadao"],
  ["carta de conducao", "carta de conducao"],
  ["pack vinho", "pack vinhos"],
  ["minerio", "minerios"],
  ["pepita", "pepitas"],
  ["safira", "safiras"],
  ["fogo artificio", "fogo de artificio"],
  ["fogo de artificio", "fogo de artificio"],
  ["fogos artificio", "fogo de artificio"],
  ["fogos de artificio", "fogo de artificio"],
  ["artificio", "fogo de artificio"],
  ["fireworks", "fogo de artificio"],
  ["firework", "fogo de artificio"],
];

const FRAGMENTS: Array<[string, string, string | null]> = [
  ["fortalecido", "colete fortalecido", "colete"],
  ["avancada", "lockpick avancada", "lockpick"],
  ["processado", "cristal processado", "cristal"],
  ["cidadao", "cartao de cidadao", "cartao"],
  ["cartao de", "cartao de cidadao", null],
  ["conducao", "carta de conducao", "carta"],
  ["laranja", "sumo laranja", "sumo"],
  ["ananas", "sumo ananas", "sumo"],
  ["maracuja", "sumo maracuja", "sumo"],
  ["secagem", "suporte de secagem", null],
  ["estatal", "ouro estatal", null],
  ["shortcake", "strawberry shortcake", "strawberry shortcake"],
  ["gingerkitty", "gingerkitty cookie", null],
  ["cookie", "gingerkitty cookie", null],
  ["10k", "corrente 10k", null],
  ["mochi", "medwchi mochi", null],
  ["smg", "carregador medio calibre", null],
  ["rifle", "carregador alto calibre", null],
  ["pistola", "carregador baixo calibre", null],
];

interface PhrasePattern {
  re: RegExp;
  item: string;
  unitKg: number;
  frag: boolean;
  prefix: string | null;
}

const BARE_NAME_DENY = new Set(["branca"]);
const PHRASE_BY_NORM = new Map<string, { item: string; unitKg: number }>();

function buildPhrases(): PhrasePattern[] {
  const out: PhrasePattern[] = [];
  const seen = new Set<string>();
  const addPhrase = (phrase: string, item: string, unitKg?: number, frag = false, prefix: string | null = null) => {
    const norm = normalizeLine(phrase);
    if (!norm || norm.length < 2 || seen.has(norm)) return;
    if (BARE_NAME_DENY.has(norm)) return;
    seen.add(norm);
    const def = ITEM_BY_NAME.get(item);
    const u = unitKg ?? def?.unitKg;
    if (u == null) return;
    if (!frag && !PHRASE_BY_NORM.has(norm)) PHRASE_BY_NORM.set(norm, { item, unitKg: u });
    out.push({ re: new RegExp(`\\b${norm.replace(/\s+/g, "\\s+")}\\b`, "g"), item, unitKg: u, frag, prefix });
  };

  for (const def of ITEM_CATALOG) {
    addPhrase(def.name, def.name);
    addPhrase(def.displayName, def.name);
  }
  for (const [phrase, item, unit] of ALIASES) addPhrase(phrase, item, unit);
  for (const [suffix, item, prefix] of FRAGMENTS) addPhrase(suffix, item, undefined, true, prefix);
  return out;
}

const PHRASES = buildPhrases();

function lineOf(text: string, pos: number): number {
  let line = 0;
  for (let i = 0; i < pos && i < text.length; i++) if (text[i] === "\n") line++;
  return line;
}

function fixUnitWeightOverflow(pairs: Pair[]): Pair[] {
  const validUnits = ITEM_CATALOG.map(d => d.unitKg).filter(u => u > 0);
  return pairs.map(p => {
    const unit = p.kg / p.qty;
    if (unit <= 30) return p;
    for (const div of [10, 100]) {
      const cand = unit / div;
      if (cand <= 0 || cand > 30) continue;
      if (validUnits.some(u => weightClose(cand, u))) {
        return { ...p, kg: cand * p.qty };
      }
    }
    return p;
  });
}

function extractPairs(text: string): Pair[] {
  const out: Pair[] = [];
  const re = /(\d{1,7})\s*\(\s*(\d+(?:\.\d+)?)\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const qty = Number(m[1]);
    const kg = Number(m[2]);
    if (Number.isFinite(qty) && Number.isFinite(kg) && qty > 0 && kg >= 0) {
      out.push({ qty, kg, pos: m.index, line: lineOf(text, m.index) });
    }
  }
  return fixUnitWeightOverflow(out);
}

function extractQtyOnlyPairs(text: string): Array<{ qty: number; name: string; line: number }> {
  const out: Array<{ qty: number; name: string; line: number }> = [];
  const seen = new Set<string>();
  const push = (qty: number, rawName: string, pos: number) => {
    let name = rawName.trim();
    if (/\.{2,}|\u2026/.test(name)) {
      const base = normalizeLine(name).replace(/\s+/g, " ").trim();
      if (base.length >= 3) {
        let bestDisplay: string | null = null;
        let bestLen = base.length;
        for (const def of ITEM_CATALOG) {
          for (const cand of [normalizeLine(def.name), normalizeLine(def.displayName)]) {
            if (cand.length > bestLen && cand.startsWith(base)) {
              bestLen = cand.length;
              bestDisplay = def.displayName;
            }
          }
        }
        if (bestDisplay) name = bestDisplay;
      }
    }
    if (!(qty > 0) || name.length === 0) return;
    if (/^(arma|weapon|muni[cç][aã]?[oõ]?e?s?|ammo|s[ée]rie|serial|n[úu]mero)(\s*:.*)?$/i.test(name)) return;
    
    // Filtro para ignorar configurações do jogo que o AI Overview às vezes inclui
    if (/^(loot\s*table|better\s*loot|config)/i.test(name)) return;

    const key = `${pos}:${normalizeLine(name)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ qty, name, line: lineOf(text, pos) });
  };
  
  const reA = /^(\d{1,7})\s+([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9' -]*)$/gm;
  let m: RegExpExecArray | null;
  while ((m = reA.exec(text))) push(Number(m[1]), m[2], m.index);
  
  const reB = /(?:^|[•○●▪])\s*([^•○●▪\n()]+?)\s*\(\s*[xX×]?\s*(\d{1,7})\s*\)/gm;
  while ((m = reB.exec(text))) push(Number(m[2]), m[1], m.index);
  
  const reC = /(?:^|[•○●▪])\s*([^•○●▪\n:]+?):\s*[xX×]?\s*(\d{1,7})/gm;
  while ((m = reC.exec(text))) push(Number(m[2]), m[1], m.index);
  
  const reD = /(?:^|[○•●▪])\s*([^○•●▪\n()]+?)\s*\([^)]+\)\s*[–—-]\s*[xX×]?\s*(\d{1,7})/gm;
  while ((m = reD.exec(text))) push(Number(m[2]), m[1], m.index);
  
  const reE = /^([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9' -]*?)\s*\(\s*[xX×]\s*(\d{1,6})\s*\)/gm;
  while ((m = reE.exec(text))) push(Number(m[2]), m[1], m.index);
  
  const reF = /(?:^|[•○●▪])\s*([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9.' -]*?)\s*\([^)]+\)\s*\(\s*[xX×]\s*(\d{1,6})\s*\)/gm;
  while ((m = reF.exec(text))) push(Number(m[2]), m[1], m.index);

  // Formato G: "Nome - Quantidade" (saída do AI Overview)
  const reG = /(?:^|[•○●▪])\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 _.,'&()\/.\-]*?)\s+[-–—]\s*(\d{1,7})\s*$/gm;
  while ((m = reG.exec(text))) push(Number(m[2]), m[1], m.index);

  return out;
}

function collectHints(fixed: string): Hint[] {
  const lines = fixed.split("\n");
  const out: Hint[] = [];
  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li];
    const rawSafe = raw.replace(/(\w) +(hk2|mk2)\b/gi, "$1 xxx");
    const norm = normalizeLine(rawSafe);
    if (!norm) continue;
    for (const p of PHRASES) {
      const re = new RegExp(p.re.source, p.re.flags.replace(/g/g, "") + "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(norm))) {
        out.push({ item: p.item, pos: m.index, line: li, unitKg: p.unitKg, frag: p.frag, span: m[0].length });
      }
    }
    const timerRe = /\b([1-9]):(\d{2})\b/g;
    let tm: RegExpExecArray | null;
    while ((tm = timerRe.exec(rawSafe))) {
      out.push({ item: "c4", pos: tm.index, line: li, unitKg: 1, frag: false, span: 3, timer: true });
    }
  }
  return out;
}

function removeCoveredHints(hints: Hint[]): Hint[] {
  const byLine = new Map<number, Hint[]>();
  for (const h of hints) {
    if (h.frag) continue;
    const arr = byLine.get(h.line) ?? [];
    arr.push(h);
    byLine.set(h.line, arr);
  }
  const removed = new Set<Hint>();
  for (const arr of byLine.values()) {
    for (const h of arr) {
      for (const g of arr) {
        if (g === h) continue;
        if (g.pos <= h.pos && g.pos + g.span >= h.pos + h.span && g.span > h.span) {
          removed.add(h);
          break;
        }
      }
    }
  }
  return hints.filter((h) => !removed.has(h));
}

function fragmentPrefix(item: string): string | null {
  return FRAGMENTS.find(([, i]) => i === item)?.[2] ?? null;
}

function mergeFragments(hints: Hint[]): Hint[] {
  const removed = new Set<Hint>();
  for (const f of hints) {
    if (!f.frag) continue;
    const prefix = fragmentPrefix(f.item);
    if (prefix) {
      let best = -1;
      let bestDist = 1e9;
      for (let i = 0; i < hints.length; i++) {
        const h = hints[i];
        if (h === f || h.frag || h.item !== prefix) continue;
        if (h.line <= f.line && f.line - h.line <= 2 && f.pos - h.pos < bestDist) {
          best = i;
          bestDist = f.pos - h.pos;
        }
      }
      if (best >= 0) {
        f.line = hints[best].line;
        f.pos = hints[best].pos;
        removed.add(hints[best]);
      }
    }
  }

  const clean: Hint[] = [];
  const full = hints.filter((h) => !h.frag && !removed.has(h));
  for (const h of hints) {
    if (removed.has(h)) continue;
    if (h.frag) {
      const covered = full.some((g) => g.line === h.line && h.pos >= g.pos && h.pos < g.pos + g.span);
      if (covered) continue;
      h.frag = false;
    }
    clean.push(h);
  }

  clean.sort((a, b) => a.line - b.line || a.pos - b.pos);
  const dedup: Hint[] = [];
  for (const h of clean) {
    const prev = dedup[dedup.length - 1];
    if (prev && prev.item === h.item && h.line === prev.line && Math.abs(h.pos - prev.pos) < 4) continue;
    dedup.push(h);
  }
  return dedup;
}

function detectHeaderLines(lines: string[]): Set<number> {
  const set = new Set<number>();
  let firstPair = -1;
  for (let i = 0; i < lines.length; i++) {
    if (extractPairs(lines[i]).length > 0) { firstPair = i; break; }
  }
  if (firstPair <= 0) return set;
  let hasMarker = false;
  for (let i = 0; i < firstPair; i++) {
    const l = lines[i];
    if (
      /peso reconhecid|reconhecid/i.test(l) ||
      /^\s*\d{1,3}\s*%\s*$/i.test(l) ||
      /^\s*\d[\d\s]*\s+\d+(?:\.\d+)?\s*kg\s+[\d.,]+\s*kg\s*$/i.test(l)
    ) { hasMarker = true; break; }
  }
  if (!hasMarker) return set;
  for (let i = 0; i < firstPair; i++) set.add(i);
  return set;
}

function weightClose(a: number, b: number): boolean {
  if (a === 0) return b === 0;
  if (b === 0) return false;
  return Math.abs(a - b) / b <= 0.12 || Math.abs(a - b) <= 0.02;
}
function confidence(a: number, b: number | null, named: boolean): number {
  if (b == null || b <= 0) return named ? 75 : 50;
  const d = Math.abs(a - b) / b;
  if (d <= 0.05) return named ? 95 : 85;
  if (d <= 0.12) return named ? 70 : 55;
  return named ? 40 : 20;
}
function level(c: number): "high" | "medium" | "low" {
  return c >= 80 ? "high" : c >= 55 ? "medium" : "low";
}
function displayName(i: string): string {
  const d = ITEM_BY_NAME.get(i);
  if (d) return d.displayName;
  return i.replace(/\b\w/g, (c) => c.toUpperCase());
}
function matchForPair(p: Pair, h: Hint): ItemMatch {
  const u = p.kg / p.qty;
  const c = confidence(u, h.unitKg, true);
  return {
    item: h.item,
    qty: p.qty,
    kg: p.kg,
    unitKg: h.unitKg,
    confidence: c,
    confidenceLevel: level(c),
    matchReason: `Peso perfeito: ${p.kg} kg = ${p.qty} × ${h.unitKg} kg`,
  };
}
function fallbackForPair(p: Pair, unidentified: boolean, groupItems?: Set<string>): ItemMatch {
  const u = p.kg / p.qty;
  if (!unidentified) {
    if (groupItems && groupItems.size > 0) {
      const named = ITEM_CATALOG.find((x) => groupItems.has(x.name) && weightClose(u, x.unitKg));
      if (named) {
        const c = confidence(u, named.unitKg, true);
        return {
          item: named.name,
          qty: p.qty,
          kg: p.kg,
          unitKg: named.unitKg,
          confidence: c,
          confidenceLevel: level(c),
          matchReason: `Peso reconhecido: ${p.kg} kg = ${p.qty} × ${named.unitKg} kg`,
        };
      }
    }
  }
  return {
    item: `item nao identificado (${Math.round(u * 100) / 100} kg/un)`,
    qty: p.qty,
    kg: p.kg,
    unitKg: u,
    confidence: 20,
    confidenceLevel: "low",
    matchReason: "Item sem nome identificado",
  };
}

function assignPairsToHints(
  pairs: Pair[],
  hints: Hint[],
  forceSingleBlock = false
): { matchOf: Map<Pair, Hint>; leftover: Pair[] } {
  const matchOf = new Map<Pair, Hint>();
  const usedHint = new Array<boolean>(hints.length).fill(false);

  interface Block {
    items: number[];
    start: number;
    end: number;
  }
  const pairBlocksByIdx: Block[] = [];
  {
    let cur: Block | null = null;
    for (let i = 0; i < pairs.length; i++) {
      const ln = pairs[i].line;
      if (cur && ln <= cur.end + 1) {
        cur.items.push(i);
        cur.end = ln;
      } else {
        cur = { items: [i], start: ln, end: ln };
        pairBlocksByIdx.push(cur);
      }
    }
  }
  const hintBlocksByIdx: Block[] = [];
  {
    let cur: Block | null = null;
    for (let i = 0; i < hints.length; i++) {
      const ln = hints[i].line;
      if (cur && ln <= cur.end + 1) {
        cur.items.push(i);
        cur.end = ln;
      } else {
        cur = { items: [i], start: ln, end: ln };
        hintBlocksByIdx.push(cur);
      }
    }
  }

  const blockMatch = (
    pIdx: number[],
    hIdx: number[]
  ): { score: number; map: Array<[number, number]> } => {
    const n = pIdx.length;
    let bestScore = n * 1000;
    let bestMap: Array<[number, number]> = [];
    let nodes = 0;
    const MAX_NODES = 150_000;
    const curMap = new Map<number, number>();
    const pRank = new Map<number, number>(pIdx.map((pi, i) => [pi, i]));
    const hRank = new Map<number, number>(hIdx.map((hi, i) => [hi, i]));
    const itemUse = new Map<string, number>();
    const dfs = (k: number, lastHi: number, assigned: number, cost: number) => {
      if (++nodes > MAX_NODES || cost > bestScore) return;
      if (k === n) {
        const score = (n - assigned) * 1000 + cost;
        if (score < bestScore) {
          bestScore = score;
          bestMap = Array.from(curMap.entries());
        }
        return;
      }
      const pi = pIdx[k];
      const u = pairs[pi].kg / pairs[pi].qty;
      for (const hi of hIdx) {
        if ((!forceSingleBlock && hi <= lastHi) || usedHint[hi] || !weightClose(u, hints[hi].unitKg)) continue;
        const d = forceSingleBlock
          ? Math.abs((hRank.get(hi) ?? 0) - (pRank.get(pi) ?? 0)) * 3
          : Math.abs(hints[hi].line - pairs[pi].line);
        const dev = Math.abs(u - hints[hi].unitKg) / (hints[hi].unitKg || 1);
        const dupUse = forceSingleBlock ? (itemUse.get(hints[hi].item) ?? 0) * 15 : 0;
        curMap.set(pi, hi);
        itemUse.set(hints[hi].item, (itemUse.get(hints[hi].item) ?? 0) + 1);
        dfs(k + 1, hi, assigned + 1, cost + d * 2 + dev * 10 + dupUse);
        itemUse.set(hints[hi].item, (itemUse.get(hints[hi].item) ?? 1) - 1);
        curMap.delete(pi);
      }
      dfs(k + 1, lastHi, assigned, cost);
    };
    dfs(0, -1, 0, 0);
    return { score: bestScore, map: bestMap };
  };

  for (const pb of pairBlocksByIdx) {
    if (forceSingleBlock) break;
    let best: { score: number; map: Array<[number, number]> } | null = null;
    for (const hb of hintBlocksByIdx) {
      const after = hb.start >= pb.end;
      const gap = after ? hb.start - pb.end : pb.start - hb.end;
      if (gap > 40) continue;
      const res = blockMatch(pb.items, hb.items);
      if (!best || res.score < best.score) best = res;
    }
    if (best) {
      for (const [pi, hi] of best.map) {
        matchOf.set(pairs[pi], hints[hi]);
        usedHint[hi] = true;
      }
    }
  }

  if (forceSingleBlock && !matchOf.size) {
    const res = blockMatch(pairs.map((_, i) => i), hints.map((_, i) => i));
    for (const [pi, hi] of res.map) {
      matchOf.set(pairs[pi], hints[hi]);
      usedHint[hi] = true;
    }
  }

  const restPairs = pairs.filter((p) => !matchOf.has(p));
  if (restPairs.length === 0) return { matchOf, leftover: [] };
  const restHints = hints.filter((_, i) => !usedHint[i]);
  const cand: number[][] = restPairs.map((p) => {
    const u = p.kg / p.qty;
    const arr: number[] = [];
    for (let i = 0; i < restHints.length; i++) {
      const h = restHints[i];
      if (Math.abs(h.line - p.line) <= 40 && weightClose(u, h.unitKg)) arr.push(i);
    }
    return arr;
  });
  const order = restPairs
    .map((_, i) => i)
    .sort((a, b) => cand[a].length - cand[b].length || a - b);

  const UNASSIGNED_PENALTY = 500;
  const DUP_PENALTY = 8;
  const CROSS_PENALTY = 12;

  let bestScore = restPairs.length * UNASSIGNED_PENALTY;
  let nodes = 0;
  const MAX_NODES = 150_000;

  const itemCount = new Map<string, number>();
  for (const [, h] of matchOf) itemCount.set(h.item, (itemCount.get(h.item) ?? 0) + 1);
  const cur = new Array<number>(restPairs.length).fill(-1);
  let bestSeq: number[] | null = null;

  const crossCost = (pi: number, hi: number): number => {
    let c = 0;
    for (let pj = 0; pj < restPairs.length; pj++) {
      if (pj === pi || cur[pj] < 0) continue;
      const before =
        restPairs[pj].line < restPairs[pi].line ||
        (restPairs[pj].line === restPairs[pi].line && pj < pi);
      if ((before && cur[pj] > hi) || (!before && cur[pj] < hi)) c += CROSS_PENALTY;
    }
    return c;
  };

  const dfs = (k: number, assigned: number, cost: number) => {
    if (++nodes > MAX_NODES || cost > bestScore) return;
    if (k === order.length) {
      const score = (restPairs.length - assigned) * UNASSIGNED_PENALTY + cost;
      if (score < bestScore) {
        bestScore = score;
        bestSeq = [...cur];
        return;
      }
      if (score === bestScore && bestSeq) {
        for (let pi = 0; pi < restPairs.length; pi++) {
          const a = cur[pi];
          const b = bestSeq[pi];
          if (a === b) continue;
          if (a >= 0 && (b < 0 || a < b)) bestSeq = [...cur];
          break;
        }
      }
      return;
    }
    const pi = order[k];
    const p = restPairs[pi];
    const u = p.kg / p.qty;
    for (const hi of cand[pi]) {
      const h = restHints[hi];
      const dev = Math.abs(u - h.unitKg) / (h.unitKg || 1);
      const dist = Math.abs(h.line - p.line);
      const dup = itemCount.get(h.item) ?? 0;
      const step = dist * 2 + dev * 10 + dup * DUP_PENALTY + crossCost(pi, hi);
      itemCount.set(h.item, dup + 1);
      cur[pi] = hi;
      dfs(k + 1, assigned + 1, cost + step);
      itemCount.set(h.item, dup);
      cur[pi] = -1;
    }
    dfs(k + 1, assigned, cost);
  };

  dfs(0, 0, 0);

  const leftover: Pair[] = [];
  for (let pi = 0; pi < restPairs.length; pi++) {
    const hi = bestSeq ? bestSeq[pi] : -1;
    if (hi >= 0) matchOf.set(restPairs[pi], restHints[hi]);
    else leftover.push(restPairs[pi]);
  }

  if (matchOf.size) {
    const pairsByItem = new Map<string, Array<{ p: Pair; h: Hint }>>();
    const usedHintObjs = new Set<Hint>();
    for (const [p, h] of matchOf) {
      usedHintObjs.add(h);
      const arr = pairsByItem.get(h.item) ?? [];
      arr.push({ p, h });
      pairsByItem.set(h.item, arr);
    }
    for (const orphan of hints) {
      if (orphan.timer || usedHintObjs.has(orphan)) continue;
      for (const [item, arr] of pairsByItem) {
        if (item === orphan.item || arr.length < 2) continue;
        const compat = arr.filter((e) => weightClose(e.p.kg / e.p.qty, orphan.unitKg));
        if (!compat.length) continue;
        let worst = compat[0];
        for (const e of compat) {
          if (Math.abs(e.p.line - orphan.line) < Math.abs(worst.p.line - orphan.line)) continue;
          if (Math.abs(e.h.line - e.p.line) <= Math.abs(worst.h.line - worst.p.line)) continue;
          worst = e;
        }
        if (Math.abs(orphan.line - worst.p.line) >= Math.abs(worst.h.line - worst.p.line)) continue;
        matchOf.delete(worst.p);
        matchOf.set(worst.p, orphan);
        usedHintObjs.add(orphan);
        const rest = (pairsByItem.get(item) ?? []).filter((e) => e.p !== worst.p);
        pairsByItem.set(item, rest);
        pairsByItem.set(orphan.item, [...(pairsByItem.get(orphan.item) ?? []), { p: worst.p, h: orphan }]);
        break;
      }
    }
  }
  return { matchOf, leftover };
}

function mergeResults(items: ItemMatch[]): ItemMatch[] {
  const map = new Map<string, ItemMatch>();
  for (const w of items) {
    const prev = map.get(w.item);
    if (!prev) {
      map.set(w.item, { ...w });
      continue;
    }
    prev.qty += w.qty;
    prev.kg += w.kg;
    prev.unitKg = prev.qty > 0 ? Math.round((prev.kg / prev.qty) * 1000) / 1000 : prev.unitKg;
    prev.confidence = Math.max(prev.confidence, w.confidence);
    prev.confidenceLevel = level(prev.confidence);
    if (prev.matchReason.startsWith("Peso perfeito") && w.matchReason.startsWith("Peso perfeito")) {
      const def = ITEM_BY_NAME.get(w.item);
      prev.matchReason = `Peso perfeito: ${prev.kg} kg = ${prev.qty} × ${def?.unitKg ?? prev.unitKg} kg (2 pilhas no inventário)`;
    }
  }
  return Array.from(map.values());
}

function matchNameToItem(name: string, u: number): string | null {
  if (!name || name.length < 3) return null;
  for (const def of ITEM_CATALOG) {
    if (name === normalizeLine(def.name) || name === normalizeLine(def.displayName)) return def.name;
  }
  let best: string | null = null;
  let bestScore = 0;
  const check = (phrase: string, item: string) => {
    const n = normalizeLine(phrase);
    if (!n || n.length < 3) return;
    const score = name === n ? 2 : name.includes(n) || n.includes(name) ? 1 : 0;
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  };
  for (const def of ITEM_CATALOG) {
    if (!weightClose(u, def.unitKg)) continue;
    check(def.name, def.name);
    check(def.displayName, def.name);
  }
  for (const [phrase, item] of ALIASES) {
    const def = ITEM_BY_NAME.get(item);
    if (def && !weightClose(u, def.unitKg)) continue;
    check(phrase, item);
  }
  return bestScore > 0 ? best : null;
}

function sinteseMatch(rawName: string | null, qty: number, kg: number, u: number): ItemMatch {
  const name = rawName && !rawName.includes("item cortado") && rawName.length >= 3 ? rawName : null;
  const matched = name ? matchNameToItem(name, u) : null;
  const item = matched ?? `item nao identificado (${Math.round(u * 100) / 100} kg/un)`;
  const c = matched ? confidence(u, ITEM_BY_NAME.get(item)?.unitKg ?? u, true) : 20;
  return {
    item,
    qty,
    kg,
    unitKg: u,
    confidence: c,
    confidenceLevel: level(c),
    matchReason: matched
      ? `Peso perfeito: ${kg} kg = ${qty} × ${ITEM_BY_NAME.get(item)?.unitKg ?? u} kg`
      : "Item cortado na síntese",
  };
}

function parseSintese(text: string): ItemMatch[] | null {
  const items: ItemMatch[] = [];
  const verboseRe =
    /([^\n—–―-]{3,80}?)\s*[—–―-]\s*Quantidade\s*:\s*(\d[\d\s]*)\s*[—–―-]\s*Peso\s+de\s+cada\s*:\s*(\d+(?:[.,]\d+)?)\s*kg\s*[—–―-]\s*Peso\s+total\s*:\s*(\d+(?:[.,]\d+)?)\s*kg/gi;
  for (const line of text.split("\n")) {
    verboseRe.lastIndex = 0;
    let hitVerbose = false;
    let m: RegExpExecArray | null;
    while ((m = verboseRe.exec(line))) {
      hitVerbose = true;
      const qty = Number(m[2].replace(/\s+/g, ""));
      const unit = Number(m[3].replace(",", "."));
      const kg = Number(m[4].replace(",", "."));
      if (!Number.isFinite(qty) || !Number.isFinite(kg) || qty <= 0) continue;
      items.push(sinteseMatch(normalizeLine(m[1]), qty, kg, unit > 0 ? unit : kg / qty));
    }
    if (hitVerbose) continue;
    const panelRe =
      /([^\n:]{3,80}?)\s*:\s*(\d[\d\s]*)\s*(?:[\u2192\u279C\u279E\u27A4\u21D2]|=>|-{1,2}>|[\u203A\u00BB]|>|[\u2014\u2013-])\s*(\d+(?:[.,]\d+)?)\s*kg/gi;
    while ((m = panelRe.exec(line))) {
      const qty = Number(m[2].replace(/\s+/g, ""));
      const kg = Number(m[3].replace(",", "."));
      if (!Number.isFinite(qty) || !Number.isFinite(kg) || qty <= 0 || kg <= 0) continue;
      items.push(sinteseMatch(normalizeLine(m[1]).replace(/^[\d\s]+/, ""), qty, kg, kg / qty));
    }
    const re = /(\d[\d\s]*)\s*[×x]\s*([^—–―\n-]*?)\s*[—–―-]\s*([\d.,]+)\s*kg/g;
    while ((m = re.exec(line))) {
      const qty = Number(m[1].replace(/\s+/g, ""));
      const kg = Number(m[3].replace(",", "."));
      if (!Number.isFinite(qty) || !Number.isFinite(kg) || qty <= 0) continue;
      items.push(sinteseMatch(normalizeLine(m[2]), qty, kg, kg / qty));
    }
  }
  const identified = items.filter((i) => !i.item.startsWith("item nao identificado"));
  return identified.length >= 2 ? items : null;
}

function findWeaponInText(fixed: string): WeaponCapture["weaponItem"] | null {
  const norm = normalizeLine(fixed);
  const weaponAliases = ALIASES.filter(([, item]) => /^arma (baixo|medio|alto) calibre$/.test(item));
  let best: WeaponCapture["weaponItem"] | null = null;
  let bestLen = 0;
  for (const [phrase, item] of weaponAliases) {
    const p = normalizeLine(phrase);
    if (p.length > bestLen && new RegExp(`\\b${p.replace(/\s+/g, "\\s+")}\\b`, "i").test(norm)) {
      best = item as WeaponCapture["weaponItem"];
      bestLen = p.length;
    }
  }
  return best;
}

function countAccessories(fixed: string): number {
  const explicitMatch = fixed.match(/(?:A)?CESS[OÓ]RIOS?\s*[:(\s]*[xX×]?\s*(\d+)/i);
  if (explicitMatch) return Number(explicitMatch[1]);
  const list = fixed.match(/(?:A)?CESS[OÓ]RIOS?\s*:\s*((?:[^\n]+,\s*\n)*[^\n]+)/i)?.[1]?.trim();
  if (list) {
    const parts = list.split(/,| e | and |&/i).map(s => s.trim()).filter(s => s && !/^\d+$/.test(s) && s.length > 1);
    if (parts.length > 0) return parts.length;
  }
  return /CESS[OÓ]RIO/i.test(fixed) ? 1 : 0;
}

const WEAPON_CAPTURE_ENABLED = true;

function parseWeaponPopup(fixed: string, includeWeapon = false): { capture: WeaponCapture; weights: ItemMatch[] } | null {
  if (!WEAPON_CAPTURE_ENABLED) return null;
  let ammo = Number(fixed.match(/MUNI[CÇ][AÃ]?[OÕ]?E?S?\s*:\s*(\d+)/i)?.[1] || 0);
  if (!ammo) {
    let m = fixed.match(/(\d+)\s+balas\s+(?:baixo|m[eé]dio|alto)/i);
    if (!m) m = fixed.match(/balas\s+(?:baixo|m[eé]dio|alto)\s*(?:calibre)?\s*\(\s*[xX×]?\s*(\d+)/i);
    if (m) ammo = Number(m[1]);
  }
  // NOVO: Fallback para o formato "Machine Pistol - 117"
  if (!ammo) {
    const lineMatch = fixed.match(/^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 ]*?)\s*[-–—]\s*(\d{1,7})\s*$/m);
    if (lineMatch) {
      const weaponName = lineMatch[1].trim();
      if (findWeaponInText(weaponName)) {
        ammo = Number(lineMatch[2]);
      }
    }
  }
  const knownWeapon = findWeaponInText(fixed);
  const weapon = knownWeapon ? displayName(knownWeapon) : (fixed.match(/(?:ARMA|WEAPON)\s*:\s*([^\n]+)/i)?.[1]?.trim() || fixed.split("\n")[0]?.trim() || "");
  const accessoryCount = countAccessories(fixed);
  if (!weapon && !ammo && !accessoryCount) return null;

  const weaponItem = knownWeapon || (() => {
    if (/ALTO|RIFLE|CARABIN|SNIPER|GUSENBERG|BULLPUP|FAMAS|SHOTGUN|SPAS|DRACO/i.test(weapon)) return "arma alto calibre" as const;
    if (/MEDIO|M[EÉ]DIO|SMG|MACHINE|UZI|PDW|P90|TEC/i.test(weapon)) return "arma medio calibre" as const;
    return "arma baixo calibre" as const;
  })();
  const ammoItem = weaponItem === "arma alto calibre" ? "balas alto" : weaponItem === "arma medio calibre" ? "balas medio" : "balas baixo";
  const capture: WeaponCapture = { weapon, weaponItem, ammo, ammoItem, accessoryCount };

  const weights: ItemMatch[] = [];
  if (ammo > 0) {
    weights.push({ item: ammoItem, qty: ammo, kg: 0, unitKg: 0, confidence: 95, confidenceLevel: "high", matchReason: `Munição: ${ammo}` });
  }
  if (accessoryCount > 0) {
    weights.push({ item: "acessorios para armas", qty: accessoryCount, kg: 0, unitKg: 0.1, confidence: 95, confidenceLevel: "high", matchReason: `Acessórios: ${accessoryCount}` });
  }
  if (includeWeapon) {
    const def = ITEM_BY_NAME.get(weaponItem);
    weights.push({ item: weaponItem, qty: 1, kg: def?.unitKg ?? 0, unitKg: def?.unitKg ?? 0, confidence: 95, confidenceLevel: "high", matchReason: "Arma inspecionada (número de série)" });
  }
  return { capture, weights };
}

function detectWeaponCapture(text: string): WeaponCapture | null {
  if (!WEAPON_CAPTURE_ENABLED) return null;
  const armaMatch = (text.match(/(?:ARMA|WEAPON)\s*:\s*([^\n]+)/i)?.[1]?.trim() || "").replace(/\s*\(x\s*\d+\)\s*$/i, "").trim();
  let ammo = [...text.matchAll(/MUNI[CÇ][AÃ]?[OÕ]?E?S?\s*:\s*(\d+)/gi)].reduce((s, m) => s + Number(m[1]), 0);

  // NOVO: Fallback para "N balas"
  if (ammo === 0) {
    let totalBalas = 0;
    for (const m of text.matchAll(/(\d+)\s+balas\s+(?:baixo|m[eé]dio|alto)/gi)) totalBalas += Number(m[1]);
    for (const m of text.matchAll(/balas\s+(?:baixo|m[eé]dio|alto)\s*(?:calibre)?\s*\(\s*[xX×]?\s*(\d+)/gi)) totalBalas += Number(m[1]);
    ammo = totalBalas;
  }

  // NOVO: Fallback para "Machine Pistol - 117"
  if (ammo === 0) {
    const lineRegex = /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 ]*?)\s*[-–—]\s*(\d{1,7})\s*$/gm;
    for (const m of text.matchAll(lineRegex)) {
      if (findWeaponInText(m[1].trim())) {
        ammo += Number(m[2]);
      }
    }
  }

  const accessoryCount = countAccessories(text);
  if (!armaMatch && !ammo && !accessoryCount) return null;
  const knownWeapon = findWeaponInText(text);
  const weapon = armaMatch || (knownWeapon ? displayName(knownWeapon) : "");
  const weaponItem = knownWeapon || (() => {
    if (/ALTO|RIFLE|CARABIN|SNIPER|GUSENBERG|BULLPUP|FAMAS|SHOTGUN|SPAS|DRACO/i.test(weapon)) return "arma alto calibre" as const;
    if (/MEDIO|M[EÉ]DIO|SMG|MACHINE|UZI|PDW|P90|TEC/i.test(weapon)) return "arma medio calibre" as const;
    return "arma baixo calibre" as const;
  })();
  const ammoItem = weaponItem === "arma alto calibre" ? "balas alto" : weaponItem === "arma medio calibre" ? "balas medio" : "balas baixo";
  return { weapon, weaponItem, ammo, ammoItem, accessoryCount };
}

const WEAPON_CALIBER: Record<string, string> = {
  "tactical carbine": "alto", "bullpup rifle mk2": "alto", "bullpup mk2": "alto",
  "bullpup rifle": "alto", "advanced rifle": "alto", "military rifle": "alto",
  "tactical rifle": "alto", "rifle mk2": "alto", "double barrel": "alto",
  "assault rifle": "alto", "assault rifle mk2": "alto", "carbine rifle": "alto", "compact rifle": "alto", "gusenberg": "alto",
  "shotgun": "alto", "spas": "alto", "draco": "alto", "famas": "alto",
  "assault smg": "medio", "machine pistol": "medio", "micro smg": "medio",
  "combat pdw": "medio", "smg": "medio", "p90": "medio", "tec9": "medio",
  "pistol 50": "baixo", "sns": "baixo", "vintage": "baixo", "revolver": "baixo",
  "ap pistol": "baixo", "pistol": "baixo",
};

function normalizeWeaponMeta(text: string): string {
  return text.replace(
    /^([^\n—–]*?)\s*[—–]\s*MUNI[CÇ][AÃ]?[OÕ]?E?S?\s*:\s*(\d{1,7})[ ]*(balas?\s+\w+\s+calibre)?.*$/gim,
    (_m, item, ammo, balas) => {
      let out = item.trim();
      if (balas) {
        const ammoName = balas.replace(/\s+calibre$/i, "").trim();
        out += `\n${ammo} ${ammoName}`;
      } else {
        const weaponName = item.replace(/\s*\(x\s*\d+\)\s*$/i, "").trim();
        const caliber = WEAPON_CALIBER[normalizeLine(weaponName)];
        if (caliber) {
          out += `\n${ammo} balas ${caliber}`;
        } else if (/pistol|revolver|glock|beretta|taurus|desert eagle|smg|submetralhadora|mp5|uzi|tec|micro|pdw|p90|rifle|espingarda|sniper|draco|gusenberg|famas|shotgun|spas|carbine|bullpup|vintage|\bsns\b|assault|compact|military|tactical|marksman|machine|combat|\bmg\b|\bak\b|ar15/i.test(weaponName)) {
          out += `\nMUNIÇÃO: ${ammo}`;
        } else {
          out = `${weaponName} (x1)`;
        }
      }
      return out;
    }
  );
}

function normalizeWeaponAmmo(text: string): string {
  return text
    .replace(/^([^\n(]+?)\s*\(\s*MUNI[CÇ][AÃ]O\s*:\s*(\d{1,7})\s*\)\s*$/gim, (_m, name, ammo) => `${name.trim()} (x1)\nMUNIÇÃO: ${ammo}`)
    .replace(/^([^\n(]+?)\s*\(\s*MUNI[CÇ][AÃ]O\s*:[^)]*\)\s*$/gim, (_m, name) => `${name.trim()} (x1)`);
}

export function parseInventoryOCR(rawText: string, opts?: { includeWeapon?: boolean }): ParseResult {
  const includeWeapon = opts?.includeWeapon ?? false;
  rawText = normalizeWeaponAmmo(normalizeWeaponMeta(rawText));
  const usedRecover = new Set<string>();
  const summaryLines = rawText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => /^\d{1,7}\s*\(\s*\d+(?:[.,]\d+)?\s*\)\s+\S/i.test(l) && /\d+(?:[.,]\d+)?\s*kg/i.test(l));
  const xSummaryLines = rawText
        .split("\n")
        .flatMap((l) => {
          const re = /\b(\d{1,7})\s*[x×]\s+([A-Za-zÀ-ÿ][^—–-]*?)\s*[—–-]\s*([\d.,]+)\s*kg\b/gi;
          const out: string[] = [];
          for (const m of l.matchAll(re)) {
            const kg = m[3].replace(",", ".");
            out.push(`${m[1]} (${kg}) ${m[2].trim()}`);
          }
          return out;
        });
  const tabSummaryLines = rawText
        .split("\n")
        .flatMap((l) => {
          const re = /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' ]*)\s+(\d{1,7})\s+([\d.,]+)\s*kg\s+([\d.,]+)\s*kg/gi;
          const out: string[] = [];
          for (const m of l.matchAll(re)) {
            const name = m[1].trim();
            if (name.length < 2) continue;
            out.push(`${m[2]} (${m[3].replace(",", ".")}) ${name}`);
          }
          return out;
        });
const qtyOnlySummary: string[] = [];
let ammoAlto = 0, ammoMedio = 0, ammoBaixo = 0;
const qtyOnlyMap = new Map<string, { name: string; qty: number }>();
if (extractPairs(rawText).length < 2) {
  const qtyPairsRaw = extractQtyOnlyPairs(rawText);
  const qtyPairs: Array<{ qty: number; name: string; line: number }> = [];
  const isBalasName = (n: string) => /^balas?\s+(baixo|m[eé]dio|alto)(\s+calibre)?$/.test(normalizeLine(n));
  const mk2less = (n: string) => normalizeLine(fixOcrTypos(n)).replace(/\s+mk\s*(?:2|ii|3|iii)\s*$/i, "").trim();
  const phraseOf = (n: string) => PHRASE_BY_NORM.get(normalizeLine(fixOcrTypos(n))) ?? PHRASE_BY_NORM.get(mk2less(n));
  const isWeaponOrAmmo = (n: string) => {
    const d = phraseOf(n);
    return d ? /^arma (baixo|medio|alto) calibre$/.test(d.item) || /^balas /.test(d.item) : false;
  };
  const weaponCaliber = (n: string): string | null => {
    const norm = normalizeLine(fixOcrTypos(n));
    const c = WEAPON_CALIBER[norm] ?? WEAPON_CALIBER[mk2less(n)];
    if (c) return c;
    const d = phraseOf(n);
    if (d) { const m = d.item.match(/^arma (baixo|medio|alto) calibre$/); if (m) return m[1]; }
    return null;
  };
  for (const p of qtyPairsRaw) {
    const prev = qtyPairs[qtyPairs.length - 1];
    if (isBalasName(p.name) && prev) {
      if (prev.qty === 1 && !isWeaponOrAmmo(prev.name)) {
        prev.qty = p.qty;
        continue;
      }
      const cal = weaponCaliber(prev.name);
      if (cal) p.name = `balas ${cal} calibre`;
    }
    qtyPairs.push({ ...p });
  }
  const hasAccessoryCount = qtyPairs.some((p) => /^acess[oó]rios?$/i.test(p.name.trim()));
  for (const p of qtyPairs) {
    const fixedName = fixOcrTypos(p.name);
    let def = PHRASE_BY_NORM.get(normalizeLine(fixedName));
    if (!def) {
      const norm = normalizeLine(fixedName);
      const base = norm.replace(/\s+mk\s*(?:2|ii|3|iii)\s*$/i, "").trim();
      if (base && base !== norm) def = PHRASE_BY_NORM.get(base);
    }
    let name = fixedName;
    const cat = def ? ITEM_BY_NAME.get(def.item)?.category : undefined;
    const isAccessoryWord = !def && /suppressor|supressor|silencer|scope|sight|laser|holographic|extended clip|flashlight|grip|drum/i.test(name);
    const isIndividualAccessory = (def && def.item !== "acessorios para armas" && cat === "acessorio") || isAccessoryWord;
    if (hasAccessoryCount && isIndividualAccessory) continue;
    if (isIndividualAccessory) {
      def = PHRASE_BY_NORM.get("acessorios para armas");
      name = "Acessórios para Armas";
    }
    const unitKg = def?.unitKg ?? 0;
    let qty = p.qty;
    if (def && /^arma (baixo|medio|alto) calibre$/.test(def.item) && qty > 50) {
      if (def.item === "arma alto calibre") ammoAlto += qty;
      else if (def.item === "arma medio calibre") ammoMedio += qty;
      else ammoBaixo += qty;
      qty = 1;
    }
    const key = normalizeLine(name);
    const prev = qtyOnlyMap.get(key);
    if (prev) prev.qty += qty;
    else qtyOnlyMap.set(key, { name, qty });
  }
}
for (const { name, qty } of qtyOnlyMap.values()) {
  const norm = normalizeLine(name);
  let def = PHRASE_BY_NORM.get(norm);
  if (!def) {
    const base = norm.replace(/\s+mk\s*(?:2|ii|3|iii)\s*$/i, "").trim();
    if (base && base !== norm) def = PHRASE_BY_NORM.get(base);
  }
  const unitKg = def?.unitKg ?? 0;
  const kg = Math.round(qty * unitKg * 1000) / 1000;
  qtyOnlySummary.push(`${qty} (${kg}) ${name}`);
}
const allSummary = [...summaryLines, ...xSummaryLines, ...tabSummaryLines, ...qtyOnlySummary];
  const sourceText =
    allSummary.length >= 2 &&
    (allSummary.length * 3 <= rawText.split("\n").length + 4 || qtyOnlySummary.length >= 2)
      ? allSummary.join("\n")
      : rawText;
  const fixed = fixOcrTypos(
    mergeSplitPairs(recoverFragmentQty(recoverCorruptedQty(sourceText, usedRecover), usedRecover))
  );
  const fixedFull = fixOcrTypos(
    mergeSplitPairs(recoverFragmentQty(recoverCorruptedQty(rawText, usedRecover), usedRecover))
  );
  const headerLines = detectHeaderLines(fixed.split("\n"));

  const allPairs = extractPairs(fixed);
  const structuredPairLines = allPairs.filter((p) => {
    const l = fixed.split("\n")[p.line] ?? "";
    const withoutPair = l.replace(/\d{1,7}\s*\(\s*[\d.,]+\s*\)/g, "").replace(/[\d.,:\s]/g, "");
    return /[a-zA-Z\u00C0-\u00FF]/.test(withoutPair);
  }).length;
  const scrambledText = allPairs.length > 0 && structuredPairLines / allPairs.length < 0.5;

  function flagSameWeightAmbiguity(merged: ItemMatch[], enabled: boolean): ItemMatch[] {
    if (!enabled) return merged;
    const byUnit = new Map<number, Set<string>>();
    for (const w of merged) {
      let s = byUnit.get(w.unitKg ?? -1);
      if (!s) { s = new Set(); byUnit.set(w.unitKg ?? -1, s); }
      s.add(w.item);
    }
    const ambiguousUnits = new Set<number>();
    for (const [unit, items] of byUnit) if (items.size >= 2) ambiguousUnits.add(unit);
    if (ambiguousUnits.size === 0) return merged;
    return merged.map((w) =>
      ambiguousUnits.has(w.unitKg ?? -1) && w.matchReason.startsWith("Peso perfeito")
        ? { ...w, confidence: Math.min(w.confidence, 70), confidenceLevel: "medium" as const }
        : w
    );
  }
  function ambiguityWarning(merged: ItemMatch[], enabled: boolean): string {
    if (!enabled) return "";
    const byUnit = new Map<number, Set<string>>();
    for (const w of merged) {
      if (!w.matchReason.startsWith("Peso perfeito")) continue;
      let s = byUnit.get(w.unitKg ?? -1);
      if (!s) { s = new Set(); byUnit.set(w.unitKg ?? -1, s); }
      s.add(displayName(w.item));
    }
    const groups = [...byUnit.entries()].filter(([, s]) => s.size >= 2).map(([, s]) => [...s].join(" / "));
    return groups.length
      ? " — ⚠ ATENÇÃO: " + groups.join("; ") + " têm o mesmo peso e podem estar trocados; confirma as quantidades."
      : "";
  }

  if (/(?:num[ée]?ro|umero)\s+de\s+s[ée]rie|\bs[ée]rie\b|\bserial\b/i.test(fixedFull)) {
    const popup = parseWeaponPopup(fixedFull, includeWeapon);
    if (popup) {
      if (!includeWeapon) {
        const text = popup.weights.map((w) => `${w.qty} ${displayName(w.item)}`).join(", ");
        const overall = popup.weights.length ? popup.weights.reduce((s, w) => s + w.confidence, 0) / popup.weights.length : 0;
        return { text, weights: popup.weights, weaponCapture: popup.capture, overallConfidence: overall };
      }
      const usingSummary = allSummary.length >= 2;
      const bodyText = usingSummary
        ? fixed
        : fixedFull
            .replace(/((?:(?:num[ée]?ro|umero)\s+de\s+)?s[ée]rie\s*:\s*)[^\n]*/gi, "$1")
            .replace(/((?:A)?CESS[OÓ]RIOS?\s*:\s*)[^\n]*/gi, "$1");
      const body = parseInventoryBody(bodyText, headerLines, undefined, scrambledText);
      const popupWeights = popup.weights.filter((w) => w.item !== popup.capture.weaponItem);
      const bodySemMunicao = body.filter((w) => !/^balas (baixo|medio|alto)$/.test(w.item) && w.item !== "acessorios para armas");
      const mergedRaw = [...bodySemMunicao, ...popupWeights];
      if (includeWeapon && !mergedRaw.some((w) => w.item === popup.capture.weaponItem)) {
        const def = ITEM_BY_NAME.get(popup.capture.weaponItem);
        mergedRaw.push({ item: popup.capture.weaponItem, qty: 1, kg: def?.unitKg ?? 0, unitKg: def?.unitKg ?? 0, confidence: 95, confidenceLevel: "high", matchReason: "Arma inspecionada (número de série)" });
      }
      const merged = flagSameWeightAmbiguity(mergeResults(mergedRaw), scrambledText);
      const text = merged.filter((w) => !w.item.startsWith("item nao identificado")).map((w) => `${w.qty} ${displayName(w.item)}`).join(", ") + ambiguityWarning(merged, scrambledText);
      const overall = merged.length ? merged.reduce((s, w) => s + w.confidence, 0) / merged.length : 0;
      return { text, weights: merged, weaponCapture: popup.capture, overallConfidence: overall };
    }
  }

  const sintese = parseSintese(fixed);
  if (sintese) {
    const merged = flagSameWeightAmbiguity(mergeResults(sintese), scrambledText);
    const text = merged.filter((w) => !w.item.startsWith("item nao identificado")).map((w) => `${w.qty} ${displayName(w.item)}`).join(", ") + ambiguityWarning(merged, scrambledText);
    const overall = merged.length ? merged.reduce((s, w) => s + w.confidence, 0) / merged.length : 0;
    return { text, weights: merged, weaponCapture: null, overallConfidence: overall };
  }

  const anyPairs = extractPairs(fixed).length > 0;
  if (!anyPairs) {
    return { text: "", weights: [], weaponCapture: detectWeaponCapture(fixedFull), overallConfidence: 0 };
  }

  const body = parseInventoryBody(fixed, headerLines, undefined, scrambledText);
  const merged = flagSameWeightAmbiguity(mergeResults(body), scrambledText);
  let wc: WeaponCapture | null = detectWeaponCapture(fixedFull);
  if (WEAPON_CAPTURE_ENABLED && (!wc || wc.ammo === 0)) {
    let ammoFromWeapon = 0;
    for (const w of merged) {
      if (WEAPON_ITEM_RE.test(w.item) && w.qty > 50) {
        ammoFromWeapon = Math.max(ammoFromWeapon, w.qty);
        w.qty = 1;
        w.kg = w.unitKg ?? 0;
        w.matchReason = "Arma (1 unidade; excedente = munição)";
      }
    }
    if (ammoFromWeapon > 0) {
      const wItem = merged.find((w) => WEAPON_ITEM_RE.test(w.item));
      const wItemName = wItem?.item ?? "arma baixo calibre";
      const ammoItem = wItemName === "arma alto calibre" ? "balas alto" : wItemName === "arma medio calibre" ? "balas medio" : "balas baixo";
      wc = {
        weapon: wItem ? displayName(wItem.item) : "Arma",
        weaponItem: wItemName as WeaponCapture["weaponItem"],
        ammo: ammoFromWeapon,
        ammoItem,
        accessoryCount: wc?.accessoryCount ?? 0,
      };
    }
  }
  for (const [item, qty] of [["balas alto", ammoAlto], ["balas medio", ammoMedio], ["balas baixo", ammoBaixo]] as Array<[string, number]>) {
    if (qty > 0) {
      const def = ITEM_BY_NAME.get(item);
      const unitKg = def?.unitKg ?? 0;
      merged.push({ item, qty, kg: Math.round(qty * unitKg * 1000) / 1000, unitKg, confidence: 90, confidenceLevel: "medium", matchReason: "Munição do arsenal (por calibre)" });
    }
  }
  const text = merged.filter((w) => !w.item.startsWith("item nao identificado")).map((w) => `${w.qty} ${displayName(w.item)}`).join(", ") + ambiguityWarning(merged, scrambledText);
  const overall = merged.length ? merged.reduce((s, w) => s + w.confidence, 0) / merged.length : 0;
  return { text, weights: merged, weaponCapture: wc, overallConfidence: overall };
}

const WEAPON_ITEM_RE = /^arma (baixo|medio|alto) calibre$/;

function extractOrphanName(fixed: string, line: number): string | null {
  const raw = fixed.split("\n")[line] ?? "";
  const cleaned = raw
    .replace(/\d{1,7}\s*\(\s*[\d.,]+\s*\)/g, " ")
    .replace(/^[\s•○●▪\-–—*·]+/, " ")
    .replace(/\d+(?:[.,]\d+)?\s*kg\b/gi, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 3) return null;
  const letters = (cleaned.match(/[A-Za-zÀ-ÿ]/g) ?? []).length;
  if (letters < cleaned.length * 0.6) return null;
  return cleaned;
}

function parseInventoryBody(fixed: string, headerLines: Set<number>, excludeItems?: Set<string> | RegExp, scrambledText = false): ItemMatch[] {
  const isExcluded = (item: string) =>
    excludeItems instanceof RegExp ? excludeItems.test(item) : excludeItems?.has(item) ?? false;
  const hints = mergeFragments(removeCoveredHints(collectHints(fixed).filter((h) => !headerLines.has(h.line))));
  const out: ItemMatch[] = [];

  const allPairs = extractPairs(fixed);
  const usableHints = hints.filter((h) => !h.timer && !isExcluded(h.item));
  const { matchOf, leftover } = assignPairsToHints(allPairs, usableHints, scrambledText);
  for (const p of allPairs) {
    const h = matchOf.get(p);
    if (h) out.push(matchForPair(p, h));
  }
  for (const p of leftover) {
    const orphanName = extractOrphanName(fixed, p.line);
    if (orphanName) {
      const unit = Math.round((p.kg / p.qty) * 1000) / 1000;
      out.push({
        item: orphanName.toLowerCase(),
        qty: p.qty,
        kg: p.kg,
        unitKg: unit,
        confidence: 40,
        confidenceLevel: "low",
        matchReason: "Item não catalogado — nome lido do OCR",
      });
    } else {
      out.push(fallbackForPair(p, false, undefined));
    }
  }
  if (excludeItems) return out.filter((w) => !isExcluded(w.item));
  return out;
}

export function parseOcrText(rawText: string): ItemMatch[] {
  return parseInventoryOCR(rawText).weights;
}
