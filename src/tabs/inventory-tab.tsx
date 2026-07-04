// Inventory tab: equipment slots panel (drag-and-drop), item rows (drag
// source, equip toggle, qty steppers, remove), carry bar, currency,
// add-from-catalog modal with search + category filter.

import { useMemo, useRef, useState } from "react";
import type { CatalogItem, ComputedCharacter, InventoryItem, SlotId, StoredCharacter } from "../core/types.ts";
import { REGISTRY } from "../core/data-registry.ts";
import { resolveItem } from "../core/compute.ts";
import { defaultSlotFor, equipToSlot, isTwoHanded, legalSlotsFor, unequip } from "../core/equip.ts";

interface TabProps {
  c: ComputedCharacter;
  stored: StoredCharacter;
  setStored: (fn: (s: StoredCharacter) => StoredCharacter) => void;
}

const CATEGORIES = ["All", "Weapon", "Armor", "Shield", "Kit"];
const SLOTS: SlotId[] = ["main_hand", "off_hand", "body"];

function slotLabel(slot: SlotId): string {
  const def = (REGISTRY.itemsDoc.slot_definitions as Record<string, { label?: string }>)[slot];
  return def?.label ?? slot;
}

export function InventoryTab({ c, stored, setStored }: TabProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<SlotId | null>(null);
  const touchGhost = useRef<HTMLDivElement | null>(null);
  const touchTimer = useRef<number | null>(null);

  const items = stored.inventory.items;

  const setItems = (next: InventoryItem[]) => setStored((s) => ({ ...s, inventory: { ...s.inventory, items: next } }));

  const updateItem = (id: string, patch: Partial<InventoryItem>) =>
    setItems(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const removeItem = (id: string) => setItems(items.filter((it) => it.id !== id));

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

  const setCurrency = (key: "gold" | "silver" | "copper", value: number) =>
    setStored((s) => ({
      ...s,
      inventory: { ...s.inventory, currency: { ...s.inventory.currency, [key]: Math.max(0, value) } },
    }));

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

  const dragCat = draggingId ? resolveItem(items.find((it) => it.id === draggingId)!, REGISTRY) : null;
  const legalDragSlots = dragCat ? legalSlotsFor(dragCat) : [];

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
            <button className="rest-btn" style={{ padding: "2px 10px" }} onClick={() => setModalOpen(true)}>
              <span className="name">+ Add item</span>
            </button>
          </div>
        </div>
        {items.length === 0 && (
          <div className="feat-row"><div className="desc">Empty. Add something from the catalog.</div></div>
        )}
        {items.map((it) => {
          const cat = resolveItem(it, REGISTRY);
          const legal = legalSlotsFor(cat);
          return (
            <div
              className={`inv-row${draggingId === it.id ? " inv-dragging" : ""}`}
              key={it.id}
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
            >
              <div className="inv-name-cell">
                <button className={`inv-equip-btn${it.equipped ? " equipped" : ""}`} onClick={() => toggleEquip(it, cat)}>
                  {it.equipped ? "◉" : "○"}
                </button>
                <span className="name">
                  {it.name}
                  {cat?.category === "Armor" && cat.armor_type ? ` (${cat.armor_type})` : ""}
                </span>
                {cat?.category && <span className="inv-type-badge">{cat.category}{it.slot ? ` · ${slotLabel(it.slot)}` : ""}</span>}
              </div>
              <span className="qty">
                <span className="pm" style={{ cursor: "pointer" }} onClick={() => updateItem(it.id, { quantity: Math.max(1, it.quantity - 1) })}>−</span>
                ×{it.quantity}
                <span className="pm" style={{ cursor: "pointer" }} onClick={() => updateItem(it.id, { quantity: it.quantity + 1 })}>+</span>
              </span>
              <span className="wt">{((cat?.weight ?? 0) * it.quantity).toFixed(1)}</span>
              <span className="x" onClick={() => removeItem(it.id)}>✕</span>
            </div>
          );
        })}
      </div>

      <div className="list-card">
        <div className="card-header"><div className="card-title">Currency</div></div>
        <div className="hp-grid" style={{ padding: "4px 8px 10px" }}>
          {(["gold", "silver", "copper"] as const).map((k) => (
            <div className="hp-cell" key={k}>
              <div className="lbl">{k}</div>
              <div className="v">
                <span className="pm" style={{ cursor: "pointer" }} onClick={() => setCurrency(k, stored.inventory.currency[k] - 1)}>−</span>
                <span>{stored.inventory.currency[k]}</span>
                <span className="pm" style={{ cursor: "pointer" }} onClick={() => setCurrency(k, stored.inventory.currency[k] + 1)}>+</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {modalOpen && <CatalogModal onAdd={addFromCatalog} onClose={() => setModalOpen(false)} />}
    </>
  );
}

function CatalogModal({ onAdd, onClose }: { onAdd: (cat: CatalogItem) => void; onClose: () => void }) {
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
          <span style={{ cursor: "pointer" }} onClick={onClose}>✕</span>
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
        {results.map((it) => (
          <div className="inv-row" key={it.id} style={{ gridTemplateColumns: "1fr auto", cursor: "default" }}>
            <div className="inv-name-cell">
              <span className="name">{it.name}</span>
              <span className="inv-type-badge">
                {it.category}{it.damage ? ` · ${it.damage}` : ""}{it.armor_type ? ` · ${it.armor_type}` : ""} · wt {it.weight}
              </span>
            </div>
            <button className="rest-btn" style={{ padding: "1px 8px" }} onClick={() => onAdd(it)}>
              <span className="name">add</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
