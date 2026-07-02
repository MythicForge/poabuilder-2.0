import { ClassMechanicsRegistry } from '../class-mechanics-registry';

ClassMechanicsRegistry.register({
  className: 'Paladin (BG3)',
  hitDie: 10,
  saveProficiencies: ['wis', 'cha'],
  spellcastingAbility: 'cha',
  casterProgression: 'half',
  startingProfs: {
    armor: ['light', 'medium', 'heavy', 'shields'],
    weapons: ['simple', 'martial'],
  },
  multiclassProfs: { armor: ['light', 'medium', 'shields'], weapons: ['simple', 'martial'] },
});
