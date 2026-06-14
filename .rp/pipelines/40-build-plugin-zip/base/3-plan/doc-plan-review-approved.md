# Doc Plan Review — APPROVED

> Reviewed: `doc-plan.md` (Build a distribution-ready plugin zip, issue #40)
> Against: `1-spec/spec.md`, `2-design-doc/design-doc.md`, `3-plan/code-plan.md`
> Sanity-checked against the real repo: `README.md`, `AGENTS.md`, `.gitignore`,
> `package.json`, `docs/`, `piano-block.php`.

## Verdict

**APPROVED.** The documentation plan is complete, code-anchored, correctly placed,
faithful to house style, and drift-resistant. No blocking issues found.

## What I verified against the real repo (the plan's premises are accurate)

- **README structure** the plan targets all exists as described: the
  `## Building & installing into an existing site` section (with today's
  hand-copy-`build/` instructions), the `## For contributors` area, `### The build
  model`, the `### File layout` `| Path | Role |` table, and the `### Scripts`
  `` - `npm run X` — … `` bullet list. The plan's placement decisions match the
  real layout.
- **House style** the plan instructs writers to match is real: sentence-case
  `##`/`###` headings, em-dash descriptions, the `| Path | Role |` table format,
  the terse one-line script bullets, and the `.gitignore` convention of `# Comment`
  group headers with **anchored** root artifacts (`/build/`, `/artifacts/`,
  `/test-results/`, `/playwright-report/`) vs. unanchored noise (`*.log`,
  `.DS_Store`). All confirmed.
- **AGENTS.md hard rule** the plan propagates (no `.rp/` / `design §X` / `AC#` /
  `T#` / "review N" citations in user-facing docs) is exactly the rule in
  `AGENTS.md`. The plan carries it into every task's Acceptance with concrete
  allowed/forbidden term lists.
- **`docs/` holds only `song-format.md`** — the plan's "do not create a new
  top-level doc; `docs/` is reserved for the song-format reference" is correct.
- **No `files` field in `package.json` today** — confirmed, so Task 3's
  "Constraint 1" describes the real, relied-upon state.
- **`plugin-zip` not yet present** and **`scripts/` does not exist yet** —
  confirmed, so Task 2 (add the bullet) and Task 3 (add the guard to File layout)
  are genuinely net-new, non-duplicative work.
- **README has no existing "zip" mention** — confirmed, so Task 1 is net-new.
- **`piano-block.php` calls `register_block_type( __DIR__ . '/build' )`** —
  confirmed, grounding Task 3's "`block.json` is the keystone WordPress loads"
  rationale in real code, not invention.

## Why it passes each judging dimension

**Completeness.** Every shipped user/contributor-facing aspect is documented
somewhere:
- Usage of `npm run plugin-zip` → Task 1 (distribution section) + Task 2 (Scripts).
- Include/exclude behavior → Task 1 (high-level, safe-by-omission framing) +
  Task 3 (allowlist mechanism).
- Build-first / fail-loud → Task 1 (user-facing) + Task 3 (rationale).
- The guard → Task 3 (where it lives, why `block.json`, `### File layout` row).
- The `.gitignore` rule → Task 4 (self-documenting comment + single README
  cross-reference).
- "Do not add a `files` field" → Task 3 Constraint 1 (explicit "do not").
- "Run `wp-scripts plugin-zip` bare from the repo root" → Task 3 Constraint 2.
- Single `piano-block/` root and idempotent overwrite → Task 1.

Internal-only items (the Jest guard tests, the e2e verification from code-plan
Tasks 2/5) are correctly **not** treated as user-facing docs.

**Drift-resistance.** Every task's Acceptance checks the prose against shipped
files or a real run, not against spec/design prose: Task 1 verifies the command
string against `package.json` and the include/exclude claims against `unzip -l`,
and explicitly forbids overstating the guard (no claim it validates `languages/`
or runs e2e); Task 3 ties the three-stage chain text to the actual
`scripts.plugin-zip` string and the guard description to what `check-build.js`
actually checks; Task 4 uses `git check-ignore -v` / `git status --short`. The
plan also states an explicit "document only shipped behavior; report a blocker on
divergence" rule and a no-invented-features constraint.

**Audience / placement.** Maintainer content folds into the existing
"Building & installing" section (alongside, not replacing, the manual path);
contributor content into `## For contributors` and `### File layout`; the Scripts
catalog entry into `### Scripts`. No new top-level doc; `docs/` untouched. Matches
the repo's real conventions.

**House-style faithfulness.** All style instructions match the files I read, and
the AGENTS.md no-citation rule is enforced per task with explicit examples.

## Non-blocking observations (no action required)

- Tasks 1, 2, and 4 all touch the "the zip is git-ignored" statement. This is a
  mild coordination point, but the plan resolves it deliberately: Task 4 mandates
  the clause appear in **exactly one** place and removes any duplication. The rule
  is explicit, so it is not a defect.
- The standard-layout allowlist (R7 globs like `admin/`, `includes/`,
  `uninstall.php`) is framed throughout as *the selection mechanism* (the reason
  exclusion is the default), never as "these directories exist." Task 1 correctly
  scopes the *actual* included set to what ships today (plugin file, `build/`,
  `README.md`, `languages/` if it ever exists). No risk of documenting phantom
  directories.

These do not warrant rejection. The plan is approved as written.
