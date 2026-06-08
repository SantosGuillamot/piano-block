# Design Research: Review 5 — Visible tree buttons, add-section in settings, small note highlight

This is the running design-Q&A record between the design-doc-analyst and the
design-doc-researcher for review-5. It is NOT the final design doc; it captures
each topic's frame, options, trade-offs, the decision (traced to a spec
Req/AC), and the rationale, plus open questions and risks. The review is a
focused **editor-side polish pass** — proportional, no schema / `render.php` /
front-end-SVG changes, `@wordpress/*`-only.

## Scope recap (from `1-spec/spec.md`)

- **Req 1 / AC1** — the structure tree's per-row action buttons (remove,
  duplicate, and the per-row add affordances) are clearly visible without
  hovering; remove stays destructive.
- **Req 2 / AC2** — remove the tree's top-level "Add section" button; add an
  add-section control to the block-settings sidebar (the always-present Song
  panel), wired to the existing `onAddSection`.
- **Req 3 / AC3** — the selected-note canvas highlight is a thin, subtle
  indication (not a thick box) at the displayed scale, with no layout shift;
  root-cause why the current `outline` renders large.
- **Req 4 / AC4** — editor-side only: schema, `render.php`, and the front-end
  SVG render are unchanged; a published page renders identically.
- **Req 5 / AC5** — `@wordpress/*`-only; no outside runtime dependency.

## Current-code anchors (live `src/`)

- `src/editor/StructureTree.js` — the tree. Per-row action buttons all use
  `variant="tertiary"` icon Buttons (near-transparent). The trailing
  text-labeled "Add section" Button lives at the end of the tree
  (`StructureTree.js:542-548`), wired to `onAddSection`.
- `src/editor/inspector/SongPanel.js` — the always-present Song panel (the
  add-section destination).
- `src/editor/inspector/SectionPanel.js` — already has an "Add section" Button
  wired to `onAddSection`, but it is selection-gated (only shown when a section
  is selected).
- `src/edit.js` — owns `onAddSection` and all the lifted mutators; passes them
  into `StructureTree`, `SectionPanel`, `NotePanel`. `SongPanel` is the always-
  present panel and is currently passed only `song`/`system`/`onChange`.
- `src/notation/svg.js` — the shared front-end renderer. `renderSvg` builds the
  root `<svg viewBox="0 0 {widthSp} {heightSp}" width={widthSp*SP_PX} ...>`.
  Selected `<g data-kind="note"|"rest">` has no box of its own.
- `src/notation/constants.js` — `SP_PX = 8` (one staff space = 8 px).
- `src/editor/SongCanvas.js` — `decorateSelection` adds `.is-selected` to the
  selected `<g>` after each draw (editor-only; the front-end `view.js` path
  never decorates).
- `src/style.scss:92-95` — `.is-selected { outline: 1px solid #007cba;
  outline-offset: 1px; }` (the review-4 highlight that renders thick).

## Topics

### Topic 1 — Visible tree action buttons (Req 1 / AC1)

**Frame.** Every per-row ACTION button in the tree uses `variant="tertiary"` —
the near-transparent Gutenberg icon style — so remove / duplicate / add-measure /
add-note read as bare ink with no chrome and are easy to miss without hovering.
The row LABEL/disclosure buttons (`StructureTree.js:193, 292, 400, 455`) are also
tertiary but are intentionally text-link-styled and are NOT in scope.

The seven action buttons to change:
- Section: remove `:212`, duplicate `:227`, add-measure `:241`
- Measure: remove `:315`, duplicate `:336`
- Hand "Add note": `:414`
- Note: remove `:478`, duplicate `:506`

**Options.**
1. `variant="secondary"` — a visible bordered/tinted chip; the standard
   Gutenberg "visible but not primary" affordance.
2. Icon-with-label (add a text label beside each icon) — more discoverable but
   much bulkier in a narrow tree rail; over-heavy for the change.
3. A custom styled icon via SCSS — re-invents what `secondary` already gives,
   adds non-`@wordpress` styling surface.

**Trade-offs.** `secondary` is the smallest change, is the codebase's existing
house style for action buttons (already used at `ListControls.js:26`,
`InvalidState.js:46`, `SectionPanel.js:145/149`, `NotePanel.js:276/282`,
`MeasurePanel.js:164`), and composes with the existing `isDestructive` on the
remove buttons so the destructive read is preserved. Icon-with-label is bulkier
and not required by AC1. A custom SCSS chip is redundant with `secondary`.

**Decision.** Switch the seven action buttons from `variant="tertiary"` to
`variant="secondary"`. Keep `isDestructive` on every remove (already present at
`:218, :325, :490`). Leave the row label/disclosure buttons tertiary — the
intentional hierarchy is *label = quiet text link, actions = visible chips*. No
SCSS change required (the `&__tree` rule only sets rail width + the label
indent; the action cell is flush). An optional `gap` on the action
`TreeGridCell` is polish, not required.

**Traces to.** Req 1 / AC1 (buttons plainly visible without hover; remove still
reads destructive). `@wordpress/*`-only (AC5).

**Rationale.** `secondary` is the consistent, already-blessed choice in this
codebase; tertiary in the tree is the outlier. Tests find buttons by
`aria-label`/textContent and there is no jest mock of `@wordpress/components`, so
the real variant renders and the change is test-safe.

### Topic 2 — Add-section moved to the block settings (Req 2 / AC2)

**Frame.** The tree's trailing top-level "Add section" Button
(`StructureTree.js:542-548`) must be removed and an add-section control made
available from the block-settings sidebar. The per-row add-measure/add-note
affordances stay in the tree. The `onAddSection` handler in `edit.js:240-249`
stays (it is the single lifted append owner); only its UI entry point moves.

**Current state (two-thirds built).**
- `SongPanel.js` is the **always-present** panel (`edit.js:520`, mounted
  unconditionally) — the natural single home for an always-available
  add-section. It does not yet receive `onAddSection`.
- `SectionPanel.js:145-147` already renders an "Add section" Button wired to
  `onAddSection`, BUT SectionPanel is **selection-gated** (`edit.js:511
  {resolvedSelection && ...}`) — so with nothing selected (exactly when you'd
  add the first/next section) it is absent. Leaving add-section only there would
  fail AC2.

**Options.**
1. Add "Add section" to the always-present `SongPanel`, and REMOVE the
   selection-gated SectionPanel copy → a single, always-available home.
2. Add it to SongPanel but KEEP the SectionPanel copy → two identical
   add-section buttons in the same sidebar (confusing; same append).
3. Only fix SectionPanel (make it always-present) → larger change to panel
   gating; SongPanel is already the always-present panel, so this is the long
   way round.

**Decision.** Option 1. Add an "Add section" `Button` (`variant="secondary"`,
matching the SectionPanel idiom) to `SongPanel`; thread `onAddSection` into
`<SongPanel>` at `edit.js:520` and add it to SongPanel's props/JSDoc. **Remove**
the SectionPanel "Add section" Button (`:145-147`) so add-section has a single
home; SectionPanel keeps only "Remove section" (section-scoped, which belongs
there) — so `onAddSection` is dropped from SectionPanel's props and from
`edit.js:516`. Remove the tree's trailing "Add section" Button and drop the now-
unused `onAddSection` from `StructureTree`'s props (`:130`, JSDoc `:108`) and
from the `edit.js:466` call-site.

**Traces to.** Req 2 / AC2 (no "Add section" in the tree; add-section available
in the block-settings sidebar and adds a section). `@wordpress/*`-only (AC5).

**Rationale.** SongPanel is already the always-present panel, so it is the only
place an add-section control is reachable in EVERY state (including nothing-
selected). A single home avoids two redundant buttons. (Single-home confirmation
and exact test touchpoints — `StructureTree.test.js:334-344`,
`SectionPanel.test.js:257-259`, `Edit.test.js:405-410` — pending the
researcher's confirmation round; see Open Questions.)

### Topic 3 — Genuinely small note highlight + root cause (Req 3 / AC3)

**Root cause (CONFIRMED — the crux).** The scale factor is **8×**. The root
`<svg>` (`svg.js:288-300`) has `viewBox="0 0 {widthSp} {heightSp}"` (staff-space
units) but `width = widthSp * SP_PX` / `height = heightSp * SP_PX` with
`SP_PX = 8` (`constants.js:19`). So the viewBox→viewport transform maps **1 user
unit (1 sp) → 8 device px** uniformly. The `.is-selected` class
(`SongCanvas.js:118`) sits on the note/rest `<g>` (`svg.js:762`/`:909`), and the
review-4 rule `outline: 1px solid; outline-offset: 1px` (`style.scss:92-95`) is
painted in that element's USER coordinate system and carried through the viewBox
transform — so "1px" is interpreted as ~1 sp and rendered at **~8 px**, with the
offset adding ~8 px of gap each side: a thick ring around the whole `<g>` bbox.
That is the reported "large thick box."

**Frame.** Replace the magnified `<g>` outline with a highlight that is
genuinely thin at the DISPLAYED (8×) scale, editor-only (the `.is-selected`
decoration is added only by `SongCanvas` after render; `view.js` never adds it
and never sees `style.scss`'s editor rules, so AC4 / the front-end SVG output is
untouched), and causes no layout shift.

**Options evaluated.**
1. **`vector-effect: non-scaling-stroke` (stroke the glyphs or an added rect)** —
   REJECTED as the load-bearing mechanism. `non-scaling-stroke` reliably counters
   only a `transform="scale()"`, NOT viewBox-based scaling / CSS resizing — and
   our dominant 8× comes precisely from the viewBox→width-attribute mapping
   (`svg.js:291-293`), the case where `non-scaling-stroke` has historically been
   flaky/browser-version-dependent. We must not stake AC3 on it. (May ride along
   as a modern-browser accent only, never as the floor.)
2. **Enclosing hairline `<rect>` via `getBBox()` in `decorateSelection`** —
   REJECTED. Empirically verified in THIS repo's jest env: `getBBox` is
   `undefined` in jsdom and THROWS, so `SongCanvas.test.js` (which decorates on
   every render) would crash unless guarded, and the highlight would then be
   unit-untested. It is editor-only and tracks the glyph correctly, but it STILL
   needs a non-scaling or hard-coded `0.125` stroke (back to problem 1/3), so it
   adds JS fragility for no thinness benefit.
3. **`box-shadow` / `filter: drop-shadow`** — REJECTED: `box-shadow` is a CSS-box
   property with the same unreliable support on SVG `<g>`; `drop-shadow` renders
   a soft blur, not a crisp thin line.
4. **Enclosing `outline` hairline = review-4's rule with the width DIVIDED by the
   8× scale** — CHOSEN as primary. `outline` already draws a rectangle hugging
   the `<g>`'s bbox (that is exactly why review-4 looked like a box); the ONLY
   defect was thickness, because `outline`/`outline-offset` resolve in user units
   and are magnified 8×. Dividing by `SP_PX`: `outline: 0.125px` ⇒ 0.125 sp × 8 =
   ~1 CSS px hairline; `outline-offset: 0.25px` ⇒ ~2 CSS px gap. Gives the
   conventional ENCLOSING mark, thin at displayed scale, CSS-only, no JS, no
   layout shift, editor-only, test-neutral.
5. **Color RECOLOR of the selected glyphs** — CHOSEN as a reinforcing floor. Color
   has no length, so it is scale-invariant by construction and works on EVERY
   engine (including Safari, where `outline` on `<g>` is reported to no-op). Used
   alongside option 4 so no engine shows nothing.

**Decision.** A single CSS-only `.is-selected` rule combining (a) the enclosing
`outline: 0.125px` hairline (primary, conventional "selected" box, thin via the
÷8 scale division) and (b) a safe color recolor of the selected event's glyphs
(reinforcing floor that also covers Safari's `<g>`-outline no-op). NO JS change
(`decorateSelection`/`SongCanvas` keep only adding the `.is-selected` class), NO
`svg.js`/`render.php`/schema change. Replaces `style.scss:92-95`.

The recolor must preserve each glyph's filled/open identity — verified safe split:
recolor `stroke` on every child, but recolor `fill` ONLY where fill is the paint,
guarded by `:not([fill="none"])` so an OPEN notehead's transparent center
(`<ellipse fill="none">`, `svg.js:205-213`) is NOT filled into a solid blob.
Within a note/rest `<g>` the only `fill="none"` child is the open notehead
(ties/slurs/hairpins are system/measure-level spans, never children of a note
`<g>`, so the rule never reaches them). All paints are real DOM attributes (set
via `el()`→`setAttribute`), so `fill="none"` is attribute-selectable.

```scss
.is-selected {
  /* Enclosing hairline: outline lengths resolve in the staff-space user system,
     which the root viewBox scales 1 sp -> SP_PX (8) CSS px, so divide by 8:
     0.125 sp x 8 = ~1 CSS px line, 0.25 sp x 8 = ~2 CSS px gap. COUPLED to
     SP_PX=8 by design (one commented line). May no-op on Safari for a <g>; the
     recolor below is the cross-engine floor. */
  outline: 0.125px solid #007cba;
  outline-offset: 0.25px;

  /* Cross-engine floor + reinforcing signal: recolor the selected event's ink.
     Stroke everywhere (stems/ledgers/rings); fill only where fill is the paint —
     :not([fill="none"]) preserves an OPEN notehead's hole. Color-only => no
     layout shift; editor-only (class added by SongCanvas post-render; view.js
     never sets it) => front-end SVG byte-identical (AC4). */
  * { stroke: #007cba; }
  *:not([fill="none"]) { fill: #007cba; }
}
```

**Traces to.** Req 3 / AC3 (thin enclosing line, no layout change), Req 4 / AC4
(front-end output unchanged — editor-only class, CSS-only), Req 5 / AC5 (`outline`
+ `fill`/`stroke` are plain CSS/SVG, no dependency).

**Rationale.** The enclosing outline is the conventional "selected" signal the
analyst argued for and is a one-line minimal diff from review-4 (change `1px` →
`0.125px`); the recolor is a cheap, scale-invariant floor that guarantees a
visible selection on every engine and reinforces the mark. The cost is a
deliberate, well-commented coupling of the hairline width to `SP_PX=8`; if
`SP_PX` is ever retuned, this one line must be re-divided (a documented,
localized coupling, acceptable for a 1-line polish rule). Both the outline-only
and recolor-only sub-options remain on the table if implementation prefers a
single mechanism: outline-only is the smallest diff but Safari-degraded; recolor-
only is the most robust but a weaker "different-color-note" signal.

## Components, interfaces & data flow

This review touches presentation/wiring only; the song model, the lifted
mutators, and the render pipeline are unchanged.

- **`StructureTree.js`** — change 7 action-button `variant`s; remove the trailing
  Add-section Button; drop the `onAddSection` prop. No change to the row model,
  the index-path Sets, or `onSelect`/expansion wiring.
- **`SongPanel.js`** — gains an `onAddSection` prop and an "Add section"
  `Button` (`variant="secondary"`). It stays a pure controlled panel; the button
  just calls `onAddSection?.()`. This is the always-present add-section home.
- **`SectionPanel.js`** — loses its Add-section Button and the `onAddSection`
  prop; keeps "Remove section" (`onRemoveSection`).
- **`edit.js`** — re-threads props: drop `onAddSection` from the `<StructureTree>`
  (`:466`) and `<SectionPanel>` (`:516`) call-sites; add it to `<SongPanel>`
  (`:520`). The `onAddSection` HANDLER (`:240-249`) and all other lifted mutators
  are unchanged. Selection/commit data flow is untouched.
- **`style.scss`** — replace the `.is-selected` rule (`:92-95`) with the combined
  outline-hairline + safe-recolor rule (Topic 3). No other selector changes.
- **`SongCanvas.js` / `svg.js`** — UNCHANGED. `decorateSelection` still only adds
  the `.is-selected` class; the shared renderer's front-end output is identical
  (AC4). No `render.php`/schema change (Req 4).

## Dependencies

`@wordpress/*`-only throughout (AC5). The Button variant, the SongPanel
`Button`, and the `outline`/`fill`/`stroke` CSS are all stock Gutenberg/SVG/CSS;
no outside runtime dependency is added.

## Failure modes & edge cases

- **Stale selection / redraw idempotency.** `decorateSelection` runs on a fresh
  tree each draw (`renderInto` → `replaceChildren`), and `.is-selected` is a CSS
  class, so the highlight re-applies cleanly with no stale buildup. A stale
  selection (query matches nothing) decorates nothing — unchanged.
- **Open-notehead recolor.** Guarded by `:not([fill="none"])` so a half/whole
  note's open head keeps its hole (verified the only `fill="none"` child of a
  note `<g>` is the open notehead).
- **Safari `<g>` outline no-op.** Covered by the recolor floor so the selection
  is still visible; the enclosing hairline is the enhanced read where supported.
- **Add-section reachable in every state.** SongPanel is always mounted, so
  add-section works with nothing selected (the case the tree button used to
  cover) — closing the gap the selection-gated SectionPanel left.

## Test impact (handed to the plan)

- `StructureTree.test.js:334-344` — DELETE (tree Add-section button) + drop the
  `addSection` harness wiring.
- `SectionPanel.test.js:256-264` — DELETE (the "add section" describe) + drop the
  `addSection` harness wiring.
- `Edit.test.js:404-416` — RETARGET: drop the `selectLoneNote` precondition; the
  "Add section" click now resolves to SongPanel's always-present button; the
  append-through-commit assertion is unchanged.
- `SongPanel.test.js` — ADD a test asserting SongPanel's Add-section button calls
  the lifted `onAddSection`.
- Variant change and the `.is-selected` CSS change are TEST-NEUTRAL: the
  `@wordpress/components` mock swallows `variant`/`isDestructive`, and
  `SongCanvas.test.js` asserts only the `.is-selected` class placement, not CSS.

## Open Questions (resolved)

- **Q-INV1a (resolved).** `variant` + `isDestructive` compose in the real
  `@wordpress/components` Button (`is-secondary is-destructive`); `isDestructive`
  does not override the variant. Stated as library behavior — NOT repo-verifiable
  (the real component is externalized/absent; the repo mock swallows both props),
  so a visual/e2e check is the way to confirm if certainty is wanted. The variant
  change itself is unit-test-neutral.
- **Q-INV2 (resolved).** Single-home = SongPanel; SectionPanel keeps only Remove;
  StructureTree loses Add entirely. The complete add-section touchpoint list is
  in "Test impact" above — confirmed exhaustive (no Edit.test asserts the tree's
  Add-section presence).
- **Q3 / crux (resolved).** `getBBox()` throws in this repo's jsdom (empirically
  verified), so the JS enclosing-rect path is rejected; `non-scaling-stroke` is
  unreliable against viewBox scaling, so it is not load-bearing. The chosen fix is
  the CSS-only enclosing `outline: 0.125px` hairline (review-4's rule ÷ the 8×
  scale) plus a scale-invariant recolor floor (Safari-safe). See Topic 3.

## Risks

- **`SP_PX` coupling.** The `outline: 0.125px` hairline hard-codes the inverse of
  `SP_PX=8`. If `SP_PX` is retuned (it is documented as tunable), this one line
  must be re-divided. Mitigated by a load-bearing SCSS comment; the recolor floor
  is unaffected (color has no length). Localized, single-line, acceptable.
- **Index-path staleness (pre-existing).** Removing the tree's Add-section button
  and re-threading props must not disturb the `expandedPaths` /
  `collapsedOverride` index-path Sets; this review touches only button
  presentation/wiring, not the row model.
- **Safari editor-only highlight.** If a future change drops the recolor floor,
  the highlight could vanish in Safari (no WebKit e2e to catch it). The combined
  rule keeps the floor precisely to avoid this.

## Self-check — Req/AC coverage

- **Req 1 / AC1** — Topic 1: 7 action buttons → `variant="secondary"` (visible
  chips), remove keeps `isDestructive`. ✓
- **Req 2 / AC2** — Topic 2: tree Add-section removed; SongPanel (always-present)
  gains an Add-section control wired to `onAddSection`. ✓
- **Req 3 / AC3** — Topic 3: enclosing `outline: 0.125px` hairline + scale-
  invariant recolor; thin, no layout shift; root cause (8× viewBox magnification
  of a user-unit outline on the `<g>`) confirmed. ✓
- **Req 4 / AC4** — Editor-only: `svg.js`/`render.php`/schema unchanged;
  `.is-selected` decoration is editor-only; front-end SVG byte-identical. ✓
- **Req 5 / AC5** — `@wordpress/*`/stock CSS only; no outside dependency. ✓

No gaps found.
