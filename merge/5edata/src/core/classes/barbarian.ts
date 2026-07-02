import { ClassMechanicsRegistry } from '../class-mechanics-registry';

ClassMechanicsRegistry.register({
  className: 'Barbarian',
  hitDie: 12,
  saveProficiencies: ['str', 'con'],
  startingProfs: {
    armor: ['light', 'medium', 'shields'],
    weapons: ['simple', 'martial'],
  },
  multiclassProfs: { armor: ['shields'], weapons: ['simple', 'martial'] },
  rageTable: {
    1: 2, 2: 2, 3: 3, 4: 3, 5: 3,
    6: 4, 7: 4, 8: 4, 9: 4, 10: 4,
    11: 4, 12: 5,
  },
  unarmedAC: {
    formula: 'dex+con',
    label: 'Unarmored Defense',
    shieldLabel: 'Unarmored Defense + Shield',
  },
  speedBonuses: [
    { minLevel: 5, bonus: 10, requiresNotHeavyArmor: true },
  ],
});
