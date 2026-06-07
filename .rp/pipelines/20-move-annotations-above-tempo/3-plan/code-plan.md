# Code plan — Move annotations above the tempo marking (issue #20)

> Ordered, independently-executable implementation tasks derived from the approved
> spec (`1-spec/spec.md`) and design doc (`2-design-doc/design-doc.md`). Each task
> is a self-contained TDD block. This is the **code plan only**; documentation
> updates (R9 / AC10, design §6) are handled in the separate doc plan in this phase.
>
> Scope reminder (do not exceed): the production change is a **pure reorder** of the
> three lane-reservation `if`-blocks in `topMarginLayout` to source order
> `[ottava, tempo, annotations]` (design D1). No other production logic changes; no
> horizontal value changes; no downstream geometry changes. All file references are
> to this worktree.

## Orientation (shared context for every task)

- **Production:** `src/notation/layout.js`. The whole above-the-top-staff stack is
  computed in `topMarginLayout` (`layout.js:2865-2910`). The three reservation
  blocks today run in source order `[annotations, ottava, tempo]`
  (`layout.js:2885-2891` annotations, `:2892-2896` ottava, `:2897-2901` tempo).
- **Invariant the change relies on:** *reserved later ⇒ larger `d` ⇒ smaller Y ⇒
  higher on the page.* Source order `[ottava, tempo, annotations]` therefore yields
  the visual top→bottom order **annotations → tempo → octaveShift** (design §2.4, §3).
- **Why the reorder is safe:** the three blocks are independent — each `*D` is
  written once in its own block and read once in the return (`:2904-2909`); the only
  shared channels are the accumulators `d` and `topExtent` (design §4.1, D1). The
  declarations (`:2882-2884`), `topMargin` (`:2902`), `at()` (`:2903`), and the
  return are left untouched.
- **Tests:** `src/notation/__tests__/layout.test.js`. The single order-asserting
  test is *"tempo, ottava, and note lanes stack above the staff"*
  (`layout.test.js:2059-2079`), inside `describe("layout-polish fixes", …)`
  (`:2043`). Tempo fixtures use the shape `tempo: { bpm: 120, beatUnit: "quarter" }`;
  per-event annotations attach via an event's `annotations: [{ text, placement }]`.
- **Run tests:** `npm test -- src/notation/__tests__/layout.test.js` (or the
  project's standard `npm test`).

---

## Task 1 — Add a failing deep-stack test for AC5 (new focused test)

- **Goal.** Add a focused unit test proving that a **multi-line** above-the-top-staff
  annotation stack (≥2 same-anchor above-RH annotations) plus a tempo (a) reserves
  its full height as the topmost lane so the whole stack clears the tempo, and (b)
  grows the system top margin. This invariant is currently untested (the only
  above-RH fixture, `COMPREHENSIVE_SONG`, carries exactly one such annotation, so
  `aboveRHCount = 1`). Written first so it fails against the current order and
  drives the production reorder (Task 3).
- **Files.** `src/notation/__tests__/layout.test.js` (add one `it(...)` inside the
  `describe("layout-polish fixes", …)` block, near the existing order test at
  `:2059-2079`).
- **Changes.**
  - Build a small song whose first system carries a tempo
    (`tempo: { bpm: 120, beatUnit: "quarter" }`) and a right-hand note with **two
    same-anchor above-RH annotations**, e.g. an event with
    `annotations: [ { text: "C", placement: "above" }, { text: "rit.", placement: "above" } ]`
    (design §7.2). Build it via `buildLayoutModel(deepSong, 200).systems[0]`.
  - Build an otherwise-identical single-annotation system (same tempo + note, but
    only **one** above-RH annotation) for the margin-growth comparison.
  - Assert, for the deep-stack system:
    1. **Whole stack clears the tempo (lowest line strictly above tempo):**
       `expect(deep.band.annotationAboveRHLaneY).toBeLessThan(deep.band.tempoLaneY)`.
       (`annotationAboveRHLaneY` is the lane baseline = note #0, the lowest line.)
    2. **Margin grows with stack depth:**
       `expect(deep.band.topMargin).toBeGreaterThan(single.band.topMargin)`.
  - Sanity-guard the fixtures so the assertions are meaningful (e.g.
    `expect(deep.texts.tempos.length).toBeGreaterThan(0)` and that
    `deep.band.annotationAboveRHLaneY`/`tempoLaneY` are non-null), mirroring the
    presence guards in the existing `:2059` test.
- **Depends on.** None.
- **Traces to.** R5; AC5.
- **Acceptance.** The new test exists and runs. Against the **current** code
  (old order) assertion 1 **fails** (today annotations hug the staff, so
  `annotationAboveRHLaneY > tempoLaneY`), confirming it genuinely exercises the
  reorder. Assertion 2 (margin growth) holds regardless of order. After Task 3 the
  whole test passes.

---

## Task 2 — Flip the existing order-asserting test to the new order (AC1, AC2)

- **Goal.** Update the single existing test that asserts the old top→bottom order
  so it asserts the new order (annotations → tempo → octaveShift), matching AC1/AC2.
  This is the only existing unit test that must change (design §7.1, AC9).
- **Files.** `src/notation/__tests__/layout.test.js` — the test
  *"tempo, ottava, and note lanes stack above the staff"* (`:2059-2079`).
- **Changes.**
  - **Comment (`:2064-2065`).** Replace the old "Stacked top→bottom: tempo above
    the ottava above the above-RH note lane …" description with the new order: the
    above-RH note/annotation lane above the tempo above the ottava, all above the
    staff top (smaller Y is higher).
  - **Assertion 1 (`:2066`).** Change `tempoLaneY < ottavaAboveLaneY` to
    `annotationAboveRHLaneY < tempoLaneY`.
  - **Assertion 2 (`:2067-2069`).** Change `ottavaAboveLaneY < annotationAboveRHLaneY`
    to `tempoLaneY < ottavaAboveLaneY`.
  - **Assertion 3 (`:2070-2072`).** Leave `annotationAboveRHLaneY < rightStaffTopY`
    unchanged (the annotation lane is still above the staff top, now further above).
  - **Emit-tracks-lane loops (`:2073-2078`).** Leave both unchanged
    (`t.y ≈ tempoLaneY`; `o.y ≈ ottavaAboveLaneY`) — `buildSystemTexts` still emits
    each marking at its lane Y; this covers AC2.
  - The resulting chain is
    `annotationAboveRHLaneY < tempoLaneY < ottavaAboveLaneY < rightStaffTopY`
    (exactly AC1).
- **Depends on.** None (independent of Task 1; both are test edits).
- **Traces to.** R1, R2; AC1, AC2, AC9.
- **Acceptance.** Against the **current** code the flipped order assertions
  **fail** (old order still in effect), confirming they pin the new behavior. After
  Task 3 the test passes. The emit-tracks-lane loops continue to pass throughout.

---

## Task 3 — Reorder the reservation blocks in `topMarginLayout` (the production change)

- **Goal.** Make the production change: reorder the three reservation `if`-blocks in
  `topMarginLayout` to source order `[ottava, tempo, annotations]`, yielding the
  visual top→bottom order annotations → tempo → octaveShift. This is the entire
  production change (design D1, §3). Turns Tasks 1 and 2 green.
- **Files.** `src/notation/layout.js` — `topMarginLayout` body (`:2885-2901`).
- **Changes.**
  - Move the **annotations** block (`aboveRHCount > 0`, currently `:2885-2891`) so
    it runs **after** the ottava block and the tempo block. The new in-function
    order of the three guarded blocks becomes:
    1. ottava — `if (systemHasRightOttavaAbove(members)) { ottavaD = d; topExtent = d + OTTAVA_SIZE; d = topExtent + TEXT_LANE_GAP; }`
    2. tempo — `if (systemHasTempo(members)) { tempoD = d; topExtent = d + TEMPO_SIZE; d = topExtent + TEXT_LANE_GAP; }`
    3. annotations — `if (aboveRHCount > 0) { annotationAboveRHD = d; topExtent = d + (aboveRHCount - 1) * stackStep + NOTE_SIZE; d = topExtent + TEXT_LANE_GAP; }`
  - Move the annotations block **verbatim** — including its in-block comment
    ("The lane's baseline is note #0; the stack grows UP …", `:2887-2888`), which
    describes the lane's internal upward growth and stays true (AC3).
  - **Do not touch** the declarations `let annotationAboveRHD/ottavaD/tempoD = null`
    (`:2882-2884`), the `stackStep`/`innerZone`/`d`/`topExtent` setup
    (`:2866-2881`), `topMargin` (`:2902`), `at()` (`:2903`), or the return
    (`:2904-2909`). The return already maps each lane field to its own `*D`, so it
    needs no edit.
  - **Do not** change any horizontal value, any other function, or any other band.
- **Depends on.** Task 1, Task 2 (this task makes their new assertions pass).
- **Traces to.** R1, R2, R3, R4, R5, R6, R7, R8; AC1–AC9.
- **Acceptance.**
  - The full layout suite passes: `npm test -- src/notation/__tests__/layout.test.js`.
    In particular the flipped order test (Task 2) and the new deep-stack test
    (Task 1) both pass.
  - The whole project test suite passes (including the e2e `specs/render.spec.js`),
    confirming no regression (AC9). The top-margin-flex test (`:2081-2115`, AC8),
    the `aboveRH.baseY`/grows-up checks (AC3), the RH-vs-LH ottava test (AC6), and
    all horizontal-position checks (AC7) remain green **without edits**.
  - The only production diff is the permutation of the three `if`-blocks inside
    `topMarginLayout` (plus the moved block's own comment); no other source line
    changes.

---

## Task 4 (optional, nice-to-have) — Add an "annotations + tempo, no ottava" subset assertion (AC4)

- **Goal.** Add a focused subset assertion that, with only annotations + tempo
  present (no ottava), the annotations sit above the tempo and the tempo hugs the
  staff. Strengthens AC4 coverage beyond the implicit n=1 tempo-above-ottava case.
  Lower priority (design §7.3) — implement only if cheap; skip if it adds noise.
- **Files.** `src/notation/__tests__/layout.test.js` (a small new `it(...)` or an
  added block in an existing relevant `describe`).
- **Changes.** Build a system carrying a tempo and one above-RH annotation but **no**
  right-hand "above" ottava. Assert:
  `annotationAboveRHLaneY < tempoLaneY` (annotations above the tempo), and that the
  tempo hugs the staff (e.g. `ottavaAboveLaneY` is `null` and the tempo lane is the
  innermost present lane). Keep `systemHasRightOttavaAbove` false for the fixture.
- **Depends on.** Task 3 (asserts post-reorder behavior).
- **Traces to.** R4; AC4.
- **Acceptance.** The subset assertion passes after Task 3. (If it would duplicate
  coverage or complicate the suite, it may be omitted — it is explicitly a
  nice-to-have.)

---

## Ordering & rationale

1. **Task 1** and **Task 2** are written first (TDD): they pin the new order and the
   deep-stack invariant and fail against the current code.
2. **Task 3** makes the single production change that turns them green.
3. **Task 4** is an optional post-change strengthening of AC4 coverage.

R9 / AC10 documentation updates (the three order-bearing comments M1
`layout.js:2850-2852`, M2 `layout.js:1866`, M3 `layout.js:2947`, design §6) are
**out of scope for this code plan** and are covered by the separate doc plan in
this phase.
