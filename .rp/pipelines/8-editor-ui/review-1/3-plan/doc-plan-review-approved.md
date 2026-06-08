# Doc Plan Review — Review 1 (Canvas-first editor UI): APPROVED

**Verdict:** Approved
**Reviewer:** doc-plan-reviewer
**Artifact reviewed:** `review-1/3-plan/doc-plan.md`
**Read for grounding:** `review-1/1-spec/spec.md`, `review-1/2-design-doc/design-doc.md`,
`review-1/3-plan/code-plan.md`, and the live repo docs (`README.md`, `docs/song-format.md`,
`AGENTS.md`).

## Summary

The plan correctly documents the actual review-1 behavior change — canvas-first editing on a single
interactive sheet-music surface, select-a-note-on-the-canvas, settings in the block sidebar
(`InspectorControls`: always-present Song panel; Note/Measure/Section on selection), progressive
disclosure of uncommon settings, add-notes-on-canvas with hand-by-staff, reordering omitted, a seeded
empty grand staff with no "start a new song" button, and raw-JSON editing unchanged. It does **not**
describe the old drill-down/breadcrumb/move-up-down/separate-preview UI except to mark that language
for removal. The editor-only boundary (format, front-end render, validator unchanged) is preserved as
a cross-cutting constraint and reflected in every task.

## Checks performed

- **Behavior accuracy.** Every claim the plan tells doc-writers to make matches the spec
  (Req 1–19, AC1–AC17) and the design/code plans — notably the add/remove placement (add-note +
  add-measure on the canvas; add/remove section, remove measure, remove note, chord pitch add/remove
  in the sidebar panels), reorder omitted, lazy editor-side seed, and the "canvas is the live render,
  not a second pane" framing. No task promises anything the shipped code won't support (no keyboard
  traversal beyond focus+Enter/Space; no direct measure/section selection; reorder dropped).

- **Grounding against the real repo.** Verified the plan's quoted "currently says" anchors exist:
  README Status blurb (L5), "What the block does today" preview bullet (L12), the
  `## Using the Piano block` intro + §2 drill-down/breadcrumb/move/read-only-preview language (L19,
  L35, L37), §3 raw-JSON "Song (JSON)" label/help (L48–L51), Forthcoming lead (L189), the file-layout
  `src/edit.js`/`src/editor/`/`__tests__` rows (L130–L132), the `specs/` row (L142), and
  `docs/song-format.md`'s editor-coupled clause (L9). Confirmed there is no `CHANGELOG`/`readme.txt`,
  so the "no changelog task" decision is correct.

- **Anchor integrity.** Confirmed the two inbound links from `docs/song-format.md`
  (`#using-the-piano-block` at L9; `#4-what-the-front-end-shows` at L9 and L315) target README headings
  the plan explicitly preserves (D2 keeps `### 4. What the front end shows`; the cross-cutting
  constraint forbids changing the linked slugs). Drift here is guarded.

- **Proportionality / scope.** Docs in scope are exactly `README.md` (primary) and
  `docs/song-format.md` (one editor-coupled clause). `AGENTS.md` and `.rp/**` are correctly out of
  scope. No invented docs; no out-of-scope content crept in. The validator/render-contract/build-model
  prose is explicitly left untouched.

- **No inline code-symbol docs.** D4 keeps the file-layout at "a role sentence per path," avoids a
  file-by-file inventory, and plans no JSDoc/inline-symbol documentation (that ships with phase-4
  code).

- **AGENTS.md compliance.** Every task's acceptance ends in "no pipeline references"; the cross-cutting
  constraints forbid spec/design/plan/`AC#`/`T#`/"review N" mentions in shipped docs.

- **Ordering / dependencies.** D1→D2→D3→D4 edit `README.md` sequentially (avoids clobbering); D5 is
  the sole `docs/song-format.md` edit and lands last, depending on D2/D4 so the README anchors it
  links to are final. Sound for single-tree sequential execution.

## Non-blocking note (no change required)

- **D2 scope parenthetical (minor).** D2 describes the `## Using the Piano block` *intro* as currently
  framing "visual editor … live preview … drill-down." The word "drill-down" actually lives in §2
  (README L35), not the intro (L19). This is a cosmetic looseness in the "currently says" description;
  it does not affect the task outcome, since D2's scope and acceptance already cover §2 and require
  removing drill-down/breadcrumb/move language there. Left as a note, not a defect.

## Verdict

Approved. The plan is complete, accurate against the live repo, drift-resistant, proportional, and
correctly ordered, and it honors the editor-only boundary and the no-pipeline-references rule.
