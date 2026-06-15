# Design doc — Support arpeggios with direction

## Overview

A chord in the piano block can be marked as **arpeggiated** (a "rolled" chord),
and that marking can carry a **direction**. In notation, an arpeggio is drawn as
a vertical wavy line to the left of the chord's noteheads, with an arrowhead that
shows the roll direction: upward, downward, or none (a plain, undirected roll).

This feature adds one optional, per-chord marking to the song format, an editor
control to set it, and the rendered wavy-line glyph. It is deliberately small:
the data model, authoring path, and validation all reuse existing patterns
almost verbatim. The only genuinely new code is the wavy-line SVG primitive.

The approach is shaped by one structural observation: **an arpeggio is a property
of a single chord, with nothing to resolve across events.** That makes it a
*per-event decoration* (like an accidental or an augmentation dot), not a
*cross-event span* (like a tie, slur, or hairpin). Every layered decision below
follows from that classification.

The change touches seven source areas, all additively:

- `src/song/schema.js` — one enum line declaring the `arpeggio` field.
- `src/editor/songModel.js` — an `ARPEGGIO` option list for the control.
- `src/editor/inspector/NotePanel.js` — one `ToolsPanelItem` plus one word in
  the reset-all destructure.
- `src/notation/constants.js` — the arpeggio sizing/placement constants.
- `src/notation/layout.js` — a `note.arpeggio` record on the per-note layout.
- `src/notation/svg.js` — a `renderArpeggio` emitter and a `wigglePathD` helper,
  drawn from inside `renderNote`.
- The corresponding unit and end-to-end tests.

There are **no** changes to `validate.js`, to the music font / `glyphs.js`, or to
any save path. Why each of those holds is the substance of this document.

## Data model

A single optional `arpeggio` field on the event object, a closed enum:

```
arpeggio: "up" | "down" | "nondirectional"
```

**Absence is the only "not arpeggiated" state.** When the field is absent, the
chord is not arpeggiated. When present, the chord is arpeggiated and the value is
the direction. There is no separate "off" value or sentinel — this mirrors every
other optional marking in the format, and in particular mirrors `dynamic`, which
is likewise a single-value point enum on the event (`schema.js:162`) rather than
a `start`/`stop` span pair like `tie`/`slur`/`crescendo`/`decrescendo`
(`schema.js:167-170`).

The vocabulary semantics (from the spec, R2):

- **up** — the chord rolls bottom-to-top, drawn with an upward arrowhead;
- **down** — the chord rolls top-to-bottom, drawn with a downward arrowhead;
- **nondirectional** — a plain wavy line with no arrowhead (an undirected roll).

The field is independent of every other per-event marking. The event schema has
no `oneOf`/`allOf`/`not` across these properties, so `arpeggio` combines freely
with `tie`, `slur`, `dynamic`, `dots`, `crescendo`, `decrescendo`, and
annotations (spec R7), each rendering in its own region of the chord.

## Validation

### The schema change is one line

The field is declared on the event `$def` beside `dynamic`:

```js
arpeggio: { enum: ["up", "down", "nondirectional"] }
```

placed at `schema.js:162` (the `dynamic` line). That single enum declaration is
the **entire** validation change.

**No `validate.js` edit is needed.** The validator is a zero-dependency schema
walker. `validateObject` already recurses into every declared property that is
present on an object, and `validateValue` already runs a generic closed-enum
check: an out-of-vocabulary value is flagged with an informational message and
the walk stops at that node. Declaring `arpeggio` as an `enum` therefore makes
the walker validate it automatically — there is no new walker branch to write.

A bad value (for example `"sideways"`) is a *non-structural* enum error: the
song still parses and stays editable, and it is not routed to the editor's
invalid-state surface. Only a JSON parse failure or a missing required structure
reaches that surface; a closed-enum violation does not.

### How "never blocks saving" holds — the save-path topology

The spec requires (R12, AC2) that an out-of-vocabulary arpeggio value is flagged
*informationally only* and **never blocks saving**. This is the one place a naive
implementation could go wrong, so the topology is recorded explicitly. The
editor has two distinct save paths, and an out-of-vocabulary value can only
originate on the one that is non-blocking by construction.

- **Visual editor — conformant by construction.** Edits made through the
  inspector controls route through a commit path (`commit → commitSong →
  validateSong`) that, on any validation error, logs a developer warning and
  returns *without* persisting. That refusal exists as a safety net against a
  latent control bug; it is documented as unreachable in normal operation. The
  arpeggio dropdown offers only the empty "None" option and the three enum
  values, so it **cannot** emit `"sideways"`. The author never hits this gate.

- **Raw-JSON editor — genuinely non-blocking.** JSON mode renders a textarea
  whose `onChange` writes the raw string **straight to the block attribute**,
  bypassing the serialize/commit/validate path entirely. A hand-typed
  `"sideways"` therefore persists verbatim. Validation runs purely
  informationally: errors render as a non-dismissible notice list below the
  textarea, display-only, never gating the save. The textarea's own help text
  states the contract: *"Validation is informational and never blocks saving."*

**Consequence for this design:** the acceptance criterion is satisfied by the
*existing* architecture. The schema enum line produces the informational
message; the raw path already never blocks. The design must therefore **not**
add any arpeggio-specific blocking, gate, or special case anywhere — doing so
would be the single way to break the requirement. "Never blocks saving" is held
by topology, not by new code.

### Round-trip is verbatim

The arpeggio value survives raw-data editing unchanged (spec R11, AC1). Raw mode
writes the author's exact bytes to the attribute. The schema is additive and
never rewrites data. The only canonicalizer anywhere is the visual-mode
serializer's plain `JSON.stringify`, which runs only on a visual-mode commit and
preserves every present key's value (it may reorder keys or normalize whitespace,
which the serializer explicitly accepts). There is no sort, filter, or field
allowlist, so an `arpeggio` value round-trips byte-for-byte by value.

## Editor

### The control: a standalone `ToolsPanelItem`, modeled on `dynamic`

The selected event's "Note details" panel (`NotePanel.js`) discloses its optional
members through a `ToolsPanel`. The four span fields
(`tie`/`slur`/`crescendo`/`decrescendo`) are rendered from a local `SPAN_FIELDS`
list, mapped at `NotePanel.js:207-223`, because they all share the `start`/`stop`
vocabulary.

An arpeggio is **not** a span — it is a point enum with its own three-value
vocabulary. Folding it into `SPAN_FIELDS` would force the wrong option list and
muddy a grouping whose entire meaning is "the four start/stop spans." So the
arpeggio is a **standalone `ToolsPanelItem`**, an exact structural mirror of the
`dynamic` item (`NotePanel.js:192-205`), placed as a sibling after the dynamic
item and before the `SPAN_FIELDS.map`:

```jsx
<ToolsPanelItem
  label={__("Arpeggio", "piano-block")}
  hasValue={() => Boolean(event.arpeggio)}
  onDeselect={() => changeOptional("arpeggio", "")}
>
  <SelectControl
    label={__("Arpeggio", "piano-block")}
    value={event.arpeggio ?? ""}
    options={[NONE_OPTION, ...ARPEGGIO]}
    onChange={(value) => changeOptional("arpeggio", value)}
    __nextHasNoMarginBottom
    __next40pxDefaultSize
  />
</ToolsPanelItem>
```

The control offers **None / Up / Down / Nondirectional** (spec R9). An existing
arpeggio value pre-selects for free, because `value={event.arpeggio ?? ""}` reads
the live working object (AC8).

### The option list lives in `songModel.js`

A new `ARPEGGIO` list beside `DYNAMICS`:

```js
export const ARPEGGIO = [
  { label: __("Up", "piano-block"), value: "up" },
  { label: __("Down", "piano-block"), value: "down" },
  { label: __("Nondirectional", "piano-block"), value: "nondirectional" },
];
```

Labels are title-case English wrapped in `__()`, matching the word-token lists
`DURATIONS`/`CLEFS`/`BARLINES`. (`DYNAMICS` uses bare unwrapped values only
because those are musical symbols such as `pp`/`mf`; word tokens follow the i18n
title-case style.) The empty `NONE_OPTION` is prepended at the control
(`[NONE_OPTION, ...ARPEGGIO]`), not stored in the list — exactly as `dynamic`
does.

### Three clear paths — all must drop the key

`changeOptional` runs an `omitFalsy` step that trims a string value and *deletes*
the key when it is empty. Three distinct user actions each clear the field, and
all three must resolve to the same key-drop:

1. **Picking "None" in the dropdown** → `changeOptional("arpeggio", "")` → key
   dropped.
2. **The item's `onDeselect`** (the per-item reset control) →
   `changeOptional("arpeggio", "")` → key dropped.
3. **The `ToolsPanel` reset-all** (`NotePanel.js:158-172`) — **the one
   easy-to-miss spot.** `resetAll` works by destructuring the disclosed optionals
   out of the event and emitting the rest:

   ```js
   const {
     dots: _dots,
     dynamic: _dynamic,
     tie: _tie,
     slur: _slur,
     crescendo: _crescendo,
     decrescendo: _decrescendo,
     annotations: _annotations,
     ...kept
   } = event;
   emitEvent(kept);
   ```

   `arpeggio` **must** be added to this destructure (`arpeggio: _arpeggio`,
   following the repo's `_`-prefix convention for intentionally unused bindings).
   If it is omitted, reset-all would silently leave the arpeggio behind,
   contradicting its purpose. This one word is the only edit beyond the item
   itself, and it is worth an explicit regression test.

### Rest behavior: show the control, render inert — no new code

The panel gates only the pitch list on `event.type === "note"`; the `ToolsPanel`
and all its items render unconditionally. So the arpeggio item **shows for a
rest automatically**, a value is storable on a rest, and — because a rest returns
early in the layout pass before any note record is built (see Rendering, below) —
it has **no rendered effect** on a rest. No type gate is added. A hide-on-rest
gate would be a first-of-its-kind negative condition against the grain of the
panel, and the spec deliberately chose show-but-inert (R10) over hide-on-rest.

## Rendering

### Classification: per-event decoration, not a cross-event span

The codebase has two distinct rendering shapes, and choosing between them is the
heart of the render design:

- **Per-event decorations** — accidentals, ledger lines, augmentation dots. Each
  is anchored to one chord's own geometry, computed when that chord's layout
  record is built (in `layoutHand`, the per-note `notes.push({...})` at
  `layout.js:1542-1560`), and drawn inside `renderNote` (`svg.js:704-768`), which
  iterates `note.ledgers`, `note.heads`, `note.accidentals`, and `note.dotSpecs`,
  each anchored to `note.x`.
- **Cross-event spans** — ties, slurs, crescendos, decrescendos. Each is a
  `start`/`stop` pair that must be *resolved across two events*, then drawn in a
  separate system-level pass (`renderSpan` for tie/slur, `renderHairpin` for the
  wedges), not inside `renderNote`.

An arpeggio belongs to **one** chord and has nothing to resolve across events. It
is therefore a per-event decoration, structurally like an accidental. Both the
geometry-computation location and the drawing location follow from that.

### Geometry is computed in the layout layer

A new field is built on the per-note record, alongside `accidentals` / `ledgers`
/ `dotSpecs` at `layout.js:1542-1560`:

```js
note.arpeggio = { dx, topY, bottomY, direction }
```

The layout layer owns all four quantities. This respects the codebase's
layering rule — the layout layer owns positioning math; the SVG layer is a dumb
emit layer that "never touches pixels."

- **`dx` — how far left.** The wavy line must sit *outside* (further left than)
  any accidentals on the chord (spec R4). The accidentals are already
  column-stacked into `note.accidentals`, each carrying
  `acc.dx = ACCIDENTAL_GAP + column * ACCIDENTAL_COL_STEP`, and that array is
  computed *before* the per-note record is pushed (`layout.js:1518`), so the data
  is in hand. The rule is:

  ```
  arpeggioDx = accidentals.length
    ? max(acc.dx) + ARPEGGIO_GAP
    : ARPEGGIO_FIXED_GAP
  ```

  `max(acc.dx)` is the true leftmost accidental: each `dx` is strictly increasing
  in column (both terms positive), so the furthest-left accidental always has the
  largest `dx`. Taking the max is therefore the correct leftmost extent.

  This rule also keeps the line clear of stems for free (spec R4): even a
  stem-down stem sits at `note.x - NOTEHEAD_RX`, still to the *right* of the
  left-side wiggle.

- **`topY` / `bottomY` — the vertical span.** `staffStepToY(s) = bottomLineY -
  s * 0.5`, and **Y grows downward** (`layout.js:148-150`). So the chord's
  *highest* notehead (`topStep`, `layout.js:1558`) maps to the *smallest* (most
  negative) Y, and the *lowest* notehead (`bottomStep`, `layout.js:1559`) maps to
  the largest Y:

  ```
  topY    = staffStepToY(topStep)
  bottomY = staffStepToY(bottomStep)
  ```

  These Ys are in the same `bottomLineY = 0` notehead frame as `heads[].y` and
  `accidentals[].y`, so the staff-bottom translate that the renderer applies to
  the whole note group re-anchors the arpeggio identically to every other
  notehead-frame decoration — no special handling needed.

- **`direction` — the enum.** A straight passthrough of `event.arpeggio` onto the
  record.

**Rest inertness falls out structurally — no guard.** The record is built only
when `event.arpeggio` is set and the chord has at least one notehead
(`positions.length > 0`). A rest returns early from the layout loop
(`layout.js:1482-1491`) *before* any of this code runs, so a rest never gets an
arpeggio record. The "no rendered effect on a rest" requirement (spec R10) is
satisfied with no special-case branch. `event` is already in scope at the push
(the loop is `list.forEach((event, idx) => …)`, and `event.duration` /
`event.pitches` are already read there), so reading `event.arpeggio` is trivial.

*Rejected alternative:* compute the geometry in `svg.js` from the raw
`topStep`/`bottomStep`. This would fork the accidental-extent logic out of the
layout layer (which already owns `dx` for every other left-side decoration) and
leak positioning math into the emit layer, against the layering rule. Keeping the
geometry in layout matches the existing accidental-stacking precedent exactly.

### Drawing is inside `renderNote`

`renderNote` (`svg.js:704-768`) already iterates the note's decoration arrays and
anchors each to `note.x`. The arpeggio joins that family with a single guarded
call near the accidental loop:

```js
if (note.arpeggio) g.appendChild(renderArpeggio(note.arpeggio, note.x));
```

`renderNote` reads the **record**, never the raw event (just as it reads
`note.accidentals`, not `event.pitches`), so no event object has to be threaded
into the emit layer — the one new record field is the entire data flow from
layout to SVG. Drawing inside the note's `<g>` also means the arpeggio inherits
that group's `data-hand` / `data-event-index` stamping, so it is
selectable/highlightable on the editor canvas like every other part of the note.

*Rejected alternative:* a separate system-level pass like `renderHairpin`. Those
passes exist *only* because spans resolve across events and must be iterated over
a resolved-span list. An arpeggio has nothing to resolve, so a separate pass
would add an unjustified second iteration over the notes and lose the free
per-note grouping.

### The wavy-line primitive

A repo-wide search for an existing wavy/zigzag/sine path generator finds none, so
the wiggle generator is new code — but small and idiomatic, reusing the existing
`<path>` / `<line>` idiom. No glyph, no font change. (`glyphs.js`'s own header
states that ties, slurs, stems, beams, ledger lines, and barlines "are never
glyphs in any strategy"; they are drawn as raw emit-layer primitives. The
arpeggio wiggle belongs to exactly that family.)

- **`wigglePathD(x, topY, bottomY, amplitude, period) → string`** — a pure
  d-string builder. It walks from `bottomY` up to `topY` in half-period steps,
  emitting a chain of quadratic bumps whose control point alternates left/right
  of `x` each step, so the line reads as a vertical wiggle. The bump count is
  derived from the span height:

  ```
  n = max(1, round((bottomY − topY) / (period / 2)))
  ```

  This makes the line **tile to whatever height the chord spans**:

  - **Tall chords (spec R6):** more bumps automatically. A five-octave chord
    (~17.5 sp) yields ~35 segments in one `<path>`. There is no upper bound and
    no clipping — the wiggle lives within the chord's own head span, inside the
    system envelope, which already grows to hold high/low ledgers — and no
    performance concern, since the d-string is built once per arpeggiated note at
    layout/emit time, not per frame.

  - **Single-pitch chords (spec R5):** `topStep == bottomStep` ⇒ `topY == bottomY`
    ⇒ height 0 ⇒ `n` clamps to `max(1, 0) = 1`, a single short bump. The only
    division is by `n` (always `>= 1`), so there is no division by zero. The
    result is a tiny one-notehead squiggle, which the spec accepts explicitly.
    (Optional polish, not required: floor the drawn height to about one notehead
    so it reads more clearly — a free call for the implementation phase.)

- **`renderArpeggio(arp, noteX) → <g data-arpeggio>`** — emits the wiggle as a
  `<path>` with `fill: "none"`, `stroke: INK`, `stroke-width: STEM_THICKNESS`
  (the same attributes as the tie/slur `renderSpan`), at `x = noteX − arp.dx`.
  The **arrowhead** is a pair of `<line>` strokes, branching on `arp.direction`
  the way `renderHairpin` branches on the span kind:

  - **up** → a "^" at the top end (`topY`);
  - **down** → a "v" at the bottom end (`bottomY`);
  - **nondirectional** → no arrowhead branch (path only — the cheapest case).

  Two `<line>`s match the hairpin precedent more closely than a single
  `<polygon>`/`<path>`, so that is the recommended form.

### Emitted DOM structure

The arpeggio is emitted as a **nested group**, so the wiggle and the arrowhead
are independently locatable. This makes the per-direction test assertions a
single `querySelector` rather than something inferred from a count of child
lines:

```html
<g data-arpeggio="up|down|nondirectional">   <!-- wrapper; value = direction -->
  <path data-arpeggio-wiggle … />            <!-- the wiggle, always present -->
  <g data-arpeggio-arrow …>…</g>             <!-- the arrowhead, only up/down -->
</g>
```

The wiggle is always present; the arrowhead group is present only for `up`/`down`
and absent for `nondirectional`. The direction is the *value* of a single
attribute on the wrapper (`data-arpeggio="up"`), exactly the `data-span=kind`
precedent the other markings already follow. The rest case is the absence of any
`[data-arpeggio]` node on the rest's group.

### Placement and constants

The placement-left rule (above) is correct but constrains two constants, because
positions in the codebase are *glyph centers*, not edges:

- **`ARPEGGIO_GAP` must clear the accidental's half-width.** An accidental is
  drawn with `text-anchor: "middle"` at `note.x - acc.dx`, so its ink extends
  roughly ±half-glyph-width *around* that center; the leftmost ink edge is at
  `note.x - (max_dx + halfGlyphWidth)`. Glyph half-width is not a measured metric
  anywhere in the codebase — the house style is a tuned gap that bakes it in (the
  existing `ACCIDENTAL_GAP` comment notes it already budgets "the notehead plus
  the glyph's own half-width"). So `ARPEGGIO_GAP` is likewise a **tuned**
  constant, sized to exceed the accidental half-width plus a clearance (on the
  order of `>= 0.6` sp), not a computed value.

- **`ARPEGGIO_FIXED_GAP` (no accidentals) must clear the ledger half-width.** A
  ledger line is drawn at `note.x ± LEDGER_WIDTH/2 = note.x ± 1`. With no
  accidentals the arpeggio sits at `note.x - ARPEGGIO_FIXED_GAP`; to stay left of
  the ledger's left edge (`note.x - 1`), `ARPEGGIO_FIXED_GAP` must be
  `>= LEDGER_WIDTH/2 (= 1.0)` plus a clearance for the wiggle's own swing
  (`ARPEGGIO_AMPLITUDE`). A value of `~1.4` satisfies this. Since `dx` is always
  `>= ARPEGGIO_FIXED_GAP > 1`, the arpeggio is always left of the ledger — with
  or without accidentals, the ledger collision is ruled out.

The full set of **new constants**, placed beside the hairpin block in
`constants.js`:

| Constant | Meaning |
| --- | --- |
| `ARPEGGIO_AMPLITUDE` | horizontal half-swing of the wiggle |
| `ARPEGGIO_PERIOD` | vertical wavelength (height of one bump) |
| `ARPEGGIO_GAP` | gap placed *outside* the accidentals |
| `ARPEGGIO_FIXED_GAP` | fixed left gap when there are no accidentals |
| `ARPEGGIO_ARROW_SIZE` | size of the arrowhead strokes |

Every other decoration occupies a different region, so the arpeggio collides with
nothing: dots sit to the right, tie/slur arcs in the above/below bands,
dynamics/hairpins in the below-staff lane, the stem to the right of the wiggle.
The schema's full independence of fields means they all combine freely (spec R7).

## Render parity

Both rendering surfaces are guaranteed to produce **identical** output (spec R8,
AC4), and this is an *architectural* guarantee, not something maintained by
per-surface tests:

- The published front end imports and calls `buildLayoutModel` → `renderInto`.
- The editor's notation canvas (`SongCanvas.js`) imports the **same two
  functions** and calls them identically — its docstring is explicit that it
  "reuses the very same notation-core render path."

The only editor-side extra is a post-draw `is-selected` CSS class, a pure
highlight that makes no notation difference. The arpeggio lives entirely in the
shared `layout.js` / `svg.js` core, so it appears on both surfaces automatically;
there is no surface-specific render branch that could diverge. Consequently a
single SVG-level test exercising the shared render function covers the output for
both surfaces. (One thin front-end e2e test still proves the real published
output, but the parity itself is held by the shared codepath, not by comparing
two renders.)

## Test strategy

The feature is tested at the two tiers the repo already runs: Jest unit tests
(`src/**/__tests__/`) and Playwright + `wp-env` end-to-end tests (`specs/`). Every
test below mirrors a nearest existing test rather than inventing a harness.

### Unit tests (Jest)

- **`src/song/__tests__/schema.test.js`** — assert the field is declared as the
  closed enum:
  `expect(songSchema.$defs.event.properties.arpeggio).toEqual({ enum: ["up",
  "down", "nondirectional"] })`. Mirrors the existing `crescendo`/`decrescendo`
  enum assertions.

- **`src/song/__tests__/validate.test.js`** — (a) in "conformant songs," a song
  carrying `arpeggio: "up"` (and `down`, `nondirectional`) validates to `[]`; (b)
  in "closed-enum errors," `arpeggio: "sideways"` is flagged with its path and
  value while the song still parses (the validator returns messages, never
  throws). Also add `arpeggio: "up"` to one chord of the comprehensive full-song
  fixture, the way `dynamic: "mf"` already rides it.

- **`src/editor/__tests__/songModel.test.js`** — a `values(ARPEGGIO)` vs
  `songSchema.$defs.event.properties.arpeggio.enum` cross-check (so the option
  list and the schema cannot drift), and add `ARPEGGIO` to the "every option has
  a non-empty label and a member value" sweep. Mirrors the `SPAN_STATES`
  cross-check.

- **`src/editor/__tests__/NotePanel.test.js`** — three tests: (a) setting the
  arpeggio writes the key and picking "None" drops it; (b) the control shows for
  a rest; (c) **reset-all clears the arpeggio** — the one test that catches the
  reset-all destructure bug (omitting `arpeggio: _arpeggio` would silently leave
  the value behind), a high-value regression guard.

- **`src/notation/__tests__/layout.test.js`** — via `buildLayoutModel`: an
  arpeggiated note carries `note.arpeggio = { dx, topY, bottomY, direction }`;
  `dx` is strictly greater than `max(acc.dx)` with accidentals and
  `>= LEDGER_WIDTH/2` without; a single-pitch note gives `topY == bottomY` and
  does not throw; a non-arpeggiated note has no `note.arpeggio`; a rest is absent
  from `notes[]` entirely. Plus a **direct unit test of `wigglePathD`** as a
  pure, deterministic string function — the bump count `n`, the `n = 1` clamp at
  height 0, the start/end coordinates, and "a taller span yields more `Q`
  segments." (If the left-offset is factored into an `arpeggioDx(accidentals)`
  helper, unit-test it too; if inline, the `buildLayoutModel` assertions cover
  it.)

- **`src/notation/__tests__/svg.test.js`** — render, then assert against the
  nested DOM hook: `up` ⇒ `[data-arpeggio="up"]` exists and contains
  `[data-arpeggio-arrow]` (arrow near `topY`); `down` ⇒ likewise with the arrow
  near `bottomY`; `nondirectional` ⇒ `[data-arpeggio="nondirectional"]` exists
  but `[data-arpeggio-arrow]` is absent; a rest with an arpeggio set ⇒ no
  `[data-arpeggio]` node at all; the wiggle is a `<path>`
  (`[data-arpeggio-wiggle]` `tagName === "path"`).

- **Combined markings (AC7) — its own explicit test.** A layout/svg test on a
  chord carrying `arpeggio` together with `tie`, `dots`, and `dynamic`: all of
  their `data-*` nodes are present, and the arpeggio sits left of the
  accidentals. This AC is easy to forget, so it is called out as its own test.

### End-to-end tests (Playwright + `wp-env`)

Three thin clones of existing e2e tests, covering what unit tests cannot reach —
the save-path topology and the real two-surface render:

- **Front-end render (`specs/render.spec.js`).** Publish a post whose song has
  `arpeggio: "up"` on a chord; assert the published SVG contains
  `[data-arpeggio="up"]` and `[data-arpeggio-arrow]`, and that a `nondirectional`
  arpeggio has no arrow. Proves AC3/AC4 on the real front end.

- **Editor authoring (`specs/editor.spec.js`).** Select a note, set the
  "Arpeggio" `SelectControl` to "Up", assert the stored song carries
  `arpeggio: "up"` and the canvas SVG shows it; set "None" and assert the key is
  gone (AC8).

- **Never-blocks / round-trip (`specs/editor.spec.js`).** Clone the existing
  "round-trips through JSON mode and never blocks saving" test with a raw
  `arpeggio: "sideways"`: the song still saves (AC2's "never blocks" half) and a
  valid value round-trips unchanged (AC1).

### Acceptance-criteria coverage map

| AC | Coverage |
| --- | --- |
| AC1 — valid values validate + round-trip | validate accept + e2e round-trip |
| AC2 — bad value flagged, never blocks | validate flags + e2e never-blocks |
| AC3 — wavy line left of noteheads, outside accidentals, arrow per direction | layout geometry + svg DOM |
| AC4 — identical on both surfaces | architecturally guaranteed (one codepath) + one front-end e2e |
| AC5 — single-pitch renders without error | layout single-pitch + svg |
| AC6 — rest accepted, draws no line | validate/panel accept + svg no-node |
| AC7 — combines with tie/slur/dots/dynamic | explicit combined-markings test |
| AC8 — editor control None/Up/Down/Nondirectional, set/clear/pre-select | NotePanel unit + editor e2e |

## Affected files

| File | Change |
| --- | --- |
| `src/song/schema.js` | +1 enum line (`arpeggio` on the event `$def`) |
| `src/editor/songModel.js` | +`ARPEGGIO` option list |
| `src/editor/inspector/NotePanel.js` | +1 `ToolsPanelItem`; +1 word in the reset-all destructure |
| `src/notation/constants.js` | +arpeggio sizing/placement constants |
| `src/notation/layout.js` | +`note.arpeggio` record on the per-note layout |
| `src/notation/svg.js` | +`renderArpeggio`, +`wigglePathD`, +1 guarded call in `renderNote` |
| Unit + e2e tests | per the test strategy above |

**No changes** to `src/song/validate.js`, `src/notation/glyphs.js`, the music
font, or any save path.

## Trade-offs, alternatives, and risks

- **Per-event decoration vs. a separate span pass.** Chosen: per-event, drawn
  inside `renderNote`. The alternative (a system-level pass like `renderHairpin`)
  exists in the codebase only to resolve cross-event spans; an arpeggio resolves
  nothing across events, so a separate pass would add an unjustified iteration
  and forfeit the free per-note grouping/selection. *Trade-off:* the arpeggio is
  coupled to the note group, which is exactly what we want (selection,
  highlighting, transform inheritance).

- **Geometry in layout vs. in svg.** Chosen: layout. Computing `dx` in `svg.js`
  would fork the accidental-extent logic and leak pixel math into the dumb emit
  layer, against the codebase's layering rule. *Trade-off:* the one new record
  field is the entire layout→svg contract; nothing else is threaded through.

- **Standalone item vs. folding into `SPAN_FIELDS`.** Chosen: standalone, mirror
  of `dynamic`. Folding it in would force the wrong (`start`/`stop`) option list
  and dilute a grouping whose meaning is "the four spans." *Trade-off:* one more
  `ToolsPanelItem` of boilerplate, accepted for clarity.

- **Tuned constants vs. measured glyph metrics.** Chosen: tuned constants
  (`ARPEGGIO_GAP`, `ARPEGGIO_FIXED_GAP`, etc.), matching `ACCIDENTAL_GAP`'s
  precedent. Glyph half-widths are not measured anywhere in the codebase. *Risk:*
  a poorly tuned gap could let the wiggle overlap an accidental or a ledger; this
  is contained by the layout unit test that asserts
  `dx > max(acc.dx)` with accidentals and `dx >= LEDGER_WIDTH/2` without, and is
  visually checkable in the editor.

- **Show-but-inert on rests.** Chosen per spec R10. *Risk:* an author may be
  briefly confused by a settable control with no visible effect on a rest; this
  is the consistent behavior of every other per-event marking and is the spec's
  deliberate choice over a special-case hide-on-rest gate.

- **"Never blocks saving" depends on not adding a gate.** The requirement is held
  by the *existing* topology (raw mode bypasses validation; visual mode is
  conformant by construction). The single way to break it is to add an
  arpeggio-specific blocking check. *Mitigation:* the design adds none, and the
  e2e never-blocks test guards against a regression.
