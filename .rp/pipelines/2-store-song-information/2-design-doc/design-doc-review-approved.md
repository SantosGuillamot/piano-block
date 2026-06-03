# Design Doc Review — APPROVED

**Verdict: APPROVED** (round 2).

Reviewer: `design-doc-reviewer` (adversarial, single-task). Subject: `2-design-doc/design-doc.md` at the current committed **`bb557dd`** ("Fix design-doc review findings"), reviewed against the authoritative spec `1-spec/spec.md` (requirements 1–14, AC1–AC10, Out-of-Scope) and the settled `2-design-doc/design-doc-research.md`, with feasibility grounded in the issue-#1 scaffold (`src/block.json`, `src/edit.js`, `src/index.js`, `src/render.php`, `piano-block.php`).

This approves the design after the round-2 revision resolved all three round-1 findings. I re-read the current file in full, diffed `c7a82bc` → `bb557dd` to confirm the fixes are surgical, and applied my full adversarial bar — including a regression audit of the hand-edited §9 example. The design is complete, internally consistent, feasible on the scaffold with zero runtime dependencies, aligned with the spec without scope creep, and honestly caveated.

---

## Round-1 findings — all resolved

### F1 (was BLOCKING) — RESOLVED. The §9 example now demonstrates a genuine mid-song clef change (§9; AC5, Req 4.6)

- `defaults.leftHand.clef` = `"bass"` (line 484); Section 2's `leftHand.clef` = `"tenor"` (line 551) — a **real `bass`→`tenor` clef change**. `"tenor"` is in the `clef` enum (line 397), so the example stays conformant.
- The misleading no-op restatement (`rightHand.clef: "treble"`, identical to defaults) was **removed**; the right hand now genuinely inherits `treble`, and the inline comment (line 548) correctly says so.
- Both annotations are now **truthful**: the Section-2 header (lines 538–541) describes "a left-hand clef change" with the right-hand clef inherited, and the AC5 mapping (line 576) names "a left-hand **clef change** (`bass`→`tenor`)."
- **Regression audit (hand-edited JSON):** I re-verified the entire example. JSON syntax is correct after the edit (the removed `rightHand.clef` and added `leftHand.clef` leave both objects with valid comma placement and no trailing commas). Every other Section-2 annotation still holds (tempo 120→90; time 4/4→3/4; `octaveShift +1` with `octave 5 → sounds 6` and `C#6 → sounds 7`; `alters` add/clear; dotted-half = 3 beats fills 3/4). The clef change to `tenor` correctly has **no** effect on any sounding-pitch/octave/duration annotation, consistent with the model's treatment of clef as a non-sounding display concept (§3.1). Section 1 is unchanged and remains conformant.
- **AC5 coverage is now complete:** with the genuine left-hand clef change, the single worked example exercises every AC5-named element (notes, rests, chords, dotted durations, per-note accidentals, English+Spanish names, per-hand clef/default-accidentals/octave-shift, mid-song tempo/clef/time-signature/accidental changes, dynamics, chord symbols, ties, slurs, repeat barlines, title/composer).

### F2 (minor) — RESOLVED. §7 schema is now self-consistent with its declared keyword subset (§7, §6.2; Req 8)

- `exclusiveMinimum: true` (the draft-04 boolean form) is **dropped** from `tempo.bpm`, which now declares only `{ "type": "number" }` (lines 380–382), with an inline comment that the strict bound is walker-enforced.
- `const` is now **declared** in both keyword lists — §7 line 317 ("one `if/then` (whose discriminant uses `const`)") and §6.2 line 286 ("one `if/then` (with a `const` discriminant)").
- `bpm > 0` is cleanly **delegated to the walker** as a documented **third** special case (the "Two checks" → "Three checks" list now includes the `tempo.bpm` strict-lower-bound bullet), and §6.2 item 2 moves `bpm > 0` out of the integer-ranges clause into a "strict numeric bound … (a walker check — see Section 7)" clause. This is internally consistent (`bpm` is a `number`, not an integer, so it never belonged in the integer-ranges list) and mirrors how the note-name and `alters` checks are already delegated.
- I scanned the full schema body: every keyword used (`type`, `required`, `properties`, `items`, `enum`, `$ref`/`$defs`, `minimum`/`maximum`, `if`/`then`, `const`, permissive `additionalProperties`) is now in the declared subset; no stragglers. The two new cross-references (§6.2↔§7) both resolve.

### F3 (cosmetic) — RESOLVED. §8 empty-read prose now matches the illustrative code (§8; Req 12, AC3)

The prose (line 450) now reads the value as `isset( $attributes['song'] ) ? (string) $attributes['song'] : ''` and tests `'' === trim( $song )`, matching the illustrative code (lines 457–460). Both forms are PHP 7.4-safe and the `(string)` cast is the more defensive of the two.

---

## Full adversarial re-check (current version) — sound

- **Fixes are surgical.** The `c7a82bc` → `bb557dd` diff touches only §6.2 (two keyword/check mentions), §7 (keyword list + `bpm` schema + special-cases count), §8 (empty-read prose), and §9 (example + annotations). Everything I validated as sound in round 1 (data model, validation approach, attribute typing, render, completeness/traceability, no scope creep) is untouched and intact. The §12.1/§12.2 + §13 citation content (verified sound in my round-2 first pass: all five `[[n]]` footnotes resolve and map to the correct sources; doc-backed vs runtime-to-confirm split is honest) is also unchanged.
- **No new defects introduced.** No dangling cross-references; the example remains valid JSONC and fully conformant; no annotation is now false.
- **Completeness & alignment.** Every Req (1–14) and AC (1–10) remains addressed and traceable (§11). The runtime-dependent claims (AC1 save→reload round-trip, AC3 empty renders nothing, AC8 XSS payload, exact installed `@wordpress/components` prop signatures) are correctly scoped to the Code phase in §12.2, with the documented API contracts cited in §12.1 — honesty of caveats is well-calibrated.

### Non-blocking observation (no action required)

The §2 architecture *schematic* (line 37) still uses the compact `$song = $attributes['song'] ?? '';` shorthand for "read safely," whereas the §8 detail (post-F3) standardizes on `isset(...) ? (string)... : ''`. The two are functionally equivalent for the empty/unset case, the diagram is explicitly a simplified overview (not literal code), and §8 is authoritative ("the Code phase finalizes the exact form"). This is immaterial and below the bar for a finding — noted only for completeness; the Code phase may optionally align the schematic for tidiness.

---

## Summary

All three round-1 findings are correctly and completely resolved, with no regressions and no new issues; the blocking F1 fix is genuine and the example is conformant and now covers every AC5 element. The design meets the bar on completeness, soundness, internal consistency, spec alignment, feasibility, and honesty of caveats. **Approved.**
