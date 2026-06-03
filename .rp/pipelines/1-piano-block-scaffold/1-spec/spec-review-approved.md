# Spec Review

## Verdict: approved

## Summary

The spec (`1-spec/spec.md`) is approved as a clear, complete, and testable specification for a **minimal Piano block scaffold**. It is judged against the intentionally narrow scope set in the prompt and consolidated requirements: a basic editor placeholder plus a server-rendered dynamic block, with the real piano experience (keys, audio, interactivity, build pipeline, automated tests) deliberately deferred.

I reviewed adversarially across completeness, clarity, feasibility against the real WordPress block APIs, internal consistency, acceptance criteria, and scope discipline, and independently verified the load-bearing technical and tooling claims rather than trusting the requirements doc's citations. No blocking issue was found.

**Independent verification performed (not assumed):**

- **Repo/tooling claims hold.** `biome.json` confirms `indentStyle: "tab"` and JS `quoteStyle: "double"`; `package.json` declares `license: "GPL-2.0-or-later"`; `.nvmrc`/`engines` confirm Node 24 LTS; the repo is greenfield (only Biome tooling). The spec's premises (Overview, requirement 11) match reality.
- **The no-build + Biome + PHP combination actually works.** I built a throwaway probe replicating the repo's Biome config (including `vcs.useIgnoreFile: true` and `files.ignoreUnknown: false`) with sample `render.php`, `*.asset.php`, `block.json`, `style.css`, and `block.js` files. Result: `biome check` cleanly **ignores the PHP files** (it checked 4 of 6 files, skipping both `.php` without error) and processes the JSON/CSS/JS. This confirms requirement 9 is feasible — hand-written PHP (`render.php`, `*.asset.php`) does not break the existing Biome pipeline. (Side note for the implementer, not a spec issue: Biome's `recommended` ruleset flagged `noUnusedVariables` on the bare `var el = wp.element.createElement` idiom; authored JS must actually use what it declares. This is a HOW-level detail correctly left to design/plan.)
- **Load-bearing WordPress API/version claims hold against current official docs** (developer.wordpress.org, Block.json metadata reference): the `render` property was *"Added in WordPress 6.1.0"*; `apiVersion` *"most recent version is `3` and it was introduced in WordPress 6.3"* (validating the stricter `Requires at least: 6.3` floor in requirement 11); `editorScript` accepts a file path relative to `block.json`; the six core categories are exactly `text, media, design, widgets, theme, embed` (so `media` is valid and no `music`/`audio` exists — validating requirement 13 and the out-of-scope note); `textdomain` was introduced in WP 5.7.0 and auto-translates metadata, validating requirement 14's "translation-ready at no cost".

**Why it passes each dimension:**

- **Completeness** — every consolidated requirement (1–24) maps onto the spec: shape/rendering (1–5) → requirements §1–5; toolchain (6–9) → §6–9; installable plugin (10–13) → §10–14; smoke test (14–18) → Acceptance Criteria 1–5; non-goals (19–24) → Out of Scope. Nothing in scope is dropped.
- **Clarity** — every consequential decision is pinned (block id `piano-block/piano`, API v3, category `media`, dynamic/no-saved-markup shape, WP 6.3 / PHP 7.4 floors, GPL-2.0-or-later). Genuinely free choices (placeholder copy, icon wording, whether to ship CSS) are explicitly delegated to design — appropriate underspecification, not ambiguity. Two competent implementers would build the same scaffold.
- **Feasibility** — verified above; no over-claims.
- **Internal consistency** — no contradictions; the dynamic/`save`-null/validation-exempt story is consistent across the Overview, requirements §2–5, and Acceptance Criterion 4.
- **Acceptance criteria** — all five are proper Given-When-Then and each is observable and binary (no PHP fatal/notices under `WP_DEBUG`; appears under Media; no JS console error; only the delimiter comment persisted with no invalid-content warning; server output renders with no PHP error). This is the conventional bar for a scaffold and is sufficient.
- **Scope discipline (WHAT not HOW)** — the spec deliberately states outcomes and defers mechanism ("Exact file layout, markup, and wording are left to the design and plan phases"). It describes the metadata file, block-wrapper attributes, and global script API *functionally* rather than naming `block.json`/`get_block_wrapper_attributes()`/`useBlockProps`/`*.asset.php` in the requirement statements — actually raising the altitude above the consolidated requirements (which do name files). The block identifier and the no-saved-markup persistence contract are part of WHAT the block *is*, not implementation drift. The named build-vs-no-build tension is correctly surfaced for design to acknowledge rather than resolved by accident.

A first-pass approval is rare and warranted here: the scope is small and well-bounded, the requirements phase did thorough research, and the spec faithfully distills it while holding correct altitude. The only "missing" items (interactive keys, audio, build pipeline, tests, custom category) are explicitly and correctly listed as Out of Scope, so per the review mandate they are not grounds for rejection.

## Issues

None.
