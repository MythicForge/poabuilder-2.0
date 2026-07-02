// Campaign-level rule overrides — GM configures, no code required.
// Stored in localStorage separately from character data.

export interface CampaignRules {
  id: string;
  name: string;

  // Initiative
  initiativeDie: 4 | 6 | 8 | 10 | 12 | 20;
  initiativeFlat: number;        // flat bonus added to roll

  // Inspiration
  inspirationMax: number;        // default 1; set higher for stacking

  // Character creation
  freeFeatsAtLevel1: number;     // bonus feats granted at char creation

  // HP
  bonusHPPerLevel: number;       // added to each level's HP total

  // Escape hatch for plugin-defined simple overrides
  customToggles:  Record<string, boolean>;
  customNumbers:  Record<string, number>;
  customStrings:  Record<string, string>;
}

export const DEFAULT_CAMPAIGN_RULES: Readonly<CampaignRules> = {
  id:              'bg3-default',
  name:            'BG3 Standard',
  initiativeDie:   4,
  initiativeFlat:  0,
  inspirationMax:  1,
  freeFeatsAtLevel1: 0,
  bonusHPPerLevel: 0,
  customToggles:   {},
  customNumbers:   {},
  customStrings:   {},
};

const STORAGE_KEY = 'bg3_campaign_rules';

export function loadRules(): CampaignRules {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CAMPAIGN_RULES };
    return { ...DEFAULT_CAMPAIGN_RULES, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CAMPAIGN_RULES };
  }
}

export function saveRules(rules: CampaignRules): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
}

export function resetRules(): CampaignRules {
  localStorage.removeItem(STORAGE_KEY);
  return { ...DEFAULT_CAMPAIGN_RULES };
}

export function patchRules(patch: Partial<CampaignRules>): CampaignRules {
  const current = loadRules();
  const next = { ...current, ...patch };
  saveRules(next);
  return next;
}
