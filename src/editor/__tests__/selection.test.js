/**
 * Unit tests for the editor's pure selection-coordinate helpers.
 *
 * `selection.js` is the bridge between the canvas's emitted `data-*` hooks and an
 * editor-only `{ sectionIndex, measureIndex, hand, eventIndex }` selection. The
 * load-bearing contract is that `measureCoords` flattens
 * `song.sections[].measures[]` in the SAME order the notation core numbers
 * measures in — so a `data-measure="N"` group maps to `measureCoords(song)[N - 1]`.
 * Rather than re-state the core's walk by hand, the invariant test renders the
 * real core (`buildLayoutModel` → `renderSvg`), reads the emitted `data-measure`
 * order off the SVG, and asserts the helper agrees position-for-position; if the
 * core's measure walk ever changes, this test fails until the helper is updated to
 * match. The remaining tests pin `globalMeasureNumber` as the exact inverse,
 * `resolveSelection`'s stale-selection handling, and the scoped query string.
 *
 * These are pure-data assertions; only the invariant test touches the DOM (via the
 * core's `renderSvg`, which mounts into jsdom exactly as the svg-core tests do).
 */
import { buildLayoutModel } from "../../notation/layout.js";
import { renderSvg } from "../../notation/svg.js";
import {
	ancestorKeys,
	eventKey,
	expansionKey,
	expansionKeyOf,
	globalMeasureNumber,
	resolveSelection,
	selectionQuery,
} from "../selection.js";

/**
 * A multi-section song: section 0 has two measures, section 1 has one. The global
 * measure walk (sections outer, measures inner) numbers these 1, 2, 3 — so the
 * expected flatten is `[{0,0}, {0,1}, {1,0}]`.
 */
const SONG = {
	sections: [
		{
			measures: [
				{
					rightHand: [
						{
							type: "note",
							duration: "quarter",
							pitches: [{ step: "C", octave: 5 }],
						},
						{ type: "rest", duration: "quarter" },
					],
					leftHand: [
						{
							type: "note",
							duration: "whole",
							pitches: [{ step: "C", octave: 3 }],
						},
					],
				},
				{
					rightHand: [
						{
							type: "note",
							duration: "half",
							pitches: [{ step: "E", octave: 5 }],
						},
					],
				},
			],
		},
		{
			measures: [
				{
					rightHand: [
						{
							type: "note",
							duration: "quarter",
							pitches: [{ step: "G", octave: 4 }],
						},
					],
				},
			],
		},
	],
};

describe("globalMeasureNumber", () => {
	it("is the exact 1-based inverse of the flatten on the same fixture", () => {
		// SONG has: section 0 → measure 0 (global 1), section 0 → measure 1 (global 2),
		// section 1 → measure 0 (global 3).
		const coords = [
			{ sectionIndex: 0, measureIndex: 0 },
			{ sectionIndex: 0, measureIndex: 1 },
			{ sectionIndex: 1, measureIndex: 0 },
		];
		coords.forEach((coord, position) => {
			expect(
				globalMeasureNumber(SONG, coord.sectionIndex, coord.measureIndex),
			).toBe(position + 1);
		});
	});

	it("returns null for coords out of range", () => {
		expect(globalMeasureNumber(SONG, 9, 0)).toBeNull();
		expect(globalMeasureNumber(SONG, 0, 9)).toBeNull();
		expect(globalMeasureNumber(undefined, 0, 0)).toBeNull();
	});
});

describe("resolveSelection", () => {
	it("resolves a live selection to its event/measure/section + coords", () => {
		const resolved = resolveSelection(SONG, {
			kind: "event",
			sectionIndex: 0,
			measureIndex: 0,
			hand: "rightHand",
			eventIndex: 1,
		});
		expect(resolved).not.toBeNull();
		expect(resolved.event).toBe(SONG.sections[0].measures[0].rightHand[1]);
		expect(resolved.measure).toBe(SONG.sections[0].measures[0]);
		expect(resolved.section).toBe(SONG.sections[0]);
		expect(resolved.sectionIndex).toBe(0);
		expect(resolved.measureIndex).toBe(0);
		expect(resolved.hand).toBe("rightHand");
		expect(resolved.eventIndex).toBe(1);
	});

	it("resolves a left-hand selection in a later section", () => {
		const resolved = resolveSelection(SONG, {
			kind: "event",
			sectionIndex: 1,
			measureIndex: 0,
			hand: "rightHand",
			eventIndex: 0,
		});
		expect(resolved.event).toBe(SONG.sections[1].measures[0].rightHand[0]);
	});

	it("returns null when the section is out of range", () => {
		expect(
			resolveSelection(SONG, {
				sectionIndex: 5,
				measureIndex: 0,
				hand: "rightHand",
				eventIndex: 0,
			}),
		).toBeNull();
	});

	it("returns null when the measure is out of range", () => {
		expect(
			resolveSelection(SONG, {
				sectionIndex: 0,
				measureIndex: 5,
				hand: "rightHand",
				eventIndex: 0,
			}),
		).toBeNull();
	});

	it("returns null when the hand is absent on the measure", () => {
		// Section 0 measure 1 has no leftHand.
		expect(
			resolveSelection(SONG, {
				sectionIndex: 0,
				measureIndex: 1,
				hand: "leftHand",
				eventIndex: 0,
			}),
		).toBeNull();
	});

	it("returns null when the event index is out of range", () => {
		expect(
			resolveSelection(SONG, {
				sectionIndex: 0,
				measureIndex: 0,
				hand: "rightHand",
				eventIndex: 9,
			}),
		).toBeNull();
	});

	it("returns null for a null/empty/untagged-partial selection", () => {
		expect(resolveSelection(SONG, null)).toBeNull();
		expect(resolveSelection(SONG, undefined)).toBeNull();
		expect(resolveSelection(SONG, {})).toBeNull();
		// An untagged partial (no `kind`, missing hand/eventIndex) is malformed.
		expect(
			resolveSelection(SONG, { sectionIndex: 0, measureIndex: 0 }),
		).toBeNull();
	});

	it("returns null when the song itself is missing", () => {
		expect(
			resolveSelection(undefined, {
				sectionIndex: 0,
				measureIndex: 0,
				hand: "rightHand",
				eventIndex: 0,
			}),
		).toBeNull();
	});
});

describe("resolveSelection — kind-tagged", () => {
	it("resolves a section-kind selection to its section, stopping at section depth", () => {
		const resolved = resolveSelection(SONG, {
			kind: "section",
			sectionIndex: 1,
		});
		expect(resolved.kind).toBe("section");
		expect(resolved.section).toBe(SONG.sections[1]);
		expect(resolved.sectionIndex).toBe(1);
		// No measure/event resolution at section depth.
		expect(resolved.measure).toBeUndefined();
		expect(resolved.event).toBeUndefined();
	});

	it("returns null for a section-kind selection whose section is gone", () => {
		expect(
			resolveSelection(SONG, { kind: "section", sectionIndex: 5 }),
		).toBeNull();
	});

	it("resolves a measure-kind selection to its measure + section, stopping at measure depth", () => {
		const resolved = resolveSelection(SONG, {
			kind: "measure",
			sectionIndex: 0,
			measureIndex: 1,
		});
		expect(resolved.kind).toBe("measure");
		expect(resolved.section).toBe(SONG.sections[0]);
		expect(resolved.measure).toBe(SONG.sections[0].measures[1]);
		expect(resolved.sectionIndex).toBe(0);
		expect(resolved.measureIndex).toBe(1);
		// No event resolution at measure depth.
		expect(resolved.event).toBeUndefined();
	});

	it("returns null for a measure-kind selection when section or measure is gone", () => {
		expect(
			resolveSelection(SONG, {
				kind: "measure",
				sectionIndex: 5,
				measureIndex: 0,
			}),
		).toBeNull();
		expect(
			resolveSelection(SONG, {
				kind: "measure",
				sectionIndex: 0,
				measureIndex: 9,
			}),
		).toBeNull();
	});

	it("resolves an event-kind selection to event + measure + section", () => {
		const resolved = resolveSelection(SONG, {
			kind: "event",
			sectionIndex: 0,
			measureIndex: 0,
			hand: "rightHand",
			eventIndex: 1,
		});
		expect(resolved.kind).toBe("event");
		expect(resolved.event).toBe(SONG.sections[0].measures[0].rightHand[1]);
		expect(resolved.measure).toBe(SONG.sections[0].measures[0]);
		expect(resolved.section).toBe(SONG.sections[0]);
		expect(resolved.hand).toBe("rightHand");
		expect(resolved.eventIndex).toBe(1);
	});

	it("returns null for an event-kind selection whose event is gone", () => {
		expect(
			resolveSelection(SONG, {
				kind: "event",
				sectionIndex: 0,
				measureIndex: 0,
				hand: "rightHand",
				eventIndex: 9,
			}),
		).toBeNull();
	});
});

describe("expansionKey contract — ancestorKeys, eventKey, expansionKeyOf", () => {
	it("ancestorKeys returns the three-key reveal array in top-down order", () => {
		expect(
			ancestorKeys({ sectionIndex: 0, measureIndex: 1, hand: "rightHand" }),
		).toEqual(["s0", "s0m1", "s0m1rightHand"]);
	});

	it("ancestorKeys key shapes match expansionKey called individually", () => {
		const { sectionIndex, measureIndex, hand } = {
			sectionIndex: 0,
			measureIndex: 1,
			hand: "rightHand",
		};
		expect(ancestorKeys({ sectionIndex, measureIndex, hand })).toEqual([
			expansionKey({ sectionIndex }),
			expansionKey({ sectionIndex, measureIndex }),
			expansionKey({ sectionIndex, measureIndex, hand }),
		]);
	});

	it("eventKey produces the leaf-row React key", () => {
		expect(
			eventKey({
				sectionIndex: 0,
				measureIndex: 1,
				hand: "rightHand",
				eventIndex: 0,
			}),
		).toBe("s0m1rightHande0");
	});

	it("expansionKeyOf reads the data-expansion-key attribute from a DOM element", () => {
		const row = document.createElement("tr");
		row.setAttribute("data-expansion-key", "s0m1rightHand");
		expect(expansionKeyOf(row)).toBe("s0m1rightHand");
	});

	it("expansionKeyOf returns null when the attribute is absent", () => {
		const row = document.createElement("tr");
		expect(expansionKeyOf(row)).toBeNull();
	});

	it("expansionKeyOf returns null for null/undefined", () => {
		expect(expansionKeyOf(null)).toBeNull();
		expect(expansionKeyOf(undefined)).toBeNull();
	});
});

describe("selectionQuery", () => {
	it("builds a measure-scoped compound selector for the note/rest node", () => {
		expect(
			selectionQuery({
				measureNumber: 3,
				hand: "leftHand",
				eventIndex: 2,
			}),
		).toBe('[data-measure="3"] [data-hand="leftHand"][data-event-index="2"]');
	});

	it("scopes the highlight so a per-measure-resetting event index stays unambiguous", () => {
		// eventIndex 0 exists in many measures; scoping by the global measure number
		// first is what makes the query resolve to exactly one node.
		const query = selectionQuery({
			measureNumber: 1,
			hand: "rightHand",
			eventIndex: 0,
		});
		const svg = renderSvg(buildLayoutModel(SONG, 600));
		const matches = svg.querySelectorAll(query);
		expect(matches).toHaveLength(1);
		expect(matches[0].getAttribute("data-kind")).toBe("note");
		expect(matches[0].getAttribute("data-hand")).toBe("rightHand");
		expect(matches[0].getAttribute("data-event-index")).toBe("0");
	});
});
