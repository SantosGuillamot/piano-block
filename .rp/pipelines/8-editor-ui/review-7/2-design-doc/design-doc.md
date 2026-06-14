# Review 7 Design Doc — Fix the invisible row actions, adopt the Gutenberg block-menu model, polish tree alignment/separation

_Design doc for review 7 of the Piano block editor-UI feature ([Issue #8](https://github.com/SantosGuillamot/piano-block/issues/8), PR #22). Standalone: a plan-phase reader with this file, `1-spec/spec.md`, and the code on branch `worktree-8-editor-ui` has everything needed to produce a correct code plan. Decisions here are settled — they are not re-opened in plan/code. A genuine contradiction with the spec is a blocker, not a judgment call._

## 1. Context and goals

The Piano block ships a working visual editor: a **structure tree** (Section → Measure → {Right hand, Left hand} → Note) beside a read-only sheet-music canvas, per-kind inspector panels, and a raw-JSON toolbar toggle. Review 6 rebuilt the tree (`src/editor/StructureTree.js`) on core's List View row pattern — each row a `TreeGridRow` with a select-only label `Button` (preceded for expandable rows by a non-focusable `TreeExpander` chevron) and a per-row `DropdownMenu` of actions; `edit.js` owns the one `expanded` Set and all song mutators; `style.scss` is layout-glue. The owner accepted that direction ("The UI starts to feel better") and it **stays**.

But the shipped result has **one functional regression** (the per-row actions are invisible) and **three polish gaps** (chevron misalignment, no tree/canvas separation, and the block-menu model is not yet adopted). This review fixes all four, and — critically — adds an in-environment verification design so "unit tests green + actions invisible" can never recur. Everything is editor-side: the song schema, `render.php`, and the front-end SVG are untouched, so a published song renders byte-identically before and after (R-KEEP1).

The scope of this design (the decisions it owns):

1. The real-component-correct `DropdownMenu` composition (render-function children) and the reshaped block-menu item set, at section, measure, and note level; plus the hand-row "Add note" button's real icon element.
2. The positional-insertion model (`Add before` / `Add after`) in `edit.js`, valid-by-construction, with auto-select + reveal.
3. The chevron-label alignment (CSS-only) and the tree/canvas separation (gap + `border-inline-end` divider).
4. The test-harness redesign — the hardened `DropdownMenu` mock, the real-icon guard test with a six-module React-dedup `moduleNameMapper`, the toggle-presence assertion, and the e2e deltas.

It also makes one **owner-visible consequence call** (carried faithfully from the design research, §3.3): re-homing the section menu's "Add measure" capability to a `SectionPanel` button, because the block-menu reshape removes the only existing way to add a measure to a zero-measure section.

## 2. The two root causes (why the actions are invisible)

Both are established facts (from `1-spec/spec-research.md`, re-grounded against the real WordPress source and the installed `node_modules`), not hypotheses. The fixes follow directly.

### Root cause #1 (primary) — the `DropdownMenu` renders nothing

Core's `UnconnectedDropdownMenu` (`@wordpress/components` `dropdown-menu/index.tsx`) has a top-of-body guard:

```js
if ( ! controls?.length && ! isFunction( children ) ) return null;
```

It returns from the **whole component** — no toggle is even placed in the DOM. The shipped tree passes **plain-element** children (`<MenuGroup><MenuItem/></MenuGroup>`) and no `controls`, so every per-row menu renders nothing: no three-dots toggle, nothing to click. `isFunction` is core's local `typeof maybeFunc === 'function'` (not lodash). The guard is byte-identical in behavior across `@wordpress/components` 29.5.2 (WP 6.8), 30.6.x (WP 6.9), and trunk.

**Fix:** satisfy the contract by passing **children as a render function** — `({ onClose }) => <>…</>`. (See §3.1; the `controls` array form is rejected there.)

### Root cause #2 (secondary) — the hand-row icon is a string Dashicon slug

The hand-row "Add note" `Button` uses `icon="plus"` — a **string**, which `Icon` renders as `<Dashicon icon="plus">` (class `dashicons-plus`), needing the dashicons font stylesheet that is **not reliably present in the editor canvas iframe** (the block has no `editorStyle`; apiVersion 3 mounts the edit UI in the canvas iframe). The result is an empty bordered square. A real `@wordpress/icons` `plus` is a pre-rendered SVG **element** that inlines (via `Icon`'s `cloneElement(icon)`) with no stylesheet.

**Fix:** `icon={plus}` (element imported from `@wordpress/icons`). See §3.4.

### Why the regression escaped — and the verification gap this review closes

Review 6's 669 unit tests stayed green while the UI was broken because the jest harness **stubs the very components involved**: the `DropdownMenu` mock in `test/mocks/wordpress-components.js` renders element children **unconditionally** (it can never reproduce core's `return null`), and `@wordpress/icons` is mapped to **string sentinels** in `test/mocks/wordpress-icons.js` (so `icon="plus"` vs `icon={plus}` is indistinguishable). The Playwright e2e specs, though migrated by construction, **never ran** (wp-env port conflict here). Section 5 redesigns the harness so both failure modes become red tests.

## 3. Component & API design (the editor-side changes)

All editor changes live in three files — `src/editor/StructureTree.js`, `src/edit.js`, `src/style.scss` — plus the `SectionPanel` "Add measure" addition (§3.3). The song format, `render.php`, the front-end SVG, and `songModel.js`'s exported primitives are unchanged.

### 3.1 The `DropdownMenu` composition and the block-menu item set (R-REG1, R-MENU1)

**Change `StructureTree.js`'s per-row `DropdownMenu` children from plain elements to a render function**, at section, measure, AND note level. Only the cell's `children` change; the `TreeGridCell` wrapper and the `DropdownMenu`'s `icon={moreVertical}` / `toggleProps={{ ref, tabIndex, onFocus }}` / `label` stay byte-for-byte (the render-function-vs-plain-element choice affects only `renderContent`, never the toggle — see R-KEEP4 in §6).

The canonical shape, byte-mirroring core's block-settings menu (`block-editor`'s `block-settings-dropdown.js` returns `({ onClose }) => (<> …primary group… { canRemove && <MenuGroup><MenuItem>Delete</MenuItem></MenuGroup> } </>)` — destructive item isolated in its own **trailing** `MenuGroup`):

```jsx
<TreeGridCell>
  {({ ref, tabIndex, onFocus }) => (
    <DropdownMenu
      icon={moreVertical}
      toggleProps={{ ref, tabIndex, onFocus }}
      label={/* "Actions for Section %d" etc., unchanged */}
    >
      {({ onClose }) => (
        <>
          <MenuGroup>
            <MenuItem onClick={() => { onDuplicateSection?.(sectionIndex); onClose(); }}>
              {__("Duplicate", "piano-block")}
            </MenuItem>
            <MenuItem onClick={() => { onAddSectionBefore?.(sectionIndex); onClose(); }}>
              {__("Add before", "piano-block")}
            </MenuItem>
            <MenuItem onClick={() => { onAddSectionAfter?.(sectionIndex); onClose(); }}>
              {__("Add after", "piano-block")}
            </MenuItem>
          </MenuGroup>
          <MenuGroup>
            <MenuItem isDestructive onClick={() => { onRemoveSection?.(sectionIndex); onClose(); }}>
              {__("Remove", "piano-block")}
            </MenuItem>
          </MenuGroup>
        </>
      )}
    </DropdownMenu>
  )}
</TreeGridCell>
```

Design rules carried from the design research (Q1, against `@wordpress/components` trunk):

- **Render-function signature.** `Dropdown` builds one `args = { isOpen, onToggle, onClose }` (`dropdown/index.tsx`) passed to both `renderToggle` and `renderContent`; `DropdownMenu.renderContent` invokes `isFunction(children) ? children(props) : null`. Destructuring just `{ onClose }` is exactly core's idiom. Multiple sibling `MenuGroup`s in one fragment is the canonical pattern.
- **Item set, identical in shape at all three levels.** Primary group order **Duplicate → Add before → Add after**; **Remove** alone in a trailing `MenuGroup` with `isDestructive`. The labels are exactly `"Add before"` / `"Add after"` (core's labels). No Move up/down, Copy/Cut, or styles items (there is no clipboard or style model for song nodes). Only the `label` sprintf and the coordinate args differ per level (section: `sectionIndex`; measure: `(sectionIndex, measureIndex)`; note: the full 4-tuple `(sectionIndex, measureIndex, hand, eventIndex)`).
- **`isDestructive` is real.** `MenuItem` spreads `...buttonProps` onto its `<Button>`, which applies the `is-destructive` class via clsx → the red treatment. The accessible name is the text children (`<span className="components-menu-item__item">{children}</span>`), so `getByRole("menuitem", { name })` matches "Duplicate"/"Add before"/"Add after"/"Remove". No `label` or explicit `role` prop on the `MenuItem`s.
- **Each item handler is `() => { handler?.(coords); onClose(); }`** — act, then dismiss. The `?.` optional-chaining the current code uses is kept. Handler/`onClose` order is **not** load-bearing here: our handlers are lifted `edit.js` mutators that `setState`/`commit` independently of the menu, so act-first and close-first are equivalent. `onClose` is the `Dropdown`/`Popover` `close`, and `Popover`'s focus-return restores focus to the trigger — the mechanism that satisfies R-KEEP4 (§6).

**The old "Add measure" section-menu item is REMOVED** (today `StructureTree.js:206-208`). It is not part of the `{Duplicate, Add before, Add after | Remove}` set. Its capability is re-homed to `SectionPanel` (§3.3); the reshape must not accidentally keep it.

**Alternative rejected — `controls={DropdownOption[][]}` form.** It would also satisfy the guard, but `controls` render plain `Button`s **without** the `MenuItem` wrapper, so they cannot carry `isDestructive` (no red Remove, R-MENU1) and they rewrite the markup. Render-function children are the minimal diff that preserves the existing `MenuGroup`/`MenuItem`/`isDestructive` grouping and yields `onClose`. The spec names render-function children the strong default; `controls` is out.

**New handler props wired into the tree** (alongside the kept `onDuplicate*` / `onRemove*`): `onAddSectionBefore`, `onAddSectionAfter`, `onAddMeasureBefore`, `onAddMeasureAfter`, `onAddNoteBefore`, `onAddNoteAfter`. The old `onAddMeasure` **tree prop is dropped** (the section menu no longer calls it); `onAddMeasure` itself survives in `edit.js`, now driven by `SectionPanel` (§3.3).

### 3.2 Positional insertion in `edit.js` (R-MENU2, R-KEEP5)

`edit.js` has no positional-insert handlers today — only append-style `onAddSection`/`onAddMeasure`/`onAddNote` and `onDuplicate*`. Add **six named per-kind before/after handlers**:

```
onAddSectionBefore(sectionIndex)             onAddSectionAfter(sectionIndex)
onAddMeasureBefore(sectionIndex, measureIndex)   onAddMeasureAfter(sectionIndex, measureIndex)
onAddNoteBefore(sectionIndex, measureIndex, hand, eventIndex)
onAddNoteAfter(sectionIndex, measureIndex, hand, eventIndex)
```

Each handler:

1. Computes `target = index` (before) or `index + 1` (after) — `index` being the row's own coordinate at that depth (`sectionIndex` / `measureIndex` / `eventIndex`).
2. `insertAt(list, target, newX())` at the right depth, rebuilding `section → sections` (and `measure → measures` for measures, `measure[hand]` for notes) immutably **exactly as the existing duplicate handlers do** — `onDuplicateMeasure` (`edit.js:354`) is the closest template; the positional inserts replace its `duplicateAt(list, i)` with `insertAt(list, target, newX())` and select `target` (not `i+1`).
3. `commit(nextWorking)` — `commitSong` serializes and re-validates (R-KEEP5).
4. `setSelection({ kind, …coords with the inserted index = target })` — auto-select the new node.
5. `revealAncestors(...)` the new node's ancestor expansion keys: **none** for a section (top level always visible, matching `onDuplicateSection`); `expansionKey({ sectionIndex })` for a measure; `expansionKey({ sectionIndex })`, `expansionKey({ sectionIndex, measureIndex })`, and `expansionKey({ sectionIndex, measureIndex, hand })` for a note.

**Building blocks already exist** (`songModel.js`): `insertAt(list, index, item)` (`songModel.js:262`), `newSection()` (one empty measure, `:220`), `newMeasure()` (`{}`, `:210`), `newNote()` (one middle-C pitch, `:191`). Only the `edit.js` handlers are new. A thin internal helper `insertNodeAt(list, target, factory)` MAY back the six to avoid copy-paste, but **the prop surface stays six named handlers** — the tree wires them as static `MenuItem` `onClick`s, so there is no runtime `where` to thread and a parameterized `onAddXAt(coords, where)` buys nothing.

**Valid-by-construction (R-MENU2, R-KEEP5).** Each `newX()` is schema-conformant; `insertAt` over a valid list at any index in `[0, len]` stays valid; `commit` re-validates. The index is always in range because it is the row's own coordinate.

**Auto-select coordinates.** `setSelection` must carry the inserted node's `kind` and the `target` index at the right depth — e.g. a measure "Add before" at `(0, 1)` selects `{ kind: "measure", sectionIndex: 0, measureIndex: 1 }` (the new node now sits at index 1); a note "Add after" at `(0, 0, "rightHand", 2)` selects `{ kind: "event", sectionIndex: 0, measureIndex: 0, hand: "rightHand", eventIndex: 3 }`. This mirrors `onDuplicateMeasure`/`onDuplicateNote` (which select `index + 1`), differing only in `target`.

**The empty-hand boundary is NOT a positional-insert case (R-MENU3).** Note "Add before"/"Add after" appear only on **existing** note rows (anchored at a real `eventIndex`), so the `[hand]` list is always non-empty and insertion only **grows** it — there is no `delete measure[hand]` rebuild like `onRemoveNote` (`edit.js:302`); insertion never empties a hand. Seeding the **first** note of an empty hand stays the hand-row "Add note" `Button` (§3.4) and the Note-panel "Add note"; all three note-add affordances coexist (verified: `NotePanel` keeps its own `onAddNote`/`onRemoveNote`).

**Why six named handlers, not a parameterized one** (alternative weighed in the design research): A1's canonical menu template wires these exact names; it mirrors the existing per-kind explicit handler-prop surface (`onDuplicate*` / `onRemove*`); and the menu items are static, so a runtime `where` parameter would cost a closure at each call site for no gain. Decision settled.

### 3.3 The zero-measure-section recovery — "Add measure" re-homed to `SectionPanel` (R-KEEP6, R-MENU1) — OWNER-VISIBLE CONSEQUENCE

> **Call this out explicitly to the owner.** Removing "Add measure" from the section row menu (§3.1) eliminates the **only** way the editor can add a measure to a section that has **zero** measures. This design re-homes that capability to a **`SectionPanel` "Add measure" button**. The visible change for the owner: what used to be the section menu's "Add measure" item is now a button in the Section inspector panel.

The gap, verified on-branch: (a) the schema (`src/song/schema.js`) requires `measures` but sets no `minItems`, so `measures: []` is conformant; (b) `onRemoveMeasure` (`edit.js:279`) has no last-measure guard, so removing a section's last measure is allowed and leaves `measures: []`; (c) the section menu's `onAddMeasure` is the **sole** "Add measure" entry point — `SectionPanel` has no add-measure control today, and the new block menu puts "Add before/after" only on **measure** rows (a zero-measure section has none). So after the reshape, a section emptied of measures would become a dead end in the visual editor (only raw-JSON could re-seed it).

**Decision: add an "Add measure" `Button` to `SectionPanel`, reusing the already-present `onAddMeasure(sectionIndex)` handler from `edit.js`** (which the reshape otherwise orphans). This is the section-level mirror of core's "a container always has an appender" invariant: core's `BlockListAppender` (`block-editor/src/components/block-list-appender/index.js`) renders a default appender whenever `getBlockCount(rootClientId) === 0` and **never** blocks removing the last child. It is also the exact analog of R-MENU3's blessed pattern — the hand-row direct "Add note" `Button` seeds the first child where "before"/"after" has no anchor; a zero-measure section is the same boundary one level up.

**Why this is in-spec, not new scope.** R-MENU1 reshapes the row **menu** only; it does not forbid a non-row affordance, nor mandate one. R-KEEP6 ("every inspector field/affordance reachable today stays reachable") **requires** a surviving "Add measure" entry point, since it is reachable today via the section menu. The spec's Out-of-Scope bars _new_ authoring capability beyond positional add; retaining an existing capability is the opposite. This is therefore a design call **within** the spec (R-KEEP6 + R-MENU1), not a spec blocker — but it is owner-visible and must be surfaced.

**Integration points for `SectionPanel`** (`src/editor/inspector/SectionPanel.js`):
- The panel already receives `selection` (carrying `sectionIndex`) and is rendered whenever any section/measure/event is selected (`edit.js:511-518`). A zero-measure section is still selectable as a section row, so the recovery path is always present.
- Add the new `onAddMeasure` prop to the panel's props and have `edit.js` pass it (`<SectionPanel … onAddMeasure={onAddMeasure} />`). The existing `Button` near the panel's bottom (the "Remove section" button at `SectionPanel.js:135-141`) is the placement model: a `variant="secondary"` `Button` calling `onAddMeasure?.(sectionIndex)`, labelled `__("Add measure", "piano-block")`.
- `onAddMeasure` in `edit.js` (`:261`) is unchanged — it already appends `newMeasure()` to `section.measures` and commits; its `sectionIndex = working.sections.length - 1` default still covers a call with no target, but the panel passes the explicit `sectionIndex`.

**Alternatives rejected:** (i) accept the dead-end + document it — re-creates the unreachable-affordance bug class this whole review exists to kill (it is the documented fallback only if the owner insists on strict minimal-diff; defensible because `newSection()` always seeds one measure, so zero-measures arises only by explicit last-measure removal). (ii) Guard `onRemoveMeasure` against removing the last measure — **anti-core** (core never blocks the last-child delete; it provides a re-add path instead).

### 3.4 The hand-row "Add note" glyph (R-REG2)

**Replace the string slug `icon="plus"` (`StructureTree.js:365`) with the `@wordpress/icons` element `icon={plus}`.** Import `plus` alongside the existing `moreVertical` / `chevron*` from `@wordpress/icons` (`StructureTree.js:53-58`). Everything else on that `Button` stays — `variant="secondary"`, its `label` (the `addNoteLabel` sprintf), and its `onClick={() => onAddNote?.(sectionIndex, measureIndex, hand)}`. This is the only hand-row change; it produces an inline SVG (via `Icon`'s `cloneElement`) needing no dashicons stylesheet. R-REG3b's real-icon test (§5.2) covers this exact regression — and it is **THE** root-cause-#2 canary (the toggle/chevron icons are already real elements; only this `plus` was the shipped string).

### 3.5 Chevron-label alignment — Recipe A, CSS-only (R-POLISH1)

The disclosure chevron sits off the label baseline because the per-level `[aria-level]` indent today is `padding-left` on the **label `Button` only** (`style.scss:66-70`), with the chevron `<span>` an unstyled sibling pinned at the cell's left edge with no flex container — so only the label text indents while the chevron stays fixed.

Core's List View centers the expander against the label via a flex line and a fixed square box, and — the defining trait — puts the per-level indent on the **leading** element so the **whole** chevron+label line shifts right as a unit per level (a nested-disclosure read). **Adopt Recipe A** (CSS-only, in `style.scss`, no `TreeExpander` markup change — R-POLISH1):

1. Make the **label cell** a flex line: `[role="gridcell"]:first-child` inside `&__tree` becomes `display: flex; align-items: center`. (Key off `:first-child` so the **actions cell** — the second `<td>`, holding the `DropdownMenu` — is never flexed or indented; the label cell is uniformly first at every row level: section/measure/hand/note.)
2. Add a new `&-expander` rule making the chevron a fixed `$icon-size` (24px) square that centers its `<Icon>`: `display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; flex: none`.
3. **Move** the per-level indent off `&-label`'s `padding-left` onto `padding-inline-start` on the first gridcell, keyed by `[aria-level]`, **keeping the `1.5em` unit** (R-KEEP3 — don't switch to px). I.e. replace the current `@for $i … { [aria-level="#{$i}"] &-label { padding-left: ($i - 1) * 1.5em; } }` with `[aria-level="#{$i}"] [role="gridcell"]:first-child { padding-inline-start: ($i - 1) * 1.5em; }`. `&-label` keeps **only** its truncation rules (`white-space: nowrap; overflow: hidden; text-overflow: ellipsis`).

This matches core's nested-disclosure behavior (chevron + label indent together, chevron vertically centered on the label) and keeps review-6's `[aria-level]`-driven indentation idiom (R-KEEP3) — only **which** element carries the indent changes (label `Button` → first gridcell), not the data source (the rendered `aria-level` emitted by `TreeGridRow`'s `level`). The chevron's swap-vs-rotate difference from core (review 6 swaps `chevronRightSmall`/`chevronDownSmall`) is cosmetic and out of scope.

**Alternative rejected — Recipe B** (flex the cell + size the expander box, but leave the label's existing `padding-left`): the chevron sits at the cell's left edge and does **not** track the indent. It passes the literal AC-POLISH1 ("vertically centered against the row label text") but abandons the indent-tracking that makes a tree read as nested disclosure; Recipe A is barely more CSS and is the honest match to "core's List View."

### 3.6 Tree/canvas separation (R-POLISH2)

The tree sits close to the canvas with no boundary. **Add an editor-native hairline rule + breathing room, all in `style.scss`, logical properties only:**

- On `&__tree` (`style.scss:56`): `border-inline-end: 1px solid #ddd; /* core's $gray-300, the standard editor border gray */` plus `padding-inline-end: 1em;` (keeps the hairline off the right-edge labels, **inside** the border).
- On `&__workspace` (`style.scss:42-47`): bump `gap: 1em` → `gap: 1.5em` (space **outside** the border, between the rule and the canvas).

Splitting the breathing room (pad inside, gap outside) is the clean reading — all-gap would leave the border flush against the longest label; all-padding would hug the canvas to the rule. Values sit on the `$grid-unit` scale (`$grid-unit-20: 16px ≈ 1em` inside, `$grid-unit-30: 24px ≈ 1.5em` outside); they are layout-glue numbers, not a token contract. Both properties are **logical** (`border-inline-end`, `padding-inline-end` — never `border-right`/`padding-right`), respecting the existing `isRTL()` handling (R-POLISH2). Editor-side only (R-KEEP1).

**Color decision: the commented `#ddd` literal**, consistent with the file's existing literal-hex / zero-import style (it already hardcodes `#007cba` at `style.scss:113-115` and imports nothing), and it sidesteps the transitive-dep fragility of a namespaced `@use`. The `@use "@wordpress/base-styles/colors"` → `colors.$gray-300` form is an **explicitly-allowed alternative** for a team that prefers tokens (it resolves in the real build — `@wordpress/scripts`' sass-loader resolves bare `@wordpress/*` specifiers, proven by the existing `url("./notation/pb-music.woff2")`; and `@wordpress/base-styles` is installed). A runtime `var(--wp-…)` is **not** available for a neutral border gray (core exposes runtime vars only for the accent/focus color), so the requirement does not depend on one. The optional `$gray-100` (`#f0f0f0`) panel-shade is allowed but **not adopted** — the hairline + space is the minimal, most List-View-like answer.

## 4. Architecture summary — what changes, what is invariant

| File | Change |
|---|---|
| `src/editor/StructureTree.js` | Per-row `DropdownMenu` children → render function; reshape item set to `{Duplicate, Add before, Add after \| Remove}` at section/measure/note; import `plus`, swap hand-row `icon="plus"` → `icon={plus}`; drop the `onAddMeasure` tree prop, add `onAdd{Section,Measure,Note}{Before,After}` props (and remove the section-menu "Add measure" item). No `TreeExpander` markup change. |
| `src/edit.js` | Add six positional-insert handlers (`onAdd{Section,Measure,Note}{Before,After}`); wire them into `<StructureTree>`; drop the `onAddMeasure` tree prop from `<StructureTree>`; pass `onAddMeasure` to `<SectionPanel>`. |
| `src/editor/inspector/SectionPanel.js` | Add an "Add measure" `Button` calling `onAddMeasure?.(sectionIndex)` (new prop). |
| `src/style.scss` | Recipe A chevron alignment (flex label cell, `&-expander` box, indent moved to first gridcell); `border-inline-end` + `padding-inline-end` on `&__tree`, `gap` bump on `&__workspace`. |
| `test/mocks/wordpress-components.js` | Harden the `DropdownMenu` mock to mirror core's `return null` guard (§5.1). |
| `jest.config.js` | Add the six-module React-dedup `moduleNameMapper` (§5.2) — test-only, no runtime dep. |
| `src/editor/__tests__/StructureTree.test.js` | Update item names (drop "Add measure", add "Add before"/"Add after"); add a toggle-presence assertion; add the positional-insert assertions. |
| `src/editor/__tests__/StructureTree.realIcons.test.js` (NEW) | Real-icon guard with local `jest.mock` overrides (§5.2). |
| `specs/editor.spec.js` | Consistency-only deltas (§5.3): item names, section-grow via the `SectionPanel` button, ordinal re-mapping after positional inserts. |

**Invariant (untouched):** `src/song/schema.js`, `render.php`, the front-end SVG (incl. `data-measure`/`data-hand`/`data-event-index` and the `@font-face` "PB Music" font), `songModel.js`'s exported primitives, `selection.js`, the inspector control vocabulary, and raw-JSON mode behavior. No `@wordpress/*` runtime dependency is added (R-KEEP2; `@wordpress/icons` is already bundled).

## 5. Verification design — making "tests green + actions invisible" impossible (R-REG3)

The real `@wordpress/components` and `@wordpress/block-editor` are externalized to `wp.*` runtime globals and are **not installable here**, so jest must mock them; only `@wordpress/icons` is a real installed dependency. The verification works within those limits as a **two-part in-environment defense** plus a consistency-only e2e update. Each mechanic below was validated by a since-deleted jest experiment on this branch (git tree clean); the design research records the exact commands and outcomes.

### 5.1 Contract guard for the toggle — harden the `DropdownMenu` mock (R-REG3a)

**Replace the current always-render `DropdownMenu` mock body** (`test/mocks/wordpress-components.js:347-364`) with one that mirrors core's guard:

```js
const DropdownMenu = ({ label, children, controls, toggleProps = {}, icon: _icon, ...rest }) => {
  if (!controls?.length && typeof children !== "function") {
    return null; // byte-mirrors core's `if ( ! controls?.length && ! isFunction( children ) ) return null;`
  }
  return createElement(
    "div",
    rest,
    createElement("button", { type: "button", "aria-label": label, ...toggleProps }),
    typeof children === "function"
      ? children({ isOpen: false, onToggle: () => {}, onClose: () => {} })
      : children,
  );
};
```

- The instant the code regresses to plain-element children, the component renders `null` — the toggle vanishes from the DOM and **every** existing menu-item assertion in `StructureTree.test.js` + `Edit.test.js` goes red.
- It is backward-compatible with the existing find-trigger-then-query-items pattern (`StructureTree.test.js`'s `buttonByLabel(...).closest("div")` → `selectButtonByText(menuDiv, "Remove")`): the **fixed** code passes a function child, so the mock invokes it and the items render into the same wrapping `<div>` as the toggle, so `closest("div")` still resolves.
- The arg object mirrors core's `{ isOpen, onToggle, onClose }`; **`onClose` MUST be a real no-op function** because the production handler `() => { handler(); onClose(); }` calls it (verified it does not throw). No existing test reads `isOpen`/`onToggle`, so `false` / no-op are safe. A `controls`-only caller renders its `children` directly (today's tests don't use `controls`).
- **Safe to harden:** grep confirms `StructureTree.js` is the **only** `DropdownMenu`/`MenuGroup`/`MenuItem` consumer in `src`, so hardening cannot break any other component's suite; the only suites touching the menu drive items through the fixed (function-child) tree.

**Plus one toggle-presence assertion** (low-cost, belt-and-suspenders) in `StructureTree.test.js`: assert each representative row renders its action-menu **toggle** button (by its `"Actions for …"` `aria-label`) — which, under the hardened mock, is **absent** if children regress to plain elements. This names the exact regression ("the three-dots toggle is in the DOM") rather than only catching it transitively through the item assertions. **No** `children`-typeof / props-introspection contract assertion — it would re-test what the hardened mock already enforces, with worse readability (brittle, coupled to React internals).

### 5.2 Real-icon guard for the glyph (R-REG3b)

**Add a dedicated test file `src/editor/__tests__/StructureTree.realIcons.test.js`** with its own `jest.mock` overrides:

1. **Un-map `@wordpress/icons` to the REAL package** for this file (`jest.unmock` / a local `jest.mock` returning `jest.requireActual`), so the icon exports are real SVG elements, not string sentinels.
2. **Swap in an element-rendering `Icon` mock** — `({ icon }) => isValidElement(icon) ? cloneElement(icon) : null` — mirroring the real `Icon`'s `cloneElement(icon)`. This renders a real inline `<svg>` for an element and **nothing** for a string (`isValidElement("plus")` is false).
3. Keep the rest of the components mock.
4. Render the tree and assert the chevron / hand-row Add-note / row-action toggle areas contain real inline `<svg>` — not string sentinels or Dashicon classes. This **passes** for the fixed `icon={plus}` / element chevrons / `icon={moreVertical}` and **fails** for an `icon="plus"` string regression.

Confine the un-mock + custom `Icon` to **this one file's** `jest.mock` calls, so the main suite's string-sentinel `@wordpress/icons` mock and inert `Icon` mock are untouched (no risk to the 600+ existing tests).

**HARD PREREQUISITE — the React-dedup `moduleNameMapper` in `jest.config.js`.** Without it, `isValidElement(realPlus)` is **false** under top-level React 19, because the icons package ships its **own** nested React 18.3.1 and tags its elements `Symbol.for('react.transitional.element')`-vs-`Symbol.for('react.element')` differently — a `$$typeof` **Symbol-identity** mismatch (not a version-number problem), which is exactly the "Objects are not valid as a React child" throw. So **every** render/`isValidElement` assertion on a real icon would be a false-negative or a throw without the dedup. The mapper resolves all six React entrypoints to the single top-level copy. The exact, complete set (proven end-to-end on-branch):

```
^react$, ^react/jsx-runtime$, ^react/jsx-dev-runtime$, ^react-dom$, ^react-dom/client$, ^scheduler$  → the top-level copy
```

Load-bearing details:
- **The split is a multi-package nested tree, not just `react`.** `@wordpress/icons@10.32.0` nests its own `react`/`react-dom` **18.3.1**, `scheduler`, `@wordpress/element`, and `@wordpress/primitives`; top-level `react`/`react-dom` are **19.2.7**. The icon SVGs are pre-built with `import { jsx as _jsx } from "react/jsx-runtime"`, and `Icon` does `cloneElement` from `@wordpress/element` → nested 18.
- **`react/jsx-runtime` is non-optional.** `@wordpress/babel-preset-default` uses `runtime: 'automatic'`, so the test files **and** `StructureTree.js` compile to `react/jsx-runtime` `_jsx(...)` calls. The host tree and the icon child must share **one** `react/jsx-runtime`. Mapping only `^react$`/`^react-dom$` is **insufficient**.
- **A PARTIAL mapping is actively dangerous** — mapping only `react` → 19 while `react-dom` stays nested-18 throws `Cannot read properties of undefined (reading 'ReactCurrentDispatcher')`. Map the **whole** React surface consistently, or none of it.
- **The base jest layers do NOT dedup React** — `@wordpress/scripts/config/jest-unit.config.js` → `@wordpress/jest-preset-default` maps only `*.scss/css` and `@eslint/eslintrc`. The project's own `jest.config.js` is the only place to add this. It is a test-only `moduleNameMapper` addition — **no runtime dependency** (R-KEEP2).

**THE SPECIFIC CANARY is the hand-row Add-note `plus`.** `moreVertical` (the toggle) and the chevrons are **already** real `@wordpress/icons` elements on this branch — they would render a real `<svg>` even on the broken branch, so asserting them alone would NOT have caught review 6. The shipped regression is the hand-row `icon="plus"` **string**. So the test MUST assert the **Add-note button surfaces a real inline `<svg>`** (this is the assertion that goes red for the string and green for `icon={plus}`); assert the toggle/chevron SVGs too for completeness, but the Add-note SVG is THE root-cause-#2 guard.

**Primary guard: the element-rendering `Icon` mock** (assert `<svg>` in the DOM) — it tests the **observable** outcome (a real glyph renders) end-to-end, which is exactly what the editor needs and what review 6's inert mock hid. A prop-level `isValidElement(icon)` spy is a fine **additional** assertion but is more indirect (it tests the prop, not the rendered glyph); the real-`Icon` path is infeasible (not installable).

### 5.3 e2e — consistency-only (R-REG3c)

The Playwright specs **cannot run here** (wp-env port conflict) and **never ran** (which is how the regression escaped) — they are NOT this environment's primary guard. Update them for consistency so they stay honest for when the environment can run them:

- **Menu-item names:** change the tree-menu items to "Duplicate" / "Add before" / "Add after" / "Remove" (drop "Add measure" from the tree-menu assertions). Keep `{ exact: true }` (already used by `openRowAction`, `specs/editor.spec.js:360`) so "Add before"/"Add after" never loosely match other "Add" controls (the Note-panel "Add note" exact-match precedent). "Remove" stays a `menuitem` by name (`isDestructive` only adds the red class).
- **Section-grow step:** rewire the current section-menu "Add measure" step (`specs/editor.spec.js:585-602`) to the new **`SectionPanel` "Add measure"** sidebar button (scoped + `exact:true`, mirroring the existing "Add section" step at `:623`) — cleanest, decoupled from row ordinals. (A measure-row "Add after" is the documented alternative if the team keeps a grow-via-tree flavor.)
- **A dedicated positional-insert test** (new, or extending the build/edit test): exercise a measure-row "Add before" and "Add after", asserting (1) the stored song's measure count grew, (2) the new measure landed at the right index (before → at `i`; after → at `i+1`), and (3) the new node is auto-selected (its panel open / its row `aria-current`). Assert structure via the ordinal-independent stored-JSON polls (the `storedSongObject` pattern).
- **The ORDINAL-SHIFT gotcha (flag prominently — not a find-replace):** "Add before" at index `i` shifts every later sibling's ordinal +1; "Add after" inserts at `i+1` shifting everything after. The existing test navigates by **ordinal** labels ("Measure 3 of section 1", "Actions for Section 3"); after a positional insert, a row that was "Measure 2" may become "Measure 3", so any name-based row lookup AFTER an insert must be **re-derived**. The count-via-stored-JSON polls are ordinal-independent and stay robust. Auto-select also moves the open panel / `aria-current` to the inserted node.
- **The `openRowAction` / `rowChevron` / `expandRow` / portal-`getByRole("menu")` plumbing all STAYS** — it already reads the portalled popover (`:360`); the render-function fix is what makes that popover actually render (this whole e2e was asserting against a menu that returned null). The only non-mechanical change is the ordinal re-mapping.

### 5.4 Mock-surface summary

- **CHANGED:** the `DropdownMenu` mock (now guards like core); `jest.config.js` gains the six-module React-dedup `moduleNameMapper`.
- **NEW:** the real-icon guard test file (real `@wordpress/icons` + element-rendering `Icon`, local overrides); one toggle-presence assertion in `StructureTree.test.js`.
- **STAYS MOCKED (unchanged):** the rest of `@wordpress/components` and all of `@wordpress/block-editor` (not installable — externalized to `wp.*`); the main suite's string-sentinel `@wordpress/icons` mock + inert `Icon` mock (the real-icon test overrides these **locally**, not globally); the `TreeGrid`/`TreeGridCell`/`TreeGridRow` DOM-honest stand-ins (the roving-tabindex/keyboard model stays an e2e concern, per review 6's standing decision). The real-render scope is deliberately the **minimum** that catches the two root causes — only the icons are rendered real, because only `@wordpress/icons` is a real installed dependency.

**Why this closes review 6's gap:** review 6 had green tests + invisible buttons because (1) the `DropdownMenu` mock rendered plain-element children unconditionally, and (2) the icons were string sentinels. The hardened mock kills (1): plain-element children now render null → red tests. The real-icon test kills (2): a string icon now renders no `<svg>` → red test. Both are in-environment, add no runtime dependency, and run on every `jest` invocation.

## 6. Preserved wins & invariants (R-KEEP)

- **R-KEEP1 — byte-identical publish.** Editor-side only: no schema / `render.php` / front-end-SVG / `data-*` / font change. All edits are in `StructureTree.js` / `edit.js` / `SectionPanel.js` / `style.scss` + the test harness.
- **R-KEEP2 — only WordPress-provided runtime packages.** Only `@wordpress/*` at runtime; `@wordpress/icons` is already bundled, so its real icon elements are in-bounds. The React-dedup `moduleNameMapper` and any base-styles `@use` are test/build-config only — no runtime dep.
- **R-KEEP3 — review-6 wins preserved.** Select-only label `Button`s; a single `expanded` Set with one toggle (no ancestor/veto Sets); coordinate-derived keys (no index-path strings); `[aria-level]`-driven indentation (now carried by the first gridcell — same data source, same `1.5em` unit); the recolor-only `.is-selected` highlight with no scale-coupled magic number; public `__experimentalTreeGrid` only (no private / `lock()`-gated APIs).
- **R-KEEP4 — keyboard & a11y parity.** The render-function change affects only `renderContent`; the toggle is built by `renderToggle`, which spreads `mergedToggleProps` onto `<Toggle {...} icon={icon}>`, so `toggleProps={{ ref, tabIndex, onFocus }}` still merges onto the toggle `Button` exactly as today — roving-tabindex fully preserved. The action menu opens, traps focus while open (core's `Popover`), and returns focus to its trigger on close (the `onClose` → `Popover` focus-return mechanism). Every interactive row element (label, action-menu trigger, chevron expander) stays wrapped in `TreeGridCell` and in TreeGrid's roving tabindex; Up/Down/Left/Right/Home/End and Enter/Space behave at least as well as today.
- **R-KEEP5 — raw-JSON unchanged; valid-by-construction.** JSON mode behavior (non-blocking validation) is untouched. Every menu action — including the new positional inserts — routes through `commit` (re-validates), and each `newX()` is schema-conformant, so the resulting song is always conformant.
- **R-KEEP6 — field reachability & per-kind settings preserved.** Selecting a section/measure/event still reaches its own settings; the Song panel is always available; every inspector field reachable today stays reachable and editable. The new `SectionPanel` "Add measure" keeps that capability reachable (no regression vs review 6's section-menu "Add measure").

## 7. Requirements-coverage matrix

| Requirement | Settled in | Decision in one line |
|---|---|---|
| **R-REG1** (per-row menu renders) | §3.1, §2 | Render-function children `({ onClose }) => (<><MenuGroup>{Dup, Add before, Add after}</MenuGroup><MenuGroup><MenuItem isDestructive>Remove</MenuItem></MenuGroup></>)` at all three levels; satisfies core's `return null` guard so the toggle renders; toggle markup byte-unchanged. |
| **R-REG2** (hand "Add note" real glyph) | §3.4 | `icon="plus"` (string) → `icon={plus}` (element from `@wordpress/icons`); inline SVG, no dashicons sheet. |
| **R-REG3a** (toggle contract guard) | §5.1 | Harden the `DropdownMenu` mock to mirror core's `return null` (plain-element children → null → red item assertions); plus one toggle-presence assertion. |
| **R-REG3b** (real-icon guard) | §5.2 | Dedicated test: real `@wordpress/icons` + element-rendering `Icon` mock + the six-module React-dedup `moduleNameMapper`; assert real inline `<svg>`. The Add-note `plus` is THE canary; the dedup mapper is a hard prerequisite. No runtime dep. |
| **R-REG3c** (e2e consistent) | §5.3 | Item names → Dup/Add before/Add after/Remove; section-grow → `SectionPanel` button; ordinals re-mapped after positional inserts. Consistency-only (can't run here). |
| **R-MENU1** (block-menu item set + grouping) | §3.1 | `{Duplicate, Add before, Add after}` primary group + isolated destructive `{Remove}` at section/measure/note; exact core labels; no Move/Copy/styles; old "Add measure" item dropped. |
| **R-MENU2** (positional insert, valid-by-construction) | §3.2 | Six named `onAdd{Section,Measure,Note}{Before,After}` handlers in `edit.js`: `insertAt(list, i\|i+1, newX())` → `commit` → auto-select `target` + reveal ancestors, mirroring the duplicate handlers. |
| **R-MENU3** (hand rows keep direct "Add note") | §3.2, §3.4 | Hand-row "Add note" (element icon) seeds the empty hand; Note-panel "Add note" stays; note before/after only on existing note rows (never an empty hand). |
| **R-POLISH1** (chevron centered on label) | §3.5 | Recipe A: label cell `[role="gridcell"]:first-child` → `display:flex; align-items:center`; new `&-expander` 24px square; per-level indent moved to `padding-inline-start` on the first gridcell (keeps `1.5em`); no `TreeExpander` markup change. |
| **R-POLISH2** (tree/canvas separation) | §3.6 | `border-inline-end: 1px solid #ddd` (commented `$gray-300`) + `padding-inline-end: 1em` on `&__tree`; `&__workspace` gap `1em → 1.5em`; logical props (RTL-safe); CSS-only, editor-side. |
| **R-KEEP1** (byte-identical publish) | §6 | Editor-side only; no schema / `render.php` / front-end-SVG / `data-*` / font change. |
| **R-KEEP2** (only WP-provided runtime deps) | §6 | Only `@wordpress/*` at runtime (`@wordpress/icons` already bundled); React-dedup mapper + optional base-styles `@use` are test/build-config only. |
| **R-KEEP3** (review-6 wins preserved) | §3.5, §6 | Select-only labels, single `expanded` Set, coordinate keys, `[aria-level]` indent (now on the gridcell, same source, `1.5em` kept), recolor-only highlight, public `__experimentalTreeGrid`. |
| **R-KEEP4** (keyboard/a11y parity) | §3.1, §6 | `toggleProps={{ ref, tabIndex, onFocus }}` still merges onto the toggle (independent `renderToggle` path); `onClose` → `Popover` focus-return to trigger; every element stays in `TreeGridCell` / roving tabindex. |
| **R-KEEP5** (raw-JSON unchanged; valid-by-construction) | §3.2, §6 | JSON mode untouched; every menu action (incl. positional inserts) routes through `commit` (re-validates); `newX()` schema-conformant. |
| **R-KEEP6** (field reachability / per-kind settings) | §3.3, §6 | The new `SectionPanel` "Add measure" keeps that capability reachable (no regression vs the section-menu "Add measure"); all inspector panels/fields unchanged. |

## 8. Open consequence flagged to the owner

One design call made **within** the spec (not a spec blocker) that is owner-visible and is surfaced per the design research's instruction:

- **The block-menu reshape (R-MENU1) orphans the section-menu "Add measure", so this design re-homes it to a `SectionPanel` "Add measure" button** (§3.3). This is required by R-KEEP6 (no-regression: "Add measure" is reachable today) and is core's `BlockListAppender` idiom (a container always has an appender; core never blocks the last-child delete). The owner-visible change: the section row menu no longer has "Add measure"; the Section inspector panel gains an "Add measure" button. If the owner prefers strict minimal-diff, the documented fallback is to accept the zero-measure dead-end + note it (defensible because `newSection()` always seeds one measure, so a zero-measure section arises only by an explicit last-measure removal) — but the panel button is the recommendation.

No spec contradiction was found; the spec carries every other decision needed.
