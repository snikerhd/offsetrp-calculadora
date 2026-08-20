// src/lib/probability-matcher.ts
import { ITEM_DEFINITIONS } from './item-definitions';

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

function calculateNameProbability(ocrText: string, catalogName: string): number {
  const ocrLower = ocrText.toLowerCase().trim();
  const catalogLower = catalogName.toLowerCase().trim();
  if (ocrLower === catalogLower) return 1;
  if (ocrLower.includes(catalogLower) || catalogLower.includes(ocrLower)) return 0.9;
  return 0.5;
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

  for (const [name, def] of Object.entries(ITEM_DEFINITIONS)) {
    const weightProb = calculateWeightProbability(estimatedUnitKg, def.unitKg);
    if (weightProb === 0) continue;
    const nameProb = calculateNameProbability(ocrLine, name);
    const combinedScore = (weightProb * 0.7) + (nameProb * 0.3);
    if (combinedScore > bestCombinedScore) {
      bestCombinedScore = combinedScore;
      bestMatch = {
        item: name,
        qty: quantity,
        kg: estimatedTotalKg,
        unitKg: def.unitKg,
        confidence: combinedScore,
        matchReason: `Peso: ${weightProb.toFixed(2)}, Nome: ${nameProb.toFixed(2)}`
      };
    }
  }
  return bestMatch;
}