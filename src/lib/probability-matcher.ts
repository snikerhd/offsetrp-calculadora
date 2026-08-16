// ══════════════════════════════════════════════════════════════════════════════
// PROBABILISTIC ITEM MATCHER
// 
// Given a quantity and total weight from OCR, calculates the probability that
// each catalog item is the correct match. Uses:
//   1. Weight probability: How close is (totalKg / qty) to the catalog unit weight?
//   2. Name probability: How well does nearby OCR text match the item's patterns?
//   3. Combined confidence score
// ══════════════════════════════════════════════════════════════════════════════

import { ITEM_CATALOG, ITEM_BY_NAME, type ItemDef } from "./item-weights";

// Known alternative weights for items where in-game values differ
const ALT_WEIGHTS: Record<string, number[]> = {
  "arma medio calibre": [5, 7.5, 10],
  "arma alto calibre": [15, 10],
  "arma baixo calibre": [5, 3],
  "relogio ouro": [0.1, 0.2],
};

export interface MatchCandidate {
  item: ItemDef;
  weightProbability: number;      // 0-1: How well the weight matches
  nameProbability: number;        // 0-1: How well the name matches nearby text
  combinedScore: number;          // 0-1: Overall confidence
  computedUnitKg: number;         // What unit weight the OCR implies
  expectedUnitKg: number;         // What the catalog says
  weightDeviation: number;        // Absolute difference in kg
  matchDetails: string;           // Human-readable explanation
}

export interface MatchResult {
  bestMatch: MatchCandidate | null;
  allCandidates: MatchCandidate[];
  qty: number;
  totalKg: number;
  confidence: "high" | "medium" | "low" | "none";
}

// Calculate weight probability using Gaussian distribution
// Perfect match = 1.0, deviation reduces probability
function calculateWeightProbability(
  computedUnitKg: number,
  catalogUnitKg: number,
  altWeights?: number[]
): { probability: number; bestWeight: number } {
  if (catalogUnitKg === 0) {
    // Items with 0 weight (like charros, dinheiro) always match
    return { probability: 1.0, bestWeight: 0 };
  }

  // Check primary weight
  const deviation = Math.abs(computedUnitKg - catalogUnitKg);
  const tolerance = Math.max(0.05, catalogUnitKg * 0.15); // 15% tolerance
  
  // Gaussian-like probability: e^(-(deviation/tolerance)^2)
  let primaryProb = Math.exp(-Math.pow(deviation / tolerance, 2));
  let bestWeight = catalogUnitKg;
  let bestProb = primaryProb;

  // Check alternative weights
  if (altWeights) {
    for (const alt of altWeights) {
      const altDeviation = Math.abs(computedUnitKg - alt);
      const altTolerance = Math.max(0.05, alt * 0.15);
      const altProb = Math.exp(-Math.pow(altDeviation / altTolerance, 2));
      if (altProb > bestProb) {
        bestProb = altProb;
        bestWeight = alt;
      }
    }
  }

  return { probability: bestProb, bestWeight };
}

// Calculate name probability based on pattern matching in nearby text
function calculateNameProbability(
  item: ItemDef,
  nearbyText: string,
  itemPatterns: Map<string, RegExp[]>
): number {
  const patterns = itemPatterns.get(item.name);
  if (!patterns || patterns.length === 0) return 0;

  // Check if any pattern matches
  const normalized = nearbyText.toLowerCase().replace(/\s+/g, " ");
  
  let matchScore = 0;
  for (const pattern of patterns) {
    if (pattern.test(normalized)) {
      // Exact match gets high score
      matchScore = Math.max(matchScore, 0.9);
    }
  }

  // Also check display name similarity
  const displayLower = item.displayName.toLowerCase();
  if (normalized.includes(displayLower)) {
    matchScore = Math.max(matchScore, 1.0);
  }

  // Partial word matching for compound names
  const words = displayLower.split(/\s+/);
  let wordMatches = 0;
  for (const word of words) {
    if (word.length > 2 && normalized.includes(word)) {
      wordMatches++;
    }
  }
  if (words.length > 0) {
    const partialScore = (wordMatches / words.length) * 0.7;
    matchScore = Math.max(matchScore, partialScore);
  }

  return matchScore;
}

// Build pattern map from ITEM_MAP
const ITEM_PATTERNS = new Map<string, RegExp[]>();

// Import patterns (simplified version - in real code these come from ocr-parser)
const PATTERN_DEFS: [RegExp, string][] = [
  [/cristal\s*processado/i, "cristal processado"],
  [/cristal/i, "cristal"],
  [/colete\s*fortalecido/i, "colete fortalecido"],
  [/colete/i, "colete"],
  [/medikit|medick|hedickit/i, "medickits"],
  [/estimulante|estihulante/i, "estimulante"],
  [/carregador\s*(de\s*)?(smg|shg)/i, "carregador medio calibre"],
  [/carregador\s*(de\s*)?pistola/i, "carregador baixo calibre"],
  [/carregador\s*(de\s*)?rifle/i, "carregador alto calibre"],
  [/assault\s*(smg|shg)/i, "arma medio calibre"],
  [/micro\s*(smg|shg)/i, "arma medio calibre"],
  [/machine\s*pistol/i, "arma medio calibre"],
  [/mesa\s*qu[ií]mica/i, "mesa quimica"],
  [/saco\s*pl[aá]stico/i, "saco plastico"],
  [/quadro/i, "quadro"],
  [/pulseira/i, "pulseira ouro"],
  [/rel[oó]gio/i, "relogio ouro"],
  [/corrente/i, "corrente"],
  [/anel/i, "anel"],
  [/diamante\s*bruto/i, "diamante bruto"],
  [/diamante/i, "diamante"],
  [/safira/i, "safiras"],
  [/pepita/i, "pepitas"],
  [/ouro\s*estatal/i, "ouro estatal"],
  [/barra.*ouro/i, "barras ouro"],
  [/lockpick\s*avan[cç]ad/i, "lockpick avancada"],
  [/lockpick/i, "lockpick"],
  [/folha\s*tabaco/i, "folha tabaco"],
  [/ma[cç]o/i, "maço"],
  [/semente.*erva/i, "semente erva"],
  [/semente.*tabaco/i, "semente tabaco"],
  [/mining\s*drill/i, "mining drill"],
  [/cabe[cç]o/i, "cabeco erva"],
  [/saco.*erva/i, "saco erva"],
  [/[oó]leo/i, "oleo medicinal"],
  [/pacote\s*dealer/i, "pacote dealer"],
  [/rebarbadora/i, "rebarbadora"],
  [/algema/i, "algemas"],
  [/charro/i, "charros"],
  [/garrafa.*nitro/i, "garrafa de nitro"],
  [/bomba/i, "bomba"],
  [/c4/i, "c4"],
  [/pager/i, "pager"],
  [/gusenberg/i, "arma alto calibre"],
  [/bullpup/i, "arma alto calibre"],
  [/double\s*barrel/i, "arma alto calibre"],
  [/sns\s*pistol/i, "arma baixo calibre"],
  [/vintage\s*pistol/i, "arma baixo calibre"],
  [/revolver/i, "arma baixo calibre"],
];

// Build the pattern map
for (const [pattern, itemName] of PATTERN_DEFS) {
  if (!ITEM_PATTERNS.has(itemName)) {
    ITEM_PATTERNS.set(itemName, []);
  }
  ITEM_PATTERNS.get(itemName)!.push(pattern);
}

/**
 * Find the best matching item for a given quantity and total weight.
 * Returns all candidates with their probability scores.
 */
export function findBestMatch(
  qty: number,
  totalKg: number,
  nearbyText: string,
  excludeItems: Set<string> = new Set()
): MatchResult {
  if (qty <= 0 || totalKg < 0) {
    return {
      bestMatch: null,
      allCandidates: [],
      qty,
      totalKg,
      confidence: "none",
    };
  }

  const computedUnitKg = totalKg / qty;
  const candidates: MatchCandidate[] = [];

  for (const item of ITEM_CATALOG) {
    if (excludeItems.has(item.name)) continue;

    // Calculate weight probability
    const altWeights = ALT_WEIGHTS[item.name];
    const { probability: weightProb, bestWeight } = calculateWeightProbability(
      computedUnitKg,
      item.unitKg,
      altWeights
    );

    // Calculate name probability
    const nameProb = calculateNameProbability(item, nearbyText, ITEM_PATTERNS);

    // Combined score: weight is 60%, name is 40%
    // But if name probability is 0, weight alone can still work (for recovery)
    let combinedScore: number;
    if (nameProb > 0) {
      combinedScore = weightProb * 0.6 + nameProb * 0.4;
    } else {
      // No name match - use weight only but penalized
      combinedScore = weightProb * 0.4;
    }

    // Build match details
    const deviation = Math.abs(computedUnitKg - bestWeight);
    let details = `Peso: ${(weightProb * 100).toFixed(0)}% `;
    details += `(${computedUnitKg.toFixed(2)} vs ${bestWeight} kg/un, `;
    details += `desvio: ${deviation.toFixed(2)} kg)`;
    if (nameProb > 0) {
      details += ` | Nome: ${(nameProb * 100).toFixed(0)}%`;
    }

    candidates.push({
      item,
      weightProbability: weightProb,
      nameProbability: nameProb,
      combinedScore,
      computedUnitKg,
      expectedUnitKg: bestWeight,
      weightDeviation: deviation,
      matchDetails: details,
    });
  }

  // Sort by combined score descending
  candidates.sort((a, b) => b.combinedScore - a.combinedScore);

  // Determine confidence level
  let confidence: MatchResult["confidence"] = "none";
  const best = candidates[0];
  if (best) {
    if (best.combinedScore >= 0.8) {
      confidence = "high";
    } else if (best.combinedScore >= 0.5) {
      confidence = "medium";
    } else if (best.combinedScore >= 0.2) {
      confidence = "low";
    }
  }

  return {
    bestMatch: best || null,
    allCandidates: candidates.filter((c) => c.combinedScore > 0.1), // Only show relevant ones
    qty,
    totalKg,
    confidence,
  };
}

/**
 * Analyze all possible matches and return a detailed breakdown.
 * Useful for debugging and showing confidence to users.
 */
export function analyzeMatches(
  qty: number,
  totalKg: number,
  nearbyText: string
): {
  computedUnitKg: number;
  topMatches: Array<{
    name: string;
    displayName: string;
    confidence: number;
    weightMatch: string;
    nameMatch: string;
  }>;
} {
  const result = findBestMatch(qty, totalKg, nearbyText);
  
  return {
    computedUnitKg: totalKg / qty,
    topMatches: result.allCandidates.slice(0, 5).map((c) => ({
      name: c.item.name,
      displayName: c.item.displayName,
      confidence: Math.round(c.combinedScore * 100),
      weightMatch: `${Math.round(c.weightProbability * 100)}% (${c.computedUnitKg.toFixed(2)} vs ${c.expectedUnitKg} kg)`,
      nameMatch: `${Math.round(c.nameProbability * 100)}%`,
    })),
  };
}

/**
 * Debug helper: print match analysis for a quantity/weight pair
 */
export function debugMatch(qty: number, totalKg: number, nearbyText: string): void {
  console.log(`\n═══ ANÁLISE DE PROBABILIDADES ═══`);
  console.log(`Quantidade: ${qty}`);
  console.log(`Peso Total: ${totalKg} kg`);
  console.log(`Peso Unitário Calculado: ${(totalKg / qty).toFixed(3)} kg`);
  console.log(`Texto próximo: "${nearbyText.substring(0, 100)}..."`);
  console.log(`─────────────────────────────────`);

  const result = findBestMatch(qty, totalKg, nearbyText);
  
  console.log(`\nTOP 5 CANDIDATOS:`);
  for (let i = 0; i < Math.min(5, result.allCandidates.length); i++) {
    const c = result.allCandidates[i];
    const bar = "█".repeat(Math.round(c.combinedScore * 20));
    const empty = "░".repeat(20 - Math.round(c.combinedScore * 20));
    console.log(`\n${i + 1}. ${c.item.displayName}`);
    console.log(`   Confiança: [${bar}${empty}] ${(c.combinedScore * 100).toFixed(1)}%`);
    console.log(`   ${c.matchDetails}`);
  }

  console.log(`\n─────────────────────────────────`);
  console.log(`MELHOR MATCH: ${result.bestMatch?.item.displayName || "NENHUM"}`);
  console.log(`CONFIANÇA: ${result.confidence.toUpperCase()}`);
  console.log(`═════════════════════════════════\n`);
}
