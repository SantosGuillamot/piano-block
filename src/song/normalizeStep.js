/**
 * The single shared home for the closed two-system note-name vocabulary and the
 * `step → canonical English letter` mapping.
 *
 * Both the validator (`validate.js`) and the renderer (`notation/`) need to know
 * the recognised note names and how to canonicalize them; encoding that
 * knowledge twice would let the two drift apart. So the 14-token equivalence
 * lives here ONCE — English `c d e f g a b` and Spanish `do re mi fa sol la si`,
 * lowercased, with each token mapping to its canonical UPPERCASE English letter
 * (`do→C re→D mi→E fa→F sol→G la→A si→B`; English letters map to their own
 * uppercase). No token collides across the two systems.
 *
 * This module only *exposes/reuses* the vocabulary; it does NOT change what the
 * validator accepts — `NOTE_NAMES` and `isNoteName` keep the validator's exact
 * semantics, and `validate.js` imports them from here.
 */

/**
 * Recognised token → canonical UPPERCASE English letter. The single source of
 * the English/Spanish equivalence; keys are lowercased so lookup
 * is case-insensitive once the input is lowercased.
 */
const STEP_TO_LETTER = {
	c: "C",
	d: "D",
	e: "E",
	f: "F",
	g: "G",
	a: "A",
	b: "B",
	do: "C",
	re: "D",
	mi: "E",
	fa: "F",
	sol: "G",
	la: "A",
	si: "B",
};

/**
 * The closed note-name vocabulary, lowercased — both systems. Derived from the
 * canonical map so the recognised tokens and their letters cannot diverge. The
 * validator consumes this `Set` for `isNoteName`.
 */
export const NOTE_NAMES = new Set(Object.keys(STEP_TO_LETTER));

/**
 * Is `key` a recognised note name? Matched case-insensitively against the closed
 * two-system vocabulary. Identical semantics to the validator's former private
 * helper.
 *
 * @param {*} key The candidate note name.
 * @return {boolean} `true` when `key` is a recognised note-name string.
 */
export const isNoteName = (key) =>
	typeof key === "string" && NOTE_NAMES.has(key.toLowerCase());

/**
 * Normalize a note-name token to its canonical UPPERCASE English letter,
 * case-insensitively (`do`/`Do`/`DO`→`C`; `sol`/`SOL`→`G`; English letters map
 * to their own uppercase). Returns `null` for an unrecognised or non-string
 * token.
 *
 * @param {*} step The note-name token to normalize.
 * @return {?string} The canonical uppercase letter, or `null` if unrecognised.
 */
export function normalizeStep(step) {
	if (typeof step !== "string") {
		return null;
	}
	return STEP_TO_LETTER[step.toLowerCase()] ?? null;
}
