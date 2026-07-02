import { ClassMechanicsRegistry } from '../class-mechanics-registry';

ClassMechanicsRegistry.register({
  className: 'Bard',
  hitDie: 8,
  saveProficiencies: ['dex', 'cha'],
  spellcastingAbility: 'cha',
  casterProgression: 'full',
  startingProfs: {
    armor: ['light'],
    weapons: ['simple', 'hand crossbow', 'longsword', 'rapier', 'shortsword'],
  },
  multiclassProfs: { armor: ['light'], weapons: [], skillCount: 1 },
  bardicInspiration: {
    maxByLevel: [[1, 3], [5, 4], [8, 5]],
    dieByLevel: [[1, 6], [5, 8], [10, 10]],
    resetOn: 'long',
  },
  subclassArmorGrants: [
    { subclassPattern: 'valor', armor: ['medium', 'shields'], minLevel: 3 },
  ],
  subclassWeaponGrants: [
    { subclassPattern: 'valor', weapons: ['martial'], minLevel: 3 },
  ],
});
