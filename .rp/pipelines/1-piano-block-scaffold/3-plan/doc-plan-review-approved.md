# Doc Plan Review

## Verdict: approved

## Summary

The doc plan is approved. It is a sound, drift-resistant documentation plan for the minimal Piano block scaffold, with three appropriately-scoped tasks: (1) a substantive root `README.md` overhaul, (2) a one-field `package.json` `description` accuracy fix, and (3) a documentation-consistency verification gate. It contains no code tasks, traces cleanly to the spec/design, names concrete audiences, stays strictly within the minimal-scaffold scope, and is precise enough that two doc-writers would produce the same scope and shape.

I verified the plan's claims against the live host repo (read-only):

- **README.md** — confirmed the plan's framing claims are accurate: line 5 says "There is no implementation yet — this repo currently contains only the project tooling" (the plan quotes this near-verbatim as the now-false claim to correct), and line 3 carries the "(planned)" product tagline. The existing sections (Requirements / Tooling / Getting started / Scripts) match the plan's description, including the `npm install` step the plan flags for adaptation. The file is 819 bytes (the plan's "~800 bytes" is accurate).
- **package.json** — confirmed `"description": "A WordPress block (planned) for creating piano song sheets to practice and learn piano."` (the "(planned)" wording the plan targets), and that `name`/`version`/`license`/`private`/`engines`/`scripts`/`devDependencies` are exactly the functional fields Task 2 commits to preserving.
- **biome.json** — confirmed tab indentation, double-quoted JS, `recommended` rules, and (relevant to the plan's repeated point) that Markdown is **not** in Biome's processing set, so the "match existing hand-formatting" guidance is correct.
- **Surface sweep** — the only tracked files at the repo root besides the two planned surfaces are `.gitignore`, `.nvmrc`, `biome.json`, `package-lock.json`, and `.rp.md`. None of these reference product/block behavior the code phase creates. `.gitignore` (confirmed: ignores `node_modules/`, `.env*`, OS/editor noise, `.claude/`) is appropriately not a doc surface, and design §7 explicitly states no `.gitignore` change is needed. `.rp.md` is pure pipeline-process documentation (GitHub labels, worktree commands, commit format) with zero references to the Piano block — correctly excluded from the doc surfaces.

**On the flagged `package.json` reconciliation:** sound. The code-plan lists `package.json` among files "left untouched," but its stated concern is explicitly the *functional* fields (version `0.1.0`, license, `lint`/`format`/`check` scripts, dependencies, lockfile) that make the scaffold operate. Doc Task 2 edits ONLY the non-functional `description` prose string and commits to preserving every functional field plus the lockfile (plan lines 76, 85). The two plans partition `package.json` cleanly — code owns functional fields (and leaves them as-is), docs own the one prose field. Editing a human-readable `description` is documentation work (metadata copy, analogous to README prose), not a code task; it changes no behavior, dependency, or script. Design §7 likewise addresses only the functional fields and neither asserts nor forbids correcting the `description`. No contradiction.

**On drift-resistance:** well-handled. The plan states the spec-mandated facts that the docs MUST convey — the WP 6.3+/PHP 7.4+ runtime floor (req 11) and the Node 24 LTS/npm 11+ toolchain floor — as binding constraints, while explicitly deferring the genuinely drift-prone literals (exact file names, command strings, block title/slug, category, copy) to phase-5 writers reading the shipped code (plan line 29). Per-task acceptance describes what the reader leaves with, not function names, parameter lists, or wording.

I considered one nit: the Overview's sweep parenthetical names the excluded set as "`node_modules/` ... and the `.rp/` pipeline artifacts," and `.rp.md` is a root-level file rather than a member of `.rp/`, so it is not literally named by that exclusion. This does not rise to a rejectable issue: `.rp.md` is process documentation that the code phase does not touch and a phase-5 writer would obviously leave alone, so omitting it from the doc-surface table is substantively correct, not a coverage gap. Rejecting over the exact wording of an exclusion parenthetical would not improve the resulting documentation.

## Issues

None.
