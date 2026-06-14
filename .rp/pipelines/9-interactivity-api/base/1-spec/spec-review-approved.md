# Spec Review — APPROVED

**Spec:** `1-spec/spec.md` — "Move the Piano block's frontend JS to the Interactivity API" (issue #9)
**Verdict:** APPROVED
**Reviewer:** spec-reviewer (adversarial review)

## Summary

The spec is accurate against the codebase, complete against the research's locked
decisions, correctly pitched at WHAT-not-HOW, properly scope-fenced, and records the
design-phase flags as open constraints rather than silently resolving them. Every parity
claim I spot-checked against the live source and the e2e suite matches exactly. No issue
was found that genuinely impairs correctness, completeness, testability, or scope.

## What I verified (and the result)

**Source-of-truth parity claims — all confirmed against the actual code:**

- **Escape-safety / transport (R5, AC8).** `render.php:30-41` confirms the current
  hand-rolled `str_replace('<', '<', $song)` inside an inert
  `application/json` `<script class="wp-block-piano-block-piano__song">` carrier, and
  `specs/render.spec.js:680-696` confirms the AC8 transport sub-check reads that literal
  carrier and asserts the `</script>` / `<!--` escape plus a byte-exact
  `JSON.parse` round-trip. The spec's route-B rework (drop the carrier, seed
  `wp_interactivity_data_wp_context(['song' => …])`, restate the guarantee
  transport-agnostically, rework only the AC8 sub-check) matches research decision 6 and
  is the only existing assertion it changes. The `JSON_HEX_TAG`-superset claim is correct.

- **Accessible-name branches (R3, AC3).** `src/song/accessibleName.js:23-47` confirms all
  four branches verbatim, including the title-only branch returning the author's title
  with **no** i18n wrapper, and the `__`/`_x`/`sprintf` usage. The spec reproduces them
  exactly.

- **Resize reflow (R7, AC5).** `src/view.js:94-109` confirms the rAF-debounced, one-way
  `ResizeObserver` with a `ResizeObserver`-undefined no-op, and the unconditional first
  draw firing from `drawWhenFontReady` (`view.js:79`) before `observeResize` (`view.js:81`).
  `src/notation/dom.js:11-30` confirms the single `NARROW_CONTAINER_PX = 480` breakpoint
  and zero-width tolerance. `specs/render.spec.js:587-625` confirms the hard "narrow →
  more `g[data-system]`, via `expect.poll`" assertion. R7's framing (unconditional initial
  draw; reflow required where supported; one breakpoint; no feedback loop) is faithful.

- **Validate-once + cache-and-redraw (R6).** `src/view.js:57-74` confirms `validateSong`
  runs once in `setupContainer` and `draw` re-runs `buildLayoutModel`+`renderInto` with no
  re-validation, plus the defensive `try/catch` parse after a clean validate
  (`view.js:63-68`). R6 captures both.

- **Font-gate (R11).** `src/notation/dom.js:40-52` confirms the best-effort
  `document.fonts.load(...).catch(()=>{}).then(draw)` with immediate-draw fallback when the
  Font Loading API is absent — correctly framed as a soft, non-asserted nicety.

- **Registration / scope (R1, R10, R13, Out of Scope).** `src/block.json:16` confirms the
  current `viewScript` and `editorScript: file:./index.js`; `piano-block.php:30-34`
  confirms the now-to-be-dead `wp_set_script_translations('piano-block-piano-view-script', …)`
  call that R9 requires be removed/replaced. The frozen-editor / frozen-notation-core /
  frozen-validator fences match research decision 13.

**Interactivity-API accuracy — confirmed against the `wordpress-development` reference:**

- `viewScriptModule` (hard rule 1), `data-wp-interactive="<namespace>"` wrapper (hard rule
  2), per-instance `wp_interactivity_data_wp_context()` + `getContext()` for per-instance
  data with the explicit local-context-vs-global-state warning (hard rules 4-5 and the
  dedicated section), and the `.focus()` carve-out analogy the spec uses for the imperative
  SVG mount (hard rule 11) all match the reference. R4's per-instance-context-not-state
  choice and R8's per-instance isolation are exactly what the reference prescribes for
  multiple instances on one page.

## Review-criterion checklist

1. **Self-contained.** PASS. The Overview, "Key context for testability," and the
   imperative-SVG carve-out give a reader the current behavior, the migration, the parity
   baseline, and the carve-out rationale without needing the research doc.
2. **Requirements complete / unambiguous / testable; consistent with locked decisions.**
   PASS. Parity to the e2e DOM contract (R2/R3/AC1-3,10-12), route-B transport with
   escape-safety (R4/R5/AC8), validate-once + cached redraw (R6), the HARD resize-reflow AC
   (R7/AC5), the NEW multi-block isolation AC (R8/AC9), and the imperative-SVG carve-out
   (carve-out section + R13) each map to a research decision (6, 7, 9, 15, 17) and to a
   concrete, pinned assertion.
3. **WHAT not HOW.** PASS. R1 explicitly defers the store/directive shape to design; R4
   uses "e.g." for the API surface; the carve-out fixes the observable boundary ("the store
   drives *when and with what data*") without dictating init-vs-watch. No architecture
   leaked.
4. **Scope fence correct.** PASS. Editor (`edit.js`/`editor/*`/`index.js`), notation core,
   and the song format/validator are all frozen in Out of Scope, with the shared-core
   regression risk called out.
5. **Design-phase flags recorded as OPEN constraints.** PASS. Both the WP 6.9-vs-7.0
   module-translation i18n caveat and the store/directive lifecycle boundary live under
   "Constraints / Open Questions for the Design Phase" and are explicitly **not** resolved;
   R9 defers localized-file loading while keeping string-correctness as the hard requirement.
6. **No invented requirements; no missing parity.** PASS. Every Q5 edge case is carried:
   validate-once (R6), empty-staff carve-out (R6/AC13), single breakpoint (R7), no new
   console errors (R12), JS-disabled renders nothing (R2), defensive parse guard (R6). I
   found no parity behavior from `src/view.js` that the spec drops, and no requirement the
   research did not support.

## Minor observations (non-blocking, do not impair the spec)

- **AC numbering.** The spec uses AC1/2/3/5/6/7/8/9/10/11/12/13/14/15 and skips AC4. The
  live suite only labels AC1/2/5/6/7/8/12 as standalone tests; AC4 (a mid-song cautionary
  clef) appears only as an inline comment inside the AC1/2/12 test, not a standalone
  assertion. The spec honestly states "AC numbers follow the existing suite's labels where
  they exist," and its blanket "every existing assertion must continue to pass" clause
  covers the inline AC4 assertion transitively. Consistent, not a defect.
- **R1 does not name `viewScriptModule` / `supports.interactivity` as hard requirements**;
  they appear illustratively in the Overview. This is the correct WHAT-level choice — R1
  requires that the Interactivity API (not a `viewScript`/`domReady` boot) own the
  lifecycle, and AC14 pins the verifiable invariant. Acceptable.

These are noted for transparency only; none warrants rejection.

## Conclusion

The spec faithfully and testably captures the observable behavior to preserve, adopts the
researched route-B transport with the escape-safety guarantee intact, adds the multi-block
isolation AC, carves out the imperative SVG mount correctly, fences scope, and surfaces the
two design-phase decisions as open constraints. **APPROVED.**
