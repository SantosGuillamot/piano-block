/**
 * The visual editor's invalid state — what the author sees when the block's
 * `song` string is non-empty but does not conform to the format.
 *
 * The structured editor only ever edits a conformant working object; it cannot
 * safely parse and present a malformed song. So when the validator reports
 * errors, this state takes over: it surfaces the validator's own messages in an
 * error `Notice`, explains that the visual editor cannot edit a non-conformant
 * song, and offers a button to switch to the raw-JSON editor to fix it. Visual
 * editing resumes automatically once the song becomes valid again, because the
 * parent (`Edit`) re-derives `errors` from the string on every change.
 *
 * This state is purely presentational: it owns no state and decides nothing about
 * validity — the parent passes the already-computed `errors` and the
 * mode-switching callback.
 */
import { Button, Notice, __experimentalVStack as VStack } from "@wordpress/components";
import { __ } from "@wordpress/i18n";

/**
 * Render the invalid state.
 *
 * @param {Object}   props
 * @param {string[]} props.errors       The validator's messages (non-empty).
 * @param {Function} props.onEditAsJson Called to switch to the raw-JSON editor.
 * @return {Object} The rendered invalid state.
 */
export function InvalidState({ errors, onEditAsJson }) {
	return (
		<VStack>
			<Notice status="error" isDismissible={false}>
				<ul>
					{errors.map((message, index) => (
						// Validator messages have no stable identity beyond their
						// position; the list is short and rebuilt on every change.
						<li key={index}>{message}</li>
					))}
				</ul>
			</Notice>
			<Button variant="secondary" onClick={onEditAsJson} __next40pxDefaultSize>
				{__("Edit as JSON", "piano-block")}
			</Button>
		</VStack>
	);
}
