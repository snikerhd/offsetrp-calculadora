// src/lib/ocr-parser.ts
import { ITEM_DEFINITIONS } from './item-definitions';
import { matchItem, ItemMatch } from './probability-matcher';

const AMBIGUOUS_GROUPS: { names: string[]; weights: number[] }[] = [
  {
    names: ['CORRENTE DE OURO', 'CORRENTE DE OURO 10K'],
    weights: [0.1, 0.15]
  },
];

function fixOcrTypos(text: string): string {
  let fixed = text.toUpperCase().trim();
  fixed = fixed.replace(/\bCORRENTE\s+DE\s+OURO\s+10K\b/gi, 'CORRENTE DE OURO 10K');
  fixed = fixed.replace(/\bCORRENTE\s+10K\b/gi, 'CORRENTE DE OURO 10K');
  return fixed;
}

function disambiguateByWeight(matches: ItemMatch[]): ItemMatch[] {
  return matches.map(match => {
    const group = AMBIGUOUS_GROUPS.find(g => g.names.includes(match.item));
    if (!group) return match;
    const unitWeight = match.kg / match.qty;
    let bestItem = match.item;
    let bestDiff = Infinity;
    for (const name of group.names) {
      const def = ITEM_DEFINITIONS[name];
      if (!def) continue;
      const diff = Math.abs(unitWeight - def.unitKg);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestItem = name;
      }
    }
    if (bestItem !== match.item) {
      const def = ITEM_DEFINITIONS[bestItem];
      return {
        ...match,
        item: bestItem,
        unitKg: def?.unitKg ?? match.unitKg,
        matchReason: `Corrigido por peso: ${match.item} → ${bestItem}`
      };
    }
    return match;
  });
}

function extractQuantityAndWeight(line: string): { qty: number; kg: number } {
  const regex = /(\d+)\s*\(([\d.]+)\)/;
  const match = line.match(regex);
  if (match) {
    return { qty: parseInt(match[1], 10), kg: parseFloat(match[2]) };
  }
  return { qty: 0, kg: 0 };
}

export function parseOcrText(rawText: string): ItemMatch[] {
  const lines = rawText.split('\n').filter(line => line.trim() !== '');
  const rawMatches: ItemMatch[] = [];
  for (const line of lines) {
    const correctedLine = fixOcrTypos(line);
    const { qty, kg } = extractQuantityAndWeight(correctedLine);
    if (!qty || !kg) continue;
    const match = matchItem(correctedLine, kg, qty);
    if (match) {
      rawMatches.push(match);
    }
  }
  return disambiguateByWeight(rawMatches);
}