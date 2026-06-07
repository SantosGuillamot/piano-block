# Doc Plan Review — APPROVED

_Source: GitHub issue [#15](https://github.com/SantosGuillamot/piano-block/issues/15)._
_Phase: Plan (phase 3). Adversarial review of `3-plan/doc-plan.md` (commit `87c14c7`, 2 tasks) against `1-spec/spec.md`, `2-design-doc/design-doc.md`, and `3-plan/code-plan.md`._

## Verdict

**APPROVED.** The doc plan's documentation scope is complete and correct for an
internal beaming-behaviour change, both tasks carry every required field, there is
no double-authoring overlap with the code plan, the "no external docs need changing"
conclusion is backed by real evidence, and the plan honours `AGENTS.md`. Nothing
user-facing was missed and nothing was manufactured beyond what the change warrants.

## What I verified (evidence, not assertion)

### 1. The documentation survey is factually accurate

- **`README.md`** — `grep -in "beam"` returns nothing (exit 1). Confirmed. The
  README frames future work in its "Forthcoming" section as new *capabilities*
  (audio playback, "richer notation elements" — articulations, tuplets, etc.).
  Beaming-by-metric-group is not a new capability an author opts into; it is
  automatic rendering of the existing `duration`/`timeSignature` inputs. So there is
  no feature/Forthcoming line to add or remove. Verdict "No change" is justified.
- **`docs/song-format.md`** — `grep -in "beam"` returns nothing (exit 1). Confirmed.
  It documents author *input* fields, not render-side grouping. Verdict "No change"
  is justified.
- **`AGENTS.md`** — read in full; it forbids referencing the pipeline workflow
  (`design §X`, `AC#`, `T#`, "review N") in shipped code/docs. The plan correctly
  treats this as a *constraint on wording* (folded into both tasks' Acceptance), not
  a file to edit. Confirmed.
- **`specs/*.spec.js`** — `grep -rin "beam"` returns nothing (exit 1). No beaming
  assertions in E2E. Verdict "No change" is justified.
- **`src/notation/layout.js` in-code prose** — verified as the *only* place beaming
  is described in prose. The cited touchpoints all exist and match:
  - `beatGroupLength` JSDoc carries the stale claim "simple (everything else) is one
    `beatType` unit per beat (4/4 eighths beam in 2s)" (`:366-375`, stale text at
    `:370`) — exactly Task 1's target.
  - `beamGroups` JSDoc says "a **beat-boundary** crossing" (`:392`) and "consulted
    ONLY for the **beat length** (grouping)" (`:393-394`) — Task 2's target.
  - The inline comment "A beamable note that starts past a **beat** boundary"
    (`:441`) — Task 2's target.
  - `layoutHand`'s `@param … timeSignature` reads "For beam grouping ONLY (never for
    positions)." (`:1417`) — already says "grouping," so Task 2's "confirm and leave
    as-is if so" is correctly calibrated; it does not manufacture an edit.

- **Complete shipped-docs surface** — `find . -name "*.md"` (excluding `node_modules`
  and `.rp/`) returns exactly `README.md`, `AGENTS.md`, `docs/song-format.md` (plus
  `.rp.md`, a pipeline-config file, not shipped docs). No `CHANGELOG`/`CONTRIBUTING`/
  `HISTORY` exists. The plan surveyed every surface that exists; its "no changelog,
  no migration note" omission is justified by *absence of such a file* and by the
  README's own "no `version` field" note, not by under-documentation. Also confirmed
  every `"beam"` hit in repo markdown lives under `.rp/pipelines/` (pipeline
  artifacts), never in shipped docs — consistent with the survey.

### 2. No double-authoring overlap with the code plan

This is the sharpest risk and the plan handles it cleanly:

- **code-plan Task 4** (`:186-190`) explicitly *authors* the `beatGroupLength` JSDoc
  rewrite ("Rewrite the JSDoc … change the simple-arm description … Compound
  description stays … Keep `@return … always > 0`").
- **doc-plan Task 1** explicitly *disclaims* authorship ("This task does not
  re-author the JSDoc (Task 4 does); it is the documentation-quality acceptance over
  that rewrite") and scopes itself to a docs-accuracy / house-style / `AGENTS.md`
  gate over that block.

Result: one author (code Task 4), one doc-quality acceptance gate (doc Task 1). No
orphaned prose, no double-write. This is the correct and proportionate split.

- **doc-plan Task 2** covers the genuinely doc-only gap the code plan leaves on the
  table: the `beamGroups`/`layoutHand` narrative whose *walk is byte-identical*
  (design §4.6) but whose "beat" wording becomes imprecise once the unit widens.
  The code plan does not touch these comments (it keeps the walk byte-identical), so
  Task 2 is not double-owned. Its scope guard correctly forbids altering the literal
  `floor(pos / beatLen)` expression and the `beatLen` variable name (code-owned),
  limiting itself to explanatory wording — comments/JSDoc only, no logic.

### 3. Task structure is complete

Both tasks carry all required fields — **Goal, Audience, Files, Sections-scope,
Depends on, Traces to, Acceptance** — and the Traces-to citations map to real spec
items (#3, #2, #4, #13, #9, #10) and design sections (§4.2, §4.3, §4.6, §2.2). The
Depends-on edges (both on code Task 4) are correct: Task 1 gates Task 4's rewrite,
and Task 2 needs the new unit meaning in place before rewording.

### 4. Nothing manufactured, nothing missed

- **Not manufactured:** the plan's "What this plan deliberately does NOT include"
  section justifies each omission (`song-format.md`, `README.md`, new doc/changelog/
  migration note) with concrete evidence — grep results, the spec's "Out of Scope"
  toggle/mode/config exclusion, and the README's "no `version` field." It resists the
  temptation to invent an author-facing doc task for an internal rendering decision.
- **Not missed:** the spec's only doc-adjacent acceptance criterion is AC #9 (tests),
  owned by the code plan. No spec/design requirement creates a doc-only gap the plan
  leaves unaddressed. The single piece of prose that becomes *factually wrong* after
  the change (the `layout.js` "pairs" assertions) is exactly what Tasks 1–2 cover.

### 5. `AGENTS.md` honoured in the plan's own acceptance

Both tasks' Acceptance explicitly require the resulting prose to carry **no**
pipeline-workflow references (`design §X`, `AC#`, `T#`, "review N") and to read as
standalone engine documentation. The plan internalizes the constraint correctly.

## Non-blocking observations (for the implementer, not gating)

- **O1 — Keep Task 1's gate genuinely behavioural, not a rubber stamp.** Because
  Task 1 is an acceptance gate over code Task 4's rewrite, the implementer should
  treat its Acceptance bullets as a real checklist against the *actual* rewritten
  JSDoc (no "pairs/twos" residue; half-bar vs whole-bar rule stated; compound
  unchanged; absent-ts default noted; `@return` still "> 0"), not assume Task 4 got
  it right. The plan already frames it this way; flagging so the gate is exercised.

- **O2 — Task 2's `beamGroups` JSDoc has a second "beat" phrase to sweep.** Beyond
  the cited "beat-boundary crossing" (`:392`) and the `:441` inline comment, the same
  JSDoc also says "consulted ONLY for the **beat length** (grouping)" (`:393-394`).
  Task 2's Goal quotes "the beat length (grouping)" so it is in scope, but the Files
  list enumerates only `:388-399` + `:441-442` + `:1417`; the implementer should
  ensure the `:393-394` "beat length" phrase is included in the wording sweep so the
  whole JSDoc is internally consistent. (Already within `:388-399`, so this is a
  reminder to be thorough, not a missing target.)

Neither observation blocks approval; both are refinements the Acceptance criteria
already permit.

## Conclusion

The doc plan is proportionate to an internal beaming-behaviour change: it owns the
in-code prose that becomes wrong, gates the code-plan-owned JSDoc rewrite without
re-authoring it, justifies an empty external-docs footprint with real grep/spec
evidence, and stays inside `AGENTS.md`. **APPROVED** to proceed to the Code phase.
