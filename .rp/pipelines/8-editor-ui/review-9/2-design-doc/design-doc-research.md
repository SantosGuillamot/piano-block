# Review 9 — Design research (running record)

Phase-2 design research for review-9 on the Piano block (issue #8, PR #22). This
file records each design topic, the evidence weighed, and the chosen design with
its rationale. It works on top of the settled spec (`1-spec/spec.md`) and spec
research (`1-spec/spec-research.md`): the **WHAT** (and the five hard
spec-delegated decisions — S1 OPT-1, S4 in-place, S6 defer, S7 section-only, S8
keep-separate) are fixed. This phase decides the **HOW**: where each change lives,
the component/API shape, and the test strategy per item — staying in design
territory, not task breakdown (phase 3).

All file/line references were re-confirmed against the live tree at branch
`worktree-8-editor-ui` (tip `c7a25d1`) during this phase; later phases must
re-confirm exact coordinates as fixes land.

A standing constraint governs every test-strategy choice: **"tests green" must
stay incompatible with "real component broken."** Where a fix rides a real
`@wordpress/components` / `@wordpress/icons` contract (S1's `aria-label`, S4's CSS,
S7's dialog) or a build-output fact (M1), the verification exercises the **real**
contract or the **emitted** artifact — not only the jest mock that stands in for
`@wordpress/components` in the unit suite.

---

## Codebase facts established by reading the live tree (design baseline)

Read in full this phase (so the design rests on the real shapes, not the
spec's line cites):

- **`src/editor/HandConfigEditor.js`** — `fieldLabel(field)` (`:101-109`) composes
  `sprintf("%1$s %2$s", label, field)` when a `label` is present, else returns the
  bare `field`. It labels: clef `SelectControl` (`:130`), octave `NumberControl`
  (`:140`), and per alters row a note `SelectControl` (`:160`), a value
  `NumberControl` (`:170`), and a trash `Button` (`:188`); the `AddButton` at
  `:195`. The alters rows are `HStack`s with **no `alignment` prop** (`:158`). The
  `onChange` rebuilds the whole hand config via `buildHandConfig(base, rows)`.
- **`src/editor/ContextEditor.js`** — composes two `HandConfigEditor`s (`:172-185`)
  labelled `HAND_LABEL.rightHand` / `.leftHand`. `tiered` layout (`:187-242`) wraps
  each hand in a `ToolsPanelItem` titled "Right hand"/"Left hand" inside a
  `ToolsPanel label="Advanced"` (`:195`). `flat` layout (`:245-256`) renders both
  hands inline with no per-hand heading.
- **`src/editor/ListControls.js`** — exports only `AddButton({ onClick, label })`;
  renders a `Button` with `variant="secondary" icon={plus}` and `{label}` as visible
  children. No `aria-label` passthrough today.
- **`src/editor/inspector/SectionPanel.js`** — `ToolsPanel label="Advanced"`
  (`:126`) whose single child is a `ToolsPanelItem label="Section overrides"`
  (`:136`) wrapping `<ContextEditor context={overrides} onChange={emitOverrides} />`.
  `resetAll` (`:127-133`) inlines the same destructure as `emitOverrides({})`
  (`:108-111`). "Remove section" button at `:153-160` calls
  `onRemoveSection?.(sectionIndex)`.
- **`src/editor/StructureTree.js`** — pure controlled, **zero internal state**, no
  `@wordpress/element` import. `RowLabelCell` (`:121-147`) label `Button` `onClick`
  = `onSelect?.()` only (`:141`); it already receives `isExpanded`,
  `onToggleExpanded`, and `expansionKey: rowKey`. The section row's remove call site
  is `onRemove={() => onRemoveSection?.(sectionIndex)}` at `:332`, inside the
  `RowActionsMenu` render-prop. `RowActionsMenu` (`:166-219`) is a `DropdownMenu`
  shared by section/measure/note rows; each `MenuItem` does `onAction?.(); onClose();`
  and the popover unmounts on close. The hand-group row's label toggles expansion
  (`:454`) — its bespoke non-selecting cell stays untouched.
- **`src/song/validate.js`** — `validateSong(rawString)` is the **default export**
  (`:332-343`): `try { data = JSON.parse(rawString) } catch { return ["Invalid
  JSON: " + error.message] }`, then `validateValue(data, songSchema, "", errors)`
  and `return errors`.
- **`src/edit.js`** — `safeParse` (`:51-57`) is a private `try/JSON.parse/catch→null`.
  `errors = useMemo(() => song.trim()==="" ? [] : validateSong(song), [song])`
  (`:140-143`). `working = useMemo(() => song.trim()==="" ? newSong() : errors.length>0 ? null : safeParse(song), [song, errors])` (`:153-158`). Two parses
  per valid change: one in `validateSong`, one in `safeParse`.
- **`src/editor/PitchEditor.js`** — `SelectControl label="Note name"` (`:62`).
- **`src/editor/AnnotationEditor.js`** — `TextareaControl label="Annotation text"`
  (`:32`), `SelectControl label="Annotation placement"` (`:39`), `SelectControl
  label="Annotation staff"` (`:48`, standalone kind only).
- **`src/editor/PitchList.js`** / **`AnnotationList.js`** — already pass
  `alignment="flex-start"` (`:41` / `:55`); rows are `HStack` + leaf editor + trash
  `Button` + `AddButton`. No `className` on any row today.
- **`src/style.scss`** — `@font-face` (`:17-23`) + the leaked
  `.wp-block-piano-block-piano { border/padding/color }` (`:25-29`). Header
  (`:1-5`) claims style.scss carries "@font-face … and the shared wrapper rules".
- **`src/editor.scss`** — header (`:1-6`) repeats the "shared wrapper rules" claim;
  all rules are **nested under** `.wp-block-piano-block-piano` (`:8`), including
  `&__workspace`/`&__tree`/`&__canvas`/`&__canvas-svg .is-selected`. No
  inspector/list rules at all. The `.is-selected` comment (`:106-108`) documents the
  S6 deferral accurately.
- **`src/editor/SongCanvas.js`** — `decorateSelection` (`:53-77`) early-returns on
  `kind !== "event"`; the `:13-16` and `:40-43` comments describe the
  section/measure canvas-highlight as "a later follow-up" (S6).
- **`src/editor/inspector/SongPanel.js`** — single-child `<Flex>` wraps the "Add
  section" `Button` (`:78-86`). **`src/editor/InvalidState.js`** — body says "Switch
  to JSON" (`:34`), button "Edit as JSON" (`:52`), single-child `<Flex>` (`:46-54`).

**Unit mock facts (`test/mocks/wordpress-components.js`)** — re-read this phase,
they decide unit-vs-e2e per item:

- `Button`: accessible name = `ariaLabel ?? label` (`:55`) — an explicit
  `aria-label` overrides the visible text. Swallows `icon`/`variant`/`isDestructive`/
  `__next40pxDefaultSize`.
- `SelectControl`/`NumberControl`/`TextControl`/`TextareaControl`: set
  `"aria-label": label` then spread `...rest` (`:86-97`, `:130-137`, etc.) — a
  separately-passed `aria-label` lands in `...rest`, spread last, and **overrides**.
  Matches the real component (researcher-confirmed against Gutenberg trunk: both
  spread `{...restProps}` onto the native element after the named `label`).
- `HStack`: **swallows `alignment`** (`:203-209`) — renders a bare `<div>`. So S4's
  `alignment` is NOT unit-observable; `className` passed via `...rest` DOES reach the
  `<div>`.
- `ToolsPanel`/`ToolsPanelItem`: render children unconditionally; `ToolsPanel`
  exposes `label` as `aria-label`. So S2 title renames are unit-testable.
- `DropdownMenu`: render-function children, content rendered inline (always
  queryable), returns `null` for plain-element children (core's guard mirror).
- **No `ConfirmDialog` / `__experimentalConfirmDialog`** in the mock or its
  `module.exports` (`:546-568`). S7 must extend it.

---

## M1 — Front-end placeholder-border leak (design: pure-removal, no new home)

**Decision.** M1 is a pure deletion in `src/style.scss` plus a comment
reconciliation across both stylesheets. No code moves; **no editor-only replacement
rule is created** (the review's "if an editor-only affordance is wanted, add a
scoped version to `editor.scss`" is explicitly declined — no other review item needs
a wrapper border, per spec M1.3).

**Where each change lives.**

1. `src/style.scss`: delete the `.wp-block-piano-block-piano { border: 1px dashed
   #767676; padding: 1em; color: #767676; }` rule (`:25-29`). Keep `@font-face`
   (`:17-23`) verbatim — the front-end SVG glyphs need the font.
2. `src/style.scss` header (`:1-5`): drop "and the shared wrapper rules"; describe
   style.scss as carrying **only** `@font-face` on the front end.
3. `src/editor.scss` headers: the file header (`:1-6`) and the in-block comment
   (`:9-16`) both repeat the "shared wrapper rules (border, padding, color)" claim.
   **Fold M1's comment fix and the Optional `editor.scss` duplicate-header trim into
   one accurate description** — after M1, style.scss carries only `@font-face`
   front-end-side, and editor.scss carries the editor-only surface rules. One
   accurate header, not two stale ones.

**Test strategy (build-output, NOT source-only).** This is the canonical "emitted
artifact" verification. The acceptance check runs `npm run build` and asserts
`build/style-index.css` no longer contains the wrapper `border`/`padding`/`color`
rule (retaining only `@font-face` + the woff2 `url()`), and that `build/index.css`
(editor) is unchanged. No unit test pins the wrapper rule today (grep-confirmed), so
deletion breaks nothing; the design's only *new* verification is the build-output
assertion. This belongs as an explicit code-phase build+grep step (and a doc note
that the front-end render is now unframed).

---

## S2 — Rename the four "Advanced" panels; collapse SectionPanel's double wrapper

**Decision (titles).** Four `__("Advanced", …)` → four distinct domain titles:
- `NotePanel.js:157` → `__("Note details", "piano-block")`.
- `MeasurePanel.js:93` → `__("Barlines & annotations", "piano-block")`.
- `SectionPanel` `ToolsPanel` → `__("Section overrides", "piano-block")`.
- `ContextEditor.js:195` (tiered) → `__("Tempo & staves", "piano-block")`.

**Decision (SectionPanel double-wrapper collapse).** Today: `ToolsPanel
label="Advanced"` → single `ToolsPanelItem label="Section overrides"` → `ContextEditor`.
Collapse to a **single disclosure**: the `ToolsPanel` carries the domain title
`"Section overrides"` and hosts the `ContextEditor` directly. The shape:

```jsx
<ToolsPanel
  label={__("Section overrides", "piano-block")}
  resetAll={() => emitOverrides({})}   // S10 collapse folded in here
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

Design note on the single retained `ToolsPanelItem`: a `ToolsPanel` needs at least
one `ToolsPanelItem` child to host the reveal/`hasValue`/`onDeselect` machinery — the
`ContextEditor` cannot be a direct `ToolsPanel` child and still participate in the
panel's per-item disclosure. So the "double wrapper" is collapsed by **removing the
redundant outer `"Advanced"` generic title** (the panel now reads "Section
overrides" instead of "Advanced"), not by deleting the inner item. The visible
redundancy ("Advanced" panel whose only child is a "Section overrides" item) is gone;
the title appears once at the panel level. `resetAll` and `onDeselect` both stay
`emitOverrides({})` (S10), so the drop-every-override behavior is byte-identical
through the collapse.

**Test strategy.** Unit-testable via the mock (`ToolsPanel` exposes `label` as
`aria-label`):
- Update the three tiered-panel assertions to the new title `"Tempo & staves"`:
  `contextControls.test.js:260,272` (`[aria-label="Advanced"]` → `"Tempo & staves"`)
  and `SongPanel.test.js:284` (the language-select-not-inside assertion).
- The NotePanel/MeasurePanel/SectionPanel renames are not pinned by the literal
  "Advanced" string in tests (they assert structure, not the title), but the code
  phase re-confirms against the live tests and may add an assertion that the new
  title renders and "Advanced" no longer appears on these panels. ToolsPanel
  reset/deselect behavior stays green (unchanged emissions).

---

## S3 — Shorten wrapping/truncating labels (design: bare relabel + test rename)

**Decision.** Four visible-label edits, each label is single-instance per panel for
accessible-name purposes, so the visible label and accessible name may both be the
short form (no per-hand disambiguation — that is S1's concern, in a different
component):
- `PitchEditor.js:62` `"Note name"` → `"Note"`.
- `AnnotationEditor.js:32` `"Annotation text"` → `"Text"`.
- `AnnotationEditor.js:39` `"Annotation placement"` → `"Placement"` (this fixes the
  "Ab…" truncation — the long label was starving the option text).
- `AnnotationEditor.js:48` `"Annotation staff"` → `"Staff"`.

Note on the chord case: a note's `PitchList` can render several `PitchEditor`s, so
several "Note" selects coexist; they are index-keyed rows and the existing tests act
on a single row, so the shortening introduces no test ambiguity. This is a pure
visible-label change (the review asks only to shorten the visible label), so the
accessible name equals the short visible label here.

**Test strategy.** Unit-only (label-by-name queries on the mock). Update every test
querying the old names to the new short names:
- `NotePanel.test.js:184,316` (`[aria-label="Note name"]` → `"Note"`).
- `pitches.test.js:170,184,197` (`fieldByName(…, "Note name")` → `"Note"`).
- `annotations.test.js` (the `"Annotation text"/"…placement"/"…staff"` queries →
  `"Text"/"Placement"/"Staff"`).
The placement-truncation fix is a real-component visual outcome, but it is a pure
consequence of the shorter label; no separate e2e is required beyond the existing
annotation e2e continuing to pass with the new label text.

---

## S1 — Drop the hand prefix (design: split `fieldLabel` into visible-bare + aria-scoped)

The spec fixed the mechanism (**OPT-1**: bare visible `label` + hand-scoped
`aria-label`, real-component-honest). This phase decides the exact wiring in
`HandConfigEditor`, the `AddButton` prop addition, the flat-layout heading call, and
— critically — corrects the spec's "zero test churn" claim.

**Where each change lives — `HandConfigEditor.js`.** Keep `fieldLabel` composing the
hand-scoped name, but split each control's labelling into two props: the **bare
field** as visible `label`, the **hand-scoped** string as `aria-label`. Concretely,
`fieldLabel` already returns the hand-scoped name; the bare field is the raw `__()`
string the call site passes. So each control reads:

```jsx
<SelectControl
  label={__("clef", "piano-block")}          // bare visible label
  aria-label={fieldLabel(__("clef", "piano-block"))}  // hand-scoped accessible name
  …
/>
```

applied to: clef `SelectControl` (`:130`), octave `NumberControl` (`:140`),
alteration-note `SelectControl` (`:160`), alteration `NumberControl` (`:170`), the
per-row trash `Button` (`:188`, bare/icon-only visible + `aria-label`), and the
`AddButton` (`:195`). Design note on capitalization: today the bare fields are
lower-case fragments ("clef", "octave shift") that read as a sentence tail after the
hand label. As **visible** labels they should read as proper field labels — "Clef",
"Octave shift", "Alteration note", "Alteration", "Add alteration" (the spec's exact
visible strings). So the bare visible `label` strings get title-case while the
`aria-label` keeps composing via `sprintf("%1$s %2$s", hand, field)` for translator
reordering. (The `fieldLabel` helper's `field` argument stays the lower-case
fragment so the composed "Right hand clef" reads naturally; the visible `label` is a
separate title-cased string. Two distinct i18n strings per control — acceptable, and
the cleanest honest split.)

**`AddButton` (`ListControls.js`) — additive `aria-label` passthrough.** Today
`AddButton({ onClick, label })` renders `<Button …>{label}</Button>` with no
`aria-label`. Add an optional `ariaLabel` (or `"aria-label"`) prop forwarded to the
inner `Button`'s `aria-label`, so the visible children stay "Add alteration" while
the accessible name becomes "Right hand add alteration". This is a small additive
prop; the other two `AddButton` callers (`PitchList` "Add pitch", `AnnotationList`
"Add annotation") pass no `aria-label`, so their accessible name stays the visible
text (unchanged). The `Button` mock already maps `ariaLabel ?? label`, so the
passthrough is honored in unit tests and on the real component.

**Flat-layout per-hand heading = OPTIONAL, design recommends OMIT.** The spec
downgraded the flat (SectionPanel) per-hand heading to optional sighted-UX polish
(a11y is carried by the `aria-label`s). **This design omits it.** Rationale: adding
a `fieldset`+`legend` (the cheapest-real option) buys only sighted grouping at the
cost of a CSS reset for the default fieldset chrome and a small visual change to a
panel no acceptance criterion requires; the `aria-label`s already disambiguate the
two hands for AT, and omitting keeps the change surface minimal and test-churn-free.
If a future reviewer wants the sighted heading, `fieldset`+`legend` remains the
recommended dependency-free mechanism — but it is explicitly out of this design.

**Test strategy — CORRECTS the spec's "zero churn".** OPT-1 keeps every control's
**accessible name** hand-scoped, so all queries by accessible name pass unchanged.
But one set of queries hits **visible text**, and those DO churn:

- **Stays green (accessible-name queries):** the clef/octave/alteration-note/
  alteration controls are queried via `fieldByName` = `[aria-label="Right hand
  clef"]` (`contextControls.test.js:234,251,275,290,338,…`; `SongPanel.test.js:219,
  226,…`), and the **remove**-alteration `Button` via `buttonByName` =
  `aria-label` match (`contextControls.test.js:365`). OPT-1 preserves those
  `aria-label`s, so these match unchanged.
- **MUST update (visible-text queries):** the **add**-alteration button is queried
  by `buttonByText` (= `button.textContent === name`) at
  `contextControls.test.js:347,371,385`, all with `"Right hand add alteration"`.
  Under OPT-1 the `AddButton`'s **visible text** becomes bare `"Add alteration"`
  (its `aria-label` is "Right hand add alteration"). So these three calls must change
  to `buttonByText(container, "Add alteration")` (or switch to
  `buttonByName(container, "Right hand add alteration")`). Whole-suite grep confirms
  these three are the **only** visible-text queries touching a HandConfig control;
  every other `buttonByText` (Add pitch / Remove section / Add annotation / …) is a
  different control whose label does not change under S1.
- **One additive assertion (S1 acceptance):** add a unit assertion that the add
  button's **accessible name** is "Right hand add alteration" while its **visible
  text** is "Add alteration" (locks the OPT-1 split in). Optionally assert a control
  shows bare visible "Clef" while accessible name stays "Right hand clef".
- **e2e churn = ZERO (confirmed).** Whole-spec grep: no `getByLabel`/`getByText`
  targets any HandConfigEditor inspector control. Every "Right hand"/"Left hand" e2e
  string is a tree row (`treeRow`), an action-menu label ("Add note to Right hand
  of…", "Actions for Note 1 of Right hand of…"), or `expandRow("Right hand")` — none
  of which S1 touches.
- **Real-component proof (standing constraint):** because the mock and the real
  component both let a passed `aria-label` override the named `label` (researcher-
  confirmed against Gutenberg trunk's `restProps` spread), one e2e/real-component
  check confirms a control's **visible** label reads bare "Clef" while its
  **accessible name** stays "Right hand clef" — proving the override on the real
  `<select>`/`<input>`, so a green mock can't mask a real regression. This is the one
  place OPT-1 must be proven against the real component.

---

## S4 — Floating trash icons (design: in-place `alignment` + top-level `__list-row` CSS)

The spec fixed the approach (in place, no `EditableList`; `alignment="flex-start"`
on every row; safe-bits-only CSS at the **top level**, not nested). This phase
decides the className-wiring shape and where the CSS lives.

**Where the `alignment` edit lives.** One edit: add `alignment="flex-start"` to the
`HandConfigEditor` alters-row `HStack` (`:158`) — `PitchList.js:41` and
`AnnotationList.js:55` already have it. Three rows now consistent.

**Where the `className` hook lives — design choice: pass `className="…__list-row"`
on each row `HStack` directly.** Today no list row passes a `className` (grep-clean).
The `HStack` mock spreads `...rest` onto its `<div>`, and the real `HStack` forwards
`className`, so `<HStack className="wp-block-piano-block-piano__list-row"
alignment="flex-start">` reaches the DOM in both. Three call sites get the className
(PitchList, AnnotationList, HandConfigEditor alters row). No shared component (S8).
The class string is the full `wp-block-piano-block-piano__list-row` (BEM-style,
matching the existing `__tree`/`__canvas` convention) so the CSS selector is
unambiguous.

**Where the CSS lives — `editor.scss`, TOP-LEVEL, NOT nested under the wrapper.**
This is the one easy-to-get-wrong part. The existing `&__workspace`/`&__tree`/
`&__canvas` rules are nested **inside** `.wp-block-piano-block-piano { … }`
(`editor.scss:8`), which compiles to `.wp-block-piano-block-piano__workspace`, etc.
But the inspector panels render in `InspectorControls` — the WordPress **sidebar**,
**outside** the block wrapper in the DOM. A rule nested under the wrapper block would
NOT match the sidebar. So the `__list-row` rule must be emitted as a **stylesheet-
root** selector:

```scss
// At editor.scss root (NOT inside .wp-block-piano-block-piano { … }):
.wp-block-piano-block-piano__list-row {
  // The trailing trash button is a fixed-size, non-shrinking item pinned to the
  // input edge rather than stretching or collapsing.
  > button:last-child { flex: 0 0 auto; }
  // The leading editor keeps a sensible minimum so the row doesn't collapse.
  > :first-child { min-width: … ; }
}
```

(The exact `min-width` value and the precise child selectors are a code-phase
detail; the load-bearing design facts are: top-level selector, `flex: 0 0 auto` on
the trash, `min-width` on the leading control, and **`align-items: flex-end` OMITTED**
unless residual misalignment remains after S1+S3 shorten the labels.) Because the
trash `Button` and the `AddButton` are the row's direct children alongside the leaf
editor, the child selectors must be written against the **real** rendered structure
(the leaf editor — `PitchEditor`/`AnnotationEditor`/the two HandConfig controls —
renders its own elements as the row's leading children; the trash `Button` is the
trailing child). The code phase confirms the exact child shape per list when writing
the selectors; the design constraint is only-safe-bits + top-level placement.

**Test strategy — className (unit) + visual (e2e).** The `HStack` mock swallows
`alignment` (renders a bare `<div>`), so the alignment is **not** unit-observable;
the CSS itself is build/real-DOM. So:
- **Unit:** assert the row carries the `__list-row` className the CSS targets (the
  mock spreads `className` via `...rest`, so `container.querySelector('.wp-block-
  piano-block-piano__list-row')` is non-null for each of the three lists). This
  proves the CSS has its hook.
- **e2e / real-component:** the actual visual alignment (trash no longer floats
  mid-row) is verified against the real `HStack`/`Button`/`SelectControl` in the e2e
  suite — exercising the real components, not the stub. This satisfies the standing
  constraint (a green mock can't mask broken alignment).
- Optional: `size="small"` on the trash `Button` (review nicety) — the real `Button`
  accepts it, the mock swallows it (harmless); reduces the vertical mismatch.

---

## S5 — Section/measure label = select-and-reveal (design: one-line onClick change)

**Where the change lives — `RowLabelCell.onClick` (`StructureTree.js:141`).** The
cell already receives `isExpanded`, `onToggleExpanded`, and `expansionKey: rowKey`,
so no new props. Change:

```jsx
onClick={() => {
  onSelect?.();
  if (!isExpanded) onToggleExpanded?.(rowKey);
}}
```

- Select always fires.
- Expand fires **only when collapsed** — clicking an already-expanded label selects
  but does NOT collapse (collapse stays on the chevron / ArrowLeft, preserving the
  deliberate-collapse affordance; do not fight the user).
- `RowLabelCell` is shared by section AND measure rows, so both gain select-and-
  reveal in one edit. The hand-group row (`:450-457`) is a separate bespoke cell that
  toggles-only and never selects — **unchanged** (out of scope, "Explicitly fine").

**Test strategy — unit rewrite + e2e real-click.**
- **Unit (`StructureTree.test.js:377-386`):** the existing "selects (not toggles)…"
  case is rewritten. Clicking a **collapsed** section label (`expanded: new Set()`)
  now asserts BOTH `calls.select === [{kind:"section", sectionIndex:0}]` AND
  `calls.toggle === ["s0"]`. Add/keep a case: clicking an **already-expanded** label
  (`expanded: new Set(["s0"])`) asserts `calls.select` fires but `calls.toggle ===
  []` (no collapse). The chevron-toggle cases (`:388-405`) stay green unchanged
  (the chevron path is untouched). The test harness mounts fresh each test, so the
  `isExpanded` branch is driven purely by the `expanded` prop fixture.
- **e2e (`specs/editor.spec.js`):** drive a real **label** click (not the chevron)
  on a collapsed section/measure and confirm the row's descendants become visible —
  the "clicking the text doesn't reveal anything" report being fixed end to end.
  **Doc/comment note (TWO stale e2e docblocks):** both the `treeRow` helper docblock
  (`specs/editor.spec.js:290-293`) and the `expandRow` helper docblock (`:322-327`)
  currently assert "the label is SELECT-ONLY … a label click no longer toggles/expands
  — expansion is driven by the sibling chevron." After S5 that is stale for
  section/measure rows (their label now expands-if-collapsed). Both docblocks must be
  updated to describe select-and-reveal (hand-group rows remain the toggle-only
  exception). `expandRow` itself may keep clicking the chevron — both the chevron and
  a collapsed-row label now expand, so its callers still work — but its comment must
  stop asserting the label can't expand. The S5 e2e adds/uses a real label-click path
  to prove the reveal.

---

## S7 — Confirm section-level delete (design: state ownership, the central decision)

The spec fixed: section-only, controlled `__experimentalConfirmDialog`, both section
entry points, dialog lifted outside the unmounting `DropdownMenu`, mock extended.
This phase decides **where each dialog's state lives** — the central design call.

### Entry point A (easy) — `SectionPanel` "Remove section" button

**Self-contained, state local to the panel.** Add a `useState` confirm flag in
`SectionPanel`; the "Remove section" button opens it; a controlled `ConfirmDialog`
in the panel body owns the confirm/cancel. Shape (spec's reference wiring):

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

`SectionPanel` currently holds no state and does not import `useState`; this adds the
first (one `@wordpress/element` import line). The `ConfirmDialog` import is
`import { __experimentalConfirmDialog as ConfirmDialog } from "@wordpress/components"`.

### Entry point B (hard) — structure-tree section-row "Remove"

**Decision: lift the pending-confirm state to the `StructureTree` component level
(OPTION A), with ONE `ConfirmDialog` rendered once at the tree root.** Considered and
rejected: a per-section stateful `SectionRow` wrapper (OPTION B) — the rows are built
as inline `rows.push(<TreeGridRow …>)` in the render body, not components, so OPTION
B is a larger refactor and mounts N dialogs; OPTION A is the minimal, single-dialog
shape and `StructureTree` is already the natural owner of the row wiring.

**Why the lift is mandatory (the wrinkle).** The section row's remove fires from
inside `RowActionsMenu`'s `DropdownMenu` render-prop, and the `MenuItem` does
`onRemove?.(); onClose();` — the popover **unmounts on close**. A confirm flag hosted
inside the menu would be torn down before the dialog could act. So the flag and the
`ConfirmDialog` must live **outside** the `DropdownMenu`, at the tree level.

**Shape.** `StructureTree` gains its first state: `const [pendingRemoveSection,
setPendingRemoveSection] = useState(null)` (holds the `sectionIndex` to remove, or
`null`). The section row's remove call site (`:332`) changes from
`onRemove={() => onRemoveSection?.(sectionIndex)}` to
`onRemove={() => setPendingRemoveSection(sectionIndex)}` — capturing the
`sectionIndex` (which is in scope inside the `forEach`) into state. The `MenuItem`
still calls `onClose()` (the menu closes), but the pending state survives because it
lives in `StructureTree`, not the menu. ONE `ConfirmDialog` renders once at the tree
root (alongside/after `<TreeGrid>`):

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

Only the **section** call site (`:332`) is gated; the measure (`:406`) and note
(`:561`) call sites stay immediate. `RowActionsMenu` stays **generic** (untouched) —
the gating is entirely at the section call site + the tree-level dialog, so the
shared menu still serves all three levels unconfirmed-by-default.

**Two-dialogs-at-once is impossible by construction (verified).** The
`__experimentalConfirmDialog` "multiple instances not supported" caveat only bites if
two dialogs are **open** simultaneously. The panel dialog (entry A) lives in the
`InspectorControls` sidebar subtree; the tree dialog (entry B) lives in the tree
subtree. They are reached by mutually-exclusive user flows (you either click "Remove
section" in the panel OR "Remove" in a tree row's menu), each controlled by its own
local `isOpen`/`pending` state, never both true at once. `@wordpress/components` is
externalized (not in `node_modules`), so this caveat is a real-component runtime
concern only — the unit mock is a per-instance stand-in with no singleton. Safe by
construction; design records "only-one-open by construction" as the invariant.

**Internal state in StructureTree is test-safe (verified).** The
`StructureTree.test.js` harness mounts each test fresh (`render(element)` →
`root.render` once → `unmount`), never re-rendering new props on the same root, so
the new `pendingRemoveSection` state cannot leak stale between tests.

### Mock extension (`test/mocks/wordpress-components.js`)

Add an `isOpen`-respecting `__experimentalConfirmDialog` stand-in and export it.
Shape: render nothing when `!isOpen`; when open, render `children` (the message) +
a confirm `<button>` + a cancel `<button>` wired to `onConfirm`/`onCancel`. Rendering
**nothing when closed** mirrors controlled mode so tests not expecting a dialog see
no stray buttons. Export under both `__experimentalConfirmDialog` and (optionally)
`ConfirmDialog`. The confirm/cancel buttons need stable accessible names (e.g.
default "OK"/"Cancel", or explicit `confirmButtonText`/`cancelButtonText`) so tests
can locate them.

### Test strategy

- **Unit — section remove asks, accept removes, cancel does not:**
  - `SectionPanel.test.js` Remove-section tests (~`:257,272`, currently
    `buttonByText("Remove section")` → assert `removeSection` fired): now click
    "Remove section", then click the dialog's confirm, THEN assert
    `onRemoveSection` fired. Add a cancel case: click "Remove section", click the
    dialog's cancel, assert `onRemoveSection` did NOT fire.
  - `StructureTree.test.js:446` (the section-row Remove): now the menu's "Remove"
    only opens the dialog; the test clicks the dialog's confirm before asserting
    `calls.removeSection === [1]`. Add a cancel-does-not-remove case.
  - `Edit.test.js:461` (Remove section → asserts splice + selection clear): drive
    the confirm before asserting. **Note:** `Edit.test.js:461` uses
    `buttonByText("Remove section")` — that is the **SectionPanel** button (Edit
    renders the real panel), so it routes through entry A's dialog; the test adds the
    confirm step.
  - **Untouched (no confirm on these paths):** `StructureTree.test.js:476,527`
    (measure/note), `NotePanel.test.js:367,401`, `MeasurePanel.test.js:253,269`,
    `Edit.test.js:478,511,547` (measure/note removes) — these stay immediate and
    green, proving section-only scoping.
- **e2e:** `editor.spec.js:660` (section-row "Remove" → polls `sections.length`)
  inserts a real dialog-confirm click between `openRowAction(…, "Remove")` and the
  poll. The e2e drives the **real** `ConfirmDialog` end to end (accept path), proving
  the controlled dialog works on the real component. The note/measure e2e removes
  (`:565,648`) stay unconfirmed.

---

## S9 — Remove the redundant second JSON parse (design: thin-wrapper + edit.js switch)

**Where the new export lives — `song/validate.js`.** Add a **named** export
`parseAndValidate(rawString) → { data, errors }` that parses **once** and mirrors
`validateSong`'s parse-failure shape exactly. Re-express the existing default export
as a thin wrapper so there is one parse path and zero behavior drift:

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

This keeps `validateSong`'s `(raw) → string[]` contract and its `"Invalid JSON: …"`
message **byte-identical** (same template, same `error.message`), so `view.js:57` and
the ~15 test files that call `validateSong` are untouched. The has-errors case returns
the parsed `data` too (harmless — the caller decides what to do with it).

**Where the switch lives — `edit.js`.** Replace the two `useMemo`s + `safeParse`:
- Compute `const { data, errors } = useMemo(() => song.trim() === "" ? { data:
  newSong(), errors: [] } : parseAndValidate(song), [song])` — ONE parse.
- Derive `errors` from that result (the empty-string "no song" state still yields
  `errors: []`).
- Derive `working`: the empty-string case is `newSong()`; otherwise
  `errors.length > 0 ? null : data`. (The single result carries both.)
- **Delete `safeParse` (`:51-57`)** and the second `JSON.parse`.

Design note on the memo shape: `errors` and `working` currently live in two separate
`useMemo`s (`working` depends on `errors`). Collapsing to one memo over `song` keyed
on the single `parseAndValidate(song)` result is cleaner and is the intended
single-parse shape; the empty-string branch must still seed `working = newSong()`
with `errors = []` (canvas shows the empty grand staff, attribute stays `""` until
first edit — lazy seeding preserved). `accessibleName` and the rest read from
`working` as before.

**Test strategy — new unit + existing-green.**
- **New `parseAndValidate` unit test** (in `validate.test.js`): conformant song →
  `{ data: <parsed>, errors: [] }`; invalid JSON → `{ data: null, errors: ["Invalid
  JSON: …"] }`; non-conformant song → `{ data: <parsed>, errors: [<messages>] }`.
- **Existing `validateSong` tests stay green unchanged** — proves the default-export
  contract held (the thin wrapper returns `.errors` byte-identically). `view.js`
  untouched.
- **`Edit`/`edit.js` test:** a valid song still renders the canvas (parsed once); an
  invalid one still routes to `InvalidState`. (Existing `Edit.test.js` valid/invalid
  cases should stay green; the design changes the internal parse count, not the
  observable routing.)
- **Out of scope:** `view.js`'s gate stays on `validateSong` — NOT refactored to
  `parseAndValidate` (view.js does its own parse for the render; not the editor
  double-parse).

---

## S10 — Replace SectionPanel's duplicated `resetAll` (design: folded into S2)

**Where the change lives — `SectionPanel.js` `ToolsPanel` `resetAll`.** Replace the
inline destructure body (`:127-133`) with `resetAll={() => emitOverrides({})}` —
byte-identical behavior (`emitOverrides({})` performs the exact same override-strip).
This is **folded into the S2 collapse** (same `ToolsPanel`): after S2 the panel title
becomes "Section overrides" and `resetAll` stays `() => emitOverrides({})`. One edit
to the `ToolsPanel` element covers both S2 (title) and S10 (resetAll body).

**Test strategy — CORRECTION to the spec's "existing reset test stays green".** The
researcher confirmed there is **no unit test that drives `resetAll`** in
`SectionPanel.test.js`: the `ToolsPanel` mock **swallows** the `resetAll` prop
(`wordpress-components.js:308`), so `resetAll` is never invoked at unit level, and
the existing "drops tempo when cleared" case (~`SectionPanel.test.js:229-237`) clears
each override via the control's `onChange`, **not** via `resetAll`. So the spec's
"the existing reset test stays green" is **vacuously true** — there is no such test.
Consequence for design: S10's change (`resetAll={() => emitOverrides({})}`) is
behaviorally identical but **unit-unobservable** — the swap is safe and needs no test
update, but the design records that no existing test actually exercises it. **Design
recommendation:** the code phase MAY add a small unit assertion that drives `resetAll`
to prove drop-every-override (which would require the mock to stop swallowing
`resetAll` and expose it as a callable affordance — a mock extension), but this is
**optional**: it is not required by S10's acceptance and adds mock surface. Default
is to leave it unit-unobservable (matching the spec) and rely on the byte-identical
emission + `emitOverrides`'s existing coverage. The S2 title rename on this same
`ToolsPanel` may touch a panel-title assertion if one exists (re-confirmed at code
time).

---

## Optional polish (design: smallest in-scope mechanisms)

- **Stale `edit.js` `NotePanel.removeEvent` comment (`~:305-308`):** drop/correct the
  comment on the `onRemoveNote` path (grep confirms no `removeEvent` symbol). Pure
  comment edit.
- **Single-child `<Flex>` wrappers:** `SongPanel.js:78` ("Add section") and
  `InvalidState.js:46` ("Edit as JSON"). **Decision: drop the wrapper** (render the
  `Button` directly) in both — a single-child flex container adds nothing. Pick
  drop-the-wrapper consistently (not "standardize on `HStack`", which would keep a
  pointless one-child wrapper). The `Flex` import is then removed from each file if
  unused. Re-confirm no test asserts the wrapping `<div>` shape (the mock `Flex`
  renders a bare `<div>`, so any test asserting button presence by label still
  passes).
- **"Rename" `MenuItem` in `RowActionsMenu`:** add a "Rename" item to match List
  View. **Decision: smallest in-scope mechanism = focus the inspector panel's name
  field.** Section/measure names are already editable via their panels' name
  `TextControl` ("Section name"/"Measure name"). The Rename item selects the row
  (so its panel shows) and focuses the name field — no new inline-editor component.
  `RowActionsMenu` is generic and shared, so a "Rename" item there appears on all
  three levels; design note: notes have no name field, so either gate Rename to
  section/measure rows (pass an `onRename`/`canRename` per row) or scope it to where a
  name field exists. **Recommendation: pass an optional `onRename` per row and render
  the "Rename" item only when provided** (section/measure rows pass it; note rows do
  not) — keeps `RowActionsMenu` generic while not offering a no-op Rename on notes.
  This is the one polish item with real design surface; if the code phase finds the
  focus-the-field wiring non-trivial, it stays the smallest mechanism that satisfies
  "match List View" without a new editor.
- **`InvalidState` microcopy:** body "Switch to JSON" (`:34`) → "Edit as JSON" (match
  the button `:52` and the toolbar toggle). One string edit.
- **PR-description "no new dependencies" line:** `@wordpress/icons` IS a real intended
  runtime dep — **PR prose fix only, NO source change.** The doc phase notes it.
- **`editor.scss` duplicate header:** folded into M1's comment reconciliation (one
  accurate header).

---

## Test-strategy summary (which items ride a real contract → need real/e2e proof)

Per the standing "tests-green ≠ real-broken" constraint, these items are verified
against the **real** contract / **emitted** artifact, not only the jest mock:

- **M1** — emitted `build/style-index.css` (build-output grep), not source-only.
- **S1** — e2e/real-component check that visible label = bare "Clef" while accessible
  name stays "Right hand clef" (proves the `aria-label` override on the real
  `<select>`/`<input>`). Unit corrects the 3 `buttonByText` add-alteration sites.
- **S4** — unit asserts the `__list-row` className hook exists; e2e/real-component
  proves the actual trash alignment (the `HStack` mock swallows `alignment`).
- **S5** — unit rewrite (collapsed→select+expand, expanded→select-only); e2e drives a
  real label click and confirms descendants reveal.
- **S7** — unit drives the mock dialog's accept/cancel; e2e drives the **real**
  `ConfirmDialog` section-remove end to end.

Mock-level unit verification suffices (no real-contract risk) for:
- **S2** (title renames — `ToolsPanel` exposes `label`), **S3** (label renames),
  **S9** (`parseAndValidate` shape + `validateSong` contract — pure functions),
  **S10** (identical emission), and the optional polish (string/comment/wrapper
  edits).
- **S6** — no code; the tracking issue is filed by the code phase (verbatim text in
  the spec); the existing `SongCanvas`/`editor.scss` "later follow-up" comments stay
  accurate (no edit). Nothing else depends on S6 (verified: `decorateSelection`
  early-returns on non-event, no other consumer).
- **S8** — no extraction; existing `PitchList`/`AnnotationList`/`HandConfigEditor`
  tests stay green (only S4's `alignment`/`className` touch these files).

---

## Design Q&A with the researcher — all topics RESOLVED

- **Topic 1 (S7 state home): RESOLVED — OPTION A** (lift to `StructureTree`, one
  tree-level `ConfirmDialog`; section call site `:332` sets a `pendingSectionIndex`
  state instead of calling `onRemoveSection`; dialog `onConfirm` calls
  `onRemoveSection(pending)` + clears; `RowActionsMenu` stays generic; panel button
  is a trivial local `useState`). Confirmed by direct code reading AND the
  researcher: `@wordpress/components` is externalized (not in `node_modules`), so the
  "multiple ConfirmDialog" caveat is a real-component-runtime concern only, not a
  unit concern; `StructureTree.test.js` mounts each test fresh (no same-root
  re-render), so the new internal state is test-safe; the panel (sidebar) and tree
  dialogs are reached by mutually-exclusive flows, so "only-one-open by construction"
  holds.
- **Topic 2 (S1 test churn): RESOLVED — NOT zero churn.** The 3
  `buttonByText("Right hand add alteration")` sites (`contextControls.test.js:347,
  371,385`) are the **only** visible-text queries on a HandConfig control and must
  change to the bare visible text ("Add alteration") under OPT-1; every other
  HandConfig control is queried by accessible name (`fieldByName`/`buttonByName`) and
  stays green; e2e churn is **zero** (no `getByLabel`/`getByText` targets a HandConfig
  inspector control). Confirmed by whole-suite grep this phase and corroborated by the
  researcher.
- **Topic 3 (S10 unit-observability): RESOLVED (researcher catch).** No unit test
  drives `resetAll` in `SectionPanel.test.js` (the `ToolsPanel` mock swallows it), so
  the spec's "existing reset test stays green" is vacuously true; S10's swap is
  behaviorally identical and unit-unobservable. Folded into the S10 test-strategy
  section above; adding a driving test is optional (needs a mock extension).

