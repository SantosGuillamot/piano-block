# Code review — APPROVED

**Verdict: approved.** The full Code-phase batch (code-plan Tasks T1–T9, diff `192c8d6..HEAD`, HEAD `0a1d5cf`) faithfully realizes the approved design and satisfies every requirement and acceptance criterion. No correctness, spec-alignment, security, or test-quality defect was found. This is the singleton approval terminator for the Code phase.

## Scope reviewed

Diff `192c8d6..HEAD` — every source, test, and config change in the Code phase:

- `src/song/schema.js`, `src/song/validate.js`, `src/song/__tests__/{schema,validate}.test.js`
- `src/edit.js`, `src/block.json`, `src/render.php`
- `specs/render.spec.js`, `specs/editor.spec.js`, `playwright.config.js`
- `package.json`, `package-lock.json`, `.gitignore`

Read against `1-spec/spec.md` (req 1–14, AC1–AC10, out-of-scope), `2-design-doc/design-doc.md` (the approved design), and `3-plan/code-plan.md`.

## Independent verification performed

I did not merely rely on the Task-9 sweep — I re-ran and stress-tested the key pieces:

- **Unit suite:** `npx wp-scripts test-unit-js` → **53 passed, 2 suites, 0 failures.** (A bare `npx jest` fails only because it bypasses the `@wordpress/scripts` Babel/ESM transform — not a real failure; the wrapped script is green.)
- **Lint:** `npx biome check src/ specs/ playwright.config.js` → **10 files, no fixes applied (clean).**
- **Validator adversarial fuzzing (~30 cases beyond the test suite):** top-level non-object / `null` / array / string; `alters` as string and as array; `bpm` as string and missing; float `octave` (`4.0` accepted, `4.5` rejected), float `alter`, float `alters` value; event/pitch/measure/section as wrong primitive types; `note` missing `type` (correctly flags missing-`type`, does **not** falsely fire the note⇒pitches conditional); unknown junk fields at every level (ignored); `beatType: 3` (rejected), boundary `octaveShift: -2` (accepted) / `-3` (rejected). **Every case produced the correct verdict with a correct, path-pointed message.**

## Correctness — confirmed

- **`validate.js`** correctly implements: JSON-parse gate (parse failure → one `Invalid JSON:` error, AC6); structural/field conformance via the schema walk (`$ref`/`$defs` resolution, `required`, `properties`, array `items`, `enum`, integer `minimum`/`maximum`); the **integer check uses `Number.isInteger`** (JSON has no integer type — floats are correctly rejected); the **three walker special cases** — `pitch.step`/`alters` keys matched **case-insensitively** against the single `NOTE_NAMES` two-system vocabulary, `alters` values integer in −2..+2, `tempo.bpm > 0` strict; **lenient unknown properties** (no `additionalProperties: false`, unknown keys ignored); **closed enums** (typo'd `quaver`/`treble-clef`/`mezzo`/`repeat`/`chord`/`beatType:3`/`begin` all flagged); the **note⇒non-empty `pitches`** conditional (missing array, empty array both flagged; a `rest` carries none). Special cases dispatch by the schema's own `$defs` name, keeping them tied to the single source of truth.
- **`schema.js`** mirrors design §7 exactly (root `required:["sections"]`; the `$defs` set; the single `if`/`then` note discriminant). The `biome-ignore noThenProperty` on `then` is a legitimate suppression of a false positive (it is the JSON-Schema keyword the walker reads, not a thenable).
- **`edit.js`** persists raw input **unconditionally** (`onChange={(next) => setAttributes({ song: next })}` — no gating), validates only **non-empty** input as a pure `useMemo` keyed on `song` (no `setAttributes`, no field mutation), and renders a **non-blocking** `Notice status="error" isDismissible={false}` only when there are errors. It never blocks saving, clears the field, or substitutes a parsed value. All user strings are `__()`-wrapped with the `piano-block` domain.
- **`render.php`** is a safe escaped passthrough: defensive `isset(...) ? (string) ... : ''` read, `'' === trim($song)` early return (empty/unset/whitespace → nothing), `<pre>` carrying `get_block_wrapper_attributes()` echoed **directly** (no double-escape), body `esc_html($song)`. No parsing, validation, or re-serialization — the only branch is the empty check.
- **`block.json`** declares the single `song` attribute, `type:"string"`, `default:""`, no `source`; `apiVersion:3`, `render`, scripts/styles unchanged.

## Spec / design alignment — confirmed

- All requirements 1–14 and AC1–AC10 are addressed and mapped to passing tests (AC matrix below).
- **No out-of-scope creep:** no audio, no notation rendering, no visual authoring UI, no `version` field, no import/export, no render-time validation, no musical-timing checks.
- **Zero runtime dependencies preserved.** `package.json` has **no `dependencies` block at all**; the only dependency change is the dev/test pin `@wordpress/e2e-test-utils-playwright@1.46.0` in `devDependencies` + `overrides` (the documented workaround for the broken-as-published `1.47.0` that `@wordpress/scripts@32.3.0` would otherwise resolve). This is DEV/TEST tooling, not a runtime dependency — it does not violate the zero-runtime-deps rule.

## Test quality — confirmed (would catch regressions)

- **Unit (53):** the AC5 comprehensive song (every required element) → `[]`; AC9 both note systems + case-insensitivity + rejected `H`/`doh`; closed-enum, type/required/nesting, integer-range, walker-special-case, lenient-unknown, and the explicit **AC10 structural-only** test (wildly unbalanced measure that must still pass). Assertions check substrings/paths, not brittle full strings.
- **E2E (8):** AC2 (empty field + `song===""` + no notice); AC4 (conformant → no error + stored verbatim); **AC6 asserts BOTH the visible error AND the unchanged stored value**, for both invalid-JSON and valid-but-non-conformant inputs; AC1 round-trips HTML-significant chars through the delimiter comment; AC3 (no `<pre>` at all on an empty block); AC7 (full stored string present in `<pre>`); **AC8 asserts the escaped entities ARE present AND `pre script` count is 0** (no live script) — a real XSS regression (e.g. switching to `wp_kses_post` or dropping escaping) would fail this. Selectors are label/role-based and resilient.

## Security — confirmed

`render.php` emits the stored string as a text node inside `<pre>` via `esc_html()`; `get_block_wrapper_attributes()` is pre-escaped and echoed directly (no double-escape, no `esc_attr` mistake). Any `<script>`/`<`/`&`/quote renders inert. No injection vector; no render-time parsing of untrusted input.

## Hygiene — confirmed

Source-only commits — **no `node_modules/`, `build/`, `test-results/`, `playwright-report/`, `artifacts/`, or `.DS_Store`** in the diff; `.gitignore` covers all of them. Biome clean across all 10 changed lint-governed files. No dead code. Working tree clean; HEAD `0a1d5cf`. Commit messages follow the convention (imperative, sentence case, no trailing period, `(code-writer)`).

## AC traceability

| AC | Proven by |
|---|---|
| AC1 — persists across save/reload | `specs/editor.spec.js` round-trip (HTML-significant chars) |
| AC2 — new block empty | `specs/editor.spec.js` (blank field, `song===""`, no notice) |
| AC3 — empty renders nothing | `specs/render.spec.js` (no `<pre>` at all) |
| AC4 — conformant → no error, stored | `specs/editor.spec.js` |
| AC5 — format covers all elements | unit comprehensive §9 song → `[]` |
| AC6 — flagged but stored | `specs/editor.spec.js` (error notice **and** unchanged value, both cases) |
| AC7 — front-end string | `specs/render.spec.js` (full string in `<pre>`) |
| AC8 — escaped, no XSS | `specs/render.spec.js` (escaped entities present **and** no live `<script>`) |
| AC9 — both note systems | unit (English/Spanish + case-insensitive + rejects unknown) |
| AC10 — structural only | unit (unbalanced song accepted) |

All ten acceptance criteria have at least one passing, behavior-asserting test.
