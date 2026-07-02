import { ClassMechanicsRegistry } from '../class-mechanics-registry';

ClassMechanicsRegistry.register({
  className: 'Monk',
  hitDie: 8,
  saveProficiencies: ['str', 'dex'],
  startingProfs: {
    armor: [],
    weapons: ['simple', 'shortswords'],
  },
  multiclassProfs: { armor: [], weapons: ['simple', 'shortswords'] },
  kiPointsPerLevel: true,
  martialArtsDieByLevel: {
    1: 4, 2: 4, 3: 4, 4: 4,
    5: 6, 6: 6, 7: 6, 8: 6,
    9: 8, 10: 8, 11: 8, 12: 8,
  },
  unarmedAC: {
    formula: 'dex+wis',
    requiresNoShield: true,
    label: 'Unarmored Defense',
  },
  speedBonuses: [
    { minLevel: 2,  bonus: 10, requiresUnarmored: true },
    { minLevel: 6,  bonus: 15, requiresUnarmored: true },
    { minLevel: 10, bonus: 20, requiresUnarmored: true },
  ],
});
