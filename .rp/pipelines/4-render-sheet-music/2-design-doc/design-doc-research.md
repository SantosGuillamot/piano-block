# Design Research: Render the Piano block's song as visual sheet music (grand staff)

> Issue #4. This file is the running record of the design Q&A driven by the
> `design-doc-analyst`, with evidence supplied by the `design-doc-researcher`.
> The approved spec (`1-spec/spec.md`) is the source of truth for scope and
> constraints; this file decides *how* to build within that scope. A separate
> writer produces `design-doc.md` from this record.

## Source-of-truth recap (from the approved spec)

- **Frontend only.** The editor is out of scope and unchanged (raw-JSON field +
  non-blocking validation, no in-editor preview).
- **Full notational coverage** of what the song format expresses; bar is
  "recognizable + data-faithful," not engraving-grade.
- **Display states:** empty/whitespace song → render nothing; present-but-non-
  renderable (invalid JSON or non-conformant) → render nothing (no raw echo, no
  error). The current raw `<pre>` passthrough is removed.
- **Responsive** wrapping into stacked grand-staff systems; usable on mobile.
- **JS MAY be required** (no no-JS/SSR guarantee), so client-side rendering is
  allowed.
- **HARD CONSTRAINT:** no third-party music-notation library (VexFlow / abcjs /
  OSMD / Verovio). A standalone open-licensed font asset (e.g. Bravura, SIL OFL)
  is permitted; hand-drawn SVG glyph paths are also acceptable.
- **Accessibility:** a concise accessible label; fixed color is fine; must not
  preclude future interactivity (playhead / highlighting / playback).

## Code-context facts established before the Q&A

- Block is a **dynamic block**: `src/block.json` has `render: file:./render.php`;
  `src/render.php` today echoes the raw `song` string inside a `<pre>` via
  `esc_html()`, and returns nothing when the song is empty/whitespace. There is
  no `viewScript` / Interactivity API wiring yet. Single `song` string attribute.
- The **validator is reusable**: `validateSong(rawString)` in
  `src/song/validate.js` parses + validates against the schema-as-data in
  `src/song/schema.js`, returning `[]` for a conformant song. Empty string is the
  "no song" state and is never validated.
- Build toolchain is `@wordpress/scripts`; lint/format is Biome; e2e via
  Playwright in `specs/` (`editor.spec.js`, `render.spec.js`).
- Format shape (renderer input): `song := { metadata?, defaults?, sections }`;
  `section := { tempo?, timeSignature?, rightHand?, leftHand?, measures }`;
  `measure := { rightHand?[], leftHand?[], barlineStart?, barlineEnd? }`;
  `event := { type, duration, dots?, pitches?, dynamic?, chordSymbol?, tie?,
  slur? }`; `pitch := { step, octave, alter? }`. Per-hand `handConfig :=
  { clef?, alters?, octaveShift? }`. No musical-timing guarantees.

---

## Q&A log

### Q1 — Where does the rendering run: client-side JS or server-side PHP?

**Question.** The foundational decision. (A) Client-side JS: block stays dynamic;
render.php emits a container carrying the song, a frontend script draws the
notation in the browser, reusing the existing JS `validateSong`. (B) Server-side
PHP: render.php parses + validates + draws SVG markup in PHP. Sub-questions:
viewScript/Interactivity wiring in `@wordpress/scripts`; responsive-reflow
trade-off; validate.js reuse vs PHP reimplementation; Interactivity API vs plain
view-script for a one-shot draw with a future-interactivity hook.

**Evidence (researcher).**
- Both client wirings are supported by the existing toolchain, but at different
  cost. A plain **`viewScript`** (`"viewScript": "file:./view.js"` in block.json)
  is auto-detected by `wp-scripts` and **compiles with the unchanged
  `wp-scripts build`** (no flag); WP enqueues it on the frontend only, only when
  the block is present, after the block markup. (Sources: @wordpress/scripts +
  block-metadata handbooks.)
- The **Interactivity API** path needs `"supports": { "interactivity": true }`
  + **`"viewScriptModule"`**, and on the repo's pinned `@wordpress/scripts`
  **32.3.0** (lockfile-exact) compiling a `viewScriptModule` is gated behind
  `--experimental-modules` / `WP_EXPERIMENTAL_MODULES` — it is **not** built by a
  plain `wp-scripts build` (Gutenberg issue #64343; scripts docs describe module
  compilation as available "via `--experimental-modules`"). So IAPI would require
  adding that flag to the `build`/`start` scripts.
- **Responsive reflow is decisive against PHP.** Wrapping into stacked systems
  sized to the *live* container width (spec req 6 / AC5) needs client-side
  measurement; the server cannot know the rendered pixel width (theme, viewport,
  sidebars, zoom). A pure-PHP SVG would bake in a fixed width / measures-per-row
  and could not reflow. The layout pass is inherently client-side. (Spec req 11
  explicitly permits JS-required rendering.)
- **validate.js reuse is a clean win for JS.** `validate.js` + `schema.js` are
  plain zero-dependency ES modules; a client `view.js` can
  `import validateSong from "./song/validate"` and reuse it as-is. PHP path B
  would reimplement the whole walker + note-name vocabulary (English/Spanish,
  case-insensitive) + alters + bpm>0 in PHP — forbidden drift against
  `src/song/*` (spec says don't change it) and the format is designed to grow
  additively, so a PHP fork would silently diverge.
- Data delivery to the client script: render.php already has
  `$attributes['song']` and `get_block_wrapper_attributes()`; cleanest no-IAPI
  option is a data attribute or a JSON `<script>` on the container that view.js
  reads, JSON-parses, validates, and draws.

**Decision.** **(A) Client-side JS via a plain `viewScript`** — not the
Interactivity API for this issue. Rationale:
1. PHP (B) is eliminated: it forces reimplementing `src/song/*` logic in PHP
   (forbidden drift) and still can't do responsive reflow without JS.
2. Plain `viewScript` compiles with the **unchanged `npm run build`** on the
   pinned 32.3.0, honoring spec req 12 ("builds with the current toolchain") with
   zero friction; `viewScriptModule`/IAPI would force an `--experimental-modules`
   build-config change for no benefit this issue needs.
3. The spec only requires we **not preclude** future interactivity (req 16). We
   satisfy that architecturally — song carried in a container data attribute, a
   single clean `draw()`/render entry point, layout recomputed on resize — so a
   later issue can adopt the IAPI store (playhead/highlight binding to a reactive
   `state`) without a rewrite.
4. The existing JS `validateSong` is reused as-is to gate "render notation or
   nothing" (no src/song changes).

**Consequences carried forward.**
- block.json will gain a `viewScript`; the block stays dynamic (render.php emits
  the container) — exact wiring + what replaces `<pre>` resolved in the
  block-wiring question.
- view.js must JSON.parse for drawing AND call validateSong for the gate; reparse
  twice vs add a thin `parseSong()` deferred to a dedicated question.
- `specs/render.spec.js` asserts the OLD `<pre>` behavior and will need
  rewriting — captured for the testability section.

### Q2 — Rendering substrate: inline SVG vs `<canvas>` vs HTML/CSS?

**Question.** The drawing surface the view.js engine targets. (A) inline SVG;
(B) `<canvas>` 2D; (C) HTML/CSS positioned boxes. Axes: accessibility label,
forward-compat with interactivity, crispness/HiDPI, responsive-reflow
regeneration cost, glyph hosting (font + path in one drawing), and whether
HTML/CSS can do curves/slants.

**Evidence (researcher).**
- **A11y label (AC12).** SVG is cleanest: `role="img"` on the root `<svg>` + an
  accessible name via a first-child `<title>` and/or `aria-label` satisfies WCAG
  1.1.1 / 4.1.2. (MDN ARIA img role; W3C-WAI ACT rule 7d6734.) Gotcha: `<title>`
  must be the svg's first child; if `aria-label` is also set it wins — use ONE
  name source. Canvas is an opaque bitmap: only `role="img"` + `aria-label` on
  `<canvas>` + fallback content; drawn content is invisible to AT. SVG also keeps
  richer per-element a11y open for free.
- **Forward-compat interactivity (req 16) — decisive for SVG.** In SVG every
  notehead/stem/playhead is its own DOM element: a future playhead is one
  translated `<line>`/`<rect>`; a per-note highlight is a class/attr toggle on
  that element — and later, an IAPI store binds `data-wp-class--active` /
  `data-wp-style--*` to those already-addressable elements with no redraw. Canvas
  has nothing addressable: highlight/playhead requires a full clear+redraw every
  frame plus custom hit-testing — exactly the "expensive to make interactive"
  trap req 16 warns against.
- **Crispness/HiDPI.** SVG is retained vector — re-rasterized from vector math on
  every resize and DPI, sharp automatically. Canvas is immediate-mode pixels:
  stays crisp only with manual `cssSize × devicePixelRatio` backing store +
  `ctx.scale(dpr,dpr)` + re-raster on resize and DPR change (web.dev HiDPI
  canvas; MDN devicePixelRatio). CSS hairlines fight sub-pixel rounding.
- **Responsive regeneration.** On resize SVG just recomputes system breaks and
  rebuilds the subtree / sets a new viewBox — one DOM swap. A few hundred SVG
  elements is comfortable for static notation (SVG perf concerns start in the
  thousands of *animated* nodes). Mitigations if needed: debounce resize, only
  recompute when width crosses a break threshold. No perf concern at our scale.
- **Glyph hosting — confirmed.** A single `<svg>` freely mixes font glyphs via
  `<text>` and hand-drawn `<path>`/`<line>`/`<rect>`/`<polygon>` in one
  coordinate space. So SVG does NOT pre-commit font-vs-path — Q3 stays fully open.
- **HTML/CSS disqualified.** It cannot cleanly draw the curved/slanted parts:
  slanted beams (fragile rotated quads), curved ties/slurs (no real arbitrary-
  curve primitive — you'd embed SVG paths anyway), and the ornate grand-staff
  brace (a curve). You'd be doing SVG with extra steps.

**Decision.** **(A) inline SVG.** It is the only substrate that simultaneously
gives a clean labeled graphic (AC12), keeps every note DOM-addressable so the
Q1 `draw()` can later be driven by an IAPI store for playhead/highlight with no
redraw (req 16), is crisp at any width/HiDPI for free, is trivial to regenerate
on resize at our scale, hosts both font glyphs and hand-paths (Q3 open), and is
the only one that can draw beams/ties/brace. Canvas loses on a11y +
interactivity + manual HiDPI; HTML/CSS is disqualified on curves.

**Consequences carried forward.**
- Root `<svg role="img">` with a single accessible name (resolved in the a11y
  question). Elements get stable ids / `data-*` (e.g. note index) during draw so
  a later store can target them.
- Researcher's forward note for the engine questions: adopt a **staff-space
  coordinate system** (1 user unit = 1 staff space; 4 spaces = staff height) with
  a viewBox, so pitch→Y placement and ledger-line math are integer-ish and
  clef-agnostic. Picked up in the pitch-placement question.

### Q3 — Glyph strategy: open-licensed music font vs hand-drawn SVG paths?

**Question.** For the ornate discrete glyphs (clefs, noteheads, accidentals,
rests, flags, dot, brace, time-sig digits) — (A) a music font asset (Bravura,
SMuFL, SIL OFL) via SVG `<text>`; (B) hand-drawn SVG `<path>` glyphs; or (C)
hybrid (font for ornate glyphs, hand-paths for geometry + trivial glyphs).
Sub-questions: OFL/GPL licensing + bundling, Bravura size, subsetting,
hand-draw effort/fidelity, the "asset ≠ library" line, font-load-failure risk.

**Evidence (researcher).**
- **Licensing.** Bravura is **SIL OFL 1.1** and is the **SMuFL reference font**
  (SMuFL = the standard codepoint mapping into the Unicode PUA). OFL 1.1
  explicitly permits bundling/embedding/redistribution inside GPL software; the
  plugin is GPL-2.0-or-later → compatible. (Sources: steinbergmedia/bravura;
  smufl.org; OFL-FAQ §1.3-1.5.) Two caveats: "can't sell the font alone" does
  NOT bite (we bundle, never sell alone); **"Bravura" is a Reserved Font Name**,
  so a **subset is a Modified Version and MUST be renamed** (e.g. "PB Music") and
  ship the OFL.txt alongside (OFL-FAQ §2.6, §5.9). A one-off build/author step.
- **Size.** Full `Bravura.woff2` ≈ **247 KB** (GitHub API, woff2 redist; .woff is
  far bigger — woff2-only is correct for the WP 6.9+ baseline). Lighter SMuFL OFL
  alternatives: Leland (conventional, MuseScore default), Petaluma (handwritten —
  wrong aesthetic). Bravura is the maximally conventional, best-documented choice.
- **Subsetting.** We use only ~30-40 codepoints; subsetting (OFL-permitted
  modification) typically cuts a SMuFL font to **~10-40 KB woff2**. Recommend
  committing a **pre-subsetted, renamed `.woff2`** to the repo (deterministic; no
  fonttools in the JS build). Build fit: place the asset so wp-scripts copies it
  to build/, add `@font-face` (in style.scss → style-index.css, or enqueue
  frontend-only via render.php). FOUT mitigated by `font-display` + gating the
  first `draw()` on `document.fonts.ready` / `document.fonts.load(...)`.
- **Hand-draw surface (drives the decision).** Full coverage ≈ 30 distinct
  glyphs, of which **~8-10 are genuinely HARD** to get to "recognizable": 4
  clefs (treble worst), the grand-staff **brace**, the **quarter rest** and
  ornate eighth/sixteenth/thirty-second rests, and **double-sharp**. The rest are
  trivial (noteheads = ellipses, dot = circle, whole/half rests = rectangles,
  simple accidentals). The hard set is exactly where hand-drawing risks looking
  amateurish and missing AC1's "clearly a standard piano score" bar. Ottava +
  dynamics are TEXT (plain bold/italic font), not music glyphs, in every strategy.
- **Asset ≠ library — confirmed.** A `.woff2` ships zero executable code; the
  spec explicitly permits "a standalone open-licensed music-font asset" (req 10 /
  AC10). The no-library rule targets notation ENGINES (VexFlow/abcjs/OSMD/
  Verovio). No trap as long as we take the font file alone (not a library that
  bundles a font).
- **Font-load-failure risk + mitigation.** If the font 404s/blocks, `<text>`
  glyphs show tofu. Mitigated by `font-display` + `document.fonts.ready` gating
  (slow loads), and — crucially — by the HYBRID hand-drawing the skeleton
  (staves, stems, beams, ties, ledger lines, barlines, noteheads, dot) so the
  structure ALWAYS renders even if the font fails; only ornate glyphs depend on
  the font. Bundling locally (not a CDN) makes hard failure very unlikely.
- **Geometry is hand-drawn SVG in EVERY strategy** (staff lines, stems, beams,
  slurs, ties, ledger lines, barlines are not glyphs). The font only ever covers
  discrete glyphs.

**Decision.** **(C) HYBRID.** Subsetted-and-renamed Bravura (woff2, ~10-40 KB,
shipped with OFL.txt) for the ornate discrete glyphs (clefs, rests, accidentals,
flags, brace, time-sig digits); hand-drawn SVG primitives for ALL geometry AND
for the trivial glyphs (noteheads as `<ellipse>`, augmentation dot as `<circle>`)
which also serve as the font-failure skeleton; ottava/dynamics as plain
bold/italic text. Rationale: it buys instant high fidelity on exactly the ~8-10
glyphs that are hardest to hand-draw and most damaging to AC1 if ugly, at a tiny
shipped size, with clean OFL/GPL licensing and graceful degradation. Pure font
(A) is strictly worse than C (font-failure fragility on trivial shapes for no
gain). 
**Documented alternative:** (B) all-hand-paths is explicitly permitted by the
spec and is the right pick IF the team holds a hard "zero bundled binary asset /
fully self-contained" value (the project's "dependency-free" ethos is a mild pull
that way) — accepting the clef/brace/rest authoring risk. The design doc should
present B as the credible zero-asset alternative; C is the recommendation.

**Consequences carried forward.**
- Plan-phase tasks: subset + rename Bravura (drop RFN), commit the `.woff2` +
  `OFL.txt`, wire `@font-face`, gate first draw on `document.fonts.ready`.
- A SMuFL codepoint table (the specific glyphs used) is an engine-internals
  detail for the symbol-catalogue question.
- Engine must expose glyphs behind a small indirection (a glyph map) so the B
  alternative — or a future font swap — doesn't ripple through the renderer.

### Q4 — Staff-space coordinate model + pitch→staff-position mapping + ledger lines

**Question.** Nail down the SVG coordinate convention (staff-space unit) and the
pitch→Y mapping per clef with ledger lines (spec req 4 / AC3), plus how
octaveShift and alto/tenor clefs affect placement.

**Evidence (researcher; pitch→Y formula verified in code across all 4 clefs).**
- **Coordinate system.** Standard engraving unit is the **staff space (sp)** =
  distance between adjacent staff lines; the 5-line staff spans **4 sp** (SMuFL
  defines all metrics in staff spaces; em = 4 sp). Model: one constant `SP` in
  SVG user units (e.g. SP = 10; viewBox decouples user units from px). Y
  increases **downward** (SVG default) → higher pitch = smaller Y. Use a
  **staff-step** integer (1 staff-step = one line-or-space = **0.5 sp** in Y) so
  every notehead lands on an exact half-sp grid. **Lines at even** staff-steps,
  **spaces at odd**.
- **Pitch → diatonic index.** Placement depends ONLY on diatonic step + octave,
  **never on `alter`** (an accidental shifts the glyph left of the notehead, not
  the staff line). `stepIndex`: C0 D1 E2 F3 G4 A5 B6; normalize Spanish
  do/re/mi/fa/sol/la/si → C/D/E/F/G/A/B, case-insensitive (**reuse the
  validator's normalization**, `src/song/validate.js`). `diatonicIndex =
  octave*7 + stepIndex`. Middle C = **C4 = 28** (confirmed by
  `docs/song-format.md`).
- **Clef references** (verified vs notation sources): treble G4 on line 2; bass
  F3 on line 4; alto C4 on the middle line 3; tenor C4 on line 4. Modeled as
  `sFromBottom` (bottom line = 0, top line = 8; lines 0/2/4/6/8, spaces
  1/3/5/7): `treble {G4, 2}`, `bass {F3, 6}`, `alto {C4, 4}`, `tenor {C4, 6}`.
- **General Y formula (clef-agnostic):**
  `staffStepFromBottom(pitch) = ref.sFromBottom + (diatonicIndex(pitch) −
  diatonicIndex(ref.pitch))`; `Y(pitch) = bottomLineY − staffStepFromBottom ×
  (SP/2)`. Verified: treble E4→0, G4→2, F5→8, C4→−2 (1 ledger below), C6→12 (2
  ledgers above); bass C4→+10 (1 ledger above — classic middle C above bass).
  Cross-check: treble C4 (−2, ledger below) and bass C4 (+10, ledger above) are
  the SAME middle C on one unified `diatonicIndex` scale — confirms the grand
  staff is internally consistent.
- **Ledger lines.** Draw a short segment at every **line position (even
  sFromBottom)** between the staff and a note outside it, inclusive of the note's
  own line when it sits on a ledger line. Above: even sFromBottom from 10 up
  through the largest even ≤ note's sFromBottom. Below: mirror from −2 down. None
  needed for 0 ≤ sFromBottom ≤ 8. Each ledger is centered on the notehead, ~2 sp
  wide (~1.5–2 notehead-widths). Same routine for both staves.
- **octaveShift = bracket, NOT a vertical move** (confirmed; Humanities
  LibreTexts, Wikipedia, MuseScore handbook): the WRITTEN pitch on the staff is
  unchanged; only the sounding pitch transposes (matches the format's own
  forward-looking note). So for static notation: place notes by their written
  octave; draw an **ottava marking** (dashed bracket + label) spanning the
  affected hand's section notes — `+1` "8va" / `−1` "8vb" / `+2` "15ma" / `−2`
  "15mb"; above for +, below for −. octaveShift is section-scoped per hand; a
  bracket per affected hand over the section's measures (re-stated per wrapped
  system) is acceptable. KEY correctness point: do NOT shift Y.
- **Alto/tenor — no special case.** The Y formula handles them with zero
  special-casing — just two more `clefRef` entries + the C-clef glyph. Everything
  downstream (ledgers, stems, beams) operates on `sFromBottom`, so it's
  clef-independent. Verified alto (C4 on middle line) / tenor (C4 on line 4).

**Decision.** Adopt this model verbatim:
- `SP` constant; staff-step grid (lines even, spaces odd); Y downward.
- `stepIndex` + Spanish normalization (shared with the validator's table);
  `diatonicIndex = octave*7 + stepIndex`; middle C = C4 = 28.
- `clefRef = { treble:{G4, sFromBottom 2}, bass:{F3, 6}, alto:{C4, 4},
  tenor:{C4, 6} }`.
- `Y(pitch) = bottomLineY − (ref.sFromBottom + diatonicIndex(pitch) −
  diatonicIndex(ref)) × (SP/2)`. `alter` never affects Y.
- Ledger lines at even sFromBottom between the staff and the note, centered, ~2
  sp wide.
- octaveShift → ottava bracket/label only, never a vertical shift.

**Consequences carried forward.**
- Stem-direction note (for the stems/beams question): conventionally flips at the
  middle line (sFromBottom 4) — below middle = stem up, at/above = stem down.
- Accidental glyph sits to the LEFT of the notehead at the same Y (alter never
  moves Y) — feeds the accidentals question.
- The note-name normalization is shared with the validator's vocabulary; the
  engine should not re-encode it independently (avoid drift).

### Q5 — Durations → noteheads/stems/flags/beams; chord stacking; dots

**Question.** Map duration/dots/pitches[] to noteheads, stems, flags, beams (incl.
the inferred beaming rule given NO beam markers + NO timing guarantee), chord
notehead stacking (seconds rule), and dot placement. Concrete sp constants.

**Evidence (researcher; standards-grounded, "recognizable" bar).**
- **Notehead/stem/flag.** whole = open notehead, **no stem**; half = open + stem;
  quarter & shorter = filled + stem. Flags only on **un-beamed** flagged notes
  (eighth=1, sixteenth=2, thirty-second=3); a note is **either flagged or
  beamed, never both**. Flag at the stem end, on the **right of the stem** for
  both directions, additional flags stacked ~1 sp toward the notehead (use the
  font glyph). stemLength ≈ 3.5 sp (extend so the stem end crosses the middle
  line for far ledger notes); stem thickness ≈ 0.13 sp; notehead ≈ 1.18×1 sp
  (ellipse rx≈0.6, ry≈0.5).
- **Stem direction + side.** Single note: sFromBottom < 4 → stem **up**;
  sFromBottom ≥ 4 → stem **down** (note on middle line stems down). Stem-up
  attaches at the **right** of the notehead; stem-down at the **left** (Wikipedia
  "Stem"). Chord: direction by the note **farthest from the middle line** (max
  |sFromBottom − 4|; tie → down); stem spans the chord's full vertical extent.
  Two hands: each staff is a **single voice** deciding direction independently by
  its own middle line — the format gives one flat event array per hand per
  measure, so **no cross-staff, no multi-voice forced directions**.
- **Beaming — inferred (no markers, no timing guarantee), per hand per measure.**
  (a) Walk events tracking running `pos` in quarter-beats using `baseDur` (quarter
  1, half 2, whole 4, eighth 0.5, sixteenth 0.25, thirty-second 0.125) × dot
  factor (1 dot ×1.5, 2 dots ×1.75) — **the same arithmetic horizontal spacing
  needs, reused**. (b) Beamable = a *note* (not rest) of eighth/sixteenth/
  thirty-second. (c) Accumulate consecutive beamables; **break** at a rest, a
  non-beamable note, measure end, or a beat-boundary crossing. (d) Beat unit from
  `timeSignature`: **compound** (beatType ∈ {8,16} AND beats % 3 == 0, e.g.
  6/8, 9/8, 12/8) → dotted beat = group in **3s**; **simple** (everything else) →
  one beatType unit per beat (4/4 eighths beam in 2s). Break when
  `floor(pos/beatLen)` changes; a note straddling a boundary starts a new group
  (don't split a note). (e) **Robustness:** `pos` is only a grouping aid — if
  events overflow the bar, keep accumulating/grouping, never clamp/crash; a group
  of length 1 renders as a **flagged** note, not a one-note beam. (Sources: Open
  University 3.9 / Open Music Theory compound beaming; GuitarLand/Musicnotes
  simple-meter beaming.)
- **Beam geometry.** One stem direction per group (extreme rule). **Flat
  horizontal beams are acceptable** at our bar (beam Y at the most-extreme
  stem-end so no stem is too short; all stems run to that common Y) — sidesteps
  beam-slope rules (explicitly out of scope). Primary beam = thick line across
  stem ends; secondary beams for 16th/32nd parallel ~0.25–0.3 sp toward the
  noteheads. Mixed group: between adjacent notes draw secondary beams =
  min(beamCount(left), beamCount(right)); an isolated shorter note gets a short
  **stub** pointing toward the beat. beamCount: eighth 1, sixteenth 2,
  thirty-second 3. beam thickness ≈ 0.5 sp; ≈ 0.75 sp per stacked level.
- **Chord stacking + seconds rule.** All pitches share one stem; each notehead at
  its Q4 Y. **Seconds rule** (Wikipedia "Stem"; Ultimate Music Theory): when two
  chord notes are a diatonic second apart (Δ sFromBottom = 1), the **lower goes
  left of the stem, the higher right**, regardless of stem direction (the
  displaced one is the back-note, offset ~1 notehead width). Clusters (C-D-E):
  outer two normal, middle flipped. No seconds → all on the normal side. Chord
  dots: one per notehead, aligned. Chord accidentals: a column to the LEFT of the
  noteheads (detail deferred to the accidentals question).
- **Dots.** Augmentation dot to the **right** of the notehead, centered on a
  **space**: note in a space (odd sFromBottom) → dot at the notehead Y; note on a
  line (even sFromBottom) → dot nudged up into the adjacent space (Y of
  sFromBottom+1). Second dot further right. dot offset ≈ 0.5 sp right of
  notehead, radius ≈ 0.15 sp, inter-dot ≈ 0.5 sp.

**Decision.** Adopt this spec as the engine's duration/stem/flag/beam/chord/dot
model verbatim, including: the inferred best-effort beaming rule (simple vs
compound beat unit; break at rests/non-beamables/beat boundaries; overflow-safe;
length-1 → flag); **flat beams**; the extreme-note stem-direction rule per
single-voice staff; the lower-left/higher-right seconds rule; and the constants
table. Share the `baseDur`+dots duration arithmetic between beaming and
horizontal spacing (single source).

**Consequences carried forward.**
- The duration→quarter-beats arithmetic is the spine of the per-measure
  horizontal time grid and two-hand alignment — the next question.
- Chord accidental column + per-note vs section `alters` precedence → accidentals
  question.

### Q6 — Per-measure two-hand time grid + duration-proportional horizontal spacing

**Question.** A concrete, deterministic per-measure layout: a shared time grid
that vertically aligns both hands (req 5 / AC5), robust when bars don't sum to the
time signature and hands are unequal (AC8) and when a hand is empty (AC9); plus a
horizontal spacing rule. The most adversarially-tested requirement.

**Evidence (researcher; algorithm implemented and run on every AC8/AC9 case —
no NaN/Inf, both staves always drawn, alignment holds).**
- **Union-grid alignment (confirmed).** Per hand, each event's onset = running
  sum from 0 of `dur(e) = baseDur[duration] × dotMul[dots]` (dotMul 0→1, 1→1.5,
  2→1.75) — the Q5 arithmetic, computed per hand independently. **GRID = sorted
  unique union of both hands' onsets**; each unique onset t → one X; an event at t
  in either hand draws at X(t) → automatic vertical alignment. Verified:
  equal onsets align; different subdivisions (RH eighths / LH quarters) → the
  off-beat RH note gets its own X between LH columns; unequal totals → grid
  extends to `max(handEnds)` and the short hand just has no events past its end;
  empty/one-hand → grid = present hand's onsets, **both staves still drawn from
  measure geometry** (staff lines don't depend on events).
- **Spacing — compressive (recommended over strict proportional).** Real
  engraving spacing is **logarithmic (~1.5:1 per duration-doubling), not 2:1**
  (RPM Seattle; LilyPond horizontal-spacing/proportional-notation; MuseScore).
  Strict proportional would make a whole note 32× a 32nd — absurd. Formula:
  **`advance(Δ) = MIN_ADV + K·sqrt(Δ)`**, `MIN_ADV ≈ 2.2 sp` (raise per-column to
  clear accidentals/dots/flags), `K ≈ 3.0 sp`. Δ = gap to the next onset; the
  last onset uses Δ = `measureEnd − lastOnset`. Verified whole vs 32nd ≈ 2.5:1
  (not 32:1) — whole gets more room without dominating. Empty measure → floor
  width ≈ 3.3 sp.
- **Measure width is intrinsic/content-driven (confirmed):** `measureWidth =
  Σ advances + leadingPad + trailingPad`. Leading pad only on measures that print
  clef/keysig/timesig (system start, or section-change re-statement); trailing pad
  = barline width (+repeat dots / final thick bar). Systems then pack measures by
  these widths (wrapping question).
- **Rests are full grid citizens (confirmed):** a rest advances the running onset
  by its duration, gets an onset in the union grid, occupies horizontal space.
- **Same onset, different durations (confirmed, no fill needed):** RH half@0 +
  LH q@0/q@1/... → grid {0,1,2,...}; RH has no glyph at the intervening columns;
  the half-notehead at X(0) visually spans toward its next onset. Empty columns in
  a staff are correct and read as a sustained note.
- **Robustness / AC8 (verified NaN-safe):** overflow bars just grow the grid (no
  clamping to the time signature); both-hands-empty → floor width, both staves
  drawn; huge dotted note → big-but-bounded advance. Guards: `sqrt(max(Δ,0))`,
  empty-grid short-circuit to floor width, `measureEnd = max(handEnds, 0)`. Inputs
  are finite durations from a closed (already-validated) vocabulary.

**Decision.** Adopt the **union-grid + compressive-spacing** algorithm verbatim:
1. per hand, onsets = running sum of `dur(e)`; `handEnd` = final sum.
2. `grid` = sorted unique union of both hands' onsets; `measureEnd =
   max(handEnds, 0)`.
3. lay out X across grid with `advance(Δ) = MIN_ADV + K·sqrt(Δ)` (Δ to next onset
   / to measureEnd for the last).
4. `measureWidth` = (empty ? floor) + Σ advances + leading/trailing pads; draw
   both staff backgrounds full width regardless of events.
5. place each hand's glyphs at `X[onset]`, Y from Q4.

**CRITICAL ROBUSTNESS RULE (record prominently).** The renderer **must NEVER use
`timeSignature` to compute positions or widths** — `timeSignature` is used ONLY
to (a) draw the time-sig glyph and (b) derive the beat unit for beam grouping
(Q5). Onsets and widths come purely from the events' own durations. This makes
AC8 ("events don't sum to the time signature") fall out structurally — the layout
doesn't know or care what the bar "should" total, and both staves are always
drawn from geometry, not from events (AC9).

**Consequences carried forward.**
- Intrinsic measure widths feed the system-wrapping / responsive question (pack
  widths into width-fitted stacked systems; recompute on resize via the Q1
  ResizeObserver; restate clef/keysig per system).
- Per-column `MIN_ADV` should widen when accidentals/dots/flags are present at
  that column — ties into the accidentals question.

### Q7 — System wrapping into stacked grand-staff systems + responsive reflow

**Question.** Pack intrinsic measure widths (Q6) into width-fitted stacked
systems; justify; handle a single measure wider than the container; choose the
sizing model; per-system restatement; resize behavior; vertical spacing
(spec req 6 / AC5, client-side per Q1).

**Evidence (researcher; code-checked desktop/mobile/over-wide cases).**
- **Greedy packing is sufficient** (Knuth–Plass optimal breaking is out-of-scope
  engraving polish). `budgetSp = containerPx/spPx`; `availSp = budgetSp −
  leadingReserve`; fill a system until the next measure would exceed availSp, then
  break; **always ≥1 measure per system** (prevents infinite loop on a wide
  measure). Leading reserve (per system) = brace + both clefs + alters
  (+ timesig only system 1 / on change); ~10–14 sp, computed exactly from the
  glyphs actually printed (varies with #alters).
- **Justify, with a clamp.** Stretch each system to fill width by scaling the
  internal grid **advances only** (NOT leading reserve, glyph sizes, stems,
  noteheads) — stretch whitespace, not symbols. `scale = clamp(availSp/contentSp,
  ·, MAXSTRETCH≈1.6)`; when scale would exceed the cap, leave that system
  ragged-right. **Do NOT justify the last system** of the whole score
  (conventional ragged last line) nor an over-wide (scale<1) system.
- **Single measure wider than W → downscale that system.** The over-wide measure
  goes alone on its system, and that SYSTEM is uniformly **downscaled to fit**
  (`downscaleFactor = min(1, availSp/measureContentSp)`, applied as a transform on
  that system's `<g>`, glyphs included) — no overflow, no horizontal scroll
  (more usable on mobile than clipping/scrolling, and avoids a UX the spec
  doesn't ask for). Only the offending system shrinks; the rest stay readable.
  Rare in practice but the guaranteed no-overflow fallback. (Verified: 60 sp
  measure on a 33 sp-avail phone → factor 0.55, fits.)
- **Sizing model = (i) fixed sp px, wrap-on-resize.** `sp = 8 px` (staff height
  32 px) fixed; SVG width = container width; SVG height grows with #systems;
  resize = recompute packing only. Keeps glyphs/staff/text a constant readable
  size and only changes wrapping — how a real score reflows; keeps dynamics/chord/
  tempo text legible (it doesn't shrink with the page). Model (ii) whole-SVG
  downscale is used ONLY as the per-system over-wide fallback. Optional refinement:
  step sp to 7 px below a ~480 px container (discrete breakpoint, not continuous).
  Fixed sp is what makes resize a pure re-wrap (cheap, stable).
- **Per-system restatement (confirmed).** Every system restates the **brace, both
  clefs, and the alters**. The **time signature only on system 1 and where it
  changes** (a section change), not on every system. Section changes mid-system
  are drawn **inline** at that measure's start (small clef/keysig/timesig glyphs
  at the boundary, per Q4 / spec req 3 / AC4); the next system restates the
  now-current clef+alters in its leading reserve.
- **Resize = re-pack only; rAF-guarded one-way observer.** ResizeObserver on the
  CONTAINER → debounce/rAF → recompute packing + justify → rebuild SVG (cheap per
  Q2). Per-measure intrinsic widths and pitch Ys are sp-relative and **invariant**
  on resize — only system breaking + X justification change. Loop guard: width
  flows **container → SVG one-way**; inside the callback only set the SVG's height
  + inner content, **never write back the container width**, and wrap in rAF. This
  structurally avoids the "ResizeObserver loop" (the "undelivered notifications"
  warning is benign; rAF removes it). (Sources: TrackJS, ckeditor5 #7371.)
- **Vertical spacing (sp constants, starting points):** intra-system staff gap
  (between the RH and LH 5-line staves) ≈ 8 sp (room for middle-C ledgers between
  them); inter-system gap ≈ 8–12 sp. One grand-staff band ≈ topMargin ~4–6 (chord
  symbols/ottava/tempo) + RH 4 + intra 8 + LH 4 + bottomMargin ~4–6 ≈ 24 sp.
  **Compute top/bottom margins from CONTENT** (max ledger extent + presence of
  ottava/dynamics/chord-symbols in that system) so tall stacks don't collide with
  the neighboring system — a measured per-system margin, not a fixed guess.

**Decision.** Adopt the responsive model verbatim:
- Fixed `spPx = 8` (optional breakpoint step to 7 below ~480 px); SVG width =
  container, height grows with #systems.
- Greedy packing, ≥1 measure/system; per-system leading reserve computed from the
  glyphs printed.
- Justify by scaling internal advances only, `clamp(…, MAXSTRETCH≈1.6)`; skip the
  last system and over-wide systems.
- Over-wide measure → alone + uniform system downscale to fit (no scroll).
- Restate brace + clefs + alters every system; timesig only system 1 + on change;
  section changes inline mid-system.
- Resize: ResizeObserver(container) → rAF + debounce → re-pack + re-justify +
  rebuild; only set SVG height/content, never container width.
- Vertical: intra-staff ~8 sp, inter-system ~8–12 sp, content-measured top/bottom
  margins.

**Consequences carried forward.**
- Barlines at system ends (last measure's `barlineEnd`); a repeat-start at a new
  system's first measure should still show → barlines/repeats question.
- Measure numbers (req 2): system-start numbering (above the first measure of each
  line) is the common low-clutter choice → confirm in the barlines/numbers
  question.
- Section-change inline rendering (clef/keysig/timesig/tempo/ottava at the section
  boundary) → section-change question (spec req 3 / AC4).
