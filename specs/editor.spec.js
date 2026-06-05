/**
 * Editor end-to-end tests for the Piano block (AC1, AC2, AC4, AC6).
 *
 * These tests drive the real built block in the editor via wp-env and verify
 * its authoring + persistence behavior (design §6.1, §6.3): a freshly inserted
 * block is empty (AC2), conformant input shows no error and is stored verbatim
 * (AC4), non-conformant input is flagged by a visible error notice yet is STILL
 * stored unchanged (AC6 — persistence is unconditional), and a stored song
 * round-trips faithfully across save/reload including HTML-significant
 * characters (AC1).
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
// TextareaControl on the block canvas by its accessible label.
const SONG_FIELD_LABEL = "Song (JSON)";

// A small conformant song used by AC4 — exercises the required `sections` shape
// with one note so the stored value is non-trivial yet passes validation.
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

// A conformant song used by AC1 — its note's `text` deliberately carries
// HTML-significant characters (a double quote, `<`, `>`, and `&`) so the
// save→reload round-trip exercises the block-delimiter-comment escaping
// (design §6.1). A note's `text` is free text, so this stays conformant.
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

// AC6 case (i): not parseable as JSON at all — a parse failure IS a conformance
// error (design §6.2 / AC6).
const INVALID_JSON = "{ not json";

// AC6 case (ii): valid JSON but non-conformant — `quaver` is not in the closed
// duration enum (design §5), so the validator flags it.
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
 * The block's non-blocking validation error region: a `Notice` with
 * `status="error"` rendered beneath the textarea (src/edit.js). The editor
 * shows unrelated notices, so this is scoped to the error-status notice on the
 * block canvas rather than a blanket negative on all notices.
 */
function errorNotice(editor) {
	return editor.canvas.locator(".components-notice.is-error");
}

test.describe("Piano block — editor persistence and validation", () => {
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

	test("AC2 — a freshly inserted block starts empty", async ({ editor }) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// The raw-JSON field renders blank…
		await expect(songField(editor)).toHaveValue("");

		// …and no song content is stored: the attribute is the empty default.
		const blocks = await editor.getBlocks();
		expect(blocks).toHaveLength(1);
		expect(blocks[0].name).toBe("piano-block/piano");
		expect(blocks[0].attributes.song).toBe("");

		// An empty field shows no error notice (design §6.3 states / AC2).
		await expect(errorNotice(editor)).toHaveCount(0);
	});

	test("AC4 — a conformant song shows no error and is stored", async ({
		editor,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		const field = songField(editor);
		await field.fill(CONFORMANT_SONG);
		// Blur so the controlled value settles before reading attributes.
		await field.blur();

		// No error notice is shown for conformant input (AC4).
		await expect(errorNotice(editor)).toHaveCount(0);

		// The typed text is stored verbatim in the `song` attribute.
		const blocks = await editor.getBlocks();
		expect(blocks[0].attributes.song).toBe(CONFORMANT_SONG);
	});

	test("AC6 — invalid JSON is flagged yet still stored", async ({ editor }) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		const field = songField(editor);
		await field.fill(INVALID_JSON);
		await field.blur();

		// A visible error notice appears: a parse failure is a conformance error.
		const notice = errorNotice(editor);
		await expect(notice).toBeVisible();
		await expect(notice).toContainText("JSON");

		// …and the exact non-conformant text is STILL stored — persistence is
		// unconditional (design §6.3, AC6).
		const blocks = await editor.getBlocks();
		expect(blocks[0].attributes.song).toBe(INVALID_JSON);
	});

	test("AC6 — non-conformant JSON is flagged yet still stored", async ({
		editor,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		const field = songField(editor);
		await field.fill(NON_CONFORMANT_JSON);
		await field.blur();

		// A visible error notice appears, pointing at the offending `duration`.
		const notice = errorNotice(editor);
		await expect(notice).toBeVisible();
		await expect(notice).toContainText("duration");

		// …and the exact non-conformant text is STILL stored (design §6.3, AC6).
		const blocks = await editor.getBlocks();
		expect(blocks[0].attributes.song).toBe(NON_CONFORMANT_JSON);
	});

	test("AC1 — a stored song round-trips across save and reload", async ({
		admin,
		editor,
		page,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

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
		// entered — including the HTML-significant characters (AC1, design §6.1).
		const blocks = await editor.getBlocks();
		expect(blocks).toHaveLength(1);
		expect(blocks[0].name).toBe("piano-block/piano");
		expect(blocks[0].attributes.song).toBe(ROUND_TRIP_SONG);

		// The textarea is repopulated with the same value after reload.
		await expect(songField(editor)).toHaveValue(ROUND_TRIP_SONG);
	});
});
