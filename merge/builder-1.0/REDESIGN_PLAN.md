# PoA Character Sheet — 5e-Sheet Style Sync

## Context
Visual/UX patterns from `/home/nfarmer/Desktop/5e-sheet` → PoA character sheet. Layout/style only — calcs and state logic unchanged. Seven changes, ordered by dependency.

---

## Change 1 — Color Palette (no deps, do first)

**File:** `app/globals.css`

Replace dark-mode vars in `:root` / `[data-theme="dark"]`:

| PoA current | New value |
|---|---|
| `--bg: #16120d` | `#14151a` |
| `--bg-2: #1d1812` | `#14141c` |
| `--panel: #231d14` | `#181821` |
| `--panel-hi: #2c2318` | `#1c1c26` |
| `--border: #3b3122` | `#2a2a35` |
| `--border-hi: #544531` | `#3a3a48` |
| `--text-primary: #f4ecdb` | `#e8e3d6` |
| `--text-secondary: #cebf9d` | `#c4bfb0` |
| `--text-tertiary: #9b8b66` | `#a09a8c` |
| `--gold: #d4a74c` | `#c9a96a` |
| `--gold-dim: #8a6d2e` | `#8a7444` |
| `--gold-hi: #edc878` | `#e0c388` |
| `--ok: #6cbd6c` | `#7a9d6f` |
| `--fail: #e2706a` | `#c66464` |
| `--border-soft` | `#20202a` |
| `--border-faint` | `#1e1e28` |
| `--card-2` | `#1c1c26` |

Add in `@theme inline` block:
```css
--serif: "Cormorant Garamond", Georgia, serif;
--sans: "IBM Plex Sans", -apple-system, sans-serif;
--mono: "JetBrains Mono", "IBM Plex Mono", monospace;
```

Add portrait vars (needed for Change 5):
```css
--portrait-scrim: rgba(15, 15, 21, 0.85);
--portrait-ph-a: #2a2330;
```

Also add CSS classes at bottom of globals.css (for Change 5 portrait modal):
```css
.header-portrait-thumb { width:56px; height:56px; border-radius:5px; border:1px solid var(--border); cursor:pointer; overflow:hidden; flex-shrink:0; transition:border-color 0.15s; }
.header-portrait-thumb:hover { border-color: var(--gold); }
.portrait-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.75); display:flex; align-items:center; justify-content:center; z-index:1000; }
.portrait-modal { background:var(--card,var(--panel)); border:1px solid var(--border); border-radius:8px; max-width:420px; width:90vw; overflow:hidden; }
.portrait-modal-btn { padding:4px 12px; border-radius:4px; border:1px solid var(--border); background:var(--bg-nav,var(--bg-2)); color:var(--text-primary); font-size:12px; cursor:pointer; }
.portrait-modal-btn--danger { border-color:var(--fail); color:var(--fail); }
```

---

## Change 2 — Condense Proficiencies (left rail)

**File:** `components/rails/LeftRail.tsx`, lines 610–699

Current: 3 separate cards for Armaments / Protection / Tool Kits, each own border/wrapper.

New: Single card, shared border, internal section dividers.

Structure:
```
<div card-style>  ← single outer card
  <div card-header>Proficiencies</div>
  {groups.filter(g => g.items.length).map(group, i) =>
    <>
      {i > 0 && <div 1px border-top divider />}
      <div section-label mono 9px text-muted uppercase>{group.label}</div>
      {group.items.map item row with "Proficient" badge}
    </>
  }
</div>
```

No prop/state changes. Data from existing `prof?.armaments`, `prof?.protection`, `prof?.toolKits`.

---

## Change 3 — Reduce Defense Stats to One Container

**File:** `components/CharacterSheet.tsx`, lines 2450–2738

Current: `4-col grid` → Armor Defense card | Fortitude | Mental | Will (separate cards).

New: One card:
- Top: large Armor Defense number (36px) + sub-label + spell armor toggle + temp mod controls (existing logic verbatim)
- `1px solid var(--border)` horizontal divider
- Bottom: 3-col inner grid → Fortitude | Mental | Will (22px numbers, 9px labels)
- Card border/bg → gold when `spellArmorOn` (same logic as today)

Remove outer `poa-defense-grid` wrapper div. No prop changes — all vars (`armorDefense`, `bodyDef`, `mindDef`, `willDef`, `spellArmorOn`, temp mod handlers) are CharacterSheet component-scope.

---

## Change 4 — Move Carry Card from Center to Inventory

### 4A — Remove from CharacterSheet.tsx center column
**Lines ~3292–3357**: Delete Carry sub-card div. Respites card above stays. Adjust flex column wrapper if now single child.

### 4B — Upgrade inline weight in InventoryTab
**File:** `components/tabs/InventoryTab.tsx`, lines 1097–1107

Replace `<span>Weight: {totalCarried.toFixed(1)} / {carryWeight}...` with full carry card:
```
card div (bg-card, border, 6px radius, padding 10px 14px 12px):
  "Carry" label header
  {totalCarried.toFixed(1)} large / {carryWeight} lb small
    — color: var(--fail) if over capacity
  4px progress bar, fill = min(100%, totalCarried/carryWeight*100)%
    — bar color: var(--fail) if over, else var(--primary)
  if over: " ⚠ Over" bold fail-color
```

No new props — `totalCarried` and `carryWeight` already in `InventoryTabProps`.

---

## Change 5 — Move V.I.T.A.L.S. to Right Rail

### 5A — Remove from LeftRail
**File:** `components/rails/LeftRail.tsx`, lines 300–608

Delete entire V.I.T.A.L.S. JSX block. Also remove:
- `dynUnspentSkill`, `totalAvailableSkill`, `totalSpentSkill` local vars (lines ~50–55, used only here)
- `isArmorProficient` from `LeftRailProps` interface (line 31) and destructured params (line 41)
- Imports `calcBaseDiceFromAttr`, `calcSkillAttrValue`, `calcSkillPool` from `@/lib/characterCalc` if unused elsewhere

### 5B — Add V.I.T.A.L.S. to RightRail
**File:** `components/rails/RightRail.tsx`

Add to `RightRailProps`:
```typescript
attrs: Record<AttributeKey, number>;
isArmorProficient: boolean;
```

Import `AttributeKey` from `@/lib/characterTypes`.
Import `TIER_TOTAL_SLOTS`, `calcBaseDiceFromAttr`, `calcSkillAttrValue`, `calcSkillPool` from `@/lib/characterCalc`.

Compute skill-point totals locally inside RightRail (same math as LeftRail lines 50–55).

Paste V.I.T.A.L.S. JSX block (formerly LeftRail 300–608) into RightRail render, **after portrait removal** (Change 6), before Favorites panel.

### 5C — Update CharacterSheet prop passing
**File:** `components/CharacterSheet.tsx`

- `<LeftRail>` (~line 2430): remove `isArmorProficient` prop
- `<RightRail>` (~line 4198): add `attrs={attrs}` and `isArmorProficient={isArmorProficient}`

---

## Change 6 — Portrait: Right Rail → Header

### 6A — Remove from RightRail
**File:** `components/rails/RightRail.tsx`

- Delete portrait card div (lines 59–192) and hidden `<input>` (193–209)
- Remove from `RightRailProps`: `portraitUrl`, `setPortraitUrl`, `portraitInputRef`
- Remove `portraitCollapsed` state (line 54)
- Remove `type RefObject` import if unused

### 6B — Add thumbnail + modal to CharacterSheet header
**File:** `components/CharacterSheet.tsx`

Add state: `const [portraitOpen, setPortraitOpen] = useState(false);` (near line 473).

In `{/* ──── HEADER ──── */}` (~line 2104), `{/* LEFT: name + tags + back */}` div:
- Change outer div to `display:flex, gap:12px, alignItems:flex-start`
- Prepend portrait thumbnail before `<h1>` name block:

```tsx
<div
  className="header-portrait-thumb"
  onClick={() => portraitUrl ? setPortraitOpen(true) : portraitInputRef.current?.click()}
  title={portraitUrl ? "Click to view portrait" : "Click to upload portrait"}
>
  {portraitUrl
    ? <img src={portraitUrl} alt={c.name} style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"top center" }} />
    : <div style={{ width:"100%", height:"100%", background:"var(--portal-ph-a, var(--bg-2))", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-muted)", fontSize:18 }}>
        {c.name ? c.name.charAt(0).toUpperCase() : "?"}
      </div>
  }
</div>
```

Add portrait modal before closing `</div>` of component return:
```tsx
{portraitOpen && (
  <div className="portrait-modal-overlay" onClick={() => setPortraitOpen(false)}>
    <div className="portrait-modal" onClick={e => e.stopPropagation()}>
      {portraitUrl
        ? <img src={portraitUrl} alt={c.name} style={{ display:"block", width:"100%", maxHeight:"60vh", objectFit:"contain" }} />
        : <div style={{ height:200, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-muted)", fontFamily:"var(--font-heading)", fontSize:14 }}>No portrait uploaded</div>
      }
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", borderTop:"1px solid var(--border)", gap:8 }}>
        <span style={{ fontFamily:"var(--font-heading)", fontStyle:"italic", fontSize:16, color:"var(--gold)" }}>{c.name}</span>
        <div style={{ display:"flex", gap:8 }}>
          <button className="portrait-modal-btn" onClick={() => portraitInputRef.current?.click()}>Change</button>
          {portraitUrl && (
            <button className="portrait-modal-btn portrait-modal-btn--danger" onClick={() => { localStorage.removeItem(`portrait-${c.id}`); setPortraitUrl(null); setPortraitOpen(false); }}>Remove</button>
          )}
          <button className="portrait-modal-btn" onClick={() => setPortraitOpen(false)}>Close</button>
        </div>
      </div>
    </div>
  </div>
)}
```

### 6C — Remove portrait props from RightRail call
**File:** `components/CharacterSheet.tsx`, ~line 4209–4211
Remove `portraitUrl`, `setPortraitUrl`, `portraitInputRef` from `<RightRail>`.

---

## Change 7 — Conditions Chip UI

**File:** `components/tabs/CombatTab.tsx`, lines 300–503

Add local state: `const [showPicker, setShowPicker] = useState(false);`

Add category + color map at top of file:
```typescript
const COND_CATEGORY: Record<string, string> = {
  Bleeding:"damage", Burning:"damage",
  Poisoned:"poison",
  Blinded:"sense", Deafened:"sense",
  Charmed:"mind", Compelled:"mind", Dominated:"mind", Frightened:"mind", Enraged:"mind",
  Restrained:"control", Immobilized:"control", Stunned:"control", Inert:"control", Unconscious:"control", Prone:"control",
  Dazed:"hinder", Weakened:"hinder", Sapped:"hinder", Crippled:"hinder", Maimed:"hinder", Silenced:"hinder",
};
const COND_COLOR: Record<string, string> = {
  damage:"#e0623d", poison:"#5fae6b", sense:"#5f94d6",
  mind:"#d877ab", control:"#9d80dd", hinder:"#cf9a4e",
};
```

Replace conditions card body (lines 317–502) with two sections:

**Section 1 — Active chip row** (always visible when card expanded):
```
flex-wrap row, gap 6px, padding 10px 14px
  for each active condition:
    chip div (inline-flex, bg: color + "18", border: color + "55", border-radius 5px, padding 3px 6px):
      8px colored disc (category color, border-radius 50%)
      condition name (11px, var(--font-mono))
      if stacking: − {count} + buttons (12px)
      if non-stacking: "∞" (10px, text-muted)
      × button to call setCondition(code, 0)
  "+" button (small, outlined) → toggles showPicker
```

**Section 2 — Picker grid** (shown when showPicker):
```
border-top, padding 10px 14px
  flex-wrap grid of all CONDITIONS:
    each = small button (font-mono 10px), active state = category color border + bg tint
    click = setCondition(code, active ? 0 : 1)
    title = def.tip (tooltip)
```

Remove separate "Active conditions" list (lines 436–502). Active state via chips only.

`setCondition` helper (already exists or inline):
```typescript
const setCondition = (code: string, val: number) =>
  persist({ activeConditions: { ...activeConds, [code]: val } });
```

---

## Files Modified

| File | Changes |
|---|---|
| `app/globals.css` | Color vars + portrait CSS classes |
| `components/CharacterSheet.tsx` | Defense condensed, carry removed, portrait thumbnail+modal added, prop adjustments |
| `components/rails/LeftRail.tsx` | V.I.T.A.L.S. removed, proficiencies condensed to 1 card, `isArmorProficient` removed from props |
| `components/rails/RightRail.tsx` | Portrait removed, V.I.T.A.L.S. added, 2 new props added, 3 portrait props removed |
| `components/tabs/CombatTab.tsx` | Conditions rebuilt as chip UI |
| `components/tabs/InventoryTab.tsx` | Inline carry weight → full carry card |

---

## Verification

1. `npx tsc --noEmit` — zero errors after each change
2. Dev server: all 3 columns render, no layout breaks
3. Dark mode: cooler palette, gold = #c9a96a
4. Left rail: Attributes + single "Proficiencies" card (up to 3 sub-sections)
5. Right rail: V.I.T.A.L.S. skills with steppers + Favorites panel (no portrait)
6. Center top: one defense card, Armor Defense large, Fortitude/Mental/Will smaller below divider
7. Center vitals: no carry card (carry now in Inventory tab)
8. Header: 56px portrait thumbnail left of name; click-to-upload when empty; click-to-modal when set
9. Inventory tab: full carry card with bar above item list
10. Combat tab: colored condition chips with ×; stacking chips show count with ±; "+" opens picker grid