# Code Plan Review — REJECTED (iteration 1)

Reviewer: `code-plan-reviewer`. Verdict: **REJECTED**.

The plan is overwhelmingly strong: it covers the entire design file-change manifest
(`block.json` → T2, `package.json` → T1, `render.php` → T3, `piano-block.php` → T4,
`view.js` → T5, `render.spec.js` AC8 rework → T6, new AC9 → T7), every design decision
D1–D26 (incl. D15a) is cited by some task, every spec AC is realized, the frozen fence is
respected (the PHP name helper is a parallel mirror, never an edit to `accessibleName.js`;
no task touches `notation/*`, `song/*`, or the editor), the AC8 rework matches the design's
single allowed transport change, and the new AC9 test is included. The store namespace, the
childless route-B wrapper, the validate-once/cached-parse closure, and the imperative-SVG
carve-out are all design-faithful.

It is rejected for **one blocking feasibility/ordering defect** (Issue 1) whose per-task
acceptance criteria are provably unsatisfiable at the step they are checked. Issue 2 is a
smaller correctness-wording fix to bundle into the same revision. Everything else is
approved as written.

---

## Issue 1 (BLOCKING) — T1, T2, and T3 acceptance criteria require a built view module at a point in the strict sequence where the module build is provably broken

**What's wrong.** The plan's own build model (Orientation lines 41–62; design D2/D3) is:
the module webpack pass only runs with `--experimental-modules` *and* only has an entry once
`block.json` declares `viewScriptModule`; **and** the moment `viewScriptModule` is declared,
the *old* `view.js` (which still imports `@wordpress/dom-ready` and, transitively via
`accessibleNameFor`, `@wordpress/i18n`) is a **hard build error** —
`Attempted to use WordPress script in a module: @wordpress/i18n, which is not supported yet.`
— so no `build/view.js` / `build/view.asset.php` is emitted. This is "Proven" in the design
research (`design-doc-research.md` lines 65–69 and 78–92) and is the entire motivation for
D3/D4. The view module therefore **does not build until T5** removes those two imports.

But the per-task acceptance criteria for the earlier tasks demand a successfully-built module
*at their own step*:

- **T1 acceptance (lines 82–86):** "A full build (`npm run build`) completes without the
  'No entry file discovered' error for the view module and emits `build/view.js` plus
  `build/view.asset.php`. (The module's contents are still the old classic script until
  T5 — that is fine; this task only proves the module pass runs.)" — Unsatisfiable. At T1
  only `package.json` changed; `block.json` still declares `viewScript`, **not**
  `viewScriptModule` (that is T2). The module pass routes off
  `moduleFields = Set(['viewScriptModule','viewModule'])` (research line 68), so with only
  `viewScript` present the module pass has **no entry → exactly "No entry file discovered"**,
  and no `build/view.js` is emitted. The parenthetical ("contents are still the old classic
  script until T5") compounds the error: it presumes the module builds from the old `view.js`
  at T1, which both requires `viewScriptModule` (not yet present) and would hard-error on
  `@wordpress/i18n`.

- **T2 acceptance (lines 113–115):** "After `npm run build`, `build/block.json` reflects the
  same fields and `build/view.asset.php` is generated with `'type' => 'module'`." —
  Unsatisfiable. At T2 `viewScriptModule` is now declared and the flag is on (T1), so the
  module pass runs **and hard-errors** on the still-present `@wordpress/i18n`/`dom-ready`
  imports of the old `view.js`. `build/view.asset.php` with `'type' => 'module'` is **not**
  emitted until T5. (Worse: if `npm run build` exits non-zero on the module error, even the
  `build/block.json` half of the assertion may not be reliably produced — pass/ordering
  dependent — so the criterion is doubly fragile.)

- **T3 acceptance (line 180):** "After a flagged `npm run build` and with `wp-env` running,
  fetch a published comprehensive-song post's raw HTML…". At T3, `view.js` is still the old
  file, so the flagged `npm run build` still **hard-errors** on `@wordpress/i18n`. The
  *intent* of this check (assert the server-emitted `data-wp-context` transport, which is
  pure `render.php` output and does **not** need the module to build) is sound, but it is
  predicated on a clean flagged build producing a serveable `build/` for `wp-env`
  (`register_block_type(__DIR__.'/build')` serves the *built* `render.php`). With the module
  pass hard-erroring, whether the script pass still copies the updated `render.php` into
  `build/` is toolchain-dependent and unverified — so the criterion as written is not safely
  executable at the T3 step.

**Why it matters.** A fresh `code-writer` executes one task at a time and checks *that task's*
acceptance to decide pass/fail. As written, T1, T2, and T3 each instruct the writer to run
`npm run build` and confirm a built/typed view module (or a clean flagged build) at a step
where the build is provably broken. The writer will (correctly) observe the build error and
conclude the task failed — even though the *code change* for that task is correct. This is a
real verification trap, not a cosmetic one: it can stall the sequence at T1/T2 or send the
writer chasing a non-bug. The plan even contradicts itself — Orientation lines 55–56 say the
module-dependent checks pass "once the module actually builds (**T1+T2**)", but per D3/D4 the
module does not build until **T5**; the Orientation mis-attributes the build-success point.

**What would fix it.** Re-anchor the build-success acceptance to T5 and make T1/T2/T3 verify
only what is actually true at their step:

1. **T1** — verify the *script* pass still builds and the flag is present, not the module
   pass. Concretely: `package.json` parses; both `build`/`start` scripts contain
   `--experimental-modules`; `npm run build` exits 0 and still emits the classic
   `build/view.js` + `build/view.asset.php` (the script pass — `block.json` still declares
   `viewScript`, so there is no module entry and no module error yet). Explicitly state that
   the module pass is not exercised here (no `viewScriptModule` until T2) and the module does
   not build until T5.
2. **T2** — verify `block.json` validity and the field switch (has `viewScriptModule` +
   `supports.interactivity: true`, no `viewScript`). State explicitly that a *full*
   `npm run build` is now expected to **fail** on the module pass
   (`Attempted to use WordPress script in a module: @wordpress/i18n`) **until T5**, because the
   old `view.js` still imports `@wordpress/i18n`/`dom-ready`; do **not** assert a generated
   `build/view.asset.php` with `'type' => 'module'` at this step. (If you want a build signal
   at T2, scope it to JSON validity / the script-pass copy of `block.json`, and flag the
   expected module-pass error as the known mid-sequence state.)
3. **T3** — keep the server-HTML transport assertions (they are correct and module-independent)
   but decouple them from a *clean* flagged build: note that until T5 the flagged
   `npm run build` errors on the module pass, so the writer must either (a) verify the
   `render.php` transport against a `build/` produced after T5, or (b) confirm explicitly that
   the route-B server HTML can be inspected without a successfully-built module (e.g. the
   script pass still copies `render.php`), and not gate T3's pass on a zero-exit flagged build.
   The cleanest framing: T3 verifies `php -l` + the route-B `render.php` shape now, and its
   **server-HTML e2e fetch** (the AC8-transport / AC6 signals) is acknowledged as deferred to
   after T5 (when a clean flagged build first exists), consistent with the TDD note in
   lines 57–62.
4. **Orientation** — correct lines 55–56 to say the module-dependent checks pass once the
   module actually builds at **T5** (not T1+T2), so the summary matches D3/D4 and the revised
   per-task acceptances.

This is purely a re-statement of acceptance criteria to match the plan's own (correct) build
model — no task's *code change* needs to move.

---

## Issue 2 (minor, bundle into the same revision) — T6's stated `'` encoding (`&#039;`) is wrong; tighten to the verified `'`

**What's wrong.** T6 line 343 says the core encoder "escapes any in-payload `'` to `&#039;`
(JSON_HEX_APOS)". That is the wrong escape: `JSON_HEX_APOS` makes PHP `json_encode` emit the
JSON unicode escape **`'`** for `'` (six chars: `'`), **not** the HTML entity
`&#039;`. (`&#039;` would only appear if the JSON value were additionally run through
`esc_attr()`, which `wp_interactivity_data_wp_context()` does not do to the payload.) The
design's own D15a / research (design-doc.md lines 786–790; research lines 511–518) correctly
describe the in-payload `'` as escaped by JSON_HEX_APOS so that "the first `'` after the opener
is the true attribute close" — i.e. there is no bare `'` left, the escape being `'`.

**Why it matters (and why it is only minor).** The *operational* conclusion T6 relies on —
slice the `data-wp-context` value to the next `'` (safe because no bare `'` remains), then
assert the value does **not** contain a literal `'`, and do the authoritative
`JSON.parse(attrValue)` → `JSON.parse(ctx.song)` deep-equal round-trip — is **correct and
robust** under the real `'` output, and T6 already hedges (lines 348–349) to "assert
against whatever the encoder actually produces — the decoded round-trip below is the
authoritative correctness check." So this does not break the test logic. But the `&#039;`
wording is a latent trap if a writer takes it literally (e.g. adds a misguided
`expect(...).toContain('&#039;')` or `not.toContain('&#039;')` assertion that would
mis-describe reality). The hostile payload *does* contain a literal `'` in `HOSTILE_CHORD`
(`alert('chord')`, render.spec.js:219), so the encoding of `'` is live, not hypothetical.

**What would fix it.** In T6, change "`&#039;` (JSON_HEX_APOS)" to "`'` (JSON_HEX_APOS)"
(the JSON unicode escape), keeping the existing — correct — slice-to-next-`'`, the
"does not contain a literal `'`" escape-safety assert, and the authoritative deep-equal
round-trip. (Optionally state the needle for an escaped apostrophe as the six chars `'`,
written `"\\u0027"` in JS source, mirroring how the plan already handles `<` as
`"\\u003C"`.)

---

## Everything else: approved as written

- **Completeness:** entire manifest covered; D1–D26 (incl. D15a) all traced; all ACs
  realized; coverage-check section (lines 456–474) is accurate.
- **Scope fence:** no task edits `notation/*`, `song/*` (incl. `accessibleName.js`), or the
  editor; the PHP `piano_block_accessible_name` helper is a faithful parallel mirror (four
  branches, `_x`/`__`/`sprintf`, `'sheet music label'`, `piano-block` domain), hosted in
  `render.php` with a `function_exists` guard (matches D13/D22). `editor.spec.js` and the
  notation/song unit tests (incl. `svg.test.js`) are left untouched (verified against the real
  files).
- **Spec/design alignment:** AC8 rework is the single allowed transport change (D15a); the
  render/inert/no-XSS asserts stay; the new AC9 multi-block test (T7) matches D19/D20; the
  early-return / decode-for-label-only / no-server-validation (R6) discipline in T3 matches
  D12/D14; `view.js` (T5) imports only `@wordpress/interactivity` + relative modules (R10/AC14)
  and drops `@wordpress/dom-ready` + `accessibleNameFor`; T4 removes the dead
  `wp_set_script_translations` (verified: only references to `piano-block-piano-view-script`
  live in `piano-block.php` itself, and there is no `languages/` dir, so the T4 repo-grep
  acceptance will pass after the change).
- **Feasibility of the non-build acceptances:** `php -l` checks (T3/T4), `node -e require`
  JSON checks (T1/T2), the `grep` import scan (T5), and the static needle checks are all sound
  and runnable. The encoder-flag claim (`JSON_HEX_TAG|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_HEX_AMP`)
  was verified against real WP core source in the design-research phase.

Fix Issues 1 and 2 (both are acceptance-criteria/wording edits — no task's code change needs
to move or be added) and the plan is approvable.
