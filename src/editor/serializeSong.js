/**
 * The serialize-time conformance guard the visual editor commits through.
 *
 * The visual editor only ever edits a conformant working object — every
 * constrained control reuses the closed vocabularies and "new item" factories,
 * so the song stays conformant by construction. This module is the last,
 * defensive step before that object becomes the persisted `song` string: it
 * serializes the working object and runs the real `validateSong` on the result,
 * refusing to persist a non-conformant string. In normal operation the guard
 * ALWAYS passes; it exists only so a latent bug in some control (which could
 * otherwise silently persist a malformed song) surfaces as a developer warning
 * instead.
 *
 * Serialization is canonical `JSON.stringify`: the persisted string's
 * whitespace and key order are not those of any prior raw string. That is
 * accepted — visual-mode commits own the working object, and a switch back to
 * raw mode shows the re-serialized form.
 */
import validateSong from "../song/validate.js";

/**
 * Serialize a working object to its canonical `song` string.
 *
 * @param {Object} workingObject The conformant song working object.
 * @return {string} The serialized `song` string.
 */
export function serializeSong(workingObject) {
	return JSON.stringify(workingObject);
}

/**
 * Serialize and commit a working object, but only if the serialized string is
 * conformant. A conformant object is persisted via `onChangeSong`; a
 * non-conformant one (only possible from a latent control bug) is refused — it
 * is not persisted, and a developer warning is logged so the bug is observable.
 *
 * @param {Object}   workingObject The song working object to commit.
 * @param {Function} onChangeSong  Persists the serialized `song` string.
 */
export function commitSong(workingObject, onChangeSong) {
	const song = serializeSong(workingObject);
	const errors = validateSong(song);
	if (errors.length > 0) {
		// Unreachable in normal operation (the controls are conformant by
		// construction); a hit here means a latent control bug to fix.
		console.warn(
			"Piano Block: refused to persist a non-conformant song from the visual editor.",
			errors,
		);
		return;
	}
	onChangeSong(song);
}
