# Design-doc review — Review 5 — APPROVED

**Verdict:** APPROVED. The design doc is complete, sound, buildable, and aligned
with the spec. Every Req (1–5) and AC (1–5) has a traceable design decision, the
crux (Req 3 / AC3 highlight fix) is correctly root-caused and correctly scoped,
and the boundary holds. Two code-writers would build the same thing.

## What was verified against the live `src/`

### The crux — small note highlight (Req 3 / AC3)

- **Root cause is correct.** The root `<svg>` is built with
  `viewBox="0 0 {widthSp} {heightSp}"` in sp user units but `width = widthSp *
  SP_PX` / `height = heightSp * SP_PX` (`svg.js:291-293`), and `SP_PX = 8`
  (`constants.js:19`). So the viewBox→viewport transform maps 1 sp → 8 CSS px
  uniformly, magnifying review-4's user-unit `outline: 1px` (`style.scss:92-95`,
  nested under `&__canvas-svg`) ~8×. Confirmed.
- **`.is-selected` lands on the note/rest `<g>`** (`SongCanvas.decorateSelection`
  → `node.classList.add("is-selected")`, `SongCanvas.js:118`; `<g data-kind>`
  built at `svg.js:762` / `:909`), added only by the editor after render. No JS
  change is required. Confirmed.
- **The fix is correctly scoped (the team-lead's central concern).** The SCSS on
  disk (doc lines 160-162) is:
  ```scss
  *:not([fill="none"]) { fill: #007cba; }
  line { stroke: #007cba; }
  ellipse[fill="none"] { stroke: #007cba; }
  ```
  It does **not** use a `* { stroke }` wildcard, and the doc explicitly explains
  why (lines 156-157, 314-315): the font glyphs are `<text fill=INK>` with default
  `stroke:none` (`fontGlyph`, `svg.js:154-163`), so a forced stroke would paint a
  fat ~8×-magnified outline around each clef/rest/accidental — the exact failure
  being removed. `stroke` is therefore scoped to already-stroked geometry only
  (`<line>` stems/ledgers via `line()` `svg.js:114-123`; the open-notehead ring
  `<ellipse fill="none">`). Verified safe.
- **Open noteheads are preserved.** `drawSpec`'s ellipse case emits
  `fill: isFilled ? INK : "none"` with `stroke: INK` (`svg.js:205-213`), so an
  open head is `<ellipse fill="none" stroke=INK>`. `*:not([fill="none"])` skips it
  (keeps the hole) and `ellipse[fill="none"] { stroke }` recolors only its ring.
  Confirmed; the only `fill="none"` child of a note `<g>` is the open notehead.
- **Recolor is correctly led as the cross-engine floor** (color is length-free →
  scale-invariant, paints on Safari where `outline` on a `<g>` no-ops); the
  `outline: 0.125px` hairline (review-4's `1px` ÷ the documented 8× scale) is the
  reinforcement on engines that paint it. The `SP_PX=8` coupling is a single,
  load-bearing-commented line and is called out as a risk. Sound.
- **Rejected alternatives are correctly excluded:** `non-scaling-stroke` (unreliable
  against viewBox scaling, not load-bearing), `getBBox()` rect (throws in this
  repo's jsdom; still needs a hard-coded stroke), `box-shadow`/`drop-shadow`
  (unreliable on `<g>` / soft blur). All consistent with the research.
- **A potential pitfall is benign here.** The per-event hit-rect is `fill:
  "transparent"` and would be matched by `*:not([fill="none"])`. But `SongCanvas`
  renders with **no `interactive` flag** (`SongCanvas.js:160-163`), so the editor
  canvas has no hit-rect to mis-fill — and this is also why the editor SVG is
  byte-identical to the front-end SVG apart from the post-render class. AC4 holds.

### Tree action buttons (Req 1 / AC1)

- All action buttons are `variant="tertiary"` today and become `secondary`;
  remove buttons keep `isDestructive` (`:218, :325, :490`). The label/disclosure
  buttons (`:193, :292, :400, :455`) stay `tertiary` by design. Confirmed line by
  line in `StructureTree.js`. `@wordpress/*`-only, test-neutral.

### Add-section relocation (Req 2 / AC2)

- Tree Add-section Button (`StructureTree.js:542-548`) removed; its `onAddSection`
  prop/JSDoc dropped. SectionPanel Add-section Button (`SectionPanel.js:145-147`)
  removed and its `onAddSection` prop (`:66, :74`) dropped; SectionPanel keeps
  Remove (`:148-154`). `SongPanel` (destructure `:122`, currently `{ song, system,
  onChange }`) gains `onAddSection` + an "Add section" Button. `edit.js` rewiring
  verified: drop from `<StructureTree>` (`:466`) and `<SectionPanel>` (`:516`),
  add to `<SongPanel>` (`:520`, which is outside the `{resolvedSelection && …}`
  gate at `:511`, so it is always mounted). The `onAddSection` handler
  (`:240-249`) is unchanged. Feasible and complete.

### Boundary (Req 4–5 / AC4–AC5)

- No `src/song/*`, `src/notation/*` (`svg.js` unchanged), `src/view.js`, or
  `src/render.php` change; no new dependency. `.is-selected` is editor-only and
  the editor `style.scss` never loads on the front end → published SVG
  byte-identical. Confirmed.

## Minor, non-blocking imprecisions (no fix required to proceed)

1. The prose says "7 per-row action buttons" but the enumerated line list holds
   **eight** (Section: `:212, :227, :241`; Measure: `:315, :336`; Hand: `:414`;
   Note: `:478, :506`). The line list — which is what the plan/coders follow — is
   correct and unambiguous; "7" is a count typo carried from the spec.
2. The test-impact pointers omit the `__tests__/` directory (the files live at
   `src/editor/__tests__/`, not `src/editor/`) and a couple are off by ~1 line.
   These are hints handed to the plan, not normative design; the file basenames
   and described targets are unambiguous (`StructureTree.test.js` add-section test,
   `SectionPanel.test.js` "add section" describe, `Edit.test.js` `selectLoneNote`
   retarget, and `SongPanel.test.js` — which exists — gains a new case).

Neither imprecision affects buildability or two-coder convergence; both are safe to
correct in passing during planning.

## Coverage matrix

- **Req 1 / AC1** — KD1: 8 action buttons → `secondary`; remove keeps
  `isDestructive`; labels stay quiet. ✓
- **Req 2 / AC2** — KD2: tree + SectionPanel Add-section removed; always-present
  SongPanel gains it, wired to `onAddSection`. ✓
- **Req 3 / AC3** — KD3: 8× viewBox magnification root-caused; recolor floor
  (stroke scoped off `<text>`) + `outline: 0.125px` hairline; thin, no layout
  shift, editor-only. ✓
- **Req 4 / AC4** — KD4: `svg.js`/`render.php`/`view.js`/schema unchanged; class
  editor-only; front-end byte-identical. ✓
- **Req 5 / AC5** — KD4: `@wordpress/*` + stock CSS/SVG only; no new dependency. ✓
