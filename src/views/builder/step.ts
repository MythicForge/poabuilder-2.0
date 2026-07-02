// Contract every wizard step implements. Steps are pure views over a draft
// StoredCharacter plus its live ComputedCharacter; they mutate the draft through
// `update` and never touch storage directly (the shell owns save).

import type { FC } from "react";
import type { ComputedCharacter, StoredCharacter } from "../../core/types.ts";

export interface StepProps {
  draft: StoredCharacter;
  /** Apply an in-place mutation to a structural clone of the draft. */
  update: (mutate: (d: StoredCharacter) => void) => void;
  computed: ComputedCharacter;
}

export interface StepDef {
  id: string;
  /** Short mono label shown in the stepper rail. */
  label: string;
  /** Serif heading shown atop the panel. */
  title: string;
  /** One-line intent shown under the heading. */
  blurb: string;
  Component: FC<StepProps>;
}
