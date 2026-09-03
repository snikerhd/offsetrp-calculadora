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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// CorreÃ§Ã£o de typos comuns de OCR (nomes de itens do jogo)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TYPO_RULES: Array<[RegExp, string]> = [
  [/\bLOCKPECK\b/gi, "LOCKPICK"],
  [/\bLOCKPICK\s+AVANCAD[AO]\b/gi, "LOCKPICK AVANCADA"],
  [/\bTELEN[OÃ“]VEL\b/gi, "TELEMOVEL"],
  [/\bTELEHOVEL\b/gi, "TELEMOVEL"],
  [/\bTELEH[OÃ“]VEL\b/gi, "TELEMOVEL"],
  [/\bHEDACHI\s+MOCHI\b/gi, "MEDWCHI MOCHI"],
  [/\bHEOWCHI\s+MOCHI\b/gi, "MONOSHU"],
  [/\bMEOWCHI\s+MOCHI\b/gi, "MEDWCHI MOCHI"],
  [/\bMOMOSHU\b/gi, "MONOSHU"],
  [/\bHOHOSHU\b/gi, "MONOSHU"],
  [/\bSTRAWBELLY\b/gi, "STRAWBERRY"],
  [/\bBTFANA\b/gi, "BIFANA"],
  [/\bCORRENTE\s+DE\s+DURO\b/gi, "CORRENTE DE OURO"],
  [/\bRELOGIO\s+DE\s+DURO\b/gi, "RELOGIO DE OURO"],
  [/\bREPARA[CÃ‡]AD\b/gi, "REPARACAO"],
  [/\bSUMO\s+HARACUJA\b/gi, "SUMO MARACUJA"],
  [/\bSUHO\s+MARACUJA\b/gi, "SUMO MARACUJA"],
  [/\bHACHINE\b/gi, "MACHINE"],
  [/\bSHG\b/gi, "SMG"],
  [/\bSUNO\b/gi, "SUMO"],
  [/\bHEDICKIT\b/gi, "MEDICKIT"],
  [/\bBANDAGEN\b/gi, "BANDAGEM"],
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
  // Wâ†’H confundido pelo OCR (como HESAâ†’MESA)
  [/\bHISKY\b/gi, "WHISKY"],
  // Primeira letra cortada pelo OCR
  [/\bONTRABANDO\b/gi, "CONTRABANDO"],
  [/\bISKY\b/gi, "WHISKY"],
  // Nomes de caixa partidos em duas linhas (CAIXA/CONTRABANDO/etc.) sÃ£o fundidos
  // no prÃ©-processamento do route (mergeCaixaMultiline), numa Ãºnica passagem sem
  // re-casamento. Manter regras multi-linha aqui faria o parser re-fundir em
  // cadeia (efeito "CAIXA CAIXA ELETRONICOS"). Aqui sÃ³ a correÃ§Ã£o simples.
  [/\bCAXA\b/gi, "CAIXA"],
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

// Junta um par partido em duas linhas: "1\n(1.0)" â†’ "1 (1.0)".
function mergeSplitPairs(text: string): string {
  return text.replace(/(\d{1,7})\s*\n\s*\(\s*(\d+(?:\.\d+)?)\s*\)/g, "$1 ($2)");
}

// Recupera fragmentos "N0-D)" -> "N (0.D) NOME": o OCR corrompe o par
// "7 (0.7)" como "70-7)" ("(" vira "0-"). O peso total / qty dÃ¡ o peso
// unitÃ¡rio, que identifica o item no catÃ¡logo (nome presente no texto,
// excluindo os jÃ¡ recuperados pela regra da letra).
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
      if (cands.length !== 1) return m; // ambÃ­guo ou sem candidato: deixa como estÃ¡
      used.add(cands[0].name);
      return `${qty} (${total}) ${cands[0].name}`;
    }
  );
}

// Recupera pares com o qty corrompido pelo OCR: o peso "(0.1)" fica com a
// INICIAL do nome no lugar do nÃºmero e o qty cai para a linha seguinte:
//   "Meteor Street, A(0.1)\n1"  ->  "1 (0.1) algemas"
// A letra inicial + o peso unitÃ¡rio identificam o item no catÃ¡logo (apenas
// itens ilegais cujo nome aparece no texto) â€” evita adivinhar.
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
      if (cands.length !== 1) return m; // ambÃ­guo ou sem candidato: deixa como estÃ¡
      used.add(cands[0].name);
      return `${qty} (${peso}) ${cands[0].name}`;
    }
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Pistas de nomes: geradas a partir do catÃ¡logo + aliases + fragmentos
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ALIASES: Array<[string, string, number?]> = [
  ["strawberry shortcake", "strawberry shortcake"],
  ["strawberry", "strawberry shortcake"],
  ["vintage pistol", "arma baixo calibre", 5],
  ["vintage", "arma baixo calibre", 5],
  ["knife", "knife"],
  ["faca", "knife"],
  ["carregador de smg", "carregador medio calibre"],
  ["carregador smg", "carregador medio calibre"],
  ["carregador de rifle", "carregador alto calibre"],
  ["carregador de pistola", "carregador baixo calibre"],
  ["machine pistol", "arma medio calibre", 5],
  ["micro smg", "arma medio calibre", 10],
  ["assault smg", "arma medio calibre", 10],
  ["combat pdw", "arma medio calibre", 5],
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
  ["maÃ§o tabaco", "maÃ§o"],
  ["maÃ§o de tabaco", "maÃ§o"],
  ["suporte secagem", "suporte de secagem"],
  ["restos eletronicos", "eletronicos"],
  ["resto eletronico", "eletronicos"],
  ["candy cane", "candy cane"],
  ["candy", "candy cane"],
  // "ÃGUA" cortada pelo OCR aparece como "ÃGI"
  ["agi", "agua"],
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
];

// Fragmentos: sufixo de um nome partido pelo OCR (ex.: FORTALECIDO de
// COLETE FORTALECIDO). Se o prefixo jÃ¡ foi lido, o fragmento funde-se nele.
const FRAGMENTS: Array<[string, string, string | null]> = [
  ["fortalecido", "colete fortalecido", "colete"],
  ["avancada", "lockpick avancada", "lockpick"],
  ["processado", "cristal processado", "cristal"],
  ["cidadao", "cartao de cidadao", "cartao"],
  // "CARTÃƒO DE" numa linha e "CIDADÃƒO" noutra: a primeira metade sozinha nÃ£o
  // deve virar um CartÃ£o normal
  ["cartao de", "cartao de cidadao", null],
  ["conducao", "carta de conducao", "carta"],
  ["laranja", "sumo laranja", "sumo"],
  ["ananas", "sumo ananas", "sumo"],
  ["maracuja", "sumo maracuja", "sumo"],
  ["secagem", "suporte de secagem", null],
  ["estatal", "ouro estatal", null],
  // "STRAWBELLY" numa linha e "SHORTCAKE" noutra: o nome partido nÃ£o deve
  // criar duas pistas do mesmo item (o fragmento funde-se na pista strawberry)
  ["shortcake", "strawberry shortcake", "strawberry shortcake"],
  // GINGERKITTY ... COOKIE partido (MOMOSHU pode ficar no meio): o fragmento
  // COOKIE mapeia para gingerkitty cookie sem precisar de prefixo separado.
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
  return out;
}

// Procura as frases em cada linha; devolve pistas com posiÃ§Ã£o/linha.
function collectHints(fixed: string): Hint[] {
  const lines = fixed.split("\n");
  const out: Hint[] = [];
  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li];
    // "SNS PISTOL HK2" / "REVOLVER MK2": o sufixo Ã© um modificador do nome da
    // arma (seguido de espaÃ§o), nÃ£o uma arma prÃ³pria. "HK2" isolado (separado
    // por tab) Ã© uma arma real e mantÃ©m-se. O placeholder preserva o tamanho.
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
    // Temporizador de C4 armado ("1:23" com hora de 1 dÃ­gito). NÃ£o apanha
    // horas de 2 dÃ­gitos como "17:23". SÃ³ Ã© usado no passe global (cÃ©lula Ã³rfÃ£).
    const timerRe = /\b([1-9]):(\d{2})\b/g;
    let tm: RegExpExecArray | null;
    while ((tm = timerRe.exec(rawSafe))) {
      out.push({ item: "c4", pos: tm.index, line: li, unitKg: 1, frag: false, span: 3, timer: true });
    }
  }
  return out;
}

// Remove pistas curtas totalmente cobertas por outra frase mais longa na mesma
// linha (ex.: "diamante"/"anel" dentro de "ANEL DE DIAMANTE", "plastico"
// dentro de "SACO PLASTICO"). A pista longa mantÃ©m-se.
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

// Funde fragmentos com o prefixo jÃ¡ lido e descarta pistas falsas.
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

  // Remove fragmentos que nÃ£o fundiram e que "vivem dentro" de uma pista completa
  // (ex.: "smg" dentro de "assault smg").
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

// Deteta o cabeÃ§alho das Coimas RÃ¡pidas (item confiscado + breakdown de peso).
// Ex.: "Estimulante / ilegal / Peso reconhecido: 52.4 kg = 262 Ã— 0.2 kg /
// 262 0.2 kg 52,4 kg / 85%". Os nomes aÃ­ nÃ£o pertencem Ã  grelha do inventÃ¡rio.
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ConfianÃ§a e correspondÃªncia
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    matchReason: `Peso perfeito: ${p.kg} kg = ${p.qty} Ã— ${h.unitKg} kg`,
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
          matchReason: `Peso reconhecido: ${p.kg} kg = ${p.qty} Ã— ${named.unitKg} kg`,
        };
      }
    }
    // SÃ³ adivinha pelo peso se o peso for pouco ambÃ­guo: com muitos itens no
    // catÃ¡logo a partilhar o mesmo peso unitÃ¡rio (0,1 kg tem mais de uma
    // dÃºzia), atribuir o primeiro Ã© quase sempre errado â€” melhor marcar como
    // nÃ£o identificado do que inventar um item.
    const candidates = ITEM_CATALOG.filter((x) => weightClose(u, x.unitKg));
    if (candidates.length > 0 && candidates.length <= 6) {
      const def = candidates[0];
      const c = confidence(u, def.unitKg, false);
      return {
        item: def.name,
        qty: p.qty,
        kg: p.kg,
        unitKg: def.unitKg,
        confidence: c,
        confidenceLevel: level(c),
        matchReason: `Peso reconhecido: ${p.kg} kg = ${p.qty} Ã— ${def.unitKg} kg`,
      };
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// AtribuiÃ§Ã£o global parâ†”nome
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// O OCR nÃ£o lÃª a grelha do inventÃ¡rio sempre pela mesma ordem: Ã s vezes os
// nomes vÃªm depois dos nÃºmeros, Ã s vezes antes (ex.: "SMG / CARREGADOR DE" no
// topo do par "1 (0.2)"). Em vez de casamento sequencial por grupos, cada par
// "qty (kg)" Ã© atribuÃ­do a uma pista de nome compatÃ­vel pelo peso, minimizando
// custo global:
//   - distÃ¢ncia em linhas entre par e pista;
//   - desvio do peso unitÃ¡rio;
//   - cruzamentos (pares em ordem devem preferir pistas em ordem);
//   - duplicar o mesmo item em duas pistas custa extra;
//   - ficar sem pista custa ainda mais.
// Empates resolvem-se pela ordem do texto (sequÃªncia de pistas lexicograficamente
// menor, indexada por ordem original dos pares).
function assignPairsToHints(
  pairs: Pair[],
  hints: Hint[]
): { matchOf: Map<Pair, Hint>; leftover: Pair[] } {
  const matchOf = new Map<Pair, Hint>();
  const usedHint = new Array<boolean>(hints.length).fill(false);

  // â”€â”€ Fase 1: casamento por blocos â”€â”€
  // A grelha do jogo desenha cada linha visual como "N quantidades" seguidas
  // de "N nomes" (ou o inverso, conforme o OCR). Linhas consecutivas formam um
  // bloco e o i-Âº par do bloco casa com a i-Âª pista compatÃ­vel â€” muito mais
  // fiÃ¡vel do que a distÃ¢ncia bruta quando os nomes ficam entre duas linhas
  // de quantidades.
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
      if (cur && ln === cur.end + 1) {
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
      if (cur && ln === cur.end + 1) {
        cur.items.push(i);
        cur.end = ln;
      } else {
        cur = { items: [i], start: ln, end: ln };
        hintBlocksByIdx.push(cur);
      }
    }
  }

  // Casamento ordenado dentro de um bloco: maximiza atribuiÃ§Ãµes, depois
  // minimiza custo (distÃ¢ncia de linhas + desvio de peso). NÃƒO-CRUZADO: o par
  // seguinte sÃ³ pode usar pistas depois da pista do par anterior (a grelha lÃª-
  // se da esquerda para a direita) â€” evita que dois pares roubem pistas
  // duplicadas do mesmo nome deixando outro nome Ã³rfÃ£o.
  const blockMatch = (
    pIdx: number[],
    hIdx: number[]
  ): { score: number; map: Array<[number, number]> } => {
    const n = pIdx.length;
    let bestScore = Infinity;
    let bestMap: Array<[number, number]> = [];
    const curMap = new Map<number, number>();
    const dfs = (k: number, lastHi: number, assigned: number, cost: number) => {
      if (cost > bestScore) return;
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
        if (hi <= lastHi || usedHint[hi] || !weightClose(u, hints[hi].unitKg)) continue;
        const d = Math.abs(hints[hi].line - pairs[pi].line);
        const dev = Math.abs(u - hints[hi].unitKg) / (hints[hi].unitKg || 1);
        curMap.set(pi, hi);
        dfs(k + 1, hi, assigned + 1, cost + d * 2 + dev * 10);
        curMap.delete(pi);
      }
      dfs(k + 1, lastHi, assigned, cost);
    };
    dfs(0, -1, 0, 0);
    return { score: bestScore, map: bestMap };
  };

  for (const pb of pairBlocksByIdx) {
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

  // â”€â”€ Fase 2: otimizador global para os que sobraram â”€â”€
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
  // Pares com menos candidatos primeiro: podam a Ã¡rvore mais cedo.
  const order = restPairs
    .map((_, i) => i)
    .sort((a, b) => cand[a].length - cand[b].length || a - b);

  const UNASSIGNED_PENALTY = 500;
  const DUP_PENALTY = 8;
  const CROSS_PENALTY = 12;

  const itemCount = new Map<string, number>();
  for (const [, h] of matchOf) itemCount.set(h.item, (itemCount.get(h.item) ?? 0) + 1);
  const cur = new Array<number>(restPairs.length).fill(-1);
  let bestSeq: number[] | null = null;
  let bestScore = Infinity;

  // Penaliza atribuiÃ§Ãµes que "cruzam" com pares jÃ¡ atribuÃ­dos: se o par A estÃ¡
  // acima do par B, A deve preferir pistas acima das de B.
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
    if (cost > bestScore) return;
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
    // nota: restHints jÃ¡ exclui as pistas usadas na fase 1, por isso nÃ£o hÃ¡
    // verificaÃ§Ã£o de usedHint aqui (os Ã­ndices sÃ£o de restHints).
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
    dfs(k + 1, assigned, cost + UNASSIGNED_PENALTY);
  };

  dfs(0, 0, 0);

  const leftover: Pair[] = [];
  for (let pi = 0; pi < restPairs.length; pi++) {
    const hi = bestSeq ? bestSeq[pi] : -1;
    if (hi >= 0) matchOf.set(restPairs[pi], restHints[hi]);
    else leftover.push(restPairs[pi]);
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
  }
  return Array.from(map.values());
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// SÃ­ntese do jogo: "NÃ— Item â€” X,kg" (autoritativa quando presente)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function matchNameToItem(name: string, u: number): string | null {
  if (!name || name.length < 3) return null;
  // Nome exato do catÃ¡logo: aceita mesmo se o peso divergir (o jogo pode ter
  // pesos diferentes dos registados; o nome na sÃ­ntese Ã© explÃ­cito).
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
      ? `Peso perfeito: ${kg} kg = ${qty} Ã— ${ITEM_BY_NAME.get(item)?.unitKg ?? u} kg`
      : "Item cortado na sÃ­ntese",
  };
}

function parseSintese(text: string): ItemMatch[] | null {
  const items: ItemMatch[] = [];
  // Formato verboso do jogo (autoritativo):
  // "NOME â€” Quantidade: N â€” Peso de cada: W kg â€” Peso total: T kg"
  // O OCR pode trocar o travessÃ£o por hÃ­fen/en-dash, por isso aceita qualquer
  // variante de traÃ§o como separador.
  const verboseRe =
    /([^\nâ€”â€“â€•-]{3,80}?)\s*[â€”â€“â€•-]\s*Quantidade\s*:\s*(\d[\d\s]*)\s*[â€”â€“â€•-]\s*Peso\s+de\s+cada\s*:\s*(\d+(?:[.,]\d+)?)\s*kg\s*[â€”â€“â€•-]\s*Peso\s+total\s*:\s*(\d+(?:[.,]\d+)?)\s*kg/gi;
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
    const re = /(\d[\d\s]*)\s*[Ã—x]\s*([^â€”â€“â€•\n-]*?)\s*[â€”â€“â€•-]\s*([\d.,]+)\s*kg/g;
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Popup de arma
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Identifica a arma pelo NOME conhecido no texto (aliases do catÃ¡logo que
// mapeiam para "arma X calibre"). Escolhe o match mais especÃ­fico (nome mais
// comprido) para "Machine Pistol" ganhar sobre o genÃ©rico "Pistol".
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
  const explicit = Number(fixed.match(/ACESS[OÃ“]RIOS?\s*:\s*(\d+)/i)?.[1]);
  if (explicit > 0) return explicit;
  // A lista pode continuar na linha seguinte quando a linha termina em vÃ­rgula
  // (ex.: "Rifle Scope,\nRifle Flashlight"). Captura todas as linhas de
  // continuaÃ§Ã£o (linhas terminadas em ",\n") antes da Ãºltima.
  const list = fixed.match(/ACESS[OÃ“]RIOS?\s*:\s*((?:[^\n]+,\s*\n)*[^\n]+)/i)?.[1]?.trim();
  if (list) {
    const parts = list.split(/,| e | and |&/i).map(s => s.trim()).filter(s => s && !/^\d+$/.test(s) && s.length > 1);
    if (parts.length > 0) return parts.length;
  }
  return /ACESS[OÃ“]RIO/i.test(fixed) ? 1 : 0;
}

function parseWeaponPopup(fixed: string, includeWeapon = false): { capture: WeaponCapture; weights: ItemMatch[] } | null {
  const ammo = Number(fixed.match(/MUNI[CÃ‡][AÃƒ]O\s*:\s*(\d+)/i)?.[1] || 0);
  // A arma Ã© identificada pelo NOME conhecido no texto (ex.: "Machine Pistol"
  // -> arma medio calibre), nÃ£o pela primeira linha (que Ã© lixo do OCR).
  const knownWeapon = findWeaponInText(fixed);
  const weapon = knownWeapon ? displayName(knownWeapon) : (fixed.match(/(?:ARMA|WEAPON)\s*:\s*([^\n]+)/i)?.[1]?.trim() || fixed.split("\n")[0]?.trim() || "");
  const accessoryCount = countAccessories(fixed);
  if (!weapon && !ammo && !accessoryCount) return null;

  const weaponItem = knownWeapon || (() => {
    if (/ALTO|RIFLE|CARABIN|SNIPER|GUSENBERG|BULLPUP|FAMAS|SHOTGUN|SPAS|DRACO/i.test(weapon)) return "arma alto calibre" as const;
    if (/MEDIO|M[EÃ‰]DIO|SMG|MACHINE|UZI|PDW|P90|TEC/i.test(weapon)) return "arma medio calibre" as const;
    return "arma baixo calibre" as const;
  })();
  const ammoItem = weaponItem === "arma alto calibre" ? "balas alto" : weaponItem === "arma medio calibre" ? "balas medio" : "balas baixo";
  const capture: WeaponCapture = { weapon, weaponItem, ammo, ammoItem, accessoryCount };

  const weights: ItemMatch[] = [];
  if (ammo > 0) {
    weights.push({ item: ammoItem, qty: ammo, kg: 0, unitKg: 0, confidence: 95, confidenceLevel: "high", matchReason: `MuniÃ§Ã£o: ${ammo}` });
  }
  if (accessoryCount > 0) {
    weights.push({ item: "acessorios para armas", qty: accessoryCount, kg: 0, unitKg: 0.1, confidence: 95, confidenceLevel: "high", matchReason: `AcessÃ³rios: ${accessoryCount}` });
  }
  // Modo Coimas RÃ¡pidas: incluir a ARMA em si (1x) â€” o inventÃ¡rio tambÃ©m a
  // mostra, mas o popup garante a deduplicaÃ§Ã£o (sÃ³ entra aqui, uma vez).
  if (includeWeapon) {
    const def = ITEM_BY_NAME.get(weaponItem);
    weights.push({ item: weaponItem, qty: 1, kg: def?.unitKg ?? 0, unitKg: def?.unitKg ?? 0, confidence: 95, confidenceLevel: "high", matchReason: "Arma inspecionada (nÃºmero de sÃ©rie)" });
  }
  return { capture, weights };
}

function detectWeaponCapture(text: string): WeaponCapture | null {
  const weapon = text.match(/(?:ARMA|WEAPON)\s*:\s*([^\n]+)/i)?.[1]?.trim() || "";
  const ammo = Number(text.match(/MUNI[CÃ‡][AÃƒ]O\s*:\s*(\d+)/i)?.[1] || 0);
  if (!weapon && !ammo) return null;
  let weaponItem: WeaponCapture["weaponItem"] = "arma baixo calibre";
  if (/ALTO|COMBAT PDW|RIFLE|CARABIN|SNIPER|MACHINE PISTOL/i.test(weapon)) weaponItem = "arma alto calibre";
  else if (/MEDIO|M[EÃ‰]DIO|SMG/i.test(weapon)) weaponItem = "arma medio calibre";
  const ammoItem = weaponItem === "arma alto calibre" ? "balas alto" : weaponItem === "arma medio calibre" ? "balas medio" : "balas baixo";
  const accessoryCount = countAccessories(text);
  return { weapon, weaponItem, ammo, ammoItem, accessoryCount };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Parser principal
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function parseInventoryOCR(rawText: string, opts?: { includeWeapon?: boolean }): ParseResult {
  const includeWeapon = opts?.includeWeapon ?? false;
  const usedRecover = new Set<string>();
  // O OCR do Gyazo repete o conteÃºdo duas vezes: primeiro a grelha embaralhada
  // (todas as quantidades num bloco, todos os nomes noutro), depois as linhas
  // estruturadas "N (peso)  Nome  peso-unit" â€” que jÃ¡ emparelham qtyâ†”nome
  // corretamente. Se existirem linhas estruturadas suficientes, usamos SÃ“ elas:
  // evita que o atribuidor consuma pistas do bloco embaralhado e troque itens
  // com o mesmo peso unitÃ¡rio (ex.: Folha de Tabaco â†” Sumo Laranja, 0,2 kg).
  const summaryLines = /numero de serie|num[Ã©e]ro de s[Ã©e]rie/i.test(rawText)
    ? []
    : rawText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => /^\d{1,7}\s*\(\s*\d+(?:[.,]\d+)?\s*\)\s+\S/i.test(l) && /\d+(?:[.,]\d+)?\s*kg/i.test(l));
  const useSummary = summaryLines.length >= 2 && summaryLines.length * 3 <= rawText.split("\n").length + 4;
  const sourceText = useSummary ? summaryLines.join("\n") : rawText;
  const fixed = fixOcrTypos(
    mergeSplitPairs(recoverFragmentQty(recoverCorruptedQty(sourceText, usedRecover), usedRecover))
  );
  const headerLines = detectHeaderLines(fixed.split("\n"));

  // Texto "embaralhado" = a maioria dos pares qty(peso) não tem nome na mesma
  // linha (o OCR leu quantidades e nomes em blocos separados). Nesse caso,
  // itens com peso unitário igual podem ter sido trocados entre si.
  const allPairs = extractPairs(fixed);
  const structuredPairLines = allPairs.filter((p) => {
    const l = fixed.split("\n")[p.line] ?? "";
    const withoutPair = l.replace(/\d{1,7}\s*\(\s*[\d.,]+\s*\)/g, "").replace(/[\d.,:\s]/g, "");
    return /[a-zA-Z\u00C0-\u00FF]/.test(withoutPair);
  }).length;
  const scrambledText = allPairs.length > 0 && structuredPairLines / allPairs.length < 0.5;

  if (/numero de serie|num[Ã©e]ro de s[Ã©e]rie/i.test(fixed)) {
    const popup = parseWeaponPopup(fixed, includeWeapon);
    if (popup) {
      if (!includeWeapon) {
        // Modo RelatÃ³rios (comportamento original): sÃ³ balas + acessÃ³rios do
        // popup â€” o resto do inventÃ¡rio e a arma nÃ£o entram.
        const text = popup.weights.map((w) => `${w.qty} ${displayName(w.item)}`).join(", ");
        const overall = popup.weights.length ? popup.weights.reduce((s, w) => s + w.confidence, 0) / popup.weights.length : 0;
        return { text, weights: popup.weights, weaponCapture: popup.capture, overallConfidence: overall };
      }
      // Modo Coimas RÃ¡pidas: popup (balas + acessÃ³rios + ARMA 1x) + o resto do
      // inventÃ¡rio. Todas as hints de ARMAS sÃ£o excluÃ­das do inventÃ¡rio (o
      // "MACHINE PISTOL" do inventÃ¡rio Ã© a mesma arma que estÃ¡ a ser
      // inspecionada â€” e aliases genÃ©ricos como "pistol" tambÃ©m casam nele,
      // o que criaria uma 2Âª arma fantasma).
      const body = parseInventoryBody(fixed, headerLines, WEAPON_ITEM_RE);
      const merged = flagSameWeightAmbiguity(mergeResults([...body, ...popup.weights]), scrambledText);
      const text = merged.filter((w) => !w.item.startsWith("item nao identificado")).map((w) => `${w.qty} ${displayName(w.item)}`).join(", ") + ambiguityWarning(merged, scrambledText);
      const overall = merged.length ? merged.reduce((s, w) => s + w.confidence, 0) / merged.length : 0;
      return { text, weights: merged, weaponCapture: popup.capture, overallConfidence: overall };
    }
  }

// Itens diferentes com o MESMO peso unitÃ¡rio (ex.: Estimulante e Sumo AnanÃ¡s,
// ambos 0,2 kg) podem ser trocados entre si quando o OCR vem embaralhado e sem
// o resumo estruturado â€” a atribuiÃ§Ã£o por proximidade de linhas Ã© ambÃ­gua.
// Marcamos esses itens com confianÃ§a reduzida e acrescentamos um aviso ao texto.
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
  return groups.length ? ` â€” âš  ATENÃ‡ÃƒO: ${groups.join("; ")} tÃªm o mesmo peso e podem estar trocados; confirma as quantidades.` : "";
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
    return { text: "", weights: [], weaponCapture: detectWeaponCapture(fixed), overallConfidence: 0 };
  }

  const body = parseInventoryBody(fixed, headerLines);
  const merged = flagSameWeightAmbiguity(mergeResults(body), scrambledText);
  const text = merged.filter((w) => !w.item.startsWith("item nao identificado")).map((w) => `${w.qty} ${displayName(w.item)}`).join(", ") + ambiguityWarning(merged, scrambledText);
  const overall = merged.length ? merged.reduce((s, w) => s + w.confidence, 0) / merged.length : 0;
  return { text, weights: merged, weaponCapture: detectWeaponCapture(fixed), overallConfidence: overall };
}

// Fluxo normal do inventÃ¡rio: pares "qty (peso)" casados com pistas de nome.
// excludeItems: itens a ignorar (ex.: a arma jÃ¡ contada pelo popup).
const WEAPON_ITEM_RE = /^arma (baixo|medio|alto) calibre$/;
function parseInventoryBody(fixed: string, headerLines: Set<number>, excludeItems?: Set<string> | RegExp): ItemMatch[] {
  const isExcluded = (item: string) =>
    excludeItems instanceof RegExp ? excludeItems.test(item) : excludeItems?.has(item) ?? false;
  const hints = mergeFragments(removeCoveredHints(collectHints(fixed).filter((h) => !headerLines.has(h.line))));
  const out: ItemMatch[] = [];

  const allPairs = extractPairs(fixed);
  const usableHints = hints.filter((h) => !h.timer && !isExcluded(h.item));
  const { matchOf, leftover } = assignPairsToHints(allPairs, usableHints);
  for (const p of allPairs) {
    const h = matchOf.get(p);
    if (h) out.push(matchForPair(p, h));
  }
  for (const p of leftover) {
    out.push(fallbackForPair(p, false, undefined));
  }
  // ExclusÃ£o aplicada tambÃ©m ao resultado final: o fallback adivinha pelo peso
  // e pode re-introduzir itens excluÃ­dos (ex.: a arma jÃ¡ contada pelo popup).
  if (excludeItems) return out.filter((w) => !isExcluded(w.item));
  return out;
}

export function parseOcrText(rawText: string): ItemMatch[] {
  return parseInventoryOCR(rawText).weights;
}