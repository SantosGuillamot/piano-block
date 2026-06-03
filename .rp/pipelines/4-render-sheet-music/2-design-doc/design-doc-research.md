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
