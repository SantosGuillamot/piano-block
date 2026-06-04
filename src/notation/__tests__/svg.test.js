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
							chordSymbol: "C",
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
									chordSymbol: "<script>alert(1)</script>",
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
		const chord = svg.querySelector('[data-text="chord-symbol"]');
		expect(chord.textContent).toBe("<script>alert(1)</script>");
		expect(chord.children).toHaveLength(0);
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
		sections: [{ measures: [{ rightHand, ...(leftHand ? { leftHand } : {}) }] }],
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
				song([note({ crescendo: "start" }), note({}), note({ crescendo: "stop" })]),
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
			song([note({ crescendo: "start" }), note({}), note({ crescendo: "stop" })]),
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
			start: song([note({ crescendo: "start", dynamic: "p" }), note({ crescendo: "stop" })]),
			end: song([note({ crescendo: "start" }), note({ crescendo: "stop", dynamic: "f" })]),
			both: song([
				note({ crescendo: "start", dynamic: "p" }),
				note({ crescendo: "stop", dynamic: "f" }),
			]),
			neither: song([note({ crescendo: "start" }), note({ crescendo: "stop" })]),
		};
		const expectedDynamicCount = { start: 1, end: 1, both: 2, neither: 0 };
		for (const [name, s] of Object.entries(cases)) {
			const svg = renderSvg(buildLayoutModel(s, 200));
			// The wedge always renders, independent of the point dynamics.
			expect(svg.querySelector('[data-span="crescendo"] line')).not.toBeNull();
			expect(svg.querySelectorAll('[data-span="crescendo"] line')).toHaveLength(2);
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
