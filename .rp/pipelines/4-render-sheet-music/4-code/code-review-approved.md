# Phase-4 Code Review — APPROVED

> Issue #4 ("Render the Piano block's song as visual sheet music (grand staff)"),
> pipeline `4-render-sheet-music`. Full batch T1–T11, rejection iteration N=1.
> Reviewed `git diff trunk...HEAD` (product code only: `src/**`, `specs/**`,
> `piano-block.php`, the font assets) at HEAD `5f9348b`.

## Verdict: APPROVED

The implementation is faithful to the design and code plan, every hard constraint
holds, all 12 acceptance criteria are satisfied and exercised by genuinely-assertive
tests, and the three test suites pass independently.

## Real test results (run independently in the worktree)

| Suite | Command | Result |
|-------|---------|--------|
| Unit | `npm run test:unit` | **199 passed**, 5 suites (`layout`, `svg`, `validate`, `normalizeStep`, `schema`), exit 0 |
| E2E | `npm run test:e2e` | **11 passed** (5 editor + 6 render), 21.9s, exit 0 |
| Lint/format | `npm run check` (Biome) | **clean**, 22 files, no fixes applied, exit 0 |
| Build | `npm run build` | **green**; emits `view.js` + `build/fonts/pb-music.*.woff2` |

wp-env was up (Docker containers running); e2e ran directly against the tests site
after `npm run build`.

## Per-task verification (T1–T11)

- **T1 — `normalizeStep` extraction.** `src/song/normalizeStep.js` exports `NOTE_NAMES`,
  `isNoteName`, `normalizeStep` with the 14-token English/Spanish vocabulary backing a
  token→canonical-letter map. `validate.js` imports `isNoteName` and holds no inline
  note-name table. Zero validation drift: the pre-existing `validate.test.js` and
  `schema.test.js` pass untouched, plus the new `normalizeStep.test.js`.
- **T2 — constants.** `src/notation/constants.js` is pure data covering sizing, spacing,
  vertical gaps, barlines, text sizes, and the `BASE_DUR`/`DOT_MUL`/`BEAM_COUNT` tables;
  no DOM, no imports, no side effects.
- **T3 — glyph map.** `src/notation/glyphs.js` covers the font half (clefs, 4 ornate
  rests, 5 accidentals indexable by `alter+2`, 6 flags, brace, 6 metronome notes, 10
  time-sig digits) and the hand-drawn skeleton (filled/open noteheads, dot, whole/half
  rests). Codepoints appear ONLY here; one accessor `glyphFor`. `MUSIC_FONT_FAMILY` =
  "PB Music".
- **T4 — core geometry.** Pitch→Y per the §5.2 verified table, ledger lines, duration
  decode, stem direction (single + chord extreme rule, ties→down), chord stacking +
  seconds rule, best-effort beaming (simple/compound, length-1→flag, overflow-safe),
  and the stateless §6.4 accidental precedence — all DOM-free pure functions, placement
  ignores `alter`. Unit tests assert every §5.2 and §6.4 verified case.
- **T5 — union grid + compressive spacing.** `measureLayout` builds the union grid,
  per-onset X, and intrinsic width purely from event durations; `advanceFor` is
  `MIN_ADV + ADV_K·sqrt(max(Δ,0))`. NaN-safe (sqrt clamp, empty-grid short-circuit,
  `measureEnd = max(handEnds, 0)`). The AC8/AC9 battery passes, including a test that
  `measureLayout` is byte-identical across wildly different time signatures (one
  overflowing) — the constraint is verified, not just claimed.
- **T6 — section resolution + wrapping + spans/texts/barlines/ottava + `buildLayoutModel`.**
  Inheritance pre-pass (`alters` replaces wholesale, `octaveShift` defaults 0), diff marks
  only changes, key-sig clusters in conventional order with a per-clef register table,
  ottava as a bracket (no Y move), greedy packing (≥1 measure/system), justify by advance
  stretch only with the over-wide single-measure whole-system downscale, all five barline
  types, sequential measure numbers, stack-based dangling-safe ties/slurs resolved across
  systems. The §6.6 2-section diff fixture, wrapping-at-two-widths, and tie/slur dangling
  tests pass.
- **T7 — SVG emit layer.** `src/notation/svg.js` is layout-math-free: all geometry comes
  from the model; the only decisions are presentation glyph-name lookups. Root
  `<svg role="img">` with a single first-child `<title>` via `textContent` (no
  `aria-label`). All author text via `textContent`/`createElementNS` only — no
  `innerHTML`, no `<script>`/`<foreignObject>`. Per-event elements stamped with stable
  ids / `data-*` (the forward-interactivity hook).
- **T8 — `view.js`.** Thin and DOM-coupled: reads the inert JSON `<script>`, gates on
  the reused `validateSong`, draws SVG only for conformant songs (empty wrapper
  otherwise), computes the §7 accessible name with i18n on the non-author strings, gates
  the first draw on `document.fonts.load`, and reflows via a rAF-debounced one-way
  `ResizeObserver`. No layout math in the file.
- **T9 — font asset + `render.php` + i18n loader.** `pb-music.woff2` is a valid 16 KB
  subsetted woff2 whose `name` table is "PB Music" (no Reserved Font Name "Bravura"),
  and whose cmap contains **all 35 codepoints** the glyph map references (verified with
  fonttools — zero missing). `OFL.txt` (SIL OFL 1.1) ships beside it. `style.scss`
  `@font-face` family matches. `render.php` escapes the breakout `<` correctly (see
  below). `piano-block.php` calls `wp_set_script_translations` on the correct handle
  `piano-block-piano-view-script`.
- **T10 — `block.json`.** `"viewScript": "file:./view.js"` added; `editorScript`/`style`/
  `render` intact; no module/interactivity keys. `package.json` unchanged.
- **T11 — `render.spec.js` rewrite.** Asserts all five behaviors (empty→nothing,
  conformant→`svg[role="img"]` grand staff with the expected accessible name and no raw
  JSON/`<pre>`, non-renderable→no SVG, responsive→system count grows when narrowed,
  injection→inert + still renders). No `<pre>` assertions remain. `specs/editor.spec.js`
  is byte-for-byte unchanged (0-line diff vs trunk).

## Hard-constraint checks

- **No third-party music-notation library.** `package.json` has **zero runtime
  dependencies**; grep for vexflow/abcjs/osmd/verovio across `package.json` +
  `package-lock.json` returns nothing. The engine is the project's own code; the font
  is an OFL asset (renamed off the Reserved Font Name). AC10 holds.
- **Layout never uses `timeSignature` for positions/widths.** Audited every
  `timeSignature`/`beats`/`beatType` reference in `layout.js`: all are confined to
  `beatGroupLength`/`beamGroups` (beam grouping only) and to section resolution/diff that
  decides whether to *draw* the time-sig glyph. No onset/advance/column-X is derived from
  the meter. The byte-identical-across-time-signatures unit test confirms it.
- **Do-not-touch files unchanged (byte-for-byte vs trunk):** `docs/song-format.md`,
  `src/edit.js`, `src/index.js`, `package.json`, `package-lock.json`, `webpack.config.js`,
  `src/song/schema.js`, and `specs/editor.spec.js` (AC11) — all show an empty diff.

## Security / transport (the load-bearing `</script>` escape)

`render.php:39` is `str_replace( '<', '<', $song )` — it produces the literal
6-character JSON escape `<` (not a no-op, not `esc_html`, not `<\!--`). The earlier
no-op defect fixed in `eeeb783` is genuinely correct. The injection e2e test publishes a
**conformant** song whose `metadata.title` and `chordSymbol` carry `</script>`, `<!--`,
and `<script>alert()</script>`, then proves end-to-end: (a) no executable `<script>` is
injected and `alert` never fires; (b) the hostile text appears only as inert SVG `<text>`;
(c) the raw server HTML contains `</script>` and `<!--` inside the carrier (not
a literal breakout); and (d) `JSON.parse(payload)` round-trips to the exact author bytes —
the conformant hostile song still renders its notation. The inert
`<script type="application/json" class="wp-block-piano-block-piano__song">` cannot break
out.

## Accessibility

`<svg role="img">` with exactly one accessible name via a first-child `<title>` set with
`textContent` (no `aria-label`). The name is computed in `view.js` per the §7 templates
(title+composer / title / composer / fallback) with `@wordpress/i18n` on the non-author
strings. The e2e suite asserts the accessible name for both the comprehensive song
("Example by A. Composer") and the hostile song.

## Note (non-blocking, latent only)

In `layout.js` `layoutHand`, `positions` is built via `pitches.map(pitchToStaffStep)
.filter(s => s !== null)`, after which `pitches.forEach((p, pi) => positions[pi])` pairs
indices. If `pitchToStaffStep` ever returned `null` for a pitch, the filter would shift
indices and mis-pair a pitch with another pitch's staff position for accidentals. This is
**unreachable for any conformant song** — the render path runs only after `validateSong`
returns `[]`, and the validator rejects any unrecognized `step`, so every pitch resolves.
It is therefore not a correctness defect against the spec's "robust to any conformant
song" bar; recording it only as a latent fragility a future change could expose.

## AC coverage (all 12)

AC1 (SVG grand staff replaces `<pre>`), AC2 (full notational coverage via the
comprehensive fixture + unit primitives), AC3 (pitch placement + accidental precedence,
unit-asserted), AC4 (2-section diff), AC5 (union-grid alignment + responsive wrapping,
unit + e2e), AC6 (empty→nothing), AC7 (non-renderable→nothing), AC8 (unbalanced→best
effort, no throw/NaN), AC9 (one-hand/empty-hand→both staves), AC10 (no library, font
asset), AC11 (editor unchanged, `editor.spec.js` untouched), AC12 (accessible label) —
all satisfied and exercised.
