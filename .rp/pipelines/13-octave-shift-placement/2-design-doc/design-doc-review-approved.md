# Design-doc review — APPROVED (#13)

Reviewer: `design-doc-reviewer`. Adversarial review of
`2-design-doc/design-doc.md` against `1-spec/spec.md` (the contract),
`0-prompt/prompt.md`, and the live code (`src/notation/layout.js`,
`src/notation/svg.js`, `src/notation/__tests__/`). The research file was used only
to cross-check; this review validated every load-bearing claim independently
against the code and tests.

**Verdict: APPROVED.** The design is sound, standalone, faithful to every spec
requirement, and its backward-compatibility claims are verified true against the
actual fixtures. The baseline suite is green (1315 tests pass). One minor,
non-blocking observation is recorded for the plan.

---

## What I verified against the code (not just the research file)

**Quoted snippets are accurate.** Every code excerpt the design reproduces matches
the live source:
- `band` literal + `ottavaAboveLaneY` (layout.js:1875–1915).
- `systemHasOttavaAbove` (layout.js:2649–2653) — fires on either hand, one caller.
- `effectiveInterStaffGap` / `bothInterStaff` (layout.js:1858–1863).
- `topMarginLayout` ottava block + band convention `topExtent = d + OTTAVA_SIZE`,
  `ottavaAboveLaneY: at(ottavaD)` (layout.js:2794–2839); its single
  `systemHasOttavaAbove` call at 2821.
- The ottava emit `flush()` with `(A)` skip-when-no-noteheads, `(B)` notehead-only
  span, `(C)` hand-agnostic "above" (layout.js:2896–2940).
- `ottavaFor` returns null for `0`/absent **and** for `±3` — `OTTAVA_LABELS =
  {1,2,-1,-2}` (layout.js:1064, 1077–1086).
- `renderOttava` reads exactly `hand`/`x1`/`y`/`label`/`x2`, **never** `placement`
  (svg.js:1149–1173).

**Supporting helpers exist and behave as the design assumes.**
- `ledgerTopExtent` (2148–2159) and `ledgerBottomExtent` (2166–2176) are the exact
  mirror the new `lhAboveTopExtent` follows; `handStepsFor(events, clef)` (2189)
  takes a clef arg, and `measureMinLeftSteps` hardcodes `"bass"` — so the design's
  clef consideration is real and accurately described.
- `m.ctx.leftHand.clef` is a valid, used access path (1932, 1953–1954, 2004).
- `measureModels[i]` carries `.x`, `.width`, `.right`, `.left` (2069–2079); each
  hand model has `.notes` with per-note `.x` (layoutHand, 1421–1459). The x-span
  formula's `run.firstModel.x + n.x` and `run.lastModel.x + run.lastModel.width`
  resolve correctly.
- `rhHasDynamics`/`rhHasHairpin` are in scope at 1824/1826;
  `systemHandHasDynamics`/`systemHandHasHairpin` exist (2749/2771).
- Constants match the design's table exactly (constants.js): `OTTAVA_SIZE=2.2`,
  `NOTE_GAP_STAFF=1`, `INTRA_STAFF_GAP=8`, `MID_GAP=1.2`,
  `DYNAMICS_LANE_RESERVE=6.9`, `SYSTEM_TOP_MARGIN=5`, `STAFF_HEIGHT_SP=4`,
  `NOTEHEAD_RX=0.6`, `EMPTY_MEASURE_WIDTH=3.3`.

---

## Spec faithfulness — every requirement satisfied

- **R1.1 (RH-above unchanged):** emit selects `band.ottavaAboveLaneY` for RH;
  COMPREHENSIVE_SONG is RH-only (layout.test.js:997 RH +1; 1018 LH unchanged), so
  the "every above ottava at `ottavaAboveLaneY`" assertion (1989–1990) stays green.
- **R1.2 (LH-above in the gap):** new `ottavaLeftAboveLaneY` band field + per-hand
  emit selection (`hand === "rightHand" ? ottavaAboveLaneY : ottavaLeftAboveLaneY`).
- **R1.3 (reserved lane clearing both LH highs and the RH below-staff region):**
  pressure-tested below — proven sound, not just asserted.
- **R1.4 (below unchanged):** the "below" branch (`staffBottomY + 2`) is untouched.
- **R1.5 (per-hand top-margin reservation):** `systemHasOttavaAbove` split into
  RH/LH predicates; `topMarginLayout` (its only caller) uses the RH-only one, so a
  LH-only shift no longer deepens the top margin.
- **R1.6 (both-hands coexistence):** RH in the top margin, LH in the gap — distinct
  zones separated by the whole top staff (worked example: 12 sp apart).
- **R2.1/R2.2/R2.3:** measure-extent x-span keyed to first/last run-measure;
  rest-only measures still set `firstModel`/`lastModel`; `run.firstModel` guard
  replaces `run.xs.length > 0`; one bracket per system preserved.

---

## Pressure-tested technical decisions — all sound

**Inter-staff-gap third max-arm: no double-counting, correct floor collapse.**
I simulated the gap formula over a large random sweep of
(`lhExt`, `aboveLHStack`, `belowRHStack`, RH-dynamics) combinations:
- `effectiveInterStaffGap` is a **max** of arms, so `aboveLHStack` appearing in two
  arms is never summed.
- When `hasLHOttavaAbove` is true, the **new arm is always ≥ the existing arm**,
  with a minimum margin of exactly `3.2` (= `NOTE_GAP_STAFF + OTTAVA_SIZE`). Proof
  sketch the sweep confirms: `rhBelowRegionReach ≥ belowRHStack`,
  `max(lhAboveExtent, aboveLHStack) ≥ aboveLHStack`, the `+ PAD + OTT` is `+3.2`,
  and whenever `bothNotes` (existing MID) holds, `bothRegions` (new MID) also holds.
  So the gap always reserves the full LH-above column when needed — there is no
  case where the existing arm wins and leaves the lane under-reserved.
- **Common-case collapse confirmed:** LH +1, no LH highs, no RH below ⇒ new arm
  `= 0 + 0 + (0 + 1 + 2.2) = 3.2 < 8` ⇒ gap stays at the `INTRA_STAFF_GAP` floor;
  existing geometry untouched.

**Dynamics-reserve term is justified.** I confirmed the hole: `stackDepth(n, base)`
returns 0 when `n === 0` (layout.js:1839–1840), so a dynamics-only / hairpin-only RH
(`occ.belowRH === 0`) reserves nothing in the gap today even though its row reaches
~`rhBottomY + 3.5`. The new `Math.max(belowRHStack, (rhHasDynamics || rhHasHairpin)
? DYNAMICS_LANE_RESERVE : 0)` is occ-independent and covers it. Reusing
`DYNAMICS_LANE_RESERVE` (6.9) — already the canonical below-staff-region dodge —
adds zero new constants; KD2 honestly discloses the ~2.8 sp of extra air in the rare
LH-above + RH-dynamics-only combo, which never collides.

**`x1` keyed to the FIRST run-measure's own notes — global-min rejection correct.**
Simulated `[rest, note, rest]` (the spec's R2.2 defect case): the first-measure-keyed
rule gives `x1 = firstModel.x` (the run's left edge), spanning the full run extent;
the rejected global-min jumps `x1` to the lone middle note, under-spanning — exactly
the defect. The left-start refinement (`firstNoteX − NOTEHEAD_RX`) is preserved for a
note-bearing first measure. `x2 = lastModel.x + width` is monotone and only ever
extends to the true barline.

**`ottavaLeftAboveLaneY` formula + `if (ott && run.firstModel)` guard.** The baseline
is the low edge of the `OTTAVA_SIZE` band (`lhTopY − max(lhAboveExtent, aboveLHStack)
− NOTE_GAP_STAFF`), mirroring the top-margin convention and the `y` semantics
`renderOttava` expects (glyph ascends above `y`). The guard keeps `&& ott` because
`±3` shifts are truthy and form a run but have no `OTTAVA_LABELS` entry; `run.firstModel`
correctly replaces `run.xs.length > 0` so rest-only runs emit. Gate↔run null-safety
is provable (shared `octaveShift > 0` ⇔ `ottavaFor` "above"); the design correctly
forbids a silent `?? ottavaAboveLaneY` fallback (KD6).

---

## Unchanged-model-contract claim — verified true

`renderOttava` consumes exactly `{ hand, label, x1, x2, y }` and stamps `data-hand`;
it never reads `ottava.placement` (consumed only inside `buildSystemTexts` to pick
`y`). The emitted model stays `{ hand, label, placement, x1, x2, y }` — no new
fields, `renderOttava` untouched. Matches spec Out-of-Scope.

## Backward-compat / regression — verified against fixtures, not assumed

- **No test asserts an ottava `x1`/`x2`** (grep of `__tests__/` for ottava + x1/x2
  returns nothing; all x1/x2 assertions are beams/ties/slurs/hairpins). The
  measure-extent span change breaks zero assertions.
- **The new gap arm is provably inert.** Every `octaveShift` fixture is a *right*-hand
  shift (layout.test.js:916/953/997/1262 svg); the only `leftHand.octaveShift`
  reference asserts the diff is `false` (1018). No fixture sets
  `leftHand.octaveShift > 0`, so `systemHasLeftOttavaAbove` is false everywhere ⇒ the
  new arm gates to 0 ⇒ `effectiveInterStaffGap` is byte-for-byte unchanged. I
  confirmed the most precise gap assertion — `bareSong`,
  `toBeCloseTo(INTRA_STAFF_GAP, 10)` (layout.test.js:2252) — uses LH note **C3**
  (below the bass top line ⇒ `lhAboveTopExtent = 0`) and has no LH shift, so it stays
  green. The deep-stack gap tests (2277–2294) exercise the existing arm only.
- **RH-only top-margin split preserves RH fixtures.** "stack above the staff" (RH +1)
  still fires the RH predicate; "top margin flexes" (1994–2028) compares RH +1 vs
  no-shift (never LH-only). Both unchanged.
- **Baseline is green:** ran the worktree's `layout.test.js` + `svg.test.js` —
  1315 tests pass. The premise of the backward-compat argument holds.

## Scope discipline — respected

No `ottavaFor`, schema, or `renderOttava` change. The `leftHand.clef` flag is framed
correctly as a non-blocking code-plan consideration (it matches `ledgerBottomExtent`'s
latent `"bass"` simplification, affects no current fixture, and is regression-safe
either way) — not a silent scope expansion.

## Standalone completeness — sufficient

A code-plan writer can work from the design doc alone: the touch list, every new/changed
code block (helper, predicates, gap arm, band field, run shape, x-span, guard, emit
selection), the invariants, worked numbers, and the full backward-compat argument are
all reproduced in the doc. References to `occ` / `rhHasDynamics` / `rhHasHairpin` /
`aboveLHStack` / `bothInterStaff` are to variables that exist in scope at the cited
location.

---

## Non-blocking observation (for the plan, not a defect)

The invariant's strictness claim — "both [ordering bounds] are strict because
`GAP_PAD > 0` and `MID_GAP > 0` add slack" — is slightly overstated for the **upper**
bound (glyph clears the RH region) in the case `rhBelowRegionReach = 0`. When the RH
has no below-staff content, `bothRegions` is false, so no `MID_GAP` is added; in an
extreme synthetic case (LH high notes ≈ 11.5 sp above `lhTopY`, no RH below) the glyph
top can land exactly at `rhBottomY` (slack = 0). This is **not** an overlap with
content — `rhBelowRegionReach = 0` means nothing is in the RH below region, and
`rhBottomY` is the staff bottom *line*; the marking still sits inside the gap. It
therefore satisfies R1.3's no-overlap requirement. The plan/tests may wish to phrase
the upper-bound invariant as `≥` (rather than strict `>`) for the `rhBelowRegionReach
= 0` sub-case, or simply note that strictness there comes from `GAP_PAD` keeping the
*baseline* above LH content while the glyph-top-vs-staff-bottom margin can reach 0 only
in this extreme, content-free configuration. Cosmetic, well within spec — recorded so
the plan does not over-assert a strict inequality that can touch equality.

---

**APPROVED.**
