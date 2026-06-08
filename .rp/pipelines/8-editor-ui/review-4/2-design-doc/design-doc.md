# Design doc: Review 4 — Structure-tree polish

## Overview

Review 3 made a left **structure tree** (Section → Measure → {Right hand, Left
hand} → Note, built on `@wordpress/components`' `__experimentalTreeGrid`) the
author's primary way to navigate and select the Piano block's song. The tree sits
in a toggleable panel beside the canvas; the canvas is display-and-highlight only;
selecting a tree node both highlights the matching element on the canvas and opens
its settings in the right inspector; and the tree offers add / remove / duplicate
per level plus rename for sections and measures.

Review 4 is a **polish pass** on that experience. It flips the tree to open by
default, indents rows by depth, themes the per-row action buttons, removes the
section/measure canvas highlight while shrinking the note highlight, reorders the
inspector panels most-specific-first, and fixes a collapse bug where manually
collapsing an ancestor of the current selection sprang back open.

Every change is **editor-side**: the song format/schema, the server render
(`src/render.php`), and the front-end SVG rendering (`src/view.js`,
`src/notation/*`) are unchanged, and no outside runtime dependency is added. The
work lives entirely in four files: `src/edit.js`, `src/editor/StructureTree.js`,
`src/editor/SongCanvas.js`, and `src/style.scss` (plus stale doc comments and the
unit tests that encode to-be-changed behavior).

This document traces to the spec's Requirements (Req 1–9) and Acceptance Criteria
(AC1–AC9).

## Approach

Each requirement is a small, localized change to existing code. Eight of the nine
are pure presentation or a one-line state/JSX edit; the only change with real logic
is the collapse fix (Req 7), because it changes how a row's expansion is *derived*.

- **Req 1 (open by default):** flip the `showTree` initializer from `false` to
  `true`. Persistence already holds — nothing resets it.
- **Req 2 (indented hierarchy):** drive indentation from an inline `--pb-tree-depth`
  CSS variable set on each row's label cell, computed from the `level` prop the
  code already passes, consumed by one SCSS rule. No dependence on the rendered
  `aria-level` DOM attribute.
- **Req 3 (theme-styled controls):** add `variant="tertiary"` to the per-row action
  `Button`s (keep `isDestructive` on removes).
- **Req 4 (no section/measure highlight):** remove the section and measure branches
  in `SongCanvas` `decorateSelection` plus the `.is-active-section` /
  `.is-active-measure` CSS; keep `.is-selected`.
- **Req 5 (smaller note highlight):** reduce `.is-selected` to
  `outline: 1px solid #007cba; outline-offset: 1px`.
- **Req 6 (panel order):** reorder the `InspectorControls` JSX to Note → Measure →
  Section → Song, gates unchanged.
- **Req 7 (reliable collapse):** add a second editor-only Set, `collapsedOverride`,
  and change `isExpanded` from `manual OR ancestor` to
  `ancestor ? !collapsedOverride.has(path) : expandedPaths.has(path)` — a pure-render
  veto that lets a manual collapse beat the auto-reveal (Option B; see Key
  Decisions).
- **Req 8–9 (boundary / deps):** falls out by construction — no touched file is on
  the front-end path and no new import is added.

No new component, no new module, and no change to the kind-tagged selection model
(`resolveSelection`).

## Components

The change set is confined to four files. No file is created or deleted.

- **`src/edit.js`** — the mode container and single owner of `working` + `commit`.
  Holds the editor-only UI state (`mode`, `selection`, `showTree`, `expandedPaths`)
  and the lifted structural mutators. Review 4: flips the `showTree` initializer
  (Req 1), adds the `collapsedOverride` Set and its toggle wiring (Req 7), and
  reorders the `InspectorControls` JSX (Req 6).
- **`src/editor/StructureTree.js`** — the controlled selection surface built on
  `__experimentalTreeGrid`. Holds no song state. Review 4: sets the
  `--pb-tree-depth` var on each label cell (Req 2), adds `variant="tertiary"` to the
  per-row action buttons (Req 3), and changes `isExpanded` to consult
  `collapsedOverride` (Req 7).
- **`src/editor/SongCanvas.js`** — the display-and-highlight canvas. Review 4:
  removes the section and measure branches from `decorateSelection`, keeping the
  shared `measureNumber` computation and the event (note) branch (Req 4); updates
  the now-stale `is-active-*` doc comments.
- **`src/style.scss`** — block styles. Review 4: adds the depth `padding-left` rule
  (Req 2), removes the `.is-active-*` rules and their explanatory comment (Req 4),
  and shrinks the `.is-selected` outline (Req 5).

## Interfaces and data flow

The selection data flow is **unchanged**. `StructureTree` signals a kind-tagged
`selection` up through `onSelect` → `edit.js` `setSelection`; `resolveSelection`
(`src/selection.js`) resolves it against the working object every render; the
resolved selection drives (a) the canvas highlight (`SongCanvas`
`decorateSelection`) and (b) the kind-gated inspector panels. The selection payload
and `resolveSelection` are not touched.

Review 4 touches this flow in only two places:

1. **Expansion state (Req 7).** `edit.js` gains a second editor-only Set,
   `collapsedOverride`, alongside `expandedPaths`. `StructureTree`'s `isExpanded`
   changes from `manual OR ancestor` to `ancestor ? !override : manual`. The
   `StructureTree` prop surface gains the override Set and its toggle (threaded the
   same way `expandedPaths` / `onToggleExpanded` already are; whether the
   ancestor-vs-non-ancestor routing lives in `edit.js` or inside `StructureTree` is
   a plan/code shaping detail). The disclosure toggle on an **ancestor-of-selection**
   row writes the override (add on collapse, delete on re-expand); on a
   **non-ancestor** row it writes `expandedPaths` as today. The two Sets govern
   disjoint regimes, so they never conflict.

2. **Highlight (Req 4).** `SongCanvas` `decorateSelection` drops its section and
   measure branches. A section/measure selection still flows up, still gates panels,
   and still drives `aria-current` in the tree — it simply no longer decorates the
   canvas.

Everything else (Req 1 default flip, Req 2 indent var, Req 3 button variants, Req 5
outline shrink, Req 6 panel reorder) is local presentation with no data-flow change.

## Key decisions

Each decision traces to a spec Req/AC.

### KD1 — Open by default via `useState(true)` (Req 1 / AC1)

`src/edit.js:102` is the sole reason the tree starts closed:
`const [showTree, setShowTree] = useState(false)`. The toolbar toggle
(`edit.js:386-393`) and the render gate (`edit.js:432`) are otherwise complete, and
**`edit.js` has no `useEffect`** that could re-force it open — so a manual close
already sticks for the session.

**Decision:** flip the initializer to `useState(true)`. That is the entire change.
"Open by default" means default *on mount*, not persisted to attributes —
consistent with `mode` / `selection` / `expandedPaths`, all editor-only
(`edit.js:89-103`). AC1's "stays closed while they continue working" is
session-scoped, which plain UI state already satisfies; nothing in the spec implies
attribute persistence.

### KD2 — Indentation from the `level` prop via an inline CSS var (Req 2 / AC2)

Rows are built in `StructureTree.js` via `TreeGridRow` with an explicit
`level={1|2|3|4}` (section, measure, hand, note). `__experimentalTreeGrid` surfaces
`level` only as the `aria-level` ARIA attribute on the `<tr>`; it adds **no visual
indentation** (WP core's List View indents via a consumer-supplied left-padding
keyed off block level, not by TreeGrid). Today no SCSS rule reads depth, so rows
render flush-left at every level. The first cell of each row is the label `Button`;
the second cell holds the per-row action buttons.

**Decision:** set a CSS custom property (e.g. `--pb-tree-depth: {level - 1}`) on the
**label cell of each row only**, computed from the same `level` the code already
passes, and consume it with one SCSS rule, e.g.
`padding-left: calc(var(--pb-tree-depth, 0) * 1.5em)`. Section=0, measure=1, hand=2,
note=3 indent steps. The action-button cell is left untouched so it stays constant
while the label depth reads cleanly.

**Why this over a CSS `[aria-level="N"]` selector:** the chosen route depends only
on the `level` prop the component already controls — **zero** coupling to whether
the installed component version actually emits `aria-level` as a runtime DOM
attribute (unverifiable here, since `@wordpress/components` is a runtime external not
installed in this worktree). It is also WP-only with minimal markup churn (it
parametrizes an existing element with a style/CSS-var; no new element, no new import
— AC9). The depth *number* comes from JS (`level`); the indent *unit* and visual
live in `style.scss`. The pure-SCSS `[aria-level="N"]` selector is the recorded
fallback (it will most likely work in the live editor), but it carries the small
unverifiable runtime-DOM assumption, so the `level`-prop route is chosen.

### KD3 — `variant="tertiary"` on the per-row action Buttons (Req 3 / AC3)

All controls are `@wordpress/components` `Button` (imported `StructureTree.js:36`).
The **label/disclosure** buttons already carry `variant="tertiary"` and are themed.
The **per-row action** buttons (remove/duplicate section, add measure,
remove/duplicate measure, per-hand add note, remove/duplicate note) pass an `icon`
but **no `variant`** — an icon `Button` with no variant renders as a bare glyph with
no background/border, which outside a `Toolbar` reads as a floating white/transparent
button. The trailing "Add section" button uses `variant="secondary"` and is
correctly chromed; the contrast is what makes the per-row ones look unstyled.
`isDestructive` only tints the remove icon — it supplies no chrome.

**Decision:** give every per-row action `Button` `variant="tertiary"` — it matches
the row-label buttons already in the tree, keeps the compact per-row density of
List-View-style row actions, and inherits the editor/theme appearance (AC3). Keep
`isDestructive` on the remove buttons. `variant="secondary"` (heavier chrome) is
rejected for the per-row controls because the row would become visually crowded;
the trailing "Add section" button stays `secondary` as the one prominent primary-add
affordance.

### KD4 — Remove the section/measure canvas highlight (Req 4 / AC4)

`SongCanvas.js` `decorateSelection` branches by selection kind:
- a **section** branch (computes `measureNumbersForSection`, adds
  `is-active-section`, scrolls);
- a **measure** branch (adds `is-active-measure`);
- a **shared** `globalMeasureNumber` null-guard / `measureNumber` computation that
  the **event** branch also consumes;
- the **event** branch (the note highlight, adds `is-selected`).

**Decision:** remove the **section branch** and the **measure branch**, leaving the
shared `measureNumber` computation (still needed by the event branch) and the event
branch intact. A section/measure selection then decorates nothing — exactly AC4. In
`style.scss`, remove the `.is-active-measure, .is-active-section` rule, the
`.is-active-section` outline-color override, and the explanatory comment; keep
`.is-selected`. Update the now-stale `SongCanvas.js` doc comments that describe the
`is-active-*` branches.

A better section/measure indication is an explicit later follow-up (spec Out of
Scope 1); this review only removes the current one. The kind-tagged selection model,
panel gating, and tree `aria-current` are untouched.

### KD5 — Reduce the note highlight to a subtle outline (Req 5 / AC5)

The only rule is `style.scss:80-83`: `outline: 2px solid #007cba; outline-offset:
2px;`, drawn on the SVG `<g>` so it never affects layout. The "heavy" appearance
comes from the `2px` width plus `2px` offset.

**Decision:** reduce to `outline: 1px solid #007cba; outline-offset: 1px;`. Keep the
WP admin blue (`#007cba`) so the highlight stays recognizable. Single-rule change.
The exact px values are a judgment call within the "subtle/smaller" intent; 1px/1px
is the recommendation.

### KD6 — Most-specific-first panel order (Req 6 / AC6)

Current `InspectorControls` source order (`edit.js:457-492`) is `SongPanel` (always)
→ `NotePanel` (event-gated) → `MeasurePanel` (event|measure-gated) → `SectionPanel`
(any selection) — least-specific first, the exact reverse of AC6. Panels render in
JSX source order (no `priority`/order prop is in use).

**Decision:** reorder the JSX so panels render most-specific-first with `SongPanel`
**last**, keeping every existing gate verbatim:
1. `NotePanel` — gate `resolvedSelection?.kind === "event"`.
2. `MeasurePanel` — gate `kind === "event" || kind === "measure"`.
3. `SectionPanel` — gate `resolvedSelection` (truthy; every kind has a section).
4. `SongPanel` — always.

The existing gates already produce the exact per-kind sets AC6 specifies (note →
Note/Measure/Section/Song; measure → Measure/Section/Song; section → Section/Song;
nothing → Song); **only the order changes.** Update the gating comment at
`edit.js:459-463` to describe the new order.

### KD7 — Collapse fix: Option B, a pure-render collapsed-override veto (Req 7 / AC7)

This is the only change in Review 4 with real logic.

**Root cause (confirmed, exhaustive).** Expansion is *derived*, not just stored.
`StructureTree.js:130-132`:

```
const isExpanded = (path) =>
    (expandedPaths?.has(path) ?? false) ||
    isSelectionAncestor(path, selection);
```

The `|| isSelectionAncestor` term (helper at `StructureTree.js:71-85`, building the
selection's `s{i}`, `…/m{j}`, `…/{hand}` ancestor paths) is the **sole** mechanism
that re-reveals a manually-collapsed ancestor. There is **no `useEffect` anywhere in
`edit.js`** (it imports only `useMemo, useState`); `setExpandedPaths` is written only
inside `onToggleExpanded`; nothing seeds the Set from the selection. `StructureTree`
holds no state and no effects — `isExpanded` is recomputed every render. So a manual
`delete` from the Set is immediately overridden on the next render for any path in
the selection's ancestor set.

**Why "sometimes."** The section/measure label `onClick` does **both**
`onToggleExpanded(path)` and `onSelect({…})`, so a collapse click also re-selects
that node, putting its own path into the selection's ancestor set, which the OR then
re-expands. It bites exactly AC7: a note is selected and the author collapses an
ancestor section/measure — that ancestor is in the note's ancestor set, so it springs
back open.

**The decisive fact (select-and-toggle coupling).** Re-selecting an already-selected
node passes a **fresh object literal** every click, and `resolveSelection` returns a
fresh object every render. React's `useState` setter bails a re-render only on
`Object.is` (reference) equality, so a value-equal new literal still re-renders.
This is what makes the collapse click re-assert the selection whose ancestor set
includes the just-collapsed path — and it is the fact that decides between the two
fix shapes.

**Decision — Option B (collapsed-override veto, pure render):**

```
isExpanded(path) =
    isSelectionAncestor(path, selection)
        ? !collapsedOverride.has(path)
        : expandedPaths.has(path)
```

- Keep the live `isSelectionAncestor` call, so the "selected branch revealed"
  guarantee and its staleness-immunity are retained **verbatim** from today.
- Add a second small Set in `edit.js` state, `collapsedOverride`, with the same
  immutable add/delete shape as `expandedPaths`. The disclosure toggle on an
  **ancestor-of-selection** row writes the override (add on collapse, delete on
  re-expand); on a **non-ancestor** row it writes `expandedPaths` as today. The two
  Sets govern disjoint regimes, so they never conflict.
- Drop the bare `||`, so auto-expand of an ancestor becomes *vetoable* by the
  override.

**Why B over A (single Set + seed-on-selection-change effect):**
1. **Fewest moving parts that can go wrong.** B is pure render: no `useEffect` added
   to `edit.js` (which has none today), no dependency array. The cost is one extra
   Set with the same trivial add/delete logic the code already has. Option A would
   add the first effect *and* a load-bearing dependency-key contract.
2. **No reliance on `setSelection` referential subtleties — decisive.** Because the
   collapse click passes a fresh, value-equal selection literal, **Option A is
   correct only if its seed effect is keyed on a *derived ancestor-identity string*,
   not on `selection`.** Keying on `selection` (the obvious implementation) sees a
   changed reference, re-runs the effect, and re-seeds the path just deleted —
   silently reintroducing the exact bug. That is a real implementer footgun. B
   observes no cross-render selection identity at all; it recomputes `isExpanded`
   from current props every render, so the fresh-literal behavior is irrelevant to
   it.
3. **Survives index-path staleness.** Both survive. B inherits today's mechanism for
   free: `isSelectionAncestor(path, selection)` is recomputed live from the *current*
   selection every render, so after a structural edit that shifts indices and the
   handler `setSelection`s the new indices (`onDuplicateSection` → `sectionIndex+1`;
   `onDuplicateMeasure` → `measureIndex+1`; `onDuplicateNote` → `eventIndex+1`;
   `onAddNote` → new `insertIndex`), the new branch's rows return `true` and
   auto-expand — identical to the live OR. No seed timing involved.

**Alternative recorded for the planner — Option A (single Set,
seed-on-selection-change).** Add a `useEffect` to `edit.js` that seeds
`expandedPaths` with the **resolved** selection's ancestor paths and drop the live
`isSelectionAncestor` from `isExpanded`. Viable and keeps a single Set, but **only
correct if the effect is keyed on the derived ancestor-identity string** (seeding
from `resolvedSelection` so a stale selection seeds nothing). The planner may prefer
A on a "one Set, no second collapsed-set" basis, but **must** document the
derived-string dep key as load-bearing — keying on `selection` regresses the bug. B
is the chosen approach for its robustness (no effect, no dep-key footgun, live
staleness-immunity); A is the acceptable single-Set alternative with that caveat.

**Residual wart (acknowledged, not new).** `collapsedOverride` is itself
index-path-keyed, so a stale override string could rarely suppress auto-expand of a
*different* node that later occupies that exact index-path after a structural edit.
This is the same "best-effort, index-path-keyed Set" wart that already applies to
`expandedPaths` (`edit.js:99-101`); it is not a new class of problem and does not
affect the AC7 guarantee. Optional tidiness (not required): prune the override when
its path stops being an ancestor — the `else` branch already ignores it.

### KD8 — Editor-side-only boundary, no new dependency (Req 8–9 / AC8–AC9)

Every change above touches only `src/edit.js`, `src/editor/StructureTree.js`,
`src/editor/SongCanvas.js`, and `src/style.scss` (plus stale doc comments and
tests). None touches `src/render.php`, `src/view.js`, `src/song/schema.js`, or
`src/notation/*`. The SVG emit and its `data-*` hooks are untouched, so a published
page renders byte-identically (AC8). No new import is introduced — the only
components referenced (`Button`, `TreeGrid*`, `InspectorControls`, the panels) are
already imported, and the indentation fix is CSS/inline-style only (AC9). Clean by
construction.

## Dependencies

- **No new runtime dependency** is added (Req 9 / AC9). All code uses
  `@wordpress/components`, `@wordpress/i18n`, and the block's own modules, all
  already in use.
- **Internal:** `StructureTree` continues to consume the lifted `edit.js` handlers
  and the resolved selection; `SongCanvas` continues to consume the resolved
  selection. The only new internal interface is the `collapsedOverride` Set and its
  toggle, threaded into `StructureTree` the same way `expandedPaths` /
  `onToggleExpanded` already are.

## Failure modes and observability

This is editor-side UI with no network or async surface; "observability" is the
editor's own render behavior. The relevant failure modes:

- **Stale selection** (node removed or song re-parsed): `resolveSelection` already
  returns `null`, so highlight + panels fall back to none / Song-only — unchanged by
  Review 4.
- **Stale index-path in `expandedPaths` / `collapsedOverride`**: a pre-existing
  best-effort wart (`edit.js:99-101`). The Req 7 fix neither improves nor worsens it
  and never breaks the AC7 guarantee, because `isSelectionAncestor` is recomputed
  live from the current selection every render (see KD7).
- **Missing `aria-level` at runtime** (Req 2): avoided by design — indentation is
  derived from the `level` prop, not the ARIA attribute, so it cannot silently fail
  if the installed component version's ARIA wiring differs (see KD2).
- **Invalid/empty song**: the visual branch is gated by `isInvalid` / seeding in
  `edit.js`; none of Review 4's changes alter that gate, so invalid songs still route
  to raw JSON and empty songs still seed an empty grand staff.
- **Front-end regression**: structurally precluded — no front-end file is touched and
  the SVG emit is byte-identical (KD8 / AC8). The verifiable signal is that
  `render.php` / `view.js` / `notation/*` show no diff.

## Risks and open questions

### Risks

- **R1 — the collapse fix (KD7).** It is the only change with real logic; getting it
  wrong either re-breaks manual collapse or hides a selected leaf. Mitigation
  (decided): Option B — keep the live `isSelectionAncestor` reveal, layer the
  `collapsedOverride` veto (`ancestor ? !override : manual`), drop the bare OR; pure
  render, no `useEffect`, no dep-key footgun. **Pin AC7 with a test:** select a leaf,
  manually collapse its ancestor, assert the ancestor stays collapsed (and its
  descendants hidden) on the next render. The existing "auto-expands the selection's
  ancestors" test (`StructureTree.test.js:418-438`) stays valid (with no override
  entry an ancestor still auto-expands); the new test adds the override case. If the
  planner instead takes Option A, its derived-string effect dep key is load-bearing
  and must be documented.

- **R2 — tests encoding to-be-changed behavior.** Several unit tests assert the
  current behavior and must be updated alongside the code: open-by-default mount in
  `Edit.test.js` (the tree-presence assertions now expect the tree present by
  default); `is-active-measure` / `is-active-section` decoration cases in
  `SongCanvas.test.js` (those assertions are removed); tree-presence/expansion cases
  in `StructureTree.test.js`. Flagged for the plan/code phase, not a design blocker.
  The indentation change introduces **no** test-contract change (tests assert
  `aria-level` via the mock for ARIA wiring, which is unaffected — the indent is a
  separate inline var); the button-variant and panel-reorder changes likewise change
  no test contract (tests locate buttons by `aria-label` and assert panel *presence*
  by kind, not variant or DOM order).

### Open questions

- **OQ1 (planner, low priority).** After KD4, `measureNumbersForSection`
  (`selection.js:185-194`) becomes **dead code** — it was consumed only by the
  removed section branch. It is pure, exported, and harmless to leave, but the
  recommendation is to **prune it** for cleanliness. Non-blocking either way; editor-
  side only.
