# Requirements: Scaffold a basic Piano block plugin

> Phase 1 artifact — requirements (the WHAT, not the HOW). Built iteratively via research-backed Q&A with `spec-researcher`. Source of intent: `0-prompt/prompt.md` (GitHub issue [#1](https://github.com/SantosGuillamot/piano-block/issues/1)).

## Rough idea

Stand up a **minimal, installable WordPress plugin** that registers a single **"Piano" block**. The block must:

- Appear in the block editor with a **basic `edit` view**, and
- Render on the front end via a **server-side `render.php`** (i.e. a dynamic block).

This is a **scaffold only** — a clean foundation for a future task to build the real piano functionality on. The actual piano experience (interactive keys, audio, visual design, input handling) is explicitly **out of scope** here.

**Grounding facts (from the repo as it stands today):**

- Greenfield repository. Only tooling exists: [Biome](https://biomejs.dev/) for lint/format (tab indent, double quotes for JS), pinned to **Node 24 LTS** / npm 11+. No WordPress or block code yet.
- Plain **CSS** only — the current toolchain has no SCSS support.
- `package.json` long-term product description: *"A WordPress block (planned) for creating piano song sheets to practice and learn piano."* (context for the eventual feature; **not** in scope for this scaffold).

**Owner's open hypotheses (to validate, not assume):**

- A `render.php` implies a **dynamic, server-rendered block** — confirm dynamic is the right shape for a scaffold.
- A basic `edit` component represents the block on the editor side.

## Q&A

_One question at a time, each backed by research from `spec-researcher`. Recorded in real time below._

### Q1 — Is "render.php ⇒ dynamic, server-rendered block" the right shape? (validates owner hypothesis)

**Answer: CONFIRMED.** Per current WP docs (Block API v3, WP 6.x), `render.php` is the canonical way to declare a *dynamic* (server-rendered) block.

- **Wiring:** declared in `block.json` as `"render": "file:./render.php"` (the modern Block API v3 convention; this is what `create-block` scaffolds). The older `register_block_type( $name, [ 'render_callback' => … ] )` PHP form is equivalent but not the convention. WP loads `render.php` for every instance of the block when rendering page HTML on the server.
- **Variables in scope inside `render.php`:** `$attributes` (array), `$content` (string), `$block` (`WP_Block`). Conventional wrapper is `get_block_wrapper_attributes()` — the PHP analog of `useBlockProps()`.
- **Dynamic vs static:** using `render.php` *is* the dynamic pattern. `save` and `render.php` are not mutually exclusive (a block may save fallback HTML that the server overrides), but the cleanest scaffold is **pure dynamic**: `save` returns `null`, all front-end markup in `render.php`. This matches the official `create-block` dynamic scaffold ("you will not see a save.js file"; "the built-in save function just returns null"). Returning `null` also sidesteps block-markup validation — valuable for a scaffold whose markup will change.
- **Editor side:** `edit` renders its own representation; it does **not** need `ServerSideRender`. The default dynamic scaffold uses a **static placeholder** with `useBlockProps()` (e.g. `<p {...useBlockProps()}>…</p>`). `ServerSideRender` (`@wordpress/server-side-render`) is positioned as an *optional fallback* — "client-side rendering in JavaScript is always preferred." Recommendation for a minimal scaffold: static `useBlockProps` placeholder, no `ServerSideRender`.

**Decision for the spec:** Pure dynamic block — `block.json` `"render": "file:./render.php"`, `save` → `null`, static `useBlockProps()` placeholder in `edit`. Conventional, minimal, docs-endorsed, and directly matches the owner's `render.php` intent and the "scaffold that grows into a server-rendered piano" goal.

**Sources (all developer.wordpress.org, Block Editor Handbook):** [block.json metadata](https://developer.wordpress.org/block-editor/reference-guides/block-api/block-metadata/) · [Creating dynamic blocks](https://developer.wordpress.org/block-editor/how-to-guides/block-tutorial/creating-dynamic-blocks/) · [Static or dynamic rendering](https://developer.wordpress.org/block-editor/getting-started/fundamentals/static-dynamic-rendering/) · [Build your first block tutorial](https://developer.wordpress.org/block-editor/getting-started/tutorial/)

**Open caveat:** exact WP version that introduced the `"render"` property is not pinned to an official source (snippets suggested 6.1). Relevant to a later "minimum WP version" question.

### Q2 — Does the scaffold need a JS build step, given Biome-only + plain-CSS constraints?

**Answer: A build step is NOT required.** A no-build, plain-JS + plain-CSS block is officially supported, runs entirely on `wp.*` globals, and is the cleaner fit for the repo's constraints. **Recommendation: no-build (option b).**

- **No build needed for `edit` JS:** the handbook has a dedicated "JavaScript for Blocks Without a Build Step" path — interact directly with the global `wp` object. A build is only needed for **JSX/ESNext** that requires transpilation. WP ships a canonical, installable, API v3 **no-build example** (`block-development-examples/minimal-block-no-build-e621a6`): `block.json` references `"editorScript": "file:./block.js"`; `block.js` is plain browser JS using `var el = wp.element.createElement` (no JSX), calling `wp.blocks.registerBlockType`; `plugin.php` is just `register_block_type( __DIR__ )` on `init`.
- **Asset wiring without wp-scripts:** `editorScript`/`script`/`viewScript`/`editorStyle`/`style` each accept a `file:` path **or** a registered handle. For a `file:` JS path, WP auto-detects a sibling `*.asset.php` returning `{ dependencies: string[], version }`. **You hand-write this file** (handbook: "to register a block without this wp-scripts build process you'll need to manually create `*.asset.php` dependencies files"). Defaults: `dependencies` → `[]`; `version` → `false` (WP then injects the installed WP version). So the `.asset.php` is technically optional but hand-writing it is the clean, explicit way to declare deps (`wp-blocks`, `wp-element`, `wp-block-editor`, `wp-i18n`) + a cache-busting version.
- **Why the standard scaffold conflicts with repo constraints:** `@wordpress/scripts` (via `create-block`) bundles webpack+Babel, **ESLint** (`@wordpress/eslint-plugin`), **stylelint**, **Prettier**, plus more — confirmed from its package reference. The default `create-block` block template also ships **SCSS** (`style.scss`, `editor.scss`). Both directly contradict the repo's **Biome-only** and **plain-CSS / no-SCSS** constraints.

**Tradeoff summary (researcher's table):**

| | (a) `@wordpress/scripts` build | (b) No-build plain JS + plain CSS |
|---|---|---|
| Repo constraint fit | **Conflicts** (ships SCSS + ESLint/Prettier/stylelint vs Biome) | **Clean fit** (plain `.css`/`.js`, Biome lints/formats directly) |
| Build/CI | webpack+Babel, `build/` output, generated `index.asset.php` | none; files load as-authored; hand-written `*.asset.php` |
| npm deps | adds `@wordpress/scripts` (large tree) | zero beyond existing Biome |
| Editor JS ergonomics | JSX + ESNext (nicer for complex UI) | `wp.element.createElement` (verbose for complex UI) |
| Real-piano implication | JSX/build pays off as keys/audio UI grows | interactive piano (Interactivity API `view.js`, rich `edit`) will likely *want* JSX/a bundler later |

**Decision for the spec:** **No-build plain-JS + plain-CSS** scaffold. It is the only option honoring the Biome-only + plain-CSS constraints, is officially supported and fully installable, and Biome can lint/format `block.js`, `block.json`, and `.css` as-is.

**Named tension for the design phase (must be surfaced, not resolved by accident):** the future "real piano" task (interactive keys, audio, WP **Interactivity API**) will plausibly want JSX and a bundler. The spec keeps the scaffold no-build now and treats "introduce a build" as an **explicit future decision** when the piano UI lands — the stronger match to the issue's "scaffold only, minimal, Biome-only, plain CSS" intent. Design should name this tension deliberately.

**Sources (official):** [JS without a build step](https://developer.wordpress.org/block-editor/how-to-guides/javascript/js-build-setup/) · [JavaScript in the Block Editor](https://developer.wordpress.org/block-editor/getting-started/fundamentals/javascript-in-the-block-editor/) · [Get started with wp-scripts](https://developer.wordpress.org/block-editor/getting-started/devenv/get-started-with-wp-scripts/) · [@wordpress/scripts reference](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-scripts/) · [block.json metadata](https://developer.wordpress.org/block-editor/reference-guides/block-api/block-metadata/) · [create-block README](https://github.com/WordPress/gutenberg/blob/trunk/packages/create-block/README.md) · [create-block block template (ships SCSS)](https://github.com/WordPress/gutenberg/tree/trunk/packages/create-block/lib/templates/block) · [canonical no-build example](https://github.com/WordPress/block-development-examples/tree/trunk/plugins/minimal-block-no-build-e621a6)

### Q3 — What does a minimal-but-correct installable single-block plugin require? (definition of done)

**Answer:** required-vs-optional checklist, all sourced.

**Plugin header (main PHP file):**
- **Strictly required: only `Plugin Name`** — that one field makes the plugin detectable/activatable.
- **Recommended for a correct scaffold:** `Description`, `Version`, `Requires at least`, `Requires PHP`, `Author`, `License` (`GPL-2.0-or-later`, matching `package.json`), `License URI`, `Text Domain`.
- **Conventional pattern:** single PHP file with the header comment, then `add_action( 'init', fn() => register_block_type( __DIR__ ) )` — `register_block_type( __DIR__ )` reads `block.json` and wires `editorScript`/`style`/`render` automatically. (`__DIR__` points at the dir containing `block.json`; would be `/build` only if a build is later added.)

**`block.json` required vs optional:**
- **Strictly required to register: `name` + `title` only.**
  - `name`: *"lowercase alphanumeric characters, dashes, and at most one forward slash … must begin with a letter."* Form `namespace/block-name` → **`piano-block/piano`**.
  - `title`: Inserter display name; localizable.
- **Practically needed for a good scaffold (technically optional):** `apiVersion: 3` (defaults to 1 if omitted), `category`, `editorScript` (without it the block won't render in the editor), and `render` (the `render.php`, for a dynamic block). Polish: `icon`, `description`, `keywords`, `style`, `editorStyle`, `textdomain`, `$schema` (`"https://schemas.wp.org/trunk/block.json"`).
  - **`category` must be one of six core categories:** `text`, `media`, `design`, `widgets`, `theme`, `embed`. **No "music"/"audio" core category exists.** A custom category can be registered later via the `block_categories_all` filter (future, not now). Pick deferred to my decision below.

**Internationalization — minimal correct stance (partially built-in):**
- `register_block_type` auto-translates `block.json` translatable fields (`title`, `description`, `keywords`) via the **`textdomain`** property + i18n schema (since WP 5.7.0) at zero cost. **Include `textdomain` + matching `Text Domain` header** — one line, best practice.
- Translating strings *inside* `edit` JS (`__()` from `wp-i18n`) requires **`wp_set_script_translations()`**. For a scaffold with a trivial placeholder, **defer this as documented future best-practice** (wrap user-facing strings in `__()`, wire `wp_set_script_translations` when there are real JS strings).
- `load_plugin_textdomain` is **not required** (core auto-loads since WP 4.6) → optional/future.

**Minimum WP & PHP (now pinned):**
- **`Requires at least: 6.3`.** Two floors: the `render` property was added in **WP 6.1.0** (resolves the Q1 open caveat — confirmed via Make/Core "Block API changes in WordPress 6.1", Trac #53148, and the `register_block_type_from_metadata` changelog); and `apiVersion: 3` behaves correctly from **WP 6.3** (iframed editor). Stricter floor governs → **6.3**.
- **`Requires PHP: 7.4`** is the safe, conventional floor (WP.org supports 7.4+, recommends 8.x); nothing in the scaffold needs more. Final wording decided below.

**Sources (official/primary):** [Plugin header requirements](https://developer.wordpress.org/plugins/plugin-basics/header-requirements/) · [block.json metadata](https://developer.wordpress.org/block-editor/reference-guides/block-api/block-metadata/) · [Internationalization](https://developer.wordpress.org/block-editor/how-to-guides/internationalization/) · [register_block_type_from_metadata](https://developer.wordpress.org/reference/functions/register_block_type_from_metadata/) · [Block API changes in WP 6.1](https://make.wordpress.org/core/2022/10/12/block-api-changes-in-wordpress-6-1/) · [Trac #53148](https://core.trac.wordpress.org/ticket/53148) · [Editor changes in WP 6.3 (apiVersion 3)](https://make.wordpress.org/core/2023/07/18/miscellaneous-editor-changes-in-wordpress-6-3/) · [WordPress requirements](https://wordpress.org/about/requirements/)

### Analyst decisions on the two judgment calls left by Q3

1. **`category` → `media`.** Closest semantic fit for a piano/sound block among the six core categories (the eventual product plays/sheets musical notes). Registering a custom "music" category is a documented future option via `block_categories_all` once the real piano lands; out of scope for the scaffold.
2. **`Requires PHP` → `7.4`.** Maximizes install compatibility for a foundation plugin; nothing in the scaffold needs 8.x syntax. The repo's *development* toolchain pins Node 24, but PHP runtime support is a separate, deliberately broad floor. Revisit only if the real piano needs newer PHP.

Both are conventional, reversible defaults; recorded as decisions, not blockers.

### Q4 — Measurable acceptance criteria + scope boundary on local env / automated tests

**Answer:** the proposed manual smoke test IS the conventional acceptance bar; `wp-env` config and automated tests are opt-in even in the official scaffold, so both are defensible **non-goals** here.

**Five-point manual smoke test (the measurable acceptance bar):**
1. **Activation** — plugin activates with **no PHP fatal/error** (ideally no notices/warnings with `WP_DEBUG` on).
2. **Inserter** — block appears in the inserter, **searchable by `title`** (and `keywords` if set), **listed under the declared `category`** (`media`).
3. **Editor** — inserting renders the **`edit` placeholder** with **no JS console error**.
4. **Save/validation** — post saves cleanly. For the dynamic `save → null` block, the editor saves **only the block delimiter comment** (e.g. `<!-- wp:piano-block/piano /-->`) and **skips block markup validation** — so there is no "invalid content" warning. This is expected and a benefit of the null-save shape (ties to Q1).
5. **Front end** — viewing the published post renders the **`render.php` output** (wrapper from `get_block_wrapper_attributes()` + placeholder), with no PHP error.

There is no single official "acceptance checklist" doc, but the handbook's create-block walkthrough exercises exactly this sequence; it's the de-facto smoke test. Researcher's advice: do not add more.

**Local WP environment (`wp-env`) — explicit non-goal (optional, noted):**
- `wp-env` IS the officially *recommended* local env for Gutenberg development (Docker-based; `.wp-env.json`; `npx wp-env start`). **But it is opt-in, not default scaffold hygiene** — verified: create-block's default `plugin`/`es5` templates contain **no `.wp-env.json`**; it's only added with the `--wp-env` flag.
- Decision: **do not ship `wp-env` as a scaffold deliverable.** It would introduce the repo's first `@wordpress/*` dev dependency + a Docker requirement, against the "minimal, Biome-only" intent, and it's a developer convenience, not part of the shippable plugin. Note that `npx @wordpress/env` (no install) or any local WP can run the smoke test, and a committed `.wp-env.json` is a reasonable **future** convenience.

**Automated tests (Jest / Playwright) — explicit non-goal for this phase:**
- `@wordpress/scripts` bundles `test-unit-js` (Jest) and `test-e2e`/`test-playwright`, but **the default create-block scaffold ships NO test files** (verified). Automated tests are not baseline scaffold output.
- For a scaffold whose only behavior is "register a block that shows a placeholder and renders static server markup," there is effectively nothing meaningful to unit-test, and an e2e test would re-assert the manual smoke test at high tooling cost (pulling in the `@wordpress/scripts` chain deliberately avoided in Q2). **Boundary: manual-verification-only; defer automated unit/e2e tests to when real piano functionality exists.**

**Sources (official):** [Block-editor dev environment (wp-env recommended)](https://developer.wordpress.org/block-editor/getting-started/devenv/) · [@wordpress/env](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-env/) · [@wordpress/scripts (test runners)](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-scripts/) · [create-block README (`--wp-env` opt-in)](https://github.com/WordPress/gutenberg/blob/trunk/packages/create-block/README.md) · [create-block templates (no .wp-env.json / no tests; es5 ships plain CSS + render.php)](https://github.com/WordPress/gutenberg/tree/trunk/packages/create-block/lib/templates) · [Dynamic save→null skips validation](https://developer.wordpress.org/block-editor/getting-started/fundamentals/static-dynamic-rendering/)

---

## Consolidated Requirements

> The WHAT for the Piano block **scaffold**. Each item is research-backed (see Q&A above). HOW (file layout details, exact markup) is for the design/plan phases. "Block" throughout = the single Piano block; "the plugin" = the WordPress plugin that registers it.

**A. Block shape & rendering**

1. The plugin MUST register exactly **one block**, named **`piano-block/piano`** (Block API v3), as a **dynamic, server-rendered block**.
2. Front-end output MUST be produced by a **server-side `render.php`**, wired via `block.json` `"render": "file:./render.php"`. WordPress invokes it per block instance at render time.
3. The block's **`save` MUST be `null`** (no saved markup) — pure dynamic. Persisted post content is just the block delimiter comment; block markup validation is intentionally skipped.
4. `render.php` MUST emit minimal, valid front-end markup using **`get_block_wrapper_attributes()`** on the wrapping element, plus simple placeholder content sufficient to confirm the block rendered. No piano behavior.
5. The **`edit`** component MUST render a **basic static placeholder** in the editor using **`useBlockProps()`** (equivalently `wp.blockEditor.useBlockProps` in no-build form). It MUST NOT use `ServerSideRender`. No piano behavior.

**B. Toolchain & authoring constraints**

6. The scaffold MUST be **no-build**: editor JS authored in plain browser-compatible JavaScript against the global `wp.*` API (e.g. `wp.blocks.registerBlockType`, `wp.element.createElement`, `wp.blockEditor.useBlockProps`) — **no JSX, no webpack/Babel, no `@wordpress/scripts`**.
7. Any block styling MUST be **plain CSS** (no SCSS). Styling is optional for the scaffold; if present it is minimal and wired via `block.json` `style`/`editorStyle`.
8. The block's JS MUST be wired via `block.json` `editorScript: "file:./<script>.js"` with a **hand-written sibling `*.asset.php`** declaring its script dependencies (e.g. `wp-blocks`, `wp-element`, `wp-block-editor`) and a version string. (`dependencies` defaults to `[]`, `version` to `false` if omitted — but the file is included for explicitness.)
9. Authored files (`block.json`, the block JS, any `.css`) MUST pass the repo's existing **Biome** lint/format (tab indent, double-quoted JS) with no new lint tooling added.

**C. Installable plugin**

10. The plugin MUST be a standard WordPress plugin: a main PHP file carrying a plugin **header comment** with at least **`Plugin Name`**, plus the recommended fields **`Description`, `Version`, `Requires at least: 6.3`, `Requires PHP: 7.4`, `Author`, `License: GPL-2.0-or-later`, `License URI`, `Text Domain`**.
11. The plugin MUST register the block on the **`init`** hook via **`register_block_type( __DIR__ )`** (or the directory containing `block.json`), reading `block.json` for all metadata/asset wiring.
12. `block.json` MUST include: `$schema`, `apiVersion: 3`, `name` (`piano-block/piano`), `title`, `category: media`, `editorScript`, `render`, and a `textdomain` (matching the plugin `Text Domain`); SHOULD include `icon` and `description`. `style`/`editorStyle`/`keywords` are optional.
13. Internationalization, minimal stance: set `textdomain` + matching `Text Domain` so `block.json` metadata strings are translation-ready at no cost; wrap any user-facing JS string in `__()`. Wiring `wp_set_script_translations()` / `load_plugin_textdomain()` is **deferred** (see non-goals).

**D. Success criteria — five-point manual smoke test (acceptance bar)**

14. **Activation:** plugin activates with no PHP fatal/error (no notices/warnings under `WP_DEBUG`).
15. **Inserter:** the Piano block appears in the block inserter, searchable by its `title`, listed under the **`media`** category.
16. **Editor:** inserting the block renders the `edit` placeholder with no JavaScript console error.
17. **Save:** the post saves cleanly; persisted content is just the block delimiter comment with no "invalid content" warning.
18. **Front end:** the published post renders the `render.php` output (block wrapper + placeholder) with no PHP error.

**E. Explicit non-goals / out of scope (deferred to future tasks)**

19. The real piano experience — interactive keys, audio/sound, visual design, input handling, and any use of the **Interactivity API** / `viewScript` — is **out of scope**.
20. **No JS build pipeline** (`@wordpress/scripts`/webpack/Babel/JSX). *Named tension:* the future piano UI will likely justify introducing a build; that is an explicit later decision, deliberately deferred to keep this scaffold minimal and Biome-only.
21. **No `wp-env`/local-env config** committed (`.wp-env.json` or `@wordpress/env` dependency). Verification uses any local WordPress (e.g. `npx @wordpress/env`); a committed config is a reasonable future convenience.
22. **No automated tests** (Jest unit / Playwright e2e). Deferred until real functionality exists; manual smoke test (D) is the bar for the scaffold.
23. **No custom block category** ("music"/"audio"). Reuse core `media` now; a custom category via the `block_categories_all` filter is a future option.
24. **No additional blocks, block attributes/controls, inspector/toolbar settings, or block variations** beyond the single placeholder block.

**F. Open items (nice-to-have / lower-confidence, do not block)**

25. Exact placeholder copy/labels for `edit` and `render.php`, and the block `icon`/`description`/`keywords` wording — design's call; should make the block recognizably "Piano" and the front-end output clearly distinguishable for smoke-testing.
26. Whether to include a minimal `style.css`/`editor.css` at all, or ship style-free — design's call (item 7 permits either).
27. `Requires PHP` could be stated as `8.0` to match WP.org's modern recommendation instead of `7.4`; `7.4` chosen for max compatibility (reversible).
