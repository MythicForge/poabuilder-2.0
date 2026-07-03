// Data model for Path of Ambition.
// StoredCharacter mirrors data/shared/character-schema.json — choices and
// current pool values only. ComputedCharacter is derived every render and
// never persisted.

export type AttributeKey = "brawn" | "finesse" | "mind" | "will";
export type DefenseKey = "Armor" | "Fortitude" | "Mental" | "Will Defense";
export type SkillName = "Vigor" | "Intuition" | "Talent" | "Awareness" | "Lore" | "Social";

export const SKILLS: SkillName[] = ["Vigor", "Intuition", "Talent", "Awareness", "Lore", "Social"];
export const ATTRIBUTES: AttributeKey[] = ["brawn", "finesse", "mind", "will"];

// ── Stored character ─────────────────────────────────────────────────────────

export interface StoredCharacter {
  id: string;
  schema_version: number;
  created_at: string;
  updated_at: string;
  identity: {
    name: string;
    portrait: string | null;
    pronouns: string;
    tags: string[];
  };
  build: {
    profession_id: string;
    origin_id: string;
    vocation_id: string;
    feats_purchased: number;
    attributes: Record<AttributeKey, number>;
    skills: {
      proficiencies: string[];
      points: Record<string, number>;
      expertise_bumps: Record<string, number>;
    };
    feat_ids: string[];
    choices: Record<string, string | string[]>;
    spellcasting_modifier: AttributeKey | null;
    known_spell_ids: string[];
    known_cantrip_ids: string[];
    known_sphere_ids: string[];
    prepared_spell_ids: string[];
    signature_spell_ids: string[];
    tier4_slot_choice: "tactical" | "narrative" | null;
    prep: Record<string, unknown>;
  };
  inventory: {
    items: InventoryItem[];
    currency: { gold: number; silver: number; copper: number };
    notes: string;
  };
  pools: {
    vitality: number;
    temp_vitality: number;
    wounds: number;
    ambition: number;
    reservoir: number;
    resources: Record<string, number>;
    reduction_pools: Record<string, number>;
    free_successes: Record<string, number>;
    uses: Record<string, number>;
  };
  states: { active: string[] };
  conditions: Record<string, number>;
  daily_modes: Record<string, string | null>;
  play: {
    renown: number;
    respites_used: number;
    favorites: { type: "item" | "feat" | "spell"; id: string }[];
  };
  notes: {
    journal: JournalEntry[];
    biography: { personality: string; ideals: string; bonds: string; flaws: string; backstory: string };
    freeform: string;
  };
}

export interface InventoryItem {
  id: string;
  catalog_item_id: string | null;
  name: string;
  quantity: number;
  equipped: boolean;
  slot: string | null;
  masterwork_bonus: number;
  medium_armor_stat: "brawn" | "finesse" | null;
  reduction_pool_current: number | null;
  notes: string;
  custom: CatalogItem | null;
}

export interface JournalEntry {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// ── Content definitions (shapes of data/ JSON we rely on) ───────────────────

export interface Boon {
  type: string;
  [key: string]: unknown;
}

export interface Feat {
  id: string;
  name: string;
  tags: string[];
  path?: string | null;
  tier: number;
  trait: string;
  slot_type: "tactical" | "narrative" | "minor" | null;
  cost: unknown;
  range: string | null;
  duration: string | null;
  uses: { count: number; recharge: string } | null;
  feat_dc: string | null;
  prerequisites: unknown;
  description: string;
  boons: Boon[];
  _todo?: string;
}

export interface ResourceDef {
  id: string;
  name: string;
  description?: string;
  max: string | number;
  die_size?: { type: "table"; key: string; rows: { range: [number, number]; die: string }[] };
  recovery?: Record<string, number | "max" | { formula: string; minimum?: number }>;
  triggers?: { event: string; amount: number }[];
}

export interface Profession {
  id: string;
  name: string;
  description: string;
  favored_attributes: string[];
  vitality: {
    base: string;
    per_tier: string;
    brawn_bonus?: { dice: string; threshold: number; attribute: string };
  };
  wound_threshold_per_tier: number;
  proficiencies: {
    skills: { type: "choice"; count: number; from: string[] } | string[];
    armaments: string[];
    protection: string[];
    tools: string[] | { type: "choice"; count: number; from: string[] };
  };
  starting_pack: Record<string, unknown>;
  resources: ResourceDef[];
  paths: { id: string; name: string }[];
  feats: Feat[];
}

export interface PathDef {
  id: string;
  name: string;
  profession: string;
  description: string;
  feats: Feat[];
}

export interface Origin {
  id: string;
  name: string;
  description: string;
  pack: Record<string, unknown>;
  vocations: string[];
  feats: Feat[];
}

export interface Vocation {
  id: string;
  name: string;
  origin: string;
  description: string;
  attribute_bonus: { attribute: AttributeKey; amount: number };
  feats: Feat[];
  spellcasting: SpellcastingGrant | null;
}

export interface SpellcastingGrant {
  caster_type: "full" | "half" | "limited";
  source?: string;
  modifier?: string;
  modifier_options?: AttributeKey[];
  [key: string]: unknown;
}

export interface Spell {
  id: string;
  name: string;
  tier: number;
  is_cantrip: boolean;
  school: string | null;
  spheres: string[];
  range: string | null;
  duration: string | null;
  cost: number;
  area: string | null;
  description: string;
  // `spheres` is normalized to string[] at registry load (raw JSON stores a
  // single string or null). stackable/stack_max mark amps that may be applied
  // more than once (stack_max = how many times).
  amps: { cost: string; effect: string; stackable?: boolean; stack_max?: number }[];
  reference_only?: boolean;
}

export interface CatalogItem {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  groups?: string[];
  damage?: string | null;
  damage_types?: { code: string; name: string }[];
  range_bands?: { code: string; name: string }[];
  traits?: { name: string }[];
  armor_type?: string | null;
  armor_bonus?: { raw?: string | null; value: number } | number;
  armor_bonus_range?: { value: number };
  wound_bonus?: number;
  reduction_pool?: number | null;
  augment_slots?: string | number;
  shield_type?: string | null;
  uses?: string[];
  bonus?: string;
  critical?: string;
  default_uses?: number;
  cost?: number | null;
  weight: number;
  stackable?: boolean;
  equip_slots?: string[];
  equippable?: boolean;
  is_template?: boolean;
  [key: string]: unknown;
}

export interface ConditionDef {
  id: string;
  name: string;
  stacking: boolean;
  rules: string;
}

export interface TierProgression {
  max_feats: number;
  /** Attribute points available at character creation, before per-feat gains. */
  creation_attribute_points?: number;
  attribute_point_per_purchased_feat: number;
  /** Skill dice points available at character creation, before per-feat gains. */
  creation_skill_points?: number;
  skill_point_per_even_feat: number;
  tiers: {
    tier: number;
    feats_to_advance: number | null;
    cumulative_feats_required: number;
    slots: Record<string, unknown>;
  }[];
}

// ── Computed character ───────────────────────────────────────────────────────

export type ProficiencyRank = "Untrained" | "Trained" | "Expert" | "Master";

export interface SkillPoolInfo {
  skill: SkillName;
  attrValue: number;
  rank: ProficiencyRank;
  baseDiceCount: number;
  profDieFaces: number | null;
  skillDiceCount: number;
  display: string;
}

export interface ActiveBoon {
  boon: Boon;
  source: { featId: string; featName: string; owner: string };
}

export interface FeatCard {
  feat: Feat;
  owner: string; // "Fighter", "Sentinel", "Soldier", "Pilgrim", …
  starting: boolean;
  activeBoons: Boon[];
}

export interface ComputedResource {
  def: ResourceDef;
  max: number;
  current: number;
  die?: string;
}

export interface ComputedSpellcasting {
  casterType: "full" | "half" | "limited";
  modifier: AttributeKey;
  modifierValue: number;
  reservoirMax: number;
  spellcastingTier: number;
  spellDC: number;
  knownAllowance: number;
  preparedAllowance: number;
  cantripAllowance: number;
  spheres: string[];
}

export interface ComputedCharacter {
  tier: number;
  attributes: Record<AttributeKey, number>;
  attributeBudget: { earned: number; spent: number };
  skillPointBudget: { earned: number; spent: number };
  expertisePointBudget: { earned: number; spent: number };
  defenses: Record<DefenseKey, number>;
  defenseBreakdown: Record<DefenseKey, string[]>;
  vitality: { max: number; current: number; temp: number };
  wounds: { max: number; current: number };
  ambition: { max: number; current: number; die: string };
  resources: ComputedResource[];
  spellcasting: ComputedSpellcasting | null;
  skills: SkillPoolInfo[];
  carry: { capacity: number; used: number };
  featCards: FeatCard[];
  activeBoons: ActiveBoon[];
  activeStates: string[];
  proficiencies: { armaments: string[]; protection: string[]; tools: string[] };
  warnings: string[];
}
