import { ClassMechanicsRegistry } from '../class-mechanics-registry';

ClassMechanicsRegistry.register({
  className: 'Scholar',
  hitDie: 8,
  saveProficiencies: ['int', 'wis'],
  startingProfs: {
    armor: ['light'],
    weapons: ['simple'],
  },
  multiclassProfs: { armor: ['light'], weapons: [] },
});
