# Design research — Issue #21: Space notes horizontally according to their duration

Status: COMPLETE — design Q&A with design-doc-researcher done (Q1–Q3). See "FINAL DESIGN
(for the design-doc-writer)" at the end for the seam map, per-AC test matrix, files/structure,
matcher policy, source-change verdict (NONE — test-only), CI integration, and risks/trade-offs.

## Framing (carried from spec.md + spec-research.md)

Duration-ordered horizontal spacing is ALREADY implemented and wired end-to-end
(`src/notation/layout.js` `advanceFor`/`measureLayout` → `note.x` → `src/notation/svg.js`).
Issue #21 is a VERIFY/LOCK task. The deliverable is regression tests that pin the
accepted ordinal behavior across AC1–AC10 and edge cases A–G. The likely PR is
TEST-ONLY with no behavioral source change. Acceptance criteria are ORDINAL
(ordering / equality), never invented pixel ratios. Strict proportionality is OUT
(deliberately designed against). The compressive model + constants are frozen.

This design must decide HOW to verify and lock: test layers, files/locations,
naming, fixtures, the exact ordinal assertions per AC, robust assertion style
(tolerances / equality), whether any source change is needed, runner/CI
integration, and risks/trade-offs.

## Pre-read of the codebase (design-doc-analyst, before Q&A)

Test runner / framework:
- `package.json`: `test:unit` = `wp-scripts test-unit-js` (Jest via @wordpress/scripts;
  jsdom env — confirmed by `src/notation/__tests__/svg.test.js` asserting DOM directly).
  `test:e2e` = `wp-scripts test-playwright` (Playwright, `specs/*.spec.js`).
- Jest matchers in use: `toBe`, `toEqual`, `toMatchObject`, `toBeCloseTo(value, digits)`,
  `toBeGreaterThan`, `toBeLessThan`, `not.toThrow`, `Number.isFinite`/`Number.isNaN` guards.

Test conventions in `src/notation/__tests__/layout.test.js` (PURE layout layer):
- DOM-free plain-data fixtures in staff-space (sp) units; named-import the function under test.
- `describe("<fn or topic>")` / `it("<behavior>")`; ordinal + numeric-with-tolerance assertions.
- Existing duration-spacing coverage is the FORMULA + monotonic X only:
  - `advanceFor (compressive spacing)` (layout.test.js:748) — `MIN_ADV + ADV_K·sqrt(Δ)`,
    whole:32nd ratio in (2,3), NaN-safe negative Δ, `extra` widens.
  - `measureLayout` (layout.test.js:777) — union grid, per-onset monotonic X, finite width,
    `measureEnd = max(handEnds)`, NEVER consults timeSignature (a==b across two time sigs),
    leadingPad/trailingPad/columnExtra effects, overflow no-throw/no-NaN (20 eighths).
  - `packSystems + systemScale` (layout.test.js:1759) — last system ragged
    (`systemScale(_, _, {isLast:true})` → advanceScale 1); interior justified to availSp/contentSp,
    capped at MAX_STRETCH; over-wide → downscaleFactor<1.
  - `buildLayoutModel — the full positioned-primitive model` (layout.test.js:1816) — full
    song → systems/bands/reserve/measures; COMPREHENSIVE_SONG fixture (layout.test.js:931).
  GAP: NO test asserts the mixed-duration ordinal scenarios (AC1, AC3–AC9) nor render-level (AC10).

Render-level (DOM) conventions in `src/notation/__tests__/svg.test.js`:
- `buildLayoutModel(song, width)` → `renderSvg(model)` → query the SVG DOM.
- Per-note: `renderNote` (svg.js:704) stamps `data-kind="note"`, `data-hand`, `data-event-index`,
  and a notehead child with `data-notehead` carrying `cx` (svg.js:730-738). Existing test
  `places a per-event note's X at its event's notehead column X` (svg.test.js:304) already reads
  a notehead's `cx`. Measure `<g data-measure>` carries `transform="translate(measure.x 0)"`
  (svg.js:518) — X-only — so noteheads in ONE measure share a frame and their `cx` are directly
  comparable (no per-note translate to undo). System `<g>` adds `translate(0 y) scale(factor)`
  (svg.js:293) but within a single system+measure the relative X ordering/ratios are clean.

## Q&A log

### Q1 — Test infra, seams, and per-AC assertion entry points (ANSWERED)

Asked the researcher to RUN the production path and report concrete shapes/values so
each AC's assertion target could be pinned, plus verify the test runner.

Findings (researcher, empirically verified by running the live code + the suite):

TEST INFRA
- Unit: `npm run test:unit` = `wp-scripts test-unit-js` → Jest 29, jsdom env, babel
  transform. 6 suites, 381 tests, ~1.5s. Ran in the worktree (needed `npm install`
  first — node_modules wasn't present; now installed); ALL 381 pass against current
  code with ZERO source changes → confirms #21's test-only premise.
- E2e: `npm run test:e2e` = Playwright + wp-env (Docker, real WP) = `specs/render.spec.js`.
  Heavyweight (build + env:start). NOT the home for the spacing locks (overkill, brittle
  for ordinal spacing).
- HARD CONVENTION: the preset enables `@wordpress/jest-console` — ANY `console.log/warn/
  error` in a test auto-FAILS it. New tests must not log.

TWO SEAMS (both pure-data, both Jest/jsdom, no wp-env):
1. LAYOUT level (primary): `src/notation/layout.js` exports `advanceFor`, `measureLayout`,
   `eventDuration`, `handOnsets`, `unionGrid`, `systemScale`, `buildLayoutModel` — all
   already imported by `src/notation/__tests__/layout.test.js`. `measureLayout(rh, lh, opts)`
   returns `{ grid, columns:[{onset,x,advance}], measureEnd, contentWidth, width, hands }`.
   Home for AC2/AC3/AC4/AC5/AC6/AC9 (+ intrinsic AC8). Analyst-confirmed in source:
   column object is literally `{ onset, x, advance }` at layout.js:846, with
   `advance = advanceFor(next - onset, { extra: columnExtra[i] ?? 0 })` (layout.js:845).
   So `columns[i].advance` IS the per-column gap — no need to subtract X positions.
2. MODEL/INTEGRATION level (for AC10 + AC1-in-context + AC7): `buildLayoutModel(song, widthSp)`
   → `model.systems[i].measures[j].right.notes[].x` (and `.left.notes[].x`). Plain data,
   but IS the post-justify on-screen X that flows VERBATIM into svg.js (svg.js renders
   note.x with no spacing math). Asserting on it satisfies AC10's "reaches the screen"
   WITHOUT wp-env. Analyst-confirmed: `note.x = columnX.get(onset)` (layout.js:1453),
   `columnX` built as `cx += col.advance * advanceScale` (layout.js:2040), leadInset
   (MEASURE_START_PAD/openingClearance) added UNscaled (layout.js:2024-2037).

KEY MODEL FACTS
- Constants: MIN_ADV=2.2, ADV_K=3.0. `advanceFor(Δ)=MIN_ADV+ADV_K·sqrt(max(Δ,0))+max(extra,0)`
  (layout.js:778). BASE_DUR whole4/half2/quarter1/eighth.5/16th.25/32nd.125; DOT_MUL {0:1,1:1.5,2:1.75}.
- A note's gap = Δ to NEXT onset = its OWN duration (R2). measureEnd=max(handEnds) drives
  the last column's Δ.
- Chord footprint (AC5): onset advance is duration-only; pitch count never enters
  handOnsets/unionGrid/advanceFor. (Analyst: `buildLayoutModel` calls `measureLayout`
  with ONLY `trailingPad`, NO `columnExtra` — layout.js:1757-1759 — so flag/accidental
  clearance does NOT perturb per-column advances at the model level; eighth gaps stay
  EXACTLY equal end-to-end.)
- Justify (AC7): `systemScale(contentSp, availSp, {isLast})` → {advanceScale, downscaleFactor};
  advanceScale = clamp(avail/content, 1, MAX_STRETCH=1.6); last system & overflow → 1.
  buildLayoutModel multiplies every column advance by advanceScale uniformly →
  ordering + ratio survive. leadInset added UNscaled (AC7 "lead-in not stretched").

VERIFIED NUMBERS (exact, live formula)
- advance: 32nd 3.2607 < 16th 3.7000 < eighth 4.3213 < quarter 5.2000 < half 6.4426 <
  whole 8.2000 (AC2 strict-monotonic; 16th≠32nd → floor never ties, edge F).
- dotted-quarter 5.8742 ∈ (quarter 5.2, half 6.4426) (AC3).
- whole/32nd = 2.515 (compressive); quarter/eighth = 1.2033 (accepted ~1.2:1 contrast).
- AC1 `[8,8,8,8,q,q]`: measureLayout grid=[0,.5,1,1.5,2,3], measureEnd=4,
  column advances=[4.3213×4, 5.2, 5.2]. SUBTLETY: the last-eighth→first-quarter gap
  (onset1.5→2) is ALSO 4.3213 — governed by the eighth's OWN Δ=0.5, not the quarter.
  → AC1 must compare the four eighth-LED gaps vs the quarter→quarter gap (cols 4→5),
  exactly as the spec words it. This shapes the assertion (see Decisions).
- AC10 via buildLayoutModel(AC1_SONG, 1000): one system, advanceScale=1, RH note
  Xs=[1.000,5.321,9.643,13.964,18.285,23.485] (first X=1.0=MEASURE_START_PAD),
  gaps=[4.321,4.321,4.321,4.321,5.200].
- AC7 via buildLayoutModel(8 measures of [8,8,q], width 120): 2 systems,
  advanceScale=[1.151 (non-last, stretched ≤1.6), 1.000 (last, ragged)].

DECISIONS LOCKED FROM Q1
- D1. Two test seams, both in Jest/jsdom, NO Playwright: layout-level (`measureLayout`/
  `advanceFor`/`eventDuration`) for the per-duration ordinal ACs; model-level
  (`buildLayoutModel` note.x) for the render-reaching AC (AC10) + justification (AC7).
  Rationale: both are pure-data and fast; the Playwright spec is brittle/heavyweight and
  the model note.x IS the verbatim on-screen X, so it proves "reaches the screen" without
  the e2e cost. (AC10-layer choice — model note.x vs actual SVG DOM cx — is Q2.)
- D2. Home file: `src/notation/__tests__/layout.test.js` (where every needed export is
  already imported and the `advanceFor`/`measureLayout`/`buildLayoutModel` describe-blocks
  already live). AC10 may live in layout.test.js (model note.x) or svg.test.js (SVG cx)
  per Q2's outcome.
- D3. `columns[i].advance` is the canonical layout-level gap target (not X subtraction).
  At the model level, gaps are `notes[i+1].x − notes[i].x`.
- D4. No `console.*` in any new test (jest-console auto-fails).
- D5. AC1 assertion compares the four eighth-LED column gaps (mutually equal) against the
  quarter→quarter gap — NOT the boundary eighth→quarter gap (which is also an eighth gap).

### Q2 — AC10 layer fidelity, equality-assertion policy, per-AC targets (ANSWERED)

Asked the researcher to verify model.x↔DOM-cx equivalence (to decide AC10's home), the
matcher convention, and the remaining edge-case numbers (AC9/AC5/empty). The reply
elaborated the full per-AC target table with live values.

Q2a — model note.x IS a faithful proxy for the rendered SVG (for single-pitch notes):
- RAN `renderSvg(buildLayoutModel(AC1_SONG, 1000))`: six notehead cx =
  [1, 5.3213, 9.6426, 13.9640, 18.2853, 23.4853]; gaps = [4.3213×4, 5.2000]. These EQUAL
  the model `notes[].x` verbatim (incl. leading 1.0 = MEASURE_START_PAD).
- Mechanism (analyst-confirmed in svg.js): `cx = note.x + (head.displaced ? dx*2 : 0)`
  (svg.js:730). A SINGLE-PITCH note has one, never-displaced head → cx === note.x EXACTLY.
  A chord's back head is displaced by dx*2 = ±2·NOTEHEAD_RX (~±1.2 sp), which would skew a
  raw-cx comparison → use SINGLE-PITCH notes for any cx-based fixture (AC10, AC5-render).
- All six noteheads live in ONE `<g data-measure transform="translate(measure.x 0)">`
  (svg.js:518) → same frame; the X-only measure translate doesn't affect inter-note cx
  deltas anyway.
- Robust DOM selector (stable id, event-ordered):
  `svg.querySelector('#rightHand-note-'+i).querySelector('[data-notehead]').getAttribute('cx')`
  for i=0..5 (note `<g id="rightHand-note-${eventIndex}">` svg.js:708-709; head `[data-notehead]`
  svg.js:738). A bare `querySelectorAll('[data-notehead]')` is document=event order here too
  (one head each), but the id form is unambiguous.

Q2b — matcher convention (analyst-corroborated by grepping the suite):
- Strict ordering ("<"/">"): `toBeLessThan` / `toBeGreaterThan`, NO tolerance. This is the
  dominant idiom — 100 occurrences in layout.test.js. Use for AC1 (eighth<quarter), AC2 chain,
  AC3 between, AC4 (half-rest>eighth-rest), AC9 monotonic X, edge F (16th>32nd).
- "Equal gaps" (deterministic float products, e.g. four advanceFor(0.5)): `toBeCloseTo(ref, 10)`.
  Repo uses 10-digit precision for tight arithmetic equality (24 occurrences; e.g.
  layout.test.js:751,773,888,910). Avoids float-equality flakiness without inventing ratios.
  Use for AC1 four-eighth equality, AC6 N−1 equal gaps. (Exact `toBe` is reserved for clean
  integers/constants like `advanceScale: 1`.)
- DOM cx equality / geometry: `toBeCloseTo(_, 6)` (50 occurrences; the svg.test.js DOM idiom,
  e.g. svg.test.js:317,343). Use for AC10 if asserting at DOM level.
- AC7 ratio under justify: assert the RATIO is preserved (`quarterGap/eighthGap` close to the
  unscaled ratio via `toBeCloseTo(ratio, 10)`) — robust to the scale value; do NOT hardcode a
  pixel gap. (Detail of pre/post form deferred to Q3.)

Q2c — per-AC LAYOUT/MODEL targets, all with live values:
- AC2 → `advanceFor` 6-way strict chain: 3.2607 < 3.7000 < 4.3213 < 5.2000 < 6.4426 < 8.2000.
  Edge F: advanceFor(0.25)=3.7000 > advanceFor(0.125)=3.2607 (floor never ties — MIN_ADV is a
  constant added to a strictly-increasing sqrt term).
- AC3 → `advanceFor(eventDuration({duration:'quarter',dots:1}))` = advanceFor(1.5) = 5.8742,
  strictly between advanceFor(1)=5.2 and advanceFor(2)=6.4426. Recommend the eventDuration form
  (self-documents the dotted arithmetic). Signatures: `advanceFor(delta,{extra=0}={})`
  (layout.js:778), `eventDuration(event)`= `(BASE_DUR[duration]??0)*(DOT_MUL[dots??0]??1)`
  (layout.js:361-365).
- AC4 → BOTH: `advanceFor` value (half-rest Δ=2 → 6.4426 > eighth-rest Δ=0.5 → 4.3213) AND a
  small `measureLayout([half-rest, eighth-rest],[])` case proving rests enter the grid
  (col0.advance > col1.advance; handOnsets/handEnd count rests, layout.js:715-723).
- AC1 → `measureLayout` columns[].advance: cols 0–3 all 4.3213 (equal), col4 (q→q) = 5.2.
- AC5 → `measureLayout`, NOT advanceFor (advanceFor has no head param → vacuous there).
  Proof: `measureLayout([{quarter,1 pitch},{quarter}],[])`.columns[0].advance ===
  `measureLayout([{quarter,3 pitches},{quarter}],[])`.columns[0].advance → both 5.2000; grids
  identical. (Pitch count never enters handOnsets/unionGrid/advanceFor.)
- AC6 → `measureLayout` N equal notes → N−1 equal advances (4 quarters → [5.2,5.2,5.2]).
- AC9 → `measureLayout` 20 eighths: 20 cols, all advance=4.3213, X strictly monotonic, finite;
  ts-blind via the `a===b` deep-equal across two time signatures.
- AC7/AC8 → buildLayoutModel (post-justify) / measureLayout intrinsic advance — Q3 detail.
- AC10 → buildLayoutModel→renderSvg cx (single-pitch AC1 fixture, id query): cx[1]−cx[0]
  (eighth) < cx[5]−cx[4] (quarter).

DECISIONS LOCKED FROM Q2
- D6. AC10 = a PAIR (belt-and-suspenders, both cheap jsdom, no wp-env):
  * PRIMARY at MODEL level (`buildLayoutModel` → `measures[0].right.notes[].x`): eighth note.x
    gap < quarter note.x gap. note.x IS the on-screen X (proven cx===note.x for plain notes).
  * ONE DOM smoke test (`renderSvg` → cx via `#rightHand-note-${i}` → `[data-notehead]` → cx):
    eighth cx gap < quarter cx gap. Honors the spec's literal "in the rendered SVG" wording AND
    locks the note.x→cx pass-through (guards a future svg.js regression that divorces cx from
    note.x). The DOM test alone satisfies AC10; the pair matches svg.test.js's
    buildLayoutModel→renderSvg→query idiom. Both use a SINGLE-PITCH `[8,8,q,q]`/`[8,8,8,8,q,q]`
    fixture so cx===note.x (no chord displacement). DOM test lives in svg.test.js; model test in
    layout.test.js (or co-located in the #21 describe — see D13).
  (Rationale for the change from a DOM-only lean: the researcher proved note.x===cx exactly for
  plain notes, so the model assertion is faithful AND faster; the DOM test is retained to honor
  the wording and guard the pass-through — strictly better than either alone.)
- D7. Matcher policy (matches the repo, surveyed): `toBeLessThan`/`toBeGreaterThan` for ALL strict
  orderings (no tolerance). `toBeCloseTo(_, 10)` for derived sp arithmetic equality (advances are
  sqrt-irrational, e.g. 4.3213203… — NEVER `toBe`; precision 10 is the measureLayout/advanceFor
  block idiom). `toBeCloseTo(_, 6)` for DOM cx (the svg.test.js geometry idiom). `toEqual` for
  EXACT grids/onsets (`[0,0.5,1,…]` are exact-representable). Ratios (AC7) via `toBeCloseTo(_,10)`.
  No invented pixel ratios anywhere.
- D8. AC5 proven at `measureLayout` (chord-quarter vs single-quarter → identical col advance &
  grid); render-level chord proof avoided (displaced back-head skews cx).
- D9. AC5/AC10 fixtures use single-pitch notes deliberately (chord only where AC5 needs the
  multi-pitch column, and there at the measureLayout/onset-grid level, not cx).

### Q3a — AC7/AC8 detail (ANSWERED, live numbers)

FIXTURE-CONSTRUCTION CAVEAT (researcher hit it; analyst confirms it generalizes the AC1
subtlety): to read an on-screen "quarter→quarter X gap" between rendered notes, the quarter
must NOT be the measure's LAST note (the last column gaps to measureEnd; an inter-note X-delta
is governed by the LEFT note's own Δ). Use `[eighth, eighth, quarter, quarter]` so cols 2→3 is
a genuine quarter→quarter X gap. (Pure `advanceFor(Δ)` chains — AC2/AC3 — are Δ-indexed and
don't hit this; it only bites when reading X-deltas between rendered notes / model note.x.)

AC7 — ordering + ratio survive justification:
- Fixture: 8 measures of `[8,8,q,q]` single-pitch, `buildLayoutModel(song, 140)` → 2 systems.
  - System 0 (NON-last, justified): `advanceScale = 1.02367` (>1, ≤ MAX_STRETCH 1.6);
    eighthGap 4.4236, quarterGap 5.3231 → eighth<quarter; ratio = 1.2033359220.
  - System 1 (LAST, ragged): `advanceScale = 1` exactly; eighthGap 4.3213, quarterGap 5.2000;
    ratio = 1.2033359220.
  - intrinsicRatio advanceFor(1)/advanceFor(0.5) = 1.2033359220 — IDENTICAL across stretched
    system, ragged system, and bare formula (stretch is one scalar → ratio invariant).
  - firstColX = 1.0 in BOTH systems = MEASURE_START_PAD, UNSCALED even when stretched
    (leadInset added unscaled layout.js:2032; only `col.advance*advanceScale` layout.js:2040).
- Model path (analyst-confirmed): per-system fields ARE exposed — `model.systems[i].advanceScale`
  and `.downscaleFactor` (layout.js:2138-2147; existing test reads `systems[0].downscaleFactor`
  at layout.test.js:1858). So AC7 asserts these directly, no reverse-engineering.
- RECOMMENDED AC7 assertions: (a) system[0].advanceScale > 1 AND ≤ MAX_STRETCH; (b) last
  system.advanceScale === 1; (c) within system[0] eighthGap < quarterGap; (d) ratio
  (quarterGap/eighthGap) of system[0] toBeCloseTo that of the ragged last system (both =
  advanceFor(1)/advanceFor(0.5)); (e) firstColX equal in both systems (lead-in not stretched).
- Researcher's split recommendation (adopted): test BOTH layers —
  * `systemScale()` PURE UNIT cases (fixture-free policy lock): `systemScale(10,16,{})`→
    advanceScale 1.6 (capped); `systemScale(10,12,{})`→1.2; `systemScale(10,12,{isLast:true})`→1;
    `systemScale(20,10,{})`→{advanceScale:1, downscaleFactor:0.5}. (Some of this is already
    covered by layout.test.js:1789-1813 — see Q3c for the precise gap.)
  * ONE `buildLayoutModel` end-to-end case (integration: ratio preserved + lead-in unscaled).

AC8 — equal intrinsic advance across measures:
- Cleanest at `measureLayout` (pre-justify/intrinsic): an eighth's `col.advance` = 4.3213
  regardless of surrounding notes or which measure (verified: eighth in `[8,8]` vs eighth in
  `[q,8,half]` both 4.3213). Assert two DIFFERENT measures (different neighbours), same
  duration → identical intrinsic advance.
- CAUTION (spec Out-of-Scope + edge B): do NOT assert equal ABSOLUTE gaps ACROSS systems —
  system 0 eighthGap 4.4236 ≠ system 1 eighthGap 4.3213 (independent advanceScale). AC8 stays at
  the intrinsic (measureLayout) layer. (Within ONE system, equal intrinsic advances DO render
  equal — eighth X-gap measure0 == measure1 == 4.4236 — but that's a within-system corollary,
  not the cross-system assertion.)

DECISIONS LOCKED FROM Q3a
- D10. Justify ACs split across three layers: `systemScale` pure unit (policy: cap, ragged-last,
  downscale), `measureLayout` (AC8 intrinsic equality), `buildLayoutModel` (AC7 end-to-end ratio
  + unscaled lead-in via `systems[i].advanceScale`/firstColX).
- D11. AC7/AC10/cross-note fixtures use `[8,8,q,q]` (or `[8,8,8,8,q,q]`) so a true q→q inter-note
  gap exists; never read the last column as an inter-note gap.
- D12. AC8 asserted at intrinsic (measureLayout) layer only; cross-system absolute-gap equality is
  explicitly NOT asserted (spec Out-of-Scope).

### Q3b — Test-file organization, naming, fixtures (RESOLVED, analyst evidence + researcher idiom)

Analyst-confirmed from the repo (greps):
- AC-id naming convention: TRAILING `(ACn)` suffix on `it(...)` titles. Precedent:
  svg.test.js:1150 `… (AC4)`, :1186 `(AC7)`, :1222 `(AC8)`; specs/render.spec.js & editor.spec.js
  use the same `(ACn)` style. No precedent for a raw `#21` in a test title; issue numbers appear
  only in commit messages / code comments, NOT test titles. → New tests use `(AC1)`…`(AC10)`
  suffixes; the issue may be named in the DESCRIBE title and a leading file comment, not in it()s.
- Describe organization: the repo mixes function-grouped describes (advanceFor, measureLayout,
  buildLayoutModel) with FEATURE-grouped describes for a cohesive feature (e.g. svg.test.js
  `renderSvg — hairpin wedges` groups (AC4)/(AC7)/(AC8) hairpin ACs in one describe; layout.test.js
  `layout-polish fixes` :2043 groups a themed batch). The hairpin block is the closest precedent
  for a feature's AC matrix.
- Fixture-helper idiom EXISTS: `songWithNotes(notes)` (layout.test.js:1463, svg.test.js:108),
  `songWithHandNotes({right,left})` (svg.test.js:173), `songWith({...})` (layout.test.js:2341) —
  small closures wrapping events into a one-measure song. svg.test.js:108-126 is the canonical
  shape (one section, one measure, rightHand events with pitches).

DECISIONS LOCKED FROM Q3b
- D13. Organization: ONE dedicated feature-grouped describe per file, mirroring the hairpin block.
  In `layout.test.js`: `describe("duration-ordered horizontal spacing (issue #21)")` holding the
  layout/model ACs (AC1, AC2+F, AC3, AC4, AC5, AC6, AC7-model, AC8, AC9, AC10-model). In
  `svg.test.js`: the single AC10 DOM smoke test, in its own
  `describe("renderSvg — duration-ordered spacing reaches the SVG (issue #21)")` (matches the
  "renderSvg — X" naming) or appended to an existing render describe. The issue-number-in-describe
  is in-style (cf. layout.test.js:3656 section comment "(#13: …)"). Rationale: keeps the #21 lock
  reviewable as a unit
  and self-documenting, matching house style; the function-grouped blocks already exist for the
  formula-level facts and we are not duplicating those.
- D14. it()-title naming: behavior-first sentence + trailing `(ACn)`, e.g.
  `it("spaces equal eighth columns equally and tighter than the quarter column (AC1)")`. Issue #21
  named in the describe title + a leading block comment, never in an it() title.
- D15. Fixtures: define the canonical events ONCE as a const (researcher's suggested name
  `AC1_EVENTS` = four eighths + two quarters, single-pitch) + a tiny helper mirroring the existing
  `songWithNotes`/`modelFor` idiom (researcher's suggested name `songOf(events)` =
  `{ metadata:{}, sections:[{ measures:[{ rightHand: events }] }] }`). Then AC1 uses
  `measureLayout(AC1_EVENTS, [])` and AC10-model uses `buildLayoutModel(songOf(AC1_EVENTS), 1000)`.
  Single source of truth; no divergence between layout and render assertions.
  CRITICAL: fixture events MUST carry `pitches` — a pitch-less note is SKIPPED in layoutHand
  (layout.js:1471), so it would never render (breaks AC10). measureLayout ignores pitches, so the
  same pitch-carrying array works at both layers. The svg.test.js AC10-DOM case inlines the same
  six-event array (the test files don't share fixture imports; svg.test.js defines its own SONG).

### Q3c — NEW vs REUSE scope (RESOLVED, researcher Q2c + analyst greps)

Precise gap analysis (each existing test + what it leaves uncovered):
- Empty measure — FULLY covered by layout.test.js:841 (grid=[], columns=[], contentWidth===
  EMPTY_MEASURE_WIDTH, finite width). → REUSE / reference; NO new test. (Optional one-line
  cross-reference comment in the #21 block; a duplicate would be redundant.)
- ts-blindness — layout.test.js:866 deep-equals two sigs but only for 6 eighths (UNDER-full at
  4/4). AC9 wants ts-blindness on an OVER-full measure → the over-full variant is ADDITIVE.
- Over-full no-throw — layout.test.js:852 (20 eighths) asserts only not-throw / 20 columns /
  finite x+width. It does NOT assert "all advances == the eighth advance" nor "strictly monotonic
  X". → those spacing-ordering assertions are NEW for AC9.
- systemScale policy — layout.test.js:1789-1813 covers isLast→advanceScale 1, interior capped at
  MAX_STRETCH, and downscale<1 (over-wide). This FULLY covers the AC7 POLICY layer; #21 adds NO
  new systemScale unit cases — only the ONE `buildLayoutModel` end-to-end AC7 case (ratio
  preserved across stretched vs ragged systems + lead-in unscaled), which is NEW (no existing test
  asserts the ratio invariance end-to-end).
- compressive ratio sanity — layout.test.js:756-760 already asserts whole/32nd ∈ (2,3). AC2's
  strict 6-way chain (32nd<16th<…<whole) is NEW (existing only bounds the extreme ratio).

DECISIONS LOCKED FROM Q3c
- D16. NEW tests (in the #21 describe): AC1, AC2(+edge F 16th>32nd), AC3, AC4 (value + grid
  participation), AC5 (measureLayout chord-vs-single; optional model corollary), AC6, AC7
  (buildLayoutModel end-to-end ratio; systemScale policy is REUSED), AC8 (measureLayout intrinsic),
  AC9 (20 eighths: all advances ≈ advanceFor(0.5), strict-mono X, finite + OVER-FULL ts-blind
  deep-equal), AC10 (model note.x + DOM cx smoke).
- D17. REUSE / reference (no new test): empty measure (841); the systemScale policy unit cases
  (1789-1813); the basic under-full ts-blindness (866) and basic over-full no-throw (852) remain
  as-is — AC9 adds the spacing-ordering + over-full-ts-blind assertions ALONGSIDE them, not as
  replacements.
- D18. Edge F (floor never ties) folded into AC2: assert advanceFor(0.25) > advanceFor(0.125)
  (3.7000 > 3.2607) within the AC2 chain — no separate test.

## FINAL DESIGN (for the design-doc-writer)

### Verdict
- SOURCE CHANGE REQUIRED: NONE. All 381 existing tests pass against current code with zero
  source edits; every AC is satisfied by the live formula/model. #21 is a TEST-ONLY PR (plus the
  optional/additive docs note, which is a separate later phase, not required). Definition of done:
  the duration-ordered spacing behavior is specified as accepted and regression-locked by tests at
  the layout + model + render layers; the suite stays green.

### Test layers (the seam map)
- LAYOUT (pure data, `layout.test.js`): `advanceFor(Δ)`, `eventDuration(event)`, `measureLayout(rh,
  lh, opts)` → `columns[].advance`. Carries AC1, AC2(+F), AC3, AC4, AC5, AC6, AC8, AC9.
- MODEL/INTEGRATION (pure data, `layout.test.js`): `buildLayoutModel(song, widthSp)` →
  `systems[i].advanceScale`, `systems[i].measures[j].right.notes[].x`. Carries AC7 (justify ratio +
  unscaled lead-in) and AC10-model.
- RENDER/DOM (jsdom, `svg.test.js`): `renderSvg(model)` → notehead `cx` via
  `#rightHand-note-${i}` → `[data-notehead]`. Carries the AC10 DOM smoke test.
- NO Playwright/wp-env: ordinal spacing is fully provable at the three pure/jsdom seams; the e2e
  spec is heavyweight and brittle for this. (specs/render.spec.js untouched.)

### Per-AC test matrix (target / fixture / assertion / live value)
- AC1 — `measureLayout([8,8,8,8,q,q], [])` (single-pitch). cols 0–3 `.advance` mutually equal
  (`toBeCloseTo(_,10)`, = 4.3213) and each `toBeLessThan` col4 `.advance` (q→q = 5.2). grid
  `toEqual([0,0.5,1,1.5,2,3])`. (Compare eighth cols vs col4, NOT col3→col4.)
- AC2 — `advanceFor` chain: advanceFor(0.125)<.(0.25)<.(0.5)<.(1)<.(2)<.(4) via `toBeLessThan`
  (3.2607<3.7000<4.3213<5.2000<6.4426<8.2000). Edge F is the first link (16th>32nd).
- AC3 — `advanceFor(eventDuration({duration:'quarter',dots:1}))` (=advanceFor(1.5)=5.8742):
  `toBeGreaterThan` advanceFor(1)=5.2 AND `toBeLessThan` advanceFor(2)=6.4426.
- AC4 — value: advanceFor(2)=6.4426 `toBeGreaterThan` advanceFor(0.5)=4.3213; grid participation:
  `measureLayout([{rest,half},{rest,eighth}], [])`.columns[0].advance `toBeGreaterThan` columns[1].advance.
- AC5 — `measureLayout([{quarter,3 pitches C-E-G},{quarter}], [])`.columns[0].advance `toBeCloseTo`
  `measureLayout([{quarter,1 pitch},{quarter}], [])`.columns[0].advance (both 5.2); grids `toEqual`.
- AC6 — `measureLayout([q,q,q,q], [])`: columns[0..2].advance all `toBeCloseTo(_,10)` equal (5.2);
  i.e. N−1 equal gaps.
- AC7 — `buildLayoutModel(8×[8,8,q,q], 140)` → 2 systems (verified width 140 gives a clean 6+2
  split; both eighths AND both quarters land in one measure so they share that measure's scale).
  `systems[0].advanceScale` `toBeGreaterThan` 1 AND `toBeLessThanOrEqual` MAX_STRETCH (live 1.0237);
  last `systems[len-1].advanceScale` `toBe(1)` (ragged); within system 0 measure 0 eighth note.x gap
  `toBeLessThan` quarter note.x gap (4.4236 < 5.3231); ratio(quarterGap/eighthGap) of system 0
  `toBeCloseTo(advanceFor(1)/advanceFor(0.5), 10)` (= 1.2033359220 — proves ratio preserved under
  stretch); lead-in unscaled: `systems[0].measures[0].right.notes[0].x` `toBe(MEASURE_START_PAD)`
  (1.0 even at scale 1.0237). Assert the SHAPE (non-last>1, last===1, ratio preserved), NOT the exact
  scale number, for resilience to constant tweaks. (systemScale policy cap/ragged/downscale REUSES
  layout.test.js:1789-1813; #21 adds only this end-to-end ordering+ratio case.)
- AC8 — intrinsic, one-liner: `measureLayout([q,q], [])`.columns[0].advance `toBeCloseTo(_,10)`
  `measureLayout([8,8,8,8,q,q], [])`.columns[4].advance (both 5.2) — a quarter's intrinsic advance is
  5.2 regardless of measure/neighbours. (Alt: an eighth in `[8,8]` vs in `[q,8,half]` both 4.3213.)
  Use toBeCloseTo for consistency (5.2 is exact, but match the other advance assertions). Do NOT
  assert cross-system absolute gaps (live: system0 eighthGap 4.4236 ≠ system1 4.3213 — correctly
  unequal; spec Out-of-Scope + edge B).
- AC9 — `measureLayout(20×eighth, [])`: 20 columns; every `.advance` `toBeCloseTo(_,10)` advanceFor(0.5)
  (4.3213); X strictly monotonic (each c.x > prev); all finite; ts-blind:
  `measureLayout(20×eighth, [], {timeSignature:{2,4}})` `toEqual` `…{timeSignature:{12,8}}` `toEqual` bare.
- AC10 — model: `buildLayoutModel(songOf(AC1_EVENTS), 1000)`.systems[0].measures[0].right.notes:
  (notes[1].x−notes[0].x) `toBeLessThan` (notes[len-1].x−notes[len-2].x) — eighth gap < q→q gap
  (use the [8,8,8,8,q,q] array so the last gap is a genuine q→q). DOM smoke (svg.test.js):
  cx via `#rightHand-note-${i}` → `[data-notehead]`, eighth cx gap `toBeLessThan` quarter cx gap.
  Single-pitch fixture (cx===note.x).

### Files & structure
- `src/notation/__tests__/layout.test.js`: NEW
  `describe("duration-ordered horizontal spacing (issue #21)")` with a leading block comment
  (intent: lock the accepted ordinal duration spacing; no source change). it() titles behavior-first
  + `(ACn)`. A local `songOf(events)` helper (mirrors `songWithNotes`) + a canonical `AC1_EVENTS`
  const (four eighths + two quarters, single-pitch) shared by AC1/AC8/AC9/AC10-model.
- `src/notation/__tests__/svg.test.js`: the single AC10 DOM smoke test, in its own small describe
  (e.g. `describe("renderSvg — duration-ordered spacing reaches the SVG (issue #21)")`), reusing the
  buildLayoutModel→renderSvg→cx idiom; inline the same six-event array (files don't share fixtures).
- All imports already exist in both files (advanceFor, eventDuration, measureLayout, systemScale,
  buildLayoutModel, MAX_STRETCH, MEASURE_START_PAD, EMPTY_MEASURE_WIDTH; renderSvg).

### Matcher policy (D7, restated)
- Strict ordering → `toBeLessThan`/`toBeGreaterThan` (+ `toBeLessThanOrEqual` for the MAX_STRETCH cap).
- sp-arithmetic equality / ratios → `toBeCloseTo(_, 10)` (advances are sqrt-irrational; never `toBe`).
- DOM cx geometry → `toBeCloseTo(_, 6)`.
- Exact grids/onsets → `toEqual`. No invented pixel ratios; constants referenced by import, not
  copied (assert against `advanceFor(Δ)` / `MAX_STRETCH` / `MEASURE_START_PAD`, not literals where
  a constant exists), so a future constants tune updates expectations through the formula.

### Runner / CI integration
- `npm run test:unit` (wp-scripts test-unit-js, Jest 29, jsdom). New tests are plain Jest in
  existing files — picked up automatically, no config change. Constraint: NO `console.*` in tests
  (`@wordpress/jest-console` auto-fails). Fast (~1.5s suite). The Playwright job is untouched.

### Risks / trade-offs
- R-A. Constant fragility: hard-coding 4.3213/5.2 would break on a future ADV_K/MIN_ADV tune
  (OQ1/OQ2). MITIGATION: assert ORDINALLY + against `advanceFor(Δ)`/imported constants, never raw
  pixel literals — expectations track the formula, so a deferred contrast tune keeps tests green if
  the ORDERING holds (which it must). This is the spec's "ordinal, not numeric ratios" intent.
- R-B. AC1/AC7 fixture trap: an inter-note X-gap is governed by the LEFT note's Δ, so the last
  column / a trailing quarter can't be read as a q→q gap. MITIGATION: `[8,8,q,q]`/`[8,8,8,8,q,q]`
  fixtures; compare eighth cols vs the q→q col explicitly (D5/D11).
- R-C. Chord cx skew: a chord back-head displaces by ±dx*2. MITIGATION: single-pitch fixtures for
  any cx/note.x comparison; prove AC5 at measureLayout (onset grid), not cx (D8/D9).
- R-D. Cross-system absolute-gap temptation: independent justify makes absolute gaps differ across
  systems. MITIGATION: AC8 asserted only at the intrinsic measureLayout layer; spec Out-of-Scope
  forbids cross-system absolute equality (D12).
- R-E. AC7 wrap-count dependence: relies on a deterministic 2-system wrap at width 140. MITIGATION:
  systemScale policy is locked separately as a pure unit (REUSED 1789-1813); the buildLayoutModel
  case is the integration confirmation — if wrap behavior ever shifts, the pure unit still guards
  the policy. A specific width that lands a comfortable mid-range scale can be pinned if desired.
- R-F. float ULP drift: deterministic in V8 but `toBeCloseTo(_,10)` (not `toBe`) immunizes equality
  assertions per repo idiom (D7).

### Open questions
- None blocking. OQ1 (contrast strength) / OQ2 (short-end separation) remain spec-level deferrals
  gated on the owner's reference image; the ordinal tests intentionally do not pin a target ratio,
  so they neither block nor pre-judge a future tune.

STATUS: design complete; no major open questions. Ready to commit and hand to the design-doc-writer.