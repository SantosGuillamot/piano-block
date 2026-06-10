# Design doc research — Attach beamed-note stems to the side of the notehead

Pipeline: `27-beamed-note-stems` (phase 2 — Design doc)
Input spec: `.rp/pipelines/27-beamed-note-stems/1-spec/spec.md`

This is the running record of the design Q&A between the design-doc-analyst
(decisions) and the design-doc-researcher (evidence). Topics are driven one at
a time; each topic records the question, the researcher's evidence, and the
decision taken.

## Topic 1 — beamGeometry internals and the offset insertion point

**Question (analyst):** What is the internal structure of `beamGeometry` in
`src/notation/layout.js`? Specifically: where is the group stem direction
computed; where are `stems[]` records built from raw `m.x`; do the beam
segments' `x1`/`x2` derive from the `stems[]` records or independently from
raw `m.x`; what is the exact returned shape; and is `NOTEHEAD_RX` already
imported in `layout.js`? Goal: identify the minimal edit that shifts stems,
primary/secondary beams, and partial-beam stubs together.

**Evidence (researcher):**

- `beamGeometry` spans `src/notation/layout.js:505-575`. The group direction
  is computed once, before any X is used:
  `const direction = stemDirectionForChord(allSteps);` (layout.js:512).
- There are **four independent readers of the raw member X** — none chains off
  the `stems[]` records:
  1. `stems[].x = m.x` (layout.js:530, stems map at 529-533);
  2. primary beam `x1 = members[0].x`, `x2 = members[last].x`
     (layout.js:540-541);
  3. secondary beams `x1 = members[i].x`, `x2 = members[i+1].x`
     (layout.js:546);
  4. partial-beam stubs `x1`/`x2` = `members[i].x ± stubLen` with
     `stubLen = NOTEHEAD_RX * 1.5` (layout.js:565-568).
  Offsetting only `stems[].x` would detach the beams from the stems; the
  offset must reach all four readers.
- Returned shape (layout.js:564): `{ direction, beamY, stems, beams }` —
  `direction: "up"|"down"`, `beamY: number` (Y only), `stems: {x, y1, y2}[]`,
  `beams: {level, x1, x2, stub?}[]`.
- All helpers (`headStepFor`, `headYFor`, `stemDirectionForChord`,
  `staffStepToY`) are Y-/direction-only; none touches X.
- `NOTEHEAD_RX` is already imported in layout.js (line 55) and already used
  inside `beamGeometry` itself (stub length, line 565). No new import needed.
- `renderBeam` (svg.js:817-832) draws the received X verbatim — no change
  needed there, as the spec requires.
- Researcher recommends shifting the input once rather than patching the four
  X sites individually: compute the signed offset after line 512 and map
  `members` to `shiftedMembers`, letting every downstream reader inherit the
  shift. Y values derive from steps + `STEM_LENGTH` only, so the translation
  is rigid (beam Y, flatness, length unchanged — R2 holds).

**Decision (analyst):** Adopt the **shift-the-input** approach. Immediately
after the direction is computed in `beamGeometry` (layout.js:512), add:

```js
const stemDx = direction === "up" ? NOTEHEAD_RX : -NOTEHEAD_RX;
const shiftedMembers = members.map((m) => ({ ...m, x: m.x + stemDx }));
```

and have the rest of the function body (stems map, primary beam, secondary
beam loop, stub loop — and, for single-variable consistency, the `beamY`
computation, which only reads steps) consume `shiftedMembers` instead of
`members`. Rationale: one definition + one map versus four scattered
`+ stemDx` edits; any future X reader added to the function inherits the
offset automatically; it satisfies R1's "single point" requirement literally,
and R2 falls out as a rigid translation. `renderBeam` stays untouched
(verbatim X), and no import changes are needed since `NOTEHEAD_RX` is already
in scope.

## Topic 2 — Test changes (spec R6)

**Question (analyst):** What does the existing `beamGeometry` test block look
like (fixtures, directions, assertions)? Which exact expectation must be
updated, what is its shifted value, and does anything else in
`layout.test.js`, `svg.test.js`, or the Playwright specs break under the
shift? How do tests import constants, and are there member factories to
follow?

**Evidence (researcher):**

- The `beamGeometry` describe block is `layout.test.js:512-547` and contains
  three tests, **all stem-up** under the extreme rule (steps 1/3 are below
  `MIDDLE_LINE = 4`):
  1. "produces flat horizontal stems to a common beam Y (stem-up)"
     (lines 513-525) — members at x 0 and 4 (steps 1 and 3, beamCount 1);
     asserts `direction === "up"`, flat-beam Y equality, and the primary-beam
     expectation **`expect(geo.beams[0]).toMatchObject({ level: 1, x1: 0,
     x2: 4 })` at line 524 — the one expectation that breaks** and must be
     updated (R6.1). Up-group ⇒ `stemDx = +NOTEHEAD_RX`, so shifted values
     are `x1: 0 + NOTEHEAD_RX`, `x2: 4 + NOTEHEAD_RX`.
  2. "adds a secondary beam only where both notes share it" (lines 527-535) —
     asserts beam **levels only** (`[1, 2]`), no X. Does not break.
  3. "adds a stub for an isolated shorter note" (lines 537-546) — asserts
     stub **existence and level only**, no X. Does not break. For that
     fixture the stub anchors on member i=1 (x 4) toward the previous note;
     under the shift `x2 = 4.6`, `x1 = 3.7`, length unchanged at
     `NOTEHEAD_RX * 1.5 = 0.9`.
- **No stem-down beamGeometry fixture exists anywhere** — the down-group
  coverage required by R6.2 is purely additive (a fixture with steps ≥ 4,
  e.g. `topStep: 6, bottomStep: 6`, yields `direction === "down"`).
- **Nothing else breaks (R6.3 verified):** `beamGeometry` is referenced only
  in `layout.test.js`; `svg.test.js` has zero references to beam/stem
  geometry or the `data-beam`/`data-stem` selectors; the Playwright specs
  assert system counts, reserve counts, re-wrapping, and one standalone
  X-ordering/bounds case — none sensitive to a 0.6 sp beam shift; no
  snapshot/screenshot baselines exist in the repo.
- `NOTEHEAD_RX` is already imported in `layout.test.js` (line 30, constants
  import block); `beamGeometry` is imported at line 39. House style uses
  constant expressions for derived geometry (`MEASURE_START_PAD`, `MIN_ADV`,
  etc.), literals only for raw inputs.
- No member factories exist; tests build inline
  `{ x, topStep, bottomStep, beamCount }` literals.

**Decision (analyst):** The test plan is:

1. **Update** `layout.test.js:524` to
   `expect(geo.beams[0]).toMatchObject({ level: 1, x1: 0 + NOTEHEAD_RX,
   x2: 4 + NOTEHEAD_RX })`, using the constant expression (house style), and
   **extend the same test** with the up-group stem-X assertion
   `expect(geo.stems.map((s) => s.x)).toEqual([0 + NOTEHEAD_RX,
   4 + NOTEHEAD_RX])` plus the level-1 first/last-stem equality
   (`beams[0].x1 === stems[0].x`, `beams[0].x2 === stems.at(-1).x`).
2. **Add** a new stem-down test in the same describe block, inline fixture
   style, e.g. members at x 0 and 4 with `topStep: 6, bottomStep: 6,
   beamCount: 1`; assert `direction === "down"`, stems at
   `[0 - NOTEHEAD_RX, 4 - NOTEHEAD_RX]`, and the level-1 beam matching the
   first/last shifted stem X. This covers R6.2's down-group with the negative
   offset.
3. **Extend** (not rewrite) tests 2 and 3 with the per-kind X assertions the
   spec marks optional, because they directly cover acceptance criterion 3
   and the stub interaction is the subtlest part of the shift: in test 2,
   the level-2 beam spans the shifted X's of the adjacent stems
   (`0 + NOTEHEAD_RX` to `4 + NOTEHEAD_RX` for that fixture); in test 3, the
   stub keeps one endpoint at the shifted stem X (`x2 = 4 + NOTEHEAD_RX`)
   with its length unchanged (`x2 - x1 === NOTEHEAD_RX * 1.5`). Per the
   spec, these use per-kind expectations, never the first/last-stem rule.
4. No changes to `svg.test.js`, `constants.test.js`, or the Playwright
   specs. No imports need to change in `layout.test.js`.

## Topic 3 — Consumer verification and the spec's optional items

**Question (analyst):** Verify end to end that `renderBeam` is the sole
consumer of `beamGeometry`'s X values; confirm `renderBeam` needs zero
changes; confirm R4 holds structurally (shifting a local member copy cannot
move noteheads/ledgers/dots/accidentals/span anchors); and gather the facts
needed to decide the two optional items (overflow assertion, `svg.test.js`
renderBeam coverage).

**Evidence (researcher):**

- **Consumption chain (sole consumer confirmed):** `beamGeometry` is called
  at exactly one site, layout.js:1558 inside `layoutHand`
  (`beams.push({ indices: g.indices, ...beamGeometry(members) })`). The
  record flows verbatim through `layoutHand`'s return (layout.js:1562) into
  the measure models (layout.js:2118-2124) and is read only by the emit loop
  at svg.js:670 (`renderBeam(beam)`). A grep across `src/` for readers of
  `.beams`/`.stems`/`beamY` matches only the producer (layout.js:505-574)
  and `renderBeam` (svg.js:670, 817, 823, 824, 829). Spacing, justification,
  packing, and system breaking never read beam X.
- **renderBeam is a verbatim passthrough (svg.js:813-832):** stems drawn as
  `line(stem.x, stem.y1, stem.x, stem.y2, …)` (line 818); beam segments as
  `rect(segment.x1, top, Math.abs(segment.x2 - segment.x1), …)` (line 828).
  No `note.x` reads, no X arithmetic (all its math is vertical:
  `beamY + offset ± inset`). The width term `|x2 − x1|` is shift-invariant,
  so beam length is unchanged (R2). Zero emit-layer changes needed.
- **R4 holds structurally:** noteheads (incl. displaced, svg.js:728-729),
  ledger lines (svg.js:712-717), accidentals (svg.js:750), dots
  (svg.js:759), and tie/slur/hairpin anchors (layout.js:2443 in
  `recordSpanMarkers`) all position from `note.x`. `beamGeometry` receives a
  freshly built members array (new literals constructed at
  layout.js:1544-1556 from `note.x`/steps/beamCount), and the decided
  `shiftedMembers` map makes a second fresh copy — neither the `notes`
  objects nor the original `members` are mutated, and nothing downstream
  re-reads the shifted array. The only escaping values are the returned
  `stems`/`beams`, consumed solely by `renderBeam`.
- **Overflow slack (optional assertion):** the shift is `NOTEHEAD_RX =
  0.6 sp`. Trailing pad per measure ≈ 0.83 sp (`BARLINE_THIN = 0.13`,
  constants.js:130, + `BARLINE_POST_PAD = 0.7`, constants.js:141; assembled
  at layout.js:1286-1288) and the system-edge inset is `STAFF_MARGIN_X =
  1.5 sp` (constants.js:125; applied at layout.js:1817-1818, 2143-2144).
  Both exceed 0.6 sp, so the shift cannot cross a barline or the staff end.
- **Optional svg.test.js coverage:** `svg.test.js` already has the needed
  jsdom + `buildLayoutModel` + `querySelector('[data-…]')` machinery
  (svg.test.js:12-13, 67, 71-101), so a `[data-beam]` DOM test would be
  cheap — but it would be an integration test, redundant with the
  layout.test.js unit assertions given `renderBeam` is a verified verbatim
  passthrough.

**Decision (analyst):**

1. The single-consumer claim, the verbatim emit layer, and R4 are verified
   with file:line evidence; no design adjustment needed.
2. **Skip the optional overflow assertion.** The slack margins (≈0.83 sp
   trailing, 1.5 sp system edge) comfortably exceed the 0.6 sp shift, the
   spec explicitly marks it not required, and it can be added later if a
   regression guard is ever wanted.
3. **Skip the optional svg.test.js renderBeam DOM test.** Primary coverage
   is the layout.test.js unit assertions (Topic 2); the emit layer is a
   verified passthrough with no X math, so a DOM test adds integration
   redundancy without covering new logic. This keeps the change inside the
   spec's required scope (R6.3: only layout.test.js changes).

## Design summary

The design is complete. The change is:

- **`src/notation/layout.js` — `beamGeometry` (lines 505-575):** immediately
  after `const direction = stemDirectionForChord(allSteps);` (line 512), add

  ```js
  const stemDx = direction === "up" ? NOTEHEAD_RX : -NOTEHEAD_RX;
  const shiftedMembers = members.map((m) => ({ ...m, x: m.x + stemDx }));
  ```

  and switch the remainder of the function body (beamY computation, stems
  map, primary beam, secondary-beam loop, stub loop) to read
  `shiftedMembers` instead of `members`. All four X readers inherit the
  offset; Y values are untouched, so the beam assembly translates rigidly by
  `±NOTEHEAD_RX` (R1, R2). No import changes; `NOTEHEAD_RX` is already in
  scope.
- **`src/notation/svg.js`:** no changes. `renderBeam` already draws the
  received X verbatim.
- **`src/notation/__tests__/layout.test.js`:** update the line-524
  primary-beam expectation to the shifted constant expressions; extend the
  stem-up test with stem-X and first/last-stem assertions; add a new
  stem-down test (steps 6, negative offset); extend the secondary-beam and
  stub tests with per-kind X assertions (adjacent shifted stems; shifted
  anchor with unchanged `NOTEHEAD_RX * 1.5` stub length).
- **Everything else:** unchanged — no edits to `svg.test.js`,
  `constants.test.js`, Playwright specs, editor, PHP, or view bootstrap, and
  no optional overflow or DOM tests.

This satisfies spec requirements R1-R6 and all eight acceptance criteria.
