# Design Doc Review

## Verdict: approved

## Reviewer

Owner (assisted workflow)

## Notes

Owner confirmed the overall approach (interactive canvas + `InspectorControls` sidebar, single `song` source of truth, reuse the notation core untouched) and then delegated the remaining design decisions ("go ahead autonomously from here"). The orchestrator worked through the remaining topics and synthesized the design doc on the owner's behalf. Key decisions: selection by the notation core's already-emitted `data-*` hooks (no core change); `ToolsPanel` progressive disclosure; lazy editor-side seeding of an empty song; canvas default-note add (hand by staff); reordering omitted in v1.
