# Phase 6 — Review 2 of PR #6

**PR:** [#6 — Render the Piano block's song as sheet music (grand staff)](https://github.com/SantosGuillamot/piano-block/pull/6)
**Branch:** `worktree-4-render-sheet-music` · **Issue:** #4 · **Reviewer:** owner
**Builds on:** [review-1.md](review-1.md) (F1–F9, all shipped). **Verdict:** "Much better" — three residual mismatches on the same render.

## Evidence

Owner screenshot of the post-review-1 render (same comprehensive song: grand staff, 4/4→3/4 with an `8va` and a tempo change). Three issues remained.

## Findings

Format: **observation → where it lives → fix.** Locations are on the PR branch.

**R2-1 — The initial brace should run from the top of the first staff to the bottom of the second.**
- **Where:** `src/notation/svg.js` › `renderReserve()`. Review-1 (F2) centered the brace with a `central` baseline, but this bundled music font has unusual vertical metrics, so the glyph rode high and only covered the upper staff.
- **Cause:** Measured the brace glyph against the bundled font (embedding it in an SVG so the `@font-face` actually applied): its ink is **~1 em tall with its bottom on the alphabetic baseline**. The `central` baseline plus the font's large declared descent pushed it up and short.
- **Fix:** Size the brace to the grand-staff height and anchor it (normal alphabetic baseline) at the **LH staff bottom**; its ~1-em ink then rises to the RH staff top. Reverted the `fontGlyph` baseline option (no longer needed). Verified: brace bottom at the bass bottom line, top at the treble top line.

**R2-2 — Still overlap between a measure's end barline and the next measure's opening notes.**
- **Where:** `src/notation/layout.js` system walk + `barlineTrailingPad`. Review-1 (F6) added a gap, but it was only ~0.6 sp — equal to the notehead radius — so a wide opening notehead (e.g. a whole note) still touched the line (measured: next-note left edge sat ~0 sp past the bar).
- **Fix:** New `BARLINE_POST_PAD` (1.4 sp) constant; the bar now sits at the measure's content end and the next measure starts a full post-pad beyond it, so the opening notehead clears the line by ~0.8 sp. Verified by coordinate dump.

**R2-3 — Same problem at section ("chunk") boundaries: the new section's notes should start after its time signature.**
- **Where:** `src/notation/layout.js` — a mid-system section change drew the cautionary clef/key/time glyphs (review-1 F1 made them width-aware *among themselves*), but the measure's **notes still started at the measure's left edge**, on top of those glyphs. There was no leading reserve for the inline change — the inline analog of the missing space the head reserve provides.
- **Fix:** New `inlineReserveWidth()` mirrors the inline field advances; section-start measures get that as a **leading inset** (applied in both packing and placement, mid-system only — a section start that lands at a system head uses the head reserve instead). The section's notes now begin after the inline time signature (measured: ~3.5 sp past it).

## Resolution

| ID | Owner's point | Location | Status |
|----|---------------|----------|--------|
| R2-1 | Brace spans the full grand staff | `svg.js renderReserve` (brace anchor/size) | ✅ Fixed |
| R2-2 | Gap after every barline clears the next note | `constants.js BARLINE_POST_PAD`, `layout.js` walk | ✅ Fixed |
| R2-3 | Section notes start after the inline time sig | `layout.js inlineReserveWidth` + leading inset | ✅ Fixed |

**Verification:** 259 unit tests pass (3 added/strengthened: barline-gap clears a notehead, section notes clear the inline time sig, brace spans the staff), `npm run build` + Biome clean, and a headless render of the comprehensive song (real font) confirms the brace spans both staves, opening notes clear every barline, and the second section's notes start after its `3/4`.
