# Code Plan — Build a distribution-ready plugin zip

> Issue #40 (Piano Block plugin).
> Spec: `../1-spec/spec.md` (R1–R7, AC1–AC8).
> Design: `../2-design-doc/design-doc.md`.
>
> This plan decomposes the design into ordered, independently verifiable tasks.
> The design is concrete: a three-stage `npm run plugin-zip` chain
> (`npm run build && node scripts/check-build.js && wp-scripts plugin-zip`), a
> committed `scripts/check-build.js` guard that checks `build/block.json`, an
> anchored `/piano-block.zip` `.gitignore` rule, and two explicit non-changes
> (no `files` field in `package.json`; run `wp-scripts plugin-zip` bare from the
> repo root). The plan introduces **no** design changes.

## Conventions for all tasks

- **Working tree:** the pipeline worktree
  `/Users/santosguillamot/Desktop/Code/SantosGuillamot/piano-block/.claude/worktrees/40-build-plugin-zip`.
  All paths below are relative to this root. Tasks share one tree and run
  sequentially.
- **Tooling:** the plugin uses `@wordpress/scripts`. Unit tests run via
  `npm run test:unit` (`wp-scripts test-unit-js`, Jest). Jest's default
  `testMatch` discovers `*.test.js` anywhere in the tree, so a top-level
  `scripts/*.test.js` is picked up alongside the existing `src/**/__tests__/*.test.js`.
  E2e runs via `npm run test:e2e` (Playwright) — **not used** by this work; the
  zip command is verified by direct invocation and an automated archive-content
  check, not Playwright.
- **Dependencies:** if `@wordpress/scripts` is not resolvable in the worktree's
  `node_modules` (a partial/hoisted install was observed), run `npm install`
  once before invoking any `wp-scripts`-backed script, so `npm run build`,
  `npm run plugin-zip`, and `npm run test:unit` resolve.
- **No new dependency** is added by any task. The guard uses only Node built-ins
  (`node:fs`, `node:path`). The archiver is the already-present `wp-scripts`.
- **Commit format:** imperative, sentence case, no trailing period, agent name in
  parentheses — e.g. `Add build-payload guard (code-writer)`. One commit per
  task unless a task says otherwise.
- **Explicit non-changes (design contract — must hold across every task):**
  - Do **NOT** add a `files` field to `package.json` (it would flip the archiver
    from the safe Plugin Handbook glob allowlist to `npm-packlist` mode and
    silently change inclusion — Design "explicit non-changes", risk #2).
  - Run `wp-scripts plugin-zip` **bare** (no flags) from the repo root; the cwd
    placement is what lands `./piano-block.zip` at the repo root and the
    `piano-block/` root folder (Design stage 3).

---

## Task 1 — Add the build-payload guard `scripts/check-build.js`

**Goal:** A committed, cross-platform, unit-testable Node guard that exits `1`
with a clear stderr message when the freshly built block is absent, else exits
`0`. This is stage 2 of the chain and the load-bearing fail-loud mechanism for
R2 / AC2.

**Files:**
- Create `scripts/check-build.js`.

**Changes:**
- Create a new top-level `scripts/` directory and `scripts/check-build.js` in it.
- The guard, using **only** `node:fs` and `node:path` (no new dependency):
  - Resolves the keystone path `build/block.json` relative to `process.cwd()`
    (e.g. `path.join(process.cwd(), 'build', 'block.json')`). It references
    **only** `build/block.json` — never `languages/` or any other path — so it
    stays independent of conditional includes (Design "behavioral contract";
    AC8).
  - Checks **existence of `build/block.json` specifically** — not a "directory
    is non-empty" check. This distinction is load-bearing: `wp-scripts build`
    uses `output.clean` with `keep: /^(fonts|images)\//`, so a wiped/partial
    build can leave `build/fonts/*.woff2` on disk while the block itself is gone;
    a "non-empty" check would pass that broken state and ship a blockless zip.
    Checking `build/block.json` catches it (Design stage 2; risk #3).
  - On **absence**: writes a clear, actionable message to **stderr** (name the
    missing file and tell the user to run the build, e.g.
    `build/block.json not found — run \`npm run build\` first.`) and calls
    `process.exit(1)`.
  - On **presence**: exits `0` (no required stdout).
- Add a short file-level comment matching the surrounding code's comment density
  and style (the `src/**` files carry purpose-stating header comments) that
  states the guard's role: assert the build produced the keystone `build/block.json`
  before archiving, and why `block.json` is the keystone (it is what
  `register_block_type(__DIR__ . '/build')` loads).
- **Structure for testability:** factor the decision so a unit test can exercise
  it without spawning a process and without killing the test runner — e.g.
  export a pure function such as `checkBuild(cwd)` that returns a result
  (boolean or `{ ok, message }`) and is the single source of the existence
  logic, then have a thin CLI section (guarded by a `require.main === module`
  /`import.meta`-equivalent check, or a tiny separate invocation) call it and map
  the result to the stderr-write + `process.exit`. Do **not** structure the file
  so that merely importing it calls `process.exit` (that would abort the Jest
  worker). Keep the module CommonJS or ESM consistent with how the repo's other
  Node-run scripts/tests import built-ins (existing tests use ESM `import` for
  `node:fs`/`node:path`); pick the form that the test in Task 2 can import
  cleanly and that `node scripts/check-build.js` can execute under the repo's
  Node ≥ 24.

**Depends on:** none.

**Traces to:**
- Spec R2 (build-first / fail-loud), AC2.
- Spec R1 (CI-friendly: deterministic, non-interactive, correct exit code).
- Design "Stage 2 — `node scripts/check-build.js`", "Why a committed Node guard",
  "`scripts/check-build.js` behavioral contract", risk #3, risk #5.

**Acceptance:**
- `scripts/check-build.js` exists and imports only `node:fs` / `node:path`
  (no third-party `require`/`import`; confirm no new entry was added to
  `package.json` dependencies).
- Manual behavioral check (run from the repo root):
  - With a real `build/block.json` present: `node scripts/check-build.js`
    exits `0` and prints nothing to stderr. (Verify exit code via
    `echo $?` / `$LASTEXITCODE`.)
  - Temporarily move/rename `build/block.json` (or point cwd at a tree without
    it): the guard exits `1` and prints the actionable message to **stderr**
    (not stdout). Restore `build/block.json` afterward so the tree is clean.
- The file carries a purpose-stating header comment consistent with the repo's
  comment style.
- (Automated coverage of these cases is added in Task 2; this task's manual
  check is the smoke test that the guard runs at all.)

---

## Task 2 — Unit-test the guard

**Goal:** Automated, runner-discovered unit tests that pin the guard's contract
across the four states the design verified, so the fail-loud behavior is
regression-protected.

**Files:**
- Create `scripts/check-build.test.js` (co-located with the guard;
  alternatively `scripts/__tests__/check-build.test.js` — either is discovered by
  Jest's default `testMatch`. Co-location is fine since `scripts/` holds no
  production source other than the guard).

**Changes:**
- Write Jest unit tests (matching the existing tests' style under
  `src/**/__tests__/` — `describe`/`it`, ESM `import`) that exercise the guard's
  pure decision function against a controlled filesystem location, so the tests
  do **not** depend on the repo's real `build/` state and do **not** call
  `process.exit`. Use a temp directory (e.g. `fs.mkdtempSync(os.tmpdir()...)`)
  to construct each fixture state, pass it as the `cwd` argument to the exported
  function, and assert the result. Cover the four design-verified cases:
  1. **Full build** — temp dir contains `build/block.json` → result is "ok"
     (the success branch; would exit `0`).
  2. **`build/` missing** — temp dir has no `build/` → result is "not ok"
     (would exit `1`).
  3. **`build/` empty** — temp dir has an empty `build/` directory → "not ok".
  4. **Partial build** — temp dir has `build/fonts/<something>.woff2` (or any
     `build/` file) but **no** `build/block.json` → "not ok". This is the
     dangerous case `output.clean keep: fonts` creates; it must fail.
- Assert that the "not ok" result carries a non-empty, actionable message
  (so the stderr text is contract, not incidental).
- Clean up temp directories after each test.

**Depends on:** Task 1 (the guard and its exported decision function must exist).

**Traces to:**
- Spec R2 / AC2; Design "The guard was verified against four cases" (full → 0,
  missing → 1, empty → 1, partial → 1), risk #3.

**Acceptance:**
- `npm run test:unit` (after `npm install` if needed) discovers and runs
  `scripts/check-build.test.js` and all four cases pass. (Confirm the new file
  appears in Jest's output — i.e. the runner actually picked it up, not silently
  skipped.)
- Running the full existing unit suite still passes (no regression to the
  `src/**/__tests__` tests).
- The partial-build case (4) is present and asserts failure — this is the
  specific case a "non-empty directory" check would wrongly pass.

---

## Task 3 — Wire the `plugin-zip` npm script (the three-stage chain)

**Goal:** Expose the single command `npm run plugin-zip` that builds first,
guards, then archives — with fail-closed `&&` semantics and correct exit-code
propagation (R1, and the wiring half of R2).

**Files:**
- Modify `package.json` (`scripts` block only).

**Changes:**
- Add exactly this script to the `scripts` object (the script **name must be
  `plugin-zip`** — not `build:zip`, `plugin:zip`, or any other name):

  ```json
  "plugin-zip": "npm run build && node scripts/check-build.js && wp-scripts plugin-zip"
  ```

  - Stage 1 `npm run build` reuses the repo's existing `build` script
    (`wp-scripts build`) so there is a single source of truth for how the plugin
    builds (Design stage 1; risk #4). Do **not** inline `wp-scripts build`.
  - Stage 2 `node scripts/check-build.js` is the Task 1 guard.
  - Stage 3 `wp-scripts plugin-zip` runs **bare** (no flags) from the repo root.
  - The `&&` between stages makes the chain fail-closed: any non-zero exit aborts
    the chain and skips the archive; npm propagates the exact inner exit code.
- Place the new key among the existing scripts following the file's ordering/
  formatting conventions (tabs, key style). Change **nothing else** in
  `package.json` — in particular, do **NOT** add a `files` field (design
  non-change / risk #2), and do not touch `name`, `version`, or dependencies.

**Depends on:** Task 1 (stage 2 references `scripts/check-build.js`; the chain is
incomplete without it). Task 2 is not strictly required for the chain to run but
should already be green.

**Traces to:**
- Spec R1 (single command, exact name `plugin-zip`, CI-friendly exit codes),
  R2 (build-first wiring), AC1.
- Design "Architecture overview" stages 1–3, "Command / config surface" table
  row 1, risk #4.

**Acceptance:**
- `package.json` contains a `plugin-zip` script with the **exact** command
  string above; no `files` field exists anywhere in `package.json`; `name` is
  still `piano-block`.
- `npm run plugin-zip` (after `npm install` if needed) runs all three stages
  non-interactively and exits `0` on a healthy tree. (Full content/idempotency
  assertions are Task 5; this task confirms the chain is wired and runs.)
- **Fail-closed check:** with `build/block.json` removed *after* a build
  (simulating a broken/partial build) — or by temporarily making stage 1 fail —
  `npm run plugin-zip` exits **non-zero** and does **not** write/refresh
  `piano-block.zip` from the broken state. (This exercises the `&&`
  short-circuit; restore the tree afterward.) Note: stage 1 normally rebuilds
  `build/`, so to exercise the guard in isolation you may invoke
  `node scripts/check-build.js && wp-scripts plugin-zip` against a tree whose
  `build/block.json` is absent, or assert the guard's non-zero exit directly as
  in Task 1 — the point is to confirm a missing keystone aborts before archiving.

---

## Task 4 — Add the anchored `.gitignore` rule for the artifact

**Goal:** Keep the generated `piano-block.zip` out of version control, matching
the file's existing comment-and-anchoring house style (R6 / AC7).

**Files:**
- Modify `.gitignore`.

**Changes:**
- Append an **anchored, named** rule with a comment, matching the existing
  house style (every root-generated artifact in this file is anchored:
  `/build/`, `/artifacts/`, `/test-results/`, `/playwright-report/`):

  ```
  # Distribution artifact (generated by `npm run plugin-zip`)
  /piano-block.zip
  ```

  - Use `/piano-block.zip` (anchored to the repo root, single named file) — **not**
    broad `*.zip` (which would silently hide a future legitimate zip such as a
    test fixture; none is tracked or present today) (Design "Why an anchored
    `.gitignore` rule", risk #6).
  - Place it consistently with the existing grouped, commented sections (e.g.
    near the other generated-at-root artifacts), not buried among the unanchored
    OS/editor noise.

**Depends on:** none. (Independent of the other tasks; can be done any time. No
dependency on Task 3, though it is only *observable* once a zip is produced.)

**Traces to:**
- Spec R6 (artifact added to `.gitignore`), AC7.
- Design "Why an anchored `.gitignore` rule", risk #6, "Command / config surface"
  table row 3.

**Acceptance:**
- `.gitignore` contains the anchored `/piano-block.zip` rule with its comment.
- `git check-ignore -v piano-block.zip` matches the new rule.
- After a successful `npm run plugin-zip` (or `touch piano-block.zip`),
  `git status --short` does **not** list `piano-block.zip` as untracked.
- No `*.zip` (unanchored, match-anywhere) rule was added.

---

## Task 5 — End-to-end verification of the archive (content, structure, idempotency, exclusions)

**Goal:** Prove the assembled command satisfies the acceptance criteria
end-to-end: exit 0, single `piano-block/` root, all required runtime files
present, all forbidden files absent, idempotent overwrite, and the conditional
`languages/` branch. This is the integration check that the prior tasks compose
correctly.

**Files:**
- No production files change. Produce a repeatable verification (a short script,
  a documented command sequence, or an automated check) that asserts the archive
  contents. If you add a committed helper, place it under `scripts/` (auto-
  excluded from the zip, no R4 impact) and keep it dependency-free; otherwise a
  documented manual sequence run in the worktree is acceptable. Do **not** commit
  the generated `piano-block.zip` (it is gitignored by Task 4).

**Changes / verification steps** (run from the repo root, after `npm install` if
needed):

1. **AC1 — Invocation / exit 0.** Run `npm run plugin-zip`; confirm it completes
   non-interactively and exits `0`.
2. **AC3 — Artifact location & idempotency.** Confirm `piano-block.zip` exists at
   the repo root. Run `npm run plugin-zip` a second time; confirm it succeeds,
   overwrites the file (no error, no appended/stale entries — e.g. the entry
   count/listing is stable, not growing), and the file is freshly written.
3. **AC4 — Single root folder.** List the archive entries (e.g. `unzip -l
   piano-block.zip`) and assert **every** entry is nested under a single
   top-level `piano-block/` directory.
4. **AC5 — Included files present.** Assert the archive contains at least:
   - `piano-block/piano-block.php`
   - `piano-block/build/block.json`
   - `piano-block/build/render.php`
   - `piano-block/build/index.js`
   - `piano-block/build/view.js`
   - `piano-block/build/style-index.css`
   - `piano-block/build/index.asset.php`
   - `piano-block/build/view.asset.php`
   - at least one `*.woff2` under `piano-block/build/fonts/` — assert the
     directory contains **a** `.woff2`; do **NOT** assert an exact
     content-hashed filename.
   - `piano-block/README.md` (matched by the `readme.*` glob,
     case-insensitively).
5. **AC6 — Excluded files absent.** Assert the archive contains **none** of:
   any `src/` path, `node_modules/`, `package.json`, `package-lock.json`,
   `biome.json`, `playwright.config.js`, `.wp-env.json`, `.nvmrc`, `specs/`,
   `docs/`, `AGENTS.md`, `.rp*`, `.claude/`, `scripts/`, and no dotfiles /
   OS-editor noise (`.gitignore`, `.DS_Store`, `.idea/`, `.vscode/`, `*.log`,
   `.env*`).
6. **AC2 — Build-first / fail-loud (integration).** Confirm the chain fails
   before archiving when the build payload is missing: with `build/block.json`
   absent, the chain exits non-zero and does **not** emit/overwrite a blockless
   zip. (Reuse the Task 3 fail-closed approach; restore the tree afterward.)
7. **AC8 — Conditional `languages/`.** Two branches:
   - **Absent (today's state):** the command succeeds and the archive simply
     omits `languages/` — confirmed implicitly by steps 1–5.
   - **Present:** create a throwaway `languages/` directory with a placeholder
     file, re-run `npm run plugin-zip`, and assert its contents appear under
     `piano-block/languages/`. Then **remove** the throwaway `languages/` so the
     tree returns to its real state (it must not be committed — the plugin has no
     `languages/` today).

**Depends on:** Task 1, Task 3 (the command must exist and run), Task 4 (so the
produced zip is gitignored and `git status` stays clean during verification).
Task 2 should be green.

**Traces to:**
- Spec AC1–AC8; R3, R4, R5, R6, R7.
- Design "How each acceptance criterion is met" (AC1–AC8 rows), "A real run …
  confirmed the behavior end to end".

**Acceptance:**
- All eight checks above pass as described. Record the outcome (exit codes and
  the pass/fail of each content assertion) so a reviewer can confirm without
  re-running. If a committed verification helper is added, it lives under
  `scripts/`, is dependency-free, and does not change the archive's contents
  (still auto-excluded). The working tree is clean afterward: no `languages/`,
  no committed `piano-block.zip`, `build/block.json` restored.

---

## Ordering summary

1. **Task 1** — `scripts/check-build.js` guard (no deps).
2. **Task 2** — unit tests for the guard (deps: 1).
3. **Task 3** — `plugin-zip` npm script / three-stage chain (deps: 1).
4. **Task 4** — anchored `/piano-block.zip` `.gitignore` rule (no deps).
5. **Task 5** — end-to-end archive verification (deps: 1, 3, 4).

Tasks 1→2 and 3 form the guard+wiring core; Task 4 is independent and can land
any time before Task 5; Task 5 is the final integration gate against AC1–AC8.
