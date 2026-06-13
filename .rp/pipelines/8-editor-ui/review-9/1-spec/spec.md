# Review 9 — Spec: front-end placeholder-border leak + block-settings (inspector) UI cleanup + reuse/simplification

This is the standalone specification for review-9 of the Piano block editor-UI
feature (WordPress plugin; issue #8, PR #22). It defines WHAT to build and how it
will be verified. It does not prescribe architecture or a task breakdown (those
are later phases). A reader needs only this document to understand the scope and
the acceptance bar.

## Overview

The Piano block is a Gutenberg (WordPress block editor) block that renders
sheet-music notation as an SVG. It has an editor UI (a structure tree on the real
`__experimentalTreeGrid` primitive, a live canvas preview, and inspector/sidebar
panels that edit a JSON song model) and a front-end render (`render.php` →
`view.js` → an SVG drawn into the block wrapper). The architecture, the TreeGrid
keyboard accessibility, the controlled-component split, and the shared helpers
(`songModel`, `emit`, `edit`, `validate`) are already sound and are NOT being
reworked.

This review addresses a synthesized code-review of PR #22 covering one **Must-fix**
front-end style bug, ten **Should-fix** items (a cluster of inspector-UI problems
plus a few behavior and simplification fixes), and a list of **Optional polish**.
The single highest-impact fix is a front-end style leak: a `create-block` scaffold
placeholder border currently frames published sheet music for visitors. The rest
is concentrated in the block-settings (inspector) UI — redundant per-control "Right
hand / Left hand" label spam, four identically-named "Advanced" panels, labels that
wrap or truncate, and misaligned trash icons in list rows — plus a small set of
behavior (label-click reveal, destructive-delete confirmation) and code-cleanup
(double-parse removal, a duplicated `resetAll`) fixes.

Everything in this review stays **editor-side**. The song format/schema,
`render.php`, and the front-end SVG rendering are unchanged: a published song
renders **byte-identically** before and after this review. The Must-fix item only
*removes* a leaked editor style from the front end; it does not alter how the SVG
itself is drawn. Only `@wordpress/*` packages already available to blocks may be
used; no new outside dependencies (`@wordpress/icons` is already a bundled
dependency on this branch).

A standing constraint governs every acceptance criterion below: **"tests green"
must stay incompatible with "real component broken."** Where a fix rides a real
`@wordpress/components` / `@wordpress/icons` contract (the `aria-label` override,
the list-row CSS, the confirmation dialog) or a build-output fact (the front-end
CSS), the verification must exercise the **real** contract or the **emitted**
artifact — not only the jest stubs that mock `@wordpress/components` in the unit
suite.

### Why several items diverge from the review's literal wording

The review delegated four judgment calls to this phase; this spec records the
decisions and their rationale so a later reader does not have to reconstruct them:

- **S6 (canvas highlight for section/measure selections) is DEFERRED**, not built.
  A tracking issue is filed instead (exact title/body in the Requirements). The
  review itself framed S6 as "a deferred follow-up worth a tracking issue," the
  owner singled it out as the one deferrable item, the "where am I?" gap is already
  partly closed by the selected tree row (`aria-current`) and the kind-titled
  inspector panels (and is strengthened by S5 this review), and adding net-new
  canvas-decoration plumbing + CSS + e2e spends risk on the one item explicitly
  marked safe to defer.

- **S8 keeps the three list bodies SEPARATE** — no `EditableList` is extracted.
  The review explicitly asked this phase to weigh "net simplification vs. distinct
  invariants justify keeping them separate." Measured on the live tree, extraction
  is **net ~+13 LOC** (removes ~32 lines of scaffolding, adds a ~25–30-line
  component plus ~18 lines of call sites), the rule-of-three is unmet (only
  `PitchList` and `AnnotationList` are clean callers; `HandConfigEditor`'s alters
  body is a fragment among sibling controls whose `onChange` rebuilds the whole
  hand config and genuinely does not fit), and review-8 already rejected a generic
  `EditableList` with a "revisit only if a fourth list appears" trigger that is
  still unmet. So the distinct invariants justify keeping them separate.

- **S1 uses bare visible labels + a hand-scoped `aria-label`** (not a hidden-label
  or a new wrapper region as the only option). Confirmed against Gutenberg trunk
  source: `SelectControl`/`NumberControl` render `label` as a visible `<label>`
  and spread `{...restProps}` (including a consumer `aria-label`) onto the native
  element after the named `label`, so the `aria-label` reaches the real element and
  (per ARIA precedence) overrides the `<label>`-derived accessible name. This is
  honest on the real component, not a mock-only trick, and matches the review's
  "push hand scope to aria-label/help" instruction verbatim.

- **S7 confirms the SECTION-level remove only**, using
  `@wordpress/components` `__experimentalConfirmDialog`. Section removal is the
  single highest-blast-radius delete (it cascades to all the section's measures and
  notes — the review's explicit minimum). Confirming measure/note deletes too would
  over-prompt the frequent low-stakes cases and roughly triple the test churn; they
  keep the editor's global undo (Cmd-Z) as their recovery path.

## Requirements

Scope is the full owner-approved set: **M1 + S1–S10 + the optional polish**, while
preserving the review's "Explicitly fine as-is" decisions (see Out of Scope).
Line/file references below are evidence and starting points confirmed against the
live tree at branch `worktree-8-editor-ui` (tip `c7a25d1`); they will shift as
fixes land, so later phases must re-confirm exact coordinates.

### M1 — Remove the front-end placeholder-border leak (Must fix)

`src/style.scss` defines a `.wp-block-piano-block-piano { border: 1px dashed
#767676; padding: 1em; color: #767676; }` rule, and `src/block.json` loads
`style.scss` as `"style"` (front end AND editor). The emitted
`build/style-index.css` therefore carries
`.wp-block-piano-block-piano{border:1px dashed #767676;color:#767676;padding:1em}`,
while the editor bundle `build/index.css` does not — a pure front-end leak. On a
published page that wrapper holds the *finished* rendered SVG, so every published
piano block draws its sheet music inside a dashed-gray "empty block" placeholder
box with gray ink bleed and `1em` padding.

1. Delete the `.wp-block-piano-block-piano { … }` border/padding/color rule from
   `src/style.scss`. Finished music needs no chrome. **Keep the `@font-face`**
   declaration — the front-end SVG glyphs need the font.
2. Update the stale header comments so they no longer claim "shared wrapper rules"
   load on the front end. After this change, `src/style.scss` carries **only** the
   `@font-face` on the front end. The current `src/style.scss` header
   (~`:1-5`) and the `src/editor.scss` header (~`:1-6`) both assert that
   `style.scss` carries "the @font-face declaration and the shared wrapper rules
   (border, padding, color)" — both must be corrected to describe the new reality
   (this overlaps the Optional `editor.scss` duplicate-header trim — fold them into
   one accurate description rather than leaving two stale ones).
3. No editor-only replacement affordance is added. M1 is a pure removal; no other
   item in this review requires an editor-only border on the wrapper.

### S1 — Drop the redundant "Right hand / Left hand" per-control prefix (Should fix)

`HandConfigEditor` currently prefixes the hand name onto every control via
`sprintf("%1$s %2$s", hand, field)` → "Right hand clef", "Right hand octave shift",
"Right hand alteration note", "Right hand alteration", the add button "Right hand
add alteration", and the remove button "Right hand remove alteration". In the
narrow inspector these wrap to 2–3 lines and then repeat for the left hand. In the
tiered layout each hand already has its own `ToolsPanelItem` titled "Right
hand"/"Left hand", making the prefix doubly redundant.

1. In `HandConfigEditor`, the controls' **visible** labels become the bare field
   names — "Clef", "Octave shift", "Alteration note", "Alteration", and the add
   button reads "Add alteration" — while each control **keeps a hand-scoped
   `aria-label`** ("Right hand clef", "Right hand octave shift", …, "Right hand add
   alteration", "Right hand remove alteration"), still composed via `sprintf` for
   translator reordering:
   - The `SelectControl`/`NumberControl` controls: visible `label` = bare field
     name; explicit `aria-label` = the hand-scoped name.
   - The per-row trash `Button`: bare or icon-only visible affordance with
     `aria-label` = "Right hand remove alteration" (per hand).
   - The `AddButton`: visible children "Add alteration"; an `aria-label` =
     "Right hand add alteration" forwarded to its inner `Button`. (`AddButton` must
     gain an `aria-label` passthrough to its inner `Button` — a small additive prop.)
2. The accessible name of every control must remain the hand-scoped "Right hand
   <field>" / "Left hand <field>" — carried now by the explicit `aria-label`
   instead of by the visible `label`. This must hold on the **real**
   `@wordpress/components` `<select>`/`<input>`/`Button`, not only in the unit mock.
3. The tiered layout's existing per-hand `ToolsPanelItem` heading is unchanged. A
   visible per-hand "Right hand"/"Left hand" heading in the flat (Section-panel)
   layout is **optional sighted-UX polish**, NOT a requirement — accessibility is
   carried by the per-control `aria-label`s, so the flat layout needs no new titled
   region. If a later phase chooses to add one for sighted clarity, a `fieldset` +
   `legend` (with a small CSS reset for the default border/margin) is an acceptable
   real, dependency-free mechanism; omitting it is equally acceptable and adds no
   test churn.

### S2 — Rename the four generic "Advanced" panels; collapse the SectionPanel double wrapper (Should fix)

Four panels are literally titled "Advanced": the event optional-members panel
(`NotePanel`), the barlines + annotations panel (`MeasurePanel`), the section
overrides panel (`SectionPanel`), and the tiered advanced panel
(`ContextEditor`, used by the Song panel). Three can stack in one sidebar for an
event selection and all read identically.

1. Rename all four "Advanced" titles to distinct domain names so no two visible
   panels read identically. The intended distinct names (exact wording is a
   design-phase nicety, but the intent — four distinct domain titles — is fixed):
   - `NotePanel` → "Note details"
   - `MeasurePanel` → "Barlines & annotations"
   - `SectionPanel` → "Section overrides"
   - `ContextEditor` (tiered) → "Tempo & staves"
2. Collapse `SectionPanel`'s redundant double disclosure: today a `ToolsPanel
   label="Advanced"` has a single child, a `ToolsPanelItem label="Section
   overrides"` wrapping the `ContextEditor`. The panel should carry the domain
   title ("Section overrides") and host the `ContextEditor` directly (or via a
   single item) — not a generic "Advanced" panel whose only child is a "Section
   overrides" item. The `resetAll` behavior (drop every override) must be preserved
   through the collapse.
3. Update the three tests that pin the tiered panel's "Advanced" string (two in
   `contextControls.test.js`, querying `[aria-label="Advanced"]`, and one in
   `SongPanel.test.js`, asserting the language select is NOT inside it) to the new
   tiered title. The NotePanel/MeasurePanel/SectionPanel renames are not pinned by
   that literal string in tests, but later phases must re-confirm against the live
   tests as they shift.

### S3 — Shorten labels that wrap or truncate (Should fix)

Shorten four visible labels and update every test that queries them by the old
name:

1. `PitchEditor` visible label "Note name" → "Note".
2. `AnnotationEditor` visible labels: "Annotation text" → "Text"; "Annotation
   placement" → "Placement"; "Annotation staff" → "Staff". The placement select
   currently truncates to "Ab…" because the long "Annotation placement" label
   starves the option text; after shortening it must no longer truncate.
3. Update the tests that query these labels by their old names (in
   `NotePanel.test.js`, `pitches.test.js`, and `annotations.test.js`) to the new
   short names.

These controls are single-instance per panel for the accessible-name purpose
(except the pitch list, which can render several "Note" selects for a chord — those
are index-keyed rows and existing tests act on a single row), so the visible label
and the accessible name may both be the short form here; no per-hand
disambiguation applies.

### S4 — Fix the floating / misaligned trash icons in list rows (Should fix)

The list rows (in `PitchList`, `AnnotationList`, and `HandConfigEditor`'s
alterations) are bare `HStack`s, and `src/editor.scss` has no inspector/list rules
at all. When a control's label wraps to two lines the row grows taller than the
fixed ~40px trash `Button`, so the icon parks at the row top. The worst case is the
`HandConfigEditor` alterations row, whose `HStack` has no `alignment` prop at all
(its trash floats mid-row); `PitchList` and `AnnotationList` already pass
`alignment="flex-start"`.

1. Standardize `alignment="flex-start"` on every list row, **in place** (S8 keeps
   the three bodies separate — no shared component). `PitchList` and
   `AnnotationList` already pass it; **add `alignment="flex-start"` to the
   `HandConfigEditor` alterations row** — the one row that lacks it.
2. Add a small editor-only list-row CSS rule carrying only the safe, uncontentious
   bits: `flex: 0 0 auto` on the trailing trash `Button` (so it never
   shrinks/stretches) and a sensible `min-width` on the leading select. **Omit
   `align-items: flex-end`** unless residual misalignment remains after S1+S3 have
   shortened the labels (with single-line labels the editor and trash are the same
   height and alignment barely matters). The row(s) must pass a `className` hook
   (e.g. `__list-row`) so the CSS has a target; today no list row/control passes a
   `className`, so this is net-new wiring.
3. **DOM-scoping constraint (must be honored):** the inspector panels render inside
   `InspectorControls` — the WordPress sidebar, which is **OUTSIDE** the block's
   `.wp-block-piano-block-piano` wrapper. The existing `&__workspace`/`&__tree`/
   `&__canvas` rules are nested under the wrapper block and therefore do not reach
   the sidebar. The list-row rule MUST be emitted as a **top-level** selector
   (`.wp-block-piano-block-piano__list-row { … }` at the stylesheet root, not
   nested inside the wrapper block) so it matches the sidebar DOM.
4. Optionally give the per-row trash `size="small"` (review nicety) — it shrinks
   the icon button and directly reduces the vertical mismatch; the real `Button`
   accepts `size` and the mock harmlessly swallows it.

The bigger win is S1 + S3: once the labels stop wrapping, the rows are single-line
and read cleanly with very little CSS; the alignment fix is belt-and-suspenders for
any residual multi-line case (e.g. a long localized label).

### S5 — Make a section/measure label click "select-and-reveal" (Should fix)

The label `Button` in the structure tree's `RowLabelCell` currently calls only
`onSelect` on click; expand/collapse lives solely on the chevron and the TreeGrid
Arrow keys. This is deliberate (not a bug) but diverges from core's List View and
is internally inconsistent — the hand-group row's label *does* toggle on click. It
is the "clicking the text doesn't reveal anything" behavior reported in review.

1. Change `RowLabelCell`'s label `Button` `onClick` to select-and-reveal:
   `onSelect()` always fires, and `onToggleExpanded(rowKey)` fires **only when the
   row is currently collapsed**. The cell already receives `isExpanded`,
   `onToggleExpanded`, and `rowKey` (the expansion key), so no new props are
   needed.
   - Clicking a **collapsed** section/measure label selects it AND expands it.
   - Clicking an **already-expanded** label selects it but does NOT collapse it —
     collapse stays on the chevron / ArrowLeft (preserving the deliberate-collapse
     affordance; do not fight the user).
2. Hand-group rows are unchanged (they remain toggle-only and never select).
3. Update the unit test that currently pins "selects (not toggles) when a section
   label is clicked": clicking a **collapsed** section label must now assert both
   the select call AND the expand toggle (`toggle === ["s0"]`); add or keep a case
   asserting that clicking an **already-expanded** section label selects but does
   NOT toggle. The chevron-toggle test cases stay green unchanged. The e2e suite
   must drive a real label click and confirm the row's descendants become visible.

### S6 — Section/measure canvas highlight: DEFER (file a tracking issue)

Selecting a section or measure row in the structure tree produces no canvas
feedback; only an *event* (note/rest) selection paints the editor-only
`.is-selected` recolor. This is the biggest "where am I?" gap, but it is **deferred
this review** — no canvas highlighting is added. Instead, the code phase files a
GitHub tracking issue with the exact title and body below, so the work is recorded
and not silently dropped. The existing "later follow-up" comments in `SongCanvas`
and `editor.scss` already describe the deferred state accurately and need no edit.

**Tracking issue to file — Title:**

```
Editor: highlight the selected section/measure on the sheet-music canvas
```

**Tracking issue to file — Body:**

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

### S7 — Confirm the section-level destructive delete (Should fix)

Four delete sites currently have no confirmation and no surfaced undo, relying
entirely on the editor's global undo (Cmd-Z): the structure-tree `RowActionsMenu`
"Remove", and the panel "Remove note" / "Remove measure" / "Remove section"
buttons. Removing a section silently deletes all its measures and notes — the
highest blast radius.

1. Add a confirmation to the **section-level remove only** — the single delete that
   cascades to all the section's measures and notes — at **both** section entry
   points (so the same destructive action is guarded wherever it is triggered):
   - The `SectionPanel` "Remove section" button.
   - The structure-tree section-row "Remove." Gate the **section call site** (the
     `onRemove={() => onRemoveSection?.(sectionIndex)}` wiring on the section row),
     NOT the shared `RowActionsMenu` component — `RowActionsMenu` is reused by
     section/measure/note rows, so confirming inside it would wrongly gate all three
     levels. `RowActionsMenu` stays generic. **Constraint the design must honor:**
     the `DropdownMenu` popover unmounts on close (it calls `onRemove(); onClose();`),
     so the pending-confirm state and the dialog MUST be lifted **outside** the
     `DropdownMenu` (to the section row or the `StructureTree` level) so the dialog
     survives the menu closing.
2. Measure-level and note-level removes (both the structure-tree and the panel
   entry points) stay **immediate** — lower blast radius; the editor's global
   Cmd-Z undo remains their documented recovery path, unchanged.
3. The confirmation mechanism is `@wordpress/components`
   `__experimentalConfirmDialog` (imported as `ConfirmDialog`), used in
   **controlled** mode: the parent owns visibility via an `isOpen` state and must
   call `setIsOpen(false)` inside BOTH the `onConfirm` and `onCancel` callbacks. The
   dialog body is a clear message (e.g. "Remove this section and all its measures
   and notes?"). The two section entry points must not both have an open dialog at
   once (the component does not support multiple simultaneous `ConfirmDialog`s);
   keep each dialog's state local and only-one-open by construction. `window.confirm`
   is NOT the mechanism (it is non-idiomatic, and jsdom's `window.confirm` returns
   `false` by default, which would block every delete in the unit tests).
4. **Test plumbing (part of S7's acceptance):** the unit mock
   (`test/mocks/wordpress-components.js`) has no `ConfirmDialog`, so it must be
   extended with an `isOpen`-respecting stand-in that renders the message plus a
   confirm `<button>` and a cancel `<button>` and **renders nothing when `isOpen`
   is false** (mirroring controlled mode, so tests not expecting a dialog see no
   stray buttons). The section-remove test sites must drive the confirm's accept
   before asserting the remove fires, plus a new cancel-does-NOT-remove case; the
   measure/note remove tests stay untouched.

### S8 — Keep the three list bodies separate; do NOT extract `EditableList` (Should fix — decided to keep separate)

`PitchList`, `AnnotationList`, and `HandConfigEditor`'s alterations render a
similar map → `HStack` row → editor + trash `Button` → `AddButton` structure. The
review asked this phase to decide whether extracting one shared `EditableList`
(into `ListControls.js`, which already exports `AddButton`) is a net simplification
or whether the distinct invariants justify keeping them separate.

**Decision: keep them separate. Do NOT add an `EditableList`.**

1. No `EditableList` is added. `ListControls.js` keeps exporting only `AddButton`.
   `PitchList`, `AnnotationList`, and `HandConfigEditor` keep their own list bodies.
2. The S4 alignment fix lands in place (see S4) — no shared component is needed to
   fix the floating trash. Any `__list-row` className hook is applied to each
   list's existing row `HStack` directly.
3. Rationale (recorded so the question is not silently dropped, and the divergence
   from the review's literal "extract one `EditableList`" wording is explicit):
   extraction is net ~+13 LOC (no reduction); the rule-of-three is unmet (only
   `PitchList` and `AnnotationList` are clean callers); `HandConfigEditor`'s alters
   body genuinely does not fit (it is a fragment among sibling controls, each row is
   two controls, and its `onChange` rebuilds the whole hand config via
   `buildHandConfig` from rows derived and written back as a map — forcing it into a
   shared list would import a storage-transform concern into a list primitive); and
   review-8 already rejected a generic `EditableList` with a "revisit only if a
   fourth list appears" trigger that is still unmet. The two opposite per-list
   invariants (`PitchList`'s `canRemove = items.length > 1` note-min-one rule and
   `AnnotationList`'s collapse-empty-to-`undefined` rule) further argue for keeping
   them as independent, readable bodies.

### S9 — Remove the redundant second JSON parse per render (Should fix)

In `edit.js`, the same song string is parsed twice on every change of a valid
song: `validateSong(song)` (which `JSON.parse`s internally and discards the parsed
object, returning only `string[]`) followed by `safeParse(song)` (a second
`JSON.parse`).

1. Add `parseAndValidate(raw) → { data, errors }` as a **new NAMED export** of
   `song/validate.js` that parses the string **once** and mirrors `validateSong`'s
   parse-failure behavior exactly:
   - On a `JSON.parse` throw: `{ data: null, errors: ["Invalid JSON: <msg>"] }` —
     using the exact same `"Invalid JSON: …"` message `validateSong` produces.
   - On a conformant parse: `{ data: <parsed>, errors: [] }`.
   - On a parsed-but-non-conformant song: `{ data: <parsed>, errors: [<messages>] }`.
2. Keep `validateSong` as the **default export, byte-identical** in signature and
   behavior: `(raw) → string[]`, with its `"Invalid JSON: …"` parse-failure output
   unchanged. It MAY be re-expressed as a thin wrapper over `parseAndValidate`
   (returning `.errors`), but its public contract must not change — the front-end
   `view.js` render gate (`validateSong(raw).length > 0`) and ~15 test files depend
   on it and must keep passing untouched.
3. In `edit.js`, compute `parseAndValidate(song)` **once** (memoized on `song`),
   derive both `errors` and the parsed `working` object from its single result, and
   **delete `safeParse`** and the second parse. This collapses the two `JSON.parse`
   calls to one per change. The existing behavior (a valid song renders the canvas;
   an invalid one routes to `InvalidState`) is unchanged.
4. Add a `parseAndValidate` unit test (parsed `data` for a conformant song;
   `{ data: null, errors: ["Invalid JSON: …"] }` for invalid JSON; the error list
   for a non-conformant song). The existing `validateSong` tests stay green
   unchanged, proving the default-export contract held.

The front-end `view.js` gate stays on `validateSong` and is NOT refactored to
`parseAndValidate` (view.js does its own parse for the render and is not part of
the editor double-parse).

### S10 — Replace SectionPanel's duplicated `resetAll` (Should fix)

`SectionPanel`'s `resetAll` body destructures `{ tempo, timeSignature, rightHand,
leftHand, ...keep } = section; emitSection(keep)`, which is exactly what
`emitOverrides({})` already does. Replace the `resetAll` body with
`resetAll={() => emitOverrides({})}`. Behavior is byte-identical; only the
duplication is removed. (This interacts with S2's double-wrapper collapse — the
`resetAll` lives on the `ToolsPanel`; it stays `() => emitOverrides({})` after the
title rename.) The existing SectionPanel reset test stays green.

### Optional polish (in scope)

1. Drop or correct the stale `edit.js` comment that references a non-existent
   `NotePanel.removeEvent` symbol (grep confirms no such symbol exists) on the
   `onRemoveNote` path.
2. Single-child `<Flex>` wrappers (one wrapping the "Add section" `Button` in
   `SongPanel`, one wrapping the "Edit as JSON" `Button` in `InvalidState`): drop
   the wrapper or standardize on `HStack` — pick one and apply consistently.
3. Add a "Rename" `MenuItem` to `RowActionsMenu` to match List View (it currently
   has Duplicate / Add before / Add after / Remove). Use the smallest in-scope
   mechanism — e.g. focus the panel's name field or open an inline editor; keep it
   small.
4. Align the `InvalidState` microcopy: the body text says "Switch to JSON" while
   the button reads "Edit as JSON" — use "Edit as JSON" in both (matching the
   toolbar toggle).
5. Correct the PR description's "no new dependencies" line: `@wordpress/icons` IS a
   real, intended runtime dependency on this branch — it is the right call, so the
   PR prose is what needs fixing, NOT the code (no source change for this item).
6. Trim the `editor.scss` duplicate file-header comment to one accurate
   description (folded with M1's comment reconciliation above).

## Out of Scope

The following must NOT be changed. The "Explicitly fine as-is" items were validated
by the review as correct decisions; do not "fix" them.

- **The song format/schema, `render.php`, and the front-end SVG rendering.** A
  published song must render **byte-identically** before and after this review. M1
  only removes a leaked editor style; it must not change how the SVG is drawn.
- **The front-end `view.js` validator gate.** It stays on `validateSong`
  (unchanged) and is NOT refactored to `parseAndValidate`.
- **New outside dependencies.** Only `@wordpress/*` packages already available to
  blocks may be used (`@wordpress/icons` is already bundled on this branch).
- **S6 canvas highlighting.** Explicitly deferred to a tracking issue (filed, not
  built this review).
- **TreeGrid keyboard accessibility** — verified complete: `aria-label`,
  `onExpandRow`/`onCollapseRow` → the shared `data-expansion-key` handler,
  `isExpanded` + `data-expansion-key` on every expandable row, leaf notes carrying
  neither, the roving `cellProps`, and the real-browser Playwright Arrow-key test.
  The `aria-hidden` / pointer-only chevron is correct (mirrors core's
  `ListViewExpander`). Do not rework it.
- **`__next40pxDefaultSize` universality** and the fact that
  `__nextHasNoMarginBottom` is correctly never passed to any `NumberControl`.
  Element-imported icons, `isDestructive`, and `sprintf` + `__` i18n are clean — do
  not touch.
- **Load-bearing duplication that must stay:** the depth-fixed
  `setSectionAt`/`setMeasureAt`/`setEventAt` helpers (collapsing them would corrupt
  the song); `omitEmpty` vs `omitFalsy` (different rules); the per-panel `resetAll`
  key sets (different per level — only SectionPanel's same-file dup is S10); and the
  hand-group row's bespoke non-selecting label cell.
- **Prior-review wins to preserve:** select-only labels (now extended by S5 to
  select-and-reveal), the single expansion `Set`, coordinate keys, the
  `[aria-level]` indent, the recolor-only event highlight, the TreeGrid keyboard
  model / accessibility parity, and raw-JSON mode untouched.

## Acceptance Criteria

Each item is "done" only when its verification passes. The standing constraint
applies throughout: where a fix rides a real `@wordpress/components` /
`@wordpress/icons` contract or a build-output fact, the verification exercises the
**real** contract or the **emitted** artifact, not only the jest stubs.

**M1 — Front-end placeholder-border leak (Must)**
- [ ] The `.wp-block-piano-block-piano { border/padding/color }` rule is deleted
  from `src/style.scss`; the `@font-face` is kept.
- [ ] The `style.scss` and `editor.scss` header comments are updated — they no
  longer claim "shared wrapper rules" load on the front end; `style.scss` is
  described as carrying only `@font-face` there.
- [ ] After `npm run build`, **`build/style-index.css` no longer contains the
  wrapper border/padding/color rule** (it retains only `@font-face` referencing the
  woff2); `build/index.css` (editor) is unaffected; the published front-end render
  is unframed. This is a build-output / emitted-CSS verification, not a source-only
  check.

**S1 — Drop the per-control hand prefix (bare visible label + hand in `aria-label`)**
- [ ] `HandConfigEditor` controls show **bare** visible labels ("Clef", "Octave
  shift", "Alteration note", "Alteration", "Add alteration") while keeping a
  hand-scoped **`aria-label`** ("Right hand clef", etc.).
- [ ] `AddButton` forwards an `aria-label` to its inner `Button`.
- [ ] The hand-scoped `aria-label` reaches and overrides the accessible name on the
  **real** `<select>`/`<input>`/`Button` — verified by an e2e / real-component
  check that the **visible** label reads the bare form (e.g. "Clef") while the
  **accessible name** stays hand-scoped (e.g. "Right hand clef"), not only in the
  mock.
- [ ] Existing unit tests that query controls by the hand-scoped accessible name
  pass **unchanged** (the accessible name is preserved via the explicit
  `aria-label`); e2e churn is zero (the "Right hand"/"Left hand" e2e strings are
  tree rows / action-menu labels, not HandConfigEditor controls).
- [ ] A per-hand visible heading in the flat layout is optional and, if omitted,
  introduces no test churn (a11y is carried by the `aria-label`s).

**S2 — Rename "Advanced" panels; collapse SectionPanel double wrapper**
- [ ] All four "Advanced" titles are renamed to distinct domain names (Note details
  / Barlines & annotations / Section overrides / Tempo & staves); no two visible
  panels read identically.
- [ ] SectionPanel's redundant `ToolsPanel "Advanced"` → single `ToolsPanelItem
  "Section overrides"` double wrapper is collapsed (the domain title is on the
  panel; `resetAll` behavior preserved).
- [ ] The three "Advanced"-string test assertions (the tiered panel) are updated to
  the new tiered title; unit tests assert the new titles render and the old
  "Advanced" string no longer appears on these panels; ToolsPanel reset/deselect
  behavior is unchanged.

**S3 — Shorten wrapping/truncating labels**
- [ ] Visible labels are shortened: "Note name" → "Note"; "Annotation text/
  placement/staff" → "Text"/"Placement"/"Staff". The placement select no longer
  truncates.
- [ ] Every test querying the old label names is updated to the new short names and
  passes.

**S4 — Fix floating trash icons in list rows**
- [ ] `alignment="flex-start"` is on every list row, fixed in place
  (already on `PitchList` and `AnnotationList`; **added to the `HandConfigEditor`
  alterations row**). No shared component (S8 keeps them separate).
- [ ] A `__list-row` (or equivalent) CSS rule is added as a **top-level** selector
  (NOT nested under the wrapper block, so it reaches the sidebar DOM), carrying only
  the safe bits (`flex: 0 0 auto` on the trash, `min-width` on the select);
  `align-items: flex-end` is omitted unless residual misalignment remains.
- [ ] The alignment prop is swallowed by the unit mock, so the fix is verified via
  (a) a unit assertion that the row carries the `className` hook the CSS targets,
  and (b) an e2e / real-component check of the actual visual alignment (exercising
  the real `HStack`/`Button`/`SelectControl`).

**S5 — Section/measure label click = select-and-reveal**
- [ ] `RowLabelCell`'s label `onClick` selects always and expands only when
  currently collapsed (`onSelect()` then `if (!isExpanded) onToggleExpanded(rowKey)`);
  collapse stays on the chevron / ArrowLeft; hand-group rows are unchanged.
- [ ] The unit test is rewritten: clicking a **collapsed** section label asserts
  both select and expand; a case asserts that clicking an **already-expanded** label
  selects but does NOT collapse. The chevron-toggle cases stay green. The e2e suite
  drives a real label click and confirms the row's descendants become visible.

**S6 — Section/measure canvas highlight (deferred)**
- [ ] No canvas highlighting is added this review.
- [ ] The tracking issue is filed with the exact title and body given in the
  Requirements (S6). The existing "later follow-up" comments remain accurate (no
  edit needed).

**S7 — Confirm the section-level destructive delete**
- [ ] The **section-level remove only** asks for confirmation via a controlled
  `__experimentalConfirmDialog` (`setIsOpen(false)` in both callbacks) at **both**
  section entry points: the `SectionPanel` "Remove section" button and the
  structure-tree section-row "Remove" (gating the section call site, with the
  pending-confirm flag + dialog lifted **outside** the `DropdownMenu`).
  `RowActionsMenu` stays generic.
- [ ] Measure-level and note-level removes stay immediate (Cmd-Z recovery,
  documented).
- [ ] The unit mock gains an `isOpen`-respecting `ConfirmDialog` stand-in (renders
  nothing when closed); the section-remove unit and e2e sites drive the confirm's
  accept, a cancel-does-NOT-remove case is added, and the measure/note remove tests
  are untouched. Unit tests assert: section remove asks for confirmation, accept
  removes, cancel does not; measure/note removes still fire immediately. The mock
  stand-in mirrors the real component's accept/cancel contract, and the e2e suite
  drives the real section-remove confirm end to end.

**S8 — Keep list bodies separate (no extraction)**
- [ ] **No `EditableList` is added.** `ListControls.js` exports only `AddButton`;
  `PitchList`, `AnnotationList`, and `HandConfigEditor` keep their own list bodies.
  The decision and its divergence from the review's literal "extract" wording are
  recorded with rationale (S8).
- [ ] No refactor touches these files beyond S4's alignment fix; the existing
  `PitchList` / `AnnotationList` / `HandConfigEditor` tests stay green unchanged.

**S9 — Remove the redundant second JSON parse**
- [ ] `parseAndValidate(raw) → { data, errors }` is added as a new **named** export
  of `song/validate.js`, mirroring the `"Invalid JSON: …"` parse-failure shape.
- [ ] `validateSong` remains the **default** export with byte-identical
  signature/behavior; `view.js` and the ~15 test files are untouched and still pass.
- [ ] `edit.js` parses **once** via `parseAndValidate`; `safeParse` is deleted; the
  two `JSON.parse` calls collapse to one. A new `parseAndValidate` unit test passes
  (parsed `data` for a conformant song; `{ data: null, errors: ["Invalid JSON: …"] }`
  for invalid JSON; the error list for a non-conformant song); existing validator
  tests stay green; a valid song still renders the canvas and an invalid one still
  routes to `InvalidState`.

**S10 — Replace SectionPanel's duplicated `resetAll`**
- [ ] SectionPanel's `resetAll` is replaced with `() => emitOverrides({})`;
  behavior is byte-identical; the existing reset test (reset drops every override,
  keeping `measures` and non-override keys) stays green.

**Optional polish**
- [ ] The stale `NotePanel.removeEvent` comment in `edit.js` is dropped/corrected.
- [ ] The single-child `<Flex>` wrappers (`SongPanel`, `InvalidState`) are dropped
  or standardized on `HStack`.
- [ ] A "Rename" `MenuItem` is added to `RowActionsMenu` (smallest in-scope
  mechanism).
- [ ] `InvalidState` microcopy is aligned: body "Switch to JSON" → the "Edit as
  JSON" verb.
- [ ] The PR description's "no new dependencies" line is corrected
  (`@wordpress/icons` is a real, intended runtime dependency) — PR prose only, no
  source change.
- [ ] The `editor.scss` duplicate file-header comment is trimmed to one accurate
  description (folded with M1's comment reconciliation).
