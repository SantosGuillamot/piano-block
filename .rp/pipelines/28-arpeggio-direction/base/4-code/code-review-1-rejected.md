# Code review (iteration 1) — REJECTED

Issue #28 "Support arpeggios with direction" — batch T1–T9, base ref `534f800`.

## Summary

The **implementation is correct and faithful to the design.** All of `src/`
(schema enum, `ARPEGGIO` option list, NotePanel control + reset-all destructure,
arpeggio constants, layout `note.arpeggio` record, `wigglePathD` + `renderArpeggio`
geometry) matches the design doc and satisfies R1–R13 / AC1–AC8. The full unit
suite is **green: 734/734** (`npm run test:unit`). The untouched-set holds exactly:
only the 15 allowed files changed; `src/edit.js`, `src/song/validate.js`,
`src/notation/glyphs.js`, and the font are untouched.

Rejecting on **two small, mechanical issues** in the test/spec layer (an explicit,
named project-rule violation introduced ~12 times, and one freshly-introduced lint
warning that goes against the repo's own idiom). Both are trivial, isolated fixes.
The third adjudication item (the shared mock change) is **approved** — see below.

The re-dispatch is narrow: **T8** and **T9** only. No `src/` implementation task
needs to change.

---

## Findings (must fix)

### F1 — Internal-workflow `AC#` references leaked into shipped test/spec code (T8, T9)

`AGENTS.md:5` and the code plan's conventions block (`code-plan.md:15-18`)
**explicitly and by name** forbid citing "acceptance criteria `AC#`" (and `R#`,
`T#`, `design §`, "spec", etc.) in source code, comments, or docs — all such
references must be confined to `.rp/`. The batch added ~12 new `AC#` references in
shipped test/spec files:

- **T9 — `specs/editor.spec.js`** (added lines): `// (AC1, AC2, AC4, AC8).`;
  `never-blocks / round-trip test (AC8)`; `round-trips … unchanged (AC8)`;
  `test("AC4 — the Arpeggio SelectControl …")`; `… does not gate the save path (AC8).`;
  `… validates and never blocks saving (AC8).`;
  `test("AC8 — the arpeggio field round-trips through JSON mode …")`.
- **T9 — `specs/render.spec.js`** (added lines): `// AC1/AC2: a song carrying …`;
  `// (AC1, AC2, AC4, AC8).`;
  `test("AC1/AC2 — arpeggio: up renders …")`;
  `test("AC1/AC2 — arpeggio: nondirectional renders …")`.
- **T8 — `src/notation/__tests__/svg.test.js:475`**:
  `// ── Combined markings: arpeggio + tie + dots + dynamic (AC7) ──`.

**Why this is a real finding, not just style-matching.** Yes — the *pre-existing*
spec files already use `AC#` titles/headers pervasively (e.g.
`render.spec.js:2-3`, `editor.spec.js:908`). But:

1. The plan author anticipated exactly this trap and named `AC#` in the forbidden
   list dispatched with every task. "Match surrounding style" governs idiom
   (tabs, naming, comment density) — it does not license copying a pre-existing
   rule violation. A specific prohibition beats a general "match style" guideline.
2. Worse, these `AC#` numbers are from **this feature's** spec and **collide** with
   the same files' pre-existing `AC#` numbering, which means *different* criteria.
   After this change `editor.spec.js` contains two unrelated `AC8`s and
   `render.spec.js` two unrelated `AC1/AC2`s — actively confusing to a maintainer.

The pre-existing `AC#` debt is out of scope to fix; but adding ~12 more of it is
not acceptable.

**Smallest fix.** The titles/comments already describe the behavior after the dash;
just drop the `AC#` prefixes and the parenthetical `(ACn)` / `(AC1, AC2, …)`
citations. No behavior change. Examples:

- `test("AC4 — the Arpeggio SelectControl sets arpeggio …")`
  → `test("the Arpeggio SelectControl sets arpeggio …")`
- `test("AC8 — the arpeggio field round-trips through JSON mode and never blocks saving")`
  → `test("the arpeggio field round-trips through JSON mode and never blocks saving")`
- `test("AC1/AC2 — arpeggio: up renders [data-arpeggio=\"up\"] with an arrowhead")`
  → `test("arpeggio: up renders [data-arpeggio=\"up\"] with an arrowhead")`
- Comments: delete the `(AC…)` citations and the `// AC1/AC2:` prefix; keep the
  descriptive remainder.
- `svg.test.js:475` header → `// ── Combined markings: arpeggio + tie + dots + dynamic ──`.

**Re-dispatch:** T8 (one comment header in `svg.test.js`), T9 (both spec files).

### F2 — Freshly-introduced lint warning: use `Object.hasOwn` (T9)

`specs/editor.spec.js:1715` uses `Object.prototype.hasOwnProperty.call(...)`, which
`biome lint` flags (`lint/suspicious/noPrototypeBuiltins`, safe autofix available):

```
return Object.prototype.hasOwnProperty.call(
  parsed.sections[0].measures[0].rightHand[0],
  "arpeggio",
);
```

This is **not** entrenched style: there was **no** `hasOwnProperty` usage anywhere
in `specs/` at the base ref, and the repo's own idiom is `Object.hasOwn(...)`
(`src/song/validate.js:185,193,220,248`). The plan's Final gate required a clean
`npm run lint`; this warning slipped through.

**Smallest fix.** Apply the safe autofix:

```js
return Object.hasOwn(
  parsed.sections[0].measures[0].rightHand[0],
  "arpeggio",
);
```

**Re-dispatch:** T9 (`specs/editor.spec.js`).

---

## Adjudication results (orchestrator's four items)

1. **`test/mocks/wordpress-components.js` change (T3) — APPROVED.** Sound, minimal,
   necessary. The old mock literally swallowed `resetAll`
   ("Swallow props with no behavior the tests assert"), making the design's
   explicitly-called-out reset-all regression (the `arpeggio: _arpeggio`
   destructure) **untestable** at the unit tier. The new mock renders a "Reset all"
   button **only when `resetAll` is truthy**, mirroring the real
   `@wordpress/components` ToolsPanel, and updates the docstring to match. It does
   **not** corrupt other panels' tests: the full suite (incl. MeasurePanel,
   SectionPanel, SongPanel, NotePanel) is green at 734/734. No change requested.

2. **`AC#` in e2e/test titles — NOT acceptable; must fix.** See **F1**. Entrenched
   convention does not override the plan's explicit named prohibition, and the
   numbers collide with the files' pre-existing `AC#`. Fix is trivial (drop the
   prefix/citation, keep the behavior description).

3. **Lint warning (T9) — require the fix.** See **F2**. Freshly introduced, against
   the repo's own `Object.hasOwn` idiom, with a safe autofix.

4. **e2e not executed here — assessed structurally; PASS.** The new specs use only
   helpers/locators that exist at the base ref (`publishPostWithSong`, `blockSvg`,
   `storedSongObject`, `seedSongViaJson`, `switchToJsonMode`/`switchToVisualMode`,
   `openSettingsSidebar`, `expandRow`, `treeRow`, `inspectorPanel`, `canvasSvg`,
   `errorNotice`, `storedSong`, `songField`, `getByLabel`). The `[data-arpeggio=…]`
   / `[data-arpeggio-arrow]` locators match exactly what `renderArpeggio` stamps.
   The chord tree-row label `"C E G"` is correct (`noteLabel` space-joins steps,
   English by default). The JSON round-trip test correctly mirrors the existing
   language round-trip test. Structurally sound; will run in CI.

---

## What was verified and is correct (no action)

- **Schema (T1):** `arpeggio: { enum: ["up","down","nondirectional"] }` placed beside
  `dynamic`; not `required`; `validate.js` source untouched. Tests genuinely walk a
  real song (`[]` for each valid value; `"sideways"` flagged with path+value, no
  throw) and add `arpeggio: "up"` to the comprehensive fixture.
- **Option list (T2):** title-case `__()`-wrapped labels; `values(ARPEGGIO)` ===
  schema enum cross-check; added to the label/value sweep.
- **NotePanel (T3):** standalone `ToolsPanelItem` mirroring `dynamic`; `arpeggio:
  _arpeggio` added to the reset-all destructure; no rest type-gate; three tests
  incl. the high-value reset-all regression guard.
- **Constants (T4):** five tuned constants; `ARPEGGIO_FIXED_GAP = 1.4 >
  LEDGER_WIDTH/2 = 1`; `ARPEGGIO_GAP = 0.7 ≥ 0.6`; comments in house style.
- **`wigglePathD` (T5):** pure, `n = max(1, round(height/(period/2)))`, divides only
  by `n ≥ 1`, starts at `bottomY`, reaches `topY`; tests cover the `n=1` clamp,
  purity, no `NaN`/`Infinity`, and "taller ⇒ more `Q`s".
- **Layout (T6):** `note.arpeggio` built via object spread **only when
  `event.arpeggio`** is truthy (absent ⇒ no key); `dx` = `max(acc.dx)+ARPEGGIO_GAP`
  with accidentals else `ARPEGGIO_FIXED_GAP`; `topY/bottomY` via `staffStepToY`
  (highest head → smallest Y). Rest inertness falls out structurally (rest returns
  early before `notes.push`). Tests assert dx clearance, single-pitch `topY===bottomY`,
  rest-in-`rests`, and absent-record cases.
- **`renderArpeggio` (T7):** `<g data-arpeggio=direction>` with always-present
  `<path data-arpeggio-wiggle>` (INK / STEM_THICKNESS, as `renderSpan`); arrowhead
  is a nested `<g data-arpeggio-arrow>` of two `<line>`s — "^" tip at `topY` for up,
  "v" tip at `bottomY` for down, none for nondirectional (Y-grows-down geometry is
  correct). Guarded call `if (note.arpeggio)` inside `renderNote` so it inherits
  `data-hand`/`data-event-index`. Tests assert per-direction nodes, arrow Y-position,
  nondirectional has no arrow, rest has no `[data-arpeggio]`.
- **Combined markings (T8):** real chord with F#5 so left-of-accidental is
  non-vacuous; asserts all four `data-*` nodes present and `arp.dx > max(acc.dx)`.
  (Only the comment header needs the `AC7` stripped — F1.)
- **Render parity (R8/AC4):** architectural — both surfaces call the same
  `buildLayoutModel → renderInto/renderSvg`; arpeggio lives entirely in the shared
  core. Confirmed.

## Note (minor, NOT blocking)

`src/notation/__tests__/svg.test.js:1401` has a mid-file `import { wigglePathD }
from "../svg.js"` — the only mid-file import in the test dir. ES imports hoist, so
it is functionally correct and harmless; not requiring a change, but a code-writer
fixing T8 in that file could optionally move it to the top import block.
