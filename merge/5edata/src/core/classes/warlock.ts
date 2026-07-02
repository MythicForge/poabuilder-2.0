import { ClassMechanicsRegistry } from '../class-mechanics-registry';

ClassMechanicsRegistry.register({
  className: 'Warlock',
  hitDie: 8,
  saveProficiencies: ['wis', 'cha'],
  spellcastingAbility: 'cha',
  casterProgression: 'pact',
  startingProfs: {
    armor: ['light'],
    weapons: ['simple'],
  },
  multiclassProfs: { armor: ['light'], weapons: ['simple'] },
  subclassArmorGrants: [
    { subclassPattern: 'hexblade', armor: ['medium', 'shields'] },
  ],
  subclassWeaponGrants: [
    { subclassPattern: 'hexblade', weapons: ['martial'] },
  ],
  subclassMeleeStatOverride: {
    'The Hexblade': 'max-of-str-cha',
    'Hexblade': 'max-of-str-cha',
  },
});
