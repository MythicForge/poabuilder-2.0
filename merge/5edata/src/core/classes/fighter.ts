import { ClassMechanicsRegistry } from '../class-mechanics-registry';

ClassMechanicsRegistry.register({
  className: 'Fighter',
  hitDie: 10,
  saveProficiencies: ['str', 'con'],
  subclassSpellcastingAbility: { 'Eldritch Knight': 'int' },
  subclassCasterProgression: { 'Eldritch Knight': 'third' },
  startingProfs: {
    armor: ['light', 'medium', 'heavy', 'shields'],
    weapons: ['simple', 'martial'],
  },
  multiclassProfs: { armor: ['light', 'medium', 'shields'], weapons: ['simple', 'martial'] },
});
