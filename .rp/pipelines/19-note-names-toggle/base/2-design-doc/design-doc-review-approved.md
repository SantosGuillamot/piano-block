# Design Doc Review

## Verdict: approved

## Summary

The design for the frontend note-names toggle is sound, complete, traceable, and
feasible against the real codebase. Every requirement (R1–R13) and acceptance
criterion (AC1–AC13) maps to a concrete decision and component; each Key Decision
cites the spec requirements/ACs it serves; every decision lists rejected
alternatives with trade-offs; and the load-bearing technical claims hold up under
direct verification of the source.

I verified the design's central feasibility claims against the codebase rather than
trusting the research log:

- **The `replaceChildren` wrapper-wipe bug is real and correctly handled.** `view.js`
  uses `getElement().ref` as the wrapper and `renderInto` ends in
  `container.replaceChildren(svg)` (`svg.js:278`), and the `ResizeObserver` observes
  that wrapper (`view.js:103`). The design's inner-score-`<div>` host (Decision 5 /
  D-1) is the correct fix: the SVG renders into the inner div, the SSR'd button
  survives as a sibling, and width is measured on the inner div.
- **The one-flag-site approach is feasible.** `buildLayoutModel(song, availableWidthInSp)`
  is a two-arg function (`layout.js:1747`) called by both the editor (`SongCanvas.js:117`,
  two args) and the frontend; adding a third defaulted `{ showNoteNames = false, system }`
  arg keeps the editor on the names-off path by construction (AC11). `layoutHand`
  is called twice (`layout.js:2069,2076`) with a fixed arg list — threading the option
  to both is mechanical.
- **The `stackChord` signature migration is correctly scoped.** `positions` is a
  `number[]` consumed by exactly the four sites the design names —
  `stemDirectionForChord(positions)` (`layout.js:1503`), `stackChord(positions,...)`
  (1504), the accidental loop `positions[pi]` (1509), the ledger loop and dot loop
  `for (const s of positions)` (1522, 1532), and `Math.max/min(...positions)`
  (1558–1559). The four `stackChord` unit tests that call it with number arrays are
  at `layout.test.js:285,293,303,310`, exactly as the design budgets.
- **The per-head step threading is coherent.** `pitchToStaffStep` returns the
  `sFromBottom` number (`layout.js:128–136`), so the design's `{ sFromBottom, step }`
  pair correctly draws `step` from the source `pitch.step`, not from `pitchToStaffStep`.
  The step rides `stackChord`'s sort because the sort reorders head objects.
- **The byte-identity backstops exist.** `el()` skips undefined/null attributes
  (`svg.js:86–88`); `renderNote` appends head children as siblings to the note `<g>`
  (the exact pattern the name `<text>` reuses); `renderSvg` returns the `<svg>` element
  (`svg.js:262`), so the new `outerHTML` pin test is reachable in jsdom; and there is
  no exhaustive deep-equal on whole head objects in `layout.test.js` (only
  `heads.map(h => h.sFromBottom)` at :286), so omit-key-when-off is correctly framed
  as a nice-to-have, not a correctness blocker.
- **The name vocabulary is safely extractable.** `stepInSystem`, `inferNoteNameSystem`,
  `stepsOf`, `SYSTEMS`, `CANONICAL_LETTERS`, `SPANISH_TOKENS` in
  `editor/noteNames.js` are all i18n-free and depend only on the frontend-safe
  `normalizeStep.js`; `@wordpress/i18n` is used only by `noteLabel`'s rest branch
  (line 157), which the editor keeps. `parseAndValidate` returns the parsed `data`
  unchanged (`validate.js:350`) with `language` (an optional schema enum,
  `schema.js:44`) intact, so `data.language ?? inferNoteNameSystem(data)` matches the
  editor's resolution exactly.

The hardest constraint — AC10 names-off byte-identity across both the editor canvas
and the frontend default — is funnelled through a single flag site, defaulted OFF,
with the name key omitted when off and a new `outerHTML` string-equality pin test
that compares the no-arg editor path to the explicit names-off frontend path. Failure
modes (FOUC on the gated button, invalid/empty song, stale toggle on resize,
per-instance leakage, button-wipe) each have a stated mitigation and an observability
hook. The one genuine judgment call (per-head placement vs. a reserved name lane) is
made with OPT-C and carries OPT-B as a documented, codebase-grounded fallback.

The only internal nuance I noted — whether `hasNameableNotes` is computed in `init`
or in the watch's draw, given the draw now builds the model — is an
implementation-level detail confined to one function that the design already gestures
at (init builds once to seed the flag; the watch owns subsequent redraws). It does
not create ambiguity that would lead two implementers to build different things, and
it does not affect any AC. It is a note for the code plan, not a design defect.

Approved.
