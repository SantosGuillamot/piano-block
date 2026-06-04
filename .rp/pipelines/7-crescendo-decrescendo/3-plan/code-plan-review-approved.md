# Code Plan Review

## Verdict: approved

## Summary

The revised plan resolves all three findings from review 1 cleanly and survives a
full second adversarial pass. The build-breaking gap is fixed: Task 3 now extends
the inline-pushed `recordSpanMarkers` entry to
`{ tie, slur, crescendo, decrescendo, anchor, systemIndex, laneY }` (matching
design-doc.md:161-163), adds `crescendo: event?.crescendo` /
`decrescendo: event?.decrescendo` explicitly, and carries an acceptance bullet
asserting an authored `crescendo: "start"` produces a stream entry whose
`crescendo === "start"` — so the `e[kind]` projection in `resolveAllSpans` will
actually find the markers and Tasks 4/5/6 are no longer dead code. Task 5's
tie/slur clip now states coherent, explicit y behavior (X-only clamp, `y2`/`cy`
left at the foreign value as a documented v1 best-effort, with an explicit
instruction not to recompute a start-system-local y), and that wording stays
coherent under the documented hairpin-only down-scope. Task 3's laneY assertion
is softened: per-hand distinctness (`right laneY !== left laneY`) is the primary
criterion and the strict "right is smaller" ordering is asserted only for a song
with notes in both hands. I re-verified every load-bearing code anchor against
the real source in this worktree and they are all accurate: the inline push at
`layout.js:2128-2133` is exactly `{ tie, slur, anchor, systemIndex }`; the
projection at `layout.js:2153` is the inline `stream.map((e) => ({ marker:
e[kind] }))` (not the `projectMarker` helper); `crossSystem` is computed at
`layout.js:2211` and read nowhere (confirming the cross-system clip is a real
must-do); the bucketing loop is at `layout.js:1882-1888` with `staffEndX`
(`layout.js:1867`) in scope via `sys`; `HANDS` is `["rightHand","leftHand"]`
(`layout.js:846`); `line()` is 5-arg with `width → stroke-width` (`svg.js:104`)
and `line(..., STEM_THICKNESS)` is already used at `svg.js:628,660`; `renderSpan`
stamps `data-span`/`data-hand` at `svg.js:823-831`; the `renderSystem` span loop
is at `svg.js:311-313`; `renderHandText` draws dynamics at `y: 3.5`
(`svg.js:851`); `STEM_THICKNESS = 0.13` exists (`constants.js:36`); both files
already import from `./constants.js`; and `validateObject` only walks declared
`resolved.properties` so a misspelled field is silently ignored. AC1-AC10 each
trace to at least one task, dependencies are acyclic and correctly ordered, the
four design-called-out test surfaces are all present in task acceptance, no task
prescribes specific tests or documentation, and audio stays out of scope. The
plan is concrete, buildable, and ready.

## Resolution of the three prior findings

1. **(was build-breaking) Marker fields recorded on the stream entry — RESOLVED.**
   Task 3 (code-plan.md:148-154) extends the pushed object to carry
   `crescendo: event?.crescendo`, `decrescendo: event?.decrescendo`, and
   `laneY`, matching design-doc.md:161-163. An acceptance bullet
   (code-plan.md:180-183) asserts an authored `crescendo: "start"` yields a
   stream entry whose `crescendo === "start"` (and `decrescendo: "stop"` →
   `decrescendo === "stop"`), so the gap is now caught by an observable
   criterion. The "additive only for existing read paths" wording
   (code-plan.md:166-171) is corrected and explicitly explains the new fields
   feed the new matcher passes. Verified against the real inline push at
   `layout.js:2128-2133`.

2. **Task 5 tie/slur clip y behavior — RESOLVED.** Task 5 (code-plan.md:294-305)
   now states the clip touches horizontal coordinates only, sets `x2 = rightX`
   and `cx = (x1 + x2) / 2`, and **leaves `y2`/`cy` unchanged** as an accepted v1
   best-effort, with an explicit instruction the code-writer must not recompute a
   start-system-local y. The acceptance (code-plan.md:333-338) asserts the clip
   changes horizontal coordinates only and notes the foreign `y2`/`cy` is
   by-design. The wording stays coherent under the documented hairpin-only
   down-scope (tie/slur records untouched).

3. **Task 3 laneY ordering — RESOLVED.** Task 3 acceptance (code-plan.md:184-189)
   makes per-hand distinctness (`right laneY !== left laneY`) the primary
   criterion and asserts the strict "right is smaller (higher on the page)"
   ordering only for a song with notes in both hands, not for a degenerate
   single-hand band.

## Verified, no action needed

- **AC coverage:** AC1 → Tasks 1,4; AC2 → Task 1; AC3 → Tasks 2,3,4,6;
  AC4 → Tasks 5,6; AC5 → Task 1; AC6 → Task 4; AC7 → Tasks 4,6; AC8 → Tasks 5,6;
  AC9 → Task 5; AC10 → Tasks 2,4,5. Every criterion maps to a task.
- **Design test surfaces:** cross-system clamp for both hairpin and tie/slur
  (Task 5 acceptance, code-plan.md:327-338); degenerate near-zero-width two-note
  span (Task 4 acceptance, code-plan.md:256); messa-di-voce hinge with shared
  `yCenter`/`aperture` and `cresc.x2 === decresc.x1` (Task 4 acceptance,
  code-plan.md:257-260); AC8 existing-markings-unchanged (Task 5 no-op,
  code-plan.md:340, plus Task 6 `path[data-span="tie"]` stays a `<path>`,
  code-plan.md:396-399).
- **Ordering/feasibility:** dependencies are acyclic (1, 2 independent; 3→2;
  4→2,3; 5→4; 6→4,5) and each task is executable against the current code; the
  imports it requires (`HAIRPIN_LANE_DY`/`HAIRPIN_APERTURE` from `./constants.js`,
  `STEM_THICKNESS` already imported in svg.js) are feasible.
- **Surfaced (not hidden) choices:** the generic-vs-hairpin-scoped clip is an
  explicit owner-overridable scope note with a default (generic) and a concrete
  down-scope path (Task 5, code-plan.md:309-318), not a buried decision.
- **No scope creep, no test prescription, no documentation tasks, audio out of
  scope.** Acceptance bullets describe observable outcomes (what must be true),
  not which test files to write.
- **Correct overrides of stale design sketches:** the plan uses `rightHand`/
  `leftHand` (not the design's stale `right`/`left` in its record sketch at
  design-doc.md:186) and the 5-arg `line(..., STEM_THICKNESS)` (not the design's
  4-arg emit sketch at design-doc.md:224-230); both are called out and correct.
