# Phase 6 — Review 3 of PR #6

**PR:** [#6 — Render the Piano block's song as sheet music (grand staff)](https://github.com/SantosGuillamot/piano-block/pull/6)
**Branch:** `worktree-4-render-sheet-music` · **Issue:** #4 · **Reviewer:** owner
**Builds on:** [review-1.md](review-1.md) + [review-2.md](review-2.md). Six refinements on the post-review-2 render.

## Findings

Format: **observation → where it lives → fix.**

**R3-1 — Ties and slurs should anchor at the note's horizontal center.** *(Owner preference — note that standard engraving uses the notehead edges.)*
- **Where / fix:** `src/notation/layout.js` › `buildSpanSpec`. Endpoints were `a.x + NOTEHEAD_RX` / `b.x − NOTEHEAD_RX` (notehead edges); now `a.x` / `b.x` (centers), for both ties and slurs.

**R3-2 — The slur should arc to the top/bottom (clear of the notes) like the tie, not through their middle.**
- **Where / fix:** same `buildSpanSpec`. The slur kept the old through-the-centers geometry. Unified ties and slurs onto the tie's clearance geometry: endpoints offset off the noteheads on the side opposite the start note's stem, control bulging further (a slur, being a phrase, bulges more than a tie).

**R3-3 — A whole note doesn't occupy the space it applies to.**
- **Where / fix:** `src/notation/layout.js` system walk. A measure whose entire content is a single onset at beat 0 (a lone whole note/rest filling the bar) is now **centered** in its content rather than hugging the left barline — the conventional "centered whole note" so it reads as filling the measure.

**R3-4 — The chord symbol should sit a bit higher.**
**R3-5 — Make the top area flex: with no chord symbol or octave shift, the tempo drops down.**
- **Where / fix:** `src/notation/layout.js` › new `topMarginLayout`, replacing the fixed `TOP_TEXT_RESERVE`/lane constants. The top margin is now a **flexible stack** of only the lanes actually present — chord symbols nearest the staff, then an above-staff ottava, then the tempo at the top — over an inner zone that also reserves the high-note/ledger extent **and the measure number**. So when nothing is above the staff, the margin (and the tempo) collapse toward it; the chord symbol rides in its own lane (higher than before). Chord-symbol Y now comes from the model (`band.chordSymbolY`) instead of a hard-coded emit offset. A measure-number/tempo collision the first flex pass introduced is prevented by folding the measure number into the stack's inner zone.

**R3-6 — The pentagram still goes outside the box on the page.**
- **Where / fix:** `src/notation/svg.js` › `renderSvg`. Review-1's F9 inset the staff *inside the viewBox*, but the whole SVG could still be **wider than the block's content box** — a padded wrapper, or the narrow-screen sp step-down (`view.js` measures in `NARROW_SP_PX` while the emit scales by `SP_PX`), pushing the intrinsic px width past the container. Added `style="display:block;max-width:100%;height:auto"` so the SVG shrinks to the content box (the viewBox keeps the staff inset), guaranteeing it stays in the box. Verified with a padded container: SVG fits with 0 px overflow on both sides.

## Resolution

| ID | Owner's point | Location | Status |
|----|---------------|----------|--------|
| R3-1 | Tie/slur anchored at note center | `layout.js buildSpanSpec` | ✅ Fixed |
| R3-2 | Slur clears the notes like the tie | `layout.js buildSpanSpec` | ✅ Fixed |
| R3-3 | Whole note centered in its measure | `layout.js` walk (centerFill) | ✅ Fixed |
| R3-4 | Chord symbol higher | `layout.js topMarginLayout` + emit | ✅ Fixed |
| R3-5 | Flexible top margin (tempo drops) | `layout.js topMarginLayout` | ✅ Fixed |
| R3-6 | SVG/staff stays inside the box | `svg.js renderSvg` (max-width) | ✅ Fixed |

**Verification:** 263 unit tests pass (4 added: tie/slur center anchors, whole-note centering, top-margin flex, SVG overflow guard), `npm run build` + Biome clean. A headless render confirms: tie/slur run center-to-center and arc clear above the notes; the whole note centers in its bar; the chord symbol rides its lane; a chord/ottava-free system's tempo collapses toward the staff (without colliding with the measure number); and the SVG fits a padded container with no overflow.
