/**
 * The editor for a single section — its optional context overrides and its list
 * of measures.
 *
 * A section is a `context` (the same four optional members `defaults` carries —
 * `tempo`, `timeSignature`, `rightHand`, `leftHand` — each independently
 * present/absent, here acting as per-section *overrides*) plus a required
 * `measures` array. So the editor composes a `ContextEditor` over the section's
 * own override keys with a `MeasureList`: the context editor emits only the
 * override keys actually set, and the measure list emits the next `measures`
 * array, which the section always keeps (it is required, even when empty).
 *
 * Drilling into a measure is the SongEditor's concern, so `onOpenMeasure` is
 * forwarded straight through with the measure index. The parent owns the section
 * state and re-feeds the emitted value; this component holds none.
 */
import { __ } from "@wordpress/i18n";
import { ContextEditor } from "./ContextEditor.js";
import { MeasureList } from "./MeasureList.js";

/** The context override keys a section may carry alongside its `measures`. */
const OVERRIDE_KEYS = ["tempo", "timeSignature", "rightHand", "leftHand"];

/**
 * Edit a single section.
 *
 * @param {Object}              props
 * @param {Object}              props.section       The current section object.
 * @param {Function}            props.onChange      Receives the next section.
 * @param {Function}            props.onOpenMeasure Called with a measure's index
 *                                                  to open its editor.
 * @return {Object} The rendered section editor.
 */
export function SectionEditor({ section, onChange, onOpenMeasure }) {
	// The section's own override members, projected as a context object for the
	// `ContextEditor` (its `measures` and any unknown keys are left out).
	const overrides = {};
	for (const key of OVERRIDE_KEYS) {
		if (section[key] !== undefined) {
			overrides[key] = section[key];
		}
	}

	return (
		<div>
			<ContextEditor
				context={overrides}
				heading={__("Section overrides", "piano-block")}
				onChange={(next) => {
					// Rebuild the section from its non-override keys (always keeping
					// `measures`) plus only the override keys the context still carries.
					const { tempo, timeSignature, rightHand, leftHand, ...keep } =
						section;
					onChange({ ...keep, ...next });
				}}
			/>
			<MeasureList
				measures={section.measures}
				onChange={(measures) => onChange({ ...section, measures })}
				onOpenMeasure={onOpenMeasure}
			/>
		</div>
	);
}
