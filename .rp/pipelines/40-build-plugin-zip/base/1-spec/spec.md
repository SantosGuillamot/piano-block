# Spec — Build a distribution-ready plugin zip

## Overview

A maintainer of the Piano Block WordPress plugin needs a single command that
produces a distributable zip archive containing **only** the files required to
run the plugin in WordPress — excluding all development, source, configuration,
and tooling files — without manually selecting files on each run.

Today there is no such command. Producing a clean distributable means manually
identifying and bundling the runtime files, which is error-prone: the runtime
payload (`build/`) is gitignored and only exists after a build, so it is easy to
ship a zip that silently omits the block, or to leak development files into a
release.

This spec defines the behavior of that command. The plugin's runtime payload is
the main plugin file plus a generated `build/` directory; everything else in the
repository is development scaffolding. The command must reliably capture the
former and exclude the latter, producing an artifact a WordPress user could
install.

**Note on scope:** This spec defines *behaviors and acceptance criteria*. The
choice of tool or implementation (e.g. a wp-scripts command, a bespoke Node
script, or a WP-CLI route) is deliberately left to the design phase. Requirements
below describe *what the command must do*, not *how*.

## Requirements

### R1 — Single command invocation

- The plugin is built and tested with `@wordpress/scripts` and an npm-based
  toolchain. The command MUST be exposed as a single npm script named
  `plugin-zip`, invoked as `npm run plugin-zip`.
- The script name MUST be `plugin-zip` (the WordPress/`create-block` community
  convention). Non-standard names (e.g. `build:zip`, `plugin:zip`) MUST NOT be
  used.
- The command MUST run non-interactively and be CI-friendly: deterministic,
  requiring no user input, and returning a correct exit code (0 on success,
  non-zero on failure).

### R2 — Build-first (the archive reflects a fresh build)

- The plugin's runtime payload lives in `build/`, which is gitignored and absent
  on a clean checkout; it only exists after the build step runs.
- The command MUST produce the zip from a **freshly built** `build/` directory —
  it MUST guarantee the build has run (e.g. by chaining the build step) so the
  archive never silently omits the block or carries stale files left over from a
  previous build.
- If, at the moment of archiving, the runtime payload (`build/`) is missing or
  empty, the command MUST fail loudly with a non-zero exit code rather than emit
  an incomplete zip.

### R3 — Included files (runtime payload)

The archive MUST contain the files needed to run the plugin in WordPress.
Inclusion MUST be **automatic / allowlist-style (safe-by-omission)** — no per-run
manual file selection. For the plugin as it exists today, the included set is:

- `piano-block.php` — the main plugin file.
- The entire `build/` directory, including but not limited to: `block.json`,
  `render.php`, `index.js`, `view.js`, `style-index.css`, `style-index-rtl.css`,
  `index.asset.php`, `view.asset.php`, and the notation font file(s) under
  `build/fonts/` (`*.woff2`).
- `README.md`.
- `languages/` — **if it exists** (it does not exist today; the plugin runs fine
  without it). "Include if present," not a per-run requirement.

The include mechanism MUST add new files that appear *within* these already-
included locations (e.g. a new file under `build/`) automatically, with zero
configuration edits.

### R4 — Excluded files (everything else)

The archive MUST exclude all development, source, configuration, and tooling
files. None of the following may appear in the archive:

- Source: `src/` (JSX/SCSS, `__tests__/`, raw fonts, `OFL.txt`).
- Dependencies: `node_modules/`.
- Package/config: `package.json`, `package-lock.json`, `biome.json`,
  `playwright.config.js`, `.wp-env.json`, `.nvmrc`, `.gitignore`.
- Project/process: `AGENTS.md`, `docs/`, `specs/`, `.rp*`, `.claude/`.
- Test/e2e and build artifacts: `artifacts/`, `test-results/`,
  `playwright-report/`, `*.log`, `.env*`.
- OS/editor noise: `.DS_Store`, `.idea/`, `.vscode/`.

The exclusion MUST be the *default* behavior (development/config files excluded
unless explicitly part of the runtime payload), not a hand-maintained list of
things to remove.

### R5 — Archive structure (single slug-named root folder)

- All archived files MUST be wrapped under a **single top-level directory named
  after the plugin slug**, `piano-block/` (e.g. `piano-block/piano-block.php`,
  `piano-block/build/block.json`).
- This is required because WordPress expects an installable plugin zip to contain
  exactly one root folder named after the plugin.

### R6 — Output artifact and idempotency

- The command MUST write the archive as `piano-block.zip` at the repository root.
- Re-running the command MUST overwrite the existing artifact idempotently (no
  appending to a stale archive, no error on overwrite).
- The artifact path/pattern MUST be added to `.gitignore` so the generated zip is
  not committed. (Today's `.gitignore` has no `*.zip`/`piano-block.zip` rule.)

### R7 — Standard-layout drift guard (low-cost future-proofing)

- The include set MUST cover at least the **standard WordPress plugin layout**
  used by `@wordpress/scripts` / the Plugin Handbook: `{slug}.php`, `build/**`,
  `languages/**`, `block.json`, `readme.*`, `uninstall.php`, `changelog.*`,
  `license.*`, and `admin/`, `includes/`, `public/`.
- This ensures the most likely future additions for this plugin (a real
  `languages/` directory, an `uninstall.php`) are auto-included without editing
  the command. Because these are the standard layout globs, this guard costs no
  extra configuration and is not tool-specific.
- Auto-detecting *arbitrary, non-standard* future top-level runtime paths is
  explicitly **not required** (see Out of Scope).

## Out of Scope

- **Tool/implementation choice.** Whether the command is backed by
  `wp-scripts plugin-zip`, a bespoke `archiver`-based Node script, WP-CLI
  `dist-archive`, or anything else is a design-phase decision. This spec requires
  *behaviors*, not a specific tool.
- **CI / release automation.** Building the zip in GitHub Actions or attaching it
  to a GitHub Release on tag is a separate concern. No `.github/` exists today.
  The command must be CI-friendly (R1) so it *can* later be wired into CI, but
  wiring it is not part of this work.
- **Filename versioning.** The artifact name is the unversioned `piano-block.zip`
  (R6). Embedding the version in the filename (e.g.
  `piano-block.{version}.zip`) is a deferred owner preference; if adopted later,
  the PHP header `Version:` is the source of truth.
- **WordPress.org submission readiness.** There is no `readme.txt` (the WP.org
  format); producing or validating one is a separate, currently-unmet concern.
  `README.md` is shipped (R3), but WP.org packaging is not in scope.
- **Keeping `package.json` `version` and the PHP header `Version:` in sync.** No
  mechanism exists today and none is required here (relevant only if filename
  versioning is later adopted).
- **Auto-detecting arbitrary, non-standard future top-level runtime files/dirs**
  (e.g. a hypothetical `assets/` or `data/` directory outside the standard plugin
  layout). The command covers the standard layout globs (R7); adding novel
  non-standard top-level runtime paths remains the maintainer's responsibility.
  This keeps "without manually selecting files" honest: it means no per-run file
  picking and zero edits for standard-layout growth — not omniscient
  future-proofing.

## Acceptance Criteria

The command is accepted when, on a clean checkout with dependencies installed:

1. **Invocation.** Running `npm run plugin-zip` completes and exits with code 0.
   The command requires no interactive input.

2. **Build-first / fail-loud.** The archive reflects a freshly built `build/`. If
   the runtime payload (`build/`) is missing or empty at archive time, the command
   exits non-zero and does **not** produce an incomplete zip.

3. **Artifact location & idempotency.** A file `piano-block.zip` exists at the
   repository root after a successful run. Running the command again overwrites it
   (no error, no stale appended contents).

4. **Single root folder (R5).** Every entry in the archive is nested under a
   single top-level `piano-block/` directory.

5. **Included files present (R3).** Unzipping the archive yields at least:
   - `piano-block/piano-block.php`
   - `piano-block/build/block.json`
   - `piano-block/build/render.php`
   - `piano-block/build/index.js`
   - `piano-block/build/view.js`
   - `piano-block/build/style-index.css`
   - `piano-block/build/index.asset.php`
   - `piano-block/build/view.asset.php`
   - at least one `*.woff2` file under `piano-block/build/fonts/` (assert the
     directory contains a `.woff2`; do **not** assert an exact content-hashed
     filename)

6. **Excluded files absent (R4).** The archive contains **none** of: any `src/`
   path, `node_modules/`, `package.json`, `package-lock.json`, `biome.json`,
   `playwright.config.js`, `.wp-env.json`, `.nvmrc`, `specs/`, `docs/`,
   `AGENTS.md`, `.rp*`, `.claude/`, or dotfiles / OS-editor noise (`.gitignore`,
   `.DS_Store`, `.idea/`, `.vscode/`, `*.log`, `.env*`).

7. **Gitignore (R6).** `.gitignore` includes a rule that excludes the generated
   zip artifact (`piano-block.zip` / `*.zip`), so a clean `git status` after a
   build does not show the artifact as untracked-to-commit.

8. **Conditional includes (R3).** If a `languages/` directory is present at build
   time, its contents appear under `piano-block/languages/`. If absent, the
   command still succeeds and the archive simply omits it.

> "Installs cleanly into a WordPress site" (e.g. via `wp-env`) is an acceptable
> *stronger* verification but is **not** the required acceptance bar; the
> content-assertion criteria above (1–8) are the bar.
