import type { StepDef } from "../step.ts";
import { IdentityStep } from "./identity.tsx";
import { ProfessionStep } from "./profession.tsx";
import { OriginStep } from "./origin.tsx";
import { FeatsStep } from "./feats.tsx";
import { AttributesStep } from "./attributes.tsx";
import { ChoicesStep } from "./choices.tsx";
import { PackStep } from "./pack.tsx";
import { SummaryStep } from "./summary.tsx";

export const STEPS: StepDef[] = [
  { id: "identity", label: "Identity", title: "Identity", blurb: "Name your character and give them a face.", Component: IdentityStep },
  { id: "profession", label: "Profession", title: "Profession", blurb: "The discipline that defines their feats and resources.", Component: ProfessionStep },
  { id: "origin", label: "Origin", title: "Origin & Vocation", blurb: "Where they come from, and the calling that shaped them.", Component: OriginStep },
  { id: "feats", label: "Feats", title: "Feats & Tier", blurb: "Purchased feats set your Tier; choose what you've learned.", Component: FeatsStep },
  { id: "attributes", label: "Attributes", title: "Attributes & Skills", blurb: "Spend your budget across the four attributes and skill proficiencies.", Component: AttributesStep },
  { id: "choices", label: "Choices", title: "Choices & Spells", blurb: "Resolve feat choices and select spells within your allowances.", Component: ChoicesStep },
  { id: "pack", label: "Pack", title: "Starting Pack", blurb: "The gear your profession and origin hand you.", Component: PackStep },
  { id: "summary", label: "Summary", title: "Summary", blurb: "Review the computed sheet, clear warnings, and save.", Component: SummaryStep },
];
