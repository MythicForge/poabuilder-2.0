// Shared item detail — one renderer, mounted two ways: inline (list-row
// expansion) and inside the portal popover (ItemTip, cards). Takes the already
// -resolved `cat`, so a custom fork renders identically to a catalog item.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Backpack, Shield, Sword } from "lucide-react";
import type { CatalogItem, InventoryItem, SlotId } from "../core/types.ts";
import { REGISTRY } from "../core/data-registry.ts";
import { formatWeaponDamage, masterworkBonus } from "../core/masterwork.ts";

function DetailIcon({ category }: { category?: string }) {
  if (category === "Weapon") return <Sword size={20} strokeWidth={1.4} />;
  if (category === "Armor" || category === "Shield") return <Shield size={20} strokeWidth={1.4} />;
  return <Backpack size={20} strokeWidth={1.4} />;
}

function armorBonusOf(cat: CatalogItem): number {
  if (typeof cat.armor_bonus === "number") return cat.armor_bonus;
  if (cat.armor_bonus && typeof cat.armor_bonus === "object") return cat.armor_bonus.value ?? 0;
  if (cat.armor_bonus_range) return cat.armor_bonus_range.value ?? 0;
  return 0;
}

export interface ItemDetailCallbacks {
  onQty: (delta: number) => void;
  onMw: (delta: number) => void;
  onRemove: () => void;
  onEdit: () => void;
  onReductionPool: (next: number) => void;
}

interface ItemDetailBodyProps extends ItemDetailCallbacks {
  it: InventoryItem;
  cat: CatalogItem | null;
  slotLabel: (slot: SlotId) => string;
}

export function ItemDetailBody({
  it,
  cat,
  slotLabel,
  onQty,
  onMw,
  onRemove,
  onEdit,
  onReductionPool,
}: ItemDetailBodyProps) {
  const mw = masterworkBonus(it, cat);
  const category = cat?.category;
  const isCustom = it.custom != null;
  const catalogName = it.catalog_item_id ? REGISTRY.items.get(it.catalog_item_id)?.name : null;

  // provenance line under the name
  const sub = [
    isCustom ? "Custom" : category,
    cat?.subcategory,
    it.slot ? slotLabel(it.slot) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const flags: string[] = [];
  if (it.equipped || it.slot != null) flags.push(it.slot ? `Equipped · ${slotLabel(it.slot)}` : "Worn");
  if (category === "Weapon" && cat?.equip_slots?.includes("two_hands")) flags.push("Two-handed");
  if (it.quantity > 1) flags.push(`Quantity ×${it.quantity}`);

  const traits = (cat?.traits ?? []).map((t) => t.name).join(", ");
  const armorBonus = cat ? armorBonusOf(cat) : 0;

  const pool = cat?.reduction_pool ?? null;
  const poolCurrent = it.reduction_pool_current ?? pool ?? 0;

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <>
      <div className="itip-head">
        <div style={{ minWidth: 0 }}>
          <div className="itip-name">
            {it.name}
            {isCustom && <span className="itip-custom-pill">Custom</span>}
          </div>
          <div className="itip-sub">
            {sub}
            {isCustom && catalogName && <span className="itip-provenance"> from {catalogName}</span>}
          </div>
        </div>
        <div className="itip-icon"><DetailIcon category={category} /></div>
      </div>

      {flags.length > 0 && (
        <div className="itip-flags">
          {flags.map((f, i) => <span key={i}>{f}</span>)}
        </div>
      )}

      {category === "Weapon" && cat?.damage && (
        <div className="itip-stat">
          {formatWeaponDamage(cat, mw)}
          {(cat.damage_types ?? []).length > 0 && (
            <span className="itip-stat-sub"> {(cat.damage_types ?? []).map((d) => d.name).join("/")}</span>
          )}
          {cat.critical && <span className="itip-stat-sub"> · crit {cat.critical}</span>}
          {traits && <span className="itip-stat-sub"> · {traits}</span>}
        </div>
      )}
      {(category === "Armor" || category === "Shield") && cat && (
        <div className="itip-stat">
          +{armorBonus} Armor
          {cat.armor_type && <span className="itip-stat-sub"> ({cat.armor_type})</span>}
          {cat.wound_bonus ? <span className="itip-stat-sub"> · +{cat.wound_bonus} Wound</span> : null}
        </div>
      )}

      {cat?.fluff_text && <div className="itip-desc">{cat.fluff_text}</div>}

      {mw > 0 && (
        <div className={`itip-mw-band`}>
          <span className="itip-mw-tag">⚒ Masterwork +{mw}</span>
          {cat?.masterwork_eligible && (cat.masterwork_max ?? 0) > 0 && (
            <span className="itip-mw-steppers" onClick={stop}>
              <button className="itip-step" onClick={() => onMw(-1)} aria-label="Lower masterwork">−</button>
              <button className="itip-step" onClick={() => onMw(1)} aria-label="Raise masterwork">+</button>
            </span>
          )}
        </div>
      )}

      {pool != null && (
        <div className="itip-pool" onClick={stop}>
          <span className="itip-pool-label">▣ Reduction {poolCurrent}/{pool}</span>
          <span className="itip-pool-controls">
            <button className="itip-step" onClick={() => onReductionPool(Math.max(0, poolCurrent - 1))} aria-label="Spend reduction">−</button>
            <button className="itip-step" onClick={() => onReductionPool(pool)} aria-label="Reset reduction">↺</button>
          </span>
        </div>
      )}

      {it.notes.trim() && <div className="itip-notes">{it.notes}</div>}

      <div className="itip-foot">
        <span className="itip-foot-meta">
          {cat?.weight ?? 0} wt
          {cat?.cost != null && ` · ${cat.cost} g`}
        </span>
        <span className="itip-foot-actions" onClick={stop}>
          <button className="itip-step" onClick={() => onQty(-1)} aria-label="Decrease quantity">−</button>
          <span className="itip-foot-qty">×{it.quantity}</span>
          <button className="itip-step" onClick={() => onQty(1)} aria-label="Increase quantity">+</button>
          <button className="itip-act" onClick={onEdit} aria-label="Edit item">✎</button>
          <button className="itip-act itip-act--danger" onClick={onRemove} aria-label="Remove item">✕</button>
        </span>
      </div>
    </>
  );
}

// ── Portal popover (cards view) ──────────────────────────────────────────────
// UI physics ported from the 5e inventory tooltip: fixed-position portal so the
// scrolling inventory panel never clips it; hover-delay open, click toggle, and
// outside/Escape/scroll dismiss.

const TIP_WIDTH = 280;
const HOVER_DELAY = 150;

export interface TipState {
  id: string;
  rect: DOMRect;
}

export function useItemTip() {
  const [tip, setTip] = useState<TipState | null>(null);
  const hoverTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  const cancelHover = useCallback(() => {
    if (hoverTimer.current) { window.clearTimeout(hoverTimer.current); hoverTimer.current = null; }
  }, []);
  const keepOpen = useCallback(() => {
    if (closeTimer.current) { window.clearTimeout(closeTimer.current); closeTimer.current = null; }
  }, []);
  const close = useCallback(() => { cancelHover(); keepOpen(); setTip(null); }, [cancelHover, keepOpen]);

  const openHover = useCallback((id: string, el: HTMLElement) => {
    cancelHover(); keepOpen();
    const rect = el.getBoundingClientRect();
    hoverTimer.current = window.setTimeout(() => setTip({ id, rect }), HOVER_DELAY);
  }, [cancelHover, keepOpen]);

  const scheduleClose = useCallback(() => {
    keepOpen();
    closeTimer.current = window.setTimeout(() => setTip(null), 120);
  }, [keepOpen]);

  const toggle = useCallback((id: string, el: HTMLElement) => {
    cancelHover(); keepOpen();
    const rect = el.getBoundingClientRect();
    setTip((cur) => (cur?.id === id ? null : { id, rect }));
  }, [cancelHover, keepOpen]);

  useEffect(() => {
    if (!tip) return;
    const inTip = (t: EventTarget | null) => t instanceof HTMLElement && (t.closest(".itip") || t.closest("[data-tip-anchor]"));
    const onDown = (e: MouseEvent) => { if (!inTip(e.target)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    const onScroll = (e: Event) => { if (!(e.target instanceof HTMLElement && e.target.closest(".itip"))) close(); };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [tip, close]);

  return { tip, openHover, cancelHover, scheduleClose, keepOpen, toggle, close };
}

export function ItemTip({
  rect,
  onMouseEnter,
  onMouseLeave,
  children,
}: {
  rect: DOMRect;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const h = ref.current?.offsetHeight ?? 0;
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - TIP_WIDTH / 2, window.innerWidth - TIP_WIDTH - 8));
    const below = window.innerHeight - rect.bottom;
    const above = rect.top;
    const flip = below < 320 && above > below;
    const top = flip ? Math.max(8, rect.top - h - 8) : rect.bottom + 8;
    setPos({ left, top });
  }, [rect]);

  return createPortal(
    <div
      ref={ref}
      className="itip"
      style={{ left: pos?.left ?? rect.left, top: pos?.top ?? rect.bottom + 8, visibility: pos ? "visible" : "hidden" }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>,
    document.body,
  );
}
