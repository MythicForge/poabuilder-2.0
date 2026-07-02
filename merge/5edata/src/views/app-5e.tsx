import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  REGISTRY,
  REGISTRY_PROMISE,
  loadItems,
  loadBestiary,
  loadSpells,
} from "../core/data-registry";
import { computeCharacter, DEFAULT_STORED } from "../core/data-5e";
import {
  applyBuffs,
  TYPED_BUFF_LIST,
  BUFF_ENTRY_MAP,
} from "../core/data-buff-spells";
import type { SpellBuffEntry } from "../core/data-buff-spells";
import { ACTION_DEFS } from "../core/data-actions";
import { CharStorage } from "../core/storage";
import { loadRules } from "../core/campaign-rules";
import type { CampaignRules } from "../core/campaign-rules";
import { PluginRegistry } from "../features/plugin-registry";
import { PluginSection } from "../features/plugin-panel";
import { StatCard, Icon } from "../shared/primitives";
import { Dices } from "lucide-react";
import {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakToggle,
} from "../features/tweaks-panel";
import { LeftRail5e, RightRail5e } from "./sidebars-5e";
import {
  CombatTab5e,
  FeaturesTab5e,
  InventoryTab5e,
  SpellcastingTab5e,
  NotesTab5e,
  VassalsTab,
} from "../tabs/tabs-5e";
import type { ComputedChar, StoredChar, ConditionState } from "../core/types";
import type { UISlotId } from "../features/plugin-api";
import { getDriveState, hasValidToken, syncPush } from "../features/drive-sync";
import { DRIVE_CLIENT_ID } from "../features/drive-client-id";
import { SessionPanel } from "../features/session-ui";

// ── Conditions Bar ────────────────────────────────────────────────────────────

const CB_CAT_COLORS: Record<string, string> = {
  fire: "#e0623d",
  poison: "#5fae6b",
  sense: "#5f94d6",
  mind: "#d877ab",
  control: "#9d80dd",
  hinder: "#cf9a4e",
  arcane: "#54bdc9",
};

const SB_CAT_COLORS: Record<string, string> = {
  Abjuration: "#3B82F6",
  Transmutation: "#10B981",
  Enchantment: "#EC4899",
  Divination: "#8B5CF6",
  Conjuration: "#F59E0B",
};

const SCHOOL_CODE_TO_NAME: Record<string, string> = {
  A: "Abjuration",
  T: "Transmutation",
  E: "Enchantment",
  D: "Divination",
  C: "Conjuration",
  N: "Necromancy",
  V: "Evocation",
  I: "Illusion",
};

interface SpellMeta {
  schoolName: string;
  conc: boolean;
}

const ALL_BUFF_SPELL_NAMES = new Set(Object.keys(BUFF_ENTRY_MAP));

function buildSpellMetaMap(
  spells: import("../core/types").RegistrySpell[],
): Record<string, SpellMeta> {
  const map: Record<string, SpellMeta> = {};
  for (const spell of spells) {
    if (!ALL_BUFF_SPELL_NAMES.has(spell.name)) continue;
    map[spell.name] = {
      schoolName: SCHOOL_CODE_TO_NAME[spell.school] ?? spell.school,
      conc: spell.duration.some((d) => d.concentration === true),
    };
  }
  return map;
}

interface BuffChipProps {
  spellName: string;
  state: ConditionState;
  meta: SpellMeta | undefined;
  entry: SpellBuffEntry | undefined;
  editing: boolean;
  showDurations: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onUpdate: (patch: Partial<ConditionState>) => void;
}

function BuffChip({
  spellName,
  state,
  meta,
  entry,
  editing,
  showDurations,
  onEdit,
  onRemove,
  onUpdate,
}: BuffChipProps) {
  const color = SB_CAT_COLORS[meta?.schoolName ?? ""] ?? "#c6a25c";
  const isConc = state.conc ?? false;
  const isInf = state.rounds == null;
  const initial = cbInitial(spellName);

  const scaling = entry?.scalesWithSlot;
  const hasValueScaling =
    !!scaling &&
    (!!scaling.valuePerSlot || !!scaling.thresholds) &&
    !scaling.affectsTargets;
  const castLevel = state.castLevel ?? scaling?.base ?? 1;

  const setRounds = (n: number) =>
    onUpdate({ rounds: Math.max(1, Math.min(99, n)) });

  const setCastLevel = (n: number) =>
    onUpdate({ castLevel: Math.max(scaling?.base ?? 1, Math.min(9, n)) });

  // Compute scaled value label for tooltip
  const scaledNote = (() => {
    if (!hasValueScaling || !scaling) return null;
    if (scaling.valuePerSlot) {
      const bonus = (castLevel - scaling.base) * scaling.valuePerSlot;
      return bonus > 0 ? `+${bonus} from upcast` : null;
    }
    if (scaling.thresholds) {
      const thr = [...scaling.thresholds]
        .reverse()
        .find(([lvl]) => castLevel >= lvl);
      return thr ? `value → ${thr[1]} at Lv${castLevel}` : null;
    }
    return null;
  })();

  return (
    <div
      className={`cb-chip${editing ? " editing" : ""}`}
      style={{ "--c": color } as React.CSSProperties}
      onClick={(e) => {
        if ((e.target as Element).closest(".cb-x,.cb-editor")) return;
        onEdit();
      }}
    >
      <span className="cb-disc">{initial}</span>
      <span className="cb-cname">{spellName}</span>
      {isConc && <ConcRingIcon />}
      {hasValueScaling && castLevel > (scaling?.base ?? 1) && (
        <span className="cb-castlvl">Lv{castLevel}</span>
      )}
      {showDurations && (
        <span className={`cb-dur${isInf ? " inf" : ""}`}>
          {isInf ? "∞" : `${state.rounds} rd`}
          <span className="cb-dcaret">▾</span>
        </span>
      )}
      <button
        className="cb-x"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        ×
      </button>

      {!editing && (
        <div className="cb-tip">
          <div className="cb-tip-name">
            {spellName}
            <span className="cb-tip-dur">
              {isInf ? "Until removed" : `${state.rounds} rounds remaining`}
            </span>
          </div>
          <div className="cb-tip-eff">
            {meta
              ? `${meta.schoolName}${meta.conc ? " · Concentration" : ""}`
              : "Buff spell"}
            {scaledNote && ` · ${scaledNote}`}
          </div>
          {entry?.effects
            .filter((ef) => ef.type !== "utility")
            .map((ef, i) => (
              <div key={i} className="cb-tip-src">
                {ef.note}
              </div>
            ))}
        </div>
      )}

      {editing && (
        <div className="cb-editor" onClick={(e) => e.stopPropagation()}>
          <div className="cb-ed-head">
            <span>Duration</span>
            <span className="cb-ed-cond">{spellName}</span>
          </div>
          <div className="cb-ed-seg">
            <button
              className={!isInf ? "sel" : ""}
              onClick={() => {
                if (isInf) onUpdate({ rounds: state._last ?? 10 });
              }}
            >
              Rounds
            </button>
            <button
              className={isInf ? "sel" : ""}
              onClick={() => {
                if (!isInf)
                  onUpdate({ _last: state.rounds ?? undefined, rounds: null });
              }}
            >
              ∞ Indef
            </button>
          </div>
          {!isInf ? (
            <>
              <div className="cb-stepper">
                <button onClick={() => setRounds((state.rounds ?? 1) - 1)}>
                  −
                </button>
                <div className="cb-num">
                  <span className="cb-nv">{state.rounds}</span>
                  <small>rounds</small>
                </div>
                <button onClick={() => setRounds((state.rounds ?? 0) + 1)}>
                  +
                </button>
              </div>
              <div className="cb-presets">
                {[1, 3, 5, 10].map((n) => (
                  <button key={n} onClick={() => onUpdate({ rounds: n })}>
                    {n}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="cb-ed-inf">Lasts until manually removed.</div>
          )}
          {hasValueScaling && scaling && (
            <>
              <div className="cb-ed-head" style={{ marginTop: 8 }}>
                <span>Cast Level</span>
                <span className="cb-ed-cond">Lv{castLevel}</span>
              </div>
              <div className="cb-stepper">
                <button onClick={() => setCastLevel(castLevel - 1)}>−</button>
                <div className="cb-num">
                  <span className="cb-nv">{castLevel}</span>
                  <small>slot lv</small>
                </div>
                <button onClick={() => setCastLevel(castLevel + 1)}>+</button>
              </div>
              <div className="cb-presets">
                {Array.from(
                  { length: 9 - scaling.base + 1 },
                  (_, i) => scaling.base + i,
                ).map((lv) => (
                  <button
                    key={lv}
                    onClick={() => onUpdate({ castLevel: lv })}
                    style={castLevel === lv ? { opacity: 1 } : undefined}
                  >
                    {lv}
                  </button>
                ))}
              </div>
              <div className="cb-ed-inf">{scaling.note}</div>
            </>
          )}
          <button className="cb-ed-remove" onClick={onRemove}>
            Remove buff
          </button>
        </div>
      )}
    </div>
  );
}

const CB_CONDITIONS = [
  {
    key: "blinded",
    name: "Blinded",
    cat: "sense",
    eff: "Can't see. Attack rolls have disadvantage; attacks against you have advantage.",
  },
  {
    key: "burning",
    name: "Burning",
    cat: "fire",
    eff: "Takes fire damage at the start of each turn until the flames are extinguished.",
  },
  {
    key: "charmed",
    name: "Charmed",
    cat: "mind",
    eff: "Can't attack the charmer, who has advantage on social interactions with you.",
  },
  {
    key: "downed",
    name: "Downed",
    cat: "control",
    eff: "Unconscious and dying. Make a death saving throw at the start of each turn.",
  },
  {
    key: "encumbered",
    name: "Encumbered",
    cat: "hinder",
    eff: "Carrying too much weight. Movement speed is reduced.",
  },
  {
    key: "ensnared",
    name: "Ensnared",
    cat: "hinder",
    eff: "Held fast in place. Speed is 0 until you succeed on a check to break free.",
  },
  {
    key: "enwebbed",
    name: "Enwebbed",
    cat: "hinder",
    eff: "Caught in webbing. Speed is 0 and you have disadvantage on attack rolls.",
  },
  {
    key: "fearful",
    name: "Fearful",
    cat: "mind",
    eff: "Compelled to move away from the source of fear and can't willingly approach it.",
  },
  {
    key: "frightened",
    name: "Frightened",
    cat: "mind",
    eff: "Disadvantage on ability checks and attacks while the source is in line of sight.",
  },
  {
    key: "grappled",
    name: "Grappled",
    cat: "control",
    eff: "Speed is 0. Ends if the grappler is incapacitated or you are moved away.",
  },
  {
    key: "heavily",
    name: "Heavily Encumbered",
    cat: "hinder",
    eff: "Severely overloaded. Speed greatly reduced; disadvantage on attacks, checks and saves.",
  },
  {
    key: "invisible",
    name: "Invisible",
    cat: "arcane",
    eff: "Can't be seen. Your attacks have advantage; attacks against you have disadvantage.",
  },
  {
    key: "paralyzed",
    name: "Paralyzed",
    cat: "control",
    eff: "Incapacitated, can't move or speak. Melee hits against you are critical.",
  },
  {
    key: "poisoned",
    name: "Poisoned",
    cat: "poison",
    eff: "Disadvantage on attack rolls and ability checks.",
  },
  {
    key: "prone",
    name: "Prone",
    cat: "control",
    eff: "Disadvantage on attacks. Melee attacks against you have advantage; ranged have disadvantage.",
  },
  {
    key: "restrained",
    name: "Restrained",
    cat: "control",
    eff: "Speed 0. Disadvantage on attacks and Dex saves; attacks against you have advantage.",
  },
  {
    key: "silenced",
    name: "Silenced",
    cat: "sense",
    eff: "Can't cast spells that require verbal components.",
  },
  {
    key: "sleeping",
    name: "Sleeping",
    cat: "control",
    eff: "Unconscious. Wakes if it takes damage or someone uses an action to shake it awake.",
  },
  {
    key: "slowed",
    name: "Slowed",
    cat: "hinder",
    eff: "−2 to AC and Dex saves. Speed halved, no reactions.",
  },
  {
    key: "stunned",
    name: "Stunned",
    cat: "control",
    eff: "Incapacitated, can't move, and can speak only falteringly. Attacks against you have advantage.",
  },
  {
    key: "turned",
    name: "Turned",
    cat: "arcane",
    eff: "Must flee from the source and can't take reactions or willingly move closer.",
  },
  {
    key: "wet",
    name: "Wet",
    cat: "arcane",
    eff: "Vulnerable to Cold and Lightning damage; resistant to Fire damage.",
  },
] as const;

const CB_BY_KEY = Object.fromEntries(CB_CONDITIONS.map((c) => [c.key, c]));
const cbInitial = (name: string) =>
  name
    .replace(/[^A-Za-z]/g, "")
    .charAt(0)
    .toUpperCase();

function ConcRingIcon() {
  return (
    <svg
      className="cb-conc"
      viewBox="0 0 16 16"
      fill="none"
      aria-label="Concentration"
    >
      <circle cx="8" cy="8" r="5.4" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8" r="1.7" fill="currentColor" />
    </svg>
  );
}

interface ConditionChipProps {
  condKey: string;
  state: ConditionState;
  editing: boolean;
  colorByType: boolean;
  showDurations: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onUpdate: (patch: Partial<ConditionState>) => void;
}

function ConditionChip({
  condKey,
  state,
  editing,
  colorByType,
  showDurations,
  onEdit,
  onRemove,
  onUpdate,
}: ConditionChipProps) {
  const def = CB_BY_KEY[condKey];
  if (!def) return null;
  const color = colorByType ? CB_CAT_COLORS[def.cat] : "#c6a25c";
  const isInf = state.rounds == null;

  const setRounds = (n: number) =>
    onUpdate({ rounds: Math.max(1, Math.min(99, n)) });

  return (
    <div
      className={`cb-chip${editing ? " editing" : ""}`}
      style={{ "--c": color } as React.CSSProperties}
      onClick={(e) => {
        if ((e.target as Element).closest(".cb-x,.cb-editor")) return;
        onEdit();
      }}
    >
      <span className="cb-disc">{cbInitial(def.name)}</span>
      <span className="cb-cname">{def.name}</span>
      {state.conc && <ConcRingIcon />}
      {showDurations && (
        <span className={`cb-dur${isInf ? " inf" : ""}`}>
          {isInf ? "∞" : `${state.rounds} rd`}
          <span className="cb-dcaret">▾</span>
        </span>
      )}
      <button
        className="cb-x"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        ×
      </button>

      {!editing && (
        <div className="cb-tip">
          <div className="cb-tip-name">
            {def.name}
            <span className="cb-tip-dur">
              {isInf ? "Until removed" : `${state.rounds} rounds remaining`}
            </span>
          </div>
          <div className="cb-tip-eff">{def.eff}</div>
          {state.source && (
            <div className="cb-tip-src">
              Source: <b>{state.source}</b>
              {state.conc ? " · concentration" : ""}
            </div>
          )}
        </div>
      )}

      {editing && (
        <div className="cb-editor" onClick={(e) => e.stopPropagation()}>
          <div className="cb-ed-head">
            <span>Duration</span>
            <span className="cb-ed-cond">{def.name}</span>
          </div>
          <div className="cb-ed-seg">
            <button
              className={!isInf ? "sel" : ""}
              onClick={() => {
                if (isInf) onUpdate({ rounds: state._last ?? 3 });
              }}
            >
              Rounds
            </button>
            <button
              className={isInf ? "sel" : ""}
              onClick={() => {
                if (!isInf)
                  onUpdate({ _last: state.rounds ?? undefined, rounds: null });
              }}
            >
              ∞ Indef
            </button>
          </div>
          {!isInf ? (
            <>
              <div className="cb-stepper">
                <button onClick={() => setRounds((state.rounds ?? 1) - 1)}>
                  −
                </button>
                <div className="cb-num">
                  <span className="cb-nv">{state.rounds}</span>
                  <small>rounds</small>
                </div>
                <button onClick={() => setRounds((state.rounds ?? 0) + 1)}>
                  +
                </button>
              </div>
              <div className="cb-presets">
                {[1, 3, 5, 10].map((n) => (
                  <button key={n} onClick={() => onUpdate({ rounds: n })}>
                    {n}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="cb-ed-inf">Lasts until manually removed.</div>
          )}
          <button className="cb-ed-remove" onClick={onRemove}>
            Remove condition
          </button>
        </div>
      )}
    </div>
  );
}

interface ConditionsBarProps {
  stored: StoredChar;
  setStored: React.Dispatch<React.SetStateAction<StoredChar>>;
  colorByType: boolean;
  showDurations: boolean;
  emptyDot: boolean;
  comfy: boolean;
  buffBonuses?: ComputedChar["buffBonuses"];
}

function BuffBonusSummary({
  bb,
}: {
  bb: NonNullable<ComputedChar["buffBonuses"]>;
}) {
  const parts: { label: string; title?: string }[] = [];
  if (bb.attackBonus)
    parts.push({
      label: `Atk ${bb.attackBonus > 0 ? "+" : ""}${bb.attackBonus}`,
    });
  if (bb.attackDie) parts.push({ label: `Atk +${bb.attackDie}` });
  if (bb.damageBonus)
    parts.push({
      label: `Dmg ${bb.damageBonus > 0 ? "+" : ""}${bb.damageBonus}`,
    });
  if (bb.damageDie) parts.push({ label: `Dmg +${bb.damageDie}` });
  if (bb.saveBonus)
    parts.push({ label: `Save ${bb.saveBonus > 0 ? "+" : ""}${bb.saveBonus}` });
  if (bb.saveDie) parts.push({ label: `Save +${bb.saveDie}` });
  if (bb.skillDie) parts.push({ label: `Skill +${bb.skillDie}` });
  if (bb.dmgReductionDie) parts.push({ label: `−${bb.dmgReductionDie} taken` });
  if (bb.advantages.length > 0)
    parts.push({
      label: `Adv ×${bb.advantages.length}`,
      title: bb.advantages.join("\n"),
    });
  if (parts.length === 0) return null;
  return (
    <div className="cb-buff-summary">
      {parts.map((p, i) => (
        <span key={i} className="cb-buff-pill" title={p.title}>
          {p.label}
        </span>
      ))}
    </div>
  );
}

// ── Concentration badge (inline in conditions row) ────────────────────────────

function ConcBadge({
  stored,
  setStored,
}: {
  stored: StoredChar;
  setStored: React.Dispatch<React.SetStateAction<StoredChar>>;
}) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [editVal, setEditVal] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const spell = stored.concentratingOn;

  const openEdit = () => {
    setEditVal(spell ?? "");
    setEditOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commit = () => {
    const v = editVal.trim();
    setStored((s) => ({ ...s, concentratingOn: v || null }));
    setEditOpen(false);
  };

  if (!spell && !editOpen) {
    return (
      <button
        className="cb-conc-set"
        onClick={openEdit}
        title="Track concentration spell"
      >
        ⟳ Conc
      </button>
    );
  }

  if (editOpen) {
    return (
      <div className="cb-conc-edit">
        <input
          ref={inputRef}
          className="cb-conc-input"
          placeholder="Spell name…"
          value={editVal}
          onChange={(e) => setEditVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditOpen(false);
          }}
          onBlur={commit}
        />
      </div>
    );
  }

  return (
    <div className="cb-conc-badge">
      <span className="cb-conc-dot" />
      <span className="cb-conc-text">CONCENTRATING · {spell}</span>
      <button
        className="cb-x"
        onClick={() => {
          setStored((s) => ({ ...s, concentratingOn: null }));
        }}
      >
        ×
      </button>
    </div>
  );
}

function ConditionsBar({
  stored,
  setStored,
  colorByType,
  showDurations,
  emptyDot,
  comfy,
  buffBonuses,
}: ConditionsBarProps) {
  const [openEditor, setOpenEditor] = useState<string | null>(null);
  const [openBuffEditor, setOpenBuffEditor] = useState<string | null>(null);
  const [popOpen, setPopOpen] = useState(false);
  const [popTab, setPopTab] = useState<"conditions" | "buffs">("conditions");
  const [spellMetaMap, setSpellMetaMap] = useState<Record<string, SpellMeta>>(
    () => (REGISTRY?.spells ? buildSpellMetaMap(REGISTRY.spells) : {}),
  );
  const [spellsLoading, setSpellsLoading] = useState(false);
  const rowRef = React.useRef<HTMLDivElement>(null);

  const rawConds = stored.conditions as unknown;
  const conditions: Record<string, ConditionState> = Array.isArray(rawConds)
    ? {}
    : ((rawConds as Record<string, ConditionState>) ?? {});

  const activeBuffs: Record<string, ConditionState> = stored.activeBuffs ?? {};

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (!rowRef.current?.contains(e.target as Node)) {
        setOpenEditor(null);
        setOpenBuffEditor(null);
        setPopOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenEditor(null);
        setOpenBuffEditor(null);
        setPopOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const ensureSpellsLoaded = () => {
    if (REGISTRY?.spells) {
      if (Object.keys(spellMetaMap).length === 0)
        setSpellMetaMap(buildSpellMetaMap(REGISTRY.spells));
      return;
    }
    if (spellsLoading) return;
    setSpellsLoading(true);
    loadSpells().then(() => {
      if (REGISTRY?.spells) setSpellMetaMap(buildSpellMetaMap(REGISTRY.spells));
      setSpellsLoading(false);
    });
  };

  // ── Conditions ──────────────────────────────────────────────────────────────

  const setConditions = (updated: Record<string, ConditionState>) =>
    setStored((s) => ({ ...s, conditions: updated }));

  const toggleCondition = (key: string) => {
    const next = { ...conditions };
    if (next[key]) delete next[key];
    else next[key] = { source: "Added manually" };
    setConditions(next);
  };

  const removeCondition = (key: string) => {
    const next = { ...conditions };
    delete next[key];
    setConditions(next);
    if (openEditor === key) setOpenEditor(null);
  };

  const updateCondition = (key: string, patch: Partial<ConditionState>) =>
    setConditions({ ...conditions, [key]: { ...conditions[key], ...patch } });

  // ── Buffs ────────────────────────────────────────────────────────────────────

  const setBuffs = (updated: Record<string, ConditionState>) =>
    setStored((s) => ({ ...s, activeBuffs: updated }));

  const toggleBuff = (name: string, meta: SpellMeta | undefined) => {
    const next = { ...activeBuffs };
    if (next[name]) {
      delete next[name];
    } else {
      const entry = BUFF_ENTRY_MAP[name];
      next[name] = {
        conc: meta?.conc ?? false,
        rounds: null,
        castLevel: entry?.scalesWithSlot?.base,
      };
    }
    setBuffs(next);
  };

  const removeBuff = (name: string) => {
    const next = { ...activeBuffs };
    delete next[name];
    setBuffs(next);
    if (openBuffEditor === name) setOpenBuffEditor(null);
  };

  const updateBuff = (name: string, patch: Partial<ConditionState>) =>
    setBuffs({ ...activeBuffs, [name]: { ...activeBuffs[name], ...patch } });

  // ── Render ───────────────────────────────────────────────────────────────────

  const activeKeys = CB_CONDITIONS.map((c) => c.key).filter(
    (k) => k in conditions,
  );
  const count = activeKeys.length;
  const buffCount = Object.keys(activeBuffs).length;

  const chipH = comfy ? 34 : 30;
  const hasAnything = count > 0 || buffCount > 0 || stored.concentratingOn;

  return (
    <div
      ref={rowRef}
      className={`cb-row${!colorByType ? " no-color" : ""}${!emptyDot ? " no-dot" : ""}`}
      style={{ "--cb-chip-h": `${chipH}px` } as React.CSSProperties}
    >
      <div className="cb-label">
        Conditions
        <span className={`cb-count${count === 0 ? " zero" : ""}`}>{count}</span>
        {buffCount > 0 && (
          <span className="cb-buff-ct">
            {buffCount} buff{buffCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="cb-active-wrap">
        {!hasAnything ? (
          <div className="cb-empty">
            <span className="cb-pulse" />
            No active conditions
          </div>
        ) : (
          <>
            {activeKeys.map((k) => (
              <ConditionChip
                key={k}
                condKey={k}
                state={conditions[k]}
                editing={openEditor === k}
                colorByType={colorByType}
                showDurations={showDurations}
                onEdit={() => {
                  setPopOpen(false);
                  setOpenBuffEditor(null);
                  setOpenEditor(openEditor === k ? null : k);
                }}
                onRemove={() => removeCondition(k)}
                onUpdate={(patch) => updateCondition(k, patch)}
              />
            ))}
            {Object.entries(activeBuffs).map(([name, state]) => (
              <BuffChip
                key={`buff:${name}`}
                spellName={name}
                state={state}
                meta={spellMetaMap[name]}
                entry={BUFF_ENTRY_MAP[name]}
                editing={openBuffEditor === name}
                showDurations={showDurations}
                onEdit={() => {
                  setPopOpen(false);
                  setOpenEditor(null);
                  setOpenBuffEditor(openBuffEditor === name ? null : name);
                }}
                onRemove={() => removeBuff(name)}
                onUpdate={(patch) => updateBuff(name, patch)}
              />
            ))}
          </>
        )}
        {/* Concentration badge — shows after conditions */}
        <ConcBadge stored={stored} setStored={setStored} />
      </div>

      <button
        className={`cb-add${popOpen ? " open" : ""}`}
        onClick={() => {
          setOpenEditor(null);
          setOpenBuffEditor(null);
          setPopOpen((p) => !p);
        }}
      >
        <span className="cb-add-plus">+</span> Add
      </button>

      {buffBonuses && <BuffBonusSummary bb={buffBonuses} />}

      {popOpen && (
        <div className="cb-pop">
          <div className="cb-pop-tabs">
            <button
              className={`cb-pop-tab${popTab === "conditions" ? " sel" : ""}`}
              onClick={() => setPopTab("conditions")}
            >
              Conditions
            </button>
            <button
              className={`cb-pop-tab${popTab === "buffs" ? " sel" : ""}`}
              onClick={() => {
                setPopTab("buffs");
                ensureSpellsLoaded();
              }}
            >
              Buffs
            </button>
          </div>

          {popTab === "conditions" && (
            <>
              <div className="cb-pop-head">
                <span>Conditions</span>
                <span>BG3 set · click to toggle</span>
              </div>
              <div className="cb-pop-grid">
                {CB_CONDITIONS.map((cond) => (
                  <button
                    key={cond.key}
                    className={`cb-opt${conditions[cond.key] ? " on" : ""}`}
                    style={
                      {
                        "--c": colorByType
                          ? CB_CAT_COLORS[cond.cat]
                          : "#c6a25c",
                      } as React.CSSProperties
                    }
                    onClick={() => toggleCondition(cond.key)}
                  >
                    <span className="cb-odisc">{cbInitial(cond.name)}</span>
                    <span className="cb-oname">{cond.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {popTab === "buffs" && (
            <div className="cb-buff-levels">
              {spellsLoading ? (
                <div className="cb-buff-loading">Loading spell data…</div>
              ) : (
                Object.entries(TYPED_BUFF_LIST).map(([lvl, entries]) => {
                  if (entries.length === 0) return null;
                  return (
                    <div key={lvl} className="cb-buff-level">
                      <div className="cb-buff-level-hd">
                        {lvl === "Cantrip" ? "Cantrip" : `${lvl} Level`}
                      </div>
                      <div className="cb-pop-grid">
                        {entries.map((entry) => {
                          const { name: spellName, scalesWithSlot } = entry;
                          const meta = spellMetaMap[spellName];
                          const color =
                            SB_CAT_COLORS[meta?.schoolName ?? ""] ?? "#c6a25c";
                          const active = !!activeBuffs[spellName];
                          const hasValueScale =
                            !!scalesWithSlot &&
                            (!!scalesWithSlot.valuePerSlot ||
                              !!scalesWithSlot.thresholds) &&
                            !scalesWithSlot.affectsTargets;
                          return (
                            <button
                              key={spellName}
                              className={`cb-opt${active ? " on" : ""}`}
                              style={{ "--c": color } as React.CSSProperties}
                              onClick={() => toggleBuff(spellName, meta)}
                              title={
                                scalesWithSlot ? scalesWithSlot.note : undefined
                              }
                            >
                              <span className="cb-odisc">
                                {cbInitial(spellName)}
                              </span>
                              <span className="cb-oname">{spellName}</span>
                              {meta?.conc && <ConcRingIcon />}
                              {hasValueScale && (
                                <span className="cb-scale-badge">↑</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface Header5eProps {
  c: ComputedChar;
  stored: StoredChar;
  setStored: React.Dispatch<React.SetStateAction<StoredChar>>;
  rules: CampaignRules;
}

function Header5e({ c, stored, setStored, rules }: Header5eProps) {
  const [portraitOpen, setPortraitOpen] = useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      setStored((s) => ({ ...s, image: reader.result as string }));
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () =>
      setStored((s) => ({ ...s, image: reader.result as string }));
    reader.readAsDataURL(file);
  };

  return (
    <div className="top">
      <div
        className="top-left"
        style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
      >
        <div
          className="header-portrait-thumb"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          title={
            stored.image
              ? "Click to change portrait"
              : "Click or drag to upload portrait"
          }
        >
          {stored.image ? (
            <img
              src={stored.image}
              alt="Portrait"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                borderRadius: 4,
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: "var(--card-2)",
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-faint)",
                fontSize: 18,
              }}
            >
              ⚔
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleFile}
          />
        </div>
        <div>
          <div className="name">
            <span>{c.name}</span>
            {stored.image && (
              <button
                className="header-portrait-show-btn"
                onClick={() => setPortraitOpen(true)}
                title="Show portrait"
              >
                Show
              </button>
            )}
          </div>
          <div className="tags">
            {[c.classLabel, c.race, c.background].map((t, i, arr) => (
              <React.Fragment key={t}>
                <span>{t}</span>
                {i < arr.length - 1 && <span className="sep">·</span>}
              </React.Fragment>
            ))}
          </div>
          {(c.player || c.campaign) && (
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 9,
                color: "var(--text-faint)",
                letterSpacing: "0.1em",
                marginTop: 3,
              }}
            >
              {c.player && <span>{c.player}</span>}
              {c.player && c.campaign && (
                <span style={{ margin: "0 4px" }}>·</span>
              )}
              {c.campaign && <span>{c.campaign}</span>}
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <SessionPanel charId={stored.id} computed={c} currency={stored.currency} />
          </div>
        </div>
      </div>

      {/* Right cluster: Level | Prof Bonus | Inspiration */}
      <div className="hbar-stats">
        <div className="hbar-stat">
          <div className="hbar-lbl">LEVEL</div>
          <div className="hbar-val">{c.totalLevel}</div>
        </div>
        <div className="hbar-divider" />
        <div className="hbar-stat">
          <div className="hbar-lbl">PROF BONUS</div>
          <div className="hbar-val">+{c.proficiencyBonus}</div>
        </div>
        <div className="hbar-divider" />
        <PluginSlot
          slotId="inspiration"
          fallback={<InspirationButton stored={stored} setStored={setStored} />}
          c={c}
          stored={stored}
          setStored={setStored}
          rules={rules}
        />
      </div>

      {portraitOpen && stored.image && (
        <div
          className="portrait-modal-overlay"
          onClick={() => setPortraitOpen(false)}
        >
          <div className="portrait-modal" onClick={(e) => e.stopPropagation()}>
            <img
              src={stored.image}
              alt={c.name}
              className="portrait-modal-img"
            />
            <div className="portrait-modal-footer">
              <span
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: 16,
                  color: "var(--gold)",
                }}
              >
                {c.name}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="portrait-modal-btn"
                  onClick={() => {
                    fileRef.current?.click();
                  }}
                >
                  Change
                </button>
                <button
                  className="portrait-modal-btn portrait-modal-btn--danger"
                  onClick={() => {
                    setStored((s) => ({ ...s, image: null }));
                    setPortraitOpen(false);
                  }}
                >
                  Remove
                </button>
                <button
                  className="portrait-modal-btn"
                  onClick={() => setPortraitOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface HPCardProps {
  c: ComputedChar;
  setStored: React.Dispatch<React.SetStateAction<StoredChar>>;
}

function InspirationButton({
  stored,
  setStored,
}: {
  stored: StoredChar;
  setStored: React.Dispatch<React.SetStateAction<StoredChar>>;
}) {
  return (
    <button
      className={`hbar-insp${stored.inspiration ? " active" : ""}`}
      onClick={() => setStored((s) => ({ ...s, inspiration: !s.inspiration }))}
      title={stored.inspiration ? "Remove inspiration" : "Gain inspiration"}
    >
      <div className="hbar-lbl">INSPIRATION</div>
      <div className="hbar-pip" />
    </button>
  );
}

type HpRvMode = "normal" | "resist" | "vuln";

function HPCard5e({ c, setStored }: HPCardProps) {
  const v = c.hp;
  const pct = Math.max(0, Math.min(100, (v.current / v.max) * 100));
  const [amount, setAmount] = useState("");
  const [rvMode, setRvMode] = useState<HpRvMode>("normal");
  const [tempEdit, setTempEdit] = useState(false);
  const [tempVal, setTempVal] = useState("");

  const changeHP = (d: number) =>
    setStored((s) => ({
      ...s,
      hp: {
        ...s.hp,
        current: Math.max(0, Math.min(c.hp.max, s.hp.current + d)),
      },
    }));

  const applyHeal = () => {
    const n = parseInt(amount, 10);
    if (!n || n <= 0) return;
    setStored((s) => ({
      ...s,
      hp: { ...s.hp, current: Math.min(c.hp.max, s.hp.current + n) },
    }));
    setAmount("");
  };

  const applyDamage = () => {
    const raw = parseInt(amount, 10);
    if (!raw || raw <= 0) return;
    const n =
      rvMode === "resist"
        ? Math.floor(raw / 2)
        : rvMode === "vuln"
          ? raw * 2
          : raw;
    setStored((s) => {
      const absorbed = Math.min(s.hp.temp, n);
      const remainder = n - absorbed;
      return {
        ...s,
        hp: {
          ...s.hp,
          temp: s.hp.temp - absorbed,
          current: Math.max(0, s.hp.current - remainder),
        },
      };
    });
    setAmount("");
  };

  const handleAmountKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") applyDamage();
    if (e.key === "Escape") setAmount("");
  };

  const toggleRv = (mode: HpRvMode) =>
    setRvMode((cur) => (cur === mode ? "normal" : mode));

  const commitTemp = () => {
    const n = parseInt(tempVal, 10);
    setStored((s) => ({
      ...s,
      hp: { ...s.hp, temp: isNaN(n) ? 0 : Math.max(0, n) },
    }));
    setTempEdit(false);
    setTempVal("");
  };
  const handleTempKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") commitTemp();
    if (e.key === "Escape") {
      setTempEdit(false);
      setTempVal("");
    }
  };

  return (
    <div className="hp-card">
      <div className="hp-head">
        <span className="heart">
          <Icon kind="heart" size={12} />
        </span>{" "}
        Hit Points
      </div>
      <div className="hp-body">
        <div className="hp-main">
          <div className="hp-grid">
            <div className="hp-cell">
              <div className="lbl">Current</div>
              <div className="v">
                <span
                  className="pm"
                  style={{ cursor: "pointer" }}
                  onClick={() => changeHP(-1)}
                >
                  −
                </span>
                <span>{v.current}</span>
                <span
                  className="pm"
                  style={{ cursor: "pointer" }}
                  onClick={() => changeHP(1)}
                >
                  +
                </span>
              </div>
            </div>
            <div className="hp-slash">/</div>
            <div className="hp-cell">
              <div className="lbl">Max</div>
              <div className="v">
                <span>{v.max}</span>
              </div>
            </div>
            <div className="hp-cell">
              <div className="lbl">Temp</div>
              <div className="v">
                {tempEdit ? (
                  <input
                    className="hp-temp-input"
                    type="number"
                    min="0"
                    autoFocus
                    value={tempVal}
                    onChange={(e) => setTempVal(e.target.value)}
                    onKeyDown={handleTempKey}
                    onBlur={commitTemp}
                  />
                ) : (
                  <span
                    className="hp-temp-val"
                    onClick={() => {
                      setTempVal(String(v.temp));
                      setTempEdit(true);
                    }}
                    title="Click to set temp HP"
                  >
                    {v.temp}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="hp-bar-wrap">
            <div className="hp-bar" style={{ width: `${pct}%` }}></div>
          </div>
          <div className="hp-meta">
            <span>
              {v.current} / {v.max}
            </span>
            <span>{Math.round(pct)}%</span>
          </div>
        </div>

        <div className="hp-actions">
          <button className="hp-act-btn hp-act-heal" onClick={applyHeal}>
            Heal
          </button>
          <button className="hp-act-btn hp-act-dmg" onClick={applyDamage}>
            Damage
          </button>
          <input
            className="hp-act-amount"
            type="number"
            min="1"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={handleAmountKey}
          />
          <div className="hp-rv">
            <button
              type="button"
              className={`hp-rv-btn${rvMode === "resist" ? " active" : ""}`}
              onClick={() => toggleRv("resist")}
              title="Halve next damage amount"
            >
              Resist
            </button>
            <span className="hp-rv-divider">/</span>
            <button
              type="button"
              className={`hp-rv-btn hp-rv-btn--vuln${rvMode === "vuln" ? " active" : ""}`}
              onClick={() => toggleRv("vuln")}
              title="Double next damage amount"
            >
              Vuln.
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DeathSavesProps {
  stored: StoredChar;
  setStored: React.Dispatch<React.SetStateAction<StoredChar>>;
}

// ── Death saves with HEAL (shown in HP swap at 0 HP) ─────────────────────────

function DeathSavesSwapCard({ stored, setStored }: DeathSavesProps) {
  const [healVal, setHealVal] = React.useState("");
  const saves = stored.deathSaves;
  const set = (
    updater: (s: StoredChar["deathSaves"]) => StoredChar["deathSaves"],
  ) => setStored((s) => ({ ...s, deathSaves: updater(s.deathSaves) }));

  const doHeal = () => {
    const n = parseInt(healVal, 10);
    if (!n || n <= 0) return;
    setStored((s) => ({
      ...s,
      hp: { ...s.hp, current: n },
      deathSaves: { successes: 0, failures: 0 },
    }));
    setHealVal("");
  };

  return (
    <div className="hp-card ds-swap-card">
      <div className="hp-head" style={{ color: "var(--danger)" }}>
        <span className="heart">
          <Icon kind="skull" size={12} />
        </span>{" "}
        <span className="ds-unconscious-chip">UNCONSCIOUS</span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "8px 0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: "var(--vitality)",
              letterSpacing: "0.16em",
              width: 40,
            }}
          >
            SUCC
          </span>
          <div className="wound-pips">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="wound-pip"
                style={{
                  background:
                    i < saves.successes ? "var(--vitality)" : "transparent",
                  borderColor:
                    i < saves.successes ? "var(--vitality)" : "var(--border)",
                  cursor: "pointer",
                }}
                onClick={() =>
                  set((s) => ({ ...s, successes: i < s.successes ? i : i + 1 }))
                }
              />
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: "var(--danger)",
              letterSpacing: "0.16em",
              width: 40,
            }}
          >
            FAIL
          </span>
          <div className="wound-pips">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`wound-pip ${i < saves.failures ? "taken" : ""}`}
                style={{ cursor: "pointer" }}
                onClick={() =>
                  set((s) => ({ ...s, failures: i < s.failures ? i : i + 1 }))
                }
              />
            ))}
          </div>
        </div>
      </div>
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 8,
          color: "var(--text-faint)",
          letterSpacing: "0.1em",
          marginBottom: 8,
        }}
      >
        NAT 1 = 1 FAIL · NAT 20 = SUCCESS
      </div>
      <div className="ds-heal-row">
        <input
          className="ds-heal-input"
          type="number"
          min="1"
          placeholder="HP amount"
          value={healVal}
          onChange={(e) => setHealVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") doHeal();
          }}
        />
        <button
          className="ds-heal-btn"
          onClick={doHeal}
          disabled={!healVal || parseInt(healVal, 10) <= 0}
        >
          HEAL
        </button>
      </div>
    </div>
  );
}

// ── Plugin UI slot renderer ───────────────────────────────────────────────────

function PluginSlot({
  slotId,
  fallback,
  c,
  stored,
  setStored,
  rules,
}: {
  slotId: UISlotId;
  fallback: React.ReactNode;
  c: ComputedChar;
  stored: StoredChar;
  setStored: React.Dispatch<React.SetStateAction<StoredChar>>;
  rules: CampaignRules;
}) {
  const slot = PluginRegistry.getSlot(slotId);
  if (!slot) return <>{fallback}</>;
  const { pluginId, component: Comp } = slot;
  const pluginData = stored.pluginData?.[pluginId] ?? {};
  const setPluginData = (patch: Record<string, unknown>) =>
    setStored((s) => ({
      ...s,
      pluginData: {
        ...s.pluginData,
        [pluginId]: { ...(s.pluginData?.[pluginId] ?? {}), ...patch },
      },
    }));
  return (
    <Comp
      c={c}
      stored={stored}
      setStored={setStored}
      rules={rules}
      pluginData={pluginData}
      setPluginData={setPluginData}
    />
  );
}

// ── Traditional Hit Dice + Rest (default behavior) ───────────────────────────

const CLASS_HIT_DIE_FALLBACK: Record<string, number> = {
  Barbarian: 12,
  Fighter: 10,
  Paladin: 10,
  Ranger: 10,
  Monk: 8,
  Bard: 8,
  Cleric: 8,
  Druid: 8,
  Rogue: 8,
  Warlock: 8,
  Sorcerer: 6,
  Wizard: 6,
};

const HD_SIDES = [6, 8, 10, 12] as const;
type HDSides = (typeof HD_SIDES)[number];
function hdKey(s: HDSides): "d6" | "d8" | "d10" | "d12" {
  return `d${s}` as "d6" | "d8" | "d10" | "d12";
}

function hdMaxByDie(stored: StoredChar): Partial<Record<HDSides, number>> {
  const max: Partial<Record<HDSides, number>> = {};
  for (const cls of stored.classes) {
    const sides = (REGISTRY?.classes?.[cls.name]?.hitDie ??
      CLASS_HIT_DIE_FALLBACK[cls.name] ??
      8) as HDSides;
    max[sides] = (max[sides] ?? 0) + cls.level;
  }
  return max;
}

interface DefaultRestPanelProps {
  c: ComputedChar;
  stored: StoredChar;
  setStored: React.Dispatch<React.SetStateAction<StoredChar>>;
}

function DefaultHitDiceRestPanel({
  c,
  stored,
  setStored,
}: DefaultRestPanelProps) {
  const [isResting, setIsResting] = useState(false);
  const [lastRoll, setLastRoll] = useState<{
    die: number;
    rolled: number;
    heal: number;
  } | null>(null);
  const [dieSpentThisRest, setDieSpentThisRest] = useState(false);
  const initRan = React.useRef(false);
  const conMod = c.abilities.CON.mod;

  const maxByDie = hdMaxByDie(stored);
  const rem = stored.hitDiceRemaining;
  const remByDie: Record<HDSides, number> = {
    6: rem.d6,
    8: rem.d8,
    10: rem.d10,
    12: rem.d12,
  };
  const totalMax = HD_SIDES.reduce((a, d) => a + (maxByDie[d] ?? 0), 0);
  const totalRem = HD_SIDES.reduce((a, d) => a + remByDie[d], 0);

  // Auto-init hitDiceRemaining if all zero but character has classes
  useEffect(() => {
    if (initRan.current) return;
    initRan.current = true;
    const max = hdMaxByDie(stored);
    const needsInit = HD_SIDES.some(
      (s) => (max[s] ?? 0) > 0 && stored.hitDiceRemaining[hdKey(s)] === 0,
    );
    if (needsInit) {
      setStored((s) => ({
        ...s,
        hitDiceRemaining: {
          d6: max[6] ?? 0,
          d8: max[8] ?? 0,
          d10: max[10] ?? 0,
          d12: max[12] ?? 0,
        },
      }));
    }
  }, []); // intentional empty deps — one-time init

  const spendDie = (sides: HDSides) => {
    if (remByDie[sides] <= 0) return;
    const rolled = Math.floor(Math.random() * sides) + 1;
    const heal = Math.max(1, rolled + conMod);
    const key = hdKey(sides);
    setStored((s) => ({
      ...s,
      hp: { ...s.hp, current: Math.min(c.hp.max, s.hp.current + heal) },
      hitDiceRemaining: {
        ...s.hitDiceRemaining,
        [key]: Math.max(0, s.hitDiceRemaining[key] - 1),
      },
    }));
    setLastRoll({ die: sides, rolled, heal });
    setDieSpentThisRest(true);
  };

  const endRest = () => {
    if (dieSpentThisRest) {
      setStored((s) => {
        const newActionUses = { ...(s.resources.actionUses ?? {}) };
        for (const def of ACTION_DEFS) {
          if (def.resetOn === "short") delete newActionUses[def.id];
        }
        return {
          ...s,
          resources: {
            ...s.resources,
            kiPoints:
              s.resources.kiPoints !== null
                ? (c.resources.kiPoints?.max ?? null)
                : null,
            pactSlots: s.resources.pactSlots !== null ? { used: 0 } : null,
            custom: (s.resources.custom ?? []).map((r) =>
              r.resetOn === "short" ? { ...r, current: r.max } : r,
            ),
            actionUses: newActionUses,
          },
        };
      });
    }
    setIsResting(false);
    setLastRoll(null);
    setDieSpentThisRest(false);
  };

  const doLongRest = () => {
    setIsResting(false);
    setLastRoll(null);
    setDieSpentThisRest(false);
    setStored((s) => ({
      ...s,
      hp: { ...s.hp, current: c.hp.max, temp: 0 },
      hitDiceRemaining: {
        d6: maxByDie[6] ?? 0,
        d8: maxByDie[8] ?? 0,
        d10: maxByDie[10] ?? 0,
        d12: maxByDie[12] ?? 0,
      },
      spellcasting: {
        ...s.spellcasting,
        slotsUsed: {} as Record<number, number>,
      },
      resources: {
        ...s.resources,
        kiPoints:
          s.resources.kiPoints !== null
            ? (c.resources.kiPoints?.max ?? null)
            : null,
        bardicInspiration:
          s.resources.bardicInspiration !== null
            ? { current: c.resources.bardicInspiration?.max ?? 0 }
            : null,
        rages:
          s.resources.rages !== null ? (c.resources.rages?.max ?? 0) : null,
        sorceryPoints:
          s.resources.sorceryPoints !== null
            ? (c.resources.sorceryPoints?.max ?? 0)
            : null,
        pactSlots: s.resources.pactSlots !== null ? { used: 0 } : null,
        custom: (s.resources.custom ?? []).map((r) => ({
          ...r,
          current: r.max,
        })),
        actionUses: {},
      },
      deathSaves: { successes: 0, failures: 0 },
      shortRestsUsed: 0,
    }));
  };

  const mono: React.CSSProperties = {
    fontFamily: "var(--mono)",
    fontSize: 8,
    letterSpacing: "0.08em",
  };
  const btnBase: React.CSSProperties = {
    ...mono,
    background: "none",
    border: "1px solid var(--border)",
    borderRadius: 3,
    padding: "2px 6px",
    cursor: "pointer",
    width: "100%",
    color: "var(--text-faint)",
  };

  return (
    <div className="side-stat hd-rest-panel">
      <div
        className="hd"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Dices size={13} strokeWidth={1.6} /> Hit Dice
        </span>
        <span
          style={{
            ...mono,
            color:
              totalRem === 0 && totalMax > 0
                ? "var(--danger)"
                : "var(--text-faint)",
          }}
        >
          {totalRem}/{totalMax}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 5,
          marginBottom: 6,
        }}
      >
        {HD_SIDES.map((sides) => {
          const maxCount = maxByDie[sides] ?? 0;
          if (maxCount === 0) return null;
          const remaining = remByDie[sides];
          return (
            <div
              key={sides}
              style={{ display: "flex", alignItems: "center", gap: 4 }}
            >
              <span
                style={{
                  ...mono,
                  color: "var(--text-faint)",
                  width: 16,
                  flexShrink: 0,
                }}
              >
                d{sides}
              </span>
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                {Array.from({ length: maxCount }, (_, i) => {
                  const filled = i < remaining;
                  const clickable = isResting && filled;
                  return (
                    <div
                      key={i}
                      onClick={() => clickable && spendDie(sides)}
                      title={
                        clickable
                          ? `Spend 1d${sides} + CON ${conMod >= 0 ? "+" : ""}${conMod}`
                          : filled
                            ? "Available"
                            : "Spent"
                      }
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 2,
                        border: `2px solid ${filled ? "var(--gold)" : "var(--border-faint)"}`,
                        background: filled ? "var(--gold-dim)" : "transparent",
                        cursor: clickable ? "pointer" : "default",
                        transition: "all 0.1s",
                        opacity: isResting
                          ? filled
                            ? 1
                            : 0.35
                          : filled
                            ? 0.9
                            : 0.35,
                        boxShadow: clickable
                          ? "0 0 4px var(--gold-dim)"
                          : "none",
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
        {totalMax === 0 && (
          <span
            style={{ ...mono, color: "var(--text-faint)", fontStyle: "italic" }}
          >
            no classes loaded
          </span>
        )}
      </div>

      {lastRoll && (
        <div style={{ ...mono, color: "var(--vitality)", marginBottom: 5 }}>
          1d{lastRoll.die} → {lastRoll.rolled} {conMod >= 0 ? "+" : ""}
          {conMod !== 0 ? conMod : ""} = +{lastRoll.heal} HP
        </div>
      )}

      {!isResting ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button
            onClick={() => {
              if (totalRem > 0) setIsResting(true);
            }}
            disabled={totalRem === 0}
            style={{
              ...btnBase,
              color: totalRem > 0 ? "var(--gold)" : "var(--text-faint)",
              borderColor: totalRem > 0 ? "var(--gold-dim)" : "var(--border)",
              opacity: totalRem === 0 ? 0.4 : 1,
            }}
            title={
              totalRem === 0
                ? "No hit dice remaining"
                : "Short rest: spend hit dice to heal"
            }
          >
            SHORT REST
          </button>
          <button
            className="rest-btn"
            onClick={doLongRest}
            style={{ width: "100%", padding: "4px 8px" }}
          >
            <div className="name" style={{ fontSize: 10 }}>
              Long Rest
            </div>
            <div className="sub">HP + slots + all hit dice</div>
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div
            style={{
              ...mono,
              color: dieSpentThisRest ? "var(--vitality)" : "var(--gold)",
              textAlign: "center",
              marginBottom: 1,
            }}
          >
            {dieSpentThisRest
              ? "die spent — abilities reset"
              : "click pip to spend"}
          </div>
          <button
            onClick={endRest}
            style={{
              ...btnBase,
              color: "var(--vitality)",
              borderColor: "var(--vitality)",
            }}
          >
            DONE RESTING
          </button>
          <button
            onClick={() => {
              setIsResting(false);
              setDieSpentThisRest(false);
            }}
            style={btnBase}
          >
            CANCEL
          </button>
        </div>
      )}

      <div className="amb-meta" style={{ marginTop: 6 }}>
        <span style={{ fontStyle: "italic", fontSize: 8 }}>
          {isResting
            ? `CON ${conMod >= 0 ? "+" : ""}${conMod} per die · done resets ki & abilities`
            : "traditional 5e · spend dice to heal"}
        </span>
      </div>
    </div>
  );
}

// ── Tabs config ───────────────────────────────────────────────────────────────

const TABS_5E = [
  { id: "combat", label: "Combat", icon: "swords" },
  { id: "features", label: "Features", icon: "path" },
  { id: "inventory", label: "Inventory", icon: "inventory" },
  { id: "spellcasting", label: "Spellcasting", icon: "spellcasting" },
  { id: "vassals", label: "Vassals", icon: "skull" },
  { id: "notes", label: "Notes", icon: "note" },
];

// ── Root app ──────────────────────────────────────────────────────────────────

export function App5e() {
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [tweaks, setTweak] = useTweaks({
    lightMode: false,
    compactSkills: false,
    showKg: true,
    vassalAnimalFriendship: true,
    condColorByType: true,
    condShowDurations: true,
    condEmptyDot: true,
    condComfy: false,
    density: "compact",
    inventoryView: "list",
  });

  useEffect(() => {
    document.documentElement.classList.toggle(
      "light",
      tweaks.lightMode as boolean,
    );
  }, [tweaks.lightMode]);
  const [tab, setTab] = useState("features");
  const [registryReady, setRegistryReady] = useState(REGISTRY !== null);
  const [itemsReady, setItemsReady] = useState(!!REGISTRY?.items);
  const [bestiaryReady, setBestiaryReady] = useState(!!REGISTRY?.bestiary);
  const [stored, setStored] = useState<StoredChar>(
    () => CharStorage.getActiveChar() ?? DEFAULT_STORED,
  );
  const [rules] = useState(() => loadRules());
  const [pluginTick, setPluginTick] = useState(0);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstStoredRender = useRef(true);

  useEffect(() => {
    const handler = () => setPluginTick((t) => t + 1);
    window.addEventListener("bg3:plugin-changed", handler);
    return () => window.removeEventListener("bg3:plugin-changed", handler);
  }, []);

  useEffect(() => {
    if (registryReady) return;
    REGISTRY_PROMISE.then(() => setRegistryReady(true));
  }, [registryReady]);

  useEffect(() => {
    if (itemsReady) return;
    loadItems().then(() => setItemsReady(true));
  }, [itemsReady]);

  useEffect(() => {
    if (bestiaryReady || tab !== "vassals") return;
    loadBestiary().then(() => setBestiaryReady(true));
  }, [tab, bestiaryReady]);

  const c = useMemo(
    () => applyBuffs(computeCharacter(stored, rules), stored),
    [stored, rules, registryReady, itemsReady, pluginTick],
  );

  useEffect(() => {
    CharStorage.saveChar(stored);
  }, [stored]);

  // Debounced 10s push to Drive on sheet changes — skip if no live token (avoids popup)
  useEffect(() => {
    if (isFirstStoredRender.current) {
      isFirstStoredRender.current = false;
      return;
    }
    if (!getDriveState().connected || !hasValidToken()) return;
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      syncPush(DRIVE_CLIENT_ID, CharStorage.getRoster()).catch(() => {
        /* silent — no sync UI on sheet */
      });
    }, 10_000);
    return () => {
      if (pushTimerRef.current) {
        clearTimeout(pushTimerRef.current);
        pushTimerRef.current = null;
      }
    };
  }, [stored]);

  if (!registryReady) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            fontFamily: "var(--serif)",
            fontSize: 28,
            color: "var(--gold)",
            fontStyle: "italic",
          }}
        >
          Loading data…
        </div>
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            color: "var(--text-faint)",
            letterSpacing: "0.12em",
          }}
        >
          FETCHING 5E SOURCE FILES
        </div>
      </div>
    );
  }

  const pluginTabs = PluginRegistry.getExtraTabs();
  const tabs = [
    ...TABS_5E,
    ...pluginTabs.map((t) => ({
      id: t.id,
      label: t.label,
      icon: t.icon ?? "star",
    })),
  ];

  // ── Plugin slot detection (for compat branching) ──────────────────────────
  const hasDeathSavesPlugin = PluginRegistry.getSlot("deathSaves") !== null;
  const hasHitDicePlugin = PluginRegistry.getSlot("hitDice") !== null;
  const hasRestPlugin = PluginRegistry.getSlot("rest") !== null;

  return (
    <div className="sheet">
      {/* ── Unified character bar: nav + identity + conditions ── */}
      <div className="char-bar">
        {/* Breadcrumb nav row */}
        <div className="char-bar-crumbs">
          <button
            className="char-bar-crumb"
            onClick={() => {
              if (getDriveState().connected && hasValidToken()) {
                if (pushTimerRef.current) {
                  clearTimeout(pushTimerRef.current);
                  pushTimerRef.current = null;
                }
                syncPush(DRIVE_CLIENT_ID, CharStorage.getRoster())
                  .catch(() => {})
                  .finally(() => {
                    window.location.href = "index.html";
                  });
              } else {
                window.location.href = "index.html";
              }
            }}
          >
            ← MY CHARACTERS
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              className="char-bar-crumb"
              onClick={() => {
                CharStorage.setActiveId(stored.id);
                window.location.href = "builder.html";
              }}
            >
              EDIT IN BUILDER →
            </button>
            <button
              className={`char-bar-settings${settingsOpen ? " open" : ""}`}
              onClick={() => setSettingsOpen((v) => !v)}
              title="Settings"
            >
              ⚙
            </button>
          </div>
        </div>

        {/* Identity row */}
        <Header5e c={c} stored={stored} setStored={setStored} rules={rules} />

        {/* Conditions row */}
        <ConditionsBar
          stored={stored}
          setStored={setStored}
          colorByType={tweaks.condColorByType as boolean}
          showDurations={tweaks.condShowDurations as boolean}
          emptyDot={tweaks.condEmptyDot as boolean}
          comfy={tweaks.condComfy as boolean}
          buffBonuses={c.buffBonuses}
        />
      </div>

      <div className="layout">
        <div className="col">
          <LeftRail5e c={c} />
        </div>

        <div className="col">
          <div className="stat-row">
            <StatCard
              icon={<Icon kind="shield" size={11} />}
              label="Armor Class"
              value={c.ac}
              sub={c.acSource}
            />
            <StatCard
              icon={<Icon kind="bolt" size={11} />}
              label="Initiative"
              value={
                c.initiative === 0
                  ? `d${c.initiativeDie}`
                  : `d${c.initiativeDie}+${c.initiative}`
              }
              sub="roll + flat bonus"
            />
            <StatCard
              icon={<Icon kind="boot" size={11} />}
              label="Speed"
              value={`${c.speedFt}ft`}
              sub={`${c.speed}m`}
            />
            <StatCard
              icon={<Icon kind="prof-icon" size={11} />}
              label="Prof Bonus"
              value={`+${c.proficiencyBonus}`}
              sub={`level ${c.totalLevel}`}
            />
          </div>

          <div className="center-vitals">
            {/* ── Column 1: HP card ↔ Death Saves swap ── */}
            <div>
              {hasDeathSavesPlugin ? (
                <>
                  <PluginSlot
                    slotId="hitPoints"
                    fallback={<HPCard5e c={c} setStored={setStored} />}
                    c={c}
                    stored={stored}
                    setStored={setStored}
                    rules={rules}
                  />
                  <div style={{ marginTop: 12 }}>
                    <PluginSlot
                      slotId="deathSaves"
                      fallback={null}
                      c={c}
                      stored={stored}
                      setStored={setStored}
                      rules={rules}
                    />
                  </div>
                </>
              ) : c.hp.current <= 0 ? (
                <DeathSavesSwapCard stored={stored} setStored={setStored} />
              ) : (
                <PluginSlot
                  slotId="hitPoints"
                  fallback={<HPCard5e c={c} setStored={setStored} />}
                  c={c}
                  stored={stored}
                  setStored={setStored}
                  rules={rules}
                />
              )}
            </div>

            {/* ── Column 2: Hit Dice + Rest (traditional default; plugin override if active) ── */}
            <div className="center-vitals-col">
              {hasHitDicePlugin || hasRestPlugin ? (
                <>
                  <PluginSlot
                    slotId="hitDice"
                    fallback={null}
                    c={c}
                    stored={stored}
                    setStored={setStored}
                    rules={rules}
                  />
                  <PluginSlot
                    slotId="rest"
                    fallback={null}
                    c={c}
                    stored={stored}
                    setStored={setStored}
                    rules={rules}
                  />
                </>
              ) : (
                <DefaultHitDiceRestPanel
                  c={c}
                  stored={stored}
                  setStored={setStored}
                />
              )}
            </div>
          </div>

          <div>
            <div className="tabs">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  className={`tab ${tab === t.id ? "active" : ""}`}
                  onClick={() => setTab(t.id)}
                >
                  <span className="ic">
                    <Icon kind={t.icon} size={11} />
                  </span>
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              {tab === "combat" && (
                <CombatTab5e c={c} stored={stored} setStored={setStored} />
              )}
              {tab === "features" && (
                <FeaturesTab5e
                  c={c}
                  stored={stored}
                  setStored={setStored}
                  density={tweaks.density as string}
                />
              )}
              {tab === "inventory" && (
                <InventoryTab5e
                  c={c}
                  showKg={tweaks.showKg}
                  stored={stored}
                  setStored={setStored}
                  density={tweaks.density as string}
                  inventoryView={tweaks.inventoryView as string}
                  onViewChange={(v) => setTweak("inventoryView", v)}
                />
              )}
              {tab === "spellcasting" && (
                <SpellcastingTab5e
                  c={c}
                  stored={stored}
                  setStored={setStored}
                />
              )}
              {tab === "vassals" && (
                <VassalsTab
                  c={c}
                  stored={stored}
                  setStored={setStored}
                  animalFriendshipRequired={tweaks.vassalAnimalFriendship}
                />
              )}
              {tab === "notes" && (
                <NotesTab5e
                  c={c}
                  stored={stored}
                  setStored={setStored}
                  rules={rules}
                />
              )}
              {pluginTabs.map((tabDef) => {
                if (tab !== tabDef.id) return null;
                const Comp = tabDef.component;
                const pluginData = stored.pluginData?.[tabDef.pluginId] ?? {};
                const setPluginData = (patch: Record<string, unknown>) =>
                  setStored((s) => ({
                    ...s,
                    pluginData: {
                      ...s.pluginData,
                      [tabDef.pluginId]: { ...pluginData, ...patch },
                    },
                  }));
                return (
                  <Comp
                    key={tabDef.id}
                    c={c}
                    stored={stored}
                    setStored={setStored}
                    rules={rules}
                    pluginData={pluginData}
                    setPluginData={setPluginData}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <div className="col">
          <RightRail5e c={c} stored={stored} setStored={setStored} />
        </div>
      </div>

      <TweaksPanel
        title="Settings"
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      >
        <PluginSection />
        <TweakSection label="Display">
          <TweakToggle
            label="Light mode"
            value={tweaks.lightMode as boolean}
            onChange={(v) => setTweak("lightMode", v)}
          />
          <TweakToggle
            label="Weight in kg"
            value={tweaks.showKg}
            onChange={(v) => setTweak("showKg", v)}
          />
          <TweakToggle
            label="Comfortable density"
            value={tweaks.density === "comfortable"}
            onChange={(v) => setTweak("density", v ? "comfortable" : "compact")}
          />
        </TweakSection>
        <TweakSection label="Vassals">
          <TweakToggle
            label="Require Animal Friendship"
            value={tweaks.vassalAnimalFriendship}
            onChange={(v) => setTweak("vassalAnimalFriendship", v)}
          />
        </TweakSection>
        <TweakSection label="Conditions Bar">
          <TweakToggle
            label="Color by type"
            value={tweaks.condColorByType as boolean}
            onChange={(v) => setTweak("condColorByType", v)}
          />
          <TweakToggle
            label="Show durations"
            value={tweaks.condShowDurations as boolean}
            onChange={(v) => setTweak("condShowDurations", v)}
          />
          <TweakToggle
            label="Pulse dot (healthy)"
            value={tweaks.condEmptyDot as boolean}
            onChange={(v) => setTweak("condEmptyDot", v)}
          />
          <TweakToggle
            label="Comfortable density"
            value={tweaks.condComfy as boolean}
            onChange={(v) => setTweak("condComfy", v)}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}
