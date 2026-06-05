# Code Plan: More horizontal space at the start of each measure

## Overview

This feature adds a fixed horizontal **lead-in** (an "opening clearance") of
`MEASURE_START_PAD = 1.0` sp at the start of every measure on both staves, so the
first event (note or rest, onset 0) has roughly a notehead's width of breathing
room instead of hugging the barline / measure boundary. The change lives entirely
in `src/notation/` and is realized as an additive `openingClearance` term in
`buildLayoutModel`'s system walk, mirroring the existing `noteAccidentalLead` /
`sectionReserve` two-site idiom. The clearance is folded into the measure's
**packing width** (`layout.js:1767`, so line-breaking and justification stay
correct) and its **placement inset** (`layout.js:1974`, so the notes actually
move) — and these two edits MUST land together to keep packing and placement in
sync. It is added outside the justify scale so it never stretches, and it composes
with the opening accidental's lead by `max()` rather than by stacking.

The work is sequenced as TDD: first add the new constant (a prerequisite for both
production and tests), then write/update the tests to the target behavior (RED),
then make the coupled production edit (GREEN), then a comment-hygiene touch-up,
and finally an explicit no-change verification of `svg.js` / `svg.test.js`.

Baseline before any change: `npm run test:unit -- layout.test.js svg.test.js`
passes **263** tests (`layout.test.js` = 216, `svg.test.js` = 47). After the
change, two new tests (AC5, AC6) bring the green total to **265**.

Key geometry facts the tasks rely on (all in staff-spaces, sp):
- `MEASURE_START_PAD = 1.0` (new), `BARLINE_POST_PAD = 0.7`, `NOTEHEAD_RX ≈ 0.6`,
  `ACCIDENTAL_LEAD_EXTRA = 1.0`, `MIN_ADV = 2.2`, `EMPTY_MEASURE_WIDTH = 3.3`.
- For a plain opening note, `openingClearance = max(1.0, 0) = 1.0`; for an
  accidental opening note, `openingClearance = max(1.0, 1.0) = 1.0` — both equal.
- `notes[0].x` is **measure-relative** (seeded from `cx = leadInset`); the relative
  value is `1.0` regardless of system position or justification.

---

## Tasks

### Task T1: Add the `MEASURE_START_PAD` constant and import it into `layout.js`

- **Goal:** Introduce the new exported `MEASURE_START_PAD = 1.0` constant and make
  it available to the layout module.
- **Files:**
  - `src/notation/constants.js`
  - `src/notation/layout.js`
- **Changes:**
  - In `src/notation/constants.js`, in the "Horizontal spacing" section,
    immediately AFTER `EMPTY_MEASURE_WIDTH` (currently `constants.js:69-70`, before
    the `// ── System wrapping / justify / vertical gaps ──` divider at `:72`), add
    a new exported constant with a doc-comment:
    ```js
    /**
     * Opening clearance, in sp, reserved at the start of EVERY measure before its first
     * note column, so the opening note has room to breathe instead of hugging the
     * barline / measure boundary. Applied uniformly on both staves and unscaled by
     * justify. Composes with the opening accidental's lead by max() (they share the
     * same pre-column slot), not by stacking.
     */
    export const MEASURE_START_PAD = 1.0;
    ```
    Do NOT place it in the "Barlines" section; this is intentionally a
    horizontal-spacing / measure-width budget value, not a barline-side change.
  - In `src/notation/layout.js`, add `MEASURE_START_PAD` to the named import block
    from `"../constants.js"` (the block that currently spans `layout.js:22-…` and
    already imports `MAX_STRETCH` at `:48` and `MIN_ADV` at `:51`). Insert it in
    alphabetical order, between `MAX_STRETCH` and `MIN_ADV`.
  - Do NOT yet use `MEASURE_START_PAD` anywhere in `layout.js` logic (that is T3).
    Adding an unused import is acceptable at this task boundary because the value is
    consumed in T3, which depends on T1.
- **Depends on:** none
- **Traces to:** Design "New constant (`constants.js`)", Decision D2
  (`MEASURE_START_PAD = 1.0`); Spec Requirement 2.
- **Acceptance:**
  - `MEASURE_START_PAD` is an exported member of `src/notation/constants.js` with
    the numeric value `1.0`.
  - The constant is declared inside the "Horizontal spacing" section, after
    `EMPTY_MEASURE_WIDTH` and before the next section divider.
  - `import { MEASURE_START_PAD } from "../constants.js"` resolves (the symbol is
    present in `layout.js`'s import block).
  - The full suite still passes: `npm run test:unit -- layout.test.js svg.test.js`
    reports 263 passing (no behavior change yet).

---

### Task T2: Update and add `layout.test.js` assertions to the target lead-in behavior (RED)

- **Goal:** Rewrite the existing "hug the start" assertions to the lead-in
  behavior and add the two new tests (AC5 justify-invariance, AC6 empty measure),
  so the suite encodes the target contract. These tests are expected to FAIL until
  T3 lands.
- **Files:**
  - `src/notation/__tests__/layout.test.js`
- **Changes:**
  - **Imports (`layout.test.js:11-29`).** Add `MEASURE_START_PAD` and
    `BARLINE_POST_PAD` to the `from "../constants.js"` named-import block (it
    currently imports `ACCIDENTAL_GAP`, `EMPTY_MEASURE_WIDTH`, `MIN_ADV`,
    `NOTEHEAD_RX`, `STAFF_MARGIN_X`, etc., but NOT these two). Keep alphabetical
    ordering.
  - **AC2 — barline→first-note gap (`layout.test.js:2030-2040`).** Strengthen from
    a barline→measure-edge gap to a barline→first-note gap. Rename the `it(…)` at
    `:2030` so it no longer implies the note hugs the bar (e.g. "every barline
    leaves at least a notehead-width gap before the next measure's first note").
    Reword the comment at `:2035-2036`. Replace the loop body so each iteration
    asserts:
    ```js
    const endBar = measures[i - 1].barlines.find((b) => b.side === "end");
    const barStrokeX = endBar.strokes[0].x;
    const firstNoteX = measures[i].x + measures[i].right.notes[0].x;
    expect(firstNoteX - barStrokeX).toBeGreaterThanOrEqual(
        MEASURE_START_PAD + BARLINE_POST_PAD - NOTEHEAD_RX
    );
    ```
    (Threshold = `1.0 + 0.7 − 0.6 = 1.1` sp; the realized gap after T3 is ≈ 1.83.)
    Keep the `expect(measures.length).toBeGreaterThan(1)` guard.
  - **AC1 + AC4 — whole-note test (`layout.test.js:2092-2122`).** Reword the
    `it(…)` name at `:2092` and the comment at `:2118-2119` to drop "hugs" (e.g.
    "sits the opening lead-in past the left edge, left of center"). Change `:2120`
    from `expect(m.right.notes[0].x).toBeLessThan(NOTEHEAD_RX)` to
    `expect(m.right.notes[0].x).toBeCloseTo(MEASURE_START_PAD)`. KEEP `:2121`
    `expect(m.right.notes[0].x).toBeLessThan(m.width / 2)` unchanged (this is AC4).
    ADD a both-staves assertion using the existing LH whole note in the fixture
    (`:2105-2111`): `expect(m.left.notes[0].x).toBeCloseTo(MEASURE_START_PAD)`.
  - **AC1 + AC3 — opening-accidental test (`layout.test.js:2138-2161`).** Rename
    the `it(…)` at `:2138` to drop "hugs" (e.g. "an opening note lands at the
    uniform lead-in; an opening accidental occupies that lead-in and draws left of
    the head"). Reword the comment at `:2157-2158`. Change `:2159` from
    `expect(plain.right.notes[0].x).toBeLessThan(NOTEHEAD_RX)` to
    `expect(plain.right.notes[0].x).toBeCloseTo(MEASURE_START_PAD)`. Change `:2160`
    from `expect(sharp.right.notes[0].x).toBeGreaterThan(plain.right.notes[0].x)` to
    `expect(sharp.right.notes[0].x).toBeCloseTo(plain.right.notes[0].x)`, and ADD
    `expect(sharp.right.notes[0].accidentals[0].dx).toBeGreaterThan(0)` (the
    accidental glyph draws to the left of the head; `dx` is a positive left offset).
    Note: the plain fixture's `notes[0].accidentals` is `[]` — do NOT index it.
  - **AC5 — justify invariance (NEW test).** Add a new `it(…)` (place it near the
    other `notes[0].x` tests, after the accidental test at `~:2161`). Build the
    SAME multi-measure fixture twice via `buildLayoutModel(song, wide)` and
    `buildLayoutModel(song, narrow)`, where `narrow` forces a wrap to ≥2 systems so
    a non-last (justified) system exists, and `wide` keeps everything in one
    system. Read an interior measure's first note from a non-last/justified system
    in the narrow build (the last system is not justified, per `layout.js:1702`) and
    the same measure from the wide build, and assert
    `expect(m.right.notes[0].x).toBeCloseTo(MEASURE_START_PAD)` in BOTH cases. The
    fixture may reuse `COMPREHENSIVE_SONG` (already used at the same narrow width
    `30` in the test at `:2124-2136`, which wraps to >1 system) or a small purpose
    -built song; choose a measure whose first event is a plain note (no accidental,
    no section change) so the expected value is exactly `MEASURE_START_PAD`.
  - **AC6 — empty measure (NEW `buildLayoutModel`-level test).** Add a new `it(…)`
    (place it near the AC5 test). Do NOT modify the existing `measureLayout`-level
    empty-measure test at `:754-762`. Build a `buildLayoutModel` of a song
    containing a measure with no events (empty `rightHand` and `leftHand`) and
    assert: `expect(m.right.notes.length).toBe(0)`,
    `expect(m.left.notes.length).toBe(0)`,
    `expect(Number.isFinite(m.width)).toBe(true)`, and that the measure width
    grows by the opening clearance versus the no-pad baseline (the empty measure's
    width is `> EMPTY_MEASURE_WIDTH`; after T3 it is ≈ `EMPTY_MEASURE_WIDTH +
    MEASURE_START_PAD = 4.3`). Assert no NaN is produced.
  - Do NOT modify the section-first test at `:2042-2053` (it stays green after T3:
    `firstNoteX > m3.inline.timeSignatureX` still holds — the note moves further
    right). Do NOT modify any `svg.test.js` test.
- **Depends on:** T1
- **Traces to:** Spec AC1, AC2, AC3, AC4, AC5, AC6, AC7; Design "Test Contract".
- **Acceptance:**
  - `MEASURE_START_PAD` and `BARLINE_POST_PAD` are both imported in
    `layout.test.js`.
  - The whole-note, accidental, and barline-gap tests assert the new lead-in
    behavior (no remaining `toBeLessThan(NOTEHEAD_RX)` assertions for `notes[0].x`,
    no remaining "hugs" wording in those three test names/comments).
  - Two NEW tests exist: a justify-invariance test (AC5) and a
    `buildLayoutModel`-level empty-measure test (AC6).
  - Running `npm run test:unit -- layout.test.js` shows the updated/new
    lead-in tests FAILING (RED) because the production code still seeds
    `notes[0].x ≈ 0`. (Specifically the AC1/AC2/AC3/AC5 assertions fail; this is the
    expected pre-implementation state.) All OTHER layout tests still pass.
  - `svg.test.js` is unchanged and still passes (47).

---

### Task T3: Apply the coupled `openingClearance` edit in `buildLayoutModel` (GREEN)

- **Goal:** Add the `openingClearance = max(MEASURE_START_PAD, noteAccidentalLead)`
  term to BOTH the packing width and the placement inset in one atomic change,
  remove the now-dead `m.noteAccidentalLead` field store, and refresh the inline
  comments — turning the T2 tests green.
- **Files:**
  - `src/notation/layout.js`
- **Changes:** All edits are inside `buildLayoutModel`. Make the packing edit and
  the placement edit TOGETHER — the tree must never be left with one applied and
  not the other (the both-coordinate coupling invariant; a half-applied state
  desyncs packing from placement and perturbs wrap points / barline positions).
  - **Packing pass (`layout.js:1750-1767`).**
    - KEEP the local `const noteAccidentalLead = firstColumnHasAccidental(m) ?
      ACCIDENTAL_LEAD_EXTRA : 0;` at `:1752-1754` — it is the `max()` input.
    - KEEP `const sectionReserve = …` at `:1750-1751`.
    - ADD, after computing `noteAccidentalLead`, a new local:
      ```js
      const openingClearance = Math.max(MEASURE_START_PAD, noteAccidentalLead);
      ```
    - REMOVE the dead field store `m.noteAccidentalLead = noteAccidentalLead;`
      currently at `:1763`. ADD in its place `m.openingClearance = openingClearance;`
      (keep `m.sectionReserve = sectionReserve;` at `:1762` and `m.layout = ml;` at
      `:1764`). The field `m.noteAccidentalLead` must have NO remaining readers after
      this task (its only two readers were `:1767` and `:1976`, both rewritten here).
    - CHANGE the packing sum at `:1767` from
      `m.contentWidth = ml.width + sectionReserve + noteAccidentalLead;`
      to
      `m.contentWidth = ml.width + sectionReserve + openingClearance;`
  - **Placement walk (`layout.js:1974-1976`).** CHANGE the `leadInset` computation
    from
    ```js
    const leadInset =
        (localIdx > 0 ? (m.sectionReserve ?? 0) : 0) +
        (m.noteAccidentalLead ?? 0);
    ```
    to
    ```js
    const leadInset =
        (localIdx > 0 ? (m.sectionReserve ?? 0) : 0) +
        (m.openingClearance ?? 0);
    ```
    `sectionReserve` stays the only position-gated (`localIdx > 0`) term;
    `openingClearance` is added unconditionally (uniform on every measure, including
    system heads — Decision D4). Do NOT touch `scaledGrid` (`:1980-1981`),
    `scaledContent = leadInset + scaledGrid` (`:1982`), or `cx = leadInset`
    (`:1987`) — they are unchanged in shape and now simply carry the larger inset.
    The inset stays OUTSIDE the `* advanceScale` factor, so the clearance does not
    stretch under justification.
  - **Comment hygiene.** Refresh the inline comments so they describe the opening
    clearance, not just the accidental:
    - At `:1745-1749` ("Two independent leading insets…"): update to describe
      `openingClearance` as the uniform per-measure lead-in (composed with the
      accidental lead by `max()`) alongside `sectionReserve`.
    - At `:1971-1973` (the `leadInset` doc comment): update to mention the uniform
      opening clearance in addition to the section reserve.
  - Do NOT touch `measureLayout`, its `leadingPad` option, barline geometry,
    `trailingPad`, or any downstream consumer — they all ride the shifted frame
    automatically.
- **Depends on:** T2 (the failing tests this task makes green), T1 (the constant
  and import).
- **Traces to:** Spec Requirements 1, 2, 3, 4, 5, 6, 7; Spec AC1–AC7; Design
  "Modified data flow in `buildLayoutModel`", Decisions D1, D3, D4; "Dead-store
  removal blast radius" risk.
- **Acceptance:**
  - `grep "noteAccidentalLead" src/notation/layout.js` shows the local `const`
    (still used as the `max()` input) but NO `m.noteAccidentalLead =` store and NO
    `m.noteAccidentalLead` read — the field is fully removed.
  - `m.contentWidth` (packing) and `leadInset` (placement) both include
    `openingClearance` (the coupled edit is applied to both sites).
  - The full suite is GREEN: `npm run test:unit -- layout.test.js svg.test.js`
    reports **265** passing (216 + 2 new layout tests = 218 layout, plus 47 svg),
    including all the T2 lead-in assertions (AC1–AC6) and the unchanged
    section-first test (AC7).
  - A plain interior measure's `right.notes[0].x` and `left.notes[0].x` are
    `toBeCloseTo(1.0)`; an accidental-opening measure's `notes[0].x` equals the
    plain one's; an empty measure's width is finite and ≈ 4.3.

---

### Task T4: Soften the `BARLINE_POST_PAD` doc-comment in `constants.js`

- **Goal:** Update the now-stale `BARLINE_POST_PAD` doc-comment so it no longer
  claims the opening note "sits close to the bar"; the value `0.7` is unchanged.
- **Files:**
  - `src/notation/constants.js`
- **Changes:**
  - At `constants.js:117-122`, the current comment reads: "Whitespace after a
    barline before the next measure's first note CENTER, in sp. Kept small so the
    opening note sits close to the bar, but more than the notehead radius so the
    head still clears the line." After this feature the lead-in pushes the note ~1
    sp further, so soften it to something like: "Whitespace after a barline before
    the next measure's first note CENTER, in sp. Kept small — more than the notehead
    radius so the head still clears the line — while the measure's own lead-in
    (`MEASURE_START_PAD`) supplies the breathing room before the opening note."
  - Do NOT change the constant's value: `export const BARLINE_POST_PAD = 0.7;`
    stays exactly as-is. Comment-only edit.
- **Depends on:** T3 (so the comment reflects the now-shipped behavior; ordering is
  not strictly required for correctness but keeps the doc consistent with code).
- **Traces to:** Design "Doc-comment touch-up (`constants.js:117-122`)"; "Comment
  hygiene" risk.
- **Acceptance:**
  - `BARLINE_POST_PAD === 0.7` (value unchanged).
  - The doc-comment no longer states the opening note "sits close to the bar" and
    references `MEASURE_START_PAD` as the source of the opening breathing room.
  - `npm run test:unit -- layout.test.js svg.test.js` still reports 265 passing
    (comment-only change, no behavior impact).

---

### Task T5: Verify `svg.js` and `svg.test.js` require no changes

- **Goal:** Confirm — and record by the green suite — that the emit layer and its
  tests need no edits, per the design's explicit "untouched" claim.
- **Files:**
  - `src/notation/svg.js` (read-only verification; expected NO edit)
  - `src/notation/__tests__/svg.test.js` (read-only verification; expected NO edit)
- **Changes:**
  - This is a VERIFY-only task. Confirm `svg.js` consumes laid-out positions
    (`note.x`, `measure.x`, `acc.dx`) and never reads the pad; the accidental glyph
    is drawn at `note.x − acc.dx` (`svg.js:751`) so it rides along with the shifted
    note. Confirm `svg.test.js` has no assertion pinning an absolute flush note X
    (the `toBeCloseTo(0)` checks at `svg.test.js:1072`/`:1104` are relative symmetry
    differences; `:707-714` and `:1176-1182` are ordering/relative invariants that
    survive a uniform left shift; `:731` is a trailing-bar right-side X).
  - If, and ONLY if, a `svg.test.js` test actually fails after T3, STOP and report a
    blocker — the design asserts no svg changes are needed, so a failure indicates a
    design assumption is wrong and must be revisited before editing svg files.
    Otherwise make NO edits to either file.
- **Depends on:** T3
- **Traces to:** Spec AC7 ("No unrelated regressions"); Design "Components" →
  `svg.js` (untouched), "Test Contract" → AC7 svg analysis.
- **Acceptance:**
  - `src/notation/svg.js` and `src/notation/__tests__/svg.test.js` are unmodified
    (no diff in these two files for this task).
  - `npm run test:unit -- svg.test.js` reports 47 passing.
  - `npm run test:unit -- layout.test.js svg.test.js` reports 265 passing overall.
