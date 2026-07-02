import { ClassMechanicsRegistry } from '../class-mechanics-registry';

ClassMechanicsRegistry.register({
  className: 'Warden',
  hitDie: 10,
  saveProficiencies: ['str', 'wis'],
  startingProfs: {
    armor: ['light', 'medium', 'shields'],
    weapons: ['simple', 'martial'],
  },
  multiclassProfs: { armor: ['light', 'medium', 'shields'], weapons: ['simple', 'martial'] },
});
