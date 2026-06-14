# Code Plan Review — APPROVED

> Issue #40 (Piano Block plugin) — "Build a distribution-ready plugin zip".
> Reviewed: `3-plan/code-plan.md` against `2-design-doc/design-doc.md` and
> `1-spec/spec.md`, sanity-checked against the real worktree.

## Verdict

**APPROVED.** The plan is complete, faithful to the design, correctly ordered,
feasible per task, and adequately tested. No blocking issues.

## What I verified against the repo

- **Existing npm scripts** (`package.json`): `build` = `wp-scripts build`,
  `test:unit` = `wp-scripts test-unit-js`, `test:e2e` = `wp-scripts
  test-playwright`. No `plugin-zip` script today; no `files` field; `name` is
  `piano-block`; Node `>=24`. The plan's stage-1 reuse of `npm run build`, the
  exact added script string, and the two explicit non-changes all match.
- **`register_block_type( __DIR__ . '/build' )`** in `piano-block.php:29` —
  confirms `build/block.json` is the genuine keystone WordPress loads, validating
  the guard's single-keystone choice (Task 1) over a "directory non-empty" check.
  `wp_set_script_translations(..., __DIR__ . '/languages')` (line 30-34) confirms
  the `languages/` context for AC8.
- **Existing tests** use ESM `import { readFileSync } from "node:fs"` /
  `import { join } from "node:path"` (`src/notation/__tests__/constants.test.js`)
  and `describe`/`it` co-located in `__tests__/`. Task 1's "factor a pure
  `checkBuild(cwd)` and import only `node:fs`/`node:path`" and Task 2's test style
  are faithful to the surrounding code.
- **`build/fonts/pb-music.5cb97431.woff2`** — content-hashed; the plan correctly
  asserts "a `.woff2`," never the exact hash (Task 5 step 4 / AC5).
- **No custom Jest config** in the repo root or `package.json`, so the
  `@wordpress/scripts` `jest-unit.config.js` default `testMatch` governs
  discovery. The plan's claim that a top-level `scripts/*.test.js` is picked up is
  the standard default, and the plan hedges responsibly: it offers
  `scripts/__tests__/` as an alternative and makes "confirm the new file appears
  in Jest's output" an explicit acceptance check (Task 2).
- **`.gitignore`** root-generated artifacts are all anchored (`/build/`,
  `/artifacts/`, `/test-results/`, `/playwright-report/`); appears-anywhere noise
  is unanchored. The plan's anchored `/piano-block.zip` rule with a comment
  matches the house style (Task 4).
- **Optional allowlist paths absent** (`changelog.*`, `license.*`,
  `uninstall.php`, `admin/`, `includes/`, `public/`) — the default globs no-op on
  them, consistent with R7 being free future-proofing. `.rp.md` / `.rp/` exist at
  root (matching the `.rp*` exclusion asserted in Task 5 step 5 / AC6).

## Completeness — every requirement and AC maps to a task

| Item | Task(s) |
|---|---|
| R1 (single command, exact name, CI exit codes) | Task 3; AC1 → Task 5 step 1 |
| R2 (build-first + fail-loud) | Tasks 1, 3; AC2 → Task 5 step 6 |
| R3 (included, allowlist) | Task 3; AC5 → Task 5 step 4 |
| R4 (excluded by default) | AC6 → Task 5 step 5 |
| R5 (single slug root) | AC4 → Task 5 step 3 |
| R6 (output + idempotency + gitignore) | Task 4; AC3 → Task 5 step 2; AC7 → Task 4 |
| R7 (standard-layout drift guard) | inherent in archiver; AC8 → Task 5 step 7 |
| AC1–AC8 | enumerated explicitly in Task 4 (AC7) and Task 5 steps 1–7 |

Every design decision is carried: three-stage chain (Task 3), keystone
`build/block.json` guard rather than non-empty check (Tasks 1, 2 case 4),
committed Node guard using only built-ins (Task 1), anchored `.gitignore` over
`*.zip` (Task 4), and both explicit non-changes — no `files` field, run
`wp-scripts plugin-zip` bare from repo root (Conventions + Task 3).

## Testing adequacy

- **Guard unit-tested** across all four design-verified states — full → ok,
  missing → not ok, empty → not ok, and the load-bearing partial-build case
  (`build/fonts/*` present, no `block.json`) → not ok (Task 2). The structure
  (pure `checkBuild(cwd)` + temp dirs, no `process.exit` in the import path)
  correctly avoids aborting the Jest worker.
- **Archive e2e-verified** for exit 0, single root, included set, excluded set,
  idempotent overwrite, the fail-loud integration path, and both `languages/`
  branches (Task 5). Nothing important is left untested.

## Ordering and feasibility

`1 → (2 ∥ 3) → 4 → 5` with deps 2←1, 3←1, 5←{1,3,4}. Correct: the guard precedes
both its test and the chain that references it; the integration gate runs last.
Each task is concrete and sized for one code-writer.

## Non-blocking notes (for the code-writer's awareness, not corrections)

- The Conventions "Dependencies" note describes the install state as "a
  partial/hoisted install was observed." In this worktree `@wordpress/scripts` is
  in fact **fully absent** from `node_modules` (no `wp-scripts` bin, no
  `scripts/plugin-zip.js`), not merely partial. This does not change anything: the
  operative instruction — run `npm install` once before invoking any
  `wp-scripts`-backed script (`build`, `plugin-zip`, `test:unit`) — is correct and
  necessary for the actual state. Flagged only so the code-writer expects a full
  install on first run, not a quick top-up.
- `build/style-index-rtl.css` exists but is intentionally **not** in the AC5
  required-files list — matching the spec's AC5 exactly (it lists it under R3's
  "including but not limited to" only). The plan is right to leave it out of the
  hard assertion.

All checks pass. Approved for the code phase.
