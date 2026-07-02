import { ClassMechanicsRegistry } from '../class-mechanics-registry';

ClassMechanicsRegistry.register({
  className: 'Wizard',
  hitDie: 6,
  saveProficiencies: ['int', 'wis'],
  spellcastingAbility: 'int',
  casterProgression: 'full',
  startingProfs: {
    armor: [],
    weapons: ['daggers', 'darts', 'slings', 'quarterstaffs', 'light crossbows'],
  },
  multiclassProfs: { armor: [], weapons: [] },
});
