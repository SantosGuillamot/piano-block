# Code Plan: Crescendo and decrescendo (gradual dynamics, note to note)

## Overview

This feature lets a Piano-block song author express a **gradual-dynamic span** — a
crescendo (growing louder) or a decrescendo (growing softer) running from a start
note to a later end note within one hand — and the renderer draws it on the
grand-staff SVG as a **hairpin wedge** (`<` for crescendo, `>` for decrescendo). It
is notation/rendering only; there is no audio engine and no effect on how the song
sounds (audio is explicitly out of scope).

The implementation is a near-exact clone of the existing tie/slur span pipeline,
diverging in exactly three places: a flat below-staff lane Y (not the per-note
notehead Y), a two-line wedge renderer (not the tie/slur Bézier arc), and a new
layout-layer cross-system clip that also fixes a latent tie/slur bug. It touches
four source files: `src/song/schema.js` (two new optional enum fields, zero new
validator logic), `src/notation/constants.js` (two tuning constants),
`src/notation/layout.js` (carry the lane Y, match/resolve the two new kinds via a
new hairpin builder, clip cross-system spans), and `src/notation/svg.js` (a new
`renderHairpin` emitter dispatched by kind). `src/song/validate.js` is **not**
touched — the two new enum fields ride the existing generic enum machinery.

The order is: data shape and constants first (Tasks 1–2), then the layout
data-flow change that carries the lane Y (Task 3), then matching/geometry for the
new kinds (Task 4), then the cross-system clip (Task 5), then the emit layer
(Task 6).

### Verified code anchors (used throughout)

These were verified against the real source in this worktree and supersede any
stale paths from earlier phases (there is no flat `layout.js`/`svg.js` confusion;
both files are the real ones under `src/notation/`):

- Hand keys are **`rightHand` / `leftHand`**, not `right` / `left`
  (`layout.js:846` — `const HANDS = ["rightHand", "leftHand"];`). Every record and
  test must use `rightHand` / `leftHand`.
- The `line()` helper is **5-arg**: `line(x1, y1, x2, y2, width)`
  (`svg.js:104`). The `width` argument is required (it becomes `stroke-width`);
  omitting it would emit an `undefined` stroke. `renderHairpin` must pass a width
  (use `STEM_THICKNESS`, as `renderSpan` does via its `stroke-width`).
- Schema event properties (`tie`/`slur`) are at `schema.js:146-147` inside
  `$defs.event.properties`.
- `recordSpanMarkers` is at `layout.js:2110`; it pushes
  `{ tie, slur, anchor, systemIndex }` and receives `staffBottomY` per-hand
  (call sites `layout.js:1827` and `1834`, passing `band.rightStaffBottomY` /
  `band.leftStaffBottomY`).
- `resolveAllSpans` is at `layout.js:2149`; it iterates `for (const kind of
  ["tie", "slur"])`, calls `matchSpans`, applies the shared anchor guard
  `if (!start.anchor || !stop.anchor) continue;` (`layout.js:2161`), then
  `buildSpanSpec` (`layout.js:2185`).
- `matchSpans` (`layout.js:1102`) is the stack matcher; reused verbatim.
- The post-resolution bucketing loop is at `layout.js:1882-1888`; `staffEndX =
  budgetSp - STAFF_MARGIN_X` is set at `layout.js:1867` and both the span and its
  start system (hence `staffEndX`) are in scope inside the loop.
- `renderSpan` (the tie/slur `<path>` Bézier) is at `svg.js:823`; the
  `renderSystem` span loop is at `svg.js:311-313`.
- Tests live at `src/song/__tests__/validate.test.js`,
  `src/song/__tests__/schema.test.js`,
  `src/notation/__tests__/layout.test.js`, and
  `src/notation/__tests__/svg.test.js`. The narrow-width
  `buildLayoutModel(song, width)` idiom forces multiple systems.

---

## Tasks

### Task 1: Add `crescendo` / `decrescendo` enum fields to the song schema

- **Goal:** Make a gradual-dynamic span expressible and strictly value-validated in
  the song JSON, symmetric with `tie`/`slur`, with zero new validator logic.
- **Files to change:**
  - `src/song/schema.js`
- **Changes:**
  - In `$defs.event.properties` (immediately after `slur: { enum: ["start",
    "stop"] }` at line 147), add two optional fields, byte-for-byte symmetric with
    `tie`/`slur`:
    - `crescendo: { enum: ["start", "stop"] }`
    - `decrescendo: { enum: ["start", "stop"] }`
  - Do **not** touch `src/song/validate.js`. The generic enum check
    (`validate.js` ~120-128) rejects an out-of-set value with a message of the
    shape `<path>: <value> is not one of the allowed values ["start", "stop"]`,
    and `validateObject` (~191-198) only inspects declared properties so a
    misspelled field name (e.g. `cresecndo`) is silently ignored. No start/stop
    pairing check is added — pairing is resolved best-effort at render time.
- **Depends on:** none
- **Traces to:** Reqs 1, 2, 3, 20; AC1, AC5, AC2. Design decisions "Data shape —
  two independent optional enum fields" and "No new validator logic."
- **Acceptance:**
  - A song with a `crescendo` span over ≥2 notes in one hand **and** a separate
    `decrescendo` span over ≥2 notes validates with no errors.
  - `crescendo: "increase"` (a value outside the allowed set) is reported as a
    conformance error whose message includes `crescendo` and the allowed values
    `["start", "stop"]`.
  - A misspelled optional field name (e.g. `cresecndo: "start"`) is silently
    ignored (validation returns no error for it).
  - A lone `crescendo: "start"` with no matching `stop` validates with no errors
    (pairing is not a conformance check).
  - The schema-shape assertion holds: `songSchema.$defs.event.properties.crescendo`
    and `.decrescendo` each equal `{ enum: ["start", "stop"] }`.
  - An existing song that uses no gradual dynamics still validates exactly as
    before (additive growth; AC2).

### Task 2: Add the two hairpin tuning constants

- **Goal:** Provide the fixed, never-width-derived aperture and the below-staff
  lane offset the hairpin geometry needs, in the shared constants module.
- **Files to change:**
  - `src/notation/constants.js`
- **Changes:**
  - Add two new `export const` values, in sp, near the other text/geometry
    constants:
    - `HAIRPIN_APERTURE` — the wedge's open-mouth height. Start at ~`1.0` sp.
      This is a **fixed constant**; it must **never** be derived from span width
      (a width-derived aperture would divide by `(x2 - x1)`, which is zero/near-zero
      for a degenerate two-note span — a NaN/Infinity risk; AC10).
    - `HAIRPIN_LANE_DY` — the lane center offset below a hand's staff **bottom**
      line (positive Y is downward). Start at ~`+3.0` sp, placing the wedge in the
      same below-staff dynamic band where point dynamics already sit
      (`renderHandText` draws dynamics at `y: 3.5` relative to the hand's staff
      bottom, `svg.js:851`).
  - Document each with a short JSDoc comment in the existing style (every value is
    sp except `SP_PX` and the integer tables).
- **Depends on:** none
- **Traces to:** Reqs 10, 18; AC3, AC10. Design decisions "Placement — per-hand,
  below each hand's own staff" and "Constant aperture — degenerate-safe by
  construction."
- **Acceptance:**
  - `HAIRPIN_APERTURE` and `HAIRPIN_LANE_DY` are exported numeric constants
    importable by `layout.js` and `svg.js`.
  - `HAIRPIN_APERTURE` is a literal constant value, not computed from any span
    dimension.

### Task 3: Carry the per-hand below-staff lane Y on each recorded event

- **Goal:** Make the per-hand below-staff lane Y recoverable downstream, since the
  current recorded `anchor.y` is the notehead Y and the lane Y cannot be
  reconstructed from it.
- **Files to change:**
  - `src/notation/layout.js`
- **Changes:**
  - In `recordSpanMarkers` (`layout.js:2110`): the function already destructures
    `staffBottomY` from `options` (line 2111) and receives it per-hand
    (`band.rightStaffBottomY` ≈ staff bottom Y 9 for the right hand,
    `band.leftStaffBottomY` ≈ 21 for the left; call sites 1827/1834). Add a
    precomputed lane Y to **every** pushed stream entry (lines 2128-2133), e.g.
    `laneY: staffBottomY + HAIRPIN_LANE_DY`. Push it on every entry unconditionally
    — including entries with `anchor: null` (a rest/unplaceable note) — so matching
    never desyncs and the field is always present.
  - Import `HAIRPIN_LANE_DY` from `./constants.js` in `layout.js`.
  - This change is **purely additive**: the existing tie/slur read path reads only
    `anchor` and the per-kind marker, never `laneY`, so no existing read path
    changes.
- **Depends on:** Task 2
- **Traces to:** Reqs 6, 10; AC3. Design section "The critical data-flow finding:
  the lane Y must be carried."
- **Acceptance:**
  - Each entry pushed onto `placedEvents.rightHand` and `placedEvents.leftHand`
    carries a numeric `laneY` field in addition to the existing
    `{ tie, slur, anchor, systemIndex }`.
  - The right-hand `laneY` and left-hand `laneY` differ (the lane is per-hand,
    derived from the per-hand `staffBottomY`), with the right-hand value smaller
    (higher on the page) than the left-hand value.
  - An event with no placeable note (a rest) still gets a stream entry carrying a
    numeric `laneY` (and `anchor: null`).
  - Existing tie/slur resolution is unaffected — resolving a tie/slur song produces
    the same span records as before this change.

### Task 4: Match and build the two new span kinds (hairpin builder)

- **Goal:** Resolve `crescendo`/`decrescendo` markers into wedge span records,
  reusing the existing matcher and rest-anchor guard, dispatching by kind to a new
  hairpin builder that produces a flat-lane wedge record.
- **Files to change:**
  - `src/notation/layout.js`
- **Changes:**
  - In `resolveAllSpans` (`layout.js:2149`): extend the hard-coded kind list from
    `["tie", "slur"]` to `["tie", "slur", "crescendo", "decrescendo"]`. The
    existing per-kind projection (`stream.map((e) => ({ marker: e[kind] }))`),
    `matchSpans` call, and shared anchor guard `if (!start.anchor || !stop.anchor)
    continue;` (line 2161) are reused **verbatim** — the two new kinds get two
    fully independent per-hand `matchSpans` passes and inherit the never-throws
    drop behavior with no new logic.
  - After the guard, dispatch by kind: `tie`/`slur` → the existing, **byte-
    identical** `buildSpanSpec` (line 2185); `crescendo`/`decrescendo` → a new
    hairpin builder.
  - Add a new hairpin builder function (sibling to `buildSpanSpec`) that returns a
    plain-data wedge record:
    ```js
    {
      kind,            // "crescendo" | "decrescendo"
      hand,            // "rightHand" | "leftHand"
      systemIndex,     // start.systemIndex
      x1, x2,          // start.anchor.x, stop.anchor.x (note horizontal centers)
      yCenter,         // start.laneY (the flat below-staff lane Y for this hand)
      aperture,        // HAIRPIN_APERTURE (the shared constant)
      crossSystem,     // start.systemIndex !== stop.systemIndex
    }
    ```
    - `x1`/`x2` reuse `anchor.x` (`measureX + note.x`) exactly as tie/slur do.
    - `yCenter` comes from the carried `start.laneY` (Task 3) — a **flat** lane Y,
      constant across the span; it ignores `anchor.y` (notehead Y) and
      `anchor.direction` (stem side is irrelevant to a fixed lane element).
    - `aperture` is the constant `HAIRPIN_APERTURE`, never width-derived.
    - The builder does **no** division by `(x2 - x1)`, so a near-zero-width span is
      finite and never throws.
  - Import `HAIRPIN_APERTURE` from `./constants.js`.
- **Depends on:** Task 2, Task 3
- **Traces to:** Reqs 1, 6, 7, 12, 13, 14, 16, 17, 18; AC1, AC3, AC6, AC7, AC10.
  Design sections "Matching," "Geometry," "The hairpin span record," and decisions
  "Data shape" and "Constant aperture."
- **Acceptance:**
  - A crescendo span over ≥2 notes resolves to exactly one wedge record with
    `kind: "crescendo"`, `x1`/`x2` at the start/end note centers, `yCenter` equal
    to the start event's carried `laneY`, and `aperture === HAIRPIN_APERTURE`.
  - A decrescendo span resolves identically with `kind: "decrescendo"`.
  - The crescendo-vs-decrescendo distinction is carried by `kind` (the opening-vs-
    closing shape is produced at emit time in Task 6); both records carry the same
    flat `yCenter` and constant `aperture`.
  - A dangling start only, a dangling stop only, or two overlapping same-kind spans
    in one hand each resolve to a defined finite count (a dangling start/stop → 0
    wedge records; two overlapping same-kind starts → exactly 1 record), never
    throwing.
  - A span whose start or end lands on a rest / unplaceable note resolves to 0
    wedge records (the shared anchor guard skips the pair), never throwing.
  - A degenerate near-zero-width two-note span (start and end at near-identical X)
    resolves to 1 record with `x1 ≈ x2` and finite coordinates, never throwing.
  - A messa-di-voce hinge note carrying both `crescendo: "stop"` and
    `decrescendo: "start"` resolves to one crescendo record ending at the hinge X
    and one decrescendo record starting at the **same** X; the two share equal
    `yCenter` and equal `aperture` so the `< >` is gap/overlap-free.
  - A point dynamic at the span's start, end, both ends, or neither does not change
    the wedge record (the span resolves in all four cases); the dynamics remain on
    the measure's hand texts, independent of the wedge.
  - Tie/slur resolution is unchanged: a tie/slur song produces the same
    `buildSpanSpec` Bézier records as before, dispatched to `buildSpanSpec`.

### Task 5: Clip cross-system spans to the start system's staff end (generic)

- **Goal:** Make any span whose endpoints fall on different systems draw only its
  start-system portion (clipped to the start system's `staffEndX`), filed under the
  start system, never a foreign-frame or backwards stroke. Apply the clip
  generically to tie/slur/hairpin, which also fixes the existing (untested,
  latent) cross-system tie/slur garbage-stroke bug.
- **Files to change:**
  - `src/notation/layout.js`
- **Changes:**
  - In the post-resolution bucketing loop (`layout.js:1882-1888`), where each
    resolved span is pushed onto `systems[sp.systemIndex].spans`, add the clip
    **before** the push. Both the span and its start system are in scope, so
    `staffEndX` (= `budgetSp - STAFF_MARGIN_X`, set at line 1867) is available as
    `sys.staffEndX`.
  - The clip applies only when `sp.crossSystem === true` (and the start system
    exists). It is a **strict no-op** for within-system spans (`crossSystem ===
    false`) — the only case any existing test or example exercises — so
    within-system tie/slur and hairpin output is provably unchanged.
  - Clip math is **degenerate-safe** (no backwards stroke): clamp the right edge to
    `rightX = max(x1, min(x2, staffEndX))`. For a hairpin record, set `x2 = rightX`.
    For a tie/slur `buildSpanSpec` record, set `x2 = rightX` and also recompute the
    Bézier control X (`cx`) consistently so the clipped arc terminates at the new
    right edge rather than aiming at a foreign coordinate (e.g. `cx = (x1 + x2) /
    2`, the same midpoint rule `buildSpanSpec` uses). The clipped span stays filed
    under the **start** system only; no span piece leaks into any other system's
    array. v1 draws only the start-system portion and drops the continuation.
  - **Design-recommended scope note (owner-overridable):** This plan implements the
    design's **recommended generic** clip across tie/slur/hairpin, which is provably
    a no-op for within-system spans and fixes the latent cross-system tie/slur bug
    that OQ-3 directs Design to fix. The design also documents a **conservative
    hairpin-scoped alternative** (clip only `crescendo`/`decrescendo`, leaving the
    cross-system tie/slur bug in place for a maximally literal reading of AC8). If
    the owner prefers maximum AC8 conservatism, this task can be down-scoped to
    gate the clip on `kind === "crescendo" || kind === "decrescendo"`; in that case
    the cross-system tie/slur tests in Task 5's acceptance become "no-throw only."
    The recommended (and default-planned) approach is the generic clip.
- **Depends on:** Task 4
- **Traces to:** Reqs 9, 11, 19; AC4, AC8, AC9, AC10. Design decisions "Cross-system
  clip in the layout layer; draw start-system portion only" and "Make the clip
  generic across tie / slur / hairpin."
- **Acceptance:**
  - A within-system crescendo whose start and end fall in different measures of the
    same system is left untouched by the clip: `crossSystem === false`, and `x2`
    sits past the intervening barline X (one continuous wedge across the bar).
  - A cross-system crescendo (start on one system, end on a later system at a narrow
    render width): rendering completes without throwing; the wedge record is filed
    under the **start** system only; its `x2` equals the start system's
    `staffEndX`; and no wedge record with foreign coordinates leaks into any other
    system's `spans` array.
  - A cross-system **tie** and a cross-system **slur** (narrow width) likewise do
    not throw and have `x2` clamped to the start system's `staffEndX` (locking the
    latent-bug fix). (Down-scope fallback: if the clip is scoped to hairpins only,
    these assert no-throw only.)
  - A within-system tie/slur song produces byte-identical span records to before
    this change (the clip is a strict no-op for `crossSystem === false`; AC8).
  - A cross-system span whose start is at or past `staffEndX` yields a zero-width
    (never backwards) span; the clamp `max(x1, min(x2, staffEndX))` produces finite
    coordinates and never throws.

### Task 6: Emit the wedge — `renderHairpin` dispatched by kind

- **Goal:** Draw each resolved wedge record as two `<line>`s in a single
  `<g data-span data-hand>`, opening for a crescendo and closing for a decrescendo,
  while leaving the tie/slur `renderSpan` Bézier emitter byte-identical.
- **Files to change:**
  - `src/notation/svg.js`
- **Changes:**
  - Add a new `renderHairpin(span)` function (sibling to `renderSpan` at
    `svg.js:823`) that returns a single `<g>` element stamped
    `"data-span": span.kind` and `"data-hand": span.hand`, containing exactly two
    `<line>` children built with the **5-arg** `line(x1, y1, x2, y2, width)` helper
    (`svg.js:104`). Pass the stroke width as the fifth argument (use
    `STEM_THICKNESS`, the same width `renderSpan` strokes its path with) — omitting
    it would emit an `undefined` stroke width.
  - Use the record's `x1`, `x2`, `yCenter`, and `aperture`:
    - **Crescendo `<`** — vertex at the left (`x1`), fanning open to the right
      (`x2`):
      - `line(x1, yCenter, x2, yCenter - aperture / 2, STEM_THICKNESS)`
      - `line(x1, yCenter, x2, yCenter + aperture / 2, STEM_THICKNESS)`
    - **Decrescendo `>`** — open mouth at the left (`x1`), converging to a vertex at
      the right (`x2`):
      - `line(x1, yCenter - aperture / 2, x2, yCenter, STEM_THICKNESS)`
      - `line(x1, yCenter + aperture / 2, x2, yCenter, STEM_THICKNESS)`
    - Use **two separate `<line>`s**, not a single `<polyline>`/`<path>`: the two
      lines share only the vertex; a single connected primitive would draw a
      spurious third line between the two free mouth ends.
  - In the `renderSystem` span loop (`svg.js:311-313`), dispatch by kind: a span
    with `kind === "crescendo"` or `kind === "decrescendo"` → `renderHairpin(span)`;
    otherwise → the existing, **byte-identical** `renderSpan(span)`.
  - Leave `renderSpan` and `renderHandText` (point dynamics, `svg.js:845`)
    unchanged; the wedge shares the below-staff region but is emitted independently.
- **Depends on:** Task 4 (record shape), Task 5 (records are clipped before emit)
- **Traces to:** Reqs 6, 7, 9, 11; AC3, AC4, AC7, AC8. Design sections "Emit form,"
  decision "Hairpin form only for v1," and the "Make the clip generic" note (AC8).
- **Acceptance:**
  - The rendered SVG contains an element matching `[data-span="crescendo"]` and one
    matching `[data-span="decrescendo"]`, each a `<g>` containing exactly two
    `<line>` children, each stamped with the correct `data-hand`
    (`rightHand`/`leftHand`).
  - Crescendo wedge: at `x1` the two lines share the same Y (`|Δy| ≈ 0` — the
    vertex), and at `x2` they diverge to ±`aperture/2` (`|Δy| ≈ aperture`).
  - Decrescendo wedge: the mirror — the two lines are `aperture` apart at `x1` and
    converge to the same Y at `x2`. The crescendo and decrescendo are visibly
    distinct.
  - Each `<line>` carries a defined (non-`undefined`) `stroke-width`.
  - A span crossing barlines within one system renders as one continuous wedge from
    its start X to its end X (AC4).
  - When a point dynamic sits at a span's start, end, both ends, or neither, both
    the wedge (in `system.spans`) and the dynamic text(s) (a `[data-text="dynamic"]`
    element) render independently in every case (AC7).
  - Existing markings are unchanged: `path[data-span="tie"]` still exists as a
    `<path>` (Bézier), not converted to `<line>`s; a song combining a tie, a slur,
    an ottava, point dynamics, and a hairpin renders all of those selectors
    coexisting (AC8).
