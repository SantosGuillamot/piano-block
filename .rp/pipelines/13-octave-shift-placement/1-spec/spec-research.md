# Spec research — Fix octaveShift marking placement for left and right hands (#13)

Phase: Spec (analyst). This file is the running record of the requirements Q&A
between `spec-analyst` (decides) and `spec-researcher` (gathers evidence). The
`spec-writer` consumes it afterward to author `spec.md`.

## Issue summary

Each hand's `octaveShift` per-hand setting draws an ottava bracket
("8va"/"15ma"/"8vb"/"15mb") spanning the affected notes. Two reported problems:

1. A **left-hand** `octaveShift` with a positive (above) shift draws its bracket
   above the **right-hand (top / treble) staff** instead of above the
   **left-hand (bottom / bass) staff** — the bracket is detached from the notes
   it applies to.
2. The owner observed that a **right-hand** `octaveShift` may not appear on the
   **first system/line**, only on subsequent ones. Confirm whether real and in
   scope.

Scope: focused bug fix for ottava placement. No new features; keep tight.

## Initial code-reading notes (analyst, pre-Q&A)

Key locations (all in `src/notation/`):

- `layout.js:1064` `OTTAVA_LABELS = { 1: "8va", 2: "15ma", "-1": "8vb", "-2": "15mb" }`.
- `layout.js:1077` `ottavaFor(octaveShift)` → `{ label, placement }`, where
  `placement = octaveShift > 0 ? "above" : "below"`. Hand-agnostic.
- `layout.js:2859` `buildSystemTexts(members, measureModels, band)` builds the
  per-system ottava primitives. For each hand, it groups contiguous runs of a
  shared non-zero `octaveShift` and emits one bracket per run.
  - **Suspected main bug** at `layout.js:2915-2918`: for `placement === "above"`
    the bracket `y` is always `band.ottavaAboveLaneY` **regardless of hand**.
    `ottavaAboveLaneY` is a lane reserved above the **top (right) staff** only.
    So a left-hand above-shift bracket sits above the top staff — the reported
    bug. (Below placement already uses the per-hand `staffBottomY`, so a
    left-hand `8vb` likely sits correctly below the bottom staff — to confirm.)
- `layout.js:2794` `topMarginLayout(...)` computes `ottavaAboveLaneY`, a single
  lane above the top staff. There is no "above the bottom staff" lane today.
- `layout.js:1904` band `aboveLH` already exists for left-hand above-staff note
  annotations; it grows up into the inter-staff gap (`baseY = lhTopY - NOTE_GAP_STAFF`).
  A left-hand "above" ottava plausibly belongs in/near this inter-staff zone.
- `layout.js:2649` `systemHasOttavaAbove(members)` → true if EITHER hand has a
  positive shift; only used to reserve the top margin's ottava lane. (So a
  left-hand above shift currently reserves top-staff margin space too.)

Existing tests on positioning (`src/notation/__tests__/layout.test.js`):

- `ottavaFor` (l.1075): asserts label + placement mapping only (hand-agnostic).
- "starts an 8va ottava for the RH octave shift" (l.1863): the COMPREHENSIVE_SONG
  fixture sets a **right-hand** `octaveShift: 1`; asserts `hand: "rightHand"`,
  `placement: "above"`.
- "tempo, ottava, and note lanes stack above the staff" (l.1972): asserts every
  "above" ottava sits at `band.ottavaAboveLaneY` (l.1989-1991). This holds only
  because the only above ottava in the fixture is right-hand. **No test exists
  for a left-hand above ottava** — the bug is untested.

SVG layer (`src/notation/svg.js:1149` `renderOttava`) stamps
`<g data-text="ottava" data-hand=…>`; svg.test.js asserts the ottava node exists
but not its hand-relative Y.

## Placement design considerations (analyst, pre-Q&A)

A correct left-hand "above" ottava must sit above the LEFT (bottom) staff's top
line (`band.leftStaffTopY` = `lhTopY`), i.e. in the inter-staff gap, analogous to
how the `aboveLH` note band uses `baseY = lhTopY - NOTE_GAP_STAFF` (`layout.js:1905`).
The four staff-Y references available on `band` (`layout.js:1878-1881`):
`rightStaffTopY`, `rightStaffBottomY`, `leftStaffTopY`, `leftStaffBottomY`.

Subtleties the spec should flag:
- `systemHasOttavaAbove` (`layout.js:2649`) currently reserves the TOP-staff
  ottava lane whenever EITHER hand has a positive shift. A left-hand above ottava
  should not consume top-staff margin; it lives in the inter-staff gap. The
  reservation logic may need to be hand-aware (only a right-hand positive shift
  drives `ottavaAboveLaneY` / the deeper top margin).
- The inter-staff gap may need to flex to fit a left-hand above ottava
  (`effectiveInterStaffGap`, `layout.js:1859-1862`), just as it already flexes for
  `aboveLH` note stacks — otherwise the bracket could collide with the top staff's
  below-content or the bottom staff's high notes. Whether flex is required depends
  on the chosen Y; the spec should state the placement target and leave exact gap
  math to design/plan.
- Symmetry check: a right-hand "below" ottava sits at `rightStaffBottomY + 2`
  (in the inter-staff gap, below the top staff). Confirm that already-shipped case
  reads acceptably so the left-hand "above" fix mirrors it.

## Q&A log

(Questions sent one at a time to `spec-researcher`; evidence + decision recorded
below as each resolves.)

### Q1 — RESOLVED. Core bug confirmed; "below" already per-hand.

Researcher evidence (measured y values; RH staff top=5/bottom=9, LH top=17/bottom=21):
- RH +1 → y=4 (above RH top) ✓ correct
- RH −1 → y=11 (below RH, inter-staff gap) ✓ correct
- LH +1 → y=4 (above RH top) ✗ BUG — should be above LH top (~y=16, in the
  inter-staff gap)
- LH −1 → y=23 (below LH bottom) ✓ correct

DECISION: Bug 1 confirmed. Only the **"above" branch** (`layout.js:2916-2917`) is
hand-agnostic — it always uses `band.ottavaAboveLaneY` (a TOP-margin lane above
the RH staff). The "below" branch is already hand-aware via `staffBottomY`
(`rightStaffBottomY`/`leftStaffBottomY`), so a LH `8vb` and RH `8vb` already sit
correctly. **The fix targets only the LH "above" case.** The correct target for a
LH above ottava is a lane above the LH (bottom) staff top, which lives in the
**inter-staff gap** (no such lane is reserved today).

### BUG 2 — RESOLVED (root cause found; NOT right-hand-specific).

Researcher evidence: `run.xs` is populated ONLY from `laid.notes`
(`layout.js:2933-2937`); `flush()` skips emitting when `run.xs.length === 0`
(`layout.js:2904`). So when a system's portion of an octaveShift run contains NO
noteheads (e.g. that system's measures hold only rests for that hand), no bracket
is emitted on that system. Repro: a song with RH octaveShift whose first two
measures are RH whole **rests** (LH has notes), later measures have RH notes; at a
width that wraps the rest-measures onto system 1, the ottava-per-system pattern is
[absent, present, present] — missing on the first line, present after.

DECISION: Bug 2 is real but the owner's framing ("right-hand, first line") is a
mis-attribution of a more general bug: **a bracket is dropped on any system whose
portion of the run has no noteheads** (rest-only), affecting EITHER hand and ANY
system (not just the first / not just RH). My earlier section-2-start hypothesis
was wrong; the true trigger is rest-only run portions, not wrap position per se.
Single-system runs with notes, and multi-system runs with notes in every measure,
render correctly on every system. This is in scope. (See Q2 for the exact desired
behavior decision.)

## Analyst hypothesis on the right-hand-first-line symptom (to test in Q&A)

The COMPREHENSIVE_SONG fixture sets `rightHand.octaveShift: 1` in **section 2**
(starts at measure 3), NOT section 1 (`layout.test.js:916`). So the 8va only ever
appears from measure 3 onward. Whether it lands on the "first line" is purely a
function of system wrapping (width): wide → all measures on system 1 (8va on line
1); narrow → measure 3 wraps to a later system (8va only on line 2+).

Hypothesis: the owner's "right-hand octaveShift not on the first line" is likely a
mis-attribution — the shift in their song starts at a measure that wrapped to a
later system, so it correctly appears there and not before. The bracket is
restated per system across the run it spans (`buildSystemTexts` loops each
system's own members). The researcher must test the decisive case: a right-hand
octaveShift that genuinely begins at the **score's first measure** — does its 8va
render on system 1? If yes, there is no first-line bug and the second reported
symptom is out of scope (or already correct). If no, it's a real bug to fix.

[UPDATE post-Q1: hypothesis was WRONG. The real Bug-2 trigger is rest-only run
portions (no noteheads → empty `run.xs` → skipped), not wrap position. See the
BUG 2 — RESOLVED block above.]

### Q2 — RESOLVED. Measure-edge anchors available; note-X under-spans sparse runs.

Researcher evidence (`layout.js`):
- `measureModels[i]` shape (pushed at `2069-2079`): `{ number, x, width,
  isSectionStart, right, left, barlines, inline, standaloneAnnotations }`.
- `.x` = measure left edge (absolute system X) (`1966`/`2071`/advanced at `2082`).
- `.x + .width` = `measureRightX` = the RIGHT barline X (`2018`/`2072`). Verified.
- `.right.notes` / `.left.notes` = laid-out noteheads (empty for rest-only/empty hand).
- These edges come from the union-grid/spacing, NOT notes, so they EXIST even for
  a noteless measure. Empty measures still get `width = EMPTY_MEASURE_WIDTH = 3.3`
  (never 0). Spans are strictly increasing/monotone; consecutive measures aren't
  perfectly contiguous (small `trailingPad`/`BARLINE_POST_PAD` gap) but
  `[firstRunMeasure.x, lastRunMeasure.x + width]` is always sane.
- IMPORTANT extra finding: today's note-X span already UNDER-spans sparse runs even
  when a bracket IS emitted. For a 3-measure run with one note in the middle
  measure only, the bracket spans just ~1.2 sp around that lone note, while the run
  visually covers all three measures. So under-spanning is not only an all-rests
  problem.

DECISION (span behavior):
- Bug-2 minimal fix: a system's portion of a run MUST emit a bracket even when it
  has no noteheads, using the run-portion's measure-edge extent
  `[first.x, last.x + last.width]` as the anchor when `run.xs` is empty.
- Musically-correct anchoring: an ottava bracket spans the run's MEASURE extent on
  each system, with note-X as an inner refinement of the LEFT start (start at the
  first note when present, else the first measure's left edge) and the right end at
  the last run-measure's right edge. This also fixes the sparse-run under-span.
- SCOPE NOTE: the pure Bug-2 report is only the rest-only DROP. Extending the
  right end to the measure edge for sparse-but-nonempty runs is a closely related
  correctness improvement (same root cause: note-X is the wrong anchor for a span
  that is conceptually measure-scoped). I will confirm with the owner-proxy
  evidence in Q-final whether to (a) do the minimal drop-fix only, or (b) adopt
  measure-extent anchoring throughout. Leaning (b) because it is the musically
  correct, single coherent rule and avoids leaving a second visible defect; the
  spec will state the rule and let design pick exact x refinement. See Q3 below for
  the per-hand "above" lane, which is the other half of the fix.

### Q3 — RESOLVED (design-critical). LH-above needs a reserved inter-staff lane.

Researcher measured geometry (sp; smaller Y = higher). Base LH+1 plain: RHtop=5,
RHbot=9, gap=8 (=INTRA_STAFF_GAP), LHtop=17, LHbot=21; belowRH.baseY=10,
aboveLH.baseY=16 (=lhTopY−NOTE_GAP_STAFF).

(1) A FIXED offset `leftStaffTopY − k` is INSUFFICIENT — two distinct collisions:
   (a) RH below-staff dynamics/hairpin: when RH prints a point dynamic, belowRH
       dodges and belowRH.baseY drops to ~15.9 (DYNAMICS_LANE_RESERVE) while the
       inter-staff gap STAYS 8 → a LH-above ottava at ~15 lands on the RH dynamics
       row. Same risk with an RH hairpin lane.
   (b) LH high notes/ledgers (the worse, true correctness break): a LH note C5
       sits at y=12.5, G5 at 10.5 — ABOVE a fixed candidate y≈15 — and the gap does
       NOT flex for raw ledger extent. So a fixed-offset 8va would draw BELOW the
       notes it annotates. An 8va MUST sit above them.

(2) `effectiveInterStaffGap` (`layout.js:1859-1862`) accounts for NO ottava today,
   and (critically) for NO raw LH high-note/ledger extent either — only the
   `belowRH`/`aboveLH` NOTE-STACK occupancy depths feed it. So a LH-above ottava
   added at today's gap WILL overlap both the RH dynamics row and LH high notes.
   The gap (or a new LH-above lane within it) must GROW to reserve, above the LH
   staff top: max(LH-ledger/high-note extent, RH-below dynamics/hairpin/below-note
   reach) + OTTAVA_SIZE.

(3) Both hands positive: if ONLY the LH branch is fixed (LH-above → inter-staff
   gap; RH-above stays in top-margin `ottavaAboveLaneY`), the two brackets occupy
   different vertical zones and DON'T collide with each other — PROVIDED the gap
   reservation from (1)/(2) is added. OVER-RESERVATION CONFIRMED:
   `systemHasOttavaAbove` (`layout.js:2649-2652`) = `rightHand.octaveShift > 0 ||
   leftHand.octaveShift > 0` drives the TOP-margin lane; a LH-ONLY positive shift
   still deepens the top margin (+2.8 sp, same as a real RH shift) — wasted space.

DECISIONS (Bug 1 full):
- RH-above ottava: keep today's top-margin lane (`ottavaAboveLaneY`), reserved by
  an RH-positive shift ONLY.
- LH-above ottava: NEW lane in the inter-staff gap, above the LH staff top,
  reserved by an LH-positive shift; the inter-staff gap flex MUST include this lane
  so it clears (i) LH high notes/ledgers above the LH top line and (ii) the RH
  below-staff dynamics/hairpin/below-note region. A fixed `leftStaffTopY − k` is
  rejected as insufficient.
- RH-below / LH-below: already correct (per-hand `staffBottomY`); NO change.
- Split `systemHasOttavaAbove` per hand: top-margin lane reserved by RH-positive
  only; a separate inter-staff-gap reservation driven by LH-positive.
- Both-hands and either-hand-only cases all fall out of the per-hand rule above.

## Remaining required topics (status)

- [x] Q2: rest-only/sparse run X-span anchoring — measure-extent anchor, note-X
      inner refinement (minimal-vs-full confirmed in Q4 below).
- [x] Both hands positive simultaneously — Q3(3): coexist once gap reserved.
- [x] Exact LH-above Y target + inter-staff gap flex — Q3(1)/(2): reserved lane
      required, fixed offset rejected.
- [x] Top-margin over-reservation — Q3(3): split `systemHasOttavaAbove` per hand.
- [x] Multi-system spanning behavior — Q4 below (restate-per-system already correct;
      only the rest-only/sparse drop breaks it).
- [x] Test impact — Q4 below.

### Q4 — RESOLVED. Restate works; zero existing assertions break; single span rule OK.

(A) Multi-system restate ALREADY works: each system's `buildSystemTexts` builds a
run from its own measure slice (`layout.js:2923-2939`) and emits one bracket per
system. Repro: RH octaveShift over 8 note-bearing measures → ottavas-per-system =
all "8va" at widths 25/35/45 (8/4/3 systems). The ONLY break is the rest-only/
sparse-portion drop (Bug 2).

(B) Test impact — ZERO existing assertions break. No test anywhere asserts an
ottava bracket's x1/x2 (all x1/x2 assertions are hairpins/ties/slurs). The
ottava-touching tests all use RH-only fixtures and stay green:
- `layout.test.js:1075-1085` `ottavaFor` — label/placement helper; unchanged.
- `layout.test.js:1863-1870` "starts an 8va ottava for the RH octave shift" —
  RH-only; unchanged.
- `layout.test.js:1972-1992` "tempo, ottava, and note lanes stack above the staff"
  — COMPREHENSIVE_SONG has only RH +1, so all above-ottavas remain at
  `ottavaAboveLaneY`; STAYS GREEN (would only break if the fixture had an LH +1).
- `layout.test.js:1994-2028` "the top margin flexes…" — compares RH+1 vs no-shift;
  neither is an LH-only case, so the per-hand `systemHasOttavaAbove` split doesn't
  change either side; STAYS GREEN.
- `svg.test.js:1262/1299-1300` — RH +1; asserts an ottava element exists; unchanged.
- The `data-hand` tests (`svg.test.js:200-606`, `940`, `1046`, `1304-1319`) are
  about annotation NOTES and hairpin WEDGES, not ottavas; unaffected.
NO test asserts a LH ottava Y or the top margin in an LH-only-shift case → the LH
path is entirely untested today. New tests must be ADDED (see Acceptance below).

(C) Span rule scope: since nothing asserts ottava x1/x2 and no behavior depends on
a tight note-X span, adopt ONE rule for both rest-only and sparse cases: on each
system, the bracket spans the run's measure extent (first run-measure left edge →
last run-measure right edge), preferably starting at the first note's X − NOTEHEAD_RX
when a note is present (preserve the left-start refinement). Cross-system clipping
is automatic — `buildSystemTexts` already iterates each system's own slice
(`measureModels` indices i), so no new clipping logic is needed.

---

## DECIDED REQUIREMENTS (final — input for `spec.md`)

Scope: a focused bug fix to ottava-bracket placement/consistency. NO schema
changes, NO new song fields, NO change to the `octaveShift` sign→label/placement
mapping (`ottavaFor`). Two bugs.

### R1 — Per-hand "above" ottava placement (Bug 1)

R1.1 A RIGHT-hand positive `octaveShift` ("8va"/"15ma") draws its bracket above
the right-hand (TOP / treble) staff — today's behavior, unchanged. Stays in the
top-margin ottava lane (`band.ottavaAboveLaneY`).

R1.2 A LEFT-hand positive `octaveShift` ("8va"/"15ma") draws its bracket above the
left-hand (BOTTOM / bass) staff — i.e. in the inter-staff gap, above
`band.leftStaffTopY`, NOT above the top staff. (Today it wrongly sits at
`ottavaAboveLaneY` above the top staff — the reported bug.)

R1.3 The LEFT-hand above-ottava lane must reserve vertical room within the
inter-staff gap so the bracket clears BOTH (a) the left-hand staff's own high
notes / ledger lines above its top line, AND (b) the right-hand staff's
below-staff region (its `belowRH` note stack and any point-dynamic row / hairpin
lane). A FIXED `leftStaffTopY − k` offset is INSUFFICIENT (proven to collide with
LH high notes — drawing the 8va below the notes it annotates — and with the RH
dynamics row). The inter-staff gap flex (`effectiveInterStaffGap`) must grow to
include this lane. (Exact geometry left to design/plan; the requirement is
no-overlap + bracket sits ABOVE the annotated LH notes.)

R1.4 Negative ("below") shifts are UNCHANGED and already correct per-hand: a
LEFT-hand `8vb`/`15mb` sits below the bottom staff; a RIGHT-hand `8vb`/`15mb` sits
below the top staff (in the inter-staff gap). No change to the "below" branch.

R1.5 Top-margin reservation must be per-hand: the top-margin ottava lane (and the
deepened top margin) is reserved ONLY when a RIGHT-hand positive shift is present.
A LEFT-hand-only positive shift must NOT deepen the top margin (its bracket lives
in the inter-staff gap). Today `systemHasOttavaAbove` triggers on EITHER hand and
over-reserves by ~2.8 sp for a LH-only shift — split it per hand.

R1.6 Both hands positive on the same system: the RH bracket sits in the top-margin
lane and the LH bracket in the inter-staff-gap lane; they occupy distinct vertical
zones and must not overlap each other or any notes/dynamics.

### R2 — Consistent appearance across every system the run spans (Bug 2)

R2.1 A bracket is emitted on EVERY system that a non-zero `octaveShift` run spans,
including a system whose portion of the run contains NO noteheads for that hand
(rest-only). Today such a system silently drops the bracket (empty `run.xs`).

R2.2 On each system, a bracket spans the run-portion's MEASURE extent: from the
first run-measure's left edge (or the first note's X − NOTEHEAD_RX when a note is
present, preserving the left-start refinement) to the last run-measure's right
edge. This also fixes the pre-existing UNDER-SPAN where a sparse run (e.g. a lone
note in a middle measure) drew a ~1.2 sp bracket instead of covering its measures.
Measure edges (`measureModels[i].x`, `.x + .width`) are always present and
monotone, even for rest-only/empty measures (`width ≥ EMPTY_MEASURE_WIDTH = 3.3`,
never 0).

R2.3 Multi-system note-bearing runs ALREADY restate one bracket per system
correctly (per-system slices); R2 must not regress this.

### R3 — Out of scope / no change

- `ottavaFor` sign→label/placement mapping (`1:8va, 2:15ma, -1:8vb, -2:15mb`;
  positive=above, negative=below) — unchanged.
- Song schema / `octaveShift` field semantics — unchanged.
- SVG rendering (`renderOttava`) — already hand-agnostic at draw time (consumes
  `ottava.y`/`x1`/`x2`); all placement logic stays in `layout.js`. It already
  stamps `data-hand`. No SVG-layer change expected beyond what layout feeds it.

### Acceptance criteria (testable)

Existing tests (must STAY GREEN, unchanged): `layout.test.js` ottavaFor (1075),
RH 8va (1863), stack-above-staff (1972), top-margin-flex (1994); `svg.test.js`
ottava-exists (1300). New tests to ADD:
1. LH +1 → an above-ottava whose `y` is in the inter-staff gap above
   `band.leftStaffTopY` (NOT at `band.ottavaAboveLaneY`); and it clears LH high
   notes/ledgers and the RH below-staff dynamics region (no overlap).
2. LH-only +1 → the top margin (and `ottavaAboveLaneY`) is NOT reserved for the RH
   lane: top margin equals the no-shift baseline given identical above-RH content.
3. Both hands +1 → two above brackets at distinct Ys (RH top-margin, LH gap), no
   overlap.
4. Bug 2: a rest-only system portion of a run still emits a bracket; and a sparse
   run (lone middle note) spans the run's measure extent, not just ±NOTEHEAD_RX.
5. Regression guard: a multi-system note-bearing run still emits one bracket per
   system.

### Key code anchors (for design/plan/code phases)

- `ottavaFor` — `src/notation/layout.js:1077` (unchanged).
- Ottava emit + the bug — `buildSystemTexts` flush, `src/notation/layout.js:2899-2922`
  (above branch hardcodes `ottavaAboveLaneY` at `2916-2917`; `run.xs` notes-only at
  `2933-2937`; skip-when-empty at `2904`).
- Band Y refs — `src/notation/layout.js:1875-1915` (`rightStaffTopY`,
  `rightStaffBottomY`, `leftStaffTopY`, `leftStaffBottomY`, `ottavaAboveLaneY`,
  bands incl. `aboveLH` at `1904`).
- Inter-staff gap flex — `effectiveInterStaffGap`, `src/notation/layout.js:1858-1864`.
- Top-margin lane reservation — `topMarginLayout`, `src/notation/layout.js:2794-2838`;
  trigger `systemHasOttavaAbove`, `src/notation/layout.js:2649-2652` (split per hand).
- SVG draw — `renderOttava`, `src/notation/svg.js:1149`.
- Measure model fields — pushed `src/notation/layout.js:2069-2079` (`x`, `width`).
- Constants — `OTTAVA_SIZE=2.2`, `NOTE_GAP_STAFF=1`, `INTRA_STAFF_GAP=8`,
  `MID_GAP=1.2`, `EMPTY_MEASURE_WIDTH=3.3` (`src/notation/constants.js`).
