# Review 7 Spec Review — APPROVED

_Adversarial review by **spec-reviewer-r7** of `.rp/pipelines/8-editor-ui/review-7/1-spec/spec.md` (review 7 of the Piano block editor-UI feature, issue #8, PR #22). Inputs reviewed: the intent prompt, the spec-research record, the spec, and the baseline code/packages on branch `worktree-8-editor-ui`._

## Verdict

**APPROVED.** The spec fixes the real regression at its root (not the symptom), carries a feasible and falsifiable "tests-green-implies-buttons-visible" verification requirement, covers every owner-feedback item, preserves all review-6 wins and standing invariants, and writes a testable AC for each requirement. Every load-bearing claim was verified against a primary source before approval.

## What I verified (and how)

### Root-cause fidelity — both causes confirmed at primary source, both fixed by requirements

- **Root cause #1 (the primary regression).** I fetched the current Gutenberg `packages/components/src/dropdown-menu/index.tsx` and confirmed the guard byte-for-byte: `if ( ! controls?.length && ! isFunction( children ) ) { return null; }` at the top of the component body; the toggle is a `<Toggle … icon={icon}>` (so it would render fine if reached); and `renderContent` does `isFunction( children ) ? children( props ) : null`. The shipped tree passes **plain-element** children to every per-row `DropdownMenu` (`StructureTree.js:201-216`, `286-303`, `433-460`) and **no `controls`** — so the guard fires and nothing is placed in the DOM. R-REG1 requires the contract be satisfied (render-function children or `controls`), which is the actual fix, not a CSS/visibility band-aid. Confirmed.
- **Root cause #2 (the empty hand-row square).** I read the installed real `@wordpress/icons` `Icon` (`build-module/icon/index.js`): it does `cloneElement(icon, …)`, so it needs a React **element**; the real `plus` (`build-module/library/plus.js`) is a pre-rendered `_jsx(SVG, …)` element. The shipped hand-row button passes the **string** `icon="plus"` (`StructureTree.js:365`), which routes to the Dashicon path. R-REG2 requires passing the `plus` element. Confirmed.
- **Why the mock hid #1.** `test/mocks/wordpress-components.js:347-364` renders `children` unconditionally, so it is structurally incapable of reproducing core's `return null`. This is exactly the gap R-REG3a targets (harden the mock to mirror the guard). Confirmed the diagnosis and the fix are coherent.

### "Tests green ⇒ buttons visible" harness requirement — present, testable, feasible

- R-REG3 is a correctly-scoped TWO-PART defense matching the verified environment limits: `@wordpress/components` is **not installed** (confirmed: the directory does not exist; build externalizes to `wp.*`), so the only feasible in-environment guards are (3a) a hardened `DropdownMenu` mock / contract assertion and (3b) a real-`@wordpress/icons` SVG assertion. The React-singleton wrinkle is real and load-bearing: top-level `react` is **19.2.7**, the icons package nests **18.3.1** (both confirmed from the respective `package.json`s), so the `jest.config.js` React-dedup mapper R-REG3b calls for is genuinely required and is a test-only change (no runtime dep). The e2e is correctly demoted to consistent-by-construction (R-REG3c) because it never executed — which is precisely how the regression escaped. AC-REG3 makes each part falsifiable.

### Owner-feedback coverage — complete, nothing dropped or invented

- Block-menu model {Duplicate, Add before, Add after | Remove(destructive)} at **section, measure, AND note** level (R-MENU1), with exact core labels "Add before"/"Add after"; the `DropdownOption` type genuinely lacks `isDestructive` (confirmed at `types.ts`), so the spec's preference for render-function children to keep a destructive Remove is correctly justified, and `controls` is correctly allowed-but-not-preferred.
- Positional insertion is a real behavior change with a real gap behind it: `edit.js` has only append-style `onAddSection`/`onAddMeasure`/`onAddNote` plus `onDuplicate*`/`onRemove*` (confirmed), and `songModel.js` exports `insertAt`/`duplicateAt`/`removeAt`/`newSection`/`newMeasure`/`newNote` to build the new handlers on (confirmed). R-MENU2 routes them through `commit` (valid-by-construction) and mirrors the existing duplicate handlers' auto-select/reveal.
- Empty-hand Add note kept as a direct button (R-MENU3); chevron alignment as a CSS-only fix with no `TreeExpander` markup change (R-POLISH1); tree/canvas separation via `border-inline-end` `$gray-300`/#ddd + more gap (R-POLISH2). I confirmed base-styles is installed with `$gray-300: #ddd  // Used for most borders.`, that `style.scss` currently uses literal hexes (`#767676`, `#007cba`) so the "commented #ddd literal" default is consistent with the file, and that `block.json` is apiVersion 3 with `editorScript` + shared `style` but **no `editorStyle`** (consistent with the canvas-iframe / dashicons-absent reasoning).
- "Keep using Gutenberg components" is explicit (R-KEEP2, R-REG1 preserving `MenuGroup`/`MenuItem`).

### Preservation — review-6 wins and invariants all present as MUST

- Byte-identical publish / `render.php` / front-end SVG untouched (R-KEEP1; `render.php` confirmed present), `@wordpress/*`-only runtime (R-KEEP2), select-only labels + single expansion Set + coordinate keys + `[aria-level]` indent + recolor-only highlight + public `__experimentalTreeGrid` (R-KEEP3), TreeGrid keyboard/a11y parity incl. the now-rendering trigger (R-KEEP4), raw-JSON unchanged + valid-by-construction (R-KEEP5), field-reachability (R-KEEP6). Each has a matching testable AC.

### Testability / altitude

- Every AC is a concrete Given/When/Then that maps to its requirement; nothing design-level is pre-decided (render-function-vs-`controls` and literal-`#ddd`-vs-`@use` are both left as allowed latitude with a stated strong default), and nothing research already settled is re-opened.

## Minor observations (non-blocking — do NOT require a respin)

1. **R-POLISH2 phrasing "respects the existing `isRTL()` direction handling."** The only `isRTL()` call in the tree (`StructureTree.js:95`) drives chevron *icon* selection, not CSS, so the border doesn't literally interact with that call. The substantive requirement — use `border-inline-end` (logical, RTL-safe) not `border-right` — is correct and independently sound; the phrasing just slightly overstates the linkage. Cosmetic; no change required.
2. **AC-POLISH2 cites the `url("./notation/pb-music.woff2")` precedent for sass-loader resolving bare specifiers.** That precedent is a relative `url()`, not a bare `@wordpress/*` `@use`; the research's actual proof was the empirical `sass-loader@16 webpackImporter` test, not this `url()`. Since R-POLISH2 already permits the plain `#ddd` literal (the recommended default), the import path is optional latitude and this slightly-imprecise justification is harmless. No change required.

Neither observation affects a requirement's correctness, testability, or the regression fix; both are wording nuances inside otherwise-correct, source-grounded requirements. Logging them for the design/code phases rather than blocking.

## Verdict line

**APPROVED** — root causes confirmed at primary source and fixed by requirement (not symptom-patched), the verification strategy makes "tests green + buttons invisible" impossible within the environment's real limits, owner feedback fully covered, review-6 wins and invariants all preserved as MUST, and every AC is testable. Two cosmetic wording nuances noted for later phases; no respin required.
