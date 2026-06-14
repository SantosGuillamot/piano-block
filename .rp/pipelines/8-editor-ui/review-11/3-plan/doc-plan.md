# Doc Plan — Review 11: section-remove e2e drift fix, stale-SCSS cleanup, first-run discoverability, and cheap simplifications

Piano block editor-UI feature ([Issue #8](https://github.com/SantosGuillamot/piano-block/issues/8), PR #22). Branch `worktree-8-editor-ui`.

This plan covers the **documentation impact of this run's shipped behavior** (findings B1–B5 from `1-spec/spec.md` and `2-design-doc/design-doc.md`, the code shipped per `3-plan/code-plan.md` T1–T10). It is honest about scope: most of B1–B5 is test edits, SCSS comments, and small editor-side code with **no external doc surface**, so this plan is mostly verified-no-op tasks that record "nothing to change" — plus one real README accuracy update for B4.

## Doc surface inventory (what shipped docs exist)

| Surface | Audience | Touches editor behavior? | This run's relevance |
| --- | --- | --- | --- |
| `README.md` | Plugin users + contributors | Yes (the "Using the Piano block" authoring workflow) | **B4** — the fresh-block first-note story; B1 already accurate |
| `docs/song-format.md` | Song authors (format reference) | No (format/schema only) | None — no format change this run |
| `AGENTS.md` | AI / automated contributors | No (workflow guidance only) | None |

Out of the doc surface entirely: `src/editor.scss` comments (B2/B3) and the `src/edit.js` / `src/editor/inspector/SectionPanel.js` code+comments (B5) are **internal source**, not shipped docs, and are owned by the code phase (T1, T2, T7, T8). `.rp.md` is the pipeline's own internal conventions file, not a user/contributor doc. The song format, `render.php`, and front-end SVG are unchanged this run — a published song renders byte-identically — so no front-end / format doc moves.

## Shipped-artifact rule (AGENTS.md)

Every doc edit MUST describe **shipped behavior in plain, standalone terms**. No `.rp/` reference, no `AC#` / `Req#` / task IDs (`T#`), no commit shas (`4f3ed90`), no pipeline-phase tokens (`S5`/`S7`/"entry A/B"), no "review N", no finding labels (`B1`..`B5`) in any shipped doc. (Those labels appear in THIS plan only to trace tasks; they never reach `README.md`.)

## Coordinate convention

Line numbers are **evidence / starting points, not frozen coordinates** — they shift as edits land. The writer re-confirms each site by reading/grepping the live file before editing.

---

## DT1 — README: state that a fresh block opens with the first section + first measure already expanded (B4)

**Goal.** Update the "Using the Piano block" workflow so it accurately reflects the shipped first-run behavior: on a freshly inserted block, the seeded first section and first measure are **already expanded**, so the first measure's per-hand "Add note" buttons are reachable immediately — without any manual chevron-expand. Today's README promises "nothing to press first — you start adding notes straight away" (`:27`) and tells the reader the per-hand "Add note" button "is how you seed the first note of an otherwise empty measure" (`:33`), but it never says those buttons are visible on a fresh block without first expanding two rows. The shipped seed now makes the promise literally true; the README should say so.

**Audience.** Plugin users following the visual-editor authoring workflow (the "Using the Piano block" section), and, secondarily, contributors who read the same section to understand the editor's first-run UX.

**Files.**
- `README.md` — the "### 2. Build the song in the visual editor" subsection: the fresh-block paragraph (currently `:27`), the "Browse and select with the structure tree" paragraph (currently `:29`, which describes the tree as "open by default" and rows as "expandable and collapsible"), and the "Add, remove, and duplicate from the tree" paragraph's per-hand "Add note" clause (currently `:33`).

**Sections-scope.**
- Add an accurate, brief statement that a freshly inserted block opens with the **first section and first measure already expanded**, so the first measure's Right-hand / Left-hand rows and their "Add note" buttons are visible immediately (reinforcing the existing "start adding notes straight away" promise rather than contradicting it).
- Keep it consistent with the existing facts already in the section: the tree is "open by default" (`:29`), sections and measures are "expandable and collapsible" (`:29`), and the per-hand "Add note" button "is how you seed the first note of an otherwise empty measure" (`:33`). The new sentence connects those: the relevant section + measure start expanded, so that "Add note" button is reachable on the first screen.
- Scope to a fresh / freshly-inserted block. Do NOT over-claim (the seed pre-expands only the **first** section and its **first** measure, not every row; the hand rows themselves are not auto-expanded — but their "Add note" button sits on the hand row, visible once the measure is expanded). Do NOT introduce any "Start a song" CTA language — no such CTA shipped; auto-expand is the whole mechanism.
- Prefer folding the statement into the existing fresh-block paragraph (`:27`) and/or the "Add note" clause (`:33`) over adding a new paragraph — keep the section's length and voice.

**Depends on.** The shipped B4 source change (the two-key unconditional expansion seed in `src/edit.js`, code-plan T3) and its e2e confirmation (T10) — write to the verified shipped behavior, not the plan's intent.

**Traces to.** B4 (first-run discoverability), AC-B4-a. Design §5.1–§5.2.

**Acceptance.**
- The README "Build the song in the visual editor" section states, in plain user-facing terms, that a freshly inserted block shows the first section and first measure already expanded, with the per-hand "Add note" buttons reachable without manual expansion.
- The statement is accurate to the shipped seed: only the first section + first measure are pre-expanded; no claim that hand rows or other rows auto-expand; no "Start a song" CTA language.
- No contradiction introduced with the existing "open by default" / "expandable and collapsible" facts; the section's voice and length are preserved.
- No `.rp/` / `AC#` / `T#` / commit / phase / "B4" tokens appear in the README.
- Gated by review against the shipped editor behavior (the writer confirms a fresh block opens with Section 1 + Measure 1 expanded, e.g. via the design doc §5.1–§5.2 and the green `:469` e2e flow).

---

## DT2 — Verify the section-remove docs already match the immediate / undo-reversible behavior (B1) — verified-no-op

**Goal.** Confirm that no shipped doc still claims a section-remove **confirm dialog** / "click OK to confirm" prompt. B1 is a **test-only** drift fix (the two stale Playwright e2e clicks); the user-facing remove behavior — immediate and undo-reversible, no prompt — did not change this run and was already documented correctly in a prior review's doc pass.

**Audience.** Plugin users (the remove behavior in the authoring workflow).

**Files.**
- `README.md` — the "Add, remove, and duplicate from the tree" paragraph (currently `:33`, "Remove happens immediately at every row level (no prompt) … any removal — a section included — can be reversed with the editor's normal undo") and the Section panel's "Remove section" clause (currently `:39`, "discards the section and everything in it directly (no prompt), recoverable with the editor's normal undo").
- `docs/song-format.md`, `AGENTS.md` — confirm neither references a remove confirm dialog.

**Sections-scope.**
- Re-grep the shipped docs for `confirm` / `dialog` / `prompt` / `OK`. Confirm the only matches are the **already-correct** "(no prompt)" / "directly (no prompt)" statements in `README.md:33` and `:39`, which accurately describe the immediate, undo-reversible behavior — NOT a stale confirm-dialog claim.
- **Expected outcome: nothing to change.** This is a deliberate verified-no-op. Record explicitly that the section-remove docs already match the shipped immediate / undo-reversible behavior, so the doc-writer does not invent an edit. If — contrary to expectation — a stale confirm-dialog claim is found, fix it to the immediate / undo-reversible story in plain terms (no `ConfirmDialog` / `OK` / pipeline tokens).

**Depends on.** None (read-only verification against shipped behavior).

**Traces to.** B1 (section-remove e2e drift, the user-facing remove behavior). AC-B1 (behavior the docs describe). Design §2.

**Acceptance.**
- A grep of `README.md`, `docs/song-format.md`, `AGENTS.md` for `confirm` / `dialog` / `prompt` / `OK` surfaces only the already-correct "(no prompt)" / "directly (no prompt)" remove statements — no stale confirm-dialog/"real dialog" claim in any shipped doc.
- The verification is recorded as a no-op (nothing changed) OR, if a stale claim is found, it is corrected to the immediate / undo-reversible story in plain terms.

---

## DT3 — Verify B2 / B3 / B5 have no shipped-doc impact — verified-no-op

**Goal.** Record explicitly that the three remaining findings touch only **internal source** (SCSS comments and small editor-side JS), with **no shipped-doc surface**, so no `README.md` / `docs/song-format.md` / `AGENTS.md` edit is warranted.

**Audience.** N/A (internal-source-only changes; this task documents the absence of doc impact, not a doc change).

**Files.** None edited. Verification targets:
- `README.md`, `docs/song-format.md` (confirm no claim depends on the changed internals).

**Sections-scope.**
- **B2 (stale SCSS prose).** The deleted "on-canvas add affordances" language lived only in `src/editor.scss` comments — an internal source file owned by code-plan T1, not a shipped doc. The README already describes adds correctly (they live in the structure tree row menus and the sidebar Song/Section/Note panels and the per-hand "Add note" button — `README.md:33`, `:37`, `:39`), with no "on-canvas add affordance" claim. Nothing to change.
- **B3 (`:first-child` SCSS comment + inline 4em).** A comment-only fix in `src/editor.scss` plus untouched inline `minWidth: "4em"` styles — internal source (code-plan T2), no shipped-doc surface. The README's contributor "File layout" note for `src/editor.scss` describes it generically ("the workspace layout, structure tree, canvas, and selection highlight" — `:146`) and does not cite the `:first-child` rationale or the `min-width` values, so it stays accurate. Nothing to change.
- **B5 (drop dead default arg; derive `keep` from `OVERRIDE_KEYS`).** Two no-behavior-change simplifications in `src/edit.js` and `src/editor/inspector/SectionPanel.js` — internal source (code-plan T7, T8). The README's `src/edit.js` File-layout row mentions `onAddMeasure` as a mutator the Section panel signals (`:142`) but documents none of its parameter defaults, so it stays accurate. Nothing to change.
- **Expected outcome: nothing to change.** Deliberate verified-no-op recording that B2/B3/B5 are internal-source-only.

**Depends on.** None (read-only verification).

**Traces to.** B2, B3, B5. AC-B2-a/b, AC-B3-a/b, AC-B5-a/b/c (all gated by unit + build, not by docs). Design §3, §4, §6.

**Acceptance.**
- Confirmed (and recorded) that B2/B3/B5 touch only internal source with no shipped-doc surface; the README's generic `src/editor.scss` and `src/edit.js` File-layout rows remain accurate and are left unchanged.
- No edit to `README.md`, `docs/song-format.md`, or `AGENTS.md` for B2/B3/B5.

---

## Coverage check

| Finding | Doc task | Outcome |
| --- | --- | --- |
| **B1** (section-remove e2e drift, test-only) | DT2 | Verified-no-op (README already says "no prompt" / immediate / undo-reversible) |
| **B2** (stale SCSS prose, comment-only) | DT3 | Verified-no-op (internal `src/editor.scss` only) |
| **B3** (`:first-child` SCSS comment, comment-only) | DT3 | Verified-no-op (internal `src/editor.scss` only) |
| **B4** (first-run auto-expand) | **DT1** | **Real README update** (fresh block opens with first section + measure expanded) |
| **B5** (cheap simplifications, no behavior change) | DT3 | Verified-no-op (internal `src/edit.js` / `SectionPanel.js` only) |

One real doc edit (DT1, for B4); two verified-no-op records (DT2 for B1, DT3 for B2/B3/B5). `docs/song-format.md` and `AGENTS.md` need no change this run (no format change; no workflow-guidance change). No `.rp/` / `AC#` / `Req#` / `T#` / commit / phase token reaches any shipped doc.
