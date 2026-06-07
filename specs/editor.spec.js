/**
 * Editor end-to-end tests for the Piano block.
 *
 * These tests drive the real built block in the editor via wp-env and verify
 * its authoring + persistence behavior. The visual editor is the DEFAULT
 * surface: a freshly inserted block shows the visual empty state (a "start a
 * new song" affordance), a conformant song shows the structured editor beside a
 * live sheet-music preview, and a non-empty-but-invalid song shows an invalid
 * state that routes to the raw JSON editor. The raw `Song (JSON)` textarea is
 * reached by switching the block into JSON mode from the block toolbar; in that
 * mode the raw string persists unconditionally — conformant input shows no
 * error and is stored verbatim, non-conformant input is flagged by a visible
 * error notice yet is STILL stored unchanged, and a stored song round-trips
 * faithfully across save/reload including HTML-significant characters.
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

// The label of the raw-JSON field (src/edit.js) — used to locate the
// TextareaControl on the block canvas by its accessible label once the block is
// switched into JSON mode.
const SONG_FIELD_LABEL = "Song (JSON)";

// A small conformant song — exercises the required `sections` shape with one
// note so the stored value is non-trivial yet passes validation.
const CONFORMANT_SONG = JSON.stringify(
	{
		sections: [
			{
				measures: [
					{
						rightHand: [
							{
								type: "note",
								duration: "quarter",
								pitches: [{ step: "C", octave: 4 }],
							},
						],
					},
				],
			},
		],
	},
	null,
	2,
);

// A conformant song whose pitch is spelled with a Spanish note name (`do`).
// The editor edits each song in the note-name system it is already written in
// and never rewrites an untouched pitch, so an unrelated edit must leave the
// spelling intact.
const SPANISH_SONG = JSON.stringify(
	{
		sections: [
			{
				measures: [
					{
						rightHand: [
							{
								type: "note",
								duration: "quarter",
								pitches: [{ step: "do", octave: 4 }],
							},
						],
					},
				],
			},
		],
	},
	null,
	2,
);

// A conformant song whose note's `text` deliberately carries HTML-significant
// characters (a double quote, `<`, `>`, and `&`) so the save→reload round-trip
// exercises the block-delimiter-comment escaping. A note's annotation `text` is
// free text, so this stays conformant.
const ROUND_TRIP_SONG = JSON.stringify(
	{
		metadata: { title: 'A "quoted" <title> & more' },
		sections: [
			{
				measures: [
					{
						rightHand: [
							{
								type: "note",
								duration: "half",
								annotations: [{ text: 'C7 & <alt> "sus"', placement: "above" }],
								pitches: [{ step: "C", octave: 4 }],
							},
						],
					},
				],
			},
		],
	},
	null,
	2,
);

// Not parseable as JSON at all — a parse failure IS a conformance error.
const INVALID_JSON = "{ not json";

// Valid JSON but non-conformant — `quaver` is not in the closed duration enum,
// so the validator flags it.
const NON_CONFORMANT_JSON = JSON.stringify({
	sections: [
		{ measures: [{ rightHand: [{ type: "note", duration: "quaver" }] }] },
	],
});

/** Locate the single Piano block's raw-JSON field on the editor canvas. */
function songField(editor) {
	return editor.canvas.getByLabel(SONG_FIELD_LABEL);
}

/**
 * Locate the visual editor's metadata Title field on the editor canvas — a
 * structured control only present when the song is conformant.
 */
function titleField(editor) {
	return editor.canvas.getByLabel("Title");
}

/**
 * The block's non-blocking JSON-mode validation error region: a `Notice` with
 * `status="error"` rendered beneath the textarea (src/edit.js). The editor
 * shows unrelated notices, so this is scoped to the error-status notice on the
 * block canvas rather than a blanket negative on all notices.
 */
function errorNotice(editor) {
	return editor.canvas.locator(".components-notice.is-error");
}

/**
 * The live, read-only sheet-music preview's container on the canvas, into which
 * the conformant song's `<svg>` is mounted.
 */
function previewContainer(editor) {
	return editor.canvas.locator(".wp-block-piano-block-piano__preview");
}

/**
 * Switch the selected block into JSON mode via the block toolbar's mode-switch
 * button (accessible name "Edit as JSON" while in visual mode). Scoped to the
 * block toolbar, so it never collides with the canvas "Edit as JSON" button the
 * invalid state also shows.
 */
async function switchToJsonMode(editor) {
	await editor.clickBlockToolbarButton("Edit as JSON");
}

/**
 * Switch the selected block back into visual mode via the block toolbar's
 * mode-switch button (accessible name "Visual editor" while in JSON mode).
 */
async function switchToVisualMode(editor) {
	await editor.clickBlockToolbarButton("Visual editor");
}

/**
 * Seed the selected block's raw `song` via JSON mode: switch to JSON, fill the
 * textarea, and blur so the controlled value settles before anything reads it.
 */
async function seedSongViaJson(editor, raw) {
	await switchToJsonMode(editor);
	const field = songField(editor);
	await field.fill(raw);
	await field.blur();
}

/** Read the single Piano block's stored `song` attribute. */
async function storedSong(editor) {
	const blocks = await editor.getBlocks();
	return blocks[0].attributes.song;
}

test.describe("Piano block — editor authoring, persistence and validation", () => {
	test.beforeAll(async ({ requestUtils }) => {
		await requestUtils.activatePlugin("piano-block");
	});

	test.beforeEach(async ({ admin, requestUtils }) => {
		await requestUtils.deleteAllPosts();
		await admin.createNewPost();
	});

	test.afterAll(async ({ requestUtils }) => {
		await requestUtils.deleteAllPosts();
	});

	test("the visual editor is the default surface", async ({ editor }) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// The default surface is the visual empty state, not the raw textarea.
		await expect(
			editor.canvas.getByRole("button", { name: "Start a new song" }),
		).toBeVisible();
		await expect(songField(editor)).toHaveCount(0);

		// JSON mode is reachable from the toolbar; switching reveals the textarea.
		await switchToJsonMode(editor);
		await expect(songField(editor)).toBeVisible();
	});

	test("a freshly inserted block starts empty", async ({ editor }) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// The block defaults to the visual empty state…
		await expect(
			editor.canvas.getByRole("button", { name: "Start a new song" }),
		).toBeVisible();

		// …and no song content is stored: the attribute is the empty default.
		const blocks = await editor.getBlocks();
		expect(blocks).toHaveLength(1);
		expect(blocks[0].name).toBe("piano-block/piano");
		expect(blocks[0].attributes.song).toBe("");

		// In JSON mode the raw field renders blank for an empty song.
		await switchToJsonMode(editor);
		await expect(songField(editor)).toHaveValue("");
	});

	test("starting a song from scratch stores a conformant song", async ({
		editor,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// From the empty state, seed the minimal song with the visual affordance —
		// no raw JSON is typed.
		await editor.canvas
			.getByRole("button", { name: "Start a new song" })
			.click();

		// Make a purely visual edit: set the metadata title.
		const title = titleField(editor);
		await title.fill("Für Elise");
		await title.blur();

		// The stored song is non-empty and conformant, and carries the typed title.
		const stored = await storedSong(editor);
		expect(stored).not.toBe("");
		const parsed = JSON.parse(stored);
		expect(parsed.metadata.title).toBe("Für Elise");
		expect(Array.isArray(parsed.sections)).toBe(true);
	});

	test("a visual edit is reflected in the stored song", async ({ editor }) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// Seed a conformant song via JSON, then return to the visual editor.
		await seedSongViaJson(editor, CONFORMANT_SONG);
		await switchToVisualMode(editor);

		// Change a field through the visual controls (the metadata title).
		const title = titleField(editor);
		await title.fill("Moonlight");
		await title.blur();

		// The stored song reflects the change made through the visual controls.
		const parsed = JSON.parse(await storedSong(editor));
		expect(parsed.metadata.title).toBe("Moonlight");
	});

	test("a conformant song shows no error and is stored", async ({ editor }) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		await switchToJsonMode(editor);
		const field = songField(editor);
		await field.fill(CONFORMANT_SONG);
		// Blur so the controlled value settles before reading attributes.
		await field.blur();

		// No error notice is shown for conformant input.
		await expect(errorNotice(editor)).toHaveCount(0);

		// The typed text is stored verbatim in the `song` attribute.
		expect(await storedSong(editor)).toBe(CONFORMANT_SONG);
	});

	test("invalid JSON is flagged yet still stored", async ({ editor }) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		await switchToJsonMode(editor);
		const field = songField(editor);
		await field.fill(INVALID_JSON);
		await field.blur();

		// A visible error notice appears: a parse failure is a conformance error.
		const notice = errorNotice(editor);
		await expect(notice).toBeVisible();
		await expect(notice).toContainText("JSON");

		// …and the exact non-conformant text is STILL stored — persistence is
		// unconditional.
		expect(await storedSong(editor)).toBe(INVALID_JSON);
	});

	test("non-conformant JSON is flagged yet still stored", async ({
		editor,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		await switchToJsonMode(editor);
		const field = songField(editor);
		await field.fill(NON_CONFORMANT_JSON);
		await field.blur();

		// A visible error notice appears, pointing at the offending `duration`.
		const notice = errorNotice(editor);
		await expect(notice).toBeVisible();
		await expect(notice).toContainText("duration");

		// …and the exact non-conformant text is STILL stored.
		expect(await storedSong(editor)).toBe(NON_CONFORMANT_JSON);
	});

	test("a non-empty invalid song routes to the JSON editor", async ({
		editor,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// Seed an invalid song via JSON, then return to the visual editor.
		await seedSongViaJson(editor, NON_CONFORMANT_JSON);
		await switchToVisualMode(editor);

		// The invalid state takes over: an error message explaining the visual
		// editor can't edit it, and a button to fix it in JSON.
		await expect(errorNotice(editor)).toBeVisible();
		await expect(
			editor.canvas.getByRole("button", { name: "Edit as JSON" }),
		).toBeVisible();

		// The structured editor is NOT shown — there is no metadata Title field.
		await expect(titleField(editor)).toHaveCount(0);
	});

	test("the live preview renders the sheet music", async ({ editor }) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// Seed a conformant song via JSON, then return to the visual editor.
		await seedSongViaJson(editor, CONFORMANT_SONG);
		await switchToVisualMode(editor);

		// The conformant song mounts the rendered sheet music as an <svg> in the
		// preview area on the canvas.
		await expect(previewContainer(editor).locator("svg")).toBeVisible();
	});

	test("a round-trip preserves Spanish note names", async ({ editor }) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// Seed a song spelled with a Spanish note name, then return to visual mode.
		await seedSongViaJson(editor, SPANISH_SONG);
		await switchToVisualMode(editor);

		// Make an UNRELATED edit (the title) that does not touch the pitch.
		const title = titleField(editor);
		await title.fill("Estudio");
		await title.blur();

		// The untouched pitch keeps its Spanish spelling in the stored song.
		const parsed = JSON.parse(await storedSong(editor));
		expect(parsed.metadata.title).toBe("Estudio");
		expect(parsed.sections[0].measures[0].rightHand[0].pitches[0].step).toBe(
			"do",
		);
	});

	test("a stored song round-trips across save and reload", async ({
		admin,
		editor,
		page,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		await switchToJsonMode(editor);
		const field = songField(editor);
		await field.fill(ROUND_TRIP_SONG);
		await field.blur();

		// Sanity: the conformant round-trip song shows no error before saving.
		await expect(errorNotice(editor)).toHaveCount(0);

		// Save the post, then capture its id so the editor can be reopened.
		await editor.publishPost();
		const postId = await page.evaluate(() =>
			window.wp.data.select("core/editor").getCurrentPostId(),
		);

		// Reopen the post in the editor — a genuine reload from persisted markup.
		await admin.visitAdminPage("post.php", `post=${postId}&action=edit`);

		// The block reappears with its `song` attribute identical to what was
		// entered — including the HTML-significant characters.
		const blocks = await editor.getBlocks();
		expect(blocks).toHaveLength(1);
		expect(blocks[0].name).toBe("piano-block/piano");
		expect(blocks[0].attributes.song).toBe(ROUND_TRIP_SONG);

		// After reload the block defaults to visual mode; select it so its toolbar
		// is available, switch to JSON, and confirm the textarea is repopulated
		// with the same value.
		await editor.selectBlocks(
			editor.canvas.locator('[data-type="piano-block/piano"]'),
		);
		await switchToJsonMode(editor);
		await expect(songField(editor)).toHaveValue(ROUND_TRIP_SONG);
	});
});
