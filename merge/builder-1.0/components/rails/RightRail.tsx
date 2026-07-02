"use client";

/**
 * RightRail — character portrait, quick stats, conditions, and favorites.
 *
 * Extracted from CharacterSheet.renderRightRail() (REFACTOR_PLAN R7).
 * Portrait-collapse and favorites-collapse toggles are rail-local; the
 * favorites popout and portrait image are shared with overlays in the main
 * shell, so they arrive as props.
 */
import { useState } from "react";
import {
  calcBaseDiceFromAttr,
  calcSkillAttrValue,
  calcSkillPool,
} from "@/lib/characterCalc";
import type {
  Character,
  AttributeKey,
  BuilderProfession,
  BuilderVocation,
  BuilderFeat,
  BuilderSpell,
  InventoryItem,
} from "@/lib/characterTypes";

type FavRef = { type: "item" | "feat" | "spell"; id: string } | null;

interface RightRailProps {
  c: Character;
  persist: (patch: Partial<Character>) => void;
  prof: BuilderProfession | null;
  vocation: BuilderVocation | null;
  effectiveTier: number;
  allFeats: BuilderFeat[];
  spells: BuilderSpell[];
  inventory: InventoryItem[];
  toggleFavorite: (type: "item" | "feat" | "spell", id: string) => void;
  setFavPopout: (v: FavRef) => void;
  attrs: Record<AttributeKey, number>;
  isArmorProficient: boolean;
}

export default function RightRail({
  c,
  persist,
  prof,
  vocation,
  effectiveTier,
  allFeats,
  spells,
  inventory,
  toggleFavorite,
  setFavPopout,
  attrs,
  isArmorProficient,
}: RightRailProps) {
  const [favoritesCollapsed, setFavoritesCollapsed] = useState(false);

  const totalAvailableSkill = 4 + 2 * Math.floor((c.featsPurchased ?? 0) / 2);
  const totalSpentSkill = Object.values(c.skillPoints ?? {}).reduce(
    (s, v) => s + v,
    0,
  );
  const dynUnspentSkill = totalAvailableSkill - totalSpentSkill;

  return (
    <>
      {/* V.I.T.A.L.S. */}
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
            V.I.T.A.L.S.
          </span>
        </div>
        <div
          style={{
            padding: "0.875rem 1rem",
            display: "flex",
            flexDirection: "column" as const,
            gap: "0.75rem",
          }}
        >
          {!isArmorProficient && (
            <div
              style={{
                padding: "0.4rem 0.75rem",
                backgroundColor: "var(--section-alert-bg)",
                border: "1px solid rgb(var(--fail-rgb) / 0.70)",
                borderRadius: "0.375rem",
                fontSize: "0.78rem",
                color: "var(--fail)",
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
              }}
            >
              ⚠ Armor Penalty active — all skill dice reduced one step (min d4)
            </div>
          )}
          {dynUnspentSkill > 0 && (
            <div
              style={{
                padding: "0.4rem 0.75rem",
                backgroundColor: "var(--accent-light)",
                border: "1px solid rgb(var(--gold-rgb) / 0.40)",
                borderRadius: "0.375rem",
                fontSize: "0.8rem",
                color: "var(--gold-dim)",
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
              }}
            >
              ✦ {dynUnspentSkill} unspent Skill Point
              {dynUnspentSkill !== 1 ? "s" : ""} — allocate below
              <span style={{ fontWeight: 400, marginLeft: "0.5rem" }}>
                ({totalSpentSkill} / {totalAvailableSkill} spent)
              </span>
            </div>
          )}
          <div
            style={{
              display: "flex",
              flexDirection: "column" as const,
              gap: "0.3rem",
            }}
          >
            {[
              "Vigor",
              "Intuition",
              "Talent",
              "Awareness",
              "Lore",
              "Social",
            ].map((skill) => {
              const pool = calcSkillPool(
                skill,
                attrs,
                c.vitalsProficiencies,
                c.vitalsExpertiseBumps ?? {},
                c.skillPoints ?? {},
              );
              const invested = c.skillPoints?.[skill] ?? 0;
              const canAdd = dynUnspentSkill > 0 && invested < 12;
              const canRemove = invested > 0;
              const RANK_COLORS: Record<string, string> = {
                Untrained: "var(--text-muted)",
                Trained: "var(--primary)",
                Expert: "var(--accent)",
                Master: "#7C3AED",
              };
              const DIE_STEP = [4, 6, 8, 10, 12] as const;
              function stepDown(faces: number): number {
                const i = DIE_STEP.indexOf(faces as (typeof DIE_STEP)[number]);
                return i > 0 ? DIE_STEP[i - 1] : 4;
              }
              const penalizedDisplay = (() => {
                if (pool.profDieFaces !== null)
                  return `${pool.baseDiceCount + pool.skillDiceCount}d${stepDown(pool.profDieFaces)}`;
                const baseFaces = calcBaseDiceFromAttr(
                  calcSkillAttrValue(skill, attrs),
                );
                return `${pool.baseDiceCount + pool.skillDiceCount}d${stepDown(baseFaces)}`;
              })();
              const dieFaces =
                pool.profDieFaces ??
                calcBaseDiceFromAttr(calcSkillAttrValue(skill, attrs));
              const badgeStyle: React.CSSProperties =
                dieFaces >= 10
                  ? {
                      backgroundColor: "var(--primary)",
                      color: "var(--text-on-primary)",
                    }
                  : dieFaces === 8
                    ? {
                        backgroundColor: "var(--primary-light)",
                        color: "var(--primary)",
                        border: "1px solid var(--primary)",
                      }
                    : {
                        backgroundColor: "var(--bg-nav)",
                        color: "var(--text-muted)",
                        border: "1px solid var(--border)",
                      };
              return (
                <div
                  key={skill}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    backgroundColor: "var(--bg-nav)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "0.375rem 0.625rem",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--text)",
                      flex: 1,
                      letterSpacing: "0.01em",
                    }}
                  >
                    {skill}
                  </span>
                  {pool.rank !== "Untrained" && (
                    <span
                      style={{
                        fontSize: "0.6rem",
                        fontWeight: 700,
                        fontFamily: "var(--font-heading)",
                        padding: "0.1rem 0.35rem",
                        borderRadius: "9999px",
                        border: `1px solid ${RANK_COLORS[pool.rank]}`,
                        color: RANK_COLORS[pool.rank],
                      }}
                    >
                      {pool.rank}
                    </span>
                  )}
                  {isArmorProficient ? (
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        fontFamily: "var(--font-heading)",
                        padding: "1px 7px",
                        borderRadius: "5px",
                        ...badgeStyle,
                      }}
                    >
                      {pool.display}
                    </span>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        gap: "0.2rem",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontFamily: "var(--font-heading)",
                          color: "var(--text-muted)",
                          textDecoration: "line-through",
                        }}
                      >
                        {pool.display}
                      </span>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          fontFamily: "var(--font-heading)",
                          padding: "1px 7px",
                          borderRadius: "5px",
                          backgroundColor: "var(--bg-nav)",
                          color: "var(--fail)",
                          border: "1px solid var(--fail)",
                        }}
                      >
                        {penalizedDisplay}
                      </span>
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.2rem",
                      flexShrink: 0,
                    }}
                  >
                    <button
                      onClick={() => {
                        if (!canRemove) return;
                        persist({
                          skillPoints: {
                            ...(c.skillPoints ?? {}),
                            [skill]: invested - 1,
                          },
                          unspentSkillPoints:
                            totalAvailableSkill - (totalSpentSkill - 1),
                        });
                      }}
                      disabled={!canRemove}
                      style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--bg-card)",
                        cursor: canRemove ? "pointer" : "not-allowed",
                        fontWeight: 700,
                        color: "var(--text-muted)",
                        fontSize: "0.75rem",
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
                        fontWeight: 700,
                        fontSize: "0.75rem",
                        minWidth: "14px",
                        textAlign: "center" as const,
                        color: "var(--primary)",
                      }}
                    >
                      {invested}
                    </span>
                    <button
                      onClick={() => {
                        if (!canAdd) return;
                        persist({
                          skillPoints: {
                            ...(c.skillPoints ?? {}),
                            [skill]: invested + 1,
                          },
                          unspentSkillPoints:
                            totalAvailableSkill - (totalSpentSkill + 1),
                        });
                      }}
                      disabled={!canAdd}
                      style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--bg-card)",
                        cursor: canAdd ? "pointer" : "not-allowed",
                        fontWeight: 700,
                        color: "var(--text-muted)",
                        fontSize: "0.75rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Favorites Panel */}
      {(() => {
        const favs = c.favorites ?? [];
        const favItems = favs
          .filter((f) => f.type === "item")
          .map((f) => inventory.find((i) => i.id === f.id))
          .filter(Boolean)
          .sort((a, b) => a!.name.localeCompare(b!.name)) as typeof inventory;
        const allFeatEntries = [
          ...allFeats,
          ...(prof?.baseFeatures ?? []),
          ...(vocation?.features ?? []),
        ];
        const favFeats = favs
          .filter((f) => f.type === "feat")
          .map((f) => allFeatEntries.find((e) => e.id === f.id))
          .filter(Boolean)
          .sort((a, b) =>
            a!.name.localeCompare(b!.name),
          ) as typeof allFeatEntries;
        const favSpells = favs
          .filter((f) => f.type === "spell")
          .map((f) => spells.find((s) => s.id === f.id))
          .filter(Boolean)
          .sort((a, b) => a!.name.localeCompare(b!.name)) as typeof spells;
        const isEmpty =
          favItems.length === 0 &&
          favFeats.length === 0 &&
          favSpells.length === 0;
        const pipBtnStyle: React.CSSProperties = {
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: "0.8rem",
          color: "var(--primary)",
          padding: "0 4px",
          flexShrink: 0,
          lineHeight: 1,
        };
        const rowStyle: React.CSSProperties = {
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 0",
          borderBottom: "1px solid var(--border)",
        };
        const entryBtnStyle: React.CSSProperties = {
          flex: 1,
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "var(--font-heading)",
          fontSize: "0.8rem",
          color: "var(--text)",
          padding: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        };
        const sectionLabelStyle: React.CSSProperties = {
          fontSize: "9px",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: "4px",
          marginTop: "8px",
        };
        return (
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
                padding: "6px 14px",
                borderBottom: favoritesCollapsed
                  ? "none"
                  : "1px solid var(--border)",
                backgroundColor: "var(--bg-nav)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
                fontSize: "10px",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.16em",
                textTransform: "uppercase" as const,
                color: "var(--text-muted)",
              }}
              onClick={() => setFavoritesCollapsed((v) => !v)}
            >
              <span>Favorites</span>
              <span style={{ fontSize: "10px", opacity: 0.6 }}>
                {favoritesCollapsed ? "▶" : "▼"}
              </span>
            </div>
            {!favoritesCollapsed && (
              <div style={{ padding: "8px 14px 12px" }}>
                {isEmpty && (
                  <div
                    style={{
                      fontSize: "0.72rem",
                      color: "var(--text-muted)",
                      fontStyle: "italic",
                      padding: "8px 0",
                    }}
                  >
                    Mark items, feats, or spells with ☆ to pin them here.
                  </div>
                )}
                {favItems.length > 0 && (
                  <div>
                    <div style={sectionLabelStyle}>Items</div>
                    {favItems.map((item) => (
                      <div key={item.id} style={rowStyle}>
                        <button
                          style={entryBtnStyle}
                          onClick={() =>
                            setFavPopout({ type: "item", id: item.id })
                          }
                          title={item.name}
                        >
                          {item.name}
                        </button>
                        <button
                          style={pipBtnStyle}
                          onClick={() => toggleFavorite("item", item.id)}
                          title="Remove"
                        >
                          ★
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {favFeats.length > 0 && (
                  <div>
                    <div style={sectionLabelStyle}>Feats</div>
                    {favFeats.map((feat) => (
                      <div key={feat.id} style={rowStyle}>
                        <button
                          style={entryBtnStyle}
                          onClick={() =>
                            setFavPopout({ type: "feat", id: feat.id })
                          }
                          title={feat.name}
                        >
                          {feat.name}
                        </button>
                        <button
                          style={pipBtnStyle}
                          onClick={() => toggleFavorite("feat", feat.id)}
                          title="Remove"
                        >
                          ★
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {favSpells.length > 0 && (
                  <div>
                    <div style={sectionLabelStyle}>Spells</div>
                    {favSpells.map((spell) => (
                      <div key={spell.id} style={rowStyle}>
                        <button
                          style={entryBtnStyle}
                          onClick={() =>
                            setFavPopout({ type: "spell", id: spell.id })
                          }
                          title={spell.name}
                        >
                          {spell.name}
                        </button>
                        <button
                          style={pipBtnStyle}
                          onClick={() => toggleFavorite("spell", spell.id)}
                          title="Remove"
                        >
                          ★
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}
    </>
  );
}
