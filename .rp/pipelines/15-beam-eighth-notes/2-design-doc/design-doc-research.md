# Design Doc Research — Beam chained eighth notes as a single group

_Source: GitHub issue [#15](https://github.com/SantosGuillamot/piano-block/issues/15)._
_Phase: Design doc (phase 2). Inputs: `1-spec/spec.md`, `1-spec/requirements.md`._

This document records the running design rationale (the HOW). Each topic is an
iterative Q&A with `design-doc-researcher`, deciding the design on its
evidence. The WHAT is fixed by the approved spec; this phase pins down exactly
where the change lands in `src/notation/layout.js`, the shape of the grouping
predicate, and how the non-regression invariants are mechanically preserved.

## Fixed contract (from the spec — not re-litigated here)

- **Option A (metric grouping)** is adopted. Grouping unit, in quarter-beats:
  - COMPOUND (`beatType ∈ {8,16}` AND `beats % 3 === 0`): dotted beat
    `3 × (4/beatType)`. **Unchanged from today.**
  - SIMPLE: the larger metric unit — HALF-BAR for duple/quadruple (4/4 → 4,
    2/2 → 4+4), WHOLE BAR for the small simple metres (2/4, 3/4, 2/8). Never
    finer than a beat.
- Observable table (full bar of eighths): 4/4 → 4+4, 2/4 → 4, 3/4 → 6,
  2/2 → 4+4, 6/8 → 3+3, 9/8 → 3+3+3, 12/8 → 3+3+3+3, 3/8 → 3.
- Break boundaries (rest, non-beamable, measure end, straddle) and the
  flagged-singleton rule are UNCHANGED; only the grouping-unit SIZE changes.
- Non-regression invariants: horizontal layout time-sig-blind, compound output
  byte-identical, beam geometry / stem direction / secondary beams / stubs
  unchanged.
- Open question #21 (full/over-full bar of eighths in 4/4-family: 4+4 vs one
  beam of 8) is left to design to decide with justification.

## Grounding read by design-doc-analyst (from the worktree)

- `beatGroupLength(timeSignature)` — `layout.js:376-386`. Returns `unit = 4/beatType`
  (default 1), `× 3` for compound. Exported and unit-tested (`layout.test.js:320-338`).
- `beamGroups(events, timeSignature)` — `layout.js:410-467`. `beatLen = beatGroupLength(ts)`;
  walks events tracking `pos`; breaks the open run when `floor(pos/beatLen)` changes
  (`:431-432, :443-445`), at a rest/non-beamable (`:434-438`), at a straddling note
  (`:454-461`), and at measure end (`:465` flush). Singleton → flagged (`:421`
  `isBeam = indices.length > 1`).
- The only runtime consumer of `beatGroupLength` is `beamGroups` (`:411`). The only
  consumer of `beamGroups` is `layoutHand` (`:1424`).
- `layoutHand` (`layout.js:1421-1549`) uses `beamGroups` output for exactly two
  things, both size-agnostic past a "≥2" threshold: (a) `groupOf` map → `beamed`
  flag → `flagCount: beamed ? 0 : decoded.flagCount` (`:1498-1499, :1511`), and
  (b) building `beamGeometry` members guarded by `members.length >= 2` (`:1543`).
  X comes purely from `columnX.get(onsets[idx])` (`:1438`) — never from grouping
  or the time signature.

### Grouping-unit arithmetic worked out by design-doc-analyst (eighth = 0.5 q-beats)

The grouping unit (quarter-beats) needed so a full bar of eighths matches the
spec table, vs. today's `beatGroupLength` return:

| Metre | beats/beatType | bar (q-beats) | today unit | needed unit | rule that yields it |
|---|---|---|---|---|---|
| 4/4 | 4 / 4 | 4 | 1 (pairs) | **2** | half-bar (bar/2) |
| 2/4 | 2 / 4 | 2 | 1 (pairs) | **2** | whole bar (bar/2 = 1 → pairs ✗) |
| 3/4 | 3 / 4 | 3 | 1 (pairs) | **3** | whole bar (bar/2 = 1.5 → 3 eighths ✗) |
| 2/2 | 2 / 2 | 4 | 2 (already 4s) | **2** | half-bar (bar/2) |
| 2/8 | 2 / 8 | 1 | 0.5 (pairs) | **1** | whole bar (bar/2 = 0.5 → pairs ✗) |
| 6/8 | 6 / 8 | 3 | 1.5 (compound) | **1.5** | dotted beat (unchanged) |
| 3/8 | 3 / 8 | 1.5 | 1.5 (compound) | **1.5** | dotted beat (unchanged) |

Observation: "half-bar" produces the right unit for the duple/quadruple metres
(4/4, 2/2) but UNDER-merges the small simple metres (2/4, 3/4, 2/8), where the
half-bar is still only one beat-or-less → re-introduces pairs. Those need the
WHOLE bar. So the simple-metre predicate must distinguish "≥4-beat / quadruple
family" (half-bar) from "small simple metre" (whole bar). The exact predicate
phrasing is Topic 2.

---

## Topic 1 — Function structure: repurpose `beatGroupLength` vs. add a new function

**Question (to researcher).** Is `beatGroupLength` referenced anywhere beyond
`beamGroups` + its own tests (full-repo grep)? Does its export matter beyond tests
(barrel re-export, doc/README mention)? With option (i) repurpose, does the
COMPOUND branch (`unit*3`) stay byte-identical (1.5 for 6/8 and 3/8)?

**Evidence (researcher + analyst-verified grep).**
- `beatGroupLength`'s ONLY runtime consumer is `beamGroups` (`layout.js:411`);
  `beamGroups`' only consumer is `layoutHand` (`:1424`). Nothing branches on group
  SIZE except `isBeam = length>1` (`:421`) and `members.length>=2` (`:1543`,
  geometry `:523`). No pair-only indexing, no fixed-size arrays.
- Full-repo grep (analyst ran it, excluding node_modules + `.rp/pipelines`):
  `beatGroupLength` appears ONLY in `layout.js` (def `:376`, consumer `:411`) and
  `layout.test.js` (import `:36`, assertions `:321,322,326,327,328,335,337`). NO
  barrel re-export, NO docs/README mention, NO other-module import. The export is
  exercised solely by tests. Repurposing (or renaming) is fully contained.
- COMPOUND branch is `return isCompound ? unit*3 : unit` (`:385`). The fix touches
  only the `: unit` (simple) arm; the `unit*3` arm is untouched → 6/8 and 3/8 stay
  1.5. Invariant #13 (compound byte-identical, "touch only the simple branch")
  holds structurally.

**DECISION (design-doc-analyst): Adopt option (i) — repurpose `beatGroupLength` to
return the GROUPING UNIT (quarter-beats), keep the function name, rewrite its JSDoc
and the three affected test assertions.** Justification:
- It is the cleanest, lowest-risk shape: the function exists ONLY to feed
  `beamGroups`' grouping break; it has a single runtime consumer and zero
  out-of-test references. A second near-duplicate function (option ii) would add a
  parallel code path and a second source of truth for the same concept with no
  benefit — the literal "one beat" value is used nowhere else.
- Touching only the simple arm keeps the compound return byte-identical, satisfying
  invariant #13 mechanically (the change is provably confined to the simple branch).
- KEEP the name `beatGroupLength`: it already reads as "length of the beat *group*",
  which is exactly the new meaning (the span over which a beam group forms); a
  rename would churn the test import (`layout.test.js:36`) and the `describe` title
  (`:312`) for zero behavioral gain. The JSDoc (currently "beat length … one
  beatType unit per beat") MUST be rewritten to describe the grouping unit and the
  half-bar/whole-bar rule. The unit-test `describe`/`it` titles and comments
  (`:312, :320`) reword from "beat length / one beatType unit" to "grouping unit".
- Test deltas (option i): `:321` `{4,4}` `1→2`; `:322` `{3,4}` `1→3`; `:337`
  `{2,8}` `0.5→1`. Compound assertions `:326-335` stay at 1.5. (Plus the
  `beamGroups` output assertions, settled in Topic 3.)

---

## Topic 2 — the exact simple-metre predicate (pressure-tested across the schema)

**Question (to researcher).** Schema range for `beats`/`beatType`; run the proposed
predicate over every permitted simple metre (incl. 4/8, 5/4, 5/8, 7/8, 4/2, 3/2,
6/4, beatType 16/32); is the `max(unit, beat)` floor load-bearing or dead; clearest
engraving-rationale phrasing of the `halfBar >= 2` threshold.

**Proposed predicate (researcher, validated end-to-end against the real walk):**
```
simple: beat = 4/beatType; barLen = beats*beat; halfBar = barLen/2;
        unit = (halfBar >= 2) ? halfBar : barLen;   // then floor at one beat:
        unit = max(unit, beat);
```

**Schema range (analyst read `src/song/schema.js:110-117`):**
- `beats`: `{ type: "integer", minimum: 1 }` — NO maximum.
- `beatType`: `{ enum: [1, 2, 4, 8, 16, 32] }` — includes **1** and **32**.
- So `beatType=1` (whole-note beat, beat=4 q-beats) and `beatType=32`
  (beat=0.125 q-beats) are both permitted. The predicate must not crash on these.

**Analyst pre-check — the `max(unit, beat)` floor IS load-bearing (found a binding
case):** for **1/1** (beats=1, beatType=1, simple): beat=4, barLen=4, halfBar=2,
`halfBar>=2` → half-bar branch gives unit=2, but beat=4. Without the floor unit
(2) would be FINER than one beat (4) — violating spec #3 ("MUST NOT be finer than
a single beat"). `max(2,4)=4` fixes it. So the floor is NOT dead code; it enforces
spec #3 for whole-note-beat metres. (Whole-bar branch is always ≥ beat since
barLen = beats·beat ≥ beat; only the half-bar branch can dip below one beat, and
only when a single beat is itself ≥ a half-note.)

**Evidence (researcher's full sweep, beatType {1,2,4,8,16,32} × beats 1..64):**
- Throws: ZERO. Unit finer than a beat: NEVER (post-floor). The predicate
  reproduces the entire spec table #2 through the real walk:
  4/4→4+4, 2/4→4, 3/4→6, 2/2→4+4, 6/8→3+3, 9/8→3+3+3, 12/8→3+3+3+3, 3/8→3.
- Floor `max(unit, beat)` binds in EXACTLY ONE metre: **1/1** (whole-note beat,
  beat=4; halfBar=2 fires the half-bar branch → 2, which is finer than the 4-beat
  → floor lifts to 4 → one group of 8). Independently found by both researcher and
  analyst. → KEEP the floor; it enforces spec #3 for the whole-note-beat degenerate.
- Out-of-scope metres (spec #16) get predictable, non-crashing defaults: 5/4→5+5,
  7/8→7, 5/8→5 (no accent structure, as expected — not a regression; today these
  give pairs/threes, the new rule merely merges more).
- NEW datapoint (researcher): 6/16 & 12/16 are COMPOUND (beatType 16, beats%3==0)
  → existing dotted-beat unit 0.75; a *full bar of eighths* tiles unevenly there
  (2+1), but this is the UNCHANGED compound branch (#13), not introduced by the
  simple-branch fix — and a real 6/16 bar is sixteenths, which tile fine. Recorded
  so it isn't mistaken for a simple-branch effect.

**DECISION (design-doc-analyst): Lock the predicate as below, with the threshold and
floor expressed in the EXISTING inline-literal-plus-comment house style of
`beatGroupLength` (NOT a named `HALF_NOTE` constant).** Rationale on style: the
current function (`layout.js:376-386`) uses bare numeric literals with a terse
explanatory comment (`// One beatType unit … : 4 / beatType.`, `unit * 3`,
`beats % 3 === 0`) and introduces no local named constants. To "read like the
surrounding code," the new simple branch should match that — an inline `>= 2`
comparison whose comment carries the engraving reason, rather than a `HALF_NOTE`
constant the rest of the function would not use. The engraving rationale lives in
the comment, which is the file's established idiom.

Locked predicate (simple branch only; compound arm `unit * 3` untouched):
```js
const beat = beatType ? 4 / beatType : 1;   // one notated beat, in quarter-beats
// COMPOUND (6/8, 9/8, 12/8, 3/8): group by the dotted beat — UNCHANGED.
if (isCompound) return beat * 3;
// SIMPLE: group by the HALF-BAR so a chained run joins under one beam (4/4 -> 4,
// 2/2 -> 4+4). For the small simple metres whose half-bar is under a half-note
// (2 quarter-beats = 4 eighths) — 2/4, 3/4, 2/8 — the half-bar would re-introduce
// pairs/odd splits, so group by the WHOLE BAR instead.
const barLength = (typeof beats === "number" ? beats : 4) * beat;
const halfBar = barLength / 2;
const unit = halfBar >= 2 ? halfBar : barLength;
// Never finer than a single beat (guards the 1/1 whole-note-beat bar, whose
// half-bar is finer than its beat).
return Math.max(unit, beat);
```
(Exact variable names / final shape are implementation-phase polish; the LOGIC and
the inline-comment style are what this decision fixes. The `beats` fallback to 4 in
`barLength` covers the no-time-signature default — see Topic 3.)

**Open sub-item carried to Topic 3:** the no-`timeSignature` default. Today
`beatGroupLength(undefined)` returns 1 (pairs). Under the new rule the default must
be DECIDED explicitly (the spec is silent). Provisional: treat absent ts as
4/4-like (beats=4, beat=1 → unit=2 → groups of 4), consistent with how the spec
treats 4/4 and with the existing "defaults to 4/4-like grouping when absent" JSDoc.
Confirm with the researcher whether any caller passes `undefined`/`null` and what
the most faithful default is.

---

## Topic 3 — no-ts default (NaN landmine), straddle preservation, exact test deltas

**Question (to researcher).** What reaches `beamGroups` when no ts is set; is the
pairs→fours default change consistent + invisible; is the walk's break/straddle
branching byte-identical (worked trace); exact `beamGroups` test deltas.

### Part A — no-`timeSignature` default + the NaN landmine (CENTRAL FINDING)

**Trace (researcher + analyst-verified):** absent ts resolves to **`null`**
(`resolveSectionContexts`, `layout.js:898`: `section?.timeSignature ?? defaults.timeSignature ?? null`).
That `null` flows as `m.ctx.timeSignature` (`:1969`) into `layoutHand(..., ts)`
(`:1998, :2005`) → `beamGroups(list, ts)` (`:1424`) → `beatGroupLength(ts)` (`:411`).
So the predicate sees `null`; `null?.beats`/`null?.beatType` → `undefined`.

**THE LANDMINE — the new simple branch introduces a NaN path that the OLD function
never had.** Today `beatGroupLength` is NaN-safe only because it never multiplies by
`beats` (it returns `beatType ? 4/beatType : 1`). The new branch computes
`barLength = beats * beat`. With absent ts, `beats === undefined` →
`undefined * 1 === NaN` → `halfBar = NaN` → `Math.max(NaN ? … , beat) === NaN`.
Researcher VERIFIED the naive predicate returns **NaN** for `null`/`undefined`.
Downstream, `beamGroups` guards `beatLen > 0 ? floor(pos/beatLen) : 0` (`:431-432`);
`NaN > 0` is **false**, so every note gets startBeat = endBeat = 0 → the entire
eighth run collapses into ONE group (researcher verified 6 eighths → `[[0,1,2,3,4,5]]`).
This is a SILENT WRONG DEFAULT (merges across the half-bar; not the intended
4/4-of-fours), not a crash — exactly the kind of bug that passes a smoke test.

**MANDATORY GUARD (promoted from "nice default" to required correctness):** the
simple branch MUST default `beats` to 4 when it is not a number, BEFORE multiplying:
`const b = typeof beats === "number" ? beats : 4; const barLength = b * beat;`.
With it, `beatGroupLength(null) === beatGroupLength(undefined) === 2` → groups of
four (the faithful 4/4-implied default). Verified SAFE by the researcher. (An
`Number.isFinite(unit) ? unit : 2` final guard is an equivalent belt-and-braces, but
the explicit `beats→4` fallback is clearer and states the "absent ts ⇒ 4/4" intent.)
This guard mirrors the existing function's own NaN-safety discipline (the compound
test already guards `typeof beats === "number"`, `:383`).

**Decision A — change the absent-ts default from pairs → groups-of-four, via the
`beats→4` guard.** Justification: (1) absent ts has ALWAYS been treated as 4/4-like
(today's `beatGroupLength(undefined) = 1` IS the 4/4 value); the faithful extension
is the 4/4 grouping UNIT (2 → fours), not a second undocumented "keep pairs for
no-ts" rule. (2) Invisible in practice — researcher grep-verified NO shipping
content has an eighth run: `docs/song-format.md` sets ts (4/4 `:405`, 3/4 `:458`)
and has zero eighth events; `specs/render.spec.js` sets ts and has none;
`specs/editor.spec.js` sets no ts but has no eighth/sixteenth events at all; README
has none. So the only observable effect is in hypothetical no-ts songs containing
eighth runs, none of which exist. Consistent with spec #15 (A/B near-zero real
impact) and the spec's metre-defined contract.

### Part B — straddle / break preservation: BYTE-IDENTICAL branching

Researcher confirmed every break branch is untouched; only `beatLen` (now the
grouping unit) changes, feeding the same `floor(pos/beatLen)`:
- rest/non-beamable break `:434-438`; new-group-on-boundary `:443-445`;
  straddle flush-after-append `:454-461`; measure-end flush `:465`. All unchanged.

**Worked straddle trace (NEW unit = 2, 4/4)** — dotted-eighth (0.75) at pos 1.5
spans 1.5→2.25, crossing the unit boundary at 2.0:

| idx | dur | pos | startBeat=⌊pos/2⌋ | endBeat=⌊(pos+dur)/2⌋ | straddles |
|---|---|---|---|---|---|
| 0 | 0.5 | 0.0 | 0 | 0 | no |
| 1 | 0.5 | 0.5 | 0 | 0 | no |
| 2 | 0.5 | 1.0 | 0 | 0 | no |
| 3 | 0.75 | 1.5 | 0 | 1 | YES → flush after append |
| 4 | 0.5 | 2.25 | 1 | 1 | no |
| 5 | 0.5 | 2.75 | 1 | 1 | no |

Result: `[[0,1,2,3],[4,5]]` — the straddler (idx 3) joins the open group, the
`endBeat !== startBeat` flush closes the group at it, idx 4 opens fresh in the next
unit. Exactly spec #9 ("the straddle test simply uses the new, larger unit").
Cross-checks (researcher, via the real walk): 8 eighths → `[[0,1,2,3],[4,5,6,7]]`;
rest at idx 2 → `[[0,1],[3]]` (rest breaks, trailing eighth flagged).

### Part C — exact `beamGroups` test deltas (verified by running the walk)

CHANGE 1 — `layout.test.js:342-355` "beams 4/4 eighths in twos":
- title `"in twos"` → `"in fours"`; `indices` `[[0,1],[2,3],[4,5],[6,7]]` →
  **`[[0,1,2,3],[4,5,6,7]]`**; `every(g => g.isBeam) === true` stays.

CHANGE 2 — `layout.test.js:400-412` "never throws … 20 eighths → 10 pairs":
- `not.toThrow()` stays; comment "10 pairs" → "5 groups of four";
  `toHaveLength(10)` → **`toHaveLength(5)`**; `indices.length === 2` → **`=== 4`**.
  (Full: `[[0,1,2,3],[4,5,6,7],[8,9,10,11],[12,13,14,15],[16,17,18,19]]`.)

UNCHANGED (verified): `:357-367` (6/8 threes), `:369-379` (rest break),
`:381-389` (quarter break), `:391-398` (length-1 flagged), `:414-421` (mixed
counts). Plus the three `beatGroupLength` simple-length deltas from Topic 1
(`:321` 1→2, `:322` 1→3, `:337` 0.5→1; compound `:326-335` stay 1.5).

**New tests to ADD (per spec acceptance #9 / requirements #20):** 4/4 groups-of-four
(covered by CHANGE 1); 2/4 whole-bar (4 eighths → `[[0,1,2,3]]`); 3/4 whole-bar
(6 eighths → `[[0,1,2,3,4,5]]`); 2/2 → 4+4; the leftover-flag fix (3 eighths in 4/4
→ one group `[[0,1,2]]`, isBeam true — replaces the old `[0,1]`+flagged `[2]`);
absent-ts → groups of four (guards the NaN landmine: `beamGroups(8 eighths, undefined)`
or `null` → `[[0,1,2,3],[4,5,6,7]]`, NOT one group of 8); over-full 2/8 (no throw).
A direct `beatGroupLength(null)`/`(undefined)` → 2 assertion is the cheapest
regression guard for the NaN landmine and SHOULD be added.

---

## Topic 4 (final) — open question #21 decision + end-to-end verification gate

**Question (to researcher).** Is the 4+4-vs-8 choice isolated to a single
expression (so it can be documented as a future lever without building it)? Does
geometry/layoutHand/svg care about 4+4 vs one group of 8? Final pass/fail run of
the full locked predicate through the real `beamGroups` walk.

### Decision on open question #21 (design-doc-analyst)

**KEEP the engraving-correct half-bar split (Option A): a full/over-full bar of
uninterrupted eighths in a 4/4-family metre renders as 4+4, NOT one beam of 8.**
This is the spec's working default; the design phase confirms it is correct and that
the alternative (Option B) is a clean future toggle, not a structural fork.

Justification (HOW-level, on top of the spec's WHAT-level evidence):
- The locked predicate ALREADY produces 4+4 mechanically (4/4 → unit 2 → break at
  the half-bar). No extra code is needed to honour Option A; it falls out of the
  half-bar grouping unit. Verified in the gate below (4/4 ×8 → 4+4, 2/2 ×8 → 4+4).
- Option A is the modern publishing default (Finale's "Beam Four Eighth Notes
  Together in Common Time" ON by default; MuseScore groups-of-four; LilyPond beams
  4/4 in two) — documented exhaustively in the spec's requirements Q1/Q2. The HOW
  phase found no engineering reason to deviate.
- **The Option-B lever is a SINGLE expression** (researcher-confirmed, both
  framings run through the real walk): in the simple branch's `halfBar >= 2` arm,
  return `barLength` instead of `halfBar`. That flips ONLY the duple/quadruple
  family that currently splits at the half-bar — 4/4 → one beam of 8, 2/2 → 8 —
  while 2/4/3/4 (already whole-bar) are unaffected. Nothing else in the file changes.
  (Writing `unit = barLength` UNCONDITIONALLY would also make irregular metres
  whole-bar, e.g. 5/4 → 10; to keep the lever surgical to the in-scope 4/4-family,
  scope it to the `halfBar >= 2` arm.) Documenting the pivot precisely means a future
  requester preference for B is a one-line change, no redesign.
- **Nothing downstream cares about 4+4 vs 8** (researcher-confirmed; analyst also
  read `beamGeometry` `layout.js:521-558` + svg). The ONLY size-dependent branches
  in the whole pipeline are `isBeam = indices.length > 1` (`:421`),
  `beamed = group.isBeam` (`:1499`), and the `members.length >= 2` guards (`:523`,
  `:1543`) — all "≥2" thresholds satisfied identically by a group of 4 or 8. The
  primary beam spans `members[0].x → members[last].x` for any length; secondary
  beams/stubs are adjacency loops; svg iterates segments with plain loops. A group
  of 8 differs from 4+4 only by ONE primary-beam segment vs two. So Option B would
  "just render" — the lever is purely the grouping unit. This strengthens recording
  it as a clean toggle rather than a structural fork.

### FINAL VERIFICATION GATE — ALL ROWS PASS (researcher ran the locked predicate end-to-end through the real `beamGroups` walk)

```
PASS  4/4 (8th×8)          want 4+4        got 4+4
PASS  2/4 (×4)             want 4          got 4
PASS  3/4 (×6)             want 6          got 6
PASS  2/2 (×8)             want 4+4        got 4+4
PASS  6/8 (×6)             want 3+3        got 3+3
PASS  9/8 (×9)             want 3+3+3      got 3+3+3
PASS  12/8 (×12)           want 3+3+3+3    got 3+3+3+3
PASS  3/8 (×3)             want 3          got 3
PASS  null-ts (×8)         want 4+4        got 4+4    (NaN guard working)
PASS  undefined-ts (×8)    want 4+4        got 4+4    (NaN guard working)
PASS  3 eighths 4/4        want 3 (isBeam true)   got 3, isBeam [true]   (leftover-flag fixed)
PASS  rest break           want [[0],[2]]  got [[0],[2]]
PASS  quarter break        want [[0],[2]]  got [[0],[2]]
PASS  over-full 2/8 (×8)   no-throw: true  (shape 2+2+2+2)
============== ALL ROWS PASS ==============
```

The predicate is correct and total over the schema, the NaN guard is mandatory and
verified, the walk/geometry/svg layers are untouched and size-agnostic, the test
deltas are pinned, and #21's lever is a clean one-expression future toggle.

---

## Final design summary (the HOW, locked)

1. **Where the change lands:** ONLY the simple-metre branch of `beatGroupLength`
   (`src/notation/layout.js:376-386`). The compound arm (`unit * 3`) and the entire
   `beamGroups` walk (`:410-467`) are byte-identical. No other module changes.

2. **Function structure:** REPURPOSE `beatGroupLength` to return the GROUPING UNIT
   (quarter-beats); keep the name; rewrite its JSDoc. Chosen over adding a second
   function because it is the sole consumer of the value and has zero out-of-test
   references (full-repo grep). Option (i) of the spec's two.

3. **The predicate (simple branch), in the file's inline-comment idiom:**
   ```js
   const beat = beatType ? 4 / beatType : 1;     // one notated beat (quarter-beats)
   if (isCompound) return beat * 3;              // dotted beat — UNCHANGED
   // SIMPLE: group by the HALF-BAR so a chained run joins under one beam
   // (4/4 -> 4, 2/2 -> 4+4). For small simple metres whose half-bar is under a
   // half-note (2 quarter-beats) — 2/4, 3/4, 2/8 — the half-bar would re-introduce
   // pairs, so group by the WHOLE BAR. Default absent ts to 4/4 (beats -> 4).
   const b = typeof beats === "number" ? beats : 4;   // NaN guard — see #4
   const barLength = b * beat;
   const halfBar = barLength / 2;
   const unit = halfBar >= 2 ? halfBar : barLength;
   // Never finer than a single beat (guards the 1/1 whole-note-beat bar).
   return Math.max(unit, beat);
   ```

4. **MANDATORY NaN guard:** the `b = typeof beats === "number" ? beats : 4`
   fallback BEFORE `b * beat`. Absent ts is `null` (`:898`), so a naive
   `beats * beat` is `NaN`; `beamGroups`' `beatLen > 0 ?` guard then treats NaN as
   0 and collapses the whole run into one group (silent wrong default). The guard
   makes absent ts behave like 4/4 (→ 4+4). This is the one true correctness
   landmine in the change.

5. **`max(unit, beat)` floor is load-bearing** (binds only at 1/1) — keep it, with
   a comment naming the 1/1 case so it is not deleted as redundant.

6. **Break/straddle behaviour UNCHANGED:** only the unit VALUE feeding
   `floor(pos/unit)` changes; rest/non-beamable/measure-end/straddle branches are
   byte-identical (worked trace in Topic 3).

7. **Open question #21:** Option A (4+4) is the locked default; Option B is a
   one-expression future lever (Topic 4), documented but not built.

8. **Tests — blast radius all in `src/notation/__tests__/layout.test.js`:**
   - CHANGE: `beatGroupLength` `:321` 1→2, `:322` 1→3, `:337` 0.5→1 (+ titles);
     `beamGroups` `:342-355` "in twos"→fours (`[[0,1,2,3],[4,5,6,7]]`),
     `:400-412` "10 pairs"→5 groups of four (`toHaveLength(5)`, size `=== 4`).
   - UNCHANGED: compound `:326-335` (1.5), 6/8 threes `:357-367`, rest/quarter/
     flagged `:369-398`, mixed counts `:414-421`.
   - ADD: 2/4 whole-bar, 3/4 whole-bar, 2/2 → 4+4, leftover-flag fix
     (3 eighths 4/4 → one group of 3, isBeam true), absent-ts → 4+4 (NaN guard),
     a direct `beatGroupLength(null|undefined) → 2` assertion, over-full 2/8 no-throw.

9. **Non-regression invariants — mechanically preserved:** horizontal layout
   untouched (X from `columnX.get(onsets[idx])` `:1438`, never from grouping or ts);
   compound byte-identical (only the simple arm changes); geometry/stem/secondary/
   stub/flagged-singleton all size-agnostic (only group membership widens).

**Premise check:** no researcher evidence contradicts any premise in `1-spec/spec.md`.
The design realizes the spec's Option-A contract exactly; the only addition beyond
the spec text is the NaN guard for the absent-ts path, which is a faithful
implementation detail of the spec's robustness requirement (#15/#18), not a contract
change. No blocker.

