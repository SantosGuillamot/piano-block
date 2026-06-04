# Design Doc: Free-text `notes` annotations placeable above or below either staff

## Overview

The Piano Block stores a song as JSON and renders it as grand-staff sheet music (SVG). Today the only free-form annotation an author can attach is a single per-event `chordSymbol` string, which always renders above the right-hand staff. This is too narrow: authors want to attach arbitrary text (a chord symbol, `"pedal"`, `"rit."`, a rehearsal label) and choose where it appears — including below a staff and on the left-hand staff.

This design replaces `chordSymbol` with one general **notes** capability. A note holds free text plus an explicit `placement` (`above` / `below`). Notes attach in two modes: **per-event** (`event.notes`, inheriting the event's staff and horizontal column) and **standalone** (`measure.notes`, carrying an explicit `staff` and optional `beat` horizontal anchor). All four grand-staff positions — above and below each of the two staves — become reachable. `chordSymbol` is removed as a clean break across the **12** files that carry the token (verified by `grep -rln "chordSymbol\|chord-symbol\|CHORD_SYMBOL" src/ specs/ docs/ README.md`): legacy songs that still carry it remain valid but the annotation stops rendering, with no auto-migration. The work touches the song schema, the notation layout model, the SVG emitter, the shared constants, and the docs/tests; the validator (`src/song/validate.js`) needs **no change** because the new constraints are all expressible declaratively.

## Approach

The realization has four cooperating parts that map onto the existing pipeline (`schema → validate → layout model → svg emit`):

1. **Schema (data model).** Two new `$defs` — `eventNote` and `standaloneNote` — describe the two attachment modes. `event.notes` is an array of `eventNote`; `measure.notes` is an array of `standaloneNote`. The `chordSymbol` event property is deleted. Because the existing validator already enforces `required`, `enum`, `type`, and `minimum` declaratively, and the only new numeric bound (`beat ≥ 0`) is an *inclusive* minimum expressible as `minimum: 0`, the validator is untouched.

2. **`chordSymbol` removal (clean break).** Every `chordSymbol` token — identifiers *and* prose comments/JSDoc — is removed across the **12** in-scope files that carry it in `src/`, `specs/`, `docs/`, and `README.md` (`src/render.php`, `src/song/schema.js`, `src/notation/constants.js`, `src/notation/layout.js`, `src/notation/svg.js`, `src/song/__tests__/validate.test.js`, `src/notation/__tests__/layout.test.js`, `src/notation/__tests__/svg.test.js`, `specs/render.spec.js`, `specs/editor.spec.js`, `docs/song-format.md`, `README.md`). The size constant `CHORD_SYMBOL_SIZE` is renamed `NOTE_SIZE`; the emit text-kind value `chord-symbol` becomes `note`. The two behaviors that must survive — above-RH free-text rendering and XSS-inert verbatim text — transfer 1:1 with **zero new safety code**, because both mechanisms are field-agnostic. Legacy `chordSymbol` data stays valid (the schema is permissive about unknown keys) and simply does not render.

3. **Rendering — four placement bands.** The renderer gains a band model that resolves a Y anchor for each of the four positions per system: **above-RH**, **below-RH**, **above-LH**, **below-LH**. above-RH reuses the existing above-staff lane stacker (renamed). The inter-staff gap holds two sub-bands (below-RH growing *down* from the RH bottom line; above-LH growing *up* from the LH top line). below-LH is a new lane that grows down into the system's bottom margin. The inter-staff gap and the bottom margin **always flex**: they reserve exactly the stack height needed and collapse to today's base values when no inter-staff / below-LH notes are present. The flex is computed *before* the LH staff top Y is set — the one structural reorder this feature requires.

4. **Rendering — anchoring, stacking, observability.** Per-event notes inherit the event's column X; standalone notes resolve X by interpolating the `beat` onset over the justified column grid, with a clamp for over-content beats. Multiple same-placement notes at one anchor stack outward from their own staff with a uniform step. Each emitted text node carries `data-text="note"`, `data-placement`, and a staff discriminator (`data-hand` from the enclosing group for per-event notes; `data-staff` on the node for standalone notes), so all four bands are distinguishable on the rendered DOM.

The implementer's mental model: a note is a `{text, placement}` primitive (plus `staff`/`beat` for standalone) that the layout phase resolves into an `(x, y)` anchor by choosing a band from `(staff, placement)` and an X from the event column or the beat onset, then the emit phase writes a centered `<text>` carrying the discriminator attributes. Geometry cascades from band anchors — there is no second patch site once the flexed anchors are computed.

## Components

### Modified components

- **`src/song/schema.js` (data model).** Adds the `eventNote` and `standaloneNote` `$defs`; replaces the `chordSymbol` event property with a `notes` array property; adds a `notes` array property to `measure`. Net delta: +2 `$defs`, +2 `notes` array properties, −1 line.

- **`src/song/validate.js` (validator).** **Unchanged.** The walker's generic `required` / `enum` / `type` / `minimum` checks (and per-element path-pointing via `validateArray` / `validateObject`) already cover every new rule. No new `applySpecialCases` branch, no `checkBeat` — `beat`'s inclusive `≥ 0` bound is declarative (`minimum: 0`), unlike `tempo.bpm`'s strict `> 0` which needs the walker.

- **`src/notation/layout.js` (layout model).** The largest change. `collectEventTexts` loops `event.notes` (was: a single `chordSymbol` read), pushing one `{ kind: "note", x, text, placement }` per element. A new `collectStandaloneNotes` resolves `measure.notes` to beat-anchored `{ kind: "note", x, text, placement, staff }` records on a new `measureModel.standaloneNotes` collection. The per-system band block gains: an occupancy scan over both hands' `event.notes` and `measure.notes`, the `effectiveInterStaffGap` flex (computed before `lhTopY`), the flexed `bottomMargin`, the renamed above-RH lane in `topMarginLayout`, and the band-presence predicates that replace `systemHasChordSymbols`.

- **`src/notation/svg.js` (SVG emitter).** `renderHandText` gains a `note` branch (placement → band Y, `data-text="note"` + `data-placement`) replacing the `chord-symbol` branch. A new emit path renders the system/measure-level standalone notes with `data-staff`. `chordDyR`/`chordDyL` (the chord-lane local-frame conversion) are generalized or replaced by reading the band anchors.

- **`src/notation/constants.js` (constants).** `CHORD_SYMBOL_SIZE` renamed to `NOTE_SIZE`. New constants `NOTE_GAP_STAFF`, `MID_GAP`, `DYNAMICS_LANE_RESERVE`, `NOTE_CLAMP_INSET`. `TEXT_LANE_GAP` is reused as the per-note stack gap.

- **`src/render.php`.** A comment naming `chordSymbol` as the script-breakout example is reworded to `notes`. The XSS-escaping logic (escapes every `<` in the whole song string before the `<script>` carrier) is field-agnostic and unchanged.

- **`docs/song-format.md`, `README.md`.** `chordSymbol` references removed; `notes` documented (both modes, all fields, the `beat` units, the placement/staff enums); one migration line added.

- **Tests** (`src/song/__tests__/validate.test.js`, `src/notation/__tests__/layout.test.js`, `src/notation/__tests__/svg.test.js`, `specs/render.spec.js`, `specs/editor.spec.js`). Existing `chordSymbol` assertions are **retargeted** (not deleted) onto `notes`, preserving the locked behaviors (above-RH rendering, XSS-inert hostile text), plus new coverage for the new bands, validation rules, stacking, and anchoring.

### Untouched-but-relevant components

- **Dynamics rendering** (RH/LH dynamics at `staffBottomY + 3.5`, inside/below the staff). Below-RH and below-LH notes dodge *below* this row when the hand has dynamics in the system; dynamics emit is unchanged.
- **Ottava / tempo / measure-number lanes.** The above-RH note lane keeps the chord lane's innermost slot below ottava/tempo in `topMarginLayout`; the other above-staff lanes stack from the note lane's new (stack-dependent) height, otherwise unchanged.
- **Brace, barlines, staff lines, ledgers, inline clef/keysig/timesig, spans (ties/slurs).** All derive their Y from band anchors, so they follow the flexed geometry automatically with no edits.

## Interfaces and Data Flow

### Schema additions (`src/song/schema.js`)

Two new `$defs` (enums inline, matching the file's "publishable verbatim data document" convention):

```js
eventNote: {
  type: "object",
  required: ["text", "placement"],
  properties: {
    text: { type: "string" },
    placement: { enum: ["above", "below"] },
  },
},

standaloneNote: {
  type: "object",
  required: ["text", "placement", "staff"],
  properties: {
    text: { type: "string" },
    placement: { enum: ["above", "below"] },
    staff: { enum: ["rightHand", "leftHand"] },
    beat: { type: "number", minimum: 0 },
  },
},
```

Attachment points:

- `event.properties`: replace `chordSymbol: { type: "string" }` with `notes: { type: "array", items: { $ref: "#/$defs/eventNote" } }`. The lone `if`/`then` on `event` is a sibling of `event.properties` and is untouched; the `biome-ignore` comment on the `then` line stays.
- `measure.properties`: add `notes: { type: "array", items: { $ref: "#/$defs/standaloneNote" } }`. No existing `notes`/annotation key in the schema, so no collision.

`additionalProperties` is permissive everywhere, but the validator still validates *declared* properties (a declared key with a bad value is an error — `validate.js:191-198`). Permissiveness only excuses **unknown** keys. So the two "silently ignored" behaviors rest specifically on those keys being undeclared:
- A stray `staff` or `beat` on a per-event note is silently ignored (no error) — **because `eventNote` deliberately does not declare `staff` or `beat`**, so they fall through as unknown keys. This is the invariant the "stray field ignored on a per-event note" criterion depends on: **do not add `staff`/`beat` to `eventNote`** (e.g. "for symmetry" with `standaloneNote`), or a bad `staff` enum value on a per-event note would then become a validation error and break that criterion.
- A legacy `chordSymbol` after removal is an unknown optional key (it is removed from the schema) → silently valid → does not render.

### Note primitive (layout → emit)

The layout model normalizes both modes into one emit primitive:

```
{ kind: "note", x, text, placement, staff? }
```

- `x` — resolved horizontal position (sp). Per-event: the event's column X. Standalone: the interpolated beat onset.
- `placement` — `"above" | "below"`. Travels on the primitive (it did not need to before, because chord symbols were always above) so the emit can select the band.
- `staff` — present only for standalone notes (`"rightHand" | "leftHand"`); per-event notes inherit staff from the enclosing hand group.

> Naming note: `layoutHand` already returns a renderer-internal `{ notes, rests, beams, texts }` where `notes` means laid-out *noteheads*. That meaning is unrelated to the song-format `notes` key. The new standalone collection is named `standaloneNotes` to keep the two distinct.

### Data flow

```
song JSON
  ├─ validate (schema only; no walker change)
  └─ layout model (per system):
       per-event notes:  collectEventTexts(event, x, out)
                           → loops event.notes, pushes {kind:"note", x, text, placement}
                           → measure.{right,left}.texts  (per-hand path, inherits hand)
       standalone notes: collectStandaloneNotes(measure.notes, ctx)
                           → interpolates beat → x, pushes {kind:"note", x, text, placement, staff}
                           → measureModel.standaloneNotes  (measure-level path, parallel to barlines/inline)
       band model: scan both hands' event.notes + measure.notes
                           → per-band presence + per-band max stack counts (4 bands)
                           → effectiveInterStaffGap, lhTopY, bottomMargin, above-RH lane height
  └─ svg emit:
       per-event:  <g data-measure> → <g data-hand> → <text data-text="note" data-placement>
       standalone: <g data-measure> → <text data-text="note" data-staff data-placement>
       text written via setText (textContent) → XSS-inert
```

### Emitted DOM (observability contract)

- **Per-event note:** `<g data-measure=N>` → `<g data-hand="rightHand|leftHand">` → `<text data-text="note" data-placement="above|below">`. Staff is read from the enclosing `data-hand`.
- **Standalone note:** `<g data-measure=N>` → `<text data-text="note" data-staff="rightHand|leftHand" data-placement="above|below">` (not inside a hand group). Staff is read from `data-staff`.

**Two coordinate frames (a load-bearing emit detail).** The two shapes nest differently, so they consume the band anchor Y differently:
- **Per-event notes** render inside `<g data-hand transform="translate(0 staffBottomY)">`, whose origin is the hand's staff bottom line. Their `y` is therefore the **local-frame conversion** `bandY − staffBottomY` (this is exactly what today's `chordDy = chordSymbolY − staffBottomY` does at `svg.js:479-486`).
- **Standalone notes** render directly under `<g data-measure transform="translate(measure.x 0)">`, which has **no Y translate**. Their `y` is therefore the **raw band anchor Y in system coordinates** — it is *not* run through the `chordDy`-style subtraction. Applying the per-event conversion to a standalone note would place it at the wrong Y.

This makes below-RH vs above-LH distinguishable even though they share the inter-staff band: same band, different `data-staff` / `data-hand`. Selector safety is verified: `[data-text="note"]` ≠ `[data-kind="note"]` (different attributes — `note` is an existing `data-kind` value but not a `data-text` value), and `[data-staff]` ≠ `[data-staff-lines]` (different attribute names). Every selector in `src/` + `specs/` is attribute-qualified, so no value collision can occur.

### Text styling

Plain text matching the old chord symbols: `font-size: NOTE_SIZE`, default family, **no** `font-style` / `font-weight` (unlike dynamics' bold-italic and ottava's italic), `text-anchor: middle` (centered on the anchor X). The note emit reuses the old chord branch's exact attribute set, swapping the `data-text` value and adding `data-placement` (+ `data-staff` for standalone).

## Key Decisions

### Decision: Two `$defs` for the two attachment modes; `beat` validated declaratively

- **Choice:** Model the two modes as separate `$defs` (`eventNote`, `standaloneNote`) sharing `text` + `placement`; `standaloneNote` adds required `staff` and optional `beat: { type: "number", minimum: 0 }`. Use `required: ["text"]` for presence (so `text: ""` is valid). Keep `validate.js` unchanged — `beat`'s inclusive `≥ 0` bound is the declarative `minimum: 0`.
- **Alternatives:** (1) One shared `$def` with conditional requiredness via `if`/`then` — rejected: the schema subset supports only one `if`/`then` per object and it is already used on `event`; two separate `$defs` are clearer and match the model's "two modes, one concept" framing. (2) A walker `checkBeat` paralleling `checkBpm` — rejected: `bpm` needs a *strict* `> 0` bound (not expressible with `minimum`), but `beat` needs an *inclusive* `≥ 0`, which `minimum: 0` expresses exactly. Declarative keeps the bound in the schema-as-data source of truth and adds zero validator code.
- **Trade-offs:** Two `$defs` is a few more lines than one, but removes any conditional-requiredness logic and keeps each mode self-describing. The observable behavior (`beat: -1` errors; `beat: 0 / 0.5 / 99` valid; fractional allowed) is identical to a walker approach.
- **Traces to:** Requirements 1–4, 9–13; acceptance criteria on data-model validity, `text: ""` validity, missing `text`/`placement` errors, `placement`/`staff` enum errors, `staff` required on standalone, stray-field ignored, `beat: -1` error, `beat: 0/0.5/99` valid, per-element error path.

### Decision: Remove `chordSymbol` as a clean break; rename to `note` vocabulary; reuse safety paths

- **Choice:** Delete every `chordSymbol` token (identifiers and prose) across the **12** in-scope files that carry it (the same 12 enumerated in Components → "Modified components"). Rename `CHORD_SYMBOL_SIZE → NOTE_SIZE`; change the emit text-kind value `chord-symbol → note`; broaden `collectEventTexts` from one `chordSymbol` read to a loop over `event.notes`. Keep the per-element `text.length > 0` guard so `text: ""` renders nothing. Legacy `chordSymbol` data stays valid (permissive schema) and does not render — no auto-migration, only one docs migration line.
- **Alternatives:** (1) Keep `chordSymbol` alongside `notes` during a transition — rejected by the spec ("no state in which both are supported"). (2) Auto-migrate legacy `chordSymbol` → `notes` — explicitly out of scope. (3) A 1:1 rename `chordSymbolY → noteY` — rejected: the single above-RH chord anchor cannot express four positions; it is superseded by the band model, becoming one cell of it.
- **Trade-offs:** The clean break means legacy chord symbols silently stop rendering. This is the spec's intended behavior (legacy-valid-but-non-rendering), and the one-line migration note tells authors how to rewrite them. Using `note` as the `data-text` value introduces mild human grep-ambiguity with the `data-kind="note"` noteheads, accepted in exchange for emit/schema vocabulary alignment (verified collision-free because all selectors are attribute-qualified).
- **Traces to:** Requirements 5–8, 18, 19; acceptance criteria on no `chordSymbol` token anywhere, legacy `chordSymbol` valid + non-rendering, migration docs line, `text: ""` renders nothing, verbatim `Gm7`, hostile text inert.

### Decision: Four placement bands with an always-flexing inter-staff gap and bottom margin (PAIR A)

- **Choice:** Resolve four band Y anchors per system. above-RH reuses the `topMarginLayout` lane (renamed). The inter-staff gap holds two sub-bands — below-RH grows down from `rightStaffBottomY`, above-LH grows up from `leftStaffTopY`. below-LH grows down from `leftStaffBottomY` into the bottom margin. below-RH/below-LH notes dodge below their hand's dynamics row (at `staffBottomY + 3.5`) only when that hand has dynamics in the system. **The dynamics dodge and the gap flex share one `*_stack` definition** (this is the consistency the geometry depends on): each below-band's reserved depth is the distance from its staff line to the furthest note baseline *plus* the glyph descent, and that *same* quantity drives both the per-note baseline and the flex `max(...)`. Concretely:

  ```
  STACK_STEP   = NOTE_SIZE + TEXT_LANE_GAP                 // = 3.4 sp, baseline-to-baseline
  DESCENT      ≈ 0.22 · NOTE_SIZE                          // ≈ 0.62 sp, glyph descent below baseline
  baseOffset(hand, side) =
      (side is "below" && hand_has_dynamics) ? DYNAMICS_LANE_RESERVE   // dodge past the dynamics row
                                             : NOTE_GAP_STAFF          // hug the staff line

  // Below-band reserved depth from the staff line (n = system-wide MAX stack at any one anchor):
  belowRH_stack = baseOffset(RH, "below") + (nBelowRH − 1) · STACK_STEP + DESCENT
  belowLH_stack = baseOffset(LH, "below") + (nBelowLH − 1) · STACK_STEP + DESCENT
  // Above-LH reserved depth from the LH top line (grows up; no dynamics dodge — dynamics are below):
  aboveLH_stack = NOTE_GAP_STAFF        + (nAboveLH − 1) · STACK_STEP + DESCENT

  effectiveInterStaffGap = max(
      INTRA_STAFF_GAP,                                     // base 8 sp — collapse target when empty
      belowRH_stack + aboveLH_stack + (both_present ? MID_GAP : 0)
  )
  lhTopY = rhBottomY + effectiveInterStaffGap              // set AFTER the occupancy scan

  // Per-note baselines use the SAME baseOffset (so they can never exceed the reserved depth):
  belowRH note #k baseline = rightStaffBottomY + baseOffset(RH, "below") + k · STACK_STEP
  aboveLH note #k baseline = leftStaffTopY      − NOTE_GAP_STAFF         − k · STACK_STEP   // grows up
  belowLH note #k baseline = leftStaffBottomY   + baseOffset(LH, "below") + k · STACK_STEP
  bottomMargin = max(
      SYSTEM_BOTTOM_MARGIN + ledgerBottomExtent,
      belowLH_stack        + ledgerBottomExtent
  )
  ```

  Because `belowRH_stack` *includes* the `DYNAMICS_LANE_RESERVE` dodge term whenever the RH has dynamics, the gap is reserved to cover the dodged stack: the furthest below-RH baseline is `rightStaffBottomY + belowRH_stack − DESCENT`, which (with `aboveLH_stack ≥ NOTE_GAP_STAFF + DESCENT > 0`) is strictly above `leftStaffTopY = rightStaffBottomY + effectiveInterStaffGap`. A dodged below-RH note can therefore **never** be pushed into or through the LH staff — the failure the flex exists to prevent. The flex is computed **before** `lhTopY` is set (the one pipeline reorder: occupancy → gap → `lhTopY`). No general cross-kind (note-vs-dynamic/ottava) collision solver is built.
- **Alternatives:** PAIR B — "tighten the base gap so 1-below-RH + 1-above-LH fits 8 sp, and do not dodge dynamics." Rejected because the two decisions are coupled: once below-RH notes dodge below the RH dynamics row (which sits at `rightStaffBottomY + 3.5`, inside the gap), the common 1+1 case no longer fits 8 sp, so "tighten to fit 8" is unachievable with dodging. A fixed enlarged gap for all systems was also rejected (it would add vertical churn to systems with no inter-staff notes).
- **Trade-offs:** Flexing means systems that carry inter-staff / below-LH annotations grow taller. This is correct (they genuinely need the room) and not churn — systems without such notes keep today's exact spacing because the flex collapses to the base values. PAIR A reuses the exact `topMargin` flex pattern the codebase already trusts (idiomatic, not novel machinery). Declining a general collision solver is acceptable because the spec only requires "N same-placement *notes* at N distinct Ys"; note-vs-dynamics/ottava overlap is already tolerated by the format (dynamics `y:3.5` and below-ottava `+2` can overlap today with no arbiter).
- **Trade-offs (verification):** Verified safe — no exact-value test breaks (every band/height assertion is relative, existence-only, or `toBeCloseTo` against the model's own anchor; the only ordering assertion `leftStaffTopY > rightStaffBottomY` is preserved because flex only grows the gap). `INTRA_STAFF_GAP` has one consumer (`lhTopY`), and `svg.js` imports no gap/height constant, so nothing can hardcode the old gap. Growing the gap is a pure cascade through `lhTopY → lhBottomY → systemHeight`; everything else derives from band anchors.
- **Traces to:** Requirement 14 (all four bands renderable in the correct vertical band); acceptance criteria on per-event/standalone notes landing in above-RH, the inter-staff gap (below-RH and above-LH), and below-LH; coexistence (below-RH + above-LH both render and stay distinguishable).

### Decision: Per-event X from the event column; standalone X by interpolated beat onset with an over-content clamp

- **Choice:** Per-event notes inherit the event's column X (already passed through `collectEventTexts`). Standalone notes resolve X by **interpolating** the `beat` onset over the *scaled* `columnX` grid: `x(beat) = lerp(columnX(t_i), nextX, (beat − t_i) / (t_next − t_i))` where `[t_i, t_next]` bracket `beat` in the sorted onset grid (last column extends to `measureEnd` / content right edge; guard the span with `|| 1`). A no-`beat` note is treated as `beat: 0` ≡ `leadInset` (the measure's content-left edge). Over-content beats clamp: `x = min( beatToX(min(beat, measureEnd)), measureRightX − NOTE_CLAMP_INSET )`, with `NOTE_CLAMP_INSET ≈ 1.0 sp`. Standalone X is resolved in a separate `measureModel.standaloneNotes` collection at the measure-walk site (where `columnX`, `ml.columns`, `ml.measureEnd`, `leadInset`, `measureRightX`, `advanceScale` are all in scope), not folded into the per-hand `texts`.
- **Alternatives:** (1) **Snap** beat to the nearest event column — rejected: two distinct beats can collapse to one X (fails "`beat: 2` further right than `beat: 0`"), and monotonicity is not robust. (2) Clamp over-content beats to `measureEnd` alone — rejected: `measureEnd`'s onset-X coincides exactly with the trailing barline, so a `text-anchor: middle` glyph would straddle the bar and collide with the next measure; backing off by `NOTE_CLAMP_INSET` keeps the node strictly inside the content. (3) Fold standalone notes into `measure.{right,left}.texts` — rejected: standalone X is beat-derived (not column-derived), standalone carries its own explicit `staff` (folding would force pre-bucketing and the emit could not distinguish standalone `data-staff` from per-event `data-hand`), and standalone attaches at the measure level (parallel to `barlines`/`inline`), matching `measure.notes`.
- **Trade-offs:** Interpolation is ~10 lines of new code (no existing helper) but tracks the justified grid exactly like events do, giving robust monotonicity. The `NOTE_CLAMP_INSET` is a small new constant; a simpler no-constant alternative (clamp to the last column's X) is unambiguously in-bounds but lands on the last event rather than the true right edge — the chosen `measureEnd − inset` form is truer to "furthest right, still in bounds, best-effort."
- **Traces to:** Requirements 16, 17; acceptance criteria on per-event text sharing the event's column, `beat: 2` further right than `beat: 0`, no-`beat` ≈ `beat: 0` and left of `beat: 2`, and an over-content `beat: 99` still rendering within the system's horizontal bounds.

### Decision: Uniform outward stacking, grouped per (band, anchor)

- **Choice:** "Array order = increasing distance from the note's own staff," uniform across all four bands: note[0] hugs its staff, note[k] stacks outward. One step for all bands: baseline-to-baseline = `NOTE_SIZE + TEXT_LANE_GAP` = 3.4 sp (reusing `TEXT_LANE_GAP`, whose JSDoc already reads "gap between two stacked text lanes"). Grouping is per (band, anchor); k resets per anchor. Per-event group key = `(event, placement)` with k = index within `event.notes` filtered to that placement. Standalone group key = `(staff, placement, raw beat ?? "noBeat")` — grouped by the **raw** beat (pre-interpolation), so two `beat: 2` notes stack (k = 0, 1) while `beat: 2` and `beat: 2.0001` are different groups at distinct interpolated X. Lane heights and flex inputs use the **system-wide MAX** stack at any single anchor per band. An event carrying both an above and a below note is just two `event.notes` entries routed to independent bands — no special handling.
- **Alternatives:** (1) A per-band step size — rejected: one uniform step is simpler and `TEXT_LANE_GAP` is semantically exact for all four. (2) Group standalone notes by epsilon-rounded resolved X — rejected: grouping by raw beat is cheaper (O(n) via a `Map`), matches the spec's natural "same anchor = same beat," and avoids float-rounding fragility. (3) A general collision solver across same-anchor notes and other occupants — out of scope per the spec.
- **Trade-offs:** Using the system-wide max stack reserves one shared vertical band per anchor across the system (like today's single system-local chord Y) — slightly more vertical reservation than a per-anchor-exact approach, but matches the existing lane model and keeps the flex inputs a single number per side.
- **Traces to:** Requirement 20; acceptance criteria on an event with both above and below notes rendering both, N same-placement notes at N distinct positions (none lost, none overlapping), and a per-event note + standalone note in the same measure both rendering.

### Decision: `data-text="note"` + `data-placement` + staff discriminator for observability

- **Choice:** Every note text node is `<text data-text="note" data-placement="above|below">`. Per-event notes derive staff from the enclosing `<g data-hand>`; standalone notes add `data-staff="rightHand|leftHand"` on the node (no enclosing hand group). Text written via the existing `setText` (`textContent` only).
- **Alternatives:** (1) A single combined discriminator (e.g. `data-position="above-rightHand"`) — rejected: the existing structure already exposes staff via `data-hand` for per-event notes, so reusing it (and adding `data-staff` only where there is no hand group) is more consistent and less redundant. (2) Always add `data-staff` even on per-event notes — harmless but unnecessary; the enclosing `data-hand` already carries it.
- **Trade-offs:** Two slightly different observability shapes (per-event vs standalone) instead of one uniform shape, in exchange for matching the existing DOM structure and avoiding redundant attributes. Both shapes make placement and staff observable, which is all the spec requires.
- **Traces to:** Requirement 15; acceptance criteria that a rendered note's placement and staff are observable, and that a below-RH note and an above-LH note remain distinguishable despite sharing the inter-staff band.

## Dependencies

- **Internal:** `src/song/schema.js` (consumed by `src/song/validate.js`), `src/notation/layout.js` (consumed by `src/notation/svg.js`), `src/notation/constants.js` (consumed by both layout and svg). `src/render.php` carries the rendered SVG to the page and escapes the song string.
- **External libraries / services:** None added. No new runtime dependency. The feature is pure schema + layout arithmetic + SVG string emission.
- **New constants (`src/notation/constants.js`):**
  - `NOTE_SIZE` — rename of `CHORD_SYMBOL_SIZE` (value `2.8`); note-annotation text size (free author text); reword JSDoc accordingly.
  - `NOTE_GAP_STAFF` (~`0.6`–`1.0`) — clearance between a staff line and the nearest note baseline.
  - `MID_GAP` (~`1.0`–`1.2`) — clearance between the below-RH and above-LH sub-bands inside the inter-staff gap when both are present.
  - `DYNAMICS_LANE_RESERVE` (~`4.5`) — the dynamics glyph box height a below-RH/below-LH note dodges past when the hand has dynamics (the dynamics row sits at `staffBottomY + 3.5`); a tunable constant, not a hard derivation. It is the `baseOffset` for a below band whose hand has dynamics, so it feeds **both** the per-note baseline and the gap/bottom-margin `*_stack` flex term (see the PAIR A decision) — keeping the two in lockstep.
  - `NOTE_CLAMP_INSET` (~`1.0`) — horizontal back-off from the trailing barline for over-content `beat` clamping.
  - `TEXT_LANE_GAP` (`0.6`, existing) — reused as the per-note stack gap; one step = `NOTE_SIZE + TEXT_LANE_GAP` = `3.4`.

## Failure Modes and Observability

- **Invalid note data** (missing `text`/`placement`, bad `placement`/`staff` enum, missing `staff` on standalone, `beat: -1`) → the validator reports a path-pointed error (e.g. `sections[0].measures[0].notes[1].placement`) via the existing walker; no new error machinery. The walker's `validateArray` recurses each element as `…notes[i]` and `validateObject` builds `…notes[i].field`.
- **Stray `staff`/`beat` on a per-event note, or a legacy `chordSymbol`** → these are **unknown** keys (`eventNote` does not declare `staff`/`beat`, and `chordSymbol` is removed from the schema), so permissive `additionalProperties` ignores them; no error, no render. (Declared keys are still validated, so this hinges on the keys being undeclared — keep `staff`/`beat` off `eventNote`.)
- **Empty text (`text: ""`)** → valid; the `text.length > 0` guard in *both* `collectEventTexts` and `collectStandaloneNotes` produces no text node, so it renders nothing.
- **Over-content / out-of-range `beat`** (e.g. `99`) → clamped to `measureRightX − NOTE_CLAMP_INSET`; the node always renders within the system's horizontal bounds, best-effort, never straddling the barline.
- **Hostile text** (`"<script>…"`, `'C7 & <alt> "sus"'`) → XSS-inert via two independent field-agnostic mechanisms: `svg.js setText` writes `textContent` only (never `innerHTML`), and `render.php` escapes every `<` in the whole song string before the `<script>` carrier. No new safety code; the guarantee transfers 1:1 from `chordSymbol`.
- **Observability on the rendered SVG:** every note is `<text data-text="note">` with `data-placement` and a staff discriminator (`data-hand` from the enclosing group, or `data-staff` on the node). This is the contract the rendering acceptance criteria assert against — below-RH vs above-LH are distinguishable by their staff discriminator even though they share a vertical band. No console logging or telemetry is added (consistent with the existing renderer).

## Risks and Open Questions

- **Constant tuning (low risk, plan/code phase).** The exact values of `NOTE_GAP_STAFF`, `MID_GAP`, `DYNAMICS_LANE_RESERVE`, and `NOTE_CLAMP_INSET` are given as ranges grounded in text-metric arithmetic (`NOTE_SIZE = 2.8`, ascent ≈ 2.02 sp, descent ≈ 0.62 sp, step = 3.4 sp). With *no* dynamics, the 1-below-RH + 1-above-LH inter-staff case computes to `belowRH_stack + aboveLH_stack + MID_GAP ≈ (NOTE_GAP_STAFF + 0.62) + (NOTE_GAP_STAFF + 0.62) + MID_GAP ≈ 8.46 sp` (exceeds the base 8 by ≈ 0.5), confirming the flex is needed even without dynamics. With RH dynamics present, `belowRH_stack` swaps `NOTE_GAP_STAFF` for `DYNAMICS_LANE_RESERVE (~4.5)`, raising the 1+1 reservation to ≈ 12.3 sp — and because the gap `max(...)` and the per-note baseline both read this same `belowRH_stack`, the dodged note stays inside the reserved gap (it can never reach the LH staff). Final values should be picked in code and confirmed visually; because every band/height test is relative or existence-only, tuning will not break tests.
- **Pipeline reorder (contained risk).** Moving the inter-staff occupancy scan *before* `lhTopY` is set is the single structural change. It is contained: `INTRA_STAFF_GAP` has exactly one consumer (`lhTopY`), `svg.js` imports no gap/height constant, and the flex is a pure cascade (`lhTopY → lhBottomY → systemHeight`). Downstream sites read the already-flexed anchors, so there is no second patch site.
- **`systemHasChordSymbols` replacement.** This predicate (RH-only chord scan) is superseded by per-band presence predicates / one parameterized helper that scans both hands' `event.notes` and `measure.notes`. The plan should settle whether to emit one parameterized predicate or a small family; the dynamics-presence scan is a cheap per-system, per-hand `.some(...)` mirroring the old predicate's shape.
- **`chordDyR`/`chordDyL` generalization.** The old chord-lane local-frame conversion in `svg.js` (`band.chordSymbolY − staffBottomY`) must be generalized to read the four band anchors. The frame rule is fixed (see "Emitted DOM"): **per-event** notes use the local-frame conversion `bandY − staffBottomY` (they live inside the hand `<g>`), while **standalone** notes use the raw band anchor Y in system coordinates (their `<g data-measure>` has no Y translate, so no subtraction). The open question is only mechanical: whether the per-event note branch reads band anchors via a small per-hand conversion helper (analogous to today's `chordDy`) or inline — not which frame each path uses.
- **No spec contradiction or missing input.** Every spec design hand-off (vertical offsets/lane gaps, font size/family/weight, collision precision, over-content clamp X, one-vs-two inter-staff lanes, ordering vs tempo/ottava, the new below-staff/inter-staff lane machinery, the discriminator attribute names) is resolved above. No blocker.
