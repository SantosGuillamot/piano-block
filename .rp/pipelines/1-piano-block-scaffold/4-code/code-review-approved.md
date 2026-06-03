# Code Review

## Verdict

**APPROVED.** The batch (Tasks 1–9) implements the approved plan exactly: six plugin files created at the repo root, no extra files, no design deviations, no scope creep. All verification gates pass (`npm run lint` zero diagnostics; `npm run check` byte-stable; `php -l` clean on all three PHP files), and all five spec acceptance criteria (AC1–AC5) are substantiated statically with concrete evidence. The deliberate absences (no tests, no wp-env, no custom category, no build pipeline, no piano behaviour) are correct per the spec/design Out-of-Scope and are not flagged.

## Batch scope

- **Tasks reviewed:** Task 1 through Task 9 (every task in `code-plan.md`) in a single pass.
- **Diff range:** `686d101..HEAD` (HEAD = `e4c60ee`), restricted to the repo-root plugin files. The six file-creation commits:
  - `a2b51e8` Add plugin entry file → `piano-block.php` (Task 1)
  - `1372d82` Add block metadata → `block.json` (Task 2)
  - `b606678` Add editor script → `index.js` (Task 3)
  - `8a593b6` Add editor script asset metadata → `index.asset.php` (Task 4)
  - `75c9366` Add server render template → `render.php` (Task 5)
  - `e4c60ee` Add placeholder stylesheet → `style.css` (Task 6)
- **Tasks 7, 8, 9** were verification gates and correctly produced no file changes.
- `git diff --name-only 686d101..HEAD` lists exactly those six files. `.rp/` docs are pipeline artifacts (out of code scope); `.rp.md` exists at base `686d101` and is not a batch artifact. Pre-existing tooling files (`package.json`, `biome.json`, `.nvmrc`, `README.md`, `.gitignore`, `package-lock.json`) are untouched.

## Summary

A minimal, installable WordPress plugin registering one dynamic block `piano-block/piano` (Block API v3): editor placeholder via no-build plain JS on `wp.*` globals with a hand-written `index.asset.php` sidecar, server-side `render.php` front-end output, and a minimal plain-CSS placeholder stylesheet — all wired from a single `block.json` read by `register_block_type( __DIR__ )` on `init`. Every file matches the byte-for-byte content the plan specified. The four coupled `0.1.0` version declarations, the `piano-block/piano` block name, and the `piano-block` text domain are all in lockstep. The code is Biome-clean as authored (no `biome.json` change, no suppression comments) and the PHP follows WordPress conventions (tab indent, single-quoted strings, ABSPATH guard on the entry file only, no re-escaping of `get_block_wrapper_attributes()`). Inline documentation is present exactly as planned: the plugin header docblock + function docblock in `piano-block.php`, the `@see`-linked docblock in `render.php`, and the header comment in `style.css`.

## Checks

| Check | Command | Result |
|---|---|---|
| Biome lint | `npm run lint` (`biome lint .`) | PASS — `Checked 5 files`, "No fixes applied", exit 0. Zero diagnostics. PHP files correctly skipped. |
| Biome check (byte-stability) | `npm run check` (`biome check --write .`) | PASS — "No fixes applied", exit 0. `git status` and `git diff` both empty before and after the write run → `index.js`/`block.json`/`style.css` byte-unchanged (idempotent). Worktree left clean. |
| PHP syntax — entry | `php -l piano-block.php` | PASS — "No syntax errors detected". |
| PHP syntax — sidecar | `php -l index.asset.php` | PASS — "No syntax errors detected". |
| PHP syntax — render | `php -l render.php` | PASS — "No syntax errors detected". |

Supplementary static checks: all six files are LF line endings, no BOM, no trailing whitespace, tab-indented (no space-indented lines). Biome `2.4.16` was already installed (matches the pinned version) — no `npm install` was run; `package-lock.json` and all dependencies are untouched. `package.json` `devDependencies` still contains only `@biomejs/biome` (no added tooling). `index.js` contains no `/* global */` or `biome-ignore` comment, no `var`, and no `ServerSideRender`.

## Behavior verification

The repository has no committed WordPress runtime (correct per spec — `wp-env`/Docker is out of scope). Each acceptance criterion is verified statically, exactly as the Task 9 gate prescribes; the live manual smoke test is the human's acceptance step.

- **AC1 — Activation, no PHP fatal/notice under `WP_DEBUG`.** `php -l` is clean on all three PHP files. `piano-block.php` is minimal: header docblock → `defined( 'ABSPATH' ) || exit;` (positioned after the header, before code) → one named `init` hook calling `register_block_type( __DIR__ )`. No activation/deactivation hook, no `load_plugin_textdomain`, no `wp_set_script_translations`, no closure. `register_block_type( __DIR__ )` (path form) is guaranteed present on the 6.3 floor, so no `function_exists` guard is needed. `render.php` reads no undefined `$attributes` key and touches no `$block` property (the sole `$attributes`/`$block`/`$content` mention is inside the docblock, not executable code), so no PHP 8+ `Undefined array key` warning. Evidence substantiates AC1.
- **AC2 — Inserter, under Media.** `block.json` declares `"name": "piano-block/piano"`, `"title": "Piano"`, `"category": "media"` (a core category — no custom category created), `"icon": "format-audio"` (bare Dashicons slug), a non-empty `"description"`, and `"keywords": ["piano", "music", "keyboard"]`. Valid JSON, registered on `init`. Evidence substantiates AC2.
- **AC3 — Editor placeholder, no console error.** `index.js` calls `registerBlockType("piano-block/piano", { edit() { … } })` returning `createElement("p", useBlockProps(), __("Piano block — editor placeholder", "piano-block"))`. Exactly the four used `wp.*` members are destructured with `const` (`registerBlockType`, `createElement`, `useBlockProps`, `__`) — no unused bindings. `index.asset.php` declares those members' four core handles (`wp-blocks`, `wp-block-editor` [modern handle, not `wp-editor`], `wp-element`, `wp-i18n`) and version `0.1.0`, with the basename matching `index.js`. No `ServerSideRender`. Evidence substantiates AC3.
- **AC4 — Save, delimiter-only, no invalid-content warning.** `index.js` contains **no** `save` key anywhere (grep: zero matches) — `save` is omitted entirely, the canonical dynamic-block shape that persists only the block delimiter comment and skips block-markup validation. `block.json` declares no `save`/`supports`/`attributes` (grep: zero matches). Evidence substantiates AC4.
- **AC5 — Front-end render, no PHP error.** `render.php` outputs a single `<p>` whose opening tag echoes `get_block_wrapper_attributes()` **directly** (no `esc_attr()` wrapper → no double-escape), with content from `esc_html_e( 'Piano block — front-end placeholder', 'piano-block' )`. `php -l` clean; reads no undefined keys. `style.css` selector `.wp-block-piano-block-piano` (non-empty rule, plain CSS, no SCSS) styles both the front-end wrapper from `get_block_wrapper_attributes()` and the editor wrapper from `useBlockProps()`. Evidence substantiates AC5.

**Per-task acceptance (Tasks 1–9):** all satisfied. Tasks 1–6 each produced the exact byte-stable file content specified in the plan (verified against the diff and on-disk reads). Task 7 (wiring gate): every `block.json` `file:` reference resolves to an existing sibling (`index.js`, `style.css`, `render.php`); the `index.asset.php` sidecar shares the `index` basename and lists the four core handles; block name and text domain match across files; registration is on `init` via the named function. Task 8 (Biome gate): zero diagnostics, three processed files byte-stable, `biome.json` unchanged, only `@biomejs/biome` in `devDependencies`, no suppression comment. Task 9 (acceptance gate): the five ACs are statically substantiated above; the live smoke test is the human acceptance step, consistent with the project's manual/opt-in verification convention.

**Convention compliance & inline documentation:** WordPress PHP conventions met (tab indent, single-quoted strings, ABSPATH guard on the entry file only and correctly placed, no re-escaping of `get_block_wrapper_attributes()`); JS/JSON/CSS are Biome-clean (tab indent, double-quoted JS); docblocks present on `piano-block.php` (header + function) and `render.php` (`@see`-linked) and the `style.css` header comment, exactly as the plan specifies. No regressions: this is a greenfield set of new files; pre-existing files are untouched and the worktree is clean.
