// Sheet-knowable condition evaluator. Boon `condition` strings gate whether a
// formula-bearing boon is applied by the engine. Only the vocabulary below is
// machine-evaluable; anything else returns "unknown" and the caller keeps the
// boon display-only (its value un-applied, rendered on the feat card). That
// "unknown" fallback is the correct behavior for prose conditions, not an error.

export interface ConditionCtx {
  armorType: "Light" | "Medium" | "Heavy" | null;
  hasShield: boolean;
  activeStates: string[];
  wearingArmor: boolean;
  /** subcategories of currently-equipped weapons, lowercased (e.g. "sword"). */
  weaponGroups: string[];
  /** trait names of currently-equipped weapons, lowercased (e.g. "thrown"). */
  weaponTraits: string[];
}

export type CondResult = true | false | "unknown";

function evalTerm(term: string, ctx: ConditionCtx): CondResult {
  const t = term.trim();
  const lower = t.toLowerCase();

  // state:<id> — case-preserving id after the prefix
  if (lower.startsWith("state:")) {
    const id = t.slice(t.indexOf(":") + 1).trim();
    return ctx.activeStates.includes(id);
  }

  // wielding_weapon_group:<subcategory> — true if an equipped weapon's
  // subcategory matches (e.g. Fighter school stances). Compared lowercased.
  if (lower.startsWith("wielding_weapon_group:")) {
    const g = lower.slice(lower.indexOf(":") + 1).trim();
    return ctx.weaponGroups.includes(g);
  }
  // wielding_weapon_trait:<trait> — true if an equipped weapon carries the
  // trait (e.g. Ranger school honoring Thrown). Compared lowercased.
  if (lower.startsWith("wielding_weapon_trait:")) {
    const tr = lower.slice(lower.indexOf(":") + 1).trim();
    return ctx.weaponTraits.includes(tr);
  }

  switch (lower) {
    case "no_armor":
    case "unarmored":
    case "wearing_no_armor":
      return !ctx.wearingArmor;
    case "light_or_no_armor":
      return !ctx.wearingArmor || ctx.armorType === "Light";
    case "light_armor":
    case "wearing_light_armor":
      return ctx.armorType === "Light";
    case "medium_armor":
    case "wearing_medium_armor":
      return ctx.armorType === "Medium";
    case "heavy_armor":
    case "wearing_heavy_armor":
      return ctx.armorType === "Heavy";
    case "no_shield":
      return !ctx.hasShield;
    case "shield_equipped":
    case "using_shield":
      return ctx.hasShield;
    case "raging":
    case "rage":
      return ctx.activeStates.includes("rage");
    default:
      return "unknown";
  }
}

/**
 * Evaluate a boon condition string. Grammar: TERM (OP TERM)* where OP is a
 * case-insensitive AND / OR, left-associative, no parentheses. Any unknown
 * term poisons the whole expression to "unknown".
 */
export function evalCondition(
  cond: string | null | undefined,
  ctx: ConditionCtx,
): CondResult {
  const c = String(cond ?? "").trim();
  if (!c) return true; // no condition ⇒ always active

  const tokens = c.split(/\s+/);
  // parse: first term, then (op term) pairs
  let acc = evalTerm(tokens[0], ctx);
  let unknown = acc === "unknown";
  let i = 1;
  while (i < tokens.length) {
    const op = tokens[i].toUpperCase();
    const rhsTok = tokens[i + 1];
    if ((op !== "AND" && op !== "OR") || rhsTok === undefined)
      return "unknown"; // malformed ⇒ display-only
    const rhs = evalTerm(rhsTok, ctx);
    if (rhs === "unknown") unknown = true;
    // combine with boolean fallbacks; final "unknown" decided after the loop
    if (op === "AND") acc = acc === true && rhs === true;
    else acc = acc === true || rhs === true;
    i += 2;
  }

  // If any term was unknown, only trust a definitively-false AND-chain result;
  // otherwise surface "unknown" so the boon stays card-only.
  if (unknown) {
    // A false result from an unknown term is not reliable → unknown.
    return "unknown";
  }
  return acc;
}
