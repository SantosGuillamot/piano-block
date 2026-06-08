# Spec Research: Review 3 — Left-sidebar structure tree as the selection surface

# Review 3: A left-sidebar structure tree (Section → Measure → Note) as the selection surface

_Review 3 of the Piano block editor-UI feature (Issue #8, PR #22). Self-contained; later phases work from this prompt + the current code on the branch, not from base/review-1/review-2._

## Goal (from prompt)

Add a left-of-canvas **structure tree** (Section → Measure → Note), Gutenberg List-View-style: expand/collapse sections & measures; add/remove/duplicate at each level; select a node in the tree (not the canvas); selecting highlights the matching staff element (canvas = display + highlight only) and opens its settings for editing. `@wordpress/*` only; editor-side; front-end render unchanged.

## Q&A

### Q1 — Remove canvas click-to-select and review-2's right-sidebar StructureList?

The left tree becomes the selection surface. (a) Remove canvas click-to-select (the hit-rect) so the canvas is display + highlight only, or keep it as a secondary path? (b) Remove review-2's right-sidebar StructureList (sections→measures), now superseded by the deeper left tree, or keep both? Lean: remove both.

**A:** Remove both. Canvas = display + highlight only; the left tree is the single structure/selection surface; the right inspector keeps its settings panels but loses the StructureList.

### Q2 — Settings location + left-panel presence

(a) When a tree node is selected, its settings appear in the existing right inspector (block settings sidebar) — left tree selects, right inspector configures. Correct? (b) Is the left panel always-visible beside the canvas, or toggleable (Gutenberg List-View style button)?

**A:** (a) Correct — left tree selects, right inspector configures. (b) Toggleable. Clarification: the left sidebar is at the BLOCK level, close to the canvas (within the block's own editor area), NOT the editor's global block-list view location.

### Q3 — Two-hands structure in the tree + node labels

Each measure has a right-hand and left-hand event list. (a) Under a measure: two groups ("Right hand"/"Left hand") each listing notes, or one flat note list with each note labeled by hand? (b) Labels: sections/measures as "Section 1"/"Measure 1"? Notes as a musical label ("C4 quarter" / "Rest (quarter)") or "Note 1"?

**A:** (a) Two groups, one per hand (Right hand / Left hand), each listing its notes → tree is Section → Measure → {Right hand, Left hand} → Note. (b) Sections and measures should have **editable labels** (nice to be able to rename them). Notes: the note name (do/re/mi…) is enough for now.

### Q4 — Editable section/measure labels: persist (schema add) or defer?

Renaming sections/measures persistently needs a stored optional `name` (a small schema addition, like `language` in review-2). (a) Include editable persisted labels now (accept the schema add), or defer and label positionally ("Section 1"/"Measure 1") for now? (b) Confirm a note's tree label is its pitch name (chord shows its pitches), and a rest shows "rest".

**A:** (a) Include them — add a new optional `name` property to the JSON (schema addition) for sections and measures. (b) Yes — note label = pitch name (chord = its pitches), rest = "rest".

### Q5 — Operations (add/remove/duplicate) at each level + reordering

(a) Do add/remove/duplicate apply at all levels — sections, measures, AND notes? (b) Duplicate = deep copy inserted right after the original (section copies its measures/notes; measure copies both hands)? (c) Reordering (drag up/down like List View) in scope, or keep out as prior reviews did?

**A:** (a) All levels (sections, measures, notes). (b) Duplicate = deep copy after the original — confirmed. (c) Reordering is deferred to a follow-up (out of scope for review-3).

### Q6 — Carry-overs + schema boundary

Confirm: note-language selector, raw-JSON toggle, conformant-by-construction, progressive disclosure, WP-only deps all still hold; right inspector keeps Song/Note/Measure/Section panels (Section & Measure gain a Name field); schema relaxed only to add optional `name` on sections+measures (additive/permissive/round-trips), render.php + front-end SVG unchanged (front end ignores `name`); canvas reuses existing highlight/decoration, no canvas click-to-select.

**A:** Confirmed.

## Out of Scope

Confirmed with owner:

1. Canvas click-to-select — removed (canvas is display + highlight only). The review-2 `interactive` hit-rect in svg.js becomes dead and may be removed (restoring svg.js to untouched).
2. Reordering sections/measures/notes — deferred to a follow-up.
3. Front-end consuming `name` or `language` / showing them on the published page — future work.
4. Changing `render.php` or the front-end SVG rendering — unchanged (schema gains `name`, front end ignores it).
5. Audio playback — future.
6. Best-effort loading of invalid songs (still routed to raw JSON) and large-song performance tuning — carried over.

## Consolidated Requirements

1. **Left structure tree.** A toggleable panel on the LEFT of the canvas, rendered within the block's own editor area (not the editor's global List View), shows the song hierarchy: **Section → Measure → {Right hand, Left hand} → Note**. Sections and measures expand/collapse. (Q1, Q2, Q3)
2. **Tree is the selection surface.** Selecting a section, measure, or note in the tree sets the editor selection. Canvas **click-to-select is removed**; the canvas is display + highlight only. (Q1)
3. **Canvas highlight on selection.** Selecting a node highlights the corresponding section/measure/note on the canvas (reusing the existing decoration); the canvas updates live. (Q1, Q6)
4. **Settings in the right inspector.** When a node is selected, its settings appear in the existing right inspector — Song / Note / Measure / Section panels; left tree selects, right inspector configures. (Q2)
5. **Add / remove / duplicate at every level** — sections, measures, and notes (notes added under a hand group). **Duplicate = deep copy inserted right after the original** (a section copies its measures/notes; a measure copies both hands). Reordering is out of scope. (Q5)
6. **Editable persisted labels.** Sections and measures have an editable **`name`** stored in the song (a new optional schema property). The tree shows the name (falling back to a positional label when unset). Notes are labeled by **pitch name** (a chord shows its pitches); a rest shows "rest". (Q3, Q4)
7. **Schema boundary — relaxed only for `name`.** The schema gains optional `name` on sections and measures (additive, permissive, round-trips through raw JSON, never blocks saving). **`render.php` and the front-end SVG rendering are unchanged** (the front end ignores `name`). (Q4, Q6)
8. **Right-sidebar StructureList removed.** Review-2's right-inspector sections→measures list is superseded by the left tree and removed. (Q1)
9. **Carry-overs:** the note-language selector; raw-JSON editing behind the toolbar toggle (non-blocking); conformant-by-construction; progressive disclosure; live canvas re-render; `@wordpress/*`-only deps; everything else review-2 shipped that isn't changed here. (Q6)

## Research

- **Current selection model (review-2):** `src/edit.js` holds kind-tagged `selection` (`section|measure|event`); `src/editor/SongCanvas.js` does canvas click hit-testing (`selectionFromTarget`, the editor-only `interactive` hit-rect) AND decorates the selection on the canvas (`decorateSelection` → `is-selected` / `is-active-measure` / `is-active-section`, with `scrollIntoView`). The right inspector (`InspectorControls`) renders `SongPanel` (incl. the note-language selector) + an always-present right-sidebar `StructureList` (sections → measures, add/remove/select) + the kind-gated `NotePanel`/`MeasurePanel`/`SectionPanel`. `src/editor/selection.js` provides `resolveSelection`, `measureCoords`, `measureNumbersForSection`.
- **Implication for review-3:** the canvas highlight/decoration machinery (`decorateSelection`) is reusable as-is (tree selection → same canvas highlight). What changes is the *selection source*: a new LEFT tree replaces canvas click-to-select; review-2's right-sidebar `StructureList` (measure depth) is likely superseded by the deeper left tree (Section→Measure→Note).
- **Two-hands structure:** each measure has `rightHand[]` and `leftHand[]` event lists. A Section→Measure→Note tree must place notes under a measure across the two hands (e.g. group by hand, or label each note with its hand). This is a structural question for the spec.
- **Editor layout:** `src/edit.js` renders the canvas (block content) + `InspectorControls` (right sidebar). A LEFT panel beside the canvas is new editor layout inside the block's edit area (the right `InspectorControls` is WP's block settings sidebar; a left structure panel would live within the block's own rendered editor area).

## Out of Scope

## Consolidated Requirements
