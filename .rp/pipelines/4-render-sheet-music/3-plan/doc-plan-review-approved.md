# Doc Plan Review — APPROVED

**Pipeline:** `4-render-sheet-music` (issue #4 — render the Piano block's song as visual sheet music)
**Artifact reviewed:** `.rp/pipelines/4-render-sheet-music/3-plan/doc-plan.md`
**Verdict:** APPROVED

## Rationale

I reviewed the doc plan adversarially against the approved spec, design doc, and
code plan, and verified its every claim about the current docs by reading
`README.md`, `docs/song-format.md`, and `src/block.json` directly.

### Stale-claims inventory — accurate and complete

Every obsolete statement the plan lists exists where it says, and I found **no
missed** now-false statement:

- README `<pre>` / "as text" / "escaped text" framing is present at lines 5
  (Status), 13 & 15 ("What the block does today"), 47/51/52 (§4 "What the front
  end shows"), 90 ("Building & installing" success sentence), 112 (`render.php`
  file-layout row), 116 (`specs/` row), 153 ("Render contract — verbatim escaped
  passthrough"), 155 (Tests paragraph), and 163 ("Forthcoming → Visual notation
  rendering"). All are assigned (lines 47/51/52 fall inside §4, which D1 rewrites
  wholesale).
- `docs/song-format.md` line 9 ("no visual notation editor and no audio playback
  yet — those are future work" + the README cross-reference) → D2. The
  forward-looking audio caveat in "How a stored pitch resolves" (line 252) is
  audio-only and correctly left intact by D2.
- `src/block.json` line 9 (`description` "Visual notation and audio playback are
  future work.") → D4.

The plan correctly does **not** slate for removal the still-true framing — the
"dynamic (server-rendered) block … front-end HTML produced by PHP at render time"
sentence (line 13) and the storage-model / schema-validator paragraphs (lines
135–151) — targeting only the stale `<pre>`/escaped-text fragments. No over-reach.
The "only two doc files in the repo (README + song-format), no CHANGELOG/
CONTRIBUTING/ARCHITECTURE/NOTICE" claim is verified by a repo-wide glob.

### Completeness

Every reader-facing change from the shipped feature is documented: frontend
renders a braced grand staff (D1 user / D3 contributor); editor unchanged, no
preview (D1, reinforced by D2's "authoring still raw JSON"); empty → nothing and
non-renderable → nothing with no raw echo / no error (D1, D3); the new render
contract — container + inert JSON `<script>`, `<` ETAGO escape, PHP
no-validate (D3); the new renderer modules `view.js` + `src/notation/*` in the
file-layout table and tests (D3); the bundled RENAMED Bravura font under SIL OFL
1.1 with `OFL.txt` as the authority (D3 + coverage note); and how to exercise the
renderer with the annotated sample song (D3). The three must-not-miss stale
claims (block.json "future work", song-format.md "no visual notation yet",
README's raw-data frontend description) are all assigned.

### Task quality, sequencing, fidelity

- Each task (D1–D4) carries Goal, Audience, Files, Sections-scope, Depends on,
  Traces to, and checkable Acceptance; IDs are stable; audiences are correct.
- D1 and D3 both edit `README.md` but touch **disjoint** sections (D1 = Status /
  "What the block does today" / "Using the Piano block" §4 / "Forthcoming" /
  "Building & installing" success line; D3 = "For contributors" only). Order
  D1 → D2 → D3 → D4 is sound; D2's dependency on D1 is real (the cross-reference
  target, and the `#using-the-piano-block` anchor is preserved by D1).
- No scope creep: the plan's hard guards (no editor preview, no notation library,
  no no-JS guarantee, no theme-adaptive color, no visible title/composer heading,
  no raw echo/error, no format change, no symbol-level API duplication) are even
  encoded as negative acceptance checks in D1 and D3.
- Every acceptance item is checkable against shipped artifacts named in the code
  plan (`src/view.js`, `src/notation/*`, `pb-music.woff2`, `OFL.txt`,
  `src/notation/__tests__/`, the `<` transport escape, `<svg role="img">`,
  `normalizeStep.js`).

### Minor, non-blocking observations (no action required)

- D3 adds the `src/song/normalizeStep.js` file-layout row "if not already
  present." Code-plan T1 definitively creates it, so a doc-writer checking the
  shipped tree will add the row; the conditional resolves correctly against
  reality.
- No task dedicates a line to the SVG accessible label (a11y `<title>`). This is a
  contributor/quality detail, was not on the required reader-facing-change
  checklist, and is consistent with the guard against over-documenting metadata
  display — acceptable to leave at the level the plan keeps it.

The plan is complete, faithful, well-formed, and free of collisions or scope
creep. Approved.
