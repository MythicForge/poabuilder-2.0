// Formula evaluator for content data formulas ("4 + Tier + floor(Will / 3)",
// "2d12", "(2 * Tier) + Mind"). Grammar mirrors tools/lib/formula-check.mjs —
// keep the two in sync. Dice terms evaluate to their rounded average
// (used for per-tier vitality rolls taken as average).

export type FormulaEnv = Record<string, number>;

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  max: Math.max,
  min: Math.min,
};

interface Token {
  t: "num" | "dice" | "id" | "op";
  v: string;
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  const re = /\s*(?:(\d+d\d+)|(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|([+\-*/(),]))/y;
  let i = 0;
  while (i < src.length) {
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m || m.index !== i) throw new Error(`formula: unexpected character in "${src}" at ${i}`);
    if (m[1]) tokens.push({ t: "dice", v: m[1] });
    else if (m[2]) tokens.push({ t: "num", v: m[2] });
    else if (m[3]) tokens.push({ t: "id", v: m[3] });
    else tokens.push({ t: "op", v: m[4] });
    i = re.lastIndex;
  }
  return tokens;
}

export function diceAverage(expr: string): number {
  const m = expr.match(/^(\d+)d(\d+)$/i);
  if (!m) throw new Error(`not a dice expression: ${expr}`);
  return Math.round((Number(m[1]) * (Number(m[2]) + 1)) / 2);
}

/** Parse "XdY", "XdY + Z" → rounded average (vitality per-tier rolls). */
export function parseAvgDiceExpr(formula: string): number {
  const m = formula.match(/(\d+)d(\d+)\s*([+-]\s*\d+)?/i);
  if (!m) return 0;
  const flat = m[3] ? parseInt(m[3].replace(/\s/g, ""), 10) : 0;
  return Math.round((parseInt(m[1], 10) * (parseInt(m[2], 10) + 1)) / 2 + flat);
}

/**
 * Evaluate a content formula. Unknown identifiers resolve to env values;
 * missing ones throw (callers pass a complete env or catch per-formula).
 */
export function evalFormula(src: string | number, env: FormulaEnv): number {
  if (typeof src === "number") return src;
  const tokens = tokenize(src.trim());
  let pos = 0;
  const peek = () => tokens[pos];

  function expr(): number {
    let v = term();
    while (peek()?.t === "op" && (peek().v === "+" || peek().v === "-")) {
      const op = tokens[pos++].v;
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  function term(): number {
    let v = factor();
    while (peek()?.t === "op" && (peek().v === "*" || peek().v === "/")) {
      const op = tokens[pos++].v;
      const r = factor();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }
  function factor(): number {
    const tok = peek();
    if (!tok) throw new Error(`formula: unexpected end of "${src}"`);
    if (tok.t === "num") { pos++; return Number(tok.v); }
    if (tok.t === "dice") { pos++; return diceAverage(tok.v); }
    if (tok.t === "op" && tok.v === "(") {
      pos++;
      const v = expr();
      expect(")");
      return v;
    }
    if (tok.t === "op" && tok.v === "-") { pos++; return -factor(); }
    if (tok.t === "id") {
      pos++;
      if (FUNCTIONS[tok.v] && peek()?.t === "op" && peek().v === "(") {
        pos++;
        const args = [expr()];
        while (peek()?.t === "op" && peek().v === ",") { pos++; args.push(expr()); }
        expect(")");
        return FUNCTIONS[tok.v](...args);
      }
      if (tok.v in env) return env[tok.v];
      throw new Error(`formula: unknown identifier "${tok.v}" in "${src}"`);
    }
    throw new Error(`formula: unexpected token "${tok.v}" in "${src}"`);
  }
  function expect(v: string) {
    if (peek()?.t !== "op" || peek().v !== v) throw new Error(`formula: expected "${v}" in "${src}"`);
    pos++;
  }

  const result = expr();
  if (pos !== tokens.length) throw new Error(`formula: trailing tokens in "${src}"`);
  return result;
}

/** Build the standard identifier env for a character. */
export function standardEnv(attrs: { brawn: number; finesse: number; mind: number; will: number }, tier: number, extra: FormulaEnv = {}): FormulaEnv {
  return {
    Brawn: attrs.brawn,
    Finesse: attrs.finesse,
    Mind: attrs.mind,
    Will: attrs.will,
    Tier: tier,
    ...extra,
  };
}
