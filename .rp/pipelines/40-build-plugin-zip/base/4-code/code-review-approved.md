# Code Review 2 — APPROVED

> Issue #40 (Piano Block plugin) — "Build a distribution-ready plugin zip".
> Reviewed diff: `8f27bb1a58af4f8cc15e59d413900fe9f0a23943 → HEAD` (`e0b02c3`),
> excluding the pipeline artifacts under `.rp/pipelines/40-build-plugin-zip/`.
> Reviewed against the spec (R1–R7, AC1–AC8), the design doc, and the code plan.
> This is **review iteration 2**, after iteration 1 rejected and Tasks 2 (root
> cause Task 1) and 5 were re-dispatched.

## Verdict

**APPROVED.** All three findings from `code-review-1-rejected.md` are genuinely
resolved, the rework introduced no regression, and an independent full
adversarial pass over the whole batch (not just the deltas) confirms every
requirement and acceptance criterion holds. The product surface is exactly the
three design-authorized artifacts (`package.json` scripts, `scripts/check-build.js`,
`.gitignore`) plus the committed `scripts/` verification/guard helpers; the
previously-flagged global `babel.config.js` is gone.

---

## The three findings are resolved

### Finding 1 — Root `babel.config.js` scope creep → **resolved**

- **No `babel.config.js` exists** — neither on disk (`ls babel.config.js` →
  "No such file or directory") nor tracked (`git ls-files | grep -i babel` →
  empty). Commit `21bbbc6` deleted the 68-line file.
- **The guard is CommonJS.** `scripts/check-build.js` now uses
  `require('node:fs')` / `require('node:path')`, exports `checkBuild` via
  `module.exports`, and gates the CLI on `if ( require.main === module )`.
- **Importing the guard does not call `process.exit`.** Verified directly:
  `node -e "require('./scripts/check-build.js')"` returns normally and
  `checkBuild` is a function — so the Jest worker is never aborted.
- **The test file matches.** `scripts/check-build.test.js` imports via
  `require('./check-build')` (CommonJS), consistent with the guard. No Babel
  configuration is required for Jest to load either file.

### Finding 2 — `MODULE_TYPELESS_PACKAGE_JSON` warning → **resolved**

- `node scripts/check-build.js` with `build/block.json` present exits `0` and
  writes **nothing** to stderr (captured stderr to a file; it was empty). The
  per-run reparse warning is gone, restoring the clean CI signal R1 wants.
- The fix was the CommonJS conversion (not adding `"type": "module"` to
  `package.json`, which the rejection explicitly warned against). `package.json`
  has no `"type"` field and remains CommonJS-default.

### Finding 3 — Stale path in `verify-archive.mjs` header comment → **resolved**

- Commit `e0b02c3` corrected `scripts/verify-archive.mjs:7` from
  `node scripts/verify-archive.js` to `node scripts/verify-archive.mjs`. The
  documented invocation now matches the actual filename and copy-pastes cleanly.

---

## No regression from the rework (ran the suites)

- **`npm run test:unit`** (deps already installed; `wp-scripts` present):
  `scripts/check-build.test.js` is **discovered and PASSES all four cases**
  (full → ok, missing → not ok, empty → not ok, partial → not ok — the
  partial-build case with `build/fonts/inter.woff2` and no `block.json` asserts
  failure, the load-bearing case a "non-empty dir" check would wrongly pass).
  Overall: `405 passed, 1 failed`.
- **The single failure is the pre-existing, out-of-scope `layout.test.js`**
  floating-point assertion (`tempoLaneY` expected `3.8`, received `7.199…`).
  Confirmed it is **not** introduced by this batch: `git diff base → HEAD -- src/`
  is **empty** (this batch does not touch `src/` at all), and the failing
  assertion at `src/notation/__tests__/layout.test.js:2301` is byte-identical at
  the base ref `8f27bb1`. It is the documented Node-version environment issue
  (machine runs `v20.20.1`; `engines`/`.nvmrc` require `>=24`). Per the
  rejection's explicit instruction, **not re-flagged**.
- **`npm run plugin-zip`**: ran all three stages non-interactively and exited
  `0`. The Plugin Handbook discovery added exactly the runtime payload —
  `README.md`, `piano-block.php`, and `build/{block.json, index.asset.php,
  index.js, render.php, style-index-rtl.css, style-index.css, view.asset.php,
  view.js, fonts/pb-music.<hash>.woff2}` (11 entries) — and **no** `src/`,
  `node_modules/`, config, or `scripts/`.
- **`node scripts/verify-archive.mjs`**: **44 passed, 0 failed**, exit `0`.
  AC1 (exit 0), AC2 (guard exits 1 on absent keystone; zip **not** overwritten
  after a failed guard; `build/block.json` restored), AC3 (artifact at root +
  idempotent stable count), AC4 (single `piano-block/` root), AC5 (all required
  runtime files + a `*.woff2`, asserted by directory not exact hash), AC6 (none
  of the forbidden paths — `src/`, `node_modules/`, every named config,
  `scripts/`, dotfiles, OS noise — leak), AC7 (zip is git-ignored), AC8 (both
  `languages/` branches: absent today, and present → archived under
  `piano-block/languages/`, then throwaway removed).

---

## Full adversarial pass (whole batch, not only the deltas)

- **Three-stage chain is exact.** `package.json` `plugin-zip` is verbatim
  `npm run build && node scripts/check-build.js && wp-scripts plugin-zip`. Stage 1
  reuses the existing `build` script (single source of truth), stage 2 is the
  guard, stage 3 runs `wp-scripts plugin-zip` **bare** from the repo root. The
  `&&` makes the chain fail-closed (verified by AC2 — a missing keystone aborts
  before archiving and does not refresh the zip).
- **Guard checks `build/block.json` specifically** — `join(cwd, 'build',
  'block.json')` + `existsSync`, never `languages/` or a non-empty-directory
  check. Independent of conditional includes (AC8). The actionable stderr message
  names the file and tells the user to run the build.
- **`.gitignore`** has the anchored `/piano-block.zip` with its comment, grouped
  with the other root-generated artifacts; **no** broad `*.zip` rule.
  `git check-ignore -v piano-block.zip` → `.gitignore:13:/piano-block.zip`.
- **Explicit non-changes hold.** No `files` field anywhere in `package.json`;
  `name` is still `piano-block`; the **only** `package.json` delta is the single
  `plugin-zip` script line — no dependency/devDependency added, no `version`/
  `name`/`engines` touched. The guard and verifier use only Node built-ins.
- **Quality / readability.** `scripts/check-build.js` and
  `scripts/check-build.test.js` carry purpose-stating JSDoc headers matching the
  repo's house style; the factored pure `checkBuild(cwd)` + `require.main`
  CLI split is clean and the single source of the existence logic. No scope
  creep beyond the spec/design/plan.
- **Clean tree.** After all my runs: `git status --short` is empty — no committed
  `piano-block.zip` (ignored), no stray `languages/`, `build/block.json` restored,
  no leftover temp fixtures.

---

## Not a finding (recorded so it is not re-flagged)

- **`src/notation/__tests__/layout.test.js` floating-point failure** — pre-existing
  at the base ref `8f27bb1`, environment/Node-version related (`v20.20.1` vs the
  required `>=24`), and untouched by this batch (`src/` has zero diff). Out of
  scope for issue #40.

---

## Outcome

The batch satisfies R1–R7 and AC1–AC8 (44/44), the three review-1 findings are
fixed without regression, and the working tree is clean. **No re-dispatch.**
