# Piano Block

A WordPress block plugin for creating piano song sheets — the long-term goal is to write out notes and build practice sheets you can use to learn and train piano skills.

> **Status:** This repository is an installable WordPress plugin that registers a single **Piano** block. Today that block is a deliberate **scaffold** — a placeholder that appears in the editor and renders on the front end, but with no real piano behaviour yet. The interactive keys, audio, visual design, and input handling are planned for a future task (see [Forthcoming](#forthcoming)). A build pipeline (`@wordpress/scripts`) and a local dev environment (`wp-env`) are in place to build on.

## What the block does today

The plugin registers exactly one block — **Piano** (`piano-block/piano`):

- It appears in the block inserter under the **Media** category (search for "Piano").
- In the editor, inserting it renders a simple **placeholder** that identifies it as the Piano block.
- It is a **dynamic** (server-rendered) block: its front-end HTML is produced by PHP at render time, and nothing but the block's delimiter comment is stored in post content. On a published page, the block renders a matching placeholder.

There is no playable keyboard or sound yet — the placeholder is intentional, so the plugin can be built and smoke-tested while the real piano is developed on top of it.

## Using the Piano block

The Piano block stores one **song** — a JSON document in the plugin's own [song format](docs/song-format.md). In v1 you author that song **by hand**, by typing or pasting the JSON into the block. Here is the end-to-end workflow.

### 1. Insert the block

In the editor, open the inserter and add the **Piano** block — it lives under the **Media** category (search for "Piano").

### 2. Enter a song

The block's editor shows a single multi-line text field on the block canvas for the raw song JSON:

- **Label:** *Song (JSON)*
- **Help text:** *The raw song document as JSON. Validation is informational and never blocks saving.*

Type or paste your song's JSON into this field. For the full structure — every field, the allowed values, the two note-name systems, and a complete annotated example — see the [song format reference](docs/song-format.md). (This README does not repeat the field-level detail; that document is the canonical source.)

A **freshly inserted block has no song**: the field starts blank and nothing is stored until you enter something.

### 3. What the validation does

As you type, the editor **checks your input against the song format** and shows a clear error notice beneath the field when the content is not valid JSON or does not conform to the format.

This validation is **informational only — it never blocks saving**. The raw text you typed is **always stored**, whether or not it conforms; the error notice is guidance, not a gate. A couple of details to keep in mind:

- **Empty input shows no error.** Validation runs only on non-empty input; a blank field is the "no song" state and is not validated.
- **It is structural / field checking only.** The validator checks the document's shape and field values, **not** musical timing. A bar whose events do not "add up" to its time signature still saves with no timing error.

### 4. What the front end shows (v1)

On the published page, the block outputs the **stored song content as text** — the exact JSON you entered, with your line breaks and indentation preserved — inside a preformatted (`<pre>`) block. The front end performs **no validation** and renders **whatever is stored**; if there is no song, it outputs **nothing**.

Two expectations to set explicitly:

- **v1 does not render musical notation or play audio.** The front end shows the song *as text*. Visual notation and playback are future work (see [Forthcoming](#forthcoming)).
- **The output is safely escaped.** Any HTML or script characters in the song appear as inert text — no markup is executed.

> **Tip:** The [annotated example song](docs/song-format.md#annotated-example-song) in the format reference is a ready-made starting template. Copy it into the field and adapt it to your own song.

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
