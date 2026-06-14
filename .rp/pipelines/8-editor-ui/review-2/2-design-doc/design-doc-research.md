# Design research — Review 2 (editor UI): selection fix, contextual add/remove, sidebar structure, note-language

Running record of the design Q&A driven by the design-doc-analyst with the
design-doc-researcher. Each topic frames the problem, lists options with
trade-offs, records the decision, and anchors it to a spec Requirement/AC. The
final design doc is written separately from this record.

Spec: `.rp/pipelines/8-editor-ui/review-2/1-spec/spec.md`
Live code under inspection: `src/` (current shipped canvas-first editor).

## Status

- [x] Topic 1 — Canvas selection bug: root cause + fix + regression-proof test
- [x] Topic 2 — Selection-contextual add/remove note
- [x] Topic 3 — Sidebar structure view (sections & measures)
- [x] Topic 4 — Song-level `language` field
- [x] Topic 5 — Conformant-by-construction, boundary, carry-overs

## Topics

### Topic 1 — Canvas selection bug: root cause, fix, and regression-proof test

**Spec anchor:** Req 1–3, AC1–AC2 (clicking a note/rest selects it and drives the
sidebar in the *real* editor; clicking empty space deselects; mouse-only).

**Frame.** The live editor already *implements* selection end-to-end — emit hooks
(`data-kind`/`data-hand`/`data-event-index` on each event `<g>`, `data-measure` on
the measure group), a container click listener, `selectionFromTarget` hit-test via
`target.closest('[data-kind="note"], [data-kind="rest"]')`, `decorateSelection`
adding `is-selected`, and inspector panels keyed off `resolvedSelection`. Yet the
spec states selection "does not work in practice." So the defect is not missing
wiring — it is that the wiring can't be *reached* by a real pointer.

**Root cause (confirmed, high confidence).** An SVG `<g>` has no intrinsic hit
geometry — only its *painted children* are pointer targets. A note group's only
ink is a thin `<line data-stem>` (x≈0.4) and a tiny `<ellipse data-notehead>`
(rx .6 / ry .5); the group's bounding box is mostly transparent gap between the
notehead and the stem foot. The notation paints staff lines first and event
groups on top (verified paint order), so a click that lands in that gap passes
*through* to the staff lines / SVG root, which are NOT inside any `[data-kind]`
group → `target.closest('[data-kind]')` returns `null` →
`selectionFromTarget` returns `null` → `onSelect(null)` → deselect. There is no
`pointer-events` rule anywhere in `src/` and the add-`<button>`s are a sibling
flex `div` (not an overlay), so neither masks the click — the gap *is* the bug.
Evidence (researcher, by building the layout + rendering into jsdom and reading
paint order): `src/editor/SongCanvas.js:106` (`selectionFromTarget`),
`src/notation/svg.js:704`/`:844` (note/rest group children), `src/style.scss`
(no `pointer-events`).

**Why every existing test is blind to it.** The jsdom unit test dispatches a
click whose `target` is forced to `group.firstChild`
(`src/editor/__tests__/SongCanvas.test.js:144`) — it can never reproduce the
missed-pixel case because it never tests a pixel. The Playwright e2e
(`specs/editor.spec.js:320`) uses `.click()`, which targets the element's
*bounding-box center* — for these note groups that center sits in the empty gap.
Confirmed concretely for the e2e seed note (`CONFORMANT_SONG`, a single quarter
C4, right hand): the group's children are a ledger `<line>` (y=1), a
`<line data-stem>` at x=1.6 (y 1→−2.5), and an `<ellipse data-notehead>` at
(cx 1, cy 1, rx .6 / ry .5); the bbox is x[0..2] y[−2.5..1.5], so its **center is
(1, −0.5)** — 1.5 sp above the notehead (far outside ry .5) and 0.6 sp from the
stem, landing on *no* ink. So the only existing "real browser" test is itself
clicking dead space — silently fragile (it could pass only if Playwright's
actionability retry nudges onto nearby ink, or it simply isn't run in CI, needing
wp-env/Docker). The test suite thus gives false confidence: the contract it pins
(`onSelect` fires for a click *on a child*) is not the contract a user exercises
(a click *in the event's region*).

**Options considered.**
1. **Per-event transparent hit-rect (chosen).** Emit one invisible, *filled*
   `<rect>` per note/rest, as a child of the event `<g>` — it carries NO `data-*`
   of its own (SVG has no attribute inheritance, and it must not duplicate them —
   see "Emit mechanics"); being a DESCENDANT of the `<g>` is what lets
   `target.closest('[data-kind]')` walk up from the rect to the group. The rect
   spans the event's column horizontally and the staff band vertically. Filled-but-transparent (`fill:transparent` / a `.is-hit` class with
   `fill:transparent;pointer-events:all`) makes the whole column a pointer target,
   so `target.closest('[data-kind]')` resolves for any click in the column. The
   geometry is layout-math-free in the emit layer (the rect reuses the per-event `x`
   the model already carries + the fixed staff height; exact sizing in "Emit
   mechanics" below). Keeps the existing `closest`-based hit-test,
   `selectionFromTarget`, `decorateSelection`, and `selectionQuery` unchanged.
   - *Trade-offs:* adds one element per event; must not paint over ink (transparent
     fill); must not extend so wide that adjacent columns overlap (use the column's
     own advance/width, clamped). Decoration still targets the `<g>` (the rect is
     inside it), so the outline is unaffected.
   - *Critical hittability detail (researcher-verified):* the rect must be
     genuinely pointer-hittable while invisible. `fill:none` or
     `visibility:hidden` are NOT hit-test targets, so they would re-create the bug.
     Use a transparent FILL (`fill:transparent` or `fill` set with `fill-opacity:0`),
     OR `fill:none` paired with `pointer-events:all`. The chosen form is a filled
     transparent rect (one attribute, no CSS dependency).
2. **`pointer-events: bounding-box` / `painted` tricks on the `<g>`.** Brittle and
   inconsistent across engines (`bounding-box` is not universally supported; a `<g>`
   has no box of its own without a child establishing one), and a bbox that's mostly
   gap still mis-targets between events. Rejected.
3. **Coordinate-based nearest-column hit-test.** Drop DOM ancestry; on a click,
   map the pointer's SVG coordinate to the nearest event column via the layout
   model. Most robust to ink shape but moves real geometry math into the editor
   (re-deriving columns the layout already computed), risks drifting from the
   core's numbering, and needs the inverse viewBox transform — heavier and more
   fragile than option 1. Rejected for this iteration (kept as a fallback note).

**Decision.** Option 1 — a per-event transparent, filled hit-rect emitted inside
each note/rest group, sized from the column X + staff-band Ys the layout already
provides. This makes the entire event column clickable, so a real pointer (and a
center-click) reliably resolves to the event, while leaving the hit-test,
decoration, and selection-state code paths intact.

**Ruled-out causes (researcher-verified — recorded so the fix isn't padded with
unnecessary changes).** None of these is the defect; the fix touches only the emit:
- *Gutenberg interception — NOT a cause.* The canvas wires only bubble-phase
  `click`/`keydown` (no `mousedown`, no capture handler); the block is already
  selected during the interaction (its panels are open), so no click-catcher
  overlay covers the SVG, and the `stopPropagation()` at `SongCanvas.js:293` is
  reached and correctly prevents the click from bubbling up to *deselect the block*
  (its stated purpose). *Caveat, not the bug:* on the very FIRST click into a
  not-yet-selected block, Gutenberg may consume that one click to select the block
  (a one-click warm-up). That is inherent to Gutenberg, unchanged by the hit-rect,
  and not the persistent "selection doesn't work" the spec describes — so it is
  accepted as-is, not designed around.
- *pointer-events / CSS — NOT a cause.* `grep -rn pointer-events src/` → zero hits;
  `__canvas-actions` is a sibling flex `<div>` below the SVG, not an overlay; the
  `<title>` is not hittable; font `<text>` glyphs are children inside the group, so
  clicking one actually *helps* resolution.
- *Listener lifecycle — NOT a cause.* Listeners attach once on the persistent
  container (`[]` deps), reading live values via `activateRef` reassigned each
  render; `replaceChildren` swaps only the SVG subtree (container + listeners
  persist) and runs in the draw effect, never synchronously mid-click, so the
  clicked target is read before any redraw. No staleness, no mid-interaction drop.

**Regression-proof test (beyond jsdom).** The bug's signature is "a click that is
*inside the event's selectable region but not on painted ink* fails to select."
Pin exactly that, at two altitudes:
- **e2e (real browser, the authoritative guard):** with the existing Playwright
  harness (`@wordpress/e2e-test-utils-playwright`, `specs/editor.spec.js`), click
  the event group at an explicit `position` that is inside its column but
  deliberately *off* the notehead/stem — `noteGroups(editor).first().click({
  position: { x, y } })`, where `position` is relative to the element's top-left so
  it can aim at a known-empty in-column pixel (e.g. the staff-gap above the
  notehead, the (1, −0.5)-equivalent point that today's bbox-center click already
  hits and fails on). Assert the Note panel populates + the group gains
  `is-selected`. With today's code that click resolves to `null`; with the hit-rect
  it selects — so the test *fails before* the fix and passes after. This is the
  assertion that distinguishes "has a hit-area" from "only the glyph is hittable,"
  which `.click()`-on-`<g>` (bbox center, untargeted) and jsdom both miss.
- **unit (fast guard on the emit):** two checks. (1) Structural: assert each
  note/rest group now *contains* a filled hit element covering its column (a
  transparent `<rect>` child with NO `data-*` of its own, resolving to the group
  via `closest`). (2)
  Behavioral: dispatch a synthetic click whose `target` is the HIT-RECT — i.e. NOT
  `group.firstChild` ink as `SongCanvas.test.js:144` does today — and assert
  `onSelect` still fires the right `{ sectionIndex, measureIndex, hand, eventIndex }`
  tuple. (Today's test forces the target onto a glyph child, which is exactly why it
  cannot catch the gap.) This pins the structural fix so a future change that drops
  the rect fails fast.

The two together close the gap the current suite leaves: the unit test guarantees
the hit element exists and is the resolvable target; the e2e test guarantees a real
pointer in dead space still selects.

**Emit mechanics (resolved with researcher — concrete contract).**
- *Emit site & ordering.* Append the hit-rect as the **first child** of each event
  `<g>` inside `renderNote` (`svg.js:704`) and `renderRest` (`svg.js:844`). Paint
  order (verified): a system paints `staff-lines → reserve → measures → texts`, and
  a measure paints `rightHand → leftHand → barlines`, so the event group (inside a
  hand group) paints AFTER the staff lines — the transparent rect therefore sits
  ABOVE the staff lines in the hit stack and wins for clicks in the gap. As first
  child the visible ink paints over it (fine — it's invisible), and being filled it
  is the pointer target across the whole column. *Why first-child, not last:* with
  the rect painted UNDER the ink, a click on a notehead/stem still has the GLYPH as
  the topmost element (`event.target` = the glyph), while the rect only wins in the
  empty interior — so the rect never shadows the ink. For TODAY's selection it makes
  no difference (`closest('[data-kind]')` resolves to the same `<g>` either way), but
  first-child keeps the door open for a future per-glyph interaction; last-child
  would paint the rect over the ink and make it `event.target` everywhere.
- *No `data-*` on the rect (important).* The rect carries NO `data-hand`/
  `data-event-index`/`data-kind`. Selection resolves via
  `target.closest('[data-kind]')` (`SongCanvas.js:110`) walking UP from the rect to
  the enclosing `<g data-kind>`, which already carries all three attributes
  (`svg.js:705-709` note / `:845-849` rest). Putting `data-hand`+`data-event-index`
  on the rect would create a DUPLICATE match for `selectionQuery`
  (`[data-hand][data-event-index]`, `selection.js:150`) and `querySelector` might
  pick the rect over the `<g>` — so the rect stays attribute-free. With that,
  `selectionQuery`/`decorateSelection` (`SongCanvas.js:161`) need **no change** and
  `is-selected` always lands on the `<g>`, never the rect. (Confirmed safe.)
- *Width (horizontal).* The note/rest record carries only `x` (the column center,
  measure-relative — `layout.js:1453` notes, rest x at `:1457-1462`); the per-column
  `advance` is computed in `measureSpacing` (`layout.js:804`) but NOT stamped on the
  event record. So size the rect to a **fixed sensible column width centered on
  `x`** (≈2 sp, one notehead column ± padding: `x = note.x − W/2`), keeping the emit
  layout-math-free. Slight overlap between very tight adjacent columns is harmless
  for selection (the rect only needs to cover the gap; visible ink still resolves to
  its own group). Threading the exact `advance` per event is possible but a layout
  change the emit deliberately avoids — not worth it this review.
- *Height (vertical).* Within `<g data-hand transform="translate(0 staffBottomY)">`
  the staff bottom line is local Y=0 and the top line is Y=`−STAFF_HEIGHT_SP`
  (`STAFF_HEIGHT_SP = 4`, `constants.js:25`), so the staff is local Y `[−4, 0]`.
  Extend the rect a generous margin N≈3–4 sp above/below — local Y `[−4−N, 0+N]`
  (height `4 + 2N`) — so ledgered notes (e.g. C4's notehead at local y=1, below the
  bottom line) and stems fall in the hit zone. N is a new design constant; the exact
  per-event vertical extent (`ledgerLinesFor`, `layout.js:163`) is more than needed.

**Editor-only emit (AC12 boundary) — DECIDED.** Both the editor (`SongCanvas`) and
the front end (`view.js:134`) render through the same `renderInto` →
`renderNote`/`renderRest`. To keep the published page provably unchanged
(AC12/Req 15), emit the hit-rect only in the editor — via an `interactive` flag on
the existing `renderSvg`/`renderInto` options object (`svg.js:235/275`), which the
editor sets and the front end (`view.js`) omits. *Threading cost (verified from the
call chain):* the options object is already the carrier —
`renderInto(container, model, options={})` (`svg.js:275`) forwards it wholesale to
`renderSvg(model, { accessibleName } = {})` (`svg.js:235`), which destructures the
new `interactive` field and threads it down the ONE spine that reaches events:
`renderSystem` (`:289`) → `renderMeasure` (`:516`) → `renderHand` (`:662`) →
`renderNote` (`:704`) / `renderRest` (`:844`). That is **5 functions to add a param
to and ~7 call sites to forward it** (renderSystem 1×, renderMeasure 1×, renderHand
2× — right+left at `:529/:537`, renderNote 1×, renderRest 1×, plus the
renderSvg→renderSystem loop at `:259`). No OTHER renderer (reserve, barline, span,
system-texts, standalone annotation, …) is touched — a narrow, single-purpose
thread that matches how `band`/`handKey`/`staffBottomY` already pass down the same
chain. **Decision:** thread the `interactive` flag — the front end simply omits it
(`view.js:134` passes only `{ accessibleName }`, defaults `interactive` false →
no rect → published DOM byte-identical to today); the editor passes
`{ accessibleName, interactive: true }`. This satisfies the STRICTEST reading of
AC12/Req 15 ("front-end SVG rendering… unchanged"), not merely visual identity.
**Documented fallback** if the ~7 edits are unwanted: emit the rect unconditionally
and record that AC12 is satisfied on *visual* identity (the front-end SVG looks
exactly the same; only an inert, invisible, attribute-free node is added, which
`view.js` never reads). A module-level/closure flag in `renderSvg` is explicitly
rejected (mutable module state contradicts the emit module's pure-function ethos —
worse than threading one param the same way the others are threaded).

### Topic 2 — Selection-contextual add/remove note

**Spec anchor:** Req 4–5, AC3–AC4 (with a note/rest selected, add a note and
remove the selected note; the HAND is inferred from the selection, no hand prompt;
controls use standard `@wordpress/components` button styling and may live on the
canvas, in the sidebar, or both; the insert position and the empty/first-note path
are design decisions).

**Frame.** Today the add model is the *opposite* of selection-contextual: the
canvas renders a per-hand × per-measure grid of "add note" buttons
(`SongCanvas.js:50-53`, `:318-358`, the `__canvas-actions` block) plus an
end-of-score "add measure" button, each carrying an explicit `(sectionIndex,
measureIndex, hand)`. The spec replaces that with two selection-driven controls
whose hand is *inferred* from the current selection. Remove already exists.

**What already works (reuse, not rebuild).**
- `edit.js onAddNote(sectionIndex, measureIndex, hand)` (`edit.js:150-170`) already
  does inferred-position insertion: when `resolvedSelection` matches that
  `(sectionIndex, measureIndex, hand)` it inserts at `eventIndex + 1`, else appends
  (`:154-161`), then *selects the new note* (`:169`) so its panel opens. It also
  already tolerates an empty hand (`const events = measure[hand] ?? []`, `:153`).
- "Remove note" already exists: `NotePanel.removeEvent` (`NotePanel.js:116-132`,
  button `:275-277`) — it removes the event, drops the hand key when the list
  empties, and calls `onRemove` to clear the selection. This satisfies AC4 as-is.

**Decision.**
1. **Add-note = pure reuse of `onAddNote` with the SELECTION's coords.** The new
   "Add note" control calls the existing `onAddNote(selection.sectionIndex,
   selection.measureIndex, selection.hand)` — the hand is the selection's hand, so
   it is *inferred*, never prompted (AC3). No new structural logic; the existing
   insert-after-and-select path is exactly the contextual behavior.
2. **Both controls live in the `NotePanel`, side by side.** "Add note" sits next to
   the existing "Remove note" (`NotePanel.js:275`), both standard `Button`s
   (Req 5). The NotePanel already receives `song` + `selection` (`NotePanel.js:91`);
   it takes one new `onAddNote` prop the parent wires to its existing handler. This
   is the simplest legible option and needs no new canvas plumbing. (Req 5 permits
   canvas/sidebar/both; sidebar-only is chosen for clarity and minimal surface — an
   optional canvas affordance is explicitly out for this review.)
3. **Insert position: AFTER the selected event** (the current `onAddNote`
   behavior). It is the intuitive "add another note here," the code already does it
   and selects the new note. End-of-hand would be surprising when a mid-measure
   note is selected. Kept.
4. **Remove the canvas add BUTTONS — but KEEP both handlers (researcher
   correction).** Drop the `HANDS` map + the `__canvas-actions` buttons
   (`SongCanvas.js:50-53`, `:318-358`: the per-hand add-note buttons AND the
   end-of-score add-measure button). `SongCanvas` becomes selection + decoration
   only. Crucially, do NOT drop the `edit.js` handlers `onAddNote` (`:150`) or
   `onAddMeasure` (`:174`): both are REUSED. `onAddNote` is reused by NotePanel's
   "Add note" (this topic) and by the structure-view first-note path; `onAddMeasure`
   is reused by the structure view's add-measure (Topic 3, Req 7/AC7). The mistake
   to avoid is conflating "drop the button" with "drop the handler" — only the
   canvas buttons go.
5. **Empty/first-note path → owned by the Topic-3 structure view.** With the canvas
   add grid gone, an empty measure/hand has no event to select, so contextual add
   can't bootstrap it. The mechanism is ready (`onAddNote` handles an empty hand;
   `newNote()` exists, `songModel.js:139`) — only an *entry point* is missing. The
   clean answer: the sidebar **structure view** exposes a measure-level "Add note"
   that defaults a hand (right hand) and calls `onAddNote(si, mi, "rightHand")`. This
   is the spec's direction (the structure view owns measure-level actions) and makes
   the first-note path a **hard dependency on Topic 3** — the structure-view "Add
   note" (or a transitional affordance) must land together with the canvas-grid
   removal so empty measures are never a dead end (logged under Risks).

**Tests that must move with this rework (so the change is honest, not silently
broken).**
- The existing e2e "adding a note on the canvas stores it in the chosen hand"
  (`specs/editor.spec.js:281-300`) clicks the per-hand canvas button
  ("Add note to right hand in measure 1") — and it is specifically the
  **first-note-into-the-seeded-empty-song** flow. With the canvas button gone it
  must be REWRITTEN as the **structure-view first-note path** (select the empty
  measure in the structure list → "Add note"), not deleted — so AC3 and this test
  both rest on the Topic-3 structure view. (A separate test covers the
  add-to-a-non-empty-selection path via NotePanel "Add note".)
- `SongCanvas.test.js` add-note / add-measure button tests (`:318-401`) are removed
  with the buttons; new coverage asserts NotePanel "Add note" calls `onAddNote` with
  the selection's `(sectionIndex, measureIndex, hand)` and that the new note is
  selected after. No production code other than `SongCanvas` consumed those buttons
  (researcher-confirmed): `edit.js` keeps passing `onAddNote`/`onAddMeasure` as
  props (`:233-234`), now to NotePanel + the structure view instead of canvas
  buttons.

**Conformant by construction (AC13).** Both paths emit only via `newNote()` +
`insertAt`/`removeAt` and commit through `commitSong` (`serializeSong.js:40`), which
re-validates — so every add/remove yields a schema-conformant song. (Carried into
Topic 5.)

### Topic 3 — Sidebar structure view (sections & measures)

**Spec anchor:** Req 6–9, AC5–AC8 (a browsable sidebar list of all sections and
their measures to MEASURE depth; add/remove sections and measures from it; selecting
a section/measure makes its settings editable AND highlights/scrolls to it on the
canvas; NO reordering).

**Frame.** Today there is no structure view. Sections/measures are reachable ONLY by
selecting an EVENT on the canvas, which then reveals `MeasurePanel`/`SectionPanel`
(`edit.js:238-260`). So an empty measure, or a section with no events, is
unreachable — and structural add/remove lives buried inside those event-gated panels
(`SectionPanel.addSection`/`removeSection` `:90-108`; `MeasurePanel.removeMeasure`
`:77-85`; `edit.js.onAddMeasure` `:174`). The structure view makes the whole
song browsable independent of any event selection, which is also the prerequisite
for the Topic-2 first-note path.

**Decision — five parts.**

1. **Selection model: tag the selection with a `kind`, and have `resolveSelection`
   resolve to that depth.** Extend the editor-only selection to
   `{ kind: "section" | "measure" | "event", sectionIndex, measureIndex?, hand?,
   eventIndex? }`. `resolveSelection` (`selection.js:101`) already resolves top-down
   (section `:114` → measure `:118` → event `:122`); change it to stop at the depth
   the `kind` names and return the deepest tagged object — `"section"` →
   `{ kind, section, sectionIndex }`; `"measure"` → `+ { measure, measureIndex }`;
   `"event"` → `+ { event, hand, eventIndex }`. A missing lower level still
   invalidates the whole thing (a measure selection whose section vanished → `null`),
   preserving the existing dependent-null chain. *Why this over a fully separate
   union:* least churn — the resolver is already a top-down chain, and the panels
   already read only their own sub-fields (`MeasurePanel` uses `{section, measure,
   sectionIndex, measureIndex}` `:55`; `SectionPanel` uses `{section, sectionIndex}`
   `:69`; only `NotePanel` needs `event`/`hand`/`eventIndex` `:92`). Today's event
   tuples become `kind:"event"` — backward compatible.
   - *Reconciling the pinned contract:* `selection.test.js:229-236` pins that a
     PARTIAL selection resolves to `null`. That stays true for an UNTAGGED partial
     (no `kind` = malformed → `null`); the `kind` discriminant is exactly what makes
     a measure-/section-only selection *well-formed*. The test is updated to assert
     "untagged partial → null" AND the new "tagged measure/section → resolves."
   - `globalMeasureNumber(song, si, mi)` (`selection.js:68`) is already kind-agnostic
     (si+mi only) — no change; serves the measure highlight directly.

2. **Panel gating by `kind`** (`edit.js:238-260`). Replace the single
   `resolvedSelection && (<Note/><Measure/><Section/>)` with kind-keyed conditionals:
   `SongPanel` always; `SectionPanel` for every kind (every kind has a section);
   `MeasurePanel` for `"measure"`+`"event"`; `NotePanel` for `"event"` only. So a
   measure selection shows Measure+Section (no Note), a section selection shows
   Section only, and an event selection shows all three (today's behavior preserved).

3. **Lift the four structural mutators to `edit.js`** (the single owner of `working`
   + `commit`): `onAddSection`, `onRemoveSection`, `onAddMeasure(sectionIndex)`,
   `onRemoveMeasure(sectionIndex, measureIndex)` — each the same immutable
   `insertAt`/`removeAt`/`replaceAt` + `newSection`/`newMeasure` splice the panels do
   today, written ONCE and passed to BOTH the structure list and the panels (the
   panels drop their local copies). `onAddMeasure` gains a `sectionIndex` arg (today
   it hardcodes the last section, `:175`) so the list can target a specific section.
   Selection-fallout is lifted too (removing the selected section/measure clears or
   re-targets the selection, as the panels' `onRemove` → `setSelection(null)` does
   today at `:245/:251/:257`). This de-duplicates the three scattered copies.

4. **Canvas highlight + scroll (AC8) — measure direct, section DERIVED, no emit
   change.** The emit carries `data-measure` (1-based GLOBAL number, `svg.js:519`)
   and `data-system` (`svg.js:294`) but **NO `data-section`** (sections are flattened
   away in layout). So:
   - *Measure highlight:* `globalMeasureNumber(song, si, mi)` → N, decorate the
     `[data-measure="N"]` group.
   - *Section highlight:* DERIVE editor-side — filter `measureCoords(song)`
     (`selection.js:42`) to the target `sectionIndex` to get that section's global
     measure numbers, then decorate each `[data-measure="K"]`. Add a small helper
     (e.g. `measureNumbersForSection(song, si)`) beside `globalMeasureNumber`. **No
     emit change** — keeps the front end byte-identical (AC12), consistent with the
     Topic-1 boundary discipline. (The alternative — emitting `data-section` on the
     measure group — is rejected: it would touch the shared emit and need the same
     `interactive`-style gating to keep the front end unchanged; derivation is
     lower-touch and front-end-neutral.)
   - *`decorateSelection` (`SongCanvas.js:161`) branches by `kind`:* event → today's
     scoped `selectionQuery` node; measure → the one `[data-measure="N"]` group;
     section → the set of `[data-measure="K"]` groups.
   - *CSS: a NEW class for measure/section highlight* (e.g. `is-active-measure` /
     `is-active-section`), distinct from the event `is-selected` outline
     (`style.scss:54`), so a whole-measure/section box doesn't clash with the event
     outline.
   - *Scroll:* `group.scrollIntoView({ inline: "nearest", block: "nearest" })` on the
     measure group (the section scrolls its FIRST measure into view), run after the
     group is located in the draw effect (it already `querySelector`s the group,
     `SongCanvas.js:173`). `scrollIntoView` on an SVG child can be flaky across
     engines, so the documented fallback is coordinate-based:
     `getBoundingClientRect()` (or the group's model translate X) → set
     `host.scrollLeft` on the `overflow-x:auto` host (`style.scss:49`).

5. **List component — reuse the existing list pattern; WordPress-only.** Housed in a
   new `PanelBody title="Structure"` (matching the other panels, e.g.
   `SongPanel.js:148`) rendered in `InspectorControls` **always** (alongside
   `SongPanel`), so the song is browsable with nothing selected — that satisfies AC5
   and is the entry point for the first-note flow. The list MIRRORS
   `AnnotationList.js`'s controlled row + trailing `AddButton` pattern
   (`AnnotationList.js:49-74`; `AddButton` is the only thing `ListControls.js`
   provides, `:24-30`): a `StructureList` whose rows are sections (each a select
   `Button` + a remove `Button icon="trash"` + a nested measure list) and a trailing
   "Add section" `AddButton`; each section's measure sub-list is the same shape (rows
   = measures with select + remove, trailing "Add measure" `AddButton`). Selecting a
   row calls `setSelection({ kind, sectionIndex, measureIndex })`; the selected row's
   active state uses `isPressed` / `aria-current` on the row button. All
   `@wordpress/components` — satisfies Req 19, no new dependency. Notes are NOT listed
   (measure depth only, Req 6); no move controls (Req 9).

**Unlocks the Topic-2 first-note path.** The measure row exposes an "Add note" that
defaults a hand (rightHand) and calls the lifted `onAddNote(si, mi, "rightHand")`
(which already handles an empty hand, `edit.js:153`) — so an empty measure (incl. the
seeded `newSong()` one) is no longer a dead end, and the canvas add buttons can be
fully removed.

**Conformant by construction (AC6/AC7/AC13).** Add/remove section/measure use only
`newSection`/`newMeasure` + `insertAt`/`removeAt` and commit through `commitSong`,
which re-validates — every structural edit stays schema-conformant. A section's
`measures` is `required` but may be empty, and `sections` may be empty, so removing
the last measure/section is allowed and still validates (`MeasurePanel.js:73-76`
note; `SectionPanel.js:98-101` note).

**Test impact.** `selection.test.js`: the existing `{ sectionIndex, measureIndex }`
→ `null` pin (`:233-235`) must be UPDATED — once selections are kind-tagged, a
`{ kind: "measure", sectionIndex: 0, measureIndex: 0 }` should resolve to a measure,
not null. The untagged/malformed-partial → null behavior stays the default (a
selection with no `kind`, or a `kind:"event"` missing hand/eventIndex, → null), so
the contract is preserved for malformed input; only that test's interpretation of a
bare `{si,mi}` shifts. Add tagged measure/section resolve cases + the
`resolveSelection` kind branches. `Edit.test.js:190/200/305/348/361` (panel gating by
kind; the migrating add-button tests from Topic 2); new tests for the `StructureList`
(add/remove section+measure, select sets the kind-tagged selection, the first-note
flow) and for the measure/section canvas decoration (the new classes land on the
right `[data-measure]` group(s)). The e2e gains: list shows all sections/measures
(AC5), add/remove from the list (AC6/AC7), select highlights the canvas + opens the
right panels (AC8).

### Topic 4 — Song-level `language` field

**Spec anchor:** Req 10–15, AC9–AC12 (a stored song-level `language` for Spanish /
English that round-trips and validates; a Song-panel selector; switching CONVERTS
every note name to the chosen language; controls display note names in the song's
language; initial language inferred from spellings, new song defaults to English;
the front end ignores `language` and renders unchanged).

**Frame.** Review-1 already built the conversion *primitives* but never stored the
language: `noteNames.js` infers the system from pitch spellings
(`inferNoteNameSystem`, returns exactly `"english"`/`"spanish"`), offers a system's
options (`noteNameOptions`), and converts one step (`stepInSystem`, idempotent +
canonicalizing). Today the system is *only* inferred (`edit.js:127`), the SongPanel
ignores its `system` prop (`_system`), and there is no stored field, no selector, no
song-wide conversion. Review-2 adds the stored field + the selector + the conversion,
reusing those primitives.

**Decision — five parts.**

1. **Schema: add `language: { enum: ["spanish", "english"] }` to the root
   `properties`** (`schema.js:29-43`), no `required` change. The generic `enum`
   walker (`validate.js:120`) accepts a valid value and emits the friendly "is not
   one of the allowed values […]" for a typo; since raw JSON stores unconditionally
   (`edit.js:97/213`), a bad value still never blocks saving (AC14). **Use the
   `SYSTEMS` keys `"spanish"`/`"english"` (not ISO `es`/`en`):** they equal the
   strings `inferNoteNameSystem` returns and `SYSTEMS` is keyed by
   (`noteNames.js:32-35/94-101`), so `language` === `system` with zero translation —
   `system = working.language ?? inferNoteNameSystem(working)` and
   `stepInSystem(step, working.language)` compose directly. ISO codes would force a
   needless `language↔system` lookup; the field is editor-internal and the spec says
   "values for Spanish and English," not a locale standard.

2. **Source of truth: `system = working.language ?? inferNoteNameSystem(working)`**
   (replacing the bare infer at `edit.js:127`). A stored `language` is authoritative;
   inference is the fallback only when the field is absent — exactly AC10's "infer
   the initial language from spellings if no field." Field/pitch disagreement is
   avoided because the conversion (part 3) rewrites every pitch whenever `language` is
   set, so a stored `language` always agrees with the pitches it produced; the only
   way to desync is a hand-edited raw JSON (`language:"english"` with `do` pitches),
   where `language` wins for what the controls DISPLAY and the next edit/conversion
   reconciles — acceptable (raw JSON is the escape hatch).

3. **Conversion on switch (AC9): rewrite EVERY `pitch.step` via `stepInSystem`, set
   `language`, commit — `pitch.step` ONLY (alters keys stay English-canonical).**
   The Song-panel selector's `onChange` runs a pure `mapSong` that walks
   `sections[].measures[].{rightHand,leftHand}[].pitches[].step` (the same paths
   `stepsOf` reads, `noteNames.js:55` — but a structural immutable map, since
   `stepsOf` is a read-only generator), applies `stepInSystem(step, target)`
   (idempotent, canonicalizes — `noteNames.js:129`), sets `language: target`, and
   commits via the existing `commitSong` path (conformant by construction).
   - *Scope decision — A (steps-only), decided over B (also convert
     `handConfig.alters` keys).* Two pieces of evidence make A both correct and
     contradiction-free:
     - (i) The visual editor can only ever WRITE English-letter alters keys:
       `HandConfigEditor` offers `ALTER_KEY_OPTIONS = ["C"…"B"]` for the alters-key
       `SelectControl` (`HandConfigEditor.js:36/147`) and `nextUnusedNote` draws only
       from those (`:42`). So converting alters keys to Spanish (option B) would be
       reverted to English the instant the author touches that hand config — B fights
       HandConfigEditor.
     - (ii) The RENDERER normalizes alters keys through `normalizeStep`:
       `normalizeAlters` does `normalizeStep(key)` for every key (`layout.js:590-598`,
       `:596`) and builds the key-signature-like cluster from the canonical letters
       (`:1017-1027`). So `{ do: 1 }` and `{ C: 1 }` render IDENTICALLY — an alters
       key is an internal alteration map keyed by canonical letter, NEVER displayed as
       a spelled note name. Converting alters keys would change stored bytes but not a
       single rendered glyph.
     - *Therefore AC9's "every note name in the stored song" is satisfied by
       steps-only*, reading "note name" as the DISPLAYED/authored spelling (pitches —
       the only note names a reader sees differ by language). alters keys are an
       internal, English-canonical alteration map, decoupled from display spelling by
       design (HandConfigEditor writes English; the renderer normalizes any spelling
       to English). Option B-minimal (convert keys only) is *incoherent* (the
       HandConfigEditor SelectControl would show a value not in its options); option
       B-full (convert keys AND thread `system` into HandConfigEditor, swap
       `ALTER_KEY_OPTIONS` for `noteNameOptions(system)`, add `displayedStep`-style
       mapping for `row.note`, make `nextUnusedNote` language-aware, update its tests)
       is real added scope on an ADVANCED progressive-disclosure field (alters lives
       behind the SongPanel/SectionPanel ToolsPanel) for ZERO visible benefit —
       because the renderer normalizes keys (evidence ii), a converted vs unconverted
       alters key renders the SAME glyph, so B-full changes stored bytes + editor
       plumbing but not one rendered note. Rejected. *Trigger to revisit:* only if a
       future requirement explicitly wants alters keys SPELLED per-language (then
       adopt B-full at the cost above; note it still yields no rendering change).
     - *Recorded behavior:* a raw-JSON Spanish alters key still VALIDATES (the
       validator's `isNoteName` accepts both systems, `validate.js` `checkAlters`) and
       still RENDERS correctly (normalized) — it is simply never produced by the
       visual controls and not touched by conversion.

4. **Selector + display (Req 11/13): a `SelectControl` in the SongPanel.** The
   always-present SongPanel already receives `system` (currently ignored as
   `_system`, `SongPanel.js:110`); the selector shows `system` and its `onChange`
   runs the part-3 conversion + commit. The pitch controls already display in the
   song's system (`PitchEditor` uses `noteNameOptions(system)` +
   `stepInSystem(pitch.step, system)`, `PitchEditor.js:41/58`) — so once `system`
   reads `working.language`, every note-name control follows the stored language
   (Req 13) for free.

5. **Default on insert (AC10): default by INFERENCE, do NOT stamp `language` in
   `newSong()`.** `newSong()` (`songModel.js:178`) seeds `{ sections: [...] }` with
   no pitches, so `inferNoteNameSystem` already returns `"english"` — the editor SHOWS
   English, satisfying AC10's observable default. Stamping `language:"english"` would
   break the lazy-seed contract (the block stores `""` until a real edit,
   `edit.js:116-123`; the e2e pins this at `editor.spec.js:261-279`) and wouldn't even
   persist without forcing a mount-commit (which the design avoids). The `language`
   key is written on the first language switch (part 3); a top-level `language`
   survives every later visual edit because all panels emit `{ ...song, … }` spreads
   and `emitBlock` does `{ ...song, [key]: value }` — none rebuilds from scratch
   (verified: `NotePanel.js:107`, `MeasurePanel.js:67`, `SectionPanel.js:75/93/105`).

**Round-trip + front-end boundary (AC11/AC12 — zero front-end change).** `language`
round-trips through raw JSON: validation is permissive (`additionalProperties` not
enforced) and the enum accepts the value, so `validateSong` returns `[]` (no error),
and even an invalid value is stored unconditionally (AC11/AC14). The front end is
untouched: `render.php:30-41` treats `song` as an opaque string (escapes only `<`,
`:39`) and emits it verbatim in the inert `<script>` — zero parsing — so `language`
rides along and changes no rendering (AC12), with NO `render.php` change. Verified no
front-end code reads `language` (`grep -rn language src/ --include=*.js --include=*.php`
excl. tests → zero hits; `view.js` reads only `metadata` + `sections`). So AC12 holds
by construction — consistent with the Topic-1 front-end-parity discipline.

**Conformant by construction (AC13).** The selector emits only the two enum values;
the conversion emits only `stepInSystem` output (always a recognised name) + the
enum `language`, committed through `commitSong`'s re-validation. So every language
edit yields a schema-conformant song.

**Test impact.** `schema.test.js`/`validate.test.js` (the `language` enum accepts
`"spanish"`/`"english"`, rejects-with-message a typo, doesn't block; round-trip
preserves it); `noteNames`/a new `mapSong` converter test (song-wide `pitch.step`
conversion is complete + idempotent + leaves alters keys untouched);
`SongPanel.test.js` (the selector renders, switching converts every pitch + stores
`language`); `Edit.test.js` (`system = language ?? infer`); e2e (AC9 switch converts
+ persists; AC10 Spanish-spelled legacy song shows Spanish, new block shows English;
AC11 raw-JSON round-trip; AC12 front-end unchanged).

### Topic 5 — Conformant-by-construction, boundary, and carry-overs (audit)

**Spec anchor:** Req 16–19 (conformant by construction; raw JSON unchanged;
progressive disclosure + live re-render + all other review-1 behavior preserved;
WordPress-only dependencies) and the Out-of-Scope list. This topic is a cross-cutting
AUDIT: it confirms the Topics 1–4 decisions satisfy these constraints rather than
introducing new design. All confirmed (researcher-verified, file:line).

- **Req 16 — Conformant by construction (AC13).** `commit = commitSong(nextWorking,
  onChangeSong)` (`edit.js:144`) is the SINGLE visual-commit path; `commitSong`
  (`serializeSong.js:40`) serializes then RE-VALIDATES, refusing to persist a
  non-conformant string. Every visual mutation routes through it: `onAddNote`/
  `onAddMeasure` call `commit` (`edit.js:168/188`); every panel takes `commit` as
  `onChange` (`:237/241/247/253`). The NEW mutations route the same way — the lifted
  structure handlers (Topic 3) and the language conversion (Topic 4) both build a
  conformant working object (via `newX` + `insertAt`/`removeAt`/`replaceAt` +
  `stepInSystem`, all recognised-output) and hand it to `commit`. So no visual control
  can persist a non-conformant song; the guard always passes.
- **Req 17 — Raw JSON unchanged (AC14).** The JSON-mode branch (`edit.js:205-223`) is
  untouched by Topics 1–4: `onChangeSong` persists the raw string unconditionally
  (`:97`), the error `Notice` is presentational (`:218-222`), nothing blocks saving.
  The only schema change is the additive `language` enum — a typo'd value adds ONE
  informational "not one of the allowed values" line but, because JSON mode stores
  unconditionally, never blocks (AC14).
- **Req 18 — Disclosure / live re-render / review-1 preserved.**
  - *Live re-render intact:* `commit` → `setAttributes({ song })` → `working`
    re-parses (`edit.js:118-123`, memo on `song`) → the `SongCanvas` draw effect
    re-runs on the `song`/`selection` change (`SongCanvas.js:221-245`). Topics 1–4
    don't touch this loop (the hit-rect is inside the existing draw; the new selection
    kinds still flow `setSelection` → `resolvedSelection` → props).
  - *Disclosure consistent:* the language selector is a COMMON Song-level control
    (visible in SongPanel, like tempo/time-sig); section/measure overrides stay behind
    their ToolsPanels (`SectionPanel.js:114`/`MeasurePanel.js:102`); the new Structure
    panel is an always-present BROWSE panel (navigation, not a buried setting). No
    uncommon setting is promoted, no common one buried.
  - *Changes localized — review-1 behavior preserved:* the changes are confined to
    selection emit (the editor-gated hit-rect in `renderNote`/`renderRest`), inspector
    panels (+Structure panel, +"Add note", +language selector), and selection state
    (the `kind` tag). NOT touched: `accessibleName`/`<title>` (computed in
    `edit.js:102-111` from metadata, passed unchanged to `renderInto`); the
    `ResizeObserver` (`SongCanvas.js:250-272`, independent effect); the font-ready gate
    (`drawWhenFontReady`, `SongCanvas.js:80-90/244`); the invalid-state routing
    (`edit.js:133-134/224-225` → `InvalidState`). Removing the canvas add buttons only
    deletes the `__canvas-actions` block + its props; the editor-only `interactive`
    flag keeps the front-end emit byte-identical (Req 15).
- **Req 19 — WordPress-only dependencies (AC15).** Every production import under
  `src/editor/**` + `src/edit.js` is `@wordpress/*` (`components`, `element`, `i18n`,
  `block-editor`) or a local relative path; the only non-`@wordpress/*` imports
  (`react`/`react-dom/client`) appear EXCLUSIVELY in `__tests__/*` (test harness, not
  runtime). The new UI uses only `Button`/`SelectControl`/`PanelBody`/`ToolsPanel` +
  `@wordpress/element`/`i18n` — all already in use, no new runtime dependency.

**Out-of-scope scan — none crossed.** (1) Front end consuming `language` — not done
(stored + round-trips only; nothing reads it). (2) `render.php` / front-end SVG —
unchanged (opaque string; the `interactive` flag keeps the emit byte-identical).
(3) Reordering — not added (structure view is add/remove/select only). (4) Listing
individual notes in the structure view — not done (measure depth only; notes stay on
the canvas). (5) Canvas keyboard selection — not added (the existing Enter/Space
keydown is review-1's; Topics 1–4 add a mouse-only hit-rect). (6) Selecting a
measure/section by clicking the canvas — not added (structure-view → canvas highlight
is one-way; a canvas click still resolves to an EVENT only). (7) Audio — untouched.
(8) Best-effort invalid-song loading / large-song perf — untouched. *Deliberate
non-crossing:* the section-highlight DERIVATION (via `measureCoords`, no `data-section`
emit) was specifically chosen to avoid touching the front-end emit, so even the
highlight feature stays inside the Req 15 boundary.

**Sequencing note (carry-over to the plan/code phases).** The one cross-topic
ordering constraint: the canvas add-buttons removal (Topic 2) must land TOGETHER with
the structure-view "Add note" (Topic 3), never before — otherwise an empty measure
(incl. the seeded `newSong()` one) has no first-note entry point. Logged under Risks.

## Coverage — every Requirement and AC traced to a decision

Self-check that the design addresses the whole spec. Each row names the deciding
Topic.

| Spec item | Where decided |
|---|---|
| Req 1 / AC1 — click note/rest selects, drives sidebar (real editor) | T1 (hit-rect fix) |
| Req 2 / AC2 — click empty space deselects | T1 (empty-area click → `onSelect(null)`, unchanged + now reachable) |
| Req 3 — mouse click sufficient, no canvas keyboard select | T1 (mouse-only hit-rect; existing keydown unchanged) |
| Req 4 / AC3 — add note, hand inferred | T2 (`onAddNote` with selection's hand) |
| Req 4 / AC4 — remove selected note | T2 (existing `NotePanel` Remove note) |
| Req 5 — controls legible, `@wordpress/components`, canvas/sidebar/both | T2 ("Add note" in NotePanel) |
| Req 5 — insert position + first-note path are design decisions | T2 (insert-after; first-note via T3) |
| Req 6 / AC5 — sidebar lists all sections + measures (measure depth) | T3 (StructureList) |
| Req 7 / AC6 — add/remove section from list | T3 (lifted `onAddSection`/`onRemoveSection`) |
| Req 7 / AC7 — add/remove measure from list | T3 (lifted `onAddMeasure(si)`/`onRemoveMeasure`) |
| Req 8 / AC8 — select section/measure → edit settings + highlight/scroll canvas | T3 (kind selection + panel gating + derived highlight + scroll) |
| Req 9 — no reordering | T3 (add/remove/select only) |
| Req 10 / AC11 — `language` field stored, round-trips, validates | T4 (schema enum; permissive validate) |
| Req 11 — Song panel language selector | T4 (`SelectControl` in SongPanel) |
| Req 12 / AC9 — switching converts every note name + stores `language` | T4 (`mapSong` over `pitch.step` via `stepInSystem`) |
| Req 13 — note-name controls display in song's language | T4 (`system = language ?? infer`; PitchEditor already in-system) |
| Req 14 / AC10 — initial inference; new/empty defaults English | T4 (`?? inferNoteNameSystem`; no `newSong()` stamp) |
| Req 15 / AC12 — schema relaxed only for `language`; render.php + front end unchanged | T1 (editor-only emit) + T4 (opaque render.php; nothing reads `language`) |
| Req 16 / AC13 — conformant by construction | T5 (all edits → `commitSong` re-validate) |
| Req 17 / AC14 — raw JSON never blocks saving | T5 (JSON branch untouched; enum only informational) |
| Req 18 — progressive disclosure, live re-render, review-1 behavior preserved | T5 (disclosure consistent; draw loop intact; changes localized) |
| Req 19 / AC15 — WordPress-only deps | T5 (only `@wordpress/*` + local; react only in tests) |



## Open Questions

_(All topic sub-questions resolved and folded into their Topic sections. None
outstanding for the design — remaining items are implementation-phase choices noted
inline, e.g. the Topic-1 editor-only-flag vs. unconditional-emit fallback, and the
list-component polish option `__experimentalItemGroup` over plain `Button` rows.)_

## Risks

- **Front-end hit-rect leak — MITIGATED by the editor-only `interactive` flag**
  (Topic 1 decision). If the documented fallback (unconditional emit) is taken
  instead, the front end gains one inert, invisible, attribute-free `<rect>` per
  event; AC12 still holds as *visual* identity ("renders a given song's notes
  exactly as before") and `view.js` never reads the node. Either path is AC12-safe;
  the flag path is provably byte-identical.
- **Dropping the canvas add buttons before the structure view exists would strand
  empty measures.** The first-note path depends on Topic 3. Sequencing risk for the
  plan/code phases: the structure-view "Add note" (or a transitional canvas
  affordance) must land together with the canvas-button removal, never before.
