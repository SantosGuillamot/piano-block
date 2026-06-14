# Design research — Support arpeggios with direction (issue #28)

This is the running design record for the arpeggio feature. The approved spec
(`1-spec/spec.md`) settles *what* the feature does and the spec research
(`1-spec/spec-research.md`) settles the data model and vocabulary. This document
settles *how* it is built: the architecture and the technical decisions, with
file:line evidence, the options weighed, and the rationale for each decision.

It is the input to the design-doc writer; it stays at the architecture level
(where code goes, which abstractions it reuses, the data that flows between
layers) and deliberately does not break work into tasks (that is the plan phase).

## Settled inputs from the spec phase

These are already decided and are not reopened here. They are restated so the
design decisions below have their premises in view.

- **Data model.** A single optional `arpeggio` field on the event object, a
  closed enum `"up" | "down" | "nondirectional"`. The field absent means the
  chord is not arpeggiated; presence means it is, and the value is the direction.
  This mirrors `dynamic` (a single-value point enum on the event), not the
  `start`/`stop` span fields (`schema.js:162`, `schema.js:167-170`).
- **Vocabulary.** `up` = roll bottom-to-top with an upward arrowhead; `down` =
  roll top-to-bottom with a downward arrowhead; `nondirectional` = a plain wavy
  line, no arrowhead. Absence is the only "not arpeggiated" state — there is no
  sentinel value, consistent with every other optional marking.
- **Render approach.** Hand-drawn SVG primitives (a `<path>` wiggle plus an
  arrowhead), matching how ties, slurs, and hairpins are already drawn. No
  change to the subsetted music font is needed or in scope.
- **Render parity.** Both surfaces (the editor canvas and the published front
  end) call the same notation core — `buildLayoutModel` → `renderInto` — so a
  single implementation in that shared core renders on both automatically.

## Design questions and decisions

(running log below; one question at a time)

### Q1 — Render architecture: where the arpeggio geometry is computed and drawn

This is the only genuinely new ground in the feature. The data model, vocabulary,
authoring path, and validation all reuse existing patterns almost verbatim; the
rendered wavy line is the one piece with no direct precedent. The question has
three parts: (1) which layer computes the geometry, (2) where the SVG is emitted,
and (3) how the wavy-line path and arrowhead are actually generated.

**The codebase has two distinct rendering shapes, and the choice between them is
the heart of this decision:**

- **Per-event decorations** — accidentals, ledger lines, augmentation dots. Each
  is anchored to one chord's own geometry, computed when that chord's layout
  record is built (`layout.js` `layoutHand`, the per-note `notes.push({...})` at
  `layout.js:1542-1560`), and drawn inside `renderNote` (`svg.js:704-768`), which
  iterates `note.ledgers`, `note.heads`, `note.accidentals`, and `note.dotSpecs`,
  each anchored to `note.x`.
- **Cross-event spans** — ties, slurs, crescendos, decrescendos. Each is a
  `start`/`stop` pair that must be *resolved across two events* (the layout layer
  pairs the markers and produces a resolved-span list), then drawn in a separate
  system-level pass (`renderSpan` `svg.js:982-992` for tie/slur; `renderHairpin`
  `svg.js:1012-1037` for the wedges), not inside `renderNote`.

An arpeggio is a property of **one** chord (one event) and has nothing to resolve
across events. It is therefore a **per-event decoration**, structurally like an
accidental, not a span. Both parts of the architecture follow from that.

**Decision (1) — geometry is computed in the layout layer, on the per-note
record.** A new field `note.arpeggio = { dx, topY, bottomY, direction }` is built
in `layoutHand` alongside `accidentals`/`ledgers`/`dotSpecs`
(`layout.js:1555-1560`). The layout layer owns all three quantities:

- **`dx` (how far left).** The wavy line must sit *outside* (further left than)
  any accidentals on the chord. The accidentals are already column-stacked into
  `note.accidentals`, each carrying `acc.dx = ACCIDENTAL_GAP + column *
  ACCIDENTAL_COL_STEP` (`stackAccidentals`, `layout.js:690-717`, the `dx` set at
  `layout.js:712`), and that array is computed at `layout.js:1518`, *before* the
  per-note record is pushed — so the data is in hand. The rule is:
  `arpeggioDx = accidentals.length ? max(acc.dx) + ARPEGGIO_GAP : ARPEGGIO_FIXED_GAP`.
  This also keeps the line clear of stems for free: even a stem-down stem sits at
  `note.x - NOTEHEAD_RX` (`renderStem`, `svg.js:786`), still to the *right* of the
  left-side wiggle.
- **`topY` / `bottomY` (the vertical span).** `staffStepToY(s) = bottomLineY -
  s * 0.5` and **Y grows downward** (`layout.js:148-150`), so the chord's *highest*
  notehead (`topStep`, `layout.js:1558`) maps to the *smallest* (most negative) Y
  and the *lowest* notehead (`bottomStep`, `layout.js:1559`) to the largest Y:
  `topY = staffStepToY(topStep)`, `bottomY = staffStepToY(bottomStep)`. These Ys
  are in the same `bottomLineY = 0` frame as `heads[].y` and `accidentals[].y`, so
  no special handling is needed — the staff-bottom translate that `renderHand`
  applies to the whole note group (`svg.js`, the `<g transform>` around each hand)
  re-anchors the arpeggio identically to every other notehead-frame decoration.
- **`direction` (the enum).** A straight passthrough of `event.arpeggio` onto the
  record.

The record is built **only** when `event.arpeggio` is set and the chord has at
least one notehead (`positions.length > 0`). A rest returns early from the loop
(`layout.js:1482-1491`) before any of this code runs, so a rest never gets an
arpeggio record — **the "no rendered effect on a rest" requirement falls out
structurally, with no special-case guard**. `event` is in scope at the push
(`layout.js:1478` `list.forEach((event, idx) => …)`; `event.duration`,
`event.pitches` are already read at `layout.js:1545`, `1493`), so reading
`event.arpeggio` there is trivial.

*Rejected alternative:* compute the geometry in `svg.js` from the raw
`topStep`/`bottomStep`. This would fork the accidental-extent logic out of the
layout layer (the place that already owns `dx` for every other left-side
decoration) and would leak pixel/positioning math into the dumb-emit layer,
against the constants-module rule that "the layout layer never touches pixels"
(`constants.js` header). Keeping the geometry in layout matches the
`stackAccidentals` precedent exactly.

**Decision (2) — the SVG is drawn inside `renderNote`, not in a separate pass.**
`renderNote` (`svg.js:704-768`) already iterates the note's decoration arrays and
anchors each to `note.x`; the arpeggio joins that family with a single guarded
call — `if (note.arpeggio) g.appendChild(renderArpeggio(note.arpeggio, note.x));`
— placed near the accidental loop (`svg.js:748-756`). `renderNote` reads the
**record**, never the raw event (just as it reads `note.accidentals`, not
`event.pitches`), so no event object has to be threaded into the emit layer — the
one new record field is the entire data flow from layout to svg. Drawing inside
the note's `<g>` also means the arpeggio inherits the group's
`data-hand`/`data-event-index` stamping and is selectable/highlightable on the
editor canvas like every other part of the note.

*Rejected alternative:* a separate system-level `renderArpeggio` pass like
`renderHairpin`. Those passes exist *only* because spans resolve across events and
must be iterated over a resolved-span list (`svg.js:313`); an arpeggio has nothing
to resolve, so a separate pass would add an unjustified second iteration over the
notes and lose the free per-note grouping.

**Decision (3) — the wavy line and arrowhead are new hand-drawn SVG primitives in
`svg.js`, reusing the existing `<path>`/`<line>` idiom; no glyph, no font change.**
A repo-wide search for an existing wavy/zigzag/sine path generator
(`wavy|wiggl|zigzag|sine|sawtooth|undulat|squiggl`) finds none — the only `<path>`
d-string in the emit layer is the lone `M … Q …` quadratic of the tie/slur
`renderSpan` (`svg.js:983`). The wiggle generator is therefore genuinely new code,
but small and idiomatic:

- **`wigglePathD(x, topY, bottomY, amplitude, period) → string`** — a pure
  d-string builder. It walks from `bottomY` up to `topY` in half-period steps,
  emitting a chain of quadratic bumps whose control point alternates left/right of
  `x` each step, so the line reads as a vertical wiggle. The bump count is derived
  from the span height (`n = max(1, round((bottomY − topY) / (period / 2)))`), so
  the line **tiles to whatever height the chord spans** — a tall chord gets more
  bumps automatically (satisfying the tall-chord requirement for free), and a
  single-pitch note (`topStep == bottomStep`, height 0) clamps to one short bump
  (satisfying the single-pitch requirement for free).
- **`renderArpeggio(arp, noteX) → <g data-arpeggio>`** — emits the wiggle as
  `el("path", { d, fill: "none", stroke: INK, "stroke-width": STEM_THICKNESS })`
  (the same attributes as `renderSpan`, `svg.js:984-989`), at `x = noteX − arp.dx`.
  The **arrowhead** is a pair of `<line>` strokes branching on `arp.direction`,
  mirroring how `renderHairpin` picks its shape from the span `kind`
  (`svg.js:1018`): `up` draws a "^" at the top end (`topY`); `down` draws a "v" at
  the bottom end (`bottomY`); `nondirectional` skips the arrowhead branch entirely
  (the path only — the cheapest case). Two `<line>`s match the hairpin precedent
  more closely than a single `<polygon>`/`<path>`, so that is the recommended
  form.

**New constants** (in `constants.js`, beside the hairpin block at
`constants.js:222-259`): `ARPEGGIO_AMPLITUDE` (horizontal half-swing of the
wiggle), `ARPEGGIO_PERIOD` (vertical wavelength), `ARPEGGIO_GAP` (the gap placed
outside the accidentals), `ARPEGGIO_FIXED_GAP` (the fixed left gap when there are
no accidentals — large enough to clear `NOTEHEAD_RX` plus the swing), and
`ARPEGGIO_ARROW_SIZE`.

**Confirmed supporting facts (independently verified):**

- **A.** `event` is in scope at the per-note push, and the rest branch returns
  early before the arpeggio code, so arpeggio-on-a-rest is inert *structurally*
  (no guard) — confirmed.
- **B.** `glyphs.js`'s own header states that ties, slurs, stems, beams, ledger
  lines, and barlines "are never glyphs in any strategy" and are drawn as raw
  emit-layer primitives. The arpeggio wiggle belongs to exactly that family, so it
  is a raw `svg.js` primitive — **`glyphs.js` and the music font are not touched**
  — confirmed.
- **C.** Every emitted primitive carries a `data-*` hook (`data-accidental`
  `svg.js:753`, `data-dot` `762`, `data-stem` `788`, `data-flag` `805`,
  `data-notehead` `738`, and `data-span="tie|slur|…"` `989`). The arpeggio group
  carries the direction *as the value* of a single attribute,
  `data-arpeggio="up|down|nondirectional"` — exactly the `data-span=kind`
  precedent (`svg.js:989`, `1014`). One attribute carries both presence and value,
  so `svg.test.js` can assert `querySelector('[data-arpeggio="up"]')`. The rest
  case is asserted by the absence of any `[data-arpeggio]` node on the rest group.
  (Q5 refines this into a nested group — `[data-arpeggio-wiggle]` for the line and
  `[data-arpeggio-arrow]` for the arrowhead — so the arrowhead's presence/absence
  is a single `querySelector` rather than inferred from the direction value.)

**Net data flow, layout → svg:** one new record field
`note.arpeggio = { dx, topY, bottomY, direction }`; one new constant block read in
layout; in svg one new `renderArpeggio` function, one `wigglePathD` helper, and
one guarded call line in `renderNote`. No event threading, no span-resolution
pass, no font or glyph change.

### Q2 — Schema and validation hook: the enum, and "never blocks saving"

The data-model field is settled (a single optional `arpeggio` enum on the event).
The design question is how it hooks into the schema and validator, and — the one
subtlety worth pinning down — how the spec's "an out-of-vocabulary value is
flagged informationally but never blocks saving" is actually realized, given that
the visual editor's commit guard *refuses* a non-conformant string.

**Decision — add one enum line to the schema; change nothing else.** The field is
declared on the event `$def` beside `dynamic`:
`arpeggio: { enum: ["up", "down", "nondirectional"] }` (`schema.js:162`). That one
line is the **entire** validation change. The zero-dependency walker handles it
automatically: `validateObject` recurses every declared property that is present
(`validate.js:191-198`), and `validateValue` runs the generic closed-enum check —
flag an out-of-vocabulary value with an informational message and stop
(`validate.js:120-128`). No new walker code, **no `validate.js` edits**. A bad
value (e.g. `"sideways"`) is a non-structural enum error: the song still parses
and stays editable; it is not routed to the invalid-state surface (only a JSON
parse failure or a missing required structure is).

**How "never blocks saving" is realized — two distinct save paths.** This is the
one place a naive implementation could go wrong, so the topology is recorded
explicitly. The editor has two surfaces (`edit.js`), and an out-of-vocabulary
arpeggio value can only originate on the one that is non-blocking by construction:

- **Visual editor (conformant by construction).** Edits route through
  `commit = (nextWorking) => commitSong(nextWorking, onChangeSong)`
  (`edit.js:185`). `commitSong` serializes, runs `validateSong`, and on any error
  logs a developer warning and returns *without* persisting
  (`serializeSong.js:40-53`). But this refusal is documented as "unreachable in
  normal operation" (`serializeSong.js:1-12, 44-45`): the controls only ever emit
  conformant values, and the arpeggio dropdown offers only the empty `NONE_OPTION`
  or the three enum values, so it **cannot** produce `"sideways"`. The refusal is a
  safety net against a latent control bug, never a gate the author hits.
- **Raw-JSON editor (genuinely non-blocking).** JSON mode renders a
  `TextareaControl` whose `onChange` is `onChangeSong = (next) => setAttributes({
  song: next })` (`edit.js:528-541`, `edit.js:147`) — it writes the raw string
  **straight to the block attribute**, bypassing `serializeSong`/`commitSong`/
  `validateSong` entirely. A hand-typed `"sideways"` therefore persists verbatim.
  Validation is surfaced **purely informationally**: the errors render as a
  non-dismissible `<Notice>` list below the textarea (`edit.js:542-552`), display
  only, never gating the save. The textarea's own help text states the contract
  verbatim: *"Validation is informational and never blocks saving."*
  (`edit.js:533`).

**Consequence for the design:** the acceptance criterion is satisfied by the
*existing* architecture. The schema enum line produces the informational message;
the raw path already never blocks. The design must therefore **not** add any
arpeggio-specific blocking, gate, or special-case anywhere — doing so would be the
one way to break the requirement.

**Round-trip is verbatim.** Raw mode writes the author's exact bytes to the
attribute (`edit.js:147, 537`); the schema is additive and never rewrites
(`schema.js:9-11`). The only canonicalizer is `serializeSong`'s plain
`JSON.stringify` (`serializeSong.js:27-28`), which runs only on a visual-mode
commit and preserves every present key's *value* (only whitespace and key order
may change, explicitly accepted by the `serializeSong` header). There is no sort,
filter, or field allowlist anywhere, so the `arpeggio` value survives a
round-trip unchanged.

**Net delta for Q2:** one schema enum line, plus one `songModel`-vs-schema
cross-check test (mirroring `ARPEGGIO` against
`schema.$defs.event.properties.arpeggio.enum`, following the `SPAN_STATES` pattern
at `songModel.test.js:100-106`). Zero `validate.js` changes; zero save-path code.

### Q3 — Editor control: shape, wiring, the clear paths, and rest behavior

The control reuses the `dynamic` pattern almost verbatim; the design value is in
pinning down the exact wiring and, above all, every place that must clear the key.

**Decision — control shape: a standalone `ToolsPanelItem`, modelled on `dynamic`,
not folded into the span group.** The selected event's "Note details" panel
(`NotePanel.js`) discloses its optional members through a `ToolsPanel`. The four
span fields (`tie`/`slur`/`crescendo`/`decrescendo`) are rendered from a local
`SPAN_FIELDS` list (`NotePanel.js:56-62`, mapped at `207-223`) because they share
the `start`/`stop` vocabulary (`SPAN_STATES`). An arpeggio is **not** a span — it
is a point enum with its own three-value vocabulary — so folding it into
`SPAN_FIELDS` would force the wrong option list and muddy a grouping whose whole
meaning is "the four start/stop spans." Instead it is a standalone
`ToolsPanelItem`, an exact structural mirror of the `dynamic` item
(`NotePanel.js:192-205`), placed as a sibling after the dynamic item and before
the `SPAN_FIELDS.map`:

- `label = __("Arpeggio", "piano-block")`
- `hasValue = () => Boolean(event.arpeggio)`
- `onDeselect = () => changeOptional("arpeggio", "")`
- a `SelectControl` with `value={event.arpeggio ?? ""}`,
  `options={[NONE_OPTION, ...ARPEGGIO]}`,
  `onChange={(value) => changeOptional("arpeggio", value)}`.

**Decision — three clear paths, all of which must drop the key.** `changeOptional`
runs `omitFalsy` (`NotePanel.js:126-128`), which trims a string value and
`delete`s the key when it is empty (`emit.js:48-57`). Three distinct user actions
must each clear the field, and all three resolve to the same key-drop:

1. **Picking "None" in the dropdown** → `changeOptional("arpeggio", "")` → key
   dropped.
2. **The item's `onDeselect`** (the per-item reset control) →
   `changeOptional("arpeggio", "")` → key dropped.
3. **`ToolsPanel` reset-all** (`NotePanel.js:158-172`) — this is a **required
   edit** and the one easy-to-miss spot. `resetAll` destructures the disclosed
   optionals out and emits the rest (`{ dots, dynamic, tie, slur, crescendo,
   decrescendo, annotations, ...kept }`). `arpeggio` must be added to that
   destructure (`arpeggio: _arpeggio`, following the repo's `_`-prefix convention
   for intentionally unused destructured bindings); if it is omitted, reset-all
   would leave the arpeggio behind, contradicting its purpose. This is the only
   edit beyond the item itself.

**Decision — the option list lives in `songModel.js`.** A new `ARPEGGIO` list
beside `DYNAMICS` (`songModel.js:53`):

```
export const ARPEGGIO = [
  { label: __("Up", "piano-block"), value: "up" },
  { label: __("Down", "piano-block"), value: "down" },
  { label: __("Nondirectional", "piano-block"), value: "nondirectional" },
];
```

Labels are title-case English wrapped in `__()`, matching the word-token lists
`DURATIONS`/`CLEFS`/`BARLINES`. (`DYNAMICS` uses bare unwrapped values only because
they are musical symbols such as `pp`/`mf`; word tokens follow the i18n title-case
style.) `NONE_OPTION` is prepended at the control (`[NONE_OPTION, ...ARPEGGIO]`),
not stored in the list — exactly as `dynamic` does (`NotePanel.js:200`). Existing
values pre-select for free, since `value={event.arpeggio ?? ""}` reads the working
object.

**Decision — rest behavior: show the control, render inert, with no new code.**
`NotePanel` gates only `PitchList` on `event.type === "note"`
(`NotePanel.js:148-154`); the `ToolsPanel` and all its items are rendered
unconditionally. So the arpeggio item shows for a rest automatically, the value is
storable on a rest, and — because a rest returns early in `layoutHand` before any
note record is built (Q1, fact A) — it has no rendered effect. No type gate is
added: that would be a first-of-its-kind negative condition against the grain, and
the spec explicitly chose show-but-inert (R10) over hide-on-rest.

**Net delta for Q3:** `songModel.js` gains the `ARPEGGIO` list (plus its
cross-check test); `NotePanel.js` gains one `ToolsPanelItem` and the one-word
`arpeggio` addition to the reset-all destructure. Nothing else.

### Q4 — Render edge cases (the acceptance edges) and render parity

The render approach is fixed (Q1). This question hardens the geometry against the
specific edges the spec calls out, so they become well-understood acceptance
criteria rather than silent assumptions. The two non-trivial ones are the
accidental-extent math and the constant sizing; the rest confirm cheaply.

**The placement-left rule, and the two constants that must budget glyph/ledger
width.** The arpeggio's `dx` is `accidentals.length ? max(acc.dx) + ARPEGGIO_GAP :
ARPEGGIO_FIXED_GAP`. Two facts make this correct but constrain the constants:

- **`max(acc.dx)` is the true leftmost accidental — confirmed monotonic.** Each
  accidental's `dx = ACCIDENTAL_GAP + column * ACCIDENTAL_COL_STEP` is strictly
  increasing in column (both terms positive), so the furthest-left accidental
  always has the largest `dx`. A live four-sharp cluster placed columns at
  `dx = 1.20, 2.50, 3.80, 5.10`; `max` is the column-3 value, the leftmost. There
  is no case where a higher column has a smaller `dx`. So taking the max is the
  right leftmost extent.
- **`acc.dx` is a glyph *center*, so `ARPEGGIO_GAP` must clear the glyph's
  half-width.** The accidental is drawn `fontGlyph(acc.glyph, note.x - acc.dx,
  acc.y)` with `text-anchor: "middle"` (`svg.js:751`, `fontGlyph` default anchor
  `svg.js:137`), so its ink extends roughly ±half-glyph-width *around* that center.
  The leftmost ink edge is `note.x - (max_dx + halfGlyphWidth)`. `ARPEGGIO_GAP`
  therefore has to exceed the accidental's half-width plus a clearance, not merely
  separate the centers. This is the same tuned-constant approach the codebase
  already uses: `ACCIDENTAL_GAP`'s own comment (`constants.js:148-153`) says it
  already budgets "the notehead plus the glyph's own half-width." Glyph half-width
  is not a measured metric anywhere in the codebase — the house style is a tuned
  gap that bakes it in — so `ARPEGGIO_GAP` is likewise a tuned constant (on the
  order of `~0.6–0.8` sp), not a computed value.
- **`ARPEGGIO_FIXED_GAP` (no accidentals) must clear the ledger half-width.** A
  ledger line is drawn `note.x ± LEDGER_WIDTH/2 = note.x ± 1`
  (`svg.js:712-718`, `LEDGER_WIDTH = 2`, `layout.js:165-189`). The arpeggio sits at
  `note.x - dx`, and with no accidentals `dx = ARPEGGIO_FIXED_GAP`. For the wiggle
  to stay left of the ledger's left edge (`note.x - 1`), `ARPEGGIO_FIXED_GAP` must
  be `>= LEDGER_WIDTH/2 (= 1.0)` plus a clearance for the wiggle's own swing
  (`ARPEGGIO_AMPLITUDE`). A value of `~1.4` satisfies this. Since `dx` is always
  `>= ARPEGGIO_FIXED_GAP > 1`, the arpeggio is always left of the ledger — the
  ledger collision is ruled out, with or without accidentals.

This also keeps the line clear of stems (a stem-down stem is at `note.x −
NOTEHEAD_RX`, still right of the wiggle) and of every other decoration, which all
occupy other regions (dots to the right, tie/slur arcs in the above/below bands,
dynamics/hairpins in the below-staff lane). The schema has no
`oneOf`/`allOf`/`not`, so the fields are fully independent and combine freely.

**Single-pitch (R5) renders without error.** `topStep == bottomStep` ⇒
`topY == bottomY` ⇒ height 0 ⇒ `wigglePathD` clamps to `n = max(1, 0) = 1`, a
single degenerate bump. There is no division by zero (the only division is by `n`,
which is `>= 1`), and the path is a tiny one-notehead squiggle. The spec accepts
this explicitly ("a one-note roll is musically trivial"). (Optional polish: floor
the drawn height to about one notehead so it reads more clearly; not required by
the spec, a free design call for the plan/code phase.)

**Tall chord (R6) just tiles more bumps.** `n` scales linearly with the head
span; a five-octave chord (~17.5 sp) yields ~35 segments in one `<path>`. There is
no upper bound, no clipping (the system margins already grow to hold high/low
ledgers, and the wiggle lives within the chord's own head span, inside that
envelope), and no performance concern (the d-string is built once per arpeggiated
note at layout/emit time, not per frame).

**Render parity (R8) is architecturally guaranteed — not a per-surface test.**
Both surfaces call the identical notation core: `view.js` (front end) imports and
calls `buildLayoutModel` → `renderInto`, and `SongCanvas.js:117-120` (editor)
imports the same two and calls them identically (its docstring is explicit:
"reuses the very same notation-core render path"). The only editor-side extra is a
post-draw `is-selected` CSS class — a pure highlight, no notation difference. The
arpeggio lives entirely in the shared `layout.js`/`svg.js` layer, so it appears on
both automatically; there is no surface-specific render branch that could diverge.
Consequently a single `svg.test.js` exercising the shared render function covers
the output for both surfaces — a separate parity test would only assert that two
imports resolve to the same module, which is low value. The shared-codepath
structure *is* the guarantee.

**Constant constraints carried into the plan/code phase:** `ARPEGGIO_GAP` sized to
clear the accidental glyph half-width (~`>= 0.6`); `ARPEGGIO_FIXED_GAP` sized to
clear the ledger half-width plus the wiggle amplitude (~`>= 1.4`); both tuned in
the spirit of `ACCIDENTAL_GAP`. A layout unit test should assert the arpeggio `dx`
is strictly greater than `max(acc.dx)` when accidentals are present, and
`>= LEDGER_WIDTH/2` when they are not.

**The emitted DOM structure (refines Q1's `data-arpeggio` hook).** The arpeggio is
emitted as a nested group so that the wiggle and the arrowhead are independently
locatable, which makes the per-direction assertions a single `querySelector`:

```
<g data-arpeggio="up|down|nondirectional">     ← wrapper; value = direction
  <path data-arpeggio-wiggle … />              ← the wiggle, always present
  <g data-arpeggio-arrow …>…</g>               ← the arrowhead, only for up/down
</g>
```

The wiggle is always present; the arrowhead group is present only for `up`/`down`
and absent for `nondirectional`. This is cleaner than counting `<line>` children
(which would couple the test to the arrowhead being exactly two lines): presence
and absence become one `querySelector('[data-arpeggio-arrow]')`, and direction is
one attribute read on the wrapper.

### Q5 — Test strategy

The feature is testable at two tiers the repo already runs: jest unit tests
(`src/**/__tests__/`) and Playwright + `wp-env` end-to-end tests (`specs/`,
`npm run test:e2e`, `@wordpress/e2e-test-utils-playwright`). Every test below has a
direct precedent in the existing suite, so the strategy is "mirror the nearest
existing test," not invent a new harness. The decision is *what* to test where; the
plan phase turns it into tasks.

**Unit tests (jest), file by file.**

- **`src/song/__tests__/schema.test.js`** — assert the field is declared as the
  closed enum: `expect(songSchema.$defs.event.properties.arpeggio).toEqual({ enum:
  ["up", "down", "nondirectional"] })`. Precedent: the byte-for-byte
  `crescendo`/`decrescendo` enum assertions (`schema.test.js:27-32`).
- **`src/song/__tests__/validate.test.js`** — (a) in the "conformant songs"
  describe (`validate.test.js:174`), a song carrying `arpeggio: "up"` (and `down`,
  `nondirectional`) validates to `[]`; (b) in the "closed-enum errors" describe
  (`validate.test.js:282`), `arpeggio: "sideways"` is flagged with its path and
  value (`some(e => /arpeggio/.test(e) && /sideways/.test(e))`) while the song
  still parses (the validator returns messages, never throws). Precedent: the
  `dynamic: "mezzo"` (`:307-316`) and `crescendo` out-of-set (`:353`) cases. Also
  add `arpeggio: "up"` to one chord of the comprehensive full-song fixture
  (`:53`), the way `dynamic: "mf"` already rides it.
- **`src/editor/__tests__/songModel.test.js`** — a `values(ARPEGGIO)` vs
  `songSchema.$defs.event.properties.arpeggio.enum` cross-check (so the option list
  and the schema cannot drift), and adding `ARPEGGIO` to the "every option has a
  non-empty label and a member value" sweep. Precedent: the `SPAN_STATES`
  cross-check (`songModel.test.js:100-106`) and the sweep (`:124-135`).
- **`src/editor/__tests__/NotePanel.test.js`** — three tests: (a) setting the
  arpeggio writes the key and picking "None" drops it (assert
  `calls.at(-1)…rightHand[0].arpeggio`), mirroring the `dynamic`/`tie` set-and-drop
  tests (`:237-265`); (b) the control shows for a rest, mirroring the rest test
  (`:301-318`); (c) reset-all clears the arpeggio — the one test that catches the
  reset-all destructure bug (omitting `arpeggio: _arpeggio` would silently leave it
  behind), a high-value regression guard.
- **`src/notation/__tests__/layout.test.js`** — via `buildLayoutModel`: an
  arpeggiated note carries `note.arpeggio = { dx, topY, bottomY, direction }`; `dx`
  is strictly greater than `max(acc.dx)` with accidentals and `>= LEDGER_WIDTH/2`
  without; a single-pitch note gives `topY == bottomY` and does not throw; a
  non-arpeggiated note has no `note.arpeggio`, and a rest is absent from `notes[]`
  entirely. Plus a **direct unit test of `wigglePathD`** as a pure, deterministic
  string function — the bump count `n = max(1, round(height / (period / 2)))`, the
  `n = 1` clamp at height 0, the start/end coordinates, and "a taller span yields
  more `Q` segments." Precedent: `stackAccidentals` is unit-tested directly
  (`layout.test.js:667-696`) alongside `buildLayoutModel` integration. (If the
  left-offset is factored into an `arpeggioDx(accidentals)` helper, unit-test it
  too; if inline, the `buildLayoutModel` assertions cover it.)
- **`src/notation/__tests__/svg.test.js`** — render, then assert against the nested
  DOM hook: `up` ⇒ `[data-arpeggio="up"]` exists and contains `[data-arpeggio-arrow]`
  (arrow near `topY`); `down` ⇒ likewise with the arrow near `bottomY`;
  `nondirectional` ⇒ `[data-arpeggio="nondirectional"]` exists but
  `[data-arpeggio-arrow]` is absent; a rest with an arpeggio set ⇒ no
  `[data-arpeggio]` node at all; the wiggle is a `<path>` (`[data-arpeggio-wiggle]`
  `tagName === "path"`). Precedent: the `data-*` querySelector assertions
  (`svg.test.js:136, 310-314, 407-408`).
- **Combined markings (AC7) — make it explicit.** A layout/svg test on a chord
  carrying `arpeggio` together with `tie`, `dots`, and `dynamic`: all of their
  `data-*` nodes are present, and the arpeggio sits left of the accidentals. This
  AC is easy to forget, so it is called out as its own test.

**End-to-end tests (Playwright + `wp-env`).** Some acceptance criteria are best
proven on the real surfaces, since they exercise the save-path topology and the
two-surface render that unit tests cannot reach. All three are thin clones of
existing e2e tests:

- **Front-end render (`specs/render.spec.js`).** Publish a post whose song has
  `arpeggio: "up"` on a chord; assert the published `blockSvg` contains
  `[data-arpeggio="up"]` and `[data-arpeggio-arrow]`, and that a `nondirectional`
  arpeggio has no arrow. This proves AC3/AC4 on the real front end (the same
  `data-*`-locator style the existing render tests use, e.g. `[data-notehead]`,
  `[data-text="annotation"]`).
- **Editor authoring (`specs/editor.spec.js`).** Select a note, set the "Arpeggio"
  `SelectControl` (`getByLabel("Arpeggio")`) to "Up", and assert the stored song
  carries `arpeggio: "up"` and the canvas SVG shows it; set "None" and assert the
  key is gone (AC8). Precedent: the existing dynamic/language authoring tests.
- **Never-blocks / round-trip (`specs/editor.spec.js`).** Clone the existing
  "round-trips through JSON mode and never blocks saving" language test
  (`editor.spec.js:901`) with a raw `arpeggio: "sideways"`: the song still saves
  (AC2's "never blocks" half) and a valid value round-trips unchanged (AC1).

**Acceptance-criteria coverage map.** AC1 → validate accept + e2e round-trip;
AC2 → validate flags + e2e never-blocks; AC3 → layout geometry + svg DOM;
AC4 → architecturally guaranteed (one codepath) + one front-end e2e; AC5 → layout
single-pitch + svg; AC6 → validate/panel accept + svg no-node; AC7 → the explicit
combined-markings test; AC8 → NotePanel unit + editor e2e. The three e2e clones
close the gaps unit tests cannot (the save-path "never blocks," the real
round-trip, and the real-front-end render).

## Design summary

The feature is a small, additive change that rides existing patterns end to end;
the only new code of substance is the wavy-line primitive.

- **Data model / validation.** One optional `arpeggio` enum
  (`"up" | "down" | "nondirectional"`) on the event `$def`, beside `dynamic`
  (`schema.js:162`). The generic enum walker covers it — zero `validate.js`
  changes. "Never blocks saving" is satisfied by the existing two-save-path
  topology (raw mode writes the attribute directly; visual mode is conformant by
  construction); the design adds no blocking anywhere.
- **Editor.** One standalone `ToolsPanelItem` in `NotePanel`, a structural mirror
  of the `dynamic` control, plus an `ARPEGGIO` option list in `songModel.js` and a
  one-word addition to the reset-all destructure. The control shows for a rest
  (show-but-inert), and existing values pre-select for free.
- **Render.** The geometry is a per-note decoration computed in the layout layer
  (`note.arpeggio = { dx, topY, bottomY, direction }`, beside the accidental/dot
  records), with `dx` placed outside any accidentals and clear of the ledger; it is
  drawn inside `renderNote` by a new `renderArpeggio` using a new `wigglePathD`
  d-string builder and a two-`<line>` arrowhead, emitted as a nested
  `data-arpeggio` group. No font or glyph change. New tuned constants live beside
  the hairpin block in `constants.js`. Render parity is automatic — both surfaces
  share `buildLayoutModel` → `renderInto`.
- **Tests.** Unit tests across schema/validate/songModel/NotePanel/layout/svg
  (including a direct `wigglePathD` test and an explicit combined-markings test),
  plus three thin e2e clones for the front-end render, the editor authoring, and
  the never-blocks/round-trip behaviors.

**Net change surface:** `schema.js` (+1 enum line), `songModel.js` (+`ARPEGGIO`
list), `NotePanel.js` (+1 `ToolsPanelItem`, +1 reset-all destructure word),
`constants.js` (+arpeggio constants), `layout.js` (+`note.arpeggio` record),
`svg.js` (+`renderArpeggio` + `wigglePathD` + one call in `renderNote`), and the
corresponding unit and e2e tests. No changes to `validate.js`, `glyphs.js`, the
music font, or any save path.
