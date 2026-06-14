# Design Doc Review

## Verdict: approved

## Summary

This is a re-review of the REVISED design doc (HEAD commit `3cb03f8`), which
tightened five points after a prior approval was written against the pre-revision
doc. I re-reviewed the current committed doc and verified the five revisions
against the source, confirmed the previously-verified load-bearing decisions still
hold, and ran a fresh adversarial pass for new problems. The revised design is
sound, complete, traceable, and feasible. Approved.

### The five revision points — each genuinely and unambiguously resolved (verified in code)

1. **Stem contract.** Confirmed `stemDirectionForChord`'s signature is unchanged:
   `@param {number[]} positions` at `layout.js:262`. The doc renames `positions` →
   `headInputs` (`{ sFromBottom, step }[]`), feeds the pairs to `stackChord`, and
   recovers the number array for `stemDirectionForChord` via
   `headInputs.map(h => h.sFromBottom)`. The "layout.js downstream adaptations"
   section enumerates every former `positions: number[]` consumer with one exact
   expression each, and I verified each consumer exists exactly where the doc says:
   `stemDirectionForChord` (`layout.js:1503`), the accidentals loop
   (`1508-1517`, reading `positions[pi]`), the ledger loop (`1522`,
   `for (const s of positions)`), the dot loop (`1532`), and
   `topStep`/`bottomStep` (`1558-1559`, `Math.max/min(...positions)`). There is no
   two-implementer ambiguity: each consumer has a single stated expression, and the
   sort-rides-objects mechanism (comparator switches to
   `a.sFromBottom - b.sFromBottom`) is spelled out. The one place the doc offers two
   forms — the accidentals loop's "index form vs. paired-walk form" — is an explicit,
   recommended-form-named stylistic latitude that produces identical model bytes for
   the only songs that reach this code (conformant, per the client gate); it is
   correctly framed as a flagged latent-fragility nice-to-have, not a behavioral fork.

2. **i18n delivery.** Confirmed `render.php` already SSRs the wrapper and ships
   per-instance context via `wp_interactivity_data_wp_context($context)` (the same
   transport used for `song`/`accessibleName`). The revised doc (Decision 5, AC8)
   pins: `render.php` computes `__('Show note names', 'piano-block')`, ships it as
   `data-wp-context.toggleLabel`, and the SSR `<button>` binds it with
   `data-wp-text="context.toggleLabel"`; `view.js` never imports `@wordpress/i18n`.
   The label is a FIXED string with state conveyed by `aria-pressed`, so there is no
   `state.toggleLabel` getter and no JS-side label logic — the prior ambiguity is gone.

3. **systemHeight invariance.** Confirmed by reading the geometry block
   (`layout.js:1852-1942`): `topMarginLayout`, `ledgerTopExtent`/`ledgerBottomExtent`,
   `bandOccupancy`, the inter-staff gap, and the `systemHeight` sum derive entirely
   from `members` (note records / ledger extents / band occupancy) — none read
   `head.name`, `showNoteNames`, or `system`. Because names attach to already-laid-out
   head objects AFTER all geometry is computed, the invariance holds by construction:
   zero vertical delta in BOTH states by default. The extreme-ledger clip is handled
   by a contingency gated `showNoteNames ? nameExtent : 0`, which is 0 on the off-path,
   preserving AC10 byte-identity. The doc dedicates a whole section to this and pins a
   render assertion that names-ON `viewBox`/`systemHeight` equals names-OFF.

4. **hasNameableNotes / FOUC.** Confirmed `render.php` only `json_decode`s `metadata`
   for the accessible name and explicitly does NOT gate rendering (no JS validator, no
   layout model build). Decision 7 therefore computes `hasNameableNotes` CLIENT-side in
   `view.js`'s `init`, and I confirmed the detection expression is structurally
   accurate against the real model: the measure model is `{ ..., right, left }` where
   each hand is `layoutHand`'s `{ notes, rests, beams, texts }` (`layout.js:1589,
   2145-2155`), rests go to `rests` not `notes`, and the system carries
   `measures: measureModels` — so
   `systems.some(s => s.measures.some(m => (m.right?.notes?.length||0)+(m.left?.notes?.length||0) > 0))`
   is exactly "has a nameable note." The button is SSR'd with a literal `hidden` plus
   `data-wp-bind--hidden="!context.hasNameableNotes"` over a seeded `false`, whose
   first computed value (`!false === true`) is also `hidden` — no flash, no
   SSR/hydration conflict, and JS-off stays hidden with no dangling control.

5. **Single-source vocabulary.** Confirmed `editor/noteNames.js` currently holds the
   private consts `SYSTEMS`/`CANONICAL_LETTERS`/`SPANISH_TOKENS` and the functions
   `stepsOf`/`inferNoteNameSystem`/`stepInSystem` (all i18n-free; `@wordpress/i18n` is
   used only by `noteLabel`'s rest branch at line 157), depending only on the
   frontend-safe `normalizeStep.js`. A repo-wide search confirms nothing external
   imports the four private consts, and `noteNames.test.js` imports only the five
   exported functions (`inferNoteNameSystem, mapSong, noteLabel, noteNameOptions,
   stepInSystem`). So MOVING the vocab + the three functions into a new
   `src/song/noteNameSystem.js` and having `noteNames.js` import/re-export them leaves
   `noteNames.test.js` and every editor importer (`edit.js`, `PitchEditor.js`,
   `StructureTree.js`, `HandConfigEditor.js`, `PitchList.js`, inspector panels)
   unchanged, while `layout.js` imports `stepInSystem` from the same module — one
   definition, satisfying FR4 by construction.

### Previously-verified load-bearing decisions — re-confirmed intact after the revision

- **replaceChildren inner-`<div>` fix.** Confirmed `view.js` uses
  `getElement().ref` as the wrapper (`view.js:73`), observes that wrapper
  (`view.js:66`), and `renderInto` ends in `container.replaceChildren(svg)`
  (`svg.js:277`). The wipe risk is real; the doc's inner-score-`<div>` host (the SVG
  renders into the inner div, the SSR button survives as a sibling, width is measured
  on the inner div) is the correct fix and is unchanged by the revision.
- **One flag site at `buildLayoutModel`.** Confirmed `buildLayoutModel(song,
  availableWidthInSp)` is 2-arg today (`layout.js:1747`) and the editor calls it with
  two args (`SongCanvas.js:117`); adding a third defaulted `{ showNoteNames = false,
  system }` keeps the editor on the names-off path by construction (AC11).
- **AC10/AC11 byte-identity + the `outerHTML` pin test.** Confirmed `el()` skips
  undefined/null attributes (`svg.js:86`), `renderSvg` returns the `<svg>` element
  (`svg.js:262`) so `outerHTML` is reachable in jsdom, and there is no exhaustive
  deep-equal on whole head objects — so omit-key-when-off is correctly a nice-to-have,
  not a correctness blocker. The new `outerHTML` pin test (no-arg editor path ===
  explicit names-off frontend path) is well-specified.
- **Per-head placement + stackAccidentals dodge.** Confirmed `renderNote`
  (`svg.js:704-768`) appends head children (noteheads, accidentals, dots) as siblings
  inside the note `<g>`; the doc's per-head name `<text>` reuses exactly this pattern,
  and its placement formula references the real constants (`NOTEHEAD_RX`, `note.x`,
  `head.displaced`, dot reach). The dodge is a parameterized reuse of the existing,
  tested `stackAccidentals`.

### Fresh adversarial pass

No new problems were introduced by the revision. The `hidden` + `data-wp-bind--hidden`
combination is correct WP Interactivity behavior (seeded `false` → directive computes
`hidden`, matching the SSR attribute). The accidentals-loop two-form latitude is the
only place offering a choice, and it is explicitly recommended-form-named and
behaviorally identical for conformant input. Every requirement (R1–R13) and acceptance
criterion (AC1–AC13) maps to a concrete, code-grounded decision, and the central AC10
names-off byte-identity is funnelled through one flag, defaulted OFF, with the name key
omitted when off and a machine-checkable pin test.

Approved.
