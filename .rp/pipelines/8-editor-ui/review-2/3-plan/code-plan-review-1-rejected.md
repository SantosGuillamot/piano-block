# Code-plan review 1 — REJECTED (editor UI, review-2)

**Verdict:** Rejected — one concrete, pervasive tooling-command defect that breaks
the verification gate of every task. The plan's design alignment, sequencing,
boundary discipline, and Req/AC coverage are otherwise sound (details below), so the
fix is mechanical and the plan should re-submit, not be redesigned.

---

## Blocking issue

### B1 — `npm test` is not a script in this repo; every task's acceptance gate is wrong

The plan instructs code-writers to run **`npm test`** to verify the unit layer. It
appears in the global **Conventions** block:

> - **Unit tests** run with the repo's existing jest setup (`npm test`). The baseline
>   is **green: 548 tests / 19 suites**; every task must leave the full suite green …

and in the **Acceptance** block of **every** task (T1 line 132, T2 173, T3 223, T4
265, T5 375, T6 468, T7 546, T8 607) and the closing KD5/Task-summary acceptance.

`package.json` defines **no `test` script**. The scripts are:

```
"test:unit": "wp-scripts test-unit-js",
"test:e2e":  "wp-scripts test-playwright",
"env:start": "wp-env start",
"lint":      "biome lint .",
```

`npm test` therefore errors with `npm error Missing script: "test"` — it does not
fall through to `test:unit`. A code-writer running the plan verbatim hits a failing
command on the verification step of all eight tasks. This is exactly the class of
tooling-command trap the brief calls out (it flagged `wp-scripts lint-js` for lint;
the test command is the analogous mistake).

**Fix (mechanical, applies to T1–T8 + Conventions + KD5/summary):** replace every
`npm test` with **`npm run test:unit`**. The e2e references already correctly use
`npm run test:e2e` and `npm run env:start`, and the lint references correctly use
`npm run lint` (biome) — leave those as-is. Also re-confirm the "548 tests / 19
suites" baseline is the output of `npm run test:unit` (the number itself is not
re-verified here; only the command is wrong).

This is the **only** blocking finding. No task needs restructuring.

---

## Verified-correct (no change required) — recorded so re-review is fast

The following load-bearing claims were checked against the live `src/` and hold:

- **KD1 editor-only hit-rect boundary (T1).** `renderSvg(model, { accessibleName =
  "" } = {})` and `renderInto(container, model, options)` are the real signatures
  (`svg.js:235`, `:275`). `view.js:134` calls `renderInto(container, model, {
  accessibleName })` with **no** `interactive` flag; with the flag defaulting false
  and threaded only down `renderSystem → renderMeasure → renderHand →
  renderNote/renderRest`, the front-end SVG stays byte-identical. The only `svg.js`
  change is the gated rect. `render.php` (`src/render.php`) treats `song` as an
  opaque string (escapes only `<` → `<`, never parses), so a stored `language`
  rides along with **zero** front-end render change (AC12) and **no** `render.php`
  change.
- **No selectionQuery shadowing.** `selectionQuery` is
  `[data-measure="N"] [data-hand="…"][data-event-index="…"]` (`selection.js:150`).
  T1 stamps the rect with `data-hit` only (no `data-hand`/`data-event-index`), so the
  query cannot match the rect; `is-selected` still lands on the `<g>`. Correct.
- **KD1 regression test targets the real signature.** Today's unit click test does
  `clickNode(group.firstChild ?? group)` (`SongCanvas.test.js:144`) — the glyph-child
  habit the design critiques. T1's new behavioral test correctly dispatches a click
  whose `target` is the `[data-hit]` rect (off-ink), not a glyph child or bbox center.
- **Hit-rect geometry.** `STAFF_HEIGHT_SP = 4` exists (`constants.js:25`); the local
  `[−STAFF_HEIGHT_SP − N, 0 + N]` span and the conservative `~2 sp` width centered on
  `note.x` are arithmetically sound and avoid neighbor-gap resolution.
- **Hard sequencing (T6/T7).** T7 `Depends on` lists **T5 and T6**, and removes the
  `__canvas-actions` add-grid in the *same* task that wires the Structure-view
  measure-row "Add note" first-note entry point. No committed state strands an empty
  measure. The existing e2e "adding a note on the canvas stores it in the chosen
  hand" (`specs/editor.spec.js:281`, using the "Add note to right hand in measure 1"
  button T7 deletes) is the one T8 rewrites into the Structure-view path — correctly
  identified.
- **Schema change is only the additive permissive `language` enum (T2).** The
  validator's enum walker emits an informational "is not one of the allowed values
  […]" (`validate.js:120`) and `edit.js`'s raw-JSON branch persists unconditionally,
  so a bad value never blocks saving (AC11/AC14). No `required` change.
- **Language conversion is steps-only (T3).** `mapSong` rewrites `pitch.step` via the
  existing `stepInSystem` and sets `language`, leaving `handConfig.alters` keys
  English-canonical — consistent with `inferNoteNameSystem`/`SYSTEMS` keys
  (`"spanish"`/`"english"`, `noteNames.js:32`). Default-by-inference does not stamp
  `language` in `newSong()`, preserving the lazy-seed `song===""` contract.
- **Lifted mutators + factories (T5).** `newSection`/`newMeasure`/`removeAt`/
  `replaceAt`/`insertAt` all exist (`songModel.js`). `edit.js`'s `onAddNote` reads
  `sectionIndex/measureIndex/hand/eventIndex`, which the kind-tagged `"event"`
  resolved object still carries, so the reuse composes. The current `onAddMeasure`
  does hardcode the last section (`edit.js:174`), so T5's added `sectionIndex` arg is
  a real, necessary change.
- **StructureList pattern (T6).** `AnnotationList` (`AnnotationList.js`) is the real
  controlled-row + trailing `AddButton` precedent; section-highlight is derived via
  `measureNumbersForSection` (new) over `measureCoords`, with no `data-section` emit —
  inside the Req 15 boundary.
- **Linter.** Biome (`biome.json`, `"lint": "biome lint ."`). The plan correctly
  forbids `wp-scripts lint-js` and uses `npm run lint`.
- **Coverage.** Every spec Requirement 1–19 and AC 1–15 is named in some task's
  "Traces to"; T8 additionally back-stops the full range.

---

## Required action

Fix **B1** only: replace `npm test` with `npm run test:unit` in the Conventions
block, in T1–T8's Acceptance blocks, and in the KD5/Task-summary acceptance line.
Re-submit. No design, sequencing, or coverage changes are needed.
