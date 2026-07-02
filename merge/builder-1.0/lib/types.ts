// Professions
export interface ProfessionFeature {
  id: string;
  name: string;
  slug: string;
  owner_type: string;
  owner_id: string;
  owner_name: string;
  tag: string;
  trait_label: string;
  trait_raw: string;
  traits: string[];
  activation: {
    raw: string;
    resources: Record<string, unknown>;
    properties: Record<string, unknown>;
    notes: string[];
  };
  description_markdown: string;
  raw_markdown: string;
  path?: string;
  path_tier?: string | number;
}

export interface Profession {
  id: string;
  name: string;
  slug: string;
  role: string;
  flavor: string;
  favored_attributes_raw: string;
  starting_vitality: string;
  vitality_gained_per_tier: string;
  body_modifier_bonus: string;
  wound_bonus_per_tier: number;
  proficiencies: {
    vitals_skills: string[];
    armaments: string[];
    protection: string[];
    tool_kits: string[];
    raw: string;
  };
  starting_pack: {
    weapons: { raw: string; items: string[] };
    armor: { raw: string; items: string[] };
    kit: { raw: string; items: string[] };
    inventory: { raw: string; items: string[] };
    starting_currency: string | null;
    raw: string;
  };
  path_options: string[];
  features: ProfessionFeature[];
}

// Spells
export interface SpellAmp {
  cost: string;
  effect: string;
}

export interface Spell {
  id: string;
  name: string;
  slug: string;
  tier: number;
  tier_label: string;
  is_cantrip: boolean;
  reference_only: boolean;
  school: string;
  school_display: string;
  sources: string[];
  range: string;
  duration: string;
  description_markdown: string;
  raw_markdown: string;
  amps?: SpellAmp[];
  cost?: string;
  area?: string;
  spheres?: string[];
}

// Origins
export interface OriginFeature {
  id: string;
  name: string;
  slug: string;
  description_markdown: string;
  traits: string[];
  raw_markdown: string;
}

export interface Vocation {
  id: string;
  name: string;
  slug: string;
  attribute_bonus: { raw: string; attribute: string; value: number };
  flavor: string;
  features: OriginFeature[];
}

export interface Origin {
  id: string;
  name: string;
  slug: string;
  pack_name: string;
  flavor: string;
  origin_pack: {
    raw: string;
    parsed: Record<string, { raw: string; items: string[] }>;
  };
  origin_features: OriginFeature[];
  vocations: Vocation[];
}

// Feats
export interface Feat {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  owner_name: string;
  /** tag is the path label (e.g. "Infiltrator"); equals owner_name for base feats */
  tag?: string;
  tier?: number;
  required?: string;
  path_investment?: string;
  description_markdown: string;
  traits: string[];
  raw_markdown: string;
  cost?: string;
  activation?: { raw: string };
  collection_type?: string;
}

export interface FeatOwner {
  id: string;
  name: string;
}

// Actions
export interface ActionGroup {
  id: string;
  name: string;
  description: string;
  rules: string[];
  sort_order: number;
}

export interface Action {
  id: string;
  name: string;
  slug: string;
  group: string;
  description_markdown: string;
  traits: string[];
  cost?: string;
  raw_markdown: string;
}

// Equipment
export interface EquipmentItem {
  id?: string;
  name: string;
  description?: string;
  [key: string]: unknown;
}

// Search result
export interface SearchResult {
  type: "profession" | "spell" | "origin" | "feat" | "action" | "equipment";
  id: string;
  name: string;
  slug: string;
  description: string;
  tags?: string[];
}
