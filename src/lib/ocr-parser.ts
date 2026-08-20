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

// ─────────────────────────────────────────────────────────────────────────────
// Pistas de nomes: geradas a partir do catálogo + aliases + fragmentos
// ─────────────────────────────────────────────────────────────────────────────
const ALIASES: Array<[string, string, number?]> = [
  ["strawberry shortcake", "strawberry shortcake"],
  ["strawberry", "strawberry shortcake"],
  ["shortcake", "strawberry shortcake"],
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
  ["ap pistol", "arma medio calibre", 5],
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
// COLETE FORTALECIDO). Se o prefixo já foi lido, o fragmento funde-se nele.
const FRAGMENTS: Array<[string, string, string | null]> = [
  ["fortalecido", "colete fortalecido", "colete"],
  ["avancada", "lockpick avancada", "lockpick"],
  ["processado", "cristal processado", "cristal"],
  ["cidadao", "cartao de cidadao", "cartao"],
  ["conducao", "carta de conducao", "carta"],
  ["laranja", "sumo laranja", "sumo"],
  ["ananas", "sumo ananas", "sumo"],
  ["maracuja", "sumo maracuja", "sumo"],
  ["estatal", "ouro estatal", null],
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

// Procura as frases em cada linha; devolve pistas com posição/linha.
function collectHints(fixed: string): Hint[] {
  const lines = fixed.split("\n");
  const out: Hint[] = [];
  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li];
    // "SNS PISTOL HK2" / "REVOLVER MK2": o sufixo é um modificador do nome da
    // arma (seguido de espaço), não uma arma própria. "HK2" isolado (separado
    // por tab) é uma arma real e mantém-se. O placeholder preserva o tamanho.
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
    // Temporizador de C4 armado ("1:23" com hora de 1 dígito). Não apanha
    // horas de 2 dígitos como "17:23". Só é usado no passe global (célula órfã).
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
// dentro de "SACO PLASTICO"). A pista longa mantém-se.
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

// Funde fragmentos com o prefixo já lido e descarta pistas falsas.
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

  // Remove fragmentos que não fundiram e que "vivem dentro" de uma pista completa
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

// Deteta o cabeçalho das Coimas Rápidas (item confiscado + breakdown de peso).
// Ex.: "Estimulante / ilegal / Peso reconhecido: 52.4 kg = 262 × 0.2 kg /
// 262 0.2 kg 52,4 kg / 85%". Os nomes aí não pertencem à grelha do inventário.
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

// ─────────────────────────────────────────────────────────────────────────────
// Confiança e correspondência
// ─────────────────────────────────────────────────────────────────────────────
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
    const def = ITEM_CATALOG.find((x) => weightClose(u, x.unitKg));
    if (def) {
      const c = confidence(u, def.unitKg, false);
      return {
        item: def.name,
        qty: p.qty,
        kg: p.kg,
        unitKg: def.unitKg,
        confidence: c,
        confidenceLevel: level(c),
        matchReason: `Peso reconhecido: ${p.kg} kg = ${p.qty} × ${def.unitKg} kg`,
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

// Casamento sequencial (in-order) com ponteiro. Devolve os pares não casados.
function inOrderMatch(pairs: Pair[], hints: Hint[], used: Set<number>, out: ItemMatch[], hintGlobal: Hint[]): Pair[] {
  const leftover: Pair[] = [];
  let last = -1;
  for (const p of pairs) {
    const u = p.kg / p.qty;
    let best = -1;
    for (let i = last + 1; i < hints.length; i++) {
      if (used.has(hintGlobal.indexOf(hints[i])) || !weightClose(u, hints[i].unitKg)) continue;
      best = i;
      break;
    }
    if (best < 0) {
      for (let i = 0; i < hints.length; i++) {
        if (used.has(hintGlobal.indexOf(hints[i])) || !weightClose(u, hints[i].unitKg)) continue;
        best = i;
        break;
      }
    }
    if (best >= 0) {
      const h = hints[best];
      used.add(hintGlobal.indexOf(h));
      last = Math.max(last, best);
      out.push(matchForPair(p, h));
    } else {
      leftover.push(p);
    }
  }
  return leftover;
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

// ─────────────────────────────────────────────────────────────────────────────
// Síntese do jogo: "N× Item — X,kg" (autoritativa quando presente)
// ─────────────────────────────────────────────────────────────────────────────
function matchNameToItem(name: string, u: number): string | null {
  if (!name || name.length < 3) return null;
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

function parseSintese(text: string): ItemMatch[] | null {
  const items: ItemMatch[] = [];
  for (const line of text.split("\n")) {
    const re = /(\d[\d\s]*)\s*[×x]\s*([^—\n]*?)\s*—\s*([\d.,]+)\s*kg/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      const qty = Number(m[1].replace(/\s+/g, ""));
      const kg = Number(m[3].replace(",", "."));
      if (!Number.isFinite(qty) || !Number.isFinite(kg) || qty <= 0) continue;
      const name = normalizeLine(m[2]);
      const u = kg / qty;
      const unidentified =
        !name || name.includes("item cortado") || name.length < 3
          ? true
          : matchNameToItem(name, u) === null;
      const item = unidentified ? `item nao identificado (${Math.round(u * 100) / 100} kg/un)` : matchNameToItem(name, u)!;
      const c = unidentified ? 20 : confidence(u, ITEM_BY_NAME.get(item)?.unitKg ?? u, true);
      items.push({
        item,
        qty,
        kg,
        unitKg: u,
        confidence: c,
        confidenceLevel: level(c),
        matchReason: unidentified ? "Item cortado na síntese" : `Peso perfeito: ${kg} kg = ${qty} × ${ITEM_BY_NAME.get(item)?.unitKg} kg`,
      });
    }
  }
  const identified = items.filter((i) => !i.item.startsWith("item nao identificado"));
  return identified.length >= 2 ? items : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Popup de arma
// ─────────────────────────────────────────────────────────────────────────────
function countAccessories(fixed: string): number {
  const explicit = Number(fixed.match(/ACESS[OÓ]RIOS?\s*:\s*(\d+)/i)?.[1]);
  if (explicit > 0) return explicit;
  const list = fixed.match(/ACESS[OÓ]RIOS?\s*:\s*([^\n]+)/i)?.[1]?.trim();
  if (list) {
    const parts = list.split(/,| e | and |&/i).map(s => s.trim()).filter(s => s && !/^\d+$/.test(s) && s.length > 1);
    if (parts.length > 0) return parts.length;
  }
  return /ACESS[OÓ]RIO/i.test(fixed) ? 1 : 0;
}

function parseWeaponPopup(fixed: string): { capture: WeaponCapture; weights: ItemMatch[] } | null {
  const ammo = Number(fixed.match(/MUNI[CÇ][AÃ]O\s*:\s*(\d+)/i)?.[1] || 0);
  const weapon = fixed.match(/(?:ARMA|WEAPON)\s*:\s*([^\n]+)/i)?.[1]?.trim() || fixed.split("\n")[0]?.trim() || "";
  const accessoryCount = countAccessories(fixed);
  if (!weapon && !ammo && !accessoryCount) return null;

  let weaponItem: WeaponCapture["weaponItem"] = "arma baixo calibre";
  if (/ALTO|RIFLE|CARABIN|SNIPER|GUSENBERG|BULLPUP|FAMAS|SHOTGUN|SPAS|DRACO/i.test(weapon)) weaponItem = "arma alto calibre";
  else if (/MEDIO|M[EÉ]DIO|SMG|MACHINE|PISTOL|UZI|PDW|P90|TEC/i.test(weapon)) weaponItem = "arma medio calibre";
  const ammoItem = weaponItem === "arma alto calibre" ? "balas alto" : weaponItem === "arma medio calibre" ? "balas medio" : "balas baixo";
  const capture: WeaponCapture = { weapon, weaponItem, ammo, ammoItem, accessoryCount };

  const weights: ItemMatch[] = [];
  if (ammo > 0) {
    weights.push({ item: ammoItem, qty: ammo, kg: 0, unitKg: 0, confidence: 95, confidenceLevel: "high", matchReason: `Munição: ${ammo}` });
  }
  if (accessoryCount > 0) {
    weights.push({ item: "acessorios para armas", qty: accessoryCount, kg: 0, unitKg: 0.1, confidence: 95, confidenceLevel: "high", matchReason: `Acessórios: ${accessoryCount}` });
  }
  return { capture, weights };
}

function detectWeaponCapture(text: string): WeaponCapture | null {
  const weapon = text.match(/(?:ARMA|WEAPON)\s*:\s*([^\n]+)/i)?.[1]?.trim() || "";
  const ammo = Number(text.match(/MUNI[CÇ][AÃ]O\s*:\s*(\d+)/i)?.[1] || 0);
  if (!weapon && !ammo) return null;
  let weaponItem: WeaponCapture["weaponItem"] = "arma baixo calibre";
  if (/ALTO|COMBAT PDW|RIFLE|CARABIN|SNIPER|MACHINE PISTOL/i.test(weapon)) weaponItem = "arma alto calibre";
  else if (/MEDIO|M[EÉ]DIO|SMG|PISTOL/i.test(weapon)) weaponItem = "arma medio calibre";
  const ammoItem = weaponItem === "arma alto calibre" ? "balas alto" : weaponItem === "arma medio calibre" ? "balas medio" : "balas baixo";
  const accessoryCount = countAccessories(text);
  return { weapon, weaponItem, ammo, ammoItem, accessoryCount };
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser principal
// ─────────────────────────────────────────────────────────────────────────────
export function parseInventoryOCR(rawText: string): ParseResult {
  const fixed = fixOcrTypos(mergeSplitPairs(rawText));
  const headerLines = detectHeaderLines(fixed.split("\n"));

  if (/numero de serie|num[ée]ro de s[ée]rie/i.test(fixed)) {
    const popup = parseWeaponPopup(fixed);
    if (popup) {
      const text = popup.weights.map((w) => `${w.qty} ${displayName(w.item)}`).join(", ");
      const overall = popup.weights.length ? popup.weights.reduce((s, w) => s + w.confidence, 0) / popup.weights.length : 0;
      return { text, weights: popup.weights, weaponCapture: popup.capture, overallConfidence: overall };
    }
  }

  const sintese = parseSintese(fixed);
  if (sintese) {
    const text = sintese.filter((w) => !w.item.startsWith("item nao identificado")).map((w) => `${w.qty} ${displayName(w.item)}`).join(", ");
    const overall = sintese.length ? sintese.reduce((s, w) => s + w.confidence, 0) / sintese.length : 0;
    return { text, weights: sintese, weaponCapture: null, overallConfidence: overall };
  }

  const anyPairs = extractPairs(fixed).length > 0;
  if (!anyPairs) {
    return { text: "", weights: [], weaponCapture: detectWeaponCapture(fixed), overallConfidence: 0 };
  }

  const hints = mergeFragments(removeCoveredHints(collectHints(fixed).filter((h) => !headerLines.has(h.line))));
  const used = new Set<number>();
  const out: ItemMatch[] = [];

  // Agrupa por linhas: pares (números) seguidos de linhas com nomes.
  const lines = fixed.split("\n");
  const linePairs = lines.map((l) => extractPairs(l));
  const lineHints = lines.map((_, i) => hints.filter((h) => h.line === i));

  const groups: Array<{ pairs: Pair[]; nameLines: number[] }> = [];
  const leadingNames: number[] = [];
  let cur: { pairs: Pair[]; nameLines: number[] } | null = null;
  for (let i = 0; i < lines.length; i++) {
    if (linePairs[i].length > 0) {
      if (cur && cur.nameLines.length === 0) {
        cur.pairs.push(...linePairs[i]);
      } else {
        if (cur) groups.push(cur);
        cur = { pairs: [...linePairs[i]], nameLines: [] };
      }
    } else if (lineHints[i].length > 0) {
      if (cur) cur.nameLines.push(i);
      else leadingNames.push(i);
    }
  }
  if (cur) groups.push(cur);
  if (groups.length > 0 && leadingNames.length > 0) {
    groups[0].nameLines.unshift(...leadingNames);
  }

  // Casamento por grupo: usa a linha de nomes na ordem vertical. Linhas cujos
  // nomes são um subconjunto estrito de outra linha do mesmo grupo são ruído
  // (ex.: "CORRENTE DE OURO" solta dentro do grupo que já tem a linha completa).
  const leftoverGroups: Array<{ pairs: Pair[]; hadNames: boolean; items: Set<string>; nameHintIdx: number[] }> = [];
  for (const g of groups) {
    if (g.pairs.length === 0) continue;
    if (g.nameLines.length === 0) {
      leftoverGroups.push({ pairs: g.pairs, hadNames: false, items: new Set(), nameHintIdx: [] });
      continue;
    }
    const hintItems = (li: number): Set<string> => new Set(lineHints[li].map((h) => h.item));
    const isSubset = (a: number, b: number): boolean => {
      const A = hintItems(a);
      const B = hintItems(b);
      return A.size < B.size && Array.from(A).every((x) => B.has(x));
    };
    const names = g.nameLines.filter((li) => !g.nameLines.some((lj) => lj !== li && isSubset(li, lj)));
    const candidates = names.flatMap((li) => lineHints[li].filter((h) => !h.timer));
    const groupItems = new Set(g.nameLines.flatMap((li) => lineHints[li].map((h) => h.item)));
    const nameHintIdx = g.nameLines.flatMap((li) => lineHints[li].map((h) => hints.indexOf(h)));
    const leftover = inOrderMatch(g.pairs, candidates, used, out, hints);
    if (leftover.length > 0) leftoverGroups.push({ pairs: leftover, hadNames: true, items: groupItems, nameHintIdx });
  }

  // Passo global: pares que sobraram casam com qualquer pista ainda livre.
  const allLeftover = leftoverGroups.flatMap((g) => g.pairs);
  const remainingHints = hints.filter((_, i) => !used.has(i));
  const leftoverFinal = inOrderMatch(allLeftover, remainingHints, used, out, hints);

  for (const p of leftoverFinal) {
    const grp = leftoverGroups.find((g) => g.pairs.includes(p));
    const hasUnusedName = (grp?.nameHintIdx.some((i) => !used.has(i)) ?? false);
    out.push(fallbackForPair(p, !(grp?.hadNames ?? false), hasUnusedName ? grp?.items : undefined));
  }

  const merged = mergeResults(out);
  const text = merged.filter((w) => !w.item.startsWith("item nao identificado")).map((w) => `${w.qty} ${displayName(w.item)}`).join(", ");
  const overall = merged.length ? merged.reduce((s, w) => s + w.confidence, 0) / merged.length : 0;
  return { text, weights: merged, weaponCapture: detectWeaponCapture(fixed), overallConfidence: overall };
}

export function parseOcrText(rawText: string): ItemMatch[] {
  return parseInventoryOCR(rawText).weights;
}