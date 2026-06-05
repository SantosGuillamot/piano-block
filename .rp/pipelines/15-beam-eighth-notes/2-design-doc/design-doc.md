# Design Doc — Beam chained eighth notes as a single group instead of in pairs

_Source: GitHub issue [#15](https://github.com/SantosGuillamot/piano-block/issues/15)._
_Phase: Design doc (phase 2). Realizes the contract in `1-spec/spec.md`._

## 1. Summary

The Piano block renders melodies as sheet music on a grand staff. When several
eighth notes (or shorter notes) are chained together, standard engraving joins
them under a single beam spanning the metric group they belong to. Today the
renderer instead beams them strictly two-by-two: a long run of eighths breaks
into a series of disconnected two-note beams, and any leftover odd note renders
with its own flag.

The fix widens the **grouping unit** — the span of musical time over which
consecutive beamable notes are joined under one beam — from "one notated beat"
to the metric group appropriate for the time signature. In simple duple and
quadruple metres this becomes the half-bar (4/4 → groups of four, 2/2 → 4+4);
in the small simple metres (2/4, 3/4, 2/8) it becomes the whole bar; compound
metres (6/8, 9/8, 12/8, 3/8) are left exactly as they are today.

The entire change is confined to **one function**: the simple-metre arm of
`beatGroupLength` in `src/notation/layout.js`. Nothing else — not the
beam-walking logic, not the beam geometry, not stem direction, secondary beams,
stubs, the flag-vs-beam decision, nor any horizontal layout — is touched. This
is a global engraving correction (matching Finale, MuseScore, and LilyPond
defaults), not a new mode, toggle, or configuration option.

## 2. Background: how beaming is computed today

Two functions in `src/notation/layout.js` produce beam groups; everything else
in the rendering pipeline consumes their output without caring how big a group
is.

### 2.1 `beatGroupLength(timeSignature)` — the grouping unit

Located at `layout.js:376-386`. It returns a single number: the length, in
quarter-beats (a quarter note = 1), of the span over which a beam group forms.
Today it returns:

```js
const beats = timeSignature?.beats;
const beatType = timeSignature?.beatType;
// One `beatType` unit in quarter-beats (a quarter = 1): 4 / beatType.
const unit = beatType ? 4 / beatType : 1;
const isCompound =
    (beatType === 8 || beatType === 16) &&
    typeof beats === "number" &&
    beats % 3 === 0;
return isCompound ? unit * 3 : unit;
```

- **Compound** metres (`beatType` is 8 or 16 _and_ `beats` is a multiple of 3 —
  6/8, 9/8, 12/8, 3/8) return the **dotted beat**, `unit * 3` = 1.5 quarter-beats.
  This already groups their eighths in threes.
- **Everything else** (the "simple" arm) returns `unit` = one notated beat. For
  4/4 that is 1 quarter-beat = two eighths, which is precisely the source of the
  "pairs" symptom.

This function exists for exactly one purpose: to feed `beamGroups`. A full-repo
grep confirms it is referenced nowhere else in runtime code — only in
`beamGroups` (`layout.js:411`) and in its own unit tests. There is no barrel
re-export and no documentation reference.

### 2.2 `beamGroups(events, timeSignature)` — the walk

Located at `layout.js:410-467`. It walks one hand's events for one measure,
tracking a running position `pos` in quarter-beats, and accumulates consecutive
**beamable** notes (an eighth or shorter) into the open group. It breaks the
open group when:

- the next event is a **rest or non-beamable** note (`:434-438`);
- a beamable note **starts in a new grouping unit** — i.e. `floor(pos / beatLen)`
  changed (`:431-432`, `:443-445`);
- a note **straddles a unit boundary** (its `endBeat !== startBeat`), in which
  case the straddler joins the current group and then the group is flushed so the
  next note opens fresh (`:454-461`);
- the **measure ends** (a final flush at `:465`).

A group of length 1 is emitted as a single **flagged** note (`isBeam: false`,
`:421`); groups of two or more are beams (`isBeam: true`).

Crucially, `beatLen` (the value from `beatGroupLength`) participates in the walk
in exactly one way: the two `Math.floor(pos / beatLen)` expressions at
`:431-432`, guarded by `beatLen > 0 ?`. Every break branch is otherwise
independent of the grouping unit. So changing only the *value* `beatGroupLength`
returns changes *which notes share a group* without changing *how* groups are
detected or drawn.

### 2.3 The only consumer of `beamGroups`

`beamGroups`' sole consumer is `layoutHand` (`layout.js:1424`), which uses the
result for exactly two things, both size-agnostic past a "≥2" threshold:

1. A `groupOf` map → a per-note `beamed` flag → `flagCount: beamed ? 0 :
   decoded.flagCount` (`:1498-1499, :1511`). A note in a beam gets no flag.
2. Building `beamGeometry` members, guarded by `members.length >= 2` (`:1543`).

Horizontal position comes purely from `columnX.get(onsets[idx])` (`:1438`) —
derived from event onsets and durations, never from the grouping unit or the
time signature. This is the structural reason the beaming change cannot move any
note: X is computed on a different axis entirely.

## 3. Goals and non-goals

### Goals

- Beam consecutive beamable notes by their **metric group**, not by every single
  beat, so a chained run of eighths joins under one continuous beam.
- Produce exactly the per-metre grouping in the spec contract (Section 5.1).
- Eliminate the "leftover flagged note" symptom as a side effect of fewer,
  larger groups.

### Non-goals (out of scope)

- **No new mode, toggle, or config option.** One global correction.
- **Irregular / accent-pattern metres** (5/4, 7/8, `beatType` 16/32, etc.). These
  have no single canonical beam grouping, and the song format carries no
  accent-structure field. The rule must give them a predictable, non-crashing
  default, but correct accent-based beaming is explicitly not in scope.
- **Slanted beams.** Long flat beams over a wide pitch range may leave inner stems
  long — a pre-existing cosmetic trait of the flat-beam design, not a regression
  introduced here.
- **Secondary-beam breaking at inner sub-beats** for sixteenth/thirty-second runs.
- **Any change to horizontal spacing or measure width.**

## 4. Design

### 4.1 Where the change lands

The change is confined to the **simple-metre arm** of `beatGroupLength`
(`layout.js:376-386`). The compound arm (`unit * 3`) and the entire `beamGroups`
walk (`:410-467`) are byte-identical to today. No other module changes.

### 4.2 Approach: repurpose `beatGroupLength`, don't add a function

The spec offered two structural options: (i) repurpose `beatGroupLength` to
return the new, wider grouping unit, keeping its name and single call site; or
(ii) add a second, parallel function for the new metric grouping.

**Decision: option (i) — repurpose `beatGroupLength`.** Rationale:

- It is the **lowest-risk shape**. The function exists solely to feed
  `beamGroups`' grouping break; it has one runtime consumer and zero out-of-test
  references (full-repo grep). A second near-duplicate function would add a
  parallel code path and a second source of truth for the same concept with no
  benefit — the literal "one beat" value it returns today is used nowhere else.
- **Keep the name.** `beatGroupLength` already reads as "length of the beat
  *group*," which is exactly the new meaning (the span over which a beam group
  forms). A rename would churn the test import and `describe` title for zero
  behavioral gain. Its JSDoc, which currently describes "one `beatType` unit per
  beat," is rewritten to describe the grouping unit and the half-bar / whole-bar
  rule.
- Touching only the simple arm keeps the compound return **byte-identical**,
  which is how non-regression invariant #13 (compound metres unchanged) is
  satisfied mechanically — the change is provably confined to the simple branch.

### 4.3 The grouping-unit predicate

The grouping unit needed for each metre, so that a full bar of eighths matches
the spec contract, was worked out arithmetically (eighth = 0.5 quarter-beats):

| Metre | beats / beatType | bar (q-beats) | today's unit | needed unit | rule |
|---|---|---|---|---|---|
| 4/4 | 4 / 4 | 4 | 1 (pairs) | **2** | half-bar |
| 2/4 | 2 / 4 | 2 | 1 (pairs) | **2** | whole bar (half-bar = 1 would re-pair) |
| 3/4 | 3 / 4 | 3 | 1 (pairs) | **3** | whole bar (half-bar = 1.5 would mis-split) |
| 2/2 | 2 / 2 | 4 | 2 (already 4s) | **2** | half-bar |
| 2/8 | 2 / 8 | 1 | 0.5 (pairs) | **1** | whole bar (half-bar = 0.5 would re-pair) |
| 6/8 | 6 / 8 | 3 | 1.5 (compound) | **1.5** | dotted beat (unchanged) |
| 3/8 | 3 / 8 | 1.5 | 1.5 (compound) | **1.5** | dotted beat (unchanged) |

The key observation: a naive **"always half-bar"** rule is wrong. It produces the
right unit for the duple/quadruple metres (4/4, 2/2) but **under-merges** the
small simple metres (2/4, 3/4, 2/8), where the half-bar is one beat or less and
would re-introduce the very pairs/odd-splits we are removing. Those small metres
need the **whole bar**. So the simple predicate must distinguish the
duple/quadruple family (half-bar) from the small simple metres (whole bar). The
threshold that cleanly separates them is whether the half-bar is at least a
half-note (2 quarter-beats).

The locked simple branch, written in the file's existing inline-comment idiom
(bare numeric literals plus a terse explanatory comment, matching how the
current function is written — no new named constants):

```js
const beat = beatType ? 4 / beatType : 1;     // one notated beat (quarter-beats)
if (isCompound) return beat * 3;              // dotted beat — UNCHANGED
// SIMPLE: group by the HALF-BAR so a chained run joins under one beam
// (4/4 -> 4, 2/2 -> 4+4). For small simple metres whose half-bar is under a
// half-note (2 quarter-beats) — 2/4, 3/4, 2/8 — the half-bar would re-introduce
// pairs, so group by the WHOLE BAR. Default absent ts to 4/4 (beats -> 4).
const b = typeof beats === "number" ? beats : 4;   // NaN guard — see §4.4
const barLength = b * beat;
const halfBar = barLength / 2;
const unit = halfBar >= 2 ? halfBar : barLength;
// Never finer than a single beat (guards the 1/1 whole-note-beat bar).
return Math.max(unit, beat);
```

(Exact variable names are implementation-phase polish; the logic and the
inline-comment style are what is fixed here.)

The engraving rationale lives in the comment, which is the file's established
idiom — chosen over introducing a `HALF_NOTE` constant the rest of the function
would not use, so the new code reads like the surrounding code.

### 4.4 Mandatory NaN guard (the one true correctness landmine)

This is the most important detail in the change, because it is invisible to a
smoke test.

When a song has **no time signature**, the active time signature resolves to
`null` (`resolveSectionContexts`, `layout.js:898`:
`section?.timeSignature ?? defaults.timeSignature ?? null`). That `null` flows
all the way into `beatGroupLength`, where `null?.beats` is `undefined`.

Today this is harmless, because the old function never multiplies by `beats` —
it returns `beatType ? 4 / beatType : 1`. The **new** simple branch computes
`barLength = beats * beat`. Without a guard, `undefined * 1 === NaN`, so
`halfBar = NaN`, the `halfBar >= 2` test is false, `unit = barLength = NaN`, and
`Math.max(NaN, beat) === NaN`. The function would return `NaN`.

Downstream, `beamGroups` guards its floor with `beatLen > 0 ? ... : 0`
(`:431-432`). `NaN > 0` is **false**, so every note gets `startBeat = endBeat =
0` and the **entire eighth run collapses into one group** (e.g. 6 eighths →
`[[0,1,2,3,4,5]]`). That is a **silent wrong default** — it merges across the
half-bar instead of producing the intended 4/4-of-fours — not a crash. Exactly
the kind of bug that passes a smoke test and ships.

**The guard is mandatory:** default `beats` to 4 when it is not a number, before
multiplying — `const b = typeof beats === "number" ? beats : 4;`. With it,
`beatGroupLength(null) === beatGroupLength(undefined) === 2`, so absent ts
behaves like 4/4 and produces groups of four. This mirrors the existing
function's own NaN-safety discipline (the compound test already guards `typeof
beats === "number"`, `:383`).

**Why "absent ts ⇒ 4/4" is the faithful default.** Absent ts has *always* been
treated as 4/4-like — today's `beatGroupLength(undefined)` returns 1, which *is*
the 4/4 value. The faithful extension is the 4/4 grouping *unit* (2 → fours), not
a second undocumented "keep pairs when no ts" rule. The effect is invisible in
practice: a full grep of shipping content (`docs/song-format.md`, the render and
editor specs, the README) found **no** eighth-note run in any no-ts song, so the
only songs whose output changes are hypothetical no-ts songs containing eighth
runs, none of which exist.

### 4.5 The `max(unit, beat)` floor is load-bearing

The final `Math.max(unit, beat)` enforces spec rule "the grouping unit MUST NOT
be finer than a single beat." It is not dead code: it binds in exactly one
metre, **1/1** (beats = 1, beatType = 1, a whole-note beat). There beat = 4,
barLength = 4, halfBar = 2, so the `halfBar >= 2` arm fires and gives unit = 2 —
which is *finer* than the 4-quarter-beat beat. `Math.max(2, 4) = 4` lifts it back
to one beat (one group of 8). The whole-bar branch is always ≥ beat (barLength =
beats·beat ≥ beat); only the half-bar branch can dip below one beat, and only
when a single beat is itself ≥ a half-note. The floor is kept with a comment
naming the 1/1 case so it is not later deleted as redundant.

### 4.6 Break and straddle behaviour is unchanged

Only the *value* feeding `floor(pos / beatLen)` changes. Every break branch in
`beamGroups` is byte-identical: rest/non-beamable (`:434-438`),
new-group-on-boundary (`:443-445`), straddle flush-after-append (`:454-461`),
and measure-end flush (`:465`). The straddle test "simply uses the new, larger
unit," exactly as the spec requires.

Worked straddle trace (new unit = 2 in 4/4), a dotted eighth (0.75) at pos 1.5
spanning 1.5 → 2.25 and crossing the unit boundary at 2.0:

| idx | dur | pos | startBeat = ⌊pos/2⌋ | endBeat = ⌊(pos+dur)/2⌋ | straddles |
|---|---|---|---|---|---|
| 0 | 0.5 | 0.0 | 0 | 0 | no |
| 1 | 0.5 | 0.5 | 0 | 0 | no |
| 2 | 0.5 | 1.0 | 0 | 0 | no |
| 3 | 0.75 | 1.5 | 0 | 1 | YES → flush after append |
| 4 | 0.5 | 2.25 | 1 | 1 | no |
| 5 | 0.5 | 2.75 | 1 | 1 | no |

Result: `[[0,1,2,3],[4,5]]`. The straddler (idx 3) joins the open group; the
`endBeat !== startBeat` flush closes the group at it; idx 4 opens fresh in the
next unit. This is exactly the spec's straddle contract — the straddle logic is
untouched, only the unit it measures against widened.

### 4.7 Open question #21 — full bar of eighths: 4+4, not one beam of 8

For a full or over-full bar of uninterrupted eighths in a 4/4-family metre, the
spec defaulted to the engraving-correct **half-bar split (4 + 4)** and flagged
the alternative (one unbroken beam of 8) as a non-blocking question for the
requester.

**Decision: keep the half-bar split (4 + 4).** Justification:

- The locked predicate **already produces 4+4 mechanically** (4/4 → unit 2 →
  break at the half-bar). No extra code honours this; it falls out of the
  half-bar grouping unit.
- It is the modern publishing default — Finale's "Beam Four Eighth Notes
  Together in Common Time" is on by default, MuseScore groups in fours, LilyPond
  beams 4/4 in two. The design phase found no engineering reason to deviate.
- **The alternative (Option B) is a single-expression future lever**, not a
  structural fork. In the simple branch's `halfBar >= 2` arm, returning
  `barLength` instead of `halfBar` flips only the duple/quadruple family to one
  whole-bar beam (4/4 → 8, 2/2 → 8) while leaving 2/4 and 3/4 (already whole-bar)
  untouched. Scoping the change to the `halfBar >= 2` arm keeps it surgical to
  the in-scope 4/4 family (an unconditional `unit = barLength` would also pull
  irregular metres like 5/4 to whole-bar). Nothing downstream distinguishes 4+4
  from 8 — a group of 8 differs from 4+4 only by one primary-beam segment versus
  two — so Option B would simply render. It is documented here as a clean toggle,
  but not built.

## 5. How the design satisfies the spec

### 5.1 The observable grouping contract

A full bar of uninterrupted eighths produces, per the spec table, the following
groups. All rows were verified by running the locked predicate end-to-end
through the real `beamGroups` walk:

| Metre | Eighths | Required groups | Produced |
|---|---|---|---|
| 4/4 | 8 | 4 + 4 | 4 + 4 |
| 2/4 | 4 | 4 | 4 |
| 3/4 | 6 | 6 | 6 |
| 2/2 | 8 | 4 + 4 | 4 + 4 |
| 6/8 | 6 | 3 + 3 (unchanged) | 3 + 3 |
| 9/8 | 9 | 3 + 3 + 3 (unchanged) | 3 + 3 + 3 |
| 12/8 | 12 | 3 + 3 + 3 + 3 (unchanged) | 3 + 3 + 3 + 3 |
| 3/8 | 3 | 3 (unchanged) | 3 |

- **3/4 → one group of six** (the whole bar), the deliberate choice matching
  LilyPond and Gardner Read, not the competing "three pairs per beat" convention.
- **A full/over-full 4/4-family bar splits at the half-bar (4 + 4)**, per §4.7.
- **The leftover-flag symptom is fixed**: three eighths on beats 1–2 of 4/4 now
  form one group of three (`[[0,1,2]]`, `isBeam: true`) instead of a two-note beam
  plus a flagged third note — a side effect of the larger grouping unit producing
  fewer leftovers. The length-1-singleton-is-flagged rule itself is unchanged.

### 5.2 Boundaries that still break a group

Unchanged, because the relevant branches in `beamGroups` are byte-identical
(§4.6): a rest breaks an open group; a non-beamable (quarter or longer) note
breaks it; the measure end bounds a group (groups never span a barline); a note
straddling a grouping boundary ends its group with the next note starting fresh,
using the new larger unit. A group of length 1 is still a flagged note.

### 5.3 Mixed durations

The change is only about the **primary** (eighth-level) beam. Secondary beams
(sixteenth/thirty-second) and stubs are produced by adjacency loops over the
group members and are not affected — a run mixing eighths and sixteenths within
one metric group forms one primary group, exactly as it does today. No
secondary-beam breaking at inner sub-beats is introduced.

### 5.4 Non-regression invariants

- **Horizontal layout is untouched** (invariant #12 / AC #7). X positions and
  measure width come from `columnX.get(onsets[idx])` (`:1438`), derived purely
  from event onsets/durations and time-signature-blind. The beaming change
  touches only group membership; a wider beam group occupies exactly the same
  columns as the same notes flagged individually.
- **Compound metres remain byte-identical** (invariant #13 / AC #5). Only the
  simple arm of `beatGroupLength` changes; the compound arm (`unit * 3`) returns
  1.5 for 6/8, 9/8, 12/8, and 3/8 exactly as before.
- **Beam geometry, stem direction, secondary beams, stubs, and the
  flagged-singleton rule are unchanged** (invariant #14). The only size-dependent
  branches in the whole pipeline are `isBeam = indices.length > 1` (`:421`),
  `beamed = group.isBeam` (`:1499`), and the `members.length >= 2` geometry
  guards (`:523`, `:1543`) — all "≥2" thresholds satisfied identically by a group
  of 4 or 8. The primary beam spans `members[0].x → members[last].x` for any
  length. Only group membership widens.

### 5.5 Robustness — over-full measures

The renderer must never throw or clamp on a measure whose events do not sum to
the bar (validation does not enforce bar-filling, and `pos` can overflow). The
predicate is total over the schema — `beats` is `integer ≥ 1` (no maximum) and
`beatType ∈ {1, 2, 4, 8, 16, 32}`. A sweep across `beatType {1,2,4,8,16,32} ×
beats 1..64` throws zero times and never returns a unit finer than one beat
(post-floor). `pos` remains a pure grouping aid in `beamGroups`; it never clamps
or crashes on overflow. An over-full 2/8 bar of eight eighths renders without
throwing (it tiles as 2+2+2+2). Out-of-scope irregular metres get predictable,
non-crashing defaults (5/4 → 5+5, 7/8 → 7, 5/8 → 5).

## 6. Test plan

All test changes land in `src/notation/__tests__/layout.test.js`. The blast
radius is fully contained there.

**Change (existing tests that encode the old behaviour):**

- `beatGroupLength` simple-unit assertions: `{4,4}` 1 → **2**, `{3,4}` 1 → **3**,
  `{2,8}` 0.5 → **1**; the `describe`/`it` titles and comments reword from "beat
  length / one beatType unit" to "grouping unit." Compound assertions stay at 1.5.
- `beamGroups` 4/4 eighths: title "in twos" → "in fours"; indices
  `[[0,1],[2,3],[4,5],[6,7]]` → **`[[0,1,2,3],[4,5,6,7]]`**; the
  `every(g => g.isBeam)` assertion stays true.
- `beamGroups` over-full "never throws" test: `not.toThrow()` stays; comment "10
  pairs" → "5 groups of four"; `toHaveLength(10)` → **`toHaveLength(5)`**; group
  size `=== 2` → **`=== 4`**.

**Unchanged (verified):** compound `beatGroupLength` (1.5), 6/8 threes, the rest
break, the quarter break, the length-1 flagged singleton, and the mixed-count
secondary-beam test.

**Add (per AC #9):**

- 2/4 whole-bar: 4 eighths → `[[0,1,2,3]]`.
- 3/4 whole-bar: 6 eighths → `[[0,1,2,3,4,5]]`.
- 2/2 → 4 + 4.
- Leftover-flag fix: 3 eighths in 4/4 → one group `[[0,1,2]]`, `isBeam` true
  (replaces the old `[0,1]` beam + flagged `[2]`).
- Absent-ts → 4 + 4: `beamGroups(8 eighths, undefined)` and `(…, null)` →
  `[[0,1,2,3],[4,5,6,7]]`, **not** one group of 8 — the regression guard for the
  NaN landmine.
- A direct `beatGroupLength(null)` / `beatGroupLength(undefined)` → **2**
  assertion — the cheapest, most pointed guard for the NaN landmine.
- Over-full 2/8 (8 eighths) → does not throw.

## 7. Risks and mitigations

- **The NaN landmine (§4.4)** is the single real correctness risk. It is a silent
  wrong default, not a crash, so it is mitigated by the mandatory `beats → 4`
  guard *and* the direct `beatGroupLength(null|undefined) → 2` regression test, so
  a future edit cannot reintroduce it unnoticed.
- **The `max(unit, beat)` floor looking redundant (§4.5)** — mitigated by a
  comment naming the 1/1 case it binds in, so it is not deleted as dead code.
- **Out-of-scope irregular metres** receive a defined, non-crashing default
  rather than correct accent-based beaming; this is intentional and called out in
  the non-goals, and is not a regression (today they already give pairs/threes;
  the new rule merely merges more).

## 8. Premise check

No evidence gathered in this phase contradicts any premise in `1-spec/spec.md`.
The design realizes the spec's metric-grouping contract exactly. The only
addition beyond the spec text is the NaN guard for the absent-ts path, which is a
faithful implementation detail of the spec's robustness requirement, not a
contract change. No blocker.
