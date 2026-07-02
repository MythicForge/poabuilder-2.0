import { ClassMechanicsRegistry } from '../class-mechanics-registry';

ClassMechanicsRegistry.register({
  className: 'Rogue',
  hitDie: 8,
  saveProficiencies: ['dex', 'int'],
  subclassSpellcastingAbility: { 'Arcane Trickster': 'int' },
  subclassCasterProgression: { 'Arcane Trickster': 'third' },
  startingProfs: {
    armor: ['light'],
    weapons: ['simple', 'hand crossbows', 'longswords', 'rapiers', 'shortswords'],
  },
  multiclassProfs: { armor: ['light'], weapons: [], skillCount: 1 },
});
