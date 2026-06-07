# Requirements — Beam chained eighth notes as a single group instead of in pairs

_Source: GitHub issue [#15](https://github.com/SantosGuillamot/piano-block/issues/15)._

## Rough idea

When several eighth notes are chained together, the Piano block's sheet-music
rendering should join them under a single beam — as standard music notation
does — instead of always splitting them into separate pairs of two.

Current behaviour (per the issue's reference image of the block's own output):
runs of consecutive eighth notes are beamed only two-by-two; each beam connects
at most two eighth notes, longer runs are broken into several separate two-note
beam groups, and a leftover odd note renders with an individual flag. Desired
behaviour (per the issue's reference image of conventional sheet music, a
beginner piano-method excerpt with solfège labels): consecutive ("chained")
eighth notes are beamed together as one group, one beam spanning the whole run.

### What the code does today (read from the worktree, recorded as starting context)

- The beaming grouping lives in `beamGroups(events, timeSignature)` in
  `src/notation/layout.js`. It walks a measure's events for one hand, tracking a
  running position `pos` in quarter-beats, and **breaks the open beam group at
  every beat boundary** (`floor(pos / beatLen)` changing), as well as at a rest,
  a non-beamable note, the measure end, or a beat-boundary-crossing note.
- The "beat length" used for grouping comes from `beatGroupLength(timeSignature)`:
  simple metres use one `beatType` unit (so 4/4 → beat length 1 quarter-beat →
  eighth notes, 0.5 each, beam in **pairs**); compound metres (6/8, 9/8, 12/8)
  use a dotted beat (three units → eighths beam in **threes**).
- Net effect in 4/4: the "two-by-two" beaming the issue describes is produced by
  beat-boundary breaking, NOT by a hard-coded "max 2" rule. A group of length 1
  is emitted as a flagged note (`isBeam: false`), which is the "leftover odd
  note with a flag" the issue describes.
- Existing tests in `src/notation/__tests__/layout.test.js` assert the current
  behaviour explicitly: "beams 4/4 eighths in twos", "beams 6/8 eighths in
  threes (compound)", "20 eighths → 10 pairs". These tests encode the behaviour
  the issue wants changed and will need to be reconciled.

### Central tension to resolve through research

The issue invokes "standard music notation". In conventional engraving,
4/4 eighth notes are normally beamed **in groups of two, by beat** — which is
what the code does today. The desired reference image is a **beginner
piano-method** style where a whole run of eighths is beamed as one. So the
question is not simply "beam everything in one" — it is to pin down *what counts
as a "chained" run that should beam as one group* and how that interacts with
beat boundaries, time signatures, rests, mixed durations, and what data drives
it. This is the primary thing the Q&A must settle.

## Q&A

### Grounding (confirmed by spec-researcher, read + run against real code)

The researcher independently confirmed the root cause and added detail (verified
by reading and by running the actual functions):

- `beamGroups()` (`src/notation/layout.js:410-467`) is NOT a hard "max 2" cap. It
  collects beamable notes (`isBeamable`, `layout.js:226-230`: eighth-or-shorter
  notes; rests and quarter-or-longer break a run) and breaks a run at every BEAT
  BOUNDARY. The beat length is `beatGroupLength()` (`layout.js:376-386`): simple
  metres → 1 quarter-beat; compound (6/8, 9/8, 12/8) → 1.5. An eighth is 0.5
  quarter-beats, so a 4/4 beat holds exactly two eighths → pairs. The break is at
  `layout.js:443-461`.
- Leftover-flag symptom (issue Image 1): a length-1 group is emitted as a FLAGGED
  singleton, not a one-note beam (`isBeam = indices.length > 1`, `layout.js:421`);
  consumed at `layout.js:1499 & 1511` (`flagCount: beamed ? 0 : decoded.flagCount`).
  So "3 eighths in 4/4" → [0,1] beamed + [2] flagged.
- Default (no timeSignature): `beatGroupLength(undefined) = 1` → behaves like 4/4
  → pairs. `timeSignature` is resolved per-section
  (`resolveSectionContexts`, `layout.js:893-910`, default `null`) and passed to
  `beamGroups` ONLY for grouping; it is NEVER used for X/width (layout is
  deliberately time-signature-blind for horizontal positions).
- Empirically verified by the researcher: 6 eighths (no ts or 4/4) →
  `[[0,1],[2,3],[4,5]]`; 6 eighths in 6/8 → `[[0,1,2],[3,4,5]]`; 3 eighths in 4/4
  → `[0,1]` beam + `[2]` flagged. All 7 `beamGroups` tests currently pass.
- Beam DRAWING geometry (`beamGeometry()`, `layout.js:491-561`) already draws ONE
  flat primary beam spanning the whole group regardless of size, with secondary
  beams (16th/32nd) and stubs between adjacent members. So widening the groups
  should "just work" visually — the geometry layer does not assume pairs.
- Validation does NOT enforce that events sum to the time signature, and `pos` may
  overflow the bar (`validate.js:29-31`; the "20 eighths → 10 pairs" test). Any new
  grouping rule must stay robust to events that do not align to beats.

_Implication (researcher, not a decision): the fix is about WHICH notes share a
group — the breaking rule in `beamGroups`. Options to weigh: relax/remove the
beat-boundary break so a chained run beams as one, vs. a more nuanced "sub-beam at
the beat but keep one primary beam" (true engraving). Tests at
`layout.test.js:341-422` and the 6/8 compound expectation will need updating._

### Q1 — Is "one beam per chained run" standard engraving, beginner-method style, or context-dependent?

**Question.** In standard Western engraving, what is the convention for beaming a
run of consecutive eighths in a measure? Is the issue's desired image (one beam
over a run) a DEVIATION toward beginner-method style, or a CORRECTION of
over-fragmented beaming? Cite engraver defaults (LilyPond/MuseScore/Finale) and
references (Gould, Read).

**Answer (spec-researcher).** This is a CORRECTION toward standard engraving, with
a precise caveat. Standard engraving beams eighth-runs by a METRIC group, not in
pairs and not as one unbroken run across the whole bar:

- **4/4:** a run of 8 eighths is beamed as TWO GROUPS OF FOUR (beats 1–2 and 3–4),
  never four pairs, and never one group of eight. The half-bar middle (beat 3)
  must stay visible ("don't beam across the centre of the bar"). Today's code's
  pairs are too FINE; one unbroken beam of eight would be too COARSE. The correct
  4/4 target is groups of four (half-bar).
- **This is the modern publishing default, not a fringe/beginner style.** MuseScore:
  4/4 eighths beam "in groups of four by default… the common standard… for at
  least the past 100 years." LilyPond: "4/4 tries to beam the measure in two if
  there are only eighth notes" → two groups of four.
- **Beginner image vs. standard rule AGREE for the common short case:** four
  eighths on beats 1–2, or six eighths in 3/4, get ONE beam under both. They only
  diverge for a FULL bar of 8 eighths in 4/4 (standard splits 4+4; a naive
  "whole-run" merge makes 8). The issue's "pairs + leftover flag" deviates from
  BOTH the beginner look and standard engraving — it is over-fragmenting either
  way.
- **Root cause restated in these terms:** `beatGroupLength()` sets the 4/4
  grouping unit to ONE quarter-beat; standard engraving's 4/4 grouping unit is the
  HALF-BAR (two quarter-beats → groups of four). The grouping unit is half as long
  as it should be. The fix is fundamentally about the SIZE of the grouping unit,
  not removing grouping.

**Flagged contradiction / open decision (3/4 and "how far to merge").** Sources
disagree on how large the metric group should be:
- LilyPond default: 3/4 eighths beam as a FULL MEASURE (one group of six).
- mymusictheory (teaching): 3/4 → three pairs (one per beat).
- musicnotes shows BOTH 3/4 groupings as acceptable.
This is a genuine ambiguity in the conventions. It yields TWO defensible target
rules the spec must choose between:
- **Option A — metric-group cap (engraving-correct):** beam by the metric group,
  where the group is the HALF-BAR in simple duple/quadruple metres (4/4 → groups
  of 4) and the dotted beat in compound (6/8 → 3). 8 eighths in 4/4 → 4+4. Stays
  within standard engraving; satisfies the chained-run intent for the common case.
- **Option B — whole-run merge:** beam the entire chained run to the bar
  regardless of the bar middle (8 eighths in 4/4 → one group of 8). Most literal
  to the beginner image and matches LilyPond's 3/4 full-bar default, but violates
  the 4/4 don't-cross-the-middle rule for a full bar.

The reference image only proves the SHORT case and cannot disambiguate A vs. B.
Researcher's recommendation: **Option A as default**, call out B as the
alternative — the requester most likely wants "stop breaking obviously-connected
runs," which A delivers while staying engraving-correct.

**Geometry note (likely out of scope).** `beamGeometry` already draws ONE primary
beam across the whole group with secondary beams only where adjacent notes share
them, so simply MERGING groups yields the right "one continuous beam" visual.
Sub-beat secondary-beam breaking (for 16ths/32nds) is a finer refinement.

**Sources.** LilyPond Notation Reference 2.25 "Beams"; MuseScore handbook/forum
(groups-of-four default); Musicnotes "Note Beaming and Grouping"; mymusictheory
"Beaming in Groups"; musicengravingtips.com summarizing Gould "Behind Bars"
(NOTE: that page's TLS cert is expired and could not be fetched first-hand — Gould
quote is via search summary + corroborating sources, a verification gap).
In-repo: `layout.js:376-386`, `:410-467`, `:443-461`; tests
`layout.test.js:341-422`.

**Verdict (spec-researcher, follow-up).** The answer is (c) context-dependent, but
for THIS issue it is a BUG-FIX, not a deviation into a beginner style:
- (a) FALSE — pairs-in-4/4 (today's code) is NON-STANDARD. Every major engraver
  defaults to groups of FOUR in 4/4.
- (b) HALF-TRUE — "one beam over the whole run" is standard only up to a metric
  limit: the full bar in 2/4 and 3/4, but the HALF-bar (group of 4) in 4/4.
- (c) precise truth — the grouping UNIT is metric and metre-dependent. Beginner
  books favour larger groups, which COINCIDES with standard engraving for the
  short runs the issue shows. So the reference image is a CORRECTION of
  over-fragmentation, not a non-standard beginner deviation.

Decisive evidence — engraver DEFAULTS for 8 eighths in 4/4 are "groups of FOUR"
(4+4), neither 4 pairs nor one beam of 8:
- **Finale** has a Document Option literally named "Beam Four Eighth Notes Together
  in Common Time," ON by default; deselecting it gives groups of two. So PAIRS is
  Finale's explicitly NON-default setting — today's code behaves like Finale with
  that standard option turned OFF. (Most decisive citation.)
- **MuseScore** default: groups of four ("the common standard… past 100 years").
- **LilyPond** default: 4/4 beams the measure in two → two groups of four.
- **Verovio**: no clean default-grouping datapoint — it honours beams encoded in
  MEI/MusicXML rather than auto-grouping (gap noted).
- **Gardner Read, "Music Notation"**: direct textual support that a FULL bar of
  eighths in 2/4 and 3/4 may be beamed as ONE group ("a similar convention is
  allowed for 3/4") — exactly the "single beam over a run" the issue wants.

Net for the spec decision: this is a GLOBAL grouping correction (option (i)), not a
pedagogical-mode toggle (not (iii)) and needs no new config (not (ii)). The ONLY
genuine open question is the 4/4 full-bar case (4+4 vs 8), which the reference
image cannot disambiguate. Researcher recommends the engraving-correct metric rule
(4/4 → 4+4; 2/4 & 3/4 → full bar; 6/8 → dotted beat of 3) as the default, listing
"always one beam per run even across the 4/4 middle" as an explicit open question
for the requester. Confidence: HIGH.

Additional sources: Finale user manual Document Options–Beams; Gardner Read "Music
Notation: A Manual of Modern Practice" (archive.org/details/musicnotationman00read,
via search summary — first-hand scan not paged, gap noted).

### Q2 — Does the issue wording + the repo's own data favour Option A or B?

**Question.** (2a) Read literally, does the issue's language lean toward A (metric
half-bar grouping) or B (literal whole consecutive run), or is it silent on the
full-bar-of-8-in-4/4 case? (2b) Across the repo's actual data, is the A/B
divergence ever exercised, or do all fixtures fall in the short-run zone where A
and B agree?

**Answer 2a (spec-researcher) — wording is SILENT on full-bar, intent leans A.**
- The complaint is consistently "stop OVER-fragmenting," not "always exactly one
  beam per bar" (prompt L21-27, L39-41).
- Load-bearing qualifier (prompt L33-34): "one beam spans the whole run of eighth
  notes THAT BELONG TOGETHER." "Belong together" = the metric group in engraving;
  it is NOT "the whole run of consecutive eighths." L40-41 says "spanning THE
  GROUP" (singular) — metric-group language, not "the whole bar."
- The reference image is a beginner-method excerpt with SHORT solfège runs — the
  case where A and B are IDENTICAL — so it cannot disambiguate; it only proves the
  short case. The prompt itself labels these as directions to explore, not
  requirements (L43-51).
- Bottom line: the wording's intent aligns with Option A and does NOT demand
  Option B. Record the requirement as Option A; list "full bar of 8 in 4/4 → 4+4
  vs 8" as an explicit open question, noting the wording does not force B.

**Answer 2b (spec-researcher) — A/B divergence is almost entirely academic here.**
There is NO eighth-note RUN in any user-facing example song or e2e test; the only
multi-eighth runs are synthetic unit-test fixtures, and A vs. B diverge in only
two of them.
- `docs/song-format.md` canonical example song (L405-494): all quarter/half/whole
  — ZERO eighth notes. `README.md`: none. `specs/render.spec.js`,
  `specs/editor.spec.js` (Playwright e2e): only quarter/half/whole — ZERO eighths.
- Isolated single eighths (NOT runs; both A and B flag them as singletons):
  `svg.test.js:37-41` (lone F#5 after a rest); `validate.test.js:961,974`.
- The ONLY multi-eighth runs (all synthetic, in `layout.test.js`):

  | file:line | run | timeSig | A (metric) | B (whole run) | DIVERGE? |
  |---|---|---|---|---|---|
  | layout.test.js:343-355 | 8 eighths | 4/4 | [0-3],[4-7] | [0-7] | **YES** |
  | layout.test.js:357-367 | 6 eighths | 6/8 | [0,1,2],[3,4,5] | (B ill-defined) | edge |
  | layout.test.js:369-379 | 8th,rest,8th | 4/4 | [0],[2] flagged | same | no |
  | layout.test.js:381-389 | 8th,quarter,8th | 4/4 | [0],[2] flagged | same | no |
  | layout.test.js:391-398 | 8th,quarter | 4/4 | [0] flagged | same | no |
  | layout.test.js:400-412 | 20 eighths | 4/4 | groups of 4 | one group of 20 | **YES** |
  | layout.test.js:414-421 | 8th,16th | 4/4 | [0,1] | [0,1] | no |

- B is ILL-DEFINED for compound metre: a literal "whole run" would merge 6/8's two
  dotted beats into one group of 6, which is wrong — another point in A's favour.
- Interpretation: for this block's real content the A/B distinction is academic
  (no eighth run ships in any example). BUT the two diverging fixtures' existing
  assertions ("beams 4/4 eighths in twos" → 4 pairs; "20 eighths → 10 pairs") MUST
  be rewritten regardless, and rewriting forces an explicit A-or-B choice — it
  cannot be punted in code.

**Researcher recommendation (unchanged): Option A** — metric grouping (4/4 → groups
of 4 at the half-bar; 2/4 & 3/4 → whole bar; 6/8 → dotted beat of 3). Satisfies
every short-run case the issue shows, is engraving-correct, is well-defined for
compound metre (B is not), and differs from B only on the rare full-bar-of-8 case
the wording never demands. The single explicit open question: 8 eighths in 4/4 →
4+4 (A) vs one beam of 8 (B).

**DECISION (spec-analyst):** Adopt **Option A (metric grouping)**. The evidence is
overwhelming and convergent: it is engraving-correct (Finale/MuseScore/LilyPond
defaults), matches the issue's intent and the wording "notes that belong together /
the group", is well-defined for every metre (Option B is not, for compound), and
produces the exact look the reference image shows for the short runs it depicts.
For the one sub-case the wording does not resolve (a full/over-full bar of
uninterrupted eighths in a 4/4-family metre), default to the engraving-correct
**4+4 half-bar split**, not one unbroken beam of 8. This is recorded as a noted
assumption, not a blocker — it has near-zero impact on this block's real content
(no example song contains an eighth run).

### Q3 — Precise per-metre grouping rule, break behaviour, and mixed durations

**Question.** (3a) Expected groups for a full bar of uninterrupted eighths per
metre, and a single general rule (not a lookup table). (3b) Confirm what still
breaks a group. (3c) Confirm the requirement is only about primary-beam
membership; secondaries/stubs unchanged.

**Answer 3a (spec-researcher) — per-metre expected groupings (full bar of eighths):**

| Metre | Eighths | Option-A groups | Notes |
|---|---|---|---|
| 4/4 | 8 | 4 + 4 | half-bar; break at the middle (beats 2|3). |
| 2/4 | 4 | 4 (one group) | whole bar. |
| 3/4 | 6 | 6 (one group) — recommended | whole bar; see decision below. |
| 2/2 (cut) | 8 | 4 + 4 | beat = half note (2 q-beats); each holds 4 eighths. |
| 6/8 | 6 | 3 + 3 | compound — ALREADY CORRECT today. |
| 9/8 | 9 | 3 + 3 + 3 | compound — ALREADY CORRECT. |
| 12/8 | 12 | 3+3+3+3 | compound — ALREADY CORRECT. |
| 3/8 | 3 | 3 (one group) | compound (beats%3==0) — ALREADY CORRECT today. |

- **3/4 → whole bar of six** (one beam), not three pairs: matches LilyPond and
  Gardner Read ("a complete set of quavers in 3/4 … beamed together with one
  beam"), is the simplest rule, and directly serves the issue's intent (three
  pairs would still look fragmented). Caveat recorded: some teaching sources prefer
  per-beat pairs in 3/4; this spec deliberately chooses the merged form.
- **Cut time / beatType=2:** beat unit is the HALF note → 2/2 beams 4+4 (same
  visual as 4/4, reached via a different beat unit).
- **Irregular / schema-permitted metres (5/4, 7/8, beatType 16/32):** NO single
  canonical grouping (7/8 = 2+2+3 / 3+2+2 / 2+3+2; etc.), and the correct grouping
  needs an ENCODED accent/beat pattern that the song format does NOT carry
  (`schema.js:110-117` has only `beats` + `beatType`). Recommendation: do NOT
  special-case them; let the general rule produce a predictable default and treat
  true accent-pattern beaming as OUT OF SCOPE (an honest, recorded limitation).

**General rule (single, not a lookup table) — the grouping unit in quarter-beats:**
- COMPOUND (`beatType ∈ {8,16}` AND `beats % 3 == 0`): the dotted beat =
  `3 × (4/beatType)` quarter-beats. **UNCHANGED from today.**
- SIMPLE: the beat unit is `4/beatType`; the grouping unit is the LARGER metric
  unit — merge two beats to the HALF-bar for duple/quadruple (4/4 → groups of 4,
  2/2 → 4+4), and the WHOLE bar for the small simple metres (2/4 → 4, 3/4 → 6).
  Today's simple branch returns just one beat unit (`4/beatType`), which is why
  4/4 gives pairs; the fix makes the SIMPLE branch return this larger unit. The
  OBSERVABLE TABLE ABOVE is the contract; the exact predicate (how to phrase
  "merge to half-bar for 4/4-family, whole bar for ≤3-beat simple metres") is a
  design-doc call. Researcher flagged that a naive "always half-bar" rule
  under-merges 2/4 and 3/4 (2/4 half-bar = 2 eighths → would give 2+2), so the
  rule must use the whole bar for those small metres. Only the grouping-unit SIZE
  changes; nothing else.

**Answer 3b (spec-researcher) — break behaviour UNCHANGED; only unit size changes.**
Under the new rule, these still break/bound a group exactly as today:
- a REST (`layout.js:434-438`); a NON-BEAMABLE quarter-or-longer note
  (`layout.js:226-230, 434-438`); the MEASURE END — groups are computed per
  measure per hand (`layoutHand` called once per measure, `layout.js:1993-2006`),
  so a group never spans a barline (`:465` final flush); a note that STRADDLES a
  grouping boundary still ends its group (`:443-461`) — the straddle test simply
  uses the new larger unit.
- A length-1 group is still emitted as a FLAGGED singleton (`:417-424`) — this
  rule is UNCHANGED, but the "leftover flagged note" SYMPTOM is FIXED as a
  consequence of the larger unit: e.g. 3 eighths on beats 1-2 of 4/4 now all join
  one group of 3 instead of `[0,1]` + flagged `[2]`. No change to the singleton
  rule itself.

**Answer 3c (spec-researcher) — requirement is PRIMARY-beam membership only.**
- `beamGroups` decides which indices share a group; it treats all eighth-or-shorter
  notes as beamable equally, so a `16th,16th,8th,8th` run within one beat-group
  already forms ONE group and will continue to. The new rule only widens WHICH
  notes are in the group (the unit size).
- `beamGeometry` (`layout.js:521-557`) independently draws ONE primary beam across
  the whole group, SECONDARY beams only between adjacent members that share the
  level, and STUBS for an isolated shorter note. That secondary/stub logic is
  UNTOUCHED by a grouping-size change.
- Engraving expectation: the primary (8th) beam runs unbroken across the metric
  group; 16th/32nd beams are drawn only over the notes that short. The code already
  matches "primary unbroken, secondaries adjacent-only", so widening primary-group
  membership is the whole change. Secondary-beam BREAKING at inner sub-beats (a
  finer engraving nicety the code does not currently do) is OUT OF SCOPE.

**Sources.** Cut-time beat-unit grouping (libertyparkmusic, musicnotes); irregular
metres from accent pattern (musicnotes, Wikipedia "Time signature"); 3/4 whole-bar
default + LilyPond beatStructure (LilyPond Notation Ref 2.25); Gardner Read
whole-bar 2/4 & 3/4 (archive.org scan via search summary — gap noted). In-repo:
`layout.js:376-386, :226-230, :410-467, :491-561, :1993-2006`; `schema.js:110-117`.

### Q4 — Verification surface (tests to change) and scope boundaries / non-regression

**Question.** (4a) Complete list of existing assertions that must change for Option
A, with file:line and current→new values; is `beatGroupLength` a public contract?
(4b) Confirm the listed invariants stay unchanged; trace every consumer of
`beamGroups` output for any size/count dependence that a larger group could regress.

**Answer 4a (spec-researcher) — the ENTIRE test blast radius is in
`src/notation/__tests__/layout.test.js`, in two describe blocks:**
1. `beatGroupLength` simple-length test (`layout.test.js:320-323`): `({4,4})→1`
   and `({3,4})→1` change ONLY IF the fix repurposes `beatGroupLength` to return
   the GROUPING unit (4/4 → 2; 3/4 whole-bar → 3). If a separate grouping function
   is added instead, these stay 1. Title/comment "one beatType unit" reworded.
2. `beamGroups` "beams 4/4 eighths in twos" (`:342-355`): title "in twos" → "in
   fours"; `indices` `[[0,1],[2,3],[4,5],[6,7]]` → `[[0,1,2,3],[4,5,6,7]]`;
   `every(isBeam)` stays true.
3. `beamGroups` "20 eighths → 10 pairs" (`:400-412`): comment → "5 groups of
   four"; `toHaveLength(10)` → `toHaveLength(5)`; `indices.length === 2` → `=== 4`.
- CONDITIONAL watch-item: `:337` `beatGroupLength({2,8}) === 0.5` — under a "small
  simple metre → whole bar" rule, 2/8 merges to the whole bar (1.0), so this line
  likely flips `0.5 → 1.0`. Depends on the exact predicate; easy to miss.
- Assertions that DO NOT change (verified): `:357-367` (6/8 threes), `:369-379`
  (rest break), `:381-389` (quarter break), `:391-398` (length-1 flagged),
  `:414-421` (per-member beam counts), `:325-329` (compound 1.5), `:331-335` (3/8
  → 1.5). All `beamGeometry`, `measureLayout`, `unionGrid`, `svg.test.js`,
  `render.spec.js`, `editor.spec.js` — no beam-grouping assertions (render.spec.js
  "pair" at L262-263 is annotation ordering, not beaming).
- `beatGroupLength` IS PUBLIC and unit-tested (exported `layout.js:376`, tested
  `:320-338`), so its return values are a SPEC'D contract — changing them is an
  observable change to name, not a silent tweak. Its ONLY runtime consumer is
  `beamGroups` (`:411`). Clean DESIGN-DOC CHOICE: (i) change `beatGroupLength`'s
  contract to return the grouping unit (updates the `:320-323` tests), or (ii)
  keep `beatGroupLength` meaning "one beat" and add a new grouping function that
  `beamGroups` calls (those tests unchanged, new function gets new tests). Option
  (ii) is less disruptive to the existing contract. Either way the `beamGroups`
  output assertions (#2/#3) change regardless.

**Answer 4b (spec-researcher) — all invariants CONFIRMED by full consumer trace.**
Consumer map (verified): `beatGroupLength` → only `beamGroups` (`:411`).
`beamGroups` → only `layoutHand` (`:1424`), which uses groups for exactly two
things: a `groupOf` map setting each note's `beamed` flag (flag-vs-beam drawing,
`:1499,:1511`) and building `beamGeometry` members per multi-note group
(`:1524-1546`). NOTHING else. `beamGeometry` output → `renderHand`/`renderBeam`
in `svg.js` (`:671-673, :815-836`), plain `for…of` loops with no max-2
assumption.
- HORIZONTAL LAYOUT / X / WIDTH — UNCHANGED. X and width come purely from event
  durations via `measureLayout`/`unionGrid`/`advanceFor`, never from `beamGroups`
  or the time signature (explicit "NEVER consults timeSignature" invariant,
  `:779-795`). A group of 8 occupies the same X columns as 8 separately-flagged
  eighths — byte-identical spacing.
- COMPOUND METRES (6/8, 9/8, 12/8, 3/8) — UNCHANGED / byte-identical, PROVIDED the
  fix touches ONLY the simple-metre branch. Spec must require modifying only the
  simple path.
- BEAM GEOMETRY / DRAWING — UNCHANGED; handles any group size already.
- FLAGGED-SINGLETON RULE — UNCHANGED (`isBeam = length > 1`); leftover-flag symptom
  fixed purely as a side effect of larger groups.
- STEM DIRECTION, SECONDARY BEAMS, STUBS — UNCHANGED; all iterate over all members
  / are adjacency-based, so size-agnostic.
- No consumer branches on group size except `isBeam = length > 1` and the
  `members.length >= 2` guard — both "≥2" thresholds a larger group satisfies. No
  fixed-size arrays, no pair-only indexing, no overflow/scaling risk (system
  justify operates on measure width, not beam length).
- KNOWN COSMETIC LIMITATION (record, not a regression): the beam is FLAT at the
  most-extreme stem end; over a long run spanning a wide pitch range, inner stems
  can be long where engraving might slant the beam. This is a pre-existing trait
  of the flat-beam design (already true for today's 2-note beams across a wide
  interval), NOT introduced by this change. Slanted beams are OUT OF SCOPE.

**Sources (in-repo, verified by reading).** Exports `layout.js:226,239,376,410,491`;
sole consumers `:411` and `:1424`; `layoutHand` use `:1426-1431, :1499, :1511,
:1524-1546`; size-agnostic geometry `:498, :521-557, :508-513`; size-agnostic svg
`svg.js:671-673, :815-836, :722, :744`; spacing time-sig-blind `layout.test.js:779-795`,
`layout.js:763-844`; tests to change `layout.test.js:320-323, :342-355, :400-412`
(+ conditional `:337`).

## Consolidated Requirements

_Captured at the WHAT level. The behaviour below is the observable contract; how to
express the grouping predicate (and whether to repurpose `beatGroupLength` or add a
new function) is left to the design phase, with the noted options. Premise check:
the prompt's premise that the renderer over-fragments eighth-note beams ("pairs of
two") is CONFIRMED accurate in effect — no blocker. The only refinement is that the
cause is beat-boundary breaking with too-small a grouping unit, not a hard "max 2"
cap._

### Goal & decision

1. **Beam consecutive beamable notes (eighths or shorter) by their METRIC GROUP,
   not by every single beat.** In simple duple/quadruple metres the grouping unit
   is widened so a chained run of eighth notes joins under one beam (one primary
   beam spanning the metric group), instead of splitting into pairs of two with a
   leftover flagged note. This is **Option A (metric grouping)** — adopted as the
   correct, engraving-standard behaviour, validated against Finale/MuseScore/
   LilyPond defaults and Gould/Read. It is a global correction, NOT a new
   "beginner mode" toggle and NOT a config option.

### Observable grouping behaviour (the contract)

2. For a measure of uninterrupted eighth notes, one hand, the beam groups MUST be:

   | Metre | Eighths | Required groups |
   |---|---|---|
   | 4/4 | 8 | `4 + 4` (two groups of four; break at the half-bar) |
   | 2/4 | 4 | `4` (one group, whole bar) |
   | 3/4 | 6 | `6` (one group, whole bar) |
   | 2/2 (cut) | 8 | `4 + 4` (beat = half note) |
   | 6/8 | 6 | `3 + 3` (UNCHANGED — already correct) |
   | 9/8 | 9 | `3 + 3 + 3` (UNCHANGED) |
   | 12/8 | 12 | `3 + 3 + 3 + 3` (UNCHANGED) |
   | 3/8 | 3 | `3` (one group; UNCHANGED) |

3. **General rule (grouping unit, in quarter-beats):**
   - COMPOUND (`beatType ∈ {8,16}` AND `beats % 3 == 0`): the dotted beat =
     `3 × (4/beatType)`. **UNCHANGED from today.**
   - SIMPLE: the grouping unit is the LARGER metric unit — the HALF-BAR for
     duple/quadruple metres (4/4 → groups of 4; 2/2 → 4+4), and the WHOLE BAR for
     the small simple metres (2/4, 3/4, and 2/8). The unit MUST NOT be finer than
     a single beat, and a pure "always half-bar" rule is rejected because it
     under-merges 2/4 and 3/4. Only the grouping-unit SIZE changes versus today.

4. **3/4 resolves to one group of six (whole bar), not three pairs.** Chosen
   deliberately to serve the issue's intent and matching LilyPond / Gardner Read;
   the competing "three pairs" teaching convention is explicitly NOT used.

5. **The full/over-full bar of uninterrupted eighths in a 4/4-family metre splits at
   the half-bar (4+4), not as one unbroken beam of 8.** This is the one sub-case the
   issue wording does not resolve; the engraving-correct half-bar split is the
   adopted default (recorded assumption, near-zero real impact — see #15).

### Boundaries that still break a beam group (UNCHANGED)

6. A REST breaks an open group.
7. A NON-BEAMABLE note (quarter or longer) breaks an open group.
8. The MEASURE END bounds a group: groups are computed per measure, per hand; a
   group never spans a barline.
9. A note that STRADDLES a grouping boundary ends its group (the next beamable note
   starts fresh). The straddle test simply uses the new, larger grouping unit.
10. A group of length 1 is still emitted as a single FLAGGED note, never a one-note
    beam. This rule is unchanged; the issue's "leftover flagged note" symptom is
    fixed as a SIDE EFFECT of the larger grouping unit (fewer leftovers), e.g. three
    eighths on beats 1-2 of 4/4 now form one group of three instead of `[0,1]` plus
    a flagged `[2]`.

### Mixed durations

11. The change is ONLY about which notes share the PRIMARY (eighth-level) beam.
    Secondary beams (16th/32nd) and stubs are drawn exactly as today (adjacency-
    based, `min(beamCount)` between neighbours). Secondary-beam BREAKING at inner
    sub-beats is NOT introduced and is out of scope. A run mixing eighths and
    sixteenths within one metric group forms one primary group, as it already does.

### Non-regression invariants (MUST hold)

12. HORIZONTAL LAYOUT is untouched: column X positions and measure width are derived
    purely from event durations and remain time-signature-blind. The beaming change
    MUST NOT alter any X or width. A wider beam group occupies the same columns as
    the same notes flagged individually.
13. COMPOUND metres (6/8, 9/8, 12/8, 3/8) MUST remain byte-identical: the fix
    touches only the SIMPLE-metre branch of the grouping rule.
14. BEAM GEOMETRY/drawing, STEM DIRECTION, secondary beams, stubs, and the
    flagged-singleton rule are all UNCHANGED; only group MEMBERSHIP changes. These
    are already size-agnostic and handle a group of 8+ without regression.

### Scope, assumptions, and known limitations

15. The A/B distinction (half-bar split vs. whole-run merge) has near-zero impact on
    this block's real content: NO example song, e2e test, or doc fixture contains an
    eighth-note run today; the only multi-eighth runs are synthetic unit-test
    fixtures, and A vs. B diverge in just two of them (8 eighths and 20 eighths in
    4/4).
16. IRREGULAR / accent-pattern metres (e.g. 5/4, 7/8, and `beatType` 16/32 cases)
    have no single canonical grouping and would require an accent/beat-structure
    field the song format does NOT carry (`schema.js` has only `beats` + `beatType`).
    They are OUT OF SCOPE for correct accent-based beaming: the general rule (#3)
    must produce a predictable, non-crashing default for them, and that is
    sufficient.
17. SLANTED beams are out of scope. The flat beam (at the most-extreme stem end)
    over a long run spanning a wide pitch range may leave inner stems long; this is
    a pre-existing cosmetic trait of the flat-beam design, not a regression.
18. The renderer must remain robust to events that do NOT sum to the time signature
    (validation does not enforce metric balance; `pos` may overflow the bar). The
    new rule, like the old, must never throw or clamp on an over-full measure.

### Verification / success criteria

19. SUCCESS = a chained run of eighth notes that today renders as separate two-note
    beams (plus a flagged leftover) instead renders as a single beam spanning its
    metric group, per the table in #2, for the supported metres — with horizontal
    layout, compound-metre output, and beam drawing all unchanged.
20. The existing unit tests in `src/notation/__tests__/layout.test.js` that encode
    the old pairs behaviour MUST be updated to the new contract (the complete blast
    radius, all in that one file): the `beamGroups` "in twos" test (`:342-355` →
    groups of four) and "20 eighths → 10 pairs" test (`:400-412` → 5 groups of
    four), and — depending on the design choice for the grouping function — the
    `beatGroupLength` simple-length assertions (`:320-323`, and the conditional 2/8
    line `:337`). No tests elsewhere (svg.test.js, render.spec.js, editor.spec.js)
    assert beam grouping. New tests SHOULD cover the per-metre table (#2),
    especially 4/4 groups-of-four, 2/4 / 3/4 whole-bar, the leftover-flag fix
    (3 eighths in 4/4 → one group), and an over-full measure (no throw).

### Open question for the requester (non-blocking)

21. For a FULL/over-full bar of uninterrupted eighths in a 4/4-family metre, this
    spec defaults to the engraving-correct **half-bar split (4+4)**. If the
    requester instead wants one unbroken beam across the whole bar (matching the
    most literal reading of "the whole run"), that is the only sub-case that would
    differ and the only thing that would warrant a configurable mode. The issue's
    wording neither demands nor depicts it; flagged for confirmation only.