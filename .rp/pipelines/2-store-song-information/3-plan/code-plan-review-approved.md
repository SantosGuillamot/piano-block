# Code Plan Review — APPROVED

**Verdict: approved.**

Adversarial review of `3-plan/code-plan.md` (commit `d7d2752`, 9 ordered tasks) against the authoritative spec (`1-spec/spec.md`, requirements 1–14, AC1–AC10), the approved design (`2-design-doc/design-doc.md`), and the issue-#1 scaffold. The plan faithfully realizes the approved design, covers every requirement and acceptance criterion with concrete tests, orders tasks soundly, and is feasible on the installed toolchain. No blocking gaps, mis-ordering, missing AC coverage, design drift, or infeasibility found.

---

## What was verified (and how)

**Completeness — every requirement (1–14) and AC (AC1–AC10) is covered by a task's Acceptance.**

| Item | Covered by | Note |
|---|---|---|
| Schema-as-data module (single source of truth) | Task 2 (`src/song/schema.js`) | Transcribes design §7 verbatim; keyword subset only; permissive `additionalProperties`. |
| Zero-dependency validator/walker (no `ajv`) | Task 3 (`src/song/validate.js`) | Explicit no-`ajv` mandate; three walker special cases (note-name vocab, `alters` values/keys, strict `bpm>0`) called out. |
| `song` block.json attribute (`string`, default `""`) | Task 4 | No `source`; single attribute; scaffold keys untouched. |
| Editor raw-JSON field + non-blocking validation Notice | Task 5 (`src/edit.js`) | Unconditional `setAttributes`; validate non-empty only; error `Notice` only on non-empty + invalid; never blocks/clears/substitutes. |
| `render.php` escaped `<pre>` passthrough, nothing when empty | Task 6 | §8 defensive read (`isset … (string)`), `trim` empty check, `esc_html`, `get_block_wrapper_attributes()` echoed un-re-escaped, no re-serialization. |
| Unit tests | Task 3 | AC4/AC5/AC6/AC9/AC10 mapped to specific assertions, incl. the §9 comprehensive song verbatim and the structural-only (no-timing) assertion. |
| End-to-end tests | Tasks 7 (front end: AC3/AC7/AC8) + 8 (editor: AC1/AC2/AC4/AC6) | Both spec files; harness setup in Task 7, reused in Task 8. |
| §12.2 runtime verifications (AC1, AC3, AC8) | Tasks 7–8, confirmed in Task 9 | AC1 round-trip, AC3 empty-renders-nothing, AC8 XSS-escaping each have an explicit e2e test. |

The Task 9 coverage matrix (every AC → at least one passing test) is accurate.

**Correctness & ordering.** Each task is discrete and self-contained with Goal / Files / Changes / Depends on / Traces to / Acceptance. The dependency chain (1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9) is sound: deps installed (Task 1) before any test; schema (2) → validator (3) → editor (5) which consumes the validator; build/wp-env stood up before e2e (7); editor e2e (8) reuses the harness from (7). The plan's note that Task 4 has no hard dependency on Task 3 is correct and harmless. The `Number.isInteger` instruction for the JSON-Schema `integer` check (Task 3) is a correct and necessary detail (JS `typeof 1.5 === "number"`).

**Design alignment.** No new or contradictory design is introduced; settled decisions are not re-opened. Zero-runtime-dependency is honored throughout (explicit prohibition on `ajv`/third-party validators in the Conventions and Task 3). The plan correctly carries the design's §8 defensive-read tidy-up that supersedes the §2 sketch's `?? ''`.

**Testability & feasibility — toolchain claims verified against the lockfile and `@wordpress/scripts@32.3.0` source (not assumed):**

- `package-lock.json` is present; `node_modules/` is absent (matches the plan's premise that Task 1 installs deps). `.gitignore` ignores `node_modules/` and `/build/`, matching the "commit source only" guidance.
- `@wordpress/scripts@32.3.0` directly depends on `@wordpress/e2e-test-utils-playwright@^1.47.0` (resolved `1.47.0`) and `@wordpress/jest-preset-default@^12.47.0`, and declares `@playwright/test@^1.58.2` as a **peer** dependency, resolved at top level as `@playwright/test@1.60.0`. So `npm install` makes both the unit (Jest) and e2e (Playwright) runners available — Task 1's premise holds. (Minor wording nuance: Playwright arrives via a top-level-pinned **peer** dep, not strictly "transitively"; immaterial since the lockfile installs it.)
- `wp-scripts test-unit-js` runs Jest out-of-the-box via the bundled `config/jest-unit.config.js` (`preset: @wordpress/jest-preset-default` + babel transform) — no consumer Jest config needed. The preset's `testMatch` is `**/__tests__/**/*.[jt]s?(x)`, `**/test/*.[jt]s?(x)`, `**/?(*.)test.[jt]s?(x)` with `testPathIgnorePatterns: ['/node_modules/', '<rootDir>/vendor/']`. Therefore:
  - The plan's unit tests at `src/song/__tests__/validate.test.js` **are** picked up (match `__tests__/**`). ✓
  - The plan's e2e files at `specs/render.spec.js` / `specs/editor.spec.js` (a `.spec.js` suffix *outside* `__tests__`/`test/`) do **not** match Jest's `testMatch`, so `npm run test:unit` will not wrongly execute the Playwright specs. The unit/e2e split is clean — a real cross-contamination risk that the plan's file placement happens to avoid. ✓
- `wp-scripts test-playwright` defaults to the bundled `@wordpress/scripts/config/playwright.config.js`, which already sets `testDir: './specs'` (exactly where the plan puts the specs), `use.baseURL` from `WP_BASE_URL` (default `http://localhost:8889` → the `wp-env` **tests** environment), `globalSetup`/`storageState` for admin auth, and `webServer: { command: 'npm run wp-env start', reuseExistingServer: true }`. The plan's Acceptance sequence (`npm run env:start` → `npm run test:e2e`) is feasible because `reuseExistingServer: true` reuses the already-running `wp-env` (port 8889) rather than invoking the bundled `webServer.command`.

The unit approach (wp-scripts/Jest on the pure validator/schema, no WP runtime) and the e2e approach (wp-scripts/Playwright + wp-env on the built block) are both feasible on this scaffold.

---

## Non-blocking guidance for the code-writer (does NOT affect the verdict)

These are notes to smooth Task 7, not defects. The plan already hedges the relevant instruction, so none force an improvised design decision.

1. **A custom `playwright.config.js` is strictly optional.** The bundled `@wordpress/scripts/config/playwright.config.js` already sets `testDir: './specs'` and is auto-used when no project-level `playwright.config.{js,ts}` and no `--config` exist (`test-playwright` falls back via `fromConfigRoot('playwright.config.js')`). Since the plan places specs under `/specs`, `npm run test:e2e` would work **with no config file at all**. Task 7's instruction to create one is acceptable (the plan explicitly says to confirm the base shape post-install and, if it differs, to "mirror the minimal fields … rather than inventing new ones"), but the simplest correct path is to add no config, or to add one only if a project-specific override is genuinely needed.
2. **If a custom config IS created, preserve the load-bearing base fields.** The bundled config is CommonJS (`module.exports = defineConfig({...})`) and supplies `globalSetup` (admin login → `storageState`), `storageState`, `baseURL`, and `webServer`. A re-export that drops `globalSetup`/`storageState` will break authenticated `requestUtils`/`admin` fixtures. Re-export the base and override only `testDir` (which is already `./specs` anyway), or require the bundled config and spread it. The plan's "don't invent fields; reuse the e2e utils' setup" hedge points the right way.
3. **`webServer.command` mismatch is benign only because of `reuseExistingServer`.** The base config runs `npm run wp-env start`; this project exposes `env:start` (not a literal `wp-env` script). With `wp-env` already up (the plan's documented sequence), `reuseExistingServer: true` skips the command, so this never fires. The code-writer should keep starting wp-env via `npm run env:start` before `npm run test:e2e`, as the plan's Acceptance states.

---

## Conclusion

The plan meets the bar on completeness, correctness/ordering, design fidelity, and testability/feasibility. Every spec requirement and acceptance criterion is traced to a task with concrete, verifiable acceptance; the unit and e2e strategies are sound and confirmed feasible on the installed toolchain; and no settled design decision is re-opened or contradicted. The single soft spot (Task 7's Playwright-config instruction) is explicitly hedged in the plan and does not force the code-writer into a wrong or improvised decision.

**Approved.**
