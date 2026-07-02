import { ClassMechanicsRegistry } from '../class-mechanics-registry';

ClassMechanicsRegistry.register({
  className: 'Sorcerer',
  hitDie: 6,
  saveProficiencies: ['con', 'cha'],
  spellcastingAbility: 'cha',
  casterProgression: 'full',
  startingProfs: {
    armor: [],
    weapons: ['daggers', 'quarterstaffs', 'light crossbows'],
  },
  multiclassProfs: { armor: [], weapons: [] },
  sorceryPointsPerLevel: true,
  unarmedAC: {
    formula: 'flat13+dex',
    requiresSubclass: ['Draconic Bloodline', 'Draconic Sorcery'],
    label: 'Draconic Resilience',
    shieldLabel: 'Draconic Resilience + Shield',
  },
});
