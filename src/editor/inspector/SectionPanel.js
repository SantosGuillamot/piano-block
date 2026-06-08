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
 * The structural **Add section** / **Remove section** buttons only signal intent
 * through the lifted `onAddSection` / `onRemoveSection(sectionIndex)` props — the
 * splice and the selection-fallout are owned once in `edit.js` (the single owner of
 * `working` + `commit`), shared with the Structure list. `song.sections` is
 * `required` but unbounded — a song with **zero** sections validates — so removing
 * the only section is allowed and needs no min-one guard.
 */
import {
	Button,
	PanelBody,
	__experimentalToolsPanel as ToolsPanel,
	__experimentalToolsPanelItem as ToolsPanelItem,
} from "@wordpress/components";
import { __ } from "@wordpress/i18n";
import { ContextEditor } from "../ContextEditor.js";
import { replaceAt } from "../songModel.js";

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
 * @param {Function} props.onAddSection    Lifted: append a section.
 * @param {Function} props.onRemoveSection Lifted: remove the section at the index.
 * @return {Object} The rendered Section panel.
 */
export function SectionPanel({
	song,
	selection,
	onChange,
	onAddSection,
	onRemoveSection,
}) {
	const { section, sectionIndex } = selection;

	/** Splice `nextSection` back into the whole `song` at its index and emit it. */
	const emitSection = (nextSection) => {
		onChange({
			...song,
			sections: replaceAt(song.sections, sectionIndex, nextSection),
		});
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

			<Button variant="secondary" onClick={() => onAddSection?.()}>
				{__("Add section", "piano-block")}
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
