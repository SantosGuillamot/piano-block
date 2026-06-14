# Design Doc — Build a distribution-ready plugin zip

> Design for GitHub issue #40 (Piano Block plugin).
> Contract: `../1-spec/spec.md` (requirements R1–R7, acceptance criteria AC1–AC8).
> This document is standalone: it captures the architecture, the chosen approach
> and why, the command surface, the technical decisions with their trade-offs,
> and how each spec requirement and acceptance criterion is met. No other file is
> needed to understand the design.

## Goal

Give a maintainer a single, non-interactive command — `npm run plugin-zip` — that
produces `piano-block.zip` at the repository root containing **only** the files
needed to run the Piano Block plugin in WordPress, freshly built, with everything
else (source, dependencies, config, tooling, process files) excluded. The
artifact must be a WordPress-installable zip: a single root folder named after the
plugin slug, with the runtime payload nested beneath it.

## Architecture overview

The design is intentionally thin. Rather than build a bespoke archiver, it
composes three things the plugin's existing toolchain already provides or that
cost almost nothing to add:

1. **The archiver: the built-in `wp-scripts plugin-zip` command** (from
   `@wordpress/scripts`, already a dependency). This alone satisfies the
   *content* requirements — which files are included (R3), which are excluded
   (R4), the single slug-named root folder (R5), the output filename and
   idempotent overwrite (R6), and the standard-layout drift guard (R7). It does
   this with **zero configuration**.

2. **A three-stage npm chain** that wraps the archiver so the command also builds
   first and fails loudly on a broken build (R2), and is exposed under the
   correct single script name with correct exit-code semantics (R1):

   ```
   "plugin-zip": "npm run build && node scripts/check-build.js && wp-scripts plugin-zip"
   ```

3. **A small committed Node guard, `scripts/check-build.js`**, that asserts the
   build actually produced the block before archiving, so the zip can never
   silently omit the block (R2 / AC2).

Plus one supporting change: a `.gitignore` rule so the generated artifact is never
committed (R6 / AC7).

```
npm run plugin-zip
   │
   ├─ Stage 1:  npm run build            (= wp-scripts build)
   │              builds src/ → build/, exits non-zero on failure
   │              │  &&  (short-circuits on failure)
   │
   ├─ Stage 2:  node scripts/check-build.js
   │              asserts build/block.json exists, else exit 1
   │              │  &&  (short-circuits on failure)
   │
   └─ Stage 3:  wp-scripts plugin-zip
                  allowlist-archives runtime payload →
                  ./piano-block.zip  (root folder: piano-block/)
```

The flow of responsibility: **stage 1 guarantees a fresh build, stage 2
guarantees that build is real, stage 3 packages exactly the runtime payload.** The
`&&` operator makes the whole thing fail-closed — any stage's non-zero exit aborts
the chain and skips the archive step, and npm propagates the exact inner exit code
outward.

## The chosen approach and why

### Why the built-in `wp-scripts plugin-zip` (not a bespoke archiver, not WP-CLI)

The intent floated three candidate implementations: the built-in
`wp-scripts plugin-zip`, a bespoke `archiver`-based Node script, or WP-CLI
`dist-archive`. The design selects the built-in command.

The decisive property is that **`wp-scripts plugin-zip` selects files by an
allowlist (safe-by-omission), which is exactly the inclusion model the spec
mandates.** R3 requires automatic, allowlist-style inclusion; R4 requires that
exclusion be the *default* behavior, not a hand-maintained denylist. The built-in
tool is built on precisely this model, so R3, R4, R5, R6, and R7 are satisfied out
of the box.

How the tool selects files (verified by reading the installed
`@wordpress/scripts@32.3.0` source — `scripts/plugin-zip.js`, which uses
`adm-zip` + `fast-glob` + `npm-packlist`):

- **When `package.json` has no `files` field** (true for this repo), it uses the
  WordPress Plugin Handbook allowlist globs, case-insensitively:
  `admin/**`, `build/**`, `includes/**`, `languages/**`, `public/**`,
  `${name}.php`, `uninstall.php`, `block.json`, `changelog.*`, `license.*`,
  `readme.*`.
- **The root folder** is `${name}/` taken from `package.json`'s `name` field →
  `piano-block/`.
- **The output file** is `./${name}.zip` written at the current working directory
  → `piano-block.zip` at the repo root. It is written with `adm-zip`'s `writeZip`,
  which truncates and recreates the file (overwrite, never append).

A real run in this worktree (with `build/` present) confirmed the behavior end to
end: exit 0, a single `piano-block/` root, `piano-block.zip` at the worktree root,
and exactly the expected entries — `piano-block.php`, `README.md` (matched
`readme.*` case-insensitively), and all of `build/**` including a
`build/fonts/*.woff2`. A grep of the archive's entry list confirmed **none** of the
excluded paths leaked (`src/`, `node_modules/`, `package.json`,
`package-lock.json`, `biome.json`, `playwright.config.js`, `.wp-env.json`,
`.nvmrc`, `.gitignore`, `AGENTS.md`, `docs/`, `specs/`, `.rp*`, `.claude/`,
`.DS_Store`, `.idea/`, `.vscode/`, `.env*`).

Why not the alternatives:

- **Bespoke `archiver` script:** would re-implement the allowlist-and-exclude
  logic the built-in already provides, and would require ongoing maintenance of an
  include list — the very fragility R3/R4 push against. It also adds a dependency
  (`archiver`) to track.
- **WP-CLI `dist-archive`:** introduces a PHP/WP-CLI dependency outside the
  plugin's existing npm toolchain, for no benefit over the built-in.

The plugin is already fully bought into `@wordpress/scripts`, so coupling to its
documented, community-standard `plugin-zip` subcommand is the natural fit and adds
**no new dependency**.

### Why a three-stage chain plus a Node guard (the R1/R2 wrapper)

The one thing the built-in tool does **not** do is build first or fail on a broken
build. Verified directly: `wp-scripts plugin-zip` does not run a build, and when
`build/` is missing **or** empty it still exits 0 and emits an incomplete zip
(only `piano-block.php` + `README.md`). That directly violates R2 / AC2 — the
exact "silently ship a blockless zip" failure the spec is written to prevent.

The wrapper closes this gap with three composed stages:

**Stage 1 — `npm run build` (build-first, R2).** The chain begins by invoking the
repo's existing `build` script (`wp-scripts build`). Reusing `npm run build`
rather than inlining `wp-scripts build` keeps a **single source of truth** for how
this plugin builds: if the build command ever changes, the zip command tracks it
automatically. `wp-scripts build` runs synchronously and exits non-zero on a build
failure (e.g. a syntax error in `src/`), which aborts the chain before anything is
archived. The cost is one extra short-lived npm process — negligible, and worth the
DRY guarantee.

A subtle but important property: `wp-scripts build` uses webpack's `output.clean`
with `keep: /^(fonts|images)\//`, so JS/CSS/PHP are always rebuilt fresh on every
run, while `build/fonts/` and `build/images/` persist across builds by design
(they *are* runtime payload). This means stage 1 never leaves stale generated
JS/CSS/PHP, satisfying R2's "no stale files" intent. It also creates the partial-
build hazard that stage 2 is designed to catch (below).

**Stage 2 — `node scripts/check-build.js` (fail-loud, R2 / AC2).** A committed
Node guard asserts that the build actually produced a usable block before
archiving. The guard's keystone check is the **presence of `build/block.json`** —
not a bare "directory is non-empty" check. This distinction is load-bearing:

- `piano-block.php` registers the block via
  `register_block_type(__DIR__ . '/build')`, which loads `build/block.json`, which
  in turn references `index.js`, `view.js`, `style-index.css`, and `render.php` via
  relative `file:./` paths. `build/block.json` is therefore the keystone WordPress
  itself relies on — its presence means a successful build ran and emitted what it
  points at.
- Because `output.clean` *keeps* `build/fonts/`, a wiped or partial build can leave
  `build/fonts/*.woff2` on disk while the block itself is gone. A naive
  "directory non-empty" check would **pass** that broken state and ship a blockless
  zip. Checking `build/block.json` specifically catches it.

The guard was verified against four cases: full build → exit 0; `build/` missing →
exit 1; `build/` empty → exit 1; partial build (fonts present, no `block.json`) →
exit 1. The dangerous partial case is caught.

Checking the single keystone (rather than asserting every individual JS/PHP
artifact) is deliberate: the build produces those files atomically alongside
`block.json`, so asserting each one is more brittle for negligible additional
safety.

**Stage 3 — `wp-scripts plugin-zip` (the archiver).** Runs bare (no flags) from
the repo root. With `name: "piano-block"` in `package.json` and the cwd at the repo
root, the defaults produce exactly the required root folder (`piano-block/`) and
output location (`./piano-block.zip`). The available flags (`--root-folder`,
`--no-root-folder`) are not needed.

### Why a committed Node guard (not inline `node -e`, not shell `test`)

The guard is a real committed file, `scripts/check-build.js`, chosen over the two
lighter-weight alternatives:

- **Shell `[ -f build/block.json ]`** is POSIX-only and breaks under Windows
  `cmd`. The plugin already requires Node ≥ 24, so a Node guard is cross-platform
  with no added cost.
- **Inline `node -e '…'`** is cramped, hard to read, gives poor error messages, and
  is not unit-testable.

A committed Node script using only built-ins (`node:fs` / `node:path`, **no new
dependency**) is cross-platform, readable, unit-testable, and can emit a clear,
actionable message to stderr before `process.exit(1)`. This keeps the command
CI-friendly (R1): deterministic, non-interactive, with a precise failure signal.

A new top-level `scripts/` directory is introduced (none exists today). It is
conventional, and — because it is not in the Plugin Handbook allowlist — it is
automatically excluded from the zip, so it has no R4 impact.

### Why an anchored `.gitignore` rule (R6 / AC7)

The generated `piano-block.zip` must not be committed. The design appends an
**anchored, named** rule to `.gitignore`, matching the existing comment-and-
anchoring house style:

```
# Distribution artifact (generated by `npm run plugin-zip`)
/piano-block.zip
```

- **Anchored + named** matches house style: in this `.gitignore`, every root-
  generated artifact is anchored (`/build/`, `/artifacts/`, `/test-results/`,
  `/playwright-report/`); only appears-anywhere noise is unanchored (`*.log`,
  `.DS_Store`, etc.). The zip is a single named artifact at the repo root, so it
  belongs to the anchored class. Anchored + named also reveals intent.
- **Chosen over broad `*.zip`** to avoid silently hiding any future legitimate zip
  (e.g. a test fixture). No `.zip` is tracked or present today, so the narrow rule
  loses nothing now and is safer later. (If versioned filenames like
  `piano-block.{version}.zip` are ever adopted — explicitly out of scope — switch
  to `/piano-block*.zip` then.)

Verified: with the rule present, `git check-ignore -v piano-block.zip` matches and
`git status --short` does not list the artifact.

## Command / config surface

The public surface is a single npm script invoked as `npm run plugin-zip`. There
are **no flags, options, or configuration files** the user interacts with — the
command is fully non-interactive and deterministic by design (R1).

The artifacts that implement it:

| Artifact | Change | Purpose |
|---|---|---|
| `package.json` (`scripts`) | Add `"plugin-zip": "npm run build && node scripts/check-build.js && wp-scripts plugin-zip"` | Exposes the single command with the community-standard name; wires the three stages with fail-closed `&&` semantics. |
| `scripts/check-build.js` | New committed file | Build-payload guard: exit 1 with a clear stderr message if `build/block.json` is absent, else exit 0. Uses only Node built-ins. |
| `.gitignore` | Append anchored `/piano-block.zip` (with a comment) | Keeps the generated artifact out of version control. |

Two **explicit non-changes** that are part of the design contract:

- **Do NOT add a `files` field to `package.json`.** The tool branches on
  `hasPackageProp('files')`: if present, it ignores the Plugin Handbook globs and
  uses `npm-packlist` instead (which also honors `.npmignore`). The repo has no
  `files` field today, so it uses the safe glob allowlist. Adding `files` for any
  reason would silently change what is included. The design relies on the default
  globs and forbids introducing a `files` field.
- **Run `wp-scripts plugin-zip` bare, from the repo root.** No flags; the cwd
  placement is what lands `./piano-block.zip` at the repo root.

`scripts/check-build.js` behavioral contract (design altitude — exact body is for
the implementation phase): resolve `build/block.json` relative to
`process.cwd()`; if it does not exist, write a clear actionable message to stderr
and `process.exit(1)`; otherwise exit 0. It depends only on `node:fs` / `node:path`
and references **only** `build/block.json` — never `languages/` or any other path —
so it stays independent of conditional includes.

## How each requirement is met

| Req | How the design satisfies it |
|---|---|
| **R1 — Single command, CI-friendly** | One npm script named exactly `plugin-zip` (the `create-block` convention; no `build:zip`/`plugin:zip`). All three stages are non-interactive; `&&` short-circuits and npm propagates the exact inner exit code → 0 on success, non-zero on any failure. Deterministic, no user input. |
| **R2 — Build-first + fail-loud** | Stage 1 (`npm run build`) freshly builds `build/` before archiving; `output.clean` rebuilds JS/CSS/PHP each run so no stale files. Stage 2 asserts `build/block.json`; a missing/empty/partial `build/` exits non-zero **before** stage 3, so no incomplete zip is produced. |
| **R3 — Included files (allowlist)** | The built-in tool's default Plugin Handbook globs auto-include `${slug}.php`, `build/**` (every file within, including new ones, with zero config), `readme.*` (→ `README.md`), and `languages/**` if present. Inclusion is allowlist/safe-by-omission with no per-run selection. |
| **R4 — Excluded files (default)** | Exclusion is the default of the allowlist model: anything not matched by the globs is omitted. `src/`, `node_modules/`, all config/tooling/process files, and OS/editor noise are excluded automatically — no hand-maintained denylist. The new `scripts/` dir is likewise auto-excluded. |
| **R5 — Single slug-named root** | The tool wraps every entry under `${name}/` = `piano-block/` (e.g. `piano-block/piano-block.php`, `piano-block/build/block.json`). |
| **R6 — Output + idempotency + gitignore** | Output is `./piano-block.zip` at the repo root; `adm-zip` `writeZip` truncates and recreates (idempotent overwrite, no append). The anchored `/piano-block.zip` rule keeps it out of version control. |
| **R7 — Standard-layout drift guard** | The tool's default globs *are* the spec's R7 standard-layout set (`admin/`, `includes/`, `public/`, `uninstall.php`, `changelog.*`, `license.*`, `readme.*`, `languages/**`, `build/**`, `${slug}.php`, `block.json`). Future standard additions (a real `languages/`, an `uninstall.php`) are auto-included with no config edits. Free, not tool-specific in spirit. |

## How each acceptance criterion is met

| AC | Criterion | How satisfied |
|---|---|---|
| **AC1** | Invocation, exit 0, non-interactive | Single `plugin-zip` script; all stages non-interactive; `&&` propagates the exact exit code (0 on success). *Verified by a real run.* |
| **AC2** | Build-first / fail-loud on missing OR empty `build/` | `npm run build` runs first (synchronous); guard asserts `build/block.json`; missing/empty/partial all exit non-zero before archiving (no zip). *4 cases verified.* |
| **AC3** | Artifact at root + idempotent overwrite | `plugin-zip` writes `./piano-block.zip` at cwd; `adm-zip` truncates/recreates, so a re-run yields a fresh archive with no appended stale contents. *Verified.* |
| **AC4** | Single `piano-block/` root | Root folder = `package.json` `name` = `piano-block/`; every entry nested beneath it. *Verified.* |
| **AC5** | Included files present | A real run included `piano-block.php`, all `build/**` (`block.json`, `render.php`, `index.js`, `view.js`, `style-index.css`, `index.asset.php`, `view.asset.php`) and at least one `build/fonts/*.woff2`. *Verified.* |
| **AC6** | Excluded files absent (through the full chain) | Allowlist safe-by-omission; stage 1 only writes `build/**` (already an included location) and stage 2 only reads `build/block.json` (writes nothing), so the chain's archivable tree equals bare `plugin-zip`'s. Leak check passed with none of the forbidden paths present. *Verified.* |
| **AC7** | Gitignore rule | Anchored `/piano-block.zip` rule; `git check-ignore` matches and `git status` does not list the artifact. *Verified.* |
| **AC8** | Conditional `languages/` | `languages/**` glob is additive; the guard references only `build/block.json` and is indifferent to `languages/`. Present → included under `piano-block/languages/`; absent → omitted, command still exits 0. *Both branches verified.* |

## Technical decisions, trade-offs, and risks accepted

1. **Coupling to a `@wordpress/scripts` internal subcommand.** Accepted:
   `plugin-zip` is documented and community-standard, and the plugin is already
   fully invested in that toolchain. The alternative (bespoke archiver) trades this
   coupling for ongoing include-list maintenance and a new dependency — a worse
   deal.

2. **The `files`-field footgun is latent.** A future contributor adding a `files`
   array to `package.json` for an unrelated reason would silently flip the tool to
   `npm-packlist` mode and change inclusion. Mitigated by making "do not add a
   `files` field" an explicit, documented constraint of this design (carried into
   the plan/code/docs phases).

3. **The guard checks one keystone, not every artifact.** `build/block.json` is the
   single file WordPress loads to register the block, and the build emits all
   referenced artifacts atomically alongside it. Asserting each JS/PHP file is more
   brittle for negligible gain. Accepted.

4. **One extra short-lived npm process** from `npm run build` (vs. inlining
   `wp-scripts build`). Accepted in exchange for a single source of truth for the
   build command — the DRY guarantee is worth the trivial process cost.

5. **A new top-level `scripts/` directory.** Conventional; auto-excluded from the
   zip (not in the allowlist), so no R4 impact.

6. **Narrow `.gitignore` rule.** `/piano-block.zip` (not `*.zip`) avoids hiding
   future legitimate zips. If versioned filenames are later adopted (out of scope),
   broaden to `/piano-block*.zip`.

## Explicitly out of scope (per spec)

- **CI / release automation** — the command is CI-friendly (R1) so it *can* be
  wired into GitHub Actions or a Release later, but wiring it is separate work. No
  `.github/` exists today.
- **Filename versioning** — the artifact is the unversioned `piano-block.zip`. If
  `piano-block.{version}.zip` is later adopted, the PHP header `Version:` is the
  source of truth, and the `.gitignore` rule would broaden accordingly.
- **WordPress.org submission readiness** — no `readme.txt` (the WP.org format) is
  produced or validated. `README.md` is shipped; WP.org packaging is not in scope.
- **Keeping `package.json` `version` and the PHP header `Version:` in sync** — no
  mechanism exists or is required (relevant only under filename versioning).
- **Auto-detecting arbitrary non-standard future top-level runtime paths** (e.g. a
  hypothetical `assets/` or `data/` outside the standard layout). The command
  covers the standard layout globs (R7); novel non-standard paths remain the
  maintainer's responsibility. "Without manually selecting files" means no per-run
  file picking and zero edits for standard-layout growth — not omniscient
  future-proofing.
