# Design doc — Issue #21: Space notes horizontally according to their duration

## 1. Summary

Duration-ordered horizontal spacing is **already implemented and wired
end-to-end** in piano-block. A shorter note occupies less horizontal space than a
longer one (thirty-second < sixteenth < eighth < quarter < half < whole), beamed
eighths sit close together, and quarter-and-longer notes get visibly more room.
The pure layout layer derives a per-measure onset grid from durations alone and
assigns each note a horizontal advance; those X positions flow verbatim into the
rendered SVG.

Issue #21 is therefore a **verify / lock task, not new feature work**. Every
acceptance criterion is satisfied by the live code today: all existing tests pass
with **zero source changes**, and the analyst re-ran the production path to
confirm the live formula and model satisfy AC1–AC10. What is missing is *provable
protection* — no automated test currently asserts the mixed-duration ordinal
scenarios this issue describes (existing coverage stops at the advance formula and
that X positions are monotonic).

**This is a TEST-ONLY change.** No behavioral source change is required, and none
is intended. **Definition of done:** the accepted duration-ordered spacing
behavior is specified as the contract and regression-locked by tests at the
layout, model, and render layers, with the suite staying green.

Scope guardrails carried from the spec:

- The criteria are **ordinal** (ordering and equality), never invented pixel
  ratios. The spacing model is **compressive (sub-proportional) by deliberate
  design** — strict linear/2:1 proportionality is explicitly out of scope. The
  compressive model and its constants (`MIN_ADV`, `ADV_K`) are frozen; any
  contrast tuning is a deferred follow-up gated on the owner's reference image.
- An additive docs note is optional and belongs to a separate later phase — not
  required for #21.

## 2. Background: the live spacing model (what we are locking)

A reader needs the model to understand what the tests assert. The substance lives
in `src/notation/layout.js` and reaches the screen through `src/notation/svg.js`.

### 2.1 The advance formula

```
advance(Δ) = MIN_ADV + ADV_K · sqrt(max(Δ, 0)) + max(extra, 0)
```

with constants `MIN_ADV = 2.2`, `ADV_K = 3.0` (`advanceFor`, `layout.js`). `Δ` is
the gap, in quarter-beats, from a note's onset to the **next** onset — i.e. the
note's **own** duration. `extra` is an optional per-column clearance bump for
glyphs (accidentals/dots/flags); it does not participate in duration spacing and,
crucially, **is not applied at the model level** (see §2.3).

This model is **compressive**: it spaces durations roughly logarithmically, the
way real engraving does (~1.5× space per doubling), not linearly. A whole note is
only ~2.5× the width of a thirty-second, not 32×. Two structural properties make
the ordinal guarantees hold:

- **Strict monotonicity.** `sqrt` is strictly increasing on `[0, ∞)`, so any two
  distinct positive durations get distinct advances. The `MIN_ADV` floor is a
  *constant added to* that strictly-increasing term, so it can never tie two
  distinct durations — even the shortest pair (sixteenth vs thirty-second) stays
  ordered. This is what makes "no two distinct durations equal" provable rather
  than incidental (spec edge F).
- **Duration-only.** The advance depends solely on `Δ`. Nothing about the number
  of following notes, or how many pitches stack in a chord, enters the formula
  (spec R2/R5).

Live values from the formula (the contract the ordinal tests pin):

| Δ (quarter-beats) | duration | advance (sp) |
| --- | --- | --- |
| 0.125 | 32nd | 3.2607 |
| 0.25 | 16th | 3.7000 |
| 0.5 | eighth | 4.3213 |
| 1.0 | quarter | 5.2000 |
| 1.5 | dotted quarter | 5.8742 |
| 2.0 | half | 6.4426 |
| 4.0 | whole | 8.2000 |

The eighth:quarter contrast is ~1.2:1 (5.2 / 4.3213 = 1.2033) and the whole:32nd
ratio is ~2.5:1 — both the accepted v1 behavior.

### 2.2 The measure layout (onset grid → per-column advances)

`measureLayout(rightEvents, leftEvents, options)` (`layout.js`) lays one measure's
two hands onto a shared **union grid** of onsets derived purely from durations,
and returns plain data:

```
{ grid, columns: [{ onset, x, advance }], measureEnd, contentWidth, width, hands }
```

Each column's `advance = advanceFor(grid[i+1] − grid[i], …)`, and the **last**
column gaps to `measureEnd = max(handEnd(right), handEnd(left), 0)`. Therefore
`columns[i].advance` **is** the per-column horizontal gap — the test target reads
it directly, with no need to subtract X positions.

Two facts this function guarantees, both load-bearing for the criteria:

- **Time-signature-blind.** A `timeSignature` passed in `options` is *ignored* for
  every X and width (accepted only so callers may pass a uniform options object).
  Layout is identical regardless of the signature, including over-full and
  under-full measures (spec R9, AC9).
- **Finite under all conformant input.** `max(Δ, 0)` guards negative gaps; an
  empty grid short-circuits to `EMPTY_MEASURE_WIDTH` with no columns and no NaN.
  Malformed durations are gated upstream by the song validator (a closed duration
  enum) and never reach this layer; the NaN-safety here is defense-in-depth.

### 2.3 The positioned model and justification

`buildLayoutModel(song, widthSp)` (`layout.js`) assembles the full song into
`systems[i].measures[j].right.notes[].x` (and `.left.notes[].x`) — the
post-justify, **on-screen** X. Each note's `note.x` is its column X, where the
running X accumulates `col.advance * advanceScale`.

- **Justification is one uniform scalar.** `systemScale(contentSp, availSp,
  {isLast})` returns `advanceScale = clamp(avail / content, 1, MAX_STRETCH = 1.6)`.
  A non-last, under-wide system is stretched (scale > 1, capped at 1.6); the
  **last system is left ragged** (scale exactly 1); an over-wide system is not
  stretched (scale 1, with a separate `downscaleFactor < 1`). Because *every*
  column advance is multiplied by the *same* scalar, both the eighth-vs-quarter
  **ordering and the advance ratio** survive justification unchanged (spec R8,
  AC7).
- **The lead-in is not stretched.** The per-measure leading inset
  (`MEASURE_START_PAD` / opening clearance — clef, key signature, time signature)
  is added **unscaled**; only `col.advance` is multiplied by `advanceScale` (spec
  AC7, "the opening lead-in is not stretched").
- **No spacing math is added downstream.** `buildLayoutModel` calls
  `measureLayout` with only `trailingPad` and **no `columnExtra`**, so
  flag/accidental clearance does not perturb per-column advances at the model
  level: equal eighth gaps stay *exactly* equal end-to-end.

### 2.4 The render path (model X → SVG)

`renderSvg(model)` (`svg.js`) stamps each note as `<g
id="rightHand-note-${eventIndex}">` containing a `[data-notehead]` child carrying
`cx`. The notehead's `cx = note.x + (head.displaced ? dx*2 : 0)`. For a
**single-pitch** note there is one, never-displaced head, so **`cx === note.x`
exactly**. The emit layer adds no spacing math; all six noteheads of a measure
share one `<g data-measure transform="translate(measure.x 0)">` frame (X-only), so
their `cx` values are directly comparable.

The one wrinkle: a **chord's back head is displaced by `dx*2`** (≈ ±1.2 sp), which
would skew a raw-`cx` comparison. Hence any `cx`/`note.x` comparison uses
single-pitch fixtures (see §6, trap R-C).

## 3. Approach

Lock the accepted ordinal behavior with regression tests at three pure/jsdom test
seams, all fast and runnable under the existing `npm run test:unit` (Jest 29,
jsdom) with **no new tooling and no source change**. Do **not** use
Playwright/wp-env: ordinal spacing is fully provable at the three pure/jsdom
seams, and the e2e spec is heavyweight and brittle for this. The Playwright spec
(`specs/render.spec.js`) is left untouched.

### 3.1 The three test seams

| Seam | Function(s) | Data | File | Carries |
| --- | --- | --- | --- | --- |
| **LAYOUT** (primary) | `advanceFor(Δ)`, `eventDuration(event)`, `measureLayout(rh, lh, opts)` → `columns[].advance` | pure data | `layout.test.js` | AC1, AC2 (+edge F), AC3, AC4, AC5, AC6, AC8, AC9 |
| **MODEL / integration** | `buildLayoutModel(song, widthSp)` → `systems[i].advanceScale`, `…right.notes[].x` | pure data | `layout.test.js` | AC7 (justify ratio + unscaled lead-in), AC10 (model) |
| **RENDER / DOM** | `renderSvg(model)` → notehead `cx` | jsdom | `svg.test.js` | AC10 (DOM smoke) |

Rationale for the seams:

- The **layout** seam is the canonical home for the per-duration ordinal
  criteria: `columns[i].advance` *is* the per-column gap, so the assertions are
  direct and the irrational sqrt arithmetic is read straight from the formula.
- The **model** seam proves the behavior **reaches the screen without wp-env**:
  `note.x` is the verbatim on-screen X (and `cx === note.x` for plain notes), and
  it is also where justification (`advanceScale`) is observable as plain data.
- The **render/DOM** seam honors the spec's literal "in the rendered SVG" wording
  for AC10 and guards the `note.x → cx` pass-through against a future `svg.js`
  regression that could divorce `cx` from `note.x`.

### 3.2 Why AC10 is a pair (model + DOM)

AC10 is locked at **both** the model and DOM layers (belt-and-suspenders, both
cheap jsdom):

- **Primary, MODEL:** `buildLayoutModel → measures[0].right.notes[].x` — the eighth
  `note.x` gap is smaller than the quarter `note.x` gap. Faithful (proven `note.x
  === cx` for plain notes) and fast.
- **One DOM smoke test:** `renderSvg → cx` via `#rightHand-note-${i}` →
  `[data-notehead]` — eighth `cx` gap smaller than quarter `cx` gap. Honors the
  "rendered SVG" wording and locks the `note.x → cx` pass-through.

The DOM test alone satisfies AC10; the pair is strictly stronger than either
alone and matches `svg.test.js`'s existing `buildLayoutModel → renderSvg → query`
idiom.

## 4. Per-AC test matrix

Each row gives the target, fixture, and assertion. All values are the live
numbers; tests assert **ordinally and against the formula / imported constants**,
never raw pixel literals (see §5).

- **AC1 — canonical mixed-duration fixture.** `measureLayout([8,8,8,8,q,q], [])`
  (single-pitch). Columns 0–3 `.advance` are mutually equal (≈ 4.3213) and each is
  strictly less than column 4 `.advance` (the q→q gap = 5.2). `grid` equals
  `[0, 0.5, 1, 1.5, 2, 3]`. **Subtlety (D5):** compare the four *eighth-led*
  columns against the q→q column (cols 4→5), **not** the boundary
  last-eighth→first-quarter gap (onset 1.5→2), which is *also* an eighth gap
  because it is governed by the eighth's own Δ = 0.5.
- **AC2 — strict monotonicity across the range.** `advanceFor` six-way strict
  chain: `advanceFor(0.125) < (0.25) < (0.5) < (1) < (2) < (4)` (3.2607 < 3.7000 <
  4.3213 < 5.2000 < 6.4426 < 8.2000). **Edge F** (the minimum-advance floor never
  ties two distinct durations) is the first link: `advanceFor(0.25) >
  advanceFor(0.125)`. Folded into AC2; no separate test.
- **AC3 — dotted note placement.** `advanceFor(eventDuration({duration:'quarter',
  dots:1}))` (= `advanceFor(1.5)` = 5.8742) is greater than `advanceFor(1)` = 5.2
  and less than `advanceFor(2)` = 6.4426. The `eventDuration` form self-documents
  the dotted arithmetic (`BASE_DUR[duration] * DOT_MUL[dots]`).
- **AC4 — rests in the grid.** *Value:* `advanceFor(2)` (half rest) >
  `advanceFor(0.5)` (eighth rest). *Grid participation:*
  `measureLayout([{rest, half}, {rest, eighth}], [])` → `columns[0].advance >
  columns[1].advance`, proving rests are full onset-grid citizens.
- **AC5 — chord footprint equals single-note footprint.** At `measureLayout`
  (not `advanceFor`, which has no head parameter):
  `measureLayout([{quarter, 3 pitches C-E-G}, {quarter}], []).columns[0].advance`
  equals `measureLayout([{quarter, 1 pitch}, {quarter}], []).columns[0].advance`
  (both 5.2); the grids are equal. Pitch count never enters
  `handOnsets`/`unionGrid`/`advanceFor`.
- **AC6 — uniform single-duration measure.** `measureLayout([q,q,q,q], [])` →
  columns 0–2 `.advance` all equal (5.2): N notes yield N−1 equal consecutive
  gaps.
- **AC7 — ordering survives justification.** `buildLayoutModel(8×[8,8,q,q], 140)`
  → 2 systems (width 140 gives a clean 6+2 split, with both eighths *and* both
  quarters of a measure landing in the same measure so they share that measure's
  scale). Assert the **shape**, not the exact scale value (for resilience to
  constant tweaks): `systems[0].advanceScale` is `> 1` and `≤ MAX_STRETCH` (live
  ≈ 1.0237); the **last** system `advanceScale === 1` (ragged); within system 0
  measure 0 the eighth `note.x` gap < quarter `note.x` gap (live 4.4236 < 5.3231);
  the **ratio** (quarterGap / eighthGap) of system 0 equals `advanceFor(1) /
  advanceFor(0.5)` (= 1.2033359220 — proving the ratio is preserved under stretch);
  and the lead-in is unscaled — `systems[0].measures[0].right.notes[0].x` `toBe`
  `MEASURE_START_PAD` (1.0 even at scale 1.0237). The `systemScale` policy (cap /
  ragged-last / downscale) is **reused** from existing unit cases — see §5; #21
  adds only this end-to-end ordering+ratio case. Fixture is `[8,8,q,q]` so a genuine
  q→q inter-note gap exists (trap R-B).
- **AC8 — equal intrinsic advance across measures.** At the intrinsic
  (`measureLayout`, pre-justify) layer, a one-liner:
  `measureLayout([q,q], []).columns[0].advance` ≈
  `measureLayout([8,8,8,8,q,q], []).columns[4].advance` (both 5.2,
  `toBeCloseTo(_, 10)`) — a quarter's intrinsic advance is the same regardless of
  its measure or neighbours. (Equivalent alternative: an eighth in `[8,8]` vs in
  `[q,8,half]`, both 4.3213.) **Do NOT** assert cross-system absolute gaps (live:
  system 0 eighthGap 4.4236 ≠ system 1 eighthGap 4.3213 — correctly unequal under
  independent justify; spec Out-of-Scope + trap R-D).
- **AC9 — over-full, time-signature-blind layout.** `measureLayout(20×eighth, [])`
  → 20 columns; every `.advance` ≈ `advanceFor(0.5)` (4.3213); X strictly
  monotonic (each `c.x` > previous); all finite (no NaN/Infinity). **Ts-blind:**
  the result with `{timeSignature:{2,4}}` deep-equals the result with
  `{timeSignature:{12,8}}` deep-equals the bare result.
- **AC10 — render-level confirmation.** *Model:*
  `buildLayoutModel(songOf(AC1_EVENTS), 1000).systems[0].measures[0].right.notes`
  → `(notes[1].x − notes[0].x) < (notes[len-1].x − notes[len-2].x)` — the leading
  eighth gap < the trailing q→q gap (the `[8,8,8,8,q,q]` array makes the *last* gap
  a genuine q→q, per trap R-B). *DOM smoke (`svg.test.js`):* `cx` via the
  `#rightHand-note-${i}` → `[data-notehead]` selector → eighth `cx` gap < quarter
  `cx` gap. Single-pitch fixture so `cx === note.x`.

## 5. Key decisions and rationale

- **D-Source: no source change.** All 381 existing tests pass against current code
  with zero edits; every AC is satisfied by the live formula/model. #21 ships as a
  test-only PR. *Rationale:* the behavior already exists end-to-end; #21's
  deliverable is provable protection, not new behavior.

- **D-Seams: layout + model + DOM, no Playwright.** *Rationale:* all three seams
  are pure-data/jsdom and fast (~1.5s suite); the model's `note.x` is the verbatim
  on-screen X, so "reaches the screen" is proven without the e2e cost. wp-env is
  overkill and brittle for ordinal spacing.

- **D-Target: assert `columns[i].advance` directly.** At the layout level the gap
  is `columns[i].advance`; at the model level it is `notes[i+1].x − notes[i].x`.
  *Rationale:* the column object literally carries the gap — no fragile X
  subtraction at the layout layer.

- **D-Matcher policy.** Surveyed against the repo's dominant idioms:
  - **Strict ordering** (`<` / `>`): `toBeLessThan` / `toBeGreaterThan` (plus
    `toBeLessThanOrEqual` for the `MAX_STRETCH` cap), **no tolerance**. (~100
    occurrences in `layout.test.js`.) Used for AC1, AC2, AC3, AC4, AC7, AC8, AC9,
    edge F.
  - **sp-arithmetic equality and ratios:** `toBeCloseTo(_, 10)`. Advances are
    sqrt-irrational (e.g. 4.32132034…), so **never `toBe`**; precision 10 matches
    the `advanceFor`/`measureLayout` block idiom and immunizes against float ULP
    drift. Used for AC1 four-eighth equality, AC6, AC9 advance equality, and the
    AC7 ratio invariance.
  - **DOM `cx` geometry:** `toBeCloseTo(_, 6)` (the `svg.test.js` idiom). Used for
    the AC10 DOM smoke test.
  - **Exact grids / onsets:** `toEqual` — `[0, 0.5, 1, …]` are exactly
    representable. Used for AC1 grid, AC5 grid equality, AC9 ts-blind deep-equal.
  - **No invented pixel ratios anywhere.** Where a constant exists, assert against
    the import (`advanceFor(Δ)`, `MAX_STRETCH`, `MEASURE_START_PAD`) rather than a
    copied literal, so a future constants tune updates expectations through the
    formula. *Rationale:* this is the spec's "ordinal, not numeric ratios" intent —
    a deferred contrast tune (OQ1/OQ2) keeps the tests green as long as the
    ordering holds, which it must.

- **D-Justify split across three layers.** The `systemScale` **policy** (stretch
  cap, ragged-last, downscale-on-overflow) is already covered by existing
  pure-unit tests and is **reused, not duplicated**. #21 adds only the **one**
  `buildLayoutModel` end-to-end AC7 case (ratio preserved across stretched vs
  ragged systems + unscaled lead-in), which no existing test covers. AC8 is
  asserted at the intrinsic (`measureLayout`) layer only. *Rationale:* separates
  the policy lock from the integration confirmation; if the wrap behavior ever
  shifts, the pure-unit cases still guard the policy.

- **D-Files & structure.**
  - `src/notation/__tests__/layout.test.js`: one new feature-grouped
    `describe("duration-ordered horizontal spacing (issue #21)")` with a leading
    block comment stating the intent (lock the accepted ordinal duration spacing;
    no source change). It holds the layout/model ACs (AC1, AC2+F, AC3, AC4, AC5,
    AC6, AC7-model, AC8, AC9, AC10-model). This mirrors the repo's feature-grouped
    AC blocks (e.g. the hairpin-wedge block in `svg.test.js`).
  - `src/notation/__tests__/svg.test.js`: the single AC10 DOM smoke test, in its
    own small describe (e.g.
    `describe("renderSvg — duration-ordered spacing reaches the SVG (issue #21)")`,
    matching the repo's `renderSvg — X` naming) or appended to an existing render
    describe, reusing the `buildLayoutModel → renderSvg → cx` idiom.
  - All needed imports already exist in both files (`advanceFor`, `eventDuration`,
    `measureLayout`, `systemScale`, `buildLayoutModel`, `MAX_STRETCH`,
    `MEASURE_START_PAD`, `EMPTY_MEASURE_WIDTH`; `renderSvg`).

- **D-Naming.** Behavior-first `it()` titles with a **trailing `(ACn)`** suffix,
  e.g. `it("spaces equal eighth columns equally and tighter than the quarter
  column (AC1)")`. The issue number lives in the describe title and the leading
  block comment, **never** in an `it()` title — matching the repo's convention
  (`(ACn)` suffixes in test titles; issue numbers in describe/section comments,
  e.g. `layout.test.js:3656` "(#13: …)"), so an issue-number-in-describe is
  in-style.

- **D-Fixtures: one canonical source of truth.** Define the canonical event array
  once as a const `AC1_EVENTS` (four eighths + two quarters, single-pitch) at the
  top of the describe, plus a small local `songOf(events)` helper (mirroring the
  existing `songWithNotes`) that wraps an event array into a one-measure song
  (`{ metadata: {}, sections: [{ measures: [{ rightHand: events }] }] }`). The
  *same* array feeds both `measureLayout(AC1_EVENTS, [])` (AC1, and shared by
  AC8/AC9/AC10-model) and `buildLayoutModel(songOf(AC1_EVENTS), wide) → renderSvg`
  (AC10). *Rationale:* one source of truth, no divergence between the layout and
  render assertions. Note the `svg.test.js` AC10-DOM test inlines the same
  six-event array — the two test files do not share fixture imports, so `svg.test.js`
  defines its own song. **Critical fixture trap (R-G):** fixture events **must
  carry `pitches`**. A pitch-less note is *skipped* in `layoutHand`
  (`layout.js:1471`), so it would never render and AC10's `cx` assertion would
  break. `measureLayout` ignores pitches, so a single pitch-bearing array works
  correctly at *both* layers — which is precisely why one shared pitch-carrying
  const is the right canonical fixture.

- **D-Scope (NEW vs REUSE).**
  - **NEW** (in the #21 describe): AC1, AC2 (+edge F), AC3, AC4, AC5, AC6, AC7
    (`buildLayoutModel` end-to-end), AC8, AC9 (all-advances-equal + strict-mono X +
    over-full ts-blind), AC10 (model + DOM).
  - **REUSE / reference** (no new test): the empty-measure case, the `systemScale`
    policy unit cases, the basic under-full ts-blindness, and the basic over-full
    no-throw — all already covered. AC9 adds its spacing-ordering and
    over-full-ts-blind assertions *alongside* these, not as replacements. Edge F is
    folded into AC2.

## 6. Trade-offs and risks

The dominant risk class is **fixture fragility** — building fixtures that
accidentally assert something other than the intended duration relationship.

- **R-A — Constant fragility.** Hard-coding 4.3213 / 5.2 would break on a future
  `ADV_K`/`MIN_ADV` tune (OQ1/OQ2). **Mitigation:** assert ordinally and against
  `advanceFor(Δ)` / imported constants, never raw pixel literals — expectations
  track the formula, so a deferred contrast tune keeps tests green as long as the
  ordering holds.

- **R-B — Inter-note X-gap trap.** A rendered inter-note X-gap is governed by the
  **left** note's Δ, so the *last* column (which gaps to `measureEnd`) and a
  *trailing* quarter cannot be read as a q→q gap. The boundary
  last-eighth→first-quarter gap in `[8,8,8,8,q,q]` is also an eighth gap, not a
  quarter gap. **Mitigation:** use `[8,8,q,q]` / `[8,8,8,8,q,q]` fixtures and
  compare the eighth-led columns against the genuine q→q column explicitly. (Pure
  `advanceFor(Δ)` chains — AC2/AC3 — are Δ-indexed and never hit this; it only
  bites when reading X-deltas between rendered notes / model `note.x`.)

- **R-C — Chord `cx` skew.** A chord's back head is displaced by ±`dx*2`, which
  would skew a raw-`cx` comparison. **Mitigation:** use single-pitch fixtures for
  any `cx`/`note.x` comparison (AC10); prove AC5 at the `measureLayout` onset-grid
  level, not at `cx`.

- **R-D — Cross-system absolute-gap temptation.** Systems justify independently, so
  the *same* duration can render at different absolute gaps across systems (system
  0 eighth gap 4.4236 ≠ system 1 eighth gap 4.3213). **Mitigation:** AC8 is
  asserted only at the intrinsic `measureLayout` layer; the spec's Out-of-Scope
  forbids any cross-system absolute-gap equality criterion.

- **R-E — AC7 wrap-count dependence.** The end-to-end AC7 case relies on a
  deterministic 2-system wrap at width 140. **Mitigation:** the `systemScale`
  policy is locked separately as a pure unit (reused), so if the wrap behavior ever
  shifts, the policy is still guarded; the `buildLayoutModel` case is the
  integration confirmation. A width that lands a comfortable mid-range scale can be
  pinned if desired.

- **R-F — Float ULP drift.** Deterministic in V8, but `toBeCloseTo(_, 10)` (not
  `toBe`) immunizes the equality assertions per the repo idiom.

- **R-G — Pitch-less fixture trap.** A pitch-less note is *skipped* in `layoutHand`
  (`layout.js:1471`), so it never renders — silently breaking AC10's `cx`
  assertion (the model would emit fewer notes than expected). **Mitigation:** the
  canonical `AC1_EVENTS` fixture carries `pitches` on every event; the same
  pitch-bearing array works at the layout layer too (`measureLayout` ignores
  pitches), so one shared const is correct everywhere.

- **Runner constraint — no `console.*` in tests.** The `@wordpress/jest-console`
  preset auto-fails any test that logs. New tests must not log.

## 7. Runner / CI integration

New tests are plain Jest in **existing** files (`layout.test.js`, `svg.test.js`),
picked up automatically by `npm run test:unit` (`wp-scripts test-unit-js`, Jest
29, jsdom) — **no config change**. The suite is fast (~1.5s). The Playwright job
(`npm run test:e2e`) is untouched.

## 8. Out of scope (carried from the spec)

- Strict linear / 2:1 proportionality (deliberately designed against).
- Any change to the compressive model or its constants (`MIN_ADV`, `ADV_K`);
  contrast/ratio tuning is a deferred follow-up gated on the owner's reference
  image (OQ1/OQ2). The current ~1.2:1 eighth:quarter contrast is accepted v1.
- Beaming / grouping logic (which notes share a beam) — unchanged; beamed eighths
  may be *used* as a fixture.
- Vertical concerns (chord-head displacement seconds rule; stem/flag/accidental
  clearance widening).
- Leading reserve / opening breathing room (already-shipped, separate concern).
- Barline / measure-width math beyond the duration advances.
- Cross-system absolute-gap equality (only intrinsic advances and within-system
  ordering are guaranteed).
- Justify / wrapping policy changes (stretch cap, packing, downscale-on-overflow) —
  a constraint the ordering must hold under, not a deliverable.
- Audio / playback timing (notation only).
- Beat-anchored standalone-annotation X interpolation (unrelated feature).
- Documentation of the duration→spacing contract — optional/additive, a possible
  later phase, not required for #21.

## 9. Open questions

None blocking. **OQ1** (is the ~1.2:1 eighth-vs-quarter contrast strong enough vs
the owner's reference image?) and **OQ2** (more separation among the shortest
notes, where the floor dominates?) remain spec-level deferrals, both gated on the
owner supplying the reference image. The ordinal tests intentionally do **not** pin
a target ratio, so they neither block nor pre-judge a future tune.
