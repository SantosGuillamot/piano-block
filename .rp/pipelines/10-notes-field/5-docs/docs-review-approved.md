# Docs Review

## Verdict: approved

## Batch scope

Tasks reviewed (all four docs tasks, one batch):

- **Task 1 (D1):** Document the per-event and standalone `notes` model in the song-format reference (`docs/song-format.md`).
- **Task 2 (D2):** Add the `chordSymbol` → `notes` migration line (`docs/song-format.md`).
- **Task 3 (D3):** Update the annotated example song and its intro to use `notes` (`docs/song-format.md`).
- **Task 4 (D4):** Re-point the README's script-breakout-escape aside from `chordSymbol` to `notes` (`README.md`).

Base ref: `de9718e` (code-review-approved). HEAD: `d3c2571`. Four doc commits: `5cefb6e, c80ee88, dc67e8a, d3c2571`.

## Summary

The batch is accurate, complete, and faithful to the shipped code. Every documented field name, enum value, requiredness, default, and unit matches `src/song/schema.js` (`eventNote {text, placement}`; `standaloneNote {text, placement, staff, beat?}`; `placement` enum `above|below` required with no default; `staff` enum `rightHand|leftHand` required on standalone only; `beat` number `minimum:0`; `notes` optional on both `event` and `measure` with `[]` valid). The annotated example validates against the shipped validator with zero errors, and every inline JSON snippet in the reference validates too. The migration line is present, shows the exact `chordSymbol: "C"` → `notes: [{ "text": "C", "placement": "above" }]` rewrite, and correctly states the legacy field stays valid-but-ignored and the migration is manual. The `chordSymbol` token appears in exactly one place (the migration line in `docs/song-format.md`) and nowhere else — README has none. The four placement positions, the per-event column alignment, the `beat` → X anchoring (no-`beat` ≈ left edge, higher beat further right, over-content best-effort near the right edge), verbatim text, and the observability discriminators (`data-text="note"`, `data-placement`, `data-staff`/`data-hand`) all match `src/notation/layout.js` and `src/notation/svg.js`. The four tasks partition cleanly with no duplicated or contradicting coverage, no scope creep, and no documentation of deferred/out-of-scope behavior. The README aside still names `metadata.title` and preserves the escaping rationale accurately against `src/render.php`. No pipeline-workflow references leak into the shipped docs (AGENTS.md compliance).

## Checks

| Check | Command | Result |
| ----- | ------- | ------ |
| `chordSymbol` token confined to the single migration line in `docs/`, absent from README | `grep -rn "chordSymbol" docs/ README.md` | Pass — only `docs/song-format.md:284` (heading) and `:286` (migration line); README: none |
| No `chordSymbol`/`chord-symbol`/`CHORD_SYMBOL` token in `src/` or `specs/` | `grep -rn "chordSymbol\|chord-symbol\|CHORD_SYMBOL" src/ specs/` | Pass — 0 matches (exit 1) |
| Annotated example is valid song JSON | extract first `json` fence after "Annotated example song" → `JSON.parse` | Pass — parses |
| Annotated example validates against shipped validator | run extracted JSON through `src/song/validate.js` | Pass — 0 errors |
| Every inline `notes` snippet validates (per-event 2-note, events 3-pitch, rest+pedal, standalone rit./ped., migration target, legacy `chordSymbol`) | wrap each snippet into a minimal song, run `validateSong` | Pass — all valid (incl. legacy `chordSymbol` stays valid) |
| Documented validation rules match validator behavior (missing text/placement error; bad `placement`/`staff` enum error; standalone missing `staff` error; `beat:-1` error; `beat 0/0.5/99` valid; stray `staff`/`beat` on per-event ignored even when bad; `[]` valid; per-element error path) | drive 14 cases through `validateSong` | Pass — all match the docs' claims |
| No out-of-scope behavior documented as supported (spanning, centered/between-staves value, auto-migration, section/song-level standalone, beat timing validation) | `grep -niE "span\|centered\|between.staves\|auto.?migrat\|section-level\|song-level"` + read | Pass — none; docs explicitly state there is no centered placement value |
| No pipeline-workflow leak in shipped docs (AGENTS.md rule) | `grep -rniE "\.rp/\|design §\|acceptance criteri\|plan task\|review N\|doc-writer\|orchestrat"` | Pass — 0 matches |
| Doc gates enumerated by the project's verification convention | read `AGENTS.md`, `package.json` scripts | None enumerated (Biome lints JS/JSON, not markdown); accuracy spot-check is the sole gate |

## Accuracy spot-check

- **Task 1 (per-event + standalone model).** The per-event shape `eventNote := { text, placement }` (docs lines 228–231) matches `src/song/schema.js:174–181` exactly: `required: ["text", "placement"]`, `text: {type:"string"}`, `placement: { enum: ["above","below"] }`, and no `staff`/`beat` declared. The standalone shape `standaloneNote := { text, placement, staff, beat? }` (docs lines 253–258) matches `schema.js:187–196` exactly: `required: ["text","placement","staff"]`, `staff: { enum: ["rightHand","leftHand"] }`, `beat: { type:"number", minimum:0 }`. The "stray `staff`/`beat` silently ignored on a per-event note" claim (docs line 236) was exercised through `validateSong` — a per-event note with `staff:"nonsense"` is still valid, confirming `eventNote` does not declare those keys. The four-position table (docs 216–221) matches the `noteBandResolver` routing in `src/notation/svg.js:486–505` (`(handKey, placement)` → `aboveRH/belowRH/aboveLH/belowLH`).
- **Task 2 (migration line).** `docs/song-format.md:286` shows `"chordSymbol": "C"` → `"notes": [{ "text": "C", "placement": "above" }]`. The rewrite target was validated through `src/song/validate.js` (valid), and a legacy `chordSymbol: "C"` on an event was also run through the validator and confirmed valid (silently ignored, an undeclared key — `schema.js` no longer declares `chordSymbol`), matching the "valid but ignored, no longer renders, manual migration" prose.
- **Task 3 (annotated example).** The extracted example JSON validates with 0 errors against the shipped validator. It exercises a per-event `notes` array (`{text:"C",placement:"above"}` + `{text:"1",placement:"below"}` on a right-hand event) and a standalone `notes` array (`{text:"rit.",placement:"above",staff:"rightHand"}` on a measure) — both within the shipped enums; `beat` is unused there but is exercised (`beat: 2`) in the standalone reference snippet, which also validates. The intro prose (line 365) lists "free-text note annotations (a per-event chord symbol above and a fingering below, plus a standalone `"rit."` on a measure)", replacing the former "a free-text chord symbol".
- **Task 4 (README aside).** `README.md:162` names "a `notes` entry's `text` or `metadata.title`" as the example author free-text fields, matching the reworded `src/render.php` comment (lines 13–14: "a note's text or metadata.title") and still naming `metadata.title`. The escaping mechanism described (replace every `<` with `<` before printing into the inert `<script>`, round-tripping through `JSON.parse`) matches `render.php:39` (`str_replace( '<', '<', $song )`) exactly.

## Issues

None.
