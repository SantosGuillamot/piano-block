# Design Doc: Remove measure numbers from the notation

_Issue #25 — https://github.com/SantosGuillamot/piano-block/issues/25_

## Overview

The Piano block renders a piece as grand-staff sheet music (treble + bass) in
exactly one place: client-side, on the front end, when the block's stored song is
turned into an SVG score in the browser. When a piece is long enough to wrap onto
multiple lines (systems), every line after the first prints a small
measure-number label above-left of its first measure (e.g. a "3" at the start of
line 2, a "5" at the start of line 3). The first line begins at measure 1 and is
left un-numbered. The maintainer wants these line-start labels gone because they
add visual clutter.

The chosen approach is a localized, unconditional removal of the measure-number
feature along its single producer/consumer path. The label is computed by one
function in the layout model (`buildSystemTexts`) and drawn by one function in the
SVG renderer (`renderSystemTexts`); a third site reserves vertical room for it in
the top margin (`topMarginLayout`); and a shared size constant
(`MEASURE_NUMBER_SIZE`) feeds the two. We delete the label's computation, its
draw, its reserved space, and the now-orphaned constant — leaving the internal
per-measure index (which feeds the `data-measure` attribute, not the visible
label) and every other above-staff element untouched. No setting, attribute, or
mode is involved; the block exposes only the `song` attribute and gains no toggle.

## Approach

The notation is produced by a two-stage client-side pipeline, both stages in
`src/notation/`:

1. **Layout stage (`layout.js`)** — `buildLayoutModel(song, width)` turns the
   stored song into a positioned, geometry-only model: systems (wrapped lines),
   each with positioned measures and a `texts` object holding above-staff
   primitives (`tempos`, `measureNumber`, `ottavas`). Per-system vertical spacing
   above the staff is decided here by `topMarginLayout`.
2. **Render stage (`svg.js`)** — `renderSvg(model)` walks that model and emits SVG
   nodes. `renderSystemTexts(system.texts)` is the consumer that turns each
   system's `texts` into `<text>`/`<g>` nodes, including the measure-number text
   node.

The measure-number label is the only feature that exists end-to-end across both
stages purely to draw those line-start numbers. Removing it means cutting it from
the model (so the field is never produced), from the renderer (so no node is ever
emitted), and from the top-margin reservation (so no whitespace is left behind),
then deleting the size constant that only those sites used.

The mental model for the implementer: this is a clean excision of one
well-contained feature, not a behavior change to the surrounding layout. Three
invariants frame every edit:

- **The internal sequential measure index is load-bearing for an unrelated
  feature** (the `data-measure` SVG attribute) and must remain exactly as-is.
- **The top-margin math must not get smaller in a way that clips real content.**
  The measure number contributed a fixed `MEASURE_NUMBER_SIZE + 1 = 3.2` units to
  the reserved zone; removing that term is provably safe because that term could
  never raise the final `topMargin` above its floor (`SYSTEM_TOP_MARGIN = 5`) on
  its own, and when other above-staff content was present that content — not the
  number — was already binding.
- **No production code is written for new behavior.** This is removal plus a
  one-for-two test swap.

## Components

All affected components live in `src/notation/`.

### Modified

- **`layout.js` — `buildSystemTexts(members, measureModels, band)`** (the
  producer). Today it computes a `measureNumber` primitive (`null` for a system
  that opens on measure 1, otherwise `{ text, x, y }`) and returns it alongside
  `tempos` and `ottavas`. After the change it computes and returns only `tempos`
  and `ottavas`. Its JSDoc return type and header prose, which document the
  measure-number bullet, are trimmed to match.

- **`layout.js` — `topMarginLayout(members, ledgerTop, aboveRHCount)`** (the
  spacing authority). Today it sets `showsMeasureNumber = members[0]?.number !== 1`
  and folds `MEASURE_NUMBER_SIZE + 1` into the reserved `innerZone` for numbered
  systems. After the change `innerZone` is simply `ledgerTop`; the
  `showsMeasureNumber` line and the now one-argument `Math.max` wrapper are gone,
  and the explanatory comment is rewritten to stop describing number reservation.
  The downstream lane stacking (above-RH annotations, ottava, tempo) is unchanged.

- **`svg.js` — `renderSystemTexts(texts)`** (the consumer). Today it emits a
  `<text data-text="measure-number" font-size=MEASURE_NUMBER_SIZE>` node when
  `texts.measureNumber` is truthy. After the change that block is deleted; it still
  renders tempos and ottavas. Its lead comment is trimmed to drop the measure-number
  mention.

- **`constants.js` — `MEASURE_NUMBER_SIZE`**. Defined at line 180 with a doc
  comment, imported by `layout.js` and `svg.js`. After the producer, consumer, and
  reservation edits, both uses vanish, so the constant, its doc comment, and both
  import lines are deleted.

- **`__tests__/layout.test.js`** — the single test asserting the old behavior
  ("measure 1 is not numbered; a later system numbers its first measure") is
  replaced with a model-level absence test (details under Interfaces / Key
  Decisions).

- **`__tests__/svg.test.js`** — gains one new DOM-level absence test asserting no
  `measure-number` node is emitted for a wrapping song.

### Untouched but relevant (explicit non-edits)

- **Internal sequential measure index** — `layout.js:1729-1748` assigns each
  flattened measure a 1..N `number`, propagated to `measureModel.number` and then
  to the SVG `data-measure` attribute (`svg.js:519`). This is distinct from the
  visible label and must stay (R5 / AC5). Verified: ottava logic keys off
  `octaveShift` and tempo logic off tempo diffs, never off `.number`, so the
  counter is retained solely because it feeds `data-measure`.

- **Tempo and ottava logic** — both inside `buildSystemTexts` and their renderers.
  They share the above-staff space but are computed and placed independently of the
  measure number (R3 / AC3).

- **The `song` attribute, song schema, and editor input UI** — out of scope; the
  removal is purely a rendering-output change.

## Interfaces and Data Flow

### Affected model interface (internal)

`buildSystemTexts` returns the per-system `texts` object consumed by
`renderSystemTexts`. The shape narrows by exactly one field:

```text
before:  { tempos: object[], measureNumber: object | null, ottavas: object[] }
after:   { tempos: object[],                                ottavas: object[] }
```

This is internal model output, not a public API. A full `src/` consumer audit
found `system.texts.measureNumber` read in exactly two places: the renderer guard
(deleted) and the one test being replaced. Every other `.texts` access reads only
`tempos`/`ottavas`, so the field changing from `null`/object to absent
(`undefined`) breaks no real reader.

### Data flow (unchanged shape, one branch removed)

```text
song (block attribute)
  └─ buildLayoutModel(song, width)            [layout.js]
       ├─ flatten measures → assign 1..N `number`   ← KEPT (feeds data-measure)
       └─ per system: buildSystemTexts(...)
            ├─ tempos    ← KEPT
            ├─ ottavas   ← KEPT
            └─ measureNumber ← REMOVED (no longer computed or returned)
       └─ per system: topMarginLayout(...)
            └─ innerZone = ledgerTop          ← number term REMOVED
  └─ renderSvg(model)                         [svg.js]
       └─ per system: renderSystemTexts(texts)
            ├─ renderTempo(...) per tempo     ← KEPT
            ├─ measure-number <text> node     ← REMOVED (never emitted)
            └─ renderOttava(...) per ottava   ← KEPT
       └─ per measure: <g data-measure=number>← KEPT (internal index intact)
```

### Public/observable interface

The block's only public attribute (`song`) is unchanged. The only observable
change in the emitted SVG is that no node with `data-text="measure-number"` is
ever produced, for any song and any number of systems. No other `data-text`
node (`tempo`, `ottava`, `annotation`) and no `data-measure` attribute changes.

## Key Decisions

### Decision: Remove the `measureNumber` model field entirely (rather than keep it always-null)

- **Choice:** Delete the `measureNumber` computation in `buildSystemTexts` and drop
  it from the returned object, rather than keeping the field and forcing it to
  `null`. Trim the matching JSDoc return type and the "Measure number" prose bullet
  in the function header so no documentation-level dead reference lingers.
- **Alternatives:** Keep the field but assign `null` unconditionally. Smaller diff
  and preserves the exact object shape.
- **Trade-offs:** Keeping a permanently-`null` field plus its unreachable renderer
  guard is precisely the dead code AC6 warns against, and it leaves stale JSDoc.
  Full removal yields a clean end state at the cost that a hypothetical reader doing
  `texts.measureNumber` now sees `undefined` instead of `null` — but the audit
  showed no such real reader exists.
- **Traces to:** Requirement 1 (renderer has no measure-number code path at all),
  Acceptance criterion AC6 (no dead code, including dead JSDoc/prose).

### Decision: Collapse the top-margin reservation to `innerZone = ledgerTop`

- **Choice:** In `topMarginLayout`, delete the `showsMeasureNumber` line and reduce
  `innerZone = Math.max(ledgerTop, showsMeasureNumber ? MEASURE_NUMBER_SIZE + 1 : 0)`
  to `const innerZone = ledgerTop;` (dropping the now one-argument `Math.max`), and
  rewrite the explanatory comment to stop describing number reservation.
- **Alternatives:** Leave the `Math.max` and the comment in place after removing
  only the number term. This would leave a vestigial one-argument `Math.max` and a
  comment describing a feature that no longer exists.
- **Trade-offs:** The collapse is provably non-clipping. The number term added a
  fixed `MEASURE_NUMBER_SIZE + 1 = 3.2`. It could only bind `innerZone` when
  `ledgerTop < 3.2`; in that regime `topExtent ≤ 3.2` and
  `topMargin = max(SYSTEM_TOP_MARGIN = 5, topExtent + ABOVE_STAFF_PAD = 1) = 5`,
  pinned to the floor regardless of the number — so removal is pixel-identical
  there. When ledger/ottava/tempo content already exceeded 3.2, that content was
  binding and removal changes nothing. The single visible change is the intended
  one: where the number was binding **and** an above-staff lane is present, the lane
  stack drops uniformly onto `ledgerTop` (inter-lane gaps preserved, ledgers still
  cleared) — reclaiming exactly the whitespace the spec asks to remove, not a
  regression.
- **Traces to:** Requirement 4 / AC4 (top spacing no longer depends on the
  removed-number condition; the reclaim is the intended outcome), Requirement 3 /
  AC3 (no overlap or clipping — downstream lane stacking is untouched and the floor
  absorbs the no-lane case), AC6 (no vestigial `Math.max` or stale comment).

### Decision: Delete the `MEASURE_NUMBER_SIZE` constant and both imports

- **Choice:** Remove `MEASURE_NUMBER_SIZE` and its doc comment from `constants.js`,
  and the import line from each of `layout.js` and `svg.js`.
- **Alternatives:** Leave the constant exported "in case it is reused." It has no
  remaining consumer after the other edits.
- **Trade-offs:** A grep of the whole repo found exactly five references: the
  definition + doc comment, the two imports, and the two now-removed uses (the
  top-margin reservation and the label `font-size`). There is no barrel/index file
  in `src/notation/` and no `export ... from` / `export *` re-export anywhere, so
  nothing keeps the export "used" indirectly. Leaving it would be dead code.
- **Traces to:** AC6 (no unused constant lingering).

### Decision: Replace the one old test with a model-level and a DOM-level absence test

- **Choice:** Replace the obsolete behavior test in `layout.test.js` with a
  model-level assertion (the producer side) and add a new DOM-level assertion in
  `svg.test.js` (the consumer side). Each renders a song that wraps to more than
  one system and asserts the measure number is absent.
  - **Model test** (`layout.test.js`, replacing the old assertions): reuse the
    in-file `COMPREHENSIVE_SONG` at a narrow width (the existing wrapping idiom,
    width 30); assert `model.systems.length > 1` (so the next assertion is not
    vacuous), then `model.systems.every(s => s.texts.measureNumber === undefined)`,
    and that `systems[0].texts` still carries `tempos`/`ottavas` arrays (proving the
    texts object is otherwise intact).
  - **DOM test** (`svg.test.js`, new): render `renderSvg(buildLayoutModel(song, 30))`
    for a wrapping song; assert the model wrapped (`systems.length > 1`) and
    `svg.querySelectorAll('[data-text="measure-number"]').length === 0` (the exact
    analog of the established `[data-text="annotation"]` query idiom).
- **Alternatives:** A single model-level test, or a single DOM-level test. One
  layer alone leaves a gap: the model test cannot catch a renderer regression that
  re-emits the node, and the DOM test cannot pinpoint a producer regression. Both
  map to AC1.
- **Trade-offs:** Two small tests instead of one, in exchange for guarding both
  halves of the producer/consumer split being edited. Prefer `=== undefined` over
  `!('measureNumber' in texts)`: it reads better and is robust to unrelated key
  additions while still catching a real re-add.
- **Traces to:** AC1 (no measure-number text node emitted for any system in a
  wrapping song, asserted at both model and DOM layers with a wrap-guard so coverage
  is non-vacuous), Requirement 3 (texts object still carries tempos/ottavas), AC6
  (replaces the now-invalid old test so the suite builds and lints clean).

### Coverage of the remaining acceptance criteria

- **AC2 (single-line song emits no label).** A single-system score never carried a
  measure number (the head measure is measure 1, which was already un-numbered), and
  the removal touches no other above-staff element. The producer/consumer edits do
  not add, remove, or shift tempos or ottavas, so a one-system render is unaffected
  apart from the (already-absent) label.
- **AC5 (internal measure index intact).** The 1..N `number` assignment and its
  propagation to `data-measure` are explicit non-edits; only the visible label path
  is cut.

## Dependencies

- **Internal:** `src/notation/layout.js`, `src/notation/svg.js`, and
  `src/notation/constants.js` — all already coupled through the existing
  producer/consumer/constant relationship. No new internal coupling is introduced;
  one import edge (`MEASURE_NUMBER_SIZE`) is removed from two files.
- **Tests:** the existing Jest harness under `src/notation/__tests__/`.
  `svg.test.js` already imports both `buildLayoutModel` and `renderSvg`, so the
  DOM-test harness is in place.
- **External libraries / services:** none added or removed. No build-tool, schema,
  or runtime dependency changes.

## Failure Modes and Observability

This block renders client-side in the browser; it has no server component, no
logging surface, and no telemetry. "Observability" here is the rendered SVG itself
plus the test suite.

- **Failure mode — a measure-number node is somehow still emitted.** Detected by
  the new DOM test (`[data-text="measure-number"]` count must be 0) and the
  model-level test (`texts.measureNumber === undefined` for every system).
- **Failure mode — the top-margin collapse clips or overlaps real above-staff
  content.** This is the one path that changes pixels (a numbered system that also
  carries a tempo or ottava lane). Detected by an AC3-style test that renders a
  wrapping song with tempo changes and ottava brackets on later systems and confirms
  those marks remain present and correctly placed. The arithmetic argument above
  shows clipping is impossible, but the test guards against an unforeseen
  interaction.
- **Failure mode — the internal index breaks.** Would surface as wrong or missing
  `data-measure` attributes; guarded by leaving that path entirely untouched and by
  the existing `data-measure` test coverage.
- **Build/lint visibility.** A leftover unused import or constant fails lint; the
  project's build + lint step (AC6) is the detector.

## Risks and Open Questions

### Risks

- **R-1 (Low) — Reclaimed whitespace shifts a numbered system's lane stack.** Where
  the number was the binding `innerZone` term **and** an above-staff lane is present,
  the lane stack drops onto `ledgerTop`. This is the intended R4/AC4 reclaim and was
  shown non-regressing (inter-lane gaps preserved, ledgers still cleared), but it is
  the only path that changes pixels. Mitigation: the AC3-style test with tempo and
  ottava on a later system confirms marks remain present and unclipped.
- **R-2 (Low) — A new wrapping fixture fails to actually wrap.** A zero-nodes
  assertion is vacuously true on a single-system song. Mitigation, baked into both
  new tests: assert `systems.length > 1` before the absence assertion.
- **R-3 (Very low) — A future reader re-adds a `measureNumber` key.** The
  `=== undefined` model assertion (not `'measureNumber' in texts`) is robust to
  unrelated key additions and would catch an actual re-add. Accepted.

### Open question carried to the Plan phase

- **No shared wrapping-song fixture exists.** `svg.test.js`'s local `SONG` is a
  2-measure single-system song that never wraps; `COMPREHENSIVE_SONG` lives in
  `layout.test.js` and is local, not exported; there is no shared fixtures module in
  `__tests__/`. The new `svg.test.js` DOM test therefore needs its **own small
  inline multi-measure song** that wraps at a narrow width (e.g. width 30). An
  inline fixture is recommended (keeps `svg.test.js` self-contained and avoids
  coupling the two test files) rather than exporting or duplicating
  `COMPREHENSIVE_SONG`. The exact measures/width of that fixture is a mechanical
  authoring detail for the Plan phase, not a design decision.
