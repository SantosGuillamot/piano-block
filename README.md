# Piano Block

A WordPress block plugin for creating piano song sheets — the long-term goal is to write out notes and build practice sheets you can use to learn and train piano skills.

> **Status:** This repository is an installable WordPress plugin that registers a single **Piano** block. Today that block is a deliberate **scaffold** — a placeholder that appears in the editor and renders on the front end, but with no real piano behaviour yet. The interactive keys, audio, visual design, and input handling are planned for a future task (see [Forthcoming](#forthcoming)). A build pipeline (`@wordpress/scripts`) and a local dev environment (`wp-env`) are in place to build on.

## What the block does today

The plugin registers exactly one block — **Piano** (`piano-block/piano`):

- It appears in the block inserter under the **Media** category (search for "Piano").
- In the editor, inserting it renders a simple **placeholder** that identifies it as the Piano block.
- It is a **dynamic** (server-rendered) block: its front-end HTML is produced by PHP at render time, and nothing but the block's delimiter comment is stored in post content. On a published page, the block renders a matching placeholder.

There is no playable keyboard or sound yet — the placeholder is intentional, so the plugin can be built and smoke-tested while the real piano is developed on top of it.

## Requirements

To **run** the plugin:

- **WordPress 6.9+**
- **PHP 7.4+**

To **build / develop** it (not needed to run an already-built copy):

- [Node.js 24 LTS](https://nodejs.org/) — an `.nvmrc` is provided, so run `nvm use`
- npm 11+
- [Docker](https://www.docker.com/) — only if you use the bundled `wp-env` local environment

## Quick start (local environment)

The fastest way to see the block running is the bundled [`wp-env`](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-env/) environment (requires Docker):

```bash
nvm use            # Node 24 (see .nvmrc)
npm install        # install build + dev tooling
npm run build      # compile src/ → build/
npm run env:start  # boot a local WordPress with the plugin active
```

Then open **http://localhost:8888/** (front end) or **http://localhost:8888/wp-admin/** (admin — user `admin`, password `password`). The Piano block is available in the inserter under **Media**. Stop the environment with `npm run env:stop`.

## Building & installing into an existing site

Because the block is compiled, the installable plugin is the repository **plus its generated `build/` output** (which is git-ignored):

```bash
npm install && npm run build
```

Then copy the plugin directory — **including the generated `build/` folder** — into `wp-content/plugins/` (for example as `wp-content/plugins/piano-block/`) of a WordPress 6.9+ / PHP 7.4+ site, and activate **Piano Block** under **Plugins**. A successful install: the plugin activates with no error, the **Piano** block appears in the inserter under **Media**, and a published post containing it shows the placeholder on the front end.

## For contributors

The block is built with [`@wordpress/scripts`](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-scripts/) (webpack + Babel), authored in `src/` and compiled to `build/`. [Biome](https://biomejs.dev/) remains the linter/formatter — `@wordpress/scripts` is used only for building and for `wp-env`, not for linting.

### The build model

- **JSX + ES modules.** `src/` is authored with JSX and `import`s from the `@wordpress/*` packages; the build transpiles the JSX and externalises those imports to WordPress's runtime script handles, generating `build/index.asset.php` (the script's dependencies and version) automatically.
- **SCSS.** Styles are authored in `src/style.scss` and compiled to `build/style-index.css`. (Biome does not process SCSS; the build's Sass pipeline owns it.)
- **Biome for lint/format.** Biome (tab indentation, double-quoted JS) lints and formats the JavaScript/JSON sources in `src/`. The generated `build/` directory is git-ignored and therefore outside Biome's set; the PHP files sit outside Biome's processing set and are not linted by it.
- **`register_block_type()` targets `build/`.** `piano-block.php` registers the block from the `build/` directory, so you must run `npm run build` before the plugin will work.

### File layout

| Path | Role |
| --- | --- |
| `piano-block.php` | Main plugin file: the plugin header and the `init` hook that registers the block from `build/`. |
| `src/block.json` | Block metadata — identity (name, title, `media` category, icon), text domain, and the wiring to the editor script, stylesheet, and server render. |
| `src/index.js` | Editor entry point: registers the block and imports the styles. |
| `src/edit.js` | The block's editor component (JSX) — renders the placeholder. |
| `src/style.scss` | Placeholder styling (editor + front end), compiled by the build. |
| `src/render.php` | Server-rendered front-end output for the dynamic block. |
| `build/` | Compiled output (generated by `npm run build`; git-ignored). |
| `.wp-env.json` | Local `wp-env` configuration (latest WordPress, PHP 8.3, this plugin mapped in). |

### Scripts

- `npm run build` — compile `src/` → `build/` (production build).
- `npm run start` — compile and watch `src/` for changes (development).
- `npm run env:start` / `npm run env:stop` — start / stop the local `wp-env` WordPress.
- `npm run lint` — lint with Biome.
- `npm run format` — format with Biome.
- `npm run check` — Biome's combined lint + format with autofix.

## Forthcoming

The real piano experience — interactive keys, audio, visual design, and input handling — is planned for a future task and is **not** part of this scaffold. The build pipeline and local environment that work will rely on are now in place; the block itself remains a placeholder until then. This README will be updated when the real functionality lands.
