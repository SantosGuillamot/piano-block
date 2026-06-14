# Doc Plan Review

## Verdict: rejected

## Summary

The plan is strong: its correctness pins are right (names-OFF stays byte-identical
with a *scoped* qualifier, not a deleted guarantee; names are bare steps with the
accidental glyph unchanged; the frontend now consumes `language`), its file/line
references check out against the live docs (README line 5 Status, line 13
"interactive block", line 49 "same notation the published page uses", the
"What the front end shows" section at 74-86 incl. lines 76/84, the contributor
file-layout table 167-189 with the `src/render.php` "childless" row at 177 and the
`src/view.js` row at 178, the Render-contract "childless wrapper" passage at 225,
the Tests byte-identical passage at 231; `docs/song-format.md` `language` section
48-62 with the "future work" bullet at 61, the additive-growth "reads neither" at
424, the `name` section 106-124; `src/block.json` description line 9 / keywords
line 10; and the four source headers in `view.js`, `render.php`,
`song/normalizeStep.js`, `editor/noteNames.js`). The out-of-scope calls
(`AGENTS.md`, the plugin PHP header, `package.json`, no CHANGELOG, pure
layout/constants comments) are all justified and correct. Per-task acceptance is
behavioral and drift-resistant (no function names, attribute names, or label
strings pinned). The `src/edit.js:166-167` parity expression the plan leans on is
confirmed (`working?.language ?? inferNoteNameSystem(working)`).

There is one real defect that blocks approval: a documentation surface the plan's
own Overview promises to cover — the README **Forthcoming** section — is never
assigned to any task, and the one line the plan labels as the "Forthcoming"
mention (line 223) is actually a *different* passage (the Additive-growth
contributor paragraph). The genuine Forthcoming prose at lines 235-240 is left
unmapped, so a doc-writer following the plan would leave it stale. Fix the
coverage and the mislabel and this plan is ready.

## Issues

### Issue 1 — The README "Forthcoming" section is promised in the Overview but assigned to no task; the cited "Forthcoming" line is actually the Additive-growth paragraph

**What's wrong**
The Overview (job 1, line 21) lists "the 'Forthcoming' framing" as one of the
surfaces this doc work must cover. But no task's "Sections / scope" names the
actual Forthcoming section. Task 4 cites "The 'Forthcoming'/additive-growth
mention that the frontend 'reads neither' `language` nor `name` (line 223)" — yet
line 223 is the **Additive growth** paragraph inside the contributor "song format
and validator" section, NOT the Forthcoming section. The real Forthcoming section
runs lines 233-240; its opening sentence (line 235) reads: "Song *storage*,
**visual authoring**, and front-end **notation rendering** have landed, but the
audible and richer interactive piano experience has not." That "what has landed on
the frontend" summary now under-states the shipped state: this feature adds the
**first viewer-operable interactive control on the frontend** (a point the plan
itself stresses in its Overview line 8 and Task 3). The Forthcoming "has landed"
list will silently omit that milestone, and nothing in the plan tells a doc-writer
to touch it.

The mislabel compounds the gap: a doc-writer executing Task 4 edits line 223,
reasonably believes they handled the "Forthcoming" item the Overview named, and
never opens the real Forthcoming section — leaving line 235 stale.

**Where in plan**
- Overview, line 21 (promises "the 'Forthcoming' framing").
- Task 4, "Sections / scope", lines 256-258 (cites line 223 and calls it the
  "'Forthcoming'/additive-growth mention").
- Coverage check, lines 458-468 (maps README coverage to Tasks 1-4 but never names
  the Forthcoming section).

**Suggestion**
Separate the two passages and assign both. Keep the line-223 Additive-growth fix
where it is (it is correctly the `language`/`name` "reads neither" line), but
re-label it as Additive-growth, not Forthcoming. Then add explicit scope — most
naturally to Task 4 (it owns README drift repair) — for the real Forthcoming
section (lines 233-240, opener at 235): update the "what has landed on the
frontend" framing so it acknowledges the frontend now carries its first
viewer-operable control (the note-name toggle), proportionately and without
contradicting the byte-identity scope used elsewhere. Add a Forthcoming row to the
coverage check so the mapping is complete. Keep the acceptance drift-resistant
(behavioral: "the Forthcoming summary no longer frames the frontend as
notation-rendering-only / no viewer controls").

**Why it matters**
This is exactly the drift the plan exists to prevent: a passage that, after the
feature ships, frames the frontend as render-only. The Overview promised to cover
it, but the task breakdown does not, and the misattributed line number actively
steers the doc-writer away from it. Without this fix the README ships internally
inconsistent — Tasks 1-3 add a viewer control while the Forthcoming summary still
implies the frontend only renders notation — which is the precise contradiction
Task 4's own acceptance criterion ("No README passage … states or implies the
frontend is render-only") forbids.
