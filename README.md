# Piano Block

A WordPress block plugin for creating piano song sheets — the long-term goal is to write out notes and build practice sheets you can use to learn and train piano skills.

> **Status:** This repository is an installable WordPress plugin that registers a single **Piano** block. The block **stores a complete song** as structured JSON — a right-hand + left-hand grand staff in the plugin's own [song format](docs/song-format.md) — authored by hand in a raw-JSON editor field, and on the front end **renders that song as visual piano sheet music**: a braced grand staff drawn as an SVG by the plugin's own rendering code (no third-party notation library). It does **not** yet play audio or offer a visual authoring UI; audio playback and a richer authoring experience remain future work (see [Forthcoming](#forthcoming)). A build toolchain (`@wordpress/scripts`) and a local dev environment (`wp-env`) are in place to build on.

## What the block does today

The plugin registers exactly one block — **Piano** (`piano-block/piano`):

- It appears in the block inserter under the **Media** category (search for "Piano").
- In the editor, it shows a single **raw-JSON field** where you author a song document in the plugin's own [song format](docs/song-format.md). The field's input is **validated for conformance**, but that check is **informational only — it never blocks saving**, and your raw text is always stored.
- It is a **dynamic** (server-rendered) block: the stored `song` string lives in the block's delimiter comment, and PHP emits a lightweight container carrying that song to the front end. On a published page, the block's own client-side code reads the song and draws it as **visual piano sheet music** — a braced grand staff — directly in the page (and nothing at all when there is no song).

There is no playable keyboard or audio yet, and authoring is still by hand in a raw-JSON field — but a published page now shows the song as readable notation rather than as text, so the rest of the piano experience can be developed on top of it. See [Using the Piano block](#using-the-piano-block) for the authoring workflow.

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

### 4. What the front end shows

On the published page, the block **renders your song as visual piano sheet music** — a braced grand staff (a treble staff for the right hand and a bass staff for the left, joined by a brace), drawn as an SVG by the plugin's own client-side rendering code. There is **no third-party notation library**: the staves, clefs, notes, rests, and accidentals are drawn by the plugin itself, using a bundled music font for the ornate symbols.

What appears depends on what you stored — there are three cases:

- **A conformant song renders as sheet music.** If the stored song matches the [song format](docs/song-format.md), the front end parses it and draws the grand staff.
- **No song renders nothing.** A block with an empty (or whitespace-only) song outputs nothing at all.
- **A non-renderable song renders nothing.** If the stored content is not valid JSON, or is valid JSON that does not conform to the song format, the front end draws **nothing** — there is **no raw-JSON echo and no error message** shown on the page. (The editor's validation notice in step 3 is where you catch and fix such problems while authoring.)

The notation is drawn entirely in the browser by the block's own code, so it is the **front end** that decides whether to render or stay empty; the server does no validation. The score itself shows only the music — there is no visible title or composer heading (the song's `metadata` is used only to label the notation for assistive technology).

> **Tip:** The [annotated example song](docs/song-format.md#annotated-example-song) in the format reference is a ready-made starting template. Copy it into the field, view the published post, and you will see it rendered as a grand staff.

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

Then copy the plugin directory — **including the generated `build/` folder** — into `wp-content/plugins/` (for example as `wp-content/plugins/piano-block/`) of a WordPress 6.9+ / PHP 7.4+ site, and activate **Piano Block** under **Plugins**. A successful install: the plugin activates with no error, the **Piano** block appears in the inserter under **Media**, and a published post containing a block with a conformant song renders that song as a grand staff of sheet music on the front end.

## For contributors

The block is built with [`@wordpress/scripts`](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-scripts/) (webpack + Babel), authored in `src/` and compiled to `build/`. [Biome](https://biomejs.dev/) remains the linter/formatter — `@wordpress/scripts` is used only for building and for `wp-env`, not for linting.

### The build model

- **JSX + ES modules.** `src/` is authored with JSX and `import`s from the `@wordpress/*` packages; the build transpiles the JSX and externalises those imports to WordPress's runtime script handles, generating `build/index.asset.php` (the script's dependencies and version) automatically.
- **SCSS.** Styles are authored in `src/style.scss` and compiled to `build/style-index.css`. (Biome does not process SCSS; the build's Sass step owns it.)
- **Biome for lint/format.** Biome (tab indentation, double-quoted JS) lints and formats the JavaScript/JSON sources in `src/`. The generated `build/` directory is git-ignored and therefore outside Biome's set; the PHP files sit outside Biome's processing set and are not linted by it.
- **`register_block_type()` targets `build/`.** `piano-block.php` registers the block from the `build/` directory, so you must run `npm run build` before the plugin will work.

### File layout

| Path | Role |
| --- | --- |
| `piano-block.php` | Main plugin file: the plugin header and the `init` hook that registers the block from `build/`. |
| `src/block.json` | Block metadata — identity (name, title, `media` category, icon), text domain, the `song` string attribute (`default: ""`), and the wiring to the editor script, stylesheet, and server render. |
| `src/index.js` | Editor entry point: registers the block and imports the styles. |
| `src/edit.js` | The block's editor component (JSX) — renders the raw-JSON `song` field (`TextareaControl` + non-blocking error `Notice`) on the block canvas. |
| `src/style.scss` | Placeholder styling (editor + front end), compiled by the build. |
| `src/render.php` | Server-rendered front-end output for the dynamic block — a block-wrapper `<div>` carrying the raw `song` inside an inert `application/json` `<script>` for the frontend to read (no validation, no `<pre>`). |
| `src/view.js` | The frontend `viewScript` entry: reads the inert JSON `<script>`, runs the reused validate gate, and (for a conformant song) builds the layout model and mounts the SVG, computes the accessible name, and reflows on resize. The thin, DOM-coupled half of the renderer. |
| `src/notation/` | The plugin's **own** rendering engine (no third-party notation library): `layout.js` (the pure layout model — `buildLayoutModel`, all musical geometry in staff-space units, no DOM), `svg.js` (the thin SVG-emit layer that turns the model into an `<svg>` DOM tree), `glyphs.js` (the swappable glyph map: symbolic name → music-font codepoint or hand-drawn primitive), `constants.js` (the shared sp/layout constants), and the bundled music-font **asset** `pb-music.woff2` with its `OFL.txt` (a subsetted, renamed Bravura under SIL OFL 1.1). |
| `src/notation/__tests__/` | Jest unit tests for the pure layout/emit layers (`layout.test.js`, `svg.test.js`), run by `npm run test:unit`. |
| `src/song/normalizeStep.js` | The shared note-name helper — the closed two-system vocabulary and the `step → canonical English letter` map, reused by both the validator and the renderer so they cannot drift. |
| `src/song/schema.js` | The song format's declarative **schema-as-data** — the single source of truth for "what is a conformant song." |
| `src/song/validate.js` | The zero-dependency validator/walker that interprets `schema.js` and returns human-readable, path-pointed errors. |
| `src/song/__tests__/` | Jest unit tests for the schema and validator (run by `npm run test:unit`). |
| `specs/` | Playwright end-to-end tests — `editor.spec.js` (authoring + persistence) and `render.spec.js` (front-end SVG render across the three display states + injection safety), run by `npm run test:e2e`. |
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

**Additive growth (no `version` field).** New capabilities arrive as **new optional fields** on existing objects (`event` / `section` / `measure` / `handConfig` / `pitch`) — never a breaking change, never a `version` field. A song authored against today's format stays conformant after the format grows, because old songs simply omit the new fields. The deliberately out-of-scope list (articulations, ornaments, pedal, fingering, tuplets, voltas, multiple voices, lyrics, per-pitch ties, wider octave-shift, triple dots, …) is effectively the backlog of additive candidates.

**Render contract — a container carrying an inert JSON `<script>`.** `src/render.php` emits a block-wrapper `<div>` (the attributes from `get_block_wrapper_attributes()`) containing a single inert `<script type="application/json">` whose body is the **raw** stored `song` string; the frontend (`src/view.js`) reads that script's `textContent` and decides whether to draw. PHP performs **no** validation, parsing, or re-serialization — the render-or-nothing decision lives entirely on the front end — and it still outputs **nothing** when the song is empty or whitespace-only (no wrapper at all). Contributors must keep PHP's role purely "carry whatever is stored": adding `json_encode`/`json_decode` would re-escape, reorder, or fail on the author's literal text and would break non-JSON input.

The one transformation PHP does make is a **script-breakout escape**: it replaces every `<` in the song with the JSON unicode escape `\u003C` before printing it into the `<script>`. This is *not* `esc_html()`/`htmlspecialchars()` — and that distinction matters. A `<script>` element is **raw text**: the HTML parser does not decode HTML entities inside it, so `&lt;` would survive literally and break `JSON.parse` on the frontend. But the parser *does* still scan raw text for the `</` (ETAGO) and `<!--` sequences, so an unescaped `</script>` inside the song (e.g. in a `chordSymbol` or `metadata.title`) could close the carrier early. Escaping the leading `<` as `\u003C` neutralizes both breakout sequences at once while remaining a legal JSON escape, so `JSON.parse` decodes it back to the exact author bytes. (Plain `<\/` is avoided too: `<\!--` is invalid JSON and would throw on a conformant song.) The net effect is the same safety the old `<pre>` escaping gave — hostile markup stays inert — but the payload now round-trips losslessly into the renderer.

> **Exercising the renderer.** The [example song](docs/song-format.md#annotated-example-song) in the format reference is a broad-coverage example (it touches per-hand clefs, accidentals, a chord, a tie, dynamics, barlines, an octave shift, and a section change). Paste it into a published Piano block and view the post: the frontend reads it from the inert `<script>`, validates it, and draws the grand staff as an SVG.

**Tests.** Unit tests (run by `npm run test:unit`) cover two layers in pure Node. The validator suite (`src/song/__tests__/`) exercises a comprehensive example song, both note-name systems (case-insensitive), closed-enum / type / range errors, the lenient-on-unknown policy, and the structural-only stance (no musical-timing check). The renderer's pure layout/emit layers have their own suite (`src/notation/__tests__/`), so the musical geometry is verified without a browser. End-to-end tests (`specs/`, run by `npm run test:e2e` against `wp-env`) cover the editor (a fresh block is empty; conformant input shows no error; non-conformant input is flagged yet still stored; a song round-trips across save/reload — unchanged) and the front end across its three display states: a conformant song renders an `<svg role="img">` grand staff with an accessible name and the raw JSON is **not** shown; an empty/whitespace song renders nothing; a non-renderable song (invalid JSON or non-conformant) renders nothing — no raw echo, no error; and a conformant song carrying hostile free text renders that text inert (emitted via SVG `textContent`) while still drawing and parsing back to the exact author bytes.

## Forthcoming

Song *storage* and front-end **notation rendering** have landed, but the audible and richer interactive piano experience has not. The following are planned for future tasks and are **not** part of v1 (the "out of scope" set):

- **Audio playback** — the format retains the pitch, octave, duration, and tempo precision needed for future sound, but nothing plays yet.
- **A visual authoring UI** — anything beyond the single raw-JSON field; in v1 you write the song JSON by hand.
- **Richer notation elements** — articulations, ornaments, pedal, fingering, tuplets, voltas, multiple voices per hand, lyrics, and similar (the format grows by adding optional fields, with no `version` field).

This README will be updated as each capability lands.
