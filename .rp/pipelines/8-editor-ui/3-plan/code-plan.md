# Code Plan: Editor UI for editing the song

This plan implements the approved design (`2-design-doc/design-doc.md`) for the
approved spec (`1-spec/spec.md`). Tasks are ordered and dependency-aware; the
code phase runs them sequentially on one shared working tree, each dispatched
verbatim to a separate `code-writer`.

## Guiding invariants (apply to every task)

- **Single source of truth:** the block's `song` **string** attribute is the
  only persisted state. The visual editor parses it to a working object only
  when conformant, and serializes a fresh object back via
  `setAttributes({ song })` on every edit. No parsed object is held as separate
  React state.
- **Editor-only boundary:** do **not** modify `src/view.js`, `src/render.php`,
  `src/block.json`, `src/song/schema.js`, or anything under `src/notation/`.
  Reuse them as-is.
- **WordPress-only dependencies:** import only from `@wordpress/*` packages.
  Add nothing to `package.json`. For `NumberControl` use
  `import { __experimentalNumberControl as NumberControl } from "@wordpress/components"`.
- **Conformant by construction:** controls map to constrained inputs so a
  non-conformant song is unreachable; a serialize-time `validateSong` guard is
  the defensive backstop (see T13).
- **No pipeline references in shipped code/tests** (per `AGENTS.md`): never cite
  `.rp/`, design sections, `AC#`, `Req#`, or task IDs in source, comments, or
  test text. The "Traces to" fields below are for planning only and MUST NOT
  appear in the code.
- **New files live under `src/editor/`** (a new folder) unless stated otherwise,
  so the editor UI is cleanly grouped. Co-locate unit tests in
  `src/editor/__tests__/`. The project uses Jest (jsdom env) via
  `wp-scripts test-unit-js` and Playwright via `wp-scripts test-playwright`.
- **Style/code conventions:** match the surrounding code — leading JSDoc block
  comment on every module and exported function, `@wordpress/i18n`'s `__` for
  all human-facing strings (textdomain `"piano-block"`), tabs for indentation,
  double-quoted strings (Biome enforces this; run `npm run check` mentally).

---

## T1 — Song-shape helpers and constrained-field vocabularies

**Goal:** A pure, dependency-free helper module that centralizes the song
working-object vocabularies (enum option lists, numeric bounds) and the minimal
"new item" factories every editor control reuses, so the constrained controls
and the conformant-by-construction guarantee derive from one place.

**Files:**
- create `src/editor/songModel.js`
- create `src/editor/__tests__/songModel.test.js`

**Changes:**
- Export option lists mirroring `src/song/schema.js` enums (do NOT import the
  schema; these are presentational `{ label, value }` lists for `SelectControl`,
  with i18n-wrapped labels where a friendlier label helps, raw value otherwise):
  - `DURATIONS` = `whole, half, quarter, eighth, sixteenth, thirty-second`
    (used for event `duration` and tempo `beatUnit`).
  - `BEAT_TYPES` = `1, 2, 4, 8, 16, 32` (numbers; `timeSignature.beatType`).
  - `CLEFS` = `treble, bass, alto, tenor`.
  - `DYNAMICS` = `pp, p, mp, mf, f, ff, sf, sfz`.
  - `BARLINES` = `regular, repeat-start, repeat-end, double, final`.
  - `EVENT_TYPES` = `note, rest`.
  - `SPAN_STATES` = `start, stop` (shared by `tie`, `slur`, `crescendo`,
    `decrescendo`).
  - `PLACEMENTS` = `above, below`; `STAVES` = `rightHand, leftHand`.
- Export numeric bounds as named constants for reuse by `NumberControl` props
  and tests: `BEATS_MIN = 1`; `OCTAVE_MIN = 0`, `OCTAVE_MAX = 9`;
  `ALTER_MIN = -2`, `ALTER_MAX = 2` (also for `alters` values);
  `OCTAVE_SHIFT_MIN = -2`, `OCTAVE_SHIFT_MAX = 2`; `DOTS_MIN = 0`,
  `DOTS_MAX = 2`; `BPM_MIN_EXCLUSIVE = 0` (bpm must be `> 0`).
- Export factory functions returning minimal conformant fragments:
  - `newPitch(step = "C", octave = 4)` → `{ step, octave }`.
  - `newNote()` → `{ type: "note", duration: "quarter", pitches: [ newPitch() ] }`
    (seeds the required pitch — the note invariant).
  - `newRest()` → `{ type: "rest", duration: "quarter" }`.
  - `newMeasure()` → `{}` (an empty measure is conformant; the schema requires
    nothing inside a measure).
  - `newSection()` → `{ measures: [ newMeasure() ] }`.
  - `newSong()` → `{ sections: [ newSection() ] }` (the minimal conformant song
    the empty state seeds — see T9).
  - `newEventAnnotation()` → `{ text: "", placement: "above" }`.
  - `newStandaloneAnnotation()` → `{ text: "", placement: "above", staff: "rightHand" }`.
- Export small immutable array helpers used by every list's reorder/add/remove
  (pure, return new arrays; never mutate): `insertAt(list, index, item)`,
  `removeAt(list, index)`, `moveItem(list, from, to)`, `replaceAt(list, index, item)`.
- Each factory's output, when wrapped in `newSong()`-shaped context and
  `JSON.stringify`'d, must pass `validateSong` — assert this in the test.

**Depends on:** (none)

**Traces to:** Req 2, 3, 4; AC2, AC4, AC5.

**Acceptance:**
- `src/editor/__tests__/songModel.test.js` asserts: every option-list value is a
  member of the corresponding `schema.js` enum (import `songSchema` only in the
  TEST to cross-check, not in the shipped module); `newSong()` and each factory
  produce fragments that `validateSong(JSON.stringify(...))` accepts as `[]`
  (compose factories into a full song where needed, e.g. a note inside a measure
  inside a section); `insertAt`/`removeAt`/`moveItem`/`replaceAt` are pure
  (input array unchanged) and produce the expected results including no-op edge
  cases (move to same index, remove out of range returns a copy).
- `npm run test:unit` passes.

---

## T2 — Per-song note-name system helper

**Goal:** Resolve the per-song note-name system (English vs Spanish), provide its
7-name `SelectControl` option list, and preserve existing `step` spellings
verbatim until a pitch is edited — implementing the design's note-name decision.

**Files:**
- create `src/editor/noteNames.js`
- create `src/editor/__tests__/noteNames.test.js`

**Changes:**
- Reuse `src/song/normalizeStep.js` (`normalizeStep`, `isNoteName`) — do NOT
  redefine the vocabulary. Define the two ordered 7-name systems locally as the
  *display* spellings, each mapped to the same canonical letters
  `normalizeStep` yields:
  - English: `["C","D","E","F","G","A","B"]`.
  - Spanish: `["do","re","mi","fa","sol","la","si"]`.
- `inferNoteNameSystem(song)` → `"english" | "spanish"`: walk all pitches'
  `step` values across the parsed song object; if any step lowercases to a
  Spanish token (`do/re/mi/fa/sol/la/si`) and none are English letters that
  outnumber them, return `"spanish"`; default `"english"` (including a song with
  no pitches / a new song). Keep the rule simple and documented: "Spanish if the
  song uses any Spanish-system spelling, else English." Use
  `normalizeStep`/`isNoteName` and a small local set of the Spanish tokens for
  the discriminator.
- `noteNameOptions(system)` → `[{ label, value }]` of the 7 names in that
  system, where `value` is the exact display spelling stored into `step`.
- `stepInSystem(step, system)` → the display spelling in `system` for a given
  existing `step` (maps via `normalizeStep` to a canonical letter, then to that
  system's spelling); used when an edited pitch's `step` is rewritten into the
  per-song system. Returns the system's spelling for the canonical letter; if
  `step` is unrecognised, fall back to the system's first name.
- Document that existing spellings are preserved verbatim in the working object
  and only rewritten via `stepInSystem` when the author edits that pitch's
  `step` (the rewrite happens in `PitchEditor`, T6).

**Depends on:** (none — independent of T1)

**Traces to:** Req 6, 11; AC9.

**Acceptance:**
- `src/editor/__tests__/noteNames.test.js` asserts: `inferNoteNameSystem`
  returns `"spanish"` for a song whose pitches use `do`/`sol`, `"english"` for a
  C-D-E song and for a song with no pitches; `noteNameOptions("spanish")` lists
  `do…si` in order with those exact `value`s; `stepInSystem("do","english")`
  → `"C"`, `stepInSystem("G","spanish")` → `"sol"`, and a round-trip
  `stepInSystem(stepInSystem(x, s), s) === stepInSystem(x, s)` (idempotent).
- All option `value`s satisfy `isNoteName`.
- `npm run test:unit` passes.

---

## T3 — `ListControls`: shared add / remove / move-up / move-down buttons

**Goal:** The single reusable control bank every list (sections, measures,
events, pitches, annotations) uses for add/remove/reorder, fully keyboard
accessible, no drag-and-drop.

**Files:**
- create `src/editor/ListControls.js`
- create `src/editor/__tests__/ListControls.test.js`

**Changes:**
- Export `ListControls({ index, count, onMoveUp, onMoveDown, onRemove, moveUpLabel, moveDownLabel, removeLabel, canRemove = true })`.
- Render `@wordpress/components` `Button`s (icon or text) for move-up,
  move-down, remove. Use `@wordpress/i18n` `__` for accessible labels
  (`label`/`aria-label`), defaulting to "Move up" / "Move down" / "Remove" but
  allowing per-call overrides (so e.g. "Remove note" reads well).
- Disable move-up when `index === 0`, move-down when `index === count - 1`,
  remove when `!canRemove` (callers pass `canRemove={false}` to protect a
  required minimum, e.g. the last pitch of a note — T6).
- The "add" affordance is a separate exported `AddButton({ onClick, label })`
  (a `Button variant="secondary"` with a `plus` icon) so a list can place "add"
  at its end independently of per-row controls. Both live in this file.
- No business logic here — purely presentational; parent passes handlers.

**Depends on:** (none)

**Traces to:** Req 3; AC4.

**Acceptance:**
- `src/editor/__tests__/ListControls.test.js` (jsdom + `@testing-library/react`
  if available via `@wordpress/scripts`, else `@wordpress/element`'s
  `render`/`createRoot` with manual DOM assertions — match whatever pattern
  exists; if no RTL, assert via `container.querySelectorAll('button')` and
  click via `button.click()`): move-up disabled at `index 0`; move-down disabled
  at `index count-1`; remove disabled when `canRemove={false}`; clicking each
  enabled button calls the matching handler exactly once.
- `npm run test:unit` passes.

---

## T4 — Leaf field editors: metadata, tempo, time signature, hand config

**Goal:** The constrained leaf controls for context and metadata, each emitting a
conformant fragment via a single `onChange(nextValue)` callback.

**Files:**
- create `src/editor/MetadataEditor.js`
- create `src/editor/ContextEditor.js` (contains `HandConfigEditor` as a local
  component or its own file `src/editor/HandConfigEditor.js` — prefer the
  separate file for clarity)
- create `src/editor/HandConfigEditor.js`
- create `src/editor/__tests__/contextControls.test.js`

**Changes:**
- `MetadataEditor({ metadata = {}, onChange })`: `TextControl`s for `title` and
  `composer`. `onChange` emits a metadata object with only the non-empty fields
  set (an empty string clears the key so it is absent on serialize — keeps the
  round-trip clean).
- `ContextEditor({ context = {}, onChange, heading })`: edits a `context`
  object's optional members, each independently present/absent (this is reused
  for `defaults` and per-section overrides). Renders:
  - Tempo: `NumberControl` for `bpm` (min `> 0`; use `min={1}` step `1` and
    treat empty as "tempo absent"), `SelectControl` for `beatUnit` from
    `DURATIONS` (with an explicit empty option to leave it unset). Emit a
    `tempo` object only when `bpm` is present (schema requires `bpm`); if the
    author clears `bpm`, drop the whole `tempo` key.
  - Time signature: `NumberControl` for `beats` (`min={BEATS_MIN}`),
    `SelectControl` for `beatType` from `BEAT_TYPES`. Emit `timeSignature` only
    when both `beats` and `beatType` are set (both are required); otherwise drop
    the key (an incomplete time signature is non-conformant, so the control must
    not emit a half-filled one).
  - Right/left hand: two `HandConfigEditor`s writing `rightHand` / `leftHand`.
  - Each sub-object is omitted from the emitted context when it has no set
    fields (so an untouched override stays absent — supports the overrides model
    and a clean round-trip).
- `HandConfigEditor({ handConfig = {}, onChange, label })`:
  - `clef`: `SelectControl` from `CLEFS` (with empty option to unset).
  - `octaveShift`: `NumberControl` (`min={OCTAVE_SHIFT_MIN}`,
    `max={OCTAVE_SHIFT_MAX}`).
  - `alters`: a small editable map UI — a row per entry with a note-name
    `SelectControl` (English+Spanish recognised; reuse `noteNameOptions` is
    optional here, but the KEY must be a recognised note name — simplest is a
    fixed 7-letter English `SelectControl` for the key since `alters` keys are
    canonicalized case-insensitively by the validator) and a `NumberControl`
    value (`min={ALTER_MIN}`, `max={ALTER_MAX}`), plus add/remove via
    `ListControls`/`AddButton`. Emit `alters` only when ≥1 entry; drop the key
    when empty. Guard against duplicate keys by replacing on collision.
  - Emit only the set fields; `onChange` with `{}` clears the hand config.
- All numeric inputs clamp to their bounds; all selects offer only enum values.

**Depends on:** T1 (vocabularies, bounds, array helpers), T2 (note-name options
for alters keys — optional), T3 (`ListControls`/`AddButton` for the alters map).

**Traces to:** Req 2, 4; AC3, AC5.

**Acceptance:**
- `src/editor/__tests__/contextControls.test.js` asserts: editing `bpm` then
  clearing it adds then removes the `tempo` key; setting only `beats` does NOT
  emit a `timeSignature` (incomplete), setting both does; clef select offers
  exactly the 4 clefs; an out-of-range `octaveShift` cannot be produced; adding
  an `alters` entry emits `{ alters: { <note>: <int> } }` and removing the last
  entry drops `alters`. For each emitted fragment, wrap it into a song
  (`{ defaults: <context>, sections: [...] }`) and assert
  `validateSong(JSON.stringify(...))` returns `[]`.
- `npm run test:unit` passes.

---

## T5 — Annotation editors and `AnnotationList`

**Goal:** Editors + list for event-anchored annotations (`text`, `placement`)
and standalone measure annotations (`text`, `placement`, `staff`), with
add/remove/reorder.

**Files:**
- create `src/editor/AnnotationEditor.js`
- create `src/editor/AnnotationList.js`
- create `src/editor/__tests__/annotations.test.js`

**Changes:**
- `AnnotationEditor({ annotation, kind, onChange })` where `kind` is
  `"event"` | `"standalone"`:
  - `text`: `TextControl` (or `TextareaControl` for longer text).
  - `placement`: `SelectControl` from `PLACEMENTS`.
  - when `kind === "standalone"`: also `staff`: `SelectControl` from `STAVES`.
  - Emits a fully-required object (`text`+`placement` for event; plus `staff`
    for standalone) — these fields are all required by the schema, so the
    control always keeps them present (default `text: ""` is a conformant empty
    string).
- `AnnotationList({ annotations = [], kind, onChange })`: renders each via
  `AnnotationEditor`, with `ListControls` per row (move/remove) and an
  `AddButton` that appends `newEventAnnotation()` or
  `newStandaloneAnnotation()` per `kind`. `onChange` emits the new array, or
  omits the key entirely (emits `undefined`/signals removal to the parent) when
  the list becomes empty so an empty `annotations` array is not serialized.
- Use the array helpers from T1 for add/remove/reorder.

**Depends on:** T1, T3.

**Traces to:** Req 2, 3; AC3, AC4.

**Acceptance:**
- `src/editor/__tests__/annotations.test.js` asserts: an event annotation always
  carries `text`+`placement`; a standalone annotation also carries `staff`;
  adding then removing all annotations yields an empty/absent list; reorder
  moves items. Wrap emitted annotations into a measure/event and assert
  `validateSong(JSON.stringify(...))` is `[]`.
- `npm run test:unit` passes.

---

## T6 — Pitch editing: `PitchEditor` and `PitchList`

**Goal:** Per-pitch editing (`step` via the per-song note-name dropdown,
`octave`, `alter`) and the chord's pitch list with add/remove/reorder, enforcing
"a note has ≥1 pitch".

**Files:**
- create `src/editor/PitchEditor.js`
- create `src/editor/PitchList.js`
- create `src/editor/__tests__/pitches.test.js`

**Changes:**
- `PitchEditor({ pitch, system, onChange })`:
  - `step`: `SelectControl` whose options are `noteNameOptions(system)` (T2).
    On change, write the chosen display spelling directly. (Because the options
    are already in the per-song system, editing a pitch rewrites its `step` into
    that system — the design's "edited pitch normalizes to per-song spelling".)
    The currently-stored `step` may be a different spelling/system; show it
    selected by matching on `normalizeStep` (canonical letter) so an untouched
    pitch displays correctly without being rewritten until changed.
  - `octave`: `NumberControl` (`min={OCTAVE_MIN}`, `max={OCTAVE_MAX}`).
  - `alter`: `NumberControl` (`min={ALTER_MIN}`, `max={ALTER_MAX}`); omit the
    `alter` key when 0/unset to keep the round-trip clean (natural is the
    default), unless an explicit `0`/value was present — simplest rule: emit
    `alter` only when non-zero.
  - Emits `{ step, octave }` plus `alter` when non-zero. `step` and `octave` are
    always present (both required by schema).
- `PitchList({ pitches = [], system, onChange })`: render each `PitchEditor`
  with `ListControls` (move/remove) and an `AddButton` appending
  `newPitch(...)` in the per-song system (first note name, octave 4). Pass
  `canRemove={pitches.length > 1}` so the LAST pitch cannot be removed (the note
  invariant). Use T1 array helpers.
- Preserve existing `step` spelling verbatim for pitches the author does not
  touch; only `PitchEditor`'s `onChange` writes a system spelling.

**Depends on:** T1, T2, T3.

**Traces to:** Req 2, 3, 11; AC3, AC4, AC9.

**Acceptance:**
- `src/editor/__tests__/pitches.test.js` asserts: a Spanish-system `PitchList`
  shows `do…si` options; changing a pitch's `step` writes the system spelling
  (`G`→`sol` in Spanish); an untouched pitch keeps its original spelling (no
  rewrite) — e.g. a list given `[{step:"do",octave:4}]` in English system still
  reads `do` until that pitch is edited; the last pitch cannot be removed
  (`canRemove` false); `octave`/`alter` clamp to bounds; `alter: 0` is omitted.
  Wrap a resulting note into a song and assert `validateSong` returns `[]`,
  including a Spanish round-trip case (`do` stays `do` when untouched).
- `npm run test:unit` passes.

---

## T7 — Event editing: `EventRow`, `EventList`, `EventEditor`

**Goal:** In-place per-event editing of a hand's event list (`type`, `duration`,
`dots`, `dynamic`, `tie`, `slur`, `crescendo`, `decrescendo`) with add/remove/
reorder, plus drill-down into an event for its chord pitches and event
annotations.

**Files:**
- create `src/editor/EventRow.js`
- create `src/editor/EventList.js`
- create `src/editor/EventEditor.js`
- create `src/editor/__tests__/events.test.js`

**Changes:**
- `EventRow({ event, system, index, count, onChange, onMove*, onRemove, onDrillIn })`:
  inline controls —
  - `type`: `SelectControl` from `EVENT_TYPES`. Switching `note`→`rest` DROPS
    `pitches` (and event `annotations` may stay or be dropped — keep them, they
    are still valid on a rest per schema; but pitches must go since a rest has no
    pitches required and they are meaningless — simplest conformant rule: drop
    `pitches` on switch to rest). Switching `rest`→`note` SEEDS one pitch
    (`newPitch()` in the per-song `system`) to satisfy the note invariant.
  - `duration`: `SelectControl` from `DURATIONS`.
  - `dots`: `NumberControl` (`min={DOTS_MIN}`, `max={DOTS_MAX}`); omit when 0.
  - `dynamic`: `SelectControl` from `DYNAMICS` (empty option to unset; omit key
    when unset).
  - `tie`/`slur`/`crescendo`/`decrescendo`: four `SelectControl`s from
    `SPAN_STATES` (empty option to unset; omit key when unset). These may be
    grouped under a compact "spans" sub-area to keep the row readable.
  - A "drill in" button (only meaningful for a `note`, or always — to reach
    event annotations on a rest too) opens `EventEditor`.
  - `ListControls` for move/remove.
- `EventList({ events = [], system, onChange, label })`: renders a labeled list
  (e.g. "Right hand") of `EventRow`s with an `AddButton` that appends a new
  note (`newNote()` seeded in `system`) — or offer "Add note"/"Add rest" via two
  `AddButton`s. `onChange` emits the new array, or omits the hand key when empty
  (an empty `rightHand`/`leftHand` array need not be serialized). Use T1 array
  helpers; reorder is per-row.
- `EventEditor({ event, system, onChange, onBack })`: the drill-in detail for a
  single event — `PitchList` (only when `type === "note"`) and an event
  `AnnotationList` (`kind="event"`). A breadcrumb/back affordance via `onBack`.
  Edits flow up through `onChange(nextEvent)`.

**Depends on:** T1, T2, T3, T5, T6.

**Traces to:** Req 2, 3, 4; AC3, AC4, AC5.

**Acceptance:**
- `src/editor/__tests__/events.test.js` asserts: switching `note`→`rest` removes
  `pitches`; switching `rest`→`note` adds exactly one pitch; `dots`/`dynamic`/
  the four span fields omit their keys when unset and set them when chosen and
  only to enum values; an event always keeps `type`+`duration`. For each
  resulting event, wrap into a measure/section/song and assert `validateSong`
  returns `[]` (including a `note` event so the non-empty-pitches invariant is
  exercised).
- `npm run test:unit` passes.

---

## T8 — Structural editors: measure, section, song overview, drill-down nav

**Goal:** The drill-down structural editors (song → section → measure) and the
breadcrumb navigation that ties them together, with add/remove/reorder at the
section and measure levels.

**Files:**
- create `src/editor/MeasureEditor.js`
- create `src/editor/MeasureList.js`
- create `src/editor/SectionEditor.js`
- create `src/editor/SectionList.js`
- create `src/editor/SongOverview.js`
- create `src/editor/Breadcrumb.js`
- create `src/editor/__tests__/structure.test.js`

**Changes:**
- `MeasureEditor({ measure, system, onChange })`:
  - `barlineStart` / `barlineEnd`: two `SelectControl`s from `BARLINES` (empty
    option to unset; omit key when unset) — a `BarlineControl` helper may wrap
    one select if convenient.
  - Two `EventList`s in place — `rightHand` and `leftHand` (labels "Right hand"
    / "Left hand"). Each writes its hand key (omitted when empty).
  - Measure-level standalone `AnnotationList` (`kind="standalone"`).
  - Emits a measure object with only set keys (an empty measure `{}` is valid).
- `MeasureList({ measures = [], system, onChange, onOpenMeasure })`: a list of
  measure summaries; each row has a "open" button (drill into `MeasureEditor`
  via `onOpenMeasure(index)`), `ListControls` (move/remove), and an `AddButton`
  appending `newMeasure()`. A section must keep ≥1 measure? The schema only
  requires the `measures` key to exist (it may be an empty array), so removing
  all measures is conformant — allow it, but seed `newMeasure()` when a brand
  new section is created (T1 `newSection`). Use T1 array helpers.
- `SectionEditor({ section, defaults, system, onChange, onOpenMeasure })`: a
  section's optional context overrides via `ContextEditor` (writing the
  section's own `tempo`/`timeSignature`/`rightHand`/`leftHand` keys, each
  independently present/absent) plus its `MeasureList`. Emits a section object
  that always keeps `measures` (required) and only the set override keys.
- `SectionList({ sections, ..., onOpenSection })`: list of section summaries
  with open/`ListControls`/`AddButton` (`newSection()`); `sections` must keep
  ≥1 section to stay a meaningful song, but the schema permits an empty
  `sections` array — still, the empty-state seeds one section (T9). Allow
  removing down to zero but the editor then shows the empty state again
  (handled in T9/SongEditor). Use T1 array helpers.
- `SongOverview({ song, system, onChange, onOpenSection })`: the top level —
  `MetadataEditor` (writes `metadata`), `ContextEditor` for `defaults` (writes
  `defaults`), and `SectionList`. Emits the whole song object.
- `Breadcrumb({ trail, onNavigate })`: renders the navigation trail (e.g.
  "Song / Section 2 / Measure 3") as buttons that call `onNavigate(level)`.
  Pure/presentational; the SongEditor (T9) owns the navigation state.
- All these components are CONTROLLED: they receive their slice of the working
  object and an `onChange` that returns the next slice; they hold no song state.
  Navigation (which section/measure/event is open) IS local UI state owned by
  the SongEditor (T9), not derived from the song.

**Depends on:** T1, T3, T4, T5, T7.

**Traces to:** Req 2, 3; AC3, AC4.

**Acceptance:**
- `src/editor/__tests__/structure.test.js` asserts: adding/removing/reordering a
  section updates `song.sections`; same for measures within a section; a section
  always keeps its `measures` key; `SongOverview` emits `metadata`/`defaults`
  only when set; editing a barline sets/omits the key. For representative
  edits, assert `validateSong(JSON.stringify(nextSong))` returns `[]`.
- `npm run test:unit` passes.

---

## T9 — `SongEditor` root: validity branching, empty/invalid states, navigation, serialization

**Goal:** The visual-editor root that branches on `validateSong`, owns the
parse→edit→serialize data flow and the drill-down navigation state, and renders
empty / invalid / structured states.

**Files:**
- create `src/editor/SongEditor.js`
- create `src/editor/EmptyState.js`
- create `src/editor/InvalidState.js`
- create `src/editor/__tests__/SongEditor.test.js`

**Changes:**
- `SongEditor({ song, errors, onChangeSong, onEditAsJson })`:
  - `song` is the raw string; `errors` is the memoized `validateSong(song)`
    result passed from `Edit` (T12). `onChangeSong(nextString)` persists.
  - Branch:
    - **empty** (`song.trim() === ""`): render `EmptyState`.
    - **invalid** (`errors.length > 0`): render `InvalidState` with the
      messages and a "switch to JSON" button (`onEditAsJson`).
    - **conformant**: parse once (memoized on `song`) to the working object,
      infer the note-name `system` (T2) memoized on the parsed object, and
      render the structured editor (`SongOverview` / `SectionEditor` /
      `MeasureEditor` / `EventEditor`) according to the current navigation
      state.
  - **Navigation state** (local `useState`): a path like
    `{ sectionIndex?, measureIndex?, eventIndex? }` plus a derived `Breadcrumb`
    trail. Opening a section/measure/event pushes onto the path; the breadcrumb
    navigates back. Reset/repair the path if the underlying indices no longer
    exist (e.g. after a remove) — clamp or pop to a valid level.
  - **Edit flow:** every child `onChange` produces the next slice; `SongEditor`
    splices it into the working object (using T1 array/`replaceAt` helpers),
    `JSON.stringify`s the whole object, and calls `onChangeSong(nextString)`.
    Run the serialize-time guard (T13) before persisting.
- `EmptyState({ onStart })`: a "Start a new song" affordance. On start it
  serializes `newSong()` (T1) via `onStart(JSON.stringify(newSong()))` so the
  block goes from empty → minimal conformant song and the structured editor
  takes over (the author can then begin adding content). No raw JSON required.
- `InvalidState({ errors, onEditAsJson })`: shows the first (and optionally all)
  `validateSong` message(s) in a `Notice status="error"`, explains the visual
  editor cannot edit a non-conformant song, and offers a button to switch to
  raw JSON to fix it. Visual editing resumes automatically once the song becomes
  valid (because `Edit` re-derives `errors` from the string).
- Memoize parse and system inference so typical edits are cheap.

**Depends on:** T1, T2, T8, T13 (serialize guard — see note: implement T13 first
or inline the guard call and let T13 fill the helper; ordered so T13 precedes
T9 is cleaner — see "Depends on" ordering below).

**Traces to:** Req 4, 7, 8, 9; AC2, AC5, AC7, AC8.

**Acceptance:**
- `src/editor/__tests__/SongEditor.test.js` (jsdom) asserts: with `song=""`
  renders the empty state and starting a song calls `onChangeSong` with a string
  that `validateSong` accepts; with a non-empty invalid string + non-empty
  `errors` renders the invalid state showing an error message and a JSON-switch
  button that calls `onEditAsJson`; with a conformant string renders the
  structured editor (e.g. the metadata title field reflects `metadata.title`);
  an edit (e.g. changing the title) calls `onChangeSong` with a re-serialized
  conformant string. Navigation: opening a section then a measure updates the
  breadcrumb; navigating back returns to the parent.
- `npm run test:unit` passes.

---

## T10 — `SongPreview`: live sheet-music preview reusing the notation core

**Goal:** A read-only live preview that renders the conformant song to SVG using
the existing notation core, owning its own thin glue (font gate, width→sp,
accessible name) — without touching `src/view.js`.

**Files:**
- create `src/editor/SongPreview.js`
- create `src/editor/__tests__/SongPreview.test.js`

**Changes:**
- `SongPreview({ song, accessibleName })` where `song` is the raw string.
- Hold a container `ref` (`useRef`). In a `useEffect` keyed on `song` (and a
  measured width — see below):
  - Run `validateSong(song)`; if non-empty errors OR empty/whitespace song,
    clear the container (`replaceChildren()`) and render nothing (parity with
    the front-end render-nothing behavior). Otherwise `JSON.parse(song)`.
  - Compute `availableWidthInSp` from the container's `clientWidth` using the
    SAME rule as `view.js` (px→sp via `SP_PX` from
    `src/notation/constants.js`, stepping down to `7` below `480px`). Duplicate
    this thin glue here (do NOT import from `view.js`); define local constants
    `NARROW_CONTAINER_PX = 480`, `NARROW_SP_PX = 7` mirroring `view.js`.
  - `const model = buildLayoutModel(parsed, widthInSp);`
    `renderInto(ref.current, model, { accessibleName });`
  - Gate the FIRST draw on the music font via `document.fonts.load('1em "PB
    Music"')` (use `MUSIC_FONT_FAMILY` from `src/notation/glyphs.js`), falling
    back to an immediate draw when the Font Loading API is unavailable —
    duplicating `view.js`'s `drawWhenFontReady` glue locally.
  - Reflow on width change: a `ResizeObserver` (rAF-debounced, one-way) like
    `view.js`'s `observeResize`, or simpler — re-run the effect when a measured
    width state changes. Keep it minimal; large-song perf is out of scope.
  - Clean up the observer on unmount.
- Reuse, do NOT modify: `buildLayoutModel` (`src/notation/layout.js`),
  `renderInto` (`src/notation/svg.js`), `SP_PX` (`constants.js`),
  `MUSIC_FONT_FAMILY` (`glyphs.js`), `validateSong` (`src/song/validate.js`).
- The preview is read-only (no controls); it is rendered ALONGSIDE the visual
  editor (not in JSON mode).

**Depends on:** (none of the editor tasks — depends only on the existing
notation core; can be built in parallel, but ordered here after the editor so a
single code-writer has context. List formal dep: none.)

**Traces to:** Req 5, 12, 13; AC6, AC10.

**Acceptance:**
- `src/editor/__tests__/SongPreview.test.js` (jsdom) asserts: with a conformant
  song string the effect mounts an `<svg role="img">` into the container (mock
  `document.fonts` or rely on the no-Font-Loading-API fallback path); with an
  empty or invalid song the container is left empty (no `<svg>`); changing the
  `song` prop to a different conformant song re-renders the SVG; `accessibleName`
  is reflected on the SVG `<title>`. (You may stub `getBoundingClientRect`/
  `clientWidth` since jsdom reports 0; ensure the code tolerates a 0 width by
  rendering at the floor without throwing.)
- The test must NOT import or reference `src/view.js`.
- `npm run test:unit` passes.

---

## T11 — Editor styles

**Goal:** Minimal layout styles for the on-canvas visual editor + adjacent
preview and the mode container, consistent with the existing scaffold styling.

**Files:**
- modify `src/style.scss`

**Changes:**
- Add scoped classes under the existing `.wp-block-piano-block-piano` block
  wrapper for: the mode container, the editor/preview two-column (or stacked on
  narrow) layout, the structured-editor panels, list rows, and the preview
  surface. Keep it minimal and use BEM-ish names matching the existing
  `wp-block-piano-block-piano__*` convention (e.g. `__editor`, `__preview`,
  `__list-row`, `__mode-toggle`).
- Do NOT alter the existing `@font-face` declaration or the front-end-relevant
  rules. The font-face stays (it is what makes the preview's glyphs available in
  the editor too).
- The preview column should have a sensible min-width so `clientWidth` is
  non-zero in the real editor.

**Depends on:** T9, T10 (so class names match what those components emit).

**Traces to:** Req 1, 5; AC1, AC6.

**Acceptance:**
- `npm run build` succeeds (SCSS compiles). `npm run lint` / `npm run check`
  pass (Biome formatting). No visual assertion in unit tests; visual correctness
  is covered by the e2e in T14.

---

## T12 — Refactor `Edit` into the mode container

**Goal:** Turn `src/edit.js` into a thin mode container: visual mode (default)
showing `SongEditor` + `SongPreview`; JSON mode showing the existing raw-JSON
field unchanged; a mode switch between them. Preserve the raw field's label,
help text, and non-blocking error notice exactly.

**Files:**
- modify `src/edit.js`
- create `src/editor/__tests__/Edit.test.js` (or extend an existing edit test if
  present — none exists today, so create)

**Changes:**
- Keep the block props wrapper (`useBlockProps`) and the memoized
  `errors = validateSong(song)` (empty string → `[]`) computation — pass these
  down so they are computed once.
- Add local UI state `mode` (`"visual" | "json"`), defaulting to `"visual"`
  (visual is the default surface). Do NOT persist `mode` to attributes (it is
  editor-only UI state).
- Render a **mode switch**: a `BlockControls` toolbar button (e.g. "Edit as
  JSON" / "Visual editor") toggling `mode`, and/or a small toggle at the top of
  the block. Wire `SongEditor`'s `onEditAsJson` and `InvalidState`'s JSON-switch
  to set `mode = "json"`.
- **Visual mode:** render `SongEditor` (passing `song`, `errors`,
  `onChangeSong = (next) => setAttributes({ song: next })`, and `onEditAsJson`)
  alongside `SongPreview` (passing `song` and an `accessibleName` — derive it
  inline from the parsed metadata when conformant, or pass a simple default;
  reuse the `accessibleNameFor` logic conceptually but you MAY NOT import it from
  `view.js` per the boundary — either compute a minimal title-based name inline
  in `SongPreview`/`Edit`, or have `SongPreview` derive it from the parsed
  metadata internally. Prefer: `SongPreview` derives its own accessible name
  from the parsed song's metadata, so `Edit` need not pass one). The two halves
  sit side by side (CSS from T11).
- **JSON mode:** render the EXISTING raw-JSON `TextareaControl` verbatim — same
  `label={__("Song (JSON)", "piano-block")}`, same help text, same
  `onChange={(next) => setAttributes({ song: next })}`, same
  `rows`/`className`, and the same non-blocking `Notice status="error"` showing
  `errors[0]` when `errors.length > 0`. This preserves today's behavior exactly
  (raw text stored unconditionally, validation informational, never blocks
  saving).
- The two modes are NEVER shown/edited simultaneously side by side (preview is
  read-only, not a second editor).
- Update the module's top JSDoc to describe the mode container (without
  referencing the pipeline).

**Depends on:** T9, T10 (and T11 for classes).

**Traces to:** Req 1, 7, 8, 10; AC1, AC7, AC11.

**Acceptance:**
- `src/editor/__tests__/Edit.test.js` (jsdom) asserts: default render is visual
  mode (the visual editor is present, the "Song (JSON)" textarea is NOT in the
  DOM); toggling to JSON mode shows the textarea with label "Song (JSON)" and,
  for a non-conformant `song`, the `.is-error` notice with the validator
  message; editing the textarea calls `setAttributes({ song })` with the raw
  text verbatim (even invalid). Mock `@wordpress/block-editor`'s `useBlockProps`/
  `BlockControls` as needed (match any existing mocking pattern; if none, render
  with the real exports — they work in jsdom).
- `npm run test:unit` passes; `npm run build` succeeds.

---

## T13 — Serialize-time `validateSong` guard

**Goal:** A small defensive guard, used by `SongEditor` before persisting, that
runs `validateSong` on the serialized string and refuses to persist a
non-conformant string from visual mode (a latent-bug backstop; in normal
operation it always passes).

**Files:**
- create `src/editor/serializeSong.js`
- create `src/editor/__tests__/serializeSong.test.js`

**Changes:**
- Export `serializeSong(workingObject)` → string: `JSON.stringify(workingObject)`
  (canonical formatting; whitespace/key order not preserved — accepted by the
  round-trip fidelity decision).
- Export `commitSong(workingObject, onChangeSong)` (or a guard
  `guardedSerialize(workingObject)` returning `{ song, errors }`): serialize,
  then run `validateSong(song)`; if it returns errors, do NOT call
  `onChangeSong` — instead log a developer warning via `console.warn` (so a
  latent bug is observable in dev) and return without persisting; if clean, call
  `onChangeSong(song)`. Keep the surface minimal and document that in normal
  operation the guard always passes (the controls are conformant by
  construction).
- `SongEditor` (T9) routes every edit through this guard.

**Depends on:** T1 (factories used in tests).

**Traces to:** Req 4; AC5.

**Acceptance:**
- `src/editor/__tests__/serializeSong.test.js` asserts: `serializeSong(newSong())`
  is a string that `validateSong` accepts (`[]`); the guard calls `onChangeSong`
  with the serialized string for a conformant object; for a deliberately
  malformed object (e.g. a note with an empty `pitches` array) the guard does
  NOT call `onChangeSong` and emits a `console.warn` (assert via a spy).
- `npm run test:unit` passes.

---

## T14 — Update and extend the editor e2e tests

**Goal:** Update `specs/editor.spec.js` so the existing raw-field assertions
reach the JSON mode (the raw field is no longer the default surface), and add
coverage for the visual editor being the default, starting a song from scratch,
a visual edit reflected in the stored `song`, the non-empty-invalid → JSON
routing, and the live preview rendering.

**Files:**
- modify `specs/editor.spec.js`

**Changes:**
- The visual editor is now the DEFAULT surface, so the raw `TextareaControl`
  (label "Song (JSON)") is NOT visible until the author switches to JSON mode.
  Update the existing tests that locate the field by `SONG_FIELD_LABEL` to FIRST
  switch the block into JSON mode (click the mode-switch toolbar button / toggle
  added in T12). Keep the field's label "Song (JSON)" and the `.is-error` notice
  selector — they are preserved by T12, so only the navigation step is new.
  - Add a helper `switchToJsonMode(editor/page)` that clicks the mode switch
    (locate it by its accessible label, e.g. "Edit as JSON").
  - The four existing tests (empty starts blank, conformant stored, invalid JSON
    flagged+stored, non-conformant flagged+stored, round-trip) keep their
    assertions but enter JSON mode first where they interact with the textarea.
    For "AC2 empty starts blank": the block now defaults to the VISUAL empty
    state; assert the stored attribute is still `""` and the empty-state
    affordance is present, AND (in JSON mode) the textarea is blank.
- Add new tests (label them by plain behavior, NEVER by `AC#`):
  - **Visual editor is the default surface:** a freshly inserted block shows the
    visual editor (the empty "start a new song" affordance) and NOT the raw
    textarea by default; the JSON mode is reachable via the switch.
  - **Start a song from scratch:** from the empty state, click "Start a new
    song", then make a visual edit (e.g. set the metadata title), and assert the
    stored `song` attribute is non-empty and conformant (parse it and check the
    title) — no raw JSON typed.
  - **A visual edit is reflected in the stored song:** with a conformant song
    seeded (insert the block, switch to JSON, paste `CONFORMANT_SONG`, switch
    back to visual), change a field via the visual controls and assert the
    stored `song` reflects the change.
  - **Non-empty invalid song routes to JSON:** seed `NON_CONFORMANT_JSON` via
    JSON mode, switch to visual, and assert the invalid state is shown (an error
    message + a button to fix in JSON) and the structured editor is NOT shown.
  - **Live preview renders:** with a conformant song, assert an `<svg>` (the
    rendered sheet music) appears in the visual editor's preview area on the
    canvas.
  - **Round-trip preserves Spanish note names:** seed a conformant song using
    Spanish note names (e.g. a pitch `{ step: "do", octave: 4 }`) via JSON mode,
    switch to visual, make an UNRELATED edit (e.g. the title), and assert the
    stored `song` still contains `"step": "do"` (untouched pitch keeps its
    spelling).
- Keep using `@wordpress/e2e-test-utils-playwright` and `editor.getBlocks()` for
  attribute assertions. Do not introduce new dependencies.
- Ensure all test descriptions and comments contain NO pipeline/AC references.

**Depends on:** T12 (mode switch + visual default must exist), T9, T10.

**Traces to:** Req 1, 2, 3, 7, 9, 10; AC1, AC2, AC4, AC6, AC7, AC8, AC9, AC10,
AC11.

**Acceptance:**
- `specs/editor.spec.js` is updated and the new tests are added. After
  `npm run build && npm run env:start`, `npm run test:e2e` passes for the
  updated spec (note: the code-writer should at minimum get the spec to compile
  and the assertions to be correct against the built block; running the full
  Docker e2e may be environment-dependent — the spec MUST be internally
  consistent with the T12 UI and selectors).
- The raw field's label "Song (JSON)" and `.is-error` notice remain the JSON-mode
  selectors (unchanged behavior in JSON mode).

---

## T15 — Final integration check: build, lint, unit, and boundary audit

**Goal:** A consolidating pass to confirm the feature builds, all unit tests
pass, formatting is clean, and the editor-only boundary held.

**Files:**
- (no new files; may make small fixes across `src/editor/*` and `src/edit.js`,
  `src/style.scss` if the integration surfaces issues)

**Changes:**
- Run `npm run build` (webpack via `@wordpress/scripts`) and resolve any
  compile/bundle errors.
- Run `npm run test:unit` and resolve any failures across the new suites.
- Run `npm run check` (Biome) and apply formatting/lint fixes.
- **Boundary audit:** confirm via `git diff --name-only` that `src/view.js`,
  `src/render.php`, `src/block.json`, `src/song/schema.js`, and everything under
  `src/notation/` are UNCHANGED. If any appears, revert that change (the feature
  must not modify them).
- **Dependency audit:** confirm `package.json` has no new runtime dependency and
  all editor imports are from `@wordpress/*` or local `src/` modules.
- **Pipeline-reference audit:** grep the shipped `src/` and `specs/` for `.rp`,
  `AC1`..`AC12`, `Req`, `design §`, or task IDs and remove any that slipped in.

**Depends on:** T1–T14.

**Traces to:** Req 12, 13; AC10, AC12.

**Acceptance:**
- `npm run build` succeeds; `npm run test:unit` passes; `npm run check` reports
  clean (or only intended changes).
- `git diff --name-only` shows NO changes to `src/view.js`, `src/render.php`,
  `src/block.json`, `src/song/schema.js`, or `src/notation/**`.
- No new entry in `package.json` `dependencies`/`devDependencies`.
- No pipeline/AC reference remains in `src/**` or `specs/**`.

---

## Dependency order summary

```
T1  songModel helpers            (no deps)
T2  noteNames helper             (no deps)
T3  ListControls / AddButton     (no deps)
T13 serializeSong guard          (T1)
T4  context/metadata controls    (T1, T2, T3)
T5  annotations                  (T1, T3)
T6  pitches                      (T1, T2, T3)
T7  events                       (T1, T2, T3, T5, T6)
T8  structure (measure→song)     (T1, T3, T4, T5, T7)
T10 SongPreview                  (notation core only)
T9  SongEditor root + states     (T1, T2, T8, T13)
T11 editor styles                (T9, T10)
T12 Edit mode container          (T9, T10, T11)
T14 e2e updates                  (T12, T9, T10)
T15 integration + boundary audit (T1–T14)
```

Sequential execution order for the code phase: **T1, T2, T3, T13, T4, T5, T6,
T7, T8, T10, T9, T11, T12, T14, T15.**
