/**
 * Front-end render end-to-end tests for the Piano block (AC1, AC2, AC5, AC6,
 * AC7, AC8 injection protection, AC12).
 *
 * These tests drive a real WordPress instance via wp-env and verify the
 * client-side notation the `viewScript` (`view.js`) draws from the song the
 * server-rendered container carries (design §2.5, §8). The frontend has three
 * display states:
 *
 *   - empty / whitespace song     → nothing (no container, no SVG);
 *   - present-but-non-renderable  → nothing visible (the wrapper may exist with
 *                                   the inert JSON `<script>` inside, but no SVG);
 *   - present-and-conformant      → an `<svg role="img">` grand staff (two staff
 *                                   bands, brace, both clefs) with an accessible
 *                                   name from `metadata`, and NO raw-JSON `<pre>`.
 *
 * Two further behaviours are covered: the score reflows responsively (the number
 * of stacked systems changes between a wide and a narrow viewport, AC5), and a
 * conformant song carrying hostile literals (`</script>`, `<!--`,
 * `<script>alert()</script>`) in its free-text fields renders inert text and
 * still parses back to the exact author bytes — the JSON `<script>` does not
 * break out and no script executes (the relocated AC8 protection: the old
 * `esc_html(<pre>)` guarantee now lives in the `render.php` ETAGO escape +
 * the SVG `textContent` emit, design §6.8).
 *
 * Prerequisites (run from the worktree root):
 *   1. npm install        — installs the toolchain (Playwright via @wordpress/scripts)
 *   2. npm run build       — compiles src/ → build/ so wp-env serves the real block
 *   3. npm run env:start   — boots wp-env (Docker); the tests target the tests site
 *   4. npm run test:e2e    — runs this spec
 *
 * The block plugin is activated and posts are cleaned up via requestUtils.
 */

import { expect, test } from "@wordpress/e2e-test-utils-playwright";

// The block wrapper class (the `get_block_wrapper_attributes()` class on
// `render.php`'s `<div>`); the frontend SVG is mounted inside it.
const BLOCK_CLASS = "wp-block-piano-block-piano";

/**
 * The comprehensive "exercises everything" song — the same fixture the design's
 * §9 annotated example (`docs/song-format.md`) describes and the validator's own
 * `src/song/__tests__/validate.test.js` transcribes. It is conformant, so it
 * renders; its `metadata` (title "Example", composer "A. Composer") drives the
 * accessible name. It exercises per-hand clefs, `alters`, a time signature, a
 * tempo, dotted notes, a chord, a per-note accidental, ties/slurs, dynamics, a
 * free-text note annotation ("C"), every barline, an octave shift, and a mid-song
 * section change — the AC2 coverage surface.
 */
const COMPREHENSIVE_SONG = JSON.stringify({
	metadata: {
		title: "Example",
		composer: "A. Composer",
	},
	defaults: {
		tempo: { bpm: 120, beatUnit: "quarter" },
		timeSignature: { beats: 4, beatType: 4 },
		rightHand: { clef: "treble" },
		leftHand: { clef: "bass", alters: { B: -1 } },
	},
	sections: [
		{
			measures: [
				{
					barlineStart: "repeat-start",
					rightHand: [
						{
							type: "note",
							duration: "half",
							dots: 1,
							dynamic: "mf",
							notes: [{ text: "C", placement: "above" }],
							slur: "start",
							tie: "start",
							pitches: [
								{ step: "C", octave: 5 },
								{ step: "E", octave: 5 },
								{ step: "G", octave: 5 },
							],
						},
						{ type: "rest", duration: "quarter" },
					],
					leftHand: [
						{
							type: "note",
							duration: "quarter",
							pitches: [{ step: "do", octave: 3 }],
						},
						{
							type: "note",
							duration: "quarter",
							pitches: [{ step: "sol", octave: 3 }],
						},
						{
							type: "note",
							duration: "half",
							pitches: [{ step: "si", octave: 2 }],
						},
					],
				},
				{
					barlineEnd: "repeat-end",
					rightHand: [
						{
							type: "note",
							duration: "whole",
							tie: "stop",
							slur: "stop",
							pitches: [{ step: "C", octave: 5 }],
						},
					],
					leftHand: [
						{
							type: "note",
							duration: "whole",
							pitches: [{ step: "F", octave: 2, alter: 1 }],
						},
					],
				},
			],
		},
		{
			tempo: { bpm: 90, beatUnit: "quarter" },
			timeSignature: { beats: 3, beatType: 4 },
			rightHand: {
				octaveShift: 1,
				alters: { F: 1, C: 1 },
			},
			leftHand: {
				clef: "tenor",
				alters: {},
			},
			measures: [
				{
					barlineEnd: "final",
					rightHand: [
						{
							type: "note",
							duration: "quarter",
							dynamic: "p",
							pitches: [{ step: "F", octave: 5 }],
						},
						{
							type: "note",
							duration: "quarter",
							pitches: [{ step: "C", octave: 6 }],
						},
						{ type: "rest", duration: "quarter" },
					],
					leftHand: [
						{
							type: "note",
							duration: "half",
							dots: 1,
							pitches: [{ step: "C", octave: 3 }],
						},
					],
				},
			],
		},
	],
});

/** The accessible name the §7 templates produce for `COMPREHENSIVE_SONG`. */
const COMPREHENSIVE_NAME = "Example by A. Composer";

// AC6: a whitespace-only song. `render.php` trims it and emits NO container at
// all, so the page has no Piano-block wrapper.
const WHITESPACE_SONG = "   \n\t  ";

// AC7 case (i): not parseable as JSON — `validateSong` returns a parse error, so
// `view.js` draws nothing (the wrapper stays empty).
const INVALID_JSON_SONG = "{ not json";

// AC7 case (ii): valid JSON but non-conformant — `quaver` is not in the closed
// duration enum, so the validator flags it and `view.js` draws nothing.
const NON_CONFORMANT_SONG = JSON.stringify({
	sections: [
		{ measures: [{ rightHand: [{ type: "note", duration: "quaver" }] }] },
	],
});

/**
 * A conformant song large enough that its measures cannot all fit one system at
 * a narrow width: 24 single-quarter-note measures in both hands. Used for the
 * responsive-wrapping test (AC5) — the number of stacked systems must change
 * between a wide and a narrow viewport.
 */
const MANY_MEASURE_SONG = JSON.stringify({
	metadata: { title: "Wrapping" },
	sections: [
		{
			measures: Array.from({ length: 24 }, () => ({
				rightHand: [
					{
						type: "note",
						duration: "quarter",
						pitches: [{ step: "G", octave: 4 }],
					},
				],
				leftHand: [
					{
						type: "note",
						duration: "quarter",
						pitches: [{ step: "C", octave: 3 }],
					},
				],
			})),
		},
	],
});

// AC8 injection protection: a CONFORMANT song whose free-text fields carry the
// HTML-significant breakout literals. A note's `text` and `metadata.title` are free
// text, so the song stays conformant; it must therefore still `JSON.parse` back
// to these exact bytes (the `render.php` `<` escape round-trips) and RENDER.
const HOSTILE_TITLE = `Pwn </script><!-- <script>alert("xss")</script>`;
const HOSTILE_CHORD = `C7 </script><!-- <script>alert('chord')</script>`;
const HOSTILE_SONG = JSON.stringify({
	metadata: { title: HOSTILE_TITLE, composer: "A. Composer" },
	sections: [
		{
			measures: [
				{
					rightHand: [
						{
							type: "note",
							duration: "quarter",
							notes: [{ text: HOSTILE_CHORD, placement: "above" }],
							pitches: [{ step: "C", octave: 5 }],
						},
					],
				},
			],
		},
	],
});

/**
 * A conformant song authored specifically to exercise every observable
 * note-rendering behavior end-to-end. Two attachment modes share the same
 * vocabulary of attributes the front-end stamps:
 *
 *   - a per-event note (`{ text, placement }` in an event's `notes` array) draws a
 *     `<text data-text="note" data-placement>` inside its hand's `<g data-hand>`;
 *     its staff is read from the enclosing `data-hand`, so it carries NO data-staff;
 *   - a standalone note (`{ text, placement, staff, beat? }` in a measure's `notes`
 *     array) draws a `<text data-text="note" data-staff data-placement>` directly in
 *     the `<g data-measure>` (NOT inside a `data-hand`), so its staff is read from
 *     `data-staff`.
 *
 * Every note carries a unique `text` label so each node is individually locatable
 * by its `textContent`. Measures isolate concerns so on-page bounding boxes are
 * unambiguous:
 *
 *   - measure 1 — per-event notes in all four bands: a RH event with an above AND a
 *     below note (the same event covers two bands and the both-above-and-below case),
 *     and a LH event with an above AND a below note;
 *   - measure 2 — standalone notes in all four bands: `{staff, placement}` over the
 *     two staves × the two placements, including the coexisting below-RH and above-LH
 *     pair (both fall in the inter-staff gap yet stay distinguishable by data-staff);
 *   - measure 3 — a beat:0 vs beat:2 ordering pair (the beat-2 node must draw to the
 *     right of the beat-0 node), plus an over-content beat:99 note (must stay within
 *     the system's horizontal bounds);
 *   - measure 4 — a per-event note AND a standalone note coexisting in one measure.
 */
const NOTES_SONG = JSON.stringify({
	metadata: { title: "Notes", composer: "A. Composer" },
	sections: [
		{
			measures: [
				// Measure 1 — per-event notes routed to all four bands.
				{
					rightHand: [
						{
							type: "note",
							duration: "whole",
							notes: [
								{ text: "rh-above", placement: "above" },
								{ text: "rh-below", placement: "below" },
							],
							pitches: [{ step: "C", octave: 5 }],
						},
					],
					leftHand: [
						{
							type: "note",
							duration: "whole",
							notes: [
								{ text: "lh-above", placement: "above" },
								{ text: "lh-below", placement: "below" },
							],
							pitches: [{ step: "C", octave: 3 }],
						},
					],
				},
				// Measure 2 — standalone notes routed to all four bands.
				{
					notes: [
						{ text: "sa-rh-above", placement: "above", staff: "rightHand" },
						{ text: "sa-rh-below", placement: "below", staff: "rightHand" },
						{ text: "sa-lh-above", placement: "above", staff: "leftHand" },
						{ text: "sa-lh-below", placement: "below", staff: "leftHand" },
					],
					rightHand: [
						{
							type: "note",
							duration: "whole",
							pitches: [{ step: "C", octave: 5 }],
						},
					],
					leftHand: [
						{
							type: "note",
							duration: "whole",
							pitches: [{ step: "C", octave: 3 }],
						},
					],
				},
				// Measure 3 — beat ordering (0 < 2) plus an over-content beat (99).
				{
					notes: [
						{ text: "beat-0", placement: "above", staff: "rightHand", beat: 0 },
						{ text: "beat-2", placement: "above", staff: "rightHand", beat: 2 },
						{
							text: "beat-99",
							placement: "below",
							staff: "leftHand",
							beat: 99,
						},
					],
					rightHand: [
						{
							type: "note",
							duration: "whole",
							pitches: [{ step: "C", octave: 5 }],
						},
					],
					leftHand: [
						{
							type: "note",
							duration: "whole",
							pitches: [{ step: "C", octave: 3 }],
						},
					],
				},
				// Measure 4 — a per-event note AND a standalone note coexist.
				{
					notes: [
						{
							text: "coexist-standalone",
							placement: "below",
							staff: "leftHand",
						},
					],
					rightHand: [
						{
							type: "note",
							duration: "whole",
							notes: [{ text: "coexist-perevent", placement: "above" }],
							pitches: [{ step: "C", octave: 5 }],
						},
					],
					leftHand: [
						{
							type: "note",
							duration: "whole",
							pitches: [{ step: "C", octave: 3 }],
						},
					],
				},
			],
		},
	],
});

// A conformant song whose ONLY free text is the spec's representative hostile
// literal `'C7 & <alt> "sus"'` on a per-event note. It must render verbatim as
// inert `textContent` — the ampersand, angle brackets, and quotes are drawn as
// literal characters, never parsed as markup, and no <script>/<foreignObject>
// node is produced.
const HOSTILE_FREE_TEXT = `C7 & <alt> "sus"`;
const HOSTILE_FREE_TEXT_SONG = JSON.stringify({
	metadata: { title: "Hostile", composer: "A. Composer" },
	sections: [
		{
			measures: [
				{
					rightHand: [
						{
							type: "note",
							duration: "whole",
							notes: [{ text: HOSTILE_FREE_TEXT, placement: "above" }],
							pitches: [{ step: "C", octave: 5 }],
						},
					],
				},
			],
		},
	],
});

/**
 * Insert the Piano block, fill its song field with the given text (when
 * provided), publish the post, and return the published post's id.
 *
 * @param {Object}      utils
 * @param {Object}      utils.admin  Admin fixture.
 * @param {Object}      utils.editor Editor fixture.
 * @param {string|null} song         The raw song text to type, or null to leave blank.
 * @return {Promise<number>} The published post id.
 */
async function publishPostWithSong({ admin, editor }, song) {
	await admin.createNewPost();
	await editor.insertBlock({ name: "piano-block/piano" });

	if (song !== null) {
		const field = editor.canvas.getByLabel("Song (JSON)");
		await field.fill(song);
	}

	return editor.publishPost();
}

/** The block's rendered SVG (a labeled graphic), scoped to the block wrapper. */
function blockSvg(page) {
	return page.locator(`.${BLOCK_CLASS} svg[role="img"]`);
}

/**
 * The single note `<text data-text="note">` node whose verbatim `textContent`
 * EXACTLY equals `text`, scoped to the block's SVG. An anchored regex is used so a
 * label that is a substring of another (e.g. `rh-above` inside `sa-rh-above`) does
 * not over-match.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} text The note's exact text content.
 * @return {import('@playwright/test').Locator}
 */
function noteByText(page, text) {
	const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return blockSvg(page)
		.locator('[data-text="note"]')
		.filter({ hasText: new RegExp(`^${escaped}$`) });
}

test.describe("Piano block — front-end render", () => {
	test.beforeAll(async ({ requestUtils }) => {
		await requestUtils.activatePlugin("piano-block");
	});

	test.beforeEach(async ({ requestUtils }) => {
		await requestUtils.deleteAllPosts();
	});

	test.afterAll(async ({ requestUtils }) => {
		await requestUtils.deleteAllPosts();
	});

	test("AC6 — an empty / whitespace song renders nothing", async ({
		admin,
		editor,
		page,
	}) => {
		const postId = await publishPostWithSong(
			{ admin, editor },
			WHITESPACE_SONG,
		);

		await page.goto(`/?p=${postId}`);

		// `render.php` emits NO container for a whitespace song: no block wrapper,
		// hence no SVG and no notation.
		await expect(page.locator(`.${BLOCK_CLASS}`)).toHaveCount(0);
		await expect(blockSvg(page)).toHaveCount(0);

		// The old behavior is gone: no raw-JSON <pre> from the block (or at all).
		await expect(page.locator("pre")).toHaveCount(0);
	});

	test("AC1/AC2/AC12 — a conformant song renders an SVG grand staff with an accessible name (no raw JSON)", async ({
		admin,
		editor,
		page,
	}) => {
		const postId = await publishPostWithSong(
			{ admin, editor },
			COMPREHENSIVE_SONG,
		);

		await page.goto(`/?p=${postId}`);

		// (AC1) The block renders a labeled SVG graphic, not raw text.
		const svg = blockSvg(page);
		await expect(svg).toBeVisible();

		// (AC12) Its accessible name is the §7 title-by-composer template — exposed
		// via the SVG's first-child <title>.
		await expect(svg).toHaveAccessibleName(COMPREHENSIVE_NAME);
		await expect(svg.locator("title").first()).toHaveText(COMPREHENSIVE_NAME);

		// (AC1) A braced grand staff: each system has TWO staff bands (RH upper, LH
		// lower) and a leading reserve carrying BOTH clefs. The emit layer stamps a
		// `[data-staff-lines]` group per staff, a `g[data-system]` per system, and the
		// reserve clefs inside `[data-reserve]`. So both counts are 2 × systems. (The
		// total `[data-clef]` count may be higher — a mid-song clef change draws an
		// extra inline cautionary clef, AC4 — so the reserve scope isolates the
		// grand-staff clefs.)
		const systemCount = await svg.locator("g[data-system]").count();
		expect(systemCount).toBeGreaterThan(0);
		await expect(svg.locator("[data-staff-lines]")).toHaveCount(
			2 * systemCount,
		);
		await expect(svg.locator("[data-reserve] [data-clef]")).toHaveCount(
			2 * systemCount,
		);
		// The brace straddling both staves is the visual hallmark of the grand staff.
		await expect(svg.locator("[data-reserve]")).toHaveCount(systemCount);

		// (AC2 spot-check) Recognizable notation primitives are present: noteheads,
		// and the free-text note annotation "C" renders as inert SVG <text>.
		await expect(svg.locator("[data-notehead]")).not.toHaveCount(0);
		await expect(svg.locator('[data-text="note"]')).toContainText("C");

		// (AC1) The raw JSON is NOT shown to the reader: no <pre>, and the visible
		// text of the block is not the JSON document. (A successful render replaces
		// the inert JSON `<script>` carrier with the SVG, so it is no longer in the
		// DOM — the song never appears as visible text or executable script.)
		await expect(page.locator("pre")).toHaveCount(0);
		const blockText = await page.locator(`.${BLOCK_CLASS}`).innerText();
		expect(blockText).not.toContain('"sections"');
		expect(blockText).not.toContain('"timeSignature"');
	});

	test("AC7 — an invalid-JSON song renders nothing visible", async ({
		admin,
		editor,
		page,
	}) => {
		const postId = await publishPostWithSong(
			{ admin, editor },
			INVALID_JSON_SONG,
		);

		await page.goto(`/?p=${postId}`);

		// The wrapper MAY exist (carrying the inert JSON <script>), but the
		// validate gate fails, so NO SVG and no visible notation is drawn.
		await expect(blockSvg(page)).toHaveCount(0);
		await expect(page.locator("pre")).toHaveCount(0);

		// No reader-facing error message, and the raw JSON is not echoed visibly.
		const blockText = (
			await page.locator(`.${BLOCK_CLASS}`).innerText()
		).trim();
		expect(blockText).toBe("");
	});

	test("AC7 — a valid-but-non-conformant song renders nothing visible", async ({
		admin,
		editor,
		page,
	}) => {
		const postId = await publishPostWithSong(
			{ admin, editor },
			NON_CONFORMANT_SONG,
		);

		await page.goto(`/?p=${postId}`);

		// `quaver` fails validation → no SVG, no visible notation, no error text.
		await expect(blockSvg(page)).toHaveCount(0);
		await expect(page.locator("pre")).toHaveCount(0);
		const blockText = (
			await page.locator(`.${BLOCK_CLASS}`).innerText()
		).trim();
		expect(blockText).toBe("");
	});

	test("AC5 — the score reflows responsively (wrapping changes with width)", async ({
		admin,
		editor,
		page,
	}) => {
		const postId = await publishPostWithSong(
			{ admin, editor },
			MANY_MEASURE_SONG,
		);

		// Wide viewport: many measures fit per system → fewer stacked systems.
		await page.setViewportSize({ width: 1400, height: 900 });
		await page.goto(`/?p=${postId}`);

		const svg = blockSvg(page);
		await expect(svg).toBeVisible();
		// Each system is a <g data-system> the emit layer stamps.
		const systems = svg.locator("g[data-system]");
		await expect(systems.first()).toBeVisible();
		const wideSystems = await systems.count();
		expect(wideSystems).toBeGreaterThan(0);

		// Narrow (mobile) viewport: fewer measures fit per system → MORE stacked
		// systems. The same post, re-measured by the ResizeObserver after the
		// viewport shrinks.
		await page.setViewportSize({ width: 360, height: 900 });
		// Wait for the rAF-debounced reflow to settle on a larger system count.
		await expect
			.poll(async () => svg.locator("g[data-system]").count())
			.toBeGreaterThan(wideSystems);
		const narrowSystems = await svg.locator("g[data-system]").count();

		// Wrapping changed with width (AC5) …
		expect(narrowSystems).toBeGreaterThan(wideSystems);
		// … and the score stays usable at the narrow width (still a labeled graphic
		// with staff bands, not clipped away).
		await expect(svg).toBeVisible();
		await expect(svg.locator("[data-staff-lines]")).not.toHaveCount(0);
	});

	test("AC8 (relocated) — a conformant song with hostile free text renders inert and still draws", async ({
		admin,
		editor,
		page,
	}) => {
		// Surface any executing script: if the payload ever ran, this flips true.
		await page.addInitScript(() => {
			window.__pianoXssFired = false;
			const realAlert = window.alert;
			window.alert = (...args) => {
				window.__pianoXssFired = true;
				return realAlert?.(...args);
			};
		});

		const postId = await publishPostWithSong({ admin, editor }, HOSTILE_SONG);

		await page.goto(`/?p=${postId}`);

		const svg = blockSvg(page);

		// (a) Because the song is CONFORMANT, the `<` escape round-trips: the
		// JSON <script> did NOT break out, `JSON.parse` succeeded on the exact
		// author bytes, and the notation RENDERS.
		await expect(svg).toBeVisible();
		await expect(svg.locator("[data-staff-lines]")).not.toHaveCount(0);

		// (b) No script executed from the block payload: the only <script> inside
		// the wrapper is the inert application/json data carrier — there is no live
		// (executable / no-type) <script> injected by the song, and alert never fired.
		await expect(
			page.locator(`.${BLOCK_CLASS} script:not([type="application/json"])`),
		).toHaveCount(0);
		expect(await page.evaluate(() => window.__pianoXssFired)).toBe(false);

		// (c) The hostile text is inert: it appears ONLY as SVG <text> content
		// (built via textContent, design §6.8), never parsed as markup. The note
		// carries the hostile literal verbatim as text…
		await expect(svg.locator('[data-text="note"]')).toContainText(
			HOSTILE_CHORD,
		);
		// …and the accessible name (the SVG <title>) carries the hostile title
		// verbatim as inert text, with the "by composer" wrapper.
		await expect(svg).toHaveAccessibleName(`${HOSTILE_TITLE} by A. Composer`);

		// (d) Transport-side proof the JSON `<script>` did NOT break out: fetch the
		// RAW server HTML (before `view.js` runs and swaps the carrier for the SVG).
		// `render.php` escapes every `<` to the JSON unicode escape `<`, so the
		// hostile `</script>` / `<!--` literals appear ONLY in their escaped form
		// inside the carrier — the raw markup must contain `</script` and NOT a
		// literal `</script>` that would have closed the carrier early. Because the
		// escape is a legal JSON escape, the carrier still `JSON.parse`s back to the
		// EXACT author bytes (already proven by (a)+(c) rendering the verbatim text).
		const rawHtml = await (await page.request.get(`/?p=${postId}`)).text();
		const carrierStart = rawHtml.indexOf(
			'<script type="application/json" class="wp-block-piano-block-piano__song">',
		);
		expect(carrierStart).toBeGreaterThan(-1);
		// The carrier opening tag is followed by the escaped payload; the FIRST
		// `</script>` after it is the carrier's own (intact) closing tag, with the
		// escaped hostile sequence sitting safely before it.
		const afterOpen = rawHtml.slice(carrierStart);
		expect(afterOpen).toContain("\\u003C/script>");
		expect(afterOpen).toContain("\\u003C!--");
		// The escaped JSON still parses back to the exact author bytes.
		const payload = afterOpen.slice(
			afterOpen.indexOf(">") + 1,
			afterOpen.indexOf("</script>"),
		);
		expect(JSON.parse(payload)).toEqual(JSON.parse(HOSTILE_SONG));
	});
});

test.describe("Piano block — note annotations rendered on a real page", () => {
	test.beforeAll(async ({ requestUtils }) => {
		await requestUtils.activatePlugin("piano-block");
	});

	test.beforeEach(async ({ admin, editor, requestUtils, page }) => {
		await requestUtils.deleteAllPosts();
		// Publish the comprehensive notes fixture once per test and land on its page,
		// wide enough that all four measures share one system (so within-system
		// bounding-box comparisons are unambiguous).
		await page.setViewportSize({ width: 1400, height: 900 });
		const postId = await publishPostWithSong({ admin, editor }, NOTES_SONG);
		await page.goto(`/?p=${postId}`);
		await expect(blockSvg(page)).toBeVisible();
	});

	test.afterAll(async ({ requestUtils }) => {
		await requestUtils.deleteAllPosts();
	});

	test("a per-event note renders in each of the four bands (staff via data-hand, placement via data-placement)", async ({
		page,
	}) => {
		// RH above + below and LH above + below — the four bands via the per-event
		// attachment mode. Each note carries data-placement; its staff is read from the
		// enclosing <g data-hand>, and it carries NO data-staff.
		const cases = [
			{ text: "rh-above", hand: "rightHand", placement: "above" },
			{ text: "rh-below", hand: "rightHand", placement: "below" },
			{ text: "lh-above", hand: "leftHand", placement: "above" },
			{ text: "lh-below", hand: "leftHand", placement: "below" },
		];

		for (const { text, hand, placement } of cases) {
			const note = noteByText(page, text);
			await expect(note).toHaveCount(1);
			await expect(note).toHaveAttribute("data-placement", placement);
			// Staff is observable from the enclosing data-hand (no data-staff on a
			// per-event note).
			await expect(note).not.toHaveAttribute("data-staff", /.*/);
			const enclosingHand = await note.evaluate((n) =>
				n.closest("[data-hand]")?.getAttribute("data-hand"),
			);
			expect(enclosingHand).toBe(hand);
		}
	});

	test("a standalone note renders in each of the four bands (staff via data-staff, placement via data-placement)", async ({
		page,
	}) => {
		// {staff, placement} over the two staves × the two placements — the four bands
		// via the standalone attachment mode. Each note carries data-staff AND
		// data-placement and is NOT inside a <g data-hand>.
		const cases = [
			{ text: "sa-rh-above", staff: "rightHand", placement: "above" },
			{ text: "sa-rh-below", staff: "rightHand", placement: "below" },
			{ text: "sa-lh-above", staff: "leftHand", placement: "above" },
			{ text: "sa-lh-below", staff: "leftHand", placement: "below" },
		];

		for (const { text, staff, placement } of cases) {
			const note = noteByText(page, text);
			await expect(note).toHaveCount(1);
			await expect(note).toHaveAttribute("data-staff", staff);
			await expect(note).toHaveAttribute("data-placement", placement);
			// A standalone note is a direct child of the measure group, never a hand group.
			const insideHand = await note.evaluate(
				(n) => n.closest("[data-hand]") !== null,
			);
			expect(insideHand).toBe(false);
		}
	});

	test("a below-RH note and an above-LH note coexist and stay distinguishable by staff discriminator", async ({
		page,
	}) => {
		// Both land in the inter-staff gap, yet the standalone data-staff keeps them
		// distinct: one belongs to the right hand, the other to the left.
		const belowRh = noteByText(page, "sa-rh-below");
		const aboveLh = noteByText(page, "sa-lh-above");

		await expect(belowRh).toHaveCount(1);
		await expect(aboveLh).toHaveCount(1);
		await expect(belowRh).toHaveAttribute("data-staff", "rightHand");
		await expect(belowRh).toHaveAttribute("data-placement", "below");
		await expect(aboveLh).toHaveAttribute("data-staff", "leftHand");
		await expect(aboveLh).toHaveAttribute("data-placement", "above");

		// They are genuinely two different nodes, both present on the page.
		await expect(belowRh).toBeVisible();
		await expect(aboveLh).toBeVisible();
	});

	test("an event carrying both an above and a below note renders both, at distinct vertical positions", async ({
		page,
	}) => {
		// The measure-1 RH event carries rh-above and rh-below: both render, in different
		// bands (above the staff vs the inter-staff gap), so their on-page Ys differ.
		const above = noteByText(page, "rh-above");
		const below = noteByText(page, "rh-below");

		await expect(above).toHaveCount(1);
		await expect(below).toHaveCount(1);

		const aboveBox = await above.boundingBox();
		const belowBox = await below.boundingBox();
		expect(aboveBox).not.toBeNull();
		expect(belowBox).not.toBeNull();
		// The "above" note sits higher on the page (a smaller Y) than the "below" note.
		expect(aboveBox.y).toBeLessThan(belowBox.y);
	});

	test("a measure with both a per-event note and a standalone note renders both", async ({
		page,
	}) => {
		// Measure 4 carries a per-event note (in a data-hand) and a standalone note (in
		// the measure group). Both must be present and distinguishable by discriminator.
		const perEvent = noteByText(page, "coexist-perevent");
		const standalone = noteByText(page, "coexist-standalone");

		await expect(perEvent).toHaveCount(1);
		await expect(standalone).toHaveCount(1);

		// The per-event note lives inside a data-hand and has no data-staff…
		await expect(perEvent).not.toHaveAttribute("data-staff", /.*/);
		const perEventHand = await perEvent.evaluate((n) =>
			n.closest("[data-hand]")?.getAttribute("data-hand"),
		);
		expect(perEventHand).toBe("rightHand");
		// …the standalone note carries data-staff and is not inside a data-hand.
		await expect(standalone).toHaveAttribute("data-staff", "leftHand");
		const standaloneInsideHand = await standalone.evaluate(
			(n) => n.closest("[data-hand]") !== null,
		);
		expect(standaloneInsideHand).toBe(false);
	});

	test("a beat:2 standalone note renders further right than a beat:0 note, and a beat:99 note stays within the system bounds", async ({
		page,
	}) => {
		const beat0 = noteByText(page, "beat-0");
		const beat2 = noteByText(page, "beat-2");
		const beat99 = noteByText(page, "beat-99");

		await expect(beat0).toHaveCount(1);
		await expect(beat2).toHaveCount(1);
		await expect(beat99).toHaveCount(1);

		const beat0Box = await beat0.boundingBox();
		const beat2Box = await beat2.boundingBox();
		expect(beat0Box).not.toBeNull();
		expect(beat2Box).not.toBeNull();
		// Later beat ⇒ further right on the page.
		expect(beat2Box.x).toBeGreaterThan(beat0Box.x);

		// The over-content beat:99 note is clamped inside the system's horizontal
		// bounds: its box sits within the enclosing <g data-system>'s box.
		const system = blockSvg(page).locator("g[data-system]").first();
		const systemBox = await system.boundingBox();
		const beat99Box = await beat99.boundingBox();
		expect(systemBox).not.toBeNull();
		expect(beat99Box).not.toBeNull();
		expect(beat99Box.x).toBeGreaterThanOrEqual(systemBox.x);
		expect(beat99Box.x + beat99Box.width).toBeLessThanOrEqual(
			systemBox.x + systemBox.width + 1,
		);
	});
});

test.describe("Piano block — hostile free text in a note renders inert", () => {
	test.beforeAll(async ({ requestUtils }) => {
		await requestUtils.activatePlugin("piano-block");
	});

	test.beforeEach(async ({ requestUtils }) => {
		await requestUtils.deleteAllPosts();
	});

	test.afterAll(async ({ requestUtils }) => {
		await requestUtils.deleteAllPosts();
	});

	test("hostile free text renders as literal textContent with no <script>/<foreignObject> produced", async ({
		admin,
		editor,
		page,
	}) => {
		// Surface any executing script: if the payload ever ran, this flips true.
		await page.addInitScript(() => {
			window.__pianoXssFired = false;
			const realAlert = window.alert;
			window.alert = (...args) => {
				window.__pianoXssFired = true;
				return realAlert?.(...args);
			};
		});

		const postId = await publishPostWithSong(
			{ admin, editor },
			HOSTILE_FREE_TEXT_SONG,
		);
		await page.goto(`/?p=${postId}`);

		const svg = blockSvg(page);
		await expect(svg).toBeVisible();

		// The hostile literal is drawn verbatim as inert SVG <text> content — the `&`,
		// `<`, `>`, and quotes are characters, never parsed as markup.
		const note = svg.locator('[data-text="note"]');
		await expect(note).toHaveCount(1);
		expect(await note.textContent()).toBe(HOSTILE_FREE_TEXT);

		// No markup was injected from the free text: the angle-bracketed literal did NOT
		// create a <script> or <foreignObject> node anywhere in the block, and no live
		// (executable) <script> exists beyond the inert JSON carrier.
		await expect(page.locator(`.${BLOCK_CLASS} foreignObject`)).toHaveCount(0);
		await expect(
			page.locator(`.${BLOCK_CLASS} script:not([type="application/json"])`),
		).toHaveCount(0);
		expect(await page.evaluate(() => window.__pianoXssFired)).toBe(false);
	});
});
