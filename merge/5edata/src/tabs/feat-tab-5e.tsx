import React from "react";
import { renderEntries } from "../core/tag-renderer";
import type { ComputedChar, StoredChar } from "../core/types";

// ──────────────────────────────────────────────────────────────────────────────
// ── Features ─────────────────────────────────────────────────────────────────

const CLASS_COLOR: Record<string, string> = {
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

function classColor(cls: string): string {
  return CLASS_COLOR[cls] ?? "var(--gold-dim)";
}

// ── Class Resource Strip ──────────────────────────────────────────────────────

interface ClassResourceStripProps {
  c: ComputedChar;
  stored: StoredChar;
  setStored: React.Dispatch<React.SetStateAction<StoredChar>>;
}

function ClassResourceStrip({ c, stored, setStored }: ClassResourceStripProps) {
  const res = c.resources;

  type Pool = {
    key: string;
    name: string;
    cls: string;
    current: number;
    max: number;
    resetOn: "short" | "long";
    die?: string;
    setCurrent: (n: number) => void;
  };

  const pools: Pool[] = [];

  if (res.bardicInspiration) {
    pools.push({
      key: "bardic",
      name: "Bardic Inspiration",
      cls: "Bard",
      current: res.bardicInspiration.current,
      max: res.bardicInspiration.max,
      resetOn: "long",
      die: res.bardicInspiration.die,
      setCurrent: (n) =>
        setStored((s) => ({
          ...s,
          resources: {
            ...s.resources,
            bardicInspiration: {
              current: Math.max(0, Math.min(res.bardicInspiration!.max, n)),
            },
          },
        })),
    });
  }
  if (res.rages) {
    pools.push({
      key: "rages",
      name: "Rages",
      cls: "Barbarian",
      current: res.rages.current,
      max: res.rages.max,
      resetOn: "long",
      setCurrent: (n) =>
        setStored((s) => ({
          ...s,
          resources: {
            ...s.resources,
            rages: Math.max(0, Math.min(res.rages!.max, n)),
          },
        })),
    });
  }
  if (res.kiPoints) {
    pools.push({
      key: "ki",
      name: "Ki Points",
      cls: "Monk",
      current: res.kiPoints.current,
      max: res.kiPoints.max,
      resetOn: "short",
      setCurrent: (n) =>
        setStored((s) => ({
          ...s,
          resources: {
            ...s.resources,
            kiPoints: Math.max(0, Math.min(res.kiPoints!.max, n)),
          },
        })),
    });
  }
  if (res.sorceryPoints) {
    pools.push({
      key: "sorc",
      name: "Sorcery Points",
      cls: "Sorcerer",
      current: res.sorceryPoints.current,
      max: res.sorceryPoints.max,
      resetOn: "long",
      setCurrent: (n) =>
        setStored((s) => ({
          ...s,
          resources: {
            ...s.resources,
            sorceryPoints: Math.max(0, Math.min(res.sorceryPoints!.max, n)),
          },
        })),
    });
  }
  res.custom.forEach((r, idx) => {
    pools.push({
      key: "custom_" + idx,
      name: r.name,
      cls: "",
      current: r.current,
      max: r.max,
      resetOn: (r.resetOn as "short" | "long") ?? "long",
      setCurrent: (n) =>
        setStored((s) => ({
          ...s,
          resources: {
            ...s.resources,
            custom: s.resources.custom.map((c2, i) =>
              i === idx
                ? { ...c2, current: Math.max(0, Math.min(c2.max, n)) }
                : c2,
            ),
          },
        })),
    });
  });

  // Cartographer: Atlas Maps (1 + INT mod, min 2) — reset on long rest
  const isCartographer = stored.classes.some(
    (cls) => cls.name === "Artificer" && cls.subclass === "Cartographer",
  );
  if (isCartographer) {
    const maxAtlasMaps = Math.max(2, 1 + c.abilities.INT.mod);
    const curAtlasMaps =
      stored.resources.actionUses?.["cartographer_atlas_maps"] ??
      maxAtlasMaps;
    pools.push({
      key: "atlas_maps",
      name: "Atlas Maps",
      cls: "Artificer",
      current: curAtlasMaps,
      max: maxAtlasMaps,
      resetOn: "long",
      setCurrent: (n) =>
        setStored((s) => ({
          ...s,
          resources: {
            ...s.resources,
            actionUses: {
              ...(s.resources.actionUses ?? {}),
              cartographer_atlas_maps: Math.max(0, Math.min(maxAtlasMaps, n)),
            },
          },
        })),
    });
    // Illuminated Cartography: Faerie Fire uses = max(1, INT mod)
    const maxFF = Math.max(1, c.abilities.INT.mod);
    const curFF =
      stored.resources.actionUses?.["cartographer_faerie_fire"] ?? maxFF;
    pools.push({
      key: "faerie_fire",
      name: "Illum. Cartography",
      cls: "Artificer",
      current: curFF,
      max: maxFF,
      resetOn: "long",
      setCurrent: (n) =>
        setStored((s) => ({
          ...s,
          resources: {
            ...s.resources,
            actionUses: {
              ...(s.resources.actionUses ?? {}),
              cartographer_faerie_fire: Math.max(0, Math.min(maxFF, n)),
            },
          },
        })),
    });
  }

  if (pools.length === 0) return null;

  return (
    <div className="rc-strip">
      <div className="rc-strip-head">
        Class Resources
        <span className="rc-strip-count">{pools.length}</span>
      </div>
      <div className="rc-chips-wrap">
        {pools.map((p) => {
          const color = classColor(p.cls);
          const pipCount = Math.min(p.max, 20);
          const handlePip = (i: number) => {
            const newVal = i + 1 === p.current ? i : i + 1;
            p.setCurrent(newVal);
          };
          return (
            <div
              key={p.key}
              className="rc-chip"
              style={{ "--c": color } as React.CSSProperties}
            >
              <div className="rc-chip-top">
                {p.name}
                <span className="rc-chip-tag">
                  {p.resetOn === "short" ? "SR" : "LR"}
                  {p.die ? ` · ${p.die}` : ""}
                </span>
              </div>
              <div className="rc-chip-bot">
                <div className="rc-pips">
                  {Array.from({ length: pipCount }).map((_, i) => (
                    <div
                      key={i}
                      className={`rc-pip${i < p.current ? " filled" : ""}`}
                      onClick={() => handlePip(i)}
                      title={`Set to ${i + 1}/${p.max}`}
                    />
                  ))}
                </div>
                {p.max > 20 && (
                  <span className="rc-chip-count">
                    {p.current}/{p.max}
                  </span>
                )}
                {p.max <= 20 && (
                  <span className="rc-chip-count">
                    {p.current}/{p.max}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface FeaturesTabProps {
  c: ComputedChar;
  stored: StoredChar;
  setStored: React.Dispatch<React.SetStateAction<StoredChar>>;
  density?: string;
}

type FeatItem = {
  name: string;
  desc?: string;
  entries?: unknown[];
  cost?: string;
  src: string;
  cls: string;
  levels?: number[];
};

function consolidate(
  feats: import("../core/types").FeatureEntry[],
  src: string,
  cls: string,
): FeatItem[] {
  const seen = new Map<string, { item: FeatItem; levels: number[] }>();
  for (const f of feats) {
    if (seen.has(f.name)) {
      const e = seen.get(f.name)!;
      if (f.level != null) e.levels.push(f.level);
      e.item = { ...e.item, entries: f.entries, desc: f.desc };
    } else {
      seen.set(f.name, {
        item: { name: f.name, desc: f.desc, entries: f.entries, cost: f.cost, src, cls },
        levels: f.level != null ? [f.level] : [],
      });
    }
  }
  return [...seen.values()].map(({ item, levels }) => ({
    ...item,
    levels: levels.length > 1 ? levels : undefined,
  }));
}

type FeatGroup = { src: string; cls: string; items: FeatItem[] };

export function FeaturesTab5e({
  c,
  stored,
  setStored,
  density,
}: FeaturesTabProps) {
  const [activeSrc, setActiveSrc] = React.useState("All");
  const [selectedItem, setSelectedItem] = React.useState<FeatItem | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const FE_DESCS: Record<string, string> = {
    "Bounty Hunter":
      "Investigation proficiency. Ensnaring Strike targets have Disadvantage on the saving throw.",
    "Keeper of the Veil":
      "Arcana proficiency. Protection from Evil and Good 1×/long rest.",
    "Mage Breaker": "Arcana proficiency. True Strike cantrip.",
    "Ranger Knight": "History proficiency. Heavy Armour proficiency.",
    "Sanctified Stalker":
      "Religion proficiency. Sacred Flame cantrip (1d8 Radiant, WIS save).",
  };
  const NE_DESCS: Record<string, string> = {
    "Beast Tamer": "Find Familiar 1×/short rest.",
    "Urban Tracker": "Sleight of Hand proficiency.",
    "Wasteland Wanderer: Cold": "Resistance to Cold damage.",
    "Wasteland Wanderer: Fire": "Resistance to Fire damage.",
    "Wasteland Wanderer: Poison": "Resistance to Poison damage.",
  };

  const featureGroups = React.useMemo((): FeatGroup[] => {
    const groups: FeatGroup[] = [];
    const raceLabel = `Race — ${c.race}`;
    if (c.raceFeatures.length > 0) {
      groups.push({
        src: raceLabel,
        cls: "Race",
        items: c.raceFeatures.map((f) => ({
          ...f,
          src: raceLabel,
          cls: "Race",
        })),
      });
    }
    c.classes.forEach((cls) => {
      const clsFeats = c.classFeatures.filter((f) => f.className === cls.name);
      const clsLabel = `${cls.name} Lvl ${cls.level}`;
      if (clsFeats.length > 0) {
        groups.push({
          src: clsLabel,
          cls: cls.name,
          items: consolidate(clsFeats, clsLabel, cls.name),
        });
      }
      if (cls.subclass) {
        const subFeats = c.subclassFeatures.filter(
          (f) => f.className === cls.name,
        );
        if (subFeats.length > 0) {
          groups.push({
            src: cls.subclass,
            cls: cls.name,
            items: consolidate(subFeats, cls.subclass, cls.name),
          });
        }
      }
    });
    const bgLabel = `Background — ${c.background}`;
    if (c.backgroundFeatures.length > 0) {
      groups.push({
        src: bgLabel,
        cls: "Background",
        items: c.backgroundFeatures.map((f) => ({
          ...f,
          src: bgLabel,
          cls: "Background",
        })),
      });
    }
    if (c.classes.some((cls) => cls.name === "Ranger (BG3)")) {
      const fe = (c.featureChoices.favouredEnemies ?? []).filter(Boolean);
      const ne = (c.featureChoices.naturalExplorer ?? []).filter(Boolean);
      if (fe.length > 0) {
        groups.push({
          src: "Favoured Enemy",
          cls: "Ranger (BG3)",
          items: fe.map((v) => ({
            name: v,
            desc: FE_DESCS[v] ?? "",
            src: "Favoured Enemy",
            cls: "Ranger (BG3)",
          })),
        });
      }
      if (ne.length > 0) {
        groups.push({
          src: "Natural Explorer",
          cls: "Ranger (BG3)",
          items: ne.map((v) => ({
            name: v,
            desc: NE_DESCS[v] ?? "",
            src: "Natural Explorer",
            cls: "Ranger (BG3)",
          })),
        });
      }
    }
    const opts = c.chosenOptionalFeatures ?? [];
    const optGroups: { label: string; cls: string; type: string }[] = [
      { label: "Fighting Style", cls: "Fighter", type: "fightingStyle" },
      { label: "Eldritch Invocations", cls: "Warlock", type: "invocation" },
      { label: "Metamagic", cls: "Sorcerer", type: "metamagic" },
      { label: "Battle Maneuvers", cls: "Fighter", type: "maneuver" },
      { label: "Infusions", cls: "Artificer", type: "infusion" },
    ];
    optGroups.forEach(({ label, cls, type }) => {
      const items = opts.filter((f) => f.optType === type);
      if (items.length > 0) {
        groups.push({
          src: label,
          cls,
          items: items.map((f) => ({ ...f, src: label, cls })),
        });
      }
    });
    return groups;
  }, [c]);

  const totalFeatures = featureGroups.reduce(
    (sum, g) => sum + g.items.length,
    0,
  );

  const filteredGroups = React.useMemo((): FeatGroup[] => {
    const q = search.toLowerCase().trim();
    return featureGroups
      .filter((g) => activeSrc === "All" || g.src === activeSrc)
      .map((g) => ({
        ...g,
        items: q
          ? g.items.filter(
              (f) =>
                f.name.toLowerCase().includes(q) ||
                (f.desc ?? "").toLowerCase().includes(q),
            )
          : g.items,
      }))
      .filter((g) => g.items.length > 0);
  }, [featureGroups, activeSrc, search]);

  const openDetail = (item: FeatItem) => {
    setSelectedItem(item);
    setDetailOpen(true);
  };
  const closeDetail = () => setDetailOpen(false);

  const detailColor = selectedItem
    ? classColor(selectedItem.cls)
    : "var(--gold-dim)";

  return (
    <div
      className={`panel-redesign feat-md${density === "comfortable" ? " comfortable" : ""}`}
    >
      {/* Header */}
      <div
        className="list-head"
        style={{ padding: "10px 16px", flexShrink: 0 }}
      >
        <span className="ttl">
          Features &amp; Traits
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              color: "var(--text-faint)",
              marginLeft: 6,
            }}
          >
            {totalFeatures}
          </span>
        </span>
        <button className="act">+ Add</button>
      </div>

      {/* Class Resources strip */}
      <ClassResourceStrip c={c} stored={stored} setStored={setStored} />

      {/* Search */}
      <div className="feat-md-search">
        <input
          type="text"
          placeholder="Search features…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Master / detail body */}
      <div className="md-body">
        {/* Source rail */}
        <div className="md-rail">
          {[
            { src: "All", cls: "", count: totalFeatures },
            ...featureGroups.map((g) => ({
              src: g.src,
              cls: g.cls,
              count: g.items.length,
            })),
          ].map((entry) => {
            const color = entry.cls ? classColor(entry.cls) : "var(--gold-dim)";
            const isActive = activeSrc === entry.src;
            return (
              <div
                key={entry.src}
                className={`md-rail-item${isActive ? " active" : ""}`}
                style={{ "--c": color } as React.CSSProperties}
                onClick={() => {
                  setActiveSrc(entry.src);
                  closeDetail();
                }}
              >
                <span className="md-rail-label">{entry.src}</span>
                <span className="md-rail-count">{entry.count}</span>
              </div>
            );
          })}
        </div>

        {/* Feature list */}
        <div className="md-list">
          {filteredGroups.length === 0 ? (
            <div className="md-list-empty">
              {search ? `No features match "${search}"` : "No features"}
            </div>
          ) : (
            filteredGroups.map((group) => (
              <React.Fragment key={group.src}>
                {activeSrc === "All" && (
                  <div
                    className="md-list-group-head"
                    style={
                      { "--c": classColor(group.cls) } as React.CSSProperties
                    }
                  >
                    {group.src}
                  </div>
                )}
                {group.items.map((item, i) => (
                  <div
                    key={item.name + i}
                    className={`md-list-item${selectedItem?.name === item.name && detailOpen ? " active" : ""}`}
                    onClick={() => openDetail(item)}
                  >
                    <span className="md-list-item-name">{item.name}</span>
                    {item.cost && (
                      <span className="md-list-item-tag">{item.cost}</span>
                    )}
                    {item.levels && (
                      <span className="md-list-item-tag">
                        {"Lvl " + item.levels.join(" · ")}
                      </span>
                    )}
                  </div>
                ))}
              </React.Fragment>
            ))
          )}
        </div>

        {/* Detail pane */}
        <div
          className={`md-detail${detailOpen ? " detail-open" : ""}`}
          style={{ "--c": detailColor } as React.CSSProperties}
        >
          <div className="md-detail-head">
            <button className="md-detail-back" onClick={closeDetail}>
              ← Back
            </button>
          </div>
          {selectedItem && (
            <>
              <div className="md-detail-src">{selectedItem.src}</div>
              <div className="md-detail-name">{selectedItem.name}</div>
              {selectedItem.cost && (
                <div className="md-detail-tag-wrap">
                  <span className="md-detail-tag">{selectedItem.cost}</span>
                </div>
              )}
              <div className="md-detail-body">
                {selectedItem.entries?.length ? (
                  renderEntries(selectedItem.entries)
                ) : selectedItem.desc ? (
                  <p style={{ margin: 0 }}>{selectedItem.desc}</p>
                ) : (
                  <span
                    style={{
                      color: "var(--text-faint)",
                      fontFamily: "var(--mono)",
                      fontSize: 11,
                    }}
                  >
                    No description available.
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
