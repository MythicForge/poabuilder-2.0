import { ClassMechanicsRegistry } from '../class-mechanics-registry';

ClassMechanicsRegistry.register({
  className: 'Apothecary',
  hitDie: 8,
  saveProficiencies: ['int', 'wis'],
  spellcastingAbility: 'int',
  casterProgression: 'pact',
  startingProfs: {
    armor: ['light', 'medium'],
    weapons: ['simple', 'short swords', 'hand crossbows'],
  },
  multiclassProfs: { armor: ['light'], weapons: [] },
});
