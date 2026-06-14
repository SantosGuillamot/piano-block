# Spec Research — Move the Piano block's frontend JS to the Interactivity API (issue #9)

This document records the iterative Q&A between the spec-analyst and the spec-researcher,
along with the decisions reached. It captures **what** the migrated block must do and the
observable behavior it must preserve — not the implementation design, which the later design
phase owns.

## Intent recap

The Piano block's frontend behavior should run on WordPress's Interactivity API instead of a
standalone `viewScript` (`src/view.js`). The goal is to align the block with WordPress's
standard frontend architecture and lay a foundation for future interactive features (audio
playback, note input). Hard constraint: no dependencies outside the WordPress ecosystem. The
intent leaves open exactly how much of the current logic becomes a store/directives — to be
resolved here with a researched recommendation, while keeping the spec focused on observable
behavior.

## Current behavior baseline (from `src/view.js`)

On `domReady`, the script queries every `.wp-block-piano-block-piano` wrapper on the page and,
per wrapper:
1. reads the inert `application/json` `<script.wp-block-piano-block-piano__song>` `textContent`
   (the raw song);
2. runs `validateSong` — render-or-nothing gate (covers invalid JSON and non-conformant
   structure);
3. for a conformant song, parses it, builds the layout model at the live container width, and
   mounts the SVG; a non-renderable song leaves the wrapper empty (no raw echo, no error);
4. computes the accessible name from `metadata` (i18n-wrapped);
5. gates the FIRST draw on the music font so ornate glyphs are present on first paint;
6. reflows on container resize via a rAF-debounced, one-way `ResizeObserver` (width flows
   container → SVG only, never back).

---

## Early flag from the researcher (pre-Q&A scan)

Before the Q&A began, the researcher surfaced the central tension that the intent's open
assumption points at:

- **Current rendering is imperative DOM construction.** `src/notation/svg.js` builds the SVG with
  `createElementNS` and mounts it via `container.replaceChildren` (`renderInto`). This conflicts
  with the Interactivity API's hard rule that no `innerHTML`/DOM writes should come from
  `view.js` and that reactive behavior should be wired through `data-wp-*` directives. The SVG
  tree is too large and dynamic to express as directives, so the spec must decide **how much**
  of the current logic becomes a store/directives versus staying imperative-but-store-driven.
  The intent already flags this as open ("later phases may confirm exactly how much").
- **Two imperative behaviors need a new home in the iAPI model:** (1) `drawWhenFontReady` (the
  Font Loading API gate on first paint, `src/notation/dom.js`); (2) the rAF-debounced
  `ResizeObserver` reflow (`observeResize` in `src/view.js`).
- **The code already anticipates this migration:** `svg.js` stamps `id` + `data-*` on nodes "so a
  later store can target it (the interactivity hook)".
- **Registration changes implied by iAPI:** `block.json` currently uses `viewScript`; the
  Interactivity API requires `viewScriptModule` (hard rule 1) and the `render.php` wrapper must
  carry `data-wp-interactive="<namespace>"` (hard rule 2).

These are recorded for context. The spec stays focused on observable behavior; the precise
store/directives split is a design-phase decision, but the spec will record a researched
recommendation on the boundary as the intent requests.

## Q&A log

### Q1 — Observable render baseline + test-pinned DOM contract

**Question.** Establish the exact ground truth of what a visitor sees today, so the migrated
block produces the same observable result: (a) the conformant-song end-state (mounted nodes,
SVG attributes, accessible name source + i18n); (b) the non-renderable end-state and what
`render.php` emits on the server before JS runs; (c) the missing/empty-song behavior; (d)
whether `render.php` emits any visible placeholder the JS replaces.

**Researcher findings (existing tests pin the contract — this is the parity baseline).**

The researcher went straight to the existing Playwright e2e suite and found that the observable
DOM contract is already pinned by tests, which is the strongest possible parity baseline:

- **The emitted SVG tree is asserted in detail.** `specs/render.spec.js` drives a real wp-env
  page and asserts exact emitted DOM: `g[data-system]`, `[data-staff-lines]`,
  `[data-reserve] [data-clef]`, `[data-notehead]`, `[data-text="annotation"]`, plus `data-hand`,
  `data-staff`, `data-placement` attributes (around lines 511-530 and 720-866). Note positions
  are asserted via bounding boxes (notes above sit higher than below; beat 2 sits right of
  beat 0) at lines 793-866.
- **Accessible name is the SVG's first-child `<title>`.** The test asserts the `<svg>`
  `toHaveAccessibleName` with the title as the SVG's first child (lines 501-502).
- **Implication:** the migration MUST keep producing the *same* SVG tree. The imperative emit in
  `svg.js` (`createElementNS`) almost certainly survives unchanged; only the *wiring/boot* moves
  into the Interactivity API.

- **Resize reflow is a hard, test-pinned requirement (maps to an existing AC).** `render.spec.js`
  lines 587-625: a narrow viewport must yield MORE `g[data-system]` than a wide one, via
  re-measurement attributed to the `ResizeObserver`; the test uses `expect.poll` to wait for the
  rAF reflow. So resize-driven redraw is NOT optional and must live in the new model (e.g. a
  store callback owning a `ResizeObserver`, or width tracked in context).

- **The server JSON carrier is test-pinned too (escape safety).** `render.spec.js` lines 680-696
  fetch the raw server HTML and assert that `render.php` emits the inert
  `<script type="application/json" class="wp-block-piano-block-piano__song">` carrier intact,
  with a `JSON.parse` round-trip of the exact bytes and the `<` escape present. So the carrier
  mechanism cannot simply be dropped. **Two options the spec must choose between:** (a) keep the
  carrier `<script>` and have the store read the song from it (as today), or (b) seed the song
  into `wp_interactivity_data_wp_context()` / `wp_interactivity_state()` on the server instead.
  Either way the escape-safety guarantee must survive; route (b) would require reworking the
  carrier-reading test, which the spec must flag.

**Central tension (sharpened).** iAPI hard rule 11 says no `innerHTML`/DOM writes from `view.js`
and to wire reactive behavior through directives (`.focus()` is the one allowed DOM write). But
the entire SVG is built imperatively (`svg.js` `createElementNS` + `container.replaceChildren`),
and the tests depend on that exact tree. The SVG is too large, dynamic, and positional to express
as `data-wp-*` directives. **Reconciliation:** the SVG emit stays imperative but becomes
*store-driven* — triggered by a store callback (e.g. `data-wp-init` / `data-wp-watch`), not
rendered by directives. The `replaceChildren` mount is a pragmatic, documented exception (akin to
the allowed `.focus()`). The spec should state explicitly that the directive-only ideal does not
apply to the SVG body; the Interactivity-API win here is lifecycle/boot/state ownership, not
declarative rendering of the notation.

**Migration details surfaced (for the design phase, recorded here):**
- `block.json`: `viewScript` → `viewScriptModule` (hard rule 1); add `supports.interactivity: true`.
- `render.php`: add `data-wp-interactive="piano-block/piano"` namespace on the wrapper (hard rule
  2); the wrapper already carries `get_block_wrapper_attributes()`.
- `piano-block.php` lines 30-34: `wp_set_script_translations` currently targets the classic
  script handle `piano-block-piano-view-script`. A script *module* needs a different i18n path
  (module translations), not the classic-script call. Concrete migration detail to flag.
- `@wordpress/interactivity` is NOT in `package.json` deps today and should NOT be added: it is a
  WordPress-provided script module that wp-scripts externalizes, which satisfies the intent's
  "no libraries outside the WordPress ecosystem" constraint.

**Decisions reached from Q1.**
1. **Parity is defined by the existing e2e DOM contract.** The migrated block must keep producing
   the same SVG tree (same data-attributes, same `<title>`-as-accessible-name, same relative note
   positions) and the same render-or-nothing behavior. The existing `specs/render.spec.js`
   assertions are the canonical observable-behavior baseline; they should continue to pass
   (subject only to the AC8 carrier-test caveat below).
2. **Resize reflow stays.** Width-driven re-pack/justify on container resize is a required,
   test-pinned behavior and must be preserved in the new model.
3. **Imperative SVG emit is allowed.** The spec will explicitly carve out the SVG body as an
   allowed imperative mount, store-driven rather than directive-rendered. The Interactivity-API
   adoption governs boot, lifecycle, and state — not declarative notation rendering.
4. **The song-transport choice (keep carrier vs. seed into context/state) is an open spec
   decision** with a parity consequence for the carrier test; to be resolved in a later question.

**Precise observable contract (Q1 closed).** The researcher provided the exact, cited details:

- **Conformant song end-state.** `setupContainer` builds the layout model and calls
  `renderInto(container, model, { accessibleName })` (`src/view.js:71-79`). `renderInto`
  (`src/notation/svg.js:275-279`) calls `container.replaceChildren(svg)`, so the wrapper ends up
  holding **exactly one child — the `<svg>`** — and the inert JSON `<script>` carrier is removed
  by `replaceChildren` (proven by `specs/render.spec.js:534-539`: the block text no longer
  contains `sections`/`timeSignature`, and there is no `<pre>`).
- **The `<svg>` attributes** (`src/notation/svg.js:239-251`): `role="img"`,
  `viewBox="0 0 {widthSp} {heightSp}"`, `width`/`height` in px (`× SP_PX`),
  `preserveAspectRatio="xMinYMin meet"`, `style="display:block;max-width:100%;height:auto"`,
  `xmlns`. There is **no `aria-label`** and no width/height beyond those.
- **Accessible name = the SVG's first child `<title>`** whose `textContent` is `accessibleName`
  (`src/notation/svg.js:254-256`). `role="img"` + `<title>` makes the labeled graphic; the e2e
  asserts `svg.toHaveAccessibleName(...)` and `svg.locator("title").first()`
  (`render.spec.js:501-502`).
- **Wrapper attributes** come from `get_block_wrapper_attributes()` in `render.php:41` (class
  `wp-block-piano-block-piano`, plus any align/style WordPress adds). `view.js` never touches the
  wrapper's own attributes — only its children.

- **`accessibleNameFor(metadata)` — exact behavior** (`src/song/accessibleName.js:23-47`),
  computed from `song.metadata` `{ title, composer }`, each trimmed (empty after trim = absent):
  - **title + composer** → `sprintf( _x( '%1$s by %2$s', 'sheet music label', 'piano-block' ), title, composer )`.
  - **title only** → the `title` **verbatim**, with **no i18n wrapper** (it is the author's own text).
  - **composer only** → `sprintf( _x( 'Piano sheet music by %s', 'sheet music label', 'piano-block' ), composer )`.
  - **neither** → `__( 'Piano sheet music', 'piano-block' )`.
  - i18n uses `@wordpress/i18n` (`__`, `_x`, `sprintf`). **Migration consequence:** this i18n runs
    in JS today, so the script *module* needs script-module translations (flagged separately).

- **Non-renderable end-state.** The gate is `validateSong(raw).length > 0 → return`
  (`src/view.js:57-59`); `validateSong` (`src/song/validate.js:340-362`) covers both invalid JSON
  (`"Invalid JSON: …"`, lines 344-345) and non-conformant structure (schema-walk errors). On any
  error the JS draws nothing and leaves the wrapper untouched, so the visitor sees a wrapper that
  still holds only the inert JSON `<script>` carrier — **no SVG, no raw echo, no error message**
  (e2e `render.spec.js:554-563`: zero SVGs, no `<pre>`, wrapper `innerText` trimmed is `""` because
  an `application/json` script is not visible text). PHP does **zero** validation
  (`render.php:7-9` comment): for any non-empty song (valid or not) the server emits
  `<div {wrapper attrs}><script type="application/json" class="wp-block-piano-block-piano__song">{escaped song}</script></div>` and nothing visible.

- **Empty / missing song — two layers.** *Server* (`render.php:30-34`): if `trim(song) === ''`
  it returns and emits **no container at all** (no wrapper, no script) — e2e `render.spec.js:476-480`
  (whitespace → 0 wrappers, 0 SVGs). *Client* (only reached when a wrapper exists): `setupContainer`
  returns if no `script.__song` is found (`src/view.js:49-52`); and `raw = script.textContent ?? ''`
  then `validateSong('')` → `"Invalid JSON: …"` (empty string fails `JSON.parse`) → length > 0 →
  return (`src/view.js:54`). So empty/whitespace `textContent` also falls through the
  non-renderable path, leaving the wrapper as-is. Net: empty/missing/whitespace song renders
  nothing, and in the server case often no wrapper at all.

- **No server placeholder.** `render.php` emits a wrapper containing **only** the inert
  `<script type="application/json">` carrier — no SVG, no placeholder, no visible markup
  (`render.php:41`). The wrapper ships visually empty; JS fills it (`replaceChildren` swaps the
  carrier for the `<svg>`). **There is zero server pre-render of the notation today.**

**Key parity implication (recorded as a decision below).** Because the server renders nothing
visible today and the entire notation is client-drawn, an iAPI migration that *also* draws only on
the client (no SSR of the SVG) is full behavioral parity — there is no flash-of-placeholder to
worry about, because there is no placeholder today. The iAPI "seed every reactive value on the
server" rule still applies to whatever state the store reads (e.g. the song string and the
accessible name), but there is **no requirement to server-pre-render the SVG** to match today.
The render-or-nothing *decision* stays client-side, since it depends on `validateSong` (a JS gate),
exactly as now.

**Additional decision reached from Q1.**
5. **No SVG server-side pre-render is required for parity.** Today's server output is visually
   empty (carrier `<script>` only), so the migrated block may continue to draw the notation only
   on the client. The render-or-nothing decision remains a client-side JS gate (`validateSong`).
   The accessible-name string contract is exactly as enumerated above and must be preserved
   verbatim (including the "title verbatim / no i18n" branch and the four fallback cases).

### Q2 — Song transport: keep the inert carrier vs. seed into Interactivity context

**Question.** Today `render.php` emits an inert `<script type="application/json" class="…__song">`
carrier; `view.js` reads its `textContent`, validates, parses, and draws. The e2e (AC8,
`render.spec.js:680-696`) pins that literal carrier plus a `<` escape and a `JSON.parse`
round-trip. The iAPI idiom is to seed reactive values on the server via
`wp_interactivity_data_wp_context()` (per-instance) or `wp_interactivity_state()`. Which transport
should the migrated block use — (A) keep the carrier and read from it, or (B) seed the song into
context and read via `getContext()`? A researched recommendation was requested, weighing
per-instance correctness, escape safety, payload size, and future-fit for audio/note-input.

**Researcher findings.**

1. **Per-instance → local context, not state.** The song is per-instance (each Piano block owns
   its own song). The iAPI rule is that local context is the default and global state is only for
   values explicitly shared across instances (`interactivity-api.md` hard rule 5 and the
   "Local context vs global state" section: two instances of a global-state block on one page
   would share the value, "almost never what the prompt asked"). Two pianos on a page must not
   share a song, so the song belongs in `wp_interactivity_data_wp_context(['song' => …])`, read via
   `getContext()` — not `wp_interactivity_state()`.
2. **Escape safety is preserved — in fact a superset.** WordPress core's
   `wp_interactivity_data_wp_context()` encodes with
   `wp_json_encode($context, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP)`.
   `JSON_HEX_TAG` escapes `<` and `>` — the same protection class as today's hand-rolled
   `str_replace('<', '<', …)` in `render.php:39` — and the `APOS`/`QUOT`/`AMP` flags also
   escape `'`, `"`, `&`, which is *stronger* than today (today escapes only `<`). So the AC8
   breakout guarantee (`</script>`, `<!--`) is preserved as a superset, and the escaping moves
   from custom code to a core helper (less custom code to maintain).
3. **Payload size is not a practical concern.** Route B places the song in a `data-wp-context`
   attribute on the `<div>` rather than in a `<script>` body. HTML attributes have no hard size
   cap in browsers; a song is realistically KB, not MB. Minor cosmetic note: the value is
   JSON-encoded twice on the wire (the song string is itself JSON, then wrapped as a context value
   and JSON-encoded again) — inert and decodes cleanly. Not a blocker.
4. **Future-fit is the decider.** The intent (`intent.md:8`) names a foundation for audio playback
   and note input — features that will read and mutate the song reactively. With route B,
   `getContext().song` is a naturally reactive, mutable store value: a future note-input action can
   do `getContext().song = …` (or mutate in place) and directives/watchers react, so the store
   *owns* the song as state — exactly the foundation the intent wants. With route A, the carrier
   `<script>` is inert and read-once at boot; making it reactive later would still require lifting
   it into context, so route A defers the same work and leaves a dead carrier behind.

**Researcher recommendation: route B.** Seed the song into
`wp_interactivity_data_wp_context(['song' => $song])`, drop the inert carrier `<script>`, and have
the store read `getContext().song`, validate, and draw on the client (the gate stays client-side —
`validateSong` is unchanged JS).

**Parity cost (tests that change):**
- **AC8 transport test (`render.spec.js:680-696`)** reads the literal carrier `<script>` and
  asserts the `<` escape inside it. Route B removes that carrier, so this test must be reworked to
  assert the song is now in the `data-wp-context` attribute with `JSON_HEX_TAG` escaping. The
  *guarantee* (no breakout, exact-bytes `JSON.parse` round-trip, no XSS) stays identical and still
  testable; only the locator and the escaped form change (the escaped `<` now lives inside the
  single-quote-wrapped attribute).
- **Render-or-nothing tests (AC1/2/6/7) are unchanged** — they assert on the final SVG / empty
  wrapper, not the carrier.
- `view.js` no longer `querySelector`s the `__song` script; it reads `getContext().song`
  (implementation detail, not a test).
- Docs / `AGENTS.md` that mention the carrier need updating (documentation-phase concern).

**Minimal-diff caveat.** Route A is valid and lowest-risk (AC8 untouched), but it defers the real
iAPI win. The researcher recommends B unless the spec explicitly scopes "minimal migration, defer
reactivity."

**Decision reached from Q2.**
6. **Adopt route B — seed the song into per-instance Interactivity context.** The migrated block
   seeds the song via `wp_interactivity_data_wp_context(['song' => $song])` on the wrapper and the
   store reads it from `getContext()`. This is per-instance-correct, preserves (and supersets) the
   AC8 escape-safety guarantee through core's `JSON_HEX_*` encoding, and gives the store ownership
   of the song as reactive state — the foundation the intent names for audio/note-input. The
   inert carrier `<script>` is dropped. The only existing test that must change is the AC8
   transport test, which is reworked to assert the same breakout/round-trip guarantee against the
   `data-wp-context` attribute. The render-or-nothing decision and all other observable behavior
   are unchanged. (The spec will state the escape-safety guarantee in transport-agnostic terms so
   it survives the relocation.)

### Q3 — Lifecycle behaviors as observable requirements (font-gate, resize reflow, boot/multi-block)

**Question.** Three lifecycle behaviors must survive the migration. Pin each as a testable
observable requirement with its edge cases: (1) the music-font gate on first paint; (2) the
resize reflow; (3) per-wrapper boot and multiple blocks on one page.

**Researcher findings.**

**(1) Font-gate on first paint — best-effort nicety, not a hard observable requirement.**
`drawWhenFontReady` (`src/notation/dom.js:40-52`): if `document.fonts?.load` is unavailable it
draws immediately; otherwise it calls `document.fonts.load('1em "${MUSIC_FONT_FAMILY}"')` (the
specific renamed/subsetted music font from `glyphs.js`), swallows any rejection with `.catch(() =>
{})`, and draws in `.then(() => draw())` — so the first draw fires after the font promise settles
(whether it loads or fails). It waits on one specific `FontFace` via `document.fonts.load()`, NOT
`document.fonts.ready`, and there is **no timeout fallback** (it relies on the `.load()` promise
always settling). The hand-drawn skeleton (noteheads/stems/staff) renders font-free regardless
(`src/notation/svg.js:1-26`: "skeleton never depends on the font"), so the font only swaps the
ornate glyphs.
- **Observable consequence:** effectively none that is deterministically testable. The SVG mount
  is inside `.then(draw)`, so technically the SVG is not mounted until the font promise settles,
  but in headless/jsdom that settles quickly and the e2e simply awaits the SVG. A grep of `specs/`
  for font/fonts returns **zero** matches — no e2e pins the font-gate; the glyph-on-first-paint
  difference is cosmetic (ornate font vs. hand-drawn skeleton; both render staff + noteheads).
- **Researcher's read (recorded as a decision):** the font-gate is a **best-effort cosmetic
  nicety**, not an AC with a hard assertion. The spec should require that the first paint *should*
  include the music-font glyphs (gate the first draw on font load) with an immediate-draw fallback
  when the Font Loading API is absent, and that this must not regress into a flash-of-unstyled-
  glyph — but the **hard** requirement is only that the SVG eventually mounts and draws; the font
  gate merely orders *when* the first draw fires. In the iAPI model this is async work inside the
  init/boot callback.

**(2) Resize reflow — hard, test-pinned, but conditional on `ResizeObserver`.**
`observeResize` (`src/view.js:94-109`): returns a no-op if `ResizeObserver` is undefined
(`:95-97`); otherwise it attaches a `ResizeObserver` whose callback coalesces via an in-flight
`frame` guard and debounces with `requestAnimationFrame` (at most one `draw()` per frame). The
redraw re-packs and emits a fresh SVG and **never writes the container width back**, so there is
no observer loop (one-way, container → SVG; comment `:84-92`).
- **Edge — `ResizeObserver` undefined (`:95-97`):** graceful no-op; the observer is never
  attached. **Critical spec point:** the *initial* draw still happens regardless, because it fires
  from `drawWhenFontReady` at `setupContainer` (`src/view.js:79`) *before* `observeResize`
  (`:81`). So responsive reflow is conditional on `ResizeObserver` existing, but the **first draw
  is unconditional**. The spec must state: initial render is unconditional; reflow-on-resize is
  best-effort where `ResizeObserver` is supported.
- **Re-measure source — `availableWidthInSp(container)`** (`src/notation/dom.js:25-30`): reads
  `Math.max(container?.clientWidth ?? 0, 0)` (uses `clientWidth`, NOT `getBoundingClientRect`),
  applies a narrow step-down (`spPx = (widthPx > 0 && widthPx < 480) ? 7 : SP_PX`, i.e.
  `NARROW_CONTAINER_PX = 480` → `NARROW_SP_PX = 7`), and returns `widthPx / spPx` (px → staff
  spaces). It tolerates 0 width (jsdom `clientWidth = 0` → returns 0; layout floors without
  throwing).
- **e2e pin (AC5, `render.spec.js:587-625`):** a narrow viewport yields MORE `g[data-system]`
  than a wide one, via re-measure; `expect.poll` waits for the rAF reflow. This is a **hard**
  observable requirement.

**(3) Boot / multiple blocks — per-instance isolation; currently untested → recommend a new AC.**
Today (`src/view.js:112-117`): `domReady` → `querySelectorAll('.wp-block-piano-block-piano')` →
`setupContainer` per wrapper, so N wrappers produce N independent renders, each reading its own
nested `__song` script and its own container width. In the iAPI model, boot is per-wrapper
automatically: every `<div data-wp-interactive="piano-block/piano">` hydrates independently and a
`data-wp-init` callback runs once per instance (`directives.md`, `data-wp-init` "runs once on
mount", per element); `getContext()` returns that instance's context. Per-instance isolation is
free (and stronger than manual `querySelectorAll`). For route B, each instance's
`getContext().song` is naturally isolated (whereas `state` would share — reaffirming the Q2
context choice).
- **Observable requirement:** every Piano block on a page renders independently — N blocks → N
  SVGs, each with its own song, own width, and own accessible name, with no cross-talk.
- **Test gap:** there is **no** multi-block coverage today — every `render.spec.js` test inserts
  exactly one block (one `insertBlock` call, verified by grep). The researcher recommends the spec
  **add an AC**: two Piano blocks on one page with different songs, both rendering independently
  with their own accessible name. iAPI per-instance context makes this the natural correctness
  check and guards against an accidental global-state regression — cheap and high-value.

**Decisions reached from Q3.**
7. **Initial render is unconditional; resize reflow is required where supported.** The migrated
   block must always perform the initial draw for a conformant song, independent of
   `ResizeObserver` availability. Where `ResizeObserver` is supported, a container width change
   must re-pack/justify and redraw (one-way, debounced), preserving the AC5-pinned behavior
   (narrower container → more systems). No observer feedback loop.
8. **The font-gate is preserved as a best-effort cosmetic behavior, not a hard AC.** The first
   draw should be gated on the music font loading, with an immediate-draw fallback when the Font
   Loading API is absent; it must not regress into a flash-of-unstyled-glyph. No hard assertion is
   placed on it. The hard requirement is only that the SVG eventually mounts and draws.
9. **Per-instance isolation is a required observable behavior, and the spec adds a multi-block
   AC.** N Piano blocks on one page render independently (N SVGs), each with its own song, width,
   and accessible name, with no cross-talk. The spec adds a new acceptance criterion for two
   blocks with different songs on one page (currently untested), which also guards against a
   global-state regression — reinforcing the Q2 decision to use per-instance context, not state.

### Q4 — Dependency constraint, registration, i18n path, and editor scope fence

**Question.** Pin four constraint/scope items: (1) the WP-only-dependencies constraint as a
verifiable invariant; (2) the registration change (`viewScript` → `viewScriptModule` +
`supports.interactivity`) and whether any test or wrapper assertion is affected; (3) the i18n path
for the script module; (4) whether the migration touches the block editor (scope fence).

**Researcher findings.**

**(1) WP-only-dependencies — already true and verifiable.** A grep of all non-relative imports in
`src/` shows the **frontend path** (`view.js` + `notation/` + `song/`) imports only `@wordpress/*`
and relative modules: `view.js` imports `@wordpress/dom-ready` plus relatives (`src/view.js:21-26`);
`notation/` and `song/` import `@wordpress/i18n` plus relatives. There are **zero third-party
runtime libraries** in the frontend path. (`react`/`react-dom/client` appear only in the editor and
tests; `node:fs`/`node:path` only in tests; `package.json` runtime deps are only `@wordpress/icons`
for the editor.) So the constraint is *already* satisfied and can be stated as a testable
invariant: a grep of `src/` for non-`@wordpress`, non-relative runtime imports must be empty
(modulo editor/test `react`/`node:`).
- **`@wordpress/interactivity` externalization:** `import '@wordpress/interactivity'` is mapped by
  wp-scripts' `DependencyExtractionWebpackPlugin` to the script-*module* id
  `@wordpress/interactivity` — not bundled, not a `package.json` dependency; WordPress serves it.
  So the view *module* still imports only `@wordpress/*` + relative, preserving the same purity.
  It must **not** be added to `package.json` deps, and the module must **not** be registered
  manually via `wp_register_script_module()` (server-rendering.md hard rule 1).

**(2) Registration — no test pins the handle; wrapper change is safe.** A grep of specs and tests
for `viewScript`/`viewScriptModule`/`block.json` finds only doc-comment mentions
(`render.spec.js:6`, `svg.test.js:7`) — **no assertion reads the script handle or a `block.json`
field**, so changing `viewScript` → `viewScriptModule` breaks no test directly. The observable
proof that registration works is simply that the SVG renders on the published page (covered
transitively by AC1). Wrapper attributes asserted today are only the **class**
`wp-block-piano-block-piano` (`render.spec.js:39`), used as a locator scope; no test asserts the
exact attribute set. Adding `data-wp-interactive="piano-block/piano"` and `data-wp-context='…'` to
the wrapper does not disturb the class locator (the class still comes from
`get_block_wrapper_attributes()`), so it is **safe**. The only at-risk test is the AC8 transport
test, which changes under route B anyway (Q2).

**(3) i18n path — a real WordPress-version gotcha to flag, not assume.** The correct module-i18n
API is `wp_set_script_module_translations($id, $domain, $path)`, but it was **introduced in
WordPress 7.0.0** and is **not available on the plugin's floor** `Requires at least: 6.9`
(`piano-block.php:7`) — verified against developer.wordpress.org and the make.wordpress.org
script-modules notes (module i18n was a gap from 6.5 until 7.0).
- Today `piano-block.php:30-34` calls `wp_set_script_translations` on the classic handle
  `piano-block-piano-view-script`. That handle disappears when `viewScript` becomes
  `viewScriptModule` (no classic script is registered), so the call becomes dead and must change.
- On the 6.9 floor there is no `wp_set_script_module_translations`, so a clean localized-file
  override for the module is not available until 7.0. However, `@wordpress/i18n` itself still works
  inside a module (wp-scripts treats it as a module dependency); English strings work with zero
  setup (today's `piano-block.php` comment already notes "English works without translation
  files"). The gap is *loading localized translation files* for the module on 6.9, not the i18n
  *calls*.
- **Researcher's read (recorded as a decision):** make the **string correctness** observable and
  required — the four accessible-name templates produce the correct string (the e2e already pins
  "Example by A. Composer"), and the i18n wrappers (`__`/`_x`/`sprintf`) are preserved. Treat the
  localized translation-*file* wiring as a design-phase detail with an explicit 6.9-vs-7.0 caveat:
  on the 6.9 floor the dedicated module-translation override is unavailable, so the design must
  either (a) accept English-only for the module on 6.9 (matching today's "English works without
  translation files" stance) or (b) bump the floor to 7.0 — a decision to surface, not silently
  assume a clean path.

**(4) Editor scope — frontend-only; editor and notation core are out of scope / frozen.** The
editor surface is substantial and separate: `block.json` declares `editorScript: file:./index.js`
(`block.json:15`) with `src/edit.js`, `src/index.js`, and `src/editor/*` (multiple React panels —
`SongCanvas`, `MetadataEditor`, `PitchEditor`, etc.) plus an `editorStyle`. The block is dynamic
(no `save` field; `render: file:./render.php`), so the editor is the `editorScript` path and the
frontend is the `viewScript`/`render.php` path.
- The migration touches **only**: `block.json` (`viewScript` → `viewScriptModule`,
  `+ supports.interactivity`), `render.php` (`+ data-wp-interactive`/`data-wp-context`), `view.js`
  (→ store), and `piano-block.php` (the i18n handle). It does **not** touch `edit.js` / `editor/*`
  / `index.js`.
- The editor e2e (`specs/editor.spec.js`, locators `…__canvas` / `…__tree` / `…__list-row`)
  exercises the editor React UI, not the frontend module, and must remain unaffected.
- **Shared risk:** the `notation/` core (`layout.js`, `svg.js`, `dom.js`, `glyphs.js`,
  `constants.js`) is reused by both the editor (`SongCanvas`) and the frontend (`view.js`)
  (`src/notation/dom.js:1-6` comment). The spec must require the notation core to stay **unchanged**
  — only the `view.js` wiring moves — because touching the core would regress the editor too.

**Decisions reached from Q4.**
10. **WP-only-dependencies is an explicit, verifiable invariant.** The frontend/view module must
    import only `@wordpress/*` packages and relative modules; no third-party runtime library may be
    introduced. `@wordpress/interactivity` is WordPress-provided (externalized by wp-scripts), so it
    satisfies the constraint and must not be added to `package.json` or registered manually.
11. **Registration changes to `viewScriptModule` + `supports.interactivity`; observable proof is
    that the block still renders.** Adding `data-wp-interactive`/`data-wp-context` to the wrapper is
    safe (the class locator is preserved). No existing test pins the script handle.
12. **i18n: string correctness is required and observable; localized-file loading carries a
    documented 6.9-vs-7.0 caveat.** The accessible-name strings stay i18n-wrapped via
    `@wordpress/i18n` and render correctly (English verbatim) on the frontend module. The dead
    classic-handle `wp_set_script_translations` call must be removed/updated. The dedicated
    module-translation file wiring (`wp_set_script_module_translations`, a 7.0 API) is a
    design-phase decision with an explicit caveat: on the 6.9 floor it is unavailable, so the design
    must either accept English-only for the module on 6.9 or bump the floor — to be surfaced, not
    assumed.
13. **Scope fence: frontend-only; editor behavior unchanged and out of scope; notation core
    frozen.** The migration touches only the frontend `viewScript`/`render.php` path plus the
    `block.json`/`piano-block.php` registration. The editor (`edit.js`, `editor/*`, `index.js`) and
    its e2e are out of scope and must not change. The shared `notation/` core
    (`layout.js`/`svg.js`/`dom.js`/`glyphs.js`/`constants.js`) must remain unchanged, since the
    editor reuses it.

### Q5 — Closeout: AC inventory, edge cases, out-of-scope, and final material

**Question.** Lock the full existing acceptance-criteria inventory (so the spec maps 1:1 to
test-pinned behavior, flagging what changes under route B and what is added), enumerate any
remaining behavior-parity edge cases, finalize the out-of-scope list, and surface anything else
material before declaring spec research complete.

**Researcher findings.**

**(1) Full AC inventory — `specs/render.spec.js`.**

*Describe block A — "front-end render" (line 449):*
- **AC6 (462-481):** empty/whitespace song → no wrapper, no SVG, no `<pre>`.
- **AC1/AC2/AC12 (483-540):** conformant → `<svg role="img">` grand staff (staff-lines and reserve
  clefs scale with the number of systems, brace, noteheads), accessible name via `<title>`, no raw
  JSON, no editor `[data-hit]` rect.
- **AC7 invalid-JSON (542-564):** bad JSON → no SVG, no `<pre>`, wrapper `innerText` is `""`.
- **AC7 non-conformant (566-585):** e.g. `"quaver"` → no SVG, no `<pre>`, `innerText` is `""`.
- **AC5 (587-625):** reflow — narrow viewport → more `g[data-system]` than wide, via
  `ResizeObserver` re-measure (`expect.poll`).
- **AC8 (627-697):** conformant-but-hostile free text renders inert and draws; no script executes;
  `<title>` + annotation carry the hostile bytes verbatim; **plus** the transport sub-check
  (680-696) reads the literal `__song` `<script>` carrier, asserts the `<` escape, and does a
  `JSON.parse` round-trip.

*Describe block B — "note annotations on a real page" (line 700)* (behavior pins, no AC# label):
per-event note four bands (720-745, `data-hand` + `data-placement`, no `data-staff`); standalone
note four bands (747-771, `data-staff` + `data-placement`, not in `data-hand`); below-RH + above-LH
coexist distinguished by `data-staff` (773-791); event both above + below both render with
`above.y < below.y` (793-810); per-event + standalone coexist (812-835); beat ordering +
over-content (837-866, `beat2.x > beat0.x`; an out-of-range beat is clamped within
`g[data-system]`).

*Describe block C — "hostile free text inert" (line 869):* hostile free text appears as literal
`textContent` (882-920), verbatim, with no injected `<script>`/`<foreignObject>` and no XSS.

- **Changes under route B:** only the **AC8 transport sub-check (680-696)**, which reads the literal
  carrier `<script>`; it is reworked to assert the song lives in the `data-wp-context` attribute
  with `JSON_HEX_TAG` escaping. The AC8 render/inert/XSS assertions are unchanged. **All other ACs**
  (AC1/2/5/6/7/12 and blocks B and C) are unchanged — they assert the final SVG / empty wrapper /
  node attributes, never the carrier.
- **Added:** the multi-block isolation AC (Q3) — two Piano blocks on one page, each with its own
  song and accessible name; currently zero coverage.

**(2) Edge cases.**
- **Re-validation — validate once at boot, not per redraw (confirmed).** `validateSong` runs once
  in `setupContainer` (`src/view.js:57`); `draw` (`src/view.js:71-74`) is `buildLayoutModel` +
  `renderInto` only, with no re-validation. Both the font-gated first draw and every resize redraw
  (`src/view.js:105`) call the validation-free `draw`. Parity requirement: the store validates once
  when wiring an instance, caches the parsed data, and redraws from cache on resize.
- **Empty sections / zero notes — draws an empty staff, is NOT render-nothing.** A conformant song
  with no notes passes `validateSong` (the validator imposes no musical-content requirement —
  `src/song/validate.js` comment around 29-32: structurally conformant but musically unbalanced is
  accepted), so it draws an `<svg role="img">` with staff-lines, brace, and clefs but no
  `[data-notehead]`. Render-nothing is reserved for empty/whitespace song, invalid JSON, and
  non-conformant structure only. Parity: keep drawing the empty staff.
- **Breakpoints — exactly one: `NARROW_CONTAINER_PX = 480`.** Below 480px the unit is
  `NARROW_SP_PX = 7`, otherwise `SP_PX = 8` (`src/notation/dom.js:11-13,28`;
  `src/notation/constants.js`). No other width breakpoint. Zero width is tolerated (returns 0; the
  layout floors).
- **Console errors/warnings as soft contract.** The rAF wrap in `observeResize` exists partly to
  clear the benign "ResizeObserver loop / undelivered notifications" warning
  (`src/view.js:88-92,103`), and `drawWhenFontReady`'s `.catch(() => {})` swallows font-load
  rejections so they never reach the console (`src/notation/dom.js:50`). So the contract is no
  console errors/warnings in normal operation. No test asserts the console today, so the spec can
  note "must not introduce console errors/warnings" as a soft requirement.
- **JS disabled — parity confirmed: nothing renders.** Today `render.php` emits only the inert
  carrier `<script>` with no SSR SVG, so with JS disabled nothing visible appears. Under route B the
  wrapper carries `data-wp-context` but still no SSR SVG (the SVG is built imperatively in a JS
  callback, so server-side directive processing emits no notation either) — so with JS disabled,
  nothing renders, matching today. This is acceptable parity.

**(3) Out-of-scope — finalized.** The proposed list is kept in full: the block editor
(`edit.js`/`editor/*`/`index.js`), `save` (none — dynamic block), the notation-core algorithms
(`layout`/`svg`/`glyphs`/`constants`, frozen — shared with the editor), the future audio-playback
and note-input features (named by the intent as a future foundation, not this issue), and
client-side navigation / router (a single block hydrates; no region/`navigate` needed). The
researcher adds:
- The **song format / schema / validator** (`validate.js`, `schema.js`, `normalizeStep.js`) is
  unchanged — the migration reuses `validateSong` as-is and does not modify the format.
- The render.php escape-safety **mechanism** may change (route B swaps the hand-rolled
  `str_replace` for core's `JSON_HEX_TAG`), and dropping the carrier `<script>` is *in scope* as
  the transport change, but the breakout-safety **guarantee** (AC8) is a kept requirement, not
  out-of-scope.
- The **accessibility model** (`role="img"` + `<title>`, single name source) is unchanged — kept as
  a requirement, not redesigned.

**(4) Final material the spec must capture.**
- **Defensive parse-after-validate double-guard.** `view.js` validates and then `JSON.parse`s
  inside a `try/catch` (`src/view.js:63-68`) — "safe after a clean validate but wrapped
  defensively." Parity: the store should preserve render-or-nothing even if the parse surprises
  post-validation.
- **The imperative-SVG framing is the single most important guard for the design.** The spec must
  explicitly state that the SVG body is built imperatively (`createElementNS` +
  `container.replaceChildren`) and that this is an **accepted exception** to the Interactivity API's
  "directives-only" ideal — the iAPI win here is lifecycle/state ownership, not declarative SVG
  rendering. Without this, a reviewer could wrongly demand the SVG become directives (which is not
  feasible and would break the test-pinned tree).
- **Build/test workflow is unchanged.** `npm run build` (wp-scripts auto-builds the
  `viewScriptModule` once `block.json` declares it), `npm run test:unit` (Jest; notation/song
  unchanged), and `npm run test:e2e` (Playwright; needs build + env). The `svg.test.js` unit test
  (the interactivity-hook id/`data-*` stamps) stays valid because the emit layer is unchanged. No
  test-runner changes are needed.

**Decisions reached from Q5.**
14. **The spec's acceptance criteria map 1:1 to the existing test-pinned behavior.** All current
    ACs (AC1/2/5/6/7/8/12 and the annotation/hostile-text behavior blocks) are preserved; only the
    AC8 transport sub-check is reworked for the `data-wp-context` transport, and a new multi-block
    isolation AC is added.
15. **Edge-case behaviors are pinned for parity:** validate-once-at-boot then cache-and-redraw;
    an empty/note-less but conformant song draws an empty staff (not render-nothing); a single
    480px breakpoint; no new console errors/warnings; and JS-disabled renders nothing (matching
    today). The defensive parse-after-validate guard is preserved.
16. **Out-of-scope is finalized** (editor, save, notation-core algorithms, future audio/note-input,
    router, and the unchanged song format/validator), with the AC8 breakout-safety guarantee and
    the accessibility model explicitly kept as requirements rather than out-of-scope.
17. **The spec will explicitly authorize the imperative SVG mount** as an accepted exception to the
    directives-only ideal, framing the Interactivity-API adoption as lifecycle/state ownership, to
    prevent a design that wrongly tries to express the notation as directives.

---

## Research status: COMPLETE

All coverage areas are resolved and testable:
- **Scope/outcomes** and the **store/directives boundary** recommendation (the intent's open
  assumption) — resolved: adopt the Interactivity API for boot/lifecycle/state ownership; the SVG
  body stays an accepted imperative mount, store-driven, not directive-rendered.
- **Functional requirements and behavior parity** with `src/view.js` — song validation (once at
  boot), layout building, SVG mount (same test-pinned tree), resize reflow (AC5), accessibility
  (`role="img"` + `<title>` accessible-name templates), and error/empty/non-renderable states — all
  pinned against the existing e2e contract.
- **The WP-only-dependencies constraint** — a verifiable invariant; `@wordpress/interactivity` is
  WP-provided and externalized.
- **Edge cases** — enumerated above (Q5).
- **Explicit out-of-scope list** — finalized (Q5).
- **Open assumptions surfaced for the design phase** — the song transport (route B chosen) with the
  AC8 transport-test rework, and the i18n 6.9-vs-7.0 module-translation caveat (English-only on 6.9
  vs. bumping the floor).
