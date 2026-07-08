// Custom-item editor. Writes only to the StoredCharacter (via onSave → the
// item's `custom` fork); the system catalog is never touched. Fields are
// grouped and shown conditionally by category.

import { useEffect, useRef, useState } from "react";
import type { CatalogItem, InventoryItem } from "../core/types.ts";
import type { ItemEdits } from "../core/custom-item.ts";

const CATEGORIES = ["Weapon", "Armor", "Shield", "Kit"] as const;
// Attribute driving To Hit / Damage Mod. "Varried" ⇒ max(Brawn, Finesse).
const MODIFIERS = ["Brawn", "Finesse", "Mind", "Will", "Varried"] as const;
const ARMOR_TYPES = ["Light", "Medium", "Heavy"] as const;

function armorBonusOf(cat: CatalogItem | null): number {
  if (!cat) return 0;
  if (typeof cat.armor_bonus === "number") return cat.armor_bonus;
  if (cat.armor_bonus && typeof cat.armor_bonus === "object") return cat.armor_bonus.value ?? 0;
  if (cat.armor_bonus_range) return cat.armor_bonus_range.value ?? 0;
  return 0;
}

interface FormState {
  name: string;
  category: string;
  subcategory: string;
  damage: string;
  modifier: string;
  critical: string;
  traits: string;
  armor_type: string;
  armor_bonus: string;
  wound_bonus: string;
  reduction_pool: string;
  masterwork_eligible: boolean;
  masterwork_max: string;
  weight: string;
  cost: string;
  stackable: boolean;
  fluff_text: string;
  notes: string;
}

function initialForm(it: InventoryItem, cat: CatalogItem | null): FormState {
  return {
    name: it.name,
    category: cat?.category ?? "Kit",
    subcategory: cat?.subcategory ?? "",
    damage: cat?.damage ?? "",
    modifier: cat?.modifier ?? "",
    critical: cat?.critical ?? "",
    traits: (cat?.traits ?? []).map((t) => t.name).join(", "),
    armor_type: (cat?.armor_type as string) ?? "Light",
    armor_bonus: String(armorBonusOf(cat)),
    wound_bonus: String(cat?.wound_bonus ?? 0),
    reduction_pool: cat?.reduction_pool != null ? String(cat.reduction_pool) : "",
    masterwork_eligible: !!cat?.masterwork_eligible,
    masterwork_max: String(cat?.masterwork_max ?? 0),
    weight: String(cat?.weight ?? 0),
    cost: cat?.cost != null ? String(cat.cost) : "",
    stackable: !!cat?.stackable,
    fluff_text: cat?.fluff_text ?? "",
    notes: it.notes,
  };
}

function toEdits(f: FormState): ItemEdits {
  const num = (s: string) => Number(s) || 0;
  const edits: ItemEdits = {
    name: f.name.trim() || "Untitled",
    category: f.category,
    subcategory: f.subcategory.trim() || undefined,
    weight: num(f.weight),
    cost: f.cost.trim() === "" ? null : num(f.cost),
    stackable: f.stackable,
    fluff_text: f.fluff_text.trim() || undefined,
    masterwork_eligible: f.masterwork_eligible,
    masterwork_max: f.masterwork_eligible ? num(f.masterwork_max) : 0,
  };
  if (f.category === "Weapon") {
    edits.damage = f.damage.trim() || null;
    edits.modifier = f.modifier || undefined;
    edits.critical = f.critical.trim() || undefined;
    edits.traits = f.traits
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({ name }));
  }
  if (f.category === "Armor" || f.category === "Shield") {
    edits.armor_type = f.armor_type;
    edits.armor_bonus = num(f.armor_bonus);
    edits.wound_bonus = num(f.wound_bonus);
    edits.reduction_pool = f.reduction_pool.trim() === "" ? null : num(f.reduction_pool);
  }
  return edits;
}

interface ItemEditModalProps {
  it: InventoryItem;
  cat: CatalogItem | null;
  mode: "edit" | "create";
  canRevert: boolean;
  catalogName?: string | null;
  onSave: (edits: ItemEdits, notes: string) => void;
  onRevert?: () => void;
  onClose: () => void;
}

export function ItemEditModal({
  it,
  cat,
  mode,
  canRevert,
  catalogName,
  onSave,
  onRevert,
  onClose,
}: ItemEditModalProps) {
  const [f, setF] = useState<FormState>(() => initialForm(it, cat));
  const [confirmRevert, setConfirmRevert] = useState(false);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    nameRef.current?.focus();
    nameRef.current?.select();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const isArmor = f.category === "Armor" || f.category === "Shield";
  const badDamage = f.category === "Weapon" && f.damage.trim() !== "" && !/\d+\s*d\s*\d+/i.test(f.damage);

  const save = () => onSave(toEdits(f), f.notes);

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}
    >
      <div className="item-edit-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={mode === "create" ? "Create custom item" : "Edit item"}>
        <div className="item-edit-head">
          <div>
            <div className="item-edit-title">{mode === "create" ? "New custom item" : "Edit item"}</div>
            {mode === "edit" && (
              <div className="item-edit-provenance">
                {it.custom != null
                  ? catalogName
                    ? `Custom — forked from ${catalogName}`
                    : "Custom item"
                  : catalogName
                    ? `Editing forks a private copy of ${catalogName}`
                    : "Editing forks a private copy"}
              </div>
            )}
          </div>
          <button className="item-edit-x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="item-edit-body">
          <Group label="Identity">
            <Field label="Name">
              <input ref={nameRef} className="item-edit-input" value={f.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <div className="item-edit-row2">
              <Field label="Category">
                <select className="item-edit-input" value={f.category} onChange={(e) => set("category", e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Subcategory">
                <input className="item-edit-input" value={f.subcategory} onChange={(e) => set("subcategory", e.target.value)} placeholder="optional" />
              </Field>
            </div>
          </Group>

          {f.category === "Weapon" && (
            <Group label="Weapon">
              <div className="item-edit-row2">
                <Field label="Damage" hint={badDamage ? "expected like 2d6 — saved anyway" : undefined}>
                  <input className={`item-edit-input${badDamage ? " warn" : ""}`} value={f.damage} onChange={(e) => set("damage", e.target.value)} placeholder="2d6 or Modifier" />
                </Field>
                <Field label="Modifier" hint="Varried = max(Brawn, Finesse)">
                  <select className="item-edit-input" value={f.modifier} onChange={(e) => set("modifier", e.target.value)}>
                    <option value="">none</option>
                    {MODIFIERS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Critical">
                <input className="item-edit-input" value={f.critical} onChange={(e) => set("critical", e.target.value)} placeholder="optional" />
              </Field>
              <Field label="Traits" hint="comma-separated">
                <input className="item-edit-input" value={f.traits} onChange={(e) => set("traits", e.target.value)} placeholder="Finesse, Thrown" />
              </Field>
            </Group>
          )}

          {isArmor && (
            <Group label={f.category === "Shield" ? "Shield" : "Armor"}>
              <div className="item-edit-row2">
                <Field label="Armor type">
                  <select className="item-edit-input" value={f.armor_type} onChange={(e) => set("armor_type", e.target.value)}>
                    {ARMOR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Armor bonus">
                  <input className="item-edit-input" type="number" value={f.armor_bonus} onChange={(e) => set("armor_bonus", e.target.value)} />
                </Field>
              </div>
              {f.armor_type === "Medium" && (
                <div className="item-edit-note">Medium armor lets the wearer pick Brawn or Finesse per piece (set on the equipment slot).</div>
              )}
              <div className="item-edit-row2">
                <Field label="Wound bonus">
                  <input className="item-edit-input" type="number" value={f.wound_bonus} onChange={(e) => set("wound_bonus", e.target.value)} />
                </Field>
                <Field label="Reduction pool">
                  <input className="item-edit-input" type="number" value={f.reduction_pool} onChange={(e) => set("reduction_pool", e.target.value)} placeholder="none" />
                </Field>
              </div>
            </Group>
          )}

          <Group label="Masterwork">
            <label className="item-edit-check">
              <input type="checkbox" checked={f.masterwork_eligible} onChange={(e) => set("masterwork_eligible", e.target.checked)} />
              <span>Masterwork eligible</span>
            </label>
            {f.masterwork_eligible && (
              <Field label="Max masterwork">
                <input className="item-edit-input" type="number" min={0} value={f.masterwork_max} onChange={(e) => set("masterwork_max", e.target.value)} />
              </Field>
            )}
          </Group>

          <Group label="Logistics">
            <div className="item-edit-row2">
              <Field label="Weight">
                <input className="item-edit-input" type="number" step="0.1" value={f.weight} onChange={(e) => set("weight", e.target.value)} />
              </Field>
              <Field label="Cost (gp)">
                <input className="item-edit-input" type="number" value={f.cost} onChange={(e) => set("cost", e.target.value)} placeholder="none" />
              </Field>
            </div>
            <label className="item-edit-check">
              <input type="checkbox" checked={f.stackable} onChange={(e) => set("stackable", e.target.checked)} />
              <span>Stackable</span>
            </label>
          </Group>

          <Group label="Text">
            <Field label="Description">
              <textarea className="item-edit-input item-edit-area" value={f.fluff_text} onChange={(e) => set("fluff_text", e.target.value)} rows={3} placeholder="Flavor text" />
            </Field>
            <Field label="Notes" hint="stays with this item, survives revert">
              <textarea className="item-edit-input item-edit-area" value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Your notes" />
            </Field>
          </Group>
        </div>

        <div className="item-edit-foot">
          {mode === "edit" && canRevert && onRevert && (
            confirmRevert ? (
              <span className="item-edit-revert-confirm">
                Discard your edits?
                <button className="item-edit-btn item-edit-btn--danger" onClick={onRevert}>Revert</button>
                <button className="item-edit-btn" onClick={() => setConfirmRevert(false)}>Keep</button>
              </span>
            ) : (
              <button className="item-edit-btn item-edit-btn--ghost" onClick={() => setConfirmRevert(true)}>
                Revert to catalog
              </button>
            )
          )}
          <span className="item-edit-foot-spacer" />
          <button className="item-edit-btn" onClick={onClose}>Cancel</button>
          <button className="item-edit-btn item-edit-btn--primary" onClick={save}>
            {mode === "create" ? "Create item" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="item-edit-group">
      <div className="item-edit-group-label">{label}</div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="item-edit-field">
      <span className="item-edit-field-label">
        {label}
        {hint && <span className="item-edit-field-hint"> · {hint}</span>}
      </span>
      {children}
    </label>
  );
}
