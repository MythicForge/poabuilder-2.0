"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import MarkdownContent from "./MarkdownContent";
import { saveCharacter, parseCurrency } from "@/lib/characterStorage";
import {
  calcStartingVitality,
  calcFortitude,
  calcMentalDefense,
  calcWillDefense,
  calcMaxWounds,
  calcCarryWeight,
  calcReservoir,
  calcSpellDC,
  FEAT_ALLOWANCE,
  calcFeatVitalityBonus,
  calcAmbition,
  calcSpellcastingThreshold,
  calcSpellcastingTier,
  computeExpertiseBumps,
  clearFeatChoices,
  computeKnownSpheres,
  evalResourceMax,
} from "@/lib/characterCalc";
import type {
  BuilderProfession,
  BuilderOrigin,
  BuilderFeat,
  BuilderSpell,
  Character,
  AttributeKey,
  CharacterAttributes,
  BuilderVocationCaster,
  ChoiceFeature,
} from "@/lib/characterTypes";
import type { CatalogItem } from "@/lib/builderData";
import { getFeatStatus, parseRequired } from "@/lib/featLogic";

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_VITALS = [
  "Vigor",
  "Intuition",
  "Talent",
  "Awareness",
  "Lore",
  "Social",
];

const STEPS = [
  { id: 1, label: "Tier" },
  { id: 2, label: "Profession" },
  { id: 3, label: "Origin" },
  { id: 4, label: "Items" },
  { id: 5, label: "Proficiencies" },
  { id: 6, label: "Attributes" },
  { id: 7, label: "Feats" },
  { id: 8, label: "Summary" },
];

const STEP_TITLES: Record<number, string> = {
  1: "Name & Tier",
  2: "Choose a Profession",
  3: "Choose an Origin",
  4: "Starting Items",
  5: "V.I.T.A.L.S. & Proficiencies",
  6: "Assign Attributes",
  7: "Select Feats",
  8: "Character Summary",
};

// ─── Draft type ───────────────────────────────────────────────────────────────

interface Draft {
  name: string;
  tier: number;
  featAllowance: number;
  professionId: string;
  professionName: string;
  originId: string;
  originName: string;
  vocationId: string;
  vocationName: string;
  vocationAttributeBonus: { attribute: AttributeKey; value: number };
  vocationCaster: BuilderVocationCaster | null;
  baseAttributes: CharacterAttributes;
  vitalsProficiencies: string[];
  spellcastingModifier: AttributeKey | null;
  selectedFeatIds: string[];
  knownSpellIds: string[];
  ambition: string;
  inventoryNotes: string;
  currency: string;
  notes: string;
  choiceSelections: Record<string, string[]>;
}

const emptyDraft: Draft = {
  name: "",
  tier: 1,
  featAllowance: 0,
  professionId: "",
  professionName: "",
  originId: "",
  originName: "",
  vocationId: "",
  vocationName: "",
  vocationAttributeBonus: { attribute: "brawn", value: 1 },
  vocationCaster: null,
  baseAttributes: { brawn: 0, finesse: 0, mind: 0, will: 0 },
  vitalsProficiencies: [],
  spellcastingModifier: null,
  selectedFeatIds: [],
  knownSpellIds: [],
  ambition: "",
  inventoryNotes: "",
  currency: "",
  notes: "",
  choiceSelections: {},
};

// ─── Feat logic helpers are imported from @/lib/featLogic ────────────────────

// ─── Shared UI ────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "0.65rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--text-muted)",
        fontFamily: "var(--font-heading)",
        marginBottom: "0.5rem",
      }}
    >
      {children}
    </div>
  );
}

function StatBox({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "0.625rem 0.5rem",
        backgroundColor: "var(--bg-nav)",
        border: "1px solid var(--border)",
        borderRadius: "0.375rem",
      }}
    >
      <div
        style={{
          fontSize: "1.2rem",
          fontWeight: 700,
          fontFamily: "var(--font-heading)",
          color: "var(--primary)",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: "0.6rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--text-muted)",
          fontFamily: "var(--font-heading)",
        }}
      >
        {label}
      </div>
      {sub && (
        <div
          style={{
            fontSize: "0.58rem",
            color: "var(--text-muted)",
            marginTop: "0.1rem",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  professions: BuilderProfession[];
  origins: BuilderOrigin[];
  professionFeats: BuilderFeat[];
  originFeats: BuilderFeat[];
  spells: BuilderSpell[];
  choiceFeatures: ChoiceFeature[];
  catalog: CatalogItem[];
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CharacterBuilder({
  professions,
  origins,
  professionFeats,
  originFeats,
  spells,
  choiceFeatures,
  catalog,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  // Expand state for feat/spell preview in builder
  const [expandedFeatIds, setExpandedFeatIds] = useState<Set<string>>(
    new Set(),
  );
  const [expandedSpellIds, setExpandedSpellIds] = useState<Set<string>>(
    new Set(),
  );

  function toggleBuilderFeat(id: string) {
    setExpandedFeatIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleBuilderSpell(id: string) {
    setExpandedSpellIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Choice resolution queue
  const [choiceQueue, setChoiceQueue] = useState<ChoiceFeature[]>([]);
  const [choiceQueueIdx, setChoiceQueueIdx] = useState(0);
  const [pendingStep, setPendingStep] = useState<number | null>(null);
  const [currentSelections, setCurrentSelections] = useState<string[]>([]);

  // Starting-pack choices: "X or Y" toggles, "Pick N" multi-selects, "of choice" catalog picks
  const [packChoices, setPackChoices] = useState<Record<string, string>>({});
  const [packPickChoices, setPackPickChoices] = useState<
    Record<string, string[]>
  >({});
  // packFreeChoices: key → array of chosen catalog item IDs (one per "of choice" slot)
  const [packFreeChoices, setPackFreeChoices] = useState<
    Record<string, string[]>
  >({});
  const [packFreeSearch, setPackFreeSearch] = useState<Record<string, string>>(
    {},
  );

  function update(partial: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...partial }));
  }

  const selectedProf =
    professions.find((p) => p.id === draft.professionId) ?? null;
  const selectedOrigin = origins.find((o) => o.id === draft.originId) ?? null;
  const selectedVocation =
    selectedOrigin?.vocations.find((v) => v.id === draft.vocationId) ?? null;

  const totalAttributes = {
    brawn:
      draft.baseAttributes.brawn +
      (draft.vocationAttributeBonus.attribute === "brawn"
        ? draft.vocationAttributeBonus.value
        : 0),
    finesse:
      draft.baseAttributes.finesse +
      (draft.vocationAttributeBonus.attribute === "finesse"
        ? draft.vocationAttributeBonus.value
        : 0),
    mind:
      draft.baseAttributes.mind +
      (draft.vocationAttributeBonus.attribute === "mind"
        ? draft.vocationAttributeBonus.value
        : 0),
    will:
      draft.baseAttributes.will +
      (draft.vocationAttributeBonus.attribute === "will"
        ? draft.vocationAttributeBonus.value
        : 0),
  };

  const allFeats = useMemo(
    () => [...professionFeats, ...originFeats],
    [professionFeats, originFeats],
  );
  const myProfFeats = professionFeats.filter(
    (f) => f.ownerId === draft.professionId,
  );
  const myOriginFeats = originFeats.filter((f) => f.ownerId === draft.originId);

  const featVitalityBonus = calcFeatVitalityBonus(
    draft.selectedFeatIds,
    allFeats,
    draft.tier,
  );
  const atFeatCap =
    draft.selectedFeatIds.length >= draft.featAllowance &&
    draft.featAllowance > 0;

  // Effective caster: profession, vocation, OR a selected feat that grants spellcasting
  const featCaster = useMemo(() => {
    for (const id of draft.selectedFeatIds) {
      const feat = allFeats.find((f) => f.id === id);
      if (feat?.casterInfo) return feat.casterInfo;
    }
    return null;
  }, [draft.selectedFeatIds, allFeats]);

  const effectiveCaster = selectedProf?.casterType
    ? {
        casterType: selectedProf.casterType,
        casterSource: selectedProf.casterSource ?? "",
        casterModifierOptions: selectedProf.casterModifierOptions,
      }
    : (draft.vocationCaster ?? featCaster);

  const knownSpheres = useMemo(
    () => computeKnownSpheres(draft.choiceSelections, choiceFeatures),
    [draft.choiceSelections, choiceFeatures],
  );

  const mySpells = useMemo(() => {
    const source = effectiveCaster?.casterSource;
    if (!source) return [];
    const profName = draft.professionName;
    const originName = draft.originName;
    const vocationName = draft.vocationName;
    return spells.filter((s) => {
      if (s.isCantrip) {
        if (s.grantedByOwners.length === 0) return false;
        return s.grantedByOwners.some((entry) => {
          if (entry.includes(":")) {
            const [orig, voc] = entry.split(":");
            return orig === originName && voc === vocationName;
          }
          return (
            entry === profName ||
            entry === originName ||
            entry === vocationName ||
            (knownSpheres.size > 0 && knownSpheres.has(entry))
          );
        });
      }
      const isUniversal = s.sources.includes("Universal");
      const sourceMatch = s.sources.includes(source) || s.sources.includes(profName);
      const sphereMatch = knownSpheres.size > 0 && !!s.school && knownSpheres.has(s.school);
      return isUniversal || sourceMatch || sphereMatch;
    });
  }, [spells, effectiveCaster, draft.professionName, draft.originName, draft.vocationName, knownSpheres]);

  const totalBasePoints =
    draft.baseAttributes.brawn +
    draft.baseAttributes.finesse +
    draft.baseAttributes.mind +
    draft.baseAttributes.will;

  // ─── Navigation ──────────────────────────────────────────────────────────

  function canAdvance(): boolean {
    if (step === 1) return draft.name.trim().length > 0;
    if (step === 2) return !!draft.professionId;
    if (step === 3) return !!draft.originId && !!draft.vocationId;
    if (step === 4) return true; // read-only
    if (step === 5)
      return (
        draft.vitalsProficiencies.length ===
        (selectedProf?.vitalsChoiceCount ?? 0)
      );
    if (step === 6) return totalBasePoints === 5;
    return true;
  }

  // ─── Choice resolution ───────────────────────────────────────────────────

  /** Return all on_gain choice features for the given feature names + entity name that haven't been resolved yet. */
  function getUnresolvedOnGain(
    featureNames: string[],
    entityName: string,
  ): ChoiceFeature[] {
    return featureNames.flatMap((name) => {
      const key = `${entityName}__${name}`;
      if (draft.choiceSelections[key]) return []; // already resolved
      const cf = choiceFeatures.find(
        (f) =>
          f.feature_name === name &&
          f.entity_name === entityName &&
          f.selection_timing === "on_gain",
      );
      return cf ? [cf] : [];
    });
  }

  function startChoiceQueue(queue: ChoiceFeature[], nextStep: number) {
    setChoiceQueue(queue);
    setChoiceQueueIdx(0);
    setCurrentSelections([]);
    setPendingStep(nextStep);
  }

  function toggleChoiceSelection(optionName: string) {
    const cf = choiceQueue[choiceQueueIdx];
    if (!cf) return;
    if (cf.selection_rule === "single") {
      setCurrentSelections([optionName]);
    } else {
      setCurrentSelections((prev) => {
        if (prev.includes(optionName))
          return prev.filter((s) => s !== optionName);
        if (prev.length < cf.min_choices) return [...prev, optionName];
        return prev;
      });
    }
  }

  function confirmChoiceSelection() {
    const cf = choiceQueue[choiceQueueIdx];
    if (!cf) return;
    const key = `${cf.entity_name}__${cf.feature_name}`;
    // Clear stale synthetic follow-up keys before writing new selection
    const clearedSelections = clearFeatChoices(draft.choiceSelections, cf.entity_name, cf.feature_name);
    update({
      choiceSelections: { ...clearedSelections, [key]: currentSelections },
    });

    // Build follow-up choices for any option with follow_up spec
    const VITALS_SKILLS = ["Vigor", "Intuition", "Talent", "Awareness", "Lore", "Social"];
    const extraQueue: ChoiceFeature[] = [];
    for (const optionName of currentSelections) {
      const opt = cf.options.find((o) => o.name === optionName);
      if (!opt?.follow_up) continue;
      const fu = opt.follow_up;
      const count = fu.count;
      const syntheticName = fu.grants_expertise
        ? `${cf.feature_name} Expertise ×${fu.bump_count ?? 1}`
        : `${cf.feature_name} Core (${optionName})`;
      const syntheticKey = `${cf.entity_name}__${syntheticName}`;
      if (!draft.choiceSelections[syntheticKey]) {
        const options =
          fu.pool === "vitals_skills"
            ? VITALS_SKILLS.map((s) => ({ name: s, effect_text: `Gain Expertise in ${s}.` }))
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
    }

    const remainingQueue = choiceQueue.slice(choiceQueueIdx + 1);
    const newQueue = [...extraQueue, ...remainingQueue];
    if (newQueue.length > 0) {
      setChoiceQueue(newQueue);
      setChoiceQueueIdx(0);
      setCurrentSelections([]);
    } else {
      setChoiceQueue([]);
      setChoiceQueueIdx(0);
      setCurrentSelections([]);
      if (pendingStep !== null) {
        setStep(pendingStep);
        setPendingStep(null);
      }
    }
  }

  function handleNext() {
    if (!canAdvance()) return;
    const nextStep = Math.min(step + 1, STEPS.length);

    // After profession — check base features for on_gain choices
    if (step === 2 && selectedProf) {
      const queue = getUnresolvedOnGain(
        selectedProf.baseFeatures.map((f) => f.name),
        selectedProf.name,
      );
      if (queue.length > 0) {
        startChoiceQueue(queue, nextStep);
        return;
      }
    }

    // After origin — check origin base features + vocation features for on_gain choices
    if (step === 3) {
      const queue: ChoiceFeature[] = [];
      if (selectedOrigin?.baseFeatures.length) {
        queue.push(
          ...getUnresolvedOnGain(
            selectedOrigin.baseFeatures.map((f) => f.name),
            selectedOrigin.name,
          ),
        );
      }
      if (selectedVocation?.features.length) {
        queue.push(
          ...getUnresolvedOnGain(
            selectedVocation.features.map((f) => f.name),
            selectedVocation.name,
          ),
        );
      }
      if (queue.length > 0) {
        startChoiceQueue(queue, nextStep);
        return;
      }
    }

    // After feats — check selected feats for on_gain choices
    if (step === 7) {
      const featQueue: ChoiceFeature[] = [];
      for (const id of draft.selectedFeatIds) {
        const feat = allFeats.find((f) => f.id === id);
        if (!feat) continue;
        const unresolvedForFeat = getUnresolvedOnGain(
          [feat.name],
          feat.ownerName,
        );
        featQueue.push(...unresolvedForFeat);
      }
      if (featQueue.length > 0) {
        startChoiceQueue(featQueue, nextStep);
        return;
      }
    }

    setStep(nextStep);
  }

  function handleBack() {
    if (choiceQueue.length > 0) {
      // Cancel the current choice queue and stay on the triggering step
      setChoiceQueue([]);
      setChoiceQueueIdx(0);
      setCurrentSelections([]);
      setPendingStep(null);
      return;
    }
    setStep((s) => Math.max(s - 1, 1));
  }

  function handleSave() {
    if (!draft.name.trim()) return;
    const attrs = totalAttributes;
    const startVit = selectedProf
      ? calcStartingVitality(selectedProf, attrs) + featVitalityBonus
      : 10;

    // Build structured inventory from starting packs
    let itemIdCounter = 0;
    function makeItem(
      name: string,
      category: import("@/lib/characterTypes").InventoryCategory,
      slot: import("@/lib/characterTypes").InventorySlot = null,
    ): import("@/lib/characterTypes").InventoryItem {
      return {
        id: `item_${Date.now()}_${itemIdCounter++}`,
        name,
        category,
        quantity: 1,
        weight: 0,
        notes: "",
        source: "creation",
        slot,
        equipped: false,
        traits: [],
        catalogItemId: null,
        armorBonus: 0,
        armorCategory: null,
        armorTier: null,
        woundBonus: 0,
        mediumArmorStat: null,
        shieldType: null,
        armamentTags: [],
        modifierStat: null,
        isRanged: false,
        damageDiceCount: 0,
        damageDiceSize: 6,
        damageTypeTags: [],
        equipSlots: [],
        masterworkBonus: 0,
        equippable: slot !== null,
      };
    }
    function makeItemFromCatalog(
      ci: CatalogItem,
    ): import("@/lib/characterTypes").InventoryItem {
      return {
        id: `item_${Date.now()}_${itemIdCounter++}`,
        name: ci.name,
        category:
          ci.category as import("@/lib/characterTypes").InventoryCategory,
        quantity: 1,
        weight: ci.weight,
        notes: "",
        source: "creation",
        slot: null,
        equipped: false,
        traits: ci.traits,
        catalogItemId: ci.id,
        armorBonus: ci.armorBonus ?? 0,
        armorCategory: (ci.armorCategory ?? null) as
          | "Light"
          | "Medium"
          | "Heavy"
          | null,
        armorTier: (ci.armorTier ?? null) as "Standard" | "Enhanced" | "Fortified" | null,
        woundBonus: ci.woundBonus ?? 0,
        mediumArmorStat: null,
        shieldType: (ci.shieldType ?? null) as "Temporary" | "Light" | "Medium" | "Heavy" | null,
        armamentTags: ci.armamentTags,
        modifierStat: null,
        isRanged: ci.isRanged,
        damageDiceCount: ci.damageDiceCount,
        damageDiceSize: ci.damageDiceSize,
        damageTypeTags: ci.damageTypeTags as ("puncture" | "slash" | "blunt")[],
        equipSlots: ci.equipSlots,
        masterworkBonus: 0,
        equippable: ci.equippable || ci.equipSlots.length > 0,
      };
    }
    function inferItemCategory(
      name: string,
      defaultCat: import("@/lib/characterTypes").InventoryCategory,
    ): import("@/lib/characterTypes").InventoryCategory {
      if (/\bshield\b/i.test(name)) return "Shield";
      return defaultCat;
    }
    function parsePickCount(label: string): number | null {
      const m = label.match(/pick\s*(\d+)/i);
      return m ? parseInt(m[1]) : null;
    }
    // Catalog lookup by name with basic singularization
    const catalogByNameLower = new Map(
      catalog.map((ci) => [ci.name.toLowerCase(), ci]),
    );
    function findCatalogByFuzzyName(name: string): CatalogItem | null {
      const lower = name.toLowerCase().trim();
      if (catalogByNameLower.has(lower)) return catalogByNameLower.get(lower)!;
      const noS = lower.replace(/s$/, "");
      if (catalogByNameLower.has(noS)) return catalogByNameLower.get(noS)!;
      const esE = lower.replace(/es$/, "e");
      if (catalogByNameLower.has(esE)) return catalogByNameLower.get(esE)!;
      const iesY = lower.replace(/ies$/, "y");
      if (catalogByNameLower.has(iesY)) return catalogByNameLower.get(iesY)!;
      // "Light armor" → "Light", "Medium armor" → "Medium", etc.
      const noArmor = lower.replace(/\s*armor\b/i, "").trim();
      if (noArmor && catalogByNameLower.has(noArmor))
        return catalogByNameLower.get(noArmor)!;
      return null;
    }
    // Parse "Two throwing axes" → { count: 2, cleanName: "throwing axes" }
    function parsePackQuantity(name: string): {
      count: number;
      cleanName: string;
    } {
      const WORD_NUM: Record<string, number> = {
        one: 1,
        a: 1,
        an: 1,
        two: 2,
        three: 3,
        four: 4,
        five: 5,
      };
      const m = name.match(/^(one|two|three|four|five|a|an|\d+)\s+(.+)/i);
      if (!m) return { count: 1, cleanName: name };
      const count = parseInt(m[1]) || WORD_NUM[m[1].toLowerCase()] || 1;
      return { count, cleanName: m[2].trim() };
    }
    function isThrowableWeapon(name: string): boolean {
      return /\b(throwing|javelin|dart|shuriken|sling)\b/i.test(name);
    }
    // Split "Light bow with quiver (20 arrows)" → [{Light bow,Weapon,1},{Arrows,Consumable,20}]
    function splitCompoundItem(
      name: string,
      defaultCat: import("@/lib/characterTypes").InventoryCategory,
    ): Array<{
      n: string;
      c: import("@/lib/characterTypes").InventoryCategory;
      q: number;
    }> | null {
      const m1 = name.match(/^(.*?)\s+with\s+quiver\s*\((\d+)\s+(\w+)\)/i);
      if (m1) {
        const raw = m1[3].toLowerCase().replace(/s$/, "");
        const ammoName = raw.charAt(0).toUpperCase() + raw.slice(1) + "s";
        return [
          {
            n: m1[1].trim(),
            c: inferItemCategory(m1[1].trim(), defaultCat),
            q: 1,
          },
          { n: ammoName, c: "Consumable", q: parseInt(m1[2]) },
        ];
      }
      const m2 = name.match(
        /^(.*?)\s+with\s+(\d+)\s+(arrows?|bolts?|bullets?)/i,
      );
      if (m2) {
        const raw = m2[3].toLowerCase().replace(/s$/, "");
        const ammoName = raw.charAt(0).toUpperCase() + raw.slice(1) + "s";
        return [
          {
            n: m2[1].trim(),
            c: inferItemCategory(m2[1].trim(), defaultCat),
            q: 1,
          },
          { n: ammoName, c: "Consumable", q: parseInt(m2[2]) },
        ];
      }
      return null;
    }
    // Resolves one pack entry into InventoryItems
    function resolvePackItem(
      name: string,
      choiceKey: string,
      defaultCat: import("@/lib/characterTypes").InventoryCategory,
    ): import("@/lib/characterTypes").InventoryItem[] {
      // Step 1: Resolve "or" choice
      let resolved = name;
      if (/\s+or\s+/i.test(name)) {
        const opts = name
          .replace(/\s*\(.*?\)\s*$/, "")
          .split(/\s+or\s+/i)
          .map((s) => s.trim());
        resolved = packChoices[choiceKey] ?? opts[0];
      }
      const cat = inferItemCategory(resolved, defaultCat);
      // Step 1b: Split "X and Y" compounds when one part is a shield (e.g., "Duelist clothing and buckler")
      if (/ and /i.test(resolved)) {
        const parts = resolved.split(/ and /i).map((s) => s.trim());
        if (
          parts.length === 2 &&
          parts.some((p) => /\b(buckler|shield|targe)\b/i.test(p))
        ) {
          return parts.flatMap((part) => {
            const pCat = inferItemCategory(part, cat);
            const ci = findCatalogByFuzzyName(part);
            return [ci ? makeItemFromCatalog(ci) : makeItem(part, pCat)];
          });
        }
      }
      // Step 2: "of choice" → catalog picker expansion
      if (/\bof\s+choice\b/i.test(resolved)) {
        const count = /\bthree|3\b/i.test(resolved)
          ? 3
          : /\btwo|2\b/i.test(resolved)
            ? 2
            : 1;
        const chosenIds = packFreeChoices[choiceKey] ?? [];
        return Array.from({ length: count }, (_, j) => {
          const ci = catalog.find((c) => c.id === chosenIds[j]);
          return ci
            ? makeItemFromCatalog(ci)
            : makeItem(
                cat === "Weapon"
                  ? count > 1
                    ? `Weapon ${j + 1}`
                    : "Weapon"
                  : "Item",
                cat,
              );
        });
      }
      // Step 3: Compound split ("Light bow with quiver (20 arrows)" → two items)
      const split = splitCompoundItem(resolved, cat);
      if (split) {
        return split.map(({ n, c, q }) => {
          const ci = findCatalogByFuzzyName(n);
          const base = ci ? makeItemFromCatalog(ci) : makeItem(n, c);
          return { ...base, quantity: q };
        });
      }
      // Step 4: Quantity prefix ("Two throwing axes" → Throwing Axe × 2 OR Dagger × 1 × N)
      const { count, cleanName } = parsePackQuantity(resolved);
      if (count > 1) {
        const qCat = inferItemCategory(cleanName, cat);
        const ci = findCatalogByFuzzyName(cleanName);
        if (qCat === "Weapon" && !isThrowableWeapon(cleanName)) {
          // Non-stackable weapons: create separate items (e.g., Two daggers → Dagger + Dagger)
          return Array.from({ length: count }, () => {
            const base = ci
              ? makeItemFromCatalog(ci)
              : makeItem(cleanName, qCat);
            return { ...base, quantity: 1 };
          });
        }
        const base = ci ? makeItemFromCatalog(ci) : makeItem(cleanName, qCat);
        return [{ ...base, quantity: count }];
      }
      return [makeItem(resolved, cat)];
    }

    const startingInventory: import("@/lib/characterTypes").InventoryItem[] =
      [];
    const profPack = selectedProf?.startingPack;
    if (profPack) {
      profPack.weapons.forEach((n, i) =>
        resolvePackItem(n, `prof_weapons_${i}`, "Weapon").forEach((item) =>
          startingInventory.push(item),
        ),
      );
      profPack.armor.forEach((n, i) =>
        resolvePackItem(n, `prof_armor_${i}`, "Armor").forEach((item) =>
          startingInventory.push(item),
        ),
      );
      profPack.kit.forEach((n, i) =>
        resolvePackItem(n, `prof_kit_${i}`, "Kit").forEach((item) =>
          startingInventory.push(item),
        ),
      );
      profPack.inventory.forEach((n, i) =>
        resolvePackItem(n, `prof_inventory_${i}`, "Misc").forEach((item) =>
          startingInventory.push(item),
        ),
      );
    }
    const originPack = selectedOrigin?.originPack;
    if (originPack) {
      originPack.categories.forEach((cat) => {
        const lbl = cat.label.toLowerCase();
        const category: import("@/lib/characterTypes").InventoryCategory =
          lbl.includes("weapon")
            ? "Weapon"
            : lbl.includes("armor") || lbl.includes("clothing")
              ? "Armor"
              : lbl.includes("kit")
                ? "Kit"
                : "Misc";
        const pickN = parsePickCount(cat.label);
        if (pickN !== null) {
          const catKey = `origin_pick_${cat.label}`;
          const chosen = packPickChoices[catKey] ?? cat.items.slice(0, pickN);
          chosen.forEach((n) =>
            resolvePackItem(n, `origin_${cat.label}_pick`, category).forEach(
              (item) => startingInventory.push(item),
            ),
          );
        } else {
          cat.items.forEach((n, i) =>
            resolvePackItem(n, `origin_${cat.label}_${i}`, category).forEach(
              (item) => startingInventory.push(item),
            ),
          );
        }
      });
    }

    // Sum currency from both packs
    const profCurrency = profPack?.currency ?? "";
    const originCurrency = ""; // origins tracked via originPack categories
    const combinedCurrency = [profCurrency, originCurrency]
      .filter(Boolean)
      .join(", ");

    const ambition = calcAmbition(totalAttributes.will, draft.tier);
    const startReservoir = effectiveCaster
      ? (calcReservoir(
          effectiveCaster.casterType,
          draft.tier,
          totalAttributes[
            effectiveCaster.casterModifierOptions.length === 1
              ? effectiveCaster.casterModifierOptions[0]
              : effectiveCaster.casterModifierOptions.length > 1
                ? effectiveCaster.casterModifierOptions.reduce((best, key) =>
                    totalAttributes[key] >= totalAttributes[best] ? key : best
                  )
                : draft.spellcastingModifier ?? "mind"
          ],
        ) ?? 0)
      : 0;
    const startingFeatsPurchased = FEAT_ALLOWANCE[draft.tier] ?? 0;
    const startingSpellThreshold = effectiveCaster
      ? calcSpellcastingThreshold(startingFeatsPurchased)
      : 0;

    // Compute armament proficiency tags from profession armaments list
    const armamentProficiencyTags: string[] = [];
    for (const a of selectedProf?.armaments ?? []) {
      const lower = a.toLowerCase();
      if (lower.includes("finesse")) armamentProficiencyTags.push("finesse");
      if (lower.includes("martial")) armamentProficiencyTags.push("martial");
      if (lower.includes("simple")) armamentProficiencyTags.push("simple");
      if (lower.includes("defensive"))
        armamentProficiencyTags.push("defensive");
      if (lower.includes("catalyst")) armamentProficiencyTags.push("catalyst");
      if (lower.includes("ranged")) armamentProficiencyTags.push("ranged");
    }

    const charData: Omit<Character, "id" | "createdAt" | "updatedAt"> = {
      ...draft,
      currency: parseCurrency(draft.currency || combinedCurrency),
      inventory: startingInventory,
      maxAmbition: ambition.max,
      ambitionDice: ambition.dice,
      currentAmbition: ambition.max,
      currentReservoir: startReservoir,
      currentRespites: 3,
      currentVitality: startVit,
      maxVitality: null,
      tempHp: 0,
      tempArmorDef: 0,
      tempToHit: 0,
      tempDamage: 0,
      currentWounds: 0,
      renown: 0,
      featsPurchased: startingFeatsPurchased,
      activeFeedSpellIds: draft.knownSpellIds,
      armamentProficiencyTags: [...new Set(armamentProficiencyTags)],
      customResources: selectedProf?.customResource
        ? {
            [selectedProf.customResource.key]: evalResourceMax(
              selectedProf.customResource,
              totalAttributes,
              draft.tier,
            ),
          }
        : {},
      unspentAttributePoints: 0,
      skillPoints: {},
      unspentSkillPoints: 3,
      ...(() => {
        const vitalsExpertiseBumps = computeExpertiseBumps(
          draft.selectedFeatIds,
          allFeats,
          choiceFeatures,
          draft.choiceSelections,
        );
        return { vitalsExpertiseBumps };
      })(),
    };
    const saved = saveCharacter(charData);
    router.push(`/characters/${saved.id}`);
  }

  // ─── Feat toggling with reactive deselection ──────────────────────────────

  function toggleFeat(id: string) {
    const current = draft.selectedFeatIds;
    if (current.includes(id)) {
      // Deselect and cascade — find feats that require the name of this feat
      const removedFeat = allFeats.find((f) => f.id === id);
      if (!removedFeat) return;
      const dependents = allFeats
        .filter(
          (f) => f.required === removedFeat.name && current.includes(f.id),
        )
        .map((f) => f.id);
      const removedIds = [id, ...dependents];
      // Also clear any choice selections (primary + synthetic follow-ups) for removed feats
      let newChoiceSelections = { ...draft.choiceSelections };
      for (const rid of removedIds) {
        const feat = allFeats.find((f) => f.id === rid);
        if (feat) newChoiceSelections = clearFeatChoices(newChoiceSelections, feat.ownerName, feat.name);
      }
      update({
        selectedFeatIds: current.filter((f) => !removedIds.includes(f)),
        choiceSelections: newChoiceSelections,
      });
    } else {
      const status = getFeatStatus(
        allFeats.find((f) => f.id === id)!,
        current,
        allFeats,
        atFeatCap,
      );
      if (status.blocked) return;
      update({ selectedFeatIds: [...current, id] });
    }
  }

  // ─── Choice resolution UI ────────────────────────────────────────────────

  function renderChoiceResolution(): React.ReactNode {
    const cf = choiceQueue[choiceQueueIdx];
    if (!cf) return null;
    const needed = cf.min_choices;
    const canConfirm = currentSelections.length >= needed;
    const isLast = choiceQueueIdx + 1 >= choiceQueue.length;
    const progressStr =
      choiceQueue.length > 1
        ? ` (${choiceQueueIdx + 1} of ${choiceQueue.length})`
        : "";

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div>
          <div
            style={{
              fontSize: "0.65rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--primary)",
              fontFamily: "var(--font-heading)",
              marginBottom: "0.375rem",
            }}
          >
            Feature Choice{progressStr}
          </div>
          <h3
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              fontSize: "1.15rem",
              color: "var(--text)",
              margin: "0 0 0.25rem",
            }}
          >
            {cf.feature_name}
          </h3>
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--text-muted)",
              margin: 0,
            }}
          >
            {cf.selection_rule === "single"
              ? "Choose one option."
              : `Choose ${needed} options. (${currentSelections.length} / ${needed} selected)`}
          </p>
          {cf.notes && (
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                margin: "0.375rem 0 0",
                fontStyle: "italic",
              }}
            >
              {cf.notes}
            </p>
          )}
        </div>

        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          {cf.options.map((opt) => {
            const sel = currentSelections.includes(opt.name);
            const atCap =
              !sel &&
              currentSelections.length >= needed &&
              cf.selection_rule === "fixed_count";
            return (
              <button
                key={opt.name}
                onClick={() => !atCap && toggleChoiceSelection(opt.name)}
                style={{
                  padding: "0.875rem 1rem",
                  borderRadius: "0.5rem",
                  cursor: atCap ? "not-allowed" : "pointer",
                  textAlign: "left",
                  border: `2px solid ${sel ? "var(--primary)" : "var(--border)"}`,
                  backgroundColor: sel
                    ? "var(--primary-light)"
                    : "var(--bg-card)",
                  opacity: atCap ? 0.45 : 1,
                  transition: "all 0.12s",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    color: sel ? "var(--primary)" : "var(--text)",
                    marginBottom: "0.25rem",
                  }}
                >
                  {sel && "✓ "}
                  {opt.name}
                </div>
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--text-muted)",
                    lineHeight: 1.55,
                  }}
                >
                  {opt.effect_text}
                </div>
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            paddingTop: "0.75rem",
            borderTop: "1px solid var(--border)",
          }}
        >
          <button
            onClick={() => {
              setChoiceQueue([]);
              setChoiceQueueIdx(0);
              setCurrentSelections([]);
              setPendingStep(null);
            }}
            style={{
              padding: "0.625rem 1.25rem",
              border: "1.5px solid var(--border)",
              borderRadius: "0.5rem",
              cursor: "pointer",
              backgroundColor: "var(--bg-card)",
              color: "var(--text-muted)",
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              fontSize: "0.875rem",
            }}
          >
            ← Back
          </button>
          <button
            onClick={confirmChoiceSelection}
            disabled={!canConfirm}
            style={{
              padding: "0.625rem 1.5rem",
              border: "none",
              borderRadius: "0.5rem",
              cursor: canConfirm ? "pointer" : "not-allowed",
              backgroundColor: canConfirm ? "var(--primary)" : "var(--border)",
              color: canConfirm ? "var(--bg)" : "var(--text-muted)",
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              fontSize: "0.875rem",
            }}
          >
            {isLast ? "Confirm & Continue →" : "Confirm →"}
          </button>
        </div>
      </div>
    );
  }

  // ─── Steps ────────────────────────────────────────────────────────────────

  function renderStep1() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div>
          <SectionLabel>Character Name</SectionLabel>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Enter a name…"
            autoFocus
            style={{
              width: "100%",
              padding: "0.625rem 0.875rem",
              fontSize: "1rem",
              fontFamily: "var(--font-body)",
              border: "1.5px solid var(--border)",
              borderRadius: "0.5rem",
              backgroundColor: "var(--bg-card)",
              color: "var(--text)",
              outline: "none",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--primary)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--border)";
            }}
          />
        </div>

        <div>
          <SectionLabel>Tier</SectionLabel>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: "0.5rem",
              marginBottom: "0.75rem",
            }}
          >
            {[1, 2, 3, 4, 5].map((t) => {
              const allowance = FEAT_ALLOWANCE[t];
              const sel = draft.tier === t;
              return (
                <div
                  key={t}
                  onClick={() =>
                    update({
                      tier: t,
                      featAllowance: FEAT_ALLOWANCE[t],
                      selectedFeatIds: [],
                    })
                  }
                  style={{
                    position: "relative",
                    padding: "0.875rem 0.5rem",
                    textAlign: "center",
                    borderRadius: "6px",
                    cursor: "pointer",
                    border: `1px solid ${sel ? "var(--gold)" : "var(--border)"}`,
                    backgroundColor: sel ? "var(--panel-hi)" : "var(--panel)",
                    boxShadow: sel ? "0 0 0 2px var(--gold)" : "none",
                    transition: "all 0.12s",
                  }}
                >
                  {sel && (
                    <div style={{
                      position: "absolute", top: "5px", right: "5px",
                      width: "15px", height: "15px", borderRadius: "50%",
                      backgroundColor: "var(--gold)", color: "var(--bg)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "8px", fontWeight: 700,
                    }}>✓</div>
                  )}
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontWeight: 600,
                      fontSize: "1.5rem",
                      color: sel ? "var(--gold)" : "var(--text-primary)",
                      lineHeight: 1,
                    }}
                  >
                    {t}
                  </div>
                  <div
                    style={{
                      fontSize: "0.6rem",
                      fontWeight: 600,
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-tertiary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginTop: "0.25rem",
                    }}
                  >
                    Tier
                  </div>
                  <div
                    style={{
                      fontSize: "0.65rem",
                      color: sel ? "var(--gold)" : "var(--text-secondary)",
                      marginTop: "0.3rem",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 500,
                    }}
                  >
                    {allowance} feat{allowance !== 1 ? "s" : ""}
                  </div>
                </div>
              );
            })}
          </div>
          <p
            style={{
              fontSize: "0.8rem",
              color: "var(--text-muted)",
              margin: 0,
            }}
          >
            New adventurers start at <strong>Tier 1</strong>. Feat allowance
            reflects the total feats earned by that tier.
          </p>
        </div>
      </div>
    );
  }

  // Profession step — compact list + detail panel
  const [profDetail, setProfDetail] = useState<string | null>(null);
  const detailProf =
    professions.find((p) => p.id === (profDetail ?? draft.professionId)) ??
    null;

  function renderStep2() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* Profession card grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "0.5rem",
        }}>
          {professions.map((p) => {
            const sel = draft.professionId === p.id;
            return (
              <div
                key={p.id}
                onClick={() => {
                  update({
                    professionId: p.id,
                    professionName: p.name,
                    vitalsProficiencies: [],
                    selectedFeatIds: [],
                  });
                  setPackChoices({});
                  setPackPickChoices({});
                  setPackFreeChoices({});
                  setPackFreeSearch({});
                  setProfDetail(p.id);
                }}
                style={{
                  position: "relative",
                  padding: "0.75rem",
                  borderRadius: "6px",
                  cursor: "pointer",
                  border: `1px solid ${sel ? "var(--gold)" : "var(--border)"}`,
                  backgroundColor: sel ? "var(--panel-hi)" : "var(--panel)",
                  boxShadow: sel ? "0 0 0 2px var(--gold)" : "none",
                  transition: "all 0.12s",
                }}
              >
                {sel && (
                  <div style={{
                    position: "absolute", top: "5px", right: "5px",
                    width: "15px", height: "15px", borderRadius: "50%",
                    backgroundColor: "var(--gold)", color: "var(--bg)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "8px", fontWeight: 700,
                  }}>✓</div>
                )}
                <div style={{
                  fontFamily: "var(--font-heading)", fontStyle: "italic",
                  fontWeight: 500, fontSize: "0.9rem",
                  color: sel ? "var(--text-primary)" : "var(--text-secondary)",
                  marginBottom: "3px",
                  paddingRight: sel ? "16px" : 0,
                }}>
                  {p.name}
                </div>
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: "9px",
                  color: sel ? "var(--gold)" : "var(--text-tertiary)",
                  letterSpacing: "0.04em",
                }}>
                  {p.startingVitality} HP{p.casterType ? " · CASTER" : ""}
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail panel */}
        {detailProf && (
          <div
            style={{
              padding: "1.25rem",
              backgroundColor: "var(--bg-nav)",
              border: "1px solid var(--border)",
              borderRadius: "0.625rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "0.5rem",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <div>
                <h3
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    color: "var(--text)",
                    margin: 0,
                  }}
                >
                  {detailProf.name}
                </h3>
                <div
                  style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}
                >
                  {detailProf.role}
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: "0.72rem",
                    padding: "0.2rem 0.5rem",
                    borderRadius: "9999px",
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                    fontFamily: "var(--font-heading)",
                    fontWeight: 600,
                  }}
                >
                  {detailProf.startingVitality} HP
                </span>
                <span
                  style={{
                    fontSize: "0.72rem",
                    padding: "0.2rem 0.5rem",
                    borderRadius: "9999px",
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  +{detailProf.vitalityPerTier}/tier
                </span>
                {detailProf.casterType && (
                  <span
                    style={{
                      fontSize: "0.72rem",
                      padding: "0.2rem 0.5rem",
                      borderRadius: "9999px",
                      backgroundColor: "var(--primary-light)",
                      border: "1px solid var(--primary)",
                      color: "var(--primary)",
                      fontFamily: "var(--font-heading)",
                      fontWeight: 600,
                    }}
                  >
                    {detailProf.casterType === "full"
                      ? "Full Caster"
                      : detailProf.casterType === "half"
                        ? "Half Caster"
                        : "Limited Caster"}
                  </span>
                )}
              </div>
            </div>

            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--text-muted)",
                lineHeight: 1.65,
                marginBottom: "0.875rem",
              }}
            >
              {detailProf.flavor}
            </p>

            {/* Proficiencies summary */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.5rem",
                marginBottom: "0.875rem",
                fontSize: "0.8rem",
              }}
            >
              {[
                ["Armaments", detailProf.armaments.join(", ")],
                ["Protection", detailProf.protection.join(", ")],
                ["Tool Kits", detailProf.toolKits.join(", ") || "—"],
                [
                  "V.I.T.A.L.S.",
                  detailProf.vitalsChoiceCount > 0
                    ? `Choose ${detailProf.vitalsChoiceCount}: ${detailProf.vitalsOptions.join(", ")}`
                    : "—",
                ],
              ].map(([label, val]) => (
                <div key={label}>
                  <span
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontWeight: 700,
                      color: "var(--text-muted)",
                      fontSize: "0.65rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {label}{" "}
                  </span>
                  <span style={{ color: "var(--text)" }}>{val}</span>
                </div>
              ))}
            </div>

            {/* Paths — informational only */}
            {detailProf.pathOptions.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    letterSpacing: "0.07em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-heading)",
                    marginBottom: "0.3rem",
                  }}
                >
                  Paths
                </div>
                <div
                  style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
                >
                  {detailProf.pathOptions.map((path) => (
                    <span
                      key={path}
                      style={{
                        fontSize: "0.78rem",
                        padding: "0.2rem 0.6rem",
                        borderRadius: "9999px",
                        backgroundColor: "rgb(var(--gold-rgb) / 0.09)",
                        color: "var(--gold)",
                        border: "1px solid rgb(var(--gold-rgb) / 0.40)",
                        fontFamily: "var(--font-heading)",
                        fontWeight: 600,
                      }}
                    >
                      {path}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Base Features — auto-granted, display only */}
            {detailProf.baseFeatures.length > 0 && (
              <div style={{ marginTop: "0.875rem" }}>
                <div
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    letterSpacing: "0.07em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-heading)",
                    marginBottom: "0.5rem",
                  }}
                >
                  Base Features{" "}
                  <span
                    style={{
                      fontWeight: 400,
                      textTransform: "none",
                      letterSpacing: 0,
                    }}
                  >
                    (automatically granted)
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.375rem",
                  }}
                >
                  {detailProf.baseFeatures.map((f) => {
                    const choiceKey = `${detailProf.name}__${f.name}`;
                    const resolved = draft.choiceSelections[choiceKey];
                    const hasChoice = choiceFeatures.some(
                      (cf) =>
                        cf.feature_name === f.name &&
                        cf.entity_name === detailProf.name &&
                        cf.selection_timing === "on_gain",
                    );
                    const key = `${f.id}-${f.name}`;
                    const open = expandedFeatIds.has(key);
                    return (
                      <div
                        key={key}
                        style={{
                          border: `1px solid ${resolved ? "var(--primary)" : "var(--border)"}`,
                          borderRadius: "0.375rem",
                          overflow: "hidden",
                          backgroundColor: "var(--bg-card)",
                        }}
                      >
                        <button
                          onClick={() => toggleBuilderFeat(key)}
                          style={{
                            width: "100%",
                            padding: "0.5rem 0.75rem",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            textAlign: "left",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "var(--font-heading)",
                              fontWeight: 700,
                              color: "var(--text)",
                              fontSize: "0.8rem",
                            }}
                          >
                            {f.name}
                          </span>
                          <span
                            style={{
                              fontSize: "0.65rem",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.4rem",
                              flexShrink: 0,
                            }}
                          >
                            {hasChoice && resolved && (
                              <span
                                style={{
                                  fontFamily: "var(--font-heading)",
                                  fontWeight: 600,
                                  color: "var(--primary)",
                                }}
                              >
                                ✓ {resolved.join(", ")}
                              </span>
                            )}
                            {hasChoice && !resolved && (
                              <span
                                style={{
                                  fontFamily: "var(--font-heading)",
                                  color: "var(--accent)",
                                  fontWeight: 600,
                                }}
                              >
                                Choice required
                              </span>
                            )}
                            <span style={{ color: "var(--text-muted)" }}>
                              {open ? "▲" : "▼"}
                            </span>
                          </span>
                        </button>
                        {open && (
                          <div
                            style={{
                              padding: "0.5rem 0.75rem",
                              borderTop: `1px solid ${resolved ? "var(--primary)" : "var(--border)"}`,
                              fontSize: "0.8rem",
                            }}
                          >
                            <MarkdownContent content={f.descriptionMarkdown} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {draft.professionId === detailProf.id && (
              <div
                style={{
                  marginTop: "1rem",
                  padding: "0.5rem 0.75rem",
                  backgroundColor: "var(--primary-light)",
                  border: "1px solid var(--primary)",
                  borderRadius: "0.375rem",
                  fontSize: "0.8rem",
                  color: "var(--primary)",
                  fontFamily: "var(--font-heading)",
                  fontWeight: 600,
                }}
              >
                ✓ {detailProf.name} selected
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Origin step — compact list + expand + vocation select
  const [originDetail, setOriginDetail] = useState<string | null>(null);
  const [vocDetail, setVocDetail] = useState<string | null>(null);
  const detailOrigin =
    origins.find((o) => o.id === (originDetail ?? draft.originId)) ?? null;

  function renderStep3() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* Origin list */}
        <div>
          <SectionLabel>Origin</SectionLabel>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "0.5rem",
          }}>
            {origins.map((o) => {
              const sel = draft.originId === o.id;
              return (
                <div
                  key={o.id}
                  onClick={() => {
                    update({
                      originId: o.id,
                      originName: o.name,
                      vocationId: "",
                      vocationName: "",
                      vocationAttributeBonus: { attribute: "brawn", value: 1 },
                      vocationCaster: o.caster ?? null,
                    });
                    setPackChoices({});
                    setPackPickChoices({});
                    setPackFreeChoices({});
                    setPackFreeSearch({});
                    setOriginDetail(o.id);
                    setVocDetail(null);
                  }}
                  style={{
                    position: "relative",
                    padding: "0.75rem",
                    borderRadius: "6px",
                    cursor: "pointer",
                    border: `1px solid ${sel ? "var(--c-origin)" : "var(--border)"}`,
                    backgroundColor: sel ? "var(--panel-hi)" : "var(--panel)",
                    boxShadow: sel ? "0 0 0 2px var(--c-origin)" : "none",
                    transition: "all 0.12s",
                  }}
                >
                  {sel && (
                    <div style={{
                      position: "absolute", top: "5px", right: "5px",
                      width: "15px", height: "15px", borderRadius: "50%",
                      backgroundColor: "var(--c-origin)", color: "var(--bg)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "8px", fontWeight: 700,
                    }}>✓</div>
                  )}
                  <div style={{
                    fontFamily: "var(--font-heading)", fontStyle: "italic",
                    fontWeight: 500, fontSize: "0.9rem",
                    color: sel ? "var(--text-primary)" : "var(--text-secondary)",
                    marginBottom: "3px",
                    paddingRight: sel ? "16px" : 0,
                  }}>
                    {o.name}
                  </div>
                  <div style={{
                    fontFamily: "var(--font-mono)", fontSize: "9px",
                    color: sel ? "var(--c-origin)" : "var(--text-tertiary)",
                    letterSpacing: "0.04em",
                  }}>
                    {o.vocations.length} VOCATION{o.vocations.length !== 1 ? "S" : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail panel */}
        {detailOrigin && (
          <div
            style={{
              padding: "1.25rem",
              backgroundColor: "var(--bg-nav)",
              border: "1px solid var(--border)",
              borderRadius: "0.625rem",
            }}
          >
            <h3
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
                fontSize: "1.05rem",
                color: "var(--text)",
                margin: "0 0 0.375rem",
              }}
            >
              {detailOrigin.name}
            </h3>
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--text-muted)",
                lineHeight: 1.65,
                marginBottom: "1rem",
              }}
            >
              {detailOrigin.flavor}
            </p>

            {/* Origin base features */}
            {detailOrigin.baseFeatures.length > 0 && (
              <div style={{ marginBottom: "1rem" }}>
                <div
                  style={{
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-heading)",
                    marginBottom: "0.375rem",
                  }}
                >
                  Origin Features{" "}
                  <span
                    style={{
                      fontWeight: 400,
                      textTransform: "none",
                      letterSpacing: 0,
                    }}
                  >
                    (automatically granted)
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                  }}
                >
                  {detailOrigin.baseFeatures.map((f, i) => {
                    const key = `${f.id}-${i}`;
                    const open = expandedFeatIds.has(key);
                    return (
                      <div
                        key={key}
                        style={{
                          border: "1px solid var(--border)",
                          borderRadius: "0.375rem",
                          overflow: "hidden",
                          backgroundColor: "var(--bg-card)",
                        }}
                      >
                        <button
                          onClick={() => toggleBuilderFeat(key)}
                          style={{
                            width: "100%",
                            padding: "0.35rem 0.625rem",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            textAlign: "left",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "var(--font-heading)",
                              fontWeight: 700,
                              color: "var(--text)",
                              fontSize: "0.78rem",
                            }}
                          >
                            {f.name}
                          </span>
                          <span
                            style={{
                              fontSize: "0.62rem",
                              color: "var(--text-muted)",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.4rem",
                              flexShrink: 0,
                            }}
                          >
                            {f.activationRaw && <span>{f.activationRaw}</span>}
                            <span>{open ? "▲" : "▼"}</span>
                          </span>
                        </button>
                        {open && (
                          <div
                            style={{
                              padding: "0.5rem 0.625rem",
                              borderTop: "1px solid var(--border)",
                              fontSize: "0.78rem",
                            }}
                          >
                            <MarkdownContent content={f.descriptionMarkdown} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <SectionLabel>Choose a Vocation</SectionLabel>
            {/* Vocation pills */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.4rem",
                marginBottom: "0.875rem",
              }}
            >
              {detailOrigin.vocations.map((v) => {
                const sel = draft.vocationId === v.id;
                const previewing = vocDetail === v.id || (!vocDetail && sel);
                return (
                  <button
                    key={v.id}
                    onClick={() => {
                      setVocDetail(v.id);
                      update({
                        vocationId: v.id,
                        vocationName: v.name,
                        vocationAttributeBonus: v.attributeBonus,
                        vocationCaster:
                          v.caster ?? detailOrigin?.caster ?? null,
                      });
                    }}
                    style={{
                      padding: "0.3rem 0.75rem",
                      borderRadius: "9999px",
                      cursor: "pointer",
                      fontFamily: "var(--font-heading)",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      border: `1.5px solid ${sel ? "var(--accent)" : previewing ? "var(--border)" : "var(--border)"}`,
                      backgroundColor: sel ? "var(--accent)" : "var(--bg-card)",
                      color: sel ? "var(--bg)" : "var(--text-muted)",
                      transition: "all 0.12s",
                    }}
                  >
                    {v.name}
                  </button>
                );
              })}
            </div>
            {/* Vocation detail panel */}
            {(() => {
              const v = detailOrigin.vocations.find(
                (v) => v.id === (vocDetail ?? draft.vocationId),
              );
              if (!v) return null;
              return (
                <div
                  style={{
                    padding: "1rem",
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontWeight: 700,
                      fontSize: "0.95rem",
                      color: "var(--text)",
                      marginBottom: "0.25rem",
                    }}
                  >
                    {v.name}
                  </div>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--text-muted)",
                      lineHeight: 1.6,
                      marginBottom: "0.5rem",
                    }}
                  >
                    {v.flavor}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      flexWrap: "wrap",
                      marginBottom: "0.375rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        fontFamily: "var(--font-heading)",
                        color: "var(--accent)",
                      }}
                    >
                      +{v.attributeBonus.value}{" "}
                      {v.attributeBonus.attribute.charAt(0).toUpperCase() +
                        v.attributeBonus.attribute.slice(1)}
                    </span>
                    {v.caster && (
                      <span
                        style={{
                          fontSize: "0.65rem",
                          padding: "0.15rem 0.5rem",
                          borderRadius: "9999px",
                          backgroundColor: "var(--primary-light)",
                          color: "var(--primary)",
                          border: "1px solid var(--primary)",
                          fontFamily: "var(--font-heading)",
                          fontWeight: 600,
                        }}
                      >
                        {v.caster.casterType.charAt(0).toUpperCase() +
                          v.caster.casterType.slice(1)}{" "}
                        Caster — {v.caster.casterSource}
                      </span>
                    )}
                  </div>
                  {v.features.length > 0 && (
                    <div>
                      <div
                        style={{
                          fontSize: "0.62rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: "var(--text-muted)",
                          fontFamily: "var(--font-heading)",
                          marginBottom: "0.3rem",
                        }}
                      >
                        Granted Features
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.25rem",
                        }}
                      >
                        {v.features.map((f, i) => {
                          const key = `voc-${f.id}-${i}`;
                          const open = expandedFeatIds.has(key);
                          return (
                            <div
                              key={key}
                              style={{
                                border: "1px solid var(--border)",
                                borderRadius: "0.375rem",
                                overflow: "hidden",
                                backgroundColor: "var(--bg-nav)",
                              }}
                            >
                              <button
                                onClick={() => toggleBuilderFeat(key)}
                                style={{
                                  width: "100%",
                                  padding: "0.35rem 0.625rem",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  textAlign: "left",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  gap: "0.5rem",
                                }}
                              >
                                <span
                                  style={{
                                    fontFamily: "var(--font-heading)",
                                    fontWeight: 700,
                                    color: "var(--text)",
                                    fontSize: "0.78rem",
                                  }}
                                >
                                  {f.name}
                                </span>
                                <span
                                  style={{
                                    fontSize: "0.62rem",
                                    color: "var(--text-muted)",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.4rem",
                                    flexShrink: 0,
                                  }}
                                >
                                  {f.activationRaw && (
                                    <span>{f.activationRaw}</span>
                                  )}
                                  <span>{open ? "▲" : "▼"}</span>
                                </span>
                              </button>
                              {open && (
                                <div
                                  style={{
                                    padding: "0.5rem 0.625rem",
                                    borderTop: "1px solid var(--border)",
                                    fontSize: "0.78rem",
                                  }}
                                >
                                  <MarkdownContent
                                    content={f.descriptionMarkdown}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {draft.vocationId && detailOrigin.id === draft.originId && (
              <div
                style={{
                  marginTop: "1rem",
                  padding: "0.5rem 0.75rem",
                  backgroundColor: "var(--primary-light)",
                  border: "1px solid var(--primary)",
                  borderRadius: "0.375rem",
                  fontSize: "0.8rem",
                  color: "var(--primary)",
                  fontFamily: "var(--font-heading)",
                  fontWeight: 600,
                }}
              >
                ✓ {draft.originName} — {draft.vocationName} selected
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderStep4() {
    const profPack = selectedProf?.startingPack;
    const originPack = selectedOrigin?.originPack;

    function isOrItem(name: string) {
      return /\s+or\s+/i.test(name);
    }
    function parseOrOptions(name: string) {
      return name
        .replace(/\s*\(.*?\)\s*$/, "")
        .split(/\s+or\s+/i)
        .map((s) => s.trim());
    }
    function parsePickCount(label: string): number | null {
      const m = label.match(/pick\s*(\d+)/i);
      return m ? parseInt(m[1]) : null;
    }

    function filterCatalogForChoice(desc: string): CatalogItem[] {
      const lower = desc.toLowerCase();
      const weapons = catalog.filter((ci) => ci.category === "Weapon");
      if (/ranged/.test(lower)) return weapons.filter((ci) => ci.isRanged);
      if (/melee/.test(lower)) return weapons.filter((ci) => !ci.isRanged);
      if (/finesse|light weapon/.test(lower))
        return weapons.filter((ci) => ci.armamentTags.includes("finesse"));
      if (/martial/.test(lower))
        return weapons.filter((ci) => ci.armamentTags.includes("martial"));
      if (/simple/.test(lower))
        return weapons.filter((ci) => ci.armamentTags.includes("simple"));
      return weapons;
    }

    function renderCatalogPicker(
      choiceKey: string,
      count: number,
      filtered: CatalogItem[],
    ) {
      const chosenIds = packFreeChoices[choiceKey] ?? [];
      const searchText = packFreeSearch[choiceKey] ?? "";
      const visible = filtered.filter(
        (ci) =>
          !searchText ||
          ci.name.toLowerCase().includes(searchText.toLowerCase()),
      );
      return (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}
        >
          {/* Chosen items */}
          {chosenIds.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
              {chosenIds.map((id, j) => {
                const ci = catalog.find((c) => c.id === id);
                return ci ? (
                  <span
                    key={id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.2rem",
                      padding: "0.15rem 0.4rem",
                      border: "1.5px solid var(--primary)",
                      borderRadius: "0.25rem",
                      backgroundColor: "var(--primary-light)",
                      fontSize: "0.75rem",
                      fontFamily: "var(--font-heading)",
                      fontWeight: 600,
                      color: "var(--primary)",
                    }}
                  >
                    {ci.name}
                    <button
                      onClick={() =>
                        setPackFreeChoices((prev) => {
                          const a = [...(prev[choiceKey] ?? [])];
                          a.splice(j, 1);
                          return { ...prev, [choiceKey]: a };
                        })
                      }
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--primary)",
                        fontSize: "0.7rem",
                        padding: 0,
                        lineHeight: 1,
                      }}
                    >
                      ✕
                    </button>
                  </span>
                ) : null;
              })}
            </div>
          )}
          {/* Status / search */}
          {chosenIds.length < count && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                Pick {count - chosenIds.length} more
                {count > 1 ? ` (${chosenIds.length}/${count})` : ""}
              </div>
              <input
                type="text"
                placeholder="Search weapons..."
                value={searchText}
                onChange={(e) =>
                  setPackFreeSearch((prev) => ({
                    ...prev,
                    [choiceKey]: e.target.value,
                  }))
                }
                style={{
                  padding: "0.3rem 0.5rem",
                  border: "1px solid var(--border)",
                  borderRadius: "0.25rem",
                  backgroundColor: "var(--bg-card)",
                  color: "var(--text)",
                  fontSize: "0.78rem",
                  outline: "none",
                  width: "100%",
                  maxWidth: "200px",
                }}
              />
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "0.25rem",
                  backgroundColor: "var(--bg-card)",
                  maxHeight: "120px",
                  overflowY: "auto",
                }}
              >
                {visible.slice(0, 40).map((ci) => (
                  <button
                    key={ci.id}
                    onClick={() =>
                      setPackFreeChoices((prev) => {
                        const cur = prev[choiceKey] ?? [];
                        if (cur.length < count && !cur.includes(ci.id))
                          return { ...prev, [choiceKey]: [...cur, ci.id] };
                        return prev;
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "0.25rem 0.5rem",
                      border: "none",
                      borderBottom: "1px solid var(--border)",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontWeight: 600,
                        fontSize: "0.78rem",
                        color: "var(--text)",
                      }}
                    >
                      {ci.name}
                    </span>
                    {ci.damage && (
                      <span
                        style={{
                          fontSize: "0.62rem",
                          color: "var(--text-muted)",
                          flexShrink: 0,
                        }}
                      >
                        {ci.damage}
                      </span>
                    )}
                  </button>
                ))}
                {visible.length === 0 && (
                  <div
                    style={{
                      padding: "0.4rem 0.5rem",
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      fontStyle: "italic",
                    }}
                  >
                    No matches
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    function renderItemCell(name: string, choiceKey: string) {
      const hasOr = isOrItem(name);
      const options = hasOr ? parseOrOptions(name) : null;
      const resolved = hasOr ? (packChoices[choiceKey] ?? options![0]) : name;
      const isFreeChoice = /\bof\s+choice\b/i.test(resolved);
      const freeCount = /\bthree|3\b/i.test(resolved)
        ? 3
        : /\btwo|2\b/i.test(resolved)
          ? 2
          : 1;

      return (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}
        >
          {/* "or" toggle */}
          {hasOr && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.25rem",
                alignItems: "center",
              }}
            >
              {options!.map((opt, oi) => (
                <span
                  key={opt}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                  }}
                >
                  {oi > 0 && (
                    <span
                      style={{
                        fontSize: "0.65rem",
                        color: "var(--text-muted)",
                        fontStyle: "italic",
                      }}
                    >
                      or
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setPackChoices((prev) => ({ ...prev, [choiceKey]: opt }));
                      setPackFreeChoices((prev) => {
                        const n = { ...prev };
                        delete n[choiceKey];
                        return n;
                      });
                    }}
                    style={{
                      padding: "0.2rem 0.5rem",
                      borderRadius: "0.25rem",
                      border: `1.5px solid ${resolved === opt ? "var(--primary)" : "var(--border)"}`,
                      backgroundColor:
                        resolved === opt ? "var(--primary)" : "transparent",
                      color: resolved === opt ? "#fff" : "var(--text-muted)",
                      cursor: "pointer",
                      fontSize: "0.75rem",
                      fontFamily: "var(--font-heading)",
                      fontWeight: 600,
                    }}
                  >
                    {opt}
                  </button>
                </span>
              ))}
            </div>
          )}
          {/* Catalog picker for "of choice" */}
          {isFreeChoice &&
            renderCatalogPicker(
              choiceKey,
              freeCount,
              filterCatalogForChoice(resolved),
            )}
          {/* Static name */}
          {!hasOr && !isFreeChoice && (
            <span style={{ color: "var(--text)", fontSize: "0.85rem" }}>
              {name}
            </span>
          )}
        </div>
      );
    }

    function renderPickCategory(
      catLabel: string,
      items: string[],
      pickN: number,
    ) {
      const catKey = `origin_pick_${catLabel}`;
      const chosen = packPickChoices[catKey] ?? [];
      return (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
            {items.map((item) => {
              const active = chosen.includes(item);
              const atLimit = chosen.length >= pickN && !active;
              return (
                <button
                  key={item}
                  disabled={atLimit}
                  onClick={() =>
                    setPackPickChoices((prev) => {
                      const cur = prev[catKey] ?? [];
                      return {
                        ...prev,
                        [catKey]: active
                          ? cur.filter((i) => i !== item)
                          : cur.length < pickN
                            ? [...cur, item]
                            : cur,
                      };
                    })
                  }
                  style={{
                    padding: "0.2rem 0.5rem",
                    borderRadius: "0.25rem",
                    border: `1.5px solid ${active ? "var(--primary)" : "var(--border)"}`,
                    backgroundColor: active ? "var(--primary)" : "transparent",
                    color: active
                      ? "var(--bg)"
                      : atLimit
                        ? "var(--border)"
                        : "var(--text-muted)",
                    cursor: atLimit ? "not-allowed" : "pointer",
                    fontSize: "0.75rem",
                    fontFamily: "var(--font-heading)",
                    fontWeight: 600,
                    opacity: atLimit ? 0.5 : 1,
                  }}
                >
                  {item}
                </button>
              );
            })}
          </div>
          <div
            style={{
              fontSize: "0.68rem",
              color:
                chosen.length === pickN
                  ? "var(--primary)"
                  : "var(--text-muted)",
            }}
          >
            {chosen.length}/{pickN} selected
            {chosen.length < pickN
              ? ` — pick ${pickN - chosen.length} more`
              : " ✓"}
          </div>
        </div>
      );
    }

    const labelStyle: React.CSSProperties = {
      fontFamily: "var(--font-heading)",
      fontWeight: 700,
      color: "var(--text-muted)",
      minWidth: "80px",
      flexShrink: 0,
      fontSize: "0.68rem",
      textTransform: "uppercase" as const,
      letterSpacing: "0.04em",
      paddingTop: "0.25rem",
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <p
          style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}
        >
          Choose your starting equipment. Items marked <strong>or</strong> let
          you pick one option.
        </p>

        {profPack && (
          <div>
            <SectionLabel>{draft.professionName} Starting Pack</SectionLabel>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              {[
                { label: "Weapons", key: "weapons", items: profPack.weapons },
                { label: "Armor", key: "armor", items: profPack.armor },
                { label: "Kit", key: "kit", items: profPack.kit },
                {
                  label: "Inventory",
                  key: "inventory",
                  items: profPack.inventory,
                },
              ]
                .filter((cat) => cat.items.length > 0)
                .map((cat) => (
                  <div
                    key={cat.label}
                    style={{
                      display: "flex",
                      gap: "0.75rem",
                      padding: "0.5rem 0.75rem",
                      backgroundColor: "var(--bg-nav)",
                      borderRadius: "0.375rem",
                      alignItems: "flex-start",
                    }}
                  >
                    <span style={labelStyle}>{cat.label}</span>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.3rem",
                        flex: 1,
                      }}
                    >
                      {cat.items.map((n, i) => (
                        <div key={i}>
                          {renderItemCell(n, `prof_${cat.key}_${i}`)}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              {profPack.currency && (
                <div
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    padding: "0.5rem 0.75rem",
                    backgroundColor: "var(--bg-nav)",
                    borderRadius: "0.375rem",
                    alignItems: "center",
                  }}
                >
                  <span style={labelStyle}>Currency</span>
                  <span style={{ color: "var(--text)", fontSize: "0.85rem" }}>
                    {profPack.currency}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {originPack && (
          <div>
            <SectionLabel>{originPack.name}</SectionLabel>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              {originPack.categories.map((cat) => {
                const pickN = parsePickCount(cat.label);
                return (
                  <div
                    key={cat.label}
                    style={{
                      display: "flex",
                      gap: "0.75rem",
                      padding: "0.5rem 0.75rem",
                      backgroundColor: "var(--bg-nav)",
                      borderRadius: "0.375rem",
                      alignItems: "flex-start",
                    }}
                  >
                    <span style={labelStyle}>{cat.label}</span>
                    <div style={{ flex: 1 }}>
                      {pickN !== null ? (
                        renderPickCategory(cat.label, cat.items, pickN)
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.3rem",
                          }}
                        >
                          {cat.items.map((n, i) => (
                            <div key={i}>
                              {renderItemCell(n, `origin_${cat.label}_${i}`)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p
          style={{
            fontSize: "0.78rem",
            color: "var(--text-muted)",
            margin: 0,
            fontStyle: "italic",
          }}
        >
          These items are pre-filled into your inventory on the character sheet.
          You can edit them freely.
        </p>
      </div>
    );
  }

  function renderStep5() {
    // Proficiencies (was step 6)
    if (!selectedProf) return null;
    const { vitalsChoiceCount, vitalsOptions } = selectedProf;

    function toggleVital(skill: string) {
      const current = draft.vitalsProficiencies;
      if (current.includes(skill)) {
        update({ vitalsProficiencies: current.filter((s) => s !== skill) });
      } else if (current.length < vitalsChoiceCount) {
        update({ vitalsProficiencies: [...current, skill] });
      }
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div>
          <SectionLabel>V.I.T.A.L.S. Skills</SectionLabel>
          {vitalsChoiceCount > 0 ? (
            <>
              <p
                style={{
                  fontSize: "0.82rem",
                  color: "var(--text-muted)",
                  marginBottom: "0.75rem",
                }}
              >
                Choose <strong>{vitalsChoiceCount}</strong> from:{" "}
                {vitalsOptions.join(", ")}. &nbsp;(
                {draft.vitalsProficiencies.length}/{vitalsChoiceCount} chosen)
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                  gap: "0.5rem",
                }}
              >
                {vitalsOptions.map((skill) => {
                  const selected = draft.vitalsProficiencies.includes(skill);
                  const disabled =
                    !selected &&
                    draft.vitalsProficiencies.length >= vitalsChoiceCount;
                  return (
                    <button
                      key={skill}
                      onClick={() => !disabled && toggleVital(skill)}
                      style={{
                        padding: "0.5rem 0.75rem",
                        borderRadius: "0.375rem",
                        cursor: disabled ? "not-allowed" : "pointer",
                        border: `1.5px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                        backgroundColor: selected
                          ? "var(--primary-light)"
                          : "var(--bg-card)",
                        color: "var(--text)",
                        fontFamily: "var(--font-heading)",
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        opacity: disabled ? 0.4 : 1,
                        textAlign: "left",
                      }}
                    >
                      {selected && "✓ "}
                      {skill}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              No V.I.T.A.L.S. proficiency choices from this profession.
            </p>
          )}
        </div>

        {/* Full V.I.T.A.L.S. overview */}
        <div>
          <SectionLabel>All V.I.T.A.L.S.</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            {ALL_VITALS.map((skill) => {
              const proficient = draft.vitalsProficiencies.includes(skill);
              return (
                <span
                  key={skill}
                  style={{
                    fontSize: "0.8rem",
                    padding: "0.2rem 0.6rem",
                    borderRadius: "9999px",
                    fontFamily: "var(--font-heading)",
                    fontWeight: 600,
                    border: `1.5px solid ${proficient ? "var(--primary)" : "var(--border)"}`,
                    backgroundColor: proficient
                      ? "var(--primary-light)"
                      : "var(--bg-nav)",
                    color: proficient ? "var(--primary)" : "var(--text-muted)",
                  }}
                >
                  {proficient ? "✓ " : ""}
                  {skill}
                </span>
              );
            })}
          </div>
        </div>

        {/* Other proficiencies */}
        {[
          { label: "Armaments", items: selectedProf.armaments },
          { label: "Protection", items: selectedProf.protection },
          {
            label: "Tool Kits",
            items: selectedProf.toolKits.filter((t) => t !== "-"),
          },
        ]
          .filter((g) => g.items.length > 0)
          .map((group) => (
            <div key={group.label}>
              <SectionLabel>{group.label}</SectionLabel>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.35rem",
                }}
              >
                {group.items.map((item) => (
                  <div
                    key={item}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.625rem",
                      padding: "0.45rem 0.75rem",
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
    );
  }

  function renderStep6() {
    // Attributes (was step 5 — now after proficiencies)
    const attrs: AttributeKey[] = ["brawn", "finesse", "mind", "will"];
    const remaining = 5 - totalBasePoints;

    function adjust(attr: AttributeKey, delta: number) {
      const current = draft.baseAttributes[attr];
      const newVal = current + delta;
      if (newVal < 0 || newVal > 3) return;
      if (delta > 0 && remaining <= 0) return;
      update({ baseAttributes: { ...draft.baseAttributes, [attr]: newVal } });
    }

    const derived = selectedProf
      ? {
          startingVitality:
            calcStartingVitality(selectedProf, totalAttributes) +
            featVitalityBonus,
          bodyDef: calcFortitude(totalAttributes),
          mindDef: calcMentalDefense(totalAttributes),
          willDef: calcWillDefense(totalAttributes),
          wounds: calcMaxWounds(selectedProf ?? { woundBonusPerTier: 1 }, totalAttributes, draft.tier),
          carry: calcCarryWeight(totalAttributes, draft.tier),
        }
      : null;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div
          style={{
            padding: "0.75rem 1rem",
            backgroundColor: "var(--primary-light)",
            border: "1px solid var(--primary)",
            borderRadius: "0.5rem",
            fontSize: "0.85rem",
            color: "var(--text)",
          }}
        >
          Distribute <strong>5 points</strong> among Brawn, Finesse, Mind, and Will (max
          +3 each).
          {draft.vocationAttributeBonus.value > 0 && (
            <>
              {" "}
              Your <strong>{draft.vocationName}</strong> vocation adds{" "}
              <strong>
                +{draft.vocationAttributeBonus.value}{" "}
                {draft.vocationAttributeBonus.attribute
                  .charAt(0)
                  .toUpperCase() +
                  draft.vocationAttributeBonus.attribute.slice(1)}
              </strong>{" "}
              automatically.
            </>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "1rem",
          }}
        >
          {attrs.map((attr) => {
            const base = draft.baseAttributes[attr];
            const total = totalAttributes[attr];
            const isVoc = draft.vocationAttributeBonus.attribute === attr;
            return (
              <div
                key={attr}
                style={{
                  textAlign: "center",
                  padding: "1rem",
                  backgroundColor: "var(--bg-nav)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.5rem",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontWeight: 700,
                    fontSize: "0.7rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--text-muted)",
                    marginBottom: "0.625rem",
                  }}
                >
                  {attr.charAt(0).toUpperCase() + attr.slice(1)}
                </div>
                <div
                  style={{
                    fontSize: "2rem",
                    fontWeight: 700,
                    fontFamily: "var(--font-heading)",
                    color: "var(--primary)",
                    marginBottom: "0.4rem",
                    lineHeight: 1,
                  }}
                >
                  {total >= 0 ? `+${total}` : total}
                </div>
                {isVoc && (
                  <div
                    style={{
                      fontSize: "0.62rem",
                      color: "var(--accent)",
                      fontWeight: 600,
                      fontFamily: "var(--font-heading)",
                      marginBottom: "0.4rem",
                    }}
                  >
                    +{draft.vocationAttributeBonus.value} from{" "}
                    {draft.vocationName}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.75rem",
                  }}
                >
                  <button
                    onClick={() => adjust(attr, -1)}
                    disabled={base <= 0}
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      border: "1.5px solid var(--border)",
                      backgroundColor: "var(--bg-card)",
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: "1rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    −
                  </button>
                  <span
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontWeight: 700,
                      minWidth: "20px",
                      textAlign: "center",
                    }}
                  >
                    {base >= 0 ? `+${base}` : base}
                  </span>
                  <button
                    onClick={() => adjust(attr, 1)}
                    disabled={base >= 3 || remaining <= 0}
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      border: "1.5px solid var(--border)",
                      backgroundColor: "var(--bg-card)",
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: "1rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            textAlign: "center",
            fontSize: "0.9rem",
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            color: remaining === 0 ? "var(--primary)" : "var(--accent)",
          }}
        >
          {remaining} point{remaining !== 1 ? "s" : ""} remaining
        </div>

        {derived && (
          <div>
            <SectionLabel>Derived Stats Preview</SectionLabel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "0.5rem",
              }}
            >
              <StatBox
                label="Starting Vitality"
                value={derived.startingVitality}
                sub={selectedProf!.vitalityPerTier + "/tier"}
              />
              <StatBox label="Body Def" value={derived.bodyDef} />
              <StatBox label="Mind Def" value={derived.mindDef} />
              <StatBox label="Will Def" value={derived.willDef} />
              <StatBox label="Max Wounds" value={derived.wounds} />
              <StatBox label="Carry Weight" value={derived.carry} />
            </div>
          </div>
        )}

        {/* Spellcasting modifier choice */}
        {effectiveCaster &&
          effectiveCaster.casterModifierOptions.length > 1 && (
            <div>
              <SectionLabel>Spellcasting Modifier</SectionLabel>
              <div style={{ display: "flex", gap: "0.625rem" }}>
                {effectiveCaster.casterModifierOptions.map((attr) => (
                  <div
                    key={attr}
                    onClick={() => update({ spellcastingModifier: attr })}
                    style={{
                      padding: "0.625rem 1rem",
                      borderRadius: "0.5rem",
                      cursor: "pointer",
                      border: `2px solid ${draft.spellcastingModifier === attr ? "var(--primary)" : "var(--border)"}`,
                      backgroundColor:
                        draft.spellcastingModifier === attr
                          ? "var(--primary-light)"
                          : "var(--bg-card)",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontWeight: 700,
                        fontSize: "0.9rem",
                        color:
                          draft.spellcastingModifier === attr
                            ? "var(--primary)"
                            : "var(--text)",
                      }}
                    >
                      {attr.charAt(0).toUpperCase() + attr.slice(1)} (
                      {totalAttributes[attr] >= 0
                        ? `+${totalAttributes[attr]}`
                        : totalAttributes[attr]}
                      )
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>
    );
  }

  function renderStep7() {
    const allMyFeats = [...myProfFeats, ...myOriginFeats];
    if (allMyFeats.length === 0) {
      return (
        <p style={{ color: "var(--text-muted)" }}>
          No feats available for your selections.
        </p>
      );
    }

    const allowance = draft.featAllowance;

    function renderFeatGroup(feats: BuilderFeat[], title: string) {
      const byTier: Record<number, BuilderFeat[]> = {};
      feats.forEach((f) => {
        if (!byTier[f.tier ?? 1]) byTier[f.tier ?? 1] = [];
        byTier[f.tier ?? 1].push(f);
      });

      return (
        <div>
          <h3
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              fontSize: "1rem",
              color: "var(--text)",
              marginBottom: "0.75rem",
              paddingBottom: "0.375rem",
              borderBottom: "2px solid var(--primary)",
              display: "inline-block",
            }}
          >
            {title}
          </h3>
          {Object.keys(byTier)
            .map(Number)
            .sort()
            .map((tier) => (
              <div key={tier} style={{ marginBottom: "1rem" }}>
                <div
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    letterSpacing: "0.07em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-heading)",
                    marginBottom: "0.4rem",
                  }}
                >
                  Tier {tier}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.375rem",
                  }}
                >
                  {byTier[tier].map((feat) => {
                    const selected = draft.selectedFeatIds.includes(feat.id);
                    const status = getFeatStatus(
                      feat,
                      draft.selectedFeatIds,
                      allFeats,
                      atFeatCap && !selected,
                    );
                    const blocked = status.blocked;
                    const expanded = expandedFeatIds.has(feat.id);
                    return (
                      <div
                        key={feat.id}
                        style={{
                          borderRadius: "0.375rem",
                          overflow: "hidden",
                          border: `1.5px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                          opacity: blocked && !selected ? 0.5 : 1,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: "0.75rem",
                            alignItems: "flex-start",
                            padding: "0.625rem 0.875rem",
                            backgroundColor: selected
                              ? "var(--primary-light)"
                              : "var(--bg-card)",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={blocked && !selected}
                            onChange={() => toggleFeat(feat.id)}
                            style={{
                              marginTop: "0.2rem",
                              accentColor: "var(--primary)",
                              flexShrink: 0,
                              cursor:
                                blocked && !selected
                                  ? "not-allowed"
                                  : "pointer",
                            }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontFamily: "var(--font-heading)",
                                fontWeight: 600,
                                fontSize: "0.875rem",
                                color: "var(--text)",
                                marginBottom: "0.1rem",
                              }}
                            >
                              {feat.name}
                            </div>
                            {status.reason && !selected && (
                              <div
                                style={{
                                  fontSize: "0.7rem",
                                  color: "var(--text-muted)",
                                  fontStyle: "italic",
                                }}
                              >
                                ⚠ {status.reason}
                              </div>
                            )}
                            {feat.required &&
                              !status.reason &&
                              (() => {
                                const { positiveReqs, exclusions } =
                                  parseRequired(feat.required);
                                return (
                                  <>
                                    {positiveReqs.length > 0 && (
                                      <div
                                        style={{
                                          fontSize: "0.7rem",
                                          color: "var(--text-muted)",
                                        }}
                                      >
                                        Requires: {positiveReqs.join(", ")}
                                      </div>
                                    )}
                                    {exclusions.length > 0 && (
                                      <div
                                        style={{
                                          fontSize: "0.7rem",
                                          color: "var(--text-muted)",
                                        }}
                                      >
                                        Cannot own: {exclusions.join(", ")}
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            {feat.pathInvestment && !status.reason && (
                              <div
                                style={{
                                  fontSize: "0.7rem",
                                  color: "var(--text-muted)",
                                }}
                              >
                                Investment: {feat.pathInvestment}
                              </div>
                            )}
                            {feat.activationRaw &&
                              feat.activationRaw !== "-" &&
                              feat.activationRaw !== "null" && (
                                <div
                                  style={{
                                    fontSize: "0.68rem",
                                    color: "var(--accent)",
                                    fontFamily: "var(--font-heading)",
                                    fontWeight: 600,
                                    marginTop: "0.1rem",
                                  }}
                                >
                                  {feat.activationRaw}
                                </div>
                              )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBuilderFeat(feat.id);
                            }}
                            style={{
                              flexShrink: 0,
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "0.7rem",
                              color: "var(--text-muted)",
                              padding: "0.1rem 0.25rem",
                              lineHeight: 1,
                            }}
                            title={expanded ? "Collapse" : "Read description"}
                          >
                            {expanded ? "▲" : "▼"}
                          </button>
                        </div>
                        {expanded && (
                          <div
                            style={{
                              padding: "0.625rem 0.875rem 0.75rem",
                              borderTop: "1px solid var(--border)",
                              backgroundColor: "var(--bg-nav)",
                              fontSize: "0.82rem",
                              lineHeight: 1.65,
                              color: "var(--text)",
                            }}
                          >
                            <MarkdownContent
                              content={feat.descriptionMarkdown}
                            />
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

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        {/* Cap indicator */}
        <div
          style={{
            padding: "0.625rem 1rem",
            backgroundColor:
              allowance === 0
                ? "var(--bg-nav)"
                : atFeatCap
                  ? "var(--accent-light)"
                  : "var(--primary-light)",
            border: `1px solid ${allowance === 0 ? "var(--border)" : atFeatCap ? "rgb(var(--gold-rgb) / 0.40)" : "var(--primary)"}`,
            borderRadius: "0.5rem",
            fontSize: "0.85rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ color: "var(--text)" }}>
            {allowance === 0 ? (
              "Tier 1 characters start with 0 feats. Feats are earned through play."
            ) : (
              <>
                <strong>{draft.selectedFeatIds.length}</strong> / {allowance}{" "}
                feat{allowance !== 1 ? "s" : ""} selected
              </>
            )}
          </span>
          {draft.selectedFeatIds.length > 0 && (
            <button
              onClick={() => update({ selectedFeatIds: [] })}
              style={{
                fontSize: "0.72rem",
                color: "var(--primary)",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-heading)",
                fontWeight: 600,
              }}
            >
              Clear
            </button>
          )}
        </div>

        {myProfFeats.length > 0 &&
          renderFeatGroup(myProfFeats, `${draft.professionName} Feats`)}
        {myOriginFeats.length > 0 &&
          renderFeatGroup(myOriginFeats, `${draft.originName} Feats`)}
      </div>
    );
  }

  function renderSpellSelection() {
    if (!effectiveCaster) return null;

    function toggleSpell(id: string) {
      update({
        knownSpellIds: draft.knownSpellIds.includes(id)
          ? draft.knownSpellIds.filter((s) => s !== id)
          : [...draft.knownSpellIds, id],
      });
    }

    const modKey =
      effectiveCaster.casterModifierOptions.length === 1
        ? effectiveCaster.casterModifierOptions[0]
        : effectiveCaster.casterModifierOptions.length > 1
          ? effectiveCaster.casterModifierOptions.reduce((best, key) =>
              totalAttributes[key] >= totalAttributes[best] ? key : best
            )
          : (draft.spellcastingModifier ?? "mind");
    const modVal = totalAttributes[modKey];
    const reservoir = calcReservoir(
      effectiveCaster.casterType,
      draft.tier,
      modVal,
    );
    const builderThreshold = calcSpellcastingThreshold(
      FEAT_ALLOWANCE[draft.tier] ?? 0,
    );
    const builderSpellTier = calcSpellcastingTier(
      effectiveCaster.casterType,
      builderThreshold,
    );
    const spellDC = calcSpellDC(builderSpellTier, modVal);
    const cantrips = mySpells.filter((s) => s.isCantrip);
    const tieredSpells = mySpells.filter((s) => !s.isCantrip);
    const byTier: Record<number, BuilderSpell[]> = {};
    tieredSpells.forEach((s) => {
      if (!byTier[s.tier]) byTier[s.tier] = [];
      byTier[s.tier].push(s);
    });

    return (
      <div
        style={{
          marginTop: "1.5rem",
          paddingTop: "1.5rem",
          borderTop: "1px solid var(--border)",
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
            fontSize: "1rem",
            color: "var(--text)",
            marginBottom: "0.875rem",
            paddingBottom: "0.375rem",
            borderBottom: "2px solid var(--primary)",
            display: "inline-block",
          }}
        >
          Known Spells
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "0.5rem",
            marginBottom: "1rem",
          }}
        >
          <StatBox
            label="Caster Type"
            value={
              effectiveCaster.casterType === "full"
                ? "Full"
                : effectiveCaster.casterType === "half"
                  ? "Half"
                  : "Limited"
            }
          />
          <StatBox
            label="Reservoir"
            value={reservoir ?? "—"}
            sub={effectiveCaster.casterSource}
          />
          <StatBox label="Spell DC" value={spellDC} />
        </div>
        <p
          style={{
            fontSize: "0.8rem",
            color: "var(--text-muted)",
            marginBottom: "0.75rem",
          }}
        >
          {draft.knownSpellIds.length} spell
          {draft.knownSpellIds.length !== 1 ? "s" : ""} selected. Check all
          spells your character currently knows.
        </p>

        {cantrips.length > 0 && (
          <div style={{ marginBottom: "1rem" }}>
            <div
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                fontFamily: "var(--font-heading)",
                marginBottom: "0.4rem",
              }}
            >
              Cantrips
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
              }}
            >
              {cantrips.map((s) => {
                const sel = draft.knownSpellIds.includes(s.id);
                const expanded = expandedSpellIds.has(s.id);
                return (
                  <div
                    key={s.id}
                    style={{
                      borderRadius: "0.375rem",
                      overflow: "hidden",
                      border: `1.5px solid ${sel ? "var(--primary)" : "var(--border)"}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "0.75rem",
                        alignItems: "center",
                        padding: "0.5rem 0.875rem",
                        backgroundColor: sel
                          ? "var(--primary-light)"
                          : "var(--bg-card)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={sel}
                        onChange={() => toggleSpell(s.id)}
                        style={{
                          accentColor: "var(--primary)",
                          flexShrink: 0,
                          cursor: "pointer",
                        }}
                      />
                      <span
                        style={{
                          fontFamily: "var(--font-heading)",
                          fontWeight: 600,
                          fontSize: "0.875rem",
                          color: "var(--text)",
                          flex: 1,
                        }}
                      >
                        {s.name}
                      </span>
                      {(s.range || s.duration) && (
                        <span
                          style={{
                            fontSize: "0.7rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          {[
                            s.range && `R: ${s.range}`,
                            s.duration && `D: ${s.duration}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                      <button
                        onClick={() => toggleBuilderSpell(s.id)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "0.7rem",
                          color: "var(--text-muted)",
                          padding: "0.1rem 0.25rem",
                          lineHeight: 1,
                        }}
                      >
                        {expanded ? "▲" : "▼"}
                      </button>
                    </div>
                    {expanded && (
                      <div
                        style={{
                          padding: "0.625rem 0.875rem 0.75rem",
                          borderTop: "1px solid var(--border)",
                          backgroundColor: "var(--bg-nav)",
                          fontSize: "0.82rem",
                          lineHeight: 1.65,
                          color: "var(--text)",
                        }}
                      >
                        {s.school && (
                          <div
                            style={{
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              color: "var(--text-muted)",
                              fontFamily: "var(--font-heading)",
                              marginBottom: "0.375rem",
                            }}
                          >
                            {s.school}
                          </div>
                        )}
                        <MarkdownContent content={s.descriptionMarkdown} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {Object.keys(byTier)
          .map(Number)
          .sort()
          .map((tier) => (
            <div key={tier} style={{ marginBottom: "1rem" }}>
              <div
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-heading)",
                  marginBottom: "0.4rem",
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
                {byTier[tier].map((s) => {
                  const sel = draft.knownSpellIds.includes(s.id);
                  const expanded = expandedSpellIds.has(s.id);
                  return (
                    <div
                      key={s.id}
                      style={{
                        borderRadius: "0.375rem",
                        overflow: "hidden",
                        border: `1.5px solid ${sel ? "var(--primary)" : "var(--border)"}`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: "0.75rem",
                          alignItems: "center",
                          padding: "0.5rem 0.875rem",
                          backgroundColor: sel
                            ? "var(--primary-light)"
                            : "var(--bg-card)",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={sel}
                          onChange={() => toggleSpell(s.id)}
                          style={{
                            accentColor: "var(--primary)",
                            flexShrink: 0,
                            cursor: "pointer",
                          }}
                        />
                        <span
                          style={{
                            fontFamily: "var(--font-heading)",
                            fontWeight: 600,
                            fontSize: "0.875rem",
                            color: "var(--text)",
                            flex: 1,
                          }}
                        >
                          {s.name}
                        </span>
                        {(s.range || s.duration) && (
                          <span
                            style={{
                              fontSize: "0.7rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            {[
                              s.range && `R: ${s.range}`,
                              s.duration && `D: ${s.duration}`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        )}
                        <button
                          onClick={() => toggleBuilderSpell(s.id)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "0.7rem",
                            color: "var(--text-muted)",
                            padding: "0.1rem 0.25rem",
                            lineHeight: 1,
                          }}
                        >
                          {expanded ? "▲" : "▼"}
                        </button>
                      </div>
                      {expanded && (
                        <div
                          style={{
                            padding: "0.625rem 0.875rem 0.75rem",
                            borderTop: "1px solid var(--border)",
                            backgroundColor: "var(--bg-nav)",
                            fontSize: "0.82rem",
                            lineHeight: 1.65,
                            color: "var(--text)",
                          }}
                        >
                          {s.school && (
                            <div
                              style={{
                                fontSize: "0.68rem",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                color: "var(--text-muted)",
                                fontFamily: "var(--font-heading)",
                                marginBottom: "0.375rem",
                              }}
                            >
                              {s.school}
                            </div>
                          )}
                          <MarkdownContent content={s.descriptionMarkdown} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

        {cantrips.length === 0 && Object.keys(byTier).length === 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
            No spells found for {effectiveCaster.casterSource} source.
          </p>
        )}
      </div>
    );
  }

  function renderStep8() {
    const startVit = selectedProf
      ? calcStartingVitality(selectedProf, totalAttributes) + featVitalityBonus
      : 10;

    // Pre-build combined inventory suggestion
    const packLines: string[] = [];
    const profPack = selectedProf?.startingPack;
    if (profPack) {
      if (profPack.weapons.length)
        packLines.push(`Weapons: ${profPack.weapons.join(", ")}`);
      if (profPack.armor.length)
        packLines.push(`Armor: ${profPack.armor.join(", ")}`);
      if (profPack.kit.length)
        packLines.push(`Kit: ${profPack.kit.join(", ")}`);
      if (profPack.inventory.length)
        packLines.push(`Inventory: ${profPack.inventory.join(", ")}`);
    }
    const originPack = selectedOrigin?.originPack;
    if (originPack) {
      originPack.categories.forEach((cat) =>
        packLines.push(`${cat.label}: ${cat.items.join(", ")}`),
      );
    }
    const suggestedInventory = packLines.join("\n");
    const suggestedCurrency = profPack?.currency ?? "";

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* Character overview */}
        <div
          style={{
            padding: "1rem 1.25rem",
            backgroundColor: "var(--bg-nav)",
            border: "1px solid var(--border)",
            borderRadius: "0.625rem",
          }}
        >
          <SectionLabel>Overview</SectionLabel>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.3rem",
              fontSize: "0.875rem",
            }}
          >
            {[
              ["Name", draft.name],
              [
                "Tier",
                `${draft.tier} (${draft.featAllowance} feat${draft.featAllowance !== 1 ? "s" : ""})`,
              ],
              ["Profession", draft.professionName],
              [
                "Origin",
                `${draft.originName}${draft.vocationName ? ` — ${draft.vocationName}` : ""}`,
              ],
              [
                "Attributes",
                `Brawn ${totalAttributes.brawn >= 0 ? "+" : ""}${totalAttributes.brawn} · Finesse ${totalAttributes.finesse >= 0 ? "+" : ""}${totalAttributes.finesse} · Mind ${totalAttributes.mind >= 0 ? "+" : ""}${totalAttributes.mind} · Will ${totalAttributes.will >= 0 ? "+" : ""}${totalAttributes.will}`,
              ],
              [
                "Starting Vitality",
                String(startVit) +
                  (featVitalityBonus > 0
                    ? ` (+${featVitalityBonus} from feats)`
                    : ""),
              ],
              [
                "Feats",
                `${draft.selectedFeatIds.length} / ${draft.featAllowance}`,
              ],
            ].map(([label, val]) => (
              <div key={label} style={{ display: "flex", gap: "0.75rem" }}>
                <span
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontWeight: 600,
                    minWidth: "110px",
                    color: "var(--text-muted)",
                    flexShrink: 0,
                  }}
                >
                  {label}
                </span>
                <span style={{ color: "var(--text)" }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Spells for casters */}
        {renderSpellSelection()}

        {/* Final details */}
        <div>
          <SectionLabel>Ambition</SectionLabel>
          <input
            type="text"
            value={draft.ambition}
            onChange={(e) => update({ ambition: e.target.value })}
            placeholder="What drives your character?"
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              fontSize: "0.9rem",
              fontFamily: "var(--font-body)",
              border: "1.5px solid var(--border)",
              borderRadius: "0.375rem",
              backgroundColor: "var(--bg-card)",
              color: "var(--text)",
              outline: "none",
            }}
          />
        </div>

        <div>
          <SectionLabel>Starting Currency</SectionLabel>
          <input
            type="text"
            value={draft.currency || suggestedCurrency}
            onChange={(e) => update({ currency: e.target.value })}
            placeholder={suggestedCurrency || "e.g. 15 gold…"}
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              fontSize: "0.9rem",
              fontFamily: "var(--font-body)",
              border: "1.5px solid var(--border)",
              borderRadius: "0.375rem",
              backgroundColor: "var(--bg-card)",
              color: "var(--text)",
              outline: "none",
            }}
          />
        </div>

        <div>
          <SectionLabel>Inventory</SectionLabel>
          <textarea
            value={draft.inventoryNotes || suggestedInventory}
            onChange={(e) => update({ inventoryNotes: e.target.value })}
            rows={5}
            placeholder={suggestedInventory || "List your starting equipment…"}
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              fontSize: "0.875rem",
              fontFamily: "var(--font-body)",
              border: "1.5px solid var(--border)",
              borderRadius: "0.375rem",
              backgroundColor: "var(--bg-card)",
              color: "var(--text)",
              outline: "none",
              resize: "vertical",
            }}
          />
        </div>

        <div>
          <SectionLabel>Character Notes</SectionLabel>
          <textarea
            value={draft.notes}
            onChange={(e) => update({ notes: e.target.value })}
            rows={4}
            placeholder="Backstory, appearance, personality…"
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              fontSize: "0.875rem",
              fontFamily: "var(--font-body)",
              border: "1.5px solid var(--border)",
              borderRadius: "0.375rem",
              backgroundColor: "var(--bg-card)",
              color: "var(--text)",
              outline: "none",
              resize: "vertical",
            }}
          />
        </div>
      </div>
    );
  }

  const stepContent: Record<number, () => React.ReactNode> = {
    1: renderStep1,
    2: renderStep2,
    3: renderStep3,
    4: renderStep4,
    5: renderStep5,
    6: renderStep6,
    7: renderStep7,
    8: renderStep8,
  };

  const isLast = step === STEPS.length;

  return (
    <div style={{ maxWidth: "720px" }}>
      {/* ── Step rail ── */}
      <div style={{ marginBottom: "2rem" }}>
        {/* Dots + connecting lines */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: "0.5rem" }}>
          {STEPS.map((s, i) => {
            const done   = s.id < step;
            const active = s.id === step;
            return (
              <div
                key={s.id}
                style={{
                  display: "flex", alignItems: "center",
                  flex: i === 0 ? "none" : 1,
                }}
              >
                {i > 0 && (
                  <div style={{
                    flex: 1, height: "1px",
                    backgroundColor: done ? "var(--gold)" : "var(--border)",
                    transition: "background-color 0.2s",
                  }} />
                )}
                <button
                  onClick={() => done && setStep(s.id)}
                  title={s.label}
                  style={{
                    width: "26px", height: "26px",
                    borderRadius: "50%",
                    border: active
                      ? "2px solid var(--gold)"
                      : done
                        ? "none"
                        : "1.5px solid var(--border)",
                    backgroundColor: done
                      ? "var(--gold)"
                      : active
                        ? "rgb(var(--gold-rgb) / 0.1)"
                        : "var(--bg-2)",
                    color: done
                      ? "var(--bg)"
                      : active
                        ? "var(--gold)"
                        : "var(--text-tertiary)",
                    cursor: done ? "pointer" : "default",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.6rem", fontWeight: 600,
                    flexShrink: 0, padding: 0,
                    transition: "all 0.2s",
                  }}
                >
                  {done ? "✓" : s.id}
                </button>
              </div>
            );
          })}
        </div>
        {/* Step labels */}
        <div style={{ display: "flex", marginBottom: "1.25rem" }}>
          {STEPS.map((s, i) => {
            const done   = s.id < step;
            const active = s.id === step;
            return (
              <div
                key={s.id}
                style={{
                  flex: i === 0 ? "none" : 1,
                  minWidth: 0,
                  fontFamily: "var(--font-mono)", fontSize: "8.5px",
                  letterSpacing: "0.04em", textTransform: "uppercase",
                  color: active ? "var(--gold)" : done ? "var(--text-secondary)" : "var(--text-tertiary)",
                  textAlign: i === 0 ? "left" : "center",
                  transition: "color 0.2s",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  paddingLeft: i === 0 ? 0 : undefined,
                }}
              >
                {s.label}
              </div>
            );
          })}
        </div>
        {/* Step title */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "baseline",
        }}>
          <h2 style={{
            fontFamily: "var(--font-heading)", fontStyle: "italic",
            fontWeight: 500, fontSize: "1.5rem",
            color: "var(--text-primary)", margin: 0,
          }}>
            {choiceQueue.length > 0 ? "Feature Choices" : STEP_TITLES[step]}
          </h2>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "0.7rem",
            color: "var(--text-tertiary)", letterSpacing: "0.04em",
          }}>
            STEP {step} / {STEPS.length}
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginBottom: "2rem", minHeight: "200px" }}>
        {choiceQueue.length > 0
          ? renderChoiceResolution()
          : stepContent[step]?.()}
      </div>

      {/* Navigation — hidden when choice resolution is active (it has its own nav) */}
      {choiceQueue.length === 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            paddingTop: "1rem",
            borderTop: "1px solid var(--border)",
          }}
        >
          <button
            onClick={handleBack}
            disabled={step === 1}
            style={{
              padding: "0.625rem 1.25rem",
              border: "1.5px solid var(--border)",
              borderRadius: "0.5rem",
              cursor: step === 1 ? "not-allowed" : "pointer",
              backgroundColor: "var(--bg-card)",
              color: "var(--text-muted)",
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              fontSize: "0.875rem",
              opacity: step === 1 ? 0.4 : 1,
            }}
          >
            ← Back
          </button>

          {!isLast ? (
            <button
              onClick={handleNext}
              disabled={!canAdvance()}
              style={{
                padding: "0.625rem 1.5rem",
                border: "none",
                borderRadius: "0.5rem",
                cursor: canAdvance() ? "pointer" : "not-allowed",
                backgroundColor: canAdvance()
                  ? "var(--primary)"
                  : "var(--border)",
                color: canAdvance() ? "var(--bg)" : "var(--text-muted)",
                fontFamily: "var(--font-heading)",
                fontWeight: 600,
                fontSize: "0.875rem",
              }}
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSave}
              style={{
                padding: "0.625rem 1.75rem",
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
                backgroundColor: "var(--primary)",
                color: "var(--bg)",
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
                fontSize: "0.875rem",
              }}
            >
              Save Character →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
