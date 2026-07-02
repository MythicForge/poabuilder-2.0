"use client";

/**
 * LeftRail — Attributes grid (Brawn/Finesse/Mind/Will), V.I.T.A.L.S. skills,
 * and proficiencies. Pure display + attribute/skill steppers via `persist`.
 *
 * Extracted from CharacterSheet.renderLeftRail() (REFACTOR_PLAN R7).
 */
import { TIER_TOTAL_SLOTS } from "@/lib/characterCalc";
import type {
  Character,
  AttributeKey,
  BuilderProfession,
} from "@/lib/characterTypes";

/** Signed attribute/mod formatter (+3 / -1). */
const fmtAttr = (v: number) => (v >= 0 ? `+${v}` : String(v));

interface LeftRailProps {
  c: Character;
  persist: (patch: Partial<Character>) => void;
  attrs: Record<AttributeKey, number>;
  effectiveChar: Character;
  effectiveTier: number;
  prof: BuilderProfession | null;
}

export default function LeftRail({
  c,
  persist,
  attrs,
  effectiveChar,
  effectiveTier,
  prof,
}: LeftRailProps) {
  const totalAvailableBase = TIER_TOTAL_SLOTS[effectiveTier - 1] ?? 5;
  const currentTotalBase =
    (c.baseAttributes.brawn ?? 0) +
    (c.baseAttributes.finesse ?? 0) +
    (c.baseAttributes.mind ?? 0) +
    (c.baseAttributes.will ?? 0);
  const dynamicUnspent = totalAvailableBase - currentTotalBase;
  return (
    <>
      {/* Attributes */}
      <div
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "6px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "0.5rem 1rem",
            borderBottom: "1px solid var(--border)",
            backgroundColor: "var(--bg-nav)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: "0.65rem",
              fontFamily: "var(--font-heading)",
              fontStyle: "italic",
              letterSpacing: "0.12em",
              color: "var(--text-muted)",
              textTransform: "uppercase" as const,
            }}
          >
            Attributes
          </span>
          <span
            style={{
              fontSize: "0.6rem",
              color: "var(--text-faint)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {currentTotalBase}/{totalAvailableBase} pts
          </span>
        </div>
        {dynamicUnspent > 0 && (
          <div
            style={{
              margin: "10px 12px 0",
              padding: "0.375rem 0.625rem",
              backgroundColor: "var(--accent-light)",
              border: "1px solid var(--accent)",
              borderRadius: "0.375rem",
              fontSize: "0.75rem",
              color: "var(--text)",
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
            }}
          >
            ⚠ {dynamicUnspent} unspent attr pt
            {dynamicUnspent !== 1 ? "s" : ""}
            <span style={{ fontWeight: 400, marginLeft: "0.35rem" }}>
              ({currentTotalBase} / {totalAvailableBase})
            </span>
          </div>
        )}
        {/* Score tiles */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "8px",
            padding: "12px 12px 0",
          }}
        >
          {(["brawn", "finesse", "mind", "will"] as const).map((key) => {
            const val = attrs[key];
            const isHighest =
              val ===
              Math.max(attrs.brawn, attrs.finesse, attrs.mind, attrs.will);
            return (
              <div
                key={key}
                style={{
                  backgroundColor: "var(--bg-nav)",
                  border: `1px solid ${isHighest ? "var(--primary)" : "var(--border)"}`,
                  borderRadius: "6px",
                  padding: "10px 8px 8px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "9px",
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase" as const,
                    color: "var(--text-muted)",
                    marginBottom: "4px",
                  }}
                >
                  {key.toUpperCase()}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "28px",
                    fontWeight: 700,
                    color: isHighest ? "var(--primary)" : "var(--text)",
                    lineHeight: 1,
                  }}
                >
                  {fmtAttr(val)}
                </div>
                <div
                  style={{
                    fontSize: "9px",
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-muted)",
                    marginTop: "3px",
                    letterSpacing: "0.08em",
                  }}
                >
                  {/*{key}*/}
                </div>
              </div>
            );
          })}
        </div>
        {/* Edit controls */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "8px",
            padding: "8px 12px 12px",
          }}
        >
          {(["brawn", "finesse", "mind", "will"] as const).map((key) => {
            const val = attrs[key];
            const base = c.baseAttributes[key];
            const voc =
              effectiveChar.vocationAttributeBonus.attribute === key
                ? effectiveChar.vocationAttributeBonus.value
                : 0;
            const canIncrease = dynamicUnspent > 0 && val < 12;
            const canDecrease = base > 0;
            function adjustAttr(delta: number) {
              const newBase = base + delta;
              if (newBase < 0 || newBase + voc > 12) return;
              if (delta > 0 && !canIncrease) return;
              persist({
                baseAttributes: { ...c.baseAttributes, [key]: newBase },
                unspentAttributePoints: Math.max(0, dynamicUnspent - delta),
              });
            }
            return (
              <div
                key={key}
                style={{
                  display: "flex",
                  flexDirection: "column" as const,
                  alignItems: "center",
                  gap: "3px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "3px",
                  }}
                >
                  <button
                    onClick={() => adjustAttr(-1)}
                    disabled={!canDecrease}
                    className="poa-attr-btn"
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--bg-card)",
                      cursor: canDecrease ? "pointer" : "not-allowed",
                      fontWeight: 700,
                      color: "var(--text-muted)",
                      fontSize: "0.8rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    −
                  </button>
                  <span
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      minWidth: "16px",
                      textAlign: "center" as const,
                    }}
                  >
                    {fmtAttr(base)}
                  </span>
                  <button
                    onClick={() => adjustAttr(1)}
                    disabled={!canIncrease}
                    className="poa-attr-btn"
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--bg-card)",
                      cursor: canIncrease ? "pointer" : "not-allowed",
                      fontWeight: 700,
                      color: "var(--text-muted)",
                      fontSize: "0.8rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    +
                  </button>
                </div>
                {voc > 0 && (
                  <span
                    style={{
                      fontSize: "0.58rem",
                      color: "var(--text-muted)",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {/*+{voc}*/}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Proficiencies */}
      {[
        { label: "Armaments", items: prof?.armaments ?? [] },
        { label: "Protection", items: prof?.protection ?? [] },
        {
          label: "Tool Kits",
          items: (prof?.toolKits ?? []).filter((t) => t !== "-"),
        },
      ].filter((g) => g.items.length > 0).length > 0 && (
        <div
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "0.5rem 1rem",
              borderBottom: "1px solid var(--border)",
              backgroundColor: "var(--bg-nav)",
            }}
          >
            <span
              style={{
                fontSize: "0.65rem",
                fontFamily: "var(--font-heading)",
                fontStyle: "italic",
                letterSpacing: "0.12em",
                color: "var(--text-muted)",
                textTransform: "uppercase" as const,
              }}
            >
              Proficiencies
            </span>
          </div>
          <div style={{ padding: "0.5rem 1rem", display: "flex", flexDirection: "column" as const, gap: 0 }}>
            {[
              { label: "Armaments", items: prof?.armaments ?? [] },
              { label: "Protection", items: prof?.protection ?? [] },
              {
                label: "Tool Kits",
                items: (prof?.toolKits ?? []).filter((t) => t !== "-"),
              },
            ]
              .filter((g) => g.items.length > 0)
              .map((group, i, arr) => (
                <div key={group.label}>
                  {i > 0 && (
                    <div
                      style={{
                        borderTop: "1px solid var(--border)",
                        margin: "0.35rem 0",
                      }}
                    />
                  )}
                  <div
                    style={{
                      fontSize: "9px",
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase" as const,
                      color: "var(--text-muted)",
                      marginBottom: "0.3rem",
                      marginTop: i > 0 ? "0.35rem" : "0.25rem",
                    }}
                  >
                    {group.label}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column" as const,
                      gap: "0.3rem",
                      marginBottom: "0.25rem",
                    }}
                  >
                    {group.items.map((item) => (
                      <div
                        key={item}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.625rem",
                          padding: "0.35rem 0.625rem",
                          backgroundColor: "var(--bg-nav)",
                          border: "1px solid var(--border)",
                          borderRadius: "0.375rem",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "var(--font-heading)",
                            fontWeight: 700,
                            fontSize: "0.85rem",
                            color: "var(--text)",
                            flex: 1,
                          }}
                        >
                          {item}
                        </span>
                        <span
                          style={{
                            fontSize: "0.6rem",
                            fontWeight: 700,
                            fontFamily: "var(--font-heading)",
                            padding: "0.1rem 0.35rem",
                            borderRadius: "9999px",
                            border: "1px solid var(--primary)",
                            color: "var(--primary)",
                          }}
                        >
                          Proficient
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

    </>
  );
}
