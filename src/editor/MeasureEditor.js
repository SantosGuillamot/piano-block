/**
 * The editor for a single measure — its two optional barlines, its two hands of
 * events, and its measure-level standalone annotations.
 *
 * A measure carries five optional members and is conformant even when empty
 * (`{}` validates). So every member here follows the same omit-when-unset rule
 * the leaf editors use: each barline is a `SelectControl` whose empty option
 * drops the key; each hand is an `EventList` that emits `undefined` when its last
 * row is removed, at which point this editor drops the hand key; and the
 * standalone `AnnotationList` likewise emits `undefined` when emptied, dropping
 * the `annotations` key. The result is a measure object carrying only the members
 * the author has actually set.
 *
 * Drilling into a single event (its chord pitches and event annotations) is the
 * SongEditor's concern, so each hand's `onDrillIn` is forwarded up tagged with
 * the hand it came from. The parent owns the measure state and re-feeds the
 * emitted value; this component holds none.
 */
import { SelectControl } from "@wordpress/components";
import { __ } from "@wordpress/i18n";
import { AnnotationList } from "./AnnotationList.js";
import { EventList } from "./EventList.js";
import { BARLINES } from "./songModel.js";

/** The empty option a barline select offers to leave the barline unset. */
const NONE_OPTION = { label: __("None", "piano-block"), value: "" };

/**
 * One barline select. A falsy value (the empty option) drops the key; a chosen
 * value is one of the schema's barline enums.
 *
 * @param {Object}   props
 * @param {Object}   props.measure  The current measure object.
 * @param {string}   props.field    The barline key (`barlineStart`/`barlineEnd`).
 * @param {string}   props.label    The select's accessible label.
 * @param {Function} props.onChange Receives the next measure object.
 * @return {Object} The rendered barline select.
 */
function BarlineControl({ measure, field, label, onChange }) {
	return (
		<SelectControl
			label={label}
			value={measure[field] ?? ""}
			options={[NONE_OPTION, ...BARLINES]}
			onChange={(value) => {
				if (value) {
					onChange({ ...measure, [field]: value });
					return;
				}
				const { [field]: _dropped, ...rest } = measure;
				onChange(rest);
			}}
			__nextHasNoMarginBottom
		/>
	);
}

/**
 * Edit a single measure.
 *
 * @param {Object}              props
 * @param {Object}              props.measure    The current measure object.
 * @param {"english"|"spanish"} props.system     The per-song note-name system.
 * @param {Function}            props.onChange   Receives the next measure.
 * @param {Function}            [props.onDrillIn] Called with `(hand, index)` to
 *                                                open one event's detail editor.
 * @return {Object} The rendered measure editor.
 */
export function MeasureEditor({ measure, system, onChange, onDrillIn }) {
	/**
	 * Emit a hand's next events array, dropping the hand key when the list
	 * empties (the `EventList` signals an emptied list with `undefined`).
	 */
	const changeHand = (hand, next) => {
		if (next === undefined) {
			const { [hand]: _dropped, ...rest } = measure;
			onChange(rest);
			return;
		}
		onChange({ ...measure, [hand]: next });
	};

	return (
		<div>
			<BarlineControl
				measure={measure}
				field="barlineStart"
				label={__("Start barline", "piano-block")}
				onChange={onChange}
			/>
			<BarlineControl
				measure={measure}
				field="barlineEnd"
				label={__("End barline", "piano-block")}
				onChange={onChange}
			/>
			<EventList
				events={measure.rightHand}
				system={system}
				label={__("Right hand", "piano-block")}
				onChange={(next) => changeHand("rightHand", next)}
				onDrillIn={(index) => onDrillIn?.("rightHand", index)}
			/>
			<EventList
				events={measure.leftHand}
				system={system}
				label={__("Left hand", "piano-block")}
				onChange={(next) => changeHand("leftHand", next)}
				onDrillIn={(index) => onDrillIn?.("leftHand", index)}
			/>
			<AnnotationList
				annotations={measure.annotations}
				kind="standalone"
				onChange={(next) => {
					if (next === undefined) {
						const { annotations: _dropped, ...rest } = measure;
						onChange(rest);
						return;
					}
					onChange({ ...measure, annotations: next });
				}}
			/>
		</div>
	);
}
