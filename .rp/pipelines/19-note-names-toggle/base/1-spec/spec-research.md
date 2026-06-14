# Spec Research: Frontend toggle to show note names

## Rough idea

On the frontend (the rendered piano block on a published page/post), a viewer can toggle the display of note names on and off. Note names are pitch labels (e.g. C, D, E in English or Do, Re, Mi in Romance/solfège systems) associated with the notes the block renders. When the toggle is on, note names are visible; when off, they are hidden. The toggle is a viewer-facing control rendered with the piano block.

Note: research clarified the frontend renders the song as engraved music notation (noteheads/stems/accidentals drawn in SVG), not as labeled piano keys. Note names are currently NOT shown on the frontend at all. So this feature ADDS note-name display plus a toggle to control it.

Hard constraint: the frontend interactivity (the toggle behavior) must be built with the WordPress Interactivity API.

## Q&A

_(Questions to spec-researcher and their answers, recorded in real time.)_

### Q1 — How does the frontend piano render note names today?

**Question:** What file renders the frontend piano? Do note names already show on frontend keys? What does `src/editor/noteNames.js` do? Any existing attribute controlling note-name display?

**Answer (spec-researcher):**

1. **No note names render on the frontend today.** `src/notation/svg.js` draws noteheads/stems/accidentals only — zero pitch-name text. Note-name strings (C / do) are produced ONLY in the editor (`src/editor/noteNames.js`, used by `edit.js`) for the structure tree and pitch editor. The frontend never shows them.

2. The layout model note records (`src/notation/layout.js` ~line 1542) carry positions/heads/accidentals but NOT step / note-name. `heads = {sFromBottom, y, side, displaced}`. So rendering note names would need to either thread the step into the model OR recompute it in emit from the raw pitch. Note-name is derivable: `normalizeStep` + `stepInSystem` (in `noteNames.js`). The system = `song.language ?? inferNoteNameSystem(song)`.

3. The frontend today: `render.php` emits ONE childless `<div data-wp-interactive data-wp-init="callbacks.init">`. No button/input/label exist. The toggle would be the FIRST interactive UI on the frontend.

4. The SVG is drawn IMPERATIVELY in `view.js` `callbacks.init` (a `draw` closure → `renderInto` → `container.replaceChildren`). This is a spec-authorized carve-out, NOT declarative directives. A `ResizeObserver` re-runs `draw` on width change. A toggle redraw would naturally hook this imperative draw, not pure directives.

5. **iAPI constraint (hard):** toggle state belongs in LOCAL context (per-instance, the iAPI default), not global state — otherwise two blocks on a page would share the toggle. The UI control = `data-wp-on--click` action mutating a context boolean. Button text / aria via directives, but the SVG note-name show/hide lives in the imperative draw (must redraw or CSS-hide).

6. **Open design questions surfaced (to resolve as requirements where observable):** (a) toggle default on/off? (b) per-instance vs page-wide? (c) which notes get names — both hands? rests? chords (multi-name)? (d) octave shown? (editor `noteLabel` deliberately OMITS octave) (e) accidental / Spanish-vs-English spelling in name? (f) control label / icon / a11y (aria-pressed)? (g) note-name text position in SVG (no lane reserved now).

**IMPORTANT framing correction (follow-up from researcher):** The block renders SHEET MUSIC — a grand staff with noteheads, stems, clefs, beams — NOT a piano keyboard with keys. There is no keyboard / white-key / black-key code anywhere (grep clean). The issue's wording "piano keys" is loose; the real surface is notehead pitches on a staff. **The spec should say "note names on notes/noteheads", not "on keys".**

Additional render facts confirmed:
- `render.php:77` emits the wrapper: `<div data-wp-interactive="piano-block/piano" ... data-wp-init="callbacks.init" <?php echo get_block_wrapper_attributes(); ?>></div>` — the div is EMPTY server-side (no SVG, no text). The song + `accessibleName` are seeded into per-instance iAPI context.
- Empty song → `render.php:63-64` outputs nothing — NO wrapper div is emitted at all.
- `view.js` is the iAPI store module (`viewScriptModule`). `callbacks.init` reads song + accessibleName from `getContext()`, runs `parseAndValidate`, builds a `draw` closure, calls `drawWhenFontReady(draw)`, attaches a `ResizeObserver`. `draw` → `renderInto(container, model, {accessibleName})` → `container.replaceChildren(svg)` (`view.js:92-95`).
- `svg.js` draws: noteheads (ellipses), stems, flags, accidentals, ledgers, dots, rests, clefs, barlines, dynamics text, tempo, ottava, author annotation text. ZERO pitch-name text. Feature is net-new.
- `src/editor/noteNames.js` is EDITOR-ONLY. Imported by `edit.js`, `HandConfigEditor.js`, `StructureTree.js`, `PitchEditor.js`, `PitchList.js`, `inspector/NotePanel.js`, `inspector/SongPanel.js`. NEVER by `view.js` / `svg.js` / `render.php` / any frontend file. Exports: `inferNoteNameSystem`, `noteNameOptions`, `stepInSystem`, `noteLabel`, `mapSong`. So note-name STRING logic exists but is wired only to editor UI.
- Block has only ONE attribute — `song` (`block.json:13`, `"song": {"type":"string","default":""}`). NO attribute/setting controls note-name display. No existing toggle anywhere.

### Q2 — Default state, persistence, scope, and gating of the toggle

**Question:** What default (visible/hidden)? Should the choice persist across reload/navigation? Is the toggle per-instance or page-wide? Is the toggle always rendered or only when there are notes to name? Cite author intent if any.

**Answer (spec-researcher):**

**Author intent: SILENT.** The issue, `intent.md`, README, `docs/song-format.md`, and `AGENTS.md` have NO mention of a note-name toggle and NO default/persistence/a11y convention for it. Feature is net-new (not even in the README "Forthcoming" list). Recommendations below are reasoned from existing precedent.

**(a) DEFAULT on load — recommend HIDDEN (note names OFF by default).**
Reasons: (1) sheet music renders today with NO names, so names-off keeps the current visual unchanged for existing posts (least surprise); names become an opt-in enhancement. (2) Names overlay adds visual clutter on dense scores; learner opt-in matches the README goal "learn and train piano skills" (reveal-on-demand). (3) Progressive disclosure is already a plugin pattern (`README:45` — panels hide less-common options). No accessibility default forces either direction. Weak signal — flag as a decision, but HIDDEN is safest.

**(b) PERSISTENCE — recommend NO persistence (reset to default each load) for v1.**
Confirmed ZERO persistence in the plugin today: grep for `localStorage` / `sessionStorage` / `cookie` / `URLSearchParams` / `history.pushState` across `src` is clean. iAPI local context is NOT persisted by the framework — the server re-seeds context fresh every page load (`render.php` builds `$context` per request); the client hydrates from it; no built-in storage. Persisting across reload/nav would be explicit net-new work (localStorage or URL param) with no precedent → recommend OUT OF SCOPE for v1. Toggle resets to default on reload.

**(c) SCOPE — confirmed PER-INSTANCE, independent toggle. Strong precedent.**
`README:231` has an explicit e2e guard: "two Piano blocks on one page... each renders independently... no cross-talk... guarding against shared global state." The plugin VALUES per-instance isolation. iAPI default = local context per instance. A page-wide single toggle would need global `wp_interactivity_state` shared across instances — which CONTRADICTS the isolation guard. Recommend per-instance. No cross-block coordination exists anywhere today.

**(d) GATING — toggle renders ONLY when the piano actually renders nameable notes.** Current states:
- Empty/whitespace song → `render.php:63-64` `if ('' === trim($song)) return;` → NO wrapper output at all (no div, so no toggle possible/needed).
- Invalid JSON / non-conformant → wrapper div IS emitted (server emits for any non-empty song), but `view.js:83-85` `parseAndValidate` errors → `return` → draws nothing, container stays empty. `README:82`: "non-renderable song renders nothing — no raw echo, no error."
- Conformant → SVG drawn.
So the server always emits the wrapper for a non-empty song, but the client may draw nothing (invalid). The toggle UI must NOT appear when nothing is rendered. Cleanest: gate toggle visibility on a successful render (conformant + has nameable notes). **Open sub-question for the spec:** a conformant song that is ALL rests / has zero pitches has no names to show → recommend the toggle appears only when ≥1 named note exists. Flag as an acceptance criterion.

**Net recommended defaults:** HIDDEN, no-persist, per-instance, toggle shown only when the piano draws nameable notes.

### Q3 — What is a "note name" (content + coverage)?

**Question:** When names are ON, exactly what text shows and on which notes? Naming system (English vs solfège)? Accidentals? Octave? Coverage (both hands, chords, ties, rests)? Any unnameable pitch?

**Answer (spec-researcher — ran `noteNames.js` live as source of truth):**

**(a) NAMING SYSTEM — the song's OWN system, NOT a viewer choice.** System = `song.language ?? inferNoteNameSystem(song)` (exact logic at `edit.js:167`). `language` is a stored field (`"english"` / `"spanish"`); if absent, infer from the spellings used (Spanish if any do/re/mi… appear, else English); a new song defaults to English. **The toggle is SHOW/HIDE only — it never picks the system.** The frontend MUST reuse the same resolution so author and viewer agree. (Note: `noteNames.js` does not infer per-call — the caller resolves the system once, then passes it to `noteLabel` / `stepInSystem`. The frontend must do the same: resolve the system from the parsed song, then pass it down.)

**(b) ACCIDENTALS — NOT spelled in the name (big finding).** `stepInSystem` + `noteLabel` use ONLY `pitch.step` (the letter/syllable) and IGNORE `pitch.alter` entirely. Live outputs:
- `C#4` (step C, alter 1), english → `"C"` (NOT "C#")
- `C#4`, spanish → `"do"`
- `Bb4` (step B, alter -1), english → `"B"` (NOT "Bb")

So a sharp/flat note shows the bare letter — no `#` / `b` / "sharp" word in the text. This matches editor structure-tree behavior exactly. The accidental still shows VISUALLY as the SVG accidental glyph next to the notehead (`svg.js` draws it); it is just absent from the text name. **Spec decision flagged:** frontend should MATCH the editor (bare letter — recommended for consistency) rather than enrich the name with the accidental (which would be a divergence and net-new logic). **Recommend: match editor = bare step letter/syllable.**

**(c) OCTAVE — confirmed OMITTED.** `noteLabel` / `stepInSystem` output zero digits; `C#4` → `"C"`, never `"C4"`. `noteNames.js:144-145` comment is explicit: "octave intentionally omitted (C4/C5 ambiguity deferred)." Frontend names omit octave too (match). So `C4` and `C5` both show `"C"`.

**(d) COVERAGE — nameable kinds:**
- **Both hands:** yes. The schema treats `rightHand` / `leftHand` as identical event arrays. Names apply to both staves (treble + bass); no hand distinction in naming.
- **Chords:** every notehead is named, space-joined. Chord C-E-G → english `"C E G"`, spanish `"do mi sol"`. One name per pitch in the stack.
- **Rests:** NO name. (`noteLabel` rest branch returns the string `"rest"` for the editor tree only; on the rendered score a rest is silence/no pitch → no pitch-name shown.) Confirmed: rests get no note name.
- **Tied notes:** `noteLabel` / `stepInSystem` operate per-event with NO tie awareness — each tied note is its own event and would each get its own name. A tie is just a span marker (`event.tie` start/stop) and does not suppress naming. So a tied note repeats its name on each notehead (both ends named). **Spec flag (minor):** recommend naming each notehead uniformly (simplest, tie-agnostic, matches the per-event model).

**(e) UNNAMEABLE pitch — NONE in a conformant song.** The schema `event.type` enum is ONLY `["note", "rest"]` (`schema.js:149`) — there is NO unpitched/percussion type in the format. A note REQUIRES non-empty `pitches` (`schema.js:174-176`); each pitch REQUIRES a recognized `step` (validated) + `octave`; `alter` is optional. So every conformant note has a derivable name. `normalizeStep` returns null only for an unrecognized step, but the validator already rejects those (non-conformant → whole song renders nothing → no toggle). Edge: a malformed pitch slipping through (e.g. missing step) → `stepInSystem` falls back to the system's first name (`names[0]` = "C" / "do") per `noteNames.js:136`, throw-free; but the validator gates this out before render anyway.

**Nameable vs not (the full set — only two event types exist):**
- `note` (has pitches) → NAMEABLE (one name per pitch)
- `rest` → NOT nameable (no pitch)

**Net:** a note name = the bare letter/syllable in the song's system, with NO accidental and NO octave; applies to both hands; per-notehead for chords; rests get none; every conformant note is nameable. Recommend the frontend reuse `noteNames.js` `stepInSystem` (or its `normalizeStep` core) so frontend names equal editor names byte-for-byte.

### Q4 — The control itself (type, label, a11y) and interaction edges (resize, no-JS, editor scope)

**Question:** What control type? Label text + i18n? Accessibility state/announcements? Resize behavior? No-JS behavior? Does this touch the editor or is it frontend-only?

**Answer (spec-researcher):**

**(a) CONTROL TYPE — recommend a native `<button>` toggle with `aria-pressed`.**
- `view.js` is PLAIN DOM / iAPI, NOT React. `@wordpress/components` (ToggleControl, etc.) is React-only, editor-bundle, and NOT available in a `viewScriptModule`. The frontend cannot use ToggleControl.
- The plugin has NO ToggleControl/CheckboxControl anywhere (grep clean). The editor uses SelectControl / NumberControl / TextControl only. So there is no binary-toggle precedent to copy.
- The WP-standard frontend iAPI pattern is `<button data-wp-on--click="actions.toggle" data-wp-bind--aria-pressed="context.show">`. A native button + `aria-pressed` is idiomatic for show/hide. (Checkbox+label is also valid, but the button-toggle matches the skill example and is simpler.)
- **Recommend:** a `<button>` with label text inside, `data-wp-on--click` action that flips a context boolean, and `data-wp-bind--aria-pressed` reflecting state.

**(b) LABEL TEXT — recommend "Show note names"; MUST be translatable, sourced from PHP.**
- The frontend has ZERO user-facing translatable text in `view.js` today — `view.js` imports ONLY `@wordpress/interactivity` (no i18n). All current i18n is PHP-side (`render.php` uses `_x`/`__` for the accessible name; `accessibleName.js` `__` runs in the editor bundle).
- `view.js` is a SCRIPT MODULE. Importing `@wordpress/i18n` into a `viewScriptModule` is NOT the established pattern here. The existing precedent is EXACTLY to compute translated strings in PHP and pass them to the module via context: `render.php` already computes the accessible-name label in PHP and passes it via context.
- **Recommend:** compute the button label(s) in `render.php` with `__( 'Show note names', 'piano-block' )` (and a "Hide" variant if the label flips), seed into context (or `wp_interactivity_config`), and have the button read it via `data-wp-text` / `data-wp-bind`. This matches the existing `accessibleName` transport pattern. Textdomain is `piano-block` (`block.json:11`).

**(c) A11Y:**
- The control needs an accessible on/off state → `aria-pressed="true|false"` on the button, bound via `data-wp-bind--aria-pressed="context.showNoteNames"`.
- `accessibleName` today is a SONG-LEVEL label ONLY; it does NOT describe individual notes. `src/song/accessibleName.js` produces "Title by Composer" / "Piano sheet music by X" / "Piano sheet music" and it is set on `<svg><title>` (`svg.js:255`). It NEVER enumerates pitches. So toggling names does NOT change the SVG accessible description today, and names would be added as VISUAL `<text>` in the SVG.
- Important SR subtlety: if the SVG has `role="img"`, the accessible name collapses to the `<title>` text only — child `<text>` nodes are NOT read. So visual note names would not automatically reach a screen reader.
- **Recommend:** (1) `aria-pressed` on the button conveys toggle state; (2) treat names as a visual aid; (3) do NOT add a live-region announcement of every name in v1 (would be noisy). Flag SR-announcement-of-names as explicit OUT OF SCOPE unless the analyst wants it. No existing live-region / `aria-live` anywhere to copy.

**(d) RESIZE — CONFIRMED: toggle state must outlive redraw.** The `ResizeObserver` re-runs the `draw` closure (`view.js:103`, `observeResize`). For names, `draw` MUST read the CURRENT toggle state on each call (read context inside `draw`, not a cached bool) so a width-change redraw preserves names-on. If `draw` caches a stale bool, names vanish on resize — must be avoided. **Confirmed requirement:** redraw reads live state.

**(e) NO-JS / hydration — CONFIRMED the toggle is moot without JS.** `render.php` emits an EMPTY div (no SVG server-side); the ENTIRE piano is JS-drawn (`view.js` `callbacks.init` → SVG). No JS → no piano at all today (already the case). So no-JS = no score and no toggle — nothing to toggle. No SSR concern for names (they render client-side like everything else). No new progressive-enhancement gap is introduced. **Caveat:** if the button markup is emitted by `render.php`, it would appear pre-JS but be dead until hydration — so its visibility should be gated on hydration/render-success (or the button is created/shown by JS). iAPI prefers SSR markup + directives; recommend `render.php` emits the button markup with directives but gates visibility on a successful render.

**(f) EDITOR SCOPE — FRONTEND-ONLY, but a critical architectural tripwire.**
- The editor canvas (`SongCanvas`) uses the SAME render path: `buildLayoutModel → renderInto` (`SongCanvas.js:117-120`), identical to `view.js`. `svg.js` draws NO note names today, so the editor SCORE shows no names either (names live only in the editor structure TREE, not on the staff).
- `README:179` + `README:231`: the frontend SVG output is pinned BYTE-IDENTICAL between the editor canvas and the published page, enforced by a unit test.
- **IMPLICATION:** if note-name rendering is added into `svg.js` / `buildLayoutModel` unconditionally, names would appear on the editor canvas TOO and BREAK the byte-identical test. So name-rendering MUST be parameterized (e.g. `renderInto(model, { showNoteNames })`) and default OFF, so the editor canvas (which passes no flag) stays names-off and byte-identical, and ONLY `view.js` passes the flag when toggled.
- **SCOPE RECOMMENDATION:** the feature is FRONTEND-ONLY (per the issue). The editor gets NO toggle; the editor canvas keeps showing no names (unchanged). The shared `svg.js` gains an OPTIONAL names parameter, off by default, so the editor is unaffected and the byte-identical test still holds for the default. The spec should state: editor behavior unchanged; the toggle + names are exclusively frontend. (Flag the byte-identical-test constraint to the design/code phase — it is a real tripwire, but it is an implementation concern, not a spec requirement.)

### Q5 — Lock the accidental decision; confirm reversibility; final gap scan

**Question:** Lock "bare letter, match editor" for accidentals (any doc implying the viewer expects accidentals in the name)? Is the toggle cleanly reversible/idempotent? Any remaining observable requirement gap (print, 2-block independence, control placement, error/empty states, overlap with existing SVG text)?

**Answer (spec-researcher):**

**(a) ACCIDENTAL-IN-NAME — LOCKED: "bare step letter/syllable, match editor." Agreed.** Grepped README, `docs/song-format.md`, the issue, and `intent.md`: every "accidental" mention refers to `pitch.alter` / `handConfig.alters` (the −2..+2 alteration that draws the SVG glyph and does pitch math), NEVER about putting `#`/`b` into the displayed NAME text. `docs/song-format.md:60` says the `language` field controls "display note names in the chosen system" (system only — English/Spanish — no accidental in the name); `README:51` says the same. ZERO doc/issue text implies the viewer wants "C#" in text. The editor's established behavior is the bare letter (proven live in A3). The lock is safe and consistent. **Residual note (flag, not a blocker):** a viewer may see a sharp GLYPH on the notehead but the text "C" — a mild mismatch, but the accidental is still visually present via the glyph, and this matches the editor. Accepted for v1.

**(b) REVERSIBILITY — CONFIRMED clean and idempotent.**
- The notation core has ZERO nondeterminism: grep for `Math.random` / `Date` / `performance.now` / `crypto` across `src/notation` finds NONE. It is a pure data → SVG transform.
- `draw` rebuilds the model from the same cached parsed `data` each call (`view.js:92-95`); `buildLayoutModel` + `renderSvg` are pure functions of `(data, width, flag)`. Same inputs → byte-identical SVG (the same property the byte-identical unit test relies on).
- So on → off → on: each `draw` recomputes from scratch with no accumulation and no drift. names-on render N equals render N+2. The toggle is fully reversible (provided `draw` reads live toggle state each call, per A4(d)).

**(c) GAP SCAN:**
- **PRINT:** no print-CSS precedent in the plugin (`style.scss` is `@font-face` only). Out of scope for v1.
- **2-BLOCK INDEPENDENCE — TESTABLE** via the existing pattern. `README:231` already has an e2e: "two Piano blocks on one page... each renders independently... no cross-talk." Per-instance local context (A2c) means toggling block A flips only block A's context; B is untouched. A new e2e can extend the existing 2-block fixture: toggle names on block A, assert A shows names AND B does NOT. Good acceptance-criterion candidate.
- **CONTROL PLACEMENT — NO precedent** (the toggle is the first frontend UI ever, A1). Placement (above/below/overlay the score) is a design decision, not locked by anything existing. **Design-deferred.** The spec should stay position-agnostic (at most a loose requirement: "the control is visible and associated with its block's score").
- **ERROR / EMPTY STATES — BOTH CONFIRMED hold.**
  - Invalid song (bad JSON / non-conformant) → `view.js:83-85` errors → draws nothing → no SVG → no toggle.
  - Conformant but ALL rests / zero pitches → no nameable note (rests have no name, A3) → no toggle (nothing to name). Mechanically the staff + rests still draw, but the toggle would do nothing, so it should be hidden when there is not ≥1 named note. Restate as an acceptance criterion.
- **OVERLAP WITH EXISTING SVG TEXT — REAL risk, but DESIGN-level.** `svg.js` already places `<text>` for annotations (4 placement bands above/below/inter-staff), dynamics (below staff), tempo, and ottava. Note-name text would be NEW text near noteheads and could collide with: these existing texts, accidental glyphs, ledger lines, and other note names in dense chords/runs. NO geometry is reserved for a note-name lane today (`layout.js` reserves lanes for dynamics/annotations/hairpins, none for names). **Recommendation:** the spec should state the observable QUALITY bar — "note names must remain legible and not render illegibly overlapping" — but leave the exact collision-avoidance (lane reservation, font size, placement) to the DESIGN/layout phase. Adding names may require a new layout lane in `buildLayoutModel`; this is the biggest design-phase unknown. Spec acknowledges "where names sit" is design's to solve, with legibility as the bar.

**REMAINING GAPS: none blocking.** Two items surfaced as design-deferred (not spec-locked): control PLACEMENT and name PLACEMENT/overlap geometry. Everything observable is locked. Ready to consolidate.

## Consolidated Requirements

These are observable outcomes and measurable success criteria. They describe WHAT the feature must do, not how to build it. Implementation choices (e.g. iAPI directives, layout lanes) are noted only where they are hard constraints.

### Functional requirements

**FR1 — A toggle control exists on the frontend.**
On a published page/post, a rendered piano block displays a viewer-facing control that toggles note-name display on and off. This is the first interactive UI on the block's frontend (none exists today).

**FR2 — Toggling shows and hides note names.**
- When the toggle is ON, a note name is displayed for every nameable note in the rendered score.
- When the toggle is OFF, no note names are displayed and the score appears exactly as it does today (current visual unchanged).
- Activating the control flips between these two states.

**FR3 — Default state is OFF (note names hidden).**
On initial page load, note names are hidden. The viewer must act to reveal them. (Author intent was silent; chosen for least surprise and to keep existing posts visually unchanged.)

**FR4 — A "note name" is the bare pitch letter/syllable in the song's notation system.**
- The displayed name is the note's step in the song's notation system: English letters (C, D, E, …) or the Spanish/solfège syllables (do, re, mi, …).
- The system is determined by the song itself (`song.language`, else inferred from the song's spellings, else English). It is NOT a viewer choice; the toggle only shows/hides, it never changes the system.
- The name contains NO accidental marker (a C-sharp note shows "C", a B-flat note shows "B"). The accidental remains visible as the existing SVG accidental glyph next to the notehead.
- The name contains NO octave number (C4 and C5 both show "C").
- Frontend names must match the editor's existing note-name strings for the same notes (reuse the established naming logic).

**FR5 — Coverage of names.**
- Names apply to notes in BOTH hands/staves (treble and bass).
- For a chord, every notehead in the stack gets its own name.
- Rests get NO name.
- Tied notes are each named (a tie does not suppress naming).
- Every note in a conformant song is nameable.

**FR6 — Per-instance independence.**
Each piano block instance on a page has its own independent toggle. Toggling one block's note names must NOT affect any other piano block on the same page. (Matches the existing per-instance isolation guarantee, `README:231`.)

**FR7 — The control reflects and reverses cleanly.**
- The control communicates its current on/off state to assistive technology (e.g. `aria-pressed`).
- The toggle is fully reversible and idempotent: ON → OFF → ON returns to a visually identical names-on state, with no drift across any number of toggles.

**FR8 — The control label is human-readable and translatable.**
The control has a clear, viewer-facing label (e.g. "Show note names"), provided as a translatable string under the `piano-block` text domain, consistent with how the block already supplies translated strings to the frontend.

**FR9 — Names survive responsive redraws.**
When the block redraws because its width changed (the existing `ResizeObserver` behavior), the current toggle state is preserved: if names were on, they remain on after the redraw; if off, they remain off.

**FR10 — Note names remain legible.**
When names are shown, they must be readable and must not render in an illegibly overlapping way with each other or with existing score elements (noteheads, accidentals, ledger lines, dynamics, annotations, tempo, ottava). The exact placement/anti-collision approach is a design-phase decision; legibility is the bar.

### Constraints

**C1 — WordPress Interactivity API (hard constraint, from intent).**
The frontend toggle interactivity must be built with the WordPress Interactivity API. Toggle state must live in per-instance (local) context, not global state, to preserve FR6.

**C2 — Editor behavior unchanged.**
This feature is frontend-only. The block editor gains no toggle, and the editor's score canvas continues to show no note names. The shared notation rendering must keep producing output that is byte-identical to today's when note names are not requested (the editor canvas and the published-page default both rely on this; enforced by an existing unit test). Note-name rendering must therefore be opt-in, defaulting to off.

### Out of scope (v1)

- **Persistence** of the viewer's choice across page reload or navigation (no localStorage / URL state). The toggle resets to the default (OFF) on each load.
- **Page-wide / shared** toggling across multiple block instances (contradicts FR6).
- **Viewer choice of notation system** (English vs solfège) — the system follows the song.
- **Accidentals or octave in the name text** (kept as bare step, per FR4).
- **Screen-reader announcement / live-region** narration of each note name when toggled (the `aria-pressed` state on the control is provided; per-name SR exposure is deferred).
- **Print styling** for note names.
- **Adding a toggle to the editor.**

### Edge cases (must hold)

- **Empty/whitespace song:** no block is rendered at all (server emits nothing), so there is no control and no names. Unchanged.
- **Invalid / non-conformant song:** the block renders nothing on the frontend, so the control does NOT appear. Unchanged.
- **Conformant song with no nameable notes** (e.g. all rests / zero pitches): the control does NOT appear, because there is nothing to name.
- **Multiple blocks on one page:** each has an independent control and state (FR6).
- **Width change while names are on:** names persist across the redraw (FR9).

### Acceptance criteria (testable)

- **AC1:** On a published page with a conformant, note-bearing piano block, the rendered output shows a toggle control and, by default, shows NO note names. (FR1, FR3)
- **AC2:** Activating the control causes a note name to appear for every nameable note (both staves, every chord notehead); activating it again removes all names and restores the original visual. (FR2, FR5)
- **AC3:** For a song in English, a C-sharp note shows "C" (no "#", no octave); for a song in Spanish, the same note shows "do". The displayed system follows the song, not the viewer. (FR4)
- **AC4:** With two piano blocks on one page, toggling names on block A shows names on A and leaves block B with no names (and vice versa). (FR6) — mirrors the existing 2-block e2e pattern.
- **AC5:** The control exposes its state to assistive technology (e.g. `aria-pressed` true/false matching on/off). (FR7)
- **AC6:** Toggling ON → OFF → ON yields a names-on rendering identical to the first names-on rendering. (FR7)
- **AC7:** When names are on and the block's width changes, names remain visible after the redraw. (FR9)
- **AC8:** The control's label is rendered from a translatable string in the `piano-block` text domain. (FR8)
- **AC9:** A piano block whose conformant song contains no nameable notes (e.g. only rests) renders without the toggle control. (edge case)
- **AC10:** With note names not requested, the frontend notation output is byte-identical to the current output, and the editor score canvas shows no names. (C2)

