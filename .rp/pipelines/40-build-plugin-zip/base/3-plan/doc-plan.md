# Doc Plan — Build a distribution-ready plugin zip

> Issue #40 (Piano Block plugin).
> Spec: `../1-spec/spec.md` (R1–R7, AC1–AC8).
> Design: `../2-design-doc/design-doc.md`.
> Code plan: `./code-plan.md`.
>
> This plan decomposes the documentation work for the shipped `npm run plugin-zip`
> command into ordered, independently verifiable tasks. Documentation must
> describe **only** the behavior that ships per the design and code plan — no
> invented features. If a doc-writer finds the shipped code diverges from what is
> documented here, they report a blocker rather than documenting the divergence.

## What ships (the single source of truth for these docs)

The feature is a single npm script and two supporting changes:

- **`package.json` `scripts`** gains
  `"plugin-zip": "npm run build && node scripts/check-build.js && wp-scripts plugin-zip"` —
  a three-stage chain: build → guard → archive, joined by fail-closed `&&`.
- **`scripts/check-build.js`** — a committed Node guard (Node built-ins only) that
  exits `1` with a stderr message when `build/block.json` is absent, else `0`.
- **`.gitignore`** gains an anchored `/piano-block.zip` rule (with a comment).
- Output: `piano-block.zip` at the repo root, a single `piano-block/` root folder,
  containing only the runtime payload (`piano-block.php`, `build/**`, `README.md`,
  `languages/**` if present), produced from a fresh build.
- **Two non-changes that are part of the contract** and must be documented as
  constraints: do **not** add a `files` field to `package.json`; run
  `wp-scripts plugin-zip` **bare** from the repo root.

## Conventions for all tasks

- **Working tree:** the pipeline worktree
  `/Users/santosguillamot/Desktop/Code/SantosGuillamot/piano-block/.claude/worktrees/40-build-plugin-zip`.
  All paths below are relative to this root.
- **House style (match it; do not invent a new format):**
  - README sections use sentence-case `##`/`###` headings, em-dash descriptions,
    and where a set of named things is listed, a `| Path | Role |`-style table or a
    `- \`npm run X\` — description` bullet list (see the existing `### File layout`
    and `### Scripts` subsections).
  - `.gitignore` entries are grouped under `# Comment` headers, and every
    root-generated artifact is **anchored** (`/build/`, `/artifacts/`).
  - `docs/` holds only the long-form song-format reference; the README is the home
    for build/tooling/maintainer guidance. **Do not create a new top-level doc
    file** for this feature unless a task explicitly says to — fold it into the
    README's existing contributor surface.
- **AGENTS.md hard rule (must hold in every doc):** do **not** reference the
  internal pipeline workflow or cite its artifacts (`.rp/`, `design §X`, `AC#`,
  `R#`, `T#`, "review N") in any user-facing doc. The shipped docs must read as a
  standalone project. Describe behavior and rationale in plain terms, never by
  pointing at spec/design/plan identifiers.
- **Drift rule:** every claim a doc makes must be checkable against the shipped
  files (`package.json`, `scripts/check-build.js`, `.gitignore`) or a real
  `npm run plugin-zip` run. Do not document filenames, flags, globs, or paths the
  code does not actually produce.
- **No duplication of code comments.** `scripts/check-build.js` carries its own
  purpose-stating header comment (per the code plan). Docs explain *why a
  maintainer runs the command and what they get*, not a line-by-line restatement
  of the guard's internals.
- **Commit format:** imperative, sentence case, no trailing period, agent name in
  parentheses — e.g. `Document the plugin-zip build command (doc-writer)`. One
  commit per task unless a task says otherwise.

---

## Task 1 — Document the `plugin-zip` command in the README's distribution section

**Goal:** A maintainer reading the README learns there is one command,
`npm run plugin-zip`, that produces an installable `piano-block.zip` at the repo
root; what the archive contains and excludes; that it builds first and fails loudly
on a broken build; and where the artifact lands. This is the primary user-facing
documentation surface for the feature.

**Audience:** Plugin maintainer (someone packaging a release / handing someone an
installable zip).

**Files:**
- Modify `README.md`.

**Sections-scope:**
- The README today has a `## Building & installing into an existing site` section
  (it currently tells the maintainer to `npm run build` and hand-copy the plugin
  directory including `build/`). Add the packaging command as the **recommended,
  single-command path** alongside (or just before) the manual copy instructions —
  do not delete the manual path; the zip is the convenient alternative. Cover, in
  prose matching the section's existing voice:
  - The command: `npm run plugin-zip`. State the **exact** script name and that it
    is the WordPress/`create-block` community-standard name (so a reader knows why
    it isn't `build:zip`).
  - **What it produces:** `piano-block.zip` at the repository root — a single
    top-level `piano-block/` folder containing exactly the runtime payload, which
    a WordPress user can upload/install directly.
  - **Build-first / fail-loud:** the command builds the block fresh before
    archiving and **aborts with a non-zero exit (no zip written) if the build is
    missing or incomplete**, so it can never silently ship a blockless archive.
    State this as behavior, not as a spec citation.
  - **What's included vs excluded** at a high level: included = the main plugin
    file, the generated `build/` directory, and `README.md` (plus `languages/` if
    it ever exists); excluded = source (`src/`), dependencies, config, tooling, and
    all project/process files. Frame exclusion as the **default** (allowlist /
    safe-by-omission) so a reader understands new files under `build/` are picked
    up automatically with no edits. Do **not** reproduce the full include/exclude
    enumeration from the spec verbatim — summarize; the authoritative include set
    is the standard WordPress plugin layout.
  - **Idempotency:** re-running overwrites the existing `piano-block.zip` cleanly.
  - That the generated zip is git-ignored (so it never gets committed) — one
    sentence, cross-referencing the Scripts entry rather than re-explaining.
- Keep this section's length proportional to the existing sibling sections; this is
  a maintainer's quick path, not a deep-dive (the deep "why" lives in Task 3).

**Depends on:** none (can be written against the shipped `package.json` and a real
run). Should land before/with Task 2 so the Scripts list and this section agree.

**Traces to:**
- Spec R1 (single command, exact name), R2 (build-first/fail-loud), R3/R4
  (include/exclude), R5 (single root folder), R6 (output location, idempotency,
  gitignore).
- Design "Goal", "Architecture overview", "Command / config surface".
- Code plan Task 3 (the script), Task 4 (gitignore).

**Acceptance (how a doc-writer verifies accuracy against shipped code):**
- The documented command string `npm run plugin-zip` exactly matches the script
  name present in `package.json`.
- Running `npm run plugin-zip` in the worktree produces `piano-block.zip` at the
  repo root with a single `piano-block/` root folder — confirm by listing the
  archive (e.g. `unzip -l piano-block.zip`) that the documented included files are
  present (`piano-block/piano-block.php`, `piano-block/build/block.json`, a
  `piano-block/build/fonts/*.woff2`, `piano-block/README.md`) and that the
  documented excluded paths (`src/`, `node_modules/`, `package.json`, etc.) are
  **absent**. Any claim in the prose that fails this listing must be corrected or
  removed.
- The "fails if the build is missing/incomplete" claim is verified the way the
  code plan verifies it (guard exits non-zero when `build/block.json` is absent);
  the doc must not overstate (e.g. must not claim it validates `languages/` or runs
  e2e tests).
- No `.rp/`/spec/design/plan citation appears. The generated `piano-block.zip` is
  removed from the tree afterward (it is git-ignored; do not commit it).

---

## Task 2 — Add `plugin-zip` to the README's Scripts list

**Goal:** The `### Scripts` bullet list (under `## For contributors`) includes the
new command, so the README's canonical list of npm scripts is complete and a
contributor scanning the scripts sees it.

**Audience:** Contributor (someone building / developing the plugin).

**Files:**
- Modify `README.md` (the `### Scripts` subsection only).

**Sections-scope:**
- Add one bullet, in the exact existing format
  (`` - `npm run plugin-zip` — … `` ), placed sensibly relative to the other build
  entries (e.g. after `npm run build`, since it wraps the build). The one-line
  description states what it does in the list's terse style: build the block, then
  produce the installable `piano-block.zip` at the repo root (the generated zip is
  git-ignored).
- Do **not** restate the full include/exclude detail here — that belongs in the
  Task 1 distribution section; this is the one-line catalog entry. A short
  cross-reference to the distribution section is acceptable if it matches how other
  bullets behave (most are self-contained one-liners — prefer that).

**Depends on:** Task 1 (so wording is consistent between the Scripts bullet and the
distribution section; do this immediately after, or together).

**Traces to:**
- Spec R1 (single command, exact name); R6 (output, gitignore).
- Design "Command / config surface".
- Code plan Task 3.

**Acceptance:**
- The new bullet's command name matches `package.json` exactly and uses the
  surrounding bullets' `` `npm run X` — description `` format (tabs/markdown
  consistent with neighbors).
- The description is accurate against a real run (produces `piano-block.zip` at the
  repo root) and does not contradict the Task 1 section.
- No `.rp/`/spec/design/plan citation appears.

---

## Task 3 — Document the packaging mechanism and the two hard constraints for contributors

**Goal:** A contributor who might *change* the packaging understands how it works
(the three-stage build → guard → archive chain and why each stage exists), where
the guard lives (`scripts/check-build.js`), and — critically — the two constraints
that must not be broken: **do not add a `files` field to `package.json`**, and
**run `wp-scripts plugin-zip` bare from the repo root**. This is the drift-guard
documentation that prevents a future contributor from silently breaking what the
zip includes.

**Audience:** Contributor / future maintainer of the build tooling.

**Files:**
- Modify `README.md` (the `## For contributors` area — add a short subsection,
  e.g. `### Packaging a release`, or fold into `### The build model` /
  alongside `### File layout` and `### Scripts`, whichever reads most naturally
  with the existing structure). Match the existing subsection depth (`###`).

**Sections-scope:**
- **How packaging works** (kept proportional, prose like the existing
  `### The build model`): `npm run plugin-zip` runs three stages joined so that any
  failure aborts the rest —
  1. it reuses the repo's `npm run build` (single source of truth for how the
     plugin builds — note it does **not** re-implement the build);
  2. it runs the committed guard `scripts/check-build.js`, which asserts the build
     actually produced the block before archiving;
  3. it invokes `@wordpress/scripts`' built-in `plugin-zip` archiver, which selects
     files by the standard WordPress plugin-layout **allowlist** (so exclusion is
     the default and new files under `build/` are captured automatically).
- **Why the guard checks `build/block.json` specifically** (one or two sentences,
  not a restatement of the file's header comment): `block.json` is the keystone
  WordPress loads to register the block, and because the build keeps `build/fonts/`
  across rebuilds, a partial build can leave fonts behind with no block — a bare
  "is `build/` non-empty?" check would wrongly pass that. Frame this as the reason
  the guard exists, complementing (not duplicating) the in-file comment.
- **Constraint 1 — never add a `files` field to `package.json`.** Explain the
  consequence in plain terms: the archiver uses the safe WordPress plugin-layout
  allowlist **only while `package.json` has no `files` field**; adding one silently
  switches it to a different file-selection mode and would change (and likely
  break) what the zip contains. Make this an explicit, prominent "do not" so a
  contributor adding `files` for an unrelated reason is warned.
- **Constraint 2 — run `wp-scripts plugin-zip` bare, from the repo root.** No
  flags; running from the repo root is what lands `piano-block.zip` at the root and
  produces the `piano-block/` folder. Note this so nobody "helpfully" adds flags or
  changes the working directory.
- **Add `scripts/check-build.js` (and the new `scripts/` directory) to the
  `### File layout` table** with a `| Path | Role |` row describing the guard's
  role: the build-payload guard run before archiving. (If the table is the natural
  home, this satisfies "where the guard lives" without a separate paragraph.) Note
  in the role text that `scripts/` is outside the plugin payload and so is
  automatically excluded from the zip.

**Depends on:** Task 1 (the user-facing command is introduced there; this is the
deeper contributor view). Best authored after Tasks 1–2 so cross-references resolve.

**Traces to:**
- Spec R2 (build-first/fail-loud rationale), R3/R4 (allowlist inclusion / default
  exclusion), R6, R7 (standard-layout allowlist).
- Design "The chosen approach and why" (all subsections), "Command / config
  surface" (the two explicit non-changes), "Technical decisions … risks #2, #3".
- Code plan Task 1 (guard), Task 3 (chain), and the "Explicit non-changes" block.

**Acceptance:**
- Every mechanism claim is checkable against shipped files: the three-stage chain
  text matches the actual `scripts.plugin-zip` string in `package.json`; the guard
  description matches what `scripts/check-build.js` actually checks
  (`build/block.json` existence) and does not claim checks it does not perform;
  the `### File layout` row's path (`scripts/check-build.js`) exists.
- The "no `files` field" constraint is verifiable: confirm `package.json` has **no**
  `files` field today (so the doc describes the real, relied-upon state), and the
  doc's stated consequence (allowlist vs. the alternative mode) matches the
  archiver's documented behavior.
- The doc does **not** duplicate the guard's in-file header comment verbatim; it
  explains rationale at a complementary altitude.
- No `.rp/`/spec/design/plan citation appears anywhere (AGENTS.md rule). Terms like
  "keystone", "allowlist", "safe-by-omission" are fine; identifiers like `R2`,
  `AC2`, `design §`, `T1` are not.

---

## Task 4 — Verify the `.gitignore` change is self-documenting (no separate doc; confirm + cross-reference)

**Goal:** Ensure the maintainer-facing docs correctly state that the generated zip
is git-ignored, and that the `.gitignore` rule itself carries its explanatory
comment (the rule is its own documentation). No standalone doc file is created for
this — it is a verification-and-cross-reference task to keep the docs honest.

**Audience:** Maintainer / contributor (reading the README; or reading
`.gitignore`).

**Files:**
- Read `.gitignore` (no edit expected — the code plan's Task 4 adds the commented
  rule). Touch `README.md` **only** if Tasks 1–2 did not already state the zip is
  git-ignored.

**Sections-scope:**
- Confirm the shipped `.gitignore` contains the anchored, **commented** rule
  (`# Distribution artifact (generated by \`npm run plugin-zip\`)` then
  `/piano-block.zip`). This comment is the rule's documentation; do not move it
  into the README or duplicate it.
- Confirm exactly one of Tasks 1/2 states, in one clause, that `piano-block.zip` is
  git-ignored. If neither does (e.g. wording shifted during review), add that
  single clause to the most appropriate spot. Avoid stating it in multiple places.

**Depends on:** Task 1, Task 2 (so the cross-reference target exists), and the
code-side `.gitignore` change (code plan Task 4) being in the tree.

**Traces to:**
- Spec R6 (artifact added to `.gitignore`).
- Design "Why an anchored `.gitignore` rule".
- Code plan Task 4.

**Acceptance:**
- `.gitignore` has the anchored `/piano-block.zip` rule with its descriptive
  comment; `git check-ignore -v piano-block.zip` matches that rule, and after a
  real `npm run plugin-zip`, `git status --short` does not list the zip.
- The README states the zip is git-ignored in exactly one place, with wording that
  matches the actual rule (anchored single file `piano-block.zip`, not a broad
  `*.zip`). The doc does not claim a `*.zip` rule that isn't there.
- No `.rp/`/spec/design/plan citation appears.

---

## Ordering summary

1. **Task 1** — README distribution-section documentation of `npm run plugin-zip`
   (the primary maintainer surface).
2. **Task 2** — add the `plugin-zip` bullet to the README `### Scripts` list
   (deps: 1, for consistent wording).
3. **Task 3** — contributor-facing packaging mechanism + the two hard constraints
   + `### File layout` row for the guard (deps: 1).
4. **Task 4** — confirm the git-ignore wording and the self-documenting
   `.gitignore` comment; cross-reference (deps: 1, 2).

All four tasks edit `README.md` (except Task 4, which mostly verifies), so they are
sequenced to avoid conflicting edits and to keep cross-references resolvable. No new
top-level doc file is created; everything folds into the README's existing
maintainer/contributor surface, matching house style. `docs/` is untouched (it is
reserved for the song-format reference).
