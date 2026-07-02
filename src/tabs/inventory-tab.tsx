// Inventory tab: item table (equip toggle, qty steppers, remove), carry bar,
// currency, add-from-catalog modal with search + category filter.

import { useMemo, useState } from "react";
import type { CatalogItem, ComputedCharacter, InventoryItem, StoredCharacter } from "../core/types.ts";
import { REGISTRY } from "../core/data-registry.ts";
import { resolveItem } from "../core/compute.ts";

interface TabProps {
  c: ComputedCharacter;
  stored: StoredCharacter;
  setStored: (fn: (s: StoredCharacter) => StoredCharacter) => void;
}

const CATEGORIES = ["All", "Weapon", "Armor", "Shield", "Kit"];

export function InventoryTab({ c, stored, setStored }: TabProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const updateItem = (id: string, patch: Partial<InventoryItem>) =>
    setStored((s) => ({
      ...s,
      inventory: {
        ...s.inventory,
        items: s.inventory.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      },
    }));

  const removeItem = (id: string) =>
    setStored((s) => ({
      ...s,
      inventory: { ...s.inventory, items: s.inventory.items.filter((it) => it.id !== id) },
    }));

  const addFromCatalog = (cat: CatalogItem) =>
    setStored((s) => ({
      ...s,
      inventory: {
        ...s.inventory,
        items: [
          ...s.inventory.items,
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
        ],
      },
    }));

  const setCurrency = (key: "gold" | "silver" | "copper", value: number) =>
    setStored((s) => ({
      ...s,
      inventory: { ...s.inventory, currency: { ...s.inventory.currency, [key]: Math.max(0, value) } },
    }));

  const over = c.carry.used > c.carry.capacity;

  return (
    <>
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
        {stored.inventory.items.length === 0 && (
          <div className="feat-row"><div className="desc">Empty. Add something from the catalog.</div></div>
        )}
        {stored.inventory.items.map((it) => {
          const cat = resolveItem(it, REGISTRY);
          return (
            <div className="inv-row" key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px" }}>
              <span
                className="inv-equip-dot"
                title={it.equipped ? "Equipped — click to unequip" : "Click to equip"}
                style={{ cursor: "pointer", color: it.equipped ? "var(--gold)" : "var(--text-faint)" }}
                onClick={() => updateItem(it.id, { equipped: !it.equipped })}
              >
                {it.equipped ? "◉" : "○"}
              </span>
              <span className="name" style={{ flex: 1 }}>
                {it.name}
                {cat?.category === "Armor" && cat.armor_type ? ` (${cat.armor_type})` : ""}
              </span>
              {cat?.category === "Armor" && String(cat.armor_type) === "Medium" && it.equipped && (
                <select
                  value={it.medium_armor_stat ?? "brawn"}
                  onChange={(e) => updateItem(it.id, { medium_armor_stat: e.target.value as "brawn" | "finesse" })}
                  style={{ background: "var(--card-2)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 10 }}
                  title="Medium armor stat"
                >
                  <option value="brawn">Brawn</option>
                  <option value="finesse">Finesse</option>
                </select>
              )}
              <span className="qty" style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <span className="pm" style={{ cursor: "pointer" }} onClick={() => updateItem(it.id, { quantity: Math.max(1, it.quantity - 1) })}>−</span>
                ×{it.quantity}
                <span className="pm" style={{ cursor: "pointer" }} onClick={() => updateItem(it.id, { quantity: it.quantity + 1 })}>+</span>
              </span>
              <span className="wt">{((cat?.weight ?? 0) * it.quantity).toFixed(1)}</span>
              <span className="x" style={{ cursor: "pointer" }} title="Remove" onClick={() => removeItem(it.id)}>✕</span>
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
          <div className="inv-row" key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 8px" }}>
            <span className="name" style={{ flex: 1 }}>{it.name}</span>
            <span className="type" style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)" }}>
              {it.category}{it.damage ? ` · ${it.damage}` : ""}{it.armor_type ? ` · ${it.armor_type}` : ""} · wt {it.weight}
            </span>
            <button className="rest-btn" style={{ padding: "1px 8px" }} onClick={() => onAdd(it)}>
              <span className="name">add</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
