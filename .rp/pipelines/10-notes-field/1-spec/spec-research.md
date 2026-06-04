# Spec research — issue #10: Replace per-note `chordSymbol` with a free-text "notes" capability

_Phase: 1-spec. Driven by `spec-analyst` via Q&A with `spec-researcher`. Source prompt: `0-prompt/prompt.md`._

## Context grounding (from the current codebase)

Findings established before the Q&A, used to ground the questions:

- **Current data model** (`src/song/schema.js`): `chordSymbol` is an optional `string` property on an `event` object (`event` lives in a measure's `rightHand`/`leftHand` array). It is per-event only; there is no standalone-annotation concept anywhere in the format today.
- **Current placement is hardcoded, single-cell** (`src/notation/layout.js`, `src/notation/svg.js`): chord symbols render **above the right-hand staff only**, in a dedicated stacked "chord lane" (`chordSymbolY`) above the RH staff. Dynamics (`dynamic`) render **below** the hand's staff. The requested 2×2 matrix (above/below × RH/LH) currently has only one cell implemented (above-RH for chord symbols).
- **Lane stacking** above the staff: chord nearest the staff, then ottava, then tempo, each a system-local Y baseline that collapses when absent (`topMarginLayout`). Below-staff currently holds dynamics.
- **Free text is already handled safely**: `chordSymbol` is escaped/inert in render (text-safety tests in `specs/render.spec.js`, `src/notation/svg.js`). The new notes field inherits the same free-text, escape-on-render expectation.
- **Schema is permissive & additive**: `additionalProperties` permissive everywhere; no `version` field; format grows additively. Unknown keys are ignored, not errors.

## Open questions to resolve

(see Q&A log below)

## Q&A log

### Researcher's grounding (pre-Q&A, confirms context above)

Researcher traced `chordSymbol` end-to-end and confirmed:
- Schema `src/song/schema.js:145`; it is the format's only deliberately-open free-text field (all else closed enums).
- Validation `src/song/validate.js`: no special-case; validated only as generic `type:"string"`; unknown fields silently ignored (permissive), so typos are NOT flagged.
- Docs `docs/song-format.md` (event shape lines 167/178/183-188, example line 298); README mentions only re: text-safety.
- Layout `src/notation/layout.js`: `collectEventTexts()` (1550) pushes `{kind:"chordSymbol"}`; hard-wired to **RH staff, above** only — `systemHasChordSymbols()` (2239) scans ONLY `rightHand`; one flex "chord lane" ABOVE RH (`chordSymbolY`, 2277). **LH chord symbols are collected but have no lane Y to land in today.**
- Emit `src/notation/svg.js`: `renderHandText()` (845) draws non-dynamic text via `textContent` (XSS-inert), `data-text="chord-symbol"`. Dynamics row is a fixed `y:3.5` below the staff — the ONLY below-staff text today.
- Tests locking behavior: `layout.test.js:1305,1487-1530`; `svg.test.js:29,119-134`; E2E `render.spec.js:73,230,343,478`, `editor.spec.js:66`; `validate.test.js:53`.

Three structural constraints from the researcher:
1. `chordSymbol` is event-level only; **standalone/measure-level annotation is genuinely new structure.**
2. The text-lane system (`topMarginLayout`) models only ABOVE-staff lanes; the only below-staff text is the fixed dynamics row. **Supporting "below" is new vertical-layout work.**
3. Placement is implicit today (RH + above); the prompt wants explicit {staff, above/below} per note.

### Q1 — per-event note representation (single field vs. array; is staff implicit?)

**Recommendation (researcher): option (b) — a `notes` array on `event`**, each element `{ text: <free string>, placement: "above" | "below" }`. The staff is **implicit** (the hand whose array the event lives in). Replaces `chordSymbol` outright. Old case `chordSymbol: "C"` becomes `notes: [ { text: "C", placement: "above" } ]`.

Rationale:
- The array is a **real** requirement, not speculative: the prompt's own two examples (chord symbol AND "pedal") are the classic "chord above + pedal below the same event" — standard engraving (chord symbols above, pedal/Ped. below). A single-field shape forces authors to drop one or split across events (lossy). Array makes the common single case trivial while enabling the dual case.
- Precedent (single `chordSymbol`) is weak here: it was single only because it modeled exactly one always-above concept. The new field is deliberately general, so a single slot becomes too narrow. The format's additive-growth philosophy favors the more expressive shape when the use case is concrete (it is).
- **No per-event "which staff" field.** Staff is fully determined by `rightHand` vs `leftHand`; adding a staff field would be redundant, and inviting a RH event to render against the LH staff is a confusing model (visually detaches note from label). The four grand-staff positions (above/below × RH/LH) are all reachable from {hand-membership} × {placement}: e.g. `{rightHand, below}` and `{leftHand, above}` both land in the between-staves gap.
- Design-phase carve-outs (do not block the data shape): (i) two same-placement notes on one event → render stacked in array order; (ii) renderer has no between-staves lane today — new layout work, but the data model needs nothing beyond `placement`.
- "Render against the other hand's staff" only matters for **standalone** notes (next question); must not pollute the per-event shape.

Sources: Open Music Theory (chord symbols above), Soundslice (pedal below), Wikipedia list of musical symbols.

### Q2 — standalone-note representation & granularity

**Recommendation (researcher): standalone notes on the `measure` object as a `notes: []` array**; each element reuses the per-event `{ text, placement }` shape PLUS required `staff` and optional `beat`. Mirrors MusicXML `<direction>` ("a musical indication not attached to a specific note," measure-level, carries placement + staff + offset).

**(a) Attachment level → `measure` object; measure-only for v1.**
- The `measure` is the only level that already pairs both hands AND has a horizontal extent — exactly what a standalone annotation positions against. Per-measure is strictly more expressive than per-section (a section label attaches to the section's first measure; not vice versa).
- Matches MusicXML: standalone directions ("rit.", rehearsal marks, segno, pedal) attach at the **measure** level.
- **No section-level or song-level slots in v1** (additive-growth philosophy: start minimal). Could be added additively later if a real need appears.
- `measure.notes` (standalone) and `event.notes` (per-event) share the key intentionally — one "notes" concept, two attachment modes. Mirrors how `rightHand`/`leftHand` already appear at both section/defaults (handConfig) and measure (event arrays) levels. Two separate schema `properties`; no ambiguity.

**(b) Horizontal position → OPTIONAL `beat`; default = measure-left.**
- Absent anchor → renderer places at the **measure's left edge** (natural for measure-spanning labels / rehearsal marks; zero-config, trivially testable).
- Finer control: ONE optional field `beat` (number ≥ 0, in quarter-beats — the unit the format already uses; `BASE_DUR` is quarter-beats). Renderer maps the beat onset onto the same union-grid X machinery events use (`handOnsets`/`measureLayout`). Prefer `beat` over a 0..1 fraction or absolute sp/px (px/sp would leak renderer internals).
- **Point annotations only in v1; spans deferred as a documented non-goal.** Prompt's examples are all point annotations (chord, "pedal" the word, section label). True spanning brackets (pedal line, "rit. ——" extension) need start+end anchors and bracket drawing — materially more layout work, not asked for. Note "pedal" in the prompt is the *word*, so point-text satisfies it.

**(c) Staff + placement → standalone needs BOTH explicit.**
- `staff: "rightHand" | "leftHand"` (REQUIRED — no hand array to imply it) + `placement: "above" | "below"`. Together reach all four grand-staff positions (above-RH, below-RH/gap, above-LH/gap, below-LH).
- **No third "between-staves/centered" placement value in v1.** The inter-staff gap is already reachable via `{leftHand, above}` or `{rightHand, below}`; a dedicated centered lane is new renderer work for marginal benefit (rehearsal marks conventionally sit above the top staff = `{rightHand, above}`). Keep axes orthogonal & minimal; centered lane is an additive enum extension later if wanted.
- `staff` REQUIRED for standalone (the one place standalone diverges from per-event). An optional `staff` with a default is ambiguous on a grand staff.

**(d) Shape consistency → ONE "note" element shape, attachment-mode-dependent fields.**
- Single conceptual element `{ text, placement, staff?, beat? }`:
  - per-event (`event.notes[]`): `{ text, placement }`; `staff`/`beat` forbidden/ignored (staff implied by hand, X from event).
  - standalone (`measure.notes[]`): `{ text, placement, staff, beat? }`; `staff` REQUIRED, `beat` optional (default measure-left).
- Keeps the format coherent (one "note" model, the prompt's own word) and the renderer simple (both feed the same `textContent`-inert text path in `svg.js`, differing only in upstream X/staff resolution). Validator stays simple: `text` required string everywhere; `placement` same closed enum everywhere; `staff` closed enum required only in the standalone position.
- Rejected fully-distinct shapes (`annotation` vs `note`): doubles schema defs + renderer paths for no gain; fights the prompt's "one notes capability, two modes" framing.

**Concrete shapes proposed:**
```jsonc
// per-event, on an event:
"notes": [ { "text": "C", "placement": "above" },
           { "text": "pedal", "placement": "below" } ]

// standalone, on a measure:
"notes": [ { "text": "rit.", "placement": "above", "staff": "rightHand" },
           { "text": "ped.", "placement": "below", "staff": "leftHand", "beat": 0 } ]
```
`placement`: `above | below`. `staff` (standalone only, required): `rightHand | leftHand`. `beat` (standalone only, optional): number ≥ 0 quarter-beats; absent → measure-left.

**Design-phase items (not blockers):** stacking order for multiple notes sharing a lane/placement at one measure; whether `beat` clamps when it exceeds measure content; new below-staff + inter-staff text lanes the renderer must grow (today only above-RH chord lane + fixed dynamics row).

Sources: MusicXML `<direction>`, `<offset>`, musical-directions tutorial.

### Q3 — `chordSymbol` removal semantics (schema, validator, legacy songs, test fallout)

**(a) Schema/docs removal — clean, no dual-existence.** Delete `chordSymbol` from the `event` def (`schema.js:145`); remove all `chordSymbol` prose/examples from `docs/song-format.md` + README; add `notes`. NO period where both live in the schema (constraint is explicit).

**(b) JUDGMENT CALL → clean break: silent-ignore legacy `chordSymbol`, NO auto-migration, NO new error/warning.** After removal, a song still carrying `chordSymbol: "C"` is just an unknown optional key — permissively ignored (still "valid"), not rendered. Accept exactly that.
- Fits project stage (early; no evidence of real install base) and philosophy (no `version` field → no honest way to scope migration to "one transitional release"; auto-migration would be permanent legacy code, against start-minimal).
- Silent-ignore is already the format's documented contract for unknown/removed optional fields ("a misspelled optional field is silently dropped from meaning, not flagged"). A removed field is just newly-unknown; consistent, lowest-surprise.
- **Reject "validator actively rejects `chordSymbol`":** introduces a never-before-existing "forbidden key" concept, contradicts permissive `additionalProperties`, needs a permanent denylist. More machinery. Don't.
- **Reject auto-translation:** with no version field it can't be transitional (permanent); it's a silent data rewrite, violating the format's store-verbatim guarantee ("the format never rewrites your text"); near-zero benefit given no install base.
- Only downside: a hand-author who upgrades sees the annotation silently vanish. Acceptable at this stage. Soft mitigation that violates no principle: ONE explanatory doc line ("`chordSymbol` was replaced by `notes`; rewrite `chordSymbol: \"C\"` as `notes: [{ \"text\": \"C\", \"placement\": \"above\" }]`"). Docs only — no code, no migration path, no validator change.

**(c) Test/example fallout — acceptance bar confirmed: "no `chordSymbol` token remains anywhere in `src/`, `specs/`, `docs/` — fully superseded by `notes`."** Update sites:
- `src/song/schema.js:145`; `src/song/__tests__/validate.test.js:24,53`.
- `src/notation/layout.js`: `collectEventTexts` (1550), `systemHasChordSymbols` (2239), the `chordSymbol` text kind, `chordSymbolY` lane plumbing → read `notes`.
- `src/notation/svg.js:845` `renderHandText` (`data-text="chord-symbol"` path) → repoint to `notes`.
- `src/notation/__tests__/layout.test.js` (844 fixture, 1305-1315 surfaces test, 1487-1530 lane-stacking) and `svg.test.js` (29 fixture, 119-134 XSS test).
- E2E `specs/render.spec.js` (48 comment, 73 fixture, 215-230 hostile-literal, 341-343 & 478 `[data-text="chord-symbol"]` assertions) and `specs/editor.spec.js` (51-66 hostile fixture).
- `docs/song-format.md` (event shape, example); `README.md` text-safety paragraph; `src/render.php:13` comment.

**Two behaviors that MUST be preserved verbatim under `notes` (ACs):**
1. **Free-text rendering** of an above-RH-staff annotation still works — old `chordSymbol:"C"` → `notes:[{text:"C",placement:"above"}]` on an RH event renders an equivalent SVG `<text>` in the above/chord lane. Lane-stacking + "renders C" tests get **rewritten** against `notes` (capability retained, not deleted).
2. **XSS-inertness** — author free text stays inert. `renderHandText`/`setText` use `textContent` only (never `innerHTML`); PHP script-breakout escape covers `notes` text as it did `chordSymbol`. Hostile-literal tests retargeted to a `notes` text value and still pass (a `notes` entry with `</script>`/`<alt>` round-trips inert). Non-negotiable: `notes` inherits the exact same untrusted-free-text status; every text-safety guarantee transfers 1:1.

### Q4 — validation rules & edge cases for `notes` fields

**Validity table (each row is a testable AC):**

| Field | Where | Required? | Type / values | Edge / out-of-range | Mechanism |
|---|---|---|---|---|---|
| `notes` | `event`, `measure` | optional | array of note elements | absent → valid; `[]` → valid (renders nothing) | `type:"array"` + `items:{$ref}` |
| `text` | every note | **required** | `string` | `""` → **valid** (not rendered) | `required:["text"]` + `type:"string"` |
| `placement` | every note | **required** | enum `above\|below` | other value → error; absent → error | `enum` + `required` |
| `staff` | standalone | **required** | enum `rightHand\|leftHand` | other → error; absent → error | `required:["staff"]` + `enum` |
| `staff` | per-event | n/a | — | stray `staff` → **ignored** (permissive) | not in `eventNote` props |
| `beat` | standalone | optional | `number`, `≥ 0` | negative → error; `0` → valid; > measure content → **valid** (renderer clamps) | `type:"number"` + walker `≥ 0` |
| `beat` | per-event | n/a | — | stray `beat` → **ignored** | not in `eventNote` props |

**(a) `text` — required string; empty `""` is VALID-but-not-rendered.** `required:["text"]` (mirrors required `type`/`duration` on event). Keep the renderer's `length > 0` guard (`layout.js:1554,2243`) so `""` produces no glyph. Making `""` a validation error would be new strictness the format never applies (`metadata.title:""` is fine). AC: `text:""` is conformant, renders nothing.

**(b) `placement` — REQUIRED, no default; do NOT default to "above".** The format reserves defaulting/inheritance for section-level musical context (`defaults`→section); meaning-bearing leaf fields are stated explicitly (event's `type`/`duration`, pitch's `step`/`octave`). `placement` is exactly such a per-note choice — the issue's whole point is placement is chosen per note; defaulting would re-introduce the implicit placement the issue moves away from. Required also keeps the two modes symmetric (both require `text`+`placement`). AC: omitting `placement` errors; `placement:"middle"` errors.

**(c) `staff` requiredness — TWO distinct `$defs`, NOT one conditional def.** The existing `if`/`then` discriminates on a property's `const` value; a note element has NO discriminant field for standalone-vs-per-event — the distinction is **positional** (`event.notes` vs `measure.notes`). So `if`/`then` can't express it. Clean expression:
- `eventNote` = `{ required:["text","placement"], properties:{ text:string, placement:enum } }` (no `staff`/`beat`).
- `standaloneNote` = `{ required:["text","placement","staff"], properties:{ text:string, placement:enum, staff:enum, beat:number } }`.
- `event.notes.items` → `$ref eventNote`; `measure.notes.items` → `$ref standaloneNote`.

Needs ZERO new walker machinery / keyword support — pure `$ref`/`required`/`enum` (all implemented). Self-documents the "one concept, two modes" framing. A stray `staff`/`beat` on a per-event note → **ignored** (permissive `additionalProperties`); forbidding them would need a non-permissive check the format never does. AC: `{text,placement,staff}` in an event's notes is conformant; `staff` ignored.

**(d) `beat` — `type:"number"`, optional, `≥ 0` (NOT `> 0`), walker-delegated; over-content does NOT error.** `number` not `integer` (fractional offsets are real: eighth=0.5, sixteenth=0.25; quarter-beats like `BASE_DUR`). Bound is a walker special case (parallel to `tempo.bpm > 0` in `applySpecialCases`), keyed by `$defs` name (`standaloneNote`). `≥ 0` not `> 0` because beat 0 = the downbeat (legitimate; also the default position). **`beat` exceeding measure content → VALID** — the format has NO musical-timing validation anywhere (docs §measures: "events need not add up to its time signature… no musical-timing validation"); also there's no well-defined measure length to check against (hands needn't align, bars needn't sum). Renderer clamps best-effort (e.g. measure's right content edge); clamping is a layout-phase detail. AC: `beat:-1` errors; `beat:0`, `beat:0.5`, `beat:99` all conformant.

**(e) Optionality.** `notes` optional on both `event` and `measure` (absent → valid, mirrors today's optional `chordSymbol`). Empty `notes:[]` → **valid** (no `minItems` used anywhere; natural "declared but empty" state). ACs.

**Cross-cutting (test matrix):** the walker iterates `items` per element, so per-element errors (bad `placement`, missing `text`, missing `staff` on standalone, negative `beat`) are path-pointed (e.g. `sections[0].measures[0].notes[1].placement`), consistent with all other array-element errors today — good for precise AC assertions.

### Q5 — testable rendering ACs + spec/design boundary

**Renderer's observable surface:** each text node is an SVG `<text>` with `data-text="<kind>"`, nested in `<g data-measure="N">` → `<g data-hand="rightHand|leftHand">` → (per-event) `<g data-event-index="i">`. Band exposes named Y anchors (`rightStaffTopY/BottomY`, `leftStaffTopY/BottomY`). Unit tests assert on the layout model (`buildLayoutModel` texts/band Ys); E2E asserts on the DOM. Y grows **downward** (smaller Y = higher on page).

**(a) Four positions observably distinct — AC = "node exists with correct text AND Y in the expected band relative to named staff lines."** Offsets left to design. Band rules:
- above-RH: Y < `rightStaffTopY`.
- below-RH: `rightStaffBottomY` < Y < `leftStaffTopY` (inter-staff gap, under RH).
- above-LH: `rightStaffBottomY` < Y < `leftStaffTopY` (inter-staff gap, over LH).
- below-LH: Y > `leftStaffBottomY`.
- AC is the *band/direction*, not the magnitude. below-RH and above-LH share a band (expected). **Also require a structural discriminator** so tests aren't purely Y-threshold-based: the node exposes its placement observably (e.g. a `data-placement="above|below"` attr; staff given by the enclosing `data-hand` or a `data-staff`). Spec requires "placement observable on the node"; exact attribute name is design.

**(b) Horizontal anchoring — both testable requirements.**
- Per-event: note text X tracks its event's X (same column as notehead). Model: text X == event's laid-out X (today `collectEventTexts` passes the event's `x` through). DOM: shares the column of its `data-event-index` note. Real requirement (a per-note annotation that drifts off its note is broken).
- Standalone with `beat:n`: renders at the X of that beat onset (same union-grid onset→X mapping events use). With no `beat`: near the measure's left edge. AC framed by the *relative* invariant: beat:2 further right than beat:0; no-beat ≈ left (within measure bounds). Exact left offset is design.

**(c) Free text + safety — CONFIRMED in the rendering AC set, carried 1:1 from `chordSymbol`.**
- Literal free text renders as-is: `text` appears verbatim as the `<text>` node content (`"Gm7"` → node textContent `"Gm7"`).
- XSS-inert: text set via `textContent` never `innerHTML` (`svg.js:setText`); PHP `<`→escape (`render.php`) neutralizes `</script>`/`<!--`. AC: a `notes[].text` of `"<script>alert(1)</script>"` (or `'C7 & <alt> "sus"'`) renders as inert literal text, no executable/markup node. Hard ACs, retargeted from `svg.test.js:119` / `render.spec.js:215-230` / `editor.spec.js:66`.

**(d) Multiple notes / coexistence — testable bars; exact stacking left to design.**
- Both above + below on one event (chord+pedal): two text nodes render — one in the above band, one in the below band, both at the event's X. (Directly tests the prompt's headline example.)
- Multiple same-placement notes: AC = "N nodes present at N DISTINCT Ys" (stacked; none lost, none colliding at identical Y). Exact gap/order is design.
- Per-event + standalone in the same measure: AC = both nodes render. Confirms the two attachment modes coexist.

**(e) Explicitly DESIGN, NOT spec (confirmed):** exact sp offsets / lane-gap sizes; font size/family/weight; collision-avoidance precision (only "distinct Y, no overlap" is spec); clamp X for over-content `beat` (only "still renders within the system, best-effort" is spec); whether below-RH and above-LH share one inter-staff lane or two; vertical lane *ordering* among above-staff occupants (note vs. tempo vs. ottava); the new below-staff/inter-staff lane machinery itself (spec requires capability + observable band; design builds the lanes).

**Boundary in one sentence:** spec requires *capability + observable position (correct band relative to named staff) + horizontal anchoring + free-text/XSS behavior + coexistence*; design owns *all magnitudes, fonts, lane structure, precedence, and clamp/collision math*.

## Resolved requirements

Consolidated from A1–A5. These are the testable requirements the standalone spec should formalize.

### R1 — Data model: one "note" concept, two attachment modes

- **Per-event note** — an optional `notes` array on an `event`. Element shape `{ text, placement }`:
  - `text`: required string (free text; open vocabulary).
  - `placement`: required enum `"above" | "below"`.
  - Staff is **implicit** — the hand whose array the event lives in (`rightHand`/`leftHand`). No `staff` field; a stray `staff`/`beat` is ignored (permissive).
- **Standalone note** — an optional `notes` array on a `measure`. Element shape `{ text, placement, staff, beat? }`:
  - `text`: required string. `placement`: required enum `"above" | "below"`.
  - `staff`: **required** enum `"rightHand" | "leftHand"` (no hand array to imply it).
  - `beat`: optional `number`, `≥ 0`, in quarter-beats; absent → renders at measure-left.
- Schema expression: two `$defs` — `eventNote` (`required: [text, placement]`) and `standaloneNote` (`required: [text, placement, staff]`); `event.notes.items → $ref eventNote`, `measure.notes.items → $ref standaloneNote`.
- `notes` is optional on both `event` and `measure`; `notes: []` is valid.
- v1 scope: **point annotations only** (no spanning brackets/lines); **measure-level** standalone granularity only (no section/song-level note slots). Both are documented non-goals, extensible additively later.

### R2 — `chordSymbol` removed (clean break)

- `chordSymbol` is deleted from the schema, validator-relevant code, all tests, docs, README, and the `render.php` comment. No period where both `chordSymbol` and `notes` exist.
- A legacy song still carrying `chordSymbol` stays **valid** (unknown optional key, silently ignored per permissive model) and that annotation simply **does not render**. No auto-migration, no validator rejection, no warning.
- One explanatory line added to docs: how to rewrite `chordSymbol: "C"` as `notes: [{ "text": "C", "placement": "above" }]`.
- Acceptance bar: **no `chordSymbol` token remains anywhere in `src/`, `specs/`, `docs/`** — fully superseded by `notes`.

### R3 — Validation (each row of A4's table is an AC)

- `text` required (every note); `""` is valid-but-not-rendered (keep the renderer's `length > 0` guard).
- `placement` required, enum `above|below` (no default); omitting → error; bad value → error.
- `staff` required on standalone notes, enum `rightHand|leftHand`; omitting on a standalone note → error; bad value → error. Ignored on per-event notes.
- `beat` optional on standalone, `type:"number"`, `≥ 0` (walker-delegated, parallel to `bpm > 0`); negative → error; `0`/`0.5`/`99` valid (no musical-timing validation — over-content `beat` does not error).
- `notes` optional everywhere; `notes: []` valid.
- Per-element errors are path-pointed (e.g. `sections[0].measures[0].notes[1].placement`).

### R4 — Rendering (capability + observable position; geometry is design)

- The four positions (above/below × RH/LH) render in the correct vertical **band** relative to the named staff lines (per A5(a)), for both per-event and standalone notes; placement is observable on the node (e.g. a `data-placement` attribute).
- Per-event note text tracks its event's X (same column as the notehead).
- Standalone note renders at its `beat` onset X; with no `beat`, near the measure's left edge (relative invariant: higher beat → further right; no-beat ≈ left).
- Free text renders verbatim as the node's text content; author text is XSS-inert (`textContent`, never `innerHTML`; PHP-escaped) — carried 1:1 from `chordSymbol`, including the hostile-literal cases.
- Coexistence: an event with both an above and a below note renders both (the chord+pedal case); N same-placement notes render at N distinct Ys (stacked, no overlap); per-event and standalone notes in the same measure both render.
- Out of scope for the spec (design owns): exact offsets/lane gaps, fonts, collision-avoidance precision, over-content clamp X, lane-sharing/lane-ordering structure.

### Open items handed to the design phase (not blockers)

- **BIGGEST IMPLEMENTATION LIFT — new below-staff + inter-staff text lanes.** Today the renderer models only an above-RH chord lane (`chordSymbolY` in `topMarginLayout`) plus a single fixed dynamics row (`y: 3.5` in `svg.js:renderHandText`). Three of the four note positions — below-RH, above-LH (the inter-staff gap), and below-LH — have **no lane at all** today. Building these is genuinely new vertical-lane work in `topMarginLayout`/the band model, NOT an incidental tweak; it is the largest deliverable hiding behind the small data-model change. Flag it to design/code as a concrete deliverable. (Subsumes: above/below offsets, lane sharing for below-RH vs above-LH, and lane precedence vs. tempo/ottava.)
- Stacking order/gap for multiple same-placement notes at one anchor.
- Clamp behavior/X for an over-content `beat`.
- The observable placement-discriminator attribute name(s) on emitted nodes.
