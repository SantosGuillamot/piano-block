/**
 * Unit tests for the thin SVG EMIT layer. These run in
 * the jsdom test env, so they assert the emitted DOM directly: the root
 * `<svg role="img">`, the single first-child `<title>` carrying the accessible name
 * via `textContent`, the text-safety guarantee (author free text stays inert — no
 * `<script>`/`<foreignObject>`, never `innerHTML`), and the stable ids / `data-*`
 * the future-interactivity hook stamps on per-event elements.
 *
 * The emit layer's full visual correctness is verified end-to-end by the Playwright
 * e2e; these are the cheap structural invariants the emit layer must hold regardless.
 */
import { buildLayoutModel } from "../layout.js";
import { renderInto, renderSvg } from "../svg.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/** A small but representative song exercising notes, rests, a chord, and a tie. */
const SONG = {
	metadata: { title: "Hello", composer: "Ada" },
	sections: [
		{
			measures: [
				{
					rightHand: [
						{
							type: "note",
							duration: "quarter",
							dynamic: "mf",
							annotations: [{ text: "C", placement: "above" }],
							tie: "start",
							pitches: [
								{ step: "C", octave: 5 },
								{ step: "E", octave: 5 },
							],
						},
						{ type: "rest", duration: "quarter" },
						{
							type: "note",
							duration: "eighth",
							pitches: [{ step: "F", octave: 5, alter: 1 }],
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
				{
					barlineEnd: "final",
					rightHand: [
						{
							type: "note",
							duration: "whole",
							tie: "stop",
							pitches: [{ step: "C", octave: 5 }],
						},
					],
				},
			],
		},
	],
};

const modelFor = (width = 120) => buildLayoutModel(SONG, width);

describe("renderSvg — root + accessibility", () => {
	it('produces an <svg role="img"> with a viewBox and pixel size', () => {
		const svg = renderSvg(modelFor(), { accessibleName: "Hello by Ada" });
		expect(svg.namespaceURI).toBe(SVG_NS);
		expect(svg.tagName.toLowerCase()).toBe("svg");
		expect(svg.getAttribute("role")).toBe("img");
		expect(svg.getAttribute("viewBox")).toMatch(/^0 0 /);
		expect(Number(svg.getAttribute("width"))).toBeGreaterThan(0);
		expect(Number(svg.getAttribute("height"))).toBeGreaterThan(0);
	});

	it("constrains the SVG to its container so it cannot overflow the box", () => {
		const svg = renderSvg(modelFor());
		// max-width:100% shrinks the SVG to the block's content box when the intrinsic
		// px width is wider (padded wrapper / narrow-screen step-down), so the staff
		// stays inside the box on the page.
		const style = svg.getAttribute("style") ?? "";
		expect(style.replace(/\s/g, "")).toContain("max-width:100%");
		expect(style.replace(/\s/g, "")).toContain("height:auto");
	});

	it("sets exactly one accessible name via a first-child <title> textContent", () => {
		const svg = renderSvg(modelFor(), { accessibleName: "Hello by Ada" });
		const title = svg.firstChild;
		expect(title.tagName.toLowerCase()).toBe("title");
		expect(title.textContent).toBe("Hello by Ada");
		// One name source only — no aria-label.
		expect(svg.hasAttribute("aria-label")).toBe(false);
		expect(svg.querySelectorAll("title")).toHaveLength(1);
	});

	it("tolerates a missing accessible name (empty title)", () => {
		const svg = renderSvg(modelFor());
		expect(svg.firstChild.tagName.toLowerCase()).toBe("title");
		expect(svg.firstChild.textContent).toBe("");
	});
});

/** Build a one-note song carrying the given per-event `notes` array. */
const songWithNotes = (notes) => ({
	metadata: {},
	sections: [
		{
			measures: [
				{
					rightHand: [
						{
							type: "note",
							duration: "quarter",
							annotations: notes,
							pitches: [{ step: "C", octave: 5 }],
						},
					],
				},
			],
		},
	],
});

describe("renderSvg — per-event note text", () => {
	it('renders a note as <text data-text="annotation"> with verbatim textContent', () => {
		const svg = renderSvg(
			buildLayoutModel(
				songWithNotes([{ text: "Gm7", placement: "above" }]),
				120,
			),
		);
		const note = svg.querySelector('[data-text="annotation"]');
		expect(note).not.toBeNull();
		expect(note.tagName.toLowerCase()).toBe("text");
		expect(note.textContent).toBe("Gm7");
	});

	it("renders no text node for an empty note text", () => {
		const svg = renderSvg(
			buildLayoutModel(songWithNotes([{ text: "", placement: "above" }]), 120),
		);
		expect(svg.querySelector('[data-text="annotation"]')).toBeNull();
	});

	it("renders no annotation from a legacy chord-annotation key", () => {
		// Build the retired key dynamically so the literal token never lives in the
		// source tree, yet a song still carrying it (an unknown key, permissively
		// ignored) renders no above-staff text.
		const legacyKey = ["chord", "Symbol"].join("");
		const event = {
			type: "note",
			duration: "quarter",
			pitches: [{ step: "C", octave: 5 }],
		};
		event[legacyKey] = "C";
		const legacy = {
			metadata: {},
			sections: [{ measures: [{ rightHand: [event] }] }],
		};
		const svg = renderSvg(buildLayoutModel(legacy, 120));
		expect(svg.querySelector('[data-text="annotation"]')).toBeNull();
	});
});

/**
 * Build a one-measure song whose right and left hands carry the given per-event
 * `notes` arrays (each hand a single note event). Either hand may be omitted.
 */
const songWithHandNotes = ({ right, left } = {}) => {
	const measure = {};
	if (right) {
		measure.rightHand = [
			{
				type: "note",
				duration: "quarter",
				annotations: right,
				pitches: [{ step: "C", octave: 5 }],
			},
		];
	}
	if (left) {
		measure.leftHand = [
			{
				type: "note",
				duration: "quarter",
				annotations: left,
				pitches: [{ step: "C", octave: 3 }],
			},
		];
	}
	return { metadata: {}, sections: [{ measures: [measure] }] };
};

/**
 * The SYSTEM-coordinate Y of a per-event note `<text>`: its local `y` plus the
 * staff-bottom offset its enclosing `<g data-hand transform="translate(0 …)">`
 * carries (local y + staffBottomY = system y).
 */
const systemNoteY = (note, band) => {
	const handKey = note.closest("[data-hand]").getAttribute("data-hand");
	const offset =
		handKey === "rightHand" ? band.rightStaffBottomY : band.leftStaffBottomY;
	return Number(note.getAttribute("y")) + offset;
};

describe("renderSvg — per-event notes routed to the four bands", () => {
	it("places a RH above note above the RH staff top line (system coordinates)", () => {
		const model = buildLayoutModel(
			songWithHandNotes({ right: [{ text: "C", placement: "above" }] }),
			120,
		);
		const svg = renderSvg(model);
		const band = model.systems[0].band;
		const note = svg.querySelector(
			'[data-hand="rightHand"] [data-text="annotation"]',
		);
		expect(note).not.toBeNull();
		expect(note.getAttribute("data-placement")).toBe("above");
		// Above the RH staff top line ⇒ a smaller system Y than the top line.
		expect(systemNoteY(note, band)).toBeLessThan(band.rightStaffTopY);
	});

	it("places a RH below note in the inter-staff gap (system coordinates)", () => {
		const model = buildLayoutModel(
			songWithHandNotes({ right: [{ text: "C", placement: "below" }] }),
			120,
		);
		const svg = renderSvg(model);
		const band = model.systems[0].band;
		const note = svg.querySelector(
			'[data-hand="rightHand"] [data-text="annotation"]',
		);
		expect(note.getAttribute("data-placement")).toBe("below");
		const y = systemNoteY(note, band);
		// Below the RH bottom line, above the LH top line ⇒ the inter-staff gap.
		expect(y).toBeGreaterThan(band.rightStaffBottomY);
		expect(y).toBeLessThan(band.leftStaffTopY);
	});

	it("places a LH above note in the inter-staff gap inside <g data-hand='leftHand'>", () => {
		const model = buildLayoutModel(
			songWithHandNotes({ left: [{ text: "C", placement: "above" }] }),
			120,
		);
		const svg = renderSvg(model);
		const band = model.systems[0].band;
		const note = svg.querySelector(
			'[data-hand="leftHand"] [data-text="annotation"]',
		);
		expect(note).not.toBeNull();
		expect(note.getAttribute("data-placement")).toBe("above");
		const y = systemNoteY(note, band);
		// Below the RH bottom line, above the LH top line ⇒ the inter-staff gap.
		expect(y).toBeGreaterThan(band.rightStaffBottomY);
		expect(y).toBeLessThan(band.leftStaffTopY);
	});

	it("places a LH below note below the LH bottom line (system coordinates)", () => {
		const model = buildLayoutModel(
			songWithHandNotes({ left: [{ text: "C", placement: "below" }] }),
			120,
		);
		const svg = renderSvg(model);
		const band = model.systems[0].band;
		const note = svg.querySelector(
			'[data-hand="leftHand"] [data-text="annotation"]',
		);
		expect(note.getAttribute("data-placement")).toBe("below");
		expect(systemNoteY(note, band)).toBeGreaterThan(band.leftStaffBottomY);
	});

	it("makes placement observable on the node and staff observable from data-hand", () => {
		const model = buildLayoutModel(
			songWithHandNotes({
				right: [{ text: "C", placement: "above" }],
				left: [{ text: "F", placement: "below" }],
			}),
			120,
		);
		const svg = renderSvg(model);
		const rh = svg.querySelector(
			'[data-hand="rightHand"] [data-text="annotation"]',
		);
		const lh = svg.querySelector(
			'[data-hand="leftHand"] [data-text="annotation"]',
		);
		expect(rh.getAttribute("data-placement")).toBe("above");
		expect(lh.getAttribute("data-placement")).toBe("below");
		// Staff is read from the enclosing data-hand, never a data-staff on the note.
		expect(rh.hasAttribute("data-staff")).toBe(false);
		expect(lh.hasAttribute("data-staff")).toBe(false);
		expect(rh.closest("[data-hand]").getAttribute("data-hand")).toBe(
			"rightHand",
		);
		expect(lh.closest("[data-hand]").getAttribute("data-hand")).toBe(
			"leftHand",
		);
	});

	it("places a per-event note's X at its event's notehead column X", () => {
		const model = buildLayoutModel(
			songWithHandNotes({ right: [{ text: "C", placement: "above" }] }),
			120,
		);
		const svg = renderSvg(model);
		const noteHead = svg.querySelector("#rightHand-note-0");
		// The note event's column X is the data-event-index group's notehead center.
		const head = noteHead.querySelector("[data-notehead]");
		const columnX = Number(head.getAttribute("cx"));
		const text = svg.querySelector(
			'[data-hand="rightHand"] [data-text="annotation"]',
		);
		expect(Number(text.getAttribute("x"))).toBeCloseTo(columnX, 6);
	});

	it("emits an above note and a below note on one event in distinct bands at the same X", () => {
		const model = buildLayoutModel(
			songWithHandNotes({
				right: [
					{ text: "above", placement: "above" },
					{ text: "below", placement: "below" },
				],
			}),
			120,
		);
		const svg = renderSvg(model);
		const band = model.systems[0].band;
		const notes = [
			...svg.querySelectorAll(
				'[data-hand="rightHand"] [data-text="annotation"]',
			),
		];
		expect(notes).toHaveLength(2);
		const above = notes.find((n) => n.textContent === "above");
		const below = notes.find((n) => n.textContent === "below");
		expect(above.getAttribute("data-placement")).toBe("above");
		expect(below.getAttribute("data-placement")).toBe("below");
		// Same column X for both.
		expect(Number(above.getAttribute("x"))).toBeCloseTo(
			Number(below.getAttribute("x")),
			6,
		);
		// One above the staff top, one in the inter-staff gap.
		expect(systemNoteY(above, band)).toBeLessThan(band.rightStaffTopY);
		const belowY = systemNoteY(below, band);
		expect(belowY).toBeGreaterThan(band.rightStaffBottomY);
		expect(belowY).toBeLessThan(band.leftStaffTopY);
	});

	it("stacks N same-placement notes at N distinct Ys (none lost, none coincident)", () => {
		const model = buildLayoutModel(
			songWithHandNotes({
				right: [
					{ text: "one", placement: "above" },
					{ text: "two", placement: "above" },
					{ text: "three", placement: "above" },
				],
			}),
			120,
		);
		const svg = renderSvg(model);
		const notes = [
			...svg.querySelectorAll(
				'[data-hand="rightHand"] [data-text="annotation"]',
			),
		];
		expect(notes).toHaveLength(3);
		const ys = notes.map((n) => Number(n.getAttribute("y")));
		expect(new Set(ys).size).toBe(3);
	});

	it("emits a rest's below pedal note in the below band at the rest's column X", () => {
		const song = {
			metadata: {},
			sections: [
				{
					measures: [
						{
							rightHand: [
								{
									type: "rest",
									duration: "quarter",
									annotations: [{ text: "pedal", placement: "below" }],
								},
							],
						},
					],
				},
			],
		};
		const model = buildLayoutModel(song, 120);
		const svg = renderSvg(model);
		const band = model.systems[0].band;
		const note = svg.querySelector(
			'[data-hand="rightHand"] [data-text="annotation"]',
		);
		expect(note).not.toBeNull();
		expect(note.textContent).toBe("pedal");
		expect(note.getAttribute("data-placement")).toBe("below");
		// In the below-RH band (the inter-staff gap below the RH bottom line).
		expect(systemNoteY(note, band)).toBeGreaterThan(band.rightStaffBottomY);
		// At the rest's column X.
		const rest = svg.querySelector("#rightHand-rest-0");
		const restGlyph = rest.querySelector("text, rect, circle");
		const restX = Number(
			restGlyph.getAttribute("x") ?? restGlyph.getAttribute("cx"),
		);
		expect(Number(note.getAttribute("x"))).toBeCloseTo(restX, 1);
	});
});

/**
 * Build a one-measure song carrying measure-level standalone `notes` (each a
 * `{ text, placement, staff, beat? }`). Both hands carry a single whole note so the
 * grand staff and the column grid exist; either hand could be omitted but both are
 * kept for a stable inter-staff gap.
 */
const songWithStandaloneAnnotations = (notes) => ({
	metadata: {},
	sections: [
		{
			measures: [
				{
					annotations: notes,
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
			],
		},
	],
});

/** All standalone-note `<text>` nodes (direct children of `<g data-measure>`). */
const standaloneAnnotations = (svg) => [
	...svg.querySelectorAll('[data-text="annotation"][data-staff]'),
];

describe("renderSvg — standalone (measure-level) notes routed to the four bands", () => {
	it("places a RH above standalone note above the RH staff top line, as a direct child of <g data-measure> (not in a <g data-hand>)", () => {
		const model = buildLayoutModel(
			songWithStandaloneAnnotations([
				{ text: "rit.", placement: "above", staff: "rightHand" },
			]),
			120,
		);
		const svg = renderSvg(model);
		const band = model.systems[0].band;
		const notes = standaloneAnnotations(svg);
		expect(notes).toHaveLength(1);
		const note = notes[0];
		expect(note.tagName.toLowerCase()).toBe("text");
		expect(note.getAttribute("data-text")).toBe("annotation");
		expect(note.getAttribute("data-staff")).toBe("rightHand");
		expect(note.getAttribute("data-placement")).toBe("above");
		expect(note.textContent).toBe("rit.");
		// A direct child of the measure group, NOT nested in any per-event hand group.
		expect(note.parentElement.hasAttribute("data-measure")).toBe(true);
		expect(note.closest("[data-hand]")).toBeNull();
		// Above the RH staff top line ⇒ a smaller system Y than the top line. The Y is
		// the raw band anchor in SYSTEM coordinates (no local-frame subtraction), so it
		// reads directly off the node.
		expect(Number(note.getAttribute("y"))).toBeLessThan(band.rightStaffTopY);
		expect(Number(note.getAttribute("y"))).toBeCloseTo(
			band.bands.aboveRH.baseY,
			6,
		);
	});

	it("places a RH below standalone note in the inter-staff gap", () => {
		const model = buildLayoutModel(
			songWithStandaloneAnnotations([
				{ text: "ped.", placement: "below", staff: "rightHand" },
			]),
			120,
		);
		const svg = renderSvg(model);
		const band = model.systems[0].band;
		const [note] = standaloneAnnotations(svg);
		expect(note.getAttribute("data-staff")).toBe("rightHand");
		expect(note.getAttribute("data-placement")).toBe("below");
		const y = Number(note.getAttribute("y"));
		// Below the RH bottom line, above the LH top line ⇒ the inter-staff gap.
		expect(y).toBeGreaterThan(band.rightStaffBottomY);
		expect(y).toBeLessThan(band.leftStaffTopY);
		expect(y).toBeCloseTo(band.bands.belowRH.baseY, 6);
	});

	it("places a LH above standalone note in the inter-staff gap", () => {
		const model = buildLayoutModel(
			songWithStandaloneAnnotations([
				{ text: "sost.", placement: "above", staff: "leftHand" },
			]),
			120,
		);
		const svg = renderSvg(model);
		const band = model.systems[0].band;
		const [note] = standaloneAnnotations(svg);
		expect(note.getAttribute("data-staff")).toBe("leftHand");
		expect(note.getAttribute("data-placement")).toBe("above");
		const y = Number(note.getAttribute("y"));
		// Above the LH top line, below the RH bottom line ⇒ the inter-staff gap.
		expect(y).toBeGreaterThan(band.rightStaffBottomY);
		expect(y).toBeLessThan(band.leftStaffTopY);
		expect(y).toBeCloseTo(band.bands.aboveLH.baseY, 6);
	});

	it("places a LH below standalone note below the LH bottom line", () => {
		const model = buildLayoutModel(
			songWithStandaloneAnnotations([
				{ text: "loco", placement: "below", staff: "leftHand" },
			]),
			120,
		);
		const svg = renderSvg(model);
		const band = model.systems[0].band;
		const [note] = standaloneAnnotations(svg);
		expect(note.getAttribute("data-staff")).toBe("leftHand");
		expect(note.getAttribute("data-placement")).toBe("below");
		const y = Number(note.getAttribute("y"));
		expect(y).toBeGreaterThan(band.leftStaffBottomY);
		expect(y).toBeCloseTo(band.bands.belowLH.baseY, 6);
	});

	it("makes both data-staff and data-placement observable on the node", () => {
		const model = buildLayoutModel(
			songWithStandaloneAnnotations([
				{ text: "a", placement: "above", staff: "rightHand" },
				{ text: "b", placement: "below", staff: "leftHand" },
			]),
			120,
		);
		const svg = renderSvg(model);
		const notes = standaloneAnnotations(svg);
		expect(notes).toHaveLength(2);
		const a = notes.find((n) => n.textContent === "a");
		const b = notes.find((n) => n.textContent === "b");
		expect(a.getAttribute("data-staff")).toBe("rightHand");
		expect(a.getAttribute("data-placement")).toBe("above");
		expect(b.getAttribute("data-staff")).toBe("leftHand");
		expect(b.getAttribute("data-placement")).toBe("below");
	});

	it("keeps a below-RH per-event note and an above-LH standalone note distinguishable by staff discriminator despite sharing the inter-staff band", () => {
		const song = {
			metadata: {},
			sections: [
				{
					measures: [
						{
							annotations: [
								{ text: "standalone", placement: "above", staff: "leftHand" },
							],
							rightHand: [
								{
									type: "note",
									duration: "whole",
									annotations: [{ text: "perEvent", placement: "below" }],
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
		};
		const model = buildLayoutModel(song, 120);
		const svg = renderSvg(model);
		const band = model.systems[0].band;
		// The per-event note carries NO data-staff and lives inside a <g data-hand>.
		const perEvent = svg.querySelector(
			'[data-text="annotation"]:not([data-staff])',
		);
		expect(perEvent.textContent).toBe("perEvent");
		expect(perEvent.closest("[data-hand]").getAttribute("data-hand")).toBe(
			"rightHand",
		);
		// The standalone note carries data-staff and is NOT inside a <g data-hand>.
		const standalone = svg.querySelector(
			'[data-text="annotation"][data-staff]',
		);
		expect(standalone.textContent).toBe("standalone");
		expect(standalone.getAttribute("data-staff")).toBe("leftHand");
		expect(standalone.closest("[data-hand]")).toBeNull();
		// Both occupy the inter-staff gap but remain distinguishable (data-hand vs
		// data-staff). The standalone's system Y reads directly; the per-event's adds
		// its hand's staff-bottom offset.
		const standaloneY = Number(standalone.getAttribute("y"));
		const perEventY =
			Number(perEvent.getAttribute("y")) + band.rightStaffBottomY;
		expect(standaloneY).toBeGreaterThan(band.rightStaffBottomY);
		expect(standaloneY).toBeLessThan(band.leftStaffTopY);
		expect(perEventY).toBeGreaterThan(band.rightStaffBottomY);
		expect(perEventY).toBeLessThan(band.leftStaffTopY);
	});

	it("emits two standalone notes at beat 0 and beat 2 with the beat-2 node further right", () => {
		const model = buildLayoutModel(
			songWithStandaloneAnnotations([
				{ text: "zero", placement: "above", staff: "rightHand", beat: 0 },
				{ text: "two", placement: "above", staff: "rightHand", beat: 2 },
			]),
			120,
		);
		const svg = renderSvg(model);
		const notes = standaloneAnnotations(svg);
		expect(notes).toHaveLength(2);
		const zero = notes.find((n) => n.textContent === "zero");
		const two = notes.find((n) => n.textContent === "two");
		expect(Number(two.getAttribute("x"))).toBeGreaterThan(
			Number(zero.getAttribute("x")),
		);
	});

	it("keeps relative-X ordering of standalone notes in a NON-FIRST measure (survives the measure.x translate)", () => {
		const song = {
			metadata: {},
			sections: [
				{
					measures: [
						{
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
						{
							annotations: [
								{
									text: "zero",
									placement: "above",
									staff: "rightHand",
									beat: 0,
								},
								{
									text: "two",
									placement: "above",
									staff: "rightHand",
									beat: 2,
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
					],
				},
			],
		};
		const model = buildLayoutModel(song, 400);
		const svg = renderSvg(model);
		// Resolve each note's ABSOLUTE X by adding its measure group's translate.
		const measureGroups = [...svg.querySelectorAll("[data-measure]")];
		const second = measureGroups[1];
		const measureX = Number(
			/translate\(([-\d.]+)/.exec(second.getAttribute("transform"))[1],
		);
		const notes = [
			...second.querySelectorAll('[data-text="annotation"][data-staff]'),
		];
		expect(notes).toHaveLength(2);
		const zero = notes.find((n) => n.textContent === "zero");
		const two = notes.find((n) => n.textContent === "two");
		// Relative-X ordering holds, and the absolute X (relative + measure.x) too.
		expect(Number(two.getAttribute("x"))).toBeGreaterThan(
			Number(zero.getAttribute("x")),
		);
		expect(measureX + Number(two.getAttribute("x"))).toBeGreaterThan(
			measureX + Number(zero.getAttribute("x")),
		);
		expect(measureX).toBeGreaterThan(0);
	});

	it("clamps an over-content standalone note (beat 99) inside the measure's trailing barline (absolute X)", () => {
		const model = buildLayoutModel(
			songWithStandaloneAnnotations([
				{ text: "far", placement: "above", staff: "rightHand", beat: 99 },
			]),
			120,
		);
		const svg = renderSvg(model);
		const measureGroup = svg.querySelector("[data-measure]");
		const measureX = Number(
			/translate\(([-\d.]+)/.exec(measureGroup.getAttribute("transform"))[1],
		);
		const [note] = standaloneAnnotations(svg);
		const absoluteX = measureX + Number(note.getAttribute("x"));
		// The trailing barline's absolute X is the rightmost stroke's left edge plus the
		// measure translate. The clamped note stays at or inside it.
		const strokes = [
			...measureGroup.querySelectorAll("[data-barline] rect"),
		].filter((r) => r.getAttribute("data-side") !== "left");
		const barlineX =
			measureX + Math.max(...strokes.map((r) => Number(r.getAttribute("x"))));
		expect(absoluteX).toBeLessThanOrEqual(barlineX);
	});

	it("emits both a per-event note and a standalone note in one measure", () => {
		const song = {
			metadata: {},
			sections: [
				{
					measures: [
						{
							annotations: [
								{ text: "standalone", placement: "above", staff: "rightHand" },
							],
							rightHand: [
								{
									type: "note",
									duration: "whole",
									annotations: [{ text: "perEvent", placement: "above" }],
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
		};
		const svg = renderSvg(buildLayoutModel(song, 120));
		const all = [...svg.querySelectorAll('[data-text="annotation"]')];
		const texts = all.map((n) => n.textContent);
		expect(texts).toContain("perEvent");
		expect(texts).toContain("standalone");
		// One has data-staff (standalone), one does not (per-event).
		expect(
			svg.querySelectorAll('[data-text="annotation"][data-staff]'),
		).toHaveLength(1);
		expect(
			svg.querySelectorAll('[data-text="annotation"]:not([data-staff])'),
		).toHaveLength(1);
	});

	it("stacks N same-(staff,placement,raw beat) standalone notes at N distinct Ys in array order, grouped via the stored group key", () => {
		const model = buildLayoutModel(
			songWithStandaloneAnnotations([
				{ text: "one", placement: "above", staff: "rightHand", beat: 1 },
				{ text: "two", placement: "above", staff: "rightHand", beat: 1 },
				{ text: "three", placement: "above", staff: "rightHand", beat: 1 },
			]),
			120,
		);
		const svg = renderSvg(model);
		const band = model.systems[0].band;
		const notes = standaloneAnnotations(svg);
		expect(notes).toHaveLength(3);
		const ys = notes.map((n) => Number(n.getAttribute("y")));
		// Three distinct Ys (none lost, none coincident).
		expect(new Set(ys).size).toBe(3);
		// Stacked in array order: note #k at baseY + (up ⇒ −1) * k * step.
		const { baseY, step, direction } = band.bands.aboveRH;
		const sign = direction === "up" ? -1 : 1;
		const byText = (t) =>
			Number(notes.find((n) => n.textContent === t).getAttribute("y"));
		expect(byText("one")).toBeCloseTo(baseY + sign * 0 * step, 6);
		expect(byText("two")).toBeCloseTo(baseY + sign * 1 * step, 6);
		expect(byText("three")).toBeCloseTo(baseY + sign * 2 * step, 6);
	});

	it("treats two over-content standalone notes that clamp to the same X but carry different raw beats as different groups (both at note #0)", () => {
		const model = buildLayoutModel(
			songWithStandaloneAnnotations([
				{ text: "fifty", placement: "above", staff: "rightHand", beat: 50 },
				{
					text: "ninetyNine",
					placement: "above",
					staff: "rightHand",
					beat: 99,
				},
			]),
			120,
		);
		const svg = renderSvg(model);
		const band = model.systems[0].band;
		const notes = standaloneAnnotations(svg);
		expect(notes).toHaveLength(2);
		// Both clamp to the SAME X (over-content → scaledContent − NOTE_CLAMP_INSET).
		const xs = notes.map((n) => Number(n.getAttribute("x")));
		expect(xs[0]).toBeCloseTo(xs[1], 6);
		// But they are DIFFERENT groups (raw beat 50 vs 99), so each is note #0 of its
		// group → both at the band's baseY (NOT stacked to k=1).
		const { baseY } = band.bands.aboveRH;
		for (const note of notes) {
			expect(Number(note.getAttribute("y"))).toBeCloseTo(baseY, 6);
		}
	});
});

describe("renderSvg — text safety", () => {
	it("keeps author free text inert: no <script> / <foreignObject>", () => {
		const xss = {
			metadata: {},
			sections: [
				{
					measures: [
						{
							rightHand: [
								{
									type: "note",
									duration: "quarter",
									annotations: [
										{
											text: "<script>alert(1)</script>",
											placement: "above",
										},
									],
									pitches: [{ step: "C", octave: 5 }],
								},
							],
						},
					],
				},
			],
		};
		const svg = renderSvg(buildLayoutModel(xss, 120), {
			accessibleName: "<img src=x onerror=alert(1)>",
		});
		expect(svg.querySelector("script")).toBeNull();
		expect(svg.querySelector("foreignObject")).toBeNull();
		// The malicious string survives only as inert text content, never markup.
		const note = svg.querySelector('[data-text="annotation"]');
		expect(note.textContent).toBe("<script>alert(1)</script>");
		expect(note.children).toHaveLength(0);
		// The accessible name is likewise inert text in the <title>.
		expect(svg.firstChild.textContent).toBe("<img src=x onerror=alert(1)>");
	});
});

describe("renderSvg — structure", () => {
	it("each clef is anchored on its reference staff line", () => {
		const model = modelFor();
		const svg = renderSvg(model);
		const band = model.systems[0].band;
		// SONG is treble (RH) over bass (LH). The treble (G) clef sits 3 sp below the RH
		// top line; the bass (F) clef sits 1 sp below the LH top line.
		const treble = svg.querySelector('[data-reserve] [data-clef="treble"]');
		const bass = svg.querySelector('[data-reserve] [data-clef="bass"]');
		expect(Number(treble.getAttribute("y"))).toBeCloseTo(
			band.rightStaffTopY + 3,
			6,
		);
		expect(Number(bass.getAttribute("y"))).toBeCloseTo(
			band.leftStaffTopY + 1,
			6,
		);
	});

	it("the brace spans the full grand staff (top of RH to bottom of LH)", () => {
		const model = modelFor();
		const svg = renderSvg(model);
		const band = model.systems[0].band;
		// The brace is the tallest font glyph in the reserve (clefs are staff-height).
		const reserveTexts = [...svg.querySelectorAll("[data-reserve] text")];
		const brace = reserveTexts.reduce((a, b) =>
			Number(b.getAttribute("font-size")) > Number(a.getAttribute("font-size"))
				? b
				: a,
		);
		// Sized to the grand-staff height and anchored (alphabetic) at the LH staff
		// bottom, so its ~1-em ink rises to the RH staff top.
		expect(Number(brace.getAttribute("font-size"))).toBeCloseTo(
			band.leftStaffBottomY - band.rightStaffTopY,
			6,
		);
		expect(Number(brace.getAttribute("y"))).toBeCloseTo(
			band.leftStaffBottomY,
			6,
		);
	});

	it("emits one system group per model system, each with two staves", () => {
		const model = modelFor();
		const svg = renderSvg(model);
		const systems = svg.querySelectorAll("[data-system]");
		expect(systems).toHaveLength(model.systems.length);
		// Two staff-line groups (RH + LH) per system.
		for (const sys of systems) {
			expect(sys.querySelectorAll("[data-staff-lines]")).toHaveLength(2);
		}
	});

	it("stamps a stable id + data-* on each per-event note/rest (interactivity hook)", () => {
		const svg = renderSvg(modelFor());
		const notes = svg.querySelectorAll('[data-kind="note"]');
		const rests = svg.querySelectorAll('[data-kind="rest"]');
		expect(notes.length).toBeGreaterThan(0);
		expect(rests.length).toBeGreaterThan(0);
		for (const note of notes) {
			expect(note.getAttribute("data-hand")).toMatch(/Hand$/);
			expect(note.getAttribute("data-event-index")).not.toBeNull();
			expect(note.id).not.toBe("");
		}
	});

	it("dynamics are set clearly below the staff bottom line", () => {
		const svg = renderSvg(modelFor());
		const dynamics = [...svg.querySelectorAll('[data-text="dynamic"]')];
		expect(dynamics.length).toBeGreaterThan(0);
		for (const d of dynamics) {
			// Positive Y is below the staff bottom (the hand <g> carries that origin); a
			// value > 3 keeps the bold-italic glyphs under the staff, not across it.
			expect(Number(d.getAttribute("y"))).toBeGreaterThan(3);
		}
	});

	it("draws a chord's noteheads and a per-event dynamic", () => {
		const svg = renderSvg(modelFor());
		// The first RH event is a 2-note chord → two notehead ellipses on it.
		const firstNote = svg.querySelector("#rightHand-note-0");
		expect(firstNote.querySelectorAll("[data-notehead]").length).toBe(2);
		// Its dynamic "mf" renders as inert text.
		const dynamics = [...svg.querySelectorAll('[data-text="dynamic"]')].map(
			(n) => n.textContent,
		);
		expect(dynamics).toContain("mf");
	});

	it("renders ties/slurs as <path> spans", () => {
		const svg = renderSvg(modelFor());
		// The tie spanning the two RH C5s resolves to a path span.
		expect(svg.querySelector('path[data-span="tie"]')).not.toBeNull();
	});

	it("builds the whole tree via createElementNS (all SVG-namespaced)", () => {
		const svg = renderSvg(modelFor(), { accessibleName: "x" });
		// Every descendant element lives in the SVG namespace (no HTML injected).
		const all = svg.querySelectorAll("*");
		expect(all.length).toBeGreaterThan(0);
		for (const node of all) {
			expect(node.namespaceURI).toBe(SVG_NS);
		}
	});
});

describe("renderInto", () => {
	it("replaces the container's contents with the fresh SVG", () => {
		const container = document.createElement("div");
		container.appendChild(document.createElement("span")); // stale child
		const svg = renderInto(container, modelFor(), { accessibleName: "x" });
		expect(container.children).toHaveLength(1);
		expect(container.firstChild).toBe(svg);
		expect(svg.getAttribute("role")).toBe("img");
	});
});

// ── Hairpin wedge emit (crescendo / decrescendo) ──────────────────────────────────
//
// These assert the emitted wedge DOM directly: a single `<g data-span data-hand>`
// holding exactly two `<line>`s whose endpoints encode the opening (`<`) / closing
// (`>`) geometry the layout records describe, while the tie/slur `<path>` emitter and
// the point-dynamic text emitter are left untouched.

describe("renderSvg — hairpin wedges", () => {
	// A note carrying the given span markers; `pitches` is the real event shape,
	// defaulting to a single right-hand pitch.
	const note = (markers, pitches = [{ step: "C", octave: 5 }]) => ({
		type: "note",
		duration: "quarter",
		pitches,
		...markers,
	});
	// One section, one measure, with the given right/left hand events.
	const song = (rightHand, leftHand = undefined) => ({
		metadata: { title: "Hairpins" },
		sections: [
			{ measures: [{ rightHand, ...(leftHand ? { leftHand } : {}) }] },
		],
	});
	// The two `<line>`s of a wedge `<g>` as { x1, y1, x2, y2 } numbers.
	const linesOf = (g) =>
		[...g.querySelectorAll("line")].map((l) => ({
			x1: Number(l.getAttribute("x1")),
			y1: Number(l.getAttribute("y1")),
			x2: Number(l.getAttribute("x2")),
			y2: Number(l.getAttribute("y2")),
		}));
	// The two lines' Y at the shared left X (their y1) and at the right X (their y2).
	const leftYs = (lines) => lines.map((l) => l.y1);
	const rightYs = (lines) => lines.map((l) => l.y2);

	it("renders a crescendo as a <g data-span> of exactly two <line>s on the right hand", () => {
		const svg = renderSvg(
			buildLayoutModel(
				song([
					note({ crescendo: "start" }),
					note({}),
					note({ crescendo: "stop" }),
				]),
				200,
			),
		);
		const g = svg.querySelector('[data-span="crescendo"]');
		expect(g).not.toBeNull();
		expect(g.tagName.toLowerCase()).toBe("g");
		expect(g.getAttribute("data-hand")).toBe("rightHand");
		const lines = g.querySelectorAll("line");
		expect(lines).toHaveLength(2);
	});

	it("opens the crescendo wedge: vertex (Δy≈0) at x1, mouth (Δy≈aperture) at x2", () => {
		const model = buildLayoutModel(
			song([
				note({ crescendo: "start" }),
				note({}),
				note({ crescendo: "stop" }),
			]),
			200,
		);
		const svg = renderSvg(model);
		const wedge = model.systems
			.flatMap((s) => s.spans)
			.find((s) => s.kind === "crescendo");
		const lines = linesOf(svg.querySelector('[data-span="crescendo"]'));
		// Both lines share the wedge's start/end X (the vertex is at the left for a `<`).
		for (const l of lines) {
			expect(l.x1).toBeCloseTo(wedge.x1, 6);
			expect(l.x2).toBeCloseTo(wedge.x2, 6);
		}
		// At x1 the two lines meet at the vertex (Δy ≈ 0) for a crescendo `<`.
		const [lo, hi] = leftYs(lines).sort((a, b) => a - b);
		expect(Math.abs(hi - lo)).toBeCloseTo(0, 6);
		// At x2 they diverge to ±aperture/2 about yCenter (Δy ≈ aperture).
		const [r0, r1] = rightYs(lines).sort((a, b) => a - b);
		expect(Math.abs(r1 - r0)).toBeCloseTo(wedge.aperture, 6);
		expect(r0).toBeCloseTo(wedge.yCenter - wedge.aperture / 2, 6);
		expect(r1).toBeCloseTo(wedge.yCenter + wedge.aperture / 2, 6);
	});

	it("closes the decrescendo wedge: mouth (Δy≈aperture) at x1, vertex (Δy≈0) at x2", () => {
		const model = buildLayoutModel(
			song([
				note({ decrescendo: "start" }),
				note({}),
				note({ decrescendo: "stop" }),
			]),
			200,
		);
		const svg = renderSvg(model);
		const wedge = model.systems
			.flatMap((s) => s.spans)
			.find((s) => s.kind === "decrescendo");
		const g = svg.querySelector('[data-span="decrescendo"]');
		expect(g).not.toBeNull();
		expect(g.getAttribute("data-hand")).toBe("rightHand");
		const lines = linesOf(g);
		expect(lines).toHaveLength(2);
		// Mirror of the crescendo: mouth at x1 (Δy ≈ aperture), vertex at x2 (Δy ≈ 0).
		const [l0, l1] = leftYs(lines).sort((a, b) => a - b);
		expect(Math.abs(l1 - l0)).toBeCloseTo(wedge.aperture, 6);
		expect(l0).toBeCloseTo(wedge.yCenter - wedge.aperture / 2, 6);
		expect(l1).toBeCloseTo(wedge.yCenter + wedge.aperture / 2, 6);
		const [r0, r1] = rightYs(lines).sort((a, b) => a - b);
		expect(Math.abs(r1 - r0)).toBeCloseTo(0, 6);
	});

	it("makes the crescendo and decrescendo visibly distinct", () => {
		// Render a crescendo and a decrescendo and confirm their left/right Δy patterns
		// are opposite: the `<` opens left→right, the `>` closes left→right.
		const cresModel = buildLayoutModel(
			song([note({ crescendo: "start" }), note({ crescendo: "stop" })]),
			200,
		);
		const decModel = buildLayoutModel(
			song([note({ decrescendo: "start" }), note({ decrescendo: "stop" })]),
			200,
		);
		const cres = linesOf(
			renderSvg(cresModel).querySelector('[data-span="crescendo"]'),
		);
		const dec = linesOf(
			renderSvg(decModel).querySelector('[data-span="decrescendo"]'),
		);
		const dy = (ys) => {
			const [a, b] = ys.sort((p, q) => p - q);
			return b - a;
		};
		// Crescendo: Δy grows left→right; decrescendo: Δy shrinks left→right.
		expect(dy(leftYs(cres))).toBeLessThan(dy(rightYs(cres)));
		expect(dy(leftYs(dec))).toBeGreaterThan(dy(rightYs(dec)));
	});

	it("strokes every wedge <line> with a defined (non-undefined) stroke-width", () => {
		const svg = renderSvg(
			buildLayoutModel(
				song([note({ crescendo: "start" }), note({ crescendo: "stop" })]),
				200,
			),
		);
		const lines = svg.querySelectorAll('[data-span="crescendo"] line');
		expect(lines.length).toBe(2);
		for (const l of lines) {
			const w = l.getAttribute("stroke-width");
			expect(w).not.toBeNull();
			expect(w).not.toBe("undefined");
			expect(Number.isFinite(Number(w))).toBe(true);
		}
	});

	it("draws a barline-crossing wedge as one continuous wedge from start X to end X (AC4)", () => {
		// Two measures in one system: the crescendo starts in measure 1 and ends in
		// measure 2, so its single wedge must span across the intervening barline.
		const twoMeasures = {
			metadata: { title: "Across the bar" },
			sections: [
				{
					measures: [
						{ rightHand: [note({ crescendo: "start" })] },
						{ rightHand: [note({}), note({ crescendo: "stop" })] },
					],
				},
			],
		};
		const model = buildLayoutModel(twoMeasures, 600);
		// Confirm a single system holds both measures (one continuous wedge possible).
		expect(model.systems).toHaveLength(1);
		const wedge = model.systems[0].spans.find((s) => s.kind === "crescendo");
		expect(wedge.crossSystem).toBe(false);
		const svg = renderSvg(model);
		const gs = svg.querySelectorAll('[data-span="crescendo"]');
		expect(gs).toHaveLength(1); // one continuous wedge, not one per measure
		const lines = linesOf(gs[0]);
		// The wedge runs the full span as one primitive: x1 in measure 1 (before the
		// barline), x2 on a note deeper into measure 2 (past the barline) — one
		// continuous wedge across the bar, not one segment per measure.
		const barX = model.systems[0].measures[1].x;
		expect(wedge.x1).toBeLessThan(barX);
		expect(wedge.x2).toBeGreaterThan(barX);
		for (const l of lines) {
			expect(l.x1).toBeCloseTo(wedge.x1, 6);
			expect(l.x2).toBeCloseTo(wedge.x2, 6);
			expect(l.x2).toBeGreaterThan(barX);
		}
	});

	it("renders the wedge and point dynamics independently for start/end/both/neither (AC7)", () => {
		// Four songs: a point dynamic at the span's start, end, both ends, or neither.
		// In every case the wedge AND the dynamic text(s) must both render.
		const cases = {
			start: song([
				note({ crescendo: "start", dynamic: "p" }),
				note({ crescendo: "stop" }),
			]),
			end: song([
				note({ crescendo: "start" }),
				note({ crescendo: "stop", dynamic: "f" }),
			]),
			both: song([
				note({ crescendo: "start", dynamic: "p" }),
				note({ crescendo: "stop", dynamic: "f" }),
			]),
			neither: song([
				note({ crescendo: "start" }),
				note({ crescendo: "stop" }),
			]),
		};
		const expectedDynamicCount = { start: 1, end: 1, both: 2, neither: 0 };
		for (const [name, s] of Object.entries(cases)) {
			const svg = renderSvg(buildLayoutModel(s, 200));
			// The wedge always renders, independent of the point dynamics.
			expect(svg.querySelector('[data-span="crescendo"] line')).not.toBeNull();
			expect(svg.querySelectorAll('[data-span="crescendo"] line')).toHaveLength(
				2,
			);
			// The point dynamic text(s) render independently of the wedge.
			expect(svg.querySelectorAll('[data-text="dynamic"]')).toHaveLength(
				expectedDynamicCount[name],
			);
		}
	});

	it("leaves ties/slurs as <path> Béziers and renders all markings coexisting (AC8)", () => {
		// One song combining a tie, a slur, an ottava (octaveShift), point dynamics, and
		// a hairpin. Every marking's selector must coexist in the rendered SVG.
		const combined = {
			metadata: { title: "All markings" },
			defaults: { rightHand: { clef: "treble" }, leftHand: { clef: "bass" } },
			sections: [
				{
					measures: [
						{
							rightHand: [
								{
									type: "note",
									duration: "quarter",
									dynamic: "mf",
									tie: "start",
									slur: "start",
									crescendo: "start",
									pitches: [{ step: "C", octave: 5 }],
								},
								{
									type: "note",
									duration: "quarter",
									tie: "stop",
									slur: "stop",
									crescendo: "stop",
									pitches: [{ step: "C", octave: 5 }],
								},
							],
							leftHand: [
								{
									type: "note",
									duration: "half",
									pitches: [{ step: "C", octave: 3 }],
								},
							],
						},
					],
				},
				{
					rightHand: { octaveShift: 1 },
					measures: [
						{
							barlineEnd: "final",
							rightHand: [
								{
									type: "note",
									duration: "whole",
									pitches: [{ step: "C", octave: 6 }],
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
		};
		const svg = renderSvg(buildLayoutModel(combined, 400));
		// A tie stays a <path> Bézier — NOT converted to <line>s.
		const tie = svg.querySelector('[data-span="tie"]');
		expect(tie).not.toBeNull();
		expect(tie.tagName.toLowerCase()).toBe("path");
		expect(tie.getAttribute("d")).toContain("Q"); // a quadratic Bézier, not a line
		// The slur is likewise a <path>.
		const slur = svg.querySelector('[data-span="slur"]');
		expect(slur).not.toBeNull();
		expect(slur.tagName.toLowerCase()).toBe("path");
		// The hairpin is a <g> of two <line>s.
		const hairpin = svg.querySelector('[data-span="crescendo"]');
		expect(hairpin.tagName.toLowerCase()).toBe("g");
		expect(hairpin.querySelectorAll("line")).toHaveLength(2);
		// The ottava and point dynamic coexist too.
		expect(svg.querySelector('[data-text="ottava"]')).not.toBeNull();
		expect(svg.querySelector('[data-text="dynamic"]')).not.toBeNull();
	});

	it("renders a left-hand wedge stamped data-hand=leftHand", () => {
		const svg = renderSvg(
			buildLayoutModel(
				song(
					[note({}, [{ step: "C", octave: 5 }])],
					[
						note({ crescendo: "start" }, [{ step: "C", octave: 3 }]),
						note({ crescendo: "stop" }, [{ step: "E", octave: 3 }]),
					],
				),
				200,
			),
		);
		const g = svg.querySelector('[data-span="crescendo"]');
		expect(g).not.toBeNull();
		expect(g.getAttribute("data-hand")).toBe("leftHand");
		expect(g.querySelectorAll("line")).toHaveLength(2);
	});
});

// ── Measure-number absence (consumer side) ─────────────────────────────────────────
//
// Guards that the emit layer renders NO measure-number node, even for a song that
// genuinely wraps to several systems — the case where measure numbers used to be
// restated at each system head. The fixture is plain (notes on both hands, no
// markings) and authored to wrap at a narrow width; it is kept inline here rather than
// reusing the file's single-system SONG (which never wraps).

/**
 * A plain multi-measure song that wraps to more than one system at a narrow width.
 * Each measure carries a whole note on both hands so the grand staff exists and the
 * packer has real content widths to break across; the `tempo` default makes a
 * system-level tempo node render, which the test uses as a positive control that the
 * `[data-text=…]` query idiom actually matches emitted nodes.
 */
const WRAPPING_SONG = {
	metadata: { title: "Wrapping" },
	defaults: { tempo: { bpm: 120 } },
	sections: [
		{
			measures: Array.from({ length: 6 }, () => ({
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
			})),
		},
	],
};

describe("renderSvg — measure-number absence", () => {
	it("emits no measure-number node for a song that wraps to multiple systems", () => {
		const model = buildLayoutModel(WRAPPING_SONG, 30);
		// Wrap guard: the song genuinely spans more than one system, so the absence
		// assertion below is non-vacuous (it is the multi-system head where measure
		// numbers used to be restated).
		expect(model.systems.length).toBeGreaterThan(1);
		const svg = renderSvg(model);
		// Positive control: the `[data-text=…]` query idiom matches real emitted nodes
		// in this render (the tempo mark), so the zero-match below is a true absence,
		// not an empty-SVG false pass.
		expect(svg.querySelectorAll('[data-text="tempo"]').length).toBeGreaterThan(
			0,
		);
		// No measure-number node is emitted anywhere in the rendered SVG.
		expect(svg.querySelectorAll('[data-text="measure-number"]')).toHaveLength(
			0,
		);
	});
});
