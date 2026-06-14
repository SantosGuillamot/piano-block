# Code plan review — review 8 (iteration 1: REJECTED)

**Verdict: REJECTED.** The plan is, in almost every respect, excellent: it decomposes the
approved design into 20 discrete, dependency-ordered, independently-testable tasks; every
requirement R1–R20 and every IN-Optional O1–O5 maps to a task; the two deferred Optional items
and the "fine as-is" decisions are correctly excluded; the atomic pairs (T9 = R16+O1, T10 = R2)
and the same-file sequencings (StructureTree T6→T13→T14→T15, edit.js T7→T11→T12→T17) are right;
the byte-identity pins and the green≠broken guardrails are all present and grounded.

It is rejected for **one substantive completeness gap** that violates an unconditional hard
boundary and the spec's own literal R18 examples, plus two smaller items the writer should tighten
in the same pass. None requires re-architecting; all are scoped, actionable edits to the plan text.

---

## BLOCKER

### B1 — R18 provenance-tag stripping misses the spec's own named examples (`T6`, `AC3`) and is under-scoped

The spec's R18 (spec.md:219–224) and the hard boundary (spec.md:42–43) are unconditional: **no
shipped comment may reference pipeline internals, finding numbers, or task identifiers.** The spec
names `KD 14`, **`T6`**, and **`AC3`** as the literal examples to strip. A grep of non-test `src/`
finds 12 such tags. The plan's T15 (R18) handles `KD 14` (StructureTree.js:32, :394) and the named
stale-code comments, but **leaves at least two of the spec's own example tags in shipped code**, and
its file list is too narrow to catch them:

1. **`src/edit.js:228`** — comment reads `// … (the panels and, from T6, the Structure list only
   signal intent).` This is a genuine pipeline task-ID leak (`T6`, the spec's own example). `edit.js`
   **is** edited (T7, T11, T12, T17) but **T15's Files list does not include `src/edit.js`**, and no
   other task strips this tag. It would ship.
2. **`src/editor/inspector/NotePanel.js:245`** — comment `… auto-selects the new note (AC3); …`. `AC3`
   is the spec's own example. T15 only plans to fix NotePanel's `EventRow` comments (~26–27, ~108–110);
   the `(AC3)` comment at :245 is not named, and T16's annotations-collapse edit is in the same region
   but does not call it out. It would ship.

Additionally, the following pre-existing tags are pipeline references the hard boundary forbids and
the plan neither strips nor explicitly scopes out:
- `src/editor/inspector/SongPanel.js:9` — `(Req 5, 7, 8; AC5, AC10)`
- `src/editor/inspector/MeasurePanel.js:9–10` — `(Req 7, 8, 11; AC7, AC9, AC10)`
- `src/editor/inspector/NotePanel.js:10` — `(Req 7, 8, 11; AC7, AC9, AC10)`
- `src/editor/inspector/SectionPanel.js:10` — `(Req 7, 8, 11; AC7, AC9, AC10)`
- `src/notation/layout.js:1905` — `(R1.3)`
- `src/style.scss:141` — `(AC4)` *(this one is plausibly covered: T17 rewrites the moved `.is-selected`
  comment block "no pipeline tags" — but confirm the writer reparents this exact comment, not just the
  `__song-input` sentence).*

**Why this is RED-with-a-green-suite:** stale/provenance comments are invisible to `test:unit`,
`build`, and `check` (Biome) — exactly the regression class the review must catch. There is no test
that fails if `T6`/`AC3` ship.

**Required fix (choose the scope, but it must cover `T6` and `AC3` at minimum):**
- Add `src/edit.js` to T15's Files and Changes, stripping the `T6` reference at :228 (reword to name
  the real "Structure list" without the task ID). T15 already lands after T7/T11/T12, so no collision.
- Add the `(AC3)` comment at `NotePanel.js:245` to T15's NotePanel changes (or fold into T16's
  annotations edit, whichever lands later — but name it explicitly).
- Either (a) extend T15 to a true project-wide provenance sweep that also strips the `(Req N; AC N)`
  docblock tags in the four inspector files, the `(R1.3)` in `layout.js:1905`, and confirms the
  `(AC4)` in the moved CSS; **or** (b) if any of these are deliberately out of review-8's scope,
  state that explicitly in the plan (and reconcile it with the unconditional spec.md:42–43 boundary).
  Do not leave them silently unaddressed.
- Update T15's Acceptance grep to assert the **absence** of `\bT[0-9]`, `\bAC[0-9]`, `\bKD `,
  `Req [0-9]`, and `R-REG` in every file T15 (and the rest of the plan) edits — the current
  Acceptance grep lists only `KD `, `AC`, `R-REG`, `bare T<digit>` and is scoped to "the edited
  files," which by construction excludes `edit.js` since T15 doesn't list it.

---

## SHOULD-FIX (tighten before code-writing; not independently blocking)

### S1 — T9's contextControls add-alteration locator migration is phrased contingently; make it definite

Grounding confirms the hazard is real and unconditional, not "if": `HandConfigEditor.js:177` renders
the add-alteration button via `<AddButton label={fieldLabel("add alteration")} … />`, and `AddButton`
(`ListControls.js:24–30`) renders `<Button … label={label}>{label}</Button>`. T9 drops the inner
`<Button label>`, and the jsdom Button mock derives `aria-label` only from the `label` prop
(`wordpress-components.js:48`). So `buttonByName(container, "Right hand add alteration")` at
**`contextControls.test.js:364`** **will** break — there is no "if." T9 lists `contextControls.test.js`
in Files only conditionally ("if it locates the HandConfigEditor add-alteration button by aria-label")
and hedges the migration in prose. Make it definite: T9 **must** migrate the `:364` add-alteration
locator to a text matcher (mirroring `pitches.test.js`/`annotations.test.js`), and keep the
`:358` / `:383` **remove**-alteration locators on aria-label (the trash button keeps its `label`).
Note the remove-alteration trash button at `HandConfigEditor.js:170–174` keeps `label`, so it stays
aria-label-locatable — the plan says this, but the contingent framing of the add-button risks the
writer skipping it and shipping a red `contextControls.test.js`.

### S2 — T9's `wordpress-icons.js` mock must ADD `trash` (it is not exported today)

Grounding: `test/mocks/wordpress-icons.js` currently exports only `moreVertical`,
`chevronRightSmall`, `chevronDownSmall`, `chevronLeftSmall`, `plus` — **`trash` is not present.**
T9's prose does say to "add `trash`," but the production swap (`PitchList`/`AnnotationList`/
`HandConfigEditor` → `icon={trash}`) plus the project-wide guard mounting those components will
hard-fail if the writer forgets, because the import would resolve to `undefined` and the guard's
`isValidElement(undefined)` is false (renders nothing → guard RED even with the fix in). This is
covered by the plan but is the single easiest thing to drop; call it out in T9's Acceptance
("the mock exports a `trash` sentinel; the trash-bearing components render the marked node").

---

## Items explicitly verified as CORRECT (no change needed)

- **`serializeSong` per-symbol O4 decision (T2).** Grounding confirms `serializeSong` lives in
  `src/editor/serializeSong.js:27` (not `songModel.js`), imported+exercised by
  `serializeSong.test.js:15`. T2 correctly scopes O4 to `songModel.js` symbols and keeps the
  `serializeSong` export untouched — the cheapest correct choice. The design doc's §2 prose
  ("test-only `serializeSong` export") was loose about the file; the plan caught and corrected it.
- **edit.js imports EXACTLY `{ setSectionAt, updateHandEvents }` (T7).** No `setMeasureAt`/
  `setEventAt`; the four measure-array sites correctly use `setSectionAt`. No dead imports.
- **DELETE `newRest` (T2) + its dedicated test AND the second usage** at `songModel.test.js:242`
  (`leftHand = [newRest()]`) inlined to the literal — T2 names both, matching grounding.
- **DELETE `BPM_MIN_EXCLUSIVE` (T2), keep `min={1}`** — grounding confirms it is referenced only in
  its own test; not wired as `min=` anywhere.
- **`ALTER_KEY_OPTIONS` from `noteNameOptions("english")` (T8).** `noteNames.js:114–117` returns
  `[{label:"C",value:"C"}…{label:"B",value:"B"}]`, byte-identical to the hand-listed
  `ALTER_KEY_OPTIONS`; `contextControls.test.js:370` (`toEqual(["C"…"B"])`) stays green.
- **`updateHandEvents` empty-hand pin (T2/T7).** `Edit.test.js:516`
  (`rightHand).toBeUndefined()`) and `:524` ("keeps the hand when another event remains") match the
  plan's behavioral pins exactly.
- **R9 extraction (T11).** `accessibleName.js` is byte-identical, imports only `__,_x,sprintf` from
  `@wordpress/i18n`, edit.js is its sole importer; `view.js` defines the twins locally;
  `glyphs.js`/`constants.js` are import-free leaves; `MUSIC_FONT_FAMILY` is in `glyphs.js`;
  `SongCanvas.js:191` already uses `container?.clientWidth ?? 0`. The React-free / no-cycle / no
  ResizeObserver-unification claims hold.
- **R8 dead-code removal (T19).** `renderSvg` signature, the five positional `interactive` params,
  `hitRect` (sole `data-hit` emitter), the two `if (interactive)` branches, `HIT_RECT_WIDTH_SP`,
  and `HIT_RECT_VERTICAL_MARGIN_SP` (constants.js:34) are all where the plan says; the flagless
  no-hit assertions (`svg.test.js:987–991`) and `render.spec.js:529` `[data-hit]` count-0 pin survive.
- **R2 atomic pair (T10).** TreeGrid mock at `wordpress-components.js:445–458` does map
  `label`→`aria-label`; production `StructureTree.js:569` uses `label=`. T10's mock de-translation +
  production `aria-label` swap + new unit are coherent and atomic.
- **R16+O1 atomic (T9).** Default Icon/Button/DropdownMenu mocks swallow `icon`; DropdownMenu
  null-on-non-render-fn guard (`:371–374`) is preserved (T13 relies on it); jest two-project +
  `reactDedupMapper` + `REAL_ICONS_TEST` + `realIcons.test.js` (265 lines) all exist as described.
- **R3/R17 CSS split (T17).** `style.scss` has the `@font-face`, wrapper border/padding/color,
  and the editor rules incl. the `@for $i` loop and three `#007cba` (`:142–144`); no
  `@use`/`@import`/`@mixin`; `index.js:4` imports only `style.scss`; `block.json` has `style` but no
  `editorStyle`. The move/rewire plan is correct.
- **Dependency ordering.** Phase A (T1/T2) before B; R20 (T1) before R1 (T6); StructureTree
  T6→T13→T14→T15 (docblock last); edit.js T7→T11→T12→T17 — all non-colliding and correctly justified.

---

## What the writer must do

Address **B1** (the blocker) — at minimum strip `T6` (edit.js:228) and `AC3` (NotePanel.js:245),
extend T15's file list + Acceptance grep accordingly, and either sweep or explicitly scope-out the
remaining `Req/AC/R1.3` tags. Tighten **S1** (make the contextControls add-alteration locator
migration unconditional) and **S2** (call out adding the `trash` sentinel + its guard coverage in
T9's Acceptance). Re-submit; everything else is approved as-is.
