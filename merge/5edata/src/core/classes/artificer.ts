import type { RegistryItem } from "../types";
import { ClassMechanicsRegistry } from "../class-mechanics-registry";

export const REPLICATE_PLANS: {
  name: string;
  minLevel: 2 | 6 | 10 | 14;
  isAttachment: boolean;
  effect?: string;
  grant?: Partial<RegistryItem>;
}[] = [
  // LEVEL 2
  { name: "Alchemy Jug", minLevel: 2, isAttachment: false },
  { name: "Bag of Holding", minLevel: 2, isAttachment: false },
  { name: "Cap of Water Breathing", minLevel: 2, isAttachment: false },
  { name: "Goggles of Night", minLevel: 2, isAttachment: false },
  { name: "Manifold Tool", minLevel: 2, isAttachment: false },
  {
    name: "Repeating Shot",
    minLevel: 2,
    isAttachment: true,
    effect:
      "+1 to attack and damage rolls; ignores loading/ammunition — conjures its own ammo when fired.",
    grant: { bonusWeapon: "+1" },
  },
  {
    name: "Returning Weapon",
    minLevel: 2,
    isAttachment: true,
    effect:
      "+1 to attack and damage; returns to your hand immediately after a ranged attack.",
    grant: { bonusWeapon: "+1" },
  },
  { name: "Rope of Climbing", minLevel: 2, isAttachment: false },
  { name: "Sending Stones", minLevel: 2, isAttachment: false },
  {
    name: "Shield +1",
    minLevel: 2,
    isAttachment: true,
    effect: "+1 bonus to AC, on top of the shield's base bonus.",
    grant: { bonusAc: "+1" },
  },
  { name: "Wand of Magic Detection", minLevel: 2, isAttachment: false },
  { name: "Wand of Secrets", minLevel: 2, isAttachment: false },
  { name: "Wand of the War Mage +1", minLevel: 2, isAttachment: false },
  {
    name: "Weapon +1",
    minLevel: 2,
    isAttachment: true,
    effect: "+1 bonus to attack and damage rolls.",
    grant: { bonusWeapon: "+1" },
  },
  { name: "Wraps of Unarmed Power +1", minLevel: 2, isAttachment: false },

  // LEVEL 6
  {
    name: "Armor +1",
    minLevel: 6,
    isAttachment: true,
    effect: "+1 bonus to AC.",
    grant: { bonusAc: "+1" },
  },
  { name: "Boots of Elvenkind", minLevel: 6, isAttachment: false },
  { name: "Boots of the Winding Path", minLevel: 6, isAttachment: false },
  { name: "Cloak of Elvenkind", minLevel: 6, isAttachment: false },
  { name: "Cloak of the Manta Ray", minLevel: 6, isAttachment: false },
  {
    name: "Dazzling Weapon",
    minLevel: 6,
    isAttachment: true,
    effect:
      "+1 to attack and damage; on a hit you may blind the target until the start of your next turn (CON save).",
    grant: { bonusWeapon: "+1" },
  },
  { name: "Eyes of Charming", minLevel: 6, isAttachment: false },
  { name: "Eyes of Minute Seeing", minLevel: 6, isAttachment: false },
  { name: "Gloves of Thievery", minLevel: 6, isAttachment: false },
  { name: "Helm of Awareness", minLevel: 6, isAttachment: false },
  { name: "Lantern of Revealing", minLevel: 6, isAttachment: false },
  {
    name: "Mind Sharpener",
    minLevel: 6,
    isAttachment: true,
    effect:
      "Reaction: when you fail a Constitution save to keep concentration, succeed instead (4 charges, regain 1d4 at dawn).",
  },
  { name: "Necklace of Adaptation", minLevel: 6, isAttachment: false },
  { name: "Pipes of Haunting", minLevel: 6, isAttachment: false },
  {
    name: "Repulsion Shield",
    minLevel: 6,
    isAttachment: true,
    effect:
      "+1 AC; reaction when hit in melee to push the attacker 15 ft away (4 charges, regain 1d4 at dawn).",
    grant: { bonusAc: "+1" },
  },
  { name: "Ring of Swimming", minLevel: 6, isAttachment: false },
  { name: "Ring of Water Walking", minLevel: 6, isAttachment: false },
  {
    name: "Sentinel Shield",
    minLevel: 6,
    isAttachment: true,
    effect: "Advantage on initiative and Wisdom (Perception) checks.",
  },
  { name: "Spell-Refueling Ring", minLevel: 6, isAttachment: false },
  { name: "Wand of Magic Missiles", minLevel: 6, isAttachment: false },
  { name: "Wand of Web", minLevel: 6, isAttachment: false },
  {
    name: "Weapon of Warning",
    minLevel: 6,
    isAttachment: true,
    effect:
      "+1 weapon; advantage on initiative and you can't be surprised while conscious.",
    grant: { bonusWeapon: "+1" },
  },

  // LEVEL 10
  {
    name: "Armor of Resistance",
    minLevel: 10,
    isAttachment: true,
    effect: "Resistance to one chosen damage type.",
  },
  { name: "Dagger of Venom", minLevel: 10, isAttachment: false },
  { name: "Elven Chain", minLevel: 10, isAttachment: false },
  { name: "Ring of Feather Falling", minLevel: 10, isAttachment: false },
  { name: "Ring of Jumping", minLevel: 10, isAttachment: false },
  { name: "Ring of Mind Shielding", minLevel: 10, isAttachment: false },
  {
    name: "Shield +2",
    minLevel: 10,
    isAttachment: true,
    effect: "+2 bonus to AC, on top of the shield's base bonus.",
    grant: { bonusAc: "+2" },
  },
  { name: "Wand of the War Mage +2", minLevel: 10, isAttachment: false },
  {
    name: "Weapon +2",
    minLevel: 10,
    isAttachment: true,
    effect: "+2 bonus to attack and damage rolls.",
    grant: { bonusWeapon: "+2" },
  },
  { name: "Wraps of Unarmed Power +2", minLevel: 10, isAttachment: false },

  // LEVEL 14
  {
    name: "Armor +2",
    minLevel: 14,
    isAttachment: true,
    effect: "+2 bonus to AC.",
    grant: { bonusAc: "+2" },
  },
  {
    name: "Arrow-Catching Shield",
    minLevel: 14,
    isAttachment: true,
    effect:
      "+2 AC against ranged attacks; reaction to catch a projectile aimed at a creature within 5 ft.",
  },
  { name: "Flame Tongue", minLevel: 14, isAttachment: false },
  { name: "Ring of Free Action", minLevel: 14, isAttachment: false },
  { name: "Ring of Protection", minLevel: 14, isAttachment: false },
  { name: "Ring of the Ram", minLevel: 14, isAttachment: false },
];

ClassMechanicsRegistry.register({
  className: "Artificer",
  hitDie: 8,
  saveProficiencies: ["con", "int"],
  spellcastingAbility: "int",
  casterProgression: "artificer",
  startingProfs: {
    armor: ["light", "medium", "shields"],
    weapons: ["simple"],
  },
  multiclassProfs: {
    armor: ["light", "medium", "shields"],
    weapons: [],
    skillCount: 1,
  },
  infusionTable: {
    infusionsKnown: [
      [2, 4],
      [6, 5],
      [10, 6],
    ],
    infusedItemsMax: [
      [2, 2],
      [6, 3],
      [10, 4],
    ],
    plansKnown: [
      [2, 4],
      [6, 5],
      [10, 6],
    ],
  },
  customAttackModels: {
    subclass: "Armorer",
    modelField: "armorerModel",
    models: [
      {
        key: "guardian",
        name: "Thunder Pulse",
        statKey: "int",
        die: "1d8",
        type: "thunder",
        notes: "Guardian · Melee · Arcane Armor",
      },
      {
        key: "infiltrator",
        name: "Lightning Launcher",
        statKey: "int",
        die: "1d6",
        type: "lightning",
        notes: "Infiltrator · Ranged 90/300ft · +1d6 once/turn · Arcane Armor",
      },
      {
        key: "dreadnaught",
        name: "Force Demolisher",
        statKey: "int",
        die: "1d10",
        type: "force",
        notes: "Dreadnaught · Reach · Push/Pull 10ft · Arcane Armor",
      },
    ],
  },
});
