# Code plan review — review 8 (APPROVED)

**Verdict: APPROVED.** The revised plan (commit `3b53bf4`) resolves the iteration-1 blocker
and both should-fixes, with no regression to any previously-approved item. It still decomposes
the approved design into discrete, dependency-ordered, independently-testable commits; every
requirement R1–R20 and IN-Optional O1–O5 maps to a task; the deferred Optional items and the
"fine as-is" decisions stay out; the atomic pairs (T9 = R16+O1, T10 = R2), the same-file
sequencings, the byte-identity pins, and the green≠broken guardrails are all intact and grounded.

---

## Iteration-1 issues — all resolved

### B1 (blocker) — project-wide provenance sweep — RESOLVED

The complete set of pipeline/finding/task tags in non-test `src/` is now covered by T15. A live
grep of all non-test `src/` returns exactly these sites, and every one is named in T15:

- `src/edit.js:228` — `from T6` task-ID leak: T15's Files now lists `src/edit.js`; Changes
  explicitly reword the structural-mutators comment to "…the panels and the Structure list only
  signal intent." (no task ID). T15 lands after T7/T11/T12/T17, so the comment is in its final
  home — no collision.
- `src/editor/inspector/NotePanel.js` — **both** `(AC3)` occurrences are named: the docblock
  sentence (~22) **and** the inline JSX comment (~245), each reworded to keep behavioral meaning.
- The four inspector docblock `(Req …; AC …)` tags — NotePanel:10, MeasurePanel:9–10,
  SectionPanel:10, SongPanel:9 — all four files are in T15's Files and each tag is named in
  Changes.
- `src/notation/layout.js:1905` — `(R1.3)`: `layout.js` is in T15's Files; the tag is stripped
  while preserving the lane-reservation meaning.
- `src/style.scss` `(AC4)` — handled in its final home (T15 runs after T17's CSS split;
  the plan tells the writer to strip it wherever the re-parented `.is-selected` comment landed).
- `src/editor/StructureTree.js` `KD 14` (~32, ~394) — covered by the docblock rewrite + hand-group
  comment strip.

T15's Acceptance grep is now **project-wide over ALL non-test `src/`** (excluding
`__tests__/`/`*.test.*`/`*.spec.*`/`/test/`), using the exact command
`grep -rnE '\bT[0-9]|\bAC[0-9]|\bKD |Req [0-9]|\(R[0-9]|R-REG' src --include='*.js' --include='*.scss' | grep -vE '__tests__|\.test\.|\.spec\.|/test/'`
and asserting **zero** matches — not "the edited files," so it can no longer structurally exclude
`edit.js`/`layout.js`. I ran this grep against the live tree: it returns precisely the provenance
tags above and **no false positives** on legitimate code (`\(R[0-9]`, `\bAC[0-9]`, `\bT[0-9]`,
`Req [0-9]` each match only genuine tags; the introduced key strings like `s0m1rightHande0` and
identifiers do not trip it).

The T15-after-T16/T17 ordering change does not break the StructureTree within-file sequence:
the ordering summary keeps **T6 → T13 → T14 → T15** (positions #3 → #10 → #11 → #14), and T15
still lands last within `StructureTree.js`. T15's "Depends on" correctly lists T6/T13/T14/T1/T7/T17.
(Minor, non-blocking: the NotePanel inline `(AC3)` comment at ~245 sits with the Add note/Remove
note buttons that T18's Flex/HStack later wraps; since T18 runs after T15 and introduces no
comments, the tag is already gone and cannot be reintroduced — no collision.)

### S1 (should-fix) — add-alteration locator migration — RESOLVED

T9 now unconditionally migrates **all three** add-alteration locators
(`contextControls.test.js:340`, `:364`, `:378`, all `buttonByName(container, "Right hand add
alteration")`) to a `buttonByText` matcher. Grounding confirms the hazard is real and unconditional:
`HandConfigEditor.js:177` renders the add-alteration button via `<AddButton label={fieldLabel(…)} />`,
T9 drops `AddButton`'s inner `<Button label>`, and the jsdom Button mock derives `aria-label` only
from the `label` prop — so all three would break. The plan correctly **leaves** the
remove-alteration locator (`:358`) on aria-label, because the trash `<Button>`
(`HandConfigEditor.js:171–172`) keeps its `label`.

### S2 (should-fix) — `trash` sentinel in the icons mock — RESOLVED

Confirmed `test/mocks/wordpress-icons.js` exports only `moreVertical`, `chevronRightSmall`,
`chevronDownSmall`, `chevronLeftSmall`, `plus` today — **`trash` is not present**. T9 now adds a
`trash` element sentinel in both Changes (the mock + `module.exports`) and Acceptance ("the mock
exports a `trash` sentinel; the trash-bearing components render the marked node"), preventing the
`undefined`-import / `isValidElement(undefined)` hard-fail.

---

## No regressions — previously-approved items reverified

- **R1–R20 / O1–O5 mappings** — every requirement and IN-Optional still maps to a task; deferred
  Optional items and "fine as-is" decisions remain out of scope.
- **Atomic pairs** — T9 (R16+O1) and T10 (R2) each remain a single commit with mock + production +
  guard/unit together; the plan still flags that splitting leaves the guard wrong-colored.
- **Same-file sequencings** — StructureTree T6→T13→T14→T15 and edit.js T7→T11→T12→T17→T15 intact
  and non-colliding.
- **Byte-identity pins (R8/R9)** — `accessibleName.js`/`notation/dom.js` moves stay byte-identical
  and React-free; the `STAVES`-derived-from-`HANDS` and `ALTER_KEY_OPTIONS`-from-`noteNameOptions`
  byte-identity claims survive.
- **Green≠broken guardrails (items 1/2/16)** — the project-wide RED-on-regression string-icon
  guard, the TreeGrid mock de-translation, and the "flip an icon back to a string → RED" check are
  all present; the DropdownMenu null-on-non-render-fn guard is explicitly preserved (T13 relies on
  it).
- **DELETE `newRest` + DELETE `BPM_MIN_EXCLUSIVE`** — grounded (songModel.js:200 / :120); T2 deletes
  both, their tests, the second `newRest()` usage at songModel.test.js:242 (inlined to the literal),
  and keeps `min={1}`.
- **edit.js imports** — today imports `{ duplicateAt, insertAt, newMeasure, newNote, newSection,
  newSong, removeAt }`; T7 adds **exactly** `setSectionAt` and `updateHandEvents` and explicitly
  forbids `setMeasureAt`/`setEventAt` (no dead imports).
- **No pipeline refs leak into shipped code** — the plan's preamble and T15 enforce the
  unconditional no-tag boundary; the project-wide grep is the gate.

---

## Conclusion

The blocker and both should-fixes are fully addressed, grounded against the live source, and
introduce no regression. The plan is approved for code-writing as-is.
