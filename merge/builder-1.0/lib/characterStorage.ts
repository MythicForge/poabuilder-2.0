import type { Character, InventoryItem, StructuredCurrency } from './characterTypes';

function parseCurrencyString(s: string): StructuredCurrency {
  const g = s.match(/(\d+(?:\.\d+)?)\s*gold/i);
  const sv = s.match(/(\d+(?:\.\d+)?)\s*silver/i);
  const cp = s.match(/(\d+(?:\.\d+)?)\s*copper/i);
  // fallback: bare number with no denomination → gold
  const bare = !g && !sv && !cp ? s.match(/^\s*(\d+(?:\.\d+)?)\s*$/) : null;
  return {
    gold: Math.round(parseFloat((g?.[1] ?? bare?.[1]) ?? "0")) || 0,
    silver: Math.round(parseFloat(sv?.[1] ?? "0")) || 0,
    copper: Math.round(parseFloat(cp?.[1] ?? "0")) || 0,
  };
}

export function parseCurrency(s: string): StructuredCurrency {
  return parseCurrencyString(s);
}

const STORAGE_KEY = 'poa_characters';

function generateId(): string {
  return `char_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function loadCharacters(): Character[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Character[]) : [];
  } catch {
    return [];
  }
}

export function saveCharacter(char: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>): Character {
  const all = loadCharacters();
  const now = new Date().toISOString();
  const saved: Character = { ...char, id: generateId(), createdAt: now, updatedAt: now };
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...all, saved]));
  return saved;
}

export function updateCharacter(id: string, updates: Partial<Character>): Character | null {
  const all = loadCharacters();
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const updated = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
  all[idx] = updated;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return updated;
}

export function deleteCharacter(id: string): void {
  const all = loadCharacters().filter((c) => c.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function getCharacter(id: string): Character | null {
  const found = loadCharacters().find((c) => c.id === id) ?? null;
  if (!found) return null;
  // Backfill fields added after initial release
  // Migrate old Body attribute to Brawn+Finesse split; also backfill if keys missing entirely
  {
    const ba = found.baseAttributes as unknown as Record<string, number | undefined>;
    if (!('brawn' in ba) || !('finesse' in ba)) {
      const hadBody = 'body' in ba;
      (found as Character).baseAttributes = {
        brawn:   ba.brawn   ?? ba.body ?? 0,
        finesse: ba.finesse ?? 0,
        mind:    ba.mind    ?? 0,
        will:    ba.will    ?? 0,
      };
      if (!hadBody && !('brawn' in ba)) (found as Character).unspentAttributePoints = 5;
    }
  }
  // Migrate vocationAttributeBonus "body" → "brawn", normalize any Title-case values
  {
    const vab = found.vocationAttributeBonus as { attribute: string; value: number };
    const rawAttr = (vab?.attribute ?? '').toLowerCase();
    if (rawAttr === 'body') {
      (found as Character).vocationAttributeBonus = { attribute: 'brawn', value: vab.value };
    } else if (rawAttr !== vab?.attribute) {
      // Fix Title-case (e.g., "Brawn" → "brawn")
      (found as Character).vocationAttributeBonus = { attribute: rawAttr as import('./characterTypes').AttributeKey, value: vab.value };
    }
  }
  if (!found.inventory) (found as Character).inventory = [];
  if (found.currentAmbition === undefined) (found as Character).currentAmbition = 0;
  if (found.maxAmbition === undefined) (found as Character).maxAmbition = 4;
  if (found.ambitionDice === undefined) (found as Character).ambitionDice = 'd4';
  if (found.currentReservoir === undefined) (found as Character).currentReservoir = 0;
  if (found.currentRespites === undefined) (found as Character).currentRespites = 3;
  if (!found.choiceSelections) (found as Character).choiceSelections = {};
  if (!found.activeFeedSpellIds) (found as Character).activeFeedSpellIds = (found as Character).knownSpellIds ?? [];
  if (!found.armamentProficiencyTags) (found as Character).armamentProficiencyTags = [];
  if (found.unspentAttributePoints === undefined) {
    const fp = found.featsPurchased ?? 0;
    (found as Character).unspentAttributePoints = fp;
  }
  if (!found.skillPoints) (found as Character).skillPoints = {};
  if (found.unspentSkillPoints === undefined) {
    const fp = found.featsPurchased ?? 0;
    const fromFeats = Math.floor(fp / 2) * 2;
    (found as Character).unspentSkillPoints = 3 + fromFeats;
  }
  if (!found.vitalsExpertiseBumps) (found as Character).vitalsExpertiseBumps = {};
  // Backfill slot/equipped/traits on inventory items
  (found as Character).inventory = ((found as Character).inventory ?? []).map((item) => {
    // Parse legacy damageDice string (e.g. "2d6") into count/size
    const rawItem = item as unknown as Record<string, unknown>;
    const rawDice = (rawItem.damageDice as string) ?? '';
    const rawType = (rawItem.damageType as string) ?? '';
    const diceMatch = rawDice.match(/^(\d+)d(\d+)$/i);
    // Normalise legacy modifierStat (Title-case → lower-case AttributeKey)
    const rawModStat = (item.modifierStat ?? rawItem.modifierStat ?? null) as string | null;
    const rawModLower = rawModStat ? rawModStat.toLowerCase() : null;
    // "body" is legacy alias for "brawn"
    const modStatNorm = rawModLower ? ((rawModLower === 'body' ? 'brawn' : rawModLower) as 'brawn' | 'finesse' | 'mind' | 'will') : null;
    // Normalise legacy damageTypes free-text to damageTypeTags enum values
    const legacyTypes = (rawItem.damageTypes as string[] | undefined) ?? [];
    const rawDamTypeTags = (rawItem.damageTypeTags as string[] | undefined);
    const damTypeTagsNorm = rawDamTypeTags ?? legacyTypes.map((t) => t.toLowerCase()).filter((t): t is 'puncture' | 'slash' | 'blunt' => ['puncture', 'slash', 'blunt'].includes(t));
    // Backfill equipSlots from legacy slot field
    const slotToTag: Record<string, string> = { 'Main Hand': 'main_hand', 'Off Hand': 'off_hand', 'Two Hands': 'two_hands', 'Body': 'body' };
    const equipSlotsNorm = (rawItem.equipSlots as string[] | undefined) ?? (item.slot ? [slotToTag[item.slot] ?? ''].filter(Boolean) : []);
    return {
      ...item,
      slot: item.slot ?? null,
      equipped: item.equipped ?? false,
      traits: item.traits ?? [],
      catalogItemId: item.catalogItemId ?? null,
      armorBonus: item.armorBonus ?? 0,
      armorCategory: item.armorCategory ?? null,
      armamentTags: (rawItem.armamentTags as string[] | undefined) ?? [],
      modifierStat: modStatNorm,
      isRanged: item.isRanged ?? false,
      damageDiceCount: item.damageDiceCount ?? (diceMatch ? parseInt(diceMatch[1]) : 0),
      damageDiceSize: item.damageDiceSize ?? (diceMatch ? parseInt(diceMatch[2]) : 6),
      damageTypeTags: damTypeTagsNorm,
      equipSlots: equipSlotsNorm,
      masterworkBonus: item.masterworkBonus ?? 0,
      equippable: item.equippable ?? (item.slot !== null),
    };
  });
  // Shield type + pool backfill
  const SHIELD_BASE_POOL: Record<string, number> = { Temporary: 10, Light: 10, Medium: 15, Heavy: 20 };
  (found as Character).inventory = ((found as Character).inventory ?? []).map((item) => {
    if (item.category !== 'Shield') return item;
    // Backfill shieldType from name if missing
    if ((item as InventoryItem).shieldType == null) {
      const name = item.name.toLowerCase();
      let shieldType: 'Temporary' | 'Light' | 'Medium' | 'Heavy' | null = null;
      if (/improvised/.test(name)) shieldType = 'Temporary';
      else if (/buckler/.test(name)) shieldType = 'Light';
      else if (/reinforced|tower/.test(name)) shieldType = 'Heavy';
      else if (/\bshield\b/.test(name)) shieldType = 'Medium';
      (item as InventoryItem).shieldType = shieldType;
    }
    // Recalculate reductionPoolMax from shieldType + masterwork
    const st = (item as InventoryItem).shieldType;
    if (st != null) {
      const base = SHIELD_BASE_POOL[st] ?? 10;
      const mw = (item.masterworkBonus ?? 0) * 5;
      (item as InventoryItem).reductionPoolMax = base + mw;
      // Only reset current pool if it's null/undefined (don't reset mid-combat)
      if ((item as InventoryItem).reductionPoolCurrent == null) {
        (item as InventoryItem).reductionPoolCurrent = base + mw;
      }
    }
    return item;
  });

  // Armor overhaul migration — backfill armorTier, woundBonus, mediumArmorStat; fix legacy masterworkBonus
  (found as Character).inventory = ((found as Character).inventory ?? []).map((item) => {
    if (item.category !== 'Armor') return item;

    // Infer armorTier from legacy armorBonus ranges
    if (!item.armorTier && item.armorCategory) {
      const b = item.armorBonus ?? 0;
      let tier: 'Standard' | 'Enhanced' | 'Fortified' | null = null;
      if (item.armorCategory === 'Heavy') {
        tier = b <= 4 ? 'Standard' : b <= 7 ? 'Enhanced' : 'Fortified';
      } else if (item.armorCategory === 'Medium') {
        tier = b <= 3 ? 'Standard' : b <= 5 ? 'Enhanced' : 'Fortified';
      } else if (item.armorCategory === 'Light') {
        tier = b <= 2 ? 'Standard' : b <= 4 ? 'Enhanced' : 'Fortified';
      }
      (item as InventoryItem).armorTier = tier;
    }

    // Backfill woundBonus from tier
    if ((item as InventoryItem).woundBonus === undefined || (item as InventoryItem).woundBonus === null) {
      const woundMap: Record<string, Record<string, number>> = {
        Heavy:  { Standard: 3, Enhanced: 4, Fortified: 5 },
        Medium: { Standard: 2, Enhanced: 3, Fortified: 4 },
        Light:  { Standard: 1, Enhanced: 2, Fortified: 3 },
      };
      const cat = item.armorCategory ?? '';
      const tier = (item as InventoryItem).armorTier ?? 'Standard';
      (item as InventoryItem).woundBonus = woundMap[cat]?.[tier] ?? 0;
    }

    // Backfill mediumArmorStat
    if (!(item as InventoryItem).mediumArmorStat && item.armorCategory === 'Medium') {
      (item as InventoryItem).mediumArmorStat = 'brawn';
    }

    // Legacy masterworkBonus on armor was added directly to AC; now it means stat cap raise only.
    // Subtract it back out of armorBonus so armorBonus = pure defense bonus.
    const rawItem = item as unknown as Record<string, unknown>;
    if (!rawItem.__armorMigrated && (item.masterworkBonus ?? 0) > 0) {
      (item as InventoryItem).armorBonus = Math.max(0, (item.armorBonus ?? 0) - (item.masterworkBonus ?? 0));
      rawItem.__armorMigrated = true;
    }

    return item;
  });

  // Migrate named resource fields → customResources map
  const cr = found as unknown as Record<string, unknown>;
  if (!found.customResources) found.customResources = {};
  if (typeof cr.currentAdrenaline === "number" && found.customResources.adrenaline === undefined) {
    found.customResources.adrenaline = cr.currentAdrenaline;
  }
  if (typeof cr.currentResonance === "number" && found.customResources.resonance === undefined) {
    found.customResources.resonance = cr.currentResonance;
  }

  // Migrate currency string → structured { gold, silver, copper }
  if (typeof (found as unknown as { currency: unknown }).currency === 'string') {
    (found as Character).currency = parseCurrencyString((found as unknown as { currency: string }).currency);
  }
  if (!found.currency) {
    (found as Character).currency = { gold: 0, silver: 0, copper: 0 };
  }

  // Migrate notes string → journal entries; backfill biography
  if (!found.journal) {
    found.journal = found.notes
      ? [{
          id: `je_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          title: "Notes",
          content: found.notes,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }]
      : [];
  }
  if (!found.biography) {
    found.biography = { personality: "", ideals: "", bonds: "", flaws: "", backstory: "" };
  }

  return found;
}
