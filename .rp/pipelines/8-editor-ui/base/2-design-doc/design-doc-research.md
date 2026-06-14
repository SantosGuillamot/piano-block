# Design Research: Editor UI for editing the song

## Research

Findings from exploring the codebase (file paths cited). These ground the design options below.

### Block wiring & storage
- The block is **dynamic / server-rendered**. `src/render.php` writes the raw `song` string **verbatim** into an inert `<script type="application/json">` inside the block wrapper; PHP does no parsing/validation. There is **no `save.js`**.
- `src/index.js` registers the block with only an `edit` component: `registerBlockType(metadata.name, { edit: Edit })`.
- `src/block.json` declares a **single attribute**: `song` (`type: "string"`, default `""`). This is the canonical store the front end reads.
- Current editor `src/edit.js`: a single `TextareaControl` (label **"Song (JSON)"**); validation via `useMemo(validateSong)` → non-blocking `Notice` (`status="error"`); the raw string persists **unconditionally** on every change via `setAttributes({ song })`.

### Rendering pipeline (reuse points for the live preview)
- `validateSong(raw)` — `src/song/validate.js`. Single gate; parses internally (a JSON parse failure is itself a conformance error) and returns `string[]` of human-readable, path-pointed errors (`[]` = conformant). Structural/field only — **no musical-timing checks**.
- `buildLayoutModel(song, widthInSp)` — `src/notation/layout.js`. **Pure**: takes the parsed song object + available width in staff-spaces (sp), returns a positioned plain-data layout model. No DOM, no scaling.
- `renderInto(container, model, { accessibleName })` — `src/notation/svg.js`. **Imperative**: builds an `<svg role="img">` DOM tree via `createElementNS` and mounts it into the given container element.
- Front-end glue `src/view.js` wires these together per block container: reads the script's `textContent`, runs `validateSong` (render-or-nothing), `JSON.parse`, computes `accessibleNameFor(metadata)` (exported from `view.js`), then draws — gating the **first** draw on the music font (`document.fonts.load('1em "PB Music"')`) and reflowing on a rAF-debounced one-way `ResizeObserver`. px↔sp uses `SP_PX` from `src/notation/constants.js`, with a narrower step-down below 480px.
- ⇒ The editor preview can reuse `validateSong` + `JSON.parse` + `buildLayoutModel` + `renderInto` directly. The font-ready gate, `accessibleNameFor`, and width→sp conversion currently live **inside `view.js`** (not a shared module) — reusing them means either extracting a small shared "draw a song into a container at a width" helper or duplicating that glue.

### Song model & validator
- `src/song/schema.js` — declarative schema-as-data, the single source of truth for conformance. `src/song/validate.js` interprets it (zero-dependency walker). `src/song/normalizeStep.js` encodes the **two-system note-name vocabulary** (English C D E F G A B + Spanish do re mi fa sol la si) and exports `isNoteName` / `normalizeStep`.
- Enumerated/bounded fields the UI can constrain directly: durations & `beatUnit` (whole…thirty-second), `beatType` (1/2/4/8/16/32), `beats` (int ≥ 1), `clef` (treble/bass/alto/tenor), `octaveShift` (−2..+2), `dynamic` (pp…sfz), `tie`/`slur`/`crescendo`/`decrescendo` (start/stop), barlines (regular/repeat-start/repeat-end/double/final), annotation `placement` (above/below) & `staff` (rightHand/leftHand), `pitch.octave` (0–9), `pitch.alter`/`alters` values (−2..+2), `dots` (0–2), `tempo.bpm` (> 0).

### Dependencies
- `package.json` has **no runtime dependencies**; `@wordpress/*` packages are provided/externalized by `@wordpress/scripts`. Using more `@wordpress/*` packages adds nothing to the outside-dependency footprint → satisfies the spec's WordPress-only constraint.
- Already imported across the codebase: `@wordpress/block-editor`, `@wordpress/components`, `@wordpress/element`, `@wordpress/i18n`, `@wordpress/blocks`, `@wordpress/dom-ready`.
- `@wordpress/components` primitives suitable for a conformant-by-construction form: `SelectControl` (enums), `TextControl`/`TextareaControl`, `NumberControl`, `ToggleControl`, `Button`, `Panel`/`PanelBody`, `Card`, `Flex`, `TabPanel`, `Modal`, `BaseControl`. `@wordpress/block-editor`: `InspectorControls`, `BlockControls`, `useBlockProps`.

### Tests
- e2e: `specs/editor.spec.js` locates the raw field by the label **"Song (JSON)"** and the `.components-notice.is-error` notice; `specs/render.spec.js` covers the front end. Unit tests under `src/**/__tests__` (Jest).
- Implication: introducing the visual editor changes the editor's default surface; the raw-field e2e tests will need updating in a later phase, and the raw field's accessible label + error notice must be preserved so its behavior (Req 10 / AC11) still holds.

### Convention
- `AGENTS.md`: never reference `.rp/` pipeline artifacts from shipped source or user-facing docs.

## Topics

> Note: the `Req N` references in the topic spec-links below follow the **Consolidated Requirements** list in `1-spec/spec-research.md` (1–12). The synthesized `design-doc.md` traces to the **authoritative `spec.md` Requirements (1–13)** and Acceptance Criteria (AC1–AC12). AC references are identical in both.

### Topic: Source of truth / state model

- **Spec link:** Requirement 5 (same single `song` string), Req 7/9 (two modes, round-trip fidelity), Req 12 (editor-only; front end reads the `song` string), AC7 (raw & visual share the song), AC9 (round-trip).
- **Options:**
  1. **String is the single source of truth; derive the model.** Keep the `song` string attribute as the only state. The visual editor parses it (when conformant) into a working object via `useMemo`, renders controls from it, and on each edit serializes a new object back to the string with `setAttributes({ song })`. Mirrors today's `edit.js` (which already derives validation from the string).
  2. **Parsed object in React state, synced to the string.** Hold a structured object in component state; mirror it to the `song` string on change and re-hydrate from the string when it changes externally.
  3. **Store the song as structured `block.json` attributes** instead of one string.
- **Trade-offs:**
  - (1) One source of truth → visual and raw can never disagree; integrates with WordPress block undo/redo and external edits for free; simplest mental model. Cost: re-parse/re-serialize per edit (negligible for typical songs) and canonical re-serialization (loses incidental formatting — already accepted, Req/Out-of-scope).
  - (2) Avoids re-parsing per render and can hold transient UI state, but creates a dual source of truth: sync bugs across external changes, undo/redo, and raw↔visual reconciliation. More surface for the two modes to drift (works against Req 5/AC7).
  - (3) Conflicts with the editor-only boundary (Req 12): `render.php`/`view.js` read the `song` string, so structured attributes would change storage/format → **out of scope**. Listed only to reject.
- **Decision:** Option 1 — the `song` string attribute is the single source of truth. The visual editor parses it into a working object (memoized) when conformant, and every edit serializes a fresh object back to the string via `setAttributes({ song })`.
- **Rationale:** Guarantees visual and raw modes can never disagree (Req 5, AC7) and that the front end always reads the same canonical string (Req 12); integrates with WordPress block undo/redo and external edits without custom sync; mirrors the existing `edit.js` pattern. Re-parse/re-serialize cost is negligible for typical songs (large-song perf is out of scope). Canonical serialization is acceptable per the round-trip fidelity decision (incidental formatting need not be preserved); note-name-system fidelity is handled separately (Topic 6).

### Topic: Editor layout & mode switching

- **Spec link:** Req 4 (visual default, raw available, placement deferred to design, not side-by-side), Req 5 (same song), Req 8 (live preview), AC1 (visual default), AC6 (preview updates), AC7 (raw shares song). Note Req 4's "not side by side" excludes visual-controls + raw-textarea both editable at once; a read-only preview beside the visual editor is fine.
- **Options:**
  1. **On-canvas editor + preview; raw JSON behind a toggle.** The block canvas shows the visual editor (default) with the live preview adjacent; a mode switch (toggle / block-toolbar button "Edit as JSON") flips the canvas between the visual editor and the raw-JSON textarea. Song-level settings (metadata/context) could optionally live in the inspector to declutter.
  2. **Modal song editor; canvas shows the preview.** The block canvas renders the live preview as the block's representation plus an "Edit song" button. The button opens a `Modal` holding the full visual editor (roomy) with a live preview pane and an in-modal switch to raw JSON. Canvas stays clean/WYSIWYG.
  3. **Inspector-driven editor; canvas shows the preview.** The canvas shows the live preview; all editing lives in the inspector sidebar (`InspectorControls` → collapsible `PanelBody` sections); raw JSON is a sidebar panel/toggle.
- **Trade-offs:**
  - (1) Everything in context, preview adjacent to controls, matches "visual is home, JSON tucked behind a toggle." But the canvas width can be tight for deep nesting (measures→events→pitches), and the inline UI grows very tall.
  - (2) Most room for full-coverage editing + side-by-side preview; the canvas stays clean and shows real notation (very friendly). But editing is a click away behind a modal, less inline.
  - (3) Idiomatic WordPress (settings in sidebar), preview always visible. But the sidebar (~280px) is too narrow for comfortable deep structural editing with add/remove/reorder; unwieldy for large songs.
- **Decision:** Option 1 — the **block canvas** is the editor surface. By default it shows the **visual editor** with the **live preview adjacent** (preview above the structured controls). A **mode switch** flips the canvas between the visual editor and the **raw-JSON textarea** — the existing field (label "Song (JSON)") with its non-blocking validation `Notice` preserved, reused as the JSON mode. The two are never editable simultaneously (Req 4); the read-only preview may sit alongside the visual editor.
  - **Switch control (sub-decision):** a clearly-labeled, accessible toggle to enter/leave JSON mode. Recommended: a `BlockControls` toolbar button ("Edit as JSON") and/or a segmented toggle at the top of the block; the visual editor is the **default** mode (AC1). Exact control styling left to implementation.
  - **Inspector:** keep the editor on the canvas for cohesion; the inspector sidebar is optional/minimal (e.g., could host the mode switch or future display options) — not required for v1.
- **Rationale:** Matches "visual is the friendly default, JSON tucked behind a toggle" (Req 4, AC1); keeps editing, preview, and the result in one in-context surface (AC6); reuses the existing raw field unchanged as the JSON mode, preserving its store-unconditionally + informational-validation behavior (Req 10, AC11) and its accessible label/notice. The owner chose on-canvas over a modal/inspector despite the canvas-width tightness for deep nesting (mitigated by the component decomposition in the next topic).

### Topic: Navigation / disclosure model for the deep hierarchy (drives component decomposition)

- **Spec link:** Req 2 (full coverage), Req 3 (add/remove/reorder at every level), Req 6 (musically literate), AC3/AC4. Mitigates the canvas-width tightness from the layout decision.
- **Options:**
  1. **Drill-down (one level at a time, with breadcrumb).** Song overview → Sections list → a Section (its measures) → a Measure (its two hands' events) → an Event (pitches, duration, dynamics, articulations…). Click to drill in; breadcrumb to climb back. Component tree mirrors levels (`SongEditor` → `SectionList`/`SectionEditor` → `MeasureList`/`MeasureEditor` → `HandEventList`/`EventEditor` → `PitchList`/`PitchEditor`, plus `MetadataEditor`, `ContextEditor`, `AnnotationEditor`).
  2. **Nested accordions (collapsible panels).** Each level is a collapsible panel containing its children; multiple levels can be open at once. Same component tree, rendered nested rather than navigated.
  3. **Two-pane outline + detail.** A tree/outline of the whole song on one side; selecting a node edits its fields in a detail pane.
- **Trade-offs:**
  - (1) Each screen stays simple and fits a narrow canvas; scales to deep/large songs. Cost: more clicks to a leaf; less cross-level context visible at once. Preview stays visible to compensate.
  - (2) Idiomatic and lets you see context across levels; simplest to build. Cost: deep indentation grows very tall/noisy for non-trivial songs on a narrow canvas.
  - (3) Powerful for big songs. Cost: needs width (tight on canvas) and is the most complex to build; weakest fit for on-canvas.
- **Decision:** Option 1 — **drill-down with breadcrumb** (owner delegated the choice). Levels: **Song overview** (metadata + defaults/context + sections list) → **Section** (its context overrides + measures list) → **Measure** → (drill into) **Event**. Refinement to keep note entry fluid: the **Measure** view edits **both hands' event lists in place** — each event shown as an editable row (type/duration/dots/dynamic/articulations + add/remove/reorder) — and drilling into an **Event** is reserved for its deeper detail (the chord's `pitches` list, event annotations). The live preview stays visible across all levels to orient the author. Component tree: `SongEditor` → { `MetadataEditor`, `ContextEditor` (shared by defaults & per-section overrides), `SectionList` → `SectionEditor` → `MeasureList` → `MeasureEditor` → per-hand `EventList` → `EventRow`/`EventEditor` → `PitchList` → `PitchEditor`; plus `AnnotationEditor` for event- and measure-level annotations, and `BarlineControl` }.
- **Rationale:** Best fit for the on-canvas narrow width chosen in the layout topic; each screen stays simple (supports the "friendly" goal, Req 6) and scales to deep/large songs (Req 2). In-place event-list editing avoids excessive drilling for the common task of entering a run of notes (AC3/AC4). Accordions (2) grow noisy/tall on a narrow canvas; two-pane (3) needs width the canvas lacks. Cost (more clicks to a leaf) is mitigated by the always-visible preview and in-place measure editing.

### Topic: Add / remove / reorder mechanism

- **Spec link:** Req 3 (add/remove/reorder at every level), Req 11 (WordPress-only deps), Req 6 (musically literate authors), AC4.
- **Context:** `@wordpress/components` exposes no clean public sortable-list primitive (`DropZone` is for media drops; core's list-view DnD isn't a reusable public API). Native HTML5 drag events are dependency-free but custom.
- **Options:**
  1. **Move up/down buttons + add/remove buttons** at each list level. Dependency-free, keyboard-accessible, simple.
  2. **Native HTML5 drag-and-drop** reordering. No extra dependency, more fluid, but custom to build and weaker accessibility unless paired with keyboard alternatives.
  3. **Both** — drag handles for mouse plus up/down buttons for keyboard/a11y.
- **Trade-offs:**
  - (1) Cheapest, most robust, fully accessible; reorder is click-per-step (fine for typical list sizes). Best constraint/a11y fit.
  - (2) Nicer for long lists, but more code, browser-DnD edge cases, and an explicit keyboard fallback still needed to stay accessible.
  - (3) Best UX + a11y but the most to build and maintain.
- **Decision:** Option 1 — **move up / move down buttons plus add / remove buttons** on each list item, at every level (sections, measures, events per hand, pitches, annotations).
- **Rationale:** Dependency-free (Req 11), fully keyboard-accessible, simplest and most robust; one-click-per-step reordering is fine for typical list sizes (large-song optimization is out of scope). Satisfies Req 3 / AC4 without custom drag-and-drop machinery.

### Topic: Conformant-by-construction enforcement (control mapping)

- **Spec link:** Req 7 (conformant by construction; no timing checks), Req 2 (full coverage), AC5. (Internal/architectural — recorded for owner review.)
- **Approach:** Map every field to a constrained `@wordpress/components` control so invalid states are unreachable, then serialize the working object with `JSON.stringify`:
  - **Enums → `SelectControl`**: `duration` & `beatUnit` (whole…thirty-second), `beatType` (1/2/4/8/16/32), `clef` (treble/bass/alto/tenor), `dynamic` (pp…sfz), `tie`/`slur`/`crescendo`/`decrescendo` (start/stop, plus an "unset" choice), `barlineStart`/`barlineEnd`, annotation `placement` (above/below) & `staff` (rightHand/leftHand), event `type` (note/rest).
  - **Bounded numbers → `NumberControl`** with min/max/step: `beats` (≥1), `octave` (0–9), `alter` & `alters` values (−2..+2), `octaveShift` (−2..+2), `dots` (0–2), `tempo.bpm` (>0).
  - **Note names** → constrained input (Topic 6).
  - **Free text → `TextControl`/`TextareaControl`**: `metadata.title`/`composer`, annotation `text`.
  - **Optional fields** appear only when added; removing them omits the key (rather than writing an invalid empty value).
  - **The one conditional invariant** ("a `note` requires a non-empty `pitches`"): adding a note seeds one pitch; the UI prevents deleting a note's last pitch (or switching `type` to `rest` drops `pitches`). A `rest` exposes no pitches.
- **Safety net (sub-decision):** keep enforcement in the controls, AND run the existing `validateSong` on the serialized string as a defensive guard before `setAttributes` so a latent bug can never silently persist a non-conformant song from visual mode. In visual mode this should always pass (no error UI is shown there); it is belt-and-suspenders reusing existing code.
- **Decision:** Constrained controls (as above) + serialize-time `validateSong` guard.
- **Rationale:** Makes non-conformant output unreachable by construction (AC5) while covering full model coverage (Req 2); the guard is cheap insurance reusing the single source-of-truth validator; no musical-timing checks are added (Req 7).

### Topic: Note-name input & two-system fidelity

- **Spec link:** Req 9 / AC9 (preserve the note-name system used, e.g. `do` stays `do`), Req 7 (conformant by construction), Req 6 (musically literate). Uses `isNoteName`/`normalizeStep` from `src/song/normalizeStep.js`.
- **Options:**
  1. **Free-text note-name input, validated live against the vocabulary.** Author types a name in either system; only a recognized name commits. Preserves exactly what's typed (perfect fidelity, incl. songs that mix systems). Cons: typing rather than picking; needs inline guidance on allowed values.
  2. **Dropdown (`SelectControl`) + a per-song note-name system setting.** A song-level English/Spanish setting; each pitch's step is picked from that system's 7 names. On load, infer the system from existing pitches. Cons: a single per-song system can't preserve a song that *mixes* systems — those steps would be normalized to one spelling (changes `do`→`C`), violating AC9 for the (rare) mixed case.
  3. **Per-pitch dropdown listing both systems' names (14 items).** Each pitch independently picks any of the 14 names; preserves per-pitch system perfectly, including mixes. Cons: a longer list; mixing within a chord is possible but unusual.
- **Trade-offs:** (1) max fidelity + simplest, least "pick-from-list"; (2) friendliest picking + clearly conformant, but breaks AC9 for mixed-system songs; (3) fidelity + picking, at the cost of a longer menu.
- **Decision:** Option "Dropdown + per-song system". A song-level **note-name system** setting (English / Spanish). Each pitch's `step` is chosen from that system's 7 names via `SelectControl`. To protect fidelity as far as possible:
  - On load, the per-song system is **inferred** from the existing pitches (the system of the song's pitches; default **English** for an empty/new song).
  - Existing `step` values are **preserved verbatim** in the working model; a pitch's stored spelling is only rewritten into the per-song system if the author **edits that pitch** (new pitches use the per-song system). So untouched pitches always round-trip exactly.
- **Rationale:** Friendly pick-from-list authoring for musically literate users; conformant by construction. For the common **uniform-system** song (incl. AC9's all-Spanish example) the inferred setting matches every pitch, so the round-trip preserves the system exactly. The verbatim-until-edited rule means even untouched pitches in a mixed song are preserved.
- **Limitation (see Open Questions / Risks):** in a song that **mixes** systems, editing a pitch rewrites *that* pitch's step into the per-song system, and the single per-song setting cannot display both systems at once. This narrows AC9's guarantee to uniform-system songs (and untouched pitches). The owner chose this option aware of the caveat; flag at design review for an explicit AC9 refinement.

### Topic: Invalid-song gating & empty-state in the visual editor

- **Spec link:** Req 6 (valid-song requirement; empty = fresh; non-empty invalid → fix in raw JSON), AC2 (start from scratch), AC8 (invalid directed to raw JSON). (Determined by the spec — recorded for owner review.)
- **Decision:** The visual editor branches on `validateSong(song)` (memoized from the string source of truth):
  - **Empty / whitespace** → "no song": show an **empty state** with a "start a new song" affordance. The `song` string stays `""` until the author adds content; the first added section/measure serializes a minimal conformant song (`{ sections: [ … ] }`, satisfying the schema's required `sections`). (AC2)
  - **Non-empty + conformant** → parse and drive the full visual editor. (AC3/AC4)
  - **Non-empty + invalid** (bad JSON or non-conformant) → the visual editor does **not** edit it; it shows the `validateSong` error message(s) and a clear prompt/button to **switch to raw JSON** to fix it. Visual editing resumes automatically once the song validates. (AC8)
- **Rationale:** Directly realizes Req 6 by reusing the single validator as the gate; the empty state enables from-scratch authoring (AC2) without requiring raw JSON; the invalid state never tries best-effort parsing (explicitly out of scope) and routes the author to the always-available raw mode (AC8). The raw-JSON mode itself is the unchanged existing field, so its store-unconditionally + informational-validation behavior (Req 10/AC11) is preserved.

## Open Questions

- **Mixed note-name systems vs AC9 — RESOLVED (owner-confirmed).** AC9 is read as "one note-name language per song": a Spanish song stays Spanish, an English song stays English (the per-song system preserves this exactly, plus any untouched pitch). The only narrowed case — a single song that mixes systems within itself — normalizes an edited pitch to the per-song spelling; the owner accepted this. Future note-name languages (e.g. German) are out of scope now but the per-song-system approach generalizes to them (extend `normalizeStep.js`).

### Topic: Live preview integration (React ↔ imperative renderer)

- **Spec link:** Req 8 (live preview), AC6 (updates on edit), AC10 (renders identically to the front end), Req 11/12 (WordPress-only; editor-only boundary).
- **Mechanism (common to both options):** the editor preview is a React component that holds a container ref and, in a `useEffect` keyed on the (valid) song + measured width, runs `validateSong` → `JSON.parse` → `buildLayoutModel` → `renderInto(ref, model, { accessibleName })`. The notation **core is reused as-is**, so the editor's notation is identical to the front end (AC10). Width can be measured via the existing approach (container width → sp through `SP_PX`).
- **The choice is only about the thin glue** (font-ready gate, width→sp, `accessibleNameFor`) currently inside `src/view.js`:
  1. **Extract a shared helper** (e.g. `notation/draw.js` exporting a "draw this song into this container at this width" function), and refactor `view.js` to use it too. One code path; no editor/front-end drift. Entails a **behavior-preserving** edit to `view.js` (front-end output unchanged).
  2. **Duplicate the thin glue** in the editor; leave `view.js` untouched.
- **Trade-offs:** (1) DRY, best guards AC6/AC10 against drift, but modifies `view.js` (within the editor-only boundary only if output is provably unchanged); (2) zero risk to `view.js`, at the cost of a little duplicated glue that could drift.
- **Decision:** Option 2 — **duplicate the thin glue in the editor; leave `view.js` untouched.** The editor preview depends only on the **pure notation core** (`buildLayoutModel` from `notation/layout.js`, `renderInto` from `notation/svg.js`, plus `notation/constants.js`/`glyphs.js`) and `validateSong` — **not** on `view.js`. It owns its own React-side wiring: the font-ready gate, container-width→sp conversion, and accessible-name computation (a small duplicate of `accessibleNameFor`).
- **Rationale:** Owner intent — `view.js` is expected to migrate to the **WordPress Interactivity API** (a front-end-only concern that doesn't apply to the editor). Coupling the editor preview to `view.js` would entangle it with code slated to be rewritten; duplicating the thin glue keeps the editor independent of that migration. AC10 (identical notation) is still guaranteed because the **rendering core** (`buildLayoutModel` + `renderInto`) is shared — only the presentational glue is duplicated. Avoids modifying `view.js`, fully respecting the editor-only boundary (Req 12).

## Risks

- **AC9 narrowing for mixed-system songs** (from Topic 6): a song mixing English + Spanish note names may have edited pitches normalized to the per-song system. Low likelihood (mixing systems within one song is unusual) but worth recording so the code-writer and docs don't over-promise full-fidelity round-tripping of mixed-system songs.
- **Re-serialize + live preview on each edit** (from Topics 1 & 7): every edit re-serializes the song and redraws the preview. Fine for typical songs; large-song performance is explicitly out of scope. If needed later, the preview redraw can be debounced (the front end already uses a rAF-debounced resize) — note for the code-writer, not a v1 requirement.
- **Future `view.js` → Interactivity API migration** (from Topic 7): the editor preview is intentionally decoupled from `view.js`. The shared **notation core** (`layout.js`/`svg.js`/`constants.js`/`glyphs.js`) must remain framework-neutral so both the editor and a future Interactivity-API front end can use it. Flagged so the migration doesn't accidentally pull editor-only concerns into the core or vice versa.
- **e2e tests target the raw field** (`specs/editor.spec.js`): they locate the field by label "Song (JSON)" and the `.is-error` notice. Introducing the visual editor as the default surface means these tests (and selectors) must be updated in the Code phase; the raw field's label + notice must be preserved (Req 10/AC11) so its behavior is still reachable and testable from JSON mode.
