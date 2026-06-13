/**
 * The leaf editor for a single pitch — its `step`, `octave` and optional
 * `alter`.
 *
 * `step` is edited through the per-song note-name dropdown, whose options are
 * already in the song's system (English `C…B` or Spanish `do…si`). So choosing a
 * name writes that exact display spelling, which is the design's "an edited pitch
 * normalizes to the per-song spelling". The currently-stored `step` may be a
 * different spelling or system, so the select shows it selected by mapping it
 * through the system (matching on its canonical letter) — but this is display
 * only: nothing rewrites the stored `step` until the author actually changes it,
 * keeping an untouched pitch's spelling verbatim through the round-trip.
 *
 * `octave` and `alter` are numeric inputs clamped to the format's bounds. Both
 * `step` and `octave` are required, so the emission always carries them; `alter`
 * defaults to natural, so it is emitted only when non-zero — a `0` is dropped to
 * keep the round-trip clean. The parent owns the pitch state and re-feeds the
 * emitted value; this component holds none.
 */
import {
	__experimentalNumberControl as NumberControl,
	SelectControl,
} from "@wordpress/components";
import { __ } from "@wordpress/i18n";
import { noteNameOptions, stepInSystem } from "./noteNames.js";
import {
	ALTER_MAX,
	ALTER_MIN,
	clampInt,
	OCTAVE_MAX,
	OCTAVE_MIN,
} from "./songModel.js";

/**
 * Edit a single pitch.
 *
 * @param {Object}              props
 * @param {Object}              props.pitch    The current pitch object.
 * @param {"english"|"spanish"} props.system   The per-song note-name system.
 * @param {Function}            props.onChange Receives the next pitch fragment.
 * @return {Object} The rendered pitch editor.
 */
export function PitchEditor({ pitch, system, onChange }) {
	// Display the stored step selected without rewriting it: map it through the
	// system (by canonical letter) so an untouched cross-system spelling still
	// shows the right option selected. The store keeps the original `pitch.step`.
	const displayedStep = stepInSystem(pitch.step, system);

	/** Emit a pitch from a leaf-field change, keeping `step`/`octave` present and
	 * including `alter` only when non-zero. */
	const emit = (next) => {
		const result = { step: next.step, octave: next.octave };
		if (next.alter) {
			result.alter = next.alter;
		}
		onChange(result);
	};

	return (
		<>
			<SelectControl
				label={__("Note", "piano-block")}
				value={displayedStep}
				options={noteNameOptions(system)}
				onChange={(step) => emit({ ...pitch, step })}
				__nextHasNoMarginBottom
				__next40pxDefaultSize
			/>
			<NumberControl
				label={__("Octave", "piano-block")}
				value={pitch.octave}
				min={OCTAVE_MIN}
				max={OCTAVE_MAX}
				step={1}
				onChange={(value) =>
					emit({ ...pitch, octave: clampInt(value, OCTAVE_MIN, OCTAVE_MAX) })
				}
				__next40pxDefaultSize
			/>
			<NumberControl
				label={__("Alteration", "piano-block")}
				value={pitch.alter ?? 0}
				min={ALTER_MIN}
				max={ALTER_MAX}
				step={1}
				onChange={(value) =>
					emit({ ...pitch, alter: clampInt(value, ALTER_MIN, ALTER_MAX) })
				}
				__next40pxDefaultSize
			/>
		</>
	);
}
