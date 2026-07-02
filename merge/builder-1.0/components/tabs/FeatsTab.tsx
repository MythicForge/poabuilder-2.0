"use client";

/**
 * FeatsTab — profession/vocation features, purchased feats, feat shop,
 * feat swap, and choice editing.
 *
 * Extracted from CharacterSheet.renderFeatsTab() (REFACTOR_PLAN R3).
 * All feat-shop / swap / choice-edit / expand state is tab-local. Computed
 * inputs (prof, vocation, feat pools, selections, tier) come in as props.
 */
import { useState } from "react";
import MarkdownContent from "../MarkdownContent";
import {
  VITALS_SET,
  clearFeatChoices,
  computeExpertiseBumps,
  calcTierFromFeatsPurchased,
} from "@/lib/characterCalc";
import {
  getFeatStatus,
  parseRequired,
  FEAT_COST_BY_TIER,
} from "@/lib/featLogic";
import type {
  Character,
  BuilderProfession,
  BuilderOrigin,
  BuilderVocation,
  BuilderFeat,
  ChoiceFeature,
} from "@/lib/characterTypes";

interface FeatsTabProps {
  c: Character;
  persist: (patch: Partial<Character>) => void;
  prof: BuilderProfession | null;
  origin: BuilderOrigin | null;
  vocation: BuilderVocation | null;
  selectedFeats: BuilderFeat[];
  choiceFeatures: ChoiceFeature[];
  professionFeats: BuilderFeat[];
  originFeats: BuilderFeat[];
  effectiveTier: number;
  isFavorite: (type: "item" | "feat" | "spell", id: string) => boolean;
  toggleFavorite: (type: "item" | "feat" | "spell", id: string) => void;
}

export default function FeatsTab({
  c,
  persist,
  prof,
  origin,
  vocation,
  selectedFeats,
  choiceFeatures,
  professionFeats,
  originFeats,
  effectiveTier,
  isFavorite,
  toggleFavorite,
}: FeatsTabProps) {
  const [expandedFeats, setExpandedFeats] = useState<Set<string>>(new Set());
  const [showFeatShop, setShowFeatShop] = useState(false);
  const [shopExpandedIds, setShopExpandedIds] = useState<Set<string>>(
    new Set(),
  );
  const [shopChoiceQueue, setShopChoiceQueue] = useState<ChoiceFeature[]>([]);
  const [shopChoiceIdx, setShopChoiceIdx] = useState(0);
  const [shopCurrentSels, setShopCurrentSels] = useState<string[]>([]);
  const [swapSourceFeatId, setSwapSourceFeatId] = useState<string | null>(null);
  const [swapSearch, setSwapSearch] = useState("");
  const [swapPendingFeat, setSwapPendingFeat] = useState<BuilderFeat | null>(
    null,
  );
  const [editChoiceFeatId, setEditChoiceFeatId] = useState<string | null>(null);
  const [editChoiceSels, setEditChoiceSels] = useState<string[]>([]);
  const [activeFeatsSource, setActiveFeatsSource] = useState<
    "all" | "base" | "vocation" | "selected"
  >("all");

  const baseFeatures = prof?.baseFeatures ?? [];
  const vocationFeatures = vocation?.features ?? [];
  if (
    baseFeatures.length === 0 &&
    vocationFeatures.length === 0 &&
    selectedFeats.length === 0
  ) {
    return (
      <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
        No feats or features.
      </p>
    );
  }

  function toggleFeat(id: string) {
    setExpandedFeats((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  /** Look up resolved option names + effect text from choice_selections. */
  function getResolvedOptions(
    featureName: string,
    entityName: string,
  ):
    | {
        name: string;
        effectText: string;
        sub?: { name: string; effectText: string }[];
      }[]
    | null {
    const key = `${entityName}__${featureName}`;
    const selected = c.choiceSelections?.[key];
    if (!selected?.length) return null;
    const cf = choiceFeatures.find(
      (f) => f.feature_name === featureName && f.entity_name === entityName,
    );
    if (!cf) return null;
    const prefix = `${entityName}__${featureName} `;
    return cf.options
      .filter((o) => selected.includes(o.name))
      .map((o) => {
        // Check for synthetic follow-up selections keyed as "Entity__FeatureName Core (OptionName)"
        // or "Entity__FeatureName Expertise ×N"
        const synthSel =
          c.choiceSelections?.[`${prefix}Core (${o.name})`] ??
          c.choiceSelections?.[
            `${prefix}Expertise ×${o.follow_up?.bump_count ?? 1}`
          ];
        const sub = synthSel?.length
          ? synthSel.map((s) => ({ name: s, effectText: "" }))
          : undefined;
        return { name: o.name, effectText: o.effect_text, sub };
      });
  }

  function FeatRow({
    id,
    name,
    tier,
    activationRaw,
    traits,
    descriptionMarkdown,
    required,
    pathInvestment,
    resolvedOptions,
    ownerName,
  }: {
    id: string;
    name: string;
    tier?: number;
    activationRaw?: string | null;
    traits?: string[];
    descriptionMarkdown: string;
    required?: string | null;
    pathInvestment?: string | null;
    resolvedOptions?:
      | {
          name: string;
          effectText: string;
          sub?: { name: string; effectText: string }[];
        }[]
      | null;
    ownerName?: string;
  }) {
    const expanded = expandedFeats.has(id);
    const isPurchasedFeat = tier !== undefined && ownerName !== undefined;
    return (
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "0.5rem",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "stretch" }}>
          <button
            onClick={() => toggleFeat(id)}
            style={{
              flex: 1,
              padding: "0.625rem 0.875rem",
              backgroundColor: expanded
                ? "var(--primary-light)"
                : "var(--bg-card)",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
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
              }}
            >
              {name}
            </span>
            {resolvedOptions &&
              resolvedOptions.length > 0 &&
              resolvedOptions.map((o, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: "0.65rem",
                    fontFamily: "var(--font-heading)",
                    fontWeight: 600,
                    color: "var(--primary)",
                    backgroundColor: "var(--primary-light)",
                    padding: "0.1rem 0.4rem",
                    borderRadius: "9999px",
                    border: "1px solid var(--primary)",
                  }}
                >
                  {o.sub?.length
                    ? `${o.name} → ${o.sub.map((s) => s.name).join(", ")}`
                    : o.name}
                </span>
              ))}
            {tier !== undefined && (
              <span
                style={{
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  fontFamily: "var(--font-heading)",
                  padding: "0.1rem 0.35rem",
                  borderRadius: "9999px",
                  backgroundColor: "var(--bg-nav)",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border)",
                }}
              >
                Tier {tier}
              </span>
            )}
            {activationRaw &&
              activationRaw !== "-" &&
              activationRaw !== "null" && (
                <span
                  style={{
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    fontFamily: "var(--font-heading)",
                    padding: "0.1rem 0.35rem",
                    borderRadius: "9999px",
                    backgroundColor: "var(--accent-light)",
                    color: "var(--accent)",
                    border: "1px solid rgb(var(--gold-rgb) / 0.40)",
                  }}
                >
                  {activationRaw}
                </span>
              )}
            {traits
              ?.filter((t) => t)
              .map((t) => (
                <span
                  key={t}
                  style={{
                    fontSize: "0.6rem",
                    padding: "0.1rem 0.35rem",
                    borderRadius: "9999px",
                    backgroundColor: "var(--bg-nav)",
                    color: "var(--text-muted)",
                    border: "1px solid var(--border)",
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  {t}
                </span>
              ))}
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
          {(() => {
            const favId = id.startsWith("base-")
              ? id.slice(5)
              : id.startsWith("voc-")
                ? id.slice(4)
                : id;
            const faved = isFavorite("feat", favId);
            return (
              <button
                onClick={() => toggleFavorite("feat", favId)}
                title={faved ? "Remove from Favorites" : "Add to Favorites"}
                style={{
                  background: "none",
                  border: "none",
                  borderLeft: "1px solid var(--border)",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  color: faved ? "var(--primary)" : "var(--text-muted)",
                  padding: "0 10px",
                  flexShrink: 0,
                  backgroundColor: expanded
                    ? "var(--primary-light)"
                    : "var(--bg-card)",
                }}
              >
                {faved ? "★" : "☆"}
              </button>
            );
          })()}
        </div>
        {expanded && (
          <div
            style={{
              padding: "0.75rem 0.875rem",
              borderTop: "1px solid var(--border)",
              backgroundColor: "var(--bg-card)",
            }}
          >
            {resolvedOptions && resolvedOptions.length > 0 && (
              <div
                style={{
                  marginBottom: "0.625rem",
                  padding: "0.5rem 0.75rem",
                  backgroundColor: "var(--primary-light)",
                  border: "1px solid var(--primary)",
                  borderRadius: "0.375rem",
                }}
              >
                <div
                  style={{
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--primary)",
                    fontFamily: "var(--font-heading)",
                    marginBottom: "0.25rem",
                  }}
                >
                  {resolvedOptions.length > 1
                    ? "Chosen options"
                    : "Chosen option"}
                </div>
                {resolvedOptions.map((o) => (
                  <div key={o.name}>
                    <span
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontWeight: 700,
                        fontSize: "0.875rem",
                        color: "var(--primary)",
                      }}
                    >
                      {o.name}:{" "}
                    </span>
                    <span
                      style={{
                        fontSize: "0.825rem",
                        color: "var(--text)",
                        lineHeight: 1.5,
                      }}
                    >
                      {o.effectText}
                    </span>
                    {o.sub?.length ? (
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-muted)",
                          marginLeft: "0.5rem",
                        }}
                      >
                        → {o.sub.map((s) => s.name).join(", ")}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
            {required &&
              (() => {
                const { positiveReqs, exclusions } = parseRequired(required);
                return (
                  <>
                    {positiveReqs.length > 0 && (
                      <div
                        style={{
                          fontSize: "0.72rem",
                          color: "var(--text-muted)",
                          marginBottom: "0.2rem",
                        }}
                      >
                        Requires: {positiveReqs.join(", ")}
                      </div>
                    )}
                    {exclusions.length > 0 && (
                      <div
                        style={{
                          fontSize: "0.72rem",
                          color: "var(--text-muted)",
                          marginBottom: "0.2rem",
                        }}
                      >
                        Cannot own: {exclusions.join(", ")}
                      </div>
                    )}
                  </>
                );
              })()}
            {pathInvestment && (
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "var(--text-muted)",
                  marginBottom: "0.25rem",
                }}
              >
                Investment: {pathInvestment}
              </div>
            )}
            <MarkdownContent content={descriptionMarkdown} />
            {/* AMEND-07: Edit choices + Swap controls for purchased feats */}
            {isPurchasedFeat && (
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  marginTop: "0.75rem",
                  borderTop: "1px solid var(--border)",
                  paddingTop: "0.625rem",
                }}
              >
                {choiceFeatures.some(
                  (cf) =>
                    cf.feature_name === name && cf.entity_name === ownerName,
                ) && (
                  <button
                    onClick={() => {
                      const cf = choiceFeatures.find(
                        (cf) =>
                          cf.feature_name === name &&
                          cf.entity_name === ownerName,
                      );
                      if (!cf) return;
                      const key = `${ownerName}__${name}`;
                      setEditChoiceFeatId(id);
                      setEditChoiceSels(c.choiceSelections?.[key] ?? []);
                    }}
                    style={{
                      padding: "0.25rem 0.625rem",
                      border: "1px solid var(--primary)",
                      borderRadius: "0.25rem",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                      color: "var(--primary)",
                      fontFamily: "var(--font-heading)",
                      fontWeight: 600,
                      fontSize: "0.75rem",
                    }}
                  >
                    ✎ Edit Choice
                  </button>
                )}
                <button
                  onClick={() => {
                    setSwapSourceFeatId(id);
                    setSwapSearch("");
                  }}
                  style={{
                    padding: "0.25rem 0.625rem",
                    border: "1px solid var(--border)",
                    borderRadius: "0.25rem",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-heading)",
                    fontWeight: 600,
                    fontSize: "0.75rem",
                  }}
                >
                  ⇄ Swap Feat
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── Feat Shop helpers ────────────────────────────────────────────────────
  const tierCost = FEAT_COST_BY_TIER[effectiveTier] ?? 6;
  const shopAllFeats = [...professionFeats, ...originFeats];
  const shopProfFeats = professionFeats.filter(
    (f) => f.ownerId === c.professionId,
  );
  const shopOriginFeats = originFeats.filter((f) => f.ownerId === c.originId);
  const shopUniversalFeats = originFeats.filter(
    (f) => f.ownerId === "universal" || f.ownerName === "Universal",
  );

  function recomputeExpertise(
    selectedFeatIds: string[],
    choiceSelections: Record<string, string[]>,
  ): { vitalsExpertiseBumps: Record<string, number> } {
    return {
      vitalsExpertiseBumps: computeExpertiseBumps(
        selectedFeatIds,
        shopAllFeats,
        choiceFeatures,
        choiceSelections,
      ),
    };
  }

  function purchaseFeat(feat: BuilderFeat) {
    const renown = c.renown ?? 0;
    if (renown < tierCost) return;
    const newSelected = [...c.selectedFeatIds, feat.id];
    const newFeatsPurchased = (c.featsPurchased ?? 0) + 1;
    const newTier = Math.max(
      c.tier,
      calcTierFromFeatsPurchased(newFeatsPurchased),
    );

    const newUnspentAttr = (c.unspentAttributePoints ?? 0) + 1;
    const isEvenFeat = newFeatsPurchased % 2 === 0;
    const newUnspentSkill = (c.unspentSkillPoints ?? 0) + (isEvenFeat ? 2 : 0);

    const expertise = recomputeExpertise(newSelected, c.choiceSelections ?? {});

    persist({
      selectedFeatIds: newSelected,
      renown: renown - tierCost,
      featsPurchased: newFeatsPurchased,
      tier: newTier,
      unspentAttributePoints: newUnspentAttr,
      unspentSkillPoints: newUnspentSkill,
      ...expertise,
    });

    const onGainChoices = choiceFeatures.filter(
      (cf) =>
        cf.feature_name === feat.name &&
        cf.entity_name === feat.ownerName &&
        cf.selection_timing === "on_gain" &&
        !c.choiceSelections?.[`${feat.ownerName}__${feat.name}`],
    );
    if (onGainChoices.length > 0) {
      setShopChoiceQueue(onGainChoices);
      setShopChoiceIdx(0);
      setShopCurrentSels([]);
    }
  }

  function confirmShopChoice() {
    const current = shopChoiceQueue[shopChoiceIdx];
    if (!current) return;
    const key = `${current.entity_name}__${current.feature_name}`;
    // Clear any stale synthetic follow-up keys before writing new primary selection
    const clearedSelections = clearFeatChoices(
      c.choiceSelections ?? {},
      current.entity_name,
      current.feature_name,
    );
    const updatedSelections = {
      ...clearedSelections,
      [key]: shopCurrentSels,
    };
    const expertise = recomputeExpertise(c.selectedFeatIds, updatedSelections);
    persist({ choiceSelections: updatedSelections, ...expertise });

    // Build follow-up synthetic choices for options with follow_up spec
    const extraQueue: ChoiceFeature[] = [];
    for (const optionName of shopCurrentSels) {
      const opt = current.options.find((o) => o.name === optionName);
      if (!opt?.follow_up) continue;
      const fu = opt.follow_up;
      const count = fu.count;
      const syntheticName = fu.grants_expertise
        ? `${current.feature_name} Expertise ×${fu.bump_count ?? 1}`
        : `${current.feature_name} Core (${optionName})`;
      const syntheticKey = `${current.entity_name}__${syntheticName}`;
      if (!updatedSelections[syntheticKey]) {
        const options =
          fu.pool === "vitals_skills"
            ? [...VITALS_SET].map((s) => ({
                name: s,
                effect_text: `Gain Expertise in ${s}.`,
              }))
            : (fu.options ?? []);
        extraQueue.push({
          entity_type: current.entity_type,
          entity_name: current.entity_name,
          source_kind: current.source_kind,
          feature_name: syntheticName,
          tier: current.tier,
          path: current.path,
          choice_type: "permanent_choice",
          selection_rule: count === 1 ? "single" : "fixed_count",
          min_choices: count,
          max_choices: count,
          selection_timing: "on_gain",
          branches_from_feature: current.feature_name,
          notes: fu.label ?? `Choose ${count} option(s).`,
          grants_expertise: fu.grants_expertise ?? false,
          options,
        });
      }
    }

    const remainingQueue = shopChoiceQueue.slice(shopChoiceIdx + 1);
    const newQueue = [...extraQueue, ...remainingQueue];
    if (newQueue.length > 0) {
      setShopChoiceQueue(newQueue);
      setShopChoiceIdx(0);
      setShopCurrentSels([]);
    } else {
      setShopChoiceQueue([]);
      setShopChoiceIdx(0);
      setShopCurrentSels([]);
    }
  }

  // AMEND-07: Swap feat — replace old feat with new, clear old choice selections, recalc maxVitality
  function confirmSwap(newFeat: BuilderFeat) {
    if (!swapSourceFeatId) return;
    const oldFeat = shopAllFeats.find((f) => f.id === swapSourceFeatId);
    if (!oldFeat) return;
    const newSelected = c.selectedFeatIds.map((id) =>
      id === swapSourceFeatId ? newFeat.id : id,
    );
    // Clear old feat's choice selections (primary + synthetic follow-ups)
    const updatedSelections = clearFeatChoices(
      c.choiceSelections ?? {},
      oldFeat.ownerName,
      oldFeat.name,
    );
    // Post-swap checks: +1 attr point; +2 skill if even-numbered slot
    const slotIdx = c.selectedFeatIds.indexOf(swapSourceFeatId);
    const isEvenSlot = slotIdx >= 0 && (slotIdx + 1) % 2 === 0;
    const expertise = recomputeExpertise(newSelected, updatedSelections);
    persist({
      selectedFeatIds: newSelected,
      choiceSelections: updatedSelections,
      unspentAttributePoints: (c.unspentAttributePoints ?? 0) + 1,
      unspentSkillPoints: (c.unspentSkillPoints ?? 0) + (isEvenSlot ? 2 : 0),
      ...expertise,
    });
    setSwapSourceFeatId(null);
    setSwapSearch("");
    setSwapPendingFeat(null);
    // Trigger choice resolution for new feat if needed
    const onGainChoices = choiceFeatures.filter(
      (cf) =>
        cf.feature_name === newFeat.name &&
        cf.entity_name === newFeat.ownerName &&
        cf.selection_timing === "on_gain",
    );
    if (onGainChoices.length > 0) {
      setShopChoiceQueue(onGainChoices);
      setShopChoiceIdx(0);
      setShopCurrentSels([]);
      setShowFeatShop(true);
    }
  }

  // AMEND-07: Edit choice for existing feat
  function confirmEditChoice() {
    if (!editChoiceFeatId) return;
    const feat = shopAllFeats.find((f) => f.id === editChoiceFeatId);
    if (!feat) return;
    const key = `${feat.ownerName}__${feat.name}`;
    // Clear stale synthetic follow-up keys before writing new selection
    const clearedSelections = clearFeatChoices(
      c.choiceSelections ?? {},
      feat.ownerName,
      feat.name,
    );
    const updatedSelections = { ...clearedSelections, [key]: editChoiceSels };
    const expertise = recomputeExpertise(c.selectedFeatIds, updatedSelections);
    persist({ choiceSelections: updatedSelections, ...expertise });
    setEditChoiceFeatId(null);
    setEditChoiceSels([]);

    // Find the choice feature for this feat
    const cf = choiceFeatures.find(
      (f) => f.feature_name === feat.name && f.entity_name === feat.ownerName,
    );
    if (!cf) return;
    // Build follow-up queue for options with follow_up spec
    const extraQueue: ChoiceFeature[] = [];
    for (const optionName of editChoiceSels) {
      const opt = cf.options.find((o) => o.name === optionName);
      if (!opt?.follow_up) continue;
      const fu = opt.follow_up;
      const count = fu.count;
      const syntheticName = fu.grants_expertise
        ? `${cf.feature_name} Expertise ×${fu.bump_count ?? 1}`
        : `${cf.feature_name} Core (${optionName})`;
      const options =
        fu.pool === "vitals_skills"
          ? [...VITALS_SET].map((s) => ({
              name: s,
              effect_text: `Gain Expertise in ${s}.`,
            }))
          : (fu.options ?? []);
      extraQueue.push({
        entity_type: cf.entity_type,
        entity_name: cf.entity_name,
        source_kind: cf.source_kind,
        feature_name: syntheticName,
        tier: cf.tier,
        path: cf.path,
        choice_type: "permanent_choice",
        selection_rule: count === 1 ? "single" : "fixed_count",
        min_choices: count,
        max_choices: count,
        selection_timing: "on_gain",
        branches_from_feature: cf.feature_name,
        notes: fu.label ?? `Choose ${count} option(s).`,
        grants_expertise: fu.grants_expertise ?? false,
        options,
      });
    }
    if (extraQueue.length > 0) {
      setShopChoiceQueue(extraQueue);
      setShopChoiceIdx(0);
      setShopCurrentSels([]);
    }
  }

  function renderShopFeatGroup(feats: BuilderFeat[], title: string) {
    const byTier: Record<number, BuilderFeat[]> = {};
    feats.forEach((f) => {
      const t = f.tier ?? 1;
      if (!byTier[t]) byTier[t] = [];
      byTier[t].push(f);
    });
    if (feats.length === 0) return null;
    return (
      <div style={{ marginBottom: "1.25rem" }}>
        <h4
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
            fontSize: "0.9rem",
            color: "var(--text)",
            margin: "0 0 0.625rem",
            paddingBottom: "0.25rem",
            borderBottom: "2px solid var(--primary)",
            display: "inline-block",
          }}
        >
          {title}
        </h4>
        {Object.keys(byTier)
          .map(Number)
          .sort()
          .map((tier) => (
            <div key={tier} style={{ marginBottom: "0.75rem" }}>
              <div
                style={{
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-heading)",
                  marginBottom: "0.35rem",
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
                {byTier[tier].map((feat) => {
                  const owned = c.selectedFeatIds.includes(feat.id);
                  const status = getFeatStatus(
                    feat,
                    c.selectedFeatIds,
                    shopAllFeats,
                    false,
                  );
                  const blocked = status.blocked && !owned;
                  const canAfford = (c.renown ?? 0) >= tierCost;
                  const expanded = shopExpandedIds.has(feat.id);
                  const { positiveReqs, exclusions } = parseRequired(
                    feat.required,
                  );
                  return (
                    <div
                      key={feat.id}
                      style={{
                        border: `1.5px solid ${owned ? "var(--primary)" : "var(--border)"}`,
                        borderRadius: "0.375rem",
                        overflow: "hidden",
                        opacity: blocked ? 0.55 : 1,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          alignItems: "flex-start",
                          padding: "0.5rem 0.75rem",
                          backgroundColor: owned
                            ? "var(--primary-light)"
                            : "var(--bg-card)",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
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
                                fontSize: "0.875rem",
                                color: owned ? "var(--primary)" : "var(--text)",
                              }}
                            >
                              {feat.name}
                            </span>
                            {owned && (
                              <span
                                style={{
                                  fontSize: "0.6rem",
                                  fontWeight: 700,
                                  fontFamily: "var(--font-heading)",
                                  padding: "0.1rem 0.35rem",
                                  borderRadius: "9999px",
                                  backgroundColor: "var(--primary)",
                                  color: "var(--text-on-primary)",
                                }}
                              >
                                Owned
                              </span>
                            )}
                            {feat.activationRaw &&
                              feat.activationRaw !== "-" &&
                              feat.activationRaw !== "null" && (
                                <span
                                  style={{
                                    fontSize: "0.62rem",
                                    fontFamily: "var(--font-heading)",
                                    fontWeight: 600,
                                    color: "var(--accent)",
                                    padding: "0.1rem 0.35rem",
                                    borderRadius: "9999px",
                                    backgroundColor: "var(--accent-light)",
                                    border:
                                      "1px solid rgb(var(--gold-rgb) / 0.40)",
                                  }}
                                >
                                  {feat.activationRaw}
                                </span>
                              )}
                          </div>
                          {status.reason && !owned && (
                            <div
                              style={{
                                fontSize: "0.7rem",
                                color: "var(--text-muted)",
                                fontStyle: "italic",
                                marginTop: "0.1rem",
                              }}
                            >
                              ⚠ {status.reason}
                            </div>
                          )}
                          {!status.reason && positiveReqs.length > 0 && (
                            <div
                              style={{
                                fontSize: "0.7rem",
                                color: "var(--text-muted)",
                                marginTop: "0.1rem",
                              }}
                            >
                              Requires: {positiveReqs.join(", ")}
                            </div>
                          )}
                          {!status.reason && exclusions.length > 0 && (
                            <div
                              style={{
                                fontSize: "0.7rem",
                                color: "var(--text-muted)",
                                marginTop: "0.1rem",
                              }}
                            >
                              Cannot own: {exclusions.join(", ")}
                            </div>
                          )}
                          {feat.pathInvestment && !status.reason && (
                            <div
                              style={{
                                fontSize: "0.7rem",
                                color: "var(--text-muted)",
                                marginTop: "0.1rem",
                              }}
                            >
                              Investment: {feat.pathInvestment}
                            </div>
                          )}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "0.35rem",
                            alignItems: "center",
                            flexShrink: 0,
                          }}
                        >
                          <button
                            onClick={() =>
                              setShopExpandedIds((prev) => {
                                const n = new Set(prev);
                                n.has(feat.id)
                                  ? n.delete(feat.id)
                                  : n.add(feat.id);
                                return n;
                              })
                            }
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "0.65rem",
                              color: "var(--text-muted)",
                              padding: "0.15rem 0.25rem",
                            }}
                          >
                            {expanded ? "▲" : "▼"}
                          </button>
                          {!owned && (
                            <button
                              onClick={() => purchaseFeat(feat)}
                              disabled={blocked || !canAfford}
                              style={{
                                padding: "0.2rem 0.625rem",
                                fontSize: "0.72rem",
                                fontFamily: "var(--font-heading)",
                                fontWeight: 700,
                                border: "none",
                                borderRadius: "0.25rem",
                                cursor:
                                  blocked || !canAfford
                                    ? "not-allowed"
                                    : "pointer",
                                backgroundColor:
                                  blocked || !canAfford
                                    ? "var(--border)"
                                    : "var(--primary)",
                                color: "var(--text-on-primary)",
                              }}
                            >
                              {tierCost} Renown
                            </button>
                          )}
                        </div>
                      </div>
                      {expanded && (
                        <div
                          style={{
                            padding: "0.5rem 0.75rem",
                            borderTop: "1px solid var(--border)",
                            backgroundColor: "var(--bg-nav)",
                            fontSize: "0.82rem",
                            lineHeight: 1.65,
                            color: "var(--text)",
                          }}
                        >
                          <MarkdownContent content={feat.descriptionMarkdown} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
      </div>
    );
  }

  const sourceSections: {
    key: "base" | "vocation" | "selected";
    label: string;
    color: string;
    count: number;
  }[] = (
    [
      {
        key: "base" as const,
        label: c.professionName || "Base",
        color: "var(--c-prof)",
        count: baseFeatures.length,
      },
      {
        key: "vocation" as const,
        label: c.vocationName || "Vocation",
        color: "var(--c-feat)",
        count: vocationFeatures.length,
      },
      {
        key: "selected" as const,
        label: "Feats",
        color: "var(--c-origin)",
        count: selectedFeats.length,
      },
    ] as const
  ).filter((s) => s.count > 0) as {
    key: "base" | "vocation" | "selected";
    label: string;
    color: string;
    count: number;
  }[];

  const showBase = activeFeatsSource === "all" || activeFeatsSource === "base";
  const showVocation =
    activeFeatsSource === "all" || activeFeatsSource === "vocation";
  const showSelected =
    activeFeatsSource === "all" || activeFeatsSource === "selected";

  return (
    <div>
      <div
        style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}
      >
        {/* Source rail */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
            minWidth: "90px",
            flexShrink: 0,
            position: "sticky",
            top: "0.5rem",
          }}
        >
          <button
            onClick={() => setActiveFeatsSource("all")}
            style={{
              padding: "0.35rem 0.5rem",
              textAlign: "left",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer",
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              fontSize: "0.7rem",
              backgroundColor:
                activeFeatsSource === "all"
                  ? "var(--primary-light)"
                  : "transparent",
              color:
                activeFeatsSource === "all"
                  ? "var(--primary)"
                  : "var(--text-muted)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>All</span>
            <span style={{ fontSize: "0.62rem", opacity: 0.7 }}>
              {baseFeatures.length +
                vocationFeatures.length +
                selectedFeats.length}
            </span>
          </button>
          {sourceSections.map(({ key, label, color, count }) => (
            <button
              key={key}
              onClick={() => setActiveFeatsSource(key)}
              style={{
                padding: "0.35rem 0.5rem",
                textAlign: "left",
                border: "none",
                borderRadius: "0.375rem",
                cursor: "pointer",
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
                fontSize: "0.7rem",
                backgroundColor:
                  activeFeatsSource === key
                    ? `rgb(${color === "var(--c-prof)" ? "var(--c-prof-rgb)" : color === "var(--c-feat)" ? "var(--c-feat-rgb)" : "var(--c-origin-rgb)"} / 0.12)`
                    : "transparent",
                color: activeFeatsSource === key ? color : "var(--text-muted)",
                borderLeft:
                  activeFeatsSource === key
                    ? `3px solid ${color}`
                    : "3px solid transparent",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "60px",
                }}
              >
                {label}
              </span>
              <span
                style={{ fontSize: "0.62rem", opacity: 0.7, flexShrink: 0 }}
              >
                {count}
              </span>
            </button>
          ))}
          <div
            style={{
              borderTop: "1px solid var(--border)",
              marginTop: "0.25rem",
              paddingTop: "0.25rem",
            }}
          />
        </div>

        {/* Feat list */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.4rem",
          }}
        >
          {/* Purchase Feats button */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: "0.5rem",
            }}
          >
            <button
              onClick={() => setShowFeatShop(true)}
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
              Purchase Feats
            </button>
          </div>

          {baseFeatures.length > 0 && showBase && (
            <>
              <div
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--c-prof)",
                  fontFamily: "var(--font-heading)",
                  marginBottom: "0.2rem",
                  paddingLeft: "0.625rem",
                  borderLeft: "3px solid var(--c-prof)",
                }}
              >
                Base Features
              </div>
              {baseFeatures.map((f) => (
                <FeatRow
                  key={`base-${f.id}`}
                  id={`base-${f.id}`}
                  name={f.name}
                  activationRaw={f.activationRaw}
                  traits={f.traits}
                  descriptionMarkdown={f.descriptionMarkdown}
                  resolvedOptions={getResolvedOptions(f.name, c.professionName)}
                />
              ))}
            </>
          )}
          {vocationFeatures.length > 0 && showVocation && (
            <>
              <div
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--c-feat)",
                  fontFamily: "var(--font-heading)",
                  marginTop: "0.5rem",
                  marginBottom: "0.2rem",
                  paddingLeft: "0.625rem",
                  borderLeft: "3px solid var(--c-feat)",
                }}
              >
                Vocation Features
              </div>
              {vocationFeatures.map((f) => (
                <FeatRow
                  key={`voc-${f.id}`}
                  id={`voc-${f.id}`}
                  name={f.name}
                  activationRaw={f.activationRaw}
                  traits={f.traits}
                  descriptionMarkdown={f.descriptionMarkdown}
                  resolvedOptions={getResolvedOptions(f.name, c.vocationName)}
                />
              ))}
            </>
          )}
          {selectedFeats.length > 0 && showSelected && (
            <>
              <div
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--c-origin)",
                  fontFamily: "var(--font-heading)",
                  marginTop: "0.5rem",
                  marginBottom: "0.2rem",
                  paddingLeft: "0.625rem",
                  borderLeft: "3px solid var(--c-origin)",
                }}
              >
                Selected Feats
              </div>
              {selectedFeats.map((f) => (
                <FeatRow
                  key={`feat-${f.id}`}
                  id={f.id}
                  name={f.name}
                  tier={f.tier}
                  activationRaw={f.activationRaw}
                  traits={f.traits}
                  descriptionMarkdown={f.descriptionMarkdown}
                  required={f.required}
                  pathInvestment={f.pathInvestment}
                  resolvedOptions={getResolvedOptions(f.name, f.ownerName)}
                  ownerName={f.ownerName}
                />
              ))}
            </>
          )}
          {baseFeatures.length === 0 &&
            vocationFeatures.length === 0 &&
            selectedFeats.length === 0 && (
              <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                No feats or features yet.
              </p>
            )}
        </div>
        {/* end feat list col */}
      </div>
      {/* end source rail + list flex */}

      {/* AMEND-07: Edit Choice Modal */}
      {editChoiceFeatId &&
        (() => {
          const feat = shopAllFeats.find((f) => f.id === editChoiceFeatId);
          if (!feat) return null;
          const cf = choiceFeatures.find(
            (c2) =>
              c2.feature_name === feat.name &&
              c2.entity_name === feat.ownerName,
          );
          if (!cf) return null;
          const canConfirm = editChoiceSels.length >= cf.min_choices;
          return (
            <div
              style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.55)",
                zIndex: 60,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "2rem 1rem",
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setEditChoiceFeatId(null);
                  setEditChoiceSels([]);
                }
              }}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: "500px",
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
                    backgroundColor: "var(--bg-nav)",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontWeight: 700,
                        fontSize: "1rem",
                        color: "var(--text)",
                      }}
                    >
                      Edit Choice: {feat.name}
                    </div>
                    <div
                      style={{
                        fontSize: "0.72rem",
                        color: "var(--text-muted)",
                        marginTop: "0.1rem",
                      }}
                    >
                      Select{" "}
                      {cf.min_choices === cf.max_choices
                        ? cf.min_choices
                        : `${cf.min_choices}–${cf.max_choices}`}{" "}
                      option{cf.max_choices !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setEditChoiceFeatId(null);
                      setEditChoiceSels([]);
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
                <div style={{ padding: "1rem 1.25rem" }}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.375rem",
                      marginBottom: "0.75rem",
                    }}
                  >
                    {cf.options.map((opt) => {
                      const sel = editChoiceSels.includes(opt.name);
                      return (
                        <button
                          key={opt.name}
                          onClick={() => {
                            setEditChoiceSels((prev) => {
                              if (sel)
                                return prev.filter((n) => n !== opt.name);
                              if (prev.length >= cf.max_choices)
                                return [...prev.slice(1), opt.name];
                              return [...prev, opt.name];
                            });
                          }}
                          style={{
                            padding: "0.5rem 0.875rem",
                            border: `2px solid ${sel ? "var(--primary)" : "var(--border)"}`,
                            borderRadius: "0.375rem",
                            backgroundColor: sel
                              ? "var(--primary-light)"
                              : "var(--bg-card)",
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "var(--font-heading)",
                              fontWeight: 700,
                              fontSize: "0.85rem",
                              color: sel ? "var(--primary)" : "var(--text)",
                            }}
                          >
                            {opt.name}
                          </span>
                          {opt.effect_text && (
                            <div
                              style={{
                                fontSize: "0.75rem",
                                color: "var(--text-muted)",
                                marginTop: "0.1rem",
                              }}
                            >
                              {opt.effect_text}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      color: "var(--gold-dim)",
                      backgroundColor: "rgb(var(--gold-rgb) / 0.09)",
                      border: "1px solid rgb(var(--gold-rgb) / 0.40)",
                      borderRadius: "0.375rem",
                      padding: "0.375rem 0.625rem",
                      marginBottom: "0.625rem",
                    }}
                  >
                    Saving will update any passive effects this feat applies.
                  </div>
                  <button
                    onClick={confirmEditChoice}
                    disabled={!canConfirm}
                    style={{
                      padding: "0.375rem 0.875rem",
                      border: "none",
                      borderRadius: "0.375rem",
                      backgroundColor: canConfirm
                        ? "var(--primary)"
                        : "var(--border)",
                      color: "var(--text-on-primary)",
                      cursor: canConfirm ? "pointer" : "not-allowed",
                      fontFamily: "var(--font-heading)",
                      fontWeight: 700,
                      fontSize: "0.8rem",
                    }}
                  >
                    Save Choice
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* AMEND-07: Swap Feat Modal */}
      {swapSourceFeatId &&
        (() => {
          const sourceFeat = shopAllFeats.find(
            (f) => f.id === swapSourceFeatId,
          );
          if (!sourceFeat) return null;
          const closeSwap = () => {
            setSwapSourceFeatId(null);
            setSwapSearch("");
            setSwapPendingFeat(null);
          };
          const eligibleForSwap = shopAllFeats.filter((f) => {
            if (f.id === swapSourceFeatId) return false;
            if (c.selectedFeatIds.includes(f.id)) return false;
            const s = getFeatStatus(
              f,
              c.selectedFeatIds.filter((id) => id !== swapSourceFeatId),
              shopAllFeats,
              false,
            );
            return !s.blocked;
          });
          const filtered = swapSearch.trim()
            ? eligibleForSwap.filter((f) =>
                f.name.toLowerCase().includes(swapSearch.toLowerCase()),
              )
            : eligibleForSwap;
          const grouped: Record<string, BuilderFeat[]> = {};
          filtered.forEach((f) => {
            const k = f.ownerName;
            if (!grouped[k]) grouped[k] = [];
            grouped[k].push(f);
          });
          const slotIdx = c.selectedFeatIds.indexOf(swapSourceFeatId);
          const isEvenSlot = slotIdx >= 0 && (slotIdx + 1) % 2 === 0;
          return (
            <div
              style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.55)",
                zIndex: 60,
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
                padding: "2rem 1rem",
                overflowY: "auto",
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) closeSwap();
              }}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: "620px",
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
                    backgroundColor: "var(--bg-nav)",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontWeight: 700,
                        fontSize: "1rem",
                        color: "var(--text)",
                      }}
                    >
                      {swapPendingFeat
                        ? `Confirm Swap: ${sourceFeat.name}`
                        : `Swap: ${sourceFeat.name}`}
                    </div>
                    <div
                      style={{
                        fontSize: "0.72rem",
                        color: "var(--text-muted)",
                        marginTop: "0.1rem",
                      }}
                    >
                      {swapPendingFeat
                        ? "Review changes below before confirming."
                        : "Choose replacement feat. Old feat effects removed, new applied immediately."}
                    </div>
                  </div>
                  <button
                    onClick={closeSwap}
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

                {swapPendingFeat ? (
                  /* Confirmation view */
                  <div style={{ padding: "1.25rem" }}>
                    <div
                      style={{
                        padding: "0.75rem 1rem",
                        backgroundColor: "var(--bg-nav)",
                        border: "1px solid var(--border)",
                        borderRadius: "0.5rem",
                        marginBottom: "1rem",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.65rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.07em",
                          color: "var(--text-muted)",
                          fontFamily: "var(--font-heading)",
                          marginBottom: "0.5rem",
                        }}
                      >
                        Changes
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          marginBottom: "0.375rem",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "var(--font-heading)",
                            fontWeight: 700,
                            fontSize: "0.85rem",
                            color: "var(--text)",
                            textDecoration: "line-through",
                            opacity: 0.6,
                          }}
                        >
                          {sourceFeat.name}
                        </span>
                        <span
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          →
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-heading)",
                            fontWeight: 700,
                            fontSize: "0.85rem",
                            color: "var(--primary)",
                          }}
                        >
                          {swapPendingFeat.name}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-muted)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.15rem",
                          marginTop: "0.375rem",
                        }}
                      >
                        <span>+1 Attribute Point</span>
                        {isEvenSlot && (
                          <span>+2 Skill Points (even-numbered feat slot)</span>
                        )}
                        {swapPendingFeat.descriptionMarkdown && (
                          <div
                            style={{
                              marginTop: "0.35rem",
                              fontSize: "0.72rem",
                              color: "var(--text-muted)",
                              borderTop: "1px solid var(--border)",
                              paddingTop: "0.35rem",
                            }}
                          >
                            {swapPendingFeat.descriptionMarkdown
                              .replace(/[*#_`]/g, "")
                              .slice(0, 160)}
                            …
                          </div>
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "0.5rem 0.75rem",
                        backgroundColor: "rgb(var(--gold-rgb) / 0.09)",
                        border: "1px solid rgb(var(--gold-rgb) / 0.40)",
                        borderRadius: "0.375rem",
                        fontSize: "0.75rem",
                        color: "var(--gold-dim)",
                        marginBottom: "1rem",
                      }}
                    >
                      All passive effects from{" "}
                      <strong>{sourceFeat.name}</strong> will be removed and
                      replaced with <strong>{swapPendingFeat.name}</strong>.
                      This cannot be undone automatically.
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        onClick={() => confirmSwap(swapPendingFeat)}
                        style={{
                          padding: "0.375rem 0.875rem",
                          border: "none",
                          borderRadius: "0.375rem",
                          backgroundColor: "var(--primary)",
                          color: "var(--text-on-primary)",
                          cursor: "pointer",
                          fontFamily: "var(--font-heading)",
                          fontWeight: 700,
                          fontSize: "0.8rem",
                        }}
                      >
                        Confirm Swap ⇄
                      </button>
                      <button
                        onClick={() => setSwapPendingFeat(null)}
                        style={{
                          padding: "0.375rem 0.875rem",
                          border: "1px solid var(--border)",
                          borderRadius: "0.375rem",
                          backgroundColor: "transparent",
                          color: "var(--text)",
                          cursor: "pointer",
                          fontFamily: "var(--font-heading)",
                          fontWeight: 600,
                          fontSize: "0.8rem",
                        }}
                      >
                        Back
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Feat selection list */
                  <div
                    style={{
                      padding: "1rem 1.25rem",
                      maxHeight: "65vh",
                      overflowY: "auto",
                    }}
                  >
                    <input
                      value={swapSearch}
                      onChange={(e) => setSwapSearch(e.target.value)}
                      placeholder="Search feats…"
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
                        marginBottom: "0.75rem",
                        boxSizing: "border-box",
                      }}
                    />
                    {filtered.length === 0 && (
                      <p
                        style={{
                          color: "var(--text-muted)",
                          fontSize: "0.875rem",
                        }}
                      >
                        No eligible feats.
                      </p>
                    )}
                    {Object.entries(grouped).map(([owner, feats]) => (
                      <div key={owner} style={{ marginBottom: "1rem" }}>
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
                          {owner}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.3rem",
                          }}
                        >
                          {feats.map((f) => (
                            <div
                              key={f.id}
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "0.5rem",
                                padding: "0.5rem 0.75rem",
                                backgroundColor: "var(--bg-nav)",
                                border: "1px solid var(--border)",
                                borderRadius: "0.375rem",
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    fontFamily: "var(--font-heading)",
                                    fontWeight: 700,
                                    fontSize: "0.875rem",
                                    color: "var(--text)",
                                  }}
                                >
                                  {f.name}
                                </div>
                                {f.required && (
                                  <div
                                    style={{
                                      fontSize: "0.7rem",
                                      color: "var(--text-muted)",
                                      marginTop: "0.1rem",
                                    }}
                                  >
                                    Req: {f.required}
                                  </div>
                                )}
                                <div
                                  style={{
                                    fontSize: "0.72rem",
                                    color: "var(--text-muted)",
                                    marginTop: "0.2rem",
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                  }}
                                >
                                  {f.descriptionMarkdown
                                    .replace(/[*#_`]/g, "")
                                    .slice(0, 120)}
                                  …
                                </div>
                              </div>
                              <button
                                onClick={() => setSwapPendingFeat(f)}
                                style={{
                                  padding: "0.25rem 0.75rem",
                                  border: "none",
                                  borderRadius: "0.25rem",
                                  backgroundColor: "var(--primary)",
                                  color: "var(--text-on-primary)",
                                  cursor: "pointer",
                                  fontFamily: "var(--font-heading)",
                                  fontWeight: 700,
                                  fontSize: "0.75rem",
                                  flexShrink: 0,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Select ⇄
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

      {/* Feat Shop Modal */}
      {showFeatShop && (
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
            if (e.target === e.currentTarget) setShowFeatShop(false);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "660px",
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              overflow: "hidden",
            }}
          >
            {/* Shop header */}
            <div
              style={{
                padding: "1rem 1.25rem",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
                flexWrap: "wrap",
                backgroundColor: "var(--bg-nav)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontWeight: 700,
                    fontSize: "1rem",
                    color: "var(--text)",
                  }}
                >
                  Purchase Feats
                </span>
                <span
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  Tier {effectiveTier}
                </span>
                <span
                  style={{
                    fontSize: "0.8rem",
                    fontFamily: "var(--font-heading)",
                    fontWeight: 700,
                    color: "var(--primary)",
                  }}
                >
                  Renown: {c.renown ?? 0}
                </span>
                <span
                  style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}
                >
                  Cost: {tierCost} Renown / feat
                </span>
              </div>
              <button
                onClick={() => setShowFeatShop(false)}
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

            {/* Choice resolution overlay inside shop */}
            {shopChoiceQueue.length > 0 &&
              shopChoiceIdx < shopChoiceQueue.length && (
                <div
                  style={{
                    padding: "1rem 1.25rem",
                    backgroundColor: "var(--primary-light)",
                    borderBottom: "1px solid var(--primary)",
                  }}
                >
                  {(() => {
                    const cf = shopChoiceQueue[shopChoiceIdx];
                    const canConfirm = shopCurrentSels.length >= cf.min_choices;
                    return (
                      <div>
                        <div
                          style={{
                            fontFamily: "var(--font-heading)",
                            fontWeight: 700,
                            fontSize: "0.9rem",
                            color: "var(--primary)",
                            marginBottom: "0.375rem",
                          }}
                        >
                          Choose for: {cf.feature_name}
                        </div>
                        <div
                          style={{
                            fontSize: "0.78rem",
                            color: "var(--text-muted)",
                            marginBottom: "0.625rem",
                          }}
                        >
                          Select{" "}
                          {cf.min_choices === cf.max_choices
                            ? cf.min_choices
                            : `${cf.min_choices}–${cf.max_choices}`}{" "}
                          option{cf.max_choices !== 1 ? "s" : ""}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.375rem",
                            marginBottom: "0.75rem",
                          }}
                        >
                          {cf.options.map((opt) => {
                            const sel = shopCurrentSels.includes(opt.name);
                            return (
                              <button
                                key={opt.name}
                                onClick={() => {
                                  setShopCurrentSels((prev) => {
                                    if (sel)
                                      return prev.filter((n) => n !== opt.name);
                                    if (prev.length >= cf.max_choices)
                                      return [...prev.slice(1), opt.name];
                                    return [...prev, opt.name];
                                  });
                                }}
                                style={{
                                  padding: "0.5rem 0.875rem",
                                  border: `2px solid ${sel ? "var(--primary)" : "var(--border)"}`,
                                  borderRadius: "0.375rem",
                                  backgroundColor: sel
                                    ? "var(--primary-light)"
                                    : "var(--bg-card)",
                                  cursor: "pointer",
                                  textAlign: "left",
                                }}
                              >
                                <span
                                  style={{
                                    fontFamily: "var(--font-heading)",
                                    fontWeight: 700,
                                    fontSize: "0.85rem",
                                    color: sel
                                      ? "var(--primary)"
                                      : "var(--text)",
                                  }}
                                >
                                  {opt.name}
                                </span>
                                {opt.effect_text && (
                                  <div
                                    style={{
                                      fontSize: "0.75rem",
                                      color: "var(--text-muted)",
                                      marginTop: "0.1rem",
                                    }}
                                  >
                                    {opt.effect_text}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          onClick={confirmShopChoice}
                          disabled={!canConfirm}
                          style={{
                            padding: "0.375rem 0.875rem",
                            border: "none",
                            borderRadius: "0.375rem",
                            backgroundColor: canConfirm
                              ? "var(--primary)"
                              : "var(--border)",
                            color: "var(--text-on-primary)",
                            cursor: canConfirm ? "pointer" : "not-allowed",
                            fontFamily: "var(--font-heading)",
                            fontWeight: 700,
                            fontSize: "0.8rem",
                          }}
                        >
                          Confirm
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}

            {/* Feat list */}
            <div
              style={{
                padding: "1.25rem",
                maxHeight: "65vh",
                overflowY: "auto",
              }}
            >
              {(c.renown ?? 0) < tierCost && (
                <div
                  style={{
                    padding: "0.5rem 0.75rem",
                    backgroundColor: "var(--accent-light)",
                    border: "1px solid rgb(var(--gold-rgb) / 0.40)",
                    borderRadius: "0.375rem",
                    fontSize: "0.8rem",
                    color: "var(--gold-dim)",
                    marginBottom: "1rem",
                  }}
                >
                  Not enough Renown to purchase this feat. You need {tierCost}{" "}
                  Renown (have {c.renown ?? 0}).
                </div>
              )}
              {renderShopFeatGroup(shopProfFeats, `${c.professionName} Feats`)}
              {renderShopFeatGroup(shopOriginFeats, `${c.originName} Feats`)}
              {renderShopFeatGroup(shopUniversalFeats, "Universal Feats")}
              {shopProfFeats.length === 0 &&
                shopOriginFeats.length === 0 &&
                shopUniversalFeats.length === 0 && (
                  <p
                    style={{
                      color: "var(--text-muted)",
                      fontSize: "0.875rem",
                    }}
                  >
                    No feats available for your profession and origin.
                  </p>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
