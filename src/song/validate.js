/**
 * The zero-dependency song conformance validator (design §6.2 option ii, §7).
 *
 * `validateSong(rawString)` is the single entry point. It receives the
 * author's RAW string, parses it (a parse failure IS a conformance error, per
 * AC6), then walks the parsed value against the declarative schema-as-data
 * (`schema.js`, the single source of truth) and returns a list of
 * human-readable, path-pointed error messages — `[]` when the song conforms.
 *
 * The walk interprets only the small JSON-Schema subset the schema uses:
 * `$ref` / `$defs`, `type` (with a correct integer check — JSON has no integer
 * type, so `Number.isInteger` is used, not `typeof`), `required`, `properties`,
 * `items`, `enum`, integer `minimum` / `maximum`, and the single `if` / `then`
 * (a `note` requires a non-empty `pitches`). `additionalProperties` is left
 * permissive: unknown object properties are ignored, never errors (design §5),
 * so the format can grow additively with no `version` field.
 *
 * Three checks the keyword subset cannot fully express are handled directly as
 * documented walker special cases (design §7), keyed off the schema's own
 * `$defs` names so they stay tied to the single source of truth:
 *   1. note names (`pitch.step` and `alters` keys) — matched case-insensitively
 *      against the closed two-system vocabulary (English C D E F G A B +
 *      Spanish do re mi fa sol la si), encoded ONCE in `normalizeStep.js` and
 *      reused here via `isNoteName` (design §6.5);
 *   2. `alters` — a map whose every key is a recognised note name and whose
 *      every value is an integer in −2..+2;
 *   3. `tempo.bpm` — the strict lower bound `bpm > 0`.
 *
 * Validation is structural / field only: there is NO musical-timing check
 * (events need not sum to the time signature; the two hands need not align) —
 * a structurally-conformant but musically-unbalanced song is accepted (AC10).
 */

// The closed two-system note-name vocabulary lives in one shared home so the
// validator and the renderer cannot drift; `isNoteName` keeps the validator's
// exact semantics (design §6.5, §7).
import { isNoteName } from "./normalizeStep.js";
import songSchema from "./schema.js";

/** Render a value compactly for an error message (quotes strings via JSON). */
const show = (value) => {
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
};

/** A plain (non-array, non-null) object. */
const isPlainObject = (value) =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Resolve a `$ref` schema node to the schema it points at, returning both the
 * resolved schema and the `$defs` name (used to dispatch walker special cases).
 * Only the local `#/$defs/<name>` form the schema uses is supported.
 *
 * @param {Object} schema A schema node, possibly a `{ $ref }`.
 * @return {{ schema: Object, defName: ?string }} The resolved node + def name.
 */
function resolveRef(schema) {
	if (!schema || typeof schema.$ref !== "string") {
		return { schema, defName: null };
	}
	const match = schema.$ref.match(/^#\/\$defs\/(.+)$/);
	const defName = match ? match[1] : null;
	const resolved = defName ? songSchema.$defs[defName] : undefined;
	return { schema: resolved || {}, defName };
}

/**
 * Does `value` satisfy the schema's declared `type`? `integer` is checked with
 * `Number.isInteger` (JSON has no integer type; `typeof 1.5` is `"number"`).
 */
function matchesType(value, type) {
	switch (type) {
		case "object":
			return isPlainObject(value);
		case "array":
			return Array.isArray(value);
		case "string":
			return typeof value === "string";
		case "number":
			return typeof value === "number" && Number.isFinite(value);
		case "integer":
			return Number.isInteger(value);
		default:
			return true;
	}
}

/** A human-readable name for a declared type, for error messages. */
function typeName(value) {
	if (value === null) {
		return "null";
	}
	if (Array.isArray(value)) {
		return "array";
	}
	return typeof value;
}

/**
 * Recursively validate `value` against `schema` at `path`, pushing
 * human-readable messages onto `errors`.
 *
 * @param {*}        value  The parsed value under inspection.
 * @param {Object}   schema The schema node (may be a `$ref`).
 * @param {string}   path   The JSON path to `value` (for messages).
 * @param {string[]} errors Accumulator of error messages.
 */
function validateValue(value, schema, path, errors) {
	const { schema: resolved, defName } = resolveRef(schema);
	if (!resolved) {
		return;
	}
	const where = path || "(root)";

	// `enum` — closed-vocabulary membership.
	if (Array.isArray(resolved.enum) && !resolved.enum.includes(value)) {
		errors.push(
			`${where}: ${show(value)} is not one of the allowed values [${resolved.enum
				.map(show)
				.join(", ")}]`,
		);
		// A bad enum value can't be checked further; stop here.
		return;
	}

	// `type` — wrong type makes deeper checks meaningless, so bail after it.
	if (resolved.type && !matchesType(value, resolved.type)) {
		errors.push(
			`${where}: expected ${resolved.type} but got ${typeName(value)}`,
		);
		return;
	}

	// Integer / number range bounds.
	if (typeof value === "number") {
		if (typeof resolved.minimum === "number" && value < resolved.minimum) {
			errors.push(
				`${where}: ${show(value)} is below the minimum of ${resolved.minimum}`,
			);
		}
		if (typeof resolved.maximum === "number" && value > resolved.maximum) {
			errors.push(
				`${where}: ${show(value)} is above the maximum of ${resolved.maximum}`,
			);
		}
	}

	if (resolved.type === "array") {
		validateArray(value, resolved, path, errors);
	} else if (resolved.type === "object") {
		validateObject(value, resolved, path, errors);
	}

	// Walker special cases, dispatched by the schema's own `$defs` name so they
	// stay tied to the single source of truth (design §7).
	if (isPlainObject(value)) {
		applySpecialCases(value, defName, path, errors);
	}
}

/** Validate every element of an array against the schema's `items`. */
function validateArray(value, resolved, path, errors) {
	if (!resolved.items) {
		return;
	}
	value.forEach((item, index) => {
		validateValue(item, resolved.items, `${path}[${index}]`, errors);
	});
}

/**
 * Validate an object: required members, then recurse declared properties.
 * Unknown properties are intentionally NOT inspected (permissive, design §5).
 * The single `if` / `then` conditional is evaluated here.
 */
function validateObject(value, resolved, path, errors) {
	const where = path || "(root)";

	if (Array.isArray(resolved.required)) {
		for (const key of resolved.required) {
			if (!Object.hasOwn(value, key)) {
				errors.push(`${where}: missing required property "${key}"`);
			}
		}
	}

	if (resolved.properties) {
		for (const [key, subSchema] of Object.entries(resolved.properties)) {
			if (Object.hasOwn(value, key)) {
				const childPath = path ? `${path}.${key}` : key;
				validateValue(value[key], subSchema, childPath, errors);
			}
		}
	}

	evaluateConditional(value, resolved, path, errors);
}

/**
 * The single data-model conditional (design §4.2, §7): if `if` matches, the
 * `then` schema also applies. The only `if` in the schema discriminates on
 * `type === "note"` via `const`; its `then` requires `pitches`. The walker
 * additionally enforces that `pitches` is NON-EMPTY for a note.
 */
function evaluateConditional(value, resolved, path, errors) {
	if (!resolved.if || !resolved.then) {
		return;
	}
	if (!matchesIf(value, resolved.if)) {
		return;
	}
	const where = path || "(root)";

	if (Array.isArray(resolved.then.required)) {
		for (const key of resolved.then.required) {
			if (!Object.hasOwn(value, key)) {
				errors.push(
					`${where}: a "${value.type}" event requires a non-empty "${key}" array`,
				);
			}
		}
	}

	// Non-empty `pitches` is the walker's extra (the keyword subset can't say
	// "non-empty"): a note with an empty pitches array is non-conformant.
	if (Array.isArray(value.pitches) && value.pitches.length === 0) {
		errors.push(
			`${where}.pitches: a "${value.type}" event requires at least one pitch`,
		);
	}
}

/**
 * Does `value` satisfy an `if` schema? The schema's only `if` is
 * `{ properties: { type: { const: "note" } } }`, so this checks each declared
 * `const` (and is permissive — a missing property does not match, mirroring
 * JSON-Schema `if` semantics for this discriminant shape).
 */
function matchesIf(value, ifSchema) {
	if (!ifSchema.properties) {
		return true;
	}
	for (const [key, condition] of Object.entries(ifSchema.properties)) {
		if (Object.hasOwn(condition, "const")) {
			if (value[key] !== condition.const) {
				return false;
			}
		}
	}
	return true;
}

/**
 * The three walker special cases (design §7), dispatched by `$defs` name:
 *   - `pitch`   → `step` must be a recognised note name (case-insensitive);
 *   - `handConfig` → `alters` keys are note names, values integers in −2..+2;
 *   - `tempo`   → `bpm` strict lower bound `bpm > 0`.
 */
function applySpecialCases(value, defName, path, errors) {
	if (defName === "pitch") {
		checkStep(value, path, errors);
	} else if (defName === "handConfig") {
		checkAlters(value, path, errors);
	} else if (defName === "tempo") {
		checkBpm(value, path, errors);
	}
}

/** `pitch.step` — a recognised note name, matched case-insensitively. */
function checkStep(pitch, path, errors) {
	if (typeof pitch.step === "string" && !isNoteName(pitch.step)) {
		errors.push(
			`${path}.step: ${show(
				pitch.step,
			)} is not a recognised note name (English C D E F G A B or Spanish do re mi fa sol la si)`,
		);
	}
}

/**
 * `handConfig.alters` — a map note-name → integer in −2..+2. Keys must be
 * recognised note names (case-insensitive); values must be integers in range.
 */
function checkAlters(handConfig, path, errors) {
	const alters = handConfig.alters;
	if (!isPlainObject(alters)) {
		return; // type already validated (or reported) by the generic walk.
	}
	for (const [key, alterValue] of Object.entries(alters)) {
		const altersPath = `${path}.alters`;
		if (!isNoteName(key)) {
			errors.push(
				`${altersPath}: ${show(
					key,
				)} is not a recognised note name (English C D E F G A B or Spanish do re mi fa sol la si)`,
			);
		}
		if (!Number.isInteger(alterValue)) {
			errors.push(
				`${altersPath}.${key}: ${show(
					alterValue,
				)} is not an integer alteration`,
			);
		} else if (alterValue < -2 || alterValue > 2) {
			errors.push(
				`${altersPath}.${key}: ${show(
					alterValue,
				)} is outside the allowed alteration range −2..+2`,
			);
		}
	}
}

/** `tempo.bpm` — the strict lower bound `bpm > 0`. */
function checkBpm(tempo, path, errors) {
	if (typeof tempo.bpm === "number" && !(tempo.bpm > 0)) {
		errors.push(`${path}.bpm: ${show(tempo.bpm)} must be greater than 0`);
	}
}

/**
 * Validate a raw song string against the song format.
 *
 * @param {string} rawString The author's raw `song` text.
 * @return {string[]} Human-readable, path-pointed error messages; `[]` when
 *                    the song is conformant.
 */
export default function validateSong(rawString) {
	let data;
	try {
		data = JSON.parse(rawString);
	} catch (error) {
		return [`Invalid JSON: ${error.message}`];
	}

	const errors = [];
	validateValue(data, songSchema, "", errors);
	return errors;
}
