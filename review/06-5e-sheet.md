# R6 — 5e Sheet Skin (deferred MASTER-CONTEXT phase 3)

**Goal:** second sheet reusing the layout/components with 5e rules — NOT a rules merge.
Source app: `merge/5edata/` (complete working 5e/BG3 sheet). Two viable strategies — ask user first.

## Strategy question (ask before any work)

**A. Port 5edata app into this repo** (entries `sheet5e.html` etc., its src adapted to our
`src/shared/` styles): heavy (its `data-5e.ts` = 1932 lines, tabs = ~10k lines, needs the ~100MB
5etools dataset wired in — NOT in this repo; user must supply). High effort, full feature set.

**B. Extract shared UI package first** (original `packages/ui` idea): move `src/shared/`
(styles.css, primitives, condition-bar) into `packages/ui`, both sheets import it; then port
5edata incrementally on top. Cleaner long-term, more up-front churn.

Recommend **B only when 5e sheet actually starts**; do nothing preparatory before then
(shared/ already has zero PoA imports by design — extraction stays trivial).

## Preconditions (whichever strategy)

- Locate the full 5etools data folder from the original 5edata repo (ask user for path;
  `merge/5edata/data-samples/` holds shape samples only).
- Decide storage namespace: keep `bg3_roster`/`bg3_active` (import users' existing localStorage)
  vs new keys. Ask user.
- Firebase/Drive/plugins: strip in v1 (CONTEXT.md marks them extras).

## Sketch (strategy B)

1. `packages/ui/` with styles + primitives; path alias `@ui`; both apps consume. No behavior change — commit.
2. Copy 5edata `src/core` (types, data-5e, data-registry, storage, item-resolve, tag-renderer) into
   `src5e/core/` unchanged; get `tsc` green against its own tsconfig include.
3. Entries: `roster5e.html`, `sheet5e.html`; port views/tabs one tab per commit
   (Combat → Features → Inventory → Spells → Notes), Playwright smoke each.
4. Cross-links: PoA roster gets a system switcher (PoA / 5e) — one nav bar component in `packages/ui`.

## Done criteria

- Both sheets build from one repo, one `npm run dev`, shared tokens, independent rules + storage.
- No PoA regression: full test suite + Playwright sheet smoke still green.
