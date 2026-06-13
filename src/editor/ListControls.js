/**
 * The standalone "add" affordance every editable list reuses to append a new
 * item.
 *
 * The editor is built from several lists — pitches, annotations, hand-config
 * alterations — that all need the same append button. Rather than reinvent it per
 * list (and risk inconsistent labels or keyboard behavior), every list renders
 * this one affordance. Reordering is omitted in this version, so the per-row
 * move/remove bank is gone; each list now owns its own inline remove button.
 *
 * `AddButton` holds no business logic: the parent owns the song state and passes
 * the handler that actually mutates it.
 */
import { Button } from "@wordpress/components";
import { plus } from "@wordpress/icons";

/**
 * The standalone "add" affordance a list places at its end to append a new item.
 *
 * @param {Object}   props
 * @param {Function} props.onClick Called to append a new item.
 * @param {string}   props.label   The button's visible and accessible label.
 * @return {Object} The rendered add button.
 */
export function AddButton({ onClick, label }) {
	return (
		<Button variant="secondary" icon={plus} onClick={onClick}>
			{label}
		</Button>
	);
}
