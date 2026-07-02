import { ClassMechanicsRegistry } from '../class-mechanics-registry';

ClassMechanicsRegistry.register({
  className: 'Ranger',
  hitDie: 10,
  saveProficiencies: ['str', 'dex'],
  spellcastingAbility: 'wis',
  casterProgression: 'half',
  startingProfs: {
    armor: ['light', 'medium', 'shields'],
    weapons: ['simple', 'martial'],
  },
  multiclassProfs: { armor: ['light', 'medium', 'shields'], weapons: ['simple', 'martial'], skillCount: 1 },
});
