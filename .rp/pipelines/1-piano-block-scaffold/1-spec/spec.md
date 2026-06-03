# Spec: Piano block scaffold

> Phase 1 artifact — the specification (the WHAT, not the HOW). Distilled from `1-spec/requirements.md` (the research-backed Q&A record) and `0-prompt/prompt.md` (GitHub issue [#1](https://github.com/SantosGuillamot/piano-block/issues/1)). Standalone: readable without those documents.

## Overview

Stand up a minimal, installable WordPress plugin that registers a single block called **"Piano"**. The block must appear in the WordPress block editor showing a basic placeholder, and must render on the public front end through server-side PHP (a *dynamic* block).

This is a **scaffold only** — a clean, conventional foundation that a future task will build the real piano on. It must be installable and pass a basic smoke test, but it intentionally contains no piano behaviour: no interactive keys, no audio, no visual design, no input handling. Those belong to a later task.

The work lands in a greenfield repository whose only existing asset is tooling: [Biome](https://biomejs.dev/) for linting and formatting (tab indentation, double-quoted JavaScript), pinned to Node 24 LTS. There is no WordPress or block code yet, and the toolchain has no SCSS support, so any styling is plain CSS. The scaffold must fit these constraints rather than introduce a competing toolchain.

## Requirements

Each requirement states an outcome. Exact file layout, markup, and wording are left to the design and plan phases.

### The block and its rendering

1. The plugin registers **exactly one** block, identified as **`piano-block/piano`**, using the current Block API (version 3).
2. The block is **dynamic**: its front-end HTML is produced on the server at render time, once per block instance, by server-side PHP — not stored in post content.
3. The block stores **no saved markup**. Persisted post content for an inserted block is only the block's delimiter comment; the block is therefore exempt from block-markup validation.
4. The server-rendered front-end output is **minimal but valid**: a single wrapper element carrying the standard WordPress block wrapper attributes, plus simple placeholder content sufficient to confirm the block rendered. No piano behaviour.
5. In the editor, the block renders a **basic static placeholder** that visibly identifies it as the Piano block, using the standard block-props wrapper so it participates correctly in the editor. It does **not** server-render a preview in the editor. No piano behaviour.

### Toolchain and authoring constraints

6. The scaffold is **no-build**: the editor JavaScript is authored in plain, browser-ready JavaScript that uses WordPress's global script API directly. No JSX, no bundler, no transpiler, and no addition of `@wordpress/scripts` or a comparable build pipeline.
7. Any block styling is **plain CSS** (no SCSS). Styling is **optional** for the scaffold; if present, it is minimal.
8. The editor JavaScript declares its WordPress script dependencies and a version explicitly, so WordPress enqueues it correctly without a build step generating that information.
9. All authored source files pass the repository's **existing Biome** lint and format rules (tab indentation, double-quoted JavaScript) with **no new linting or formatting tooling added**.

### Installable plugin

10. The deliverable is a **standard, installable WordPress plugin**: it carries a plugin header that at minimum names the plugin, and includes the conventional descriptive and compatibility fields so it presents correctly in the WordPress admin and declares its support floor.
11. The plugin declares a minimum environment of **WordPress 6.3** and **PHP 7.4**, and is licensed **GPL-2.0-or-later** (matching the repository's existing license).
12. The plugin registers the block from its block metadata file on the appropriate WordPress initialization hook, so all asset and render wiring derives from that single metadata file.
13. The block metadata declares the block's identity and presentation — including its title, an `icon`, a `description`, and a **category of `media`** (the closest fit among WordPress's fixed core categories; no custom category is created) — and wires the editor script and the server render.
14. Internationalization, minimal stance: the block's metadata strings are made translation-ready at no cost (a text domain is set and matches the plugin header), and any user-facing string in the editor JavaScript is wrapped for translation. Full JavaScript translation loading is deferred (see Out of Scope).

## Out of Scope

Deliberately deferred to future tasks; not part of this scaffold.

- **The real piano experience** — interactive keys, audio/sound, visual design, input handling, and any use of WordPress's Interactivity API or a front-end view script.
- **A JavaScript build pipeline** (bundler/transpiler/JSX, e.g. `@wordpress/scripts`). *Named tension:* the future piano UI will likely justify introducing a build; whether and when to do so is an explicit later decision, kept out now to honor the minimal, Biome-only, plain-CSS intent. The design phase should acknowledge this tension rather than resolve it by accident.
- **A committed local WordPress environment** (e.g. a `wp-env` config file or a `@wordpress/env` dependency). Verification may use any local WordPress install; committing a config is a reasonable future convenience.
- **Automated tests** (unit or end-to-end). There is effectively nothing behavioural to test in the scaffold; the manual smoke test below is the bar. Tests are deferred until real functionality exists.
- **A custom block category** such as "music" or "audio". The scaffold reuses the core `media` category; a custom category is a future option.
- **Any additional blocks, block attributes or controls, inspector/toolbar settings, or block variations** beyond the single placeholder block.
- **Full JavaScript string-translation loading** (wiring the runtime that delivers translated JS strings, and plugin-level text-domain loading). Deferred until there are real translatable JS strings.

## Acceptance Criteria

The bar is a five-point manual smoke test against a local WordPress install (any install; no specific local environment is mandated). The scaffold is accepted when all five pass.

1. **Activation**
   - **Given** a supported WordPress install (6.3+, PHP 7.4+) with the plugin's files in place,
   - **When** an administrator activates the plugin,
   - **Then** it activates with no PHP fatal error, and no PHP notices or warnings under `WP_DEBUG`.

2. **Inserter**
   - **Given** the plugin is active,
   - **When** an editor opens the block inserter and searches for the block by its title,
   - **Then** the Piano block appears and is listed under the **Media** category.

3. **Editor placeholder**
   - **Given** the plugin is active and a post is open in the block editor,
   - **When** the editor inserts the Piano block,
   - **Then** its basic placeholder renders, identifiably as the Piano block, with **no JavaScript console error**.

4. **Save**
   - **Given** a post containing an inserted Piano block,
   - **When** the post is saved,
   - **Then** it saves cleanly with **no "invalid content" warning**, and the persisted content for the block is only its delimiter comment (no stored block markup).

5. **Front-end render**
   - **Given** a published post containing the Piano block,
   - **When** a visitor views the published post,
   - **Then** the server-rendered output (wrapper element plus placeholder content) appears, with **no PHP error**.
