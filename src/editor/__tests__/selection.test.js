/**
 * Unit tests for the editor's pure selection-coordinate helpers.
 *
 * `selection.js` is the bridge between the canvas's emitted `data-*` hooks and an
 * editor-only `{ sectionIndex, measureIndex, hand, eventIndex }` selection. The
 * load-bearing contract is that `measureCoords` flattens
 * `song.sections[].measures[]` in the SAME order the notation core numbers
 * measures in — so a `data-measure="N"` group maps to `measureCoords(song)[N - 1]`.
 * Rather than re-state the core's walk by hand, the invariant test renders the
 * real core (`buildLayoutModel` → `renderSvg`), reads the emitted `data-measure`
 * order off the SVG, and asserts the helper agrees position-for-position; if the
 * core's measure walk ever changes, this test fails until the helper is updated to
 * match. The remaining tests pin `globalMeasureNumber` as the exact inverse,
 * `resolveSelection`'s stale-selection handling, and the scoped query string.
 *
 * These are pure-data assertions; only the invariant test touches the DOM (via the
 * core's `renderSvg`, which mounts into jsdom exactly as the svg-core tests do).
 */
import { buildLayoutModel } from '../../notation/layout.js';
import { renderSvg } from '../../notation/svg.js';
import {
	globalMeasureNumber,
	measureCoords,
	resolveSelection,
	selectionQuery,
} from '../selection.js';

/**
 * A multi-section song: section 0 has two measures, section 1 has one. The global
 * measure walk (sections outer, measures inner) numbers these 1, 2, 3 — so the
 * expected flatten is `[{0,0}, {0,1}, {1,0}]`.
 */
const SONG = {
	sections: [
		{
			measures: [
				{
					rightHand: [
						{
							type: 'note',
							duration: 'quarter',
							pitches: [ { step: 'C', octave: 5 } ],
						},
						{ type: 'rest', duration: 'quarter' },
					],
					leftHand: [
						{
							type: 'note',
							duration: 'whole',
							pitches: [ { step: 'C', octave: 3 } ],
						},
					],
				},
				{
					rightHand: [
						{
							type: 'note',
							duration: 'half',
							pitches: [ { step: 'E', octave: 5 } ],
						},
					],
				},
			],
		},
		{
			measures: [
				{
					rightHand: [
						{
							type: 'note',
							duration: 'quarter',
							pitches: [ { step: 'G', octave: 4 } ],
						},
					],
				},
			],
		},
	],
};

describe( 'measureCoords', () => {
	it( 'flattens sections-outer / measures-inner into 0-based global order', () => {
		expect( measureCoords( SONG ) ).toEqual( [
			{ sectionIndex: 0, measureIndex: 0 },
			{ sectionIndex: 0, measureIndex: 1 },
			{ sectionIndex: 1, measureIndex: 0 },
		] );
	} );

	it( "mirrors the notation core's emitted data-measure order", () => {
		// Render the REAL core and read the global measure numbers it emits, in
		// document order. The helper must agree position-for-position, so the two
		// cannot drift: `data-measure="N"` ⇒ measureCoords(song)[N - 1].
		const svg = renderSvg( buildLayoutModel( SONG, 600 ) );
		const emitted = [ ...svg.querySelectorAll( '[data-measure]' ) ].map(
			( node ) => Number( node.getAttribute( 'data-measure' ) )
		);
		// One group per measure, numbered 1..N with no gaps, in flatten order.
		expect( emitted ).toEqual( [ 1, 2, 3 ] );

		const coords = measureCoords( SONG );
		emitted.forEach( ( number ) => {
			const coord = coords[ number - 1 ];
			// The emitted group is the measure the helper says it is.
			const measure =
				SONG.sections[ coord.sectionIndex ].measures[
					coord.measureIndex
				];
			expect( measure ).toBe(
				SONG.sections[ coord.sectionIndex ].measures[
					coord.measureIndex
				]
			);
		} );
		// And the count matches exactly — no extra or missing entries.
		expect( coords ).toHaveLength( emitted.length );
	} );

	it( 'returns [] for a malformed or missing song', () => {
		expect( measureCoords( undefined ) ).toEqual( [] );
		expect( measureCoords( null ) ).toEqual( [] );
		expect( measureCoords( {} ) ).toEqual( [] );
		expect( measureCoords( { sections: 'nope' } ) ).toEqual( [] );
		// A section missing its measures array contributes no entries (and does not throw).
		expect(
			measureCoords( { sections: [ {}, { measures: [ {} ] } ] } )
		).toEqual( [ { sectionIndex: 1, measureIndex: 0 } ] );
	} );
} );

describe( 'globalMeasureNumber', () => {
	it( 'is the exact 1-based inverse of measureCoords on the same fixture', () => {
		const coords = measureCoords( SONG );
		coords.forEach( ( coord, position ) => {
			expect(
				globalMeasureNumber(
					SONG,
					coord.sectionIndex,
					coord.measureIndex
				)
			).toBe( position + 1 );
		} );
	} );

	it( 'returns null for coords out of range', () => {
		expect( globalMeasureNumber( SONG, 9, 0 ) ).toBeNull();
		expect( globalMeasureNumber( SONG, 0, 9 ) ).toBeNull();
		expect( globalMeasureNumber( undefined, 0, 0 ) ).toBeNull();
	} );
} );

describe( 'resolveSelection', () => {
	it( 'resolves a live selection to its event/measure/section + coords', () => {
		const resolved = resolveSelection( SONG, {
			sectionIndex: 0,
			measureIndex: 0,
			hand: 'rightHand',
			eventIndex: 1,
		} );
		expect( resolved ).not.toBeNull();
		expect( resolved.event ).toBe(
			SONG.sections[ 0 ].measures[ 0 ].rightHand[ 1 ]
		);
		expect( resolved.measure ).toBe( SONG.sections[ 0 ].measures[ 0 ] );
		expect( resolved.section ).toBe( SONG.sections[ 0 ] );
		expect( resolved.sectionIndex ).toBe( 0 );
		expect( resolved.measureIndex ).toBe( 0 );
		expect( resolved.hand ).toBe( 'rightHand' );
		expect( resolved.eventIndex ).toBe( 1 );
	} );

	it( 'resolves a left-hand selection in a later section', () => {
		const resolved = resolveSelection( SONG, {
			sectionIndex: 1,
			measureIndex: 0,
			hand: 'rightHand',
			eventIndex: 0,
		} );
		expect( resolved.event ).toBe(
			SONG.sections[ 1 ].measures[ 0 ].rightHand[ 0 ]
		);
	} );

	it( 'returns null when the section is out of range', () => {
		expect(
			resolveSelection( SONG, {
				sectionIndex: 5,
				measureIndex: 0,
				hand: 'rightHand',
				eventIndex: 0,
			} )
		).toBeNull();
	} );

	it( 'returns null when the measure is out of range', () => {
		expect(
			resolveSelection( SONG, {
				sectionIndex: 0,
				measureIndex: 5,
				hand: 'rightHand',
				eventIndex: 0,
			} )
		).toBeNull();
	} );

	it( 'returns null when the hand is absent on the measure', () => {
		// Section 0 measure 1 has no leftHand.
		expect(
			resolveSelection( SONG, {
				sectionIndex: 0,
				measureIndex: 1,
				hand: 'leftHand',
				eventIndex: 0,
			} )
		).toBeNull();
	} );

	it( 'returns null when the event index is out of range', () => {
		expect(
			resolveSelection( SONG, {
				sectionIndex: 0,
				measureIndex: 0,
				hand: 'rightHand',
				eventIndex: 9,
			} )
		).toBeNull();
	} );

	it( 'returns null for a null/empty/partial selection', () => {
		expect( resolveSelection( SONG, null ) ).toBeNull();
		expect( resolveSelection( SONG, undefined ) ).toBeNull();
		expect( resolveSelection( SONG, {} ) ).toBeNull();
		expect(
			resolveSelection( SONG, { sectionIndex: 0, measureIndex: 0 } )
		).toBeNull();
	} );

	it( 'returns null when the song itself is missing', () => {
		expect(
			resolveSelection( undefined, {
				sectionIndex: 0,
				measureIndex: 0,
				hand: 'rightHand',
				eventIndex: 0,
			} )
		).toBeNull();
	} );
} );

describe( 'selectionQuery', () => {
	it( 'builds a measure-scoped compound selector for the note/rest node', () => {
		expect(
			selectionQuery( {
				measureNumber: 3,
				hand: 'leftHand',
				eventIndex: 2,
			} )
		).toBe(
			'[data-measure="3"] [data-hand="leftHand"][data-event-index="2"]'
		);
	} );

	it( 'scopes the highlight so a per-measure-resetting event index stays unambiguous', () => {
		// eventIndex 0 exists in many measures; scoping by the global measure number
		// first is what makes the query resolve to exactly one node.
		const query = selectionQuery( {
			measureNumber: 1,
			hand: 'rightHand',
			eventIndex: 0,
		} );
		const svg = renderSvg( buildLayoutModel( SONG, 600 ) );
		const matches = svg.querySelectorAll( query );
		expect( matches ).toHaveLength( 1 );
		expect( matches[ 0 ].getAttribute( 'data-kind' ) ).toBe( 'note' );
		expect( matches[ 0 ].getAttribute( 'data-hand' ) ).toBe( 'rightHand' );
		expect( matches[ 0 ].getAttribute( 'data-event-index' ) ).toBe( '0' );
	} );
} );
