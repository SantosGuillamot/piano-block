# Design Doc Review

## Verdict: rejected

## Summary

This is a strong, deeply-grounded design. I verified every load-bearing claim against the
actual codebase and the substance holds: the schema `$defs`/`$ref` subset supports the two
new note types; `validate.js` genuinely needs **no** change (the generic `minimum`/`type`/
`required`/`enum`/path-pointing machinery covers `beat: {minimum: 0}` and per-element error
paths — confirmed at `validate.js:140,166,180`); the layout band model, the `lhTopY =
rhBottomY + INTRA_STAFF_GAP` reorder point, `topMarginLayout`, `systemHasChordSymbols`, and
the measure-walk scope (`columnX`/`leadInset`/`measureRightX`/`advanceScale`/`ml.columns`/
`ml.measureEnd`) all exist exactly as described; the svg emit path (`renderMeasure`,
`chordDyR/chordDyL`, `renderHandText`, `setText` textContent-only, `data-text`) is accurate;
`INTRA_STAFF_GAP` has exactly one consumer and svg.js imports no gap/height constant; and the
selector-collision analysis (`data-kind="note"` exists but `data-text="note"` is collision-free,
no bare-value selectors, `data-staff` ≠ `data-staff-lines`) is correct. All four bands, the
shared inter-staff band, stacking, the over-content clamp, and the XSS-inert verbatim path are
realizable as designed. The doc stays at design altitude and carries credible trade-offs.

I am rejecting on a small number of concrete, fixable defects: one **factually wrong**
load-bearing count that the task asked me to verify ("13 in-scope files" — the actual number is
12), and two internal-consistency ambiguities (the inter-staff gap formula vs. the
dynamics-dodge baselines; and the `additionalProperties`-permissive claim stated too broadly).
None threaten feasibility; all are quick edits. Fix these and the doc is ready.

## Issues

### Issue 1 (MUST-FIX): The `chordSymbol` removal inventory says "13 in-scope files" but there are 12

**What's wrong:** The doc asserts the clean break touches "13 in-scope files" in three places
(Overview, Approach §2, and the Key Decision "Remove `chordSymbol` as a clean break"). A
fresh `grep -rln "chordSymbol\|chord-symbol\|CHORD_SYMBOL" src/ specs/ docs/ README.md` returns
exactly **12** distinct files:
`src/render.php`, `src/song/schema.js`, `src/notation/constants.js`, `src/notation/layout.js`,
`src/notation/svg.js`, `src/song/__tests__/validate.test.js`,
`src/notation/__tests__/layout.test.js`, `src/notation/__tests__/svg.test.js`,
`specs/render.spec.js`, `specs/editor.spec.js`, `docs/song-format.md`, `README.md`.
The doc's own enumerated per-file list (Components → "Modified components", and the research
inventory it mirrors) also resolves to these same 12 files — no 13th file is ever named. The
count is simply off by one (the research carries the same error).

**Where in design doc:** Overview (para 2, "the validator … needs no change" sentence's lead-in
naming the touched surface); Approach §2 ("removed across the 13 in-scope files"); Key Decisions
→ "Remove `chordSymbol` as a clean break …" ("Delete every `chordSymbol` token … across the 13
in-scope files").

**Suggestion:** Change "13" to "12" in all three places (and ideally in
`design-doc-research.md` D2 for source consistency). Confirm the enumerated list matches.

**Why it matters:** The "no `chordSymbol` token anywhere in `src/`, `specs/`, `docs/`" bar is an
explicit acceptance criterion, and the task brief asks specifically that the removal inventory be
"complete and accurate." A wrong file count in the authoritative removal map is a traceability
defect that erodes confidence in the inventory and could let the plan/code phase under-account
for a file. (The line-level inventory itself is accurate; only the count is wrong.)

### Issue 2 (MUST-FIX): The inter-staff gap formula and the dynamics-dodge baselines are not reconciled

**What's wrong:** Two formulas the implementer must use together appear to disagree on whether
the dynamics reserve is part of the reserved gap height.

- The stated gap flex (Key Decision "Four placement bands …", and Dependencies/Risks):
  `effectiveInterStaffGap = max(INTRA_STAFF_GAP, belowRH_stack + aboveLH_stack + (both_present ? MID_GAP : 0))`.
  This expression contains **no** `DYNAMICS_LANE_RESERVE` term.
- But the design also says below-RH note baselines start at `rightStaffBottomY +
  DYNAMICS_LANE_RESERVE` when the RH has dynamics (dodging the dynamics row at
  `rightStaffBottomY + 3.5`, verified in `svg.js:851`). If a below-RH note's *baseline* is
  pushed down by `DYNAMICS_LANE_RESERVE (~4.5)` but the *gap* only reserves `belowRH_stack`
  (the note stack height, not the dynamics offset), then with dynamics present the dodged
  below-RH note can be pushed past `leftStaffTopY` into / through the LH staff — exactly the
  collision the flex exists to prevent.

The research summary line (D3fu recap, "summary" bullet 3) *does* fold "per-side-dynamics-
reservation" into the `max(...)`, but the locked D3fu formula block and the design doc's stated
formula both omit it. So the doc contradicts itself (and its own research) on whether
`belowRH_stack`/`aboveLH_stack` already include the dynamics dodge.

**Where in design doc:** Key Decisions → "Four placement bands with an always-flexing inter-staff
gap and bottom margin (PAIR A)" (the `effectiveInterStaffGap` formula); cross-referenced by the
"Risks and Open Questions" → "Pipeline reorder" item.

**Suggestion:** Make the gap formula's stack terms explicitly include the dynamics dodge, e.g.
define `belowRH_stack` / `belowLH_stack` as *the full reserved height from the staff line to the
furthest note baseline + descent* (i.e. `(RH_has_dynamics ? DYNAMICS_LANE_RESERVE : NOTE_GAP_STAFF)
+ (n−1)·STACK_STEP + descent`), and state that this same quantity feeds both the per-note
baseline and the flex max. Alternatively add an explicit `+ (RH_has_dynamics ?
DYNAMICS_LANE_RESERVE − NOTE_GAP_STAFF : 0)` term to the `max(...)`. Either way, make the one
definition of `*_stack` unambiguous so two implementers compute the identical `lhTopY`.

**Why it matters:** This is the single most structural change in the feature (the occupancy →
gap → `lhTopY` reorder). If the gap under-reserves when dynamics are present, the common
"chord-context below-RH + pedal above-LH with RH dynamics" case overlaps the LH staff — a
silent rendering failure that the relative/existence-only tests would not catch. Two
implementers reading the current text could legitimately produce different geometry.

### Issue 3 (OPTIONAL): The "permissive `additionalProperties` → stray field silently valid" claim is stated more broadly than the schema guarantees

**What's wrong:** The doc repeatedly states that a stray `staff`/`beat` on a per-event note,
and a legacy `chordSymbol`, are "silently ignored" because `additionalProperties` is permissive.
That is true for these specific keys — but the reasoning as written ("the schema is permissive
about unknown keys") would equally (and wrongly) imply that a *declared* property with a bad
value is ignored. It is not: declared properties are still validated (`validate.js:191-198`).
The distinction matters because `eventNote` does **not** declare `staff`/`beat`, so they fall
through as unknown keys — but if a future reader adds `staff`/`beat` to `eventNote` "for
symmetry," the AC "a stray `staff`/`beat` on a per-event note is ignored (not an error)" would
break (a bad `staff` enum value would then error). The design relies on `eventNote`
*deliberately omitting* `staff`/`beat`, not merely on permissiveness.

**Where in design doc:** Interfaces and Data Flow → "Schema additions" ("`additionalProperties`
is permissive everywhere, so: a stray `staff` or `beat` … is silently ignored"); Failure Modes
("permissive `additionalProperties` ignores them").

**Suggestion:** Add one clause noting that the stray-field-ignored behavior depends on
`eventNote` *not declaring* `staff`/`beat` (so they are genuinely unknown keys), i.e. "do not
add `staff`/`beat` to `eventNote`." This pins the invariant the AC depends on.

**Why it matters:** It protects an acceptance criterion (stray field ignored on per-event notes)
against a plausible well-meaning future edit, and tightens the doc's precision. Optional because
the schema as designed already produces the correct behavior.

### Issue 4 (OPTIONAL): Standalone-note coordinate frame is left implicit

**What's wrong:** Per-event notes render inside `<g data-hand transform="translate(0
staffBottomY)">`, so their Y is in the hand's **local** frame (hence the existing
`chordDy = bandY − staffBottomY` conversion). Standalone notes render directly under
`<g data-measure transform="translate(measure.x 0)">` (no Y translate), so their Y must be the
band anchor in **system** coordinates — *not* converted. The doc specifies the DOM nesting
("standalone … not inside a hand group") and flags `chordDyR/chordDyL` generalization as an open
question, but never states that standalone notes consume the raw band anchor Y while per-event
notes consume the local-frame conversion. An implementer could mistakenly apply the
`chordDy`-style subtraction to standalone notes (placing them at the wrong Y).

**Where in design doc:** Interfaces and Data Flow → "Emitted DOM (observability contract)";
Risks → "`chordDyR`/`chordDyL` generalization".

**Suggestion:** Add one sentence: standalone notes use the band anchor Y directly (system frame,
since their `<g data-measure>` has no Y translate); per-event notes use the local-frame
conversion (band anchor − the hand's `staffBottomY`).

**Why it matters:** It removes a real ambiguity in a two-frame emit and prevents a wrong-Y
implementation for an entire emit path. Optional because a careful implementer would infer it
from the existing `renderMeasure`/`renderHand` structure.
