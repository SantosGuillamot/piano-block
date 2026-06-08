# Code Plan: Remove measure numbers from the notation

## Overview

The Piano block renders a piece as grand-staff sheet music in exactly one
client-side path: `buildLayoutModel(song, width)` in
`src/notation/layout.js` produces a geometry-only model, and `renderSvg(model)`
in `src/notation/svg.js` emits the SVG. Today, every wrapped line (system) after
the first prints a small measure-number label above-left of its first measure.
This feature removes that label entirely along its single
producer → consumer → reservation → constant path: the producer
(`buildSystemTexts` in `layout.js`) stops computing/returning the `measureNumber`
field; the spacing authority (`topMarginLayout` in `layout.js`) stops reserving
room for it; the consumer (`renderSystemTexts` in `svg.js`) stops emitting the
node; and the now-orphaned `MEASURE_NUMBER_SIZE` constant plus its two imports are
deleted. The internal sequential per-measure index (which feeds the
`data-measure` SVG attribute) and every other above-staff element (tempo marks,
ottava brackets, high notes/ledgers) are left untouched.

The work is ordered so that the production-code excision (Tasks 1–4) lands first
along the data-flow direction (producer → spacing → consumer → constant), then the
three remaining measure-number-referencing comments that live *outside* every
edited function — and would otherwise be left describing an output the model no
longer produces — are scrubbed (Task 5); then the test suite is brought into its
committed three-test guard state (Tasks 6–7), and a final build/lint/test
verification closes out AC6 (Task 8). This is a pure removal plus a one-for-two
test swap; no new production behavior is written.

### Codebase facts pinned for this plan

- `src/notation/constants.js:179-180` — doc comment + `export const MEASURE_NUMBER_SIZE = 2.2;`.
- `src/notation/layout.js:49` — `MEASURE_NUMBER_SIZE` named import.
- `src/notation/layout.js:1411-1420` — the `buildLayoutModel` block-header comment;
  its texts list at `:1417` reads
  "…+ texts (dynamics, notes, tempo, measure numbers, ottava)." (stale after removal).
- `src/notation/layout.js:1706-1720` — the `buildLayoutModel` JSDoc; its texts list at
  `:1712` reads "…and the texts (tempo, measure number, dynamics, notes, ottava)."
  (stale after removal).
- `src/notation/layout.js:2135` — the call-site comment directly above
  `const texts = buildSystemTexts(...)`: "// ── System-level texts: tempo + measure
  number + ottava. ──" (stale after removal).
- `src/notation/layout.js:1726-1728` — the flatten block-comment that mentions "a
  sequential 1..N measure number"; this describes the KEPT internal index counter
  (`let measureNumber = 0;` at `:1730`, incremented at `:1738`, assigned to
  `number:` at `:1745`). **KEEP — do not edit (R5/AC5).**
- `src/notation/layout.js:1729-1748` — the sequential 1..N `number` assignment, driven
  by the `measureNumber` counter (KEEP; feeds `data-measure`).
- `src/notation/layout.js:2865-2910` — `topMarginLayout(members, ledgerTop, aboveRHCount)`; the number reservation is at `:2869-2878` (`showsMeasureNumber` + `Math.max` `innerZone`).
- `src/notation/layout.js:2912-3031` — `buildSystemTexts(members, measureModels, band)`; JSDoc at `:2912-2929`, `measureNumber` computation at `:2954-2964`, return at `:3030`.
- `src/notation/svg.js:35` — `MEASURE_NUMBER_SIZE` named import.
- `src/notation/svg.js:1089-1122` — `renderSystemTexts(texts)`; lead comment at `:1089-1093`, measure-number emit block at `:1104-1115`.
- `src/notation/svg.js:519` — `data-measure` attribute write (KEEP).
- `src/notation/__tests__/layout.test.js:2218-2230` — old behavior test ("measure 1 is not numbered; a later system numbers its first measure"), reads `texts.measureNumber` at `:2222` and `:2226`. This is the test being replaced.
- `src/notation/__tests__/layout.test.js:2059-2079` ("tempo, ottava, and note lanes stack above the staff") and `:2081-2115` ("the top margin flexes…") — existing first-system (`systems[0]`) lane/top-margin tests. **Do NOT modify**; they are the named AC2 guard.
- `src/notation/__tests__/layout.test.js:931-1034` — `COMPREHENSIVE_SONG` fixture (3 measures, local to this file).
- `src/notation/__tests__/svg.test.js:18-65` — local `SONG` (2-measure, single-system, never wraps); `:67` `modelFor` helper. The established DOM query idiom is `svg.querySelector('[data-text="annotation"]')` / `querySelectorAll(...)` (e.g. `:136`, `:146`).

### Fixture decision resolved during planning (was an Open Question in the design)

The design's open question — whether `COMPREHENSIVE_SONG` already carries both a
tempo and an above-ottava on a system *after the first* — was resolved
empirically during planning by rendering `buildLayoutModel(COMPREHENSIVE_SONG, 30)`:

- It wraps to **3 systems**.
- `systems[0]` opens on measure 1 (never numbered), tempos=1, ottavaAbove=0.
- `systems[2]` opens on measure 3 (`head.number === 3`, i.e. **formerly numbered**),
  with **tempos=1 and ottavaAbove=1**.

So **`COMPREHENSIVE_SONG` at width 30 satisfies the later-system lane-placement
requirement** and is reused directly in Task 7's `layout.test.js` test — no new
inline fixture is needed there. The `svg.test.js` DOM absence test (Task 6) DOES
need its own small inline wrapping fixture, because the file's local `SONG` is a
2-measure single-system song that never wraps.

## Tasks

### Task 1: Remove the `measureNumber` producer in `buildSystemTexts`

- **Goal:** Stop the layout producer from computing or returning the
  `measureNumber` model field, and trim its now-stale JSDoc/header prose, so the
  per-system `texts` object narrows to `{ tempos, ottavas }`.
- **Files to change:** `src/notation/layout.js`.
- **Changes:**
  - Delete the `measureNumber` computation block at `:2954-2964` (the
    `const measureNumber = head.number === 1 ? null : { text, x, y }` expression,
    including its two leading comment lines about measure 1 being un-numbered).
  - Delete the `const head = members[0];` binding at `:2931`. After the
    `measureNumber` block is removed, `head` has zero consumers: in the live
    function its only references are `head.number === 1` (`:2957`) and
    `String(head.number)` (`:2960`), both inside the deleted block; the `tempos`
    loop (`:2936`) and the `ottavas` loop (`:3009`) iterate `members.forEach(...)`
    and never read `head`. Removing the block without removing this binding leaves
    an unused variable (dead code AC6 forbids).
  - Change the return statement at `:3030` from
    `return { tempos, measureNumber, ottavas };` to
    `return { tempos, ottavas };`.
  - In the function's JSDoc/header (`:2912-2929`): drop the "+ the measure number"
    phrasing from the summary line, remove the "**Measure number** sits above-left…"
    bullet (`:2919-2920`), and update the `@return` type at `:2928` from
    `{{ tempos: object[], measureNumber: object, ottavas: object[] }}` to
    `{{ tempos: object[], ottavas: object[] }}`.
  - Leave the `tempos` and `ottavas` computations (both iterate `members.forEach`,
    not `head`) exactly as-is.
- **Depends on:** none.
- **Traces to:** Spec R1 (renderer has no measure-number value to draw), R5/AC5
  (only the visible-label path is cut — index untouched), AC6 (no dead JSDoc/prose);
  Design "Modified: `layout.js — buildSystemTexts`" and Key Decision "Remove the
  `measureNumber` model field entirely".
- **Acceptance:**
  - `buildSystemTexts(...)` returns an object whose own enumerable keys are exactly
    `tempos` and `ottavas`; it no longer has a `measureNumber` key.
  - For any song and any width, `buildLayoutModel(song, width).systems[i].texts.measureNumber`
    is `undefined` for every system (including the head system that opened on
    measure 1 and the later systems that formerly carried a label).
  - `systems[i].texts.tempos` and `systems[i].texts.ottavas` are still arrays with
    the same contents as before this change (tempo and ottava computation unchanged).
  - The function's JSDoc no longer mentions a measure number, and its `@return`
    type lists only `tempos` and `ottavas`.
  - `buildSystemTexts` leaves no variable unused by the removal: in particular the
    `const head = members[0];` binding — whose only consumers were the deleted
    measure-number computation (`head.number === 1`, `String(head.number)`) — is
    gone, and no other reference to `head` remains in the function. (This must be
    verified by reading the code, not by the lint gate: Biome flags
    `noUnusedVariables` only at WARNING severity under `recommended: true`, so
    `npm run lint` exits 0 even if the binding were left behind; Task 8's gate would
    NOT catch it.)

### Task 2: Collapse the top-margin number reservation in `topMarginLayout`

- **Goal:** Remove the measure-number term from the reserved above-staff zone so
  a line's top spacing no longer depends on the removed-number condition, leaving
  no empty band where the number used to be.
- **Files to change:** `src/notation/layout.js`.
- **Changes:**
  - Delete the `showsMeasureNumber` line at `:2874`
    (`const showsMeasureNumber = members[0]?.number !== 1;`).
  - Replace the `innerZone` `Math.max` at `:2875-2878`
    (`const innerZone = Math.max(ledgerTop, showsMeasureNumber ? MEASURE_NUMBER_SIZE + 1 : 0);`)
    with `const innerZone = ledgerTop;`.
  - Rewrite the explanatory comment at `:2869-2873` so it no longer describes
    measure-number reservation; it should describe only that `innerZone` holds the
    high-note/ledger extent that the stacked text lanes must clear.
  - Leave the downstream lane stacking (`aboveRHCount`, ottava, tempo blocks at
    `:2879-2909`) and the `topMargin = Math.max(SYSTEM_TOP_MARGIN, …)` floor at
    `:2902` exactly as-is.
- **Depends on:** none (independent edit, but logically follows Task 1; may be done
  in any order relative to Task 1).
- **Traces to:** Spec R4/AC4 (top spacing no longer depends on the removed-number
  condition; the reclaimed whitespace is the intended outcome), R3/AC3 (downstream
  lane stacking untouched; floor absorbs the no-lane case), AC6 (no vestigial
  one-argument `Math.max`, no stale comment); Design Key Decision "Collapse the
  top-margin reservation to `innerZone = ledgerTop`".
- **Acceptance:**
  - `topMarginLayout` contains no reference to `showsMeasureNumber`,
    `MEASURE_NUMBER_SIZE`, or a measure-number condition; `innerZone` equals
    `ledgerTop` unconditionally.
  - For a system whose head measure is measure 1 (e.g. `systems[0]` of any song),
    the computed `topMargin` and all lane baselines (`tempoLaneY`,
    `ottavaAboveLaneY`, `annotationAboveRHLaneY`) are pixel-identical to the
    pre-change values (this system never reserved number room, so nothing moves).
  - For a wrapping song's later, formerly-numbered system that also carries an
    above-staff lane, the lane stack still clears the ledger zone and inter-lane
    gaps are preserved — no overlap, clipping, or off-lane shift is introduced (the
    one path that legitimately reclaims whitespace by dropping the lane stack onto
    `ledgerTop`).
  - The comment above `innerZone` no longer claims room is reserved for a measure
    number.

### Task 3: Remove the measure-number emit block in `renderSystemTexts`

- **Goal:** Stop the SVG consumer from ever emitting a measure-number text node,
  for any system, and trim the stale lead comment.
- **Files to change:** `src/notation/svg.js`.
- **Changes:**
  - Delete the entire `if (texts.measureNumber) { … }` block at `:1104-1115`,
    including the `el("text", { … "data-text": "measure-number" … })` creation and
    its `g.appendChild(setText(node, mn.text))`.
  - In the function's lead comment (`:1089-1093`), remove BOTH measure-number
    mentions — the one at `:1091` (`"…, the measure number, and the ottava
    brackets."`) and the one at `:1092` (`"Tempo + measure number + ottava labels
    are plain font text…"`) — so the comment describes only the tempo marks and
    ottava brackets it still emits.
  - Leave the tempo loop (`:1100-1102`), the ottava loop (`:1117-1119`), the
    `if (!texts) return g;` guard, and the `<g data-system-texts>` wrapper exactly
    as-is.
- **Depends on:** Task 1 (the field this block read is no longer produced; the block
  is unreachable and must be removed for a clean end state).
- **Traces to:** Spec R1/R2 (no measure-number node is ever emitted, unconditionally,
  everywhere the notation renders), AC1 (DOM side), AC6 (no unreachable dead code);
  Design "Modified: `svg.js — renderSystemTexts`".
- **Acceptance:**
  - `renderSystemTexts` no longer references `texts.measureNumber` or the
    `"measure-number"` `data-text` value.
  - For any model, the SVG returned by `renderSvg(model)` contains zero elements
    matching `[data-text="measure-number"]`, for both single-system and
    multi-system songs.
  - Tempo nodes (`[data-text="tempo"]`) and ottava nodes (`[data-text="ottava"]`)
    are still emitted exactly as before for the same input.
  - The function's lead comment no longer mentions a measure number.

### Task 4: Delete the orphaned `MEASURE_NUMBER_SIZE` constant and its two imports

- **Goal:** Remove the now-unused size constant and the two import lines that
  referenced it, leaving no dead export and no unused import (lint-clean).
- **Files to change:** `src/notation/constants.js`, `src/notation/layout.js`,
  `src/notation/svg.js`.
- **Changes:**
  - In `src/notation/constants.js`, delete the doc comment at `:179`
    (`/** Measure-number text size … */`) and the export at `:180`
    (`export const MEASURE_NUMBER_SIZE = 2.2;`).
  - In `src/notation/layout.js`, delete the `MEASURE_NUMBER_SIZE,` named-import line
    at `:49` from the `constants.js` import block.
  - In `src/notation/svg.js`, delete the `MEASURE_NUMBER_SIZE,` named-import line at
    `:35` from the `constants.js` import block.
  - Do not remove any other constant; verify the surrounding alphabetical import
    ordering remains intact (`MAX_STRETCH` → `MEASURE_START_PAD` in `layout.js`;
    `LEDGER_WIDTH` → `NOTE_SIZE` in `svg.js`).
- **Depends on:** Task 1, Task 2 (the `layout.js` use), and Task 3 (the `svg.js`
  use) — all consumers of the constant must be gone before the import/export is
  deleted.
- **Traces to:** Spec AC6 (no unused constant lingering as dead code); Design Key
  Decision "Delete the `MEASURE_NUMBER_SIZE` constant and both imports".
- **Acceptance:**
  - `MEASURE_NUMBER_SIZE` is not defined in `constants.js` and is not imported in
    `layout.js` or `svg.js`; a repo-wide search for `MEASURE_NUMBER_SIZE` returns no
    matches.
  - `src/notation/layout.js` and `src/notation/svg.js` have no unused imports
    introduced by this change.
  - All other exported constants and imports are unchanged.

### Task 5: Scrub the three measure-number-referencing comments outside the edited functions in `layout.js`

- **Goal:** Bring the three measure-number-referencing comments that live *outside*
  every function edited in Tasks 1–4 into a truthful end state, so that no comment in
  `layout.js` claims `buildLayoutModel` produces a measure-number text (it no longer
  does after Task 1). Each comment is edited so it no longer lists a measure-number
  text among `buildLayoutModel`'s outputs, while the rest of the comment is preserved
  verbatim. The kept internal-index counter and its describing comment are left
  untouched.
- **Files to change:** `src/notation/layout.js`.
- **Changes:** Three independent comment edits, identified by their distinctive text
  (line numbers will drift after Tasks 1–4 land, so locate by text, not by number):
  - **The `buildLayoutModel` block-header comment** (around `:1411-1420`, the
    `// ── Full model assembly — buildLayoutModel ──` banner). Its texts-list line
    currently reads:
    `// + spans (ties/slurs) + texts (dynamics, notes, tempo, measure numbers,`
    continuing on the next line `// ottava). Everything is in sp units …`.
    Remove only the `measure numbers,` item from that list so it reads
    `… + texts (dynamics, notes, tempo, ottava). Everything is in sp units …`,
    preserving the rest of the banner verbatim (including the "Everything is in sp
    units" sentence and the resize note).
  - **The `buildLayoutModel` JSDoc** (around `:1706-1720`). Its texts-list line
    currently reads:
    `* the texts (tempo, measure number, dynamics, notes, ottava). Resize need only …`.
    Remove only the `measure number, ` item so it reads
    `* the texts (tempo, dynamics, notes, ottava). Resize need only …`, preserving
    the rest of the JSDoc verbatim (the surrounding sentence, the `@param`/`@return`
    tags, and the "Resize need only re-run…" note).
  - **The call-site comment above `buildSystemTexts(...)`** (around `:2135`, directly
    above `const texts = buildSystemTexts(members, measureModels, band);`). It
    currently reads:
    `// ── System-level texts: tempo + measure number + ottava. ──`.
    Remove only the `measure number + ` term so it reads
    `// ── System-level texts: tempo + ottava. ──` (keep the box-drawing rule style
    of the surrounding comments; the exact dash padding is a mechanical authoring
    detail).
  - **Do NOT touch** the flatten block-comment around `:1726-1728` that mentions "a
    sequential 1..N measure number", nor the `measureNumber` counter variable
    (`let measureNumber = 0;` at `:1730`, `measureNumber += 1;` at `:1738`,
    `number: measureNumber` at `:1745`). These describe and drive the KEPT internal
    per-measure index that feeds `data-measure` (R5/AC5); they are correct as-is and
    must remain intact.
- **Depends on:** Task 1 (the producer no longer returns a `measureNumber` field, so
  these comments are now false). Independent of Tasks 2–4, but ordered after them so
  the entire production-file excision — code then comments — lands as one contiguous
  block before the test tasks.
- **Traces to:** Spec AC6 (no stale/false comment left as dead documentation after
  the removal); R5/AC5 negatively (the kept internal-index counter and its comment
  are explicitly preserved); Design Key Decision "Remove the `measureNumber` model
  field entirely (… so no documentation-level dead reference lingers)" — which the
  design applied to `buildSystemTexts`'s own JSDoc/prose in Task 1 and which this
  task extends to the same removal's references that sit outside that function.
- **Acceptance:**
  - No comment in `layout.js` — outside the kept internal-index counter and its
    flatten block-comment — describes `buildLayoutModel` (or its `texts` output) as
    producing a measure-number text. Specifically: the `buildLayoutModel`
    block-header texts list, the `buildLayoutModel` JSDoc texts list, and the
    call-site comment above `buildSystemTexts(...)` each no longer name a
    measure-number text.
  - Each of the three edited comments retains all of its non-measure-number content
    (the other texts in each list, the surrounding sentences/notes, and the
    box-drawing comment style) — only the measure-number reference is removed.
  - The flatten block-comment that mentions "a sequential 1..N measure number"
    (around `:1726-1728`) and the `measureNumber` counter variable (`:1730`/`:1738`/
    `:1745`) are byte-for-byte unchanged; the internal index that feeds `data-measure`
    is unaffected.
  - A search of `layout.js` for "measure number" / "measure numbers" returns matches
    only on the kept internal-index counter comment (the "sequential 1..N measure
    number" line) — no remaining match describes a rendered/produced measure-number
    text.

### Task 6: Add a DOM-level absence test for a wrapping song in `svg.test.js`

- **Goal:** Guard the consumer side of AC1 — that no measure-number node is emitted
  in the rendered SVG for a song that actually wraps to multiple systems.
- **Files to change:** `src/notation/__tests__/svg.test.js`.
- **Changes:**
  - Add a small **inline** multi-measure song fixture in this test file that wraps
    at a narrow width (e.g. width 30) — the file's existing `SONG` is single-system
    and must not be reused for this. The fixture is a mechanical authoring detail:
    enough plain measures (notes on both hands) that `buildLayoutModel(fixture, 30)`
    yields more than one system. Keep it self-contained in `svg.test.js` (do not
    import or duplicate `COMPREHENSIVE_SONG`).
  - Add a new test that builds the model with `buildLayoutModel(fixture, 30)`,
    renders it with `renderSvg(model)`, first asserts the model wrapped
    (`model.systems.length > 1`) so the absence assertion is non-vacuous, then
    asserts the rendered SVG contains zero `[data-text="measure-number"]` elements,
    using the established `querySelectorAll('[data-text="measure-number"]')` idiom
    (mirroring the existing `[data-text="annotation"]` queries).
- **Depends on:** Task 3 (the node must already be removed for this test to pass
  GREEN; the code-writer derives the test via TDD).
- **Traces to:** Spec AC1 (consumer side), R1/R2; Design Key Decision "Absence — DOM
  layer" and Risk R-2 (wrap-guard before the absence assertion).
- **Acceptance:**
  - The new test builds a model that reports `systems.length > 1` (the fixture
    genuinely wraps).
  - The new test observes zero rendered elements matching
    `[data-text="measure-number"]` for that wrapping song.
  - The fixture is defined inline in `svg.test.js` and does not depend on
    `layout.test.js`'s `COMPREHENSIVE_SONG`.

### Task 7: Replace the old behavior test and add the later-system lane-placement test in `layout.test.js`

- **Goal:** Guard the producer side of AC1 (model-level absence) and AC3/R3/R4 (the
  one path that legitimately reclaims whitespace — a later, formerly-numbered system
  that also carries above-staff lanes keeps its marks present and on-lane), while
  removing the now-invalid old assertion that read the deleted field.
- **Files to change:** `src/notation/__tests__/layout.test.js`.
- **Changes:**
  - **Replace** the old test at `:2218-2230` ("measure 1 is not numbered; a later
    system numbers its first measure") — which reads the removed
    `texts.measureNumber` at `:2222` and `:2226` and would otherwise fail to
    build/assert — with a **model-level absence** test. The replacement builds
    `buildLayoutModel(COMPREHENSIVE_SONG, 30)`, asserts the model wrapped
    (`model.systems.length > 1`) so coverage is non-vacuous, asserts
    `model.systems.every(s => s.texts.measureNumber === undefined)` (use
    `=== undefined`, not `'measureNumber' in texts`), and asserts that
    `systems[0].texts` still carries `tempos` and `ottavas` arrays (the texts object
    is otherwise intact).
  - **Add** a new **later-system lane-placement** test that reuses
    `COMPREHENSIVE_SONG` at width 30 (confirmed during planning to wrap into 3
    systems whose `systems[2]` opens on measure 3 — `number !== 1`, formerly numbered
    — and carries both a tempo and an above-placed ottava). The test must:
    - build `buildLayoutModel(COMPREHENSIVE_SONG, 30)` and assert
      `model.systems.length > 1`;
    - select a later system `sys = systems[i]` with `i >= 1` whose head measure has
      `number !== 1` and whose `texts.tempos.length > 0` and whose `texts.ottavas`
      has an entry with `placement === "above"` (programmatically `.find(...)` such
      a system rather than hard-coding the index, so the test stays robust);
    - assert the lanes stack top→bottom on that later system exactly as the
      first-system test does: `sys.band.tempoLaneY < sys.band.ottavaAboveLaneY` and
      `sys.band.ottavaAboveLaneY < sys.band.rightStaffTopY`;
    - assert each tempo mark lands on its lane baseline (`t.y` ≈ `sys.band.tempoLaneY`)
      and each above-placed ottava lands on its lane baseline (`o.y` ≈
      `sys.band.ottavaAboveLaneY`) — i.e. nothing was clipped or shifted off-lane by
      the reclaimed number whitespace.
  - **Do NOT modify** the existing first-system lane/top-margin tests at `:2059-2079`
    and `:2081-2115`; they are the unchanged AC2 guard and must keep passing as-is.
  - Note for the code-writer: the design flagged that no shared wrapping fixture
    exists in `__tests__/`. Planning confirmed `COMPREHENSIVE_SONG` (in-file at
    `:931-1034`, width 30) already satisfies the later-system-with-both-lanes
    requirement, so reuse it here; a separate inline fixture is **not** required for
    `layout.test.js`. If a future edit to `COMPREHENSIVE_SONG` ever breaks that
    property, the `.find(...)` selection above will surface it (no matching later
    system) rather than silently passing.
- **Depends on:** Task 1 (model-level absence requires the field gone), Task 2 (the
  lane-placement behavior reflects the collapsed `innerZone`). The code-writer
  derives these tests via TDD.
- **Traces to:** Spec AC1 (producer side), AC3 (later-system tempo/ottava marks
  present and correctly placed, no clipping), R3/R4, AC6 (replaces the now-invalid
  old test so the suite builds clean); Design Key Decision "Specify a three-test
  guard" (model absence + later-system lane placement) and Risk R-1/R-2.
- **Acceptance:**
  - The old test reading `texts.measureNumber` (`:2222`, `:2226`) no longer exists;
    no test in the suite reads `texts.measureNumber` expecting `null` or an object.
  - The model-level absence test asserts `systems.length > 1` and that
    `texts.measureNumber === undefined` for every system, and that `systems[0].texts`
    still exposes `tempos` and `ottavas` arrays.
  - The later-system lane-placement test renders a wrapping song, selects a system
    `i >= 1` whose head measure number `!== 1` and that carries both a tempo and an
    above-placed ottava, and asserts the lanes stack correctly
    (`tempoLaneY < ottavaAboveLaneY < rightStaffTopY`) with each mark on its lane
    baseline.
  - The first-system tests at `:2059` and `:2081` are byte-for-byte unchanged and
    still pass.

### Task 8: Verify clean build, lint, and full test suite

- **Goal:** Confirm the project builds, lints, and passes the full unit-test suite
  with no dead code remaining from the removal (closing AC6).
- **Files to change:** none (verification only; fix-ups land in the relevant prior
  task if something fails).
- **Changes:**
  - Run the unit-test suite (`npm run test:unit`, i.e. `wp-scripts test-unit-js`)
    and confirm it passes, including the three new/replaced tests and the unchanged
    first-system AC2 guard tests.
  - Run lint (`npm run lint`, i.e. `biome lint .`) and confirm no unused-import or
    unused-variable errors remain (in particular nothing referencing
    `MEASURE_NUMBER_SIZE` or `showsMeasureNumber`).
  - Run the build (`npm run build`, i.e. `wp-scripts build`) and confirm it succeeds.
- **Depends on:** Task 1, Task 2, Task 3, Task 4, Task 5, Task 6, Task 7.
- **Traces to:** Spec AC6 (clean build and lint, no dead code), and validates the
  end-to-end result of all prior tasks.
- **Acceptance:**
  - `npm run test:unit` passes with no failing tests.
  - `npm run lint` reports no errors, with no unused import/variable flagged from the
    removed measure-number code.
  - `npm run build` completes successfully.
  - A repo-wide search finds no remaining reference to `MEASURE_NUMBER_SIZE`,
    `measureNumber` (as the removed model field — the kept internal-index counter
    variable of the same name in `layout.js:1730/1738/1745` is the only allowed
    survivor), `measure-number` (the removed `data-text`), or `showsMeasureNumber`.
  - No comment in `layout.js` describes `buildLayoutModel` (or its `texts` output) as
    producing a measure-number text (Task 5); the only surviving "measure number"
    prose is the kept internal-index counter comment ("a sequential 1..N measure
    number").
