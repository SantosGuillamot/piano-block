# Design Research: Frontend toggle to show note names

This file records the design DECISIONS (with rationale) for the note-names toggle
feature, traced to the approved spec (`../1-spec/spec.md`). It is the working log;
the writer synthesizes `design-doc.md` from it.

Input authority: `../1-spec/spec.md` (requirements R1–R13, AC1–AC13).
Supporting detail: `../1-spec/spec-research.md`.

## Research (grounded codebase facts)

Facts established by direct reading of the codebase (cited inline as `file:line`):

- **Frontend render path.** `src/render.php` emits ONE childless
  `<div data-wp-interactive="piano-block/piano" data-wp-context=… data-wp-init="callbacks.init" …>`
  for a non-empty song; for an empty/whitespace song it `return`s before emitting
  anything (no wrapper). The song string and a server-computed `accessibleName` are
  seeded into per-instance `data-wp-context` via `wp_interactivity_data_wp_context()`.
- **View module.** `src/view.js` registers `store('piano-block/piano')` with a single
  `callbacks.init` (wired by `data-wp-init`). It reads `{ song, accessibleName }` from
  `getContext()`, the container from `getElement().ref`, runs `parseAndValidate(raw)`
  once (any error → `return`, draws nothing), then builds a `draw` closure:
  `draw = () => renderInto(container, buildLayoutModel(data, availableWidthInSp(container)), { accessibleName })`.
  First draw is gated on the music font via `drawWhenFontReady(draw)`; a rAF-debounced,
  one-way `ResizeObserver` re-runs `draw` on width change; the init returns a teardown
  that disconnects the observer.
- **Editor render path (the byte-identity twin).** `src/editor/SongCanvas.js:117-120`
  uses the SAME core: `buildLayoutModel(song, availableWidthInSp(container))` →
  `renderInto(container, model, { accessibleName })`. Same call shape as `view.js`.
- **Emit layer.** `src/notation/svg.js` `renderInto`/`renderSvg(model, { accessibleName })`
  walk the positioned model and build an `<svg role="img">` DOM tree via
  `createElementNS` (never `innerHTML`). It draws noteheads, stems, flags,
  accidentals, ledgers, dots, rests, clefs, barlines, brace, time-sig, plus `<text>`
  for dynamics, tempo, ottava, and author annotations. ZERO pitch-name text today.
  `renderNote(note, handKey)` draws each notehead at `head.y` (hand-local frame); the
  note `<g>` is stamped `data-kind="note" data-hand=… data-event-index=… id=…`.
- **The note record carries NO pitch name.** `src/notation/layout.js` (~1542) builds
  each note record from `positions = pitches.map(pitchToStaffStep).filter(non-null)`;
  `heads = stackChord(positions, direction)` where each head is
  `{ sFromBottom, y, side, displaced }`. The note record exposes `heads`, `topStep`,
  `bottomStep`, `accidentals`, `ledgers`, `dotSpecs`, etc. — but NOT `pitch.step` /
  the note-name string. `stackChord` SORTS positions low→high and discards the source
  pitch objects, so head order is NOT the source `pitches` order, and the original
  `step` is gone by emit time. (Design consequence captured under Topic B.)
- **Shared, frontend-safe name vocabulary.** `src/song/normalizeStep.js` (already
  imported by `layout.js` and `validate.js`, no `@wordpress/i18n`) exports
  `normalizeStep(step) → canonical UPPERCASE English letter | null` and `isNoteName`.
  It does NOT contain the ordered per-system spelling arrays.
- **Editor-only name logic.** `src/editor/noteNames.js` exports `inferNoteNameSystem`,
  `stepInSystem(step, system)`, `noteLabel`, `mapSong`, `noteNameOptions`. It holds the
  ordered `SYSTEMS = { english:[C..B], spanish:[do..si] }` arrays and the C…B→system
  mapping. It imports `@wordpress/i18n` (`__`, used by `noteLabel`'s rest branch), and
  is imported ONLY by editor files (`edit.js`, inspector panels, tree, pitch editors).
  Never by `view.js` / `svg.js` / `render.php`. System resolution is
  `song.language ?? inferNoteNameSystem(song)` (`edit.js:167`).
- **Byte-identity is by construction, NOT a two-surface test.** There is NO existing
  unit test that string-compares editor-canvas SVG to frontend SVG. The README's
  "byte-identical between editor canvas and published page" holds because both call
  `renderInto(model, { accessibleName })` with identical options. `svg.test.js`'s
  "front-end byte-identity guard" only asserts a no-options `renderSvg` emits zero
  `data-hit` rects (an editor-only hit-rect concern), not cross-surface equality.
- **Purity / determinism.** No `Math.random`/`Date`/`performance.now`/`crypto` in
  `src/notation` (spec-research A5b). `buildLayoutModel` + `renderSvg` are pure
  functions of their inputs, so same inputs → byte-identical SVG (the property
  reversibility/idempotency relies on).

## Topics

(Worked one at a time below. Each: spec requirement(s) served → options/evidence →
Decision + Rationale.)

- Topic A — Interactivity API design (store, context, directives, view module, label transport). Serves R1, R5(control), R7, R8, R12, R6. **DECIDED.**
- Topic B — Note-name data flow & rendering (where names are computed/drawn; per-head step). Serves R4, R5, R2. **DECIDED.**
- Topic C — Opt-in render parameter & byte-identical guarantee (AC10/AC11/R13). Serves R13, AC10, AC11. **DECIDED.**
- Topic D — Toggle control PLACEMENT (was deferred; now in scope). Serves R1, R10. **DECIDED.**
- Topic E — Note-name PLACEMENT / overlap geometry / layout lane (was deferred; now in scope). Serves R10, AC13. **DECIDED.**
- Topic F — Gating: when the control appears (nameable-note detection). Serves R11, AC9, AC12. **DECIDED.**
- Topic G — Reversibility / idempotency / resize-safety; redraw reads live state. Serves R7, R9, AC6, AC7. **DECIDED.**
- Topic H — Default OFF & per-instance independence. Serves R3, R6, AC1, AC4. **DECIDED.**

### Spec coverage matrix (every requirement + AC served)

| Spec | Served by (decision) |
|---|---|
| R1 control exists | A-2 (SSR button), D-1/D-3 (placement) |
| R2 toggle shows/hides | A-3 (watch redraw), B-1 (emit), C-1 |
| R3 default OFF | A-1, H-1 |
| R4 bare step / song system / no accidental·octave / match editor | B-1, B-2, B-3 |
| R5 coverage (hands / chords per-head / rests none / ties) | B-4, E-1 (per-head names) |
| R6 per-instance independence | A-1 (local context), C-4, H-2 |
| R7 state to AT, reversible/idempotent | A-2 (aria-pressed), C-3, G-1 |
| R8 translatable label | A-4, D-4 |
| R9 names survive resize | A-6, G-2 |
| R10 legible / non-overlapping | E (all); D-3 (button no overlap) |
| R11 gating | A-5, F-1/F-2 |
| R12 iAPI per-instance state | A-1, H-2 |
| R13 editor unchanged / opt-in / byte-identical | C (all) |
| AC1 control present, default off | A-1, H-1 |
| AC2 toggle shows/hides all names | A-3, B-1, C-2 |
| AC3 system follows song, no accidental/octave | B-3, C-3 (Spanish assertion) |
| AC4 per-instance independence | H-2, H-3 (e2e) |
| AC5 state to AT | A-2, D-4 |
| AC6 reversible/idempotent (no drift) | C-3 (idempotency test), G-1 |
| AC7 names survive width change | A-6, D-2, G-2 |
| AC8 translatable label | A-4 |
| AC9 no nameable notes → no control | F-1/F-2 |
| AC10 names-off byte-identical (frontend + editor) | C-2, C-3 (pin test) |
| AC11 editor scope: never names | C-4, D (no button in editor) |
| AC12 invalid/empty → no score + no control | F-2, D-5 |
| AC13 names legible / non-overlapping | E (all) |

### Topic A — Interactivity API design — DECIDED

**Spec served:** R1 (control exists), R5/R7 (control state to AT), R8 (translatable
label), R12 (iAPI hard constraint, per-instance state), R6 (per-instance
independence), AC1/AC5/AC8, and the mechanism R2/R9/AC2/AC7 depend on.

**Evidence (researcher, grounded in the `wordpress-development` skill — interactivity-
api.md / directives.md / store.md):**
- Per-instance toggle state belongs in LOCAL `data-wp-context` (the iAPI default), NOT
  `wp_interactivity_state()` global — global state is SHARED across instances on a page
  and would violate R6/AC4. (Skill rules 5/17.)
- An `actions.toggleNoteNames` mutates the context boolean IN PLACE:
  `const c = getContext(); c.showNoteNames = !c.showNoteNames;` (skill store.md toggle
  example). Reassigning the object is wrong; mutate the property.
- `data-wp-bind--aria-pressed="context.showNoteNames"` binds a BOOLEAN; the runtime
  stringifies `aria-*`. (directives.md.)
- **`data-wp-init` runs ONCE on mount and does NOT re-run on context change**
  (directives.md). So today's draw cannot react to a toggle. The reactive hook is
  **`data-wp-watch`**: "runs on mount AND re-runs when any state/context it READS
  changes; may return a cleanup function." `getContext()` returns a LIVE reactive
  proxy, so reading `context.showNoteNames` inside a watch subscribes it; the next
  toggle re-fires the watch.
- The skill SSRs interactive markup with directives (RULE 3/12: wire behavior through
  directives, no `addEventListener` from the view module). Creating the button in JS is
  the anti-pattern.
- i18n: the skill computes translated strings server-side and transports them; it does
  NOT import `@wordpress/i18n` into a view module. Per-instance/reactive strings →
  `data-wp-context` (matches the existing `accessibleName` transport); static
  page-global strings → `wp_interactivity_config()`/`getConfig()` ("translations" is a
  listed config use).
- `withScope` gotcha: store code triggered from OUTSIDE the iAPI runtime (a Promise
  callback like `drawWhenFontReady`, a `ResizeObserver`, `setInterval`) must be wrapped
  in `withScope()` so `getContext()`/`getElement()` resolve to the right instance
  (store.md).

**Options considered for the redraw mechanism:**
1. **Watch-driven redraw (Route 1).** Move the draw into a `data-wp-watch` callback that
   reads `context.showNoteNames` and passes it to `buildLayoutModel`/`renderInto`.
   Toggle flips the boolean → watch re-fires → full pure redraw. Pro: single source of
   truth, names-off DOM has ZERO name nodes (AC10 holds trivially), AC6 idempotency is
   FREE (pure fn, same inputs → byte-identical output). Con: full SVG rebuild per
   toggle (cheap; the renderer is pure).
2. **Always-emit + CSS show/hide (Route 2).** Draw always emits name `<text>`; a
   `data-wp-class` toggles a CSS rule hiding them when off. Con: the names-off DOM still
   CONTAINS name nodes → NOT byte-identical to today → **violates AC10.** Rejected.

**DECISION (Topic A):**
- **A-1 State:** one per-instance local context boolean `showNoteNames`, seeded `false`
  on the server in `render.php` (default OFF = R3/AC1). No global state (R6/R12).
- **A-2 Control:** a native `<button>` SSR'd by `render.php` as a child of the
  `data-wp-interactive` wrapper, with `data-wp-on--click="actions.toggleNoteNames"`,
  `data-wp-bind--aria-pressed="context.showNoteNames"` (R5/R7/AC5), and its label via
  `data-wp-text` (R8/AC8). The action mutates `context.showNoteNames` in place.
- **A-3 Reactive redraw (Route 1):** the imperative SVG draw is driven by a
  `data-wp-watch` callback that reads `context.showNoteNames` (live proxy) and passes
  it through to the render. Flipping the toggle re-fires the watch → redraw with names.
  `data-wp-init` retains parse-once + setup responsibilities; the watch owns the
  reactive redraw. (Names-off DOM stays byte-identical — Route 2 rejected.)
- **A-4 Label transport (i18n):** compute the label server-side in `render.php` with
  `__()`/`piano-block` text domain and pass via `data-wp-context` (matches the existing
  `accessibleName` precedent). If the label flips Show↔Hide, seed BOTH strings in
  context and select with a derived getter `state.toggleLabel` reading
  `context.showNoteNames` (directive values can't hold a ternary). Recommended baseline:
  a FIXED label "Show note names" (aria-pressed conveys state) → one context string;
  the Show/Hide flip is an allowed enhancement. (R8/AC8.)
- **A-5 Gating hook (for Topic F):** `render.php` SSRs the button but its visibility is
  gated on a client-set flag (e.g. a context boolean `hasNameableNotes`, seeded false,
  set true by `init` only when the song is conformant AND has ≥1 nameable note), bound
  via `data-wp-bind--hidden`. render.php cannot know render-success/nameable-note
  presence (validation is client-side, R6), so the gate must be client-determined.
- **A-6 Single redraw funnel (DESIGN-X) — resize + font reconciled through the watch.**
  The watch is the SINGLE owner of the imperative draw, with both `showNoteNames` AND
  the width/resize signal as its reactive dependencies. Concretely:
  - The `data-wp-watch` callback reads `context.showNoteNames` and a width/redraw signal
    from context (e.g. a `width` or `redrawNonce` field), computes the model at the live
    width, and `renderInto`s with the live `showNoteNames`. Reading both subscribes the
    watch to both; a toggle OR a resize re-fires the ONE redraw path. AC7 (names survive
    resize) becomes free — resize and toggle share one funnel.
  - `init` keeps the `ResizeObserver`, but instead of calling draw directly it MUTATES
    the context width/nonce on a width change; the watch re-fires. The observer callback
    then only WRITES a context field (no `getContext()`-dependent draw inside an
    out-of-runtime callback), avoiding the `withScope` tax. (DESIGN-Y — keep init's own
    draw closure and wrap out-of-runtime callbacks in `withScope` — is more moving parts
    and is NOT chosen.)
  - **Parse-once preserved by caching, not closure scope (Wrinkle 1).** The draw leaves
    `init`'s local scope, so the watch can't close over `init`'s parsed `data`. Parse is
    cached (a per-instance ref/closure memo) so it runs ONCE and the watch reuses it on
    every toggle/resize — preserving validate-once (R6/D16). Re-parsing in the watch per
    fire is REJECTED.
  - **Invalid-song gate preserved (Wrinkle 2).** The `errors.length > 0 → render nothing`
    guard moves to the top of the cached-parse path; on error draw nothing AND leave
    `hasNameableNotes` false so the button stays hidden (ties to A-5/Topic F).
  - **Font gate (Wrinkle 3).** The first draw still gates on `drawWhenFontReady`; either
    the watch's first run awaits the font, or `init` seeds a `fontReady` context bool the
    watch reads. Detail ratified in Topic G; the funnel is decided here.

  This DESIGN-X funnel is the central frontend-wiring decision; Topic G ratifies the
  resize/idempotency specifics on top of it.

**Rationale:** Route 1 is the only mechanism that satisfies AC10 (names-off byte-
identity) while reacting to the toggle; it reuses the pure render path so AC6
idempotency is free. SSR + directives is the skill-canonical, anti-pattern-free wiring.
Context transport for i18n matches the one precedent already in the codebase
(`accessibleName`), avoiding a new `@wordpress/i18n` import into the view module. Local
context guarantees R6 per-instance independence by construction.

### Topic B — Note-name data flow & rendering — DECIDED

**Spec served:** R4 (bare step in the song's system, no accidental, no octave, MATCH the
editor's strings), R5 (both hands, per-notehead chords, rests none, ties named), R2
(names appear for every nameable note when ON). Resolves OQ3 and OQ4.

**Evidence (researcher, grounded `file:line`):**
- The note record has NO step by emit time. `layout.js:1494-1496`
  `positions = pitches.map(pitchToStaffStep).filter(s => s !== null)` — the `.filter()`
  can shorten `positions` vs `pitches` (when a step is unrecognized → `null`), and
  `stackChord` (`layout.js:324-348`) then SORTS heads low→high, fully decoupling head
  order from `pitches` order and dropping the source `step`. `svg.js` `renderNote`
  (`svg.js:728`) only iterates `note.heads` — no step anywhere. (In a CONFORMANT song
  the filter drops nothing, so the existing accidentals code's `positions[pi] ↔
  pitches[pi]` assumption holds — but the SORT decouples order regardless, so index
  alignment must NOT be the pairing mechanism.)
- `@wordpress/i18n` is used in `noteNames.js` in EXACTLY one place: `noteLabel`'s rest
  branch (`noteNames.js:157` `__("rest","piano-block")`). `stepInSystem` (132-137),
  `inferNoteNameSystem` (97-104), `SYSTEMS` (35-38), `CANONICAL_LETTERS`,
  `SPANISH_TOKENS`, `stepsOf` are ALL i18n-free and depend only on the shared,
  frontend-safe `normalizeStep.js`.
- System resolution `working?.language ?? inferNoteNameSystem(working)` (`edit.js:166-
  167`) operates on the parsed song; `view.js`'s `data` is the same parsed JSON
  (`validate.js:341-349`, no field transform). `inferNoteNameSystem`/`stepsOf` walk the
  IDENTICAL field path `buildLayoutModel` walks (`sections → measures →
  rightHand/leftHand → event.pitches → pitch.step`). No field-name mismatch.
- Coverage falls out of existing structure: both hands run through the one `layoutHand`
  (`layout.js:897`); the rest branch RETURNS before `notes.push` (`layout.js:1482-1490`)
  so rests get no head/name; a `tie` is only a span marker (`schema.js:167`,
  `matchSpans` draws a `<path>`) and does not suppress the note, so each tied event is
  named on both ends; a chord is ONE note record with `heads = stackChord(positions)`
  (one head per pitch), so per-head naming names every notehead in the stack. Every
  conformant note is nameable (note requires non-empty pitches `schema.js:174-176`;
  pitch requires a recognized step `schema.js:181`; only `note|rest` types exist).

**DECISION (Topic B):**
- **B-1 Per-head step threading (chosen: thread in layout, resolve name in layout).**
  In `layoutHand`, build PAIRED records `{ sFromBottom, step }` per pitch (so the
  `.filter()` drops a pair atomically and the step stays bound to its position), pass
  them to `stackChord`, and attach the step onto each head object so it RIDES the sort
  (the sort reorders head OBJECTS; an extra field survives untouched). Then resolve the
  final NAME (`stepInSystem(step, system)`) IN THE LAYOUT layer so each head carries the
  final, already-spelled name string. The emit layer (`svg.js`) stays both math-free
  AND string-logic-free: when `showNoteNames`, `renderNote` emits one `<text>` per head
  using the head's pre-resolved name via `textContent` (the existing inert-text model).
  Rejected: re-deriving per-head order in `svg.js` (duplicates layout math, violates the
  `svg.js` math-free contract).
- **B-2 Shared name-system module (chosen: extract, single source).** Create a
  frontend-safe module (sibling of `normalizeStep.js`, e.g. `src/song/noteNameSystem.js`,
  NO `@wordpress/i18n`) holding `SYSTEMS`, `CANONICAL_LETTERS`, `SPANISH_TOKENS`,
  `stepInSystem`, `inferNoteNameSystem`, `stepsOf`. Editor `noteNames.js` re-imports from
  it (and keeps `noteLabel` + its `__("rest")` editor-side). Layout imports `stepInSystem`
  from it to resolve names. Result: ONE source → frontend names EQUAL editor names BY
  CONSTRUCTION (FR4). Rejected: a PHP mirror in `render.php` (a second source → drift
  risk; and names are JS-drawn, default OFF, so server pre-resolution buys nothing —
  unlike `accessibleName`, which is needed pre-JS in `<title>`).
- **B-3 System resolution:** the frontend computes `system = data.language ??
  inferNoteNameSystem(data)` on the parsed song and threads `system` into
  `buildLayoutModel` (→ `layoutHand` → `stepInSystem`). Exact editor parity.
- **B-4 Coverage:** no extra work — both hands, rests-excluded, ties-named-both-ends, and
  per-head chord naming all fall out of the existing render structure once B-1 threads
  the name onto each head.

**Consequence carried to Topic C (load-bearing):** because the NAME is resolved in
layout and threaded onto heads, the layout MODEL itself DIFFERS when names are
requested — so the `showNoteNames` flag (and `system`) must reach `buildLayoutModel`,
and when names are NOT requested the model + emitted SVG must be the exact bytes they
are today (AC10). The default-OFF flag-gating that guarantees this is Topic C.

**Implementation shape for B-1 (grounded, for the writer/planner — minimal touch points):**
- `stackChord` (`layout.js:324-348`) input changes from `number[]` to
  `{ sFromBottom, step }[]`: 3 internal edits — param doc, sort comparator
  (`a - b` → `a.sFromBottom - b.sFromBottom`), and the head-build map (carry `step`/the
  resolved `name` onto each head). The seconds-rule loop is UNCHANGED (it already reads
  the built head objects' `.sFromBottom`). Return shape is purely additive — existing
  consumers of `sFromBottom`/`y`/`side`/`displaced` are untouched.
- `layoutHand` caller (`layout.js:1494-1559`): build the atomic pairs at the map, then
  adapt the FOUR downstream number-consumers that today assume `positions` is
  `number[]` — `stemDirectionForChord` (pass `positions.map(p => p.sFromBottom)`; do NOT
  change its signature), the ledger loop and the dot loop (destructure
  `{ sFromBottom: s }`), and `topStep`/`bottomStep`
  (`Math.max/min(...positions.map(p => p.sFromBottom))`). All mechanical, all in one
  function.
- Rejected alternative: keep `stackChord` on `number[]` + a PARALLEL `steps[]` sorted in
  lockstep — re-introduces index-lockstep fragility through the sort.

**Latent-fragility note (flag, not mandate):** today's accidental pairing
(`layout.js:1508-1517`) indexes `positions[pi]` against `pitches[pi]` and is safe ONLY
by the validator's grace (a mid-array `null` drop would silently misalign; the
`=== undefined` guard only catches trailing overflow). The atomic-pair approach for
names is strictly safer; the accidentals block COULD optionally re-point at the same
paired array to retire this fragility, but that is a nice-to-have (the conformant gate
holds), not required by this feature.

**Rationale:** Threading the name in layout keeps the established "layout owns musical
decisions, `svg.js` only emits" split intact and reuses the single shared name
vocabulary, so editor and frontend names cannot drift (FR4). Per-head threading via the
paired records is the minimal, sort-safe change. Coverage is free because the existing
structure already distinguishes notes/rests/chords/hands.

### Topic C — Opt-in render param & byte-identical guarantee — DECIDED

**Spec served:** R13 (frontend-only, opt-in defaulting OFF, byte-identical when names
not requested), AC10 (names-off byte-identical; editor↔names-off-frontend equality),
AC11 (editor never shows names). Resolves OQ1, OQ2.

**Evidence (researcher, grounded):**
- The `el()` helper SKIPS undefined/null attributes (`svg.js:85-88`
  `if (value !== undefined && value !== null) node.setAttribute(...)`), and `svg.js`
  reads SPECIFIC head fields (`side`, `displaced`, `y`) — it never iterates head keys.
  So an absent/undefined `head.name` emits nothing and changes no existing attribute.
- `SongCanvas` calls `buildLayoutModel(song, width)` with NO third arg and
  `renderInto(container, model, { accessibleName })` (`SongCanvas.js:117,120`); the
  frontend uses the same call shape. Byte-identity holds because both paths feed the
  same pure code with the same (defaulted) options.
- `svg.test.js` has NO `outerHTML`/`XMLSerializer`/`toMatchSnapshot` anywhere — all
  assertions are targeted `querySelector` + `getAttribute`/`textContent`. A literal
  string-equality AC10 test is a NEW (but trivial — jsdom supports `svg.outerHTML`)
  pattern. The existing `SONG` fixture (`svg.test.js:18-65`) + `modelFor` helper already
  exercise a chord (C+E), a rest, a tie (start/stop), an accidental (F♯ `alter:1`), and
  BOTH hands — the ideal AC10 fixture.
- The extracted name module is pure: `SYSTEMS`/`CANONICAL_LETTERS`/`SPANISH_TOKENS` are
  consts, `stepInSystem`/`inferNoteNameSystem` are pure functions with no module-level
  mutable cache (same purity as `normalizeStep.js`). No cross-instance shared mutable
  state.

**DECISION (Topic C):**
- **C-1 ONE flag site (chosen).** Thread the option only into
  `buildLayoutModel(data, width, { showNoteNames = false, system } = {})` → `layoutHand`.
  `layoutHand` resolves and sets `head.name` ONLY when `showNoteNames` is true; when
  false it does NOT add the key. `svg.js` `renderNote` emits one name `<text>` per head
  IFF `head.name` is present — `svg.js` gains NO flag (presence of `head.name` IS the
  signal), a ~4-line conditional emit. `renderInto`/`renderSvg` signatures stay
  `{ accessibleName }`. Rejected: passing `showNoteNames` to BOTH layout and svg (two
  sync'd flag sites, redundant).
- **C-2 Byte-identity by construction + omit-key-when-off.** When `showNoteNames` is
  false (the editor's no-arg call and the frontend default), no `head.name` is set, so
  the model AND the emitted SVG are byte-identical to today. Constraint: OMIT the `name`
  key entirely when off (do NOT set `name: undefined`) so the MODEL object is also
  identical (guards against any future deep-equality model test), not just the SVG. The
  `el()` undefined-skip is the backstop.
- **C-3 ADD an AC10 pin test (chosen over rely-on-construction).** In `svg.test.js`,
  using the existing `SONG`/`modelFor`:
  1. **AC10 core / editor==frontend-off:** assert
     `renderSvg(buildLayoutModel(SONG, W)).outerHTML ===
      renderSvg(buildLayoutModel(SONG, W, { showNoteNames:false, system })).outerHTML`
     (the no-arg editor path equals the explicit names-off frontend path — pins AC10's
     "byte-identical, no added/changed markup when off").
  2. **Positive:** names-ON output CONTAINS the expected name `<text>` nodes AND DIFFERS
     from names-off (proves the feature emits something).
  3. **Idempotency (AC6):** names-ON rendered twice from identical inputs →
     identical `outerHTML` (free from the pure render; pins no-drift).
  A true two-DOM (jsdom `SongCanvas` vs jsdom `view`) compare is e2e-level and OPTIONAL
  belt-and-suspenders; the unit `outerHTML` compare on the model paths is the cheap,
  high-value pin and is REQUIRED (spec AC10 demands literal string equality, which is
  currently only weakly enforced).

  **Copy-ready test spec (for the writer/planner)** — in `src/notation/__tests__/svg.test.js`,
  a new describe block reusing the existing `SONG` fixture (already covers chord/rest/
  tie/accidental/both hands) and `buildLayoutModel`/`renderSvg` imports. `outerHTML` on
  the `<svg>` works in jsdom (a NEW pattern for this suite):
  ```js
  const W = 120;
  const off = renderSvg(buildLayoutModel(SONG, W)).outerHTML;                  // editor path (no flag)
  const offExplicit = renderSvg(buildLayoutModel(SONG, W, { showNoteNames: false, system: "english" })).outerHTML;
  expect(offExplicit).toBe(off);            // [REQUIRED] AC10: names-off frontend === editor canvas, byte-for-byte
  const on = renderSvg(buildLayoutModel(SONG, W, { showNoteNames: true, system: "english" })).outerHTML;
  expect(on).not.toBe(off);                 // [high-value] names-on differs (feature does something)
  expect(on).toContain(">C<");              // [high-value] a name text node present (adjust to the name <text> shape)
  const onAgain = renderSvg(buildLayoutModel(SONG, W, { showNoteNames: true, system: "english" })).outerHTML;
  expect(onAgain).toBe(on);                 // [high-value] AC6 idempotency / no-drift (free, pure fn)
  const es = renderSvg(buildLayoutModel(SONG, W, { showNoteNames: true, system: "spanish" })).outerHTML;
  expect(es).toContain(">do<");             // [optional] AC3 Spanish parity
  ```
  Assertion 1 is the mandatory AC10 pin (one string compare covers BOTH AC10 clauses —
  names-off==today AND editor==names-off-frontend, since the editor path IS the no-arg
  call). The `>C<` / `>do<` contains-checks are intent-illustrative; adjust to the actual
  name `<text>` markup once Topic E fixes it.
- **C-4 AC11 + isolation.** `SongCanvas` passes no flag → editor canvas never resolves
  `head.name` → never shows names regardless of any frontend block's state (AC11). Per-
  instance local context (Topic A) means a toggle mutates only its own block's context →
  only its own redraw gets names (R6/AC4). The extracted module must stay PURE (no added
  caches) so it cannot carry cross-instance state.

**Open sub-check (carried, cheap):** does `layout.test.js` deep-equal head objects? If
yes, omit-key-when-off (C-2) is strictly required to keep that test green; if no, it's
still preferred. Researcher to verify quickly.

**Rationale:** One flag site at the layout layer is the single decision point; the
emit-iff-`head.name` rule keeps `svg.js` flag-free and tiny while preserving its
math/string-logic-free contract. Omit-key-when-off + the `el()` undefined-skip make
names-off byte-identity hold by construction at BOTH the model and SVG levels. The added
`outerHTML` pin converts AC10 from a by-construction property into a literally
machine-checked guarantee, as the spec demands.

**Sub-check resolved + addenda (researcher verified `layout.test.js`):**
- NO exhaustive deep-equal on whole head objects exists (`layout.test.js` uses
  `heads.map(h => h.sFromBottom)` field reads at :286, `toMatchObject` SUBSET at :294,
  and `.side`/`.displaced` field checks — never `toEqual`/`toStrictEqual` on a full
  head). So **omit-key-when-off (C-2) is a NICE-TO-HAVE, not a correctness blocker** — a
  `name: undefined` key breaks no existing model test and never reaches the DOM. STILL
  recommended (cleanliness + future-proofing against a later `toStrictEqual`); cheap via
  a conditional spread. The spec's actual AC10 bar (SVG byte-identity) holds regardless.
- **REQUIRED code-plan task surfaced:** the existing `stackChord` unit tests call it with
  NUMBER arrays (`layout.test.js:285/293/303/310`, e.g. `stackChord([0,2,4], "up")`).
  Topic B changes `stackChord`'s input to object-pairs `{ sFromBottom, step }[]`, so
  these 4 tests MUST be migrated to the new shape. Keeping `stemDirectionForChord` on
  `number[]` (map at the one call site) AVOIDS touching its tests. The plan must budget
  "migrate the 4 `stackChord` unit tests to the object-pair input."

### Topic E — preliminary grounding (placement / overlap geometry)

(Investigation continues with the researcher; recording the codebase machinery found
so the options are grounded.)

The layout layer ALREADY has a mature vertical lane-reservation system that the
note-name placement decision must reckon with:

- `buildLayoutModel` computes a per-system `band` with `topMargin`, `bottomMargin`,
  `effectiveInterStaffGap`, and a `systemHeight` that FLEXES to fit stacked text lanes
  (tempo, ottava, dynamics, and the four annotation placement bands `aboveRH/belowRH/
  aboveLH/belowLH`, each `{ baseY, step, direction }`). When a band is empty its
  reserve collapses to the base value, so a names-free system keeps today's geometry
  (`layout.js:1852-1968`). Stack step = `NOTE_SIZE + TEXT_LANE_GAP`; dynamics reserve
  = `DYNAMICS_LANE_RESERVE`.
- Per-notehead anchors: each note record's `heads = [{ sFromBottom, y, side,
  displaced }]` give the exact notehead Y (hand-local) and side; `note.x` is the
  column X; `accidentals` sit to the LEFT (`note.x - acc.dx`); `ledgers` extend the
  notehead horizontally; chord heads can be `displaced` ~2·NOTEHEAD_RX to a side.

Two realistic placement architectures (fork to decide with researcher):

1. **Per-notehead adjacency (no lane reservation).** Draw each name as `<text>` next
   to its notehead at `head.y` (e.g. right of the head, or left of the accidental
   stack). No `systemHeight` change. Risk R10/AC13: collision with accidentals (left
   side), ledger lines, displaced chord heads, and tight chord clusters (names of
   stacked seconds overlap vertically). Needs a per-head dodge rule.
2. **Reserved name lane (mirror the dynamics/annotation lane machinery).** Reserve a
   horizontal name lane above/below each staff and stack names there. Clean
   separation, but names lose tight visual association with individual chord
   noteheads, and it grows `systemHeight`.

**Critical AC10 interaction (load-bearing):** whichever approach, the names-OFF output
must be byte-identical to today. If name geometry is computed INSIDE
`buildLayoutModel` and changes `systemHeight`/band reserves, that is acceptable ONLY
when names are requested — so the flag must reach `buildLayoutModel` (not just
`svg.js`) and, when OFF/absent, the model must be the exact bytes it is today. Keeping
ALL name geometry in the EMIT layer (`svg.js`, gated by the option) would guarantee
AC10 by construction (the shared model is untouched), but the emit layer is
deliberately "layout-math-FREE" (`svg.js:1-20`) — adding name positioning there fights
that contract and risks overlap because emit has no system-height budget. This
tension (where name geometry lives vs. AC10 byte-identity vs. the emit layer's
math-free contract) is the central design fork for Topics B/C/E. To be resolved.

### Topic E — Note-name placement / overlap geometry — DECIDED

**Spec served:** R10 / AC13 (names legible, not illegibly overlapping each other OR
noteheads / accidentals / ledger lines / dynamics / annotations / tempo / ottava).

**Framing (researcher, grounded):** The existing four placement bands
(`aboveRH/belowRH/aboveLH/belowLH`) are COLUMN-X annotation LANES for author free text —
they do NOT serve per-notehead names. Note names want to sit AT each notehead (per-head,
1:1 with R5). The spec bar is "legible, NOT ILLEGIBLY overlapping" (AC13) and spec.md:79
explicitly DEFERS exact placement/collision geometry to design — so a PRAGMATIC
placement is acceptable; full optimal engraving is NOT required.

**Geometry baseline (confirmed constants):** `NOTEHEAD_RX=0.6` (head ~1.2sp wide),
`NOTEHEAD_RY=0.5` (~1sp tall); a chord SECOND = 0.5sp apart (`staffStepToY`,
`layout.js:149`); `NOTE_SIZE=2.8`sp (=22.4px at `SP_PX=8`); column advance =
`MIN_ADV(0.5) + ADV_K(4.7)·sqrt(Δ)` (`constants.js:64-76`) → quarter ≈5.2sp, eighth
≈3.82sp, 16th ≈2.85sp; accidentals LEFT of head (`note.x − acc.dx`, `dx ≥
ACCIDENTAL_GAP=1.2`, `svg.js:751`); dots RIGHT (`note.x + dx`, `dx ≥ 1.1`, `svg.js:760`).
**Confirmed:** a full-`NOTE_SIZE` name AT `head.y` per head overlaps ~`2.8/0.5 = 5.6×`
in a chord — naive per-head at full size is ILLEGIBLE.

**Options considered:**
- **OPT-A — per-notehead adjacency (small font, no lane).** Name right of head+dots at
  `head.y`. PRO: tightest head association, ZERO `systemHeight` change, redraw-only.
  CON: hardest collision (tight chords need a vertical/horizontal dodge; horizontal
  crowding in fast runs where advance is 2.85-3.82sp; ledger collisions). Most dodge
  code, weakest AC13 guarantee on its own.
- **OPT-B — reserved name LANE (mirror the band/flex machinery).** Names in a row at
  each column X in a dedicated lane, flexing `systemHeight` only when names on. PRO:
  clean collision (own reserved space; reuses proven lane+flex `layout.js:1852-1942`);
  AC10 off-free (lane only when on). CON: a chord = multiple names at one column → they
  stack/join in the lane and LOSE the 1:1 head↔name spatial mapping (an R5-spirit
  weakness for tight clusters); grows `systemHeight` when on; needs its OWN lane keyed
  separately from the annotation bands.
- **OPT-C — per-head beside + small font + column-local dodge (HYBRID).** Name beside
  each head (right of head/dots, clear of LEFT accidentals) at `head.y`, in a NEW
  smaller `NOTE_NAME_SIZE`, with a dodge for clashing chord/run names reusing the proven
  in-repo `stackAccidentals` clash-shift algorithm (`layout.js:690-717`). PRO: honors
  R4/R5 per-head (name ON its note, every notehead named); small font + dodge meets
  AC13's pragmatic bar; SMALLEST collision surface with existing text (names sit at
  heads, NOT in the annotation/dynamic lanes); minimal/no `systemHeight` flex in the
  common single-note case → AC10 off-free, redraw-only, AC7 free. CON: the dodge is new
  geometry (but mirrors `stackAccidentals`).

**DECISION (Topic E):**
- **E-1 Placement: OPT-C (per-head beside the notehead, small font, column-local dodge).**
  Documented FALLBACK: OPT-B (reserved name lane) — the conservative choice if the
  implementation finds OPT-C's chord/run legibility insufficient in practice; it trades
  per-head spatial fidelity for maximum collision-safety. This is the ONE genuine design
  judgment call in the feature; OPT-C is chosen because it best honors R4/R5 while
  meeting AC13's "legible, not illegibly overlapping" bar without over-engineering.
- **E-2 Geometry of OPT-C (concrete formula).** Name `<text>` to the RIGHT of the
  notehead, at the head's true pitch height, `text-anchor: start` (grows rightward),
  clear of the LEFT-side accidental stack. In the note `<g>` (already at `note.x` in the
  staff frame):
  `x = note.x + NOTEHEAD_RX(0.6) + NAME_GAP(~0.4) + (head.displaced ? 2·NOTEHEAD_RX : 0)
  + (dotted ? dotReach : 0)`, where `dotReach ≈ NOTEHEAD_RX + DOT_OFFSET + (dots−1)·DOT_GAP`
  (push the name PAST the dots, which also sit right `svg.js:760`); `0` when undotted.
  `y ≈ head.y + NOTE_NAME_SIZE·~0.35` (a small baseline nudge so the cap-height centers
  on the head; `head.y` is the anchor). `NAME_GAP`/baseline are tunable against AC13.
- **E-3 Font size: new `NOTE_NAME_SIZE` constant = 1.8sp** (=14.4px at `SP_PX=8`),
  a tunable `*_SIZE` constant alongside `constants.js:180-189` (sibling of `NOTE_SIZE`).
  Locked at 1.8 (over the 1.6-2.0 range): 14.4px clears the ~11px screen legibility floor
  with margin for small/zoomed-out screens, while halving the chord overlap vs
  `NOTE_SIZE` 2.8 (vertical factor 5.6× → ~3.6×; the dodge handles the residual). Short
  content helps (English 1 char; Spanish ≤3 chars "sol"). Floor: do NOT go below ~1.4sp.
- **E-4 Chord/run dodge — parameterized REUSE of `stackAccidentals` (de-risked).**
  `stackAccidentals` (`layout.js:690-717`) is a greedy column-pack: it sorts top-down
  (`sort((a,b) => b.sFromBottom - a.sFromBottom)`), and for each glyph finds the nearest
  COLUMN with no already-placed glyph within a vertical CLASH THRESHOLD (3 staff-steps =
  1.5sp), bumping to the next column on clash (dx grows per column). It returns a
  deterministic, bounded, overlap-free packing — a PURE function (AC6-idempotent,
  AC10-safe since it never runs on the off-path). Reuse it as a TEMPLATE with two
  adaptations for names: (1) DIRECTION — names sit to the RIGHT of heads, so the dodge
  fans RIGHTWARD (positive dx) rather than accidentals' leftward; (2) THRESHOLD — widen
  the clash threshold to ≈4 staff-steps (the name's height in staff-steps at
  `NOTE_NAME_SIZE`) vs accidentals' 3. This is NOT new algorithm design — it is a
  parameterized clone of an existing, unit-tested routine, which de-risks the hardest
  part of OPT-C. RECOMMENDED variant: the HORIZONTAL column-dodge (fan names right, keep
  `Y = head.y`) over a vertical nudge — it keeps each name at its head's TRUE pitch
  height (the per-head association readers want) and matches the proven template; a
  vertical nudge (push clashing chord names apart in Y, like the annotation
  `STACK_STEP` stacking `layout.js:1884-1889`) is the noted alternative but risks staff-
  line/ledger collisions.
  **Two implementation tiers (the writer/planner may stage):** a NO-DODGE v1 is
  acceptable against AC13's "not ILLEGIBLE" bar for the common case — a 2-note chord
  (e.g. C/E, ~2sp apart) names barely touch at 1.8sp; only TIGHT clusters (seconds)
  truly overlap — so the dodge could ship as an enhancement. RECOMMENDED is to include
  the dodge (cheap reuse, clean AC13); both tiers are flagged so the plan can sequence
  them.
- **E-5 `systemHeight` impact — START at ZERO new reservation; gated flex is the
  contingency (load-bearing AC10 constraint).** Target ZERO `systemHeight` change: per-
  head names live BESIDE heads at `head.y` within the existing staff + ledger/margin
  envelope (a name is no taller than typical ledger reach, already reserved via
  `ledgerTopExtent` `layout.js:1896`). This keeps the off-path trivially byte-identical
  (no flex term touched) AND the on-path simpler. CONTINGENCY (not default): if QA finds
  a name on an EXTREME ledger note clips at the SVG viewBox edge, add a SMALL name-extent
  term to `topMarginLayout` / `bottomMargin` (`layout.js:1896/1938`), GATED
  `showNoteNames ? nameExtent : 0` so the off-path stays 0 = byte-identical. EVERY new
  vertical term, if added, MUST be 0 when names are off (AC10). (If the OPT-B lane
  fallback is ever taken, its lane + flex hooks at the band-build block
  `layout.js:1944-1990`, also gated on `showNoteNames`.)
- **E-6 Emit (svg.js).** Per head, when `head.name` is present (Topic C's single
  signal), `renderNote` (`svg.js:728-741`) appends a sibling `<text>` inside the note
  `<g>`, set via `textContent` (inert — the text-safety rule), `font-size =
  NOTE_NAME_SIZE`, stamped with an observability `data-*` (e.g. `data-note-name`). No
  reason it can't be a sibling text in the note group; it mirrors how accidentals/dots
  are appended there today.

**Rationale:** OPT-C is the placement that satisfies R5 (every notehead named, 1:1) and
R4 (name ON the note) while meeting AC13's pragmatic legibility bar — the spec defers
exact geometry, so a per-head + small-font + reused-dodge approach is right-sized. It
has the smallest collision surface with existing score text and needs no new lane in the
common case, keeping AC10's names-off byte-identity easy (all new vertical terms gated to
0 when off). OPT-B is recorded as the conservative fallback so the writer/planner has a
documented escape hatch if OPT-C proves visually insufficient.

### Topic D — preliminary grounding (control placement) + a CRITICAL wiring constraint

- **Frontend CSS today is `@font-face` ONLY** (`src/style.scss`). There is NO frontend
  rule for the wrapper, the block, or any control. The button needs net-new frontend
  CSS, added to `style.scss` (shipped via `block.json` `"style"`). No control-styling
  precedent on the frontend.
- **CRITICAL — `replaceChildren` destroys a wrapper-child button.** Today
  `container = getElement().ref` IS the `data-wp-interactive` WRAPPER div, and
  `renderInto(container, …)` ends in `container.replaceChildren(svg)` — it replaces ALL
  wrapper children with just the SVG (`view.js:73,90-94`). The `ResizeObserver` also
  observes that wrapper. So if the toggle button is SSR'd as a DIRECT child of the
  wrapper (the naive Topic A sketch), every draw would WIPE the button.
  **Resolution (decide in Topic D):** render.php must emit an INNER score container, and
  the SVG must render into THAT inner element (not the wrapper). Shape:
  ```
  <div data-wp-interactive …>            <!-- wrapper; survives -->
    <button … toggle directives …>       <!-- survives replaceChildren -->
    <div data-piano-score>               <!-- SVG renders here -->
  </div>
  ```
  `view.js` then targets the inner `[data-piano-score]` for both `renderInto` and width
  measurement / `ResizeObserver` (width must be the score box, not the wrapper that now
  also contains the button). This is a real change to the container model and touches
  Topic A's wiring (the watch draws into the inner container).
- **AC10 scope clarification (important).** AC10 / the future pinning test compare the
  SVG STRING output of `renderInto`/`renderSvg` (the `<svg>` tree), NOT the wrapper's
  sibling DOM. Adding a button + inner score `<div>` to the FRONTEND wrapper is frontend-
  only DOM and does NOT affect the SVG-string byte-identity the editor relies on —
  PROVIDED the SVG emitted (names OFF) is unchanged and the editor canvas is untouched.
  The editor (`SongCanvas`) keeps rendering into its own container with no button (R13/
  AC11). So the wrapper restructure is AC10-safe as long as the emitted SVG bytes don't
  change when names are off. (Confirm framing in Topic C.)
- Placement options for the button (decide in Topic D): (1) ABOVE the score (most
  discoverable, flows above the SVG, no overlap with responsive width); (2) BELOW the
  score; (3) OVERLAID corner (absolute-positioned over the SVG — risks covering
  notation, needs care). R1 only requires "visible and associated with its block's
  score"; R10 cares about name legibility, not button position. Leaning ABOVE.

### Topic D — Toggle control placement & container model — DECIDED

**Spec served:** R1 (control exists, visible + associated with its block's score), R5/R7
control (AC5 state to AT), R8/AC8 (label), and the no-button-covers-the-score aspect of
R10. Also fixes the container model that Topics A/F depend on.

**Evidence (researcher + the `wordpress-development` Interactivity API reference):**
- The `replaceChildren` bug is REAL: `getElement().ref` = the wrapper carrying the
  directive (`view.js:73`); `renderInto(container, …)` ends in
  `container.replaceChildren(svg)` (`svg.js:277`) and the `ResizeObserver` observes the
  wrapper (`view.js:103`). An SSR button as a DIRECT wrapper child is destroyed on the
  first draw and every resize.
- iAPI-blessed fix: `getElement().ref` is "the element carrying the directive" (skill
  reference, gotchas §); callbacks CAN `querySelector` children — the skill's focus-trap
  pattern does exactly `const { ref } = getElement(); ref.querySelector('…')`. Drawing
  into a CHILD is within the spec-authorized imperative carve-out.
- `data-wp-bind--hidden="!context.x"` is the canonical visibility gate (skill skeleton
  line 52). Seed every reactive value server-side incl. `false` starting values (hard
  rule 4). A button using `data-wp-text` must be EMPTY in markup (hard rule 10).
- The SVG is `role="img"` with a single `<title>` accessible name (`svg.js:235,254-256`);
  `role="img"` collapses children, so the per-head name `<text>` nodes are NOT
  individually announced — which MATCHES the spec's deferral of per-name SR exposure.
- Frontend CSS is `@font-face` only (`style.scss`); button styling is net-new there
  (shipped via `block.json` `"style"`).

**DECISION (Topic D):**
- **D-1 Container model (inner score host).** `render.php` emits the wrapper with the
  toggle `<button>` as a SIBLING child PLUS a dedicated inner score `<div>` (e.g.
  `.wp-block-piano-block-piano__score`). `view.js` keeps `getElement().ref` = wrapper,
  then `wrapper.querySelector('.…__score')` to get the score host; it `renderInto`s,
  MEASURES, and `ResizeObserver`-observes the INNER score div — never the wrapper. So
  `replaceChildren` wipes only the SVG inside the score div; the button survives. (This
  resolves RISK4 and updates Topic A's DESIGN-X: the watch draws into the inner score
  div.)
- **D-2 Width measurement / resize.** Measure + observe the inner score div (not the
  wrapper) — a button row above the score changes wrapper HEIGHT not width, but
  measuring the score div directly is unambiguous and future-proof. AC7 holds (the
  observer re-fires the watch redraw, which reads live `showNoteNames`). A
  display:none-while-hidden score div reports `clientWidth 0`, the same benign case
  `dom.js:19-29` already floors — and we only draw when conformant + nameable.
- **D-3 Placement: ABOVE the score.** The button sits above its own SVG in normal flow
  (discoverable, clearly associated with THIS block's score per R1, no overlap with
  notation per R10, no absolute-positioning/z-index). Net-new minimal button CSS in
  `style.scss` (margin/spacing below the button). Rejected: BELOW (less discoverable),
  OVERLAY (absolute positioning + collision risk with notation).
- **D-4 A11y.** Native `<button>` with `data-wp-bind--aria-pressed="context.showNoteNames"`
  carries the on/off state to AT (AC5). A FIXED label "Show note names" (via
  `data-wp-text` from context) self-labels the button (its text content IS its accessible
  name) — recommended over a Show↔Hide flip (state via `aria-pressed`, identity via fixed
  text is the cleaner AC5 story; the flip remains an allowed enhancement via a
  `state.toggleLabel` derived getter, see Topic A A-4). The in-SVG names are visual-only
  (consistent with the spec's no-per-name-SR deferral); toggling does NOT change the SVG
  `<title>` (the accessible name is song-level, unchanged).
- **D-5 Gating + FOUC.** `render.php` SSRs the button WITH the `hidden` attribute already
  present (so it is hidden from first paint), and seeds `hasNameableNotes: false`. The
  `data-wp-bind--hidden="!context.hasNameableNotes"` directive's initial computed value
  (with the seeded false) IS `hidden`, so the SSR `hidden` MATCHES the directive's first
  value — consistent (not a hard-rule-10 duplication), and FOUC-safe (no flash). `init`
  sets `hasNameableNotes` true only when conformant + ≥1 nameable note (Topic F), which
  un-hides the button. No-JS → the button stays hidden (never un-hidden) and no score is
  drawn — no dangling control, matching today's JS-only render.

**Rationale:** The inner-score-host container is the only structure that lets a declarative
SSR'd button (the skill-canonical wiring) coexist with the imperative `replaceChildren`
draw. ABOVE placement satisfies R1's "visible + associated" with zero overlap risk and no
positioning complexity. `aria-pressed` on a self-labeling native button is the idiomatic
AC5 control; the SSR-`hidden`-matches-seeded-state trick gives AC9/AC12 gating without a
FOUC.

### Topic F — Gating: when the control appears — DECIDED

**Spec served:** R11 / AC9 (no control when no nameable notes), AC12 (no score + no
control for empty/invalid song). Builds on Topic A's A-5 gating hook.

**Evidence (grounded):** `render.php` emits the wrapper for ANY non-empty song and
emits NOTHING (no wrapper) for empty/whitespace (`render.php` early `return`). The
render-or-nothing decision for a non-empty song is 100% client-side (`view.js`
`parseAndValidate`: any error → draw nothing). A note record exists in the layout model
ONLY for an event with ≥1 valid pitch — rests go to `rests`, not `notes` (Topic B). So
"has a nameable note" ≡ "the built model has ≥1 note record."

**DECISION (Topic F):**
- **F-1 Detection.** After `init`'s cached `parseAndValidate` succeeds, the client
  determines `hasNameableNotes` by checking the built layout model for ≥1 note record
  (e.g. `model.systems.some(s => s.measures.some(m => (m.right?.notes?.length || 0) +
  (m.left?.notes?.length || 0) > 0))`). This is exact (it reflects what actually renders)
  and reuses the model already built for the draw. (A parsed-song walk reusing `stepsOf`
  is an equivalent alternative; the model check is preferred since the model is already
  in hand and a pitch that filtered to `null` would not produce a note record.)
- **F-2 Button gating.** `render.php` SSRs the button but seeds `hasNameableNotes: false`
  in context; `init` sets it true ONLY when the song is conformant AND has ≥1 note
  record. The button's visibility binds to it (`data-wp-bind--hidden="!context.hasNameableNotes"`
  or equivalent). Empty song → no wrapper → no button (AC12). Invalid song → wrapper but
  `init` returns early, `hasNameableNotes` stays false → button hidden, no score (AC12).
  Conformant all-rests song → model has zero note records → `hasNameableNotes` false →
  button hidden (AC9).

**Rationale:** The model-based count is the single accurate signal for "something to
name," computed once where the draw already runs. Driving button visibility from a
client-set context flag is the only correct gate because conformance/nameable-note
presence is knowable only client-side (R6). Matches Topic A's A-5.

### Topic G — Reversibility / idempotency / resize-safety — DECIDED

**Spec served:** R7 / AC6 (reversible + idempotent, no drift), R9 / AC7 (names survive a
width-change redraw). Ratifies Topic A's A-6 (DESIGN-X funnel).

**Evidence (grounded, spec-research A5b confirmed):** the notation core is pure and
deterministic — no `Math.random`/`Date`/`performance.now`/`crypto` in `src/notation`;
`buildLayoutModel` + `renderSvg` are pure functions of `(data, width, options)`. Same
inputs → byte-identical SVG.

**DECISION (Topic G):**
- **G-1 Idempotency / no-drift (AC6).** Each redraw recomputes the model+SVG from scratch
  from the cached parsed `data` and the live `showNoteNames` — no accumulation. Because
  the render is pure, names-on render N equals render N+2; names-off restores the exact
  original bytes. Pinned by the AC10 test's idempotency assertion (Topic C: names-on
  rendered twice → identical `outerHTML`). No state machine, no in-place DOM mutation —
  it is a full `replaceChildren` of the inner score container each draw.
- **G-2 Resize-safety (AC7) via the single watch funnel.** The `data-wp-watch` redraw
  reads BOTH `context.showNoteNames` AND the width/resize signal (Topic A DESIGN-X), so a
  resize re-fires the same redraw path that reads the live `showNoteNames` → names persist
  across resize. The `ResizeObserver` (kept in `init`) writes the context width/nonce
  rather than calling draw directly, so there is no stale cached toggle bool (RISK3
  retired) and no `withScope` need.
- **G-3 Font gate (Wrinkle 3 ratified).** The FIRST draw still waits for the music font
  (`drawWhenFontReady`) so ornate glyphs are present on first paint; subsequent redraws
  (toggle/resize) need not re-wait (font cached). Concretely: `init` seeds a `fontReady`
  context bool (set true once `drawWhenFontReady` resolves) that the watch reads, OR the
  watch's first run awaits the font. Either keeps the funnel single-path; the seeded-bool
  form is preferred (keeps the watch synchronous and out-of-runtime font work in `init`).

**Rationale:** Purity makes AC6 free and machine-pinnable; the DESIGN-X single funnel
makes AC7 free by sharing one redraw path for toggle and resize. No new nondeterminism is
introduced (names are a pure function of the same cached data + system).

### Topic H — Default OFF & per-instance independence — DECIDED

**Spec served:** R3 / AC1 (default OFF), R6 / AC4 (per-instance independence), R12 (state
per instance). Consolidates the relevant parts of Topics A and C.

**Evidence (grounded):** iAPI local `data-wp-context` is per-instance by default and is
re-seeded fresh by `render.php` every request (no framework persistence — matches the
out-of-scope "no persistence"). The README pins per-instance isolation (`README:231`
two-block e2e). The extracted name module is pure/stateless (Topic C-4), so no shared
mutable state leaks across instances.

**DECISION (Topic H):**
- **H-1 Default OFF.** `render.php` seeds `showNoteNames: false` per instance; the first
  paint draws with no names (AC1). The toggle resets to OFF on each load (no persistence —
  out of scope), since context is server-seeded fresh per request.
- **H-2 Per-instance independence.** `showNoteNames`, `hasNameableNotes`, and the
  width/font signals all live in per-instance LOCAL context (NOT
  `wp_interactivity_state` global). A toggle mutates only its own block's context, so only
  that block's watch re-fires and only its inner score redraws with names (AC4). No global
  state, no cross-block coordination (R6/R12). The editor is a separate path with no
  toggle (AC11).
- **H-3 Test hook.** AC4 is naturally covered by extending the existing two-block e2e
  fixture (`README:231`): toggle names on block A, assert A shows name `<text>` AND B does
  not (and vice versa). (e2e scope — flagged for the doc/test plan, not unit.)

**Rationale:** Local context gives default-OFF and per-instance isolation by construction,
the exact properties R3/R6/R12 require, with the existing two-block e2e as the natural
regression guard.

## Open Questions

- OQ1 (Topic A) — RESOLVED. The imperative draw must RE-RUN on toggle via a
  `data-wp-watch` redraw (Route 1); CSS show/hide is rejected because it leaves name
  `<text>` in the names-off DOM (violates AC10). Names-off DOM has zero name nodes.
- OQ2 (Topics B/C/E) — RESOLVED. Name geometry lives in the LAYOUT layer (the name is
  resolved on each head in `layoutHand`), threaded by ONE flag site
  `buildLayoutModel(..., { showNoteNames, system })`; `svg.js` emits text iff
  `head.name` is present (no flag in `svg.js`). Any new vertical extent (Topic E) is
  gated on `showNoteNames` and is 0 when off, so the names-off model + SVG are byte-
  identical (AC10).
- OQ3 (Topic B) — RESOLVED. Thread the per-head step in `layoutHand`: build atomic
  `{ sFromBottom, step }` pairs BEFORE `stackChord`, attach the step (resolved to the
  final name via `stepInSystem`) onto each head so it rides the sort. Emit reads
  `head.name`.
- OQ4 (Topic A/B) — RESOLVED. Extract the system spellings + `stepInSystem` +
  `inferNoteNameSystem` + `stepsOf` into a shared frontend-safe module (sibling of
  `normalizeStep.js`, no `@wordpress/i18n`); editor `noteNames.js` re-imports; layout
  imports `stepInSystem`. Single source → frontend names equal editor names by
  construction (FR4). PHP mirror rejected (drift risk; names are JS-drawn, default OFF).

## Risks

- RISK1 (AC10) — MITIGATED. Any unconditional change to `buildLayoutModel`/`svg.js`
  output breaks the editor↔frontend byte-identity. Mitigation locked: one flag site
  (`buildLayoutModel`), default OFF, omit `head.name` when off, all new vertical terms
  gated to 0 when off, `el()` undefined-skip backstop, and an ADDED `outerHTML` pin test
  (Topic C). RESIDUAL: the implementer MUST keep EVERY name addition flag-gated — an
  unguarded line is the failure mode; the pin test catches it.
- RISK2 (AC13/R10) — MITIGATED, residual. Note names are net-new `<text>` with no
  reserved geometry; dense chords/runs and existing dynamics/annotation/tempo/ottava
  text are collision sources. Mitigation: Topic E OPT-C (per-head, small NOTE_NAME_SIZE,
  stackAccidentals-style dodge). RESIDUAL: OPT-C's legibility in extreme chords/runs is a
  judgment call against AC13's "not ILLEGIBLE" bar; OPT-B (reserved lane) is the
  documented fallback if QA finds OPT-C insufficient. Font size is a tunable constant.
- RISK3 (Topic A/G) — MITIGATED. A stale cached toggle bool on resize would drop names
  (AC7). Mitigation: DESIGN-X single watch funnel reads live `showNoteNames` each fire;
  the `ResizeObserver` writes context (no draw with a stale closure). No `withScope`
  needed.
- RISK4 (Topic D) — MITIGATED. `container.replaceChildren(svg)` on the wrapper would
  WIPE an SSR'd toggle button each draw. Mitigation: render into an INNER score
  container; the button is a surviving sibling (Topic D). Implementer must move
  `renderInto` + width-measure + `ResizeObserver` to the inner element.
- RISK5 (Topic B): The `stackChord` signature change (`number[]` → `{sFromBottom, step}[]`)
  breaks 4 existing unit tests (`layout.test.js:285/293/303/310`). Mitigation: the code
  plan MUST budget migrating those tests; keep `stemDirectionForChord` on `number[]`
  (map at the call site) to avoid touching its tests.
