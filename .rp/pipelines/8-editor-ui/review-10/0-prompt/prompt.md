# Review 10: Fix the tree-collapse interaction regression and the inspector list-row styling cluster, plus Gutenberg-component and simplification polish

_Review 10 of the Piano block editor-UI feature ([Issue #8](https://github.com/SantosGuillamot/piano-block/issues/8), PR #22). Self-contained: later phases work from this prompt and the current code on the branch — not from the `base/` or `review-1..9/` artifact folders._

## Owner verdict

> Run another review for the unified review comment on PR #22, and address **everything actionable**.

The owner wants this review run to act on the full set of findings in the unified comment — the three **Top priorities (do before merge)**, every themed finding (P0/P1/P2) the review recommends, and the small opportunistic cleanups — while honoring the review's own **"Considered but not recommended"** list (those are validated decisions — do not undo them) and the **"Explicitly fine as-is"** wins carried from prior reviews. Two nuances:

- The large **`edit.js` 13-mutator descriptor-table refactor** is, in the review's own words, real but **downgraded to a follow-up** (large, touches the mutation core). Keep it a follow-up — do not undertake the big collapse in this run; the spec phase decides whether to open a tracking issue for it rather than implement it now.
- One finding (**"every `NumberControl` omits `__nextHasNoMarginBottom`" → add it**) **directly contradicts a deliberate decision recorded in review 9** ("`__nextHasNoMarginBottom` is NOT wrongly passed to any `NumberControl` — verified all 7", listed as explicitly-fine). This is flagged as an **open question** below; the spec/design research phase must resolve it against the **real `@wordpress/components` `NumberControl` contract**, not adjudicate it from either review's assertion.

## Origin

This review is driven by a unified code-review comment the owner posted on PR #22, synthesized from **four independent review lenses** — Simplification, Gutenberg-component usage, Styles / block-settings UI, and overall behavior & UX — followed by a synthesis pass that independently verified every finding against the source (and the build output where relevant). It is the second unified review on this PR; it was generated against the current branch tip, which already carries review 9's changes — so several of its findings are consequences of, or revisions to, review 9's work (most notably the tree-collapse P0 below, which is the direct consequence of review 9's "select-and-reveal" label fix).

Convenience link: https://github.com/SantosGuillamot/piano-block/pull/22#issuecomment-4698870282

> **Overall assessment (from the review).** A large addition (~10k lines, 52 src files) that holds up well to scrutiny. The Simplification lens confirmed the array/omit helpers are already centralized (`insertAt`/`removeAt`/`replaceAt`/`duplicateAt` in `songModel.js`, `omitEmpty`/`omitFalsy` in `emit.js`); the Gutenberg lens confirmed there is **zero** raw `<select>/<button>/<input>/<table>` anywhere in `src/editor` — every control is a real `@wordpress/component`, and the structure tree is correctly built on the experimental `TreeGrid` primitives List View uses. **The architecture is sound; the high-value findings are interaction- and CSS-level, not structural.** The strongest items are a confirmed interaction bug (expanded tree rows never collapse on label click), a cluster of inspector list-row CSS problems that all trace to one fragile child-selector hack, a missing-prop inconsistency on every `NumberControl`, and inconsistent destructive-delete UX. The large `edit.js` mutator-collapse refactor is downgraded to a follow-up (real but risky/large). A doc/reality mismatch was also caught: the code repeatedly calls the canvas "interactive"/"the surface the author selects notes on," but `SongCanvas` is explicitly display-only.

Note on provenance vs. current code: the findings were verified against the source at the current branch tip, so the file/line references below are fresh as of run start. They are nonetheless **evidence and starting points, not frozen coordinates** — spec/design research must re-confirm exact lines against the live tree, since they will shift as fixes land.

## What the review asks for

The owner wants every recommended item below addressed. The file/line references are the review's evidence; treat them as starting points to confirm, not as fixed coordinates. Priority tags (P0/P1/P2) are the review's own.

### Top priorities (do before merge)

1. **Expanded tree rows don't collapse on label click** (`StructureTree.js:151-154`) — a one-line fix + one test update; diverges from List View; it's the author's own stated concern.
2. **Inspector list-row layout bugs** (`PitchList.js`/`HandConfigEditor.js` + `editor.scss:28-31`) — the "OCTAVEALTERATION" label collision, cramped fields, the wrapping "Alteration note" label, and the top-floating trash icon. A small no-new-component subset (alignment + label + min-width) fixes the visible symptoms immediately.
3. **`NumberControl` missing `__nextHasNoMarginBottom`** (7 sites) — every other control sets it; trivial additive fix for consistent vertical rhythm. **(See Open question — contradicts review 9.)**

### UX / behavior

- **[P0] Clicking an already-expanded tree row's label never collapses it** — `StructureTree.js:151-154`. `onClick` does `onSelect(); if (!isExpanded) onToggleExpanded(rowKey)`, so an expanded row only re-selects; collapse is reachable only via the `aria-hidden` chevron (`:88-110`) or ArrowLeft. The behavior is pinned by `StructureTree.test.js:388-397`. Diverges from core List View, where a parent row toggles both directions. Suggested fix: drop the `if (!isExpanded)` guard so the label always toggles, and update the one test. (Raised by: UX. Effort: small.) **Note:** this is the direct consequence of review 9's S5 "select-and-reveal" change, which added that guard — review 10 revisits that tradeoff.
- **[P1] Inconsistent destructive deletes; section confirm dialog duplicated** — `StructureTree.js:628-640`, `SectionPanel.js:160-172`, `MeasurePanel.js:143-150`, `NotePanel.js:254-263`, `PitchList.js:51-59`. Section removal is confirmed in **two** independent `ConfirmDialog`s with byte-identical copy, while measure/note/pitch removals fire immediately — the least destructive action is unguarded, the section delete double-guarded. Suggested fix: extract one shared dialog + message constant, then pick one consistent policy (either rely on native undo and drop the dialogs, or confirm uniformly). (Raised by: UX, Gutenberg. Effort: medium.)
- **[P1] Focus dropped to `<body>` after a tree remove** — `edit.js:227-314`; `StructureTree.js` (no post-mutation focus). Remove handlers clear selection but never move focus, so the unmounted row dumps a keyboard user to `<body>`; adds/duplicates auto-select/reveal but don't focus the new row. Suggested fix: after remove, focus the nearest surviving sibling/parent row; after add/duplicate, focus the new label Button. (Raised by: UX. Effort: medium.)
- **[P2] JSON-mode Notice shows only the first error** — `edit.js:520-524` vs `InvalidState.js:38-44`. JSON mode renders `errors[0]` only while `InvalidState` lists all. Suggested fix: map over `errors` in the JSON Notice. (UX. Small.)
- **[P2] Toolbar toggles lack explicit labels** _(downgraded: polish, not an a11y defect — visible text already names them)_ — `edit.js:488-503`. Optionally add state-reflecting `label`/`showTooltip`. (UX. Small.)
- **[P2] Add-for-empty-parent affordances scattered** _(partial: a v1 product choice, not a defect; handlers already lifted)_ — `SongPanel.js:80`, `SectionPanel.js:144`, `StructureTree.js`. Optionally wire "Add section"/"Add measure" into the tree. (UX. Small.)
- **[P2] Hand-group rows look selectable but only toggle** _(partial: mild; they have a distinct +Add-note cell and no row menu)_ — `StructureTree.js:490-497`. Optionally render as plain text/heading. (UX. Small.)

### Styles

- **[P0] Inspector list-row layout cluster** — `PitchEditor.js:59-91` → `PitchList.js:41-60`; `HandConfigEditor.js:142-202`; `editor.scss:28-31`. One root cause: leaf editors return bare fragments dropped into a single `HStack`, and `editor.scss:28-31` only floors the **first** child (`> :first-child { min-width: 8em }`) plus the trailing trash. So the two middle `NumberControl`s collapse and their labels collide ("OCTAVEALTERATION"); the two-word "Alteration note" select wraps at 8em; and `alignment="flex-start"` top-pins the 40px trash button against taller labeled controls. Three lenses converged here.
  - **Stage 1 (P0, no new components):** set row `alignment="flex-end"` (or `center`) in `PitchList`/`HandConfigEditor`; shorten the visible "Alteration note" → "Note" (its scoped aria-label at `HandConfigEditor.js:169` is unchanged); give the `NumberControl`s a `min-width` so they stop collapsing.
  - **Stage 2 (follow-up, medium):** replace the `editor.scss:28-31` child-selector hacks with `Flex` + `FlexBlock` (fields) + `FlexItem` (trash). **Caveat:** `test/mocks/wordpress-components.js` exports `Flex` only (line 598), **not** `FlexItem`/`FlexBlock` — extend the mock and update the three `__list-row` hook tests (`pitches.test.js:347`, `annotations.test.js:328`, `contextControls.test.js:408`) before/with this change. (Raised by: Styles, UX, Gutenberg.)
- **[P2] List-row sizing via positional child selectors** — `editor.scss:28-31` — same root cause as above; the idiomatic `FlexItem`/`FlexBlock` fix is Stage 2. Tracked together. (Styles, Gutenberg.)

### Gutenberg-component adoption

- **[P0] Every `NumberControl` omits `__nextHasNoMarginBottom`** — `PitchEditor.js:69,80`; `ContextEditor.js:127,149`; `HandConfigEditor.js:142,178`; `NotePanel.js:179`. The review states 19 sibling controls set the prop while all 7 `NumberControl` sites omit it, keeping the deprecated default bottom margin and breaking vertical rhythm. Suggested fix: add the prop to each. (Raised by: Gutenberg, Styles. Small.) **(See Open question — contradicts review 9.)**
- **[P2] `InvalidState` hand-rolls `<p>/<ul>/<li>` in a Notice** _(partial)_ — `InvalidState.js:30-49` — drop the redundant `<p>`, wrap the container in a `VStack`; the `<ul>` error list is fine to keep. Low-traffic error state. (Gutenberg.)

### Simplification

- **[P2] `edit.js` 13 mutators repeat one shape** _(partial, downgraded to follow-up)_ — `edit.js:179-479` — ~200/612 lines of near-identical guard/splice/commit/select/reveal. The descriptor-table refactor is legitimate (~120-150 lines saved) but large and touches the mutation core; the current explicit form is individually testable. **Do not perform the big collapse in this run** — pursue as a follow-up only if levels/reveal rules are expected to change. Spec phase decides whether to file a tracking issue.
- **[P2] Redundant `?? undefined` on annotation emit** — `NotePanel.js:233-237`, `MeasurePanel.js:134-139` — `AnnotationList` (`:48`) already collapses empty→undefined, so `?? undefined` is a no-op and the rule is stated twice. Drop it opportunistically. _(review agrees)_
- **[P2] Trim repeated CRITICAL doc-block** — `songModel.js:324-405` — keep the three correctly-factored depth-splice helpers (do **not** merge into a depth-as-data `setAt`); just trim the thrice-restated cautionary prose to one line each. _(review agrees, docs-only)_
- **[P2] Curried `mapMeasure`/`mapEvent`** _(partial)_ — `noteNames.js:184-240` — gratuitous functions-returning-functions over a constant `targetSystem`; optionally inline. Low leverage.
- **[P2] `globalMeasureNumber` rebuilds the coord array** _(partial)_ — `selection.js:114-146` — allocates the full flattened array on every canvas decorate to compute a simple count; songs are small so it's negligible. Optionally compute directly.
- **[P2] `ContextEditor` `resetAll` duplicates per-item deselects** _(partial)_ — `ContextEditor.js:196-209` — real DRY/drift risk, but a clean fix must batch into one emission (the per-item `onDeselect`s each call `onChange`), so it is slightly more than "call the three handlers." Low priority.

### Cross-cutting

- **[P1] Canvas framed as interactive but is display-only** — `edit.js:51,59`; `editor.scss:6-8` vs `SongCanvas.js:18,54`. Comments call the canvas "interactive" / "the surface the author both reads and selects notes on," but `SongCanvas` explicitly does not hit-test and only decorates `event` selections (section/measure highlight nothing). **Fix the cheap half:** correct the misleading docs to "display + highlight only." **Reject** the reviewer's larger suggestion to wire click-to-select — that is net-new feature work the canvas comment itself defers. Optional coarse measure/section highlight (the `data-measure` attribute + `globalMeasureNumber` already exist) is a reasonable **separate follow-up** the spec phase may file rather than implement. _(partial)_
- **[P2] `edit.js:533` doc names the wrong stylesheet** — says `style.scss` lays out the workspace, but the flex rule is in `editor.scss:38-43` (`style.scss` is `@font-face` only). One-word doc fix. _(review agrees)_

## Open question (spec/design must resolve)

**Does `NumberControl` accept `__nextHasNoMarginBottom`, and should each of the 7 sites set it?** This review's P0 says yes (add it everywhere, for vertical-rhythm consistency with the 19 sibling controls). **Review 9 recorded the opposite as a validated decision** ("`__nextHasNoMarginBottom` is NOT wrongly passed to any `NumberControl` — verified all 7", explicitly-fine). Both reviews agree on the fact (all 7 omit it); they disagree on whether that is correct. The spec/design research phase must resolve this against the **actual `@wordpress/components` `NumberControl` prop contract on this branch's version** (does the prop exist on `NumberControl`? does omitting it produce a deprecated default bottom margin?) and the surrounding layout — not by deferring to either review. Whatever it decides, the rationale must be recorded so a later review does not flip it again.

## Considered but not recommended (do not change)

The review explicitly rejected these — they are validated decisions; do not "fix" them:

- **Convert the tree/canvas workspace to `Flex`/`HStack`** (`edit.js:534`, `editor.scss:38-60`) — the `flex:0 1 auto`/`max-width:24em`/`min-width:0` rules are load-bearing and documented; an HStack would still need them on wrapper items. **Reject.**
- **Drop the `accessibleName`/`system` useMemos** (`edit.js:144-157`) — harmless, explicit; removal risks re-running derivations for no real payoff. **Reject.**
- **Change `TreeExpander` to a Button / add a role** (`StructureTree.js:88-110`) — it deliberately mirrors core's `ListViewExpander`; a Button would add a wrong second tab stop per row. **Reject.**
- **Merge the three depth-splice helpers into one `setAt(song, coords, depth)`** (`songModel.js`) — reintroduces the depth-as-data hazard the doc correctly warns about; the three panels each need a fixed depth. **Reject** (keep the functions; trim docs only).
- **Wire full click-to-select on the canvas** (`SongCanvas.js`) — net-new feature, explicitly deferred in-code. **Reject** for this PR (fix the framing instead).

## Constraints carried over

- The change stays **editor-side**: the **song format/schema, `render.php`, and the front-end SVG rendering are unchanged** — a published song renders byte-identically before and after this review.
- Use only libraries WordPress already provides (the `@wordpress/*` packages available to blocks); no new outside dependencies. (`@wordpress/icons` and the `Flex`/`FlexItem`/`FlexBlock` primitives are already part of `@wordpress/components` on this branch.)
- Preserve the wins from prior reviews (the "Explicitly fine as-is" set): the real-`TreeGrid` keyboard model and accessibility parity (verified end-to-end in a real browser), the single expansion Set, coordinate keys, `[aria-level]` indent, recolor-only highlight, the depth-fixed `setSectionAt`/`setMeasureAt`/`setEventAt` helpers, `omitEmpty` vs `omitFalsy`, and raw-JSON mode untouched. The only carried-over win this review deliberately revisits is review 9's "select-only/expand-on-collapsed label" behavior (the P0 above) and the `NumberControl` margin decision (the Open question above).
- "Tests green" must remain incompatible with "real component broken": where a fix depends on a real `@wordpress/components` contract, the verification must exercise the real contract, not only the jest stubs. In particular, the Stage-2 list-row refactor depends on `FlexItem`/`FlexBlock` being present in the components mock — extend the mock rather than letting a green test mask a missing primitive.
