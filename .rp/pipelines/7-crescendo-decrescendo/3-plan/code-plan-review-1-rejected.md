# Code Plan Review

## Verdict: rejected

## Summary

The plan is, structurally, an excellent near-clone of the tie/slur pipeline: the
file set is right, the task ordering is sound, every AC1–AC10 traces to at least
one task, the cross-system clip is correctly surfaced as the design's recommended-
over-alternative (down-scopable) choice rather than silently expanded scope, and
the audio-out-of-scope boundary is respected. I independently verified the
load-bearing code anchors against the real source and they are accurate: the hand
keys really are `rightHand`/`leftHand` (`layout.js:846`), `line()` really is 5-arg
with `width → stroke-width` (`svg.js:104`), the schema `tie`/`slur` enums sit at
`schema.js:146–147` inside `$defs.event.properties`, `recordSpanMarkers` pushes its
entry inline at `layout.js:2128–2133`, the post-resolution bucketing loop with
`sys.staffEndX` in scope is at `layout.js:1883–1888` (`staffEndX` set at 1867),
`renderSpan`/`renderSystem` are at `svg.js:823`/`311–313`, and `renderHandText`
draws dynamics at `y: 3.5` (`svg.js:851`). The plan even correctly *overrides* a
stale `right`/`left` hand label that survived into the design doc's record sketch.

However, there is one build-breaking gap that makes the entire feature inert as
planned: the recorded per-event stream entry is never given the two new marker
fields, so the matcher can never see a `crescendo`/`decrescendo` marker and no
hairpin record will ever be produced. Tasks 2, 4, 5, and 6 would all become dead
code. This must be fixed before the plan is buildable. Two smaller tightening
items are noted below. Because the headline issue silently breaks the core
feature, this is a rejection.

## Issues

### Issue 1: The recorded stream entry never carries `crescendo` / `decrescendo`, so matching is impossible

**What's wrong:** `resolveAllSpans` matches by projecting each stream entry with
`stream.map((e) => ({ marker: e[kind] }))` (real code at `layout.js:2154`). For
`kind === "crescendo"` this reads `e.crescendo`; for `kind === "decrescendo"` it
reads `e.decrescendo`. Those properties only exist on the entry if
`recordSpanMarkers` puts them there. The real `recordSpanMarkers` pushes its entry
**inline** at `layout.js:2128–2133` as exactly `{ tie, slur, anchor, systemIndex }`
— it does not use the `projectMarker` helper and it does not spread the event.
Task 3 instructs adding only a `laneY` field to that pushed entry and explicitly
calls the change "purely additive… reads only `anchor` and the per-kind marker,
never `laneY`." Task 4 then says the per-kind projection is "reused **verbatim**."
Nowhere in Task 3 (or any task) is the pushed entry given
`crescendo: event?.crescendo` / `decrescendo: event?.decrescendo`. The result:
every projected `marker` for the two new kinds is `undefined`, `matchSpans`
produces zero pairs, the hairpin builder is never invoked, and Tasks 2, 4, 5, and
6 are dead code. The design doc's own data-flow sketch is correct here and the
plan diverges from it — design `layout.js` flow lists the entry as
`{ tie, slur, crescendo, decrescendo, anchor, systemIndex, laneY }`
(design-doc.md:161–163), but the plan dropped the two new marker fields.

**Where in plan:** Task 3 (the `recordSpanMarkers` change), with downstream impact
on Task 4 (the `e[kind]` projection it reuses verbatim).

**Suggestion:** Add to Task 3's `recordSpanMarkers` change an explicit instruction
to push `crescendo: event?.crescendo` and `decrescendo: event?.decrescendo` onto
the entry alongside the existing `tie`/`slur` and the new `laneY` — i.e. the
pushed object becomes `{ tie, slur, crescendo, decrescendo, anchor, systemIndex,
laneY }`, matching design-doc.md:161–163. Update Task 3's "purely additive" wording
and at least one acceptance bullet to assert the two new marker fields are present
on the pushed entries (e.g. an event authored with `crescendo: "start"` produces a
stream entry whose `crescendo === "start"`), so the gap is caught by an observable
criterion rather than only at emit time.

**Why it matters:** Without it, the feature renders nothing. Validation (AC1, AC5,
the validate-only ACs) would still pass because Task 1 is independent, but every
rendering criterion — AC3, AC4, AC6 (hairpin paths), AC7, AC9, AC10 (hairpin shape)
— would silently fail: the SVG would contain no `[data-span="crescendo"]` /
`[data-span="decrescendo"]` element at all. This is the single change that makes
the whole pipeline live.

### Issue 2: Task 5's tie/slur clip clamps `x2`/`cx` but leaves `y2`/`cy` at the foreign system's notehead Y

**What's wrong:** Task 5 clips a cross-system `buildSpanSpec` record by setting
`x2 = rightX` and recomputing `cx = (x1 + x2) / 2`, but says nothing about `y2` or
`cy`. For a tie/slur, `y2` (and `cy`) are derived from the **end** note's notehead
Y on the end system (`buildSpanSpec`, `layout.js:2197–2199`), which is a foreign
system-local coordinate. Clamping only X yields a clipped arc that still terminates
at a foreign vertical position — a half-corrected stroke rather than a clean
start-system clip. (Hairpins are unaffected: their `yCenter` is the flat per-hand
lane Y, constant across the span, so clamping X alone is fully correct for them.)

**Where in plan:** Task 5, "Clip math is degenerate-safe" bullet.

**Suggestion:** Either (a) state explicitly that the tie/slur clip clamps X only
and accepts the foreign `y2`/`cy` as a documented v1 best-effort (consistent with
the design's "v1 draws only the start-system portion and drops the continuation"),
and add a one-line note to that effect; or (b) extend the clip to terminate the
arc at a start-system-local Y as well. Pick one so the code-writer does not have to
decide mid-task. If the owner takes the documented hairpin-only down-scope, this
issue disappears entirely (tie/slur records are left untouched).

**Why it matters:** No AC is violated (AC9 concerns the within-system portion and
non-throwing; AC8 is satisfied because the clip is a strict no-op for the
within-system tie/slur cases that have tests/examples), so this is not by itself a
blocker. But as written it hides a small design decision (what happens to the tie's
vertical endpoint on a cross-system clip) inside a task that claims to be fully
specified, which is exactly the kind of mid-task choice the plan is meant to remove.

### Issue 3: Task 3 acceptance asserts a right-vs-left lane-Y ordering that should be confirmed against the real per-hand staff-bottom values

**What's wrong:** Task 3's acceptance states the right-hand `laneY` must be
"smaller (higher on the page) than the left-hand value." This is almost certainly
correct given the real per-hand staff-bottom Ys (right-hand staff bottom ≈ 9,
left ≈ 21, so right lane ≈ 9 + `HAIRPIN_LANE_DY` < left lane ≈ 21 +
`HAIRPIN_LANE_DY`), and the design doc agrees (design-doc.md:209). The values are
sound. The concern is only that the acceptance bullet bakes in a strict ordering
assertion whose correctness depends on `band.rightStaffBottomY <
band.leftStaffBottomY` holding for *every* layout, including degenerate
single-staff or empty-hand bands. This is a borderline-fragile observable
criterion, not a wrong one.

**Where in plan:** Task 3, third acceptance bullet.

**Suggestion:** Keep the per-hand-distinctness assertion (right `laneY !==` left
`laneY`) as the primary criterion; soften the strict "right is smaller" ordering to
"for a song with notes in both hands" so it is not asserted for a degenerate
single-hand band. This is a minor robustness tweak, included so the same revision
pass that fixes Issue 1 can pick it up; it would not on its own warrant rejection.

## Note on non-blocking strengths (verified, no action needed)

- AC1–AC10 each trace to at least one task; the per-task "Traces to" lines are
  accurate against the spec and design.
- The four design-called-out test surfaces are all present in task acceptance:
  the cross-system clamp for **both** hairpin and tie/slur (Task 5 acceptance), the
  degenerate near-zero-width two-note span (Task 4 acceptance), the messa-di-voce
  hinge with shared `yCenter`/`aperture` and `cresc.x2 === decresc.x1` (Task 4
  acceptance), and AC8 existing-markings-unchanged (Task 5 no-op assertion + Task 6
  `path[data-span="tie"]` stays a `<path>`).
- The generic cross-system clip is correctly flagged as the design's
  recommended-over-alternative, owner-overridable choice with a concrete down-scope
  path (Task 5 scope note), not silent scope expansion.
- No task prescribes which unit/E2E tests to write; acceptance bullets describe
  observable outcomes. No documentation tasks are present. Audio remains out of
  scope.
