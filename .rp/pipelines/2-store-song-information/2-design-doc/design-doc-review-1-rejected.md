# Design Doc Review — REJECTED

**Verdict: REJECTED** (round 1).

Reviewer: `design-doc-reviewer` (adversarial, single-task). Subject: `2-design-doc/design-doc.md` at the **current committed `c7a82bc`** (re-reviewed; the file advanced from `ec4b33e` → `c7a82bc` while this review was in progress), against the authoritative spec `1-spec/spec.md` (requirements 1–14, AC1–AC10, Out-of-Scope) and the settled `2-design-doc/design-doc-research.md`, with feasibility grounded in the issue-#1 scaffold (`src/block.json`, `src/edit.js`, `src/index.js`, `src/render.php`, `piano-block.php`).

**Re-review note (`ec4b33e` → `c7a82bc`).** I diffed the two commits. `c7a82bc` ("Cite WordPress docs for now-confirmed claims") is a **citation/verification-status pass only**: it added `[[n]]` footnotes to existing claims in §6.1 / §6.3 / §8, updated the AC1 traceability row, and restructured §12 into §12.1 (doc-backed, cited) / §12.2 (genuine runtime gaps: AC1 round-trip, AC3 empty, AC8 XSS, installed-version prop signatures) plus a new §13 References. I reviewed that new content adversarially and it **passes** — see "New §12/§13 + citations" below. Crucially, the pass **did not touch §7 (the schema) or §9 (the example)**, so all three findings from my original pass **persist verbatim in `c7a82bc`** (line numbers below are against the current file and have been re-verified).

The design is, on the whole, strong: the data model is sound and internally consistent, every requirement and acceptance criterion is mapped, the WordPress mechanics are feasible on the scaffold with zero runtime dependencies, settled decisions are not re-opened, there is no scope creep, and the runtime claims are now split honestly into doc-backed (cited) vs Code-phase-runtime (AC1 round-trip, AC3 empty, AC8 XSS, installed `@wordpress/components` prop signatures) — neither overstated nor understated.

It is rejected for **one genuine, blocking defect** — the AC5 worked example contradicts its own annotations and fails to demonstrate a spec-named element — plus **two minor cleanups** that should be fixed in the same revision. Details below, each tied to a section and requirement/AC.

---

## Blocking finding

### F1 — The §9 worked example does NOT demonstrate a mid-song **clef** change, yet its annotations claim it does (§9; AC5, Req 4.6)

§9 is explicitly the AC5 proof: its preamble (line 467) says the song "exercises **every** required element," and the traceability table (line 618) maps **AC5 → §9**. AC5 names, verbatim, "mid-song tempo / **clef** / time-signature / accidental changes." Req 4.6 likewise requires representing "mid-song changes to tempo, **clef**, time signature, …".

But in the example, **neither hand ever changes clef**:

- `defaults.rightHand.clef` = `"treble"` (line 480); Section 2's `rightHand.clef` = `"treble"` (line 542) — **identical, not a change**.
- `defaults.leftHand.clef` = `"bass"` (line 481); Section 2's `leftHand` sets only `alters` and inherits `clef` = `"bass"` (lines 546–548) — **not a change**.

Despite this, the example asserts a clef change in two places:

- Line 535 (Section 2 header comment): "MID-SONG CHANGES: new tempo, time signature, **clef**, alters, and a right-hand octave shift."
- Line 572 (the AC5 mapping summary): "mid-song tempo / **clef** / time-signature / accidental changes (Section 2)."

Both statements are **false for the data shown** (treble→treble is not a change; the left hand's clef is merely inherited). This is not a stylistic nit — it is (a) a factual contradiction between the document's prose/annotations and its own data, and (b) a real coverage gap in the single artifact the doc designates as the AC5 demonstration: the element "mid-song clef change" is claimed-but-not-exercised.

To be fair to the design: the clef-change **capability is correctly designed and described** elsewhere — §3.1 (line 88) gives "change only the right-hand clef at bar 9" as a new section with `rightHand: { "clef": "bass" }`, and the per-field inheritance/override semantics (§4.1) fully support it. So the *data model* satisfies Req 4.6. The defect is confined to the §9 example and its annotations failing to actually show the clef change they claim.

**Required fix (either is acceptable):**
1. Amend the example so one hand genuinely changes clef mid-song — e.g. give Section 2 a real `leftHand.clef` change such as `"bass"` → `"tenor"` (or change the right hand `"treble"` → `"bass"`), and update the inline annotation and any sounding-octave/notes commentary accordingly so the example *demonstrates* the clef change it advertises; **or**
2. If the example is intentionally left without a clef change, correct lines 535 and 572 so they no longer claim a mid-song clef change, AND add a short note in §9 explicitly pointing to §3.1's clef-change mechanism as the AC5 "mid-song clef change" coverage (so AC5's clef element is still demonstrably addressed somewhere the traceability table can point to).

Option 1 is preferred, since §9's stated purpose is to exercise *every* required element in one song and AC5 reads most cleanly when one song shows them all.

Note: I verified the rest of the example is accurate and schema-conformant — every other Section-2 annotation (tempo 120→90, time 4/4→3/4, octaveShift `+1` with `octave 5 → sounds 6`, `C#6 → sounds 7`, `alters` add/clear, dotted-half = 3 beats) checks out, and the whole document parses against the §7 schema. F1 is the only substantive defect.

---

## Minor findings (fix in the same revision; not independently blocking)

### F2 — §7 schema example uses keywords outside its own declared subset, in a draft-mismatched form (§7; Req 8)

§7 (line 317; echoed at line 286) declares the schema-as-data uses **only**: "`type`, `required`, `properties`, `items`, `enum`, `$ref`/`$defs`, integer `minimum`/`maximum`, … permissive `additionalProperties`, and one `if/then`." The §1 framing also calls this "a JSON-Schema subset (draft 2020-12)"-style definition. But the literal schema then uses two keywords not in that declared subset:

- **`exclusiveMinimum: true`** on `tempo.bpm` (line 380). This is the **draft-04 boolean** form; in draft 2020-12 `exclusiveMinimum` is a **number** (`"exclusiveMinimum": 0`), and the keyword is not in the declared subset at all. The intent ("bpm > 0") is stated unambiguously in prose (lines 113, 294, 380-comment) and in D1.7, so this is purely a notation defect in the illustrative schema.
- **`const`** inside the event `if` (line 419: `"type": { "const": "note" }`). `const` is not in the declared keyword list (only `if/then` and `enum` are).

Because the schema-as-data is positioned as the **single source of truth** and "canonical, machine-checkable definition," the illustrative object and its declared keyword list should agree. The doc does say (line 316) "the Code phase finalizes the literal object placed in `src/`," which softens this — but the writer should still make the example self-consistent so the Code phase inherits an unambiguous canonical schema.

**Fix:** reconcile the schema with its declared subset — e.g. express the strict lower bound on `bpm` via the walker (consistent with how `alters`/note-name checks are already delegated to the walker in lines 438–442) or update the declared-keyword list to include the keywords actually used and use the draft-2020-12 numeric `exclusiveMinimum`; and add `const` to the declared list (it is used by the one `if/then`). Whichever route, the schema example and the surrounding "uses only these keywords" sentence must match.

### F3 — Prose vs illustrative-code variance for the empty read in `render.php` (§8; Req 12, AC3 — cosmetic)

§8 line 450 prose says read the value as `$attributes['song'] ?? ''`, while the illustrative code (line 457) uses `isset( $attributes['song'] ) ? (string) $attributes['song'] : ''`. Both are correct and PHP 7.4-safe, and the doc states the Code phase finalizes the exact form, so this is **cosmetic only** — flagged for tidiness, not blocking. (The `(string)` cast in the code form is the more defensive of the two; if kept, the prose could mention it.)

---

## What I checked and found sound (no action needed)

- **Data model consistency.** `{ metadata?, defaults?, sections }`; `sections[]` → `measures[]` pairing `rightHand[] ∥ leftHand[]`; `event` (`type`+`duration` required, `dots` 0..2, `pitches`, `dynamic`/`chordSymbol`/`tie`/`slur`); `pitch` (`step`+`octave` required, `alter` −2..+2); `handConfig` = `clef` + `alters` + `octaveShift`. Inheritance (per-field shallow merge) and the `alters`-replaces-wholesale rule are coherent and well-justified. The one data-model conditional (`note` → non-empty `pitches`) is consistently stated.
- **Validation approach.** Structural/field only; valid-JSON-first; closed value enums (durations, clefs, dynamics, barlines, tie/slur, `type`, `beatType`); integer ranges; note names case-insensitive; unknown object properties ignored; **no** musical-timing checks (AC10). The two walker-handled special cases (note-name vocabulary, `alters` key/value) are honestly disclosed (lines 438–442). Zero third-party validator (no `ajv`) — consistent with Req 2 and the scaffold's zero-runtime-dependency posture.
- **Attribute typing.** `song`: `type: "string"`, `default: ""`, no `source`; unconditional raw storage; empty string as the "no song" sentinel; validation only on non-empty input. Correctly forced by AC6 and backed by the WP-docs citations in the research (Topic 4).
- **`render.php`.** Verbatim passthrough; `esc_html($song)` inside `<pre>`; `get_block_wrapper_attributes()` echoed directly (matching the scaffold's existing `render.php` convention); nothing emitted when empty/whitespace-only; no render-time validation. Sound for Req 11/12/13 and AC7/AC8.
- **Completeness & alignment.** Every Req (1–14) and AC (1–10) is addressed and traceable (§11); design-deferred items (attribute typing, octave-shift range, note-name case, render formatting + wrapping element) are all resolved; no settled decision re-opened; no out-of-scope creep (no audio behavior, no notation rendering, no version field, no innerBlocks).
- **New §12/§13 + citations (the `c7a82bc` change) — reviewed and sound.** I checked the citation pass adversarially:
  - **Footnote integrity.** All five `[[n]]` links resolve to the `<a id="refs"></a>` anchor under §13; every number maps to the correct source — `[[1]]`→Block Attributes handbook (used in §6.1, lines 254/258/266), `[[2]]`→`TextareaControl` (§6.3, line 307), `[[3]]`→`Notice` (§6.3, line 308), `[[4]]`→`get_block_wrapper_attributes()` (§8, line 449), `[[5]]`→`esc_html()` (§8, line 448). No dangling or mismatched citations. (Footnotes appear in non-numeric order in the prose, e.g. `[[5]]` before `[[4]]` in §8 — purely cosmetic, since §13 is ordered by topic, not first-appearance; not a defect.)
  - **Claims match sources.** The verbatim handbook quotes in §6.1 and the `esc_html` / `get_block_wrapper_attributes` characterizations in §8 faithfully match the research doc's cited findings (research Topics 4 and 6); nothing is overstated relative to what the cited pages support.
  - **§12.1 vs §12.2 split is well-calibrated.** §12.1 correctly claims only the *API contracts* (string-as-JSON-intermediary, no-`source`→delimiter, `default` semantics, `esc_html` encoding, `get_block_wrapper_attributes` pre-escaping, component names/props) as doc-backed; §12.2 correctly keeps the *realized end-to-end behavior in this plugin* (AC1 round-trip, AC3 empty, AC8 XSS payload) and the installed-version prop-signature check as genuine Code-phase items. The phrasing ("the *mechanism* is doc-backed; the *realized* round-trip/escaping is what AC1/AC8 verifies") is honest and does not conflate documented contract with runtime proof. This is an improvement over the prior §12 on the honesty-of-caveats dimension and introduces no new inconsistency (the AC1 traceability row, line 616, was updated to match).

---

## Summary

Re-reviewed against the current committed `c7a82bc`. The intervening citation pass (§12 split + §13 References + footnotes) is sound and changes nothing about the findings, because it did not touch §7 or §9. Fix **F1** (the blocking AC5/Req-4.6 clef-change defect in §9 — make the example actually demonstrate a mid-song clef change, e.g. left hand `bass`→`tenor`, or correct the false annotations at lines 535/572 and point AC5's clef element at §3.1). Address **F2** (schema/declared-subset self-consistency: `exclusiveMinimum: true` and `const` vs the line-317 keyword list) and optionally **F3** (cosmetic) in the same pass. The new §12/§13 content needs no changes. With F1 resolved the design will meet the bar; the architecture, data model, validation, attribute typing, render decisions, and now the citation/verification-status presentation are otherwise sound, complete, feasible, and well-aligned with the spec.
