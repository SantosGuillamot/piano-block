# Documentation Plan: Store song information in the Piano block

_Documentation plan for GitHub issue #2 (pipeline `2-store-song-information`). Turns the **approved design** (`2-design-doc/design-doc.md`) and the **9-task code plan** (`3-plan/code-plan.md`) into a sequence of discrete, ordered documentation tasks that satisfy the spec (`1-spec/spec.md`, requirements 1–14, AC1–AC10). This plan decides WHAT to document, WHERE, and for WHOM — it does not re-open any settled design or code decision._

## How to use this plan

- The docs phase dispatches **one fresh `doc-writer` per task**, sequentially, on the shared branch `worktree-2-store-song-information`, **after the code is shipped**. Each task block below is self-contained: **Goal**, **Audience** (who reads it), **Files** (which docs to create/update), **Sections-scope** (what the doc must cover), **Depends on** (task IDs), **Traces to** (spec reqs/ACs + design sections), and **Acceptance** (how to verify the doc is accurate and complete).
- **Document the SHIPPED behavior.** Each doc-writer must read the actual code that landed (`src/song/schema.js`, `src/song/validate.js`, `src/block.json`, `src/edit.js`, `src/render.php`) and write what is *true of the shipped block*, not what a plan predicted. Where this plan quotes a field name, enum value, or range, treat it as the design's intent and **verify it against the shipped `src/song/schema.js`** (the single source of truth, design §7) before publishing; if the code differs, document the code and note the discrepancy to `team-lead`.
- **The schema-as-data module is canonical.** `src/song/schema.js` is the single source of truth for "what is conformant" (design §6.2/§7). Docs **describe and link to it**; they must **not** transcribe a second, divergent copy of the schema into prose that could drift. The annotated example song lives in the design doc §9 and is reproduced (once) in the format reference.
- **Run from the worktree root** `/Users/santosguillamot/Desktop/Code/SantosGuillamot/piano-block/.claude/worktrees/2-store-song-information`. Absolute paths throughout.

## Conventions every doc task follows

- **Audience-first.** v1 authoring is **raw JSON** (the only affordance is a `TextareaControl`), so the primary audience is a **content author who hand-writes the song JSON**. Write the format reference and usage docs for that reader: concrete, example-led, no internal-implementation jargon. Keep contributor-only detail (the validator/walker internals) in the contributor docs.
- **Markdown, matching the existing `README.md` style.** GitHub-flavored Markdown; fenced code blocks with language hints (` ```json ` / ` ```jsonc ` / ` ```php ` / ` ```bash `); sentence-case headings; tables where the README already uses them (file-layout, field tables). New docs live under a new top-level `docs/` directory (none exists yet — Task D1 creates it).
- **Accurate to the spec, no invented features.** Document only what the spec/design/code deliver. Do **not** document audio playback, notation rendering, a visual authoring UI, a `version` field, or import/export — these are explicitly **out of scope** (spec "Out of Scope"); where useful, name them as *future / not yet supported* so authors are not misled, but never as present behavior.
- **One canonical statement per fact.** Cross-link rather than duplicate. The format reference (Task D1) is the canonical field/value reference; usage (Task D2), contributor notes (Task D3), and the README (Task D4) **link to it** instead of restating field tables.
- **No JSON-validity-fragile prose in code fences that ships as runnable.** Example songs shown as conformant must actually be conformant against the shipped validator. The doc-writer for Task D1 should paste any "this is valid" example through the shipped `validateSong` (or the unit-test fixtures) to confirm it passes before publishing it as conformant.
- **Commit messages:** imperative mood, sentence case, no trailing period, agent in parentheses — e.g. `Add song format reference (doc-writer)`. Commit only the files the task touches.

---

## Task D1 — Song JSON format reference (the authoring reference)

**Goal:** Create the **canonical, author-facing reference** for the custom song JSON format — the structure, every field, its allowed values/ranges, the two note-name systems and their equivalence, the inheritance/override and accidental-resolution rules, and a single fully-annotated example. This is the centerpiece doc: it is what a content author consults to hand-write or edit a song, and what every other doc links to for field detail.

**Audience:** **Content authors / block users** who will write song JSON directly in the block's raw-JSON field (the intended v1 author, comfortable editing JSON). Secondary readers: contributors who need the authoritative field list.

**Files:**
- Create `docs/song-format.md`.

**Sections-scope** — the reference must cover, drawn from design §3–§5, §7, §9 and verified against the shipped `src/song/schema.js`:

1. **Intro & mental model.** One paragraph: a song is a custom, dependency-free JSON document owned by this plugin (no MusicXML/ABC/MIDI), modeling a **grand staff** (a right-hand and a left-hand part). It is the *content* stored in the block's `song` attribute (a string). State plainly that v1 authoring is by hand in the block's raw-JSON field. (Req 2, 3; design §1, §3.)
2. **Top-level shape.** `song := { metadata?, defaults?, sections }` — `sections` is the only **required** member; `metadata` and `defaults` are optional. Show the **minimal conformant song** `{ "sections": [ { "measures": [] } ] }`, and clearly distinguish it from the **empty state** (no song at all → the field is blank / empty string), which is *not* a song document. (Design §3; Req 5, 10.)
3. **`metadata`** — optional `title` and `composer`, both optional free-text strings. (Req 4.9; design §3.)
4. **`defaults` and `sections` (constant-context model).** Explain that a **section** is a run of music over which the musical context (tempo, time signature, per-hand clef / default accidentals / octave-shift) is **constant**; a context change starts a **new section**. `defaults` is the song-wide context every section inherits; a section overrides only what changes. Crucially: **mid-song changes (tempo / clef / time signature / accidentals / octave-shift) are expressed by starting a new section with the changed field(s)** — there is no inline "change event." (Req 4.6; design §3.1.)
5. **`measures` (the grand-staff pairing).** `measure := { rightHand?, leftHand?, barlineStart?, barlineEnd? }`. `rightHand`/`leftHand` are arrays of **events** — the two hands sounding over the same bar. Note explicitly that **hands need not be time-aligned and a measure's events need not fill its time signature** — timing is the author's responsibility (no timing validation). (Req 3; design §3.2; AC10.)
6. **`tempo` and `timeSignature`.** `tempo := { bpm (number > 0), beatUnit? (duration word) }`; `timeSignature := { beats (integer ≥ 1), beatType (integer ∈ {1,2,4,8,16,32}) }`. Call out the **deliberate asymmetry** (tempo's `beatUnit` is a *duration word* like `quarter`; time-signature's `beatType` is a *number* like `4`) so authors do not "correct" it. (Req 4.7; design §3.3.)
7. **Per-hand context (`handConfig`).** Used at `defaults.rightHand` / `defaults.leftHand` / `section.rightHand` / `section.leftHand`. Fields: `clef?` (enum: `treble | bass | alto | tenor`), `alters?` (a map *note-name → integer −2..+2*, the per-hand default accidentals / key-signature-like mechanism), `octaveShift?` (signed integer **−2..+2**: `+1`=8va, `−1`=8vb, `+2`=15ma, `−2`=15mb, `0`/absent=no shift). State the **inheritance/override rules** plainly: each field inherits independently (a section setting only `clef` keeps the inherited `alters`/`octaveShift`); **but the `alters` map REPLACES wholesale** when a section provides it (set `"alters": {}` to clear inherited defaults). Document fallbacks (clef absent → no forced default; alters absent → none; octaveShift absent → 0). (Req 4.5, 4.6; design §4.1.)
8. **Events.** `event := { type, duration, dots?, pitches?, dynamic?, chordSymbol?, tie?, slur? }`:
   - `type` (required): `note | rest`.
   - `duration` (required): `whole | half | quarter | eighth | sixteenth | thirty-second`.
   - `dots`: integer **0..2** (un-dotted / single / double dot).
   - `pitches`: array of **pitch** objects — **required & non-empty for a `note`, omitted for a `rest`** (the one conditional). A **chord** is simply several pitches in one event; a single note is a one-element `pitches`.
   - `dynamic`: enum `pp | p | mp | mf | f | ff | sf | sfz`.
   - `chordSymbol`: **free text** (open vocabulary — the deliberate exception to the otherwise-closed enums), e.g. `"C"`, `"Gm7"`.
   - `tie` / `slur`: enum `start | stop` (event-level). (Req 4.1, 4.3, 4.8; design §4.2.)
9. **Pitches.** `pitch := { step, octave, alter? }`: `step` (required, a note name — see §10), `octave` (required, integer **0..9**, scientific-pitch-notation number), `alter?` (per-note accidental, integer **−2..+2**, double-flat … double-sharp; overrides the section's `alters` default for that note name). (Req 4.2; design §4.3.)
10. **Note-name systems (English + Spanish) and case.** The two equivalent, mixable systems: English `C D E F G A B`; Spanish solfège `do re mi fa sol la si`; the documented equivalence **do=C, re=D, mi=E, fa=F, sol=G, la=A, si=B**. State that names are accepted **case-insensitively** (`C`/`c`, `do`/`Do`/`DO`), the same for `alters` keys, but the **recommended canonical spellings are uppercase English / lowercase solfège**, and the author's literal text is stored verbatim (never rewritten). (Req 4.4; AC9; design §4.4.)
11. **Barlines and repeats.** On the `measure` object: `barlineStart` / `barlineEnd`, each enum `regular | repeat-start | repeat-end | double | final`; absent ≡ regular. A repeated passage = `barlineStart: "repeat-start"` … `barlineEnd: "repeat-end"`. (Req 4.8; design §4.5.)
12. **How a stored pitch resolves to a sounding pitch (for the curious / future audio).** Briefly: effective alteration = per-note `alter` else section `alters` entry else 0; sounding octave = `octave` + section `octaveShift`. Frame as *intent / forward-looking*, not v1 behavior (there is no audio yet). (Req 6; design §4.6.)
13. **Additive growth (no version field).** Explain, author-facing: the format **has no `version` field** and grows by adding **optional** fields; a song written today stays valid as the format grows. Note the validation consequence the author can observe: **unknown fields are ignored** (so a misspelled optional field like `dynmic` is silently dropped from meaning, not flagged), whereas a **misspelled enumerated value** (e.g. `"quaver"` for a duration) **is** a conformance error. (Req 5; design §5.)
14. **Annotated example song.** Reproduce the design §9 annotated example **verbatim** (it exercises every required element — notes, rests, chord, dotted duration, per-note accidental, mixed English/Spanish names, per-hand clef/alters/octaveShift, the Section-2 mid-song tempo/time/clef/accidental changes, dynamics, chord symbol, ties/slurs, repeat + final barlines, metadata) and keep its inline comments. Precede it with one line noting it is illustrative JSONC (comments are for documentation; real stored JSON has no comments). Confirm the comment-free version passes the shipped validator. (AC5; design §9.)

**Depends on:** — (foundational; written first). Logically depends on the **code being shipped** (Tasks 2–6 of the code plan) so the field list/enums/ranges can be verified against `src/song/schema.js`.

**Traces to:** Req 2, 3, 4.1–4.9, 5, 6, 4.4/AC9, AC5, AC10; design §3, §4, §5, §7, §9.

**Acceptance:**
- Every field, enum, and integer range documented **matches the shipped `src/song/schema.js`** (and the walker special-cases in `src/song/validate.js`: note-name vocabulary + case-insensitivity, `alters` value range/keys, `bpm > 0`). A reviewer can diff the doc's field list against the schema and find no contradiction.
- The annotated example, with comments removed, is **accepted as conformant** by the shipped `validateSong` (cross-check against the Task-3 unit fixture, which transcribes the same §9 song).
- AC5's full element list is demonstrably covered by the example; AC9's two note-name systems and the equivalence table are present; AC10's "no timing validation / hands need not align" caveat is stated.
- No out-of-scope feature (audio, notation rendering, visual UI, `version`, import/export) is presented as present behavior.
- `docs/song-format.md` renders cleanly as Markdown (code fences closed, tables well-formed).
- Commit message: `Add song format reference (doc-writer)`.

---

## Task D2 — "Using the Piano block" usage guide

**Goal:** Document the **end-to-end author workflow**: insert the block, paste/edit the song JSON in the raw-JSON field, understand what the (informational, non-blocking) conformance validation does, and know what the front end outputs. This is the "how do I actually use this" doc that complements the format reference.

**Audience:** **Content authors / block users** (same primary reader as D1) — someone placing the Piano block in a post and entering a song.

**Files:**
- Update `README.md` — add a new top-level section (e.g. **"Using the Piano block"**) after "What the block does today". (Keep it concise; link to `docs/song-format.md` for field detail rather than repeating it.)

**Sections-scope** — verified against the shipped `src/edit.js` and `src/render.php`:

1. **Insert the block.** It appears in the inserter under **Media** (search "Piano"). (Consistent with existing README.)
2. **Enter a song.** The block's editor shows a single labeled **multi-line text field** (a `TextareaControl`) on the block canvas for the **raw song JSON**. Describe entering/pasting JSON there, and link to `docs/song-format.md` for the format. State the field's actual shipped **label/help text** (read them from `src/edit.js` — do not invent wording).
3. **A fresh block is empty.** A newly inserted block has **no song**: the field starts **blank** and nothing is stored. (Req 10; AC2; design §6.1.)
4. **What validation does.** The editor **checks conformance** to the song format as you type and shows a **clear, visible error** (an error notice beneath the field) when the content is not valid JSON or does not conform. Stress that this validation is **informational only and never blocks saving** — the raw text you typed is **always stored**, conformant or not; the error is guidance, not a gate. Note that validation runs only on **non-empty** input (an empty field shows no error), and that it is **structural/field** checking only — it does **not** check musical timing (a bar that does not "add up" still saves without a timing error). (Req 7, 8, 9, 10; AC2, AC4, AC6, AC10; design §6.2, §6.3.)
5. **What the front end shows (v1).** On the published page, the block outputs the **stored song content as text** (the JSON you entered), preserving your line breaks/indentation, inside a preformatted (`<pre>`) block. It performs **no validation** and renders **whatever is stored**; if there is no song, it outputs **nothing**. Set expectations explicitly: **v1 does not render musical notation or play audio** — the front end shows the song *as text*; visual notation and playback are future work. The output is **safely escaped**, so any HTML or script characters in the song appear as inert text (no markup executes). (Req 11, 12, 13; AC3, AC7, AC8; design §8.)
6. **Tip:** point authors to the annotated example in `docs/song-format.md` as a starting template to copy and adapt.

**Depends on:** Task D1 (links to `docs/song-format.md` for field detail).

**Traces to:** Req 7, 8, 9, 10, 11, 12, 13; AC2, AC3, AC4, AC6, AC7, AC8, AC10; design §6.2, §6.3, §8.

**Acceptance:**
- The described field (control type, label, help) **matches the shipped `src/edit.js`**; the described validation behavior (non-blocking, informational, error notice on non-empty invalid input, no timing checks) matches `src/edit.js` + `src/song/validate.js`.
- The described front-end output (text passthrough, `<pre>`, escaped, nothing when empty, **no notation/audio in v1**) matches the shipped `src/render.php` (design §8). No claim that the front end renders notation or plays sound.
- The "fresh block is empty" and "always stored even if invalid" statements correctly reflect AC2 and AC6.
- The new README section links to `docs/song-format.md` and does not duplicate its field tables.
- README still renders cleanly; existing sections are not broken.
- Commit message: `Document using the Piano block (doc-writer)`.

---

## Task D3 — Developer / contributor notes (format design, validator, additive growth)

**Goal:** Document, for contributors, **how the song feature is built**: the schema-as-data + zero-dependency validator design (and *why* — the project's zero-runtime-dependency stance), the additive-growth rules (no `version` field; lenient on unknown properties, closed on enumerated values), where the source lives, and the unit/e2e test commands that exercise it. This lets a future contributor extend the format correctly without re-deriving the rationale.

**Audience:** **Plugin developers / contributors** — people building on or extending the format/validator/block, not content authors.

**Files:**
- Update `README.md` — extend the existing **"For contributors"** section: add the new `src/song/` files to the file-layout table, add the new test scripts to the **Scripts** list, and add a short subsection on the song-format architecture (or link out to a dedicated note).
- (Optional, if the contributor content is long enough to bloat the README) Create `docs/song-format-internals.md` and link to it from the README's "For contributors" section. Prefer **one** home; do not split the same content across both.

**Sections-scope** — drawn from design §5, §6.1, §6.2, §7, §8 and the code plan, verified against shipped code:

1. **Where the song code lives.** Add to the README file-layout table (or the internals doc): `src/song/schema.js` (the declarative **schema-as-data**, the single source of truth for conformance), `src/song/validate.js` (the **zero-dependency** validator/walker that interprets the schema), and the test locations (`src/song/__tests__/validate.test.js` unit tests; `specs/render.spec.js` + `specs/editor.spec.js` e2e). Note `src/block.json` now declares the `song` attribute and `src/edit.js`/`src/render.php` were extended for it.
2. **Storage model.** The `song` block attribute is `type: "string"` with `default: ""` (design §6.1). Explain **why a string** (not object/array): it must store the author's **raw, possibly-non-conformant** input verbatim, which a parsed-JSON attribute type cannot; the empty string is the "no song" sentinel. As a dynamic block (`save: null`), it serializes into the block-comment delimiter. (Req 1, 9, 10; design §6.1.)
3. **Validation design (schema-as-data + purpose-built walker, no `ajv`).** Summarize design §6.2/§7: a declarative schema object is the single source of truth; a small recursive walker interprets a JSON-Schema **subset** (`type`, `required`, `properties`, `items`, `enum`, `$ref`/`$defs`, integer `minimum`/`maximum`, one `if`/`then` with a `const` discriminant, permissive `additionalProperties`). Three checks are handled directly by the walker (note-name vocabulary, case-insensitive; `alters` value range/keys; strict `bpm > 0`). **State the deliberate zero-third-party-dependency choice** (no `ajv`) and the recorded low-cost swap trigger (if the format outgrows the hand-rolled walker, adopt `ajv` consuming the *same* schema-as-data). (Req 2, 8; design §6.2, §7.) **Link to `src/song/schema.js` as the canonical schema; do not paste a divergent copy.**
4. **Conformance policy: lenient vs closed.** Document the rule contributors must preserve when extending the format: **unknown object properties are ignored** (forward-compatibility — an older validator must not hard-fail a song using a *future* optional field, which matters because there is **no `version` field**); **enumerated values are closed** (durations, clefs, dynamics, barlines, tie/slur, `type`, `beatType`) and a typo is a conformance error. State the accepted trade-off (a misspelled *optional* property is silently ignored). (Req 5; design §5.)
5. **Additive-growth rule for future work.** New capabilities (articulations, pedal, per-pitch ties, more octave-shift, triple dots, multiple voices, …) arrive as **new optional fields** on existing objects; never a breaking change, never a `version` field. Reference the spec's out-of-scope list as the backlog of additive candidates. (Req 5; design §5; spec "Out of Scope".)
6. **Render contract.** `render.php` is a **verbatim, escaped passthrough** (`esc_html` inside `<pre>` via `get_block_wrapper_attributes()`), outputs nothing when empty, and performs **no** validation or re-serialization — contributors must not add parsing/`json_encode` there (it would mutate the author's literal text). (Req 11, 12, 13; design §8.)
7. **Tests & commands.** Add `npm run test:unit` (Jest — the validator unit suite, no WP runtime) and `npm run test:e2e` (Playwright against `wp-env` — editor + front-end behavior) to the Scripts list, with the e2e prerequisite sequence (`npm install` → `npm run build` → `npm run env:start` → `npm run test:e2e`). Note unit tests cover the validator (incl. the comprehensive AC5 song, both note-name systems, structural-only) and e2e tests cover persistence/render/escaping. (Req 14; code plan Tasks 1, 3, 7, 8, 9.)

**Depends on:** Task D1 (references the format reference for the author-facing field detail), Task D2 (the README "Using the block" section should already exist so the contributor section sits coherently in the README). Logically depends on the **code being shipped** so file paths, scripts, and the schema match reality.

**Traces to:** Req 1, 2, 5, 8, 9, 10, 11, 12, 13, 14; design §5, §6.1, §6.2, §7, §8; code plan Tasks 1–9.

**Acceptance:**
- File paths (`src/song/schema.js`, `src/song/validate.js`, test files), the `song` attribute declaration, and the script names (`test:unit`, `test:e2e`) **exist in the shipped tree / `package.json`** exactly as documented (verify, don't assume).
- The schema-keyword subset, the three walker special cases, the lenient/closed policy, and the no-`ajv` / no-`version` stances **match design §5–§7 and the shipped `src/song/*`**. The contributor doc **links to** `src/song/schema.js` and does not embed a second, drifting schema copy.
- The render-contract description matches `src/render.php`.
- If a separate `docs/song-format-internals.md` is created, the README "For contributors" links to it and the content is not duplicated in both places.
- README (and the optional internals doc) render cleanly; the existing contributor content (build model, file layout, scripts) remains correct after the additions.
- Commit message: `Document song format and validator for contributors (doc-writer)`.

---

## Task D4 — README top-level refresh and cross-link / consistency pass

**Goal:** Update the README's **top-level framing** so it reflects that the block now **stores a song** (no longer a pure placeholder), wire up all the cross-links between README ↔ `docs/song-format.md` (↔ optional internals doc), and do a final **consistency pass** so no doc contradicts another or the shipped code. This is the integrating, last task.

**Audience:** **Both** — the first-time reader (top-of-README framing, status) and returning authors/contributors (navigation to the right doc).

**Files:**
- Update `README.md` — the intro/status blurb, "What the block does today", the file-layout table, and any "Forthcoming" wording; ensure links resolve.
- Touch `docs/song-format.md` and the optional `docs/song-format-internals.md` only for **cross-link fixes / minor consistency edits** surfaced by the pass (not a rewrite).

**Sections-scope:**

1. **Status / intro.** Revise the top **Status** note and **"What the block does today"** so they state the block now **stores a complete song as structured JSON** (right-hand + left-hand grand staff) via a raw-JSON editor field, validated for conformance (informational, non-blocking), and rendered on the front end as **escaped text** (not yet visual notation or audio). Keep the honest framing that **interactive keys, audio, and notation rendering remain future work** (consistent with the spec's out-of-scope set and the existing README tone). Do not overclaim. (Spec Overview + "Out of Scope"; design §1.)
2. **File-layout table.** Ensure `src/song/schema.js`, `src/song/validate.js`, and (briefly) the `specs/` e2e tests are present and accurately described; ensure `src/block.json`, `src/edit.js`, `src/render.php` descriptions are updated to mention the `song` attribute / raw-JSON field / passthrough render if Task D3 did not already. (Avoid duplicating D3's additions — reconcile, don't repeat.)
3. **Cross-links.** README → `docs/song-format.md` (from both the new "Using the Piano block" section and a pointer near the top) and, if present, README "For contributors" → `docs/song-format-internals.md`. Verify the **format reference and usage docs reference each other** where helpful. All relative links must resolve from the repo root.
4. **"Forthcoming" section.** Update so it lists the still-deferred work accurately (visual notation rendering, audio playback, richer notation elements, a visual authoring UI), now that *song storage* has landed — i.e. move "store song data" out of the forthcoming/placeholder framing. (Spec "Out of Scope".)
5. **Consistency sweep (the core of this task).** Read all three docs (README, `docs/song-format.md`, optional internals) together and confirm: field names/enums/ranges agree across docs and with `src/song/schema.js`; the validation story (non-blocking, informational, structural-only) is told the same way in usage and contributor docs; the render story (escaped `<pre>` passthrough, nothing when empty, no notation/audio) is consistent; no doc presents an out-of-scope feature as shipped; every internal link resolves. Fix any drift found in the owning doc.

**Depends on:** Tasks D1, D2, D3 (all the docs must exist to cross-link and consistency-check them).

**Traces to:** spec Overview + "Out of Scope"; Req 1, 11, 12, 13, 14; design §1, §6.1, §8; integrates D1–D3.

**Acceptance:**
- The README no longer describes the block as a pure placeholder for *song storage*; it accurately states song storage shipped while keeping notation-rendering/audio/visual-UI as future work — with **no overclaim** (no "renders notation" / "plays audio").
- Every internal Markdown link across README and `docs/` **resolves** (no dead relative links); the README ↔ format-reference cross-links exist in both directions where the plan calls for them.
- The consistency sweep finds (and the task fixes) **no contradiction** between docs or against the shipped code on: field/enum/range names, the validation behavior, and the render behavior. A reviewer re-reading all docs finds them mutually consistent and code-accurate.
- The file-layout table is complete and correct for the shipped tree (`src/song/*`, `specs/*`).
- All touched docs render cleanly as Markdown.
- Commit message: `Refresh README for song storage and cross-link docs (doc-writer)`.

---

## Task dependency summary

```
D1 (song format reference — docs/song-format.md)        ── canonical field reference
   ├─► D2 (usage guide — README "Using the Piano block") ── links to D1
   └─► D3 (contributor notes — README "For contributors" [+ optional internals doc]) ── links to D1
            └─► D4 (README top-level refresh + cross-link/consistency pass) ── integrates D1–D3
```

Order: **D1 → D2 → D3 → D4.** All four logically follow the **code phase** (the docs describe shipped behavior). D1 is foundational (the canonical reference everything links to); D2 and D3 both build on it for the two audiences; D4 integrates and consistency-checks the whole set last.

## What is intentionally NOT a separate doc task (scope discipline)

- **Inline narrative comments in the schema/validator.** `src/song/schema.js` is designed to **double as documentation** (annotated inline) and the code plan (Tasks 2–3) already mandates those comments; the contributor doc (D3) **links to** that module rather than duplicating it. No separate "comment the code" doc task — those comments ship with the code.
- **The annotated example song** is authored once (design §9) and reproduced once (in D1's format reference); it is not re-copied into usage/contributor docs (they link to it).
- **A standalone schema/field reference duplicated in prose.** Avoided deliberately — a second hand-maintained copy of the schema would drift from `src/song/schema.js` (the single source of truth). D1 documents the format for authors and verifies against the schema; D3 points contributors at the schema module itself.
- **API/function-level docs for the validator internals.** Out of scope for v1 docs — the validator is internal; contributors read the (commented) source. D3 explains the *design and rules*, not a function-by-function API.
- **Audio / notation-rendering / visual-authoring-UI / import-export / `version`-field docs.** Out of scope per the spec; named only as *future / not-yet-supported* where it prevents misleading an author, never documented as behavior.
- **The plugin header (`piano-block.php`) description.** A code/metadata concern, not a docs-phase deliverable; left to the code phase if it wants to refresh the one-line description. The docs plan does not task it.

## Coverage check (plan → spec/design)

- **Song JSON format reference for authors** (structure, fields, enums, ranges, English+Spanish names + equivalence, inheritance/override, accidental resolution, annotated example): **D1** — Req 2, 3, 4.1–4.9, 5, 6; AC5, AC9, AC10; design §3–§5, §7, §9.
- **How to use the block** (insert, raw-JSON field, informational non-blocking validation, escaped text front-end output, empty state): **D2** — Req 7, 8, 9, 10, 11, 12, 13; AC2, AC3, AC4, AC6, AC7, AC8; design §6.2, §6.3, §8.
- **Developer/contributor notes** (schema-as-data + zero-dependency validator, lenient/closed policy, additive-growth/no-`version`, string-attribute storage, render contract, test commands): **D3** — Req 1, 2, 5, 8, 9, 10, 11, 12, 13, 14; design §5, §6.1, §6.2, §7, §8.
- **README updated** (top-level framing for shipped song storage, file layout, scripts, cross-links, consistency): **D2 + D3 + D4** — spec Overview + "Out of Scope"; Req 14; design §1.
- **Accuracy to shipped code** (every doc verified against `src/song/schema.js`, `src/song/validate.js`, `src/block.json`, `src/edit.js`, `src/render.php`): enforced in every task's Acceptance and the D4 consistency sweep.
