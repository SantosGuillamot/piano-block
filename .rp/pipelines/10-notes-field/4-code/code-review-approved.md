# Code Review

## Verdict: approved

## Batch scope

Tasks reviewed (all 9, base `23d2f15` → HEAD `56c8974`):

- Task 1 — Schema: add `eventNote`/`standaloneNote` `$defs`; swap `event.chordSymbol` → `event.notes`; add `measure.notes` (`960973b`).
- Task 2 — Constants: add `NOTE_SIZE` (temporary `CHORD_SYMBOL_SIZE` alias) + the four new note constants (`148daea`).
- Task 3 — Clean break: remove every `chordSymbol`/`chord-symbol`/`CHORD_SYMBOL` token; rename to the `note` vocabulary; retarget behaviors (`9edb6a5`).
- Task 4 — Layout: finalize per-event `notes` collection carrying `placement` (`4a64cfb`).
- Task 5 — Layout: `collectStandaloneNotes` + beat→X interpolation into `measureModel.standaloneNotes` (`372aa07`).
- Task 6 — Layout: four placement bands + PAIR A flex (inter-staff gap + bottom margin) + dynamics dodge (`8aa534a`).
- Task 7 — Emit: per-event note `<text>` at band Y with `data-text="note"` + `data-placement` (`ebbaf08`).
- Task 8 — Emit: standalone note `<text>` at raw band Y with `data-staff` + `data-placement` (`d432185`).
- Task 9 — End-to-end coverage for all four bands, both modes, safety, coexistence (`56c8974`).

## Summary

The batch faithfully and completely implements the plan, design, and spec. Every spec requirement (1–20) and every rendering acceptance criterion is genuinely implemented and tested against the layout model's own anchors (relative / existence / `toBeCloseTo`), not gamed. The schema matches the design verbatim (`eventNote` deliberately omits `staff`/`beat` so a stray field is permissively ignored; `standaloneNote` requires `staff` and bounds `beat` with `minimum: 0`); the validator is genuinely untouched (0 diff). The `chordSymbol` clean break is total: the grep gate returns zero across `src/`, `specs/`, `docs/`, `README.md`, the legacy key is valid-but-non-rendering (tested via a dynamically-assembled token so the literal never lives in the tree), and the docs/README/render.php token removals are correct with the full field docs + migration line correctly deferred to the Docs phase. The four-band geometry, the PAIR A flex (collapse-to-base, flex-past-base, dynamics dodge, bottom-margin flex), the per-event local-frame conversion (`bandY − staffBottomY`) vs the standalone raw band Y, the measure-relative beat→X interpolation with the `scaledContent − NOTE_CLAMP_INSET` over-content clamp, the raw-`beat` stacking group key, and the observability attributes all match the design exactly. All four gates pass; no scope creep; the changed file set equals the plan's enumerated files plus a legitimate new `constants.test.js`. The single flagged Task 6 item is the implementation correctly following the authoritative formula (see below) — not a defect.

## Checks

| Check | Command | Result |
| ----- | ------- | ------ |
| Unit suite | `npm run test:unit` | PASS — 302 passed, 6 suites, 0 failures |
| Lint/format | `npx biome check .` | PASS — checked 23 files, no fixes applied (exit 0) |
| Build | `npm run build` | PASS — webpack compiled successfully |
| Clean-break grep | `grep -rn "chordSymbol\|chord-symbol\|CHORD_SYMBOL" src/ specs/ docs/ README.md` | PASS — zero matches |
| Validator unchanged | `git diff 23d2f15..HEAD -- src/song/validate.js` | PASS — 0 lines changed |
| Worktree clean | `git status --short` | PASS — clean (build/ is gitignored) |
| Scope | `git diff --name-only 23d2f15..HEAD` | PASS — only plan-enumerated files + new `constants.test.js`; `render.php` is a comment-only change |
| e2e spec | reviewed (not executed) | Coverage correct; relied on the jsdom/unit suite + the T9 writer's reported 18/18 green (see note) |

## Behavior verification

User-observable rendering behavior is covered end-to-end by `specs/render.spec.js` (per-event four bands, standalone four bands, beat:0 < beat:2 ordering via on-page `boundingBox()`, over-content beat:99 clamped within the `g[data-system]` box, above/below distinct Ys, below-RH + above-LH coexistence distinguishable by `data-staff` vs `data-hand`, per-event + standalone coexistence, and hostile free text rendering inert with the transport-side `</script>` carrier-escape proof). I reviewed the e2e spec for correctness and coverage; I did not execute Playwright (it needs a port-overridden wp-env because the main checkout owns 8888/8889) and instead relied on the green jsdom/unit suite (302) plus the T9 writer's reported 18/18 e2e green. The jsdom emit suite independently verifies the same DOM contract (`data-text="note"`, `data-placement`, `data-staff`, band-boundary Ys reconstructed to system coordinates, distinct stacked Ys, XSS-inert `textContent` with zero children and no `<script>`/`<foreignObject>`), so the rendering behavior is verified with evidence at the unit level.

### Task 6 flag — resolved as (a): the implementation is correct, not a defect

The flag asks whether the no-dynamics "1 below-RH + 1 above-LH" case correctly collapses to the base gap. With the defined constants (`NOTE_GAP_STAFF = 1`, `STACK_STEP = NOTE_SIZE + TEXT_LANE_GAP = 3.4`, `DESCENT = 0.22 × 2.8 = 0.616`, `MID_GAP = 1.2`):

- `belowRH_stack = 1 + 0 + 0.616 = 1.616`; `aboveLH_stack = 1.616`; both present ⇒ `+ MID_GAP`.
- `effectiveInterStaffGap = max(8, 1.616 + 1.616 + 1.2) = max(8, 4.432) = 8` → collapses to `INTRA_STAFF_GAP`.

This is correct: below-RH note #0 lands at `rightStaffBottomY + 1`, above-LH note #0 at `leftStaffTopY − 1 = rightStaffBottomY + 7`, so the two notes fit comfortably inside the base 8 sp gap with no collision. The design PROSE's "≈8.46 sp" is an arithmetic slip — solving its own expression `2·NOTE_GAP_STAFF + 2·0.62 + MID_GAP ≈ 8.46` requires `NOTE_GAP_STAFF ≈ 3`, which is outside the design's own defined range (0.6–1.0) and contradicts the authoritative formula. `layout.js:1839` implements `max(INTRA_STAFF_GAP, …)` exactly as the design's formula block specifies, and the dynamics-dodge safety invariant (a dodged below-RH note never reaches the LH staff) is directly tested (`layout.test.js:2268`, `:2288`). Not a blocker; an optional design-prose nit only.

## Notes (optional, non-blocking — not in this batch's scope)

- `specs/editor.spec.js` and `specs/render.spec.js` carry pre-existing internal references (`design §6.1`, `design §6.8`, `AC1`…) that predate this batch (the base `23d2f15` already had three `design §6.1` occurrences). This feature's tasks did not introduce them; flagging them here would be pre-existing AGENTS.md debt outside the issue-#10 scope. No action required for this batch.
- One commit (`d432185`) omits the `(code-writer)` agent suffix the project commit format uses; the other eight follow it. Cosmetic; does not affect the code.
