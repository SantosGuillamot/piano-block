/**
 * Unit-test mock for `@wordpress/interactivity`.
 *
 * The real package registers a store against the WordPress runtime and wires
 * reactive context/element access to living DOM nodes. For unit tests we need
 * none of that: we just want to call the store methods directly with controlled
 * context and element state. This mock:
 *
 * - Captures the store definition passed to `store()` and returns it via
 *   `getRegisteredStore()` so tests can invoke actions/callbacks by name.
 * - Provides `__setContext(ctx)` / `getContext()` / `__setElement(el)` /
 *   `getElement()` helpers so tests can seed per-invocation state before
 *   calling a store method.
 *
 * None of this is reactive — tests call methods synchronously and inspect the
 * resulting mutations directly.
 */

/** The accumulated store definitions, keyed by namespace. */
const stores = {};

/**
 * Mock implementation of `store()`. Merges the definition into the namespace's
 * accumulated store and returns it (mirrors the real API's return of the merged
 * store object).
 *
 * @param {string} namespace
 * @param {object} definition
 * @return {object} The merged store definition for this namespace.
 */
const store = ( namespace, definition ) => {
	stores[ namespace ] = stores[ namespace ] ?? {};
	const target = stores[ namespace ];
	for ( const [ section, methods ] of Object.entries( definition ) ) {
		target[ section ] = { ...( target[ section ] ?? {} ), ...methods };
	}
	return target;
};

/**
 * Retrieve the full captured store for a namespace.
 *
 * @param {string} namespace
 * @return {object|undefined}
 */
const getRegisteredStore = ( namespace ) => stores[ namespace ];

/**
 * Reset all captured stores. Call between tests to avoid state leaking.
 */
const __resetStores = () => {
	for ( const key of Object.keys( stores ) ) {
		delete stores[ key ];
	}
};

// ── Per-call context / element state ─────────────────────────────────────────

let _context = {};
let _element = { ref: null };

/** Seed the context that `getContext()` returns. */
const __setContext = ( ctx ) => {
	_context = ctx;
};

/** Read the per-call context. */
const getContext = () => _context;

/** Seed the element that `getElement()` returns. */
const __setElement = ( el ) => {
	_element = el;
};

/** Read the per-call element. */
const getElement = () => _element;

module.exports = {
	store,
	getContext,
	getElement,
	getRegisteredStore,
	__resetStores,
	__setContext,
	__setElement,
};
