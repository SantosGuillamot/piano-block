/**
 * The per-song note-name system: which of the two spelling conventions —
 * English `C D E F G A B` or Spanish `do re mi fa sol la si` — a given song
 * writes its pitches in, the seven-name option list a `SelectControl` offers in
 * that system, and the rewrite that maps an existing `step` into it.
 *
 * The two systems are the closed two-token-per-letter vocabulary that
 * `normalizeStep` already owns; this module never redefines it. It only fixes,
 * per letter, the one *display* spelling each system prefers, so the editor can
 * present a single seven-entry list rather than the full fourteen tokens, and
 * keep a song consistently in one convention.
 *
 * Existing `step` spellings are preserved verbatim in the working object: a
 * pitch the author has not touched keeps whatever it was parsed as, even if it
 * mixes conventions. Only when the author edits a pitch's `step` does
 * `PitchEditor` (a later task) rewrite it through `stepInSystem`, pulling that
 * pitch into the song's inferred system.
 */
import { isNoteName, normalizeStep } from "../song/normalizeStep.js";

/**
 * Each system's seven display spellings, in canonical-letter order
 * (`C D E F G A B`). These are the exact strings stored into `step`; both map,
 * via `normalizeStep`, to the same canonical letters.
 */
const SYSTEMS = {
	english: ["C", "D", "E", "F", "G", "A", "B"],
	spanish: ["do", "re", "mi", "fa", "sol", "la", "si"],
};

/** The Spanish solfège tokens, lowercased — the discriminator for inference. */
const SPANISH_TOKENS = new Set(SYSTEMS.spanish);

/** Walk every pitch `step` in a parsed song, yielding each string in order. */
function* eachStep(value) {
	if (Array.isArray(value)) {
		for (const item of value) {
			yield* eachStep(item);
		}
	} else if (value && typeof value === "object") {
		if (typeof value.step === "string") {
			yield value.step;
		}
		for (const key of Object.keys(value)) {
			yield* eachStep(value[key]);
		}
	}
}

/**
 * Infer a song's note-name system from the spellings its pitches already use.
 * The rule is deliberately simple: Spanish if the song uses any Spanish-system
 * spelling, else English — so a brand-new song, a song with no pitches, and a
 * purely English song all resolve to English.
 *
 * @param {*} song The parsed song working object.
 * @return {"english"|"spanish"} The inferred system.
 */
export function inferNoteNameSystem(song) {
	for (const step of eachStep(song)) {
		if (isNoteName(step) && SPANISH_TOKENS.has(step.toLowerCase())) {
			return "spanish";
		}
	}
	return "english";
}

/**
 * The seven-name `SelectControl` option list for a system. Each `value` is the
 * exact display spelling stored into `step`; `label` is the same spelling.
 *
 * @param {"english"|"spanish"} system The note-name system.
 * @return {Array<{label: string, value: string}>} The ordered options.
 */
export function noteNameOptions(system) {
	const names = SYSTEMS[system] ?? SYSTEMS.english;
	return names.map((name) => ({ label: name, value: name }));
}

/**
 * The display spelling for an existing `step` in `system`: `step` is mapped to
 * its canonical letter, then to that system's spelling for the letter. An
 * unrecognised `step` falls back to the system's first name. Used when an
 * edited pitch's `step` is rewritten into the per-song system; idempotent.
 *
 * @param {*}                    step   The existing note-name token.
 * @param {"english"|"spanish"} system The target note-name system.
 * @return {string} The spelling of that note in `system`.
 */
export function stepInSystem(step, system) {
	const names = SYSTEMS[system] ?? SYSTEMS.english;
	const letter = normalizeStep(step);
	const index = letter ? "CDEFGAB".indexOf(letter) : -1;
	return index >= 0 ? names[index] : names[0];
}
