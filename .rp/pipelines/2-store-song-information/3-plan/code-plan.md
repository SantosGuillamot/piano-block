# Code Plan: Store song information in the Piano block

_Implementation plan for GitHub issue #2 (pipeline `2-store-song-information`). Turns the **approved design** (`2-design-doc/design-doc.md`) into a sequence of discrete, ordered, test-driven coding tasks that satisfy the spec (`1-spec/spec.md`, requirements 1–14, AC1–AC10). The design doc is the single source of truth for HOW; this plan does not re-open any settled decision — it only sequences and operationalizes them._

## How to use this plan

- The code phase dispatches **one fresh `code-writer` per task**, sequentially, on the shared branch `worktree-2-store-song-information`. Each task block below is self-contained: it states its **Goal**, the **Files** it touches, the **Changes** to make (design-aligned), what it **Depends on**, what it **Traces to**, and its **Acceptance** (the specific unit/e2e tests that prove it).
- **Test-driven:** for tasks that have automated tests, write the test(s) first (red), then implement until green. Unit tests target the pure validator/schema modules (no WordPress runtime). End-to-end tests target the built block in `wp-env` (real WordPress).
- **Run from the worktree root** `/Users/santosguillamot/Desktop/Code/SantosGuillamot/piano-block/.claude/worktrees/2-store-song-information`. Absolute paths are used throughout.
- **`node_modules` is absent** in this worktree and **`build/` is git-ignored** — Task 1 installs deps; the build and the e2e environment are stood up where first needed. Commit source only; never commit `node_modules/` or `build/`.

## Conventions every task follows

- **Module system / style:** JS source is ES modules with `import`, double-quoted strings, tab indentation — matching `src/index.js`, `src/edit.js`, and `biome.json` (`indentStyle: "tab"`, `quoteStyle: "double"`, recommended lint rules). Run `npm run check` (Biome format+lint with `--write`) before finishing any JS task so committed code is clean.
- **Zero runtime dependencies (design §6.2, requirement 2):** do **NOT** add `ajv` or any third-party validation/JSON-Schema library. The validator is purpose-built. New dev-only tooling is acceptable only if already provided transitively by `@wordpress/scripts` (Jest, Playwright, the e2e utils) — no new entries in `dependencies`, and prefer none in `devDependencies` beyond what the scaffold and `@wordpress/scripts` already bring.
- **i18n:** all user-facing editor strings go through `@wordpress/i18n` `__()` with the `"piano-block"` text domain, consistent with `src/edit.js`.
- **Schema-as-data is the single source of truth (design §7):** the validator interprets the declarative schema object; conformance rules are not duplicated in prose-only form elsewhere.
- **Validation is structural/field only (design §6.2, AC10):** no musical-timing checks (no measure-duration arithmetic, no hand time-alignment). Unknown object properties are **ignored** (lenient, design §5); enumerated values are **closed** (a typo is an error).
- **Commit messages:** imperative mood, sentence case, no trailing period, agent in parentheses — e.g. `Add song schema-as-data module (code-writer)`. Commit only the files the task touches.

---

## Task 1 — Install dependencies and add test scripts

**Goal:** Make the worktree buildable and test-runnable: install the scaffold's dev toolchain (which transitively provides Jest + Playwright via `@wordpress/scripts`) and expose `test-unit-js` / `test-playwright` as npm scripts so every later task can run tests with a stable command.

**Files:**
- Modify `package.json` (add test scripts).
- (Generated, not committed) `node_modules/` via `npm install`.

**Changes:**
1. Run `npm install` from the worktree root (installs `@wordpress/scripts@^32`, `@wordpress/env`, `@biomejs/biome` per the existing `package.json` / `package-lock.json`). This brings in Jest (`@wordpress/jest-preset-default`) and Playwright (`@wordpress/e2e-test-utils-playwright`) transitively — confirm both resolve under `node_modules/@wordpress/`.
2. Add these scripts to `package.json` `"scripts"` (alongside the existing `build`/`lint`/`env:*`):
   - `"test:unit": "wp-scripts test-unit-js"`
   - `"test:e2e": "wp-scripts test-playwright"`
   - `"env:cli": "wp-env run tests-cli"` is **not** required; omit unless a later task needs it.
3. Do **not** add any runtime `dependencies`. Do **not** hand-add Jest/Playwright to `devDependencies` — they come transitively from `@wordpress/scripts`; adding them directly is acceptable only if a later task proves a direct import needs an explicit entry (it should not).

**Depends on:** —

**Traces to:** requirement 14 (build on the `@wordpress/scripts` scaffold); enables the test infrastructure all later tasks rely on.

**Acceptance:**
- `npm install` completes without error; `node_modules/@wordpress/scripts`, `node_modules/@wordpress/jest-preset-default`, and `node_modules/@wordpress/e2e-test-utils-playwright` all exist.
- `npm run test:unit` runs and exits cleanly reporting **no tests found** (no test files yet) — proving the Jest runner is wired.
- `npm run build` still succeeds (the scaffold builds), confirming the toolchain is intact.
- Commit: only the `package.json` change (`node_modules/` is git-ignored). Suggested message: `Add unit and e2e test scripts (code-writer)`.

---

## Task 2 — Add the song schema-as-data module

**Goal:** Create the declarative **schema-as-data** object (design §7) — the single, machine-readable source of truth for "what is a conformant song." This is pure data with no logic; the validator (Task 3) interprets it.

**Files:**
- Create `src/song/schema.js`.

**Changes:**
1. Export a single default (or named `songSchema`) object that is the literal schema from design §7, transcribed faithfully. It uses only this keyword subset: `type`, `required`, `properties`, `items`, `enum`, `$ref` / `$defs`, integer `minimum` / `maximum`, one `if`/`then` (discriminant via `const`), and **permissive** `additionalProperties` (unknown keys ignored — so do not set `additionalProperties: false` anywhere).
2. Mirror the design §7 structure exactly:
   - Root: `type: "object"`, `required: ["sections"]`, properties `metadata`, `defaults` (`$ref` → `#/$defs/context`), `sections` (array of `#/$defs/section`).
   - `$defs`: `context` (shared by `defaults` and `section`: `tempo`, `timeSignature`, `rightHand`, `leftHand`), `section` (`required: ["measures"]` + the four context overrides + `measures` array of `measure`), `measure` (`rightHand`/`leftHand` arrays of `event`, `barlineStart`/`barlineEnd` enums), `tempo` (`required: ["bpm"]`; `bpm` `type: "number"`; `beatUnit` duration enum), `timeSignature` (`required: ["beats","beatType"]`; `beats` integer ≥ 1; `beatType` enum `[1,2,4,8,16,32]`), `handConfig` (`clef` enum; `alters` `type: "object"`; `octaveShift` integer −2..+2), `event` (`required: ["type","duration"]`; `type` enum `["note","rest"]`; `duration` six-value enum; `dots` integer 0..2; `pitches` array of `pitch`; `dynamic` eight-value enum; `chordSymbol` string; `tie`/`slur` enum `["start","stop"]`; plus the `if type=note then required pitches` conditional), `pitch` (`required: ["step","octave"]`; `step` string; `octave` integer 0..9; `alter` integer −2..+2).
3. The three checks the keyword subset cannot fully express are **left to the walker** (Task 3), not encoded here — but add brief comments at `tempo.bpm` ("strict bpm>0 enforced by walker"), `handConfig.alters` ("note-name keys + −2..+2 integer values enforced by walker"), and `pitch.step` / `alters` keys ("note-name vocabulary, case-insensitive, enforced by walker"), matching the design's annotations so the file doubles as documentation.
4. No imports, no side effects — this is a data module. Keep it readable (the design notes it is publishable verbatim as documentation).

**Depends on:** Task 1 (so the file lints/tests under the installed toolchain).

**Traces to:** design §7 (schema-as-data), §5 (lenient unknown / closed enums); requirements 2, 4.1–4.9, 5, 8; underpins AC4, AC5, AC6, AC9, AC10.

**Acceptance:**
- Verified indirectly by Task 3's unit tests (the validator consumes this schema to accept/reject fixtures). No standalone test needed, but a minimal sanity unit test may assert the module exports an object with `required: ["sections"]` and a `$defs.event` whose `if`/`then` enforces `pitches` for notes.
- `npm run check` passes on the new file.
- Commit message: `Add song schema-as-data module (code-writer)`.

---

## Task 3 — Add the zero-dependency validator/walker (with unit tests)

**Goal:** Implement the small, purpose-built, **zero-dependency** validator (design §6.2 option ii, §7) that parses a raw string and walks it against `schema.js`, returning a list of human-readable, path-pointed errors (`[]` when conformant). This is the conformance engine; it is fully testable in isolation with Jest (no WordPress runtime).

**Files:**
- Create `src/song/validate.js`.
- Create `src/song/__tests__/validate.test.js`.
- (Optional) Create `src/song/__tests__/fixtures/` (or inline fixtures) holding conformant/non-conformant sample songs, including the AC5 comprehensive song.

**Changes (TEST-FIRST — write the failing tests in step A before implementing B):**

**A. Unit tests (`validate.test.js`)** — cover, at minimum:
- **Valid-JSON gate (AC6):** a string that is not parseable JSON → exactly one error flagged as an invalid-JSON / parse error; a well-formed-but-non-conformant object → schema errors (see below). (The function under test receives the **raw string** and does the `JSON.parse` itself, so this is a single entry point.)
- **Minimal conformant song (design §3):** `{"sections":[{"measures":[]}]}` → no errors.
- **AC5 comprehensive song:** transcribe the **annotated example song from design §9** verbatim as a fixture (notes, rests, the 3-pitch chord, `dots:1`, per-note `alter` on F#2, mixed English + Spanish names, per-hand `clef`/`alters`/`octaveShift`, Section-2 mid-song tempo/time/clef/`alters` changes, `mf`/`p` dynamics, `chordSymbol:"C"`, `tie`/`slur` start+stop, `repeat-start`/`repeat-end`/`final` barlines, `metadata` title/composer) → **no errors** (AC5).
- **AC9 both note-name systems:** a pitch `{"step":"G","octave":4}` and the equivalent `{"step":"sol","octave":4}` both → no errors; also assert case-insensitivity (`"g"`, `"DO"`, `"Sol"` accepted) and that an unrecognized name (`"H"`, `"doh"`) → an error.
- **Closed-enum errors (design §5):** a typo'd `duration:"quaver"`, `clef:"treble-clef"`, `dynamic:"mezzo"`, `barlineEnd:"repeat"`, `type:"chord"`, `beatType:3`, `tie:"begin"` each → an error whose message includes the offending JSON path.
- **Type / required / nesting errors:** missing top-level `sections` → error; a `section` missing `measures` → error; an `event` missing `type` or `duration` → error; a `pitch` missing `step` or `octave` → error; `sections` not an array, `measures` not an array, a hand value not an array → type errors.
- **The one conditional (design §4.2):** a `type:"note"` event with **no `pitches`**, or with an **empty** `pitches` array, → error; a `type:"rest"` with no pitches → no error.
- **Integer-range errors:** `octave:10` / `octave:-1`, `alter:3`, `octaveShift:3`, `dots:3`, `timeSignature.beats:0`, → errors; in-range values → no error.
- **Walker special cases (design §7):** `tempo.bpm:0` and a negative bpm → error (strict `bpm>0`), `bpm:1` → no error; `alters:{"F":1}` → ok, `alters:{"F":3}` (value out of −2..+2) → error, `alters:{"H":1}` (bad note-name key) → error, `alters:{}` → ok.
- **Lenient unknown properties (design §5):** an object carrying an unknown key (e.g. `"dynmic":"f"` on an event, or `"foo":1` at the root) → **no error** (ignored, not flagged).
- **AC10 structural-only:** a structurally-valid song whose measure durations do **not** sum to the time signature, and whose two hands are different total lengths, → **no error** (no timing validation). Include this as an explicit test so the absence of timing checks is asserted, not assumed.

**B. Validator (`validate.js`)** — implement a small recursive walk that satisfies the tests:
- Export a primary function, e.g. `validateSong(rawString)` → `string[]` (list of error messages; empty = conformant). Internally: `try { data = JSON.parse(rawString) } catch (e) { return [<invalid-JSON message>] }`, then `return validateValue(data, schema, "")` collecting errors.
- Interpret the schema-as-data keywords: resolve `$ref`/`$defs`; check `type` (with a correct **integer** check — `Number.isInteger`, since JSON has no integer type and JS `typeof` of `1.5` is `"number"`); enforce `required`; recurse `properties` and array `items`; check `enum` membership; check integer `minimum`/`maximum`; evaluate the single `if`/`then` (`type === "note"` ⇒ require non-empty `pitches`). Leave `additionalProperties` **permissive** (do not error on unknown keys).
- Implement the **three walker special cases** directly (design §7): (i) `pitch.step` and `alters` **keys** matched case-insensitively against the closed two-system vocabulary — English `C D E F G A B`, Spanish `do re mi fa sol la si`; (ii) `alters` values must be integers in −2..+2; (iii) `tempo.bpm` strict `> 0`. Define the note-name vocabulary as a single constant (e.g. lowercased set) reused for both `step` and `alters` keys, so the equivalence is encoded once.
- **Error messages** are human-readable and **path-pointed**, e.g. `"sections[0].measures[1].rightHand[0].duration: \"quaver\" is not an allowed duration"` (design §6.2 "first-class errors"). Tests assert substrings (the path and/or the offending value), not exact full strings, to avoid brittleness.
- Keep it dependency-free and compact (the design estimates ~100–150 lines). No `ajv`, no external libs.

**Depends on:** Task 2 (consumes `schema.js`), Task 1 (Jest available).

**Traces to:** design §6.2 (validation approach), §7 (schema + walker special cases), §5 (lenient/closed), §4.2 (note→pitches conditional), §4.4 (note-name systems/case); requirements 2, 8; AC4, AC5, AC6, AC9, AC10.

**Acceptance:**
- `npm run test:unit` runs `validate.test.js` and **all assertions pass** (red→green). The AC5, AC9, and AC10 tests in particular must pass, since they are the format-coverage acceptance criteria.
- `npm run check` passes on the new files.
- Commit message: `Add song conformance validator (code-writer)`.

---

## Task 4 — Declare the `song` attribute in block.json

**Goal:** Add the storage attribute (design §6.1): a single `song` of `type: "string"` with `default: ""`. This is the minimal declaration satisfying requirements 1, 9, 10 and AC1, AC2, AC6.

**Files:**
- Modify `src/block.json`.

**Changes:**
1. Add an `"attributes"` member to `src/block.json` (the scaffold has none today):
   ```jsonc
   "attributes": {
     "song": { "type": "string", "default": "" }
   }
   ```
   Place it among the existing top-level keys (e.g. after `"keywords"`/`"textdomain"`, before the script/style/render file keys) — exact position is cosmetic; valid JSON is what matters.
2. Do **not** add a `source` (dynamic block — `save: null`; the value lives in the block-comment delimiter, design §6.1). Do **not** introduce any other attribute (single-`song` mandate, requirement 1).
3. Leave `render`, `editorScript`, `style`, `apiVersion: 3`, etc. unchanged (requirement 14).

**Depends on:** Task 1 (build available to confirm the block still registers).

**Traces to:** design §6.1; requirements 1, 9, 10, 14; AC1, AC2, AC6.

**Acceptance:**
- `npm run build` succeeds and the built `build/block.json` contains the `song` attribute (the build copies `block.json`).
- Validity confirmed at runtime by the Task 7/8 e2e tests (AC1/AC2). No standalone test here.
- Commit message: `Add song string attribute to block definition (code-writer)`.

---

## Task 5 — Editor: raw-JSON `TextareaControl` with non-blocking validation `Notice`

**Goal:** Build the authoring affordance (design §6.3): bind a labeled `TextareaControl` to the `song` attribute, call `setAttributes({ song: rawText })` **unconditionally** on every change (raw text always persists), run the Task-3 validator on **non-empty** input as a pure side-computation, and render a non-blocking error `Notice` only when validation fails on non-empty input. Validation never blocks saving, never clears the field, never substitutes a parsed value.

**Files:**
- Modify `src/edit.js`.
- (No change expected to `src/index.js` — it already wires `Edit`; confirm it still imports/render `Edit` and that `block.json` provides attributes. Touch it only if the build requires it.)

**Changes:**
1. **Edit component (`src/edit.js`):** accept the standard block-edit props `{ attributes, setAttributes }`. Read `const { song } = attributes;`.
2. **Field:** render a `TextareaControl` from `@wordpress/components` with:
   - `label` = `__("Song (JSON)", "piano-block")` (or similar clear label),
   - `help` = a short `__()` hint that this is the raw song JSON (optionally noting validation is informational),
   - `value={ song }`,
   - `onChange={ (next) => setAttributes({ song: next }) }` — **always** sets the attribute to the raw text (design §6.3 step 1: unconditional persistence),
   - `rows` (e.g. 8–12) and, optionally, a monospace `className` for a code-like feel.
   Wrap the control in the block element via `useBlockProps()` (the scaffold's pattern) so the field renders **on the block canvas** (design §6.3 placement). Keep the textarea controlled (its value is the stored attribute) so the round-trip is faithful.
3. **Validation (pure, presentational):** compute the error list from the current `song` string using `validateSong` from `src/song/validate.js` — e.g. `const errors = song.trim() === "" ? [] : validateSong(song);` Use `useMemo` keyed on `song` (import from `@wordpress/element`) so it recomputes only when the text changes. Validation must **not** call `setAttributes` and must **not** mutate the field.
4. **Error surfacing:** when `errors.length > 0` **and** `song` is non-empty, render a `Notice` from `@wordpress/components` with `status="error"` and non-dismissible (`isDismissible={ false }`), beneath the textarea, showing a clear human-readable message — the first error (with its JSON path) or a short summary list. When the field is empty (AC2) or conformant (AC4), render **no** notice. Wrap any static notice chrome strings in `__()`.
5. **Imports:** `TextareaControl`, `Notice` from `@wordpress/components`; `useBlockProps` from `@wordpress/block-editor`; `useMemo` from `@wordpress/element`; `__` from `@wordpress/i18n`; `validateSong` from `./song/validate`. Keep the file's doc-comment style consistent with the existing `src/edit.js`.
6. Do **not** block, debounce-gate, or discard input; debouncing is an optional perf nicety explicitly **not** required (design §6.3) — skip it.

**Depends on:** Task 3 (`validateSong`), Task 4 (`song` attribute exists so `setAttributes` persists it), Task 1 (build).

**Traces to:** design §6.3 (data flow, components, placement, states), §6.1 (raw string persists); requirements 7, 8, 9, 10; AC2, AC4, AC6.

**Acceptance:**
- `npm run build` succeeds; `npm run check` passes.
- Behavior is proven by the Task-8 e2e tests (AC2 empty-by-default, AC4 conformant→no error, AC6 non-conformant→error notice + still stored, AC1 round-trip). If a fast unit-level check is cheap, a Jest + React Testing Library render test of `Edit` (empty → no notice; invalid JSON → error notice; valid → no notice; every change calls `setAttributes` with the raw text) is encouraged but the e2e tests are the authoritative proof.
- Commit message: `Add raw-JSON song field with non-blocking validation (code-writer)`.

---

## Task 6 — Front end: `render.php` escaped `<pre>` passthrough

**Goal:** Replace the placeholder `render.php` with the design §8 behavior: read `song` defensively, output **nothing** when empty/whitespace-only, otherwise emit the stored string **verbatim** as an `esc_html`-escaped text node inside a `<pre>` carrying `get_block_wrapper_attributes()`. No validation, no re-serialization (requirement 11), escaped so no script executes (AC8).

**Files:**
- Modify `src/render.php`.

**Changes:**
1. Read the value defensively (design §8): `$song = isset( $attributes['song'] ) ? (string) $attributes['song'] : '';` — the `isset` guard avoids a PHP 8 "Undefined array key" warning for older instances with no `song`; the `(string)` cast coerces any non-string value. (This supersedes the design §2 sketch's `?? ''`; use the §8 defensive read — the design flags this as the tidy-up to apply.)
2. **Empty state (requirement 12, AC3):** `if ( '' === trim( $song ) ) { return; }` — output nothing (no wrapper, no element) when empty, unset, or whitespace-only.
3. **Output:** echo a single `<pre>` whose attributes come from `get_block_wrapper_attributes()` echoed **directly** (it returns a pre-escaped string — do **not** wrap it in `esc_attr()`, which would double-escape, per design §8 and the scaffold's existing rule), with the body `esc_html( $song )`:
   ```php
   <pre <?php echo get_block_wrapper_attributes(); ?>><?php echo esc_html( $song ); ?></pre>
   ```
   Keep the inner content tight to the `<pre>` tags (no surrounding newlines inside the element) so the author's own whitespace is what shows.
4. **No** `wp_json_encode` / `json_decode` / parsing / validation — `song` is opaque text; the only branch is the empty check (design §8, requirement 11). Update the file's doc-comment to describe the verbatim escaped passthrough (drop the placeholder wording).

**Depends on:** Task 4 (the `song` attribute is what `$attributes['song']` reads; render works even pre-Task-4 since it defends with `isset`, but logically the attribute should exist).

**Traces to:** design §8 (passthrough, escaping, `<pre>`, empty-state, no validation), §2 (`?? ''` → §8 defensive-read tidy-up); requirements 11, 12, 13, 14; AC3, AC7, AC8.

**Acceptance:**
- `npm run build` succeeds (build copies `render.php` into `build/`).
- Proven by Task-7 e2e tests: AC3 (empty → nothing), AC7 (stored song appears as a string on the front end), AC8 (an XSS payload renders escaped/inert). No PHP unit harness is set up in this scaffold, so verification is via e2e against `wp-env`.
- Commit message: `Render stored song as escaped pre passthrough (code-writer)`.

---

## Task 7 — End-to-end tests: front-end render (AC3, AC7, AC8) + e2e harness setup

**Goal:** Stand up the Playwright e2e harness (config + plugin activation) and prove the **front-end** acceptance criteria against a real built block in `wp-env`: empty block renders nothing meaningful (AC3), a stored song appears serialized as a string (AC7), and a hostile `song` renders escaped and inert (AC8). This task creates the shared e2e scaffolding the next task reuses.

**Files:**
- Create `playwright.config.js` (worktree root) — extends the `@wordpress/scripts` base Playwright config.
- Create `specs/render.spec.js` (Playwright's default test glob is `*.spec.js` / `*.test.js` in a root-level `/specs` folder).
- (Possibly) Create `specs/.eslintrc`-equivalent is **not** needed; Biome governs lint — ensure these files pass `npm run check`.

**Changes:**

1. **Playwright config (`playwright.config.js`):** extend the base config shipped by `@wordpress/scripts` so WordPress-specific globals (base URL, storage state, the e2e fixtures, artifacts path) are inherited. Concretely, import the base from `@wordpress/scripts/config/playwright.config.js` and re-export a config that sets `testDir` to `./specs` (and a sensible single project / `webServer` left to the base). **The code-writer must confirm the exact base-config path/shape once `npm install` has run** (`node_modules/@wordpress/scripts/config/playwright.config.js`); if the import path differs in the installed version, mirror the minimal fields the base sets (`use.baseURL` from `WP_BASE_URL` default `http://localhost:8888`, `globalSetup`/`storageState` from the e2e utils) rather than inventing new ones. Do not hardcode credentials — the e2e utils read `WP_USERNAME`/`WP_PASSWORD` (default `admin`/`password`, matching `wp-env`).
2. **Environment:** these tests require a **running `wp-env`** with the **built** plugin. Document in the spec file header (and rely on the run steps in Acceptance) that the sequence is `npm install` → `npm run build` → `npm run env:start` → `npm run test:e2e`. Use `requestUtils.activatePlugin( "piano-block" )` (the plugin slug/folder) in `test.beforeAll` so the block is active, and `requestUtils.deleteAllPosts()` in `beforeAll`/`afterAll` to keep posts clean. Import `{ test, expect } from "@wordpress/e2e-test-utils-playwright"`.
3. **Tests (`specs/render.spec.js`):**
   - **AC3 — empty renders nothing:** `admin.createNewPost()`, `editor.insertBlock({ name: "piano-block/piano" })`, leave the song field blank, `editor.publishPost()`, navigate `page` to the published post's front-end URL (derive it from the publish panel's view link or `requestUtils`/permalink), and assert the front end contains **no** `pre` element from this block / no song content (e.g. the block's wrapper `<pre>` is absent). Assert the page did not render an empty song element.
   - **AC7 — stored song appears as a string:** insert the block, type a small conformant song JSON into the `TextareaControl` (locate it in `editor.canvas` by its label, fill it), publish, view the front end, and assert the rendered output **contains the stored song text** (e.g. a recognizable substring like `"sections"` and a pitch `"step": "C"`), inside a `<pre>`.
   - **AC8 — escaped output:** set `song` to a payload containing `<script>alert(1)</script>` and HTML-significant characters (`<`, `>`, `&`, quotes), publish, view the front end, and assert: (a) the page's **HTML source** contains the **escaped** form (`&lt;script&gt;` etc.) — i.e. the literal text is escaped — and (b) there is **no live `<script>`** injected by the block (the payload is inert text inside `<pre>`, not an executing element). Asserting the escaped entities are present in content and that `page.locator("pre script")` finds nothing demonstrates no XSS.
4. Keep selectors resilient: prefer role/label-based locators (`getByLabel`, `getByRole`) over brittle CSS; for the front-end `<pre>`, scope to the block wrapper class if needed.

**Depends on:** Task 6 (render behavior), Task 5 (editor field to type into), Task 4 (`song` attribute), Task 1 (Playwright + scripts installed). Requires the block to be **built** (`npm run build`) and `wp-env` **running**.

**Traces to:** design §8 (render), §12.2 (AC3/AC8 are the Code-phase runtime verifications); requirements 11, 12, 13; AC3, AC7, AC8.

**Acceptance:**
- With `npm run build` done and `npm run env:start` up, `npm run test:e2e` runs `specs/render.spec.js` and **all three tests pass** (AC3, AC7, AC8 green). The AC8 test must confirm both the presence of escaped entities and the absence of an executing `<script>` from the block.
- `npm run check` passes on `playwright.config.js` and the spec file.
- Commit message: `Add front-end render e2e tests (code-writer)`.

---

## Task 8 — End-to-end tests: editor behavior (AC1, AC2, AC4, AC6)

**Goal:** Prove the **editor + persistence** acceptance criteria against the real built block in `wp-env`, reusing the Task-7 harness: the `song` attribute persists across save/reload (AC1), a fresh block is empty (AC2), conformant input shows no error and is stored (AC4), and non-conformant input is flagged by a visible error **yet still stored** (AC6).

**Files:**
- Create `specs/editor.spec.js`.

**Changes:**
1. Reuse the Task-7 Playwright config and the `{ test, expect }` import + `requestUtils` plugin-activation / post-cleanup pattern (`activatePlugin("piano-block")`, `deleteAllPosts()` in before/after hooks).
2. **Tests (`specs/editor.spec.js`):**
   - **AC2 — new block starts empty:** `admin.createNewPost()`, `editor.insertBlock({ name: "piano-block/piano" })`, locate the `TextareaControl` by its label in `editor.canvas`, assert its value is **empty**, and assert `editor.getBlocks()` shows the block with `attributes.song === ""` (no song stored).
   - **AC4 — conformant → no error, stored:** type a conformant song (a small valid document) into the field; assert **no** error `Notice` is visible (e.g. `editor.canvas.getByText(<error fragment>)` / a notice with `status=error` is absent), and assert `editor.getBlocks()[0].attributes.song` equals the typed text.
   - **AC6 — non-conformant → flagged but stored:** type clearly non-conformant content (both cases worth covering: (i) **invalid JSON** like `{ not json`, and (ii) **valid JSON but non-conformant** like `{"sections":[{"measures":[{"rightHand":[{"type":"note","duration":"quaver"}]}]}]}`); assert a **visible error `Notice`** appears (status error, e.g. text contains a path/`duration`/`JSON` fragment), **and** assert `editor.getBlocks()[0].attributes.song` still equals the exact typed text — proving persistence is unconditional (design §6.3).
   - **AC1 — save/reload round-trip:** type a conformant song, `editor.publishPost()`, then reload the editor for that post (e.g. `page.reload()` or `admin.visitAdminPage("post.php", "post=<id>&action=edit")`), re-locate the block, and assert its `song` attribute (via `editor.getBlocks()`) and the textarea value are **identical** to what was entered — the same value present after reload (AC1). Special characters (quotes/`<`/`&`) in the song should round-trip faithfully; include at least one such character to exercise the delimiter-comment escaping (design §6.1).
3. Resilient, label/role-based locators as in Task 7. When asserting "no error notice," prefer asserting the specific error region is **not** present rather than a blanket negative on all notices (the editor shows unrelated notices).

**Depends on:** Task 7 (Playwright config + harness conventions), Task 5 (editor field + validation), Task 4 (attribute), Task 1. Requires `npm run build` + `wp-env` running.

**Traces to:** design §6.1 (round-trip/serialization), §6.3 (states, unconditional persistence), §12.2 (AC1 round-trip is a Code-phase runtime verification); requirements 7, 8, 9, 10; AC1, AC2, AC4, AC6.

**Acceptance:**
- With the block built and `wp-env` up, `npm run test:e2e` runs `specs/editor.spec.js` and **all four tests pass** (AC1, AC2, AC4, AC6 green). The AC6 test must assert **both** the visible error and the unchanged stored value.
- `npm run check` passes.
- Commit message: `Add editor persistence and validation e2e tests (code-writer)`.

---

## Task 9 — Final verification: full build, lint, and test sweep

**Goal:** Confirm the whole feature is coherent end-to-end: clean build, clean lint, all unit tests green, all e2e tests green against `wp-env`. Catch any cross-task regression before the Docs phase.

**Files:**
- None expected. If the sweep surfaces a small defect (lint nit, a flaky selector, a missed `__()` wrap), fix it in the **owning** file and note it.

**Changes / steps (run in order from the worktree root):**
1. `npm install` (if not already current).
2. `npm run check` — Biome format+lint passes across `src/`, `specs/`, `playwright.config.js` with no errors.
3. `npm run test:unit` — the validator unit suite (Task 3) passes in full, including the AC5/AC9/AC10 cases.
4. `npm run build` — compiles `src/` → `build/` with no errors; confirm `build/block.json` carries the `song` attribute and `build/render.php` is the passthrough.
5. `npm run env:start`, then `npm run test:e2e` — both spec files (Tasks 7 & 8) pass: AC1, AC2, AC3, AC4, AC6, AC7, AC8 all green. Stop with `npm run env:stop` when done.
6. Cross-check the **AC matrix** is fully exercised by automated tests: AC1 (e2e round-trip), AC2 (e2e empty), AC3 (e2e empty render), AC4 (e2e conformant), AC5 (unit comprehensive song), AC6 (e2e flagged+stored), AC7 (e2e front-end string), AC8 (e2e escaped), AC9 (unit both note systems), AC10 (unit structural-only). Every AC has at least one passing test.

**Depends on:** Tasks 1–8.

**Traces to:** all requirements (1–14) and all acceptance criteria (AC1–AC10); design §12.2 runtime verifications (AC1, AC3, AC8) confirmed executed.

**Acceptance:**
- All commands in steps 2–5 succeed with no errors/failures; the AC matrix in step 6 is fully covered by green tests.
- If any fix was needed, it is committed to the owning file with an appropriate `(code-writer)` message; otherwise no commit (this is a verification gate). Suggested message if a fix lands: `Fix <thing> found in final verification (code-writer)`.

---

## Task dependency summary

```
Task 1 (deps + test scripts)
   ├─► Task 2 (schema-as-data)
   │       └─► Task 3 (validator + unit tests)        ─┐
   ├─► Task 4 (block.json: song attribute)             │
   │       ├─► Task 5 (editor field + validation) ◄────┘ (uses validator)
   │       └─► Task 6 (render.php passthrough)
   │                 └─► Task 7 (front-end e2e: AC3/AC7/AC8, harness setup)
   │                           └─► Task 8 (editor e2e: AC1/AC2/AC4/AC6)
   └────────────────────────────────────► Task 9 (final build/lint/test sweep)
```

Strict ordering: **1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9.** (Task 4 has no hard dependency on Task 3 and could precede it, but the linear order above is the safe sequence the code phase will follow: each task builds on a green predecessor.)

## Coverage check (plan → design/spec)

- **Schema-as-data + zero-dependency validator/walker** (no `ajv`): Tasks 2 + 3 — design §6.2 (option ii), §7; requirement 2.
- **`block.json` `song` attribute** (`type:"string"`, `default:""`): Task 4 — design §6.1; requirements 1, 9, 10.
- **Editor raw-JSON field** (`TextareaControl`), unconditional `setAttributes`, non-empty validation, non-blocking error `Notice`: Task 5 — design §6.3; requirements 7, 8, 9, 10.
- **`render.php`** escaped `<pre>` passthrough, nothing when empty, no validation, §8 defensive read (supersedes §2 `?? ''`): Task 6 — design §8; requirements 11, 12, 13.
- **Unit tests** (validator vs conformant/non-conformant fixtures incl. AC5 comprehensive song, AC9 both note systems, AC10 structural-only): Task 3 — AC4, AC5, AC6, AC9, AC10.
- **E2E tests** (`@wordpress/e2e-test-utils-playwright`): Tasks 7 + 8 — AC1 (round-trip), AC2 (empty default), AC3 (empty renders nothing), AC4/AC6 (conformant accepted / non-conformant flagged-but-stored), AC7 (front-end string), AC8 (XSS escaped).
- **Build/lint + dev deps**: Task 1 (`npm install`, test scripts) and the `npm run build` / `npm run check` gates in every task; Task 9 final sweep — requirement 14.
- **§12.2 runtime verifications** (AC1, AC3, AC8): realized by Tasks 7–8 and confirmed in Task 9.
