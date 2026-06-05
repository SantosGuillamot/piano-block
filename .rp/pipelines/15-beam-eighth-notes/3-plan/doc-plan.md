# Doc Plan — Beam chained eighth notes as a single group instead of in pairs

_Source: GitHub issue [#15](https://github.com/SantosGuillamot/piano-block/issues/15)._
_Phase: Plan (phase 3). Documentation companion to `3-plan/code-plan.md`, which realizes `2-design-doc/design-doc.md` and `1-spec/spec.md`._

## Documentation survey (what exists, and whether beaming touches it)

The repository has a small, well-bounded set of documentation surfaces. I surveyed
each for any description of beaming behaviour:

| Surface | Audience | Mentions beaming? | Verdict |
|---|---|---|---|
| `README.md` | Users + contributors | **No** — `grep -in "beam"` returns nothing. Describes the block, the authoring workflow, the build model, and the song-format/validator at a contributor level. | **No change.** |
| `docs/song-format.md` | Song authors (canonical field reference) | **No** — `grep -in "beam"` returns nothing. Documents the *input* fields (`duration` enum, `timeSignature.{beats,beatType}`, `beat` anchor), not how the renderer visually groups notes. | **No change.** |
| `AGENTS.md` | AI/automated contributors | No — and it actively *forbids* referencing the pipeline workflow (`design §X`, `AC#`, `T#`) in shipped code/docs. A constraint on how the in-code wording is written, not a target to edit. | **No change** (constraint, see Task 1). |
| `src/notation/layout.js` JSDoc / inline narrative | Contributors reading the rendering engine | **Yes** — this is the *only* place beaming behaviour is described in prose. Two touchpoints: the `beatGroupLength` JSDoc (`:366-375`) and adjacent `beamGroups`/`layoutHand` doc comments (`:388-399`, `:1417`). | **In-code narrative — see Tasks 1 & 2.** |
| `specs/*.spec.js` | Contributors (Playwright E2E) | No beaming assertions; render specs check the three display states + injection safety, not beam grouping. | **No change.** |

### Why the external-docs footprint is empty (recorded justification)

Beaming is a **purely internal rendering decision**. The song format records *what
the music is* (note durations, the time signature, optional `beat` anchors); it does
not record or promise *how consecutive eighths are visually grouped under a beam* —
that is computed by the renderer from the time signature. The word "beam" appears in
**neither** `README.md` **nor** `docs/song-format.md`, so this change alters no
documented contract, no field, and no author-facing behaviour description. The spec
also explicitly excludes any new toggle/mode/config option (spec "Out of Scope"), so
there is **no new public surface to document** — nothing to add to the song-format
reference's field list, the README's feature/Forthcoming sections, or anywhere a
user would look. Recording this explicitly (rather than manufacturing a doc task)
keeps the plan proportionate to an internal beaming-behaviour change.

The only documentation that becomes **factually wrong** after the code change is the
in-code prose in `layout.js` that currently asserts the old "pairs" behaviour
("4/4 eighths beam in 2s"). That is the entire doc blast radius.

### Relationship to the code plan (no double-ownership)

`code-plan.md` **Task 4** already owns rewriting the **`beatGroupLength` JSDoc**
(`:366-375`) as part of the production edit — that is correct and this doc plan does
**not** re-own it. This doc plan therefore covers only the documentation work the
code plan leaves on the table:

1. A **review/acceptance gate** on that Task-4 JSDoc rewrite, from a docs-accuracy
   and house-style/`AGENTS.md` standpoint (Task 1), and
2. The **adjacent narrative** in `beamGroups` / `layoutHand` that the code plan does
   not touch because the *walk* is byte-identical, yet whose wording ("beat",
   "beat-boundary", "beat length") becomes mildly imprecise once the unit is a metric
   group wider than a beat (Task 2).

---

## Task 1 — Verify and finalize the `beatGroupLength` JSDoc rewrite (review gate over code-plan Task 4)

**Goal:** Ensure the `beatGroupLength` JSDoc rewritten in code-plan Task 4 is
accurate, complete, and house-style-clean — i.e. it no longer claims the old
"pairs" behaviour and correctly describes the new grouping unit. This task does not
re-author the JSDoc (Task 4 does); it is the documentation-quality acceptance over
that rewrite, so the prose is owned and signed off as part of the docs phase.

**Audience:** Contributors reading/maintaining the notation rendering engine.

**Files:** `src/notation/layout.js` — the `beatGroupLength` JSDoc block (`:366-375`,
immediately above the function at `:376`). No new file; this is the same block Task 4
edits.

**Sections-scope:** ONLY the `beatGroupLength` doc comment. Do not touch the function
body (Task 4), the `beamGroups` JSDoc (Task 2), or any other comment.

**Depends on:** code-plan Task 4 (the JSDoc must already be rewritten there).

**Traces to:** spec #3 (general grouping rule), #2 (per-metre table), #4 (3/4 → six),
#13 (compound unchanged); design §4.2 ("Its JSDoc … is rewritten to describe the
grouping unit and the half-bar / whole-bar rule"), §4.3.

**Acceptance:**
- The JSDoc no longer contains the stale claim "one `beatType` unit per beat (4/4
  eighths beam in 2s)" or any equivalent "pairs/twos" assertion.
- It states the **simple-metre** rule in grouping terms: the **half-bar** for
  duple/quadruple metres (4/4 → groups of four, 2/2 → 4+4) and the **whole bar** for
  the small simple metres (2/4, 3/4, 2/8), floored at one beat.
- It states the **compound** rule (dotted beat = three `beatType` units) is
  unchanged.
- It notes the absent-time-signature default (4/4-like grouping ⇒ unit 2), keeping
  the `@param`/`@return` accurate (`@return` still "always > 0").
- The prose contains **no** reference to the pipeline workflow or its artifacts
  (`design §X`, `AC#`, `T#`, "review N") — per `AGENTS.md`. It reads as standalone
  engine documentation.

---

## Task 2 — Reconcile the adjacent `beamGroups` / `layoutHand` narrative with the wider grouping unit

**Goal:** The `beamGroups` walk and its only consumer `layoutHand` are byte-identical
in behaviour, but their doc comments describe the grouping break in terms of a
**"beat"** ("a beat-boundary crossing", "the beat length (grouping)", "For beam
grouping ONLY"). Once `beatGroupLength` returns a span that is **wider than one beat**
(a metric group), the word "beat" in this narrative is mildly inaccurate. Adjust the
wording so the prose matches the new concept — a **grouping unit / metric group**,
not a single beat — without changing any logic.

**Audience:** Contributors reading the beaming walk and the hand-layout consumer.

**Files:** `src/notation/layout.js`:
- `beamGroups` JSDoc (`:388-399`) and its one inline comment that says "starts past a
  **beat** boundary" (`:441-442`).
- `layoutHand`'s `@param … timeSignature` line "For beam grouping ONLY (never for
  positions)." (`:1417`) — verify it stays accurate (it already says "grouping", so
  it likely needs no change; confirm and leave as-is if so).

**Sections-scope:** ONLY the prose/comments in those blocks. **No behavioural code
change** — the design is explicit that the walk and every break branch are
byte-identical (design §4.6). In particular, do **not** alter the literal expression
`floor(pos / beatLen)` or the variable name `beatLen`; those are owned by the code
and the code plan keeps them. This task only adjusts *explanatory wording* where it
says "beat" to mean "grouping unit".

**Depends on:** code-plan Task 4 (so the new meaning of the unit is in place); should
land alongside / just after Task 1 so all `layout.js` beaming prose is consistent in
one pass.

**Traces to:** spec #3 (grouping unit, not per-beat), #9 (straddle uses the new
larger unit); design §2.2 (the walk consults `beatGroupLength` "in exactly one way"),
§4.6 ("only the unit it measures against widened"). Supports invariant #14 (only
group membership changes) by keeping the prose truthful about *what* changed.

**Acceptance:**
- The `beamGroups` JSDoc and inline comment describe the break/crossing in terms of
  the **grouping unit (metric group)** rather than implying a single notated beat —
  e.g. "a beamable note that starts in a new **grouping unit**" — while still
  correctly pointing at the `floor(pos / beatLen)` mechanism by its real variable
  name.
- No code, no expression, no variable name, and no test changes; `git diff` for this
  task shows comment/JSDoc lines only.
- `layoutHand`'s `timeSignature` `@param` is confirmed accurate (kept as-is unless it
  asserts a per-beat meaning, in which case it is reworded to "grouping").
- The prose contains no pipeline-workflow references (`AGENTS.md`).

---

## What this plan deliberately does NOT include (and why)

- **No `docs/song-format.md` change.** The format documents author *input*, not
  render-side beam grouping; "beam" appears nowhere in it; no field is added or
  changed (no toggle/config — spec "Out of Scope"). Adding beaming prose there would
  document an internal renderer decision in an author-facing field reference where it
  does not belong.
- **No `README.md` change.** It mentions no beaming behaviour, adds no new public
  capability, and the change is invisible at the level the README operates (insert /
  author / render / build). Neither the feature list nor "Forthcoming" gains or loses
  an item.
- **No new doc file, changelog, or migration note.** The spec excludes a
  toggle/mode/config; there is no public-surface change, no behavioural opt-in, and no
  format-version concept (`README.md`: "no `version` field") to annotate. The output
  for the only affected case (chained eighth runs) simply matches standard engraving;
  there is nothing for an author to do or know.

If, during implementation, any of these surfaces is found to actually describe
beaming (contradicting this survey), the finding is to be reported rather than
silently expanded into — but the grep evidence above makes that unlikely.

## Sequencing summary

1. **Task 1** — review/finalize the `beatGroupLength` JSDoc rewritten in code-plan
   Task 4 (docs-accuracy + `AGENTS.md` gate). Depends on code-plan Task 4.
2. **Task 2** — reconcile the adjacent `beamGroups` / `layoutHand` "beat" narrative
   with the wider grouping unit (comments only, no logic). Lands alongside Task 1 so
   all `layout.js` beaming prose is consistent.

Both tasks are comment/JSDoc-only and confined to `src/notation/layout.js`; there is
no external or user-facing documentation work in this change.
