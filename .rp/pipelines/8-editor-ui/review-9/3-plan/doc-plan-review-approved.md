# Review 9 — Doc Plan Review: APPROVED (doc-plan-reviewer, iteration N=1)

**Verdict: APPROVED.** `doc-plan.md` is accurate, complete, correctly drift-resistant, pinned
to the shipped code/emitted artifact (not the plan's intentions), at the right audience/altitude,
and free of over-documentation. No material defects found. Every claim below was independently
verified against the live worktree (`worktree-8-editor-ui`, tip `c7a25d1`) — the README, the
real source files, the build output, `AGENTS.md`, and `docs/song-format.md` — not taken on the
plan's word.

## What I verified

### Completeness — every doc-relevant change is covered; every no-op claim is correct

- **D1–D5 cover the five items with a real README surface** (M1+polish6 → D1; S2 → D2;
  S5+S7+S6-confirmation → D3; polish3 Rename → D4; S9 → D5). Coverage check (plan §"Coverage
  check") maps every spec/design item to a task or an explicit no-op; I re-derived it and it holds.
- **No-doc items independently confirmed to have no stale repo-doc surface:**
  - **S1/S3** (control-label renames): `grep` of `README.md` for "Right hand clef", "Note name",
    "Annotation placement/text/staff", "Alteration note" finds **no control-label citations**. The
    only hits ("octave shift"/"clef"/"accidentals" at `:41`, "note name" *language* at `:51`) are
    descriptive prose about the musical model, not quotations of the inspector control labels — so
    nothing goes stale. Correct no-op.
  - **S4** (trash-icon alignment/CSS): no "trash"/"align" anywhere in `README.md`. Correct no-op.
  - **S8** (`EditableList`) / **S10** (`resetAll`) / **S9-internal** (`safeParse`): none of these
    symbols appear in `README.md`. Correct no-op.
  - **Polish 5** ("no new dependencies"): `README.md` carries **no** "no new dependencies" claim;
    `:143` already correctly states `@wordpress/icons` is "a bundled `@wordpress/*` runtime
    dependency." The false claim lives only in the GitHub PR description (orchestrator's close-out).
    The plan correctly assigns no README task and flags it as out of doc scope. Correct.
  - **S6** (deferred): `README.md:29` already says "a section/measure canvas indication is a later
    follow-up." The plan keeps it (D3 only *confirms* the line stays accurate; nothing documents S6
    as shipped). Correct.
- **`docs/song-format.md` and `AGENTS.md` truly stay accurate:** `grep` of both for
  border/`Advanced`/`validateSong`/"single entry point"/block-wrapper finds **no matches** —
  review-9 is editor-side, the format/render contract is unchanged, so neither needs an edit. The
  plan's "no edit" claim for both is correct.

### Correctness & accuracy — file/section scope and acceptance match the real docs

- **Every README line reference in the plan is exact**, confirmed line-by-line:
  - D2's "Advanced" passages: `grep "Advanced" README.md` returns **exactly** `:37, :38, :39, :41,
    :45` — matching the plan's D2 scope precisely.
  - D1 build-model `:131` ("the `@font-face` declaration plus the block-wrapper rules"), the
    `src/style.scss` table row `:145` ("the `@font-face` declaration and the block-wrapper rules"),
    the `src/editor.scss` row `:146`, the `src/index.js` row `:141` — all verbatim as the plan
    describes; `:131`/`:145` are genuinely the two lines that go FALSE after M1.
  - D4 menu enumerations `:19`, `:33`, and the contributor `src/editor/` row `:143` all list
    "Duplicate / Add before / Add after / Remove" verbatim.
  - D3 passages `:29` (selection + "later follow-up"), `:33` ("Remove"), `:39` ("Remove section").
  - D5 validator sentence `:181` ("The validator's single entry point, `validateSong(rawString)`").
- **Acceptance is pinned to the shipped artifact, not the plan's intent.** D1 requires the
  emitted `build/style-index.css` to be checked after `npm run build`; I confirmed this is the real
  contract — the current `build/style-index.css` carries both `@font-face` (must survive) and
  `.wp-block-piano-block-piano{border:1px dashed #767676;color:#767676;padding:1em}` (must be gone),
  so the doc-writer's emitted-CSS verification is meaningful and falsifiable. D2/D4/D5 acceptance
  each names the shipped source file whose exact strings must be confirmed.

### Drift-resistance — optional-item gating and real-contract facts

- **The code phase has not shipped yet** (verified: `src/style.scss:25-26` still has the border
  rule; all four panels still read `label={__("Advanced", …)}`; `validate.js` exports only
  `validateSong`; `RowActionsMenu` has no Rename `MenuItem`). The plan does **not** assume the code
  has shipped — every task's acceptance says "verify against the SHIPPED code, re-read before
  writing," and the §"Honesty / drift guardrails" section makes this explicit. This is exactly the
  drift-resistance the gate asks for.
- **D4 is correctly gated** on the Optional Rename item actually landing ("if polish 3 (T13) was
  not shipped… this task is **dropped**, not written speculatively" — plan D4 acceptance and the
  guardrails). No ungated dependency on an optional item.
- **D1's real-contract fact (the emitted `build/style-index.css`) is verified against the build,
  not assumed** — the plan instructs a build+grep, and I confirmed the artifact behaves as claimed.

### Audience / altitude — right audience, stays what/where/who, S6 not over-claimed

- Audiences are correct: D1/D5 contributor; D2/D3 end author; D4 author (+ secondary contributor
  table). Each task is WHAT/WHERE/WHO, not the prose itself.
- **Nothing documents the deferred S6 as shipped** — D3 only confirms the existing "later
  follow-up" line stays accurate and explicitly forbids claiming a canvas highlight now exists.
- **No workflow/artifact leakage:** the plan carries the `AGENTS.md` rule (no `S#`/`T#`/`M1`/"review
  N"/AC#/`.rp/` in README prose) as a standing rule and a per-task guardrail. `AGENTS.md` itself
  confirmed to contain exactly that rule.

### No over-documentation

- No tasks for "Explicitly fine as-is" items or unshipped behavior. Polish 1 (stale comment),
  polish 2 (`<Flex>` drop), polish 4 (microcopy) are correctly no-doc (README quotes none of them).

## Notes (non-blocking, no action required)

- D5 is correctly self-described as low-priority with a one-clause-tweak fallback ("drop 'single',
  add the `parseAndValidate` mention"). The parallel "single entry point" wording in
  `validate.js:4` (JSDoc) is a code-phase concern, not a README one, and is out of doc scope —
  correctly not assigned a doc task.

**Conclusion:** APPROVED. The doc-writer should execute D1–D5 as written, verifying each claim
against the shipped code and (for D1) the emitted `build/style-index.css`, and dropping D4 if the
Rename item did not land.
