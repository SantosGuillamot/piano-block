# Code plan — Issue #21: Space notes horizontally according to their duration

## 0. Orientation (read first)

**This is a TEST-ONLY change.** Duration-ordered horizontal spacing is already
implemented and wired end-to-end; all 381 existing unit tests pass against the
current source with **zero changes** (re-confirmed in this worktree:
`npm run test:unit` → `Tests: 381 passed`). The deliverable is *provable
protection* — regression tests that lock the accepted ordinal duration-spacing
behavior at three seams. **Do NOT touch any source file** (`layout.js`,
`svg.js`, `constants.js`). If you find yourself wanting to edit source to make a
test pass, STOP and report a blocker — the design says no source change is
needed and the suite proves it.

### Files touched (only these two)

- `src/notation/__tests__/layout.test.js` — one new feature-grouped `describe`
  holding the layout/model ACs (Task 1, Task 2, Task 3).
- `src/notation/__tests__/svg.test.js` — one new small `describe` holding the
  single AC10 DOM smoke test (Task 4).

Do **NOT** touch the Playwright spec (`specs/render.spec.js`), any source
module, or any `.rp/` artifact. Shipped tests must contain **no reference to
`.rp/` artifacts** and **no `console.*`** (the `@wordpress/jest-console` preset
auto-fails any test that logs).

### The live spacing model the tests lock (reference, do not re-derive)

`advanceFor(Δ) = MIN_ADV + ADV_K·sqrt(max(Δ,0))` with `MIN_ADV = 2.2`,
`ADV_K = 3.0` (`layout.js:778`). `Δ` is the gap, in quarter-beats, from a note's
onset to the **next** onset — i.e. the note's **own** duration. Live advance
table (assert ordinally / via the formula, **never** as raw literals):

| Δ (quarter-beats) | duration       | advance (sp) |
| ----------------- | -------------- | ------------ |
| 0.125             | 32nd           | 3.2607       |
| 0.25              | 16th           | 3.7000       |
| 0.5               | eighth         | 4.3213       |
| 1.0               | quarter        | 5.2000       |
| 1.5               | dotted quarter | 5.8742       |
| 2.0               | half           | 6.4426       |
| 4.0               | whole          | 8.2000       |

`measureLayout(rh, lh, opts)` returns `{ grid, columns:[{onset,x,advance}],
measureEnd, contentWidth, width, hands }`; **`columns[i].advance` IS the
per-column horizontal gap** (`layout.js:842-849`) — read it directly, no X
subtraction. `buildLayoutModel(song, widthSp)` produces
`systems[i].measures[j].right.notes[].x` (post-justify on-screen X) and
`systems[i].advanceScale`. `renderSvg(model)` stamps `<g
id="rightHand-note-${i}">` containing a `[data-notehead]` child with `cx`; for a
**single-pitch** note `cx === note.x` exactly (`svg.js`).

### Repo data shapes — USE THESE EXACTLY (reviewer nits 1 & 3)

- **Pitches are `{ step, octave }` OBJECTS, never strings.** A pitch-less or
  string-pitch note is *skipped* in `layoutHand` (`layout.js:1471`) and never
  reaches `notes[]` — which would silently break AC7/AC10 (`buildLayoutModel` /
  `renderSvg` would emit fewer notes than expected). Every fixture event fed to
  `buildLayoutModel`/`renderSvg` MUST carry `pitches: [{ step, octave }]`. Trap
  R-G.
- **Time signature is `{ beats, beatType }`**, e.g.
  `{ beats: 2, beatType: 4 }` — NOT `{2,4}` shorthand (reviewer nit 1). It is
  fully ignored by layout, so the AC9 deep-equal is byte-identical regardless;
  use the repo shape for consistency (`layout.test.js:874`).
- A bare `measureLayout` event only needs `{ type, duration }` (and `dots`,
  `pitches` per the event); `measureLayout` ignores pitches, so the **same**
  pitch-carrying array works at both the layout and model layers — which is why
  one shared const is canonical.

### Matcher policy — apply uniformly (design §5 D-Matcher)

- **Strict ordering** (`<` / `>`): `toBeLessThan` / `toBeGreaterThan`, no
  tolerance. Plus `toBeLessThanOrEqual(MAX_STRETCH)` for the cap. (AC1, AC2,
  AC3, AC4, AC7 ordering, AC8, AC9 ordering, edge F.)
- **sp-arithmetic equality + ratios** (sqrt-irrational): `toBeCloseTo(_, 10)`,
  **never `toBe`**. (AC1 four-eighth equality, AC6, AC9 advance equality, AC7
  ratio invariance, AC8.)
- **DOM `cx` geometry:** `toBeCloseTo(_, 6)` (the `svg.test.js:317` idiom).
- **Exact grids / onsets / deep-equal:** `toEqual` (AC1 grid, AC5 grid
  equality, AC9 ts-blind deep-equal). `MEASURE_START_PAD` lead-in: `toBe`
  (exactly representable, 1.0).
- **No invented pixel ratios anywhere.** Where a constant exists, assert against
  the import — `advanceFor(Δ)`, `MAX_STRETCH`, `MEASURE_START_PAD` — not a
  copied literal, so a deferred OQ1/OQ2 constant tune keeps tests green as long
  as ordering holds. Trap R-A.

### Fixture traps — bake into every fixture (design §6)

- **R-B (inter-note X-gap trap):** a rendered inter-note gap is governed by the
  **LEFT** note's Δ. The last column gaps to `measureEnd`, and the boundary
  last-eighth→first-quarter gap in `[8,8,8,8,q,q]` is **also an eighth gap**
  (governed by the eighth's Δ=0.5), **not** a quarter gap. So compare the
  eighth-LED columns against the genuine **q→q** column (cols 4→5), never the
  col-3→4 boundary. Pure `advanceFor(Δ)` chains are Δ-indexed and never hit
  this.
- **R-C (chord `cx` skew):** a chord's back head is displaced by `dx*2`. Use
  **single-pitch** fixtures for any `cx`/`note.x` comparison; prove AC5 at the
  `measureLayout` onset-grid level, not at `cx`.
- **R-D (cross-system absolute-gap temptation):** systems justify independently
  (system-0 eighth gap 4.4236 ≠ system-1 eighth gap 4.3213). Assert AC8 ONLY at
  the intrinsic `measureLayout` layer; NEVER assert cross-system absolute gaps.
- **R-G (pitch-less fixture):** see data shapes above — fixtures fed to the
  model/render path MUST carry `{ step, octave }` pitches.

### Naming / structure conventions (design §5 D-Files, D-Naming)

- `layout.test.js`: one new describe titled exactly
  `"duration-ordered horizontal spacing (issue #21)"`, with a **leading block
  comment** stating intent (lock the accepted ordinal duration spacing; no
  source change). Mirrors the repo's feature-grouped AC blocks (hairpin block,
  `svg.test.js:1004`).
- `svg.test.js`: one new describe titled exactly
  `"renderSvg — duration-ordered spacing reaches the SVG (issue #21)"`, matching
  the repo's `renderSvg — X` naming.
- **`it()` titles are behavior-first with a trailing `(ACn)` suffix**, e.g.
  `it("spaces equal eighth columns equally and tighter than the quarter column (AC1)")`.
  The issue number lives in the describe title / block comment, **never** in an
  `it()` title (repo convention: `layout.test.js:3656` "(#13: …)").
- All needed imports already exist in both files — **add none**. `layout.test.js`
  already imports `advanceFor`, `eventDuration`, `measureLayout`, `systemScale`,
  `buildLayoutModel`, `MAX_STRETCH`, `MEASURE_START_PAD`, `EMPTY_MEASURE_WIDTH`
  (verified at `layout.test.js:34-73, 13-32`). `svg.test.js` already imports
  `buildLayoutModel` and `renderSvg` (`svg.test.js:12-13`).

### Existing cases to REUSE (do NOT duplicate)

These already exist and are left intact; the #21 tests add ordering/equality
assertions *alongside* them, never as replacements:

- Empty measure — `layout.test.js:841`.
- Over-full no-throw / 20 cols / finite (no all-equal, no monotonic-X) —
  `layout.test.js:852`. AC9's all-equal + strict-monotonic-X + over-full-ts-blind
  assertions are genuinely additive.
- Under-full ts-blind (6 eighths) — `layout.test.js:866`.
- `systemScale` policy (cap / ragged-last / downscale) —
  `layout.test.js:1789-1813`. #21 adds only the ONE `buildLayoutModel`
  end-to-end AC7 case; it does NOT re-test the policy.

---

## TASK 1 — Canonical layout-level ordinal tests (AC1, AC2+F, AC3, AC5, AC6)

**Goal.** Open the new feature-grouped describe in `layout.test.js`, define the
single canonical fixture + `songOf` helper, and add the pure layout-level ordinal
criteria that read `columns[].advance` / `advanceFor(Δ)` directly.

**Files.** `src/notation/__tests__/layout.test.js` (one new top-level `describe`,
appended at end of file).

**Changes.**

1. Add a leading block comment + `describe("duration-ordered horizontal spacing (issue #21)")`.
   Block comment states: this locks the accepted, already-shipped ordinal
   duration spacing (shorter note → strictly less horizontal space); it is a
   regression lock, no source change is made; assertions are ordinal / against
   the formula, never raw pixels.

2. At the top of the describe, define the **single canonical fixture** as a const
   and a local song helper (these are shared by Tasks 1–3):
   ```js
   // Four eighths + two quarters, single-pitch (single-pitch ⇒ cx === note.x;
   // pitches present ⇒ notes are not skipped in layoutHand). The SAME array
   // feeds measureLayout (which ignores pitches) and buildLayoutModel/renderSvg.
   const AC1_EVENTS = [
       ...Array.from({ length: 4 }, () => ({
           type: "note", duration: "eighth",
           pitches: [{ step: "C", octave: 5 }],
       })),
       ...Array.from({ length: 2 }, () => ({
           type: "note", duration: "quarter",
           pitches: [{ step: "C", octave: 5 }],
       })),
   ];
   // Wrap an event array into a one-measure song (mirrors songWithNotes).
   const songOf = (events) => ({
       metadata: {},
       sections: [{ measures: [{ rightHand: events }] }],
   });
   ```
   (Keep step/octave constant across events so the array is a clean single-pitch
   column set; values are otherwise unconstrained.)

3. **AC1** — `it("spaces equal eighth columns equally and tighter than the quarter column (AC1)")`:
   - `const layout = measureLayout(AC1_EVENTS, []);`
   - `expect(layout.grid).toEqual([0, 0.5, 1, 1.5, 2, 3]);` (`toEqual`).
   - The four eighth-led columns are mutually equal: assert
     `layout.columns[1..3].advance` each `toBeCloseTo(layout.columns[0].advance, 10)`.
   - Each eighth column `< layout.columns[4].advance` (the genuine **q→q** gap):
     `expect(layout.columns[0].advance).toBeLessThan(layout.columns[4].advance);`
   - **Trap R-B / D5:** compare cols 0–3 against **col 4** (q→q, onsets 2→3),
     NOT col 3 (the last-eighth→first-quarter boundary at onset 1.5→2, which is
     an eighth gap). Add a one-line comment to that effect.
   - Optionally tie col 4 to the formula: `toBeCloseTo(advanceFor(1), 10)` and
     col 0 to `toBeCloseTo(advanceFor(0.5), 10)` (assert against the import, not
     5.2 / 4.3213 literals).

4. **AC2 + edge F** — `it("orders advances strictly by duration across the whole range (AC2)")`:
   - Six-way strict chain on `advanceFor` (Δ-indexed, immune to R-B):
     `advanceFor(0.125) < advanceFor(0.25) < advanceFor(0.5) < advanceFor(1) < advanceFor(2) < advanceFor(4)`
     — five `toBeLessThan` assertions.
   - **Edge F** is the FIRST link (`advanceFor(0.25) > advanceFor(0.125)`: the
     MIN_ADV floor never ties two distinct durations) — folded in, no separate
     test. Add a comment noting edge F is covered here.

5. **AC3** — `it("places a dotted quarter strictly between a quarter and a half (AC3)")`:
   - `const dq = advanceFor(eventDuration({ duration: "quarter", dots: 1 }));`
     (the `eventDuration` form self-documents `BASE_DUR × DOT_MUL` → 1.5).
   - `expect(dq).toBeGreaterThan(advanceFor(1));`
   - `expect(dq).toBeLessThan(advanceFor(2));`

6. **AC5** — `it("gives a chord the same column footprint as a single note of the same duration (AC5)")`:
   - chord fixture: `measureLayout([{ type:"note", duration:"quarter", pitches:[{step:"C",octave:5},{step:"E",octave:5},{step:"G",octave:5}] }, { type:"note", duration:"quarter", pitches:[{step:"C",octave:5}] }], [])`.
   - single fixture: `measureLayout([{ type:"note", duration:"quarter", pitches:[{step:"C",octave:5}] }, { type:"note", duration:"quarter", pitches:[{step:"C",octave:5}] }], [])`.
   - `expect(chord.columns[0].advance).toBeCloseTo(single.columns[0].advance, 10);`
   - `expect(chord.grid).toEqual(single.grid);` (head count never enters
     `handOnsets`/`unionGrid`/`advanceFor`). Prove AC5 at `measureLayout`, NOT at
     `cx` (trap R-C).

7. **AC6** — `it("spaces a single-duration measure uniformly (AC6)")`:
   - `const layout = measureLayout(Array.from({length:4}, () => ({ type:"note", duration:"quarter", pitches:[{step:"C",octave:5}] })), []);`
   - columns 0–2 `.advance` all equal: `toBeCloseTo(layout.columns[0].advance, 10)`
     for columns 1 and 2 (N notes → N−1 equal consecutive gaps). (Column 3 is the
     gap-to-`measureEnd`; the N−1 internal gaps are cols 0..N−2.)

**Depends on.** none.

**Traces to.** AC1, AC2 (+edge F), AC3, AC5, AC6; design §4 (AC1/AC2/AC3/AC5/AC6
rows), §5 D-Fixtures, D-Naming, D-Matcher; spec R1/R2/R3/R5/R7.

**Acceptance.** Five new `it`s (AC1, AC2, AC3, AC5, AC6) added under the new
describe with the canonical `AC1_EVENTS`/`songOf` defined once; each passes;
`AC1_EVENTS` and `songOf` are referenced by later tasks (not redefined). Full
`npm run test:unit` green (386 total = 381 + 5).

---

## TASK 2 — Rest, cross-measure, and over-full layout tests (AC4, AC8, AC9)

**Goal.** Add the remaining `measureLayout`-layer criteria: rests as grid
citizens, equal intrinsic advance across measures, and the over-full /
time-signature-blind behavior.

**Files.** `src/notation/__tests__/layout.test.js` (same describe opened in
Task 1).

**Changes.**

1. **AC4** — `it("spaces rests by duration as full grid citizens (AC4)")`:
   - Value chain: `expect(advanceFor(2)).toBeGreaterThan(advanceFor(0.5));`
     (half rest > eighth rest).
   - Grid participation:
     `const layout = measureLayout([{ type:"rest", duration:"half" }, { type:"rest", duration:"eighth" }], []);`
     then `expect(layout.columns[0].advance).toBeGreaterThan(layout.columns[1].advance);`
     (rests carry duration into the onset grid; rests need no `pitches`).

2. **AC8** — `it("gives a quarter the same intrinsic advance regardless of its measure or neighbours (AC8)")`:
   - `const isolated = measureLayout([{ type:"note", duration:"quarter", pitches:[{step:"C",octave:5}] }, { type:"note", duration:"quarter", pitches:[{step:"C",octave:5}] }], []);`
   - `const mixed = measureLayout(AC1_EVENTS, []);`
   - `expect(mixed.columns[4].advance).toBeCloseTo(isolated.columns[0].advance, 10);`
     (a quarter's intrinsic advance is identical — both 5.2 — independent of
     neighbours). `mixed.columns[4]` is the genuine q→q column (trap R-B).
   - **Do NOT** assert cross-system absolute gaps anywhere (trap R-D; spec
     Out-of-Scope). Add a one-line comment: intrinsic (pre-justify) layer only.

3. **AC9** — `it("lays out an over-full measure blind to the time signature (AC9)")`:
   - `const rh = Array.from({ length: 20 }, () => ({ type:"note", duration:"eighth", pitches:[{step:"C",octave:5}] }));`
   - `const layout = measureLayout(rh, []);`
   - `expect(layout.columns).toHaveLength(20);`
   - Every advance equals the eighth advance:
     `layout.columns.forEach((c) => expect(c.advance).toBeCloseTo(advanceFor(0.5), 10));`
   - Strictly monotonic X: for `i` in 1..19,
     `expect(layout.columns[i].x).toBeGreaterThan(layout.columns[i-1].x);`
   - All finite: `expect(layout.columns.every((c) => Number.isFinite(c.x) && Number.isFinite(c.advance))).toBe(true);`
   - **Ts-blind deep-equal** using the repo `{ beats, beatType }` shape (reviewer
     nit 1):
     ```js
     const a = measureLayout(rh, [], { timeSignature: { beats: 2, beatType: 4 } });
     const b = measureLayout(rh, [], { timeSignature: { beats: 12, beatType: 8 } });
     const bare = measureLayout(rh, []);
     expect(a).toEqual(b);
     expect(a).toEqual(bare);
     ```
   - This is additive to the reused over-full no-throw (`layout.test.js:852`) and
     under-full ts-blind (`:866`) cases — those are NOT modified.

**Depends on.** Task 1 (uses `AC1_EVENTS`; same describe).

**Traces to.** AC4, AC8, AC9, edge D; design §4 (AC4/AC8/AC9 rows), §6 R-B/R-D;
spec R4/R8/R9.

**Acceptance.** Three new `it`s (AC4, AC8, AC9) pass; no cross-system absolute-gap
assertion present; ts-blind uses `{ beats, beatType }`. Full `npm run test:unit`
green (389 total).

---

## TASK 3 — Justification + model-level AC10 tests (AC7, AC10-model)

**Goal.** Add the single `buildLayoutModel` end-to-end justification case (AC7)
and the model-layer half of AC10 — proving the duration→X behavior survives
justify and reaches the post-justify on-screen `note.x`.

**Files.** `src/notation/__tests__/layout.test.js` (same describe).

**Changes.**

1. **AC7** — `it("preserves eighth-vs-quarter ordering and ratio under justification (AC7)")`:
   - Build an 8-measure song of `[8,8,q,q]` measures (each measure single-pitch,
     pitches present), wrapped via a small inline song builder (reuse `songOf`
     pattern but with 8 measures), at width **140** (yields a clean 6+2 split so
     both eighths and both quarters of a measure share that measure's scale):
     ```js
     const measure = {
         rightHand: [
             { type:"note", duration:"eighth",  pitches:[{step:"C",octave:5}] },
             { type:"note", duration:"eighth",  pitches:[{step:"C",octave:5}] },
             { type:"note", duration:"quarter", pitches:[{step:"C",octave:5}] },
             { type:"note", duration:"quarter", pitches:[{step:"C",octave:5}] },
         ],
     };
     const song = { metadata: {}, sections: [{ measures: Array.from({ length: 8 }, () => ({ ...measure })) }] };
     const model = buildLayoutModel(song, 140);
     ```
     Fixture is `[8,8,q,q]` (NOT `[8,8,8,8,q,q]`) so a genuine q→q inter-note gap
     exists at cols 2→3 (trap R-B).
   - Assert the **SHAPE, not the exact scale** (resilience to constant tweaks;
     reviewer nit 2):
     - `expect(model.systems).toHaveLength(2);`
     - `expect(model.systems[0].advanceScale).toBeGreaterThan(1);`
     - `expect(model.systems[0].advanceScale).toBeLessThanOrEqual(MAX_STRETCH);`
       (live ≈ 1.0237; assert range, not the value).
     - last system ragged: `expect(model.systems[model.systems.length-1].advanceScale).toBe(1);`
   - Within system 0, measure 0, RH notes (`model.systems[0].measures[0].right.notes`):
     - eighth gap < quarter gap:
       `const n = ...right.notes;`
       `const eighthGap = n[1].x - n[0].x;`
       `const quarterGap = n[3].x - n[2].x;` (genuine q→q, trap R-B)
       `expect(eighthGap).toBeLessThan(quarterGap);`
     - **ratio preserved under stretch:**
       `expect(quarterGap / eighthGap).toBeCloseTo(advanceFor(1) / advanceFor(0.5), 10);`
       (the uniform scalar cancels — proving the ratio is the intrinsic
       `advanceFor` ratio).
   - **Lead-in unscaled:** `expect(model.systems[0].measures[0].right.notes[0].x).toBe(MEASURE_START_PAD);`
     (1.0 even at scale 1.0237 — the lead-in is added unscaled). Use `toBe`
     (exactly representable).
   - Add a comment: the `systemScale` policy (cap / ragged-last / downscale) is
     locked separately by the reused unit cases (`layout.test.js:1789`); this is
     the one end-to-end ordering+ratio confirmation (design D-Justify, R-E).

2. **AC10 (model half)** — `it("keeps the eighth note.x gaps tighter than the q→q gap end-to-end (AC10)")`:
   - `const model = buildLayoutModel(songOf(AC1_EVENTS), 1000);` (wide ⇒ a
     single ragged system, scale 1; the same six-event canonical fixture).
   - `const notes = model.systems[0].measures[0].right.notes;`
   - `expect(notes).toHaveLength(6);` (guards the pitch-less skip trap R-G — if a
     note were skipped this fails loudly).
   - Leading eighth gap < trailing q→q gap (the `[8,8,8,8,q,q]` array makes the
     LAST gap a genuine q→q, trap R-B):
     `expect(notes[1].x - notes[0].x).toBeLessThan(notes[notes.length-1].x - notes[notes.length-2].x);`

**Depends on.** Task 1 (`AC1_EVENTS`, `songOf`; same describe).

**Traces to.** AC7, AC10 (model); design §3.2, §4 (AC7/AC10 rows), §5 D-Justify,
§6 R-B/R-E/R-G; reviewer nits 1, 2, 3; spec R8/AC10.

**Acceptance.** Two new `it`s (AC7, AC10-model) pass; AC7 asserts shape (not exact
1.0237) and ratio via `advanceFor`, lead-in via `MEASURE_START_PAD`; AC10-model
asserts `notes` length 6 and the leading-eighth < trailing-q→q gap. Full
`npm run test:unit` green (391 total).

---

## TASK 4 — Render/DOM AC10 smoke test (AC10-DOM)

**Goal.** Add the single DOM smoke test honoring the spec's literal "in the
rendered SVG" wording for AC10, locking the `note.x → cx` pass-through against a
future `svg.js` regression.

**Files.** `src/notation/__tests__/svg.test.js` (one new small `describe`,
appended at end of file).

**Changes.**

1. Add `describe("renderSvg — duration-ordered spacing reaches the SVG (issue #21)")`
   (matches the repo's `renderSvg — X` naming). `buildLayoutModel` and
   `renderSvg` are already imported (`svg.test.js:12-13`); add no imports.

2. Inside, **inline** the same six-event single-pitch array (the two test files
   do NOT share fixture imports — `svg.test.js` defines its own song; design
   D-Fixtures):
   ```js
   const events = [
       ...Array.from({ length: 4 }, () => ({
           type: "note", duration: "eighth",
           pitches: [{ step: "C", octave: 5 }],
       })),
       ...Array.from({ length: 2 }, () => ({
           type: "note", duration: "quarter",
           pitches: [{ step: "C", octave: 5 }],
       })),
   ];
   const song = { metadata: {}, sections: [{ measures: [{ rightHand: events }] }] };
   ```

3. **AC10 (DOM half)** — `it("renders eighth noteheads closer together than the quarter noteheads (AC10)")`:
   - `const svg = renderSvg(buildLayoutModel(song, 1000));`
   - Read each notehead `cx` via the repo idiom
     (`#rightHand-note-${i}` → `[data-notehead]` → `getAttribute("cx")`;
     `svg.test.js:310-313`):
     ```js
     const cx = (i) => Number(
         svg.querySelector(`#rightHand-note-${i}`)
            .querySelector("[data-notehead]")
            .getAttribute("cx"),
     );
     ```
   - Single-pitch ⇒ `cx === note.x` (trap R-C avoided). Assert the leading eighth
     `cx` gap < the trailing **q→q** `cx` gap (trap R-B — last two events are the
     quarters):
     `expect(cx(1) - cx(0)).toBeLessThan(cx(5) - cx(4));`
   - Use the DOM-geometry tolerance `toBeCloseTo(_, 6)` only if asserting an
     equality; the inequality above needs no tolerance. (Match the `svg.test.js`
     `toBeCloseTo(_, 6)` idiom if any close-equality is added.)
   - Optionally guard the pitch-less skip trap: assert all six
     `#rightHand-note-${i}` (i=0..5) exist before reading `cx`, so a regression
     that drops notes fails loudly rather than throwing on `null`.

**Depends on.** none (self-contained; mirrors but does not import the Task 1
fixture).

**Traces to.** AC10 (DOM); design §2.4, §3.2, §4 (AC10 row), §6 R-C/R-G; spec
AC10 ("in the rendered SVG"); reviewer nit 3.

**Acceptance.** One new `it` (AC10-DOM) in the new describe; reads `cx` via the
`#rightHand-note-${i}` → `[data-notehead]` selector on a single-pitch fixture;
asserts eighth `cx` gap < q→q `cx` gap. Full `npm run test:unit` green
(392 total).

---

## Final verification (after all four tasks)

- `npm run test:unit` is fully green with **zero source changes** (only
  `layout.test.js` and `svg.test.js` modified). Expected new-test count: **+11**
  (`it`s: AC1, AC2, AC3, AC5, AC6, AC4, AC8, AC9, AC7, AC10-model, AC10-DOM) →
  **392 total** (381 baseline + 11). If any new test fails, the failure is in
  the test (a fixture/matcher/trap mistake), NOT the source — fix the test, do
  NOT edit source; if a source change genuinely seems required, STOP and report
  a blocker to `team-lead` (the design's TEST-ONLY premise would be contradicted).
- `git diff --stat` shows only the two test files changed; no `.rp/` reference in
  shipped tests; no `console.*` in any new test (the jest-console preset would
  auto-fail).
- The Playwright spec (`specs/render.spec.js`) and `npm run test:e2e` are
  untouched.

## AC → Task coverage map

| AC / edge | Seam            | Task |
| --------- | --------------- | ---- |
| AC1       | layout          | 1    |
| AC2 + F   | layout          | 1    |
| AC3       | layout          | 1    |
| AC5       | layout          | 1    |
| AC6       | layout          | 1    |
| AC4 + D   | layout          | 2    |
| AC8 + B   | layout          | 2    |
| AC9       | layout          | 2    |
| AC7 + A   | model           | 3    |
| AC10      | model + DOM     | 3 + 4 |
| edge C    | (AC3)           | 1    |
| edge E    | (AC5)           | 1    |
| edge G    | (AC6)           | 1    |
| empty / malformed | REUSE / upstream | — |
