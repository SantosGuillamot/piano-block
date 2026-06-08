# Code review — Review 2 (editor UI), batch T1–T8: APPROVED

**Verdict:** Approved.
**Reviewer:** code-reviewer (review-2).
**Diff base:** `e35b670..HEAD` (`e4db09e`). Eight commits, `1826214` (T1) → `e4db09e` (T8); T2 (`152b351`) re-verified after its cherry-pick — content present and correct.
**Gates:** `npm run test:unit` 602/20 green · `npm run lint` (biome) clean (62 files) · `npm run build` compiled successfully.

## Summary

The batch realizes the approved design (KD1–KD5) and the spec (Req 1–19, AC1–AC15)
faithfully, holds the format boundary, and routes every visual mutation through the
single re-validating `commitSong` spine. The selection fix (the crux) is implemented
exactly as designed and is pinned by a regression test that targets a real off-ink
point. I found no blocking issues and no out-of-scope crossings.

## Verification performed

### The crux — selection fix (Req 1–3; AC1, AC2)
- `hitRect(x)` in `src/notation/svg.js:251` emits a **filled-transparent**
  (`fill:"transparent"`) `<rect>` as the **first child** of each note/rest `<g>`
  (`renderNote` `svg.js:771`, `renderRest` `svg.js:918`), gated on `interactive`. It
  carries **only** `data-hit` — no `data-kind`/`data-hand`/`data-event-index` — so
  `closest('[data-kind]')` walks up to the enclosing `<g>` and `selectionQuery` is not
  duplicated. Width is a conservative `HIT_RECT_WIDTH_SP = 2` centered on the column X;
  vertical span is `[−STAFF_HEIGHT_SP − N, 0 + N]` with `N = HIT_RECT_VERTICAL_MARGIN_SP
  = 4` (`constants.js:34`), covering the design's stated bbox-center off-ink point
  `(1, −0.5)` for the seed note.
- The unit regression test (`SongCanvas.test.js:191`) dispatches a click whose
  `target` is the **hit-rect** (not `group.firstChild` ink), asserts the rect has no
  `data-hand`/`data-event-index`, and asserts the resolved `{kind:"event",…}` tuple —
  i.e. it exercises the real gap-click path the old test missed.
- The e2e (`editor.spec.js:404`) clicks at `position:{x: width/2, y: min(6, height/4)}`
  — an off-ink, in-column point — and asserts the Note panel is visible and the group
  gains `is-selected`. Empty-space click resolves to `null` → deselect (AC2,
  `SongCanvas.js:321` / test `SongCanvas.test.js:157`).

### Editor-only boundary (Req 15; AC12)
- `git diff --name-only` non-editor touches are **exactly** the two allowed: (a) the
  `interactive`-gated hit-rect + `HIT_RECT_VERTICAL_MARGIN_SP` in `svg.js`/
  `constants.js`, and (b) the additive permissive `language` enum in `schema.js`.
  `render.php`, `view.js`, and `block.json` are **unchanged**.
- `view.js:134` calls `renderInto(container, model, { accessibleName })` — **no**
  `interactive` flag → defaults false. `SongCanvas.js:276` passes `interactive: true`.
- **Empirically diffed the emitted SVG:** front-end (no flag) is **byte-identical** to
  `interactive:false`; it differs from the editor emit only by the N transparent
  `data-hit` rects (one per event); the front-end emit has **zero** hit-rects. The
  `render.spec.js:529` parity test asserts `[data-hit]` count 0 in the published DOM.

### Language (Req 10–15; AC9–AC11)
- `mapSong` (`noteNames.js:158`) rewrites `pitch.step` **only** via `stepInSystem`,
  copies `handConfig.alters` keys through unchanged (English-canonical), stamps
  `language: target`, builds immutably, and tolerates a malformed song (returns
  `{...song, language}`). `system = working?.language ?? inferNoteNameSystem(working)`
  (`edit.js:138`) — stored field authoritative, inference the fallback. `SongPanel`'s
  `SelectControl` (top-level, not behind Advanced) runs `mapSong` + commits. `newSong()`
  does **not** stamp `language` (default-by-inference). Round-trip + permissive
  validation confirmed by `validate.test.js` (accepts spanish/english, optional, a bad
  value yields one informational "not one of the allowed values" and never blocks).

### Structure view + contextual add/remove (Req 4–9; AC3–AC8)
- `StructureList` lists sections→measures (measure depth, no event rows, no move
  controls), with select/add/remove at both levels and the measure-row first-note
  "Add note" entry point (`onAddNote(si, mi, "rightHand")`). All `@wordpress/components`.
- Section highlight is **derived** via `measureNumbersForSection` (no `data-section`
  emit); `decorateSelection` branches by `kind` (`is-selected` / `is-active-measure` /
  `is-active-section`) with guarded `scrollIntoView`.
- **Sequencing constraint honored:** T7 (`1609036`) removes the canvas add-grid
  (`__canvas-actions`/`HANDS`) **and** adds the NotePanel "Add note" + the Structure
  measure-row "Add note" in the **same commit** — no intermediate state strands an
  empty measure. The lifted mutators live once in `edit.js`; panels and the list share
  them; selection-fallout is handled on remove.

### Conformance + deps (Req 16–19; AC13–AC15)
- Every visual mutation routes through `commit = commitSong(...)`; no second persist
  path. Raw-JSON branch untouched (stores unconditionally; the enum adds at most one
  informational line). All editor production imports are `@wordpress/*` or local
  relative (audited; none outside).

## Notes (non-blocking)
- The live **e2e was not run** (wp-env port conflict). The specs are authored against
  real selectors (the off-ink `position` click, the `is-active-*` canvas classes,
  `exact:true` to disambiguate the two "Add note" buttons, the `data-hit` parity
  assertion) and the unit/build/lint layers are fully green; the byte-identity claim is
  additionally verified empirically here. This is acceptable for this gate.
- Kind-tagged `resolveSelection` correctly preserves backward compat (untagged-complete
  → `kind:"event"`; untagged-partial → `null`).
