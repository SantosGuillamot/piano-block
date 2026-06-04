/**
 * The song format's schema-as-data definition — the single, machine-readable
 * source of truth for "what is a conformant song".
 *
 * This is pure data with no logic: the zero-dependency validator/walker
 * interprets it. It uses only a small JSON-Schema
 * subset — `type`, `required`, `properties`, `items`, `enum`, `$ref`/`$defs`,
 * integer `minimum`/`maximum`, and one `if`/`then` (whose discriminant uses
 * `const`). `additionalProperties` is left **permissive** everywhere: unknown
 * object properties are ignored, not errors, so the format can grow additively
 * with no `version` field.
 *
 * Three checks the keyword subset cannot fully express are delegated to the
 * walker (annotated inline below):
 *   1. note names (`pitch.step` and `alters` keys) — matched case-insensitively
 *      against the closed two-system vocabulary (English C D E F G A B +
 *      Spanish do re mi fa sol la si);
 *   2. `alters` — a map whose every value is an integer in −2..+2 and whose
 *      every key is a recognised note name;
 *   3. `tempo.bpm` — the strict lower bound `bpm > 0` (the subset has no
 *      exclusive-minimum keyword).
 *
 * The object is intentionally readable: it is publishable verbatim as
 * documentation of the format.
 */
const songSchema = {
	type: "object",
	required: ["sections"],
	properties: {
		metadata: {
			type: "object",
			properties: {
				title: { type: "string" },
				composer: { type: "string" },
			},
			// additionalProperties permissive (unknown keys ignored)
		},
		defaults: { $ref: "#/$defs/context" },
		sections: {
			type: "array",
			items: { $ref: "#/$defs/section" },
		},
	},

	$defs: {
		// Shared by defaults and section: the context fields.
		context: {
			type: "object",
			properties: {
				tempo: { $ref: "#/$defs/tempo" },
				timeSignature: { $ref: "#/$defs/timeSignature" },
				rightHand: { $ref: "#/$defs/handConfig" },
				leftHand: { $ref: "#/$defs/handConfig" },
			},
		},

		section: {
			type: "object",
			required: ["measures"],
			properties: {
				tempo: { $ref: "#/$defs/tempo" },
				timeSignature: { $ref: "#/$defs/timeSignature" },
				rightHand: { $ref: "#/$defs/handConfig" },
				leftHand: { $ref: "#/$defs/handConfig" },
				measures: {
					type: "array",
					items: { $ref: "#/$defs/measure" },
				},
			},
		},

		measure: {
			type: "object",
			properties: {
				rightHand: { type: "array", items: { $ref: "#/$defs/event" } },
				leftHand: { type: "array", items: { $ref: "#/$defs/event" } },
				barlineStart: {
					enum: ["regular", "repeat-start", "repeat-end", "double", "final"],
				},
				barlineEnd: {
					enum: ["regular", "repeat-start", "repeat-end", "double", "final"],
				},
			},
		},

		tempo: {
			type: "object",
			required: ["bpm"],
			properties: {
				// bpm: a number; the STRICT lower bound (bpm > 0) is enforced by the
				// walker (the keyword subset has no exclusive-minimum keyword).
				bpm: { type: "number" },
				beatUnit: {
					enum: [
						"whole",
						"half",
						"quarter",
						"eighth",
						"sixteenth",
						"thirty-second",
					],
				},
			},
		},

		timeSignature: {
			type: "object",
			required: ["beats", "beatType"],
			properties: {
				beats: { type: "integer", minimum: 1 },
				beatType: { enum: [1, 2, 4, 8, 16, 32] },
			},
		},

		handConfig: {
			type: "object",
			properties: {
				clef: { enum: ["treble", "bass", "alto", "tenor"] },
				// alters: a map note-name → integer −2..+2 (validated as such by the
				// walker; keys are matched case-insensitively against the note-name
				// vocabulary).
				alters: { type: "object" },
				octaveShift: { type: "integer", minimum: -2, maximum: 2 },
			},
		},

		event: {
			type: "object",
			required: ["type", "duration"],
			properties: {
				type: { enum: ["note", "rest"] },
				duration: {
					enum: [
						"whole",
						"half",
						"quarter",
						"eighth",
						"sixteenth",
						"thirty-second",
					],
				},
				dots: { type: "integer", minimum: 0, maximum: 2 },
				pitches: { type: "array", items: { $ref: "#/$defs/pitch" } },
				dynamic: { enum: ["pp", "p", "mp", "mf", "f", "ff", "sf", "sfz"] },
				chordSymbol: { type: "string" },
				tie: { enum: ["start", "stop"] },
				slur: { enum: ["start", "stop"] },
				crescendo: { enum: ["start", "stop"] },
				decrescendo: { enum: ["start", "stop"] },
			},
			// The single data-model conditional: a note requires a non-empty pitches
			// array (the non-empty part is enforced by the walker).
			if: { properties: { type: { const: "note" } } },
			// biome-ignore lint/suspicious/noThenProperty: `then` is the JSON-Schema keyword the walker reads, not a thenable.
			then: { required: ["pitches"] },
		},

		pitch: {
			type: "object",
			required: ["step", "octave"],
			properties: {
				// step: a note name, matched case-insensitively by the walker against
				// English C D E F G A B and Spanish do re mi fa sol la si.
				step: { type: "string" },
				octave: { type: "integer", minimum: 0, maximum: 9 },
				alter: { type: "integer", minimum: -2, maximum: 2 },
			},
		},
	},
};

export default songSchema;
