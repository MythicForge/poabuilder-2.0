import React from "react";
import { REGISTRY, loadSpells, loadItems } from "../core/data-registry";
import { renderEntries, extractBlurb } from "../core/tag-renderer";
import { getSpellRestrictions } from "../core/spell-restrictions";
import type { SpellRestrictions } from "../core/spell-restrictions";
import { resolveItem as resolveItemFn } from "../core/item-resolve";
import { RARITY_COLOR } from "./invt-tab-5e";
import type {
  ComputedChar,
  StoredChar,
  RegistrySpell,
  RegistryItem,
} from "../core/types";

// ── Spellcasting ──────────────────────────────────────────────────────────────

const SCHOOL_FULL: Record<string, string> = {
  A: "Abjuration",
  C: "Conjuration",
  D: "Divination",
  E: "Enchantment",
  V: "Evocation",
  I: "Illusion",
  N: "Necromancy",
  T: "Transmutation",
};
const SCHOOL_ABBR = Object.entries(SCHOOL_FULL).reduce<Record<string, string>>(
  (a, [k, v]) => {
    a[v] = k;
    return a;
  },
  {},
);

const TIER_LABEL: Record<number, string> = { 1: "T1", 2: "T2 @5", 3: "T3 @10" };

const SCHOOL_COLOR: Record<string, string> = {
  Abjuration: "#6ba8c9",
  Conjuration: "#7fc49e",
  Divination: "#9ec0e8",
  Enchantment: "#d4a0b8",
  Evocation: "#e07060",
  Illusion: "#b0a0d8",
  Necromancy: "#8dba72",
  Transmutation: "#c8b060",
};

// ── Add Spell Modal ───────────────────────────────────────────────────────────

interface AddSpellModalProps {
  spells: RegistrySpell[] | null;
  knownSet: Set<string>; // all known keys (cantrips + leveled)
  restrictions: SpellRestrictions | null;
  cantripCount: number;
  knownCount: number;
  onAdd: (spell: RegistrySpell) => void;
  onRemove: (key: string) => void;
  onClose: () => void;
}

function spellKey(s: RegistrySpell): string {
  return `${s.name.toLowerCase()}|${s.source.toLowerCase()}`;
}

function AddSpellModal({
  spells,
  knownSet,
  restrictions,
  cantripCount,
  knownCount,
  onAdd,
  onRemove,
  onClose,
}: AddSpellModalProps) {
  const [query, setQuery] = React.useState("");
  const [lvlFilt, setLvlFilt] = React.useState<number | "all">("all");
  const [schFilt, setSchFilt] = React.useState<string>("all");
  const [showAll, setShowAll] = React.useState(false);

  const LEVELS = ["all", 0, 1, 2, 3, 4, 5, 6] as const;
  const SCHOOLS = ["all", ...Object.values(SCHOOL_FULL)];

  const filtered = React.useMemo(() => {
    if (!spells) return [];
    const q = query.toLowerCase().trim();
    return spells
      .filter((s) => {
        if (q && !s.name.toLowerCase().includes(q)) return false;
        if (lvlFilt !== "all" && s.level !== lvlFilt) return false;
        if (schFilt !== "all") {
          const abbr = SCHOOL_ABBR[schFilt];
          if (s.school !== abbr) return false;
        }
        // Class spell list filter (skip if showAll or already known)
        if (!showAll && restrictions?.allowedNames) {
          const onList = restrictions.allowedNames.has(s.name.toLowerCase());
          const alreadyKnown = knownSet.has(spellKey(s));
          if (!onList && !alreadyKnown) return false;
        }
        return true;
      })
      .slice(0, 100);
  }, [spells, query, lvlFilt, schFilt, showAll, restrictions, knownSet]);

  const r = restrictions;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-box" role="dialog" aria-modal="true">
        <div className="modal-head">
          <span
            className="ttl"
            style={{ fontFamily: "var(--serif)", fontSize: 16 }}
          >
            Add Spell
          </span>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Limits bar */}
        {r && r.hasSpellcasting && (
          <div
            style={{
              display: "flex",
              gap: 12,
              padding: "6px 16px",
              background: "var(--card-2)",
              borderBottom: "1px solid var(--border-faint)",
              flexWrap: "wrap",
            }}
          >
            {r.maxCantrips !== null && (
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  letterSpacing: "0.1em",
                  color:
                    cantripCount >= r.maxCantrips
                      ? "var(--danger)"
                      : "var(--text-muted)",
                }}
              >
                CANTRIPS {cantripCount}/{r.maxCantrips}
                {cantripCount >= r.maxCantrips ? " · AT LIMIT" : ""}
              </span>
            )}
            {r.maxKnown !== null && !r.isPreparedCaster && (
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  letterSpacing: "0.1em",
                  color:
                    knownCount >= r.maxKnown
                      ? "var(--danger)"
                      : "var(--text-muted)",
                }}
              >
                SPELLS KNOWN {knownCount}/{r.maxKnown}
                {knownCount >= r.maxKnown ? " · AT LIMIT" : ""}
              </span>
            )}
            {r.isPreparedCaster && r.preparedMax !== null && (
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  letterSpacing: "0.1em",
                  color: "var(--text-faint)",
                }}
              >
                PREPARED LIMIT {r.preparedMax} (mod + level)
              </span>
            )}
            <button
              onClick={() => setShowAll((v) => !v)}
              style={{
                marginLeft: "auto",
                fontFamily: "var(--mono)",
                fontSize: 9,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: showAll ? "var(--gold)" : "var(--text-faint)",
                letterSpacing: "0.1em",
              }}
            >
              {showAll ? "★ CLASS LIST" : "☆ SHOW ALL"}
            </button>
          </div>
        )}

        <div className="modal-filters">
          <input
            className="modal-search"
            placeholder="Search spells…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        {/* Level filter */}
        <div className="modal-cat-row" style={{ flexWrap: "wrap" }}>
          {LEVELS.map((l) => (
            <button
              key={l}
              className={`modal-cat${lvlFilt === l ? " active" : ""}`}
              onClick={() => setLvlFilt(l)}
            >
              {l === "all" ? "All" : l === 0 ? "Cantrip" : `L${l}`}
            </button>
          ))}
        </div>
        {/* School filter */}
        <div
          className="modal-cat-row"
          style={{
            flexWrap: "wrap",
            borderTop: "1px solid var(--border-faint)",
            paddingTop: 6,
          }}
        >
          {SCHOOLS.map((sch) => (
            <button
              key={sch}
              className={`modal-cat${schFilt === sch ? " active" : ""}`}
              onClick={() => setSchFilt(sch)}
              style={{ fontSize: 9 }}
            >
              {sch === "all" ? "All Schools" : sch}
            </button>
          ))}
        </div>
        <div className="modal-list">
          {!spells ? (
            <div className="modal-empty">Loading spell data…</div>
          ) : filtered.length === 0 ? (
            <div className="modal-empty">
              No spells match
              {!showAll && r?.allowedNames ? " — try ☆ SHOW ALL" : ""}
            </div>
          ) : (
            <>
              {filtered.map((s) => {
                const key = spellKey(s);
                const known = knownSet.has(key);
                const lvlLabel = s.level === 0 ? "Cantrip" : `Level ${s.level}`;
                const isCantrip = s.level === 0;
                const atCantripCap =
                  isCantrip &&
                  r?.maxCantrips != null &&
                  cantripCount >= r.maxCantrips;
                const atKnownCap =
                  !isCantrip &&
                  !r?.isPreparedCaster &&
                  r?.maxKnown != null &&
                  knownCount >= r.maxKnown;
                const atCap = !known && (atCantripCap || atKnownCap);
                return (
                  <div
                    key={key}
                    className="modal-item-row"
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        className="modal-item-name"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {known && (
                          <span
                            style={{ color: "var(--vitality)", fontSize: 10 }}
                          >
                            ✓
                          </span>
                        )}
                        {s.name}
                      </div>
                      <div className="modal-item-meta">
                        <span className="modal-type-badge">{lvlLabel}</span>
                        <span
                          style={{
                            fontFamily: "var(--mono)",
                            fontSize: 10,
                            color: "var(--text-muted)",
                          }}
                        >
                          {SCHOOL_FULL[s.school] ?? s.school}
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--mono)",
                            fontSize: 9,
                            color: "var(--text-faint)",
                            marginLeft: "auto",
                          }}
                        >
                          {s.source}
                        </span>
                      </div>
                    </div>
                    {known ? (
                      <button
                        className="act"
                        style={{
                          flexShrink: 0,
                          color: "var(--danger)",
                          borderColor: "var(--danger-dim)",
                        }}
                        onClick={() => onRemove(key)}
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        className="act"
                        style={{
                          flexShrink: 0,
                          opacity: atCap ? 0.4 : 1,
                          cursor: atCap ? "not-allowed" : "pointer",
                        }}
                        onClick={() => !atCap && onAdd(s)}
                        disabled={atCap}
                        title={
                          atCap
                            ? isCantrip
                              ? "Cantrip limit reached"
                              : "Spell known limit reached"
                            : undefined
                        }
                      >
                        + Add
                      </button>
                    )}
                  </div>
                );
              })}
              {filtered.length === 100 && (
                <div
                  style={{
                    padding: "8px 16px",
                    color: "var(--text-faint)",
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    textAlign: "center",
                  }}
                >
                  Showing 100 — refine search
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Change Prepared Modal ─────────────────────────────────────────────────────

interface ChangePreparedModalProps {
  spells: RegistrySpell[] | null;
  knownKeys: string[]; // leveled spells only (no cantrips)
  preparedSet: Set<string>;
  onToggle: (key: string) => void;
  onClose: () => void;
}

function ChangePreparedModal({
  spells,
  knownKeys,
  preparedSet,
  onToggle,
  onClose,
}: ChangePreparedModalProps) {
  const [query, setQuery] = React.useState("");

  const rows = React.useMemo(() => {
    const q = query.toLowerCase().trim();
    return knownKeys
      .filter((key) => !q || key.split("|")[0].includes(q))
      .map((key) => {
        const reg = spells ? resolveSpellKey(spells, key) : undefined;
        const name =
          reg?.name ??
          key.split("|")[0].replace(/\b\w/g, (l) => l.toUpperCase());
        const lvl = reg?.level ?? 0;
        const sch = reg ? (SCHOOL_FULL[reg.school] ?? reg.school) : "—";
        return { key, name, lvl, sch, prepared: preparedSet.has(key) };
      })
      .sort((a, b) => a.lvl - b.lvl || a.name.localeCompare(b.name));
  }, [spells, knownKeys, preparedSet, query]);

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-box" role="dialog" aria-modal="true">
        <div className="modal-head">
          <span
            className="ttl"
            style={{ fontFamily: "var(--serif)", fontSize: 16 }}
          >
            Change Prepared Spells
          </span>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-filters">
          <input
            className="modal-search"
            placeholder="Filter spells…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        <div className="modal-list">
          {rows.length === 0 ? (
            <div className="modal-empty">No leveled spells known</div>
          ) : (
            rows.map((r) => (
              <div
                key={r.key}
                className="modal-item-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                }}
                onClick={() => onToggle(r.key)}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    flexShrink: 0,
                    borderRadius: 3,
                    border: `1px solid ${r.prepared ? "var(--vitality)" : "var(--border)"}`,
                    background: r.prepared
                      ? "var(--vitality-dim)"
                      : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {r.prepared && (
                    <span
                      style={{
                        color: "var(--vitality)",
                        fontSize: 11,
                        lineHeight: 1,
                      }}
                    >
                      ✓
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="modal-item-name">{r.name}</div>
                  <div className="modal-item-meta">
                    <span className="modal-type-badge">Level {r.lvl}</span>
                    <span
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 10,
                        color: "var(--text-muted)",
                      }}
                    >
                      {r.sch}
                    </span>
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    color: r.prepared ? "var(--vitality)" : "var(--text-faint)",
                  }}
                >
                  {r.prepared ? "Prepared" : "Unprepared"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface ResolvedSpell {
  key: string;
  name: string;
  level: number;
  school: string;
  time: string;
  range: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  prepared: boolean;
  bg3Formula?: string;
  entries?: unknown[];
}

function resolveSpellKey(
  spells: RegistrySpell[],
  key: string,
): RegistrySpell | undefined {
  const [rawName, rawSrc = ""] = key.split("|");
  const name = rawName.toLowerCase();
  const src = rawSrc.toLowerCase();
  return (
    spells.find(
      (s) => s.name.toLowerCase() === name && s.source.toLowerCase() === src,
    ) ?? spells.find((s) => s.name.toLowerCase() === name)
  );
}

function spellToDisplay(
  spells: RegistrySpell[] | null,
  key: string,
  prepared: boolean,
): ResolvedSpell {
  const stub = (): ResolvedSpell => ({
    key,
    name: key.split("|")[0].replace(/\b\w/g, (l) => l.toUpperCase()),
    level: 0,
    school: "—",
    time: "—",
    range: "—",
    duration: "—",
    concentration: false,
    ritual: false,
    prepared,
  });
  if (!spells) return stub();
  const s = resolveSpellKey(spells, key);
  if (!s) return stub();

  const t0 = s.time?.[0];
  const timeStr = !t0
    ? "—"
    : t0.unit === "bonus"
      ? "Bonus Action"
      : t0.unit === "reaction"
        ? "Reaction"
        : t0.unit === "minute"
          ? `${t0.number} min`
          : "Action";

  const rng = s.range;
  const rangeStr = !rng
    ? "—"
    : rng.type === "touch"
      ? "Touch"
      : rng.type === "self"
        ? "Self"
        : rng.type === "sight"
          ? "Sight"
          : rng.distance?.type === "feet"
            ? `${rng.distance.amount} ft`
            : rng.distance?.type === "miles"
              ? `${rng.distance.amount} mi`
              : "—";

  const d0 = s.duration?.[0];
  const conc = d0?.concentration ?? false;
  const durStr = !d0
    ? "—"
    : d0.type === "instant"
      ? "Instant"
      : d0.type === "permanent"
        ? "Permanent"
        : d0.type === "timed"
          ? `${d0.duration?.amount ?? ""}${(d0.duration?.type ?? "")[0]?.toUpperCase() ?? ""}`
          : "Special";

  return {
    key,
    name: s.name,
    level: s.level,
    school: SCHOOL_FULL[s.school] ?? s.school,
    time: timeStr,
    range: rangeStr,
    duration: durStr,
    concentration: conc,
    ritual: s.ritual ?? false,
    prepared,
    bg3Formula: s.bg3Formula,
    entries: s.entries?.length ? s.entries : undefined,
  };
}

interface SpellRowProps {
  s: ResolvedSpell;
  slots: ComputedChar["spellcasting"]["slots"];
  pactSlots: ComputedChar["spellcasting"]["pactSlots"];
  concentratingOn: string | null;
  onCast: (
    spellKey: string,
    slotLevel: number,
    slotType: "regular" | "pact" | "cantrip",
    isConc: boolean,
  ) => void;
  cantripTier?: number;
  starred?: boolean;
  onToggleStar?: () => void;
}

function SpellRow({
  s,
  slots,
  pactSlots,
  concentratingOn,
  onCast,
  cantripTier,
  starred,
  onToggleStar,
}: SpellRowProps) {
  const [open, setOpen] = React.useState(false);
  const [pendingCast, setPendingCast] = React.useState<{
    slotLevel: number;
    slotType: "regular" | "pact" | "cantrip";
  } | null>(null);

  const isCantrip = s.level === 0;
  const isActiveConc = concentratingOn === s.key;

  // Slots available for casting (regular ≥ spell level)
  const regularSlots = isCantrip
    ? []
    : slots.filter((sl) => sl.level >= s.level && sl.current > 0);
  const pactAvail =
    !isCantrip &&
    pactSlots &&
    pactSlots.level >= s.level &&
    pactSlots.current > 0;
  const canCast = isCantrip || regularSlots.length > 0 || pactAvail;

  const concName =
    concentratingOn && concentratingOn !== s.key
      ? concentratingOn.split("|")[0].replace(/\b\w/g, (l) => l.toUpperCase())
      : null;

  const triggerCast = (
    slotLevel: number,
    slotType: "regular" | "pact" | "cantrip",
  ) => {
    if (s.concentration && concentratingOn && concentratingOn !== s.key) {
      setPendingCast({ slotLevel, slotType });
      if (!open) setOpen(true);
      return;
    }
    onCast(s.key, slotLevel, slotType, s.concentration);
  };

  const confirmPendingCast = () => {
    if (!pendingCast) return;
    onCast(s.key, pendingCast.slotLevel, pendingCast.slotType, s.concentration);
    setPendingCast(null);
  };

  const castBadge = (() => {
    if (s.time === "Action") return "A";
    if (s.time === "Bonus Action") return "BA";
    if (s.time === "Reaction") return "Re";
    if (s.time.includes("min")) return s.time.replace(" ", "");
    return null;
  })();

  const schoolAbbr = SCHOOL_ABBR[s.school] ?? s.school?.[0] ?? "?";
  const schoolColor = SCHOOL_COLOR[s.school] ?? "var(--text-faint)";

  return (
    <div
      className={`litem${!s.prepared && !isCantrip ? " sc-unprepared" : ""}`}
    >
      <div
        className={`lrow${open ? " open" : ""}`}
        onClick={() => {
          setOpen((o) => !o);
          if (open) setPendingCast(null);
        }}
      >
        <button
          className={`lstar${starred ? " on" : ""}`}
          title={starred ? "Unstar spell" : "Star spell (shows in Combat)"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar?.();
          }}
        >
          {starred ? "★" : "☆"}
        </button>
        <span
          className="lrow-glyph sc-school-glyph"
          style={{ color: schoolColor, fontSize: 9, fontWeight: 700 }}
        >
          {schoolAbbr}
        </span>
        <span className={`lname${isActiveConc ? " sc-conc-name" : ""}`}>
          {s.name}
        </span>
        <span className="lcost-cell">
          {s.concentration && (
            <span
              className="cost-badge"
              style={{
                fontSize: 8,
                borderColor: "var(--gold-dim)",
                color: "var(--gold-dim)",
              }}
            >
              C
            </span>
          )}
          {s.ritual && (
            <span
              className="cost-badge"
              style={{
                fontSize: 8,
                borderColor: "var(--border)",
                color: "var(--text-faint)",
                marginLeft: 3,
              }}
            >
              R
            </span>
          )}
          {s.bg3Formula && (
            <span
              className="cost-badge sp"
              style={{ fontSize: 8, marginLeft: 3 }}
            >
              {s.bg3Formula.length > 7
                ? s.bg3Formula.slice(0, 7) + "…"
                : s.bg3Formula}
            </span>
          )}
        </span>
        <span className="lpip-cell">
          {castBadge ? (
            <span className="passmark">{castBadge}</span>
          ) : isCantrip && cantripTier ? (
            <span className="passmark">{TIER_LABEL[cantripTier]}</span>
          ) : null}
        </span>
        <span className="lcaret">
          <svg
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 2l4 4-4 4" />
          </svg>
        </span>
      </div>
      {open && (
        <div className="lrow-detail">
          <div className="lmeta">
            {s.school !== "—" && (
              <span className="mi">
                <span className="mk">School</span>
                <span className="mv" style={{ color: schoolColor }}>
                  {s.school}
                </span>
              </span>
            )}
            <span className="mi">
              <span className="mk">Cast</span>
              <span className="mv">{s.time}</span>
            </span>
            <span className="mi">
              <span className="mk">Range</span>
              <span className="mv">{s.range}</span>
            </span>
            <span className="mi">
              <span className="mk">Duration</span>
              <span className="mv">{s.duration}</span>
            </span>
            {isActiveConc && (
              <span
                className="cost-badge"
                style={{
                  fontSize: 8,
                  borderColor: "var(--gold)",
                  color: "var(--gold)",
                }}
              >
                Concentrating
              </span>
            )}
          </div>
          {s.entries?.length ? (
            <div className="ldtext">{renderEntries(s.entries)}</div>
          ) : null}
          {!pendingCast && (
            <div className="spell-cast-group">
              {isCantrip ? (
                <button
                  className="spell-cast-btn is-cast"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerCast(0, "cantrip");
                  }}
                >
                  Cast
                </button>
              ) : canCast ? (
                <>
                  {regularSlots.map((sl) => (
                    <button
                      key={sl.level}
                      className="spell-cast-btn is-cast"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerCast(sl.level, "regular");
                      }}
                    >
                      Cast Level {sl.level}
                    </button>
                  ))}
                  {pactAvail && (
                    <button
                      className="spell-cast-btn is-pact"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerCast(pactSlots!.level, "pact");
                      }}
                    >
                      Pact Level {pactSlots!.level}
                    </button>
                  )}
                </>
              ) : (
                <span className="spell-no-slots">No Slots Remaining</span>
              )}
            </div>
          )}
          {pendingCast && concName && (
            <div
              className="spell-conc-warn"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="spell-conc-warn-text">
                Concentrating on <em>{concName}</em>. Casting {s.name} will end
                that spell.
              </div>
              <div className="spell-conc-warn-btns">
                <button
                  className="spell-cast-btn is-cast"
                  onClick={(e) => {
                    e.stopPropagation();
                    confirmPendingCast();
                  }}
                >
                  Confirm Cast
                </button>
                <button
                  className="spell-cast-btn is-cancel"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingCast(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface SpellcastingTabProps {
  c: ComputedChar;
  stored: StoredChar;
  setStored: React.Dispatch<React.SetStateAction<StoredChar>>;
}
export function SpellcastingTab5e({
  c,
  stored,
  setStored,
}: SpellcastingTabProps) {
  const sc = c.spellcasting;

  const [spells, setSpells] = React.useState<RegistrySpell[] | null>(null);
  const [items, setItems] = React.useState<RegistryItem[] | null>(null);
  const [showAddSpell, setShowAddSpell] = React.useState(false);
  const [showPrepared, setShowPrepared] = React.useState(false);

  React.useEffect(() => {
    loadSpells().then((s) => setSpells(s));
    loadItems().then((d) => setItems(d));
  }, []);

  const resolvedCantrips = React.useMemo(
    () => sc.cantrips.map((key) => spellToDisplay(spells, key, true)),
    [spells, sc.cantrips],
  );

  const preparedSet = React.useMemo(() => new Set(sc.prepared), [sc.prepared]);

  const spellGroups = React.useMemo(() => {
    const groups: Record<number, ResolvedSpell[]> = {};
    for (const key of sc.known) {
      const s = spells ? resolveSpellKey(spells, key) : undefined;
      const lvl = s?.level ?? 0;
      if (lvl === 0) continue;
      if (!groups[lvl]) groups[lvl] = [];
      groups[lvl].push(spellToDisplay(spells, key, preparedSet.has(key)));
    }
    return Object.keys(groups)
      .sort((a, b) => +a - +b)
      .map((lvl) => ({ level: +lvl, spells: groups[+lvl] }));
  }, [spells, sc.known, preparedSet]);

  // All known keys = cantrips + leveled for the add modal "already known" check
  const allKnownSet = React.useMemo(
    () => new Set([...sc.cantrips, ...sc.known]),
    [sc.cantrips, sc.known],
  );

  // Spell restrictions (class list filter + limits, including feat-granted spellcasting)
  const restrictions = React.useMemo(() => {
    const mods: Record<string, number> = {};
    for (const [k, v] of Object.entries(c.abilities)) mods[k] = v.mod;
    // Collect feat names from all sources (ASI slots, race, background)
    const bgEntry = (
      REGISTRY?.backgrounds as
        | Array<{ name: string; backgroundFeat?: string }>
        | undefined
    )?.find((b) => b.name === stored.background.name);
    const allFeatNames = [
      ...(stored.feats ?? []),
      ...(stored.race?.feat ? [stored.race.feat] : []),
      ...(bgEntry?.backgroundFeat ? [bgEntry.backgroundFeat] : []),
    ];
    return getSpellRestrictions(stored.classes, mods, allFeatNames);
  }, [
    stored.classes,
    stored.feats,
    stored.race?.feat,
    stored.background.name,
    c.abilities,
  ]);

  const hasSpellcasting =
    sc.ability !== "—" || (restrictions?.hasSpellcasting ?? false);

  const starredSpellsSet = React.useMemo(
    () => new Set(stored.starredSpells ?? []),
    [stored.starredSpells],
  );

  const toggleStarredSpell = (key: string) =>
    setStored((s) => {
      const current = s.starredSpells ?? [];
      const next = current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key];
      return { ...s, starredSpells: next };
    });

  const useSlot = (level: number, delta: number) =>
    setStored((s) => {
      const used = s.spellcasting.slotsUsed[level] ?? 0;
      const slotObj = sc.slots.find((sl) => sl.level === level);
      const max = slotObj?.max ?? 0;
      const newUsed = Math.max(0, Math.min(max, used + delta));
      return {
        ...s,
        spellcasting: {
          ...s.spellcasting,
          slotsUsed: { ...s.spellcasting.slotsUsed, [level]: newUsed },
        },
      };
    });

  const usePactSlot = (delta: number) =>
    setStored((s) => {
      const used = s.resources.pactSlots?.used ?? 0;
      const max = sc.pactSlots?.max ?? 1;
      const newUsed = Math.max(0, Math.min(max, used + delta));
      return {
        ...s,
        resources: { ...s.resources, pactSlots: { used: newUsed } },
      };
    });

  const handleCast = (
    spellKey: string,
    slotLevel: number,
    slotType: "regular" | "pact" | "cantrip",
    isConcentration: boolean,
  ) =>
    setStored((s) => {
      let next = { ...s };
      if (slotType === "regular" && slotLevel > 0) {
        const used = s.spellcasting.slotsUsed[slotLevel] ?? 0;
        next = {
          ...next,
          spellcasting: {
            ...next.spellcasting,
            slotsUsed: {
              ...next.spellcasting.slotsUsed,
              [slotLevel]: used + 1,
            },
          },
        };
      } else if (slotType === "pact") {
        const used = s.resources.pactSlots?.used ?? 0;
        next = {
          ...next,
          resources: { ...next.resources, pactSlots: { used: used + 1 } },
        };
      }
      if (isConcentration) {
        next = { ...next, concentratingOn: spellKey };
      }
      return next;
    });

  const endConcentration = () =>
    setStored((s) => ({ ...s, concentratingOn: null }));

  const concentratingOn = stored.concentratingOn ?? null;
  const concentratingName = React.useMemo(() => {
    if (!concentratingOn) return null;
    const reg = spells ? resolveSpellKey(spells, concentratingOn) : undefined;
    return (
      reg?.name ??
      concentratingOn.split("|")[0].replace(/\b\w/g, (l) => l.toUpperCase())
    );
  }, [concentratingOn, spells]);

  const handleAddSpell = (spell: RegistrySpell) => {
    const key = spellKey(spell);
    setStored((s) => {
      if (spell.level === 0) {
        if (s.spellcasting.cantrips.includes(key)) return s;
        return {
          ...s,
          spellcasting: {
            ...s.spellcasting,
            cantrips: [...s.spellcasting.cantrips, key],
          },
        };
      } else {
        if (s.spellcasting.known.includes(key)) return s;
        return {
          ...s,
          spellcasting: {
            ...s.spellcasting,
            known: [...s.spellcasting.known, key],
          },
        };
      }
    });
  };

  const handleRemoveSpell = (key: string) => {
    setStored((s) => ({
      ...s,
      spellcasting: {
        ...s.spellcasting,
        cantrips: s.spellcasting.cantrips.filter((k) => k !== key),
        known: s.spellcasting.known.filter((k) => k !== key),
        prepared: s.spellcasting.prepared.filter((k) => k !== key),
      },
    }));
  };

  const handleTogglePrepared = (key: string) => {
    setStored((s) => {
      const prepared = s.spellcasting.prepared.includes(key)
        ? s.spellcasting.prepared.filter((k) => k !== key)
        : [...s.spellcasting.prepared, key];
      return { ...s, spellcasting: { ...s.spellcasting, prepared } };
    });
  };

  return (
    <div className="panel-redesign sc-panel">
      {/* Header */}
      <div className="sc-panel-head">
        <span className="sc-panel-title">
          Spellcasting
          {hasSpellcasting && (
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 9,
                color: "var(--text-faint)",
                marginLeft: 6,
                fontWeight: 400,
              }}
            >
              {sc.cantrips.length + sc.known.length}
            </span>
          )}
        </span>
        {hasSpellcasting && (
          <div className="sc-panel-meta">
            <span className="sc-meta-chip">
              <span className="mk">DC</span>
              <span className="sc-mv">{sc.saveDC}</span>
            </span>
            <span className="sc-meta-chip">
              <span className="mk">Atk</span>
              <span className="sc-mv">+{sc.attackBonus}</span>
            </span>
            <span className="sc-meta-chip sc-ability-chip">{sc.ability}</span>
            {restrictions?.isPreparedCaster &&
              restrictions?.preparedMax !== null && (
                <span className="sc-meta-chip">
                  <span className="mk">Prep</span>
                  <span
                    className="sc-mv"
                    style={{
                      color:
                        sc.prepared.length >
                        (restrictions.preparedMax ?? Infinity)
                          ? "var(--danger)"
                          : undefined,
                    }}
                  >
                    {sc.prepared.length}/{restrictions.preparedMax}
                  </span>
                </span>
              )}
          </div>
        )}
        <div className="sc-panel-actions">
          {hasSpellcasting && (
            <button className="act" onClick={() => setShowAddSpell(true)}>
              + Add Spell
            </button>
          )}
          {hasSpellcasting && restrictions?.isPreparedCaster && (
            <button className="act" onClick={() => setShowPrepared(true)}>
              ⇆ Prepared
            </button>
          )}
        </div>
      </div>

      {/* No-casting placeholder */}
      {!hasSpellcasting && (
        <div className="sc-no-casting">
          No spellcasting feature — select a spellcasting class in builder
        </div>
      )}

      {/* Slot strip */}
      {hasSpellcasting && (sc.slots.length > 0 || sc.pactSlots) && (
        <div className="sc-slot-strip">
          <div className="sc-slot-chips">
            {sc.pactSlots &&
              (() => {
                const ps = sc.pactSlots!;
                return (
                  <div
                    className="sc-slot-chip"
                    style={{ "--c": "#b0a0d8" } as React.CSSProperties}
                  >
                    <div className="sc-slot-chip-label">
                      Pact LV {ps.level}
                      <span className="sc-slot-chip-rest">· SR</span>
                    </div>
                    <div className="sc-slot-chip-bot">
                      <div className="rc-pips">
                        {Array.from({ length: ps.max }).map((_, i) => (
                          <div
                            key={i}
                            className={`rc-pip${i < ps.current ? " filled" : ""}`}
                            onClick={() => usePactSlot(i < ps.current ? 1 : -1)}
                          />
                        ))}
                      </div>
                      <span className="rc-chip-count">
                        {ps.current}/{ps.max}
                      </span>
                    </div>
                  </div>
                );
              })()}
            {sc.slots.map((slot) => (
              <div
                key={slot.level}
                className="sc-slot-chip"
                style={{ "--c": "var(--gold-dim)" } as React.CSSProperties}
              >
                <div className="sc-slot-chip-label">
                  Spell LV {slot.level}
                  <span className="sc-slot-chip-rest">· LR</span>
                </div>
                <div className="sc-slot-chip-bot">
                  <div className="rc-pips">
                    {Array.from({ length: slot.max }).map((_, i) => (
                      <div
                        key={i}
                        className={`rc-pip${i < slot.current ? " filled" : ""}`}
                        onClick={() =>
                          useSlot(slot.level, i < slot.current ? 1 : -1)
                        }
                      />
                    ))}
                  </div>
                  <span className="rc-chip-count">
                    {slot.current}/{slot.max}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Concentration banner */}
      {hasSpellcasting && concentratingOn && (
        <div className="sc-conc-banner">
          <span className="sc-conc-label">
            ⟳ Concentrating — {concentratingName}
          </span>
          <button className="sc-act" onClick={endConcentration}>
            End
          </button>
        </div>
      )}

      {/* Spell ledger */}
      {hasSpellcasting && (
        <div className="sc-ledger">
          {/* Cantrips group */}
          <div
            className="lgroup"
            style={{ "--c": "var(--gold-dim)" } as React.CSSProperties}
          >
            <div className="lgroup-head">
              <span className="lgroup-title">
                <span className="lgroup-bar" />
                Cantrips
                {restrictions?.maxCantrips !== null && (
                  <span
                    className="sc-prepared-count"
                    style={{
                      color:
                        sc.cantrips.length >=
                        (restrictions?.maxCantrips ?? Infinity)
                          ? "var(--danger)"
                          : undefined,
                    }}
                  >
                    {sc.cantrips.length}/{restrictions?.maxCantrips}
                  </span>
                )}
              </span>
              <span className="lgroup-rule" />
              <span className="sc-tier-badge">Tier {sc.cantripTier}</span>
            </div>
            {resolvedCantrips.length === 0 ? (
              <div className="sc-empty-hint">
                No cantrips — + Add Spell above
              </div>
            ) : (
              resolvedCantrips.map((s) => (
                <SpellRow
                  key={s.key}
                  s={s}
                  slots={sc.slots}
                  pactSlots={sc.pactSlots}
                  concentratingOn={concentratingOn}
                  onCast={handleCast}
                  cantripTier={sc.cantripTier}
                  starred={starredSpellsSet.has(s.key)}
                  onToggleStar={() => toggleStarredSpell(s.key)}
                />
              ))
            )}
          </div>

          {/* Leveled spell groups */}
          {spellGroups.length === 0 && sc.known.length === 0 ? (
            <div className="sc-empty-hint" style={{ padding: "12px 16px" }}>
              No spells — + Add Spell above
            </div>
          ) : (
            spellGroups.map((grp) => {
              const slot = sc.slots.find((sl) => sl.level === grp.level);
              return (
                <div
                  key={grp.level}
                  className="lgroup"
                  style={{ "--c": "var(--gold-dim)" } as React.CSSProperties}
                >
                  <div className="lgroup-head">
                    <span className="lgroup-title">
                      <span className="lgroup-bar" />
                      Level {grp.level}
                    </span>
                    <span className="lgroup-rule" />
                    {slot && (
                      <span className="poolchip">
                        <span className="poolchip-name">Slots</span>
                        <span className="poolchip-ct">
                          <b>{slot.current}</b>/{slot.max}
                        </span>
                        <span className="pool-pips">
                          {Array.from({ length: slot.max }).map((_, i) => (
                            <button
                              key={i}
                              className={`ppip${i < slot.current ? " on" : ""}`}
                              onClick={() =>
                                useSlot(slot.level, i < slot.current ? 1 : -1)
                              }
                            />
                          ))}
                        </span>
                      </span>
                    )}
                  </div>
                  {grp.spells.map((s) => (
                    <SpellRow
                      key={s.key}
                      s={s}
                      slots={sc.slots}
                      pactSlots={sc.pactSlots}
                      concentratingOn={concentratingOn}
                      onCast={handleCast}
                      starred={starredSpellsSet.has(s.key)}
                      onToggleStar={() => toggleStarredSpell(s.key)}
                    />
                  ))}
                </div>
              );
            })
          )}

          {/* Class-granted cantrips/spells */}
          {(sc.grantedCantrips.length > 0 || sc.grantedSpells.length > 0) && (
            <div
              className="lgroup"
              style={{ "--c": "var(--gold-dim)" } as React.CSSProperties}
            >
              <div className="lgroup-head">
                <span className="lgroup-title">
                  <span className="lgroup-bar" />
                  Class-Granted
                </span>
                <span className="lgroup-rule" />
              </div>
              {sc.grantedCantrips.map((key) => {
                const sp = spellToDisplay(spells, key, true);
                return (
                  <SpellRow
                    key={sp.key}
                    s={sp}
                    slots={sc.slots}
                    pactSlots={sc.pactSlots}
                    concentratingOn={concentratingOn}
                    onCast={handleCast}
                    cantripTier={sc.cantripTier}
                    starred={starredSpellsSet.has(sp.key)}
                    onToggleStar={() => toggleStarredSpell(sp.key)}
                  />
                );
              })}
              {sc.grantedSpells.map((gs, i) => (
                <div key={i} className="litem">
                  <div className="lrow" style={{ cursor: "default" }}>
                    <span />
                    <span
                      className="lrow-glyph"
                      style={{
                        color: "var(--gold-dim)",
                        fontSize: 9,
                        fontWeight: 700,
                      }}
                    >
                      ♦
                    </span>
                    <span className="lname">{gs.name}</span>
                    <span className="lcost-cell">
                      <span
                        className="cost-badge"
                        style={{
                          fontSize: 8,
                          borderColor: "var(--border)",
                          color: "var(--text-faint)",
                        }}
                      >
                        {gs.usage}
                      </span>
                    </span>
                    <span className="lpip-cell" />
                    <span className="lcaret" style={{ opacity: 0 }}>
                      <svg
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 2l4 4-4 4" />
                      </svg>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Spell scrolls (from inventory) */}
          {(() => {
            const scrolls = stored.equipment.inventory.filter((inv) => {
              if (!items) return false;
              const reg = resolveItemFn(
                stored.equipment.inventory,
                items,
                inv.key,
              );
              return reg && (reg.type ?? "").replace(/\|.*/, "") === "SC";
            });
            if (scrolls.length === 0) return null;

            const useScroll = (key: string) =>
              setStored((s) => {
                const inv = s.equipment.inventory.find((i) => i.key === key);
                if (!inv) return s;
                if (inv.qty <= 1) {
                  return {
                    ...s,
                    equipment: {
                      ...s.equipment,
                      inventory: s.equipment.inventory.filter(
                        (i) => i.key !== key,
                      ),
                    },
                  };
                }
                return {
                  ...s,
                  equipment: {
                    ...s.equipment,
                    inventory: s.equipment.inventory.map((i) =>
                      i.key === key ? { ...i, qty: i.qty - 1 } : i,
                    ),
                  },
                };
              });

            return (
              <div
                className="lgroup"
                style={{ "--c": "#c8b060" } as React.CSSProperties}
              >
                <div className="lgroup-head">
                  <span className="lgroup-title">
                    <span className="lgroup-bar" />
                    Spell Scrolls
                  </span>
                  <span className="lgroup-rule" />
                  <span className="sc-tier-badge">
                    from inventory · click to use
                  </span>
                </div>
                {scrolls.map((inv) => {
                  const reg = items
                    ? resolveItemFn(stored.equipment.inventory, items, inv.key)
                    : undefined;
                  const displayName =
                    reg?.name ??
                    inv.key
                      .split("|")[0]
                      .replace(/\b\w/g, (l) => l.toUpperCase());
                  const rarity =
                    reg?.rarity && !["none", "", "unknown"].includes(reg.rarity)
                      ? reg.rarity
                      : null;
                  const blurb = reg?.entries?.length
                    ? extractBlurb(reg.entries as unknown[])
                    : "";
                  return (
                    <div key={inv.key} className="litem">
                      <div
                        className="lrow"
                        style={{ cursor: "pointer" }}
                        onClick={() => useScroll(inv.key)}
                      >
                        <span />
                        <span
                          className="lrow-glyph"
                          style={{
                            color: "#c8b060",
                            fontSize: 9,
                            fontWeight: 700,
                          }}
                        >
                          S
                        </span>
                        <span className="lname">
                          {displayName}
                          {inv.qty > 1 && (
                            <span
                              style={{
                                fontFamily: "var(--mono)",
                                fontSize: 10,
                                color: "var(--text-muted)",
                                marginLeft: 6,
                              }}
                            >
                              ×{inv.qty}
                            </span>
                          )}
                        </span>
                        <span className="lcost-cell">
                          {rarity && (
                            <span
                              style={{
                                color:
                                  RARITY_COLOR[rarity] ?? "var(--text-muted)",
                                fontSize: 10,
                                fontFamily: "var(--mono)",
                              }}
                            >
                              {rarity}
                            </span>
                          )}
                        </span>
                        <span className="lpip-cell">
                          {blurb && (
                            <span
                              style={{
                                fontFamily: "var(--sans)",
                                fontSize: 10,
                                color: "var(--text-faint)",
                              }}
                            >
                              {blurb.length > 35
                                ? blurb.slice(0, 35) + "…"
                                : blurb}
                            </span>
                          )}
                        </span>
                        <span className="lcaret" style={{ opacity: 0 }}>
                          <svg
                            viewBox="0 0 12 12"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M4 2l4 4-4 4" />
                          </svg>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Loading state */}
          {!spells && (sc.known.length > 0 || sc.cantrips.length > 0) && (
            <div className="sc-empty-hint">Loading spell data…</div>
          )}
        </div>
      )}

      {/* Modals */}
      {showAddSpell && (
        <AddSpellModal
          spells={spells}
          knownSet={allKnownSet}
          restrictions={restrictions}
          cantripCount={sc.cantrips.length}
          knownCount={sc.known.length}
          onAdd={handleAddSpell}
          onRemove={handleRemoveSpell}
          onClose={() => setShowAddSpell(false)}
        />
      )}
      {showPrepared && (
        <ChangePreparedModal
          spells={spells}
          knownKeys={sc.known}
          preparedSet={preparedSet}
          onToggle={handleTogglePrepared}
          onClose={() => setShowPrepared(false)}
        />
      )}
    </div>
  );
}
