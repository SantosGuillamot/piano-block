# Piano Block

A WordPress block plugin for creating piano song sheets — the long-term goal is to write out notes and build practice sheets you can use to learn and train piano skills.

> **Status:** This repository is an installable WordPress plugin that registers a single **Piano** block. Today that block is a deliberate **scaffold** — a placeholder that appears in the editor and renders on the front end, but with no real piano behaviour yet. The interactive keys, audio, visual design, and input handling are planned for a future task (see [Forthcoming](#forthcoming)).

## What the block does today

The plugin registers exactly one block — **Piano** (`piano-block/piano`):

- It appears in the block inserter under the **Media** category (search for "Piano").
- In the editor, inserting it renders a simple **placeholder** that identifies it as the Piano block.
- It is a **dynamic** (server-rendered) block: its front-end HTML is produced by PHP at render time, and nothing but the block's delimiter comment is stored in post content. On a published page, the block renders a matching placeholder.

There is no playable keyboard or sound yet — the placeholder is intentional, so the plugin can be installed and smoke-tested while the real piano is built on top of it.

## For site administrators

### Requirements

The plugin runs against any WordPress install that meets its declared floor:

- **WordPress 6.3+**
- **PHP 7.4+**

(These are the plugin's runtime minimums. The Node/npm tooling under [For contributors](#for-contributors) is only needed to *develop* the plugin, not to run it.)

### Installation & activation

The repository **is** the plugin (its files live at the repository root), so installing it is a matter of placing those files in your site's plugins directory:

1. Copy the plugin folder into `wp-content/plugins/` of a WordPress 6.3+ / PHP 7.4+ install (for example, as `wp-content/plugins/piano-block/`). You can clone or download this repository directly into that location.
2. In the WordPress admin, go to **Plugins**, find **Piano Block**, and click **Activate**.

A successful install looks like this: the plugin activates with no error, the **Piano** block becomes available in the block inserter (under **Media**), and a published post containing the block shows its placeholder on the front end.

> This scaffold does not ship a local WordPress environment. Use any WordPress install that meets the requirements above; setting one up is up to you.

## For contributors

The plugin is intentionally **no-build**: there is no bundler, transpiler, or `@wordpress/scripts` step. The source you author is what ships. This keeps the scaffold minimal and lets [Biome](https://biomejs.dev/) lint and format everything as written.

### Toolchain requirements

- [Node.js 24 LTS](https://nodejs.org/) — an `.nvmrc` is provided, so run `nvm use`
- npm 11+

### Getting started

```bash
nvm use      # selects Node 24 (see .nvmrc)
npm install  # installs dev dependencies (Biome)
```

`npm install` only installs the development tooling (Biome); the plugin itself has no runtime npm dependencies.

### The no-build authoring model

Because there is no build step, a few conventions hold throughout the source:

- **Plain JavaScript, no JSX.** `index.js` is browser-ready JavaScript that uses WordPress's global script API (`wp.blocks`, `wp.element`, `wp.blockEditor`, `wp.i18n`) directly. There is no JSX and no transpiler.
- **Plain CSS, no SCSS.** `style.css` is plain CSS (Biome has no SCSS support, and none is used).
- **Hand-declared script metadata.** `index.asset.php` declares the editor script's WordPress dependencies and version by hand, in place of a build tool that would otherwise generate that file.
- **Biome for lint/format.** Biome (tab indentation, double-quoted JavaScript) is the single tool for linting and formatting, configured in `biome.json`. The PHP files sit outside Biome's processing set and are not linted or formatted by it.

### File layout

The plugin is a flat set of files at the repository root:

| File | Role |
| --- | --- |
| `piano-block.php` | Main plugin file: the plugin header and the `init` hook that registers the block from its metadata. |
| `block.json` | Block metadata — identity (name, title, `media` category, icon), text domain, and the wiring to the editor script, stylesheet, and server render. |
| `index.js` | The no-build editor script: registers the block and renders the editor placeholder. |
| `index.asset.php` | Hand-written sidecar declaring the editor script's WordPress dependencies and version. |
| `render.php` | Server-rendered front-end output for the dynamic block (the wrapper element plus the placeholder). |
| `style.css` | Minimal placeholder styling, applied in both the editor and on the front end. |

Registration flows from a single source: `piano-block.php` calls `register_block_type()` on the plugin directory, which reads `block.json` and wires the script, style, and render from there.

### Scripts

- `npm run lint` — lint the codebase with Biome.
- `npm run format` — format the codebase with Biome.
- `npm run check` — run Biome's combined lint + format with autofix.

## Forthcoming

The real piano experience — interactive keys, audio, visual design, and input handling — is planned for a future task and is **not** part of this scaffold. When that work lands it will very likely introduce a JavaScript build step (for example, `@wordpress/scripts`) alongside Biome; today's no-build layout is deliberately kept as a subset of that future setup so the migration stays small. None of those capabilities exist yet; this README will be updated when they do.
