# Phase 6 — Review 1 of PR #6

**PR:** [#6 — Render the Piano block's song as sheet music (grand staff)](https://github.com/SantosGuillamot/piano-block/pull/6)
**Branch:** `worktree-4-render-sheet-music` · **Issue:** #4 · **Reviewer:** owner
**Verdict:** Approve the direction — the rendering engine works and reads as real notation. The findings below are layout/spacing polish, all in the layout + emit layers; none touch the song format, the validator, or the engine's architecture.

## What's working

The own-engine grand staff renders: braced two-hand system, clefs, key/time signatures, beamed notes, chords, ties, dynamics, tempo, ottava brackets, measure numbers — as inline SVG, font-with-fallback. The problems are that several elements are placed with **fixed offsets or notehead-center anchors that ignore each other's real extents**, so glyphs collide and the staff bleeds past the block box.

## Evidence

Owner screenshot of the rendered block (grand staff, 2 systems, a 4/4→3/4 change with an `8va` and a tempo/`= 90` cluster). Visible collisions: the key/time/tempo/ottava glyphs overlap near the system head and the second-measure change; per-note accidentals touch their noteheads; ties cut through the noteheads; the staff lines and brace extend past the dashed block boundary.

## Findings

Each finding is independently addressable. Format: **observation → where it lives → likely cause → direction.** Locations are on the PR branch.

### Prelude / system head

**F1 — Each head field (clef, key sig, time sig…) needs reserved space; right now they overlap.**
- **Where:** `src/notation/svg.js` › `renderReserve()` (~L332–369). Prelude glyphs are placed at *hard-coded* offsets: `clefX = brace.x + 1.5`, `keySigX = clefX + 2`, `tsX = keySigX + 2` — independent of each glyph's real width.
- **Cause:** `src/notation/layout.js` › `leadingReserveFor()` (~L1287) *does* size the reserve from real widths (`CLEF_WIDTH = 3`, key-sig cluster `glyphCount × ACCIDENTAL_COL_STEP = 1.3`, `TIME_SIG_WIDTH = 2.5`), but the emit layer ignores those widths for *inner* placement. With ≥2 key-sig accidentals the cluster (starts at 3.5, ≥2.6 wide) runs into the time signature fixed at 5.5.
- **Direction:** Make the layout model carry explicit `x` for clef / key sig / time sig (advance each field by the previous field's true width, mirroring `leadingReserveFor`); `renderReserve` should only place what the model positions, never re-derive offsets. This is the root cause that F2 and F3 also sit on.

**F2 — The brace joining the two staves isn't centered.** *(Owner clarified: this is the grand-staff brace, not the key/time signature.)*
- **Where:** `src/notation/svg.js` › `renderReserve()` (~L342): the brace is a `fontGlyph("brace", …)` drawn at `braceY = (rightStaffTopY + leftStaffBottomY) / 2` with `size = braceHeight`, but `fontGlyph` hard-codes `dominant-baseline: "alphabetic"` (~L152), so the glyph is anchored at its *baseline*, not its center — it rides high instead of straddling both staves. Its `x ≈ 0` also bleeds left (see F9).
- **Direction:** Center the brace vertically on the band (give `fontGlyph` a baseline override and use a centered baseline for the brace, or offset `braceY` by the glyph metrics) and place it inside the left margin (F9).

**F3 — Key-signature `alters` vs. the time signature.** *(Owner decision: KEEP standard order — clef → alters → time sig.)*
- **Resolution:** No reorder. The real problem the owner saw was the *overlap*, which is exactly F1. The "global alters" (per-hand default accidentals from `defaults`/section `alters`, drawn as the key-signature cluster) stay in standard position; fixing F1's spacing makes the existing order read cleanly. **Folded into F1 — no separate work.**

### Vertical placement of tempo & ottava

**F4 — Tempo and octave (ottava) markings can sit higher so they don't overlap the notes.**
- **Where:** `src/notation/layout.js` › `buildSystemTexts()`: tempo `y = band.topMargin − 1` (~L2085); ottava-above `y = staffTopY − 2` (~L2117). `topMargin = SYSTEM_TOP_MARGIN(5) + ledgerTopExtent` (~L1644).
- **Cause:** Both bands sit ~1–2 sp above the staff top, within reach of high notes / ledger stacks.
- **Direction:** Lift the tempo/ottava bands further above the staff and grow the top margin when either is present (extra top reserve in the `SYSTEM_TOP_MARGIN`/`topMargin` computation), so they clear the tallest notes.

**F5 — Tempo and octave need their own lanes, one after the other, so they don't overlap *each other*.**
- **Where:** same `buildSystemTexts()` — tempo (at its measure's left X) and ottava (spanning its notes' X range) are both emitted into the *same* top-margin band at similar Y, so their X ranges can overlap.
- **Direction:** Reserve two stacked lanes above the staff (e.g. tempo on the topmost lane, ottava on the lane just below, or vice-versa), each with its own reserved height, and size the top margin to fit both when both are present.

### Spacing

**F6 — Each measure end needs space before *and* after the barline; next-measure notes overlap the line.**
- **Where:** `src/notation/layout.js` system walk (~L1707–1778): the bar is placed at `measureRightX = x + scaledContent`, where `scaledContent = ml.contentWidth × advanceScale` — and the next measure starts at exactly `x = measureRightX` with internal `leadingPad = 0` (~L1700).
- **Cause:** `scaledContent` uses `ml.contentWidth`, which *excludes* the `trailingPad` that `measureLayout` computed (`ml.width = leadingPad + contentWidth + trailingPad`, and `barlineTrailingPad` even adds `MIN_ADV × 0.5`, ~L1255). So there's a gap *before* the bar (last note → bar) but **no gap after it** — the next measure's first note sits on the barline.
- **Direction:** Insert a post-bar gap — either include the trailing pad in the placed advance so the next measure starts past the bar, or give every measure a small leading inset (non-zero `leadingPad`/first-column offset). Aim for symmetric air on both sides of every barline.

**F7 — A note's accidental should sit a bit further to the side so it doesn't overlap the notehead.**
- **Where:** `src/notation/layout.js` › `stackAccidentals()` (~L631): `dx = ACCIDENTAL_GAP + column × ACCIDENTAL_COL_STEP`. `ACCIDENTAL_GAP = 0.6` (constants.js L104), but `NOTEHEAD_RX = 0.6` (constants.js L31) — so the accidental's gap from the notehead *center* equals the notehead's own radius, leaving ~0 air between the glyph and the notehead edge.
- **Direction:** Increase `ACCIDENTAL_GAP` (≈0.9–1.0 sp) and/or account for the accidental glyph's own advance width, so there is clear space between the accidental and the notehead.

### Ties

**F8 — Ties should arc above or below the notes, not through their middle.**
- **Where:** `src/notation/layout.js` › `buildSpanSpec()` (~L2025): tie endpoints are `y1 = a.y`, `y2 = b.y` — the notehead *center* Y — and the control point bulges only `±1` sp (`cy = baseY + bulge`). The arc therefore starts and ends at the notehead centers and cuts across them.
- **Direction:** Offset the tie endpoints clear of the notehead (≈`NOTEHEAD_RY` + margin, on the side opposite the stem), pick the side by stem direction (stems up → tie below, stems down → tie above), and deepen the bulge so the whole arc clears the noteheads. Keep the cross-system clipping behavior intact.

### Box bounds

**F9 — The pentagram (staff) extends outside the block box.**
- **Where:** `src/notation/svg.js`: staff lines run `x = 0 → system.width` (`staffLines`, `renderSystem` ~L295) with no side margins; the brace is drawn at `x ≈ 0` with the default `text-anchor = "middle"` (`fontGlyph`, ~L139) so half of it falls at **negative x**, left of the `viewBox` (`0 0 width height`, ~L243). `model.width = budgetSp` (layout.js ~L1813) = full container width, so the right edge also reaches the box edge.
- **Direction:** Inset drawable content with left/right margins inside the viewBox — start staff lines at `margin > 0`, end before `budgetSp`, place the brace/clef fully inside the left margin — and make `model.width`/`leadingReserveFor` account for the margins. Verify the SVG/host wrapper doesn't overflow its container.

## Summary table

| ID | Owner's point | Primary location | Type | Status |
|----|---------------|------------------|------|--------|
| F1 | Reserve space per head field | `svg.js renderReserve` / `layout.js leadingReserveFor` | overlap (root) | ✅ Fixed |
| F2 | Brace not centered | `svg.js renderReserve` brace / `fontGlyph` baseline | alignment | ✅ Fixed |
| F3 | ~~Alters after time sig~~ → keep standard order | folded into F1 | resolved | ✅ N/A |
| F4 | Tempo & ottava higher | `layout.js buildSystemTexts` + top margin | overlap w/ notes | ✅ Fixed |
| F5 | Tempo & ottava in separate lanes | `layout.js buildSystemTexts` + top margin | overlap w/ each other | ✅ Fixed |
| F6 | Space before & after each barline | `layout.js` system walk / `trailingPad` | spacing | ✅ Fixed |
| F7 | Note accidental further from notehead | `constants.js ACCIDENTAL_GAP` / `stackAccidentals` | spacing | ✅ Fixed |
| F8 | Ties above/below, not through | `layout.js buildSpanSpec` | tie geometry | ✅ Fixed |
| F9 | Staff escapes the box | `svg.js` viewBox/margins / `model.width` | bounds | ✅ Fixed |

## Owner decisions (resolved during review)

- **F2** refers to the **grand-staff brace**, not the key/time signature — re-scoped to brace centering.
- **F3** — **keep standard engraving order** (clef → alters → time sig). No reorder; the overlap is fixed via F1. F3 is folded into F1.

## Notes for the fix pass

- F1 is the root for F3 (and the head spacing F2's brace sits in) — make the head a model-positioned set of slots that respects each glyph's real width; do it first.
- F4 and F5 share the same `buildSystemTexts` + top-margin work — handle together.
- Most fixes are tunable constants in `constants.js` (`ACCIDENTAL_GAP`, top margins, a new barline/edge pad) plus positioning logic in `layout.js`; `svg.js` should stop deriving its own offsets and only place what the model gives it.
- Regression guard: the layout engine has 199 unit tests; new placement should keep them green and add cases for head-field spacing, barline gaps, tie clearance, and viewBox margins.

## Resolution (fix pass)

All findings addressed in `src/notation/{constants,layout,svg}.js` and guarded by 5 new unit tests (`layout.test.js` → "review-1 layout fixes"). What changed:

- **F1** — `buildLayoutModel` now positions clef → key sig → time sig from each field's REAL width (mirrored by the corrected `leadingReserveFor`, which also drops the old double-clef over-reserve); `renderReserve` just places the model's `x` values. The same width-aware advance fixes the mid-system section change (`inlineSectionChange`).
- **F2** — the brace uses a centered baseline (`fontGlyph` gained a `baseline` option) so it straddles both staves, and sits inside the left margin.
- **F4/F5** — tempo and above-staff ottava render in two stacked lanes (`TEMPO_LANE_Y`, `OTTAVA_ABOVE_LANE_Y`) above the note zone; systems carrying them use a deeper top margin (`TOP_TEXT_RESERVE`).
- **F6** — the per-measure trailing barline room (already in the packing width) is now real layout space: the bar is centered in it and the next measure starts past it.
- **F7** — `ACCIDENTAL_GAP` 0.6 → 1.2 (now clears `NOTEHEAD_RX`).
- **F8** — tie endpoints offset clear of the noteheads (opposite the stem) via `TIE_NOTE_CLEARANCE`, bulging further so the arc never crosses a head.
- **F9** — `STAFF_MARGIN_X` insets the staff lines, brace, and barlines on both sides; the content budget and packing subtract the margins so nothing bleeds past the box.

**Verification:** 257 unit tests pass, `npm run build` + Biome clean, and a headless render of the comprehensive song (the screenshot fixture, real font) confirms every overlap is gone and the staff stays inside the box.
