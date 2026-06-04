# Design Doc: Crescendo and decrescendo (gradual dynamics, note to note)

## Overview

The Piano block stores a song as a custom JSON document modelling a grand staff
(a right-hand part and a left-hand part) and renders it to SVG sheet music. Today
the only loudness marking a song can carry is a per-note **point dynamic** (a
single fixed level such as `p`, `mf`, `ff`, drawn as text below a hand's staff).
There is no way to express a *gradual* loudness change — a **crescendo** (growing
louder) or a **decrescendo** (growing softer) — across a run of notes.

This design adds a **gradual-dynamic span**: a crescendo or decrescendo running
from a start note to a later end note within a single hand, expressed in the song
JSON and rendered as a **hairpin wedge** (`<` for a crescendo, `>` for a
decrescendo). It is a notation/rendering feature only — it has no effect on how
the song sounds (there is no audio engine, and any sonic effect is explicitly out
of scope). The feature is built as a near-exact clone of the existing tie/slur
span pipeline, diverging in exactly three places: a flat below-staff lane Y (not
the per-note notehead Y), a two-line wedge renderer (not the tie/slur Bézier), and
a new layout-layer cross-system clip that also fixes a latent tie/slur bug.

## Approach

The mental model is: **gradual dynamics are tie/slur-shaped spans that draw a
horizontal wedge in the dynamics lane instead of an arc over the notes.**

The existing pipeline already handles every hard part of "a start→end pair within
one hand," and the new marking reuses it end to end:

1. **Data.** The author writes two new optional per-event fields, `crescendo` and
   `decrescendo`, each with the closed value set `"start" | "stop"` — byte-for-byte
   symmetric with the existing `tie` and `slur` fields. Direction is intrinsic to
   which field is used (it is never inferred from surrounding point dynamics). A
   messa-di-voce hinge note carries *both* fields at once
   (`crescendo: "stop"`, `decrescendo: "start"`).

2. **Validation.** The generic schema enum check rejects an out-of-set value;
   permissive `additionalProperties` silently ignores a misspelled field name;
   start/stop pairing is never validated (it is resolved best-effort at render
   time). This requires **zero new validator logic** — the two enum fields ride the
   same generic machinery `tie`/`slur` use.

3. **Matching.** At layout time, the same stack-based matcher (`matchSpans`) pairs
   each kind's `start` with its next `stop`, dropping anything unmatched without
   throwing. The two new kinds are added to the existing hard-coded kind list and
   get two fully independent per-hand stacks.

4. **Geometry.** For a matched pair, a new hairpin builder produces a plain-data
   span record whose endpoints are the two notes' horizontal centers and whose
   vertical position is a **flat below-staff lane Y** (constant across the span — a
   wedge is a horizontal lane element, it does not track note pitches). The wedge
   opens/closes by direction, at a fixed aperture.

5. **Cross-system clip.** After all systems are laid out, any span whose endpoints
   land on different systems is clipped in the layout layer so its right edge is
   the start system's drawn staff end (`staffEndX`). v1 draws only the start-system
   portion and drops the continuation. The clip is generic across tie/slur/hairpin
   and is a strict no-op for within-system spans.

6. **Emit.** A new `renderHairpin` draws the two wedge lines wrapped in a
   `<g data-span data-hand>`; the existing `renderSpan` (tie/slur Bézier) is left
   byte-identical and dispatched by kind.

No visual authoring UI is added; authoring stays raw, hand-written JSON, exactly
as every other marking is authored today.

## Components

All paths are real and current. Source lives under `src/song/` (data model and
validation) and `src/notation/` (layout geometry and SVG emit).

### Modified components

- **`src/song/schema.js`** — the JSON-schema-subset describing a song. Adds two
  optional fields to `$defs.event.properties`, alongside the existing `tie`/`slur`
  at lines 146–147. This is the *only* data-model change.

- **`src/notation/layout.js`** — the geometry layer; computes every X/Y in
  staff-space (sp). Three edits:
  - `recordSpanMarkers` (line ~2110): carry the two new per-event markers on each
    placed-event stream entry, and additionally carry the per-hand below-staff
    **lane Y** (see *Interfaces and Data Flow*).
  - `resolveAllSpans` (line ~2149): add `"crescendo"`/`"decrescendo"` to the kind
    list; after the existing shared anchor guard, dispatch by kind to either the
    unchanged `buildSpanSpec` (tie/slur) or a new hairpin builder.
  - The post-resolution loop (lines ~1882–1888) that buckets resolved spans into
    `systems[sp.systemIndex].spans`: add the generic cross-system clip here, where
    both the span and its start system's `staffEndX` are already in scope.
  - New: a hairpin builder function (sibling to `buildSpanSpec`).

- **`src/notation/svg.js`** — the emit layer; explicitly geometry-free (every X/Y
  is computed upstream; svg.js header lines 1–14). Two edits:
  - New `renderHairpin(span)` (sibling to `renderSpan` at line ~823).
  - `renderSystem`'s span loop (lines 311–313): dispatch by kind —
    crescendo/decrescendo → `renderHairpin`, else `renderSpan`.

- **`src/notation/constants.js`** — add two constants: `HAIRPIN_APERTURE` (the open
  mouth height, ~1.0 sp) and `HAIRPIN_LANE_DY` (the lane offset below a staff's
  bottom line, ~+3.0 sp). The aperture **must** be a fixed constant, never derived
  from span width.

### New components (logical, within existing files)

- A **hairpin builder** in `layout.js`, producing the wedge span record.
- A **`renderHairpin`** emitter in `svg.js`.
- The **generic cross-system clip** in `layout.js`'s post-resolution loop.

### Untouched but relevant components

- **`src/song/validate.js`** — purely structural/value validation. The generic
  enum check (lines ~120–128) and permissive `additionalProperties` handling
  (lines ~191–198) already produce exactly the required behavior for the two new
  enum fields. **No change.**
- **`renderSpan`** (the tie/slur Bézier emitter) and **`buildSpanSpec`** (the
  tie/slur geometry) stay byte-identical for the tie/slur kinds — this is the
  backbone of AC8 (existing markings render unchanged).
- **`matchSpans`** (line ~1102) and the rest-/unplaceable-anchor guard inside
  `resolveAllSpans` (line ~2161) are reused verbatim; the new kinds inherit their
  never-throws behavior with no new logic.
- **`renderHandText`** (point dynamics, svg.js ~845) and `buildSystemTexts`
  (below-staff ottava text) are untouched; the wedge shares their below-staff
  region but is emitted independently.

## Interfaces and Data Flow

### Public data-model interface (the authored JSON)

Two new optional fields on a song event, mirroring `tie`/`slur`:

```jsonc
// An event object inside a hand's event stream:
{ "type": "note", "step": "C", "octave": 4, "crescendo": "start" }   // span begins
// ... intervening notes ...
{ "type": "note", "step": "G", "octave": 4, "crescendo": "stop" }    // span ends

// A messa-di-voce hinge note carries BOTH fields:
{ "type": "note", "step": "C", "octave": 5, "crescendo": "stop", "decrescendo": "start" }
```

Schema delta (`schema.js`, `$defs.event.properties`):

```js
crescendo: { enum: ["start", "stop"] },
decrescendo: { enum: ["start", "stop"] },
```

Direction is encoded by *which field* carries the marker; it is intrinsic
author-supplied data and is never inferred. Two independent fields are what make
the hinge note expressible — a single combined field could not hold both "stop the
crescendo" and "start the decrescendo" on one note (the stack matcher has no
disambiguating `number`, unlike MusicXML).

### Internal data flow

```
song JSON
  └─ validateSong (validate.js) ── generic enum check + permissive additionalProperties
                                    (no pairing check)  → conformance result
  └─ buildLayoutModel (layout.js)
       └─ recordSpanMarkers  → per hand, per measure, pushes one entry per event onto
            placedEvents[hand]:  { tie, slur, crescendo, decrescendo,
                                   anchor: {x,y,direction}|null, systemIndex,
                                   laneY /* NEW: per-hand below-staff lane Y */ }
       └─ resolveAllSpans   → for each hand, for each kind in
            ["tie","slur","crescendo","decrescendo"]:
              matchSpans(projected) → pairs
              guard: skip if either anchor is null
              dispatch by kind:
                tie/slur            → buildSpanSpec  (UNCHANGED Bézier record)
                crescendo/decrescendo → hairpin builder (NEW wedge record)
       └─ post-resolution loop  → clip cross-system spans to start system's staffEndX
                                    (generic; no-op for within-system) → systems[i].spans
  └─ renderSystem (svg.js) ── span loop dispatch by kind:
       crescendo/decrescendo → renderHairpin (two <line>s in <g data-span data-hand>)
       tie/slur              → renderSpan (UNCHANGED <path> Bézier)
```

### The hairpin span record (layout → emit contract)

The hairpin builder emits a plain-data record, mirroring `buildSpanSpec`'s style:

```js
{
  kind: "crescendo" | "decrescendo",
  hand,            // "right" | "left"
  systemIndex,     // the START note's system
  x1, x2,          // start/end note horizontal centers (system-local sp)
  yCenter,         // flat below-staff lane Y for this hand (pitch-independent)
  aperture,        // shared constant (HAIRPIN_APERTURE)
  crossSystem,     // start.systemIndex !== stop.systemIndex
}
```

`x1`/`x2` reuse `anchor.x` (`measureX + note.x`, the note's horizontal center) as
is — the same value tie/slur use. The record **diverges** from `buildSpanSpec` in
three ways: it uses the flat lane `yCenter` (not the notehead `anchor.y`), it
ignores `anchor.direction` (stem side is irrelevant to a fixed lane element), and
it carries a constant `aperture` instead of an arc bulge. These divergences are
exactly why the hairpin builder is a separate function, not a branch inside
`buildSpanSpec`.

### The critical data-flow finding: the lane Y must be carried

`recordSpanMarkers` today stores only `anchor = { x, y, direction }`, where the
recorded `y = staffBottomY + staffStepToY(anchorStep)` is the **notehead Y**.
Neither `staffBottomY` nor `anchorStep` is stored, so the below-staff lane Y
(`staffBottomY + ~3`) **cannot be recovered** from `anchor.y` alone. And
`staffBottomY` is **per-hand, not constant** (right-hand staff bottom Y = 9, left
= 21; so the right-hand lane Y ≈ 12, left ≈ 24). Therefore `recordSpanMarkers`
must additionally push the lane Y onto each stream entry — pushing either the raw
`staffBottomY` (already a parameter of the function, line ~2111) or a precomputed
`laneY = staffBottomY + HAIRPIN_LANE_DY`. The hairpin builder then sets `yCenter`
from this carried value. This is the one required change to the recording layer;
it is purely additive (tie/slur resolution reads `anchor` + its marker, never the
new field, so no existing read path changes).

### Emit form

`renderHairpin` draws two straight lines using the existing `line()` helper
(svg.js line ~104, already used for staff lines), wrapped in a single
`<g data-span={kind} data-hand={hand}>` so a test can select the hairpin as one
unit (matching how `renderSpan` stamps `data-span`/`data-hand`):

- **Crescendo `<`** — vertex at the left (`x1`), fanning open to the right:
  - `line(x1, yCenter, x2, yCenter − aperture/2)`
  - `line(x1, yCenter, x2, yCenter + aperture/2)`
- **Decrescendo `>`** — open mouth at the left (`x1`), converging to a vertex at
  the right (`x2`):
  - `line(x1, yCenter − aperture/2, x2, yCenter)`
  - `line(x1, yCenter + aperture/2, x2, yCenter)`

A wedge is **not** a single `<polyline>`/`<path>`: the two lines share only the
vertex, so a single connected primitive would draw a spurious third line between
the two free mouth ends. Two `<line>`s inside a `<g>` is the correct primitive.

## Key Decisions

### Decision: Data shape — two independent optional enum fields (OQ-2)

- **Choice:** Add two independent optional per-event fields, `crescendo` and
  `decrescendo`, each `enum: ["start", "stop"]`, byte-for-byte symmetric with the
  existing `tie`/`slur`. The messa-di-voce hinge note carries both at once
  (`crescendo: "stop"`, `decrescendo: "start"`).
- **Alternatives:** (B) a single `hairpin: "start"|"stop"` field plus a separate
  `hairpinType` direction; (C) a single combined enum
  `"crescendo-start"|"decrescendo-start"|"stop"`.
- **Trade-offs:** Both (B) and (C) put both directions through *one* field, which
  the single-pending-start-per-kind matcher cannot disambiguate — they cannot
  express "this one note is both the stop of the crescendo and the start of the
  decrescendo," just as a single `tie` field could not be both. Shape (A) is the
  only candidate that makes the messa-di-voce hinge perfectly expressible, and it
  reuses the existing schema/validator/matcher with zero new code paths. The cost
  is two keys instead of one, which is exactly the precedent `tie`+`slur` already
  set. This mirrors MusicXML's `<wedge>` semantics (direction is intrinsic to the
  start token, messa di voce is two elements); MusicXML can use one field only
  because it adds a `number` attribute this codebase has no equivalent of.
- **Traces to:** Requirement 1, 2, 3, 16; AC1, AC5. Direction is author-chosen and
  not inferred (Req 2); the field follows additive-growth rules (Req 3); messa di
  voce is two adjacent spans sharing a hinge (Req 16).

### Decision: No new validator logic (OQ-2, continued)

- **Choice:** Leave `validate.js` unchanged. The generic enum check rejects an
  out-of-set value; permissive `additionalProperties` silently ignores a
  misspelled field name; start/stop pairing is never validated.
- **Alternatives:** Add special-case validation that checks each span is balanced
  (every start has a matching stop) and rejects dangling/overlapping markers as
  conformance errors.
- **Trade-offs:** Special-case pairing validation would contradict the spec
  (pairing is a render-time best-effort concern, Req 20) and diverge from how
  `tie`/`slur` already behave. The chosen approach is zero-code and exactly
  matches the existing markings. The trade-off is that a structurally valid song
  can still contain a dangling/unbalanced marker — which is intended: it is
  tolerated and resolved (dropped) at render time.
- **Traces to:** Requirement 3, 20; AC1, AC5. Validation matches the rendering
  split (Req 20); strict closed-set values, silent ignore of unknown fields
  (Req 3).

### Decision: Hairpin form only for v1; `cresc.`/`dim.` text form deferred (OQ-1)

- **Choice:** Render the hairpin wedge only. The `cresc.`/`dim.` text-with-dashed-
  line form is not implemented in v1.
- **Alternatives:** Also implement the text form, author-selected (never
  auto-selected by span length).
- **Trade-offs:** The hairpin is the required form (Req 7) and is correct notation
  for a span of *any* length, so hairpin-only is a complete, correct rendering.
  The text form is an additive SHOULD/MAY (Req 8), not a substitute — drawing text
  *instead* of a hairpin would fail Req 7. A reusable dashed-line + italic-label
  primitive already exists (`renderOttava`, svg.js ~934–958, dash pattern
  `"0.6 0.4"`), so the text form would be cheap to add later — which confirms it is
  low-cost future scope, not that it belongs in v1. Deferring keeps v1 focused.
- **Traces to:** Requirement 7 (required hairpin), Requirement 8 (optional text);
  AC3.

### Decision: Placement — per-hand, below each hand's own staff (OQ-4)

- **Choice:** Draw each wedge in the same per-hand frame the point dynamic already
  uses — below that hand's own staff bottom line — vertically centered in the
  point-dynamic band (`yCenter` at the carried lane Y, ~`staffBottomY + 3` sp),
  with the constant aperture. No new band lane is introduced.
- **Alternatives:** Place a single shared wedge **between** the two staves (the
  strict grand-staff convention).
- **Trade-offs:** Between-staves is both net-new band geometry (the region between
  right-hand bottom Y 9 and left-hand top Y 17 holds nothing today) **and** a model
  mismatch with the per-hand data shape — a shared between-staves lane is keyed to
  the grand staff, which would reintroduce cross-hand coordination (e.g. both hands
  with a wedge at the same X) that the per-hand model deliberately avoids. Per-hand
  below-staff reuses an existing frame, matches where point dynamics already sit,
  and is the spec's accepted simplification. The trade-off is that it is not the
  strict engraving convention; between-staves remains the noted future refinement.
- **Traces to:** Requirement 10, 15; AC3. Per-hand placement is an accepted
  simplification (Req 10, 15); placement is legible and collision-free (Req 10).

  **Collision with a bracketing point dynamic (AC7).** Because the wedge shares the
  dynamic lane, a wedge endpoint that coincides with a point dynamic on the same
  note is resolved **horizontally**: inset the wedge's start X to the right of the
  dynamic glyph (and/or its end X to the left), the conventional
  "from `p` ——`<` to `f`" look. **Acceptable simpler fallback for the build phase:**
  drop the wedge center ~0.5–1 sp below the dynamic baseline so it clears the
  dynamic ink vertically — slightly non-standard but legible and trivial, and still
  satisfies AC7 (AC7 requires both marks present and uncorrupted, not zero pixel
  overlap). The design fixes the *lane* (per-hand, below the staff, in the dynamic
  band, ~1 sp aperture); the exact aperture, center offset, and dodge inset are
  build-phase tuning, left to constants.

### Decision: Cross-system clip in the layout layer; draw start-system portion only (OQ-3)

- **Choice:** When a span's start and end fall on different systems, clip it in the
  **layout layer** so its right edge is the start system's drawn staff end,
  `staffEndX = budgetSp − STAFF_MARGIN_X` (set at layout.js line ~1867) — the same
  pre-scale, system-local frame the span's `x1` and lane Ys already live in. v1
  draws **only the start-system portion** and drops the continuation. The clip math
  is degenerate-safe: `rightX = max(x1, min(x2_or_known, staffEndX))`, so a start at
  or past the edge yields a zero-width (never backwards) wedge.
- **Alternatives:** (i) The full split rendering — emit two (or more) span pieces,
  one per system the span crosses, with a reversed open-mouth on the continuation
  and full-width pass-through pieces for any middle systems. (ii) Clip in the emit
  layer (teach svg.js the system's right edge).
- **Trade-offs:** Emit-layer clipping violates the geometry-free contract of svg.js
  (svg.js header lines 1–14), so the clip belongs in layout. The full split is not
  marginally free: it requires one matched pair to emit multiple records into
  multiple systems' span arrays, a reversed-mouth clip on the continuation,
  per-piece aperture continuity, and middle pass-through pieces for spans crossing
  3+ systems (a narrow-width span can cross four systems). The spec pins only the
  non-crash MUST-minimum: never throws, no corruption of other markings, and the
  within-system portion drawn (Req 19/AC9). The start-system-only clip meets that
  minimum at a fraction of the cost; full split is the noted future refinement.

  **This is a must-do, not an inherited capability.** *Verified against the real
  code:* there is **no** cross-system span clip today. `buildSpanSpec` computes a
  `crossSystem` boolean (layout.js line ~2211) but **nothing reads it**;
  `renderSpan` (svg.js line ~823) always draws a single `M x1 y1 Q cx cy x2 y2`
  filed under the *start* system. For a cross-system span, `x2`/`y2` are the *end*
  system's local coordinates drawn into the start system's frame — a wrong stroke
  to a foreign coordinate (the path string is still valid numbers, so it does not
  throw, but it is visually garbage). There are zero tests for a cross-system
  tie/slur. So a cross-system span today fails AC9's "within-system portion is
  drawn" clause; "never throws" alone is insufficient, and the design must specify
  the clip explicitly.
- **Traces to:** Requirement 9, 19; AC4, AC9, AC10. Continuous across barlines
  within one system is free from system-level span coordinates (Req 9/AC4); the
  cross-system minimum is met by the explicit clip (Req 19/AC9); the degenerate-safe
  clamp feeds Req 18/AC10.

### Decision (with documented alternative): Make the clip generic across tie / slur / hairpin

This is an explicit, owner-overridable judgment call, surfaced here rather than
buried as a hidden choice.

- **Recommended choice:** Implement the cross-system clip once, generically, guarded
  by `crossSystem`, so it applies to tie, slur, and hairpin alike. For within-system
  spans (`crossSystem === false` — the only case any test or example exercises, and
  the only case that renders correctly today) the clip is a strict **no-op**, so
  within-system tie/slur output is provably unchanged. The only changed behavior is
  the cross-system tie/slur, which goes from a garbage stroke (a latent bug with
  zero tests) to a clipped within-system portion — an improvement. New cross-system
  tests are added for **both** hairpins and ties/slurs to lock the fixed behavior.
- **Documented conservative alternative (hairpin-scoped):** Scope the clip to only
  the new crescendo/decrescendo kinds, leaving the existing cross-system tie/slur
  bug in place untouched. This reads AC8 ("existing markings render unchanged")
  maximally — touch nothing about tie/slur, even the broken cross-system path. The
  cost is duplicated clip logic and a known-bad tie/slur cross-system rendering left
  as-is.
- **Trade-offs:** The recommended generic clip is one code path, provably a no-op
  for every within-system case anyone relies on, and it fixes a latent bug that the
  spec's own OQ-3 directs Design to *fix* rather than preserve. The conservative
  alternative trades a small amount of cleanliness and a bug fix for an absolutely
  literal reading of AC8. **The plan/owner may down-scope to hairpin-only** if
  maximum AC8 conservatism is preferred; the recommendation is the generic fix.
- **Traces to:** Requirement 11, 19; AC8, AC9. AC8 (existing markings unchanged) is
  satisfied either way for within-system spans (the clip is a no-op there); the
  decision only affects the previously-broken cross-system tie/slur path.

### Decision: Constant aperture — degenerate-safe by construction

- **Choice:** The wedge aperture is a fixed constant (`HAIRPIN_APERTURE`), never
  derived from the span width.
- **Alternatives:** Compute the aperture or line slope as a function of span width
  (e.g. a slope `aperture / (x2 − x1)`).
- **Trade-offs:** A width-derived slope would divide by `(x2 − x1)`, which is zero
  or near-zero for a degenerate near-zero-width two-note span — a NaN/Infinity risk.
  A constant aperture means a near-zero-width span simply draws two nearly
  coincident lines (finite, no division), never throwing. The trade-off is none of
  consequence: a constant aperture is also the standard engraving look.
- **Traces to:** Requirement 18; AC10. The near-zero-width two-note span must not
  throw; output shape is unspecified beyond that.

## Dependencies

- **Internal:** the existing span pipeline in `src/notation/layout.js`
  (`matchSpans`, `recordSpanMarkers`, `resolveAllSpans`, the post-resolution span
  bucketing loop) and `src/notation/svg.js` (`renderSystem`'s span loop, the
  `line()` helper, the `data-span`/`data-hand` stamping convention). The new feature
  reuses the validator (`src/song/validate.js`) and the staff-space coordinate model
  (`staffStepToY`, `staffBottomY`, the system `<g>`'s `translate · scale` transform)
  unchanged.
- **New constants:** `HAIRPIN_APERTURE` and `HAIRPIN_LANE_DY` in
  `src/notation/constants.js`.
- **External libraries / services:** none. No new npm dependency, no service, no
  schema versioning (the format grows additively with no `version` field).

## Failure Modes and Observability

The renderer is a pure data→SVG transform with no runtime I/O, so "observability"
means the rendered SVG and the validator's structured error list. Every failure
mode below resolves to a defined, non-throwing outcome:

- **Dangling start, dangling stop, double start** (Req 12/AC6): the existing
  `matchSpans` stack drops the unmatched or earlier marker; the unmatched marker is
  simply not drawn. No throw, no corruption. Zero new logic — the new kinds reuse
  `matchSpans` verbatim.
- **Endpoint on a rest / unplaceable note** (Req 13/AC6): `recordSpanMarkers`
  records `anchor: null` for such an event but still pushes the stream entry (so
  matching never desyncs); the shared guard `if (!start.anchor || !stop.anchor)
  continue;` (layout.js line ~2161) skips the pair before any builder runs. The
  hairpin builder is dispatched at that same call site, *after* the guard, so it is
  already protected — no duplicate guard. The span is best-effort not drawn.
- **Overlapping/nesting same-kind spans in one hand** (Req 14/AC6): the
  single-pending-start stack drops the earlier start; at most one span of a kind is
  open per hand. No crash; output is unspecified-but-safe.
- **Near-zero-width two-note span** (Req 18/AC10): the constant aperture means no
  width division; the wedge draws two nearly coincident finite lines.
- **Cross-system span** (Req 19/AC9): the degenerate-safe clip yields a clamped
  start-system portion (down to zero width at the edge), never a foreign-frame or
  backwards stroke.
- **Single-note one-directional span** (Req 17, out of scope): **inexpressible by
  construction.** One event's `crescendo` field holds exactly one value
  (`"start"` XOR `"stop"`), so a span cannot both start and stop on the same note —
  there is no second value slot. Nothing to handle.
- **Validation errors** are surfaced through the existing `validateSong` structured
  error list (e.g. an out-of-set value produces a message of the shape
  `crescendo: ... not one of the allowed values ["start", "stop"]`). Misspelled
  field names and dangling markers produce no error (by design).

There is no new logging surface; the SVG `data-span`/`data-hand` attributes are the
inspection hooks (and the test selectors).

## Risks and Open Questions

All four spec open questions are resolved (OQ-1 → hairpin-only; OQ-2 → two enum
fields; OQ-3 → layout-layer clip, start-portion only; OQ-4 → per-hand below-staff).
Remaining items for the implementation plan / owner:

- **Generic-vs-hairpin-scoped clip (owner judgment call).** The recommended generic
  clip fixes the latent cross-system tie/slur bug and is provably a within-system
  no-op; the documented conservative alternative scopes the clip to hairpins only.
  The plan may down-scope if maximum AC8 conservatism is preferred. (See the
  decision above.)
- **Build-phase tuning constants.** The exact `HAIRPIN_APERTURE`, `HAIRPIN_LANE_DY`,
  and the dynamic-collision dodge (horizontal inset vs. the simpler vertical-drop
  fallback) are tuning values, not pinned by this design. Constraints that *are*
  pinned: aperture is a constant (never width-derived), the lane is per-hand below
  the staff in the dynamic band, and the hinge requires shared `yCenter` (per hand)
  and shared `aperture` so the messa-di-voce `< >` is gap/overlap-free by
  construction.
- **Full cross-system split is deferred.** v1 drops the continuation; the full split
  (continuation open-mouth + middle pass-through pieces for 3+ system spans) is the
  noted future refinement and is not asserted by any AC.
- **Co-occurrence corner (best-effort, not a correctness concern).** A below-staff
  ottava (`8vb`/`15mb`, at dy +2) and a hairpin (center dy ~+3) in the same hand at
  the same X would sit close. Rare combination; best-effort legible.

## Per-File Testing Approach

Tests mirror the existing tie/slur coverage across the three layers, plus the
high-value *new* surface: cross-system clamp tests (for hairpins **and** for
tie/slur, which have none today).

### Validation — `src/song/__tests__/validate.test.js` (AC1, AC5; mirror tie/slur)

- **AC1:** a song with a `crescendo` span over ≥2 notes **and** a separate
  `decrescendo` span → `validateSong(json)` returns `[]`.
- **AC5 (bad value):** `crescendo: "increase"` → an error matching
  `/crescendo: .*not one of the allowed values \["start", "stop"\]/` (generic enum
  check).
- **AC5 (misspelled field):** `{ cresecndo: "start" }` → `[]` (silently ignored).
- **Req 20 (dangling):** a lone `crescendo: "start"` with no stop → `[]`.
- **`schema.test.js`** (if it asserts schema shape): confirm
  `$defs.event.properties.crescendo` and `.decrescendo` are `{ enum: ["start","stop"] }`.

### Layout / matching — `src/notation/__tests__/layout.test.js` (build via `buildLayoutModel`)

- **AC3 (distinct shape):** read the resolved wedge record's geometry. Crescendo →
  the two lines share Y at `x1` (vertex, `|Δy@x1| ≈ 0`) and diverge to ±aperture/2
  at `x2` (`|Δy@x2| ≈ aperture`); decrescendo → the mirror (apart at `x1`, converge
  at `x2`). This is the robust opening-vs-closing discriminator.
- **AC4 (cross-barline, one system):** a crescendo m1→m2 at a wide width → in that
  system's `spans`, `crossSystem === false`, and `x2` is past the m1 right barline
  X (visibly crosses the bar).
- **AC6/AC10 (edges, no-throw + resolved count):** dangling start only → 0 spans;
  stop on a rest → 0 spans; overlapping same-kind → exactly 1 span; near-zero-width
  two-note → 1 span with `x1 ≈ x2` and finite coords. Each wrapped in
  `expect(() => buildLayoutModel(song, w)).not.toThrow()`.
- **AC9 (cross-system, the new behavior):** a crescendo m1→m4 at a narrow width
  (multiple systems) → (i) no throw, (ii) span filed under the start system only,
  (iii) `x2 === systems[startIdx].staffEndX` (the clamp — distinguishing the fix
  from today's garbage `x2`), (iv) no span leaks into other systems' arrays with
  foreign coords.
- **AC7 (dynamic independence):** start note `dynamic: "p"`, end note `dynamic: "f"`
  → the wedge span and both dynamic texts present and independent (dynamics in the
  measure's hand texts, wedge in `system.spans`). Cover all four cases (start only /
  end only / both / neither) → span present in all four.
- **Messa-di-voce hinge:** a note with `crescendo: "stop"` + `decrescendo: "start"`
  → one crescendo span ending at the hinge X and one decrescendo span starting at
  the **same** X; assert `cresc.x2 === decresc.x1` and equal `yCenter`/`aperture`.
- **★ New cross-system tie/slur clamp tests (locks in the generic-clip decision):**
  a tie and a slur each m1→m4 at narrow width now (a) do not throw and (b) clamp
  `x2` to the start system's `staffEndX`. Zero such tests exist today; these cover
  a previously-untested path and lock the latent-bug fix against regression. (If the
  plan down-scopes to a hairpin-only clip, these become "no-throw only" assertions
  for tie/slur.)

### Emit — `src/notation/__tests__/svg.test.js` (AC3 DOM form, AC8)

- **AC3 (DOM):** `svg.querySelector('[data-span="crescendo"]')` and
  `[data-span="decrescendo"]` each exist and each contain exactly two `<line>`
  children; read their `x1/y1/x2/y2` and assert the opening-vs-closing divergence
  above. Assert `data-hand` is stamped.
- **AC8 (no regression):** extend the existing
  `it("renders ties/slurs as <path> spans")` (svg.test.js ~231) — assert
  `path[data-span="tie"]` still exists as a `<path>` (Bézier), confirming the
  hairpin work did not convert tie/slur to lines. Optionally a song combining a tie
  + slur + ottava + point dynamics + hairpin → assert all selectors coexist.

### AC2 (additive growth, no change)

A song with no gradual dynamics produces an identical model — assert "no spans of
the new kinds" (and/or an unchanged snapshot). Covered by the existing-song
validate/render assertions.

### E2E (Playwright, optional, matches existing posture)

One grand-staff song with a crescendo, a decrescendo, and a messa di voce, rendered
in the block, as a visual backstop. Not required for the unit-level ACs.

## Acceptance-Criteria Coverage Map

| AC | How the design satisfies it |
|----|------------------------------|
| AC1 | Two enum fields validate via generic checks; a cresc + a separate decresc song returns `[]`. |
| AC2 | Optional fields, permissive `additionalProperties`; a song without them is byte-identical, no new spans resolved. |
| AC3 | `renderHairpin` draws `<` (vertex left) vs `>` (vertex right); visibly distinct, each from start X to end X. |
| AC4 | Spans draw at system level with absolute system-local X; one continuous wedge across intervening barlines. |
| AC5 | Generic enum check rejects out-of-set values; permissive `additionalProperties` ignores misspelled fields. |
| AC6 | `matchSpans` drops unmatched/earlier markers; the shared anchor guard skips rest endpoints; all non-throwing. |
| AC7 | Wedge and point dynamics are independent records/emitters; horizontal dodge (or vertical-drop fallback) keeps both legible in all four cases. |
| AC8 | Tie/slur keep the unchanged `buildSpanSpec` + `renderSpan` Bézier; hairpins use a separate builder + `renderHairpin`; the cross-system clip is a no-op for within-system spans. |
| AC9 | Layout-layer clip draws the within-system portion to `staffEndX`; the cross-system span is filed under the start system only; explicitly fixes today's garbage stroke. |
| AC10 | Constant aperture (no width division) + degenerate-safe clamp → finite, non-throwing near-zero-width wedge. |
