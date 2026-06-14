# Review 7: Fix the invisible row actions, adopt the Gutenberg block-menu model, and polish tree alignment/separation

_Review 7 of the Piano block editor-UI feature ([Issue #8](https://github.com/SantosGuillamot/piano-block/issues/8), PR #22). Self-contained: later phases work from this prompt and the current code on the branch — not from the `base/` or `review-1..6/` artifact folders._

## Owner verdict

> The UI starts to feel better.

Review 6's direction (native TreeGrid rows, per-row ellipsis menu, stock chevron, layout-glue CSS) is right and **stays**: the owner wants to **keep using Gutenberg components**. But the shipped result has one functional regression and several polish gaps, observed in the real editor.

## Context: what exists today

Review 6 rebuilt the left structure tree (`src/editor/StructureTree.js`) on core's List View row pattern: each section/measure/note row is a `TreeGridRow` with two cells — a select-only label `Button` (preceded for expandable rows by `TreeExpander`, a non-focusable `aria-hidden` span wrapping a stock `<Icon>` chevron from `@wordpress/icons`) and a `DropdownMenu` (`icon={moreVertical}`, `toggleProps` from the cell render-prop) holding the per-kind actions (Duplicate / Add measure / Add note / Remove). Hand rows are organizational: label + a direct `Button` with `icon="plus"` (a **string**, i.e. a Dashicon slug) and `variant="secondary"` for "Add note". `edit.js` holds one `expanded` Set; `style.scss` is layout-glue (`[aria-level]` indent, recolor-only highlight, flexible rail with `max-width: 24em`). Unit suite: 669 tests green — but note the jest harness **stubs** `DropdownMenu`/`MenuGroup`/`MenuItem`/`Icon` (`test/mocks/wordpress-components.js`) and maps `@wordpress/icons` to string sentinels, so unit tests do not exercise the real components' contracts; the Playwright e2e specs were migrated by construction but **cannot run in this environment** (wp-env port conflict). That combination is exactly how the regression below escaped.

## What the owner sees in the real editor (screenshot evidence, transcribed because later phases cannot see it)

The screenshot shows the editor with a song open ("Section 1", measures 1-11, some expanded to Right hand / Left hand and note rows "re", "la", "la"):

1. **The row action buttons are effectively missing.** Section, measure, and note rows show **no visible three-dots (ellipsis) toggle at all** — there is nothing to click for Add / Remove / Duplicate. Hand rows ("Right hand", "Left hand") show an **empty bordered square** to the right of the label — a button-shaped outline with **no icon inside** (this is the `icon="plus"` `variant="secondary"` Add-note `Button`; a string icon is a Dashicon slug, and no glyph renders — suspect the dashicons stylesheet isn't available where the block's edit UI renders, e.g. the editor canvas iframe). The owner's words: *"The buttons are not showing. Add, remove, duplicate for section, measure and note."*
2. **The chevrons are not vertically aligned with the row labels.** The small disclosure arrows sit visibly off the text baseline/center of "Section 1" / "Measure N" labels.
3. **The tree and the canvas need clearer separation.** The left bar sits close to the sheet music with no visual boundary. The owner wants *"more space between the left bar and the canvas. A clear distinction."*

## The changes the owner wants

1. **Make the per-row actions actually visible and usable in the real editor** — at every level: section, measure, and note. Whatever the root cause (string Dashicon vs `@wordpress/icons` element; how `DropdownMenu` renders its toggle; where the editor mounts the block UI), the fix must be verified against the **real** `@wordpress/components` implementations, not the jest stubs.
2. **Adopt the Gutenberg block-menu model for the three-dots menu.** Like a block's ellipsis menu, each item's menu should offer: **Remove, Duplicate, Add after, Add before** — positional insertion relative to the item, for sections, measures, and notes alike. (This replaces/reshapes the current "Add measure"/"Add note"-inside-the-parent-menu model; the hand row remains the natural home for adding the first note to an empty hand.) Valid-by-construction must hold: every menu action yields a schema-conformant song.
3. **Align the chevrons with the row label text** — match how core's List View sits its expander against the label.
4. **Separate the tree from the canvas** — more space and a clear visual distinction (e.g. the kind of boundary core uses between panels), while staying within editor-native styling (no bespoke design language).
5. **Keep using Gutenberg components throughout** — improve the composition, don't replace it with custom UI.

## Hard lesson to carry into spec/design (the regression's cause, not just its symptom)

Review 6's unit tests were green while the shipped UI was broken, because the components that mattered were mocked and e2e never executed. Review 7's spec/design must include a verification strategy that closes this gap within this environment's limits — e.g. exercising the REAL `@wordpress/components` `DropdownMenu`/`Icon`/`Button` (and real `@wordpress/icons`) in jsdom for the tree's markup-level assertions where feasible, validating component-contract details (such as `DropdownMenu`'s children-as-render-function API and string-vs-element `icon` props) against the installed package source, and keeping the e2e specs consistent-by-construction. The phases decide the exact mechanism; the requirement is that "tests green" must no longer be compatible with "buttons invisible".

## Constraints carried over

- Use only libraries WordPress already provides (the `@wordpress/*` packages available to blocks); no outside dependencies. (`@wordpress/icons` is already a bundled dependency on this branch — using its real icon elements is in-bounds.)
- The change stays editor-side: the **song format/schema, `render.php`, and the front-end SVG rendering are unchanged** — a published song renders byte-identically before and after this review.
- Preserve review 6's wins: select-only labels, single expansion Set, coordinate keys, `[aria-level]` indent, recolor-only highlight, TreeGrid keyboard model and accessibility parity, raw-JSON mode untouched.
