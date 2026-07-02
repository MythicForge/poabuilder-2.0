"use client";

/**
 * InventoryTab — item list, add/edit forms, equipment-slot pickers,
 * catalog browser, currency, and drag/drop equipping.
 *
 * Extracted from CharacterSheet.renderInventoryTab() (REFACTOR_PLAN R6).
 * Add-form / edit / picker / catalog state is tab-local, along with `addItem`
 * and the `filteredCatalog` memo. Item-mutation helpers shared with the equip
 * slots elsewhere (equipItem/updateItem/removeItem/weaponStats) and the
 * drag/touch plumbing stay in CharacterSheet and arrive as props.
 */
import { useMemo, useState, type MutableRefObject } from "react";
import type {
  Character,
  InventoryItem,
  InventoryCategory,
  InventorySlot,
  AttributeKey,
} from "@/lib/characterTypes";
import type { CatalogItem } from "@/lib/builderData";

const INVENTORY_CATEGORIES: InventoryCategory[] = [
  "Weapon",
  "Armor",
  "Shield",
  "Kit",
  "Consumable",
  "Misc",
];

/** Unique inventory item id. Module-scope keeps call sites render-pure. */
function genItemId() {
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Temp to-hit / damage modifier stepper (props-only; module-scope). */
function TempCtrl({
  label,
  value,
  onDec,
  onInc,
  onClear,
}: {
  label: string;
  value: number;
  onDec: () => void;
  onInc: () => void;
  onClear: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.35rem",
        padding: "0.35rem 0.6rem",
        backgroundColor: "var(--bg-nav)",
        border: `1px solid ${value !== 0 ? "var(--primary)" : "var(--border)"}`,
        borderRadius: "0.5rem",
      }}
    >
      <span
        style={{
          fontSize: "0.6rem",
          fontFamily: "var(--font-heading)",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--text-muted)",
          flex: 1,
        }}
      >
        {label}
      </span>
      <button
        onClick={onDec}
        style={{
          width: "18px",
          height: "18px",
          borderRadius: "50%",
          border: "1px solid var(--border)",
          backgroundColor: "var(--bg-card)",
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
          fontSize: "0.9rem",
          color: value !== 0 ? "var(--primary)" : "var(--text)",
          minWidth: "28px",
          textAlign: "center",
        }}
      >
        {value > 0 ? `+${value}` : value === 0 ? "0" : value}
      </span>
      <button
        onClick={onInc}
        style={{
          width: "18px",
          height: "18px",
          borderRadius: "50%",
          border: "1px solid var(--border)",
          backgroundColor: "var(--bg-card)",
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
      {value !== 0 && (
        <button
          onClick={onClear}
          style={{
            fontSize: "0.6rem",
            color: "var(--text-muted)",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

interface InventoryTabProps {
  c: Character;
  persist: (patch: Partial<Character>) => void;
  inventory: InventoryItem[];
  totalCarried: number;
  catalog: CatalogItem[];
  showToast: (message: string, type?: "success" | "remove") => void;
  isFavorite: (type: "item" | "feat" | "spell", id: string) => boolean;
  toggleFavorite: (type: "item" | "feat" | "spell", id: string) => void;
  equipItem: (itemId: string, slot: InventorySlot) => void;
  updateItem: (itemId: string, updates: Partial<InventoryItem>) => void;
  removeItem: (itemId: string) => void;
  weaponStats: (
    item: InventoryItem | null,
  ) => { toHit: string; damage: string; modStat: AttributeKey } | null;
  startTouchDrag: (
    itemId: string,
    itemName: string,
    x: number,
    y: number,
  ) => void;
  dragOverSlot: InventorySlot;
  setDragOverSlot: (slot: InventorySlot) => void;
  dragItemId: MutableRefObject<string | null>;
  carryWeight: number;
  isArmorProficient: boolean;
  equippedMain: InventoryItem | null;
  equippedOff: InventoryItem | null;
  equippedTwoHands: InventoryItem | null;
  equippedBody: InventoryItem | null;
  equippedHead: InventoryItem | null;
  equippedNeck: InventoryItem | null;
  equippedCloak: InventoryItem | null;
  equippedGloves: InventoryItem | null;
  equippedBoots: InventoryItem | null;
  equippedRing: InventoryItem | null;
  moveTouchGhost: (x: number, y: number) => void;
  endTouchDrag: (x: number, y: number) => void;
  touchGhostRef: MutableRefObject<HTMLDivElement | null>;
  touchDragItemId: MutableRefObject<string | null>;
  touchLongPressTimer: MutableRefObject<ReturnType<typeof setTimeout> | null>;
}

export default function InventoryTab({
  c,
  persist,
  inventory,
  totalCarried,
  catalog,
  showToast,
  isFavorite,
  toggleFavorite,
  equipItem,
  updateItem,
  removeItem,
  weaponStats,
  startTouchDrag,
  dragOverSlot,
  setDragOverSlot,
  dragItemId,
  carryWeight,
  isArmorProficient,
  equippedMain,
  equippedOff,
  equippedTwoHands,
  equippedBody,
  equippedHead,
  equippedNeck,
  equippedCloak,
  equippedGloves,
  equippedBoots,
  equippedRing,
  moveTouchGhost,
  endTouchDrag,
  touchGhostRef,
  touchDragItemId,
  touchLongPressTimer,
}: InventoryTabProps) {
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

  function selectCatalogItem(item: CatalogItem) {
    setCatalogSelected(item);
    setNewName(item.name);
    setNewCategory(item.category as InventoryCategory);
    setNewWeight(item.weight);
    setNewSlot(item.slot as InventorySlot);
    setNewQty(1);
    setNewNotes("");
    setNewArmorBonus(item.armorBonus ?? 0);
    setNewWoundBonus(item.woundBonus ?? 0);
    setNewShieldType(
      (item.shieldType ?? null) as
        | "Temporary"
        | "Light"
        | "Medium"
        | "Heavy"
        | null,
    );
    setNewArmorCategory(
      (item.armorCategory as "Light" | "Medium" | "Heavy" | null) ?? null,
    );
    setNewDamageDiceCount(item.damageDiceCount ?? 0);
    setNewDamageDiceSize(item.damageDiceSize ?? 6);
    setNewDamageTypeTags(item.damageTypeTags ?? []);
    setNewArmamentTags(item.armamentTags ?? []);
    setNewEquipSlots(item.equipSlots ?? []);
    setNewModifierStat(null); // modifier_stat not in catalog — user sets it
    setNewIsRanged(item.isRanged ?? false);
    setNewMasterworkBonus(0);
  }
  const [addingItem, setAddingItem] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogSelected, setCatalogSelected] = useState<CatalogItem | null>(
    null,
  );
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<InventoryCategory>("Misc");
  const [newQty, setNewQty] = useState(1);
  const [newWeight, setNewWeight] = useState(0);
  const [newNotes, setNewNotes] = useState("");
  const [newSlot, setNewSlot] = useState<InventorySlot>(null);
  const [newArmorBonus, setNewArmorBonus] = useState(0);
  const [newWoundBonus, setNewWoundBonus] = useState(0);
  const [newArmorCategory, setNewArmorCategory] = useState<
    "Light" | "Medium" | "Heavy" | null
  >(null);
  const [newShieldType, setNewShieldType] = useState<
    "Temporary" | "Light" | "Medium" | "Heavy" | null
  >(null);
  const [newModifierStat, setNewModifierStat] = useState<
    "brawn" | "finesse" | "mind" | "will" | null
  >(null);
  const [newIsRanged, setNewIsRanged] = useState(false);
  const [newDamageDiceCount, setNewDamageDiceCount] = useState(0);
  const [newDamageDiceSize, setNewDamageDiceSize] = useState(6);
  const [newDamageTypeTags, setNewDamageTypeTags] = useState<string[]>([]);
  const [newArmamentTags, setNewArmamentTags] = useState<string[]>([]);
  const [newEquipSlots, setNewEquipSlots] = useState<string[]>([]);
  const [newMasterworkBonus, setNewMasterworkBonus] = useState(0);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Partial<InventoryItem>>({});
  const [pickingSlot, setPickingSlot] = useState<InventorySlot>(null);
  const [notePopoverItemId, setNotePopoverItemId] = useState<string | null>(
    null,
  );
  const [traitInputVal, setTraitInputVal] = useState("");

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.toLowerCase().trim();
    if (!q) return catalog;
    return catalog.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q),
    );
  }, [catalogSearch, catalog]);

  function addItem(silent = false) {
    if (!newName.trim()) return;
    const item: InventoryItem = {
      id: genItemId(),
      name: newName.trim(),
      category: newCategory,
      quantity: newQty,
      weight: newWeight,
      notes: newNotes,
      source: catalogSelected ? "catalog" : "manual",
      slot: newSlot,
      equipped: false,
      traits: catalogSelected?.traits ?? [],
      catalogItemId: catalogSelected?.id ?? null,
      armorBonus: newArmorBonus,
      armorCategory: newArmorCategory,
      armorTier: null,
      woundBonus: newWoundBonus,
      mediumArmorStat: null,
      shieldType: newShieldType,
      armamentTags: newArmamentTags,
      modifierStat: newModifierStat,
      isRanged: newIsRanged,
      damageDiceCount: newDamageDiceCount,
      damageDiceSize: newDamageDiceSize,
      damageTypeTags: newDamageTypeTags,
      equipSlots: newEquipSlots,
      masterworkBonus: newMasterworkBonus,
      equippable: catalogSelected
        ? (catalogSelected.equippable ?? newSlot !== null)
        : newSlot !== null,
    };
    persist({ inventory: [...inventory, item] });
    if (!silent) showToast(`${item.name} looted`);
    setNewName("");
    setNewCategory("Misc");
    setNewQty(1);
    setNewWeight(0);
    setNewNotes("");
    setNewSlot(null);
    setNewArmorBonus(0);
    setNewWoundBonus(0);
    setNewArmorCategory(null);
    setNewShieldType(null);
    setNewArmamentTags([]);
    setNewModifierStat(null);
    setNewIsRanged(false);
    setNewDamageDiceCount(0);
    setNewDamageDiceSize(6);
    setNewDamageTypeTags([]);
    setNewEquipSlots([]);
    setNewMasterworkBonus(0);
    setCatalogSelected(null);
    setCatalogSearch("");
    setAddingItem(false);
  }

  // Derive equip-slot options for any item
  function getEquipOptions(
    item: InventoryItem,
  ): { label: string; slot: InventorySlot }[] {
    const TAG_MAP: Record<string, { label: string; slot: InventorySlot }> = {
      main_hand: { label: "Main", slot: "Main Hand" },
      off_hand: { label: "Off", slot: "Off Hand" },
      two_hands: { label: "2H", slot: "Two Hands" },
    };
    const opts: { label: string; slot: InventorySlot }[] = [];
    for (const tag of item.equipSlots ?? []) {
      if (TAG_MAP[tag]) opts.push(TAG_MAP[tag]);
    }
    // Items named "Shield" but stored as Armor (legacy) should equip to Off Hand
    const isShieldItem =
      item.category === "Shield" || /^\s*shield\s*$/i.test(item.name);
    if (
      !isShieldItem &&
      item.category === "Armor" &&
      !opts.some((o) => o.slot === "Body")
    )
      opts.push({ label: "Body", slot: "Body" });
    if (isShieldItem && !opts.some((o) => o.slot === "Off Hand"))
      opts.push({ label: "Off", slot: "Off Hand" });
    // Weapon fallback: starting-pack weapons have equipSlots:[] but are still equippable
    if (opts.length === 0 && item.category === "Weapon") {
      const isTwoHanded =
        item.armamentTags?.some(
          (t) => t === "two_handed" || t === "two-handed",
        ) || item.traits?.some((t) => /two.?hand/i.test(t));
      if (isTwoHanded) {
        opts.push({ label: "2H", slot: "Two Hands" });
      } else {
        opts.push({ label: "Main", slot: "Main Hand" });
        opts.push({ label: "Off", slot: "Off Hand" });
      }
    }
    if (opts.length === 0 && item.slot && item.equippable) {
      const lm: Record<string, string> = {
        "Main Hand": "Main",
        "Off Hand": "Off",
        "Two Hands": "2H",
        Body: "Body",
      };
      opts.push({ label: lm[item.slot] ?? item.slot, slot: item.slot });
    }
    return opts;
  }

  // Items eligible to be equipped into a given slot.
  // Main Hand picker also surfaces 2H weapons so the user can pick them from that panel.
  function getPickerItems(targetSlot: InventorySlot): InventoryItem[] {
    return inventory.filter((item) => {
      if (item.equipped) return false;
      const opts = getEquipOptions(item);
      if (opts.some((o) => o.slot === targetSlot)) return true;
      if (
        targetSlot === "Main Hand" &&
        opts.some((o) => o.slot === "Two Hands")
      )
        return true;
      return false;
    });
  }

  const gearSlots: { label: string; slot: InventorySlot }[] = [
    { label: "Main Hand", slot: "Main Hand" },
    { label: "Off Hand", slot: "Off Hand" },
    { label: "Body", slot: "Body" },
  ];

  return (
    <div>
      {/* Temp combat modifiers */}
      {(() => {
        const tth = c.tempToHit ?? 0;
        const tdmg = c.tempDamage ?? 0;
        return (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.5rem",
              marginBottom: "0.75rem",
            }}
          >
            <TempCtrl
              label="Temp To Hit"
              value={tth}
              onDec={() => persist({ tempToHit: tth - 1 })}
              onInc={() => persist({ tempToHit: tth + 1 })}
              onClear={() => persist({ tempToHit: 0 })}
            />
            <TempCtrl
              label="Temp Damage"
              value={tdmg}
              onDec={() => persist({ tempDamage: tdmg - 1 })}
              onInc={() => persist({ tempDamage: tdmg + 1 })}
              onClear={() => persist({ tempDamage: 0 })}
            />
          </div>
        );
      })()}
      {/* AMEND-05: Non-proficiency armor penalty banner */}
      {!isArmorProficient && equippedBody && (
        <div
          style={{
            marginBottom: "0.75rem",
            padding: "0.5rem 0.875rem",
            backgroundColor: "var(--section-alert-bg)",
            border: "1px solid rgb(var(--fail-rgb) / 0.70)",
            borderRadius: "0.5rem",
            fontSize: "0.82rem",
            color: "var(--fail)",
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
          }}
        >
          ⚠ Non-Proficient Armor ({equippedBody.armorCategory}) — Total
          available AP reduced by 1 · Skill dice reduced one step (min d4)
        </div>
      )}
      {/* Equipped gear */}
      <div style={{ marginBottom: "1.25rem" }}>
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
          Equipped Gear
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "0.5rem",
          }}
        >
          {gearSlots.map(({ label, slot }) => {
            const isTwoHandedOccupied = !!(
              equippedTwoHands && slot === "Off Hand"
            );
            const displayItem = isTwoHandedOccupied
              ? equippedTwoHands
              : slot === "Main Hand"
                ? (equippedTwoHands ?? equippedMain)
                : slot === "Off Hand"
                  ? equippedOff
                  : equippedBody;
            const stats = displayItem ? weaponStats(displayItem) : null;
            const pickerOpen = pickingSlot === slot && !displayItem;
            const eligible = pickerOpen ? getPickerItems(slot) : [];
            // AMEND-05: non-proficient armor penalty applies to Body, Main Hand, Off Hand
            const penaltySlot =
              !isArmorProficient &&
              slot !== null &&
              ["Main Hand", "Off Hand", "Body"].includes(slot);
            // FEATURE-02: shield broken = pool depleted
            const isShieldSlot =
              slot === "Off Hand" && displayItem?.category === "Shield";
            const shieldBroken =
              isShieldSlot && (displayItem?.reductionPoolCurrent ?? 1) === 0;
            const slotAlert = penaltySlot || shieldBroken;
            return (
              <div key={label}>
                <div
                  data-equip-slot={slot ?? undefined}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverSlot(slot);
                  }}
                  onDragLeave={() => setDragOverSlot(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = dragItemId.current;
                    if (id) equipItem(id, slot);
                    setDragOverSlot(null);
                  }}
                  style={{
                    padding: "0.625rem 0.75rem",
                    backgroundColor:
                      dragOverSlot === slot
                        ? "var(--primary-light)"
                        : slotAlert
                          ? "var(--section-alert-bg)"
                          : displayItem
                            ? "var(--primary-light)"
                            : "var(--bg-nav)",
                    border: `1.5px solid ${dragOverSlot === slot ? "var(--primary)" : slotAlert ? "rgb(var(--fail-rgb) / 0.70)" : displayItem ? "var(--primary)" : pickerOpen ? "var(--primary)" : "var(--border)"}`,
                    borderRadius: pickerOpen ? "0.5rem 0.5rem 0 0" : "0.5rem",
                    transition: "background-color 0.12s, border-color 0.12s",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.58rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: slotAlert
                        ? "rgb(var(--fail-rgb) / 0.70)"
                        : displayItem
                          ? "var(--primary)"
                          : "var(--text-muted)",
                      fontFamily: "var(--font-heading)",
                      marginBottom: "0.3rem",
                    }}
                  >
                    {label}
                    {isTwoHandedOccupied ? " (2H)" : ""}
                    {penaltySlot ? " ⚠" : ""}
                    {shieldBroken ? " ✕ Broken" : ""}
                  </div>
                  {displayItem ? (
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: "0.25rem",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "var(--font-heading)",
                            fontWeight: 700,
                            fontSize: "0.82rem",
                            color: "var(--text)",
                            lineHeight: 1.25,
                          }}
                        >
                          {displayItem.name}
                        </span>
                        {!isTwoHandedOccupied && (
                          <button
                            onClick={() =>
                              updateItem(displayItem.id, { equipped: false })
                            }
                            style={{
                              fontSize: "0.65rem",
                              color: "var(--text-muted)",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                              flexShrink: 0,
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      {stats && (
                        <div
                          style={{
                            fontSize: "0.7rem",
                            color: "var(--primary)",
                            fontFamily: "var(--font-heading)",
                            fontWeight: 600,
                            marginTop: "0.2rem",
                          }}
                        >
                          {stats.toHit}
                          {(c.tempToHit ?? 0) !== 0 && (
                            <span style={{ opacity: 0.8 }}>
                              {(c.tempToHit ?? 0) > 0
                                ? `+${c.tempToHit}`
                                : c.tempToHit}
                            </span>
                          )}{" "}
                          · {stats.damage}
                          {(c.tempDamage ?? 0) !== 0 && (
                            <span style={{ opacity: 0.8 }}>
                              {(c.tempDamage ?? 0) > 0
                                ? `+${c.tempDamage}`
                                : c.tempDamage}
                            </span>
                          )}
                        </div>
                      )}
                      {!stats && displayItem.category === "Armor" && (
                        <div
                          style={{
                            fontSize: "0.7rem",
                            color: "var(--primary)",
                            fontFamily: "var(--font-heading)",
                            fontWeight: 600,
                            marginTop: "0.2rem",
                          }}
                        >
                          +{displayItem.armorBonus} Defense
                          {displayItem.armorCategory
                            ? ` · ${displayItem.armorCategory}`
                            : ""}
                        </div>
                      )}
                      {!stats && displayItem.category === "Shield" && (
                        <div style={{ marginTop: "0.2rem" }}>
                          <div
                            style={{
                              fontSize: "0.7rem",
                              color: shieldBroken
                                ? "rgb(var(--fail-rgb) / 0.70)"
                                : "var(--primary)",
                              fontFamily: "var(--font-heading)",
                              fontWeight: 600,
                            }}
                          >
                            +{displayItem.armorBonus ?? 0} Shield Def
                            {shieldBroken ? " (broken)" : ""}
                          </div>
                          {displayItem.reductionPoolMax != null && (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.25rem",
                                marginTop: "0.15rem",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "0.62rem",
                                  color: shieldBroken
                                    ? "rgb(var(--fail-rgb) / 0.70)"
                                    : "var(--text-muted)",
                                  fontFamily: "var(--font-heading)",
                                }}
                              >
                                Pool: {displayItem.reductionPoolCurrent ?? 0} /{" "}
                                {displayItem.reductionPoolMax}
                              </span>
                              {shieldBroken && (
                                <button
                                  onClick={() =>
                                    updateItem(displayItem.id, {
                                      reductionPoolCurrent:
                                        displayItem.reductionPoolMax,
                                    })
                                  }
                                  style={{
                                    fontSize: "0.55rem",
                                    padding: "0.05rem 0.35rem",
                                    border:
                                      "1px solid rgb(var(--fail-rgb) / 0.70)",
                                    borderRadius: "0.2rem",
                                    backgroundColor: "transparent",
                                    color: "rgb(var(--fail-rgb) / 0.70)",
                                    cursor: "pointer",
                                    fontFamily: "var(--font-heading)",
                                    fontWeight: 700,
                                  }}
                                >
                                  Repair
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => setPickingSlot(pickerOpen ? null : slot)}
                      style={{
                        fontSize: "0.75rem",
                        color: pickerOpen
                          ? "var(--primary)"
                          : "var(--text-muted)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        fontFamily: "var(--font-heading)",
                        fontWeight: 600,
                      }}
                    >
                      + Equip {pickerOpen ? "▲" : "▼"}
                    </button>
                  )}
                </div>
                {pickerOpen && (
                  <div
                    style={{
                      border: "1.5px solid var(--primary)",
                      borderTop: "none",
                      borderRadius: "0 0 0.5rem 0.5rem",
                      backgroundColor: "var(--bg-card)",
                      maxHeight: "160px",
                      overflowY: "auto",
                    }}
                  >
                    {eligible.length === 0 ? (
                      <div
                        style={{
                          padding: "0.5rem 0.75rem",
                          fontSize: "0.75rem",
                          color: "var(--text-muted)",
                          fontStyle: "italic",
                        }}
                      >
                        Nothing available for this slot
                      </div>
                    ) : (
                      eligible.map((item) => {
                        const itemOpts = getEquipOptions(item);
                        const actualSlot: InventorySlot =
                          slot === "Main Hand" &&
                          itemOpts.some((o) => o.slot === "Two Hands")
                            ? "Two Hands"
                            : slot;
                        const slotLabel =
                          actualSlot === "Two Hands" ? " (2H)" : "";
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              equipItem(item.id, actualSlot);
                              setPickingSlot(null);
                            }}
                            style={{
                              width: "100%",
                              padding: "0.375rem 0.75rem",
                              border: "none",
                              borderBottom: "1px solid var(--border)",
                              backgroundColor: "transparent",
                              cursor: "pointer",
                              textAlign: "left",
                              display: "flex",
                              gap: "0.5rem",
                              alignItems: "center",
                            }}
                          >
                            <span
                              style={{
                                fontFamily: "var(--font-heading)",
                                fontWeight: 600,
                                fontSize: "0.8rem",
                                color: "var(--text)",
                                flex: 1,
                              }}
                            >
                              {item.name}
                              {slotLabel}
                            </span>
                            <span
                              style={{
                                fontSize: "0.62rem",
                                color: "var(--text-muted)",
                              }}
                            >
                              {item.category}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {/* Body accessory slots */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "0.5rem",
            marginTop: "0.5rem",
          }}
        >
          {(
            [
              {
                slot: "Head" as InventorySlot,
                label: "Head",
                item: equippedHead,
              },
              {
                slot: "Neck" as InventorySlot,
                label: "Neck",
                item: equippedNeck,
              },
              {
                slot: "Cloak" as InventorySlot,
                label: "Cloak",
                item: equippedCloak,
              },
              {
                slot: "Gloves" as InventorySlot,
                label: "Gloves",
                item: equippedGloves,
              },
              {
                slot: "Boots" as InventorySlot,
                label: "Boots",
                item: equippedBoots,
              },
              {
                slot: "Ring" as InventorySlot,
                label: "Ring",
                item: equippedRing,
              },
            ] as {
              slot: InventorySlot;
              label: string;
              item: InventoryItem | null;
            }[]
          ).map(({ slot, label, item: accItem }) => {
            const isDragOver = dragOverSlot === slot;
            const pickerActive = pickingSlot === slot && !accItem;
            const eligiblePick = pickerActive
              ? inventory.filter((i) => !i.equipped)
              : [];
            return (
              <div key={label as string}>
                <div
                  data-equip-slot={slot ?? undefined}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverSlot(slot);
                  }}
                  onDragLeave={() => setDragOverSlot(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = dragItemId.current;
                    if (id) equipItem(id, slot);
                    setDragOverSlot(null);
                  }}
                  onClick={() => setPickingSlot(pickerActive ? null : slot)}
                  style={{
                    padding: "0.5rem 0.6rem",
                    backgroundColor:
                      isDragOver || accItem
                        ? "var(--primary-light)"
                        : "var(--bg-nav)",
                    border: `1.5px ${isDragOver ? "dashed" : "solid"} ${isDragOver || accItem || pickerActive ? "var(--primary)" : "var(--border)"}`,
                    borderRadius: pickerActive ? "0.5rem 0.5rem 0 0" : "0.5rem",
                    transition: "background-color 0.12s, border-color 0.12s",
                    cursor: "pointer",
                    minHeight: "48px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.58rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: accItem ? "var(--primary)" : "var(--text-muted)",
                      fontFamily: "var(--font-heading)",
                      marginBottom: "0.25rem",
                    }}
                  >
                    {label}
                  </div>
                  {accItem ? (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "0.25rem",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-heading)",
                          fontWeight: 700,
                          fontSize: "0.75rem",
                          color: "var(--text)",
                          lineHeight: 1.25,
                        }}
                      >
                        {accItem.name}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateItem(accItem.id, { equipped: false });
                        }}
                        style={{
                          fontSize: "0.65rem",
                          color: "var(--text-muted)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: 0,
                          flexShrink: 0,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--text-muted)",
                        fontStyle: "italic",
                      }}
                    >
                      {isDragOver ? "Drop to equip" : "Empty"}
                    </div>
                  )}
                </div>
                {pickerActive && (
                  <div
                    style={{
                      border: "1.5px solid var(--primary)",
                      borderTop: "none",
                      borderRadius: "0 0 0.5rem 0.5rem",
                      backgroundColor: "var(--bg-nav)",
                      maxHeight: "140px",
                      overflowY: "auto",
                    }}
                  >
                    {eligiblePick.length === 0 ? (
                      <div
                        style={{
                          padding: "0.5rem 0.75rem",
                          fontSize: "0.72rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        No items available
                      </div>
                    ) : (
                      eligiblePick.map((pi) => (
                        <button
                          key={pi.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            equipItem(pi.id, slot);
                            setPickingSlot(null);
                          }}
                          style={{
                            width: "100%",
                            padding: "0.375rem 0.75rem",
                            border: "none",
                            borderBottom: "1px solid var(--border)",
                            backgroundColor: "transparent",
                            cursor: "pointer",
                            textAlign: "left",
                            display: "flex",
                            gap: "0.5rem",
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "var(--font-heading)",
                              fontWeight: 600,
                              fontSize: "0.8rem",
                              color: "var(--text)",
                              flex: 1,
                            }}
                          >
                            {pi.name}
                          </span>
                          <span
                            style={{
                              fontSize: "0.62rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            {pi.category}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Currency + carry weight */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          marginBottom: "0.875rem",
          flexWrap: "wrap",
        }}
      >
        {(["gold", "silver", "copper"] as const).map((denom) => (
          <div
            key={denom}
            style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
          >
            <input
              type="number"
              min={0}
              value={c.currency?.[denom] ?? 0}
              onChange={(e) => {
                const v = Math.max(0, parseInt(e.target.value) || 0);
                persist({
                  currency: {
                    ...(c.currency ?? { gold: 0, silver: 0, copper: 0 }),
                    [denom]: v,
                  },
                });
              }}
              style={{ ...inputStyle, width: "56px", textAlign: "right" }}
            />
            <span
              style={{
                fontSize: "0.65rem",
                fontWeight: 700,
                textTransform: "uppercase",
                color: "var(--text-muted)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {denom.slice(0, 2).toUpperCase()}
            </span>
          </div>
        ))}
        <div
          style={{
            backgroundColor: "var(--card, var(--panel))",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            padding: "10px 14px 12px",
            minWidth: "120px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "10px",
              letterSpacing: "0.16em",
              textTransform: "uppercase" as const,
              color: "var(--primary)",
              marginBottom: "6px",
            }}
          >
            Carry
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
            <span
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "22px",
                fontWeight: 700,
                color: totalCarried > carryWeight ? "var(--fail)" : "var(--text)",
              }}
            >
              {totalCarried.toFixed(1)}
            </span>
            <span
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "11px",
                color: "var(--text-muted)",
              }}
            >
              / {carryWeight} lb
            </span>
          </div>
          <div
            style={{
              marginTop: "6px",
              height: "4px",
              borderRadius: "2px",
              backgroundColor: "var(--border)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min(100, carryWeight > 0 ? (totalCarried / carryWeight) * 100 : 0)}%`,
                backgroundColor: totalCarried > carryWeight ? "var(--fail)" : "var(--primary)",
                transition: "width 0.3s",
              }}
            />
          </div>
          {totalCarried > carryWeight && (
            <div
              style={{
                marginTop: "4px",
                fontSize: "10px",
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
                color: "var(--fail)",
              }}
            >
              ⚠ Over
            </div>
          )}
        </div>
      </div>

      {/* Inventory list */}
      {inventory.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
            marginBottom: "0.75rem",
          }}
        >
          {inventory.map((item) => {
            const isEditing = editingItemId === item.id;
            const equipOpts = getEquipOptions(item);
            return (
              <div key={item.id}>
                {/* Main row */}
                <div
                  draggable={item.equippable}
                  onDragStart={(e) => {
                    dragItemId.current = item.id;
                    e.dataTransfer.setData("text/plain", item.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    dragItemId.current = null;
                    setDragOverSlot(null);
                  }}
                  onTouchStart={
                    item.equippable
                      ? (e) => {
                          const t = e.touches[0];
                          touchLongPressTimer.current = setTimeout(() => {
                            startTouchDrag(
                              item.id,
                              item.name,
                              t.clientX,
                              t.clientY,
                            );
                          }, 250);
                        }
                      : undefined
                  }
                  onTouchMove={
                    item.equippable
                      ? (e) => {
                          if (!touchDragItemId.current) {
                            if (touchLongPressTimer.current) {
                              clearTimeout(touchLongPressTimer.current);
                              touchLongPressTimer.current = null;
                            }
                            return;
                          }
                          e.preventDefault();
                          const t = e.touches[0];
                          moveTouchGhost(t.clientX, t.clientY);
                        }
                      : undefined
                  }
                  onTouchEnd={
                    item.equippable
                      ? (e) => {
                          if (!touchDragItemId.current) {
                            if (touchLongPressTimer.current) {
                              clearTimeout(touchLongPressTimer.current);
                              touchLongPressTimer.current = null;
                            }
                            return;
                          }
                          const t = e.changedTouches[0];
                          endTouchDrag(t.clientX, t.clientY);
                        }
                      : undefined
                  }
                  onTouchCancel={
                    item.equippable
                      ? () => {
                          if (touchLongPressTimer.current) {
                            clearTimeout(touchLongPressTimer.current);
                            touchLongPressTimer.current = null;
                          }
                          if (touchGhostRef.current) {
                            touchGhostRef.current.remove();
                            touchGhostRef.current = null;
                          }
                          touchDragItemId.current = null;
                          dragItemId.current = null;
                          setDragOverSlot(null);
                        }
                      : undefined
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                    padding: "0.4rem 0.625rem",
                    backgroundColor: item.equipped
                      ? "var(--primary-light)"
                      : "var(--bg-nav)",
                    border: `1px solid ${item.equipped ? "var(--primary)" : "var(--border)"}`,
                    borderRadius: isEditing
                      ? "0.375rem 0.375rem 0 0"
                      : notePopoverItemId === item.id
                        ? "0.375rem 0.375rem 0 0"
                        : "0.375rem",
                    cursor: item.equippable ? "grab" : undefined,
                  }}
                >
                  {/* Name + weapon stats + traits inline */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      flex: 1,
                      minWidth: "80px",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontWeight: 700,
                        fontSize: "0.85rem",
                        color: "var(--text)",
                      }}
                    >
                      {item.name}
                    </span>
                    {(() => {
                      const ws = weaponStats(item);
                      return ws ? (
                        <span
                          style={{
                            fontSize: "0.62rem",
                            color: "var(--text-muted)",
                            fontFamily: "var(--font-heading)",
                          }}
                        >
                          {ws.toHit} · {ws.damage}{" "}
                          <span style={{ opacity: 0.7 }}>({ws.modStat})</span>
                        </span>
                      ) : null;
                    })()}
                    {item.category === "Armor" &&
                      (item.armorBonus ?? 0) > 0 && (
                        <span
                          style={{
                            fontSize: "0.62rem",
                            color: "var(--text-muted)",
                            fontFamily: "var(--font-heading)",
                          }}
                        >
                          +{item.armorBonus} Defense
                          {item.armorCategory ? ` · ${item.armorCategory}` : ""}
                          {item.armorTier ? ` · ${item.armorTier}` : ""}
                          {(item.woundBonus ?? 0) > 0
                            ? ` · +${item.woundBonus} Wounds`
                            : ""}
                        </span>
                      )}
                    {item.category === "Shield" && (
                      <span
                        style={{
                          fontSize: "0.62rem",
                          color: "var(--text-muted)",
                          fontFamily: "var(--font-heading)",
                        }}
                      >
                        {item.shieldType
                          ? `${item.shieldType} Shield`
                          : "Shield"}
                        {(item.armorBonus ?? 0) > 0
                          ? ` · +${item.armorBonus} Def`
                          : ""}
                      </span>
                    )}
                    {/* Traits badges — BUG-06 */}
                    {["Weapon", "Armor", "Shield"].includes(item.category) &&
                      (item.traits ?? []).length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "0.2rem",
                            marginTop: "0.2rem",
                          }}
                        >
                          {(item.traits ?? []).map((t) => (
                            <span
                              key={t}
                              style={{
                                fontSize: "0.58rem",
                                padding: "0.05rem 0.3rem",
                                borderRadius: "9999px",
                                backgroundColor: "var(--bg-card)",
                                color: "var(--text-muted)",
                                border: "1px solid var(--border)",
                                fontFamily: "var(--font-heading)",
                                fontWeight: 600,
                              }}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                  </div>
                  {/* Category badge */}
                  <span
                    style={{
                      fontSize: "0.6rem",
                      padding: "0.1rem 0.3rem",
                      borderRadius: "9999px",
                      backgroundColor: "var(--bg-card)",
                      color: "var(--text-muted)",
                      border: "1px solid var(--border)",
                      fontFamily: "var(--font-heading)",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.category}
                  </span>
                  {/* Qty stepper — hidden for non-stackable weapons (melee, bows, etc.) */}
                  {(() => {
                    const isNonStackWeapon =
                      item.category === "Weapon" &&
                      !/\b(throwing|javelin|dart|shuriken|sling)\b/i.test(
                        item.name,
                      );
                    if (isNonStackWeapon) return null;
                    return (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.15rem",
                        }}
                      >
                        <button
                          onClick={() =>
                            updateItem(item.id, {
                              quantity: Math.max(1, item.quantity - 1),
                            })
                          }
                          style={{
                            width: "16px",
                            height: "16px",
                            borderRadius: "50%",
                            border: "1px solid var(--border)",
                            backgroundColor: "var(--bg-card)",
                            cursor: "pointer",
                            fontSize: "0.7rem",
                            color: "var(--text-muted)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          −
                        </button>
                        <span
                          style={{
                            minWidth: "20px",
                            textAlign: "center",
                            fontWeight: 700,
                            color: "var(--text)",
                            fontSize: "0.75rem",
                          }}
                        >
                          ×{item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateItem(item.id, {
                              quantity: item.quantity + 1,
                            })
                          }
                          style={{
                            width: "16px",
                            height: "16px",
                            borderRadius: "50%",
                            border: "1px solid var(--border)",
                            backgroundColor: "var(--bg-card)",
                            cursor: "pointer",
                            fontSize: "0.7rem",
                            color: "var(--text-muted)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          +
                        </button>
                      </div>
                    );
                  })()}
                  {/* Weight */}
                  {item.weight > 0 && (
                    <span
                      style={{
                        fontSize: "0.68rem",
                        color: "var(--text-muted)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.weight}wt
                    </span>
                  )}
                  {/* Notes icon — BUG-07 */}
                  {item.notes && (
                    <button
                      onClick={() =>
                        setNotePopoverItemId(
                          notePopoverItemId === item.id ? null : item.id,
                        )
                      }
                      title="Show notes"
                      style={{
                        padding: "0.1rem 0.25rem",
                        border: `1px solid ${notePopoverItemId === item.id ? "var(--primary)" : "var(--border)"}`,
                        borderRadius: "0.25rem",
                        backgroundColor:
                          notePopoverItemId === item.id
                            ? "var(--primary-light)"
                            : "transparent",
                        cursor: "pointer",
                        color:
                          notePopoverItemId === item.id
                            ? "var(--primary)"
                            : "var(--text-muted)",
                        fontSize: "0.68rem",
                      }}
                    >
                      📋
                    </button>
                  )}
                  {/* Equip slot pills */}
                  {equipOpts.length > 0 && (
                    <div style={{ display: "flex", gap: "0.2rem" }}>
                      {equipOpts.map(({ label, slot: targetSlot }) => {
                        const active =
                          item.equipped && item.slot === targetSlot;
                        return (
                          <button
                            key={targetSlot}
                            onClick={() =>
                              active
                                ? updateItem(item.id, { equipped: false })
                                : equipItem(item.id, targetSlot)
                            }
                            style={{
                              padding: "0.15rem 0.45rem",
                              fontSize: "0.65rem",
                              fontFamily: "var(--font-heading)",
                              fontWeight: 700,
                              borderRadius: "0.25rem",
                              border: `1.5px solid ${active ? "var(--primary)" : "var(--border)"}`,
                              backgroundColor: active
                                ? "var(--primary)"
                                : "transparent",
                              color: active ? "var(--bg)" : "var(--text-muted)",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {label}
                            {active ? " ✓" : ""}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {/* Edit + delete */}
                  <button
                    onClick={() => {
                      setEditingItemId(isEditing ? null : item.id);
                      setEditFields({ ...item });
                      setTraitInputVal("");
                    }}
                    style={{
                      padding: "0.15rem 0.3rem",
                      border: "1px solid var(--border)",
                      borderRadius: "0.25rem",
                      backgroundColor: isEditing
                        ? "var(--primary-light)"
                        : "transparent",
                      cursor: "pointer",
                      color: isEditing ? "var(--primary)" : "var(--text-muted)",
                      fontSize: "0.7rem",
                    }}
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => removeItem(item.id)}
                    style={{
                      padding: "0.15rem 0.3rem",
                      border: "1px solid var(--border)",
                      borderRadius: "0.25rem",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                      color: "var(--text-muted)",
                      fontSize: "0.7rem",
                    }}
                  >
                    ✕
                  </button>
                  <button
                    onClick={() => toggleFavorite("item", item.id)}
                    title={
                      isFavorite("item", item.id)
                        ? "Remove from Favorites"
                        : "Add to Favorites"
                    }
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      color: isFavorite("item", item.id)
                        ? "var(--primary)"
                        : "var(--text-muted)",
                      padding: "0 2px",
                      flexShrink: 0,
                      lineHeight: 1,
                    }}
                  >
                    {isFavorite("item", item.id) ? "★" : "☆"}
                  </button>
                </div>
                {/* Notes popover — BUG-07 */}
                {notePopoverItemId === item.id && item.notes && (
                  <div
                    style={{
                      padding: "0.5rem 0.75rem",
                      border: "1px solid var(--primary)",
                      borderTop: "none",
                      borderRadius: "0 0 0.375rem 0.375rem",
                      backgroundColor: "var(--primary-light)",
                      fontSize: "0.82rem",
                      color: "var(--text)",
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.5,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.6rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "var(--primary)",
                        fontFamily: "var(--font-heading)",
                        display: "block",
                        marginBottom: "0.2rem",
                      }}
                    >
                      Notes
                    </span>
                    {item.notes}
                  </div>
                )}
                {/* Edit form */}
                {isEditing && (
                  <div
                    style={{
                      padding: "0.75rem",
                      border: "1px solid var(--primary)",
                      borderTop: "none",
                      borderRadius: "0 0 0.375rem 0.375rem",
                      backgroundColor: "var(--bg-nav)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto auto auto auto",
                          gap: "0.5rem",
                          alignItems: "end",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: "0.6rem",
                              color: "var(--text-muted)",
                              marginBottom: "0.15rem",
                            }}
                          >
                            Name
                          </div>
                          <input
                            value={editFields.name ?? ""}
                            onChange={(e) =>
                              setEditFields((f) => ({
                                ...f,
                                name: e.target.value,
                              }))
                            }
                            style={{ ...inputStyle, width: "100%" }}
                          />
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: "0.6rem",
                              color: "var(--text-muted)",
                              marginBottom: "0.15rem",
                            }}
                          >
                            Category
                          </div>
                          <select
                            value={editFields.category ?? "Misc"}
                            onChange={(e) =>
                              setEditFields((f) => ({
                                ...f,
                                category: e.target.value as InventoryCategory,
                              }))
                            }
                            style={inputStyle}
                          >
                            {INVENTORY_CATEGORIES.map((cat) => (
                              <option key={cat}>{cat}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: "0.6rem",
                              color: "var(--text-muted)",
                              marginBottom: "0.15rem",
                            }}
                          >
                            Weight
                          </div>
                          <input
                            type="number"
                            value={editFields.weight ?? 0}
                            min={0}
                            step={0.1}
                            onChange={(e) =>
                              setEditFields((f) => ({
                                ...f,
                                weight: parseFloat(e.target.value) || 0,
                              }))
                            }
                            style={{ ...inputStyle, width: "55px" }}
                          />
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: "0.6rem",
                              color: "var(--text-muted)",
                              marginBottom: "0.15rem",
                            }}
                          >
                            MW Bonus
                          </div>
                          <select
                            value={editFields.masterworkBonus ?? 0}
                            onChange={(e) =>
                              setEditFields((f) => ({
                                ...f,
                                masterworkBonus: parseInt(e.target.value),
                              }))
                            }
                            style={{ ...inputStyle, width: "65px" }}
                          >
                            <option value={0}>None</option>
                            <option value={1}>+1</option>
                            <option value={2}>+2</option>
                            <option value={3}>+3</option>
                          </select>
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: "0.6rem",
                              color: "var(--text-muted)",
                              marginBottom: "0.15rem",
                            }}
                          >
                            Slot
                          </div>
                          <select
                            value={editFields.slot ?? ""}
                            onChange={(e) =>
                              setEditFields((f) => ({
                                ...f,
                                slot: (e.target.value || null) as InventorySlot,
                              }))
                            }
                            style={inputStyle}
                          >
                            <option value="">None</option>
                            <option value="Main Hand">Main Hand</option>
                            <option value="Off Hand">Off Hand</option>
                            <option value="Two Hands">Two Hands</option>
                            <option value="Body">Body</option>
                          </select>
                        </div>
                      </div>
                      {editFields.category === "Armor" && (
                        <div
                          style={{
                            display: "flex",
                            gap: "0.5rem",
                            alignItems: "end",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: "0.6rem",
                                color: "var(--text-muted)",
                                marginBottom: "0.15rem",
                              }}
                            >
                              Armor Category
                            </div>
                            <select
                              value={editFields.armorCategory ?? ""}
                              onChange={(e) =>
                                setEditFields((f) => ({
                                  ...f,
                                  armorCategory: (e.target.value || null) as
                                    | "Light"
                                    | "Medium"
                                    | "Heavy"
                                    | null,
                                }))
                              }
                              style={inputStyle}
                            >
                              <option value="">—</option>
                              <option value="Light">Light</option>
                              <option value="Medium">Medium</option>
                              <option value="Heavy">Heavy</option>
                            </select>
                          </div>
                          <div>
                            <div
                              style={{
                                fontSize: "0.6rem",
                                color: "var(--text-muted)",
                                marginBottom: "0.15rem",
                              }}
                            >
                              Armor Bonus
                            </div>
                            <input
                              type="number"
                              value={editFields.armorBonus ?? 0}
                              min={0}
                              max={10}
                              onChange={(e) =>
                                setEditFields((f) => ({
                                  ...f,
                                  armorBonus: parseInt(e.target.value) || 0,
                                }))
                              }
                              style={{ ...inputStyle, width: "55px" }}
                            />
                          </div>
                          <div>
                            <div
                              style={{
                                fontSize: "0.6rem",
                                color: "var(--text-muted)",
                                marginBottom: "0.15rem",
                              }}
                            >
                              Wound Bonus
                            </div>
                            <input
                              type="number"
                              value={editFields.woundBonus ?? 0}
                              min={0}
                              max={10}
                              onChange={(e) =>
                                setEditFields((f) => ({
                                  ...f,
                                  woundBonus: parseInt(e.target.value) || 0,
                                }))
                              }
                              style={{ ...inputStyle, width: "55px" }}
                            />
                          </div>
                        </div>
                      )}
                      {editFields.category === "Weapon" && (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.5rem",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              gap: "0.5rem",
                              alignItems: "end",
                              flexWrap: "wrap",
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontSize: "0.6rem",
                                  color: "var(--text-muted)",
                                  marginBottom: "0.15rem",
                                }}
                              >
                                Modifier Stat
                              </div>
                              <select
                                value={editFields.modifierStat ?? ""}
                                onChange={(e) =>
                                  setEditFields((f) => ({
                                    ...f,
                                    modifierStat: (e.target.value || null) as
                                      | "brawn"
                                      | "finesse"
                                      | "mind"
                                      | "will"
                                      | null,
                                  }))
                                }
                                style={{ ...inputStyle, width: "70px" }}
                              >
                                <option value="">—</option>
                                <option value="brawn">Brawn</option>
                                <option value="finesse">Finesse</option>
                                <option value="mind">Mind</option>
                                <option value="will">Will</option>
                              </select>
                            </div>
                            <div>
                              <div
                                style={{
                                  fontSize: "0.6rem",
                                  color: "var(--text-muted)",
                                  marginBottom: "0.15rem",
                                }}
                              >
                                Dice
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  gap: "0.2rem",
                                  alignItems: "center",
                                }}
                              >
                                <input
                                  type="number"
                                  value={editFields.damageDiceCount ?? 0}
                                  min={0}
                                  max={20}
                                  onChange={(e) =>
                                    setEditFields((f) => ({
                                      ...f,
                                      damageDiceCount:
                                        parseInt(e.target.value) || 0,
                                    }))
                                  }
                                  style={{ ...inputStyle, width: "40px" }}
                                />
                                <span
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "var(--text-muted)",
                                  }}
                                >
                                  d
                                </span>
                                <select
                                  value={editFields.damageDiceSize ?? 6}
                                  onChange={(e) =>
                                    setEditFields((f) => ({
                                      ...f,
                                      damageDiceSize: parseInt(e.target.value),
                                    }))
                                  }
                                  style={{ ...inputStyle, width: "55px" }}
                                >
                                  {[4, 6, 8, 10, 12, 20].map((d) => (
                                    <option key={d} value={d}>
                                      d{d}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div>
                              <div
                                style={{
                                  fontSize: "0.6rem",
                                  color: "var(--text-muted)",
                                  marginBottom: "0.15rem",
                                }}
                              >
                                MW Rank
                              </div>
                              <select
                                value={editFields.masterworkBonus ?? 0}
                                onChange={(e) =>
                                  setEditFields((f) => ({
                                    ...f,
                                    masterworkBonus: parseInt(e.target.value),
                                  }))
                                }
                                style={{ ...inputStyle, width: "80px" }}
                              >
                                <option value={0}>None</option>
                                <option value={1}>Superior (+1)</option>
                                <option value={2}>Mastered (+2)</option>
                                <option value={3}>Fabled (+3)</option>
                              </select>
                            </div>
                            <div style={{ paddingBottom: "0.15rem" }}>
                              <label
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.3rem",
                                  cursor: "pointer",
                                  fontSize: "0.75rem",
                                  color: "var(--text-muted)",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={editFields.isRanged ?? false}
                                  onChange={(e) =>
                                    setEditFields((f) => ({
                                      ...f,
                                      isRanged: e.target.checked,
                                    }))
                                  }
                                />
                                Ranged
                              </label>
                            </div>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: "1rem",
                              flexWrap: "wrap",
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontSize: "0.6rem",
                                  color: "var(--text-muted)",
                                  marginBottom: "0.2rem",
                                }}
                              >
                                Armament Type
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  gap: "0.35rem",
                                  flexWrap: "wrap",
                                }}
                              >
                                {(
                                  [
                                    "simple",
                                    "martial",
                                    "finesse",
                                    "ranged",
                                    "catalyst",
                                    "defensive",
                                  ] as const
                                ).map((tag) => {
                                  const active = (
                                    editFields.armamentTags ?? []
                                  ).includes(tag);
                                  return (
                                    <button
                                      key={tag}
                                      type="button"
                                      onClick={() =>
                                        setEditFields((f) => ({
                                          ...f,
                                          armamentTags: active
                                            ? (f.armamentTags ?? []).filter(
                                                (t) => t !== tag,
                                              )
                                            : [...(f.armamentTags ?? []), tag],
                                        }))
                                      }
                                      style={{
                                        padding: "0.1rem 0.4rem",
                                        fontSize: "0.65rem",
                                        fontFamily: "var(--font-heading)",
                                        fontWeight: 600,
                                        borderRadius: "9999px",
                                        border: `1.5px solid ${active ? "var(--primary)" : "var(--border)"}`,
                                        backgroundColor: active
                                          ? "var(--primary-light)"
                                          : "transparent",
                                        color: active
                                          ? "var(--primary)"
                                          : "var(--text-muted)",
                                        cursor: "pointer",
                                        textTransform: "capitalize",
                                      }}
                                    >
                                      {tag}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div>
                              <div
                                style={{
                                  fontSize: "0.6rem",
                                  color: "var(--text-muted)",
                                  marginBottom: "0.2rem",
                                }}
                              >
                                Damage Type
                              </div>
                              <div style={{ display: "flex", gap: "0.35rem" }}>
                                {(["puncture", "slash", "blunt"] as const).map(
                                  (tag) => {
                                    const active = (
                                      editFields.damageTypeTags ?? []
                                    ).includes(tag);
                                    return (
                                      <button
                                        key={tag}
                                        type="button"
                                        onClick={() =>
                                          setEditFields((f) => ({
                                            ...f,
                                            damageTypeTags: active
                                              ? (f.damageTypeTags ?? []).filter(
                                                  (t) => t !== tag,
                                                )
                                              : [
                                                  ...(f.damageTypeTags ?? []),
                                                  tag,
                                                ],
                                          }))
                                        }
                                        style={{
                                          padding: "0.1rem 0.4rem",
                                          fontSize: "0.65rem",
                                          fontFamily: "var(--font-heading)",
                                          fontWeight: 600,
                                          borderRadius: "9999px",
                                          border: `1.5px solid ${active ? "var(--primary)" : "var(--border)"}`,
                                          backgroundColor: active
                                            ? "var(--primary-light)"
                                            : "transparent",
                                          color: active
                                            ? "var(--primary)"
                                            : "var(--text-muted)",
                                          cursor: "pointer",
                                          textTransform: "capitalize",
                                        }}
                                      >
                                        {tag}
                                      </button>
                                    );
                                  },
                                )}
                              </div>
                            </div>
                            <div>
                              <div
                                style={{
                                  fontSize: "0.6rem",
                                  color: "var(--text-muted)",
                                  marginBottom: "0.2rem",
                                }}
                              >
                                Equip Slots
                              </div>
                              <div style={{ display: "flex", gap: "0.35rem" }}>
                                {[
                                  { tag: "main_hand", label: "Main Hand" },
                                  { tag: "off_hand", label: "Off Hand" },
                                  { tag: "two_hands", label: "2H" },
                                ].map(({ tag, label }) => {
                                  const active = (
                                    editFields.equipSlots ?? []
                                  ).includes(tag);
                                  return (
                                    <button
                                      key={tag}
                                      type="button"
                                      onClick={() =>
                                        setEditFields((f) => ({
                                          ...f,
                                          equipSlots: active
                                            ? (f.equipSlots ?? []).filter(
                                                (t) => t !== tag,
                                              )
                                            : [...(f.equipSlots ?? []), tag],
                                        }))
                                      }
                                      style={{
                                        padding: "0.1rem 0.4rem",
                                        fontSize: "0.65rem",
                                        fontFamily: "var(--font-heading)",
                                        fontWeight: 600,
                                        borderRadius: "9999px",
                                        border: `1.5px solid ${active ? "var(--primary)" : "var(--border)"}`,
                                        backgroundColor: active
                                          ? "var(--primary-light)"
                                          : "transparent",
                                        color: active
                                          ? "var(--primary)"
                                          : "var(--text-muted)",
                                        cursor: "pointer",
                                      }}
                                    >
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Shield-specific fields — BUG-06 */}
                      {editFields.category === "Shield" && (
                        <div
                          style={{
                            display: "flex",
                            gap: "0.5rem",
                            alignItems: "end",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: "0.6rem",
                                color: "var(--text-muted)",
                                marginBottom: "0.15rem",
                              }}
                            >
                              Shield Type
                            </div>
                            <select
                              value={editFields.shieldType ?? ""}
                              onChange={(e) =>
                                setEditFields((f) => ({
                                  ...f,
                                  shieldType: (e.target.value || null) as
                                    | "Temporary"
                                    | "Light"
                                    | "Medium"
                                    | "Heavy"
                                    | null,
                                }))
                              }
                              style={inputStyle}
                            >
                              <option value="">—</option>
                              <option value="Temporary">Temporary</option>
                              <option value="Light">Light</option>
                              <option value="Medium">Medium</option>
                              <option value="Heavy">Heavy</option>
                            </select>
                          </div>
                          <div>
                            <div
                              style={{
                                fontSize: "0.6rem",
                                color: "var(--text-muted)",
                                marginBottom: "0.15rem",
                              }}
                            >
                              Shield Bonus
                            </div>
                            <input
                              type="number"
                              value={editFields.armorBonus ?? 0}
                              min={0}
                              max={10}
                              onChange={(e) =>
                                setEditFields((f) => ({
                                  ...f,
                                  armorBonus: parseInt(e.target.value) || 0,
                                }))
                              }
                              style={{ ...inputStyle, width: "60px" }}
                            />
                          </div>
                        </div>
                      )}
                      {/* Traits editor for Weapon/Armor/Shield — BUG-06 */}
                      {["Weapon", "Armor", "Shield"].includes(
                        editFields.category ?? "",
                      ) && (
                        <div>
                          <div
                            style={{
                              fontSize: "0.6rem",
                              color: "var(--text-muted)",
                              marginBottom: "0.2rem",
                            }}
                          >
                            Traits
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "0.25rem",
                              marginBottom: "0.3rem",
                            }}
                          >
                            {(editFields.traits ?? []).length === 0 && (
                              <span
                                style={{
                                  fontSize: "0.7rem",
                                  color: "var(--text-muted)",
                                  fontStyle: "italic",
                                }}
                              >
                                No traits
                              </span>
                            )}
                            {(editFields.traits ?? []).map((t) => (
                              <span
                                key={t}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.2rem",
                                  fontSize: "0.65rem",
                                  padding: "0.1rem 0.35rem",
                                  borderRadius: "9999px",
                                  backgroundColor: "var(--bg-nav)",
                                  color: "var(--text)",
                                  border: "1px solid var(--border)",
                                  fontFamily: "var(--font-heading)",
                                  fontWeight: 600,
                                }}
                              >
                                {t}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditFields((f) => ({
                                      ...f,
                                      traits: (f.traits ?? []).filter(
                                        (x) => x !== t,
                                      ),
                                    }))
                                  }
                                  style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "var(--text-muted)",
                                    fontSize: "0.6rem",
                                    padding: 0,
                                    lineHeight: 1,
                                  }}
                                >
                                  ✕
                                </button>
                              </span>
                            ))}
                          </div>
                          <div style={{ display: "flex", gap: "0.3rem" }}>
                            <input
                              value={traitInputVal}
                              onChange={(e) => setTraitInputVal(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && traitInputVal.trim()) {
                                  e.preventDefault();
                                  const t = traitInputVal.trim();
                                  setEditFields((f) => ({
                                    ...f,
                                    traits: [
                                      ...new Set([...(f.traits ?? []), t]),
                                    ],
                                  }));
                                  setTraitInputVal("");
                                }
                              }}
                              placeholder="Add trait…"
                              style={{
                                ...inputStyle,
                                flex: 1,
                                fontSize: "0.75rem",
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const t = traitInputVal.trim();
                                if (!t) return;
                                setEditFields((f) => ({
                                  ...f,
                                  traits: [
                                    ...new Set([...(f.traits ?? []), t]),
                                  ],
                                }));
                                setTraitInputVal("");
                              }}
                              style={{
                                padding: "0.3rem 0.6rem",
                                border: "none",
                                borderRadius: "0.25rem",
                                backgroundColor: "var(--primary)",
                                color: "var(--text-on-primary)",
                                cursor: "pointer",
                                fontFamily: "var(--font-heading)",
                                fontWeight: 600,
                                fontSize: "0.72rem",
                              }}
                            >
                              + Add
                            </button>
                          </div>
                        </div>
                      )}
                      <div>
                        <div
                          style={{
                            fontSize: "0.6rem",
                            color: "var(--text-muted)",
                            marginBottom: "0.15rem",
                          }}
                        >
                          Notes
                        </div>
                        <input
                          value={editFields.notes ?? ""}
                          onChange={(e) =>
                            setEditFields((f) => ({
                              ...f,
                              notes: e.target.value,
                            }))
                          }
                          placeholder="Optional…"
                          style={{ ...inputStyle, width: "100%" }}
                        />
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          onClick={() => {
                            updateItem(item.id, editFields);
                            setEditingItemId(null);
                          }}
                          style={{
                            padding: "0.3rem 0.75rem",
                            backgroundColor: "var(--primary)",
                            color: "var(--text-on-primary)",
                            border: "none",
                            borderRadius: "0.25rem",
                            cursor: "pointer",
                            fontFamily: "var(--font-heading)",
                            fontWeight: 600,
                            fontSize: "0.8rem",
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingItemId(null)}
                          style={{
                            padding: "0.3rem 0.75rem",
                            backgroundColor: "transparent",
                            color: "var(--text-muted)",
                            border: "1px solid var(--border)",
                            borderRadius: "0.25rem",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add item */}
      {!addingItem ? (
        <button
          onClick={() => setAddingItem(true)}
          style={{
            padding: "0.4rem 0.875rem",
            border: "1.5px dashed var(--border)",
            borderRadius: "0.375rem",
            backgroundColor: "transparent",
            cursor: "pointer",
            color: "var(--primary)",
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: "0.8rem",
          }}
        >
          + Add Item
        </button>
      ) : (
        <div
          style={{
            padding: "0.875rem",
            backgroundColor: "var(--bg-nav)",
            border: "1px solid var(--border)",
            borderRadius: "0.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <div
            style={{
              fontSize: "0.65rem",
              fontWeight: 700,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              fontFamily: "var(--font-heading)",
            }}
          >
            Add Item
          </div>

          {/* Catalog search (Issue 9) */}
          <div>
            <div
              style={{
                fontSize: "0.6rem",
                color: "var(--text-muted)",
                marginBottom: "0.25rem",
              }}
            >
              Search catalog
            </div>
            <input
              value={catalogSearch}
              onChange={(e) => {
                setCatalogSearch(e.target.value);
                setCatalogSelected(null);
              }}
              placeholder="Search weapons, armor, kits…"
              style={{
                ...inputStyle,
                width: "100%",
                marginBottom: "0.375rem",
              }}
            />
            {catalogSearch.trim() && (
              <div
                style={{
                  maxHeight: "160px",
                  overflowY: "auto",
                  border: "1px solid var(--border)",
                  borderRadius: "0.375rem",
                  backgroundColor: "var(--bg-card)",
                }}
              >
                {filteredCatalog.length === 0 ? (
                  <div
                    style={{
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.8rem",
                      color: "var(--text-muted)",
                      fontStyle: "italic",
                    }}
                  >
                    No results — use manual entry below
                  </div>
                ) : (
                  filteredCatalog.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => selectCatalogItem(item)}
                      style={{
                        width: "100%",
                        padding: "0.4rem 0.75rem",
                        border: "none",
                        borderBottom: "1px solid var(--border)",
                        backgroundColor:
                          catalogSelected?.id === item.id
                            ? "var(--primary-light)"
                            : "transparent",
                        cursor: "pointer",
                        textAlign: "left",
                        display: "flex",
                        gap: "0.5rem",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-heading)",
                          fontWeight: 600,
                          fontSize: "0.825rem",
                          color: "var(--text)",
                        }}
                      >
                        {item.name}
                      </span>
                      <span
                        style={{
                          fontSize: "0.65rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        {item.category}
                      </span>
                      {item.traits.length > 0 && (
                        <span
                          style={{
                            fontSize: "0.62rem",
                            color: "var(--text-muted)",
                            fontStyle: "italic",
                          }}
                        >
                          {item.traits.join(", ")}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Manual / prefilled fields */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto auto",
              gap: "0.5rem",
              alignItems: "end",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.6rem",
                  color: "var(--text-muted)",
                  marginBottom: "0.2rem",
                }}
              >
                Name *
              </div>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Item name…"
                style={{ ...inputStyle, width: "100%" }}
                onKeyDown={(e) => e.key === "Enter" && addItem()}
                autoFocus={!catalogSearch}
              />
            </div>
            <div>
              <div
                style={{
                  fontSize: "0.6rem",
                  color: "var(--text-muted)",
                  marginBottom: "0.2rem",
                }}
              >
                Category
              </div>
              <select
                value={newCategory}
                onChange={(e) =>
                  setNewCategory(e.target.value as InventoryCategory)
                }
                style={inputStyle}
              >
                {INVENTORY_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <div
                style={{
                  fontSize: "0.6rem",
                  color: "var(--text-muted)",
                  marginBottom: "0.2rem",
                }}
              >
                Qty
              </div>
              <input
                type="number"
                value={newQty}
                min={1}
                onChange={(e) =>
                  setNewQty(Math.max(1, parseInt(e.target.value) || 1))
                }
                style={{ ...inputStyle, width: "55px" }}
              />
            </div>
            <div>
              <div
                style={{
                  fontSize: "0.6rem",
                  color: "var(--text-muted)",
                  marginBottom: "0.2rem",
                }}
              >
                Weight
              </div>
              <input
                type="number"
                value={newWeight}
                min={0}
                step={0.1}
                onChange={(e) => setNewWeight(parseFloat(e.target.value) || 0)}
                style={{ ...inputStyle, width: "55px" }}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "end" }}>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "0.6rem",
                  color: "var(--text-muted)",
                  marginBottom: "0.2rem",
                }}
              >
                Notes
              </div>
              <input
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Optional…"
                style={{ ...inputStyle, width: "100%" }}
              />
            </div>
            <div>
              <div
                style={{
                  fontSize: "0.6rem",
                  color: "var(--text-muted)",
                  marginBottom: "0.2rem",
                }}
              >
                Slot
              </div>
              <select
                value={newSlot ?? ""}
                onChange={(e) =>
                  setNewSlot((e.target.value || null) as InventorySlot)
                }
                style={inputStyle}
              >
                <option value="">None</option>
                <option value="Main Hand">Main Hand</option>
                <option value="Off Hand">Off Hand</option>
                <option value="Two Hands">Two Hands</option>
                <option value="Body">Body</option>
              </select>
            </div>
          </div>
          {newCategory === "Armor" && (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "end" }}>
              <div>
                <div
                  style={{
                    fontSize: "0.6rem",
                    color: "var(--text-muted)",
                    marginBottom: "0.2rem",
                  }}
                >
                  Armor Category
                </div>
                <select
                  value={newArmorCategory ?? ""}
                  onChange={(e) =>
                    setNewArmorCategory(
                      (e.target.value || null) as
                        | "Light"
                        | "Medium"
                        | "Heavy"
                        | null,
                    )
                  }
                  style={inputStyle}
                >
                  <option value="">—</option>
                  <option value="Light">Light</option>
                  <option value="Medium">Medium</option>
                  <option value="Heavy">Heavy</option>
                </select>
              </div>
              <div>
                <div
                  style={{
                    fontSize: "0.6rem",
                    color: "var(--text-muted)",
                    marginBottom: "0.2rem",
                  }}
                >
                  Armor Bonus
                </div>
                <input
                  type="number"
                  value={newArmorBonus}
                  min={0}
                  max={10}
                  onChange={(e) =>
                    setNewArmorBonus(parseInt(e.target.value) || 0)
                  }
                  style={{ ...inputStyle, width: "55px" }}
                />
              </div>
              <div>
                <div
                  style={{
                    fontSize: "0.6rem",
                    color: "var(--text-muted)",
                    marginBottom: "0.2rem",
                  }}
                >
                  Wound Bonus
                </div>
                <input
                  type="number"
                  value={newWoundBonus}
                  min={0}
                  max={10}
                  onChange={(e) =>
                    setNewWoundBonus(parseInt(e.target.value) || 0)
                  }
                  style={{ ...inputStyle, width: "55px" }}
                />
              </div>
            </div>
          )}
          {newCategory === "Shield" && (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "end" }}>
              <div>
                <div
                  style={{
                    fontSize: "0.6rem",
                    color: "var(--text-muted)",
                    marginBottom: "0.2rem",
                  }}
                >
                  Shield Type
                </div>
                <select
                  value={newShieldType ?? ""}
                  onChange={(e) =>
                    setNewShieldType(
                      (e.target.value || null) as
                        | "Temporary"
                        | "Light"
                        | "Medium"
                        | "Heavy"
                        | null,
                    )
                  }
                  style={inputStyle}
                >
                  <option value="">—</option>
                  <option value="Temporary">Temporary</option>
                  <option value="Light">Light</option>
                  <option value="Medium">Medium</option>
                  <option value="Heavy">Heavy</option>
                </select>
              </div>
              <div>
                <div
                  style={{
                    fontSize: "0.6rem",
                    color: "var(--text-muted)",
                    marginBottom: "0.2rem",
                  }}
                >
                  Shield Bonus
                </div>
                <input
                  type="number"
                  value={newArmorBonus}
                  min={0}
                  max={10}
                  onChange={(e) =>
                    setNewArmorBonus(parseInt(e.target.value) || 0)
                  }
                  style={{ ...inputStyle, width: "55px" }}
                />
              </div>
            </div>
          )}
          {newCategory === "Weapon" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  alignItems: "end",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "0.6rem",
                      color: "var(--text-muted)",
                      marginBottom: "0.2rem",
                    }}
                  >
                    Modifier Stat
                  </div>
                  <select
                    value={newModifierStat ?? ""}
                    onChange={(e) =>
                      setNewModifierStat(
                        (e.target.value || null) as
                          | "brawn"
                          | "finesse"
                          | "mind"
                          | "will"
                          | null,
                      )
                    }
                    style={{ ...inputStyle, width: "70px" }}
                  >
                    <option value="">—</option>
                    <option value="brawn">Brawn</option>
                    <option value="finesse">Finesse</option>
                    <option value="mind">Mind</option>
                    <option value="will">Will</option>
                  </select>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "0.6rem",
                      color: "var(--text-muted)",
                      marginBottom: "0.2rem",
                    }}
                  >
                    Dice
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "0.2rem",
                      alignItems: "center",
                    }}
                  >
                    <input
                      type="number"
                      value={newDamageDiceCount}
                      min={0}
                      max={20}
                      onChange={(e) =>
                        setNewDamageDiceCount(parseInt(e.target.value) || 0)
                      }
                      style={{ ...inputStyle, width: "40px" }}
                    />
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      d
                    </span>
                    <select
                      value={newDamageDiceSize}
                      onChange={(e) =>
                        setNewDamageDiceSize(parseInt(e.target.value))
                      }
                      style={{ ...inputStyle, width: "55px" }}
                    >
                      {[4, 6, 8, 10, 12, 20].map((d) => (
                        <option key={d} value={d}>
                          d{d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "0.6rem",
                      color: "var(--text-muted)",
                      marginBottom: "0.2rem",
                    }}
                  >
                    MW Rank
                  </div>
                  <select
                    value={newMasterworkBonus}
                    onChange={(e) =>
                      setNewMasterworkBonus(parseInt(e.target.value))
                    }
                    style={{ ...inputStyle, width: "80px" }}
                  >
                    <option value={0}>None</option>
                    <option value={1}>Superior (+1)</option>
                    <option value={2}>Mastered (+2)</option>
                    <option value={3}>Fabled (+3)</option>
                  </select>
                </div>
                <div style={{ paddingBottom: "0.2rem" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.3rem",
                      cursor: "pointer",
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={newIsRanged}
                      onChange={(e) => setNewIsRanged(e.target.checked)}
                    />
                    Ranged
                  </label>
                </div>
              </div>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <div>
                  <div
                    style={{
                      fontSize: "0.6rem",
                      color: "var(--text-muted)",
                      marginBottom: "0.2rem",
                    }}
                  >
                    Armament Type
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "0.3rem",
                      flexWrap: "wrap",
                    }}
                  >
                    {(
                      [
                        "simple",
                        "martial",
                        "finesse",
                        "ranged",
                        "catalyst",
                        "defensive",
                      ] as const
                    ).map((tag) => {
                      const active = newArmamentTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() =>
                            setNewArmamentTags((prev) =>
                              active
                                ? prev.filter((t) => t !== tag)
                                : [...prev, tag],
                            )
                          }
                          style={{
                            padding: "0.1rem 0.4rem",
                            fontSize: "0.65rem",
                            fontFamily: "var(--font-heading)",
                            fontWeight: 600,
                            borderRadius: "9999px",
                            border: `1.5px solid ${active ? "var(--primary)" : "var(--border)"}`,
                            backgroundColor: active
                              ? "var(--primary-light)"
                              : "transparent",
                            color: active
                              ? "var(--primary)"
                              : "var(--text-muted)",
                            cursor: "pointer",
                            textTransform: "capitalize",
                          }}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "0.6rem",
                      color: "var(--text-muted)",
                      marginBottom: "0.2rem",
                    }}
                  >
                    Damage Type
                  </div>
                  <div style={{ display: "flex", gap: "0.3rem" }}>
                    {(["puncture", "slash", "blunt"] as const).map((tag) => {
                      const active = newDamageTypeTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() =>
                            setNewDamageTypeTags((prev) =>
                              active
                                ? prev.filter((t) => t !== tag)
                                : [...prev, tag],
                            )
                          }
                          style={{
                            padding: "0.1rem 0.4rem",
                            fontSize: "0.65rem",
                            fontFamily: "var(--font-heading)",
                            fontWeight: 600,
                            borderRadius: "9999px",
                            border: `1.5px solid ${active ? "var(--primary)" : "var(--border)"}`,
                            backgroundColor: active
                              ? "var(--primary-light)"
                              : "transparent",
                            color: active
                              ? "var(--primary)"
                              : "var(--text-muted)",
                            cursor: "pointer",
                            textTransform: "capitalize",
                          }}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "0.6rem",
                      color: "var(--text-muted)",
                      marginBottom: "0.2rem",
                    }}
                  >
                    Equip Slots
                  </div>
                  <div style={{ display: "flex", gap: "0.3rem" }}>
                    {[
                      { tag: "main_hand", label: "Main Hand" },
                      { tag: "off_hand", label: "Off Hand" },
                      { tag: "two_hands", label: "2H" },
                    ].map(({ tag, label }) => {
                      const active = newEquipSlots.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() =>
                            setNewEquipSlots((prev) =>
                              active
                                ? prev.filter((t) => t !== tag)
                                : [...prev, tag],
                            )
                          }
                          style={{
                            padding: "0.1rem 0.4rem",
                            fontSize: "0.65rem",
                            fontFamily: "var(--font-heading)",
                            fontWeight: 600,
                            borderRadius: "9999px",
                            border: `1.5px solid ${active ? "var(--primary)" : "var(--border)"}`,
                            backgroundColor: active
                              ? "var(--primary-light)"
                              : "transparent",
                            color: active
                              ? "var(--primary)"
                              : "var(--text-muted)",
                            cursor: "pointer",
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
          {(() => {
            const itemCost = catalogSelected?.cost ?? 0;
            const cur = c.currency ?? { gold: 0, silver: 0, copper: 0 };
            const totalGp = cur.gold + cur.silver / 10 + cur.copper / 100;
            const canAfford = totalGp >= itemCost;
            return (
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <button
                  onClick={() => addItem()}
                  disabled={!newName.trim()}
                  style={{
                    padding: "0.375rem 0.875rem",
                    backgroundColor: newName.trim()
                      ? "var(--primary)"
                      : "var(--border)",
                    color: "var(--text-on-primary)",
                    border: "none",
                    borderRadius: "0.375rem",
                    cursor: newName.trim() ? "pointer" : "not-allowed",
                    fontFamily: "var(--font-heading)",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                  }}
                >
                  + LOOT
                </button>
                {itemCost > 0 && (
                  <button
                    onClick={() => {
                      if (!canAfford) return;
                      // Deduct cost in gold (simplest: subtract from gold, borrow from silver/copper if needed)
                      let remaining = itemCost;
                      let g = cur.gold,
                        sv = cur.silver,
                        cp = cur.copper;
                      if (g >= remaining) {
                        g -= remaining;
                      } else {
                        remaining -= g;
                        g = 0;
                        const svNeeded = Math.ceil(remaining * 10);
                        if (sv >= svNeeded) {
                          sv -= svNeeded;
                        } else {
                          remaining -= sv / 10;
                          sv = 0;
                          cp = Math.max(0, cp - Math.ceil(remaining * 100));
                        }
                      }
                      persist({
                        currency: {
                          gold: Math.max(0, g),
                          silver: Math.max(0, sv),
                          copper: Math.max(0, cp),
                        },
                      });
                      addItem(true);
                      showToast(
                        `Bought ${newName.trim()} · −${itemCost} gp`,
                        "success",
                      );
                    }}
                    disabled={!newName.trim() || !canAfford}
                    title={
                      canAfford ? `Spend ${itemCost} gp` : "Not enough gold"
                    }
                    style={{
                      padding: "0.375rem 0.875rem",
                      backgroundColor:
                        canAfford && newName.trim()
                          ? "rgb(var(--gold-rgb) / 0.15)"
                          : "transparent",
                      color:
                        canAfford && newName.trim()
                          ? "var(--gold)"
                          : "var(--text-muted)",
                      border: `1px solid ${canAfford && newName.trim() ? "var(--gold)" : "var(--border)"}`,
                      borderRadius: "0.375rem",
                      cursor:
                        canAfford && newName.trim() ? "pointer" : "not-allowed",
                      fontFamily: "var(--font-heading)",
                      fontWeight: 700,
                      fontSize: "0.8rem",
                      opacity: canAfford && newName.trim() ? 1 : 0.5,
                    }}
                  >
                    + BUY ({itemCost} gp)
                  </button>
                )}
                <button
                  onClick={() => {
                    setAddingItem(false);
                    setNewName("");
                    setCatalogSearch("");
                    setCatalogSelected(null);
                  }}
                  style={{
                    padding: "0.375rem 0.875rem",
                    backgroundColor: "transparent",
                    color: "var(--text-muted)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.375rem",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                  }}
                >
                  Cancel
                </button>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
