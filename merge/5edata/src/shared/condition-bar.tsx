// Shared player-style condition bar (the "cb-*" UI).
// Used by the Vassals tab (player sheet) and the GM encounter tracker so both
// edit conditions the same way: toggle, per-condition duration, tooltips.

import React from "react";
import type { ConditionState } from "../core/types";

export const COND_CAT_COLORS: Record<string, string> = {
  fire: "#e0623d",
  poison: "#5fae6b",
  sense: "#5f94d6",
  mind: "#d877ab",
  control: "#9d80dd",
  hinder: "#cf9a4e",
  arcane: "#54bdc9",
};

export const COND_DEFS = [
  {
    name: "Blinded",
    cat: "sense",
    eff: "Can't see. Attack rolls have disadvantage; attacks against you have advantage.",
  },
  {
    name: "Burning",
    cat: "fire",
    eff: "Takes fire damage at the start of each turn until the flames are extinguished.",
  },
  {
    name: "Charmed",
    cat: "mind",
    eff: "Can't attack the charmer, who has advantage on social interactions with you.",
  },
  {
    name: "Downed",
    cat: "control",
    eff: "Unconscious and dying. Make a death saving throw at the start of each turn.",
  },
  {
    name: "Encumbered",
    cat: "hinder",
    eff: "Carrying too much weight. Movement speed is reduced.",
  },
  {
    name: "Ensnared",
    cat: "hinder",
    eff: "Held fast in place. Speed is 0 until you succeed on a check to break free.",
  },
  {
    name: "Enwebbed",
    cat: "hinder",
    eff: "Caught in webbing. Speed is 0 and you have disadvantage on attack rolls.",
  },
  {
    name: "Fearful",
    cat: "mind",
    eff: "Compelled to move away from the source of fear and can't willingly approach it.",
  },
  {
    name: "Frightened",
    cat: "mind",
    eff: "Disadvantage on ability checks and attacks while the source is in line of sight.",
  },
  {
    name: "Grappled",
    cat: "control",
    eff: "Speed is 0. Ends if the grappler is incapacitated or you are moved away.",
  },
  {
    name: "Heavily Encumbered",
    cat: "hinder",
    eff: "Severely overloaded. Speed greatly reduced; disadvantage on attacks, checks and saves.",
  },
  {
    name: "Invisible",
    cat: "arcane",
    eff: "Can't be seen. Your attacks have advantage; attacks against you have disadvantage.",
  },
  {
    name: "Paralyzed",
    cat: "control",
    eff: "Incapacitated, can't move or speak. Melee hits against you are critical.",
  },
  {
    name: "Poisoned",
    cat: "poison",
    eff: "Disadvantage on attack rolls and ability checks.",
  },
  {
    name: "Prone",
    cat: "control",
    eff: "Disadvantage on attacks. Melee attacks against you have advantage; ranged have disadvantage.",
  },
  {
    name: "Restrained",
    cat: "control",
    eff: "Speed 0. Disadvantage on attacks and Dex saves; attacks against you have advantage.",
  },
  {
    name: "Silenced",
    cat: "sense",
    eff: "Can't cast spells that require verbal components.",
  },
  {
    name: "Sleeping",
    cat: "control",
    eff: "Unconscious. Wakes if it takes damage or someone uses an action to shake it awake.",
  },
  {
    name: "Slowed",
    cat: "hinder",
    eff: "−2 to AC and Dex saves. Speed halved, no reactions.",
  },
  {
    name: "Stunned",
    cat: "control",
    eff: "Incapacitated, can't move, and can speak only falteringly. Attacks against you have advantage.",
  },
  {
    name: "Turned",
    cat: "arcane",
    eff: "Must flee from the source and can't take reactions or willingly move closer.",
  },
  {
    name: "Wet",
    cat: "arcane",
    eff: "Vulnerable to Cold and Lightning damage; resistant to Fire damage.",
  },
] as const;

export function CondBar({
  conditions: rawConditions,
  onChange,
}: {
  conditions: Record<string, ConditionState> | string[];
  onChange: (next: Record<string, ConditionState>) => void;
}) {
  // migrate legacy string[] to Record<string, ConditionState>
  const conditions: Record<string, ConditionState> = Array.isArray(
    rawConditions,
  )
    ? Object.fromEntries((rawConditions as string[]).map((n) => [n, {}]))
    : ((rawConditions as Record<string, ConditionState>) ?? {});

  const [openEditor, setOpenEditor] = React.useState<string | null>(null);
  const [popOpen, setPopOpen] = React.useState(false);
  const [tipName, setTipName] = React.useState<string | null>(null);
  // Fixed-viewport coords for the floating panels so they escape any
  // overflow:hidden ancestor (GM cards, list-card, etc.).
  const [popPos, setPopPos] = React.useState<{ top: number; right: number } | null>(null);
  const [editorPos, setEditorPos] = React.useState<{ top: number; left: number } | null>(null);
  const longPressRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const barRef = React.useRef<HTMLDivElement>(null);

  const closeAll = () => {
    setOpenEditor(null);
    setPopOpen(false);
    setTipName(null);
    setPopPos(null);
    setEditorPos(null);
  };

  React.useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      const t = e.target as Node;
      if (barRef.current?.contains(t)) return;
      // Clicks inside a floating panel (rendered under .cb-row but positioned
      // fixed) are still inside barRef, so this only fires for true outside clicks.
      closeAll();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    const onScroll = () => closeAll();
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const placeEditor = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const half = 117; // ~half of the 228px editor + arrow padding
    const left = Math.max(half + 8, Math.min(window.innerWidth - half - 8, r.left + r.width / 2));
    setEditorPos({ top: r.bottom + 10, left });
  };
  const placePop = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setPopPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
  };

  const startLongPress = (name: string) => {
    longPressRef.current = setTimeout(() => setTipName(name), 500);
  };
  const cancelLongPress = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  const toggle = (name: string) => {
    const next = { ...conditions };
    if (next[name]) delete next[name];
    else next[name] = {};
    onChange(next);
  };

  const remove = (name: string) => {
    const next = { ...conditions };
    delete next[name];
    onChange(next);
    if (openEditor === name) setOpenEditor(null);
  };

  const update = (name: string, patch: Partial<ConditionState>) =>
    onChange({ ...conditions, [name]: { ...conditions[name], ...patch } });

  const getColor = (name: string) => {
    const def = COND_DEFS.find((d) => d.name === name);
    return def ? COND_CAT_COLORS[def.cat] : "var(--gold-dim)";
  };

  const activeNames = Object.keys(conditions);
  const count = activeNames.length;

  return (
    <div
      ref={barRef}
      className="cb-row"
      style={{
        borderTop: "1px solid var(--border-soft)",
        padding: "8px 16px 6px",
        margin: 0,
      }}
    >
      <div className="cb-label">
        Conditions
        <span className={`cb-count${count === 0 ? " zero" : ""}`}>{count}</span>
      </div>
      <div className="cb-active-wrap">
        {count === 0 ? (
          <div className="cb-empty" style={{ fontSize: 10 }}>
            <span className="cb-pulse" />
            None
          </div>
        ) : (
          activeNames.map((name) => {
            const color = getColor(name);
            const state = conditions[name];
            const isInf = state.rounds == null;
            const editing = openEditor === name;
            const def = COND_DEFS.find((d) => d.name === name);
            const setRounds = (n: number) =>
              update(name, { rounds: Math.max(1, Math.min(99, n)) });
            return (
              <div
                key={name}
                className={`cb-chip${editing ? " editing" : ""}${tipName === name ? " tip-open" : ""}`}
                style={{ "--c": color } as React.CSSProperties}
                onClick={(e) => {
                  if ((e.target as Element).closest(".cb-x,.cb-editor")) return;
                  setTipName(null);
                  setPopOpen(false);
                  setPopPos(null);
                  if (editing) {
                    setOpenEditor(null);
                    setEditorPos(null);
                  } else {
                    setOpenEditor(name);
                    placeEditor(e.currentTarget as HTMLElement);
                  }
                }}
                onTouchStart={() => startLongPress(name)}
                onTouchEnd={cancelLongPress}
                onTouchMove={cancelLongPress}
              >
                <span className="cb-disc">
                  {name
                    .replace(/[^A-Za-z]/g, "")
                    .charAt(0)
                    .toUpperCase()}
                </span>
                <span className="cb-cname">{name}</span>
                <span className={`cb-dur${isInf ? " inf" : ""}`}>
                  {isInf ? "∞" : `${state.rounds} rd`}
                  <span className="cb-dcaret">▾</span>
                </span>
                <button
                  className="cb-x"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(name);
                  }}
                >
                  ×
                </button>
                {def && (
                  <div className="cb-tip">
                    <div className="cb-tip-name">{name}</div>
                    <div className="cb-tip-eff">{def.eff}</div>
                  </div>
                )}
                {editing && editorPos && (
                  <div
                    className="cb-editor"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: "fixed",
                      top: editorPos.top,
                      left: editorPos.left,
                      transform: "translateX(-50%)",
                    }}
                  >
                    <div className="cb-ed-head">
                      <span>Duration</span>
                      <span className="cb-ed-cond">{name}</span>
                    </div>
                    <div className="cb-ed-seg">
                      <button
                        className={!isInf ? "sel" : ""}
                        onClick={() => {
                          if (isInf) update(name, { rounds: state._last ?? 3 });
                        }}
                      >
                        Rounds
                      </button>
                      <button
                        className={isInf ? "sel" : ""}
                        onClick={() => {
                          if (!isInf)
                            update(name, {
                              _last: state.rounds ?? undefined,
                              rounds: null,
                            });
                        }}
                      >
                        ∞ Indef
                      </button>
                    </div>
                    {!isInf ? (
                      <>
                        <div className="cb-stepper">
                          <button
                            onClick={() => setRounds((state.rounds ?? 1) - 1)}
                          >
                            −
                          </button>
                          <div className="cb-num">
                            <span className="cb-nv">{state.rounds}</span>
                            <small>rounds</small>
                          </div>
                          <button
                            onClick={() => setRounds((state.rounds ?? 0) + 1)}
                          >
                            +
                          </button>
                        </div>
                        <div className="cb-presets">
                          {[1, 3, 5, 10].map((n) => (
                            <button
                              key={n}
                              onClick={() => update(name, { rounds: n })}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="cb-ed-inf">
                        Lasts until manually removed.
                      </div>
                    )}
                    <button
                      className="cb-ed-remove"
                      onClick={() => remove(name)}
                    >
                      Remove condition
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      <button
        className={`cb-add${popOpen ? " open" : ""}`}
        onClick={(e) => {
          setOpenEditor(null);
          setEditorPos(null);
          if (popOpen) {
            setPopOpen(false);
            setPopPos(null);
          } else {
            setPopOpen(true);
            placePop(e.currentTarget as HTMLElement);
          }
        }}
      >
        <span className="cb-add-plus">+</span> Add
      </button>
      {popOpen && popPos && (
        <div
          className="cb-pop"
          style={{ position: "fixed", top: popPos.top, right: popPos.right, left: "auto" }}
        >
          <div className="cb-pop-head">
            <span>Conditions</span>
            <span>click to toggle</span>
          </div>
          <div className="cb-pop-grid">
            {COND_DEFS.map((cond) => (
              <button
                key={cond.name}
                className={`cb-opt${cond.name in conditions ? " on" : ""}`}
                style={{ "--c": COND_CAT_COLORS[cond.cat] } as React.CSSProperties}
                onClick={() => toggle(cond.name)}
              >
                <span className="cb-odisc">
                  {cond.name
                    .replace(/[^A-Za-z]/g, "")
                    .charAt(0)
                    .toUpperCase()}
                </span>
                <span className="cb-oname">{cond.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
