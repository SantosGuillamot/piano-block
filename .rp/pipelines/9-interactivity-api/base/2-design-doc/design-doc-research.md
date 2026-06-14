# Design Research — Move the Piano block's frontend JS to the Interactivity API (issue #9)

This document records the iterative design Q&A between the design-doc-analyst and the
design-doc-researcher, plus the architecture decisions reached. It captures **how** the
spec's pinned behavior is realized on the WordPress Interactivity API — the store shape,
the boot/lifecycle wiring, the song transport, the i18n path, and the test impact. The
spec (binding contract) and spec-research (evidence) are the inputs; this is the design.

## Framing (carried in from the spec)

- **Frontend-only migration.** The block editor, the notation rendering core
  (`layout.js`/`svg.js`/`dom.js`/`glyphs.js`/`constants.js`), and the song
  format/schema/validator are FROZEN. The design may call into the notation core's
  existing API (`buildLayoutModel`, `renderInto`, `availableWidthInSp`,
  `drawWhenFontReady`, `accessibleNameFor`, `validateSong`) but must not change those
  modules.
- **The imperative-SVG carve-out is the load-bearing design guard.** The SVG body is built
  imperatively in `svg.js` (`createElementNS` + `container.replaceChildren`); the spec
  explicitly authorizes this as an accepted exception to the directives-only ideal,
  analogous to the API's `.focus()` allowance. The Interactivity-API win for this block is
  ownership of **boot, lifecycle, and state** — NOT declarative rendering of the notation.
  The store decides *when and with what data* the SVG is (re)built; the imperative emit is
  unchanged.
- **Parity baseline is the existing e2e suite** (`specs/render.spec.js`). Every existing
  assertion must keep passing except the AC8 transport sub-check (reworked for the
  `data-wp-context` transport), plus one new multi-block AC9.

## Files in scope

- `src/block.json` — registration fields (`viewScript` → `viewScriptModule`,
  `+ supports.interactivity`).
- `src/render.php` — add `data-wp-interactive` + seed `data-wp-context`; drop the inert
  carrier `<script>`.
- `src/view.js` — rewritten from a `domReady` boot into an Interactivity API store.
- `piano-block.php` — the dead classic-handle `wp_set_script_translations` call.

---

## Q&A log

### Q1 — Script-module migration mechanics

**Question.** Ground-truth on how `viewScript` → `viewScriptModule` actually works with this
toolchain: (1) the exact `block.json` shape and whether `supports.interactivity: true`
(boolean) is right; (2) whether `wp-scripts build` auto-bundles the view module with no
config change; (3) `@wordpress/interactivity` externalization and whether anything else needs
special handling as a module dependency; (4) the store namespace.

**Researcher findings (all from real `wp-scripts build` experiments in-repo + reading
wp-scripts 32.3.0 / DependencyExtractionWebpackPlugin (DEWP) source / WP core view modules).**

1. **`block.json` shape.** Drop `viewScript`; add `viewScriptModule: "file:./view.js"`; add
   `supports: { "interactivity": true }`. Boolean `true` is the correct form here — it is
   shorthand for `interactive: true` + client-navigation compatibility, enables the Server
   Directive Processor (SDP) for the block, and tags the view module. The object form
   (`{ "interactive": false, "clientNavigation": true }`) is only for the non-interactive
   carve-out, which this block is not. (Evidence: `server-rendering.md:21-27`; iAPI hard
   rule 1.) Note: `supports.interactivity` enables SDP but does **not** build the module —
   `viewScriptModule` is the field that builds `view.js`.

2. **wp-scripts builds the module — but needs a CLI flag on 32.3.0.** wp-scripts runs two
   webpack passes: a `script` pass and a `module` pass. The module pass is **gated** behind
   `--experimental-modules` (`webpack.config.js:431`: `if (hasExperimentalModulesFlag)
   { module.exports = [scriptConfig, moduleConfig] }`), set via
   `WP_EXPERIMENTAL_MODULES=true`. **Proven:** plain `wp-scripts build` (no flag) on a
   `block.json` with `viewScriptModule` → "No entry file discovered" → `view.js` NOT built.
   With `--experimental-modules` → `view.js` built as a real ESM module. The
   `moduleFields = Set(['viewScriptModule','viewModule'])` routing lives in
   `@wordpress/scripts/utils/block-json.js`.
   - **Module output shape (proven):** `build/view.js` is real ESM
     (`import{getContext as o,store as t}from"@wordpress/interactivity";…`), and
     `build/view.asset.php` is
     `array('dependencies' => array('@wordpress/interactivity'), 'version' => '…', 'type' => 'module')`
     — note `'type' => 'module'` and the script-**module** id `@wordpress/interactivity`
     (not a classic `wp-` handle). Contrast the current classic build:
     `array('dependencies' => array('wp-dom-ready','wp-i18n'), 'version' => …)`, IIFE not ESM.

3. **`@wordpress/interactivity` externalizes clean; `@wordpress/i18n` in the module is a HARD
   BUILD BLOCKER.** DEWP's `defaultRequestToExternalModule` allowlist is tiny — only
   `@wordpress/interactivity` (static import), `@wordpress/interactivity-router` (dynamic),
   and `@wordpress/a11y` (dynamic). **Any other `@wordpress/*` script imported into the module
   throws** at build:
   `Attempted to use WordPress script in a module: @wordpress/i18n, which is not supported yet.`
   **Proven:** a `view.js` importing `@wordpress/i18n` → module build errors with that exact
   message → `view.js` not emitted. This block hits it because the frozen
   `src/song/accessibleName.js:7` does `import { __, _x, sprintf } from "@wordpress/i18n"`, and
   `view.js` calls `accessibleNameFor()` → pulls `@wordpress/i18n` transitively into the module
   graph → module build breaks. (`@wordpress/dom-ready`, imported by today's `view.js:21`, would
   throw the same way — but it goes away in the migration since iAPI owns boot.) WP core view
   modules confirm the pattern: none import `@wordpress/i18n`; their `view.asset.php`
   dependencies are `array()` (only `@wordpress/interactivity`). Core view modules either SSR
   their i18n text in PHP or don't i18n in the module.

4. **Namespace.** Must be exactly `piano-block/piano` (the block name), identical in
   `render.php` `data-wp-interactive="piano-block/piano"`, `store("piano-block/piano", …)`, and
   any `wp_interactivity_data_wp_context(..., "piano-block/piano")` /
   `wp_interactivity_state("piano-block/piano", …)`. The namespace param to
   `wp_interactivity_data_wp_context()` is optional (defaults to the wrapper's
   `data-wp-interactive`), so it can be omitted. (Evidence: iAPI hard rule 2; `directives.md:29`;
   WP core `core/search` uses `data-wp-interactive="core/search"` verbatim.)

**Decisions reached from Q1.**

**D1 — Registration.** `block.json`: drop `viewScript`, add `"viewScriptModule":
"file:./view.js"` and `"supports": { "interactivity": true }`. The namespace `piano-block/piano`
is used verbatim in `data-wp-interactive`, `store()`, and the context seed.

**D2 — Build requires the `--experimental-modules` flag (a real, surfaced change).** On
wp-scripts 32.3.0 the npm scripts must become `"build": "wp-scripts build
--experimental-modules"` and `"start": "wp-scripts start --experimental-modules"`. This is the
one place the spec-research's "no test-runner / bundler changes needed" note is imprecise: the
build *input* (declaring `viewScriptModule`) is enough conceptually, but on this toolchain
version the module pass is opt-in via the flag, so `package.json` scripts change. *Trade-off:*
the flag is "experimental" in name, but it is the supported way to build view modules on 32.3.0
and is exactly what WP core blocks use; the alternative (hand-rolling a `webpack.config.js`
multi-config) is more custom code for no benefit. Rejected: leaving the scripts unchanged
(module never builds → nothing hydrates).

**D3 — The view module imports ONLY `@wordpress/interactivity` from `@wordpress/*`.** No
`@wordpress/i18n`, no `@wordpress/dom-ready`, in the module graph. `@wordpress/dom-ready` is
dropped (iAPI owns boot). The `@wordpress/i18n` collision (frozen `accessibleName.js`) forces
the accessible-name computation off the client — resolved in **D4** below. This keeps
`view.asset.php` dependencies at exactly `array('@wordpress/interactivity')`, the purest form
of R10/AC14, and `@wordpress/interactivity` is never added to `package.json` nor manually
registered in `render.php`.

**D4 — Compute the accessible name on the SERVER (`render.php`) and seed it into per-instance
context (researcher's option A).** This is the load-bearing fork surfaced by Q1. Because
`@wordpress/i18n` cannot live in the view module, the four-branch accessible-name string is
computed in `render.php` with PHP `__()` / `_x()` / `sprintf()` (the exact same four branches,
text domain `piano-block`, and `_x` context `'sheet music label'` as `accessibleName.js`), and
seeded into the wrapper's `data-wp-context` alongside the song (e.g.
`wp_interactivity_data_wp_context([ 'song' => $song, 'accessibleName' => $name ])`). The view
module reads `getContext().accessibleName` and passes it straight into `renderInto(container,
model, { accessibleName })` — it never imports or calls `@wordpress/i18n`.
   - **Why this satisfies R3/R9.** R3 pins the *strings* (the four branches, the verbatim
     un-wrapped title-only branch, the `_x`/`__`/`sprintf` i18n behavior, correct English
     verbatim) — not the *language* they are computed in. PHP `__`/`_x`/`sprintf` are core
     functions available at render time and produce byte-identical English output to the JS
     path (both just fill the template; no translation files exist today — confirmed: no
     `languages/` dir). The e2e-pinned strings `"Example by A. Composer"` and
     `"Pwn </script>… by A. Composer"` (`render.spec.js:166,501,670`) come out identical. R9's
     requirement that the strings render correctly "when the block runs as a view *module*" is
     satisfied because the module receives the already-correct string via context.
   - **Why this is the right call, not just the easy one.** It (a) dodges the hard build blocker
     with zero custom webpack config; (b) matches the established WP-core view-module pattern
     (SSR the i18n text, keep the module dependency-free); (c) is the purest R10/AC14 (module
     imports only `@wordpress/interactivity`); (d) leaves the frozen `accessibleName.js`
     untouched and still used by the editor; and (e) folds naturally into the route-B context
     transport (the name rides in the same `data-wp-context` as the song). It also resolves the
     R9 module-translation caveat cleanly: since the string is computed in PHP, it localizes via
     the **plugin's normal PHP gettext** (the `.mo`/`.po` path that already works on the 6.9
     floor), so the `wp_set_script_module_translations` 7.0-vs-6.9 gotcha never applies to this
     block — see Q6 for the full i18n decision.
   - **Subtlety the design must honor.** The accessible name is per-instance untrusted free
     text, so it must ride through the context encoder (which escapes it — R5/AC8), and
     `renderInto` already sets it via `textContent` (inert), so hostile bytes stay literal text
     in the `<title>`. Computing it in PHP does **not** introduce SSR of the SVG — only the
     *name string* is server-computed; the SVG is still drawn entirely on the client. The
     render-or-nothing gate stays client-side (`validateSong` in the module), so a non-renderable
     song still draws nothing even though `render.php` may have computed a name. (If the song
     is empty/whitespace, `render.php` already emits no wrapper at all, so no name is computed
     for that case anyway.)
   - **Alternatives rejected.** (B) Override `requestToExternalModule` to allow `@wordpress/i18n`
     as a module — not viable: WP does not serve `@wordpress/i18n` as a script module, so it
     would 404 at runtime. (C) Bundle `@wordpress/i18n` into the view module (add to
     `package.json`, `WP_NO_EXTERNALS`/custom externals) — works but adds a dependency the repo
     does not install today (only `@wordpress/icons` is a dep), ships i18n code in the module,
     and runs against the "externalize WP packages, don't bundle them" grain; strictly it still
     imports only `@wordpress/*` so R10's letter holds, but it is messier and diverges from core.
     Option A is cleaner on every axis.

### Q2 — Store shape (state vs per-instance context vs module scope)

**Question.** With D4 settled (no i18n in the module), nail the data model: (1) what lives in
per-instance `getContext()` and whether any `wp_interactivity_state()` / derived getters are
needed; (2) where the per-instance NON-serializable runtime objects (the parsed-and-validated
song cache, the `ResizeObserver`, the rAF frame guard, the `draw` closure) live; (3) the
`store()` bucket structure (state / actions / callbacks).

**Researcher findings (verified against the `@wordpress/interactivity` runtime source — v6.29.0
un-minified `build-module` — plus WP core blocks and the iAPI ref).**

1. **`getContext()` carries exactly `{ song, accessibleName }`** — both server-seeded strings via
   `wp_interactivity_data_wp_context([ 'song' => …, 'accessibleName' => … ])`, both per-instance,
   never shared. **Nothing else needs seeding.** iAPI hard rule 4 ("seed every reactive value
   before JS runs") exists so SDP can render directives that *read* state/context — but here NO
   directive binds state→DOM (the SVG is the imperative carve-out, no `data-wp-text`/`data-wp-bind`
   reads the song or name), so **SDP has nothing to pre-render**. Consequences: no derived-state
   getters (they exist only to feed directives/SDP), and **no `wp_interactivity_state()` at all**
   (state is for cross-instance/SDP values; neither applies). Only seed what the boot callback
   reads: `song` + `accessibleName`. The hard-rule-4 "seed even empty values" caveat does not bite,
   because `render.php` only emits the wrapper when the song is non-empty (`render.php:32-34` early
   return), so whenever the wrapper exists both `song` and `accessibleName` are present.

2. **Per-instance runtime objects live as CLOSURES inside the single `data-wp-init` callback —
   NOT in context.** The decisive evidence is the runtime's proxy rule (`proxies/registry.js:15`:
   `const supported = new Set([Object, Array])`; `shouldProxy` returns true only when
   `supported.has(candidate.constructor)`): only plain Objects/Arrays get the reactive
   signals proxy and deep descent; any other constructor (a `ResizeObserver`, a DOM element) is
   stored as an opaque leaf. So:
   - A parsed song object (constructor `Object`) put on context **would be deeply proxified** —
     unwanted reactive overhead for a read-only post-validate cache, and it pollutes the
     conceptually-serializable context with client-only data (a future `actions.navigate()`
     server-merge could surprise it).
   - A `ResizeObserver` on context is stored as an opaque leaf (safe) but semantically wrong —
     context is "serializable per-instance state", an observer is not state.
   - **The canonical pattern is closures in the init callback:** `data-wp-init` runs once per
     instance on mount (`useInit = useEffect(fn, [])`), and `getElement().ref` gives that
     instance's wrapper. Declaring `let parsed`, `let frame`, `const observer`, `const draw` as
     locals inside `init()` gives automatic per-instance isolation with zero context pollution.
     (Confirmed against Gutenberg's fit-text approach: a `data-wp-init`/`data-wp-watch` creates a
     `ResizeObserver` in a closure and returns a cleanup that disconnects it.) A module-level
     `WeakMap<Element, {…}>` keyed by `getElement().ref` is the fallback **only** if the lifecycle
     is split across multiple callbacks that must share the same observer/parsed handle — overkill
     when one init callback owns everything.

3. **`store()` is `callbacks`-only.** No `state` bucket (nothing global/shared, nothing SDP
   renders — per #1). No `actions` bucket (actions are for `data-wp-on--*` user events; this block
   has no user interaction yet — it is a render pipeline, not interactive UI). The whole
   boot/lifecycle lives in `callbacks.init`, wired via `data-wp-init` on the wrapper. **Cleanup
   contract confirmed from source** (`hooks` directive processing: a `data-wp-init` callback whose
   return value is a function is registered as the `useEffect` teardown and runs on unmount), so
   `init()` returning `() => observer?.disconnect()` is the correct teardown — it matters for R12
   (clean console / no leaks) and for SPA/`navigate` unmount even though a single-page hydrate
   rarely unmounts.
   - **Single `data-wp-init` vs splitting resize into `data-wp-watch`:** single init is the right
     fit. `data-wp-watch` re-runs when the state/context it *reads* changes; but resize is driven
     by the DOM `ResizeObserver`, not by a context/state signal, so there is nothing for a watch to
     react to. The observer is an imperative side-effect that init sets up once. A `data-wp-watch`
     would only earn its place if a future feature made the redraw react to a context signal (e.g.
     a note-input action mutating `context.song`) — out of scope now. (Lifecycle wiring detailed in
     Q3.)

**Decisions reached from Q2.**

**D5 — `getContext()` carries exactly `{ song, accessibleName }`; the store has no `state` and no
`wp_interactivity_state()`.** Both values are per-instance server-seeded strings in the wrapper's
`data-wp-context`. There are no derived getters and no global state, because no directive binds
state→DOM (the SVG is the imperative carve-out, so SDP has nothing to pre-render). *Trade-off:*
this leans on the carve-out — if a future feature directive-binds any notation detail it would need
seeded state, but that is explicitly out of scope. Rejected: seeding into `wp_interactivity_state()`
(would make two pianos share a song — the exact AC9 regression) and adding derived getters (nothing
consumes them).

**D6 — Per-instance runtime objects are closures in the `data-wp-init` callback, never in
context.** The parsed-and-validated song, the `ResizeObserver`, the rAF frame guard, and the `draw`
closure are all locals inside `init()`. This is dictated by the runtime proxy rule (only
plain Object/Array get proxied; everything else is an opaque leaf) and matches the WP-core idiom.
*Trade-off:* the parsed song cache is therefore not reactive — correct here (validate-once, then
read from cache on every redraw; R6), and it keeps context clean of client-only, non-serializable
data. Rejected: stashing the parsed object on context (unwanted proxification + context pollution)
and a module-level `WeakMap` (unnecessary while one callback owns the whole lifecycle).

**D7 — `store('piano-block/piano', { callbacks: { init() {…} } })` — callbacks-only.** No `state`,
no `actions`. The single `callbacks.init`, wired via `data-wp-init` on the wrapper, owns the entire
boot+lifecycle and returns a cleanup that disconnects the observer. This is the idiomatic shape for
a no-user-interaction render block and is the foundation onto which future audio/note-input
`actions` can be added without restructuring. (The internal sequence of `init` — validate-once →
font-gated first draw → observe resize — is decided in Q3.)

### Q3 — Boot/lifecycle wiring and the imperative-SVG carve-out (the core)

**Question.** Map today's `domReady` → `querySelectorAll` → `setupContainer` → `drawWhenFontReady`
→ `observeResize` sequence onto the iAPI model: (1) how `data-wp-init` replaces the manual boot; (2)
the exact sequence inside `init()` and where `observeResize` lives; (3) the imperative-SVG carve-out
wiring and what SDP emits for the (childless) wrapper; (4) whether Preact's hydration reconciliation
can clobber the imperatively-injected SVG — the load-bearing safety check.

**Researcher findings (proven from the `@wordpress/interactivity` v6.29.0 runtime source:
`vdom.js`, `init.js`, `hooks.js`, `directives.js`, `scopes.js`, `utils.js`).**

1. **`data-wp-init` replaces `domReady` + `querySelectorAll`.** The runtime itself does the discovery
   and per-instance boot: `init.js` runs `document.querySelectorAll('[data-wp-interactive]')` and, per
   node, `hydrate(toVdom(node), …)`. So `view.js`'s `domReady`, its
   `document.querySelectorAll('.wp-block-piano-block-piano')`, and the boot loop all disappear (and the
   `@wordpress/dom-ready` import goes away, which it must — it can't be in a module build either). The
   wrapper carries `data-wp-interactive="piano-block/piano"` +
   `wp_interactivity_data_wp_context([song, accessibleName])` + `data-wp-init="callbacks.init"`. `init`
   runs **once per instance** (`useInit = _useEffect(withScope(cb), [])` — empty-deps effect).
   `getElement().ref` (`scopes.js:66-81` → `ref.current`) is the live wrapper element to render into,
   and is **non-null** inside `data-wp-init` (unlike `data-wp-run`, where `ref` is null on first
   render). **Timing:** `useEffect` runs *after* browser paint, so when `init` fires the wrapper is
   mounted, painted, and in the live DOM → `container.clientWidth` is live and measurable, so
   `availableWidthInSp(container)` reads the correct width at boot (the jsdom zero-width tolerance still
   applies as a fallback).

2. **The `init()` sequence maps ~1:1 to today's `setupContainer`, with three changes** (song + name
   come from context, no `domReady`, no `accessibleNameFor()` call):

   ```js
   init() {
     const { ref: container } = getElement();
     const { song: raw, accessibleName } = getContext();   // D4/D5 — no accessibleNameFor()
     if ( validateSong( raw ).length > 0 ) return;         // validate-ONCE gate (R6) — FROZEN
     let data;
     try { data = JSON.parse( raw ); } catch { return; }   // defensive parse double-guard (R6)
     const draw = () => {
       const model = buildLayoutModel( data, availableWidthInSp( container ) ); // FROZEN
       renderInto( container, model, { accessibleName } );                      // FROZEN — carve-out write
     };
     drawWhenFontReady( draw );                       // FROZEN — font-gate + immediate fallback (R11)
     const observer = observeResize( container, draw ); // resize wiring (module helper)
     return () => observer?.disconnect();             // cleanup (D7)
   }
   ```

   `validateSong`, `buildLayoutModel`, `renderInto`, `availableWidthInSp`, and `drawWhenFontReady` are
   all called **unchanged** (frozen notation/song core — R13); only the caller (`view.js`) is
   rewritten. The parsed `data` is cached in the closure so resize redraws reuse it with no
   re-validation (validate-once, R6). `accessibleName` comes from `getContext()` (D4), so
   `accessibleNameFor()` is never called on the frontend → `@wordpress/i18n` is never pulled into the
   module (the Q1 blocker is dodged), and `accessibleName.js` stays frozen and still serves the editor.

   - **`observeResize` placement.** Keep it a **module-level private helper** in the new `view.js`,
     called from `init()` and returning the observer (or its disconnect handle). This keeps `init()`
     readable, isolates the rAF-debounce + `ResizeObserver`-undefined guard, and keeps `frame` /
     `observer` as `observeResize`-local closures (D6). Inlining into `init` also works but bloats the
     callback; the module-helper shape is cleaner for a callbacks-only store. (`observeResize` lives in
     `view.js` today, which is the file being rewritten — it is not part of the frozen core.)

3. **The carve-out wiring is authorized and store-driven; SDP emits a childless directive-only div.**
   `draw` → `renderInto(container, model, { accessibleName })` → `container.replaceChildren(svg)`
   (`svg.js:275-279`, frozen). `replaceChildren` is **not** `innerHTML` — it appends already-built DOM
   nodes (from `createElementNS`), with no HTML parsing or string injection — so it does not trip iAPI
   hard rule 11 (which bans `innerHTML` and `addEventListener`/`classList`/`style` writes). It is the
   explicitly-authorized carve-out (spec lines 37–54), analogous to the allowed `.focus()` write, and
   the store **drives** it: `init` decides *when* (post-mount, font-ready, on resize) and *with what*
   (parsed song + server-computed name); the emit is only the mechanism.
   - **What SDP emits:** under route B the inert carrier `<script>` is dropped (Q4), so `render.php`
     emits `<div data-wp-interactive data-wp-context data-wp-init {wrapper attrs}></div>` — a wrapper
     with directives but **no child directives and no children**. SDP processes only directives; with
     no child directives it emits the div with its attributes and **empty content** — no server-side
     child rendering, no flash (there is nothing to flash; the wrapper already ships visually empty
     today via the invisible carrier, and under route B even that is gone).
   - `replaceChildren` on the empty wrapper is correct: zero children to clear, then append the SVG —
     the same DOM op today's resize redraws already perform repeatedly.

4. **Reconciliation is PROVABLY safe — Preact will not clobber the injected SVG.** This is the
   whole carve-out's safety, proven from runtime source:
   - **`toVdom` snapshots children at hydration** (`vdom.js` `walk`): it tree-walks the wrapper's DOM
     at hydrate time. An empty wrapper (route B) → no element children → `children = []` →
     `h('div', props, [])`. The wrapper's vdom records **empty** children.
   - **Children with no directives are not reactive** (`hooks.js`): the `Directives` component wraps
     only elements that carry directives; a child with no `data-wp-*` is a plain pass-through vnode
     with no reactive scope, no signal subscription, and never independently re-renders. Route B has
     **zero** child directives.
   - **Mutating context does not re-render the wrapper's children** (`directives.js` context handling):
     `data-wp-context` wraps children in a Provider whose `contextStack` is `useMemo`'d on values fixed
     at hydration; mutating `context.song` flows through the signals proxy to whatever directive
     *reads* it (none here), not by re-rendering the Provider. The `children` handed to the Provider
     are the stable `toVdom` snapshot (`[]`).
   - **Net:** after `hydrate()` runs once, Preact has no reactive trigger to ever touch the wrapper's
     child DOM again, so `init`'s `replaceChildren(svg)` injects DOM Preact does not track and will not
     reconcile away; resize redraws are equally safe.
   - **Ordering (no race):** `init.js` splits hydration with `await splitTask()` and a
     `setTimeout(resolve, 0)` so stores are registered before hydrate; `data-wp-init` (a post-commit
     `useEffect`) fires **after** hydrate completes. Deterministic sequence: store registered →
     hydrate(empty wrapper) → `init` runs → `replaceChildren(svg)`. No race where `init` draws before
     hydrate or where hydrate wipes a drawn SVG.
   - **Escape hatch (noted, not needed):** `vdom.js` honors `data-wp-ignore` (capture `innerHTML`, mark
     `ignore: true`, skip reconciling) for any future variant that SSRs children Preact must not touch.
     Route B's empty-children snapshot already means there is nothing to reconcile, so it is unneeded
     here.

**Decisions reached from Q3.**

**D8 — `data-wp-init="callbacks.init"` on the wrapper is the boot mechanism; the manual
`domReady`/`querySelectorAll` boot is removed.** The runtime discovers every
`data-wp-interactive="piano-block/piano"` wrapper and runs `init` once per instance with
`getElement().ref` = the live, painted wrapper (so `clientWidth` is measurable at boot). This is
strictly stronger per-instance isolation than the manual query (it underpins AC9) and removes the
`@wordpress/dom-ready` dependency. *Trade-off:* boot timing now follows the runtime's post-paint
`useEffect`, not `domReady` — but that is later (after mount + paint), which is exactly when the
container width is reliable, so it is an improvement, not a regression.

**D9 — `init()` reproduces today's `setupContainer` sequence exactly, sourcing song + name from
context.** Read `{ song, accessibleName }` from `getContext()` and `container` from
`getElement().ref`; gate on `validateSong` (validate-once, R6); defensive `JSON.parse` in `try/catch`
(the preserved double-guard, R6); build the `draw` closure that calls the frozen `buildLayoutModel`
/ `availableWidthInSp` / `renderInto`; gate the first draw via the frozen `drawWhenFontReady` (R11);
attach the resize observer; and return `() => observer?.disconnect()` as the cleanup (D7). Every
notation/song-core function is called unchanged (R13). The parsed song is cached in the closure and
reused on redraw without re-validating.

**D10 — `observeResize` stays a module-level private helper in `view.js`, called from `init()`.** It
keeps `init` readable and isolates the rAF-debounce + `ResizeObserver`-undefined guard, with `frame`
and `observer` as its own closures (D6). It is part of the rewritten `view.js`, not the frozen core.
Rejected: inlining the observer logic into `init` (bloats the callback) — cosmetic, both conform.

**D11 — The imperative SVG mount (`renderInto` → `replaceChildren`) is the authorized, store-driven
carve-out and is provably safe under iAPI hydration.** `render.php` emits a childless,
directive-only wrapper; SDP renders no child content (no flash); `init` fills the wrapper via
`replaceChildren`, which Preact will not reconcile away (empty-children vdom snapshot + zero child
directives + context mutation never re-rendering the Provider's stable children, with `init` firing
after hydrate completes). This nails the spec's framing: the iAPI win is lifecycle/state ownership,
not declarative notation rendering. *Trade-off / guard:* the safety holds precisely because the
wrapper has **no child directives** — any future change that adds a child directive under the wrapper
must re-examine reconciliation (or fence the SVG subtree with `data-wp-ignore`). The runtime's
`data-wp-ignore` affordance exists as an explicit escape hatch if ever needed; route B does not need
it.

### Q4 — Song transport (route B) and the concrete `render.php` shape

**Question.** Produce the exact route-B `render.php` rewrite: (1) the wrapper shape (drop the carrier,
seed song + name into context); (2) the PHP accessible-name computation mirroring `accessibleName.js`,
and whether decoding the song in PHP to compute the name violates R6; (3) `json_decode` robustness and
the full hostile-bytes round-trip for the name; (4) the concrete AC8 transport sub-check rework with
exact escaped-byte expectations.

**Researcher findings (PHP-verified by experiment against the real WP encoder flags; name parity,
`json_decode` robustness, and the full hostile round-trip all run).**

1. **`render.php` shape (route B), honoring iAPI hard rule 3** (a `<?php … ?>` block computes
   everything and closes before the markup, then a single childless `<div>` line):

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
       'song'           => $song,           // RAW string — the helper escapes it.
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

   - The `'' === trim( $song )` early return is **kept** (no wrapper for empty/whitespace — R6/AC6),
     unchanged from today.
   - `$song` goes into context **raw**; the hand-rolled `str_replace( '<', '<', … )` (today
     `render.php:39`) is **dropped**. `wp_interactivity_data_wp_context()` encodes via
     `wp_json_encode( $context, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP )` — a
     superset of today's single-char escape (now escapes `<`, `>`, `'`, `"`, `&`). Verified against
     real WP core source. The carrier `<script>` is gone; the wrapper is childless.
   - The `data-wp-context` namespace param is omitted (defaults to the wrapper's `data-wp-interactive`).
   - The wrapper's own attributes still come from `get_block_wrapper_attributes()` (R2), so the class
     locator `wp-block-piano-block-piano` is preserved (AC1/AC9 scope).

   The PHP name helper mirrors `accessibleName.js` exactly (place in `piano-block.php`, or in
   `render.php` guarded with `function_exists()` since `render.php` runs per instance):

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

2. **PHP name parity proven byte-identical to JS** for every pinned string: title+composer →
   `"Example by A. Composer"` (`render.spec.js:166,501`); hostile title+composer →
   `"${HOSTILE_TITLE} by A. Composer"` (`render.spec.js:670`); title-only verbatim; composer-only;
   neither → `"Piano sheet music"`; whitespace-only title falls to the composer branch. PHP
   `_x`/`__`/`sprintf` with no translation files return English verbatim, exactly as JS
   `@wordpress/i18n` with no `.json`; `%1$s`/`%2$s`/`%s` placeholder syntax is identical.
   - **(R6 is intact — PHP decodes to label, not to validate.)** `render.php` `json_decode`s the song
     **only** to read `metadata.title`/`composer` for the name; it does not gate rendering on the
     result. The wrapper is always emitted for a non-empty song (today's behavior too). If
     `json_decode` fails (invalid JSON) or metadata is absent → `$metadata = []` → name =
     `"Piano sheet music"` (neither branch) — harmless, because the **client** still renders nothing
     for that song (`validateSong` in `init()` fails → return), so the name is never shown. The
     render-or-nothing decision stays 100% client-side; PHP computes a label but makes no
     render/no-render decision. **No server-side validation is introduced.**

3. **`json_decode` robustness + full name round-trip proven end-to-end for `HOSTILE_SONG`.** Plain
   `json_decode( $song, true )` (assoc), `null` on invalid → guarded by `is_array( $decoded )`; no
   special flags (default depth 512 is ample; the song is shallow). `json_decode` returns the exact
   author bytes (it is the inverse of `json_encode`, no HTML-decoding). The chain: PHP
   `json_decode(song).metadata.title` = `HOSTILE_TITLE` exact → `piano_block_accessible_name` =
   `"${HOSTILE_TITLE} by A. Composer"` exact → into `$context` → encoder escapes (8 `<` → `<`,
   `</script>` → `<\/script>`, `<!--` → `<!--`, `"` → `"`) → client
   `getContext().accessibleName` = byte-exact decoded string → `renderInto` sets `<title>` via
   `textContent` (inert, `svg.js:255`) → SVG accessible name equals `"${HOSTILE_TITLE} by A. Composer"`
   exactly (AC8 `render.spec.js:670` passes unchanged). Deep-equal: `json_decode(outer.song)` equals
   `json_decode(HOSTILE_SONG)` (byte-exact author song).

4. **AC8 transport sub-check rework (concrete, exact bytes).** The literal carrier-`<script>` locator
   disappears; the sub-check parses the wrapper's `data-wp-context` attribute from the raw server HTML.
   The encoded attribute for `HOSTILE_SONG` (verified) contains, inside the single-quote-delimited
   value, the song double-encoded with every `<` as `<` (`</script>` → `<\/script>`, `<!--`
   → `<!--`, `"` → `"`) and the name likewise escaped. Reworked assertions replacing
   `render.spec.js:680-696`:
   - Fetch raw HTML (`page.request.get`), locate `data-wp-context='`, and slice the value to the next
     `'` — **safe** because the encoder escapes any in-payload `'` to `'` (JSON_HEX_APOS), so the
     first `'` after the opener is the true attribute close (this is *why* single-quote-wrapping +
     JSON_HEX_APOS is breakout-safe).
   - Escape-safety: assert the value **contains** the escaped `<\/script` and `<!--`, and
     **does not contain** a literal `</script>`, a literal `<!--`, or a literal `'`. (In JS test source
     the needle for an escaped `<` is the six characters `<`, written `'\\u003C'` in a JS string
     literal.)
   - Byte-exact round-trip: `const ctx = JSON.parse( attrValue )` (outer), then
     `expect( JSON.parse( ctx.song ) ).toEqual( JSON.parse( HOSTILE_SONG ) )` (inner deep-equal), and
     optionally `expect( ctx.accessibleName ).toBe( \`${HOSTILE_TITLE} by A. Composer\` )`.
   - The render/inert/no-XSS assertions of AC8 (`render.spec.js:646-670`) are **unchanged** — they
     assert the final SVG/`<title>`/annotation, not the carrier.

**Decisions reached from Q4.**

**D12 — `render.php` is rewritten to the childless route-B wrapper above.** Keep the
`'' === trim($song)` early return (R6/AC6); compute the name in PHP (D4); seed
`wp_interactivity_data_wp_context([ 'song' => $song, 'accessibleName' => $name ])`; add
`data-wp-interactive="piano-block/piano"` and `data-wp-init="callbacks.init"`; keep
`get_block_wrapper_attributes()`; emit no children. The song is passed **raw** and the helper escapes
it — the hand-rolled `str_replace('<', '<', …)` is removed, and the inert carrier `<script>` is
dropped. The file starts in HTML mode with the `<?php … ?>` compute block closing before the `<div>`
(iAPI hard rule 3). *Trade-off:* escaping moves from this block's own code into core's encoder — less
custom code, a stronger (superset) escape, at the cost of the transport being a `data-wp-context`
attribute rather than a `<script>` body (the AC8 sub-check is reworked accordingly — D15).

**D13 — The accessible name is computed in PHP by `piano_block_accessible_name($metadata)`, a faithful
mirror of `accessibleName.js`'s four branches** (text domain `piano-block`, `_x` context
`'sheet music label'`, the verbatim un-wrapped title-only branch). It produces byte-identical English
to the JS path for all pinned strings. `accessibleName.js` itself is **not** changed (R13) — it stays
frozen and still serves the editor; the PHP helper is a parallel implementation for the frontend so the
view module needs no i18n. *Trade-off:* one piece of logic now exists in two languages (PHP for
frontend, JS for editor); they are kept in lockstep by the shared four-branch contract and the e2e
pins. This is the deliberate cost of D4 (dodging the i18n-in-module blocker) and is preferable to
shipping i18n in the module or bundling `@wordpress/i18n`.

**D14 — Decoding the song in PHP computes the label only; it never gates rendering, so R6 holds.**
`render.php` `json_decode`s the song solely to read `metadata` for the name and falls to the
`"Piano sheet music"` branch on any decode failure or missing metadata. The sole render-or-nothing
gate remains the client-side `validateSong` in `init()`. A malformed song yields a harmless,
never-shown PHP label while the client renders nothing. No server-side validation is introduced.

**D15 — Known parity gap recorded: PHP `trim()` strips only ASCII whitespace; JS `.trim()` also strips
Unicode whitespace.** A title padded with non-ASCII whitespace (e.g. U+00A0 nbsp, U+2003, U+FEFF)
would trim differently in the PHP frontend name vs the JS editor name. **No e2e is affected** — every
pinned string uses only ASCII spaces, so PHP `trim` ≡ JS `trim` for all asserted cases. We **accept
and document** this rather than code around it: it is out of test scope, cosmetic, and vanishingly
rare; the exact-parity fix (a Unicode-aware `preg_replace('/^[\s\x{00A0}\x{FEFF}…]+|…$/u', '', …)`) is
overkill. The editor name (JS) and the frontend name (PHP) already diverge only on non-ASCII
whitespace, which the documentation phase should note.

**D15a — AC8 transport sub-check is reworked to parse the `data-wp-context` attribute** (the one
existing test that changes, per the spec). It asserts the escaped `<\/script` and `<!--`
are present, that no literal `</script>` / `<!--` / `'` appears (no breakout from the single-quoted
attribute), and that a double-decode (`JSON.parse(ctx.song)`) deep-equals `JSON.parse(HOSTILE_SONG)`
(byte-exact round-trip), optionally checking `ctx.accessibleName`. The AC8 render/inert/no-XSS
assertions are unchanged. (Full test impact is consolidated in Q7.)

### Q5 — Validate-once + cached layout + resize reflow + the 480px breakpoint (the hard AC5)

**Question.** Confirm the design preserves the hardest behavioral AC (AC5, narrow viewport → more
`g[data-system]`) exactly under iAPI: (1) validate-once + cached-parse + redraw-from-cache (R6); (2)
the `observeResize` mechanics (one-way, rAF-debounced, undefined-guard) and the cleanup return-handle;
(3) the 480px breakpoint via the frozen `availableWidthInSp`; (4) whether anything in the iAPI model
threatens AC5 — especially the **repeated** resize `replaceChildren`.

**Researcher findings (verified from `view.js`/`dom.js` + iAPI runtime source).**

1. **Validate-once + cached parse + redraw-from-cache is preserved exactly.** Today: `validateSong`
   runs once (`view.js:57`), `JSON.parse` once into `data` (`:65`); `draw` (`:71-74`) is
   `buildLayoutModel(data, availableWidthInSp(container)) + renderInto(…)` — no `validateSong`, no
   `JSON.parse` — and both the first draw (`:79`) and resize redraws (`:105`) call that same
   validation-free closure. The new `init()` does the same: `validateSong(raw)` once → `JSON.parse(raw)`
   once into closure-local `data` (D6/D9) → `draw` closes over `data`; resize redraws are pure
   `buildLayoutModel(data, newWidth) + renderInto`. `data` lives only in the init closure, never
   re-read from `getContext()` (`song` is read once at boot). **The iAPI model structurally guarantees
   validate-once:** `data-wp-init` is `useInit = _useEffect(withScope(cb), [])` — an empty-deps effect
   that runs once on mount and never re-fires; resize is driven by the raw DOM `ResizeObserver`
   callback, not by `init`, so `validateSong`/`JSON.parse` cannot re-run on resize.

2. **`observeResize` keeps `view.js:94-109` verbatim, plus one new line (`return observer`) for
   cleanup.** (a) `ResizeObserver` undefined → no-op return; AC5's "initial draw regardless of
   `ResizeObserver`" holds because, in the D9 sequence, `drawWhenFontReady(draw)` runs **before**
   `observeResize(container, draw)`, so the first draw already fired before the observer-or-no-op
   decision (same ordering as today, `view.js:79` then `:81`). (b) The in-flight `frame` guard +
   `requestAnimationFrame` coalesce to ≤1 draw/frame and suppress the benign "ResizeObserver loop …
   undelivered notifications" warning (R12). (c) The redraw swaps the SVG via `replaceChildren` and
   never writes any width back to the wrapper (the SVG is `max-width:100%;height:auto`,
   `svg.js:250`), so the observer cannot observe its own effect — one-way, no feedback loop. The only
   change to the function body is adding `return observer` (and returning `undefined` on the
   no-`ResizeObserver` path), so `init` can do
   `const observer = observeResize(container, draw); return () => observer?.disconnect();` — the `?.`
   covers the undefined case.

3. **The 480px breakpoint via the frozen `availableWidthInSp` is re-evaluated at the live width on
   every draw.** `availableWidthInSp(container)` (`dom.js:25-30`) reads `clientWidth`, applies
   `spPx = (0 < width < 480) ? 7 : 8` (`NARROW_CONTAINER_PX=480`, `NARROW_SP_PX=7`, `SP_PX=8`), and
   returns `width/spPx`. It is called fresh inside `draw` on every call, so each redraw re-reads the
   live width and re-evaluates the breakpoint: width < 480 → `spPx=7` → narrower unit → fewer
   measures/system → more systems (exactly AC5's narrow → more `g[data-system]`). It is called
   **unchanged** (frozen); the only thing that changed is who calls `draw`. Zero-width tolerance is
   preserved (jsdom 0-width → `Math.max(0,0)=0` → `spPx=8` since the `0<width<480` guard is false at 0
   → returns 0 → layout floors). Post-paint init means real browsers have a live width, so 0-width is a
   jsdom/edge fallback, not the normal path.

4. **iAPI does NOT threaten AC5 — proven, including the repeated redraws.** (a) The `ResizeObserver`
   is a raw DOM observer on the wrapper ref, not an iAPI directive; the runtime has zero hooks into it,
   so it fires independently of Preact. (b) **`hydrate()` runs exactly once per island** — guarded by
   the `hydratedIslands` WeakSet (`init.js:42` checks it before the single hydrate at `init.js:48`, the
   only hydrate call site in the runtime). There is no re-render/`forceUpdate`/`setState` path, and
   with zero child directives (route B) nothing in the subtree is reactive, so Preact never re-diffs
   the wrapper's children. Therefore the first `replaceChildren` and the Nth (resize) `replaceChildren`
   are all identical, safe DOM swaps with no Preact contention — this extends Q3.4's first-draw proof
   to the repeated resize redraws. (c) `expect.poll` timing is unchanged: the rAF-debounced redraw is
   byte-identical to today, the test awaits SVG visibility before resizing (`render.spec.js:602`), and
   the poll re-resolves the `g[data-system]` count after the post-resize `replaceChildren`. There are
   no `data-wp-watch` watchers and the only effect is the one-shot `data-wp-init` (which completes
   before any resize), so nothing in the runtime interferes with the observer or the repeated redraws.

**Decisions reached from Q5.**

**D16 — Validate-once + cached-parse + redraw-from-cache is preserved, and structurally enforced by
the iAPI lifecycle.** `init()` validates and parses once into a closure-local `data`; every redraw
(first and resize) reuses `data` with no re-validation/re-parse. Because `data-wp-init` is an
empty-deps effect that never re-fires and resize is driven by the DOM observer (not `init`), the
validate-once contract (R6) is guaranteed by construction, not merely by convention.

**D17 — `observeResize` is reused verbatim from `view.js:94-109` with exactly one addition:
`return observer`** (and `undefined` on the no-`ResizeObserver` path) so `init` can disconnect it in
cleanup (D7). The undefined-guard no-op (initial draw still happens), the rAF debounce (R12 / one
redraw per frame / suppressed loop warning), and the one-way invariant (width flows container → SVG
only) are all preserved unchanged. This satisfies R7/AC5's "initial draw unconditional; reflow
required where `ResizeObserver` exists" and keeps the observer feedback-loop-free.

**D18 — AC5's resize mechanism survives iAPI intact; the breakpoint and the repeated redraws are
safe.** The frozen `availableWidthInSp` (single 480px breakpoint, zero-width tolerant) is called fresh
per draw, re-evaluating the breakpoint at the live width so a narrow container packs more systems. The
raw DOM `ResizeObserver` is independent of Preact, `hydrate()` runs once (`hydratedIslands` WeakSet)
with no re-render path, and zero child directives mean every `replaceChildren` (first and every
resize) is an uncontended DOM swap. *Guard (same as D11):* this safety depends on the wrapper having
no child directives; a future child directive would require re-examining the repeated-redraw
reconciliation.

### Q6 — Multi-block isolation (AC9) and the i18n 6.9-vs-7.0 floor decision (R9)

**Question.** Resolve the two remaining flagged open constraints: (1) per-instance isolation for
multiple blocks on a page (AC9) and the new test's shape; (2) the i18n floor decision — does D4
dissolve the `wp_set_script_module_translations` 6.9-vs-7.0 caveat?; (3) the minimal `piano-block.php`
changes.

**Researcher findings (verified from the iAPI runtime + WP core `l10n.php` source).**

1. **Multi-block isolation is structural — zero cross-talk.** Each wrapper carries its own
   `data-wp-context` (own `song` + own `accessibleName`), seeded per-instance because `render.php` runs
   once per block instance. The runtime boots `init` per-instance (`querySelectorAll('[data-wp-interactive]')`
   → per-node hydrate → per-node `data-wp-init` effect), and `getContext()` / `getElement().ref` resolve
   to the **firing** instance (per-element scope). The parsed `data`, observer, `frame`, and `draw` are
   init-closure locals (D6) — a fresh closure per invocation, so two instances are two independent
   closures. **No shared mutable module-level state:** `observeResize`'s `frame`/`observer` are per-call
   locals, not module-level; `store('piano-block/piano', …)` is registered once and shared, but it is
   stateless-per-instance (D5 → no `state` bucket; `callbacks.init` is a pure function reading
   per-instance scope), so two instances cannot share data through the store object. The only way two
   instances could share a song is if it were put in `wp_interactivity_state()` — which D5 forbids.
   - **AC9 test shape (new).** Today every `render.spec.js` test inserts one block. The new test inserts
     **two**: `createNewPost`, `insertBlock('piano-block/piano')` + fill song A (e.g. metadata
     `{title:"Alpha", composer:"X"}` → "Alpha by X"), `insertBlock` again + fill song B (e.g.
     `{title:"Beta", composer:"Y"}` → "Beta by Y"), then `publishPost`. (Each `insertBlock` + Edit-as-JSON
     + fill targets the just-inserted, currently-selected block.) Assertions: locate both wrappers by
     `BLOCK_CLASS`; expect two `svg[role=img]`; `svg.nth(0)` `toHaveAccessibleName("Alpha by X")` and
     `svg.nth(1)` `toHaveAccessibleName("Beta by Y")` — each its own name, no leak; and give A and B
     different note content so their SVG trees differ (distinct `g[data-system]`/notehead counts),
     proving each read its own `context.song`. This is precisely the global-state-regression guard the
     spec wants (AC9 maps R4 + R8): if the song were ever lifted to `wp_interactivity_state()`, both
     blocks would render the same notation/name and this test would fail.

2. **The i18n floor decision: D4 DISSOLVES the caveat. Floor stays 6.9.** Because D4 moved all
   accessible-name i18n to PHP (`__`/`_x`/`sprintf` in `render.php`) and the view module does no i18n
   (no `@wordpress/i18n` import, D3), there are **zero module strings to translate** —
   `wp_set_script_module_translations` is irrelevant, so the 6.9-vs-7.0 gotcha is **moot**, not merely
   "accepted English-only." (`wp_set_script_module_translations` is verified absent from WP 6.8.5 and
   6.9.4 cores, so it was the only reason to consider a floor bump; D4 removes that reason.) The PHP
   `_x`/`__` strings for the `piano-block` text domain localize via standard **just-in-time** gettext
   loading (`_load_textdomain_just_in_time` in `l10n.php`): on the first `__`/`_x` with a non-default
   domain, WP auto-loads `{$domain}-{$locale}.mo` from the registered textdomain path. The path is
   auto-registered for this plugin via `block.json`'s `"textdomain": "piano-block"` (`src/block.json:11`)
   and the plugin header `Text Domain: piano-block` — so no explicit `load_plugin_textdomain` is needed.
   This works on the 6.9 floor (just-in-time loading has existed since WP 4.6), with no module-translation
   wiring. R9's string-correctness requirement (four templates, English verbatim) holds via PHP (proven
   in Q4). This outcome is strictly better than the spec's two options (no English-only compromise, no
   floor bump).
   - **Timing nuance (R12):** WP 6.7+ emits a "Translation loading … triggered too early" `_doing_it_wrong`
     warning if `__()` runs before `after_setup_theme`. `render.php` runs during post render (well after
     `init`/`after_setup_theme`), so the PHP `_x()` there is safe — no early-load warning. The name helper
     is only ever called inside `render.php` per-request (late), never at plugin-load time.

3. **`piano-block.php` change is minimal: remove the dead `wp_set_script_translations` call.** That call
   targets the classic view-script handle `piano-block-piano-view-script`, which ceases to exist once
   `viewScript` → `viewScriptModule` (no classic script is registered), and it pointed at a non-existent
   `__DIR__/languages` dir — so it was already a no-op for the module path; per R9 it must be removed.
   `register_block_type( __DIR__ . '/build' )` is **unchanged** — it reads the built `block.json` and
   auto-registers + auto-enqueues the `viewScriptModule` when the block renders; nothing is added manually
   (and `wp_register_script_module()` must NOT be called — iAPI hard rule 1 / R10 / AC14). No
   `load_plugin_textdomain` is needed for the PHP strings (the block textdomain registry already covers
   the just-in-time path). Result:

   ```php
   function piano_block_register() {
       register_block_type( __DIR__ . '/build' );
   }
   add_action( 'init', 'piano_block_register' );
   ```

   (Plus `piano_block_accessible_name()` — D13 — if it lives in `piano-block.php` rather than `render.php`.)

**Decisions reached from Q6.**

**D19 — Multi-block isolation (AC9) is achieved structurally by per-instance context + per-init
closures, with no shared module-level mutable state and no `store.state`.** The new `view.js` must have
zero module-level mutable variables holding per-instance data (the observer/`frame` are per-call locals;
the store carries no per-instance state). Each `init` invocation reads its own `getContext()` /
`getElement().ref`, so N blocks render N independent SVGs with their own song, width, and name.

**D20 — The AC9 test inserts two blocks with distinct metadata and distinct note content and asserts
each SVG has its own accessible name and its own notation tree (no leak).** This is the new acceptance
test (none exists today) and is the explicit guard against a global-state regression (a song wrongly
placed in `wp_interactivity_state()` would make both blocks share one song and fail this test). (Test
authoring is detailed in Q7.)

**D21 — The WordPress floor stays at 6.9; the R9 module-translation caveat is dissolved (not merely
deferred).** Because D4 moved i18n to PHP and the module imports no `@wordpress/i18n` (D3), there are no
module strings to localize, so `wp_set_script_module_translations` (a 7.0 API) is irrelevant. The PHP
accessible-name strings localize via standard just-in-time gettext on the `piano-block` text domain
(registered through `block.json`/plugin header), which works on 6.9 with no extra wiring. *Trade-off
considered and rejected:* bumping the floor to 7.0 — unnecessary, since D4 removes the only motivation;
and accepting "English-only on 6.9" — also unnecessary, since the PHP path localizes fully. This is the
surfaced, evidence-backed decision the spec asked for, and it is strictly better than both options the
spec floated.

**D22 — `piano-block.php`'s only change is deleting the dead `wp_set_script_translations` call;
`register_block_type( __DIR__ . '/build' )` is unchanged and auto-registers the view module.** No
manual `wp_register_script_module()` (hard rule 1 / R10 / AC14), no `load_plugin_textdomain` (the block
textdomain registry already covers the just-in-time PHP gettext path). The PHP name helper
`piano_block_accessible_name()` (D13) may live here or in `render.php`.

### Q7 — Full test impact and the build/test workflow (closeout)

**Question.** Lock the complete test picture: (1) which e2e assertions change vs stay, with the subtle
risks (AC6/AC7 under the route-B render.php); (2) whether the "no raw JSON echo" assertions survive the
move from a `<script>` body to a `data-wp-context` attribute; (3) unit-test impact and whether a new
`view.js` unit test is expected; (4) the build/test workflow change for `--experimental-modules`.

**Researcher findings (verified from `render.spec.js`, `jest.config.js`, the playwright config, and
wp-scripts behavior).**

1. **Only two e2e changes; all others pass unchanged.** The reworked AC8 transport sub-check
   (`render.spec.js:680-696`, the *only* assertion that reads raw HTML) and the new AC9 multi-block test.
   Subtle risks checked: **AC6** ("no wrapper for empty", `:462-481`) holds — `render.php` early-returns
   on `'' === trim($song)` *before* the json_decode/name code, so empty never reaches it. **AC7**
   (invalid-JSON `:542-564`, non-conformant `:566-585`) holds — `json_decode` on garbage returns `null`
   cleanly (guarded by `is_array`), so the name falls to `"Piano sheet music"` and the wrapper is still
   emitted (childless, no fatal); the client `validateSong` then fails → no SVG → `blockSvg` count 0.
   **AC7 `innerText === ""`** (`:561-563`, `:581-584`) holds — the route-B wrapper is a childless `<div>`
   with only attributes; `innerText` returns visible text only (attribute values are not `innerText`), so
   `""` both on the raw server HTML and after a failed client render.

2. **"No raw JSON echo" survives route B.** AC1/12's `expect(blockText).not.toContain('"sections"' /
   '"timeSignature"')` (`:537-539`) reads `innerText`, which excludes attribute values — so the song now
   living in the `data-wp-context` attribute does not appear in `innerText` (just as the old `<script>`
   body did not). The **only** assertion that reads raw HTML (where the song does appear, now in the
   attribute) is the AC8 transport sub-check at `:680`, which is being reworked anyway. No other test
   greps raw HTML for song substrings. So beyond AC8:680-696, nothing changes.

3. **Unit tests:** **no** test imports `view.js` (verified — the earlier grep hits were substring
   false-positives), so the `view.js` rewrite causes zero unit-test breakage. `svg.test.js`
   (`src/notation/__tests__/svg.test.js`) imports the frozen `layout.js` + `svg.js` and stays valid
   unchanged (R13/AC15); all notation/song and editor unit tests are untouched. **No new `view.js` unit
   test is expected** — `view.js` was never unit-tested (it is the integration/wiring layer; `render.spec.js`
   is its contract, exactly as today). A Jest test for `init()` would require mocking the iAPI runtime
   (`store`/`getContext`/`getElement`) — high-friction, low-value, and not how `view.js` was covered before.

4. **Build/test workflow.** `wp-scripts test-playwright` does **not** auto-build — the playwright config's
   `webServer.command` boots wp-env (which serves the plugin's `build/` via `register_block_type(__DIR__ .
   '/build')`) and `globalSetup` only logs in. So the build must run before e2e, and `npm run build` must
   carry `--experimental-modules` or the view module is never built → nothing hydrates → e2e fails. Jest
   does **not** need the flag (it Babel-transforms `src/` directly and mocks `@wordpress/*`, including a
   local `@wordpress/i18n` mock — it never reads `build/`). No `.github/workflows` dir exists, so there is
   no CI to update (a future CI must run the flagged build before e2e). **Concrete `package.json`:**
   `"build": "wp-scripts build --experimental-modules"`, `"start": "wp-scripts start --experimental-modules"`;
   `test:e2e` and `test:unit` scripts are unchanged (e2e correctness merely depends on the flagged build
   having run first).

   **One documentation drift flagged (not a code/test change):** the comment at `render.spec.js:554-555`
   describes the wrapper as carrying the inert JSON `<script>` carrier — stale under route B (the wrapper
   now carries `data-wp-context` and no script). The *assertion* is unaffected; only the comment is now
   inaccurate. This is a doc-phase note, not a code/test edit.

**Decisions reached from Q7.**

**D23 — The only e2e changes are the reworked AC8 transport sub-check (D15a) and the new AC9 test
(D20).** Every other assertion in `render.spec.js` passes unchanged because they assert the final SVG,
the empty/childless wrapper, node attributes, or `innerText` — never the carrier. AC6 and AC7 hold under
the route-B `render.php` (early-return on empty precedes the name code; `json_decode` on invalid JSON is
guarded and harmless; the childless wrapper yields `innerText === ""`). `editor.spec.js` is untouched
(AC15).

**D24 — The "no raw JSON echo" guarantee survives the transport move.** The song JSON is not visible
text in either transport (old `<script>` body or new `data-wp-context` attribute), so the `innerText`-based
assertions hold. The only raw-HTML read is the AC8 sub-check, which is reworked. No hidden raw-HTML grep
for song substrings exists elsewhere.

**D25 — Unit tests are unaffected and no new `view.js` unit test is added.** `svg.test.js` and all
notation/song/editor unit tests stay green unchanged (frozen emit layer, R13/AC15); no unit test imports
`view.js`. `view.js` remains e2e-covered (its contract is `render.spec.js`), matching today's coverage
model. *Rationale:* unit-testing the store wiring would require mocking the iAPI runtime for little value;
the e2e suite already pins boot (AC1/8/9) and resize (AC5).

**D26 — `package.json` adds `--experimental-modules` to `build` and `start` only.** `test:e2e` and
`test:unit` scripts are unchanged; Jest does not need the flag (it reads source, not `build/`), and
test-playwright does not auto-build, so the e2e flow's correctness depends on the flagged build having run
first (same build-then-e2e ordering as today, only the flag is new). No CI workflow exists to update.

---

## Design summary — the decided architecture

The migration moves the Piano block's frontend from a classic `viewScript` (`src/view.js` booting on
`domReady`) to a WordPress Interactivity API **view module**, with the store owning **boot, lifecycle,
and per-instance state** while the notation SVG stays an **imperative, store-driven mount** (the
authorized carve-out). The notation core, the song validator, and the editor are untouched.

**Data flow.** `render.php` runs per instance: it early-returns for an empty/whitespace song (no
wrapper); otherwise it computes the accessible name in PHP (mirroring `accessibleName.js`'s four
branches) and seeds `{ song, accessibleName }` into the wrapper's per-instance `data-wp-context` via the
core encoder (which escapes `< > ' " &` — a superset of the old hand-rolled `<` escape). The wrapper
carries `data-wp-interactive="piano-block/piano"`, the `data-wp-context`, `data-wp-init="callbacks.init"`,
and `get_block_wrapper_attributes()`, with **no children** (the inert carrier `<script>` is dropped). On
hydration the runtime boots `callbacks.init` once per instance; `init` reads the song + name from
`getContext()`, validates once (the client remains the sole render-or-nothing gate), defensively parses,
caches the parsed song in a closure, gates the first draw on the music font (`drawWhenFontReady`), and
attaches a rAF-debounced one-way `ResizeObserver`. `draw` calls the frozen
`buildLayoutModel`/`availableWidthInSp`/`renderInto`; `renderInto`'s `container.replaceChildren(svg)` is
the carve-out write, provably safe because the childless wrapper's vdom snapshot is empty, there are no
child directives, and `hydrate()` runs exactly once — so Preact never reconciles the injected SVG away,
first draw or resize redraw. The view module imports **only** `@wordpress/interactivity`.

**Decision index.** D1–D4 registration + build flag + the i18n-blocker pivot (server-compute the name);
D5–D7 store shape (`{song, accessibleName}` context, callbacks-only, no state); D8–D11 boot/lifecycle +
the proven-safe carve-out; D12–D15a route-B `render.php`, PHP name parity, the trim caveat, the AC8
rework; D16–D18 validate-once + resize/breakpoint preservation; D19–D22 multi-block isolation + the
dissolved i18n floor caveat (stay 6.9) + minimal `piano-block.php`; D23–D26 the test surface + the build
flag.

## File-change manifest (in scope)

- **`src/block.json`** (D1) — drop `"viewScript"`; add `"viewScriptModule": "file:./view.js"` and
  `"supports": { "interactivity": true }`.
- **`src/render.php`** (D12–D15) — route-B rewrite: keep the empty early-return; compute the accessible
  name in PHP; seed `wp_interactivity_data_wp_context([ 'song' => $song, 'accessibleName' => $name ])`;
  emit a childless wrapper with `data-wp-interactive` + `data-wp-init` + `get_block_wrapper_attributes()`;
  drop the carrier `<script>` and the hand-rolled `str_replace`.
- **`src/view.js`** (D5–D11, D16–D19) — rewrite from a `domReady` boot into
  `store('piano-block/piano', { callbacks: { init() {…} } })`; `init` reads context, validates once,
  parses, builds the `draw` closure (frozen core calls), font-gates the first draw, attaches
  `observeResize` (module helper, now returning the observer), and returns a disconnect cleanup; remove
  the `@wordpress/dom-ready` import and the manual `querySelectorAll` boot.
- **`piano-block.php`** (D13, D22) — remove the dead `wp_set_script_translations` call; keep
  `register_block_type( __DIR__ . '/build' )`; (optionally) host `piano_block_accessible_name()`.
- **`package.json`** (D2, D26) — add `--experimental-modules` to the `build` and `start` scripts.
- **`specs/render.spec.js`** (D15a, D20, D23) — rework the AC8 transport sub-check to parse the
  `data-wp-context` attribute; add the AC9 two-block isolation test.

**Out of scope / frozen (unchanged):** the notation core (`layout.js`, `svg.js`, `dom.js`, `glyphs.js`,
`constants.js`), the song format/validator (`validate.js`, `schema.js`, `normalizeStep.js`),
`accessibleName.js` (still serves the editor), all notation/song/editor unit tests including `svg.test.js`,
`specs/editor.spec.js`, and the editor entry (`index.js`/`edit.js`/`editor/*`). One stale comment at
`render.spec.js:554-555` (mentions the dropped carrier) is a documentation-phase note, not a code change.

## Research status: COMPLETE

All design topics are resolved on evidence:
- Script-module migration (registration, the `--experimental-modules` build flag, externalization, the
  i18n-in-module blocker and its server-compute resolution) — D1–D4.
- Store shape (per-instance context vs module-scope closures vs absent global state) — D5–D7.
- Boot/lifecycle and the imperative-SVG carve-out, with a runtime-source proof that Preact never clobbers
  the injected SVG (first draw and repeated resize redraws) — D8–D11, D16–D18.
- Route-B song transport, the concrete `render.php`, PHP-side accessible-name parity (with the documented
  ASCII-vs-Unicode trim gap), and the AC8 transport-sub-check rework — D12–D15a.
- Multi-block isolation (AC9) and the i18n floor decision (stay 6.9; the module-translation caveat is
  dissolved, not deferred) — D19–D22.
- The complete test surface and the build/test workflow change — D23–D26.
