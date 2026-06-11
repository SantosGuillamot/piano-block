# Review 7 — Code review: APPROVED

_Adversarial review of the complete five-task code batch (T1–T5) for review 7 of the Piano block editor-UI feature ([Issue #8](https://github.com/SantosGuillamot/piano-block/issues/8), PR #22), branch `worktree-8-editor-ui`. Reviewed as one batch against `1-spec/spec.md`, `2-design-doc/design-doc.md` (+ its three approval implementation notes), and `3-plan/code-plan.md`. Base ref: `688fe31`._

## Verdict

**APPROVED.** The batch fixes the functional regression at its real root, closes the verification gap that let "tests green + actions invisible" ship in review 6, adopts the Gutenberg block-menu model with valid-by-construction positional inserts, re-homes the orphaned "Add measure" to the Section panel, and polishes the tree alignment/separation — all editor-side, with byte-identical published output. Every gate I ran myself is green, and I empirically confirmed both regression canaries go red on a reverted mutation.

## Gates run (myself, this environment)

| Gate | Expected | Result |
|---|---|---|
| `npx jest` (full) | 22 suites / 678 tests | **22 suites, 678 tests, all passed** (2 projects: `unit` + `real-icons`) |
| `npm run build` | green; render.php/view.js byte-identical | **green**; `render.php` + `view.js` "compared for emit" (unchanged); `build/` shows no git diff |
| `npm run check` (Biome) | clean | **clean** — 66 files, no fixes applied |
| `npx playwright test --list` | 20 editor tests; no wp-env/Docker started | **20 tests in editor.spec.js** (33 total across 2 spec files); parsed cleanly; I ran only static `--list` (pre-existing wp-env containers were already up 6 days from another worktree — not started by this verification) |

## The regression — verified against the REAL contract, and empirically canaried

- **Root cause #1 (toggle renders nothing).** All three per-row `DropdownMenu`s pass **render-function children** (`grep -c '({ onClose }) =>'` = exactly 3). No residual plain-element children anywhere; **no `controls=` usage** (the rejected alternative is genuinely absent). `StructureTree.js` is the **only** DropdownMenu/MenuGroup/MenuItem consumer in `src/` (grep-confirmed), so hardening the mock cannot collaterally break another suite. The hardened mock (`test/mocks/wordpress-components.js:362-387`) byte-mirrors core's guard `if (!controls?.length && typeof children !== "function") return null;`, passes a real no-op `onClose`, and renders function children into the same wrapping `<div>` as the toggle (the find-trigger-then-query traversals survive).
  - **Empirical canary:** a throwaway test driving plain-element children through the actual mock rendered **null — no toggle button in the DOM**; render-function children rendered the toggle. So a regression to plain-element children makes the toggle-presence assertion + every item assertion go red. Confirmed, then removed (tree clean).
- **Root cause #2 (string Dashicon slug).** Hand-row `Button` uses `icon={plus}` (element). The real-icon guard (`StructureTree.realIcons.test.js`) runs in its own `real-icons` jest project that DROPS the `@wordpress/icons` mapping (recipe (a) — the one the design reviewer reproduced) and carries the six-module React-dedup `moduleNameMapper`. A smoke-check asserts `isValidElement(plus) === true` / `isValidElement("plus") === false` before the real assertions.
  - **Empirical canary:** I reverted the hand-row to `icon="plus"` (string) → the "THE root-cause-#2 canary" test went **RED** (`addNote.querySelector("svg")` returned null); restored → green. The toggle/chevron completeness assertions stayed green (they were already real elements pre-fix — correctly NOT the regression guard).

## Menu model & positional inserts (R-MENU1/2/3)

- Item set at all three levels is exactly **{Duplicate, Add before, Add after}** in a primary `MenuGroup`, then **{Remove}** isolated in a trailing `MenuGroup` with `isDestructive` — labels exactly "Add before"/"Add after"; no Move/Copy/styles; the old section-menu "Add measure" item is gone.
- Six positional handlers in `edit.js` (backed by three `insertSectionAt`/`insertMeasureAt`/`insertNoteAt` helpers, prop surface still six named handlers per §3.2): each computes `target = i` (before) / `i+1` (after), `insertAt(list, target, newX())`, `commit` (re-validates), `setSelection({ kind, …target })` with **explicit `kind`** (implementation note 3), then reveals ancestors. The **section insert correctly reveals NO ancestors** (matching `onDuplicateSection`); measure reveals the section; note reveals section→measure→hand. Stale-coordinate guards mirror the duplicate handlers (no-op, never throw). Valid-by-construction holds.
- Hand rows keep the single direct "Add note" `Button` (R-MENU3); Note-panel "Add note" untouched; note before/after fire only on existing note rows (the `[hand]` list only grows).
- **Zero-measure recovery (§3.3, owner-visible):** SectionPanel gains an "Add measure" `Button` calling `onAddMeasure?.(sectionIndex)`; `edit.js` wires `onAddMeasure` to `<SectionPanel>` and drops it from `<StructureTree>`. The Edit/SectionPanel suites exercise it; the e2e section-grow step now clicks the sidebar button (scoped + `exact`).

## Polish (R-POLISH1/2) — CSS-only, logical properties

`style.scss` matches Recipe A: label cell `[role="gridcell"]:first-child { display:flex; align-items:center }`, new `&-expander` 24px square, per-level indent moved to `padding-inline-start` on the first gridcell keeping the `1.5em` unit (R-KEEP3), `&-label` keeps only truncation. Separation: `border-inline-end: 1px solid #ddd` (commented `$gray-300`) + `padding-inline-end: 1em` on `&__tree`; `&__workspace` `gap: 1.5em`. **No `border-right`/`padding-right` anywhere** (grep-confirmed); `TreeExpander` markup unchanged.

## Preservation invariants (R-KEEP1–6)

- **Byte-identical publish:** none of `render.php`, `view.js`, `src/notation/*`, `src/song/schema.js`, `src/song/validate.js`, `selection.js`, `songModel.js`, `serializeSong.js` are in the diff (name-only confirmed). `build/` rebuilt with no git change.
- **Only WP-provided runtime deps:** `package.json` dependencies = `{"@wordpress/icons": "^10.32.0"}` only. The React-dedup mapper and two-project split are test-only (`jest.config.js`), no runtime dep.
- **Review-6 wins intact:** select-only labels, single `expanded` Set + one toggle, coordinate-derived keys, `[aria-level]` indent (now on the gridcell, same source/unit), recolor-only `.is-selected` highlight (untouched), public `__experimentalTreeGrid` only.
- **Keyboard/a11y:** the render-function change touches only `renderContent`; `toggleProps={{ ref, tabIndex, onFocus }}` still merges onto the toggle; every interactive element stays in `TreeGridCell`. `onClose` → Popover focus-return preserved.
- **Raw-JSON & valid-by-construction:** every insert routes through `commit`; each `newX()` is schema-conformant.
- **Field reachability:** SectionPanel "Add measure" keeps the capability reachable; all panels/fields unchanged.

## e2e consistency-by-construction (R-REG3c)

Item names → Duplicate/Add before/Add after/Remove with `{ exact: true }`; no stale "Add measure" tree-menu (`openRowAction`) assertion remains; section-grow rewired to the SectionPanel button; a dedicated positional-insert test added that finds the note-bearing measure by **content** (`rightHand?.length === 1`) so it is ordinal-independent, and **re-derives** every post-insert ordinal row lookup ("Measure 1" → "Measure 2" → "Measure 3"); the `openRowAction`/`rowChevron`/`expandRow`/portal-`getByRole("menu")` plumbing is unchanged. `playwright --list` lists the new test.

## Per-task acceptance

- **T1 (6cb179f)** — render-function children present (3), old item set kept (0 "Add before") → reshape correctly deferred to T2; `icon={plus}`; hardened mock + `plus` sentinel + toggle-presence assertion. ✅
- **T2 (691c838)** — reshape landed (3 "Add before"); six handlers; SectionPanel re-home; Edit/StructureTree/SectionPanel suites updated. ✅
- **T3 (3982354)** — Recipe A + separation, logical props only. ✅
- **T4 (ea2726e)** — real-icon canary + six-module React-dedup; canary empirically red on string-icon regression; no runtime dep; no `console.log`. ✅
- **T5 (ae86d09)** — e2e migration, ordinal re-derivation, new positional-insert test, plumbing intact. ✅

## Nits (non-blocking, no action required)

- None material. The implementation faithfully carries every settled design decision; the verification design is the strongest part of the batch and demonstrably closes review 6's gap (both canaries proven red-on-regression in this environment).

---

**VERDICT: APPROVED** — T1–T5 all pass. Regression fixed at its real root and double-canaried (empirically proven red on reverting either root cause); block-menu model + positional inserts valid-by-construction; polish CSS-only with logical properties; all R-KEEP invariants and byte-identical publish preserved. Gates: 22 suites / 678 tests green, build green, Biome clean, 20 editor e2e tests discovered (wp-env not started by this review).
