import { ClassMechanicsRegistry } from '../class-mechanics-registry';

ClassMechanicsRegistry.register({
  className: 'Treasure Hunter',
  hitDie: 8,
  saveProficiencies: ['dex', 'int'],
  startingProfs: {
    armor: ['light'],
    weapons: ['simple', 'short sword', 'swords'],
  },
  multiclassProfs: { armor: ['light'], weapons: [], skillCount: 1 },
});
