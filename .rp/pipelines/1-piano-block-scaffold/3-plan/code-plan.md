# Code Plan: Piano block scaffold

> Phase 3 artifact — the ordered, executable plan. Implements the approved `1-spec/spec.md` (requirements + 5 acceptance criteria) per the `2-design-doc/design-doc.md` (architecture + decisions). Standalone: each task carries its own goal, exact file paths, concrete changes, dependencies, traceability, and observable acceptance — a code-writer executes each with **no design decisions left to make**. Tests and documentation are out of scope for this plan (the code-writer adds tests via TDD; docs are a separate doc-plan).

## Overview

The repository root **is** the plugin (greenfield; only Biome tooling exists). This plan stands up a minimal, installable WordPress plugin registering exactly one **dynamic** block, `piano-block/piano` (Block API v3), that shows a static placeholder in the editor and renders minimal valid HTML on the front end via server-side PHP. It is **no-build** (plain JS against `wp.*` globals, a hand-written `index.asset.php`), **plain CSS** (no SCSS), and authored to pass the repo's existing Biome rules (tab indentation, double-quoted JS, `recommended`) with **no new tooling and no `biome.json` change**. It carries **no piano behaviour** (no interactive keys, audio, visual design, input handling, or Interactivity API) — that is a future task.

**Scope of the file set (all new, all at the repo root):**

| File | Purpose | Biome-processed? |
|---|---|---|
| `piano-block.php` | Plugin entry: header docblock + ABSPATH guard + `init` registration | No (`.php` skipped) |
| `block.json` | Block metadata: identity, presentation, asset + render wiring | Yes |
| `index.js` | No-build editor script (plain JS on `wp.*`) | Yes |
| `index.asset.php` | Hand-written sidecar: editor-script dependencies + version | No (`.php` skipped) |
| `render.php` | Server-rendered front-end output (dynamic block) | No (`.php` skipped) |
| `style.css` | Minimal placeholder styles (editor + front end) | Yes |

**Existing files left untouched:** `package.json`, `biome.json`, `.nvmrc`, `README.md`, `.gitignore`, `package-lock.json`. (`package.json` already declares `version: 0.1.0`, `license: GPL-2.0-or-later`, and `lint`/`format`/`check` scripts; `.gitignore` already covers `node_modules/`, `.env*`, and editor/OS noise — confirmed against the repo. No change to either is needed for the scaffold.)

**Repo-root absolute path for every file below:**
`/Users/santosguillamot/Desktop/Code/SantosGuillamot/piano-block/.claude/worktrees/1-piano-block-scaffold/`
(e.g. the plugin entry is `…/1-piano-block-scaffold/piano-block.php`). Paths are written repo-relative in each task for brevity; resolve them against this root.

**Task ordering & dependency rationale.** Tasks 1–6 each create one of the six plugin files; Tasks 7–9 are verification gates that run after the files exist. `block.json` (Task 2) references `index.js`/`style.css`/`render.php` via `file:`, so those files (Tasks 3, 6, 5) and `index.js`'s sidecar `index.asset.php` (Task 4) must exist before the registration-wiring gate (Task 7) — where `register_block_type( __DIR__ )` reading `block.json` is first jointly checkable — can pass without error. The Biome gate (Task 8) needs only the three Biome-processed files (Tasks 2, 3, 6). The five-point smoke test (Task 9) needs all six files present, registration-consistent, and Biome-clean — it runs last. A code-writer may author the six file-creation tasks (1–6) in any order; the binding constraints are recorded in each task's **Depends on**, and the three gates (7, 8, 9) run after the files they verify.

**Version coupling (carry forward as-is — not a decision to make).** The literal `0.1.0` appears in **four** coupled places and must match exactly: plugin header `Version` (Task 1), `block.json` top-level `version` (Task 2), `index.asset.php` `version` (Task 4), and the existing `package.json` `version` (already `0.1.0`, unchanged). Tasks below hard-code `0.1.0`; do not vary it.

**Authoring constraints that bind every task (from the design, do not re-decide):**
- **Tab indentation** everywhere (PHP, JS, JSON, CSS) — matches `biome.json` `indentStyle: "tab"` and WordPress PHP conventions.
- **Double-quoted JavaScript** (Biome `quoteStyle: "double"`); single-quoted PHP strings (WordPress convention).
- The Biome-processed files (`block.json`, `index.js`, `style.css`) must be authored in the **exact byte-stable form** the design specifies so that `biome check --write` is idempotent (leaves them unchanged). Task 8 verifies this.
- No `@wordpress/scripts`, no JSX, no bundler/transpiler, no SCSS, no new dependency, no `biome.json` edit, no `/* global */` comment, no `globals` entry.

---

### Task 1 — Plugin entry file (`piano-block.php`): header + ABSPATH guard + `init` registration

**Goal:** Create the main plugin file so the deliverable is a recognizable, installable WordPress plugin that registers the block from its metadata on `init`.

**Files to change:**
- `piano-block.php` (new, repo root)

**Changes:** Create the file with exactly this content (tab-indented; single-quoted PHP strings):

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

Notes that constrain the exact output (do not deviate):
- The header is a `/** … */` docblock at the **very top** of the file (line 2 onward), immediately after `<?php`. The `defined( 'ABSPATH' ) || exit;` guard sits **after** the header docblock and **before** any other code (WordPress reads the header without executing the file, so the guard must follow it).
- Plugin display name is **"Piano Block"** (Title Case) — distinct from the block *title* `"Piano"` (Task 2) and the *slug* `piano-block`. The Description is verb-framed ("Registers the Piano block — …"), deliberately distinct from the block-framed `block.json` description in Task 2.
- Floors are `Requires at least: 6.3` and `Requires PHP: 7.4`. License is `GPL-2.0-or-later` with the GPL-2.0 `License URI`. `Text Domain: piano-block` must equal `block.json` `textdomain` (Task 2).
- Registration uses a **named, slug-prefixed** function `piano_block_register()` on the `init` hook calling `register_block_type( __DIR__ )` (path form). Do **not** use an anonymous closure; do **not** call `register_block_type_from_metadata()` directly; do **not** add a `function_exists` guard (the path form predates the 6.3 floor).
- **Deliberately omit** (do not add): activation/deactivation hooks, `load_plugin_textdomain()`, `uninstall.php`, `wp_set_script_translations()`, any class/constant/autoloader. `Author URI` and `Update URI` are intentionally omitted from the header.

**Depends on:** none (file stands alone; its *runtime* registration is exercised once Tasks 2–6 exist, gated in Task 7).

**Traces to:** spec AC1 (activation, no fatal/notice); req 10 (installable plugin header), req 11 (WP 6.3 / PHP 7.4 floors, GPL-2.0-or-later), req 12 (register from metadata on init hook), req 14 (text domain matches header) / design §3.5, decision 10.

**Acceptance:**
- `piano-block.php` exists at the repo root and begins with `<?php` immediately followed by a `/** … */` plugin header docblock containing at minimum: `Plugin Name: Piano Block`, `Version: 0.1.0`, `Requires at least: 6.3`, `Requires PHP: 7.4`, `License: GPL-2.0-or-later`, and `Text Domain: piano-block`.
- The file contains `defined( 'ABSPATH' ) || exit;` positioned after the header docblock and before the function/hook code.
- A named function `piano_block_register()` is registered on the `init` hook (`add_action( 'init', 'piano_block_register' )`) and its body is exactly `register_block_type( __DIR__ );`.
- The file contains no activation/deactivation hook, no `load_plugin_textdomain`, no `wp_set_script_translations`, and no anonymous-closure registration.
- The PHP parses without syntax error (e.g. `php -l` reports no errors).

---

### Task 2 — Block metadata (`block.json`): identity, presentation, asset + render wiring

**Goal:** Create the single block-metadata file that declares the block's identity and presentation and wires the editor script, stylesheet, and server render — the one source `register_block_type( __DIR__ )` reads.

**Files to change:**
- `block.json` (new, repo root)

**Changes:** Create the file with exactly this content (tab-indented; conventional WordPress key order):

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

Notes that constrain the exact output (do not deviate):
- `apiVersion` is the **integer** `3` (not a string). `name` is exactly `piano-block/piano`.
- `category` is `media` (a core category — the closest fit; **do not** create a custom category).
- `icon` is the **bare** Dashicons slug `format-audio` (not `dashicons-format-audio`, not `media-audio`).
- `version` top-level is `0.1.0` (gives the stylesheet a plugin-tied `?ver=` cache-buster; keep in lockstep with Tasks 1 and 4).
- `textdomain` is lowercase `piano-block` and must equal the plugin header `Text Domain` (Task 1).
- `file:` references are resolved **relative to `block.json`'s own location** (the root): `file:./index.js`, `file:./style.css`, `file:./render.php`. These reference the files created in Tasks 3, 6, and 5 respectively.
- **Do not add** any of: `save`-related field, `editorStyle`, `viewStyle`, `viewScript`, `viewScriptModule`, `supports`, `attributes`. None are needed for the scaffold (and several are deferred per Out of Scope).
- Biome does **not** reorder JSON keys; author in the order shown and it stays byte-identical under `biome check --write` (verified in Task 8).

**Depends on:** none to create the file. (Its `file:` targets — `index.js` Task 3, `render.php` Task 5, `style.css` Task 6 — must exist before the registration-wiring gate Task 7 / the smoke test Task 9 can succeed without a wiring error; recorded there.)

**Traces to:** spec AC2 (inserter shows block under Media), AC1/AC5 (render wiring); req 1 (one block, name, API v3), req 12 (metadata file is the wiring source), req 13 (identity/presentation: title, icon, description, `media` category), req 14 (metadata strings translation-ready via textdomain) / design §3.1, decision 6, decision 8.

**Acceptance:**
- `block.json` exists at the repo root and is valid JSON.
- It declares `"apiVersion": 3` (integer), `"name": "piano-block/piano"`, `"title": "Piano"`, `"category": "media"`, `"icon": "format-audio"`, a non-empty `"description"`, `"textdomain": "piano-block"`, and `"version": "0.1.0"`.
- It wires assets via `"editorScript": "file:./index.js"`, `"style": "file:./style.css"`, and `"render": "file:./render.php"` (paths relative to `block.json`).
- It contains **no** `save`, `supports`, `attributes`, `editorStyle`, `viewStyle`, `viewScript`, or `viewScriptModule` keys.
- The `textdomain` value equals the plugin header `Text Domain` from Task 1 (`piano-block`).

---

### Task 3 — Editor script (`index.js`): no-build, plain JS, static placeholder, `save` omitted

**Goal:** Create the no-build editor script that registers the block on the client and renders a static, identifiable placeholder using the standard block-props wrapper — with `save` omitted so the block is dynamic and stores no markup.

**Files to change:**
- `index.js` (new, repo root)

**Changes:** Create the file with exactly this content (tab-indented; **double-quoted** strings; method-shorthand `edit()`):

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

Notes that constrain the exact output (do not deviate):
- **`save` is omitted entirely** — do **not** write `save: () => null` or any `save`. Omission is the canonical dynamic-block shape: WordPress persists only the block delimiter comment and skips block-markup validation (this is what makes AC4 pass).
- `edit` is **method shorthand** (`edit() { … }`), **not** an arrow assignment (`edit: () => …`) and not a `function` expression — this avoids Biome's `useArrowFunction`/related diagnostics and is the probe-verified zero-diagnostic form.
- Destructure **exactly** the four `wp.*` members used (`registerBlockType`, `createElement`, `useBlockProps`, `__`) — no extra/unused aliases (would trip `noUnusedVariables`). Use `const`, never `var`.
- The block name passed to `registerBlockType` is the string `"piano-block/piano"` (matches `block.json` `name`).
- `edit()` returns `createElement("p", useBlockProps(), <string>)` — the no-JSX equivalent of `<p {...useBlockProps()}>…</p>`. It uses `useBlockProps()` so the block participates correctly in the editor. Do **not** use `ServerSideRender` and do **not** server-render a preview.
- The one user-facing string is wrapped in `__("Piano block — editor placeholder", "piano-block")` (text domain `piano-block`). Keep the copy exactly as shown — it is the parallel "editor" half of the editor/front-end placeholder pair (Task 5 is the "front-end" half).
- Do **not** add a `/* global wp */` comment or any Biome-suppression comment; `noUndeclaredVariables` is not in `recommended`, so the bare `wp` global is fine as-authored. Trailing comma after the last argument of `createElement(...)` and after the `edit(){…}` member is the Biome-stable form — keep it as written.

**Depends on:** none to author. (At runtime its dependency handles come from `index.asset.php` (Task 4), and it is enqueued via `block.json` `editorScript` (Task 2) + registration (Task 7); AC3 is verified in Task 9.)

**Traces to:** spec AC3 (editor placeholder, no console error), AC4 (no saved markup → no invalid-content warning); req 2–3 (dynamic, no saved markup via omitted `save`), req 5 (basic editor placeholder using `useBlockProps`, no SSR preview), req 6 (no-build plain JS on `wp.*`), req 9 (passes Biome), req 14 (user-facing string wrapped in `__`) / design §3.2, decisions 1, 2, 4, 5.

**Acceptance:**
- `index.js` exists at the repo root.
- It calls `registerBlockType("piano-block/piano", { … })` with the block name matching `block.json`.
- The registration object defines an `edit` method (method shorthand) and **does not** define `save` (no `save` key anywhere in the file).
- `edit` returns the result of `createElement("p", useBlockProps(), …)`, and the content argument is a `__( …, "piano-block" )` call (string wrapped for translation with the `piano-block` text domain).
- Exactly four `wp.*` members are destructured (`registerBlockType`, `createElement`, `useBlockProps`, `__`) with `const`; no unused bindings; no `var`.
- The file uses double quotes and tab indentation, contains no `/* global */` or Biome-suppression comment, does not use `ServerSideRender`, and (per Task 8) is left byte-unchanged by `biome check --write`.

---

### Task 4 — Editor-script sidecar (`index.asset.php`): dependencies + version

**Goal:** Create the hand-written sidecar that declares the editor script's WordPress dependency handles and version, so WordPress enqueues `index.js` correctly with no build step generating that information.

**Files to change:**
- `index.asset.php` (new, repo root)

**Changes:** Create the file with exactly this content (tab-indented; single-quoted; no ABSPATH guard):

```php
<?php

return array(
	'dependencies' => array( 'wp-blocks', 'wp-block-editor', 'wp-element', 'wp-i18n' ),
	'version'      => '0.1.0',
);
```

Notes that constrain the exact output (do not deviate):
- The basename **must** match the script it accompanies: `index.js` → `index.asset.php` (WordPress finds the sidecar by pattern-matching the script path). Place it at the repo root next to `index.js`.
- The file's top-level `return <array>;` is the mechanism WordPress reads. It returns a PHP array with exactly two keys: `dependencies` and `version`.
- `dependencies` lists **all four** handles explicitly, mapping the `wp.*` members used in `index.js` to core script handles: `wp-blocks` (`registerBlockType`), `wp-block-editor` (`useBlockProps` — the modern handle; **not** the legacy `wp-editor`), `wp-element` (`createElement`), `wp-i18n` (`__`). List `wp-element` explicitly (do not rely on transitive arrival via `wp-blocks`).
- `version` is the **literal string** `'0.1.0'` (kept in sync with Tasks 1 and 2). Do **not** use `filemtime(...)` and do **not** use `false`.
- **No `defined( 'ABSPATH' )` guard** — it is a pure data file with no side effects (build-generated `*.asset.php` files never carry the guard).

**Depends on:** Task 3 (the basename and the dependency list both mirror `index.js`: same basename `index`, and the four handles correspond one-to-one to the four `wp.*` members destructured there). Authoring can technically precede Task 3, but the contents are defined *by* `index.js`'s imports, so order it after Task 3.

**Traces to:** spec AC3 (editor script enqueued with correct deps → placeholder renders, no console error); req 8 (explicit script dependencies + version via sidecar, no build generating them) / design §3.3.

**Acceptance:**
- `index.asset.php` exists at the repo root (same basename as `index.js`).
- It is a `<?php` file whose top-level statement returns an array with exactly the keys `dependencies` and `version`.
- `dependencies` is the array `array( 'wp-blocks', 'wp-block-editor', 'wp-element', 'wp-i18n' )` (all four handles present; uses `wp-block-editor`, not `wp-editor`).
- `version` is the literal string `'0.1.0'` (no `filemtime`, no `false`); it matches the plugin header `Version` (Task 1) and `block.json` `version` (Task 2).
- The file contains no `defined( 'ABSPATH' )` guard and no side-effecting code.
- The PHP parses without syntax error (e.g. `php -l` reports no errors).

---

### Task 5 — Server render (`render.php`): minimal valid dynamic front-end output

**Goal:** Create the server-rendered front-end output for the dynamic block: a single wrapper element carrying the standard block wrapper attributes plus a translated placeholder string — minimal, valid, and `WP_DEBUG`-clean.

**Files to change:**
- `render.php` (new, repo root)

**Changes:** Create the file with exactly this content (tab-indented; single-quoted PHP strings; no ABSPATH guard):

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

Notes that constrain the exact output (do not deviate):
- A single `<p>` wrapper carries the standard block wrapper attributes via `get_block_wrapper_attributes()`, echoed **directly** into the opening tag. `get_block_wrapper_attributes()` returns an **already-escaped** string — do **not** wrap it in `esc_attr()` (that double-escapes and is a defect).
- The placeholder content is one static translated string via `esc_html_e( 'Piano block — front-end placeholder', 'piano-block' )` (text domain `piano-block`). Keep the copy exactly as shown — it is the parallel "front-end" half of the editor/front-end pair (Task 3 is the "editor" half).
- The body must **not** read any `$attributes[...]` key and must **not** touch `$block` properties (an undefined array-key read emits a PHP 8+ `Undefined array key` warning; the scaffold avoids this by construction to stay `WP_DEBUG`/`E_ALL`-clean).
- **No `defined( 'ABSPATH' )` guard** — `render.php` is a pure output partial loaded only by WordPress during render; the canonical templates omit the guard (the guard lives only on the entry file, Task 1).
- The leading docblock comment is part of the file as shown; the `?> … <?php` template structure (HTML wrapper with embedded PHP echoes) is intentional — author it exactly.

**Depends on:** none to author. (It is wired via `block.json` `render: file:./render.php` (Task 2) and exercised on the front end only after the registration-wiring gate Task 7 / verified in Task 9.)

**Traces to:** spec AC5 (front-end render: wrapper + placeholder, no PHP error), AC1 (no `WP_DEBUG` notices/warnings); req 2 (dynamic, server-produced front-end HTML), req 4 (minimal valid output: wrapper with standard block attributes + placeholder content), req 14 (user-facing string translated via `esc_html_e`) / design §3.4, decision 1.

**Acceptance:**
- `render.php` exists at the repo root.
- It outputs a single `<p>` element whose opening tag includes the raw output of `get_block_wrapper_attributes()` echoed **directly** (not passed through `esc_attr()` or any additional escaping).
- The element's content is produced by `esc_html_e( 'Piano block — front-end placeholder', 'piano-block' )` (escaped + translated, text domain `piano-block`).
- The file does not read any `$attributes` array key and does not access any `$block` property.
- The file contains no `defined( 'ABSPATH' )` guard.
- The PHP parses without syntax error (e.g. `php -l` reports no errors), and rendering it within WordPress with `WP_DEBUG` on produces no PHP notice or warning.

---

### Task 6 — Placeholder stylesheet (`style.css`): minimal scaffold styling (editor + front end)

**Goal:** Create a minimal plain-CSS stylesheet that gives the block a neutral "scaffold slot" affordance in both the editor and on the front end, exercising the `block.json` `style` wiring path without straying into out-of-scope visual design.

**Files to change:**
- `style.css` (new, repo root)

**Changes:** Create the file with exactly this content (tab-indented):

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

Notes that constrain the exact output (do not deviate):
- The selector is exactly `.wp-block-piano-block-piano` — the class WordPress generates for the block (`wp-block-` + the block name with `/` → `-`). This is the same class emitted by both `get_block_wrapper_attributes()` (PHP, Task 5) and `useBlockProps()` (JS, Task 3), so one selector styles both contexts.
- The rule contains the three declarations shown (`border`, `padding`, `color`) — a neutral dashed muted-gray border, padding, and muted text. **No** piano-specific, decorative, or layout-heavy styling (stays clear of out-of-scope visual design).
- The rule block must **not** be empty (Biome `recommended` flags `noEmptyBlock`). Tab-indented; authored in the byte-stable form so `biome check --write` is idempotent (verified in Task 8).
- Wired to load in both editor and front end via `block.json` `"style": "file:./style.css"` (Task 2) — no separate `editorStyle`.

**Depends on:** none to author. (It is referenced by `block.json` `style` from Task 2; its presence is required by the Task 7 wiring gate and the Task 9 smoke test.)

**Traces to:** spec AC3 (editor placeholder visibly identifiable), AC5 (front-end placeholder visibly identifiable); req 7 (any styling is plain CSS, optional/minimal), req 9 (passes Biome) / design §3.6, decision 7.

**Acceptance:**
- `style.css` exists at the repo root and is plain CSS (no SCSS syntax: no nesting, variables-as-SCSS, mixins, etc.).
- It contains exactly one rule whose selector is `.wp-block-piano-block-piano`, with a non-empty declaration block (the rule is not empty).
- The declarations are limited to neutral scaffold affordances (a border, padding, and text color) — no piano-specific or decorative styling.
- The file uses tab indentation and (per Task 8) is left byte-unchanged by `biome check --write`.

---

### Task 7 — Verify end-to-end registration wiring (gate)

**Goal:** Confirm that, with all six source files present, `register_block_type( __DIR__ )` reading `block.json` successfully registers the block and wires its editor script (with the sidecar's dependencies/version), stylesheet, and render callback — i.e. the metadata-driven wiring is internally consistent and resolvable.

**Files to change:** none (verification/integration gate). If a wiring inconsistency is found, the fix belongs in whichever of Tasks 1–6 owns the offending file; do not introduce new files or new wiring mechanisms.

**Changes:** No new code. This task asserts the assembled unit is consistent:
- `block.json`'s three `file:` references each resolve to an existing sibling file at the repo root: `index.js` (Task 3), `style.css` (Task 6), `render.php` (Task 5).
- `index.js`'s accompanying sidecar `index.asset.php` (Task 4) shares its basename and lists handles that exist in WordPress core (`wp-blocks`, `wp-block-editor`, `wp-element`, `wp-i18n`).
- The block `name` in `block.json` (`piano-block/piano`) matches the name passed to `registerBlockType` in `index.js`.
- The `textdomain` in `block.json` matches the plugin header `Text Domain`.
- Registration occurs on `init` via the named function in `piano-block.php`.

**Depends on:** Task 1, Task 2, Task 3, Task 4, Task 5, Task 6 — this gate requires **all six** plugin files to exist so that `block.json`'s `file:` references all resolve. (It is the first point at which AC1's "activates with no PHP fatal/notice" and the wiring behind AC2/AC3/AC5 become jointly checkable.)

**Traces to:** spec AC1 (activation with no fatal/notice once registration runs), AC2/AC3/AC5 (wiring that those criteria depend on); req 12 (all asset/render wiring derives from the single metadata file) / design §4 (interfaces & data flow).

**Acceptance:**
- Every `file:` reference in `block.json` resolves to an existing file at the repo root (`index.js`, `style.css`, `render.php` all present).
- A sidecar `index.asset.php` exists with the same basename as `index.js`, returning `dependencies` (the four core handles) and `version`.
- The block name is identical in `block.json` (`name`) and `index.js` (`registerBlockType` first argument): `piano-block/piano`.
- The `textdomain` in `block.json` equals the plugin header `Text Domain` (`piano-block`).
- Within a WordPress 6.3+/PHP 7.4+ install with the files in place, activating the plugin and loading `init` registers the block type with no PHP fatal error and no `WP_DEBUG` notice/warning attributable to registration. *(Joint observable also covered by the Task 9 smoke test; this gate is the wiring-consistency checkpoint.)*

---

### Task 8 — Biome verification gate: zero diagnostics, processed files byte-stable

**Goal:** Confirm the three Biome-processed files (`index.js`, `block.json`, `style.css`) pass the repository's existing Biome lint/format with **zero diagnostics** and are left **byte-unchanged**, and that no new tooling or `biome.json` change was introduced — satisfying the "passes existing Biome, no new tooling" requirement.

**Files to change:** none (verification gate). If Biome reports a diagnostic or rewrites a file, the fix is to adjust the offending source file (`index.js` Task 3, `block.json` Task 2, or `style.css` Task 6) back into the byte-stable form specified there — **not** to edit `biome.json`, add a suppression comment, or add tooling.

**Changes:** No new code. Run the repository's existing Biome entry points and assert clean results:
- Run `npm run lint` (`biome lint .`) → **zero** lint diagnostics across `index.js`, `block.json`, `style.css`.
- Run `npm run check` (`biome check --write .`) → it makes **no modifications** to `index.js`, `block.json`, or `style.css` (the files are byte-identical before and after; e.g. `git diff` shows no change to them).
- Confirm `biome.json` is unchanged, `package.json` `devDependencies` still lists only `@biomejs/biome` (no `@wordpress/scripts` or other added tooling), and no `/* global */` or Biome-suppression comment was added to `index.js`.
- The PHP files (`piano-block.php`, `index.asset.php`, `render.php`) are expected to be **skipped** by Biome (it gracefully ignores `.php`); their formatting is governed by the WordPress conventions in Tasks 1, 4, 5 (tab indentation, single-quoted strings), not by Biome.

**Depends on:** Task 2, Task 3, Task 6 (the three Biome-processed files must exist). Independent of the PHP-only tasks, but conventionally run after all six files are authored.

**Traces to:** spec AC (cross-cutting — the toolchain constraint underpinning a clean deliverable); req 9 (all authored source files pass existing Biome lint/format with no new linting/formatting tooling added), req 6 (no `@wordpress/scripts` added) / design §3 (byte-stable authoring), decision 5, §8 (lint/format-drift mitigation).

**Acceptance:**
- `npm run lint` reports zero diagnostics.
- `npm run check` (`biome check --write .`) leaves `index.js`, `block.json`, and `style.css` byte-unchanged (no diff introduced by the run).
- `biome.json` is unchanged from the committed version; `package.json` `devDependencies` contains only `@biomejs/biome` (no build/transpile tooling added).
- `index.js` contains no `/* global */` comment and no Biome-suppression directive.

---

### Task 9 — Five-point manual smoke test against a local WordPress install (acceptance gate)

**Goal:** Execute the spec's five-point manual smoke test — the acceptance bar — against any local WordPress 6.3+/PHP 7.4+ install with `WP_DEBUG` enabled, confirming all five acceptance criteria pass.

**Files to change:** none (acceptance gate). If any check fails, the fix belongs in the source file responsible for that behaviour (per the traceability below); do not add files or scope beyond the scaffold.

**Changes:** No new code. With the six plugin files in place in a local WordPress install (6.3+, PHP 7.4+) and `WP_DEBUG` on, verify each criterion:

1. **Activation (AC1).** Activate the plugin as an administrator → it activates with **no PHP fatal error** and **no PHP notices/warnings** under `WP_DEBUG`. *(Owned by Tasks 1, 4, 5, 7.)*
2. **Inserter (AC2).** With the plugin active, open the block inserter and search by the block's title ("Piano") → the **Piano** block appears and is listed under the **Media** category. *(Owned by Task 2.)*
3. **Editor placeholder (AC3).** Insert the Piano block into a post in the block editor → its basic placeholder renders, **identifiably as the Piano block** ("Piano block — editor placeholder", styled by the scaffold CSS), with **no JavaScript console error**. *(Owned by Tasks 3, 4, 6.)*
4. **Save (AC4).** Save a post containing the inserted block → it saves cleanly with **no "invalid content" warning**, and the persisted content for the block is **only its delimiter comment** (`<!-- wp:piano-block/piano /-->`), with no stored block markup. *(Owned by Task 3 — `save` omitted.)*
5. **Front-end render (AC5).** View the published post as a visitor → the **server-rendered output** appears: a `<p>` wrapper carrying the block wrapper attributes/class plus the placeholder content ("Piano block — front-end placeholder"), with **no PHP error**. *(Owned by Tasks 5, 2, 6.)*

**Depends on:** Task 1, Task 2, Task 3, Task 4, Task 5, Task 6, Task 7, Task 8 (all six files present, registration-consistent, and Biome-clean). This is the final gate.

**Traces to:** spec AC1, AC2, AC3, AC4, AC5 (all five), and thereby the full requirement set / design §8 (failure-mode table maps each criterion), §10 (verification step).

**Acceptance:**
- **AC1:** Plugin activates with no PHP fatal error and no PHP notice/warning under `WP_DEBUG`.
- **AC2:** Searching the inserter for "Piano" surfaces the block, listed under the **Media** category.
- **AC3:** The inserted block shows its editor placeholder, identifiable as the Piano block, with no JavaScript console error.
- **AC4:** Saving a post with the block produces no "invalid content" warning, and the saved post content for the block is only the delimiter comment `<!-- wp:piano-block/piano /-->` (no block markup).
- **AC5:** The published post renders the server-side `<p>` wrapper (with block wrapper attributes) and the front-end placeholder content, with no PHP error.
- All five criteria pass against a single local WordPress 6.3+/PHP 7.4+ install with `WP_DEBUG` enabled.

---

## Coverage check (every spec acceptance criterion is covered)

| Spec AC | Covered by task(s) |
|---|---|
| **AC1** Activation (no fatal/notice) | Task 1 (entry + registration), Task 4 (sidecar), Task 5 (render `WP_DEBUG`-clean), Task 7 (wiring gate), **Task 9 #1** |
| **AC2** Inserter (under Media) | Task 2 (`block.json` identity/category), **Task 9 #2** |
| **AC3** Editor placeholder (no console error) | Task 3 (`index.js`), Task 4 (sidecar deps), Task 6 (style), **Task 9 #3** |
| **AC4** Save (no invalid content; delimiter only) | Task 3 (`save` omitted), **Task 9 #4** |
| **AC5** Front-end render (no PHP error) | Task 5 (`render.php`), Task 2 (render wiring), Task 6 (style), **Task 9 #5** |

Cross-cutting toolchain requirement (req 6/9, "passes existing Biome, no new tooling") is enforced by **Task 8** and constrains the authoring in Tasks 2, 3, 6.

## Out of scope for this plan (carried from spec/design, not to be implemented)

The real piano experience (interactive keys, audio, visual design, input handling, Interactivity API / view script); a JavaScript build pipeline (`@wordpress/scripts`/JSX/bundler) — the deliberate "no-build now" resolution and its future migration path are recorded in design §6 and are **not** acted on here; a committed local WordPress environment (`.wp-env.json`); automated tests (the code-writer adds tests via TDD — not planned here); a custom block category; any additional blocks, attributes, controls, inspector/toolbar settings, or variations; full JavaScript string-translation loading (`wp_set_script_translations` / plugin-level text-domain loading). Documentation is handled by the separate doc-plan, not this code plan.
