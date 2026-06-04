# Phase 6 — Review 5 of PR #6

**PR:** [#6 — Render the Piano block's song as sheet music (grand staff)](https://github.com/SantosGuillamot/piano-block/pull/6)
**Branch:** `worktree-4-render-sheet-music` · **Issue:** #4 · **Reviewer:** owner
**Builds on:** review-1 … review-4.

## Findings

**R5-1 — "What is the 1 up to the first note?"**
- That "1" was the **measure number** drawn above the first measure. By convention the first measure is never numbered (its number is obvious), so it now shows no number; every *later* system still labels its first measure. (`buildLayoutModel` measure-number primitive is `null` for measure 1; the flexible top margin no longer reserves number room there.)

**R5-2 — Opening notes closer to the bar; the centered whole note "looks weird" — the left-aligned example is better.**
- **Fix (a):** reduced `BARLINE_POST_PAD` (0.8 → 0.7) so an opening note hugs the bar a little more.
- **Fix (b):** removed the whole-measure **centering** added in review-3 — a lone whole note (or any single-onset measure) now **left-aligns** at the measure's start like every other opening note. The review-3 centering test became a left-alignment test; the accidental-lead reserve (review-4) now also applies to these single-note measures so an opening accidental still gets room.

**R5-3 — More space between the clef and the alters.**
- Widened the clef's horizontal slot (`CLEF_WIDTH` 3 → 3.8), so the key-signature alters (and, with no alters, the time signature) start further to the right of the clef. The clef's own X is unchanged.

**R5-4 — Clefs vertically mis-positioned (bass, alto, treble).**
- **Cause:** every clef was anchored at a single fixed Y (`staffTopY + 3`), correct only for the treble (G) clef. The bass, alto, and tenor clefs were therefore 1–2 sp too low.
- **Fix:** anchor each clef on its **SMuFL reference staff line** (`CLEF_REF_LINE_FROM_TOP`): treble (G) on the 2nd line from the bottom, bass (F) on the 2nd from the top, alto (C) on the middle line, tenor (C) on the 4th line from the bottom.
- **Verification:** measured each clef glyph's ink against the bundled font (embedding it so the `@font-face` applied) — the gClef spiral, the fClef dots, and the cClef center all sit exactly on the glyph baseline, confirming "baseline = reference line." A per-clef render confirms each now sits on its line. (The treble was already correct and is unchanged; the alto and tenor differ by only one line, which is correct but subtle.)

## Resolution

| ID | Owner's point | Location | Status |
|----|---------------|----------|--------|
| R5-1 | The "1" is the measure number | `layout.js` (suppress measure 1) | ✅ Explained + suppressed |
| R5-2 | Opening notes closer; drop whole-note centering | `layout.js` walk, `BARLINE_POST_PAD` | ✅ Fixed |
| R5-3 | More space between clef and alters | `layout.js CLEF_WIDTH` | ✅ Fixed |
| R5-4 | Clefs vertically correct | `svg.js appendClef` + `CLEF_REF_LINE_FROM_TOP` | ✅ Fixed (measurement-verified) |

**Verification:** 267 unit tests pass (3 added/updated: measure-1 not numbered, whole note left-aligned, clefs on their reference lines), `npm run build` + Biome clean. A headless per-clef render (real font) confirms the treble/bass/alto/tenor each sit on their reference line, measure 1 is unnumbered, opening notes hug the bar, the whole note is left-aligned, and there is more space between the clef and the alters.
