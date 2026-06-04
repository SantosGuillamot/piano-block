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
 * free-text `chordSymbol` ("C"), every barline, an octave shift, and a mid-song
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
							chordSymbol: "C",
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
// HTML-significant breakout literals. `chordSymbol` and `metadata.title` are free
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
							chordSymbol: HOSTILE_CHORD,
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
		// and the free-text chord symbol "C" renders as inert SVG <text>.
		await expect(svg.locator("[data-notehead]")).not.toHaveCount(0);
		await expect(svg.locator('[data-text="chord-symbol"]')).toContainText("C");

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
		// (built via textContent, design §6.8), never parsed as markup. The chord
		// symbol carries the hostile literal verbatim as text…
		await expect(svg.locator('[data-text="chord-symbol"]')).toContainText(
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
