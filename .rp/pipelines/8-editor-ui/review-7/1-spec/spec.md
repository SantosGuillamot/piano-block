# Review 7 Spec — Fix the invisible row actions, adopt the Gutenberg block-menu model, and polish tree alignment/separation

_Spec for review 7 of the Piano block editor-UI feature ([Issue #8](https://github.com/SantosGuillamot/piano-block/issues/8), PR #22). Standalone: a reader with this file and the code on branch `worktree-8-editor-ui` has everything needed. Later phases (design, plan, code, docs) work from this spec._

## Overview

The Piano block ships a working visual editor for sheet music: inside the block's edit area a **structure tree** (Section → Measure → Right/Left hand → Note) sits beside a read-only **sheet-music canvas**, with per-kind **settings panels** in the inspector and a toolbar toggle to a raw-JSON textarea. Review 6 rebuilt the structure tree (`src/editor/StructureTree.js`) on core's List View row pattern: each section/measure/note row is a `TreeGridRow` with two cells — a select-only label `Button` (preceded for expandable rows by `TreeExpander`, a non-focusable `aria-hidden` span wrapping a stock `<Icon>` chevron from `@wordpress/icons`) and a per-row `DropdownMenu` (`icon={moreVertical}`, `toggleProps` from the cell render-prop) holding the row's actions. Hand rows are organizational: a label plus a direct `Button` with `icon="plus"` for "Add note". `edit.js` owns one `expanded` Set and all the song mutators; `src/style.scss` is layout-glue.

The owner's verdict: _"The UI starts to feel better."_ Review 6's direction — native TreeGrid rows, a per-row ellipsis menu, stock chevrons, layout-glue CSS, keep using Gutenberg components — is right and **stays**. But the shipped result has **one functional regression** and **several polish gaps**, both observed in the real editor.

**The regression: the per-row actions are invisible.** In the real editor, section, measure, and note rows show **no three-dots toggle at all** — there is nothing to click for Add / Remove / Duplicate — and the hand rows show an **empty bordered square** where the "Add note" button should be. Both have confirmed root causes, established against the real WordPress source:

- **Root cause #1 (primary) — the `DropdownMenu` renders nothing.** Core's `UnconnectedDropdownMenu` has a top-of-body guard `if ( ! controls?.length && ! isFunction( children ) ) return null;` that returns from the whole component, so no toggle is even placed in the DOM. The shipped tree passes **plain-element** children (`<MenuGroup><MenuItem/></MenuGroup>`) and no `controls` array, so every per-row menu renders nothing. The fix is to satisfy the contract: pass **children as a render function** (`({ onClose }) => <MenuGroup>…</MenuGroup>`) or a non-empty `controls` array. This guard is byte-identical in behavior across `@wordpress/components` 29.5.2 (WP 6.8), 30.6.x (WP 6.9), and trunk.
- **Root cause #2 (secondary) — the hand-row icon is a string Dashicon slug.** The hand-row `Button` uses `icon="plus"` — a **string**, which `Icon` renders as `<Dashicon icon="plus">` (class `dashicons-plus`), needing the dashicons font stylesheet that is not reliably present in the editor canvas iframe (the block has no `editorStyle`; apiVersion 3 mounts the edit UI in the canvas iframe). A real `@wordpress/icons` `plus` is a pre-rendered SVG **element** that inlines without any stylesheet. The fix is `icon={plus}` (element).

**Why the regression escaped, and why this review's verification must close that gap.** Review 6's 669 unit tests stayed green while the UI was broken because the jest harness **stubs the very components involved** — `DropdownMenu`/`MenuGroup`/`MenuItem`/`Icon` in `test/mocks/wordpress-components.js` (the mock renders element children unconditionally, so it can never reproduce core's `return null`), with `@wordpress/icons` mapped to string sentinels in `test/mocks/wordpress-icons.js` — and the Playwright e2e specs, though migrated by construction, **cannot run in this environment** (wp-env port conflict). The real `@wordpress/components` and `@wordpress/block-editor` are **externalized to `wp.*` runtime globals and are not installable here**, so jest must mock them; only `@wordpress/icons` is a real installed dependency (with a React-singleton wrinkle: top-level `react`/`react-dom` are 19.2.7 while the icons package nests its own 18.3.1). Review 7's verification strategy must work within those limits so that "tests green + actions invisible" can no longer both be true.

**The polish gaps:**

- **Adopt the Gutenberg block-menu model.** Each row's ellipsis menu should mirror a block's settings menu: **Duplicate, Add before, Add after** in a primary group and **Remove** isolated in a separate destructive group — at section, measure, AND note level. This reshapes the current per-kind item sets ("Add measure" inside the section menu, etc.) and introduces **positional insertion** relative to a node. `edit.js` has no positional-insert mutators today (only append-style adds and `onDuplicate*`), so new insert-at-index handlers are needed, built on `songModel.js`'s existing `insertAt`/`newX()`. Hand rows are not block-menu rows — they keep the single direct "Add note" button as the way to seed the first note of an empty hand.
- **Align the chevrons with the row labels.** The disclosure chevrons sit off the label baseline; core's List View centers its expander against the label via flex layout and a fixed square box. This is a CSS-only fix in `style.scss` — no markup change to `TreeExpander`.
- **Separate the tree from the canvas.** The tree sits close to the sheet music with no boundary. Core separates the List-View rail from the canvas with a hairline rule and breathing room; the editor-native recipe here is a `border-inline-end` vertical rule in core's standard border gray plus more gap — layout-glue, not a design language.

The change is strictly editor-side: the song format/schema, `render.php`, and the front-end SVG rendering are unchanged, so a published song renders byte-identically before and after this review.

## Requirements

Requirements use RFC-2119 keywords: **MUST** = hard requirement; **SHOULD** = strong default a design may deviate from only with justification; **MAY** = explicitly allowed latitude. Requirements are grouped; identifiers (R-REG1 … R-KEEP6) are stable references for later phases.

### Group REG — Fix the functional regression (the invisible row actions)

- **R-REG1 (MUST).** The per-row actions menu MUST actually render — a visible, usable three-dots (ellipsis) toggle — at section, measure, AND note level. The `DropdownMenu` MUST be invoked so core's `UnconnectedDropdownMenu` guard (`if ( ! controls?.length && ! isFunction( children ) ) return null;`) does NOT fire: it MUST pass either **children as a render function** (`({ onClose }) => …`) or a non-empty **`controls` array**. The shipped plain-element children (`<MenuGroup><MenuItem/></MenuGroup>`) are the regression and MUST be replaced. **Strong default:** render-function children — minimal diff, preserves the existing `MenuGroup`/`MenuItem`/`isDestructive` grouping, and yields `onClose` so each action can dismiss the menu after acting. The `controls={DropdownOption[][]}` form is an allowed alternative but rewrites the markup and cannot mark items destructive (see R-MENU1), so it is not preferred for this menu. Each action handler SHOULD call `onClose()` after acting.

- **R-REG2 (MUST).** The hand-row "Add note" button MUST show a real glyph. It MUST pass a `@wordpress/icons` **element** (e.g. `plus` imported from `@wordpress/icons`), NOT the string slug `icon="plus"`, so it renders inline SVG without depending on the dashicons stylesheet (which is not reliably present in the editor canvas iframe). The empty bordered square is the regression and MUST be gone.

- **R-REG3 (MUST).** The unit suite MUST gain a guard that makes "tests green + row actions invisible" impossible. Because the real `@wordpress/components` is not installable here (externalized to `wp.*` globals; only the jest mock exists), this is a TWO-PART defense:
  - **(R-REG3a) Contract guard for the toggle (root cause #1).** The harness MUST be changed so that passing plain-element (non-render-function, no-`controls`) children to the row-action `DropdownMenu` can no longer pass the suite. The strong default is to **harden the jest `DropdownMenu` mock to mirror core's guard** — render `null` (no toggle, no menu items) when `typeof children !== "function" && !controls?.length` — so the existing menu-item assertions go red the instant the regression returns. An explicit contract assertion (the tree's `DropdownMenu` is invoked with render-function children, or with `controls`) MAY be used additionally or instead. The hardened-mock path is the highest-leverage, zero-runtime-dependency option and directly closes the gap that blinded review 6.
  - **(R-REG3b) Real-icon guard for the glyph (root cause #2).** A unit test MUST render the tree with the REAL `@wordpress/icons` (un-mapped from the string-sentinel mock) and assert the row-action / chevron / Add-note icons are actual inline `<svg>`, not strings or Dashicon classes. This requires deduping React in jest to a single copy (top-level `react`/`react-dom` 19.2.7 vs the icons package's nested 18.3.1; the icons' `@types/react` is 18.3.31) via a `moduleNameMapper`/resolver entry in `jest.config.js` — a test-only harness change that adds NO runtime dependency.
  - **(R-REG3c) e2e consistent-by-construction.** The Playwright specs (which cannot run here) MUST be updated to match the new menu (item names, render-function path) so they stay honest for when the environment can run them. They are NOT the primary guard for this environment — they never executed, which is how the regression escaped.

### Group MENU — Adopt the Gutenberg block-menu model

- **R-MENU1 (MUST).** Each section, measure, and note row's actions menu MUST offer **Duplicate, Add before, Add after** in a primary group and **Remove** isolated in a separate destructive group below it, with Remove marked `isDestructive` — mirroring core's block-settings menu (core's labels are exactly **"Add before"** / **"Add after"**, and the destructive item sits in its own final group). This REPLACES the current per-kind item sets (the section menu's "Add measure", the hand-context "Add note" entries, etc. as menu items). Out-of-scope core items (Move up/down, Copy/Cut, styles) are NOT included — there is no clipboard or style model for song nodes. The item set is identical in shape at all three levels; only the underlying coordinates differ.

- **R-MENU2 (MUST).** "Add before" / "Add after" MUST insert a fresh schema-conformant node — `newSection()` / `newMeasure()` / `newNote()` from `songModel.js` — at `index` ("before") or `index + 1` ("after") via `insertAt`, at section, measure, AND note level. `edit.js` has NO positional-insert handlers today (only append-style `onAddSection`/`onAddMeasure`/`onAddNote` and `onDuplicate*`); new insert-at-index handlers MUST be added, each routing through `commit` (which re-validates). Each inserted node MUST be valid-by-construction (a `newX()` is schema-conformant). Newly inserted nodes SHOULD be auto-selected and their ancestors revealed, mirroring the existing duplicate handlers, so the new node is visible and selected.

- **R-MENU3 (MUST).** Hand-group rows are NOT block-menu rows. They MUST retain the single direct "Add note" `Button` (now with an element icon per R-REG2) as the way to seed the FIRST note of an empty hand, where "before"/"after" has no anchor. The Note-panel's contextual "Add note" also stays. These adds keep their existing append/insert-after-selection behavior; only the per-row block menus change to positional insertion.

### Group POLISH — Alignment & separation

- **R-POLISH1 (MUST).** The disclosure chevron MUST sit vertically centered against the row label text, matching core's List View. This is a CSS-only fix in `style.scss`: the row's label cell laid out as a flex line with `align-items: center`, and the expander a fixed square box sized to the icon (core uses a `$icon-size` 24px box). There MUST be NO markup change to `TreeExpander` (it already mirrors core's `ListViewExpander` structure). The icon-swap-vs-CSS-rotate difference from core is cosmetic and out of scope (review 6 deliberately swaps `chevronRightSmall`/`chevronDownSmall`).

- **R-POLISH2 (MUST).** The structure tree and the canvas MUST read as clearly separated, with more space and a clear visual boundary, using editor-native styling (no bespoke design language). Concretely: a **`border-inline-end: 1px solid` vertical rule on the tree column in core's standard border gray `$gray-300` (`#ddd`)**, plus **increased gap and/or `padding-inline-end`** so the rule is not crammed against the labels. The separation MUST use **logical properties** (`border-inline-end`, not `border-right`) so it respects the existing `isRTL()` direction handling. The color MUST be core's `$gray-300`/`#ddd`; the design/code phase MAY express it either as `@use "@wordpress/base-styles/colors"` → `colors.$gray-300` (feasible: base-styles is installed and `@wordpress/scripts`' sass-loader resolves bare `@wordpress/*` specifiers — proven by the existing `url("./notation/pb-music.woff2")` in this stylesheet) OR as a commented `#ddd` literal. A runtime `var(--wp-…)` is NOT available for a neutral border gray (core exposes runtime vars only for the accent/focus color), so the requirement does not depend on one. An optional faint `$gray-100` (`#f0f0f0`) panel-shade on the tree column is allowed but not required; the hairline rule plus more gap is the minimal, most List-View-like answer.

### Group KEEP — Preserved wins & invariants (MUST, non-negotiable)

- **R-KEEP1 (MUST).** The change is editor-side only: the song schema, `render.php`, and the front-end SVG — including the `data-measure` / `data-hand` / `data-event-index` selection hooks and the `@font-face` "PB Music" notation font — are UNCHANGED, so a published song renders **byte-identically** before and after.

- **R-KEEP2 (MUST).** Only `@wordpress/*` packages WordPress already provides are used; NO outside RUNTIME dependency is added. (`@wordpress/icons` is already a bundled dependency on this branch, so using its real icon elements is in-bounds.) Test-only harness changes for the verification strategy — promoting `@wordpress/base-styles` to a direct devDependency, or a React-dedup `moduleNameMapper` in `jest.config.js` — are NOT runtime deps and are in-bounds.

- **R-KEEP3 (MUST).** Review-6 wins are preserved: select-only label `Button`s; a single `expanded` Set with one toggle (no ancestor/veto Sets); coordinate-derived keys (no index-path strings); `[aria-level]`-driven indentation; the recolor-only `.is-selected` highlight with no scale-coupled magic number; TreeGrid as the foundation (no private / `lock()`-gated / `__dangerousOptInToUnstableAPIsOnlyForCoreModules` APIs).

- **R-KEEP4 (MUST).** TreeGrid keyboard model and accessibility parity hold: every interactive row element — the label, the now-rendering action-menu trigger, and the chevron expander — stays wrapped in `TreeGridCell` / `TreeGridItem` so it remains in TreeGrid's roving tabindex. Up/Down/Left/Right/Home/End and Enter/Space behave at least as well as today. The action menu opens, traps focus while open, and returns focus to its trigger on close.

- **R-KEEP5 (MUST).** Raw-JSON mode behind the toolbar toggle, with its non-blocking validation, is unchanged in behavior. Valid-by-construction holds: every menu action — including the new positional inserts (R-MENU2) — yields a schema-conformant song.

- **R-KEEP6 (MUST).** No field-reachability or per-kind-settings regression: selecting a section/measure/event still reaches its own settings, the Song panel is always available (independent of any event selection), and every inspector field reachable today stays reachable and editable.

## Out of Scope

- **Adding authoring capability beyond positional "Add before/after."** The positional insert is a reshape of the existing add, not a new feature class; no other new song-editing features are added.
- **Any change to the published output.** The song schema, `render.php`, and the front-end SVG (including its `data-*` hooks and the `@font-face` notation font) are not touched.
- **Importing or unlocking core's List View.** `PrivateListView`, the `block-editor` `privateApis` bundle, and registering song nodes as inner blocks are forbidden — the tree stays on public `__experimentalTreeGrid`.
- **The chevron swap-vs-rotate cosmetic difference.** Review 6's icon-swap is preserved; matching core's CSS-rotate is not required.
- **Raw-JSON behavior and the inspector control vocabulary.** Unchanged; the inspector's stock `PanelBody` / `ToolsPanel` / `SelectControl` / `TextControl` / `NumberControl` controls are not rewritten.
- **Relying on the Playwright e2e suite as this environment's primary regression guard.** It cannot run here; it is updated for consistency only (R-REG3c), and the in-environment guards (R-REG3a, R-REG3b) carry the verification.

## Acceptance Criteria

Written as Given/When/Then scenarios over the delivered branch. AC identifiers map to the requirement they verify.

**AC-REG1 — Per-row action menus render and work at every level.**
- Given a section, measure, or note row in the structure tree, When the author looks at it in the real editor, Then a visible three-dots (ellipsis) toggle is present; And When the toggle is activated, Then a menu opens with the row's actions. (R-REG1)
- Given the delivered `StructureTree.js`, When the per-row `DropdownMenu` invocation is inspected, Then it passes children as a render function (`({ onClose }) => …`) or a non-empty `controls` array — never plain-element children — so core's `return null` guard cannot fire. (R-REG1)

**AC-REG2 — Hand-row "Add note" shows a real glyph.**
- Given a hand row ("Right hand" / "Left hand"), When it renders in the real editor, Then its "Add note" button shows an inline SVG plus glyph (no empty bordered square); And When the source is inspected, Then the button is passed a `@wordpress/icons` element (e.g. `plus`), not the string `icon="plus"`. (R-REG2)

**AC-REG3 — Verification makes "tests green + actions invisible" impossible.**
- Given the hardened test harness, When the row-action `DropdownMenu` is given plain-element (non-render-function, no-`controls`) children, Then the unit suite FAILS — either because the hardened `DropdownMenu` mock renders `null` so the menu-item assertions go red, or because an explicit contract assertion fails. (R-REG3a)
- Given a unit test that renders the tree with the REAL `@wordpress/icons` (React deduped to a single copy in `jest.config.js`), When the row-action / chevron / Add-note icons are inspected, Then they are actual inline `<svg>` elements, not string sentinels or Dashicon classes; And no runtime dependency was added to make this pass. (R-REG3b)
- Given the Playwright e2e specs, When they are inspected, Then their menu-item names and trigger plumbing match the delivered render-function menu, so they remain consistent-by-construction. (R-REG3c)

**AC-MENU1 — Block-menu item set and grouping at every level.**
- Given a section, measure, or note row's open actions menu, When its items are read, Then they are **Duplicate, Add before, Add after** in a primary group and **Remove** in a separate group below, with Remove marked destructive; And no Move up/down, Copy/Cut, or styles items appear; And the labels are exactly "Add before" / "Add after". (R-MENU1)

**AC-MENU2 — Positional insertion, valid-by-construction.**
- Given a section/measure/note at index `i`, When the author chooses "Add before", Then a fresh schema-conformant node is inserted at `i`; And When "Add after", Then at `i + 1`; And the resulting song validates; And the newly inserted node is selected with its ancestors revealed. (R-MENU2, R-KEEP5)
- Given the delivered `edit.js`, When its mutators are inspected, Then new insert-at-index handlers exist (built on `songModel.js`'s `insertAt`/`newX()`) and route through `commit`. (R-MENU2)

**AC-MENU3 — Hand rows keep the direct "Add note" entry.**
- Given an empty hand row, When the author wants to seed its first note, Then the direct "Add note" button (with an element icon) is present and works; And the hand row exposes no block-style ellipsis menu; And the Note-panel "Add note" still works. (R-MENU3)

**AC-POLISH1 — Chevron vertically centered on the row label.**
- Given an expandable row in the rendered tree, When a sighted author looks at its chevron, Then the chevron sits vertically centered against the label text; And When `StructureTree.js` is inspected, Then `TreeExpander`'s markup is unchanged and the alignment fix lives entirely in `style.scss` (label cell flex line with `align-items: center`, expander a fixed icon-sized square box). (R-POLISH1)

**AC-POLISH2 — Editor-native separation between tree and canvas.**
- Given the rendered editor, When the boundary between the tree and the canvas is viewed, Then the two read as clearly separated with more space and a visible vertical rule; And When `style.scss` is inspected, Then the tree column has a `border-inline-end: 1px solid` rule in core's `$gray-300`/`#ddd` (via `@use "@wordpress/base-styles/colors"` or a commented `#ddd` literal), increased gap and/or `padding-inline-end`, uses logical properties (no `border-right`), and adds no bespoke design-language styling. (R-POLISH2)

**AC-KEEP1 — Byte-identical publish.**
- Given any song, When it is published before and after this review, Then `render.php`'s output and the front-end SVG (including `data-measure` / `data-hand` / `data-event-index` and the `@font-face` notation font) are byte-identical and the song schema is unchanged. (R-KEEP1)

**AC-KEEP2 — Only WordPress-provided runtime packages.**
- Given the delivered runtime imports and `package.json`, When dependencies are inspected, Then only `@wordpress/*` packages are used at runtime and no outside runtime dependency was added; And any test-only harness additions (base-styles devDependency, React-dedup mapper) are confined to dev/test config. (R-KEEP2)

**AC-KEEP3 — Review-6 wins preserved.**
- Given the delivered source, When it is reviewed, Then labels are select-only, expansion is a single Set with one toggle, keys are coordinate-derived (no index-path strings), indentation derives from `[aria-level]`, the `.is-selected` highlight is recolor-only with no scale-coupled magic number, and the tree uses only public `__experimentalTreeGrid` (no private/`lock()`-gated APIs). (R-KEEP3)

**AC-KEEP4 — Keyboard and accessibility parity.**
- Given keyboard-only operation, When the author uses Up/Down, Left/Right, Home/End and Enter/Space and tabs across a row, Then navigation and activation are at least as capable as the current tree and the label, action-menu trigger, and chevron are each reachable via the roving tabindex; And When the action menu opens, Then focus is trapped while open and returns to the trigger on close. (R-KEEP4)

**AC-KEEP5 — Raw-JSON unchanged; valid by construction.**
- Given the toolbar "Edit as JSON" toggle, When the author switches to JSON mode and edits, Then behavior including non-blocking validation is unchanged; And When any sequence of visual edits (including the new positional inserts) is performed, Then the resulting song is always schema-conformant. (R-KEEP5)

**AC-KEEP6 — Per-kind settings and field reachability preserved.**
- Given a section/measure/event is selected, Then its own settings are reachable; And the Song panel is available independent of any event selection; And every inspector field reachable on the current branch remains reachable and editable. (R-KEEP6)
