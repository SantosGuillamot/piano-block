# Phase 6 verification — `@wordpress/scripts` build + `wp-env`

Live verification of the build migration and local environment added in this PR-review pass.

## Environment

- **wp-env**: WordPress **7.0** dev site (`localhost:8888`), PHP 8.3, MariaDB; `WP_DEBUG=on`.
- Build host: Node 20.20.1 / npm 10.8.2 (below the declared `>=24`/`>=11`; the build and env ran clean regardless — declared floors unchanged).

## Build

- `npm run build` (wp-scripts → webpack 5) compiled `src/` → `build/` in ~720 ms: `index.js`, auto-generated `index.asset.php`, `style-index.css` (+ rtl), and copied `block.json` + `render.php`.
- Generated `build/index.asset.php` dependencies: `react-jsx-runtime, wp-block-editor, wp-blocks, wp-i18n`. The `react-jsx-runtime` handle (automatic JSX runtime) requires WP 6.6+ → WordPress floor bumped to **6.9** per owner decision.
- `npm run lint` (Biome): 6 files checked, **0 diagnostics**. SCSS is owned by the build's Sass pipeline, not Biome.

## 5-point smoke test — live via WP-CLI in wp-env

| AC | Result | Evidence |
|----|--------|----------|
| AC1 — activation, no fatal/notice | ✅ | `wp plugin list` → active `0.1.0`; `WP_DEBUG=on` with **no `debug.log`** (no PHP errors logged) |
| AC2 — inserter under Media | ✅ | registered `piano-block/piano`, `category=media` |
| AC3 — editor placeholder | ✅ (browser console = manual) | `editor_script_handles=piano-block-piano-editor-script` registered; build lints clean; standard `wp.*` deps present in WP 7.0 |
| AC4 — save → delimiter only | ✅ | inserted post persisted `stored=[<!-- wp:piano-block/piano /-->]` (delimiter only, no block markup) |
| AC5 — front-end render | ✅ | `do_blocks(...)` → `<p class="wp-block-piano-block-piano">Piano block — front-end placeholder</p>`, no PHP error |

The only non-scriptable check — AC3's "no JavaScript console error" — needs a browser; everything supporting it (script registration, clean build, standard dependencies) checks out. The env is left running for an optional click-through at `localhost:8888/wp-admin` (`admin` / `password`).

## Decisions applied

- **Linting:** Biome kept as linter/formatter; `@wordpress/scripts` used for `build`/`start` + `wp-env` only.
- **Layout:** full `src/` → `build/` migration with JSX; `register_block_type( __DIR__ . '/build' )`.
- **Styles:** SCSS adopted (`src/style.scss` → `build/style-index.css`).
- **wp-env:** latest WordPress (resolved to 7.0), PHP 8.3.
- **Floors:** WordPress `6.3 → 6.9`; PHP unchanged (`7.4`).
- **`build/`** git-ignored; build/install/dev workflow documented in the README.
- **npm audit:** 18 advisories, all in the dev-only `@wordpress/scripts` dependency tree — not auto-fixed (an `audit fix --force` can break the toolchain); flagged for awareness.
