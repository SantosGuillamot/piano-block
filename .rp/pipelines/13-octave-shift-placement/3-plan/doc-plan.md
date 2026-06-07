# Doc plan — Fix octaveShift ottava placement for left and right hands (#13)

Documentation plan for the Docs phase, executed **after** the code in
`3-plan/code-plan.md` (T1–T7) lands. Companion to the code plan; same spec
(`1-spec/spec.md`) and design (`2-design-doc/design-doc.md`).

## Bottom line: the doc footprint is minimal — one optional task

This is a focused, internal bug fix to **where** the ottava bracket is drawn. It
does **not** change the song schema, the `octaveShift` field semantics, the
sign→label mapping, or any public data model (spec Out of Scope; design "Model
contract — unchanged"). After researching every piece of documentation in the
repo, **no user-facing doc makes a placement claim that this fix invalidates**, so
there is nothing stale to repair. The only behavior-describing narrative that
actually changes is **inline in `src/notation/layout.js`**, and every such comment
is attached to a symbol the code-writers edit in T1–T6 — which the phase boundary
(below) assigns to the **Code** phase, not Docs.

The result is a single, **optional** enrichment task (DT1): add a short
placement note for `octaveShift` to the song-format reference, mirroring the
"Placement" note the gradual-dynamics section already carries. It is enrichment,
not a correction. A reviewer may reasonably decide even DT1 is unwarranted for a
pure bug fix and close the Docs phase with no change; that is an acceptable
outcome and is called out in DT1's Acceptance.

## Research performed (what exists, and why it is or isn't in scope)

All paths repo-relative.

**User-facing docs**

- **`docs/song-format.md`** — the canonical reference for the song JSON, including
  the `octaveShift` field (lines ~125, ~131–134, ~138, ~140, ~377–379). Every
  mention documents **field semantics only**: the signed-integer range, the
  sign→label mapping (`+1`=8va … `−2`=15mb), inheritance/section-scoping, and the
  forward-looking "sounding octave = octave + octaveShift." **None describes where
  the bracket is drawn on the staff.** All of this is explicitly *unchanged* by the
  fix → nothing here is stale. The one gap is the *absence* of a placement note
  (the gradual-dynamics section has one at ~301/~310; `octaveShift` has none) —
  addressable as optional enrichment (DT1).
- **`README.md`** — describes the rendered output only at a high level ("a braced
  grand staff … notes, rests, and accidentals," §"What the front end shows",
  ~45–57) and lists "an octave shift" once as a feature the example song exercises
  (~164). No ottava-placement narrative → nothing stale.
- **`AGENTS.md`** — contributor conventions; no octave/ottava content. Out of scope.
  (Note its rule: shipped docs must **not** reference the `.rp/` pipeline, phases,
  task IDs, or acceptance criteria. Any DT below must honor this.)

**Examples / fixtures**

- The annotated example song in `song-format.md` (~397–492) uses a **right-hand**
  `octaveShift: 1` (line ~460). It is a field-usage example, not a placement
  illustration; the fix does not change how that song validates or what fields it
  uses. No external example or fixture demonstrates a **left-hand** `octaveShift`
  or asserts bracket geometry. → no example change warranted.

**Changelog** — none exists in the repo (`CHANGELOG*`/`HISTORY*` absent). → nothing
to update.

**Inline narrative (boundary case — see below)** — `src/notation/layout.js`
carries the only comments whose *described behavior* changes:
`effectiveInterStaffGap` (~1855–1862), `systemHasOttavaAbove` +
`systemHasTempo` (~2632–2653), `topMarginLayout` JSDoc (~2777–2839, "then an
above-staff ottava"), and the `buildSystemTexts` header (~2841–2852, esp. "one
bracket per contiguous run … spanning that run's notes (the bracket is a marking,
not a vertical move)"). `src/notation/svg.js`'s `renderOttava` (~1146–1149) is
**hand-agnostic and unchanged** (spec Out of Scope) — its comment stays accurate.

## Phase boundary (what Docs owns vs. what Code owns)

Per the doc-plan brief: the code-writers own all production-code changes
**including the inline API/JSDoc tied directly to the symbols they change**. The
Docs phase owns the broader narrative/guide/README/changelog layer and
**non-symbol** inline narrative.

Applying that line here:

- **Code phase (NOT in this plan).** Every stale inline comment in `layout.js` sits
  on a symbol the code-writers edit:
  - `effectiveInterStaffGap` gap comment → T3 (new LH-above arm).
  - `systemHasOttavaAbove` comment (and the `systemHasTempo` doc line that says
    "ottava … in either hand") → T2 (the predicate is split/replaced).
  - `topMarginLayout` JSDoc ("then an above-staff ottava") → T2 (trigger repointed
    to RH-only).
  - `buildSystemTexts` header ("one bracket per run … spanning that run's notes") →
    T5 (per-hand above lane) and T6 (measure-extent span). The phrase "spanning
    that run's notes" becomes "spanning that run's measure extent," and the
    per-hand above-lane split should be reflected — both directly on the function
    the code-writers rewrite.

  These are the code-writers' responsibility under the standing instruction to
  "write code that reads like the surrounding code" and keep comments matching the
  changed behavior. The doc-plan flags them here so review can confirm the
  code-writers updated them, but does **not** schedule them as Docs tasks.
- **Docs phase (this plan).** Only DT1 — an optional, additive placement note in
  the user-facing `song-format.md`. No `layout.js`/`svg.js` edits.

## Deliberately excluded (and why)

- **Song-format schema / field-semantics edits** — the schema and `octaveShift`
  semantics are unchanged (spec Out of Scope). Editing them would be wrong.
- **README "front end shows" rewrite** — it makes no ottava-placement claim, so
  there is nothing to correct; adding a bracket-placement paragraph would be
  scope-creep for an internal fix.
- **Changelog entry** — no changelog file exists; creating one for a single bug fix
  is out of scope.
- **Inline `layout.js`/`svg.js` comment edits** — owned by the Code phase (boundary
  above). `renderOttava`'s comment is unchanged anyway.
- **A new left-hand `octaveShift` example** — no existing example/fixture
  demonstrates the LH case, and the fix doesn't change field usage; a new example
  would be a feature-illustration addition, not bug-fix documentation.

---

## Doc task

### DT1 — (Optional) Add a placement note for `octaveShift` in the song-format reference

**Goal.** Mirror the gradual-dynamics section's short **Placement** note for the
`octaveShift` field, stating in user terms where each hand's ottava bracket is
drawn — so the reference describes the (now-correct) placement the renderer
produces, consistent with how the hairpin's placement is already documented. This
is enrichment to fill a pre-existing documentation gap, **not** a correction of a
wrong statement (no current statement is wrong).

**Audience.** Song authors reading the format reference who want to know where an
`octaveShift` marking appears on the page (e.g., "I set a left-hand octave shift —
where does the 8va show up?").

**Files.** `docs/song-format.md` (only). No code, no README.

**Sections-scope.** The `octaveShift` bullet under **Per-hand context
(`handConfig`)** (~lines 131–134), and/or a one-line placement note adjacent to it.
Keep it to ≤ ~2 sentences in the established voice. Suggested content, in user
terms (no internal symbol names, no `.rp`/pipeline references):
- A **positive** shift (8va/15ma) draws its dashed bracket **above the staff of
  the hand it is set on** — above the right-hand (treble) staff for a right-hand
  shift, above the left-hand (bass) staff for a left-hand shift.
- A **negative** shift (8vb/15mb) draws its bracket **below that hand's staff**.
- The bracket is **restated on every line** the shifted passage spans.

Phrase it as descriptive behavior, not as a bug-fix note (the reference is
standalone and must not reference the fix, the issue, or the pipeline per
`AGENTS.md`). Optionally cross-link the README's "What the front end shows" the
same way the gradual-dynamics section does, only if it reads naturally.

**Depends on.** All code tasks T1–T7 landed and green (the documented placement
must match shipped behavior). No dependency on any other doc task.

**Traces to.** Spec R1.1–R1.4 (per-hand above/below placement), R2.1/R2.3 (bracket
on every system the run spans); design "Bug 1 — per-hand 'above' placement" and
"Per-hand 'above' emit selection." Mirrors the existing
`docs/song-format.md` gradual-dynamics **Placement** note (~301, ~310).

**Acceptance.**
- The `octaveShift` documentation correctly states per-hand above/below placement
  and the per-line restatement, matching the shipped renderer behavior.
- No change to the field's schema, range, sign→label mapping, inheritance rules, or
  the "sounding octave" model — only a placement note is added.
- Voice, formatting, and link style match the surrounding reference (compare the
  gradual-dynamics **Placement** note); no `.rp`/pipeline/issue/phase references
  (`AGENTS.md`).
- **Acceptable no-op outcome.** If the doc-writer or doc-reviewer judges that a
  placement note is unwarranted for a pure internal bug fix (the field semantics
  are unchanged and no statement is wrong), it is correct to close the Docs phase
  with **no change** and record that decision rather than padding. State which way
  it went.

---

## Commit guidance

One commit for DT1 if it lands; imperative mood, sentence case, no trailing period,
agent name in parentheses — e.g.
`Document octaveShift bracket placement in the song-format reference (doc-writer)`.
If the Docs phase closes as a no-op, record that decision in the phase summary; no
commit is required.
