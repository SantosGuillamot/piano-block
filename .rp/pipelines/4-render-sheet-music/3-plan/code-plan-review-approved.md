# Code Plan Review — APPROVED

**Pipeline:** 4-render-sheet-music (issue #4 — render the Piano block's song as
visual sheet music, grand staff)
**Artifact reviewed:** `3-plan/code-plan.md`
**Verdict:** **APPROVED**
**Reviewer:** code-plan-reviewer (adversarial)

---

## Rationale

The plan is complete, faithful to the approved design, and implementable by a
fresh code-writer per task. I reviewed it adversarially against the spec (12
ACs), the design doc, and the actual codebase (`src/`, `src/song/`, `specs/`,
`block.json`, `render.php`, `piano-block.php`, `package.json`,
`docs/song-format.md`). No real problems rise to the level of rejection.

### 1. Completeness — the task set covers the entire design and traces to all 12 ACs

- **AC→task table is accurate.** I re-derived every row from the task bodies: no
  AC is silently unmapped, and no task traces to an AC it does not actually
  implement. AC1→T6/7/8/9/10/11; AC2→T3/4/6/7(+T11); AC3→T4; AC4→T6; AC5→T5/6/8/11;
  AC6→T8/9/11; AC7→T8/9/11; AC8→T4/5; AC9→T5/6; AC10→T3–T10; AC11→negative+T11;
  AC12→T7/8/9/11. All twelve are covered and each tracing is genuine.
- **Every load-bearing design element has a concrete task:** shared
  `normalizeStep()` (T1); pure layout layers — pitch→Y/ledgers/durations/
  beaming/chords/accidental precedence (T4), union-grid alignment + compressive
  spacing that never consults `timeSignature` (T5), section resolve+diff /
  wrapping+justify / ties+slurs / texts / barlines / ottava / measure numbers
  (T6); SVG emit with `role="img"` + first-child `<title>` via `textContent` and
  text safety (T7); `view.js` with the `validateSong` gate, three display states,
  `document.fonts.ready` gating, and a one-way rAF-debounced `ResizeObserver`
  (T8); the renamed Bravura `.woff2` + `OFL.txt` + `@font-face` (T9); the
  `render.php` `<pre>`→container + inert JSON `<script>` rewrite with the valid
  six-char `<` escape (T9); the `block.json` `viewScript` with no
  `package.json` change (T10); unit tests for the pure layers (T4–T6) and e2e for
  the three states / responsive / injection with `render.spec.js` rewritten and
  `editor.spec.js` left unchanged (T11).

### 2. Fidelity — verified against the codebase, no scope creep

- **The `<` transport escape is correct — empirically verified.** I ran the
  exact transform (`song.replace(/</g, "\\u003C")`) on a song whose
  `metadata.title` is `</script><!--`: the escaped output contains neither a
  literal `</script>` nor `<!--` (HTML breakout neutralized), and `JSON.parse`
  decodes back to the exact author bytes. The plan correctly forbids `esc_html`
  (raw-text `<script>` does not decode entities) and the invalid `<\!--`
  (`\!` is not a JSON escape and would throw on a conformant `<!--`-bearing song).
- **`render.php`'s empty early return is preserved verbatim** (`if ( '' === trim(
  $song ) ) return;` → no container), matching the current file; PHP still does no
  validation. AC6/AC7 ownership stays in `view.js`.
- **`normalizeStep` extraction (T1) provably causes zero validation drift.** The
  current `isNoteName` is `typeof key === "string" && NOTE_NAMES.has(
  key.toLowerCase())`; T1 reproduces that exactly and reuses it in the same spots
  (`checkStep`, `checkAlters`). Requiring the unchanged `validate.test.js` /
  `schema.test.js` to still pass is the correct regression gate.
- **The no-`timeSignature`-for-layout rule is enforced structurally** in T5 (onsets
  and widths come purely from event durations; NaN-safe via `sqrt(max(Δ,0))`,
  empty-grid short-circuit, `measureEnd = max(handEnds,0)`), which is exactly what
  makes AC8 and AC9 fall out. T6 limits `timeSignature` to the time-sig glyph and
  beam grouping only.
- **Accidental resolution keys `alters` through `normalizeStep`** (`normAlters[
  letter]`, T4), correctly handling Spanish / mixed-case `alters` keys against the
  canonical letter — the subtle correctness point the design called out.
- **No music-notation library; no editor changes; no format/validator/schema/
  `docs/song-format.md` changes; no `package.json` change.** The do-not-touch list
  is restated for code-writers and the constraints section is explicit.
- **The accessible-name fixture lines up.** `COMPREHENSIVE_SONG` in
  `validate.test.js` carries `metadata.title = "Example"`, `composer =
  "A. Composer"`, so T11's asserted accessible name "Example by A. Composer" is
  consistent with the §7 template.

### 3. Task quality — each block is self-contained and checkable

Every task carries Goal / Files / Changes / Depends on / Traces to / Acceptance,
with stable IDs (T1–T11) and Acceptance clauses that include concrete tests
(`npm run test:unit`, `npm run check`, and from T9 onward `npm run build` /
`npm run test:e2e`). The pure-layer tasks name the individually-exported functions
to test and enumerate the verified fixtures (the §5.2 pitch cases, the AC8/AC9
battery, the §6.6 two-section diff, tie/slur dangling safety). A fresh code-writer
can implement each from its block + the spec + the design alone.

### 4. Sequencing — acyclic and green where it matters

Foundations (T1 helper, T2 constants, T3 glyph map) → pure layout (T4→T5→T6, each
extending `layout.js` with its own passing unit tests) → emit (T7) → entry (T8) →
font asset + PHP transport + i18n loader (T9) → `block.json` `viewScript` (T10) →
test rewrite (T11). Dependencies are correct and acyclic on a single shared
working tree with a commit between tasks. The plan is explicit and honest that the
frontend is only fully wired (and therefore the build only fully green end-to-end)
at T9/T10, with intermediate modules and their unit tests green independently —
an intentional, clearly-noted window, not a broken-build hazard that blocks later
verification. T11's e2e correctly depends on T8/T9/T10.

### 5. Font-subsetting operational risk — handled acceptably

T9 explicitly permits committing a renamed full `Bravura.woff2` (under the new
family + `OFL.txt`) as a deterministic fallback if subsetting cannot run inside
the JS build, with size framed as a nicety and the rename-off-the-Reserved-Font-
Name + OFL + no-library posture as the hard requirements. T7's hand-drawn skeleton
(staves, stems, beams, ties, ledgers, barlines, noteheads, dots) renders even if
the font fails to load. The codepoints in T3 are required to match whatever font
ships. This is a sound risk treatment.

---

## Minor, non-blocking observations (no action required)

1. **WP toolchain claims could not be re-run empirically** because `node_modules`
   is not installed in this worktree. The plan's three relevant assertions — that
   a plain `viewScript` is auto-detected/bundled by the unchanged `wp-scripts
   build`, that an `@font-face url('./notation/pb-music.woff2')` in SCSS makes
   webpack emit the woff2 to `build/`, and that the auto-generated handle is
   `piano-block-piano-view-script` (block name `piano-block/piano` →
   `piano-block-piano` + `-view-script`) — all match documented `@wordpress/scripts`
   / WordPress conventions and are standard. They are verified by the T9/T10
   Acceptance (`npm run build` succeeds and emits the woff2; the viewScript loads),
   so any deviation surfaces at build time rather than silently.
2. **T11 reuse of `COMPREHENSIVE_SONG`** entails transcribing it into the spec file
   (it is a local `const` in `validate.test.js`, not an export, but is fully
   documented in `docs/song-format.md`). The plan says "reuse the fixture," which a
   code-writer satisfies by transcription; this is fine and does not touch the
   song module.

Neither observation is a correctness, completeness, sequencing, or fidelity defect.

---

**Decision: APPROVED.** The plan faithfully implements the approved design,
traces accurately to all 12 acceptance criteria, decomposes into well-formed
self-contained tasks with checkable acceptance, sequences them acyclically with a
clearly-noted build-green window, and treats the one operational risk (font
subsetting) acceptably.
