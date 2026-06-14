# Design Doc Review — APPROVED

> Reviewer: `design-doc-reviewer` (iteration 1)
> Subject: `2-design-doc/design-doc.md`
> Contract: `1-spec/spec.md` (R1–R7, AC1–AC8)
> Verdict: **APPROVED**

## Summary

The design is approved. It is thin by intent, technically sound, at the correct
altitude (architecture and decisions, not a task breakdown and not finished
code), and every requirement R1–R7 and acceptance criterion AC1–AC8 is addressed
by a concrete, named mechanism. Most importantly, its load-bearing empirical
claims are not assumed — I re-verified them independently against the actually
installed `@wordpress/scripts@32.3.0` source and the live repo state, and they
hold.

## Independent verification of load-bearing claims

I did not take the doc's "verified" annotations on faith. I re-derived the
central facts from the installed source and the repo, and each one checked out:

- **Archiver version.** `node_modules/@wordpress/scripts/package.json` →
  `"version": "32.3.0"`. Matches the doc.
- **Allowlist globs (R3/R4/R7).** `scripts/plugin-zip.js` lines 33–50 use exactly
  `admin/**`, `build/**`, `includes/**`, `languages/**`, `public/**`,
  `${name}.php`, `uninstall.php`, `block.json`, `changelog.*`, `license.*`,
  `readme.*`, with `caseSensitiveMatch: false`. This is verbatim the doc's claim,
  and the case-insensitivity is what makes `README.md` match `readme.*` (AC5).
  These globs ARE the spec's R7 standard-layout set, so R7 is genuinely free.
- **`files`-field footgun.** Line 23 branches on `hasPackageProp('files')` →
  `npm-packlist()`; else the glob allowlist. The doc's "do NOT add a `files`
  field" constraint is correctly characterized and correctly flagged as a latent
  risk (decision/risk #2).
- **Root folder (R5).** Line 20: `zipRootFolder = `${name}/`` from package.json
  `name`. `package.json` `name` = `piano-block` → `piano-block/`. Confirmed.
- **Output + overwrite (R6).** Line 79: `zip.writeZip(`./${name}.zip`)` →
  `piano-block.zip` at cwd, a single truncate/recreate write (no append).
  Confirmed.
- **Keystone is real (R2 guard).** `piano-block.php` calls
  `register_block_type( __DIR__ . '/build' )`, which loads `build/block.json`. So
  `build/block.json` is genuinely the file WordPress relies on — the right thing
  to assert. Confirmed in the live plugin file.
- **Partial-build hazard is real.** wp-scripts default webpack config
  (`config/webpack.config.js:115`) sets `output.clean` with
  `keep: /^(fonts|images)\//`, and `build/fonts/pb-music.*.woff2` is present on
  disk. So a wiped/partial build genuinely can leave fonts while the block is
  gone — which is exactly why a bare "directory non-empty" check would be unsafe
  and `build/block.json` is the correct keystone. Confirmed.
- **`scripts/` is auto-excluded (R4).** `scripts/` is not in the allowlist globs,
  so the new `scripts/check-build.js` is omitted from the zip with no extra work.
  Confirmed against the glob list.

## Requirement / AC alignment

- **R1** — single `plugin-zip` npm script, non-interactive, `&&`-chained,
  exit-code-propagating. Addressed.
- **R2** — `npm run build` first (DRY, single source of truth) + a
  `build/block.json` guard that fails loud on missing/empty/partial builds before
  archiving. Addressed, and the partial-build edge case (the spec's central
  "silently ship a blockless zip" fear) is the one it specifically defeats.
- **R3 / R4 / R5 / R6 / R7** — satisfied out of the box by the built-in
  archiver's allowlist model (verified above), plus the anchored `/piano-block.zip`
  gitignore rule for R6's no-commit clause.
- **AC1–AC8** — each mapped to a mechanism in the doc's two coverage tables;
  spot-checks against the source agree (e.g. AC6 "through the chain" reasoning is
  sound because build only (re)writes the already-included `build/**` and the
  guard only reads).

## Adversarial probes that did not find a problem

- **Self-inclusion of the zip:** a stale `piano-block.zip` at the repo root does
  not match any allowlist glob, so the archive never includes itself. No bug.
- **Guard cwd:** npm runs scripts with cwd at the package root (= repo root), so
  resolving `build/block.json` from `process.cwd()` is correct.
- **Exact exit code through `npm run build`:** even in the worst case where npm
  normalizes the inner code, AC1's contract is only 0-vs-non-zero, which still
  holds. Not a concern.
- **Altitude:** the doc gives `check-build.js` a *behavioral contract* and
  explicitly defers the body to implementation — correct design altitude, not
  premature code.

## Notes (non-blocking, for downstream phases)

- The doc's repeated "verified in this worktree" annotations could not be
  re-run here because `node_modules` resolves to the shared main-repo install
  (the worktree has no local `node_modules`); this is expected and does not
  weaken the design, since I re-verified the same facts directly from that
  installed source. No action needed.
- Carry the "do NOT add a `files` field to `package.json`" constraint forward
  into the plan/code/docs phases, as the doc already instructs.

**Verdict: APPROVED.**
