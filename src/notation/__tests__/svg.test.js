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
							notes: [{ text: "C", placement: "above" }],
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
							notes,
							pitches: [{ step: "C", octave: 5 }],
						},
					],
				},
			],
		},
	],
});

describe("renderSvg — per-event note text", () => {
	it('renders a note as <text data-text="note"> with verbatim textContent', () => {
		const svg = renderSvg(
			buildLayoutModel(
				songWithNotes([{ text: "Gm7", placement: "above" }]),
				120,
			),
		);
		const note = svg.querySelector('[data-text="note"]');
		expect(note).not.toBeNull();
		expect(note.tagName.toLowerCase()).toBe("text");
		expect(note.textContent).toBe("Gm7");
	});

	it("renders no text node for an empty note text", () => {
		const svg = renderSvg(
			buildLayoutModel(songWithNotes([{ text: "", placement: "above" }]), 120),
		);
		expect(svg.querySelector('[data-text="note"]')).toBeNull();
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
		expect(svg.querySelector('[data-text="note"]')).toBeNull();
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
				notes: right,
				pitches: [{ step: "C", octave: 5 }],
			},
		];
	}
	if (left) {
		measure.leftHand = [
			{
				type: "note",
				duration: "quarter",
				notes: left,
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
			'[data-hand="rightHand"] [data-text="note"]',
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
			'[data-hand="rightHand"] [data-text="note"]',
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
		const note = svg.querySelector('[data-hand="leftHand"] [data-text="note"]');
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
		const note = svg.querySelector('[data-hand="leftHand"] [data-text="note"]');
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
		const rh = svg.querySelector('[data-hand="rightHand"] [data-text="note"]');
		const lh = svg.querySelector('[data-hand="leftHand"] [data-text="note"]');
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
			'[data-hand="rightHand"] [data-text="note"]',
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
			...svg.querySelectorAll('[data-hand="rightHand"] [data-text="note"]'),
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
			...svg.querySelectorAll('[data-hand="rightHand"] [data-text="note"]'),
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
									notes: [{ text: "pedal", placement: "below" }],
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
			'[data-hand="rightHand"] [data-text="note"]',
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
									notes: [
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
		const note = svg.querySelector('[data-text="note"]');
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
