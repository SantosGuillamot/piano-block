# Piano Block

A WordPress block plugin for creating piano song sheets — the long-term goal is to write out notes and build practice sheets you can use to learn and train piano skills.

> **Status:** This repository is an installable WordPress plugin that registers a single **Piano** block. The block **stores a complete song** as structured JSON — a right-hand + left-hand grand staff in the plugin's own [song format](docs/song-format.md). In the editor you author that song through a **visual editing UI (the default)**: you **navigate and select** the song through a **structure tree** — a toggleable outline panel beside the canvas (Section → Measure → Right/Left hand → Note) — and adjust the selected node's settings in the **block settings sidebar**, while the **canvas is the live render with selection highlighting** (display + highlight only); **raw-JSON editing remains available** as an alternative. On the front end the block **renders that song as visual piano sheet music**: a braced grand staff drawn as an SVG by the plugin's own rendering code (no third-party notation library). It does **not** yet play audio; audio playback remains future work (see [Forthcoming](#forthcoming)). A build toolchain (`@wordpress/scripts`) and a local dev environment (`wp-env`) are in place to build on.

## What the block does today

The plugin registers exactly one block — **Piano** (`piano-block/piano`):

- It appears in the block inserter under the **Media** category (search for "Piano").
- In the editor, it presents a **visual editor by default** — you **navigate and select** the song through a **structure tree** (a toggleable outline panel beside the canvas, listing Section → Measure → Right/Left hand → Note) and edit the selected node's settings in the **block settings sidebar**; the **canvas is the live render with selection highlighting** (it re-renders live and highlights the selection, drawn with the same notation the front end uses, but clicking the staff does not select) — and it keeps **raw-JSON editing available** as an alternative behind a mode switch. Both modes edit the **same single song** in the plugin's own [song format](docs/song-format.md). The raw-JSON field's input is **validated for conformance**, but that check is **informational only — it never blocks saving**, and your raw text is always stored.
- It is a **dynamic** (server-rendered) block: the stored `song` string lives in the block's delimiter comment, and PHP emits a lightweight container carrying that song to the front end. On a published page, the block's own client-side code reads the song and draws it as **visual piano sheet music** — a braced grand staff — directly in the page (and nothing at all when there is no song).

There is no playable keyboard or audio yet, but a published page now shows the song as readable notation rather than as text, so the rest of the piano experience can be developed on top of it. See [Using the Piano block](#using-the-piano-block) for the authoring workflow.

## Using the Piano block

The Piano block stores one **song** — a JSON document in the plugin's own [song format](docs/song-format.md). You author that song with a **visual editor** (the default surface): you **navigate and select** the song through a **structure tree** — a toggleable outline panel beside the canvas (Section → Measure → Right/Left hand → Note) — where each section, measure, and note row's menu offers **Duplicate / Add before / Add after / Remove** ("Add measure" lives in the sidebar's Section panel and "Add section" in its Song panel), and configure the selected node in the **block settings sidebar**, while the **canvas is the live render with selection highlighting** (display + highlight only). If you prefer, you can switch to editing the **raw JSON** of the same song as text. Here is the end-to-end workflow.

### 1. Insert the block

In the editor, open the inserter and add the **Piano** block — it lives under the **Media** category (search for "Piano").

### 2. Build the song in the visual editor

The block opens to a **visual editor by default** — no JSON required. A **freshly inserted block** already shows an **empty grand staff** ready for notes (the editor seeds a minimal song behind the scenes), so there is **nothing to press first** — you start adding notes straight away.

**Browse and select with the structure tree.** A **structure tree** is **open by default** beside the canvas (to its left) whenever the block is selected; a **toolbar button (Structure)** **closes and reopens** it — it stays closed while you keep working and reopens on the next click. The tree lists the whole song hierarchically — **Section → Measure → Right hand / Left hand → Note** — with sections and measures **expandable and collapsible**, so you can drill from the song down to an individual note. **Selecting** a section, measure, or note row in the tree opens its settings in the **block settings sidebar**; selecting a **note** also **highlights** the matching note on the canvas, while selecting a **section or measure** opens its panel without highlighting anything on the canvas (a section/measure canvas indication is a later follow-up). The canvas reflects the selection but **clicking the staff does not select**. The **Right hand / Left hand** rows are **organizational** — they expand a measure's two event lists and host that hand's **Add note** button — so they have no settings panel of their own, and selecting one does not change the sidebar.

**Tree labels.** Sections and measures show their **name** when one is set, otherwise a positional label (**Section 1**, **Measure 1**). A **note** row shows its **pitch name** in the song's note-name language (e.g. `do` or `C`); a **chord** shows its pitches; a **rest** shows **rest**.

**Add, remove, and duplicate from the tree.** Every section, measure, and note row carries the **same per-row menu** (the **⋮** actions button): **Duplicate**, **Add before**, **Add after**, and **Remove**. **Add before** and **Add after** are how you **grow the song from the tree** — they insert a fresh section, measure, or note immediately **before or after** the chosen row and **select** the new node, so its settings open right away. **Adding a section** also lives in the **block settings sidebar** (the always-present **Song** panel, see below), and **adding a measure** lives in the **Section** panel (see below); the per-hand **Add note** button on each hand-group row is how you seed the first note of an otherwise empty measure. **Duplicate** makes a **deep copy inserted immediately after the original**: duplicating a section copies its measures, notes, and its name; a measure copies both hands and its name; a note copies its pitches and properties. **Reordering is not available** — the tree has no move controls.

**Configure the selection in the sidebar.** Selecting a tree row opens the matching settings panel in the **block settings sidebar**:

- A **Note** panel for a selected note — its type (note or rest) and duration, a note's chord **pitches**, and, behind a small *Advanced* disclosure, its **dots, dynamic, tie, slur, crescendo/decrescendo, and annotations**. It also offers **Add note** (in the same hand as the selection) and **Remove note**.
- A **Measure** panel for a selected measure — a **Name** field (see below) and, behind *Advanced*, its barlines and annotations.
- A **Section** panel for a selected section — a **Name** field (see below) and, behind *Advanced*, the section's overrides. It also offers an **Add measure** button (the way to add a measure to the section, including re-seeding one whose last measure was removed) and a convenience **Remove section**.

A **Song** panel is **always present** in the sidebar, whether or not anything is selected: it holds the song's **title and composer**, the song-wide musical **defaults** — tempo, time signature, and (behind *Advanced*) the beat unit and each hand's clef, accidentals, and octave shift — and the **Add section** control, so a section can be added even with nothing selected. When nothing is selected, the sidebar shows just this Song panel.

**Name a section or measure.** Sections and measures have an **editable, persisted name**, set in the **Name** field of their **Section** / **Measure** sidebar panel. The name you type shows in the structure tree in place of the positional label and **survives save/reload** and a raw-JSON round-trip; clearing the field restores the positional fallback. See [`name`](docs/song-format.md#name) in the format reference for the stored field.

**Progressive disclosure.** Each panel shows a small set of common settings up front and tucks the less-common ones behind an *Advanced* disclosure, so the sidebar stays shallow while still reaching the whole model.

Every control only lets you produce a **valid song**: each field offers the format's allowed values, and every tree operation, rename, and settings edit routes through the same re-validation guard, so the visual editor can't put the song into a non-conformant state. It does **not**, however, check musical *timing* — a bar's note durations need not add up to its time signature.

The canvas **re-renders live** as you edit and draws the song with the **same notation the published page uses** — it *is* the live render, highlighting the current selection, not a separate read-only preview.

**Note names** can be written in **English** (`C D E F G A B`) or **Spanish** (`do re mi fa sol la si`). The **Song** panel has a **Note language** selector (English / Spanish) that controls which system the whole song uses, and the editor's note-name controls follow it. Switching it **converts every note name** in the song to the chosen language — a Spanish song becomes English, or the reverse — and **stores** your choice in the song's [`language`](docs/song-format.md#language) field. An existing song that has no stored language **infers** its starting language from the note spellings it already uses (Spanish if it uses `do re mi…`, otherwise English), and a brand-new song defaults to **English**. The [song format reference](docs/song-format.md) covers the full vocabulary. (This README does not repeat the field-level detail; that document is the canonical source.)

**When a song can't be edited visually.** The visual editor needs a conformant song to work with:

- An **empty or whitespace-only** song is treated as "no song", so a brand-new block simply starts fresh on the seeded empty staff.
- A **non-empty but invalid** song (bad JSON, or valid JSON that doesn't conform to the format) **can't** be edited visually. The editor surfaces the problem and directs you to **fix it in raw JSON** (see the next step); once the song is valid again, visual editing resumes automatically.

### 3. Edit the raw JSON instead

A **mode switch** in the block toolbar flips the block to a **raw-JSON** field editing the **same song** — switching reflects whatever the song currently is. The field is a single multi-line text area on the block canvas:

- **Label:** *Song (JSON)*
- **Help text:** *The raw song document as JSON. Validation is informational and never blocks saving.*

Type or paste your song's JSON here. As you type, the editor **checks your input against the song format** and shows a clear error notice beneath the field when the content is not valid JSON or does not conform.

That validation is **informational only — it never blocks saving**. The raw text you typed is **always stored**, whether or not it conforms; the error notice is guidance, not a gate. A couple of details to keep in mind:

- **Empty input shows no error.** Validation runs only on non-empty input; a blank field is the "no song" state and is not validated.
- **It is structural / field checking only.** The validator checks the document's shape and field values, **not** musical timing. A bar whose events do not "add up" to its time signature still saves with no timing error.

For the full structure — every field, the allowed values, the two note-name systems, and a complete annotated example — see the [song format reference](docs/song-format.md).

### 4. What the front end shows

On the published page, the block **renders your song as visual piano sheet music** — a braced grand staff (a treble staff for the right hand and a bass staff for the left, joined by a brace), drawn as an SVG by the plugin's own client-side rendering code. There is **no third-party notation library**: the staves, clefs, notes, rests, and accidentals are drawn by the plugin itself, using a bundled music font for the ornate symbols.

What appears depends on what you stored — there are three cases:

- **A conformant song renders as sheet music.** If the stored song matches the [song format](docs/song-format.md), the front end parses it and draws the grand staff.
- **No song renders nothing.** A block with an empty (or whitespace-only) song outputs nothing at all.
- **A non-renderable song renders nothing.** If the stored content is not valid JSON, or is valid JSON that does not conform to the song format, the front end draws **nothing** — there is **no raw-JSON echo and no error message** shown on the page. (You catch and fix such problems while authoring: the visual editor surfaces them and routes you to raw JSON, where the validation notice points at what's wrong.)

The notation is drawn entirely in the browser by the block's own code, so it is the **front end** that decides whether to render or stay empty; the server does no validation. The score itself shows only the music — there is no visible title or composer heading (the song's `metadata` is used only to label the notation for assistive technology).

> **Tip:** The [annotated example song](docs/song-format.md#annotated-example-song) in the format reference is a ready-made starting template. Switch to raw-JSON mode, paste it into the field, view the published post, and you will see it rendered as a grand staff.

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
- **SCSS.** Styles are split across two stylesheets so editor-only CSS never ships to the front end. The front-end stylesheet carries only the `@font-face` declaration — `src/style.scss`, compiled to `build/style-index.css` and enqueued via the `style` handle; editor-only styles (the workspace layout, structure tree, canvas, and selection-highlight rules) live in `src/editor.scss`, compiled to `build/index.css` and enqueued via the `editorStyle` handle. (Biome does not process SCSS; the build's Sass step owns it.)
- **Biome for lint/format.** Biome (tab indentation, double-quoted JS) lints and formats the JavaScript/JSON sources in `src/`. The generated `build/` directory is git-ignored and therefore outside Biome's set; the PHP files sit outside Biome's processing set and are not linted by it.
- **`register_block_type()` targets `build/`.** `piano-block.php` registers the block from the `build/` directory, so you must run `npm run build` before the plugin will work.

### File layout

| Path | Role |
| --- | --- |
| `piano-block.php` | Main plugin file: the plugin header and the `init` hook that registers the block from `build/`. |
| `src/block.json` | Block metadata — identity (name, title, `media` category, icon), text domain, the `song` string attribute (`default: ""`), and the wiring to the editor script, a front-end stylesheet (`style`), an editor-only stylesheet (`editorStyle`), and the server render. |
| `src/index.js` | Editor entry point: registers the block and imports both stylesheets (the front-end / shared `style.scss` and the editor-only `editor.scss`). |
| `src/edit.js` | The block's editor component (JSX) — a **mode container** that shows the **left structure tree + display-only sheet-music canvas + a block settings sidebar (`InspectorControls`) of panels** by default and switches to a **raw-JSON** field (`TextareaControl` + non-blocking error `Notice`) in JSON mode. It owns the **`showTree` toggle and a single expansion `Set`** for the tree, and the **structural mutators** the tree and sidebar drive — remove and **duplicate** section, measure, and note, the six **positional inserts** (`Add before` / `Add after` at section, measure, and note, each splicing a fresh node beside the row and auto-selecting it), the per-hand **`onAddNote`**, the **`onAddSection`** the Song panel signals, and the **`onAddMeasure`** the **Section panel** signals (the tree menu no longer drives adding a measure), plus rename via the panels — so the tree and the sidebar share one mutation path. The mode toggle and the current **kind-tagged selection** (section / measure / event) are editor-only UI state; the canvas no longer produces selection. Both surfaces edit the same `song` string. |
| `src/editor/` | The **visual editor UI**: the **left structure tree** (`StructureTree`, built on `@wordpress/components`' `__experimentalTreeGrid`) — the toggleable Section → Measure → {Right hand, Left hand} → Note outline that is the **selection surface** and carries on each section/measure/note row the **Gutenberg block-menu set** (a `DropdownMenu` of **Duplicate / Add before / Add after / Remove**, with the positional inserts growing the song from the tree), keeps the per-hand "Add note" button on each hand-group row, and leaves "Add measure" to the Section panel and "Add section" to the Song panel — rendered in a **`__workspace`** flex layout beside the **sheet-music canvas** (`SongCanvas`, which reuses the notation core in `src/notation/` to draw the working song and is now **display + highlight only**: it decorates the selection's highlight but does **no** hit-testing or click-to-select). The right-sidebar **`StructureList` was removed** — the left tree supersedes it. Plus the **block settings sidebar panels** (`inspector/` — the always-present Song panel and the Note / Measure / Section panels for the current selection), the pure **selection helpers** (`selection.js`, resolving and locating a `kind`-tagged `(section, measure, hand, event)` selection), the invalid-state fallback, the shared inspector omit helpers (`omitEmpty` / `omitFalsy` in `emit.js`), and the reused leaf field-editors and per-song note-name / song-shape helpers (working object, serialize-time conformance guard); the accessible-name helper it shares now lives in `src/song/` (see below), not the editor layer. Built only on `@wordpress/*` packages; `@wordpress/icons` is a bundled `@wordpress/*` runtime dependency (icons are SVG elements from that package). |
| `src/editor/__tests__/` | Jest unit tests for the editor (the mode container, the canvas, the inspector panels, the selection helpers, and the leaf editors), run by `npm run test:unit`. |
| `src/style.scss` | Front-end styling — the `@font-face` declaration only; emitted to `build/style-index.css` and enqueued via `style`. |
| `src/editor.scss` | Editor-only styling — the workspace layout, structure tree, canvas, and selection highlight; emitted to `build/index.css` and enqueued via `editorStyle`, so none of it ships to the front end. |
| `src/render.php` | Server-rendered front-end output for the dynamic block — a block-wrapper `<div>` carrying the raw `song` inside an inert `application/json` `<script>` for the frontend to read (no validation, no `<pre>`). |
| `src/view.js` | The frontend `viewScript` entry: reads the inert JSON `<script>`, runs the reused validate gate, and (for a conformant song) builds the layout model and mounts the SVG, computes the accessible name, and reflows on resize. The thin, DOM-coupled half of the renderer. |
| `src/notation/` | The plugin's **own** rendering engine (no third-party notation library): `layout.js` (the pure layout model — `buildLayoutModel`, all musical geometry in staff-space units, no DOM), `svg.js` (the thin SVG-emit layer that turns the model into an `<svg>` DOM tree, with the front-end SVG **byte-identical** between the editor canvas and the published page), `dom.js` (the React-free shared width/font helpers — container-width → staff-space conversion and the music-font load gate — used by both `SongCanvas` and `view.js`), `glyphs.js` (the swappable glyph map: symbolic name → music-font codepoint or hand-drawn primitive), `constants.js` (the shared sp/layout constants), and the bundled music-font **asset** `pb-music.woff2` with its `OFL.txt` (a subsetted, renamed Bravura under SIL OFL 1.1). |
| `src/notation/__tests__/` | Jest unit tests for the pure layout/emit layers (`layout.test.js`, `svg.test.js`), run by `npm run test:unit`. |
| `src/song/accessibleName.js` | The shared accessible-name derivation — turns a song's `metadata` into the name announced for the rendered score, reused by both the editor (`SongCanvas`) and the front end (`view.js`) so both surfaces label the same song identically. |
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

**Schema-as-data + a purpose-built walker (no `ajv`).** Conformance is defined by a declarative schema object, [`src/song/schema.js`](src/song/schema.js) — the **single source of truth** for "what is a conformant song." It is pure data with no logic and is written to be read as documentation. A small, recursive, **zero-dependency** validator, `src/song/validate.js`, interprets it. This is a deliberate choice: the validator itself has no dependencies — adding a JSON-Schema library like `ajv` is avoided so the validator stays schema-as-data with no third-party logic; the walker interprets only the small JSON-Schema **subset** the format actually uses:

- `type`, `required`, `properties`, `items`, `enum`, `$ref`/`$defs`, integer `minimum`/`maximum`, one `if`/`then` (with a `const` discriminant), and **permissive** `additionalProperties`.

Three checks the keyword subset cannot express are handled directly by the walker, keyed off the schema's own `$defs` names so they stay tied to the single source of truth: the **note-name vocabulary** (`pitch.step` and `alters` keys, matched case-insensitively against English `C D E F G A B` + Spanish `do re mi fa sol la si`); the **`alters` map** (every key a recognised note name, every value an integer in −2..+2); and the strict lower bound **`tempo.bpm` > 0**. The validator's single entry point, `validateSong(rawString)`, parses the raw string (a parse failure *is* a conformance error) and returns a list of human-readable, path-pointed messages — `[]` when the song conforms. Editor-side validation is **informational only** and never blocks saving (see [Using the Piano block](#using-the-piano-block)).

> **Recorded swap trigger:** if the format ever outgrows the hand-rolled walker (many conditionals, cross-references), adopting `ajv` consuming the *same* `schema.js` is a localized change — the schema is already the source of truth.

**Conformance policy — lenient on unknown, closed on enumerated.** When extending the format, preserve this rule:

- **Unknown object properties are ignored, not errors** (`additionalProperties` is permissive everywhere). This keeps the format forward-compatible: an *older* validator must not hard-fail a song that uses a field from a *future* version of the format — which matters precisely because there is **no `version` field** to gate on.
- **Enumerated values are closed.** The value enums (durations, clefs, dynamics, barlines, tie/slur, crescendo/decrescendo, `type`, `beatType`) are the format's fixed vocabulary, not extension points; a typo like `"quaver"` for a duration **is** a conformance error.
- **Accepted trade-off:** a misspelled *optional* property (e.g. `dynmic` for `dynamic`) is silently ignored rather than flagged — an accepted cost of the permissive, never-blocking v1 stance.

**Additive growth (no `version` field).** New capabilities arrive as **new optional fields** on existing objects (`event` / `section` / `measure` / `handConfig` / `pitch`) — never a breaking change, never a `version` field. The gradual-dynamic `crescendo` / `decrescendo` markers on `event` are a worked example of this pattern: they landed as two more optional fields, so a song authored before they existed stays conformant unchanged (it simply omits them). The latest additions are the top-level optional `language` field (the note-name system the song is written in) and the optional `name` field on sections and measures (an editor-side label the structure tree shows) — additive in the same way: absent is valid, each is stored and round-trips, and the front end does not read either. A song authored against today's format stays conformant after the format grows for the same reason. The deliberately out-of-scope list (articulations, ornaments, pedal, fingering, tuplets, voltas, multiple voices, lyrics, per-pitch ties, wider octave-shift, triple dots, …) is effectively the backlog of additive candidates.

**Render contract — a container carrying an inert JSON `<script>`.** `src/render.php` emits a block-wrapper `<div>` (the attributes from `get_block_wrapper_attributes()`) containing a single inert `<script type="application/json">` whose body is the **raw** stored `song` string; the frontend (`src/view.js`) reads that script's `textContent` and decides whether to draw. PHP performs **no** validation, parsing, or re-serialization — the render-or-nothing decision lives entirely on the front end — and it still outputs **nothing** when the song is empty or whitespace-only (no wrapper at all). Contributors must keep PHP's role purely "carry whatever is stored": adding `json_encode`/`json_decode` would re-escape, reorder, or fail on the author's literal text and would break non-JSON input.

The one transformation PHP does make is a **script-breakout escape**: it replaces every `<` in the song with the JSON unicode escape `\u003C` before printing it into the `<script>`. This is *not* `esc_html()`/`htmlspecialchars()` — and that distinction matters. A `<script>` element is **raw text**: the HTML parser does not decode HTML entities inside it, so `&lt;` would survive literally and break `JSON.parse` on the frontend. But the parser *does* still scan raw text for the `</` (ETAGO) and `<!--` sequences, so an unescaped `</script>` inside the song (e.g. in an `annotation`'s `text` or `metadata.title`) could close the carrier early. Escaping the leading `<` as `\u003C` neutralizes both breakout sequences at once while remaining a legal JSON escape, so `JSON.parse` decodes it back to the exact author bytes. (Plain `<\/` is avoided too: `<\!--` is invalid JSON and would throw on a conformant song.) The net effect is the same safety the old `<pre>` escaping gave — hostile markup stays inert — but the payload now round-trips losslessly into the renderer.

> **Exercising the renderer.** The [example song](docs/song-format.md#annotated-example-song) in the format reference is a broad-coverage example (it touches per-hand clefs, accidentals, a chord, a tie, dynamics, a crescendo and a decrescendo meeting on a messa-di-voce hinge, barlines, an octave shift, and a section change). Paste it into a published Piano block and view the post: the frontend reads it from the inert `<script>`, validates it, and draws the grand staff as an SVG.

**Tests.** Unit tests (run by `npm run test:unit`) cover two layers in pure Node. The validator suite (`src/song/__tests__/`) exercises a comprehensive example song, both note-name systems (case-insensitive), closed-enum / type / range errors, the lenient-on-unknown policy, and the structural-only stance (no musical-timing check). The renderer's pure layout/emit layers have their own suite (`src/notation/__tests__/`), so the musical geometry is verified without a browser, with the front-end SVG emit pinned **byte-identical** between the editor canvas and the published page. End-to-end tests (`specs/`, run by `npm run test:e2e` against `wp-env`) cover the editor (a fresh block is empty; conformant input shows no error; non-conformant input is flagged yet still stored; a song round-trips across save/reload — unchanged; selection now flows through the **structure tree** — toggling it open and selecting tree rows — with tree-driven remove/**duplicate**/rename of sections and measures, the row menu's **positional inserts** ("Add before"/"Add after", asserted to splice at the right index and auto-select the new node), measure-growing exercised through the **Section** panel's "Add measure" button and section-adding through the sidebar **Song** panel — an assertion that **clicking the canvas does not select**, and the Note-language conversion) and the front end across its three display states: a conformant song renders an `<svg role="img">` grand staff with an accessible name and the raw JSON is **not** shown; an empty/whitespace song renders nothing; a non-renderable song (invalid JSON or non-conformant) renders nothing — no raw echo, no error; and a conformant song carrying hostile free text renders that text inert (emitted via SVG `textContent`) while still drawing and parsing back to the exact author bytes.

## Forthcoming

Song *storage*, **visual authoring**, and front-end **notation rendering** have landed, but the audible and richer interactive piano experience has not. Authoring now happens through a **structure tree** beside the canvas — you navigate and select the song there and adjust the selected node's settings in the **block settings sidebar**, while the **canvas is the live render with selection highlighting** (raw-JSON editing stays available as an alternative — see [Using the Piano block](#using-the-piano-block)). The rendered notation already covers a broad spread of markings, including **gradual dynamics** — crescendo and decrescendo hairpins drawn as `<` / `>` wedges (see the [song format reference](docs/song-format.md) for the fields and their v1 limits). The following are planned for future tasks and are **not** part of v1 (the "out of scope" set):

- **Audio playback** — the format retains the pitch, octave, duration, and tempo precision needed for future sound, but nothing plays yet. Every marking the block draws — dynamics and the new gradual-dynamic hairpins included — is **notation only** and has **no sonic effect**; there is no audio engine.
- **Richer notation elements** — articulations, ornaments, pedal, fingering, tuplets, voltas, multiple voices per hand, lyrics, and similar (the format grows by adding optional fields, with no `version` field).

This README will be updated as each capability lands.
