# Code Plan — Beam chained eighth notes as a single group instead of in pairs

_Source: GitHub issue [#15](https://github.com/SantosGuillamot/piano-block/issues/15)._
_Phase: Plan (phase 3). Realizes `2-design-doc/design-doc.md`, which realizes `1-spec/spec.md`._

## Orientation

The entire behavioral change lives in **one function**: the simple-metre arm of
`beatGroupLength` in `src/notation/layout.js` (`:376-386`, JSDoc `:366-375`).
Everything else — the `beamGroups` walk (`:410-467`), beam geometry, stem
direction, secondary beams, stubs, flag-vs-beam, and all horizontal layout — is
left byte-identical. All test work lands in
`src/notation/__tests__/layout.test.js`.

Because the production change is a single small function, the plan is sequenced
TDD-first: encode the new contract in tests (some red), then make the one-function
edit to turn them green, then run the broader gates that prove the non-regression
invariants. Tasks are small and ordered by dependency.

A note on line cites: in this worktree the `beamGeometry` primary-beam guard is at
`layout.js:523` (`if (members.length >= 2)`), not `:522` as one design cite read;
this plan uses the worktree's actual lines. (Per `design-doc-review-approved.md`
observation #1.) Variable names in the locked snippet (`b`, `beat`, `barLength`,
`halfBar`, `unit`) are implementation polish per design §4.3; the logic and the
inline-comment house style are what is fixed (review observation #2).

---

## Task 1 — Rewrite the existing `beatGroupLength` unit assertions to the new grouping contract (RED)

**Goal:** Replace the assertions that pin today's "one notated beat" simple unit
with the new grouping-unit values, so the test suite encodes the new contract
before the code changes. These tests fail until Task 4.

**Files:** `src/notation/__tests__/layout.test.js`

**Changes:**
- In `describe("eventDuration / beatGroupLength")`:
  - Reword the simple `it(...)` title from "derives a simple beat length (one
    beatType unit)" to a grouping-unit phrasing (e.g. "derives the simple grouping
    unit (half-bar, floored at one beat / whole bar for small metres)").
  - Change the simple assertions:
    - `beatGroupLength({ beats: 4, beatType: 4 })` `1` → **`2`** (half-bar).
    - `beatGroupLength({ beats: 3, beatType: 4 })` `1` → **`3`** (whole bar — small
      simple metre).
  - In the `it("treats 3/8 as simple …")` block, change the 2/8 assertion
    `beatGroupLength({ beats: 2, beatType: 8 })` `0.5` → **`1`** (whole bar), and
    reword its inline comment from "2/8 is simple" to note 2/8 now groups by the
    whole bar (half-bar 0.5 would re-pair). Leave the 3/8 assertion at `1.5`
    (compound, unchanged).
- Leave the compound `it("derives a compound beat length (three beatType units)")`
  block entirely unchanged: `{6,8}`/`{9,8}`/`{12,8}` all stay `1.5`. (Pins
  invariant #13.)

**Depends on:** —

**Traces to:** spec #3 (general grouping rule), #2 (per-metre table), #13
(compound byte-identical); design §4.3, §6 "Change"; AC #9.

**Acceptance:** The reworded simple assertions are present and expect `2`, `3`,
`1`. The compound assertions are untouched at `1.5`. (These assertions are red
until Task 4 — running them now is optional; their job is to lock the contract.)

---

## Task 2 — Update the existing `beamGroups` 4/4 and over-full tests to the new grouping (RED)

**Goal:** Re-point the two existing `beamGroups` tests that encode the old "pairs"
behaviour to the new "groups of four" contract.

**Files:** `src/notation/__tests__/layout.test.js`

**Changes:**
- `it("beams 4/4 eighths in twos")` (8 eighths, `{beats:4,beatType:4}`):
  - Title "in twos" → **"in fours"**.
  - Expected indices `[[0,1],[2,3],[4,5],[6,7]]` → **`[[0,1,2,3],[4,5,6,7]]`**.
  - Keep `expect(groups.every((g) => g.isBeam)).toBe(true)`.
- `it("never throws or clamps on an overflowing measure")` (20 eighths,
  `{beats:4,beatType:4}`):
  - Keep `expect(() => beamGroups(...)).not.toThrow()`.
  - Comment "20 eighths → 10 pairs" → "20 eighths → 5 groups of four".
  - `expect(groups).toHaveLength(10)` → **`toHaveLength(5)`**.
  - `expect(groups.every((g) => g.indices.length === 2)).toBe(true)` → group size
    **`=== 4`**.

**Depends on:** —

**Traces to:** spec #2 (4/4 → 4+4), #5 (full/over-full 4/4 splits at half-bar),
#15 (over-full never throws); design §4.7, §5.1, §5.5, §6; AC #2, #8, #9.

**Acceptance:** The 4/4 test expects `[[0,1,2,3],[4,5,6,7]]`; the over-full test
expects 5 groups of four and still asserts no-throw. (Red until Task 4.)

---

## Task 3 — Add the new per-metre and regression `beamGroups` / `beatGroupLength` tests (RED)

**Goal:** Add the new tests mandated by AC #9 and the design's test plan (§6
"Add") so every row of the grouping table, the leftover-flag fix, the absent-ts
NaN landmine, and over-full 2/8 are pinned.

**Files:** `src/notation/__tests__/layout.test.js`

**Changes (new `it(...)` blocks):**
- In `describe("eventDuration / beatGroupLength")`, add a direct NaN-guard
  assertion — the cheapest, most pointed guard for the landmine:
  - `it("defaults an absent time signature to 4/4 grouping (NaN guard)")`:
    `expect(beatGroupLength(null)).toBe(2)` and
    `expect(beatGroupLength(undefined)).toBe(2)`.
- In `describe("beamGroups")`, add:
  - **2/4 whole bar** — 4 eighths, `{beats:2,beatType:4}` → indices
    `[[0,1,2,3]]`, `isBeam` true.
  - **3/4 whole bar** — 6 eighths, `{beats:3,beatType:4}` → indices
    `[[0,1,2,3,4,5]]`, `isBeam` true.
  - **2/2 → 4 + 4** — 8 eighths, `{beats:2,beatType:2}` → indices
    `[[0,1,2,3],[4,5,6,7]]`, every `isBeam` true.
  - **Leftover-flag fix** — 3 eighths, `{beats:4,beatType:4}` → one group
    `[[0,1,2]]` with `isBeam: true` (replaces what was a `[0,1]` beam + flagged
    `[2]`). Title e.g. "beams three eighths on beats 1-2 of 4/4 as one group (no
    leftover flag)".
  - **Absent-ts regression guard (the NaN landmine through the walk)** — 8 eighths
    with `undefined`, and again with `null`, each → `[[0,1,2,3],[4,5,6,7]]` (groups
    of four), explicitly **not** one group of 8. Title e.g. "groups absent-ts
    eighths as 4/4 (4+4), not one collapsed run".
  - **Over-full 2/8 does not throw** — 8 eighths, `{beats:2,beatType:8}`:
    `expect(() => beamGroups(...)).not.toThrow()`. (Whole-bar unit 1 tiles it as
    2+2+2+2; the test's contract is "no throw" — optionally also assert
    `toHaveLength(4)` to document the tiling, but no-throw is the spec requirement.)

**Depends on:** —

**Traces to:** spec #2 (per-metre table), #4 (3/4 whole bar of six), #10
(leftover-flag side-effect), #15 (robustness); design §4.4 (NaN guard), §5.1,
§5.5, §6 "Add"; AC #1, #3, #4, #8, #9. The two absent-ts tests (direct + through
the walk) are the regression guards called out in design §4.4 / §7.

**Acceptance:** All new blocks exist with the indices above. They are red until
Task 4 (the absent-ts walk test would currently collapse to one group of 8 / NaN;
the 2/4·3/4·2/2 tests would currently pair).

---

## Task 4 — Repurpose the simple-metre arm of `beatGroupLength` (GREEN)

**Goal:** Replace the simple-arm return with the half-bar / whole-bar grouping
unit, including the mandatory NaN guard and the load-bearing `max(unit, beat)`
floor, confining the change to the simple branch so the compound arm stays
byte-identical. This is the single production change.

**Files:** `src/notation/layout.js` (function `beatGroupLength`, `:376-386`, plus
its JSDoc `:366-375`).

**Changes:**
- Rewrite the simple branch following the design §4.3 locked logic, in the file's
  existing inline-comment idiom (bare numeric literals + terse comment; no new
  named constants):
  ```js
  const beats = timeSignature?.beats;
  const beatType = timeSignature?.beatType;
  const beat = beatType ? 4 / beatType : 1;     // one notated beat (quarter-beats)
  const isCompound =
      (beatType === 8 || beatType === 16) &&
      typeof beats === "number" &&
      beats % 3 === 0;
  if (isCompound) return beat * 3;              // dotted beat — UNCHANGED
  // SIMPLE: group by the HALF-BAR so a chained run joins under one beam
  // (4/4 -> 4, 2/2 -> 4+4). For small simple metres whose half-bar is under a
  // half-note (2 quarter-beats) — 2/4, 3/4, 2/8 — the half-bar would re-introduce
  // pairs, so group by the WHOLE BAR. Absent ts defaults to 4/4 (beats -> 4).
  const b = typeof beats === "number" ? beats : 4;   // NaN guard (absent ts)
  const barLength = b * beat;
  const halfBar = barLength / 2;
  const unit = halfBar >= 2 ? halfBar : barLength;
  // Never finer than one beat; this floor binds only in 1/1 (whole-note beat).
  return Math.max(unit, beat);
  ```
  - Keep the compound test/return path semantically identical to today
    (`isCompound ? beat*3`). Only the non-compound (simple) return changes.
- The **NaN guard is mandatory** (design §4.4): `const b = typeof beats ===
  "number" ? beats : 4;` before any multiply, so `null`/`undefined` ts ⇒ `b=4` ⇒
  half-bar `2` ⇒ groups of four — never `NaN` (which would silently collapse the
  whole run via `beamGroups`' `beatLen > 0 ?` guard).
- The **`Math.max(unit, beat)` floor is load-bearing**, not redundant: it binds in
  1/1 (beat=4, half-bar=2 → floor lifts to 4). Keep the comment naming the 1/1 case
  so it is not later deleted as dead code (design §4.5, §7).
- Rewrite the JSDoc (`:366-375`): change the simple-arm description from "one
  `beatType` unit per beat (4/4 eighths beam in 2s)" to the grouping-unit meaning
  — half-bar for duple/quadruple (4/4 → fours, 2/2 → 4+4), whole bar for small
  simple metres (2/4, 3/4, 2/8), floored at one beat; absent ts defaults to 4/4.
  Compound description (dotted beat) stays. Keep `@return … always > 0`.

**Depends on:** —  (independent of the test tasks, but logically the GREEN step;
run after Tasks 1-3 so they flip red→green.)

**Traces to:** spec #1, #3, #4, #5 (grouping rule + per-metre outcomes), #13
(compound untouched), #15 (robustness/total predicate); design §4.1-§4.5; AC
#1-#5, #8.

**Acceptance:** `beatGroupLength` returns: `{4,4}`→2, `{2,4}`→2, `{3,4}`→3,
`{2,2}`→2, `{2,8}`→1, `{6,8}`/`{9,8}`/`{12,8}`/`{3,8}`→1.5, `null`/`undefined`→2,
`{1,1}`→4. The compound arm is unchanged. Tasks 1-3 now pass.

---

## Task 5 — Run the layout unit suite and confirm the full contract green

**Goal:** Prove every changed and new test passes and that no other `layout.test.js`
case regressed (rest break, quarter break, length-1 flagged singleton, mixed
8th/16th secondary-beam counts, 6/8 threes, `measureLayout` time-sig-blindness).

**Files:** — (verification only)

**Changes:** Run the notation/layout test file, e.g.:
```
npm test -- src/notation/__tests__/layout.test.js
```
(Use the repo's configured runner if different; confirm from `package.json`
scripts.)

**Depends on:** Tasks 1-4.

**Traces to:** spec #6, #11 (boundaries + mixed durations unchanged), #13; design
§5.2, §5.3, §6 "Unchanged (verified)"; AC #5, #6, #9.

**Acceptance:** The `layout.test.js` suite passes with zero failures. In
particular: the unchanged blocks (rest break `[[0],[2]]`, quarter break, length-1
flagged singleton `{indices:[0],isBeam:false,beamCounts:[1]}`, mixed
`beamCounts:[1,2]`, 6/8 threes `[[0,1,2],[3,4,5]]`, and the `measureLayout`
"NEVER consults timeSignature" test) all still pass.

---

## Task 6 — Run the full test suite + lint and confirm no cross-module regression

**Goal:** Confirm the one-function change did not perturb any consumer
(`layoutHand`, emit, snapshots if any) and that linting passes — the
non-regression net for invariants #12 (horizontal layout) and #14 (geometry/stem/
secondary/stub/flag rules).

**Files:** — (verification only)

**Changes:** Run the complete suite and the linter, e.g.:
```
npm test
npm run lint   # if defined in package.json
```

**Depends on:** Tasks 4-5.

**Traces to:** spec #12, #14 (non-regression invariants), #11; design §5.4; AC #7.

**Acceptance:** Full suite green; lint clean. Any snapshot that legitimately
encodes 4/4 eighth beaming changes only in beam-group membership (fewer/wider
primary beams), never in X positions or measure width; review and accept only such
changes. If no snapshot references eighth beaming, expect zero snapshot churn.

---

## Task 7 — Behavioral verification: horizontal layout unchanged + visual 4+4 beaming (AC #7, #1-#2)

**Goal:** Confirm at the behavioral/end-to-end level that (a) a measure with a
newly-widened beam group has identical column X positions and width to before, and
(b) a chained 4/4 eighth run now renders as one beam per metric group (4+4), not
pairs — satisfying the acceptance criteria that a pure unit test on
`beatGroupLength` alone does not fully demonstrate.

**Files:** — (verification only; may add a focused assertion if a gap is found)

**Changes:**
- **Layout-invariance check (AC #7, primary):** The existing `measureLayout`
  "NEVER consults timeSignature — identical layout regardless of it" test
  (`layout.test.js:779`) already proves X/width are time-sig-blind, which is the
  structural guarantee that beaming cannot move a note. Confirm it passes
  unchanged. (No new test required; the design's §5.4 reasoning routes the
  invariant through this existing test. If desired for explicitness, add a small
  assertion that a 4/4 eight-eighth measure's `columns`/`width` equal a bare
  (no-ts) layout's — but this is already covered and is optional.)
- **Visual/end-to-end beaming check (AC #1, #2):** Drive the real app/render path
  on a song containing a chained run of eighths in 4/4 (and ideally 2/4 and 3/4)
  and confirm the rendered output shows one continuous primary beam per metric
  group — 4/4 → two beams of four (break at the half-bar), 2/4 → one beam of four,
  3/4 → one beam of six — with no two-note-pair fragmentation and no leftover flag
  on a three-eighth run. Use the project's run/verify path (e.g. the `run` or
  `verify` skill / `npm run build` + block preview) rather than asserting on
  geometry internals.

**Depends on:** Tasks 4-6.

**Traces to:** spec #2, #7, #12 (observable grouping + horizontal invariance);
design §2.3, §5.1, §5.4; AC #1, #2, #3, #4, #7.

**Acceptance:** The `measureLayout` time-sig-blind test passes (X/width
unchanged). A real-render check of a 4/4 chained-eighth song shows 4+4 single
beams (and 2/4 → 4, 3/4 → 6 if checked), with the leftover-flag symptom gone and
no horizontal-spacing change versus before. Any discrepancy is reported, not
worked around.

---

## Sequencing summary

1. **Task 1** — rewrite existing `beatGroupLength` simple assertions (RED).
2. **Task 2** — re-point existing `beamGroups` 4/4 + over-full tests (RED).
3. **Task 3** — add per-metre + NaN-guard + over-full-2/8 tests (RED).
4. **Task 4** — repurpose `beatGroupLength` simple arm (GREEN; the only prod change).
5. **Task 5** — run `layout.test.js`; confirm full contract + unchanged cases green.
6. **Task 6** — full suite + lint; non-regression net (invariants #12, #14).
7. **Task 7** — behavioral verification: horizontal-layout invariance + visual 4+4.

Tasks 1-3 are independent of each other and may be done together; Task 4 turns
them green; Tasks 5-7 are the layered verification gates the spec's acceptance
criteria require.
