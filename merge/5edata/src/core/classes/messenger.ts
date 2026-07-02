import { ClassMechanicsRegistry } from '../class-mechanics-registry';

ClassMechanicsRegistry.register({
  className: 'Messenger',
  hitDie: 8,
  saveProficiencies: ['dex', 'cha'],
  startingProfs: {
    armor: ['light'],
    weapons: ['simple', 'short sword', 'swords'],
  },
  multiclassProfs: { armor: ['light'], weapons: [] },
});
