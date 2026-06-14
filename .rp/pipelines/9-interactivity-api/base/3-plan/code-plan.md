# Code Plan — Move the Piano block's frontend JS to the Interactivity API (issue #9)

This plan turns the approved design doc into an ordered set of implementation tasks a
fresh `code-writer` can execute one at a time, on a single branch, strictly in sequence.
Each task is self-contained: it names the files, the concrete change (with the governing
design decision IDs), what it depends on, what spec ACs / design decisions it satisfies,
and how to verify it.

## Orientation (read once before starting)

The migration moves the Piano block's frontend from a standalone classic `viewScript`
(`src/view.js` booting on `domReady`, reading the song from an inert `<script>` carrier)
to the WordPress Interactivity API: `block.json` declares `supports.interactivity` + a
`viewScriptModule`; `render.php` emits a `data-wp-interactive` wrapper that seeds the song
and a server-computed accessible name into per-instance `data-wp-context`; and a reactive
store (`store('piano-block/piano', { callbacks: { init } })`) owns boot, lifecycle, and
per-instance state. The **observable output stays identical** — same SVG tree, same
accessibility, same responsiveness, same render-or-nothing safety.

Two framings govern the whole plan:

- **The imperative-SVG carve-out.** The SVG body is built imperatively in the frozen
  notation core (`createElementNS` + `container.replaceChildren`). The spec explicitly
  authorizes that imperative mount as an accepted exception to the directives-only ideal
  (analogous to the allowed `.focus()` write). The Interactivity-API win here is ownership
  of **boot, lifecycle, and state** — *not* declarative rendering of the notation. The
  store decides *when and with what data* the SVG is (re)built; the emit is unchanged.
- **The frozen fence.** The notation core (`layout.js`, `svg.js`, `dom.js`, `glyphs.js`,
  `constants.js`), the song format/validator (`validate.js`, `schema.js`,
  `normalizeStep.js`), `src/song/accessibleName.js`, and the entire editor
  (`src/index.js`, `src/edit.js`, `src/editor/*`) are **frozen**. Tasks may CALL their
  public APIs and MIRROR `accessibleName.js`'s four branches in PHP, but must NOT edit any
  of them. The editor e2e suite (`specs/editor.spec.js`) and all notation/song unit tests
  (including `svg.test.js`) must keep passing untouched.

The store namespace is exactly `piano-block/piano` (the block name), used verbatim and
identically in three places: `render.php`'s `data-wp-interactive="piano-block/piano"`, the
view module's `store("piano-block/piano", …)`, and (implicitly, via the default) the
`wp_interactivity_data_wp_context()` seed.

### Build/test note that affects how you verify tasks

On this toolchain (`@wordpress/scripts` 32.3.0), `wp-scripts build` only runs the webpack
**module** pass when `--experimental-modules` is passed; without it a `block.json` that
declares `viewScriptModule` produces "No entry file discovered" and `view.js` is **not
built** (D2/D26). T1 adds that flag. Therefore:

- After T1, the canonical build command is `npm run build` (which now carries the flag) —
  equivalently `npm run build -- --experimental-modules` against the un-flagged script, or
  `WP_EXPERIMENTAL_MODULES=true npm run build`.
- `npm run test:unit` (Jest) does **not** need the flag — it Babel-transforms `src/`
  directly, mocks `@wordpress/*`, and never reads `build/`. It can run at any point.
- `npm run test:e2e` (Playwright via `wp-scripts test-playwright`) does **not** auto-build,
  so a **flagged `npm run build` must have run first**, and `wp-env` must be up
  (`npm run env:start`). The view-module-dependent e2e checks (AC1/AC5/AC8/AC9) only pass
  once the module actually builds (T1+T2) and the server emits the directives (T3).

A pragmatic TDD note for the e2e-touching tasks: the new/reworked e2e assertions (T6, T7)
are written against the migrated behavior, so they are expected to fail (or not yet build)
until the implementation tasks they depend on have all landed and a flagged build + e2e run
is performed. Where a task says "run the full e2e suite," it assumes a fresh flagged build
and a running `wp-env`.

---

## T1 — Add the `--experimental-modules` build flag

- **Task ID:** T1
- **Goal:** The toolchain builds `view.js` as a real ES module by enabling the webpack
  module pass on every build/start.
- **Files:** `package.json` (modify).
- **Changes (D2, D26):** In the `scripts` block, append ` --experimental-modules` to both
  the `build` and `start` scripts:
  - `"build": "wp-scripts build --experimental-modules"`
  - `"start": "wp-scripts start --experimental-modules"`
  Leave `test:unit`, `test:e2e`, `env:start`, `env:stop`, `lint`, `format`, `check`
  **unchanged** (Jest and Playwright do not take this flag — D26). Do **not** add any
  dependency; in particular do **not** add `@wordpress/interactivity` to `dependencies`
  (R10/AC14 — it is WordPress-provided and externalized by the toolchain).
- **Depends on:** (none — do this first so every later build actually produces the module).
- **Traces to:** D2, D26; R13 (build/test workflow), R10/AC14 (no new dependency).
- **Acceptance:** `package.json` parses (`node -e "require('./package.json')"` exits 0) and
  both scripts contain `--experimental-modules`. A full build (`npm run build`) completes
  without the "No entry file discovered" error for the view module and emits
  `build/view.js` plus `build/view.asset.php`. (The module's *contents* are still the old
  classic script until T5 — that is fine; this task only proves the module pass runs.)

---

## T2 — Register the block as an interactive view module in `block.json`

- **Task ID:** T2
- **Goal:** `block.json` declares the block interactive and builds/enqueues `view.js` as a
  script module instead of a classic view script.
- **Files:** `src/block.json` (modify).
- **Changes (D1):**
  - **Remove** the line `"viewScript": "file:./view.js"`.
  - **Add** `"viewScriptModule": "file:./view.js"` (the field that tells the toolchain to
    build `view.js` as a real ESM module and that WordPress enqueues as a script module).
  - **Add** `"supports": { "interactivity": true }` (the boolean `true` form — shorthand
    for "interactive + client-navigation compatible"; it enables the Server Directive
    Processor for the block. The object form is only for the non-interactive carve-out,
    which this block is not). Note the division of labor: `supports.interactivity` enables
    SDP but does **not** build the module; `viewScriptModule` is what builds `view.js`.
  - Leave everything else unchanged: `editorScript`, `editorStyle`, `style`, `render`,
    `textdomain`, `attributes`, `name`, `apiVersion`, etc.
- **Depends on:** T1 (the module pass must be enabled, or this declaration produces "No
  entry file discovered").
- **Traces to:** D1; R1 (becomes an Interactivity API block), R10/AC14 (module imports
  only `@wordpress/interactivity` — proven later at T5).
- **Acceptance:** `block.json` is valid JSON (`node -e "require('./src/block.json')"` exits
  0) and contains `viewScriptModule` + `supports.interactivity: true` and **no**
  `viewScript`. After `npm run build`, `build/block.json` reflects the same fields and
  `build/view.asset.php` is generated with `'type' => 'module'`. (Hydration is not yet
  meaningful until render.php emits the directives — T3.)

---

## T3 — Route-B `render.php`: per-instance context transport + server-computed accessible name

- **Task ID:** T3
- **Goal:** `render.php` emits a childless `data-wp-interactive` wrapper that seeds the raw
  song and a server-computed accessible name into per-instance `data-wp-context`, dropping
  the inert `<script>` carrier and the hand-rolled escape.
- **Files:** `src/render.php` (rewrite).
- **Changes (D4, D12, D13, D14, D15):**
  - **Keep** the existing empty/whitespace early return verbatim:
    `$song = isset( $attributes['song'] ) ? (string) $attributes['song'] : '';` then
    `if ( '' === trim( $song ) ) { return; }` (no wrapper for empty/whitespace — R6/AC6).
  - **Add a PHP accessible-name helper** `piano_block_accessible_name( $metadata )` that is
    a faithful mirror of `src/song/accessibleName.js`'s four branches, using PHP
    `__()` / `_x()` / `sprintf()`, text domain `'piano-block'`, and `_x` context
    `'sheet music label'` — byte-identical templates and placeholder syntax
    (`%1$s` / `%2$s` / `%s`). Branches, in order:
    1. title **and** composer → `sprintf( _x( '%1$s by %2$s', 'sheet music label', 'piano-block' ), $title, $composer )`
    2. title only → return `$title` **verbatim** (no i18n wrapper — the author's own text).
    3. composer only → `sprintf( _x( 'Piano sheet music by %s', 'sheet music label', 'piano-block' ), $composer )`
    4. neither → `__( 'Piano sheet music', 'piano-block' )`
    Compute `$title` / `$composer` as `is_string( $metadata['title'] ?? null ) ? trim( $metadata['title'] ) : ''` (and likewise for composer) so a non-string or absent value counts as empty after trim. Carry the `/* translators: … */` comments shown in the design (D13). Guard the helper with `if ( ! function_exists( 'piano_block_accessible_name' ) ) { … }` since `render.php` runs once per instance. (Design D13/D22 permits hosting this helper either here or in `piano-block.php`; this plan hosts it in `render.php` so the render file is self-contained — do **not** also define it in `piano-block.php`.)
  - **Decode for the label only (D14):** `$decoded = json_decode( $song, true );` then
    `$metadata = is_array( $decoded ) && isset( $decoded['metadata'] ) && is_array( $decoded['metadata'] ) ? $decoded['metadata'] : array();`
    then `$accessible_name = piano_block_accessible_name( $metadata );`. This decode is
    **only** to read `metadata.title` / `metadata.composer`; it must **not** gate rendering
    (no server-side validation — the render-or-nothing decision stays 100% client-side,
    R6). Invalid JSON → `json_decode` returns `null` → `is_array` guard → `$metadata = []`
    → name falls to the "Piano sheet music" branch (harmless; the client still renders
    nothing for that song).
  - **Seed per-instance context (D4/D12):** build
    `$context = array( 'song' => $song, 'accessibleName' => $accessible_name );` with the
    song passed in **raw** (no escaping in this file). **Drop** the hand-rolled
    `str_replace( '<', '<', $song )` — `wp_interactivity_data_wp_context()` encodes
    via `wp_json_encode( …, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP )`,
    a superset of the old single-character escape (R5/AC8).
  - **Emit the wrapper (D11/D12):** a single **childless** `<div>` carrying, in order,
    `data-wp-interactive="piano-block/piano"`, then
    `<?php echo wp_interactivity_data_wp_context( $context ); ?>` (the namespace param is
    omitted — it defaults to the wrapper's `data-wp-interactive`), then
    `data-wp-init="callbacks.init"`, then
    `<?php echo get_block_wrapper_attributes(); ?>`. The wrapper has **no children** — no
    carrier `<script>`, no SSR notation. The wrapper's own class
    `wp-block-piano-block-piano` (from `get_block_wrapper_attributes()`) is preserved (R2,
    the AC1/AC9 locator).
  - **PHP-mode discipline (iAPI hard rule):** the `<?php … ?>` block computes everything
    and **closes** before the single childless `<div …></div>` line; do not leave a bare
    `<?php` open over the markup (that would make PHP parse the HTML as code → fatal). Use
    inline `<?php echo … ?>` for the two helper emissions.
  - **Replace the file's top doc comment** to describe route B (per-instance context
    transport, server-computed name, childless wrapper, core-encoder escaping) instead of
    the now-removed inert-`<script>`-carrier / hand-rolled-`<` behavior.
  - Do **not** call `wp_register_script_module()` or otherwise register
    `@wordpress/interactivity` manually (R10/AC14) — `register_block_type` auto-enqueues
    the view module.
- **Depends on:** T2 (the block must be declared interactive so the wrapper's directives
  are processed and the module is enqueued).
- **Traces to:** D4, D12, D13, D14, D15; R2 (wrapper attrs, childless), R3 (accessible-name
  parity, four branches), R4 (per-instance context transport), R5/AC8 (escape-safety),
  R6/AC6/AC7 (early return + client-only gate), R9 (i18n computed in PHP).
- **Acceptance:**
  - PHP lints clean: `php -l src/render.php` reports "No syntax errors detected".
  - After a flagged `npm run build` and with `wp-env` running, fetch a published
    comprehensive-song post's raw HTML: the wrapper carries
    `data-wp-interactive="piano-block/piano"`, a `data-wp-context='…'` attribute whose
    decoded JSON has `song` (the raw song string) and
    `accessibleName === "Example by A. Composer"`, `data-wp-init="callbacks.init"`, and the
    class `wp-block-piano-block-piano`; there is **no** `<script class="…__song">` carrier
    and the wrapper has no element children.
  - For a hostile song, the raw `data-wp-context` value contains the escaped `<` (no
    literal `</script>` / `<!--` / `'` breakout) and `JSON.parse` of the attribute (then of
    its `song`) round-trips to the exact author bytes. (This is pinned by the reworked AC8
    sub-check in T6.)
  - For an empty/whitespace song, no wrapper is emitted at all (AC6).
  - The full e2e suite is **not** expected to pass yet — the client still runs the old
    classic `view.js`, which reads the now-removed carrier, so the SVG will not draw until
    T5. Server-HTML-only checks (the AC8 transport sub-check, AC6) are the meaningful
    signals at this point.

---

## T4 — Remove the dead `wp_set_script_translations` call from `piano-block.php`

- **Task ID:** T4
- **Goal:** The plugin no longer references the non-existent classic view-script handle for
  translations; block registration is otherwise unchanged.
- **Files:** `piano-block.php` (modify).
- **Changes (D21, D22):**
  - **Delete** the `wp_set_script_translations( 'piano-block-piano-view-script', 'piano-block', __DIR__ . '/languages' )` call inside `piano_block_register()`. That handle ceases to exist once `viewScript` → `viewScriptModule` (no classic script is registered), and it pointed at a non-existent `languages/` dir — per R9 it must be removed. The view module does **no** i18n (the name is computed in PHP — D4), so there is nothing to wire here.
  - **Keep** `register_block_type( __DIR__ . '/build' )` and the `add_action( 'init', 'piano_block_register' )` hook unchanged. Do **not** add `load_plugin_textdomain` (the block textdomain registry already covers the PHP just-in-time gettext path for the `_x`/`__` strings in render.php — D21). Do **not** add `wp_register_script_module()` (R10/AC14). Do **not** define `piano_block_accessible_name()` here (it lives in `render.php` per T3).
  - Update the function's doc comment to drop the now-removed "loads the frontend
    viewScript's translations" / `wp_set_script_translations` description; it should now
    only describe registering the block from its compiled `block.json`.
- **Depends on:** T2 (the `viewScript` → `viewScriptModule` switch is what makes the old
  handle non-existent; sequence this after that change is in place).
- **Traces to:** D21, D22; R9 (i18n correctness — remove dead translation registration),
  R10/AC14 (no manual module registration).
- **Acceptance:** `php -l piano-block.php` reports "No syntax errors detected"; the file no
  longer contains `wp_set_script_translations` and still contains
  `register_block_type( __DIR__ . '/build' )` and the `init` hook. A grep of the whole repo
  for `piano-block-piano-view-script` returns nothing.

---

## T5 — Rewrite `view.js` as the Interactivity API store module

- **Task ID:** T5
- **Goal:** `view.js` becomes a script module that registers
  `store('piano-block/piano', { callbacks: { init } })`, where a single `data-wp-init`
  callback owns boot, validate-once, the font-gated first draw, and the rAF-debounced
  resize observer — reading the song and accessible name from per-instance context and the
  container from `getElement().ref`.
- **Files:** `src/view.js` (rewrite).
- **Changes (D3, D5–D11, D16–D19):**
  - **Imports.** Import `store`, `getContext`, `getElement` from
    `@wordpress/interactivity`. Keep the relative frozen-core imports that `init` calls:
    `availableWidthInSp` and `drawWhenFontReady` from `./notation/dom.js`,
    `buildLayoutModel` from `./notation/layout.js`, `renderInto` from `./notation/svg.js`,
    and `validateSong` from `./song/validate.js`. **Remove** the
    `import domReady from "@wordpress/dom-ready"` and the
    `import { accessibleNameFor } from "./song/accessibleName.js"` lines — both would break
    the module build (D3): `@wordpress/dom-ready` is not in the module externalization
    allowlist, and `accessibleNameFor` pulls in `@wordpress/i18n` transitively. The
    accessible name now comes from context (D4). After this task `view.js` must import
    **only** `@wordpress/interactivity` plus relative `./notation/*` and `./song/*`
    modules.
  - **Delete the manual boot.** Remove the `domReady(() => { … querySelectorAll(`.${BLOCK_CLASS}`) … })` boot loop, the `BLOCK_CLASS` constant, the `SONG_SCRIPT_CLASS` constant, and the carrier `querySelector('script.…')` read in `setupContainer`. The runtime now does discovery and per-instance boot (it runs `querySelectorAll('[data-wp-interactive]')` and hydrates each, then fires `data-wp-init` once per instance — D8).
  - **The store + `init` callback (D7, D9).** Register exactly:
    ```js
    store( 'piano-block/piano', {
      callbacks: {
        init() { /* boot + lifecycle */ },
      },
    } );
    ```
    No `state` bucket (nothing is shared/SDP-rendered — D5) and no `actions` bucket (no
    user interaction yet — D7). The `init` body reproduces today's `setupContainer`
    sequence almost 1:1 with three changes (song + name from context; no `domReady`; no
    `accessibleNameFor()` call):
    1. `const { ref: container } = getElement();` — `ref` is non-null inside `data-wp-init`
       (unlike `data-wp-run`) and is the live, painted wrapper to render into (D8).
    2. `const { song: raw, accessibleName } = getContext();` (D4/D5).
    3. `if ( validateSong( raw ).length > 0 ) return;` — the **validate-once** client gate
       (R6); `validateSong` is called **unchanged** (frozen).
    4. `let data; try { data = JSON.parse( raw ); } catch { return; }` — the defensive
       parse double-guard preserved (R6/D16): a surprise parse failure after a clean
       validate still renders nothing rather than throwing.
    5. `const draw = () => { const model = buildLayoutModel( data, availableWidthInSp( container ) ); renderInto( container, model, { accessibleName } ); };` — `draw` closes over the cached `data` and the context `accessibleName`; it contains **no** `validateSong` and **no** `JSON.parse`, so resize redraws reuse the cached parse with no re-validation (validate-once, R6/D16). `buildLayoutModel`, `availableWidthInSp`, `renderInto` are all called **unchanged** (frozen core). `renderInto` ends in `container.replaceChildren(svg)` — the authorized imperative carve-out write (D11).
    6. `drawWhenFontReady( draw );` — the font-gated first draw with immediate fallback,
       called **unchanged** (R11/D9). This runs **before** the observer is attached, so the
       initial draw is unconditional (R7).
    7. `const observer = observeResize( container, draw );` (the module helper, see below).
    8. `return () => observer?.disconnect();` — the cleanup contract: a `data-wp-init`
       callback whose return value is a function is registered as the `useEffect` teardown
       and runs on unmount; the `?.` covers the no-`ResizeObserver` case where
       `observeResize` returns `undefined` (D7/D17).
  - **`observeResize` stays a module-level private helper (D10/D17).** Keep
    `observeResize(container, draw)` as a module-level function, reused **verbatim** from
    today's body — the `typeof ResizeObserver === "undefined"` guard, the `frame` rAF
    debounce, and `observer.observe(container)` — with exactly **one** addition: it must
    `return observer` (and return `undefined` on the no-`ResizeObserver` path) so `init`
    can do `const observer = observeResize(…); return () => observer?.disconnect();`. Its
    `frame` and `observer` stay **per-call locals** (never module-level), preserving
    one-way (R7), rAF-debounced (R12), and per-instance isolation (R8/D19).
  - **No module-level mutable per-instance state (D19).** The parsed `data`, the
    `observer`, the `frame` guard, and the `draw` closure are all locals inside `init`
    (and inside `observeResize`), giving automatic per-instance isolation. The only
    module-level construct is the single `store(…)` registration (stateless per instance).
    Do not introduce any module-level variable that holds per-instance data (that would be
    the AC9 cross-talk regression).
  - **Update the file's top doc comment** to describe the new model: a `viewScriptModule`
    whose `store('piano-block/piano')` `callbacks.init` (wired via `data-wp-init`) reads the
    song + server-computed accessible name from per-instance context and the container from
    `getElement().ref`, validates once, builds the draw closure (frozen core), font-gates
    the first draw, and attaches the rAF-debounced one-way resize observer with a disconnect
    cleanup. Note the imperative-SVG carve-out (the SVG mount is the one authorized direct
    DOM write, analogous to `.focus()`).
- **Depends on:** T2 (block declared interactive so the module is built + enqueued), T3
  (server emits `data-wp-interactive` + `data-wp-context` + `data-wp-init`, so the store
  and `getContext()` have something to bind to). T1 (the flagged build) is transitively
  required for the module to build at all.
- **Traces to:** D3, D5, D6, D7, D8, D9, D10, D11, D16, D17, D18, D19; R1 (iAPI ownership
  of lifecycle), R2 (carve-out SVG mount, parity), R6 (validate-once client gate + defensive
  double-guard), R7 (unconditional first draw + one-way debounced reflow), R8 (per-instance
  isolation), R9 (no `@wordpress/i18n` in the module — name from context), R10/AC14 (imports
  only `@wordpress/interactivity` + relative), R11 (font gate preserved), R12 (clean console:
  rAF debounce + cleanup).
- **Acceptance:**
  - `npm run test:unit` passes (no unit test imports `view.js`, so this is a regression
    guard for the frozen core — D25).
  - A flagged `npm run build` succeeds **without** the "Attempted to use WordPress script
    in a module: @wordpress/i18n" / `@wordpress/dom-ready` errors; the emitted
    `build/view.asset.php` declares dependencies of exactly `array('@wordpress/interactivity')`
    with `'type' => 'module'` (D3 — the purest R10/AC14).
  - A static scan of `src/view.js` shows it imports only `@wordpress/interactivity` plus
    relative `./notation/*` / `./song/*` modules — no other `@wordpress/*` and no
    third-party runtime import (AC14). Example check:
    `grep -nE "from \"@wordpress/" src/view.js` lists only `@wordpress/interactivity`.
  - With `wp-env` running on the flagged build, a published comprehensive-song post draws
    the `<svg role="img">` with accessible name "Example by A. Composer" (the migrated
    boot path works end-to-end). Running the full `npm run test:e2e` at this point, the
    existing unchanged assertions in `render.spec.js` (AC1/AC2/AC5/AC6/AC7/AC10/AC11/AC12/
    AC13) and `editor.spec.js` (AC15) should pass; the **only** expected failure is the
    still-old AC8 transport sub-check (which reads the dropped carrier) — fixed in T6.

---

## T6 — Rework the AC8 transport sub-check to read `data-wp-context`

- **Task ID:** T6
- **Goal:** The AC8 escape-safety transport assertion reads the per-instance
  `data-wp-context` attribute (route B) instead of the dropped inert-`<script>` carrier,
  while AC8's render / inert / no-XSS assertions stay unchanged.
- **Files:** `specs/render.spec.js` (modify the AC8 test only).
- **Changes (D15a, D23, D24):** In the test
  `"AC8 (relocated) — a conformant song with hostile free text renders inert and still draws"`,
  replace **only** the transport sub-check (today's block (d) at roughly lines 672–696 that
  locates `<script type="application/json" class="wp-block-piano-block-piano__song">` in the
  raw HTML and slices to `</script>`). The new sub-check:
  - Fetch the raw server HTML the same way:
    `const rawHtml = await (await page.request.get(`/?p=${postId}`)).text();`.
  - **Locate** the `data-wp-context='` opener in `rawHtml` and slice the value to the next
    `'` — safe because the core encoder escapes any in-payload `'` to `&#039;`
    (JSON_HEX_APOS), so the first `'` after the opener is the true attribute close. (Account
    for the exact attribute spelling the runtime emits; assert `indexOf` is `> -1` first.)
  - **Escape-safety asserts:** the sliced value **contains** the escaped `<` sequences and
    **does not contain** a literal `</script>`, a literal `<!--`, or a literal `'`. The
    needle for an escaped `<` is the six characters `<` — in JS test source the
    backslash must be escaped, so write the needle as `"\\u003C/script"` and
    `"\\u003C!--"` (note: route B's encoder emits `<`, distinct from the old carrier's
    JSON-string `<`; assert against whatever the encoder actually produces — the
    decoded round-trip below is the authoritative correctness check).
  - **Byte-exact round-trip:** the attribute value is the JSON of the whole context object,
    so `const ctx = JSON.parse( attrValue );` (outer), then
    `expect( JSON.parse( ctx.song ) ).toEqual( JSON.parse( HOSTILE_SONG ) );` (inner
    deep-equal — the song the store will parse equals the author's bytes), and
    `expect( ctx.accessibleName ).toBe( `${HOSTILE_TITLE} by A. Composer` );` (the
    server-computed name round-trips exactly).
  - **Leave unchanged** the AC8 (a)/(b)/(c) render-inert-no-XSS assertions — the SVG is
    visible, staff lines present, the hostile annotation text and hostile `<title>`
    accessible name appear verbatim, no executable `<script>` injected, `__pianoXssFired`
    stays false. Note: sub-check (b) currently allows `script:not([type="application/json"])`
    because the old carrier was an inert JSON `<script>`; under route B there is **no**
    carrier `<script>` at all, so this assertion still holds (count 0) — it may remain as-is
    or be tightened to `.${BLOCK_CLASS} script`; either is correct. The code-writer should
    keep it consistent with the route-B reality (no carrier) and not assert the carrier's
    presence anywhere.
  - **Stale-comment note (carry-forward, D26):** the test prose near today's lines
    ~654–656 (the (b) comment describing "the only `<script>` inside the wrapper is the
    inert application/json data carrier") and ~672–679 (the (d) comment describing the
    carrier and the `<` escape) are now inaccurate under route B. Since this task is
    already editing this test, update those comments to describe the route-B transport
    (the song rides in `data-wp-context`, escaped by the core encoder). The separate
    AC7-wrapper comment at ~554–555 ("the wrapper MAY exist carrying the inert JSON
    `<script>`") is in a *different* test this task does not otherwise touch; flag it for the
    doc phase rather than editing the AC7 test here (the AC7 assertion is unaffected — the
    childless route-B wrapper still yields `innerText === ""`).
- **Depends on:** T3 (the server must emit `data-wp-context` for the sub-check to read) and
  T5 (the client must draw the SVG for the unchanged (a)/(c) render assertions to pass).
- **Traces to:** D15a, D23, D24; R5/AC8 (escape-safety + byte-exact round-trip via the new
  transport).
- **Acceptance:** With a flagged `npm run build` and `wp-env` up,
  `npm run test:e2e -- render.spec.js` runs the AC8 test green: the escape-safety asserts
  pass against the `data-wp-context` value, the outer/inner `JSON.parse` round-trip and the
  `accessibleName` equality pass, and the unchanged render/inert/no-XSS asserts pass. No
  other `render.spec.js` test regresses (the song lives in an attribute, so the
  `innerText`-based "no raw JSON echo" asserts in AC1/AC12 and the AC7 `innerText === ""`
  asserts are unaffected — D24).

---

## T7 — Add the new AC9 multi-block isolation e2e test

- **Task ID:** T7
- **Goal:** A new e2e test proves two Piano blocks on one page, each with a different song,
  render independently — their own SVG, notation, and accessible name, with no cross-talk —
  guarding against a global-state regression for the song.
- **Files:** `specs/render.spec.js` (add one test).
- **Changes (D19, D20):** Add a new test (AC9) — there is no multi-block coverage today;
  every existing test inserts a single block, and the shared `publishPostWithSong` helper
  inserts exactly one. This test inserts **two** blocks on one post:
  - Define two conformant songs with **different metadata and different note content** so
    their SVG trees differ measurably (distinct `g[data-system]` and/or `[data-notehead]`
    counts), proving each block read its own `context.song`. Per D20, e.g. song A metadata
    `{ title: "Alpha", composer: "X" }` → "Alpha by X" and song B metadata
    `{ title: "Beta", composer: "Y" }` → "Beta by Y"; give A and B different numbers of
    notes/measures so their notation differs. (Define these as local fixtures in the test or
    near the other song fixtures at the top of the file; do not reuse one song for both
    blocks.)
  - Publish a single post containing both blocks. Because the shared helper only handles one
    block, either inline the two-block insertion in the test or add a small local helper:
    `admin.createNewPost()`, then for each song `editor.insertBlock({ name: "piano-block/piano" })`,
    `editor.clickBlockToolbarButton("Edit as JSON")`, fill `editor.canvas.getByLabel("Song (JSON)")`
    with that song (each `insertBlock` + Edit-as-JSON + fill targets the just-inserted,
    currently-selected block), then `editor.publishPost()`. Navigate to the published post.
  - **Assertions (D20):** locate both wrappers by `.${BLOCK_CLASS}`; expect exactly two
    `svg[role="img"]` (e.g. `const svgs = page.locator(`.${BLOCK_CLASS} svg[role="img"]`); await expect(svgs).toHaveCount(2);`);
    assert `svgs.nth(0)` `toHaveAccessibleName("Alpha by X")` and `svgs.nth(1)`
    `toHaveAccessibleName("Beta by Y")` — each its own name, no leak; and assert the two
    notation trees differ (e.g. the two SVGs' `[data-notehead]` or `g[data-system]` counts
    are not equal, or each contains the notehead count implied by its own song). This is the
    global-state-regression guard: if the song were ever lifted to
    `wp_interactivity_state()`, both blocks would render the same notation/name and these
    assertions would fail.
  - Place the test in the existing `"Piano block — front-end render"` describe block (so it
    inherits the `activatePlugin` / `deleteAllPosts` hooks), or in a sibling describe with
    the same `beforeAll`/`beforeEach`/`afterAll` plugin-activate + post-cleanup hooks.
- **Depends on:** T3 (per-instance `render.php` seeds each wrapper's own context), T5 (the
  per-instance `data-wp-init` boot draws each block independently). T6 is independent but is
  sequenced before this only by branch order; no logical dependency.
- **Traces to:** D19, D20; AC9 (new — multi-block isolation), R4 (per-instance context, not
  global state), R8 (per-instance isolation).
- **Acceptance:** With a flagged `npm run build` and `wp-env` up,
  `npm run test:e2e -- render.spec.js` runs the new AC9 test green: two `svg[role="img"]`
  present, each with its own correct accessible name, and the two notation trees measurably
  differ. The rest of `render.spec.js` and all of `editor.spec.js` continue to pass.

---

## Final verification (after all tasks land)

A fresh `code-writer` finishing the last task should confirm the whole migration with a
clean build + full suite on a running environment:

1. `npm run build` (now carries `--experimental-modules`) — succeeds, emits `build/view.js`
   and a `build/view.asset.php` whose dependencies are exactly
   `array('@wordpress/interactivity')`, `'type' => 'module'`.
2. `npm run test:unit` — all notation/song/editor unit tests pass unchanged (frozen core
   untouched — R13/AC15/D25).
3. `npm run env:start` (if not already up), then `npm run test:e2e` — the full
   `render.spec.js` passes (every existing AC1/AC2/AC5/AC6/AC7/AC10/AC11/AC12/AC13 assertion
   unchanged, the reworked AC8 transport sub-check, and the new AC9 test), and
   `editor.spec.js` passes unchanged (AC15).
4. `php -l src/render.php` and `php -l piano-block.php` — clean.
5. Dependency invariant (AC14): `view.js` imports only `@wordpress/interactivity` + relative
   modules; `@wordpress/interactivity` is **not** in `package.json` `dependencies` and is
   **not** registered in `render.php` / `piano-block.php`.

## Coverage check against the design's file-change manifest

- `src/block.json` (D1) → **T2**.
- `package.json` (D2, D26) → **T1**.
- `src/render.php` (D12–D15, plus the D13 PHP name helper, D4 server-compute) → **T3**.
- `piano-block.php` (D13, D22) → **T4** (helper hosted in render.php per T3, so T4 only
  removes the dead translation call).
- `src/view.js` (D3, D5–D11, D16–D19) → **T5**.
- `specs/render.spec.js` AC8 transport sub-check rework (D15a, D23, D24) → **T6**.
- `specs/render.spec.js` new AC9 two-block test (D19, D20) → **T7**.

Frozen / untouched (no task edits them): the notation core (`layout.js`, `svg.js`,
`dom.js`, `glyphs.js`, `constants.js`), the song format/validator (`validate.js`,
`schema.js`, `normalizeStep.js`), `src/song/accessibleName.js` (called as the JS authority
the PHP helper mirrors, never edited), the editor (`index.js`, `edit.js`, `editor/*`), and
`specs/editor.spec.js` and all notation/song unit tests (including `svg.test.js`). The one
stale AC7-wrapper comment in `render.spec.js` (~554–555) is a documentation-phase note (it
is in a test no implementation task edits, and its assertion is unaffected); the stale AC8
comments inside the test T6 edits are corrected there.
