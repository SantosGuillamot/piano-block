# Doc Plan Review

## Verdict: rejected

## Summary

This is a strong, careful plan. It targets the two real, existing doc surfaces
(`docs/song-format.md` and `README.md`), and I verified that every section it
names is real: the "Events" grammar block and field bullets, the "Additive
growth" closed-vocabulary list, the "Annotated example song" intro sentence and
copy-pasteable JSON (which does wrap pitches in a `pitches` array and carries
`tie: "start"`/`"stop"`), and the README's "Enumerated values are closed"
bullet, "Additive growth" paragraph, and "Forthcoming" out-of-scope set. The
plan's conventions are well-judged: it correctly mandates the real `pitches`
array shape (catching that the design doc's interface snippet used a flattened
`step`/`octave`-on-event shorthand that is *not* the real format), it forbids
pipeline/process references in shipped docs per `AGENTS.md` (verified — `AGENTS.md`
does forbid citing the workflow or its artifacts in user-facing docs), it stays
faithful to the audio-out-of-scope boundary, it documents only the hairpin v1
form and is explicit about the v1 limits, and it adds no code tasks and no scope
creep. Traceability, per-task acceptance, audience clarity, granularity, and
ordering are all sound. I am rejecting for one concrete, demonstrable coverage
gap: a README enumeration of the example song's contents that Task 3 will leave
out of sync, and which no task touches.

## Issues

### Issue 1: The README "Exercising the renderer" callout enumerates the example song's contents and is left out of sync by Task 3

**What's wrong:** `README.md` line 164 (a blockquote in the "The song format
and validator" subsection) is an independent enumeration of what the annotated
example song exercises:

> The [example song](docs/song-format.md#annotated-example-song) in the format
> reference is a broad-coverage example (it touches per-hand clefs, accidentals,
> a chord, a tie, dynamics, barlines, an octave shift, and a section change).

Task 3 extends that same example to add a crescendo span, a decrescendo span,
and a messa-di-voce hinge note. Task 3's acceptance even *requires* updating the
parallel enumeration that lives in `docs/song-format.md` (line 272, "It exercises
a broad spread of elements: ... dynamics, a free-text chord symbol, a tie, ...")
so it lists the gradual dynamics. But the README twin of that exact enumeration
(line 164) is not named in any task. After phase 5, the song-format.md intro
sentence will list the new gradual dynamics while the README's "it touches …"
list still will not — the two enumerations of the same example will disagree,
and the README will under-describe an example it links to. This is precisely a
"text that names the affected behavior left out of sync after phase 4" surface.

The plan's own opening claim that "every surface … is covered by a task here"
(doc-plan.md lines 19-23) is therefore not quite true: this surface is missed.

**Where in plan:** Task 3 (acceptance updates only the song-format.md intro
sentence, not the README callout) and Task 5 (covers the README's
closed-enum bullet, additive-growth paragraph, and Forthcoming section, but its
"Files to change" and scope do not include the "Exercising the renderer"
callout in the same subsection).

**Suggestion:** Add the README "Exercising the renderer" callout (the
`docs/song-format.md#annotated-example-song` blockquote, README.md ~line 164) to
the plan as an explicit surface — either as a bullet in Task 5's scope or as a
small addition to Task 3 — with acceptance that the callout's "it touches …"
enumeration stays consistent with the extended example (i.e. mentions the
gradual dynamics). Note the dependency: this edit must follow Task 3 (it
describes Task 3's extended example), so if it lands in Task 5 the existing
`Depends on: Tasks 1, 2, 4` should also include Task 3, or the surface should be
folded into Task 3 itself. Keep the acceptance drift-resistant (no exact
wording), as the rest of the plan does.

**Why it matters:** A reference doc that links to an example and then
mis-enumerates that example's contents directly undercuts author trust and is
exactly the kind of stale-after-the-change text this phase exists to prevent.
The plan already treats the identical enumeration in the other file as
must-update; leaving its README twin unaddressed is an internal inconsistency in
the plan's own coverage logic, not a judgment call.
