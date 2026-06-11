# Code plan — Attach beamed-note stems to the side of the notehead

Issue: https://github.com/SantosGuillamot/piano-block/issues/27
Pipeline: `27-beamed-note-stems` (phase 3 — Plan)
Spec: `.rp/pipelines/27-beamed-note-stems/1-spec/spec.md`
Design doc: `.rp/pipelines/27-beamed-note-stems/2-design-doc/design-doc.md`

## Summary

A single missing offset makes beamed stems run through the notehead center
while standalone stems sit at the notehead edge. The fix is one change in
`beamGeometry` (`src/notation/layout.js`): after the group's stem direction is
known, derive a signed `stemDx` (`+NOTEHEAD_RX` for stem-up, `−NOTEHEAD_RX` for
stem-down) and build a shifted copy of the members, then have every X reader in
the function (the `beamY` helper inputs, the stems map, the primary beam, the
secondary-beam loop, and the stub loop) read the shifted copy. Because stem
direction is uniform per group, this is a rigid horizontal translation: beam Y,
flatness, and length are unchanged, and the four X readers stay in agreement.
`src/notation/svg.js` needs no change — `renderBeam` already draws the X values
it receives verbatim, with no `note.x` reads and no horizontal arithmetic.

Verified against source before planning:
- `beamGeometry` spans `src/notation/layout.js:505-575`; the group `direction`
  is computed at line 512; the four raw-`m.x` readers are the stems map
  (529-533), the primary beam (540-541), the secondary-beam loop (546), and the
  stub loop (565-568). `NOTEHEAD_RX` is already imported and already used
  in-function (the `stubLen = NOTEHEAD_RX * 1.5` at line 565).
- `NOTEHEAD_RX = 0.6` in `src/notation/constants.js:30`.
- `renderStem` (`src/notation/svg.js:785` and `:801`) is the standalone edge
  rule: `note.x + (direction === "up" ? NOTEHEAD_RX : -NOTEHEAD_RX)`.
- `renderBeam` (`src/notation/svg.js:813-831`) reads `stem.x`, `segment.x1`,
  `segment.x2` verbatim; its only arithmetic is the width passthrough
  `Math.abs(segment.x2 - segment.x1)` and vertical math.
- The `beamGeometry` test block is `src/notation/__tests__/layout.test.js:512-547`,
  with exactly three tests (all stem-up): flat-beam (513-525, primary expectation
  `{ level: 1, x1: 0, x2: 4 }`), secondary-beam levels-only (527-535), stub
  existence/level-only (537-546). `NOTEHEAD_RX` and `beamGeometry` are already
  imported in the test file (lines 30 and 39).

Run the unit suite with `npm run test:unit` (the Jest-based
`wp-scripts test-unit-js`). To target this file:
`npm run test:unit -- src/notation/__tests__/layout.test.js`.

## Conventions for every task

- TDD: write or update the test(s) first, watch them fail for the intended
  reason, then make the change that turns them green. Task 1 is the exception
  noted in its block (the assertion it edits only flips meaning once the code
  changes), so it is written code-first with an explicit fail-then-pass check.
- Keep the change inside the scope the spec fixes (R5/R8): only
  `src/notation/layout.js`, `src/notation/svg.js` (which ends up untouched), and
  `src/notation/__tests__/layout.test.js`.
- House style for tests: constant expressions for derived geometry
  (e.g. `0 + NOTEHEAD_RX`), literals only for raw inputs. Match the existing
  tab indentation and `it(...)` / `expect(...)` style already in the file.
- After each task, run `npm run test:unit` and confirm the whole unit suite is
  green before the next task starts (tasks share one working tree, sequentially).

---

## Task 1 — Shift beamed stems and beams to the notehead edge

**Goal.** Make every stem and beam segment in a beamed group sit at the notehead
edge given by the group's stem direction (`+NOTEHEAD_RX` for stem-up,
`−NOTEHEAD_RX` for stem-down), instead of at the notehead center. Apply it once,
at the single point where direction is known and the X values originate.

**Files.**
- `src/notation/layout.js` (edit `beamGeometry`, lines 505-575).
- `src/notation/svg.js` (inspect only — confirm `renderBeam` needs no change).

**Changes.**
1. In `beamGeometry`, immediately after `const direction = stemDirectionForChord(allSteps);`
   (line 512), add the signed offset and a fresh shifted copy of the members:
   ```js
   const stemDx = direction === "up" ? NOTEHEAD_RX : -NOTEHEAD_RX;
   const shiftedMembers = members.map((m) => ({ ...m, x: m.x + stemDx }));
   ```
   Add a short comment in the file's existing voice explaining that this puts
   every stem on the notehead edge — the same rule standalone notes use in
   `renderStem` — and that a uniform per-group direction makes it a rigid
   translation.
2. Switch every reader of the raw `members` X to read `shiftedMembers`:
   - the `beamY` computation's `members.map((m) => headYFor(m) ± STEM_LENGTH)`
     (lines 524 and 526) — purely cosmetic for single-variable consistency, since
     `headYFor`/`beamY` derive from steps only and ignore X, but switch it so the
     function body reads one array;
   - the stems map `members.map((m) => ({ x: m.x, ... }))` (lines 529-533);
   - the primary beam `x1: members[0].x`, `x2: members[members.length - 1].x`
     (lines 540-541);
   - the secondary-beam loop `x1: members[i].x`, `x2: members[i + 1].x` (line 546);
   - the stub loop `members[i].x ± stubLen` (lines 567-568).
   Do NOT change anything that reads non-X member fields (`beamCount`, `topStep`,
   `bottomStep`) — those are direction/level inputs and `shiftedMembers` carries
   them unchanged via the spread, so reading them off `shiftedMembers` is fine and
   keeps the body on one array; either array is correct for those fields.
3. Leave `beamY`, `STEM_LENGTH`, the level/`shared`/`stubLen` arithmetic, and the
   return shape `{ direction, beamY, stems, beams }` exactly as they are.
4. Do NOT mutate `members` or the `notes` objects: `shiftedMembers` must be a new
   array of new objects (`map` + spread), as written above.
5. Open `src/notation/svg.js`, read `renderBeam` (lines 813-831), and confirm it
   draws `stem.x` / `segment.x1` / `segment.x2` verbatim with no `note.x` read and
   no horizontal offset. Make NO edit to `svg.js`. (This step exists to enforce
   R1's "no offset applied in the emit layer" and the design doc's "svg.js
   unchanged" claim.)

**Depends on.** Nothing.

**Traces to.** Spec R1 (offset applied once inside `beamGeometry`; emit layer
draws verbatim), R2 (beams move with stems as a rigid translation), R3 (beamed
stem X equals standalone stem X via the identical rule/constant), R4 (only the
stem/beam X changes; `note.x`-anchored elements are untouched), R5 (change lives
in the shared pipeline only). Design doc: "The single insertion point",
"Approach: shift the input once", "Key insight: the shift is a rigid
translation", "Why this is safe (R3, R4)", and the Summary-of-changes
`layout.js` / `svg.js` rows.

**Acceptance.**
- `beamGeometry` is changed at exactly one logical point (the `stemDx` +
  `shiftedMembers` introduction plus rerouting the readers); no new import is
  added (`NOTEHEAD_RX` is already imported).
- For a stem-up group, every `stems[i].x === members[i].x + NOTEHEAD_RX`; for a
  stem-down group, every `stems[i].x === members[i].x − NOTEHEAD_RX`.
- The level-1 (primary) beam's `x1`/`x2` equal the first/last shifted stem X.
  Secondary-beam segments span the shifted X of the adjacent stems they connect.
  Stub segments keep one endpoint at a shifted stem X with stub length unchanged
  (`|x2 − x1| === NOTEHEAD_RX * 1.5`).
- `beamY` and each beam segment's width (`|x2 − x1|`) are unchanged from before
  the fix (rigid translation cancels in the difference).
- `src/notation/svg.js` is byte-for-byte unchanged.
- `members` and the source `notes` objects are not mutated.
- Fail-then-pass check (since this task is code-first): before editing, run the
  existing flat-beam test — `npm run test:unit -- src/notation/__tests__/layout.test.js`
  — and observe its primary-beam assertion `{ level: 1, x1: 0, x2: 4 }` still
  passes (raw centers). After the edit, that same assertion FAILS (now
  `x1: 0.6, x2: 4.6`), confirming the offset reached the primary beam. Task 2
  updates that assertion to green. Run the full `npm run test:unit` after the
  edit and confirm the only failure is the flat-beam primary-beam expectation
  (everything else stays green, proving no layout side effects).

---

## Task 2 — Update and extend the existing stem-up `beamGeometry` test

**Goal.** Bring the existing stem-up flat-beam test in line with the shifted
geometry, and extend it to assert the stem-X offset and the primary beam's
first/last-stem equality.

**Files.**
- `src/notation/__tests__/layout.test.js` (edit the test at lines 513-525, inside
  the `beamGeometry` describe block).

**Changes.**
1. Update the breaking primary-beam expectation from
   `expect(geo.beams[0]).toMatchObject({ level: 1, x1: 0, x2: 4 });`
   to the shifted constant expressions:
   `expect(geo.beams[0]).toMatchObject({ level: 1, x1: 0 + NOTEHEAD_RX, x2: 4 + NOTEHEAD_RX });`.
2. Extend the same test (keep the existing `direction === "up"` and flat-Y
   assertions) with:
   - the stem-X assertion:
     `expect(geo.stems.map((s) => s.x)).toEqual([0 + NOTEHEAD_RX, 4 + NOTEHEAD_RX]);`
   - the level-1 first/last-stem equality:
     `expect(geo.beams[0].x1).toBe(geo.stems[0].x);` and
     `expect(geo.beams[0].x2).toBe(geo.stems.at(-1).x);`.
3. Keep the fixture (`x: 0`/`x: 4`, `topStep`/`bottomStep` 1 and 3, `beamCount: 1`)
   as raw literals — it already yields `direction === "up"` under the extreme rule.

**Depends on.** Task 1 (the offset must exist for these expectations to hold).

**Traces to.** Spec R6.1 (update the primary-beam expectation to the shifted
endpoints) and R6.2 (stem-X assertion for an up-group; level-1 first/last-stem
equality). Acceptance criteria 1, 3 (primary), 4, 7. Design doc Test-plan item 1.

**Acceptance.**
- The updated flat-beam test passes against the Task 1 code.
- Derived values use constant expressions (`0 + NOTEHEAD_RX`,
  `4 + NOTEHEAD_RX`), not bare `0.6` / `4.6` literals.
- No assertion outside this test is touched in this task.

---

## Task 3 — Add stem-down coverage and per-kind X assertions for secondary beams and stubs

**Goal.** Add the negative-offset (stem-down) coverage the spec requires, and
extend the secondary-beam and stub tests with per-kind X assertions, so all three
beam kinds (primary, secondary, stub) and both directions are covered.

**Files.**
- `src/notation/__tests__/layout.test.js` (add one test and extend two existing
  tests, all inside the `beamGeometry` describe block, lines 512-547).

**Changes.**
1. **Add** a stem-down test in the block (inline fixture, mirroring the existing
   style). Use members at `x: 0` and `x: 4` with `topStep: 6, bottomStep: 6,
   beamCount: 1`, which yields `direction === "down"` under the extreme rule
   (step 6 is above `MIDDLE_LINE = 4`). Assert:
   - `expect(geo.direction).toBe("down");`
   - stems at the negative offset:
     `expect(geo.stems.map((s) => s.x)).toEqual([0 - NOTEHEAD_RX, 4 - NOTEHEAD_RX]);`
   - the level-1 beam matching the first/last shifted stem X:
     `expect(geo.beams[0]).toMatchObject({ level: 1, x1: 0 - NOTEHEAD_RX, x2: 4 - NOTEHEAD_RX });`
     (and/or `beams[0].x1 === stems[0].x`, `beams[0].x2 === stems.at(-1).x`).
2. **Extend** the secondary-beam test (lines 527-535; fixture members at `x: 0`
   and `x: 4`, both `beamCount: 2`, both `topStep`/`bottomStep` 1 → stem-up).
   Keep the existing `levels === [1, 2]` assertion and add a per-kind X assertion
   for the level-2 segment: it spans the shifted X of the two adjacent stems it
   connects — `x1 === 0 + NOTEHEAD_RX`, `x2 === 4 + NOTEHEAD_RX`. Find that
   segment by `geo.beams.find((b) => b.level === 2)` rather than a fixed index.
   Use the per-kind (adjacent-stems) expectation here, NOT the first/last-stem
   rule (that rule applies only to the level-1 beam; here the two stems happen to
   be first and last, but the assertion must read as adjacent-stems).
3. **Extend** the stub test (lines 537-546; fixture members at `x: 0`
   `beamCount: 1` and `x: 4` `beamCount: 2` → stem-up; the level-2 stub belongs to
   the second member at `x: 4`, pointing toward the previous note). Keep the
   existing `stub defined` and `stub.level === 2` assertions and add:
   - the kept endpoint at the shifted stem X: `expect(stub.x2).toBe(4 + NOTEHEAD_RX);`
   - the unchanged stub length: `expect(stub.x2 - stub.x1).toBe(NOTEHEAD_RX * 1.5);`.
4. Use constant expressions for all derived geometry; literals only for the raw
   fixture inputs (`x`, `topStep`, `bottomStep`, `beamCount`).

**Depends on.** Task 1 (the offset) and Task 2 (keeps the file's edits ordered;
no hard data dependency on Task 2, but the tasks share the file and Task 2 lands
first per the plan order).

**Traces to.** Spec R6.2 (down-group stem-X coverage; per-kind secondary and stub
X assertions, using per-kind expectations rather than the first/last-stem rule)
and R6.3 (no other tests change). Acceptance criteria 2, 3 (secondary + stub), 7.
Design doc Test-plan items 2 and 3, including the explicit stub assertions
(`x2 = 4 + NOTEHEAD_RX`, `x2 − x1 === NOTEHEAD_RX * 1.5`).

**Acceptance.**
- A stem-down test exists and asserts `direction === "down"` plus the
  `−NOTEHEAD_RX` stem X and matching level-1 beam X.
- The secondary-beam test asserts the level-2 segment spans the shifted adjacent
  stem X (`0 + NOTEHEAD_RX` to `4 + NOTEHEAD_RX`), selecting the segment by level.
- The stub test asserts the kept endpoint `x2 === 4 + NOTEHEAD_RX` and the
  unchanged length `x2 − x1 === NOTEHEAD_RX * 1.5`.
- `npm run test:unit` is fully green: the entire `layout.test.js` suite,
  `svg.test.js`, `constants.test.js`, and any other unit tests pass with no edits
  outside `layout.test.js`'s `beamGeometry` block.
- No edits were made to `svg.test.js`, `constants.test.js`, the Playwright specs,
  the editor, PHP, or the view bootstrap. No optional overflow assertion or
  `renderBeam` DOM test is added (both declined in the design doc).

---

## Out of scope (carried from spec / design doc)

- Mixed-direction beam handling — the codebase has one stem direction per group.
- Flag changes — beamed notes draw no flags; standalone flags already sit at the
  edge.
- Spacing / width / packing recomputation — beam X has no layout consumers.
- Editor (`src/edit.js`), PHP (`src/render.php`), view bootstrap (`src/view.js`).
- A system-edge / barline overflow clamp, the optional overflow assertion, and
  the optional `svg.test.js` `renderBeam` DOM test — all declined.

## End-to-end acceptance (maps to spec Acceptance Criteria 1-8)

After all three tasks: stem-up beamed groups draw stems at `note.x + NOTEHEAD_RX`
and stem-down groups at `note.x − NOTEHEAD_RX` (AC1, AC2); the primary, secondary,
and stub beam segments span the shifted stem X with beam Y/flatness/length
unchanged (AC3); a beamed stem X equals the standalone stem X for the same pitch,
column, and direction (AC4); chords stay connected because all heads share the
tangent at `note.x ± NOTEHEAD_RX` and nothing per-chord is needed (AC5);
noteheads, displaced heads, ledger lines, dots, accidentals, and span anchors keep
their `note.x`-keyed positions (AC6); the updated and added `beamGeometry` tests
pass and all other unit tests and Playwright specs pass unchanged (AC7); and no
files outside `src/notation/layout.js`, `src/notation/svg.js` (untouched), and
`src/notation/__tests__/layout.test.js` are modified (AC8).
