# Design doc — Review 2 (editor UI): working selection, contextual add/remove, sidebar structure, note-language

## Overview

The Piano block ships a **canvas-first** editor: the rendered grand-staff is the
interactive surface, the author selects a note/rest on it, and settings are edited
in the block's right-hand inspector sidebar. Raw-JSON editing remains behind a
toolbar toggle. The block persists exactly one thing — a single `song` JSON string —
and the editor parses it into a working object, mutating it through one re-validating
commit path.

This review fixes and extends that editor along four axes:

1. **Selection on the canvas does not work in practice** and is fixed so that
   clicking a note/rest in the *real* editor selects it and drives the sidebar.
2. **The add/remove model is reworked.** The on-canvas grid of add buttons is
   replaced by **selection-contextual add-note / remove-note** controls (the hand is
   inferred from the selection), and **section/measure management moves into the
   sidebar** as a browsable Structure list.
3. **A song-level note-language setting** (Spanish/English) is added: it is **stored
   in the song**, the editor shows note names in that language, and switching it
   **converts** every existing note name to the chosen language.
4. **The format boundary is held.** The only song-format change is the additive
   `language` field. `render.php` and the front-end SVG rendering are unchanged this
   iteration; a published page renders a given song's notes exactly as before, and
   the front end ignores `language` (consuming it is future work).

The notation core is reused, not rebuilt; every visual edit stays
conformant-by-construction by routing through the single re-validating commit.

## Approach

The work is intentionally **editor-side and additive**. The notation render path
(`buildLayoutModel` → `renderInto` → `renderNote`/`renderRest`), the schema, the
front-end entry (`view.js`), and `render.php` are touched as little as possible:

- The **selection fix** adds one invisible, pointer-hittable element per event,
  emitted **editor-only** behind a new `interactive` flag so the front-end SVG stays
  byte-identical.
- **Add/remove** reuses the existing `onAddNote`/remove handlers verbatim, moving
  the *triggers* into the sidebar and inferring the hand from the selection.
- The **Structure view** adds a sidebar list and lifts the already-existing
  structural mutators into one owner, deriving the canvas highlight editor-side
  (no new emit).
- **Note-language** adds one schema enum field, reads it as the source of truth for
  the note-name system (falling back to inference), and converts pitches on switch
  using primitives review-1 already built.

Across all four, the single commit path (`commitSong`) re-validates, so no visual
control can persist a non-conformant song.

## Components

### Existing components and their roles (for context)

- **`src/edit.js`** — the editor's mode container. Owns the working object, the
  editor-only `selection` state, the `commit` path, and the structural handlers
  (`onAddNote`, `onAddMeasure`). Branches between visual mode (canvas + inspector
  panels) and JSON mode (raw textarea). Routes a non-empty invalid song to
  `InvalidState`.
- **`src/editor/SongCanvas.js`** — the interactive sheet-music surface. Builds the
  layout, renders into an SVG, hit-tests clicks to a selection, decorates the
  selected group, and (today) layers the on-canvas add buttons.
- **`src/editor/selection.js`** — selection resolution and the measure-flatten
  helpers (`resolveSelection`, `measureCoords`, `globalMeasureNumber`,
  `selectionQuery`).
- **`src/editor/inspector/*`** — `SongPanel`, `SectionPanel`, `MeasurePanel`,
  `NotePanel`. Each reads its slice of the resolved selection and commits edits.
- **`src/editor/noteNames.js`** — note-name primitives:
  `inferNoteNameSystem(song)` (returns `"english"`/`"spanish"`),
  `noteNameOptions(system)`, `stepInSystem(step, system)` (converts one step,
  idempotent + canonicalizing).
- **`src/notation/svg.js`** — the shared emit (`renderInto` → `renderSvg` →
  `renderSystem` → `renderMeasure` → `renderHand` → `renderNote`/`renderRest`),
  used by *both* the editor and the front end.
- **`src/song/schema.js` / `validate.js`** — the song schema and its permissive
  validator.

### New / changed components in this review

- **Hit-rect emit** (in `renderNote`/`renderRest`) — a per-event invisible hittable
  `<rect>`, emitted only when an `interactive` flag is set.
- **`StructureList`** (new, `src/editor/inspector/`) — the sidebar sections→measures
  browser with add/remove/select.
- **Lifted structural mutators** in `edit.js` — `onAddSection`, `onRemoveSection`,
  `onAddMeasure(sectionIndex)`, `onRemoveMeasure(sectionIndex, measureIndex)`.
- **Kind-tagged selection** — `selection.js` and `SongCanvas.js` decoration extended
  to `kind: "section" | "measure" | "event"`.
- **Language selector** in `SongPanel` plus a song-wide `mapSong` pitch converter.
- **`language` enum field** in the schema.

## Interfaces and data flow

### Selection (canvas → sidebar)

1. The author clicks the SVG. The container's bubble-phase `click` listener reads
   `event.target`.
2. `selectionFromTarget(target, song)` walks up via
   `target.closest('[data-kind="note"], [data-kind="rest"]')` to the event `<g>`
   (which carries `data-hand` + `data-event-index`), then up to the enclosing
   `[data-measure]` group (1-based global measure number), and maps that number
   through `measureCoords(song)` to `(sectionIndex, measureIndex)`.
3. The resulting `{ kind: "event", sectionIndex, measureIndex, hand, eventIndex }`
   (or `null` for empty space) is passed to `onSelect` → `setSelection` in
   `edit.js`.
4. `resolveSelection(working, selection)` produces `resolvedSelection`, which gates
   and feeds the inspector panels and re-decorates the canvas on the next draw.

The fix (below) makes step 1's target reliably inside a `[data-kind]` group for any
click in the event's column.

### Structure list (sidebar → canvas highlight)

1. A row click calls `setSelection({ kind, sectionIndex, measureIndex? })`.
2. `resolveSelection` resolves to the tagged depth; panel gating shows the right
   panels.
3. `SongCanvas`'s decoration branches on `kind`: it derives the target
   `[data-measure="N"]` group(s) and applies a highlight class + `scrollIntoView`.

### Language (selector → song-wide conversion)

1. The `SongPanel` `SelectControl` `onChange(target)` runs `mapSong`, rewriting every
   `pitch.step` via `stepInSystem(step, target)` and setting `language: target`.
2. The result commits through `commitSong`, which re-validates and persists.
3. On every render, `system = working.language ?? inferNoteNameSystem(working)`, so
   all note-name controls display in the stored language.

### Commit path (the single mutation spine)

Every visual mutation builds an immutable next working object and calls
`commit(next)` → `commitSong(next, onChangeSong)` (`serializeSong.js:40`), which
serializes, **re-validates**, and only then persists via `setAttributes({ song })`.
That re-parse re-runs the memos and the `SongCanvas` draw effect — the live
re-render loop — unchanged by this review.

## Key decisions

### KD1 — Selection fix: per-event transparent hit-rect, emitted editor-only (Req 1–3, 15; AC1, AC2, AC12)

**Problem.** The editor already implements selection end-to-end — emit hooks,
container click listener, `selectionFromTarget` hit-test, `decorateSelection`,
inspector panels — yet selection "does not work in practice." The defect is not
missing wiring; it is that the wiring **cannot be reached by a real pointer**.

**Root cause (verified).** An SVG `<g>` has no intrinsic hit geometry — only its
*painted children* are pointer targets. A note group's only ink is a thin
`<line data-stem>` and a tiny `<ellipse data-notehead>`; the group's bounding box
is mostly transparent gap. The notation paints staff lines first and event groups on
top, so a click landing in that gap passes *through* to the staff lines / SVG root,
which are not inside any `[data-kind]` group → `target.closest('[data-kind]')`
returns `null` → `selectionFromTarget` returns `null` → deselect. There is no
`pointer-events` rule anywhere in `src/`, and the add-buttons are a sibling flex
`<div>` (not an overlay), so neither masks the click — the gap *is* the bug.
For the e2e seed note (a single quarter C4, right hand), the group's bbox center is
`(1, −0.5)` — 1.5 sp above the notehead and off the stem, landing on no ink; this is
exactly where Playwright's `.click()` (bbox-center) and the jsdom unit test (which
forces `target = group.firstChild`) fail to exercise the real path.

**Decision.** Emit **one invisible, *filled* transparent `<rect>` per note/rest**, as
the **first child** of the event `<g>`. Being a *descendant* of the `<g>` lets
`target.closest('[data-kind]')` walk up from the rect to the group, so the whole
event column becomes a pointer target.

- **Hittability (critical).** The rect must be genuinely pointer-hittable while
  invisible. `fill:none` and `visibility:hidden` are **not** hit-test targets (they
  would re-create the bug). The chosen form is a **filled transparent** rect
  (`fill:transparent`, equivalently `fill` with `fill-opacity:0`), needing no CSS
  dependency. (`fill:none` + `pointer-events:all` is an equivalent fallback.)
- **First-child, not last.** Paint order has the event group paint *after* the staff
  lines, so the transparent rect sits above the staff lines in the hit stack and
  wins for gap clicks. As first child the visible ink paints over it, so a click on a
  notehead/stem has the *glyph* as `event.target` while the rect only wins in the
  empty interior — the rect never shadows the ink. (For today's `closest`-based
  resolution either order works; first-child keeps a future per-glyph interaction
  open and avoids painting the rect over ink.)
- **No `data-*` on the rect.** The rect carries **no** `data-kind`/`data-hand`/
  `data-event-index`. Selection resolves by walking up to the enclosing `<g>` (which
  already carries all three). Stamping `data-hand`+`data-event-index` on the rect
  would create a **duplicate** match for `selectionQuery`
  (`[data-hand][data-event-index]`) and let `querySelector` pick the rect over the
  `<g>`. Keeping it attribute-free means `selectionQuery`/`decorateSelection` need
  **no change** and `is-selected` always lands on the `<g>`.
- **Geometry — layout-math-free in the emit.** The event record carries the column
  center `x` but not the per-column advance, so size the rect to a **fixed sensible
  column width centered on `x`** (≈2 sp; `x = note.x − W/2`). Vertically, within
  `<g data-hand transform="translate(0 staffBottomY)">` the staff bottom line is
  local Y=0 and the top is `−STAFF_HEIGHT_SP` (=4), so the staff is local Y `[−4, 0]`;
  extend a generous margin N≈3–4 sp above/below — local Y `[−4−N, 0+N]` — so ledgered
  notes and stems fall in the hit zone. N is a new design constant. Slight overlap of
  very tight adjacent columns is harmless (the rect only needs to cover the gap;
  visible ink still resolves to its own group).

**Editor-only emit (the boundary).** Both the editor (`SongCanvas`) and the front end
(`view.js`) render through the same `renderInto` → `renderNote`/`renderRest`. To keep
the published page provably unchanged, emit the rect **only in the editor**, behind a
new `interactive` flag threaded on the existing options object:
`renderInto(container, model, options)` forwards `options` to
`renderSvg(model, { accessibleName, interactive })`, which threads `interactive` down
the single spine that reaches events — `renderSystem` → `renderMeasure` →
`renderHand` → `renderNote`/`renderRest` (≈5 functions, ≈7 call sites; no other
renderer is touched). The front end (`view.js`) omits the flag (defaults false → no
rect → published DOM **byte-identical**); the editor passes `interactive: true`. A
module-level/closure flag is rejected (mutable module state contradicts the emit
module's pure-function ethos). *Documented fallback:* emit the rect unconditionally
and rest AC12 on *visual* identity — the front-end SVG looks identical and `view.js`
never reads the inert node; the flag path is strictly stronger (byte-identical).

**Ruled-out causes (so the fix is not padded).** Gutenberg interception is **not**
the cause (only bubble-phase `click`/`keydown`, no overlay; the `stopPropagation()`
correctly prevents block-deselect; the one-click "warm-up" to first-select a block is
inherent to Gutenberg and unchanged). `pointer-events`/CSS is **not** a cause (zero
`pointer-events` rules; `__canvas-actions` is a sibling, not an overlay). Listener
lifecycle is **not** a cause (listeners attach once on the persistent container and
read live values; `replaceChildren` swaps only the SVG subtree, never mid-click).

**Regression-proof test.** Pin the exact signature — "a click inside the event's
selectable region but not on painted ink fails to select" — at two altitudes:

- **e2e (real browser, authoritative).** With the existing Playwright harness, click
  the event group at an explicit `position` inside its column but *off* the
  notehead/stem (e.g. the staff-gap above the notehead — the bbox-center point that
  fails today). Assert the Note panel populates and the group gains `is-selected`.
  This *fails before* the fix and passes after — distinguishing "has a hit-area" from
  "only the glyph is hittable," which `.click()`-on-`<g>` and jsdom both miss.
- **unit (fast guard).** (1) Structural: assert each note/rest group now *contains* a
  filled hit element covering its column (a transparent `<rect>` child with no
  `data-*`, resolving to the group via `closest`). (2) Behavioral: dispatch a
  synthetic click whose `target` is the **hit-rect** (not `group.firstChild` ink as
  today's test forces) and assert `onSelect` fires the right
  `{ sectionIndex, measureIndex, hand, eventIndex }` tuple.

### KD2 — Selection-contextual add/remove note (Req 4, 5; AC3, AC4)

**Problem.** Today's add model is the opposite of selection-contextual: the canvas
renders a per-hand × per-measure grid of "add note" buttons plus an end-of-score
"add measure" button, each carrying an explicit `(sectionIndex, measureIndex, hand)`.
The spec replaces this with two selection-driven controls whose hand is *inferred*.

**What already works (reuse, not rebuild).**

- `onAddNote(sectionIndex, measureIndex, hand)` (`edit.js:150`) already does
  inferred-position insertion: when the resolved selection matches that
  `(sectionIndex, measureIndex, hand)` it inserts at `eventIndex + 1`, else appends,
  then **selects the new note** so its panel opens. It already tolerates an empty hand
  (`measure[hand] ?? []`).
- "Remove note" already exists in `NotePanel` — it removes the event, drops the hand
  key when the list empties, and calls `onRemove` to clear the selection. This
  satisfies AC4 as-is.

**Decision.**

1. **Add-note = pure reuse of `onAddNote` with the selection's coords.** The new "Add
   note" control calls `onAddNote(selection.sectionIndex, selection.measureIndex,
   selection.hand)` — the hand is the selection's hand, **inferred, never prompted**
   (AC3). No new structural logic.
2. **Both controls live in the `NotePanel`, side by side**, as standard `Button`s
   (Req 5). `NotePanel` already receives `song` + `selection`; it takes one new
   `onAddNote` prop. Sidebar-only is chosen for clarity and minimal surface (Req 5
   permits canvas/sidebar/both; an optional canvas affordance is explicitly out this
   review).
3. **Insert position: AFTER the selected event** — the current behavior; the
   intuitive "add another note here," and the new note is auto-selected.
4. **Remove the canvas add buttons — but KEEP both handlers.** Drop the `HANDS` map
   and the `__canvas-actions` buttons (the per-hand add-note buttons and the
   end-of-score add-measure button); `SongCanvas` becomes selection + decoration
   only. Do **not** drop `onAddNote` or `onAddMeasure`: both are reused — `onAddNote`
   by NotePanel "Add note" and by the Structure-view first-note path; `onAddMeasure`
   by the Structure-view add-measure (KD3). The mistake to avoid is conflating "drop
   the button" with "drop the handler."
5. **Empty/first-note path → owned by the Structure view (hard dependency on KD3).**
   With the canvas grid gone, an empty measure/hand has no event to select, so
   contextual add can't bootstrap it. The mechanism is ready (`onAddNote` handles an
   empty hand; `newNote()` exists) — only an *entry point* is missing. The
   Structure-view measure row exposes a measure-level "Add note" that defaults a hand
   (right hand) and calls `onAddNote(si, mi, "rightHand")`. So the canvas-grid
   removal and the Structure-view "Add note" **must land together** (see Risks).

**Tests that move with this rework.** The existing e2e "adding a note on the canvas
stores it in the chosen hand" — which is specifically the first-note-into-the-seeded-
empty-song flow — is **rewritten** as the Structure-view first-note path (select the
empty measure in the list → "Add note"), not deleted. The `SongCanvas` add-button
unit tests are removed with the buttons; new coverage asserts NotePanel "Add note"
calls `onAddNote` with the selection's coords and that the new note is selected after.

### KD3 — Sidebar Structure view (Req 6–9; AC5–AC8)

**Problem.** Today sections/measures are reachable only by selecting an *event* on
the canvas, which reveals `MeasurePanel`/`SectionPanel`. So an empty measure, or a
section with no events, is unreachable, and structural add/remove lives buried inside
those event-gated panels. The Structure view makes the whole song browsable
independent of any event selection — also the prerequisite for KD2's first-note path.

**Decision — five parts.**

1. **Kind-tagged selection.** Extend the editor-only selection to
   `{ kind: "section" | "measure" | "event", sectionIndex, measureIndex?, hand?,
   eventIndex? }`. `resolveSelection` already resolves top-down (section → measure →
   event); change it to stop at the depth the `kind` names and return the deepest
   tagged object — `"section"` → `{ kind, section, sectionIndex }`; `"measure"` →
   `+ { measure, measureIndex }`; `"event"` → `+ { event, hand, eventIndex }`. A
   missing lower level still invalidates the whole thing (a measure selection whose
   section vanished → `null`), preserving the dependent-null chain. Today's event
   tuples become `kind:"event"` — backward compatible. (Chosen over a fully separate
   union: least churn — the resolver is already a top-down chain, and panels already
   read only their own sub-fields.) `globalMeasureNumber(song, si, mi)` is already
   kind-agnostic — no change. *Pinned-contract reconciliation:* the existing test
   that a *partial* selection resolves to `null` stays true for an **untagged**
   partial (no `kind` = malformed → `null`); the `kind` discriminant is exactly what
   makes a measure-/section-only selection well-formed. The test is updated to assert
   both "untagged partial → null" and "tagged measure/section → resolves."

2. **Panel gating by `kind`.** Replace the single
   `resolvedSelection && (<Note/><Measure/><Section/>)` with kind-keyed conditionals:
   `SongPanel` always; `SectionPanel` for **every** kind (every kind has a section);
   `MeasurePanel` for `"measure"`+`"event"`; `NotePanel` for `"event"` only. So a
   measure selection shows Measure+Section (no Note), a section selection shows
   Section only, and an event selection shows all three (today's behavior preserved).

3. **Lift the four structural mutators to `edit.js`** (the single owner of `working`
   + `commit`): `onAddSection`, `onRemoveSection`, `onAddMeasure(sectionIndex)`,
   `onRemoveMeasure(sectionIndex, measureIndex)` — each the same immutable
   `insertAt`/`removeAt`/`replaceAt` + `newSection`/`newMeasure` splice the panels do
   today, written **once** and passed to **both** the Structure list and the panels
   (the panels drop their local copies). `onAddMeasure` gains a `sectionIndex` arg
   (today it hardcodes the last section) so the list can target a specific section.
   Selection-fallout is lifted too (removing the selected section/measure clears or
   re-targets the selection). This de-duplicates the three scattered copies.

4. **Canvas highlight + scroll — measure direct, section DERIVED, no emit change.**
   The emit carries `data-measure` (1-based global number) and `data-system` but
   **no `data-section`** (sections are flattened away in layout). So:
   - *Measure highlight:* `globalMeasureNumber(song, si, mi)` → N, decorate the
     `[data-measure="N"]` group.
   - *Section highlight (derived):* filter `measureCoords(song)` to the target
     `sectionIndex` to get that section's global measure numbers, then decorate each
     `[data-measure="K"]`. Add a small helper (e.g. `measureNumbersForSection(song,
     si)`) beside `globalMeasureNumber`. **No emit change** — keeps the front end
     byte-identical (AC12), consistent with the KD1 boundary discipline. (Emitting
     `data-section` is rejected: it would touch the shared emit and need the same
     `interactive`-style gating.)
   - *`decorateSelection` branches by `kind`:* event → today's scoped
     `selectionQuery` node; measure → the one `[data-measure="N"]` group; section →
     the set of `[data-measure="K"]` groups.
   - *CSS:* a **new** class for measure/section highlight (e.g. `is-active-measure` /
     `is-active-section`), distinct from the event `is-selected` outline, so a
     whole-measure/section box doesn't clash with the event outline.
   - *Scroll:* `group.scrollIntoView({ inline: "nearest", block: "nearest" })` on the
     measure group (a section scrolls its first measure into view), run after the
     group is located in the draw effect. `scrollIntoView` on an SVG child can be
     flaky across engines; documented fallback is coordinate-based
     (`getBoundingClientRect()` or the group's model translate X → set
     `host.scrollLeft` on the `overflow-x:auto` host).

5. **`StructureList` component — reuse the existing list pattern, WordPress-only.**
   Housed in a new `PanelBody title="Structure"` rendered in `InspectorControls`
   **always** (alongside `SongPanel`), so the song is browsable with nothing selected
   (AC5) and the first-note flow has an entry point. It mirrors `AnnotationList`'s
   controlled row + trailing `AddButton` pattern: rows are sections (a select
   `Button` + a remove `Button icon="trash"` + a nested measure list) and a trailing
   "Add section" `AddButton`; each section's measure sub-list is the same shape
   (rows = measures with select + remove, trailing "Add measure" `AddButton`).
   Selecting a row calls `setSelection({ kind, sectionIndex, measureIndex })`; the
   selected row's active state uses `isPressed` / `aria-current`. All
   `@wordpress/components` (Req 19). **Notes are not listed** (measure depth only,
   Req 6); **no move controls** (Req 9). The measure row also exposes the "Add note"
   that unlocks the KD2 first-note path.

### KD4 — Song-level `language` field (Req 10–14; AC9–AC11)

**Problem.** Review-1 built the conversion *primitives* but never stored the
language: `inferNoteNameSystem`, `noteNameOptions`, `stepInSystem` exist, but the
system is only *inferred*, the `SongPanel` ignores its `system` prop, and there is no
stored field, selector, or song-wide conversion. Review-2 adds the stored field +
selector + conversion, reusing the primitives.

**Decision — five parts.**

1. **Schema: add `language: { enum: ["spanish", "english"] }`** to the root
   `properties`, no `required` change. The generic enum walker accepts a valid value
   and emits a friendly "is not one of the allowed values […]" for a typo; since raw
   JSON stores unconditionally, a bad value never blocks saving (AC14). **Use the
   `SYSTEMS` keys `"spanish"`/`"english"`, not ISO `es`/`en`:** they equal exactly the
   strings `inferNoteNameSystem` returns and `SYSTEMS` is keyed by, so
   `language === system` with zero translation —
   `system = working.language ?? inferNoteNameSystem(working)` and
   `stepInSystem(step, working.language)` compose directly. The field is
   editor-internal and the spec says "values for Spanish and English," not a locale
   standard.

2. **Source of truth: `system = working.language ?? inferNoteNameSystem(working)`**
   (replacing the bare infer in `edit.js`). A stored `language` is authoritative;
   inference is the fallback only when the field is absent — exactly AC10's "infer the
   initial language from spellings if no field." Field/pitch disagreement is avoided
   because the conversion (part 3) rewrites every pitch whenever `language` is set, so
   a stored `language` always agrees with the pitches it produced; the only way to
   desync is a hand-edited raw JSON, where `language` wins for what controls *display*
   and the next edit/conversion reconciles — acceptable (raw JSON is the escape
   hatch).

3. **Conversion on switch: rewrite EVERY `pitch.step` via `stepInSystem`, set
   `language`, commit — `pitch.step` ONLY (alters keys stay English-canonical).** The
   selector's `onChange` runs a pure `mapSong` that walks
   `sections[].measures[].{rightHand,leftHand}[].pitches[].step`, applies
   `stepInSystem(step, target)` (idempotent + canonicalizing), sets `language: target`,
   and commits through `commitSong` (conformant by construction).
   - *Scope — steps-only (option A), decided over also converting `handConfig.alters`
     keys (option B).* Two facts make A correct and contradiction-free: **(i)** the
     visual editor can only ever *write* English-letter alters keys (`HandConfigEditor`
     offers `ALTER_KEY_OPTIONS = ["C"…"B"]` and `nextUnusedNote` draws only from those),
     so converting alters keys to Spanish would be reverted the instant the author
     touches that hand config — B fights the editor; **(ii)** the renderer *normalizes*
     alters keys through `normalizeStep`, so `{ do: 1 }` and `{ C: 1 }` render
     **identically** — an alters key is an internal alteration map keyed by canonical
     letter, never displayed as a spelled note name. Therefore AC9's "every note name
     in the stored song" is satisfied by steps-only, reading "note name" as the
     displayed/authored spelling (pitches — the only note names a reader sees differ by
     language). Option B-full (convert keys *and* thread `system` into
     `HandConfigEditor`, swap `ALTER_KEY_OPTIONS`, etc.) is real added scope on an
     advanced progressive-disclosure field for **zero** visible benefit (the renderer
     normalizes keys, so converted vs unconverted renders the same glyph). Rejected;
     revisit only if a future requirement explicitly wants alters keys *spelled*
     per-language. A raw-JSON Spanish alters key still validates and still renders
     correctly (normalized) — it is simply never produced by the visual controls and
     not touched by conversion.

4. **Selector + display: a `SelectControl` in the `SongPanel`.** The always-present
   `SongPanel` already receives `system` (currently ignored); the selector shows
   `system` and its `onChange` runs the part-3 conversion + commit. The pitch controls
   already display in the song's system (`PitchEditor` uses `noteNameOptions(system)` +
   `stepInSystem(pitch.step, system)`), so once `system` reads `working.language`,
   every note-name control follows the stored language (Req 13) for free.

5. **Default on insert: default by INFERENCE, do NOT stamp `language` in
   `newSong()`.** `newSong()` seeds `{ sections: [...] }` with no pitches, so
   `inferNoteNameSystem` already returns `"english"` — the editor *shows* English,
   satisfying AC10's observable default. Stamping `language:"english"` would break the
   lazy-seed contract (the block stores `""` until a real edit, pinned by an e2e) and
   wouldn't persist without forcing a mount-commit (which the design avoids). The
   `language` key is written on the first language switch; a top-level `language`
   survives every later visual edit because all panels emit `{ ...song, … }` spreads
   and `emitBlock` does `{ ...song, [key]: value }` — none rebuilds from scratch.

**Round-trip + front-end boundary (AC11/AC12 — zero front-end change).** `language`
round-trips through raw JSON: validation is permissive (`additionalProperties` not
enforced) and the enum accepts the value, so `validateSong` returns `[]`, and even an
invalid value is stored unconditionally (AC11/AC14). The front end is untouched:
`render.php` treats `song` as an opaque string (escapes only `<`) and emits it verbatim
in the inert `<script>` — zero parsing — so `language` rides along and changes no
rendering (AC12), with **no `render.php` change**. No front-end code reads `language`
(verified: zero hits; `view.js` reads only `metadata` + `sections`).

### KD5 — Conformant by construction, raw JSON, disclosure, deps (Req 16–19; AC13–AC15)

This is a cross-cutting audit confirming KD1–KD4 satisfy the carry-over constraints.

- **Req 16 / AC13 — conformant by construction.** `commit = commitSong(nextWorking,
  onChangeSong)` is the single visual-commit path; `commitSong` serializes then
  **re-validates**, refusing to persist a non-conformant string. Every visual mutation
  routes through it — including the new lifted structure handlers and the language
  conversion (both build a conformant working object via `newX` +
  `insertAt`/`removeAt`/`replaceAt` + `stepInSystem`, all recognised-output). So no
  visual control can persist a non-conformant song.
- **Req 17 / AC14 — raw JSON unchanged.** The JSON-mode branch is untouched:
  `onChangeSong` persists the raw string unconditionally, the error `Notice` is
  presentational, nothing blocks saving. The only schema change is the additive
  `language` enum — a typo'd value adds one informational "not one of the allowed
  values" line but never blocks (AC14).
- **Req 18 — disclosure / live re-render / review-1 preserved.** *Live re-render:*
  `commit` → `setAttributes({ song })` → `working` re-parses → the `SongCanvas` draw
  effect re-runs on the `song`/`selection` change; KD1–KD4 don't touch this loop.
  *Disclosure:* the language selector is a common Song-level control (like
  tempo/time-sig); section/measure overrides stay behind their ToolsPanels; the new
  Structure panel is an always-present *browse* panel (navigation, not a buried
  setting). *Localized changes:* confined to selection emit (the editor-gated
  hit-rect), inspector panels (+Structure, +"Add note", +language selector), and
  selection state (the `kind` tag). Not touched: `accessibleName`/`<title>`, the
  `ResizeObserver`, the font-ready gate, the invalid-state routing. Removing the
  canvas add buttons only deletes the `__canvas-actions` block + its props; the
  editor-only `interactive` flag keeps the front-end emit byte-identical (Req 15).
- **Req 19 / AC15 — WordPress-only deps.** Every production import under
  `src/editor/**` + `src/edit.js` is `@wordpress/*` or a local relative path; the only
  non-`@wordpress/*` imports (`react`/`react-dom/client`) appear exclusively in tests.
  The new UI uses only `Button`/`SelectControl`/`PanelBody`/`ToolsPanel` +
  `@wordpress/element`/`i18n` — all already in use, no new runtime dependency.

**Out-of-scope scan — none crossed.** Front end consuming `language` (not done —
stored + round-trips only); `render.php` / front-end SVG (unchanged — opaque string;
`interactive` flag keeps the emit byte-identical); reordering (not added);
listing individual notes in the Structure view (not done — measure depth only); canvas
keyboard selection (not added — the existing Enter/Space keydown is review-1's; this
review adds a mouse-only hit-rect); selecting a measure/section by clicking the canvas
(not added — Structure-view → canvas highlight is one-way); audio (untouched);
best-effort invalid-song loading / large-song perf (untouched). The section-highlight
derivation (via `measureCoords`, no `data-section` emit) was specifically chosen to
keep even the highlight feature inside the Req 15 boundary.

## Dependencies

- **WordPress packages only** (Req 19): `@wordpress/components` (`Button`,
  `SelectControl`, `PanelBody`, `ToolsPanel`, `Notice`, toolbar), `@wordpress/element`,
  `@wordpress/i18n`, `@wordpress/block-editor` — all already in use. No new runtime
  dependency.
- **Cross-topic ordering (hard).** KD2's canvas-add-button removal **must land
  together with** KD3's Structure-view "Add note," never before — otherwise an empty
  measure (including the seeded `newSong()` one) has no first-note entry point.
- **Shared emit contract.** KD1 threads `interactive` through `renderInto` →
  `renderSvg` → `renderSystem` → `renderMeasure` → `renderHand` →
  `renderNote`/`renderRest`. `view.js` must continue to omit the flag (default false)
  for the front-end to stay byte-identical.
- **Note-name primitives.** KD4 depends on `inferNoteNameSystem`, `noteNameOptions`,
  `stepInSystem`, and the `SYSTEMS` keys (`"spanish"`/`"english"`) from review-1's
  `noteNames.js`.

## Failure modes and observability

- **Hit-rect mis-sized.** Too narrow re-opens the gap bug; too wide overlaps adjacent
  columns. Mitigation: fixed ≈2 sp width centered on `x` plus a generous vertical
  margin N≈3–4 sp; visible ink still resolves to its own group, so overlap only
  affects gap clicks. *Observable:* the e2e off-ink click fails if the rect is missing
  or mis-sized.
- **Hit-rect leaks to the front end.** Mitigated by the editor-only `interactive`
  flag (front-end byte-identical). If the fallback (unconditional emit) is taken, the
  front end gains one inert, invisible, attribute-free `<rect>` per event; AC12 still
  holds as *visual* identity and `view.js` never reads it.
- **Stranded empty measure.** If the canvas add-grid is removed before the
  Structure-view "Add note" exists, an empty measure becomes a dead end. Mitigation:
  the sequencing constraint above; *observable* via the rewritten first-note e2e.
- **`scrollIntoView` flakiness on SVG children.** Documented coordinate-based fallback
  (`getBoundingClientRect()` / model translate → `host.scrollLeft`).
- **Stale selection after a structural edit.** `resolveSelection` already returns
  `null` (or a re-resolved object) when the selected node no longer exists; a stale
  decoration query matches nothing and decorates nothing — existing behavior, extended
  to the new kinds.
- **Hand-edited raw JSON desync** (`language` disagreeing with pitch spellings).
  `language` wins for display; the next visual edit/conversion reconciles. The raw
  surface still validates and stores unconditionally (AC14).
- **Observability.** The single `commitSong` re-validation is the central guard; a
  rejected commit surfaces nothing to the front end (it never persists a
  non-conformant string). Unit tests guard the emit structure and selection
  resolution; the e2e guards the real-pointer selection, the first-note flow, the
  Structure list, language conversion/persistence, and front-end parity.

## Risks and open questions

- **Front-end hit-rect leak — MITIGATED** by the editor-only `interactive` flag. The
  documented unconditional-emit fallback remains AC12-safe on visual identity; the
  flag path is provably byte-identical.
- **Dropping the canvas add buttons before the Structure view exists would strand
  empty measures.** Sequencing risk: the Structure-view "Add note" (or a transitional
  canvas affordance) must land **together with** the canvas-button removal, never
  before.
- **No outstanding open design questions.** Remaining items are implementation-phase
  choices noted inline: the KD1 editor-only-flag vs. unconditional-emit fallback, and
  a list-component polish option (`__experimentalItemGroup` over plain `Button` rows).
