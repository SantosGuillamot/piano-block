# Doc plan review — APPROVED (#13)

Reviewer: `doc-plan-reviewer`. Adversarial review of
`3-plan/doc-plan.md` against `0-prompt/prompt.md`, `1-spec/spec.md`,
`2-design-doc/design-doc.md`, and `3-plan/code-plan.md`, plus an independent
inspection of the repository's actual documentation.

## Verdict

**APPROVED.** The doc plan's minimal footprint is correct: the change is a pure
internal placement fix that leaves no user-facing documentation stale. I verified
every load-bearing claim directly in the repo (not by trusting the plan), checked
the phase boundary against the actual source, and confirmed DT1 is concrete and
executable with a well-specified — not under-defined — no-op exit. I found no
substantive problem and am not rejecting merely for smallness.

## What I verified independently (repo facts, not plan assertions)

**Doc inventory.** `docs/` contains only `song-format.md`. Top-level docs are
`README.md` and `AGENTS.md`. No `CHANGELOG*`/`HISTORY*` exists. Matches the plan.

**`docs/song-format.md` makes no now-incorrect placement claim — confirmed by
reading, not by trusting the plan.** Every `octaveShift` mention is
field-semantics only:

- Lines 125, 131–134: field shape, the signed `−2..+2` range, and the sign→label
  mapping (`+1`=8va … `−2`=15mb). No staff-placement statement.
- Lines 138, 140: inheritance / section-scoping / fallback to `0`. No placement.
- Lines 377–379: the forward-looking "sounding octave = octave + octaveShift"
  model. No placement.
- Line 460: the annotated example uses a **right-hand** `octaveShift: 1` — a
  field-usage example, not a placement illustration; the fix does not change how
  it validates or which fields it uses.

None of these describes **where** the dashed bracket is drawn relative to a staff,
so the fix invalidates nothing here. The plan's central claim holds.

**A placement model the plan did not cite actually *corroborates* the fix (not a
miss that creates staleness).** The annotations section (lines 219–228) documents
"all four grand-staff positions" and states that a left-hand `placement: "above"`
lands **in the inter-staff gap** ("below the right hand and above the left hand
share that band"). This is the *annotations* feature, but it independently
describes the same LH-"above"-in-the-gap model the ottava fix implements — so it
is **consistent with**, not made stale by, the change. No correction task is
owed. (Worth noting at doc-write time only as a vocabulary reference for DT1, not
a blocker.)

**The model DT1 mirrors is real and accurately cited.** The gradual-dynamics
**Placement** note is exactly at line 301 ("drawn per hand, below that hand's own
staff"), with the per-hand limit restated at line 310. DT1's instruction to mirror
this note's voice for `octaveShift` is grounded in an existing, stable pattern.

**README has no ottava-placement narrative.** "octave shift" appears once
(line 164) as a feature the example song exercises. "What the front end shows"
(lines 45–57) lists "staves, clefs, notes, rests, and accidentals" at a high level
with no bracket-placement claim. Nothing stale; a placement paragraph here would
be scope-creep for an internal fix — correctly excluded.

**AGENTS.md rule is real.** It forbids referencing the `.rp/` workflow, phases,
`T#`/`AC#`, or "review N" in shipped code/docs. The plan and DT1's acceptance both
honor it explicitly.

**No example/fixture demonstrates a left-hand `octaveShift` or asserts geometry.**
Consistent with the plan and with the code plan's backward-compat backbone (no
existing fixture sets `leftHand.octaveShift > 0`; no test asserts an ottava
`x1`/`x2`). So no example change is warranted.

## Phase boundary — correct

The plan defers four stale inline comments to the Code phase. I confirmed each
sits on a symbol that T1–T6 rewrite:

- `effectiveInterStaffGap` (layout.js:1859) → T3 (new LH-above max-arm).
- `systemHasOttavaAbove` comment (2648) **and** the `systemHasTempo` JSDoc phrase
  "a positive `octaveShift` in **either hand**" (2634–2635) → T2 (predicate split
  to RH-only for the top margin). The plan caught the `systemHasTempo` "either
  hand" line specifically (doc-plan.md:82) — a subtle, easy-to-miss adjacent
  comment — and assigned it to Code.
- `topMarginLayout` JSDoc "then an above-staff ottava" (2780) → T2 (trigger
  repointed to RH-only).
- `buildSystemTexts` header "one bracket per … spanning that run's notes"
  (2850–2852) → T5 (per-hand above lane) + T6 (measure-extent span).

Deferring these to Code is the right call: they are inline narrative tied directly
to symbols the code-writers edit, so updating them is a code-writer duty under the
standing "write code that reads like the surrounding code" instruction — not a
separate Docs task. Crucially, the plan does **not** silently drop them: it flags
each for review-time confirmation (doc-plan.md:78–94) without scheduling a Docs
task. Scheduling a Docs task to rewrite a comment the code-writer is
simultaneously rewriting would immediately duplicate/conflict — so the plan's
boundary is also the drift-resistant choice.

## DT1 task quality — concrete, executable, well-specified no-op

DT1 is right-sized for a pure placement fix:

- **Concrete:** specific file (`docs/song-format.md` only), specific anchor (the
  `octaveShift` bullet at ~131–134), a real and verified model to mirror (the
  gradual-dynamics Placement note at line 301), bounded scope (≤2 sentences, no
  schema/range/mapping/inheritance/sounding-octave change), explicit AGENTS.md
  compliance, and dependency on T1–T7 landing green so the documented placement
  matches shipped behavior.
- **The "no-op outcome allowed" acceptance does not under-define the phase.** For a
  pure internal placement fix where field semantics are unchanged and no existing
  statement is wrong, an optional enrichment task with an explicit no-op exit is
  the correct shape. The exit is well-specified: it names the decision criterion
  (field semantics unchanged + no wrong statement) and requires recording which way
  the decision went rather than padding. That is a defined terminal state, not an
  open hole.

## Drift-resistance — strong

The plan schedules exactly one doc touchpoint, and it mirrors an established,
stable pattern (the hairpin Placement note) rather than inventing internals-coupled
prose. It deliberately avoids any Docs edit that would duplicate the inline
narrative the code-writers rewrite. Nothing scheduled here will immediately drift.

## Issues found

None blocking. One optional, non-blocking note for the doc-writer (not a condition
of approval): if DT1 lands, prefer phrasing the LH-"above" case as "in the
inter-staff gap, above the left-hand (bass) staff," consistent with the existing
annotations placement table (lines 219–228), so the two placement narratives share
vocabulary.

## Outcome

APPROVED. The doc plan correctly identifies a minimal footprint, leaves no stale
documentation, draws the phase boundary correctly (with review-time flags rather
than silent drops), and specifies DT1 concretely with a defined no-op exit.
