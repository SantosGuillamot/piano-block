# Code Plan Review — APPROVED

Reviewer: `code-plan-reviewer` (re-review, iteration 2). Verdict: **APPROVED**.

The revised `code-plan.md` resolves both blocking/minor issues from the iteration-1
rejection and survives a full adversarial pass on completeness, feasibility, ordering, and
spec/design alignment. It is approvable as written.

---

## The two prior-rejection issues are genuinely resolved

### Issue 1 (was BLOCKING) — build-success acceptance re-anchored to T5; T1/T2/T3 verify only what is true at their step — RESOLVED

The iteration-1 defect was that T1, T2, and T3 acceptance criteria each demanded a
successfully-built/typed view *module* (or a clean flagged build) at a step where the
plan's own build model says the module build is provably broken (the module pass first
succeeds only at T5, once `view.js` drops `@wordpress/dom-ready` + the transitive
`@wordpress/i18n`). The revision fixes this everywhere it occurred:

- **Orientation (the new "Build/test note", lines 41–71).** Now states explicitly that
  "A successful flagged module build therefore first exists at **T5**", walks the exact
  mid-sequence failure (T2 declares `viewScriptModule` → module pass runs against the
  still-old `view.js` → hard-errors on `@wordpress/i18n`), and says the
  view-module-dependent e2e checks "only pass once the module actually builds (**T5**)".
  The iteration-1 self-contradiction (the old claim that module-dependent checks pass at
  "T1+T2") is gone.
- **T1 acceptance (lines 92–98).** Verifies the *script* pass only: `package.json` parses,
  both `build`/`start` carry `--experimental-modules`, `npm run build` exits 0 and still
  emits the **classic** `build/view.js` + `build/view.asset.php`. Explicitly: "Do **not**
  assert a `build/view.asset.php` with `'type' => 'module'` yet … a successfully-built view
  *module* first exists at T5." Correct: with `block.json` still declaring `viewScript`
  there is no module entry, so the module pass is not exercised at T1.
- **T2 acceptance (lines 123–134).** Explicitly flags the flagged module build as "expected
  to FAIL until T5, and that is not a regression," quotes the exact
  `Attempted to use WordPress script in a module: @wordpress/i18n` error, and scopes the only
  in-step build signal to `block.json` JSON validity. "Do **not** assert a generated
  `build/view.asset.php` with `'type' => 'module'` at this step."
- **T3 acceptance (lines 198–222).** Keeps the module-independent, correct signals
  (`php -l` + a static route-B HTML-*shape* check inspectable without a clean module build)
  and explicitly does **not** gate on a zero-exit flagged build; the server-HTML e2e fetch
  (the AC8-transport / escape-safety round-trip) is **DEFERRED to after T5**, consistent
  with the TDD note. The static-shape assertion (`accessibleName === "Example by A.
  Composer"` for a comprehensive song) was verified against the real `COMPREHENSIVE_SONG`
  fixture (`render.spec.js:53–54,166`) and the PHP mirror's branch-1 template — accurate.
- **The build-success + module-asset-emission acceptance now lives at T5** (lines 336–342):
  a flagged `npm run build` exits 0 without the i18n/dom-ready errors and emits a
  `build/view.asset.php` declaring exactly `array('@wordpress/interactivity')` with
  `'type' => 'module'`. This is the correct home for that check.

### Issue 2 (was minor) — T6's in-payload `'` encoding — RESOLVED and empirically confirmed

T6 (lines 372–374) now states the core encoder escapes any in-payload `'` to the JSON
unicode escape **`'`** "(JSON_HEX_APOS; six chars, not the HTML entity `&#039;`, which
`json_encode` does *not* emit)", keeps the slice-to-next-`'` logic, the "does not contain a
literal `'`" escape-safety assert, and the authoritative `JSON.parse` deep-equal
round-trip. The needles for an escaped `<` are written `"\\u003C/script"` / `"\\u003C!--"`,
mirroring the `'` treatment. I verified the encoding empirically with
`json_encode($ctx, JSON_HEX_TAG|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_HEX_AMP)`: an apostrophe
emits `'` (not `&#039;`) and `<` emits `<` — exactly as the revised T6 now
describes. The `&#039;` trap is gone.

---

## Full adversarial pass — clear

- **Completeness vs the design manifest.** All six in-scope files are covered:
  `package.json` → T1 (D2/D26), `src/block.json` → T2 (D1), `src/render.php` → T3
  (D4/D12–D15 + the D13 PHP helper), `piano-block.php` → T4 (D21/D22), `src/view.js` → T5
  (D3/D5–D11/D16–D19), `specs/render.spec.js` AC8 rework → T6 (D15a/D23/D24) and new AC9 →
  T7 (D19/D20). Every design decision D1–D26 (incl. D15a) is cited by some task; every spec
  AC (AC1–AC15) is realized. The coverage-check + frozen-fence sections (lines 488–506) are
  accurate.
- **Per-task quality.** Each task has a concrete Goal, Files, decision-cited Changes,
  Depends-on, Traces-to, and now-feasible Acceptance. The per-task acceptances use only
  signals that are real at that step (`node -e require` JSON checks at T1/T2, `php -l` at
  T3/T4, the repo-grep for the dead handle at T4, the static import-scan
  `grep -nE 'from "@wordpress/' src/view.js` at T5, the static route-B HTML-shape check at
  T3, and the flagged-build + `wp-env` e2e runs at T5/T6/T7).
- **Feasibility & acyclic ordering.** DAG: T1 (no deps) → T2 → {T3, T4}; T5 depends on
  T2+T3 (T1 transitively); T6 and T7 depend on T3+T5. Acyclic, single-branch, executable in
  sequence. Under the corrected acceptance criteria the script pass builds/verifies at every
  step (T1–T4) and the module pass first builds at T5 — no task's acceptance gates on
  something unsatisfiable at its step. T4's dead-handle removal was verified feasible:
  `piano-block-piano-view-script` lives only in `piano-block.php` and there is no
  `languages/` dir, so the T4 repo-grep acceptance passes after the change. T7's two-block
  insertion mirrors the real `publishPostWithSong` helper's per-block ops
  (`createNewPost` → `insertBlock` → `clickBlockToolbarButton("Edit as JSON")` →
  `getByLabel("Song (JSON)").fill` → `publishPost`) — feasible against the real fixtures.
- **Interactivity-API specifics (verified against the `wordpress-development` reference).**
  `viewScriptModule` is the field that builds/enqueues `view.js` and `supports.interactivity`
  alone does not (T2 ✓); `wp_interactivity_data_wp_context()` prints `data-wp-context` with
  correct escaping and the namespace param defaults to the wrapper's `data-wp-interactive`
  (T3 ✓); `data-wp-init` runs once on mount and may return a cleanup function (T5 ✓);
  `getElement().ref` carries the directive element and is non-null inside an init effect
  (the reference notes `data-wp-run`'s ref is null on first render and to access it inside an
  effect — consistent with the plan's T5 claim ✓); do not hand-register
  `wp_register_script_module()` (T3/T4 ✓).
- **Spec/design alignment.** AC8 rework is the single allowed transport change (render /
  inert / no-XSS asserts preserved; only the carrier-`<script>` locator becomes a
  `data-wp-context` parse — D15a); AC9 is the new multi-block isolation test (D19/D20). T5
  drops `@wordpress/dom-ready` + `accessibleNameFor` so the module imports only
  `@wordpress/interactivity` + relative (R10/AC14), and adds no dependency. T3's
  decode-for-label-only / no-server-validation discipline keeps the render-or-nothing gate
  100% client-side (R6/D14).
- **Scope fence.** No task edits `src/notation/*`, `src/song/*` (incl. `accessibleName.js`),
  or the editor. The PHP `piano_block_accessible_name` helper is a faithful parallel mirror
  (four branches, `_x`/`__`/`sprintf`, `'sheet music label'` context, `piano-block` domain),
  hosted in `render.php` with a `function_exists` guard, and T3 explicitly forbids also
  defining it in `piano-block.php` (no double-define). `editor.spec.js` and the
  notation/song unit tests (incl. `svg.test.js`) are left untouched. T6 correctly updates the
  stale AC8 (b)/(d) comments it is already editing and flags the AC7 ~554–555 wrapper comment
  as a documentation-phase note (it lives in a test no implementation task edits, and its
  `innerText === ""` assertion is unaffected under the childless route-B wrapper).

No blocking or minor issues remain. Approved.
