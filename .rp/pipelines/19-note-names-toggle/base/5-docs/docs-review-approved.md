# Docs Review — Approved

## Verdict

**Approved.** All 7 doc tasks ship accurate, drift-resistant documentation that
matches the merged phase-4 code, covers each task's Acceptance, fits its
audience, and leaves the README internally consistent. No remaining passage
frames the frontend as render-only, every byte-identity claim is scoped to
names-off, and `name` is still correctly documented as frontend-unused.

## Batch scope

- **Tasks reviewed:** Doc Task 1, 2, 3, 4, 5, 6, 7 (all of `doc-plan.md`).
- **Diff range:** `534f800` → current HEAD.
- **Doc commits under review:** `4787edc, e3e1ca8, b75ab1e, de51592, b00ab56,
  6d08c07, d7016cb`.
- **Files touched by docs:** `README.md` (Tasks 1–4), `docs/song-format.md`
  (Task 5), `src/block.json` description/keywords (Task 6),
  `src/song/normalizeStep.js` header (Task 7).
- **Task 7 "asserted already-accurate, left unchanged":** `src/view.js`,
  `src/render.php`, `src/editor/noteNames.js`, `src/song/noteNameSystem.js`
  headers — verified (those headers were authored by phase-4 code commits and
  already reflect the toggle / shared-module roles; none frames the frontend as
  render-only).
- **Not under review:** `.rp/pipelines/**` artifacts; the phase-4 code commits
  (source of truth only).

## Summary

The README's frontend section gains a complete viewer-facing account of the
toggle (Tasks 1–2), the contributor section is updated to the shipped
architecture (Task 3), and every stale render-only / unqualified-byte-identity /
"frontend ignores `language`" passage is repaired (Task 4), including the
"Forthcoming" "what has landed" summary. `docs/song-format.md` now states the
frontend consumes `language` for the optional name display while keeping `name`
frontend-unused (Task 5). `src/block.json` advertises the feature in its
description and keywords without touching structural fields (Task 6). The
`normalizeStep.js` header lists the actual current vocabulary consumers (Task 7).
Descriptions are behavioral — no button label, ARIA attribute, directive name,
context-key name, or function signature is pinned.

## Checks table

| Check | Result | Notes |
| --- | --- | --- |
| Per-task Acceptance coverage | PASS | Each task's Acceptance bullets are met (evidence below). |
| Accuracy vs. shipped code | PASS | Every concrete claim spot-checked against merged source. |
| Drift-resistance (no pinned signatures/attrs/labels) | PASS | Docs describe roles/invariants; no exact label/attr/signature asserted. |
| Audience fit | PASS | Task 1–2 user-facing; Task 3 contributor; Task 5 format-reader; Task 6 inserter; Task 7 contributor headers. |
| Faithful rationale (matches spec/design) | PASS | Single-source vocabulary, one-flag-default-off, per-instance local context all match design Key Decisions 2,3,6. |
| Drift sweep (render-only / byte-identity / `language`) | PASS | No render-only framing remains; byte-identity scoped to names-off; `language` now read on frontend; `name` still unused. |
| Doc-plan adherence / no scope creep | PASS | Only the planned surfaces changed. |
| Deliberately-not-changed surfaces left alone | PASS | `AGENTS.md`, plugin PHP header, `package.json`, pure-layer headers, `name` field section untouched. |
| Internal consistency across README sections | PASS | Tasks 1–4 agree on names-off byte-identity scope and `language` consumption. |
| Convention compliance | PASS | Matches the host README's bolded-term prose and table style; cross-ref anchors resolve. |
| Read-only `npm run lint` | PASS (non-blocking) | One pre-existing warning in a build script (`bin`/scripts unused import), unrelated to any reviewed file. |

## Accuracy spot-check (evidence per task)

- **Doc Task 1 (frontend user coverage).** Claim: default hidden, bare names, no
  accidental, no octave, both hands, every notehead of a chord, rests get none
  (README L86–88). Evidence: `render.php:86` seeds `'showNoteNames' => false`;
  `noteNameSystem.js:110` `stepInSystem` returns a bare step (no alter, no
  octave); design Key Decision 2 + AC3. Matches.

- **Doc Task 2 (a11y, i18n, gating).** Claim: state to AT, translatable label
  under `piano-block`, control only when nameable notes / absent for empty /
  invalid / rests-only (README L91–96). Evidence: `render.php:100`
  `data-wp-bind--aria-pressed="context.showNoteNames"`; `render.php:81`
  `__( 'Show note names', 'piano-block' )`; `view.js:107–116,180` computes
  `hasNameableNotes` (false for rests-only / no notes) which gates
  `data-wp-bind--hidden`. Matches; no ARIA attribute or label string pinned.

- **Doc Task 3 (contributor architecture).** Claim: `render.php` no longer
  childless — SSR button + inner score `<div>` + extra seeded context, still no
  validation/gating (README L240). Evidence: `render.php:97–104` (button + score
  `<div>`), `render.php:83–90` (`showNoteNames`, `hasNameableNotes`,
  `toggleLabel`, `width`), `render.php:74–77` (decode only for accessible name).
  Claim: `view.js` owns toggle state + single redraw path + client gating
  (README L185). Evidence: `view.js:126–129` `toggleNoteNames`,
  `view.js:227–260` single `draw` watch reading `showNoteNames`+`width`,
  `view.js:180` client gating. Claim: byte-identity scoped to names-off, "first
  viewer-operable control, per-instance local context" pattern (README L240–248).
  Evidence: design Key Decision 6; `view.js` per-instance `WeakMap`. Matches; no
  signatures/context-keys/directive names pinned.

- **Doc Task 4 (README drift repair).** Claim: frontend reads `language` (not
  `name`); byte-identity scoped to names-off; Forthcoming summary acknowledges
  the first viewer control (README L18,20,49→L52 area,193,231→L240 area,252).
  Evidence: `view.js:250` `data.language ?? inferNoteNameSystem(data)`;
  `svg.js:772` "byte-identical to today" guarded by name-present loop; Forthcoming
  L252 lists "first viewer control" and keeps the audio/richer-notation list
  intact. No render-only / unqualified-byte-identity passage remains (grep swept).
  Matches.

- **Doc Task 5 (song-format `language`).** Claim: frontend now uses `language`
  for the on-page names, inference fallback when absent; `name` still
  frontend-unused (song-format L61, L424→L129 area, `name` section L120).
  Evidence: `view.js:250` resolution path; `noteNameSystem.js:87–94`
  `inferNoteNameSystem`; `name` section still reads "Front end does not consume it
  yet … ignores `name`" (unchanged, accurate). Cross-refs to
  `#4-what-the-front-end-shows` and `#language` resolve. No format-change claim
  added. Matches.

- **Doc Task 6 (block manifest).** Claim: description mentions the optional
  on-page note-name display; keywords add note-names terms; no structural fields
  changed (`block.json:9–10`). Evidence: diff shows only `description` and
  `keywords` (added `"note names", "pitch names"`) changed; `attributes`,
  `supports`/`viewScriptModule`/`render`/`textdomain`/`title` untouched. Matches.

- **Doc Task 7 (source headers).** Claim: `normalizeStep.js` header now names
  validator + renderer + the shared `noteNameSystem.js` module as the consumer
  set, and notes the editor and frontend view reach the vocabulary indirectly
  (`normalizeStep.js:5–11,17–19`). Evidence: matches the actual import graph —
  `noteNameSystem.js:16` imports `isNoteName, normalizeStep`; `layout.js:121`
  and `editor/noteNames.js:30` import from `noteNameSystem.js`; `view.js:42`
  imports `inferNoteNameSystem`. Assertion that `view.js` / `render.php` /
  `noteNames.js` / `noteNameSystem.js` headers were already accurate verified:
  `view.js:1–8` lists `actions.toggleNoteNames` and per-instance state (not
  render-only); `render.php:2–28` describes the two children + toggle + draw
  watch; `noteNames.js:25–27` points to the shared module;
  `noteNameSystem.js:1–15` describes single-source consumed by editor + frontend.
  Pure `layout.js` / `constants.js` headers correctly left alone. Matches.

## Issues

None.
