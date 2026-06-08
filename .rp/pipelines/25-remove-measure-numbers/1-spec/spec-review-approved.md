# Spec Review

## Verdict: approved

## Summary

The revised spec is sound, complete against the consolidated requirements, and
fully resolves both issues from the prior rejection. The core removal requirement
(Req1), the unconditional-everywhere requirement (Req2), the non-regression
guarantees for above-staff content (Req3), the no-orphaned-whitespace constraint
(Req4), and the internal-index preservation (Req5) are all accurately grounded in
the source. I re-verified every code reference the spec relies on: the editor
renders only a `TextareaControl` (`src/edit.js`), the block is dynamic and
`src/render.php` emits only a song-carrying `<div>` with no notation, and the
score is drawn exactly once client-side by `src/view.js` (`buildLayoutModel` →
`renderInto`, view.js:133-134). The two previously-flagged factual errors are
gone, and the spec stays at the WHAT level — it correctly avoids leaking
implementation names (`showsMeasureNumber`, `innerZone`, `data-text="measure-number"`,
`data-measure`, `MEASURE_NUMBER_SIZE`) while keeping the acceptance criteria
testable against observable output. No remaining or newly-introduced issues rise
to the level of a rejection.

## Resolution of prior issues

### Prior Issue 1 — "editor preview" / "saved render" fabrication — RESOLVED

The revised Requirement 2 (spec.md:35-40) now states the removal is unconditional
and that "the notation is drawn through a single client-side render path — the
only place the score is ever drawn — removing the label there removes it
everywhere the notation can appear." The Overview (spec.md:5-10) independently and
correctly describes the single render path, noting the editor shows only a
raw-JSON text field (never a rendered score) and the emitted front-end markup
carries the song but no drawn notation. Both statements match the codebase:
`src/edit.js` renders only a `TextareaControl`; `src/render.php` (dynamic block,
`"render": "file:./render.php"` in block.json) emits a single `<div>` wrapping the
song JSON in an inert `<script>` with no notation; `src/view.js` is the sole path
that draws the score. The non-existent "editor preview" and "saved render" framing
is fully removed.

### Prior Issue 2 — AC2 dual-path premise and weak "output is unchanged" — RESOLVED

The revised AC2 (spec.md:80-81) now reads: "no measure-number label is emitted (as
before — a single-system score never carried one), and no other above-staff
element is added, removed, or shifted by the change." This is a concrete
negative-emission check, consistent with AC1's form, with no dependence on an
unstated baseline or on a misdescribed render topology.

## Notes (non-blocking, no action required)

- AC4/Req4 phrase the whitespace constraint as a model-level property ("a system's
  top margin must not depend on the removed-number condition"). This is borderline
  toward HOW, but it is expressed as an observable/testable invariant rather than
  a prescribed implementation, and it carries the necessary guard that systems may
  legitimately differ for unrelated reasons (ledger extent, tempo/ottava marks). It
  is acceptable at the WHAT level and matches the resolution recorded in
  spec-research (Q3a).
- AC6 names "the measure-number text-size constant" only as an illustrative
  example of the no-dead-code criterion, by description rather than by code
  identifier. This keeps it at the WHAT level while remaining testable.
- Req5/AC5 correctly describe the internal per-measure index as a renderer output
  property without naming `data-measure`, while remaining inspectable. Verified
  against svg.js:519.
