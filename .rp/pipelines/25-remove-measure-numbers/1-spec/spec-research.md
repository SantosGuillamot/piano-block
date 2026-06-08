# Spec Research: Remove measure numbers from the notation

_Issue #25 — https://github.com/SantosGuillamot/piano-block/issues/25_

## Goal (from prompt, treated as hypothesis to validate)

Measure numbers are no longer displayed in the Piano block's rendered notation.
Today, each wrapped system after the first prints a small measure-number label
above-left of its first measure (e.g. **3** on line 2, **5** on line 3); measure 1
is un-numbered. The desired outcome: a score that renders with no measure-number
labels at all.

## Grounding from the codebase (read directly, before Q&A)

The prompt's premise is confirmed by the source:

- `src/notation/layout.js:2954-2964` — `buildSystemTexts()` builds a per-system
  `measureNumber` text primitive: `null` when the system opens on measure 1,
  otherwise `{ text: String(head.number), x, y }` placed above-left of the
  system's first measure.
- `src/notation/layout.js:1730-1745` — measures get a sequential 1..N `number`
  across the whole song (never reset by sections).
- `src/notation/layout.js:2874-2877` — `topMarginLayout()` reserves vertical room
  above the staff (`MEASURE_NUMBER_SIZE + 1`) for systems that show a number,
  via `showsMeasureNumber = members[0]?.number !== 1`.
- `src/notation/svg.js:1104-1115` — `renderSystemTexts()` emits the number as an
  SVG `<text data-text="measure-number" font-size=MEASURE_NUMBER_SIZE>`.
- `src/notation/constants.js:179` — `MEASURE_NUMBER_SIZE` defines the text size.
- Tests assert current behaviour: `layout.test.js:2221-2226`
  (`systems[0].texts.measureNumber` is null; later systems carry numbers);
  `svg.test.js` references `data-text="measure-number"`.

This is a single, well-contained label feature. No measure-number-related public
block attribute exists in `block.json` — it is purely rendered output.

## Q&A Log

(one question at a time to spec-researcher; recorded in real time)

### Q1 — Scope: complete removal vs. conditional/optional?

**Answer: COMPLETE removal.** No measure-number label appears anywhere in the
rendered notation — for any song, any number of systems/lines.

- There is exactly ONE code path that emits a visible label, and it is purely
  mechanical (driven only by system position, not user intent/content):
  `buildSystemTexts` sets `measureNumber` for every wrapped system after the
  first; `renderSystemTexts` always emits the `<text data-text="measure-number">`
  node when that object is non-null.
- There is NO setting/attribute/option gating it. The block exposes a single
  attribute, `song` (`block.json`), read by `render.php` and `edit.js`. So there
  is no existing "show measure numbers" toggle to preserve behind, and no
  per-system/per-song condition under which the label is meaningful to keep.
- The opening system being un-numbered today is just the convention that measure 1
  is obvious; with labels gone entirely, no system (first or later) shows a number.
- Observable outcome: a song that wraps onto 2+ lines no longer shows the little
  "3"/"5"/etc. at the start of any line; a single-line song is unchanged (it
  already had none).

### Q2 — Vertical spacing side-effect (top-margin reservation)

Researcher's caveat (flagged as recommendation, NOT dictated by the issue text):
removing the label means the top-margin reservation that reserves vertical room
for it on numbered systems (`topMarginLayout`, `showsMeasureNumber` branch,
`MEASURE_NUMBER_SIZE + 1`) should also go. If left in place, those systems keep a
small empty gap above the staff where the number used to be — a subtle but
observable inconsistency between the first system and later ones. "Complete
removal" should reasonably include not leaving its reserved whitespace behind.

**Resolution (Q3a, requirement strength):** spacing-reclaim is an ALLOWED
implementation choice, NOT a hard stated requirement. The only hard,
user-observable requirement is "the number is not visible, and nothing looks
broken (no overlap/clipping/misplaced elements)."

Evidence the reservation is visually near-irrelevant:
- `topMarginLayout` computes `innerZone = max(ledgerTop, showsMeasureNumber ?
  MEASURE_NUMBER_SIZE + 1 : 0)`, then `topMargin = max(SYSTEM_TOP_MARGIN,
  topExtent + ABOVE_STAFF_PAD)`.
- Constants: `SYSTEM_TOP_MARGIN = 5`, `MEASURE_NUMBER_SIZE = 2.2`,
  `ABOVE_STAFF_PAD = 1`. The number's contribution to `innerZone` is
  `2.2 + 1 = 3.2`. It only lifts the final `topMargin` past the `5` floor when
  `innerZone > 4` — so 3.2 alone is fully ABSORBED by the floor in the common
  case (low/no ledgers, no above-RH stack, no ottava): removing it changes
  nothing visible.
- It only adds visible space in a narrow edge case (ledger/above content already
  pushes `innerZone` into ~3.2–4+ such that the number term is the binding max),
  and even then the delta is a fraction of a unit on one system — never enough to
  look broken or read as "blank space where the number used to be."

Decision: state spacing as "no requirement to preserve OR reclaim the
previously-reserved space; constraint is only that the notation remains visually
correct." Keep it a WHAT (looks correct), not a HOW (must delete the branch).

### Q3a — Final wording for the spacing/regression requirement

Researcher agrees with the stronger, testable bar, with a wording guard. State as
two requirements:
1. (Hard core) No measure-number label is rendered anywhere, for any song / any
   number of systems.
2. Other above-staff elements (tempo marks, ottava brackets, high notes / ledger
   lines) remain correctly placed — no overlap, clipping, or shift caused by the
   removal.

Guard on the spacing clause: phrase it as "no orphaned blank band above a system
that previously existed SOLELY to reserve the number," NOT "later systems sit at
pixel-identical offsets to the first." Systems legitimately differ for other
reasons (ledger extents, presence of tempo/ottava/above-RH stacks — all computed
in `topMarginLayout`). The precise, checkable form: after the change, a system's
top margin must NOT depend on whether it would have shown a number — i.e. the
`showsMeasureNumber` term is gone from the `innerZone` computation. That asserts
"no number-attributable whitespace" without over-constraining unrelated spacing.

### Q3b — Scope boundary (confirmed, with one rationale correction)

KEEP (untouched):
1. The INTERNAL sequential `number` on each measure (`buildLayoutModel`,
   layout.js:1730-1745) AND its propagation to `measureModel.number`
   (layout.js:2120). **Rationale correction:** my stated reason ("needed by
   ottava/tempo logic") was WRONG. Ottava keys off each measure's `octaveShift`
   (layout.js:3009-3010); tempo keys off `m.diff.tempo` / `m.ctx.tempo`
   (layout.js:2936-2939). Neither reads `.number`. The CORRECT reason to keep the
   counter: it feeds `measureModel.number` → the SVG `data-measure` attribute
   (svg.js:519). So keep the counter; just stop USING it for the label and the
   margin reservation.
2. The `data-measure` attribute (svg.js:519) — internal measure index, unrelated
   to the visible label; nothing in the issue touches it.
3. Tempo marks and ottava brackets — functionally unaffected (neither reads
   `.number`); only adjacency is the shared top-margin lane stacking, covered by
   requirement #2 above (must not regress).

REMOVE (the only things that disappear):
- The visible `<text data-text="measure-number">` node (svg.js:1104-1115) and the
  `texts.measureNumber` object that feeds it (`buildSystemTexts`,
  layout.js:2956-2964).
- The `showsMeasureNumber` reservation branch in `topMarginLayout`
  (layout.js:2874-2878).
- `MEASURE_NUMBER_SIZE` (constants.js:179-180) **if it becomes unused** — verified
  it does: its only uses are layout.js (import line 49, used at the reservation)
  and svg.js (import line 35, used at the label `font-size`); both vanish, so the
  constant and both imports can go.
- The test "measure 1 is not numbered; a later system numbers its first measure"
  (layout.test.js:2218-2230) must be removed/replaced — its assertions
  (`systems[0].texts.measureNumber` null; later systems numbered ≥2) no longer
  hold. Natural replacement: assert NO system carries a measure number.

Nothing else is in scope.

## Consolidated Requirements

These describe WHAT the change must achieve (observable outcomes), not HOW to
implement it. The prompt's premise was validated against the source and holds.

### Functional requirements

- **R1 — No measure-number label is ever rendered.** The Piano block's rendered
  notation (grand staff, treble + bass) must not display any measure-number label,
  for any song and any number of systems/lines. The small numbers that today
  appear above-left of the first measure of each wrapped line after the first
  (e.g. "3" at the start of line 2, "5" at the start of line 3) no longer appear.

- **R2 — Removal is unconditional.** There is no setting, attribute, or mode that
  re-enables measure numbers. (The block exposes only the `song` attribute; no
  toggle exists today, and none is added.) Removal applies to both the editor
  preview and the saved/front-end render, since both go through the same notation
  rendering path.

### Non-regression requirements

- **R3 — Other above-staff elements remain correct.** Removing the label must not
  cause any overlap, clipping, or misplacement of other above-staff content:
  tempo marks, ottava (8va/8vb) brackets, and high notes / ledger lines must
  still be placed correctly. Tempo and ottava behavior is otherwise unchanged.

- **R4 — No number-attributable whitespace.** No empty vertical band may remain
  above a system that previously existed solely to reserve room for the now-absent
  number. Concretely (testable at the model level): a system's top margin must not
  depend on whether it would have shown a measure number. This is NOT a
  requirement that all systems share an identical top margin — systems
  legitimately differ for unrelated reasons (ledger extents, presence of
  tempo/ottava/above-staff note stacks). Equivalently: removing the number must
  not visibly alter spacing in the common case, and must not leave a noticeable
  gap in any case.

- **R5 — Internal measure index is preserved.** The internal sequential measure
  numbering used elsewhere in the rendering remains intact. In particular, each
  measure's `data-measure` attribute in the rendered SVG is unchanged (it is the
  internal measure index, not the visible label). Note: ottava and tempo logic do
  NOT depend on this counter (they key off `octaveShift` and tempo diffs
  respectively); the counter is retained because it feeds `data-measure`.

### Scope boundary (out of scope / unchanged)

- The song input format / schema, the `song` block attribute, and the editor's
  input UI are unchanged — this is purely a rendering-output change.
- Tempo marks, ottava brackets, dynamics, ties/slurs, and all other notation
  elements are unchanged except for the non-regression guarantees above.

### Acceptance criteria (testable)

- AC1 — Render a song long enough to wrap onto 2+ systems: no measure-number text
  appears at the start of any line (no `data-text="measure-number"` node is
  emitted, for any system). (Replaces the existing layout test that asserted
  measure 1 is unnumbered while later systems are numbered.)
- AC2 — Render a single-system song: output is unchanged (it never had a number).
- AC3 — Render a wrapping song that also has tempo changes and ottava brackets on
  later systems: those marks/brackets remain present and correctly placed (no
  overlap/clipping introduced).
- AC4 — A system that would previously have reserved space for a number does not
  retain that reserved whitespace: its computed top margin does not depend on the
  removed-number condition.
- AC5 — `data-measure` attributes on measure groups are still present and correct.
- AC6 — Build/lint passes and any constant left unused by the removal (e.g. the
  measure-number text-size constant) does not linger as dead code.

