# Spec Review — APPROVED

**Spec:** `base/1-spec/spec.md` — "Build a distribution-ready plugin zip" (issue #40)
**Verdict:** APPROVED
**Reviewer:** spec-reviewer (adversarial pass, iteration 1)

## Summary

The spec faithfully captures the owner's intent, stays at the correct
requirements/acceptance altitude, is fully testable, and keeps the
wp-movies-demo build script as an open direction rather than a baked-in
requirement. Every factual claim it makes about the repository was verified
against the actual working tree and holds. No blocking issues found.

## Verification of factual claims (checked against the live repo)

- `piano-block.php` exists; `Version: 0.1.0`; registers the block from
  `__DIR__ . '/build'` and calls `wp_set_script_translations( ..., __DIR__ . '/languages' )`.
  Matches R3 and the runtime-surface premise.
- `build/` is present and populated with exactly the files the spec enumerates:
  `block.json`, `render.php`, `index.js`, `view.js`, `style-index.css`,
  `style-index-rtl.css`, `index.asset.php`, `view.asset.php`, plus
  `build/fonts/pb-music.5cb97431.woff2`. The real font filename carries a content
  hash — which validates AC5's instruction to assert "a `.woff2` under
  `build/fonts/`" rather than an exact filename.
- `build/block.json` declares `viewScript: file:./view.js` (and editorScript,
  style, render). Confirms `view.js` is a shipped/enqueued runtime file, so its
  presence in AC5 is correct.
- No `languages/` directory and no `uninstall.php` today — validates R3's
  "include if present" framing and R7's drift-guard rationale (the two most
  likely future additions).
- `.gitignore` has `node_modules/`, `/build/`, e2e artifacts, logs, `.env*`,
  OS/editor noise, `.claude/`, `.rp.local.md` — and **no** `*.zip` /
  `piano-block.zip` rule. Confirms the gap R6/AC7 require closing.
- All excluded items the spec lists are actually present in the repo
  (`src/`, `node_modules/`, `package.json`, `package-lock.json`, `biome.json`,
  `playwright.config.js`, `.wp-env.json`, `.nvmrc`, `AGENTS.md`, `docs/`,
  `specs/`, `.rp*`), so R4/AC6 exclusion is meaningful and accurate.

## Judgment against review criteria

**Intent fidelity — PASS.** The intent's goal ("only runtime files, without
manually selecting files") is captured by R3 (allowlist / safe-by-omission) and
R4 (exclusion is the default, not a hand-maintained removal list). The intent
explicitly frames the wp-movies-demo `build-plugin.js` script as "one possible
approach, not a requirement"; the spec honors this. The script is never named
as a requirement — tool choice is deferred to design in the Overview note
(lines 22–25) and Out of Scope (lines 121–124), with `wp-scripts plugin-zip`,
a bespoke `archiver` script, and WP-CLI all listed as open options. No goal
substitution.

**Altitude — PASS.** Requirements describe *what the command must do*, not
*how*. No tool is mandated; no architecture leaks. The one interface-level
mandate (R1: the npm script must be named `plugin-zip`, not `build:zip` /
`plugin:zip`) is a legitimately spec-level decision about the maintainer-facing
entry point, justified by community convention — not an implementation choice.
R7's standard-layout globs are framed tool-agnostically as the Plugin Handbook
layout (the spec notes, but does not depend on, the fact that they coincide
with one tool's default allowlist).

**Testability — PASS.** Each requirement (R1–R7) maps to a concrete,
mechanically-checkable acceptance criterion (AC1–AC8): exit code, single root
folder, IN-present file list, OUT-absent file list, gitignore rule, conditional
`languages/`, build-first/fail-loud. The font assertion correctly avoids the
content-hashed filename. "Installs cleanly into WordPress" is properly demoted
to an optional stronger check rather than the required bar.

**Completeness — PASS.** Edge cases are covered: missing/empty `build/` at
archive time (R2/AC2), idempotent overwrite of a stale artifact (R6/AC3),
conditional `languages/` inclusion (R3/AC8), and standard-layout drift (R7).
Out of Scope is explicit and honest about CI wiring, filename versioning,
WP.org `readme.txt`, version-sync, and arbitrary non-standard future paths —
keeping the "without manually selecting files" claim honest (no per-run picking,
zero edits for standard-layout growth, not omniscient future-proofing).

## Points considered and cleared (no change required)

- **R2 build-first vs. fail-loud** is complementary, not contradictory: chaining
  the build covers the normal path, and the fail-loud guard protects against a
  zip-on-disk tool that would otherwise silently emit a block-less archive.
- **`style-index-rtl.css`** appears in R3's enumeration but not AC5's
  assert-present list. Acceptable: AC5 verifies the whole `build/` tree ships via
  representative files; the RTL stylesheet is conditional and need not be asserted.

## Conclusion

APPROVED. The spec is faithful, testable, correctly scoped, and grounded in the
real repository state. It is ready to proceed to the design phase.
