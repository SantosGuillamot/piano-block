# Design Doc: Piano block scaffold

> Phase 2 artifact — the design (the HOW). Implements the approved `1-spec/spec.md` (requirements, acceptance criteria, scope) for a **minimal Piano block WordPress plugin scaffold**. Standalone: readable without the spec, though it cites spec requirements (`req N`) and acceptance criteria (`AC N`) for traceability. The supporting Q&A and evidence are in `2-design-doc/design-doc-research.md` (decisions D1.1–D8.5); every decision here is research-backed there against official WordPress docs and live Biome 2.4.16 / PHP 8.4 probes.

## 1. Overview & approach

Build a standard, installable WordPress plugin at the repository root that registers exactly one **dynamic** block, `piano-block/piano` (Block API v3). The block shows a basic static placeholder in the editor and renders minimal, valid HTML on the front end via a server-side `render.php`. It carries no piano behaviour — interactive keys, audio, visual design, input handling, and the Interactivity API are all deferred to a future task.

The scaffold is **no-build**: the editor JavaScript is authored in plain, browser-ready JavaScript against the global `wp.*` API (no JSX, no bundler, no `@wordpress/scripts`), with a hand-written `*.asset.php` declaring its script dependencies and version. Any styling is plain CSS (no SCSS). All authored source files pass the repository's existing **Biome** lint/format (tab indentation, double-quoted JS, `recommended` rules) with **no new tooling and no change to `biome.json`**.

Concretely, the design:

- Places all plugin files at the **repo root** (the repo *is* the plugin); `register_block_type( __DIR__ )` on `init` reads `block.json` and wires every asset and the server render from that one metadata file (req 11, 12).
- Uses a **flat, conventional file set** matching the canonical no-build example and the `create-block` `es5` (no-JSX, plain-CSS, dynamic) template: `piano-block.php`, `block.json`, `index.js`, `index.asset.php`, `render.php`, `style.css`.
- Authors the editor JS in an idiom that is **simultaneously WP-correct and clean under Biome `recommended`** (proven by probe), and deliberately shaped to read like the future `import { … } from "@wordpress/…"` form.
- Ships a **minimal placeholder stylesheet** (a neutral "scaffold slot" affordance), wired through `block.json` `style` so it loads in both the editor and the front end — strengthening the smoke test and exercising the CSS-wiring path the real piano will later use, without straying into out-of-scope visual design.

### The build tension, resolved deliberately

The spec names a tension: no-build plain-JS/CSS now vs. a JavaScript build pipeline when the real piano UI lands. **Resolution: stay no-build now, with a documented, low-cost path to `@wordpress/scripts build` later (retaining Biome for lint/format).** This is chosen, not accidental, and is detailed in §6. The scaffold is kept a strict *subset* of the eventual built layout so the migration is a file move plus a one-line registration change — nothing authored now must be undone.

## 2. Directory & file layout

The plugin lives at the repository root. The existing tooling files (`package.json`, `biome.json`, `.nvmrc`, `README.md`, `.gitignore`, `package-lock.json`) are untouched except where noted in §7.

```
piano-block/                 (repo root = plugin root; register_block_type( __DIR__ ) targets here)
├── piano-block.php          # main plugin file: header docblock + ABSPATH guard + init registration
├── block.json               # block metadata: identity, presentation, asset + render wiring
├── index.js                 # no-build editor script (plain JS against wp.* globals)
├── index.asset.php          # hand-written sidecar: editor-script dependencies + version
├── render.php               # server-rendered front-end output (dynamic block)
├── style.css                # minimal placeholder styles (front end + editor)
└── (existing, unchanged)    # package.json, biome.json, .nvmrc, README.md, .gitignore, package-lock.json
```

**Why flat root, not `src/`** (D1.1, D1.3): with no build there is nothing to copy `src/`→`build/`, so `register_block_type( __DIR__ )` registers the root directly. The canonical no-build example is flat-root; a `src/` folder would import a build mental model that does not exist here and add a needless path indirection. The `src/`→`build/` split is reserved for the future build adoption (§6).

**Naming rules that are load-bearing:**
- The editor script is `index.js`; its sidecar **must** share the basename → `index.asset.php` (WordPress finds the sidecar by pattern-matching the script path).
- `file:` references inside `block.json` are resolved **relative to `block.json`'s own location** (the root), so they are `file:./index.js`, `file:./style.css`, `file:./render.php`.
- The main plugin file is `piano-block.php` (`<slug>.php` convention — recognizable as *the* plugin file; matches the `package.json` name).

## 3. Components

Each file below is specified to be committed as shown. The PHP files (`piano-block.php`, `render.php`, `index.asset.php`) are outside Biome's processing set (Biome gracefully skips `.php`); `index.js`, `block.json`, and `style.css` are processed by Biome and are authored in the exact form Biome leaves byte-stable (`biome check --write` is idempotent — verified per file).

### 3.1 `block.json` — block metadata (single source of wiring)

```json
{
	"$schema": "https://schemas.wp.org/trunk/block.json",
	"apiVersion": 3,
	"name": "piano-block/piano",
	"version": "0.1.0",
	"title": "Piano",
	"category": "media",
	"icon": "format-audio",
	"description": "A placeholder Piano block — a scaffold for a future interactive piano.",
	"keywords": ["piano", "music", "keyboard"],
	"textdomain": "piano-block",
	"editorScript": "file:./index.js",
	"style": "file:./style.css",
	"render": "file:./render.php"
}
```

- `apiVersion` is the integer `3` (req 1); the editor renders in an iframe (WP 6.3+), and because the editor script is wired through `editorScript` + registration, WordPress injects it (and its dependency handles) into the iframe automatically — no extra wiring (this is why the WP floor is 6.3).
- `category` is `media` — the closest fit among WordPress's six fixed core categories; no custom category is created (req 13, Out of Scope).
- `icon` is the bare Dashicons slug `format-audio` (there is **no** `piano` dashicon; `format-audio` is the cleanest music glyph). Not `dashicons-format-audio` — `block.json` wants the bare slug.
- `version` (`0.1.0`) is present specifically so the front-end/editor **stylesheet** gets a plugin-tied cache-busting query string (see §4 and the version note in §3.3); it is kept in lockstep with the other version declarations.
- `title`, `description`, and `keywords` are translation-ready at no cost: `register_block_type` auto-translates these metadata fields via `textdomain` (req 14). `textdomain` is lowercase and equals the plugin header `Text Domain`.
- No `save`-related field, no `editorStyle`/`viewStyle`, no `viewScript`/`viewScriptModule`, no `supports`/`attributes` — all unnecessary for the scaffold and/or deferred (Out of Scope).
- Authored in conventional WordPress key order; Biome does **not** reorder JSON keys (`organizeImports` only affects JS/TS imports) and leaves this object byte-identical.

### 3.2 `index.js` — no-build editor script

```js
const { registerBlockType } = wp.blocks;
const { createElement } = wp.element;
const { useBlockProps } = wp.blockEditor;
const { __ } = wp.i18n;

registerBlockType("piano-block/piano", {
	edit() {
		return createElement(
			"p",
			useBlockProps(),
			__("Piano block — editor placeholder", "piano-block"),
		);
	},
});
```

- **Dynamic shape (req 2, 3; AC4):** `save` is **omitted entirely**. For a dynamic block, leaving `save` unspecified is the documented, canonical behaviour — WordPress stores no markup in post content (only the block delimiter comment persists), so the block is exempt from block-markup validation. We do **not** write `save: () => null` (redundant).
- **Editor placeholder (req 5; AC3):** `edit` returns a `<p>` whose props are the object from `useBlockProps()` (the no-JSX equivalent of `<p {...useBlockProps()}>`), containing a single translated string. It uses the standard block-props wrapper so the block participates correctly in the editor. It does **not** use `ServerSideRender` and renders no preview of the server output.
- **i18n (req 14):** the one user-facing string is wrapped in `__()` from `wp.i18n` with text domain `piano-block`. Full JS translation loading (`wp_set_script_translations`) is deferred.
- **Biome-clean by construction (req 9):** exactly the four `wp.*` members used are destructured (no unused aliases → no `noUnusedVariables`); `const` not `var`; method shorthand `edit() {}` (avoids `useArrowFunction`, which rewrites `function(){}` expressions); double-quoted, tab-indented. The global `wp` is **not** flagged — `noUndeclaredVariables` is not part of Biome's `recommended` set — so **no `biome.json` change and no `/* global */` comment is needed**. The destructuring form is also the closest read to a future `import { … } from "@wordpress/…"` (see §6).

### 3.3 `index.asset.php` — hand-written editor-script sidecar

```php
<?php

return array(
	'dependencies' => array( 'wp-blocks', 'wp-block-editor', 'wp-element', 'wp-i18n' ),
	'version'      => '0.1.0',
);
```

- WordPress auto-detects this sibling of `index.js` and `include`s it; the file's top-level `return` value is the mechanism. WordPress reads `dependencies` and `version` (req 8).
- **All four handles are listed explicitly**, mapping `@wordpress/*` → `wp-*`: `wp-blocks` (`registerBlockType`), `wp-block-editor` (`useBlockProps` — the modern handle; **not** the legacy `wp-editor`), `wp-element` (`createElement`), `wp-i18n` (`__`). `wp-element` is listed explicitly rather than relying on it arriving transitively via `wp-blocks` (transitive script deps are undocumented and could change; WordPress dedupes handles so the explicit listing is free and safe).
- **`version` is a literal `'0.1.0'`** kept in sync with the plugin header `Version` and `package.json` `version`. A literal busts the editor-script browser cache precisely when a release ships. `filemtime` is avoided (mtimes are not preserved across checkouts/deploys → nondeterministic, gratuitous cache busts); `false` would track the WP core version (wrong granularity).
- **No `defined( 'ABSPATH' )` guard** — it is a pure data file with no side effects (build-generated `*.asset.php` files never carry the guard).

### 3.4 `render.php` — server-rendered front-end output

```php
<?php
/**
 * Server-rendered output for the Piano block (dynamic block).
 *
 * Exposed variables: $attributes (array), $content (string), $block (WP_Block).
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-metadata/#render
 */
?>
<p <?php echo get_block_wrapper_attributes(); ?>>
	<?php esc_html_e( 'Piano block — front-end placeholder', 'piano-block' ); ?>
</p>
```

- **Wrapper (req 4; AC5):** a single `<p>` carrying the standard block wrapper attributes via `get_block_wrapper_attributes()`, echoed **directly** into the opening tag. It returns an **already-escaped** attribute string, so it must **not** be wrapped in `esc_attr()` (that would double-escape — a defect).
- **Placeholder content:** one static translated string, escaped + translated + echoed via `esc_html_e( …, 'piano-block' )`.
- **`WP_DEBUG`-clean (AC1, AC5):** the body touches no array keys and no `$block` properties. (Reading an undefined `$attributes[...]` key would emit a PHP 8+ `Undefined array key` warning; the scaffold avoids this by construction. A live PHP 8.4 `E_ALL` probe confirmed the minimal body emits zero notices/warnings.)
- **No `defined( 'ABSPATH' )` guard** here — `render.php` is a pure output partial loaded only by WordPress during render, defining nothing; the canonical templates omit the guard (the guard lives on the entry file, §3.5).

### 3.5 `piano-block.php` — plugin entry (header + registration)

```php
<?php
/**
 * Plugin Name:       Piano Block
 * Plugin URI:        https://github.com/SantosGuillamot/piano-block
 * Description:        Registers the Piano block — a scaffold for a future interactive piano.
 * Version:           0.1.0
 * Requires at least: 6.3
 * Requires PHP:      7.4
 * Author:            Mario Santos
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       piano-block
 *
 * @package PianoBlock
 */

defined( 'ABSPATH' ) || exit;

/**
 * Registers the Piano block from its block.json metadata.
 */
function piano_block_register() {
	register_block_type( __DIR__ );
}
add_action( 'init', 'piano_block_register' );
```

- **Header (req 10, 11):** a `/** … */` docblock at the very top with the recognized fields. `Requires at least: 6.3` and `Requires PHP: 7.4` are the declared floors; `License: GPL-2.0-or-later` (SPDX, matching `package.json`) with the conventional GPL-2.0 `License URI`; `Text Domain: piano-block` matches `block.json` `textdomain`. `Plugin URI` points at the repo (gives the admin a "Visit plugin site" link). `Author URI` and `Update URI` are intentionally omitted.
- **Plugin display name is "Piano Block"** (Title Case product name in the admin Plugins list), distinct from the block *title* `"Piano"` and the *slug* `piano-block`. The plugin Description is verb-framed ("Registers the Piano block — …"), deliberately distinct from the block-framed `block.json` description.
- **Registration (req 11, 12; AC1):** a named, prefixed function `piano_block_register()` on the `init` hook calls `register_block_type( __DIR__ )`. A named function (over an anonymous closure) is the canonical form, is removable (`remove_action`) and testable, and prefixing avoids the global PHP function-namespace collision. `register_block_type( __DIR__ )` (path form, available since WP 5.8 ≪ the 6.3 floor, so no `function_exists` guard) is the modern call; given a path it internally delegates to `register_block_type_from_metadata()`, so that need not be called directly. `__DIR__` is the directory containing this file = the repo root = where `block.json` lives.
- **ABSPATH guard** sits immediately after the header docblock and before any code (WordPress parses the header comment without executing the file, so the guard must follow it).
- **Deliberately omitted** (unnecessary for a block scaffold and/or deferred): activation/deactivation hooks (no DB/options/rewrites/cron to set up — AC1 needs none), `load_plugin_textdomain()` (core auto-loads since WP 4.6; deferred per spec), `uninstall.php` (nothing persisted), `wp_set_script_translations()` (deferred), and any class/constant/autoloader scaffolding.

### 3.6 `style.css` — minimal placeholder styles (front end + editor)

```css
/**
 * Piano block — placeholder styles (applied in the editor and on the front end).
 * Minimal scaffold styling; the real piano UI will replace this.
 */

.wp-block-piano-block-piano {
	border: 1px dashed #767676;
	padding: 1em;
	color: #767676;
}
```

- **Wrapper-class selector** `.wp-block-piano-block-piano` is what WordPress generates for the block (`wp-block-` + the block name with `/`→`-`); it is exactly the class emitted by `get_block_wrapper_attributes()` (PHP) and `useBlockProps()` (JS), so a single selector styles both the front-end and editor wrappers.
- **Neutral "scaffold slot" affordance only** (req 7): a dashed muted-gray border, padding, and muted text — the CSS equivalent of the "placeholder" copy. No piano-specific or decorative styling, so it stays clear of out-of-scope visual design while making the block unmistakable in the editor and on the front end (strengthening AC3 and AC5).
- **Biome-clean (req 9):** standard properties; must not be an empty rule block (Biome `recommended` flags `noEmptyBlock`). Tab-indented; `biome check --write` is idempotent on this file (verified).

## 4. Interfaces & data flow

**Registration (server, once per request, on `init`):**
`piano-block.php` → `add_action( 'init', 'piano_block_register' )` → `register_block_type( __DIR__ )` → reads `block.json` → registers the block type and:
- registers the editor script from `editorScript: file:./index.js`, reading `index.asset.php` for its dependency handles and version (the version becomes the script's `?ver=` cache-buster);
- registers the stylesheet from `style: file:./style.css` under an auto-generated handle (`wp-block-piano-block-piano-style`); its `?ver=` comes from `block.json`'s top-level `version` for this non-core block (or `filemtime` when `SCRIPT_DEBUG` is on);
- registers the render callback from `render: file:./render.php`.

**Editor (browser, iframe):** WordPress enqueues `index.js` and its dependency handles (`wp-blocks`, `wp-block-editor`, `wp-element`, `wp-i18n`) into the editor iframe. `index.js` calls `wp.blocks.registerBlockType("piano-block/piano", { edit })`. On insertion, `edit()` renders `<p>` + `useBlockProps()` + the translated editor placeholder string. `style.css` is enqueued in the editor too (the block looks the same as on the front end).

**Save (browser → post content):** because `save` is omitted, the editor persists only the block delimiter comment (`<!-- wp:piano-block/piano /-->`) — no block markup — and skips block-markup validation (AC4).

**Front end (server → HTML):** for each block instance in published content, WordPress invokes `render.php` with `$attributes` / `$content` / `$block` in scope. It echoes `<p>` + `get_block_wrapper_attributes()` + the translated front-end placeholder string. `style.css` is enqueued on the front end.

**Version coupling (maintenance note):** the conceptual plugin version `0.1.0` is declared in **four** places that must move together on each release: the plugin header `Version`, `package.json` `version`, `index.asset.php` `version` (editor-script cache-bust), and `block.json` top-level `version` (stylesheet cache-bust). The asymmetry — script version in the sidecar, style version in `block.json` — is inherent to how WordPress versions block assets.

## 5. Key decisions (with alternatives & trade-offs)

| # | Decision | Alternatives considered | Why this choice |
|---|---|---|---|
| 1 | **Pure dynamic block; `save` omitted** | `save: () => null` (explicit); a static or hybrid block | Omitting `save` is the documented canonical dynamic shape (stores no markup, validation-exempt) and matches the issue's `render.php` intent; explicit `null` is redundant; static/hybrid would store markup the scaffold doesn't want (req 2–3, AC4). |
| 2 | **No-build, plain JS on `wp.*` globals** | `@wordpress/scripts` + JSX build | No-build is the only option honoring the Biome-only / plain-CSS / minimal intent; officially supported and installable; Biome lints everything as-authored (req 6, 9). Build deferred — see §6. |
| 3 | **Flat root layout** | `src/` subfolder | Nothing copies `src/`→`build/` without a build; flat root matches the canonical no-build example and avoids a phantom build model (D1.1). |
| 4 | **`index.js` + `const`-destructuring + method shorthand** | `block.js` name; bare `var el = …`; fully-qualified inline; arrow `edit: () => …` | Passes Biome `recommended` with zero diagnostics (probe-verified): no unused vars, `const`, method shorthand avoids `useArrowFunction`. `index.js` basename and import-shaped destructuring minimize churn if a build is later adopted (§6). |
| 5 | **No `biome.json` change; no `globals` entry** | Add `"javascript": { "globals": ["wp"] }`; add `/* global wp */` | `noUndeclaredVariables` is not in Biome's `recommended` set, so `wp` is not flagged (probe-verified). Honors req 9 literally (no tooling/config added). |
| 6 | **Icon `format-audio`** | `media-audio`, `album`, `playlist-audio`; a custom SVG | No `piano` dashicon exists; `format-audio` is the clearest music glyph and minimal (bare slug). A custom SVG is reserved for the real piano (req 13). |
| 7 | **Ship one minimal `style.css` (both contexts)** | Ship nothing (style-free); `style.css` + editor-only `editor.css` | A neutral placeholder slot strengthens AC3/AC5 and proves the CSS-wiring path the future piano uses, while staying out of "design"; one `style` (vs a split) is minimal and gives editor/front-end parity. The spec permits either (req 7); style-free remains a valid fallback. |
| 8 | **Add `block.json` top-level `version`** | Omit it (CSS `?ver=` falls back to WP core version) | Gives the stylesheet a plugin-tied cache-buster, parallel to the script's sidecar version. Small, deliberate coupling documented in §4. |
| 9 | **ABSPATH guard only on `piano-block.php`** | Guard on every PHP file; guard on none | The entry file can be requested directly and defines hooks → conventional hardening point; `render.php`/`index.asset.php` are pure partial/data files where canonical templates omit the guard. |
| 10 | **Named prefixed `init` function** | Anonymous closure | Canonical; removable/testable; slug prefix avoids global-namespace collisions (closure is valid but less conventional for an entry point). |
| 11 | **Placeholder copy: parallel "editor"/"front-end" pair** | create-block default "…hello from the editor!"; non-parallel descriptive copy | Same stem with one discriminating word lets a smoke-tester instantly tell AC3 (editor) from AC5 (front end); reads honestly as a scaffold (resolves spec open item 25). |

## 6. The build tension — deliberate resolution

**Chosen approach:** **no-build now**, with a documented, low-cost path to `@wordpress/scripts build` (retaining Biome for lint/format) when the real-piano front-end interactivity lands. Recorded deliberately, per the spec's instruction to acknowledge this tension rather than resolve it by accident.

**Why no-build now:** it is the only option honoring the issue's "minimal, Biome-only, plain-CSS, scaffold-only" intent (req 6–9); it is officially supported and fully installable; and there is nothing in the scaffold (no interactivity, no multi-key UI, no npm dependency) that a build would benefit today — a build would be pure overhead against the explicit minimalism.

**Trade-off, stated honestly:** the cost of no-build is verbose `wp.element.createElement` (vs JSX) and a hand-written `index.asset.php` — both trivial at scaffold scale. The benefit is zero new dependencies/toolchain and Biome linting everything as-authored, with nothing to rip out later. JSX ergonomics and npm imports are deferred along with the build.

**Migration is LOW cost — the scaffold is a strict subset of the built layout.** When a build is adopted (e.g. via `@wordpress/scripts`):
- `piano-block.php` carries over with a one-line edit: `register_block_type( __DIR__ )` → `register_block_type( __DIR__ . '/build' )`.
- `block.json`, `render.php`, `style.css` move to `src/` (webpack copies them to `build/`); their content carries over; `block.json` `file:` refs stay relative and unchanged.
- `index.js` moves to `src/index.js` and is extended from `wp.*` + `createElement` into `import { … } from "@wordpress/…"` + JSX — and because the scaffold already uses import-shaped destructuring, this is an evolution, not a rewrite. (The substantive new code is the piano UI itself, not migration overhead.)
- `index.asset.php` is **deleted** (webpack auto-generates `build/index.asset.php`) — the only true throwaway (~6 lines).
- `package.json` gains `@wordpress/scripts` + `build`/`start` scripts; `.gitignore` gains `build/`.
Nothing authored now must be *undone* — only moved or extended.

**Biome survives a build (the middle path is preserved):** `@wordpress/scripts`' `build`/`start` commands are independent of its `lint`/`format` commands, so a future build can run `wp-scripts build` for bundling while **keeping Biome** for lint/format. Choosing no-build now does not lock the repo out of its Biome-only identity later. (One future check at that time: prefer authoring JSX in `.jsx` for cleanest Biome handling.)

**The flip trigger — introduce a build WHEN any of:**
1. the block needs **front-end interactivity** (the Interactivity API / `viewScriptModule` / a playable keyboard) — the expected primary driver;
2. the **editor UI grows non-trivial** enough that JSX materially beats `createElement` (a keyboard of keys, inspector controls);
3. the block must **`import` an npm package** (e.g. an audio/synth library) that requires bundling;
4. (softer) the team wants **TypeScript** or generator-heavy async store code.

The Interactivity API does not *strictly* mandate a bundler (its package is a registered script module resolvable via an import map), but its only-documented workflow, JSX editor ergonomics, generator-based async actions, optional TypeScript, and any npm audio dependency together make a build the practical requirement once the playable piano lands. **Adopting the Interactivity API also raises `Requires at least` from 6.3 to 6.5** (the script-modules / `viewScriptModule` floor) — a known forward step, not rework.

## 7. Dependencies & environment

- **Runtime (WordPress):** WordPress **6.3+** (Block API v3 iframe editor; the `render` property), PHP **7.4+**. Declared in the plugin header.
- **WordPress script handles** the editor script depends on (provided by core, declared in `index.asset.php`): `wp-blocks`, `wp-block-editor`, `wp-element`, `wp-i18n`. No bundled or npm runtime dependencies.
- **Repository tooling (unchanged):** Biome `2.4.16` (the only dev dependency), Node 24 LTS / npm 11+. **No new dependency, no `biome.json` change.** `package.json` `version` stays `0.1.0` (already matches the declared plugin version); the existing `lint`/`format`/`check` scripts cover the new JS/JSON/CSS files. The PHP files are outside Biome's processing set.
- **`.gitignore`:** no change required for the scaffold (it already ignores `node_modules/`, editor/OS noise, `.env*`; there is no `build/` to ignore yet). A future build would add `build/`.
- **No committed local WordPress environment** (`.wp-env.json` / `@wordpress/env`); verification uses any local WordPress install (Out of Scope).

## 8. Failure modes & observability

The scaffold has no runtime logic of its own beyond registration and emitting placeholders, so the failure surface is small and maps directly to the five-point smoke test (the acceptance bar). There is no logging/telemetry to add; "observability" here is what a tester/administrator can directly see.

| Failure mode | How it would surface | Design mitigation |
|---|---|---|
| Plugin fatals or warns on activation | PHP fatal/notice on activation, or under `WP_DEBUG` | Minimal entry file: header + guard + one `init` hook; `register_block_type( __DIR__ )` is guaranteed present on the 6.3 floor (no version guard needed). No activation hook, DB, or options to fail. → **AC1**. |
| Block missing from inserter or wrong category | Not found by title; not under Media | `name`, `title`, and `category: media` in `block.json`; `keywords` broaden discoverability; registered on `init`. → **AC2**. |
| Editor placeholder errors / blank | JS console error; nothing renders on insert | `index.js` uses only core-provided handles declared in `index.asset.php`; idiom is Biome-clean and uses standard `wp.*` APIs; iframe injection is automatic via `editorScript`. → **AC3**. |
| "Invalid content" on save | Block-validation warning; stored block markup | `save` omitted → only the delimiter comment persists, validation skipped. → **AC4**. |
| Front-end PHP error or `WP_DEBUG` notice | PHP error/notice on the published page | `render.php` echoes the already-escaped wrapper string directly (no double-escape) and touches no undefined array keys/`$block` properties (PHP 8.4 `E_ALL`-clean by construction). → **AC5**. |
| Stale cached JS/CSS after a change | Browser serves an old asset | Editor-script `?ver=` from `index.asset.php` `version`; stylesheet `?ver=` from `block.json` `version`; both bumped per release (and `filemtime`-busted under `SCRIPT_DEBUG`). |
| Lint/format drift | `npm run check`/`lint` reports diagnostics | `index.js`, `block.json`, `style.css` are authored in Biome's stable, zero-diagnostic form (each probe-verified idempotent under `--write`); PHP files are skipped by Biome. |

**Verification step for the plan/code phase:** run `npm run check` (or `npm run lint`) and confirm zero diagnostics and that the three Biome-processed files are byte-unchanged; then perform the five-point manual smoke test against a local WordPress install with `WP_DEBUG` on.

## 9. Traceability to the spec

- **req 1** (one block, API v3) → §3.1 (`name`, `apiVersion: 3`); **req 2–3** (dynamic, no saved markup) → §3.2 (omit `save`), §3.4, §4 (save flow), AC4; **req 4** (minimal valid front-end output) → §3.4; **req 5** (basic editor placeholder, `useBlockProps`, no SSR) → §3.2.
- **req 6** (no-build, `wp.*`) → §3.2, §6; **req 7** (plain CSS, optional/minimal) → §3.6, decision 7; **req 8** (explicit deps + version via sidecar) → §3.3; **req 9** (passes existing Biome, no new tooling) → §3.2/§3.6 (Biome-clean idioms), decision 5, §7.
- **req 10–11** (installable plugin header, `init` registration) → §3.5; **req 12** (register from metadata file) → §3.5, §4; **req 13** (identity/presentation, `media` category, icon/description) → §3.1, decision 6; **req 14** (minimal i18n) → §3.1 (metadata auto-translation), §3.2/§3.4 (`__`/`esc_html_e`), deferral of `wp_set_script_translations`.
- **AC1–AC5** → §8 (failure-mode table maps each criterion).
- **Out of Scope** (real piano, build pipeline, `wp-env`, tests, custom category, extra blocks/attributes, full JS translation loading) → honored throughout; the build pipeline is the subject of the deliberate §6 resolution.
- **Spec open items:** 25 (placeholder copy + icon/description/keywords) → §3.1, §3.2, §3.4, decisions 6 & 11; 26 (ship CSS or not) → §3.6, decision 7; 27 (`Requires PHP` 7.4 vs 8.0) → kept at 7.4 per the spec's own decision (no design change).

## 10. Open questions

None blocking. All consequential HOW decisions are settled and evidence-backed (see `design-doc-research.md`). Minor, deliberately-deferred items the plan/code phase should simply carry forward:

- **Verification environment is unspecified by design** — any local WordPress 6.3+/PHP 7.4+ install suffices; committing a `wp-env` config is a future convenience (Out of Scope).
- **Version-sync discipline** — the `0.1.0` in the plugin header, `package.json`, `index.asset.php`, and `block.json` must be bumped together on future releases (§4). This is a maintenance convention, not an open design question.
- **`format-audio` icon and the placeholder copy are reversible defaults** — if the eventual product wants a custom SVG piano icon or different copy, that is a trivial, isolated change.
