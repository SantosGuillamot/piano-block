# Doc Plan: Piano block scaffold

> Phase 3 artifact — the documentation plan (WHAT to document, WHERE, and for WHOM). Companion to `3-plan/code-plan.md`; implements the documentation implied by the approved `1-spec/spec.md` and `2-design-doc/design-doc.md`. Standalone: each task carries its own goal, audience, files, scope, dependencies, traceability, and drift-resistant acceptance. It deliberately does **not** contain the documentation prose — phase-5 doc-writers author the wording by reading the shipped code. It contains **no code tasks** (those live in `code-plan.md`).

## Overview

This plan covers the documentation that must be true after the code phase ships the minimal Piano block plugin scaffold (six new flat-root files registering one dynamic block `piano-block/piano`; no real piano UX/audio/build/tests — those are deferred). The scaffold turns a "tooling-only, no implementation yet" repository into a "tooling **plus** an installable WordPress plugin" repository, so the documentation work is fundamentally about **correcting and extending what the existing docs claim**, not creating a large new docs corpus.

**Documentation surfaces that exist today (swept end-to-end, excluding `node_modules/` vendor files and the `.rp/` pipeline artifacts, which are out of scope):**

| Surface | Today's state | Why the code phase touches its truth |
|---|---|---|
| `README.md` (repo root, ~800 bytes) | A short project README whose status line says there is **no implementation yet — only project tooling**, and whose tagline describes the *eventual product* (piano song sheets), not a scaffold. Has Requirements / Tooling / Getting started / Scripts sections oriented purely at the Biome toolchain. | After the code phase, an installable plugin exists. The "no implementation yet" claim becomes false, and the README lacks any account of what the plugin is, how to install/activate it, and the no-build development workflow. This is the **primary** doc surface and the bulk of the work. |
| `package.json` `description` field | Reads as a *planned* WordPress block ("(planned)"). | The plugin is no longer merely planned; a scaffold ships. A one-field accuracy fix (human-readable metadata only). |

**Surfaces deliberately NOT planned here (and why):**

- **In-code documentation authored by the code phase** — the plugin header docblock in the main plugin file, the block-metadata `description`, and the leading docblock in the server-render file are all specified and authored *verbatim* by code-writers in `code-plan.md` (its Tasks 1, 2, 5). They are code-owned surfaces; re-planning them here would duplicate and risk drifting from the code plan. Phase-5 doc-writers should **read** these as the source of truth for the README, not rewrite them.
- **New contributor docs (`CONTRIBUTING`, `CHANGELOG`, `AUTHORS`, a `docs/` tree, per-file READMEs).** None exist today, and the spec/design scope is a *minimal* scaffold. Introducing them now is scope-creep beyond "installation/activation, what the block is, and the no-build workflow." The README's development section carries the modest contributor guidance the scaffold warrants. (A `CHANGELOG`/`CONTRIBUTING` is a reasonable *future* addition once real functionality and outside contributors arrive — noted, not planned.)
- **`LICENSE` file.** No standalone license file exists; the license is declared in `package.json` and (per the code plan) the plugin header. Adding a `LICENSE` file is out of scope for this scaffold; the license remains documented where it already is.
- **The deferred piano features** (interactive keys, audio, visual design, input handling, Interactivity API, a build pipeline, tests, custom category, JS-translation loading). These are documented only insofar as the README must honestly frame the current deliverable as a **scaffold for a future piano** and may briefly signal that those capabilities — and a likely future build step — are forthcoming, mirroring how the spec/design already frame them. No feature documentation is written for them.

**Scope & tone constraints binding every task (from spec/design — do not re-decide):**

- Document **only** the minimal scaffold: what the block is (a placeholder for a future interactive piano), how to install/activate the plugin, and the **no-build** development workflow (plain JS against `wp.*` globals, hand-written asset sidecar, plain CSS, Biome for lint/format, no `@wordpress/scripts`/JSX/bundler/SCSS).
- The README must read **honestly as a scaffold**: it must not over-promise piano behaviour that the code does not yet implement, and it must not describe a build step the scaffold does not have. Where it points forward (future piano, likely future build), it should clearly mark that as forthcoming, consistent with the spec's Out-of-Scope and design §6's deliberate build-tension resolution.
- The environment floors stated for *end users* are **WordPress 6.3+ and PHP 7.4+** (the plugin's declared support floor); the floors stated for *contributors/tooling* are **Node 24 LTS and npm 11+** (the existing toolchain). Keep these two audiences' requirements distinct and do not conflate them.
- README edits that touch existing fenced shell blocks and prose must keep the file consistent with the repo's existing README style (heading structure, fenced code blocks, link style). Markdown files are **not** in Biome's processing set, so there is no formatter to rely on — match the existing hand-formatting.
- Drift-resistance: phase-5 doc-writers fill in exact file names, command strings, the block title/slug, category, and copy by **reading the shipped code** (`block.json`, the plugin header, `package.json` scripts). This plan names *what each section must convey*, not those literals.

**Task ordering & dependency rationale.** Task 1 (README overhaul) is the substantive surface and depends on the code phase having shipped the plugin files (so the writer can read the real metadata, scripts, and structure). Task 2 (`package.json` description) is a small, independent metadata-accuracy fix that can be done in parallel with Task 1 but should land consistently with the README's framing of the project. Task 3 is a documentation-consistency verification gate that runs after Tasks 1–2 to confirm the docs match the shipped code and contain no drift. All three depend on the code phase being complete enough to read the shipped artifacts; none introduce code.

---

### Task 1 — Overhaul the root `README.md` for the shipped scaffold

**Goal:** Replace the "no implementation yet" framing with an accurate account of the now-installable plugin scaffold, so a reader understands *what the block is*, can *install and activate* it against a supported WordPress install, and can *work on it under the no-build workflow* — without over-promising the deferred piano features.

**Audience:** Two concrete readers, addressed in distinct sections of the same file: (a) a **WordPress site administrator / evaluator** who wants to install and activate the plugin and see the placeholder block work (cares about the WP 6.3+/PHP 7.4+ floors, activation, and what the block currently does); and (b) a **developer/contributor** cloning the repo to extend the scaffold (cares about the Node/npm toolchain, the no-build authoring model, Biome, and how the files fit together).

**Files to change:**
- `README.md` (repo root) — revise existing sections and add the scaffold-specific ones.

**Sections / scope:**
- **Status / framing:** Correct the now-false "no implementation yet — only project tooling" statement. State plainly that the repo now contains an installable WordPress plugin that registers a single placeholder block, and that this is a **scaffold** — a deliberate foundation with no real piano behaviour yet (keys/audio/visual design/input handling deferred to a future task). Keep, but reconcile, the product tagline so the long-term vision (piano practice sheets) and the present reality (a placeholder scaffold) are both clear and not contradictory.
- **What the block is / does today:** A short description of the single block the plugin registers — that it is a dynamic (server-rendered) block, where it appears for an editor (the inserter and which core category), and what a user currently sees in the editor and on the front end (a placeholder, not a playable piano). Convey behaviour, not implementation internals.
- **Requirements (end-user vs. tooling):** Clearly separate the **plugin's runtime support floor** (WordPress and PHP minimums) from the **contributor toolchain** (Node/npm), since the existing README only documents the latter. Do not merge the two.
- **Installation & activation:** How to get the plugin's files into a WordPress install and activate it, and what success looks like (the block becomes available in the editor; the front end renders the placeholder). Frame this for any local WordPress install — the scaffold does **not** ship a committed local environment, so do not document one as if it exists; at most note that bringing one is up to the reader.
- **Development workflow (the no-build model):** Explain that the scaffold is intentionally **no-build** — the editor script is plain, browser-ready JavaScript using WordPress's global script API (no JSX/bundler/transpiler/`@wordpress/scripts`), styling is plain CSS (no SCSS), and the script's dependencies/version are declared by hand rather than generated. Explain that Biome handles lint/format and that the existing scripts are the way to run it, and that the PHP files sit outside Biome's processing. Keep/adapt the existing Getting-started and Scripts content so it remains accurate for a contributor working on the plugin (not just the bare toolchain).
- **Forthcoming (brief, honest forward-pointer):** A short note that the real piano experience — and, very likely, an accompanying build step — is planned for a future task, mirroring how the spec/design frame deferral. Do not document those features as if present.

**Depends on:** The code phase (code-plan Tasks 1–6) having shipped the plugin files, so the writer can read the actual block metadata, plugin header, `package.json` scripts, and file layout rather than guess. (No dependency on doc Task 2, but should be consistent with it.)

**Traces to:** spec Overview & req 10–13 (installable plugin; identity/presentation; what the block is and where it appears); spec req 6–9 (no-build, plain-CSS, Biome-only authoring constraints → the development-workflow section); spec Out of Scope + design §6 (scaffold framing and the forthcoming build step) → the framing and forthcoming sections; spec AC1/AC2/AC3/AC5 (activation, inserter/category, placeholder, front-end render → the install/activation and "what the block does" sections). Code-plan Tasks 1, 2, 5, 6 are the source surfaces the writer reads for literals.

**Acceptance:**
- A reader who has never seen the repo comes away understanding that the project currently ships an **installable WordPress plugin that is a placeholder scaffold** (one block, no real piano behaviour yet), not merely a tooling skeleton and not a finished piano — the previous "no implementation yet" claim no longer appears or contradicts reality.
- An administrator can follow the README to install and activate the plugin against a supported WordPress install and knows the **WordPress and PHP minimums**, and what a successful install looks like (the block is available in the editor and renders a placeholder on the front end). The README does not assume or instruct use of a committed local WordPress environment (none ships).
- A contributor can tell from the README that development is **no-build** (plain JS on WordPress globals, plain CSS, hand-declared script metadata, Biome for lint/format, no bundler/JSX/SCSS) and knows which existing scripts to run; the **Node/npm** toolchain requirements remain documented and are kept distinct from the plugin's runtime floors.
- The README honestly marks the real piano experience (and a likely future build step) as **forthcoming**, without describing those deferred features or a build step as if they already exist.
- The revised README is internally consistent and matches the shipped code (block title/slug/category, the actual scripts, file names) — no claim in the README contradicts what the plugin actually does or how it is structured.

---

### Task 2 — Correct the `package.json` project description

**Goal:** Update the human-readable project `description` so the package metadata no longer describes the project as merely *planned*, reflecting that an installable scaffold now ships — while leaving all functional `package.json` fields untouched.

**Audience:** Anyone reading the package metadata rather than the README — e.g. a developer scanning `package.json`, or tooling/registry surfaces that echo the `description`. A metadata-accuracy concern, not narrative documentation.

**Files to change:**
- `package.json` (repo root) — the `description` value only.

**Sections / scope:**
- Adjust **only** the `description` string so it accurately frames the current deliverable (a WordPress block plugin scaffold / placeholder for a future piano) rather than a purely planned project. Keep it short, consistent with the README's framing, and aligned in spirit with the block/plugin descriptions the code phase ships (without copying any of them verbatim — phase-5 writers choose the wording).
- Explicitly **do not** change `name`, `version`, `license`, `private`, `engines`, `scripts`, or `devDependencies`. The code plan keeps `package.json` functionally untouched; this task is a non-functional documentation-accuracy edit confined to the descriptive string, and must not alter behaviour, dependencies, or the lockfile.

**Depends on:** None hard (it is a single-field edit). Should be made **consistent with** Task 1's framing of the project. Best done after the code phase ships so the writer can align tone with the shipped plugin/block descriptions.

**Traces to:** spec Overview and req 10–13 (the project now ships an installable plugin scaffold, so its metadata description should say so) / supports the same accuracy goal as Task 1. (Note: `code-plan.md` lists `package.json` among files "left untouched" — that refers to its *functional* fields for the scaffold to operate; this documentation task changes only the descriptive string and must preserve every functional field, so it does not conflict with the code plan's intent.)

**Acceptance:**
- The `package.json` `description` accurately presents the project as an installable WordPress block plugin scaffold (a placeholder for a future piano), with no wording implying the project is merely planned/unimplemented.
- The description is consistent in framing with the README (Task 1) and does not contradict the shipped block/plugin descriptions.
- No field of `package.json` other than `description` is modified; dependencies, scripts, version, license, and the lockfile are unchanged.

---

### Task 3 — Documentation-consistency verification gate

**Goal:** Confirm that, after Tasks 1–2, every documentation surface accurately reflects the **shipped** scaffold and contains no drift — no stale "not implemented" claims, no over-promised piano behaviour, no documented build step that does not exist, and no mismatch between the docs and the real block identity/structure/scripts.

**Audience:** N/A (verification gate). The beneficiaries are the two reader audiences from Task 1, protected from inaccurate docs.

**Files to change:** None (verification only). If a discrepancy is found, the fix belongs in whichever doc surface owns it (Task 1 for the README, Task 2 for `package.json`); do not introduce new doc files or document out-of-scope features to "fill gaps."

**Sections / scope:**
- Cross-check the README and `package.json` `description` against the shipped code: the block's title, slug, and category; the editor and front-end placeholder behaviour; the WP/PHP runtime floors and the Node/npm toolchain floors; and the set of contributor scripts. Each documented claim must match what the code actually does/declares.
- Confirm the docs **frame the deliverable as a scaffold** and mark the real piano experience (and any future build step) as forthcoming — and that they do **not** describe deferred features, a build pipeline, automated tests, a custom block category, or a committed local WordPress environment as if present.
- Confirm no out-of-scope documentation was introduced (no new `CONTRIBUTING`/`CHANGELOG`/`docs/` tree/`LICENSE` file beyond what the scaffold scope calls for) and that Markdown files remain hand-consistent with the repo's existing README style.

**Depends on:** Task 1 and Task 2 (the surfaces must be written first); and the code phase being complete (so "matches the shipped code" is checkable). Conventionally the final doc gate.

**Traces to:** spec Acceptance Criteria AC1–AC5 (the docs must describe behaviour that matches what those criteria verify) and spec Out of Scope / design §6 (the docs must respect deferral and the deliberate no-build framing). It is the documentation analogue of the code plan's verification gates.

**Acceptance:**
- Every claim in the README and `package.json` `description` about the block (identity, category, editor/front-end behaviour), the requirements (WP/PHP floors vs. Node/npm toolchain), installation/activation, and the development workflow **matches the shipped code** — a reader following the docs would not be surprised or misled by the actual plugin.
- No documentation surface claims the project is unimplemented, promises piano behaviour the scaffold lacks, or documents a build step / tests / committed local environment that does not ship; deferred work is consistently framed as forthcoming.
- No out-of-scope documentation files were added; existing Markdown remains consistent with the repo's established style.
