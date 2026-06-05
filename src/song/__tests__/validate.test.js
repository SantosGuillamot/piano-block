/**
 * Unit tests for the zero-dependency song conformance validator.
 * `validateSong(rawString)` receives the author's RAW string, parses it
 * itself, walks it against `schema.js`, and returns a list of human-readable,
 * path-pointed error messages — `[]` when the song is conformant.
 *
 * These tests cover the format for the data model: conformant songs produce no
 * error, the comprehensive song, the valid-JSON gate, both note-name systems
 * (case-insensitive), and structural-only validation (no musical-timing
 * validation). They run in pure Node with no WordPress runtime.
 */
import validateSong from "../validate.js";

/**
 * The annotated comprehensive example song, transcribed verbatim (the
 * documentation listing is JSONC; the stored `song` content is the JSON it
 * describes — comments stripped, values unchanged).
 *
 * It exercises every required element: notes & rests in both hands, the
 * opening 3-pitch C-major chord, a dotted half (`dots: 1`), a per-note
 * accidental (F#2 via `alter`), mixed English + Spanish note names, per-hand
 * `clef` / `alters` / `octaveShift`, Section-2 mid-song tempo / time-signature
 * / left-hand clef / `alters` changes, `mf` / `p` dynamics, a free-text
 * per-event `notes` annotation ("C"), `tie` / `slur` start + stop,
 * `repeat-start` / `repeat-end` / `final` barlines, and `metadata` title +
 * composer.
 */
const COMPREHENSIVE_SONG = {
	metadata: {
		title: "Example",
		composer: "A. Composer",
	},

	// Song-wide context every section inherits unless it overrides.
	defaults: {
		tempo: { bpm: 120, beatUnit: "quarter" },
		timeSignature: { beats: 4, beatType: 4 },
		rightHand: { clef: "treble" },
		leftHand: { clef: "bass", alters: { B: -1 } },
	},

	sections: [
		// Section 1 — uses defaults (no overrides).
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
							annotations: [{ text: "C", placement: "above" }],
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

		// Section 2 — mid-song changes: new tempo, time signature, a left-hand
		// clef change, alters, and a right-hand octave shift.
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
};

/** Convenience: validate an object by serializing it to its JSON string. */
const check = (value) => validateSong(JSON.stringify(value));

describe("validateSong — valid-JSON gate", () => {
	it("returns exactly one parse error for a string that is not valid JSON", () => {
		const errors = validateSong("{ not json");
		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatch(/JSON/i);
	});

	it("returns exactly one parse error for an empty / non-JSON fragment", () => {
		const errors = validateSong("sections: []");
		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatch(/JSON/i);
	});

	it("reports schema errors (not a parse error) for well-formed-but-non-conformant JSON", () => {
		// Parses fine, but `sections` is missing → a schema error, not a JSON error.
		const errors = validateSong("{}");
		expect(errors.length).toBeGreaterThan(0);
		expect(errors.some((e) => /JSON/i.test(e))).toBe(false);
		expect(errors.some((e) => /sections/.test(e))).toBe(true);
	});
});

describe("validateSong — conformant songs", () => {
	it("accepts the minimal conformant song with no errors", () => {
		expect(validateSong('{"sections":[{"measures":[]}]}')).toEqual([]);
	});

	it("accepts a bare song with empty sections array", () => {
		expect(check({ sections: [] })).toEqual([]);
	});

	it("accepts the comprehensive example song", () => {
		expect(check(COMPREHENSIVE_SONG)).toEqual([]);
	});

	it("accepts a `crescendo` span and a separate `decrescendo` span, each over ≥2 notes", () => {
		// One hand carries a crescendo (start → stop) across two notes; the same
		// hand later carries an independent decrescendo across two more notes.
		const note = (step, span) => ({
			type: "note",
			duration: "quarter",
			pitches: [{ step, octave: 4 }],
			...span,
		});
		expect(
			check({
				sections: [
					{
						measures: [
							{
								rightHand: [
									note("C", { crescendo: "start" }),
									note("D", { crescendo: "stop" }),
									note("E", { decrescendo: "start" }),
									note("F", { decrescendo: "stop" }),
								],
							},
						],
					},
				],
			}),
		).toEqual([]);
	});

	it('accepts a lone `crescendo: "start"` with no matching stop (pairing is not a conformance check)', () => {
		expect(
			check({
				sections: [
					{
						measures: [
							{
								rightHand: [
									{
										type: "note",
										duration: "quarter",
										crescendo: "start",
										pitches: [{ step: "C", octave: 4 }],
									},
								],
							},
						],
					},
				],
			}),
		).toEqual([]);
	});
});

describe("validateSong — note-name systems and case", () => {
	const pitchSong = (pitch) => ({
		sections: [
			{
				measures: [
					{
						rightHand: [
							{ type: "note", duration: "quarter", pitches: [pitch] },
						],
					},
				],
			},
		],
	});

	it("accepts an English note name (G)", () => {
		expect(check(pitchSong({ step: "G", octave: 4 }))).toEqual([]);
	});

	it("accepts the equivalent Spanish solfège name (sol)", () => {
		expect(check(pitchSong({ step: "sol", octave: 4 }))).toEqual([]);
	});

	it("accepts note names case-insensitively (g, DO, Sol)", () => {
		expect(check(pitchSong({ step: "g", octave: 4 }))).toEqual([]);
		expect(check(pitchSong({ step: "DO", octave: 4 }))).toEqual([]);
		expect(check(pitchSong({ step: "Sol", octave: 4 }))).toEqual([]);
	});

	it("rejects an unrecognized note name (H)", () => {
		const errors = check(pitchSong({ step: "H", octave: 4 }));
		expect(errors.length).toBeGreaterThan(0);
		expect(errors.some((e) => /step/.test(e) && /H/.test(e))).toBe(true);
	});

	it("rejects an unrecognized note name (doh)", () => {
		const errors = check(pitchSong({ step: "doh", octave: 4 }));
		expect(errors.length).toBeGreaterThan(0);
		expect(errors.some((e) => /step/.test(e) && /doh/.test(e))).toBe(true);
	});
});

describe("validateSong — closed-enum errors", () => {
	// Each builds an otherwise-valid song with one offending enum value, and
	// asserts an error whose message includes the offending JSON path.
	const eventSong = (event) => ({
		sections: [{ measures: [{ rightHand: [event] }] }],
	});

	it("flags a typo'd duration with its path", () => {
		const errors = eventSong({ type: "rest", duration: "quaver" });
		const result = check(errors);
		expect(result.some((e) => /duration/.test(e) && /quaver/.test(e))).toBe(
			true,
		);
	});

	it("flags a typo'd clef with its path", () => {
		const result = check({
			defaults: { rightHand: { clef: "treble-clef" } },
			sections: [{ measures: [] }],
		});
		expect(result.some((e) => /clef/.test(e) && /treble-clef/.test(e))).toBe(
			true,
		);
	});

	it("flags a typo'd dynamic with its path", () => {
		const result = check(
			eventSong({
				type: "note",
				duration: "quarter",
				dynamic: "mezzo",
				pitches: [{ step: "C", octave: 4 }],
			}),
		);
		expect(result.some((e) => /dynamic/.test(e) && /mezzo/.test(e))).toBe(true);
	});

	it("flags a typo'd barlineEnd with its path", () => {
		const result = check({
			sections: [{ measures: [{ barlineEnd: "repeat" }] }],
		});
		expect(result.some((e) => /barlineEnd/.test(e) && /repeat/.test(e))).toBe(
			true,
		);
	});

	it("flags an invalid event type with its path", () => {
		const result = check(eventSong({ type: "chord", duration: "quarter" }));
		expect(result.some((e) => /type/.test(e) && /chord/.test(e))).toBe(true);
	});

	it("flags an invalid beatType with its path", () => {
		const result = check({
			defaults: { timeSignature: { beats: 4, beatType: 3 } },
			sections: [{ measures: [] }],
		});
		expect(result.some((e) => /beatType/.test(e))).toBe(true);
	});

	it("flags a typo'd tie with its path", () => {
		const result = check(
			eventSong({
				type: "note",
				duration: "quarter",
				tie: "begin",
				pitches: [{ step: "C", octave: 4 }],
			}),
		);
		expect(result.some((e) => /tie/.test(e) && /begin/.test(e))).toBe(true);
	});

	it("flags a `crescendo` value outside the allowed set with its path and allowed values", () => {
		const result = check(
			eventSong({
				type: "note",
				duration: "quarter",
				crescendo: "increase",
				pitches: [{ step: "C", octave: 4 }],
			}),
		);
		expect(
			result.some(
				(e) =>
					/crescendo/.test(e) &&
					/increase/.test(e) &&
					/\["start", "stop"\]/.test(e),
			),
		).toBe(true);
	});

	it("flags a `decrescendo` value outside the allowed set with its path", () => {
		const result = check(
			eventSong({
				type: "note",
				duration: "quarter",
				decrescendo: "decrease",
				pitches: [{ step: "C", octave: 4 }],
			}),
		);
		expect(
			result.some((e) => /decrescendo/.test(e) && /decrease/.test(e)),
		).toBe(true);
	});
});

describe("validateSong — type / required / nesting errors", () => {
	it("flags a missing top-level `sections`", () => {
		const result = check({ metadata: { title: "x" } });
		expect(result.some((e) => /sections/.test(e))).toBe(true);
	});

	it("flags a section missing `measures`", () => {
		const result = check({ sections: [{ tempo: { bpm: 120 } }] });
		expect(result.some((e) => /measures/.test(e))).toBe(true);
	});

	it("flags an event missing `type`", () => {
		const result = check({
			sections: [{ measures: [{ rightHand: [{ duration: "quarter" }] }] }],
		});
		expect(result.some((e) => /type/.test(e))).toBe(true);
	});

	it("flags an event missing `duration`", () => {
		const result = check({
			sections: [
				{
					measures: [
						{
							rightHand: [{ type: "rest" }],
						},
					],
				},
			],
		});
		expect(result.some((e) => /duration/.test(e))).toBe(true);
	});

	it("flags a pitch missing `step`", () => {
		const result = check({
			sections: [
				{
					measures: [
						{
							rightHand: [
								{ type: "note", duration: "quarter", pitches: [{ octave: 4 }] },
							],
						},
					],
				},
			],
		});
		expect(result.some((e) => /step/.test(e))).toBe(true);
	});

	it("flags a pitch missing `octave`", () => {
		const result = check({
			sections: [
				{
					measures: [
						{
							rightHand: [
								{
									type: "note",
									duration: "quarter",
									pitches: [{ step: "C" }],
								},
							],
						},
					],
				},
			],
		});
		expect(result.some((e) => /octave/.test(e))).toBe(true);
	});

	it("flags `sections` that is not an array", () => {
		const result = check({ sections: { measures: [] } });
		expect(result.some((e) => /sections/.test(e))).toBe(true);
	});

	it("flags `measures` that is not an array", () => {
		const result = check({ sections: [{ measures: "none" }] });
		expect(result.some((e) => /measures/.test(e))).toBe(true);
	});

	it("flags a hand value that is not an array", () => {
		const result = check({
			sections: [{ measures: [{ rightHand: { type: "note" } }] }],
		});
		expect(result.some((e) => /rightHand/.test(e))).toBe(true);
	});
});

describe("validateSong — the one conditional: note ⇒ non-empty pitches", () => {
	const eventSong = (event) => ({
		sections: [{ measures: [{ rightHand: [event] }] }],
	});

	it("flags a note event with no `pitches`", () => {
		const result = check(eventSong({ type: "note", duration: "quarter" }));
		expect(result.some((e) => /pitches/.test(e))).toBe(true);
	});

	it("flags a note event with an empty `pitches` array", () => {
		const result = check(
			eventSong({ type: "note", duration: "quarter", pitches: [] }),
		);
		expect(result.some((e) => /pitches/.test(e))).toBe(true);
	});

	it("accepts a rest event with no `pitches`", () => {
		expect(check(eventSong({ type: "rest", duration: "quarter" }))).toEqual([]);
	});
});

describe("validateSong — per-event `notes`", () => {
	// Wrap one event (carrying a `notes` array) into an otherwise-valid song.
	const eventSong = (event) => ({
		sections: [{ measures: [{ rightHand: [event] }] }],
	});

	it("accepts an event whose `notes` holds an above-placement annotation", () => {
		expect(
			check(
				eventSong({
					type: "note",
					duration: "quarter",
					annotations: [{ text: "C", placement: "above" }],
					pitches: [{ step: "C", octave: 4 }],
				}),
			),
		).toEqual([]);
	});

	it("accepts a rest event with a below-placement annotation", () => {
		expect(
			check(
				eventSong({
					type: "rest",
					duration: "quarter",
					annotations: [{ text: "pedal", placement: "below" }],
				}),
			),
		).toEqual([]);
	});

	it("accepts an event with no `notes` key", () => {
		expect(check(eventSong({ type: "rest", duration: "quarter" }))).toEqual([]);
	});

	it("accepts an event with an empty `notes` array", () => {
		expect(
			check(eventSong({ type: "rest", duration: "quarter", annotations: [] })),
		).toEqual([]);
	});

	it("accepts a note annotation with empty text", () => {
		expect(
			check(
				eventSong({
					type: "rest",
					duration: "quarter",
					annotations: [{ text: "", placement: "above" }],
				}),
			),
		).toEqual([]);
	});

	it("flags a note annotation missing `text`, pointing at that element", () => {
		const result = check(
			eventSong({
				type: "rest",
				duration: "quarter",
				annotations: [{ placement: "above" }],
			}),
		);
		expect(
			result.some((e) => /annotations\[0\]/.test(e) && /text/.test(e)),
		).toBe(true);
	});

	it("flags a note annotation missing `placement`", () => {
		const result = check(
			eventSong({
				type: "rest",
				duration: "quarter",
				annotations: [{ text: "C" }],
			}),
		);
		expect(result.some((e) => /placement/.test(e))).toBe(true);
	});

	it("flags a note annotation with an out-of-enum `placement`", () => {
		const result = check(
			eventSong({
				type: "rest",
				duration: "quarter",
				annotations: [{ text: "C", placement: "middle" }],
			}),
		);
		expect(result.some((e) => /placement/.test(e) && /middle/.test(e))).toBe(
			true,
		);
	});

	it("ignores a stray `staff` or `beat` on a per-event note", () => {
		expect(
			check(
				eventSong({
					type: "rest",
					duration: "quarter",
					annotations: [
						{ text: "C", placement: "above", staff: "rightHand", beat: 2 },
					],
				}),
			),
		).toEqual([]);
	});

	it("reports the element index and field for a bad `placement` in a later element", () => {
		const result = check(
			eventSong({
				type: "rest",
				duration: "quarter",
				annotations: [
					{ text: "C", placement: "above" },
					{ text: "G", placement: "sideways" },
				],
			}),
		);
		expect(result.some((e) => /annotations\[1\]\.placement/.test(e))).toBe(
			true,
		);
	});
});

describe("validateSong — standalone measure `notes`", () => {
	// Wrap one standalone note into an otherwise-valid measure.
	const measureNoteSong = (note) => ({
		sections: [{ measures: [{ annotations: [note] }] }],
	});

	it("accepts a standalone note with both required string fields and a staff", () => {
		expect(
			check(
				measureNoteSong({
					text: "rit.",
					placement: "above",
					staff: "rightHand",
				}),
			),
		).toEqual([]);
	});

	it("accepts both `staff` values", () => {
		expect(
			check(
				measureNoteSong({
					text: "rit.",
					placement: "above",
					staff: "rightHand",
				}),
			),
		).toEqual([]);
		expect(
			check(
				measureNoteSong({
					text: "rit.",
					placement: "below",
					staff: "leftHand",
				}),
			),
		).toEqual([]);
	});

	it("accepts a measure with an empty `notes` array", () => {
		expect(check({ sections: [{ measures: [{ annotations: [] }] }] })).toEqual(
			[],
		);
	});

	it("accepts a standalone note with empty text", () => {
		expect(
			check(
				measureNoteSong({ text: "", placement: "above", staff: "rightHand" }),
			),
		).toEqual([]);
	});

	it("flags a standalone note missing `text`, pointing at that element", () => {
		const result = check(
			measureNoteSong({ placement: "above", staff: "rightHand" }),
		);
		expect(
			result.some((e) => /annotations\[0\]/.test(e) && /text/.test(e)),
		).toBe(true);
	});

	it("flags a standalone note missing `staff`", () => {
		const result = check(measureNoteSong({ text: "rit.", placement: "above" }));
		expect(result.some((e) => /staff/.test(e))).toBe(true);
	});

	it("flags a standalone note with an invalid `staff` value", () => {
		const result = check(
			measureNoteSong({ text: "rit.", placement: "above", staff: "bothHands" }),
		);
		expect(result.some((e) => /staff/.test(e) && /bothHands/.test(e))).toBe(
			true,
		);
	});

	it("flags a standalone note missing `placement`", () => {
		const result = check(measureNoteSong({ text: "rit.", staff: "rightHand" }));
		expect(result.some((e) => /placement/.test(e))).toBe(true);
	});

	it("flags a standalone note with an out-of-enum `placement`", () => {
		const result = check(
			measureNoteSong({
				text: "rit.",
				placement: "middle",
				staff: "rightHand",
			}),
		);
		expect(result.some((e) => /placement/.test(e) && /middle/.test(e))).toBe(
			true,
		);
	});

	it("flags `beat: -1`", () => {
		const result = check(
			measureNoteSong({
				text: "rit.",
				placement: "above",
				staff: "rightHand",
				beat: -1,
			}),
		);
		expect(result.some((e) => /beat/.test(e))).toBe(true);
	});

	it("accepts `beat` values of 0, 0.5, and 99", () => {
		for (const beat of [0, 0.5, 99]) {
			expect(
				check(
					measureNoteSong({
						text: "rit.",
						placement: "above",
						staff: "rightHand",
						beat,
					}),
				),
			).toEqual([]);
		}
	});
});

describe("validateSong — integer-range errors", () => {
	const pitchSong = (pitch) => ({
		sections: [
			{
				measures: [
					{
						rightHand: [
							{ type: "note", duration: "quarter", pitches: [pitch] },
						],
					},
				],
			},
		],
	});

	it("flags octave above the 0..9 range (10)", () => {
		const result = check(pitchSong({ step: "C", octave: 10 }));
		expect(result.some((e) => /octave/.test(e))).toBe(true);
	});

	it("flags octave below the 0..9 range (-1)", () => {
		const result = check(pitchSong({ step: "C", octave: -1 }));
		expect(result.some((e) => /octave/.test(e))).toBe(true);
	});

	it("accepts octave at the range bounds (0 and 9)", () => {
		expect(check(pitchSong({ step: "C", octave: 0 }))).toEqual([]);
		expect(check(pitchSong({ step: "C", octave: 9 }))).toEqual([]);
	});

	it("flags a per-note `alter` out of −2..+2 (3)", () => {
		const result = check(pitchSong({ step: "C", octave: 4, alter: 3 }));
		expect(result.some((e) => /alter/.test(e))).toBe(true);
	});

	it("flags an `octaveShift` out of −2..+2 (3)", () => {
		const result = check({
			defaults: { rightHand: { octaveShift: 3 } },
			sections: [{ measures: [] }],
		});
		expect(result.some((e) => /octaveShift/.test(e))).toBe(true);
	});

	it("flags `dots` out of 0..2 (3)", () => {
		const result = check({
			sections: [
				{
					measures: [
						{
							rightHand: [{ type: "rest", duration: "quarter", dots: 3 }],
						},
					],
				},
			],
		});
		expect(result.some((e) => /dots/.test(e))).toBe(true);
	});

	it("flags `timeSignature.beats` below 1 (0)", () => {
		const result = check({
			defaults: { timeSignature: { beats: 0, beatType: 4 } },
			sections: [{ measures: [] }],
		});
		expect(result.some((e) => /beats/.test(e))).toBe(true);
	});

	it("accepts in-range integer values", () => {
		expect(
			check({
				defaults: {
					timeSignature: { beats: 1, beatType: 4 },
					rightHand: { octaveShift: -2 },
				},
				sections: [
					{
						measures: [
							{
								rightHand: [
									{
										type: "note",
										duration: "quarter",
										dots: 2,
										pitches: [{ step: "C", octave: 4, alter: -2 }],
									},
								],
							},
						],
					},
				],
			}),
		).toEqual([]);
	});

	it("rejects a non-integer where an integer is required (octave 4.5)", () => {
		// JSON has no integer type; `typeof 4.5` is "number" — the walker must
		// use Number.isInteger so a fractional value is flagged.
		const result = check(pitchSong({ step: "C", octave: 4.5 }));
		expect(result.some((e) => /octave/.test(e))).toBe(true);
	});
});

describe("validateSong — walker special cases", () => {
	const tempoSong = (tempo) => ({
		defaults: { tempo },
		sections: [{ measures: [] }],
	});
	const altersSong = (alters) => ({
		defaults: { rightHand: { alters } },
		sections: [{ measures: [] }],
	});

	it("flags `tempo.bpm` of 0 (strict bpm > 0)", () => {
		const result = check(tempoSong({ bpm: 0 }));
		expect(result.some((e) => /bpm/.test(e))).toBe(true);
	});

	it("flags a negative `tempo.bpm`", () => {
		const result = check(tempoSong({ bpm: -120 }));
		expect(result.some((e) => /bpm/.test(e))).toBe(true);
	});

	it("accepts `tempo.bpm` of 1", () => {
		expect(check(tempoSong({ bpm: 1 }))).toEqual([]);
	});

	it("accepts an `alters` map with a valid note-name key and in-range value", () => {
		expect(check(altersSong({ F: 1 }))).toEqual([]);
	});

	it("accepts an empty `alters` map", () => {
		expect(check(altersSong({}))).toEqual([]);
	});

	it("flags an `alters` value out of −2..+2 (3)", () => {
		const result = check(altersSong({ F: 3 }));
		expect(result.some((e) => /alters/.test(e))).toBe(true);
	});

	it("flags an `alters` key that is not a recognized note name (H)", () => {
		const result = check(altersSong({ H: 1 }));
		expect(result.some((e) => /alters/.test(e) && /H/.test(e))).toBe(true);
	});

	it("accepts `alters` keys case-insensitively and in both note systems", () => {
		expect(check(altersSong({ f: 1, DO: -1, Sol: 2 }))).toEqual([]);
	});
});

describe("validateSong — lenient on unknown properties", () => {
	it("ignores an unknown property at the root", () => {
		expect(check({ foo: 1, sections: [{ measures: [] }] })).toEqual([]);
	});

	it("ignores a misspelled optional property on an event (`dynmic`)", () => {
		expect(
			check({
				sections: [
					{
						measures: [
							{
								rightHand: [{ type: "rest", duration: "quarter", dynmic: "f" }],
							},
						],
					},
				],
			}),
		).toEqual([]);
	});

	it("ignores a misspelled gradual-dynamic field (`cresecndo`)", () => {
		// A misspelled optional field name is an unknown property, silently
		// ignored — only declared properties are inspected.
		expect(
			check({
				sections: [
					{
						measures: [
							{
								rightHand: [
									{
										type: "note",
										duration: "quarter",
										cresecndo: "start",
										pitches: [{ step: "C", octave: 4 }],
									},
								],
							},
						],
					},
				],
			}),
		).toEqual([]);
	});

	it("ignores unknown properties on nested objects (pitch, handConfig)", () => {
		expect(
			check({
				defaults: { rightHand: { clef: "treble", color: "red" } },
				sections: [
					{
						measures: [
							{
								rightHand: [
									{
										type: "note",
										duration: "quarter",
										pitches: [{ step: "C", octave: 4, fingering: 1 }],
									},
								],
							},
						],
					},
				],
			}),
		).toEqual([]);
	});
});

describe("validateSong — structural only, no musical-timing validation", () => {
	it("accepts a song whose measure durations do not sum to the time signature and whose hands differ in length", () => {
		// 4/4 time, but the right hand is a single eighth note (½ beat) and the
		// left hand is two whole notes (8 beats) — wildly unbalanced, and the
		// hands are different total lengths. No timing check → no error.
		expect(
			check({
				defaults: { timeSignature: { beats: 4, beatType: 4 } },
				sections: [
					{
						measures: [
							{
								rightHand: [
									{
										type: "note",
										duration: "eighth",
										pitches: [{ step: "C", octave: 4 }],
									},
								],
								leftHand: [
									{
										type: "note",
										duration: "whole",
										pitches: [{ step: "C", octave: 2 }],
									},
									{
										type: "note",
										duration: "whole",
										pitches: [{ step: "G", octave: 2 }],
									},
								],
							},
						],
					},
				],
			}),
		).toEqual([]);
	});
});
