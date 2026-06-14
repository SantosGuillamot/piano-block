/**
 * The leaf editor for a single free-text annotation — the one editor shared by
 * both annotation kinds.
 *
 * An annotation comes in two shapes that differ only by one field: an
 * event-anchored annotation carries `text` and `placement` (it is positioned by
 * its host event's hand and beat), while a standalone measure annotation also
 * carries a `staff`, because it is unanchored and must say which staff it sits
 * on. Every field either kind carries is REQUIRED by the schema, so — unlike the
 * optional-field leaf editors — this control never drops a key: it always emits
 * a fully-required object, with an empty `text` kept as a conformant empty
 * string rather than an absent field. The parent owns the annotation state and
 * re-feeds the emitted value; this component holds none.
 */
import { SelectControl, TextareaControl } from "@wordpress/components";
import { __ } from "@wordpress/i18n";
import { PLACEMENTS, STAVES } from "./songModel.js";

/**
 * Edit a single annotation.
 *
 * @param {Object}   props
 * @param {Object}   props.annotation The current annotation object.
 * @param {string}   props.kind       `"event"` or `"standalone"`.
 * @param {Function} props.onChange   Receives the next fully-required annotation.
 * @return {Object} The rendered annotation editor.
 */
export function AnnotationEditor({ annotation, kind, onChange }) {
	return (
		<>
			<TextareaControl
				label={__("Text", "piano-block")}
				value={annotation.text ?? ""}
				onChange={(text) => onChange({ ...annotation, text })}
				__nextHasNoMarginBottom
				__next40pxDefaultSize
			/>
			<SelectControl
				label={__("Placement", "piano-block")}
				value={annotation.placement}
				options={PLACEMENTS}
				onChange={(placement) => onChange({ ...annotation, placement })}
				__nextHasNoMarginBottom
				__next40pxDefaultSize
			/>
			{kind === "standalone" ? (
				<SelectControl
					label={__("Staff", "piano-block")}
					value={annotation.staff}
					options={STAVES}
					onChange={(staff) => onChange({ ...annotation, staff })}
					__nextHasNoMarginBottom
					__next40pxDefaultSize
				/>
			) : null}
		</>
	);
}
