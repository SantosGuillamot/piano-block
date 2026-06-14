# Code Review 1 — REJECTED

> Issue #40 (Piano Block plugin) — "Build a distribution-ready plugin zip".
> Reviewed diff: `8f27bb1a58af4f8cc15e59d413900fe9f0a23943 → HEAD` (`feccfe8`),
> excluding the pipeline artifacts under `.rp/pipelines/40-build-plugin-zip/`.
> Reviewed against the spec (R1–R7, AC1–AC8), the design doc, and the code plan.

## Verdict

**REJECTED** — for one substantive finding (a root-level `babel.config.js` that
overrides the whole plugin's Babel configuration, introduced as a workaround for
an avoidable ESM choice and **not** part of the agreed design) plus a related
nuisance (a Node module-type warning emitted on every `npm run plugin-zip`).

This is a deliberate, narrow rejection. **The shipped product behavior is
correct**: I independently re-ran the full chain and the end-to-end verifier and
**every acceptance criterion AC1–AC8 passes (44/44 checks)**; the guard's four
unit cases pass; the archive contents, exclusions, single root folder,
idempotency, fail-loud behavior, the anchored `.gitignore` rule, the absent
`files` field, and `name: piano-block` are all exactly as specified. The
rejection is about **how** Task 1/Task 2 were implemented (a global build-config
change that the design did not authorize and that a simpler implementation
avoids), not about whether the command works.

---

## What I verified passes (so the re-dispatch does not regress it)

- **Three-stage chain** is exactly
  `npm run build && node scripts/check-build.js && wp-scripts plugin-zip` — verified
  in `package.json`. No `files` field anywhere; `name` still `piano-block`; no new
  runtime/dev dependency added by `package.json`.
- **Guard checks `build/block.json` specifically** (not "dir non-empty"). Confirmed
  by reading `scripts/check-build.js` and by the four passing unit cases — including
  the load-bearing **partial-build** case (`build/fonts/*.woff2` present, no
  `block.json` → not ok). I ran `npx wp-scripts test-unit-js scripts/check-build.test.js`:
  all 4 cases pass and the partial case asserts failure.
- **Guard CLI behavior**: `node scripts/check-build.js` exits `0` with a real
  `build/block.json` present; with it absent, exits `1` and writes
  `build/block.json not found — run \`npm run build\` first.` to **stderr**.
- **End-to-end** (`node scripts/verify-archive.mjs`): **44 passed, 0 failed**.
  AC1 (exit 0), AC2 (fail-loud, zip not overwritten on a missing keystone), AC3
  (artifact at root + idempotent overwrite, stable 11-entry count), AC4 (single
  `piano-block/` root), AC5 (all required runtime files + a `*.woff2`), AC6 (none of
  the forbidden paths — `src/`, `node_modules/`, config, `scripts/`, dotfiles —
  leak), AC7 (`git check-ignore -v piano-block.zip` matches `/piano-block.zip`),
  AC8 (both `languages/` branches).
- **`.gitignore`**: anchored `/piano-block.zip` with a comment; **no** broad
  `*.zip` rule. House style matches the other anchored root artifacts.
- **Working tree left clean** after my runs: no committed `piano-block.zip`, no
  stray `languages/`, `build/block.json` restored.
- Comment density/idiom of the new files matches the repo's JSDoc-header house
  style.

---

## Findings (must fix)

### Finding 1 — Root `babel.config.js` overrides the whole plugin's Babel config; it is undisclosed scope creep added to work around an avoidable ESM choice → **Task 2** (root cause in **Task 1**)

**Severity: blocking.**

Commit `61cf596` ("Unit-test the build-payload guard") added a new top-level,
**tracked** `babel.config.js` (68 lines). It is not mentioned anywhere in the
design doc or the code plan. The design's "Command / config surface" table lists
exactly three product artifacts — `package.json` (scripts), `scripts/check-build.js`,
`.gitignore` — and the plan's Task 2 is "create `scripts/check-build.test.js`",
nothing more. A root `babel.config.js` is a fourth, **global** artifact.

Why it exists: the writer authored `scripts/check-build.js` in ESM and used
`new URL(import.meta.url).pathname` for the CLI `require.main`-style guard. Under
`wp-scripts test-unit-js` (Jest + babel-jest), `import.meta` does not transform to
CommonJS and Node rejects it. Rather than avoid `import.meta`, the writer added a
repo-root `babel.config.js` whose **entire purpose** is a custom inline Babel
plugin that rewrites `import.meta.url` so Jest can require the guard.

Why this is a reject, not a nit:

1. **It is a global blast radius for a local problem.** A repo-root
   `babel.config.js` is picked up by `@wordpress/scripts`' Babel/Jest pipeline for
   the **entire plugin** — every existing and future `src/**` unit test and every
   Babel pass, not just `scripts/`. Today it re-declares
   `@wordpress/babel-preset-default` so it does not break the existing suite (I
   confirmed: with `babel.config.js` removed, the only `src/**` failure is a
   pre-existing, environment-related `layout.test.js` floating-point assertion that
   also fails at the base ref — see "Not a finding" below — so this config does not
   currently break `src/`). But it is now load-bearing global config that a future
   `@wordpress/scripts` upgrade can interact with in surprising ways. The design
   deliberately kept the footprint to three files; this silently widens it to the
   plugin's most fragile shared surface.

2. **It was avoidable by following the plan.** The code plan's Task 1 explicitly
   offered the cheaper path: "a thin CLI section (guarded by a
   `require.main === module` / `import.meta`-equivalent check) … pick the form that
   the test in Task 2 can import cleanly and that `node scripts/check-build.js` can
   execute." Writing the guard as **CommonJS** (`module.exports` +
   `if (require.main === module)`) needs **no** babel config and imports cleanly in
   Jest. Alternatively, keeping ESM but resolving the CLI entry via `process.argv[1]`
   without `import.meta` (and/or scoping module-type appropriately) also avoids a
   global Babel override. Either is strictly simpler than a 68-line custom Babel
   plugin.

3. **It is undisclosed.** Neither the design nor the plan authorized a Babel config;
   the writer's commit silently introduced it. The adversarial gate's job is to
   catch exactly this kind of design-contract widening.

**Action:** Remove `babel.config.js` and rewrite the guard so no Babel
configuration is required:

- Preferred: make `scripts/check-build.js` **CommonJS** — `require('node:fs')` /
  `require('node:path')`, export `checkBuild` via `module.exports`, and gate the
  CLI on `if (require.main === module)`. Update `scripts/check-build.test.js`
  accordingly (the existing tests already pass `cwd` into the pure function, so
  only the import style changes). This also fixes Finding 2.
- The unit suite must still discover and pass `scripts/check-build.test.js` with
  all four cases (full → ok, missing/empty/partial → not ok), and the **existing
  `src/**` tests must not regress** beyond the pre-existing `layout.test.js`
  environment failure. `node scripts/check-build.js` must still exit `0`/`1`
  correctly from the repo root, and `npm run plugin-zip` must still pass the
  end-to-end verifier (44/44).

### Finding 2 — `MODULE_TYPELESS_PACKAGE_JSON` warning printed on every `npm run plugin-zip` run → **Task 1** (resolved together with Finding 1)

**Severity: minor, but it undercuts the R1 "clean CI signal" goal.**

Because `scripts/check-build.js` uses ESM `import` while `package.json` has no
`"type": "module"`, Node prints on every direct invocation:

```
(node:…) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file://…/scripts/check-build.js
is not specified and it doesn't parse as CommonJS. Reparsing as ES module because module syntax
was detected. This incurs a performance overhead.
```

This fires inside stage 2 of `npm run plugin-zip` (the command the spec calls
"deterministic, CI-friendly", R1), adding multi-line stderr noise and a per-run
reparse cost to every archive build. Converting the guard to CommonJS (Finding 1)
removes this warning entirely. (Do **not** "fix" it by adding `"type": "module"`
to `package.json` — that flips the whole package to ESM and risks other tooling;
the CommonJS guard is the clean fix.)

### Finding 3 — Stale path in the `verify-archive.mjs` header comment → **Task 5**

**Severity: cosmetic.**

`scripts/verify-archive.mjs:7` documents the invocation as
`node scripts/verify-archive.js`, but the file is `verify-archive.**mjs**`. Copying
that command verbatim fails. Correct the comment to `node scripts/verify-archive.mjs`.
(The script itself runs correctly — 44/44 — this is only the doc string.)

---

## Not a finding (recorded so it is not re-flagged)

- **Pre-existing `src/notation/__tests__/layout.test.js` failure** (`tempoLaneY`
  expected `3.8`, received `7.199…`). This fails **at the base ref `8f27bb1`** and
  with `babel.config.js` removed, so it is not introduced by this batch. It is
  environment-related: this machine runs Node `v20.20.1`, while `.nvmrc` and
  `package.json` `engines` require Node `>=24`; the layout math is
  floating-point-sensitive. Out of scope for issue #40 — do not attempt to fix it
  in this re-dispatch.

---

## Re-dispatch list (deduplicated)

- **Task 2 (root cause Task 1):** Remove `babel.config.js`; rewrite
  `scripts/check-build.js` as CommonJS (`module.exports` + `require.main === module`)
  so no Babel config is needed, and update `scripts/check-build.test.js` to the
  matching import style. Keep all four guard cases passing and the `src/**` suite
  un-regressed. This single change resolves **Finding 1 and Finding 2**.
- **Task 5:** Fix the stale `node scripts/verify-archive.js` → `…verify-archive.mjs`
  path in the `verify-archive.mjs` header comment (**Finding 3**).

After the re-dispatch: `npm run test:unit` discovers `scripts/check-build.test.js`
(4 cases green) with no new global Babel config; `node scripts/check-build.js`
emits no `MODULE_TYPELESS_PACKAGE_JSON` warning; and `node scripts/verify-archive.mjs`
still reports 44/44.
