// Static Monk Ki ability definitions for Combat Abilities panel.
// Entries keyed by subclass name appear only for that subclass.
// Entries with subclass: undefined appear for all Monks.

export interface MonkKiDef {
  name: string;
  cost: string;         // display label: "1 Ki", "2 Ki", "1–10 Ki"
  costAmount: number;   // numeric cost for pool decrement (variable costs → minimum spend)
  minLevel: number;
  subclass?: string;
  desc: string;
}

export const MONK_KI_DEFS: MonkKiDef[] = [
  // ── Core (all Monks) ──────────────────────────────────────────────────────
  {
    name: 'Flurry of Blows',
    cost: '1 Ki', costAmount: 1,
    minLevel: 2,
    desc: 'Immediately after taking the Attack action, spend 1 ki point to make two unarmed strikes as a bonus action.',
  },
  {
    name: 'Patient Defense',
    cost: '1 Ki', costAmount: 1,
    minLevel: 2,
    desc: 'Spend 1 ki point to take the Dodge action as a bonus action on your turn.',
  },
  {
    name: 'Step of the Wind',
    cost: '1 Ki', costAmount: 1,
    minLevel: 2,
    desc: 'Spend 1 ki point to take the Disengage or Dash action as a bonus action. Your jump distance is doubled for the turn.',
  },
  {
    name: 'Stunning Strike',
    cost: '1 Ki', costAmount: 1,
    minLevel: 5,
    desc: 'When you hit with a melee weapon attack, spend 1 ki point to attempt to stun the target. It must succeed on a CON save (DC = 8 + PB + WIS mod) or be stunned until end of your next turn.',
  },

  // ── Way of Shadow ─────────────────────────────────────────────────────────
  {
    name: 'Shadow Arts',
    cost: '2 Ki', costAmount: 2,
    minLevel: 3,
    subclass: 'Way of Shadow',
    desc: 'Spend 2 ki points to cast Darkness, Darkvision, Pass Without Trace, or Silence without material components.',
  },
  {
    name: 'Shadow Step',
    cost: 'Free', costAmount: 0,
    minLevel: 6,
    subclass: 'Way of Shadow',
    desc: 'Bonus action (in dim light or darkness): teleport up to 60 ft to an unoccupied space you can see that is also in dim light or darkness. Advantage on next melee attack this turn.',
  },
  {
    name: 'Cloak of Shadows',
    cost: 'Free', costAmount: 0,
    minLevel: 11,
    subclass: 'Way of Shadow',
    desc: 'Action (in dim light or darkness): become invisible until end of turn or until you attack or cast a spell.',
  },

  // ── Way of the Long Death ─────────────────────────────────────────────────
  {
    name: 'Touch of the Long Death',
    cost: '1–10 Ki', costAmount: 1,
    minLevel: 3,
    subclass: 'Way of the Long Death',
    desc: 'Action: touch a creature and expend 1–10 ki points. It must succeed on a CON save (DC = 8 + PB + WIS mod) or take 2d10 necrotic damage per ki point spent.',
  },

  // ── Way of Mercy ──────────────────────────────────────────────────────────
  {
    name: 'Flurry of Healing and Harm',
    cost: '1 Ki', costAmount: 1,
    minLevel: 11,
    subclass: 'Way of Mercy',
    desc: 'Spend 1 ki when using Flurry of Blows. Heal one creature you hit (1d10 + WIS mod) and apply Hand of Harm to another without spending additional ki.',
  },

  // ── Way of the Astral Self ────────────────────────────────────────────────
  {
    name: 'Arms of the Astral Self',
    cost: '1 Ki', costAmount: 1,
    minLevel: 3,
    subclass: 'Way of the Astral Self',
    desc: 'Bonus action: summon astral arms for 10 min. Use WIS instead of STR for unarmed strikes. Deals 1d6 (1d8 at lvl 11) force damage. Range 5 ft (10 ft at lvl 11).',
  },
  {
    name: 'Body of the Astral Self',
    cost: '3 Ki', costAmount: 3,
    minLevel: 11,
    subclass: 'Way of the Astral Self',
    desc: 'Bonus action: manifest visage + torso alongside arms. Reaction to halve ranged damage. +WIS to Intimidation/Insight.',
  },

  // ── Way of the Open Hand ──────────────────────────────────────────────────
  {
    name: 'Quivering Palm',
    cost: '3 Ki', costAmount: 3,
    minLevel: 9,
    subclass: 'Way of the Open Hand',
    desc: 'Action: set imperceptible vibrations in a target you hit with unarmed strike. Later (as an action) force a CON save or reduce to 0 HP (pass = 10d10 necrotic).',
  },

  // ── Way of the Sun Soul ───────────────────────────────────────────────────
  {
    name: 'Searing Arc Strike',
    cost: '2+ Ki', costAmount: 2,
    minLevel: 6,
    subclass: 'Way of the Sun Soul',
    desc: 'After Flurry of Blows, spend 2+ additional ki points to cast Burning Hands (2 ki = 1st level, +1 ki per higher level up to 5th).',
  },
  {
    name: 'Searing Sunburst',
    cost: '0–3 Ki', costAmount: 0,
    minLevel: 3,
    subclass: 'Way of the Sun Soul',
    desc: 'Action: launch a mote of light at a point within 150 ft (20-ft sphere). Creatures make a CON save or take 2d6 radiant (+2d6 per ki point spent, max 3).',
  },

  // ── Way of the Kensei ────────────────────────────────────────────────────
  {
    name: 'Sharpen the Blade',
    cost: '1–3 Ki', costAmount: 1,
    minLevel: 6,
    subclass: 'Way of the Kensei',
    desc: 'Bonus action: spend 1–3 ki points. Your kensei weapon gains a bonus to attack and damage rolls equal to ki spent (max +3) for 1 minute.',
  },

  // ── Way of the Drunken Master ─────────────────────────────────────────────
  {
    name: "Drunkard's Luck",
    cost: '2 Ki', costAmount: 2,
    minLevel: 9,
    subclass: 'Way of the Drunken Master',
    desc: 'When you make an ability check, attack roll, or saving throw with disadvantage, spend 2 ki to cancel the disadvantage.',
  },
  {
    name: 'Intoxicated Frenzy',
    cost: '1 Ki', costAmount: 1,
    minLevel: 11,
    subclass: 'Way of the Drunken Master',
    desc: 'When using Flurry of Blows, make up to 3 additional attacks (total 5 attacks) if each targets a different creature.',
  },
];

// Metamagic SP cost display + numeric amount
export const METAMAGIC_COSTS: Record<string, string> = {
  'Careful Spell':     '1 SP',
  'Distant Spell':     '1 SP',
  'Empowered Spell':   '1 SP',
  'Extended Spell':    '1 SP',
  'Heightened Spell':  '3 SP',
  'Quickened Spell':   '2 SP',
  'Seeking Spell':     '2 SP',
  'Subtle Spell':      '1 SP',
  'Transmuted Spell':  '1 SP',
  'Twinned Spell':     'varies',
};

export const METAMAGIC_COST_AMOUNTS: Record<string, number> = {
  'Careful Spell':     1,
  'Distant Spell':     1,
  'Empowered Spell':   1,
  'Extended Spell':    1,
  'Heightened Spell':  3,
  'Quickened Spell':   2,
  'Seeking Spell':     2,
  'Subtle Spell':      1,
  'Transmuted Spell':  1,
  // Twinned Spell: variable, omitted → reference-only
};
