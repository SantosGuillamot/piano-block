# Spec research — Move annotations above the tempo marking (issue #20)

## Owner intent (from phase-0 prompt)

The vertical stack of markings rendered with the sheet music should read, top to bottom: **annotations → tempo → octaveShift**. Today annotations sit *below* the tempo; move them *above* it. Constraints: apply to **both hands**; **do not change horizontal spacing/layout** — vertical reorder only.

## Codebase orientation (pre-Q&A, by spec-analyst)

The above-staff text stacking lives in `src/notation/layout.js`, function `topMarginLayout` (~lines 2865-2910). Above the top (right-hand/treble) staff, three lanes stack from innermost (nearest staff) to outermost (top of system):

1. `annotationAboveRHLaneY` — above-right-hand annotation lane (note/text annotations), nearest the staff.
2. `ottavaAboveLaneY` — the octaveShift "ottava" bracket lane (positive shift = 8va/15ma above).
3. `tempoLaneY` — the tempo mark ("♩ = 120"), at the very top.

So current top-to-bottom visual order is **tempo → ottava(octaveShift) → annotations**. The prompt's desired order is **annotations → tempo → octaveShift(ottava)**.

Key nuances discovered:
- "annotations" in this codebase = free text (`annotations` arrays) attached per-event or per-measure, with `placement: above|below` and a `staff`. They render in **four bands** around the two staves (aboveRH, belowRH, aboveLH, belowLH). Only the **aboveRH** band sits above the top staff in the same column as the tempo/ottava stack. Annotations are **horizontally anchored to note columns** (multi-line per-anchor stacks), not a single free-floating system lane.
- The tempo and ottava are **system-level** texts emitted by `buildSystemTexts` (~line 2912+) at lane baselines `tempoLaneY` / `ottavaAboveLaneY`.
- The annotation band reserves the FULL stack height (every same-anchor note), so reordering must keep that reservation correct.

### Existing test that codifies current order

`src/notation/__tests__/layout.test.js` ~line 2059, test "tempo, ottava, and note lanes stack above the staff" asserts (smaller Y = higher):
- `tempoLaneY < ottavaAboveLaneY < annotationAboveRHLaneY < rightStaffTopY`

i.e. current top-to-bottom = tempo, ottava, annotations. The target reorder (annotations, tempo, ottava) means this test's first two assertions must flip — this is effectively the acceptance criterion.

Audit of OTHER tests referencing these lanes (do they need to change?):
- layout.test.js:2603-2612 ties `bands.aboveRH.baseY` to `annotationAboveRHLaneY` and asserts the stack grows up. This stays TRUE structurally after the reorder (the annotation band's baseY just moves outward); no change needed beyond the value shift.
- layout.test.js:3776-3787 asserts RH-above ottava (`ottavaAboveLaneY`) sits above LH-above ottava (`ottavaLeftAboveLaneY`, in the inter-staff gap), non-overlapping. This relationship is independent of the tempo/annotation/RH-ottava ordering in the top margin — UNAFFECTED.
- layout.test.js:2113-2114, 3694-3695, 3741 assert null lanes when absent — UNAFFECTED (presence logic unchanged).

Net: the single order-asserting test that MUST change is the 2059 block (its tempo<ottava and ottava<annotation assertions). This is the cleanest acceptance signal.

Relevant constants (`src/notation/constants.js`): `TEMPO_SIZE=2.8`, `OTTAVA_SIZE=2.2`, `NOTE_SIZE=2.8`, `TEXT_LANE_GAP=0.6`, `ABOVE_STAFF_PAD=1`, `SYSTEM_TOP_MARGIN=5`, `MEASURE_NUMBER_SIZE=2.2`.

### Renderer does not hardcode ordering

`src/notation/svg.js` consumes the computed lane Ys (`system.texts` tempos/ottavas carry their own `y`; bands carry `baseY`). It renders purely by those Y values and never hardcodes a vertical order. So the entire above-staff ordering is decided in `layout.js` `topMarginLayout` — the reorder is localized to the layout layer.

### e2e specs do not assert tempo-vs-annotation order

`specs/render.spec.js` asserts annotation/tempo/octaveShift PRESENCE and content, horizontal positioning (beat order, clamp), and one above-vs-below vertical check (line 803, an above note higher than a below note). It has no test comparing the tempo's Y to an annotation's Y, so the e2e suite likely needs NO change for this reorder. The canonical order assertion lives in the unit test layout.test.js:2059.

## Open questions to resolve with spec-researcher

(tracked below as they are asked/answered)

**Q1 (asked):** Does the reorder scope only the above-right-hand annotation band (the only annotations sitting between the top staff and the tempo), or also the other three bands (belowRH/aboveLH/belowLH)?

**Q1 (answered):** The reorder concerns ONLY the top-margin above-staff stack, which has exactly three occupants:
- above-RH note-annotation lane (`annotationAboveRHLaneY`, feeds `bands.aboveRH`, a multi-line stack growing UP) — layout.js:1943-1947
- RH-above ottava lane (`ottavaAboveLaneY`) — present only when a POSITIVE RH octaveShift exists
- tempo (`tempoLaneY`)

The other three annotation bands (belowRH, aboveLH, belowLH) are below the top staff / in the inter-staff gap / below the bottom staff and never stack against the tempo — UNAFFECTED. Horizontal spacing is fully independent and untouched.

Critical nuance: the LH "above" ottava does NOT render in the top margin — it renders in the INTER-STAFF gap (`ottavaLeftAboveLaneY`, layout.js:1933-1935). So the top-margin reorder structurally concerns the RIGHT hand's tempo/octaveShift relationship; the left hand's octaveShift-above sits between the staves. This means "apply to both hands" needs an explicit ruling (Q2).

Also confirmed: this is a STRUCTURAL reorder, not a 2-value swap. Annotations are currently reserved FIRST (innermost) and reserve their FULL multi-line stack height; moving them outermost requires the whole stack to clear the tempo+ottava beneath it.

A1 evidence (the four bands' Y anchors, layout.js:1942-1963): only `aboveRH.baseY` is sourced from `topMarginLayout` (line 1944). belowRH (1949), aboveLH (1954), belowLH (1959) are computed in separate flex blocks (inter-staff gap 1900-1906; bottom margin 1911-1915) and never appear in `topMarginLayout`. They MUST NOT be touched.

**Q2 (asked):** How to interpret "apply to both hands," given the tempo is a single system-level lane above the top staff and only the RH-above ottava shares it (the LH-above ottava is in the inter-staff gap)?

**Q2 (answered):** Reading (a) is correct and structurally the only coherent one. There is no per-hand tempo — the tempo is ONE system-level mark in the top margin above the top (RH/treble) staff. The only octaveShift marking sharing that column is the RIGHT-hand positive ("above") ottava (`ottavaAboveLaneY`). The LH-above ottava renders in the inter-staff gap (`ottavaLeftAboveLaneY`); any "below" ottava (negative shift, either hand) renders below its own staff (`staffBottomY + 2`, layout.js:3004). So the literal stack "annotations → tempo → octaveShift" physically exists ONLY above the top staff.

Interpretation adopted: "must apply to both hands" means annotations render above the tempo wherever they share the tempo's column — which in this engraving is only the above-RH band. The single tempo already sits above the whole grand staff, so "both hands" is satisfied without moving the LH (inter-staff) annotation bands. The spec must state this explicitly so the requirement is not misread as "also relocate the inter-staff LH annotation bands."

**Q3a (asked + answered):** Confirm there is genuinely NO configuration where a LEFT-hand annotation reaches the top-margin column.
- CONFIRMED end-to-end. Band routing is a pure function of (hand/staff, placement) with no reassignment anywhere: per-event note annotations route via `noteBandResolver` (svg.js:487-508; key at 489-497: leftHand → aboveLH/belowLH, rightHand → aboveRH/belowRH); standalone annotations route via `bandKeyFor` (svg.js:581-587, identical rule). A left-hand annotation structurally cannot select `aboveRH`. The researcher grepped every use site of aboveRH/aboveLH/bandKeyFor/noteBandResolver in non-test layout.js + svg.js — the staff→band mapping appears only in those two routers and is never overridden.
- Only `aboveRH` is anchored to a `topMarginLayout` output (`aboveRH.baseY = top.annotationAboveRHLaneY`, layout.js:1944). `topMarginLayout`'s only inputs are the system members, ledger-top extent, and `occ.aboveRH` (layout.js:1870, 2865). aboveLH (1954), belowRH (1949), belowLH (1959) are computed in separate blocks. So LH annotations always render in the inter-staff gap or below the bottom staff, never above the top staff. Reading (a) stands.
- Further reinforced: `topMarginLayout`'s return has NO LH field (layout.js:2904-2909). LH band Ys are derived strictly DOWNWARD: `lhTopY = rhBottomY + effectiveInterStaffGap` (≥ INTRA_STAFF_GAP = 8 > 0), so every LH band sits at Y ≥ lhTopY − NOTE_GAP_STAFF, far below `topMargin`. No LH marking can overlap the tempo column.

**Q3b/Q4a (asked + answered):** Confirm the final order and that tempo/ottava do NOT swap.
- CONFIRMED. The mechanic (layout.js:2879-2901): `d` = distance above the staff top growing outward; lanes reserve in SOURCE ORDER, each pushing `d` further out; `at(dist)=topMargin−dist`, so a larger `d` (reserved later) = smaller Y = higher on the page.
- Today's source/reservation order (innermost→outermost) = [annotations (2885), ottava (2892), tempo (2897)] → top→bottom = tempo, ottava, annotations.
- Target source/reservation order = **[ottava, tempo, annotations]** → top→bottom = **annotations → tempo → octaveShift(ottava)**, exactly the prompt's sequence.
- annotations is the ONLY element changing role (innermost → outermost). tempo stays reserved AFTER (above) the ottava in both today and target — tempo and ottava do NOT swap. The ottava simply becomes the innermost lane because annotations vacated that slot; no change to the ottava's own placement rule.
- Implementation: reorder the three reservation if-blocks in `topMarginLayout`. Nothing else changes (ottava emit, tempo emit, horizontal spacing all untouched).

**Q4b (asked + answered/verified by spec-analyst):** Subset/edge cases after the reorder. Verified by tracing the reordered if-blocks (layout.js:2879-2902):
- Each if-block is guarded by its element's presence (`aboveRHCount > 0`, `systemHasRightOttavaAbove`, `systemHasTempo`); guards are unchanged by a pure block reorder, so an ABSENT lane reserves nothing — no phantom gap/empty slot.
- Edge 1 (only one of the three present): `d` starts at `innerZone + ABOVE_STAFF_PAD` and advances only for present lanes, so the single present lane hugs the staff at that base — unchanged collapse-when-alone behavior.
- Edge 2 (annotations + tempo, no ottava): ottava block skipped; top→bottom = annotations, tempo with tempo hugging the staff. Correct.
- Edge 3 (tempo + ottava, no annotations): annotations block skipped; tempo stays above ottava — pair relationship intact (identical to today for this pair).
- Edge 4 (deep annotation stack): the annotation block runs LAST, computing `topExtent = d + (aboveRHCount−1)*stackStep + NOTE_SIZE` from the post-ottava-and-tempo `d`, so the WHOLE stack reserves above the tempo; `topMargin = max(SYSTEM_TOP_MARGIN, topExtent + ABOVE_STAFF_PAD)` still grows to fit the deepest case. The `topExtent` accounting is cumulative from the running `d`, so it stays correct under reorder with no extra care needed — the tempo cannot poke into the annotation stack because the annotation baseline sits at `d`, already one `TEXT_LANE_GAP` past the tempo's `topExtent`.

Researcher's independent A4 trace fully agreed: each present lane block does the same three steps relative to the running `d`/`topExtent`, an absent block is skipped (no advance, no empty slot), so the blocks are order-agnostic — the implementation is literally moving the `aboveRHCount` block to run after the ottava and tempo blocks. Added requirement R10: the `topMarginLayout` doc-comment (~2849-2856) currently describes the OLD order and must be rewritten to the new one.

---

## Terminology bridge

- **annotations** (prompt) = the rendered free-text `annotations` (per-event + standalone) in the **above-right-hand-staff** band only (the `aboveRH` band, anchored to `annotationAboveRHLaneY`). This is the only annotation band in the tempo's column.
- **tempo** (prompt) = the metronome mark ("♩ = 120") rendered in `tempoLaneY`, a single system-level mark above the top (treble) staff.
- **octaveShift** (prompt) = its rendered **ottava** bracket. The element that participates in this vertical stack is specifically the **right-hand positive ("above") ottava** (`ottavaAboveLaneY`). (The song-format field is `octaveShift`; the drawn bracket is the "ottava".)
- "vertical stack of markings" = the above-the-top-staff column computed in `topMarginLayout` (`src/notation/layout.js`).

---

## Requirements

### Functional

- **R1 — New vertical order.** In the above-the-top-staff column, the markings must render, top to bottom, as **annotations → tempo → octaveShift (ottava)**. Today the order is tempo → ottava → annotations; the annotation lane moves from innermost (hugging the staff) to outermost (topmost).
- **R2 — Tempo and ottava keep their relative order.** The tempo stays directly **above** the right-hand "above" ottava. The change relocates only the annotation lane; the tempo↔ottava relationship is unchanged. (After the change the ottava becomes the lane hugging the staff, solely because annotations vacated that slot.)
- **R3 — Single source of truth.** The reorder is realized entirely in `topMarginLayout` (`src/notation/layout.js`, ~2865-2910) by reordering its three lane-reservation blocks from `[annotations, ottava, tempo]` to `[ottava, tempo, annotations]`. The emit layer (`svg.js`) and the tempo/ottava emit (`buildSystemTexts`) need no change — they consume the computed lane Ys.
- **R4 — Apply to both hands (correctly scoped).** "Both hands" is satisfied by R1: the tempo is a single grand-staff-level mark above the top staff, so moving annotations above it benefits the whole grand staff. Left-hand annotations and the left-hand "above" ottava render in the inter-staff gap (and below-staff bands render below their staff); these are structurally separate from the tempo's column and require **no** relocation.
- **R5 — Subset behavior preserved.** When only some of the three are present, the present lane(s) stack with no phantom gap for an absent lane:
  - annotations only / tempo only / ottava only → the single present lane hugs the staff (collapse-when-alone, as today).
  - annotations + tempo (no ottava) → annotations above, tempo hugging the staff.
  - tempo + ottava (no annotations) → unchanged: tempo above ottava.
- **R6 — Deep annotation stacks clear the tempo.** A multi-line above-RH annotation stack (n same-anchor notes) reserves its full height as the outermost lane, so the entire stack sits above the tempo and the system top margin grows to fit the deepest stack. No annotation line overlaps the tempo or ottava.

### Non-functional / constraints

- **R7 — No horizontal change.** Horizontal spacing and layout (measure layout / advance scaling, tempo's and annotations' X positions) must not change. This is a vertical reorder only. (Horizontal geometry is independent of `topMarginLayout`.)
- **R8 — No regression in unaffected regions.** The other three annotation bands (belowRH, aboveLH, belowLH), the LH "above" ottava (inter-staff gap), and any "below" ottava (negative shift, either hand, drawn below its own staff) must be unchanged.
- **R9 — Top margin remains tight.** When nothing sits above the staff, the top margin still collapses to its base (`SYSTEM_TOP_MARGIN`), exactly as today.
- **R10 — Update the stale doc-comment.** The `topMarginLayout` doc-comment (`src/notation/layout.js` ~2849-2856) describes the OLD order ("the above-RH note lane nearest the staff, then an above-staff ottava, then the tempo at the very top"). It must be rewritten to the new order: the ottava nearest the staff, then the tempo, then the annotations at the very top.

### Out of scope (explicit)

- Moving, restyling, or reordering the belowRH / aboveLH / belowLH annotation bands.
- Any change to the LH "above" ottava (inter-staff gap) or to "below" ottavas.
- Introducing per-hand tempo marks (there is one system-level tempo by design).
- Any horizontal-spacing change, font/glyph change, or change to the song format / validation.
- Changes to dynamics, hairpins, ties/slurs, beams, measure numbers, or any non-tempo/annotation/ottava marking.

### Acceptance criteria (testable)

- **AC1.** For a system that carries an above-RH annotation, a tempo, and a right-hand positive octaveShift, the computed lanes satisfy (smaller Y = higher):
  `annotationAboveRHLaneY < tempoLaneY < ottavaAboveLaneY < rightStaffTopY`.
  (This is the inverse of the current assertion at `src/notation/__tests__/layout.test.js:2066-2068`, which must be updated from `tempoLaneY < ottavaAboveLaneY < annotationAboveRHLaneY`.)
- **AC2.** Emitted tempo texts still sit at `tempoLaneY` and emitted above ottavas still sit at `ottavaAboveLaneY` (the existing `t.y`/`o.y` close-to-lane assertions remain true; only the inter-lane ordering changes).
- **AC3.** `bands.aboveRH.baseY` still equals `annotationAboveRHLaneY` and the above-RH stack still grows upward (existing assertion at layout.test.js:2603-2612 stays green, just with shifted Y values).
- **AC4.** Subset cases (R5): with only annotations + tempo, `annotationAboveRHLaneY < tempoLaneY` and the tempo hugs the staff (its `d` = `innerZone + ABOVE_STAFF_PAD`); with only tempo + ottava, `tempoLaneY < ottavaAboveLaneY` (unchanged).
- **AC5.** Deep stack (R6): with n ≥ 2 same-anchor above-RH annotations plus a tempo, the lowest annotation baseline is strictly above `tempoLaneY` (the whole stack clears the tempo), and `topMargin` grows accordingly.
- **AC6.** Unaffected lanes (R8): `ottavaLeftAboveLaneY` (LH-above, inter-staff gap) and the belowRH/aboveLH/belowLH band base Ys are unchanged for the same input. The existing RH-above-vs-LH-above ottava test (layout.test.js:3776-3787) stays green.
- **AC7.** Constraint (R7): horizontal positions (measure Xs, tempo X = measure left edge, annotation Xs) are unchanged for the same input.
- **AC8.** Existing test suite passes after updating the single order-asserting test (layout.test.js:2059 block) to the new order; no other unit or e2e test needs to change (e2e `specs/render.spec.js` asserts presence/content/horizontal/above-vs-below only, not tempo-vs-annotation order).

### Files in play (for later phases)

- Change: `src/notation/layout.js` — `topMarginLayout` (~2865-2910), reorder the three reservation if-blocks; also update its doc-comment (~2849-2856) which describes the old order (R10).
- Update test: `src/notation/__tests__/layout.test.js` — the "tempo, ottava, and note lanes stack above the staff" block (~2059-2078).
- No change expected: `src/notation/svg.js`, `buildSystemTexts`, `src/notation/constants.js`, `specs/render.spec.js`, song format / validation.
