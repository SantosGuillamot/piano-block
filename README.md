# Piano Block

A WordPress block plugin for creating piano song sheets — the long-term goal is to write out notes and build practice sheets you can use to learn and train piano skills.

> **Status:** This repository is an installable WordPress plugin that registers a single **Piano** block. The block **stores a complete song** as structured JSON — a right-hand + left-hand grand staff in the plugin's own [song format](docs/song-format.md). In the editor you author that song through a **visual editing UI (the default)**: you **navigate and select** the song through a **structure tree** — a toggleable outline panel beside the canvas (Section → Measure → Right/Left hand → Note) — and adjust the selected node's settings in the **block settings sidebar**, while the **canvas is the live render with selection highlighting** (display + highlight only); **raw-JSON editing remains available** as an alternative. On the front end the block **renders that song as visual piano sheet music**: a braced grand staff drawn as an SVG by the plugin's own rendering code (no third-party notation library), now with a **viewer control that shows or hides the note names** on the score. It does **not** yet play audio; audio playback remains future work (see [Forthcoming](#forthcoming)). A build toolchain (`@wordpress/scripts`) and a local dev environment (`wp-env`) are in place to build on.

## What the block does today

The plugin registers exactly one block — **Piano** (`piano-block/piano`):

- It appears in the block inserter under the **Media** category (search for "Piano").
- In the editor, it presents a **visual editor by default** — you **navigate and select** the song through a **structure tree** (a toggleable outline panel beside the canvas, listing Section → Measure → Right/Left hand → Note) and edit the selected node's settings in the **block settings sidebar**; the **canvas is the live render with selection highlighting** (it re-renders live and highlights the selection, drawn with the same notation the front end uses, but clicking the staff does not select) — and it keeps **raw-JSON editing available** as an alternative behind a mode switch. Both modes edit the **same single song** in the plugin's own [song format](docs/song-format.md). The raw-JSON field's input is **validated for conformance**, but that check is **informational only — it never blocks saving**, and your raw text is always stored.
- It is an **interactive block**, still **dynamic** (server-rendered): the stored `song` string lives in the block's delimiter comment, and on the server each block instance seeds its own song into its **per-instance context**. On a published page, the **WordPress Interactivity API** hydrates each block and draws its song as **visual piano sheet music** — a braced grand staff — directly in the page (and nothing at all when there is no song), and it now also offers a **viewer-facing control to show or hide the note names** on that score.

There is no playable keyboard or audio yet, but a published page now shows the song as readable notation rather than as text — and gives the viewer a first interactive control over how that notation is read (showing or hiding the note names) — so the rest of the piano experience can be developed on top of it. See [Using the Piano block](#using-the-piano-block) for the authoring workflow.

## Using the Piano block

The Piano block stores one **song** — a JSON document in the plugin's own [song format](docs/song-format.md). You author that song with a **visual editor** (the default surface): you **navigate and select** the song through a **structure tree** — a toggleable outline panel beside the canvas (Section → Measure → Right/Left hand → Note) — where each section, measure, and note row's menu offers **Duplicate / Add before / Add after / Remove**, and section and measure rows additionally offer **Rename** ("Add measure" lives in the sidebar's Section panel and "Add section" in its Song panel), and configure the selected node in the **block settings sidebar**, while the **canvas is the live render with selection highlighting** (display + highlight only). If you prefer, you can switch to editing the **raw JSON** of the same song as text. Here is the end-to-end workflow.

### 1. Insert the block

In the editor, open the inserter and add the **Piano** block — it lives under the **Media** category (search for "Piano").

### 2. Build the song in the visual editor

The block opens to a **visual editor by default** — no JSON required. A **freshly inserted block** already shows an **empty grand staff** ready for notes (the editor seeds a minimal song behind the scenes), so there is **nothing to press first** — you start adding notes straight away. The block also opens with the **first section and its first measure already expanded** in the structure tree, so that measure's **Right hand / Left hand** rows — and the **Add note** button on each of them — are reachable immediately, with no chevron to expand first. Only that first section and first measure start open (the hand rows themselves are not auto-expanded, but their **Add note** button sits on the hand row, visible as soon as the measure is open).

**Browse and select with the structure tree.** A **structure tree** is **open by default** beside the canvas (to its left) whenever the block is selected; a **toolbar button (Structure)** **closes and reopens** it — it stays closed while you keep working and reopens on the next click. The tree lists the whole song hierarchically — **Section → Measure → Right hand / Left hand → Note** — with sections and measures **expandable and collapsible**, so you can drill from the song down to an individual note. **Selecting** a section, measure, or note row in the tree opens its settings in the **block settings sidebar**; clicking a section or measure label always **selects** the row and **flips** its expansion, so a single click both opens the panel and toggles the contents — a **collapsed** label selects the row and **reveals** (expands) its children, while an already-**expanded** label selects the row and **collapses** it (the row's chevron remains an additional way to expand and collapse). Selecting a **note** also **highlights** the matching note on the canvas, while selecting a **section or measure** opens its panel without highlighting anything on the canvas (a section/measure canvas indication is a later follow-up). The canvas reflects the selection but **clicking the staff does not select**. The **Right hand / Left hand** rows are **organizational** — they expand a measure's two event lists and host that hand's **Add note** button — so they have no settings panel of their own, and clicking one only toggles its expansion (it never changes the sidebar). **Note** rows are leaves: clicking one selects it and has nothing to expand.

**Tree labels.** Sections and measures show their **name** when one is set, otherwise a positional label (**Section 1**, **Measure 1**). A **note** row shows its **pitch name** in the song's note-name language (e.g. `do` or `C`); a **chord** shows its pitches; a **rest** shows **rest**.

**Add, remove, and duplicate from the tree.** Every section, measure, and note row carries the **same per-row menu** (the **⋮** actions button): **Duplicate**, **Add before**, **Add after**, and **Remove**; **section and measure rows also offer Rename** (note rows do not, having no name). **Rename** simply **selects the row** so its sidebar panel opens — that panel's **Name** field is where you retype the name (it is the shortcut to the Name field, not an inline editor in the tree). **Add before** and **Add after** are how you **grow the song from the tree** — they insert a fresh section, measure, or note immediately **before or after** the chosen row and **select** the new node, so its settings open right away. **Remove** happens **immediately** at every row level (no prompt): removing a **section** discards the whole section — all of its measures and their notes — in one step, while removing a **measure** or a **note** drops just that row; and, like every edit, any removal — a section included — can be reversed with the editor's normal **undo**. **Adding a section** also lives in the **block settings sidebar** (the always-present **Song** panel, see below), and **adding a measure** lives in the **Section** panel (see below); the per-hand **Add note** button on each hand-group row is how you seed the first note of an otherwise empty measure. **Duplicate** makes a **deep copy inserted immediately after the original**: duplicating a section copies its measures, notes, and its name; a measure copies both hands and its name; a note copies its pitches and properties. **Reordering is not available** — the tree has no move controls.

**Configure the selection in the sidebar.** Selecting a tree row opens the matching settings panel in the **block settings sidebar**:

- A **Note** panel for a selected note — its type (note or rest) and duration, a note's chord **pitches**, and, behind a small **Note details** disclosure, its **dots, dynamic, tie, slur, crescendo/decrescendo, and annotations**. It also offers **Add note** (in the same hand as the selection) and **Remove note**.
- A **Measure** panel for a selected measure — a **Name** field (see below) and, behind **Barlines & annotations**, its barlines and standalone annotations.
- A **Section** panel for a selected section — a **Name** field (see below) and, behind **Section overrides**, the section's overrides. It also offers an **Add measure** button (the way to add a measure to the section, including re-seeding one whose last measure was removed) and a convenience **Remove section** that, like the tree's section "Remove", discards the section and everything in it **directly** (no prompt), recoverable with the editor's normal **undo**.

A **Song** panel is **always present** in the sidebar, whether or not anything is selected: it holds the song's **title and composer**, the song-wide musical **defaults** — tempo, time signature, and (behind **Tempo & staves**) the beat unit and each hand's clef, accidentals, and octave shift — and the **Add section** control, so a section can be added even with nothing selected. When nothing is selected, the sidebar shows just this Song panel.

**Name a section or measure.** Sections and measures have an **editable, persisted name**, set in the **Name** field of their **Section** / **Measure** sidebar panel. The name you type shows in the structure tree in place of the positional label and **survives save/reload** and a raw-JSON round-trip; clearing the field restores the positional fallback. See [`name`](docs/song-format.md#name) in the format reference for the stored field.

**Progressive disclosure.** Each panel shows a small set of common settings up front and tucks the less-common ones behind a small disclosure named for what it holds (**Note details**, **Barlines & annotations**, **Section overrides**, **Tempo & staves**), so the sidebar stays shallow while still reaching the whole model.

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

The notation is drawn entirely in the browser by the block's own code once the Interactivity API hydrates the block, so it is the **front end** that decides whether to render or stay empty; the server does no validation. The score itself shows only the music — there is no visible title or composer heading (the song's `metadata` is used only to label the notation for assistive technology, a name the server computes and passes to the page).

**Show or hide the note names.** A block that draws named notes also shows a **viewer control** alongside its score. Activating it **reveals a pitch name on each named note**; activating it again **hides them**, restoring the plain score. The names start **hidden** — the score loads exactly as it does without the control, and the viewer chooses to reveal them. A few things to know:

- **What a name is.** Each name is a **bare** pitch letter or syllable in the song's own note-name system — the same English / Spanish systems the editor uses (see the [song format reference](docs/song-format.md)). It carries **no accidental** (a C-sharp note simply reads `C`, or `do` in a Spanish song — the accidental still shows as its usual glyph beside the notehead) and **no octave number**. Both hands are named, and every notehead of a chord gets its own name; rests get none.
- **The system follows the song, not the viewer.** The control only shows or hides names; it never lets the viewer switch between English and Spanish. Which system the names appear in is a property of the song itself.
- **It is per block, and it does not stick.** Each Piano block on a page has its **own** control and its own on/off state — toggling one block's names never touches another's. The choice is **not remembered**: reload the page (or open it again) and the names start hidden once more.
- **It is accessible and translatable.** The control **communicates its current on/off state to assistive technology**, so a screen-reader user can tell whether the names are showing. Its **label is a translatable string** under the plugin's `piano-block` text domain — the same way the block already supplies translated text to the front end (such as the score's accessible name) — so a localized site presents the control in its own language.

**When the control appears.** The control is shown only when the block actually **draws nameable notes** — it is tied to the score being drawn and there being something to name:

- A song that **renders nothing** shows **no control**. An empty or whitespace-only song draws no score at all (see above), so there is no control; an invalid or non-conformant song likewise draws nothing and shows no control.
- A **conformant song with nothing to name** — for example one made up only of **rests** — renders its score **without the control**, because rests get no name.

In short, you only ever see the control on a score that has at least one named-or-nameable note to reveal.

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

Because the block is compiled, the installable plugin is the repository **plus its generated `build/` output** (which is git-ignored). There are two ways to get an installable copy onto a site.

### Recommended: package a zip with `npm run plugin-zip`

```bash
npm install && npm run plugin-zip
```

This produces **`piano-block.zip`** at the repository root — a ready-to-install archive with a single top-level `piano-block/` folder that a WordPress 6.9+ / PHP 7.4+ site can take directly via **Plugins → Add New Plugin → Upload Plugin**. (The script name is `plugin-zip`, the WordPress `create-block` community-standard name for this step, which is why it isn't `build:zip`.)

The command **builds the block fresh first, then archives.** If that build is missing or incomplete it **aborts with a non-zero exit and writes no zip**, so the archive can never silently ship without the block.

The archive carries only the **runtime payload** a site needs: the main plugin file (`piano-block.php`), the generated `build/` directory, and `README.md` (plus a `languages/` folder if one is ever added). Everything else — the `src/` sources, dependencies, build/lint config, tests, and all project tooling — is **left out by default**: inclusion is an allowlist of the standard WordPress plugin layout, so anything new that lands under `build/` is picked up automatically with no change here, while unrelated files stay out without anyone having to exclude them. Re-running the command cleanly overwrites any existing `piano-block.zip`. The artifact is git-ignored so it is never committed (see the [Scripts](#scripts) entry).

### Manual: build and copy the plugin directory

```bash
npm install && npm run build
```

Then copy the plugin directory — **including the generated `build/` folder** — into `wp-content/plugins/` (for example as `wp-content/plugins/piano-block/`) of a WordPress 6.9+ / PHP 7.4+ site, and activate **Piano Block** under **Plugins**. A successful install: the plugin activates with no error, the **Piano** block appears in the inserter under **Media**, and a published post containing a block with a conformant song renders that song as a grand staff of sheet music on the front end.

## For contributors

The block is built with [`@wordpress/scripts`](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-scripts/) (webpack + Babel), authored in `src/` and compiled to `build/`. [Biome](https://biomejs.dev/) remains the linter/formatter — `@wordpress/scripts` is used only for building and for `wp-env`, not for linting.

### The build model

- **JSX + ES modules.** `src/` is authored with JSX and `import`s from the `@wordpress/*` packages; the editor bundle (`index.js`) builds as a **classic script** — the build transpiles the JSX and externalises those imports to WordPress's runtime script handles, generating `build/index.asset.php` (the script's dependencies and version) automatically.
- **The front-end view builds as a script module.** The front end is a separate, smaller bundle: `src/view.js`, declared in `block.json` as **`viewScriptModule`** (the **view module**), is built as a real ES **script module** rather than a classic script. Its generated `build/view.asset.php` is a module asset whose only dependency is the script-module id **`@wordpress/interactivity`** — a module id, not a classic `wp-` script handle — and WordPress provides that module at runtime (it is not a `package.json` dependency). On this toolchain (`@wordpress/scripts` 32.3.0) webpack's module pass is **opt-in**, so `npm run build` and `npm run start` pass **`--experimental-modules`** (equivalently `WP_EXPERIMENTAL_MODULES=true`). Without that flag the module pass reports "No entry file discovered", `view.js` is not built, and nothing hydrates on the front end.
- **SCSS.** Styles are split across two stylesheets so editor-only CSS never ships to the front end. The front-end stylesheet carries only the `@font-face` declaration — `src/style.scss`, compiled to `build/style-index.css` and enqueued via the `style` handle; editor-only styles (the workspace layout, structure tree, canvas, and selection-highlight rules) live in `src/editor.scss`, compiled to `build/index.css` and enqueued via the `editorStyle` handle. (Biome does not process SCSS; the build's Sass step owns it.)
- **Biome for lint/format.** Biome (tab indentation, double-quoted JS) lints and formats the JavaScript/JSON sources in `src/`. The generated `build/` directory is git-ignored and therefore outside Biome's set; the PHP files sit outside Biome's processing set and are not linted by it.
- **`register_block_type()` targets `build/`.** `piano-block.php` registers the block from the `build/` directory, so you must run `npm run build` before the plugin will work.

### Packaging a release

`npm run plugin-zip` runs three stages joined so that any failure aborts the rest:

1. It reuses the repo's `npm run build` — the **single source of truth** for how the plugin builds. Packaging does **not** re-implement the build; it just runs it first so the archive is always made from a fresh `build/`.
2. It runs the committed guard `scripts/check-build.js`, which asserts the build actually produced the block before anything is archived.
3. It invokes `@wordpress/scripts`' built-in `plugin-zip` archiver, which selects files by the standard WordPress plugin-layout **allowlist** — so exclusion is the default, and any new file that lands under `build/` is captured automatically with no change here.

**Why the guard checks `build/block.json` specifically.** `block.json` is the keystone WordPress loads to register the block, so its absence means there is effectively no block to ship. The build keeps `build/fonts/` across rebuilds, so a partial build can leave the fonts on disk with no `block.json` — a naive "is `build/` non-empty?" check would wrongly pass that. The guard exists to reject exactly that case, so the archive can never silently ship without the block.

Two constraints keep the packaging correct; do not break either when changing the tooling.

- **Do not add a `files` field to `package.json`.** The archiver uses the safe WordPress plugin-layout allowlist **only while `package.json` has no `files` field**. Adding one silently switches it to npm's `files`-driven selection mode and would change — and most likely break — what the zip contains. The correct file set is the safe-by-omission default; keep it that way.
- **Run `wp-scripts plugin-zip` bare, from the repo root.** No flags. Running it from the repo root is what lands `piano-block.zip` at the root and produces the single top-level `piano-block/` folder inside it. Do not add flags or change the working directory.

### File layout

| Path | Role |
| --- | --- |
| `piano-block.php` | Main plugin file: the plugin header and the `init` hook that registers the block from `build/`. |
| `src/block.json` | Block metadata — identity (name, title, `media` category, icon), text domain, the `song` string attribute (`default: ""`), and the wiring that registers it as an **interactive block**: `supports.interactivity`, the editor script, a **`viewScriptModule`** (the front-end **view module**), a front-end stylesheet (`style`), an editor-only stylesheet (`editorStyle`), and the server render. |
| `src/index.js` | Editor entry point: registers the block and imports both stylesheets (the front-end / shared `style.scss` and the editor-only `editor.scss`). |
| `src/edit.js` | The block's editor component (JSX) — a **mode container** that shows the **left structure tree + display-only sheet-music canvas + a block settings sidebar (`InspectorControls`) of panels** by default and switches to a **raw-JSON** field (`TextareaControl` + non-blocking error `Notice`) in JSON mode. It owns the **`showTree` toggle and a single expansion `Set`** for the tree, and the **structural mutators** the tree and sidebar drive — remove and **duplicate** section, measure, and note, the six **positional inserts** (`Add before` / `Add after` at section, measure, and note, each splicing a fresh node beside the row and auto-selecting it), the per-hand **`onAddNote`**, the **`onAddSection`** the Song panel signals, and the **`onAddMeasure`** the **Section panel** signals (the tree menu no longer drives adding a measure), plus rename via the panels — so the tree and the sidebar share one mutation path. The mode toggle and the current **kind-tagged selection** (section / measure / event) are editor-only UI state; the canvas no longer produces selection. Both surfaces edit the same `song` string. |
| `src/editor/` | The **visual editor UI**: the **left structure tree** (`StructureTree`, built on `@wordpress/components`' `__experimentalTreeGrid`) — the toggleable Section → Measure → {Right hand, Left hand} → Note outline that is the **selection surface** and carries on each section/measure/note row the **Gutenberg block-menu set** (a `DropdownMenu` of **Duplicate / Add before / Add after / Remove**, plus a **Rename** item on section/measure rows only — it selects the row to reveal its Name field — with the positional inserts growing the song from the tree), keeps the per-hand "Add note" button on each hand-group row, and leaves "Add measure" to the Section panel and "Add section" to the Song panel — rendered in a **`__workspace`** flex layout beside the **sheet-music canvas** (`SongCanvas`, which reuses the notation core in `src/notation/` to draw the working song and is now **display + highlight only**: it decorates the selection's highlight but does **no** hit-testing or click-to-select). The right-sidebar **`StructureList` was removed** — the left tree supersedes it. Plus the **block settings sidebar panels** (`inspector/` — the always-present Song panel and the Note / Measure / Section panels for the current selection), the pure **selection helpers** (`selection.js`, resolving and locating a `kind`-tagged `(section, measure, hand, event)` selection), the invalid-state fallback, the shared inspector omit helpers (`omitEmpty` / `omitFalsy` in `emit.js`), and the reused leaf field-editors and per-song note-name / song-shape helpers (working object, serialize-time conformance guard); the accessible-name helper it shares now lives in `src/song/` (see below), not the editor layer. Built only on `@wordpress/*` packages; `@wordpress/icons` is a bundled `@wordpress/*` runtime dependency (icons are SVG elements from that package). |
| `src/editor/__tests__/` | Jest unit tests for the editor (the mode container, the canvas, the inspector panels, the selection helpers, and the leaf editors), run by `npm run test:unit`. |
| `src/style.scss` | Front-end styling — the `@font-face` declaration only; emitted to `build/style-index.css` and enqueued via `style`. |
| `src/editor.scss` | Editor-only styling — the workspace layout, structure tree, canvas, and selection highlight; emitted to `build/index.css` and enqueued via `editorStyle`, so none of it ships to the front end. |
| `src/render.php` | Server-rendered front-end output for the dynamic block — a `data-wp-interactive` wrapper that now also **server-renders the viewer toggle and an inner score container**: it emits an SSR `<button>` toggle (server-rendered hidden, revealed client-side) and an inner score `<div>` the view module draws into. It seeds the raw `song`, the **server-computed accessible name**, and the **additional per-instance toggle context** (names default-off, the translatable toggle label, the client-set gating flag, a width/redraw signal) into `data-wp-context`, and wires the store's boot and the redraw watch. Still **no validation, no parsing-to-gate, no `<pre>`** — the only decode reads `metadata` for the accessible name. |
| `src/view.js` | The front-end **view module** that registers the `store('piano-block/piano')`, and now also **owns the viewer toggle**. Its boot callback reads the song and the server-computed accessible name **from per-instance context** (the front end no longer computes the name) and the container from `getElement().ref`, runs the reused validate gate once (caching the parsed song per instance), builds the layout model, and mounts the SVG (the authorised imperative carve-out). It owns a **per-instance toggle state** and a **single redraw path** that responds to **both the toggle and resize**, and the **client-side gating** that reveals the toggle only when the song has nameable notes. The thin, DOM-coupled half of the renderer; it imports only `@wordpress/interactivity` plus the relative notation/song modules. |
| `src/notation/` | The plugin's **own** rendering engine (no third-party notation library): `layout.js` (the pure layout model — all musical geometry in staff-space units, no DOM — which can now carry a **per-note name** on each notehead when names are on), `svg.js` (the thin SVG-emit layer that turns the model into an `<svg>` DOM tree and can now **emit an inert per-note name** beside each notehead; the front-end SVG stays **byte-identical between the editor canvas and the published page when names are off — the default**), `dom.js` (the React-free shared width/font helpers — container-width → staff-space conversion and the music-font load gate — used by both `SongCanvas` and `view.js`), `glyphs.js` (the swappable glyph map: symbolic name → music-font codepoint or hand-drawn primitive), `constants.js` (the shared sp/layout constants), and the bundled music-font **asset** `pb-music.woff2` with its `OFL.txt` (a subsetted, renamed Bravura under SIL OFL 1.1). |
| `src/notation/__tests__/` | Jest unit tests for the pure layout/emit layers (`layout.test.js`, `svg.test.js`), run by `npm run test:unit`. |
| `src/song/accessibleName.js` | The shared accessible-name derivation — turns a song's `metadata` into the name announced for the rendered score. Used by the **editor** (`SongCanvas`), and it is the **JS authority the `render.php` PHP helper mirrors** for the front end (which now reads the name from context, computed in PHP) so every surface labels the same song identically. |
| `src/song/normalizeStep.js` | The shared note-name helper — the closed two-system vocabulary and the `step → canonical English letter` map, reused by both the validator and the renderer so they cannot drift. |
| `src/song/noteNameSystem.js` | The single source of the per-system **note-name vocabulary** — the two ordered seven-name systems (English letters / Spanish solfège), inferring which system a song is written in, and resolving a stored `step` into a system's spelling. Consumed by **both the editor** (the `src/editor/` note-name helper) **and the renderer** (the view module's redraw), so the names the frontend draws equal the editor's names by construction. Frontend-safe (no `@wordpress/*` runtime). |
| `src/song/schema.js` | The song format's declarative **schema-as-data** — the single source of truth for "what is a conformant song." |
| `src/song/validate.js` | The zero-dependency validator/walker that interprets `schema.js` and returns human-readable, path-pointed errors. |
| `src/song/__tests__/` | Jest unit tests for the schema and validator (run by `npm run test:unit`). |
| `specs/` | Playwright end-to-end tests — `editor.spec.js` (authoring + persistence) and `render.spec.js` (front-end SVG render across the three display states + injection safety), run by `npm run test:e2e`. |
| `build/` | Compiled output (generated by `npm run build`; git-ignored). |
| `scripts/check-build.js` | The build-payload guard run before archiving (stage 2 of `npm run plugin-zip`): asserts `build/block.json` exists, so the zip can never ship without the block. `scripts/` sits outside the plugin payload, so it is automatically excluded from the zip. |
| `.wp-env.json` | Local `wp-env` configuration (latest WordPress, PHP 8.3, this plugin mapped in). |

### Scripts

- `npm run build` — compile `src/` → `build/` (production build). Carries `--experimental-modules` so the front-end view module is built alongside the classic editor bundle.
- `npm run plugin-zip` — build the block, then package the installable `piano-block.zip` at the repository root (the generated zip is git-ignored).
- `npm run start` — compile and watch `src/` for changes (development). Also carries `--experimental-modules` so the view module is rebuilt on change.
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

Three checks the keyword subset cannot express are handled directly by the walker, keyed off the schema's own `$defs` names so they stay tied to the single source of truth: the **note-name vocabulary** (`pitch.step` and `alters` keys, matched case-insensitively against English `C D E F G A B` + Spanish `do re mi fa sol la si`); the **`alters` map** (every key a recognised note name, every value an integer in −2..+2); and the strict lower bound **`tempo.bpm` > 0**. The validator's default entry point, `validateSong(rawString)`, parses the raw string (a parse failure *is* a conformance error) and returns a list of human-readable, path-pointed messages — `[]` when the song conforms. `validate.js` also exports a named `parseAndValidate(rawString)` that parses **once** and returns both the parsed object and those errors as `{ data, errors }` (`validateSong` is the thin wrapper over its `errors`); the visual editor uses it to derive the working object and the conformance errors from a single parse instead of parsing twice. Editor-side validation is **informational only** and never blocks saving (see [Using the Piano block](#using-the-piano-block)).

> **Recorded swap trigger:** if the format ever outgrows the hand-rolled walker (many conditionals, cross-references), adopting `ajv` consuming the *same* `schema.js` is a localized change — the schema is already the source of truth.

**Conformance policy — lenient on unknown, closed on enumerated.** When extending the format, preserve this rule:

- **Unknown object properties are ignored, not errors** (`additionalProperties` is permissive everywhere). This keeps the format forward-compatible: an *older* validator must not hard-fail a song that uses a field from a *future* version of the format — which matters precisely because there is **no `version` field** to gate on.
- **Enumerated values are closed.** The value enums (durations, clefs, dynamics, barlines, tie/slur, crescendo/decrescendo, `type`, `beatType`) are the format's fixed vocabulary, not extension points; a typo like `"quaver"` for a duration **is** a conformance error.
- **Accepted trade-off:** a misspelled *optional* property (e.g. `dynmic` for `dynamic`) is silently ignored rather than flagged — an accepted cost of the permissive, never-blocking v1 stance.

**Additive growth (no `version` field).** New capabilities arrive as **new optional fields** on existing objects (`event` / `section` / `measure` / `handConfig` / `pitch`) — never a breaking change, never a `version` field. The gradual-dynamic `crescendo` / `decrescendo` markers on `event` are a worked example of this pattern: they landed as two more optional fields, so a song authored before they existed stays conformant unchanged (it simply omits them). The latest additions are the top-level optional `language` field (the note-name system the song is written in) and the optional `name` field on sections and measures (an editor-side label the structure tree shows) — additive in the same way: absent is valid, each is stored and round-trips, and the front end does not read either. A song authored against today's format stays conformant after the format grows for the same reason. The deliberately out-of-scope list (articulations, ornaments, pedal, fingering, tuplets, voltas, multiple voices, lyrics, per-pitch ties, wider octave-shift, triple dots, …) is effectively the backlog of additive candidates.

**Render contract — a `data-wp-interactive` wrapper with the SSR toggle, an inner score container, and seeded per-instance context.** `src/render.php` emits a single block-wrapper `<div>` (the attributes from `get_block_wrapper_attributes()`) carrying `data-wp-interactive="piano-block/piano"` and a per-instance `data-wp-context` attribute. The wrapper is **no longer childless**: it now contains the **server-rendered viewer toggle** (a `<button>` emitted hidden, revealed client-side only once the song is found to have nameable notes) and an **inner score container** `<div>` the view module draws the SVG into. The seeded context carries the **raw** stored `song` string, the **server-computed accessible name**, and the **toggle's per-instance state** — a default-off names flag, the **translatable** toggle label, the client-set gating flag, and a width/redraw signal. The front-end view module (`src/view.js`, registered as a `viewScriptModule`) reads those fields from context via `getContext()` and decides whether (and how) to draw. PHP still performs **no** validation, no parsing-to-gate, and no re-serialization of the song for rendering — the song rides through **raw**, so the render-or-nothing decision lives entirely on the front end — and it still outputs **nothing** when the song is empty or whitespace-only (no wrapper at all). The one server computation: PHP decodes the song **only** to read `metadata.title` / `metadata.composer` for the accessible name (a label, never a render gate). Contributors must keep PHP's role purely "seed whatever is stored, raw, plus the toggle's initial context": adding a general `json_encode`/`json_decode` round-trip on the song would re-escape, reorder, or fail on the author's literal text and would break non-JSON input.

This block's toggle is the **first viewer-operable control on the frontend**. The pattern to follow when adding future frontend controls: keep each control's state in **per-instance local context (never global state)** — `render.php` seeds the per-instance starting values and `view.js` mutates them per instance — so two Piano blocks on one page never share or cross-talk through a control's state.

Escape-safety is now provided by the **core context encoder**, not a hand-rolled replacement. `render.php` seeds the context through `wp_interactivity_data_wp_context()`, which serializes it with `wp_json_encode( …, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP )` — escaping the characters `<`, `>`, `'`, `"`, and `&` to their JSON unicode escapes. That is a **superset** of the single-character escape the old route hand-rolled (it escaped only the leading `<`), so `render.php` needs no manual escaping of the song at all. The **guarantee** is unchanged: the song cannot break out of its attribute context — no XSS, no injected `<script>` or `<foreignObject>` — even when an `annotation`'s `text` or `metadata.title` contains hostile markup, and the escaped value survives a **byte-exact `JSON.parse` round-trip** back to the author's literal bytes on the front end. (Previously the renderer hand-rolled a `str_replace` over the song to neutralize early-close breakout sequences; with route B that bespoke escape is gone, subsumed by the core encoder's broader set.)

> **Exercising the renderer.** The [example song](docs/song-format.md#annotated-example-song) in the format reference is a broad-coverage example (it touches per-hand clefs, accidentals, a chord, a tie, dynamics, a crescendo and a decrescendo meeting on a messa-di-voce hinge, barlines, an octave shift, and a section change). Paste it into a published Piano block and view the post: the front end reads the song from its per-instance context, validates it client-side, and draws the grand staff as an SVG.

**Tests.** Unit tests (run by `npm run test:unit`) cover two layers in pure Node. The validator suite (`src/song/__tests__/`) exercises a comprehensive example song, both note-name systems (case-insensitive), closed-enum / type / range errors, the lenient-on-unknown policy, and the structural-only stance (no musical-timing check). The renderer's pure layout/emit layers have their own suite (`src/notation/__tests__/`), so the musical geometry is verified without a browser, with the front-end SVG emit pinned **byte-identical between the editor canvas and the published page when names are off (the default)** — the editor↔frontend equivalence is preserved, not removed; turning names on is the only thing that changes the emitted SVG. The note-names feature adds coverage on both sides of that invariant: tests pinning the **names-off equivalence** (the model and SVG are unchanged from before the feature when names are off) and tests for the **names-on behavior** (each notehead carries its resolved name and the emit layer draws one inert label per head). End-to-end tests (`specs/`, run by `npm run test:e2e` against `wp-env`) cover the editor (a fresh block is empty; conformant input shows no error; non-conformant input is flagged yet still stored; a song round-trips across save/reload — unchanged; selection now flows through the **structure tree** — toggling it open and selecting tree rows — with tree-driven remove/**duplicate**/rename of sections and measures, the row menu's **positional inserts** ("Add before"/"Add after", asserted to splice at the right index and auto-select the new node), measure-growing exercised through the **Section** panel's "Add measure" button and section-adding through the sidebar **Song** panel — an assertion that **clicking the canvas does not select**, and the Note-language conversion) and the front end across its three display states: a conformant song renders an `<svg role="img">` grand staff with an accessible name and the raw JSON is **not** shown; an empty/whitespace song renders nothing; a non-renderable song (invalid JSON or non-conformant) renders nothing — no raw echo, no error; and a conformant song carrying hostile free text renders that text inert (emitted via SVG `textContent`) while still drawing and round-tripping to the exact author bytes — with the transport sub-check now reading the wrapper's per-instance `data-wp-context` attribute (escaped by the core context encoder) and asserting the hostile `</script>` / `<!--` literals appear there only in their escaped form, never breaking out of the attribute. A multi-block isolation case puts **two Piano blocks on one page**, each with a different song, and asserts each renders independently — its own SVG, its own notation, and its own server-computed accessible name, with no cross-talk — guarding against shared global state.

## Forthcoming

Song *storage*, **visual authoring**, and front-end **notation rendering** have landed, but the audible and richer interactive piano experience has not. Authoring now happens through a **structure tree** beside the canvas — you navigate and select the song there and adjust the selected node's settings in the **block settings sidebar**, while the **canvas is the live render with selection highlighting** (raw-JSON editing stays available as an alternative — see [Using the Piano block](#using-the-piano-block)). The rendered notation already covers a broad spread of markings, including **gradual dynamics** — crescendo and decrescendo hairpins drawn as `<` / `>` wedges (see the [song format reference](docs/song-format.md) for the fields and their v1 limits). The following are planned for future tasks and are **not** part of v1 (the "out of scope" set):

- **Audio playback** — the format retains the pitch, octave, duration, and tempo precision needed for future sound, but nothing plays yet. Every marking the block draws — dynamics and the new gradual-dynamic hairpins included — is **notation only** and has **no sonic effect**; there is no audio engine.
- **Richer notation elements** — articulations, ornaments, pedal, fingering, tuplets, voltas, multiple voices per hand, lyrics, and similar (the format grows by adding optional fields, with no `version` field).

This README will be updated as each capability lands.
