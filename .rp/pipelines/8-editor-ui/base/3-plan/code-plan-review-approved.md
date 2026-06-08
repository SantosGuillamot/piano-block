# Code Plan Review — Editor UI for editing the song

**Verdict: approved**

The code plan (`3-plan/code-plan.md`) fully implements the approved spec
(Requirements 1–13, AC1–AC12) and the approved design doc (7 key decisions),
is feasible against the real codebase, and is internally consistent for
sequential single-working-tree execution. No blocking issues found.

## How it was reviewed

The plan was checked adversarially against:
- `1-spec/spec.md` (Req 1–13, AC1–AC12),
- `2-design-doc/design-doc.md` (Approach + 7 Key Decisions),
- the real `src/` and `specs/` codebase (file paths, reuse points, enums,
  bounds, dependency availability, test harness, existing e2e selectors).

## Coverage — complete

Every Requirement and Acceptance Criterion maps to at least one task:

| Req | Tasks | | AC | Tasks |
|-----|-------|---|----|-------|
| 1 | T11, T12, T14 | | AC1 | T11, T12, T14 |
| 2 | T1, T4, T5, T6, T7, T8 | | AC2 | T1, T9, T14 |
| 3 | T1, T3, T5, T6, T7, T8 | | AC3 | T4, T5, T6, T7, T8 |
| 4 | T1, T4, T7, T9, T13 | | AC4 | T1, T3, T5, T6, T7, T8, T14 |
| 5 | T10, T11 | | AC5 | T1, T4, T7, T9, T13 |
| 6 | T2, T6 | | AC6 | T10, T11, T14 |
| 7 | T9, T12, T14 | | AC7 | T9, T12, T14 |
| 8 | T9, T12 | | AC8 | T9, T14 |
| 9 | T9, T14 | | AC9 | T1, T2, T6, T14 |
| 10 | T12 | | AC10 | T10, T15 |
| 11 | T2, T6 | | AC11 | T12, T14 |
| 12 | T10, T15 | | AC12 | T15 |
| 13 | T15 (+ T10 boundary) | | | |

## Traceability — sound

Every task carries Goal / Files / Changes / Depends on / Traces to /
Acceptance. Spot-checked "Traces to" references are correct, e.g. T2 → Req 6,11
/ AC9; T9 → Req 4,7,8,9 / AC2,AC5,AC7,AC8; T10 → Req 5,12,13 / AC6,AC10;
T12 → Req 1,7,8,10 / AC1,AC7,AC11; T13 → Req 4 / AC5.

## Feasibility & correctness — verified against the codebase

- **File paths real.** All reused modules exist: `src/song/validate.js`
  (`validateSong`), `src/song/normalizeStep.js` (`isNoteName`/`normalizeStep`),
  `src/song/schema.js`, `src/notation/layout.js`, `src/notation/svg.js`,
  `src/notation/constants.js`, `src/notation/glyphs.js`, `src/edit.js`,
  `src/style.scss`, `specs/editor.spec.js`.
- **Reuse signatures match.** `buildLayoutModel(song, availableWidthInSp)`,
  `renderInto(container, model, options)` with `{ accessibleName }`,
  `SP_PX = 8` (constants.js), `MUSIC_FONT_FAMILY = "PB Music"` (glyphs.js).
  `view.js`'s glue the preview duplicates (`NARROW_CONTAINER_PX = 480`,
  `NARROW_SP_PX = 7`, `drawWhenFontReady`, `observeResize`) is reproduced
  faithfully; `accessibleNameFor` lives only in `view.js`, so deriving the
  preview name internally (T10/T12) is the correct boundary-honoring choice.
- **Enums & bounds exact.** Every plan vocabulary
  (DURATIONS, BEAT_TYPES `[1,2,4,8,16,32]`, CLEFS, DYNAMICS, BARLINES,
  EVENT_TYPES, SPAN_STATES, PLACEMENTS, STAVES) and every numeric bound
  (`beats ≥1`, `octave 0–9`, `alter`/`alters` −2..+2, `octaveShift` −2..+2,
  `dots 0–2`, `bpm > 0`) matches `schema.js` verbatim. The note invariant
  (a `note` requires non-empty `pitches`) and the `tempo.bpm > 0` walker rule
  are correctly reflected in the factories, the note/rest switch rule, and the
  `canRemove={pitches.length > 1}` guard.
- **Dependency order valid.** The declared execution order
  `T1, T2, T3, T13, T4, T5, T6, T7, T8, T10, T9, T11, T12, T14, T15` is a
  correct topological sort: every task's `Depends on` precedes it, and all 15
  tasks appear exactly once.
- **WordPress-only deps.** Only `@wordpress/*` imports; nothing added to
  `package.json`; the `__experimentalNumberControl as NumberControl` import
  form is correct.
- **Test harness feasible.** Component unit tests under
  `src/editor/__tests__/` run on the `@wordpress/scripts` v32 Jest preset,
  which defaults to the jsdom environment and provides the JSX transform and
  React Testing Library — the same harness the existing jsdom DOM test
  (`src/notation/__tests__/svg.test.js`) already relies on without a per-file
  env pragma. (`node_modules` is simply not yet installed in this fresh
  worktree; `npm install` precedes the code phase.) The plan also provides a
  correct fallback ("if no RTL, use `container.querySelectorAll`/`.click()`").

## Design honored

String as the single source of truth (no parsed object as separate state);
on-canvas visual editor (default) + adjacent read-only preview + JSON toggle,
never both at once; drill-down (song → section → measure → event) with in-place
measure event editing; add/remove/move-up/move-down **buttons**, no
drag-and-drop; conformant-by-construction controls **plus** the serialize-time
`validateSong` guard (T13, routed through `SongEditor`); per-song note-name
system inferred on load with verbatim preservation of untouched `step`
spellings and rewrite only on edit; preview reuses the notation core **without
modifying `view.js`**; strict editor-only boundary — `render.php`,
`block.json`, `src/song/schema.js`, and `src/notation/**` are untouched
(enforced by the T15 boundary audit).

## Testing — adequate

Each behavioral task names its unit and/or e2e coverage. The existing
raw-field e2e tests (label "Song (JSON)", `.is-error` notice) are explicitly
accounted for: T12 preserves the label/help/notice and error behavior verbatim
in JSON mode, and T14 routes the existing four tests through a new
`switchToJsonMode` step, keeping their selectors, while adding visual-default,
start-from-scratch, visual-edit-reflected, invalid→JSON routing, live-preview,
and Spanish round-trip tests.

## Scope discipline

No out-of-scope work (no audio playback, no schema/format change, no
server/front-end render change, no timing validation, no best-effort partial
loading). The only files modified are `src/edit.js`, `src/style.scss`, and
`specs/editor.spec.js`; everything else is additive under `src/editor/`. The
no-pipeline-reference rule (AGENTS.md) is stated as a guiding invariant,
reinforced in T14, and enforced by the T15 grep audit (which also scrubs the
existing `AC#`/`design §` references already present in `specs/editor.spec.js`).

## Non-blocking observations (for the code phase, not rejection-worthy)

1. **Optional `standaloneAnnotation.beat`** (a `number ≥ 0` horizontal-position
   hint) is not given an editing control. It is not enumerated in spec Req 2's
   coverage list and is permissively ignored when absent, so omitting it is
   within spec; a code-writer may add a `NumberControl` for it if convenient,
   but it is not required.
2. **T4 file layout** leaves a small choice ("`ContextEditor.js` may contain
   `HandConfigEditor` or its own file — prefer the separate file"). It resolves
   to the separate-file form and lists `HandConfigEditor.js` in Files, so this
   is unambiguous in practice.
3. **T7 note→rest rule** drops `pitches` and keeps event `annotations`; both are
   schema-conformant on a rest (the `if/then` only constrains `type === "note"`).
   Correct.

These do not affect conformance, coverage, or the boundary, so the plan is
approved as written.
