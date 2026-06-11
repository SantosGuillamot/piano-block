/**
 * Unit-test mock for `@wordpress/i18n`.
 *
 * `@wordpress/i18n` is externalized by the build and absent from
 * `node_modules`, so Jest maps it here. `__` returns the source string
 * unchanged, which is exactly the no-translation-loaded behavior of the real
 * package. `_x` does the same, dropping the disambiguation context (the context
 * never reaches the output in the real package either). `sprintf` performs the
 * same substitution the real export does — both the bare `%d`/`%s` forms and the
 * positional `%1$s`/`%2$d` forms — so a numbered or two-part label (e.g.
 * "Measure 3" or "Hello by Ada") renders the right text under test. `isRTL`
 * returns `false`, matching the real package when no RTL locale is loaded —
 * exactly the no-locale test default — so callers exercise the LTR branch (the
 * RTL branch is e2e/runtime-only, mirroring this mock's no-translation stance).
 */
const __ = (text) => text;

const _x = (text) => text;

const sprintf = (format, ...args) => {
	let index = 0;
	return String(format).replace(/%(?:(\d+)\$)?([ds])/g, (_match, position) =>
		String(position ? args[position - 1] : args[index++]),
	);
};

const isRTL = () => false;

module.exports = { __, _x, sprintf, isRTL };
