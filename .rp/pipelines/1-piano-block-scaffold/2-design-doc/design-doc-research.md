# Design Research: Piano block scaffold

> Phase 2 working record — the running Q&A and decisions that produce the design (the HOW). Source of intent: `1-spec/spec.md` (approved) and its `1-spec/requirements.md`. Each question is sent one-at-a-time to `design-doc-researcher`; answers and decisions are recorded here in real time. The final, consolidated design doc is `2-design-doc/design-doc.md`.

## What the spec already fixed (inputs, not open questions)

These are settled by the approved spec / requirements and are **not** re-litigated here; the design only has to choose the concrete HOW that satisfies them:

- **Shape:** one dynamic, server-rendered block `piano-block/piano`, Block API **v3**; `save` → `null` (no saved markup, validation-exempt); front end emitted by **`render.php`** wired as `"render": "file:./render.php"`; `edit` is a static `useBlockProps()` placeholder, **no** `ServerSideRender`.
- **No-build:** editor JS is plain browser JS against `wp.*` globals — no JSX/webpack/Babel/`@wordpress/scripts`. Asset deps + version declared via a **hand-written `*.asset.php`**.
- **Styling:** plain CSS only (no SCSS); optional and minimal if present.
- **Tooling:** must pass the repo's existing **Biome** (`recommended` rules, tab indent, double-quoted JS); no new lint/format tooling. Biome gracefully skips `.php`.
- **Plugin:** standard installable plugin; header with at least `Plugin Name` plus recommended fields; `Requires at least: 6.3`, `Requires PHP: 7.4`, `License: GPL-2.0-or-later`; register on **`init`** via `register_block_type( __DIR__ )`; `block.json` carries identity/presentation incl. `category: media`, `icon`, `description`, `textdomain` matching the plugin Text Domain.
- **i18n minimal:** `textdomain` + matching header (free metadata translation); wrap user-facing JS strings in `__()`; defer `wp_set_script_translations()` / `load_plugin_textdomain()`.
- **Out of scope:** real piano (keys/audio/visual/input/Interactivity API/`viewScript`), JS build pipeline, committed `wp-env`, automated tests, custom block category, extra blocks/attributes/controls/variations, full JS translation loading.

## Repo grounding (verified from the worktree)

- `biome.json`: `formatter.indentStyle: "tab"`, `javascript.formatter.quoteStyle: "double"`, `linter.rules.recommended: true`, `vcs.useIgnoreFile: true`, `files.ignoreUnknown: false`, `assist … organizeImports: on`. Biome version 2.4.16.
- `package.json`: name `piano-block`, `private: true`, `license: GPL-2.0-or-later`, engines Node ≥24 / npm ≥11, scripts `lint` / `format` / `check` (all `biome …`). Only dev dep is Biome.
- `.gitignore` ignores `node_modules/`, logs, `.env*`, OS/editor noise, `.idea/`, `.vscode/`, `.claude/`.
- `.nvmrc`: `24`. `README.md`: "Just initialized … only the project tooling."
- Spec-review probe finding (carry into design): Biome's `recommended` ruleset flags **`noUnusedVariables`** on the bare `var el = wp.element.createElement` idiom — authored JS must use everything it declares.

## Open design questions to settle (HOW)

1. Concrete **directory/file layout** in this greenfield repo (root vs `src/` vs plugin subdir; main PHP filename; where `block.json`/`block.js`/`render.php`/`*.asset.php`/CSS sit) — and how that anticipates (or not) a future `build/`.
2. **`block.json`** exact fields + values, asset **handle naming**, and `file:` paths.
3. **`block.js`** exact no-build `wp.*` idiom that passes Biome `recommended` (the `noUnusedVariables` gotcha) + `__()` usage.
4. **`*.asset.php`** exact `dependencies` + `version` strategy.
5. **`render.php`** exact minimal markup (wrapper + placeholder).
6. **Plugin bootstrap PHP** — header fields/values + `init` registration form.
7. **Plain CSS** — ship or not; if yes, files + wiring + what rules.
8. Deliberate resolution of the **no-build-now vs future-build** tension (rationale + trade-offs + the trigger that would flip it).

---

## Q&A

_One question at a time, each backed by research from `design-doc-researcher`. Recorded in real time below._

### Q1 — Concrete directory/file layout for a no-build single-block plugin

**Asked:** Where does `block.json` live and what does `register_block_type( __DIR__ )` resolve to with no build? Conventional file set/naming? `file:` path + `*.asset.php` sibling rules? Flat-root vs `src/`?

**Researcher answer (high confidence; verbatim from primary sources):**

- **(a) Flat root.** In a no-build plugin, `block.json`, the main PHP, editor JS, `*.asset.php`, and `render.php` all sit in one directory; since the repo *is* the plugin, that's the repo root. `register_block_type( __DIR__ )` registers the directory holding `block.json` (= root). The `__DIR__`→`/build` indirection exists *only* because `@wordpress/scripts` copies `src/`→`build/` and ships `block.json` into `build/`; with no build, nothing is copied, so you register the root directly. Canonical example tree — `WordPress/block-development-examples` plugin `minimal-block-no-build-e621a6`: `block.asset.php`, `block.js`, `block.json`, `package.json`, `plugin.php`, `README.md` all flat. Its `plugin.php` = `register_block_type( __DIR__ );` on `init`; `block.json` = `apiVersion 3`, `editorScript: file:./block.js`, `category: media`. ⚠️ Caveat: that example is **not dynamic** (no `render.php`; asset deps only `wp-blocks`) — it proves layout/registration/naming but not the dynamic shape. The dynamic + plain-CSS + `render.php` reference is the `create-block` **`es5`** template.
- **(b) File set/naming.** Main PHP: no-build example uses `plugin.php`; `create-block` uses `<slug>.php` (`$slug.php.mustache`) — both idiomatic. Editor JS: `block.js` (no-build ex.) or `index.js` (create-block default). Sidecar: **`<jsbasename>.asset.php`**, sibling to the JS file (`block.js`→`block.asset.php`; `index.js`→`index.asset.php`). Server render: `render.php`. CSS: create-block es5 ships **plain `.css`** — `style.css` (front+editor) + `editor.css` (editor-only), exactly our no-SCSS constraint. (The JSX `block` template uses `.scss`; the **es5** template uses `.css`.)
- **(c) `file:` resolution.** Block-metadata reference, verbatim: *"The `WPDefinedPath` type … represents a path to a JavaScript, CSS or PHP file relative to where the `block.json` file is located."* So flat-root values are `"editorScript": "file:./index.js"`, `"render": "file:./render.php"`, etc. Sidecar rule, verbatim: *"stored inside a separate PHP file which ends with `.asset.php` and is located next to the JS/CSS file listed in `block.json`. WordPress will automatically detect this file through pattern matching."* The sidecar returns `array( 'dependencies' => [...], 'version' => '...' )`.
- **(d) Flat-root vs `src/`.** No official doc mandates `src/` for a no-build plugin; the canonical no-build example is flat-root. `src/`→`build/` is purely a `@wordpress/scripts` build convention. A `src/` subfolder *would* work with no build (register `__DIR__ . '/src'`, `file:` stays relative to that `block.json`) but has **no upside and two downsides**: it imports a build mental model that doesn't exist here, and adds a needless path indirection. Researcher recommends **flat root**, matching the canonical example; introduce `src/`→`build/` only if/when the future piano task adopts a bundler.

**Sources:** [no-build example](https://github.com/WordPress/block-development-examples/tree/trunk/plugins/minimal-block-no-build-e621a6) · [create-block es5 template](https://github.com/WordPress/gutenberg/tree/trunk/packages/create-block/lib/templates/es5) · [block-metadata reference](https://developer.wordpress.org/block-editor/reference-guides/block-api/block-metadata/)

**DECISIONS (analyst):**

- **D1.1 — Flat-root layout.** The plugin lives at the repo root; `register_block_type( __DIR__ )` registers the root. Matches the canonical no-build example and the "minimal, no-build" intent; avoids a phantom `src/`/`build/` split.
- **D1.2 — Main plugin PHP = `piano-block.php`** (`<slug>.php` convention). More recognizable as *the* plugin file for a single-plugin repo than generic `plugin.php`; matches `create-block`'s `<slug>.php` convention and the `package.json` name `piano-block`.
- **D1.3 — Editor JS = `index.js`; sidecar = `index.asset.php`.** Chose `index.js` over `block.js` deliberately: it is the `create-block` default, so **if the future build task adopts `@wordpress/scripts` its `src/index.js`→`build/index.js` flow aligns with this basename**, minimizing rename churn at the build-introduction moment (directly serves the named tension, see Q8). Sidecar basename *must* equal the JS basename → `index.asset.php` (hard rule from the metadata reference).
- **D1.4 — Committed tree (target):**
  ```
  piano-block/                 (repo root = plugin root)
  ├── piano-block.php          # main plugin file: header + init registration
  ├── block.json               # apiVersion 3; name piano-block/piano; render+editorScript+styles
  ├── index.js                 # no-build editor JS (wp.* globals)
  ├── index.asset.php          # hand-written sidecar (deps + version) — basename matches index.js
  ├── render.php               # server render (get_block_wrapper_attributes())
  ├── style.css                # OPTIONAL plain CSS (front + editor) — decided in Q7
  ├── editor.css               # OPTIONAL plain CSS (editor only) — decided in Q7
  └── (existing) package.json, biome.json, .nvmrc, README.md, .gitignore, package-lock.json
  ```
  Whether `style.css`/`editor.css` ship at all (and their wiring) is deferred to Q7.

### Q2 — Exact no-build `index.js` idiom + how it survives Biome `recommended`

**Asked:** The correct no-build `wp.*` call shape; whether `save` is omitted or `() => null`; `useBlockProps` in no-JSX form; and — critically — reasoning about each Biome `recommended` rule that could bite (`noUnusedVariables`, `noUndeclaredVariables` on `wp`, `noVar`/`useConst`, `useArrowFunction`, side-effect calls), plus a Biome-clean sketch. Whether a `biome.json` `globals` entry is needed.

**Researcher answer (HIGH confidence — empirical: installed Biome 2.4.16, ran live `biome check` against the repo's exact `biome.json`, only the `vcs` block removed since the probe dir isn't a git repo):**

- **(a) `save` → OMIT entirely.** Block Edit/Save reference, verbatim: *"If left unspecified, the default implementation will save no markup in post content for the dynamic block, instead deferring this to always be calculated when the block is shown on the front of the site."* The `create-block` **es5** template gates its `save` behind `{{#isStaticVariant}}` — the dynamic variant ships no `save`. `save: () => null` is *also* probe-clean but redundant. Call shape confirmed: `wp.blocks.registerBlockType(name, { edit })`, `wp.element.createElement(tag, props, …children)`, `wp.blockEditor.useBlockProps()`, `wp.i18n.__(text, domain)`. `edit` is effectively required (it's what the editor renders).
- **(b) `useBlockProps` no-JSX form.** `createElement("p", useBlockProps(), …children)` — the blockProps object IS the 2nd (props) argument. `useBlockProps()` with no args is correct for a static placeholder; calling it inside `edit` satisfies the hook rule (render context). (`useBlockProps.save()` is the save-side form, irrelevant here since no `save`.)
- **(c) Biome `recommended` — empirical probe matrix:**
  | Candidate | `biome check` (Biome 2.4.16, repo config) |
  |---|---|
  | es5 verbatim (`var` + `function(){}` + IIFE) | **FAIL** — `lint/complexity/useArrowFunction` ×2 + formatter diffs |
  | `const` **destructuring** + method shorthand `edit(){}` | **PASS, 0 diagnostics** |
  | `const` per-method alias | **PASS, 0 diagnostics** |
  | fully-qualified inline (no `wp` alias) | **PASS, 0 diagnostics** |
  | + one unused alias (`Fragment`) | `noUnusedVariables` **warning** (exit 0 but real) |
  | + explicit `save: () => null` | **PASS, 0 diagnostics** |
  - **`noUndeclaredVariables` on `wp`: NOT a problem and NOT in `recommended`.** Decisive probe: a file with only `someUndeclaredGlobal.doStuff();` passes with zero diagnostics under `recommended: true`. So the global `wp` is **not** flagged → **no `/* global */` comment, no `javascript.globals` entry, no `biome.json` change.**
  - **`noUnusedVariables`:** fires (warning) only if you declare an alias you don't use; declare exactly the four used (`registerBlockType`, `createElement`, `useBlockProps`, `__`). This is what tripped the earlier spec-review probe (the longer example aliased `Fragment`/`RichText` etc. unused).
  - **`noVar`/`useConst`:** `var` is *not* flagged by `recommended`, but use `const` anyway (cleaner/idiomatic).
  - **`useArrowFunction`:** the one that bites es5 — `function(){}` not using `this` → rewritten. Use method shorthand `edit() {}` (not flagged) or arrows.
  - **Side-effect `registerBlockType(...)` call (no assignment): clean** — Biome doesn't require handling the return.
  - `biome check --write` is **idempotent** on the recommended sketch (byte-identical after write).
- **(d) Probe-verified sketch (exit 0, idempotent under `--write`):**
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
  			__("Piano – hello from the editor!", "piano-block"),
  		);
  	},
  });
  ```
  Per-method alias is equally clean; researcher leans **destructuring** (closest to the `import { … } from "@wordpress/…"` it would become if a build is ever added — ties to Q8).
- **Runtime contract reminder:** the four globals require `*.asset.php` deps `wp-blocks`, `wp-element`, `wp-block-editor`, `wp-i18n` (Biome only checks JS source, not handle resolution) — confirmed in Q4.

**Sources:** [es5 no-JSX template](https://github.com/WordPress/gutenberg/blob/trunk/packages/create-block/lib/templates/es5/index.js.mustache) · [Block Edit/Save reference (save-omitted default)](https://developer.wordpress.org/block-editor/reference-guides/block-api/block-edit-save/) · [useBlockProps](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-block-editor/#useblockprops) · **live `biome check` probes, Biome 2.4.16, repo `biome.json`.**

**DECISIONS (analyst):**

- **D2.1 — Omit `save` entirely** (canonical dynamic shape; documented to save no markup → satisfies spec req 3 and Acceptance Criterion 4 "only the delimiter comment persists, no invalid-content warning"). Do **not** write `save: () => null`.
- **D2.2 — Idiom: `const` destructuring of the four `wp.*` namespaces + method-shorthand `edit() {}`.** Authored as the probe-verified sketch above: declare exactly `{ registerBlockType }`, `{ createElement }`, `{ useBlockProps }`, `{ __ }` (no unused aliases → no `noUnusedVariables`), use method shorthand (avoids `useArrowFunction`), `const` not `var`, double-quoted, tab-indented. Reads closest to a future `import { … } from "@wordpress/…"` if a build lands (Q8).
- **D2.3 — NO `biome.json` change.** `noUndeclaredVariables` is not in `recommended`; the global `wp` is not flagged. This honors spec req 9 ("no new lint/format tooling added") literally — we add nothing to the config. (A `"javascript": { "globals": ["wp"] }` entry is *unnecessary*; we deliberately do not add it.)
- **D2.4 — Editor placeholder string** is wrapped in `__( "<copy>", "piano-block" )`. Final copy decided alongside front-end copy in Q5/Q6 for a consistent, recognizably-"Piano" voice (the create-block default "…hello from the editor!" is a placeholder to replace). Text domain `piano-block` (matches plugin Text Domain, Q6).
- **D2.5 — `npm run lint` / `npm run check` must be clean (no warnings either).** Although `noUnusedVariables` is only a warning (exit 0), the design target is **zero diagnostics**, so the authored file ships no unused aliases. Plan/code phase should run `npm run check` and confirm byte-idempotence.

### Q3 — Exact `render.php`: markup, escaping, WP_DEBUG-cleanliness, PHP i18n, copy

**Asked:** Variables in scope + wrapper idiom (and whether `get_block_wrapper_attributes()` needs `esc_attr()`); WP_DEBUG-clean concerns; PHP-side i18n idiom for the placeholder string; whether `render.php` carries an ABSPATH guard; and recommended editor-vs-front-end placeholder copy.

**Researcher answer (HIGH confidence — verbatim-canonical idiom + a live PHP 8.4 `E_ALL` probe):**

- **(a) In scope + wrapper.** `render.php` receives `$attributes` (array), `$content` (string), `$block` (WP_Block) — documented in the canonical template's own header comment. Canonical create-block **dynamic** body (es5 and JSX render bodies are byte-identical):
  ```php
  <p <?php echo get_block_wrapper_attributes(); ?>>
  	<?php esc_html_e( '{{title}} – hello from a dynamic block!', '{{textdomain}}' ); ?>
  </p>
  ```
  **Echo `get_block_wrapper_attributes()` directly — do NOT `esc_attr()` it.** The function reference: it *"returns an already-escaped string of HTML attributes … can be safely inserted directly into an opening tag without additional escaping"* (internally does `esc_attr($value)` per attribute). Wrapping in `esc_attr()` would **double-escape** (`"`→`&quot;`) — a bug.
- **(b) WP_DEBUG-clean — empirically verified (PHP 8.4.6, `error_reporting(E_ALL)`, custom handler).** Minimal static-string body with `$attributes`/`$content`/`$block` **in scope but untouched** → **ZERO diagnostics**. The only anti-pattern: touching an undefined array key (e.g. `$attributes['label']` never set) → PHP 8+ `E_WARNING` (`Undefined array key`), which can cascade to a `TypeError` fatal. **Our placeholder accesses no array keys → clean by construction.** (Future attribute reads should use `$attributes['x'] ?? $default` — flagged for the eventual piano task, not now.)
- **(c) PHP i18n.** Use **`esc_html_e( "<copy>", "piano-block" )`** inside the wrapper — escape + translate + echo in one (the `_e` suffix echoes; `esc_html_` escapes an HTML text node). This is exactly what the canonical dynamic `render.php` uses. (If a returned value were needed instead of echo, it'd be `esc_html__()`.) Text domain **must be `"piano-block"`** matching plugin header `Text Domain` + `block.json` `textdomain` + all `__()`/`esc_html_e()` calls. **Nothing else needed for the scaffold:** `register_block_type` auto-translates `block.json` metadata (`title`/`description`/`keywords`) via `textdomain` (since WP 5.7); for PHP strings, core auto-loads translations since WP 4.6 so no `load_plugin_textdomain()` is required — and with no translation files present the string just returns English, no error. The string is translation-*ready*, full stop (matches spec req 14 + deferral).
- **(d) ABSPATH guard.** **Canonical: `render.php` does NOT carry the guard** (create-block es5+JSX render templates omit it; it's a pure output partial, loaded only by WP during render, defines nothing). The guard convention belongs on the **main plugin file** (`piano-block.php`), which *can* be requested directly and defines hooks/functions — `defined( 'ABSPATH' ) || exit;`, one line. Researcher recommends following canonical: guard on plugin file, not `render.php`.
- **(e) Copy (researcher suggestion).** Parallel pair, same stem, one discriminating word: editor `"Piano block — editor placeholder"`, front end `"Piano block — front-end placeholder"`. Reads unmistakably as the scaffold, lets a smoke-tester tell AC3 (editor) from AC5 (front end). Em-dash `—` confirmed **Biome-clean** in the JS `__()` string and matches create-block's own `–`; a hyphen is an ASCII-only alternative.

  Ready-to-adapt `render.php` (canonical body + our copy + text domain):
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

**Sources:** [create-block dynamic render.php (es5)](https://github.com/WordPress/gutenberg/blob/trunk/packages/create-block/lib/templates/es5/render.php.mustache) · [get_block_wrapper_attributes() reference](https://developer.wordpress.org/reference/functions/get_block_wrapper_attributes/) · [block-metadata `render`](https://developer.wordpress.org/block-editor/reference-guides/block-api/block-metadata/#render) · **live PHP 8.4 `E_ALL` probe.**

**DECISIONS (analyst):**

- **D3.1 — Wrapper:** single `<p>` with `<?php echo get_block_wrapper_attributes(); ?>` echoed directly into the opening tag, **no `esc_attr()`** (already escaped; double-escaping is a defect). Satisfies spec req 4 / AC5 "single wrapper element carrying standard block wrapper attributes."
- **D3.2 — Body is a single static translated string, no array/`$block` access.** Empirically WP_DEBUG-clean (PHP 8.4 `E_ALL`, zero diagnostics) → satisfies AC1/AC5 "no PHP notices/warnings under `WP_DEBUG`." Do not read `$attributes[...]`/`$content`/`$block->...` in the scaffold.
- **D3.3 — PHP i18n:** `esc_html_e( "<front-end copy>", "piano-block" )`. Translation-ready at zero cost; no `load_plugin_textdomain()` (deferred per spec). Text domain `piano-block`.
- **D3.4 — ABSPATH guard:** **omit in `render.php`** (canonical); **include `defined( 'ABSPATH' ) || exit;` on `piano-block.php`** (decided in Q6). Rationale: render.php is a pure partial loaded only by WP; the entry file is the conventional hardening point.
- **D3.5 — Placeholder copy FINALIZED (resolves spec open item 25):**
  - Editor (`index.js`): `__( "Piano block — editor placeholder", "piano-block" )`
  - Front end (`render.php`): `esc_html_e( "Piano block — front-end placeholder", "piano-block" )`
  - Keep the em-dash `—` (Biome-clean, WP-conventional). Parallel stem + single discriminating word ("editor" vs "front-end") makes the two surfaces instantly distinguishable during the smoke test while both read clearly as the Piano scaffold. This supersedes the create-block default copy referenced in D2.4.

### Q4 — Exact `index.asset.php`: dependency array + version strategy

**Asked:** Exact PHP return shape; the correct dep handles for our four `wp.*` usages (incl. whether `wp-element` is redundant via `wp-blocks`, and `wp-block-editor` vs legacy `wp-editor`); version strategy (literal vs `filemtime` vs `false`); ABSPATH guard?; and confirmation that `version` drives the enqueued `?ver=` cache-bust.

**Researcher answer (HIGH confidence — handle mapping verbatim from the canonical extraction tool; `$ver` semantics doc-backed; file shape validated via `php -l` + `include`):**

- **(a) Shape — confirmed.** Bare `<?php return array( 'dependencies' => array(...), 'version' => ... );`. WP auto-detects the sibling `*.asset.php`, **`include`s it**, and the file's top-level `return` value IS the mechanism (a PHP `include` evaluates to the returned value). WP reads two keys: `dependencies` + `version` (defaults if omitted: `[]` and `false`). Confirmed against the hand-written no-build `block.asset.php` (`array('dependencies'=>array('wp-blocks'),'version'=>'0.1')`) and the webpack-generated form (same two keys, version = content hash). Validated locally: `php -l` clean; `include` returns the expected array.
- **(b) Deps — list all four explicitly.** Authoritative mapping (dependency-extraction-webpack-plugin README, verbatim): *"`@wordpress/*` maps to `wp['*']` … with script handle `wp-*`."* So: `wp.blocks`→`wp-blocks`, `wp.element`→`wp-element`, `wp.blockEditor`→`wp-block-editor`, `wp.i18n`→`wp-i18n`. **`wp-block-editor` is correct** (`useBlockProps` lives in `@wordpress/block-editor`); **`wp-editor` is a different legacy package** (post-editor layer) — do not use it. **List `wp-element` explicitly — do NOT rely on it arriving transitively via `wp-blocks`:** the canonical extraction tool lists every package the source imports, transitive script deps are an undocumented detail that can change between WP versions (under-declaring would break silently), and WP dedupes handles so an explicit listing is free. Nothing missing/extra beyond these four.
- **(c) Version — literal `'0.1.0'`, kept in sync with plugin header `Version` + `package.json` `version`.** Rationale: (i) literal = explicit, predictable, busts cache exactly when you ship a change; (ii) `filemtime` is an anti-pattern for VCS/distributed plugins — mtimes aren't preserved across `git clone`/deploy, so every checkout busts the cache and identical code yields different `?ver=` across servers (defeats CDN caching, nondeterministic); (iii) `false` → WP injects the *core* version (wrong granularity — won't bust when *our* JS changes); `null` → no `?ver=` at all. So literal it is. Design note: plugin header `Version`, `package.json` `version`, and the sidecar `version` should move together on each release.
- **(d) ABSPATH guard — NO.** It's a pure data file with no side effects; webpack-generated `*.asset.php` never carry the guard (`<?php return array(...);`). A direct hit just evaluates a top-level `return` (harmless no-op, no output). Adding a guard would diverge from the generated form and is stylistically wrong for a data file. (Contrast: the main plugin file *does* get the guard — D3.4/Q6.)
- **(e) `version` → `?ver=` — confirmed, that's its sole job here.** WP reads the sidecar `version` and passes it as `$ver` to the editor-script registration, appending `?ver=<version>` to the `<script src>` URL. Block-metadata ref: version is *"used for cache busting … added to the URL as a query string"*; `wp_register_script` `$ver` ref confirms the cache-bust purpose. This is exactly why a literal version bumped per release (option i) is right — `?ver=` changes precisely when the shipped JS changes.

**Sources:** [dependency-extraction-webpack-plugin README (handle mapping + generated shape)](https://github.com/WordPress/gutenberg/tree/trunk/packages/dependency-extraction-webpack-plugin) · [block-metadata reference (.asset.php keys, defaults, version=cache-bust)](https://developer.wordpress.org/block-editor/reference-guides/block-api/block-metadata/) · [wp_register_script `$ver` semantics](https://developer.wordpress.org/reference/functions/wp_register_script/) · [@wordpress/block-editor (provides useBlockProps)](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-block-editor/) · [hand-written no-build block.asset.php](https://github.com/WordPress/block-development-examples/tree/trunk/plugins/minimal-block-no-build-e621a6) · **local `php -l` + `include` check.**

**DECISIONS (analyst):**

- **D4.1 — `index.asset.php` is committed verbatim as:**
  ```php
  <?php

  return array(
  	'dependencies' => array( 'wp-blocks', 'wp-block-editor', 'wp-element', 'wp-i18n' ),
  	'version'      => '0.1.0',
  );
  ```
  (No ABSPATH guard. Sibling of `index.js`; basename matches per D1.3.)
- **D4.2 — All four deps listed explicitly** (`wp-blocks`, `wp-block-editor`, `wp-element`, `wp-i18n`); no reliance on transitive `wp-element`. `wp-block-editor` (not `wp-editor`). These are the exact handles for the D2.2 idiom.
- **D4.3 — `version` literal `'0.1.0'`**, equal to the plugin header `Version` (Q6) and `package.json` `version`. The three are a single conceptual version that bumps together each release. Documented as a maintenance note in the design.
- **D4.4 — Biome note:** `index.asset.php` is a `.php` file → Biome skips it (verified by the spec-review probe). It does not need to satisfy JS lint rules. (The hand-written PHP files — `piano-block.php`, `render.php`, `index.asset.php` — are all outside Biome's processing set.)

### Q5 — Exact `block.json`: fields, values, icon, keywords, Biome treatment

**Asked:** The full key-by-key JSON in conventional order (incl. `$schema`/`apiVersion` integer/`textdomain` spelling); the `icon` (does a `piano` dashicon exist? bare slug vs `dashicons-` prefix?); `keywords` (auto-translated?); `description` copy; whether Biome reorders/rewrites `block.json` keys; and any `apiVersion: 3`/iframe no-build trap.

**Researcher answer (HIGH confidence — fields verbatim from the metadata reference; icon set verified against the Dashicons `codepoints.json` source; key-order settled by a live `biome check --write` probe):**

- **(a) Fields confirmed.** `$schema`: `"https://schemas.wp.org/trunk/block.json"`. `apiVersion`: integer **`3`** (unquoted). `name`: `"piano-block/piano"`. `title`: `"Piano"` (translatable). `category`: `"media"`. **`textdomain`** — lowercase, exactly that spelling (NOT `textDomain`) → `"piano-block"`. `editorScript`: `"file:./index.js"`, `render`: `"file:./render.php"` (`file:` relative to `block.json`). Conventional key order: `$schema`, `apiVersion`, `name`, `title`, `category`, `icon`, `description`, `keywords`, `textdomain`, then wiring (`editorScript`, [`editorStyle`, `style`], `render`).
- **(b) Icon — NO `piano` dashicon exists** (verified against `WordPress/dashicons/codepoints.json`; my `dashicons-piano` guess was wrong). Music/audio glyphs that actually ship: `format-audio` (eighth-note), `media-audio`, `album`, `playlist-audio`. **Researcher pick: `format-audio`** (plainest, most unambiguous "music" read). **Value is the BARE slug** → `"icon": "format-audio"`, NOT `"dashicons-format-audio"`. ⚠️ The Dashicons *resource page* says "pass `dashicons-{icon}`" — that's for the CSS-class context (admin menus), a different usage; `block.json` wants the bare slug (metadata ref example `"icon": "smile"`).
- **(c) Keywords — include `["piano", "music", "keyboard"]`.** Metadata reference: `keywords` is `string[]`, **`Localized: Yes`** → auto-translated via `textdomain` like `title`/`description`, no extra wiring. Improves inserter discoverability beyond the title (AC2). ~3 terms is the sweet spot; don't pad.
- **(d) Description — `"A placeholder Piano block — a scaffold for a future interactive piano."`** Accurate/honest scaffold copy, one sentence, shows in inserter/inspector, auto-translated via `textdomain` (metadata ref confirms `description` is translatable and auto-wrapped at registration). Same em-dash as the placeholder copy (consistent voice).
- **(e) Biome + `block.json` — does NOT reorder keys; idempotent (probed).** Authored the JSON in conventional WP order, tab-indented, ran Biome 2.4.16 with the repo config: `biome check` → 0 diagnostics, exit 0; `biome check --write` → **byte-identical, key order preserved.** `assist`/`organizeImports: on` only sorts JS/TS `import`/`export` statements — it has **no effect on JSON object property order**. The JSON formatter applies tabs + standard spacing and keeps a short array (`["piano", "music", "keyboard"]`) inline. So: author in conventional order; Biome leaves it stable. (Biome has no preferred JSON key order.)
- **(f) `apiVersion: 3` + no-build — no trap for our shape.** v3 = iframed editor (since WP 6.3); editor assets must be enqueued **via the block's `editorScript`/`editorStyle`** so WP injects them into the iframe — which is exactly our wiring (`block.json` + `register_block_type( __DIR__ )`). The globals (`wp.blocks`/`wp.element`/`wp.blockEditor`/`wp.i18n`) are available inside the iframe because their handles are our script's declared deps (Q4). The trap only hits people enqueuing editor JS the *old* way (`enqueue_block_editor_assets` + raw `wp_enqueue_script`) → lands in the outer doc, not the iframe. We don't do that. This is exactly why `Requires at least: 6.3` is the floor.

**Sources:** [block-metadata reference](https://developer.wordpress.org/block-editor/reference-guides/block-api/block-metadata/) · [Dashicons codepoints.json (no `piano`)](https://github.com/WordPress/dashicons/blob/master/codepoints.json) · [Dashicons resource (CSS-class prefix context)](https://developer.wordpress.org/resource/dashicons/) · **live `biome check --write` probe (key order preserved, idempotent).**

**DECISIONS (analyst):**

- **D5.1 — `block.json` committed in this exact shape** (style keys added/omitted per Q7), conventional WP key order, tab-indented, Biome-stable:
  ```json
  {
  	"$schema": "https://schemas.wp.org/trunk/block.json",
  	"apiVersion": 3,
  	"name": "piano-block/piano",
  	"title": "Piano",
  	"category": "media",
  	"icon": "format-audio",
  	"description": "A placeholder Piano block — a scaffold for a future interactive piano.",
  	"keywords": ["piano", "music", "keyboard"],
  	"textdomain": "piano-block",
  	"editorScript": "file:./index.js",
  	"render": "file:./render.php"
  }
  ```
- **D5.2 — Icon = `format-audio`** (bare slug). Took the researcher's reasoned pick; no `piano` dashicon exists, `format-audio` is the cleanest music glyph, reversible later (e.g. a custom SVG when the real piano lands). Resolves spec req 13's icon choice + open item 25.
- **D5.3 — Description + keywords FINALIZED** as above (resolves the wording side of open item 25). Both auto-translated via `textdomain` at zero cost (spec req 14).
- **D5.4 — Author `block.json` in conventional order; rely on Biome being a no-op on key order** (probe-proven). Plan/code phase still runs `npm run check` to confirm idempotence on the final file (which will include any Q7 style keys).
- **D5.5 — No `apiVersion: 3` special handling.** Iframe asset injection is automatic because we wire the editor script through `block.json`/registration. Confirms the WP 6.3 floor.

### Q6 — `piano-block.php`: header comment + `init` registration

**Asked:** Exact header docblock + field labels/values; named function vs closure for `init`; ABSPATH guard placement; whether `register_block_type( __DIR__ )` is safe bare on the 6.3 floor and is the modern call; and what the entry file conventionally carries that we should explicitly defer.

**Researcher answer (HIGH confidence — header labels verbatim from Plugin Header Requirements; call delegation doc-backed; file `php -l`'d AND functionally stub-tested that `init` fires `register_block_type( __DIR__ )`):**

- **⚠️ Correction to my premise:** the canonical no-build example uses a **NAMED, PREFIXED function**, not a closure (verbatim: `function minimal_block_no_build_e621a6___register_block() { register_block_type( __DIR__ ); }` + `add_action( 'init', '…' )`). So named-function aligns with canonical.
- **(a) Header.** `/** … */` docblock at the very top (right after `<?php`). Exact recognized labels (WP parses by these strings): `Plugin Name`, `Plugin URI`, `Description`, `Version`, **`Requires at least`**, **`Requires PHP`**, `Author`, `Author URI`, `License`, `License URI`, `Text Domain`, … Only `Plugin Name` is strictly required. Field guidance: **Plugin Name = "Piano Block"** (Title Case — it's a product name in the admin list; contrast block title `"Piano"` + slug `piano-block`). **Description** = a plugin-framed sentence (distinct from the block-framed block.json one): `"Registers the Piano block — a scaffold for a future interactive piano."` **Version 0.1.0** (synced w/ package.json + asset.php). **Author = "Mario Santos"** (a name; `Author URI` optional → skip). **License = `GPL-2.0-or-later`** (SPDX, matches package.json; prose `GPL v2 or later` also accepted but SPDX is modern + consistent). **License URI = `https://www.gnu.org/licenses/gpl-2.0.html`** (conventional; `.txt` variant also fine). **Text Domain = `piano-block`**. **`Plugin URI`** optional (mild lean include the GitHub repo URL). **`Update URI`** — skip (self-hosted-update only; unset is correct for non-WP.org/non-self-updating). Optional `@package` PHPDoc is polish; WP only needs the `Field: value` lines (the `@wordpress-plugin` marker is only needed for the combined-PHPDoc disambiguation form).
- **(b) `init` idiom — named, prefixed function (recommended).** `function piano_block_register() { register_block_type( __DIR__ ); } add_action( 'init', 'piano_block_register' );`. Why over closure: it's what canonical uses; it's removable (`remove_action`) and testable; clearer traces. Closure is valid and fine on PHP 7.4 (closures since 5.3) but less conventional for an entry point. **Prefix the function** (global PHP function namespace) → `piano_block_*` is collision-safe; a `namespace` decl is overkill for one function.
- **(c) ABSPATH guard placement.** `defined( 'ABSPATH' ) || exit;` goes **immediately after the header docblock, before any code**: `<?php` → header `/** … */` → blank → `defined( 'ABSPATH' ) || exit;` → blank → function/`add_action`. Must be after the header (WP parses the header comment without executing the file) and before executable code. (`|| exit;` ≡ `|| die;` ≡ `if ( ! defined(...) ) { exit; }`.)
- **(d) `register_block_type( __DIR__ )` — safe bare, modern, correct.** Path form available **since WP 5.8.0** (reference changelog) ≪ 6.3 floor → **no `function_exists` guard needed**. It's the recommended call and **internally delegates to `register_block_type_from_metadata()`** when given a path (`if ( is_string($block_type) && file_exists($block_type) ) return register_block_type_from_metadata(...)`), so we do NOT call `…_from_metadata` directly. `__DIR__` = the dir containing this file = repo root = where `block.json` is (Q1) — verified in the stub test.
- **(e) Entry file = header + ABSPATH guard + `init`/register hook, nothing else.** Explicitly deferred (and *correctly* omitted for a block scaffold): **activation/deactivation hooks** (no DB/options/rewrites/cron to set up — AC1 needs none), **`load_plugin_textdomain()`** (core auto-loads since WP 4.6; no translation files; deferred per spec), **`uninstall.php`/`register_uninstall_hook`** (nothing persisted), **`wp_set_script_translations()`** (deferred per spec), constants/autoloaders/classes (overkill for one function).

**Ready-to-commit `piano-block.php`** (passes `php -l`; `init`→`register_block_type(__DIR__)` verified firing):
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

**Sources:** [Plugin Header Requirements](https://developer.wordpress.org/plugins/plugin-basics/header-requirements/) · [register_block_type reference (5.8 path form; delegates to _from_metadata)](https://developer.wordpress.org/reference/functions/register_block_type/) · [no-build example plugin.php (named prefixed fn on init)](https://github.com/WordPress/block-development-examples/tree/trunk/plugins/minimal-block-no-build-e621a6) · **local `php -l` + functional stub-test.**

**DECISIONS (analyst):**

- **D6.1 — Commit `piano-block.php` exactly as the block above.** Header + ABSPATH guard + named-prefixed `piano_block_register()` on `init` → `register_block_type( __DIR__ )`. Satisfies spec req 10 (header fields) + req 11 (init registration) + AC1 (activation, no fatal).
- **D6.2 — Include `Plugin URI`** = the GitHub repo (accurate, gives admin a "Visit plugin site" link, one line). Skip `Author URI` and `Update URI`.
- **D6.3 — Named, prefixed function `piano_block_register`** over a closure (canonical, removable, testable). Establishes the `piano_block_*` prefix convention for any future plugin-level PHP (the real-piano task can follow it).
- **D6.4 — `register_block_type( __DIR__ )` bare** (no `function_exists` guard; safe on 6.3 floor; modern call that delegates to `_from_metadata`). `__DIR__` = repo root.
- **D6.5 — ABSPATH guard ONLY on `piano-block.php`** (after the header docblock), per D3.4. `render.php` and `index.asset.php` carry no guard (canonical).
- **D6.6 — Plugin-level Description** is verb-framed ("Registers the Piano block — …"), deliberately distinct from the block-framed `block.json` `description` ("A placeholder Piano block — …"); both honest scaffold copy, same em-dash voice.
- **D6.7 — Entry file is minimal** (header + guard + init hook). Activation/deactivation hooks, `load_plugin_textdomain`, `uninstall.php`, `wp_set_script_translations`, and class/constant scaffolding are explicitly deferred (all out-of-scope or unnecessary for a block scaffold).
- **D6.8 — Keep `@package PianoBlock` PHPDoc** (light conventional polish; Biome ignores `.php`). No `@wordpress-plugin` marker (plain `Field: value` header form).

### Q7 — Plain CSS: ship or not, wiring, versioning, minimal rules

**Asked:** `style`/`editorStyle`/`viewStyle` semantics; does CSS need a sibling `.asset.php` and how is it versioned without a build; `file:` wiring + auto handle; does shipping minimal CSS help the smoke test or stray into out-of-scope "design"; exact minimal rules + the wrapper-class selector; Biome CSS behavior.

**Researcher answer (HIGH confidence — semantics + versioning from `register_block_style_handle` SOURCE; wrapper class canonical; live Biome CSS probes):**

- **(a) Style fields (verbatim).** `style` = enqueued **both editor + front end**; `editorStyle` = **editor-only**; `viewStyle` = **front-end-only** (newer/niche). Recommend a **single `style`** over create-block's `style.css`+`editor.css` split — the split only earns its place when you need editor-only overrides (countering editor chrome), which a minimal placeholder doesn't. One `style.css` = minimal + editor/front-end parity (good for smoke-testing).
- **(b) CSS needs NO `.asset.php`** (that auto-detection is scripts-only — confirmed: `register_block_style_handle` source reads no CSS asset.php; create-block ships no `style.asset.php`). **CSS cache-bust version source (from source):** `$block_version = ! $is_core_block && isset( $metadata['version'] ) ? $metadata['version'] : false;` then under `SCRIPT_DEBUG` uses `filemtime`. So for our non-core block: normally CSS `?ver=` = **`block.json`'s top-level `"version"`** if present, else `false` (→ WP core version); with `SCRIPT_DEBUG` on, `filemtime` (automatic dev cache-busting). ⚠️ **New coupling:** to give the CSS a plugin-tied `?ver=` (parallel to the script's `index.asset.php` version), **add top-level `"version": "0.1.0"` to `block.json`.** Asymmetry to document: the **script** version lives in `index.asset.php`; the **style** version lives in `block.json` `version`. Both `0.1.0`, moving with plugin header `Version` + `package.json`.
- **(c) Wiring.** `"style": "file:./style.css"` (relative to `block.json`). WP **auto-generates the style handle** via `generate_block_asset_handle( name, field, index )` → e.g. `wp-block-piano-block-piano-style`. **No manual `wp_register_style`/`wp_enqueue_style`** — `register_block_type( __DIR__ )` wires it.
- **(d) Decision input — recommend SHIP (i).** For: strengthens AC3/AC5 (a dashed-border muted slot reads unmistakably as "block placeholder rendered here" in editor + front end — clearer than bare `<p>`); exercises the `style`→auto-handle→enqueue path the future piano will use (proves the scaffold's plumbing end-to-end); editor/front-end parity. Against: strays toward out-of-scope "visual design" **only if overdone** — a neutral affordance (dashed border, padding, muted gray, ~3 declarations, no piano-specific styling) is the CSS equivalent of the "placeholder" copy, clearly on the scaffold side. Spec req 7 explicitly permits "minimal if present." Net: ship. (Style-free is a valid minimalist alternative — `<p>` + text still passes AC3/AC5 — but researcher leans ship.)
- **(e) Wrapper class CONFIRMED: `.wp-block-piano-block-piano`** (`wp-block-` + name with `/`→`-`; matches what `get_block_wrapper_attributes()` (Q3) and `useBlockProps()` (Q2) emit; create-block es5 `style.css` targets `.wp-block-{{namespace}}-{{slug}}`). Proposed `style.css` (probed **0 diagnostics**, idempotent under `--write`, tab-indented):
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
  `#767676` is the standard WP muted gray. ⚠️ Biome CSS gotcha: an **empty rule block** (`.x {}`) trips `lint/suspicious/noEmptyBlock` — our 3-decl block avoids it. No other `recommended` CSS rule fires on standard properties.
- **(f) Biome + CSS.** Biome **does** lint CSS under `recommended`; formats with **tabs**; `biome check --write` is **idempotent** on the file above (probed). Only realistic trap = `noEmptyBlock` (avoided). `.css` is not gitignored → processed (desired).

**Sources:** [block-metadata reference (style field contexts; CSS needs no script asset.php)](https://developer.wordpress.org/block-editor/reference-guides/block-api/block-metadata/) · [register_block_style_handle SOURCE (CSS version logic; auto handle; no CSS asset.php)](https://developer.wordpress.org/reference/functions/register_block_style_handle/) · [create-block es5 style.css (`.wp-block-{{ns}}-{{slug}}`, ~3 decls, front+editor)](https://github.com/WordPress/gutenberg/blob/trunk/packages/create-block/lib/templates/es5/style.css.mustache) · **live Biome 2.4.16 CSS probes.**

**DECISIONS (analyst):**

- **D7.1 — SHIP one minimal `style.css`** applied to both contexts (front + editor). Justified: clearer/less-ambiguous smoke test (AC3 editor + AC5 front end), proves the CSS-wiring path end-to-end (the future piano will use it), editor/front-end parity. Stays out of "visual design" by being a neutral placeholder affordance only. Resolves spec open item 26.
- **D7.2 — Wire via `"style": "file:./style.css"`** in `block.json`. No `editorStyle` (no editor-only overrides needed), no `viewStyle`. No CSS `.asset.php`. No manual `wp_register_style` (auto handle `wp-block-piano-block-piano-style` via registration).
- **D7.3 — Add top-level `"version": "0.1.0"` to `block.json`** so the CSS gets a plugin-tied `?ver=` (else it falls back to the WP core version). Documented asymmetry: **script version = `index.asset.php`**, **style version = `block.json` `version`**. The version now lives in FOUR places, all `0.1.0`, moving together each release: plugin header `Version`, `package.json` `version`, `index.asset.php` `version`, `block.json` `version`.
- **D7.4 — `style.css` content** = the 3-declaration block above targeting `.wp-block-piano-block-piano` (dashed `#767676` border, `1em` padding, `#767676` text) + the leading comment. Must not be an empty rule (Biome `noEmptyBlock`). Tab-indented, probed Biome-clean + idempotent.
- **D7.5 — FINAL `block.json`** (supersedes D5.1; adds `version` after `name`, `style` before `render`):
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
  Plan/code phase runs `npm run check` to confirm Biome leaves this exact object byte-stable (key order proven preserved in Q5).
- **D7.6 — Final committed tree** (supersedes D1.4; both CSS files → just `style.css`, no `editor.css`):
  ```
  piano-block/
  ├── piano-block.php     # header + ABSPATH guard + init→register_block_type(__DIR__)
  ├── block.json          # metadata (above)
  ├── index.js            # no-build editor JS
  ├── index.asset.php     # script deps + version
  ├── render.php          # server render
  ├── style.css           # minimal placeholder CSS (front + editor)
  └── (existing) package.json, biome.json, .nvmrc, README.md, .gitignore, package-lock.json
  ```

### Q8 — Deliberately resolving the no-build-now vs future-build tension (the spec's named tension)

**Asked:** The concrete migration path no-build → `@wordpress/scripts` (what carries over / moves / is deleted); is it truly binary or is there a build-only-keep-Biome middle path; the concrete evidence-based trigger that flips the decision (esp. whether the Interactivity API requires a build); and the honest forward-compat cost.

**Researcher answer (HIGH confidence; IAPI nuance flagged honestly):**

- **(a) Migration path — the scaffold is a strict SUBSET of the built layout; nothing is undone.** Per-file fate under a future `@wordpress/scripts` build:
  | Scaffold file | Fate | Cost |
  |---|---|---|
  | `piano-block.php` | carries over; one-line edit `register_block_type( __DIR__ )` → `register_block_type( __DIR__ . '/build' )` | trivial |
  | `block.json` | moves to `src/block.json` (copied to `build/`); `file:` refs unchanged; may gain `viewScriptModule`/`supports.interactivity` | low |
  | `index.js` | moves to `src/index.js`; content extended `wp.*`+`createElement` → `import { … } from "@wordpress/…"` + JSX (our destructuring already reads like the import form) | medium (but it's net-new UI you'd write anyway) |
  | `index.asset.php` | **DELETED** — webpack auto-generates `build/index.asset.php` | **only true throwaway (~6 lines)** |
  | `render.php` | moves to `src/render.php`; carries over; may gain `data-wp-*` directives + `wp_interactivity_state()` | low |
  | `style.css` | moves to `src/style.css` (or rename `.scss`, optional); rules carry over; block.json `version` for CSS becomes moot (build hashes) | low |
  | `package.json` | extended (+`@wordpress/scripts`, `build`/`start`); Biome scripts stay | low |
  | `.gitignore` | extended (+`build/`) | trivial |
  Everything substantive (entry, dynamic shape, identity/metadata, CSS rules, Biome config) survives.
- **(b) NOT binary — clean middle path confirmed.** `wp-scripts` `build`/`start` are **independent of** its `lint-js`/`lint-style`/`format` commands (wp-scripts reference). So a future build can run `wp-scripts build` **while keeping Biome-only** for lint/format (Biome lints the `src/` authored files; webpack bundles to a gitignored `build/`). Caveat for *that* future moment: if JSX is authored in `.js`, confirm Biome's JSX-in-`.js` handling (using `.jsx` is cleanest — Biome supports it). **The repo's Biome-only identity survives a build** — this de-risks the future decision.
- **(c) Trigger — the playable front-end piano (Interactivity API), framed precisely.** The IAPI is WP's canonical front-end-interactivity mechanism: front-end logic is a **`view.js` ES module that `import`s from `@wordpress/interactivity`**, wired via **`viewScriptModule`** (NOT `viewScript`) in `block.json`; markup uses `data-wp-*` directives; state can be seeded via `wp_interactivity_state()`. Script modules + `viewScriptModule` are **WP 6.5+** (above our 6.3 floor). **Does IAPI strictly require a bundler? No** — `@wordpress/interactivity` is a registered script module resolved via an **import map**, so a hand-authored ES-module `view.js` can `import` it at runtime with no build. **But the build wins in practice** for evidence-backed reasons: (1) WP only documents/recommends the build path (official quick-start = `create-block-interactive-template` + `npm start`; no official no-build IAPI tutorial); (2) JSX ergonomics for a multi-key editor UI; (3) generator-based async actions + optional TypeScript stores; (4) any npm audio/synth library `import` is a hard bundling requirement. **Threshold — "introduce a build WHEN any of":** (i) the block needs front-end interactivity (IAPI / `viewScriptModule` / playable keyboard) — expected primary trigger; (ii) the editor UI grows non-trivial enough that JSX materially beats `createElement`; (iii) the block must `import` an npm package needing bundling; (iv) (softer) the team wants TypeScript/generator-heavy stores.
- **(d) Forward-compat cost — LOW, and our biases paid off.** Nothing chosen now must be *undone* — only moved/extended. Only throwaway = `index.asset.php` (~6 lines, served its purpose). Main mechanical cost = root→`src/` move + the one-line `__DIR__ . '/build'` change. Forward-compat wins to cite: `index.js` basename matches future `src/index.js`→`build/index.js`; `const`-destructuring reads like future imports; `render.php` is already dynamic with `get_block_wrapper_attributes()` (IAPI just adds directives); plain `.css` means no SCSS to rip out. One thing that *changes* (not undoes): `Requires at least` 6.3 → 6.5 when IAPI is adopted (script-modules floor).

**Sources:** [wp-scripts reference (build/start independent of lint)](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-scripts/) · [create-block README](https://github.com/WordPress/gutenberg/blob/trunk/packages/create-block/README.md) · [block-metadata (`viewScriptModule` vs `viewScript`; 6.5)](https://developer.wordpress.org/block-editor/reference-guides/block-api/block-metadata/) · [Script Modules (`wp_register_script_module`, 6.5)](https://developer.wordpress.org/reference/functions/wp_register_script_module/) · [Interactivity API quick start](https://developer.wordpress.org/block-editor/reference-guides/interactivity-api/iapi-quick-start-guide/) · in-harness **wp-interactivity-api skill** references.

**DECISIONS (analyst) — THE DELIBERATE RESOLUTION (spec named tension):**

- **D8.1 — Chosen approach: NO-BUILD NOW, with a documented low-cost path to `wp-scripts build` (Biome retained) when the real-piano front-end interactivity lands.** This is the resolution recorded *deliberately* (not by accident), per the spec's instruction. Rationale: no-build is the only option honoring the issue's "minimal, Biome-only, plain-CSS, scaffold-only" intent (spec reqs 6–9, Out-of-Scope build-pipeline note); it is officially supported and fully installable; and the future build is **cheap to adopt** because we kept the scaffold a strict subset of the built layout.
- **D8.2 — Trade-off, stated honestly.** *Cost of no-build now:* verbose `wp.element.createElement` (vs JSX) and a hand-written `index.asset.php` — both trivial at scaffold scale. *Benefit:* zero new dependencies/toolchain, Biome lints/formats everything as-authored, nothing to rip out later. *Cost deferred:* JSX ergonomics + npm imports await the build. *Why deferred, not taken now:* there is no interactivity, no multi-key UI, and no npm dependency in the scaffold — the build would be pure overhead today against the issue's explicit minimalism.
- **D8.3 — The flip trigger (write into the design):** adopt `@wordpress/scripts build` (keeping Biome for lint/format) WHEN the real piano needs **front-end interactivity (Interactivity API / `viewScriptModule`)** — the expected primary driver — OR a non-trivial JSX editor UI OR an npm package import. Adopting the Interactivity API also bumps `Requires at least` 6.3 → 6.5. The IAPI does not *strictly* mandate a bundler (import maps), but its only-documented workflow + JSX + generators + npm audio libs make a build the practical requirement — so the trigger is "the playable-piano interactivity work," not "any future change."
- **D8.4 — Forward-compat is a design goal, already honored.** The scaffold deliberately mirrors the eventual `src/` layout: `index.js` basename, import-shaped `const`-destructuring, dynamic `render.php` with `get_block_wrapper_attributes()`, plain `.css`. Migration = move files root→`src/`, one-line `register_block_type( __DIR__ . '/build' )`, delete the (regenerated) `index.asset.php`, extend `index.js` into JSX. **Characterized as LOW cost; nothing is undone.** This is the trade we accept and it is favorable.
- **D8.5 — The middle path is explicitly preserved.** Because `wp-scripts build` is independent of its linters, choosing no-build now does **not** lock the repo out of Biome-only later. The design records that a future build can be "wp-scripts for bundling, Biome for quality," so the repo's tooling identity is durable across the transition.

---

## Design Q&A complete

All eight design questions are settled with evidence, and every decision (D1.1–D8.5) traces to a spec requirement or an explicitly-delegated open item. Next: write the consolidated `2-design-doc/design-doc.md` from these decisions, then commit and notify `team-lead`.

**Resolution of spec open items:** item 25 (placeholder copy + icon/description/keywords wording) → D3.5, D5.2, D5.3; item 26 (ship CSS or not) → D7.1; item 27 (`Requires PHP` 7.4 vs 8.0) → kept at 7.4 per the spec's own decision (no design change). The spec's **named build tension** → resolved deliberately in D8.1–D8.5.
