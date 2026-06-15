# Code Plan: Frontend toggle to show note names

## Overview

The Piano block renders a song as engraved sheet music on the published
frontend. This feature adds, to the frontend ONLY:

1. A viewer-facing toggle control (a native `<button>`) that turns the display
   of per-note pitch names on and off. Default OFF.
2. The note-name display: when ON, each nameable notehead shows its bare pitch
   name (an English letter such as "C", or a solfège syllable such as "do") in
   the song's own notation system — with no accidental marker and no octave.

The block editor is unchanged: no toggle, no names on its canvas. The dominant
constraint is byte-identity: when names are OFF (the default), the emitted SVG
and the layout model must be byte-for-byte identical to today's output, so the
existing editor-canvas / frontend SVG string-equality holds (AC10/AC11).

The work is delivered in coordinated layers, sequenced so that no code-writer
makes a design decision mid-task:

1. Extract the shared note-name vocabulary into a new frontend-safe module and
   re-export from the editor's `noteNames.js` (single source of truth — Task 1).
2. Thread a per-notehead `{ sFromBottom, step }` pair array through
   `layoutHand` / `stackChord`, adapting every downstream `number[]` consumer,
   and resolve + attach `head.name` behind a single flag at
   `buildLayoutModel(song, width, { showNoteNames, system })` (default OFF —
   Tasks 2 and 3).
3. Emit the name `<text>` in `svg.js` iff `head.name` is present, with the
   per-head-beside placement and a `stackAccidentals`-style rightward dodge
   (Task 4).
4. Server-render the interactive markup in `render.php` — the wrapper, the SSR
   `<button>`, the inner score `<div>`, and the seeded context — and wire the
   `view.js` store with `actions.toggleNoteNames`, the single `data-wp-watch`
   redraw funnel, parse-once caching, and client-side `hasNameableNotes` gating
   (Tasks 5 and 6).
5. Add the minimal button CSS to `style.scss` (Task 7).

Key reference facts pinned from the codebase (current line numbers):

- `src/notation/layout.js`: `stemDirectionForChord` at line 262 (`@param
  {number[]} positions`); `stackChord` at line 324 (input `number[]`);
  `layoutHand` at line 1462; the per-event walk that builds `positions` at lines
  1493-1500; accidentals loop at 1507-1517; ledger loop at 1521-1527; dot loop at
  1530-1537; `topStep`/`bottomStep` at 1558-1559; `buildLayoutModel` at line
  1747; `systemHeight` assembly at 1894-1952; `stackAccidentals` at line 690.
- `src/notation/svg.js`: `renderNote` at line 704; the per-head notehead loop at
  728-741; the `el()` helper at line 83 (it skips attributes whose value is
  `undefined` or `null`, line 86); `setText` at line 97; `fontGlyph` at 133.
- `src/notation/constants.js`: `NOTE_SIZE = 2.8` at line 183; `NOTEHEAD_RX = 0.6`
  at line 30; `DOT_OFFSET`, `DOT_GAP`, `ACCIDENTAL_COL_STEP` present.
- `src/editor/noteNames.js`: in-file `SYSTEMS` (35-38), `CANONICAL_LETTERS` (41),
  `SPANISH_TOKENS` (48), `stepsOf` (58-85), `inferNoteNameSystem` (97-104),
  `noteNameOptions` (114-117), `stepInSystem` (132-137), `noteLabel` (155-162),
  `mapSong` (184-199). Imports `__` from `@wordpress/i18n` and
  `isNoteName, normalizeStep` from `../song/normalizeStep.js`.
- `src/editor/__tests__/noteNames.test.js` imports `inferNoteNameSystem`,
  `mapSong`, `noteLabel`, `noteNameOptions`, `stepInSystem` from `../noteNames.js`
  (lines 20-26) — these names must remain importable from `noteNames.js`.
- `src/notation/__tests__/layout.test.js`: the four `stackChord([...numbers], …)`
  calls are at lines 285, 293, 303, 310.
- `src/edit.js:165-168`: `system = working?.language ?? inferNoteNameSystem(working)`
  — the editor parity expression to mirror in `view.js`.
- `src/render.php`: today emits one childless `data-wp-interactive` wrapper (line
  77) carrying `data-wp-init="callbacks.init"` but NO `data-wp-watch` (the watch
  directive is net-new in Task 5); seeds `song` + `accessibleName` into
  `data-wp-context`; returns early on an empty/whitespace song (line 63-65).
- `src/view.js`: a single `callbacks.init` (line 72) that parses once, builds a
  `draw` closure (92-95), gates on the music font (101), and attaches a
  `ResizeObserver` that calls `draw` directly (52-68, 103).
- `src/editor/SongCanvas.js:117,120`: calls `buildLayoutModel(song,
  availableWidthInSp(container))` (no third arg) and `renderInto(container,
  model, { accessibleName })` — MUST stay exactly as-is (AC11).
- `src/song/schema.js:44`: `language` is an enum `["spanish", "english"]` on the
  parsed song root, so `data.language` is the authoritative system field.

## Tasks

### Task 1: Extract the shared note-name vocabulary into `src/song/noteNameSystem.js`

**Goal**
Create exactly ONE definition of the per-system note-name spellings and the pure
resolution functions, consumed by both the editor and the layout layer, so that
frontend names equal editor names by construction (no second copy that can
drift).

**Files to change**
- New: `src/song/noteNameSystem.js`
- `src/editor/noteNames.js`

**Changes**
1. Create `src/song/noteNameSystem.js` as a frontend-safe module (it MUST NOT
   import `@wordpress/i18n`). MOVE the following from `src/editor/noteNames.js`
   into it verbatim (same definitions, same JSDoc):
   - the `SYSTEMS` object (`{ english: ["C","D","E","F","G","A","B"], spanish:
     ["do","re","mi","fa","sol","la","si"] }`),
   - `CANONICAL_LETTERS` (= `SYSTEMS.english`),
   - `SPANISH_TOKENS` (= `new Set(SYSTEMS.spanish)`),
   - the generator `stepsOf(song)`,
   - `inferNoteNameSystem(song)`,
   - `stepInSystem(step, system)`.
   Export `stepInSystem` and `inferNoteNameSystem` (the two functions the layout
   layer and `view.js` import). Also export `SYSTEMS` (re-consumed by
   `noteNames.js`'s `noteNameOptions`). `stepsOf` is the private generator that
   `inferNoteNameSystem` walks internally and has no frontend or editor consumer
   outside this module, so it stays MODULE-PRIVATE (not exported). The module's
   only import is `{ isNoteName, normalizeStep }` from `./normalizeStep.js` (note
   the relative path is now `./` since the module lives in `src/song/`).
2. In `src/editor/noteNames.js`:
   - REMOVE the moved in-file definitions of `SYSTEMS`, `CANONICAL_LETTERS`,
     `SPANISH_TOKENS`, `stepsOf`, `inferNoteNameSystem`, and `stepInSystem`.
   - IMPORT `stepInSystem` and `inferNoteNameSystem` from
     `../song/noteNameSystem.js`, plus import `SYSTEMS` from the same module
     (because `noteNameOptions` reads `SYSTEMS[system]`). Do NOT import `stepsOf`
     — `noteNames.js` never called it directly (only `inferNoteNameSystem` did,
     and that now lives in the new module).
   - RE-EXPORT the public symbols that existing importers expect FROM
     `noteNames.js`: `export { inferNoteNameSystem, stepInSystem } from
     "../song/noteNameSystem.js";` so that `noteNames.test.js` (which imports
     `inferNoteNameSystem` and `stepInSystem` from `../noteNames.js`) keeps
     working unchanged. `noteNameOptions`, `noteLabel`, and `mapSong` stay
     defined in `noteNames.js` and now consume the imported `stepInSystem` /
     `SYSTEMS`.
   - Keep `noteNames.js`'s own `@wordpress/i18n` import (still needed for
     `noteLabel`'s `__("rest", "piano-block")`).
3. Make NO behavior change to the editor. The functions resolve names exactly as
   before; only their definition site moves.

**Depends on**
None.

**Traces to**
Design Components "New: `src/song/noteNameSystem.js`" and "Changed:
`src/editor/noteNames.js`"; Design Key Decision 3; Spec FR4 (frontend names match
editor names); AC3.

**Acceptance**
- `src/song/noteNameSystem.js` exists, exports `stepInSystem`,
  `inferNoteNameSystem`, and `SYSTEMS` (and does NOT export `stepsOf`, which
  stays private to the module), and does not reference `@wordpress/i18n`.
- The spelling arrays, `CANONICAL_LETTERS`, and `SPANISH_TOKENS` are defined in
  exactly one place across the codebase (no duplicate definition remains in
  `noteNames.js`).
- `stepInSystem` and `inferNoteNameSystem` are still importable from
  `src/editor/noteNames.js` (re-exported), and `noteNameOptions`, `noteLabel`,
  and `mapSong` still resolve names identically to before.
- The existing `noteNames.test.js` suite passes without modification to that test
  file.

---

### Task 2: Thread per-notehead `{ sFromBottom, step }` pairs through `stackChord` and `layoutHand`

**Goal**
Replace the `positions: number[]` chord representation with an atomic
`{ sFromBottom, step }` pair array (`headInputs`) so each notehead's `step` stays
bound to its staff position through the filter and through `stackChord`'s sort —
WITHOUT changing the names-off output. This is a pure structural refactor; no name
is resolved yet.

**Files to change**
- `src/notation/layout.js`
- `src/notation/__tests__/layout.test.js` (migrate the 4 existing `stackChord`
  call sites only — see note; do NOT add new tests)

**Changes**
1. `stackChord` (line 324): change the input parameter from a `number[]` named
   `positions` to a `{ sFromBottom, step }[]` named `headInputs`.
   - Update the sort comparator from `(a, b) => a - b` to `(a, b) =>
     a.sFromBottom - b.sFromBottom` (it now sorts head OBJECTS).
   - Update the head-build `map` so each head reads `sFromBottom` and `step` from
     the pair: each returned head object carries `sFromBottom`, `y`
     (`staffStepToY(sFromBottom, bottomLineY)`), `side`, `displaced`, AND `step`
     (the `step` rides the sort). The seconds-rule loop (lines 338-346) is
     UNCHANGED (it already reads `heads[i].sFromBottom`).
   - The return shape is purely additive: heads gain a `step` field; existing
     consumers of `sFromBottom`/`y`/`side`/`displaced` are untouched.
   - Update the JSDoc `@param` and `@return` accordingly.
2. In `layoutHand` (the per-event walk, lines 1493-1500): replace the
   `positions` array build with a `headInputs` build in the same pass, so the
   `.filter()` drops a pair atomically:
   ```js
   const headInputs = pitches
     .map((p) => ({ sFromBottom: pitchToStaffStep(p, ctx.clef), step: p?.step }))
     .filter((h) => h.sFromBottom !== null);
   if (headInputs.length === 0) { collectEventTexts(event, x, texts); return; }
   ```
3. Adapt EVERY downstream consumer that previously read `positions: number[]` —
   there is exactly ONE prescribed expression for each, so two implementers
   cannot diverge:
   - `stemDirectionForChord` (line 1503, inside `layoutHand`): call
     `stemDirectionForChord(headInputs.map((h) => h.sFromBottom))`.
     `stemDirectionForChord`'s signature stays `number[]` (UNCHANGED at line
     262); its unit tests are untouched. NOTE: `stemDirectionForChord` has TWO
     callers in `layout.js` — this one at line 1503 (the only one changed here)
     and a second at line 512 (`beamGeometry`), which passes an independent
     `number[]` (`allSteps`) and is UNAFFECTED because the signature is preserved.
     Do not change the line 512 call.
   - `stackChord` (line 1504): call `stackChord(headInputs, direction)`.
   - Accidentals loop (lines 1507-1517): build the accidental inputs from the
     same paired walk that produced `headInputs` (each pair carries the resolved
     `sFromBottom` and the originating pitch's glyph). Concretely, walk `pitches`
     with its index and read `headInputs[pi]?.sFromBottom` for the position (or
     build accInputs in the headInputs pass) — the resulting `accInputs` array
     and the `stackAccidentals(accInputs)` call must produce the SAME accidental
     records as today. Preserve today's `if (sFromBottom === undefined) return;`
     guard semantics.
   - Ledger loop (line 1521-1527): iterate `for (const { sFromBottom: s } of
     headInputs)` instead of `for (const s of positions)`.
   - Dot loop (lines 1530-1537): iterate `for (const { sFromBottom: s } of
     headInputs)` instead of `for (const s of positions)`.
   - `topStep` (line 1558): `Math.max(...headInputs.map((h) => h.sFromBottom))`.
   - `bottomStep` (line 1559): `Math.min(...headInputs.map((h) => h.sFromBottom))`.
4. Migrate the 4 existing `stackChord` unit-test call sites at
   `src/notation/__tests__/layout.test.js` lines 285, 293, 303, 310 from the
   `number[]` input to the `{ sFromBottom, step }[]` input (e.g. `stackChord([0,
   2, 4], "up")` becomes `stackChord([{ sFromBottom: 0, step: "C" }, {
   sFromBottom: 2, step: "E" }, { sFromBottom: 4, step: "G" }], "up")`, using any
   placeholder `step` values; the test assertions on `sFromBottom`/`side`/
   `displaced` stay as they are). This keeps the suite green because the task
   changes the function contract. Do NOT add or design new test cases.

**Depends on**
None (can run in parallel with Task 1; both touch different files except this
one does not touch `noteNames.js`). It is safest to sequence Task 2 before Task 3
since Task 3 builds on `headInputs`.

**Traces to**
Design Key Decision 3; Design "layout.js downstream adaptations"; Spec FR5; AC2.

**Acceptance**
- `stackChord` accepts `{ sFromBottom, step }[]`, sorts by `sFromBottom`, and its
  returned heads each carry `step` in addition to today's fields.
- `layoutHand` builds `headInputs` once and every former `positions` consumer
  reads from it via the prescribed expressions; `stemDirectionForChord` is still
  called with a `number[]` and its signature is unchanged.
- For any conformant song, the layout model produced with no third argument is
  unchanged versus before this task (no `head.name` is added yet; notehead
  geometry, accidentals, ledgers, dots, stems, `topStep`/`bottomStep`, and
  `systemHeight` are identical).
- The full `layout.test.js` suite passes, with only the 4 migrated `stackChord`
  call sites changed in that file.

---

### Task 3: Add the single flag site and per-head name resolution in `buildLayoutModel` / `layoutHand`

**Goal**
Add ONE flag site — `buildLayoutModel(song, width, { showNoteNames = false,
system } = {})` — default OFF, that threads to `layoutHand`, which resolves each
notehead's BARE name via `stepInSystem(step, system)` and attaches it as
`head.name` ONLY when names are requested. When off, the `name` key is omitted
entirely (not set to `undefined`), so the model is byte-identical to today.

**Files to change**
- `src/notation/layout.js`

**Changes**
1. Change `buildLayoutModel`'s signature (line 1747) from `(song,
   availableWidthInSp)` to `(song, availableWidthInSp, { showNoteNames = false,
   system } = {})`. Thread `{ showNoteNames, system }` down to every `layoutHand`
   call inside `buildLayoutModel` (locate the `layoutHand(...)` invocations for
   the right and left hands and pass the options object as a new trailing
   argument).
2. Change `layoutHand`'s signature (line 1462) to accept the options
   `{ showNoteNames = false, system } = {}` as a new trailing parameter.
3. After `stackChord` returns the sorted head objects (line 1504), attach names
   ONLY when requested:
   ```js
   if (showNoteNames) {
     heads.forEach((h) => { h.name = stepInSystem(h.step, system); });
   }
   ```
   When `showNoteNames` is false, do nothing — the `name` key MUST NOT appear on
   the head object at all (do not set it to `undefined`).
4. Import `stepInSystem` into `layout.js` from `../song/noteNameSystem.js` (the
   module created in Task 1).
5. Do NOT change any vertical-geometry term. `head.name`, `system`, and
   `showNoteNames` MUST NOT be read by `topMarginLayout`, `ledgerTopExtent`, the
   lane-occupancy scan, or the `systemHeight` sum (lines 1894-1952). The name is
   a purely additive per-head string attached after all geometry is computed; the
   baseline grid and `systemHeight` are identical in both states.

**Depends on**
Task 1 (provides `stepInSystem` in `src/song/noteNameSystem.js`); Task 2
(provides `headInputs` with `step`, and head objects carrying `step`).

**Traces to**
Design Approach layer 3; Design Key Decisions 2 and 3; Design "Name resolution"
and "System box and baseline grid invariance when names are ON"; Spec FR4, FR5,
FR13; AC2, AC3, AC10, AC11.

**Acceptance**
- `buildLayoutModel(song, width)` and `buildLayoutModel(song, width, {
  showNoteNames: false, system })` produce a model in which no head object has a
  `name` key, and that model is byte-identical to the pre-task model for the same
  song and width.
- `buildLayoutModel(song, width, { showNoteNames: true, system: "english" })`
  attaches `head.name` to every notehead as the bare step resolved through
  `stepInSystem` (e.g. a C-sharp head's `name` is `"C"`, with no `#` and no
  octave); with `system: "spanish"` the same head's `name` is `"do"`.
- Turning names on does not change any staff line, notehead Y, clef/brace
  position, system vertical origin, or `systemHeight` for a common fixture
  (names are additive only).
- The full `layout.test.js` suite passes.

---

### Task 4: Emit the note-name `<text>` in `svg.js` with per-head-beside placement and rightward dodge

**Goal**
In `renderNote`, append one inert `<text>` per head iff `head.name` is present,
positioned to the RIGHT of the notehead (clear of left-side accidentals, past
dots), at the head's true pitch height, in a new smaller `NOTE_NAME_SIZE`, with a
`data-note-name` observability attribute. No flag is added to `svg.js` — the
presence of `head.name` is the only signal. Clashing chord/run names are dodged by
a parameterized reuse of the existing `stackAccidentals` greedy column-pack.

**Files to change**
- `src/notation/constants.js`
- `src/notation/svg.js`

**Changes**
1. In `src/notation/constants.js`, add:
   - `NOTE_NAME_SIZE = 1.8` (1.8 staff units; a sibling of `NOTE_SIZE`), with
     JSDoc explaining it is the note-name font size.
   - A `NAME_GAP` spacing constant (the small horizontal gap between the notehead
     right edge and the name's start; pick a value consistent with the existing
     spacing constants such as `DOT_OFFSET`/`ACCIDENTAL_GAP`). JSDoc it.
2. In `src/notation/svg.js`, import `NOTE_NAME_SIZE` and `NAME_GAP` from
   `./constants.js` (add to the existing constants import block near line 35).
3. In `renderNote` (line 704), after the existing notehead loop (and after dots,
   so the geometry can account for dots), append name `<text>` nodes. For each
   head where `head.name` is present:
   - Compute the per-head beside position per the design's placement geometry:
     ```
     x = note.x + NOTEHEAD_RX + NAME_GAP
         + (head.displaced ? 2 * NOTEHEAD_RX : 0)
         + (dotted ? dotReach : 0)   // push past the dots, which sit right
     y ≈ head.y + NOTE_NAME_SIZE * ~0.35   // small baseline nudge to center on head
     ```
     where `dotted` is `note.dots > 0` and `dotReach` is the rightmost dot dx
     already available from `note.dotSpecs` (use the max `dx` over `note.dotSpecs`
     for this head, or the chord; choose the chord-wide max so all names clear the
     dots — consistent with how dots are drawn).
   - Build the text node with the `el("text", {...})` + `setText` helpers used by
     the other text emitters (e.g. the annotation emitter at lines 1077-1086):
     `font-size: NOTE_NAME_SIZE`, `text-anchor: "start"`, `fill: INK`, and a
     `data-note-name` attribute (consistent with the existing
     `data-kind`/`data-hand`/`data-accidental`/`data-dot` stamping). Set the text
     content to `head.name` via `setText`.
   - Append each name node to the note's `<g>`.
4. Dodge clashing chord/run names with a parameterized reuse of `stackAccidentals`
   (the existing greedy column-pack at `layout.js:690`): names fan RIGHTWARD
   (positive dx, the opposite direction from accidentals' leftward), and the clash
   threshold widens to ≈4 staff-steps (the name's height at `NOTE_NAME_SIZE`).
   Either parameterize `stackAccidentals` (add a direction/threshold parameter
   defaulting to today's leftward/3-step behavior so existing callers are
   unaffected) OR call a thin wrapper around it; in both cases the names-OFF path
   MUST be untouched and existing `stackAccidentals` callers/tests must keep
   passing. `Y` stays at `head.y` so each name keeps its head's true pitch height.
   A no-dodge v1 (names at the base beside-position without column-packing) is an
   acceptable first tier against AC13's "not illegible" bar; the dodge is the
   recommended ship — implement the dodge.
5. Add NO `showNoteNames` flag to `svg.js`. When `head.name` is absent (names
   off), the head loop appends NOTHING new — the emitted SVG is byte-identical to
   today (the `el()` helper at line 86 already skips undefined attributes as a
   backstop).

**Depends on**
Task 3 (provides `head.name` on the model when names are on).

**Traces to**
Design Components "New: `NOTE_NAME_SIZE`" and "Changed: `src/notation/svg.js`";
Design Key Decision 8; Design "Note-name placement geometry"; Spec FR10, FR4
(no accidental/octave in the text — the name string comes pre-resolved bare from
layout); AC2, AC10, AC13.

**Acceptance**
- For a model built with `showNoteNames: true`, `renderNote` emits exactly one
  `<text data-note-name>` per notehead, positioned to the right of the head, at
  `font-size = NOTE_NAME_SIZE`, with the head's bare name as its text content;
  every notehead in a chord gets its own name (both staves).
- For a model with no `head.name` (names off), `renderNote` emits NO name text
  and the produced SVG string is byte-identical to today's for the same model.
- In a dense chord or run, names do not render in an illegibly overlapping way —
  they are column-packed rightward via the dodge; each name keeps its head's
  vertical pitch position.
- `NOTE_NAME_SIZE` and `NAME_GAP` exist in `constants.js`; the existing
  `stackAccidentals` callers and their tests still pass (the leftward 3-step
  default behavior is preserved).

---

### Task 5: Server-render the interactive markup and seeded context in `render.php`

**Goal**
Emit the interactive wrapper containing (a) an SSR `<button>` toggle and (b) a
dedicated inner score `<div>`, and seed the additional per-instance context
fields (`showNoteNames: false`, `hasNameableNotes: false`, the translated
`toggleLabel`, and a `width` redraw signal). The button is SSR'd WITH a literal
`hidden` attribute and stays hidden until the client confirms nameable notes.

**Files to change**
- `src/render.php`

**Changes**
1. Compute the translatable label once per render, under the existing text
   domain: `$toggle_label = __( 'Show note names', 'piano-block' );`.
2. Extend the `$context` array (currently lines 72-75) with the new fields:
   - `'showNoteNames' => false`,
   - `'hasNameableNotes' => false`,
   - `'toggleLabel' => $toggle_label`,
   - `'width' => 0`.
   Keep the existing `'song'` and `'accessibleName'` entries. The context is still
   encoded by `wp_interactivity_data_wp_context( $context )` (same mechanism, no
   new machinery).
3. Replace the single childless wrapper (line 77) with a wrapper that has TWO
   children:
   ```html
   <div data-wp-interactive="piano-block/piano"
        <?php echo wp_interactivity_data_wp_context( $context ); ?>
        data-wp-init="callbacks.init"
        data-wp-watch="callbacks.draw"
        <?php echo get_block_wrapper_attributes(); ?>>
     <button type="button"
             data-wp-on--click="actions.toggleNoteNames"
             data-wp-bind--aria-pressed="context.showNoteNames"
             data-wp-bind--hidden="!context.hasNameableNotes"
             data-wp-text="context.toggleLabel"
             hidden></button>
     <div class="wp-block-piano-block-piano__score"></div>
   </div>
   ```
   The button markup is empty (`data-wp-text` fills its visible text on
   hydration); its text content is its accessible name and `aria-pressed` conveys
   state. The button carries the LITERAL `hidden` attribute so it is hidden
   pre-JS and FOUC-safe (the directive's first computed value, given the seeded
   `hasNameableNotes: false`, is also hidden — no flash, no mismatch).

   This `render.php` markup is the SOLE owner of the
   `data-wp-watch="callbacks.draw"` directive. The directive is an HTML attribute
   that only server-rendered markup can carry; it is what binds the
   `callbacks.draw` redraw funnel (registered in Task 6's `view.js` store) to
   per-instance context changes (`showNoteNames`, `width`). Task 6 does NOT add
   it (it physically cannot — `view.js` registers store callbacks and never
   writes attributes onto the wrapper). It MUST appear exactly once, on the
   wrapper, here.
4. Keep the early `return` for an empty/whitespace song (lines 63-65) and the
   accessible-name computation unchanged. The render-or-nothing decision stays
   100% client-side; PHP still does NOT validate or gate on conformance.

**Depends on**
None for the markup itself, but it pairs with Task 6 (the `view.js` directives
must exist for the button to function). Sequence Task 5 with or before Task 6.

**Traces to**
Design Approach layer 1; Design Key Decisions 1, 5, 6, 7; Design "Server-rendered
markup (render.php)"; Spec FR1, FR3, FR6, FR8, FR11, FR12; AC1, AC4, AC5, AC8,
AC9, AC12.

**Acceptance**
- A rendered conformant Piano block's frontend markup contains a
  `data-wp-interactive` wrapper holding a single `<button>` (with
  `type="button"`, `data-wp-on--click="actions.toggleNoteNames"`,
  `data-wp-bind--aria-pressed="context.showNoteNames"`,
  `data-wp-bind--hidden="!context.hasNameableNotes"`,
  `data-wp-text="context.toggleLabel"`, and a literal `hidden` attribute) and a
  sibling inner `<div class="wp-block-piano-block-piano__score">`.
- The wrapper `<div>` carries exactly one `data-wp-watch="callbacks.draw"`
  attribute (alongside `data-wp-init="callbacks.init"`) — this is the sole place
  the watch directive is emitted.
- The seeded `data-wp-context` includes `showNoteNames: false`,
  `hasNameableNotes: false`, a `toggleLabel` string produced by `__('Show note
  names', 'piano-block')`, and `width: 0`, alongside the existing `song` and
  `accessibleName`.
- An empty/whitespace song still produces no wrapper at all.
- With JS disabled, the button is hidden (literal `hidden`) and no score is
  drawn (no dangling control).

---

### Task 6: Wire the `view.js` store — toggle action, single watch redraw funnel, parse-once cache, and client gating

**Goal**
Rework the `view.js` store so that: a `data-wp-watch` callback is the SINGLE owner
of the imperative draw and reads BOTH `context.showNoteNames` and a
`context.width` signal; `actions.toggleNoteNames` mutates `context.showNoteNames`
in place; the `ResizeObserver` writes `context.width` instead of calling draw
directly; the parsed song is cached per instance (since the draw leaves `init`'s
scope); both the draw and width measurement target the INNER score `<div>` (not
the wrapper); and `init` computes `hasNameableNotes` from the built model so the
button reveals only when nameable notes exist.

**Files to change**
- `src/view.js`

**Changes**
1. Update imports: add `inferNoteNameSystem` from `./song/noteNameSystem.js`
   (the module created in Task 1). Keep the existing `store`, `getContext`,
   `getElement` from `@wordpress/interactivity`, and the notation imports. Do NOT
   import `@wordpress/i18n` (the label comes from context).
2. Add `actions.toggleNoteNames`:
   ```js
   toggleNoteNames() {
     const c = getContext();
     c.showNoteNames = !c.showNoteNames; // mutate in place; never reassign
   }
   ```
3. Rework `callbacks.init`:
   - Read the wrapper from `getElement().ref`, then resolve the inner score div:
     `const score = wrapper.querySelector('.wp-block-piano-block-piano__score');`.
   - Run `parseAndValidate(context.song)` ONCE; on error, draw nothing, leave
     `hasNameableNotes` false, and return (the existing early-return semantics).
   - Cache the parsed `data` (and, per the next bullet, the `fontReady` flag) in a
     per-instance memo reachable by the watch `draw` (e.g. a `WeakMap` keyed by
     the wrapper or score element, or fields stored on the context — choose the
     per-instance-safe form; do NOT use a module-level single variable that would
     leak across instances). `draw` re-resolves this memo by the same element key,
     so the choice of memo form MUST be one `draw` can look up from
     `getElement().ref` + the `.__score` selector alone.
   - Build the layout model once (names off) and set
     `context.hasNameableNotes = true` ONLY when the model has ≥1 note record:
     `model.systems.some(s => s.measures.some(m => (m.right?.notes?.length || 0)
     + (m.left?.notes?.length || 0) > 0))`. (Verify the exact model shape
     against `buildLayoutModel`'s output and adjust the property path to match
     the real `systems[].measures[].{right,left}.notes` structure; the
     observable requirement is "true iff the song yields at least one notehead
     record".)
   - Gate the FIRST draw on the music font via `drawWhenFontReady`, and seed the
     `fontReady` flag in the SAME per-instance memo that holds the parsed `data`
     (so the watch `draw` reads both from one place) — set it true once the font
     gate resolves, so subsequent redraws do not re-wait. Until `fontReady` is
     true, `draw` returns early (the watch may fire before the font resolves).
   - Attach the `ResizeObserver` to the SCORE div (not the wrapper); on a width
     change it WRITES `context.width = availableWidthInSp(score)` (or a measured
     px value the draw converts) instead of calling draw directly. Keep the
     rAF-debounce. Return the disconnect cleanup.
4. Add `callbacks.draw`, registered in the store as the single redraw funnel. The
   `data-wp-watch="callbacks.draw"` attribute that binds this callback to context
   changes is owned by Task 5's `render.php` wrapper markup (it is an HTML
   attribute; `view.js` cannot and MUST NOT add it). Task 6 ONLY registers the
   `callbacks.draw` method in the store; it does not touch markup. The watch fires
   on `showNoteNames` and `width` changes because the callback reads both from
   context.

   Critically, `callbacks.draw` is a separate store method and does NOT close
   over `init`'s local scope (`init`'s `container`/`score`/`accessibleName`/`data`
   locals are NOT visible here). Each `draw` run MUST re-resolve everything it
   needs by the SAME means `init` uses, so the two never diverge and so there is
   no `ReferenceError`:
   - the wrapper from `getElement().ref`;
   - the inner score div from the SAME selector `init` uses:
     `wrapper.querySelector('.wp-block-piano-block-piano__score')`;
   - `accessibleName` from `getContext()`;
   - the parsed song and `fontReady` flag from the per-instance memo seeded by
     `init`, looked up by the same element key `init` stored under (per step 3 —
     never a module-level single variable).
   ```js
   draw() {
     const c = getContext();
     const show = c.showNoteNames;   // subscribes the watch to the toggle
     const width = c.width;          // subscribes the watch to resize
     const { ref: wrapper } = getElement();
     const score = wrapper.querySelector('.wp-block-piano-block-piano__score');
     const memo = /* per-instance memo lookup keyed by wrapper/score (step 3) */;
     if (!memo || !memo.fontReady) return;  // first run awaits init's font gate
     const data = memo.data;                // parsed once by init, reused here
     const { accessibleName } = c;          // read from context, not init's scope
     const system = data.language ?? inferNoteNameSystem(data);
     const model = buildLayoutModel(data, availableWidthInSp(score),
       { showNoteNames: show, system });
     renderInto(score, model, { accessibleName });
   }
   ```
   Each redraw recomputes model + SVG from scratch from the cached parsed song;
   the render is pure, so identical inputs yield byte-identical output (no drift).
5. `renderInto` and width measurement both target the inner score `<div>` so the
   `replaceChildren` draw never wipes the SSR button. Because `draw` re-resolves
   the score div from `getElement().ref` + the same
   `.wp-block-piano-block-piano__score` selector `init` uses, both lifecycles
   operate on the identical per-instance element.

**Depends on**
Task 1 (`inferNoteNameSystem` from the shared module), Task 3 (the
`buildLayoutModel` flag signature), Task 4 (name emission, so an on-toggle
actually draws names), Task 5 (the SSR button, inner score div, seeded context,
and the `data-wp-watch` wrapper attribute).

**Traces to**
Design Approach layer 1; Design Key Decisions 1, 4, 5, 6, 7; Design "View module
store (view.js)", "Name resolution", and the toggle/resize data-flow notes; Spec
FR2, FR3, FR6, FR7, FR9, FR11, FR12; AC1, AC2, AC4, AC6, AC7, AC9, AC12.

**Acceptance**
- Clicking the toggle flips `context.showNoteNames`, the `data-wp-watch` `draw`
  re-fires, and the score is fully re-rendered: names appear for every nameable
  note when on; clicking again removes all names and restores the original
  names-off score.
- Toggling, then resizing (a width change), preserves the current toggle state:
  names stay on across a resize (the watch reads the live `showNoteNames` each
  fire).
- Repeated on/off/on cycles produce a names-on rendering identical to the first
  names-on rendering and a names-off rendering identical to the original (no
  drift) — the draw is a full recompute from the cached parsed song.
- Two Piano blocks on one page toggle independently: turning names on for block A
  shows names only in A; B is unaffected (state is per-instance local context).
- The SSR `<button>` survives every redraw (the draw replaces children of the
  inner score `<div>`, not the wrapper).
- For a conformant song with at least one notehead, `init` sets
  `hasNameableNotes` true and the button becomes visible; for an all-rests
  conformant song (no note records) or an invalid/empty song, the flag stays
  false and the button stays hidden.
- The parsed song is parsed exactly once per instance and reused on every redraw
  (no re-parse on toggle or resize).
- `callbacks.draw` references no identifier from `init`'s closure: it re-resolves
  the wrapper via `getElement().ref`, the score div via the
  `.wp-block-piano-block-piano__score` selector, `accessibleName` via
  `getContext()`, and `data`/`fontReady` via the per-instance memo — so it runs
  without `ReferenceError` and resolves the same element `init` does.
- `view.js` does not write the `data-wp-watch` attribute (it is owned by Task 5's
  `render.php` markup); `view.js` only registers the `callbacks.draw` store
  method.

---

### Task 7: Add minimal frontend button styling in `style.scss`

**Goal**
Add the small net-new frontend CSS for the toggle button (spacing below it so it
sits above the score in normal flow without overlapping), keeping today's
`@font-face`-only file otherwise intact.

**Files to change**
- `src/style.scss`

**Changes**
1. Append a minimal rule set for the toggle button and/or the inner score
   container that gives the button spacing below it (e.g. a small
   `margin-bottom`) so the button sits ABOVE the score in normal flow,
   discoverable and not overlapping the SVG. Target the button via the block
   class (e.g. a selector scoped under `.wp-block-piano-block-piano`) and/or the
   inner `.wp-block-piano-block-piano__score` container; keep it minimal.
2. Do not alter the existing `@font-face` declaration.

**Depends on**
Task 5 (the button and inner score `<div>` markup must exist to style).

**Traces to**
Design Components "Changed: `src/style.scss`"; Design Key Decision 5 (button
above score, no overlap); Spec FR1, FR10; AC1, AC13.

**Acceptance**
- The frontend toggle button is visually separated from the score (it sits above
  the score with spacing and does not overlap the SVG).
- The existing `@font-face` rule is unchanged and the font still loads on the
  frontend.

---

## Coverage check (every spec AC mapped to a task)

- AC1 (control present, default off): Task 5 (SSR button, seeded `showNoteNames:
  false`), Task 6 (init draws no names first), Task 7 (placement).
- AC2 (toggle shows/hides all names): Task 6 (toggle action + watch redraw), Task
  3 (name resolution), Task 4 (name emission).
- AC3 (system follows song, no accidental/octave): Task 1 (shared `stepInSystem`),
  Task 3 (bare-step resolution), Task 6 (`system = data.language ?? infer`).
- AC4 (per-instance independence): Task 5 (local context), Task 6 (per-instance
  cache, no global state).
- AC5 (state exposed to AT): Task 5 (`data-wp-bind--aria-pressed`).
- AC6 (reversible/idempotent, no drift): Task 6 (full recompute from cached parse),
  Tasks 3/4 (pure model + emit).
- AC7 (names survive width change): Task 6 (single watch funnel reads live flag +
  width).
- AC8 (translatable label): Task 5 (`__('Show note names', 'piano-block')` into
  context, `data-wp-text`).
- AC9 (no nameable notes → no control): Task 6 (`hasNameableNotes` gating), Task 5
  (`data-wp-bind--hidden`, literal `hidden`).
- AC10 (names-off byte-identical, frontend + editor equivalence): Task 2
  (structural refactor preserves output), Task 3 (single flag, default off,
  `name` key omitted), Task 4 (no `svg.js` flag, nothing emitted when off).
- AC11 (editor never shows names): preserved by NOT changing
  `SongCanvas.js`'s no-third-arg `buildLayoutModel` call (Tasks 3/4 keep the
  default OFF path intact).
- AC12 (invalid/empty → no score + no control): Task 5 (empty → no wrapper), Task
  6 (invalid → init returns early, `hasNameableNotes` stays false).
- AC13 (names legible/non-overlapping): Task 4 (small `NOTE_NAME_SIZE`,
  per-head-beside placement, rightward dodge), Task 7 (button spacing).
