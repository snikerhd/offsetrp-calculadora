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

type Hint = { item: string; pos: number; unitKg: number };
type Pair = { qty: number; kg: number; pos: number };

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9().:\n\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function fixOcrTypos(text: string): string {
  let s = text;
  const rules: [RegExp, string][] = [
    [/\bLOCKPECK\b/gi, "LOCKPICK"],
    [/\bLOCKPICK\s+AVANCAD[AO]\b/gi, "LOCKPICK AVANCADA"],
    [/\bTELEN[OÓ]VEL\b/gi, "TELEMOVEL"],
    [/\bTELEHOVEL\b/gi, "TELEMOVEL"],
    [/\bMOMOSHU\b/gi, "MONOSHU"],
    [/\bMEOWCHI\s+MOCHI\b/gi, "MEDWCHI MOCHI"],
    [/\bBTFANA\b/gi, "BIFANA"],
    [/\bCORRENTE\s+DE\s+DURO\b/gi, "CORRENTE DE OURO"],
    [/\b1BK\b/gi, "10K"], [/\b1OK\b/gi, "10K"],
    [/\bREPARA[CÇ]AD\b/gi, "REPARACAO"],
    [/\bSUMO\s+HARACUJA\b/gi, "SUMO MARACUJA"],
    [/\bSUHO\s+MARACUJA\b/gi, "SUMO MARACUJA"],
  ];
  for (const [re, replacement] of rules) s = s.replace(re, replacement);
  return s;
}

function extractPairs(text: string): Pair[] {
  const pairs: Pair[] = [];
  const re = /(\d{1,6})\s*\(\s*(\d+(?:\.\d+)?)\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const qty = Number(m[1]);
    const kg = Number(m[2]);
    if (Number.isFinite(qty) && Number.isFinite(kg) && qty > 0 && kg >= 0) pairs.push({ qty, kg, pos: m.index });
  }
  return pairs;
}

// OCR often outputs the numeric grid separately from the item-name grid. These
// hints cover the split/truncated forms seen in inventory screenshots.
const HINTS: Array<[RegExp, string]> = [
  [/compact\s+rifle/i, "arma alto calibre"],
  [/carregador\s+de\s+rifle/i, "carregador alto calibre"],
  [/carregador\s+de\b/i, "carregador alto calibre"],
  [/restos\s+eletronicos/i, "eletronicos"], [/restos\b/i, "eletronicos"], [/eletronicos/i, "eletronicos"],
  [/machine\s+pistol/i, "arma medio calibre"], [/assault\s+smg/i, "arma medio calibre"],
  [/corrente\s+de\s+ouro\s+10k/i, "corrente 10k"], [/corrente\s+de\s+ouro/i, "corrente"],
  [/anel\s+de\s+diamante/i, "anel"], [/ouro\s+estatal/i, "ouro estatal"],
  [/sumo\s+ananas/i, "sumo ananas"], [/sumo\s+laranja/i, "sumo laranja"], [/sumo\s+maracuja/i, "sumo maracuja"],
  [/bifana/i, "bifana"], [/candy\s+cane/i, "candy cane"], [/radio/i, "radio"], [/telemovel/i, "telemovel"],
  [/petrol\s+can/i, "petrol can"], [/bandagem/i, "bandagem"], [/kit\s+reparacao/i, "kit reparacao"],
  [/lockpick\s+avancada/i, "lockpick avancada"], [/lockpick/i, "lockpick"], [/dinheiro/i, "dinheiro"], [/quadro/i, "quadro"],
  [/arma\s+alto\s+calibre/i, "arma alto calibre"], [/arma\s+medio\s+calibre/i, "arma medio calibre"], [/arma\s+baixo\s+calibre/i, "arma baixo calibre"],
];

const EXTRA_WEIGHTS: Record<string, number> = {
  "candy cane": 0.2,
};

function unitWeight(item: string): number | null {
  if (EXTRA_WEIGHTS[item] != null) return EXTRA_WEIGHTS[item];
  return ITEM_BY_NAME.get(item)?.unitKg ?? null;
}

function displayName(item: string): string {
  const def = ITEM_BY_NAME.get(item);
  if (def) return def.displayName;
  if (item === "candy cane") return "Candy Cane";
  if (item === "eletronicos") return "Restos Eletrónicos";
  return item.replace(/\b\w/g, c => c.toUpperCase());
}

function collectHints(text: string): Hint[] {
  const out: Hint[] = [];
  for (const [re, item] of HINTS) {
    const rx = new RegExp(re.source, `${re.flags.replace(/g/g, "")}g`);
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text))) {
      const unitKg = unitWeight(item);
      if (unitKg != null) out.push({ item, pos: m.index, unitKg });
    }
  }
  out.sort((a, b) => a.pos - b.pos || b.item.length - a.item.length);
  const deduped: Hint[] = [];
  for (const h of out) {
    const prev = deduped[deduped.length - 1];
    if (prev && Math.abs(prev.pos - h.pos) < 4) continue;
    deduped.push(h);
  }
  return deduped;
}

function weightClose(observed: number, expected: number): boolean {
  if (expected <= 0) return false;
  return Math.abs(observed - expected) / expected <= 0.12 || Math.abs(observed - expected) <= 0.02;
}

function confidence(observed: number, expected: number | null, named: boolean): number {
  if (expected == null || expected <= 0) return named ? 0.75 : 0.5;
  const d = Math.abs(observed - expected) / expected;
  if (d <= 0.05) return named ? 0.95 : 0.85;
  if (d <= 0.12) return named ? 0.7 : 0.55;
  return named ? 0.4 : 0.2;
}

function level(c: number): "high" | "medium" | "low" {
  return c >= 0.8 ? "high" : c >= 0.55 ? "medium" : "low";
}

function matchPairsToHints(pairs: Pair[], hints: Hint[]): ItemMatch[] {
  const results: ItemMatch[] = [];
  const used = new Set<number>();
  for (const pair of pairs) {
    const observedUnit = pair.kg / pair.qty;
    let best = -1;
    let bestDiff = Infinity;
    for (let i = 0; i < hints.length; i++) {
      if (used.has(i)) continue;
      const h = hints[i];
      if (!weightClose(observedUnit, h.unitKg)) continue;
      const diff = Math.abs(observedUnit - h.unitKg) / Math.max(h.unitKg, 0.00001);
      if (diff < bestDiff) { bestDiff = diff; best = i; }
    }
    if (best >= 0) {
      used.add(best);
      const h = hints[best];
      const c = confidence(observedUnit, h.unitKg, true);
      results.push({ item: h.item, qty: pair.qty, kg: pair.kg, unitKg: h.unitKg, confidence: c,
        confidenceLevel: level(c), matchReason: `Peso perfeito: ${pair.kg} kg = ${pair.qty} × ${h.unitKg} kg` });
    } else {
      // Never treat standalone values such as 76/72 as quantities. Only a
      // quantity paired with (total weight) can create a recognized item.
      const def = ITEM_CATALOG.find(x => weightClose(observedUnit, x.unitKg));
      if (def) {
        const c = confidence(observedUnit, def.unitKg, false);
        results.push({ item: def.name, qty: pair.qty, kg: pair.kg, unitKg: def.unitKg, confidence: c,
          confidenceLevel: level(c), matchReason: `Peso reconhecido: ${pair.kg} kg = ${pair.qty} × ${def.unitKg} kg` });
      }
    }
  }
  return results;
}

function detectWeaponCapture(text: string): WeaponCapture | null {
  const weapon = text.match(/(?:ARMA|WEAPON)\s*:\s*([^\n]+)/i)?.[1]?.trim() || "";
  const ammo = Number(text.match(/MUNI[CÇ][AÃ]O\s*:\s*(\d+)/i)?.[1] || 0);
  if (!weapon && !ammo) return null;
  let weaponItem: WeaponCapture["weaponItem"] = "arma baixo calibre";
  if (/ALTO|COMBAT PDW|RIFLE|CARABIN|SNIPER|MACHINE PISTOL/i.test(weapon)) weaponItem = "arma alto calibre";
  else if (/MEDIO|M[EÉ]DIO|SMG|PISTOL/i.test(weapon)) weaponItem = "arma medio calibre";
  const ammoItem: WeaponCapture["ammoItem"] = weaponItem === "arma alto calibre" ? "balas alto" : weaponItem === "arma medio calibre" ? "balas medio" : "balas baixo";
  const accessoryCount = Number(text.match(/ACESS[OÓ]RIOS?\s*:\s*(\d+)/i)?.[1] || 0);
  return { weapon, weaponItem, ammo, ammoItem, accessoryCount };
}

export function parseInventoryOCR(rawText: string): ParseResult {
  const fixed = fixOcrTypos(rawText);
  const normalized = normalize(fixed);
  const pairs = extractPairs(fixed);
  const hints = collectHints(normalized);
  const weights = matchPairsToHints(pairs, hints);
  const text = weights.map(w => `${w.qty} ${displayName(w.item)}`).join(", ");
  const overallConfidence = weights.length ? weights.reduce((s, w) => s + w.confidence, 0) / weights.length : 0;
  return { text, weights, weaponCapture: detectWeaponCapture(fixed), overallConfidence };
}

export function parseOcrText(rawText: string): ItemMatch[] {
  return parseInventoryOCR(rawText).weights;
}
