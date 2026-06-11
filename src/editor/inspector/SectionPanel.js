/**
 * The inspector panel for the section the selected event belongs to.
 *
 * Rendered inside `InspectorControls` only when an event is selected on the
 * canvas, this is the section-level settings panel. A section is a required
 * `measures` array plus the same four optional context members `defaults` carries
 * (`tempo`, `timeSignature`, `rightHand`, `leftHand`) — here acting as per-section
 * *overrides*. Those overrides are all uncommon, so the whole context sits behind
 * a `ToolsPanel` progressive disclosure, keeping the surface shallow while still
 * reaching the section's override model (Req 7, 8, 11; AC7, AC9, AC10).
 *
 * The panel is a pure controlled component: it holds no song state and emits the
 * next whole working `song` through `onChange` (the parent commits it). It reuses
 * the existing constrained `ContextEditor` leaf editor over the section's override
 * projection — rebuilding the section from its non-override keys (always keeping
 * `measures`) plus only the override keys the context still carries, the same
 * projection `SectionEditor` used — so every emission stays conformant by
 * construction and an unset override drops its key (clean round-trip).
 *
 * The structural **Add measure** and **Remove section** buttons only signal intent
 * through the lifted `onAddMeasure(sectionIndex)` / `onRemoveSection(sectionIndex)`
 * props — the splice and the selection-fallout are owned once in `edit.js` (the
 * single owner of `working` + `commit`). `song.sections` is `required` but unbounded
 * — a song with **zero** sections validates — so removing the only section is allowed
 * and needs no min-one guard. **Add measure** is the section's appender: the block
 * menu puts "Add before/after" only on measure rows, so a zero-measure section (which
 * arises when its last measure is removed) would otherwise be a dead end in the
 * visual editor; this button keeps a measure always re-seedable from the panel.
 */
import {
	Button,
	PanelBody,
	TextControl,
	__experimentalToolsPanel as ToolsPanel,
	__experimentalToolsPanelItem as ToolsPanelItem,
} from "@wordpress/components";
import { __ } from "@wordpress/i18n";
import { ContextEditor } from "../ContextEditor.js";
import { setSectionAt } from "../songModel.js";
import { omitFalsy } from "./emit.js";

/** The context override keys a section may carry alongside its `measures`. */
const OVERRIDE_KEYS = ["tempo", "timeSignature", "rightHand", "leftHand"];

/**
 * The section's own override members, projected as a context object for the
 * `ContextEditor` (its `measures` and any unknown keys are left out).
 *
 * @param {Object} section The section object.
 * @return {Object} The override-only context projection.
 */
function projectOverrides(section) {
	const overrides = {};
	for (const key of OVERRIDE_KEYS) {
		if (section[key] !== undefined) {
			overrides[key] = section[key];
		}
	}
	return overrides;
}

/**
 * The inspector panel for the selected event's section.
 *
 * @param {Object}   props
 * @param {Object}   props.song            The current working song object.
 * @param {Object}   props.selection       The resolved selection — the live
 *                                         `section` with its `sectionIndex` coord.
 * @param {Function} props.onChange        Receives the next working song.
 * @param {Function} props.onRemoveSection Lifted: remove the section at the index.
 * @param {Function} props.onAddMeasure    Lifted: append a measure to the section.
 * @return {Object} The rendered Section panel.
 */
export function SectionPanel({
	song,
	selection,
	onChange,
	onRemoveSection,
	onAddMeasure,
}) {
	const { section, sectionIndex } = selection;

	/**
	 * Splice `nextSection` back into the whole `song` at the selection's section
	 * coord and emit it. `setSectionAt` dispatches by this panel's depth (section),
	 * never by which coords are present, so the same resolved selection the parent
	 * also feeds the Note/Measure panels still splices at the right level here.
	 */
	const emitSection = (nextSection) => {
		onChange(setSectionAt(song, selection, nextSection));
	};

	/**
	 * Set the section's optional `name`: a non-blank value sets the key, a blank
	 * one drops it so an emptied name leaves no empty husk in the round-trip
	 * (the same omit-when-empty idiom the override keys follow).
	 */
	const changeName = (value) => {
		emitSection(omitFalsy(section, "name", value));
	};

	/**
	 * Rebuild the section from a next override context: keep its non-override keys
	 * (always `measures`) plus only the override keys the context still carries, so
	 * an unset override drops its key.
	 */
	const emitOverrides = (next) => {
		const { tempo, timeSignature, rightHand, leftHand, ...keep } = section;
		emitSection({ ...keep, ...next });
	};

	const overrides = projectOverrides(section);

	return (
		<PanelBody title={__("Section", "piano-block")} initialOpen>
			<TextControl
				label={__("Section name", "piano-block")}
				value={section.name ?? ""}
				onChange={changeName}
				__nextHasNoMarginBottom
			/>

			<ToolsPanel
				label={__("Advanced", "piano-block")}
				resetAll={() => {
					// Drop every override in one emission, keeping only the section's
					// non-override members (and `measures`).
					const { tempo, timeSignature, rightHand, leftHand, ...keep } =
						section;
					emitSection(keep);
				}}
			>
				<ToolsPanelItem
					label={__("Section overrides", "piano-block")}
					hasValue={() => Object.keys(overrides).length > 0}
					onDeselect={() => emitOverrides({})}
				>
					<ContextEditor
						context={overrides}
						heading={__("Section overrides", "piano-block")}
						onChange={emitOverrides}
					/>
				</ToolsPanelItem>
			</ToolsPanel>

			<Button variant="secondary" onClick={() => onAddMeasure?.(sectionIndex)}>
				{__("Add measure", "piano-block")}
			</Button>

			<Button
				variant="secondary"
				isDestructive
				onClick={() => onRemoveSection?.(sectionIndex)}
			>
				{__("Remove section", "piano-block")}
			</Button>
		</PanelBody>
	);
}
