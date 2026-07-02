import { ClassMechanicsRegistry } from '../class-mechanics-registry';

ClassMechanicsRegistry.register({
  className: 'Cleric',
  hitDie: 8,
  saveProficiencies: ['wis', 'cha'],
  spellcastingAbility: 'wis',
  casterProgression: 'full',
  startingProfs: {
    armor: ['light', 'medium', 'shields'],
    weapons: ['simple'],
  },
  multiclassProfs: { armor: ['light', 'medium', 'shields'], weapons: [] },
  subclassArmorGrants: [
    { subclassPattern: 'life',    armor: ['heavy'] },
    { subclassPattern: 'nature',  armor: ['heavy'] },
    { subclassPattern: 'tempest', armor: ['heavy'] },
    { subclassPattern: 'war',     armor: ['heavy'] },
    { subclassPattern: 'forge',   armor: ['heavy'] },
    { subclassPattern: 'order',   armor: ['heavy'] },
    { subclassPattern: 'unity',   armor: ['heavy'] },
  ],
  subclassWeaponGrants: [
    { subclassPattern: 'tempest', weapons: ['martial'] },
    { subclassPattern: 'war',     weapons: ['martial'] },
    { subclassPattern: 'forge',   weapons: ['martial'] },
  ],
});
