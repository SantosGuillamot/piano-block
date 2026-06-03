# Design Doc: Render the Piano block's song as visual sheet music (grand staff)

> Issue #4. This document is the standalone design for turning the Piano block's
> stored song JSON into readable piano sheet music on the frontend. It is the
> synthesis of the approved spec (`1-spec/spec.md`, the source of truth for scope
> and constraints) and the resolved design research (`2-design-doc/design-doc-research.md`).
> It describes *what* to build and *how* at the design level; concrete code is the
> plan/code phase's job, though small formulas and pseudocode appear where they
> pin down a decision. A reader should not need any other file.

---

## 1. Overview

The Piano block (`piano-block/piano`) is a **dynamic block** that stores a complete
piano song as a dependency-free JSON document in its single `song` string
attribute. The document models a **grand staff** — a right-hand part and a
left-hand part read together. Today the frontend (`src/render.php`) simply echoes
the raw JSON inside a `<pre>` via `esc_html()`; the editor offers a raw-JSON text
field with non-blocking validation.

This feature replaces that raw echo with **readable piano sheet music drawn by the
project's own rendering engine**, with **no third-party music-notation library**
(no VexFlow, abcjs, OpenSheetMusicDisplay, or Verovio). When a reader views a post
containing a Piano block whose `song` is conformant, the block shows a normal-looking
printed piano score: two clefs braced together, key/time signatures, beamed notes
over chords, ties, slurs, dynamics, a tempo marking, and measure numbers. The bar
for "done" is **recognizable and data-faithful** — clearly a standard piano score
that correctly reflects the song's data — **not professional engraving quality**.

Scope is deliberately narrow:

- **Frontend only.** The editor is unchanged (raw-JSON field + validation notice,
  no in-editor preview). An in-editor live preview is a future issue.
- **Display states.** A conformant song renders as SVG notation. An empty/whitespace
  song renders nothing. A present-but-non-renderable song (invalid JSON or
  non-conformant) renders nothing — no raw echo, no reader-facing error.
- **Responsive.** The score wraps into stacked grand-staff systems sized to the
  live container width and reflows as the width changes; it stays usable on mobile.
- **JS may be required.** No no-JS / server-side-rendering guarantee is needed,
  so the rendering runs client-side.
- **Must not preclude** future interactivity (a moving playhead, per-note
  highlighting synced to audio, playback) — but none of that is built here.

### 1.1 The song format (renderer input)

The renderer consumes the song document shipped by the storage feature, unchanged.
All field names are normative:

- **`song`** = `{ metadata?, defaults?, sections }`. `sections` is the only required member.
- **`metadata`** = `{ title?, composer? }` — optional free-text bibliographic data.
- **`defaults`** and each **`section`** carry the *constant musical context*:
  `tempo` (`{ bpm, beatUnit? }`), `timeSignature` (`{ beats, beatType ∈ {1,2,4,8,16,32} }`),
  and per-hand `rightHand`/`leftHand` **handConfig** =
  `{ clef? ∈ {treble,bass,alto,tenor}, alters?, octaveShift? ∈ [-2..2] }`.
  A section overrides only the fields it changes; everything else is inherited
  from `defaults`. `alters` is a map of note-name → integer alteration (−2..+2)
  acting as key-signature-like default accidentals for that hand; it **replaces
  wholesale**, it does not merge. A **new section** is how the format expresses any
  mid-song change of tempo, time signature, clef, default accidentals, or octave shift.
- A **`section`** = `{ tempo?, timeSignature?, rightHand?, leftHand?, measures }`.
  `measures` is required.
- A **`measure`** = `{ rightHand?, leftHand?, barlineStart?, barlineEnd? }`. Each
  hand is an array of **events**; both hands are optional (a measure may have one
  hand or none). Barlines are each one of `regular | repeat-start | repeat-end |
  double | final` (absent = regular).
- An **`event`** = `{ type ∈ {note,rest}, duration ∈ {whole,half,quarter,eighth,
  sixteenth,thirty-second}, dots? ∈ [0..2], pitches?, dynamic? ∈ {pp,p,mp,mf,f,ff,sf,sfz},
  chordSymbol? (free text), tie? ∈ {start,stop}, slur? ∈ {start,stop} }`. A `note`
  carries a non-empty `pitches` array (a chord is several pitches in one event); a
  `rest` omits it.
- A **`pitch`** = `{ step, octave ∈ [0..9], alter? ∈ [-2..2] }`. `step` is a note
  name in English (`C D E F G A B`) or Spanish solfège (`do re mi fa sol la si`),
  case-insensitive. `alter` is a per-note accidental that overrides the section's
  `alters` default for that note name.

A song is **conformant** when it satisfies this format, which is exactly what the
existing validator (`validateSong` in `src/song/validate.js`, driven by the
schema-as-data in `src/song/schema.js`) checks: valid JSON, correct structure,
values within the closed vocabularies above. The format performs **no
musical-timing validation** — a measure's events need not sum to its time
signature, and the two hands need not be equal in length. The empty string `""`
is the "no song" state, never a song document. **This issue does not change the
format, the validator, or `docs/song-format.md`.**

---

## 2. Architecture

### 2.1 Where and how rendering runs

**Decision: client-side JavaScript via a plain `viewScript`.** The block stays a
dynamic block; `render.php` emits a lightweight container that carries the song,
and a frontend script draws the notation in the browser, reusing the existing JS
`validateSong` to gate "render notation or nothing."

This was chosen over two alternatives:

- **Server-side PHP rendering (rejected).** It would force reimplementing the whole
  `src/song/*` validator + walker + note-name vocabulary (English/Spanish,
  case-insensitive) + `alters` + `bpm > 0` in PHP — forbidden drift against a
  format that is designed to grow additively, so a PHP fork would silently diverge.
  More decisively, **responsive reflow is impossible server-side**: wrapping into
  stacked systems sized to the *live* container width (spec req 6 / AC5) needs
  client-side measurement; the server cannot know the rendered pixel width (theme,
  viewport, sidebars, zoom). The layout pass is inherently client-side, and the
  spec explicitly permits JS-required rendering (req 11).
- **Interactivity API (IAPI) via `viewScriptModule` (rejected for this issue).**
  IAPI needs `"supports": { "interactivity": true }` + `"viewScriptModule"`, and on
  the repo's pinned `@wordpress/scripts` **32.3.0**, compiling a `viewScriptModule`
  is gated behind `--experimental-modules` / `WP_EXPERIMENTAL_MODULES` — it is **not**
  built by a plain `wp-scripts build`. That would force a `build`/`start` script
  change for no benefit this issue needs. A plain **`viewScript`** is auto-detected
  by `wp-scripts` and **compiles with the unchanged `npm run build`** (no flag, no
  `package.json` change), honoring spec req 12 with zero friction. WP enqueues it on
  the frontend only, only when the block is present, after the block markup.

**Forward compatibility (req 16) is satisfied architecturally, not via IAPI now.**
The song is carried in the container; there is a single clean `render()`/`draw()`
entry point; layout is recomputed on resize; and (per §2.3 / §4) every notehead,
stem, and playhead-target is its own DOM element with a stable id / `data-*`. A
later issue can adopt the IAPI store (binding `data-wp-class--active` /
`data-wp-style--*` to those already-addressable elements) without a rewrite.

### 2.2 Block wiring: what replaces `<pre>`

`render.php` keeps its early return for the empty state and otherwise emits a
container plus an **inert JSON `<script>`** carrying the song:

- `if ( '' === trim( $song ) ) return;` → output nothing, **no container at all**
  (truly nothing for req 7 / AC6).
- Otherwise emit `<div {get_block_wrapper_attributes()}>` containing
  `<script type="application/json" class="…__song">{song}</script></div>`.

`view.js` reads the child script's `textContent` and `JSON.parse`s it. A JSON
`<script>` is preferred over a data attribute: no HTML-attribute escaping of a
large blob, the `application/json` type is inert (never executed), and it is read
as plain text.

**The `</script>` escaping is a load-bearing, easily-mis-implemented detail.**
Inside a `<script>` raw-text element the HTML parser scans for the ETAGO sequence
`</` (and `<!--`) **regardless of JSON quoting**, so a song containing the literal
`</script>` (e.g. in a `chordSymbol` or `metadata.title`) could break out of the
script element. `esc_html` / `htmlspecialchars` is **WRONG here**: raw-text script
content does not decode HTML entities, so escaping would leave literal `&lt;` that
`JSON.parse` chokes on. The correct, JSON-preserving transform is the **ETAGO
escape**: replace `</` → `<\/` and `<!--` → `<\!--` before emitting. `\/` is a legal
JSON escape for `/`, so `JSON.parse` decodes back to the **exact author bytes**,
while the HTML parser never sees a literal closing tag.

**PHP performs no validation.** `render.php` emits the container for any non-empty
song; `view.js` owns validation and the render-or-nothing decision. No PHP
reimplementation of the validator.

### 2.3 Substrate: inline SVG

**Decision: inline SVG**, chosen over `<canvas>` and HTML/CSS-positioned boxes.

- **Accessibility (AC12).** SVG is cleanest: `role="img"` on the root `<svg>` plus an
  accessible name (via a first-child `<title>`) satisfies the labeled-graphic
  requirement. Canvas is an opaque bitmap whose drawn content is invisible to
  assistive tech.
- **Forward-compat interactivity (req 16) — decisive.** In SVG every notehead/stem
  is its own DOM element: a future playhead is one translated `<line>`/`<rect>`; a
  per-note highlight is a class/attr toggle. Canvas has nothing addressable —
  highlight/playhead would need a full clear+redraw every frame plus custom
  hit-testing, exactly the "expensive to make interactive" trap req 16 warns against.
- **Crispness / HiDPI.** SVG is retained vector — sharp at any width and DPI for
  free. Canvas needs manual `cssSize × devicePixelRatio` backing-store management.
- **Responsive regeneration.** On resize, SVG just recomputes system breaks and
  rebuilds the subtree (one DOM swap); a few hundred SVG elements is comfortable for
  static notation.
- **Glyph hosting.** A single `<svg>` freely mixes font glyphs (`<text>`) and
  hand-drawn `<path>`/`<line>`/`<rect>`/`<ellipse>`/`<polygon>` in one coordinate
  space, so SVG does not pre-commit the font-vs-path decision (§2.4).
- **HTML/CSS disqualified.** It cannot cleanly draw the curved/slanted parts —
  slanted beams, curved ties/slurs (no arbitrary-curve primitive), and the ornate
  grand-staff brace — without embedding SVG paths anyway.

The root is `<svg role="img">` with a single accessible name. Elements get stable
ids / `data-*` (e.g. note index) during draw so a later store can target them.

### 2.4 Glyph strategy: hybrid font + hand-drawn paths

**Decision: HYBRID.** Subsetted-and-renamed **Bravura** (woff2, SIL OFL 1.1) for the
ornate discrete glyphs, plus hand-drawn SVG primitives for all geometry and the
trivial glyphs.

- **Font half (ornate glyphs):** clefs (treble/bass/alto/tenor C-clef), rests
  (quarter and the ornate eighth/sixteenth/thirty-second), accidentals (incl.
  double-sharp/double-flat), flags, the grand-staff brace, time-signature digits.
  These ~8–10 glyphs are exactly the ones hardest to hand-draw to a "clearly a
  standard piano score" bar (AC1) and most damaging if amateurish. Bravura is the
  SMuFL reference font (SMuFL = the standard Unicode-PUA codepoint mapping), maximally
  conventional and best documented.
- **Hand-drawn half (geometry + trivial glyphs + skeleton):** staff lines, stems,
  beams, ties, slurs, ledger lines, barlines — never glyphs in any strategy — plus
  noteheads (`<ellipse>`), the augmentation dot (`<circle>`), and whole/half rests
  (rectangles). This hand-drawn set **doubles as a font-failure skeleton**: if the
  font 404s or blocks, the structure (staves, stems, beams, ties, ledgers, barlines,
  noteheads, dots) always renders; only the ornate glyphs depend on the font.
- **Plain text:** dynamics and ottava/octave labels are plain bold/italic font text
  in every strategy, not music glyphs.

**Licensing.** Bravura is SIL OFL 1.1; OFL 1.1 explicitly permits bundling/embedding/
redistribution inside GPL software, and the plugin is GPL-2.0-or-later — compatible.
The "can't sell the font alone" clause does not bite (we bundle, never sell alone).
**"Bravura" is a Reserved Font Name**, so a subset is a Modified Version and **MUST
be renamed** (e.g. "PB Music") and ship the `OFL.txt` alongside it.

**Size / delivery.** Full `Bravura.woff2` ≈ 247 KB; we use only ~30–40 codepoints,
and subsetting (an OFL-permitted modification) typically cuts a SMuFL font to ~10–40 KB
woff2. We commit a **pre-subsetted, renamed `.woff2`** to the repo (deterministic;
no `fonttools` in the JS build) plus `OFL.txt`. FOUT is mitigated by `font-display`
and by **gating the first `draw()` on `document.fonts.ready` / `document.fonts.load(...)`**.

**Asset ≠ library.** A `.woff2` ships zero executable code; the spec explicitly
permits "a standalone open-licensed music-font asset" (req 10 / AC10). The no-library
rule targets notation *engines*, not a font file taken alone.

**Indirection.** The engine exposes glyphs behind a small **glyph map** (`glyphs.js`,
§3) so the all-hand-paths alternative — or a future font swap — does not ripple
through the renderer.

**Documented alternative — all hand-drawn paths (B).** Drawing every glyph as SVG
paths is explicitly permitted by the spec and is a credible zero-asset choice. It is
the right pick **if** the team holds a hard "zero bundled binary asset / fully
self-contained" value (the project's dependency-free ethos is a mild pull that way),
accepting the authoring risk on the clef/brace/rest/double-sharp glyphs. The hybrid
(C) is the recommendation because it buys instant high fidelity on exactly those hard
glyphs at a tiny shipped size with clean licensing and graceful degradation; pure-font
(A) is strictly worse than C (font-failure fragility on trivial shapes for no gain).

### 2.5 Frontend display states

Three states, satisfying AC1/AC6/AC7:

| Stored `song`            | `render.php`                          | `view.js`                                   | Visible result        |
|--------------------------|---------------------------------------|---------------------------------------------|-----------------------|
| empty / whitespace       | early return — **no container**       | (nothing to do)                             | **nothing**           |
| present, non-renderable  | container + inert JSON `<script>`     | `validateSong` → errors → draw nothing      | **nothing** (empty wrapper) |
| present, conformant      | container + inert JSON `<script>`     | `validateSong` → `[]` → `JSON.parse` → draw | **SVG notation**      |

"Outputs nothing" means **no visible/meaningful output, not literally zero DOM
nodes**. For the non-renderable case an **empty invisible wrapper** (with the inert
JSON `<script>` inside) is acceptable and preferred — nothing visible appears, no raw
echo, no error message. The wrapper is *not* removed (removing it would cause a flash
and fight WordPress's block wrapper); it is left empty/invisible. Downstream tests must
therefore assert "no SVG / no visible notation," not "zero DOM nodes."

### 2.6 Validate-vs-reparse and data delivery

`view.js`, per container:

1. `raw = script.textContent`
2. `errors = validateSong(raw)` — the reused gate. `validateSong` already returns
   `["Invalid JSON: …"]` for parse failures, so this one call covers both invalid
   JSON and non-conformant structure.
3. `errors.length > 0` → render nothing (leave the wrapper empty).
4. else `data = JSON.parse(raw)` (defensively wrapped; it cannot fail after a clean
   validate) → build the layout model and draw.

**Decision: reparse (option a).** Call `validateSong(raw)` for the gate, then
`JSON.parse(raw)` again for the data. This has **zero footprint on `src/song/*`** (the
most conservative reading of "don't touch the format/validation"), the double-parse
cost is nil for these tiny songs, and it is guaranteed-safe (the reparse runs only
after `errors === []`). Adding a `parseSong(raw) → {data, errors}` helper (option b)
is additive and slightly cleaner but unnecessary; (a) is the choice.

---

## 3. Modules

The decomposition separates a **pure layout-model layer** from a **thin SVG-emit
layer**, with a swappable **glyph map**. The intermediate model is the single biggest
lever for testability (the 12 ACs and the adversarial AC8), for forward
interactivity, and for cheap resize.

```
src/
  view.js                 viewScript ENTRY — thin, DOM-coupled
  notation/
    layout.js             PURE layout layer (no DOM, no sp→px)
    svg.js                thin EMIT layer (model → SVG DOM)
    glyphs.js             glyph map (codepoints + hand-drawn specs + skeleton)
    constants.js          SP constants (optional split)
  song/
    validate.js           REUSED as-is (the render-or-nothing gate)
    schema.js             REUSED as-is
    normalizeStep.js      NEW shared note-name helper (see §6.5)
```

- **`src/view.js` — entry (thin, DOM-coupled).** Query the block containers, read
  each child JSON `<script>`'s `textContent`, run the `validateSong` gate, `JSON.parse`,
  call `render(...)`, and wire the rAF-debounced `ResizeObserver`. It also computes the
  accessible name from `metadata` and sets `role="img"` + `<title>`. Kept tiny.

- **`src/notation/layout.js` — the pure layout layer.** Input: the parsed song +
  the available width in staff spaces (`availableWidthInSp`). Output: a **layout model**
  — a plain-data tree of positioned primitives in SP units (no DOM, no sp→px scaling).
  The model is a simple positioned-primitive tree, not a scene-graph framework:
  systems → grand-staff bands → (staff lines, clefs, key sig, time sig, barlines,
  brace) + per-event (noteheads, stem, flags, beams, accidentals, dots, ledger lines,
  rest) + spans (ties, slurs) + texts (dynamics, chord symbols, tempo, measure numbers,
  ottava). **All hard/adversarial logic lives here as pure functions returning data:**
  pitch→Y, beaming, union-grid alignment + AC8 handling, accidental precedence,
  section diff, tie/slur matching — assertable with no DOM.

- **`src/notation/svg.js` — the thin emit layer.** Walk the model, `createElementNS`
  each primitive, apply the sp→px scale and per-system Y offsets, use `textContent`
  for all author text, and set the root `role="img"` + `<title>`. Stamps ids / `data-*`
  from model nodes (the future-interactivity hook). Contains no layout math.

- **`src/notation/glyphs.js` — the glyph map.** Maps each symbolic glyph name to its
  SMuFL codepoint (font path) and/or a hand-drawn primitive spec (the font-failure
  skeleton and the trivial glyphs). The indirection that keeps the renderer agnostic
  to the font-vs-path choice (§2.4) and swappable.

- **`src/song/normalizeStep.js` (new, shared).** One home for the English/Spanish/
  case note-name equivalence, reused by pitch→Y, `alters` lookup, and any note-name
  comparison (§6.5).

The model is computed once per layout; on resize only the packing/justify recompute,
not per-event geometry. Cost is one data structure plus a mechanical walk —
negligible at our scale.

---

## 4. Data flow

```
render.php
  song attribute (string)
    └─ trim=='' ? return : <div wrapper><script type="application/json" …>SONG</script></div>
                                            (ETAGO-escaped:  </ → <\/ ,  <!-- → <\!-- )

(browser, frontend only)
view.js  (viewScript, gated on document.fonts.ready for the first draw)
  for each container:
    raw  = childScript.textContent
    errs = validateSong(raw)            ── reused song/validate.js
    if errs.length:  leave wrapper empty (render nothing)
    else:
      data = JSON.parse(raw)
      build:  resolve effective context per section (inheritance pre-pass, §6.6)
      model = layout(data, availableWidthInSp)     ── pure notation/layout.js
      svg.js: model → <svg role="img"><title>…</title> … </svg>
      set accessible name from data.metadata
      ResizeObserver(container) → rAF+debounce → re-pack/justify → rebuild SVG
```

The container width flows **one-way** (`container → SVG`): the resize callback only
sets the SVG's height/content, never writes back the container width, so it cannot
trigger a ResizeObserver loop.

---

## 5. The rendering engine — coordinate model and pitch placement

### 5.1 Staff-space coordinate model

The drawing uses the standard engraving unit, the **staff space (sp)** = the
distance between adjacent staff lines; the 5-line staff spans **4 sp**. One constant
`SP` is the size of a staff space in SVG user units; a `viewBox` decouples user units
from pixels. Y increases **downward** (SVG default), so higher pitch = smaller Y.

A **staff-step** integer is used for vertical placement: 1 staff-step = one
line-or-space = **0.5 sp** in Y, so every notehead lands on an exact half-sp grid.
**Lines sit at even** staff-steps, **spaces at odd**. `sFromBottom` numbers positions
from the bottom staff line (0) to the top line (8): lines 0/2/4/6/8, spaces 1/3/5/7.

### 5.2 Pitch → staff position (per clef) with ledger lines

Placement depends **only** on the diatonic step + octave, **never on `alter`** (an
accidental shifts the glyph left of the notehead, not the staff position).

- **Diatonic index.** `stepIndex`: C=0 D=1 E=2 F=3 G=4 A=5 B=6. Spanish solfège
  (do/re/mi/fa/sol/la/si) is normalized to C/D/E/F/G/A/B, case-insensitive, via the
  **shared `normalizeStep` helper** (§6.5). `diatonicIndex = octave*7 + stepIndex`.
  Middle C = **C4 = 28**.
- **Clef references** (`sFromBottom` of the clef's reference pitch):
  `treble {G4, 2}`, `bass {F3, 6}`, `alto {C4, 4}`, `tenor {C4, 6}`.
- **Y formula (clef-agnostic):**

  ```
  staffStepFromBottom(p) = ref.sFromBottom + diatonicIndex(p) − diatonicIndex(ref.pitch)
  Y(p)                   = bottomLineY − staffStepFromBottom(p) × (SP/2)
  ```

  Verified: treble E4→0, G4→2, F5→8, C4→−2 (one ledger below), C6→12 (two ledgers
  above); bass C4→+10 (one ledger above — the classic middle C above the bass staff).
  On the unified `diatonicIndex` scale, treble C4 (−2) and bass C4 (+10) are the same
  middle C, confirming the grand staff is internally consistent.
- **Ledger lines.** Draw a short segment at every **line position (even `sFromBottom`)**
  between the staff and a note outside it, inclusive of the note's own line when it
  sits on a ledger line. Above: even `sFromBottom` from 10 up to the largest even ≤
  the note's `sFromBottom`. Below: mirror from −2 downward. None for `0 ≤ sFromBottom ≤ 8`.
  Each ledger is centered on the notehead, ~2 sp wide. Same routine for both staves.
- **Alto/tenor need no special case.** The Y formula handles them with two more
  `clefRef` entries plus the C-clef glyph; everything downstream (ledgers, stems,
  beams) operates on `sFromBottom` and is clef-independent.

### 5.3 octaveShift → ottava bracket, never a vertical move

`octaveShift` is a **bracket, not a vertical move**: the written pitch on the staff is
unchanged; only the sounding pitch transposes. So notes are placed by their **written
octave**, and an **ottava marking** (dashed bracket + label) spans the affected hand's
section notes: `+1` → "8va", `−1` → "8vb", `+2` → "15ma", `−2` → "15mb"; above the
staff for positive, below for negative. `octaveShift` is section-scoped per hand; the
bracket is drawn per affected hand over the section's measures and re-stated per
wrapped system. **Key correctness point: do not shift Y.**

---

## 6. Key algorithms

### 6.1 Durations → noteheads, stems, flags, beams; chords; dots

**Noteheads / stems / flags.** whole = open notehead, **no stem**; half = open +
stem; quarter and shorter = filled + stem. Flags appear only on **un-beamed** flagged
notes (eighth=1 flag, sixteenth=2, thirty-second=3); a note is **either flagged or
beamed, never both**. Flag at the stem end, on the right of the stem for both
directions, additional flags stacked toward the notehead, using the font glyph.
Constants (starting points): `stemLength ≈ 3.5 sp` (extend so the stem end crosses the
middle line for far ledger notes); stem thickness ≈ 0.13 sp; notehead ≈ 1.18 × 1 sp
(ellipse rx ≈ 0.6, ry ≈ 0.5).

**Stem direction + side (single-voice per staff).** Single note: `sFromBottom < 4` →
stem **up**; `sFromBottom ≥ 4` → stem **down** (a note on the middle line stems down).
Stem-up attaches at the **right** of the notehead, stem-down at the **left**. Chord:
direction set by the note **farthest from the middle line** (`max |sFromBottom − 4|`;
ties → down); the stem spans the chord's full vertical extent. Each staff is a single
voice deciding its own direction by its own middle line — the format gives one flat
event array per hand per measure, so **no cross-staff, no multi-voice forced directions**.

**Inferred best-effort beaming (no beam markers, no timing guarantee), per hand per
measure.**

1. Walk events tracking a running `pos` in quarter-beats using `baseDur` (quarter 1,
   half 2, whole 4, eighth 0.5, sixteenth 0.25, thirty-second 0.125) × dot factor
   (1 dot ×1.5, 2 dots ×1.75) — **the same arithmetic the horizontal spacing needs,
   reused** (§6.2).
2. A note is **beamable** if it is a *note* (not a rest) of eighth/sixteenth/
   thirty-second.
3. Accumulate consecutive beamables; **break** at a rest, a non-beamable note, the
   measure end, or a beat-boundary crossing.
4. The beat unit comes from `timeSignature` **for grouping only**: **compound**
   (`beatType ∈ {8,16}` AND `beats % 3 == 0`, e.g. 6/8, 9/8, 12/8) → group in 3s
   (dotted beat); **simple** (everything else) → one `beatType` unit per beat (4/4
   eighths beam in 2s). Break when `floor(pos / beatLen)` changes; a note straddling a
   boundary starts a new group (never split a note).
5. **Robustness:** `pos` is only a grouping aid — if events overflow the bar, keep
   accumulating/grouping, never clamp or crash; a group of length 1 renders as a
   **flagged** note, not a one-note beam.

**Beam geometry.** One stem direction per group (the extreme rule). **Flat horizontal
beams are acceptable** at our bar (beam Y at the most-extreme stem end so no stem is too
short; all stems run to that common Y), which sidesteps beam-slope rules (out of scope).
Primary beam = a thick line across the stem ends; secondary beams for 16th/32nd run
parallel ~0.25–0.3 sp toward the noteheads. In a mixed group, between adjacent notes
draw `min(beamCount(left), beamCount(right))` secondary beams, and an isolated shorter
note gets a short **stub** pointing toward the beat. `beamCount`: eighth 1, sixteenth 2,
thirty-second 3. Beam thickness ≈ 0.5 sp; ≈ 0.75 sp per stacked level.

**Chord stacking + the seconds rule.** All pitches share one stem; each notehead at its
§5.2 Y. The **seconds rule**: when two chord notes are a diatonic second apart
(`Δ sFromBottom = 1`), the lower goes **left** of the stem and the higher **right**,
regardless of stem direction (the displaced back-note offset ~1 notehead width). In a
cluster (C-D-E) the outer two are normal and the middle is flipped. No seconds → all on
the normal side. Chord dots: one per notehead, aligned.

**Dots.** The augmentation dot sits to the **right** of the notehead, centered on a
**space**: a note in a space (odd `sFromBottom`) → dot at the notehead Y; a note on a
line (even `sFromBottom`) → dot nudged up into the adjacent space (Y of `sFromBottom+1`).
A second dot is further right. Constants: dot offset ≈ 0.5 sp right of the notehead,
radius ≈ 0.15 sp, inter-dot ≈ 0.5 sp.

### 6.2 Per-measure two-hand time grid + compressive horizontal spacing

This is the most adversarially-tested requirement (req 5 / AC5, robust under AC8/AC9).

**Union-grid alignment.** Per hand, each event's onset = the running sum from 0 of
`dur(e) = baseDur[duration] × dotMul[dots]` (dotMul: 0→1, 1→1.5, 2→1.75) — the §6.1
arithmetic, computed per hand independently. The **GRID = the sorted unique union of
both hands' onsets**; each unique onset `t` maps to one X, and an event at `t` in
either hand draws at `X(t)` → automatic vertical alignment. Behaviour verified across:
equal onsets align; different subdivisions (RH eighths / LH quarters) → the off-beat RH
note gets its own X between LH columns; unequal totals → the grid extends to
`max(handEnds)` and the short hand simply has no events past its end; empty/one-hand →
the grid is the present hand's onsets, and **both staves are still drawn from measure
geometry** (staff lines do not depend on events).

**Compressive spacing (over strict proportional).** Real engraving spacing is
logarithmic (~1.5:1 per duration-doubling), not 2:1; strict proportional would make a
whole note 32× a 32nd. Formula:

```
advance(Δ) = MIN_ADV + K · sqrt(Δ)      MIN_ADV ≈ 2.2 sp,  K ≈ 3.0 sp
```

`Δ` = the gap to the next onset; the last onset uses `Δ = measureEnd − lastOnset`.
This gives whole-vs-32nd ≈ 2.5:1 (not 32:1). An empty measure → a floor width ≈ 3.3 sp.
`MIN_ADV` is raised per-column when accidentals/dots/flags are present at that column,
so glyphs clear (ties into §6.4).

**Intrinsic, content-driven measure width.** `measureWidth = Σ advances + leadingPad +
trailingPad`. The leading pad applies only to measures that print clef/keysig/timesig
(a system start, or a section-change restatement); the trailing pad = the barline width
(+ repeat dots / final thick bar). Rests are full grid citizens (a rest advances the
running onset, gets a grid onset, occupies space). Same onset / different durations
needs no fill — a half-note at X(0) visually spans toward its next onset while the other
hand's intervening columns stay empty (read as a sustained note).

**CRITICAL ROBUSTNESS RULE — the renderer must NEVER use `timeSignature` to compute
positions or widths.** `timeSignature` is used ONLY to (a) draw the time-signature glyph
and (b) derive the beat unit for beam grouping (§6.1). All onsets and widths come purely
from the events' own durations. This makes **AC8** ("events don't sum to the time
signature") fall out **structurally** — the layout does not know or care what the bar
"should" total — and the staves are always drawn from geometry, not from events, which
gives **AC9** (one-hand / empty-hand measures still draw both staves). Guards keep it
NaN-safe: `sqrt(max(Δ, 0))`, an empty-grid short-circuit to the floor width, and
`measureEnd = max(handEnds, 0)`; the durations are finite values from a closed,
already-validated vocabulary.

### 6.3 System wrapping + responsive reflow (client-side)

The intrinsic measure widths (§6.2) are packed into width-fitted stacked systems.

- **Greedy packing** (Knuth–Plass optimal breaking is out-of-scope engraving polish).
  `budgetSp = containerPx / spPx`; `availSp = budgetSp − leadingReserve`; fill a system
  until the next measure would exceed `availSp`, then break; **always ≥ 1 measure per
  system** (prevents an infinite loop on a wide measure). The per-system **leading
  reserve** = brace + both clefs + alters (+ timesig only on system 1 / on change),
  ~10–14 sp, computed exactly from the glyphs actually printed (it varies with the
  number of `alters`).
- **Justify, with a clamp.** Stretch each system to fill the width by scaling the
  internal grid **advances only** (NOT the leading reserve, glyph sizes, stems, or
  noteheads — stretch whitespace, not symbols): `scale = clamp(availSp / contentSp, ·,
  MAXSTRETCH ≈ 1.6)`; when scale would exceed the cap, leave that system ragged-right.
  **Do not justify the last system** of the whole score (the conventional ragged last
  line) nor an over-wide (scale < 1) system.
- **A single measure wider than the container → downscale that system.** The over-wide
  measure goes alone on its system, and that **system** is uniformly downscaled to fit
  (`downscaleFactor = min(1, availSp / measureContentSp)`, applied as a transform on the
  system's `<g>`, glyphs included) — no overflow, no horizontal scroll (more usable on
  mobile than clipping/scrolling, and avoids a UX the spec does not ask for). Only the
  offending system shrinks; the rest stay readable. (Verified: a 60 sp measure on a
  33 sp-avail phone → factor 0.55, fits.)
- **Sizing model = fixed sp px, wrap-on-resize.** `sp = 8 px` (staff height 32 px) is
  fixed; the SVG width = the container width; the SVG height grows with the number of
  systems; a resize recomputes packing only. Fixed sp keeps glyphs/staff/text a constant
  readable size (dynamics/chord/tempo text do not shrink with the page) and makes resize
  a pure re-wrap — cheap and stable. Whole-SVG downscale is used **only** as the
  per-system over-wide fallback above. Optional refinement: step sp to 7 px below a
  ~480 px container (a discrete breakpoint, not continuous scaling).
- **Per-system restatement.** Every system restates the **brace, both clefs, and the
  alters**. The **time signature** is drawn only on system 1 and where it changes (a
  section change), not on every system. Section changes mid-system are drawn **inline**
  at that measure's start (small clef/keysig/timesig glyphs at the boundary, §6.6); the
  next system restates the now-current clef + alters in its leading reserve.
- **Resize = re-pack only, rAF-guarded one-way observer.** A `ResizeObserver` on the
  **container** → debounce/rAF → recompute packing + justify → rebuild the SVG (cheap
  per §2.3). Per-measure intrinsic widths and pitch Ys are sp-relative and **invariant**
  on resize — only the system breaking and X justification change. Loop guard: width
  flows **container → SVG one-way**; inside the callback only set the SVG height + inner
  content, never write back the container width, and wrap in rAF (the benign
  "undelivered notifications" warning is removed by rAF).
- **Vertical spacing (starting sp constants):** intra-system staff gap (between the RH
  and LH 5-line staves) ≈ 8 sp (room for middle-C ledgers between them); inter-system
  gap ≈ 8–12 sp; one grand-staff band ≈ topMargin ~4–6 (chord symbols/ottava/tempo) +
  RH 4 + intra 8 + LH 4 + bottomMargin ~4–6 ≈ 24 sp. **Top/bottom margins are computed
  from content** (max ledger extent + presence of ottava/dynamics/chord-symbols in that
  system) so tall stacks do not collide with the neighboring system — a measured
  per-system margin, not a fixed guess.

### 6.4 Accidentals — stateless, data-faithful (AC3)

Placement is correctness-critical: a per-note `alter` overrides the hand's `alters`
default for that note name, doubles −2..+2 are supported.

**Key-signature-like display of `alters`.** Render `alters` as a cluster at each system
start (and at a section change), **one glyph per altered note name** at that letter's
standard key-signature position for the active clef. The renderer does **not** try to
detect or canonicalize a circle-of-fifths key — `alters` is an arbitrary map. Standard
sets render in the conventional order (sharps F C G D A E B / flats B E A D G C F,
others appended in note-name order) so they look right; odd/partial sets just show those
accidentals (data-faithful). Vertical placement uses a fixed per-clef table of 7
key-sig registers. Doubles in `alters` (never seen in real key sigs) simply draw the
double glyph — faithful and recognizable.

**Per-note precedence — the stateless, data-faithful rule.** Compute
`effectiveAlter = pitch.alter ?? normAlters[letter] ?? 0` (used for any pitch reasoning),
and decide the **glyph** statelessly:

- `pitch.alter` present and ≠ 0 → draw that accidental (even if redundant — a legitimate
  courtesy/cautionary accidental, never a wrong pitch);
- `pitch.alter` present and == 0 → draw a **natural only if** the key-sig default for
  that letter ≠ 0 (otherwise nothing, so plain notes do not get pointless naturals);
- `pitch.alter` absent → **no glyph** (its default lives in the key signature).

This renders exactly what the author wrote — explicit overrides always win and always
show, so AC3 falls out structurally — and it is **stateless**: no measure-local
accidental tracking. That matters because the format has no timing/measure model; a
stateful "lasts-till-barline" rule would have to reason about boundaries the data does
not guarantee, adding fragility for no fidelity gain at our bar. Verified: B
default-flat with no override → no glyph; B explicit `alter:0` → natural; F#2 explicit →
sharp; Spanish "si" under `alters{B:-1}` → −1, no glyph; "C" under `alters{do:1}` → +1,
no glyph; explicit doubles → double glyphs.

**Honest caveat (recorded).** This stateless rule deliberately does NOT auto-cancel a
mid-measure accidental on a later same-named note (strict notation would). Accepted: the
format has no reliable measure/timing model to anchor persistence, each note expresses
its own intent via its `alter` (or relies on the key-sig default), and the only
divergence is occasional courtesy accidentals — themselves a real convention. Strict
measure-persistence is more code, more fragile under no-timing data, and not needed for
"recognizable + data-faithful."

**Glyphs + placement.** Five font glyphs, indexed by `alter + 2`:
`["double-flat","flat","natural","sharp","double-sharp"]`. Drawn to the **left** of the
notehead at the **same Y** (alter never moves Y), 0.5–1 sp gap, glyph width ≈ 1–1.3 sp.
Chords: a column ~1 sp left of the noteheads; if two accidentals fall within ~1.5 sp
(3 staff-steps) vertically, push one into a second column ~1.3 sp further left (process
top-down). Full optimal accidental stacking is out of scope.

### 6.5 Note-name normalization (single shared source)

Both `alters` keys and `pitch.step` are normalized to a canonical letter (do→C … si→B;
English to itself; case-insensitive) using the **same vocabulary the validator encodes**
(`NOTE_NAMES` in `src/song/validate.js`, which is currently private). This canonical
step→letter knowledge is exactly what §5.2's `stepIndex`, §6.4's `alters` lookup, and any
note-name comparison need, so it is centralized in **one `normalizeStep()` helper** in
`src/song/`, imported into `notation/`. The plan must expose/share this without changing
validation behavior — export a helper from the song module (or carefully duplicate the
14-entry map), but only *expose/reuse* the vocabulary, never alter what the validator
accepts.

### 6.6 Section context resolution + section-change inline rendering (AC4)

A single engine pre-pass **resolves each section's effective context** via the
inheritance model: each field inherits from `defaults` independently; `alters` replaces
wholesale; `octaveShift` defaults to 0. This resolved context feeds the key sig, clef,
tempo, time sig, ottava, and the section diff — one "resolve context per section" step.

For mid-song changes, **diff each section's effective context against the previous one
and draw ONLY what changed** (the first section draws everything). Per change type:

- `tempo` → tempo text;
- `timeSignature` → time-signature glyph;
- `clef` (per changed hand) → an inline cautionary clef;
- `alters` (per changed hand) → a new key-sig cluster;
- `octaveShift` (per changed hand) → begin/end an ottava bracket.

At a system start these go in the leading reserve; mid-system, they are drawn inline at
the boundary measure. The diff drives mid-song changes; the per-system restatement
(§6.3) always redraws the current clef + alters regardless. (Verified against the docs'
annotated 2-section example: tempo 120→90 redraw, timesig 4/4→3/4 redraw, RH clef treble
unchanged → not redrawn, LH clef bass→tenor redraw, RH alters {}→{F,C} and LH alters
{B:−1}→{} both redrawn, RH octaveShift 0→1 starts 8va, LH octaveShift unchanged → nothing.)

### 6.7 The remaining symbol catalogue

- **Barlines** span both staves of the grand staff (thin ≈ 0.13 sp, thick ≈ 0.5 sp):
  regular = one thin; double = two thin ~0.5 sp apart; final = thin then thick (right);
  repeat-start = thick+thin + two dots to the right (2nd/3rd spaces); repeat-end = two
  dots left + thin+thick. `barlineEnd` is at the right edge, `barlineStart` at the left.
  **Shared rule:** always draw `barlineEnd`; draw `barlineStart` only when it is
  `repeat-start` (collapse otherwise to avoid a double line). At system breaks the last
  measure of a system always closes with its `barlineEnd`, a `repeat-start` on a new
  system's first measure still shows (after the leading reserve), and the first measure
  of the score has no left barline.
- **Measure numbers.** System-start numbering: number each system's first measure,
  above-left of the RH staff, small text ~2–2.5 sp. The index basis is **sequential
  1..N across the entire song; section boundaries do NOT reset** it. (Omitting "1" on the
  first system is an optional nicety.)
- **Ties — stack-based, dangling-safe.** Per hand, a `tie:start` opens a pending tie
  closed by the next `tie:stop`, tying matching pitches (same `diatonicIndex`) of the
  two events' noteheads; chords tie shared pitches best-effort. Geometry: a short,
  shallow quadratic Bézier from the right of the start notehead to the left of the stop
  notehead at ~notehead Y, bulging opposite the stem (down for stem-up, up for
  stem-down), height ~0.5–1 sp, thin stroke. Robustness: a dangling start (including
  end-of-hand), a dangling stop, or a second start before a stop → best-effort stub or
  skip, **never throws**. Across barlines/systems → drawn between the actual laid-out
  positions, clipped to system edges; never assume the same system.
- **Slurs — same matching machinery, different curve.** Stack-based pairing, independent
  of ties (a note may have both); dangling handled identically. Geometry: a longer arc
  **over** the phrase (above, opposite the stems) whose bulge clears the intervening
  noteheads/stems. Tie-vs-slur distinction comes from the data markers plus the curve
  shape/reach/side; the same Bézier primitive serves both.
- **Dynamics.** Bold-italic text ~2.5–3 sp, below each hand's staff at the event's grid
  X (RH dynamics in the inter-staff gap, LH dynamics below the LH staff — consistently
  "each hand's dynamics just below that hand's staff"). SMuFL dynamics glyphs are an
  optional later upgrade.
- **Chord symbols — free text, escaped.** Render the string verbatim (no parsing) above
  the RH staff at the event's X, ~2.5–3 sp.
- **Tempo text.** "[beatUnit note-glyph] = [bpm]" (e.g. ♩ = 120): the `beatUnit` is the
  matching note-value font glyph + " = " + the bpm number; **a missing `beatUnit`
  defaults to the quarter glyph** (don't omit it — glyph + "=" + number is the
  recognizable metronome mark). Drawn above the first measure of the section, at the song
  start and at any section that changes tempo.

### 6.8 SVG text safety (replaces render.php's `esc_html` posture in the engine)

All SVG is built via `createElementNS` + **`textContent` / `createTextNode`, NEVER
`innerHTML`**, and never `<script>` / `<foreignObject>`. Author free text — `chordSymbol`
and `metadata.title` (in the a11y `<title>`) — therefore renders as inert text,
preserving render.php's old `esc_html` protection inside the client engine. (If the SVG
were ever string-built instead, author text would have to be escaped first.) This DOM-build
approach is the engine-side half of the XSS guarantee; the `render.php` ETAGO escape
(§2.2) is the transport-side half.

---

## 7. Accessibility

The rendered notation exposes a concise accessible label (req 14 / AC12): the root
`<svg>` carries `role="img"` and **one** accessible name via a first-child `<title>` set
with `textContent` (the §6.8 safety rule). Because `view.js` already has the parsed song,
the name is computed client-side from `metadata` — no PHP plumbing. Use exactly one name
source (a `<title>` first child; if `aria-label` were also set it would win — avoid
setting both).

Templates (metadata strings count only when non-empty after trim):

| metadata present       | accessible name                         |
|------------------------|-----------------------------------------|
| title + composer       | "{title} by {composer}"                 |
| title, no composer     | "{title}"                               |
| no title, composer     | "Piano sheet music by {composer}"       |
| neither                | "Piano sheet music"                     |

**i18n.** Wrap the non-author strings in `@wordpress/i18n` now (zero cost, correct
English by default): fallback `__("Piano sheet music", "piano-block")`; with a composer
use `sprintf(_x("%1$s by %2$s", "…", "piano-block"), title, composer)` /
`sprintf(_x("Piano sheet music by %s", "…", "piano-block"), composer)`; the title-only
case is the author's own text (no wrapper). `__`/`_x`/`sprintf` work in a viewScript, but
translations only **load** if PHP calls `wp_set_script_translations(<viewScript handle>,
"piano-block", <path>)` and PO→JSON files ship. Wiring that loader is a minor plan task;
the spec only needs a concise accessible name, and English works out of the box.

---

## 8. Testing strategy

The pure layout-model seam (§3) makes all the hard logic DOM-free and unit-testable.

- **Unit (Jest / `test-unit-js`) on the pure layer** — the high-value coverage:
  - pitch→Y per clef (the §5.2-verified cases as fixtures);
  - simple/compound beaming + breaks + length-1→flag;
  - union-grid + **AC8 robustness** (equal / different-subdivision / unequal / overflow /
    empty-hand → no throw, both staff bands present (AC9), empty song → floor width, no NaN);
  - accidental resolution + **AC3 precedence** (override, natural cancellation,
    English/Spanish normalization, doubles);
  - section resolve + diff (the docs' annotated 2-section song = the exact §6.6 fixture);
  - tie/slur dangling matching.
- **E2E (Playwright, `specs/`):**
  - the three display states (empty → no SVG / nothing visible; non-renderable → no
    `<svg>` / no visible notation, wrapper may exist; conformant → `<svg role="img">` with
    the expected accessible name);
  - responsive (wide vs narrow viewport → the number of systems / wrapping changes);
  - injection safety (a `chordSymbol` / `title` containing `</script>` and
    `<script>alert()</script>` → no script executes, text is inert via `textContent`, and
    the JSON `<script>` does not break out — the relocated AC8 protection).
- **`render.spec.js` REWRITE** (the current tests assert the old `<pre>` behavior and
  contradict the new design):
  - OLD "empty → no `<pre>`" → retarget to "empty → no SVG / nothing visible";
  - OLD "verbatim `<pre>`" → REPLACE with "conformant → `<svg role="img">` grand staff,
    no `<pre>`, raw JSON not shown" (the core flip);
  - OLD "escaped `<pre>`, no XSS" → REWRITE preserving intent: "hostile text inert (no
    script exec), rendered via `textContent`, JSON-in-`<script>` does not break out" (XSS
    protection survives, relocated from `esc_html(<pre>)` to `textContent(SVG)` + the ETAGO
    escape).
- **`editor.spec.js` UNCHANGED** (the editor is untouched — req 13 / AC11). Optionally add
  one assertion that no notation renders in the editor.
- **Sample song.** Reuse the docs' annotated example (`docs/song-format.md`) — the
  deliberate "exercises everything" song and the validator's own known-conformant fixture
  — as both the unit fixture for the full layout model and the e2e conformant input. Add a
  few targeted tiny fixtures for the adversarial AC8 cases (an overflow bar, an empty hand,
  a dangling tie), since the annotated song is well-formed.

---

## 9. Trade-offs and rejected alternatives

- **Server-side PHP rendering — rejected.** Forces a forbidden PHP fork of the
  `src/song/*` validator and cannot do responsive reflow (the server has no live width).
  Client-side JS reuses `validateSong` as-is and measures the real container.
- **Interactivity API via `viewScriptModule` — rejected for this issue.** Needs
  `--experimental-modules` on the pinned `@wordpress/scripts` 32.3.0 (a build-config
  change) for no benefit here. A plain `viewScript` builds with the unchanged toolchain;
  req 16 is met architecturally (addressable SVG elements + a single `render()` entry), so
  a later issue can adopt IAPI without a rewrite.
- **`<canvas>` substrate — rejected.** Opaque to assistive tech, requires manual HiDPI
  backing-store management, and makes interactivity expensive (full redraw + hit-testing
  every frame) — the trap req 16 warns against.
- **HTML/CSS-positioned boxes — rejected.** Cannot cleanly draw slanted beams, curved
  ties/slurs, or the grand-staff brace without embedding SVG anyway.
- **Pure music font (A) — rejected in favor of hybrid.** Strictly worse than the hybrid:
  font-failure fragility even on trivial shapes (noteheads, dots), for no gain.
- **All hand-drawn paths (B) — credible zero-asset alternative, documented.** The right
  pick if the team wants zero bundled binary assets, accepting the authoring risk on the
  hard glyphs (clefs, brace, ornate rests, double-sharp). The hybrid (C) is recommended.
- **Strict proportional spacing — rejected.** A whole note 32× a 32nd is absurd;
  compressive `MIN_ADV + K·sqrt(Δ)` (~2.5:1) reads correctly.
- **Stateful "accidental lasts till barline" — rejected.** Fragile under a format with no
  timing/measure model; the stateless `pitch.alter ?? alters ?? 0` rule is data-faithful
  and satisfies the bar.
- **Knuth–Plass optimal line breaking — out of scope.** Greedy packing is sufficient at
  the "recognizable" bar.
- **Adding a `parseSong()` helper — not taken.** Reparse (validate-then-`JSON.parse`) has
  zero footprint on `src/song/*`; the helper is additive but unnecessary.

---

## 10. Open items for the plan phase

These are load-bearing implementation details surfaced during design (decisions are made;
these are the concrete plan tasks):

1. **Bravura asset.** Subset + **RENAME** Bravura (drop the Reserved Font Name), commit the
   `.woff2` and `OFL.txt`, wire `@font-face` (via SCSS `url()` so webpack emits the file to
   `build/`), and **gate the first `draw()` on `document.fonts.ready`** (`@font-face` in
   `style.scss` is harmless to the editor; an optional dedicated frontend-only `viewStyle`
   is a plan decision).
2. **ETAGO escape in `render.php`.** Replace `</` → `<\/` and `<!--` → `<\!--` — **NOT**
   `esc_html` (raw-text `<script>` does not decode entities). Test a literal `</script>` in
   author free text (`chordSymbol` / `metadata.title`) round-tripping through the script tag
   intact without breaking out.
3. **Shared `normalizeStep()`.** A single note-name helper shared by the validator
   vocabulary, pitch→Y, and accidentals — exposed without changing validation behavior (no
   drift).
4. **`wp_set_script_translations`** on the viewScript handle for the a11y label strings
   (minor; English works without it).
5. **Rewrite `specs/render.spec.js`** (old `<pre>` assertions → SVG); leave
   `specs/editor.spec.js` unchanged.

Also: add `"viewScript": "file:./view.js"` to `block.json` (keep `editorScript` / `style` /
`render`); **no `package.json` change** — the plain `viewScript` compiles with the unchanged
`npm run build`.
