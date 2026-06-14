# Doc Plan Review — APPROVED (iteration 2)

**Verdict:** APPROVED
**Reviewed:** the revised `doc-plan.md` (DOC1–DOC7) against `spec.md`, `design-doc.md`,
`code-plan.md` (T1–T7), the prior rejection (`doc-plan-review-1-rejected.md`), and the real
repo files (`README.md`, `docs/song-format.md`, `AGENTS.md`, `specs/render.spec.js`).

The iteration-1 rejection raised one blocking completeness gap and two drift-resistance
fixes. All three are genuinely resolved, and a full adversarial pass surfaces no new blocking
issue. The plan is complete, drift-resistant, correctly bounded against the code phase, and
aligned with the shipped behavior.

---

## Prior-rejection issues — all resolved

### Issue 1 (blocking) — stale route-A comments in `render.spec.js` fell in no task → RESOLVED

DOC5 was rebuilt from "corrects only the AC7-wrapper note at ~L554–555" into a
**content-anchored enumeration** of every stale route-A narrative comment that lies
**outside** the AC8 test body (T6) and the AC9 test (T7):

1. **File-level header doc-comment** (the top `/** … */`) — the `viewScript` + "container
   carries" framing, the "inert JSON `<script>` inside" present-but-non-renderable bullet,
   and the "`render.php` ETAGO escape" guarantee line.
2. **AC1/AC2/AC12 test** — "renders without the `interactive` flag" and "replaces the inert
   JSON `<script>` carrier with the SVG".
3. **AC7 invalid-JSON test** — "the wrapper MAY exist (carrying the inert JSON `<script>`)".
4. **AC11 hostile-free-text test** — "no live `<script>` exists beyond the inert JSON
   carrier" and the comment justifying the `script:not([type="application/json"])` locator
   (assertion line kept unchanged; only the comment corrected).
5. **Route-A module-level fixture comments** — `INVALID_JSON_SONG`'s "the wrapper stays
   empty" and `HOSTILE_SONG`'s "the `render.php` `<` escape round-trips".

I independently grepped the real file
(`grep -niE "viewScript|inert|application/json|carrier|ETAGO|interactive flag|<script|domReady|str_replace|u003C|container carries|stays empty" specs/render.spec.js`)
and every stale match maps onto exactly one of DOC5's five clusters, the AC8 test body
(T6 territory), or hostile fixture string DATA — **nothing real is left uncovered**. The
matches at L380–381 (`HOSTILE_FREE_TEXT` fixture comment) use `<script>` only as a generic
"renders inert" descriptor, not route-A narrative, and are correctly not flagged. Anchoring
is by quoted phrase with line numbers explicitly marked as shift-prone hints (good — the
code ships before DOC5 runs). The false "only L554–555 remains" claim is gone from both DOC5
and the "Out of scope" section.

### Issue 2 (drift-resistance) — DOC7 residue sweep excluded the spec file → RESOLVED

DOC7's carrier-residue grep target set now includes `specs/render.spec.js`, and DOC7 adds a
dedicated **"`specs/render.spec.js` carrier-residue backstop"** that re-runs DOC5's
comment-residue grep as the closing gate, with the hostile fixture string DATA
(`HOSTILE_TITLE` / `HOSTILE_CHORD` / `HOSTILE_FREE_TEXT`) and the AC8/AC9 code-phase bodies
explicitly carved out. DOC7 also routes any stale comment found outside the AC8/AC9 bodies
back to DOC5's scope. I confirmed the proposed backstop grep is real and now covers the file
that carries the most residue.

### Issue 3 (minor, drift-resistance) — DOC1's L13 "container carrying that song" phrasing → RESOLVED

DOC1's acceptance now quotes the exact L13 sentence verbatim and names **both** route-A
phrasings as must-replace — "PHP emits a **lightweight container carrying that song**" and
"**the block's own client-side code reads the song**" — and adds "container carrying that
song" to DOC1's "Must NOT appear" list. I verified the real L13 text matches the quote
exactly, so a literal-minded doc-writer can no longer leave the half-edited "PHP carries /
client reads" framing.

---

## Boundary correctness (independently checked)

- **AC8 body (code-phase T6) not claimed by the doc plan.** DOC5's "IMPORTANT BOUNDARY"
  section excludes the AC8 test body comments (the (b) "inert application/json data carrier"
  and (d) carrier/`<` comments) and instructs the writer to **flag, not edit** if T6 left any
  stale. The real AC8 test runs ~627–697; I confirmed the in-body matches (L649, L654–656,
  L672–696, incl. the `wp-block-piano-block-piano__song` carrier string at L682) are all
  inside that range — correctly T6 territory.
- **AC9 (code-phase T7) not claimed.** AC9 does not exist in the file today (T7 authors it);
  DOC5 leaves it entirely to the code phase.
- **No hostile fixture STRING DATA altered.** DOC5 and DOC7 both explicitly exclude the
  `HOSTILE_*` literals (legit `</script>` / `application/json`-like test input at L218–219,
  L383); the change is comment prose only. The `:not([type="application/json"])` assertion
  line is kept unchanged — only its comment is corrected, matching how code-plan T6 handles
  the AC8 copy.

## Full adversarial pass — completeness, non-overlap, alignment

- **README drift coverage is line-accurate and disjoint.** I re-verified every anchor:
  DOC1 (L13 front-end prose, L76/L84 "what the front end shows"), DOC2 (L139/L140/L147/L148/
  L151 file-layout rows; L149 notation row correctly left untouched), DOC3 (L130 build model,
  L162/L163 scripts), DOC4 (L193 render contract, L195 escape paragraph, L197 "Exercising the
  renderer", L199 Tests front-end clause). All are present and stale exactly as the plan
  describes; the sections do not overlap.
- **`docs/song-format.md` / `AGENTS.md` guards are real.** I ran DOC6's grep
  (`grep -niE "viewScript|view\.js|carrier|data-wp|interactiv|transport|<script|application/json" docs/song-format.md`)
  → no matches; AGENTS.md → no migration facts. The cross-link anchors
  `#using-the-piano-block` and `#4-what-the-front-end-shows` resolve to README headings
  DOC1–DOC4 do **not** rename (DOC1 edits prose under "### 4. What the front end shows" but
  not the heading). DOC6 is correctly a verify-only guard.
- **Version floor stays 6.9.** I confirmed README L92 ("WordPress 6.9+") and L122
  ("WordPress 6.9+ / PHP 7.4+"); DOC7's floor guard targets the right lines, and the
  no-7.0-bump grep is sound.
- **Dependency invariant.** DOC3/DOC7 correctly describe `@wordpress/interactivity` as
  WordPress-provided and externalized (not a `package.json` dependency, not manually
  registered), matching spec R10/AC14 and code-plan T1/T3.
- **Shipped-behavior alignment.** Route-B per-instance `data-wp-context` transport,
  core-encoder superset escape (byte-exact round-trip), server-computed accessible name (PHP
  mirror; front end no longer calls `accessibleName.js`), and the new AC9 multi-block
  isolation coverage are all assigned; "the server does no validation" (L84) and the
  client-side render-or-nothing gate are preserved; the imperative-SVG mount framing is kept.
- **Right-sizing.** The verify-only guards (DOC6, DOC7) state HOW — exact grep invocations,
  anchor-resolution checks, and explicit carve-outs for code-phase territory and fixture data.

## Residue I independently grepped

- `grep -niE "viewScript|inert|application/json|carrier|ETAGO|interactive flag|<script|domReady|str_replace|u003C|container carries|stays empty" specs/render.spec.js`
  — every match maps to a DOC5 cluster, the AC8 body (T6), or fixture string DATA.
- `grep -rniE "inert (json|application/json)? ?<script>|wp-block-piano-block-piano__song|str_replace\(.*u003C|viewScript\b" README.md docs/song-format.md AGENTS.md specs/render.spec.js`
  — confirms DOC7's proposed residue grep works and now includes the spec file; AGENTS.md and
  song-format.md return zero.
- DOC6 greps on `docs/song-format.md` and `AGENTS.md` — both clean.

## Non-blocking nit (not a reason to reject)

DOC4's acceptance prose occasionally renders the escaped-`<` needle as `&lt;`/`<` where it
means the JSON unicode escape `<`; this is doc-narrative describing the README's wording,
not test code, and the plan elsewhere names `<` / `JSON_HEX_TAG` correctly. It does not
impair completeness, drift-resistance, the boundary, or alignment.

---

The three prior-rejection issues are resolved, the doc/code boundary is correct, coverage is
complete and non-overlapping, and the guards are drift-resistant. Approved.
