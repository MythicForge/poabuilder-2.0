import { ClassMechanicsRegistry } from '../class-mechanics-registry';

ClassMechanicsRegistry.register({
  className: 'Mystic',
  hitDie: 8,
  saveProficiencies: ['int', 'wis'],
  startingProfs: {
    armor: ['light'],
    weapons: ['simple'],
  },
  multiclassProfs: { armor: ['light'], weapons: [] },
});
