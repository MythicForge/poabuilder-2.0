export const CONDITIONS = {
  Bleeding:    { stack:true,  tip:"1d4 dmg/turn start. +1 die/stack. Ends: healed or roll 1 on dmg die." },
  Blinded:     { stack:false, tip:"Strain on attacks & physical checks. All foes Obscured." },
  Burning:     { stack:true,  tip:"1d6 fire dmg to Vitality+Ambition/turn. +1 die/stack. Can't hide. Ends: Aid action or roll 1." },
  Charmed:     { stack:false, tip:"Can't act hostile vs source. Will save on dmg or turn start." },
  Compelled:   { stack:false, tip:"Strain on attacks vs non-source. Will save vs source Will each turn." },
  Crippled:    { stack:false, tip:"AP -1. Ends: magical heal or Medicine check." },
  Dazed:       { stack:true,  tip:"Mind checks & attacks -2. Stacks/sustains." },
  Deafened:    { stack:false, tip:"Auto-fail hearing Investigation. Immune to auditory effects." },
  Dominated:   { stack:false, tip:"Charmed + must obey source. Will save on dmg or turn end." },
  Enraged:     { stack:false, tip:"Can't focus sustained spells. Ends: no dmg before group's next turn." },
  Frightened:  { stack:false, tip:"Strain on attacks vs source & Will/Essence/Vigor checks. Ends: Will save, source leaves sight." },
  Immobilized: { stack:false, tip:"Can't Dash or Disengage. Can still Flank if already engaged." },
  Inert:       { stack:false, tip:"Can't spend AP. Can speak/gesture/reposition if not engaged. Ends: own turn end." },
  Maimed:      { stack:false, tip:"Max Vitality -25%. Can't regain Vitality. Ends: Full Rest or cure effect." },
  Prone:       { stack:false, tip:"Fortitude -5. Can't reposition/Dash freely. Stand costs 1 AP. Stealth +3." },
  Poisoned:    { stack:true,  tip:"Strain on targeted attribute checks (default: Brawn). Extra stacks hit more attrs." },
  Restrained:  { stack:false, tip:"No Dash/Dodge/Disengage/Flank. Moves with restrainer. Ends: Brawn check vs restrainer Fortitude." },
  Sapped:      { stack:false, tip:"Dmg dealt -1d10." },
  Silenced:    { stack:false, tip:"Can't speak or use verbal components." },
  Stunned:     { stack:false, tip:"Max AP becomes 2." },
  Unconscious: { stack:false, tip:"Prone + can't spend AP. Roll 1d20 on turn start or dmg taken; 10+ ends it." },
  Weakened:    { stack:true,  tip:"All stats & defenses -1/stack. Max 4 stacks. At 5: Inert. -1 stack/rest." },
};

// Stacking conditions: Bleeding Burning Dazed Poisoned Weakened
// Binary (on/off):     Blinded Charmed Compelled Crippled Deafened Dominated Enraged Frightened Immobilized Inert Maimed Prone Restrained Sapped Silenced Stunned Unconscious
