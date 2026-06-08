/**
 * Shared emit helper for the canvas-first inspector panels.
 *
 * Every panel edits one slice of the whole working `song` and emits the whole
 * song back up (the parent runs it through `commitSong`). An optional block —
 * `metadata`, `defaults`, a section's overrides — must clear its key when the
 * author empties it, so an untouched-then-cleared block leaves no empty husk in
 * the round-trip. This is the same rule the old `SongOverview.emitBlock` applied;
 * it is lifted here so the panels share one implementation.
 */

/**
 * Emit the song with `key` set to `value`, dropping the key when `value` has no
 * set fields so an emptied optional block clears its key.
 *
 * @param {Object}   song     The current song object.
 * @param {string}   key      The optional block being set (`metadata`/`defaults`).
 * @param {Object}   value    The block's next value.
 * @param {Function} onChange Receives the next song object.
 */
export function emitBlock(song, key, value, onChange) {
	const next = { ...song };
	if (value && Object.keys(value).length > 0) {
		next[key] = value;
	} else {
		delete next[key];
	}
	onChange(next);
}
