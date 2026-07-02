# src/ Restructure Plan

## Target Folder Structure

```
src/
  core/           ← data model, computation engine, registries, storage
  shared/         ← UI primitives and global style (used everywhere, no business logic)
  features/       ← optional cross-cutting features (gdrive, plugins, tweaks)
  tabs/           ← sheet tab components
  views/          ← full-page app shells and layout components
  pages/          ← Vite entry point renderers (no change — Vite requires this path)
```

> `config/` renamed to `shared/` — "config" implies settings files, not UI primitives.

---

## File Migration Map

### `core/`

| File | Notes |
|---|---|
| `types.ts` | Root type file — everything imports from here |
| `data-5e.ts` | `computeCharacter()` main engine |
| `data-registry.ts` | `REGISTRY`, lazy loaders |
| `data-ki.ts` | Ki point tables |
| `data-actions.ts` | Action/bonus action data |
| `storage.ts` | localStorage roster helpers |
| `item-resolve.ts` | Custom item → registry fallback |
| `tag-renderer.tsx` | 5etools tag → JSX |
| `spell-restrictions.ts` | Multiclass spell slot rules |
| `campaign-rules.ts` | Campaign-level rule overrides |
| `sane-prices.ts` | Item price normalization |
| `conditions-calc.tsx` | Conditions calculator |
| `conditions-calc-data.json` | Conditions reference data |

### `shared/`

| File | Notes |
|---|---|
| `primitives.tsx` | `Spinner`, `Icon`, `ProfBadge`, `StatCard`, `ScoreBox` |
| `styles.css` | Global CSS, dark theme, CSS variables |
| `vite-env.d.ts` | Vite client type shims |
| `gis.d.ts` | Google Identity Services type shims |

### `features/`

| File | Notes |
|---|---|
| `drive-sync.ts` | Google Drive sync logic |
| `drive-sync-ui.tsx` | Drive sync UI components |
| `drive-client-id.ts` | OAuth client ID constant |
| `tweaks-panel.tsx` | `TweaksPanel`, `TweakSection`, `TweakToggle`, `useTweaks` |
| `plugin-api.ts` | Plugin API surface |
| `plugin-panel.tsx` | Plugin panel UI |
| `plugin-registry.ts` | Plugin registration and lookup |

### `tabs/`

| File | Notes |
|---|---|
| `tabs-5e.tsx` | Barrel — re-exports all tabs |
| `combat-tab-5e.tsx` | Combat tab |
| `feat-tab-5e.tsx` | Features tab |
| `invt-tab-5e.tsx` | Inventory tab |
| `spell-tab-5e.tsx` | Spellcasting tab |
| `notes-tab-5e.tsx` | Notes tab |
| `minion-tab-5e.tsx` | Vassals/minions tab |

### `views/`

| File | Notes |
|---|---|
| `app-5e.tsx` | Root sheet component — mounts tabs, sidebars, manages state |
| `sidebars-5e.tsx` | `LeftRail5e`, `RightRail5e` — persistent sheet layout |
| `builder-5e.tsx` | Character builder full-page form |
| `my-characters.tsx` | Roster/hub full-page view |

### `pages/` — no change

Vite multi-page entry points. Stay at `src/pages/`.

---

## Import Changes Per File

### `core/` — internal imports unchanged (all siblings)

Most core files import only from other core files. After moving they still use `./sibling` — no path changes needed within core.

**One exception — `core/data-5e.ts`:**
```
"./plugin-registry"  →  "../features/plugin-registry"
```

---

### `shared/primitives.tsx`

```
"./types"         →  "../core/types"
"./item-resolve"  →  "../core/item-resolve"
```

---

### `features/drive-sync.ts`

```
"./types"    →  "../core/types"
"./storage"  →  "../core/storage"
```

### `features/drive-sync-ui.tsx`

```
"./types"    →  "../core/types"
"./storage"  →  "../core/storage"
"./drive-sync"  →  unchanged (same dir)
```

### `features/plugin-api.ts`

```
"./types"           →  "../core/types"
"./campaign-rules"  →  "../core/campaign-rules"
```

### `features/plugin-registry.ts`

```
"./plugin-api"      →  unchanged (same dir)
"./types"           →  "../core/types"
"./campaign-rules"  →  "../core/campaign-rules"
```

### `features/plugin-panel.tsx`

```
"./plugin-registry"  →  unchanged (same dir)
"./tweaks-panel"     →  unchanged (same dir)
```

### `features/tweaks-panel.tsx`

No local imports — no changes.

### `features/drive-client-id.ts`

No local imports — no changes.

---

### `tabs/tabs-5e.tsx` (barrel)

All re-exports are siblings — no changes.

### `tabs/combat-tab-5e.tsx`

```
"./primitives"   →  "../shared/primitives"
"./data-registry"  →  "../core/data-registry"
"./tag-renderer"   →  "../core/tag-renderer"
"./item-resolve"   →  "../core/item-resolve"
"./invt-tab-5e"    →  unchanged (same dir)
"./types"          →  "../core/types"
```

### `tabs/feat-tab-5e.tsx`

```
"./tag-renderer"  →  "../core/tag-renderer"
"./types"         →  "../core/types"
```

### `tabs/invt-tab-5e.tsx`

```
"./primitives"    →  "../shared/primitives"
"./data-registry" →  "../core/data-registry"
"./tag-renderer"  →  "../core/tag-renderer"
"./item-resolve"  →  "../core/item-resolve"
"./data-5e"       →  "../core/data-5e"
"./types"         →  "../core/types"
```

### `tabs/spell-tab-5e.tsx`

```
"./data-registry"      →  "../core/data-registry"
"./tag-renderer"       →  "../core/tag-renderer"
"./spell-restrictions" →  "../core/spell-restrictions"
"./item-resolve"       →  "../core/item-resolve"
"./invt-tab-5e"        →  unchanged (same dir)
"./types"              →  "../core/types"
```

### `tabs/notes-tab-5e.tsx`

```
"./types"  →  "../core/types"
```

### `tabs/minion-tab-5e.tsx`

```
"./primitives"    →  "../shared/primitives"
"./data-registry" →  "../core/data-registry"
"./tag-renderer"  →  "../core/tag-renderer"
"./types"         →  "../core/types"
```

---

### `views/app-5e.tsx`

```
"./storage"          →  "../core/storage"
"./campaign-rules"   →  "../core/campaign-rules"
"./plugin-registry"  →  "../features/plugin-registry"
"./plugin-panel"     →  "../features/plugin-panel"
"./primitives"       →  "../shared/primitives"
"./data-5e"          →  "../core/data-5e"
"./data-actions"     →  "../core/data-actions"
"./data-registry"    →  "../core/data-registry"   (REGISTRY_PROMISE etc.)
"./sidebars-5e"      →  unchanged (same dir)
"./tabs-5e"          →  "../tabs/tabs-5e"
"./types"            →  "../core/types"
"./plugin-api"       →  "../features/plugin-api"
"./drive-sync"       →  "../features/drive-sync"
"./drive-client-id"  →  "../features/drive-client-id"
```

### `views/builder-5e.tsx`

```
"./storage"          →  "../core/storage"
"./campaign-rules"   →  "../core/campaign-rules"
"./plugin-registry"  →  "../features/plugin-registry"
"./plugin-panel"     →  "../features/plugin-panel"
"./types"            →  "../core/types"
"./tag-renderer"     →  "../core/tag-renderer"
"./data-registry"    →  "../core/data-registry"
"./primitives"       →  "../shared/primitives"    (if used)
```

### `views/my-characters.tsx`

```
"./storage"         →  "../core/storage"
"./types"           →  "../core/types"
"./drive-sync-ui"   →  "../features/drive-sync-ui"
"./drive-client-id" →  "../features/drive-client-id"
"./drive-sync"      →  "../features/drive-sync"
```

### `views/sidebars-5e.tsx`

```
"./types"  →  "../core/types"
```

---

### `pages/` — entry points only, stay in place

### `pages/sheet.tsx`

```
"../app-5e"    →  "../views/app-5e"
"../styles.css" →  "../shared/styles.css"
"../../plugins/index"  →  unchanged
```

### `pages/builder.tsx`

```
"../builder-5e"  →  "../views/builder-5e"
"../styles.css"  →  "../shared/styles.css"
"../../plugins/index"  →  unchanged
```

### `pages/roster.tsx`

```
"../my-characters"  →  "../views/my-characters"
"../styles.css"     →  "../shared/styles.css"
```

---

### `plugins/` — external consumers, import via `../src/`

The `plugins/` directory lives outside `src/` and imports with `../src/X` paths. These also needed updating.

| File | Changes |
|---|---|
| `d8-initiative.ts` | `../src/plugin-api` → `../src/features/plugin-api` |
| `free-feat.tsx` | `../src/plugin-api` → `../src/features/plugin-api`; `../src/types` → `../src/core/types`; `../src/data-registry` → `../src/core/data-registry`; `../src/tag-renderer` → `../src/core/tag-renderer`; `../src/data-ki` → `../src/core/data-ki` |
| `index.ts` | `../src/plugin-registry` → `../src/features/plugin-registry`; `../src/plugin-api` → `../src/features/plugin-api` |
| `standard-initiative.ts` | `../src/plugin-api` → `../src/features/plugin-api` |
| `traditional-short-rest.tsx` | `../src/plugin-api` → `../src/features/plugin-api`; `../src/types` → `../src/core/types`; `../src/data-registry` → `../src/core/data-registry` |
| `wounds-system.tsx` | `../src/plugin-api` → `../src/features/plugin-api` |

---

## Status: COMPLETE

All files moved. All imports updated (19 src files + 6 plugin files). Build clean — zero TS errors.

> The stub `src/config/` dir was renamed to `src/shared/` as part of the move.

---

## Vite Config Check

`vite.config.ts` entry points reference HTML files at the project root — no path change needed there. If path aliases (`@core`, `@shared`, etc.) are added later, add matching `paths` entries to `tsconfig.json`.
