import { ClassMechanicsRegistry } from '../class-mechanics-registry';

ClassMechanicsRegistry.register({
  className: 'Druid',
  hitDie: 8,
  saveProficiencies: ['int', 'wis'],
  spellcastingAbility: 'wis',
  casterProgression: 'full',
  startingProfs: {
    armor: ['light', 'medium', 'shields (non-metal)'],
    weapons: ['clubs', 'daggers', 'javelins', 'maces', 'quarterstaffs', 'scimitars', 'sickles', 'spears'],
  },
  multiclassProfs: { armor: ['light', 'medium', 'shields'], weapons: [] },
});
