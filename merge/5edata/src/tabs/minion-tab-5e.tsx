import React from "react";
import { Icon } from "../shared/primitives";
import { REGISTRY } from "../core/data-registry";
import { renderEntries } from "../core/tag-renderer";
import { CondBar } from "../shared/condition-bar";
import {
  bestiaryType,
  bestiaryCR,
  bestiaryAC,
  crToNum,
} from "../core/bestiary-util";
import type {
  ComputedChar,
  StoredChar,
  BestiaryEntry,
  VassalUnit,
  VassalCategory,
} from "../core/types";

function CollapsibleSection({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(true);
  return (
    <>
      <div
        className="sub-head"
        onClick={() => setOpen((o) => !o)}
        style={{
          cursor: "pointer",
          userSelect: "none",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 9,
            color: "var(--text-faint)",
            flexShrink: 0,
          }}
        >
          {open ? "▾" : "▸"}
        </span>
        {label}
      </div>
      {open && children}
    </>
  );
}

// ── Vassals ───────────────────────────────────────────────────────────────────

const WORD_TO_NUM: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function resolveCompanionHP(
  special: string,
  totalLevel: number,
  classLevel: number,
  profBonus: number,
): number {
  let s = special.toLowerCase();
  // "five times your ranger level" → classLevel * 5
  s = s.replace(/(\w+)\s+times\s+your\s+\w+\s+level/g, (_, word) => {
    const mult = WORD_TO_NUM[word] ?? parseInt(word) ?? 1;
    return String(mult * classLevel);
  });
  // "your ranger level" / "your level"
  s = s.replace(/your\s+\w+\s+level/g, String(classLevel));
  s = s.replace(/your\s+level/g, String(totalLevel));
  // PB
  s = s.replace(/\bpb\b/gi, String(profBonus));
  // strip parenthetical suffix
  s = s.split("(")[0].trim();
  // evaluate simple addition
  const parts = s
    .split("+")
    .map((p) => parseInt(p.trim(), 10))
    .filter((n) => !isNaN(n));
  return parts.length ? parts.reduce((a, b) => a + b, 0) : totalLevel * 5 + 5;
}

const FAMILIAR_NAMES = new Set([
  "bat",
  "cat",
  "crab",
  "frog",
  "hawk",
  "lizard",
  "octopus",
  "owl",
  "rat",
  "raven",
  "sea horse",
  "spider",
  "weasel",
  "imp",
  "pseudodragon",
  "quasit",
  "sprite",
]);

const CONJURE_TYPES = new Set([
  "beast",
  "elemental",
  "fey",
  "fiend",
  "construct",
  "undead",
  "aberration",
]);

const CAT_LABELS: Record<VassalCategory, string> = {
  beast: "Beast Companions",
  familiar: "Familiars",
  conjured: "Conjured Creatures",
  raised: "Raised Undead",
  arcane_construct: "Arcane Constructs",
};

function detectVassalCategories(
  c: ComputedChar,
  stored: StoredChar,
  animalFriendshipRequired = true,
) {
  const spellSet = new Set(
    [
      ...c.spellcasting.cantrips,
      ...c.spellcasting.known,
      ...c.spellcasting.prepared,
      ...c.spellcasting.grantedSpells.map((gs) => gs.name + "|"),
    ].map((k) => k.split("|")[0].toLowerCase()),
  );

  const hasSpell = (n: string) => spellSet.has(n.toLowerCase());
  const normClass = (name: string) =>
    name
      .toLowerCase()
      .replace(/^bg3-/, "")
      .replace(/\s*\(bg3\)\s*$/i, "")
      .trim();
  const hasSub = (cls: string, sub: string) =>
    stored.classes.some(
      (sc) =>
        normClass(sc.name) === cls &&
        (sc.subclass ?? "").toLowerCase().includes(sub),
    );

  const CONJURE_SPELLS = [
    "conjure animals",
    "conjure elemental",
    "conjure woodland beings",
    "conjure fey",
    "conjure minor elementals",
    "summon beast",
    "summon fey",
    "summon construct",
    "summon elemental",
    "summon fiend",
    "summon undead",
    "summon aberration",
  ];
  const RAISE_SPELLS = ["animate dead", "create undead", "danse macabre"];

  return {
    beast:
      hasSub("ranger", "beast master") ||
      hasSub("ranger", "drakewarden") ||
      hasSub("druid", "wildfire") ||
      hasSub("druid", "circle of wildfire") ||
      !animalFriendshipRequired ||
      hasSpell("animal friendship"),
    familiar:
      hasSpell("find familiar") ||
      c.featureChoices.invocations.some((i) =>
        i.toLowerCase().includes("pact of the chain"),
      ),
    conjured:
      CONJURE_SPELLS.some(hasSpell) ||
      stored.classes.some(
        (sc) => sc.name.toLowerCase().includes("artificer") && sc.level >= 2,
      ),
    raised: RAISE_SPELLS.some(hasSpell) || hasSub("wizard", "necromancy"),
    arcane_construct: hasSub("artificer", "artillerist"),
  };
}

function BestiaryPickerModal({
  category,
  entries,
  onPick,
  onClose,
}: {
  category: VassalCategory;
  entries: BestiaryEntry[];
  onPick: (e: BestiaryEntry) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = React.useState("");
  const [crFilter, setCrFilter] = React.useState("all");

  const filtered = React.useMemo(() => {
    const q = query.toLowerCase().trim();
    const crMax = crFilter === "all" ? Infinity : crToNum(crFilter);
    return entries
      .filter((e) => {
        const t = bestiaryType(e);
        if (category === "beast")
          return (
            t === "beast" ||
            e.name === "Drake Companion" ||
            e.name === "Wildfire Spirit"
          );
        if (category === "familiar")
          return FAMILIAR_NAMES.has(e.name.toLowerCase());
        if (category === "raised") return t === "undead";
        if (category === "conjured") return CONJURE_TYPES.has(t);
        return false;
      })
      .filter(
        (e) =>
          (!q || e.name.toLowerCase().includes(q)) &&
          crToNum(bestiaryCR(e)) <= crMax,
      )
      .slice(0, 80);
  }, [entries, query, crFilter, category]);

  return (
    <div
      className="modal-backdrop"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div className="modal-box">
        <div className="modal-head">
          <span style={{ fontFamily: "var(--serif)", fontSize: 18 }}>
            Add {CAT_LABELS[category]}
          </span>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-filters">
          <input
            className="modal-search"
            style={{ flex: 1 }}
            placeholder="Search creatures…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <select
            className="modal-select"
            value={crFilter}
            onChange={(e) => setCrFilter(e.target.value)}
          >
            <option value="all">All CR</option>
            <option value="0">CR 0</option>
            <option value="1/8">CR 1/8</option>
            <option value="1/4">CR 1/4</option>
            <option value="1/2">CR 1/2</option>
            <option value="1">CR ≤ 1</option>
            <option value="2">CR ≤ 2</option>
            <option value="3">CR ≤ 3</option>
            <option value="5">CR ≤ 5</option>
          </select>
        </div>
        <div className="modal-list">
          {filtered.length === 0 ? (
            <div className="modal-empty">
              No creatures match — adjust search or CR filter
            </div>
          ) : (
            <>
              {filtered.map((e) => (
                <div
                  key={`${e.name}|${e.source}`}
                  className="modal-item-row"
                  onClick={() => {
                    onPick(e);
                    onClose();
                  }}
                >
                  <div className="modal-item-name">{e.name}</div>
                  <div className="modal-item-meta">
                    <span className="modal-type-badge">{bestiaryType(e)}</span>
                    <span
                      className="modal-type-badge"
                      style={{
                        color: "var(--gold-dim)",
                        borderColor: "var(--gold-dim)",
                      }}
                    >
                      CR {bestiaryCR(e)}
                    </span>
                    {typeof e.speed.walk === "number" && (
                      <span
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 10,
                          color: "var(--text-faint)",
                        }}
                      >
                        Walk {e.speed.walk}ft
                      </span>
                    )}
                    <span
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 9,
                        color: "var(--text-faint)",
                        marginLeft: "auto",
                      }}
                    >
                      {e.source}
                    </span>
                  </div>
                </div>
              ))}
              {filtered.length === 80 && (
                <div
                  style={{
                    padding: "8px 16px",
                    color: "var(--text-faint)",
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    textAlign: "center",
                  }}
                >
                  Showing 80 of more — refine search
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function VassalUnitCard({
  unit,
  bestiaryEntries,
  profBonus,
  spellAttackBonus,
  onPatch,
  onRemove,
}: {
  unit: VassalUnit;
  bestiaryEntries: BestiaryEntry[];
  profBonus: number;
  spellAttackBonus: number;
  onPatch: (patch: Partial<VassalUnit>) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = React.useState(true);
  const [nameEditing, setNameEditing] = React.useState(false);
  const [nameVal, setNameVal] = React.useState("");
  const [adjOpen, setAdjOpen] = React.useState(false);
  const [adjVal, setAdjVal] = React.useState("");

  const entry = React.useMemo(
    () =>
      bestiaryEntries.find(
        (b) => b.name === unit.creatureName && b.source === unit.creatureSource,
      ) ?? null,
    [unit.creatureName, unit.creatureSource, bestiaryEntries],
  );

  const pct = Math.max(
    0,
    Math.min(100, (unit.hpCurrent / Math.max(1, unit.hpMax)) * 100),
  );
  const hpColor =
    pct > 60 ? "var(--vitality)" : pct > 25 ? "#c8a030" : "var(--danger)";

  const changeHP = (d: number) =>
    onPatch({
      hpCurrent: Math.max(0, Math.min(unit.hpMax, unit.hpCurrent + d)),
    });

  const applyDamage = () => {
    const n = parseInt(adjVal, 10);
    if (!n || n <= 0) return;
    onPatch({ hpCurrent: Math.max(0, unit.hpCurrent - n) });
    setAdjVal("");
    setAdjOpen(false);
  };

  const applyHeal = () => {
    const n = parseInt(adjVal, 10);
    if (!n || n <= 0) return;
    onPatch({ hpCurrent: Math.min(unit.hpMax, unit.hpCurrent + n) });
    setAdjVal("");
    setAdjOpen(false);
  };

  const commitName = () => {
    if (nameVal.trim()) onPatch({ displayName: nameVal.trim() });
    setNameEditing(false);
  };

  const iconBtn: React.CSSProperties = {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "var(--text-faint)",
    padding: "2px 4px",
    lineHeight: 1,
    fontSize: 16,
  };

  return (
    <div
      style={{
        borderTop: "1px solid var(--border-soft)",
        opacity: unit.dead ? 0.45 : 1,
        transition: "opacity 0.2s",
      }}
    >
      {/* Header */}
      <div
        className="list-head"
        style={{ borderBottom: "none", padding: "10px 16px 6px" }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            gap: 2,
            minWidth: 0,
          }}
        >
          {nameEditing ? (
            <input
              autoFocus
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName();
                if (e.key === "Escape") setNameEditing(false);
              }}
              style={{
                fontFamily: "var(--serif)",
                fontSize: 17,
                background: "transparent",
                border: "none",
                borderBottom: "1px solid var(--gold-dim)",
                outline: "none",
                color: "var(--text)",
                width: "100%",
                padding: "2px 0",
              }}
            />
          ) : (
            <span
              className="ttl"
              style={{
                cursor: "text",
                textDecoration: unit.dead ? "line-through" : "none",
                opacity: unit.dead ? 0.7 : 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              onClick={() => {
                setNameVal(unit.displayName);
                setNameEditing(true);
              }}
              title="Click to rename"
            >
              {unit.displayName}
            </span>
          )}
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: "var(--text-faint)",
              letterSpacing: "0.1em",
            }}
          >
            {unit.creatureName !== unit.displayName
              ? unit.creatureName.toUpperCase() + " · "
              : ""}
            {unit.creatureSource}
            {entry ? ` · CR ${bestiaryCR(entry)}` : ""}
            {!open && ` · HP ${unit.hpCurrent}/${unit.hpMax}`}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            gap: 2,
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <button
            style={{
              ...iconBtn,
              color: unit.dead ? "var(--danger)" : "var(--text-faint)",
            }}
            title={unit.dead ? "Restore" : "Mark dead"}
            onClick={() => onPatch({ dead: !unit.dead })}
          >
            <Icon kind="skull" size={13} />
          </button>
          <button
            style={{
              ...iconBtn,
              fontSize: 13,
              color: "var(--text-faint)",
              userSelect: "none",
            }}
            title={open ? "Collapse" : "Expand"}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "▾" : "▸"}
          </button>
          <button
            style={{ ...iconBtn, fontSize: 20 }}
            title="Remove vassal"
            onClick={onRemove}
          >
            ×
          </button>
        </div>
      </div>

      {open && (
        <>
          {/* Stat pills */}
          {entry && (
            <div
              style={{
                padding: "0 16px 6px",
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              <span className="isb-tag isb-gold">
                AC {bestiaryAC(entry, profBonus)}
              </span>
              {typeof entry.speed.walk === "number" && (
                <span className="isb-tag">Walk {entry.speed.walk}ft</span>
              )}
              {typeof entry.speed.fly === "number" && (
                <span className="isb-tag">Fly {entry.speed.fly}ft</span>
              )}
              {typeof entry.speed.swim === "number" && (
                <span className="isb-tag">Swim {entry.speed.swim}ft</span>
              )}
              <span className="isb-tag">{bestiaryType(entry)}</span>
            </div>
          )}

          {/* HP */}
          <div style={{ padding: "4px 16px 8px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 6,
              }}
            >
              <span
                className="pm"
                style={{
                  cursor: "pointer",
                  userSelect: "none",
                  fontSize: 18,
                  color: "var(--text-muted)",
                }}
                onClick={() => changeHP(-1)}
              >
                −
              </span>
              <span
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: 24,
                  color: pct < 25 ? "var(--danger)" : "var(--text)",
                  minWidth: 28,
                  textAlign: "center",
                }}
              >
                {unit.hpCurrent}
              </span>
              <span style={{ color: "var(--text-faint)", fontSize: 14 }}>
                /
              </span>
              <span
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: 17,
                  color: "var(--text-muted)",
                }}
              >
                {unit.hpMax}
              </span>
              <span
                className="pm"
                style={{
                  cursor: "pointer",
                  userSelect: "none",
                  fontSize: 18,
                  color: "var(--text-muted)",
                }}
                onClick={() => changeHP(1)}
              >
                +
              </span>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 8,
                  color: "var(--text-faint)",
                  letterSpacing: "0.1em",
                }}
              >
                HP
              </span>
            </div>
            <div
              className="hp-bar-wrap"
              onClick={() => setAdjOpen((o) => !o)}
              style={{ cursor: "pointer" }}
              title="Click to apply damage or healing"
            >
              <div
                className="hp-bar"
                style={{ width: `${pct}%`, background: hpColor }}
              />
            </div>
            {adjOpen && (
              <div className="hp-adj">
                <input
                  className="hp-adj-input"
                  type="number"
                  min="1"
                  placeholder="Amount"
                  value={adjVal}
                  autoFocus
                  onChange={(e) => setAdjVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyDamage();
                    if (e.key === "Escape") {
                      setAdjOpen(false);
                      setAdjVal("");
                    }
                  }}
                />
                <div className="hp-adj-btns">
                  <button
                    className="hp-adj-btn hp-adj-dmg"
                    onClick={applyDamage}
                  >
                    Damage
                  </button>
                  <button
                    className="hp-adj-btn hp-adj-heal"
                    onClick={applyHeal}
                  >
                    Heal
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Ability scores */}
          {entry && (
            <div
              style={{
                padding: "8px 16px",
                display: "flex",
                gap: 4,
                justifyContent: "space-between",
                borderTop: "1px solid var(--border-soft)",
              }}
            >
              {(["str", "dex", "con", "int", "wis", "cha"] as const).map(
                (stat) => {
                  const score = entry[stat];
                  const mod = Math.floor((score - 10) / 2);
                  return (
                    <div key={stat} style={{ textAlign: "center", flex: 1 }}>
                      <div
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 8,
                          color: "var(--text-faint)",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                        }}
                      >
                        {stat}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--serif)",
                          fontSize: 17,
                          color: "var(--gold)",
                          lineHeight: 1.2,
                        }}
                      >
                        {score}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 10,
                          color: "var(--text-muted)",
                        }}
                      >
                        {mod >= 0 ? "+" : ""}
                        {mod}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          )}

          {/* Conditions */}
          <CondBar
            conditions={unit.conditions}
            onChange={(next) => onPatch({ conditions: next })}
          />

          {/* Traits / Actions */}
          {entry && (entry.trait?.length || entry.action?.length) && (
            <div style={{ borderTop: "1px solid var(--border-soft)" }}>
              <CollapsibleSection
                label={
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 9,
                      letterSpacing: "0.14em",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                    }}
                  >
                    Traits &amp; Actions
                  </span>
                }
              >
                <div style={{ padding: "0 16px 10px" }}>
                  {entry.trait?.map((t, i) => (
                    <div key={i} className="feat-row">
                      <div className="row-1">
                        <div className="name" style={{ fontSize: 13 }}>
                          {t.name}
                        </div>
                      </div>
                      <div className="desc">
                        {renderEntries(t.entries, { spellAttackBonus })}
                      </div>
                    </div>
                  ))}
                  {entry.action?.map((a, i) => (
                    <div key={i} className="feat-row">
                      <div className="row-1">
                        <div className="name" style={{ fontSize: 13 }}>
                          {a.name}
                        </div>
                      </div>
                      <div className="desc">
                        {renderEntries(a.entries, { spellAttackBonus })}
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function VassalsTab({
  c,
  stored,
  setStored,
  animalFriendshipRequired = true,
}: {
  c: ComputedChar;
  stored: StoredChar;
  setStored: React.Dispatch<React.SetStateAction<StoredChar>>;
  animalFriendshipRequired?: boolean;
}) {
  const [pickerCat, setPickerCat] = React.useState<VassalCategory | null>(null);
  const bestiary: BestiaryEntry[] = REGISTRY?.bestiary ?? [];
  const units = stored.vassals ?? [];

  const cats = detectVassalCategories(c, stored, animalFriendshipRequired);
  const activeCats = (
    ["beast", "familiar", "conjured", "raised", "arcane_construct"] as VassalCategory[]
  ).filter((cat) => cats[cat]);

  const normName = (n: string) =>
    n
      .toLowerCase()
      .replace(/^bg3-/, "")
      .replace(/\s*\(bg3\)\s*$/i, "")
      .trim();

  const getClassLevel = (entry: BestiaryEntry): number => {
    const sumClass = (entry.summonedByClass ?? "")
      .split("|")[0]
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    if (sumClass) {
      const lvl = stored.classes
        .filter((cls) => normName(cls.name) === sumClass)
        .reduce((sum, cls) => sum + cls.level, 0);
      if (lvl > 0) return lvl;
    }
    // fallback: ranger level or total level
    return (
      stored.classes
        .filter((cls) => normName(cls.name) === "ranger")
        .reduce((sum, cls) => sum + cls.level, 0) || c.totalLevel
    );
  };

  // Sync hpMax for formula-based vassals whenever character level or PB changes
  React.useEffect(() => {
    if (bestiary.length === 0) return;
    setStored((s) => {
      const vassals = s.vassals ?? [];
      let changed = false;
      const updated = vassals.map((unit) => {
        const entry = bestiary.find(
          (e) =>
            e.name === unit.creatureName && e.source === unit.creatureSource,
        );
        if (!entry?.hp.special) return unit;
        const newMax = resolveCompanionHP(
          entry.hp.special,
          c.totalLevel,
          getClassLevel(entry),
          c.proficiencyBonus,
        );
        if (newMax === unit.hpMax) return unit;
        changed = true;
        const ratio = unit.hpMax > 0 ? unit.hpCurrent / unit.hpMax : 1;
        return {
          ...unit,
          hpMax: newMax,
          hpCurrent: Math.round(Math.min(newMax, Math.max(0, ratio * newMax))),
        };
      });
      return changed ? { ...s, vassals: updated } : s;
    });
  }, [c.totalLevel, c.proficiencyBonus, bestiary.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const addUnit = (entry: BestiaryEntry, cat: VassalCategory) => {
    const hpMax = entry.hp.special
      ? resolveCompanionHP(
          entry.hp.special,
          c.totalLevel,
          getClassLevel(entry),
          c.proficiencyBonus,
        )
      : (entry.hp.average ?? 1);
    setStored((s) => ({
      ...s,
      vassals: [
        ...(s.vassals ?? []),
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          displayName: entry.name,
          creatureName: entry.name,
          creatureSource: entry.source,
          category: cat,
          hpCurrent: hpMax,
          hpMax,
          conditions: {},
          dead: false,
          notes: "",
        },
      ],
    }));
  };

  const removeUnit = (id: string) =>
    setStored((s) => ({
      ...s,
      vassals: (s.vassals ?? []).filter((u) => u.id !== id),
    }));

  const patchUnit = (id: string, patch: Partial<VassalUnit>) =>
    setStored((s) => ({
      ...s,
      vassals: (s.vassals ?? []).map((u) =>
        u.id === id ? { ...u, ...patch } : u,
      ),
    }));

  if (activeCats.length === 0) {
    return (
      <div className="list-card">
        <div className="list-head">
          <span className="ttl">Vassals</span>
        </div>
        <div style={{ padding: "28px 16px", textAlign: "center" }}>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 18,
              color: "var(--text-muted)",
              marginBottom: 10,
            }}
          >
            No creature control features detected
          </div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              color: "var(--text-faint)",
              lineHeight: 1.8,
              letterSpacing: "0.06em",
            }}
          >
            Ranger / Beast Master · Drakewarden
            <br />
            Druid / Circle of Wildfire
            <br />
            Animal Friendship · Find Familiar
            <br />
            Animate Dead · Conjure Animals · Summon spells
            <br />
            Wizard / School of Necromancy
            <br />
            Artificer / Artillerist
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {pickerCat && (
        <BestiaryPickerModal
          category={pickerCat}
          entries={bestiary}
          onPick={(entry) => addUnit(entry, pickerCat)}
          onClose={() => setPickerCat(null)}
        />
      )}

      {activeCats.map((cat) => {
        const catUnits = units.filter((u) => u.category === cat);

        // Eldritch Cannon: fixed construct, not from bestiary
        if (cat === "arcane_construct") {
          const artLevel = stored.classes.find(
            (sc) => sc.name.toLowerCase().includes("artificer"),
          )?.level ?? 1;
          const cannonHP = 5 * artLevel;
          const hasCannon = catUnits.length > 0;
          const addCannon = () =>
            setStored((s) => ({
              ...s,
              vassals: [
                ...(s.vassals ?? []),
                {
                  id: `cannon-${Date.now()}`,
                  displayName: "Eldritch Cannon",
                  creatureName: "Eldritch Cannon",
                  creatureSource: "TCE",
                  category: "arcane_construct" as VassalCategory,
                  hpCurrent: cannonHP,
                  hpMax: cannonHP,
                  conditions: {},
                  dead: false,
                  notes: "Tiny construct · AC 18 · Spell attack to fire",
                },
              ],
            }));
          return (
            <div key={cat} className="list-card" style={{ marginBottom: 14 }}>
              <div className="list-head">
                <span className="ttl">{CAT_LABELS[cat]}</span>
                {!hasCannon && (
                  <button
                    className="act"
                    style={{ fontSize: 11 }}
                    onClick={addCannon}
                  >
                    + Deploy Cannon
                  </button>
                )}
              </div>
              {!hasCannon ? (
                <div
                  style={{
                    padding: "14px 16px",
                    color: "var(--text-faint)",
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                    fontSize: 14,
                  }}
                >
                  No cannon deployed — click + Deploy Cannon to create one.
                </div>
              ) : (
                catUnits.map((unit) => (
                  <VassalUnitCard
                    key={unit.id}
                    unit={unit}
                    bestiaryEntries={bestiary}
                    profBonus={c.proficiencyBonus}
                    spellAttackBonus={c.spellcasting.attackBonus}
                    onPatch={(patch) => patchUnit(unit.id, patch)}
                    onRemove={() => removeUnit(unit.id)}
                  />
                ))
              )}
            </div>
          );
        }

        return (
          <div key={cat} className="list-card" style={{ marginBottom: 14 }}>
            <div className="list-head">
              <span className="ttl">{CAT_LABELS[cat]}</span>
              <button
                className="act"
                style={{ fontSize: 11 }}
                onClick={() => setPickerCat(cat)}
                disabled={bestiary.length === 0}
                title={
                  bestiary.length === 0 ? "Loading bestiary…" : `Add ${cat}`
                }
              >
                {bestiary.length === 0 ? "Loading…" : "+ Add"}
              </button>
            </div>

            {catUnits.length === 0 ? (
              <div
                style={{
                  padding: "14px 16px",
                  color: "var(--text-faint)",
                  fontFamily: "var(--serif)",
                  fontStyle: "italic",
                  fontSize: 14,
                }}
              >
                No {cat} vassals — click + Add to summon one.
              </div>
            ) : (
              catUnits.map((unit) => (
                <VassalUnitCard
                  key={unit.id}
                  unit={unit}
                  bestiaryEntries={bestiary}
                  profBonus={c.proficiencyBonus}
                  spellAttackBonus={c.spellcasting.attackBonus}
                  onPatch={(patch) => patchUnit(unit.id, patch)}
                  onRemove={() => removeUnit(unit.id)}
                />
              ))
            )}
          </div>
        );
      })}
    </>
  );
}
