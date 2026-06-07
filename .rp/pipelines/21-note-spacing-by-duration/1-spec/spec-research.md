# Spec research — Issue #21: Space notes horizontally according to their duration

Status: COMPLETE — requirements gathered (4-question Q&A with spec-researcher).
See "FINALIZED REQUIREMENTS" at the end for the testable requirements, acceptance
criteria, edge cases, out-of-scope, and deferred open questions.

## The issue (phase-0 prompt, summarized)

Notes should be spaced horizontally by duration: shorter notes consume less
horizontal space than longer notes (eighth < quarter < half < whole). The visual
spacing should reflect note length the way standard engraved music notation does
— "proportional to (or at least ordered by) duration". A reference image (not
committed) shows beamed eighth notes sitting close together with little space,
and quarter notes given noticeably more horizontal room within the same measure.

## Key starting observation (spec-analyst pre-read of the codebase)

The duration→horizontal-space behavior already appears to be IMPLEMENTED in the
pure layout layer. This strongly shapes the requirements: the spec is likely
about confirming/refining/tuning existing behavior and pinning down its
acceptance criteria, not building from scratch. Relevant existing code:

- `src/notation/layout.js`
  - `eventDuration(event)` → duration in quarter-beats = `BASE_DUR[duration] ×
    DOT_MUL[dots]` (layout.js:361).
  - `handOnsets`, `handEnd`, `unionGrid` → build a per-measure shared onset grid
    purely from durations; both hands align on shared onsets (layout.js:715-761).
  - `advanceFor(delta, { extra })` → the horizontal advance for the gap between
    adjacent onsets: `advance(Δ) = MIN_ADV + ADV_K · sqrt(max(Δ, 0)) + extra`
    (layout.js:778). Explicitly compressive/logarithmic, NOT strictly
    proportional ("whole advances ~2.5× a 32nd rather than 32×").
  - `measureLayout(...)` → places each grid column at a running X, sums advances
    into `contentWidth`/`width`; the last column gaps to `measureEnd =
    max(handEnds)`; NEVER consults timeSignature for X/width (layout.js:809).
- `src/notation/constants.js`
  - `MIN_ADV = 2.2` (minimum advance / legibility floor), `ADV_K = 3.0`
    (compressive coefficient), `EMPTY_MEASURE_WIDTH = 3.3`, `MEASURE_START_PAD =
    1.0` (opening breathing room — added very recently, commit 4ef0889),
    `MAX_STRETCH = 1.6` (justify cap).
  - `BASE_DUR` table: whole 4, half 2, quarter 1, eighth 0.5, sixteenth 0.25,
    thirty-second 0.125. `DOT_MUL`: 0→1, 1→1.5, 2→1.75.
- Supported durations: whole, half, quarter, eighth, sixteenth, thirty-second
  (+ dots 0/1/2). (constants.js BASE_DUR / DOT_MUL.)
- Tests already assert the behavior:
  `src/notation/__tests__/layout.test.js`
  - `advanceFor` is `MIN_ADV + ADV_K·sqrt(Δ)`; compressive ratio whole:32nd is
    ~2.5:1 (between 2 and 3); NaN-safe for negative Δ; `extra` widens a column.
  - `measureLayout` returns monotonically increasing X per onset; aligns shared
    onsets across hands; extends to `max(handEnds)`; never consults timeSignature.

OPEN QUESTION this raises: is issue #21 already satisfied by the current code? If
so, what (if anything) is the owner unhappy with, and what does "done" mean for
this pipeline? This must be resolved early.

## Q&A log

### Q1 (PENDING) — Is duration-based spacing already implemented, and what's the gap vs. #21?

Asked spec-researcher to verify: (1) is the duration→X behavior wired through to
rendered SVG, not just the pure layer; (2) a concrete example — do beamed eighths
actually sit closer than quarters in real output; (3) GitHub context — was #21
filed before or after the spacing code, and what does the issue thread say. Crux:
is #21 "already done (lock acceptance criteria)", "partially done (the gap)", or
"owner wants the spacing model changed (more proportional / different ratios)".

Findings (spec-researcher):
- CONFIRMED: duration-based horizontal spacing is already implemented in the
  pure layer and wired through: `view.js` calls `buildLayoutModel` (layout.js:1721),
  which uses `measureLayout`; the emit layer `svg.js` adds NO spacing math of its
  own (svg.js:346-347) — it just renders the model's X positions.
- The duration→space rule is `advanceFor(Δ)` = `MIN_ADV + ADV_K·sqrt(max(Δ,0))`,
  where Δ = gap in quarter-beats to the next onset. Compressive/logarithmic by
  design (≈ doubling duration → ×1.5 space), with a `MIN_ADV` floor and per-column
  `extra` for accidental/dot/flag clearance.
- Computed actual advances (sp) and ratio vs eighth:
  32nd 3.26 (0.75×) · 16th 3.70 (0.86×) · eighth 4.32 (1.00×) ·
  quarter 5.20 (1.20×) · half 6.44 (1.49×) · whole 8.20 (1.90×).
  Ordering is correct and strictly monotonic with duration; whole:32nd ≈ 2.5:1.
- Beaming exists (`beamGroups` layout.js:425, `beamGeometry` layout.js:506);
  beamed eighths get the same small compressive advances, so they sit close —
  matching the reference image's description.
- Tests already lock the behavior (layout.test.js `advanceFor` 748-775,
  `measureLayout` 777+): formula, ~2.5:1 ratio, NaN-safety, monotonic X,
  union-grid alignment, wider gap for a longer trailing note.

Researcher's flagged nuances / open questions:
1. "Ordered-by-duration" (current, compressive) vs. stricter proportionality —
   the issue says "proportional to (or at least ordered by)". Need owner intent.
2. If #21 is "make it look more like the reference," this may be constants-tuning
   (MIN_ADV / ADV_K), not new logic.
3. Reference image is unavailable (prompt says request from owner). Can't compare
   exact ratios without it.
4. Not yet empirically confirmed via a running render (read pure layer + tests).

IMPLICATION: #21 appears already satisfied by the "ordered by duration" reading.
The requirements work is now about (a) confirming the intended interpretation,
(b) deciding whether this pipeline locks/validates current behavior or changes
the model, and (c) capturing testable acceptance criteria + edge cases either way.

### Q2 (ANSWERED within researcher's Q1 reply) — GitHub/git timeline + issue thread

The researcher's Q1 answer also covered the decisive timeline evidence I asked
about in Q2. Verbatim-relevant facts:

- Issue #21: created 2026-06-07 18:55Z, 0 comments, state OPEN, author is the
  owner (SantosGuillamot). Labels are this pipeline's own auto labels
  (`0 - Prompt`, `running...`, `v1`); the issue body IS the prompt.md we have.
  → It's an auto-generated pipeline issue, NOT a hand-written bug report with
  owner complaints. No stated dissatisfaction with current behavior.
- Spacing engine PREDATES #21 by ~3.5 days: "Add union-grid alignment and
  compressive spacing" committed 2026-06-04 00:13Z; `MIN_ADV` landed even earlier.
- Full end-to-end wiring CONFIRMED: view.js:133 buildLayoutModel →
  measureLayout per measure (layout.js:2043-2056 via layoutHand) →
  note.x = columnX.get(onset) (layout.js:1453) → svg.js renderNote draws every
  notehead at note.x (svg.js:730), measure <g> translated by measure.x
  (svg.js:518). svg.js:346-347 states the emit layer adds NO spacing math.
  render.php only ships raw song JSON; edit.js is the editor textarea.
- PRECEDENT (this project files one issue per incremental engraving refinement
  atop shipped code): #14 "Add more horizontal space at the start of each measure"
  (closed 2026-06-05) → became MEASURE_START_PAD; #15 "Beam chained eighth notes
  as a single group" (closed 2026-06-05) refined existing beaming. #21 fits this
  exact mold — spacing/engraving polish on an existing foundation.

CONCRETE RENDER (researcher ran the production path): one 4/4 measure, RH = four
eighths then two quarters, wide width (no justify):
- The four eighths form ONE beam group (indices [0,1,2,3]).
- Note X (sp): e0=1.00, e1=5.32, e2=9.64, e3=13.96, q4=18.29, q5=23.49.
- Gaps: eighth→eighth = 4.32 sp; quarter→quarter = 5.20 sp. Eighths ARE closer
  than quarters. Ordering correct and visible.
- Mechanism for AC wording: a note "owns" the gap to the NEXT onset = its OWN
  duration. So a column's width is governed by the LEFT note's duration (standard
  engraving); a note's width does NOT depend on what follows it.

COVERAGE GAP (researcher): there is NO render-/SVG-level test asserting "eighths
closer than quarters in a real measure." specs/render.spec.js covers only the
three display states + injection safety, not spacing. Pure-layer tests assert the
formula + monotonic X but not the mixed-duration scenario end-to-end. An AC for
#21 can close this gap.

CONTRAST (the one substantive open judgment call):
- Current eighth:quarter advance ratio = 1.20:1 (5.20 vs 4.32 sp) — visible but
  gentle. whole:eighth = 1.90:1; whole:32nd ≈ 2.5:1.
- Strictly LINEAR/proportional (anchored eighth=4.32) would give quarter=8.64,
  half=17.28, whole=34.56 — far more contrast, but NOT how engraving works
  (engravers use ~logarithmic/Gould ~1.5× per doubling; the sqrt model
  approximates that well).
- If the (unavailable) reference image shows starker eighth-vs-quarter contrast,
  #21 may want a contrast bump — a pure constants tune, no new logic. Researcher
  modeled options: MIN_ADV 1.2 / ADV_K 4.0 → q/e 1.29, whole/e 2.28; MIN_ADV 0.8
  / ADV_K 5.0 → q/e 1.34, whole/e 2.49. CAUTION: MIN_ADV is also the per-column
  clearance floor, so lowering it too far risks glyph collisions on dense columns.

Researcher's suggested AC direction (WHAT, not HOW):
1. Within a measure, a shorter note occupies less horizontal space than a longer
   one (eighth < quarter < half < whole); monotonic in duration. [already true]
2. Consecutive beamed eighths sit close (tight, equal spacing); quarter+ notes
   have visibly more room. [already true; four-eighths-then-quarters fixture]
3. (OPEN — owner) a target/minimum eighth-vs-quarter contrast ratio, if 1.2:1 is
   too subtle.
4. The behavior holds in the rendered SVG, not just the pure layer (close gap).

### Q2 ANSWER (researcher's deeper dive) — intent confirmed + ORIGINAL DESIGN CONTRACT found

Intent signal (decisive):
- `gh issue view 21 --comments` → ZERO comments. createdAt 2026-06-07T18:55:08Z,
  updatedAt 19:00:30Z (5 min = just labeling automation), state OPEN.
- Labels are automation labels, NOT human triage: `running...` ("WIP by an AI
  agnet" [sic]), `0 - Prompt`, `v1`. No "bug"/"enhancement" label.
- Body = our prompt.md verbatim: DESCRIBES a desired behavior; does NOT say
  current spacing is wrong/broken/insufficient. Machine-filed intent statement.
- Git dates: `advanceFor` + `measureLayout` landed e295544 2026-06-04 ("Add
  union-grid alignment and compressive spacing"); planned 7c3ee3f 2026-06-03;
  `MIN_ADV`/`ADV_K` designed d2aafe3 + 9df132d 2026-06-03, implemented 8a8382e.
  Spacing engine is ~3-4 days OLDER than #21.
- No branch/PR/commit targets #21 (`git log --all --grep='#21'` empty;
  `gh pr list --search 21` → []); only our worktree branch exists.
- PRECEDENT confirmed via PRs: PR #18 "…breathing room at the start of each
  measure" Closes #14 = MEASURE_START_PAD polish; PR #16 "Beam chained eighth
  notes…" Closes #15 = beaming polish ("all horizontal layout … untouched"); the
  engine itself shipped in PR #6 Closes #4. #21 fits the #14/#15 mold exactly.
- READ: machine-filed verify/lock/polish issue on a deliberately-designed, shipped
  engine. No owner dissatisfaction to satisfy.

HARD CONSTRAINT — original design contract (authoritative, sourced):
- `.rp/pipelines/4-render-sheet-music/2-design-doc/design-doc-research.md` §Q6
  DELIBERATELY chose compressive over strict-proportional spacing, citing
  engraving sources (RPM Seattle; LilyPond horizontal-spacing/proportional-
  notation; MuseScore): "Real engraving spacing is logarithmic (~1.5:1 per
  duration-doubling), not 2:1… Strict proportional would make a whole note 32× a
  32nd — absurd. Formula: advance(Δ) = MIN_ADV + K·sqrt(Δ), MIN_ADV ≈ 2.2 sp,
  K ≈ 3.0 sp. Verified whole vs 32nd ≈ 2.5:1." Decision: "Adopt the union-grid +
  compressive-spacing algorithm verbatim."
  → The spec MUST NOT demand strict linear proportionality — that contradicts a
  standing, sourced design decision. Use the issue's own fallback: "ordered by
  duration, the way standard music notation does it" (the sqrt model satisfies it).
- AGENTS.md: shipped code/user-docs must NOT reference `.rp/` artifacts. The `.rp`
  design doc is cited HERE for spec rationale only; it must not appear in
  src/ or docs/.

No user-facing spacing contract exists yet:
- docs/song-format.md: no duration→horizontal-width contract. Only the standalone-
  annotation `beat` anchor documents the quarter-beat unit (song-format.md:270;
  quarter=1, eighth=0.5) — nothing about note spacing/width.
- README.md: no spacing/compression contract.
  → Nothing to break; documenting duration→spacing is an additive docs opportunity
  for a later phase, not a contract to preserve.

FRAMING LOCKED: #21 = "already done in substance — verify, lock acceptance
criteria, polish/tune only if contrast is too subtle." Core requirement = ordinal
duration-ordering (testable today). Strict proportionality is OUT (designed
against). Contrast ratio is the only soft/owner-dependent point; without the
reference image, ACs stay ORDINAL ("eighth columns spaced more tightly than
quarter columns; whole > half > quarter > eighth > sixteenth"), not numeric.

### Q3 ANSWER (edge cases A–G, all empirically verified by running buildLayoutModel)

All seven are CURRENT, CORRECT behavior to LOCK with tests. No behavioral gaps in
duration-spacing exist; the only real gap is TEST COVERAGE (no SVG-/integration-
level test asserts these orderings — existing tests cover the advanceFor formula +
monotonic X, not these scenarios). These seven cases are a ready-made test matrix.

A. JUSTIFY/STRETCH — ordering AND ratios preserved. Justify is per-system via
   `systemScale(contentSp, availSp, {isLast})` (layout.js:1822, called 1395),
   returning `advanceScale` (stretch grid advances) + `downscaleFactor` (shrink a
   system if one measure overflows). Stretch multiplies EVERY grid advance
   uniformly: `cx += col.advance * advanceScale` (layout.js:2040); ratios
   invariant. Empirical: advanceScale 1.249 → e→e 5.397, q→q 6.494 (= base
   ×1.249). advanceScale clamped [1, MAX_STRETCH=1.6] (layout.js:1407); LAST
   system left ragged (scale=1, layout.js:1402). MEASURE_START_PAD / lead inset is
   NOT stretched (`scaledContent = leadInset + scaledGrid`, layout.js:2032 —
   leadInset added unscaled; first-note X stayed exactly 1.0 across systems). The
   system leading reserve (clef/keysig/timesig) is excluded from the justify budget
   and never scaled (layout.js:1819).
B. CROSS-MEASURE/SYSTEM — identical INTRINSIC advance. Spacing computed per-measure
   independently (`measureLayout` layout.js:809); a note's advance depends only on
   the gap to its own next onset. Empirical: every quarter-led gap = 5.200 sp in
   an all-quarters measure AND for a lone quarter after four eighths in another
   measure. Caveat: final on-screen X is ×advanceScale per system, so two quarters
   in differently-stretched systems can render at different ABSOLUTE gaps — but the
   intrinsic advance is identical and ordering/ratio holds within each system
   (correct engraving; lines justify independently).
C. DOTTED NOTES — strictly between base and next. `eventDuration = BASE_DUR ×
   DOT_MUL` (layout.js:361); dotted-quarter = 1.5 qb. Advances: quarter 5.200,
   dotted-quarter 5.874, half 6.443 → dotted ∈ (quarter, half). Dots widen
   spacing monotonically.
D. RESTS — full grid citizens, duration-proportional, same rule as notes
   (handOnsets sums every event incl. rests, layout.js:715-722). Half-rest 6.443 >
   eighth-rest 4.321.
E. CHORDS — one onset / one column; footprint by duration, not head count. A chord
   = one event with multiple pitches at one note.x; stackChord (layout.js:1478) is
   a Y/side concern. Empirical: 3-note chord quarter → next-gap 5.200, identical to
   a single-note quarter. Stacked heads do NOT widen the column. (Aside, OUT of
   scope: seconds-rule displaced heads sit ~1 head-width to the side, a vertical
   clearance concern, not duration spacing.)
F. MIN_ADV FLOOR — ordering still holds for the shortest notes; floor never ties
   two durations. advanceFor = MIN_ADV + ADV_K·sqrt(Δ): a constant floor + a
   strictly-increasing term ⇒ strictly monotonic in Δ, so two distinct durations
   can never be equal. Floor share: 32nd 67.5% … whole 26.8% (compression bottoms
   out toward short notes but never flattens). Closest adjacent pair still
   distinct: 16th/32nd ratio 1.135, 8th/16th 1.168. (More short-end separation
   would be a MIN_ADV/ADV_K tune; lowering MIN_ADV risks glyph collisions since
   it's also the clearance floor — validate-don't-invent, like contrast.)
G. SINGLE-DURATION MEASURE — perfectly uniform (the common case). Four quarters →
   Xs [1, 6.2, 11.4, 16.6], gaps [5.2, 5.2, 5.2]. First X = MEASURE_START_PAD 1.0.

SUMMARY TABLE (current advances, sp, no stretch):
  32nd 0.125→3.261 · 16th 0.25→3.700 · eighth 0.5→4.321 · quarter 1→5.200 ·
  dotted-quarter 1.5→5.874 · half 2→6.443 · whole 4→8.200.

### Q4 ANSWER (scope boundaries & definition of done)

1. DELIVERABLE = verification (test coverage). The only real gap is provable
   protection: no test asserts duration-ordered spacing at the measure/integration
   or SVG level today (only advanceFor's formula + measureLayout's monotonic-X are
   unit-tested). REQUIRED: layout-level tests over the A–G matrix (home:
   src/notation/__tests__/layout.test.js). NICE-TO-HAVE (recommend ≥1): an SVG-/
   render-level assertion that eighths' rendered notehead X's are closer than
   quarters' — proves end-to-end wiring (svg consumes note.x). DoD framing: "the
   behavior is specified and regression-protected," not "we changed code." If tests
   pass against current code with zero source changes, #21 is satisfiable as a
   TEST-ONLY PR. No other code change required.
2. CONTRAST TUNING = OUT for v1 (option a, agreed). The issue says "proportional to
   (OR AT LEAST ordered by)" — the parenthetical explicitly accepts ordinal, which
   is met. Can't see the image → any ratio is invented (violates validate-don't-
   invent). Compressive model is a sourced design decision. So: ordinal ACs only;
   current compressive model is the accepted behavior; defer any ratio/contrast
   change to a FOLLOW-UP issue conditioned on the owner supplying the reference
   image (a clean ADV_K/MIN_ADV tune, like #14 was for the opening pad).
3. NON-GOALS (all confirmed OUT): strict linear proportionality (designed against);
   beaming/grouping logic (#15's domain — may USE beamed eighths as a fixture, not
   change beam logic); vertical concerns (chord head displacement / seconds rule,
   stem/flag/accidental clearance via columnExtra); leading reserve /
   MEASURE_START_PAD (#14's domain); barline/measure-width math beyond duration
   advances; cross-system ABSOLUTE-gap equality (lines justify independently — only
   intrinsic advances + within-system ordering guaranteed; do NOT write an AC like
   "a quarter is always N px"). ADDS: justify/wrapping policy (MAX_STRETCH,
   packSystems, downscale-on-overflow) is OUT as a thing to CHANGE but IN as a
   CONSTRAINT the ACs must hold under (ordering survives justification);
   audio/playback timing (notation-only — durations affect space NOT sound); the
   `beat`-anchored standalone-annotation X interpolation (sole NOTE_CLAMP_INSET
   user) is a separate annotation feature, OUT.
4. OVERFLOW / NON-SUMMING — ordering holds, time-sig-blind, NaN-safe, NO clamp on
   note X. Verified: 20 eighths in 4/4 (5× overfull) → 20 notes, X strictly
   monotonic, no NaN, every gap 4.321; mixed overfull keeps eighth 4.321 / quarter
   5.200 ordering past the bar end. Structural: the X/width layer never reads the
   time signature (layout.js:700-702). Guards: sqrt(max(Δ,0)), empty-grid short-
   circuit, measureEnd = max(handEnds,0). NOTE_CLAMP_INSET does NOT touch note
   spacing — used only to rein an over-content `beat`-anchored ANNOTATION inside
   the trailing barline (layout.js:1691); note column X is never clamped.
5. INPUT VALIDATION — graceful. Empty measure → finite EMPTY_MEASURE_WIDTH-based
   width, both staves drawn. Unknown duration ("quaver") → eventDuration 0 →
   shares the next onset → unionGrid collapses to one column (overlap) but NO crash
   / NaN — HOWEVER unreachable in production: validateSong rejects unknown
   durations (closed enum) and view.js renders NOTHING for a non-conformant song
   (view.js:118). So only conformant durations reach the layer; the zero-gap
   collapse is defense-in-depth. Missing pitches → note skipped, width stays
   finite. Phrase ACs around the PRACTICAL guarantee (conformant input only, since
   the validator is the gate) + NaN-safety as a defensive property; do NOT promise
   sensible layout for invalid durations (validation excludes them).

NET DOD (researcher's wording, adopted): #21 is DONE when the duration-ordered
horizontal spacing behavior (the A–G matrix, time-sig-blind, justify-stable,
ordinal) is specified as the accepted behavior and locked by automated tests at
the layout level (and ideally one render-level assertion), with NO change to the
compressive model, beaming, vertical clearances, leading pad, or wrapping.
Contrast/ratio tuning is explicitly deferred pending the owner's reference image.
Likely PR is test-only (+ optional docs note); no behavioral source change
required.

## FINALIZED REQUIREMENTS (for the spec-writer)

Context: duration-ordered horizontal spacing is ALREADY implemented and wired
(src/notation/layout.js advanceFor/measureLayout → note.x → svg.js). Issue #21 is
a machine-filed verify/lock/polish issue (the #14/#15 refinement pattern). The
deliverable is to SPECIFY the accepted behavior and LOCK it with tests; the likely
PR is test-only with no behavioral source change.

### Functional requirements (WHAT the system must do)
R1. Within a measure, horizontal space is ordered by note duration: a shorter note
    occupies LESS horizontal space than a longer one. The full ordering must hold:
    thirty-second < sixteenth < eighth < quarter < half < whole (strictly
    monotonic; no two distinct durations get equal space).
R2. The space a note occupies is governed by its OWN duration (the gap to the next
    onset), not by the number/duration of following notes nor by how many pitches
    are stacked in a chord.
R3. A dotted note occupies MORE space than its undotted base value and LESS than
    the next-longer value (e.g. dotted-quarter strictly between quarter and half).
R4. Rests are spaced by duration on the SAME rule as notes (a half rest occupies
    more space than an eighth rest).
R5. A chord occupies a SINGLE horizontal column governed by its (single) duration;
    stacking multiple pitches does not widen the column.
R6. Beamed eighth (and shorter) notes sit close together with tight, equal spacing;
    quarter and longer notes have visibly more space around them. (Matches the
    reference image's described effect; uses existing beaming unchanged.)
R7. A measure whose notes all share one duration is spaced UNIFORMLY (equal gaps) —
    the common case must look right.
R8. Duration-ordering must be PRESERVED under system justification: stretching a
    system scales inter-onset advances uniformly, so eighth-vs-quarter ordering
    (and the advance ratio) survives. Spacing is independent per measure, so a
    note's INTRINSIC advance depends only on its duration (equal durations get
    equal intrinsic advances everywhere, pre-justify).
R9. The spacing rule is time-signature-blind and robust to over-/under-full
    measures: each note is spaced by its own duration with no clamp distorting the
    ordering, and the layout stays finite (no NaN/Inf/throw).

### Acceptance criteria (testable; ORDINAL, not numeric ratios)
AC1. In a single measure of [eighth, eighth, eighth, eighth, quarter, quarter], the
     consecutive eighth→eighth column gaps are EQUAL and SMALLER than the
     quarter→quarter gap. (Layout-level; the canonical fixture.)
AC2. Column advances are strictly monotonic across the duration range:
     advance(32nd) < advance(16th) < advance(eighth) < advance(quarter) <
     advance(half) < advance(whole). No two distinct durations are equal.
AC3. advance(dotted-quarter) is strictly between advance(quarter) and advance(half).
AC4. advance(half rest) > advance(eighth rest); rests participate in the grid.
AC5. A chord event and a single-note event of the SAME duration produce the SAME
     column advance (head count does not change the footprint).
AC6. A measure of N equal-duration notes yields N−1 EQUAL consecutive gaps (uniform).
AC7. Under justification (a non-last, stretched system), eighth gaps remain smaller
     than quarter gaps and the ratio is preserved (uniform scale). The score's last
     system is left ragged (scale 1). The leading lead-in is not stretched.
AC8. Two equal-duration notes in different measures have the SAME intrinsic advance
     (pre-justify). [Do NOT assert equal ABSOLUTE on-screen gaps across systems.]
AC9. An over-full measure (e.g. 20 eighths in 4/4) lays out with strictly monotonic
     X, all gaps equal to the eighth advance, no NaN — identical layout regardless
     of the time signature passed.
AC10. (RECOMMENDED, render-level) In the rendered SVG for AC1's fixture, the eighth
     noteheads' X positions are closer together than the quarter noteheads' — proves
     the duration→X behavior reaches the screen, not just the pure layer.

### Edge cases (covered by the above; explicit for the test matrix)
- Shortest notes where MIN_ADV dominates still keep distinct, ordered advances
  (16th vs 32nd differ ~13.5%). [AC2]
- Empty measure → finite floor width, both staves drawn, no NaN. [robustness]
- Malformed/unknown duration is gated by the validator (closed enum) + render-or-
  nothing (view.js:118), so it never reaches the layer in practice; the layer is
  additionally NaN-safe as defense-in-depth. Spec phrases the guarantee around
  CONFORMANT input. [robustness]

### Out of scope / non-goals (v1)
- Strict linear/2:1 proportionality (deliberately designed against; engraving is
  compressive/logarithmic).
- Any change to the compressive spacing MODEL or its constants (MIN_ADV/ADV_K) —
  i.e. contrast/ratio TUNING is deferred to a follow-up gated on the owner's
  reference image. Current ~1.2:1 eighth:quarter contrast is the accepted v1
  behavior.
- Beaming/grouping logic (which notes share a beam) — unchanged (#15's domain).
- Vertical concerns: chord head displacement (seconds rule), stem/flag/accidental
  clearance (columnExtra).
- Leading reserve / opening breathing room (MEASURE_START_PAD — #14's domain).
- Barline/measure-width math beyond the duration advances.
- Cross-system ABSOLUTE-gap equality (lines justify independently).
- Justify/wrapping POLICY changes (it is a constraint ordering must hold under, not
  a deliverable).
- Audio/playback timing (notation-only; durations affect space, not sound).
- The `beat`-anchored standalone-annotation X interpolation (separate feature).
- Documentation of the duration→spacing contract is OPTIONAL/additive (no existing
  user-facing contract to preserve); a later docs phase may add a short note.

### Open questions (deferred, NOT blocking the spec)
- OQ1. Is the current eighth-vs-quarter contrast (~1.2:1) strong enough vs the
  owner's reference image? Unresolvable without the image; deferred to a follow-up.
  The spec stays ORDINAL and does not invent a target ratio.
- OQ2. Should more separation be added among the shortest notes (where MIN_ADV
  dominates)? Same validate-don't-invent posture; deferred.

STATUS: requirements complete; no major open questions block a clear, testable
spec. Ready to commit and hand to the spec-writer.
