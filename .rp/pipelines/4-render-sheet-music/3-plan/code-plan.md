# Code Plan: Render the Piano block's song as visual sheet music (grand staff)

> Issue #4. This plan turns the approved design
> (`2-design-doc/design-doc.md`) into an ordered sequence of discrete
> implementation tasks. It is faithful to the design: client-side `viewScript`,
> inline SVG, a pure layout-model layer feeding a thin SVG-emit layer, a hybrid
> font + hand-drawn glyph strategy, and **no third-party music-notation
> library**. Each task below is self-contained: a fresh code-writer with only
> that task block + the spec + the design doc can implement it.
>
> **Sequencing model.** The code phase dispatches ONE code-writer per task, in
> order, all sharing one working tree, each committing before the next starts.
> Tasks are ordered so dependencies land first and the build stays green where
> practical: foundations (shared helper, constants, glyph map) → the pure layout
> layer → the emit layer → the font asset → the frontend entry → the PHP/block
> wiring → the test rewrites. The build is fully green only once T9 (PHP) +
> T10 (block.json) wire the frontend together; intermediate tasks add isolated
> modules and their unit tests, which run green independently.
>
> **Hard constraints carried from the design (do not violate):**
> - No music-notation library (VexFlow, abcjs, OSMD, Verovio). The engine is our
>   own code. A standalone open-licensed font *asset* is permitted (spec req 10 /
>   AC10).
> - Do NOT change the song format, the validator's accepted vocabulary, or
>   `docs/song-format.md` (spec "Out of Scope"). `src/song/validate.js` and
>   `src/song/schema.js` are REUSED as-is except for the behavior-preserving
>   `normalizeStep` extraction in T1.
> - Do NOT touch the editor: `src/edit.js`, `src/index.js` stay as they are; the
>   editor renders no notation (spec req 13 / AC11).
> - No `package.json` change (a plain `viewScript` compiles with the unchanged
>   `npm run build`); no custom `webpack.config.js`.
> - The renderer must NEVER use `timeSignature` to compute positions or widths
>   (design §6.2 CRITICAL ROBUSTNESS RULE) — that is what makes AC8/AC9 fall out
>   structurally.

---

## Repo facts the tasks rely on (verified against the current tree)

- The block is registered from `build/` by `piano_block_register()` in
  `piano-block.php` (the `init` hook); `npm run build` compiles `src/` → `build/`.
- `@wordpress/scripts` **32.3.0**, no custom webpack. A `viewScript` entry in
  `block.json` is auto-detected and bundled by the unchanged `npm run build`. An
  `@font-face` `url('./pb-music.woff2')` in SCSS makes webpack emit the woff2 to
  `build/`.
- The auto-generated viewScript handle (needed for `wp_set_script_translations`)
  is **`piano-block-piano-view-script`** (block name `piano-block/piano` →
  `piano-block-piano`, suffix `-view-script`).
- `validateSong` (`src/song/validate.js`) takes the RAW string, parses it itself,
  and returns `string[]` (`[]` when conformant; `["Invalid JSON: …"]` on parse
  failure). Reuse it verbatim as the render-or-nothing gate.
- The closed note-name vocabulary currently lives PRIVATE in `validate.js` as
  `NOTE_NAMES` (English `c d e f g a b` + Spanish `do re mi fa sol la si`,
  lowercased). T1 extracts it without changing what the validator accepts.
- Unit tests live in `src/**/__tests__/*.test.js` (run by
  `npm run test:unit` = `wp-scripts test-unit-js`, Jest). E2e specs live in
  `specs/*.spec.js` (run by `npm run test:e2e`, Playwright; `testDir: ./specs`).
- The comprehensive "exercises everything" song is in `docs/song-format.md`
  (annotated JSONC) and transcribed as `COMPREHENSIVE_SONG` in
  `src/song/__tests__/validate.test.js`. It is the shared full-coverage fixture.
- Biome (tabs, double quotes) lints/formats the JS; run `npm run check` before
  finishing a task. WP 6.9+ / PHP 7.4+.

---

## Module map (target end state, from design §3)

```
src/
  view.js                       NEW  viewScript ENTRY — thin, DOM-coupled (T8)
  notation/
    constants.js                NEW  SP/layout constants (T2)
    glyphs.js                   NEW  glyph map: codepoints + hand-drawn specs (T3)
    layout.js                   NEW  PURE layout layer → positioned-primitive model (T4–T6)
    svg.js                      NEW  thin EMIT layer: model → SVG DOM (T7)
    pb-music.woff2              NEW  subsetted+RENAMED Bravura asset (T9 wiring; asset committed here)
    OFL.txt                     NEW  SIL OFL 1.1 license text (ships beside the font)
    __tests__/
      layout.test.js            NEW  unit tests for the pure layer (T4–T6)
  song/
    validate.js                 EDIT only to import the extracted helper (T1)
    schema.js                   REUSED as-is
    normalizeStep.js            NEW  shared note-name helper (T1)
    __tests__/normalizeStep.test.js  NEW (T1)
  style.scss                    EDIT  add @font-face for the renamed font (T9)
  block.json                    EDIT  add "viewScript" (T10)
  render.php                    EDIT  <pre> → container + inert JSON <script> (T9)
specs/
  render.spec.js                REWRITE  <pre> assertions → SVG assertions (T11)
  editor.spec.js                UNCHANGED (req 13 / AC11)
```

`src/notation/layout.js` may optionally be split into internal helper files if a
code-writer finds it cleaner, but the plan treats it as one pure module with a
single exported `buildLayoutModel()` plus exported pure sub-functions for
testing. Keep all DOM/`sp→px`/font logic OUT of it.

---

## Tasks

### T1 — Extract the shared `normalizeStep()` note-name helper (no validation drift)

- **Goal** — Create one shared home for the English/Spanish, case-insensitive
  note-name vocabulary and a `step → canonical letter` mapping, reused by the
  validator and the renderer, WITHOUT changing what the validator accepts.
- **Files**
  - `src/song/normalizeStep.js` (new)
  - `src/song/validate.js` (edit: import + reuse the shared vocabulary)
  - `src/song/__tests__/normalizeStep.test.js` (new)
- **Changes**
  - In `normalizeStep.js` encode the closed two-system vocabulary ONCE (the
    same 14 tokens currently in `validate.js` `NOTE_NAMES`: English `c d e f g a
    b`, Spanish `do re mi fa sol la si`, lowercased). Export:
    - `NOTE_NAMES` — the `Set` of lowercased recognised tokens (so `validate.js`
      can consume it for `isNoteName`).
    - `isNoteName(key)` — `typeof key === "string" && NOTE_NAMES.has(key.toLowerCase())`
      (identical semantics to today's private helper).
    - `normalizeStep(step)` — maps any recognised token to its canonical
      UPPERCASE English letter (`do→C re→D mi→E fa→F sol→G la→A si→B`; English
      letters map to their own uppercase), case-insensitive; returns `null` (or
      `undefined`) for an unrecognised token. Back it with a 14-entry token→letter
      map (design §6.5). This is the ONLY place that knows the equivalence.
  - In `validate.js`: delete the private `NOTE_NAMES` set + `isNoteName`, import
    `NOTE_NAMES`/`isNoteName` from `./normalizeStep.js`, and use them in the exact
    same spots (`checkStep`, `checkAlters`). Validation OUTPUT must be byte-for-byte
    unchanged — the existing `validate.test.js` and `schema.test.js` must still
    pass untouched.
  - `normalizeStep.test.js`: assert `normalizeStep` for every English letter
    (upper + lower), every Spanish token (mixed case: `do`, `Do`, `DO`, `sol`,
    `SOL`), and that an unrecognised token (`"H"`, `"doh"`) returns the null-ish
    sentinel; assert `isNoteName` true/false on the same cases.
- **Depends on** — none.
- **Traces to** — design §6.5; "Open items for the plan phase" #3; spec
  AC3/AC2 (note-name handling underpins pitch placement and accidentals).
- **Acceptance**
  - `src/song/normalizeStep.js` exports `NOTE_NAMES`, `isNoteName`,
    `normalizeStep` with the semantics above.
  - `validate.js` imports them; no inline note-name table remains in `validate.js`.
  - `npm run test:unit` passes, INCLUDING the pre-existing `validate.test.js`
    and `schema.test.js` with no edits to those files (proves zero validation
    drift) plus the new `normalizeStep.test.js`.
  - `npm run check` (Biome) is clean.

---

### T2 — Layout constants module

- **Goal** — Centralize the staff-space (sp) and layout constants the pure layer
  and the emit layer share, so the magic numbers live in one place.
- **Files**
  - `src/notation/constants.js` (new)
- **Changes**
  - Export named constants (values from design §5/§6 "starting points"; a
    code-writer may tune within the documented ranges):
    - Coordinate/sizing: `SP_PX = 8` (px per staff space; staff height 32 px),
      `STAFF_LINE_COUNT = 5`, `STAFF_HEIGHT_SP = 4`.
    - Notehead/stem/flag: `NOTEHEAD_RX ≈ 0.6`, `NOTEHEAD_RY ≈ 0.5`,
      `STEM_THICKNESS ≈ 0.13`, `STEM_LENGTH ≈ 3.5`, `BEAM_THICKNESS ≈ 0.5`,
      `BEAM_GAP ≈ 0.75` (per stacked beam level), `SECONDARY_BEAM_INSET ≈ 0.28`.
    - Dots: `DOT_RADIUS ≈ 0.15`, `DOT_OFFSET ≈ 0.5`, `DOT_GAP ≈ 0.5`.
    - Spacing (design §6.2): `MIN_ADV ≈ 2.2`, `ADV_K ≈ 3.0`, `EMPTY_MEASURE_WIDTH ≈ 3.3`.
    - Wrapping/justify (design §6.3): `MAX_STRETCH ≈ 1.6`, vertical gaps
      `INTRA_STAFF_GAP ≈ 8` (RH↔LH), `INTER_SYSTEM_GAP ≈ 8..12`,
      `SYSTEM_TOP_MARGIN ≈ 4..6`, `SYSTEM_BOTTOM_MARGIN ≈ 4..6`.
    - Barlines: `BARLINE_THIN ≈ 0.13`, `BARLINE_THICK ≈ 0.5`.
    - Accidental/ledger: `LEDGER_WIDTH ≈ 2`, `ACCIDENTAL_GAP ≈ 0.6`,
      `ACCIDENTAL_COL_STEP ≈ 1.3`.
    - Text sizes (sp): `DYNAMIC_SIZE ≈ 2.8`, `CHORD_SYMBOL_SIZE ≈ 2.8`,
      `TEMPO_SIZE ≈ 2.8`, `MEASURE_NUMBER_SIZE ≈ 2.2`, `OTTAVA_SIZE ≈ 2.2`.
    - Duration tables (design §6.1/§6.2): `BASE_DUR = { whole: 4, half: 2,
      quarter: 1, eighth: 0.5, sixteenth: 0.25, "thirty-second": 0.125 }`;
      `DOT_MUL = { 0: 1, 1: 1.5, 2: 1.75 }`; `BEAM_COUNT = { eighth: 1,
      sixteenth: 2, "thirty-second": 3 }`.
  - All values are in staff spaces (sp) except `SP_PX`. No DOM, no imports.
- **Depends on** — none.
- **Traces to** — design §5.1, §6.1, §6.2, §6.3.
- **Acceptance**
  - `src/notation/constants.js` exists and exports the named constants above
    (names may be refined but must cover sizing, spacing, vertical gaps, the
    duration/dot/beam tables, and text sizes).
  - Pure data/numbers only; importing it has no side effects.
  - `npm run check` is clean.

---

### T3 — Glyph map (codepoints + hand-drawn specs + font-failure skeleton)

- **Goal** — Provide the swappable indirection layer that maps each symbolic
  glyph name to its SMuFL codepoint (font path) and/or a hand-drawn primitive
  spec, so the renderer is agnostic to the font-vs-path choice (design §2.4/§3).
- **Files**
  - `src/notation/glyphs.js` (new)
- **Changes**
  - Export a `GLYPHS` map (and/or helper accessors) keyed by symbolic name. For
    each glyph record the **font half** — the SMuFL Unicode-PUA codepoint (as a
    JS string, e.g. the treble-clef ``) — and, where applicable, the
    **hand-drawn half** (a small declarative spec the emit layer can turn into
    SVG primitives). Cover at least:
    - **Font glyphs** (ornate; codepoints only): clefs `gClef`/`fClef`/`cClef`
      (alto+tenor share the C-clef glyph, placed at different staff positions),
      rests `restQuarter`/`restEighth`/`restSixteenth`/`restThirtySecond`,
      accidentals `accDoubleFlat`/`accFlat`/`accNatural`/`accSharp`/`accDoubleSharp`
      (indexable by `alter + 2` per design §6.4), flags
      `flagEighthUp/Down`/`flag16Up/Down`/`flag32Up/Down`, the grand-staff
      `brace`, and time-signature digits `timeSig0..timeSig9`.
    - **Hand-drawn / trivial glyphs** (specs, the font-failure skeleton): the
      `notehead` (filled + open as ellipse params), the augmentation `dot`
      (circle), and whole/half rests `restWhole`/`restHalf` (rectangles hung
      from / sitting on a staff line). Per design §2.4 these always render even
      if the font fails.
  - Provide a single accessor (e.g. `glyphFor(name)`) the emit layer calls; the
    map is the only place codepoints appear. Document at the top that the font is
    the subsetted+renamed Bravura (SMuFL) shipped in T9, and that the hand-drawn
    set doubles as the font-failure skeleton.
  - Pure data + tiny helpers; NO DOM (the emit layer in T7 turns specs into SVG).
- **Depends on** — none (codepoints are constants; T9 supplies the matching font).
- **Traces to** — design §2.4, §3 (`glyphs.js`), §6.1/§6.4/§6.7; spec req 2 /
  AC2 (notational coverage), req 10 / AC10 (no library; font is an asset).
- **Acceptance**
  - `src/notation/glyphs.js` exports the glyph map covering the clefs, rests,
    accidentals (5, `alter+2`-indexable), flags, brace, time-sig digits (font
    half) and noteheads/dot/whole+half rests (hand-drawn half).
  - Codepoints appear ONLY in this module. A single accessor is exported.
  - `npm run check` is clean.

---

### T4 — Pure layout layer, part 1: pitch→Y, durations, beaming, accidentals (core music geometry)

- **Goal** — Begin `src/notation/layout.js` as a pure, DOM-free module: the
  per-event musical geometry — pitch→staff position with ledger lines, duration
  decoding (notehead/stem/flag/dots), best-effort beaming, chord stacking, and
  accidental resolution — all returning plain data in sp units.
- **Files**
  - `src/notation/layout.js` (new; extended further in T5/T6)
  - `src/notation/__tests__/layout.test.js` (new; extended in T5/T6)
- **Changes** (implement exactly the algorithms in the cited design sections)
  - **Pitch → Y (design §5.2), using `normalizeStep` from T1.** Implement
    `stepIndex` (C=0…B=6 on the canonical letter), `diatonicIndex(p) = octave*7 +
    stepIndex` (middle C = C4 = 28), the per-clef reference table
    (`treble {G4,2}`, `bass {F3,6}`, `alto {C4,4}`, `tenor {C4,6}`), and
    `staffStepFromBottom(p) = ref.sFromBottom + diatonicIndex(p) −
    diatonicIndex(ref.pitch)`; convert to Y via the 0.5-sp grid. Placement uses
    ONLY step+octave, NEVER `alter`.
  - **Ledger lines (design §5.2).** Emit a ledger spec at every line position
    (even `sFromBottom`) between the staff and a note outside `0..8`, inclusive of
    the note's own line; none for `0 ≤ sFromBottom ≤ 8`. Same routine both staves.
  - **Durations → noteheads/stems/flags/dots (design §6.1).** whole = open, no
    stem; half = open + stem; quarter and shorter = filled + stem. Stem
    direction/side: single note `sFromBottom < 4` → up (right of notehead), `≥ 4`
    → down (left); chord direction by the note farthest from the middle line
    (ties → down); stem spans the chord extent. Flags only on un-beamed flagged
    notes. Dots: right of notehead, centred on a space (nudge up from a line),
    second dot further right; one dot per chord notehead.
  - **Chord stacking + seconds rule (design §6.1).** Shared stem; each notehead
    at its §5.2 Y; when two chord notes are a diatonic second apart
    (`Δ sFromBottom = 1`) displace the back-note to the opposite side of the stem.
  - **Best-effort beaming (design §6.1), per hand per measure.** Walk events
    tracking `pos` in quarter-beats via `BASE_DUR × DOT_MUL` (T2 tables);
    beamable = a note of eighth/sixteenth/thirty-second; break at a rest, a
    non-beamable note, measure end, or a beat-boundary crossing
    (`floor(pos/beatLen)` change). Beat unit for GROUPING ONLY: compound
    (`beatType ∈ {8,16}` AND `beats % 3 == 0`) → group in 3s; else one `beatType`
    unit per beat. A group of length 1 → a FLAGGED note, not a one-note beam.
    `pos` is only a grouping aid — never clamp/crash on overflow. Beam geometry:
    one stem direction per group (extreme rule), **flat horizontal beams**
    (beam Y at the most-extreme stem end), primary beam across stem ends,
    secondary beams for 16th/32nd via `min(beamCount(left), beamCount(right))`
    with stubs for isolated shorter notes (`BEAM_COUNT` table from T2).
  - **Accidental resolution (design §6.4), stateless.** Compute
    `effectiveAlter = pitch.alter ?? normAlters[letter] ?? 0` where `normAlters`
    keys the hand's `alters` map through `normalizeStep`. Glyph rule (stateless,
    data-faithful): `pitch.alter` present and ≠0 → draw that accidental;
    `pitch.alter === 0` → draw a natural ONLY if the key-sig default for that
    letter ≠ 0; `pitch.alter` absent → no glyph. Glyph index = `alter + 2` into
    `["accDoubleFlat","accFlat","accNatural","accSharp","accDoubleSharp"]`, drawn
    LEFT of the notehead at the SAME Y. Chord accidental column-stacking
    best-effort (push within ~1.5 sp to a further-left column); full optimal
    stacking is out of scope.
  - Expose these as individually-exported pure functions (e.g. `pitchToStaffStep`,
    `ledgerLinesFor`, `decodeDuration`, `beamGroups`, `resolveAccidental`) so
    T4's tests can assert them directly. They return plain data; no DOM.
  - **Unit tests** (`layout.test.js`) covering the §5.2-verified pitch cases
    (treble E4→0, G4→2, F5→8, C4→−2, C6→12; bass C4→+10); simple vs compound
    beaming + breaks + length-1→flag; accidental precedence incl. the §6.4
    verified cases (B default-flat no override → no glyph; B explicit `alter:0` →
    natural; F#2 explicit → sharp; Spanish "si" under `alters{B:-1}` → −1 no glyph;
    "C" under `alters{do:1}` → +1 no glyph; explicit doubles → double glyphs).
- **Depends on** — T1 (normalizeStep), T2 (constants), T3 (glyph names).
- **Traces to** — design §5.2, §5.3-adjacent, §6.1, §6.4; spec req 2/4 (AC2),
  req 4 (AC3 pitch placement + accidental precedence), partial req 2 coverage.
- **Acceptance**
  - The named pure functions exist in `src/notation/layout.js`, are DOM-free, and
    return plain-data primitives in sp units; placement ignores `alter`.
  - `layout.test.js` includes and passes the pitch-Y, beaming, and
    accidental-precedence cases listed above.
  - `npm run test:unit` and `npm run check` pass.

---

### T5 — Pure layout layer, part 2: union-grid alignment, compressive spacing, intrinsic measure widths (AC5/AC8/AC9 core)

- **Goal** — Extend `layout.js` with the per-measure two-hand union-grid (the
  vertical-alignment + robustness engine) and the content-driven compressive
  horizontal spacing that yields each measure's intrinsic width — WITHOUT ever
  consulting `timeSignature` for positions/widths.
- **Files**
  - `src/notation/layout.js` (edit/extend)
  - `src/notation/__tests__/layout.test.js` (extend)
- **Changes** (design §6.2 — the most adversarially-tested requirement)
  - **Per-hand onsets.** For each hand compute event onsets as the running sum
    from 0 of `dur(e) = BASE_DUR[duration] × DOT_MUL[dots]` (T2 tables), per hand
    independently. Rests are full grid citizens (a rest advances the onset).
  - **Union grid.** `GRID = sorted unique union of both hands' onsets`. Each
    unique onset `t` maps to one X; an event at `t` in either hand draws at `X(t)`
    → automatic vertical alignment within the measure.
  - **Compressive advances.** `advance(Δ) = MIN_ADV + ADV_K · sqrt(max(Δ,0))`
    where `Δ` is the gap to the next onset; the last onset uses
    `Δ = measureEnd − lastOnset` and `measureEnd = max(handEnds, 0)`. Empty grid
    → `EMPTY_MEASURE_WIDTH`. Raise `MIN_ADV` per-column when accidentals/dots/flags
    are present at that column so glyphs clear.
  - **Intrinsic measure width.** `measureWidth = Σ advances + leadingPad +
    trailingPad`; `leadingPad` applies only to measures that print
    clef/keysig/timesig (system start or a section-change restatement);
    `trailingPad` = barline width (+ repeat dots / final thick bar).
  - **CRITICAL ROBUSTNESS RULE.** The layer must NEVER use `timeSignature` to
    compute positions or widths — all onsets/widths come purely from event
    durations. Keep it NaN-safe (`sqrt(max(Δ,0))`, empty-grid short-circuit,
    `measureEnd = max(handEnds, 0)`). This makes AC8 (events don't sum to the time
    signature) and AC9 (one-hand/empty-hand still draws both staves) structural:
    staff-line geometry comes from measure dimensions, NOT from events.
  - Export pure functions (e.g. `handOnsets`, `unionGrid`, `measureLayout`)
    returning the grid + per-column X + intrinsic width as plain data.
  - **Unit tests** (the §6.2-verified AC8 battery): equal onsets align; different
    subdivisions (RH eighths / LH quarters) → the off-beat RH note gets its own X
    between LH columns; unequal totals → grid extends to `max(handEnds)`, short
    hand simply ends; empty/one-hand → grid is the present hand's onsets and BOTH
    staff bands are still produced (AC9); overflow bar (events sum past the time
    signature) → no throw, keeps grouping; empty song / empty measure → floor
    width, no NaN anywhere.
- **Depends on** — T2 (constants), T4 (duration decode + per-event primitives).
- **Traces to** — design §6.2; spec req 5 (AC5 per-measure alignment), req 9
  (AC8 robustness), req 9 (AC9 one-hand/empty-hand).
- **Acceptance**
  - `measureLayout`-style functions return a union grid, per-onset X, and an
    intrinsic width purely from event durations; `timeSignature` is NOT referenced
    for any X/width.
  - The AC8/AC9 unit battery above exists and passes (no throw, no NaN, both
    staff bands for one-hand/empty-hand, floor width for empty).
  - `npm run test:unit` and `npm run check` pass.

---

### T6 — Pure layout layer, part 3: section context resolution, system wrapping/justify, spans/texts/barlines/ottava → the full layout model

- **Goal** — Complete `layout.js` with the section-inheritance pre-pass + diff,
  greedy system packing + justify with the over-wide downscale, ties/slurs,
  dynamics/chord-symbols/tempo/measure-numbers/ottava, and barlines — assembling
  the full positioned-primitive **layout model** returned by a single
  `buildLayoutModel(song, availableWidthInSp)` entry point.
- **Files**
  - `src/notation/layout.js` (edit/extend; add the top-level entry point)
  - `src/notation/__tests__/layout.test.js` (extend)
- **Changes**
  - **Section context resolution + diff (design §6.6).** A pre-pass resolves each
    section's effective context via the inheritance model: each of `tempo`,
    `timeSignature`, per-hand `clef`/`alters`/`octaveShift` inherits from
    `defaults` independently; `alters` replaces wholesale; `octaveShift` defaults
    to 0. Diff each section against the previous and mark ONLY what changed (the
    first section draws everything): tempo→tempo text, timeSignature→time-sig
    glyph, clef (per changed hand)→inline cautionary clef, alters (per changed
    hand)→new key-sig cluster, octaveShift (per changed hand)→begin/end ottava.
    At a system start these go in the leading reserve; mid-system they are inline
    at the boundary measure (AC4).
  - **`alters` as a key-signature-like cluster (design §6.4).** One glyph per
    altered note name at that letter's standard key-sig register for the active
    clef (fixed per-clef 7-register table); standard sharp/flat sets in
    conventional order, others appended in note-name order; doubles draw the
    double glyph. No circle-of-fifths detection.
  - **octaveShift → ottava bracket (design §5.3).** A bracket, NOT a vertical
    move: notes placed by written octave; a dashed bracket + label (`+1`→8va,
    `−1`→8vb, `+2`→15ma, `−2`→15mb; above for positive, below for negative) spans
    the affected hand's section notes, re-stated per wrapped system.
  - **System wrapping + justify (design §6.3).** Greedy pack measures into
    width-fitted stacked systems: `budgetSp = containerSp`,
    `availSp = budgetSp − leadingReserve` (brace + both clefs + alters, +timesig
    on system 1 / on change — computed from the glyphs actually printed); fill
    until the next measure exceeds `availSp`, then break; ALWAYS ≥ 1 measure per
    system. Justify by scaling internal grid ADVANCES ONLY (not reserve, glyphs,
    stems, or noteheads): `scale = clamp(availSp/contentSp, ·, MAX_STRETCH)`; do
    NOT justify the last system of the score nor an over-wide (scale<1) system.
    A single measure wider than the container goes alone and that WHOLE system is
    uniformly downscaled (`downscaleFactor = min(1, availSp/measureContentSp)`,
    applied as a transform on the system's group, glyphs included) — no overflow,
    no horizontal scroll.
  - **Per-system restatement (design §6.3).** Every system restates brace + both
    clefs + alters; the time signature only on system 1 and where it changes.
  - **Barlines (design §6.7).** Span both staves (thin/thick per T2). Per type:
    regular = one thin; double = two thin; final = thin then thick; repeat-start =
    thick+thin + 2 dots right; repeat-end = 2 dots left + thin+thick. Shared rule:
    always draw `barlineEnd`; draw `barlineStart` only when `repeat-start`; first
    measure of the score has no left barline.
  - **Measure numbers (design §6.7).** Number each system's first measure,
    above-left of the RH staff; index basis sequential 1..N across the whole song
    (section boundaries do NOT reset).
  - **Ties + slurs (design §6.7), stack-based, dangling-safe.** Per hand, a
    `tie:start`/`slur:start` opens a pending span closed by the next matching
    `stop`, matching pitches by `diatonicIndex` (chords best-effort). Geometry:
    tie = short shallow Bézier near notehead Y bulging opposite the stem; slur =
    longer arc over the phrase. A dangling start/stop or double-start → best-effort
    stub or skip, NEVER throws; across barlines/systems → drawn between actual
    laid-out positions, clipped to system edges.
  - **Dynamics / chord symbols / tempo text (design §6.7).** Dynamics =
    bold-italic text below each hand's staff at the event's grid X (RH in the
    inter-staff gap, LH below the LH staff). Chord symbols = the string verbatim
    above the RH staff at the event's X. Tempo = "[beatUnit note-glyph] = [bpm]"
    (missing `beatUnit` → quarter glyph), above the first measure of the section
    and at any tempo change.
  - **Per-system vertical margins computed from content (design §6.3):** top/bottom
    margins from max ledger extent + presence of ottava/dynamics/chord-symbols in
    that system, so tall stacks do not collide with neighbours.
  - **`buildLayoutModel(song, availableWidthInSp)`** — the single pure entry
    point. Returns the model: `systems → grand-staff bands → (staff lines, clefs,
    key sig, time sig, barlines, brace) + per-event primitives + spans + texts`,
    all in sp units, NO DOM, NO sp→px. Resize re-runs only the packing/justify
    (the per-measure intrinsic widths + pitch Ys are sp-relative invariants).
  - **Unit tests:** the §6.6-verified 2-section diff fixture (the
    `docs/song-format.md` annotated example: tempo 120→90 redraw, timesig 4/4→3/4
    redraw, RH clef treble unchanged → NOT redrawn, LH clef bass→tenor redraw, RH
    alters {}→{F,C} & LH alters {B:-1}→{} both redrawn, RH octaveShift 0→1 starts
    8va, LH octaveShift unchanged → nothing); greedy wrapping (a song with many
    measures at a wide vs narrow `availableWidthInSp` → the number of systems
    changes, always ≥1 measure/system, over-wide single measure → downscaled
    system); tie/slur dangling matching (dangling start, dangling stop,
    double-start → no throw); `buildLayoutModel(COMPREHENSIVE_SONG, w)` returns a
    well-formed model with two staff bands per system and the expected primitives
    present.
- **Depends on** — T1, T2, T3, T4, T5.
- **Traces to** — design §5.3, §6.3, §6.4, §6.6, §6.7; spec req 2 (AC2 full
  coverage), req 3 (AC4 mid-song changes), req 5 (AC5 responsive wrapping +
  alignment), req 6 (AC5 reflow inputs), req 2 barlines/ottava/measure-numbers.
- **Acceptance**
  - `buildLayoutModel(song, availableWidthInSp)` is exported, pure, DOM-free, and
    returns the full positioned-primitive model (systems, two bands each, all
    primitives/spans/texts) in sp units.
  - Unit tests cover the §6.6 2-section diff fixture, wrapping at two widths
    (system count changes; over-wide measure downscaled), and tie/slur dangling
    safety — all green.
  - The module never references `timeSignature` for positions/widths (only for
    the time-sig glyph + beam grouping).
  - `npm run test:unit` and `npm run check` pass.

---

### T7 — SVG emit layer (model → SVG DOM, accessibility, text safety)

- **Goal** — Implement `src/notation/svg.js`: a thin, layout-math-free emitter
  that walks the layout model, builds the `<svg role="img">` via `createElementNS`
  (+ `textContent` for all author text), applies the sp→px scale and per-system Y
  offsets, draws font glyphs (`<text>`) and hand-drawn primitives, and stamps
  stable ids / `data-*` for future interactivity.
- **Files**
  - `src/notation/svg.js` (new)
- **Changes** (design §2.3, §6.8, §7)
  - Export e.g. `renderSvg(model, { accessibleName }) → SVGElement` (or
    `renderInto(container, model, opts)`), containing NO layout math.
  - Root `<svg role="img">` with a `viewBox` decoupling user units from px; first
    child `<title>` set via `textContent` carrying the single accessible name (do
    NOT also set `aria-label` — one name source only, design §7). Width = container
    width; height grows with the number of systems; `SP_PX` from T2 is the sp→px
    scale.
  - Walk the model: `createElementNS(SVG_NS, …)` each primitive — staff lines /
    stems / beams / barlines / ledger lines as `<line>`/`<rect>`/`<path>`,
    noteheads as `<ellipse>`, dots as `<circle>`, ties/slurs as `<path>` (quadratic
    Bézier), font glyphs (clefs/rests/accidentals/flags/brace/time-sig digits) as
    `<text>` using the glyph codepoint from `glyphs.js` with the renamed
    font-family, and dynamics/chord-symbols/tempo/ottava/measure-numbers as
    `<text>`. Apply per-system Y offsets and the per-system downscale transform
    from the model.
  - **Hand-drawn fallback (design §2.4):** for glyphs that have a hand-drawn spec
    in `glyphs.js`, draw the primitive; the skeleton (staves, stems, beams, ties,
    ledgers, barlines, noteheads, dots) never depends on the font.
  - **Text safety (design §6.8):** ALL text via `textContent` /
    `createTextNode`; NEVER `innerHTML`, never `<script>`/`<foreignObject>`. Author
    free text (`chordSymbol`, `metadata.title` in the `<title>`) is therefore inert.
  - **Interactivity hook (design §2.3/§2.1):** stamp each notehead/stem/etc. with a
    stable id / `data-*` (e.g. note index) from its model node, so a later store
    can target it — no behavior now.
  - Fixed color is fine (spec req 15 / AC: color not theme-adaptive).
- **Depends on** — T2 (constants/scale), T3 (glyph map), T6 (the model shape).
- **Traces to** — design §2.3, §6.8, §7; spec req 1 (AC1 SVG grand staff), req
  14 (AC12 accessible label), req 10 (AC10 own-code SVG), req 15 (fixed color),
  req 16 (addressable elements).
- **Acceptance**
  - `src/notation/svg.js` exports a function that turns a layout model into an
    `<svg role="img">` with a first-child `<title>` set via `textContent`, no
    layout math inside, all author text via `textContent`, and stable ids/`data-*`
    on per-event elements.
  - It builds DOM via `createElementNS` only (no `innerHTML`, no `<script>`/
    `<foreignObject>`).
  - `npm run check` is clean. (DOM-coupled; covered end-to-end by T11 e2e.)

---

### T8 — Frontend `view.js` entry (viewScript: gate, parse, draw, a11y name, ResizeObserver, i18n)

- **Goal** — Implement the thin `viewScript` entry that, per block container,
  reads the inert JSON `<script>`, runs the `validateSong` gate, renders the three
  display states, computes the accessible name, gates the first draw on the font,
  and reflows on resize.
- **Files**
  - `src/view.js` (new)
- **Changes** (design §2.6, §4, §7)
  - On DOM ready, query all block containers (the wrapper `<div>` emitted by
    `render.php` in T9, scoped by the block wrapper class), and for each:
    1. `raw = childScript.textContent` (the inert `application/json` `<script>`).
    2. `errors = validateSong(raw)` (imported from `./song/validate.js` —
       reused; covers both invalid JSON and non-conformant).
    3. `errors.length > 0` → render NOTHING; leave the wrapper empty (the
       non-renderable state — no raw echo, no error message).
    4. else `data = JSON.parse(raw)` (defensively wrapped; cannot fail after a
       clean validate), `model = buildLayoutModel(data, availableWidthInSp)`,
       `svg = renderSvg(model, { accessibleName })`, mount into the wrapper.
  - **Available width.** Measure the container's content width in px and convert
    to sp (`/ SP_PX`) for `buildLayoutModel`. (Optional refinement: step `SP_PX`
    to 7 below a ~480 px container.)
  - **Font gating (design §2.4 / open item #1).** Gate the FIRST `draw()` on
    `document.fonts.ready` (or `document.fonts.load(...)` for the renamed family)
    so the ornate glyphs are present on first paint; subsequent resize redraws
    need not re-wait.
  - **Accessible name (design §7).** Compute client-side from `data.metadata`
    (strings count only when non-empty after trim): title+composer → "{title} by
    {composer}"; title only → "{title}"; composer only → "Piano sheet music by
    {composer}"; neither → "Piano sheet music". Pass to `renderSvg` (sets the
    `<title>`). Wrap the NON-author strings in `@wordpress/i18n`:
    `__("Piano sheet music","piano-block")`, and `sprintf(_x(...,"piano-block"),
    …)` for the composer variants; the title-only case is the author's own text
    (no wrapper).
  - **Responsive reflow (design §6.3 / §4).** Attach a `ResizeObserver` to the
    CONTAINER; on change debounce via `requestAnimationFrame`, recompute packing
    (re-run `buildLayoutModel` at the new width and re-emit), and replace the SVG.
    Width flows one-way (container → SVG): NEVER write back the container width
    (no observer loop); wrap the work in rAF (removes the benign
    "undelivered notifications" warning).
  - Keep this file tiny and DOM-coupled; all hard logic stays in `layout.js`.
- **Depends on** — T6 (`buildLayoutModel`), T7 (`renderSvg`). Reuses
  `src/song/validate.js` as-is.
- **Traces to** — design §2.5, §2.6, §4, §6.3, §7; spec req 1/6/7/8 (AC1/AC6/AC7
  display states), req 6 (AC5 responsive reflow), req 11 (JS-required allowed),
  req 14 (AC12 accessible name), req 16 (single render entry, addressable
  elements).
- **Acceptance**
  - `src/view.js` reads the child JSON `<script>`, gates on `validateSong`,
    renders SVG only for conformant songs (empty wrapper otherwise), computes the
    a11y name per the §7 templates with i18n on the non-author strings, gates the
    first draw on `document.fonts.ready`, and reflows via a rAF-debounced one-way
    `ResizeObserver`.
  - No layout math lives in `view.js`. `npm run check` is clean. (End-to-end
    behavior verified by T11.)

---

### T9 — Wire the font asset + `render.php` container/JSON-script + i18n loader (the transport + PHP half)

- **Goal** — Ship the subsetted+renamed Bravura asset under SIL OFL, wire its
  `@font-face`, replace the `render.php` `<pre>` echo with a container + inert
  JSON `<script>` using the VALID `<` breakout escaping, and register the
  viewScript translations loader.
- **Files**
  - `src/notation/pb-music.woff2` (new — the subsetted, RENAMED Bravura asset)
  - `src/notation/OFL.txt` (new — SIL OFL 1.1 license text, ships beside the font)
  - `src/style.scss` (edit — add the `@font-face`)
  - `src/render.php` (edit — `<pre>` → container + inert JSON `<script>`)
  - `piano-block.php` (edit — `wp_set_script_translations` for the viewScript)
- **Changes**
  - **Font asset (design §2.4 / open item #1).** Commit a pre-subsetted
    (~10–40 KB) woff2 containing only the ~30–40 SMuFL codepoints used by
    `glyphs.js`, **RENAMED** away from the Reserved Font Name "Bravura" (e.g.
    family "PB Music"; filename `pb-music.woff2`). Ship `OFL.txt` (SIL OFL 1.1)
    beside it. (If a code-writer cannot run a subsetter deterministically, a
    committed full renamed `Bravura.woff2` renamed to the new family is acceptable
    as a fallback — size is a nicety, the rename + OFL.txt + no-library posture are
    the hard requirements; note any such substitution in the commit.) The
    glyph-map codepoints (T3) must match whatever font ships.
  - **`@font-face` (SCSS, so webpack emits the file to `build/`).** In
    `src/style.scss` add `@font-face { font-family: "PB Music"; src:
    url("./notation/pb-music.woff2") format("woff2"); font-display: swap; }`. The
    `font-family` string MUST equal the one `glyphs.js`/`svg.js` use. (`@font-face`
    in `style.scss` is harmless to the editor; an optional dedicated frontend-only
    `viewStyle` is acceptable but not required.)
  - **`render.php` rewrite (design §2.2, §4 / open item #2).** Keep the empty
    early return EXACTLY (`if ( '' === trim( $song ) ) return;` → no container at
    all). Otherwise emit
    `<div <?php echo get_block_wrapper_attributes(); ?>><script type="application/json" class="…__song"><?php echo $escaped; ?></script></div>`,
    where `$escaped` is `$song` with the leading `<` of every breakout sequence
    escaped to the JSON unicode escape `<`. Implement the simplest valid
    form — a blanket `<` → the 6-character literal `<` (e.g.
    `str_replace('<', '\\u003C', $song)`). DO NOT use `esc_html` /
    `htmlspecialchars` (raw-text `<script>` does not decode entities, so escaped
    entities would break `JSON.parse`) and DO NOT use `<\/` / `<\!--` (`\!` is
    invalid JSON and would throw on a conformant song containing `<!--`). `<`
    is a legal JSON escape for `<`, so `JSON.parse` decodes back to the EXACT
    author bytes while the HTML parser never sees a literal `</` or `<!--`. PHP
    performs NO validation — emit the container for any non-empty song; `view.js`
    owns the render-or-nothing decision. Update the file's doc comment to describe
    the new container behavior.
  - **i18n loader (design §7 / open item #4).** After block registration in
    `piano-block.php`, call
    `wp_set_script_translations( 'piano-block-piano-view-script', 'piano-block' )`
    (optionally with a languages path) so the a11y label strings can localize;
    English works without translation files. (Hook it where the script handle is
    registered — e.g. on `init` after `register_block_type`, or via the
    block's `render`/enqueue; the handle is the auto-generated viewScript handle.)
- **Depends on** — T8 (the viewScript exists and references the font family +
  reads the JSON `<script>`), T3 (codepoints match the shipped font).
- **Traces to** — design §2.2, §2.4, §4, §7, open items #1/#2/#4; spec req 1
  (AC1 replaces `<pre>`), req 6/7 (AC6 empty → nothing, AC7 non-renderable →
  nothing), req 10 (AC10 font asset under OFL, no library), req 12 (builds with
  the unchanged toolchain), req 14 (AC12 i18n'd label).
- **Acceptance**
  - `render.php` no longer emits `<pre>`; it emits the container + inert JSON
    `<script>` with `<` escaped as the 6-char `<`, and keeps the empty
    early-return (no container) unchanged.
  - `src/notation/pb-music.woff2` + `src/notation/OFL.txt` are committed; the
    font is renamed off "Bravura"; `style.scss` has a matching `@font-face`.
  - `piano-block.php` calls `wp_set_script_translations` on
    `piano-block-piano-view-script`.
  - `npm run build` succeeds and emits the woff2 into `build/`; `npm run check`
    is clean; PHP is valid.

---

### T10 — Wire `viewScript` in `block.json`

- **Goal** — Register the frontend script so WordPress enqueues it on the
  frontend only, when the block is present, with NO `package.json` change.
- **Files**
  - `src/block.json` (edit)
- **Changes**
  - Add `"viewScript": "file:./view.js"` to the block metadata, keeping
    `editorScript`, `style`, and `render` exactly as they are. The plain
    `viewScript` is auto-detected and bundled by the unchanged `npm run build`
    (design §2.1, open item final note). Do NOT add `viewScriptModule`,
    `supports.interactivity`, or any build-script flag.
- **Depends on** — T8 (`view.js` exists), T9 (its dependencies build).
- **Traces to** — design §2.1, §2.2, open items final note; spec req 1 (AC1
  frontend render), req 12 (AC: builds with the current toolchain).
- **Acceptance**
  - `src/block.json` contains `"viewScript": "file:./view.js"` and is otherwise
    unchanged (`editorScript`/`style`/`render` intact; no module/interactivity
    keys).
  - `package.json` is unchanged. `npm run build` emits `view.js` to `build/` and
    `register_block_type( __DIR__ . '/build' )` picks up the viewScript.

---

### T11 — Rewrite `specs/render.spec.js` to SVG assertions + add the three display states, responsive, and injection-safety e2e tests

- **Goal** — Replace the obsolete `<pre>` e2e assertions with SVG assertions for
  the three display states, add a responsive-wrapping test and an injection-safety
  test, leaving `specs/editor.spec.js` unchanged (req 13 / AC11).
- **Files**
  - `specs/render.spec.js` (REWRITE)
  - `specs/editor.spec.js` (UNCHANGED — do not edit; optionally a single
    assertion that no notation renders in the editor may be added)
- **Changes** (design §8, open item #5)
  - **Empty / whitespace → nothing (AC6).** OLD "empty → no `<pre>`" retargets to:
    publish a block with no/whitespace song → the page has no
    `svg[role="img"]` from this block and no visible notation (and no `<pre>`).
  - **Conformant → SVG grand staff (AC1, AC2 core).** REPLACE the old verbatim
    `<pre>` test: publish the `COMPREHENSIVE_SONG` (reuse the
    `docs/song-format.md` / `validate.test.js` fixture) → the block renders
    `svg[role="img"]` with the expected accessible name (its `<title>` /
    accessible name from `metadata` — "Example by A. Composer"), the raw JSON text
    is NOT shown, and there is no `<pre>`. Assert the grand staff is present
    (e.g. two staff bands / brace / both clefs present as SVG content).
  - **Non-renderable → nothing (AC7).** Publish an invalid-JSON song and a
    valid-but-non-conformant song → no `svg[role="img"]` / no visible notation
    (the wrapper MAY exist with the inert JSON `<script>` inside — assert "no SVG /
    no visible notation", NOT "zero DOM nodes", per design §2.5).
  - **Responsive wrapping (AC5).** Publish a song with more measures than fit a
    narrow width; render at a wide viewport and a narrow viewport → the number of
    stacked systems (or wrapping) changes between widths, and the score stays
    usable at the narrow width.
  - **Injection safety (relocated AC8 protection, design §8).** Publish a
    CONFORMANT song whose `chordSymbol` and/or `metadata.title` contain the
    literals `</script>`, `<!--`, and `<script>alert()</script>` → no script
    executes, the hostile text is inert (rendered via `textContent`), the JSON
    `<script>` does NOT break out, AND because the song is conformant it still
    `JSON.parse`s back to the exact author bytes and RENDERS its notation (the
    `<` escape round-trips where `<\!--` would have thrown). Assert: zero
    injected executing `<script>` from the block payload, the `svg[role="img"]`
    renders, and the hostile text appears only as inert SVG `<text>` content.
  - Reuse the e2e harness conventions already in `render.spec.js`
    (`@wordpress/e2e-test-utils-playwright`, `admin`/`editor`/`page`,
    `requestUtils.activatePlugin("piano-block")`, `deleteAllPosts`, the
    `publishPostWithSong` helper, `editor.canvas.getByLabel("Song (JSON)")`).
    Update the file header comment to describe SVG (not `<pre>`) behavior.
  - **Do NOT modify `editor.spec.js`** (the editor is untouched — req 13 / AC11).
- **Depends on** — T8, T9, T10 (the full frontend must be wired and buildable for
  these e2e tests to pass against wp-env).
- **Traces to** — design §8, open item #5; spec AC1, AC2, AC5, AC6, AC7, AC8
  (relocated injection protection), AC11 (editor.spec.js unchanged), AC12
  (accessible name asserted).
- **Acceptance**
  - `specs/render.spec.js` asserts SVG (not `<pre>`) for: empty→nothing,
    conformant→`svg[role="img"]` grand staff with the expected accessible name and
    no raw JSON, non-renderable→no SVG, responsive→wrapping changes with width, and
    injection→inert hostile text + the conformant hostile song still renders.
  - No `<pre>`-based assertions remain in `render.spec.js`.
  - `specs/editor.spec.js` is byte-for-byte unchanged (except an optional single
    "no notation in editor" assertion).
  - Built + wp-env up: `npm run test:e2e` passes; `npm run check` is clean.

---

## Acceptance-criteria → task traceability (all 12 covered)

| AC | What it requires | Tasks |
|----|------------------|-------|
| AC1 | Renders SVG grand staff instead of raw `<pre>` | T6, T7, T8, T9, T10, T11 |
| AC2 | Full notational coverage (clefs, alters, time sig, tempo, noteheads/stems/flags/beams, dots, rests, accidentals incl. doubles, chords, ties, slurs, dynamics, chord symbols, all barlines, ottava, measure numbers) | T3, T4, T6, T7; verified T11 |
| AC3 | Correct pitch placement + ledger lines + per-note `alter` precedence | T4 (pitch→Y, ledgers, accidental precedence) |
| AC4 | Mid-song section changes shown at section start | T6 (§6.6 resolve+diff) |
| AC5 | Per-measure two-hand alignment + responsive wrapping | T5 (union grid), T6 (wrapping/justify), T8 (ResizeObserver), T11 |
| AC6 | Empty/whitespace song → nothing | T9 (render.php early return), T8, T11 |
| AC7 | Non-renderable song → nothing (no raw, no error) | T8 (validate gate, empty wrapper), T9, T11 |
| AC8 | Robust to musically-unbalanced songs (events ≠ time sig; unequal hands) | T5 (union grid, never use timeSignature, NaN-safe), T4; verified T5 tests |
| AC9 | One-hand / empty-hand measures still draw both staves | T5 (staves from geometry not events), T6; verified T5 tests |
| AC10 | No notation library; own code; font asset under OFL permitted | whole engine T3–T8; asset+OFL T9; no package change T10 |
| AC11 | Editor unchanged | (negative) no edits to `edit.js`/`index.js`; T11 leaves `editor.spec.js` unchanged |
| AC12 | Accessible label on the SVG | T7 (`role="img"` + `<title>`), T8 (name from metadata, i18n), T9 (translations loader); asserted T11 |

## Notes, risks, and non-blockers (no blockers found)

- **No design gap blocks planning.** The design is internally consistent and
  decision-complete; every load-bearing detail (the `<` escape, the
  no-`timeSignature`-for-layout rule, the `normalizeStep` extraction, the
  per-system restatement, the font rename + OFL) has a concrete task.
- **Font asset acquisition is the one operational risk (T9):** subsetting Bravura
  deterministically may not be feasible inside the JS build, so T9 explicitly
  permits committing a renamed full woff2 as a fallback (size is a nicety; the
  rename off the Reserved Font Name, the `OFL.txt`, and the no-library posture are
  the hard requirements). The hand-drawn skeleton (T7) means the structure still
  renders even if the font fails to load.
- **Build-green sequencing.** T4–T7 add isolated modules whose unit tests pass
  independently; the frontend is only wired together at T9/T10, after which
  `npm run build` + the T11 e2e suite exercise the whole path. Run
  `npm run test:unit` + `npm run check` at every task and `npm run build`
  from T9 onward.
- **Do-not-touch list (re-stated for code-writers):** the song format/validator
  vocabulary, `docs/song-format.md`, `src/edit.js`, `src/index.js`,
  `package.json`, and `specs/editor.spec.js`.
