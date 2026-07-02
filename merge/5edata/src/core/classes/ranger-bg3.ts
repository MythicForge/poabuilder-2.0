import { ClassMechanicsRegistry } from '../class-mechanics-registry';

ClassMechanicsRegistry.register({
  className: 'Ranger (BG3)',
  hitDie: 10,
  saveProficiencies: ['str', 'dex'],
  spellcastingAbility: 'wis',
  casterProgression: 'half',
  startingProfs: {
    armor: ['light', 'medium', 'shields'],
    weapons: ['simple', 'martial'],
  },
  multiclassProfs: { armor: ['light', 'medium', 'shields'], weapons: ['simple', 'martial'], skillCount: 1 },
  choiceEffects: [
    {
      featureChoicesKey: 'favouredEnemies',
      effects: {
        'Bounty Hunter':     { skills: ['Investigation'] },
        'Keeper of the Veil': {
          skills: ['Arcana'],
          spells: [{ name: 'Protection from Evil and Good', usage: '1×/long rest' }],
        },
        'Mage Breaker':      { skills: ['Arcana'], cantrips: ['true strike|phb'] },
        'Ranger Knight':     { skills: ['History'], armorProfs: ['heavy'] },
        'Sanctified Stalker': { skills: ['Religion'], cantrips: ['sacred flame|phb'] },
      },
    },
    {
      featureChoicesKey: 'naturalExplorer',
      effects: {
        'Beast Tamer':                { spells: [{ name: 'Find Familiar', usage: '1×/short rest' }] },
        'Urban Tracker':              { skills: ['Sleight of Hand'] },
        'Wasteland Wanderer: Cold':   { resistances: ['Cold'] },
        'Wasteland Wanderer: Fire':   { resistances: ['Fire'] },
        'Wasteland Wanderer: Poison': { resistances: ['Poison'] },
      },
    },
  ],
});
