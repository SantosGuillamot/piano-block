# Design Research — Build a distribution-ready plugin zip

> Driving record for the design phase of GitHub issue #40 (Piano Block plugin).
> Spec: `../1-spec/spec.md`. Intent: `../0-intent/intent.md`.
> This file tracks open questions, the researcher's evidence, and the decisions
> made on that evidence (with rationale and trade-offs).

## Context snapshot

- Plugin uses `@wordpress/scripts` `^32.3.0` and an npm toolchain.
- Existing npm scripts include `build` (`wp-scripts build`); no `plugin-zip` yet.
- `build/` is gitignored, generated, and present after a build.
- Repo root contains the standard scaffold: `piano-block.php`, `build/`, `src/`,
  `README.md`, `package.json`, `package-lock.json`, `biome.json`,
  `playwright.config.js`, `.wp-env.json`, `.nvmrc`, `.gitignore`, `AGENTS.md`,
  `docs/`, `specs/`, `.rp*`, `node_modules/`.
- `.gitignore` has no `*.zip` / `piano-block.zip` rule today.

## Open questions

- **Q1 (ANSWERED)** — `wp-scripts plugin-zip` real behavior. See evidence log.
- **Q2 (ANSWERED)** — R2 guard implementation. See evidence log + D2.
- **Q3 (ANSWERED)** — `.gitignore` rule wording (R6/AC7) + full AC1–8 sweep.
  Researcher found NO gaps. See evidence log + D3 + AC coverage table.

**Design status: COMPLETE.** All requirements R1–R7 and acceptance criteria
AC1–AC8 are covered by decisions D1 (built-in tool), D2 (chain + Node guard),
and D3 (gitignore rule). No open questions remain.

## Evidence log

### Q1 — `wp-scripts plugin-zip` real behavior (researcher, verified live)

Source read: `node_modules/@wordpress/scripts/scripts/plugin-zip.js`. Tool stack:
`adm-zip` + `fast-glob` + `npm-packlist`. Live experiments run on a realistic
temp tree (with `src/`, `node_modules/`, configs, `.DS_Store`, `.vscode`, `docs/`,
`specs/`, etc.) using the installed `@wordpress/scripts@32.3.0`.

- **Algorithm = allowlist (safe-by-omission).** When `package.json` has NO `files`
  field (true here), it uses the Plugin Handbook allowlist globs (case-insensitive):
  `admin/**`, `build/**`, `includes/**`, `languages/**`, `public/**`, `${name}.php`,
  `uninstall.php`, `block.json`, `changelog.*`, `license.*`, `readme.*`.
- **`files` field is honored.** If `package.json` has a `files` array, that npm-style
  allowlist is used instead of the default globs (via `npm-packlist`).
- **Root folder = `${name}/`** from `package.json` `name` → `piano-block/` (✓ R5).
- **Output = `./${name}.zip`** at cwd → `piano-block.zip` (✓ R6 path). `adm-zip`
  `writeZip` OVERWRITES, no append (✓ R6 idempotency).
- **Live include result (✓ R3):** exactly `piano-block.php`, `README.md`
  (matched `readme.*` case-insensitive), all of `build/**` including
  `build/fonts/*.woff2`.
- **Live exclude result (✓ R4):** ZERO forbidden files leaked — no `src/`,
  `node_modules/`, `package.json`, `biome.json`, `playwright.config.js`,
  `.wp-env.json`, `.nvmrc`, `.gitignore`, `AGENTS.md`, `docs/`, `specs/`,
  `.DS_Store`, `.vscode/`, `*.log`.
- **Conditional `languages/` (✓ R3 / AC8):** `languages/*.po` present → appears
  under `piano-block/languages/`; absent → omitted, still exits 0.
- **R7 standard layout satisfied for FREE:** the default globs ARE the spec R7 list
  (`admin/`, `includes/`, `public/`, `uninstall.php`, `changelog.*`, `license.*`,
  `readme.*`, `languages/**`, `build/**`, `${slug}.php`, `block.json`). Zero config.

**The one real gap — R2 (build-first + fail-loud):**
- `plugin-zip` does NOT run a build, and does NOT fail when `build/` is missing OR
  empty. In both cases it exited 0 and produced an INCOMPLETE zip (only
  `piano-block.php` + `README.md`). This violates R2 / AC2 directly.
- `wp-scripts build` uses webpack `output.clean` with `keep: /^(fonts|images)\//`,
  so JS/CSS/PHP are always rebuilt fresh; fonts/images persist by design (they are
  runtime payload, so this is fine for R2 "no stale files").

Researcher's leaning: adopt built-in `wp-scripts plugin-zip` (satisfies R3–R7 with
zero bespoke archiver maintenance); address R1+R2 with an npm script that chains
build, a non-empty-`build/` guard, then `wp-scripts plugin-zip`.

**Confirmed by an actual run in the real worktree** (`build/` present, installed
v32.3.0): exit 0, single root `piano-block/`, `piano-block.zip` at worktree root,
exactly 11 entries (all AC5 files present incl. a `build/fonts/*.woff2`), and a
grep of the entry list confirmed NONE of `src/`, `node_modules/`, `package.json`,
`package-lock.json`, `biome.json`, `playwright.config.js`, `.wp-env.json`,
`.nvmrc`, `.gitignore`, `AGENTS.md`, `docs/`, `specs/`, `.rp*`, `.claude/`,
`.DS_Store`, `.idea/`, `.vscode/`, `.env*` leaked. Generated zip cleaned up.

Additional source-confirmed facts:
- **Slug source = `package.json` `name`** (read via `read-pkg-up` from cwd), NOT the
  directory name and NOT `block.json`. So `name: "piano-block"` is what drives both
  the root folder and the output filename.
- **CRITICAL GOTCHA — do NOT add a `files` field to `package.json`.** The tool
  branches on `hasPackageProp('files')`: present → it ignores the Plugin-Handbook
  globs and uses `npm-packlist` instead (which also honors `.npmignore`). The repo
  has no `files` field today, so it uses the safe glob allowlist. Adding `files`
  for any reason would silently change what's included. Design must explicitly rely
  on the default globs and forbid introducing a `files` field.
- **Flags exist but we use none.** `--root-folder <x>` / `--no-root-folder` can
  override the root; bare `wp-scripts plugin-zip` is correct for us given
  `name=piano-block` and cwd=repo root.

### Q2 — R2 guard implementation (researcher, all sub-questions live-tested)

1. **Chain `&&` propagates exit codes (tested).** `<build> && <guard> && wp-scripts
   plugin-zip` short-circuits; npm passes the EXACT inner non-zero code through (a
   stage exiting 7 → outer 7; guard exiting 1 → 3rd stage never runs, outer 1). A
   real build failure (syntax-error `src/index.js`) → `wp-scripts build` exit 2,
   aborting the chain. AC1's 0/non-zero contract holds.
2. **Build step = `npm run build` (not inlined `wp-scripts build`).** Single source
   of truth: the repo already defines `"build": "wp-scripts build"`; reusing it
   means the zip command tracks any future change to how the plugin builds. Cost is
   one short-lived npm process; exit code still propagates; same env. Inlining would
   risk drift.
3. **Guard asserts `build/block.json` exists (NOT bare "dir non-empty") — load-
   bearing nuance.** `wp-scripts build` keeps `build/fonts/` across builds
   (`output.clean` `keep:/^(fonts|images)\//`), so a wiped/partial build can leave
   `build/fonts/*.woff2` while the block is gone — a bare directory-non-empty check
   would PASS a broken build and ship a blockless zip. `build/block.json` is the
   right keystone: `piano-block.php` calls `register_block_type(__DIR__.'/build')`,
   which loads `build/block.json`, which references `index.js`/`view.js`/
   `style-index.css`/`render.php` via `file:./`. Its presence means a successful
   build ran and emitted what it points at. Asserting each JS/PHP file individually
   is more brittle for little gain (they're produced atomically alongside
   block.json). **Tested 4 cases:** full build → 0; `build/` missing → 1; `build/`
   empty → 1; partial (fonts present, no block.json) → 1 (the dangerous case is
   caught).
4. **Mechanism = committed Node guard `node scripts/check-build.js`** (over inline
   `node -e` and over shell `test`). Shell `[ -f build/block.json ]` is POSIX-only
   and breaks on Windows `cmd`; the Node guard is cross-platform (Node>=24 already
   required), readable, gives a clear actionable stderr message, is unit-testable,
   and `process.exit(1)` on failure. `scripts/` does not exist today (new file).
5. **No race vs `output.clean` (source-confirmed).** `wp-scripts build` runs as a
   SYNCHRONOUS `spawn.sync('node', …, {stdio:'inherit'})` then `exit(status)`;
   webpack clean+emit all complete before that process exits. With `&&`, the guard
   only starts after the build process has fully exited 0, so it always sees the
   final, fully-populated `build/`. The clean window is invisible to the next stage.
6. **No `plugin-zip` flags needed (source-confirmed).** `plugin-zip.js` only reads
   `--root-folder` / `--no-root-folder`; we want the defaults (root `piano-block/`
   from `name`, output `./piano-block.zip` at cwd). Run bare from repo root.

**End-to-end validation in the real worktree:**
- POSITIVE: `node scripts/check-build.js && wp-scripts plugin-zip` (build present)
  → chain exit 0, `piano-block.zip` created, 11 entries, all under `piano-block/`.
- NEGATIVE: removed `build/`, ran the same → guard printed its error, chain exit 1,
  and NO zip was produced (short-circuited before plugin-zip). Restored & cleaned up.

**Recommended artifacts:**
- `package.json` script:
  `"plugin-zip": "npm run build && node scripts/check-build.js && wp-scripts plugin-zip"`
- `scripts/check-build.js`: resolve `build/block.json` from `process.cwd()`; if
  absent, write a clear message to stderr and `process.exit(1)`; else exit 0. (Full
  body in the researcher's Q2 message; uses only `node:fs`/`node:path`, no deps.)

### Q3 — `.gitignore` rule + AC1–8 verifiability sweep (researcher, live-tested)

**Current `.gitignore` (verbatim):** anchored patterns for root-generated artifacts
(`node_modules/`, `/build/`, `/artifacts/`, `/test-results/`, `/playwright-report/`)
plus unanchored broad-class noise (`*.log`, `npm-debug.log*`, `.env`, `.env.*`,
`.DS_Store`, `Thumbs.db`, `*.swp`, `.idea/`, `.vscode/`, `.claude/`, `.rp.local.md`).
No `*.zip` / `piano-block.zip` rule today.

- **Zip rule decision = anchored `/piano-block.zip`** (NOT broad `*.zip`):
  - Zero `.zip` files are tracked or on disk in the repo today, so `*.zip` wouldn't
    wrongly hide anything now — but it's broader than needed and would silently
    swallow any future legitimate zip (e.g. a test fixture).
  - House style: root-generated artifacts are ANCHORED (`/build/`, `/artifacts/`,
    …); only "appears-anywhere" noise is unanchored. The zip is a single named
    artifact written at the repo root (`./piano-block.zip`) — exactly the `/build/`
    case. Anchored + named matches the style and reveals intent.
  - **Live AC7 test:** appended `/piano-block.zip`, ran plugin-zip,
    `git check-ignore -v piano-block.zip` matched, `git status --short` did NOT list
    the zip. Reverted/cleaned. AC7 holds.
- **AC8 / guard independence (confirmed):** `scripts/check-build.js` references ONLY
  `build/block.json` — never reads/requires/mentions `languages/`. `languages/` is
  purely additive via the `languages/**` glob (present → included; absent → omitted,
  exit 0). Both branches verified. Guard is indifferent.
- **AC6 leak-free THROUGH THE CHAIN (the key confirmation asked for):** the build
  and guard stages add NOTHING archivable to the tree — `npm run build` only
  (re)writes `build/**` (already an included location), and the guard only READS
  `build/block.json` (writes nothing, creates no files). So the chain's archivable
  tree is identical to bare `plugin-zip`'s; the leak-free result holds through the
  full chain.
- **Clean-checkout handling:** nothing assumes a pre-existing `build/`. On a clean
  checkout `build/` is absent (gitignored); `npm run build` runs FIRST and creates
  it from `src/`, THEN the guard checks `build/block.json`. If the build fails →
  `npm run build` exits non-zero (chain aborts before the guard); if it produced
  nothing → guard finds no block.json, exits 1. Either way fail-loud, no zip. Only
  assumption is the AC preamble's own "dependencies installed".
- **Explicit gap check: NO GAPS.** Every AC1–AC8 is covered by D1 + D2 + the
  `/piano-block.zip` rule. Nothing requires an undecided choice.

## Decisions

### D1 — Back the command with the built-in `wp-scripts plugin-zip` (not a bespoke archiver / not WP-CLI)

**Decision:** Use `@wordpress/scripts`' built-in `plugin-zip` as the archiving
engine. Do NOT write a bespoke `archiver`-based Node script (the wp-movies-demo
approach offered in the intent), and do NOT use WP-CLI `dist-archive`.

**Rationale (evidence-based):**
- It already satisfies R3, R4, R5, R6 (output name + clean overwrite), and R7 out
  of the box with **zero configuration** — verified by reading the v32.3.0 source
  and by an actual run in this worktree (see evidence log).
- Its file selection is **allowlist / safe-by-omission**, which is exactly what
  R3/R4 demand ("exclusion is the default, not a hand-maintained denylist"). A
  bespoke `archiver` script would re-implement this and require ongoing maintenance
  of include lists.
- Its default globs ARE the spec R7 standard-layout set, so R7's drift guard is
  free and not tool-specific in spirit (it's the WP Plugin Handbook layout).
- It is already a transitive dependency (`@wordpress/scripts@^32.3.0`), so no new
  dependency and no version of `archiver` to track.

**Trade-offs / risks accepted:**
- It does NOT build first and does NOT fail on a missing/empty `build/` (R2 gap) —
  addressed by D2 (wrapper) below.
- It does NOT add the `.gitignore` rule (R6) — addressed separately (trivial).
- Coupling to a `@wordpress/scripts` internal command: acceptable because it is a
  documented, community-standard subcommand and the plugin is already fully bought
  into that toolchain.
- The `files`-field gotcha is a latent footgun; the design will explicitly forbid
  adding a `files` field and document why.

### D2 — Satisfy R1/R2 with a three-stage npm chain + a committed Node build-payload guard

**Decision:** Define the npm script as
`"plugin-zip": "npm run build && node scripts/check-build.js && wp-scripts plugin-zip"`
and add a new committed guard `scripts/check-build.js` that fails non-zero if
`build/block.json` is absent.

**Rationale (evidence-based):**
- **`npm run build` first (R2 build-first):** reuses the existing `build` script as
  the single source of truth for how this plugin builds, so the zip command tracks
  any future build change; `wp-scripts build` is synchronous and exits non-zero on
  failure, aborting the chain (tested).
- **`&&` chain (R1 exit codes):** npm propagates the exact inner non-zero code and
  short-circuits, so success → 0 and any stage failure → non-zero, with the archive
  step skipped on failure (tested). Non-interactive and deterministic.
- **Guard keyed on `build/block.json` (R2 fail-loud, AC2):** this is the keystone WP
  actually loads via `register_block_type(__DIR__.'/build')`; checking it (rather
  than "directory non-empty") correctly catches the partial-build case where stale
  `build/fonts/` survives `output.clean` but the block is gone — the exact silent-
  failure the spec warns about. Verified the guard catches missing/empty/partial and
  passes a full build.
- **Committed Node guard (R1 CI-friendly, portable):** cross-platform (Node>=24
  already required), readable, unit-testable, emits a clear stderr message, and uses
  only Node built-ins (`node:fs`/`node:path`) — no new dependency. Chosen over a
  POSIX shell `test` (not portable) and inline `node -e` (cramped, poor errors).

**Trade-offs / risks accepted:**
- The guard's single keystone (`build/block.json`) does not exhaustively verify every
  build artifact, but the build produces them atomically with block.json, and the
  alternative (assert each file) is more brittle for negligible gain. Accepted.
- One extra short-lived npm process from `npm run build` vs. inlining — negligible,
  and DRY is worth it.
- New top-level `scripts/` dir is introduced (none today); conventional and excluded
  from the zip automatically (not in the allowlist), so no R4 impact.

### D3 — Add an anchored `/piano-block.zip` rule to `.gitignore` (R6/AC7)

**Decision:** Append to `.gitignore`, matching the existing comment + anchoring style:

```
# Distribution artifact (generated by `npm run plugin-zip`)
/piano-block.zip
```

**Rationale (evidence-based):**
- Anchored + named matches house style: every root-generated artifact in this
  `.gitignore` is anchored (`/build/`, `/artifacts/`, `/test-results/`,
  `/playwright-report/`); only appears-anywhere noise is unanchored. The zip is a
  single named artifact at the repo root, so it belongs to the anchored class.
- Chosen over broad `*.zip` to avoid silently hiding any future legitimate zip
  (e.g. a test fixture). No `.zip` is tracked or present today, so the narrow rule
  loses nothing now and is safer later.
- Live-tested: with the rule present, `git check-ignore` matches `piano-block.zip`
  and `git status` does not list it (AC7).

**Trade-off accepted:** if versioned filenames (`piano-block.{version}.zip`) are
adopted later (explicitly out of scope now), switch to `/piano-block*.zip` at that
time.

## Design summary (the shippable design)

`npm run plugin-zip` is defined as a three-stage chain plus a small committed guard,
relying on the built-in archiver, with one `.gitignore` line:

1. **`package.json` script:**
   `"plugin-zip": "npm run build && node scripts/check-build.js && wp-scripts plugin-zip"`
2. **New file `scripts/check-build.js`:** Node guard (built-ins only) that exits 1
   with a clear stderr message if `build/block.json` is absent; else exits 0.
3. **`.gitignore`:** add the anchored `/piano-block.zip` rule (D3).
4. **Do NOT** add a `files` field to `package.json` (would flip `plugin-zip` to
   npm-packlist mode and change inclusion). Rely on the default Plugin-Handbook globs.

## Acceptance-criteria coverage (AC1–AC8 → how satisfied)

| AC | Criterion | How the design satisfies it | Verified |
|----|-----------|-----------------------------|----------|
| 1 | Invocation, exit 0, non-interactive | Single `plugin-zip` script; all 3 stages non-interactive; `&&` propagates exact exit codes (0 on success). | ✅ tested |
| 2 | Build-first / fail-loud on missing OR empty `build/` | `npm run build` runs first (synchronous); guard asserts `build/block.json`; missing/empty/partial all → exit 1 before archiving (no zip). | ✅ 4 cases tested |
| 3 | Artifact at root + idempotent overwrite | `plugin-zip` writes `./piano-block.zip` at cwd; `adm-zip` truncates/recreates — re-run = identical archive, no append. | ✅ tested |
| 4 | Single `piano-block/` root | Root folder = `package.json` `name` = `piano-block/`; every entry nested. | ✅ tested |
| 5 | Included files present | Real run included `piano-block.php`, all `build/**` (block.json, render.php, index.js, view.js, style-index.css, index/view.asset.php) + a `build/fonts/*.woff2`. | ✅ tested |
| 6 | Excluded files absent (through the chain) | Allowlist safe-by-omission; build only writes `build/**`, guard only reads — chain adds nothing archivable; leak check passed. | ✅ tested |
| 7 | Gitignore rule | Anchored `/piano-block.zip` (D3); `git status` clean of the zip. | ✅ tested |
| 8 | Conditional `languages/` | `languages/**` glob is additive; guard indifferent; present → included, absent → omitted + exit 0. | ✅ both branches tested |

## Carry-forward notes for the plan/code phases

- **Do NOT introduce a `package.json` `files` field** — it silently switches
  `wp-scripts plugin-zip` from the Plugin-Handbook globs to `npm-packlist` mode and
  changes what's included.
- **Guard keystone is `build/block.json`, deliberately not a bare directory-non-empty
  check** — `wp-scripts build` keeps `build/fonts/` across builds (`output.clean`
  `keep:/^(fonts|images)\//`), so a partial build can leave fonts while the block is
  gone; only the block manifest reliably signals a real build.
- **Run from repo root** so `./piano-block.zip` lands at the repo root (R6).
- **Bare `wp-scripts plugin-zip`** — no flags needed (defaults give the right root
  folder and output name/location).
