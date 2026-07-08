// Cards view for the Inventory tab: same items, same drag/touch sources as
// the list rows, laid out as scannable tiles instead of dense rows. Hovering
// (or clicking) a card opens the shared item detail in a portal popover.

import { Backpack, Shield, Sword } from "lucide-react";
import type { CatalogItem, InventoryItem, SlotId } from "../core/types.ts";
import { REGISTRY } from "../core/data-registry.ts";
import { resolveItem } from "../core/compute.ts";
import { legalSlotsFor } from "../core/equip.ts";
import { itemShortStat, masterworkBonus } from "../core/masterwork.ts";
import { ItemDetailBody, ItemTip, useItemTip, type ItemDetailCallbacks } from "./item-detail.tsx";

function CardIcon({ category }: { category?: string }) {
  if (category === "Weapon") return <Sword size={28} strokeWidth={1.4} />;
  if (category === "Armor" || category === "Shield") return <Shield size={28} strokeWidth={1.4} />;
  return <Backpack size={28} strokeWidth={1.4} />;
}

interface CardsGridProps {
  items: InventoryItem[];
  favIds: Set<string>;
  draggingId: string | null;
  slotLabel: (slot: SlotId) => string;
  detailCallbacks: (it: InventoryItem, cat: CatalogItem | null) => ItemDetailCallbacks;
  onDragStart: (it: InventoryItem, e: React.DragEvent) => void;
  onDragEnd: () => void;
  onTouchStart: (it: InventoryItem, e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (id: string, e: React.TouchEvent) => void;
  onToggleEquip: (it: InventoryItem, cat: CatalogItem | null) => void;
  onToggleStar: (it: InventoryItem) => void;
}

export function CardsGrid({
  items,
  favIds,
  draggingId,
  slotLabel,
  detailCallbacks,
  onDragStart,
  onDragEnd,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onToggleEquip,
  onToggleStar,
}: CardsGridProps) {
  const { tip, openHover, cancelHover, scheduleClose, keepOpen, toggle, close } = useItemTip();
  const tipItem = tip ? items.find((it) => it.id === tip.id) : null;
  const tipCat = tipItem ? resolveItem(tipItem, REGISTRY) : null;

  return (
    <div className="inv-cards-grid">
      {items.map((it) => {
        const cat = resolveItem(it, REGISTRY);
        const legal = legalSlotsFor(cat);
        const mw = masterworkBonus(it, cat);
        const starred = favIds.has(it.catalog_item_id ?? it.id);
        const equipped = it.equipped || it.slot != null;
        return (
          <div
            key={it.id}
            data-tip-anchor
            className={`inv-card${equipped ? " equipped" : ""}${draggingId === it.id ? " inv-dragging" : ""}`}
            draggable={legal.length > 0}
            onDragStart={(e) => { cancelHover(); close(); onDragStart(it, e); }}
            onDragEnd={onDragEnd}
            onTouchStart={legal.length > 0 ? (e) => onTouchStart(it, e) : undefined}
            onTouchMove={legal.length > 0 ? onTouchMove : undefined}
            onTouchEnd={legal.length > 0 ? (e) => onTouchEnd(it.id, e) : undefined}
            onMouseEnter={(e) => { if (!draggingId) openHover(it.id, e.currentTarget); }}
            onMouseLeave={scheduleClose}
            onClick={(e) => { if (!draggingId) toggle(it.id, e.currentTarget); }}
          >
            {it.quantity > 1 && <span className="inv-card-badge">×{it.quantity}</span>}
            <div className="inv-card-top-btns">
              <button
                className={`inv-card-equip${equipped ? " equipped" : ""}`}
                onClick={(e) => { e.stopPropagation(); onToggleEquip(it, cat); }}
              >
                {equipped ? "◉" : "○"}
              </button>
              <button
                className={`inv-card-star${starred ? " starred" : ""}`}
                onClick={(e) => { e.stopPropagation(); onToggleStar(it); }}
              >
                {starred ? "★" : "☆"}
              </button>
            </div>
            <div className="inv-card-icon"><CardIcon category={cat?.category} /></div>
            <div className="inv-card-name">
              {it.name}
              {mw > 0 && <span className="inv-type-badge" style={{ marginLeft: 4 }}>MW+{mw}</span>}
              {it.custom != null && <span className="inv-type-badge inv-badge-custom" style={{ marginLeft: 4 }}>Custom</span>}
            </div>
            <div className="inv-card-foot">{itemShortStat(cat)}</div>
          </div>
        );
      })}

      {tip && tipItem && (() => {
        const cb = detailCallbacks(tipItem, tipCat);
        return (
          <ItemTip rect={tip.rect} onMouseEnter={keepOpen} onMouseLeave={scheduleClose}>
            <ItemDetailBody
              it={tipItem}
              cat={tipCat}
              slotLabel={slotLabel}
              {...cb}
              onEdit={() => { close(); cb.onEdit(); }}
              onRemove={() => { close(); cb.onRemove(); }}
            />
          </ItemTip>
        );
      })()}
    </div>
  );
}
