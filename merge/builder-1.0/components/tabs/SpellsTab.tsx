"use client";

/**
 * SpellsTab — spell feed (cantrips + tiered), amp toggles, reservoir cost,
 * and the Known Spells manager modal (search / source + sphere filters).
 *
 * Extracted from CharacterSheet.renderSpellcastingTab() (REFACTOR_PLAN R4).
 * Feed-expand, amp, and manager state is tab-local. Computed spell inputs
 * (caster info, tier, reservoir, spell lists) come in as props.
 */
import { useState } from "react";
import MarkdownContent from "../MarkdownContent";
import type { Character, BuilderSpell } from "@/lib/characterTypes";

interface SpellsTabProps {
  c: Character;
  persist: (patch: Partial<Character>) => void;
  casterInfo: { casterType: string } | null;
  isCaster: boolean;
  mySpells: BuilderSpell[];
  spells: BuilderSpell[];
  currentReservoir: number;
  spellTier: number;
  accessibleSources: string[];
  knownSchoolSpheres: string[];
  isFavorite: (type: "item" | "feat" | "spell", id: string) => boolean;
  toggleFavorite: (type: "item" | "feat" | "spell", id: string) => void;
}

export default function SpellsTab({
  c,
  persist,
  casterInfo,
  isCaster,
  mySpells,
  spells,
  currentReservoir,
  spellTier,
  accessibleSources,
  knownSchoolSpheres,
  isFavorite,
  toggleFavorite,
}: SpellsTabProps) {
  const [activeAmps, setActiveAmps] = useState<Record<string, Set<number>>>({});
  const [expandedSpells, setExpandedSpells] = useState<Set<string>>(new Set());
  const [showSpellManager, setShowSpellManager] = useState(false);
  const [spellManagerSearch, setSpellManagerSearch] = useState("");
  const [spellShopSourceFilter, setSpellShopSourceFilter] = useState<
    Set<string>
  >(new Set());
  const [spellShopSphereFilter, setSpellShopSphereFilter] = useState<
    Set<string>
  >(new Set());

  if (!isCaster && mySpells.length === 0)
    return (
      <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
        No spellcasting.
      </p>
    );

  // Active feed: use persisted list, defaulting to all known spells
  const feedIds =
    (c.activeFeedSpellIds ?? []).length > 0
      ? c.activeFeedSpellIds
      : c.knownSpellIds;
  const feedSpells = mySpells.filter((s) => feedIds.includes(s.id));
  const cantrips = feedSpells.filter((s) => s.isCantrip);
  const tiered = feedSpells.filter((s) => !s.isCantrip);
  const byTier: Record<number, typeof tiered> = {};
  tiered.forEach((s) => {
    if (!byTier[s.tier]) byTier[s.tier] = [];
    byTier[s.tier].push(s);
  });

  function toggleSpellExpand(id: string) {
    setExpandedSpells((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAmp(spellId: string, ampIdx: number) {
    setActiveAmps((prev) => {
      const current = new Set(prev[spellId] ?? []);
      current.has(ampIdx) ? current.delete(ampIdx) : current.add(ampIdx);
      return { ...prev, [spellId]: current };
    });
  }

  function toggleFeedSpell(spellId: string) {
    const current =
      (c.activeFeedSpellIds ?? []).length > 0
        ? c.activeFeedSpellIds
        : c.knownSpellIds;
    const next = current.includes(spellId)
      ? current.filter((id) => id !== spellId)
      : [...current, spellId];
    persist({ activeFeedSpellIds: next });
  }

  function addToKnown(spellId: string) {
    if (c.knownSpellIds.includes(spellId)) return;
    const newKnown = [...c.knownSpellIds, spellId];
    const newFeed = [...(c.activeFeedSpellIds ?? c.knownSpellIds), spellId];
    persist({ knownSpellIds: newKnown, activeFeedSpellIds: newFeed });
  }

  function removeFromKnown(spellId: string) {
    persist({
      knownSpellIds: c.knownSpellIds.filter((id) => id !== spellId),
      activeFeedSpellIds: (c.activeFeedSpellIds ?? []).filter(
        (id) => id !== spellId,
      ),
    });
  }

  function SpellCard({ spell }: { spell: (typeof mySpells)[0] }) {
    const expanded = expandedSpells.has(spell.id);
    const ampState = activeAmps[spell.id] ?? new Set<number>();
    const baseCost = spell.isCantrip ? 0 : spell.tier;
    const ampCost = (spell.amps ?? []).reduce(
      (sum, amp, i) =>
        ampState.has(i) ? sum + parseInt(amp.cost.replace("+", "")) : sum,
      0,
    );
    const totalCost = baseCost + ampCost;
    const canCast = spell.isCantrip || currentReservoir >= totalCost;
    const hasAmps = (spell.amps ?? []).length > 0;

    function handleCast() {
      if (!canCast || spell.isCantrip) {
        if (spell.isCantrip) return;
        return;
      }
      persist({
        currentReservoir: Math.max(0, currentReservoir - totalCost),
      });
    }

    const badgeStyle: React.CSSProperties = {
      fontSize: "0.62rem",
      fontWeight: 700,
      fontFamily: "var(--font-heading)",
      padding: "0.1rem 0.35rem",
      borderRadius: "9999px",
      border: "1px solid var(--border)",
      backgroundColor: "var(--bg-nav)",
      color: "var(--text-muted)",
      whiteSpace: "nowrap",
    };

    return (
      <div
        style={{
          border: `1px solid ${expanded ? "var(--primary)" : "var(--border)"}`,
          borderRadius: "0.5rem",
          overflow: "hidden",
          backgroundColor: "var(--bg-card)",
        }}
      >
        {/* Collapsed header */}
        <div style={{ display: "flex", alignItems: "stretch" }}>
          <button
            onClick={() => toggleSpellExpand(spell.id)}
            style={{
              flex: 1,
              padding: "0.6rem 0.875rem",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
              backgroundColor: expanded
                ? "var(--primary-light)"
                : "var(--bg-card)",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
                fontSize: "0.9rem",
                color: expanded ? "var(--primary)" : "var(--text)",
                flex: 1,
                minWidth: "120px",
              }}
            >
              {spell.name}
            </span>
            <span
              style={{
                ...badgeStyle,
                backgroundColor: spell.isCantrip
                  ? "var(--accent-light)"
                  : "var(--bg-nav)",
                color: spell.isCantrip ? "var(--accent)" : "var(--text-muted)",
                border: spell.isCantrip
                  ? "1px solid rgb(var(--gold-rgb) / 0.40)"
                  : "1px solid var(--border)",
              }}
            >
              {spell.isCantrip ? "Cantrip" : `Tier ${spell.tier}`}
            </span>
            {!spell.isCantrip && (
              <span
                style={{
                  ...badgeStyle,
                  backgroundColor: canCast
                    ? "var(--primary-light)"
                    : "var(--bg-nav)",
                  color: canCast ? "var(--primary)" : "var(--text-muted)",
                  border: canCast
                    ? "1px solid var(--primary)"
                    : "1px solid var(--border)",
                }}
              >
                Cost: {totalCost}
              </span>
            )}
            {spell.range && (
              <span
                style={{
                  fontSize: "0.7rem",
                  color: "var(--text-muted)",
                  whiteSpace: "nowrap",
                }}
              >
                {spell.range}
              </span>
            )}
            {spell.duration && (
              <span
                style={{
                  fontSize: "0.7rem",
                  color: "var(--text-muted)",
                  whiteSpace: "nowrap",
                }}
              >
                {spell.duration}
              </span>
            )}
            {hasAmps && (
              <span
                style={{
                  ...badgeStyle,
                  backgroundColor: "rgb(var(--gold-rgb) / 0.09)",
                  color: "var(--gold-dim)",
                  border: "1px solid rgb(var(--gold-rgb) / 0.40)",
                }}
              >
                Amps
              </span>
            )}
            <span
              style={{
                fontSize: "0.65rem",
                color: "var(--text-muted)",
                marginLeft: "auto",
              }}
            >
              {expanded ? "▲" : "▼"}
            </span>
          </button>
          <button
            onClick={() => toggleFavorite("spell", spell.id)}
            title={
              isFavorite("spell", spell.id)
                ? "Remove from Favorites"
                : "Add to Favorites"
            }
            style={{
              background: "none",
              border: "none",
              borderLeft: "1px solid var(--border)",
              cursor: "pointer",
              fontSize: "0.8rem",
              color: isFavorite("spell", spell.id)
                ? "var(--primary)"
                : "var(--text-muted)",
              padding: "0 10px",
              flexShrink: 0,
              backgroundColor: expanded
                ? "var(--primary-light)"
                : "var(--bg-card)",
            }}
          >
            {isFavorite("spell", spell.id) ? "★" : "☆"}
          </button>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div
            style={{
              padding: "0.75rem 0.875rem",
              borderTop: `1px solid ${expanded ? "var(--primary)" : "var(--border)"}`,
            }}
          >
            <MarkdownContent content={spell.descriptionMarkdown} />

            {/* Amp panel */}
            {hasAmps && (
              <div
                style={{
                  marginTop: "0.75rem",
                  padding: "0.625rem 0.75rem",
                  backgroundColor: "rgb(var(--gold-rgb) / 0.06)",
                  border: "1px solid rgb(var(--gold-rgb) / 0.40)",
                  borderRadius: "0.375rem",
                }}
              >
                <div
                  style={{
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--gold-dim)",
                    fontFamily: "var(--font-heading)",
                    marginBottom: "0.375rem",
                  }}
                >
                  Amps
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.3rem",
                  }}
                >
                  {(spell.amps ?? []).map((amp, i) => {
                    const active = ampState.has(i);
                    return (
                      <button
                        key={i}
                        onClick={() => toggleAmp(spell.id, i)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "0.375rem 0.625rem",
                          border: `1.5px solid ${active ? "var(--gold)" : "rgb(var(--gold-rgb) / 0.40)"}`,
                          borderRadius: "0.375rem",
                          backgroundColor: active
                            ? "rgb(var(--gold-rgb) / 0.09)"
                            : "rgb(var(--gold-rgb) / 0.06)",
                          cursor: "pointer",
                          display: "flex",
                          gap: "0.5rem",
                          alignItems: "flex-start",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "var(--font-heading)",
                            fontWeight: 700,
                            fontSize: "0.72rem",
                            color: active ? "var(--gold-dim)" : "var(--gold)",
                            whiteSpace: "nowrap",
                            minWidth: "50px",
                          }}
                        >
                          Amp {amp.cost}
                        </span>
                        <span
                          style={{
                            fontSize: "0.78rem",
                            color: "var(--gold-dim)",
                            lineHeight: 1.45,
                          }}
                        >
                          {amp.effect}
                        </span>
                        {active && (
                          <span
                            style={{
                              marginLeft: "auto",
                              fontSize: "0.65rem",
                              fontWeight: 700,
                              color: "var(--gold-dim)",
                              fontFamily: "var(--font-heading)",
                            }}
                          >
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {ampCost > 0 && (
                  <div
                    style={{
                      marginTop: "0.375rem",
                      fontSize: "0.72rem",
                      color: "var(--gold-dim)",
                      fontFamily: "var(--font-heading)",
                      fontWeight: 600,
                    }}
                  >
                    Total cost: {baseCost} + {ampCost} amps = {totalCost}
                  </div>
                )}
              </div>
            )}

            {/* Cast button */}
            <div
              style={{
                marginTop: "0.75rem",
                display: "flex",
                gap: "0.5rem",
                alignItems: "center",
              }}
            >
              {!spell.isCantrip ? (
                <>
                  <button
                    onClick={handleCast}
                    disabled={!canCast}
                    style={{
                      padding: "0.3rem 0.875rem",
                      border: "none",
                      borderRadius: "0.375rem",
                      backgroundColor: canCast
                        ? "var(--primary)"
                        : "var(--border)",
                      color: "var(--text-on-primary)",
                      cursor: canCast ? "pointer" : "not-allowed",
                      fontFamily: "var(--font-heading)",
                      fontWeight: 700,
                      fontSize: "0.8rem",
                    }}
                  >
                    Cast ({totalCost})
                  </button>
                  {!canCast && (
                    <span
                      style={{
                        fontSize: "0.72rem",
                        color: "var(--fail)",
                        fontStyle: "italic",
                      }}
                    >
                      Not enough Reservoir.
                    </span>
                  )}
                </>
              ) : (
                <span
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--text-muted)",
                    fontStyle: "italic",
                  }}
                >
                  Cantrip — free to cast.
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Known Spells Manager Modal ─────────────────────────────────────────
  const cantripCap = isCaster ? (casterInfo!.casterType === "full" ? 3 : 2) : 0;
  const myCantripsAll = mySpells.filter((s) => s.isCantrip);
  const cantripAtCap = myCantripsAll.length >= cantripCap;

  const allSearchable = spellManagerSearch.trim()
    ? spells.filter(
        (s) =>
          s.name.toLowerCase().includes(spellManagerSearch.toLowerCase()) ||
          s.school.toLowerCase().includes(spellManagerSearch.toLowerCase()) ||
          s.sources.some((src) =>
            src.toLowerCase().includes(spellManagerSearch.toLowerCase()),
          ),
      )
    : spells;
  // Filter by accessible sources; Universal spells always available to all casters
  const sourceFiltered =
    accessibleSources.length > 0
      ? allSearchable.filter(
          (s) =>
            s.sources.includes("Universal") ||
            s.sources.some((src) => accessibleSources.includes(src)),
        )
      : allSearchable;
  // Apply shop source/sphere/tier filters
  const shopFiltered = sourceFiltered.filter((s) => {
    if (
      spellShopSourceFilter.size > 0 &&
      !s.sources.some((src) => spellShopSourceFilter.has(src))
    )
      return false;
    if (spellShopSphereFilter.size > 0 && !spellShopSphereFilter.has(s.school))
      return false;
    if (!s.isCantrip && s.tier > spellTier) return false;
    return true;
  });
  const unknownSpells = shopFiltered.filter(
    (s) => !c.knownSpellIds.includes(s.id),
  );
  const shopHasFilter =
    spellManagerSearch.trim() ||
    spellShopSourceFilter.size > 0 ||
    spellShopSphereFilter.size > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      {/* Magic sources + school spheres */}
      {(accessibleSources.length > 0 || knownSchoolSpheres.length > 0) && (
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            flexWrap: "wrap",
            gap: "1rem",
            alignItems: "flex-start",
          }}
        >
          {accessibleSources.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-heading)",
                  marginBottom: "0.375rem",
                }}
              >
                Magic Source{accessibleSources.length > 1 ? "s" : ""}
              </div>
              <div
                style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}
              >
                {accessibleSources.map((src) => (
                  <span
                    key={src}
                    style={{
                      fontSize: "0.78rem",
                      padding: "0.2rem 0.625rem",
                      borderRadius: "9999px",
                      backgroundColor: "var(--primary-light)",
                      border: "1px solid var(--primary)",
                      color: "var(--primary)",
                      fontFamily: "var(--font-heading)",
                      fontWeight: 600,
                    }}
                  >
                    {src}
                  </span>
                ))}
              </div>
            </div>
          )}
          {knownSchoolSpheres.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-heading)",
                  marginBottom: "0.375rem",
                }}
              >
                Known Sphere{knownSchoolSpheres.length > 1 ? "s" : ""}
              </div>
              <div
                style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}
              >
                {knownSchoolSpheres.map((sphere) => (
                  <span
                    key={sphere}
                    style={{
                      fontSize: "0.78rem",
                      padding: "0.2rem 0.625rem",
                      borderRadius: "9999px",
                      backgroundColor: "var(--bg-nav)",
                      border: "1px solid var(--accent)",
                      color: "var(--accent)",
                      fontFamily: "var(--font-heading)",
                      fontWeight: 600,
                    }}
                  >
                    {sphere}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Known Spells button */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => setShowSpellManager(true)}
          style={{
            padding: "0.35rem 0.875rem",
            border: "1.5px solid var(--primary)",
            borderRadius: "0.375rem",
            backgroundColor: "transparent",
            cursor: "pointer",
            color: "var(--primary)",
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: "0.8rem",
          }}
        >
          Known Spells ({c.knownSpellIds.length})
        </button>
      </div>

      {/* Spell feed */}
      {feedSpells.length === 0 && (
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
          {mySpells.length === 0
            ? 'No known spells. Use "Known Spells" to add spells.'
            : 'All spells hidden. Use "Known Spells" to toggle spells into your feed.'}
        </p>
      )}

      {cantrips.length > 0 && (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.375rem",
            }}
          >
            <div
              style={{
                fontSize: "0.63rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                fontFamily: "var(--font-heading)",
              }}
            >
              Cantrips
            </div>
            <span
              style={{
                fontSize: "0.62rem",
                fontWeight: 700,
                fontFamily: "var(--font-heading)",
                padding: "0.05rem 0.3rem",
                borderRadius: "9999px",
                border: `1px solid ${cantripAtCap ? "var(--fail)" : "var(--primary)"}`,
                color: cantripAtCap ? "var(--fail)" : "var(--primary)",
              }}
            >
              {myCantripsAll.length}/{cantripCap}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
            }}
          >
            {cantrips.map((s) => (
              <SpellCard key={s.id} spell={s} />
            ))}
          </div>
        </div>
      )}
      {Object.keys(byTier)
        .map(Number)
        .sort()
        .map((tier) => (
          <div key={tier}>
            <div
              style={{
                fontSize: "0.63rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                fontFamily: "var(--font-heading)",
                marginBottom: "0.375rem",
              }}
            >
              Tier {tier}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
              }}
            >
              {byTier[tier].map((s) => (
                <SpellCard key={s.id} spell={s} />
              ))}
            </div>
          </div>
        ))}

      {/* Known Spells Manager Modal */}
      {showSpellManager && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.55)",
            zIndex: 50,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "2rem 1rem",
            overflowY: "auto",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowSpellManager(false);
              setSpellShopSourceFilter(new Set());
              setSpellShopSphereFilter(new Set());
            }
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "600px",
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "1rem 1.25rem",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "0.75rem",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-heading)",
                    fontWeight: 700,
                    fontSize: "1rem",
                    color: "var(--text)",
                  }}
                >
                  Known Spells
                </h3>
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--text-muted)",
                    marginTop: "0.15rem",
                  }}
                >
                  Spells: {mySpells.filter((s) => !s.isCantrip).length} ·
                  Cantrips: {myCantripsAll.length}/{cantripCap} · Spell Tier:{" "}
                  {spellTier}
                  {accessibleSources.length > 0 && (
                    <> · Source: {accessibleSources.join(", ")}</>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowSpellManager(false);
                  setSpellShopSourceFilter(new Set());
                  setSpellShopSphereFilter(new Set());
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1.1rem",
                  color: "var(--text-muted)",
                  padding: "0.2rem 0.4rem",
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                padding: "1rem 1.25rem",
                maxHeight: "70vh",
                overflowY: "auto",
              }}
            >
              {/* Known spells list */}
              {mySpells.length > 0 && (
                <div style={{ marginBottom: "1.25rem" }}>
                  <div
                    style={{
                      fontSize: "0.62rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      color: "var(--text-muted)",
                      fontFamily: "var(--font-heading)",
                      marginBottom: "0.5rem",
                    }}
                  >
                    Your Known Spells — toggle to show/hide in feed
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.3rem",
                    }}
                  >
                    {mySpells.map((s) => {
                      const inFeed = feedIds.includes(s.id);
                      return (
                        <div
                          key={s.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            padding: "0.4rem 0.625rem",
                            backgroundColor: inFeed
                              ? "var(--primary-light)"
                              : "var(--bg-nav)",
                            border: `1px solid ${inFeed ? "var(--primary)" : "var(--border)"}`,
                            borderRadius: "0.375rem",
                          }}
                        >
                          <button
                            onClick={() => toggleFeedSpell(s.id)}
                            style={{
                              width: "22px",
                              height: "22px",
                              borderRadius: "50%",
                              border: `2px solid ${inFeed ? "var(--primary)" : "var(--border)"}`,
                              backgroundColor: inFeed
                                ? "var(--primary)"
                                : "transparent",
                              cursor: "pointer",
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "var(--text-on-primary)",
                              fontSize: "0.65rem",
                            }}
                          >
                            {inFeed ? "✓" : ""}
                          </button>
                          <span
                            style={{
                              fontFamily: "var(--font-heading)",
                              fontWeight: 600,
                              fontSize: "0.85rem",
                              color: "var(--text)",
                              flex: 1,
                            }}
                          >
                            {s.name}
                          </span>
                          <span
                            style={{
                              fontSize: "0.62rem",
                              color: "var(--text-muted)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {s.isCantrip ? "Cantrip" : `Tier ${s.tier}`}
                          </span>
                          {s.range && (
                            <span
                              style={{
                                fontSize: "0.62rem",
                                color: "var(--text-muted)",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {s.range}
                            </span>
                          )}
                          {s.duration && (
                            <span
                              style={{
                                fontSize: "0.62rem",
                                color: "var(--text-muted)",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {s.duration}
                            </span>
                          )}
                          <button
                            onClick={() => removeFromKnown(s.id)}
                            title="Remove from known spells"
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "var(--text-muted)",
                              fontSize: "0.7rem",
                              padding: "0.1rem 0.25rem",
                              flexShrink: 0,
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Add spell search */}
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.62rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      color: "var(--text-muted)",
                      fontFamily: "var(--font-heading)",
                    }}
                  >
                    Add Spell
                  </div>
                  <span
                    style={{
                      fontSize: "0.62rem",
                      fontFamily: "var(--font-heading)",
                      fontWeight: 700,
                      color: cantripAtCap ? "var(--fail)" : "var(--text-muted)",
                    }}
                  >
                    Cantrips: {myCantripsAll.length}/{cantripCap}
                  </span>
                </div>
                {cantripAtCap && (
                  <div
                    style={{
                      padding: "0.3rem 0.625rem",
                      backgroundColor: "rgb(var(--fail-rgb) / 0.09)",
                      border: "1px solid rgb(var(--fail-rgb) / 0.40)",
                      borderRadius: "0.375rem",
                      fontSize: "0.75rem",
                      color: "var(--fail)",
                      marginBottom: "0.375rem",
                      fontFamily: "var(--font-heading)",
                    }}
                  >
                    Cantrip cap reached ({cantripCap}). Remove a cantrip to add
                    another.
                  </div>
                )}
                {/* Source + sphere filter pills */}
                {accessibleSources.length > 0 && (
                  <div style={{ marginBottom: "0.4rem" }}>
                    <div
                      style={{
                        fontSize: "0.58rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-heading)",
                        marginBottom: "0.25rem",
                      }}
                    >
                      Source
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.3rem",
                      }}
                    >
                      {accessibleSources.map((src) => {
                        const active = spellShopSourceFilter.has(src);
                        return (
                          <button
                            key={src}
                            onClick={() =>
                              setSpellShopSourceFilter((prev) => {
                                const next = new Set(prev);
                                next.has(src)
                                  ? next.delete(src)
                                  : next.add(src);
                                return next;
                              })
                            }
                            style={{
                              padding: "0.15rem 0.5rem",
                              borderRadius: "9999px",
                              fontSize: "0.7rem",
                              fontFamily: "var(--font-heading)",
                              fontWeight: 600,
                              border: active
                                ? "1.5px solid var(--primary)"
                                : "1.5px solid var(--border)",
                              backgroundColor: active
                                ? "var(--primary)"
                                : "var(--bg-card)",
                              color: active ? "var(--bg)" : "var(--text-muted)",
                              cursor: "pointer",
                            }}
                          >
                            {src}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {knownSchoolSpheres.length > 0 && (
                  <div style={{ marginBottom: "0.4rem" }}>
                    <div
                      style={{
                        fontSize: "0.58rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-heading)",
                        marginBottom: "0.25rem",
                      }}
                    >
                      Sphere
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.3rem",
                      }}
                    >
                      {knownSchoolSpheres.map((sphere) => {
                        const active = spellShopSphereFilter.has(sphere);
                        return (
                          <button
                            key={sphere}
                            onClick={() =>
                              setSpellShopSphereFilter((prev) => {
                                const next = new Set(prev);
                                next.has(sphere)
                                  ? next.delete(sphere)
                                  : next.add(sphere);
                                return next;
                              })
                            }
                            style={{
                              padding: "0.15rem 0.5rem",
                              borderRadius: "9999px",
                              fontSize: "0.7rem",
                              fontFamily: "var(--font-heading)",
                              fontWeight: 600,
                              border: active
                                ? "1.5px solid var(--accent)"
                                : "1.5px solid var(--border)",
                              backgroundColor: active
                                ? "var(--accent)"
                                : "var(--bg-card)",
                              color: active ? "var(--bg)" : "var(--text-muted)",
                              cursor: "pointer",
                            }}
                          >
                            {sphere}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <input
                  value={spellManagerSearch}
                  onChange={(e) => setSpellManagerSearch(e.target.value)}
                  placeholder="Search by name or school…"
                  style={{
                    width: "100%",
                    padding: "0.375rem 0.625rem",
                    fontSize: "0.825rem",
                    fontFamily: "var(--font-body)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.375rem",
                    backgroundColor: "var(--bg-nav)",
                    color: "var(--text)",
                    outline: "none",
                    marginBottom: "0.5rem",
                    boxSizing: "border-box",
                  }}
                />
                {shopHasFilter && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.25rem",
                      maxHeight: "220px",
                      overflowY: "auto",
                    }}
                  >
                    {unknownSpells.length === 0 ? (
                      <p
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--text-muted)",
                          fontStyle: "italic",
                          margin: 0,
                        }}
                      >
                        No results.
                      </p>
                    ) : (
                      unknownSpells.map((s) => {
                        const blocked = s.isCantrip && cantripAtCap;
                        return (
                          <div
                            key={s.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                              padding: "0.35rem 0.625rem",
                              backgroundColor: "var(--bg-nav)",
                              border: "1px solid var(--border)",
                              borderRadius: "0.375rem",
                              opacity: blocked ? 0.55 : 1,
                            }}
                          >
                            <span
                              style={{
                                fontFamily: "var(--font-heading)",
                                fontWeight: 600,
                                fontSize: "0.82rem",
                                color: "var(--text)",
                                flex: 1,
                              }}
                            >
                              {s.name}
                            </span>
                            <span
                              style={{
                                fontSize: "0.62rem",
                                color: s.isCantrip
                                  ? "var(--accent)"
                                  : "var(--text-muted)",
                              }}
                            >
                              {s.isCantrip ? "Cantrip" : `Tier ${s.tier}`}
                            </span>
                            <span
                              style={{
                                fontSize: "0.6rem",
                                color: "var(--text-muted)",
                              }}
                            >
                              {s.school}
                            </span>
                            <button
                              onClick={() => {
                                if (!blocked) addToKnown(s.id);
                              }}
                              disabled={blocked}
                              title={
                                blocked
                                  ? `Cantrip cap (${cantripCap}) reached`
                                  : undefined
                              }
                              style={{
                                padding: "0.15rem 0.5rem",
                                border: "none",
                                borderRadius: "0.25rem",
                                backgroundColor: blocked
                                  ? "var(--border)"
                                  : "var(--primary)",
                                color: "var(--text-on-primary)",
                                cursor: blocked ? "not-allowed" : "pointer",
                                fontFamily: "var(--font-heading)",
                                fontWeight: 600,
                                fontSize: "0.72rem",
                                flexShrink: 0,
                              }}
                            >
                              + Add
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
