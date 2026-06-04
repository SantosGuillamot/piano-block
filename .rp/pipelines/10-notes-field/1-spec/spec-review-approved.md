# Spec Review

## Verdict: approved

## Summary

The revised spec is sound, complete, internally consistent, testable, and feasible against the existing codebase. It faithfully formalizes the two-mode notes model (per-event with implicit staff; standalone with required `staff` and optional `beat`), specifies the `chordSymbol` clean break exactly as the research resolved it (silent-ignore of legacy keys, no migration, no validator rejection, no token left in `src/`/`specs/`/`docs/`, one explanatory doc line), enumerates the validation rules as discrete testable rows, and expresses rendering as capability + observable band + horizontal anchoring while correctly leaving pixel/sp geometry, fonts, lane structure, attribute names, and collision/clamp math to the design phase. All five points from the prior rejection are genuinely resolved (verified below). My fresh adversarial pass surfaced no new blocking issue: every requirement (R1–R4) is backed by at least one Given-When-Then acceptance criterion, the requirement-to-AC mappings are consistent, and no design/implementation detail leaked into the requirements. I re-verified each load-bearing feasibility claim against the codebase, so downstream phases have solid ground.

## Resolution of the prior five rejection points

1. **Mode × position diagonal → full matrix.** The rendering ACs now cover all eight cells of {above-RH, below-RH, above-LH, below-LH} × {per-event, standalone}: per-event at spec lines 95–98 (RH-above, RH-below, LH-above, LH-below) and standalone at lines 99–102 (RH-above, RH-below, LH-above, LH-below). Both attachment modes now reach every band. Resolved.
2. **Over-content `beat` still renders.** A rendering AC now exists (line 107): a `beat` larger than the measure's content still produces a text node within the system's horizontal bounds, with the clamped X left to design. Resolved.
3. **Shared inter-staff band coexistence.** A dedicated AC (line 115) places a below-right-hand note and an above-left-hand note in the same measure and asserts both render with observable staff so they stay distinguishable in the shared band. Resolved.
4. **Strengthened no-`beat` AC.** The no-`beat` horizontal AC (line 106) is now anchored to a `beat: 0` reference and required to sit left of a `beat: 2` note, replacing the prior un-falsifiable "within the measure's bounds." Resolved.
5. **Rests covered.** Both a validation AC (line 71) and a rendering AC (line 118) exercise a `type: "rest"` event carrying `notes`, and Requirement 1 (line 13) states the note/rest coverage explicitly. Resolved.

## Feasibility verification (codebase)

- Band Y anchors `rightStaffTopY`/`rightStaffBottomY`/`leftStaffTopY`/`leftStaffBottomY` exist in `src/notation/layout.js` and are consumed in `src/notation/svg.js`, so the band-relative rendering ACs are grounded.
- The schema subset supports `$defs`, `$ref`, `required`, `enum`, `type`, `properties`, `items` (`src/song/schema.js`), so the two-`$defs` (`eventNote`, `standaloneNote`) expression needs zero new keyword support.
- The `event` def is `enum: ["note", "rest"]` and `notes` would be an `event` property, so a `notes` array on a rest is feasible exactly as the new rest ACs require.
- `applySpecialCases` is keyed by `$defs` name with the `bpm > 0` precedent (`src/song/validate.js`), so the `beat >= 0` walker special case is a direct parallel.
- DOM observability attributes (`data-text`, `data-hand`, `data-measure`, `data-event-index`) already exist in `src/notation/svg.js`, so making placement and staff observable (e.g. a new `data-placement` attr) fits the established pattern; the exact attribute name is correctly deferred to design.
- The current `chordSymbol` references (schema, validator test, layout, svg, E2E specs, docs, README, `render.php` comment) confirm the removal-bar requirement and its named update sites are accurate.

## Issues

None blocking. The spec is approved as-is.
