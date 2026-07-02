// ── Stored state schema ──────────────────────────────────────────────────────

export interface JournalEntry {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  authorName?: string;
}

export interface ConditionState {
  rounds?: number | null;
  conc?: boolean;
  source?: string;
  _last?: number;
  castLevel?: number;
}

export interface StoredASI {
  stat: string;
  bonus: number;
}

export interface ASISlotChoice {
  type: "none" | "feat" | "bonus";
  feat?: string;
  bonuses?: StoredASI[]; // 1–2 entries, total bonus sum = 2
  featProfChoices?: string[]; // proficiency choices for feats like Skilled
  featAbilityChoice?: string; // chosen stat for feats with ability: [{ choose: { from: [...] } }]
}

export interface StoredClass {
  name: string;
  subclass: string | null;
  source: string;
  level: number;
}

/** Full mechanical override for a player-created or forked item — same shape as a
 * registry item, minus name/source (those are derived from the InventoryItem's key). */
export type CustomItemPayload = Omit<RegistryItem, "name" | "source"> & {
  name?: string;
};

export interface InventoryItem {
  key: string;
  qty: number;
  wt: number;
  equipped: boolean;
  notes: string;
  starred?: boolean;
  /** Present on player-created/forked items — see CustomItemPayload. */
  custom?: CustomItemPayload;
  /** Marks item as created by Artificer Replicate Magic Item — shows Release button. */
  replicated?: boolean;
}

export interface ActiveInfusion {
  id: string;
  infusionName: string; // which infusion is applied (must be in featureChoices.infusions)
  targetItemKey: string; // inventory item key that this infusion is applied to ('' = unassigned)
}

export interface CustomResource {
  name: string;
  current: number;
  max: number;
  resetOn: "short" | "long";
}

export type VassalCategory = "beast" | "familiar" | "conjured" | "raised" | "arcane_construct";

export interface VassalUnit {
  id: string;
  displayName: string;
  creatureName: string;
  creatureSource: string;
  category: VassalCategory;
  hpCurrent: number;
  hpMax: number;
  conditions: Record<string, ConditionState>;
  dead: boolean;
  notes: string;
}

export interface MonsterBlock {
  name: string;
  entries: unknown[];
}

export interface MonsterSpellcasting {
  name?: string;
  type?: string;
  headerEntries?: unknown[];
  footerEntries?: unknown[];
  will?: string[];
  daily?: Record<string, string[]>;
  spells?: Record<string, { slots?: number; lower?: number; spells?: string[] }>;
  ability?: string;
  displayAs?: string;
}

export interface BestiaryEntry {
  name: string;
  source: string;
  size: string[];
  type: string | { type: string; tags?: string[] };
  alignment?: (string | { alignment?: string[] })[];
  cr?: string | { cr: string; xp?: number; xpLair?: number; pbNote?: string };
  ac: (number | { ac?: number; from?: string[]; special?: string })[];
  hp: { average?: number; formula?: string; special?: string };
  speed: Record<
    string,
    number | boolean | { number?: number; condition?: string }
  >;
  initiative?: number | { proficiency?: number };
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  save?: Record<string, string>;
  skill?: Record<string, string>;
  senses?: string[];
  passive?: number;
  resist?: unknown[];
  immune?: unknown[];
  vulnerable?: unknown[];
  conditionImmune?: unknown[];
  languages?: string[];
  spellcasting?: MonsterSpellcasting[];
  trait?: MonsterBlock[];
  action?: MonsterBlock[];
  bonus?: MonsterBlock[];
  reaction?: MonsterBlock[];
  legendary?: MonsterBlock[];
  legendaryActions?: number;
  legendaryActionsLair?: number;
  legendaryHeader?: unknown[];
  summonedByClass?: string;
  summonedBySpell?: string;
}

export interface StoredChar {
  id: string;
  name: string;
  player: string;
  campaign: string;
  image: string | null;
  _lastModified?: number;

  currency: { pp: number; gp: number; sp: number; cp: number };
  startingEquipmentApplied?: boolean;

  race: {
    name: string;
    subrace: string | null;
    source: string;
    asiChoices: StoredASI[];
    darkvision: number;
    feat?: string;
    featAbilityChoice?: string; // stat chosen for race feat ASI (Crusher→STR/CON, etc.)
    variableTrait?: "darkvision" | "skill";
    variableSkill?: string;
  };

  background: {
    name: string;
    source: string;
    skillProficiencies: string[];
    featProfChoices?: string[];
  };

  classes: StoredClass[];

  abilityScores: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };

  levelASI: StoredASI[];

  hp: { current: number; temp: number };
  hitDiceRemaining: { d6: number; d8: number; d10: number; d12: number };

  proficiencies: {
    skills: string[];
    weapons: string[];
    armor: string[];
    tools: string[];
    languages: string[];
  };

  expertise: string[];
  jackOfAllTrades: boolean;

  equipment: {
    meleeSet: { mainhand: string | null; offhand: string | null };
    rangedSet: { mainhand: string | null };
    armor: string | null;
    helmet: string | null;
    gloves: string | null;
    boots: string | null;
    cloak: string | null;
    ring1: string | null;
    ring2: string | null;
    amulet: string | null;
    inventory: InventoryItem[];
  };

  spellcasting: {
    slotsUsed: Record<number, number>;
    cantrips: string[];
    prepared: string[];
    known: string[];
  };

  resources: {
    bardicInspiration: { current: number } | null;
    rages: number | null;
    kiPoints: number | null;
    sorceryPoints: number | null;
    pactSlots: { used: number } | null;
    custom: CustomResource[];
    actionUses?: Record<string, number>;
  };

  feats: string[];
  starredSpells?: string[];
  asiSlots?: ASISlotChoice[];
  conditions: Record<string, ConditionState>;
  deathSaves: { successes: number; failures: number };
  inspiration: boolean;
  exhaustion: number;
  shortRestsUsed?: number;
  concentratingOn?: string | null;

  featureChoices: {
    fightingStyles: string[]; // chosen fighting style names from optionalFeatures (class-granted)
    featFightingStyleChoices: string[]; // fighting styles from Fighting Initiate feat
    invocations: string[]; // Warlock eldritch invocation names
    metamagic: string[]; // Sorcerer metamagic option names
    maneuvers: string[]; // Battle Master maneuver names
    favouredEnemies: string[]; // BG3 Ranger Favoured Enemy choices (max 3)
    naturalExplorer: string[]; // BG3 Ranger Natural Explorer choices (max 3)
    elementalDisciplines: string[]; // Monk Way of 4 Elements discipline choices
    multiclassSkills: string[]; // skill prof picks from multiclass grants (Bard/Ranger/Rogue secondary class)
    infusions: string[]; // Artificer infusion names chosen
  };

  notes: {
    personality: string;
    ideals: string;
    bonds: string;
    flaws: string;
    backstory: string;
    journal: JournalEntry[];
  };

  activeBuffs?: Record<string, ConditionState>;

  vassals?: VassalUnit[];
  activeInfusions?: ActiveInfusion[];
  armorerModel?: "guardian" | "infiltrator" | "dreadnaught";

  /** Namespaced plugin data: { [pluginId]: { ...pluginFields } } */
  pluginData?: Record<string, Record<string, unknown>>;
}

// ── Computed character output ────────────────────────────────────────────────

export interface AbilityEntry {
  score: number;
  mod: number;
  prof: boolean;
  save: number;
}

export interface SkillEntry {
  name: string;
  abil: string;
  mod: number;
  prof: "none" | "prof" | "expert";
}

export interface SpellSlot {
  level: number;
  max: number;
  current: number;
}

export interface PactSlotInfo {
  max: number;
  current: number;
  level: number;
}

export interface ResourceEntry {
  current: number;
  max: number;
  resetOn: "short" | "long";
  die?: string;
}

export interface AttackEntry {
  name: string;
  bonus: number | string;
  dmg: string;
  type: string;
  notes: string;
  isUnarmed?: boolean;
  /** Weapon crits on this number or higher (e.g. 19 = crit on 19–20). */
  crit?: number;
}

export interface FeatureEntry {
  name: string;
  desc: string;
  entries?: unknown[];
  cost?: string;
  className?: string;
  level?: number;
}

export interface CombatAbility {
  name: string;
  desc: string;
  cost?: string; // display label: "1 Ki", "2 SP", "1 Sup. Die"
  costAmount?: number; // numeric cost for decrement; undefined = reference-only
  pool?: "kiPoints" | "sorceryPoints" | "superiorityDice";
  source:
    | "maneuver"
    | "metamagic"
    | "invocation"
    | "fightingStyle"
    | "ki"
    | "misc"
    | "infusion"
    | "armorModel";
  actionType?: "action" | "bonus" | "reaction" | "free" | "passive";
}

export interface ComputedChar {
  name: string;
  player: string;
  campaign: string;
  image: string | null;

  classLabel: string;
  classes: StoredClass[];
  race: string;
  background: string;

  totalLevel: number;
  proficiencyBonus: number;
  ac: number;
  acSource: string;
  initiative: number;
  initiativeDie: number;
  inspirationMax: number;
  speed: number;
  speedFt: number;

  abilities: Record<string, AbilityEntry>;
  skills: SkillEntry[];
  passive: { perception: number; investigation: number; insight: number };
  senses: string;
  darkvisionFt: number;
  darkvisionM: number;

  hp: { current: number; temp: number; max: number };
  hitDiceDisplay: string;
  hitDiceRemaining: StoredChar["hitDiceRemaining"];
  deathSaves: StoredChar["deathSaves"];
  exhaustion: number;
  inspiration: boolean;
  jackOfAllTrades: boolean;

  proficiencies: {
    armor: string;
    weapons: string;
    tools: string;
    languages: string;
  };

  equipment: StoredChar["equipment"];
  attacks: AttackEntry[];

  carryCapacityKg: number;
  totalWeightKg: number;
  totalWeightLb: number;
  encumberedAt: number;
  heavilyEncAt: number;

  conditionsList: string[];
  activeConditions: string[];

  spellcasting: {
    ability: string;
    abilityKey: string | null;
    saveDC: number;
    attackBonus: number;
    cantripTier: number;
    slots: SpellSlot[];
    pactSlots: PactSlotInfo | null;
    cantrips: string[];
    known: string[];
    prepared: string[];
    grantedCantrips: string[]; // cantrip keys granted by class features (not user-managed)
    grantedSpells: { name: string; usage: string }[]; // spells granted by class features (not slot-gated)
  };

  damageResistances: string[];
  /** Bonus to CON saves to maintain concentration, from equipped magic items. */
  concentrationSaveBonus: number;

  raceFeatures: FeatureEntry[];
  classFeatures: FeatureEntry[];
  subclassFeatures: FeatureEntry[];
  backgroundFeatures: FeatureEntry[];
  subclassLabel: string | null;

  featureChoices: StoredChar["featureChoices"];
  chosenOptionalFeatures: (FeatureEntry & {
    optType:
      | "fightingStyle"
      | "invocation"
      | "metamagic"
      | "maneuver"
      | "infusion";
  })[];
  combatAbilities: CombatAbility[];

  resources: {
    bardicInspiration: ResourceEntry | null;
    rages: ResourceEntry | null;
    kiPoints: ResourceEntry | null;
    sorceryPoints: ResourceEntry | null;
    custom: CustomResource[];
  };

  actionsList: import("./data-actions").ComputedAction[];

  infusionsKnown: number; // how many infusions the Artificer knows (0 if not Artificer)
  infusedItemsMax: number; // max items that can be infused at once (0 if not Artificer)
  plansKnown: number; // Replicate Magic Item: plans known (0 if not Artificer or < L2)

  notes: StoredChar["notes"];

  buffBonuses?: {
    attackBonus: number;
    attackDie: string | null;
    saveBonus: number;
    saveDie: string | null;
    skillDie: string | null;
    damageBonus: number;
    damageDie: string | null;
    dmgReductionDie: string | null;
    advantages: string[];
  } | null;
}

// ── Registry types ───────────────────────────────────────────────────────────

export interface RegistrySkillMap {
  [skill: string]: string;
}

export interface RegistryClass {
  name: string;
  source: string;
  hitDie: number;
  saveProficiencies: string[];
  startingProfs: Record<string, unknown>;
  spellcastingAbility: string | null;
  casterProgression: string | null;
  cantripProgression: number[];
  subclasses: unknown[];
  features: RegistryFeature[];
  subclassFeatures: RegistrySubclassFeature[];
  startingEquipment?: {
    defaultData?: unknown[];
    goldAlternative?: string;
  } | null;
}

export interface RegistryFeature {
  name: string;
  source: string;
  level: number;
  className: string;
  entries: unknown[];
  isClassFeatureVariant?: boolean;
}

export interface RegistrySubclassFeature {
  name: string;
  level: number;
  className: string;
  subclassShortName: string;
  source?: string;
  entries: unknown[];
  isClassFeatureVariant?: boolean;
}

export interface RegistrySubrace {
  name: string;
  source?: string;
  raceName?: string;
  additionalSpells?: Array<{
    name?: string;
    ability?: string | { choose: string[] };
    known?: Record<string, unknown>;
    innate?: Record<string, unknown>;
  }>;
  entries?: unknown[];
  // Dragonborn-style _versions implementation fields
  damageType?: string;
  resist?: string[];
}

export interface RegistryRace {
  name: string;
  source: string;
  speed:
    | number
    | { walk?: number; climb?: number; fly?: number; swim?: number };
  size: string[];
  entries: unknown[];
  subrace: RegistrySubrace[];
  additionalSpells?: Array<{
    name?: string;
    ability?: string | { choose: string[] };
    known?: Record<string, unknown>;
    innate?: Record<string, unknown>;
  }>;
}

export interface RegistryBackground {
  name: string;
  source: string;
  skillProficiencies: string[];
  entries: unknown[];
  backgroundFeat?: string;
  startingEquipment?: unknown[];
}

export interface RegistrySpell {
  name: string;
  source: string;
  level: number;
  school: string;
  time: { number: number; unit: string }[];
  range: { type: string; distance?: { type: string; amount: number } };
  duration: {
    type: string;
    concentration?: boolean;
    duration?: { type: string; amount: number };
  }[];
  ritual?: boolean;
  bg3Formula?: string;
  entries?: unknown[];
}

export interface RegistryItem {
  name: string;
  source: string;
  type: string;
  rarity?: string;
  wondrous?: boolean;
  weapon?: boolean;
  armor?: boolean;
  weaponCategory?: string;
  ac?: number;
  dexterityMax?: number | null;
  stealth?: boolean;
  strength?: string;
  dmg1?: string;
  dmg2?: string;
  dmgType?: string;
  range?: string;
  reload?: number;
  property?: string[];
  mastery?: string[];
  entries?: unknown[];
  additionalEntries?: unknown[];
  weight?: number;
  value?: number;
  tradeLevel?: number;
  special?: boolean;
  _base?: boolean;
  /** Flat magic weapon bonus, e.g. "+1" — applies to attack & damage rolls. */
  bonusWeapon?: string;
  /** Magic weapon bonus to attack rolls only, e.g. "+1". */
  bonusWeaponAttack?: string;
  /** Magic weapon bonus to damage rolls only, e.g. "+1". */
  bonusWeaponDamage?: string;
  /** Unconditional extra damage dice on a hit, parsed from item text (see data/bonus-damage.json). */
  bonusDamage?: { dice: string; type: string };
  /** Magic AC bonus from worn gear, e.g. "+1" (armor base AC is in `ac`). */
  bonusAc?: string;
  /** Magic bonus to all saving throws while equipped, e.g. "+1". */
  bonusSavingThrow?: string;
  /** Magic bonus to spell attack rolls while equipped, e.g. "+1". */
  bonusSpellAttack?: string;
  /** Magic bonus to spell save DC while equipped, e.g. "+1". */
  bonusSpellSaveDc?: string;
  /** Magic bonus to ability checks while equipped, e.g. "+1". */
  bonusAbilityCheck?: string;
  /** Magic bonus to proficiency bonus while equipped, e.g. "+1". */
  bonusProficiencyBonus?: string;
  /** Magic bonus to Constitution saves to maintain concentration, e.g. "+2". */
  bonusSavingThrowConcentration?: string;
  /** Damage types this item grants resistance to while equipped. */
  resist?: string[];
  /** Weapon crits on this number or higher (e.g. 19 = crit on 19–20). */
  critThreshold?: number;
  /** Speed modifiers while equipped (walk applied; fly/climb/burrow not modeled). */
  modifySpeed?: {
    static?: Record<string, number>;
    multiply?: Record<string, number>;
    equal?: Record<string, string>;
  };
  /** Grants a proficiency (5etools encodes only `true`, not which — not applied). */
  grantsProficiency?: boolean;
}

export interface RegistryOptionalFeature {
  name: string;
  source: string;
  featureType: string[];
  entries: unknown[];
  prerequisite?: unknown[];
  senses?: { blindsight?: number };
}

export interface MonsterFluff {
  name: string;
  source: string;
  entries?: unknown[];
  images?: { type: string; href: { type: string; path: string }; credit?: string }[];
}

export interface Registry {
  skills: RegistrySkillMap;
  classes: Record<string, RegistryClass>;
  races: RegistryRace[];
  backgrounds: RegistryBackground[];
  feats: unknown[];
  optionalFeatures: RegistryOptionalFeature[];
  spells: RegistrySpell[] | null;
  items: RegistryItem[] | null;
  conditions: unknown[] | null;
  bestiary: BestiaryEntry[] | null;
  bestiaryFluff: MonsterFluff[] | null;
}

// ── Per-class mechanics (synchronous, consumed by computeCharacter) ───────────

export interface ClassMechanics {
  className: string;

  hitDie?: number;
  saveProficiencies?: string[];
  spellcastingAbility?: string | null;
  casterProgression?: 'full' | 'half' | 'third' | 'pact' | 'artificer' | null;
  subclassSpellcastingAbility?: Record<string, string>;
  subclassCasterProgression?: Record<string, string>;

  startingProfs?: { armor: string[]; weapons: string[] };
  multiclassProfs?: { armor: string[]; weapons: string[]; skillCount?: number };

  rageTable?: Record<number, number>;
  kiPointsPerLevel?: true;
  sorceryPointsPerLevel?: true;
  bardicInspiration?: {
    maxByLevel: [number, number][];
    dieByLevel: [number, number][];
    resetOn: 'short' | 'long';
  };
  martialArtsDieByLevel?: Record<number, number>;

  unarmedAC?: {
    formula: 'dex+con' | 'dex+wis' | 'flat13+dex';
    requiresSubclass?: string[];
    requiresNoShield?: boolean;
    label: string;
    shieldLabel?: string;
  };

  speedBonuses?: {
    minLevel: number;
    bonus: number;
    requiresUnarmored?: boolean;
    requiresNotHeavyArmor?: boolean;
  }[];

  subclassArmorGrants?: {
    subclassPattern: string;
    armor: string[];
    weapons?: string[];
    minLevel?: number;
  }[];
  subclassWeaponGrants?: {
    subclassPattern: string;
    weapons: string[];
    armor?: string[];
    minLevel?: number;
  }[];

  subclassMeleeStatOverride?: Record<string, 'max-of-str-cha'>;

  customAttackModels?: {
    subclass: string;
    modelField: string;
    models: {
      key: string;
      name: string;
      statKey: 'str' | 'dex' | 'int' | 'wis' | 'cha';
      die: string;
      type: string;
      notes: string;
    }[];
  };

  choiceEffects?: {
    featureChoicesKey: string;
    effects: Record<string, {
      skills?: string[];
      armorProfs?: string[];
      cantrips?: string[];
      spells?: { name: string; usage: string }[];
      resistances?: string[];
    }>;
  }[];

  infusionTable?: {
    infusionsKnown: [number, number][];
    infusedItemsMax: [number, number][];
    plansKnown: [number, number][];
  };
}
