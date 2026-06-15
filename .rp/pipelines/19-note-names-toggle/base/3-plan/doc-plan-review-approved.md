# Doc Plan Review

## Verdict: approved

## Summary

The revised plan resolves the single blocking defect from review 1 (the unmapped
README "Forthcoming" section and the line-223 mislabel) cleanly and completely,
and a fresh adversarial pass surfaced no new blocking problems. The plan is
complete, drift-resistant, traceable, feasible, and correctly scoped to
documentation only.

### The prior blocking issue is genuinely resolved

1. **Forthcoming section assigned to Task 4 with correct scope.** Task 4's
   "Sections / scope" now has a dedicated bullet for the real Forthcoming section
   ("lines 233-240; the opener at line 235 reads 'Song *storage*, **visual
   authoring**, and front-end **notation rendering** have landed, …'"). It
   directs the doc-writer to update the "what has landed on the frontend" framing
   so it acknowledges the frontend's first viewer-operable control, keep it
   drift-resistant (describe the outcome, not exact wording), keep it consistent
   with the names-off byte-identity scope, and leave the planned-but-not-in-v1
   list (audio playback, richer notation) untouched.

2. **Line 223 relabeled as Additive-growth (not Forthcoming).** Task 4's bullet
   for line 223 now reads "The Additive-growth contributor paragraph stating the
   frontend 'reads neither' `language` nor `name` (line 223)". The
   `language`-now-stale fix is preserved and the `name` half is correctly left
   true. The word "Forthcoming" no longer appears on this bullet, so a doc-writer
   can no longer mistake the line-223 edit for the Forthcoming fix.

3. **Coverage check maps the Forthcoming summary → Task 4.** The coverage check
   gained a dedicated row: "README — 'Forthcoming' section 'what has landed'
   summary (frames the frontend as render-only; now gains its first viewer
   control): Task 4." The mapping is now complete.

4. **Overview categorizes the Forthcoming framing under drift-repair, and Task 4
   gained an evaluable acceptance criterion.** The Overview folds the Forthcoming
   "what has landed on the frontend" summary into job 2 (Repair drift), correctly
   identifying it as a passage that frames the frontend as
   notation-rendering-only — not an unassigned promise in job 1 as before. Task 4
   added an evaluable, behavioral acceptance criterion: "The 'Forthcoming'
   section's 'what has landed' summary no longer frames the frontend as
   notation-rendering-only / with no viewer controls; it acknowledges the
   frontend's first viewer-operable control. The planned-but-not-in-v1 list
   (audio playback, richer notation) below it is unchanged."

### Cited README line references confirmed against the live file

- Line 5 Status summary, line 13 "interactive block" paragraph, line 49 "same
  notation the published page uses", the "What the front end shows" section
  (74-86), the contributor file-layout table (167-189) with the `src/render.php`
  "childless" row at 177 and the `src/view.js` row at 178, the Render-contract
  "childless wrapper" passage at 225, the Tests byte-identical passage at 231.
- Line 223 is the **Additive growth (no `version` field)** paragraph — confirmed,
  matching the plan's corrected label.
- The Forthcoming section runs lines 233-240; its opener at line 235 reads
  verbatim "Song *storage*, **visual authoring**, and front-end **notation
  rendering** have landed, but the audible and richer interactive piano
  experience has not." — confirmed exactly as the plan cites. The
  planned-but-not-in-v1 list is at lines 237-238.
- `docs/song-format.md`: `language` section 48-62 with the "future work" bullet
  at 61, the additive-growth "reads neither" at 424, the `name` section 106-124
  (with the frontend-ignores-`name` line at 123), the note-name-systems section
  378-397, the intro frontend sentence at line 9 — all confirmed.
- `src/block.json`: description at line 9, keywords at line 10 — confirmed.
- The four source headers in `view.js`, `song/normalizeStep.js`,
  `editor/noteNames.js` (and the referenced `render.php`) match the plan's
  descriptions of what is currently stated and now stale.

### Fresh adversarial pass — no new blocking problems

- **Coverage** is complete: every documentation surface (README user/contributor
  sections, the Forthcoming summary, `docs/song-format.md`, `src/block.json`, the
  source headers) maps to a task, and the deliberately-unchanged surfaces
  (`AGENTS.md`, the plugin PHP header, `package.json`, the absent CHANGELOG, the
  pure layout/constants comments) are each justified.
- **Traceability** holds: each task cites spec FRs/ACs, design decisions, and
  code-plan tasks, and the citations are consistent (e.g. Task 4 → FR4/FR13,
  AC3/AC10, Key Decisions 2/3, Code-plan Tasks 3/6).
- **Drift-resistance** holds: every acceptance criterion is behavioral; no
  function signatures, context-key names, directive attribute names, or label
  strings are pinned. The new Forthcoming acceptance is behavioral.
- **No contradiction risk** between Task 1 (additive coverage in the frontend
  section) and Task 4 (drift repair in the same section): both tasks explicitly
  flag the shared file and direct the doc-writer to coordinate wording for the
  byte-identity scope and the `language` consumption.
- **The two precision points** (names-off byte-identity is scoped, not removed;
  names are bare steps with the accidental glyph unchanged) are stated up front
  and threaded through every task's acceptance.
- **No-code-tasks**: all tasks are documentation only; Task 7 touches source only
  to repair narrative file-header comments that are inaccurate after the merge,
  not behavior.

### Minor, non-blocking observation (no fix required)

Task 4 attributes both quoted phrases "the score itself shows only the music" and
"the front end … decides whether to render" to "lines 76, 84"; both phrases
actually sit on line 84 in the live file (line 76 is the section opener). This
does not mislead the doc-writer: the plan explicitly instructs a re-sweep because
line numbers shift, both quoted phrases are real and within the named "What the
front end shows" section, and the scope is unambiguous. It does not rise to a
blocking defect.
