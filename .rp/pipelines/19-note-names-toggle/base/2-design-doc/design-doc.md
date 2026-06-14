# Design Doc: Frontend toggle to show note names

## Overview

The Piano block renders a song as engraved sheet music (a grand staff with
noteheads, stems, accidentals, clefs, etc.) on the published frontend. Today the
frontend shows no pitch names anywhere on the score.

This feature adds, to the frontend only:

1. A viewer-facing toggle control, associated with its own block's score, that
   turns the display of note names on and off. Default OFF.
2. The note-name display itself: when ON, each nameable notehead shows its bare
   pitch name (an English letter such as "C", or a solfège syllable such as "do")
   in the song's own notation system — with no accidental marker and no octave
   number.

The block editor is unchanged: it gains no toggle and its score canvas continues
to show no note names. The names-off output must remain byte-identical to today's
output, preserving the existing editor-canvas / frontend SVG string-equality
guarantee.

This is the first interactive (viewer-operable) UI on the block's frontend. The
toggle is built with the WordPress Interactivity API (a hard spec constraint),
with per-instance state so each block toggles independently.

### How the design satisfies each acceptance criterion

- **AC1 (control present, default OFF):** `render.php` SSRs a `<button>` and seeds
  `showNoteNames: false` per instance; the first paint draws no names. (See
  "Interactivity wiring", Key Decision 1.)
- **AC2 (toggle shows/hides all names):** the toggle mutates the local context
  boolean; a `data-wp-watch` callback re-fires and the score is fully re-rendered
  from the pure render path with the live flag — names on, then off restores the
  original bytes. (Key Decisions 1, 2, 4.)
- **AC3 (system follows song; no accidental, no octave):** the name is the bare
  step resolved through `stepInSystem(step, system)` where
  `system = data.language ?? inferNoteNameSystem(data)` — the same resolution the
  editor uses. The step carries no alteration and no octave. (Key Decision 3.)
- **AC4 (per-instance independence):** state lives in per-instance local
  `data-wp-context`, never in global Interactivity state, so a toggle mutates only
  its own block. (Key Decisions 1, 6.)
- **AC5 (state exposed to AT):** the native `<button>` carries
  `data-wp-bind--aria-pressed="context.showNoteNames"`. (Key Decision 1.)
- **AC6 (reversible / idempotent, no drift):** each redraw recomputes the model
  and SVG from scratch from the cached parsed song; the render is pure, so the
  same inputs produce byte-identical output. Pinned by an idempotency assertion.
  (Key Decisions 2, 4; "Failure Modes and Observability".)
- **AC7 (names survive a width change):** resize and toggle share ONE redraw
  funnel (the watch reads both `showNoteNames` and a width signal), so a resize
  re-fires the same path that reads the live flag. (Key Decision 4.)
- **AC8 (translatable label):** the toggle `<button>` is SSR'd by `render.php` (the
  PHP layer), which computes the label with PHP `__('Show note names', 'piano-block')`
  and ships it into per-instance `data-wp-context` as `toggleLabel`; the button's text
  is bound with `data-wp-text="context.toggleLabel"`. `view.js` never imports
  `@wordpress/i18n` and renders no label. (Key Decision 5.)
- **AC9 (no nameable notes → no control):** the button is SSR-hidden and gated on a
  `hasNameableNotes` flag that is computed on the CLIENT in `view.js`'s `init` (the
  server cannot, since validation/layout are client-side); an all-rests conformant
  song produces zero note records, so the flag stays false and the button stays
  hidden. (Key Decision 7.)
- **AC10 (names-off byte-identical, frontend default + editor equivalence):** ONE
  flag site (`buildLayoutModel`), default OFF; when off the model omits `head.name`
  and the emitted SVG is unchanged. Added an `outerHTML` pin test. (Key Decisions 2, 4.)
- **AC11 (editor never shows names):** the editor (`SongCanvas`) calls
  `buildLayoutModel` with no flag and renders into its own container with no button.
  (Key Decisions 2, 5.)
- **AC12 (invalid/empty → no score + no control):** empty song → no wrapper at all;
  invalid song → wrapper but the client validation returns early, leaving
  `hasNameableNotes` false and drawing nothing. (Key Decision 7.)
- **AC13 (names legible / non-overlapping):** per-head names use a new smaller
  `NOTE_NAME_SIZE`, sit beside the notehead, and dodge clashing chord/run names by
  reusing the existing tested `stackAccidentals` greedy column-pack. (Key Decision 8.)

## Approach

The feature is delivered in three coordinated layers, each chosen to keep the
names-OFF path byte-identical to today (the AC10/AC11 constraint that shapes every
decision):

1. **Interactivity layer (frontend wiring).** `render.php` server-renders the
   interactive markup — a wrapper carrying `data-wp-interactive`, a native
   `<button>` toggle as a child, and a dedicated inner score `<div>` that the SVG
   renders into. Per-instance local context holds `showNoteNames` (default false),
   `hasNameableNotes` (default false), the translated label, and a width/redraw
   signal. The view module (`view.js`) drives an imperative SVG draw through a
   single `data-wp-watch` callback that reads both `showNoteNames` and the width
   signal, so a toggle OR a resize re-fires one redraw path.

2. **Name-resolution layer (shared vocabulary).** A new frontend-safe module
   (sibling of `normalizeStep.js`) holds the per-system spellings and resolution
   functions, extracted from the editor's `noteNames.js`. This is a REFACTOR, not a
   copy: the editor's `noteNames.js` is changed to IMPORT those symbols from the new
   module (its in-file `SYSTEMS`/`CANONICAL_LETTERS`/`SPANISH_TOKENS` definitions and
   the `stepInSystem`/`inferNoteNameSystem`/`stepsOf` functions are MOVED to the shared
   module and re-exported/consumed, not duplicated). The layout layer imports
   `stepInSystem` from the SAME module. There is exactly ONE definition of the
   spellings and the resolution rule, so frontend names equal editor names by
   construction — satisfying FR4 ("the names shown on the frontend match the note-name
   strings the editor already uses") with no drift-prone second copy.

3. **Layout + emit layer (where names are computed and drawn).** A single flag
   site, `buildLayoutModel(data, width, { showNoteNames, system })`, threads the
   option to `layoutHand`, which resolves each notehead's bare name and attaches it
   to the head object (only when names are requested). The emit layer (`svg.js`)
   draws one `<text>` per head iff `head.name` is present — no flag in `svg.js`.

The central design tension is AC10 byte-identity. It is resolved by funnelling all
name behavior through ONE flag, defaulted OFF, with the rule that nothing about the
model or SVG changes when names are off (the `head.name` key is omitted entirely,
not set to `undefined`; every new vertical geometry term, if ever added, is gated
to 0 when off). A new `outerHTML` string-equality test converts this
by-construction property into a literally machine-checked guarantee.

The redraw mechanism is a full re-render (not CSS show/hide). CSS hiding was
rejected because it would leave name `<text>` nodes in the names-off DOM, breaking
byte-identity. A full re-render from the pure render path also makes idempotency
(AC6) free: same inputs always yield identical bytes.

## Components

### New

- **`src/song/noteNameSystem.js`** (new shared module). Frontend-safe (no
  `@wordpress/i18n` import). Becomes the SINGLE definition of the ordered per-system
  spelling arrays (`SYSTEMS = { english: [C..B], spanish: [do..si] }`),
  `CANONICAL_LETTERS`, `SPANISH_TOKENS`, and the pure functions
  `stepInSystem(step, system)`, `inferNoteNameSystem(song)`, and `stepsOf(song)`.
  These are MOVED out of `src/editor/noteNames.js` (which then imports them back), so
  the definition lives in exactly one place — not duplicated. Depends only on the
  existing `normalizeStep.js`.

- **`NOTE_NAME_SIZE`** constant in `src/notation/constants.js`. A new font-size
  constant of 1.8 staff units (14.4px at the 8px/sp scale), a sibling of
  `NOTE_SIZE`. Plus the small spacing constants the placement geometry needs
  (e.g. a `NAME_GAP`).

### Changed

- **`src/render.php`.** Now emits a wrapper containing (a) an SSR `<button>` toggle
  with `data-wp-on--click`, `data-wp-bind--aria-pressed`, `data-wp-text`, and a
  literal `hidden` attribute, and (b) an inner score `<div>`. Seeds the additional
  context fields (`showNoteNames: false`, `hasNameableNotes: false`, the translated
  label, and a width/redraw signal). The button is gated hidden via
  `data-wp-bind--hidden="!context.hasNameableNotes"`.

- **`src/view.js`.** The store gains `actions.toggleNoteNames` (mutates
  `context.showNoteNames` in place) and a `data-wp-watch` callback owning the
  imperative draw. `init` keeps parse-once (now cached, since the draw leaves
  `init`'s scope), the font gate, and the `ResizeObserver` (which now writes a
  context width signal instead of calling draw directly). Both `renderInto` and
  width measurement target the INNER score div, not the wrapper. `init` computes
  `hasNameableNotes` from the built model.

- **`src/notation/layout.js`.** `buildLayoutModel` accepts a third options arg
  `{ showNoteNames = false, system } = {}` and threads it to `layoutHand`.
  `layoutHand` builds an atomic `{ sFromBottom, step }` pair array per pitch (call
  it `headInputs`, replacing today's `positions: number[]`), and — only when
  `showNoteNames` — resolves each head's bare name via `stepInSystem(step, system)`
  and attaches `head.name`. `stackChord`'s input changes from `number[]` to
  `{ sFromBottom, step }[]` (sort comparator and head-build map updated; the
  seconds-rule loop is unchanged). `stemDirectionForChord` is NOT changed — it stays
  on `number[]`, and the single caller recovers the number array from the pairs (see
  "layout.js downstream adaptations" for every consumer's exact expression). The name
  dodge for clashing chord/run names reuses a parameterized form of the existing
  `stackAccidentals` packing.

- **`src/notation/svg.js`.** `renderNote` appends one inert `<text>` per head when
  `head.name` is present, at the per-head-beside position, with
  `font-size = NOTE_NAME_SIZE` and an observability `data-*` attribute. No flag is
  added to `svg.js`; the presence of `head.name` is the only signal.

- **`src/editor/noteNames.js`.** REFACTORED to single-source the vocabulary: its own
  in-file definitions of `SYSTEMS`, `CANONICAL_LETTERS`, `SPANISH_TOKENS`,
  `stepInSystem`, `inferNoteNameSystem`, and `stepsOf` are REMOVED and IMPORTED from
  the new `src/song/noteNameSystem.js` instead (re-exported where existing
  editor/test importers expect them from `noteNames.js`, so the editor's public
  surface is preserved). It keeps the editor-only pieces: `noteLabel` (and its
  editor-side `__("rest", "piano-block")`), `mapSong`, and `noteNameOptions` (these
  consume the now-imported `stepInSystem`/`SYSTEMS`). No editor BEHAVIOR changes — the
  editor resolves names through the exact same code the frontend does, which is what
  makes FR4 hold by construction (one source, no copy that can drift). Existing
  `noteNames.test.js` continues to import from `noteNames.js` and passes unchanged.

- **`src/style.scss`.** Net-new minimal frontend CSS for the button (spacing below
  it). Today this file is `@font-face` only.

### Unchanged (load-bearing)

- **`src/editor/SongCanvas.js`** keeps calling `buildLayoutModel(song, width)` with
  no third arg and `renderInto(container, model, { accessibleName })` — so the
  editor never resolves a name (AC11) and the names-off equivalence holds (AC10).
- **`stemDirectionForChord`** stays on `number[]` (signature unchanged: `layout.js`
  line 262, `@param {number[]} positions`). Its one caller inside `layoutHand`
  recovers the number array from the new pair array:
  `stemDirectionForChord(headInputs.map((p) => p.sFromBottom))`. Its unit tests are
  untouched.

## Interfaces and Data Flow

### Server-rendered markup (render.php)

```html
<div data-wp-interactive="piano-block/piano"
     data-wp-context='{ "song": "...", "accessibleName": "...",
                        "showNoteNames": false, "hasNameableNotes": false,
                        "toggleLabel": "Show note names", "width": 0 }'
     data-wp-init="callbacks.init"
     ...block wrapper attrs...>
  <button type="button"
          data-wp-on--click="actions.toggleNoteNames"
          data-wp-bind--aria-pressed="context.showNoteNames"
          data-wp-bind--hidden="!context.hasNameableNotes"
          data-wp-text="context.toggleLabel"
          hidden></button>
  <div class="wp-block-piano-block-piano__score"></div>
</div>
```

Notes:
- The button is SSR'd WITH the `hidden` attribute (FOUC-safe). The directive's
  first computed value, given the seeded `hasNameableNotes: false`, is also
  `hidden` — so the SSR attribute matches the directive's first value (no flash, no
  duplication conflict).
- The button markup is empty (`data-wp-text` fills it). Its text content is its
  accessible name; `aria-pressed` conveys state.
- The inner score `<div>` is the only place the SVG is written, so the
  `replaceChildren` draw never wipes the button.

### View module store (view.js)

```js
store('piano-block/piano', {
  actions: {
    toggleNoteNames() {
      const c = getContext();
      c.showNoteNames = !c.showNoteNames; // mutate in place; never reassign
    },
  },
  callbacks: {
    init() {
      // wrapper = getElement().ref; score = wrapper.querySelector('.…__score')
      // parse-once (cached): parseAndValidate(context.song)
      //   on error -> draw nothing, leave hasNameableNotes false, return
      // compute hasNameableNotes from the built model (>=1 note record)
      // gate first draw on the music font (drawWhenFontReady) -> seed fontReady
      // ResizeObserver on the SCORE div: on width change, write context.width
      // return teardown that disconnects the observer
    },
    draw() {                                    // wired by data-wp-watch
      const c = getContext();
      const show = c.showNoteNames;             // subscribes the watch
      const width = c.width;                    // subscribes the watch
      if (!c.fontReady /* or first run awaits font */) return;
      const data = cachedParsedSong;            // per-instance memo, parsed once
      const system = data.language ?? inferNoteNameSystem(data);
      const model = buildLayoutModel(data, availableWidthInSp(scoreDiv),
                                     { showNoteNames: show, system });
      renderInto(scoreDiv, model, { accessibleName });
    },
  },
});
```

Data flow on a toggle: click → `actions.toggleNoteNames` mutates
`context.showNoteNames` → the `data-wp-watch` `draw` re-fires (it read the live
proxy) → `buildLayoutModel` is called with the live flag → `renderInto` replaces
the inner score SVG.

Data flow on a resize: `ResizeObserver` writes `context.width` → the same `draw`
watch re-fires (it read `context.width`) → redraw at the new width with the live
`showNoteNames`. One funnel; AC7 falls out for free.

### Name resolution

```
view.js:  system = data.language ?? inferNoteNameSystem(data)   // == editor src/edit.js:166-167 (working?.language ?? infer)
          buildLayoutModel(data, width, { showNoteNames, system })
            -> layoutHand(..., { showNoteNames, system })
                 headInputs = pitches.map(p => ({ sFromBottom: pitchToStaffStep(p), step: p.step }))
                                    .filter(h => h.sFromBottom !== null)   // {sFromBottom, step}; filter drops a pair atomically
                 direction = stemDirectionForChord(headInputs.map(h => h.sFromBottom))  // number[] recovered; signature unchanged
                 heads = stackChord(headInputs, direction)                // sorts head OBJECTS; step rides the sort
                 if (showNoteNames) heads.forEach(h => h.name = stepInSystem(h.step, system))  // bare step, no alter, no octave
svg.js:   renderNote: for each head, if (head.name) append <text> beside the head  // emit iff name present
```

`stepInSystem` resolves the BARE step (e.g. canonical `C`) into the song's system
(`C` for English, `do` for Spanish) with no accidental and no octave — satisfying
AC3. Because both editor and frontend resolve through the same extracted module on
the same parsed-song field path, the strings match by construction (R4).

### layout.js downstream adaptations (mechanical, one function)

Today, inside `layoutHand` (`layout.js:1493-1559`), `positions` is a `number[]`:
`pitches.map((p) => pitchToStaffStep(p, ctx.clef)).filter((s) => s !== null)`. The
ONLY structural change is: rename/replace `positions` with `headInputs`, an array of
`{ sFromBottom, step }` pairs built in the same pass, so the `.filter()` drops a pair
atomically and the step stays bound to its position:

```js
const headInputs = pitches
  .map((p) => ({ sFromBottom: pitchToStaffStep(p, ctx.clef), step: p?.step }))
  .filter((h) => h.sFromBottom !== null);
if (headInputs.length === 0) { /* …existing empty-chord early return… */ }
```

`stackChord` now takes `headInputs` (its input becomes `{ sFromBottom, step }[]`).
Every OTHER consumer that previously read `positions: number[]` recovers numbers from
the pairs — there is exactly ONE way to do this, so two implementers cannot diverge:

- **`stemDirectionForChord`** (line 1503): call
  `stemDirectionForChord(headInputs.map((h) => h.sFromBottom))`. Signature unchanged
  (`number[]`); tests untouched.
- **Accidentals loop** (lines 1508-1517): the `pitches.forEach((p, pi) => …)` walk
  reads `headInputs[pi].sFromBottom` (still index-aligned with `pitches` only when no
  pitch filtered out; see the note below) instead of `positions[pi]`. To remove the
  index-lockstep risk entirely, prefer building the accidental inputs from the same
  paired walk that produced `headInputs` (each pair already carries the resolved
  `sFromBottom` and the originating pitch's `glyph`). Either form is acceptable; the
  paired-walk form is recommended.
- **Ledger loop** (line 1522) and **dot loop** (line 1532): iterate
  `for (const { sFromBottom: s } of headInputs)` instead of `for (const s of positions)`.
- **`topStep` / `bottomStep`** (lines 1558-1559):
  `Math.max(...headInputs.map((h) => h.sFromBottom))` /
  `Math.min(...headInputs.map((h) => h.sFromBottom))`.

After `stackChord` returns the sorted head objects, the name is attached per head
(only when `showNoteNames`): `heads.forEach((h) => { h.name = stepInSystem(h.step, system); })`.
The `step` rides `stackChord`'s sort because the sort reorders head OBJECTS (the sort
comparator switches from `(a, b) => a - b` to `(a, b) => a.sFromBottom - b.sFromBottom`).

The `stackChord` return shape is purely additive (heads gain `step`, and `name` only
when names are on); existing consumers of `sFromBottom`/`y`/`side`/`displaced` are
untouched.

### Note-name placement geometry (svg.js, per head)

Name `<text>` to the RIGHT of the notehead, at the head's true pitch height,
`text-anchor: start`, clear of the LEFT-side accidental stack:

```
x = note.x + NOTEHEAD_RX + NAME_GAP
    + (head.displaced ? 2 * NOTEHEAD_RX : 0)
    + (dotted ? dotReach : 0)            // push past the dots, which also sit right
y ≈ head.y + NOTE_NAME_SIZE * ~0.35      // small baseline nudge to center on the head
```

Clashing chord/run names are dodged by a parameterized reuse of `stackAccidentals`
(the existing greedy column-pack): names fan RIGHTWARD (positive dx) instead of
accidentals' leftward, and the clash threshold widens to ≈4 staff-steps (the name's
height at `NOTE_NAME_SIZE`). `Y` stays at `head.y` so each name keeps its head's
true pitch height.

### System box and baseline grid invariance when names are ON (AC10 on-state, AC13)

Names-OFF byte-identity is the AC10 guarantee (one flag, default OFF, `head.name`
omitted). But the ON state must also not corrupt layout, so this design pins TWO
additional invariants for names-ON:

1. **No baseline-grid shift.** Turning names on MUST NOT move any staff line, any
   notehead, any clef/brace, or any system's vertical origin. This holds by
   construction: the name is attached to an already-laid-out `head` object AFTER all
   geometry is computed (`head.y`, `topMargin`, `STAFF_HEIGHT_SP`, lane occupancy,
   `systemHeight` at `layout.js:1894-1952` are all derived from `headInputs`/ledger
   extents, none of which depend on `head.name`). The `system`/`showNoteNames` options
   feed ONLY the per-head name string; they are never read by `topMarginLayout`,
   `ledgerTopExtent`, the lane-occupancy scan, or the `systemHeight` sum. So every
   element keeps the exact Y it has when names are off — names are a purely additive
   overlay at fixed coordinates.

2. **No clipping past the system box / viewBox.** Names sit at `head.y ± ~NOTE_NAME_SIZE/2`
   vertically and extend rightward horizontally. Horizontally there is no clip risk:
   names fan into the inter-note gap and the measure's right padding, well inside
   `staffEndX`. Vertically, a name on an EXTREME ledger note (top of the treble, bottom
   of the bass) could in principle poke above/below the margin that today's
   ledger-extent sum reserves. Because invariant 1 forbids growing `systemHeight` for
   the common case, the safety rule is: the music-font ledger/margin reserve
   (`SYSTEM_TOP_MARGIN`/`SYSTEM_BOTTOM_MARGIN` plus `ledgerTopExtent`/`ledgerBottom`)
   already provides headroom that comfortably covers a `NOTE_NAME_SIZE`-tall glyph
   centered on a notehead that sits at or inside the ledger extent (the ledger extent
   is measured to the extreme NOTEHEAD, and the half-name-height is ≈0.9 sp, smaller
   than the existing top/bottom margins). The plan MUST include a render assertion that
   the names-ON `viewBox`/`systemHeight` is byte-identical to names-OFF for the common
   fixture (proving no shift), and a visual/QA check that no name clips at the box edge
   on the extreme-ledger fixture. IF (and only if) QA finds an extreme-ledger clip, the
   documented contingency (Decision 8 / Risks "Contingency Topic E") adds a SMALL
   name-extent term to the top/bottom margin, GATED `showNoteNames ? nameExtent : 0` so
   the OFF path stays byte-identical (AC10) and the ON path grows the box rather than
   clipping. The default ship path adds NO such term (zero `systemHeight` delta both
   states).

## Key Decisions

### Decision 1 — Interactivity wiring: SSR button + local context + watch redraw

- **Choice:** Hold per-instance state in LOCAL `data-wp-context` (`showNoteNames`,
  default false, server-seeded). SSR a native `<button>` in `render.php` with
  `data-wp-on--click="actions.toggleNoteNames"`,
  `data-wp-bind--aria-pressed="context.showNoteNames"`, and a context-supplied
  label via `data-wp-text`. The action mutates the context boolean in place. A
  single `data-wp-watch` callback owns the imperative SVG draw and reacts to the
  toggle.
- **Alternatives:** (a) Global `wp_interactivity_state()` — shared across instances,
  rejected. (b) Creating the button in JS and wiring `addEventListener` — the
  Interactivity API anti-pattern; behavior must flow through SSR'd directives. (c)
  Using `data-wp-init` to react to the toggle — `init` runs once on mount and does
  NOT re-run on context change, so it cannot drive a reactive redraw.
- **Trade-offs:** A full SVG rebuild per toggle (cheap; the renderer is pure)
  rather than a partial DOM patch. Local context guarantees per-instance isolation
  by construction.
- **Traces to:** R1, R5, R6, R7, R8, R12; AC1, AC4, AC5.

### Decision 2 — One flag site at the layout layer; emit iff `head.name`

- **Choice:** Thread the option only into
  `buildLayoutModel(data, width, { showNoteNames = false, system } = {})` →
  `layoutHand`. `layoutHand` resolves and attaches `head.name` ONLY when
  `showNoteNames` is true. `svg.js` emits one name `<text>` per head iff `head.name`
  is present — `svg.js` gains no flag. When off, the `name` key is omitted entirely
  (not set to `undefined`), so the model object is also byte-identical.
- **Alternatives:** (a) Pass `showNoteNames` to both layout and `svg.js` — two
  flag sites to keep in sync, redundant. (b) Always emit names + CSS show/hide — the
  names-off DOM would still contain name nodes, breaking AC10. (c) Re-derive
  per-head order/names in `svg.js` — duplicates layout math and violates the
  `svg.js` math-free / string-logic-free contract.
- **Trade-offs:** The layout model differs when names are requested, so the flag
  must reach `buildLayoutModel` (not just `svg.js`). This is acceptable because the
  off-path is the default and is provably unchanged; the `el()` helper's
  undefined-attribute skip is the backstop.
- **Traces to:** R13; AC10, AC11.

### Decision 3 — Per-head step threading + shared name module

- **Choice:** In `layoutHand`, build an atomic `{ sFromBottom, step }` pair array
  (`headInputs`) per pitch BEFORE `stackChord`, so the `.filter()` (which can drop an
  unrecognized pitch) removes a pair atomically and the step stays bound to its
  position; the step rides `stackChord`'s sort because the sort reorders head OBJECTS.
  `stemDirectionForChord` is deliberately LEFT on `number[]`; the one caller recovers
  the numbers with `headInputs.map((h) => h.sFromBottom)`, so its signature and tests
  are untouched (resolving the contract cleanly: pairs feed `stackChord`, a derived
  number array feeds `stemDirectionForChord`). Resolve the final bare name in the
  layout layer via `stepInSystem(step, system)` from a NEW shared frontend-safe module
  (`src/song/noteNameSystem.js`) extracted from the editor's `noteNames.js`.
  `system = data.language ?? inferNoteNameSystem(data)` — exact editor parity (mirrors
  `src/edit.js:166-167`, `working?.language ?? inferNoteNameSystem(working)`).
- **Alternatives:** (a) Keep `stackChord` on `number[]` plus a parallel `steps[]`
  sorted in lockstep — re-introduces index-lockstep fragility through the sort. (b)
  A PHP mirror of the name vocabulary in `render.php` — a second source of truth
  (drift risk), and pointless because names are JS-drawn and default OFF (unlike
  `accessibleName`, which is needed pre-JS in the SVG `<title>`).
- **Trade-offs:** `stackChord`'s input signature changes (`number[]` →
  `{ sFromBottom, step }[]`), requiring migration of the 4 existing `stackChord`
  unit-test call sites and adapting `layoutHand`'s remaining number-consumers
  (`stemDirectionForChord`, the accidentals loop, the ledger loop, the dot loop, and
  `topStep`/`bottomStep`) to recover `sFromBottom` from the pairs — see "layout.js
  downstream adaptations" for each consumer's exact expression. This is the minimal,
  sort-safe change; coverage (both hands, per-head chords, rests excluded, ties
  named on both ends) falls out of the existing render structure for free.
- **Traces to:** R4, R5, R2; AC2, AC3.

### Decision 4 — Single redraw funnel through the watch (toggle + resize)

- **Choice:** The `data-wp-watch` `draw` callback is the SINGLE owner of the
  imperative draw, with BOTH `context.showNoteNames` AND a `context.width` signal as
  reactive dependencies. The `ResizeObserver` (kept in `init`) WRITES
  `context.width` on a width change rather than calling draw directly. Each redraw
  recomputes model + SVG from scratch from the cached parsed song. Parse runs once
  (a per-instance memo), reused on every fire. The first draw still gates on the
  music font; subsequent redraws read a seeded `fontReady` flag.
- **Alternatives:** (a) Keep `init`'s own draw closure and wrap each
  out-of-runtime callback in `withScope` — more moving parts, and risks a stale
  cached toggle bool on resize (would drop names, breaking AC7). (b) Re-parse the
  song inside the watch on every fire — wastes the validate-once guarantee.
- **Trade-offs:** The draw leaves `init`'s local scope, so the parsed song must be
  cached rather than closed over. In exchange, resize and toggle share one path:
  AC7 and AC6 are both free (the observer writes context, the watch reads the live
  flag, the pure render guarantees no drift). No `withScope` needed because the
  observer only writes a field.
- **Traces to:** R7, R9; AC6, AC7.

### Decision 5 — Translatable label transported via context; inner score container

- **Choice — which layer renders the button, and how the translated label arrives.**
  The toggle `<button>` is rendered by the PHP layer (`render.php`), NOT by `view.js`.
  This resolves the PHP-`__()`-vs-JS-module tension decisively: server-side rendering
  is the only layer with per-request access to WordPress's `__()` and the loaded
  translations, and `view.js` is a plain `viewScriptModule` with no per-render server
  i18n. Concretely:
  1. `render.php` computes the label once per render with
     `$toggle_label = __('Show note names', 'piano-block');` (same `piano-block` text
     domain as the existing accessible-name strings).
  2. `render.php` adds `toggleLabel => $toggle_label` to the `$context` array that is
     already encoded by `wp_interactivity_data_wp_context( $context )` (the existing
     `song`/`accessibleName` transport — the identical mechanism, no new machinery).
  3. The SSR'd `<button>` binds its visible text declaratively with
     `data-wp-text="context.toggleLabel"`. The button element itself is empty markup
     in `render.php`; the directive fills its text on hydration. Because the string is
     also the button's accessible name, AC8 is satisfied without `view.js` touching
     i18n at all.

  The label is a FIXED string "Show note names" in both states; the on/off STATE is
  conveyed by `aria-pressed` (Decision 1), not by changing the label, so no second
  translated string and no JS-side label logic are needed. (A Show↔Hide label flip is
  explicitly OUT of scope for this design; if ever wanted, it too would be done by
  SSR'ing both `__()`-translated strings into context and selecting between them with a
  `data-wp-text` binding — still no `@wordpress/i18n` in `view.js`.)

  `render.php` also emits a dedicated inner score `<div>` as a SIBLING of the button;
  `view.js` draws/measures/observes that inner div (NOT the wrapper).
- **Alternatives:** (a) Import `@wordpress/i18n` into the view module and build the
  button in JS — rejected; there is no frontend i18n precedent in this codebase, and
  the build-button-in-JS path is the Interactivity API anti-pattern (Decision 1).
  (b) SSR the button as a direct wrapper child with no inner score div —
  `renderInto`'s `container.replaceChildren(svg)` on the wrapper would wipe the
  button on the first draw and every resize. (c) Deliver the label via
  `wp_interactivity_state()` (global) instead of `data-wp-context` (local) — works for
  a string, but the codebase already standardizes on local context for per-instance
  transported strings (`accessibleName`), and AC4 wants per-instance isolation, so
  local context is the consistent choice.
- **Trade-offs:** The container model changes (wrapper now has two children), and
  `view.js` must `querySelector` the inner score div. This is the only structure
  that lets a declarative SSR'd button coexist with the imperative `replaceChildren`
  draw. The button sits ABOVE the score in normal flow (discoverable, no overlap, no
  absolute positioning).
- **Traces to:** R1, R8, R10 (no button-over-score overlap); AC8.

### Decision 6 — Default OFF and per-instance independence by construction

- **Choice:** `render.php` seeds `showNoteNames: false` per instance; all reactive
  values (`showNoteNames`, `hasNameableNotes`, width/font signals) live in
  per-instance LOCAL context, never in global Interactivity state. The extracted
  name module stays pure/stateless (no caches), so no shared mutable state leaks
  across instances. Context is re-seeded fresh per request, so the toggle resets to
  OFF on each load (matching the out-of-scope "no persistence").
- **Alternatives:** Any shared/global state — would couple instances and violate
  R6/AC4.
- **Trade-offs:** None material; this is the idiomatic Interactivity API default.
- **Traces to:** R3, R6, R12; AC1, AC4.

### Decision 7 — Client-computed gating via `hasNameableNotes`, SSR-hidden until init

- **WHAT computes `hasNameableNotes`, and WHERE.** It is computed on the CLIENT, in
  `view.js`'s `callbacks.init`, NOT on the server. After `init`'s cached
  `parseAndValidate` succeeds, `init` builds the layout model once and sets
  `context.hasNameableNotes = true` ONLY when the built model has ≥1 note record:
  `model.systems.some(s => s.measures.some(m => (m.right?.notes?.length || 0) + (m.left?.notes?.length || 0) > 0))`.
  (Equivalently it could walk the parsed song with the shared `stepsOf`, but the model
  check is preferred since `init` already builds the model and a pitch that filtered to
  `null` produces no note record — so "has a note record" is exactly "has a nameable
  note".)
- **WHY the server cannot compute it (so SSR-hidden-until-init is the safe default).**
  `render.php` deliberately does NOT gate rendering (the render-or-nothing decision is
  100% client-side, per the existing `render.php` header comment and R6). The server's
  `json_decode` is used only to read `metadata` for the accessible name; it never runs
  the JS validator (`parseAndValidate`) and never builds the layout model, so it cannot
  know whether the song is conformant or whether it yields any nameable note. Mirroring
  the validator + layout in PHP would be a second source of truth (drift risk) for a
  decision the client already owns. Therefore the safe default is: `render.php` SSRs the
  `<button>` WITH a literal `hidden` attribute AND
  `data-wp-bind--hidden="!context.hasNameableNotes"` over a seeded
  `hasNameableNotes: false`. The button stays hidden until `init` proves nameable notes
  exist, then flips it visible by setting the context flag.
- **Why this is FOUC-safe.** The SSR `hidden` attribute and the directive's FIRST
  computed value (from the seeded `hasNameableNotes: false`) are BOTH "hidden", so there
  is no flash-then-hide and no SSR/hydration mismatch on the hidden state. The button
  only ever becomes visible by going from hidden→shown once `init` confirms notes — it
  never starts shown and snaps away. With JS disabled, `init` never runs, the flag stays
  false, the button stays hidden, and no score is drawn (no dangling control).
- **Alternatives:** (a) Gate on the server — rejected: `render.php` cannot know
  render-success or nameable-note presence without re-implementing the client-side
  validator and layout (drift). (b) SSR the button visible and hide it in JS if there
  are no notes — rejected: that flashes a control that then vanishes (FOUC) and shows a
  dangling control with JS off.
- **Trade-offs:** The button exists in the SSR DOM but is hidden until the client
  confirms nameable notes; with no JS it stays hidden and no score is drawn (no
  dangling control). Empty/whitespace song → `render.php` emits no wrapper at all → no
  button (Decision 5 / R6).
- **Traces to:** R11; AC9, AC12.

### Decision 8 — Per-head-beside placement, small font, stackAccidentals-style dodge

- **Choice:** Draw each name beside its notehead (right of head and dots, clear of
  the left-side accidentals) at the head's true pitch height, in a new smaller
  `NOTE_NAME_SIZE` (1.8sp / 14.4px). Resolve chord/run collisions with a
  parameterized reuse of the existing tested `stackAccidentals` greedy column-pack
  (fan names rightward; widen the clash threshold to ≈4 staff-steps). Target ZERO
  `systemHeight` change in BOTH states: off is byte-identical (AC10), and on adds NO
  vertical extent term on the default ship path (names attach to already-laid-out heads,
  so the baseline grid does not shift and the box does not grow) — see "System box and
  baseline grid invariance when names are ON". Clipping on extreme ledger notes is the
  only on-state risk, handled by the gated contingency term (off-path stays 0).
- **Alternatives:** (a) Per-notehead adjacency at full `NOTE_SIZE` — overlaps ~5.6×
  in a chord, illegible. (b) A reserved name LANE mirroring the dynamics/annotation
  band machinery — clean collision handling, but a chord's names stack/join in the
  lane and lose the 1:1 head↔name association, and it grows `systemHeight` when on.
  OPT-B is recorded as the documented fallback if OPT-C proves visually insufficient
  in extreme chords/runs.
- **Trade-offs:** A new dodge geometry (but it is a parameterized clone of an
  existing unit-tested routine, not new algorithm design, which de-risks the hardest
  part). A no-dodge v1 is acceptable against AC13's "not ILLEGIBLE" bar for the
  common case; including the dodge is recommended (cheap, cleaner). Any new vertical
  extent term, if ever added (the documented contingency for extreme ledger notes),
  MUST be gated to 0 when names are off, preserving AC10.
- **Traces to:** R10; AC13.

## Dependencies

- **WordPress Interactivity API** (hard spec constraint, R12). Uses `store`,
  `getContext`, `getElement`, and the directives `data-wp-interactive`,
  `data-wp-context`, `data-wp-init`, `data-wp-watch`, `data-wp-on--click`,
  `data-wp-bind--aria-pressed`, `data-wp-bind--hidden`, `data-wp-text`. Context is
  seeded server-side via `wp_interactivity_data_wp_context()` (already used for
  `song`/`accessibleName`).
- **`@wordpress/i18n`** in `render.php` (PHP `__()`) for the translatable label,
  under the existing `piano-block` text domain. The view module does NOT import
  `@wordpress/i18n`.
- **Existing notation core** — `buildLayoutModel`, `layoutHand`, `stackChord`,
  `stackAccidentals`, `stemDirectionForChord`, `renderInto`/`renderSvg`,
  `pitchToStaffStep`, `parseAndValidate`, `availableWidthInSp`, `drawWhenFontReady`.
  All pure/deterministic (no `Math.random`/`Date`/`performance.now`/`crypto` in
  `src/notation`), which is what makes AC6 idempotency hold.
- **`src/song/normalizeStep.js`** — the existing frontend-safe vocabulary the new
  `noteNameSystem.js` builds on.
- **Internal coupling:** the new `noteNameSystem.js` is consumed by both
  `src/editor/noteNames.js` (re-export) and `src/notation/layout.js` (`stepInSystem`),
  making it the single source of truth for name spellings.

## Failure Modes and Observability

- **AC10 regression (names-off bytes change).** The dominant failure mode: any
  unguarded addition to `buildLayoutModel`/`svg.js` output breaks the
  editor↔frontend byte-identity. Mitigations: one flag site, default OFF, omit
  `head.name` when off, every new vertical term gated to 0 when off, and the `el()`
  undefined-attribute skip. Observability: a NEW `outerHTML` pin test in
  `src/notation/__tests__/svg.test.js` asserts
  `renderSvg(buildLayoutModel(SONG, W)).outerHTML === renderSvg(buildLayoutModel(SONG, W, { showNoteNames: false, system })).outerHTML`
  — the no-arg editor path equals the explicit names-off frontend path, byte for
  byte. The existing `SONG` fixture already covers a chord, a rest, a tie, an
  accidental, and both hands.

- **Idempotency / drift (AC6).** Each redraw is a full `replaceChildren` recompute
  from cached parsed data and the live flag — no accumulation. Observability: the
  pin test also asserts names-on rendered twice yields identical `outerHTML`, and
  names-on output differs from (and contains a name not in) names-off output. A
  Spanish-system assertion covers AC3 parity.

- **Stale toggle on resize (AC7).** A cached toggle bool on resize would drop names.
  Mitigated by the single watch funnel: the `ResizeObserver` writes `context.width`,
  the watch reads the LIVE `showNoteNames` each fire. No `withScope` needed.

- **Button wiped by the draw (AC1/AC5).** `replaceChildren` on the wrapper would
  destroy an SSR'd button. Mitigated by rendering into the inner score `<div>`; the
  button is a surviving sibling.

- **FOUC on the gated button (AC9/AC12).** The button is SSR'd with `hidden`, and
  the directive's first computed value (with `hasNameableNotes: false`) is also
  hidden, so there is no flash. With no JS the button stays hidden and no score is
  drawn.

- **Invalid / empty song (AC12).** Empty/whitespace → `render.php` emits nothing
  (no wrapper). Invalid/non-conformant → wrapper present, but `init`'s cached
  `parseAndValidate` returns early: draw nothing and leave `hasNameableNotes` false.

- **Per-instance leakage (AC4).** Covered by extending the existing two-block e2e
  fixture: toggle names on block A, assert A shows name `<text>` and B does not (and
  vice versa).

- **Stamping for inspection.** Each name `<text>` carries an observability `data-*`
  attribute (e.g. `data-note-name`), consistent with the existing
  `data-kind`/`data-hand`/`data-event-index` stamping, so names are queryable in
  tests and DOM inspection.

## Risks and Open Questions

- **RISK (AC10), mitigated, residual.** The implementer MUST keep every name
  addition flag-gated; a single unguarded line is the failure mode. The added
  `outerHTML` pin test is the catch.

- **RISK (AC13/R10), mitigated, residual.** OPT-C's legibility in extreme chords or
  fast runs is a judgment call against AC13's "not ILLEGIBLE" bar. `NOTE_NAME_SIZE`
  is a tunable constant (floor ~1.4sp); the stackAccidentals-style dodge handles
  tight clusters; OPT-B (a reserved name lane) is the documented fallback if OPT-C
  proves visually insufficient in practice. A no-dodge v1 is an acceptable first
  tier; the dodge is the recommended ship.

- **Latent fragility (not introduced by this feature, flagged).** Today's accidental
  pairing indexes `positions[pi]` against `pitches[pi]` and is safe only by the
  validator's grace (a mid-array `null` drop would silently misalign). The atomic
  `{ sFromBottom, step }` pair approach for names is strictly safer; the accidentals
  block COULD optionally re-point at the same paired array to retire this fragility,
  but that is a nice-to-have, not required by this feature (the conformant gate
  holds).

- **Code-plan consideration (not an open question — flagged for the plan).** The
  `stackChord` signature change breaks 4 existing unit tests
  (`layout.test.js`, the `stackChord([...numbers], ...)` calls); the plan MUST
  budget migrating those 4 tests to the object-pair input. `stemDirectionForChord`
  stays on `number[]` (map at the one call site) so its tests are untouched. Omitting
  the `head.name` key when off is a nice-to-have rather than a correctness blocker
  for current model tests (no exhaustive deep-equal on head objects exists), but it
  is recommended for cleanliness and future-proofing.

- **Contingency (Topic E, not the default path).** If QA finds a name on an extreme
  ledger note clips at the SVG viewBox edge, add a SMALL name-extent term to the
  top/bottom margin — GATED `showNoteNames ? nameExtent : 0` so the off-path stays 0
  (byte-identical). All open questions from the research (OQ1–OQ4) are RESOLVED.
