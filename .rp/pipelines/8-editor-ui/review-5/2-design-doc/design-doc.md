# Design Doc: Review 5 — Visible tree action buttons, add-section in block settings, and a genuinely small note highlight

## Overview

The Piano block editor presents a left **structure tree** (Section → Measure →
Right/Left hand → Note) as its selection surface, with per-row action buttons and
a top-level "Add section" button, and it highlights the selected note on the
canvas. This review is a focused **editor-side polish pass** that fixes three
usability rough edges:

1. the tree's per-row **remove / duplicate / add** action buttons are effectively
   invisible (they use the near-transparent `tertiary` icon style);
2. the tree's top-level **"Add section"** button is removed and replaced by an
   add-section control in the always-present block-settings panel; and
3. the **selected-note highlight** still renders as a large, thick box — even
   though review 4 set a `1px` outline — because an `outline` on the note's SVG
   `<g>` is magnified by the notation's staff-space→pixel scale.

The work is **proportional**: presentation and prop-wiring only. The song
format/schema, the server render (`render.php`), the shared notation renderer's
front-end SVG output, and the front-end view (`view.js`) are all unchanged, and
no outside runtime dependency is added. Every change is reachable from
`@wordpress/*` packages or plain CSS/SVG.

## Approach

Three independent, small changes, each traceable to a single spec requirement:

- **Tree buttons (Req 1 / AC1).** Switch the 7 per-row *action* buttons in
  `StructureTree.js` from `variant="tertiary"` to `variant="secondary"` so they
  render as visible bordered chips. The remove buttons keep `isDestructive`; the
  row *label/disclosure* buttons stay `tertiary` by design (an intentional
  hierarchy: quiet label, visible actions).

- **Add-section relocation (Req 2 / AC2).** Remove the add-section affordance
  from the tree *and* from the selection-gated `SectionPanel`, and add a single
  add-section control to the always-present `SongPanel`, wired to the one lifted
  `onAddSection` handler that already lives in `edit.js`.

- **Small note highlight (Req 3 / AC3).** Replace the magnified `outline` rule in
  `style.scss` with a **CSS-only** `.is-selected` rule that is thin at the
  displayed scale: an enclosing **hairline** `outline` whose width is review-4's
  `1px` divided by the notation's 8× scale, plus a scale-invariant **color
  recolor** of the selected glyphs as a cross-engine floor. No JS, no `svg.js`,
  no `render.php`, no schema change.

The selection-highlight class (`.is-selected`) is added only by the editor
(`SongCanvas.decorateSelection`) after each render; the front-end `view.js` path
never adds it and never loads the editor `style.scss`, so the published-page SVG
is byte-identical (Req 4 / AC4).

## Components

This review touches presentation/wiring only. The song model, the lifted
mutators in `edit.js`, and the render pipeline (`svg.js`, `render.php`,
`view.js`) are unchanged.

- **`src/editor/StructureTree.js`** — change the 7 per-row action-button
  `variant`s from `tertiary` to `secondary`; remove the trailing "Add section"
  `Button` (`:542-548`); drop the now-unused `onAddSection` prop (`:128`) and its
  JSDoc (`:108`). The row model, the index-path Sets, and the
  `onSelect`/expansion wiring are untouched. The 7 action buttons:
  - Section: remove `:212`, duplicate `:227`, add-measure `:241`
  - Measure: remove `:315`, duplicate `:336`
  - Hand "Add note": `:414`
  - Note: remove `:478`, duplicate `:506`

  The label/disclosure buttons at `:193, :292, :400, :455` stay `tertiary`
  (intentionally text-link-styled, out of scope).

- **`src/editor/inspector/SongPanel.js`** — gains an `onAddSection` prop (added to
  the destructured props at `:122` and its JSDoc) and an "Add section" `Button`
  (`variant="secondary"`) that calls `onAddSection?.()`. It stays a pure
  controlled panel; the button only signals intent. This is the always-present
  add-section home.

- **`src/editor/inspector/SectionPanel.js`** — loses its "Add section" `Button`
  (`:145-147`) and the `onAddSection` prop (`:66, :74`); keeps "Remove section"
  (`onRemoveSection`, section-scoped, which belongs here).

- **`src/edit.js`** — re-threads props. Drops `onAddSection` from the
  `<StructureTree>` call-site (`:466`) and the `<SectionPanel>` call-site
  (`:516`); adds it to `<SongPanel>` (`:520`). The `onAddSection` *handler*
  (`:240-249`) and every other lifted mutator are unchanged; selection and commit
  data flow are untouched.

- **`src/style.scss`** — replaces the `.is-selected` rule (`:92-95`) with the
  combined enclosing-hairline + safe-recolor rule (see Interfaces and Data Flow).
  No other selector changes.

- **`src/editor/SongCanvas.js` / `src/notation/svg.js`** — UNCHANGED.
  `decorateSelection` still only adds the `.is-selected` class to the selected
  `<g>` after each draw; the shared renderer's front-end output is identical.

## Interfaces and Data Flow

### Tree action buttons (Req 1)

Each of the 7 action `Button`s changes only its `variant` attribute,
`tertiary` → `secondary`. The remove buttons keep `isDestructive` (already
present at `:218, :325, :490`). In the real `@wordpress/components` Button,
`variant` and `isDestructive` compose to `is-secondary is-destructive`; the
destructive read is preserved.

### Add-section wiring (Req 2)

`onAddSection` is the single lifted append owner in `edit.js`:

```js
const onAddSection = () => {
  commit({
    ...working,
    sections: insertAt(working.sections, working.sections.length, newSection()),
  });
};
```

The handler does not change. Only its UI entry point moves: from two callers
(`StructureTree`, `SectionPanel`) to one (`SongPanel`). After the change,
`onAddSection` flows `edit.js → SongPanel` only. The per-row add-measure /
add-note affordances stay in the tree (they call different lifted mutators).

`SongPanel` is mounted unconditionally (`edit.js:520`, outside the
`{resolvedSelection && …}` gate that wraps `SectionPanel` at `:511`), so the
add-section control is reachable in **every** editor state — including the
nothing-selected state in which an author adds the first/next section. That is
the exact state the selection-gated `SectionPanel` could not cover and the gap
that makes Option 1 the only single-home that satisfies AC2.

### Selected-note highlight (Req 3) — the crux

**Root cause (the 8× magnification).** The root `<svg>` (`svg.js:288-300`) is
built with `viewBox="0 0 {widthSp} {heightSp}"` in **staff-space (sp) user
units**, but with `width = widthSp * SP_PX` and `height = heightSp * SP_PX`,
where `SP_PX = 8` (`constants.js:19`). The viewBox→viewport transform therefore
maps **1 user unit (1 sp) → 8 device px uniformly**. The `.is-selected` class
sits on the note/rest `<g>` (`SongCanvas.js` adds it; the `<g>` is built at
`svg.js:762`/`:909`). Review-4's rule `outline: 1px solid; outline-offset: 1px`
(`style.scss:92-95`) is painted in that element's **user** coordinate system and
carried through the viewBox transform, so "1px" is interpreted as ~1 sp and
renders at **~8 CSS px**, with the offset adding ~8 px of gap on each side — a
thick ring around the whole `<g>` bbox. That is the reported "large, thick box."

**Fix — a CSS-only combined rule** that replaces `style.scss:92-95`:

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

- **(a) Enclosing hairline `outline`** is the primary, conventional "selected box"
  signal and a one-line minimal diff from review-4 (`1px` → `0.125px`). `outline`
  already hugs the `<g>`'s bbox (that is exactly why review-4 looked like a box);
  the only defect was thickness, fixed by dividing the user-unit length by the 8×
  scale. Thin at displayed scale, CSS-only, no JS, no layout shift, editor-only.

- **(b) Color recolor** is a reinforcing floor. Color has no length, so it is
  scale-invariant by construction and renders on every engine — including Safari,
  where `outline` on a `<g>` is reported to no-op. The fill recolor is guarded by
  `:not([fill="none"])` so an **open** notehead's transparent center
  (`<ellipse fill="none">`, `svg.js:205-213`) is not filled into a solid blob.
  Within a note/rest `<g>` the only `fill="none"` child is the open notehead
  (ties/slurs/hairpins are system/measure-level spans, never children of a note
  `<g>`), and every paint is a real DOM attribute (`el()` → `setAttribute`), so
  `fill="none"` is attribute-selectable.

The two mechanisms are combined so no engine shows nothing: the hairline is the
enhanced read where supported; the recolor is the guaranteed floor everywhere.

## Key Decisions

### KD1 — Tree action buttons: `tertiary` → `secondary` (Req 1 / AC1)

Switch the 7 per-row action `Button`s from `variant="tertiary"` to
`variant="secondary"`, a visible bordered/tinted chip — the codebase's existing
house style for action buttons (already used at `ListControls.js`,
`InvalidState.js`, `SectionPanel.js`, `NotePanel.js`, `MeasurePanel.js`). Keep
`isDestructive` on every remove. Leave the row label/disclosure buttons
`tertiary`: the hierarchy is deliberate — *label = quiet text link, actions =
visible chips*. No SCSS change is required. This is the smallest change that
makes the buttons plainly visible without hover while keeping the destructive
read (AC1) and stays `@wordpress/*`-only (AC5).

**Rejected:** *icon-with-label* (bulky in a narrow tree rail, not required by
AC1); *custom styled icon via SCSS* (re-invents what `secondary` already gives
and adds a non-`@wordpress` styling surface).

### KD2 — Add-section single home in `SongPanel` (Req 2 / AC2)

Add an "Add section" `Button` (`variant="secondary"`, matching the SectionPanel
idiom) to the always-present `SongPanel`; thread `onAddSection` into
`<SongPanel>` (`edit.js:520`) and into SongPanel's props/JSDoc. **Remove** the
SectionPanel "Add section" Button (`:145-147`) so add-section has a single home —
SectionPanel keeps only "Remove section" — and drop `onAddSection` from
SectionPanel's props and the `edit.js:516` call-site. **Remove** the tree's
trailing "Add section" Button and drop the now-unused `onAddSection` from
`StructureTree`'s props (`:128`), JSDoc (`:108`), and the `edit.js:466`
call-site.

`SongPanel` is the only panel mounted in every state, so it is the only place an
add-section control is reachable when nothing is selected — the state in which
the author adds the next section. A single home avoids two redundant buttons
firing the same append. Stays `@wordpress/*`-only (AC5).

**Rejected:** *keep the SectionPanel copy* (two identical buttons in the same
sidebar, both calling the same append — confusing); *make SectionPanel
always-present* (a larger panel-gating change when SongPanel is already the
always-present panel).

### KD3 — CSS-only thin highlight: hairline outline + recolor floor (Req 3 / AC3) — the crux

Root cause is the **8× viewBox magnification** of a user-unit `outline` on the
selected `<g>` (see Interfaces and Data Flow). The fix is a single CSS-only
`.is-selected` rule combining the enclosing `outline: 0.125px` hairline (review-4's
rule ÷ the 8× scale) and a Safari-safe color recolor of the selected glyphs. No
JS change (`decorateSelection`/`SongCanvas` keep only adding the class), no
`svg.js`/`render.php`/schema change → front-end SVG byte-identical (AC4). Thin at
the displayed scale, no layout shift (AC3); `outline` + `fill`/`stroke` are plain
CSS/SVG (AC5).

**Rejected:**
- **`vector-effect: non-scaling-stroke`** — not load-bearing. It reliably
  counters only a `transform="scale()"`, not viewBox-based scaling / CSS
  resizing; our dominant 8× comes precisely from the viewBox→width-attribute
  mapping (`svg.js:291-293`), the case where `non-scaling-stroke` has been
  flaky/browser-version-dependent. AC3 must not be staked on it. (It may ride
  along as a modern-browser accent, never as the floor.)
- **Enclosing hairline `<rect>` via `getBBox()` in `decorateSelection`** —
  empirically verified that `getBBox` is `undefined` and **throws** in this
  repo's jsdom, so `SongCanvas.test.js` (which decorates on every render) would
  crash unless guarded, and the highlight would be unit-untested. It also still
  needs a non-scaling or hard-coded `0.125` stroke (back to the rejected
  mechanisms), so it adds JS fragility for no thinness benefit.
- **`box-shadow` / `filter: drop-shadow`** — `box-shadow` is a CSS-box property
  with the same unreliable support on an SVG `<g>`; `drop-shadow` renders a soft
  blur, not a crisp thin line.

### KD4 — Editor-side only; `@wordpress/*`-only (Req 4–5 / AC4–AC5)

All changes are editor-side. `svg.js`, `render.php`, `view.js`, and the schema
are unchanged; `.is-selected` is added only by the editor after render and the
editor `style.scss` never loads on the front end, so a published page renders a
given song byte-identically (AC4). Every surface used — the `Button` variant, the
SongPanel `Button`, and the `outline`/`fill`/`stroke` CSS — is stock
Gutenberg/SVG/CSS; no outside runtime dependency is added (AC5).

## Dependencies

`@wordpress/*` and stock CSS/SVG only (AC5). The `Button` `variant` change, the
SongPanel "Add section" `Button`, and the `.is-selected` `outline`/`fill`/`stroke`
rule are all already reachable from packages available to blocks. No new runtime
dependency.

## Failure Modes and Observability

- **Stale selection / redraw idempotency.** `decorateSelection` runs on a fresh
  tree each draw (`renderInto` → `replaceChildren`), and `.is-selected` is a CSS
  class, so the highlight re-applies cleanly with no stale buildup. A stale
  selection that matches nothing decorates nothing — unchanged.
- **Open-notehead recolor.** Guarded by `:not([fill="none"])` so a half/whole
  note's open head keeps its hole; the only `fill="none"` child of a note `<g>`
  is the open notehead.
- **Safari `<g>` outline no-op.** Covered by the recolor floor, so the selection
  is still visible; the enclosing hairline is the enhanced read where supported.
- **Add-section reachable in every state.** SongPanel is always mounted, so
  add-section works with nothing selected — closing the gap the selection-gated
  SectionPanel left.
- **Front-end parity.** `view.js` never adds `.is-selected` and never loads the
  editor `style.scss`; `svg.js`/`render.php`/schema are untouched, so the
  published SVG is byte-identical.

**Observability.** The variant change and the `.is-selected` CSS change are
**test-neutral**: the `@wordpress/components` mock swallows
`variant`/`isDestructive`, and `SongCanvas.test.js` asserts only the
`.is-selected` class placement, not CSS. The add-section relocation is the
testable surface. Test touchpoints handed to the plan:

- `StructureTree.test.js:334-344` — DELETE (tree Add-section button) and drop the
  `addSection` harness wiring.
- `SectionPanel.test.js:256-264` — DELETE the "add section" describe and drop the
  `addSection` harness wiring.
- `Edit.test.js:404-416` — RETARGET: drop the `selectLoneNote` precondition; the
  "Add section" click now resolves to SongPanel's always-present button; the
  append-through-commit assertion is unchanged.
- `SongPanel.test.js` — ADD a test asserting SongPanel's Add-section button calls
  the lifted `onAddSection`.

The hairline's correctness at the displayed scale (and the
`variant`+`isDestructive` composition into `is-secondary is-destructive`) is a
**visual/e2e** check, not unit-assertable here — the real
`@wordpress/components` Button is externalized and the mock swallows both props.

## Risks and Open Questions

- **`SP_PX` coupling (KD3).** The `outline: 0.125px` hairline hard-codes the
  inverse of `SP_PX=8`. If `SP_PX` is retuned (it is documented as tunable), this
  one line must be re-divided. Mitigated by a load-bearing SCSS comment; the
  recolor floor is unaffected (color has no length). Localized, single-line,
  acceptable for a one-line polish rule. If a future change drops the recolor
  floor, the highlight could vanish in Safari (no WebKit e2e to catch it) — the
  combined rule keeps the floor precisely to avoid this.
- **Index-path staleness (pre-existing).** Removing the tree's Add-section button
  and re-threading props must not disturb the `expandedPaths` /
  `collapsedOverride` index-path Sets. This review touches only button
  presentation/wiring, not the row model.
- **Single-mechanism fallback (open, deferred to implementation).** If the
  implementation prefers a single highlight mechanism, both sub-options remain on
  the table: *outline-only* is the smallest diff but Safari-degraded;
  *recolor-only* is the most robust but a weaker "different-color-note" signal.
  The combined rule is chosen so neither weakness applies.

## Requirement / Acceptance-Criteria coverage

- **Req 1 / AC1** — KD1: 7 action buttons → `variant="secondary"` (visible
  chips); remove keeps `isDestructive`; label buttons stay quiet.
- **Req 2 / AC2** — KD2: tree Add-section removed; SectionPanel Add-section
  removed; the always-present `SongPanel` gains an Add-section control wired to
  `onAddSection`.
- **Req 3 / AC3** — KD3: root cause is the 8× viewBox magnification of a user-unit
  `outline` on the `<g>`; fix is the enclosing `outline: 0.125px` hairline plus a
  scale-invariant recolor; thin, no layout shift.
- **Req 4 / AC4** — KD4: `svg.js`/`render.php`/`view.js`/schema unchanged;
  `.is-selected` is editor-only; front-end SVG byte-identical.
- **Req 5 / AC5** — KD4: `@wordpress/*`/stock CSS/SVG only; no outside dependency.
