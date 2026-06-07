/**
 * Unit-test mock for `@wordpress/i18n`.
 *
 * `@wordpress/i18n` is externalized by the build and absent from
 * `node_modules`, so Jest maps it here. `__` is the only export the editor's
 * tested modules use; the mock returns the source string unchanged, which is
 * exactly the no-translation-loaded behavior of the real package.
 */
const __ = (text) => text;

module.exports = { __ };
