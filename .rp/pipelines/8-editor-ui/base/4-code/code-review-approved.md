# Code Review — Editor UI for editing the song (batch T1–T15)

## Verdict

**APPROVED.**

The full code plan (T1–T15) is implemented, builds, passes the entire unit
suite, is formatting-clean, holds the editor-only boundary, adds no
dependencies, and contains no pipeline references in shipped code or specs. Every
task's acceptance criteria are met by tests that genuinely exercise the behavior
(real React `act`/`createRoot` rendering driving the controls, validator
cross-checks, and conformance assertions). The e2e spec is well-formed and
internally consistent with the shipped UI.

## Batch scope

All fifteen plan tasks, diffed against the clean Plan-phase tip `0a02a69`
(`0a02a69..HEAD`, 15 code-writer commits). Files: the new `src/editor/**` module
group (helpers, controls, structural editors, root, preview, states), the
refactored `src/edit.js` mode container, `src/style.scss` editor styles, the
updated `specs/editor.spec.js`, `jest.config.js`, and the `test/mocks/**`
WordPress-package stand-ins.

## Summary

The implementation faithfully realizes the approved design: the `song` string is
the single source of truth (parse-when-conformant → edit working object →
`JSON.stringify` → `setAttributes`, with no parsed object held as React state);
`edit.js` is a thin mode container with a `BlockControls` toggle, visual default,
and the original raw-JSON field preserved verbatim behind it; the visual editor
branches empty/invalid/conformant; the structured editor drills down
song→section→measure→event with a breadcrumb; every field maps to a constrained
control so non-conformant output is unreachable, backstopped by a serialize-time
`validateSong` guard; the per-song note-name system is inferred and preserved
(untouched pitches keep their spelling verbatim); and the live preview reuses the
pure notation core with its own thin glue, never importing `view.js`.

## Checks

| Check | Command | Result |
| --- | --- | --- |
| Build | `npm run build` | PASS — webpack compiled successfully (index.js + view.js emitted, SCSS compiled) |
| Unit tests | `npm run test:unit` | PASS — 18 suites, 539 tests, 0 failures |
| Lint/format | `npm run check` | PASS — Biome checked 64 files, no fixes applied |
| E2E (spec well-formedness; Docker run deliberately skipped per shared-host caveat) | `npx playwright test --config=playwright.config.js --list specs/editor.spec.js` | PASS — spec parses and enumerates 11 editor tests |
| Boundary audit | `git diff --name-only 0a02a69..HEAD -- src/view.js src/render.php src/block.json src/song/schema.js 'src/notation/**'` | EMPTY (no protected file changed) |
| Dependency audit | `git diff 0a02a69..HEAD -- package.json` | EMPTY (no dependency added) |
| Pipeline-reference audit | grep `\.rp/`, `AC#`, `Req#`, `design §`, `T#` across files changed by this batch in `src/`/`specs/` | NONE (pre-existing AC refs in `svg.test.js`/`render.spec.js` are outside this batch and untouched) |
| Editor import audit | grep imports across `src/editor/**` + `src/edit.js` | only `@wordpress/*` and local `src/` modules (no third-party) |
| Test hygiene | grep `.only`/`.skip`/`xit`/`fdescribe`; `TODO`/`FIXME` | NONE |

E2E note: the full Docker e2e was not run here (wp-env ports 8888/8889 are held by
another worktree — a shared-host limitation, not a code defect, and the plan
treats the Docker run as environment-dependent). The spec was judged on
correctness and consistency with the T12 UI plus the jsdom unit coverage of the
same behaviors. Its selectors match the shipped UI exactly: the `Start a new
song` empty-state button, the `Title` structured field, the `Edit as
JSON`/`Visual editor` toolbar buttons (`editor.clickBlockToolbarButton`), the
`.wp-block-piano-block-piano__preview` container, the `Song (JSON)` label, and
the `.components-notice.is-error` notice — all of which the implementation
produces.

## Behavior verification (per task)

- **T1 (songModel):** Option lists and numeric bounds match `schema.js` exactly;
  the test cross-checks every enum/range against `songSchema` and asserts each
  factory composed into a song is accepted by the real `validateSong`. Array
  helpers are pure with no-op/out-of-range edges. Verified `STAVES` values
  (`rightHand`/`leftHand`) match the `standaloneAnnotation.staff` enum.
- **T2 (noteNames):** Reuses `normalizeStep`/`isNoteName` (no vocabulary
  redefinition); infers spanish/english/no-pitches correctly; `noteNameOptions`
  yields exact ordered values that all satisfy `isNoteName`; `stepInSystem`
  round-trips and is idempotent, with documented fallback.
- **T3 (ListControls/AddButton):** Move-up disabled at index 0, move-down at the
  last index, remove disabled when `!canRemove`; each enabled handler fires
  exactly once; label overrides honored; AddButton separate and enabled.
- **T13 (serializeSong):** `serializeSong(newSong())` validates clean; the guard
  persists a conformant object and refuses + `console.warn`s a note with empty
  `pitches`, never calling `onChangeSong`.
- **T4 (metadata/context/hand):** Empty metadata fields drop their keys; `tempo`
  emitted only with `bpm` (and dropped when cleared) via a local draft so
  half-filled values survive between edits; `timeSignature` emitted only when
  both `beats` and `beatType` are set; exactly the four clefs; out-of-range
  octaveShift unreachable; `alters` add/remove/drop with recognised note keys and
  duplicate-key collapse. Every fragment validates wrapped in a song.
- **T5 (annotations):** Event annotation keeps `text`+`placement`; standalone
  also keeps `staff`; empty `text` retained as a conformant empty string; the
  list emits `undefined` (not `[]`) when emptied; reorder and in-place edit work.
- **T6 (pitches):** Spanish list offers `do…si`; editing a step writes the system
  spelling (`G`→`sol`); an untouched cross-system step shows selected (by
  canonical letter) WITHOUT rewriting (`calls` length 0) — the AC9 round-trip;
  octave/alter clamp; `alter: 0` omitted; last pitch's remove disabled.
- **T7 (events):** note→rest drops `pitches`, rest→note seeds exactly one pitch
  (in the per-song system); `dots`/`dynamic`/the four spans omit-when-unset and
  set only to enum values; `type`+`duration` always present; annotations survive
  a type switch; drill-in fires; `EventEditor` shows `PitchList` only for a note
  plus an event `AnnotationList`.
- **T8 (structure):** Section/measure add/remove/reorder update the arrays; a
  section always keeps `measures`; overrides do not leak `measures`; barline
  set/omit; SongOverview emits `metadata`/`defaults` only when set; breadcrumb is
  pure; representative edits validate.
- **T10 (SongPreview):** Mounts `<svg role="img">` for a conformant song; leaves
  the container empty for empty/invalid/non-conformant; re-renders on a changed
  `song`; clears on invalid; reflects `accessibleName` on the SVG `<title>`;
  tolerates 0 width. Glue (px→sp rule, `NARROW_CONTAINER_PX`/`NARROW_SP_PX`, font
  gate, rAF-debounced one-way `ResizeObserver`) mirrors `view.js` and does not
  import it. The test does not reference `view.js`.
- **T9 (SongEditor):** Empty→EmptyState seeds a conformant song; non-empty
  invalid→InvalidState with the validator message and a working JSON switch;
  conformant→structured editor reflecting `metadata.title`; an edit re-serializes
  a conformant string; breadcrumb grows on drill-in and walks back; the open path
  is repaired when an opened section is removed. Edits route through `commitSong`.
- **T11 (styles):** Scoped under `.wp-block-piano-block-piano`, BEM-ish names,
  `@font-face` untouched, preview column has a min-width so `clientWidth` is
  non-zero; SCSS compiles and Biome is clean.
- **T12 (Edit mode container):** Visual default (structured editor present, no
  `Song (JSON)` textarea); toolbar toggle both directions; JSON mode renders the
  raw field with the EXACT original label/help/`rows`/className, raw verbatim
  persistence even when invalid, and the non-blocking `errors[0]` error notice —
  matching the base `edit.js` behavior precisely; live preview alongside the
  visual editor with a metadata-derived accessible name; the InvalidState JSON
  switch sets JSON mode. `mode` is local UI state, not persisted.
- **T14 (e2e):** `switchToJsonMode`/`switchToVisualMode` helpers added; the
  pre-existing raw-field tests now enter JSON mode first; new tests cover
  visual-default, start-from-scratch, visual-edit-reflected, invalid-routes-to-
  JSON, live-preview SVG, and Spanish-note-name round-trip (`do` stays `do` after
  an unrelated title edit). Descriptions carry no AC/pipeline references.
- **T15 (integration):** Build/test/format gates pass; the boundary, dependency,
  and pipeline-reference audits are all clean.

## Issues

None blocking. Minor, non-blocking observations (no action required for
approval):

1. **(T11) Some SCSS classes are defined but not emitted by the components**
   (`__mode-toggle`, `__breadcrumb`, `__panel`, `__list-row`). The components use
   bare elements; only `__visual`, `__editor`, `__preview`, and `__song-input`
   are actually rendered. This is cosmetic dead CSS, and the SCSS comment itself
   acknowledges which classes are emitted. T11's acceptance is only build/lint.

2. **(T4) `HandConfigEditor` uses local `replaceRow`/`moveRow` helpers** instead
   of the T1 `replaceAt`/`moveItem` array helpers the plan suggested for lists.
   The local helpers are correct, pure, and well-documented; this is a stylistic
   deviation, not a defect.

3. **(T4) `ContextEditor` seeds the tempo/timeSignature drafts once via
   `useState` initializers** from the incoming context. If the same
   `ContextEditor` instance were re-fed a different `context` prop WITHOUT
   remounting, the half-filled drafts could be stale. In the shipped flow each
   level is a fresh instance per navigation and the controlled values still flow
   from the song, so this is not reachable as a bug today; noted only as a
   latent fragility if the component is reused differently later.
