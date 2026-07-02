"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MarkdownContent from "./MarkdownContent";
import NotesTab from "./tabs/NotesTab";
import FeatsTab from "./tabs/FeatsTab";
import SpellsTab from "./tabs/SpellsTab";
import CombatTab from "./tabs/CombatTab";
import InventoryTab from "./tabs/InventoryTab";
import ConditionsBar from "./ConditionsBar";
import LeftRail from "./rails/LeftRail";
import RightRail from "./rails/RightRail";
import SettingsPanel from "./SettingsPanel";
import { useTweaks } from "@/lib/useTweaks";
import {
  getCharacter,
  updateCharacter,
  deleteCharacter,
} from "@/lib/characterStorage";
import {
  getTotalAttributes,
  calcStartingVitality,
  calcFeatVitalityBonus,
  calcFortitude,
  calcMentalDefense,
  calcWillDefense,
  calcMaxWounds,
  calcCarryWeight,
  calcReservoir,
  calcSpellDC,
  calcAmbition,
  calcArmorDefense,
  calcTierFromFeatsPurchased,
  calcSpellcastingThreshold,
  calcSpellcastingTier,
  calcKnownSpells,
  calcPreparedSpells,
  calcSkillPool,
  calcSkillAttrValue,
  calcBaseDiceFromAttr,
  calcFullMaxVitality,
  computeKnownSpheres,
  evalResourceMax,
  applyResourceRestore,
} from "@/lib/characterCalc";
import type { SkillPoolInfo, ProficiencyRank } from "@/lib/characterCalc";
import type {
  Character,
  BuilderProfession,
  BuilderOrigin,
  BuilderFeat,
  BuilderSpell,
  InventoryItem,
  InventorySlot,
  ChoiceFeature,
  AttributeKey,
} from "@/lib/characterTypes";
import type { CatalogItem } from "@/lib/builderData";
import { FEAT_COST_BY_TIER } from "@/lib/featLogic";

interface Props {
  id: string;
  professions: BuilderProfession[];
  origins: BuilderOrigin[];
  professionFeats: BuilderFeat[];
  originFeats: BuilderFeat[];
  spells: BuilderSpell[];
  catalog: CatalogItem[];
  choiceFeatures: ChoiceFeature[];
}

type TabId = "combat" | "feats" | "inventory" | "spellcasting" | "notes";

// ─── Helper components ────────────────────────────────────────────────────────

function EditableNumber({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "0.625rem 0.5rem",
        backgroundColor: "var(--bg-nav)",
        border: "1px solid var(--border)",
        borderRadius: "0.5rem",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 700,
          fontSize: "0.6rem",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--text-muted)",
          marginBottom: "0.375rem",
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
        }}
      >
        <button
          onClick={() => onChange(Math.max(min ?? 0, value - 1))}
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            border: "1px solid var(--border)",
            backgroundColor: "var(--bg-card)",
            cursor: "pointer",
            fontWeight: 700,
            color: "var(--text-muted)",
            fontSize: "0.9rem",
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
            fontSize: "1.3rem",
            color: "var(--primary)",
            minWidth: "32px",
            textAlign: "center",
          }}
        >
          {value}
        </span>
        <button
          onClick={() =>
            onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)
          }
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            border: "1px solid var(--border)",
            backgroundColor: "var(--bg-card)",
            cursor: "pointer",
            fontWeight: 700,
            color: "var(--text-muted)",
            fontSize: "0.9rem",
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
}

function DeltaNumber({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  const [delta, setDelta] = React.useState("");
  function applyDelta() {
    const n = parseInt(delta);
    if (isNaN(n)) return;
    const next = value + n;
    const clamped = Math.max(
      min ?? -Infinity,
      max !== undefined ? Math.min(max, next) : next,
    );
    onChange(clamped);
    setDelta("");
  }
  return (
    <div
      style={{
        textAlign: "center",
        padding: "0.625rem 0.5rem",
        backgroundColor: "var(--bg-nav)",
        border: "1px solid var(--border)",
        borderRadius: "0.5rem",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 700,
          fontSize: "0.6rem",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--text-muted)",
          marginBottom: "0.375rem",
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
        }}
      >
        <button
          onClick={() => onChange(Math.max(min ?? 0, value - 1))}
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            border: "1px solid var(--border)",
            backgroundColor: "var(--bg-card)",
            cursor: "pointer",
            fontWeight: 700,
            color: "var(--text-muted)",
            fontSize: "0.9rem",
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
            fontSize: "1.3rem",
            color: "var(--primary)",
            minWidth: "32px",
            textAlign: "center",
          }}
        >
          {value}
        </span>
        <button
          onClick={() =>
            onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)
          }
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            border: "1px solid var(--border)",
            backgroundColor: "var(--bg-card)",
            cursor: "pointer",
            fontWeight: 700,
            color: "var(--text-muted)",
            fontSize: "0.9rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          +
        </button>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.3rem",
          marginTop: "0.35rem",
        }}
      >
        <input
          type="text"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applyDelta();
          }}
          placeholder="±"
          style={{
            width: "48px",
            padding: "0.15rem 0.25rem",
            fontSize: "0.78rem",
            fontFamily: "var(--font-heading)",
            border: "1px solid var(--border)",
            borderRadius: "0.25rem",
            backgroundColor: "var(--bg-card)",
            color: "var(--text)",
            textAlign: "center",
          }}
        />
        <button
          onClick={applyDelta}
          style={{
            padding: "0.15rem 0.4rem",
            fontSize: "0.68rem",
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
            border: "none",
            borderRadius: "0.25rem",
            backgroundColor: "var(--primary)",
            color: "var(--text-on-primary)",
            cursor: "pointer",
          }}
        >
          Apply
        </button>
      </div>
    </div>
  );
}

function StatCard({
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
        borderRadius: "8px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 700,
          fontSize: "1.15rem",
          color: "var(--primary)",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: "0.6rem",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--text-muted)",
          marginTop: "2px",
        }}
      >
        {label}
      </div>
      {sub && (
        <div
          style={{
            fontSize: "0.6rem",
            color: "var(--text-muted)",
            marginTop: "1px",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "6px",
        overflow: "hidden",
        marginBottom: "1rem",
      }}
    >
      <div
        style={{
          padding: "0.625rem 1rem",
          borderBottom: "1px solid var(--border)",
          backgroundColor: "var(--bg-nav)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: "0.7rem",
            letterSpacing: "0.12em",
            color: "var(--text-muted)",
            margin: 0,
            textTransform: "uppercase",
          }}
        >
          {title}
        </h2>
      </div>
      <div style={{ padding: "0.875rem 1rem" }}>{children}</div>
    </section>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CharacterSheetPage({
  id,
  professions,
  origins,
  professionFeats,
  originFeats,
  spells,
  catalog,
  choiceFeatures,
}: Props) {
  const router = useRouter();
  const [char, setChar] = useState<Character | null>(null);
  const [mounted, setMounted] = useState(false);
  // editingNotes / notesVal removed — replaced by journal system

  const [activeTab, setActiveTab] = useState<TabId>("combat");

  // Inventory add-form / edit / slot-picker state moved into components/tabs/InventoryTab.tsx (R6)

  // Drag-and-drop equip (shared: inventory rows + equip slots elsewhere)
  const [dragOverSlot, setDragOverSlot] = useState<InventorySlot>(null);
  const dragItemId = React.useRef<string | null>(null);
  // Touch drag state (refs to avoid re-render on every move)
  const touchGhostRef = React.useRef<HTMLDivElement | null>(null);
  const touchDragItemId = React.useRef<string | null>(null);
  const touchDragItemName = React.useRef<string>("");
  const touchLongPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Item notes popover + traits editing state → components/tabs/InventoryTab.tsx (R6)

  // Display settings panel (R8) — useTweaks here applies density on load
  const [showSettings, setShowSettings] = useState(false);
  const { density, setDensity } = useTweaks();

  // Portrait image upload (thumbnail in header; full modal via portraitOpen)
  const [portraitUrl, setPortraitUrl] = useState<string | null>(null);
  const [portraitOpen, setPortraitOpen] = useState(false);
  // conditionsCollapsed → components/tabs/CombatTab.tsx (R5)
  const [vitAdjInput, setVitAdjInput] = useState<string | null>(null);
  const [renownAdjInput, setRenownAdjInput] = useState<string | null>(null);
  const portraitInputRef = React.useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (char?.id) {
      const stored = localStorage.getItem(`portrait-${char.id}`);
      setPortraitUrl(stored ?? null);
    }
  }, [char?.id]);

  // filteredCatalog memo → components/tabs/InventoryTab.tsx (R6)

  // Spell amp / feed / manager state moved into components/tabs/SpellsTab.tsx (R4)

  // Feat shop / swap / choice-edit / expand state moved into components/tabs/FeatsTab.tsx (R3)

  // FEATURE-01: Ref sidebar
  const [showRefSidebar, setShowRefSidebar] = useState(false);
  const [showFavsSidebar, setShowFavsSidebar] = useState(false);
  const [showPortraitSidebar, setShowPortraitSidebar] = useState(false);

  // FEATURE-02: Apply Damage pipeline
  const [damageInput, setDamageInput] = useState("");

  const [favPopout, setFavPopout] = useState<{
    type: "item" | "feat" | "spell";
    id: string;
  } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "remove" } | null>(null);
  const toastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [spellArmorConfirmPending, setSpellArmorConfirmPending] = useState(false);
  // Journal/biography state → components/tabs/NotesTab.tsx (R2)
  // Feats-source filter state → components/tabs/FeatsTab.tsx (R3)

  function showToast(message: string, type: "success" | "remove" = "success") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }

  useEffect(() => {
    const loaded = getCharacter(id);
    if (loaded) {
      // Backfill armamentTags on weapons missing them — catalog lookup by name (with fuzzy fallback)
      const catalogByName = new Map(
        catalog.map((ci) => [ci.name.toLowerCase(), ci]),
      );
      function findCatalogItem(name: string) {
        const lower = name
          .toLowerCase()
          .replace(/\s*\(.*\)/, "")
          .trim();
        if (catalogByName.has(lower)) return catalogByName.get(lower)!;
        // "Light armor" → "Light", "Medium armor" → "Medium", etc.
        const noArmor = lower.replace(/\s*armor\b/, "").trim();
        if (noArmor && catalogByName.has(noArmor))
          return catalogByName.get(noArmor)!;
        // Handle "X or Y (note)" — try each alternative
        const parts = lower.split(/\s+or\s+/);
        for (const part of parts) {
          const trimmed = part.trim();
          if (catalogByName.has(trimmed)) return catalogByName.get(trimmed)!;
          // Try prefix match (e.g. "two throwing axes" → "throwing axe")
          for (const [key, val] of catalogByName) {
            if (
              trimmed.includes(key) ||
              key.includes(
                trimmed.replace(/^(two|a|an)\s+/, "").replace(/s$/, ""),
              )
            )
              return val;
          }
        }
        return null;
      }
      const updatedInventory = loaded.inventory.map((item) => {
        const needsWeaponBackfill =
          item.category === "Weapon" && (item.armamentTags ?? []).length === 0;
        const needsArmorBackfill =
          (item.category === "Armor" || item.category === "Shield") &&
          item.armorBonus === 0;
        if (!needsWeaponBackfill && !needsArmorBackfill) return item;
        const ci = findCatalogItem(item.name);
        if (!ci) return item;
        const patch: Partial<typeof item> = {};
        if (needsWeaponBackfill) {
          patch.armamentTags = ci.armamentTags;
          patch.damageTypeTags =
            (item.damageTypeTags ?? []).length > 0
              ? item.damageTypeTags
              : ci.damageTypeTags;
          patch.equipSlots =
            (item.equipSlots ?? []).length > 0
              ? item.equipSlots
              : ci.equipSlots;
          patch.isRanged = ci.isRanged;
          patch.damageDiceCount =
            item.damageDiceCount > 0
              ? item.damageDiceCount
              : ci.damageDiceCount;
          patch.damageDiceSize =
            item.damageDiceSize > 0 ? item.damageDiceSize : ci.damageDiceSize;
        }
        if (needsArmorBackfill && ci.armorBonus) {
          patch.armorBonus = ci.armorBonus;
          patch.armorCategory = (ci.armorCategory ?? null) as
            | "Light"
            | "Medium"
            | "Heavy"
            | null;
        }
        return { ...item, ...patch };
      });
      const inventoryChanged = updatedInventory.some(
        (item, i) => item !== loaded.inventory[i],
      );
      const finalChar = inventoryChanged
        ? { ...loaded, inventory: updatedInventory }
        : loaded;
      if (inventoryChanged)
        updateCharacter(loaded.id, { inventory: updatedInventory });
      setChar(finalChar);
      // Auto-calculate max vitality if not yet set
      let resolvedMaxVit = loaded.maxVitality;
      if (resolvedMaxVit === null) {
        const loadedProf =
          professions.find((p) => p.id === loaded.professionId) ?? null;
        const loadedAllFeats = [...professionFeats, ...originFeats];
        const loadedAttrs = getTotalAttributes(loaded);
        if (loadedProf) {
          const featBonus = calcFeatVitalityBonus(
            loaded.selectedFeatIds ?? [],
            loadedAllFeats,
            loaded.tier,
          );
          resolvedMaxVit =
            calcStartingVitality(loadedProf, loadedAttrs) + featBonus;
          updateCharacter(loaded.id, { maxVitality: resolvedMaxVit });
        }
      }
    }
    setMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Must be before early returns to satisfy rules of hooks
  const armamentProficiencyTags = useMemo(() => {
    if (!char) return [];
    if ((char.armamentProficiencyTags ?? []).length > 0)
      return char.armamentProficiencyTags;
    const charProf =
      professions.find((p) => p.id === char.professionId) ?? null;
    const tags: string[] = [];
    for (const a of charProf?.armaments ?? []) {
      const lower = a.toLowerCase();
      if (lower.includes("finesse")) tags.push("finesse");
      if (lower.includes("martial")) tags.push("martial");
      if (lower.includes("simple")) tags.push("simple");
      if (lower.includes("defensive")) tags.push("defensive");
      if (lower.includes("catalyst")) tags.push("catalyst");
      if (lower.includes("ranged")) tags.push("ranged");
    }
    return [...new Set(tags)];
  }, [char, professions]);

  if (!mounted) return null;
  if (!char) {
    return (
      <div style={{ padding: "3rem", textAlign: "center" }}>
        <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>
          Character not found.
        </p>
        <Link
          href="/characters"
          style={{
            color: "var(--primary)",
            textDecoration: "none",
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
          }}
        >
          ← Back to Characters
        </Link>
      </div>
    );
  }

  const c = char!;
  const prof = professions.find((p) => p.id === c.professionId) ?? null;
  const origin = origins.find((o) => o.id === c.originId) ?? null;
  const vocation = origin?.vocations.find((v) => v.id === c.vocationId) ?? null;
  // Always use live origins.json vocation bonus to avoid stale stored values
  const effectiveChar = vocation
    ? { ...c, vocationAttributeBonus: vocation.attributeBonus }
    : c;
  const attrs = getTotalAttributes(effectiveChar);

  // Tier: derived from feats purchased from Renown; creation tier is the floor
  const effectiveTier = Math.max(
    c.tier,
    calcTierFromFeatsPurchased(c.featsPurchased ?? 0),
  );

  // Caster: from profession OR any selected feat
  const allFeats = [...professionFeats, ...originFeats];
  const featCaster =
    allFeats.find((f) => c.selectedFeatIds.includes(f.id) && f.casterInfo)
      ?.casterInfo ?? null;
  const casterInfo = prof?.casterType
    ? {
        casterType: prof.casterType,
        casterSource: prof.casterSource ?? "",
        casterModifierOptions: prof.casterModifierOptions,
      }
    : (c.vocationCaster ?? featCaster);
  const isCaster = !!casterInfo;
  // BUG-10: Multi-option casters (Mesmer/Warden/Oathbound/Drifter) auto-resolve to max(Mind, Will)
  const modKey: AttributeKey = (() => {
    if (!casterInfo?.casterModifierOptions?.length)
      return c.spellcastingModifier ?? "mind";
    if (casterInfo.casterModifierOptions.length === 1)
      return casterInfo.casterModifierOptions[0];
    return casterInfo.casterModifierOptions.reduce((best, key) =>
      attrs[key] >= attrs[best] ? key : best,
    );
  })();
  const modVal = attrs[modKey];

  // Spellcasting-specific derived values
  const spellThreshold = calcSpellcastingThreshold(c.featsPurchased ?? 0);
  const spellTier = isCaster
    ? calcSpellcastingTier(casterInfo!.casterType, spellThreshold)
    : 0;
  const knownSpellsMax = isCaster
    ? calcKnownSpells(casterInfo!.casterType, spellThreshold)
    : 0;
  const preparedSpellsMax = isCaster
    ? calcPreparedSpells(modVal, effectiveTier)
    : 0;

  const maxReservoir = isCaster
    ? (calcReservoir(casterInfo!.casterType, effectiveTier, modVal) ?? 0)
    : 0;
  const bodyDef = calcFortitude(attrs);
  const mindDef = calcMentalDefense(attrs);
  const willDef = calcWillDefense(attrs);
  const equippedArmorWoundBonus =
    (c.inventory ?? []).find(
      (i) => i.equipped && i.slot === "Body" && i.category === "Armor",
    )?.woundBonus ?? 0;
  const maxWounds = calcMaxWounds(
    prof ?? { woundBonusPerTier: 1 },
    attrs,
    effectiveTier,
    equippedArmorWoundBonus,
  );
  const carryWeight = calcCarryWeight(attrs, effectiveTier);
  const spellDC = isCaster ? calcSpellDC(spellTier, modVal) : null;

  // Magic sources the character can draw from (e.g. "Anima", "Mana")
  const accessibleSources: string[] = isCaster
    ? Array.from(
        new Set(
          [
            casterInfo?.casterSource,
            ...allFeats
              .filter(
                (f) =>
                  c.selectedFeatIds.includes(f.id) &&
                  f.casterInfo?.casterSource,
              )
              .map((f) => f.casterInfo!.casterSource!),
          ].filter(Boolean) as string[],
        ),
      )
    : [];

  // School spheres unlocked via choice features (e.g. "Aberration", "Conjuration")
  const knownSchoolSpheres: string[] = isCaster
    ? Array.from(computeKnownSpheres(c.choiceSelections ?? {}, choiceFeatures))
    : [];

  const ambition = calcAmbition(attrs.will, effectiveTier);
  const maxAmbition = ambition.max;
  const ambitionDice = ambition.dice;

  // BUG-11: Derive max vitality reactively from profession formula + tier + attrs + feats
  const derivedMaxVitality = prof
    ? calcFullMaxVitality(
        prof,
        attrs,
        effectiveTier,
        c.selectedFeatIds ?? [],
        allFeats,
      )
    : (c.maxVitality ?? 0);

  const selectedFeats = [
    ...professionFeats.filter((f) => c.selectedFeatIds.includes(f.id)),
    ...originFeats.filter((f) => c.selectedFeatIds.includes(f.id)),
  ];
  const mySpells = spells
    .filter((s) => c.knownSpellIds.includes(s.id))
    .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
  const inventory: InventoryItem[] = c.inventory ?? [];
  const totalCarried = inventory.reduce((s, i) => s + i.weight * i.quantity, 0);

  const currentReservoir = c.currentReservoir ?? maxReservoir;
  const currentRespites = c.currentRespites ?? 3;

  // Agile detection: check profession base features, vocation features, and selected feats
  const hasAgile = !!(
    prof?.baseFeatures.some((f) => f.name === "Agile") ||
    vocation?.features.some((f) => f.name === "Agile") ||
    selectedFeats.some((f) => f.name === "Agile")
  );
  // Unarmored Defense: Berserker only
  const hasUnarmoredDefense = !!(
    prof?.baseFeatures.some((f) => f.name === "Unarmored Defense") ||
    c.professionName === "Berserker"
  );

  function persist(updates: Partial<Character>) {
    const updated = updateCharacter(id, updates);
    if (updated) setChar(updated);
  }

  function toggleFavorite(type: "item" | "feat" | "spell", id: string) {
    const favs = c.favorites ?? [];
    const exists = favs.some((f) => f.type === type && f.id === id);
    persist({
      favorites: exists
        ? favs.filter((f) => !(f.type === type && f.id === id))
        : [...favs, { type, id }],
    });
  }
  function isFavorite(type: "item" | "feat" | "spell", id: string) {
    return (c.favorites ?? []).some((f) => f.type === type && f.id === id);
  }

  function handleDelete() {
    if (!confirm(`Delete "${c.name}"? This cannot be undone.`)) return;
    deleteCharacter(id);
    router.push("/characters");
  }

  // ─── Rest actions ────────────────────────────────────────────────────────
  function restoreCustomResource(
    type: "respite" | "long_rest" | "full_rest",
  ): Record<string, number> | undefined {
    if (!prof?.customResource) return undefined;
    const def = prof.customResource;
    const max = evalResourceMax(def, attrs, effectiveTier);
    const next = applyResourceRestore(c.customResources ?? {}, def, type, max);
    return { ...c.customResources, [def.key]: next };
  }

  function takeRespite() {
    if (currentRespites <= 0) return;
    const vitRestore = Math.max(4, 4 + attrs.brawn * 2);
    const ambRestore = Math.max(4, attrs.will);
    const cr = restoreCustomResource("respite");
    persist({
      currentRespites: currentRespites - 1,
      currentVitality: Math.min(
        derivedMaxVitality,
        (c.currentVitality ?? 0) + vitRestore,
      ),
      currentAmbition: Math.min(
        maxAmbition,
        (c.currentAmbition ?? 0) + ambRestore,
      ),
      ...(cr ? { customResources: cr } : {}),
    });
  }

  function takeLongRest() {
    const vitRestore = Math.max(10, attrs.brawn * 3);
    const ambRestore = Math.max(10, attrs.will * 2);
    const resRestore = isCaster ? Math.max(9, modVal * 2) : 0;
    const cr = restoreCustomResource("long_rest");
    persist({
      currentRespites: Math.min(3, currentRespites + 1),
      currentVitality: Math.min(
        derivedMaxVitality,
        (c.currentVitality ?? 0) + vitRestore,
      ),
      currentAmbition: Math.min(
        maxAmbition,
        (c.currentAmbition ?? 0) + ambRestore,
      ),
      currentReservoir: Math.min(maxReservoir, currentReservoir + resRestore),
      ...(cr ? { customResources: cr } : {}),
    });
  }

  function takeFullRest() {
    const resRestore = isCaster ? Math.max(18, modVal * 3) : 0;
    const cr = restoreCustomResource("full_rest");
    persist({
      currentRespites: 3,
      currentVitality: derivedMaxVitality,
      currentAmbition: maxAmbition,
      currentReservoir: Math.min(maxReservoir, currentReservoir + resRestore),
      currentWounds: Math.max(0, (c.currentWounds ?? 0) - 1),
      ...(cr ? { customResources: cr } : {}),
    });
  }

  // ─── Inventory handlers ──────────────────────────────────────────────────
  // selectCatalogItem → components/tabs/InventoryTab.tsx (R6)

  // addItem → components/tabs/InventoryTab.tsx (R6)

  function removeItem(itemId: string) {
    const removed = inventory.find((i) => i.id === itemId);
    persist({ inventory: inventory.filter((i) => i.id !== itemId) });
    if (removed) showToast(`${removed.name} removed`, "remove");
  }

  function updateItem(itemId: string, updates: Partial<InventoryItem>) {
    persist({
      inventory: inventory.map((i) => {
        if (i.id !== itemId) return i;
        const merged = { ...i, ...updates };
        // Recalc shield pool when shieldType or masterworkBonus changes
        if (
          merged.category === "Shield" &&
          ("shieldType" in updates || "masterworkBonus" in updates)
        ) {
          const base = SHIELD_BASE_POOL[merged.shieldType ?? ""] ?? 10;
          const newMax = base + (merged.masterworkBonus ?? 0) * 5;
          merged.reductionPoolMax = newMax;
          // Reset current to new max only if pool was full (not mid-combat depleted)
          if ((i.reductionPoolCurrent ?? 0) >= (i.reductionPoolMax ?? 0)) {
            merged.reductionPoolCurrent = newMax;
          }
        }
        return merged;
      }),
    });
  }

  // FEATURE-02: default shield reduction pool by shield name
  const SHIELD_BASE_POOL: Record<string, number> = {
    Temporary: 10,
    Light: 10,
    Medium: 15,
    Heavy: 20,
  };

  function calcShieldPool(
    shieldType: string | null | undefined,
    masterworkBonus: number = 0,
  ): number {
    const base = SHIELD_BASE_POOL[shieldType ?? ""] ?? 10;
    return base + masterworkBonus * 5;
  }

  function equipItem(itemId: string, slot: InventorySlot) {
    const item = inventory.find((i) => i.id === itemId);
    if (!item) return;
    const isTwoHanded =
      item.traits.includes("Two-Handed") || slot === "Two Hands";
    const updated = inventory.map((i) => {
      if (i.id === itemId) {
        const base: InventoryItem = { ...i, equipped: true, slot };
        if (i.category === "Shield" && i.reductionPoolMax == null) {
          const pool = calcShieldPool(i.shieldType, i.masterworkBonus ?? 0);
          base.reductionPoolMax = pool;
          base.reductionPoolCurrent = pool;
        }
        return base;
      }
      if (
        isTwoHanded &&
        (i.slot === "Main Hand" ||
          i.slot === "Off Hand" ||
          i.slot === "Two Hands") &&
        i.equipped
      )
        return { ...i, equipped: false };
      if (!isTwoHanded && i.slot === slot && i.equipped && i.id !== itemId)
        return { ...i, equipped: false };
      return i;
    });
    persist({ inventory: updated });
  }

  // ─── Touch drag-to-equip ─────────────────────────────────────────────────────
  function startTouchDrag(itemId: string, itemName: string, x: number, y: number) {
    touchDragItemId.current = itemId;
    touchDragItemName.current = itemName;
    dragItemId.current = itemId;
    const ghost = document.createElement("div");
    ghost.textContent = itemName;
    Object.assign(ghost.style, {
      position: "fixed", left: `${x - 40}px`, top: `${y - 18}px`,
      padding: "0.3rem 0.7rem", borderRadius: "0.4rem",
      backgroundColor: "var(--primary)", color: "#fff",
      fontSize: "0.75rem", fontWeight: "700", pointerEvents: "none",
      zIndex: "9999", opacity: "0.92", whiteSpace: "nowrap",
    });
    document.body.appendChild(ghost);
    touchGhostRef.current = ghost;
  }
  function moveTouchGhost(x: number, y: number) {
    if (!touchGhostRef.current) return;
    touchGhostRef.current.style.left = `${x - 40}px`;
    touchGhostRef.current.style.top = `${y - 18}px`;
    const el = document.elementFromPoint(x, y);
    const slotEl = el?.closest("[data-equip-slot]");
    const slot = (slotEl?.getAttribute("data-equip-slot") ?? null) as InventorySlot;
    setDragOverSlot(slot);
  }
  function endTouchDrag(x: number, y: number) {
    if (touchLongPressTimer.current) { clearTimeout(touchLongPressTimer.current); touchLongPressTimer.current = null; }
    if (touchGhostRef.current) { touchGhostRef.current.remove(); touchGhostRef.current = null; }
    const el = document.elementFromPoint(x, y);
    const slotEl = el?.closest("[data-equip-slot]");
    const slot = (slotEl?.getAttribute("data-equip-slot") ?? null) as InventorySlot;
    const id = touchDragItemId.current;
    if (id && slot) equipItem(id, slot);
    touchDragItemId.current = null;
    dragItemId.current = null;
    setDragOverSlot(null);
  }

  // FEATURE-02: priority-order damage pipeline — Spell > Feat > Shield > Vitality
  function applyDamage(incoming: number) {
    if (incoming <= 0) return;
    let remaining = incoming;
    const patch: Partial<Character> = {};
    let updatedInventory = [...inventory];

    // Step 1 — Spell pool
    const spellPool = c.spellReductionPool ?? 0;
    if (spellPool > 0 && remaining > 0) {
      const absorbed = Math.min(remaining, spellPool);
      patch.spellReductionPool = spellPool - absorbed;
      remaining -= absorbed;
    }

    // Step 2 — Feat pool
    const featPool = c.featReductionPool ?? 0;
    if (featPool > 0 && remaining > 0) {
      const absorbed = Math.min(remaining, featPool);
      patch.featReductionPool = featPool - absorbed;
      remaining -= absorbed;
    }

    // Step 3 — Shield pool
    if (equippedShield && remaining > 0) {
      const shieldPool = equippedShield.reductionPoolCurrent ?? 0;
      if (shieldPool > 0) {
        const absorbed = Math.min(remaining, shieldPool);
        const newPool = shieldPool - absorbed;
        updatedInventory = updatedInventory.map((i) =>
          i.id === equippedShield.id
            ? { ...i, reductionPoolCurrent: newPool }
            : i,
        );
        remaining -= absorbed;
      }
    }

    // Step 4 — Remaining hits Vitality
    if (remaining > 0) {
      patch.currentVitality = Math.max(0, (c.currentVitality ?? 0) - remaining);
    }

    patch.inventory = updatedInventory;
    persist(patch);
  }


  const inputStyle: React.CSSProperties = {
    padding: "0.3rem 0.5rem",
    fontSize: "0.825rem",
    fontFamily: "var(--font-body)",
    border: "1px solid var(--border)",
    borderRadius: "0.25rem",
    backgroundColor: "var(--bg-card)",
    color: "var(--text)",
    outline: "none",
  };

  // ─── Equipped slots ──────────────────────────────────────────────────────
  const equippedMain =
    inventory.find((i) => i.equipped && i.slot === "Main Hand") ?? null;
  const equippedOff =
    inventory.find((i) => i.equipped && i.slot === "Off Hand") ?? null;
  const equippedTwoHands =
    inventory.find((i) => i.equipped && i.slot === "Two Hands") ?? null;
  const equippedBody =
    inventory.find((i) => i.equipped && i.slot === "Body") ?? null;
  const equippedShield =
    inventory.find(
      (i) => i.equipped && i.slot === "Off Hand" && i.category === "Shield",
    ) ?? null;
  const equippedHead = inventory.find((i) => i.equipped && i.slot === "Head") ?? null;
  const equippedNeck = inventory.find((i) => i.equipped && i.slot === "Neck") ?? null;
  const equippedCloak = inventory.find((i) => i.equipped && i.slot === "Cloak") ?? null;
  const equippedGloves = inventory.find((i) => i.equipped && i.slot === "Gloves") ?? null;
  const equippedBoots = inventory.find((i) => i.equipped && i.slot === "Boots") ?? null;
  const equippedRing = inventory.find((i) => i.equipped && i.slot === "Ring") ?? null;
  const armorDefense = calcArmorDefense(
    equippedBody,
    equippedShield,
    attrs,
    hasAgile,
    hasUnarmoredDefense,
    effectiveTier,
    !!(c.spellArmorActive && isCaster),
    modVal,
  );

  // AMEND-05: Armor proficiency check
  const isArmorProficient: boolean = (() => {
    if (
      !equippedBody ||
      equippedBody.category !== "Armor" ||
      !equippedBody.armorCategory
    )
      return true;
    const protection = prof?.protection ?? [];
    const cat = equippedBody.armorCategory.toLowerCase();
    return protection.some((p) => p.toLowerCase().includes(cat));
  })();

  const DAMAGE_TYPE_LABEL: Record<string, string> = {
    puncture: "Puncture",
    slash: "Slash",
    blunt: "Blunt",
  };

  // Weapon combat stats — all derived from structured tag fields only
  function weaponStats(
    item: InventoryItem | null,
  ): { toHit: string; damage: string; modStat: AttributeKey } | null {
    if (!item || item.category !== "Weapon" || item.damageDiceCount === 0)
      return null;
    // Infer default modifier: catalyst → spellcasting mod, everything else → body
    const modStat: AttributeKey =
      item.modifierStat ??
      (item.armamentTags?.includes("catalyst")
        ? (c.spellcastingModifier ?? "mind")
        : "brawn");
    const modAttr = attrs[modStat];
    const mw = item.masterworkBonus ?? 0;
    const proficient =
      item.armamentTags.length > 0
        ? item.armamentTags.some((tag) => armamentProficiencyTags.includes(tag))
        : false;
    const tierBonus = proficient ? effectiveTier : 0;
    const toHitVal = modAttr + tierBonus + mw;
    const diceStr = `${item.damageDiceCount}d${item.damageDiceSize}`;
    const damageMod = item.isRanged ? mw : modAttr + mw;
    const damageStr =
      damageMod !== 0
        ? `${diceStr}${damageMod >= 0 ? "+" : ""}${damageMod}`
        : diceStr;
    const typeLabels = (item.damageTypeTags ?? [])
      .map((t) => DAMAGE_TYPE_LABEL[t] ?? t)
      .join("/");
    return {
      toHit: toHitVal >= 0 ? `+${toHitVal}` : String(toHitVal),
      damage: damageStr + (typeLabels ? ` ${typeLabels}` : ""),
      modStat,
    };
  }


  // ─── Tab content renderers ───────────────────────────────────────────────


  const tabs: { id: TabId; label: string; hidden?: boolean }[] = [
    { id: "combat", label: "Combat" },
    { id: "feats", label: "Feats" },
    { id: "inventory", label: "Inventory" },
    {
      id: "spellcasting",
      label: "Spellcasting",
      hidden: !isCaster && mySpells.length === 0,
    },
    { id: "notes", label: "Notes" },
  ];

  // FEATURE-01: Ref sidebar content
  const REF_SECTIONS = [
    {
      name: "Offensive",
      color: "var(--section-offensive)",
      subs: [
        {
          name: "Weapon",
          actions: [
            {
              n: "Quick Scrape",
              ap: "1 AP",
              d: "Hit: half weapon dmg. Bash w/ shield. Crit: full dmg, no mods.",
            },
            {
              n: "Strike",
              ap: "2 AP",
              d: "Hit: weapon dice + mods. Crit: +half max dmg. DW: two rolls, mod once.",
            },
            {
              n: "Power Strike",
              ap: "3 AP",
              d: "−5 to roll. Hit: double dice + mods. DW: one roll both weapons.",
            },
          ],
        },
        {
          name: "Magic",
          actions: [
            {
              n: "Cast a Spell",
              ap: "2 AP",
              d: "Prepared spell or cantrip. Crit/crit-fail: trigger crit effects; min half dmg.",
            },
            {
              n: "Charged Cantrip",
              ap: "3 AP",
              d: "Damaging cantrip. Hit: double dice + mods. Crit: +half max dmg.",
            },
          ],
        },
      ],
    },
    {
      name: "Maneuver",
      color: "var(--section-maneuver)",
      subs: [
        {
          name: "Movement",
          actions: [
            { n: "Dash", ap: "2 AP", d: "Move to adjacent zone." },
            {
              n: "Disengage",
              ap: "1 AP",
              d: "Break Engagement, regain movement.",
            },
            {
              n: "Flank",
              ap: "1 AP",
              d: "Give ally Resolve on next attack in Engagement.",
            },
            {
              n: "Go Prone / Stand",
              ap: "1 AP",
              d: "Toggle Prone / Standing.",
            },
          ],
        },
        {
          name: "Control",
          actions: [
            {
              n: "Shove",
              ap: "1 AP",
              d: "Push target out or into hazard. Body vs Body Def.",
            },
            { n: "Trip", ap: "2 AP", d: "Inflict Prone. Body vs Body Def." },
            {
              n: "Grapple",
              ap: "2 AP",
              d: "Inflict Restrained. Body vs Body Def.",
            },
          ],
        },
      ],
    },
    {
      name: "Utility",
      color: "var(--section-utility)",
      subs: [
        {
          name: "Preservation",
          actions: [
            {
              n: "Dodge",
              ap: "2 AP",
              d: "Gain Strain on incoming attacks until next turn.",
            },
            {
              n: "Hide",
              ap: "2 AP",
              d: "Stealth check. Combat: Obscured. Out of combat: Hidden.",
            },
            {
              n: "Cover",
              ap: "1 AP",
              d: "+2 Armor vs ranged or attacks from outside zone.",
            },
            {
              n: "Distract",
              ap: "1 AP",
              d: "Next attack vs chosen ally has Strain.",
            },
          ],
        },
        {
          name: "Interact",
          actions: [
            {
              n: "Assist / Aid",
              ap: "1 AP",
              d: "Remove Burning/Bleeding or grant skill bonus dice.",
            },
            {
              n: "Interact",
              ap: "0→1 AP",
              d: "Free first use; 1 AP each subsequent use per turn.",
            },
            {
              n: "Scan / Perception",
              ap: "1 AP",
              d: "Mind check to reveal Hidden / Obscured.",
            },
            {
              n: "Hold Action",
              ap: "Action-based",
              d: "Declare action + trigger. Act when trigger occurs.",
            },
            {
              n: "Alchemical Item",
              ap: "2 AP",
              d: "Use on self or target in range.",
            },
            {
              n: "Command",
              ap: "1→3 AP",
              d: "Command summoned creature/pet. Cost rises each use.",
            },
            {
              n: "Brace",
              ap: "1 AP",
              d: "+2 attack (weapon) or +2 Defense (shield/armor).",
            },
          ],
        },
      ],
    },
  ];

  return (
    <div className="poa-sheet-root" style={{ width: "100%" }}>
      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          density={density}
          setDensity={setDensity}
        />
      )}
      {/* Fixed sidebar button group */}
      <div
        style={{
          position: "fixed",
          right: "1rem",
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 70,
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        {/* Display settings (gear) — always visible */}
        <button
          onClick={() => setShowSettings((v) => !v)}
          aria-label="Display settings"
          aria-expanded={showSettings}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "40px",
            height: "40px",
            backgroundColor: showSettings ? "var(--primary)" : "var(--bg-card)",
            border: `1.5px solid ${showSettings ? "var(--primary)" : "var(--border)"}`,
            borderRadius: "0.5rem",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            color: showSettings ? "var(--bg)" : "var(--text-muted)",
            fontSize: "1.05rem",
            lineHeight: 1,
          }}
        >
          ⚙
        </button>
        {/* Portrait button — mobile only (hidden via CSS at >860px) */}
        <button
          className="poa-mobile-sidebar-btn"
          onClick={() => {
            setShowPortraitSidebar((v) => !v);
            setShowFavsSidebar(false);
            setShowRefSidebar(false);
          }}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.2rem",
            padding: "0.5rem 0.4rem",
            backgroundColor: showPortraitSidebar
              ? "var(--primary)"
              : "var(--bg-card)",
            border: `1.5px solid ${showPortraitSidebar ? "var(--primary)" : "var(--border)"}`,
            borderRadius: "0.5rem",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            writingMode: "vertical-rl",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 800,
              fontSize: "0.72rem",
              color: showPortraitSidebar ? "var(--bg)" : "var(--primary)",
              letterSpacing: "0.06em",
            }}
          >
            ◉ Portrait
          </span>
        </button>
        {/* Favorites button — mobile only */}
        <button
          className="poa-mobile-sidebar-btn"
          onClick={() => {
            setShowFavsSidebar((v) => !v);
            setShowPortraitSidebar(false);
            setShowRefSidebar(false);
          }}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.2rem",
            padding: "0.5rem 0.4rem",
            backgroundColor: showFavsSidebar
              ? "var(--primary)"
              : "var(--bg-card)",
            border: `1.5px solid ${showFavsSidebar ? "var(--primary)" : "var(--border)"}`,
            borderRadius: "0.5rem",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            writingMode: "vertical-rl",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 800,
              fontSize: "0.72rem",
              color: showFavsSidebar ? "var(--bg)" : "var(--primary)",
              letterSpacing: "0.06em",
            }}
          >
            ★ Favs
          </span>
        </button>
        {/* Actions button — always visible */}
        <button
          onClick={() => {
            setShowRefSidebar((v) => !v);
            setShowFavsSidebar(false);
            setShowPortraitSidebar(false);
          }}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.2rem",
            padding: "0.5rem 0.4rem",
            backgroundColor: showRefSidebar
              ? "var(--primary)"
              : "var(--bg-card)",
            border: `1.5px solid ${showRefSidebar ? "var(--primary)" : "var(--border)"}`,
            borderRadius: "0.5rem",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            writingMode: "vertical-rl",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 800,
              fontSize: "0.72rem",
              color: showRefSidebar ? "var(--bg)" : "var(--primary)",
              letterSpacing: "0.06em",
            }}
          >
            ❖ Actions
          </span>
        </button>
      </div>
      {/* FEATURE-01: Ref sidebar overlay */}
      {showRefSidebar && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRefSidebar(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 65,
            backgroundColor: "rgba(0,0,0,0.3)",
          }}
        >
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: "360px",
              maxWidth: "95vw",
              backgroundColor: "var(--bg-card)",
              borderLeft: "1px solid var(--border)",
              overflowY: "auto",
              padding: "1rem 1rem 2rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.75rem",
                paddingBottom: "0.5rem",
                borderBottom: "2px solid var(--primary)",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 800,
                  fontSize: "0.95rem",
                  color: "var(--text)",
                }}
              >
                ❖ Actions
              </span>
              <button
                onClick={() => setShowRefSidebar(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1rem",
                  color: "var(--text-muted)",
                  padding: "0.1rem 0.3rem",
                }}
              >
                ✕
              </button>
            </div>
            {REF_SECTIONS.map((sec) => (
              <div key={sec.name} style={{ marginBottom: "1rem" }}>
                <div
                  style={{
                    padding: "0.3rem 0.625rem",
                    backgroundColor: sec.color,
                    borderRadius: "0.375rem",
                    fontFamily: "var(--font-heading)",
                    fontWeight: 700,
                    fontSize: "0.78rem",
                    color: "var(--text)",
                    marginBottom: "0.375rem",
                  }}
                >
                  {sec.name}
                </div>
                {sec.subs.map((sub) => (
                  <div
                    key={sub.name}
                    style={{ marginBottom: "0.5rem", paddingLeft: "0.375rem" }}
                  >
                    <div
                      style={{
                        fontSize: "0.58rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-heading)",
                        marginBottom: "0.2rem",
                      }}
                    >
                      {sub.name}
                    </div>
                    {sub.actions.map((a) => (
                      <div
                        key={a.n}
                        style={{
                          display: "flex",
                          gap: "0.375rem",
                          alignItems: "flex-start",
                          marginBottom: "0.2rem",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "var(--font-heading)",
                            fontWeight: 700,
                            fontSize: "0.7rem",
                            color: "var(--primary)",
                            flexShrink: 0,
                            paddingTop: "0.05rem",
                          }}
                        >
                          ❖
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span
                            style={{
                              fontFamily: "var(--font-heading)",
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              color: "var(--text)",
                            }}
                          >
                            {a.n}
                          </span>
                          <span
                            style={{
                              fontSize: "0.62rem",
                              color: "var(--accent)",
                              fontFamily: "var(--font-heading)",
                              fontWeight: 700,
                              marginLeft: "0.3rem",
                              padding: "0.05rem 0.3rem",
                              backgroundColor: "var(--accent-light)",
                              borderRadius: "9999px",
                            }}
                          >
                            {a.ap}
                          </span>
                          <div
                            style={{
                              fontSize: "0.7rem",
                              color: "var(--text-muted)",
                              lineHeight: 1.45,
                              marginTop: "0.05rem",
                            }}
                          >
                            {a.d}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
            {/* Complexity scale */}
            <div
              style={{
                marginTop: "0.5rem",
                paddingTop: "0.625rem",
                borderTop: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 700,
                  fontSize: "0.78rem",
                  color: "var(--text)",
                  marginBottom: "0.375rem",
                }}
              >
                When in Doubt
              </div>
              {[
                { l: "Simple / Easy", ap: "1 AP" },
                { l: "Advanced / Medium", ap: "2 AP" },
                { l: "Complex / Hard", ap: "3 AP" },
                { l: "Elaborate / Arduous", ap: "4 AP" },
              ].map((r) => (
                <div
                  key={r.l}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.2rem 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.72rem",
                      color: "var(--text)",
                      fontFamily: "var(--font-heading)",
                    }}
                  >
                    {r.l}
                  </span>
                  <span
                    style={{
                      fontSize: "0.65rem",
                      color: "var(--accent)",
                      fontFamily: "var(--font-heading)",
                      fontWeight: 700,
                      padding: "0.05rem 0.35rem",
                      backgroundColor: "var(--accent-light)",
                      borderRadius: "9999px",
                    }}
                  >
                    {r.ap}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Portrait mobile sidebar */}
      {showPortraitSidebar && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPortraitSidebar(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 65,
            backgroundColor: "rgba(0,0,0,0.3)",
          }}
        >
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: "300px",
              maxWidth: "95vw",
              backgroundColor: "var(--bg-card)",
              borderLeft: "1px solid var(--border)",
              overflowY: "auto",
              padding: "1rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.75rem",
                paddingBottom: "0.5rem",
                borderBottom: "2px solid var(--primary)",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 800,
                  fontSize: "0.95rem",
                  color: "var(--text)",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                </svg>
                Portrait
              </span>
              <button
                onClick={() => setShowPortraitSidebar(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1rem",
                  color: "var(--text-muted)",
                  padding: "0.1rem 0.3rem",
                }}
              >
                ✕
              </button>
            </div>
            <div
              onClick={() => portraitInputRef.current?.click()}
              title={
                portraitUrl
                  ? "Click to change portrait"
                  : "Click to upload portrait"
              }
              style={{
                position: "relative",
                overflow: "hidden",
                aspectRatio: "3/4",
                backgroundColor: "var(--bg-nav)",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              {portraitUrl ? (
                <img
                  src={portraitUrl}
                  alt={c.name}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "repeating-linear-gradient(135deg, transparent 0 12px, var(--border) 12px 13px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "10px",
                      letterSpacing: "0.3em",
                      color: "var(--text-muted)",
                      textTransform: "uppercase" as const,
                      opacity: 0.6,
                    }}
                  >
                    PORTRAIT
                  </div>
                </div>
              )}
            </div>
            <div style={{ marginTop: "12px" }}>
              <div
                style={{
                  fontFamily: "var(--font-heading)",
                  fontStyle: "italic",
                  fontWeight: 700,
                  fontSize: "1.1rem",
                  color: "var(--text)",
                }}
              >
                {c.name}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  marginTop: "3px",
                }}
              >
                {c.vocationName || c.professionName} · Tier {effectiveTier}
              </div>
              {c.ambition && (
                <div
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontStyle: "italic",
                    fontSize: "12px",
                    color: "var(--text-muted)",
                    marginTop: "6px",
                  }}
                >
                  {c.ambition}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Favorites mobile sidebar */}
      {showFavsSidebar && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowFavsSidebar(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 65,
            backgroundColor: "rgba(0,0,0,0.3)",
          }}
        >
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: "300px",
              maxWidth: "95vw",
              backgroundColor: "var(--bg-card)",
              borderLeft: "1px solid var(--border)",
              overflowY: "auto",
              padding: "1rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.75rem",
                paddingBottom: "0.5rem",
                borderBottom: "2px solid var(--primary)",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 800,
                  fontSize: "0.95rem",
                  color: "var(--text)",
                }}
              >
                ★ Favorites
              </span>
              <button
                onClick={() => setShowFavsSidebar(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1rem",
                  color: "var(--text-muted)",
                  padding: "0.1rem 0.3rem",
                }}
              >
                ✕
              </button>
            </div>
            {(() => {
              const favs = c.favorites ?? [];
              const allFeatEntries = [
                ...allFeats,
                ...(prof?.baseFeatures ?? []),
                ...(vocation?.features ?? []),
              ];
              const favItems = favs
                .filter((f) => f.type === "item")
                .map((f) => inventory.find((i) => i.id === f.id))
                .filter(Boolean)
                .sort((a, b) =>
                  a!.name.localeCompare(b!.name),
                ) as typeof inventory;
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
                .sort((a, b) =>
                  a!.name.localeCompare(b!.name),
                ) as typeof spells;
              const isEmpty =
                favItems.length === 0 &&
                favFeats.length === 0 &&
                favSpells.length === 0;
              const rowStyle: React.CSSProperties = {
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 0",
                borderBottom: "1px solid var(--border)",
              };
              const entryBtnStyle: React.CSSProperties = {
                flex: 1,
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "var(--font-heading)",
                fontSize: "0.85rem",
                color: "var(--text)",
                padding: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap" as const,
              };
              const pipBtnStyle: React.CSSProperties = {
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "0.8rem",
                color: "var(--primary)",
                padding: "0 4px",
                flexShrink: 0,
              };
              const sectionLabel: React.CSSProperties = {
                fontSize: "9px",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.16em",
                textTransform: "uppercase" as const,
                color: "var(--text-muted)",
                marginTop: "12px",
                marginBottom: "4px",
              };
              if (isEmpty)
                return (
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      fontStyle: "italic",
                      padding: "8px 0",
                    }}
                  >
                    Mark items, feats, or spells with ☆ to pin them here.
                  </div>
                );
              return (
                <>
                  {favItems.length > 0 && (
                    <>
                      <div style={sectionLabel}>Items</div>
                      {favItems.map((item) => (
                        <div key={item.id} style={rowStyle}>
                          <button
                            style={entryBtnStyle}
                            onClick={() => {
                              setShowFavsSidebar(false);
                              setFavPopout({ type: "item", id: item.id });
                            }}
                          >
                            {item.name}
                          </button>
                          <button
                            style={pipBtnStyle}
                            onClick={() => toggleFavorite("item", item.id)}
                          >
                            ★
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                  {favFeats.length > 0 && (
                    <>
                      <div style={sectionLabel}>Feats</div>
                      {favFeats.map((feat) => (
                        <div key={feat.id} style={rowStyle}>
                          <button
                            style={entryBtnStyle}
                            onClick={() => {
                              setShowFavsSidebar(false);
                              setFavPopout({ type: "feat", id: feat.id });
                            }}
                          >
                            {feat.name}
                          </button>
                          <button
                            style={pipBtnStyle}
                            onClick={() => toggleFavorite("feat", feat.id)}
                          >
                            ★
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                  {favSpells.length > 0 && (
                    <>
                      <div style={sectionLabel}>Spells</div>
                      {favSpells.map((spell) => (
                        <div key={spell.id} style={rowStyle}>
                          <button
                            style={entryBtnStyle}
                            onClick={() => {
                              setShowFavsSidebar(false);
                              setFavPopout({ type: "spell", id: spell.id });
                            }}
                          >
                            {spell.name}
                          </button>
                          <button
                            style={pipBtnStyle}
                            onClick={() => toggleFavorite("spell", spell.id)}
                          >
                            ★
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
      {/* ──── HEADER ──── */}
      <div
        className="poa-header"
        style={{
          backgroundColor: "var(--bg-nav)",
          border: "1px solid var(--border)",
          borderRadius: "6px",
          padding: "14px 20px",
          marginBottom: "1rem",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        {/* LEFT: name + tags + back */}
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
          <div
            className="header-portrait-thumb"
            onClick={() =>
              portraitUrl
                ? setPortraitOpen(true)
                : portraitInputRef.current?.click()
            }
            title={portraitUrl ? "Click to view portrait" : "Click to upload portrait"}
          >
            {portraitUrl ? (
              <img
                src={portraitUrl}
                alt={c.name}
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: "var(--portrait-ph-a, var(--bg-2))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-muted)",
                  fontSize: 18,
                  fontFamily: "var(--font-heading)",
                  fontWeight: 700,
                }}
              >
                {c.name ? c.name.charAt(0).toUpperCase() : "?"}
              </div>
            )}
          </div>
          <div>
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontStyle: "italic",
              fontSize: "2rem",
              fontWeight: 700,
              color: "var(--text)",
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            {c.name || "Unnamed Adventurer"}
          </h1>
          <div
            style={{
              marginTop: "5px",
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
              color: "var(--text-muted)",
              letterSpacing: "0.06em",
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap" as const,
              gap: "0px",
            }}
          >
            {[
              c.professionName,
              c.originName &&
                `${c.originName}${c.vocationName ? ` (${c.vocationName})` : ""}`,
              `Tier ${effectiveTier}`,
            ]
              .filter(Boolean)
              .map((tag, i, arr) => (
                <span key={i} style={{ whiteSpace: "nowrap" as const }}>
                  <span>{tag}</span>
                  {i < arr.length - 1 && (
                    <span style={{ margin: "0 7px", color: "var(--border)" }}>
                      ·
                    </span>
                  )}
                </span>
              ))}
          </div>
          {c.ambition && (
            <div
              style={{
                marginTop: "4px",
                fontSize: "0.72rem",
                color: "var(--text-muted)",
                fontStyle: "italic",
              }}
            >
              {c.ambition}
            </div>
          )}
          <div style={{ marginTop: "8px" }}>
            <Link
              href="/characters"
              style={{
                fontSize: "0.7rem",
                color: "var(--text-muted)",
                textDecoration: "none",
                fontFamily: "var(--font-heading)",
                fontWeight: 600,
              }}
            >
              ← All Characters
            </Link>
          </div>
          </div>
        </div>
        {/* RIGHT: tier + renown bar + spell DC + delete */}
        <div
          className="poa-header-right"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "16px",
            flexShrink: 0,
          }}
        >
          {/* Tier + Renown bar */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "5px",
                marginBottom: "6px",
              }}
            >
              <span
                style={{
                  fontSize: "9px",
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase" as const,
                  color: "var(--text-muted)",
                }}
              >
                Tier
              </span>
              <span
                style={{
                  fontSize: "22px",
                  fontFamily: "var(--font-heading)",
                  fontWeight: 700,
                  color: "var(--text)",
                  lineHeight: 1,
                }}
              >
                {effectiveTier}
              </span>
            </div>
            {renownAdjInput !== null ? (
              <input
                autoFocus
                value={renownAdjInput}
                onChange={(e) => setRenownAdjInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const trimmed = renownAdjInput.trim();
                    if (trimmed !== "") {
                      const cur = c.renown ?? 0;
                      let next: number;
                      if (trimmed.startsWith("+")) {
                        next = cur + parseInt(trimmed.slice(1), 10);
                      } else if (trimmed.startsWith("-")) {
                        next = cur + parseInt(trimmed, 10);
                      } else {
                        next = parseInt(trimmed, 10);
                      }
                      if (!isNaN(next)) {
                        persist({ renown: Math.max(0, next) });
                      }
                    }
                    setRenownAdjInput(null);
                  } else if (e.key === "Escape") {
                    setRenownAdjInput(null);
                  }
                }}
                onBlur={() => setRenownAdjInput(null)}
                placeholder="+5 or -2"
                style={{
                  width: "160px",
                  padding: "1px 6px",
                  borderRadius: "2px",
                  border: "1px solid var(--primary)",
                  backgroundColor: "var(--bg-nav)",
                  color: "var(--text)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.75rem",
                  textAlign: "center" as const,
                  outline: "none",
                }}
              />
            ) : (
              <div
                onClick={() => setRenownAdjInput("")}
                title="Click to adjust renown"
                style={{
                  width: "160px",
                  height: "8px",
                  backgroundColor: "var(--border)",
                  borderRadius: "2px",
                  overflow: "hidden",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(100, Math.round(((c.renown ?? 0) / (FEAT_COST_BY_TIER[effectiveTier] ?? 6)) * 100))}%`,
                    background: "var(--primary)",
                    borderRadius: "2px",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            )}
            <div
              style={{
                marginTop: "5px",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <button
                onClick={() =>
                  persist({ renown: Math.max(0, (c.renown ?? 0) - 1) })
                }
                style={{
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--bg-nav)",
                  cursor: "pointer",
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  fontSize: "0.7rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                }}
              >
                −
              </button>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  color: "var(--text-muted)",
                  letterSpacing: "0.04em",
                  minWidth: "32px",
                  textAlign: "center",
                }}
              >
                {c.renown ?? 0} / {FEAT_COST_BY_TIER[effectiveTier] ?? 6}
              </span>
              <button
                onClick={() => persist({ renown: (c.renown ?? 0) + 1 })}
                style={{
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--bg-nav)",
                  cursor: "pointer",
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  fontSize: "0.7rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                }}
              >
                +
              </button>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "9px",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase" as const,
                  color: "var(--text-muted)",
                  marginLeft: "2px",
                }}
              >
                Renown
              </span>
            </div>
          </div>
          {/* Spell DC (casters only) */}
          {isCaster && (
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "9px",
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase" as const,
                  color: "var(--text-muted)",
                  marginBottom: "3px",
                }}
              >
                Spell DC
              </div>
              <div
                style={{
                  fontSize: "28px",
                  fontFamily: "var(--font-heading)",
                  fontWeight: 700,
                  color: "var(--primary)",
                  lineHeight: 1,
                }}
              >
                {spellDC}
              </div>
            </div>
          )}
          {/* Delete */}
          <button
            onClick={handleDelete}
            style={{
              padding: "0.25rem 0.5rem",
              border: "1px solid var(--border)",
              borderRadius: "0.375rem",
              backgroundColor: "transparent",
              cursor: "pointer",
              color: "var(--text-muted)",
              fontSize: "0.75rem",
              fontFamily: "var(--font-heading)",
              marginTop: "2px",
            }}
          >
            Delete
          </button>
        </div>
      </div>
      {/* ──── CONDITIONS BAR ──── */}
      <ConditionsBar c={c} persist={persist} />

      {/* ──── 3-COLUMN BODY ──── */}
      <div
        className="poa-sheet-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr 320px",
          gap: "14px",
          marginTop: "18px",
          alignItems: "start",
        }}
      >
        {/* LEFT COLUMN */}
        <div
          className="poa-col-left"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            minWidth: 0,
          }}
        >
          <LeftRail
            c={c}
            persist={persist}
            attrs={attrs}
            effectiveChar={effectiveChar}
            effectiveTier={effectiveTier}
            prof={prof}
          />
        </div>
        {/* CENTER COLUMN */}
        <div
          className="poa-col-center"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            minWidth: 0,
          }}
        >
          {/* ──── DEFENSE STAT ROW ──── */}
          {(() => {
            const tempAD = c.tempArmorDef ?? 0;
            const totalAD = armorDefense + tempAD;
            const spellArmorOn = !!(c.spellArmorActive && isCaster);
            const subLabel = spellArmorOn
              ? `Active`
              : hasUnarmoredDefense && !equippedBody
                ? "Unarmored"
                : hasAgile &&
                    !equippedShield &&
                    (!equippedBody ||
                      equippedBody.armorCategory === "Light" ||
                      !equippedBody.armorCategory)
                  ? "Agile"
                  : equippedBody
                    ? `${equippedBody.name} +${equippedBody.armorBonus}`
                    : "Base";
            const btnSm: React.CSSProperties = {
              width: "16px",
              height: "16px",
              borderRadius: "50%",
              border: "1px solid var(--border)",
              backgroundColor: "var(--bg-nav)",
              cursor: "pointer",
              fontWeight: 700,
              color: "var(--text-muted)",
              fontSize: "0.7rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            };
            return (
              <div
                style={{
                  backgroundColor: spellArmorOn ? "var(--primary-light)" : "var(--bg-card)",
                  border: `1px solid ${spellArmorOn ? "var(--primary)" : "var(--border)"}`,
                  borderRadius: "6px",
                  overflow: "hidden",
                }}
              >
                {/* Top: Armor Defense */}
                <div
                  style={{
                    padding: "14px 12px 10px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "10px",
                      letterSpacing: "0.16em",
                      textTransform: "uppercase" as const,
                      color: "var(--text-muted)",
                      marginBottom: "6px",
                    }}
                  >
                    Armor Defense
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "36px",
                      fontWeight: 700,
                      color: spellArmorOn ? "var(--primary)" : "var(--text)",
                      lineHeight: 1.05,
                    }}
                  >
                    {totalAD}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "9px",
                      letterSpacing: "0.1em",
                      color: spellArmorOn ? "var(--primary)" : "var(--text-muted)",
                      marginTop: "2px",
                      marginBottom: "6px",
                    }}
                  >
                    {subLabel}
                  </div>
                  {isCaster && (
                    <>
                      <button
                        onClick={() => {
                          if (!spellArmorOn && equippedBody) {
                            setSpellArmorConfirmPending(true);
                          } else {
                            setSpellArmorConfirmPending(false);
                            persist({ spellArmorActive: !c.spellArmorActive });
                          }
                        }}
                        style={{
                          display: "block",
                          margin: "0 auto 6px",
                          fontSize: "0.5rem",
                          fontFamily: "var(--font-heading)",
                          fontWeight: 700,
                          padding: "0.1rem 0.3rem",
                          borderRadius: "0.25rem",
                          border: `1px solid ${spellArmorOn ? "var(--primary)" : "var(--border)"}`,
                          backgroundColor: spellArmorOn ? "var(--primary)" : "var(--bg-card)",
                          color: spellArmorOn ? "var(--bg)" : "var(--text-muted)",
                          cursor: "pointer",
                        }}
                      >
                        {spellArmorOn ? "Spell Armor ON" : "Spell Armor"}
                      </button>
                      {spellArmorConfirmPending && !spellArmorOn && (
                        <div style={{
                          margin: "4px 0",
                          padding: "6px 8px",
                          backgroundColor: "rgb(var(--gold-rgb) / 0.08)",
                          border: "1px solid rgb(var(--gold-rgb) / 0.4)",
                          borderRadius: "4px",
                          fontSize: "0.55rem",
                          fontFamily: "var(--font-heading)",
                          color: "var(--gold-dim)",
                          textAlign: "center",
                        }}>
                          <div style={{ marginBottom: "4px" }}>Replaces armor defense</div>
                          <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                            <button
                              onClick={() => { persist({ spellArmorActive: true }); setSpellArmorConfirmPending(false); }}
                              style={{ fontSize: "0.55rem", fontFamily: "var(--font-heading)", fontWeight: 700, padding: "1px 6px", borderRadius: "3px", border: "1px solid var(--primary)", backgroundColor: "var(--primary)", color: "var(--bg)", cursor: "pointer" }}
                            >Confirm</button>
                            <button
                              onClick={() => setSpellArmorConfirmPending(false)}
                              style={{ fontSize: "0.55rem", fontFamily: "var(--font-heading)", fontWeight: 600, padding: "1px 6px", borderRadius: "3px", border: "1px solid var(--border)", backgroundColor: "transparent", color: "var(--text-muted)", cursor: "pointer" }}
                            >Cancel</button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {!spellArmorOn && equippedBody?.armorCategory === "Medium" && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: "0.2rem",
                        marginBottom: "6px",
                      }}
                    >
                      {(["brawn", "finesse"] as const).map((stat) => {
                        const active = (equippedBody.mediumArmorStat ?? "brawn") === stat;
                        return (
                          <button
                            key={stat}
                            onClick={() => updateItem(equippedBody.id, { mediumArmorStat: stat })}
                            style={{
                              fontSize: "0.5rem",
                              fontFamily: "var(--font-heading)",
                              fontWeight: 700,
                              padding: "0.1rem 0.3rem",
                              borderRadius: "0.25rem",
                              border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
                              backgroundColor: active ? "var(--primary)" : "var(--bg-card)",
                              color: active ? "#fff" : "var(--text-muted)",
                              cursor: "pointer",
                              textTransform: "capitalize" as const,
                            }}
                          >
                            {stat}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.2rem",
                    }}
                  >
                    <button onClick={() => persist({ tempArmorDef: tempAD - 1 })} style={btnSm}>−</button>
                    <span
                      style={{
                        fontSize: "0.6rem",
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-heading)",
                        minWidth: "14px",
                        textAlign: "center" as const,
                      }}
                    >
                      {tempAD === 0 ? "tmp" : tempAD}
                    </span>
                    <button onClick={() => persist({ tempArmorDef: tempAD + 1 })} style={btnSm}>+</button>
                    {tempAD !== 0 && (
                      <button
                        onClick={() => persist({ tempArmorDef: 0 })}
                        style={{ fontSize: "0.55rem", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div style={{ borderTop: "1px solid var(--border)", margin: "0 12px" }} />

                {/* Bottom: Fortitude / Mental / Will */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "0",
                    padding: "10px 12px 12px",
                  }}
                >
                  {(
                    [
                      { label: "Fortitude", value: bodyDef, sub: "brawn" },
                      { label: "Mental", value: mindDef, sub: "mind" },
                      { label: "Will", value: willDef, sub: "will" },
                    ] as const
                  ).map(({ label, value, sub }, idx) => (
                    <div
                      key={label}
                      style={{
                        textAlign: "center",
                        borderLeft: idx > 0 ? "1px solid var(--border)" : "none",
                        padding: "4px 8px",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "var(--font-heading)",
                          fontSize: "9px",
                          letterSpacing: "0.16em",
                          textTransform: "uppercase" as const,
                          color: "var(--text-muted)",
                          marginBottom: "4px",
                        }}
                      >
                        {label}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-heading)",
                          fontSize: "22px",
                          fontWeight: 700,
                          color: "var(--text)",
                          lineHeight: 1.05,
                        }}
                      >
                        {value}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-heading)",
                          fontSize: "9px",
                          letterSpacing: "0.16em",
                          textTransform: "uppercase" as const,
                          color: "var(--text-muted)",
                          marginTop: "2px",
                        }}
                      >
                        {sub}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}


          {/* ──── CENTER VITALS GRID ──── */}
          {(() => {
            const tempHp = c.tempHp ?? 0;
            const effectiveMax = derivedMaxVitality + tempHp;
            const vitPct =
              effectiveMax > 0
                ? Math.min(
                    100,
                    Math.round(((c.currentVitality ?? 0) / effectiveMax) * 100),
                  )
                : 0;
            const pmBtn: React.CSSProperties = {
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              border: "1px solid var(--border)",
              backgroundColor: "var(--bg-nav)",
              cursor: "pointer",
              fontWeight: 700,
              color: "var(--text-muted)",
              fontSize: "0.9rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            };
            return (
              <div
                className="poa-vitals-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.5fr 1fr 1fr",
                  gap: "12px",
                }}
              >
                {/* HP Card */}
                <div
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    padding: "12px 16px 16px",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "10px",
                      letterSpacing: "0.16em",
                      textTransform: "uppercase" as const,
                      color: "var(--ok)",
                      marginBottom: "10px",
                    }}
                  >
                    ♥ Vitality
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr auto 1fr",
                      gap: "8px",
                      alignItems: "end",
                    }}
                  >
                    <div style={{ textAlign: "center" }}>
                      <div
                        style={{
                          fontFamily: "var(--font-heading)",
                          fontSize: "9px",
                          letterSpacing: "0.18em",
                          textTransform: "uppercase" as const,
                          color: "var(--text-muted)",
                        }}
                      >
                        Current
                      </div>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          lineHeight: 1,
                        }}
                      >
                        <button
                          onClick={() =>
                            persist({
                              currentVitality: Math.max(
                                0,
                                (c.currentVitality ?? 0) - 1,
                              ),
                            })
                          }
                          style={pmBtn}
                        >
                          −
                        </button>
                        <span
                          style={{
                            fontFamily: "var(--font-heading)",
                            fontSize: "30px",
                            fontWeight: 700,
                            color: "var(--text)",
                          }}
                        >
                          {c.currentVitality ?? 0}
                        </span>
                        <button
                          onClick={() =>
                            persist({
                              currentVitality: Math.min(
                                effectiveMax,
                                (c.currentVitality ?? 0) + 1,
                              ),
                            })
                          }
                          style={pmBtn}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div
                        style={{
                          fontFamily: "var(--font-heading)",
                          fontSize: "9px",
                          letterSpacing: "0.18em",
                          textTransform: "uppercase" as const,
                          color: "var(--text-muted)",
                        }}
                      >
                        Max
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-heading)",
                          fontSize: "30px",
                          fontWeight: 700,
                          color: "var(--text-muted)",
                        }}
                      >
                        {derivedMaxVitality}
                      </div>
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontSize: "26px",
                        color: "var(--text-muted)",
                        paddingBottom: "4px",
                      }}
                    >
                      /
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div
                        style={{
                          fontFamily: "var(--font-heading)",
                          fontSize: "9px",
                          letterSpacing: "0.18em",
                          textTransform: "uppercase" as const,
                          color: "var(--text-muted)",
                        }}
                      >
                        Temp
                      </div>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          lineHeight: 1,
                        }}
                      >
                        <button
                          onClick={() => {
                            const next = tempHp - 1;
                            const newMax = derivedMaxVitality + next;
                            const patch: Partial<Character> = { tempHp: next };
                            if ((c.currentVitality ?? 0) > newMax)
                              patch.currentVitality = Math.max(0, newMax);
                            persist(patch);
                          }}
                          style={pmBtn}
                        >
                          −
                        </button>
                        <span
                          style={{
                            fontFamily: "var(--font-heading)",
                            fontSize: "30px",
                            fontWeight: 700,
                            color:
                              tempHp !== 0
                                ? "var(--primary)"
                                : "var(--text-muted)",
                          }}
                        >
                          {tempHp}
                        </span>
                        <button
                          onClick={() => persist({ tempHp: tempHp + 1 })}
                          style={pmBtn}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                  {vitAdjInput !== null ? (
                    <div style={{ marginTop: "14px" }}>
                      <input
                        autoFocus
                        value={vitAdjInput}
                        onChange={(e) => setVitAdjInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const trimmed = vitAdjInput.trim();
                            if (trimmed !== "") {
                              const cur = c.currentVitality ?? 0;
                              let next: number;
                              if (trimmed.startsWith("+")) {
                                next = cur + parseInt(trimmed.slice(1), 10);
                              } else if (trimmed.startsWith("-")) {
                                next = cur + parseInt(trimmed, 10);
                              } else {
                                next = parseInt(trimmed, 10);
                              }
                              if (!isNaN(next)) {
                                persist({
                                  currentVitality: Math.max(
                                    0,
                                    Math.min(effectiveMax, next),
                                  ),
                                });
                              }
                            }
                            setVitAdjInput(null);
                          } else if (e.key === "Escape") {
                            setVitAdjInput(null);
                          }
                        }}
                        onBlur={() => setVitAdjInput(null)}
                        placeholder="+5 or -10"
                        style={{
                          width: "100%",
                          padding: "4px 8px",
                          borderRadius: "3px",
                          border: "1px solid var(--primary)",
                          backgroundColor: "var(--bg-nav)",
                          color: "var(--text)",
                          fontFamily: "var(--font-mono)",
                          fontSize: "0.85rem",
                          textAlign: "center" as const,
                          outline: "none",
                          boxSizing: "border-box" as const,
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      onClick={() => setVitAdjInput("")}
                      title="Click to adjust vitality"
                      style={{
                        marginTop: "14px",
                        height: "12px",
                        backgroundColor: "rgba(122,157,111,0.1)",
                        borderRadius: "3px",
                        overflow: "hidden",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${vitPct}%`,
                          background:
                            "linear-gradient(90deg, var(--ok-dim, var(--ok)), var(--ok))",
                          borderRadius: "3px",
                          transition: "width 0.3s",
                        }}
                      />
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontFamily: "var(--font-heading)",
                      fontSize: "9px",
                      color: "var(--text-muted)",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase" as const,
                      marginTop: "6px",
                    }}
                  >
                    <span>
                      {c.currentVitality ?? 0} / {effectiveMax}
                    </span>
                    <span>{Math.round(vitPct)}%</span>
                  </div>
                  {tempHp !== 0 && (
                    <button
                      onClick={() => {
                        const patch: Partial<Character> = { tempHp: 0 };
                        if ((c.currentVitality ?? 0) > derivedMaxVitality)
                          patch.currentVitality = Math.max(
                            0,
                            derivedMaxVitality,
                          );
                        persist(patch);
                      }}
                      style={{
                        fontSize: "0.55rem",
                        color: "var(--text-muted)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        marginTop: "4px",
                      }}
                    >
                      ✕ clear temp
                    </button>
                  )}
                </div>

                {/* Side Col 1: Wounds + Ambition */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column" as const,
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      backgroundColor: "var(--bg-card)",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                      padding: "10px 14px 12px",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontSize: "10px",
                        letterSpacing: "0.16em",
                        textTransform: "uppercase" as const,
                        color: "var(--fail)",
                        marginBottom: "8px",
                      }}
                    >
                      ☠ Wounds
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "4px",
                        flexWrap: "wrap" as const,
                      }}
                    >
                      {Array.from({ length: maxWounds }).map((_, i) => (
                        <div
                          key={i}
                          onClick={() =>
                            persist({
                              currentWounds:
                                i < (c.currentWounds ?? 0) ? i : i + 1,
                            })
                          }
                          style={{
                            width: "14px",
                            height: "14px",
                            borderRadius: "50%",
                            border: `1px solid ${i < (c.currentWounds ?? 0) ? "var(--fail)" : "var(--border)"}`,
                            backgroundColor:
                              i < (c.currentWounds ?? 0)
                                ? "var(--fail)"
                                : "transparent",
                            cursor: "pointer",
                            boxShadow:
                              i < (c.currentWounds ?? 0)
                                ? "0 0 8px rgba(198,100,100,0.4)"
                                : "none",
                            transition: "all 0.15s",
                          }}
                        />
                      ))}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontFamily: "var(--font-heading)",
                        fontSize: "9px",
                        color: "var(--text-muted)",
                        letterSpacing: "0.16em",
                        textTransform: "uppercase" as const,
                        marginTop: "8px",
                      }}
                    >
                      <span>
                        {c.currentWounds ?? 0} / {maxWounds}
                      </span>
                      <span>{maxWounds - (c.currentWounds ?? 0)} until KO</span>
                    </div>
                  </div>
                  <div
                    style={{
                      backgroundColor: "var(--bg-card)",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                      padding: "10px 14px 12px",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontSize: "10px",
                        letterSpacing: "0.16em",
                        textTransform: "uppercase" as const,
                        color: "var(--primary)",
                        marginBottom: "8px",
                      }}
                    >
                      ✦ Ambition
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "5px",
                        flexWrap: "wrap" as const,
                      }}
                    >
                      {Array.from({ length: maxAmbition }).map((_, i) => (
                        <div
                          key={i}
                          onClick={() =>
                            persist({
                              currentAmbition:
                                i < (c.currentAmbition ?? 0) ? i : i + 1,
                            })
                          }
                          style={{
                            width: "22px",
                            height: "18px",
                            border: `1px solid ${i < (c.currentAmbition ?? 0) ? "var(--primary)" : "var(--border)"}`,
                            borderRadius: "2px",
                            background:
                              i < (c.currentAmbition ?? 0)
                                ? "var(--primary)"
                                : "var(--bg-nav)",
                            cursor: "pointer",
                            transition: "all 0.15s",
                          }}
                        />
                      ))}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontFamily: "var(--font-heading)",
                        fontSize: "9px",
                        color: "var(--text-muted)",
                        letterSpacing: "0.16em",
                        textTransform: "uppercase" as const,
                        marginTop: "8px",
                      }}
                    >
                      <span>
                        {c.currentAmbition ?? 0} / {maxAmbition}
                      </span>
                      <span>{ambitionDice}</span>
                    </div>
                  </div>
                </div>

                {/* Side Col 2: Respites + Carry */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column" as const,
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      backgroundColor: "var(--bg-card)",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                      padding: "10px 14px 12px",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontSize: "10px",
                        letterSpacing: "0.16em",
                        textTransform: "uppercase" as const,
                        color: "var(--primary)",
                        marginBottom: "8px",
                      }}
                    >
                      Respites
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "6px",
                        alignItems: "center",
                      }}
                    >
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          onClick={() =>
                            persist({
                              currentRespites: i < currentRespites ? i : i + 1,
                            })
                          }
                          style={{
                            display: "inline-block",
                            width: "14px",
                            height: "14px",
                            borderRadius: "50%",
                            background:
                              i < currentRespites
                                ? "var(--primary)"
                                : "transparent",
                            border: `1px solid ${i < currentRespites ? "var(--primary)" : "var(--border)"}`,
                            cursor: "pointer",
                          }}
                        />
                      ))}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontFamily: "var(--font-heading)",
                        fontSize: "9px",
                        color: "var(--text-muted)",
                        letterSpacing: "0.16em",
                        textTransform: "uppercase" as const,
                        marginTop: "8px",
                      }}
                    >
                      <span>{currentRespites} / 3</span>
                      <span>per day</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ──── CENTER BOTTOM: REDUCTION POOL + REST ──── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr",
              gap: "12px",
            }}
          >
            {/* Reduction Pool card */}
            {(() => {
              const spellPool = c.spellReductionPool ?? 0;
              const featPool = c.featReductionPool ?? 0;
              const shieldPool = equippedShield?.reductionPoolCurrent ?? null;
              const shieldPoolMax = equippedShield?.reductionPoolMax ?? null;
              const hasAnyPool =
                spellPool > 0 || featPool > 0 || shieldPool != null;
              return (
                <div
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    padding: "12px 14px",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "10px",
                      letterSpacing: "0.16em",
                      textTransform: "uppercase" as const,
                      color: "var(--fail)",
                      marginBottom: "10px",
                    }}
                  >
                    Reduction Pool
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "0.25rem",
                    }}
                  >
                    <input
                      type="number"
                      min={1}
                      value={damageInput}
                      onChange={(e) => setDamageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const n = parseInt(damageInput);
                          if (n > 0) {
                            applyDamage(n);
                            setDamageInput("");
                          }
                        }
                      }}
                      placeholder="0"
                      style={{
                        ...inputStyle,
                        width: "60px",
                        textAlign: "center" as const,
                      }}
                    />
                    <button
                      onClick={() => {
                        const n = parseInt(damageInput);
                        if (n > 0) {
                          applyDamage(n);
                          setDamageInput("");
                        }
                      }}
                      style={{
                        padding: "0.3rem 0.75rem",
                        border: "none",
                        borderRadius: "0.375rem",
                        backgroundColor: "var(--fail)",
                        color: "var(--bg)",
                        cursor: "pointer",
                        fontFamily: "var(--font-mono)",
                        fontWeight: 600,
                        fontSize: "0.8rem",
                      }}
                    >
                      Hit
                    </button>
                  </div>
                  <div
                    style={{
                      fontSize: "0.58rem",
                      color: "var(--text-muted)",
                      fontStyle: "italic",
                      marginBottom: "0.5rem",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Spell → Feat → Shield → HP
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "0.375rem",
                      flexWrap: "wrap" as const,
                    }}
                  >
                    {spellPool > 0 && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          padding: "0.2rem 0.5rem",
                          backgroundColor: "var(--primary-light)",
                          border: "1px solid var(--primary)",
                          borderRadius: "9999px",
                          fontSize: "0.62rem",
                          fontFamily: "var(--font-heading)",
                          color: "var(--primary)",
                          fontWeight: 700,
                        }}
                      >
                        ✦ Spell: {spellPool}
                        <button
                          onClick={() =>
                            persist({
                              spellReductionPool: Math.max(0, spellPool - 1),
                            })
                          }
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "0.6rem",
                            color: "var(--primary)",
                            padding: 0,
                          }}
                        >
                          −
                        </button>
                        <button
                          onClick={() =>
                            persist({ spellReductionPool: spellPool + 1 })
                          }
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "0.6rem",
                            color: "var(--primary)",
                            padding: 0,
                          }}
                        >
                          +
                        </button>
                        <button
                          onClick={() => persist({ spellReductionPool: 0 })}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "0.55rem",
                            color: "var(--text-muted)",
                            padding: 0,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    {featPool > 0 && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          padding: "0.2rem 0.5rem",
                          backgroundColor: "var(--accent-light)",
                          border: "1px solid var(--accent)",
                          borderRadius: "9999px",
                          fontSize: "0.62rem",
                          fontFamily: "var(--font-heading)",
                          color: "var(--accent)",
                          fontWeight: 700,
                        }}
                      >
                        ✦ Feat: {featPool}
                        <button
                          onClick={() =>
                            persist({
                              featReductionPool: Math.max(0, featPool - 1),
                            })
                          }
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "0.6rem",
                            color: "var(--accent)",
                            padding: 0,
                          }}
                        >
                          −
                        </button>
                        <button
                          onClick={() =>
                            persist({ featReductionPool: featPool + 1 })
                          }
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "0.6rem",
                            color: "var(--accent)",
                            padding: 0,
                          }}
                        >
                          +
                        </button>
                        <button
                          onClick={() => persist({ featReductionPool: 0 })}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "0.55rem",
                            color: "var(--text-muted)",
                            padding: 0,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    {shieldPool != null && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          padding: "0.2rem 0.5rem",
                          backgroundColor:
                            shieldPool === 0
                              ? "var(--section-alert-bg)"
                              : "var(--bg-nav)",
                          border: `1px solid ${shieldPool === 0 ? "rgb(var(--fail-rgb) / 0.70)" : "var(--border)"}`,
                          borderRadius: "9999px",
                          fontSize: "0.62rem",
                          fontFamily: "var(--font-heading)",
                          color:
                            shieldPool === 0 ? "rgb(var(--fail-rgb) / 0.70)" : "var(--text-muted)",
                          fontWeight: 700,
                        }}
                      >
                        🛡 {shieldPool}/{shieldPoolMax}
                        {shieldPool === 0 && " (broken)"}
                      </div>
                    )}
                    {!hasAnyPool && (
                      <div style={{ display: "flex", gap: "0.375rem" }}>
                        <button
                          onClick={() => persist({ spellReductionPool: 1 })}
                          style={{
                            fontSize: "0.6rem",
                            padding: "0.15rem 0.4rem",
                            border: "1px dashed var(--border)",
                            borderRadius: "9999px",
                            backgroundColor: "transparent",
                            cursor: "pointer",
                            color: "var(--text-muted)",
                            fontFamily: "var(--font-heading)",
                          }}
                        >
                          + Spell Pool
                        </button>
                        <button
                          onClick={() => persist({ featReductionPool: 1 })}
                          style={{
                            fontSize: "0.6rem",
                            padding: "0.15rem 0.4rem",
                            border: "1px dashed var(--border)",
                            borderRadius: "9999px",
                            backgroundColor: "transparent",
                            cursor: "pointer",
                            color: "var(--text-muted)",
                            fontFamily: "var(--font-heading)",
                          }}
                        >
                          + Feat Pool
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Rest card */}
            <div
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "10px",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase" as const,
                  color: "var(--text-muted)",
                  marginBottom: "8px",
                }}
              >
                Rest
              </div>
              <div
                className="poa-rest-buttons"
                style={{
                  display: "flex",
                  flexDirection: "row" as const,
                  gap: "0.4rem",
                }}
              >
                <button
                  onClick={takeRespite}
                  disabled={currentRespites <= 0}
                  style={{
                    flex: 1,
                    padding: "0.5rem 0.4rem",
                    border: `1px solid ${currentRespites > 0 ? "var(--primary)" : "var(--border)"}`,
                    borderRadius: "5px",
                    backgroundColor: "transparent",
                    cursor: currentRespites > 0 ? "pointer" : "not-allowed",
                    color:
                      currentRespites > 0
                        ? "var(--primary)"
                        : "var(--text-muted)",
                    fontFamily: "var(--font-heading)",
                    fontWeight: 700,
                    fontSize: "0.72rem",
                    textAlign: "center" as const,
                  }}
                >
                  <div>Respite</div>
                  <div
                    style={{
                      fontSize: "0.58rem",
                      fontWeight: 400,
                      color: "var(--text-muted)",
                      marginTop: "2px",
                    }}
                  >
                    4 Vit · 1 Amb
                  </div>
                </button>
                <button
                  onClick={takeLongRest}
                  style={{
                    flex: 1,
                    padding: "0.5rem 0.4rem",
                    border: "1px solid var(--border)",
                    borderRadius: "5px",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                    color: "var(--text)",
                    fontFamily: "var(--font-heading)",
                    fontWeight: 700,
                    fontSize: "0.72rem",
                    textAlign: "center" as const,
                  }}
                >
                  <div>Long Rest</div>
                  <div
                    style={{
                      fontSize: "0.58rem",
                      fontWeight: 400,
                      color: "var(--text-muted)",
                      marginTop: "2px",
                    }}
                  >
                    10 Vit · +1 Resp
                  </div>
                </button>
                <button
                  onClick={takeFullRest}
                  style={{
                    flex: 1,
                    padding: "0.5rem 0.4rem",
                    border: "1px solid var(--border)",
                    borderRadius: "5px",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                    color: "var(--text)",
                    fontFamily: "var(--font-heading)",
                    fontWeight: 700,
                    fontSize: "0.72rem",
                    textAlign: "center" as const,
                  }}
                >
                  <div>Full Rest</div>
                  <div
                    style={{
                      fontSize: "0.58rem",
                      fontWeight: 400,
                      color: "var(--text-muted)",
                      marginTop: "2px",
                    }}
                  >
                    Full recovery
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* ──── RESOURCES STRIP ──── */}
          <div
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              padding: "10px 14px",
              marginBottom: "1rem",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap" as const,
              }}
            >
              {/* Caster stats inline */}
              {isCaster && (
                <>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      paddingRight: "12px",
                      borderRight: "1px solid var(--border)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "9px",
                        fontFamily: "var(--font-mono)",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase" as const,
                        color: "var(--text-muted)",
                      }}
                    >
                      Reservoir
                    </span>
                    <button
                      onClick={() =>
                        persist({
                          currentReservoir: Math.max(0, currentReservoir - 1),
                        })
                      }
                      style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--bg-nav)",
                        cursor: "pointer",
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
                        fontSize: "1.3rem",
                        color: "var(--primary)",
                        lineHeight: 1,
                      }}
                    >
                      {currentReservoir}
                      <span
                        style={{
                          fontSize: "0.62rem",
                          color: "var(--text-muted)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        /{maxReservoir}
                      </span>
                    </span>
                    <button
                      onClick={() =>
                        persist({
                          currentReservoir: Math.min(
                            maxReservoir,
                            currentReservoir + 1,
                          ),
                        })
                      }
                      style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--bg-nav)",
                        cursor: "pointer",
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
                  {[
                    { lbl: "Spell Tier", val: String(spellTier) },
                    { lbl: "Spell DC", val: String(spellDC ?? "—") },
                    {
                      lbl: "Known",
                      val: `${c.knownSpellIds.length}/${knownSpellsMax}`,
                    },
                    { lbl: "Prepared", val: String(preparedSpellsMax) },
                  ].map(({ lbl, val }) => (
                    <div
                      key={lbl}
                      style={{
                        display: "flex",
                        flexDirection: "column" as const,
                        alignItems: "center",
                        gap: "1px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "9px",
                          fontFamily: "var(--font-mono)",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase" as const,
                          color: "var(--text-muted)",
                        }}
                      >
                        {lbl}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-heading)",
                          fontWeight: 700,
                          fontSize: "1.3rem",
                          color: "var(--text)",
                          lineHeight: 1,
                        }}
                      >
                        {val}
                      </span>
                    </div>
                  ))}
                  {(accessibleSources.length > 0 ||
                    knownSchoolSpheres.length > 0) && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column" as const,
                        gap: "1px",
                      }}
                    >
                      {accessibleSources.length > 0 && (
                        <span
                          style={{
                            fontSize: "0.52rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          {accessibleSources.join(", ")}
                        </span>
                      )}
                      {knownSchoolSpheres.length > 0 && (
                        <span
                          style={{
                            fontSize: "0.52rem",
                            color: "var(--accent)",
                          }}
                        >
                          {knownSchoolSpheres.join(", ")}
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
              {/* Class resource inline (data-driven via profession.customResource) */}
              {prof?.customResource && (() => {
                const def = prof.customResource!;
                const resourceMax = evalResourceMax(def, attrs, effectiveTier);
                const resourceVal = c.customResources?.[def.key] ?? resourceMax;
                const btnSm: React.CSSProperties = {
                  width: "18px",
                  height: "18px",
                  borderRadius: "50%",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--bg-nav)",
                  cursor: "pointer",
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  fontSize: "0.75rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                };
                return (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      paddingLeft: isCaster ? "12px" : "0",
                      borderLeft: isCaster ? "1px solid var(--border)" : "none",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "9px",
                        fontFamily: "var(--font-mono)",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase" as const,
                        color: def.color ?? "var(--text-muted)",
                      }}
                    >
                      {def.label}
                    </span>
                    <button
                      onClick={() =>
                        persist({
                          customResources: {
                            ...c.customResources,
                            [def.key]: Math.max(0, resourceVal - 1),
                          },
                        })
                      }
                      style={btnSm}
                    >
                      −
                    </button>
                    <span
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontWeight: 700,
                        fontSize: "1.3rem",
                        color: "var(--primary)",
                        lineHeight: 1,
                      }}
                    >
                      {resourceVal}
                      <span
                        style={{
                          fontSize: "0.62rem",
                          color: "var(--text-muted)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        /{resourceMax}
                      </span>
                    </span>
                    <button
                      onClick={() =>
                        persist({
                          customResources: {
                            ...c.customResources,
                            [def.key]: Math.min(resourceMax, resourceVal + 1),
                          },
                        })
                      }
                      style={btnSm}
                    >
                      +
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ──── TAB NAVIGATION (top) ──── */}
          <div
            className="poa-tab-bar"
            style={{
              display: "flex",
              borderBottom: "1px solid var(--border)",
              marginBottom: "1rem",
            }}
          >
            {tabs
              .filter((t) => !t.hidden)
              .map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: "0.625rem 0.875rem",
                      border: "none",
                      cursor: "pointer",
                      backgroundColor: "transparent",
                      fontFamily: "var(--font-mono)",
                      fontStyle: "normal",
                      fontWeight: 500,
                      fontSize: "0.7rem",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase" as const,
                      color: active ? "var(--primary)" : "var(--text-muted)",
                      borderBottom: active
                        ? "2px solid var(--primary)"
                        : "2px solid transparent",
                      marginBottom: "-1px",
                      transition: "color 0.12s",
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
          </div>

          {/* ──── TAB CONTENT ──── */}
          <div style={{ minHeight: "200px" }}>
            {activeTab === "combat" && (
              <CombatTab
                c={c}
                persist={persist}
                equippedMain={equippedMain}
                equippedOff={equippedOff}
                equippedTwoHands={equippedTwoHands}
                equippedBody={equippedBody}
                attrs={attrs}
              />
            )}
            {activeTab === "feats" && (
              <FeatsTab
                c={c}
                persist={persist}
                prof={prof}
                origin={origin}
                vocation={vocation}
                selectedFeats={selectedFeats}
                choiceFeatures={choiceFeatures}
                professionFeats={professionFeats}
                originFeats={originFeats}
                effectiveTier={effectiveTier}
                isFavorite={isFavorite}
                toggleFavorite={toggleFavorite}
              />
            )}
            {activeTab === "inventory" && (
              <InventoryTab
                c={c}
                persist={persist}
                inventory={inventory}
                totalCarried={totalCarried}
                catalog={catalog}
                showToast={showToast}
                isFavorite={isFavorite}
                toggleFavorite={toggleFavorite}
                equipItem={equipItem}
                updateItem={updateItem}
                removeItem={removeItem}
                weaponStats={weaponStats}
                startTouchDrag={startTouchDrag}
                dragOverSlot={dragOverSlot}
                setDragOverSlot={setDragOverSlot}
                dragItemId={dragItemId}
                carryWeight={carryWeight}
                isArmorProficient={isArmorProficient}
                equippedMain={equippedMain}
                equippedOff={equippedOff}
                equippedTwoHands={equippedTwoHands}
                equippedBody={equippedBody}
                equippedHead={equippedHead}
                equippedNeck={equippedNeck}
                equippedCloak={equippedCloak}
                equippedGloves={equippedGloves}
                equippedBoots={equippedBoots}
                equippedRing={equippedRing}
                moveTouchGhost={moveTouchGhost}
                endTouchDrag={endTouchDrag}
                touchGhostRef={touchGhostRef}
                touchDragItemId={touchDragItemId}
                touchLongPressTimer={touchLongPressTimer}
              />
            )}
            {activeTab === "spellcasting" && (
              <SpellsTab
                c={c}
                persist={persist}
                casterInfo={casterInfo}
                isCaster={isCaster}
                mySpells={mySpells}
                spells={spells}
                currentReservoir={currentReservoir}
                spellTier={spellTier}
                accessibleSources={accessibleSources}
                knownSchoolSpheres={knownSchoolSpheres}
                isFavorite={isFavorite}
                toggleFavorite={toggleFavorite}
              />
            )}
            {activeTab === "notes" && <NotesTab char={c} persist={persist} />}
          </div>
        </div>{" "}
        {/* end CENTER column */}
        {/* RIGHT COLUMN */}
        <div
          className="poa-col-right"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            minWidth: 0,
          }}
        >
          <RightRail
            c={c}
            persist={persist}
            prof={prof}
            vocation={vocation}
            effectiveTier={effectiveTier}
            allFeats={allFeats}
            spells={spells}
            inventory={inventory}
            toggleFavorite={toggleFavorite}
            setFavPopout={setFavPopout}
            attrs={attrs}
            isArmorProficient={isArmorProficient}
          />
        </div>
      </div>{" "}
      {/* end 3-col grid */}
      {/* ──── PROFICIENCIES (moved to left rail — retained for Section component compatibility) ──── */}
      {false && (
        <Section title="Proficiencies">
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
          >
            {/* Armor penalty warning */}
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
                ⚠ Armor Penalty active — all skill dice reduced one step (min
                d4)
              </div>
            )}

            {/* Unspent skill points notice */}
            {(() => {
              const totalAvailableSkill =
                4 + 2 * Math.floor((c.featsPurchased ?? 0) / 2);
              const totalSpentSkill = Object.values(c.skillPoints ?? {}).reduce(
                (s, v) => s + v,
                0,
              );
              const dynUnspentSkill = totalAvailableSkill - totalSpentSkill;
              return dynUnspentSkill > 0 ? (
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
              ) : null;
            })()}

            {/* V.I.T.A.L.S. skills — 2-col badge grid */}
            <div>
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
                V.I.T.A.L.S.
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
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
                  const totalAvailableSkill =
                    4 + 2 * Math.floor((c.featsPurchased ?? 0) / 2);
                  const totalSpentSkill = Object.values(
                    c.skillPoints ?? {},
                  ).reduce((s, v) => s + v, 0);
                  const dynUnspentSkill = totalAvailableSkill - totalSpentSkill;
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
                    const i = DIE_STEP.indexOf(
                      faces as (typeof DIE_STEP)[number],
                    );
                    return i > 0 ? DIE_STEP[i - 1] : 4;
                  }
                  const penalizedDisplay = (() => {
                    if (pool.profDieFaces !== null) {
                      return `${pool.baseDiceCount + pool.skillDiceCount}d${stepDown(pool.profDieFaces)}`;
                    }
                    const baseFaces = calcBaseDiceFromAttr(
                      calcSkillAttrValue(skill, attrs),
                    );
                    return `${pool.baseDiceCount + pool.skillDiceCount}d${stepDown(baseFaces)}`;
                  })();

                  // Badge color by die size
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
                        : dieFaces === 6
                          ? {
                              backgroundColor: "var(--bg-nav)",
                              color: "var(--text-muted)",
                              border: "1px solid var(--border)",
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
                      {/* Skill name */}
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
                      {/* Rank badge (non-untrained only) */}
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
                      {/* Die badge */}
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
                      {/* Invest +/− */}
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
                            const newSkillPts = {
                              ...(c.skillPoints ?? {}),
                              [skill]: invested - 1,
                            };
                            const newTotalSpent = totalSpentSkill - 1;
                            persist({
                              skillPoints: newSkillPts,
                              unspentSkillPoints:
                                totalAvailableSkill - newTotalSpent,
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
                            textAlign: "center",
                            color: "var(--primary)",
                          }}
                        >
                          {invested}
                        </span>
                        <button
                          onClick={() => {
                            if (!canAdd) return;
                            const newSkillPts = {
                              ...(c.skillPoints ?? {}),
                              [skill]: invested + 1,
                            };
                            const newTotalSpent = totalSpentSkill + 1;
                            persist({
                              skillPoints: newSkillPts,
                              unspentSkillPoints:
                                totalAvailableSkill - newTotalSpent,
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

            {/* Armaments / Protection / Tool Kits */}
            {[
              { label: "Armaments", items: prof?.armaments ?? [] },
              { label: "Protection", items: prof?.protection ?? [] },
              {
                label: "Tool Kits",
                items: (prof?.toolKits ?? []).filter((t) => t !== "-"),
              },
            ]
              .filter((g) => g.items.length > 0)
              .map((group) => (
                <div key={group.label}>
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
                    {group.label}
                  </div>
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
        </Section>
      )}
      {/* ──── FAVORITES POPOUT OVERLAY ──── */}
      {favPopout &&
        (() => {
          let title = "";
          let body: React.ReactNode = null;

          if (favPopout.type === "item") {
            const item = inventory.find((i) => i.id === favPopout.id);
            if (item) {
              title = item.name;
              body = (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}
                  >
                    {item.category}
                    {item.armorCategory ? ` · ${item.armorCategory}` : ""}
                  </div>
                  {(item.armorBonus ?? 0) > 0 && (
                    <div style={{ fontSize: "0.8rem" }}>
                      +{item.armorBonus}{" "}
                      {item.category === "Shield" ? "Shield" : "Armor"} Def
                    </div>
                  )}
                  {item.damageDiceCount > 0 && (
                    <div style={{ fontSize: "0.8rem" }}>
                      {item.damageDiceCount}d{item.damageDiceSize} damage
                    </div>
                  )}
                  {(item.traits ?? []).length > 0 && (
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      {item.traits.join(", ")}
                    </div>
                  )}
                  {item.notes && (
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--text)",
                        marginTop: "4px",
                        whiteSpace: "pre-wrap" as const,
                      }}
                    >
                      {item.notes}
                    </div>
                  )}
                  <div
                    style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                  >
                    {item.weight} lb · qty {item.quantity}
                  </div>
                </div>
              );
            }
          } else if (favPopout.type === "feat") {
            const allFeatEntries = [
              ...allFeats,
              ...(prof?.baseFeatures ?? []),
              ...(vocation?.features ?? []),
            ];
            const feat = allFeatEntries.find((f) => f.id === favPopout.id);
            if (feat) {
              title = feat.name;
              const featTier =
                "tier" in feat ? (feat as { tier?: number }).tier : undefined;
              const featActivation =
                "activationRaw" in feat
                  ? (feat as { activationRaw?: string | null }).activationRaw
                  : null;
              body = (
                <div>
                  {featTier !== undefined && (
                    <div
                      style={{
                        fontSize: "0.72rem",
                        color: "var(--text-muted)",
                        marginBottom: "8px",
                      }}
                    >
                      Tier {featTier}
                    </div>
                  )}
                  {featActivation && featActivation !== "-" && (
                    <div
                      style={{
                        fontSize: "0.72rem",
                        color: "var(--accent)",
                        marginBottom: "8px",
                      }}
                    >
                      {featActivation}
                    </div>
                  )}
                  <MarkdownContent content={feat.descriptionMarkdown} />
                </div>
              );
            }
          } else if (favPopout.type === "spell") {
            const spell = spells.find((s) => s.id === favPopout.id);
            if (spell) {
              title = spell.name;
              body = (
                <div>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap" as const,
                      marginBottom: "10px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.72rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      {spell.isCantrip ? "Cantrip" : `Tier ${spell.tier}`}
                    </span>
                    {spell.school && (
                      <span
                        style={{
                          fontSize: "0.72rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        {spell.school}
                      </span>
                    )}
                    {spell.range && (
                      <span
                        style={{
                          fontSize: "0.72rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        {spell.range}
                      </span>
                    )}
                    {spell.duration && (
                      <span
                        style={{
                          fontSize: "0.72rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        {spell.duration}
                      </span>
                    )}
                  </div>
                  <MarkdownContent content={spell.descriptionMarkdown} />
                </div>
              );
            }
          }

          if (!body) return null;

          return (
            <div
              onClick={() => setFavPopout(null)}
              style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.55)",
                zIndex: 200,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px",
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "20px",
                  maxWidth: "480px",
                  width: "100%",
                  maxHeight: "80vh",
                  overflow: "auto",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "14px",
                  }}
                >
                  <h2
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontStyle: "italic",
                      fontSize: "1.2rem",
                      fontWeight: 700,
                      color: "var(--text)",
                      margin: 0,
                    }}
                  >
                    {title}
                  </h2>
                  <button
                    onClick={() => setFavPopout(null)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text-muted)",
                      fontSize: "1rem",
                      padding: "0 0 0 12px",
                      lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                </div>
                {body}
              </div>
            </div>
          );
        })()}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "1.5rem",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: toast.type === "remove" ? "var(--bg-nav)" : "var(--primary)",
            color: toast.type === "remove" ? "var(--text-muted)" : "var(--text-on-primary)",
            padding: "0.5rem 1.125rem",
            borderRadius: "9999px",
            fontSize: "0.8rem",
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            border: "1px solid var(--border)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
            zIndex: 9999,
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Portrait modal */}
      {portraitOpen && (
        <div className="portrait-modal-overlay" onClick={() => setPortraitOpen(false)}>
          <div className="portrait-modal" onClick={(e) => e.stopPropagation()}>
            {portraitUrl ? (
              <img
                src={portraitUrl}
                alt={c.name}
                style={{ display: "block", width: "100%", maxHeight: "60vh", objectFit: "contain" }}
              />
            ) : (
              <div
                style={{
                  height: 200,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-heading)",
                  fontSize: 14,
                }}
              >
                No portrait uploaded
              </div>
            )}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderTop: "1px solid var(--border)",
                gap: 8,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-heading)",
                  fontStyle: "italic",
                  fontSize: 16,
                  color: "var(--gold)",
                }}
              >
                {c.name}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="portrait-modal-btn" onClick={() => portraitInputRef.current?.click()}>
                  Change
                </button>
                {portraitUrl && (
                  <button
                    className="portrait-modal-btn portrait-modal-btn--danger"
                    onClick={() => {
                      localStorage.removeItem(`portrait-${c.id}`);
                      setPortraitUrl(null);
                      setPortraitOpen(false);
                    }}
                  >
                    Remove
                  </button>
                )}
                <button className="portrait-modal-btn" onClick={() => setPortraitOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden portrait file input */}
      <input
        ref={portraitInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            const url = ev.target?.result as string;
            localStorage.setItem(`portrait-${c.id}`, url);
            setPortraitUrl(url);
          };
          reader.readAsDataURL(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
