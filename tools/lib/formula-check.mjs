// Formula grammar shared by the data validator and (mirrored in) src/core/formula.ts.
// Grammar: expr := term (('+'|'-') term)*
//          term := factor (('*'|'/') factor)*
//          factor := number | dice | identifier | func '(' expr (',' expr)* ')' | '(' expr ')'
// dice := NdM (e.g. 2d12). Functions: floor, ceil, max, min, round.

export const FUNCTIONS = new Set(["floor", "ceil", "max", "min", "round"]);

// Identifiers the runtime engine provides. Others parse fine but are reported.
export const KNOWN_IDENTIFIERS = new Set([
  "Brawn", "Finesse", "Mind", "Will", "Tier", "SpellTier",
  "profession_vitality", "feat_vitality_bonus", "profession_wound_per_tier",
  "spell_modifier", "ambition_die", "mana_spent",
  "highest_known_spell_tier",
]);

export function tokenize(src) {
  const tokens = [];
  const re = /\s*(?:(\d+d\d+)|(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|([+\-*/(),]))/gy;
  let i = 0;
  while (i < src.length) {
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m || m.index !== i) throw new Error(`unexpected character at ${i}: "${src.slice(i, i + 8)}"`);
    if (m[1]) tokens.push({ t: "dice", v: m[1] });
    else if (m[2]) tokens.push({ t: "num", v: m[2] });
    else if (m[3]) tokens.push({ t: "id", v: m[3] });
    else tokens.push({ t: "op", v: m[4] });
    i = re.lastIndex;
  }
  return tokens;
}

// Parses; returns { ok, identifiers, unknown, error? }
export function checkFormula(src) {
  if (typeof src === "number") return { ok: true, identifiers: [], unknown: [] };
  if (typeof src !== "string" || !src.trim()) return { ok: false, identifiers: [], unknown: [], error: "empty formula" };
  let tokens;
  try {
    tokens = tokenize(src.trim());
  } catch (e) {
    return { ok: false, identifiers: [], unknown: [], error: e.message };
  }
  const ids = [];
  let pos = 0;
  const peek = () => tokens[pos];
  const eat = (t, v) => {
    const tok = tokens[pos];
    if (!tok || tok.t !== t || (v !== undefined && tok.v !== v)) {
      throw new Error(`expected ${v ?? t} at token ${pos} in "${src}"`);
    }
    pos++;
    return tok;
  };
  function expr() {
    term();
    while (peek()?.t === "op" && (peek().v === "+" || peek().v === "-")) { pos++; term(); }
  }
  function term() {
    factor();
    while (peek()?.t === "op" && (peek().v === "*" || peek().v === "/")) { pos++; factor(); }
  }
  function factor() {
    const tok = peek();
    if (!tok) throw new Error(`unexpected end of formula "${src}"`);
    if (tok.t === "num" || tok.t === "dice") { pos++; return; }
    if (tok.t === "op" && tok.v === "(") { pos++; expr(); eat("op", ")"); return; }
    if (tok.t === "op" && tok.v === "-") { pos++; factor(); return; }
    if (tok.t === "id") {
      pos++;
      if (FUNCTIONS.has(tok.v) && peek()?.t === "op" && peek().v === "(") {
        pos++;
        expr();
        while (peek()?.t === "op" && peek().v === ",") { pos++; expr(); }
        eat("op", ")");
      } else {
        ids.push(tok.v);
      }
      return;
    }
    throw new Error(`unexpected token "${tok.v}" in "${src}"`);
  }
  try {
    expr();
    if (pos !== tokens.length) throw new Error(`trailing tokens after position ${pos} in "${src}"`);
  } catch (e) {
    return { ok: false, identifiers: ids, unknown: [], error: e.message };
  }
  return { ok: true, identifiers: ids, unknown: ids.filter((x) => !KNOWN_IDENTIFIERS.has(x)) };
}
