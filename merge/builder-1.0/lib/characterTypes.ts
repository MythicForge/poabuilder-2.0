export type AttributeKey = "brawn" | "finesse" | "mind" | "will";

export interface StructuredCurrency {
  gold: number;
  silver: number;
  copper: number;
}

export type InventoryCategory =
  | "Weapon"
  | "Armor"
  | "Shield"
  | "Kit"
  | "Consumable"
  | "Misc";
export type InventorySlot =
  | "Main Hand"
  | "Off Hand"
  | "Two Hands"
  | "Body"
  | "Head"
  | "Neck"
  | "Cloak"
  | "Gloves"
  | "Boots"
  | "Ring"
  | null;

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  quantity: number;
  weight: number;
  notes: string;
  source: "creation" | "manual" | "catalog";
  slot: InventorySlot;
  equipped: boolean;
  traits: string[];
  catalogItemId: string | null;
  // Armor fields
  armorBonus: number;
  armorCategory: "Light" | "Medium" | "Heavy" | null;
  armorTier: "Standard" | "Enhanced" | "Fortified" | null;
  woundBonus: number;
  mediumArmorStat: "brawn" | "finesse" | null;
  // Shield fields
  shieldType: "Temporary" | "Light" | "Medium" | "Heavy" | null;
  // Weapon fields — all rules logic must use these structured fields, never display strings
  armamentTags: string[]; // e.g. ["simple", "finesse"] — used for proficiency matching
  modifierStat: AttributeKey | null; // "brawn" | "finesse" | "mind" | "will"
  isRanged: boolean;
  damageDiceCount: number;
  damageDiceSize: number;
  damageTypeTags: string[]; // e.g. ["puncture", "slash", "blunt"]
  equipSlots: string[]; // e.g. ["main_hand", "off_hand"] — slots this item can go in
  // Masterwork
  masterworkBonus: number;
  // Equippable
  equippable: boolean;
  // Shield Reduction Pool (FEATURE-02)
  reductionPoolMax?: number;
  reductionPoolCurrent?: number;
}

export interface CharacterAttributes {
  brawn: number;
  finesse: number;
  mind: number;
  will: number;
}

export interface Character {
  id: string;
  createdAt: string;
  updatedAt: string;

  // Step 1
  name: string;
  tier: number; // 1–5
  featAllowance: number; // 0/3/6/8/10 by tier

  // Step 2: Profession
  professionId: string;
  professionName: string;

  // Step 3: Origin + Vocation
  originId: string;
  originName: string;
  vocationId: string;
  vocationName: string;
  vocationAttributeBonus: { attribute: AttributeKey; value: number };
  vocationCaster: BuilderVocationCaster | null;

  // Step 5: Attributes (base points — vocation bonus applied on top)
  baseAttributes: CharacterAttributes;

  // Step 4 (proficiencies): V.I.T.A.L.S. proficiency choices
  vitalsProficiencies: string[];

  // Spellcasting modifier (for "Mind or Will" professions; user picks)
  spellcastingModifier: AttributeKey | null;

  // Step 6: Feats
  selectedFeatIds: string[];

  // Step 7: Known Spells (captured in Summary step for casters)
  knownSpellIds: string[];
  // Spells toggled on in the active spell feed (subset of knownSpellIds)
  activeFeedSpellIds: string[];

  // Summary step
  ambition: string;
  inventoryNotes: string;
  currency: StructuredCurrency;
  notes: string;

  // Inventory (structured table)
  inventory: InventoryItem[];

  // Ambition
  maxAmbition: number;
  ambitionDice: string;
  currentAmbition: number;

  // Spellcasting play tracking
  currentReservoir: number;

  // Rest tracking
  currentRespites: number;

  // Choice selections: key = "EntityName__FeatureName", value = selected option names
  choiceSelections: Record<string, string[]>;

  // Armament proficiency tags — stored from profession/origin at creation (e.g. ["simple","finesse"])
  armamentProficiencyTags: string[];

  // Play tracking (updated on character sheet)
  currentVitality: number;
  maxVitality: number | null;
  tempHp: number;
  tempArmorDef: number;
  tempToHit: number;
  tempDamage: number;
  currentWounds: number;
  renown: number;
  featsPurchased: number;

  // Generic profession resource pool (data-driven via profession.customResource)
  customResources?: Record<string, number>;

  /** @deprecated migrated to customResources.adrenaline */
  currentAdrenaline?: number;
  /** @deprecated migrated to customResources.resonance */
  currentResonance?: number;

  // V.I.T.A.L.S. skill points & attribute system
  unspentAttributePoints: number;
  skillPoints: Record<string, number>;
  unspentSkillPoints: number;
  vitalsExpertiseBumps: Record<string, number>;

  // Reduction Pool (FEATURE-02): character-level pools; shieldReductionPool lives on the shield InventoryItem
  spellReductionPool?: number;
  featReductionPool?: number;

  // BUG-09: Spell Armor active state
  spellArmorActive?: boolean;

  // Conditions: key = condition name (e.g. "Bleeding"), value = stack count (0 = off, 1+ = on/stacks)
  activeConditions?: Record<string, number>;

  // Favorites: items/feats/spells pinned to the right rail quick-access panel
  favorites?: { type: "item" | "feat" | "spell"; id: string }[];

  // Notes tab
  journal?: JournalEntry[];
  biography?: BiographyFields;
}

// ─── Journal & Biography ──────────────────────────────────────────────────────

export interface JournalEntry {
  id: string;
  title: string;
  content: string;
  createdAt: number; // unix ms
  updatedAt: number; // unix ms
}

export interface BiographyFields {
  personality: string;
  ideals: string;
  bonds: string;
  flaws: string;
  backstory: string;
}

// ─── Choice feature resolution ────────────────────────────────────────────────

export interface ChoiceFeatureFollowUp {
  label?: string;
  count: number;
  pool: "vitals_skills" | "inline";
  options?: { name: string; effect_text: string }[];
  grants_expertise?: boolean;
  bump_count?: number;
}

export interface ChoiceFeatureOption {
  name: string;
  effect_text: string;
  follow_up?: ChoiceFeatureFollowUp;
}

export interface ChoiceFeature {
  entity_type: string;
  entity_name: string;
  source_kind: string;
  feature_name: string;
  tier: number | null;
  path: string | null;
  choice_type: string;
  selection_rule: "single" | "fixed_count";
  min_choices: number;
  max_choices: number;
  selection_timing: "on_gain" | "on_rest" | "on_use" | "on_activation";
  branches_from_feature: string | null;
  notes: string | null;
  grants_expertise?: boolean;
  options: ChoiceFeatureOption[];
}

// ─── Custom resource definition (data-driven class resource) ─────────────────

export interface CustomResourceDef {
  key: string;
  label: string;
  max_formula: "tier" | "attr + tier" | `static:${number}`;
  max_attr?: AttributeKey;
  default_value?: "max" | string;
  color?: string;
  restore: {
    respite?: number | "max";
    long_rest?: number | "max";
    full_rest?: number | "max";
  };
}

// ─── Builder data shapes (passed from server to client) ──────────────────────

export interface BuilderVocationCaster {
  casterType: "full" | "half" | "limited";
  casterSource: string;
  casterModifierOptions: AttributeKey[];
}

export interface BuilderStartingPack {
  weapons: string[];
  armor: string[];
  kit: string[];
  inventory: string[];
  currency: string | null;
}

export interface BuilderOriginPackCategory {
  label: string;
  items: string[];
}

export interface BuilderFeatureEntry {
  id: string;
  name: string;
  descriptionMarkdown: string;
  traits: string[];
  activationRaw: string | null;
}

export interface BuilderProfession {
  id: string;
  name: string;
  role: string;
  flavor: string;
  startingVitality: string;
  vitalityPerTier: string;
  bodyModifierBonus: string;
  woundBonusPerTier: number;
  pathOptions: string[];
  vitalsChoiceCount: number;
  vitalsOptions: string[];
  armaments: string[];
  protection: string[];
  toolKits: string[];
  casterType: "full" | "half" | "limited" | null;
  casterSource: string | null;
  casterModifierOptions: AttributeKey[];
  startingPack: BuilderStartingPack;
  baseFeatures: BuilderFeatureEntry[];
  customResource?: CustomResourceDef;
}

export interface BuilderVocation {
  id: string;
  name: string;
  attributeBonus: { attribute: AttributeKey; value: number };
  flavor: string;
  caster: BuilderVocationCaster | null;
  features: BuilderFeatureEntry[];
}

export interface BuilderOrigin {
  id: string;
  name: string;
  flavor: string;
  vocations: BuilderVocation[];
  originPack: { name: string; categories: BuilderOriginPackCategory[] } | null;
  baseFeatures: BuilderFeatureEntry[];
  caster: BuilderVocationCaster | null;
}

export interface BuilderFeat {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  ownerType: "profession" | "origin";
  tier: number;
  tag: string | null;
  required: string | null;
  pathInvestment: string | null;
  descriptionMarkdown: string;
  traits: string[];
  activationRaw: string | null;
  casterInfo: BuilderVocationCaster | null;
  fixedExpertise?: string[];
}

export interface BuilderSpell {
  id: string;
  name: string;
  slug: string;
  tier: number;
  isCantrip: boolean;
  school: string;
  sources: string[];
  grantedByOwners: string[];
  range: string;
  duration: string;
  descriptionMarkdown: string;
  amps: Array<{ cost: string; effect: string }>;
}
