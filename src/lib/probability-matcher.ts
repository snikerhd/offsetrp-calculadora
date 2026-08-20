// src/lib/probability-matcher.ts
// The OCR weight catalog lives in item-weights.ts. Keep this matcher independent
// from the old item-definitions.ts file, which no longer exists in the project.
import { ITEM_CATALOG } from './item-weights';

export interface ItemMatch {
  item: string;
  qty: number;
  kg: number;
  unitKg: number;
  confidence: number;
  matchReason: string;
}

const TOLERANCE_PERCENT = 0.05;
const MAX_DEVIATION_PERCENT = 0.10;

function calculateWeightProbability(estimatedUnitKg: number, catalogUnitKg: number): number {
  if (catalogUnitKg <= 0) return 0;
  const deviation = Math.abs(estimatedUnitKg - catalogUnitKg) / catalogUnitKg;
  if (deviation > MAX_DEVIATION_PERCENT) return 0;
  if (deviation <= TOLERANCE_PERCENT) return 1;
  const range = MAX_DEVIATION_PERCENT - TOLERANCE_PERCENT;
  return 1 - (deviation - TOLERANCE_PERCENT) / range;
}

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function calculateNameProbability(ocrText: string, catalogName: string): number {
  const ocrLower = normalizeName(ocrText);
  const catalogLower = normalizeName(catalogName);
  if (!ocrLower || !catalogLower) return 0;
  if (ocrLower === catalogLower) return 1;
  if (ocrLower.includes(catalogLower) || catalogLower.includes(ocrLower)) return 0.9;
  const ocrWords = new Set(ocrLower.split(/\s+/));
  const catalogWords = catalogLower.split(/\s+/);
  const overlap = catalogWords.filter(word => ocrWords.has(word)).length / catalogWords.length;
  return overlap > 0 ? 0.5 + overlap * 0.4 : 0;
}

export function matchItem(
  ocrLine: string,
  estimatedTotalKg: number,
  quantity: number
): ItemMatch | null {
  if (quantity <= 0 || estimatedTotalKg <= 0) return null;
  const estimatedUnitKg = estimatedTotalKg / quantity;
  let bestMatch: ItemMatch | null = null;
  let bestCombinedScore = -1;

  for (const def of ITEM_CATALOG) {
    const weightProb = calculateWeightProbability(estimatedUnitKg, def.unitKg);
    if (weightProb === 0) continue;
    const nameProb = calculateNameProbability(ocrLine, def.name);
    const displayNameProb = calculateNameProbability(ocrLine, def.displayName);
    const combinedNameProb = Math.max(nameProb, displayNameProb);
    const combinedScore = (weightProb * 0.7) + (combinedNameProb * 0.3);
    if (combinedScore > bestCombinedScore) {
      bestCombinedScore = combinedScore;
      bestMatch = {
        item: def.name,
        qty: quantity,
        kg: estimatedTotalKg,
        unitKg: def.unitKg,
        confidence: combinedScore,
        matchReason: `Peso: ${weightProb.toFixed(2)}, Nome: ${combinedNameProb.toFixed(2)}`
      };
    }
  }
  return bestMatch;
}
