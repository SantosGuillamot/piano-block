# Spec — Move the Piano block's frontend JS to the Interactivity API

## Overview

The Piano block (`piano-block/piano`) is a dynamic WordPress block that renders a piece
of piano sheet music as an inline SVG on the public-facing page. Today its frontend
behavior runs as a standalone classic view script (`src/view.js`, registered through
`block.json`'s `viewScript`): on `domReady` it queries every block wrapper on the page,
reads the song from an inert `<script type="application/json">` carrier inside the
wrapper, validates it, builds a layout model at the live container width, mounts an SVG,
and reflows the SVG when the container is resized.

This work migrates that frontend behavior to WordPress's Interactivity API. The block's
observable output and behavior must stay the same; what changes is the *mechanism* — the
block becomes an interactive block (`supports.interactivity`, a `viewScriptModule`, a
`data-wp-interactive` wrapper, and a reactive store) instead of a hand-bootstrapped
classic script. The goals are to align the block with WordPress's standard frontend
architecture and to lay a foundation for future interactive features (audio playback and
note input) by giving a reactive store ownership of the song and the render lifecycle.

This is a frontend-only migration. The block editor, the notation rendering core, and the
song format/validator are unchanged. The user-visible result on the published page —
the rendered notation, its accessibility, its responsiveness, and its render-or-nothing
safety behavior — must be indistinguishable from today's.

### Key context for testability

The block's observable contract is already pinned in detail by the existing Playwright
e2e suite (`specs/render.spec.js`). That suite is the parity baseline: it asserts the
exact emitted SVG tree (data-attributes, structure, relative note positions), the
accessible name, the render-or-nothing states, the resize reflow, and the escape-safety
of the server transport. With one deliberate exception (the song-transport sub-check,
see Requirement 4 and AC8), every existing assertion must continue to pass after the
migration. The acceptance criteria below map one-to-one onto that suite, plus one new
acceptance criterion for multi-block isolation.

### The imperative-SVG carve-out (read this before the requirements)

The Interactivity API's idiom is to express reactive behavior declaratively through
`data-wp-*` directives and to avoid direct DOM writes from the view module. The Piano
block's notation **cannot** follow that idiom for the SVG body: the entire SVG is built
imperatively in the notation core (`createElementNS` plus a `container.replaceChildren`
mount), the tree is large, dynamic, and positional, and the existing e2e tests depend on
that exact tree. Expressing the notation as directives is not feasible and would break
the test-pinned output.

Therefore this spec explicitly authorizes the imperative SVG mount as an **accepted
exception** to the directives-only ideal, analogous to the API's allowance for
`.focus()` as a permitted direct DOM write. The Interactivity-API win for this block is
ownership of **boot, lifecycle, and state** (per-instance hydration, the song as reactive
context, the render/reflow lifecycle) — **not** declarative rendering of the notation.
The store drives *when and with what data* the SVG is (re)built; the imperative emit that
actually constructs the SVG is unchanged. Any design or review that tries to convert the
notation into directives is out of bounds and contradicts this spec.

## Requirements

### R1 — The block becomes an Interactivity API block

The Piano block must run its frontend behavior on the WordPress Interactivity API rather
than a standalone classic view script. Concretely, the block must be registered and
marked up as an interactive block so that WordPress hydrates each instance through the
Interactivity API and the block's frontend logic lives in a reactive store rather than a
manually bootstrapped `domReady` script. (The specific store/directive shape is a design
concern; what is required here is that the Interactivity API — not a `viewScript` /
`domReady` boot — owns the frontend lifecycle.)

### R2 — Observable output parity (the rendered notation is unchanged)

For a conformant song, the migrated block must produce exactly the same observable DOM as
today:

- The block wrapper ends up holding **exactly one child — the `<svg>`**. No other markup
  (no inert carrier, no raw JSON echo, no `<pre>`, no placeholder) remains.
- The `<svg>` carries: `role="img"`; `viewBox="0 0 {widthSp} {heightSp}"`;
  `width`/`height` in pixels; `preserveAspectRatio="xMinYMin meet"`;
  `style="display:block;max-width:100%;height:auto"`; and `xmlns`. There is **no
  `aria-label`** and no additional width/height beyond those.
- The SVG tree is the same notation tree the existing e2e suite asserts in detail:
  per-system groups (`g[data-system]`), staff lines (`[data-staff-lines]`), reserved clef
  regions (`[data-reserve] [data-clef]`), noteheads (`[data-notehead]`), annotation text
  (`[data-text="annotation"]`), and the `data-hand`, `data-staff`, `data-placement`
  attributes — with the same relative note positioning (notes placed above sit higher than
  notes below; later beats sit to the right of earlier beats; out-of-range beats are
  clamped within their system).
- The wrapper's own attributes continue to come from `get_block_wrapper_attributes()`
  (class `wp-block-piano-block-piano`, plus any alignment/style WordPress adds). The
  frontend logic must not alter the wrapper's own attributes — only its children.

No server-side pre-render of the SVG is required for parity: today the server emits
nothing visible and the notation is drawn entirely on the client, so the migrated block
may likewise draw the notation only on the client. (With JavaScript disabled, the block
renders nothing today and may render nothing after the migration — this is acceptable
parity.)

### R3 — Accessible name parity

The block's accessibility model is unchanged: the rendered graphic is a labeled image
(`role="img"` plus a `<title>` as the SVG's **first child**, whose text content is the
accessible name). The accessible-name string is computed from the song's `metadata`
(`{ title, composer }`, each trimmed; an empty value after trimming counts as absent) with
exactly these four branches, preserved verbatim including their internationalization:

- **title + composer** → `sprintf( _x( '%1$s by %2$s', 'sheet music label', 'piano-block' ), title, composer )`.
- **title only** → the author's `title` **verbatim**, with **no i18n wrapper**.
- **composer only** → `sprintf( _x( 'Piano sheet music by %s', 'sheet music label', 'piano-block' ), composer )`.
- **neither** → `__( 'Piano sheet music', 'piano-block' )`.

The i18n wrappers (`__`, `_x`, `sprintf` from `@wordpress/i18n`) must be preserved, and
the rendered strings must be correct (English verbatim) on the frontend. (See R9 for the
translation-file caveat.)

### R4 — Song transport via per-instance Interactivity context

The song must be carried to the client by seeding it into **per-instance Interactivity
context** on the wrapper (the per-instance context mechanism, e.g.
`wp_interactivity_data_wp_context( [ 'song' => $song ] )`), and the store must read the
song from that instance's context (e.g. `getContext().song`). The song is per-instance
data — two Piano blocks on one page must never share a song — so it must live in
**per-instance context, not global state**.

The previous inert `<script type="application/json" class="wp-block-piano-block-piano__song">`
carrier is **dropped**; the song is no longer transported through a separate `<script>`
element.

This choice gives the store ownership of the song as reactive, mutable state — the
foundation the project wants for future audio/note-input features — and it is the only
change that affects an existing test (the AC8 transport sub-check; see AC8).

### R5 — Escape-safety of the song transport (no breakout, exact round-trip)

The song is untrusted author free text and may contain HTML-significant or
script-significant bytes (e.g. `<`, `>`, `'`, `"`, `&`, `</script>`, `<!--`). Wherever the
song is emitted into the server HTML, it must be encoded so that:

- it cannot break out of its attribute/markup context or inject executable markup (no XSS,
  no stray `<script>` / `<foreignObject>` / element injection); and
- it survives a byte-exact `JSON.parse` round-trip on the client — the song the store
  parses equals the song the author authored.

This guarantee is stated transport-agnostically on purpose: it held for the old carrier
(which hand-escaped `<`) and it must hold for the new context transport. (WordPress core's
context encoder escapes `<`, `>`, `'`, `"`, and `&`, which is a superset of the old
single-character escape; the requirement is the guarantee, not a particular escape list.)

### R6 — Render-or-nothing safety (validation gate is unchanged and client-side)

The render-or-nothing decision stays a **client-side** gate driven by the existing song
validator (no change to the validator, and no server-side validation is introduced). The
observable states are:

- **Conformant song** → the SVG is drawn (R2).
- **Empty / whitespace-only / missing song** → nothing renders. (As today, the server may
  emit no wrapper at all for an empty/whitespace song; where a wrapper does exist with no
  usable song, nothing is drawn into it.)
- **Invalid JSON** → nothing renders: no SVG, no `<pre>`, no raw echo; the wrapper shows no
  visible text.
- **Structurally non-conformant song** (valid JSON but failing the schema, e.g. a bad note
  value) → nothing renders, same as invalid JSON.
- **Conformant but note-less / empty-sections song** → this is **not** render-nothing: it
  draws a valid `<svg role="img">` with staff lines, brace, and clefs but no
  `[data-notehead]`. Render-nothing is reserved for empty/whitespace song, invalid JSON,
  and structurally non-conformant songs only.

The validator must run **once** when an instance is wired (validate-once-at-boot); the
parsed song is cached and redraws (on resize, R7) reuse the cached data without
re-validating. The defensive "parse inside a try/catch after a clean validate"
double-guard is preserved — if a parse unexpectedly fails after validation passed, the
block still renders nothing rather than throwing.

### R7 — Responsive reflow on container resize

- **Initial draw is unconditional.** For a conformant song, the block must always perform
  the initial draw, regardless of whether `ResizeObserver` is available in the browser.
- **Resize reflow is required where supported.** Where `ResizeObserver` is available, a
  change in the container's width must re-pack/justify the notation and redraw a fresh SVG.
  The reflow is **one-way** (container width → SVG; the block never writes the container
  width back, so there is no observer feedback loop) and is debounced to at most one redraw
  per animation frame.
- The width re-measurement uses the container's content width and applies a single
  breakpoint: below `480px` the notation uses a narrower staff-space unit, at or above
  `480px` it uses the standard unit. There is exactly one width breakpoint. Zero width is
  tolerated (the layout floors without throwing).
- The observable consequence (test-pinned): a narrow container yields **more** systems
  (`g[data-system]`) than a wide container, because the narrower width packs fewer measures
  per system.
- Where `ResizeObserver` is unavailable, reflow is gracefully skipped (a no-op) — but the
  initial draw still happens.

### R8 — Per-instance isolation and multi-block support

Every Piano block on a page must render independently. Boot is per-instance: N Piano blocks
produce N independent renders, each reading **its own** song from its own per-instance
context, measuring **its own** container width, and computing **its own** accessible name,
with no cross-talk between instances. In particular, two Piano blocks on one page with
different songs must each render their own notation and their own accessible name. (This
isolation also guards against an accidental regression to shared global state for the
song; see R4.)

### R9 — Internationalization correctness on the frontend module

The accessible-name strings must remain internationalized through `@wordpress/i18n`
(`__`, `_x`, `sprintf`) and must render correctly (English verbatim) when the block runs as
a view *module*. The now-dead classic-script translation registration (the
`wp_set_script_translations` call targeting the old classic view-script handle, which no
longer exists once the block uses a `viewScriptModule`) must be removed or replaced so it
does not reference a non-existent handle.

The wiring of **localized translation files** for the view *module* is deferred to the
design phase and carries a known WordPress-version caveat (see Constraints / Open
Questions). String *correctness* (the four templates, English verbatim) is the required,
observable behavior here; localized-file *loading* is the design-phase decision.

### R10 — WordPress-only dependency invariant

No third-party runtime library outside the WordPress ecosystem may be introduced. The
frontend/view module must import only `@wordpress/*` packages and relative modules. The
Interactivity API runtime (`@wordpress/interactivity`) is WordPress-provided and is
externalized by the build toolchain — it satisfies the constraint, must **not** be added to
`package.json` dependencies, and must **not** be registered manually in `render.php`. This
invariant is verifiable: a scan of the frontend source for non-`@wordpress`, non-relative
runtime imports must come back empty (modulo editor/test-only imports such as `react` and
`node:*`, which are out of scope here).

### R11 — Best-effort music-font gate (cosmetic, not a hard requirement)

The first draw *should* be gated on the music font loading so that ornate glyphs are
present on first paint, with an **immediate-draw fallback** when the browser's Font Loading
API is unavailable, and it must not regress into a flash-of-unstyled-glyph. This is a
best-effort cosmetic nicety, **not** a hard acceptance criterion: the hand-drawn skeleton
(staff, noteheads, stems) renders without the font regardless; the font only swaps in the
ornate glyphs. The hard requirement is only that the SVG eventually mounts and draws
(R2/R7). The font gate is preserved as a behavior but is not pinned by a hard assertion.

### R12 — No new console errors or warnings (soft requirement)

The migrated block must not introduce console errors or warnings in normal operation. (The
existing implementation deliberately suppresses the benign "ResizeObserver loop" warning
via animation-frame debouncing and swallows font-load rejections; the migrated block should
likewise run cleanly.) No existing test asserts on the console; this is a soft requirement.

### R13 — Notation core, song format, and build/test workflow are unchanged

The shared notation core (the layout, SVG-emit, DOM-measurement, glyph, and constants
modules) and the song format / schema / validator must remain unchanged — only the
frontend *wiring* (boot/lifecycle/state) moves into the Interactivity API. The imperative
SVG emit layer is reused as-is (see the imperative-SVG carve-out). The build and test
workflow (the bundler auto-building the view module once `block.json` declares it; the
existing unit tests; the existing e2e suite) requires no test-runner changes, and the
notation/song unit tests must continue to pass.

## Out of Scope

The following are explicitly **not** part of this work and **must not** change:

- **The block editor.** The editor entry (`src/index.js`, `src/edit.js`) and all editor UI
  under `src/editor/*` (e.g. `SongCanvas`, `MetadataEditor`, `PitchEditor`), the
  `editorScript`/`editorStyle` registration, and the editor e2e suite
  (`specs/editor.spec.js`) are frozen. The migration touches only the frontend path
  (`block.json` registration fields, `render.php`, the view module, and the plugin's i18n
  registration in `piano-block.php`).
- **A `save` implementation.** The block is dynamic (server-rendered via `render.php`, no
  `save`); no static save markup is introduced.
- **The notation rendering core** — the layout, SVG-emit, DOM-measurement, glyph, and
  constants modules. These are shared with the editor; changing them would regress the
  editor. They are reused unchanged. (Carving the imperative SVG mount out of the
  directives-only ideal is a framing decision, not a change to these modules.)
- **The song format / schema / validator** (the validate/schema/step-normalization
  modules). The migration reuses the existing validator as-is and does not modify the song
  format.
- **Server-side pre-rendering of the SVG (SSR notation).** Parity does not require it (the
  server renders nothing visible today), and it is not introduced.
- **Future interactive features — audio playback and note input.** This work only
  establishes the Interactivity-API foundation (the song as reactive context, store
  ownership of the lifecycle); it does not implement those features.
- **Client-side navigation / router regions.** A single block hydrates in place; no
  Interactivity-API router region or `navigate` behavior is needed.
- **Converting the notation SVG into declarative directives.** Per the imperative-SVG
  carve-out, the SVG body stays an imperative, store-driven mount; turning it into
  directives is explicitly out of scope.

The following are kept as **requirements**, not out of scope, even though the underlying
mechanism may change:

- The song-transport **escape-safety guarantee** (R5) is a kept requirement; only the
  escaping *mechanism* and the carrier element change (the inert `<script>` carrier is
  dropped in favor of per-instance context).
- The **accessibility model** (`role="img"` + first-child `<title>`, single name source,
  R3) is kept unchanged, not redesigned.

## Constraints / Open Questions for the Design Phase

These are recorded for the design phase to resolve; this spec does **not** resolve them:

- **Module translation-file loading (WordPress 6.9 vs 7.0 gotcha).** The dedicated module
  translation API (`wp_set_script_module_translations`) was introduced in WordPress 7.0,
  but the plugin's floor is `Requires at least: 6.9`, where that API does not exist. So a
  clean localized-translation-file override for the view *module* is not available on the
  6.9 floor. The design must choose, explicitly: (a) accept English-only translations for
  the module on the 6.9 floor (matching the project's current "English works without
  translation files" stance), or (b) raise the minimum WordPress version to 7.0 to use the
  module-translation API. This must be a surfaced decision, not a silent assumption. (R9's
  string-correctness requirement is independent of this choice and holds either way.)
- **Store/directive boundary for lifecycle.** The exact shape of the store and the
  directive(s) that own boot, the resize observer, and the font gate (e.g. an init callback
  owning the observer and the first draw) is a design decision. The spec fixes the
  observable behaviors (R6/R7/R8/R11) and the imperative-SVG carve-out; the design fixes how
  the store wires them.

## Acceptance Criteria

The acceptance criteria below map one-to-one onto the existing e2e contract
(`specs/render.spec.js`) plus one new criterion. With the single exception called out in
AC8, every existing assertion in that suite must continue to pass after the migration. AC
numbers follow the existing suite's labels where they exist.

**AC1 / AC2 / AC12 — Conformant song renders the grand-staff SVG.**
For a conformant song, the block renders a single `<svg role="img">` containing the grand
staff (staff lines and reserve clefs that scale with the number of systems, a brace, and
the song's noteheads). The block contains no raw JSON text and no editor-only hit-target
rect (`[data-hit]`). The wrapper holds the `<svg>` as its only child. (Maps to
`specs/render.spec.js` ~483–540.)

**AC3 — Accessible name from the song metadata.**
The `<svg>` has an accessible name supplied by its first-child `<title>`, computed from the
song metadata using the four branches in R3 (e.g. title + composer → "{title} by
{composer}"). The four branches and their i18n behavior (including the verbatim, un-wrapped
title-only branch) are preserved. (Maps to the accessible-name assertions in
`specs/render.spec.js`, e.g. ~501–502.)

**AC5 — Responsive reflow on resize.**
With `ResizeObserver` supported, a narrow viewport yields **more** `g[data-system]` groups
than a wide viewport, via re-measurement of the container and a debounced redraw. The
initial draw occurs regardless of `ResizeObserver` availability. (Maps to
`specs/render.spec.js` ~587–625, which uses polling to await the animation-frame reflow.)

**AC6 — Empty / whitespace song renders nothing.**
An empty or whitespace-only song produces no rendered notation: no wrapper (where the
server omits it), no `<svg>`, and no `<pre>`. (Maps to `specs/render.spec.js` ~462–481.)

**AC7 — Invalid JSON and non-conformant songs render nothing.**
A song with invalid JSON, and a song that is valid JSON but structurally non-conformant
(e.g. an out-of-range note value), each render nothing: no `<svg>`, no `<pre>`, and the
wrapper shows no visible text. (Maps to `specs/render.spec.js` ~542–585.)

**AC8 — Hostile/free-text content renders inert, and the song transport is escape-safe.**
A conformant song whose free-text fields (e.g. title, annotations) contain hostile or
script-significant content renders **inert**: the notation draws, the hostile bytes appear
verbatim as text content in the `<title>` and in annotation text, **no** injected
`<script>` / `<foreignObject>` appears, and no script executes (no XSS).
**Reworked transport sub-check:** the song is now transported via the per-instance
`data-wp-context` attribute on the wrapper (not a `<script>` carrier). The transport
sub-check is reworked to assert, against that attribute, that HTML/script-significant bytes
are escaped (no markup breakout) and that the song survives a byte-exact `JSON.parse`
round-trip. The render/inert/no-XSS assertions of AC8 are otherwise unchanged. (Maps to
`specs/render.spec.js` ~627–697; the transport sub-check at ~680–696 is the one existing
assertion that changes.)

**AC9 — New: multiple Piano blocks render independently (per-instance isolation).**
Two Piano blocks on one page, each with a **different** song, each render their own SVG
with their own notation and their own accessible name, with no cross-talk between instances
(neither block's song, width, nor accessible name leaks into the other). This is a **new**
acceptance criterion (no multi-block coverage exists today) and guards against a global-state
regression for the song. (New test; maps to R4 and R8.)

**AC10 — Note-annotation and positioning behavior is preserved.**
The block's note-annotation and positioning behaviors are preserved exactly as the existing
suite pins them: per-event note placement bands distinguished by `data-hand` and
`data-placement` (without `data-staff`); standalone-note bands distinguished by `data-staff`
and `data-placement` (not under `data-hand`); below-right-hand and above-left-hand
annotations coexisting and distinguished by `data-staff`; events with both above and below
annotations rendering with the above annotation higher than the below; per-event and
standalone annotations coexisting; and beat ordering with clamping (later beats sit to the
right of earlier beats, and an out-of-range beat is clamped within its `g[data-system]`).
(Maps to `specs/render.spec.js` "note annotations on a real page", ~700–866.)

**AC11 — Hostile free text appears as literal text content.**
Hostile free text appears as literal `textContent`, verbatim, with no injected `<script>` /
`<foreignObject>` and no XSS. (Maps to `specs/render.spec.js` "hostile free text inert",
~869–920.)

**AC13 — Conformant but note-less song draws an empty staff.**
A conformant song with no notes (or empty sections) draws a valid `<svg role="img">` with
staff lines, brace, and clefs but no `[data-notehead]` — it is **not** render-nothing.
(Maps to R6's empty-staff carve-out.)

**AC14 — WordPress-only dependency invariant holds.**
A scan of the frontend source for non-`@wordpress`, non-relative runtime imports returns
empty (modulo editor/test-only `react` and `node:*` imports). `@wordpress/interactivity` is
not present in `package.json` dependencies and is not registered manually in `render.php`.
(Maps to R10.)

**AC15 — Existing unit and editor suites are unaffected.**
The existing notation/song unit tests continue to pass unchanged, and the editor e2e suite
(`specs/editor.spec.js`) continues to pass unchanged — confirming the notation core, song
format, and editor are untouched. (Maps to R13 and the Out-of-Scope fence.)
