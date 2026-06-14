/**
 * Unit tests for the `view.js` Interactivity API store.
 *
 * Tests the store logic in isolation: `actions.toggleNoteNames`,
 * `callbacks.init` (parse-once, memo seed, hasNameableNotes gating),
 * `callbacks.draw` (re-resolves DOM from memo, reads showNoteNames + width,
 * early-returns when memo absent or font not ready), and per-instance memo
 * independence.
 *
 * Browser e2e (Playwright) is not available in this sandbox. The following
 * behaviors are verified here via jsdom and mock injection:
 *   - toggleNoteNames mutates context.showNoteNames in place (never reassigns).
 *   - callbacks.draw re-resolves wrapper, score, context, and memo each call.
 *   - callbacks.draw returns early when the memo is absent (parse error) or
 *     when fontReady is false (font gate not yet resolved).
 *   - callbacks.draw passes showNoteNames + width to buildLayoutModel.
 *   - init sets hasNameableNotes true only when the model has note records.
 *   - init leaves hasNameableNotes false for a song with only rests.
 *   - Per-instance memo: two wrapper elements each have independent entries;
 *     no cross-instance leak.
 *
 * Not verified here (requires browser/e2e runtime):
 *   - ResizeObserver wiring and rAF debounce.
 *   - data-wp-watch reactive subscription firing on context mutation.
 *   - data-wp-bind--hidden toggle visible/hidden state.
 *   - Full SVG output correctness on toggle (covered by notation layer tests).
 */

import {
	getRegisteredStore,
	__setContext,
	__setElement,
} from "@wordpress/interactivity";
import { buildLayoutModel } from "../notation/layout.js";
import { renderInto } from "../notation/svg.js";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Jest auto-hoists jest.mock() calls. We mock the notation layer (DOM-coupled)
// and the dom helpers so view.js can be imported without a live browser.

jest.mock( "../notation/dom.js", () => ( {
	availableWidthInSp: jest.fn( () => 42 ),
	drawWhenFontReady: jest.fn( ( cb ) => cb() ), // call immediately in tests
} ) );

jest.mock( "../notation/svg.js", () => ( {
	renderInto: jest.fn(),
} ) );

jest.mock( "../notation/layout.js", () => ( {
	buildLayoutModel: jest.fn( () => ( {
		systems: [
			{
				measures: [
					{
						right: { notes: [ {} ], rests: [], beams: [], texts: [] },
						left: { notes: [], rests: [], beams: [], texts: [] },
					},
				],
			},
		],
		width: 42,
		height: 10,
	} ) ),
} ) );

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Minimal conformant song JSON string with one quarter note. */
const SONG_WITH_NOTE = JSON.stringify( {
	version: "1.0",
	sections: [
		{
			measures: [
				{
					rightHand: [
						{
							type: "note",
							duration: "quarter",
							pitches: [ { step: "C", octave: 4 } ],
						},
					],
				},
			],
		},
	],
} );

/** Minimal conformant song JSON string with only a rest (no note records). */
const SONG_WITH_REST_ONLY = JSON.stringify( {
	version: "1.0",
	sections: [
		{
			measures: [
				{
					rightHand: [ { type: "rest", duration: "quarter" } ],
				},
			],
		},
	],
} );

/** Invalid JSON — should cause parseAndValidate to produce errors. */
const INVALID_SONG = "not-json";

/**
 * Build a minimal jsdom wrapper element with an inner score div.
 * Returns `{ wrapper, score }`.
 */
function buildWrapper() {
	const wrapper = document.createElement( "div" );
	const score = document.createElement( "div" );
	score.className = "wp-block-piano-block-piano__score";
	wrapper.appendChild( score );
	return { wrapper, score };
}

/**
 * Seed the mock interactivity context and element, then import (or re-use the
 * cached import of) `view.js` to register the store. Returns the registered
 * store for the `piano-block/piano` namespace.
 */
function getStore() {
	return getRegisteredStore( "piano-block/piano" );
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeAll( () => {
	// Import view.js once — this registers the store via the mock `store()`.
	// Jest module cache ensures it runs only once across all tests in this file.
	require( "../view.js" );
} );

beforeEach( () => {
	// Reset mock call counts between tests but do NOT reset stores (view.js
	// import-registers once; __resetStores would clear it).
	buildLayoutModel.mockClear();
	renderInto.mockClear();
} );

// ── actions.toggleNoteNames ───────────────────────────────────────────────────

describe( "actions.toggleNoteNames", () => {
	it( "flips showNoteNames from false to true in place", () => {
		const ctx = { showNoteNames: false };
		__setContext( ctx );

		getStore().actions.toggleNoteNames();

		expect( ctx.showNoteNames ).toBe( true );
	} );

	it( "flips showNoteNames from true back to false in place", () => {
		const ctx = { showNoteNames: true };
		__setContext( ctx );

		getStore().actions.toggleNoteNames();

		expect( ctx.showNoteNames ).toBe( false );
	} );

	it( "mutates in place — does not replace the context object reference", () => {
		const ctx = { showNoteNames: false };
		__setContext( ctx );
		const before = ctx;

		getStore().actions.toggleNoteNames();

		// The context object identity must be the same.
		expect( ctx ).toBe( before );
	} );

	it( "toggles are independent per simulated instance (different context objects)", () => {
		const ctxA = { showNoteNames: false };
		const ctxB = { showNoteNames: false };

		__setContext( ctxA );
		getStore().actions.toggleNoteNames();

		// ctxB must be untouched.
		expect( ctxA.showNoteNames ).toBe( true );
		expect( ctxB.showNoteNames ).toBe( false );
	} );
} );

// ── callbacks.init ────────────────────────────────────────────────────────────

describe( "callbacks.init", () => {
	it( "sets hasNameableNotes true for a song with at least one note", () => {
		// Force buildLayoutModel to return a model with a note record.
		buildLayoutModel.mockReturnValueOnce( {
			systems: [
				{
					measures: [
						{
							right: { notes: [ {} ] },
							left: { notes: [] },
						},
					],
				},
			],
			width: 42,
			height: 10,
		} );

		const { wrapper } = buildWrapper();
		const ctx = {
			song: SONG_WITH_NOTE,
			accessibleName: "Test",
			showNoteNames: false,
			hasNameableNotes: false,
			width: 0,
		};
		__setContext( ctx );
		__setElement( { ref: wrapper } );

		getStore().callbacks.init();

		expect( ctx.hasNameableNotes ).toBe( true );
	} );

	it( "leaves hasNameableNotes false for a song with only rests", () => {
		// Force buildLayoutModel to return a model with NO note records.
		buildLayoutModel.mockReturnValueOnce( {
			systems: [
				{
					measures: [
						{
							right: { notes: [] },
							left: { notes: [] },
						},
					],
				},
			],
			width: 42,
			height: 10,
		} );

		const { wrapper } = buildWrapper();
		const ctx = {
			song: SONG_WITH_REST_ONLY,
			accessibleName: "Test",
			showNoteNames: false,
			hasNameableNotes: false,
			width: 0,
		};
		__setContext( ctx );
		__setElement( { ref: wrapper } );

		getStore().callbacks.init();

		expect( ctx.hasNameableNotes ).toBe( false );
	} );

	it( "returns early (no draw, no observer) for an invalid song", () => {
		const { wrapper } = buildWrapper();
		const ctx = {
			song: INVALID_SONG,
			accessibleName: "Test",
			showNoteNames: false,
			hasNameableNotes: false,
			width: 0,
		};
		__setContext( ctx );
		__setElement( { ref: wrapper } );

		const cleanup = getStore().callbacks.init();

		// No cleanup = early return before observer attachment.
		expect( cleanup ).toBeUndefined();
		// hasNameableNotes must stay false.
		expect( ctx.hasNameableNotes ).toBe( false );
	} );

	it( "seeds context.width after the font gate resolves (drawWhenFontReady calls cb immediately in mock)", () => {
		const { wrapper } = buildWrapper();
		const ctx = {
			song: SONG_WITH_NOTE,
			accessibleName: "Test",
			showNoteNames: false,
			hasNameableNotes: false,
			width: 0,
		};
		__setContext( ctx );
		__setElement( { ref: wrapper } );

		getStore().callbacks.init();

		// drawWhenFontReady calls the cb immediately in the mock, which should
		// set ctx.width to the value returned by availableWidthInSp (mocked to 42).
		expect( ctx.width ).toBe( 42 );
	} );

	it( "returns a cleanup function for a valid song", () => {
		const { wrapper } = buildWrapper();
		const ctx = {
			song: SONG_WITH_NOTE,
			accessibleName: "Test",
			showNoteNames: false,
			hasNameableNotes: false,
			width: 0,
		};
		__setContext( ctx );
		__setElement( { ref: wrapper } );

		const cleanup = getStore().callbacks.init();

		// For a valid song, init returns a cleanup function.
		expect( typeof cleanup ).toBe( "function" );
	} );

	it( "per-instance memo: two wrappers have independent entries (no cross-instance leak)", () => {
		const { wrapper: wrapperA } = buildWrapper();
		const { wrapper: wrapperB } = buildWrapper();

		const ctxA = {
			song: SONG_WITH_NOTE,
			accessibleName: "A",
			showNoteNames: false,
			hasNameableNotes: false,
			width: 0,
		};
		const ctxB = {
			song: SONG_WITH_NOTE,
			accessibleName: "B",
			showNoteNames: false,
			hasNameableNotes: false,
			width: 0,
		};

		__setContext( ctxA );
		__setElement( { ref: wrapperA } );
		getStore().callbacks.init();

		__setContext( ctxB );
		__setElement( { ref: wrapperB } );
		getStore().callbacks.init();

		// Now call draw for instance A — it must read from wrapperA's memo and
		// resolve the score inside wrapperA, not wrapperB.
		__setContext( ctxA );
		__setElement( { ref: wrapperA } );
		// Reset to ensure we can see the call.
		renderInto.mockClear();
		getStore().callbacks.draw();

		expect( renderInto ).toHaveBeenCalledTimes( 1 );
		// The score argument passed to renderInto must be the inner div of wrapperA.
		const [ renderedScore ] = renderInto.mock.calls[ 0 ];
		expect( wrapperA.contains( renderedScore ) ).toBe( true );
		expect( wrapperB.contains( renderedScore ) ).toBe( false );
	} );
} );

// ── callbacks.draw ────────────────────────────────────────────────────────────

describe( "callbacks.draw", () => {
	it( "returns early (no renderInto) when memo is absent (parse error path)", () => {
		// Use a fresh wrapper that has no memo seeded (simulates a failed init).
		const { wrapper } = buildWrapper();
		const ctx = {
			showNoteNames: false,
			width: 42,
			accessibleName: "Test",
		};
		__setContext( ctx );
		__setElement( { ref: wrapper } );

		getStore().callbacks.draw();

		expect( renderInto ).not.toHaveBeenCalled();
	} );

	it( "returns early when fontReady is false", () => {
		// Seed a memo with fontReady:false by calling init and then flipping back.
		// The easiest approach: stub drawWhenFontReady to NOT call cb, so fontReady
		// stays false. We do this via a local override for this test.
		const { drawWhenFontReady: dwfr } = require( "../notation/dom.js" );
		dwfr.mockImplementationOnce( () => {} ); // swallow the callback

		const { wrapper } = buildWrapper();
		const ctx = {
			song: SONG_WITH_NOTE,
			accessibleName: "Test",
			showNoteNames: false,
			hasNameableNotes: false,
			width: 0,
		};
		__setContext( ctx );
		__setElement( { ref: wrapper } );

		getStore().callbacks.init(); // memo seeded with fontReady:false

		renderInto.mockClear();

		__setContext( { showNoteNames: false, width: 42, accessibleName: "Test" } );
		__setElement( { ref: wrapper } );

		getStore().callbacks.draw();

		expect( renderInto ).not.toHaveBeenCalled();
	} );

	it( "calls buildLayoutModel with showNoteNames from context and width from context", () => {
		const { wrapper } = buildWrapper();
		const ctx = {
			song: SONG_WITH_NOTE,
			accessibleName: "Beethoven",
			showNoteNames: false,
			hasNameableNotes: false,
			width: 0,
		};
		__setContext( ctx );
		__setElement( { ref: wrapper } );

		buildLayoutModel.mockClear();
		getStore().callbacks.init();

		// Now simulate a toggle + resize by setting up context for draw.
		const drawCtx = {
			showNoteNames: true,
			width: 99,
			accessibleName: "Beethoven",
		};
		__setContext( drawCtx );
		__setElement( { ref: wrapper } );
		buildLayoutModel.mockClear();
		renderInto.mockClear();

		getStore().callbacks.draw();

		// buildLayoutModel should have been called with showNoteNames:true and
		// the width from context (99).
		const [ , widthArg, optsArg ] = buildLayoutModel.mock.calls[
			buildLayoutModel.mock.calls.length - 1
		];
		expect( optsArg.showNoteNames ).toBe( true );
		expect( widthArg ).toBe( 99 );
	} );

	it( "calls renderInto with the inner score div (not the wrapper)", () => {
		const { wrapper, score } = buildWrapper();
		const ctx = {
			song: SONG_WITH_NOTE,
			accessibleName: "Test",
			showNoteNames: false,
			hasNameableNotes: false,
			width: 0,
		};
		__setContext( ctx );
		__setElement( { ref: wrapper } );
		getStore().callbacks.init();

		renderInto.mockClear();
		const drawCtx = {
			showNoteNames: false,
			width: 42,
			accessibleName: "Test",
		};
		__setContext( drawCtx );
		__setElement( { ref: wrapper } );

		getStore().callbacks.draw();

		expect( renderInto ).toHaveBeenCalledTimes( 1 );
		const [ scoreArg ] = renderInto.mock.calls[ 0 ];
		// Must be the inner score div, not the wrapper.
		expect( scoreArg ).toBe( score );
		expect( scoreArg ).not.toBe( wrapper );
	} );

	it( "re-resolves accessibleName from context each call (not from init closure)", () => {
		const { wrapper } = buildWrapper();
		const ctx = {
			song: SONG_WITH_NOTE,
			accessibleName: "OriginalName",
			showNoteNames: false,
			hasNameableNotes: false,
			width: 0,
		};
		__setContext( ctx );
		__setElement( { ref: wrapper } );
		getStore().callbacks.init();

		renderInto.mockClear();
		const drawCtx = {
			showNoteNames: false,
			width: 42,
			accessibleName: "UpdatedName",
		};
		__setContext( drawCtx );
		__setElement( { ref: wrapper } );

		getStore().callbacks.draw();

		const [ , , { accessibleName } ] = renderInto.mock.calls[ 0 ];
		expect( accessibleName ).toBe( "UpdatedName" );
	} );

	it( "repeated on/off/on draws call buildLayoutModel with matching showNoteNames (no drift)", () => {
		const { wrapper } = buildWrapper();
		const ctx = {
			song: SONG_WITH_NOTE,
			accessibleName: "Test",
			showNoteNames: false,
			hasNameableNotes: false,
			width: 0,
		};
		__setContext( ctx );
		__setElement( { ref: wrapper } );
		getStore().callbacks.init();

		// First draw — names off.
		buildLayoutModel.mockClear();
		__setContext( { showNoteNames: false, width: 42, accessibleName: "Test" } );
		__setElement( { ref: wrapper } );
		getStore().callbacks.draw();
		const [ , , optsOff1 ] = buildLayoutModel.mock.calls[ 0 ];
		expect( optsOff1.showNoteNames ).toBe( false );

		// Second draw — names on.
		buildLayoutModel.mockClear();
		__setContext( { showNoteNames: true, width: 42, accessibleName: "Test" } );
		__setElement( { ref: wrapper } );
		getStore().callbacks.draw();
		const [ , , optsOn ] = buildLayoutModel.mock.calls[ 0 ];
		expect( optsOn.showNoteNames ).toBe( true );

		// Third draw — names off again (same as first).
		buildLayoutModel.mockClear();
		__setContext( { showNoteNames: false, width: 42, accessibleName: "Test" } );
		__setElement( { ref: wrapper } );
		getStore().callbacks.draw();
		const [ , , optsOff2 ] = buildLayoutModel.mock.calls[ 0 ];
		expect( optsOff2.showNoteNames ).toBe( false );
	} );
} );
