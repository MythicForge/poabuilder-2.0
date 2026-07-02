import React from "react";
import { ProfBadge } from "../shared/primitives";
import { loadItems } from "../core/data-registry";
import { renderEntries } from "../core/tag-renderer";
import { resolveItem as resolveItemFn } from "../core/item-resolve";
import { propLabel } from "./invt-tab-5e";
import type { ComputedChar, StoredChar, RegistryItem } from "../core/types";

// ── Combat ───────────────────────────────────────────────────────────────────

const COMBAT_CLASS_COLOR: Record<string, string> = {
  Apothecary: "#6f2828",
  Artificer: "#8A00C4",
  Bard: "#d877ab",
  Monk: "#54bdc9",
  Sorcerer: "#9d80dd",
  Cleric: "#5f94d6",
  Druid: "#5fae6b",
  Warlock: "#cf9a4e",
  Fighter: "#b85c3c",
  Wizard: "#8a6fc5",
  Illrigger: "#ad0a2f",
  Rogue: "#4aae7f",
  Ranger: "#7aae4a",
  "Ranger (BG3)": "#7aae4a",
  Paladin: "#c9b454",
  "Paladin (BG3)": "#c9b454",
  Barbarian: "#c95454",
  Feat: "#74757f",
  Captain: "#c9b454",
  Champion: "#b85c3c",
  "Teasure Hunter": "#4aae7f",
  Scholar: "#5f94d6",
  Warden: "#7aae4a",
};

type EconKey = "action" | "bonus" | "reaction" | "free" | "passive";
type CombatPoolKey = "ki" | "sp" | "bardic" | "sup" | "rages";

const ECON_GLYPH: Record<EconKey, React.ReactNode> = {
  action: (
    <svg viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="4.4" fill="currentColor" />
    </svg>
  ),
  bonus: (
    <svg viewBox="0 0 16 16">
      <path
        d="M8 3.1l4.7 8.6a.6.6 0 0 1-.53.9H3.83a.6.6 0 0 1-.53-.9z"
        fill="currentColor"
      />
    </svg>
  ),
  free: (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M8 3.4v9.2M3.4 8h9.2" />
    </svg>
  ),
  reaction: (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11.8 5v2.2a2 2 0 0 1-2 2H4.6" />
      <path d="M6.6 7.3L4.3 9.4l2.3 2.1" />
    </svg>
  ),
  passive: (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <path d="M4 8h8" />
    </svg>
  ),
};

const ECON_COLOR: Record<EconKey, string> = {
  action: "var(--gold-bright)",
  bonus: "var(--vitality)",
  reaction: "#5f94d6",
  free: "#c98b54",
  passive: "var(--text-faint)",
};

const ECON_LABEL: Record<EconKey, string> = {
  action: "Action",
  bonus: "Bonus Action",
  reaction: "Reaction",
  free: "No Action",
  passive: "Passive",
};

function inferCombatEcon(text: string): EconKey {
  const d = text.toLowerCase();
  if (d.includes("bonus action")) return "bonus";
  if (d.includes("reaction")) return "reaction";
  if (
    d.includes("free action") ||
    d.includes("no action") ||
    d.includes("on a hit") ||
    d.includes("when you hit")
  )
    return "free";
  if (
    d.includes("always active") ||
    d.includes("resistance to") ||
    d.includes("you are proficient")
  )
    return "passive";
  return "action";
}

function sourceClassGroup(
  source: ComputedChar["combatAbilities"][number]["source"],
  classes: ComputedChar["classes"],
): string {
  switch (source) {
    case "ki":
      return "Monk";
    case "metamagic":
      return "Sorcerer";
    case "maneuver":
      return "Fighter";
    case "invocation":
      return "Warlock";
    case "infusion":
    case "armorModel":
      return "Artificer";
    case "fightingStyle": {
      const fsCls = classes.find((c) =>
        [
          "Fighter",
          "Ranger",
          "Paladin",
          "Ranger (BG3)",
          "Paladin (BG3)",
        ].includes(c.name),
      );
      return fsCls?.name ?? "Fighter";
    }
    default:
      return "General";
  }
}

interface LedgerEntry {
  id: string;
  name: string;
  srcClass: string;
  color: string;
  econ: EconKey;
  rest: string;
  poolKey?: CombatPoolKey;
  costLabel?: string;
  costAmount?: number;
  chargesCurrent?: number;
  chargesMax?: number;
  chargeId?: string;
  hpPool?: boolean;
  text: string;
}

interface LedgerGroup {
  srcClass: string;
  color: string;
  poolKey?: CombatPoolKey;
  entries: LedgerEntry[];
}

interface CombatPoolData {
  name: string;
  die?: string;
  resetOn: string;
  current: number;
  max: number;
}

const RARITY_GLOW: Record<string, string> = {
  uncommon: "#6aaa6a",
  rare: "#5599cc",
  "very rare": "#aa55cc",
  legendary: "#cc9922",
  artifact: "#cc5522",
};

// ── Weapon Sets (stat-forward) ────────────────────────────────────────────────

function WeaponSetsPanel({
  c,
  loreMode,
  setLoreMode,
}: {
  c: ComputedChar;
  loreMode: "inline" | "popover";
  setLoreMode: (m: "inline" | "popover") => void;
}) {
  const [items, setItems] = React.useState<RegistryItem[] | null>(null);
  const [openCards, setOpenCards] = React.useState<Set<string>>(new Set());
  const [popCard, setPopCard] = React.useState<string | null>(null);
  const eq = c.equipment;

  React.useEffect(() => {
    loadItems().then(setItems);
  }, []);

  React.useEffect(() => {
    if (!popCard) return;
    const close = () => setPopCard(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [popCard]);

  const resolveItem = (
    key: string | null | undefined,
  ): RegistryItem | undefined => resolveItemFn(eq.inventory, items, key);

  const weaponProfs = c.proficiencies.weapons.split(", ").filter(Boolean);
  const armorProfs = c.proficiencies.armor.split(", ").filter(Boolean);

  const findAtk = (key: string | null | undefined, offhand = false) => {
    if (!key) return undefined;
    const base = key.split("|")[0].toLowerCase().trim();
    if (offhand)
      return c.attacks.find(
        (a) =>
          a.name.toLowerCase().startsWith(base) &&
          a.notes.includes("Bonus Action"),
      );
    return c.attacks.find(
      (a) =>
        a.name.toLowerCase() === base ||
        a.name.toLowerCase().split(" (")[0] === base,
    );
  };

  const toggleCard = (id: string) =>
    setOpenCards((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const renderCard = (
    key: string | null | undefined,
    slotLabel: string,
    id: string,
    offhand = false,
  ) => {
    if (!key) {
      return (
        <div key={id} className="wcard empty">
          <div className="wslot">{slotLabel}</div>
          <div
            className="wname"
            style={{
              color: "var(--text-faint)",
              fontStyle: "italic",
              fontSize: 13,
            }}
          >
            — empty —
          </div>
        </div>
      );
    }
    const isShield = key === "shield" || key.startsWith("shield|");
    const displayName = key
      .split("|")[0]
      .replace(/\b\w/g, (l) => l.toUpperCase());
    const item = resolveItem(key);
    const atk = !isShield ? findAtk(key, offhand) : undefined;
    const rarity =
      item?.rarity && !["none", "", "unknown", "varies"].includes(item.rarity)
        ? item.rarity
        : null;
    const isMagic = !!rarity && rarity !== "common";
    const hasAttune = !!(item as any)?.reqAttune;
    const props = (item?.property ?? [])
      .map((p) => propLabel(p))
      .filter((p) => p !== "Ammo");
    const allEntries = [
      ...(item?.entries ?? []),
      ...((item as any)?.additionalEntries ?? []),
    ];
    const hasLore = allEntries.length > 0;
    const descNode = hasLore ? renderEntries(allEntries as unknown[]) : null;
    const isOpen = openCards.has(id);
    const isPopped = popCard === id;
    const atkSign = atk
      ? typeof atk.bonus === "number"
        ? (atk.bonus >= 0 ? "+" : "") + atk.bonus
        : String(atk.bonus)
      : null;

    return (
      <div
        key={id}
        className={`wcard${isMagic ? " magic" : ""}${isOpen ? " open" : ""}`}
      >
        <div className="wcard-top">
          <div className="wcard-id">
            <div className="wslot">{slotLabel}</div>
            <div className="wname">
              {displayName}
              {rarity && (
                <span
                  className={`rdot${isMagic ? " magic" : ""}`}
                  style={
                    isMagic && RARITY_GLOW[rarity]
                      ? {
                          background: RARITY_GLOW[rarity],
                          boxShadow: `0 0 5px ${RARITY_GLOW[rarity]}88`,
                        }
                      : undefined
                  }
                  title={rarity}
                />
              )}
              {hasAttune && <span className="abadge">A</span>}
              {item && !isShield && (
                <ProfBadge
                  item={item}
                  weaponProfs={weaponProfs}
                  armorProfs={armorProfs}
                  size={11}
                />
              )}
            </div>
          </div>
          {hasLore && (
            <button
              className="winfo"
              onClick={(e) => {
                e.stopPropagation();
                loreMode === "inline"
                  ? toggleCard(id)
                  : setPopCard(isPopped ? null : id);
              }}
              title={loreMode === "inline" ? "Toggle description" : "Item info"}
            >
              {loreMode === "inline" ? (
                <svg
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 4l4 4 4-4" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 7v4M8 5.5v.01" />
                </svg>
              )}
            </button>
          )}
        </div>

        <div className="wstats">
          {isShield ? (
            <div className="wstat def">
              <span className="wsl">Armor Class</span>
              <span className="wsv">+2</span>
              <span className="wsub">while equipped</span>
            </div>
          ) : (
            <>
              {atkSign !== null && (
                <div className="wstat">
                  <span className="wsl">Atk</span>
                  <span className="wsv">{atkSign}</span>
                </div>
              )}
              {atk && (
                <div className="wstat">
                  <span className="wsl">Dmg</span>
                  <span className="wsv">{atk.dmg}</span>
                  {atk.type && (
                    <span className="wsub">{atk.type.toLowerCase()}</span>
                  )}
                </div>
              )}
              {atk?.crit != null && (
                <div className="wstat">
                  <span className="wsl">Crit</span>
                  <span className="wsv">{atk.crit}–20</span>
                  <span className="wsub">expanded</span>
                </div>
              )}
              <div className="wstat">
                <span className="wsl">Range</span>
                <span className="wsv">
                  {item?.range ? `${item.range} ft` : "Melee"}
                </span>
              </div>
            </>
          )}
        </div>

        {props.length > 0 && (
          <div className="wprops">
            {props.map((p) => (
              <span key={p} className="wtag">
                {p}
              </span>
            ))}
          </div>
        )}

        {loreMode === "inline" && hasLore && isOpen && (
          <div className="wdesc">{descNode}</div>
        )}

        {loreMode === "popover" && isPopped && (
          <div className="wpop" onClick={(e) => e.stopPropagation()}>
            <div className="wpop-name">{displayName}</div>
            {rarity && rarity !== "common" && RARITY_GLOW[rarity] && (
              <div
                className="wpop-rarity"
                style={{ color: RARITY_GLOW[rarity] }}
              >
                {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
                {hasAttune ? " · requires attunement" : ""}
              </div>
            )}
            {descNode && <div className="wpop-desc">{descNode}</div>}
          </div>
        )}
      </div>
    );
  };

  // ── WeaponSetsPanel return ──────────────────────────────────────────────────
  return (
    <div className="weapons-section">
      <div className="weapons-head">
        <span className="wsec-label">Weapon Sets</span>
        <div className="lore-seg">
          <button
            className={`lore-btn${loreMode === "inline" ? " sel" : ""}`}
            onClick={() => {
              setLoreMode("inline");
              localStorage.setItem("combat.loreMode", "inline");
            }}
          >
            Inline
          </button>
          <button
            className={`lore-btn${loreMode === "popover" ? " sel" : ""}`}
            onClick={() => {
              setLoreMode("popover");
              localStorage.setItem("combat.loreMode", "popover");
            }}
          >
            Popover
          </button>
        </div>
      </div>
      <div className="wgrid">
        {renderCard(eq.meleeSet?.mainhand, "MELEE · MAIN", "wmain")}
        {renderCard(eq.meleeSet?.offhand, "MELEE · OFF-HAND", "woff", true)}
        {renderCard(eq.rangedSet?.mainhand, "RANGED · MAIN", "wranged")}
        {(() => {
          const uAtk = c.attacks.find((a) => a.isUnarmed);
          if (!uAtk) return null;
          const atkSign =
            typeof uAtk.bonus === "number"
              ? (uAtk.bonus >= 0 ? "+" : "") + uAtk.bonus
              : String(uAtk.bonus);
          return (
            <div className="wcard wcard-unarmed">
              <div className="wcard-top">
                <div className="wcard-id">
                  <div className="wslot">NATURAL</div>
                  <div className="wname">{uAtk.name}</div>
                </div>
              </div>
              <div className="wstats">
                <div className="wstat">
                  <span className="wsl">Atk</span>
                  <span className="wsv">{atkSign}</span>
                </div>
                <div className="wstat">
                  <span className="wsl">Dmg</span>
                  <span className="wsv">{uAtk.dmg}</span>
                  <span className="wsub">{uAtk.type}</span>
                </div>
                <div className="wstat">
                  <span className="wsl">Range</span>
                  <span className="wsv">Melee</span>
                </div>
              </div>
              {uAtk.notes && (
                <div className="wprops">
                  {uAtk.notes.split(" · ").map((n) => (
                    <span key={n} className="wtag">
                      {n}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ── Pip components ───────────────────────────────────────────────────────────

function PoolPips({
  poolKey,
  current,
  max,
  onAdjust,
}: {
  poolKey: string;
  current: number;
  max: number;
  onAdjust: (n: number) => void;
}) {
  if (max > 12) {
    return (
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          color: current > 0 ? "var(--gold)" : "var(--text-faint)",
        }}
      >
        {current}/{max}
      </span>
    );
  }
  return (
    <span className="pool-pips">
      {Array.from({ length: max }).map((_, i) => (
        <button
          key={i}
          className={`ppip${i < current ? " on" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            const t = i + 1;
            onAdjust(t === current ? i : t);
          }}
          aria-label={`${poolKey} ${i + 1}`}
        />
      ))}
    </span>
  );
}

function HpPoolControl({
  current,
  max,
  onAdjust,
}: {
  current: number;
  max: number;
  onAdjust: (n: number) => void;
}) {
  const [amount, setAmount] = React.useState("1");
  const spend = (hp: number) => {
    onAdjust(Math.max(0, current - hp));
    setAmount("1");
  };
  const pct = max > 0 ? current / max : 0;
  const poolColor = pct > 0.5 ? "var(--vitality)" : pct > 0.2 ? "var(--gold)" : "var(--danger)";
  const canUse = current > 0;
  const n = parseInt(amount, 10);
  const validAmount = !isNaN(n) && n > 0 && n <= current;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "nowrap" }}>
      <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: poolColor, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
        {current}<span style={{ color: "var(--text-faint)", margin: "0 1px" }}>/</span>{max}
      </span>
      <input
        type="number"
        min={1}
        max={current}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 26,
          fontFamily: "var(--mono)",
          fontSize: 8.5,
          background: "var(--card)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)",
          borderRadius: 2,
          padding: "1px 2px",
          textAlign: "center",
          appearance: "textfield",
        } as React.CSSProperties}
      />
      <button
        className={`cost-badge lim${!validAmount ? " off" : ""}`}
        style={{ background: "none", cursor: validAmount ? "pointer" : "default" }}
        onClick={(e) => { e.stopPropagation(); if (validAmount) spend(n); }}
      >
        use
      </button>
      <button
        className={`cost-badge${current < 5 ? " off" : ""}`}
        style={{ background: "none", cursor: canUse && current >= 5 ? "pointer" : "default", fontSize: 7.5 }}
        title="Cure disease or poison (costs 5 HP)"
        onClick={(e) => { e.stopPropagation(); if (current >= 5) spend(5); }}
      >
        cure
      </button>
    </span>
  );
}

function ChargePips({
  current,
  max,
  onAdjust,
}: {
  current: number;
  max: number;
  onAdjust: (n: number) => void;
}) {
  if (max > 12) {
    return (
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button
          className="ppip lim on"
          style={{ fontSize: 9, padding: "0 4px", width: "auto", minWidth: 16 }}
          onClick={(e) => { e.stopPropagation(); onAdjust(Math.max(0, current - 1)); }}
          aria-label="decrease"
        >−</button>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: current > 0 ? "var(--gold)" : "var(--text-faint)" }}>
          {current}/{max}
        </span>
        <button
          className="ppip lim"
          style={{ fontSize: 9, padding: "0 4px", width: "auto", minWidth: 16 }}
          onClick={(e) => { e.stopPropagation(); onAdjust(Math.min(max, current + 1)); }}
          aria-label="increase"
        >+</button>
      </span>
    );
  }
  return (
    <span className="pool-pips">
      {Array.from({ length: max }).map((_, i) => (
        <button
          key={i}
          className={`ppip lim${i < current ? " on" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            const t = i + 1;
            onAdjust(t === current ? i : t);
          }}
        />
      ))}
    </span>
  );
}

// ── Combat Tab ────────────────────────────────────────────────────────────────

const POOL_BY_CLASS: Record<string, CombatPoolKey> = {
  Monk: "ki",
  Sorcerer: "sp",
  Bard: "bardic",
  Barbarian: "rages",
  Fighter: "sup",
};
const STORED_POOL_TO_KEY: Partial<Record<string, CombatPoolKey>> = {
  kiPoints: "ki",
  sorceryPoints: "sp",
  superiorityDice: "sup",
};

export function CombatTab5e({
  c,
  stored,
  setStored,
}: {
  c: ComputedChar;
  stored: StoredChar;
  setStored: React.Dispatch<React.SetStateAction<StoredChar>>;
}) {
  const [filter, setFilter] = React.useState("all");
  const [openRows, setOpenRows] = React.useState<Set<string>>(new Set());
  const [loreMode, setLoreMode] = React.useState<"inline" | "popover">(
    () =>
      (localStorage.getItem("combat.loreMode") as "inline" | "popover") ??
      "inline",
  );

  const toggleRow = (id: string) =>
    setOpenRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const isStarred = (name: string) =>
    (stored.starredSpells ?? []).includes(name.toLowerCase());
  const toggleStar = (name: string) => {
    const key = name.toLowerCase();
    setStored((s) => {
      const list = s.starredSpells ?? [];
      return {
        ...s,
        starredSpells: list.includes(key)
          ? list.filter((x) => x !== key)
          : [...list, key],
      };
    });
  };

  const adjustPool = (poolKey: CombatPoolKey, newVal: number) => {
    setStored((s) => {
      const r = { ...s.resources };
      switch (poolKey) {
        case "ki":
          r.kiPoints = Math.max(
            0,
            Math.min(c.resources.kiPoints?.max ?? 0, newVal),
          );
          break;
        case "sp":
          r.sorceryPoints = Math.max(
            0,
            Math.min(c.resources.sorceryPoints?.max ?? 0, newVal),
          );
          break;
        case "bardic":
          r.bardicInspiration = {
            current: Math.max(
              0,
              Math.min(c.resources.bardicInspiration?.max ?? 0, newVal),
            ),
          };
          break;
        case "rages":
          r.rages = Math.max(0, Math.min(c.resources.rages?.max ?? 0, newVal));
          break;
        case "sup": {
          const supMax =
            c.actionsList.find((a) => a.id === "superiority-dice")?.max ?? 0;
          r.actionUses = {
            ...(r.actionUses ?? {}),
            "superiority-dice": Math.max(0, Math.min(supMax, newVal)),
          };
          break;
        }
      }
      return { ...s, resources: r };
    });
  };

  const adjustCharge = (chargeId: string, newVal: number) => {
    setStored((s) => ({
      ...s,
      resources: {
        ...s.resources,
        actionUses: { ...(s.resources.actionUses ?? {}), [chargeId]: newVal },
      },
    }));
  };

  const getPoolData = (poolKey: CombatPoolKey): CombatPoolData | null => {
    switch (poolKey) {
      case "ki": {
        const p = c.resources.kiPoints;
        return p
          ? { name: "Ki Points", resetOn: "SR", current: p.current, max: p.max }
          : null;
      }
      case "sp": {
        const p = c.resources.sorceryPoints;
        return p
          ? {
              name: "Sorcery Points",
              resetOn: "LR",
              current: p.current,
              max: p.max,
            }
          : null;
      }
      case "bardic": {
        const p = c.resources.bardicInspiration;
        return p
          ? {
              name: "Bardic Insp.",
              die: p.die,
              resetOn: "LR",
              current: p.current,
              max: p.max,
            }
          : null;
      }
      case "rages": {
        const p = c.resources.rages;
        return p
          ? { name: "Rages", resetOn: "LR", current: p.current, max: p.max }
          : null;
      }
      case "sup": {
        const sup = c.actionsList.find((a) => a.id === "superiority-dice");
        return sup
          ? {
              name: "Superiority Dice",
              resetOn: "SR",
              current: sup.current,
              max: sup.max,
            }
          : null;
      }
    }
  };

  const groups: LedgerGroup[] = React.useMemo(() => {
    const classOrder = c.classes.map((cl) => cl.name);
    const map = new Map<string, LedgerGroup>();
    const getGroup = (cls: string): LedgerGroup => {
      if (!map.has(cls))
        map.set(cls, {
          srcClass: cls,
          color: COMBAT_CLASS_COLOR[cls] ?? "var(--text-muted)",
          poolKey: POOL_BY_CLASS[cls],
          entries: [],
        });
      return map.get(cls)!;
    };
    for (const a of c.actionsList) {
      if (a.id === "superiority-dice") continue;
      const cls = a.className ?? "Feat";
      const grp = getGroup(cls);
      grp.entries.push({
        id: `act-${a.id}`,
        name: a.name,
        srcClass: cls,
        color: grp.color,
        econ: inferCombatEcon(a.description),
        rest: a.resetOn === "short" ? "SR" : "LR",
        chargesCurrent: a.current,
        chargesMax: a.max,
        chargeId: a.id,
        hpPool: a.hpPool,
        text: a.description,
      });
    }
    for (const a of c.combatAbilities) {
      const cls = sourceClassGroup(a.source, c.classes);
      const grp = getGroup(cls);
      const pKey = a.pool ? STORED_POOL_TO_KEY[a.pool] : undefined;
      const econ: EconKey =
        (a.actionType as EconKey | undefined) ?? inferCombatEcon(a.desc);
      grp.entries.push({
        id: `ab-${a.name.toLowerCase().replace(/\s+/g, "-")}`,
        name: a.name,
        srcClass: cls,
        color: grp.color,
        econ,
        rest: pKey === "ki" || pKey === "sup" ? "SR" : pKey ? "LR" : "—",
        poolKey: pKey,
        costLabel: a.cost,
        costAmount: a.costAmount,
        text: a.desc,
      });
    }
    // Add pool-only groups for classes with a pool resource but no action entries
    for (const cls of classOrder) {
      const pk = POOL_BY_CLASS[cls];
      if (!pk || map.has(cls)) continue;
      const hasPool =
        pk === "ki"
          ? !!c.resources.kiPoints
          : pk === "sp"
            ? !!c.resources.sorceryPoints
            : pk === "bardic"
              ? !!c.resources.bardicInspiration
              : pk === "rages"
                ? !!c.resources.rages
                : pk === "sup"
                  ? !!c.actionsList.find((a) => a.id === "superiority-dice")
                  : false;
      if (hasPool)
        map.set(cls, {
          srcClass: cls,
          color: COMBAT_CLASS_COLOR[cls] ?? "var(--text-muted)",
          poolKey: pk,
          entries: [],
        });
    }
    const ordered: LedgerGroup[] = [];
    for (const cls of classOrder) {
      if (map.has(cls)) ordered.push(map.get(cls)!);
    }
    for (const [cls, grp] of map) {
      if (!classOrder.includes(cls)) ordered.push(grp);
    }
    return ordered;
  }, [c.actionsList, c.combatAbilities, c.classes, c.resources]);

  const FILTERS = [
    ["all", "All"],
    ["action", "Action"],
    ["bonus", "Bonus"],
    ["reaction", "Reaction"],
    ["limited", "Limited"],
    ["starred", "Starred"],
  ] as const;
  const matchFilter = (e: LedgerEntry) => {
    if (filter === "all") return true;
    if (filter === "starred") return isStarred(e.name);
    if (filter === "limited") return e.chargesMax !== undefined;
    return e.econ === filter;
  };

  const isArmorer = stored.classes.some(
    (cls) => cls.name === "Artificer" && cls.subclass === "Armorer",
  );

  return (
    <div className="combat-container">
      {isArmorer && (
        <div className="armorer-model-wrap">
          <span className="armorer-model-label">ARMOR MODEL</span>
          <div className="armorer-model-toggle">
            {(["guardian", "infiltrator", "dreadnaught"] as const).map(
              (model) => (
                <button
                  key={model}
                  className={`armorer-model-btn${stored.armorerModel === model ? " active" : ""}`}
                  onClick={() =>
                    setStored((s) => ({ ...s, armorerModel: model }))
                  }
                >
                  {model.charAt(0).toUpperCase() + model.slice(1)}
                </button>
              ),
            )}
          </div>
          <span className="armorer-model-hint">
            {stored.armorerModel === "guardian"
              ? "Thunder Pulse"
              : stored.armorerModel === "infiltrator"
                ? "Lightning Launcher · +5ft speed"
                : stored.armorerModel === "dreadnaught"
                  ? "Force Demolisher · Reach · Push/Pull 10ft"
                  : "Select a model to enable armor weapons"}
          </span>
        </div>
      )}
      <WeaponSetsPanel c={c} loreMode={loreMode} setLoreMode={setLoreMode} />
      <div className="combat-abilities-body">
        <div className="ab-section-head">
          <span className="ab-sec-label">Actions &amp; Abilities</span>
          <span className="ab-rest-hint">
            SR · short rest &nbsp;&nbsp; LR · long rest
          </span>
        </div>
        <div className="ab-filters">
          {FILTERS.map(([k, l]) => (
            <button
              key={k}
              className={`ab-filter-btn${filter === k ? " sel" : ""}`}
              onClick={() => setFilter(k)}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="econ-legend">
          {(["action", "bonus", "free", "reaction"] as EconKey[]).map(
            (econ) => (
              <span
                key={econ}
                className="econ-leg-item"
                style={{ color: ECON_COLOR[econ] }}
              >
                <span className="econ-leg-g">{ECON_GLYPH[econ]}</span>
                <span className="econ-leg-l">{ECON_LABEL[econ]}</span>
              </span>
            ),
          )}
        </div>
        <div className="ledger-scroll">
          {groups.map((group) => {
            const visible = group.entries.filter(matchFilter);
            const pool = group.poolKey ? getPoolData(group.poolKey) : null;
            if (!visible.length && !pool) return null;
            const pk = group.poolKey;
            return (
              <div
                key={group.srcClass}
                className="lgroup"
                style={{ "--c": group.color } as React.CSSProperties}
              >
                <div className="lgroup-head">
                  <span className="lgroup-title">
                    <span className="lgroup-bar" />
                    {group.srcClass}
                  </span>
                  <span className="lgroup-rule" />
                  {pool && pk && (
                    <span className="poolchip">
                      <span className="poolchip-name">
                        {pool.name}
                        {pool.die ? ` · ${pool.die}` : ""}
                      </span>
                      <span className="poolchip-ct">
                        <b>{pool.current}</b>/{pool.max}
                      </span>
                      <PoolPips
                        poolKey={pk}
                        current={pool.current}
                        max={pool.max}
                        onAdjust={(n) => adjustPool(pk, n)}
                      />
                    </span>
                  )}
                </div>
                {visible.map((entry) => {
                  const open = openRows.has(entry.id);
                  const starred = isStarred(entry.name);
                  const poolData = entry.poolKey
                    ? getPoolData(entry.poolKey)
                    : null;
                  const affordable =
                    poolData && entry.costAmount != null
                      ? poolData.current >= entry.costAmount
                      : true;
                  const casts =
                    poolData && entry.costAmount
                      ? Math.floor(poolData.current / entry.costAmount)
                      : null;
                  const hasCharges = entry.chargesMax !== undefined;
                  const chargeEmpty =
                    hasCharges && (entry.chargesCurrent ?? 0) === 0;
                  return (
                    <div key={entry.id} className="litem">
                      <div
                        className={`lrow${open ? " open" : ""}`}
                        style={
                          {
                            "--ec": ECON_COLOR[entry.econ],
                          } as React.CSSProperties
                        }
                        onClick={() => toggleRow(entry.id)}
                      >
                        <button
                          className={`lstar${starred ? " on" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStar(entry.name);
                          }}
                        >
                          {starred ? "★" : "☆"}
                        </button>
                        <span
                          className="lrow-glyph"
                          style={{ color: ECON_COLOR[entry.econ] }}
                        >
                          {ECON_GLYPH[entry.econ]}
                        </span>
                        <span className="lname">{entry.name}</span>
                        <span className="lcost-cell">
                          {hasCharges ? (
                            entry.chargeId && !entry.hpPool ? (
                              <button
                                className={`cost-badge lim${chargeEmpty ? " off" : ""}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!chargeEmpty)
                                    adjustCharge(
                                      entry.chargeId!,
                                      (entry.chargesCurrent ?? 0) - 1,
                                    );
                                }}
                              >
                                {entry.chargesCurrent}/{entry.chargesMax}
                              </button>
                            ) : !entry.hpPool ? (
                              <span
                                className={`cost-badge lim${chargeEmpty ? " off" : ""}`}
                              >
                                {entry.chargesCurrent}/{entry.chargesMax}
                              </span>
                            ) : null
                          ) : entry.costLabel ? (
                            entry.poolKey && entry.costAmount != null ? (
                              <button
                                className={`cost-badge${entry.poolKey === "sp" ? " sp" : ""}${!affordable ? " off" : ""}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (affordable)
                                    adjustPool(
                                      entry.poolKey!,
                                      poolData!.current - entry.costAmount!,
                                    );
                                }}
                              >
                                {entry.costLabel}
                              </button>
                            ) : (
                              <span
                                className={`cost-badge${entry.poolKey === "sp" ? " sp" : ""}${!affordable ? " off" : ""}`}
                              >
                                {entry.costLabel}
                              </span>
                            )
                          ) : null}
                        </span>
                        <span className="lpip-cell">
                          {hasCharges && entry.chargeId ? (
                            entry.hpPool ? (
                              <HpPoolControl
                                current={entry.chargesCurrent ?? 0}
                                max={entry.chargesMax!}
                                onAdjust={(n) => adjustCharge(entry.chargeId!, n)}
                              />
                            ) : (
                            <ChargePips
                              current={entry.chargesCurrent ?? 0}
                              max={entry.chargesMax!}
                              onAdjust={(n) => adjustCharge(entry.chargeId!, n)}
                            />
                            )
                          ) : casts !== null ? (
                            <span
                              className="lavail"
                              style={
                                casts === 0
                                  ? { color: "var(--danger)" }
                                  : undefined
                              }
                            >
                              ×{casts}
                            </span>
                          ) : entry.econ === "passive" ? (
                            <span className="passmark">passive</span>
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
                            <span
                              className="econ-badge"
                              style={{ color: ECON_COLOR[entry.econ] }}
                            >
                              <span className="econ-badge-g">
                                {ECON_GLYPH[entry.econ]}
                              </span>
                              <span className="econ-badge-l">
                                {ECON_LABEL[entry.econ]}
                              </span>
                            </span>
                            {entry.costLabel && (
                              <span className="mi">
                                <span className="mk">Cost</span>
                                <span className="mv gold">
                                  {entry.costLabel}
                                </span>
                              </span>
                            )}
                            <span className="mi">
                              <span className="mk">Recharge</span>
                              <span className="mv">
                                {entry.rest === "SR"
                                  ? "Short Rest"
                                  : entry.rest === "LR"
                                    ? "Long Rest"
                                    : "Always"}
                              </span>
                            </span>
                          </div>
                          <div className="ldtext">{entry.text}</div>
                          {entry.name === "Twinned Spell" &&
                            (() => {
                              const spPool = getPoolData("sp");
                              const maxLevel = c.spellcasting.slots.filter(
                                (sl) => sl.max > 0,
                              ).length;
                              return (
                                <div className="twin-costs">
                                  {Array.from(
                                    { length: maxLevel + 1 },
                                    (_, i) => {
                                      const cost = i + 1;
                                      const canAfford =
                                        (spPool?.current ?? 0) >= cost;
                                      return (
                                        <button
                                          key={i}
                                          className={`cost-badge sp${!canAfford ? " off" : ""}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (canAfford && spPool)
                                              adjustPool(
                                                "sp",
                                                spPool.current - cost,
                                              );
                                          }}
                                        >
                                          SP {cost} (
                                          {i === 0 ? "Cantrip" : `Lvl ${i}`})
                                        </button>
                                      );
                                    },
                                  )}
                                </div>
                              );
                            })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {groups.every(
            (g) =>
              !g.entries.filter(matchFilter).length &&
              !(g.poolKey && getPoolData(g.poolKey)),
          ) && (
            <div className="ledger-empty">No abilities match this filter.</div>
          )}
        </div>
      </div>
    </div>
  );
}
