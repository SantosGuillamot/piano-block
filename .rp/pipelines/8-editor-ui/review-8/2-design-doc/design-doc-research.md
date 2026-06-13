# Review 8 — Design research

Running record of the design-phase Q&A between `design-analyst-r8` and
`design-researcher-r8` for review-8 of the Piano Block editor-UI feature
(issue #8, PR #22).

This is a **review** run: the editor-UI feature already exists on this branch.
Review-8 layers a fixed set of behavior-preserving fixes + reuse/simplification
from a unified code-review comment, captured as the approved spec
(`.../review-8/1-spec/spec.md`, requirements R1–R20 + Optional O1–O5). The spec
and spec-research already resolved the *what* and most acceptance boundaries.
This phase settles the **HOW** on the live code: module boundaries, helper
shapes, APIs, data flow, ordering, and test strategy — recording each decision
with its evidence and trade-offs.

The design does **not** re-litigate settled requirements. It focuses on genuine
HOW choices, decided on the researcher's evidence.

---

## Live-tree anchors (analyst pre-scan)

Confirmed by reading the live source before framing questions:

- **`StructureTree.js`** (`src/editor/`, 573 lines): one `StructureTree` builds a
  flat `rows` array by walking `sections → measures → HANDS → events`. The
  `<TreeGrid label={…}>` is at `:569` with no `onExpandRow`/`onCollapseRow`. The
  triplicated `DropdownMenu` actions cell appears at section (`:202-256`), measure
  (`:313-368`), and note (`:479-559`) rows; the chevron+label cell repeats at
  `:183-201`, `:288-312`, `:405-422`. `TreeExpander` (`:81-103`) is the
  `aria-hidden` pointer-only chevron. `HANDS = ["rightHand","leftHand"]` (`:64`);
  hand labels restated `:382-385`. Inline event key `${handKey}e${eventIndex}`
  (`:443`).
- **`edit.js`** (`src/`, 631 lines): imports `insertAt`/`removeAt`/`duplicateAt`/
  `newX` from `songModel.js` but NOT `setSectionAt`/`setMeasureAt`/`setEventAt`.
  The eight inline two-level `sections.map(...)` rebuilds confirmed at onAddNote
  `:211-216`, onAddMeasure `:271-274`, onRemoveMeasure `:284-288`, onRemoveNote
  `:319-324`, onDuplicateMeasure `:360-362`, onDuplicateNote `:384-389`,
  insertMeasureAt `:442-444`, insertNoteAt `:475-480`. The empty-hand drop rule
  is inline in `onRemoveNote` `:311-318`. The `accessibleName` memo re-parses
  `song` (`:145-154`); `working` memo parses it (`:161-166`); `isInvalid` `:182-183`.
  `revealAncestors(...)` trio called at `:220-224, 399-403, 490-494`.
- **`selection.js`** (`src/editor/`): owns `expansionKey` (`:40-49`), the compat
  block in `resolveSelection` (`:144-156`) + its docs (`:120-125`). `measureCoords`
  exported (`:67`) but used internally by `globalMeasureNumber` (`:91`).
- **`songModel.js`** (`src/editor/`): `set*At` faces (`:341-403`) each take
  `(song, coords, nextX)` and READ ONLY their own coords (documented invariant,
  `:326-333`); `STAVES` (`:95-98`); `BPM_MIN_EXCLUSIVE = 0` (`:120`); `newRest`
  (`:200`); `toNumber` exported (`:149`) but used by `toBoundedInt` (`:166`).
- **`SongCanvas.js`** (`src/editor/`): local `availableWidthInSp`
  (`container?.clientWidth ?? 0`, `:52-57`), `drawWhenFontReady` (`:67-77`),
  rAF-debounced ResizeObserver returning a cleanup (`:179-201`).
- **`view.js`** (`src/`): `accessibleNameFor` (`:56-80`) + `trimmedString`;
  `availableWidthInSp` (no `?` — `container.clientWidth ?? 0`), `drawWhenFontReady`;
  a forever-lived rAF ResizeObserver calling `draw()` directly.

---

## Q&A log

### Q1 — TreeGrid `onExpandRow`/`onCollapseRow` wiring + `data-*` key scheme (R1, R20)

**Load-bearing evidence (Gutenberg `packages/components/src/tree-grid/index.tsx`
keydown handler, confirmed by researcher).** The component gates each callback on
the focused row's current expansion state:
- ArrowRight calls `onExpandRow(activeRow)` ONLY when the row is collapsed
  (`aria-expanded === "false"` / `data-expanded === "false"`); on an expanded row
  it moves focus to the next cell instead — `onExpandRow` never fires on an
  expanded row.
- ArrowLeft calls `onCollapseRow(activeRow)` ONLY when the row is expanded; on a
  collapsed row it moves focus to the parent row — `onCollapseRow` never fires on
  a collapsed row.
- Both props default to `() => {}` (silent no-op) — the root cause of bug 1.
- The sole argument is the active DOM `<tr>` (`HTMLElement`).

**Decision Q1-a — toggle-on-both, one shared handler, no add-only/delete-only
guard.** Because the component only fires expand-on-collapsed and
collapse-on-expanded, a single `onToggleExpanded(key)` (add-if-absent /
delete-if-present) is correct and idempotent for BOTH callbacks: expand only ever
fires when the key is absent (toggle adds), collapse only when present (toggle
deletes). The gate reads the SAME `aria-expanded` the component already emits from
`TreeGridRow`'s `isExpanded` (`StructureTree.js:181,286,403`), itself derived from
`expanded.has(key)`, so the gate and the Set cannot disagree. Point both
`onExpandRow` and `onCollapseRow` at one shared in-component handler — cleaner than
two near-identical guarded handlers, and the safety is guaranteed by the component
contract, not by our code. (Worst case even if mis-fired: one wrong toggle, never
corruption — but the contract precludes it.)

**Decision Q1-b — `data-expansion-key` kebab literal, read with `getAttribute`.**
`TreeGridRow` destructures `children/level/positionInSet/setSize/isExpanded` and
spreads `...props` onto the `<tr role="row">` (real `row.tsx`; the jest mock
matches at `test/mocks/wordpress-components.js:471-490`), so a `data-*` attribute
lands on the row in both real and mocked surfaces. **Author it as the kebab literal
`data-expansion-key={key}` in JSX and read it with
`activeRow.getAttribute("data-expansion-key")`.** Pin: React/JSX does NOT auto-kebab
`data-*` props — `data-expansionKey` would emit the literal lowercased
`data-expansionkey` (a silent mismatch trap). The kebab literal is exactly core List
View's `data-block` idiom. Only the three expandable rows (section/measure/hand)
carry it; the leaf note row (`StructureTree.js:451-457`, no `isExpanded`, no
`aria-expanded`) must NOT carry it, keeping "leaf rows have no expansion affordance"
structurally true (A1).

**Decision Q1-c — extract a pure `expansionKeyOf(row)` reader into `selection.js`;
the StructureTree handler is a thin wrapper.** `selection.js` exports
`expansionKeyOf(row)` = `row?.getAttribute?.("data-expansion-key") ?? null` — pure,
DOM-arg-only, no React; the symmetric inverse of `expansionKey()` (one writes the
key onto the row, the other reads it back), co-located so the whole key contract
lives in one file (reinforces Guardrail A). StructureTree's handler closes over
`onToggleExpanded`:
```
const onExpandCollapseRow = (row) => {
  const key = expansionKeyOf(row);
  if (key) onToggleExpanded?.(key);
};
```
passed to BOTH props. The handler stays in-component (it needs `onToggleExpanded`
from props); only the *reader* is extracted. This satisfies A1's always-run jsdom
guard with (a) a trivial mount-free unit on `expansionKeyOf(syntheticTr)` returning
the right key, PLUS (b) a StructureTree-level assertion that `onExpandRow`/
`onCollapseRow` are passed (non-no-op) and each expandable row carries
`data-expansion-key`. (a)+(b) make a no-callback OR wrong-key regression fail in the
always-run suite even though the mock cannot drive real arrows; the e2e covers the
real ArrowRight/ArrowLeft press.

**Decision Q1-d — R20: `ancestorKeys` (three-key note reveal) + `eventKey`, both in
`selection.js`, both byte-identical.**
- `ancestorKeys({ sectionIndex, measureIndex, hand })` returns
  `[ expansionKey({sectionIndex}), expansionKey({sectionIndex, measureIndex}),
  expansionKey({sectionIndex, measureIndex, hand}) ]`; callers spread it:
  `revealAncestors(...ancestorKeys({ sectionIndex, measureIndex, hand }))`. It
  reproduces the exact trio at `edit.js:220-224, 399-403, 490-494` verbatim. **Scope
  pin: `ancestorKeys` is the three-key section→measure→hand reveal ONLY.** The
  single-key reveal sites — `onDuplicateMeasure` (`:370`) and `insertMeasureAt`
  (`:448`), which reveal only `expansionKey({sectionIndex})` — stay calling
  `expansionKey` directly; do NOT force them through `ancestorKeys`.
- `eventKey({ sectionIndex, measureIndex, hand, eventIndex })` =
  `expansionKey({ sectionIndex, measureIndex, hand }) + "e" + eventIndex`, replacing
  the inline `` `${handKey}e${eventIndex}` `` at `StructureTree.js:443`. Byte-identical
  (`s0m1rightHande0`). **It is used ONLY as the React `key` on the leaf row
  (`:453`)** — not an `expanded`-Set member (notes are leaves), not read by `edit.js`
  (no event-level reveal exists). Moving its construction changes no membership and
  no other consumer; do it to co-locate all key shapes, but it is lower-stakes than
  `ancestorKeys` (single consumer). Add unit coverage for `ancestorKeys` and
  `eventKey` producing the exact strings `s0`/`s0m1`/`s0m1rightHand`/`s0m1rightHande0`
  so byte-identity (Guardrail A) is pinned, not just asserted in prose.

### Q2 — `RowActionsMenu` extraction + chevron/label-cell folding (R7)

Evidence: live `StructureTree.js`, the DropdownMenu/TreeGridCell mocks, and
`StructureTree.test.js`.

**Decision Q2-a — `RowActionsMenu({ toggleProps, label, onDuplicate, onAddBefore,
onAddAfter, onRemove })`; pass the `{ ref, tabIndex, onFocus }` trio straight to
`DropdownMenu.toggleProps`.** The real TreeGridCell render-prop arg is exactly
`{ ref, tabIndex, onFocus }` (core's roving-tabindex cell contract) — nothing else —
so `toggleProps={cellProps}` wholesale and the explicit trio are byte-equivalent
(and under jest the arg is `{}`, so both spread nothing). The KEY POINT for
Guardrail B is that the trio reaches `DropdownMenu.toggleProps` unchanged; the prop
name is a naming call (`toggleProps` matches the real wiring more precisely than the
spec's illustrative `cellProps`). RowActionsMenu forwards it straight:
`<DropdownMenu icon={moreVertical} toggleProps={toggleProps} label={label}>`.

**Decision Q2-b — render-function children are MANDATORY (regression canary).**
RowActionsMenu internally renders `<DropdownMenu …>{({ onClose }) => (<>…</>)}`</DropdownMenu>`
with the two MenuGroups (Duplicate / Add before / Add after, then destructive Remove),
each `MenuItem.onClick = () => { onX?.(); onClose(); }`. The DropdownMenu mock
(`:371-374`) returns `null` unless `children` is a render function (mirrors core's
`isFunction(children)` guard), so element children would make the toggle vanish and
fail the toggle-presence test (`:408-431`) plus every row-actions test (`:432-549`).
This mock guard is the canary: a bad extraction fails the always-run suite.

**Decision Q2-c — shape (A): the `<TreeGridCell>` stays at each call site;
RowActionsMenu is purely the DropdownMenu+items.** The roving-tabindex arg only
exists inside TreeGridCell's render-prop callback, so the cell's render-prop must be
at the call site for RowActionsMenu to receive it. Each site becomes
`<TreeGridCell>{(p) => <RowActionsMenu toggleProps={p} label={…} onDuplicate={…}
onAddBefore={…} onAddAfter={…} onRemove={…} />}</TreeGridCell>` — replacing a ~54-line
DropdownMenu block with ~6 lines, three times. Shape (B) (RowActionsMenu renders its
own TreeGridCell) buries the cell and needless-couples RowActionsMenu to being the
row's second cell — rejected.

**Decision Q2-d — fold ONLY section+measure into one `RowLabelCell`; leave hand and
note label cells explicit.** Section (`:183-201`) and measure (`:288-312`) label
cells are byte-identical in shape (TreeExpander + select-only label Button with
`aria-current` + `onSelect`), differing only in key/isExpanded/selected/payload/text
— `RowLabelCell({ expansionKey, isExpanded, selected, label, onToggleExpanded,
onSelect })` collapses both with NO conditionals (cheap). The hand label cell
(`:405-422`) diverges (label Button `onClick`→`onToggleExpanded`, NO `aria-current` —
non-selectable, KD 14) and the note label cell (`:458-477`) diverges (NO chevron,
leaf) — folding either needs real conditionals (`expandable?`/`select-vs-toggle`)
that obscure more than they save. So fold the two verbatim twins; keep hand and note
inline. (Spec allows folding none — "RowActionsMenu only" is also compliant; the S+M
fold is recommended because they are exact twins.) Orthogonal to Q1: the
`data-expansion-key` goes on the `<TreeGridRow>`, not the cell, so folding the label
cell doesn't touch expansion-key wiring.

**Decision Q2-e — RowActionsMenu and RowLabelCell are module-local components in
`StructureTree.js` (above the `StructureTree` export, like the existing
`TreeExpander`).** They're used only by StructureTree, close over nothing global (all
deps via props; icons already imported at file top), and the net extraction REMOVES
~140 lines. Test-neutral: `StructureTree.test.js` imports only `{ StructureTree }`
(`:34`) and mounts the whole tree via `createRoot`/`act`, querying rendered DOM (by
`aria-label`, label text, the `.wp-block-piano-block-piano__tree-expander` class) —
it never mounts an internal cell, and the realIcons test also mounts the whole tree.
Separate files would only help if a test mounted RowActionsMenu in isolation, which
no acceptance criterion (A7 asserts behavior through the whole-tree mount) requires.

**Guardrail B closure (for the doc):** A7's "toggle receives forwarded toggleProps
(roving tabindex)" is e2e-only at the prop level (jsdom passes `{}`); the unit pin is
structural — the toggle button RENDERS (proving children stayed a render function)
and carries its `aria-label`. The realIcons test mounts the hand-row Add-note button,
NOT RowActionsMenu's toggle icon, so no realIcons change is needed for R7.

### Q3 — `updateHandEvents(song, coords, fn)` shape + `set*At` adoption in edit.js (R6)

Evidence: live `edit.js`, `songModel.js:341-403`, `Edit.test.js:505-553`.

**Decision Q3-a — `updateHandEvents` lives in `songModel.js` beside the `set*At`
faces; composes on `setMeasureAt`.** Exact body:
```
export function updateHandEvents(song, { sectionIndex, measureIndex, hand }, fn) {
  const measure = song.sections[sectionIndex].measures[measureIndex];
  const nextEvents = fn(measure[hand] ?? []);
  let nextMeasure;
  if (nextEvents == null || nextEvents.length === 0) {
    const { [hand]: _dropped, ...rest } = measure;
    nextMeasure = rest;
  } else {
    nextMeasure = { ...measure, [hand]: nextEvents };
  }
  return setMeasureAt(song, { sectionIndex, measureIndex }, nextMeasure);
}
```
- It reuses the existing immutable rebuild (`setMeasureAt` → `setSectionAt` →
  `replaceAt`), so the empty-hand decision is the ONLY new logic; the splice plumbing
  is the existing faces. The empty/null branch produces a measure with the hand key
  ABSENT (byte-matches today's onRemoveNote `:316-317`), satisfying `Edit.test.js:516`
  (`toBeUndefined()`).
- `measure[hand] ?? []` default is correct: a grow `fn` on a missing hand gets `[]`
  and returns a non-empty array, CREATING the key (matches today's onAddNote `:202`).
- `nextEvents == null || nextEvents.length === 0` is the spec's "empty array OR null
  drops the hand key"; `(!nextEvents || nextEvents.length === 0)` is equivalent —
  implementer's call.
- The helper is song-shape-only and assumes section/measure exist (it dereferences
  `song.sections[si].measures[mi]`). All four callers already guard existence before
  calling, and the guards also drive selection-clearing (NOT the helper's job), so the
  guards stay at the call sites. No guard inside the helper (matches `setEventAt`).

**Decision Q3-b — all four note-level mutators use `updateHandEvents`; `setEventAt`
stays panel-only; do NOT import `setMeasureAt`/`setEventAt` into edit.js.** Every
note-level write in edit.js changes array LENGTH (3 grow, 1 shrink) — there is NO
in-place replace in edit.js. The in-place note REPLACE (note↔rest switch, pitch/
duration edits) happens in `NotePanel` via `setEventAt`. So `setEventAt` gets no
edit.js caller, and `setMeasureAt` is reached only transitively inside
`updateHandEvents` (which lives in `songModel.js`). **edit.js imports exactly
`{ setSectionAt, updateHandEvents }`** (plus its existing `insertAt`/`duplicateAt`/
`removeAt`/`newX`). **Trap flagged for the code-writer:** the spec's prose "import and
use setSectionAt/setMeasureAt/setEventAt" describes the helper FAMILY edit.js stops
re-implementing — it is NOT a literal requirement that all three names appear in
edit.js's imports. Adding `setMeasureAt`/`setEventAt` to edit.js "to satisfy the spec
literally" would create dead imports that lint/A18 flags. A6 only requires the eight
inline two-level rebuilds to be gone and `updateHandEvents` to encode the rule.

**Decision Q3-c — per-site mapping (the eight inline rebuilds).** Four measure-array
sites → `setSectionAt`; four hand-array sites → `updateHandEvents`. None uses
`setMeasureAt` directly.

| edit.js site | Level | After |
|---|---|---|
| onAddMeasure `:271-274` | measure-array | `setSectionAt(working, { sectionIndex }, { ...section, measures: insertAt(section.measures, section.measures.length, newMeasure()) })` |
| onRemoveMeasure `:285-288` | measure-array | `setSectionAt(working, { sectionIndex }, { ...section, measures: removeAt(section.measures, measureIndex) })` |
| onDuplicateMeasure `:360-362` | measure-array | `setSectionAt(working, { sectionIndex }, { ...section, measures: duplicateAt(section.measures, measureIndex) })` |
| insertMeasureAt `:442-444` | measure-array | `setSectionAt(working, { sectionIndex }, { ...section, measures: insertAt(section.measures, target, newMeasure()) })` |
| onAddNote `:211-216` | hand-array (grow) | `updateHandEvents(working, { sectionIndex, measureIndex, hand }, (events) => insertAt(events, insertIndex, newNote()))` |
| onRemoveNote `:312-324` | hand-array (shrink) | `updateHandEvents(working, { sectionIndex, measureIndex, hand }, (events) => removeAt(events, eventIndex))` — helper owns the key-drop |
| onDuplicateNote `:384-389` | hand-array (grow) | `updateHandEvents(working, { sectionIndex, measureIndex, hand }, (events) => duplicateAt(events, eventIndex))` |
| insertNoteAt `:475-480` | hand-array (grow) | `updateHandEvents(working, { sectionIndex, measureIndex, hand }, (events) => insertAt(events, target, newNote()))` |

- The four measure-level sites replace the WHOLE section's `measures` array → fit is
  `setSectionAt` (replace the section), not `setMeasureAt` (replace one measure).
- The `commit({ ...working, sections: ... })` wrapper is REPLACED by the helper's
  return (the helpers spread `...song` and return the full new song):
  `commit(setSectionAt(working, …))` / `commit(updateHandEvents(working, …))`.
- Existing `const section = working.sections[sectionIndex]` guard lines stay (they
  drive the guard + read `section.measures`); what disappears is the `nextMeasures` +
  `sections.map` pair and, for onRemoveNote, the whole `let nextMeasure / if-else /
  sections.map` block (`:312-324`) → one `updateHandEvents(...)` call.

**Decision Q3-d — onAddNote `insertIndex` (and all selection/reveal) stays in
edit.js.** `insertIndex` is computed from `resolvedSelection` (`:203-209`) — selection
awareness, not song shape. edit.js keeps it verbatim and passes `(events) =>
insertAt(events, insertIndex, newNote())` as `fn`; the helper never sees the
selection. The post-commit `setSelection(...)` + `revealAncestors(...ancestorKeys(...))`
(Q1) also stay in edit.js after the `commit(...)`. Clean separation: helper = song
shape; edit.js = selection + reveal + commit.

**Decision Q3-e — pin the empty-hand rule at BOTH the helper unit and the edit
integration (belt-and-suspenders).**
- `songModel.test.js` (helper unit, pure): grow → key present with new array;
  shrink-to-empty → key ABSENT; shrink-non-last → key present, trimmed; `fn` returns
  `null` → key absent; plus an immutability check (input `song` unmutated), matching
  the existing `set*At` test convention.
- `Edit.test.js:505` (integration pin) stays green UNCHANGED (mandatory per A6); the
  "keeps the hand when another event remains" case (`:524-553`) pins the non-empty
  branch through the real flow.
- Neither subsumes the other: the helper unit pins the RULE at its single home; the
  integration pins the WIRING (onRemoveNote routes through it and clears selection).

### Q4 — CSS split mechanic (R3/R17) + module extraction wiring (R9)

**(A) CSS split — fully self-contained; nothing spans the boundary.**

**Decision Q4-a — `editor.scss` re-parents the moved rules under its own
`.wp-block-piano-block-piano { … }`; `style.scss` keeps `@font-face` + the wrapper
rules.** `editor.scss` opens `.wp-block-piano-block-piano { &__workspace {…} &__tree
{…} &__canvas {…} &__canvas-svg {…} }` reusing the SAME `&__` nesting verbatim;
`style.scss` is left with `@font-face { "PB Music" … }` + `.wp-block-piano-block-piano
{ border; padding; color; }`. Verified self-contained: `style.scss` has ZERO
`@use`/`@import`/`@mixin`/`@include` and is the only `.scss` in `src/`. The **`@for $i`
aria-level loop (`:83-87`) is fully loop-local** — `$i` is declared+consumed entirely
inside the `&__tree` block, references no top-level variable, and moves verbatim into
`editor.scss`'s `&__tree`, compiling identically (Guardrail C). The only other `$`
tokens are `$gray-300` inside CSS COMMENTS (prose, not SCSS vars). The moved block's
doc-comment header (`:29-37`) moves into `editor.scss` and is rewritten there per R17
(drop the stale `__song-input` sentence + stale comments); the `@font-face` docblock
(`:6-15`) stays in `style.scss`. R17 edits (`#007cba`→`var(--wp-admin-theme-color,
#007cba)` ×3, trim `__canvas` to `flex:1 1 auto; min-width:0`, drop `__song-input`)
all happen to the moved rules in their new `editor.scss` home.

**Decision Q4-b — `index.js` adds `import "./editor.scss"` beside `import
"./style.scss"`; order is irrelevant.** The two emit to SEPARATE files
(`build/style-index.css` via the `style.`-prefix rule; `build/index.css` for any other
CSS) and are enqueued by SEPARATE block.json keys at different times — they never
share a stylesheet and have no overlapping selectors, so source order changes nothing.

**Decision Q4-c — block.json keeps `"style": "file:./style-index.css"`, adds
`"editorStyle": "file:./index.css"`; RTL is auto-handled; no build-output test to
update.** wp-scripts auto-emits `style-index-rtl.css` + `index-rtl.css` and WordPress
auto-enqueues the `-rtl` variant off the same `style`/`editorStyle` keys — NO explicit
block.json `-rtl` entry. No test pins the single-stylesheet build output (the unit
suite mocks `@wordpress/*` and imports no CSS; the e2e asserts rendered DOM, not which
CSS files exist), so adding `editor.scss`/`index.css` breaks no test. `npm run build`
is the A3 verification that `build/index.css` (+ `-rtl`) now emits.

**(B) Module extraction (R9) — clean move, no cycle, no React pull-in.**

**Decision Q4-d — DELETE the old `src/editor/accessibleName.js` and repoint; no
shim.** `edit.js:14` is the ONLY importer of the old file (grep: single hit, no test
imports it). Create `src/song/accessibleName.js` (byte-identical `accessibleNameFor` +
its private `trimmedString` + the same `@wordpress/i18n` imports; only
`accessibleNameFor` is exported), delete `src/editor/accessibleName.js`, repoint
`edit.js` to `./song/accessibleName.js`. **view.js currently DEFINES
`accessibleNameFor` locally (`:56-80`) and `trimmedString` (`:82-85`)** — it switches
to `import { accessibleNameFor } from "./song/accessibleName.js"` and deletes both
local bodies. (R11's single-parse change touches the memo that USES `accessibleNameFor`
but is independent of this import-path change.)

**Decision Q4-e — `src/notation/dom.js` homes only the two pure functions; React-free;
no cycle; no test repoint.**
- NARROW_CONTAINER_PX (480) / NARROW_SP_PX (7) — declared identically in both
  `view.js:42-45` and `SongCanvas.js:37-40`, used only by `availableWidthInSp` — move
  WITH the function into `dom.js` as module-private consts; both callers delete their
  local declarations. `dom.js` imports `SP_PX` from `./constants.js` and
  `MUSIC_FONT_FAMILY` from `./glyphs.js`.
- Canonical `availableWidthInSp` uses `container?.clientWidth ?? 0` (the
  optional-chaining superset from SongCanvas `:53`; safe for view.js, which always
  passes a real element — never changes front-end behavior).
- NO cycle: `glyphs.js` and `constants.js` each have ZERO imports, so `dom.js` →
  `{constants, glyphs}` is a leaf-ward edge; nothing in `notation/` imports back
  through `dom.js`, and nothing in `notation/`/`song/` imports from `editor/` or
  `view.js`.
- NO test repoint: both functions are currently module-PRIVATE (un-exported) so no
  test imports them; behavior is pinned end-to-end by `SongCanvas.test.js` and
  `render.spec.js` (`:500-524`). A direct `dom.js` unit (narrow-step threshold,
  0-width floor) is an optional nice-to-have, not required.
- The per-surface ResizeObserver wiring is NOT extracted — SongCanvas's uses React
  (`useEffect`/`setMeasuredWidth`/cleanup), view.js's is imperative; sharing it would
  drag `@wordpress/element` into the front-end bundle (forbidden) or strip React from
  the editor lifecycle (A9: "dom.js does not import @wordpress/element"; "ResizeObserver
  not unified").

**Decision Q4-f — front-end byte-identity / no React pull-in (load-bearing R9
guarantee).** `src/song/accessibleName.js` imports ONLY `@wordpress/i18n` (already a
view.js dep, no React); `src/notation/dom.js` imports ONLY React-free notation
siblings. So after R9, view.js's import graph gains two React-free modules and loses
three local function bodies — ZERO new React/`@wordpress/element`/`@wordpress/components`
enters the front-end bundle. The front-end SVG stays byte-identical (pinned by
`render.spec.js` accessible-name `:500-501` + structure `:510-524` + the
`[data-hit]`-count-0 guard `:528-529`).

### Q5 — string-icon guard + realIcons lighten (R16/O1); HANDS export (O2)

**(A) String-icon guard.**

**Root cause the regular suite is blind today (load-bearing):** the default
Button/Icon/DropdownMenu mocks SWALLOW the `icon` prop — Button (`:37` `icon: _icon`),
DropdownMenu (`:368`), and Icon (`:323`, renders a `<span data-icon>` with no icon
content). So a string `icon` and an element `icon` produce byte-identical DOM (the
icon is never rendered); `"plus"` vs `{plus}` are indistinguishable. The realIcons
test closes the gap only for StructureTree by LOCALLY re-mocking those three to render
`icon` through an element-rendering `Icon` (`cloneElement` for an element, `null` for a
string).

**Decision Q5-a — guard mechanism: element-sentinel icons mock + element-rendering
default Icon/Button/DropdownMenu mocks; assert each icon host rendered the marked
node.**
- `test/mocks/wordpress-icons.js` exports each icon as a small inert React ELEMENT
  built with the runner's own `@wordpress/element` `createElement`, e.g.
  `const plus = createElement("svg", { "data-wp-icon": "plus" });`. (Runner-built →
  `isValidElement(sentinel)` is trivially true; no `$$typeof` mismatch, so no
  React-dedup needed.)
- Change the DEFAULT `Icon` mock from the icon-blind `<span data-icon>` to the
  element-rendering form `isValidElement(icon) ? cloneElement(icon) : null`, and make
  default `Button`/`DropdownMenu` render `icon ? <Icon icon={icon}/> : null` (mirroring
  the realIcons local mocks). Now a correct `icon={plus}` (element) renders the marked
  node; a regressed `icon="plus"` (string) is not a valid element → renders NOTHING.
- Assertion: a single new parametrized test that mounts EACH icon-bearing component and
  asserts its icon host carries the sentinel marker (e.g. `button.querySelector("svg")`
  truthy / has `[data-wp-icon]`). RED on a string (no node), GREEN on the element. This
  is the realIcons render mechanism promoted into the always-run suite, minus the
  un-map + React-dedup machinery — cheapest AND truest (it proves the icon RENDERS, the
  actual failure mode, not just that the prop is non-string).
- **Coverage MUST be project-wide** — the four leaf editors the StructureTree-only
  realIcons test never mounted: `ListControls`/`AddButton` (plus), `PitchList`,
  `AnnotationList`, `HandConfigEditor` (trash) — PLUS `StructureTree` (moreVertical,
  plus, chevrons). (Options rejected: prop-recording `typeof!=="string"` needs new mock
  instrumentation and tests the prop not the render; tree-walk can't see a swallowed
  prop.)
- **Ripple of the mock change (flag to writer):** rendering `icon` adds a child node to
  every iconful button across the WHOLE suite — verify no test asserts exact
  `children`/`textContent` equality on an iconful button. The marker `<svg>` has no
  text, so `.textContent` is usually unaffected, but run the full suite after the mock
  change.

**Decision Q5-b — LIGHTEN: delete the realIcons test + two-project config + the
React-dedup mapper.** The project-wide sentinel guard is strictly STRONGER for item
16's actual targets (covers the four leaf editors) and far cheaper; the spec (O1/AO1)
permits lightening "only if the project-wide RED-on-regression guarantee is
preserved," which the sentinel+assertion delivers. Concretely DELETE:
- `src/editor/__tests__/StructureTree.realIcons.test.js` (264 lines).
- The two-project structure in `jest.config.js` (`:91-125`): collapse
  `projects: [unit, real-icons]` to a single flat config; remove the `real-icons`
  project, the `REAL_ICONS_TEST` const, the `testPathIgnorePatterns` exclusion, and the
  `testMatch` that selected it.
- The React-dedup `moduleNameMapper` (`reactDedupMapper`, `:55-62`) — it existed solely
  so a real `@wordpress/icons` element (nested React 18) was valid under the runner's
  React 19; with the realIcons test gone and the sentinel runner-built, it's
  unnecessary. Only `@wordpress/icons` ships real elements and it's mocked, so removal
  is safe — but **verify by running the full suite** (if any other installed
  `@wordpress/*` package supplied a real React-built element a test imports, the dedup
  could still matter; none found).
- KEEP the `iconsMock` mapping (now pointing at the non-string-sentinel mock); the
  components/i18n/block-editor mocks and structured-clone setup are unchanged. Net
  deletion ~360 lines. (Fallback if the default-mock icon-render change can't be made
  cleanly: KEEP realIcons + ADD a separate project-wide assertion — strictly more code;
  lighten is preferred.)

**Decision Q5-c — R16 production changes; the AddButton `label` drop is NOT
test-neutral.**
- Trash buttons (`PitchList.js:47`, `AnnotationList.js:61`, `HandConfigEditor.js:171`):
  `icon="trash"` → `icon={trash}` element + ADD `isDestructive`, **KEEP the `label`**
  (it is the `aria-label` the remove-button tests query — `pitches.test.js:264,277,304`,
  `annotations.test.js:292,297`). Each file ADDS `import { trash } from
  "@wordpress/icons"`. No test breaks.
- **AddButton (`ListControls.js:24-29`):** today `<Button variant="secondary"
  icon="plus" label={label}>{label}</Button>` — passes the inner Button `label` (→ mock
  `aria-label`) AND renders `{label}` as text. R16 drops the REDUNDANT inner `<Button
  label>` (a real button's visible text IS its accessible name) while keeping the
  `{label}` text child and AddButton's own `label` parameter:
  `<Button variant="secondary" icon={plus} onClick={onClick}>{label}</Button>`. Adds
  `import { plus } from "@wordpress/icons"`. **BUT the jsdom Button mock derives
  `aria-label` ONLY from the `label`/`aria-label` prop (`:48`), not from text children**
  — so once the inner `label` is dropped, `buttonByName(container,"Add pitch")`
  (`pitches.test.js:287`, `annotations.test.js:271,278,288,289`, matching `aria-label`
  only at `:63-66`) returns nothing. **Resolution: migrate the ~5 add-button test
  locators from aria-label to TEXT** (e.g. a `buttonByText` matching `button.textContent
  === "Add pitch"`, since the visible text child remains). Same treatment for the
  HandConfigEditor add-alteration button if any test locates it by aria-label. Flag
  clearly: "drop the redundant label" = drop the inner `<Button label>`, NOT AddButton's
  `label` parameter; dropping it requires the locator migration (this is O3's "update
  aria-label locators" caveat applied to R16).

**(B) HANDS export (O2).**

**Decision Q5-d — one ordered `{ key, label }` array in `songModel.js`; `STAVES`
becomes a derived export; `notation/layout.js`'s HANDS stays untouched.**
```
export const HANDS = [
  { key: "rightHand", label: __("Right hand", "piano-block") },
  { key: "leftHand", label: __("Left hand", "piano-block") },
];
```
- Serves all three consumer shapes: StructureTree iterates `HANDS` directly
  (`handPosition` = index, `h.key`/`h.label` replace its local `["rightHand","leftHand"]`
  at `:64` AND the label restatement at `:382-385`); ContextEditor reads labels by key
  (`:182,189,230,241`); `STAVES` becomes `export const STAVES = HANDS.map(h =>
  ({ label: h.label, value: h.key }))` — byte-identical to today's literal (`:95-98`).
- **STAVES kept as a derived export (back-compat):** its importers —
  `AnnotationEditor.js:17` (`options={STAVES}`) and `songModel.test.js:48,120-121,136`
  (enum-mirror test) — are UNCHANGED; the de-duplication is internal (STAVES stops being
  a literal, becomes a projection of HANDS). Translator-wrapped `__()` labels stay
  wrapped, at the single HANDS source.
- **CRITICAL boundary caveat:** `src/notation/layout.js:897` has its OWN
  `const HANDS = ["rightHand","leftHand"]` (front-end/notation-core, used `:2507,2792,
  2971`). O2 is editor-scoped — do NOT touch it. Importing `songModel.HANDS` into
  `notation/layout.js` would cross the layered boundary (notation/ must not import from
  editor/) and risk front-end byte-identity. AO2's "the staff options" = `STAVES`, not
  layout.js's array. They stay intentionally separate (different layers).

### Q6 — R8 removal, R2 mock de-translation, R12 emit re-home, change ordering

**Decision Q6-a — R8: `interactive` is an OPTIONS-OBJECT key; removal is clean.**
`renderSvg(model, { accessibleName = "", interactive = false } = {})` (`svg.js:283`);
`renderInto(container, model, options = {})` forwards options. Both production callers
already pass an options OBJECT without `interactive` (`SongCanvas.js:163`,
`view.js:134`), so dropping the key shifts no argument. The internal threading
(`renderSystem`/`renderMeasure`/`renderHand`/`renderNote`/`renderRest`) carries
`interactive` as the LAST POSITIONAL param of each — remove that trailing param + its
call-site arg from all five together (mechanical). Delete `hitRect` (`:250-260`), the
two `if (interactive)` branches (note `:773-775`, rest `:920-922`), `HIT_RECT_WIDTH_SP`
(`:64`), `HIT_RECT_VERTICAL_MARGIN_SP` (import `:34` + its `constants.js` def).
**`data-hit` lives ONLY inside `hitRect` (`:258`)** — after deletion the string does not
exist in production, so the surviving guard is real, not a tautology. Delete the
"when interactive" feature describe (`svg.test.js:1004-1044`, the ~15 feature lines);
KEEP the flagless no-hit assertions (`:991`/`:995`/`:1001`) — they already call
`renderSvg(model)` with no options, so they need NO re-point. The front-end pin
`render.spec.js:529` (`[data-hit]` count 0) stays (now unconditionally true). No golden
snapshot exists; attribute/structure + unique `data-hit` count is a sufficient pin for
a purely-additive dead-code deletion.

**Decision Q6-b — R2: NO unit test queries the tree by NAME; mock change = "remove the
`label`→`aria-label` mapping, keep the `...rest` spread."** Unit tests find the tree by
ROLE only (`Edit.test.js:680,693` query `[role="treegrid"]`), never by accessible name
— which is precisely the bug (the unit surface couldn't see the name). The TreeGrid
mock (`wordpress-components.js:445-458`) today destructures `label` (`:447`) and renders
`"aria-label": label` (`:456`); R2 REMOVES the `label` destructure + the mapping,
leaving `createElement("table", { role: "treegrid", ...rest })`. Because the mock
already spreads `...rest`, the production `aria-label="Song structure"` now lands as a
real attribute through `...rest` (matching the real component). Production
`StructureTree.js:569` changes `<TreeGrid label={…}>` → `<TreeGrid aria-label={…}>`.
Verification home is the e2e (`getByRole("treegrid",{name:"Song structure"})`); ADD an
always-run unit asserting the rendered `<table>` carries `aria-label="Song structure"`
and NO `label` attribute (the always-run pin backing the e2e — a `label`-regression
fails in jsdom too). No existing test needs re-query (none queried by name); the new
assertion is the pin.

**Decision Q6-c — R12: emit.js move touches FIVE importers + the test; MetadataEditor
ADDS an `omitFalsy` import; `emitBlock` is deleted; one new test pins the flip.** emit.js
(`src/editor/inspector/emit.js`, exporting `omitEmpty`/`omitFalsy`/`emitBlock`) moves UP
to `src/editor/emit.js`. Importer paths before→after:
- `ContextEditor.js:45` (in `src/editor/`): `./inspector/emit.js` → `./emit.js` (the
  cross-boundary import the spec calls out — now a sibling). Keeps `omitEmpty`; R12
  inlines its local `emitMember` as `onChange(omitEmpty(...))`.
- `inspector/NotePanel.js:52`, `inspector/MeasurePanel.js:34`,
  `inspector/SectionPanel.js:40`: `./emit.js` → `../emit.js` (each imports `omitFalsy`).
- `inspector/SongPanel.js:30`: `./emit.js` → `../emit.js`; imports `emitBlock` today —
  R12 INLINES `emitBlock` as `onChange(omitEmpty(...))`, so `emitBlock` is DELETED from
  emit.js and SongPanel imports `omitEmpty` instead. emit.js ends up exporting only
  `omitEmpty` + `omitFalsy`.
- `emit.test.js:9`: `../inspector/emit.js` → `../emit.js`, AND drop the `emitBlock`
  import + its cases (it's inlined away) or the suite goes red on a missing export.
- `MetadataEditor.js` (in `src/editor/`): ADDS `import { omitFalsy } from "./emit.js"`,
  switches its two onChange sites (`:47`,`:53`) from local `withField` to `omitFalsy`,
  deletes local `withField` (`:23-31`).
**The spec's "the production importer" undersells it: FIVE production importers change
relative path (one to `./`, four to `../`), plus the test, plus MetadataEditor.** The
`withField`→`omitFalsy` swap means a whitespace-only Title now DROPS (omitFalsy trims).
No existing test asserts the OLD persist behavior (`SongPanel.test.js:146-153` clears
with `""`, which both old and new drop — stays green). ADD a new SongPanel/Metadata test
asserting a whitespace-only Title (`"   "`) now drops the key (pins A12's unified
behavior). Nothing flips red-needing-update; one new test pins the intended change.

**Decision Q6-d — change ordering (design altitude).** Helpers land first as the
contract everything consumes; two mock+production pairs are atomic to keep "green ≠
broken"; the rest are independent islands.
- **Phase A — pure helpers (no UI):** selection.js (R20 `ancestorKeys`/`eventKey`/
  `expansionKeyOf` + R10 stamp-`kind`/delete-compat) and songModel.js (R6
  `updateHandEvents` + O4 export cleanup + O2 `HANDS`/derived `STAVES` + R15
  `NONE_OPTION`), each as one per-file pass so its test updates happen once. **R20 MUST
  precede R1.**
- **Phase B — consumers of Phase A:** R1 (StructureTree keyboard, needs `expansionKeyOf`),
  R6 edit.js adoption (set*At + `updateHandEvents` + `ancestorKeys` reveals), R14, R15
  consumers, O2 consumers.
- **Phase C — atomic mock+production pairs:** **R16 + O1 land together** (icons-mock
  non-string sentinel + element-rendering default mocks + production element-icon swaps
  + new project-wide guard + delete realIcons/two-project config + AddButton label-drop &
  the ~5 locator migrations) — splitting it leaves the guard wrong-colored mid-flight.
  **R2 (TreeGrid mock de-translation + StructureTree `aria-label` + new unit) lands
  together** for the same reason.
- **Phase D — independent islands (parallelizable):** R3+R17 (one editor.scss move,
  then admin-color/trim/drop-`__song-input`/comment fixes in the moved file +
  block.json/index.js wiring); R8 (notation/ + svg.test.js + README tail); R9 then R11
  (R9 = import-path move, R11 = memo body — same edit.js area); R12 then R13 (R13 needs
  R12's omit helpers in their new home); R7 (RowActionsMenu/RowLabelCell); R18, R19, O3,
  O5 (cosmetic/isolated).
- **Within StructureTree.js (R1, R7, O2, R18):** sequence R1 → R7 → O2 → R18, with the
  R18 docblock REWRITTEN LAST (it documents the post-R1 real `onExpandRow`/`onCollapseRow`
  path; writing it before R1 lands would describe nonexistent code).
- **Ordering hazard (test masking):** R16/O1's mock change makes default Button/Icon
  mocks RENDER the icon (adds a child node); if the production icon swap and the mock
  swap were split, a string-icon regression could pass. Keep R16+O1 atomic. The
  DropdownMenu null-on-non-render-fn guard R7 relies on is UNCHANGED by R16/O1 (only icon
  rendering is added), so R7 and R16 don't interfere given R16+O1 are atomic. No other
  item's test changes mask another's regression (otherwise orthogonal files/assertions).

---

## Resolved design decisions

Standalone summary of the HOW decided in the Q&A above. The spec (R1–R20, O1–O5) owns
the WHAT; these are the implementation choices, decided on the researcher's evidence.
Mechanical items the spec already fully specifies (R5 README dependency wording, R10
kind-stamp + compat delete, R11 single-parse memo, R13 annotations one-liners, R14
shared array helpers, R15 NONE_OPTION/ALTER_KEY_OPTIONS, R17 admin-color/trim/comment
fixes within the moved CSS, R18 comment fixes, R19 heading removal, O3 sprintf labels,
O4 export cleanup, O5 Flex/HStack spacing) carry no open design choice and are folded
into the ordering below; the decisions that needed deciding are:

### Key contract (selection.js) — Guardrail A
- `selection.js` gains `ancestorKeys({sectionIndex,measureIndex,hand})` (three-key
  section→measure→hand reveal array), `eventKey({…,eventIndex})` (= `expansionKey(...)
  + "e" + eventIndex`), and `expansionKeyOf(row)` (= `row?.getAttribute?.("data-expansion-key")
  ?? null`) — co-located with `expansionKey` so the whole key contract (write + read)
  lives in one file. All produce byte-identical strings (`s0`/`s0m1`/`s0m1rightHand`/
  `s0m1rightHande0`), unit-pinned. `ancestorKeys` is the three-key reveal ONLY; the
  single-key reveal sites keep calling `expansionKey` directly.

### TreeGrid keyboard (R1) — Guardrail A
- One shared in-component handler points at BOTH `onExpandRow` and `onCollapseRow`,
  reading `expansionKeyOf(row)` and routing to the existing `onToggleExpanded(key)` —
  toggle-on-both is correct because the component gates expand-on-collapsed /
  collapse-on-expanded (evidence: Gutenberg tree-grid keydown handler). No add/delete
  guard. Each expandable row (section/measure/hand) carries the kebab literal
  `data-expansion-key={key}` (read with `getAttribute`, NOT camelCase); the leaf note
  row does not. Verification: e2e drives real ArrowRight/ArrowLeft; always-run jsdom
  pins `expansionKeyOf` mapping + callbacks-passed + each expandable row carries the
  attribute.

### Accessible name (R2) — atomic mock+production pair
- Production: `<TreeGrid aria-label={__("Song structure", …)}>`, drop `label`. Mock:
  remove the `label`→`aria-label` mapping, keep the `...rest` spread (so `aria-label`
  flows through, matching the real component). No unit queried the tree by name today;
  ADD an always-run unit (rendered `<table>` has `aria-label`, no `label`); e2e asserts
  by role+name.

### CSS split (R3) + selection color/trim (R17) — Guardrails C, D
- New `src/editor.scss` re-parents `&__workspace`/`&__tree`/`&__canvas`/`&__canvas-svg`
  (incl. `.is-selected`) under its own `.wp-block-piano-block-piano {…}`, verbatim; the
  `@for $i` aria-level loop is loop-local and moves byte-identical. `style.scss` keeps
  `@font-face` + the wrapper `border/padding/color`. `index.js` adds `import
  "./editor.scss"` (order irrelevant — separate emitted files). `block.json` keeps
  `"style": "file:./style-index.css"`, adds `"editorStyle": "file:./index.css"`; RTL is
  auto-handled, no build-output test to update. R17 (`#007cba`→`var(--wp-admin-theme-color,
  #007cba)` ×3, trim `__canvas` to `flex:1 1 auto; min-width:0`, drop `__song-input` +
  stale comments) all happen to the moved rules in their new home; `.is-selected` stays
  recolor-only.

### Control props (R4)
- Add `__next40pxDefaultSize` to every Button/SelectControl/TextControl/NumberControl/
  TextareaControl; add `__nextHasNoMarginBottom` to the edit.js TextareaControl; REMOVE
  `__nextHasNoMarginBottom` from every NumberControl (it has no such prop). No design
  ambiguity — purely a prop-presence pass.

### edit.js mutators (R6)
- `updateHandEvents(song, {sectionIndex,measureIndex,hand}, fn)` lives in `songModel.js`
  beside the `set*At` faces, composes on `setMeasureAt`, and encodes the empty-hand rule
  once (`fn` returns empty/null → DELETE the hand key → `undefined`, never `[]`). All
  four note-level mutators use it; the four measure-level rebuilds use `setSectionAt`.
  **edit.js imports exactly `{ setSectionAt, updateHandEvents }`** — do NOT add
  `setMeasureAt`/`setEventAt` (no edit.js caller; lint/A18 flags dead imports; the spec's
  prose names the family, not a literal import list). `setEventAt` stays panel-only.
  Selection/reveal logic stays in edit.js (helper is song-shape-only). Pinned at both
  the helper unit (songModel.test.js) and the integration (`Edit.test.js:505` unchanged).

### RowActionsMenu + RowLabelCell (R7) — Guardrail B
- `RowActionsMenu({ toggleProps, label, onDuplicate, onAddBefore, onAddAfter, onRemove })`,
  module-local in StructureTree.js, replaces the three actions cells; the `<TreeGridCell>`
  stays at each call site (shape A) and passes the `{ref,tabIndex,onFocus}` trio as
  `toggleProps` straight to the DropdownMenu (roving tabindex preserved). Render-function
  children are MANDATORY (the DropdownMenu mock returns null otherwise — the regression
  canary). Fold ONLY the section+measure label cells into `RowLabelCell` (verbatim twins,
  no conditionals); keep hand (toggle-label) and note (chevron-less) cells explicit.
  Test-neutral (tests mount the whole tree).

### README dependency wording (R5), notation dead-code (R8)
- R5: reword `README.md:143` and `:179` ("first") to acknowledge `@wordpress/icons` as a
  bundled `@wordpress/*` runtime dependency; keep the validator's zero-dependency
  narrative. R8: `interactive` is an options key — clean removal; delete `hitRect` +
  both branches + the two constants + the "when interactive" svg.test.js describe; keep
  the flagless `[data-hit]`-count-0 assertions (no re-point needed) + the front-end pin;
  `data-hit` ceases to exist in production, so the guard is real. README item-8 doc tail
  (`:148`/`:158-160`/`:201`) removed.

### Shared helpers (R9) — front-end byte-identity
- `accessibleNameFor` (+ private `trimmedString`) moves to `src/song/accessibleName.js`
  (import-only `@wordpress/i18n`); the old `src/editor/accessibleName.js` is DELETED and
  edit.js repoints; view.js switches from local def to import. `availableWidthInSp` +
  `drawWhenFontReady` (+ the NARROW_* consts) move to `src/notation/dom.js`, React-free
  (no `@wordpress/element`), canonical `container?.clientWidth ?? 0`. No cycle (glyphs.js
  /constants.js import nothing). The per-surface ResizeObserver is NOT unified. Front-end
  bundle gains zero React; pinned by render.spec.js.

### omit helpers + emit.js re-home (R12), and R13
- emit.js moves to `src/editor/emit.js` (exporting only `omitEmpty` + `omitFalsy`;
  `emitBlock` and ContextEditor's `emitMember` inlined as `onChange(omitEmpty(...))`).
  FIVE production importers change relative path (ContextEditor → `./`, the four
  inspector panels → `../`), plus emit.test.js (drop the `emitBlock` cases) and
  MetadataEditor (adds `omitFalsy`, deletes local `withField`). The
  `withField`→`omitFalsy` swap drops a whitespace-only Title; ADD one test pinning that.
  R13 lands after R12 (uses the omit helpers in their new home).

### Element icons + guard (R16) + lighten realIcons (O1) — atomic pair
- Icons mock exports inert React-ELEMENT sentinels (runner-built, e.g.
  `createElement("svg", { "data-wp-icon": "plus" })`); default Icon/Button/DropdownMenu
  mocks change to RENDER `icon` (`isValidElement(icon) ? cloneElement(icon) : null`), so
  a string renders NOTHING and an element renders a marked node. One project-wide
  parametrized assertion mounts every icon-bearing component (the four leaf editors +
  StructureTree) and asserts the icon host has the marked node — RED on a reintroduced
  string. LIGHTEN: delete the realIcons test, the two-project jest config, and the
  React-dedup mapper (verify the full suite). Production: trash buttons get `icon={trash}`
  + `isDestructive` (KEEP their `label`); AddButton drops the inner `<Button label>`
  (keeps the `{label}` text child) → migrate the ~5 pitches/annotations add-button
  locators from aria-label to text. Ripple: rendering icons adds a child node suite-wide
  — run the full suite. R16+O1 land atomically.

### HANDS export (O2)
- One ordered `{key,label}` array `HANDS` in songModel.js (translator-wrapped labels);
  StructureTree iterates it (replacing its local array + label restatement), ContextEditor
  reads by key, `STAVES = HANDS.map(h=>({label:h.label,value:h.key}))` (derived; its
  importers AnnotationEditor + songModel.test.js unchanged). `notation/layout.js:897`'s
  separate HANDS is NOT touched (different layer; byte-identity).

### Change sequence (design altitude)
- Phase A (pure helpers, no UI): selection.js (R20+R10), songModel.js (R6+O4+O2+R15) —
  the contract everything consumes; R20 before R1.
- Phase B (consumers): R1, R6-edit.js, R14, R15/O2 consumers.
- Phase C (atomic mock+production pairs): R16+O1; R2.
- Phase D (independent islands): R3+R17; R8; R9 then R11; R12 then R13; R7; R18/R19/O3/O5.
- Within StructureTree.js: R1 → R7 → O2 → R18 (docblock rewritten LAST).
- Hazard: keep R16+O1 atomic or a string-icon regression could pass mid-flight.

### Global guarantees carried by these decisions
- **Byte-identical front end** (Global parity gate): R8 (additive dead-code), R9
  (React-free extraction), R17 (`.is-selected` recolor-only) all preserve the front-end
  SVG; pinned by render.spec.js + non-interactive svg.test.js.
- **"Tests green" ≠ "real component broken"** (R1, R2, R16): the e2e arrow-key +
  treegrid-name tests exercise the real contract; the always-run jsdom guardrails
  (expansionKeyOf mapping + callbacks-passed; aria-label-present/label-absent; the
  project-wide element-icon render assertion with the de-helpfulized mocks) make a silent
  regression impossible even when e2e is skipped.
- **Guardrails A–D**: single expansion Set + byte-identical coordinate keys (A);
  RowActionsMenu roving-tabindex + select-only + render-fn children (B); `[aria-level]`
  indent verbatim + recolor-only `.is-selected` survive the CSS move (C); raw-JSON mode
  untouched (D).
