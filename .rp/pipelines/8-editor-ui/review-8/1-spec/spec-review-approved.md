# Spec review — review-8 — APPROVED

Reviewer: `spec-reviewer-r8`. Verdict: **APPROVED** (singleton terminator).

The spec at `.rp/pipelines/8-editor-ui/review-8/1-spec/spec.md` is complete, traceable,
scope-disciplined, and correct on every resolved decision. It satisfies the prompt's
explicit rejection triggers — most importantly the verification meta-rule for items 1, 2,
and 16. Grounding was re-confirmed against the live tree.

## Completeness — every IN item is represented; every OUT item is correctly excluded

- **Must-fix 1–5 → R1–R5; Should-do 6–20 → R6–R20**, mapped 1:1 with no drift in intent.
- **Optional IN (5 items)** → O1 (lighten real-icons, *conditional*), O2 (HANDS), O3
  (sprintf labels), O4 (unused/test-only exports), O5 (spacing). Matches the prompt's IN set.
- **Optional DEFERRED (2 items)** → Out of Scope with rationale: ToolsPanel-nested-in-PanelBody
  (design judgment; risks panel-location/gating) and the dashed-placeholder-border follow-up
  (review-scoped-out; R3 split neither creates nor worsens it).
- **"Explicitly fine as-is" (9 items)** → reproduced verbatim under Out of Scope as
  do-not-change decisions (custom tree CSS, `aria-hidden` chevron, `toggleProps`
  roving-tabindex, three distinct `set*At` faces, ContextEditor draft/projection, no generic
  `EditableList`, notation ink hard-coding / `.is-selected` scope, workspace flex via SCSS,
  component placement).

## Testability / traceability

Every acceptance criterion A1–A20, AO1–AO5, and the Global parity gate traces to a named
requirement, marks **(e2e)** vs **(unit)** where the test home matters, and is concrete
(named props, named files, named pinned assertions — e.g. `Edit.test.js` empty-hand
`undefined` pin, `render.spec.js` `[data-hit]` count-0 guard, byte-identical key strings
`s0`/`s0m1`/`s0m1rightHand`/`s0m1rightHande0`).

## Verification meta-rule (items 1, 2, 16) — "tests green" incompatible with "real broken"

This is the prompt's central rejection trigger; the spec holds on all three:

- **Item 1 (R1/A1).** The always-run unit **pure mapping test** (synthetic `<tr>` carrying the
  `data-*` key → handler routes to `onToggleExpanded(key)`) tests the handler's row→key→toggle
  logic directly and does **not** depend on the mock invoking the callback, so the live mock's
  swallowing of `onExpandRow`/`onCollapseRow` (`wordpress-components.js:449-450`) cannot mask a
  mis-wired handler. The **e2e** drives the real ArrowRight/ArrowLeft path against real WP and
  fails if expansion is broken. A no-op/mis-wired handler cannot keep the suite green. Note:
  the spec does not require de-translating the TreeGrid mock for item 1 (unlike item 2) — this
  is acceptable, not a gap, because the pure mapping test + e2e already close the masking gap
  without it.
- **Item 2 (R2/A2).** Requires `aria-label` (drop dead `label`), the **e2e**
  `getByRole("treegrid", { name: "Song structure" })`, **and** the components mock to stop
  mapping `label`→`aria-label` (live mock does this at `wordpress-components.js:456`), forcing
  any test that relied on the translation to break and be updated to the real prop surface.
- **Item 16 (R16/A16/AO1).** Requires a **project-wide** RED-on-regression string-icon guard
  covering **all** icon-bearing components — correctly stronger than the existing
  StructureTree-only realIcons test, since the four live slug strings (`ListControls.js:26`,
  `PitchList.js:47`, `AnnotationList.js:61`, `HandConfigEditor.js:171`) sit in leaf editors that
  test never mounts. O1's lightening is explicitly **conditional** on preserving that guarantee
  and on the icons-mock change not letting a string-icon regression silently pass.

## Scope discipline & correctness

- **Render byte-identity boundary (items 8 & 9) intact.** R8/A8 and R9/A9 keep
  `render.spec.js` `[data-hit]` count-0 and the front-end accessible-name/structure assertions
  green; R9 requires `src/notation/dom.js` to be **React-free** (no `@wordpress/element`) and
  keeps the per-surface `ResizeObserver` wiring un-unified (consumption + lifecycle genuinely
  differ). `render.php` correctly noted as having no JS/SVG surface.
- **`@wordpress/*`-only deps** preserved (Overview boundary 2; Out of Scope).
- **Prior-review wins preserved** via the Global parity gate's Guardrails A–D (single expansion
  Set + coordinate keys; RowActionsMenu roving-tabindex + select-only + render-fn children;
  recolor-only `.is-selected` survives the CSS move; raw-JSON mode untouched).
- **Resolved decision: DELETE `BPM_MIN_EXCLUSIVE` (not wire it into an inclusive `min`).**
  AO4 states delete-the-constant-and-its-test and explicitly forbids `min={BPM_MIN_EXCLUSIVE}`;
  the control's `min={1}` stays. Confirmed live: `ContextEditor.js:140` hardcodes `min={1}`, and
  `BPM_MIN_EXCLUSIVE`/`newRest` have no production callers.
- **No scope creep / no re-touching "fine as-is."** No requirement contradicts the do-not-change
  list. The CSS split (R3) keeps `@font-face` + wrapper `border/padding/color` in `style.scss`
  (live `style-index.css` value used, matching the build), moves only editor-only rules, and
  preserves the `[aria-level]` indent rule verbatim (R17/Guardrail C).
- **O4 per-symbol rule** captured: "remove the export" means delete the importing test OR keep
  the export — no blanket deletion that reds the suite (drop only the `export` keyword on
  `toNumber`/`serializeSong`/`measureCoords`, keep the functions).

## Grounding (re-confirmed against the live tree)

`StructureTree.js:569` `<TreeGrid label={…}>` (no callbacks, no `aria-label`); HANDS at `:64`;
mock `label`→`aria-label` at `wordpress-components.js:456` and callback-swallow at `:449-450`;
DropdownMenu null-unless-render-fn at `:371-374`; four live slug strings confirmed;
`wordpress-icons.js` exports plain string sentinels; `jest.config.js` two-project + 264-line
realIcons test; `edit.js` does not import `set*At`, has the onAddNote untagged `setSelection`,
the empty-hand-drop rule, the three reveal sites, the second parse, and the
`__nextHasNoMarginBottom`-less TextareaControl; `block.json:17` `"style": "file:./style-index.css"`
with no `editorStyle`; `index.js` imports one `style.scss`; `accessibleNameFor` duplicated and
the `SongPreview` stale docblock; zero `__next40pxDefaultSize` occurrences.

## Verdict

No defects rise to rejection. The spec covers exactly the changes review-8 layers — no more,
no less — and makes a green suite incompatible with the real components being broken for the
three meta-rule items. **Approved.**
