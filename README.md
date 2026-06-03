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
| `src/edit.js` | The block's editor component (JSX) — renders the placeholder and the raw-JSON `song` field (`TextareaControl` + non-blocking error `Notice`). |
| `src/style.scss` | Placeholder styling (editor + front end), compiled by the build. |
| `src/render.php` | Server-rendered front-end output for the dynamic block — the escaped, verbatim `song` passthrough. |
| `src/song/schema.js` | The song format's declarative **schema-as-data** — the single source of truth for "what is a conformant song." |
| `src/song/validate.js` | The zero-dependency validator/walker that interprets `schema.js` and returns human-readable, path-pointed errors. |
| `src/song/__tests__/` | Jest unit tests for the schema and validator (run by `npm run test:unit`). |
| `specs/` | Playwright end-to-end tests — `editor.spec.js` (authoring + persistence) and `render.spec.js` (front-end render + escaping), run by `npm run test:e2e`. |
| `build/` | Compiled output (generated by `npm run build`; git-ignored). |
| `.wp-env.json` | Local `wp-env` configuration (latest WordPress, PHP 8.3, this plugin mapped in). |

### Scripts

- `npm run build` — compile `src/` → `build/` (production build).
- `npm run start` — compile and watch `src/` for changes (development).
- `npm run env:start` / `npm run env:stop` — start / stop the local `wp-env` WordPress.
- `npm run test:unit` — run the Jest unit tests (the song validator suite) in pure Node, no WordPress runtime.
- `npm run test:e2e` — run the Playwright end-to-end tests against the local `wp-env` (editor + front-end behavior). Prerequisites in order: `npm install` → `npm run build` → `npm run env:start` → `npm run test:e2e`.
- `npm run lint` — lint with Biome.
- `npm run format` — format with Biome.
- `npm run check` — Biome's combined lint + format with autofix.

### The song format and validator

The block stores one **song** — a JSON document in the plugin's own format — in a single block attribute. The author-facing field reference (every field, the allowed values, the two note-name systems, the annotated example) lives in [`docs/song-format.md`](docs/song-format.md). This section is the *contributor* view: how the feature is built and the rules to preserve when extending it.

**Storage model.** The `song` attribute is declared in `src/block.json` as `{ "type": "string", "default": "" }`. It is a **string** — not an `object`/`array` — deliberately: it must store the author's **raw, possibly-non-conformant** input verbatim (a parsed-JSON attribute type categorically cannot hold text that is not valid JSON), and re-encoding would mutate the author's literal text. The empty string is the canonical **"no song" sentinel**. Because the block is dynamic (`save: null`), WordPress serializes the attribute into the block-comment delimiter, and `render.php` receives it as `$attributes['song']`.

**Schema-as-data + a purpose-built walker (no `ajv`).** Conformance is defined by a declarative schema object, [`src/song/schema.js`](src/song/schema.js) — the **single source of truth** for "what is a conformant song." It is pure data with no logic and is written to be read as documentation. A small, recursive, **zero-dependency** validator, `src/song/validate.js`, interprets it. This is a deliberate choice: rather than pull in a JSON-Schema library (`ajv` would be the editor bundle's first runtime dependency), the walker interprets only the small JSON-Schema **subset** the format actually uses:

- `type`, `required`, `properties`, `items`, `enum`, `$ref`/`$defs`, integer `minimum`/`maximum`, one `if`/`then` (with a `const` discriminant), and **permissive** `additionalProperties`.

Three checks the keyword subset cannot express are handled directly by the walker, keyed off the schema's own `$defs` names so they stay tied to the single source of truth: the **note-name vocabulary** (`pitch.step` and `alters` keys, matched case-insensitively against English `C D E F G A B` + Spanish `do re mi fa sol la si`); the **`alters` map** (every key a recognised note name, every value an integer in −2..+2); and the strict lower bound **`tempo.bpm` > 0**. The validator's single entry point, `validateSong(rawString)`, parses the raw string (a parse failure *is* a conformance error) and returns a list of human-readable, path-pointed messages — `[]` when the song conforms. Editor-side validation is **informational only** and never blocks saving (see [Using the Piano block](#using-the-piano-block)).

> **Recorded swap trigger:** if the format ever outgrows the hand-rolled walker (many conditionals, cross-references), adopting `ajv` consuming the *same* `schema.js` is a localized change — the schema is already the source of truth.

**Conformance policy — lenient on unknown, closed on enumerated.** When extending the format, preserve this rule:

- **Unknown object properties are ignored, not errors** (`additionalProperties` is permissive everywhere). This keeps the format forward-compatible: an *older* validator must not hard-fail a song that uses a field from a *future* version of the format — which matters precisely because there is **no `version` field** to gate on.
- **Enumerated values are closed.** The value enums (durations, clefs, dynamics, barlines, tie/slur, `type`, `beatType`) are the format's fixed vocabulary, not extension points; a typo like `"quaver"` for a duration **is** a conformance error.
- **Accepted trade-off:** a misspelled *optional* property (e.g. `dynmic` for `dynamic`) is silently ignored rather than flagged — an accepted cost of the permissive, never-blocking v1 stance.

**Additive growth (no `version` field).** New capabilities arrive as **new optional fields** on existing objects (`event` / `section` / `measure` / `handConfig` / `pitch`) — never a breaking change, never a `version` field. A song authored against today's format stays conformant after the format grows, because old songs simply omit the new fields. The spec's "Out of Scope" list (articulations, ornaments, pedal, fingering, tuplets, voltas, multiple voices, lyrics, per-pitch ties, wider octave-shift, triple dots, …) is effectively the backlog of additive candidates.

**Render contract — verbatim escaped passthrough.** `src/render.php` outputs the stored `song` string **as-is** inside a `<pre>` via `esc_html()`, with the wrapper attributes from `get_block_wrapper_attributes()`; it outputs **nothing** when the song is empty or whitespace-only. It performs **no** validation, parsing, or re-serialization, and contributors must keep it that way: adding `json_encode`/`json_decode` would re-escape, reorder, or fail on the author's literal text (and would break non-JSON input), violating the "outputs whatever is stored" contract. Escaping makes any markup or script in the stored content render as inert text (no XSS); the front end does **not** validate.

**Tests.** Unit tests (`src/song/__tests__/`, run by `npm run test:unit`) exercise the validator in pure Node: the comprehensive example song from the format reference, both note-name systems (case-insensitive), closed-enum / type / range errors, the lenient-on-unknown policy, and the structural-only stance (no musical-timing check). End-to-end tests (`specs/`, run by `npm run test:e2e` against `wp-env`) cover the editor (a fresh block is empty; conformant input shows no error; non-conformant input is flagged yet still stored; a song round-trips across save/reload) and the front end (empty renders nothing; a stored song renders verbatim in a `<pre>`; a hostile payload renders escaped and inert).

> The full rationale behind these decisions — the data model, the rejected alternatives, and the requirement/AC traceability — is in the design doc at `.rp/pipelines/2-store-song-information/2-design-doc/design-doc.md`.

## Forthcoming

The real piano experience — interactive keys, audio, visual design, and input handling — is planned for a future task and is **not** part of this scaffold. The build pipeline and local environment that work will rely on are now in place; the block itself remains a placeholder until then. This README will be updated when the real functionality lands.
