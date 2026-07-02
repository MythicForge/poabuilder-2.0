import { ClassMechanicsRegistry } from '../class-mechanics-registry';

ClassMechanicsRegistry.register({
  className: 'Illrigger',
  hitDie: 10,
  saveProficiencies: ['con', 'cha'],
  startingProfs: {
    armor: ['light', 'medium', 'shields'],
    weapons: ['simple', 'martial'],
  },
  multiclassProfs: { armor: ['light', 'medium', 'shields'], weapons: ['simple', 'martial'] },
});
