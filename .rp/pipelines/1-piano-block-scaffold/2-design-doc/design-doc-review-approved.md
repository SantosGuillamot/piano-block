# Design Doc Review

## Verdict: approved

## Summary

The design doc for the minimal Piano block scaffold (`2-design-doc/design-doc.md`) is **approved**. It is a complete, internally consistent, and evidence-backed HOW for the approved `1-spec/spec.md`, and it stays disciplined within the intentionally-minimal scope (a basic `edit` placeholder + a server-rendered `render.php`, with the real piano experience, a build pipeline, `wp-env`, and tests all correctly deferred).

I reviewed adversarially across coverage, traceability, alternatives/trade-offs, feasibility, dependencies, failure modes/observability, scope discipline, and clarity/consistency, and independently re-verified the load-bearing technical claims rather than trusting the research record.

**Coverage & traceability.** Every spec requirement (req 1–14) and every acceptance criterion (AC1–AC5) maps to a concrete component or decision, and §9 makes the mapping explicit (req→section and AC→failure-mode row). Nothing is silently dropped; the Out-of-Scope list is honored throughout (real piano, JS build pipeline, committed `wp-env`, automated tests, custom category, extra blocks/attributes/controls, full JS translation loading). The three spec open items (25 placeholder copy + icon/description/keywords; 26 ship CSS or not; 27 `Requires PHP` floor) are each resolved and attributed.

**Alternatives & trade-offs.** §5 records 11 key decisions, each with credible alternatives genuinely weighed (omit `save` vs `save: () => null`; flat root vs `src/`; `index.js` vs `block.js`; single `style` vs `style`+`editor` split; named function vs closure; literal version vs `filemtime`/`false`; guard placement; icon choice; no `biome.json` change vs a `globals` entry). §6 gives the spec's named build tension a dedicated, balanced resolution with an explicit "cost of no-build, stated honestly" and a concrete flip-trigger — exactly the "acknowledge, don't resolve by accident" the spec asked for. Nothing is presented as the only option (style-free is explicitly retained as a valid fallback).

**Feasibility — independently verified (read-only, in a temp dir outside the worktree; no deps mutated):**
- The three Biome-processed files authored exactly as in §3.1 / §3.2 / §3.6 pass `biome check` with **0 diagnostics (exit 0)** under the repo's exact `biome.json` (Biome 2.4.16, only the `vcs` block removed because the temp dir isn't a git repo), and are **byte-identical after `biome check --write`** ("No fixes applied") — confirming the idempotence/Biome-clean claims.
- All three PHP files (`piano-block.php`, `render.php`, `index.asset.php`) pass `php -l` (PHP 8.4.6) with no syntax errors; `include`ing `index.asset.php` returns a well-formed array with deps `wp-blocks, wp-block-editor, wp-element, wp-i18n` and version `0.1.0`.
- Biome **skips `.php` entirely** (handed only `.php` paths it reports "0 files processed / ignored"), confirming the PHP files are outside Biome's processing set.
- The design's three pivotal Biome-reasoning claims reproduce exactly: (1) a bare undeclared global (`someUndeclaredGlobal.doStuff()`) is **not** flagged under `recommended` — so the global `wp` is genuinely not flagged and **no `biome.json` change / `/* global */` comment is needed**; (2) adding one unused destructured alias (`Fragment`) **does** raise `lint/correctness/noUnusedVariables`, so the "declare exactly the four used members" discipline is load-bearing and correct; (3) the es5 `function(){}` form **does** trip `lint/complexity/useArrowFunction`, validating the method-shorthand `edit() {}` choice.
- Against the official block-metadata reference I confirmed: `editorScript` is auto-enqueued (with its `.asset.php` deps) into the editor including the apiVersion-3 iframe; `style` is enqueued in **both** the editor and the front end (including the iframe); `render.php`'s in-scope vars are `$attributes`/`$content`/`$block`; the `.asset.php` sidecar is auto-detected by pattern matching with `dependencies`+`version` read; `textdomain` (lowercase) is correct and `title`/`description`/`keywords` are auto-translated. `get_block_wrapper_attributes()` returns an already-`esc_attr()`-escaped string, so the design's "echo directly, do NOT wrap in `esc_attr()`" guidance is correct (wrapping would double-escape).

**Dependencies & environment.** §7 names the runtime floor (WP 6.3+/PHP 7.4+), the four core script handles, and the single dev dependency (Biome 2.4.16), and correctly states no new dependency and no `biome.json` change. The repo state I inspected (`biome.json`, `package.json`, `.gitignore`, `.nvmrc`, `README.md`) matches the design's grounding claims exactly. No hidden dependencies; the explicit (non-transitive) listing of `wp-element` is justified and free.

**Failure modes & observability.** §8 enumerates the realistic failure surface (activation fatal/notice, missing/mis-categorized block, editor placeholder error, invalid-content on save, front-end PHP notice, stale cache, lint drift) and maps each to a mitigation and the AC it protects — appropriately scoped for a scaffold with no runtime logic, with a concrete verification step (run `npm run check`; five-point smoke test under `WP_DEBUG`).

**Scope discipline & clarity.** The design describes architecture and decisions with per-line rationale tied to req/AC numbers; two implementers would build the same artifact. The version-coupling note (four declarations of `0.1.0` moving together) is surfaced honestly as a maintenance convention rather than hidden. The build-migration discussion (§6) is forward-looking context for a deferred decision, not a plan for this task.

No blocking or non-blocking defects were found. A first-pass approval is warranted here only because the design is exhaustively researched and I was able to independently reproduce its empirical foundation end-to-end.

## Issues

None.
