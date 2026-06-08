/**
 * The inspector panel for the measure the selected event belongs to.
 *
 * Rendered inside `InspectorControls` only when an event is selected on the
 * canvas, this is the measure-level settings panel. A measure carries no
 * required common field — `{}` validates — and its members (the two optional
 * barlines and its staff-anchored standalone `annotations`) are all uncommon, so
 * the whole panel sits behind a `ToolsPanel` progressive disclosure, keeping the
 * surface shallow while still reaching the measure model (Req 7, 8, 11; AC7, AC9,
 * AC10).
 *
 * The panel is a pure controlled component: it holds no song state and emits the
 * next whole working `song` through `onChange` (the parent commits it). It edits
 * the resolved measure in place — splicing the next measure back through its
 * section → measures path — reusing the existing constrained `AnnotationList`
 * leaf editor and the `songModel` array helpers, so every emission stays
 * conformant by construction. The barline + annotation omit-when-unset rules are
 * reproduced from `MeasureEditor` (`BarlineControl` and the standalone
 * `AnnotationList` branch). Removing the measure signals up through `onRemove`,
 * which the parent pairs with clearing the now-stale selection.
 */
import {
	Button,
	PanelBody,
	SelectControl,
	__experimentalToolsPanel as ToolsPanel,
	__experimentalToolsPanelItem as ToolsPanelItem,
} from "@wordpress/components";
import { __ } from "@wordpress/i18n";
import { AnnotationList } from "../AnnotationList.js";
import { BARLINES, removeAt, replaceAt } from "../songModel.js";

/** The empty option a barline select offers to leave the barline unset. */
const NONE_OPTION = { label: __("None", "piano-block"), value: "" };

/** The two optional barline fields and their human-facing labels, disclosed. */
const BARLINE_FIELDS = [
	{ key: "barlineStart", label: __("Start barline", "piano-block") },
	{ key: "barlineEnd", label: __("End barline", "piano-block") },
];

/**
 * The inspector panel for the selected event's measure.
 *
 * @param {Object}   props
 * @param {Object}   props.song      The current working song object.
 * @param {Object}   props.selection The resolved selection — the live `section`
 *                                   and `measure` with their `sectionIndex`/
 *                                   `measureIndex` coords.
 * @param {Function} props.onChange  Receives the next working song.
 * @param {Function} props.onRemove  Called to remove the selected measure.
 * @return {Object} The rendered Measure panel.
 */
export function MeasurePanel({ song, selection, onChange, onRemove }) {
	const { section, measure, sectionIndex, measureIndex } = selection;

	/**
	 * Splice `nextMeasure` back into the whole `song` at the selection's path and
	 * emit it — the section → measures chain, every level rebuilt immutably
	 * through `replaceAt`.
	 */
	const emitMeasure = (nextMeasure) => {
		const nextMeasures = replaceAt(section.measures, measureIndex, nextMeasure);
		const nextSection = { ...section, measures: nextMeasures };
		onChange({
			...song,
			sections: replaceAt(song.sections, sectionIndex, nextSection),
		});
	};

	/**
	 * Remove the selected measure from its section and emit the next whole `song`,
	 * then signal the parent so it clears the now-stale selection. A section's
	 * `measures` is required but may be empty, so removing the last measure leaves
	 * `measures: []`, which still validates.
	 */
	const removeMeasure = () => {
		const nextMeasures = removeAt(section.measures, measureIndex);
		const nextSection = { ...section, measures: nextMeasures };
		onChange({
			...song,
			sections: replaceAt(song.sections, sectionIndex, nextSection),
		});
		onRemove?.();
	};

	/**
	 * Set a barline field: a falsy value (the empty option) drops the key,
	 * otherwise it is set to one of the schema's barline enums.
	 */
	const changeBarline = (field, value) => {
		if (value) {
			emitMeasure({ ...measure, [field]: value });
			return;
		}
		const { [field]: _dropped, ...rest } = measure;
		emitMeasure(rest);
	};

	return (
		<PanelBody title={__("Measure", "piano-block")} initialOpen>
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
					onDeselect={() => {
						const { annotations: _dropped, ...rest } = measure;
						emitMeasure(rest);
					}}
				>
					<AnnotationList
						annotations={measure.annotations}
						kind="standalone"
						onChange={(annotations) => {
							if (annotations === undefined) {
								const { annotations: _dropped, ...rest } = measure;
								emitMeasure(rest);
								return;
							}
							emitMeasure({ ...measure, annotations });
						}}
					/>
				</ToolsPanelItem>
			</ToolsPanel>

			<Button variant="secondary" isDestructive onClick={removeMeasure}>
				{__("Remove measure", "piano-block")}
			</Button>
		</PanelBody>
	);
}
