# Design Doc — Move the Piano block's frontend JS to the Interactivity API (issue #9)

## Overview

The Piano block (`piano-block/piano`) is a dynamic, server-rendered WordPress block that
draws a piece of piano sheet music as an inline SVG on the published page. Today its
frontend behavior runs as a standalone classic view script (`src/view.js`, registered via
`block.json`'s `viewScript`): on `domReady` it queries every block wrapper on the page,
reads the song from an inert `<script type="application/json">` carrier nested in the
wrapper, validates it, builds a layout model at the live container width, mounts an SVG,
and reflows the SVG when the container resizes.

This design migrates that frontend behavior to the WordPress **Interactivity API**. The
block becomes an interactive block: `block.json` declares `supports.interactivity` and a
`viewScriptModule`; `render.php` emits a `data-wp-interactive` wrapper that seeds the song
into per-instance context; and a reactive **store** owns boot, lifecycle, and per-instance
state. The block's observable output and behavior stay identical to today's — same SVG
tree, same accessibility, same responsiveness, same render-or-nothing safety. What changes
is the *mechanism*: the Interactivity API (not a hand-bootstrapped `domReady` script) owns
the frontend lifecycle. The goal is to align the block with WordPress's standard frontend
architecture and to give a reactive store ownership of the song and the render lifecycle —
the foundation for future audio playback and note-input features.

This is a frontend-only migration. The block editor, the notation rendering core
(`layout.js` / `svg.js` / `dom.js` / `glyphs.js` / `constants.js`), the song
format/schema/validator, and `accessibleName.js` are **frozen** — the design calls into
their existing public APIs but does not modify them.

### Architecture at a glance

```
                         server (render.php, per block instance)
  $attributes['song'] ──► trim()=='' ? return : ───────────────────────────┐
                          json_decode(song) -> metadata -> piano_block_      │
                          accessible_name() (PHP mirror of accessibleName.js)│
                                                                             ▼
        <div data-wp-interactive="piano-block/piano"
             data-wp-context='{ "song": <raw, encoder-escaped>,
                                "accessibleName": <escaped> }'
             data-wp-init="callbacks.init"
             {get_block_wrapper_attributes()} ></div>     <-- CHILDLESS

                         client (view module: store('piano-block/piano'))
  iAPI runtime discovers [data-wp-interactive], hydrates once per instance,
  then fires callbacks.init once per instance (post-paint useEffect):
        init():
          container = getElement().ref
          { song, accessibleName } = getContext()
          validateSong(song)          -> any error? return (render nothing)  [client-only gate]
          data = JSON.parse(song)     -> catch? return  (defensive double-guard)
          draw = () => renderInto(container,
                          buildLayoutModel(data, availableWidthInSp(container)),
                          { accessibleName })            <-- imperative carve-out write
          drawWhenFontReady(draw)     -> first draw (font-gated, immediate fallback)
          observer = observeResize(container, draw)      <-- rAF-debounced, one-way
          return () => observer?.disconnect()            <-- cleanup
```

The **imperative-SVG carve-out** is the load-bearing framing of this design (see the
dedicated section below): the SVG body is built imperatively in the frozen notation core
(`createElementNS` + `container.replaceChildren`), and the spec explicitly authorizes that
imperative mount as an accepted exception to the directives-only ideal — analogous to the
Interactivity API's allowance for `.focus()` as a permitted direct DOM write. The
Interactivity-API win for this block is ownership of **boot, lifecycle, and state**, *not*
declarative rendering of the notation. The store decides *when and with what data* the SVG
is (re)built; the imperative emit that constructs the SVG is unchanged.

### The frozen modules (called, never edited)

The design calls into these existing APIs and must not modify them:

- **Notation core** — `buildLayoutModel(song, widthInSp)` (`layout.js`), `renderInto(container, model, { accessibleName })` (`svg.js`), `availableWidthInSp(container)` and `drawWhenFontReady(draw)` (`dom.js`), plus `glyphs.js` / `constants.js`. `renderInto` ends in `container.replaceChildren(svg)` — the carve-out write.
- **Song format / validator** — `validateSong(rawString)` (`validate.js`) plus `schema.js` / `normalizeStep.js`. Returns an array of errors; an empty array means conformant.
- **`accessibleName.js`** — `accessibleNameFor(metadata)`. Still serves the editor; the frontend no longer calls it (see D4). It is the JS authority the PHP helper mirrors.

These modules are shared with the editor; changing them would regress the editor. They are
reused as-is.

---

## Module and build setup

### Registration (`block.json`) — D1

`src/block.json` changes the frontend registration fields:

- **Drop** `"viewScript": "file:./view.js"`.
- **Add** `"viewScriptModule": "file:./view.js"` — the field that tells the toolchain to build `view.js` as a real ES module and that WordPress enqueues as a script module.
- **Add** `"supports": { "interactivity": true }`.

The boolean `true` form of `supports.interactivity` is correct here. It is shorthand for
"interactive + client-navigation compatible", it enables the **Server Directive Processor
(SDP)** for the block, and it tags the view module. The object form
(`{ "interactive": false, "clientNavigation": true }`) is only for the non-interactive
carve-out, which this block is not. Note the division of labor: `supports.interactivity`
enables SDP, but it does **not** build the module — `viewScriptModule` is the field that
builds `view.js`. (Everything else in `block.json` — `editorScript`, styles, `render`,
`textdomain`, `attributes` — is unchanged.)

The store **namespace** is exactly `piano-block/piano` (the block name), used verbatim and
identically in three places: `render.php`'s `data-wp-interactive="piano-block/piano"`, the
view module's `store("piano-block/piano", …)`, and (implicitly) the context seed. The
namespace parameter to `wp_interactivity_data_wp_context()` is optional and defaults to the
wrapper's `data-wp-interactive`, so it is omitted in `render.php`.

### The build flag is a real, surfaced change — D2

On the repo's toolchain version (`@wordpress/scripts` 32.3.0), `wp-scripts build` runs two
webpack passes — a `script` pass and a `module` pass — and **the module pass is gated
behind an opt-in CLI flag**. Without `--experimental-modules` (or `WP_EXPERIMENTAL_MODULES=true`),
a `block.json` that declares `viewScriptModule` produces "No entry file discovered" and
`view.js` is **not built**. With the flag, `view.js` is built as a real ESM module.

`package.json` therefore changes its `build` and `start` scripts:

```jsonc
"build": "wp-scripts build --experimental-modules",
"start": "wp-scripts start --experimental-modules",
```

This is the one place the spec's "no test-runner / bundler changes needed" note is
imprecise: conceptually, declaring `viewScriptModule` is enough; on this toolchain version
the module pass is opt-in, so the npm scripts must change.

**Trade-off.** "experimental" is just the flag's name — it is the supported way to build
view modules on 32.3.0 and is exactly what WordPress core blocks use. The alternative
(hand-rolling a multi-config `webpack.config.js`) is more custom code for no benefit.
*Rejected:* leaving the scripts unchanged (the module never builds → nothing hydrates).

`test:unit` and `test:e2e` scripts are **unchanged** (D26): Jest Babel-transforms `src/`
directly (it never reads `build/`, and it mocks `@wordpress/*`), so it does not need the
flag; `wp-scripts test-playwright` does not auto-build, so e2e correctness merely depends on
the flagged build having run first — the same build-then-e2e ordering as today, only the
flag is new. No `.github/workflows` dir exists, so there is no CI to update (a future CI
must run the flagged build before e2e).

### The view module imports only `@wordpress/interactivity` — D3

The built module is real ESM whose `view.asset.php` declares exactly
`array('dependencies' => array('@wordpress/interactivity'), …, 'type' => 'module')` — the
script-**module** id `@wordpress/interactivity`, not a classic `wp-` handle. This is the
purest form of R10/AC14.

The toolchain's module-externalization allowlist is tiny: only `@wordpress/interactivity`
(static), `@wordpress/interactivity-router` (dynamic), and `@wordpress/a11y` (dynamic) are
externalized as script modules. **Any other `@wordpress/*` script imported into the module
is a hard build error**:

```
Attempted to use WordPress script in a module: @wordpress/i18n, which is not supported yet.
```

This is not hypothetical for this block. Today's `view.js` imports `@wordpress/dom-ready`
and (transitively, via `accessibleNameFor`) `@wordpress/i18n` — both would break the module
build. The migration removes both from the module graph:

- **`@wordpress/dom-ready`** is dropped outright — the Interactivity API runtime owns boot
  (D8), so the manual `domReady` boot disappears.
- **`@wordpress/i18n`** is forced off the client by computing the accessible name on the
  server (D4 below). The frozen `accessibleName.js` keeps its `@wordpress/i18n` import, but
  `view.js` no longer calls it, so it never enters the module graph.

WordPress core view modules confirm the pattern: none import `@wordpress/i18n`; their
`view.asset.php` dependency list is only `@wordpress/interactivity`, and they either SSR
their i18n text in PHP or do no i18n in the module. `@wordpress/interactivity` is
WordPress-provided and externalized — it must **not** be added to `package.json`
dependencies and must **not** be registered manually in `render.php`.

---

## Server-side accessible-name computation (the D4 pivot, and why)

**Decision (D4): compute the accessible name on the server in `render.php` and seed it into
per-instance context.** This is the load-bearing fork of the whole design. Because
`@wordpress/i18n` cannot live in the view module (D3), the four-branch accessible-name
string is computed in `render.php` with PHP `__()` / `_x()` / `sprintf()` — the exact same
four branches, text domain `piano-block`, and `_x` context `'sheet music label'` as the JS
`accessibleName.js` — and seeded into the wrapper's `data-wp-context` alongside the song.
The view module reads `getContext().accessibleName` and passes it straight into
`renderInto(container, model, { accessibleName })`; it never imports or calls
`@wordpress/i18n`.

### Why this satisfies R3 and R9

R3 pins the **strings** (the four branches, the verbatim un-wrapped title-only branch, the
`_x` / `__` / `sprintf` i18n behavior, correct English verbatim) — *not* the language they
are computed in. PHP `__` / `_x` / `sprintf` are core functions available at render time
and produce byte-identical English output to the JS path: both just fill the template, the
placeholder syntax (`%1$s` / `%2$s` / `%s`) is identical, and no translation files exist
today (there is no `languages/` dir). The e2e-pinned strings — `"Example by A. Composer"`
and `"Pwn </script>… by A. Composer"` — come out identical. R9's requirement that the
strings render correctly "when the block runs as a view *module*" is satisfied because the
module receives the already-correct string via context.

### Why this is the right call (not just the easy one)

It (a) dodges the hard build blocker with **zero** custom webpack config; (b) matches the
established WordPress-core view-module pattern (SSR the i18n text, keep the module
dependency-free); (c) is the purest R10/AC14 (the module imports only
`@wordpress/interactivity`); (d) leaves the frozen `accessibleName.js` untouched and still
used by the editor; (e) folds naturally into the route-B context transport (the name rides
in the same `data-wp-context` as the song); and (f) resolves the R9 module-translation
caveat outright — because the string is computed in PHP, it localizes via the plugin's
normal PHP gettext path, which already works on the 6.9 floor, so the
`wp_set_script_module_translations` 7.0-vs-6.9 gotcha never applies to this block (see the
i18n section and D21).

### The PHP name helper — D13

`piano_block_accessible_name($metadata)` is a faithful mirror of `accessibleName.js`'s four
branches. It may live in `piano-block.php` or, guarded with `function_exists()`, in
`render.php` (which runs per instance):

```php
function piano_block_accessible_name( $metadata ) {
    $title    = is_string( $metadata['title'] ?? null ) ? trim( $metadata['title'] ) : '';
    $composer = is_string( $metadata['composer'] ?? null ) ? trim( $metadata['composer'] ) : '';
    if ( '' !== $title && '' !== $composer ) {
        /* translators: 1: song title, 2: composer name. */
        return sprintf( _x( '%1$s by %2$s', 'sheet music label', 'piano-block' ), $title, $composer );
    }
    if ( '' !== $title ) {
        return $title; // Author's own title — no wrapper (verbatim branch).
    }
    if ( '' !== $composer ) {
        /* translators: %s: composer name. */
        return sprintf( _x( 'Piano sheet music by %s', 'sheet music label', 'piano-block' ), $composer );
    }
    return __( 'Piano sheet music', 'piano-block' );
}
```

PHP name parity is proven byte-identical to JS for every pinned string: title+composer →
`"Example by A. Composer"`; hostile title+composer → `"${HOSTILE_TITLE} by A. Composer"`;
title-only verbatim; composer-only; neither → `"Piano sheet music"`; and a whitespace-only
title falls through to the composer branch.

**Trade-off (D13).** One piece of logic now exists in two languages — PHP for the frontend,
JS (`accessibleName.js`) for the editor. They are kept in lockstep by the shared four-branch
contract and the e2e pins. This is the deliberate cost of D4 (dodging the i18n-in-module
blocker) and is preferable to shipping i18n in the module or bundling `@wordpress/i18n`.

### Subtleties D4 must honor

- The accessible name is per-instance **untrusted free text**, so it rides through the
  context encoder (which escapes it — R5/AC8), and `renderInto` already sets the `<title>`
  via `textContent` (inert), so hostile bytes stay literal text. No XSS.
- Computing the name in PHP does **not** introduce SSR of the SVG. Only the *name string* is
  server-computed; the SVG is still drawn entirely on the client.
- The render-or-nothing gate stays **client-side** (`validateSong` in the module). A
  non-renderable song still draws nothing even though `render.php` may have computed a name —
  the name is simply never shown. (And for an empty/whitespace song, `render.php` emits no
  wrapper at all, so no name is computed.)

### Alternatives rejected (D4)

- **(B) Override the externalization to allow `@wordpress/i18n` as a module.** Not viable:
  WordPress does not serve `@wordpress/i18n` as a script module, so it would 404 at runtime.
- **(C) Bundle `@wordpress/i18n` into the view module** (add to `package.json`, use
  `WP_NO_EXTERNALS` / custom externals). It works and technically still imports only
  `@wordpress/*` (so R10's letter holds), but it adds a dependency the repo does not install
  today (only `@wordpress/icons` is a dep), ships i18n code in the module, and runs against
  the "externalize WordPress packages, don't bundle them" grain. Messier on every axis and
  divergent from core. Option A (server-compute) is cleaner.

---

## Store design

### What lives in context — D5

`getContext()` carries **exactly `{ song, accessibleName }`** — both server-seeded strings
via `wp_interactivity_data_wp_context([ 'song' => …, 'accessibleName' => … ])`, both
per-instance, never shared. Nothing else is seeded.

The Interactivity API's "seed every reactive value before JS runs" rule exists so SDP can
pre-render directives that *read* state/context. Here **no directive binds state→DOM** — the
SVG is the imperative carve-out, and there is no `data-wp-text` / `data-wp-bind` that reads
the song or the name — so SDP has nothing to pre-render. The consequences:

- **No derived-state getters.** They exist only to feed directives/SDP; nothing consumes
  them here.
- **No `wp_interactivity_state()` at all.** State is for cross-instance / SDP values;
  neither applies. The store has **no `state` bucket**.
- The "seed even empty values" caveat does not bite, because `render.php` only emits the
  wrapper when the song is non-empty (the early return), so whenever the wrapper exists both
  `song` and `accessibleName` are present.

**Trade-off (D5).** This leans on the carve-out: if a future feature directive-binds any
notation detail it would need seeded state — but that is explicitly out of scope.
*Rejected:* seeding the song into `wp_interactivity_state()` (would make two pianos share one
song — the exact AC9 regression), and adding derived getters (nothing consumes them).

### Per-instance runtime objects are init-closure locals, not context — D6

The non-serializable per-instance runtime objects — the parsed-and-validated song cache, the
`ResizeObserver`, the rAF frame guard, and the `draw` closure — live as **locals inside the
single `data-wp-init` callback**, never on context.

This is dictated by the runtime's proxy rule: only plain `Object` / `Array` get the reactive
signals proxy (and deep descent); any other constructor (a `ResizeObserver`, a DOM element)
is stored as an opaque leaf. So:

- A parsed song object (constructor `Object`) on context would be **deeply proxified** —
  unwanted reactive overhead for a read-only post-validate cache, and it pollutes the
  conceptually-serializable context with client-only data.
- A `ResizeObserver` on context is stored as an opaque leaf (safe) but semantically wrong —
  context is serializable per-instance state; an observer is not state.

The canonical pattern is **closures in the init callback**: `data-wp-init` runs once per
instance on mount (it is a `useEffect(fn, [])`), and `getElement().ref` gives that instance's
wrapper. Declaring `let data`, `let frame`, `const observer`, `const draw` as locals inside
`init()` (and inside the `observeResize` helper it calls) gives automatic per-instance
isolation with zero context pollution. (This matches Gutenberg's fit-text approach: a
`data-wp-init` creates a `ResizeObserver` in a closure and returns a cleanup that disconnects
it.) A module-level `WeakMap<Element, {…}>` keyed by `getElement().ref` would only be needed
if the lifecycle were split across multiple callbacks sharing one observer — overkill when a
single init callback owns everything.

**Trade-off (D6).** The parsed-song cache is therefore not reactive — correct here
(validate-once, then read from cache on every redraw; R6) and it keeps context free of
client-only, non-serializable data. *Rejected:* stashing the parsed object on context
(unwanted proxification + pollution), and a module-level `WeakMap` (unnecessary while one
callback owns the lifecycle).

### The store is callbacks-only — D7

```js
store( 'piano-block/piano', {
  callbacks: {
    init() { /* the entire boot + lifecycle */ },
  },
} );
```

- **No `state` bucket** — nothing is global/shared and nothing is SDP-rendered (D5).
- **No `actions` bucket** — actions feed `data-wp-on--*` user events; this block has no user
  interaction yet (it is a render pipeline, not interactive UI).

The whole boot/lifecycle lives in `callbacks.init`, wired via `data-wp-init` on the wrapper.
**Cleanup contract:** a `data-wp-init` callback whose return value is a function is registered
as the `useEffect` teardown and runs on unmount, so `init()` returning
`() => observer?.disconnect()` is the correct teardown — it matters for R12 (clean console /
no leaks) and for SPA/`navigate` unmount, even though a single-page hydrate rarely unmounts.

**Single `data-wp-init` vs splitting resize into `data-wp-watch`.** Single init is the right
fit. `data-wp-watch` re-runs when the state/context it *reads* changes; but resize is driven
by the DOM `ResizeObserver`, not by a context/state signal, so there is nothing for a watch to
react to. The observer is an imperative side-effect that init sets up once. A `data-wp-watch`
would only earn its place if a future feature made the redraw react to a context signal (e.g.
a note-input action mutating `context.song`) — out of scope now. This callbacks-only shape is
the idiomatic form for a no-user-interaction render block and is the foundation onto which
future audio / note-input `actions` can be added without restructuring.

---

## Boot, lifecycle, and the imperative-SVG carve-out

### `data-wp-init` replaces the manual `domReady` boot — D8

The runtime itself does discovery and per-instance boot: it runs
`document.querySelectorAll('[data-wp-interactive]')` and, per node, `hydrate(toVdom(node), …)`.
So `view.js`'s `domReady`, its `document.querySelectorAll('.wp-block-piano-block-piano')`, and
the boot loop all disappear (and the `@wordpress/dom-ready` import goes away — it could not be
in a module build either).

The wrapper carries `data-wp-interactive="piano-block/piano"` +
`wp_interactivity_data_wp_context([ song, accessibleName ])` + `data-wp-init="callbacks.init"`.
`init` runs **once per instance** (`useInit = useEffect(withScope(cb), [])` — an empty-deps
effect). `getElement().ref` is the live wrapper element to render into, and is **non-null**
inside `data-wp-init` (unlike `data-wp-run`, where `ref` is null on first render).

**Timing.** `useEffect` runs *after* browser paint, so when `init` fires the wrapper is
mounted, painted, and in the live DOM → `container.clientWidth` is live and measurable →
`availableWidthInSp(container)` reads the correct width at boot. (The jsdom zero-width
tolerance still applies as a fallback.)

**Trade-off (D8).** Boot timing now follows the runtime's post-paint `useEffect`, not
`domReady`. But that is *later* (after mount + paint), which is exactly when the container
width is reliable, so it is an improvement, not a regression. `data-wp-init` is also strictly
stronger per-instance isolation than a manual query — it underpins AC9.

### The `init()` sequence — D9

`init()` reproduces today's `setupContainer` sequence almost 1:1, with three changes (song +
name come from context; no `domReady`; no `accessibleNameFor()` call):

```js
init() {
  const { ref: container } = getElement();
  const { song: raw, accessibleName } = getContext();     // D4/D5 — no accessibleNameFor()
  if ( validateSong( raw ).length > 0 ) return;           // validate-ONCE gate (R6) — FROZEN
  let data;
  try { data = JSON.parse( raw ); } catch { return; }     // defensive parse double-guard (R6)
  const draw = () => {
    const model = buildLayoutModel( data, availableWidthInSp( container ) ); // FROZEN
    renderInto( container, model, { accessibleName } );                      // FROZEN — carve-out write
  };
  drawWhenFontReady( draw );                  // FROZEN — font-gate + immediate fallback (R11)
  const observer = observeResize( container, draw );   // resize wiring (module helper, D10)
  return () => observer?.disconnect();        // cleanup (D7)
}
```

`validateSong`, `buildLayoutModel`, `renderInto`, `availableWidthInSp`, and `drawWhenFontReady`
are all called **unchanged** (frozen notation/song core — R13); only the caller (`view.js`) is
rewritten. The parsed `data` is cached in the closure so resize redraws reuse it with no
re-validation (validate-once, R6). `accessibleName` comes from `getContext()` (D4), so
`accessibleNameFor()` is never called on the frontend → `@wordpress/i18n` never enters the
module graph → the build blocker is dodged, and `accessibleName.js` stays frozen and still
serves the editor.

### `observeResize` stays a module-level helper — D10

`observeResize(container, draw)` remains a **module-level private helper** in the rewritten
`view.js`, called from `init()` and returning the observer (or its disconnect handle). This
keeps `init()` readable, isolates the rAF-debounce and the `ResizeObserver`-undefined guard,
and keeps `frame` / `observer` as `observeResize`-local closures (D6). The function body is
reused verbatim from today (`view.js`), with exactly **one addition** — `return observer` (and
`undefined` on the no-`ResizeObserver` path) — so `init` can do
`const observer = observeResize(container, draw); return () => observer?.disconnect();`. It is
part of the rewritten `view.js`, not the frozen core. *Rejected:* inlining the observer into
`init` (bloats the callback) — cosmetic; both conform.

### The carve-out wiring is authorized and store-driven — D11

`draw` → `renderInto(container, model, { accessibleName })` → `container.replaceChildren(svg)`
(frozen `svg.js`). **`replaceChildren` is not `innerHTML`** — it appends already-built DOM
nodes (from `createElementNS`), with no HTML parsing or string injection — so it does not trip
the Interactivity API rule that bans `innerHTML` and `addEventListener` / `classList` / `style`
writes. It is the explicitly-authorized carve-out (analogous to the allowed `.focus()` write),
and the store **drives** it: `init` decides *when* (post-mount, font-ready, on resize) and
*with what* (parsed song + server-computed name); the emit is only the mechanism.

**What SDP emits.** Under route B the inert carrier `<script>` is dropped (see Song transport),
so `render.php` emits
`<div data-wp-interactive data-wp-context data-wp-init {wrapper attrs}></div>` — a wrapper with
directives but **no child directives and no children**. SDP processes only directives; with no
child directives it emits the div with its attributes and **empty content** — no server-side
child rendering, no flash. `replaceChildren` on the empty wrapper is correct: zero children to
clear, then append the SVG — the same DOM op today's resize redraws already perform.

### Reconciliation is provably safe — Preact will not clobber the injected SVG — D11

This is the whole carve-out's safety, established from the runtime source:

1. **`toVdom` snapshots children at hydration.** The runtime tree-walks the wrapper's DOM at
   hydrate time. An empty wrapper (route B) → no element children → `children = []` →
   `h('div', props, [])`. The wrapper's vdom records **empty** children.
2. **Children with no directives are not reactive.** The runtime wraps only elements that carry
   directives; a child with no `data-wp-*` is a plain pass-through vnode with no reactive scope,
   no signal subscription, and never independently re-renders. Route B has **zero** child
   directives.
3. **Mutating context does not re-render the wrapper's children.** `data-wp-context` wraps
   children in a Provider whose context stack is memoized on values fixed at hydration; mutating
   `context.song` flows through the signals proxy to whatever directive *reads* it (none here),
   not by re-rendering the Provider. The `children` handed to the Provider are the stable
   `toVdom` snapshot (`[]`).
4. **Net:** after `hydrate()` runs once, Preact has no reactive trigger to ever touch the
   wrapper's child DOM again, so `init`'s `replaceChildren(svg)` injects DOM Preact does not
   track and will not reconcile away; resize redraws are equally safe.
5. **Ordering (no race).** The runtime splits hydration with `await splitTask()` /
   `setTimeout(resolve, 0)` so stores are registered before hydrate; `data-wp-init` (a
   post-commit `useEffect`) fires **after** hydrate completes. Deterministic sequence: store
   registered → `hydrate(empty wrapper)` → `init` runs → `replaceChildren(svg)`. There is no
   race where `init` draws before hydrate or where hydrate wipes a drawn SVG.

**Trade-off / guard (D11).** This safety holds precisely because the wrapper has **no child
directives**. Any future change that adds a child directive under the wrapper must re-examine
reconciliation (or fence the SVG subtree with `data-wp-ignore`). The runtime honors
`data-wp-ignore` (capture `innerHTML`, mark ignore, skip reconciling) as an explicit escape
hatch for any future variant that SSRs children Preact must not touch — route B's
empty-children snapshot already means there is nothing to reconcile, so it is **noted but not
needed** here.

This nails the spec's framing: the Interactivity-API win is lifecycle/state ownership, not
declarative notation rendering.

---

## Song transport (route B) and the `render.php` shape

### Route B: per-instance context, no carrier — D12

The song is carried to the client by seeding it into the wrapper's per-instance
`data-wp-context` (R4). The previous inert
`<script type="application/json" class="wp-block-piano-block-piano__song">` carrier is
**dropped**. The full `render.php` shape (route B), honoring the rule that a `<?php … ?>`
block computes everything and closes before a single childless `<div>` line:

```php
<?php
$song = isset( $attributes['song'] ) ? (string) $attributes['song'] : '';

if ( '' === trim( $song ) ) {
    return; // Empty / whitespace song -> no container (R6/AC6), same as today.
}

// Compute the accessible name on the SERVER (D4) — mirrors accessibleName.js's four
// branches in PHP so the view module never imports @wordpress/i18n.
$decoded  = json_decode( $song, true );
$metadata = is_array( $decoded ) && isset( $decoded['metadata'] ) && is_array( $decoded['metadata'] )
    ? $decoded['metadata'] : array();
$accessible_name = piano_block_accessible_name( $metadata );

$context = array(
    'song'           => $song,           // RAW string — the encoder escapes it.
    'accessibleName' => $accessible_name,
);
?>
<div
    data-wp-interactive="piano-block/piano"
    <?php echo wp_interactivity_data_wp_context( $context ); ?>
    data-wp-init="callbacks.init"
    <?php echo get_block_wrapper_attributes(); ?>
></div>
```

Key points:

- The **`'' === trim( $song )` early return is kept** (no wrapper for empty/whitespace —
  R6/AC6), unchanged from today.
- `$song` goes into context **raw**; today's hand-rolled `str_replace( '<', '<', … )` is
  **dropped**. `wp_interactivity_data_wp_context()` encodes via
  `wp_json_encode( $context, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP )` — a
  **superset** of today's single-character escape (it now escapes `<`, `>`, `'`, `"`, `&`).
- The `data-wp-context` namespace param is omitted (defaults to the wrapper's
  `data-wp-interactive`).
- The wrapper's own attributes still come from `get_block_wrapper_attributes()` (R2), so the
  class `wp-block-piano-block-piano` is preserved (the AC1 / AC9 locator).
- The wrapper is **childless** — no carrier `<script>`, no SSR notation.

**Trade-off (D12).** Escaping moves from this file's own code into core's encoder — less
custom code, a stronger (superset) escape — at the cost of the transport being a
`data-wp-context` attribute rather than a `<script>` body (the AC8 sub-check is reworked
accordingly — D15a).

### Escape-safety (R5) and the full hostile round-trip — D12

The escape-safety guarantee (R5/AC8) is stated transport-agnostically: wherever the song is
emitted, it must not break out of its markup context (no XSS, no injected
`<script>` / `<foreignObject>`) **and** must survive a byte-exact `JSON.parse` round-trip. The
core encoder delivers both:

- Inside the single-quote-delimited `data-wp-context` value, every `<` becomes `<`
  (`</script>` → `<\/script>`, `<!--` → `<!--`), every `"` becomes `"`, and any
  in-payload `'` becomes `'` (JSON_HEX_APOS) — so the first `'` after the opener is the
  true attribute close, which is precisely why single-quote-wrapping + JSON_HEX_APOS is
  breakout-safe.
- The full chain for the hostile song is proven end-to-end: PHP `json_decode(song).metadata.title`
  = the exact author bytes → `piano_block_accessible_name` = `"${HOSTILE_TITLE} by A. Composer"`
  exact → into `$context` → encoder escapes → client `getContext().accessibleName` = byte-exact
  decoded string → `renderInto` sets the `<title>` via `textContent` (inert) → SVG accessible
  name equals `"${HOSTILE_TITLE} by A. Composer"` exactly. Deep-equal:
  `json_decode(outer.song)` equals `json_decode(HOSTILE_SONG)`.

### PHP decodes for the label only — R6 stays intact — D14

`render.php` `json_decode`s the song **only** to read `metadata.title` / `metadata.composer`
for the name; it does **not** gate rendering on the result. `json_decode( $song, true )`
returns `null` on invalid JSON, guarded by `is_array( $decoded )`; no special flags are needed
(default depth 512 is ample; the song is shallow). If decode fails or metadata is absent →
`$metadata = []` → the name falls to the `"Piano sheet music"` (neither) branch — **harmless**,
because the **client** still renders nothing for that song (`validateSong` in `init()` fails →
return), so the name is never shown.

The render-or-nothing decision stays **100% client-side**; PHP computes a label but makes no
render/no-render decision. **No server-side validation is introduced.**

### The documented PHP-trim vs JS-trim parity gap — D15

PHP `trim()` strips only ASCII whitespace; JavaScript `.trim()` also strips Unicode whitespace
(e.g. U+00A0 nbsp, U+2003, U+FEFF). A title padded with non-ASCII whitespace would therefore
trim differently in the PHP frontend name vs the JS editor name. **No e2e is affected** — every
pinned string uses only ASCII spaces, so PHP `trim` ≡ JS `trim` for all asserted cases.

We **accept and document** this rather than code around it: it is out of test scope, cosmetic,
and vanishingly rare; the exact-parity fix (a Unicode-aware
`preg_replace('/^[\s\x{00A0}\x{FEFF}…]+|…$/u', '', …)`) is overkill. The editor name (JS) and the
frontend name (PHP) already diverge only on non-ASCII whitespace — a documentation-phase note.

---

## Validate-once, cached layout, resize reflow, and the 480px breakpoint

### Validate-once + cached-parse, structurally enforced — D16

`init()` runs `validateSong(raw)` **once** and `JSON.parse(raw)` **once** into the closure-local
`data`; `draw` closes over `data` and is pure `buildLayoutModel(data, newWidth) + renderInto` —
no `validateSong`, no `JSON.parse`. Both the first draw and every resize redraw call that same
validation-free closure (exactly as today). `data` lives only in the init closure and is never
re-read from `getContext()` (the song is read once at boot). The defensive "parse inside a
try/catch after a clean validate" **double-guard** is preserved (R6): if a parse unexpectedly
fails after validation passed, the block renders nothing rather than throwing.

The Interactivity API model **structurally guarantees** validate-once: `data-wp-init` is an
empty-deps `useEffect` that runs once on mount and never re-fires; resize is driven by the raw
DOM `ResizeObserver` callback, not by `init`, so `validateSong` / `JSON.parse` cannot re-run on
resize. This is a guarantee by construction, not merely by convention.

### Resize reflow — one-way, rAF-debounced, undefined-guarded — D17

`observeResize` is reused verbatim from today with exactly one addition (`return observer`, and
`undefined` on the no-`ResizeObserver` path). Its three invariants are preserved unchanged:

- **Initial draw is unconditional (R7).** In the D9 sequence, `drawWhenFontReady(draw)` runs
  **before** `observeResize(container, draw)`, so the first draw has already fired before the
  observer-or-no-op decision. Where `ResizeObserver` is undefined, `observeResize` returns
  `undefined` (a no-op) — but the initial draw still happened.
- **rAF debounce (R12).** An in-flight `frame` guard + `requestAnimationFrame` coalesce to ≤1
  redraw per animation frame and suppress the benign "ResizeObserver loop … undelivered
  notifications" warning.
- **One-way (no feedback loop).** The redraw swaps the SVG via `replaceChildren` and never
  writes any width back to the wrapper (the SVG is `max-width:100%;height:auto`), so the
  observer cannot observe its own effect.

The cleanup `return () => observer?.disconnect()` in `init` (D7) uses `?.` to cover the
undefined case.

### The 480px breakpoint via the frozen `availableWidthInSp` — D18

`availableWidthInSp(container)` (frozen `dom.js`) reads `clientWidth`, applies the single
breakpoint — `spPx = (0 < width < 480) ? 7 : 8` (`NARROW_CONTAINER_PX=480`, `NARROW_SP_PX=7`,
`SP_PX=8`) — and returns `width / spPx`. It is called **fresh inside `draw` on every draw**, so
each redraw re-reads the live width and re-evaluates the breakpoint: width < 480 → `spPx=7` →
narrower unit → fewer measures per system → **more** systems. This is exactly AC5's
narrow-container-yields-more-`g[data-system]` behavior. There is exactly one width breakpoint.
Zero width is tolerated (the `0 < width < 480` guard is false at 0 → `spPx=8` → returns 0 → the
layout floors without throwing). Post-paint init means real browsers always have a live width, so
zero-width is a jsdom/edge fallback, not the normal path. The function is called **unchanged**
(frozen) — only *who* calls `draw` changed.

### Why the Interactivity API does not threaten AC5 — D18

The `ResizeObserver` is a raw DOM observer on the wrapper ref, not an Interactivity-API
directive — the runtime has zero hooks into it, so it fires independently of Preact.
`hydrate()` runs **exactly once per island** (guarded by a `hydratedIslands` WeakSet; it is the
runtime's only hydrate call site), there is no re-render / `forceUpdate` / `setState` path, and
with zero child directives nothing in the subtree is reactive — so Preact never re-diffs the
wrapper's children. Therefore the **first** `replaceChildren` and the **Nth** (resize)
`replaceChildren` are all identical, uncontended DOM swaps. This extends the first-draw safety
proof (D11) to the repeated resize redraws. The `expect.poll` test timing is unchanged: the
rAF-debounced redraw is byte-identical to today, the test awaits SVG visibility before resizing,
and the poll re-resolves the `g[data-system]` count after the post-resize `replaceChildren`.

**Guard (same as D11).** This safety depends on the wrapper having no child directives; a future
child directive would require re-examining the repeated-redraw reconciliation.

---

## Multi-block isolation (AC9)

### Isolation is structural — D19

Multi-block isolation has zero cross-talk by construction. Each wrapper carries its own
`data-wp-context` (its own `song` + its own `accessibleName`), seeded per-instance because
`render.php` runs once per block instance. The runtime boots `init` per-instance
(`querySelectorAll('[data-wp-interactive]')` → per-node hydrate → per-node `data-wp-init`
effect), and `getContext()` / `getElement().ref` resolve to the **firing** instance
(per-element scope). The parsed `data`, the observer, `frame`, and `draw` are init-closure
locals (D6) — a fresh closure per invocation — so two instances are two independent closures.

**No shared mutable module-level state:** `observeResize`'s `frame` / `observer` are per-call
locals, not module-level; `store('piano-block/piano', …)` is registered once and shared, but it
is stateless-per-instance (D5 → no `state` bucket; `callbacks.init` is a pure function reading
per-instance scope), so two instances cannot share data through the store object. **The only way
two instances could share a song is if it were put in `wp_interactivity_state()` — which D5
forbids.** The new `view.js` must have zero module-level mutable variables holding per-instance
data.

### The new AC9 test — D20

AC9 is a **new** acceptance criterion (no multi-block coverage exists today). Today every
`render.spec.js` test inserts one block; the AC9 test inserts **two**:

- Insert block A, fill song A (e.g. metadata `{title:"Alpha", composer:"X"}` → "Alpha by X").
- Insert block B, fill song B (e.g. `{title:"Beta", composer:"Y"}` → "Beta by Y").
- Give A and B **different note content** so their SVG trees differ (distinct
  `g[data-system]` / notehead counts), proving each read its own `context.song`.
- Publish. (Each `insertBlock` + Edit-as-JSON + fill targets the just-inserted,
  currently-selected block.)

Assertions: locate both wrappers by the block class; expect two `svg[role=img]`; `svg.nth(0)`
`toHaveAccessibleName("Alpha by X")` and `svg.nth(1)` `toHaveAccessibleName("Beta by Y")` —
each its own name, no leak; and distinct notation trees. This is precisely the
global-state-regression guard the spec wants (AC9 maps R4 + R8): if the song were ever lifted to
`wp_interactivity_state()`, both blocks would render the same notation/name and this test would
fail.

---

## Internationalization (R9) — the floor stays 6.9

### The module-translation caveat is dissolved, not deferred — D21

Because D4 moved **all** accessible-name i18n to PHP (`__` / `_x` / `sprintf` in `render.php`)
and the view module does **no** i18n (no `@wordpress/i18n` import, D3), there are **zero module
strings to translate**. `wp_set_script_module_translations` (a WordPress 7.0 API) is therefore
**irrelevant** — the 6.9-vs-7.0 gotcha is moot, not merely "accepted English-only". That API was
the only reason to consider a floor bump; D4 removes the reason. **The WordPress floor stays at
6.9.**

The PHP `_x` / `__` strings for the `piano-block` text domain localize via standard
**just-in-time** gettext loading: on the first `__` / `_x` with a non-default domain, WordPress
auto-loads `{$domain}-{$locale}.mo` from the registered textdomain path. That path is
auto-registered for this plugin via `block.json`'s `"textdomain": "piano-block"` and the plugin
header `Text Domain: piano-block`, so **no explicit `load_plugin_textdomain` is needed**.
Just-in-time loading has existed since WordPress 4.6, so it works on the 6.9 floor with no
module-translation wiring. R9's string-correctness requirement (the four templates, English
verbatim) holds via PHP.

This outcome is strictly **better** than the spec's two floated options — no English-only
compromise on the module, and no floor bump. *Rejected:* bumping the floor to 7.0 (unnecessary —
D4 removes the motivation), and accepting "English-only on 6.9" (also unnecessary — the PHP path
localizes fully).

**Timing nuance (R12).** WordPress 6.7+ emits a "Translation loading … triggered too early"
`_doing_it_wrong` warning if `__()` runs before `after_setup_theme`. `render.php` runs during
post render (well after `init` / `after_setup_theme`), so the PHP `_x()` there is safe — no
early-load warning. The name helper is only ever called inside `render.php` per request (late),
never at plugin-load time.

### `piano-block.php`'s only change — D22

The sole change is **deleting the dead `wp_set_script_translations` call**. That call targets the
classic view-script handle `piano-block-piano-view-script`, which ceases to exist once
`viewScript` → `viewScriptModule` (no classic script is registered), and it pointed at a
non-existent `__DIR__ . '/languages'` dir — so it was already a no-op for the module path; per R9
it must be removed.

`register_block_type( __DIR__ . '/build' )` is **unchanged** — it reads the built `block.json`
and auto-registers + auto-enqueues the `viewScriptModule` when the block renders; nothing is added
manually, and `wp_register_script_module()` must **not** be called (R10 / AC14). No
`load_plugin_textdomain` is needed (the block textdomain registry already covers the
just-in-time path). The PHP name helper `piano_block_accessible_name()` (D13) may live here or in
`render.php`. Result:

```php
function piano_block_register() {
    register_block_type( __DIR__ . '/build' );
}
add_action( 'init', 'piano_block_register' );
```

---

## Test impact

### The two e2e changes; everything else unchanged — D23

Only **two** e2e changes; every other assertion in `render.spec.js` passes unchanged because the
others assert the final SVG, the empty/childless wrapper, node attributes, or `innerText` —
never the carrier.

- **Reworked AC8 transport sub-check** (D15a, below) — the *only* assertion that reads raw HTML.
- **New AC9 multi-block test** (D20).

Subtle risks checked and clear:

- **AC6** ("no wrapper for empty") holds — `render.php` early-returns on `'' === trim($song)`
  *before* the `json_decode`/name code, so empty never reaches it.
- **AC7** (invalid JSON, structurally non-conformant) holds — `json_decode` on garbage returns
  `null` cleanly (guarded by `is_array`), so the name falls to `"Piano sheet music"` and the
  wrapper is still emitted (childless, no fatal); the client `validateSong` then fails → no SVG →
  zero `blockSvg`.
- **AC7 `innerText === ""`** holds — the route-B wrapper is a childless `<div>` with only
  attributes; `innerText` returns visible text only (attribute values are not `innerText`), so it
  is `""` both on the raw server HTML and after a failed client render.
- **`editor.spec.js`** is untouched (AC15).

### "No raw JSON echo" survives the transport move — D24

AC1 / AC12's `expect(blockText).not.toContain('"sections"' / '"timeSignature"')` reads
`innerText`, which excludes attribute values — so the song now living in the `data-wp-context`
attribute does not appear in `innerText` (just as the old `<script>` body did not). The **only**
assertion that reads raw HTML (where the song does appear, now in the attribute) is the AC8
transport sub-check, which is being reworked anyway. No other test greps raw HTML for song
substrings.

### AC8 transport sub-check rework (concrete) — D15a

The literal carrier-`<script>` locator disappears; the sub-check parses the wrapper's
`data-wp-context` attribute from the raw server HTML. Reworked assertions:

- **Locate** `data-wp-context='` in the fetched raw HTML (`page.request.get`) and slice the value
  to the next `'` — safe because the encoder escapes any in-payload `'` to `'` (JSON_HEX_APOS),
  so the first `'` after the opener is the true attribute close.
- **Escape-safety:** assert the value **contains** the escaped `<\/script` and `<!--`,
  and **does not contain** a literal `</script>`, a literal `<!--`, or a literal `'`. (In JS test
  source, the needle for an escaped `<` is the six characters `<`, written `'\\u003C'`.)
- **Byte-exact round-trip:** `const ctx = JSON.parse( attrValue )` (outer), then
  `expect( JSON.parse( ctx.song ) ).toEqual( JSON.parse( HOSTILE_SONG ) )` (inner deep-equal), and
  optionally `expect( ctx.accessibleName ).toBe( \`${HOSTILE_TITLE} by A. Composer\` )`.
- The AC8 **render / inert / no-XSS** assertions (the final SVG, `<title>`, annotation text) are
  **unchanged** — they assert the rendered output, not the carrier.

### Unit tests are unaffected; no new `view.js` unit test — D25

No unit test imports `view.js`, so the rewrite causes zero unit-test breakage. `svg.test.js`
imports the frozen `layout.js` + `svg.js` and stays valid unchanged; all notation/song and editor
unit tests are untouched (R13 / AC15). **No new `view.js` unit test is expected** — `view.js` was
never unit-tested (it is the integration/wiring layer; `render.spec.js` is its contract, exactly
as today). A Jest test for `init()` would require mocking the Interactivity API runtime
(`store` / `getContext` / `getElement`) — high-friction, low-value, and not how `view.js` was
covered before. The e2e suite already pins boot (AC1/8/9) and resize (AC5).

### Build/test workflow — D26

`wp-scripts test-playwright` does **not** auto-build: the Playwright config's `webServer.command`
boots wp-env (which serves the plugin's `build/` via `register_block_type(__DIR__ . '/build')`)
and `globalSetup` only logs in. So the build must run before e2e, and `npm run build` must carry
`--experimental-modules` (D2) or the view module is never built → nothing hydrates → e2e fails.
Jest does **not** need the flag (it Babel-transforms `src/` directly, mocks `@wordpress/*`
including a local `@wordpress/i18n` mock, and never reads `build/`). `test:e2e` and `test:unit`
scripts are unchanged. No `.github/workflows` dir exists, so there is no CI to update (a future CI
must run the flagged build before e2e).

**One documentation drift flagged (not a code/test change):** today's comment in
`render.spec.js` (~lines 554–555) describes the wrapper as carrying the inert JSON `<script>`
carrier — stale under route B (the wrapper now carries `data-wp-context` and no script). The
*assertion* is unaffected; only the comment is inaccurate. This is a doc-phase note.

---

## File-change manifest (in scope)

- **`src/block.json`** (D1) — drop `"viewScript"`; add `"viewScriptModule": "file:./view.js"` and
  `"supports": { "interactivity": true }`.
- **`src/render.php`** (D12–D15) — route-B rewrite: keep the `'' === trim($song)` early return;
  compute the accessible name in PHP (`piano_block_accessible_name`); seed
  `wp_interactivity_data_wp_context([ 'song' => $song, 'accessibleName' => $name ])`; emit a
  childless wrapper with `data-wp-interactive="piano-block/piano"`, `data-wp-init="callbacks.init"`,
  and `get_block_wrapper_attributes()`; drop the carrier `<script>` and the hand-rolled
  `str_replace('<', '<', …)`.
- **`src/view.js`** (D3, D5–D11, D16–D19) — rewrite from a `domReady` boot into
  `store('piano-block/piano', { callbacks: { init() {…} } })`. `init` reads `{ song, accessibleName }`
  from `getContext()` and `container` from `getElement().ref`, validates once, parses (defensive
  try/catch), builds the `draw` closure (frozen core calls), font-gates the first draw
  (`drawWhenFontReady`), attaches `observeResize` (module helper, now returning the observer), and
  returns a disconnect cleanup. Remove the `@wordpress/dom-ready` import, the `@wordpress/i18n` path
  (via `accessibleNameFor`), the `SONG_SCRIPT_CLASS` carrier read, and the manual `querySelectorAll`
  boot. `view.js` imports **only** `@wordpress/interactivity` (plus relative notation/song modules).
- **`piano-block.php`** (D13, D22) — remove the dead `wp_set_script_translations` call; keep
  `register_block_type( __DIR__ . '/build' )`; optionally host `piano_block_accessible_name()`.
- **`package.json`** (D2, D26) — add `--experimental-modules` to the `build` and `start` scripts.
- **`specs/render.spec.js`** (D15a, D20, D23) — rework the AC8 transport sub-check to parse the
  `data-wp-context` attribute; add the AC9 two-block isolation test.

### Out of scope / frozen (unchanged)

The notation core (`layout.js`, `svg.js`, `dom.js`, `glyphs.js`, `constants.js`), the song
format/validator (`validate.js`, `schema.js`, `normalizeStep.js`), `accessibleName.js` (still
serves the editor and is the JS authority the PHP helper mirrors), all notation/song/editor unit
tests including `svg.test.js`, `specs/editor.spec.js`, and the editor entry
(`index.js` / `edit.js` / `editor/*`). No server-side SVG pre-render, no `save` implementation, no
client-side navigation / router region, and **no converting the notation SVG into directives** (the
imperative carve-out is preserved). The one stale comment in `render.spec.js` (~554–555) is a
documentation-phase note, not a code change.

---

## Trade-offs and alternatives rejected (consolidated)

- **Server-compute the accessible name (D4)** vs override externalization (B, would 404 at runtime)
  vs bundle `@wordpress/i18n` (C, adds a dependency, ships i18n in the module, diverges from core).
  Server-compute is cleaner on every axis and folds into the route-B transport. **Cost:** the
  four-branch logic now exists in two languages (PHP frontend, JS editor), kept in lockstep by the
  shared contract and the e2e pins (D13); and a documented ASCII-vs-Unicode `trim` parity gap on
  non-ASCII whitespace, out of test scope (D15).
- **The `--experimental-modules` build flag (D2)** vs a hand-rolled multi-config `webpack.config.js`
  (more custom code, no benefit) vs leaving scripts unchanged (module never builds). The flag is the
  supported, core-aligned path. **Cost:** an "experimental"-named flag in two npm scripts.
- **Callbacks-only store, context-only data, init-closure runtime objects (D5–D7)** vs
  `wp_interactivity_state()` for the song (would make two pianos share one song — the AC9 regression)
  vs derived getters (nothing consumes them) vs the parsed song / observer on context (unwanted
  proxification + non-serializable pollution) vs a module-level `WeakMap` (unnecessary while one
  callback owns the lifecycle). The chosen shape is the idiomatic minimum and the foundation future
  `actions` extend without restructuring.
- **Single `data-wp-init` (D7/D10)** vs splitting resize into `data-wp-watch` (nothing for a watch to
  react to — resize is DOM-driven, not signal-driven) vs inlining `observeResize` into `init` (bloats
  the callback). Single init owning the lifecycle, with `observeResize` as a module helper, is
  cleanest.
- **The imperative-SVG carve-out (D11)** vs converting the notation to directives (out of scope,
  breaks the test-pinned tree, and infeasible for a large dynamic positional tree). The carve-out is
  provably safe under hydration **as long as the wrapper has no child directives** — the standing
  guard for any future change (with `data-wp-ignore` as the noted escape hatch).
- **Route-B context transport (D12)** vs keeping the inert `<script>` carrier (would still need a
  hand-rolled escape and would not give the store ownership of the song as reactive state). Route B
  gives the store the song as reactive, mutable per-instance state and a stronger core encoder.
  **Cost:** the AC8 sub-check reads an attribute instead of a script body (D15a).
- **Floor stays 6.9 (D21)** vs bumping to 7.0 for `wp_set_script_module_translations` (unnecessary —
  D4 leaves no module strings) vs accepting English-only on the module (also unnecessary — the PHP
  path localizes fully). D4 dissolves the caveat entirely.

---

## Requirements → decisions traceability

- **R1** (becomes an Interactivity API block) → D1, D7, D8.
- **R2** (observable output parity) → D11, D12 (childless wrapper, `get_block_wrapper_attributes`).
- **R3** (accessible-name parity) → D4, D13.
- **R4** (per-instance context transport) → D5, D12, D19.
- **R5** (escape-safety) → D12 (core encoder, superset escape).
- **R6** (client-side validate-once gate) → D9, D14, D16.
- **R7** (responsive reflow) → D17, D18.
- **R8** (per-instance isolation) → D6, D8, D19.
- **R9** (i18n correctness on the module) → D3, D4, D21.
- **R10 / AC14** (WordPress-only dependency invariant) → D3, D22.
- **R11** (best-effort font gate) → D9 (`drawWhenFontReady` unchanged).
- **R12** (no new console errors/warnings) → D7 (cleanup), D17 (rAF debounce), D21 (no early-load).
- **R13** (notation core / song format / build-test workflow unchanged) → all frozen-module calls;
  D25, D26.
- **AC1 / AC2 / AC12 / AC3 / AC5 / AC10 / AC11 / AC13** → frozen notation/song core called unchanged
  (D9, D16–D18) — every existing assertion passes.
- **AC6 / AC7** → D12, D14, D23 (route-B `render.php` preserves the empty / invalid / non-conformant
  render-nothing states).
- **AC8** → D12 (render/inert/no-XSS unchanged) + D15a (reworked transport sub-check — the one
  changed assertion).
- **AC9** (new, multi-block isolation) → D19, D20.
- **AC15** (unit + editor suites unaffected) → D25 and the frozen fence.
