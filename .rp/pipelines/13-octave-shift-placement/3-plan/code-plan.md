# Code plan — Fix octaveShift ottava placement for left and right hands (#13)

Implements `2-design-doc/design-doc.md` (APPROVED) against the contract in
`1-spec/spec.md`. **All production changes are in `src/notation/layout.js`;** all
test changes are in `src/notation/__tests__/layout.test.js`. No change to
`constants.js`, `svg.js`, `ottavaFor`, or the song schema (spec Out of Scope).

## How to read this plan

The work is split into ordered, independently-committable tasks. Each task is
written for one code-writer following TDD: write/adjust the test(s) named in
**Acceptance**, watch them fail (red), implement the **Changes**, watch them pass
(green), then run the full suite. Tasks are ordered so each builds only on
already-merged predecessors. The Bug-1 vertical-placement chain (T1→T5) must land
in order because the gap math, the band field, and the emit selection are coupled.
Bug 2 (T6) is independent of the Bug-1 chain and may be implemented in parallel,
but is sequenced after for a clean single-feature-at-a-time history.

## Verified baseline (this worktree)

- Test command: **`npm run test:unit`** (this project uses `wp-scripts
  test-unit-js`; raw `npx jest` fails to parse the source and must not be used).
  To run only the touched suites: `npm run test:unit -- src/notation/__tests__/layout.test.js src/notation/__tests__/svg.test.js`.
- **Full unit suite: 360 tests across 6 suites, all green** (verified by running
  it in this worktree before planning). The notation suites alone
  (`layout.test.js` + `svg.test.js`) are 263 tests. (Earlier pipeline artifacts
  cite "~1315"; that figure is not reproducible via `npm run test:unit` here — the
  authoritative, reproduced number is **360**. Every task's acceptance is keyed to
  "the full `npm run test:unit` suite stays green," not to a literal count, so this
  discrepancy does not affect correctness; the count is recorded only for context.)
- **No existing test asserts an ottava `x1`/`x2`** (re-confirmed: all `x1`/`x2`
  assertions in `layout.test.js` belong to beams/ties/slurs/hairpins). No existing
  fixture sets `leftHand.octaveShift > 0`. These two facts are the backbone of the
  backward-compat argument and must remain true after the change.

## Verified source anchor points (current line numbers, `src/notation/layout.js`)

- `HANDS = ["rightHand", "leftHand"]` — line 856.
- `ledgerTopExtent` (lines 2148–2159), `ledgerBottomExtent` (2166–2176),
  `measureMinLeftSteps` → `handStepsFor(measure?.leftHand, "bass")` (2184–2186),
  `handStepsFor(events, clef)` (2189–2203). `lhAboveTopExtent` is the up-direction
  LH mirror of `ledgerTopExtent`.
- Per-system flex block: `occ` (1823), `rhHasDynamics`/`rhHasHairpin` (1824/1826),
  `stackDepth` (1839–1840), `belowRHStack` (1841), `aboveLHStack` (1844),
  `bothInterStaff` + `effectiveInterStaffGap` (1858–1862), `lhTopY` (1863).
- `band` literal (1875–1915); `ottavaAboveLaneY: top.ottavaAboveLaneY` (1886);
  `bands.aboveLH.baseY = lhTopY − NOTE_GAP_STAFF` (1905).
- `systemHasOttavaAbove` (2649–2653) — its **only** caller is `topMarginLayout` at
  line 2821 (no svg.js or test reference; confirmed by grep).
- `topMarginLayout` (2794–2839); ottava block 2821–2824; return at 2833–2838.
- `buildSystemTexts` (2859–2943); ottava emit `flush()` 2899–2922 (guard at 2904,
  notehead-only span at 2911–2912, hand-agnostic "above" at 2915–2918); run-build
  loop 2923–2938 (`run = { shift, xs: [] }` at 2931; `run.xs.push(...)` at 2936).

## Test harness facts (for the new-test tasks)

- Tests import `buildLayoutModel`, `INTRA_STAFF_GAP` from the module under test.
- A system's band is read as `sys.band.<field>`; ottavas as `sys.texts.ottavas`
  (each `{ hand, label, placement, x1, x2, y }`). Build a model with
  `buildLayoutModel(song, widthSp).systems[i]`.
- The existing RH-only ottava fixture is `COMPREHENSIVE_SONG` (RH `octaveShift: 1`
  in section 2; LH shift stays 0). New LH/both-hand tests build small purpose-made
  song objects in the test (see the `plainSong` pattern at layout.test.js
  ~1998–2021 for the minimal song shape: `{ sections: [{ measures: [...] }] }`).

## Non-blocking design notes — disposition (decided here)

1. **`lhAboveTopExtent` clef argument.** The design recommends reading
   `m.ctx.leftHand.clef` rather than hardcoding `"bass"`. **Decision: FOLD IN** —
   use `m.ctx.leftHand.clef`. It is strictly more correct (handles a tenor/alto LH
   staff such as COMPREHENSIVE_SONG section 2), trivially safe, cheap, and
   regression-free (the LH-above gate is off for every current fixture, so the
   value is unused today regardless of clef). `m.ctx.leftHand.clef` is a
   confirmed-valid access path. This is the design's own recommended choice and is
   captured as an explicit step in T1, not a scope expansion. (Note that the
   sibling `ledgerBottomExtent`/`measureMinLeftSteps` keeps its latent `"bass"`
   hardcode; we are **not** touching it — out of scope, and changing it is
   unnecessary for #13.)

2. **Upper-ordering-bound strictness phrasing.** The reviewer flagged that the
   invariant "glyph top clears the RH below-staff region" is strict (`>`) only when
   `rhBelowRegionReach > 0`; in the content-free extreme (`rhBelowRegionReach = 0`,
   LH highs ≈ 11.5 sp, no RH below) the glyph top can land exactly at `rhBottomY`
   (slack 0) — still inside the gap, no content overlap. **Decision: FOLD IN as a
   phrasing constraint on the tests** — the LH-above placement test (T7) asserts
   the *baseline*-above-LH-content bound strictly (that one is always strict, from
   `GAP_PAD > 0`) and asserts the glyph-top-vs-`rhBottomY` bound as **`>=`** (not
   strict). T7's fixture deliberately includes an RH below-staff occupant so
   `rhBelowRegionReach > 0` and the clearance is comfortably positive, but the
   assertion operator is `>=` to avoid over-asserting a strict inequality that the
   spec does not require and that can touch equality in the content-free extreme.

---

## Task list (in order)

- **T1** — Add `lhAboveTopExtent(members)` helper (LH up-direction mirror).
- **T2** — Split `systemHasOttavaAbove` into RH/LH predicates; repoint
  `topMarginLayout` to the RH-only predicate (R1.5).
- **T3** — Add the left-hand-gated third max-arm to `effectiveInterStaffGap`
  (R1.3).
- **T4** — Add the `ottavaLeftAboveLaneY` band field (R1.2).
- **T5** — Per-hand "above" emit-lane selection in `buildSystemTexts` (R1.2/R1.6).
- **T6** — Bug 2: measure-extent x-span + rest-only-aware run shape and guard
  (R2.1/R2.2/R2.3).
- **T7** — Acceptance tests for Bug 1 and Bug 2 (the five spec new-tests) +
  full-suite green gate.

---

### T1 — Add `lhAboveTopExtent(members)` helper

**Goal.** Provide the up-direction LH/bass mirror of `ledgerTopExtent`: how far the
LH's own highest notehead reaches (in sp) above the LH top staff line, so the gap
flex and band field (T3/T4) can reserve a lane that clears the LH high notes.

**Files.** `src/notation/layout.js`.

**Changes.**
- Add a new helper next to `ledgerTopExtent` / `ledgerBottomExtent` (~after line
  2176, in the same helper cluster), mirroring `ledgerTopExtent`'s shape but
  scanning the **LH** events in the **up** direction and using each measure's
  **actual** LH clef:

  ```js
  /**
   * The highest LH notehead position (largest `sFromBottom`) above the LH staff
   * top line across a system's measures, converted to an extent in sp above
   * `leftStaffTopY`. The LH staff top line is `sFromBottom = 8` (in its own
   * frame). Mirrors `ledgerTopExtent` over the LH/bass staff in the up direction.
   */
  function lhAboveTopExtent(members) {
    let maxAbove = 8; // LH top line
    for (const m of members) {
      for (const s of handStepsFor(m.measure?.leftHand, m.ctx.leftHand.clef)) {
        if (s > maxAbove) {
          maxAbove = s;
        }
      }
    }
    // Each staff-step above the top line is 0.5 sp; clamp to a non-negative extent.
    return Math.max(0, (maxAbove - 8) * 0.5);
  }
  ```
- Uses `m.ctx.leftHand.clef` per non-blocking note (1) above — **not** hardcoded
  `"bass"`. `handStepsFor` already takes a clef and skips rests/unknowns; an absent
  `leftHand` yields `[]` (the `events ?? []` guard), so a rest-only / empty LH
  measure contributes nothing and the helper returns 0.

**Depends on.** Nothing (pure addition; not yet called).

**Traces to.** Design "New helper `lhAboveTopExtent`" (lines 224–242); non-blocking
note (1). Spec R1.3(a).

**Acceptance.**
- A unit test calls `lhAboveTopExtent` (export it for the test, or test it
  indirectly only if the writer prefers — direct is cleaner) and verifies the
  worked numbers from the design: an empty/rest-only members list → `0`; a member
  whose LH has bass C5 (step 17) → `4.5`; bass G5 (step 21) → `6.5`; a member with
  only LH notes at or below the top line (e.g. C3) → `0`. (If `lhAboveTopExtent` is
  not exported, fold this verification into T7's LH-placement test via the observed
  band Y instead, and state that here.)
- The full `npm run test:unit` suite stays green (the helper is unused so far;
  nothing can regress).

---

### T2 — Split `systemHasOttavaAbove` into RH/LH predicates (R1.5)

**Goal.** Make the top-margin ottava lane reservation driven by the **right hand
only**, and provide an LH-only predicate for the gap flex (T3) and band field (T4).
A left-hand-only positive shift must stop deepening the top margin.

**Files.** `src/notation/layout.js`.

**Changes.**
- Replace `systemHasOttavaAbove` (2649–2653) with two predicates:

  ```js
  /** Whether any measure in this system carries a RIGHT-hand positive octave shift. */
  function systemHasRightOttavaAbove(members) {
    return members.some((m) => m.ctx.rightHand.octaveShift > 0);
  }
  /** Whether any measure in this system carries a LEFT-hand positive octave shift. */
  function systemHasLeftOttavaAbove(members) {
    return members.some((m) => m.ctx.leftHand.octaveShift > 0);
  }
  ```
- In `topMarginLayout`, change the single call at line 2821 from
  `systemHasOttavaAbove(members)` to `systemHasRightOttavaAbove(members)`. Nothing
  else in `topMarginLayout` changes; its signature and the `ottavaAboveLaneY` field
  in the return are unchanged (now RH-driven). `ottavaD`/`ottavaAboveLaneY` become
  `null` for a LH-only shift, collapsing the top margin to its no-shift baseline.
- Confirm there is no remaining reference to `systemHasOttavaAbove` after the
  rename (grep). The old combined predicate is removed, not kept.

**Depends on.** T1 only for ordering hygiene (same file region); functionally
independent of T1.

**Traces to.** Design KD4 + "Split the trigger" (206–222); spec R1.5.

**Acceptance.**
- Existing **"the top margin flexes…"** test (layout.test.js ~1994–2028) stays
  green: it compares RH +1 (COMPREHENSIVE_SONG) vs a no-shift plain song — never a
  LH-only case — so the RH predicate keeps the RH lane reserved on the rich side
  and reserves nothing on the plain side, exactly as before.
- Existing **"tempo, ottava, and note lanes stack above the staff"**
  (~1972–1992) and **"starts an 8va ottava for the RH octave shift…"**
  (~1863–1870) stay green (RH-only fixture still fires `systemHasRightOttavaAbove`).
- The full `npm run test:unit` suite stays green.
- (Behavioral verification of the LH-only no-over-reservation is asserted in T7
  test #2, which depends on this task plus T3–T5.)

---

### T3 — Left-hand-gated third max-arm in `effectiveInterStaffGap` (R1.3)

**Goal.** Grow the inter-staff gap, **only when a LH positive shift is present on
the system**, to reserve a lane that clears (a) the LH high notes / above-LH note
annotations and (b) the RH below-staff region (notes + any dynamics row / hairpin
lane). When no LH shift is present the gap is byte-for-byte unchanged.

**Files.** `src/notation/layout.js`.

**Changes.**
- Immediately before the `effectiveInterStaffGap` computation (currently
  1858–1862), add the gated inputs and the dynamics-reserve term, then add the new
  third arm. Final shape:

  ```js
  const bothInterStaff = occ.belowRH > 0 && occ.aboveLH > 0;

  // LH-above ottava lane reservation (R1.3): when a LH positive shift is present,
  // the gap must also fit a lane above the LH content and clear of the RH
  // below-staff region. Inert (0) when no LH-above shift is on this system.
  const hasLHOttavaAbove = systemHasLeftOttavaAbove(members);
  const lhAboveExtent = lhAboveTopExtent(members);

  // The RH below-staff region's downward reach. Independent of occ.belowRH so a
  // dynamics-only / hairpin-only RH (occ.belowRH === 0, belowRHStack === 0) still
  // reserves its row — stackDepth returns 0 when the note count is 0.
  const rhBelowRegionReach = Math.max(
    belowRHStack,
    rhHasDynamics || rhHasHairpin ? DYNAMICS_LANE_RESERVE : 0,
  );

  // The LH-above column rising from lhTopY: clear the taller of the raw LH highs
  // and the above-LH note annotations, a pad (NOTE_GAP_STAFF), then the
  // OTTAVA_SIZE glyph band.
  const lhAboveColumn = hasLHOttavaAbove
    ? Math.max(lhAboveExtent, aboveLHStack) + NOTE_GAP_STAFF + OTTAVA_SIZE
    : 0;

  const bothRegions = rhBelowRegionReach > 0 && lhAboveColumn > 0;
  const effectiveInterStaffGap = Math.max(
    INTRA_STAFF_GAP,
    belowRHStack + aboveLHStack + (bothInterStaff ? MID_GAP : 0),
    rhBelowRegionReach + (bothRegions ? MID_GAP : 0) + lhAboveColumn,
  );
  ```
- `DYNAMICS_LANE_RESERVE`, `NOTE_GAP_STAFF`, `OTTAVA_SIZE`, `MID_GAP`,
  `INTRA_STAFF_GAP` are already imported/in scope (confirmed). **No new constants.**
- Per KD2 the plan uses `DYNAMICS_LANE_RESERVE` (6.9) for the RH-below reserve (the
  rejected `RH_BELOW_REGION_EDGE` constant is NOT introduced — zero new constants is
  a design goal). The ~2.8 sp of extra air it adds appears only in the rare
  LH-above + RH-dynamics-only combination and never causes a collision.
- `effectiveInterStaffGap` is a **max** across arms, so `aboveLHStack` appearing in
  two arms is not double-counted — each arm is its own self-consistent stack and the
  gap takes the tallest. Do not refactor to a sum.

**Depends on.** T1 (`lhAboveTopExtent`), T2 (`systemHasLeftOttavaAbove`).

**Traces to.** Design "Grow the inter-staff gap…" (244–284), KD1, KD2; spec R1.3.

**Acceptance.**
- **Inert for the whole current suite** — the load-bearing regression claim: with
  no LH-above fixture anywhere, `hasLHOttavaAbove` is false everywhere ⇒
  `lhAboveColumn = 0` ⇒ `bothRegions` false ⇒ the new arm is
  `rhBelowRegionReach + 0 + 0 = rhBelowRegionReach`, which is `≤` the existing arm
  for every current fixture (every gap/band-Y fixture has LH pitches below the bass
  top line and RH below-region content only where the existing arm already covers
  it). So `effectiveInterStaffGap` is unchanged. Concretely the
  `INTRA_STAFF_GAP`-floor gap test (layout.test.js ~2252, `bareSong`, LH C3, no LH
  shift) and the deep-stack gap tests stay green.
- The full `npm run test:unit` suite stays green.
- (The gap-grows-correctly behavior is verified through the observable band Ys in
  T7 tests #1 and #3, which require T4/T5 to read those Ys.)

---

### T4 — Add the `ottavaLeftAboveLaneY` band field (R1.2)

**Goal.** Expose the LH-above lane baseline on the per-system `band`, so the emit
step (T5) can place a LH "above" bracket in the reserved gap lane. The baseline is
the **low edge** of the `OTTAVA_SIZE` band — the same `y` convention `renderOttava`
expects and the same convention `ottavaAboveLaneY` uses.

**Files.** `src/notation/layout.js`.

**Changes.**
- In the `band` literal (1875–1915), add a field next to `ottavaAboveLaneY` (1886):

  ```js
  ottavaAboveLaneY: top.ottavaAboveLaneY,
  // LH "above" ottava lane: low edge of the OTTAVA_SIZE band, sitting in the
  // inter-staff gap above the LH content. Null when no LH-above shift is present
  // on this system (and never read in that case — see buildSystemTexts).
  ottavaLeftAboveLaneY: hasLHOttavaAbove
    ? lhTopY - Math.max(lhAboveExtent, aboveLHStack) - NOTE_GAP_STAFF
    : null,
  ```
- `hasLHOttavaAbove`, `lhAboveExtent`, `aboveLHStack`, `lhTopY`, `NOTE_GAP_STAFF`
  are all in scope at the band literal (the gated inputs from T3 are computed just
  above `effectiveInterStaffGap`, which precedes `lhTopY` and the band literal).
- The glyph rises `OTTAVA_SIZE` above this baseline into the clearance the gap arm
  reserved in T3. The pad `NOTE_GAP_STAFF` matches the above-LH band convention
  (`aboveLH.baseY = lhTopY − NOTE_GAP_STAFF`, line 1905) — KD3. **No new constants.**

**Depends on.** T3 (provides `hasLHOttavaAbove`, `lhAboveExtent` and the gap arm
that reserves the room this baseline points into).

**Traces to.** Design "New band field `ottavaLeftAboveLaneY`" (286–299), KD3; spec
R1.2.

**Acceptance.**
- The new field is `null` for every current fixture (gate off), so no existing band
  assertion changes; the full `npm run test:unit` suite stays green.
- (The field's value and ordering are asserted in T7 tests #1 and #3.)

---

### T5 — Per-hand "above" emit-lane selection in `buildSystemTexts` (R1.2/R1.6)

**Goal.** Route a RH "above" bracket to `band.ottavaAboveLaneY` (unchanged) and a
LH "above" bracket to `band.ottavaLeftAboveLaneY` (the new gap lane). The "below"
branch is untouched (already per-hand correct).

**Files.** `src/notation/layout.js`.

**Changes.**
- In `flush()` (2899–2922), replace the hand-agnostic "above" `y` (2915–2918) with
  a per-hand lane selection:

  ```js
  const staffBottomY =
    hand === "rightHand" ? band.rightStaffBottomY : band.leftStaffBottomY;
  const aboveY =
    hand === "rightHand"
      ? band.ottavaAboveLaneY
      : band.ottavaLeftAboveLaneY;
  ottavas.push({
    hand,
    label: ott.label,
    placement: ott.placement,
    x1: /* unchanged in this task — see T6 */ ...,
    x2: /* unchanged in this task — see T6 */ ...,
    // Above: RH in the top-margin lane, LH in the inter-staff-gap lane.
    // Below: in the bottom margin, clear of low ledgers (unchanged).
    y: ott.placement === "above" ? aboveY : staffBottomY + 2,
  });
  ```
- **Do NOT add a `?? band.ottavaAboveLaneY` fallback** (KD6). When
  `placement === "above"` and `hand === "leftHand"`, `band.ottavaLeftAboveLaneY` is
  provably non-null: the LH-above flush fires only when `run.shift > 0` ⇔ some
  member has `leftHand.octaveShift > 0`, which is exactly the gate
  `systemHasLeftOttavaAbove` that set the field non-null over the same members. A
  silent fallback would reintroduce Bug 1's wrong-staff placement if it ever fired.
- Optional belt-and-braces (acceptable per KD6, not required): an explicit
  invariant assert at the LH-above branch, e.g. throw/console-guard if
  `aboveY == null` while emitting a LH "above". If added, keep it cheap and
  non-throwing in production paths per the surrounding code's style; prefer relying
  on the proven invariant if no similar assert idiom exists nearby.
- The model contract stays exactly `{ hand, label, placement, x1, x2, y }` — no new
  fields; `renderOttava` (svg.js) is untouched.

**Depends on.** T4 (`band.ottavaLeftAboveLaneY` exists). Compatible with the old
`run.xs` x-span (this task leaves x1/x2 as-is); T6 then replaces the x-span. (If a
writer prefers, T5 and T6 can be done in one commit since both edit the same
`flush()` — but they are split here so the vertical-placement fix and the
horizontal-span fix have independent acceptance tests. Keep them separate unless
there is a reason not to.)

**Traces to.** Design "Per-hand 'above' emit selection" + "Null-safety" (301–330),
KD6; spec R1.2, R1.6.

**Acceptance.**
- Existing **COMPREHENSIVE_SONG** assertions stay green: RH "above" still selects
  `band.ottavaAboveLaneY`, so "tempo, ottava, and note lanes stack above the staff"
  (every above-ottava `o.y ≈ sys.band.ottavaAboveLaneY`, ~1989–1991) and "starts an
  8va ottava for the RH octave shift…" both pass unchanged.
- The full `npm run test:unit` suite stays green.
- (LH-above placement and both-hands coexistence are asserted in T7 tests #1, #3,
  which require this task.)

---

### T6 — Bug 2: measure-extent x-span + rest-only-aware run shape and guard

**Goal.** Emit a bracket on **every** system a non-zero `octaveShift` run spans
(including rest-only systems), and span each system's run-portion's full **measure
extent** (first run-measure left edge — or first note X − `NOTEHEAD_RX` when present
— to last run-measure right barline), fixing both the rest-only drop and the sparse
under-span. Exactly one bracket per system is preserved.

**Files.** `src/notation/layout.js`.

**Changes.** In `buildSystemTexts`:
- **Run shape** — replace `run = { shift, xs: [] }` (2931) with
  `run = { shift, firstModel: null, lastModel: null, firstHandNotes: null }`.
- **Run-build loop** (2923–2938) — replace the `run.xs.push(...)` body (2933–2937)
  with measure-model tracking. `laid` is still the same per-hand model
  (`measureModels[i].right` / `.left`); read its `.notes` only to refine the left
  start of the **first** run-measure:

  ```js
  const laid =
    hand === "rightHand" ? measureModels[i].right : measureModels[i].left;
  if (!run.firstModel) {
    run.firstModel = measureModels[i];
    run.firstHandNotes = laid.notes; // the first run-measure's own notes
  }
  run.lastModel = measureModels[i];
  ```
  A rest-only measure still sets `firstModel`/`lastModel` (the shift comes from
  `ctx`, not from notes) — that is precisely what makes a rest-only system emit a
  bracket (R2.1).
- **Guard** — change `if (ott && run.xs.length > 0)` (2904) to
  `if (ott && run.firstModel)`. `run.firstModel` is set whenever the run covers ≥ 1
  measure, so it fires on rest-only systems. The `&& ott` half is **kept**:
  `ottavaFor` returns `null` for out-of-range shifts (`±3`), which are truthy and
  start a run / set `firstModel` but have no label — `&& ott` correctly drops them.
- **x-span** — inside the guard, replace the notehead-only `x1`/`x2` (2911–2912):

  ```js
  const x2 = run.lastModel.x + run.lastModel.width; // last run-measure right barline
  const firstNotesX = run.firstHandNotes.map((n) => run.firstModel.x + n.x);
  const x1 =
    firstNotesX.length > 0
      ? Math.min(...firstNotesX) - NOTEHEAD_RX // left-start refinement, when present
      : run.firstModel.x; // else the first run-measure's left edge
  ```
  Push `x1`, `x2` into the emitted object. **Key the left-start refinement to the
  FIRST run-measure's own notes** (`run.firstHandNotes`), **not** a global min over
  all run notes (KD5) — a global min under-spans a rest-leading sparse run by
  jumping `x1` to a later note. `x2 = lastModel.x + width` is monotone and only ever
  extends to the true barline (the last note is inside the last measure).
- One bracket per system is preserved structurally: `buildSystemTexts` runs once per
  wrapped system with that system's own `measureModels` slice (R2.3); only the
  per-system-local x1/x2 formula changed.

**Depends on.** Independent of T1–T5 (different concern, same `flush()`/loop region
as T5). Sequenced after the Bug-1 chain for a clean history; if T5 already merged,
re-apply the x1/x2 lines into the post-T5 `flush()`.

**Traces to.** Design "Bug 2 — per-system measure-extent x-span" (332–397), KD5;
spec R2.1, R2.2, R2.3.

**Acceptance.**
- No existing test asserts an ottava `x1`/`x2` (verified), so the span change breaks
  zero existing assertions; the SVG "an ottava element exists" test stays green.
- The full `npm run test:unit` suite stays green.
- (Rest-only emission, sparse measure-extent span, and one-per-system multi-system
  restate are asserted in T7 tests #4 and #5, which require this task.)

---

### T7 — Acceptance tests for Bug 1 and Bug 2 (the five spec new-tests)

**Goal.** Add the five spec Acceptance-Criteria tests and lock the full suite green.

**Files.** `src/notation/__tests__/layout.test.js` (new tests, using small
purpose-built song fixtures; the `{ sections: [{ measures: [...] }] }` shape per the
`plainSong` example). If `lhAboveTopExtent` was exported in T1, also add its unit
test here (or keep it in T1 — record where it lives).

**Changes — add these tests (names indicative):**

1. **"a left-hand +1 shift places its ottava in the inter-staff gap above the LH
   notes, not in the top-margin lane"** (R1.2/R1.3). Fixture: one section, LH a
   note-bearing measure with `octaveShift: 1` (a LH high note, e.g. bass C5/G5, so
   `lhAboveTopExtent > 0`), and an RH below-staff occupant (a point dynamic or a
   below-staff note) so `rhBelowRegionReach > 0`. Assert on the system's LH "above"
   ottava `o` and `band`:
   - `o.hand === "leftHand"`, `o.placement === "above"`.
   - `o.y` is **not** `band.ottavaAboveLaneY` (top-margin lane); `o.y ===
     band.ottavaLeftAboveLaneY` and `o.y < band.leftStaffTopY` (in the gap).
   - **Baseline above LH content (strict):** `o.y < band.leftStaffTopY −
     max(lhAboveExtent, aboveLHStack)` — i.e. `o.y` sits above the LH high notes /
     above-LH annotations. (Strict, from `GAP_PAD = NOTE_GAP_STAFF > 0`.) Compute
     the LH-content top from the fixture's known high note, or assert the weaker but
     sufficient `o.y < band.leftStaffTopY − (lhHighNoteExtent)` using the fixture's
     own pitch.
   - **Glyph top clears the RH below region (`>=`, per non-blocking note (2)):**
     `(o.y − OTTAVA_SIZE) >= band.rightStaffBottomY + rhBelowRegionReachExpected` —
     use `>=`, not `>`, to avoid over-asserting the strict inequality the spec does
     not require (it can touch equality only in the content-free extreme; this
     fixture has RH below content so the margin is positive, but the operator stays
     `>=`). If importing `OTTAVA_SIZE`/`DYNAMICS_LANE_RESERVE` into the test is
     awkward, assert the directional facts instead: `o.y − OTTAVA_SIZE` is
     `>= band.rightStaffBottomY` and the RH below content's lowest drawn Y is `>` the
     glyph top — i.e. no overlap. Keep the no-overlap claim, drop any strict-`>` on
     the staff-bottom touch.

2. **"a left-hand-only +1 shift does not deepen the top margin"** (R1.5). Build two
   models from the same above-the-RH-staff content: one with LH `octaveShift: 1`,
   one with no shift (RH shift 0 in both; identical RH notes so the above-RH lane and
   ledger extent match). Assert:
   - `band.topMargin` is equal (`toBeCloseTo`) across the two — the LH-only shift
     does not reserve a top-margin ottava lane.
   - `band.ottavaAboveLaneY` is `null` in the LH-only model (no RH-above shift), so
     the RH top-margin lane is not reserved.

3. **"both hands +1 place two 'above' ottavas at distinct Ys with no overlap"**
   (R1.6). Fixture: one system, RH `octaveShift: 1` and LH `octaveShift: 1`, both
   note-bearing. Assert:
   - Two "above" ottavas exist, one `hand === "rightHand"`, one
     `hand === "leftHand"`.
   - The RH one is at `band.ottavaAboveLaneY`; the LH one at
     `band.ottavaLeftAboveLaneY`; the two Ys differ and the RH lane is higher
     (smaller Y) than the LH lane: `band.ottavaAboveLaneY < band.ottavaLeftAboveLaneY`.
   - They occupy distinct zones (RH glyph band `[y−OTTAVA_SIZE, y]` in the top
     margin is entirely above the LH lane), so no overlap. A directional
     `band.ottavaAboveLaneY < band.ottavaLeftAboveLaneY − OTTAVA_SIZE` (or the
     weaker strict `<`) suffices.

4. **"a rest-only run-portion still emits a bracket, and a sparse run spans the
   measure extent"** (R2.1/R2.2). Two sub-cases (one test or two):
   - **Rest-only:** a run of measures with the shift set on `ctx` but **no
     noteheads** for that hand in some measure (e.g. a single-measure system whose
     hand has only a rest, with `octaveShift: 1`). Assert a bracket **is** emitted
     for that system/hand, with `x1 === firstModel.x` (the measure's left edge — no
     note refinement) and `x2 === lastModel.x + lastModel.width` (right barline), and
     `x1 < x2` (the `EMPTY_MEASURE_WIDTH = 3.3` floor guarantees non-degenerate).
   - **Sparse:** a 3-measure run `[rest, note, rest]` for the hand. Assert the
     bracket spans `[firstModel.x, lastModel.x + lastModel.width]` (the full run
     extent), **not** a tiny ±`NOTEHEAD_RX` window around the lone middle note —
     i.e. `x1 === firstModel.x` (first measure is rest-only, so no refinement) and
     `x2` reaches the last measure's right barline. (Reference the measureModels via
     the built system's `sys.measures` / model `x`/`width` to compute the expected
     edges, or assert relative facts: `x1 <= firstNoteX − NOTEHEAD_RX` and the span
     covers more than one measure width.)

5. **"a multi-system note-bearing run restates exactly one bracket per system"**
   (R2.3). Build a model at a width that wraps a single same-shift run across ≥ 2
   systems (e.g. reuse/extend COMPREHENSIVE_SONG at a narrow width, or a purpose
   fixture). Assert: for that hand+label, each spanned system carries **exactly
   one** matching ottava (count per system === 1), and the total equals the number
   of systems the run spans. This guards the per-system-slice invariant against
   regression.

**Depends on.** T1–T6 (each test exercises the code those tasks add; #4/#5 need T6,
#1/#3 need T3–T5, #2 needs T2 + the band field nullness from T4).

**Traces to.** Spec "New tests to add" 1–5; design Invariants (484–502) and Worked
numbers (504–518); non-blocking notes (1) and (2) dispositions above.

**Acceptance.**
- All five new tests pass.
- **No new test asserts a strict `>` on the glyph-top-vs-`rightStaffBottomY` bound**
  (use `>=`), per non-blocking note (2).
- **The full `npm run test:unit` suite is green** (all prior 360 tests + the new
  ones; 6 suites). This is the final gate for the feature.

---

## Cross-cutting acceptance (applies to every task)

- After each task, `npm run test:unit` is green (no suite fails to load — use
  `npm run test:unit`, never raw `npx jest`).
- The emitted ottava model stays exactly `{ hand, label, placement, x1, x2, y }`;
  `svg.js` / `renderOttava` is not edited; `ottavaFor`, `constants.js`, and the song
  schema are not edited (spec Out of Scope).
- **Zero new constants** are added (KD2/KD3). Net new symbols across the fix: 1
  helper (`lhAboveTopExtent`), 1 band field (`ottavaLeftAboveLaneY`), 2 predicates
  replacing `systemHasOttavaAbove`, plus local variables in the per-system block.
- No remaining reference to `systemHasOttavaAbove` after T2.
- No `?? ottavaAboveLaneY` fallback on the LH-above lane (KD6).

## Commit guidance

One commit per task, imperative mood / sentence case / no trailing period / agent
name in parentheses, e.g.:
`Add lhAboveTopExtent helper for the LH-above ottava lane (code-writer)`.
