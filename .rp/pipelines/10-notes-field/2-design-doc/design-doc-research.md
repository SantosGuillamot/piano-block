# Design research — issue #10: free-text `notes` annotations (above/below either staff)

_Phase: 2-design-doc. Driven by `design-doc-analyst` via Q&A with `design-doc-researcher`._
_Inputs: `1-spec/spec.md` (approved), `1-spec/spec-research.md` (resolved requirements + design hand-offs), `0-prompt/prompt.md`._

This file records the **design** decisions (not requirements — the spec is fixed). It resolves the
items the spec explicitly handed to the design phase:

1. The vertical lane/band machinery for below-staff & inter-staff notes.
2. Stacking gap & order for same-placement notes at one anchor.
3. The over-content `beat` clamp X.
4. The placement-discriminator DOM/model attribute name(s).
5. Plus: the exact JSON-schema additions, the `chordSymbol` removal map, the per-event-vs-`beat`
   X-anchoring, the inter-staff shared band, and the verbatim/XSS-inert text path reuse.

Every decision is anchored to concrete existing code.

## Codebase grounding (verified before the Q&A)

### Data / validation
- `src/song/schema.js`: `chordSymbol: { type: "string" }` is an `event` property (line 145). Schema
  is a small JSON-Schema subset (`type`, `required`, `properties`, `items`, `enum`, `$ref`/`$defs`,
  integer `minimum`/`maximum`, one `if`/`then`). `additionalProperties` permissive everywhere → unknown
  keys ignored (so a legacy `chordSymbol` after removal is silently valid). No `version` field.
- `event` `$def` (127-154); `measure` `$def` (72-84); `pitch`/`tempo` show the `$ref` + walker-special-case
  pattern.
- `src/song/validate.js`: `applySpecialCases(value, defName, path, errors)` (263) dispatches walker
  checks by `$defs` name — `checkBpm` (319) handles `bpm`'s STRICT `>0`. (NOTE: D1 establishes `beat` does
  NOT need a walker check — its `>=0` is INCLUSIVE, expressible declaratively as `minimum:0`, so
  `validate.js` is unchanged for this feature.) `validateArray` (166) path-points each element as
  `…[index]`; `validateObject` (180) handles `required` + recurses `properties`; the generic `minimum`
  check (140) already fires on `$ref`'d array items. Enum errors (120) and type errors (131) are already
  path-pointed. Stray keys are ignored (permissive) → a stray `staff`/`beat` on a per-event note is a
  no-op, no special code needed.

### Rendering — layout (`src/notation/layout.js`)
- `collectEventTexts(event, x, out)` (1550): pushes `{ kind: "dynamic", x, text }` (below) and
  `{ kind: "chordSymbol", x, text }` (above-RH) per event. Called from each hand's event walk (1438,
  1447, 1511). Guards `chordSymbol.length > 0`.
- Band Y model, per system (1688-1701): `rightStaffTopY (= topMargin)`, `rightStaffBottomY`,
  `leftStaffTopY (= rhBottomY + INTRA_STAFF_GAP)`, `leftStaffBottomY`, plus flexible above-staff lane
  baselines `tempoLaneY`, `ottavaAboveLaneY`, `chordSymbolY` (each null when absent). Y grows DOWNWARD.
  `INTRA_STAFF_GAP = 8 sp` (constants 78) is the whole inter-staff gap available for the shared band.
- `topMarginLayout(members, ledgerTop)` (2260): the ONLY lane stacker today. Stacks above the staff,
  nearest-first: chord (`chordSymbolY`) → ottava-above → tempo, each present-only; collapses to
  `SYSTEM_TOP_MARGIN` when empty. There is NO equivalent below-staff / inter-staff stacker — that is the
  biggest new build.
- `systemHasChordSymbols(members)` (2239) scans `rightHand` only — LH chord symbols are collected but
  have no lane.
- `buildSystemTexts(members, measureModels, band)` (2320): builds system-level texts (tempo, measure
  number, ottavas). Below-ottava lands at `staffBottomY + 2` (a fixed below offset, the only existing
  below-staff text-Y precedent besides dynamics).
- Per-event texts currently flow through the measure/hand model (`hand.texts`), NOT `buildSystemTexts`.

### Rendering — emit (`src/notation/svg.js`)
- `renderMeasure(measure, band)` (469): wraps in `<g data-measure=N transform="translate(measure.x 0)">`.
  Computes `chordDyR/chordDyL` = `band.chordSymbolY - band.{right,left}StaffBottomY` (479-486) to convert
  the system chord lane into each hand's LOCAL frame, then calls `renderHand`.
- `renderHand(hand, handKey, staffBottomY, chordDy)` (514): `<g data-hand=handKey
  transform="translate(0 staffBottomY)">`; draws beams, notes, rests, then `hand.texts` via
  `renderHandText`. Everything inside is in the hand's local frame (origin = staff bottom line; +Y down,
  −Y up).
- `renderHandText(text, chordDy)` (845): `dynamic` → `<text y=3.5 data-text="dynamic">` (fixed below);
  else chord → `<text y={chordDy ?? -5} data-text="chord-symbol">`. Both via `setText` (`textContent`,
  XSS-inert). This is the verbatim/inert free-text path the spec requires reused.
- Note/rest groups carry `data-hand` + `data-event-index` (548-549, 688-689). Per-event note text needs
  to share the event's X column (the model already passes the event's `x` through `collectEventTexts`).
- `renderSystemTexts` (879) emits the system-level texts (tempo/measure-number/ottava) at the system `<g>`
  level (outside the measure/hand groups).

### Constants (`src/notation/constants.js`)
- `INTRA_STAFF_GAP = 8`, `TEXT_LANE_GAP = 0.6`, `ABOVE_STAFF_PAD = 1`, `SYSTEM_TOP_MARGIN = 5`,
  `SYSTEM_BOTTOM_MARGIN = 5`, `CHORD_SYMBOL_SIZE = 2.8`, `DYNAMIC_SIZE = 2.8`, `BASE_DUR` (quarter-beats).
- Below-staff text sizes / inter-staff lane gaps do not exist yet → new constants likely.

## Final design decisions (summary — full rationale in the Q&A log below)

All spec design hand-offs are RESOLVED. Canonical decisions, in dependency order:

1. **Schema (D1).** Two `$defs`: `eventNote {required:[text,placement]}` and
   `standaloneNote {required:[text,placement,staff]}` with `beat:{type:"number", minimum:0}`. `event.notes
   → $ref eventNote`; `measure.notes → $ref standaloneNote`. Delete `chordSymbol` (`schema.js:145`).
   **`validate.js` is UNCHANGED** — `required`/`enum`/`type`/`minimum` cover everything (no `checkBeat`;
   `minimum:0` is the inclusive bound, unlike `bpm`'s strict `>0`). Enums inline. `text:""` valid.
2. **`chordSymbol` removal (D2).** Clean break across 13 files (full inventory in D2(a)); legacy songs stay
   valid (permissive) and don't render; one docs migration line. Renames: `CHORD_SYMBOL_SIZE → NOTE_SIZE`;
   `data-text="chord-symbol" → "note"`; `collectEventTexts` loops `event.notes` pushing
   `{kind:"note", x, text, placement}`; `systemHasChordSymbols`/`chordSymbolY` superseded by the D3 lane
   model. XSS-inertness + above-RH rendering transfer 1:1 (zero new safety code); tests RETARGET.
3. **Four bands (D3) + PAIR A flex (D3fu).** above-RH = the renamed `topMarginLayout` lane (innermost,
   below ottava/tempo). Inter-staff gap holds TWO sub-bands (below-RH grows down from RH bottom; above-LH
   grows up from LH top). The gap ALWAYS flexes (`effectiveInterStaffGap = max(8, belowRH_stack +
   aboveLH_stack + per-side-dynamics-reservation + MID_GAP_if_both)`, collapsing to 8 when empty), computed
   BEFORE `lhTopY` (the one reorder). below-LH flexes the bottom margin. below-RH/below-LH notes dodge their
   hand's dynamics row only when that hand has dynamics in the system. All geometry cascades from band
   anchors (verified: no exact-value test breaks; `INTRA_STAFF_GAP` has one consumer; svg.js imports no
   gap/height constant).
4. **X-anchoring (D4).** Per-event notes = the event's column X (`collectEventTexts`, now carrying
   `placement`). Standalone notes = a new `measureModel.standaloneNotes` collection resolved at the
   measure-walk site; X = INTERPOLATED beat onset (lerp over the scaled `columnX`); no-`beat` ≡ `beat:0` ≡
   `leadInset`. **Over-content clamp = `min(beatToX(min(beat, measureEnd)), measureRightX −
   NOTE_CLAMP_INSET)`**, inset ≈ 1.0sp (because `measureEnd`'s X coincides with the trailing barline).
5. **Stacking (D5).** "array order = increasing distance from the note's own staff," uniform across all four
   bands; one step = `NOTE_SIZE + TEXT_LANE_GAP` = 3.4sp. Grouping: per-event by `(event, placement)`,
   standalone by `(staff, placement, raw beat)`. Lane heights / flex inputs use the system-wide MAX stack
   per anchor. Both-above-and-below on one event = two `event.notes` entries, independent bands, no special
   handling.
6. **Observability + styling (D6).** `<text data-text="note" data-placement="above|below">`; per-event uses
   the enclosing `<g data-hand>`, standalone adds `data-staff`. Plain text (size `NOTE_SIZE`, no
   style/weight, `text-anchor:middle`) matching old chord symbols. `text.length>0` guard in BOTH
   `collectEventTexts` and `collectStandaloneNotes`.

**New constants:** `NOTE_SIZE` (rename of `CHORD_SYMBOL_SIZE`, 2.8), `NOTE_GAP_STAFF` (~0.6–1.0),
`MID_GAP` (~1.0–1.2), `DYNAMICS_LANE_RESERVE` (~4.5), `NOTE_CLAMP_INSET` (~1.0); reuse `TEXT_LANE_GAP` as
the per-note stack gap. **No `validate.js` change. One pipeline reorder** (occupancy → gap → `lhTopY`).

## Q&A log

### D1 — JSON-schema additions for `notes` (two `$defs`, attachment points, `beat` bound)

**Decision.** Add two `$defs` and two `notes` array properties; the `beat` lower bound is declarative
(`minimum: 0`), NOT a walker special case.

- **`eventNote` `$def`** —
  `{ type:"object", required:["text","placement"], properties:{ text:{type:"string"}, placement:{enum:["above","below"]} } }`.
- **`standaloneNote` `$def`** —
  `{ type:"object", required:["text","placement","staff"], properties:{ text:{type:"string"}, placement:{enum:["above","below"]}, staff:{enum:["rightHand","leftHand"]}, beat:{type:"number", minimum:0} } }`.
- **`event` (`schema.js:127-154`)** — replace the `chordSymbol: {type:"string"}` line (145) with
  `notes: { type:"array", items:{ $ref:"#/$defs/eventNote" } }`. `additionalProperties` stays permissive →
  a stray `staff`/`beat` on a per-event note is silently ignored, no extra code (confirmed). The lone
  `if`/`then` on `event` is untouched.
- **`measure` (`schema.js:72-84`)** — add `notes: { type:"array", items:{ $ref:"#/$defs/standaloneNote" } }`.
  Confirmed: no existing `notes`/annotation key anywhere in the schema, so no collision.
- **`beat` bound — KEY SIMPLIFICATION (researcher).** The subset already supports `minimum` on numbers
  (`validate.js:140` checks `value < resolved.minimum`; `matchesType` accepts finite numbers). `beat`
  needs `>= 0` (INCLUSIVE), which is exactly `minimum: 0`. This differs from `tempo.bpm`, which needs
  `> 0` (STRICT/exclusive — NOT expressible with `minimum`, hence its walker `checkBpm`). So **`beat` uses
  declarative `minimum: 0`** — no new `applySpecialCases` branch, no `checkBeat`. This is simpler than
  spec-research's "walker-delegated" assumption AND keeps the bound in the schema-as-data source of truth.
  (spec-research R3's "walker-delegated, parallel to bpm>0" is superseded here on this purely-mechanical
  point; the observable behavior — `beat:-1` errors, `beat:0/0.5/99` valid — is identical, so no spec AC
  changes.)
- **Per-element error paths** already work: `validateArray` (`validate.js:166`) recurses each item as
  `…notes[i]`, and `validateObject` builds `…notes[i].placement` etc. — no new machinery for the
  `sections[0].measures[0].notes[1].placement` AC.
- **`text` requiredness** — use `required:["text"]` (presence). `text:""` stays valid; the "empty renders
  nothing" behavior is purely a render-side `length > 0` guard, not a validation concern.
- **Enums inline, no shared constant.** `staff` values `rightHand`/`leftHand` ARE the existing hand keys
  (used as `handConfig` keys / `HANDS` in layout / `data-hand` in svg), but the schema is deliberately a
  standalone "publishable verbatim" data document with all enums inline (clefs, barlines, dynamics, beat
  units all inline). `placement` (`above|below`) is new. Keep both enums inline in `schema.js` to match
  that style; the renderer maps the same literals to `data-hand`/`data-placement` independently. No new
  shared enum module.

**Anchors:** `schema.js:72-84,127-154,145`; `validate.js:140,166,180,263-271,319`.

**Researcher-verified gotchas (fold into plan/code):**
- The lone `if`/`then` (`schema.js:151-153`) is a SIBLING of `event.properties`; adding `notes` to
  `properties` leaves it intact. Do NOT delete the `biome-ignore` comment on line 152.
- `validate.js` needs **ZERO changes** for this feature — `required`/`enum`/`type`/`minimum` cover it all.
  Net schema delta: +2 `$defs` (`eventNote`, `standaloneNote`), +2 `notes` array properties, −1 line
  (`chordSymbol`).
- Not a collision: `layoutHand` returns a renderer-internal local `{ notes, rests, beams, texts }`
  (`layout.js:1538`) — that `notes` is laid-out NOTEHEADS, unrelated to the song-format `notes` key. Keep
  the two meanings distinct when naming the new collection (see D7).
- Empirically proven by researcher: generic `minimum` fires on a `$ref`'d array item with an
  element-pointed path (mirrors `pitch.octave` `minimum:0` → `…pitches[0].octave: -1 is below the
  minimum of 0`); `type:"number"` accepts fractions (0.25/0.5). Also proven: `applySpecialCases`
  dispatch DOES reach `$ref`'d array items (via `checkStep` on `pitches[1]`) — available if ever needed,
  but not needed for `beat`.

### D2 — `chordSymbol` removal map + renames + two preserved behaviors

**Decision.** Clean break. Remove every `chordSymbol` token (identifier AND prose) across the 13 in-scope
files; rename the size constant; restructure the lane field (deferred to D3); the emit text kind becomes
`data-text="note"`. Validator unchanged.

**(a) Authoritative removal inventory (current ground truth, researcher-verified; in-scope = `src/`,
`specs/`, `docs/`, `README.md`).** The "no token *anywhere*" bar includes prose comments/JSDoc, not just
identifiers. 13 files:

- **`src/song/schema.js`** — `:145` (DELETE; replace with the `notes` event property, D1).
- **`src/notation/layout.js`** — `:33` (import `CHORD_SYMBOL_SIZE`), `:1392` comment, `:1542-1543` JSDoc,
  `:1546` JSDoc `@param`, `:1554-1555` (the read + `out.push({kind:"chordSymbol"…})`), `:1565` JSDoc,
  `:1677` comment, `:1700` (`chordSymbolY` band field), `:2238` comment, `:2239,2242`
  (`systemHasChordSymbols` + read), `:2249` JSDoc, `:2257` JSDoc return, `:2277` call, `:2279`
  (`CHORD_SYMBOL_SIZE`), `:2296` (`chordSymbolY: at(chordD)`).
- **`src/notation/svg.js`** — `:8` header comment, `:32` import, `:477` comment, `:480,482,484,486`
  (`chordDyR/chordDyL`), `:512` JSDoc, `:836,843` JSDoc, `:861` comment, `:867` (`CHORD_SYMBOL_SIZE`),
  `:869` (`data-text="chord-symbol"`).
- **`src/notation/constants.js`** — `:157` JSDoc, `:158` (`CHORD_SYMBOL_SIZE`).
- **`src/render.php`** — `:13` comment (names `chordSymbol` as the breakout example → reword to `notes`).
- **`docs/song-format.md`** — `:167` event-shape line, `:178` bullet, `:183` example, `:272` prose,
  `:298` example. (Plus the new `notes` docs + the one migration line — see D-docs scope, handled later.)
- **`README.md`** — `:162` (script-breakout paragraph names `chordSymbol` → reword to `notes`/`metadata.title`).
- **Tests:** `src/song/__tests__/validate.test.js:24,53`;
  `src/notation/__tests__/layout.test.js:844,1305,1314,1487,1488,1500,1530`;
  `src/notation/__tests__/svg.test.js:29,119,134`;
  `specs/render.spec.js:48,73,215,230,341,343,478`; `specs/editor.spec.js:51,54,66`.

(The `.rp/` pipeline artifacts also say `chordSymbol` but are out of scope for the acceptance bar.)

**(b) Rename decisions.**
- `CHORD_SYMBOL_SIZE` → **`NOTE_SIZE`** (the free-author-text size; reword JSDoc to "Note-annotation text
  size (free author text)").
- `collectEventTexts` **keeps its name** (it already collects dynamics). The single `chordSymbol` push
  becomes a **loop over `event.notes`** pushing one `{ kind:"note", x, text, placement }` per element —
  `placement` now travels ON the primitive (it didn't before, because chord was always above), so the emit
  can pick the band. Keep a per-element `text.length > 0` guard (port of `layout.js:1554`) so `text:""`
  renders nothing.
- `systemHasChordSymbols` does **NOT survive as-is** — today it scans `rightHand` only for `chordSymbol`.
  Band-presence is now per-band and must scan BOTH hands' `event.notes` AND `measure.notes`. It becomes a
  small family of band-presence predicates (or one parameterized helper) — **structure finalized in D3**.
- `chordSymbolY` (band field + `topMarginLayout` local) is **NOT a 1:1 rename** — it's the single above-RH
  note-lane anchor today; the feature needs up to four positions (three with no lane today). It is
  **superseded by the D3 lane model**, becoming one cell of it.

**(c) Emit text-kind value → `data-text="note"`.** DECISION: use `"note"` (mirrors the schema field
`notes`, keeps emit/schema vocabulary aligned). Collision-free, researcher-verified:
- `"note"` is an existing `data-kind` VALUE (notehead groups, `svg.js:547`) but NOT a `data-text` value,
  so no within-attribute value collision.
- EVERY selector in `src/`+`specs/` is attribute-qualified (`[data-text="…"]`, `[data-kind="note"]`);
  grep found ZERO bare-value selectors (`[note]`, `*="note"`, `~=`). So `[data-text="note"]` can never
  match a `[data-kind="note"]` node — different attributes. (I independently confirmed: `data-staff-lines`
  exists as `[data-staff-lines]`, so a future `[data-staff]` on a note node is also collision-free — see
  D6.) The only cost is mild human grep-ambiguity; accepted for vocabulary alignment.

**(d) Two MUST-preserve behaviors — both transfer 1:1, ZERO new safety code.**
1. **Above-RH free text still renders.** Old path (`collectEventTexts` push → `measure.right.texts` →
   `renderHand` loop → `renderHandText` → `<text>`) is exactly reproduced by `notes:[{text:"C",
   placement:"above"}]` on an RH event landing in the above-RH band. Locking tests RETARGET (not delete):
   `layout.test.js:1314` (`t.kind==="chordSymbol"&&t.text==="C"` → `t.kind==="note"&&t.text==="C"&&
   t.placement==="above"`); lane-stacking `1487-1488,1530` (rename `chordSymbolY` → the D3 above-RH anchor).
2. **XSS-inertness.** Both mechanisms are field-AGNOSTIC: `svg.js:setText` (98) sets `textContent` only and
   `renderHandText` routes ALL text through it; `render.php` (39) escapes every `<` in the WHOLE song string
   before the `<script>` carrier. So `notes[].text` is inert with zero new code. Hostile-literal tests just
   RETARGET the field: `svg.test.js:119`, `render.spec.js:230`, `editor.spec.js:66` → a `notes` entry with
   the same hostile text; same assertions (no executable/markup node, literal text present). The comments
   naming `chordSymbol` as the breakout example (`render.php:13`, `svg.js:8`, `README.md:162`) get reworded.

### D3 — the four placement bands → Y anchors; the inter-staff shared band; lane structure

**Decision.** Four bands. above-RH reuses `topMarginLayout` (rename in place). The inter-staff gap holds
TWO sub-bands (below-RH grows down from RH bottom; above-LH grows up from LH top) and **must FLEX** beyond
the base 8sp when occupied. below-LH is a new lane that **flexes the bottom margin**. Notes get their own
lane offsets clear of the fixed dynamics row; NO cross-kind (note-vs-dynamic/ottava) collision solver.
Geometry verified against text metrics and the actual band cascade. (Final flex policy + dynamics-dodge
nailed in D3-followup below.)

**Y model recap** (`layout.js:1684-1686`, Y grows DOWN): gap = `rightStaffBottomY .. leftStaffTopY` =
`INTRA_STAFF_GAP` (base 8, a hard constant; nothing widens it today). `systemHeight = lhBottomY +
bottomMargin`; `bottomMargin = SYSTEM_BOTTOM_MARGIN(5) + ledgerBottomExtent` (`:1682`). Growing `lhTopY`
(via a bigger gap) or `bottomMargin` cascades into `systemHeight` cleanly — nothing else consumes either.

**(a) above-RH — clean rename-in-place in `topMarginLayout`.** The old chord lane IS the above-RH note
lane: rename `chordSymbolY` → `noteAboveRightLaneY` (working name), `CHORD_SYMBOL_SIZE` → `NOTE_SIZE` in
the `topExtent` math (`:2279`). Flex-collapse still works once the presence predicate broadens from
"RH event has chordSymbol" to "system has any ABOVE-RH note" = any RH `event.notes` element with
`placement==="above"` OR any `measure.notes` element with `staff==="rightHand" && placement==="above"`.
Position (nearest staff, below ottava/tempo) unchanged. No new vertical machinery for this band.

**(b) inter-staff gap — TWO sub-bands, gap MUST FLEX.** below-RH hugs RH bottom (grows down); above-LH
hugs LH top (grows up). Text metrics used: `NOTE_SIZE=2.8`; ascent ≈ 0.72·size ≈ 2.02sp, descent ≈
0.22·size ≈ 0.62sp; per-stack step = `NOTE_SIZE + TEXT_LANE_GAP(0.6)` = 3.4sp. Sub-band height for n
notes ≈ `NOTE_GAP + (n−1)·3.4 + 2.64`. Occupancy vs the base-8 gap:
- 0+0 → collapses to base 8. 1+0 or 0+1 → ~3.6 → fits 8.
- **1+1 → ~8.46 → EXCEEDS 8 by ~0.5** (the common below-RH-context + above-LH-`ped.` case).
- 2+1 → ~11.9; 2+2 → ~15.3 → all need a bigger gap.
So `effectiveInterStaffGap = max(INTRA_STAFF_GAP, belowRH_stack + aboveLH_stack + MID_GAP_if_both)` and
`lhTopY = rhBottomY + effectiveInterStaffGap`. **CRITICAL ORDERING CHANGE:** today `lhTopY` is fixed at
`:1684` BEFORE any text is collected; the band assembly must instead scan inter-staff occupancy FIRST,
then set `lhTopY`. This is the single biggest structural change.
- DYNAMICS-IN-GAP wrinkle: RH dynamics already render at `rightStaffBottomY + 3.5` (`svg.js:851`) — INSIDE
  the gap (glyph box ~[1.48, 4.12]). A below-RH note hugging the staff (~baseline 3.0) would overlap it →
  below-RH notes should sit clear of the dynamics row, which pushes the gap requirement higher (see D3-fu).

**(c) below-LH — new lane, FLEXES the bottom margin.** Symmetric to above-RH but below `leftStaffBottomY`,
growing down into the bottom margin. The bottom margin today holds ONLY: low LH ledgers
(`ledgerBottomExtent`), LH dynamics (`leftStaffBottomY + 3.5`), below-LH ottava (`+2`) — all fixed rows
that fit the 5sp base. One below-LH note (~3.6sp) fits the base; TWO (~7.0sp) exceed it. So
`bottomMargin = max(SYSTEM_BOTTOM_MARGIN + ledgerBottomExtent, belowLH_stack + ledgerBottomExtent +
dynamics-row-reservation)`; `systemHeight` cascades (`:1686`). YES this requires growing `systemHeight`
when below-LH notes stack.

**(d) interaction with dynamics + below-ottava — notes get their own offset; NO cross-kind solver.**
Spec AC only requires "N same-placement NOTES at N distinct Ys, none overlapping" (`spec.md:116`) — silent
on notes-vs-dynamics/ottava. The format already tolerates fixed-row coexistence (dynamics `y:3.5` and
below-ottava `+2` can overlap each other today; nobody arbitrates). So: reserve the note lanes clear of
the dynamics row (notes dodge BELOW it, since dynamics hug the staff), and do NOT build a general
collision solver. This dodge raises the gap/bottom-margin requirement, reinforcing the flex in (b)/(c).

**D3 structural deliverables (dependency order, in `buildLayoutModel`'s per-system block ~1675-1701):**
1. Scan BOTH `event.notes` (both hands) AND `measure.notes` → per-band presence + per-band stack counts
   (4 bands: above-RH, below-RH, above-LH, below-LH).
2. above-RH: reuse `topMarginLayout` (rename + broadened predicate); no new vertical machinery.
3. inter-staff gap: `effectiveInterStaffGap` flex; REORDER so occupancy is computed before `lhTopY`.
4. below-LH: flex `bottomMargin`; `systemHeight` cascades.
5. Emit (D6/D7): notes carry `placement`+`staff`; the band anchor is picked from the band model; X from
   event (per-event) or `beat` onset (standalone, D4). `data-text="note"` + placement/staff discriminators.

**Likely new constants:** `NOTE_GAP_STAFF` (staff-line→note clearance ~0.6–1.0), `MID_GAP` (inter-staff
sub-band clearance ~1.0–1.2), `DYNAMICS_LANE_RESERVE` (~4.5sp — the dynamics box; a tunable constant, not
a hard derivation); reuse `TEXT_LANE_GAP(0.6)` for the per-note stack step and `NOTE_SIZE(2.8)`.

### D3-followup — LOCKED: PAIR A (always-flex gap + always-dodge), verified safe

**Decision (LOCKED).** PAIR A. The inter-staff gap is ALWAYS a flex value that COLLAPSES to the base 8 when
no inter-staff notes are present, and below-RH/below-LH notes dodge below their hand's dynamics row only
when that hand has dynamics in the system. The bottom margin flexes the same way for below-LH. Everything
downstream cascades from the band anchors. Formula:

```
effectiveInterStaffGap = max(
  INTRA_STAFF_GAP,                       // base 8 — collapse target when empty
  belowRH_stackHeight + aboveLH_stackHeight + (both_present ? MID_GAP : 0)
)
lhTopY = rhBottomY + effectiveInterStaffGap   // computed AFTER the occupancy scan (reorder)

belowRH note #k baseline = rightStaffBottomY + (RH_has_dynamics ? DYNAMICS_LANE_RESERVE : NOTE_GAP_STAFF) + k·(NOTE_SIZE + TEXT_LANE_GAP)
aboveLH note #k baseline = leftStaffTopY     − NOTE_GAP_STAFF − k·(NOTE_SIZE + TEXT_LANE_GAP)        // grows up
belowLH note #k baseline = leftStaffBottomY  + (LH_has_dynamics ? DYNAMICS_LANE_RESERVE : NOTE_GAP_STAFF) + k·(NOTE_SIZE + TEXT_LANE_GAP)
aboveRH note #k baseline = the topMarginLayout lane (rename of chordSymbolY), stacked like the existing lanes
bottomMargin = max(SYSTEM_BOTTOM_MARGIN + ledgerBottomExtent, belowLH_stackHeight + ledgerBottomExtent)
```

**Why PAIR A (vs PAIR B "tighten + no-dodge"):** the two decisions are COUPLED — once below-RH notes dodge
below the RH dynamics row (which sits at `rightStaffBottomY + 3.5`, INSIDE the gap), the common 1-below-RH
+ 1-above-LH case no longer fits the base 8, so "tighten so 1+1 fits 8" is not achievable with dodging.
PAIR A is the only robust option AND it reuses the exact `topMargin` flex pattern the codebase already
trusts (idiomatic, not novel machinery); base-8 spacing is preserved for any system WITHOUT inter-staff
notes (flex collapses); only systems that genuinely carry inter-staff annotations grow taller — correct,
not churn.

**Verified safe (researcher grep + my independent grep):**
- **No exact-value test breaks.** EVERY band/height assertion in `layout.test.js`/`svg.test.js`/`specs/` is
  RELATIVE or existence-only: ordering (`1243-1247`: incl. `leftStaffTopY > rightStaffBottomY`, which
  always-flex preserves since flex only GROWS the gap), `toBeDefined` (`1456-1457`), lane ordering +
  per-lane `toBeCloseTo` against the model's OWN anchor (`1486-1493`), collapse `toBeNull` (`1528-1530`).
  The only `.toBe(8)/.toBe(12)` hits are `pitchToStaffStep` step indices (unrelated). ZERO assertions pin
  an absolute `lhTopY`/`leftStaffTopY`/`systemHeight`/gap value.
- **`INTRA_STAFF_GAP` has ONE consumer** — `layout.js:39` import, used only at `lhTopY = rhBottomY +
  INTRA_STAFF_GAP` (`1684`). `svg.js` imports NO gap/height constant at all → cannot hardcode the old gap.
- **Pure cascade.** Growing the gap updates ONLY `lhTopY → lhBottomY → systemHeight` (`1684-1686`).
  Everything else derives from band ANCHORS, so it follows automatically: brace height =
  `leftStaffBottomY − rightStaffTopY` (`svg.js:352`); barline span `rightStaffTopY..leftStaffBottomY`
  (`730-731`); staff lines (`302-303`); ledger Ys (`747,755`); inline clef/keysig/timesig (`778-790`);
  LH `<g>` translate to `leftStaffBottomY` (`491`); existing note-lane `chordDy` (`480-486`); span Ys via
  `staffBottomY` at `recordSpanMarkers` (`1831,1838`). Because the flex is computed BEFORE `lhTopY` is set
  (the D3 reorder), every downstream site reads the already-flexed anchors — no second patch site.
- **Dynamics presence is a cheap per-system, per-hand scan** (mirrors `systemHasChordSymbols` `2239-2244`):
  `RH_has_dynamics = members.some(m => (m.measure?.rightHand ?? []).some(e => e?.dynamic))` (and LH).
  `dynamic` is an enum read truthily at `layout.js:1551`. Per-SYSTEM (not per-column) is the idiomatic,
  spec-sufficient choice — per-column dodging is unnecessary precision the spec doesn't ask for.

**Net:** lock PAIR A. The above-RH lane stays the `topMarginLayout` rename; the gap and bottom margin both
flex from occupancy; below-RH/below-LH dodge their hand's dynamics row when present; all geometry cascades
from the band anchors with one reorder (occupancy → gap → `lhTopY`).

### D4 — standalone `beat` → X mapping, no-`beat` left edge, over-content clamp, pipeline placement

**Decision (simulation-validated by researcher on a real 4/4 grid).**

**(a) In-range beat → INTERPOLATE (not snap).** SNAP fails the spec (two distinct beats collapse to one X;
monotonicity not robust). Interpolant — reuse the already-SCALED `columnX` map:
```
x(beat) = lerp( columnX(t_i), nextX, (beat − t_i) / (t_next − t_i) )
  where [t_i, t_next] bracket `beat` in the sorted grid;
  for the last column, t_next = measureEnd and nextX = content right edge (= columnX(t_last) + lastAdvance·scale);
  guard (t_next − t_i) with `|| 1` against a zero-width span (unionGrid dedups, so defensive only).
```
Interpolating against the SCALED advances (or directly between scaled `columnX` values) makes the beat X
track the justified grid exactly like events (`cx += col.advance * advanceScale`, `:1776`). NO existing
interpolation helper — this is ~10 lines of new code; the closest pattern (`columnX` build `:1772-1777`)
only places exact onsets. Simulated monotonic result: beat 0→2.0, 0.5→4.6, 1→7.2, 2→12.4, 3→17.6, 4→22.8.

**(b) no-`beat` ≡ `beat:0` ≡ `leadInset`** (the measure's content-left edge, where columns start —
`let cx = leadInset`). Exact equality (spec allows "at or near"); simplest. Reliably left of a `beat:2`
note. Empty measure: `leadInset` still defined → renders at measure left.

**(c) Over-content clamp — EXACT TARGET (the spec's explicit design hand-off).**
`min( beatToX(min(beat, measureEnd)), measureRightX − NOTE_CLAMP_INSET )`, `NOTE_CLAMP_INSET ≈ 1.0sp`.
- **Why the inset:** researcher verified `measureEnd`'s onset-X coincides EXACTLY with the trailing barline
  X (`measureRightX = x + scaledContent`, `:1804`; both 20.8 in sim). Clamping to `measureEnd` alone puts
  a `text-anchor:middle` glyph straddling the bar (collides with the next measure). Backing off by ~1.0sp
  keeps the node strictly inside the measure's content, left of the barline, monotonic, and inside
  `staffEndX` (the bar is already inside `staffEndX`). New small constant `NOTE_CLAMP_INSET` (could reuse
  `BARLINE_POST_PAD(0.7)`-ish; ~1.0sp recommended).
- Acceptable simpler alternative (no new constant): clamp to the LAST COLUMN's X — unambiguously inside
  content, but lands on the last event rather than the true right edge. Chosen target is the `measureEnd −
  inset` form (truer to "furthest right, still in bounds").

**(d) Pipeline placement — SEPARATE `measureModel.standaloneNotes` collection.** Resolve standalone X at
the measure-walk site (`:1753-1851`), where `columnX` (`:1772`), `ml.columns`, `ml.measureEnd`,
`leadInset` (`:1760`), `measureRightX` (`:1804`), `advanceScale` are ALL in scope:
```
collectStandaloneNotes(m.measure?.notes,
  { columnX, columns: ml.columns, measureEnd: ml.measureEnd, leadInset, measureRightX, advanceScale })
  → [{ kind:"note", x, text, placement, staff }] per element (apply the text.length>0 guard here too).
```
NOT folded into `measure.right/.left.texts`, because: standalone X is beat-derived (interpolated) vs event
X is column-derived; standalone carries its OWN staff explicitly (folding would force pre-bucketing and
the emit couldn't distinguish standalone `data-staff` from per-event `data-hand`); and it attaches at the
MEASURE level (parallel to `barlines`/`inline`), matching the data model (`measure.notes`). Per-event notes
STAY on the per-hand path (`collectEventTexts` → `measure.right/.left.texts` → `renderHand`), now carrying
`placement`.

**Observability (pre-settles D6), per researcher's recap:**
- per-event note: `<g data-measure>` → `<g data-hand="rightHand|leftHand">` → `<text data-text="note"
  data-placement="above|below">`. Staff = enclosing `data-hand` (a redundant `data-staff` is harmless but
  unnecessary).
- standalone note: `<g data-measure>` → `<text data-text="note" data-staff="rightHand|leftHand"
  data-placement="above|below">`. Staff = `data-staff` (no enclosing hand `<g>`).
- This makes below-RH vs above-LH distinguishable (same band, different `data-staff`/`data-hand`) per
  `spec.md:115`. `[data-staff]` does not collide with the existing `[data-staff-lines]` (distinct
  attribute names).

### D5 — same-placement stacking (order + gap + grouping), lane precedence, both-above-and-below

**Decision (all confirmed).**

**(a) Stacking ORDER — uniform rule "array order = increasing distance from the note's OWN staff," all four
bands.** note[0] hugs its staff; note[k] stacks outward.
- above-RH (grows up): note[0] nearest RH top, note[k] higher (matches the existing chord→ottava→tempo
  outward stack).
- below-RH (grows down into gap): note[0] nearest RH bottom, note[k] lower.
- above-LH (grows up into gap): note[0] nearest LH top, note[k] higher (toward RH).
- below-LH (grows down): note[0] nearest LH bottom, note[k] lower.
Source arrays: per-event = `event.notes` order filtered to that placement; standalone = `measure.notes`
order filtered to (staff, placement, anchor).
**GAP — ONE step for ALL four bands:** baseline-to-baseline = `NOTE_SIZE(2.8) + TEXT_LANE_GAP(0.6)` = 3.4sp.
Reuse `TEXT_LANE_GAP` (its JSDoc `constants.js:96-97` is already "gap between two stacked text lanes" —
semantically exact). One step constant everywhere, not per-band.

**(b) Anchor grouping — stacking is per (band, anchor); k resets per distinct anchor within a band.**
- Per-event: the EVENT is the group — group key `(event, placement)`; k = index within `event.notes`
  filtered to placement. Notes on different events are different groups (even at coincidentally-equal X).
- Standalone: **group by the RAW `beat` (pre-interpolation), not the resolved X** — group key
  `(staff, placement, beat ?? "noBeat")`. Two `beat:2` notes → same group → stack (k=0,1); `beat:2` and
  `beat:2.0001` → different groups (distinct interpolated X) → each k=0. Grouping by raw beat (not
  epsilon-rounded X) is cleanest/cheapest and matches the spec's natural "same anchor = same beat". O(n)
  per measure via a `Map` keyed by the group key.
- The HARD AC (`spec.md:116`) is only "N SAME-anchor same-placement notes → N distinct Ys"; different-anchor
  notes already separate horizontally. The raw-beat grouping satisfies it directly.

**(c) Above-staff lane PRECEDENCE — note lane keeps the chord lane's slot (innermost, nearest staff, below
ottava/tempo); its height becomes stack-dependent.**
- The note lane occupies the first slot in `topMarginLayout` (`:2272-2291`): note → ottava → tempo,
  outward. Notes sit between the RH staff top and ottava/tempo, exactly as chord symbols did.
- **The single-lane-height line `topExtent = d + CHORD_SYMBOL_SIZE` (`:2279`) becomes stack-dependent:**
  ```
  noteLaneHeight = NOTE_SIZE + (N_aboveRH − 1) * STACK_STEP    // STACK_STEP = NOTE_SIZE + TEXT_LANE_GAP
  topExtent = d + noteLaneHeight ; d = topExtent + TEXT_LANE_GAP   // ottava/tempo stack from the new d
  ```
  `N_aboveRH` = the **system-wide MAX** above-RH stack at any single anchor (the lane reserves one shared
  vertical band across the system, like today's single system-local chord Y). Note baselines within the
  lane: `noteAboveRightLaneY`, `+ STACK_STEP`, … `+ (N−1)·STACK_STEP` (growing up via `at(dist)`).
- The SAME "system-max stack" input feeds the inter-staff flex and bottom-margin flex (D3/D3fu): per-side
  MAX stack count drives the reserved height.

**(d) above-LH × inter-staff flex — ORDER does NOT change the flex arithmetic.** The flex reserves total
per-side stack HEIGHT (belowRH + aboveLH + reservations + MID_GAP); order only assigns which note sits at
which k within that already-reserved height. Flex math untouched by (a). The only flex input is per-side
MAX stack count (same as (c)).

**Both-above-and-below routing — NO special handling.** An event with both an above and a below note is
just two `event.notes` entries with different `placement`. `collectEventTexts` loops `event.notes` and
pushes each `{kind:"note", x, text, placement}`; the above one routes to above-RH (RH event) / above-LH
(LH event), the below one to below-RH / below-LH — each via the per-note placement→band selection in the
emit. Both share the event's X; they land in independent bands with no coordination. Directly satisfies the
headline chord-above + pedal-below AC (`spec.md:114`).

### D6 — observable discriminator attributes + text styling + guards (closing items)

**Decision.**
- **Discriminator attributes** (settled across D2(c)/D4): emitted text node is `<text data-text="note">`.
  - per-event: enclosed in `<g data-hand="rightHand|leftHand">`, plus `data-placement="above|below"` on the
    text. Staff = enclosing `data-hand`.
  - standalone: `<text data-text="note" data-staff="rightHand|leftHand" data-placement="above|below">`,
    NOT inside a hand `<g>`. Staff = `data-staff`.
  - Makes below-RH vs above-LH distinguishable (same band, different `data-staff`/`data-hand`) per
    `spec.md:115`. `[data-staff]` ≠ `[data-staff-lines]` (distinct attribute names — verified) and
    `[data-text="note"]` ≠ `[data-kind="note"]` (distinct attributes — verified). No selector collision.
- **Text STYLING** — plain text matching the OLD chord symbols: `font-size: NOTE_SIZE`, default family, NO
  `font-style`/`font-weight` (unlike dynamics' bold-italic, unlike ottava's italic). `text-anchor:middle`
  (centered on the anchor X, as chord symbols were). The new `renderHandText` note branch / standalone
  emit reuse the chord branch's exact attribute set, swapping the `data-text` value and adding
  `data-placement` (+ `data-staff` for standalone).
- **Empty-text guard** — `text.length > 0` (the port of `layout.js:1554`) lives in BOTH `collectEventTexts`
  (per-event) AND `collectStandaloneNotes` (standalone), so `text:""` renders nothing in either mode.

### Design hand-off coverage check (vs `spec.md:58-64` + spec-research open items)

- ✓ vertical offsets / lane-gap sizes → D3 (`NOTE_GAP_STAFF`, `TEXT_LANE_GAP` step, `DYNAMICS_LANE_RESERVE`,
  `MID_GAP`) + D5 step.
- ✓ font size/family/weight → D6 (`NOTE_SIZE=2.8`, plain text, no style/weight).
- ✓ collision-avoidance precision → D5(a)(b) (distinct Ys per same-anchor stack; no general solver).
- ✓ over-content clamp X → D4(c).
- ✓ below-RH vs above-LH: one lane or two → D3(b) (TWO sub-bands, opposite edges).
- ✓ vertical ordering vs tempo/ottava → D5(c) (note lane innermost, precedence unchanged).
- ✓ new below-staff / inter-staff lane machinery → D3 (flex gap + flex bottom margin) + D3fu (PAIR A).
- ✓ placement-discriminator attribute name(s) → D6 (`data-placement` + `data-staff`/`data-hand`,
  `data-text="note"`).

**Design Q&A complete — every spec hand-off resolved with concrete code anchors + arithmetic.**