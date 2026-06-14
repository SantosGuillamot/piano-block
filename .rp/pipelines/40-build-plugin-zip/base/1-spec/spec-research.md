# Spec Research — Build a distributable plugin zip (issue #40)

## Goal (from intent)

A maintainer can produce a distributable plugin zip that contains only the files
needed to run the Piano Block plugin in WordPress — excluding development/source
files, config, and tooling — without manually selecting files.

The wp-movies-demo `build-plugin.js` script is recorded as an **open direction to
explore, not a requirement**. Alternatives (`wp-scripts plugin-zip`, WP-CLI) are
open. The spec must capture the owner's intent, not silently substitute a goal.

## Method

Iterative Q&A with the `spec-researcher`, one question at a time. This record
tracks open questions, answers (with evidence), and decisions. Architecture and
implementation are deferred to later phases — this phase stays at the
requirements / acceptance-criteria altitude.

## Known starting context (from my own read of the repo)

- Plugin is `@wordpress/scripts`-based (`package.json` scripts: `build`, `start`,
  test, lint via Biome, `wp-env`).
- Runtime entrypoint `piano-block.php` calls `register_block_type( __DIR__ . '/build' )`
  and `wp_set_script_translations( ..., __DIR__ . '/languages' )`.
- `.gitignore` ignores `node_modules/`, `/build/`, e2e artifacts, logs, `.env*`,
  OS/editor noise, `.claude/`, `.rp.local.md`.
- Repo top-level also has: `README.md`, `AGENTS.md`, `biome.json`,
  `playwright.config.js`, `.wp-env.json`, `.nvmrc`, `package.json`,
  `package-lock.json`, `docs/`, `specs/`, `src/`.
- `package.json` is `"private": true`; no existing zip/dist script.

## Open questions

All resolved. Four questions (Q1–Q4) were asked and answered with evidence; see the
Q&A log and the consolidated Decisions / Out-of-scope sections below. No open
requirement-level questions remain. The two genuinely owner-preference items
(filename versioning; `dist/` vs root output) are defaulted with the owner's
override noted, not left open.

## Q&A log

### Q1 — Exact runtime file/directory inventory (IN vs OUT) — ANSWERED

Asked the researcher to produce an evidence-backed, file-by-file split:
- **IN (required to run):** verify `build/` contents after `npm run build`
  (block.json, render.php, *.js/*.css/*.asset.php), whether `block.json`'s
  `render` points at a PHP file that must ship, whether `languages/` exists and
  whether the plugin runs without it, whether a `readme.txt`/`README.md` is
  expected, and whether anything in `src/` is consumed at runtime.
- **OUT (dev/source/config/tooling):** confirm `src/`, `node_modules/`,
  `package*.json`, `biome.json`, `playwright.config.js`, `.wp-env.json`,
  `.nvmrc`, `docs/`, `specs/`, tests/e2e artifacts, `.github/`, dotfiles — and
  flag any genuinely ambiguous item.

_Status: ANSWERED._

**Findings (evidence: researcher ran `npm install && npm run build`):**

**IN (minimal correct runtime payload):**
- `piano-block.php` — entry/main plugin file.
- `build/**` — entire dir, **gitignored** so absent on clean checkout; MUST be
  built before zipping. After build, 9 files: `block.json`, `render.php`
  (block.json `render` points at it — must ship; source is `src/render.php`,
  copied verbatim), `index.js`, `view.js`, `style-index.css`,
  `style-index-rtl.css`, `index.asset.php`, `view.asset.php` (dep/version
  manifests — omitting breaks enqueue), and `build/fonts/pb-music.*.woff2`
  (notation font — needed for glyphs).
- `README.md` — runtime-optional (nice-to-have).
- `languages/` — does NOT exist today; `wp_set_script_translations` with a
  missing path is a harmless no-op, plugin runs fine without it. "Include if
  present," not required now.

**OUT (confirmed present, none loaded at runtime):** `src/` (JSX/SCSS + `__tests__/`
+ `OFL.txt` + raw `.woff2`), `node_modules/`, `specs/` (Playwright e2e), `docs/`,
`package.json`, `package-lock.json`, `biome.json`, `playwright.config.js`,
`.wp-env.json`, `.nvmrc`, `.gitignore`, `AGENTS.md`, `.rp*`, `.claude/`, e2e/test
artifacts (`artifacts/`, `test-results/`, `playwright-report/`, `*.log`, `.env*`,
`.DS_Store`, `.idea/`, `.vscode/`). No `.github/` exists today.

**Three ambiguities raised for the spec to resolve:**
1. **README inclusion** — runtime-optional; decide ship `README.md` / future
   `readme.txt` / both / neither. (No `readme.txt` exists; WP.org submission
   readiness is a separate, currently-unmet concern.)
2. **`languages/`** — "include if present," not required now.
3. **Single top-level root folder** — conventional installable WP zip wraps all
   files under one folder named after the plugin slug (`piano-block/…`). Spec may
   want to require this.

### Q2 — Do candidate approaches satisfy "without manually selecting files"? — ANSWERED

Not a tool-selection question (that's design). Asked the researcher to characterize,
for each candidate, whether file inclusion is an **allowlist (opt-in, manual to
extend)** vs **denylist/auto-derive (opt-out, self-maintaining)**, and whether a
build step is handled or assumed:
1. `wp-scripts plugin-zip` (already a devDep) — how it decides includes/excludes
   (`files`/`.distignore`/headers/`block.json`?), build-first or zip-on-disk,
   default output (single slug root folder? filename/version?), and whether dev
   files are excluded out of the box.
2. wp-movies-demo `build-plugin.js` — confirm explicit allowlist; characterize the
   maintenance burden of extending it.
3. WP-CLI `wp dist-archive` — include/exclude mechanism (`.distignore`?),
   environment prerequisites.

_Status: ANSWERED._

**Findings (evidence: researcher read each tool's source and ran `plugin-zip`):**

- **`wp-scripts plugin-zip`** (already a devDep): hybrid — fixed tool-maintained
  allowlist of *globs* (`build/** languages/** {name}.php block.json readme.* …`),
  auto-derives files within them. With no `files` field (our case) new files under
  `build/` are auto-included, zero edits. **Does NOT build** — zips on-disk only;
  on a clean checkout (no `build/`) it **silently** produced a zip with just
  `piano-block.php` + `README.md`, omitting the whole block, no error. Output:
  single slug root folder (`piano-block/…`), filename `{slug}.zip` — **no version**.
  Dev/config excluded by default (verified: zip had only `piano-block.php`,
  `README.md`, `build/**`). Meets goal out of the box for this layout *if build
  runs first*. Lowest maintenance.
- **wp-movies-demo `build-plugin.js`**: explicit hand-maintained allowlist. Low
  per-run effort but the allowlist is a curated artifact that drifts when the
  runtime surface changes (new top-level entry -> edit script). Does NOT build; no
  root folder upstream (would need adapting). More bespoke code to own.
- **WP-CLI `wp dist-archive`**: denylist via `.distignore` with **NO built-in
  defaults** — absent `.distignore`, it warns and includes *everything*. Does NOT
  build (worse here: would ship `src/`+config and omit absent `build/`). Heaviest
  env requirement (install WP-CLI + the package; WP-CLI >= 2.13) — not in this
  repo's Node/npm+Docker toolchain. Native **versioned** filename
  (`{name}.{version}`). Denylist is more drift-prone for this repo.

**Tool-agnostic spec-level takeaways:**
1. **Build-first is a HARD requirement, not a tool detail.** None of the three
   builds on its own; `build/` is gitignored/absent on clean checkout. Spec must
   require the zip is produced from a *fresh build* (or fails loudly if `build/`
   missing) — else the artifact silently lacks the block. Biggest correctness risk.
2. **Allowlist vs denylist is a real spec choice:** allowlist = dev/config excluded
   by default (safe-by-omission), new top-level runtime files need awareness;
   denylist = everything ships unless ignored (forgotten ignore silently leaks dev
   files). For a plugin whose runtime payload is `build/` + one PHP file, allowlist
   is lower-risk.
3. Spec can **require the behaviors** (auto-derived includes, dev/config excluded,
   build-first, single slug root folder, optionally versioned filename) WITHOUT
   naming the tool — tool choice stays in design.
4. **Versioned filename** is native only to WP-CLI today; the other two emit
   unversioned `{slug}.zip` (would need a rename step). Spec should DECIDE whether
   the artifact name must carry the version.

### Q3 — Maintainer-facing interface + operational acceptance details — ANSWERED

Asked for evidence-backed WP/wp-scripts conventions (and which items are genuine
owner-preference) for:
1. **Invocation surface** — new `package.json` script; community-standard name
   (does `@wordpress/create-block` scaffold a `plugin-zip` script?).
2. **Output location & filename** — repo root vs `dist/`/`release/` (gitignored?);
   `{slug}.zip` vs `{slug}.{version}.zip`; version source of truth given it lives
   in both `piano-block.php` header and `package.json` — divergence risk.
3. **Reproducibility / overwrite** — overwrite vs append/error; cleaning stale
   `build/` so removed files don't linger.
4. **Observable success signal** — exit 0 + zip whose contents are the runtime
   payload (assert IN files present, OUT files absent); is "installs cleanly in
   WordPress" practically CI-testable here (wp-env) or is content-assertion the
   realistic acceptance bar?
5. **CI vs local** — is the "command" local, a CI/release step, or both; confirm
   CI wiring is likely out-of-scope.

_Status: ANSWERED._

**Findings (evidence: wp-scripts handbook, create-block scaffold, local
`node_modules/@wordpress/scripts/scripts/plugin-zip.js` source):**

1. **Invocation — CLEAR DEFAULT: npm script named `plugin-zip`** (`npm run
   plugin-zip`). `@wordpress/create-block` scaffolds exactly
   `"plugin-zip": "wp-scripts plugin-zip"` by default; this repo's `package.json`
   was hand-trimmed and lacks it. Non-standard names (`build:zip`, `plugin:zip`)
   should be avoided. Build-chaining (`npm run build && <zip>`) recommended as a
   requirement given the silent-omission risk, while keeping the script *name*
   `plugin-zip`.
2. **Output location — CLEAR DEFAULT: repo root.** `plugin-zip` hardcodes
   `./{name}.zip` (no configurable output dir); `dist/`/`release/` is bespoke.
   **Gitignore gap (verified):** current `.gitignore` has NO `*.zip`/`piano-block.zip`
   rule — spec should require adding one so the artifact isn't committed.
   **Filename — DEFAULT `{slug}.zip` (unversioned)**; version suffix is
   owner-preference (native only via WP-CLI/rename). **Single `piano-block/` root
   folder = CLEAR REQUIREMENT** (WordPress expects it for updates; `plugin-zip`
   does it by default). **Version source-of-truth = PHP header `Version:`** (what
   WordPress reads; `package.json` version is npm metadata, package is `private`);
   the two can drift (no sync mechanism) — relevant only if filename is versioned.
3. **Reproducibility — DEFAULT idempotent overwrite** (`plugin-zip` overwrites
   `./{name}.zip`; no append/error). **Stale `build/` = real correctness
   requirement:** `wp-scripts build` does a clean rebuild (webpack `output.clean`),
   so chaining `npm run build` ensures removed files don't linger in the zip —
   reinforces build-first.
4. **Success signal — CONTENT-ASSERTION is the realistic acceptance bar:** exit 0
   + zip at known path + unzip and assert PRESENT (`piano-block/piano-block.php`,
   `piano-block/build/{block.json,render.php,index.js,view.js,style-index.css,
   index.asset.php,view.asset.php}`, and a `*.woff2` under `piano-block/build/fonts/`
   — assert the dir contains a woff2 rather than the exact content-hashed name) and
   ABSENT (`src/`, `node_modules/`, `package*.json`, `biome.json`,
   `playwright.config.js`, `.wp-env.json`, `specs/`, `docs/`, dotfiles). "Installs
   cleanly into WordPress" is testable via wp-env but heavyweight and largely
   re-covered by existing e2e specs; recommend content-assertion as the bar,
   install-clean as optional.
5. **CI vs local — SCOPE: the command itself; CI/release wiring OUT (recommended).**
   Intent title is "Add a *command*"; deliverable is the locally-runnable
   `npm run plugin-zip` + its correctness. No `.github/` exists today. Spec should
   require the command be CI-friendly (deterministic, correct exit code,
   non-interactive) so it *can* later drop into CI, without requiring the CI wiring.

**Default / preference ledger (researcher's recommendation):**
- **Clear defaults (spec can require):** script named `plugin-zip`; build-first
  (fresh `build/`); single `piano-block/` root folder; output `piano-block.zip` at
  repo root; idempotent overwrite; gitignore the zip; exit-0 + content assertions.
- **Owner-preference (flag in spec):** version suffix in filename (default: no; if
  yes -> PHP header is source of truth); `dist/` vs root output (default: root);
  whether to also assert clean WP install (default: no).
- **Recommend OUT of scope:** CI/release automation; WordPress.org `readme.txt`
  readiness; keeping `package.json` and PHP versions in sync.

### Q4 — Drift edge + completeness sweep of current runtime surface — ANSWERED

Final question before converging. Two narrow asks:
(a) **Completeness sweep:** confirm today's runtime surface is exactly
   `piano-block.php` + `build/**` (+ optional `README.md`, + absent `languages/`)
   — check for a second top-level `.php`, `uninstall.php`, an `includes/`-style PHP
   dir, top-level assets referenced outside `build/`, or any `block.json`/`render.php`
   path pointing outside `build/`.
(b) **Drift boundary:** is it sound to scope the requirement to "the zip contains
   exactly the runtime files that exist TODAY, verified by content-assertion" and
   treat auto-detecting arbitrary future top-level runtime files as a non-goal — or
   is requiring "covers the standard plugin-layout globs (`{slug}.php`, `build/`,
   `languages/`, `block.json`, `readme.*`, `uninstall.php`)" a sensible low-cost
   guard vs over-engineering?

_Status: ANSWERED._

**Findings (evidence: researcher verified against the tracked tree):**

(a) **Runtime surface is FULLY contained in `piano-block.php` + `build/**`. No
   exceptions.** Checks run:
   - Only two tracked PHP files: `piano-block.php` (root) and `src/render.php`
     (ships as `build/render.php`). NO second top-level `.php`, NO `uninstall.php`
     anywhere, NO `includes/`-style PHP dir.
   - `piano-block.php` has exactly two `__DIR__` refs: `/build` and `/languages`.
     Nothing else (no `plugins_url`, no other require/include).
   - `render.php` is self-contained — zero external file refs (only inline HTML).
   - `block.json` `file:` refs all resolve INSIDE `build/` (`./index.js`,
     `./view.js`, `./style-index.css`, `./render.php`); no `../`/absolute escape.
   - No top-level assets; the notation font lives at `build/fonts/pb-music.*.woff2`
     (inside `build/`). Only top-level json/asset-glob matches are config (OUT).
   ⇒ An allowlist keyed on `{slug}.php` + `build/**` captures 100% of today's surface.

(b) **Drift boundary — adopt the honest-but-guarded framing (researcher endorses).**
   Firm acceptance bar = "the zip contains exactly the runtime files that exist
   TODAY (`piano-block.php` + `build/**`, plus `README.md`/`languages/` if present),
   verified by content-assertion," with "auto-detecting arbitrary future top-level
   runtime files" as an explicit **non-goal**. PLUS a free guard: require the include
   set to cover the **standard wp-scripts/Plugin-Handbook layout globs** — at minimum
   `{slug}.php`, `build/**`, `languages/**`, `block.json`, `readme.*`, `uninstall.php`,
   `changelog.*`, `license.*`, and `admin/ includes/ public/`. Rationale: this glob
   set is *literally* `wp-scripts plugin-zip`'s built-in default allowlist (Q2), so
   it costs zero extra config and isn't tool-specific; it future-proofs the two most
   likely additions for THIS plugin (a real `languages/` dir, an `uninstall.php`)
   without script edits. It does NOT attempt to detect arbitrary novel top-level
   dirs — that stays the non-goal and the maintainer's responsibility. Requiring
   "detect any future runtime file" would be the over-engineering line; this guard
   stops short of it.

## Decisions

Defensible defaults adopted from the evidence (Q1–Q4). Items marked _(owner-pref)_
are choices I'm defaulting on the researcher's recommendation; the spec will state
the default and note them as revisable by the owner.

- **D1. Invocation:** a single npm script `plugin-zip`, run as `npm run plugin-zip`,
  producing the zip non-interactively (CI-friendly: deterministic, correct exit
  code).
- **D2. Build-first (hard):** the command produces the zip from a freshly built
  `build/` (chains/guarantees `npm run build`, which clean-rebuilds), so the
  artifact never silently lacks the block or carries stale files. If `build/` is
  somehow absent at zip time the command must fail loudly, not emit an incomplete
  zip.
- **D3. Contents — IN:** `piano-block.php`, the entire `build/` tree (block.json,
  render.php, index.js, view.js, style-index.css, style-index-rtl.css,
  index.asset.php, view.asset.php, fonts/*.woff2), `README.md`, and `languages/`
  *if it exists*. Auto-derived (allowlist-style, safe-by-omission) — no per-run
  manual file selection.
- **D4. Contents — OUT:** all dev/source/config/tooling — `src/`, `node_modules/`,
  `package.json`, `package-lock.json`, `biome.json`, `playwright.config.js`,
  `.wp-env.json`, `.nvmrc`, `.gitignore`, `AGENTS.md`, `specs/`, `docs/`, `.rp*`,
  `.claude/`, e2e/test artifacts, dotfiles, OS/editor noise.
- **D5. Structure:** everything wrapped under a single top-level folder named after
  the plugin slug, `piano-block/`.
- **D6. Output artifact:** `piano-block.zip` at the repo root; re-running overwrites
  it idempotently. The zip path/pattern is added to `.gitignore`.
- **D7. Filename versioning** _(owner-pref)_: default UNVERSIONED (`piano-block.zip`).
  If versioned later, the PHP header `Version:` is the source of truth.
- **D8. Acceptance bar:** exit 0 + a zip at the known path whose unzipped contents
  satisfy the IN-present / OUT-absent assertions (D3/D4/D5). "Installs cleanly into
  WordPress" is an optional stronger check, not the required bar. Concrete
  assertions: PRESENT `piano-block/piano-block.php`, `piano-block/build/block.json`,
  `.../render.php`, `.../index.js`, `.../view.js`, `.../style-index.css`,
  `.../index.asset.php`, `.../view.asset.php`, and a `*.woff2` under
  `piano-block/build/fonts/` (match the dir contains a woff2, not the exact
  content-hashed name); ABSENT any `src/`, `node_modules/`, `package*.json`,
  `biome.json`, `playwright.config.js`, `.wp-env.json`, `specs/`, `docs/`, dotfiles.
- **D9. Drift guard (free, low-cost):** the include set must cover at least the
  **standard wp-scripts/Plugin-Handbook plugin layout** — `{slug}.php`, `build/**`,
  `languages/**`, `block.json`, `readme.*`, `uninstall.php`, `changelog.*`,
  `license.*`, and `admin/ includes/ public/` — so the likely future additions for
  this plugin (a real `languages/` dir, an `uninstall.php`) are auto-included without
  edits. This is `wp-scripts plugin-zip`'s built-in default allowlist, so it costs
  nothing and is not tool-specific. Auto-detecting *arbitrary, non-standard* future
  top-level runtime paths is explicitly NOT required (see Out of scope).

## Out of scope

- **CI / release automation** (e.g. building the zip in GitHub Actions, attaching
  it to a GitHub Release on tag). No `.github/` exists today; the command must be
  CI-friendly so it *can* later be wired in, but wiring it is a separate concern.
- **WordPress.org submission readiness** — there is no `readme.txt` (WP.org format);
  producing/validating one is a separate, currently-unmet concern.
- **Keeping `package.json` `version` and the PHP header `Version:` in sync** — no
  mechanism today; out of scope unless filename versioning is adopted.
- **Choosing the specific tool/implementation** (`wp-scripts plugin-zip` vs a
  bespoke `archiver` script vs WP-CLI) — deferred to the design phase; the spec
  requires *behaviors*, not a tool.
- **Auto-detecting arbitrary, non-standard future top-level runtime files/dirs**
  (e.g. a hypothetical `assets/`/`data/` outside the standard plugin layout). The
  command covers the standard layout globs (D9); wiring in novel non-standard
  top-level runtime paths is the maintainer's responsibility. This keeps the
  "without manually selecting files" requirement honest — it means no per-run file
  picking and zero edits for standard-layout growth, not omniscient future-proofing.
