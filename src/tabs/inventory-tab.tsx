// Inventory tab: equipment slots panel (drag-and-drop), item rows (drag
// source, equip toggle, qty steppers, remove), carry bar, currency,
// add-from-catalog modal with search + category filter.

import { Fragment, useMemo, useRef, useState } from "react";
import type { CatalogItem, ComputedCharacter, InventoryItem, SlotId, StoredCharacter } from "../core/types.ts";
import { REGISTRY } from "../core/data-registry.ts";
import { computeCharacter, resolveItem } from "../core/compute.ts";
import { defaultSlotFor, equipToSlot, isTwoHanded, legalSlotsFor, unequip } from "../core/equip.ts";
import { rescaleWoundsOnThresholdChange } from "../core/damage.ts";
import { masterworkBonus } from "../core/masterwork.ts";
import { gain, spend, totalCp, type Coins } from "../core/currency.ts";
import { canRevert, forkItem, revertItem, sanitizeOnSave, type ItemEdits } from "../core/custom-item.ts";
import { CardsGrid } from "./inventory-cards.tsx";
import { ItemDetailBody, type ItemDetailCallbacks } from "./item-detail.tsx";
import { ItemEditModal } from "./item-edit-modal.tsx";

interface TabProps {
  c: ComputedCharacter;
  stored: StoredCharacter;
  setStored: (fn: (s: StoredCharacter) => StoredCharacter) => void;
  inventoryView: "list" | "cards";
  setInventoryView: (v: "list" | "cards") => void;
}

const CATEGORIES = ["All", "Weapon", "Armor", "Shield", "Kit"];
const SLOTS: SlotId[] = ["main_hand", "off_hand", "body"];
const INV_FILTERS = ["All", "Equipped", "Weapon", "Armor", "Shield", "Kit", "Starred"] as const;
type InvFilter = (typeof INV_FILTERS)[number];

const parseDelta = (v: string) => Math.abs(Number(v) || 0);
const emptyDelta = { gold: "", silver: "", copper: "" };

function slotLabel(slot: SlotId): string {
  const def = (REGISTRY.itemsDoc.slot_definitions as Record<string, { label?: string }>)[slot];
  return def?.label ?? slot;
}

function matchesInvFilter(it: InventoryItem, cat: CatalogItem | null, filter: InvFilter, favIds: Set<string>): boolean {
  switch (filter) {
    case "Equipped":
      return it.equipped || it.slot != null;
    case "Weapon":
    case "Armor":
    case "Shield":
    case "Kit":
      return cat?.category === filter;
    case "Starred":
      return favIds.has(it.catalog_item_id ?? it.id);
    default:
      return true;
  }
}

export function InventoryTab({ c, stored, setStored, inventoryView, setInventoryView }: TabProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<SlotId | null>(null);
  const [coinDrawerOpen, setCoinDrawerOpen] = useState(false);
  const [coinDelta, setCoinDelta] = useState(emptyDelta);
  const [invFilter, setInvFilter] = useState<InvFilter>("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createDraft, setCreateDraft] = useState<InventoryItem | null>(null);
  const touchGhost = useRef<HTMLDivElement | null>(null);
  const touchTimer = useRef<number | null>(null);

  const items = stored.inventory.items;

  const setItems = (next: InventoryItem[]) =>
    setStored((s) => {
      const nextStored = { ...s, inventory: { ...s.inventory, items: next } };
      const newMax = computeCharacter(nextStored, REGISTRY).wounds.max;
      return rescaleWoundsOnThresholdChange(nextStored, c.wounds.max, newMax);
    });

  const updateItem = (id: string, patch: Partial<InventoryItem>) =>
    setItems(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const removeItem = (id: string) => setItems(items.filter((it) => it.id !== id));

  // ── custom-item editor wiring (sheet-only; never writes REGISTRY/data/) ──────
  const detailCallbacks = (it: InventoryItem, cat: CatalogItem | null): ItemDetailCallbacks => ({
    onQty: (d) => updateItem(it.id, { quantity: Math.max(1, it.quantity + d) }),
    onMw: (d) =>
      cat &&
      updateItem(it.id, {
        masterwork_bonus: Math.max(0, Math.min(cat.masterwork_max ?? 0, (it.masterwork_bonus ?? 0) + d)),
      }),
    onRemove: () => removeItem(it.id),
    onEdit: () => setEditingId(it.id),
    onReductionPool: (n) => updateItem(it.id, { reduction_pool_current: n }),
  });

  const saveEdits = (it: InventoryItem, cat: CatalogItem | null, edits: ItemEdits, notes: string) => {
    updateItem(it.id, { ...sanitizeOnSave(it, forkItem(it, cat, edits), REGISTRY), notes });
    setEditingId(null);
  };
  const revert = (it: InventoryItem, cat: CatalogItem | null) => {
    updateItem(it.id, { ...revertItem(it, cat), notes: it.notes });
    setEditingId(null);
  };

  const openCreateCustom = () => {
    const draftId = `inv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    setModalOpen(false);
    setCreateDraft({
      id: draftId,
      catalog_item_id: null,
      name: "New item",
      quantity: 1,
      equipped: false,
      slot: null,
      masterwork_bonus: 0,
      medium_armor_stat: null,
      reduction_pool_current: null,
      notes: "",
      custom: forkItem(
        { id: draftId } as InventoryItem,
        null,
        { name: "New item", category: "Kit", weight: 0, cost: null },
      ),
    });
  };
  const saveCreate = (edits: ItemEdits, notes: string) => {
    const draft = createDraft!;
    const custom = forkItem(draft, null, edits);
    setItems([...items, { ...draft, custom, name: custom.name, notes }]);
    setCreateDraft(null);
  };

  const addFromCatalog = (cat: CatalogItem) =>
    setItems([
      ...items,
      {
        id: `inv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        catalog_item_id: cat.id,
        name: cat.name,
        quantity: 1,
        equipped: false,
        slot: null,
        masterwork_bonus: 0,
        medium_armor_stat: null,
        reduction_pool_current: cat.reduction_pool ?? null,
        notes: "",
        custom: null,
      },
    ]);

  const deltaCoins = (): Coins => ({
    gold: parseDelta(coinDelta.gold),
    silver: parseDelta(coinDelta.silver),
    copper: parseDelta(coinDelta.copper),
  });
  const hasDelta = Object.values(coinDelta).some((v) => parseDelta(v) > 0);

  const applyGain = () => {
    setStored((s) => ({ ...s, inventory: { ...s.inventory, currency: gain(s.inventory.currency, deltaCoins()) } }));
    setCoinDelta(emptyDelta);
  };
  const applySpend = () => {
    setStored((s) => ({ ...s, inventory: { ...s.inventory, currency: spend(s.inventory.currency, deltaCoins()) } }));
    setCoinDelta(emptyDelta);
  };
  const closeCoinDrawer = () => {
    setCoinDrawerOpen(false);
    setCoinDelta(emptyDelta);
  };
  const buyFromCatalog = (cat: CatalogItem) => {
    if (cat.cost == null) return;
    setStored((s) => ({ ...s, inventory: { ...s.inventory, currency: spend(s.inventory.currency, { gold: cat.cost!, silver: 0, copper: 0 }) } }));
    addFromCatalog(cat);
  };

  const equipToSlotId = (itemId: string, slot: SlotId) => setItems(equipToSlot(items, itemId, slot, REGISTRY));
  const unequipId = (itemId: string) => setItems(unequip(items, itemId));

  const toggleEquip = (it: InventoryItem, cat: CatalogItem | null) => {
    if (it.slot != null) {
      unequipId(it.id);
      return;
    }
    if (it.equipped) {
      updateItem(it.id, { equipped: false });
      return;
    }
    const slot = defaultSlotFor(cat, items, REGISTRY);
    if (slot) equipToSlotId(it.id, slot);
    else updateItem(it.id, { equipped: true }); // no legal slot (kit/trinket) — generic worn toggle
  };

  const favIds = useMemo(
    () => new Set(stored.play.favorites.filter((f) => f.type === "item").map((f) => f.id)),
    [stored.play.favorites],
  );
  const toggleStar = (it: InventoryItem) => {
    const favId = it.catalog_item_id ?? it.id;
    setStored((s) => {
      const exists = s.play.favorites.some((f) => f.type === "item" && f.id === favId);
      const favorites = exists
        ? s.play.favorites.filter((f) => !(f.type === "item" && f.id === favId))
        : [...s.play.favorites, { type: "item" as const, id: favId }];
      return { ...s, play: { ...s.play, favorites } };
    });
  };
  const visibleItems = items.filter((it) => matchesInvFilter(it, resolveItem(it, REGISTRY), invFilter, favIds));

  const dragCat = draggingId ? resolveItem(items.find((it) => it.id === draggingId)!, REGISTRY) : null;
  const legalDragSlots = dragCat ? legalSlotsFor(dragCat) : [];

  const handleCardDragStart = (it: InventoryItem, e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", it.id);
    e.dataTransfer.effectAllowed = "move";
    requestAnimationFrame(() => setDraggingId(it.id));
  };
  const handleCardDragEnd = () => { setDraggingId(null); setDragOverSlot(null); };

  const dropOnSlot = (slot: SlotId, itemId: string | null) => {
    setDragOverSlot(null);
    if (itemId) equipToSlotId(itemId, slot);
  };

  const handleTouchStart = (it: InventoryItem, e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchTimer.current = window.setTimeout(() => {
      setDraggingId(it.id);
      const ghost = document.createElement("div");
      ghost.textContent = it.name;
      ghost.style.cssText =
        "position:fixed;z-index:2000;pointer-events:none;background:var(--card-2);border:1px solid var(--gold-dim);" +
        "color:var(--text);padding:6px 10px;border-radius:6px;font-family:var(--serif);font-style:italic;font-size:13px;" +
        `left:${touch.clientX + 12}px;top:${touch.clientY + 12}px;`;
      document.body.appendChild(ghost);
      touchGhost.current = ghost;
    }, 150);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchGhost.current) return;
    const touch = e.touches[0];
    touchGhost.current.style.left = `${touch.clientX + 12}px`;
    touchGhost.current.style.top = `${touch.clientY + 12}px`;
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const slotEl = el?.closest("[data-equip-slot]") as HTMLElement | null;
    setDragOverSlot((slotEl?.dataset.equipSlot as SlotId) ?? null);
  };

  const handleTouchEnd = (itemId: string, e: React.TouchEvent) => {
    if (touchTimer.current) {
      window.clearTimeout(touchTimer.current);
      touchTimer.current = null;
    }
    if (touchGhost.current) {
      const touch = e.changedTouches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const slotEl = el?.closest("[data-equip-slot]") as HTMLElement | null;
      if (slotEl) equipToSlotId(itemId, slotEl.dataset.equipSlot as SlotId);
      touchGhost.current.remove();
      touchGhost.current = null;
    }
    setDraggingId(null);
    setDragOverSlot(null);
  };

  const toggleExpand = (id: string) => setExpandedId((cur) => (cur === id ? null : id));

  const over = c.carry.used > c.carry.capacity;

  return (
    <>
      <div className="list-card">
        <div className="card-header">
          <div className="card-title">Equipment Slots</div>
        </div>
        <div style={{ padding: "0 10px 10px" }}>
          <div className="equip-slots-grid">
            {SLOTS.map((slot) => {
              const item = items.find((it) => it.slot === slot);
              const cat = item ? resolveItem(item, REGISTRY) : null;
              const mainItem = items.find((it) => it.slot === "main_hand");
              const mainCat = mainItem ? resolveItem(mainItem, REGISTRY) : null;
              const occupiedByTwoHander = slot === "off_hand" && !item && isTwoHanded(mainCat);
              const isDragActive = draggingId != null && legalDragSlots.includes(slot);
              const isDragOver = dragOverSlot === slot;
              return (
                <div
                  key={slot}
                  data-equip-slot={slot}
                  className={`equip-slot${item || occupiedByTwoHander ? " filled" : ""}${isDragActive ? " drag-active" : ""}${isDragOver ? " drag-over" : ""}`}
                  onDragOver={(e) => {
                    if (!legalDragSlots.includes(slot)) return;
                    e.preventDefault();
                    setDragOverSlot(slot);
                  }}
                  onDragLeave={() => setDragOverSlot((s) => (s === slot ? null : s))}
                  onDrop={(e) => {
                    e.preventDefault();
                    dropOnSlot(slot, e.dataTransfer.getData("text/plain") || null);
                  }}
                  onClick={() => item && unequipId(item.id)}
                  style={{ cursor: item ? "pointer" : "default" }}
                >
                  <div className="equip-slot-label">{slotLabel(slot)}</div>
                  <div className="equip-slot-name">
                    {item ? item.name : occupiedByTwoHander ? "(occupied — two-handed)" : "—"}
                  </div>
                  {item && cat?.category === "Armor" && String(cat.armor_type) === "Medium" && (
                    <select
                      className="equip-slot-stat"
                      value={item.medium_armor_stat ?? "brawn"}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateItem(item.id, { medium_armor_stat: e.target.value as "brawn" | "finesse" })}
                    >
                      <option value="brawn">Brawn</option>
                      <option value="finesse">Finesse</option>
                    </select>
                  )}
                  {item && (
                    <button className="equip-slot-clear" onClick={(e) => { e.stopPropagation(); unequipId(item.id); }}>✕</button>
                  )}
                </div>
              );
            })}
            <div className="equip-slot">
              <div className="equip-slot-label">Other Worn</div>
              <div className="equip-slot-name">
                {items.filter((it) => it.slot == null && it.equipped).length || "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="list-card">
        <div className="card-header">
          <div className="card-title">Inventory</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: over ? "var(--danger)" : "var(--text-faint)" }}>
              CARRY {c.carry.used}/{c.carry.capacity}{over ? " — OVER" : ""}
            </span>
            <CoinReadout currency={stored.inventory.currency} onClick={() => setCoinDrawerOpen((o) => !o)} />
            <div className="inv-view-toggle">
              <button
                className={`inv-view-btn${inventoryView === "list" ? " active" : ""}`}
                onClick={() => setInventoryView("list")}
                title="List view"
              >
                ☰
              </button>
              <button
                className={`inv-view-btn${inventoryView === "cards" ? " active" : ""}`}
                onClick={() => setInventoryView("cards")}
                title="Cards view"
              >
                ⊞
              </button>
            </div>
            <button className="rest-btn" style={{ padding: "2px 10px" }} onClick={() => setModalOpen(true)}>
              <span className="name">+ Add item</span>
            </button>
          </div>
        </div>
        {coinDrawerOpen && (
          <CoinTxnDrawer
            delta={coinDelta}
            setDelta={setCoinDelta}
            hasDelta={hasDelta}
            onGain={applyGain}
            onSpend={applySpend}
            onClose={closeCoinDrawer}
          />
        )}
        <div className="inv-filters">
          {INV_FILTERS.map((f) => (
            <button
              key={f}
              className={`inv-filter-btn${invFilter === f ? " active" : ""}`}
              onClick={() => setInvFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        {visibleItems.length === 0 && (
          <div className="feat-row"><div className="desc">{items.length === 0 ? "Empty. Add something from the catalog." : "Nothing matches this filter."}</div></div>
        )}
        {inventoryView === "cards" ? (
          <CardsGrid
            items={visibleItems}
            favIds={favIds}
            draggingId={draggingId}
            slotLabel={slotLabel}
            detailCallbacks={detailCallbacks}
            onDragStart={handleCardDragStart}
            onDragEnd={handleCardDragEnd}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onToggleEquip={toggleEquip}
            onToggleStar={toggleStar}
          />
        ) : visibleItems.map((it) => {
          const cat = resolveItem(it, REGISTRY);
          const legal = legalSlotsFor(cat);
          const expanded = expandedId === it.id;
          const stop = (e: React.MouseEvent) => e.stopPropagation();
          return (
            <Fragment key={it.id}>
            <div
              className={`inv-row${draggingId === it.id ? " inv-dragging" : ""}${expanded ? " inv-row-open" : ""}`}
              draggable={legal.length > 0}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", it.id);
                e.dataTransfer.effectAllowed = "move";
                requestAnimationFrame(() => setDraggingId(it.id));
              }}
              onDragEnd={() => { setDraggingId(null); setDragOverSlot(null); }}
              onTouchStart={legal.length > 0 ? (e) => handleTouchStart(it, e) : undefined}
              onTouchMove={legal.length > 0 ? handleTouchMove : undefined}
              onTouchEnd={legal.length > 0 ? (e) => handleTouchEnd(it.id, e) : undefined}
              onClick={() => { if (!draggingId && !touchGhost.current) toggleExpand(it.id); }}
            >
              <div className="inv-name-cell">
                <button
                  className={`inv-chevron${expanded ? " open" : ""}`}
                  onClick={(e) => { stop(e); toggleExpand(it.id); }}
                  aria-label={expanded ? "Collapse details" : "Expand details"}
                  aria-expanded={expanded}
                >
                  ▸
                </button>
                <button className={`inv-equip-btn${it.equipped ? " equipped" : ""}`} onClick={(e) => { stop(e); toggleEquip(it, cat); }}>
                  {it.equipped ? "◉" : "○"}
                </button>
                <span className="name">
                  {it.name}
                  {cat?.category === "Armor" && cat.armor_type ? ` (${cat.armor_type})` : ""}
                </span>
                {cat?.category && <span className="inv-type-badge">{cat.category}{it.slot ? ` · ${slotLabel(it.slot)}` : ""}</span>}
                {it.custom != null && <span className="inv-type-badge inv-badge-custom">Custom</span>}
              </div>
              <span className="qty" onClick={stop}>
                <span className="pm" style={{ cursor: "pointer" }} onClick={() => updateItem(it.id, { quantity: Math.max(1, it.quantity - 1) })}>−</span>
                ×{it.quantity}
                <span className="pm" style={{ cursor: "pointer" }} onClick={() => updateItem(it.id, { quantity: it.quantity + 1 })}>+</span>
              </span>
              <span className="wt">{((cat?.weight ?? 0) * it.quantity).toFixed(1)}</span>
              <span className="qty" onClick={stop}>
                {cat?.masterwork_eligible && (cat.masterwork_max ?? 0) > 0 && (
                  <>
                    <span
                      className="pm"
                      style={{ cursor: "pointer" }}
                      onClick={() => updateItem(it.id, { masterwork_bonus: Math.max(0, (it.masterwork_bonus ?? 0) - 1) })}
                    >
                      −
                    </span>
                    MW {masterworkBonus(it, cat)}
                    <span
                      className="pm"
                      style={{ cursor: "pointer" }}
                      onClick={() =>
                        updateItem(it.id, {
                          masterwork_bonus: Math.min(cat.masterwork_max ?? 0, (it.masterwork_bonus ?? 0) + 1),
                        })
                      }
                    >
                      +
                    </span>
                  </>
                )}
              </span>
              <span className="inv-row-actions" onClick={stop}>
                <button className="inv-row-edit" onClick={() => setEditingId(it.id)} aria-label="Edit item">✎</button>
                <button className="x" onClick={() => removeItem(it.id)} aria-label="Remove item">✕</button>
              </span>
            </div>
            {expanded && (
              <div className="inv-row-detail">
                <ItemDetailBody it={it} cat={cat} slotLabel={slotLabel} {...detailCallbacks(it, cat)} />
              </div>
            )}
            </Fragment>
          );
        })}
      </div>

      {modalOpen && (
        <CatalogModal
          currency={stored.inventory.currency}
          onAdd={addFromCatalog}
          onBuy={buyFromCatalog}
          onCreateCustom={openCreateCustom}
          onClose={() => setModalOpen(false)}
        />
      )}

      {editingId != null && (() => {
        const it = items.find((i) => i.id === editingId);
        if (!it) return null;
        const cat = resolveItem(it, REGISTRY);
        const catalogName = it.catalog_item_id ? (REGISTRY.items.get(it.catalog_item_id)?.name ?? null) : null;
        return (
          <ItemEditModal
            it={it}
            cat={cat}
            mode="edit"
            canRevert={canRevert(it)}
            catalogName={catalogName}
            onSave={(e, n) => saveEdits(it, cat, e, n)}
            onRevert={() => revert(it, cat)}
            onClose={() => setEditingId(null)}
          />
        );
      })()}

      {createDraft && (
        <ItemEditModal
          it={createDraft}
          cat={createDraft.custom}
          mode="create"
          canRevert={false}
          onSave={saveCreate}
          onClose={() => setCreateDraft(null)}
        />
      )}
    </>
  );
}

function CoinReadout({ currency, onClick }: { currency: Coins; onClick: () => void }) {
  return (
    <button className="inv-coins" onClick={onClick}>
      <span className="inv-coin inv-coin--gp">
        <span className="inv-coin-val">{currency.gold.toLocaleString()}</span>
        <span className="inv-coin-lbl">gp</span>
      </span>
      {currency.silver > 0 && (
        <span className="inv-coin inv-coin--sp">
          <span className="inv-coin-val">{currency.silver.toLocaleString()}</span>
          <span className="inv-coin-lbl">sp</span>
        </span>
      )}
      {currency.copper > 0 && (
        <span className="inv-coin inv-coin--cp">
          <span className="inv-coin-val">{currency.copper.toLocaleString()}</span>
          <span className="inv-coin-lbl">cp</span>
        </span>
      )}
    </button>
  );
}

function CoinTxnDrawer({
  delta,
  setDelta,
  hasDelta,
  onGain,
  onSpend,
  onClose,
}: {
  delta: { gold: string; silver: string; copper: string };
  setDelta: (d: { gold: string; silver: string; copper: string }) => void;
  hasDelta: boolean;
  onGain: () => void;
  onSpend: () => void;
  onClose: () => void;
}) {
  return (
    <div className="inv-txn-drawer">
      <div className="inv-txn-fields">
        {(["gold", "silver", "copper"] as const).map((k) => (
          <label className="coin-txn-field" key={k}>
            <span className="coin-txn-lbl">{k === "gold" ? "gp" : k === "silver" ? "sp" : "cp"}</span>
            <input
              className="coin-txn-input"
              type="number"
              min={0}
              value={delta[k]}
              onChange={(e) => setDelta({ ...delta, [k]: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") onGain();
                else if (e.key === "Escape") onClose();
              }}
            />
          </label>
        ))}
      </div>
      <div className="inv-txn-actions">
        <button className="inv-txn-btn inv-txn-btn--gain" disabled={!hasDelta} onClick={onGain}>Gain</button>
        <button className="inv-txn-btn inv-txn-btn--spend" disabled={!hasDelta} onClick={onSpend}>Spend</button>
        <button className="inv-txn-btn inv-txn-btn--close" onClick={onClose}>✕</button>
      </div>
    </div>
  );
}

function CatalogModal({
  currency,
  onAdd,
  onBuy,
  onCreateCustom,
  onClose,
}: {
  currency: Coins;
  onAdd: (cat: CatalogItem) => void;
  onBuy: (cat: CatalogItem) => void;
  onCreateCustom: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...REGISTRY.items.values()]
      .filter((it) => !it.is_template)
      .filter((it) => category === "All" || it.category === category)
      .filter((it) => !q || it.name.toLowerCase().includes(q))
      .slice(0, 60);
  }, [query, category]);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, width: 560, maxHeight: "70vh", overflow: "auto", padding: 16 }}>
        <div className="card-header">
          <div className="card-title">Item Catalog</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button className="rest-btn" style={{ padding: "2px 8px" }} onClick={onCreateCustom}>
              <span className="name">+ Custom item</span>
            </button>
            <div className="modal-currency">
              <span className="modal-coin modal-coin--gp">
                <span className="modal-coin-val">{currency.gold.toLocaleString()}</span>
                <span className="modal-coin-lbl">gp</span>
              </span>
              {currency.silver > 0 && (
                <span className="modal-coin modal-coin--sp">
                  <span className="modal-coin-val">{currency.silver.toLocaleString()}</span>
                  <span className="modal-coin-lbl">sp</span>
                </span>
              )}
              {currency.copper > 0 && (
                <span className="modal-coin modal-coin--cp">
                  <span className="modal-coin-val">{currency.copper.toLocaleString()}</span>
                  <span className="modal-coin-lbl">cp</span>
                </span>
              )}
            </div>
            <span style={{ cursor: "pointer" }} onClick={onClose}>✕</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
          <input
            autoFocus
            placeholder="search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1, background: "var(--card-2)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px" }}
          />
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className="rest-btn"
              style={{ padding: "2px 8px", ...(category === cat ? { borderColor: "var(--gold)" } : {}) }}
              onClick={() => setCategory(cat)}
            >
              <span className="name">{cat}</span>
            </button>
          ))}
        </div>
        {results.map((it) => {
          const affordable = it.cost != null && totalCp(currency) >= it.cost * 100;
          return (
            <div className="inv-row" key={it.id} style={{ gridTemplateColumns: "1fr auto auto", cursor: "default" }} title={it.fluff_text || undefined}>
              <div className="inv-name-cell">
                <span className="name">{it.name}</span>
                <span className="inv-type-badge">
                  {it.category}{it.damage ? ` · ${it.damage}` : ""}{it.armor_type ? ` · ${it.armor_type}` : ""} · wt {it.weight}
                  {it.cost != null ? ` · ${it.cost} gp` : ""}
                </span>
              </div>
              {it.cost != null && (
                <button className="rest-btn" style={{ padding: "1px 8px" }} disabled={!affordable} onClick={() => onBuy(it)}>
                  <span className="name">buy</span>
                </button>
              )}
              <button className="rest-btn" style={{ padding: "1px 8px" }} onClick={() => onAdd(it)}>
                <span className="name">add</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
