# Spec research — Review 10 (Piano block editor UI, PR #22)

This document records the iterative requirements research for review-10: the second
unified review on PR #22. It captures, per finding, what the live code actually does
(re-confirmed against the branch tip, not the intent's frozen line numbers), the
resolution, and the acceptance criteria. The central open question — whether
`__nextHasNoMarginBottom` belongs on every `NumberControl` — is resolved in its own
section against the real `@wordpress/components` contract.

The intent is the input of record: `0-prompt/prompt.md`. Address every recommended
P0/P1/P2; do not undo the "Considered but not recommended" rejects or the carried-over
prior-review wins; keep the `edit.js` 13-mutator refactor and the canvas highlight as
follow-ups.

## Requirements at a glance

Each requirement is detailed in its own section below; this is the scannable index.

| ID | Finding | Decision |
|----|---------|----------|
| **R-NUM** | `NumberControl` `__nextHasNoMarginBottom` (open question) | **Do not add** — review 9 confirmed correct; the prop is a no-op on `NumberControl` (real-contract verified). |
| **R-TREE** | Expanded tree rows don't collapse on label click (P0) | Drop the `if (!isExpanded)` guard → symmetric toggle; one test flips. |
| **R-LR1/2/3** | Inspector list-row layout cluster (P0, Stage 1) | `alignment="center"`; inline `min-width:4em` on collapsing `NumberControl`s; shorten visible "Alteration note" → "Note" (aria-label unchanged). |
| **R-DEL** | Inconsistent destructive deletes (P1) | Policy (a): drop all confirm dialogs, rely on native undo (deletes are recoverable). Owner fallback (b) recorded. |
| **R-FOCUS** | Focus dropped to `<body>` after tree mutation (P1) | Split: add/dup → focus new row label; remove → focus stable tree anchor. Nearest-survivor math deferred. e2e-verified (not unit-assertable). |
| **R-JSON** | JSON-mode Notice shows only `errors[0]` (P2) | Map over all errors. |
| **R-NOOP** | Redundant `?? undefined` on annotation emit (P2) | Drop it (2 sites). |
| **R-INVALID** | `InvalidState` hand-rolled markup (P2) | Drop redundant `<p>`, wrap in `VStack` (extend mock), keep `<ul>`. |
| **R-DOCS** | Canvas "interactive" framing + stylesheet name + CRITICAL doc-block (P2, cross-cutting) | Docs-only corrections; keep helpers distinct; reject click-to-select. |
| **Follow-ups (file issues)** | 13-mutator refactor; canvas section/measure highlight; list-row Stage 2 (`Flex`/`FlexItem`/`FlexBlock`); nearest-survivor focus | **File GitHub issues; implement none this run.** |
| **Not required** | Toolbar labels, scattered add-affordances, hand-group-as-text, curried mappers, `globalMeasureNumber` alloc, `ContextEditor` `resetAll` DRY | Optional/partial v1 choices — not acceptance gates this run. |

## Live-code coordinate confirmation (branch tip)

Re-verified the intent's evidence against the current tree. Confirmed:

- **Tree-collapse P0** — `StructureTree.js:151-154`. The label `Button`'s `onClick`
  is `() => { onSelect?.(); if (!isExpanded) onToggleExpanded?.(rowKey); }`. The
  `if (!isExpanded)` guard is exactly as described — an expanded row only re-selects.
  Pinned by `StructureTree.test.js:388-397` ("selects but does NOT collapse when an
  already-expanded section label is clicked", asserting `calls.toggle` is `[]`).
- **List-row cluster** — `PitchList.js:41-60` (`HStack alignment="flex-start"`,
  3 fields from `PitchEditor` + trash), `HandConfigEditor.js:161-202` (alters row:
  `HStack alignment="flex-start"`, 2 fields + trash; visible "Alteration note" label
  at `:168`, scoped aria-label at `:169`), `editor.scss:28-31` (the
  `> :first-child { min-width: 8em }` + `> button:last-child { flex: 0 0 auto }` hack).
  Confirmed: only the first child is floored, so the middle `NumberControl`s collapse.
- **NumberControl `__nextHasNoMarginBottom` omission** — confirmed all 7 sites omit it:
  `PitchEditor.js:69,80`; `ContextEditor.js` bpmControl + beatsControl (the two
  `NumberControl`s there); `HandConfigEditor.js:142,178`; `NotePanel.js:179`. Every
  sibling `SelectControl`/`TextControl`/`TextareaControl` sets it. The disagreement
  with review 9 is real and the facts are agreed; see the Open Question section.
- **Destructive-delete inconsistency** — Section removal is confirmed **twice**:
  `SectionPanel.js:160-172` (its own `ConfirmDialog`) and the `StructureTree` root
  `ConfirmDialog` (gated by `pendingRemoveSection`). Measure (`MeasurePanel.js:143-150`),
  note (`NotePanel.js:254-263`), and pitch (`PitchList.js:51-59`) removals fire
  immediately, no confirm.
- **Focus drop after tree remove** — `edit.js` remove handlers (`onRemoveSection:227`,
  `onRemoveMeasure:263`, `onRemoveNote:290`) clear selection but never move focus;
  `StructureTree.js` has no post-mutation focus management.
- **JSON-mode Notice** — `edit.js:520-524` renders `errors[0]` only;
  `InvalidState.js:38-44` maps over all `errors`.
- **Canvas framing docs** — `edit.js:48-51,58-59` and `editor.scss:5-9` call the canvas
  "interactive"/"the surface the author both reads and selects notes on"; `SongCanvas`
  is display+highlight only (no hit-test).
- **Stylesheet doc error** — `edit.js:533` says "`style.scss` lays them out as a flex
  row"; the flex rule is in `editor.scss:38-43`. `style.scss` is `@font-face` only.
- **Redundant `?? undefined`** — `NotePanel.js:235`, `MeasurePanel.js:136`.
- **Mock gap for Stage 2** — `test/mocks/wordpress-components.js` exports `Flex`
  (line ~598) but NOT `FlexItem`/`FlexBlock` (grep confirms neither appears). The three
  `__list-row` hook tests are `pitches.test.js:347`, `annotations.test.js:328`,
  `contextControls.test.js:408`.

## OPEN QUESTION RESOLVED — `NumberControl` and `__nextHasNoMarginBottom`

**Question (the intent flags this explicitly).** Review 10's P0 says every `NumberControl`
omits `__nextHasNoMarginBottom` and should set it (vertical-rhythm consistency with the
~19 sibling controls that set it). Review 9 recorded the opposite as a validated decision
("`__nextHasNoMarginBottom` is NOT wrongly passed to any `NumberControl` — verified all 7",
explicitly-fine). Both reviews agree on the fact (all 7 omit it); they disagree on whether
that is correct. This had to be settled against the **real `@wordpress/components`
`NumberControl` contract**, not by deferring to either review.

**Resolution: Review 9 is correct. Do NOT add `__nextHasNoMarginBottom` to any
`NumberControl`. Leave all 7 sites as-is.**

**Environment / which contract applies.** `@wordpress/components` is not in local
`node_modules` — the build externalizes it as the global `wp-components` (it appears in
`build/index.asset.php`'s dependency list, and `package-lock.json` has zero
`@wordpress/components` entries). So the real contract is the WordPress-runtime component,
not a local file. The plugin requires WP 6.9+ (`piano-block.php` "Requires at least: 6.9"),
`.wp-env.json` pins `core: null` (wp-env's latest-stable default), and `@wordpress/scripts`
is 32.3.0. WP 6.9 ("Gene", released 2025-12-02) bundles Gutenberg ~v21.9, so the live
contract was read against Gutenberg **tag v21.9.0** (`number-control/index.tsx`,
`input-control/index.tsx`). The relevant invariant (below) holds across these versions.

**Why omitting the prop is correct (real-contract evidence, from the researcher, at
Gutenberg v21.9.0):**

1. Every site imports the **experimental** control: `__experimentalNumberControl as
   NumberControl`. That is the component whose contract governs.
2. `__nextHasNoMarginBottom` is a **`BaseControl`** deprecation flag — it suppresses the
   legacy default bottom margin that `BaseControl` used to add. `NumberControl/index.tsx`
   does **not** destructure `__nextHasNoMarginBottom`; it renders `<Input>` (`InputControl`)
   directly with no `BaseControl` of its own, so a passed prop merely lands in `...restProps`
   and is forwarded to the inner input, where it has no margin effect.
3. **The decisive detail:** `InputControl/index.tsx` renders its `<BaseControl>` with
   `__nextHasNoMarginBottom` **hardcoded `true`** — it does not read the flag from its own
   props. So `NumberControl` (which wraps `InputControl`) is **margin-free by construction**;
   there is no deprecated default bottom margin for the prop to suppress in the first place.
4. The prop is **not** a documented prop of `NumberControl` or `InputControl` (their READMEs
   document `__next40pxDefaultSize` but not `__nextHasNoMarginBottom`).
5. Cross-check against the official deprecation, Gutenberg issue **#73848** ("BaseControl:
   Hard deprecate bottom margins", target WP 7.0): its affected-component list is
   CheckboxControl, ComboboxControl, FocalPointPicker, RangeControl, SearchControl,
   **SelectControl, TextControl, TextareaControl**, ToggleControl, ToggleGroupControl,
   TreeSelect. `NumberControl` and `InputControl` are **deliberately not on the list** — they
   have no deprecatable bottom margin. This is why the sibling `SelectControl`/`TextControl`/
   `TextareaControl` correctly DO set the prop and `NumberControl` correctly does NOT.

**Consequence.** Omitting `__nextHasNoMarginBottom` on `NumberControl` produces **no**
deprecated bottom margin — `InputControl` hardcodes the margin-free `BaseControl`. Adding
the prop would be an undocumented no-op that lands in `restProps`: inert at best, React
unknown-prop noise at worst. Review 10's P0 premise ("keeping the deprecated default bottom
margin / breaking vertical rhythm") is factually wrong; Review 9's explicitly-fine verdict
stands. The control asymmetry (siblings set it, `NumberControl` does not) is **correct by
design**, not an oversight.

**Sources.** Gutenberg v21.9.0 `packages/components/src/number-control/index.tsx` and
`input-control/index.tsx`; Gutenberg issue #73848 (affected-component list, WP 7.0 target);
WordPress 6.9 release note (Gutenberg 20.5–21.9 bundle); local `package-lock.json` (0
`@wordpress/components` refs), `.wp-env.json` (`core: null`), `piano-block.php`
("Requires at least: 6.9").

**Requirement R-NUM.** Do **not** add `__nextHasNoMarginBottom` to any `NumberControl`
(`PitchEditor.js:69,80`; `ContextEditor.js:127,149`; `HandConfigEditor.js:142,178`;
`NotePanel.js:179`). This rejects the review-10 "Top priority #3" / Gutenberg-adoption P0.
The rationale above is recorded so a later review does not flip it a third time.
**Acceptance:** the 7 `NumberControl` sites are unchanged; no test asserts the prop on a
`NumberControl`; the decision and its real-contract rationale are documented (here, and the
implementing phase should leave a one-line code/PR note pointing back so the next review
doesn't re-raise it).

**Note on the list-row layout symptom.** Review 10 partly motivated this P0 as "vertical
rhythm," but the actual visible list-row problems (collapsing middle `NumberControl`s,
label collision) are a **layout** issue resolved by the list-row cluster fix (min-width +
alignment), NOT by this margin prop. The two findings are independent; fixing the list-row
cluster does not depend on this prop, and vice versa.

---

## P0 — Inspector list-row layout cluster (Stage 1, no new components)

**Symptom (confirmed).** Leaf editors return bare fragments dropped into one `HStack`, and
`editor.scss:28-31` floors only the **first** child (`> :first-child { min-width: 8em }`)
plus pins the trailing trash (`> button:last-child { flex: 0 0 auto }`). So in the two
multi-field rows the middle/later `NumberControl`s get no floor and collapse — labels
collide ("OCTAVE"+"ALTERATION"); the same 8em floor on the first child forces the two-word
"Alteration note" select label to wrap; and `alignment="flex-start"` top-pins the icon-only
40px trash against the taller labeled fields.

**Affected rows (live coordinates).**
- `PitchList.js:41-60` — `HStack alignment="flex-start"` class `__list-row` → `PitchEditor`
  (3 leaf fields: Note `SelectControl` `PitchEditor.js:61`; Octave `NumberControl` `:69`;
  Alteration `NumberControl` `:80`) + trash `Button` `PitchList.js:51`.
- `HandConfigEditor.js:161-202` — alters `HStack alignment="flex-start"` class `__list-row`
  → Alteration-note `SelectControl` `:167` (visible label "Alteration note" `:168`,
  aria-label `:169`) + Alteration `NumberControl` `:178` + trash `Button` `:195`.
- (`AnnotationEditor` is the third `__list-row` user — `SelectControl` + `TextareaControl`,
  **no `NumberControl`** — so the collapse/collision is only in the two rows above; the
  alignment improvement still applies to it for consistency.)

**Stage 1 decisions (settled against the real controls, mock, and tests).**

- **R-LR1 (alignment).** Change `alignment="flex-start"` → **`alignment="center"`** on the
  list-row `HStack`s (`PitchList.js:41`, `HandConfigEditor.js:164`; apply to the
  `AnnotationEditor` row too for consistency). Real controls render the label *above* the
  input; the icon-only 40px trash has no label and is shorter, so `flex-start` top-pins it.
  `center` vertically centers the trash against the field block (reads balanced and is robust
  if a field ever shows help/error text below, where `flex-end` would drift).
  **Caveat — not unit-assertable:** the `HStack` mock swallows `alignment`
  (`test/mocks/wordpress-components.js`), so this change is invisible to jest. It is
  verifiable only in the real component (Playwright e2e or manual). Do not add a unit test
  that would falsely "prove" it; if covered at all, cover it in the e2e spec.

- **R-LR2 (min-width on the collapsing number fields).** Give each collapsing `NumberControl`
  a min-width via an inline `style={{ minWidth: "4em" }}` (real `NumberControl` forwards
  `style`/`className` through `...restProps` onto a width-bearing node; the mock spreads
  `...rest` onto the `<input>`, so it reaches the DOM and *is* unit-assertable). Apply to
  `PitchEditor.js:69` (Octave), `PitchEditor.js:80` (Alteration), `HandConfigEditor.js:178`
  (Alteration). Value **4em**, not 8em: these hold a signed 2–3 digit number (octave 0–8,
  alter −2..2, octaveShift small signed); 4em fits "−10" plus spinners without re-crowding the
  row. The leading selects keep the existing 8em first-child floor (8em suits an option list).
  Stage 1 keeps the per-control approach; broadening/replacing the `editor.scss:28-31`
  selectors is Stage 2 (follow-up).

- **R-LR3 (shorten the visible label).** Change the visible label "Alteration note" → "Note"
  at `HandConfigEditor.js:168`. Leave the scoped aria-label at `:169` unchanged (it stays
  `fieldLabel("alteration note")`, e.g. "Right hand alteration note"). **Safe — no collision,
  no test break:** the visible string "Alteration note" appears only at that one site and no
  test asserts it; the two tests that locate this select key off the aria-label
  (`contextControls.test.js:381` via `fieldByName(…, "Right hand alteration note")` and `:398`
  filtering on `aria-label === "Right hand alteration note"`). No accessible-name collision
  with `PitchEditor.js:62`'s visible "Note" — different panel/row, distinct aria-labels.
  Once the label is one word it no longer wraps under the 8em floor, so the wrap symptom is
  fixed without touching the select's min-width.

**Stage 1 acceptance.**
- The two multi-field rows render their middle `NumberControl`s at a usable width (no
  collapsed inputs, no "OCTAVEALTERATION" label collision) — assertable in unit tests via the
  inline `min-width` reaching the DOM on the mock.
- The "Alteration note" select label no longer wraps; its aria-label is unchanged; the
  `contextControls` tests stay green.
- The trash icon centers against the field block rather than floating to the top (real-render
  / e2e verification; not unit-assertable due to the `alignment` mock).
- No new component is introduced (Stage 1 stays additive: alignment value, inline min-width,
  one label string).

## P2 / Stage 2 — list-row positional child selectors (FOLLOW-UP, not this run)

`editor.scss:28-31`'s positional `> :first-child` / `> button:last-child` selectors are the
shared root cause. The idiomatic fix is to wrap each leaf editor's fields in `Flex` +
`FlexBlock` (fields) + `FlexItem` (trash) and drop the positional hacks. **This is Stage 2,
a medium follow-up — out of scope for this run** (the intent downgrades it). When it is done
it **must** extend the components mock: `test/mocks/wordpress-components.js` exports `Flex`
but **not** `FlexItem`/`FlexBlock` (verified — neither symbol appears). The three
`__list-row` hook tests (`pitches.test.js:347`, `annotations.test.js:328`,
`contextControls.test.js:408`) only assert the `.__list-row` className exists on the row
container, so they survive a `Flex` swap **provided the className stays on the outer
container** — but the mock must gain `FlexItem`/`FlexBlock` first, or a green test would mask
a missing real primitive. Spec phase decision: **file a tracking issue for Stage 2**, do not
implement now. (See the consolidated follow-up list near the end.)

---

## P0 — Expanded tree rows don't collapse on label click

**Current behavior (confirmed).** `StructureTree.js:151-154` — the section/measure label
`Button`'s `onClick` is `() => { onSelect?.(); if (!isExpanded) onToggleExpanded?.(rowKey); }`.
The `if (!isExpanded)` guard means an already-expanded row only re-selects on label click;
collapse is reachable only via the `aria-hidden` chevron (`:88-110`) or the ArrowLeft key.
This diverges from core List View, where a parent row label toggles both directions. The
guard was added by review 9's S5 "select-and-reveal" change; review 10 deliberately revisits
that tradeoff.

**Requirement R-TREE.** Drop the `if (!isExpanded)` guard so the label always toggles:
`onClick = () => { onSelect?.(); onToggleExpanded?.(rowKey); }`. The behavior becomes
symmetric — a collapsed click selects + expands (review 9's select-and-reveal is preserved);
an expanded click selects + collapses (the new behavior, matching core).

**Scope (confirmed against live code).**
- The fix touches **only** `RowLabelCell` (`StructureTree.js:131-160`), shared by section and
  measure rows.
- The **hand-group** label (`StructureTree.js:490-497`) is a *separate* inline `Button` whose
  `onClick` already calls `onToggleExpanded(handKey)` only (no `onSelect`, no guard) — it is
  already symmetric and is **not** touched. Its test (`StructureTree.test.js:366`, "does not
  select when hand-group label clicked") stays green.
- The chevron pointer path (`TreeExpander`, `:88-110`), the ArrowLeft/Right keyboard path
  (`TreeGrid` `onExpandRow`/`onCollapseRow`), and the add/duplicate auto-reveal/ancestor
  seeding (in `edit.js`) are all independent of this guard and unchanged. No other review-9
  win is re-broken — the change is purely additive to the expanded-label case.

**Tests (exactly one flips).**
- **Update** `StructureTree.test.js:388-397` ("selects but does NOT collapse when an
  already-expanded section label is clicked"): the assertion `calls.toggle` `[]` →
  `["s0"]`, plus the now-stale inline comment (`:393`) and the `it(...)` title (it now
  *does* collapse). The `select` assertion is unchanged.
- **Stay green (verified):** the collapsed-section test (`:377-386`, select+expand), the
  collapsed-measure test (`:399-410`, select+expand), and the hand-group test (`:366`) — none
  asserts the old expanded-no-collapse behavior. There is no measure-equivalent
  expanded-no-collapse test. So exactly one test changes.

**Acceptance.** Clicking an expanded section/measure label selects the row and collapses it;
clicking a collapsed one selects and expands it; the chevron and ArrowLeft/Right paths still
work; the one flipped test passes and all sibling tree tests stay green.

## P1 — Inconsistent destructive deletes (section confirm duplicated)

**Current state (confirmed).** Section removal is confirmed in **two** independent
`ConfirmDialog`s with byte-identical copy "Remove this section and all its measures and
notes?": `SectionPanel.js:160-172` (its own `confirmOpen` state) and the `StructureTree` root
dialog (`StructureTree.js:628-640`, gated by `pendingRemoveSection` state at `:301`). Measure
(`MeasurePanel.js:143-150`), note (`NotePanel.js:254-263`), and pitch (`PitchList.js:51-59`)
removals fire **immediately**, no confirm. So the least-destructive action (pitch) is
unguarded and the most-destructive (section) is double-guarded — inconsistent and redundant.

**Recoverability (confirmed — key to the decision).** The `song` attribute is a plain
`{ type: "string", default: "" }` block attribute (no custom `source`). Every mutator (all 13)
routes through `edit.js` `commit()` (`:173`) → `commitSong(working, onChangeSong)`
(`serializeSong.js:52` calls `onChangeSong(song)`) → `setAttributes({ song })` (`edit.js:135`).
`setAttributes` updates core editor block state, which is in WordPress's native undo/redo
history — so **every edit, including every delete, is one Ctrl+Z away from being restored.**
Deletes are non-destructive/recoverable.

**Decision: Policy (a) — drop all confirm dialogs and rely on native undo.** The structured
editor adopts the consistent, idiomatic policy: remove the section confirm dialogs and make
section removal immediate like the other three. Rationale:
- **Core idiom.** Gutenberg's List View / block delete and inspector control deletes (e.g.
  Navigation / Social Links link removals) use **undo, not a confirm modal**. The block-editor
  convention is undo-not-confirm.
- **Recoverability removes the safety argument.** Since every delete is one undo away
  (confirmed above), a confirm modal is friction without payoff. "Section = a whole subtree,
  heavier" argues for good undo (which exists — it restores the whole subtree in one
  keystroke), not for a modal.
- **It resolves the redundancy and the sub-task at once.** Removing the dialogs eliminates the
  byte-identical double-confirm; with no dialog there is no shared dialog/message constant to
  extract, so that sub-task dissolves.
- **Less code, uniform behavior.** Four delete sites behave identically (immediate), removing
  two `ConfirmDialog`s, the `confirmOpen` state in `SectionPanel`, and the
  `pendingRemoveSection` state/wiring in `StructureTree`.

**Owner fallback (recorded, not chosen): Policy (b) — confirm uniformly.** If the owner
insists on guarding the subtree case, the consistent alternative is ONE shared dialog +
message constant (a small module, e.g. `src/editor/` co-located, reusing the existing
`ConfirmDialog` mock at `test/mocks/wordpress-components.js`) applied to ALL four delete sites
— *not* the current asymmetric mix. Primary recommendation remains (a) because (b) adds
friction to three currently-clean sites for a recoverable action. This run implements (a)
unless the owner directs otherwise.

**Requirement R-DEL.** Implement policy (a):
- Remove the `ConfirmDialog` and `confirmOpen` state from `SectionPanel.js` (the "Remove
  section" button calls `onRemoveSection(sectionIndex)` directly).
- Remove the `pendingRemoveSection` state, its setter, and the root `ConfirmDialog` from
  `StructureTree.js` (the section row's "Remove" menu item calls `onRemoveSection` directly,
  like the measure/note "Remove" items already do).
- Leave the immediate measure/note/pitch removes as-is.

**Tests to update (confirmed).**
- `SectionPanel.test.js:254-285`: the two "remove section" edit tests drop their
  `click(...,"OK")` confirm step (removal now fires on the button click); the "does not call
  onRemoveSection when confirm cancelled" test (`:279-285`) is **deleted** (no dialog to
  cancel).
- `StructureTree.test.js:456-490`: the section remove/duplicate test drops its "OK" confirm
  step; the "does not remove a section when the confirm dialog is cancelled" test is
  **deleted**.
- `Edit.test.js:457-474`: the `onRemoveSection` test drops its "OK" click and updates the
  "opens a ConfirmDialog" comment.

**Acceptance.** All four delete sites fire immediately; no `ConfirmDialog` remains for
section removal; the listed tests are updated/removed and the suite is green; a removed
node is restorable via the editor's native undo.

---

## P1 — Focus dropped to `<body>` after a tree mutation (split scope)

**Bug (confirmed).** The editor has **no** post-mutation focus management — `grep` finds
zero `useEffect`/`useRef`/`.focus()` in `edit.js` and `StructureTree.js`. Consequences:
- **Remove:** the focused row's label `Button` unmounts; DOM default sends focus to
  `<body>`, stranding a keyboard user. `edit.js` also clears the selection
  (`setSelection(null)` at `:233/:282/:312`), so there is no "selected new row" to fall back
  to.
- **Add/duplicate:** `edit.js` calls `setSelection(newCoords)`, so the new row renders with
  `aria-current="true"` (`StructureTree.js:150`), but **selection is not DOM focus** — nothing
  calls `.focus()`, so the keyboard user is not moved to the new row.

**Architecture & idiom.** The tree is purely controlled (`edit.js` owns selection/expansion;
`StructureTree` owns the DOM and exposes no refs upward), so any focus machinery must live
**inside `StructureTree`**, keyed on selection. Core List View does focus-after-mutation via a
**ref-callback** (e.g. Gutenberg PR #74431) and treats it as genuinely fiddly (expand-timing
ordering bugs; PR #48339 for selection↔tabindex coordination). The label `Button` already
receives roving `cellProps` from `TreeGridCell`; our focus ref must be merged onto that Button
in the real component.

**Testability (critical — false-green risk).** DOM focus after mutation is **not
unit-assertable** here: the `TreeGridCell` mock calls its render-prop child with `{}`
(`test/mocks/wordpress-components.js:539-544`), so `cellProps.ref` is `undefined` under jest
and any ref-based `.focus()` is inert. The mock's own docstring states the roving-tabindex
wiring is **e2e-only**. There are zero `activeElement`/`.focus()`/`toHaveFocus` assertions in
`__tests__`; all real focus assertions live in `specs/editor.spec.js` (Playwright;
`treeRow(...).focus()` + `page.keyboard.press(...)` at `:1317/:1352/:1384`). So this fix must be
verified in e2e, not jest — a passing unit test would mask a broken real control. Jest can
only assert the **structural precondition** (selection moved → the new row carries
`aria-current`).

**Decision: split the scope.** Fix the high-harm half cleanly now; defer the precise
survivor-math.

**Requirement R-FOCUS (this run):**
1. **Add/duplicate → focus the new row's label Button.** After the mutator sets the selection,
   `StructureTree` focuses the `aria-current` row's label `Button` (via a ref captured in
   `RowLabelCell`, or by querying the `[aria-current] .…__tree-label` node), so the keyboard
   user lands on the newly-added/duplicated row.
2. **Remove → focus a stable tree anchor (no `<body>` dump).** Make the tree container
   programmatically focusable (`tabIndex={-1}` on the `…__tree` / `role="treegrid"` host) and
   `.focus()` it after a remove, so the keyboard user lands back in the tree region and can
   arrow to a row — instead of falling to `<body>`. Do **not** compute a nearest-survivor row
   in this run.

**Follow-up (deferred — file an issue):** precise "focus the nearest surviving sibling/parent
row" after remove (real index math with edge cases: last row, parent removal, empty tree).
The stable-anchor fix already cures the actual P1 harm (stranding on `<body>`); survivor
precision is genuine polish, riskier, and — like the rest of focus — only e2e-guardable.

**Acceptance.** In e2e (`specs/editor.spec.js`, extended): after add/duplicate, focus is on
the new row's label; after remove, focus is in the tree region (not `<body>`). In jest: the
structural precondition holds (the new row carries `aria-current` after add/duplicate). The
fix introduces focus machinery only inside `StructureTree`; `edit.js` stays declarative.

## P2 polish set (small, in-scope)

These are small, well-scoped, and recommended (not "optional/partial rejects"). Implement all:

- **R-JSON (JSON-mode Notice shows only the first error).** `edit.js:520-524` renders
  `errors[0]` only; `InvalidState.js:38-44` lists all. Map over `errors` in the JSON-mode
  `Notice` (mirror `InvalidState`'s `<ul>`/keyed `<li>` list). **Acceptance:** with multiple
  validator errors, JSON mode shows every message; **update `Edit.test.js:309`** (currently
  `expect(notice.textContent).toBe(errors[0])`) to assert every error renders (e.g. the
  notice text contains each message / the list has one `<li>` per error).
- **R-NOOP (redundant `?? undefined`).** `NotePanel.js:235` and `MeasurePanel.js:136` pass
  `annotations ?? undefined` to `omitFalsy`, but `AnnotationList` already collapses empty →
  `undefined`, so the coalesce is a no-op stating the rule twice. Drop the `?? undefined`
  (pass `annotations`). **Acceptance:** behavior unchanged (empty annotations still drop the
  key); existing annotation tests stay green.
- **R-INVALID (`InvalidState` Gutenberg adoption, partial).** `InvalidState.js:30-49` — drop
  the redundant `<p>` and wrap the container in a `VStack` (`__experimentalVStack`); **keep**
  the `<ul>` error list. Low-traffic error state. **Mock prerequisite (confirmed):** `VStack`
  is **not** currently exported by `test/mocks/wordpress-components.js` and is unused in `src`
  — so the implementing task must **add a `VStack`/`__experimentalVStack` stand-in to the
  mock** (a simple `<div>` wrapper like the existing `HStack`/`Flex` mocks) before/with this
  change, or the import fails under jest. **Acceptance:** the error messages and the "Edit as
  JSON" button still render; the mock exports `VStack`; tests that locate the messages/button
  by text/role stay green.
- **R-DOCS (cross-cutting doc corrections, docs-only):**
  - Canvas "interactive" framing → "display + highlight only." Fix the misleading comments in
    `edit.js` (the visual-mode docstring `:48-51` "an interactive sheet-music `SongCanvas` the
    author both reads and edits on", and `:58-59`/related) and `editor.scss:5-9` ("the surface
    the author both reads and selects notes on", "interactive canvas wrapper"). `SongCanvas`'s
    own docstring is already correct. **Reject** wiring click-to-select (net-new feature; the
    canvas comment defers it). The optional coarse measure/section highlight is a separate
    filed follow-up (below), not this run.
  - Stylesheet name: `edit.js:533` says "`style.scss` lays them out as a flex row" — wrong; the
    flex rule is in `editor.scss:38-43` (`style.scss` is `@font-face` only). One-word fix.
  - Trim the thrice-restated CRITICAL doc-block prose: `songModel.js:328-335` carries the full
    cautionary paragraph; trim to ~one line. (`setMeasureAt:354-355` and `setEventAt:382-383`
    already reference back — leave them.) **Keep all three depth-splice helpers distinct**
    (merging into `setAt(song, coords, depth)` is on the reject list — do not). Docs-only.
  - **Acceptance:** no behavior change; comments accurately describe the code; no test asserts
    the old wording (verify).

## P2 "optional/partial" set — scope ruling

The intent tags these as optional/partial product choices or low-leverage, several explicitly
"not a defect." To keep this run focused on the recommended fixes and avoid undoing
deliberate v1 choices, the spec **does not require** them this run (they may be picked up
opportunistically only if trivially safe, but none is an acceptance gate):

- **Toolbar toggles lack explicit `label`/`showTooltip`** (`edit.js:488-503`) — downgraded in
  the intent to polish, not an a11y defect (visible text already names them). **Not required.**
- **Add-for-empty-parent affordances scattered** (`SongPanel.js:80`, `SectionPanel.js:144`,
  `StructureTree.js`) — a v1 product choice, handlers already lifted. **Not required.**
- **Hand-group rows look selectable but only toggle** (`StructureTree.js:490-497`) — mild; they
  have a distinct +Add-note cell and no row menu, and already toggle correctly. **Not required.**
- **Curried `mapMeasure`/`mapEvent`** (`noteNames.js:184-240`) — low leverage; inlining is
  cosmetic. **Not required.**
- **`globalMeasureNumber` rebuilds the coord array** (`selection.js:114-146`) — negligible
  (songs are small). **Not required.**
- **`ContextEditor` `resetAll` duplicates per-item deselects** (`ContextEditor.js:196-209`) —
  a real DRY/drift risk but a clean fix must batch into one emission (more than "call the three
  handlers"); low priority. **Not required** this run (candidate for a future cleanup).

## Follow-up tracking issues to FILE (decision: file all three, implement none this run)

The repo already uses GitHub issues as its tracking convention (the codebase references
Issue #8, #21; `SongCanvas.js:16,43` already note follow-ups in comments). File a tracking
issue for each, labelled follow-up; do **not** implement in this run:

1. **`edit.js` 13-mutator descriptor-table refactor** (`edit.js:179-479`). ~120-150 lines
   saveable but risky (touches the mutation core; each explicit mutator is individually
   testable). Gate it behind "only if levels/reveal rules change." **File.**
2. **Canvas section/measure highlight** (S6-style). The `data-measure` attribute and
   `globalMeasureNumber` already exist, so it is reachable, but it is net-new highlight
   behavior already deferred in-code (`SongCanvas.js:16,43`). This run does only the doc
   correction (R-DOCS); the highlight feature is the filed follow-up. **File.**
3. **List-row Stage 2** (`Flex` + `FlexBlock` + `FlexItem` replacing the `editor.scss:28-31`
   positional selectors). Requires extending the components mock with `FlexItem`/`FlexBlock`
   (only `Flex` exists today) and updating the three `__list-row` hook tests
   (`pitches.test.js:347`, `annotations.test.js:328`, `contextControls.test.js:408`). Stage 1
   ships the visible-symptom fix this run. **File.**
4. **(From R-FOCUS)** Precise "nearest surviving sibling/parent" focus after remove. **File**
   as the focus polish follow-up.

---

## Carried-over wins and rejects (do NOT touch)

For the implementing phases, the following are explicitly preserved/rejected per the intent —
they must not be "fixed":

**Preserved prior-review wins:** the real-`TreeGrid` keyboard model and a11y parity; the
single expansion `Set` + coordinate keys; `[aria-level]` indent; recolor-only canvas
highlight; the depth-fixed `setSectionAt`/`setMeasureAt`/`setEventAt` helpers (kept distinct);
`omitEmpty` vs `omitFalsy`; raw-JSON mode untouched. The only two prior-review decisions this
run deliberately revisits are review 9's select-only/expand-on-collapsed label behavior
(now R-TREE: symmetric toggle) and the `NumberControl` margin decision (R-NUM: confirmed
review 9 — leave omitted).

**Rejected suggestions (do not implement):** converting the tree/canvas workspace to
`Flex`/`HStack` (the `flex:0 1 auto`/`max-width:24em`/`min-width:0` rules are load-bearing);
dropping the `accessibleName`/`system` `useMemo`s; changing `TreeExpander` to a `Button`/adding
a role (it mirrors core's `ListViewExpander`; a Button adds a wrong second tab stop); merging
the three depth-splice helpers into one `setAt`; wiring full click-to-select on the canvas.

**Carried-over constraints:** editor-side only — song format/schema, `render.php`, and the
front-end SVG are unchanged (a published song renders byte-identically). Only `@wordpress/*`
packages; no new outside dependencies. Where a fix depends on a real `@wordpress/components`
contract, verification must exercise the real contract (the focus fix and the alignment
change are e2e-verified, not falsely unit-greened; the Stage-2 follow-up must extend the mock
rather than let a green test mask a missing `FlexItem`/`FlexBlock`).
