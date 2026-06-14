# Spec research — Issue #28 "Support arpeggios with direction"

## Intent (verbatim)

> Chords in the piano block can be marked as arpeggiated, including the direction
> of the arpeggio (e.g. upward or downward), and this is reflected when the music
> is rendered.

## What an arpeggio is (domain background)

An **arpeggio** (a "rolled chord") is a chord whose notes are sounded in quick
succession from bottom to top (or top to bottom) rather than struck
simultaneously. In standard music notation it is drawn as a **vertical wavy
line** to the left of the chord's noteheads. **Direction** is shown by an
arrowhead on the wavy line: an upward arrow (or no arrow, the default) means roll
**bottom-to-top**; a downward arrow means roll **top-to-bottom**. The arpeggio
is therefore a property of a single chord (one event), and direction is a small
closed vocabulary (up / down, with a likely default).

## How this maps onto the existing song format (analyst's initial reading)

The format already models a chord as a single **event** of `type: "note"`
carrying a `pitches` array of two or more pitches (see `docs/song-format.md`
"Events" and `src/song/schema.js` `$defs/event`). Event-level markings are the
established place for "a property of this chord," and there is a direct
precedent for a **direction-bearing marking**: `crescendo`/`decrescendo` and
`tie`/`slur`. The format grows **additively** — new optional event fields, no
`version` field, unknown fields ignored, closed enums validated strictly,
front-end consumption may lag (`language`, `name` are stored but not yet
rendered).

These are the analyst's hypotheses to be confirmed by the researcher, not
settled requirements.

## Open questions and findings

(running log below; one question at a time)

### Q1 — Modeling surface: where does the arpeggio marking attach, and what shape?

**Question sent to researcher:** Given the existing event model, the natural
home for an arpeggio marking is a new **optional field on the note event**
(alongside `dynamic`, `tie`, `slur`, `crescendo`, `decrescendo`). I want the
researcher to confirm, with evidence from `schema.js`, `validate.js`, the editor
inspector code, and the renderer:

1. Is the event object the correct and only sensible attachment point for a
   "this chord is arpeggiated" marking (versus the pitch, the measure, or a
   standalone annotation)?
2. Are there any existing fields, attributes, partial implementations, branches,
   or issue/PR references that already touch "arpeggio," "rolled chord," "roll,"
   or a wavy-line marking? (Confirm this is genuinely new ground.)
3. How do the closest precedents (`crescendo`/`decrescendo`, `tie`, `slur`,
   `dynamic`) encode direction and value — single enum field, paired
   start/stop, separate fields per direction? This tells us the idiomatic shape
   for an arpeggio-with-direction field.

**Researcher's answer (evidence-backed):**

1. **Attachment point — the event object, confirmed.** The format is additive
   with no `version` field; a new optional field belongs directly on the `event`
   object. The closest kin are the per-event closed-enum markings: `dynamic`
   (a single enum) and `tie`/`slur`/`crescendo`/`decrescendo` (`start|stop`
   enums). An arpeggio is a property of one chord (one event), so it is a new
   per-event field on `event`, most like `dynamic` (a single enum value), not a
   span. Pitch, measure, and standalone-annotation attachment are all wrong: the
   marking describes the whole chord, not one pitch, and it is anchored to the
   chord, not free-floating on the bar.

   Evidence: `schema.js:179-189` (pitch carries only `step`/`octave`/`alter` —
   no markings live at pitch level); `schema.js:148-171` (every note-wide marking
   — `dynamic`, `tie`, `slur`, `crescendo`, `decrescendo`, `dots`, `annotations`
   — lives on the event); `schema.js:82-102` (measure level is barlines +
   standalone annotations); `schema.js:209-218` (standalone annotation is open
   free-text `text`/`placement`/`staff`, whereas an arpeggio is a closed
   structured marking with a render glyph, not author-typed text);
   `song-format.md:222` ("A chord is simply several pitches in one event").

2. **New ground — confirmed.** `git log --all` shows zero commits matching
   arpegg/roll/wavy/wiggle; a whole-repo grep finds only unrelated prose
   ("hand-roll" in old design docs) plus `intent.md` itself; of 14 worktree
   branches only this one (worktree-28) is the arpeggio branch; GitHub issue #28
   has zero comments and zero PRs, its body just the goal line. Greenfield: no
   prior shape to honor, but the existing idioms above must be honored.

3. **Idiomatic shape — a single closed-enum field, like `dynamic`.** Two render
   patterns exist in the codebase:
   - **Span pattern** (`tie`/`slur`/`crescendo`/`decrescendo`): a `start`+`stop`
     pair across two events, resolved by `layout.js`
     `recordSpanMarkers`/`resolveAllSpans`.
   - **Per-event decoration** (accidental, dot): attached to one chord's
     geometry.
   An arpeggio is a vertical wavy line to the **left of one chord** — a
   per-event decoration, **not** a span. It follows the accidental/dot path. A
   laid-out note already carries `topStep`/`bottomStep` (the chord's vertical
   span), `x`, and `heads` — exactly the geometry an arpeggio glyph needs.
   Therefore the idiomatic shape is a single optional enum field on the event
   whose value is the direction, e.g. `arpeggio: "up" | "down"` (and possibly an
   undirected value). A single field carries **both** "is arpeggiated" (presence)
   **and** the direction (value) — exactly how `dynamic` works (presence = has a
   dynamic; value = which one). Evidence: `schema.js:167-170` (the shared
   `start|stop` span enums); `schema.js:162` (`dynamic` as a single-value point
   enum); the span vocab is guarded by `songModel.test.js:100-106`.

   The two-separate-fields idiom (`crescendo`/`decrescendo`) is explicitly
   **rejected** here: those are two fields only because the format requires their
   direction not be inferred from context and because they can co-occur on one
   note (the messa-di-voce hinge, `song-format.md:226-228`). An arpeggio's
   direction is mutually exclusive — a chord rolls one way at a time — so a single
   enum is cleaner. The two-field shape is the exception driven by co-occurrence,
   not the default.

   **Wart to carry forward:** by the additive rule (`schema.js:9`,
   `song-format.md:428-429`), a misspelled *enum value* is an error that still
   never blocks saving, while a misspelled *field name* (e.g. `arpegio`) is an
   unknown key, silently ignored and rendering nothing. This is the format's
   normal behavior, not special to arpeggios, but it is the price of the additive
   stance.

**Two constraints the researcher surfaced (carry into scope, not design):**

- **Font/glyph constraint.** The music font is a subsetted and renamed Bravura;
  `glyphs.js` is the only place codepoints live, and a codepoint renders only if
  it is in the subset. The SMuFL arpeggio is built by stacking
  `wiggleArpeggiatoUp` (U+EAA9) segments, with direction shown by an arrowhead
  glyph at the end: `wiggleArpeggiatoUpArrow` (U+EAAD) for upward,
  `wiggleArpeggiatoDownArrow` (U+EAAE) for downward; a plain wiggle with no
  arrow is the **undirected** arpeggio. Rendering the arpeggio therefore needs
  either (a) those codepoints added to the font subset, or (b) a hand-drawn SVG
  wavy line. This is an implementation concern, but it bounds what "reflected in
  rendering" can mean and is worth flagging as a known cost.

- **Render-parity precedent.** Some additive fields (`language`, `name`) are
  stored and validated but **not yet rendered**. The intent for #28 explicitly
  wants the marking **reflected in rendering**, so render is in scope here (this
  distinguishes #28 from those store-only fields).

### Q2 — Direction vocabulary: which values, and is "undirected" a state?

**Question sent to researcher:** The intent says "direction of the arpeggio
(e.g. upward or downward)." SMuFL/standard notation supports three states: an
**up** arrow, a **down** arrow, and a plain wavy line with **no** arrow (an
undirected/unspecified-direction arpeggio). I want the researcher to determine,
with evidence:

1. What is the right value vocabulary for the field — exactly `up`/`down`, or
   `up`/`down`/`none` (undirected), or a present-but-empty marking? Specifically:
   is a **plain (undirected) arpeggio** an in-scope state the user can author, or
   does this feature only cover the directed cases? Consider both the musical
   convention and how the codebase models "optional marking present vs absent."
2. How is "the marking is absent" expressed today for the closest fields
   (`dynamic`, `tie`/`slur`)? Is absence simply the field being omitted, and if
   so, does that leave room for an explicit "arpeggiated but no direction"
   value, or would `none` collide confusingly with "not arpeggiated"?
3. What canonical naming would fit the codebase's existing enum style — the
   field name (`arpeggio`? `arpeggiate`?) and the value spellings
   (`up`/`down`? `upward`/`downward`?) — judged against the spelling conventions
   already in `schema.js` and `songModel.js` vocab.

**Researcher's answer (evidence-backed):**

1 & 2 (the absence question drives the vocabulary). **There is no sentinel
"absent" value anywhere in this format — absence is always expressed by omitting
the key.** Every optional marking (`dynamic`, `tie`, `slur`, `crescendo`,
`decrescendo`) is absent by **omission**, never by a sentinel value
(`schema.js:162-170`; none is in any `required` list). The editor reinforces
this: the "None" choice is the empty-string option `NONE_OPTION = { value: "" }`
(`songModel.js:112`), and `omitFalsy` **deletes** the key when the value is
blank/`""`/`0` (`emit.js:48-58`). A grep across every enum found **zero**
`none`/`normal`/`natural`/`plain`/`undirected` sentinel values — closed enums
hold only real values; "absent" is never one of them.

**Consequence:** an `arpeggio: "none"` value would be a foreign pattern this
format has never used **and** it would collide with omission — precisely the
"two ways to say no" wart. It must be avoided. Because the "field absent" slot
already means **not arpeggiated**, the vocabulary choice reduces to two clean
options:

- **Option A — `arpeggio: ["up", "down"]`.** Arpeggiated is always directed;
  field absent = not arpeggiated. Two states, no sentinel. Matches the intent's
  literal "upward or downward." Downside: cannot author the (real, common) plain
  undirected roll.
- **Option B1 — `arpeggio: ["up", "down", "nondirectional"]`.** Supports the
  undirected roll via a positive token (SMuFL's own word `nondirectional`), not
  by reusing the forbidden "none." Field absent = not arpeggiated;
  `arpeggio: "nondirectional"` = rolled with no arrow.
- **Rejected — Option B2** (a boolean `arpeggio: true` plus a separate
  `arpeggioDirection`): the format contains **no boolean field anywhere**, so a
  boolean fights convention. Rejected.

3. **Naming — what this codebase would spell.**
   - **Field name: `arpeggio`** (a bare marking noun, matching `dynamic`, `tie`,
     `slur`, `crescendo`, `decrescendo` — all nouns/marking-names, camelCase).
     **Not** `arpeggiate` (a verb; the codebase uses the noun form for markings).
   - **Value spellings: short lowercase tokens.** Single-word enum values are
     short and lowercase (`start`, `stop`, `treble`, `bass`, `note`, `rest`,
     `above`, `below`, `pp`…`sfz`); multi-word values are kebab-case
     (`repeat-start`, `thirty-second`). So directions are **`up` / `down`**
     (mirroring `start`/`stop` and `above`/`below`), **not** `upward`/`downward`.
     If undirected is included, SMuFL's canonical `nondirectional` is the
     evidence-backed token (one word; the codebase has no precedent against it).

**Editor mechanism is free.** Because absence = omission, the arpeggio control
reuses the exact `NONE_OPTION ("")` + `omitFalsy` path that `dynamic` already
uses — picking "None"/none drops the key. No new editor mechanism is needed.

### Analyst's working decision on vocabulary (to confirm against render)

I am leaning **Option B1 — `arpeggio: ["up", "down", "nondirectional"]`** —
because the researcher confirms the **plain undirected roll is the most common
real-world arpeggio**, the intent's "e.g. upward or downward" is illustrative
("e.g."), not exhaustive, and the feature title is the broad "Support arpeggios
with direction." Excluding the commonest case would make the feature feel
half-built. Option A remains a defensible v1-minimal fallback (undirected could
be added later under the additive no-version rule). The deciding factor is
**render feasibility**, which Q3 settles before I lock the vocabulary.

### Q3 — Render feasibility for each state (does "reflected in rendering" hold?)

**Question sent to researcher:** "Reflected when rendered" is the core of the
intent, so before locking the vocabulary I need the render path confirmed for
**each** candidate state. With evidence from `glyphs.js`, `svg.js`, `layout.js`,
`constants.js`, and the notation tests, determine:

1. For `up` and `down`: can the directed arpeggio actually be drawn? Are the
   arrowhead glyphs (or an equivalent hand-drawn SVG) reachable given the
   subsetted-font constraint, and where does the wavy line sit relative to the
   chord (left of the noteheads, spanning `topStep`..`bottomStep`)? Roughly how
   much new rendering work — font-subset change vs hand-drawn SVG path?
2. For `nondirectional` (plain wavy line, no arrowhead): is this **more** or
   **less** work than the directed cases (it omits the arrowhead but still needs
   the stacked wiggle)? Is there any state that is cheap to author but expensive
   or impossible to render, which would argue for cutting it from v1?
3. Is there any rendering interaction or collision to flag — with accidentals
   (which also sit to the left of the chord), with the chord's stem/beams, with
   a single-note "chord," or with very tall chords spanning both staves — that
   becomes an acceptance-criteria edge case rather than a silent assumption?

**Researcher's answer (evidence-backed; includes a live `buildLayoutModel`
experiment):**

**Headline:** all three states (`up`/`down`/`nondirectional`) are cheap and
roughly equal cost, and **no font-subset change is needed**. The codebase
already hand-draws curves and lines as SVG primitives: ties/slurs are quadratic-
Bézier `<path>` elements (`renderSpan`, `svg.js:982-992`), hairpin wedges are
`<line>` pairs (`renderHairpin`, `svg.js:1012-1037`), and `glyphs.js`'s own
header states that staff lines, stems, beams, ties, slurs, ledger lines, and
barlines are "drawn as raw primitives — those are never glyphs." An arpeggio
wavy line plus arrowhead can be drawn the same way (a `<path>` for the wiggle, a
small `<path>`/`<polygon>` or stroked lines for the arrowhead). The SMuFL font
route (the `wiggleArpeggiato*` codepoints) is available but **not required** and
is the harder path (re-subsetting the font binary); the hand-drawn route is
recommended, matching the tie/slur/hairpin precedent.

1. **`up` and `down` (directed) — drawable, cheap.** The geometry already
   exists on the laid-out note. A live experiment laying out a C5–E5–G5 chord
   returned `{ x:1, topStep:9, bottomStep:5, headYs:[-2.5,-3.5,-4.5] }`, so the
   chord's vertical extent (top head to bottom head) and its `x` are already on
   the note object. The wiggle spans bottomHead..topHead at a fixed dx to the
   **left** of `note.x`; direction is just which end carries the arrowhead
   (`up` = arrow at top, `down` = arrow at bottom), a pure emit-time choice from
   the enum value, exactly as `renderHairpin` picks `<` vs `>` from its kind
   (`svg.js:1018`). Cost is small: a per-note arpeggio decoration record in
   layout (analogous to accidentals/ledgers/dotSpecs at `layout.js:1542-1560`),
   a `renderArpeggio()` in `renderNote` (`svg.js:704`) like `renderHairpin`, and
   a few new constants (wiggle amplitude/period, left gap, arrowhead size) in
   `constants.js`. No font work.

2. **`nondirectional` (plain wiggle, no arrow) — strictly cheaper, ~free.** It
   is `up`/`down` minus the arrowhead: the same wiggle `<path>` with the arrow
   branch skipped. **No state is cheap-to-author but impossible-to-render** —
   all three use the same primitive. Render feasibility therefore does **not**
   argue to cut `nondirectional`; it argues **for** including it, since the
   commonest real case comes essentially free once `up`/`down` exist. **Option
   B1 is render-justified.**

3. **Collisions — which become acceptance criteria.**
   - **(A) vs accidentals — REAL, must spec.** Accidentals already sit to the
     left of the noteheads at `dx = ACCIDENTAL_GAP(1.2) + column*ACCIDENTAL_COL_STEP(1.3)`
     (`layout.js` `stackAccidentals`; experiment showed an F#5 accidental at
     `dx:1.2`). Musical convention places the arpeggio sign **outside** (further
     left than) any accidentals, so the arpeggio's dx must clear the chord's
     leftmost accidental extent, falling back to a fixed gap when there are no
     accidentals. **AC:** the arpeggio line is drawn to the left of the chord's
     noteheads and clear of (further left than) any accidentals on that chord.
     This is the one real layout dependency.
   - **(B) vs single-pitch "chord" — decide + spec.** A one-pitch note is
     structurally a chord with `topStep == bottomStep` and a single head; a
     wiggle there has ~one-notehead height. A one-note arpeggio is musically
     meaningless but harmless. Recommended: draw it uniformly with no special
     case, consistent with the format's stance that it never validates musical
     sense (`song-format.md:104`; cf. a lone tie or `beat:99`). **AC:** an
     arpeggio on a single-pitch note is accepted and renders a (short) arpeggio
     line; it is not an error.
   - **(C) vs very tall chord — REAL but bounded.** Experiment: a C4–C6 chord
     gives `topStep:12, bottomStep:-2, headYs:[1,-6]` — a 7-staff-space-tall
     wiggle, all within one hand's staff and ledgers. The wiggle simply tiles to
     whatever height the chord spans; there is no cross-staff problem because a
     chord lives in a single hand. **AC (light):** the arpeggio line spans the
     full vertical extent of the chord, from its lowest to its highest notehead,
     however tall.
   - **(D) vs stem/beam — low risk, folds into (A).** The arpeggio sits on the
     left, outside noteheads and accidentals; even a stem-down stem (at
     `note.x - NOTEHEAD_RX`, `renderStem` `svg.js:786`) is still to the right of
     the arpeggio, and beams live at the stem ends far from the left-side
     wiggle. Not a separate AC — fold "clear of stems" into (A). No special beam
     handling.

### DECISION — vocabulary locked: Option B1

With render feasibility confirmed for all three states and `nondirectional`
essentially free, the vocabulary is **locked**:

> **`arpeggio`** — an optional event field; enum **`"up" | "down" |
> "nondirectional"`**. Field **absent** = the chord is **not** arpeggiated.
> Presence = the chord is arpeggiated; the value gives the direction
> (`up` = roll bottom-to-top with an upward arrowhead, `down` = roll
> top-to-bottom with a downward arrowhead, `nondirectional` = a plain wavy line
> with no arrowhead).

This honors the codebase's "absence = omission, no sentinel value" rule, matches
the single-value point-enum idiom of `dynamic`, uses codebase-canonical spellings
(`up`/`down`; SMuFL's `nondirectional`), and is fully renderable hand-drawn with
no font change. The three render acceptance edges (A/B/C, D folded into A) are
carried forward.

### Q4 — Editor authoring, persistence, and front-end/editor parity

**Question sent to researcher:** With the model locked, I need the
**authoring + lifecycle** requirements pinned down so the spec's acceptance
criteria are complete. With evidence from `NotePanel.js`, `songModel.js`,
`emit.js`, `serializeSong.js`, the editor tests, `validate.js`, and `view.js`,
determine:

1. **Editor authoring.** Where and how would a user set this in the visual
   editor — the `NotePanel` inspector for a selected note/chord, as a
   select/dropdown with options None / Up / Down / Nondirectional, reusing the
   `NONE_OPTION ("")` + `omitFalsy` path like `dynamic`? Is the control
   available for both notes and the single-pitch case, and is it hidden/inert
   for a **rest** (a rest has no pitches, so an arpeggio is meaningless)? What
   would the editor do if it loads a song whose event already has `arpeggio`?
2. **Persistence / round-trip / validation.** Confirm the field round-trips
   through raw-JSON editing unchanged, is stored verbatim in the `song`
   attribute, and is validated exactly like other closed enums: an out-of-vocab
   value is flagged informationally but **never blocks saving**, and the field
   on a `rest` (or any unknown-context) is simply ignored, not an error. Is
   there any reason validation should *reject* `arpeggio` on a rest, or is the
   permissive "ignore it" stance the consistent choice?
3. **Front-end / editor render parity.** The intent wants it rendered. Should
   **both** surfaces render the arpeggio identically — the editor canvas
   (`SongCanvas`) and the published front end (`view.js`) — given they share the
   notation layer? Confirm the shared-renderer assumption so "reflected in
   rendering" means both, not just one.

**Researcher's answer (evidence-backed):**

1. **Editor authoring — the `NotePanel` inspector, reusing the `dynamic`
   pattern verbatim.** The control is a new `ToolsPanelItem` in the selected
   event's "Note details" disclosure (`NotePanel.js:156-240`), sibling to the
   Dynamic control. It is a `SelectControl` with options
   `[NONE_OPTION, ...ARPEGGIO]`, `value={event.arpeggio ?? ""}`,
   `onChange => changeOptional("arpeggio", value)` — exactly mirroring Dynamic
   (`NotePanel.js:197-204`). `changeOptional` already calls `omitFalsy`
   (`NotePanel.js:126-128`), so picking "None" (`""`) drops the key. Needed: a
   new `ARPEGGIO` option list in `songModel.js`
   (`[{label:"Up",value:"up"},{label:"Down",value:"down"},{label:"Nondirectional",value:"nondirectional"}]`)
   and adding `"arpeggio"` to the ToolsPanel reset-all destructure
   (`NotePanel.js:160-171`) so reset-all clears it. **No new mechanism.**
   - **Single-pitch:** shown. ToolsPanel fields are not gated on pitch count, so
     any note shows the control (consistent with render AC-B).
   - **Pre-existing value on load:** handled for free — `value={event.arpeggio ?? ""}`
     reads the working object, so a loaded `arpeggio:"up"` shows "Up" selected.
     No migration, no seeding.
   - **Rest behavior — a real finding.** `NotePanel` gates **only** `PitchList`
     on `type === "note"` (`NotePanel.js:148`); the optional ToolsPanel fields
     (dynamic, tie, slur, crescendo, decrescendo, annotations) are **not** gated
     on note-vs-rest and render for a rest too. The format explicitly allows
     per-event annotations on **both** a note and a rest
     (`song-format.md:224,244`, "A rest may carry annotations too"). So the
     established pattern does **not** hide event-level markings for rests.

   **Analyst decision (rest UX) — option (i): show the control, render
   inert.** Per the existing pattern, the arpeggio control is **not** specially
   hidden for a rest; the field may be set and stored, but it has **no rendered
   effect** on a rest (a rest has no noteheads for a wavy line to attach to, so
   it is naturally inert). This is chosen over option (ii) "hide the control when
   `type === "rest"`" because (a) it matches the established NotePanel pattern
   (no event marking is hidden for rests today), (b) the data model already
   accepts the field on a rest permissively (see part 2), (c) it is the
   lowest-risk, most-consistent choice, and (d) render is inert regardless.
   Option (ii) is a reasonable tidier-UX alternative the **design phase may
   revisit**, but the spec's stance is (i). Either way, arpeggio-on-a-rest must
   **never** be a conformance error.

2. **Persistence / round-trip / validation — confirmed, behaves like every
   other closed enum.**
   - **Round-trips raw-JSON verbatim:** the `song` string is stored verbatim and
     the additive schema ignores unknown keys and never rewrites
     (`schema.js:9-11`), so `arpeggio:"up"` survives raw editing unchanged.
   - **Stored in the `song` attribute:** it is just another event field;
     `serializeSong` is a canonical `JSON.stringify` of the working object
     (`serializeSong.js:28-30`), so it persists in the `song` string.
   - **Validated as a closed enum:** add `arpeggio: { enum: ["up","down","nondirectional"] }`
     to the event `$def` beside `dynamic` (`schema.js:162`); the generic enum
     walker (`validate.js:120-128`) then flags any out-of-vocab value
     informationally. It **never blocks saving** — raw-JSON validation is
     non-blocking by design (`song-format.md:62,429-430`; the editor's
     `commitSong` only warns, never throws, `serializeSong.js:44-58`). A vocab
     cross-check test should mirror `ARPEGGIO` against the schema enum, like the
     `SPAN_STATES` test (`songModel.test.js:100-106`).
   - **Field on a rest — accepted, never an error (confirmed, no precedent for
     context-rejection).** The **only** conditional in the entire validator is
     "`if type === "note" then require pitches`" (`validate.js:209-235`,
     `schema.js:174-176`); it only **adds** a requirement for notes, it never
     **forbids** a field on a rest. There is **zero** machinery that rejects a
     field because of a sibling value. So `arpeggio` on a rest is just a present
     optional field — permissively accepted. Adding a "reject arpeggio on rest"
     rule would be a new, first-of-its-kind negative conditional, against the
     grain. The permissive "ignore it" stance is the architecturally consistent
     **and** the only naturally-expressible choice. **AC:** arpeggio on a rest is
     accepted (never a conformance error); it has no rendered effect.

3. **Front-end / editor render parity — proven, one shared renderer.** Both
   surfaces call the identical notation core `buildLayoutModel` (`layout.js`) →
   `renderInto` (`svg.js`). The front end imports both in `view.js`; the editor
   canvas imports the **same** two in `SongCanvas.js:32-33` and calls them
   identically (`SongCanvas.js:117-120`). `SongCanvas`'s docstring is explicit:
   it "reuses the very same notation-core render path" and "renders the
   front-end-identical SVG" (`SongCanvas.js:5-6,21-22`); the only editor-extra is
   a post-draw is-selected CSS class on the selected note group
   (`SongCanvas.js:53-77`) — a pure highlight, no notation difference.
   **Consequence:** arpeggio rendering is implemented once in the shared
   layout+svg layer and appears on **both** the editor canvas and the published
   front end automatically. **AC:** arpeggios render identically on the editor
   canvas and the published front end (shared notation core).

### Requirements now testable — readiness check

After Q1–Q4 the feature is fully specified at the WHAT/WHY level:
- the model (a single optional `arpeggio` enum field on the event),
- the vocabulary (`up`/`down`/`nondirectional`, absence = not arpeggiated),
- authoring (NotePanel SelectControl, None drops the key),
- persistence/validation (round-trips, closed-enum, never blocks save),
- the rendered form and its placement edges (left of noteheads, outside
  accidentals, spans full chord height, single-pitch tolerated, both surfaces),
- and the rest behavior (accepted, inert).

One small confirmatory question (Q5) closes the **out-of-scope boundaries and
remaining edge cases** so the spec's "Out of Scope" section is explicit, then
this research is complete.

### Q5 — Out-of-scope boundaries and remaining edge cases

**Question sent to researcher:** To finish, I want the boundaries explicit so
the spec does not over-promise. Confirm or correct each, briefly:

1. **No audio.** Like every marking in this format, an arpeggio is **visual
   notation only** — there is no audio engine, so it changes nothing about how
   the song sounds (parallels `song-format.md:344` for hairpins). In scope to
   render; out of scope to sound. Correct?
2. **Per-hand independence / no cross-hand or cross-event arpeggio.** An
   arpeggio belongs to one event (one chord in one hand). There is no
   "rolled across both hands" grand-staff arpeggio and no arpeggio spanning
   multiple events. Correct, and is that worth stating as an explicit
   non-goal?
3. **Accessibility / accessible name.** There is an `accessibleName.js` /
   `accessibleName` concept in the song module. Does an arpeggio marking need to
   contribute to any accessible description/label of the chord (so it is not
   purely visual for assistive tech), or is that out of scope for v1 and a
   possible later addition? I want to know whether accessibility is a
   requirement or an explicit out-of-scope note.
4. **Anything else a reasonable reviewer would expect the spec to address** that
   we have not covered — interaction with ties/slurs on the same chord, with
   `dots`, with the `dynamic` on the same event, or with grace notes (if any)?
   Flag any gap now.

**Researcher's answer (evidence-backed):**

1. **No audio — confirmed.** A grep of `src` for audio/sound/playback/midi/
   webaudio finds **zero** audio engine. The doc states it verbatim for hairpins
   (`song-format.md:344`): "Like every marking in this format, a gradual-dynamic
   span is visual notation; it has no effect on how the song sounds. There is no
   audio engine in the block." Arpeggio is the same: **in scope** to render the
   sign; **out of scope** to make any sound, play back, or audibly roll the
   chord.

2. **Per-hand, single-event only — confirmed; state it as an explicit
   non-goal.** `arpeggio` is a field on one event, and one event is one chord in
   one hand's array (`measure.rightHand[]` or `leftHand[]`). It structurally
   cannot span hands or events — only the `start`/`stop` **span** fields pair
   across events, and arpeggio is not a span (Q1). The big grand-staff arpeggio
   (one squiggle rolling across both staves) is a real engraving device but is
   not expressible here and not in the intent. **Explicit non-goal:** an arpeggio
   marks a single chord (one event, one hand); a cross-hand / grand-staff
   arpeggio spanning both staves, or an arpeggio spanning multiple events, is out
   of scope.

3. **Accessibility — out of scope for v1; arpeggio matches the format-wide
   pattern by contributing nothing.** `accessibleName.js` derives the accessible
   name **solely** from `metadata.title`/`composer` — four branches yielding
   "title by composer" / title / "Piano sheet music by composer" / "Piano sheet
   music" (`accessibleName.js:23-47`). It describes nothing about the music: no
   pitches, dynamics, ties, slurs, or any marking. The whole SVG is one labeled
   graphic — `role="img"` plus a single `<title>` equal to that name
   (`svg.js:235-256`) — so assistive tech hears the song's **name**, never the
   notation content. Existing markings (dynamic/tie/slur/crescendo) therefore
   contribute **zero** to accessibility; arpeggio matches by contributing
   nothing. (Verified independently by the analyst reading `accessibleName.js`.)
   **Out of scope (explicit):** arpeggio is not separately announced to assistive
   technology; like every other notation marking it is not part of the SVG's
   accessible name (song title/composer only). A per-marking accessible
   description is future work touching all markings, not arpeggio-specific.

4. **Co-occurrence is free; no other gaps.**
   - **Combines freely with all other event markings.** The schema has **no**
     `oneOf`/`allOf`/`not`/`anyOf` anywhere — event fields are fully independent,
     so arpeggio + tie + slur + dots + dynamic on the same chord coexist with no
     mutual exclusion. They occupy different regions: arpeggio far left (outside
     accidentals), tie/slur arcs above/below noteheads, dynamic/hairpin below the
     staff, dots right of noteheads, accidentals left but **inside** the
     arpeggio. **Reassurance AC:** arpeggio combines freely with any other event
     markings on the same chord; each occupies its own region.
   - **Grace notes do not exist** in this format (no grace/acciaccatura/
     appoggiatura anywhere in `src` or docs), so "arpeggio on a grace note" is a
     non-question — not to be mentioned in the spec (mentioning it would imply
     grace notes exist).
   - **Rest case** already covered (Q4): control shows, value stored, render
     inert, never an error — ensure the spec states the render-inert-on-rest line
     so it is not a silent gap.
   - **No hidden interactions:** arpeggio does not touch beaming (beams are at
     stem ends, far away), barlines, or sections/clefs — it is a self-contained
     per-event decoration.

## Consolidated testable requirements (research output)

The following are the requirements the spec-writer should formalize. Each is
stated to be testable.

### Functional behavior

- **R1 — Field.** An event may carry an optional `arpeggio` field whose value is
  one of the closed enum `"up" | "down" | "nondirectional"`. The field absent
  means the chord is not arpeggiated.
- **R2 — Semantics.** Presence means the chord is arpeggiated (rolled); the value
  gives the direction — `up` = roll bottom-to-top (upward arrowhead), `down` =
  roll top-to-bottom (downward arrowhead), `nondirectional` = plain wavy line,
  no arrowhead.
- **R3 — Render form.** When set on a note that renders, the chord shows a
  vertical wavy line to the **left** of its noteheads, spanning the chord's full
  vertical extent (lowest to highest notehead). The direction is shown by the
  arrowhead's presence/position (`up` at top, `down` at bottom, none for
  `nondirectional`).
- **R4 — Outside accidentals.** The arpeggio line is drawn further left than any
  accidentals on that chord (and clear of stems); with no accidentals it sits at
  a fixed gap left of the noteheads.
- **R5 — Single-pitch.** An arpeggio on a single-pitch note is accepted and
  renders a (short) arpeggio line; it is not an error.
- **R6 — Render parity.** The arpeggio renders identically on the editor canvas
  and the published front end (one shared notation core).

### Authoring

- **R7 — Editor control.** The visual editor exposes the arpeggio on the selected
  note in the Note-details inspector as a select with options
  None / Up / Down / Nondirectional; choosing "None" removes the field (no
  `arpeggio` key written). A loaded song's existing `arpeggio` value is shown
  selected.
- **R8 — Rest UX (decided: show-but-inert).** The control is shown for a rest as
  well (matching the existing inspector pattern); a value may be set and stored,
  but it has no rendered effect on a rest, and it is never an error.

### Persistence / validation

- **R9 — Round-trip.** The field is stored verbatim in the `song` attribute and
  survives raw-JSON editing unchanged.
- **R10 — Closed-enum validation, non-blocking.** Validation accepts the three
  values; an out-of-vocabulary value is flagged informationally only and **never
  blocks saving**, exactly like other closed enums.
- **R11 — Permissive context.** `arpeggio` on a rest (or any context) is accepted
  and never rejected; there is no negative/contextual conformance rule.

### Out of scope (explicit non-goals)

- **O1 — No audio.** Visual notation only; no sound, playback, or audible roll.
- **O2 — No grand-staff / multi-event arpeggio.** One chord, one event, one hand;
  no cross-hand squiggle and no arpeggio spanning multiple events.
- **O3 — No per-marking accessibility.** Arpeggio is not separately announced to
  assistive technology; consistent with every existing marking. Future work.
- **O4 — No font change required (and none in scope).** Rendering is hand-drawn
  SVG, matching ties/slurs/hairpins; adding SMuFL arpeggio codepoints to the font
  subset is neither needed nor in scope.

### Acceptance-criteria candidates (for the spec-writer)

- A valid song with `"arpeggio": "up"` (and `"down"`, `"nondirectional"`) on a
  note validates without error and round-trips through raw JSON unchanged.
- An out-of-vocabulary `arpeggio` value (e.g. `"sideways"`) is flagged but does
  not block saving.
- A chord with `arpeggio` renders a wavy line to the left of its noteheads,
  outside any accidentals, spanning the chord height; `up`/`down` show the
  arrowhead at top/bottom; `nondirectional` shows no arrowhead.
- The same arpeggio renders identically in the editor canvas and the front-end
  SVG.
- A single-pitch note with `arpeggio` renders without error.
- A rest with `arpeggio` set is accepted, draws no arpeggio, and is not an error.
- Arpeggio set together with `tie`/`slur`/`dots`/`dynamic` on the same chord
  renders all of them, each in its own region.

## Research status

Q1–Q5 complete; vocabulary locked (Option B1, `arpeggio: up|down|nondirectional`);
attachment point, render path, authoring, lifecycle, parity, and scope
boundaries all confirmed with file:line evidence and two live `buildLayoutModel`
experiments. Ready for the spec-writer.
