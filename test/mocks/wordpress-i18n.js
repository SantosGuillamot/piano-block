/**
 * Unit-test mock for `@wordpress/i18n`.
 *
 * `@wordpress/i18n` is externalized by the build and absent from
 * `node_modules`, so Jest maps it here. `__` returns the source string
 * unchanged, which is exactly the no-translation-loaded behavior of the real
 * package. `sprintf` performs the same `%d`/`%s` substitution the real export
 * does, so a numbered label (e.g. "Measure 3") renders the right text under
 * test.
 */
const __ = (text) => text;

const sprintf = (format, ...args) => {
	let index = 0;
	return String(format).replace(/%[ds]/g, () => String(args[index++]));
};

module.exports = { __, sprintf };
