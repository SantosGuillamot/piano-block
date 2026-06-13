/**
 * The inspector panel for the measure the selected event belongs to.
 *
 * Rendered inside `InspectorControls` only when an event is selected on the
 * canvas, this is the measure-level settings panel. A measure carries no
 * required common field — `{}` validates — and its members (the two optional
 * barlines and its staff-anchored standalone `annotations`) are all uncommon, so
 * the whole panel sits behind a `ToolsPanel` progressive disclosure, keeping the
 * surface shallow while still reaching the measure model.
 *
 * The panel is a pure controlled component: it holds no song state and emits the
 * next whole working `song` through `onChange` (the parent commits it). It edits
 * the resolved measure in place — splicing the next measure back through its
 * section → measures path — reusing the existing constrained `AnnotationList`
 * leaf editor and the `songModel` array helpers, so every emission stays
 * conformant by construction. The barline + annotation omit-when-unset rules keep
 * the emitted measure clean. **Remove measure** only signals intent through the
 * lifted `onRemoveMeasure(sectionIndex, measureIndex)` prop — the splice and the
 * selection-fallout are owned once in `edit.js`, shared with the Structure list.
 */
import {
	Button,
	PanelBody,
	SelectControl,
	TextControl,
	__experimentalToolsPanel as ToolsPanel,
	__experimentalToolsPanelItem as ToolsPanelItem,
} from "@wordpress/components";
import { __ } from "@wordpress/i18n";
import { AnnotationList } from "../AnnotationList.js";
import { omitFalsy } from "../emit.js";
import { BARLINES, NONE_OPTION, setMeasureAt } from "../songModel.js";

/** The two optional barline fields and their human-facing labels, disclosed. */
const BARLINE_FIELDS = [
	{ key: "barlineStart", label: __("Start barline", "piano-block") },
	{ key: "barlineEnd", label: __("End barline", "piano-block") },
];

/**
 * The inspector panel for the selected event's measure.
 *
 * @param {Object}   props
 * @param {Object}   props.song            The current working song object.
 * @param {Object}   props.selection       The resolved selection — the live
 *                                         `section` and `measure` with their
 *                                         `sectionIndex`/`measureIndex` coords.
 * @param {Function} props.onChange        Receives the next working song.
 * @param {Function} props.onRemoveMeasure Lifted: remove the measure at the coords.
 * @return {Object} The rendered Measure panel.
 */
export function MeasurePanel({ song, selection, onChange, onRemoveMeasure }) {
	const { measure, sectionIndex, measureIndex } = selection;

	/**
	 * Splice `nextMeasure` back into the whole `song` at the selection's measure
	 * coords and emit it. `setMeasureAt` dispatches by this panel's depth (measure),
	 * never by which coords are present, so the same resolved selection the parent
	 * also feeds the Note/Section panels still splices at the right level here.
	 */
	const emitMeasure = (nextMeasure) => {
		onChange(setMeasureAt(song, selection, nextMeasure));
	};

	/**
	 * Set the measure's optional `name`: a non-blank value sets the key, a blank
	 * one drops it so an emptied name leaves no empty husk in the round-trip
	 * (the same omit-when-empty idiom the barline fields follow).
	 */
	const changeName = (value) => {
		emitMeasure(omitFalsy(measure, "name", value));
	};

	/**
	 * Set a barline field: a falsy value (the empty option) drops the key,
	 * otherwise it is set to one of the schema's barline enums.
	 */
	const changeBarline = (field, value) => {
		emitMeasure(omitFalsy(measure, field, value));
	};

	return (
		<PanelBody title={__("Measure", "piano-block")} initialOpen>
			<TextControl
				label={__("Measure name", "piano-block")}
				value={measure.name ?? ""}
				onChange={changeName}
				__nextHasNoMarginBottom
			/>

			<ToolsPanel
				label={__("Advanced", "piano-block")}
				resetAll={() => {
					// Drop both barlines and the annotations in one emission, keeping
					// only the measure's hands (and any other members).
					const {
						barlineStart: _start,
						barlineEnd: _end,
						annotations: _annotations,
						...kept
					} = measure;
					emitMeasure(kept);
				}}
			>
				{BARLINE_FIELDS.map(({ key, label }) => (
					<ToolsPanelItem
						key={key}
						label={label}
						hasValue={() => Boolean(measure[key])}
						onDeselect={() => changeBarline(key, "")}
					>
						<SelectControl
							label={label}
							value={measure[key] ?? ""}
							options={[NONE_OPTION, ...BARLINES]}
							onChange={(value) => changeBarline(key, value)}
							__nextHasNoMarginBottom
						/>
					</ToolsPanelItem>
				))}

				<ToolsPanelItem
					label={__("Annotations", "piano-block")}
					hasValue={() => Array.isArray(measure.annotations)}
					onDeselect={() =>
						emitMeasure(omitFalsy(measure, "annotations", undefined))
					}
				>
					<AnnotationList
						annotations={measure.annotations}
						kind="standalone"
						onChange={(annotations) =>
							emitMeasure(
								omitFalsy(measure, "annotations", annotations ?? undefined),
							)
						}
					/>
				</ToolsPanelItem>
			</ToolsPanel>

			<Button
				variant="secondary"
				isDestructive
				onClick={() => onRemoveMeasure?.(sectionIndex, measureIndex)}
			>
				{__("Remove measure", "piano-block")}
			</Button>
		</PanelBody>
	);
}
