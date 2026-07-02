import React from "react";
import { createPortal } from "react-dom";
import { Spinner, Icon, ProfBadge } from "../shared/primitives";
import { loadItems } from "../core/data-registry";
import { renderEntries } from "../core/tag-renderer";
import { resolveItem as resolveItemFn } from "../core/item-resolve";
import { REPLICATE_PLANS } from "../core/data-5e";
import SOURCE_PUBS from "../core/source-publications.json";
import type {
  ComputedChar,
  StoredChar,
  RegistryItem,
  CustomItemPayload,
  ActiveInfusion,
} from "../core/types";

// ── Inventory helpers ─────────────────────────────────────────────────────────

const TYPE_CATS = ["all", "weapon", "armor", "tool", "gear", "magic"] as const;
type TypeCat = (typeof TYPE_CATS)[number];

export const RARITY_COLOR: Record<string, string> = {
  common: "var(--text-muted)",
  uncommon: "#1eff00",
  rare: "#0070dd",
  "very rare": "#a335ee",
  legendary: "#ff8000",
  artifact: "#e6cc80",
  varies: "var(--gold)",
  "unknown (magic)": "var(--text-muted)",
};

function itemTypeLabel(item: RegistryItem): string {
  const t = (item.type ?? "").replace(/\|.*/, "");
  const MAP: Record<string, string> = {
    M: "Melee",
    R: "Ranged",
    HA: "Heavy Armor",
    MA: "Med. Armor",
    LA: "Light Armor",
    S: "Shield",
    AT: "Tools",
    INS: "Instrument",
    SCF: "Focus",
    GS: "Gaming Set",
    G: "Gear",
    A: "Ammo",
    FD: "Food",
    MNT: "Mount",
    VEH: "Vehicle",
    SHP: "Ship",
    TG: "Trade Good",
    P: "Potion",
    SC: "Scroll",
    RD: "Rod",
    WD: "Wand",
    ST: "Staff",
    RG: "Ring",
    W: "Wondrous",
    OTH: "Other",
    AIR: "Air Vehicle",
    EXP: "Explosive",
    AF: "Firearm Ammo",
  };
  return MAP[t] ?? (item.wondrous ? "Wondrous" : "Item");
}

function itemCategory(item: RegistryItem): TypeCat {
  const t = (item.type ?? "").replace(/\|.*/, "");
  const isMagic =
    (item.rarity && !["none", "", "unknown"].includes(item.rarity)) ||
    item.wondrous;
  if (item.weapon || ["M", "R"].includes(t))
    return isMagic ? "magic" : "weapon";
  if (item.armor || ["HA", "MA", "LA", "S"].includes(t))
    return isMagic ? "magic" : "armor";
  if (["AT", "INS", "SCF", "GS"].includes(t)) return "tool";
  if (["G", "A", "FD", "MNT", "VEH", "SHP", "TG"].includes(t)) return "gear";
  if (isMagic) return "magic";
  return "gear";
}

function itemKey(item: RegistryItem): string {
  return `${item.name.toLowerCase()}|${item.source.toLowerCase()}`;
}

// ── Source deduplication for AddItemModal ─────────────────────────────────────

const SOURCE_PRIORITY_SET = new Set(["XPHB", "XDMG"]);

// 5etools short code → publication name matching source-publications.json
const SOURCE_CODE_PUB_NAME: Record<string, string> = {
  PHB:       "Player's Handbook (2014)",
  XPHB:      "Player's Handbook (2024)",
  DMG:       "Dungeon Master's Guide (2014)",
  XDMG:      "Dungeon Master's Guide (2024)",
  MM:        "Monster Manual (2014)",
  XMM:       "Monster Manual (2025)",
  XGE:       "Xanathar's Guide to Everything",
  TCE:       "Tasha's Cauldron of Everything",
  MPMM:      "Mordenkainen Presents: Monsters of the Multiverse",
  MTF:       "Mordenkainen's Tome of Foes",
  VGM:       "Volo's Guide to Monsters",
  SCAG:      "Sword Coast Adventurer's Guide",
  ERLW:      "Eberron: Rising from the Last War",
  EFA:       "Eberron: Forge of the Artificer",
  GGR:       "Guildmasters' Guide to Ravnica",
  MOT:       "Mythic Odysseys of Theros",
  EGW:       "Explorer's Guide to Wildemount",
  FTD:       "Fizban's Treasury of Dragons",
  VRGR:      "Van Richten's Guide to Ravenloft",
  SCC:       "Strixhaven: A Curriculum of Chaos",
  WBtW:      "The Wild Beyond the Witchlight",
  BGG:       "Bigby Presents: Glory of the Giants",
  BMT:       "The Book of Many Things",
  PaBTSO:    "Phandelver and Below: The Shattered Obelisk",
  CRCotN:    "Critical Role: Call of the Netherdeep",
  JttRC:     "Journeys through the Radiant Citadel",
  VEoR:      "Vecna: Eve of Ruin",
  QftIS:     "Quests from the Infinite Staircase Quests from the Infinite Staircase 1–13",
  BGDIA:     "Baldur's Gate: Descent Into Avernus",
  WDH:       "Waterdeep: Dragon Heist",
  WDMM:      "Waterdeep: Dungeon of the Mad Mage",
  ToA:       "Tomb of Annihilation",
  IDRotF:    "Icewind Dale: Rime of the Frostmaiden",
  SKT:       "Storm King's Thunder",
  OotA:      "Out of the Abyss",
  PotA:      "Princes of the Apocalypse",
  KftGV:     "Keys from the Golden Vault",
  DSotDQ:    "Dragonlance: Shadow of the Dragon Queen",
  CoS:       "Curse of Strahd",
  HotDQ:     "Hoard of the Dragon Queen",
  RoT:       "Rise of Tiamat",
  LMoP:      "Lost Mine of Phandelver",
  AI:        "Acquisitions Incorporated",
  AAG:       "Astral Adventurer's Guide",
  BAM:       "Boo's Astral Menagerie",
  LoX:       "Light of Xaryxis",
  CM:        "Candlekeep Mysteries",
  TftYP:     "Tales from the Yawning Portal: The Sunless Citadel",
  GoS:       "Ghosts of Saltmarsh",
  CoA:       "Chains of Asmodeus",
  SatO:      "Sigil and the Outlands",
  IMR:       "Infernal Machine Rebuild",
  LLK:       "Lost Laboratory of Kwalish",
  DitLCoT:   "Dungeons of Drakkenheim",
  NF:        "Netheril's Fall",
  FRAiF:     "Forgotten Realms: Adventures in Faerûn",
  FRHoF:     "Forgotten Realms: Heroes of Faerûn",
  OGA:       "One Grung Above",
  TTP:       "The Tortle Package",
  PSX:       "Plane Shift: Ixalan",
  LFL:       "Lorwyn: First Light",
  NRH_AT:    "NERDS Restoring Harmony: Adventure Together",
  NRH_TLT:   "NERDS Restoring Harmony: The Lost Tomb",
  RMBRE:     "Dungeons & Dragons vs. Rick and Morty: Basic Rules",
  HftT:      "Hunt for the Thessalhydra",
  AitFR_AVT: "Adventures in the Forgotten Realms: A Verdant Tomb",
  AitFR_THP: "Adventures in the Forgotten Realms: The Hidden Page",
};

// Build short-code → Date from source-publications.json at module load time
const _pubByName = new Map(SOURCE_PUBS.map((p) => [p.Name, new Date(p.Data)]));
const SOURCE_DATE_MAP: Map<string, Date> = new Map(
  Object.entries(SOURCE_CODE_PUB_NAME).flatMap(([code, name]) => {
    const d = _pubByName.get(name);
    return d ? [[code, d]] : [];
  }),
);

type DeduplicatedItem = RegistryItem & { allSources: string[] };

function dedupeItemsByName(items: RegistryItem[]): DeduplicatedItem[] {
  const groups = new Map<string, RegistryItem[]>();
  for (const item of items) {
    const key = item.name.toLowerCase();
    const g = groups.get(key);
    if (g) g.push(item);
    else groups.set(key, [item]);
  }
  return Array.from(groups.values()).map((group) => {
    if (group.length === 1)
      return { ...group[0], allSources: [group[0].source] };
    const sorted = [...group].sort((a, b) => {
      const ap = SOURCE_PRIORITY_SET.has(a.source) ? 0 : 1;
      const bp = SOURCE_PRIORITY_SET.has(b.source) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      const ad = SOURCE_DATE_MAP.get(a.source);
      const bd = SOURCE_DATE_MAP.get(b.source);
      if (ad && bd) return bd.getTime() - ad.getTime();
      if (ad) return -1;
      if (bd) return 1;
      return a.source.localeCompare(b.source);
    });
    return { ...sorted[0], allSources: sorted.map((i) => i.source) };
  });
}

// ── Add Item Modal ────────────────────────────────────────────────────────────

interface AddItemModalProps {
  items: RegistryItem[];
  currency: { pp: number; gp: number; sp: number; cp: number };
  onAdd: (item: RegistryItem, mode: "loot" | "buy") => void;
  onAddCustom: (name: string) => void;
  onClose: () => void;
}

function AddItemModal({
  items,
  currency,
  onAdd,
  onAddCustom,
  onClose,
}: AddItemModalProps) {
  const [query, setQuery] = React.useState("");
  const [sourceFilt, setSourceFilt] = React.useState("");
  const [catFilt, setCatFilt] = React.useState<TypeCat>("all");
  const [customName, setCustomName] = React.useState("");
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<{
    name: string;
    mode: "loot" | "buy" | "custom";
    cost: number;
  } | null>(null);
  const toastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (
    name: string,
    mode: "loot" | "buy" | "custom",
    cost = 0,
  ) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ name, mode, cost });
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const sources = React.useMemo(() => {
    const s = new Set(items.map((i) => i.source));
    return ["", ...Array.from(s).sort()];
  }, [items]);

  const filtered = React.useMemo((): DeduplicatedItem[] => {
    const q = query.toLowerCase().trim();
    const base = items.filter((item) => {
      if (q && !item.name.toLowerCase().includes(q)) return false;
      if (sourceFilt && item.source !== sourceFilt) return false;
      if (catFilt !== "all" && itemCategory(item) !== catFilt) return false;
      return true;
    });
    // When source filter active, user wants per-source view — skip dedup
    const deduped = sourceFilt
      ? base.map((i) => ({ ...i, allSources: [i.source] }))
      : dedupeItemsByName(base);
    return deduped.slice(0, 80);
  }, [items, query, sourceFilt, catFilt]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (selectedKey) {
        setSelectedKey(null);
        return;
      }
      onClose();
    }
  };

  // Clear selection when filters change
  React.useEffect(() => {
    setSelectedKey(null);
  }, [query, sourceFilt, catFilt]);

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="modal-box" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="modal-head">
          <span
            className="ttl"
            style={{ fontFamily: "var(--serif)", fontSize: 16 }}
          >
            Add Item
          </span>
          <div
            className="modal-currency"
            style={{ marginLeft: "auto", marginRight: 12 }}
          >
            {currency.pp > 0 && (
              <span className="modal-coin modal-coin--pp">
                <span className="modal-coin-val">{currency.pp}</span>
                <span className="modal-coin-lbl">PP</span>
              </span>
            )}
            <span className="modal-coin modal-coin--gp">
              <span className="modal-coin-val">{currency.gp}</span>
              <span className="modal-coin-lbl">GP</span>
            </span>
            {currency.sp > 0 && (
              <span className="modal-coin modal-coin--sp">
                <span className="modal-coin-val">{currency.sp}</span>
                <span className="modal-coin-lbl">SP</span>
              </span>
            )}
            {currency.cp > 0 && (
              <span className="modal-coin modal-coin--cp">
                <span className="modal-coin-val">{currency.cp}</span>
                <span className="modal-coin-lbl">CP</span>
              </span>
            )}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {/* Search + Source filter */}
        <div className="modal-filters">
          <input
            className="modal-search"
            placeholder="Search items…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <select
            className="modal-select"
            value={sourceFilt}
            onChange={(e) => setSourceFilt(e.target.value)}
          >
            <option value="">All Sources</option>
            {sources.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Category buttons */}
        <div className="modal-cat-row">
          {TYPE_CATS.map((cat) => (
            <button
              key={cat}
              className={`modal-cat${catFilt === cat ? " active" : ""}`}
              onClick={() => setCatFilt(cat)}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        {/* Results list */}
        <div className="modal-list">
          {filtered.length === 0 ? (
            <div className="modal-empty">
              No items match — try a different filter
            </div>
          ) : (
            <>
              {filtered.map((item) => {
                const rowKey = `${item.name}|${item.source}`;
                const isSelected = selectedKey === rowKey;
                const itemGp = item.value != null ? item.value / 100 : 0;
                const canAfford = totalCoinCp(currency) / 100 >= itemGp;

                return (
                  <div key={rowKey}>
                    <div
                      className="modal-item-row"
                      onClick={() => setSelectedKey(isSelected ? null : rowKey)}
                      style={{
                        background: isSelected ? "var(--card-2)" : undefined,
                        borderLeft: isSelected
                          ? "2px solid var(--gold)"
                          : "2px solid transparent",
                        cursor: "pointer",
                      }}
                    >
                      <div className="modal-item-name">{item.name}</div>
                      <div className="modal-item-meta">
                        <span className="modal-type-badge">
                          {itemTypeLabel(item)}
                        </span>
                        {item.rarity &&
                          !["none", "", "unknown"].includes(item.rarity) && (
                            <span
                              style={{
                                color:
                                  RARITY_COLOR[item.rarity] ??
                                  "var(--text-muted)",
                                fontSize: 10,
                                fontFamily: "var(--mono)",
                              }}
                            >
                              {item.rarity}
                            </span>
                          )}
                        {item.dmg1 && (
                          <span
                            style={{
                              fontFamily: "var(--mono)",
                              fontSize: 10,
                              color: "var(--text-dim)",
                            }}
                          >
                            {item.dmg1} {item.dmgType}
                          </span>
                        )}
                        {item.ac != null && (
                          <span
                            style={{
                              fontFamily: "var(--mono)",
                              fontSize: 10,
                              color: "var(--text-dim)",
                            }}
                          >
                            AC {item.ac}
                          </span>
                        )}
                        {item.weight != null && (
                          <span
                            style={{
                              fontFamily: "var(--mono)",
                              fontSize: 10,
                              color: "var(--text-faint)",
                            }}
                          >
                            {item.weight} lb
                          </span>
                        )}
                        {item.value != null ? (
                          <span
                            style={{
                              fontFamily: "var(--mono)",
                              fontSize: 10,
                              color: "var(--gold-dim)",
                              marginLeft: "auto",
                            }}
                          >
                            {formatGp(item.value)}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontFamily: "var(--mono)",
                              fontSize: 9,
                              color: "var(--text-faint)",
                              marginLeft: "auto",
                            }}
                          >
                            {item.allSources.join("/")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action strip — only on selected row */}
                    {isSelected && (
                      <div
                        style={{
                          borderLeft: "2px solid var(--gold)",
                          borderBottom: "1px solid var(--border)",
                          display: "flex",
                          flexDirection: "column",
                        }}
                      >
                        {/* Stat block / description */}
                        <ItemStatBlock
                          item={item}
                          style={{
                            padding: "8px 12px 10px",
                            background: "var(--card-2)",
                            borderTop: "none",
                          }}
                        />
                        {/* Buy / Loot buttons */}
                        <div
                          style={{
                            padding: "6px 12px 8px",
                            background: "var(--card)",
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                            borderTop: "1px solid var(--border-soft)",
                          }}
                        >
                          <button
                            onClick={() => {
                              onAdd(item, "loot");
                              showToast(item.name, "loot");
                            }}
                            style={{
                              padding: "5px 14px",
                              borderRadius: 4,
                              cursor: "pointer",
                              fontFamily: "var(--mono)",
                              fontSize: 11,
                              letterSpacing: "0.08em",
                              background: "var(--card-2)",
                              border: "1px solid var(--vitality)",
                              color: "var(--vitality)",
                            }}
                          >
                            + LOOT
                          </button>
                          {itemGp > 0 && (
                            <button
                              onClick={() => {
                                if (canAfford) {
                                  onAdd(item, "buy");
                                  showToast(item.name, "buy", itemGp);
                                }
                              }}
                              disabled={!canAfford}
                              title={canAfford ? undefined : "Not enough gold"}
                              style={{
                                padding: "5px 14px",
                                borderRadius: 4,
                                cursor: canAfford ? "pointer" : "not-allowed",
                                fontFamily: "var(--mono)",
                                fontSize: 11,
                                letterSpacing: "0.08em",
                                background: canAfford
                                  ? "var(--gold-dim)"
                                  : "var(--card-2)",
                                border: `1px solid ${canAfford ? "var(--gold)" : "var(--border)"}`,
                                color: canAfford
                                  ? "var(--gold-bright)"
                                  : "var(--text-faint)",
                                opacity: canAfford ? 1 : 0.5,
                              }}
                            >
                              + BUY ({formatGp(item.value!)})
                            </button>
                          )}
                          <span
                            style={{
                              marginLeft: "auto",
                              fontFamily: "var(--mono)",
                              fontSize: 10,
                              color: "var(--text-faint)",
                            }}
                          >
                            {item.allSources.join("/")}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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

        {/* Custom item quick-add */}
        <div className="modal-custom-row">
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              color: "var(--text-faint)",
              whiteSpace: "nowrap",
            }}
          >
            Custom:
          </span>
          <input
            className="modal-search"
            style={{ flex: 1 }}
            placeholder="Item name…"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && customName.trim()) {
                onAddCustom(customName.trim());
                showToast(customName.trim(), "custom");
                setCustomName("");
              }
            }}
          />
          <button
            className="act"
            style={{ flexShrink: 0 }}
            onClick={() => {
              if (customName.trim()) {
                onAddCustom(customName.trim());
                showToast(customName.trim(), "custom");
                setCustomName("");
              }
            }}
            disabled={!customName.trim()}
          >
            + Loot
          </button>
        </div>

        {/* Confirmation toast */}
        {toast && (
          <div
            className={`modal-toast modal-toast--${toast.mode === "buy" ? "buy" : "loot"}`}
          >
            <span className="modal-toast-mark">
              {toast.mode === "buy" ? "◆" : "✦"}
            </span>
            <span className="modal-toast-name">{toast.name}</span>
            <span className="modal-toast-detail">
              {toast.mode === "buy"
                ? `bought · −${toast.cost} gp`
                : toast.mode === "custom"
                  ? "added to inventory"
                  : "looted"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Inventory ─────────────────────────────────────────────────────────────────

// ── Item stat helpers ─────────────────────────────────────────────────────────

function formatGp(cp: number | undefined): string {
  if (!cp) return "";
  if (cp >= 100) return `${cp / 100} gp`;
  if (cp >= 10) return `${cp / 10} sp`;
  return `${cp} cp`;
}

function totalCoinCp(c: {
  pp?: number;
  gp?: number;
  sp?: number;
  cp?: number;
}): number {
  return (
    (c.pp ?? 0) * 1000 + (c.gp ?? 0) * 100 + (c.sp ?? 0) * 10 + (c.cp ?? 0)
  );
}
function coinFromCp(total: number): {
  pp: number;
  gp: number;
  sp: number;
  cp: number;
} {
  const pp = Math.floor(total / 1000);
  total -= pp * 1000;
  const gp = Math.floor(total / 100);
  total -= gp * 100;
  const sp = Math.floor(total / 10);
  total -= sp * 10;
  return { pp, gp, sp, cp: total };
}

const PROP_LABELS: Record<string, string> = {
  A: "Ammo",
  F: "Finesse",
  H: "Heavy",
  L: "Light",
  LD: "Loading",
  R: "Reach",
  S: "Special",
  T: "Thrown",
  V: "Versatile",
  "2H": "Two-Handed",
  AF: "Auto",
  BF: "Burst",
  RLD: "Reload",
};
export function propLabel(code: string): string {
  return PROP_LABELS[code.split("|")[0]] ?? code.split("|")[0];
}

const DMG_TYPES: Record<string, string> = {
  B: "Bludgeoning",
  P: "Piercing",
  S: "Slashing",
  F: "Fire",
  C: "Cold",
  L: "Lightning",
  T: "Thunder",
  N: "Necrotic",
  R: "Radiant",
  A: "Acid",
  Po: "Poison",
  Ps: "Psychic",
};
export function dmgTypeLabel(code: string | undefined): string {
  if (!code) return "";
  return DMG_TYPES[code] ?? code;
}

function armorACFormula(item: RegistryItem): string {
  const t = (item.type ?? "").replace(/\|.*/, "");
  const base = item.ac ?? "?";
  if (t === "LA") return `${base} + DEX`;
  if (t === "MA") {
    const cap = item.dexterityMax;
    return cap != null ? `${base} + DEX (max ${cap})` : `${base} + DEX`;
  }
  return `${base}`;
}

export function itemShortStat(item: RegistryItem): string {
  const t = (item.type ?? "").replace(/\|.*/, "");
  if (item.weapon || ["M", "R"].includes(t)) {
    if (item.dmg1) return `${item.dmg1} ${dmgTypeLabel(item.dmgType)}`;
  }
  if (item.armor || ["HA", "MA", "LA"].includes(t))
    return `AC ${armorACFormula(item)}`;
  if (t === "S") return `+${item.ac ?? 2} AC`;
  if (item.rarity && !["none", "", "unknown"].includes(item.rarity)) {
    return item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1);
  }
  return "";
}

// ── Custom item create/edit/fork modal ─────────────────────────────────────────

type CustomItemKind = "weapon" | "armor" | "gear";
const RARITIES = [
  "none",
  "common",
  "uncommon",
  "rare",
  "very rare",
  "legendary",
  "artifact",
];
const WEAPON_PROP_CODES = ["F", "L", "H", "2H", "V", "R", "T", "A"];

function inferKind(initial?: CustomItemPayload): CustomItemKind {
  const t = (initial?.type ?? "").replace(/\|.*/, "");
  if (initial?.weapon || ["M", "R"].includes(t)) return "weapon";
  if (initial?.armor || ["LA", "MA", "HA", "S"].includes(t)) return "armor";
  return "gear";
}

interface CustomItemModalProps {
  mode: "create" | "edit" | "fork";
  initial?: CustomItemPayload;
  initialName?: string;
  onSave: (name: string, payload: CustomItemPayload) => void;
  onClose: () => void;
}

function CustomItemModal({
  mode,
  initial,
  initialName,
  onSave,
  onClose,
}: CustomItemModalProps) {
  const [name, setName] = React.useState(initialName ?? "");
  const [kind, setKind] = React.useState<CustomItemKind>(inferKind(initial));
  const [rarity, setRarity] = React.useState(initial?.rarity ?? "none");
  const [wondrous, setWondrous] = React.useState(!!initial?.wondrous);
  const [weight, setWeight] = React.useState(
    initial?.weight != null ? String(initial.weight) : "",
  );
  const [valueGp, setValueGp] = React.useState(
    initial?.value != null ? String(initial.value / 100) : "",
  );
  const [description, setDescription] = React.useState(
    (initial?.entries ?? [])
      .filter((e): e is string => typeof e === "string")
      .join("\n\n"),
  );

  const initType = (initial?.type ?? "").replace(/\|.*/, "");
  const [weaponCategory, setWeaponCategory] = React.useState(
    initial?.weaponCategory ?? "simple",
  );
  const [ranged, setRanged] = React.useState(initType === "R");
  const [dmg1, setDmg1] = React.useState(initial?.dmg1 ?? "");
  const [dmg2, setDmg2] = React.useState(initial?.dmg2 ?? "");
  const [dmgType, setDmgType] = React.useState(initial?.dmgType ?? "S");
  const [props, setProps] = React.useState<Set<string>>(
    new Set((initial?.property ?? []).map((p) => p.split("|")[0])),
  );
  const [range, setRange] = React.useState(initial?.range ?? "");
  const [bonusWeapon, setBonusWeapon] = React.useState(
    initial?.bonusWeapon ?? "",
  );
  const [bonusDice, setBonusDice] = React.useState(
    initial?.bonusDamage?.dice ?? "",
  );
  const [bonusDmgType, setBonusDmgType] = React.useState(
    initial?.bonusDamage?.type ?? "fire",
  );

  const [armorType, setArmorType] = React.useState<"LA" | "MA" | "HA" | "S">(
    (["LA", "MA", "HA", "S"].includes(initType) ? initType : "LA") as
      | "LA"
      | "MA"
      | "HA"
      | "S",
  );
  const [ac, setAc] = React.useState(
    initial?.ac != null ? String(initial.ac) : "",
  );
  const [dexMax, setDexMax] = React.useState(
    initial?.dexterityMax != null ? String(initial.dexterityMax) : "",
  );
  const [stealth, setStealth] = React.useState(!!initial?.stealth);
  const [strength, setStrength] = React.useState(initial?.strength ?? "");

  const toggleProp = (code: string) =>
    setProps((p) => {
      const next = new Set(p);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const canSave =
    name.trim().length > 0 &&
    (kind !== "weapon" || dmg1.trim().length > 0) &&
    (kind !== "armor" || ac.trim().length > 0);

  const handleSave = () => {
    const payload: CustomItemPayload = {
      type:
        kind === "weapon"
          ? ranged
            ? "R"
            : "M"
          : kind === "armor"
            ? armorType
            : "G",
      ...(rarity !== "none" && { rarity }),
      ...(wondrous && { wondrous: true }),
      ...(weight.trim() && { weight: Number(weight) }),
      ...(valueGp.trim() && { value: Math.round(Number(valueGp) * 100) }),
      ...(description.trim() && {
        entries: description
          .split(/\n\s*\n/)
          .map((s) => s.trim())
          .filter(Boolean),
      }),
      ...(kind === "weapon" && {
        weapon: true,
        weaponCategory,
        dmg1: dmg1.trim(),
        dmgType,
        property: Array.from(props),
        ...(props.has("V") && dmg2.trim() && { dmg2: dmg2.trim() }),
        ...(range.trim() && { range: range.trim() }),
        ...(bonusWeapon && { bonusWeapon }),
        ...(bonusDice.trim() && {
          bonusDamage: { dice: bonusDice.trim(), type: bonusDmgType },
        }),
      }),
      ...(kind === "armor" && {
        armor: true,
        ac: Number(ac),
        stealth,
        ...(armorType === "MA" &&
          dexMax.trim() && { dexterityMax: Number(dexMax) }),
        ...(strength.trim() && { strength: strength.trim() }),
      }),
    };
    onSave(name.trim(), payload);
  };

  const title =
    mode === "create"
      ? "Create Custom Item"
      : mode === "fork"
        ? "Fork to Custom Item"
        : "Edit Custom Item";

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-box"
        role="dialog"
        aria-modal="true"
        style={{ width: "min(520px, 100%)" }}
      >
        <div className="modal-head">
          <span
            className="ttl"
            style={{ fontFamily: "var(--serif)", fontSize: 16 }}
          >
            {title}
          </span>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="custom-item-form">
          <label className="cif-row">
            <span className="cif-label">Name</span>
            <input
              className="modal-search"
              style={{ flex: 1 }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={mode === "edit"}
              autoFocus
            />
          </label>

          <div className="cif-row">
            <span className="cif-label">Type</span>
            <div className="cif-toggles">
              {(["weapon", "armor", "gear"] as CustomItemKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`modal-cat${kind === k ? " active" : ""}`}
                  onClick={() => setKind(k)}
                >
                  {k === "weapon"
                    ? "Weapon"
                    : k === "armor"
                      ? "Armor"
                      : "Gear / Wondrous"}
                </button>
              ))}
            </div>
          </div>

          {kind === "weapon" && (
            <>
              <label className="cif-row">
                <span className="cif-label">Category</span>
                <select
                  className="modal-select"
                  value={weaponCategory}
                  onChange={(e) => setWeaponCategory(e.target.value)}
                >
                  <option value="simple">Simple</option>
                  <option value="martial">Martial</option>
                </select>
                <div className="cif-toggles">
                  <button
                    type="button"
                    className={`modal-cat${!ranged ? " active" : ""}`}
                    onClick={() => setRanged(false)}
                  >
                    Melee
                  </button>
                  <button
                    type="button"
                    className={`modal-cat${ranged ? " active" : ""}`}
                    onClick={() => setRanged(true)}
                  >
                    Ranged
                  </button>
                </div>
              </label>
              <label className="cif-row">
                <span className="cif-label">Damage</span>
                <input
                  className="modal-search"
                  placeholder="1d8"
                  style={{ maxWidth: 90 }}
                  value={dmg1}
                  onChange={(e) => setDmg1(e.target.value)}
                />
                <select
                  className="modal-select"
                  value={dmgType}
                  onChange={(e) => setDmgType(e.target.value)}
                >
                  {Object.entries(DMG_TYPES).map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {props.has("V") && (
                <label className="cif-row">
                  <span className="cif-label">Versatile dmg</span>
                  <input
                    className="modal-search"
                    placeholder="1d10"
                    style={{ maxWidth: 90 }}
                    value={dmg2}
                    onChange={(e) => setDmg2(e.target.value)}
                  />
                </label>
              )}
              <div className="cif-row">
                <span className="cif-label">Properties</span>
                <div className="cif-toggles">
                  {WEAPON_PROP_CODES.map((code) => (
                    <button
                      key={code}
                      type="button"
                      className={`modal-cat${props.has(code) ? " active" : ""}`}
                      onClick={() => toggleProp(code)}
                    >
                      {propLabel(code)}
                    </button>
                  ))}
                </div>
              </div>
              {(props.has("T") || props.has("A") || ranged) && (
                <label className="cif-row">
                  <span className="cif-label">Range (ft)</span>
                  <input
                    className="modal-search"
                    placeholder="20/60"
                    value={range}
                    onChange={(e) => setRange(e.target.value)}
                  />
                </label>
              )}
              <label className="cif-row">
                <span className="cif-label">Magic bonus</span>
                <select
                  className="modal-select"
                  value={bonusWeapon}
                  onChange={(e) => setBonusWeapon(e.target.value)}
                >
                  <option value="">None</option>
                  <option value="+1">+1</option>
                  <option value="+2">+2</option>
                  <option value="+3">+3</option>
                </select>
              </label>
              <label className="cif-row">
                <span className="cif-label">Bonus dmg on hit</span>
                <input
                  className="modal-search"
                  placeholder="1d4"
                  style={{ maxWidth: 90 }}
                  value={bonusDice}
                  onChange={(e) => setBonusDice(e.target.value)}
                />
                <select
                  className="modal-select"
                  value={bonusDmgType}
                  onChange={(e) => setBonusDmgType(e.target.value)}
                >
                  {Object.values(DMG_TYPES).map((label) => (
                    <option key={label} value={label.toLowerCase()}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          {kind === "armor" && (
            <>
              <label className="cif-row">
                <span className="cif-label">Armor type</span>
                <select
                  className="modal-select"
                  value={armorType}
                  onChange={(e) =>
                    setArmorType(e.target.value as "LA" | "MA" | "HA" | "S")
                  }
                >
                  <option value="LA">Light</option>
                  <option value="MA">Medium</option>
                  <option value="HA">Heavy</option>
                  <option value="S">Shield</option>
                </select>
              </label>
              <label className="cif-row">
                <span className="cif-label">AC</span>
                <input
                  className="modal-search"
                  type="number"
                  style={{ maxWidth: 70 }}
                  value={ac}
                  onChange={(e) => setAc(e.target.value)}
                />
              </label>
              {armorType === "MA" && (
                <label className="cif-row">
                  <span className="cif-label">Dex cap</span>
                  <input
                    className="modal-search"
                    type="number"
                    placeholder="2"
                    style={{ maxWidth: 70 }}
                    value={dexMax}
                    onChange={(e) => setDexMax(e.target.value)}
                  />
                </label>
              )}
              <label className="cif-row">
                <span className="cif-label">Stealth disadv.</span>
                <input
                  type="checkbox"
                  checked={stealth}
                  onChange={(e) => setStealth(e.target.checked)}
                />
              </label>
              <label className="cif-row">
                <span className="cif-label">Str req.</span>
                <input
                  className="modal-search"
                  placeholder="13"
                  style={{ maxWidth: 70 }}
                  value={strength}
                  onChange={(e) => setStrength(e.target.value)}
                />
              </label>
            </>
          )}

          <label className="cif-row">
            <span className="cif-label">Rarity</span>
            <select
              className="modal-select"
              value={rarity}
              onChange={(e) => setRarity(e.target.value)}
            >
              {RARITIES.map((r) => (
                <option key={r} value={r}>
                  {r === "none"
                    ? "None"
                    : r.replace(/\b\w/g, (l) => l.toUpperCase())}
                </option>
              ))}
            </select>
          </label>
          <label className="cif-row">
            <span className="cif-label">Wondrous</span>
            <input
              type="checkbox"
              checked={wondrous}
              onChange={(e) => setWondrous(e.target.checked)}
            />
          </label>
          <label className="cif-row">
            <span className="cif-label">Weight (lb)</span>
            <input
              className="modal-search"
              type="number"
              style={{ maxWidth: 80 }}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </label>
          <label className="cif-row">
            <span className="cif-label">Value (gp)</span>
            <input
              className="modal-search"
              type="number"
              style={{ maxWidth: 80 }}
              value={valueGp}
              onChange={(e) => setValueGp(e.target.value)}
            />
          </label>
          <label className="cif-row cif-row--col">
            <span className="cif-label">Description</span>
            <textarea
              className="modal-search"
              rows={3}
              style={{
                flex: 1,
                resize: "vertical",
                minHeight: 60,
                width: "100%",
              }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>

        <div className="cif-foot">
          <button className="act" onClick={onClose}>
            Cancel
          </button>
          <button
            className="act act--primary"
            disabled={!canSave}
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Item stat block (expandable in inventory) ─────────────────────────────────

function ItemStatBlock({
  item,
  style,
}: {
  item: RegistryItem;
  style?: React.CSSProperties;
}) {
  const t = (item.type ?? "").replace(/\|.*/, "");
  const isWeapon = item.weapon || ["M", "R"].includes(t);
  const isArmor = item.armor || ["HA", "MA", "LA"].includes(t);
  const isShield = t === "S";

  const props = (item.property ?? []).map((p) => {
    const base = p.split("|")[0];
    if (base === "V" && item.dmg2) return `Versatile (${item.dmg2})`;
    return propLabel(p);
  });

  const meta: string[] = [];
  if (item.weight != null) meta.push(`${item.weight} lb`);
  const gp = formatGp(item.value);
  if (gp) meta.push(gp);
  if (item.rarity && !["none", "", "unknown"].includes(item.rarity))
    meta.push(item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1));
  if (item.wondrous) meta.push("Wondrous");

  const allEntries = [
    ...(item.entries ?? []),
    ...(item.additionalEntries ?? []),
  ];
  const blurb = allEntries.length ? renderEntries(allEntries) : null;

  return (
    <div className="inv-stat-block" style={style}>
      {/* Weapon */}
      {isWeapon && (
        <div className="isb-row">
          <span className="isb-big">
            {item.dmg1 ?? "—"} {dmgTypeLabel(item.dmgType)}
          </span>
          {item.weaponCategory && (
            <span className="isb-tag">{item.weaponCategory}</span>
          )}
          {props.map((p, i) => (
            <span key={i} className="isb-tag">
              {p}
            </span>
          ))}
          {item.range && <span className="isb-tag">Range {item.range} ft</span>}
          {item.reload != null && (
            <span className="isb-tag">Reload {item.reload}</span>
          )}
          {item.mastery?.[0] && (
            <span className="isb-tag isb-gold">
              {item.mastery[0].split("|")[0]}
            </span>
          )}
        </div>
      )}
      {/* Armor / Shield */}
      {(isArmor || isShield) && (
        <div className="isb-row">
          <span className="isb-big">
            {isShield ? `+${item.ac ?? 2} AC` : `AC ${armorACFormula(item)}`}
          </span>
          {isArmor && item.stealth && (
            <span className="isb-tag isb-warn">Stealth ×</span>
          )}
          {isArmor && item.strength && (
            <span className="isb-tag">Str {item.strength}+</span>
          )}
        </div>
      )}
      {/* Meta */}
      {meta.length > 0 && <div className="isb-meta">{meta.join(" · ")}</div>}
      {/* Description blurb */}
      {blurb ? <div className="isb-blurb">{blurb}</div> : null}
    </div>
  );
}

// ── Drag-and-drop equipment slot system ──────────────────────────────────────

type SimpleSlotKey =
  | "armor"
  | "helmet"
  | "gloves"
  | "boots"
  | "cloak"
  | "ring1"
  | "ring2"
  | "amulet";
type WeaponSlotKey =
  | "meleeSet.mainhand"
  | "meleeSet.offhand"
  | "rangedSet.mainhand";
type SlotKey = SimpleSlotKey | WeaponSlotKey;

const BODY_SLOTS: { label: string; path: SimpleSlotKey }[] = [
  { label: "Armor", path: "armor" },
  { label: "Helmet", path: "helmet" },
  { label: "Gloves", path: "gloves" },
  { label: "Boots", path: "boots" },
  { label: "Cloak", path: "cloak" },
  { label: "Ring 1", path: "ring1" },
  { label: "Ring 2", path: "ring2" },
  { label: "Amulet", path: "amulet" },
];

function getSlotValue(
  eq: StoredChar["equipment"],
  path: SlotKey,
): string | null {
  if (path === "meleeSet.mainhand") return eq.meleeSet.mainhand;
  if (path === "meleeSet.offhand") return eq.meleeSet.offhand;
  if (path === "rangedSet.mainhand") return eq.rangedSet.mainhand;
  return (eq as Record<string, unknown>)[path] as string | null;
}

function getAllSlotValues(eq: StoredChar["equipment"]): (string | null)[] {
  return [
    eq.meleeSet.mainhand,
    eq.meleeSet.offhand,
    eq.rangedSet.mainhand,
    eq.armor,
    eq.helmet,
    eq.gloves,
    eq.boots,
    eq.cloak,
    eq.ring1,
    eq.ring2,
    eq.amulet,
  ];
}

function applySlotValue(
  eq: StoredChar["equipment"],
  path: SlotKey,
  val: string | null,
): StoredChar["equipment"] {
  if (path === "meleeSet.mainhand")
    return { ...eq, meleeSet: { ...eq.meleeSet, mainhand: val } };
  if (path === "meleeSet.offhand")
    return { ...eq, meleeSet: { ...eq.meleeSet, offhand: val } };
  if (path === "rangedSet.mainhand")
    return { ...eq, rangedSet: { ...eq.rangedSet, mainhand: val } };
  return { ...eq, [path]: val };
}

// When an equipped item is forked into a custom copy (new key), repoint any equipment
// slot that referenced the old key so the item stays equipped.
function relinkEquipmentSlots(
  eq: StoredChar["equipment"],
  oldKey: string,
  newKey: string,
): StoredChar["equipment"] {
  const ALL_SLOTS: SlotKey[] = [
    "meleeSet.mainhand",
    "meleeSet.offhand",
    "rangedSet.mainhand",
    "armor",
    "helmet",
    "gloves",
    "boots",
    "cloak",
    "ring1",
    "ring2",
    "amulet",
  ];
  return ALL_SLOTS.reduce(
    (acc, path) =>
      getSlotValue(acc, path) === oldKey
        ? applySlotValue(acc, path, newKey)
        : acc,
    eq,
  );
}

interface EquipSlotProps {
  label: string;
  path: SlotKey;
  value: string | null;
  reg?: RegistryItem;
  onDrop: (path: SlotKey, key: string) => void;
  onClear: (path: SlotKey) => void;
  touchOver?: boolean;
}

function EquipSlot({
  label,
  path,
  value,
  reg,
  onDrop,
  onClear,
  touchOver,
}: EquipSlotProps) {
  const [over, setOver] = React.useState(false);
  const name = value
    ? (reg?.name ??
      value.split("|")[0].replace(/\b\w/g, (l) => l.toUpperCase()))
    : null;

  return (
    <div
      data-equip-slot={path}
      className={[
        "slot-chip",
        name ? "filled" : "",
        over || touchOver ? "drop-ok" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() => {
        if (name) onClear(path);
      }}
      title={name ? `${name} — click to unequip` : label}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        if (!over) setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const key = e.dataTransfer.getData("text/plain");
        if (key) onDrop(path, key);
      }}
    >
      <div className="slot-chip-label">{label.toUpperCase()}</div>
      <div className="slot-chip-name">{name ?? "—"}</div>
      {name && (
        <button
          className="slot-chip-clear"
          onClick={(e) => {
            e.stopPropagation();
            onClear(path);
          }}
          title="Unequip"
        >
          ×
        </button>
      )}
    </div>
  );
}

interface EquipPanelProps {
  stored: StoredChar;
  setStored: React.Dispatch<React.SetStateAction<StoredChar>>;
  anyDragging?: boolean;
  items: RegistryItem[] | null;
  onDrop: (path: SlotKey, key: string) => void;
  touchOverSlot: string | null;
}

function EquipmentSlotsPanel({
  stored,
  setStored,
  items,
  onDrop,
  touchOverSlot,
}: EquipPanelProps) {
  const eq = stored.equipment;

  const handleClear = (path: SlotKey) => {
    setStored((s) => {
      const removedKey = getSlotValue(s.equipment, path);
      const newEq = applySlotValue(s.equipment, path, null);

      // Unequip the item if it's no longer in any slot
      const inventory =
        removedKey && !getAllSlotValues(newEq).includes(removedKey)
          ? s.equipment.inventory.map((i) =>
              i.key === removedKey ? { ...i, equipped: false } : i,
            )
          : s.equipment.inventory;

      return { ...s, equipment: { ...newEq, inventory } };
    });
  };

  const slot = (label: string, path: SlotKey) => {
    const val = getSlotValue(eq, path);
    const reg = val ? resolveItemFn(eq.inventory, items, val) : undefined;
    return (
      <EquipSlot
        key={path}
        label={label}
        path={path}
        value={val}
        reg={reg}
        onDrop={onDrop}
        onClear={handleClear}
        touchOver={touchOverSlot === path}
      />
    );
  };

  return (
    <div>
      <div className="slot-chip-grid">
        {BODY_SLOTS.map((s) => slot(s.label, s.path))}
      </div>
      <div className="inv-equip-sub">Weapon Sets</div>
      <div className="slot-chip-grid weapons">
        {slot("Melee · Main", "meleeSet.mainhand")}
        {slot("Melee · Off", "meleeSet.offhand")}
        {slot("Ranged · Main", "rangedSet.mainhand")}
      </div>
    </div>
  );
}

// ── Artificer: Active Infusions Panel ────────────────────────────────────────

const ARTI_COLOR = "#b8860b";

// Resolve a plan name to the real registry item it replicates. Plan names use a
// trailing "+N" (e.g. "Wand of the War Mage +1") while 5etools registry names put
// the bonus up front ("+1 Wand of the War Mage"), so exact match alone misses.
function matchReplicatedItem(
  items: RegistryItem[] | null,
  planName: string,
): RegistryItem | undefined {
  if (!items) return undefined;
  const lc = planName.toLowerCase();
  const exact = items.find((i) => i.name.toLowerCase() === lc);
  if (exact) return exact;
  // Relocate a trailing "+N" to the front, matching registry naming.
  const m = planName.match(/^(.*?)[\s,]+\+(\d+)$/);
  if (m) {
    const alt = `+${m[2]} ${m[1].trim()}`.toLowerCase();
    const hit = items.find((i) => i.name.toLowerCase() === alt);
    if (hit) return hit;
  }
  // Order-insensitive token match as a last resort.
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .sort()
      .join(" ");
  const target = norm(planName);
  return items.find((i) => norm(i.name) === target);
}

function artiItemName(
  key: string,
  inv?: StoredChar["equipment"]["inventory"],
): string {
  const custom = inv?.find((i) => i.key === key)?.custom as
    | { name?: string }
    | undefined;
  if (custom?.name) return custom.name;
  return key
    .split("|")[0]
    .replace(/-\d+$/, "")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

const ARTI_SELECT_STYLE: React.CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 12,
  background: "var(--card)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  borderRadius: 4,
  padding: "2px 4px",
};

// ── Artificer: Active Infusions Panel (EFA Replicate Magic Item) ──────────────

function ActiveInfusionsPanel({
  c,
  stored,
  setStored,
  items,
}: {
  c: ComputedChar;
  stored: StoredChar;
  setStored: React.Dispatch<React.SetStateAction<StoredChar>>;
  items: RegistryItem[] | null;
}) {
  if (c.infusedItemsMax === 0) return null;

  const active = stored.activeInfusions ?? [];
  const known = stored.featureChoices?.infusions ?? [];
  const inventory = stored.equipment.inventory;
  const artLevel =
    stored.classes.find((cl) => cl.name === "Artificer")?.level ?? 0;
  const isEFA = artLevel > 0;
  const slotsUsed = active.filter(
    (a) => a.infusionName && a.targetItemKey,
  ).length;
  const slotsTotal = active.length;

  // infusionName now stores the chosen plan name directly (creation or attachment).
  // EFA picks from the grouped plan list; non-EFA picks from learned infusion names.
  const knownOptions = isEFA ? [] : known;

  const addSlot = () => {
    if (slotsTotal >= c.infusedItemsMax) return;
    setStored((s) => ({
      ...s,
      activeInfusions: [
        ...(s.activeInfusions ?? []),
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          infusionName: "",
          targetItemKey: "",
        },
      ],
    }));
  };

  // Remove any standalone item a slot created (creation plans only; attachments
  // point targetItemKey at a pre-existing item that must NOT be deleted).
  const dropSlotReplicatedItem = (
    inv: typeof inventory,
    slot: ActiveInfusion | undefined,
  ) =>
    slot?.targetItemKey
      ? inv.filter((i) => !(i.key === slot.targetItemKey && i.replicated))
      : inv;

  const removeSlot = (id: string) =>
    setStored((s) => {
      const slot = (s.activeInfusions ?? []).find((x) => x.id === id);
      return {
        ...s,
        activeInfusions: (s.activeInfusions ?? []).filter((x) => x.id !== id),
        equipment: {
          ...s.equipment,
          inventory: dropSlotReplicatedItem(s.equipment.inventory, slot),
        },
      };
    });

  // patchSlot now only adjusts the attachment target item; plan changes go
  // through selectPlan (which handles item creation/cleanup).
  const patchSlot = (id: string, patch: Partial<ActiveInfusion>) =>
    setStored((s) => ({
      ...s,
      activeInfusions: (s.activeInfusions ?? []).map((x) =>
        x.id === id ? { ...x, ...patch } : x,
      ),
    }));

  // Choosing a plan branches on creation vs attachment:
  //  - creation (isAttachment:false) → spawn the real item into inventory
  //  - attachment (isAttachment:true) → no item spawned; player then selects
  //    which existing inventory item it is applied to (targetItemKey)
  const selectPlan = (slotId: string, planName: string) =>
    setStored((s) => {
      const slot = (s.activeInfusions ?? []).find((x) => x.id === slotId);
      // Tear down any item the previous plan created for this slot.
      let newInventory = dropSlotReplicatedItem(s.equipment.inventory, slot);
      const plan = REPLICATE_PLANS.find((p) => p.name === planName);
      const isAtt = plan?.isAttachment ?? false;
      let newKey = "";
      if (planName && !isAtt) {
        // Item creation → drop the actual item into inventory.
        newKey = `replicated-${Date.now()}`;
        const regMatch = matchReplicatedItem(items, planName);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { source: _src, ...regData } = regMatch ?? { source: "" };
        const custom = (
          regMatch
            ? { ...regData, name: regMatch.name }
            : {
                type: "wondrous item",
                rarity: "varies",
                weight: 0,
                value: 0,
                entries: [`Replicated magic item: ${planName}.`],
                name: planName,
              }
        ) as import("../core/types").CustomItemPayload;
        newInventory = [
          ...newInventory,
          {
            key: newKey,
            qty: 1,
            wt: regMatch?.weight ?? 0,
            equipped: false,
            notes: "",
            replicated: true,
            custom,
          },
        ];
      }
      // Attachment → targetItemKey stays "" until the player picks a host item.
      return {
        ...s,
        activeInfusions: (s.activeInfusions ?? []).map((x) =>
          x.id === slotId
            ? { ...x, infusionName: planName, targetItemKey: newKey }
            : x,
        ),
        equipment: { ...s.equipment, inventory: newInventory },
      };
    });

  return (
    <div
      style={{
        margin: "0 0 4px",
        padding: "8px 12px",
        background: "var(--card-2)",
        borderTop: `2px solid ${ARTI_COLOR}33`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontFamily: "var(--sans)",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: ARTI_COLOR,
          }}
        >
          Infuse / Replicate
        </span>
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            color:
              slotsTotal >= c.infusedItemsMax
                ? "var(--danger)"
                : "var(--text-muted)",
          }}
        >
          {slotsTotal}/{c.infusedItemsMax}
        </span>
        {c.plansKnown > 0 && (
          <span
            style={{
              fontFamily: "var(--sans)",
              fontSize: 10,
              color: "var(--text-faint)",
            }}
          >
            plans: {c.plansKnown}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <button
          className="act"
          onClick={addSlot}
          disabled={slotsTotal >= c.infusedItemsMax}
          style={{
            fontSize: 11,
            padding: "2px 8px",
            opacity: slotsTotal >= c.infusedItemsMax ? 0.4 : 1,
          }}
        >
          {isEFA ? "+ Create" : "+ Infuse"}
        </button>
      </div>

      {active.length === 0 && (
        <div
          style={{
            fontFamily: "var(--sans)",
            fontSize: 12,
            color: "var(--text-faint)",
            paddingBottom: 2,
          }}
        >
          {isEFA
            ? "No active plans — click + Create to create a magic item."
            : "No active infusions — click + Infuse to assign one."}
        </div>
      )}

      {active.map((slot) => {
        // The plan/infusion chosen for this slot (name stored directly).
        const selectedPlan = REPLICATE_PLANS.find(
          (p) => p.name === slot.infusionName,
        );
        const isAtt = selectedPlan?.isAttachment ?? false;
        // Plan names already chosen in OTHER slots (can't learn/apply twice).
        const usedPlanNames = new Set(
          active
            .filter((s) => s.id !== slot.id && s.infusionName)
            .map((s) => s.infusionName),
        );
        // EFA: only plans the player learned; non-EFA: all unlocked by level.
        const availablePlans = (
          isEFA
            ? REPLICATE_PLANS.filter(
                (p) => p.minLevel <= artLevel && known.includes(p.name),
              )
            : REPLICATE_PLANS.filter((p) => p.minLevel <= artLevel)
        ).filter(
          (p) => p.name === slot.infusionName || !usedPlanNames.has(p.name),
        );
        const tierGroups = ([2, 6, 10] as const).filter((t) =>
          availablePlans.some((p) => p.minLevel === t),
        );

        return (
          <div
            key={slot.id}
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              marginBottom: 5,
            }}
          >
            {/* Plan / infusion picker — name determines creation vs attachment */}
            <select
              value={slot.infusionName}
              onChange={(e) => selectPlan(slot.id, e.target.value)}
              style={{
                ...ARTI_SELECT_STYLE,
                flex: isAtt ? "0 0 auto" : 1,
                maxWidth: isAtt ? 180 : undefined,
                minWidth: 0,
              }}
            >
              <option value="">{isEFA ? "— Select plan —" : "— Infusion —"}</option>
              {isEFA ? (
                <>
                  {known.length === 0 && (
                    <option disabled>No plans learned (add in builder)</option>
                  )}
                  {tierGroups.map((tier) => (
                    <optgroup key={tier} label={`Level ${tier}+`}>
                      {availablePlans
                        .filter((p) => p.minLevel === tier)
                        .map((p) => (
                          <option key={p.name} value={p.name}>
                            {p.name}
                            {p.isAttachment ? " ⚙" : ""}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </>
              ) : knownOptions.length === 0 ? (
                <option disabled>No infusions known (add in builder)</option>
              ) : (
                knownOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))
              )}
            </select>

            {/* Attachment → choose which existing item it is applied to */}
            {isAtt && (
              <>
                <span
                  style={{
                    color: "var(--text-faint)",
                    fontSize: 11,
                    flexShrink: 0,
                  }}
                >
                  on
                </span>
                <select
                  value={slot.targetItemKey}
                  onChange={(e) =>
                    patchSlot(slot.id, { targetItemKey: e.target.value })
                  }
                  style={{ ...ARTI_SELECT_STYLE, flex: 1, minWidth: 0 }}
                >
                  <option value="">— Select item —</option>
                  {inventory
                    .filter((i) => !i.replicated)
                    .map((i) => (
                      <option key={i.key} value={i.key}>
                        {artiItemName(i.key, inventory)}
                      </option>
                    ))}
                </select>
              </>
            )}

            {/* Creation → item dropped into inventory automatically */}
            {!isAtt && slot.infusionName && (
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-faint)",
                  fontFamily: "var(--sans)",
                  flexShrink: 0,
                }}
              >
                → added to inventory
              </span>
            )}

            <button
              title="Remove infusion"
              onClick={() => removeSlot(slot.id)}
              style={{
                fontFamily: "var(--mono)",
                fontSize: 13,
                background: "none",
                border: "none",
                color: "var(--text-faint)",
                cursor: "pointer",
                padding: "0 2px",
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        );
      })}

      <div
        style={{
          fontFamily: "var(--sans)",
          fontSize: 11,
          color: "var(--text-faint)",
          marginTop: active.length ? 4 : 0,
        }}
      >
        {isEFA
          ? `${c.infusionsKnown} plans known · ${slotsUsed} of ${c.infusedItemsMax} items active`
          : `${c.infusionsKnown} infusions known · ${slotsUsed} of ${c.infusedItemsMax} item slots used`}
      </div>
    </div>
  );
}

interface InventoryTabProps {
  c: ComputedChar;
  showKg: boolean;
  stored: StoredChar;
  setStored: React.Dispatch<React.SetStateAction<StoredChar>>;
  density?: string;
  inventoryView?: string;
  onViewChange?: (v: string) => void;
}
export function InventoryTab5e({
  c,
  showKg,
  stored,
  setStored,
  density,
  inventoryView = "list",
  onViewChange,
}: InventoryTabProps) {
  const [items, setItems] = React.useState<RegistryItem[] | null>(null);
  const [showModal, setShowModal] = React.useState(false);
  const [editingKey, setEditingKey] = React.useState<string | null>(null);
  const [goldOpen, setGoldOpen] = React.useState(false);
  const [coinDelta, setCoinDelta] = React.useState({
    pp: "",
    gp: "",
    sp: "",
    cp: "",
  });
  const [draggingKey, setDraggingKey] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [touchOverSlotKey, setTouchOverSlotKey] = React.useState<string | null>(
    null,
  );

  const touchDragKey = React.useRef<string | null>(null);
  const ghostRef = React.useRef<HTMLDivElement | null>(null);
  const touchOverSlotR = React.useRef<string | null>(null);
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const inventoryListRef = React.useRef<HTMLDivElement>(null);

  const toggleExpand = (key: string) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  React.useEffect(() => {
    loadItems().then((data) => setItems(data));
  }, []);

  // Resolve a stored key to a registry item
  const resolveItem = React.useCallback(
    (key: string) => resolveItemFn(stored.equipment.inventory, items, key),
    [items, stored.equipment.inventory],
  );

  const handleDrop = React.useCallback(
    (path: SlotKey, droppedKey: string) => {
      setStored((s) => {
        const oldKey = getSlotValue(s.equipment, path);
        const newEq = applySlotValue(s.equipment, path, droppedKey);

        let inventory = s.equipment.inventory.map((i) =>
          i.key === droppedKey ? { ...i, equipped: true } : i,
        );

        // If slot had a different item, unequip it if it's no longer in any slot
        if (oldKey && oldKey !== droppedKey) {
          if (!getAllSlotValues(newEq).includes(oldKey)) {
            inventory = inventory.map((i) =>
              i.key === oldKey ? { ...i, equipped: false } : i,
            );
          }
        }

        return { ...s, equipment: { ...newEq, inventory } };
      });
    },
    [setStored],
  );

  // Non-passive touchmove to prevent scroll during active drag
  React.useEffect(() => {
    const el = inventoryListRef.current;
    if (!el) return;
    const handler = (e: TouchEvent) => {
      if (touchDragKey.current !== null) e.preventDefault();
    };
    el.addEventListener("touchmove", handler, { passive: false });
    return () => el.removeEventListener("touchmove", handler);
  }, []);

  // Ghost cleanup on unmount
  React.useEffect(
    () => () => {
      ghostRef.current?.remove();
    },
    [],
  );

  const cleanupTouchDrag = () => {
    ghostRef.current?.remove();
    ghostRef.current = null;
    touchDragKey.current = null;
    touchOverSlotR.current = null;
    setDraggingKey(null);
    setTouchOverSlotKey(null);
  };

  const startTouchDrag = (
    itemKey: string,
    el: HTMLDivElement,
    clientX: number,
    clientY: number,
  ) => {
    touchDragKey.current = itemKey;
    requestAnimationFrame(() => setDraggingKey(itemKey));
    const rect = el.getBoundingClientRect();
    const ghost = el.cloneNode(true) as HTMLDivElement;
    ghost.style.cssText = `position:fixed;pointer-events:none;z-index:9999;opacity:0.85;transform:scale(1.04);width:${rect.width}px;left:${clientX - 20}px;top:${clientY - 20}px;margin:0;`;
    document.body.appendChild(ghost);
    ghostRef.current = ghost;
  };

  const moveTouchDrag = (clientX: number, clientY: number) => {
    if (!touchDragKey.current || !ghostRef.current) return;
    ghostRef.current.style.left = `${clientX - 20}px`;
    ghostRef.current.style.top = `${clientY - 20}px`;
    ghostRef.current.style.display = "none";
    const target = document.elementFromPoint(clientX, clientY);
    ghostRef.current.style.display = "";
    const slot =
      (target as Element | null)
        ?.closest("[data-equip-slot]")
        ?.getAttribute("data-equip-slot") ?? null;
    if (slot !== touchOverSlotR.current) {
      touchOverSlotR.current = slot;
      setTouchOverSlotKey(slot);
    }
  };

  const endTouchDrag = () => {
    if (touchDragKey.current && touchOverSlotR.current) {
      handleDrop(touchOverSlotR.current as SlotKey, touchDragKey.current);
    }
    cleanupTouchDrag();
  };

  const [invFilter, setInvFilter] = React.useState("all");

  const toggleStarredItem = (key: string) =>
    setStored((s) => ({
      ...s,
      equipment: {
        ...s.equipment,
        inventory: s.equipment.inventory.map((i) =>
          i.key === key ? { ...i, starred: !i.starred } : i,
        ),
      },
    }));

  const changeQty = (key: string, delta: number) =>
    setStored((s) => ({
      ...s,
      equipment: {
        ...s.equipment,
        inventory: s.equipment.inventory.map((i) =>
          i.key === key ? { ...i, qty: Math.max(0, i.qty + delta) } : i,
        ),
      },
    }));

  const removeItem = (key: string) =>
    setStored((s) => ({
      ...s,
      equipment: {
        ...s.equipment,
        inventory: s.equipment.inventory.filter((i) => i.key !== key),
      },
    }));

  const toggleEquipped = (key: string) =>
    setStored((s) => ({
      ...s,
      equipment: {
        ...s.equipment,
        inventory: s.equipment.inventory.map((i) =>
          i.key === key ? { ...i, equipped: !i.equipped } : i,
        ),
      },
    }));

  const setNotes = (key: string, notes: string) =>
    setStored((s) => ({
      ...s,
      equipment: {
        ...s.equipment,
        inventory: s.equipment.inventory.map((i) =>
          i.key === key ? { ...i, notes } : i,
        ),
      },
    }));

  const addRegistryItem = (reg: RegistryItem, mode: "loot" | "buy") => {
    const key = itemKey(reg);
    const existing = stored.equipment.inventory.find((i) => i.key === key);
    const costGp = mode === "buy" && reg.value != null ? reg.value / 100 : 0;
    if (existing) {
      changeQty(key, 1);
    } else {
      setStored((s) => ({
        ...s,
        equipment: {
          ...s.equipment,
          inventory: [
            ...s.equipment.inventory,
            { key, qty: 1, wt: reg.weight ?? 0, equipped: false, notes: "" },
          ],
        },
      }));
    }
    if (costGp > 0) {
      const costCp = reg.value ?? 0;
      setStored((s) => {
        const cur = s.currency ?? { pp: 0, gp: 0, sp: 0, cp: 0 };
        return {
          ...s,
          currency: coinFromCp(Math.max(0, totalCoinCp(cur) - costCp)),
        };
      });
    }
  };

  const addCustomItem = (name: string) => {
    const key = `${name.toLowerCase()}|custom`;
    const existing = stored.equipment.inventory.find((i) => i.key === key);
    if (existing) {
      changeQty(key, 1);
    } else {
      setStored((s) => ({
        ...s,
        equipment: {
          ...s.equipment,
          inventory: [
            ...s.equipment.inventory,
            { key, qty: 1, wt: 0, equipped: false, notes: "" },
          ],
        },
      }));
    }
  };

  const mintUniqueCustomKey = (name: string): string => {
    const base = name.toLowerCase();
    const existing = new Set(stored.equipment.inventory.map((i) => i.key));
    let key = `${base}|custom`;
    let n = 2;
    while (existing.has(key)) key = `${base}|custom-${n++}`;
    return key;
  };

  const createCustomItem = (name: string, payload: CustomItemPayload) => {
    const key = mintUniqueCustomKey(name);
    setStored((s) => ({
      ...s,
      equipment: {
        ...s.equipment,
        inventory: [
          ...s.equipment.inventory,
          {
            key,
            qty: 1,
            wt: payload.weight ?? 0,
            equipped: false,
            notes: "",
            custom: payload,
          },
        ],
      },
    }));
  };

  const updateCustomItem = (key: string, payload: CustomItemPayload) =>
    setStored((s) => ({
      ...s,
      equipment: {
        ...s.equipment,
        inventory: s.equipment.inventory.map((i) =>
          i.key === key ? { ...i, custom: payload } : i,
        ),
      },
    }));

  const forkToCustom = (
    oldKey: string,
    name: string,
    payload: CustomItemPayload,
  ) => {
    const newKey = mintUniqueCustomKey(name);
    setStored((s) => {
      const oldEntry = s.equipment.inventory.find((i) => i.key === oldKey);
      if (!oldEntry) return s;
      const inventory = [
        ...s.equipment.inventory.filter((i) => i.key !== oldKey),
        {
          key: newKey,
          qty: oldEntry.qty,
          wt: oldEntry.wt,
          equipped: oldEntry.equipped,
          notes: oldEntry.notes,
          custom: payload,
        },
      ];
      const relinkedEq = relinkEquipmentSlots(
        { ...s.equipment, inventory },
        oldKey,
        newKey,
      );
      return { ...s, equipment: { ...relinkedEq, inventory } };
    });
  };

  const [openMenuKey, setOpenMenuKey] = React.useState<string | null>(null);
  const [customModal, setCustomModal] = React.useState<{
    mode: "create" | "edit" | "fork";
    key?: string;
    initial?: CustomItemPayload;
    initialName?: string;
  } | null>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = React.useState(false);

  React.useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const check = () =>
      setAtEnd(el.scrollHeight - el.scrollTop - el.clientHeight < 10);
    check();
    el.addEventListener("scroll", check, { passive: true });
    return () => el.removeEventListener("scroll", check);
  });

  React.useEffect(() => {
    if (!openMenuKey) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as Element).closest(".inv-menu-wrap"))
        setOpenMenuKey(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenuKey(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [openMenuKey]);

  // Cards view: hover or click a card to inspect it. Rendered via portal at a fixed,
  // viewport-clamped position so it's never confined/clipped by the scrolling inventory
  // panel (and never grows the panel's scroll area, which was causing scroll-jump jitter).
  const [popKey, setPopKey] = React.useState<string | null>(null);
  const [tipPos, setTipPos] = React.useState<{
    left: number;
    top?: number;
    bottom?: number;
  } | null>(null);
  const hoverTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const TIP_WIDTH = 280;
  const openTip = (key: string, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const left = Math.max(
      8,
      Math.min(
        r.left + r.width / 2 - TIP_WIDTH / 2,
        window.innerWidth - TIP_WIDTH - 8,
      ),
    );
    const spaceBelow = window.innerHeight - r.bottom;
    const pos =
      spaceBelow < 320 && r.top > 320
        ? { left, bottom: window.innerHeight - r.top + 8 }
        : { left, top: r.bottom + 8 };
    setTipPos(pos);
    setPopKey(key);
  };
  const closeTip = () => setPopKey(null);
  React.useEffect(() => {
    if (!popKey) return;
    const close = (e: MouseEvent) => {
      if (
        !(e.target as Element).closest(".inv-card") &&
        !(e.target as Element).closest(".itip")
      )
        closeTip();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeTip();
    };
    const reflow = (e: Event) => {
      if ((e.target as Element)?.closest?.(".itip")) return;
      closeTip();
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", reflow, true);
    window.addEventListener("resize", reflow);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", reflow, true);
      window.removeEventListener("resize", reflow);
    };
  }, [popKey]);

  const filterItem = (i: (typeof stored.equipment.inventory)[0]) => {
    if (invFilter === "all") return true;
    if (invFilter === "equipped") return i.equipped;
    if (invFilter === "starred") return i.starred;
    const reg = resolveItem(i.key);
    if (invFilter === "weapon")
      return (
        reg?.weapon ||
        ["M", "R"].includes((reg?.type ?? "").replace(/\|.*/, ""))
      );
    if (invFilter === "armor")
      return (
        reg?.armor ||
        ["HA", "MA", "LA", "S"].includes((reg?.type ?? "").replace(/\|.*/, ""))
      );
    if (invFilter === "magic")
      return !!(
        reg &&
        reg.rarity &&
        !["none", "", "unknown"].includes(reg.rarity)
      );
    if (invFilter === "gear") {
      const t = (reg?.type ?? "").replace(/\|.*/, "");
      return (
        !(reg?.weapon || ["M", "R"].includes(t)) &&
        !(reg?.armor || ["HA", "MA", "LA", "S"].includes(t)) &&
        !(reg && reg.rarity && !["none", "", "unknown"].includes(reg.rarity))
      );
    }
    return true;
  };

  const visibleItems = stored.equipment.inventory.filter(filterItem);

  const getItemDisplayName = (key: string) => {
    const reg = resolveItem(key);
    return (
      reg?.name ?? key.split("|")[0].replace(/\b\w/g, (l) => l.toUpperCase())
    );
  };

  const getItemWeight = (i: (typeof stored.equipment.inventory)[0]) => {
    const reg = resolveItem(i.key);
    return i.wt || (reg?.weight ?? 0);
  };

  const cap = showKg
    ? c.carryCapacityKg
    : Math.round(c.carryCapacityKg / 0.453592);
  const enc = showKg ? c.encumberedAt : Math.round(c.encumberedAt / 0.453592);
  const hEnc = showKg ? c.heavilyEncAt : Math.round(c.heavilyEncAt / 0.453592);
  const wt = showKg ? c.totalWeightKg : c.totalWeightLb;
  const unit = showKg ? "kg" : "lb";
  const wtPct = Math.min(100, (wt / cap) * 100);
  const encPct = Math.min(100, (enc / cap) * 100);
  const hEncPct = Math.min(100, (hEnc / cap) * 100);
  const wtColor = wt >= hEnc ? "heavy" : wt >= enc ? "enc" : "";

  return (
    <div
      className={`panel-redesign inv-panel${density === "comfortable" ? " comfortable" : ""}`}
    >
      {/* Header */}
      <div className="inv-panel-head">
        <span className="inv-panel-title">
          Inventory
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: "var(--text-faint)",
              fontWeight: 400,
              marginLeft: 5,
            }}
          >
            {stored.equipment.inventory.length}
          </span>
        </span>
        <div className="inv-panel-actions">
          <button
            className="inv-coins"
            onClick={() => setGoldOpen((o) => !o)}
            title="Adjust currency"
          >
            {(stored.currency?.pp ?? 0) > 0 && (
              <span className="inv-coin inv-coin--pp">
                <span className="inv-coin-val">
                  {(stored.currency?.pp ?? 0).toLocaleString()}
                </span>
                <span className="inv-coin-lbl">PP</span>
              </span>
            )}
            <span className="inv-coin inv-coin--gp">
              <span className="inv-coin-val">
                {(stored.currency?.gp ?? 0).toLocaleString()}
              </span>
              <span className="inv-coin-lbl">GP</span>
            </span>
            {(stored.currency?.sp ?? 0) > 0 && (
              <span className="inv-coin inv-coin--sp">
                <span className="inv-coin-val">
                  {(stored.currency?.sp ?? 0).toLocaleString()}
                </span>
                <span className="inv-coin-lbl">SP</span>
              </span>
            )}
            {(stored.currency?.cp ?? 0) > 0 && (
              <span className="inv-coin inv-coin--cp">
                <span className="inv-coin-val">
                  {(stored.currency?.cp ?? 0).toLocaleString()}
                </span>
                <span className="inv-coin-lbl">CP</span>
              </span>
            )}
          </button>
          <div className="inv-view-toggle">
            <button
              className={`inv-view-btn${inventoryView === "list" ? " active" : ""}`}
              onClick={() => onViewChange?.("list")}
              title="List view"
            >
              ☰
            </button>
            <button
              className={`inv-view-btn${inventoryView === "cards" ? " active" : ""}`}
              onClick={() => onViewChange?.("cards")}
              title="Cards view"
            >
              ⊞
            </button>
          </div>
          <button
            className="act"
            onClick={() => setShowModal(true)}
            style={{ opacity: items ? 1 : 0.5 }}
          >
            {items ? "+ Add" : "…"}
          </button>
          <button
            className="act"
            onClick={() => setCustomModal({ mode: "create" })}
          >
            + Create Custom Item
          </button>
        </div>
      </div>

      {/* Currency transaction drawer */}
      {goldOpen &&
        (() => {
          const parseDelta = (v: string) => Math.abs(Number(v) || 0);
          const deltaCp =
            parseDelta(coinDelta.pp) * 1000 +
            parseDelta(coinDelta.gp) * 100 +
            parseDelta(coinDelta.sp) * 10 +
            parseDelta(coinDelta.cp);
          const hasAny = deltaCp > 0;

          const handleGain = () => {
            if (!hasAny) return;
            setStored((s) => ({
              ...s,
              currency: {
                pp: (s.currency?.pp ?? 0) + parseDelta(coinDelta.pp),
                gp: (s.currency?.gp ?? 0) + parseDelta(coinDelta.gp),
                sp: (s.currency?.sp ?? 0) + parseDelta(coinDelta.sp),
                cp: (s.currency?.cp ?? 0) + parseDelta(coinDelta.cp),
              },
            }));
            setCoinDelta({ pp: "", gp: "", sp: "", cp: "" });
            setGoldOpen(false);
          };

          const handleSpend = () => {
            if (!hasAny) return;
            setStored((s) => {
              const cur = s.currency ?? { pp: 0, gp: 0, sp: 0, cp: 0 };
              return {
                ...s,
                currency: coinFromCp(Math.max(0, totalCoinCp(cur) - deltaCp)),
              };
            });
            setCoinDelta({ pp: "", gp: "", sp: "", cp: "" });
            setGoldOpen(false);
          };

          const coinInput = (
            label: string,
            key: "pp" | "gp" | "sp" | "cp",
            color: string,
          ) => (
            <label className={`coin-txn-field coin-txn--${key}`}>
              <span className="coin-txn-lbl">{label}</span>
              <input
                type="number"
                min={0}
                placeholder="0"
                value={coinDelta[key]}
                onChange={(e) =>
                  setCoinDelta((d) => ({ ...d, [key]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleGain();
                  if (e.key === "Escape") {
                    setCoinDelta({ pp: "", gp: "", sp: "", cp: "" });
                    setGoldOpen(false);
                  }
                }}
                className="coin-txn-input"
                style={{ "--coin-color": color } as React.CSSProperties}
              />
            </label>
          );

          return (
            <div className="inv-txn-drawer">
              <div className="inv-txn-fields">
                {coinInput("PP", "pp", "#d4d4d8")}
                {coinInput("GP", "gp", "var(--gold)")}
                {coinInput("SP", "sp", "#a8a8b3")}
                {coinInput("CP", "cp", "#cd7f32")}
              </div>
              <div className="inv-txn-actions">
                <button
                  className="inv-txn-btn inv-txn-btn--gain"
                  onClick={handleGain}
                  disabled={!hasAny}
                >
                  Gain
                </button>
                <button
                  className="inv-txn-btn inv-txn-btn--spend"
                  onClick={handleSpend}
                  disabled={!hasAny}
                >
                  Spend
                </button>
                <button
                  className="inv-txn-btn inv-txn-btn--close"
                  onClick={() => {
                    setCoinDelta({ pp: "", gp: "", sp: "", cp: "" });
                    setGoldOpen(false);
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          );
        })()}

      {/* Equipment slots + carry */}
      <div className="inv-equip">
        <EquipmentSlotsPanel
          stored={stored}
          setStored={setStored}
          anyDragging={draggingKey !== null}
          items={items}
          onDrop={handleDrop}
          touchOverSlot={touchOverSlotKey}
        />
        <div className="carry-bar">
          <div className="carry-bar-top">
            <span className="carry-bar-label">Carry Capacity</span>
            <span
              className="carry-bar-val"
              style={{
                color:
                  wt >= hEnc
                    ? "var(--danger)"
                    : wt >= enc
                      ? "var(--gold)"
                      : "var(--text-muted)",
              }}
            >
              {wt} / {cap} {unit}
            </span>
          </div>
          <div className="carry-bar-track">
            <div
              className={`carry-bar-fill${wtColor ? " " + wtColor : ""}`}
              style={{ width: `${wtPct}%` }}
            />
            <div className="carry-bar-tick" style={{ left: `${encPct}%` }} />
            <div className="carry-bar-tick" style={{ left: `${hEncPct}%` }} />
          </div>
          <div className="carry-bar-foot">
            <span>
              Enc. at {enc} · Heavily enc. at {hEnc} {unit}
            </span>
            {wt >= hEnc && (
              <span style={{ color: "var(--danger)" }}>HEAVILY ENC.</span>
            )}
            {wt >= enc && wt < hEnc && (
              <span style={{ color: "var(--gold)" }}>ENCUMBERED</span>
            )}
          </div>
        </div>
      </div>

      {/* Artificer: Infuse Item (includes Replicate Magic Item) */}
      <ActiveInfusionsPanel
        c={c}
        stored={stored}
        setStored={setStored}
        items={items}
      />

      {/* Filters */}
      <div className="inv-filters">
        {[
          { key: "all", label: "All" },
          { key: "equipped", label: "Equipped" },
          { key: "weapon", label: "Weapon" },
          { key: "armor", label: "Armor" },
          { key: "gear", label: "Gear" },
          { key: "magic", label: "Magic" },
          { key: "starred", label: "★" },
        ].map((f) => (
          <button
            key={f.key}
            className={`inv-filter-btn${invFilter === f.key ? " active" : ""}`}
            onClick={() => setInvFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Scrollable body */}
      <div className={`inv-bodywrap${atEnd ? " at-end" : ""}`}>
        <div className="inv-body" ref={bodyRef}>
          {inventoryView === "cards" ? (
            /* Cards view */
            visibleItems.length === 0 ? (
              <div
                style={{
                  padding: "24px 16px",
                  textAlign: "center",
                  color: "var(--text-faint)",
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                }}
              >
                {stored.equipment.inventory.length === 0
                  ? "No items — click + Add above"
                  : "No items match filter"}
              </div>
            ) : (
              <div className="inv-cards-grid" ref={inventoryListRef}>
                {visibleItems.map((i) => {
                  const reg = resolveItem(i.key);
                  const displayName = getItemDisplayName(i.key);
                  const stat = reg ? itemShortStat(reg) : null;
                  const rarity =
                    reg?.rarity &&
                    !["none", "", "unknown", "varies"].includes(reg.rarity)
                      ? reg.rarity
                      : null;
                  const rarityClass = rarity
                    ? rarity.replace(/\s+/g, "-")
                    : null;
                  const hasAttune = !!(reg as any)?.reqAttune;
                  const allEntries = [
                    ...(reg?.entries ?? []),
                    ...((reg as any)?.additionalEntries ?? []),
                  ];
                  const descNode =
                    allEntries.length > 0
                      ? renderEntries(allEntries as unknown[])
                      : null;
                  // Attachment infusion applied to THIS item (host), if any.
                  const hostInfusion = i.replicated
                    ? undefined
                    : (stored.activeInfusions ?? []).find(
                        (inf) =>
                          inf.targetItemKey === i.key && inf.infusionName,
                      );
                  const hostInfusionPlan = hostInfusion
                    ? REPLICATE_PLANS.find(
                        (p) => p.name === hostInfusion.infusionName,
                      )
                    : undefined;
                  const typeLbl = reg ? itemTypeLabel(reg) : null;
                  const subtitle = [
                    rarity
                      ? rarity.replace(/\b\w/g, (l) => l.toUpperCase())
                      : "Common",
                    typeLbl,
                  ]
                    .filter(Boolean)
                    .join(" ");
                  const wt3 = i.wt || reg?.weight;
                  const isPopped = popKey === i.key;
                  return (
                    <div
                      key={i.key}
                      className={`inv-card${i.equipped ? " equipped" : ""}`}
                      draggable
                      onClick={(e) => {
                        isPopped ? closeTip() : openTip(i.key, e.currentTarget);
                      }}
                      onMouseEnter={(e) => {
                        const el = e.currentTarget;
                        hoverTimer.current = setTimeout(
                          () => openTip(i.key, el),
                          150,
                        );
                      }}
                      onMouseLeave={() => {
                        if (hoverTimer.current)
                          clearTimeout(hoverTimer.current);
                        if (isPopped) closeTip();
                      }}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", i.key);
                        e.dataTransfer.effectAllowed = "copy";
                        requestAnimationFrame(() => setDraggingKey(i.key));
                      }}
                      onDragEnd={() => setDraggingKey(null)}
                    >
                      {i.qty > 1 && (
                        <span className="inv-card-badge">×{i.qty}</span>
                      )}
                      <div className="inv-card-top-btns">
                        <button
                          className={`inv-equip-btn${i.equipped ? " equipped" : ""}`}
                          title={i.equipped ? "Unequip" : "Equip"}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleEquipped(i.key);
                          }}
                        >
                          {i.equipped ? "◉" : "○"}
                        </button>
                        <button
                          className={`inv-card-star${i.starred ? " starred" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStarredItem(i.key);
                          }}
                          title={
                            i.starred ? "Unstar" : "Star (shows in Combat)"
                          }
                        >
                          {i.starred ? "★" : "☆"}
                        </button>
                      </div>
                      <div className="inv-card-icon">
                        <Icon
                          kind={
                            reg?.armor
                              ? "shield"
                              : reg?.weapon
                                ? "sword"
                                : "bag"
                          }
                          size={28}
                        />
                      </div>
                      <div className="inv-card-name" title={displayName}>
                        {displayName}
                        {(() => {
                          const ai = (stored.activeInfusions ?? []).find(
                            (inf) =>
                              inf.targetItemKey === i.key && inf.infusionName,
                          );
                          const label = i.replicated
                            ? "REPLICATED"
                            : ai
                              ? "INFUSED"
                              : null;
                          const tip = i.replicated
                            ? "Replicated by Artificer"
                            : ai
                              ? `Infusion: ${ai.infusionName}`
                              : "";
                          return label ? (
                            <span
                              title={tip}
                              style={{
                                marginLeft: 4,
                                fontSize: 8,
                                fontFamily: "var(--mono)",
                                fontWeight: 700,
                                color: "#b8860b",
                                background: "#b8860b22",
                                border: "1px solid #b8860b55",
                                borderRadius: 3,
                                padding: "0 3px",
                                verticalAlign: "middle",
                              }}
                            >
                              {label}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      <div className="inv-card-foot">
                        {stat ?? (wt3 ? `${wt3} ${unit}` : "")}
                        {reg && (
                          <ProfBadge
                            item={reg}
                            weaponProfs={c.proficiencies.weapons
                              .split(", ")
                              .filter(Boolean)}
                            armorProfs={c.proficiencies.armor
                              .split(", ")
                              .filter(Boolean)}
                            size={10}
                          />
                        )}
                      </div>
                      {isPopped &&
                        tipPos &&
                        createPortal(
                          <div
                            className={`itip${rarityClass ? ` rarity-${rarityClass}` : ""}`}
                            style={{
                              left: tipPos.left,
                              top: tipPos.top,
                              bottom: tipPos.bottom,
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="itip-head">
                              <div>
                                <div className="itip-name">{displayName}</div>
                                <div className="itip-sub">{subtitle}</div>
                              </div>
                              <div className="itip-icon">
                                <Icon
                                  kind={
                                    reg?.armor
                                      ? "shield"
                                      : reg?.weapon
                                        ? "sword"
                                        : "bag"
                                  }
                                  size={20}
                                />
                              </div>
                            </div>
                            {(hasAttune || i.equipped) && (
                              <div className="itip-flags">
                                {i.equipped && <span>◉ Equipped</span>}
                                {hasAttune && (
                                  <span>◆ Requires Attunement</span>
                                )}
                              </div>
                            )}
                            {stat && <div className="itip-stat">{stat}</div>}
                            {descNode ? (
                              <div className="itip-desc">{descNode}</div>
                            ) : (
                              !reg && (
                                <div className="itip-desc">
                                  Custom item — no further details.
                                </div>
                              )
                            )}
                            {hostInfusion && (
                              <div className="itip-infusion">
                                <span className="itip-infusion-tag">
                                  ⚙ Infusion · {hostInfusion.infusionName}
                                </span>
                                {hostInfusionPlan?.effect && (
                                  <span className="itip-infusion-eff">
                                    {hostInfusionPlan.effect}
                                  </span>
                                )}
                              </div>
                            )}
                            {(wt3 || reg?.value) && (
                              <div className="itip-foot">
                                {wt3 ? (
                                  <span>
                                    {wt3} {unit}
                                  </span>
                                ) : (
                                  <span />
                                )}
                                {reg?.value ? (
                                  <span>{formatGp(reg.value)}</span>
                                ) : null}
                              </div>
                            )}
                          </div>,
                          document.body,
                        )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* List view */
            <>
              {visibleItems.length === 0 ? (
                <div
                  style={{
                    padding: "14px 16px",
                    color: "var(--text-faint)",
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    textAlign: "center",
                  }}
                >
                  {stored.equipment.inventory.length === 0
                    ? "No items — click + Add above"
                    : "No items match filter"}
                </div>
              ) : (
                <>
                  <div className="inv-header">
                    <span>Name</span>
                    <span>Qty</span>
                    <span>Wt</span>
                    <span>Notes</span>
                    <span></span>
                  </div>
                  <div ref={inventoryListRef}>
                    {visibleItems.map((i) => {
                      const reg = resolveItem(i.key);
                      const isCustom = i.key.endsWith("|custom");
                      const displayName = getItemDisplayName(i.key);
                      const typeLabel = reg
                        ? itemTypeLabel(reg)
                        : isCustom
                          ? "Custom"
                          : null;
                      const wt2 = getItemWeight(i);
                      const isExpanded = expanded.has(i.key);
                      const hasStats = !!reg;
                      return (
                        <div key={i.key}>
                          <div
                            className={`inv-row${i.equipped ? " inv-equipped" : ""}${draggingKey === i.key ? " inv-dragging" : ""}`}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", i.key);
                              e.dataTransfer.effectAllowed = "copy";
                              requestAnimationFrame(() =>
                                setDraggingKey(i.key),
                              );
                            }}
                            onDragEnd={() => setDraggingKey(null)}
                            onTouchStart={(e) => {
                              const touch = e.touches[0];
                              const startX = touch.clientX,
                                startY = touch.clientY;
                              const el = e.currentTarget as HTMLDivElement;
                              longPressTimer.current = setTimeout(
                                () => startTouchDrag(i.key, el, startX, startY),
                                150,
                              );
                              const cancel = (ev: TouchEvent) => {
                                if (!ev.touches[0]) return;
                                if (
                                  Math.abs(ev.touches[0].clientX - startX) >
                                    8 ||
                                  Math.abs(ev.touches[0].clientY - startY) > 8
                                ) {
                                  clearTimeout(longPressTimer.current!);
                                  longPressTimer.current = null;
                                }
                              };
                              document.addEventListener("touchmove", cancel, {
                                once: true,
                                passive: true,
                              });
                            }}
                            onTouchMove={(e) => {
                              if (!touchDragKey.current) return;
                              const t = e.touches[0];
                              moveTouchDrag(t.clientX, t.clientY);
                            }}
                            onTouchEnd={() => {
                              clearTimeout(longPressTimer.current!);
                              longPressTimer.current = null;
                              endTouchDrag();
                            }}
                            onTouchCancel={() => {
                              clearTimeout(longPressTimer.current!);
                              longPressTimer.current = null;
                              cleanupTouchDrag();
                            }}
                          >
                            <div className="inv-name-cell">
                              <button
                                className={`inv-equip-btn${i.equipped ? " equipped" : ""}`}
                                title={i.equipped ? "Unequip" : "Equip"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleEquipped(i.key);
                                }}
                              >
                                {i.equipped ? "◉" : "○"}
                              </button>
                              <button
                                className={`star-toggle${i.starred ? " starred" : ""}`}
                                title={
                                  i.starred
                                    ? "Unstar"
                                    : "Star (shows in Combat)"
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleStarredItem(i.key);
                                }}
                              >
                                {i.starred ? "★" : "☆"}
                              </button>
                              <span
                                className="name"
                                onClick={() => hasStats && toggleExpand(i.key)}
                                style={{
                                  cursor: hasStats ? "pointer" : "default",
                                }}
                              >
                                {displayName}
                                {typeLabel && (
                                  <span className="inv-type-badge">
                                    {typeLabel}
                                  </span>
                                )}
                                {reg && (
                                  <ProfBadge
                                    item={reg}
                                    weaponProfs={c.proficiencies.weapons
                                      .split(", ")
                                      .filter(Boolean)}
                                    armorProfs={c.proficiencies.armor
                                      .split(", ")
                                      .filter(Boolean)}
                                    size={10}
                                  />
                                )}
                                {(() => {
                                  const appliedInfusion = (
                                    stored.activeInfusions ?? []
                                  ).find(
                                    (inf) =>
                                      inf.targetItemKey === i.key &&
                                      inf.infusionName,
                                  );
                                  if (i.replicated)
                                    return (
                                      <span
                                        title="Replicated by Artificer — Release to remove"
                                        style={{
                                          marginLeft: 5,
                                          fontSize: 9,
                                          fontFamily: "var(--mono)",
                                          fontWeight: 700,
                                          letterSpacing: "0.05em",
                                          color: "#b8860b",
                                          background: "#b8860b22",
                                          border: "1px solid #b8860b55",
                                          borderRadius: 3,
                                          padding: "0 4px",
                                          userSelect: "none",
                                        }}
                                      >
                                        REPLICATED
                                      </span>
                                    );
                                  if (appliedInfusion)
                                    return (
                                      <span
                                        title={`Infusion: ${appliedInfusion.infusionName}`}
                                        style={{
                                          marginLeft: 5,
                                          fontSize: 9,
                                          fontFamily: "var(--mono)",
                                          fontWeight: 700,
                                          letterSpacing: "0.05em",
                                          color: "#b8860b",
                                          background: "#b8860b22",
                                          border: "1px solid #b8860b55",
                                          borderRadius: 3,
                                          padding: "0 4px",
                                          userSelect: "none",
                                        }}
                                      >
                                        INFUSED
                                      </span>
                                    );
                                  return null;
                                })()}
                                {hasStats && (
                                  <span
                                    style={{
                                      marginLeft: 6,
                                      fontSize: 9,
                                      color: "var(--text-faint)",
                                      fontFamily: "var(--mono)",
                                      userSelect: "none",
                                    }}
                                  >
                                    {isExpanded ? "▴" : "▾"}
                                  </span>
                                )}
                              </span>
                            </div>
                            <span className="qty">
                              <Spinner
                                onUp={() => changeQty(i.key, 1)}
                                onDown={() => changeQty(i.key, -1)}
                              />
                              {i.qty}
                            </span>
                            <span className="wt">{wt2 ? `${wt2}` : "—"}</span>
                            <span className="notes">
                              {editingKey === i.key ? (
                                <input
                                  className="inv-notes-input"
                                  value={i.notes}
                                  onChange={(e) =>
                                    setNotes(i.key, e.target.value)
                                  }
                                  onBlur={() => setEditingKey(null)}
                                  autoFocus
                                />
                              ) : (
                                <span
                                  className="inv-notes-text"
                                  style={{
                                    fontStyle: i.notes ? "normal" : "italic",
                                    color: i.notes
                                      ? "var(--text-muted)"
                                      : "var(--text-faint)",
                                  }}
                                  onClick={() => setEditingKey(i.key)}
                                >
                                  {i.notes || "add note…"}
                                </span>
                              )}
                            </span>
                            <div className="inv-menu-wrap">
                              <button
                                className="inv-act-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuKey(
                                    openMenuKey === i.key ? null : i.key,
                                  );
                                }}
                                title="Item actions"
                              >
                                ⋯
                              </button>
                              {openMenuKey === i.key && (
                                <div className="inv-menu">
                                  <div className="inv-menu-section">
                                    Actions
                                  </div>
                                  <button
                                    className="inv-menu-item"
                                    onClick={() => {
                                      toggleEquipped(i.key);
                                      setOpenMenuKey(null);
                                    }}
                                  >
                                    {i.equipped ? "Unequip" : "Equip (toggle)"}
                                  </button>
                                  <button
                                    className="inv-menu-item"
                                    onClick={() => {
                                      toggleStarredItem(i.key);
                                      setOpenMenuKey(null);
                                    }}
                                  >
                                    {i.starred
                                      ? "Unstar"
                                      : "Star (Combat shortcut)"}
                                  </button>
                                  <div className="inv-menu-divider" />
                                  {isCustom ? (
                                    <button
                                      className="inv-menu-item"
                                      onClick={() => {
                                        setCustomModal({
                                          mode: "edit",
                                          key: i.key,
                                          initial: i.custom,
                                          initialName: i.key.split("|")[0],
                                        });
                                        setOpenMenuKey(null);
                                      }}
                                    >
                                      Edit item
                                    </button>
                                  ) : (
                                    reg && (
                                      <button
                                        className="inv-menu-item"
                                        onClick={() => {
                                          setCustomModal({
                                            mode: "fork",
                                            key: i.key,
                                            initial: reg,
                                            initialName: reg.name,
                                          });
                                          setOpenMenuKey(null);
                                        }}
                                      >
                                        Fork to custom…
                                      </button>
                                    )
                                  )}
                                  <div className="inv-menu-divider" />
                                  {i.replicated && (
                                    <button
                                      className="inv-menu-item danger"
                                      onClick={() => {
                                        removeItem(i.key);
                                        setOpenMenuKey(null);
                                      }}
                                    >
                                      Release infusion (remove)
                                    </button>
                                  )}
                                  <button
                                    className="inv-menu-item danger"
                                    onClick={() => {
                                      removeItem(i.key);
                                      setOpenMenuKey(null);
                                    }}
                                  >
                                    Drop item
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          {isExpanded && reg && <ItemStatBlock item={reg} />}
                          {isExpanded &&
                            !i.replicated &&
                            (() => {
                              const inf = (stored.activeInfusions ?? []).find(
                                (a) =>
                                  a.targetItemKey === i.key && a.infusionName,
                              );
                              if (!inf) return null;
                              const plan = REPLICATE_PLANS.find(
                                (p) => p.name === inf.infusionName,
                              );
                              return (
                                <div className="inv-row-infusion">
                                  <span className="itip-infusion-tag">
                                    ⚙ Infusion · {inf.infusionName}
                                  </span>
                                  {plan?.effect && (
                                    <span className="itip-infusion-eff">
                                      {plan.effect}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {showModal && items && (
        <AddItemModal
          items={items}
          currency={{
            pp: stored.currency?.pp ?? 0,
            gp: stored.currency?.gp ?? 0,
            sp: stored.currency?.sp ?? 0,
            cp: stored.currency?.cp ?? 0,
          }}
          onAdd={addRegistryItem}
          onAddCustom={addCustomItem}
          onClose={() => setShowModal(false)}
        />
      )}

      {customModal && (
        <CustomItemModal
          mode={customModal.mode}
          initial={customModal.initial}
          initialName={customModal.initialName}
          onClose={() => setCustomModal(null)}
          onSave={(name, payload) => {
            if (customModal.mode === "create") createCustomItem(name, payload);
            else if (customModal.mode === "edit")
              updateCustomItem(customModal.key!, payload);
            else forkToCustom(customModal.key!, name, payload);
            setCustomModal(null);
          }}
        />
      )}
    </div>
  );
}
