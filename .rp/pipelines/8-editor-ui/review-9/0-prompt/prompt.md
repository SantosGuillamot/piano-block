# Review 9: Stop the front-end placeholder-border leak and clean up the block-settings (inspector) UI, plus reuse/simplification cleanups

_Review 9 of the Piano block editor-UI feature ([Issue #8](https://github.com/SantosGuillamot/piano-block/issues/8), PR #22). Self-contained: later phases work from this prompt and the current code on the branch — not from the `base/` or `review-1..8/` artifact folders._

## Owner verdict

> Run another review for the unified review comment on PR #22, and address **everything actionable** — the Must-fix item, all the Should-fix items, and the Optional / nice-to-have polish.

The owner wants this review run to act on the full set of findings — the one **Must-fix** (M1), the ten **Should-fix** items (S1–S10), and the **Optional / polish** list — while respecting the review's own "Explicitly fine as-is" list (those are validated decisions — do not undo them). One nuance carried from the owner: **S6** (a canvas highlight for section/measure selections) is flagged in the review itself as a deferred follow-up worth a tracking issue; the spec phase decides whether to implement it now or open a tracking issue instead — it must not silently disappear.

## Origin

This review is driven by a unified code-review comment the owner posted on PR #22, synthesized from **four independent reviews** — simplification, Gutenberg-component usage, styles / block-settings UI, and overall behavior & UX — followed by a synthesis pass that verified every finding against the code at commit `c7a25d1` (and the `build/` output for M1).

Convenience link: https://github.com/SantosGuillamot/piano-block/pull/22#issuecomment-4698457155

> **Overall assessment (from the review).** Strong, well-architected PR. The structure tree sits on the real `__experimentalTreeGrid` (the same primitive core's List View uses), keyboard expand/collapse genuinely works (verified end-to-end in a real browser), the controlled-component split is clean, the empty/invalid/error states have no dead ends, and the shared helpers (`songModel`, `emit`, `edit`) already absorbed most of the duplication a reviewer would normally hunt for. **The architecture and accessibility are sound and need no rework.** The real work is concentrated in two places: **one front-end style bug that ships editor chrome to visitors**, and a **cluster of block-settings (inspector) UI problems** — redundant "Right hand / Left hand" label spam, generic "Advanced" panel names, cramped list rows with floating trash icons, and a few truncating labels. Everything else is polish.

Note on provenance vs. current code: the findings were verified against the source and `build/` output at `c7a25d1`, which is the current branch tip — so the file/line references below are fresh as of run start. They are nonetheless **evidence and starting points, not frozen coordinates**: spec/design research must re-confirm exact lines against the live tree, since they will shift as fixes land.

## What the review asks for

The owner wants every item below addressed (with S6 as noted above). The file/line references are the review's evidence; treat them as starting points to confirm, not as fixed coordinates.

### 🔴 Must fix

**M1. The dashed-gray "empty placeholder" border ships to the front end and frames published sheet music.** `src/style.scss:25-29` wires a `1px dashed #767676` border + `#767676` text color + `1em` padding on `.wp-block-piano-block-piano`, and `src/block.json:18` loads `style.scss` as `"style"` (front end *and* editor). Confirmed in the build: `build/style-index.css` contains `.wp-block-piano-block-piano{border:1px dashed #767676;color:#767676;padding:1em}`, while the editor bundle `build/index.css` does **not** carry it — a pure front-end leak. On the published page this wrapper holds the *finished* rendered SVG (`render.php:41` → `view.js:73` `renderInto` → `notation/svg.js:277` `replaceChildren`), so **every published piano block draws its sheet music inside a dashed-gray "empty block" placeholder box** with gray ink bleed and 1em padding — the `create-block` scaffold style leaking to visitors.
**Fix:** delete the `.wp-block-piano-block-piano { … }` rule from `src/style.scss` (finished music needs no chrome); keep the `@font-face` (the front-end SVG glyphs need the font). If an editor-only affordance is wanted, add a scoped version to `src/editor.scss` instead.

### 🟡 Should fix

**Block-settings (inspector) UI — the bulk of the user-visible payoff.**

**S1. Drop the redundant "Right hand / Left hand" prefix on every control.** `HandConfigEditor.fieldLabel` (`HandConfigEditor.js:101-109`) prefixes the hand name onto every control via `sprintf("%1$s %2$s", …)` → "Right hand clef", "Right hand octave shift", "Right hand alteration note", "Right hand alteration", and the verb-last button **"Right hand add alteration"** (`HandConfigEditor.js:195`). In the narrow inspector these wrap to 2–3 lines, then repeat for the left hand. In the `tiered` layout the prefix is **doubly redundant** — each hand already gets its own `ToolsPanelItem` titled "Right hand"/"Left hand" (`ContextEditor.js:219-239`). `fieldLabel` already returns the bare field name when no `label` is passed (`:109`), so stop passing it once a per-hand heading exists (tiered already has one; for the `flat` layout used by `SectionPanel`, wrap each `HandConfigEditor` in a titled group). Labels become "Clef", "Octave shift", "Alteration note", "Alteration", and the button **"Add alteration"**. Push the hand scope to `aria-label`/`help` if AT disambiguation is wanted.

**S2. Rename the four generic "Advanced" panels to domain names.** `NotePanel.js:157`, `MeasurePanel.js:93`, `SectionPanel.js:126`, `ContextEditor.js:195` are all literally titled "Advanced" (three can stack and all read identically). Use scoped names (e.g. "Note details", "Barlines & annotations", "Section overrides", "Tempo & staves"). Also collapse `SectionPanel`'s redundant double wrapper (`SectionPanel.js:125-142`: a `ToolsPanel label="Advanced"` whose single child is a `ToolsPanelItem label="Section overrides"`).

**S3. Shorten labels that wrap or truncate.** `PitchEditor.js:62` "Note name" → "Note"; `AnnotationEditor.js:32,39,48` drop the "Annotation" prefix → "Text" / "Placement" / "Staff" (the placement select currently truncates to "Ab…").

**S4. Fix the floating / misaligned trash icons in the list rows.** Rows are bare `HStack`s and `src/editor.scss` has **no** inspector rules at all, so a control with a 2-line label is taller than the fixed ~40px trash `Button` and the icon parks at the row top. Add `alignment="flex-start"` to `HandConfigEditor.js:158` (it has none — its trash floats mid-row, the worst case), and a small editor-only `__list-row` rule pinning the trailing trash to the input edge (`align-items: flex-end`; `flex: 0 0 auto` on the icon; `min-width` on the select). The bigger win is S1+S3 — once labels stop wrapping, the rows read cleanly with little CSS. Optionally give the per-row trash `size="small"`.

**Behavior & UX.**

**S5. Make a section/measure label click "select-and-reveal."** Confirmed from code + tests: the label `Button`'s `onClick` calls only `onSelect` (`StructureTree.js:141`); expand/collapse lives on the chevron and arrow keys, and the unit test pins this (`StructureTree.test.js:377-386`). It's **deliberate, not a bug** — but it diverges from core List View and is internally inconsistent, since hand-group rows *do* toggle on label click (`StructureTree.js:454`). Fix in `RowLabelCell` (`:136-144`, which already has the props): `onClick={() => { onSelect?.(); if (!isExpanded) onToggleExpanded?.(rowKey); }}` — select always, expand if collapsed, leave collapse to the chevron / ArrowLeft. Update the test. *(This is the "clicking the text doesn't toggle" behavior reported during review.)*

**S6. The canvas gives no feedback for a section/measure selection** — only an *event* selection paints `.is-selected` (`editor.scss:106-121`). Selecting "Measure 2" in the tree highlights nothing on the preview. Acknowledged as a deferred follow-up; it's the biggest "where am I?" gap. The spec phase decides: implement section/measure highlighting now, or open a tracking issue and defer — but do not drop it silently.

**S7. Destructive deletes have no confirmation or surfaced undo** (`StructureTree.js:205-214`, `NotePanel.js:254-263`, `MeasurePanel.js:143-150`, `SectionPanel.js:153-160`) — removing a section silently deletes all its measures/notes, relying entirely on the editor's global undo. At minimum confirm the section-level remove or surface undo as the recovery path.

**Simplification & reuse.**

**S8. Extract one `EditableList` for the triplicated list body.** `PitchList.js:36-65`, `AnnotationList.js:50-77`, and `HandConfigEditor.js:157-204` render the identical map → `HStack` → editor + trash `Button` → `AddButton` structure. `ListControls.js` already exports `AddButton` — add an `EditableList` there. **Parameterize the two opposite per-list rules** rather than unifying them: PitchList's `canRemove = items.length > 1` (note invariant, `PitchList.js:52-53`) and AnnotationList's collapse-empty-to-`undefined` (`AnnotationList.js:48`). ~35–40 lines, the only real repeated structure left. *(Note: review 8's "Explicitly fine" list previously argued against a generic EditableList; this review revisits that now that the repeated structure is the last one standing. Spec/design should weigh the two opposite invariants and decide whether parameterizing them into one component is a net simplification or whether the distinct invariants justify keeping them separate.)*

**S9. Remove the redundant second JSON parse per render.** `edit.js:140-143` runs `validateSong(song)` (which `JSON.parse`s internally, `validate.js:335`) and `edit.js:153-158` runs `safeParse(song)` (`edit.js:51-57`) — the same string parsed twice on every change. Have the validator expose the parsed object (`parseAndValidate → { data, errors }`) and delete `safeParse`. Touches `song/validate.js`'s public API, so sequence carefully against the existing tests (keep `validateSong(raw) → string[]`).

**S10. `SectionPanel.js:130-132` `resetAll` is exactly `emitOverrides({})`** — it repeats the override-strip destructure already in `emitOverrides` (`:108-111`). Replace with `resetAll={() => emitOverrides({})}`.

### ⚪ Optional / nice to have

- Stale comment at `edit.js:306-307` references a non-existent `NotePanel.removeEvent` (grep confirms no such symbol exists) — drop it.
- Single-child `<Flex>` wrappers (`SongPanel.js:78`, `InvalidState.js:46`) → drop or standardize on `HStack`.
- Add a "Rename" `MenuItem` to `RowActionsMenu` to match List View.
- Microcopy: `InvalidState` body text says "Switch to JSON" (`InvalidState.js:34`) while the button reads "Edit as JSON" (`:52`) — align the verb.
- `@wordpress/icons` *is* a new runtime dependency (`package.json:31-33`) — it's the right call, so fix the "no new dependencies" line in the PR description rather than the code.
- `editor.scss:9-16` duplicates the file header comment (`:1-6`) — trim one.

## 🟢 Explicitly fine as-is (do not change)

The review validated these as correct decisions. Do not "fix" them:

- **TreeGrid keyboard accessibility is correct and complete.** Independently verified: `aria-label` (`StructureTree.js:582`), `onExpandRow`/`onCollapseRow` → shared handler reading `data-expansion-key` (`:269-272, 583-584`), `isExpanded` + `data-expansion-key` on every expandable row, leaf notes correctly carrying neither, roving `cellProps` reaching one focusable per cell. A **real-browser Playwright test drives ArrowRight/ArrowLeft at section/measure/hand levels** (`specs/editor.spec.js:1129-1227`). The `aria-hidden` / pointer-only chevron is correct (mirrors core's `ListViewExpander`). Any "keyboard might be broken" concern is **refuted**.
- **`__next40pxDefaultSize` is universal** and **`__nextHasNoMarginBottom` is NOT wrongly passed to any `NumberControl`** (verified all 7). Element-imported icons, `isDestructive`, and `sprintf` + `__` i18n are all clean.
- **Load-bearing duplication that must stay:** the depth-fixed `setSectionAt`/`setMeasureAt`/`setEventAt` helpers (collapsing them would corrupt the song), `omitEmpty` vs `omitFalsy` (different rules), the per-panel `resetAll` key sets (different per level — only SectionPanel's is a same-file dup, S10), and the hand-group row's bespoke non-selecting label cell. No dead code or unused exports found.

## Constraints carried over

- The change stays **editor-side**: the **song format/schema, `render.php`, and the front-end SVG rendering are unchanged** — a published song renders byte-identically before and after this review. M1 only *removes* a leaked editor style from the front end; it must not alter how the SVG itself is drawn.
- Use only libraries WordPress already provides (the `@wordpress/*` packages available to blocks); no new outside dependencies. (`@wordpress/icons` is already a bundled dependency on this branch.)
- Preserve the wins from prior reviews: select-only labels (now extended by S5 to select-and-reveal), single expansion Set, coordinate keys, `[aria-level]` indent, recolor-only highlight, the TreeGrid keyboard model and accessibility parity, and raw-JSON mode untouched.
- "Tests green" must remain incompatible with "real component broken": where a fix depends on a real `@wordpress/components` / `@wordpress/icons` contract, the verification must exercise the real contract, not only the jest stubs. **M1 in particular is a build-output / front-end concern** — its verification must check the *emitted* CSS (`build/style-index.css` must no longer carry the wrapper rule; the front-end render is unframed), not merely the source `.scss`.
