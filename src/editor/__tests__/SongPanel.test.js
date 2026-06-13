/**
 * Unit tests for the always-present **Song** inspector panel.
 *
 * `SongPanel` is a pure controlled component: it edits a slice of the whole
 * working `song` and emits the next whole song through `onChange`. These tests
 * pin two things at once — the exact emitted shape (optional keys appear only
 * when set; a required sub-object is never half-filled; an emptied key is
 * dropped) AND that every emitted song is accepted by the real `validateSong`,
 * the conformant-by-construction guarantee the panel rests on.
 *
 * The panel is presentational, so the tests render it into jsdom and drive the
 * mocked `@wordpress/components` controls directly — setting an `<input>`/
 * `<select>` value and dispatching a change — all inside `act`. The `ToolsPanel`
 * mock renders its items' contents unconditionally, so the disclosed (advanced)
 * controls are present in the DOM without a reveal step.
 */
import { createElement } from "@wordpress/element";
import { act } from "react";
import { createRoot } from "react-dom/client";
import validateSong from "../../song/validate.js";
import { SongPanel } from "../inspector/SongPanel.js";

// Mark this as a React act-capable environment so React flushes work inside
// `act` synchronously instead of warning.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Render an element into a fresh detached container and return both the
 * container and a `rerender` that re-renders the same root (so the test can feed
 * the just-emitted song back in, mirroring controlled-component usage).
 *
 * @param {Object} element The React element to render.
 * @return {{ container: HTMLElement, rerender: Function }} The render handle.
 */
function render(element) {
	const container = document.createElement("div");
	const root = createRoot(container);
	act(() => {
		root.render(element);
	});
	return {
		container,
		rerender: (next) => {
			act(() => {
				root.render(next);
			});
		},
	};
}

/** Look up an input/select by its accessible name (mapped to `aria-label`). */
function fieldByName(container, name) {
	return container.querySelector(`[aria-label="${name}"]`);
}

/** Find a button by its visible text content. */
function buttonByText(container, text) {
	return Array.from(container.querySelectorAll("button")).find(
		(button) => button.textContent === text,
	);
}

/** Click a node inside `act`. */
function click(node) {
	act(() => {
		node.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
	});
}

/**
 * Set a controlled field's value and dispatch a change event inside `act`. The
 * value is set through the native prototype setter React's tracker observes, so
 * the synthetic `onChange` fires — the standard jsdom recipe for a controlled
 * input.
 */
function change(node, value) {
	const prototype =
		node.tagName === "SELECT"
			? window.HTMLSelectElement.prototype
			: window.HTMLInputElement.prototype;
	const setter = Object.getOwnPropertyDescriptor(prototype, "value").set;
	act(() => {
		setter.call(node, value);
		node.dispatchEvent(new window.Event("input", { bubbles: true }));
		node.dispatchEvent(new window.Event("change", { bubbles: true }));
	});
}

/**
 * Render a `SongPanel` that feeds its own emitted song back in (so it behaves
 * like a controlled control across edits) while recording every emission. The
 * `system` prop follows the emitted song's stored `language` (falling back to
 * the initial system), mirroring `edit.js`'s `working.language ?? infer`
 * resolution so a language switch re-renders the selector with its new value.
 *
 * @param {Object}    [initialSong]  The starting working song.
 * @param {string}    [system]       The initial note-name system.
 * @param {?Function} [onAddSection] The lifted add-section handler, if any.
 * @return {{ container: HTMLElement, calls: Object[] }} The render handle.
 */
function renderPanel(
	initialSong = { sections: [{ measures: [{}] }] },
	system = "english",
	onAddSection,
) {
	const calls = [];
	let song = initialSong;
	let handle;
	const onChange = (next) => {
		song = next;
		calls.push(next);
		handle.rerender(
			createElement(SongPanel, {
				song,
				system: song.language ?? system,
				onChange,
				onAddSection,
			}),
		);
	};
	handle = render(
		createElement(SongPanel, { song, system, onChange, onAddSection }),
	);
	return { container: handle.container, calls };
}

/** Assert the real validator accepts the emitted working song. */
function expectConformant(song) {
	expect(validateSong(JSON.stringify(song))).toEqual([]);
}

describe("SongPanel — metadata", () => {
	it("renders the Title and Composer fields with no selection required", () => {
		const { container } = renderPanel();
		expect(fieldByName(container, "Title")).not.toBeNull();
		expect(fieldByName(container, "Composer")).not.toBeNull();
	});

	it("sets metadata.title on edit and the song validates", () => {
		const { container, calls } = renderPanel();
		change(fieldByName(container, "Title"), "Sonata");
		expect(calls.at(-1).metadata).toEqual({ title: "Sonata" });
		expectConformant(calls.at(-1));
	});

	it("drops the metadata key when the title is cleared", () => {
		const { container, calls } = renderPanel({
			metadata: { title: "Sonata" },
			sections: [{ measures: [{}] }],
		});
		change(fieldByName(container, "Title"), "");
		expect(calls.at(-1).metadata).toBeUndefined();
		expectConformant(calls.at(-1));
	});

	it("drops the title key when the title is whitespace-only", () => {
		const { container, calls } = renderPanel({
			metadata: { title: "Sonata" },
			sections: [{ measures: [{}] }],
		});
		change(fieldByName(container, "Title"), "   ");
		// A whitespace-only title is treated as blank: the key is dropped and the
		// metadata object is gone (no other field set).
		expect(calls.at(-1).metadata).toBeUndefined();
		expectConformant(calls.at(-1));
	});

	it("sets metadata.composer and keeps the title alongside it", () => {
		const { container, calls } = renderPanel({
			metadata: { title: "Sonata" },
			sections: [{ measures: [{}] }],
		});
		change(fieldByName(container, "Composer"), "Clara");
		expect(calls.at(-1).metadata).toEqual({
			title: "Sonata",
			composer: "Clara",
		});
		expectConformant(calls.at(-1));
	});
});

describe("SongPanel — common context fields", () => {
	it("adds defaults.tempo when bpm is set and drops it when bpm is cleared", () => {
		const { container, calls } = renderPanel();

		change(fieldByName(container, "Tempo (BPM)"), "120");
		expect(calls.at(-1).defaults.tempo).toEqual({ bpm: 120 });
		expectConformant(calls.at(-1));

		// Clearing bpm drops the whole tempo key (bpm is required), and with no
		// other defaults set the defaults key is dropped too.
		change(fieldByName(container, "Tempo (BPM)"), "");
		expect(calls.at(-1).defaults).toBeUndefined();
		expectConformant(calls.at(-1));
	});

	it("does not emit a timeSignature until both beats and beatType are set", () => {
		const { container, calls } = renderPanel();

		change(fieldByName(container, "Beats per measure"), "3");
		// beats alone is incomplete: no timeSignature, no defaults key.
		expect(calls.at(-1).defaults).toBeUndefined();
		expectConformant(calls.at(-1));

		change(fieldByName(container, "Beat type"), "4");
		expect(calls.at(-1).defaults.timeSignature).toEqual({
			beats: 3,
			beatType: 4,
		});
		expectConformant(calls.at(-1));
	});
});

describe("SongPanel — advanced disclosure", () => {
	it("hosts the per-hand config controls (present under the test mock)", () => {
		const { container } = renderPanel();
		// The ToolsPanel mock renders its items unconditionally, so the per-hand
		// HandConfigEditor controls are in the DOM without a reveal step.
		expect(fieldByName(container, "Right hand clef")).not.toBeNull();
		expect(fieldByName(container, "Left hand clef")).not.toBeNull();
		expect(fieldByName(container, "Beat unit")).not.toBeNull();
	});

	it("emits a rightHand config into defaults and the song validates", () => {
		const { container, calls } = renderPanel();
		change(fieldByName(container, "Right hand clef"), "bass");
		expect(calls.at(-1).defaults.rightHand).toEqual({ clef: "bass" });
		expectConformant(calls.at(-1));
	});

	it("includes beatUnit in the tempo only when bpm is also present", () => {
		const { container, calls } = renderPanel();
		change(fieldByName(container, "Tempo (BPM)"), "90");
		change(fieldByName(container, "Beat unit"), "quarter");
		expect(calls.at(-1).defaults.tempo).toEqual({
			bpm: 90,
			beatUnit: "quarter",
		});
		expectConformant(calls.at(-1));
	});

	it("drops beatUnit but keeps bpm when the beat unit is cleared", () => {
		const { container, calls } = renderPanel();
		change(fieldByName(container, "Tempo (BPM)"), "90");
		change(fieldByName(container, "Beat unit"), "quarter");

		// Clearing the advanced beatUnit drops only that key — the required bpm
		// stays, so the tempo remains conformant.
		change(fieldByName(container, "Beat unit"), "");
		expect(calls.at(-1).defaults.tempo).toEqual({ bpm: 90 });
		expectConformant(calls.at(-1));
	});
});

describe("SongPanel — note language selector", () => {
	/** A conformant one-note English song the conversion can rewrite end to end. */
	const SINGLE_C = {
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
	};

	it("shows the current system and is a top-level control (not advanced)", () => {
		const { container } = renderPanel(SINGLE_C);
		const select = fieldByName(container, "Note language");
		expect(select).not.toBeNull();
		expect(select.value).toBe("english");

		// The selector is a common Song-level control, not buried in the Advanced
		// ToolsPanel — assert it is not a descendant of that disclosure region
		// (the ToolsPanel mock exposes its label as the region's aria-label).
		const advanced = container.querySelector('[aria-label="Advanced"]');
		expect(advanced).not.toBeNull();
		expect(advanced.contains(select)).toBe(false);
	});

	it("converts every pitch and stores the language on switch to Spanish", () => {
		const { container, calls } = renderPanel(SINGLE_C);
		change(fieldByName(container, "Note language"), "spanish");

		const emitted = calls.at(-1);
		expect(emitted.language).toBe("spanish");
		expect(emitted.sections[0].measures[0].rightHand[0].pitches[0].step).toBe(
			"do",
		);
		expectConformant(emitted);
	});

	it("reverses the conversion when switched back to English", () => {
		const spanishSong = {
			language: "spanish",
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
		};
		const { container, calls } = renderPanel(spanishSong, "spanish");
		expect(fieldByName(container, "Note language").value).toBe("spanish");

		change(fieldByName(container, "Note language"), "english");
		const emitted = calls.at(-1);
		expect(emitted.language).toBe("english");
		expect(emitted.sections[0].measures[0].rightHand[0].pitches[0].step).toBe(
			"C",
		);
		expectConformant(emitted);
	});
});

describe("SongPanel — add section", () => {
	it("calls the lifted onAddSection handler", () => {
		let count = 0;
		const { container, calls } = renderPanel(
			{ sections: [{ measures: [{}] }] },
			"english",
			() => {
				count += 1;
			},
		);
		click(buttonByText(container, "Add section"));
		// The button only signals intent; the lifted handler in `edit.js` owns the
		// splice, so the panel emits nothing through onChange itself.
		expect(count).toBe(1);
		expect(calls).toHaveLength(0);
	});
});
