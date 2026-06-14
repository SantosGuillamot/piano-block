# Review 9 — Design Doc: front-end placeholder-border leak + inspector-UI cleanup + reuse/simplification

Phase-3 design for review-9 of the Piano block (WordPress plugin; issue #8, PR #22).
This document is **standalone**: a reader who opens only this file should understand
the architecture context, the per-item change design (where each change lives, the
component/API shape), the test strategy, and the trade-offs — without opening the
spec or the research. Where this design diverges from the review's literal wording,
the rationale is carried inline so no later phase has to reconstruct it.

This is **design** (architecture + decisions + interfaces + test strategy), not a
task-by-task breakdown — that is phase 4 (plan). File/line references are evidence
and starting points confirmed against the live tree at branch `worktree-8-editor-ui`
(tip `c7a25d1`); they will shift as fixes land, so later phases must re-confirm exact
coordinates.

---

## 1. Architecture context (what already exists, and what this review does NOT touch)

The Piano block is a Gutenberg block that renders sheet-music notation as an SVG. It
has two halves:

- **Editor UI** — a structure tree built on the real `@wordpress/components`
  `__experimentalTreeGrid` primitive (the same one core's List View uses), a live
  canvas preview, and inspector/sidebar panels that edit a JSON song model. The
  controlled-component split, the TreeGrid keyboard accessibility, and the shared
  helpers (`songModel`, `emit`, `edit`, `validate`) are already sound.
- **Front-end render** — `render.php` → `view.js` → an SVG drawn into the block
  wrapper (`.wp-block-piano-block-piano`). Unchanged by this review except that M1
  *removes* a leaked editor style from it.

**Hard invariant for this entire review:** everything stays **editor-side**. The song
format/schema, `render.php`, and the front-end SVG rendering are unchanged — a
published song renders **byte-identically** before and after. M1 only removes a leaked
editor style; it does not alter how the SVG is drawn. Only `@wordpress/*` packages
already available to blocks may be used; no new outside dependencies (`@wordpress/icons`
is already bundled on this branch).

### Standing test constraint (governs every test-strategy choice below)

**"Tests green" must stay incompatible with "real component broken."** The unit suite
mocks `@wordpress/components` (`test/mocks/wordpress-components.js`), and that mock does
not faithfully reproduce every real contract. Where a fix rides a real
`@wordpress/components` / `@wordpress/icons` contract or a build-output fact, the
verification must exercise the **real** contract or the **emitted** artifact — not only
the jest stub. The mock facts that decide unit-vs-e2e per item:

- `Button`: accessible name = `ariaLabel ?? label` — an explicit `aria-label` overrides
  the visible text (matches the real component for this purpose).
- `SelectControl`/`NumberControl`/`TextControl`/`TextareaControl`: set
  `"aria-label": label` then spread `...rest` — a separately-passed `aria-label` lands
  in `...rest`, is spread last, and **overrides** the label-derived name. The researcher
  confirmed this matches Gutenberg trunk: the real components also spread `{...restProps}`
  onto the native element after the named `label`, so a consumer `aria-label` reaches the
  real `<select>`/`<input>` and (per ARIA precedence) overrides the `<label>`-derived
  accessible name.
- `HStack`: **swallows `alignment`** — renders a bare `<div>`. So S4's `alignment` prop
  is **not** unit-observable; a `className` passed via `...rest` DOES reach the `<div>`.
- `ToolsPanel`/`ToolsPanelItem`: render children unconditionally; `ToolsPanel` exposes
  `label` as `aria-label`. So S2 title renames ARE unit-testable. The `ToolsPanel` mock
  **swallows `resetAll`** — so S10's swap is unit-unobservable.
- `DropdownMenu`: render-function children, content rendered inline (always queryable);
  returns `null` for plain-element children (mirrors core's guard).
- **No `ConfirmDialog` / `__experimentalConfirmDialog` exists in the mock** — S7 must
  extend it.

### "Explicitly fine as-is" — design constraints (do NOT change)

The review validated these as correct; this design treats them as hard constraints:

- **TreeGrid keyboard accessibility** — `aria-label`, `onExpandRow`/`onCollapseRow` →
  the shared `data-expansion-key` handler, `isExpanded` + `data-expansion-key` on every
  expandable row, leaf notes carrying neither, the roving `cellProps`, the real-browser
  Playwright Arrow-key test, and the `aria-hidden`/pointer-only chevron (mirrors core's
  `ListViewExpander`). Do not rework.
- **`__next40pxDefaultSize` universality**; `__nextHasNoMarginBottom` is correctly never
  passed to any `NumberControl`. Element-imported icons, `isDestructive`, and `sprintf`
  + `__` i18n are clean — do not touch.
- **Load-bearing duplication that must stay:** the depth-fixed
  `setSectionAt`/`setMeasureAt`/`setEventAt` helpers (collapsing them would corrupt the
  song); `omitEmpty` vs `omitFalsy` (different rules); the per-panel `resetAll` key sets
  (different per level — only SectionPanel's same-file dup is S10); the hand-group row's
  bespoke non-selecting label cell.
- **Prior-review wins:** select-only labels (now *extended* by S5 to select-and-reveal,
  not undone), the single expansion `Set`, coordinate keys, the `[aria-level]` indent,
  the recolor-only event highlight, the TreeGrid keyboard model, and raw-JSON mode.
- **The front-end `view.js` validator gate** stays on `validateSong` (unchanged); it is
  NOT refactored to `parseAndValidate` (S9).

### Three spec-claim corrections inherited by all downstream phases

The research corrected three claims the spec made; downstream phases inherit these:

1. **S1 is NOT zero test churn.** It has real unit churn: 3
   `buttonByText("Right hand add alteration")` sites must become
   `buttonByText("Add alteration")` (the AddButton's *visible* text changes under the
   OPT-1 split). See S1 test strategy.
2. **S10's reset swap is unit-unobservable.** The `ToolsPanel` mock swallows `resetAll`,
   and no existing unit test drives it, so the spec's "existing reset test stays green"
   is *vacuously* true. The swap is byte-identical and needs no test update. See S10.
3. **S5 makes two e2e docblocks stale.** Both the `treeRow` and `expandRow` helper
   docblocks in `specs/editor.spec.js` currently assert the label is "select-only" and
   "no longer toggles/expands"; after S5 that is stale for section/measure rows. Both
   must be updated. See S5.

---

## 2. Per-item change design

### M1 — Remove the front-end placeholder-border leak (Must)

**Problem.** `src/style.scss` defines `.wp-block-piano-block-piano { border: 1px dashed
#767676; padding: 1em; color: #767676; }` (the `create-block` scaffold placeholder
style), and `src/block.json` loads `style.scss` as `"style"` (front end AND editor). The
emitted `build/style-index.css` therefore carries that rule while the editor bundle
`build/index.css` does not — a pure front-end leak. On a published page the wrapper holds
the *finished* rendered SVG, so every published piano block draws its sheet music inside a
dashed-gray "empty block" placeholder box with gray ink bleed and `1em` padding.

**Design — pure removal, no new home.**

1. `src/style.scss`: delete the `.wp-block-piano-block-piano { border/padding/color }`
   rule (`~:25-29`). **Keep `@font-face` (`~:17-23`) verbatim** — the front-end SVG glyphs
   need the font. After this, `style.scss` carries **only** `@font-face` on the front end.
2. `src/style.scss` header (`~:1-5`): drop "and the shared wrapper rules"; describe
   style.scss as carrying **only** `@font-face` on the front end.
3. `src/editor.scss` headers: the file header (`~:1-6`) and the in-block comment (`~:9-16`)
   both repeat the stale "shared wrapper rules (border, padding, color)" claim. **Fold M1's
   comment fix and the Optional `editor.scss` duplicate-header trim (polish item 6) into one
   accurate description** — after M1, style.scss carries only `@font-face` front-end-side,
   and editor.scss carries the editor-only surface rules. One accurate header, not two stale
   ones.
4. **No editor-only replacement affordance is added.** The review's "if an editor-only
   affordance is wanted, add a scoped version to `editor.scss`" is explicitly declined: no
   other review item needs a wrapper border (spec M1.3). M1 is a pure removal.

**Test strategy — build-output, NOT source-only.** This is the canonical "emitted
artifact" verification. No unit test pins the wrapper rule today (grep-confirmed), so the
deletion breaks no existing test. The *new* verification is a build-output assertion: run
`npm run build`, then assert `build/style-index.css` no longer contains the wrapper
`border`/`padding`/`color` rule (it retains only `@font-face` referencing the woff2
`url()`), and that `build/index.css` (editor) is unaffected. This is an explicit
code-phase build+grep step, not a source-only check.

---

### S1 — Drop the redundant "Right hand / Left hand" per-control prefix (Should)

**Problem.** `HandConfigEditor.fieldLabel(field)` (`~:101-109`) composes
`sprintf("%1$s %2$s", label, field)` when a `label` is present, producing "Right hand
clef", "Right hand octave shift", "Right hand alteration note", "Right hand alteration",
the add button "Right hand add alteration", and the remove button "Right hand remove
alteration". In the narrow inspector these wrap to 2–3 lines and repeat for the left hand;
in the tiered layout each hand already has its own `ToolsPanelItem` titled "Right
hand"/"Left hand", making the prefix doubly redundant.

**Mechanism (fixed by spec — OPT-1).** Bare visible `label` + hand-scoped `aria-label`.
This is honest on the real component (not a mock-only trick): the real
`SelectControl`/`NumberControl` render `label` as a visible `<label>` and spread
`{...restProps}` (including a consumer `aria-label`) onto the native element after the
named `label`, so the `aria-label` reaches the real element and overrides the
`<label>`-derived accessible name. A flat-layout per-hand visible heading is **OMITTED**
(see below).

**Where each change lives — `HandConfigEditor.js`.** Keep `fieldLabel` composing the
hand-scoped name; split each control's labelling into two props: the **bare field** (title-
cased) as the visible `label`, and the **hand-scoped** string as `aria-label`. Shape:

```jsx
<SelectControl
  label={__("Clef", "piano-block")}                   // bare visible label (title-cased)
  aria-label={fieldLabel(__("clef", "piano-block"))}   // hand-scoped accessible name
  …
/>
```

Applied to: clef `SelectControl` (`~:130`), octave `NumberControl` (`~:140`),
alteration-note `SelectControl` (`~:160`), alteration `NumberControl` (`~:170`), the
per-row trash `Button` (`~:188`, bare/icon-only visible affordance +
`aria-label="Right hand remove alteration"` per hand), and the `AddButton` (`~:195`).

**Capitalization design note.** Today the bare fields are lower-case fragments ("clef",
"octave shift") that read as a sentence tail *after* the hand label. As **visible** labels
they should read as proper field labels — "Clef", "Octave shift", "Alteration note",
"Alteration", "Add alteration" (the spec's exact visible strings). So the visible `label`
strings get title-case, while the `aria-label` keeps composing via
`sprintf("%1$s %2$s", hand, field)` for translator reordering, with `fieldLabel`'s `field`
argument staying the lower-case fragment so "Right hand clef" reads naturally. This means
**two distinct i18n strings per control** (a title-cased visible label and a lower-case
fragment fed to `fieldLabel`) — acceptable, and the cleanest honest split.

**`AddButton` (`ListControls.js`) — additive `aria-label` passthrough.** Today
`AddButton({ onClick, label })` renders `<Button variant="secondary" icon={plus}>{label}
</Button>` with no `aria-label`. Add an optional `aria-label` (or `ariaLabel`) prop
forwarded to the inner `Button`'s `aria-label`, so the visible children stay "Add
alteration" while the accessible name becomes "Right hand add alteration". This is a small
**additive** prop. The other two `AddButton` callers (`PitchList` "Add pitch",
`AnnotationList` "Add annotation") pass no `aria-label`, so their accessible name stays the
visible text (unchanged). The `Button` mock already maps `ariaLabel ?? label`, so the
passthrough is honored in unit tests and on the real component.

**Flat-layout per-hand heading — OPTIONAL, design OMITS it.** The spec downgraded the flat
(SectionPanel) per-hand "Right hand"/"Left hand" heading to optional sighted-UX polish;
a11y is carried by the `aria-label`s. **This design omits it.** Rationale: a `fieldset` +
`legend` (the cheapest real, dependency-free option) buys only sighted grouping at the cost
of a CSS reset for the default fieldset chrome and a visual change to a panel no acceptance
criterion requires; the `aria-label`s already disambiguate the two hands for AT, and
omitting keeps the change surface minimal and test-churn-free. If a future reviewer wants
the sighted heading, `fieldset` + `legend` is the recommended mechanism — but it is
explicitly out of this design. The tiered layout's existing per-hand `ToolsPanelItem`
heading is unchanged.

**Test strategy — CORRECTS the spec's "zero churn" (correction #1).** OPT-1 keeps every
control's **accessible name** hand-scoped, so all queries *by accessible name* pass
unchanged. But one set of queries hits **visible text**, and those churn:

- **Stays green (accessible-name queries):** clef/octave/alteration-note/alteration queried
  via `fieldByName` = `[aria-label="Right hand clef"]` (e.g.
  `contextControls.test.js:234,251,275,290,338`; `SongPanel.test.js:219,226`), and the
  **remove**-alteration `Button` via `buttonByName` = `aria-label` match
  (`contextControls.test.js:365`). OPT-1 preserves those `aria-label`s.
- **MUST update (visible-text queries):** the **add**-alteration button is queried by
  `buttonByText` (= `button.textContent === name`) at `contextControls.test.js:347,371,385`,
  all `"Right hand add alteration"`. Under OPT-1 the AddButton's *visible text* becomes bare
  `"Add alteration"`, so these three calls change to `buttonByText(container, "Add
  alteration")` (or switch to `buttonByName(container, "Right hand add alteration")`).
  Whole-suite grep confirms these three are the **only** visible-text queries touching a
  HandConfig control; every other `buttonByText` (Add pitch / Remove section / Add
  annotation / …) is a different control whose label does not change under S1.
- **One additive unit assertion (S1 acceptance):** assert the add button's *accessible name*
  is "Right hand add alteration" while its *visible text* is "Add alteration" (locks the
  OPT-1 split). Optionally assert a control shows bare visible "Clef" while accessible name
  stays "Right hand clef".
- **e2e churn = ZERO (confirmed).** Whole-spec grep: no `getByLabel`/`getByText` targets a
  HandConfigEditor inspector control. Every "Right hand"/"Left hand" e2e string is a tree row
  (`treeRow`), an action-menu label, or `expandRow("Right hand")` — none of which S1 touches.
- **Real-component proof (standing constraint):** because the mock and the real component
  both let a passed `aria-label` override the named `label`, one e2e/real-component check must
  confirm a control's **visible** label reads bare "Clef" while its **accessible name** stays
  "Right hand clef" — proving the override on the real `<select>`/`<input>`/`Button`, so a
  green mock can't mask a real regression. This is the one place OPT-1 must be proven against
  the real component.

---

### S2 — Rename the four "Advanced" panels; collapse SectionPanel's double wrapper (Should)

**Problem.** Four panels are literally titled "Advanced": `NotePanel` (event optional
members), `MeasurePanel` (barlines + annotations), `SectionPanel` (section overrides), and
`ContextEditor` tiered (Song panel). Three can stack in one sidebar for an event selection
and all read identically.

**Design — four distinct domain titles.** (Exact wording is a design nicety; the intent —
four distinct domain titles — is fixed.)

- `NotePanel.js:157` → `__("Note details", "piano-block")`.
- `MeasurePanel.js:93` → `__("Barlines & annotations", "piano-block")`.
- `SectionPanel` `ToolsPanel` → `__("Section overrides", "piano-block")`.
- `ContextEditor.js:195` (tiered) → `__("Tempo & staves", "piano-block")`.

**Design — SectionPanel double-wrapper collapse.** Today: `ToolsPanel label="Advanced"`
(`~:126`) whose single child is a `ToolsPanelItem label="Section overrides"` (`~:136`)
wrapping `<ContextEditor context={overrides} onChange={emitOverrides} />`. Collapse to a
single disclosure where the `ToolsPanel` carries the domain title and hosts the
`ContextEditor`:

```jsx
<ToolsPanel
  label={__("Section overrides", "piano-block")}
  resetAll={() => emitOverrides({})}            // S10 collapse folded in here
>
  <ToolsPanelItem
    label={__("Section overrides", "piano-block")}
    hasValue={() => Object.keys(overrides).length > 0}
    onDeselect={() => emitOverrides({})}
  >
    <ContextEditor context={overrides} onChange={emitOverrides} />
  </ToolsPanelItem>
</ToolsPanel>
```

**Why one `ToolsPanelItem` is retained.** A `ToolsPanel` needs at least one
`ToolsPanelItem` child to host the reveal/`hasValue`/`onDeselect` machinery — the
`ContextEditor` cannot be a direct `ToolsPanel` child and still participate in per-item
disclosure. So the "double wrapper" is collapsed by **removing the redundant outer
generic "Advanced" title** (the panel now reads "Section overrides"), NOT by deleting the
inner item. The visible redundancy — an "Advanced" panel whose only child is a "Section
overrides" item — is gone; the title appears once at the panel level. `resetAll` and
`onDeselect` both stay `emitOverrides({})` (S10), so the drop-every-override behavior is
byte-identical through the collapse.

**Test strategy — unit-sufficient (mock exposes `label` as `aria-label`).**
- Update the three tiered-panel assertions to the new title `"Tempo & staves"`:
  `contextControls.test.js:260,272` (`[aria-label="Advanced"]` → `"Tempo & staves"`) and
  `SongPanel.test.js:284` (the language-select-not-inside assertion).
- The NotePanel/MeasurePanel/SectionPanel renames are not pinned by the literal "Advanced"
  string in tests (they assert structure, not the title); the code phase re-confirms against
  the live tests and may add an assertion that the new title renders and "Advanced" no longer
  appears on these panels. ToolsPanel reset/deselect behavior stays green (unchanged
  emissions).

---

### S3 — Shorten labels that wrap or truncate (Should)

**Problem.** Four visible labels wrap or truncate in the narrow inspector. The placement
select truncates to "Ab…" because the long "Annotation placement" label starves the option
text.

**Design — four bare visible-label edits.** Each label is single-instance per panel for the
accessible-name purpose, so the visible label and the accessible name may both be the short
form (no per-hand disambiguation applies — that is S1's concern, in a different component):

- `PitchEditor.js:62` `"Note name"` → `"Note"`.
- `AnnotationEditor.js:32` `"Annotation text"` → `"Text"`.
- `AnnotationEditor.js:39` `"Annotation placement"` → `"Placement"` (fixes the "Ab…"
  truncation — the long label was starving the option text).
- `AnnotationEditor.js:48` `"Annotation staff"` → `"Staff"`.

**Chord-case note.** A note's `PitchList` can render several `PitchEditor`s, so several
"Note" selects coexist; they are index-keyed rows and the existing tests act on a single
row, so the shortening introduces no test ambiguity.

**Test strategy — unit-only (label-by-name queries on the mock).** Update every test
querying the old names to the new short names:
- `NotePanel.test.js:184,316` (`[aria-label="Note name"]` → `"Note"`).
- `pitches.test.js:170,184,197` (`fieldByName(…, "Note name")` → `"Note"`).
- `annotations.test.js` (`"Annotation text"/"…placement"/"…staff"` → `"Text"/"Placement"/
  "Staff"`).
The placement-truncation fix is a real-component visual outcome but is a pure consequence of
the shorter label; no separate e2e is required beyond the existing annotation e2e continuing
to pass with the new label text.

---

### S4 — Fix the floating / misaligned trash icons in list rows (Should)

**Problem.** The list rows (in `PitchList`, `AnnotationList`, and `HandConfigEditor`'s
alterations) are bare `HStack`s, and `src/editor.scss` has no inspector/list rules at all.
When a control's label wraps to two lines the row grows taller than the fixed ~40px trash
`Button`, so the icon parks at the row top. The worst case is the `HandConfigEditor`
alterations row, whose `HStack` has **no `alignment` prop at all** (`~:158`) — its trash
floats mid-row; `PitchList` (`~:41`) and `AnnotationList` (`~:55`) already pass
`alignment="flex-start"`.

**Approach (fixed by spec — S8 keeps the three bodies separate, no `EditableList`).**

1. **`alignment` edit — in place.** Add `alignment="flex-start"` to the `HandConfigEditor`
   alters-row `HStack` (`~:158`). The other two rows already have it. Three rows now
   consistent.

2. **`className` hook — pass `className="wp-block-piano-block-piano__list-row"` on each row
   `HStack` directly.** Today no list row passes a `className` (grep-clean), so this is
   net-new wiring. The `HStack` mock spreads `...rest` onto its `<div>`, and the real `HStack`
   forwards `className`, so the className reaches the DOM in both. Three call sites get it
   (PitchList, AnnotationList, HandConfigEditor alters row). No shared component (S8). The
   full BEM-style class `wp-block-piano-block-piano__list-row` (matching the existing
   `__tree`/`__canvas` convention) makes the CSS selector unambiguous.

3. **CSS — `editor.scss`, TOP-LEVEL, NOT nested under the wrapper.** This is the one
   easy-to-get-wrong part, and the **DOM-scoping constraint that must be honored**: the
   existing `&__workspace`/`&__tree`/`&__canvas` rules are nested *inside*
   `.wp-block-piano-block-piano { … }` (`editor.scss:8`), which compiles to
   `.wp-block-piano-block-piano__workspace`, etc. But the inspector panels render in
   `InspectorControls` — the WordPress **sidebar**, which is **OUTSIDE** the block wrapper in
   the DOM. A rule nested under the wrapper block would NOT match the sidebar. So the
   `__list-row` rule must be emitted as a **stylesheet-root** selector:

   ```scss
   // At editor.scss root (NOT inside .wp-block-piano-block-piano { … }):
   .wp-block-piano-block-piano__list-row {
     // The trailing trash button is a fixed-size, non-shrinking item pinned to the
     // input edge rather than stretching or collapsing.
     > button:last-child { flex: 0 0 auto; }
     // The leading editor keeps a sensible minimum so the row doesn't collapse.
     > :first-child { min-width: …; }
   }
   ```

   The exact `min-width` value and the precise child selectors are a code-phase detail; the
   load-bearing design facts are: **top-level selector**, **`flex: 0 0 auto` on the trash**,
   **`min-width` on the leading control**, and **`align-items: flex-end` OMITTED** unless
   residual misalignment remains after S1+S3 shorten the labels (with single-line labels the
   editor and trash are the same height and alignment barely matters). The code phase confirms
   the exact child shape per list when writing the selectors (the leaf editor —
   `PitchEditor`/`AnnotationEditor`/the two HandConfig controls — renders its own elements as
   the row's leading children; the trash `Button` is the trailing child).

4. **Optional polish:** `size="small"` on the per-row trash `Button` — the real `Button`
   accepts it, the mock harmlessly swallows it; it shrinks the icon button and directly
   reduces the vertical mismatch.

**Test strategy — className (unit) + visual (e2e).** The `HStack` mock swallows `alignment`
(renders a bare `<div>`), so the alignment is **not** unit-observable, and the CSS itself is
build/real-DOM. So:
- **Unit:** assert the row carries the `__list-row` className the CSS targets — the mock
  spreads `className` via `...rest`, so
  `container.querySelector('.wp-block-piano-block-piano__list-row')` is non-null for each of
  the three lists. This proves the CSS has its hook.
- **e2e / real-component:** the actual visual alignment (trash no longer floats mid-row) is
  verified against the real `HStack`/`Button`/`SelectControl` in the e2e suite — exercising
  the real components, not the stub. This satisfies the standing constraint (a green mock
  can't mask broken alignment).

**Note on the bigger win.** S1 + S3 are the real fix: once the labels stop wrapping, the rows
are single-line and read cleanly with very little CSS; the alignment + CSS here is
belt-and-suspenders for any residual multi-line case (e.g. a long localized label).

---

### S5 — Make a section/measure label click "select-and-reveal" (Should)

**Problem.** The label `Button` in the structure tree's `RowLabelCell` currently calls only
`onSelect` on click (`StructureTree.js:141`); expand/collapse lives solely on the chevron
and the TreeGrid Arrow keys. This is deliberate (not a bug) but diverges from core's List
View and is internally inconsistent — the hand-group row's label *does* toggle on click. It
is the "clicking the text doesn't reveal anything" behavior reported in review.

**Design — one-line `onClick` change in `RowLabelCell` (`~:141`).** The cell already receives
`isExpanded`, `onToggleExpanded`, and `expansionKey: rowKey`, so **no new props**:

```jsx
onClick={() => {
  onSelect?.();
  if (!isExpanded) onToggleExpanded?.(rowKey);
}}
```

- **Select always fires.**
- **Expand fires only when collapsed.** Clicking an already-expanded label selects but does
  NOT collapse — collapse stays on the chevron / ArrowLeft, preserving the deliberate-collapse
  affordance (do not fight the user).
- `RowLabelCell` is shared by section AND measure rows, so both gain select-and-reveal in one
  edit.
- The hand-group row (`~:450-457`) is a separate bespoke cell that toggles-only and never
  selects — **unchanged** (out of scope, "Explicitly fine").

**Test strategy — unit rewrite + e2e real-click + two docblock fixes (correction #3).**
- **Unit (`StructureTree.test.js:377-386`):** the existing "selects (not toggles) when a
  section label is clicked" case is rewritten. Clicking a **collapsed** section label
  (`expanded: new Set()`) now asserts BOTH `calls.select === [{kind:"section",
  sectionIndex:0}]` AND `calls.toggle === ["s0"]`. Add/keep a case: clicking an
  **already-expanded** label (`expanded: new Set(["s0"])`) asserts `calls.select` fires but
  `calls.toggle === []` (no collapse). The chevron-toggle cases (`~:388-405`) stay green
  unchanged. The harness mounts fresh each test, so the `isExpanded` branch is driven purely
  by the `expanded` prop fixture.
- **e2e (`specs/editor.spec.js`):** drive a real **label** click (not the chevron) on a
  collapsed section/measure and confirm the row's descendants become visible — the reported
  "clicking the text doesn't reveal anything" being fixed end to end.
- **Two stale e2e docblocks (correction #3):** both the `treeRow` helper docblock
  (`specs/editor.spec.js:290-293`) and the `expandRow` helper docblock (`~:322-327`) currently
  assert "the label is SELECT-ONLY … a label click no longer toggles/expands — expansion is
  driven by the sibling chevron." After S5 that is stale for section/measure rows (their label
  now expands-if-collapsed). Both docblocks must be updated to describe select-and-reveal
  (hand-group rows remain the toggle-only exception). `expandRow` itself may keep clicking the
  chevron — both the chevron and a collapsed-row label now expand, so its callers still work —
  but its comment must stop asserting the label can't expand.

---

### S6 — Section/measure canvas highlight: DEFER (Should — decided to defer)

**Decision: DEFER. No canvas highlighting is built this review.** A GitHub tracking issue is
filed instead so the work is recorded and not silently dropped. The existing "later
follow-up" comments in `SongCanvas` (`~:13-16`, `~:40-43`) and `editor.scss` (`~:106-108`,
the `.is-selected` comment) already describe the deferred state accurately and need **no
edit**.

**Rationale (carried).** The review itself framed S6 as "a deferred follow-up worth a
tracking issue"; the owner singled it out as the one deferrable item; the "where am I?" gap is
already partly closed by the selected tree row (`aria-current`) and the kind-titled inspector
panels (and is strengthened by S5 this review); and adding net-new canvas-decoration plumbing
+ CSS + e2e would spend risk on the one item explicitly marked safe to defer.

**Nothing depends on S6 (verified).** `decorateSelection` (`SongCanvas.js:53-77`)
early-returns on `kind !== "event"`; no other consumer reaches the section/measure highlight
path. So deferring S6 leaves no dangling reference.

**Code-phase action — file this tracking issue VERBATIM:**

Title:
```
Editor: highlight the selected section/measure on the sheet-music canvas
```

Body:
```
When a section or measure row is selected in the structure tree, the canvas
shows no visual feedback — only an *event* (note/rest) selection paints
`.is-selected` (recolor-only, `src/editor/SongCanvas.js` `decorateSelection` +
`src/editor.scss` `.is-selected`). Selecting "Measure 2" or a section highlights
nothing on the preview, the main "where am I?" gap. Selection is still conveyed
by the tree row (`aria-current`) and the inspector panel title, so this is an
enhancement, not a dead end.

Deferred from review-9 (cost/value): feasible but non-trivial. Feasibility notes
from the code: each measure is emitted as `<g data-measure='N'>` (1-based GLOBAL
number, `src/notation/svg.js`), reachable post-render exactly like the event
highlight via `globalMeasureNumber(song, si, mi)` (`src/editor/selection.js`,
already imported by SongCanvas). A MEASURE highlight is a small add (~10-15 lines
+ one editor-only CSS rule). A SECTION highlight has no single DOM hook (no
`data-section`/section group) — it must decorate the RANGE of measure groups in
the section (iterate `measureCoords`, filter by sectionIndex, query each
`[data-measure]`). CAVEAT: a `<g data-measure>` contains the notes AND that
measure's barlines (but NOT staff lines/clef/sigs, which are system-level
siblings), so a whole-group recolor tints barlines too — acceptable, or exclude
via `:not([data-barline])`.

CONSTRAINTS (must hold): editor-only (class added post-render by SongCanvas;
view.js never sets it → front-end SVG stays byte-identical), recolor-only (no
layout shift), must not clash with the event `.is-selected` recolor.

ACCEPTANCE HINT: selecting a measure (and optionally a section) in the tree
visibly highlights the corresponding measure group(s) on the canvas; front-end
render unchanged; verified against the real emitted SVG (not just jest stubs).
```

**Test strategy.** No code, so no test churn. The acceptance is: the issue is filed with the
exact title/body above, and the existing "later follow-up" comments remain accurate (no
edit).

---

### S7 — Confirm the section-level destructive delete (Should — the central design decision)

**Problem.** Four delete sites currently have no confirmation and no surfaced undo, relying
entirely on the editor's global undo (Cmd-Z): the structure-tree `RowActionsMenu` "Remove",
and the panel "Remove note" / "Remove measure" / "Remove section" buttons. Removing a section
silently deletes all its measures and notes — the highest blast radius.

**Scope (fixed by spec).** Confirm the **section-level remove ONLY**, at **both** section
entry points (so the same destructive action is guarded wherever it is triggered). Measure-
and note-level removes (both tree and panel) stay **immediate** — lower blast radius; Cmd-Z
remains their documented recovery path. The mechanism is `@wordpress/components`
`__experimentalConfirmDialog` (imported as `ConfirmDialog`) in **controlled** mode — the
parent owns `isOpen` and must call `setIsOpen(false)` inside BOTH `onConfirm` and `onCancel`.
`window.confirm` is explicitly NOT used (non-idiomatic; jsdom's `window.confirm` returns
`false` by default, which would block every delete in unit tests).

The central design question is **where each dialog's state lives.** There are two entry
points with very different difficulty.

#### Entry point A (easy) — `SectionPanel` "Remove section" button

**Self-contained, state local to the panel.** Add a `useState` confirm flag in `SectionPanel`;
the "Remove section" button opens it; a controlled `ConfirmDialog` in the panel body owns
confirm/cancel:

```jsx
const [confirmOpen, setConfirmOpen] = useState(false);
…
<Button isDestructive onClick={() => setConfirmOpen(true)} …>
  {__("Remove section", "piano-block")}
</Button>
<ConfirmDialog
  isOpen={confirmOpen}
  onConfirm={() => { setConfirmOpen(false); onRemoveSection?.(sectionIndex); }}
  onCancel={() => setConfirmOpen(false)}
>
  {__("Remove this section and all its measures and notes?", "piano-block")}
</ConfirmDialog>
```

`SectionPanel` currently holds no state and does not import `useState`; this adds the first
`@wordpress/element` import line. The import is
`import { __experimentalConfirmDialog as ConfirmDialog } from "@wordpress/components"`.

#### Entry point B (hard) — structure-tree section-row "Remove"

**Decision: lift the pending-confirm state to the `StructureTree` component level, with ONE
`ConfirmDialog` rendered once at the tree root (OPTION A).** Considered and rejected: a
per-section stateful `SectionRow` wrapper (OPTION B) — the rows are built as inline
`rows.push(<TreeGridRow …>)` in the render body, *not* components, so OPTION B would be a
larger refactor and would mount N dialogs; OPTION A is the minimal, single-dialog shape and
`StructureTree` is already the natural owner of the row wiring.

**Why the lift is MANDATORY (the wrinkle).** The section row's remove fires from inside
`RowActionsMenu`'s `DropdownMenu` render-prop, and each `MenuItem` does `onAction?.();
onClose();` — the popover **unmounts on close**. A confirm flag hosted inside the menu would
be torn down before the dialog could act. So the flag and the `ConfirmDialog` must live
**outside** the `DropdownMenu`, at the tree level. **`RowActionsMenu` stays generic
(untouched)** — it is shared by section/measure/note rows, so confirming *inside* it would
wrongly gate all three levels.

**Shape.** `StructureTree` (currently pure-controlled, zero internal state, no
`@wordpress/element` import) gains its first state:
`const [pendingRemoveSection, setPendingRemoveSection] = useState(null)` (holds the
`sectionIndex` to remove, or `null`). The section row's remove call site (`~:332`) changes
from `onRemove={() => onRemoveSection?.(sectionIndex)}` to
`onRemove={() => setPendingRemoveSection(sectionIndex)}` — capturing the `sectionIndex` (in
scope inside the `forEach`) into state. The `MenuItem` still calls `onClose()` (the menu
closes), but the pending state survives because it lives in `StructureTree`, not the menu. ONE
`ConfirmDialog` renders once at the tree root (alongside/after `<TreeGrid>`):

```jsx
<ConfirmDialog
  isOpen={pendingRemoveSection !== null}
  onConfirm={() => {
    onRemoveSection?.(pendingRemoveSection);
    setPendingRemoveSection(null);
  }}
  onCancel={() => setPendingRemoveSection(null)}
>
  {__("Remove this section and all its measures and notes?", "piano-block")}
</ConfirmDialog>
```

Only the **section** call site (`~:332`) is gated; the measure (`~:406`) and note (`~:561`)
call sites stay immediate.

**Two-dialogs-at-once is impossible by construction (verified).** The
`__experimentalConfirmDialog` "multiple instances not supported" caveat only bites if two
dialogs are **open** simultaneously. The panel dialog (entry A) lives in the
`InspectorControls` sidebar subtree; the tree dialog (entry B) lives in the tree subtree. They
are reached by mutually-exclusive user flows (you either click "Remove section" in the panel
OR "Remove" in a tree row's menu), each controlled by its own local `isOpen`/`pending` state,
never both true at once. `@wordpress/components` is externalized (not in `node_modules`), so
this caveat is a real-component runtime concern only — the unit mock is a per-instance
stand-in with no singleton. Recorded invariant: **"only-one-open by construction."**

**Internal state in StructureTree is test-safe (verified).** The `StructureTree.test.js`
harness mounts each test fresh (`render(element)` → `root.render` once → `unmount`), never
re-rendering new props on the same root, so the new `pendingRemoveSection` state cannot leak
stale between tests.

#### Mock extension (`test/mocks/wordpress-components.js`) — part of S7's acceptance

The mock has no `ConfirmDialog`, so extend it with an `isOpen`-respecting stand-in and export
it. Shape: render **nothing when `!isOpen`**; when open, render `children` (the message) + a
confirm `<button>` + a cancel `<button>` wired to `onConfirm`/`onCancel`. Rendering nothing
when closed mirrors controlled mode so tests not expecting a dialog see no stray buttons.
Export under both `__experimentalConfirmDialog` and (optionally) `ConfirmDialog`. The
confirm/cancel buttons need stable accessible names (e.g. default "OK"/"Cancel", or explicit
`confirmButtonText`/`cancelButtonText`) so tests can locate them. This stand-in respects
`isOpen` and mirrors the real component's accept/cancel contract.

#### S7 test strategy

- **Unit — section remove asks, accept removes, cancel does not:**
  - `SectionPanel.test.js` Remove-section tests (~`:257,272`): now click "Remove section",
    then click the dialog's confirm, THEN assert `onRemoveSection` fired. Add a cancel case:
    click "Remove section", click the dialog's cancel, assert `onRemoveSection` did NOT fire.
  - `StructureTree.test.js:446` (the section-row Remove): the menu's "Remove" now only opens
    the dialog; the test clicks the dialog's confirm before asserting `calls.removeSection ===
    [1]`. Add a cancel-does-not-remove case.
  - `Edit.test.js:461` (Remove section → splice + selection clear): drive the confirm before
    asserting. **Note:** `Edit.test.js:461` uses `buttonByText("Remove section")` — that is the
    **SectionPanel** button (Edit renders the real panel), so it routes through entry A's
    dialog; the test adds the confirm step.
  - **Untouched (no confirm on these paths):** `StructureTree.test.js:476,527` (measure/note),
    `NotePanel.test.js:367,401`, `MeasurePanel.test.js:253,269`, `Edit.test.js:478,511,547`
    (measure/note removes) — these stay immediate and green, proving section-only scoping.
- **e2e (real `ConfirmDialog`, standing constraint):** `editor.spec.js:660` (section-row
  "Remove" → polls `sections.length`) inserts a real dialog-confirm click between
  `openRowAction(…, "Remove")` and the poll. The e2e drives the **real** `ConfirmDialog`
  section-remove end to end (accept path), proving the controlled dialog works on the real
  component. The note/measure e2e removes (`~:565,648`) stay unconfirmed.

---

### S8 — Keep the three list bodies separate; do NOT extract `EditableList` (Should — decided to keep separate)

**Decision: keep them separate. Do NOT add an `EditableList`.** `ListControls.js` keeps
exporting only `AddButton`. `PitchList`, `AnnotationList`, and `HandConfigEditor` keep their
own list bodies. The S4 alignment/className fix lands **in place** on each list's existing row
`HStack` directly — no shared component is needed to fix the floating trash.

**Rationale (carried, recorded so the divergence from the review's literal "extract one
`EditableList`" wording is explicit).** Measured on the live tree, extraction is **net ~+13
LOC** (removes ~32 lines of scaffolding, adds a ~25–30-line component plus ~18 lines of call
sites) — no reduction. The rule-of-three is **unmet**: only `PitchList` and `AnnotationList`
are clean callers; `HandConfigEditor`'s alters body genuinely does not fit — it is a fragment
among sibling controls, each row is *two* controls, and its `onChange` rebuilds the whole hand
config via `buildHandConfig` from rows derived and written back as a map, so forcing it into a
shared list primitive would import a storage-transform concern into a list primitive. Review-8
already rejected a generic `EditableList` with a "revisit only if a fourth list appears"
trigger that is **still unmet**. The two opposite per-list invariants further argue for keeping
them as independent, readable bodies: `PitchList`'s `canRemove = items.length > 1`
(note-min-one rule) versus `AnnotationList`'s collapse-empty-to-`undefined` rule.

**Test strategy.** No extraction, so no new tests for this item; the existing
`PitchList`/`AnnotationList`/`HandConfigEditor` tests stay green unchanged. The only edits to
these files are S4's `alignment`/`className` touches (and S1's labelling in
`HandConfigEditor`).

---

### S9 — Remove the redundant second JSON parse per render (Should)

**Problem.** In `edit.js`, the same song string is parsed twice on every change of a valid
song: `validateSong(song)` (which `JSON.parse`s internally and discards the parsed object,
returning only `string[]`) followed by `safeParse(song)` (a second `JSON.parse`).

**Design — `parseAndValidate()` named export + thin `validateSong` wrapper.** Add a **named**
export `parseAndValidate(rawString) → { data, errors }` to `song/validate.js` that parses
**once** and mirrors `validateSong`'s parse-failure shape exactly, and re-express the existing
default export as a thin wrapper so there is one parse path and zero behavior drift:

```js
export function parseAndValidate(rawString) {
  let data;
  try {
    data = JSON.parse(rawString);
  } catch (error) {
    return { data: null, errors: [`Invalid JSON: ${error.message}`] };
  }
  const errors = [];
  validateValue(data, songSchema, "", errors);
  return { data, errors };
}

export default function validateSong(rawString) {
  return parseAndValidate(rawString).errors;
}
```

This keeps `validateSong`'s `(raw) → string[]` contract and its `"Invalid JSON: …"` message
**byte-identical** (same template, same `error.message`), so `view.js:57`'s render gate
(`validateSong(raw).length > 0`) and the ~15 test files that call `validateSong` are
**untouched**. The has-errors case returns the parsed `data` too (harmless — the caller decides
what to do with it). The three result shapes:
- `JSON.parse` throws → `{ data: null, errors: ["Invalid JSON: <msg>"] }`.
- conformant parse → `{ data: <parsed>, errors: [] }`.
- parsed-but-non-conformant → `{ data: <parsed>, errors: [<messages>] }`.

**Where the switch lives — `edit.js`.** Replace the two `useMemo`s + `safeParse`:
- Compute `const { data, errors } = useMemo(() => song.trim() === "" ? { data: newSong(),
  errors: [] } : parseAndValidate(song), [song])` — **ONE parse**.
- Derive `errors` from that result (the empty-string "no song" state still yields
  `errors: []`).
- Derive `working`: the empty-string case is `newSong()`; otherwise
  `errors.length > 0 ? null : data`. (The single result carries both.)
- **Delete `safeParse` (`~:51-57`)** and the second `JSON.parse`.

**Memo-shape design note.** `errors` and `working` currently live in two separate `useMemo`s
(`working` depends on `errors`). Collapsing to one memo over `song` keyed on the single
`parseAndValidate(song)` result is cleaner and is the intended single-parse shape. The
empty-string branch must still seed `working = newSong()` with `errors = []` (canvas shows the
empty grand staff, attribute stays `""` until first edit — lazy seeding preserved).
`accessibleName` and the rest read from `working` as before. The existing observable behavior
(a valid song renders the canvas; an invalid one routes to `InvalidState`) is unchanged.

**Out of scope (constraint).** `view.js`'s gate stays on `validateSong` and is NOT refactored
to `parseAndValidate` — `view.js` does its own parse for the render and is not part of the
editor double-parse.

**Test strategy — mock-level unit-sufficient (pure functions).**
- **New `parseAndValidate` unit test** (in `validate.test.js`): conformant song →
  `{ data: <parsed>, errors: [] }`; invalid JSON → `{ data: null, errors: ["Invalid JSON:
  …"] }`; non-conformant song → `{ data: <parsed>, errors: [<messages>] }`.
- **Existing `validateSong` tests stay green unchanged** — proving the default-export contract
  held (the thin wrapper returns `.errors` byte-identically). `view.js` untouched.
- **`Edit`/`edit.js`:** a valid song still renders the canvas (parsed once); an invalid one
  still routes to `InvalidState`. The existing `Edit.test.js` valid/invalid cases stay green;
  the change is the internal parse count, not the observable routing.

---

### S10 — Replace SectionPanel's duplicated `resetAll` (Should — folded into S2)

**Problem.** `SectionPanel`'s `resetAll` body destructures `{ tempo, timeSignature, rightHand,
leftHand, ...keep } = section; emitSection(keep)`, which is exactly what `emitOverrides({})`
already does.

**Design — folded into the S2 collapse.** Replace the inline destructure body (`~:127-133`)
with `resetAll={() => emitOverrides({})}` — byte-identical behavior (`emitOverrides({})`
performs the exact same override-strip). This lives on the **same `ToolsPanel`** that S2
retitles to "Section overrides", so one edit to the `ToolsPanel` element covers both S2
(title) and S10 (resetAll body). The `onDeselect` on the retained `ToolsPanelItem` is also
`emitOverrides({})`.

**Test strategy — CORRECTION to the spec's "existing reset test stays green" (correction
#2).** There is **no unit test that drives `resetAll`** in `SectionPanel.test.js`: the
`ToolsPanel` mock **swallows** the `resetAll` prop (`wordpress-components.js:308`), so
`resetAll` is never invoked at unit level, and the existing "drops tempo when cleared" case
(~`SectionPanel.test.js:229-237`) clears each override via the control's `onChange`, **not**
via `resetAll`. So the spec's "the existing reset test stays green" is **vacuously true** —
there is no such test. Consequence: S10's swap is behaviorally identical but
**unit-unobservable** — safe, and needs no test update. **The code phase MAY** add a small unit
assertion that drives `resetAll` to prove drop-every-override (which would require the mock to
stop swallowing `resetAll` and expose it as a callable affordance — a mock extension), but this
is **optional**: it is not required by S10's acceptance and adds mock surface. Default is to
leave it unit-unobservable (matching the spec) and rely on the byte-identical emission +
`emitOverrides`'s existing coverage.

---

### Optional polish (in scope — smallest in-scope mechanisms)

1. **Stale `edit.js` `NotePanel.removeEvent` comment (`~:305-308`):** drop/correct the comment
   on the `onRemoveNote` path (grep confirms no `removeEvent` symbol exists). Pure comment edit.
2. **Single-child `<Flex>` wrappers** (`SongPanel.js:78` wrapping "Add section";
   `InvalidState.js:46` wrapping "Edit as JSON"). **Decision: drop the wrapper** (render the
   `Button` directly) in both — a single-child flex container adds nothing. Pick
   drop-the-wrapper consistently (not "standardize on `HStack`", which would keep a pointless
   one-child wrapper). Remove the now-unused `Flex` import from each file. Re-confirm no test
   asserts the wrapping `<div>` shape (the mock `Flex` renders a bare `<div>`, so any test
   asserting button presence by label still passes).
3. **"Rename" `MenuItem` in `RowActionsMenu`** (to match List View). **Decision: smallest
   in-scope mechanism = select the row and focus the inspector panel's name field.** Section/
   measure names are already editable via their panels' name `TextControl` ("Section
   name"/"Measure name"), so the Rename item selects the row (its panel shows) and focuses the
   name field — no new inline-editor component. `RowActionsMenu` is generic and shared, and
   notes have no name field, so **pass an optional `onRename` per row and render the "Rename"
   item only when provided** (section/measure rows pass it; note rows do not) — keeps
   `RowActionsMenu` generic while not offering a no-op Rename on notes. This is the one polish
   item with real design surface; if the focus-the-field wiring proves non-trivial, it stays
   the smallest mechanism that satisfies "match List View" without a new editor.
4. **`InvalidState` microcopy:** body "Switch to JSON" (`~:34`) → "Edit as JSON" (match the
   button `~:52` and the toolbar toggle). One string edit.
5. **PR-description "no new dependencies" line:** `@wordpress/icons` IS a real, intended runtime
   dependency on this branch — **PR prose fix only, NO source change.** The doc phase notes it;
   no code changes.
6. **`editor.scss` duplicate header:** **folded into M1's comment reconciliation** (one accurate
   header — see M1).

**Polish test strategy.** All mock-level unit-sufficient (string/comment/wrapper edits); items
1, 5, 6 have no observable test surface. Item 3 (Rename) gets a small unit assertion that the
"Rename" item appears on section/measure rows and is absent on note rows, plus that activating
it selects the row (the focus-the-field behavior is a real-DOM concern best left to the e2e if
one is cheap, but the select-on-rename is unit-observable).

---

## 3. Test-strategy summary (which items ride a real contract → need real/e2e proof)

Per the standing "tests-green ≠ real-broken" constraint:

**Need real/emitted proof (mock is insufficient):**
- **M1** — emitted `build/style-index.css` (build-output grep), not source-only.
- **S1** — e2e/real-component check that visible label = bare "Clef" while accessible name
  stays "Right hand clef" (proves the `aria-label` override on the real
  `<select>`/`<input>`/`Button`). Unit corrects the 3 `buttonByText` add-alteration sites.
- **S4** — unit asserts the `__list-row` className hook exists; e2e/real-component proves the
  actual trash alignment (the `HStack` mock swallows `alignment`).
- **S5** — unit rewrite (collapsed → select+expand, expanded → select-only); e2e drives a real
  label click and confirms descendants reveal; two docblocks updated.
- **S7** — unit drives the mock dialog's accept/cancel; e2e drives the **real** `ConfirmDialog`
  section-remove end to end. Both dialogs (panel + tree) are real-component.

**Mock-level unit-sufficient (no real-contract risk):**
- **S2** (title renames — `ToolsPanel` exposes `label`), **S3** (label renames), **S9**
  (`parseAndValidate` shape + `validateSong` contract — pure functions), **S10** (identical,
  unit-unobservable emission), and the optional polish (string/comment/wrapper edits).
- **S6** — no code; the tracking issue is filed by the code phase (verbatim text above); the
  existing `SongCanvas`/`editor.scss` "later follow-up" comments stay accurate (no edit).
  Nothing else depends on S6 (verified).
- **S8** — no extraction; existing `PitchList`/`AnnotationList`/`HandConfigEditor` tests stay
  green (only S4's `alignment`/`className` and S1's labelling touch these files).

---

## 4. Cross-item interactions (sequencing notes for the plan phase)

- **S2 + S10 share one `ToolsPanel` element in `SectionPanel`** — the title rename and the
  `resetAll` body swap are one combined edit (plus the double-wrapper collapse). Treat them as a
  single touch on that element.
- **S1 + S4 + S8 all touch `HandConfigEditor`** — S1 splits the labels, S4 adds
  `alignment="flex-start"` + the `__list-row` className to the alters row, S8 confirms no
  extraction. They are independent edits in the same file; no ordering constraint, but the plan
  should land them coherently.
- **M1 + polish item 6 share the `editor.scss` header** — one accurate header, folded.
- **S9 changes `song/validate.js`'s public surface (adds a named export)** but keeps the default
  export byte-identical — so `view.js` and ~15 validator test files are untouched. The only
  behavioral consumer edit is `edit.js`.
- **S7 introduces the first internal state in two previously-stateless components**
  (`SectionPanel` gains a local `useState`; `StructureTree` gains `pendingRemoveSection`), and
  the first `ConfirmDialog` mock. The mock extension is a prerequisite for the S7 unit tests.
