# Design-doc review — Review 3: Left-sidebar structure tree as the selection surface

**Verdict: APPROVED.**

The design doc is complete against the spec, sound, and feasible against the live
`src/` code. Every spec Requirement (1–16) and Acceptance Criterion (AC1–AC13) maps to a
named decision and component, and the load-bearing technical claims were verified
first-hand. Two code-writers given this doc would build the same thing.

## What I verified against live code

- **Boundary (critical).** The SVG selection-decoration hooks `data-measure`,
  `data-hand`, `data-event-index`, `data-kind` are emitted **unconditionally** in
  `renderMeasure`/`renderNote`/`renderRest` (`src/notation/svg.js:571,764–766,911–913`),
  while the editor-only hit-rect is gated solely on the `interactive` flag
  (`svg.js:771–772,918–919`), which defaults to `false` (`svg.js:284`). So dropping
  `interactive: true` at the single `renderInto` call site (`SongCanvas.js:276`) makes the
  editor SVG byte-identical to the front end, leaves `svg.js` byte-stable, and does **not**
  touch the highlight path. The minimal-revert claim (Decision 6) is correct. `render.php`
  remains untouched (it only escapes `<` and emits the raw song verbatim; it never reads
  `name`).
- **Selection reuse.** `decorateSelection` (`SongCanvas.js:180–229`) branches purely on
  `selection.kind` over `(container, selection, song)` with no dependency on the producer;
  `resolveSelection` (`selection.js:116–171`) is kind-tagged and re-resolves each render,
  dropping a stale selection to `null`. A tree click calling the same `setSelection` lights
  the canvas and the kind-gated panels identically. Confirmed.
- **Click-to-select removal (AC3).** `selectionFromTarget` (`SongCanvas.js:102–130`), the
  native click/keydown listeners + `activateRef`/`onSelect` plumbing (`:319–359`), and
  `makeEventsFocusable` (`:140–148`, called `:281`) are exactly the machinery to remove;
  `edit.js` passes `onSelect={setSelection}` to the canvas (`edit.js:297`) and removing it
  is self-contained.
- **Operations + conformance.** The four lifted mutators
  (`onAddNote`/`onAddSection`/`onRemoveSection`/`onAddMeasure`/`onRemoveMeasure`) all route
  through `commit` → `commitSong` (`edit.js:158`). `NotePanel.removeEvent` drops the hand
  key when the list empties via destructuring rest (`NotePanel.js:129–144`) — the exact
  idiom `onRemoveNote` mirrors. `insertAt`/`removeAt`/`replaceAt` + the `newSection`/
  `newMeasure`/`newNote`/`newSong` factories exist (`songModel.js:139–241`), so
  `duplicateAt(list, i) = insertAt(list, i + 1, structuredClone(list[i]))` slots in cleanly;
  AC11 holds for free via the single `commitSong` choke point.
- **Schema (additive `name`).** `language: { enum: [...] }` is the optional/permissive
  precedent (`schema.js:44`); `$defs.section` (`:63–76`, `required: ["measures"]`) and
  `$defs.measure` (`:78–94`, no `required`) are exactly where `name: { type: "string" }`
  slots in without touching `required`. Permissive `additionalProperties` means it
  round-trips today (AC10).
- **Labels.** `emitBlock` drops a blank key via `delete next[key]` (`emit.js:21–28`);
  `emitSection`/`emitMeasure` exist in the panels; the `sprintf("Section %d")` /
  `sprintf("Measure %d")` ordinals are already built in `StructureList.js:84–88,124–128`;
  `stepInSystem(step, system)` and `inferNoteNameSystem` exist (`noteNames.js:131,96`). The
  note-label helper and `name`-or-positional fallback are accurately grounded.
- **Layout.** `&__canvas`/`&__canvas-svg` with `min-width: 280px; overflow-x: auto`
  (`style.scss:40–51`) and `.is-selected`/`.is-active-measure`/`.is-active-section`
  (`:55–71`) all exist as described; the `min-width: 0` flex-shrink reasoning is correct and
  consistent with the existing horizontal-scroll behavior.

## Acknowledged risks are honest, not gaps

- **R-1 (`__experimentalTreeGrid` not introspectable here).** `node_modules` is not
  installed in this worktree, so the TreeGrid export/props/a11y contract is verified against
  Gutenberg `trunk`, not the installed build. The doc flags this explicitly, notes
  `__experimental*` WP APIs are already a precedent in this codebase
  (`__experimentalToolsPanel`/`__experimentalNumberControl` across the panels), and supplies
  a fully-specified `@wordpress/*`-only fallback (disclosure + list semantics, with the
  W3C-grounded rule never to claim a bare `role="tree"`). This is an appropriately-managed
  risk with a real escape hatch, not a feasibility hole.
- **R-2/R-3 (test fallout).** Hit-rect / canvas-selection / StructureList test replacement
  is correctly tracked for the plan, not treated as a design blocker.

## Minor, non-blocking observations (no change required to pass)

1. **Stale test path.** The doc (Components → Removed) and research cite the StructureList
   test at `src/editor/inspector/__tests__/StructureList.test.js`; it actually lives at
   `src/editor/__tests__/StructureList.test.js`. Cosmetic — the plan will find and delete it
   regardless; the decision (remove StructureList + its test) is sound. Worth a one-word fix
   if the doc is touched again, but not a rejection reason.
2. **C4/C5 octave ambiguity is correctly deferred, not hidden.** Omitting octave from note
   labels means two notes an octave apart render identically ("C"/"do"), and a C4+C5 chord
   shows "C C". The doc and research both acknowledge this, note it is disambiguated on
   selection (canvas highlight + `NotePanel` pitch editors), and classify it as future polish
   within AC8's letter ("labeled by its pitch name"). This is an acceptable, explicitly-owned
   deferral, not a correctness gap.

## Rationale

Review 3's pivot — replacing canvas click-to-select with a left structure tree as the sole
selection surface — is feasible with `@wordpress/*`-only primitives and reuses the existing
selection/decoration/commit substrate rather than reimplementing it. The single format
change is the additive, permissive `name`, and the boundary is preserved: with the minimal
`interactive` revert the editor SVG is byte-identical to the front end, `svg.js` stays
byte-stable, and `render.php` is untouched (it ignores `name`). All structural ops route
through the `commitSong` conformance guard, so conformant-by-construction holds for every
surface. The TreeGrid choice carries a documented API-pinning risk with a concrete,
WP-only fallback. Spec coverage is complete and the out-of-scope boundary is respected. The
only defects found are a stale test-file path and an explicitly-deferred octave-label
ambiguity — neither is load-bearing. Approved.
