# Design research: Crescendo and decrescendo (gradual-dynamic span)

> The running design Q&A and decision record for issue #7. Drives toward a
> complete, buildable architecture that satisfies `1-spec/spec.md`. Each topic is
> investigated one at a time (analyst asks, researcher gathers evidence, analyst
> decides on the evidence). OQ-1..OQ-4 from the spec are resolved here.

## Status

- [x] OQ-2 — Data shape / direction encoding → **two fields `crescendo`/`decrescendo`, each `enum:["start","stop"]`** (TOPIC 1)
- [x] OQ-1 — Hairpin-only vs. text form → **hairpin-only for v1; `cresc.`/`dim.` text form deferred** (TOPIC 4)
- [x] OQ-4 — Placement lane → **per-hand, below each hand's own staff (reuses the point-dynamic frame)** (TOPIC 2)
- [x] OQ-3 — Cross-system rendering → **clip in the layout layer to start-system `staffEndX`; v1 draws the start-system portion only (drop continuation); generic across tie/slur/hairpin** (TOPIC 3)
- [x] Matching / resolution architecture (reuse of `matchSpans`) → **add 2 kinds to `resolveAllSpans`; carry markers + lane Y in `recordSpanMarkers`** (TOPIC 4)
- [x] Wedge geometry (the hairpin shape) → **two `<line>`s in a `<g data-span data-hand>`; flat below-staff lane; separate renderer from `renderSpan`** (TOPIC 4)
- [x] Edge cases (single-note, near-zero-width, overlapping, cross-barline, rest endpoint) → **all fall out of the data shape + shared matcher/guard + constant-aperture wedge + clamp** (TOPIC 5)
- [x] Validation / schema changes → **two optional `enum:["start","stop"]` fields on `$defs.event`; zero validator logic** (TOPIC 1)
- [x] Testing approach → **mirror tie/slur tests across validate/layout/svg; the high-value NEW surface is the cross-system clamp tests (hairpins AND tie/slur)** (TOPIC 5)

---

## Codebase orientation (analyst's own verification, pre-Q&A)

Read directly: `src/song/schema.js`, `src/song/validate.js`,
`src/notation/layout.js` (all 2405 lines), `src/notation/svg.js`,
plus the span tests in `src/notation/__tests__/`.

### The existing per-hand span model (ties / slurs) — the template to mirror

The feature must mirror how `tie` and `slur` already work. They are the only
existing markings shaped exactly like the new one (a start→end pair within one
hand). The end-to-end pipeline:

1. **Schema** (`schema.js`, `$defs.event`): `tie: { enum: ["start", "stop"] }`
   and `slur: { enum: ["start", "stop"] }` — each an optional per-event field
   whose value is a closed two-member enum. `additionalProperties` is permissive
   everywhere (unknown keys ignored, additive growth, no `version`).
2. **Validation** (`validate.js`): purely structural/value. The enum is checked
   strictly (a value outside `["start","stop"]` is an error). There is **no**
   pairing/balance check — a dangling start or stop validates fine; pairing is a
   render-time concern. This is exactly Req 20's "validation matches the
   rendering split."
3. **Matching** (`layout.js`):
   - `matchSpans(stream)` (line ~1102): a **stack-based, single-pending-start**
     matcher. A second `start` before a `stop` drops the earlier (dangling)
     start; a `stop` with no pending start is dropped; a leftover pending start
     is dropped. Never throws. Returns `[{ startIndex, stopIndex }]`.
   - `projectMarker(events, kind)` (line ~1132): projects one marker kind off the
     flat event stream onto `{ marker }`. (Note: `resolveAllSpans` currently
     inlines the equivalent projection, `stream.map((e) => ({ marker: e[kind] }))`.)
   - `recordSpanMarkers(...)` (line ~2110): per measure, per hand, pushes one
     entry per event onto a cross-measure `placedEvents[hand]` stream, capturing
     `{ tie, slur, anchor, systemIndex }`. `anchor` is `{ x, y, direction }` in
     **system-local sp**, or `null` when the event is a rest / unplaceable note
     (markers still recorded so matching never desyncs).
   - `resolveAllSpans(placedEvents)` (line ~2149): for each hand, for each
     `kind` in the hard-coded `["tie", "slur"]`, projects, runs `matchSpans`,
     and for each matched pair (when **both** anchors landed — a `null` anchor is
     skipped, never thrown on) calls `buildSpanSpec`.
   - `buildSpanSpec(kind, start, stop, hand)` (line ~2185): builds a quadratic
     Bézier `{ kind, hand, systemIndex, x1, y1, x2, y2, cx, cy, crossSystem }`.
     `systemIndex` is the **start's** system. `crossSystem` =
     `start.systemIndex !== stop.systemIndex`. Spans are bucketed into
     `systems[sp.systemIndex].spans`.
4. **Emit** (`svg.js`, `renderSpan`, line ~823): draws one
   `<path d="M x1 y1 Q cx cy x2 y2">`. Stamped `data-span={kind}`,
   `data-hand`.

### THE VERIFIED CROSS-SYSTEM GAP (confirms the spec's OQ-3 warning)

The spec warned cross-system tie/slur clipping is "unverified and may be
under-implemented." **Verified: it is NOT implemented.**

- `buildSpanSpec` computes a `crossSystem` boolean, **but nothing ever reads
  it.** `renderSpan` ignores it and draws a single `x1→x2` Bézier
  unconditionally.
- A cross-system span is bucketed into the **start** system's `<g>` (translated
  to the start system's Y). Its `x2`/`y2` are **system-local coordinates of the
  END system** (a different `<g>` with a different Y translate). So the path is
  drawn from the correct start point to a meaningless end point in the wrong
  coordinate frame — a visually wrong line, **but it does not throw** (the path
  `d` string is always valid numbers).
- There are **zero tests** for a cross-system tie/slur. The existing span tests
  (`layout.test.js` ~1133–1591, `svg.test.js` ~231) cover single-system pairs,
  dangling/double-start matching, and within-system cross-barline only.

Implication for OQ-3: the new feature cannot "inherit" working cross-system
clipping — there is none. The non-crash MUST-minimum (Req 19/AC9) is already met
by accident (no throw), but "the within-system portion is drawn" is NOT met for
the inherited approach (the path runs to a garbage endpoint). Design must
specify the within-system clip explicitly.

### Point-dynamic placement (relevant to OQ-4)

- `collectEventTexts` (layout.js ~1550) emits a `{ kind: "dynamic", x, text }`
  per event carrying `dynamic`.
- `renderHandText` (svg.js ~845) draws it inside the hand `<g>` (translated to
  that staff's bottom line) at `y: 3.5` sp — i.e. **3.5 sp below the hand's
  staff bottom line**, bold-italic, `text-anchor: middle`. So point dynamics
  already sit **below each hand's own staff**, per-hand. `DYNAMIC_SIZE = 2.8`.

### Other relevant facts

- Coordinate model: all layout math is in staff-space (sp); `staffStepToY`
  maps `sFromBottom` to Y with the staff bottom line at Y=0 in the hand frame,
  Y growing downward. The emit layer applies `SP_PX = 8` via the root viewBox.
- A system `<g>` is `translate(0 system.y) scale(downscaleFactor)`. Spans are
  appended at system level (NOT inside a measure `<g>`), so span coordinates are
  system-local (already absolute within the system), matching `recordSpanMarkers`
  anchors (`measureX + note.x`).
- `TIE_NOTE_CLEARANCE = 0.9`, `SYSTEM_BOTTOM_MARGIN = 5`, `ABOVE_STAFF_PAD = 1`,
  `TEXT_LANE_GAP = 0.6`.

---

## Design Q&A (one topic at a time)

### TOPIC 1 → OQ-2: Data shape & direction encoding

**Decision: Shape (A) — two independent optional per-event fields,
`crescendo: "start"|"stop"` and `decrescendo: "start"|"stop"`,** byte-for-byte
symmetric with the existing `tie`/`slur` fields on `$defs.event`.

A messa-di-voce hinge note carries BOTH fields at once:
`{ ..., crescendo: "stop", decrescendo: "start" }`. Because they are two
distinct keys, one event can hold both with zero ambiguity.

**Why (and why not the alternatives):**

- **The hinge is the deciding constraint.** The codebase matcher
  (`matchSpans`, layout.js:1102) is a single-pending-start-per-kind stack with
  no "number"/level disambiguator. A single direction-bearing field — shape (B)
  `hairpin:"start"|"stop"` + `hairpinType`, or shape (C) combined enum
  `"crescendo-start"|"decrescendo-start"|"stop"` — **cannot** express "this one
  note is both the stop of the crescendo and the start of the decrescendo,"
  exactly as a single `tie` field couldn't be both. Two independent fields can.
  So (A) is the only candidate that makes Req 16 (messa di voce as two adjacent
  spans sharing a hinge) perfectly expressible.
- **Exact reuse, no new code paths.** Researcher verified (running the REAL
  functions):
  - `matchSpans` holds no state across calls (local `pendingStart`, returns its
    own `pairs`), so two new kinds get two fully independent stacks. Proven with
    a 5-note hinge stream: `crescendo` → `[{0,2}]`, `decrescendo` → `[{2,4}]`,
    and order-independent (running decresc-first gives identical results).
  - `resolveAllSpans` (layout.js:2149) change is literally adding
    `"crescendo","decrescendo"` to its hard-coded `["tie","slur"]` kind list;
    each projected `stream.map(e => ({ marker: e[kind] }))` the same way.
  - One trivial edit in `recordSpanMarkers` (layout.js:2128): carry the two new
    markers on the stream entry (`crescendo: event?.crescendo, decrescendo:
    event?.decrescendo`), exactly as it already carries `tie`/`slur`. The
    anchor (x/y/direction) recording is kind-agnostic and reused as-is.
- **Validation: zero new logic.** Researcher ran the REAL `validateSong` with
  the two fields added to `$defs.event` as `{ enum: ["start","stop"] }`:
  - valid cresc+decresc+hinge song → `[]`;
  - `crescendo:"increase"` → strict enum error from the generic check
    (validate.js:120-128), no special-case;
  - misspelled `cresecndo:"start"` → `[]` (silently ignored — permissive
    `additionalProperties`, validate.js:191-198);
  - dangling `crescendo:"start"` → `[]` (pairing is render-time, never
    validated). This satisfies Req 3 (additive growth, strict closed-set) and
    Req 20 (validation matches the rendering split) with no validator edits.
- **Convention check (MusicXML `<wedge>`):** direction IS intrinsic
  author-data on the start token there (`type="crescendo"` /
  `type="diminuendo"`, plain `type="stop"` at the end — no separate direction
  attribute), which confirms Req 2's "direction is author-supplied, not
  inferred." MusicXML can host the hinge in a single field only because it adds
  a `number` attribute to disambiguate overlapping wedges and encodes messa di
  voce as two separate wedge elements. This codebase has no such number, so two
  independent fields (A) is the faithful adaptation of the same semantics to the
  simpler stack model. Convention thus supports (A) and argues against a
  single field without a number. (Sources: w3.org MusicXML 4.0 `<wedge>`;
  musicxml-wedge-type reference.)

**Resulting schema change (the full data-model delta):** add to
`schema.js` `$defs.event.properties`, alongside `tie`/`slur`:
```js
crescendo: { enum: ["start", "stop"] },
decrescendo: { enum: ["start", "stop"] },
```
Nothing else in schema/validator changes.

**Recorded wrinkle (carried to the wedge-geometry topic, not a data issue):** at
a hinge both hairpins default to the same below-staff lane/Y, so the crescendo's
closing tip and the decrescendo's opening tip meet at the hinge note's X. That
is the correct `< >` look, but the two are separate primitives, so the geometry
design should make them share the exact hinge X to avoid a sub-sp gap/overlap
artifact.

---

### TOPIC 2 → OQ-4: Placement lane

**Decision: per-hand, BELOW each hand's own staff** — the spec's accepted
simplification (Req 10, 15). The wedge lives in the SAME per-hand frame the
point dynamic already uses (the hand `<g>` translated to that staff's bottom
line), so no new band lane is introduced.

**Lane geometry (researcher's measured band, one wide system, sp, system-local):**

- RH staff bottom Y = 9.0; LH staff bottom Y = 21.0.
- Below the RH staff: 8.0 sp of room before the LH staff top (`INTRA_STAFF_GAP`)
  — generous.
- Below the LH staff: 5.0 sp before the system bottom (`SYSTEM_BOTTOM_MARGIN`),
  and that 5.0 also holds low LH ledgers (`ledgerBottomExtent` grows the bottom
  margin). This is the tight lane — keep the LH aperture modest.
- Existing below-staff occupants in a hand frame (dy = distance below that
  staff's bottom line): below-placement ottava (negative `octaveShift`,
  `8vb`/`15mb`) at **dy +2** (`staffBottomY + 2`, `buildSystemTexts`,
  layout.js:2376), point dynamic at **dy +3.5** (size `DYNAMIC_SIZE = 2.8`,
  alphabetic baseline → ink roughly dy [+1.5, +4.1]). Nothing else is below the
  staff (chord symbols, above-ottava, tempo are all above; barlines/brace are
  within the staves).

**Wedge vertical placement: shared dynamic lane.** Per standard engraving and
editor convention (Gould *Behind Bars*; Soundslice; MuseScore handbook), a
hairpin and its bracketing dynamic occupy the **same** vertical lane — the
hairpin is vertically centered on the dynamic text and the two sit side-by-side
on one line, not stacked. So:

- **Wedge vertical center ≈ dy +3.0** (the middle of the point-dynamic band),
  **aperture ≈ 1.0 sp** (open mouth ~1.0 sp tall, the Gould figure;
  half-aperture ±0.5 sp around the center line). Wedge ink then spans dy ≈
  [+2.5, +3.5] — clear of the staff lines above (staff bottom at dy 0), inside
  the roomy RH lane, and inside the tight LH lane (abs ~23.5–24.5 vs. system
  bottom 26.0).

**Collision with a bracketing point dynamic (Req 4 / AC7) is resolved
HORIZONTALLY, not by a separate vertical sub-lane:** when a wedge's start note
also carries a point dynamic, inset the wedge's start X a little to the RIGHT of
that note's center (past the dynamic glyph); likewise inset the end X to the
LEFT when the end note carries one. This is the conventional "from p ——< to f"
look and keeps both marks legible. **Acceptable simpler fallback (build phase's
choice):** if the horizontal dynamic-dodge is deferred, drop the wedge center
~0.5–1 sp below the dynamic baseline (center dy ≈ +4.5) so it clears the
dynamic ink vertically — slightly non-standard but legible and trivial; still
satisfies AC7 (both render independently — AC7 requires both present and
uncorrupted, not zero pixel overlap). The design does not pin the exact
constants (aperture, center dy, dodge inset) — those are build-phase tuning —
but fixes the lane: per-hand, below the staff, centered in the dynamic band,
aperture ~1 sp.

**Co-occurrence note (rare corner):** a below-ottava (dy +2) and a hairpin
(center dy +3) in the SAME hand at the same X would be close. This is a rare
combination (negative octave shift + a hairpin endpoint at the identical X in
one hand) and is best-effort legible; not a correctness concern.

**Why not between-staves:** it is both net-new band geometry (a lane between
RH-bottom 9.0 and LH-top 17.0 where nothing lives today) AND a model mismatch
with the per-hand data shape chosen in TOPIC 1 — a between-staves lane is a
single shared lane keyed to the grand staff, which would reintroduce cross-hand
coordination (what if both hands have a hairpin at the same X?) that the
per-hand model and Req 15 deliberately avoid. Between-staves remains the noted
future refinement.

---

### TOPIC 3 → OQ-3: Cross-system (wrapped) rendering

**Context — the verified gap (both of us confirmed):** there is NO cross-system
clip in the codebase. `buildSpanSpec` computes `crossSystem` (layout.js:2211)
but nothing reads it; `renderSpan` (svg.js:824) draws one
`M x1 y1 Q cx cy x2 y2` filed under the START system. For a cross-system span,
`x1` is in the start system's frame and `x2` is the stop note's X in the END
system's frame — so the path is a wrong stroke to a foreign coordinate.
Researcher reproduced: a tie m1→m4 at width 30 (4 systems) resolved to x1=10.3
(sys0 frame), x2=18.2 (sys3 frame), both drawn into sys0.

**Decisive subtlety:** today's behavior FAILS AC9's "the within-system portion
of the span is drawn" clause — a wrong stroke to a foreign X is not "the
within-system portion." So satisfying AC9 requires at least a minimal clip;
"never throws" alone is insufficient. This is the design's must-do.

**Decision (three parts):**

**(a) Clip in the LAYOUT layer.** svg.js is explicitly geometry-free ("every
X/Y … computed by the layout layer," svg.js:1-14), so the emit layer must not
learn a system's right edge. `resolveAllSpans` runs at layout.js:1882 AFTER the
whole `systems[]` array is built and pushed, and the post-resolution loop
(1883-1888) already indexes `systems[sp.systemIndex]` — so the start system's
geometry is reachable there. The clip X is the start system's
**`staffEndX = budgetSp - STAFF_MARGIN_X`** (set at layout.js:1867) — the drawn
right end of the staff lines, in the SAME pre-scale, system-local frame as the
span's `x1` and the start band's Ys (the system `<g>`'s
`translate · scale(downscaleFactor)` applies uniformly to staff lines,
measures, and spans alike). `y2` at the clip stays in the start band's frame
(the same frame `x1`/`y1` use) — no foreign-frame mixing.

**(b) v1 draws the START-system portion only; drop the continuation** (the
spec's MUST-minimum, Req 19/AC9). The start-system piece runs from the start
note's X to the start system's `staffEndX`, at the aperture the wedge has
reached by that X:
- Crescendo `<`: vertex at the real start (left), lines diverge rightward and
  simply STOP mid-open at `staffEndX` (open right end) — reads as "continues."
- Decrescendo `>`: open mouth at the real start (left), lines converge rightward
  but are cut off BEFORE meeting the vertex (narrowed-but-open right end) —
  also reads as "continues."
Because a hairpin is two straight lines (not a Bézier), the clip is trivial:
use `staffEndX` as the right X and either interpolate the aperture at the edge
or (even simpler for v1) draw the visible portion at full aperture — a slightly
fuller wedge is still legible and never wrong-framed.

**Why not the full split now:** it is NOT marginally free. Full split requires
(i) one matched pair to emit TWO span records, into
`systems[start].spans` AND `systems[stop].spans`; (ii) the END piece to run from
that system's content-left edge (`systems[stopIdx].measures[0].x`, reachable but
new) with a reversed (left) open-mouth clip; (iii) per-piece aperture continuity
so the wedge looks continuous across the break; and critically (iv) MIDDLE
pass-through pieces for a span crossing 3+ systems (the m1→m4 width-30 case
crosses FOUR systems — systems 1 and 2 would each need a full-width pass-through
piece the two-piece split doesn't cover). Full split (incl. middle
pass-throughs + continuation open-mouth) is the noted future refinement
(SHOULD/MAY).

**(c) Make the clip GENERIC across tie / slur / hairpin** (it is the same
geometry path), guarded by `crossSystem`. Rationale and the explicit judgment
call:
- For WITHIN-system spans (`crossSystem === false` — the only case any test or
  example exercises, and the only case that renders correctly today) the clip
  is a strict **no-op**, so within-system tie/slur output is provably
  unchanged — satisfying AC8's "render unchanged" for every case anyone relies
  on.
- The only changed behavior is the cross-system tie/slur, which goes from a
  garbage stroke (a latent bug; ZERO tests assert it) to a clipped
  within-system portion — an improvement. The spec's own OQ-3 directs Design to
  FIX cross-system handling rather than assume it works, so preserving the
  garbage would be perverse.
- **Judgment call flagged for the owner/plan:** a maximally-conservative reading
  of AC8 ("render unchanged" = touch nothing about existing markings) could
  scope the clip to ONLY the new hairpin kinds, leaving the tie/slur
  cross-system bug in place and duplicating the clip logic. This design
  recommends the generic fix (one code path, fixes the bug, provably a no-op for
  within-system), with new cross-system tests added for BOTH hairpins and
  ties/slurs to lock the fixed behavior. The plan phase may down-scope to
  hairpin-only if the owner insists on maximum conservatism.

**(d) Degenerate-safe clip math (ties to Req 18/AC10).** The clip must be
NaN/negative-safe: `rightX = max(startX, min(rightX, staffEndX))`, so a start
note sitting at or past `staffEndX` yields a zero-width wedge, never a backwards
one. Cheap to guarantee; the build phase must clamp it. This is the same
degenerate-width tolerance as the near-zero-width two-note span (handled in the
edge-cases topic).

---

### TOPIC 4 → OQ-1 scope + the wedge geometry + matching architecture

#### OQ-1: **hairpin-only for v1; the `cresc.`/`dim.` text form is deferred.**

The hairpin wedge is required (Req 7) and is correct notation for a span of any
length, so hairpin-only fully satisfies the goal; the text form is an optional
SHOULD/MAY (Req 8) and is additive scope, NOT a substitute (drawing text instead
of a hairpin would fail Req 7). Researcher checked the codebase angle: a
reusable dashed-line + italic-label primitive DOES exist (`renderOttava`,
svg.js:934-958, `stroke-dasharray "0.6 0.4"`), so a future text form would be
marginally CHEAPER to draw than the wedge — but that only argues the text form
is low-cost to add later, not that it should replace the required hairpin in v1.
The wedge is itself cheap (two `line()` calls). Decision stands: hairpin-only,
text deferred.

#### Matching / resolution architecture (mirrors tie/slur, two small edits)

- **`resolveAllSpans` (layout.js:2149):** add `"crescendo"` and `"decrescendo"`
  to the hard-coded kind list. Each is projected `stream.map(e => ({ marker:
  e[kind] }))` and run through the SAME `matchSpans` — two new independent
  per-hand stacks, no shared state (proven in TOPIC 1).
- **`recordSpanMarkers` (layout.js:2110):** two additions — (1) carry the two
  new markers on the stream entry (`crescendo: event?.crescendo, decrescendo:
  event?.decrescendo`), exactly as it carries `tie`/`slur`; (2) **carry the
  below-staff lane Y** (see the critical data-flow finding below).
- **Dispatch by kind** when building span specs: tie/slur build the existing
  Bézier via `buildSpanSpec` (UNCHANGED — Req 11/AC8); crescendo/decrescendo
  build a new hairpin record.

#### Wedge geometry (within-system)

**Primitive:** two straight lines sharing a vertex.
- Crescendo `<`: vertex at start X (left); lines fan to ±aperture/2 at end X.
  Drawn as `line(x1, yCenter, x2, yCenter − aperture/2)` and
  `line(x1, yCenter, x2, yCenter + aperture/2)`.
- Decrescendo `>`: lines at ±aperture/2 at start X (left); converge to a vertex
  at end X. Drawn as `line(x1, yCenter − aperture/2, x2, yCenter)` and
  `line(x1, yCenter + aperture/2, x2, yCenter)`.

**Plain-data record the layout layer emits (mirrors `buildSpanSpec`'s style):**
```js
{ kind: "crescendo"|"decrescendo", hand, systemIndex, x1, x2, yCenter, aperture, crossSystem }
```

**Emit form: two `<line>`s wrapped in a `<g data-span={kind} data-hand={hand}>`**
(so a test can select the hairpin as one unit, matching how `renderSpan` stamps
`data-span`/`data-hand`). NOT a single `<polyline>`/`<path>` — a wedge's two
lines share only the vertex, so a single connected primitive would either draw a
spurious third line between the two free ends or need a `M` (two subpaths = same
as two lines). The wedge is a **separate renderer** (`renderHairpin`) dispatched
by kind in `renderSystem`'s span loop (svg.js:311-313); `renderSpan` stays the
tie/slur Bézier, byte-identical (Req 11/AC8). svg.js already has the `line()`
helper (svg.js:104) used for staff lines.

**★ CRITICAL DATA-FLOW FINDING — the below-staff lane Y is NOT recoverable from
the current recorded marker; `recordSpanMarkers` MUST be extended to carry it.**
- `recordSpanMarkers` stores only `anchor = { x, y, direction }` (layout.js:
  2122-2126), where `y = staffBottomY + staffStepToY(anchorStep) = staffBottomY
  − anchorStep*0.5` — i.e. the **notehead Y**. Neither `staffBottomY` nor
  `anchorStep` is stored, so the lane Y (`staffBottomY + ~3`) cannot be
  recovered from `anchor.y` alone.
- `staffBottomY` is **per-hand, not constant** (verified: RH 9, LH 21 →
  RH lane ~12, LH lane ~24), so the wedge's `yCenter` differs by hand and must
  be carried.
- Researcher proved the gap: a real RH tie's span `y1=y2=5.60` (notehead Y),
  while the desired wedge `yCenter` (dy+3 lane) = 12.00 — a different value
  stored nowhere.
- **Fix (trivial — `staffBottomY` is already a param of `recordSpanMarkers`):**
  also push `staffBottomY` (or a precomputed `laneY = staffBottomY +
  HAIRPIN_LANE_DY`) onto the `placedEvents[hand]` stream entry. The hairpin
  builder then sets `yCenter` from that carried lane Y.

**What the wedge reuses vs. diverges from ties/slurs:**
- Reuses `anchor.x` AS-IS for `x1`/`x2` (`anchor.x = measureX + note.x`, the
  note center).
- DIVERGES on Y: uses the **flat below-staff lane Y** (constant across the
  whole span — a wedge is a horizontal lane element, it does NOT track note
  pitches), not the notehead `anchor.y` ties/slurs use.
- IGNORES `anchor.direction` (stem side) — irrelevant to a fixed below-staff
  lane (another reason the hairpin builder is separate from `buildSpanSpec`,
  which uses direction to pick the arc side).
- `aperture` is a shared constant (~1.0 sp from TOPIC 2).

**Cross-barline continuity (Req 9/AC4) — free.** `x1`/`x2` are absolute
system-local X and spans draw at the SYSTEM level (after the measures loop,
svg.js:311-313), not inside any measure `<g>`. Researcher verified a within-
system tie m1 (x1=10.30) → m2 (x2=42.33) is one continuous span across the
barline at 31.10. Same mechanism for a wedge; the only requirement is keeping
`yCenter` flat across the span (which the carried lane Y gives).

**Messa-di-voce hinge — two independent records, pixel-exact, no combined
primitive.** At the hinge note, the crescendo's `x2` = the decrescendo's `x1`
= the same note's `anchor.x` (one note → one anchor → one X). Drawing the
crescendo (mouth fanning to ±aperture/2 at the hinge X) then the decrescendo
(mouth ±aperture/2 at the hinge X) yields the standard `< >` (grow-then-shrink,
peak in the middle) with both mouths meeting at the hinge. They align EXACTLY
because same hand ⇒ same `yCenter` (same `staffBottomY`) and the `aperture` is a
shared constant — so the crescendo's right-mouth points coincide with the
decrescendo's left-mouth points at the hinge X. **Requirement for the build
phase:** pin both `yCenter` (per hand) and `aperture` to SHARED constants, never
per-span values, so the hinge is gap/overlap-free by construction.

---

### TOPIC 5 → Edge-case outcomes + testing approach

**All seven edge cases map to a defined, testable, non-crashing outcome and fall
out of decisions already made — none needed flagging.** Researcher proved each
against the real code/matcher.

1. **Dangling start / dangling stop / double start (Req 12, AC6):** handled
   entirely by the EXISTING `matchSpans` (drops the unmatched/earlier marker,
   never throws). ZERO new logic — the new kinds reuse `matchSpans` verbatim via
   the kind list. The unmatched marker is simply not drawn.
2. **Endpoint on a rest / unplaceable note (Req 13, AC6):** covered by the
   SHARED guard `if (!start.anchor || !stop.anchor) continue;` (layout.js:2161),
   which sits in `resolveAllSpans` AFTER `matchSpans` and BEFORE `buildSpanSpec`
   is called (line 2164). **Build-phase placement rule:** dispatch the hairpin
   builder at that SAME call site (after the guard, by kind), so the guard
   already protects it — no duplicate guard. `recordSpanMarkers` records
   `anchor: null` for a rest/unplaceable note but STILL pushes the stream entry
   with the marker (the `if (note)` at layout.js:2119), so matching never
   desyncs. Proven: a `tie:"stop"` on a rest → 0 spans resolved, no throw; the
   new kinds inherit this identically.
3. **Overlapping same-kind in one hand (Req 14, AC6):** the single-pending-start
   stack drops the earlier (dangling) start. Proven: `[start, start, stop, stop]`
   → `[{1,2}]`. No crash; output unspecified-but-safe. No new logic.
4. **Near-zero-width two-note span (Req 18, AC10):** the wedge with `x1 ≈ x2`
   draws two nearly-coincident lines, never throws. **No division-by-width risk
   because the aperture is a CONSTANT, never a slope `A/(x2−x1)`.** Verified at
   x1=10.0, x2=10.0001 → all finite, no NaN. The Topic-3 clamp also protects the
   cross-system-near-edge variant. **Build-phase constraint: the aperture is a
   fixed constant, not width-derived.**
5. **Single-note same-kind span (Req 17, out of scope) — INEXPRESSIBLE by
   construction (a nice property of shape A):** one event's `crescendo` field
   holds ONE value (`"start"` XOR `"stop"`), so you cannot author a crescendo
   that both starts and stops on the same note — there is no second value slot.
   The degenerate single-note case the spec excludes simply cannot exist in the
   data; nothing to handle, nothing to test beyond noting it. (Contrast: a
   TWO-note near-zero-width span IS expressible — start on note A, stop on note
   B that happens to land at near-identical X — which is exactly why Req 18 is
   in-scope-must-not-crash while Req 17 is out-of-scope-unexpressible. The data
   shape draws that line automatically.)
6. **Cross-system (Req 19, AC9):** decided in TOPIC 3; composes safely with the
   degenerate case. A span that is BOTH cross-system AND starts near the edge →
   `rightX = max(startX, min(staffEndX, startX)) = startX` (zero-width at the
   edge), not a backwards/negative-width shape. The two safety mechanisms (clip
   clamp + constant aperture) stack without interaction.
7. **No regression (Req 11/AC8):** three independent facts — (a) tie/slur keep
   the UNCHANGED `buildSpanSpec` + `renderSpan` Bézier path; (b) the new kinds
   use a separate builder + `renderHairpin`, touching nothing tie/slur read;
   (c) the cross-system clip is a guarded no-op for within-system spans. The
   `recordSpanMarkers` edit (carrying `staffBottomY`/laneY) is purely ADDITIVE —
   tie/slur resolution reads `anchor` + `marker`, not the new field, so no
   existing read path changes.

**Testing approach (by file, concrete assertions):**

*Validation — `src/song/__tests__/validate.test.js` (AC1, AC5; mirror tie/slur):*
- AC1: a song with a `crescendo` span over ≥2 notes AND a separate `decrescendo`
  span → `validateSong(json)` returns `[]`.
- AC5 bad value: `crescendo:"increase"` → an error matching
  `/crescendo: .*not one of the allowed values \["start", "stop"\]/` (generic
  enum check; message shape verified against the real validator).
- AC5 misspelled: `{ cresecndo: "start" }` → `[]` (silently ignored).
- Req 20 dangling: a lone `crescendo:"start"` (no stop) → `[]`.
- `schema.test.js` (if it asserts schema shape): confirm
  `$defs.event.properties.crescendo`/`.decrescendo` are `{ enum:["start","stop"] }`.

*Layout / matching — `src/notation/__tests__/layout.test.js` (build via
`buildLayoutModel`, assert resolved span records):*
- **AC3 distinct shape (how to assert opening vs closing):** read the wedge's
  two line endpoints. CRESCENDO → the two lines share the same Y at `x1` (the
  vertex, |Δy@x1| ≈ 0) and DIVERGE to ±aperture/2 at `x2` (|Δy@x2| ≈ aperture);
  DECRESCENDO → the MIRROR (apart at `x1`, converge to |Δy@x2| ≈ 0). This is the
  robust discriminating assertion.
- **AC4 cross-barline within one system:** a crescendo m1→m2 at a WIDE width
  (one system) → in that system's `spans`, `crossSystem=false`, and `x2` > the
  m1 right barline X (visibly crosses the bar). (Analogous tie verified:
  x1=10.30 → x2=42.33 past the bar at 31.10.)
- **AC6/AC10 edges (no-throw + resolved count):** dangling start only → 0 spans;
  stop on a rest → 0 spans; overlapping same-kind → exactly 1 span;
  near-zero-width two-note → 1 span with `x1 ≈ x2` and finite coords. Each
  wrapped in `expect(() => buildLayoutModel(song, w)).not.toThrow()`.
- **AC9 cross-system (the new behavior):** a crescendo m1→m4 at a NARROW width
  (multiple systems) → (i) no throw, (ii) span filed under the START system
  only, (iii) `x2 === systems[startIdx].staffEndX` (the clamp — this is what
  distinguishes the fix from today's garbage x2), (iv) no span leaks into other
  systems' arrays with foreign coords.
- **AC7 dynamic independence:** start note `dynamic:"p"`, end note `dynamic:"f"`
  → the wedge span AND both dynamic texts present and independent (dynamics in
  `measure.right.texts`, wedge in `system.spans`). Cover all four cases (start
  only / end only / both / neither) → span present in all four.
- **Messa-di-voce hinge:** a note with `crescendo:"stop"` + `decrescendo:"start"`
  → one crescendo span ending at the hinge X and one decrescendo span starting
  at the SAME X; assert `cresc.x2 === decresc.x1` (and same `yCenter`/`aperture`).
- **★ NEW cross-system TIE/SLUR clamp tests (TOPIC 3 lock-in):** a tie AND a slur
  each m1→m4 at narrow width now (a) don't throw and (b) clamp `x2` to the start
  system's `staffEndX`. ZERO such tests exist today — highest-value additions
  (cover a path with no current coverage + a known latent bug, and lock the
  generic clip fix against regression).

*Emit — `src/notation/__tests__/svg.test.js` (AC3 DOM form, AC8):*
- AC3 DOM: `svg.querySelector('[data-span="crescendo"]')` and
  `[data-span="decrescendo"]` each exist and each contain TWO `<line>` children;
  read their `x1/y1/x2/y2` and assert the opening-vs-closing divergence above.
  Assert `data-hand` stamped. (Emit-side twin of the layout AC3 test.)
- AC8 no-regression: extend the existing
  `it("renders ties/slurs as <path> spans")` (svg.test.js:231) — assert
  `path[data-span="tie"]` STILL exists as a `<path>` (Bézier), confirming the
  hairpin work didn't convert tie/slur to lines. Optionally a song combining a
  tie + slur + ottava + dynamics + hairpin → assert all selectors coexist.

*AC2 (additive growth, no change):* a song with NO gradual dynamics produces an
identical model — assert "no spans of the new kinds" (and/or a snapshot
unchanged). Covered by the existing-song validate/render assertions.

*E2E (Playwright, optional, matches existing posture):* one grand-staff song
with a crescendo, a decrescendo, and a messa di voce, rendered in the block, as
the visual backstop. Not required for the unit-level ACs.

---

## Consolidated architecture (the buildable design)

A single, internally-consistent picture across all five topics. The feature is a
near-exact clone of the existing tie/slur span pipeline, with three deltas: a
flat below-staff lane Y (not the notehead Y), a two-line wedge renderer (not the
Bézier), and a layout-layer cross-system clip (which also fixes a latent
tie/slur bug).

**Data model (1 change, `src/song/schema.js`).** Add to `$defs.event.properties`,
alongside `tie`/`slur`:
```js
crescendo: { enum: ["start", "stop"] },
decrescendo: { enum: ["start", "stop"] },
```
No validator change (`src/song/validate.js`): the generic enum check rejects bad
values; permissive `additionalProperties` ignores misspellings; pairing is never
validated (best-effort at render time).

**Matching / resolution (`src/notation/layout.js`).**
- `recordSpanMarkers` (~2110): (1) carry the two new markers on each stream entry
  (`crescendo: event?.crescendo, decrescendo: event?.decrescendo`); (2) **carry
  the below-staff lane Y** — push `staffBottomY` (already a param) or a
  precomputed `laneY = staffBottomY + HAIRPIN_LANE_DY` onto the entry. This is
  the ONE required change to the recording layer (the lane Y is otherwise
  unrecoverable — only the notehead Y is stored, and `staffBottomY` differs per
  hand: RH 9, LH 21).
- `resolveAllSpans` (~2149): add `"crescendo"`, `"decrescendo"` to the kind list;
  each projected and run through the SAME `matchSpans` (independent per-hand
  stacks, no shared state). Pass `systems` in (or do the clamp in the existing
  post-resolution loop at ~1883) so the start system's `staffEndX` is reachable.
  After the shared anchor guard (~2161), dispatch by kind: tie/slur →
  `buildSpanSpec` (UNCHANGED); crescendo/decrescendo → a new hairpin builder.
- New hairpin builder: emits
  `{ kind, hand, systemIndex, x1, x2, yCenter, aperture, crossSystem }` where
  `x1 = start.anchor.x`, `x2 = stop.anchor.x`, `yCenter` = the carried lane Y
  (flat, pitch-independent), `aperture` = the shared constant. For a cross-system
  span, clamp `x2 = max(x1, min(x2_if_known, systems[systemIndex].staffEndX))`
  (degenerate-safe) and draw the start-portion only.

**Emit (`src/notation/svg.js`).**
- New `renderHairpin(span)`: two `<line>`s wrapped in
  `<g data-span={kind} data-hand={hand}>`:
  - crescendo: `line(x1, yCenter, x2, yCenter − aperture/2)` +
    `line(x1, yCenter, x2, yCenter + aperture/2)`;
  - decrescendo: `line(x1, yCenter − aperture/2, x2, yCenter)` +
    `line(x1, yCenter + aperture/2, x2, yCenter)`.
- `renderSystem`'s span loop (~311): dispatch by kind — crescendo/decrescendo →
  `renderHairpin`, else `renderSpan` (the tie/slur Bézier, byte-identical).

**Constants (`src/notation/constants.js`).** Add `HAIRPIN_APERTURE` (~1.0 sp) and
`HAIRPIN_LANE_DY` (~+3.0 sp below the staff bottom line). The aperture MUST be a
constant (never width-derived) — this is what makes the degenerate two-note case
division-free.

**Lane / placement.** Per-hand, below each hand's own staff (reuses the
point-dynamic frame). Wedge center in the dynamic band; collisions with a
bracketing point dynamic resolved horizontally (inset the wedge endpoint past the
dynamic), with a below-dynamic vertical sub-lane as an acceptable simpler
fallback for the build phase.

## OQ resolutions (explicit)

- **OQ-1 → hairpin-only for v1; `cresc.`/`dim.` text form deferred.** The hairpin
  is required (Req 7) and correct for any span length; text is additive
  SHOULD/MAY (Req 8), not a substitute. A future text form would be cheap (reuses
  `renderOttava`'s dashed-line+label), which only confirms it is low-cost to add
  later — it does not change the v1 scope.
- **OQ-2 → two independent optional fields `crescendo`/`decrescendo`, each
  `enum:["start","stop"]`** (shape A). The only candidate that expresses the
  messa-di-voce hinge under the single-pending-stack matcher; byte-for-byte
  symmetric with tie/slur; zero new validator logic; faithful to the MusicXML
  "direction is intrinsic author data" semantics (adapted to two fields because
  this codebase has no disambiguating `number`).
- **OQ-3 → clip in the LAYOUT layer to the start system's `staffEndX`; v1 draws
  the start-system portion only (drop the continuation); make the clip generic
  across tie/slur/hairpin.** The non-crash MUST-minimum requires an explicit clip
  because today's behavior fails AC9's "within-system portion is drawn" (it draws
  a wrong stroke to a foreign-frame X). Full split (continuation open-mouth +
  3+-system pass-throughs) is the future refinement. The generic clip is a
  latent-bug fix, provably a no-op for within-system spans; **flagged owner
  judgment call** — the plan may down-scope to hairpin-only if maximum AC8
  conservatism is wanted.
- **OQ-4 → per-hand, below each hand's own staff** (the spec's accepted
  simplification), reusing the existing point-dynamic frame with no new band
  lane. Between-staves is both net-new geometry and a model mismatch with the
  per-hand data shape, and remains the future refinement.

## No blockers

The spec is internally consistent and sufficient. Every requirement and
acceptance criterion maps to a concrete, buildable element above with no
contradiction requiring a spec revision. The one decision that touches existing
behavior (the generic cross-system clip vs. hairpin-only scope, under AC8) is
recorded as an explicit, owner-overridable judgment call rather than a blocker.
