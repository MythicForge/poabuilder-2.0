import type { BuilderFeat } from './characterTypes';

export interface FeatStatus {
  blocked: boolean;
  reason: string | null;
}

// Feat cost by character tier (Renown)
export const FEAT_COST_BY_TIER: Record<number, number> = { 1: 6, 2: 10, 3: 14, 4: 18, 5: 22 };

function parsePathInvestment(pi: string): { count: number; keyword: string } | null {
  if (!pi) return null;
  const num = pi.match(/^(\d+|one|two|three|four|five)\s+/i);
  if (!num) return null;
  const wordMap: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };
  const count = isNaN(Number(num[1])) ? (wordMap[num[1].toLowerCase()] ?? 1) : Number(num[1]);
  const keyword = pi.slice(num[0].length).replace(/\s+[Ff]eats?$/, '').trim().toLowerCase();
  return { count, keyword };
}

/**
 * Parse a feat's `required` field into positive prerequisites and exclusions.
 *
 * Exclusion language: "Cannot take or have X", "Cannot have feat X"
 * Positive language (single or multi): "X", "X and Y", "X, Y"
 */
export function parseRequired(required: string | null): { positiveReqs: string[]; exclusions: string[] } {
  if (!required) return { positiveReqs: [], exclusions: [] };
  if (/cannot\s+(?:take\s+or\s+)?have(?:\s+feat)?\s+/i.test(required)) {
    const match = required.match(/cannot\s+(?:take\s+or\s+)?have(?:\s+feat)?\s+(.+)/i);
    return { positiveReqs: [], exclusions: match ? [match[1].trim()] : [required] };
  }
  // Split on comma or " and " to handle multi-requirement strings like "X, Y" or "X and Y"
  const parts = required.split(/,\s*|\s+and\s+/).map((s) => s.trim()).filter(Boolean);
  return { positiveReqs: parts, exclusions: [] };
}

/**
 * Determine whether a feat can be selected/purchased.
 *
 * @param feat       The feat being evaluated
 * @param selectedIds Currently selected feat ids
 * @param allFeats   Full list of all feats (to resolve names)
 * @param atCap      Whether the character is at their creation feat allowance cap.
 *                   Pass false for post-creation purchases (no cap applies).
 */
export function getFeatStatus(
  feat: BuilderFeat,
  selectedIds: string[],
  allFeats: BuilderFeat[],
  atCap: boolean,
): FeatStatus {
  const isSelected = selectedIds.includes(feat.id);

  if (!isSelected && atCap) return { blocked: true, reason: 'Feat cap reached for this Tier' };

  const { positiveReqs, exclusions } = parseRequired(feat.required);

  // Positive prerequisites — character must own ALL of them
  for (const req of positiveReqs) {
    const has = allFeats.some((f) => f.name === req && selectedIds.includes(f.id));
    if (!has) return { blocked: true, reason: `Requires: ${req}` };
  }

  // Exclusion prerequisites — character must NOT own ANY of them
  for (const excl of exclusions) {
    const has = allFeats.some((f) => f.name === excl && selectedIds.includes(f.id));
    if (has) return { blocked: true, reason: `Cannot own alongside: ${excl}` };
  }

  // Path investment
  if (feat.pathInvestment) {
    const parsed = parsePathInvestment(feat.pathInvestment);
    if (parsed) {
      const selectedFromPath = allFeats.filter(
        (f) =>
          selectedIds.includes(f.id) &&
          f.id !== feat.id &&
          (f.ownerName.toLowerCase().includes(parsed.keyword) ||
            (f.tag?.toLowerCase().includes(parsed.keyword) ?? false)),
      ).length;
      if (selectedFromPath < parsed.count) {
        return { blocked: true, reason: `Investment: ${feat.pathInvestment}` };
      }
    }
  }

  return { blocked: false, reason: null };
}
