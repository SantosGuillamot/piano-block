# Review 8: Address the unified PR review — fix the TreeGrid a11y/CSS/component-prop bugs and apply the reuse & simplification cleanups

_Review 8 of the Piano block editor-UI feature ([Issue #8](https://github.com/SantosGuillamot/piano-block/issues/8), PR #22). Self-contained: later phases work from this prompt and the current code on the branch — not from the `base/` or `review-1..7/` artifact folders._

## Owner verdict

> Run another review for the unified review comment on PR #22, and address **everything** — the Must-fix items, the Should-do reuse/simplification items, and the Optional/nice-to-have polish.

The owner wants this review run to act on the full set of numbered findings (1–20) plus the Optional items, while respecting the review's own "Explicitly fine as-is" list (those are decisions already validated — do not undo them).

## Origin

This review is driven by a unified code-review comment the owner posted on PR #22, synthesized from four independent reviews (simplification, Gutenberg component usage, styles, editor reusability) plus a synthesis pass that verified each finding against the code at commit `078356f`.

Convenience link: https://github.com/SantosGuillamot/piano-block/pull/22#issuecomment-4688846321

> **Summary (from the review).** The architecture is sound: pure controlled components, a single `commitSong` path, kind-tagged selection, and pure primitives (`songModel.js`, `selection.js`, `noteNames.js`) that are genuinely reusable. The reviews converge on four priority actions, all verified against the code: (1) the TreeGrid adoption is incomplete in two ways that defeat the accessibility it was chosen for (no keyboard expand/collapse, no accessible name in production — both masked by the jest mocks); (2) all ~119 new lines of editor-UI CSS ship to site visitors because `block.json` wires only `"style"`; (3) every Button/control is missing `__next40pxDefaultSize` (console deprecation warnings on current WP) and `__nextHasNoMarginBottom` is passed to `NumberControl`, which doesn't accept it; (4) `edit.js` hand-rolls ~300 lines of immutable splices that re-implement the `setSectionAt`/`setMeasureAt`/`setEventAt` helpers this same PR added to `songModel.js`, and `StructureTree.js` copy-pastes a ~55-line actions menu three times. Roughly 400–600 lines can be removed with no behavior change.

Note on provenance vs. current code: the findings were verified at `078356f`. This branch has since merged `trunk` (a config-only commit touching `.gitignore` and `.rp.md` — no `src/` changes), so every file/line reference below still applies to the current source. Spec/design research must re-confirm exact line numbers against the live tree, since they will have shifted as fixes land.

## What the review asks for

The owner wants every item below addressed. The file/line references are the review's evidence; treat them as starting points to confirm, not as frozen coordinates.

### Must fix

1. **Keyboard/screen-reader users can never expand a section or measure row.** `src/editor/StructureTree.js:569` renders `<TreeGrid label={...}>` with neither `onExpandRow` nor `onCollapseRow`; the real TreeGrid only fires expansion on Left/Right arrows *through those callbacks* (default no-ops). The only expansion affordances are the `aria-hidden` pointer-only chevron (`StructureTree.js:87-101`) and, on hand rows only, the label button (`:416`). The component's own docblock (`:10-12`, `:37-38`, `:72-74`) claims Left/Right works "for free" — it does not. Fix: pass `onExpandRow`/`onCollapseRow`, mapping row → expansion key via a `data-` attribute on each `TreeGridRow` (core List View's `data-block` pattern). The jest mock swallows these callbacks (`test/mocks/wordpress-components.js:448-451`) and the e2e expands by clicking the chevron class (`specs/editor.spec.js:316-335`), so add a test that exercises the real path.

2. **The tree has no accessible name in production.** `TreeGrid` has no `label` prop — its named props are `onExpandRow`/`onCollapseRow`/`onFocusRow`/`applicationAriaLabel`; everything else spreads onto the `<table>`, so `label` lands as a meaningless DOM attribute. The mock maps `label` → `aria-label` (`test/mocks/wordpress-components.js:456`), masking it. Fix: pass `aria-label={__("Song structure", …)}` at `StructureTree.js:569`, **and fix the mock to stop translating `label`** so the test surface matches the real prop surface (the mock's "helpfulness" is what hid both this and item 1).

3. **Editor-only UI rules ship to the front end.** All 119 new lines in `src/style.scss` (`:29-146` — workspace, tree, canvas, `.is-selected`) are editor-only, but `src/index.js:4` imports `style.scss` and `src/block.json:17` wires only `"style"` (no `editorStyle`) — visitors download dead CSS (~80% of the new stylesheet). Fix: move the editor rules to a new `src/editor.scss` imported from `index.js` (wp-scripts emits `build/index.css`), add `"editorStyle": "file:./index.css"` to `block.json`. Keep the `@font-face` (PB Music) and pre-existing wrapper rules in `style.scss`. Works in the iframed editor (apiVersion 3).

4. **Missing `__next40pxDefaultSize` everywhere; bogus `__nextHasNoMarginBottom` on `NumberControl`.** Zero occurrences of `__next40pxDefaultSize` across the PR — every Button, SelectControl, TextControl, NumberControl, TextareaControl (`SongPanel.js:63-79`, `NotePanel.js:134-261`, `MeasurePanel.js:89-156`, `SectionPanel.js:116-156`, `ContextEditor.js:136-179`, `HandConfigEditor.js:116-182`, `PitchEditor.js:61-89`, `MetadataEditor.js:44-55`, `AnnotationEditor.js:31-51`, `ListControls.js:26`, `InvalidState.js:46-48`, `edit.js:528-538`). On WP 6.8+ this logs deprecation warnings and renders legacy 36px controls. Also `edit.js:528-538` `TextareaControl` lacks `__nextHasNoMarginBottom`. Conversely, `__nextHasNoMarginBottom` is passed to `NumberControl` at `ContextEditor.js:143,166`, `HandConfigEditor.js:141,168`, `PitchEditor.js:77,88`, `NotePanel.js:188` — `NumberControl` has no such prop and forwards unknown props to the `<input>`, producing React unknown-prop dev warnings.

5. **README claims "no new runtime dependency" — false.** `README.md:143` says so, but `package.json:31-33` adds `"dependencies": { "@wordpress/icons": "^10.32.0" }` — the project's first runtime dependency, and it is *bundled* (not in the wp-scripts externalization set). The dependency itself is fine and standard — fix the doc, not the dep.

### Should do — simplification & reuse

6. **`edit.js` mutators: use the `set*At` helpers the PR itself added.** `edit.js` rebuilds `working.sections.map(...)` inline 8 times (`:211-216, 271-274, 285-288, 319-324, 359-362, 383-389, 441-444, 474-480`) and never imports `setSectionAt`/`setMeasureAt`/`setEventAt` (`songModel.js:341-403`), while the panels already use them (`SectionPanel.js:90`, `MeasurePanel.js:67`, `NotePanel.js:104`). Replace each two-level rebuild with the helpers; for the four note-level mutators, add one `updateHandEvents(song, coords, fn)` helper where returning `null` drops the hand key — encoding `onRemoveNote`'s empty-hand rule (`edit.js:311-318`) once. ~120-150 lines.

7. **Extract the triplicated row-actions menu in `StructureTree.js`.** The Duplicate / Add before / Add after / destructive Remove `DropdownMenu` is copy-pasted at `:202-256`, `:313-368`, `:479-559`, differing only in label and bound coordinates. One `RowActionsMenu({ cellProps, label, onDuplicate, onAddBefore, onAddAfter, onRemove })` removes ~140 lines. The repeated chevron+label cell (`:183-201`, `:288-312`, `:405-422`) can fold into the same pass if cheap.

8. **Delete the dead `interactive` hit-rect feature in the notation core.** `renderSvg`/`renderInto` accept `interactive` (`src/notation/svg.js:283-331`), threading it through 6 functions to `hitRect` (`:250-260`), plus `HIT_RECT_WIDTH_SP` (`svg.js:64`) and `HIT_RECT_VERTICAL_MARGIN_SP` (`constants.js`). No production caller passes it — `SongCanvas.js:160-163` and `view.js:134` explicitly render without it; only tests reference it. All new in this PR — built for canvas click-to-select that the design then moved to the tree. Delete (~140 prod+test lines); restore from history if canvas hit-testing ever lands.

9. **Extract the editor/front-end mirrored helpers instead of duplicating.** `src/editor/accessibleName.js` duplicates `view.js:56-85` verbatim; `SongCanvas.js:38-77, 179-201` duplicates `view.js`'s `NARROW_CONTAINER_PX`/`NARROW_SP_PX`/`availableWidthInSp`/`drawWhenFontReady` and the rAF-debounced ResizeObserver. The docblocks justify duplication via "can't import view.js" — true, but the fix is extraction, not copying: move `accessibleNameFor` to `src/song/accessibleName.js` and the width/font/resize helpers to `src/notation/dom.js`; both entries import. ~90 lines removed; the silent-drift risk (editor announcing a different name than the published page) is eliminated, and no test currently pins that parity.

10. **Stamp `kind` at the last untagged producer; delete the compat branch.** `edit.js:218` is the only `setSelection` call without `kind`. Add `kind: "event"` there, then delete the defaulting block `selection.js:144-153`, its docs (`:120-125`), and the compat test (`selection.test.js:238-246`).

11. **Drop the second parse in `edit.js`.** The `accessibleName` memo (`edit.js:145-154`) re-parses `song` although the `working` memo (`:161-166`) already did, and `validateSong` already treats unparseable JSON as a conformance error. Replace with `song.trim() === "" ? "" : accessibleNameFor(working?.metadata)` and reduce `isInvalid` (`:182-183`) to `song.trim() !== "" && errors.length > 0`.

12. **Unify the omit helpers; re-home `emit.js`.** `MetadataEditor.withField` (`MetadataEditor.js:23-31`) re-implements `omitFalsy` (`emit.js:49-58`) minus the trim, so a whitespace-only Title persists while a whitespace-only Section name is dropped — same rule, divergent behavior. Replace `withField` with `omitFalsy`; inline the trivial wrappers `emitBlock` (`emit.js:69-71`) and `emitMember` (`ContextEditor.js:58-60`) as direct `onChange(omitEmpty(...))` calls. Move `emit.js` to `src/editor/emit.js` — `ContextEditor.js:45` (a non-inspector component) currently imports across the `inspector/` boundary.

13. **Collapse the duplicated annotations drop-key wrappers.** `NotePanel.js:231-238` and `MeasurePanel.js:138-145` become one-liners via the existing omit helpers, and the inconsistent onDeselect pair (`NotePanel.js:226` via `changeOptional` vs `MeasurePanel.js:130-133` inline destructure) should use one idiom.

14. **`HandConfigEditor`: use the shared array helpers** (the PR's own self-admitted item). Local `replaceRow` (`:188-192`) ≡ `replaceAt`; `rows.filter((_, i) => i !== index)` (`:173`) ≡ `removeAt`; the spread-append (`:180`) ≡ `insertAt`. It already imports from `songModel.js` — just import three more names.

15. **One `NONE_OPTION`, one source for note-name options.** `NONE_OPTION` ("None") is declared twice (`NotePanel.js:63`, `MeasurePanel.js:37`); `{ label: "—", value: "" }` is a third idiom (`ContextEditor.js:150,173`, `HandConfigEditor.js:119`) — a barline says "None" while a clef says "—". Export one `NONE_OPTION` from `songModel.js`. Also `ALTER_KEY_OPTIONS` (`HandConfigEditor.js:37-40`) rebuilds `noteNameOptions("english")` (`noteNames.js:114-117`) — reuse it.

16. **Standardize on `@wordpress/icons` elements.** `ListControls.js:26` (`icon="plus"`), `PitchList.js:47`, `AnnotationList.js:61`, `HandConfigEditor.js:171` (`icon="trash"`) use Dashicon slug strings while `StructureTree.js` uses element icons — two icon systems in one PR, and the PR's own history (per the realIcons test header) shows the slug pattern rendering as an empty square in the canvas iframe. Import `plus`/`trash`; in `AddButton` (`ListControls.js:24-29`) drop the redundant `label`; add `isDestructive` to remove buttons.

17. **`#007cba` → admin theme color.** `src/style.scss:142-144` (3 occurrences): use `var(--wp-admin-theme-color, #007cba)` so the selection highlight follows the admin scheme. While relocating per item 3, trim `__canvas` (`style.scss:114-120`) to its load-bearing `flex: 1 1 auto; min-width: 0` (`SongCanvas` renders exactly one child, so `flex-direction`/`gap` are no-ops), and delete the unused `__song-input` hook (`edit.js:537`; no CSS or test targets it) plus the stale comments at `style.scss:33-36`.

18. **Fix comments that reference code that doesn't exist.** `NotePanel.js:26-27,108-110` (`EventRow`), `MeasurePanel.js:18` (`MeasureEditor`/`BarlineControl`), `SectionPanel.js:17` (`SectionEditor`), `selection.js:115` (`repairPath`), `accessibleName.js:4` (`SongPreview`), and the StructureTree docblock's false keyboard claims (with item 1). Strip pipeline-provenance tags (`KD 14`, `T6`, `AC3`…) while there.

19. **Drop the duplicated `<h3>` heading.** `ContextEditor.js:198,257` render a raw `<h3>`; the only caller passing `heading` is `SectionPanel.js:138-142`, which duplicates the wrapping `ToolsPanelItem`'s "Section overrides" label. Remove the `heading` prop and the `<h3>`s.

20. **Extract the revealAncestors trio.** The identical three-key reveal at `edit.js:220-224, 399-403, 490-494` becomes one `ancestorKeys(coords)` helper in `selection.js` (which already owns `expansionKey`); it can also own the inline event-key construction at `StructureTree.js:443`.

### Optional / nice to have

- **Lighten the real-icons jest infrastructure** (`jest.config.js:46-125` two-project config + React dedup mapper; `StructureTree.realIcons.test.js`, 264 lines). It guards a real shipped regression, so don't just delete it — but the same invariant is testable cheaply: make `test/mocks/wordpress-icons.js` export non-string sentinels, then one assertion in the regular tests that no icon-bearing component received a string `icon`. Deletes ~360 lines while keeping the net; stronger once item 16 makes "no string icons" the rule.
- **Unify the hand vocabulary** — `songModel.js:95-98` (`STAVES`), `StructureTree.js:64` + `:382-385`, `ContextEditor.js:182,189,230,241` all restate rightHand/leftHand keys/labels; one `HANDS` export would do.
- **`HandConfigEditor` label composition** (`:96` raw `${label} ${field}` concat, lowercase fragments) isn't reorderable for translators; switch to sprintf templates like the rest of the PR.
- **Spacing for bare-div rows and adjacent buttons** (`PitchList.js:40`, `AnnotationList.js:54`, `HandConfigEditor.js:144`; button pairs in `NotePanel`, `SectionPanel`, `SongPanel`, `InvalidState`): use `Flex`/`HStack`. Pure polish.
- **`ToolsPanel` nested inside `PanelBody`** (Note/Measure/Section panels): double disclosure + padding; core convention is ToolsPanel as its own group. Works as-is — design judgment.
- **Unused/test-only exports**: `newRest` (`songModel.js:200`), `BPM_MIN_EXCLUSIVE` (`songModel.js:120`; `ContextEditor.js:140-142` hardcodes `min={1}`), `toNumber`, test-only `serializeSong` export, `measureCoords` export, unused `ToggleControl`/`__experimentalTreeGridItem` mocks.
- **Follow-up issue (pre-existing, out of scope)**: the wrapper's dashed placeholder border (`style.scss:24-27`) now frames real sheet music on the front end. (The review flags this as pre-existing/out of scope — note it but do not necessarily fix it here.)

## Explicitly fine as-is (do not change)

The review validated these as correct decisions. Do not "fix" them:

- **The tree CSS** (`style.scss:56-108`): TreeGrid ships unstyled; the custom indentation, truncation, and `#ddd` hairline are the right call — reusing core `.block-editor-list-view-*` classes would couple to private markup.
- **The `aria-hidden` pointer-only chevron** mirrors core's `ListViewExpander` and is correct — *once item 1 restores the keyboard path*.
- **`DropdownMenu` `toggleProps` roving-tabindex forwarding** is the correct List View pattern.
- **The three `set*At` faces stay distinct** — `songModel.js:326-334` documents why a depth-inferring splice would corrupt the song.
- **`ContextEditor`'s draft/projection model** is genuinely needed (multi-field required sub-objects), not duplication to unify away.
- **No generic `EditableList`** over PitchList/AnnotationList/HandConfigEditor — different invariants (min-one, collapse-to-undefined, map-derived rows); revisit only if a fourth list appears.
- **Notation ink hard-coding and the shared render path** are deliberate and correct; `.is-selected` is safely scoped.
- **Workspace flex via SCSS** rather than a `Flex` component — matches how core styles the List View; not worth churn.
- **Component placement** (panels in InspectorControls, toggles in BlockControls, in-canvas tree) is right; List View has no per-block slot for intra-block data.

## Constraints carried over

- Use only libraries WordPress already provides (the `@wordpress/*` packages available to blocks); no new outside dependencies. (`@wordpress/icons` is already a bundled dependency on this branch.)
- The change stays editor-side: the **song format/schema, `render.php`, and the front-end SVG rendering are unchanged** — a published song renders byte-identically before and after this review. (Items 8 and 9 touch `src/notation/` and `view.js` only to remove dead code and de-duplicate shared helpers; the rendered output must remain identical, pinned by tests.)
- Preserve the wins from prior reviews: select-only labels, single expansion Set, coordinate keys, `[aria-level]` indent, recolor-only highlight, TreeGrid keyboard model and accessibility parity, raw-JSON mode untouched.
- "Tests green" must remain incompatible with "real component broken": where a fix depends on a real `@wordpress/components`/`@wordpress/icons` contract (items 1, 2, 16), the verification must exercise the real contract, not only the jest stubs — and the mock changes in items 1, 2, and the Optional real-icons item must keep that guarantee intact.
