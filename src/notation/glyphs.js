/**
 * The glyph map: the single swappable indirection layer between a symbolic glyph
 * name (what the layout layer thinks in) and how that glyph is actually drawn —
 * either a music-font codepoint OR a hand-drawn SVG primitive spec. The renderer
 * stays agnostic to the font-vs-path choice: it only ever asks `glyphFor(name)` and
 * looks at what halves the record carries.
 *
 * Two halves per glyph (either or both may be present):
 *
 * - **Font half (`codepoint`)** — a JS string holding the glyph's SMuFL
 *   Unicode-PUA codepoint. SMuFL (the Standard Music Font Layout) is the
 *   conventional codepoint mapping used by Bravura, the SMuFL reference font.
 *   The font shipped with this plugin is a subsetted + RENAMED Bravura
 *   (family "PB Music", SIL OFL 1.1) — renamed because "Bravura" is a Reserved
 *   Font Name. The codepoints below MUST match exactly what the subsetted font
 *   contains, so this module is the ONE place any codepoint appears.
 *
 * - **Hand-drawn half (`spec`)** — a tiny declarative description of SVG
 *   primitives (ellipse / circle / rect, in staff-space units) the emit layer
 *   turns into `createElementNS` calls. The hand-drawn set covers the
 *   trivial glyphs (noteheads, the augmentation dot, whole/half rests) and
 *   DOUBLES AS THE FONT-FAILURE SKELETON: these always render
 *   even if the music font 404s or is blocked, so the score's structure never
 *   depends on the font.
 *
 * The emit layer also draws all staff lines, stems, beams, ties, slurs, ledger
 * lines and barlines as raw primitives — those are never glyphs in any strategy
 * and so live in the layout/emit layers, not here.
 *
 * This module is pure data + one tiny accessor. NO DOM: the `spec` records are
 * inert data; turning them into elements is the emit layer's job.
 */

/** The renamed music-font family the emit layer sets on every font `<text>`. */
export const MUSIC_FONT_FAMILY = "PB Music";

/**
 * Hand-drawn notehead ellipse radii, in staff spaces (mirrors the constants used
 * by the layout layer). Both filled and open noteheads share this geometry; only
 * the fill differs.
 */
const NOTEHEAD_SPEC = { rx: 0.6, ry: 0.5 };

/**
 * The glyph map, keyed by symbolic name.
 *
 * Font glyphs (`codepoint` only) are the ornate shapes hardest to hand-draw to
 * the "clearly a standard piano score" bar: clefs, the ornate rests, the five
 * accidentals, flags, the grand-staff brace, and the time-signature digits.
 *
 * Hand-drawn glyphs (`spec` only) are the trivial shapes + the font-failure
 * skeleton: filled/open noteheads, the augmentation dot, and the whole/half rests
 * (rectangles hung from / sitting on a staff line).
 *
 * @type {Record<string, { codepoint?: string, spec?: object }>}
 */
export const GLYPHS = {
	// ── Clefs (font). Alto and tenor SHARE the C-clef glyph and are
	// placed at different staff positions by the layout layer, so there is one
	// `cClef` glyph, not separate alto/tenor entries. ───────────────────────────
	gClef: { codepoint: "" }, // SMuFL gClef (treble) U+E050
	fClef: { codepoint: "" }, // SMuFL fClef (bass) U+E062
	cClef: { codepoint: "" }, // SMuFL cClef (alto + tenor) U+E05C

	// ── Rests. The ornate eighth/sixteenth/thirty-second + the quarter rest are
	// font glyphs; whole/half rests are hand-drawn rectangles (skeleton). ────────
	restQuarter: { codepoint: "" }, // SMuFL restQuarter U+E4E5
	restEighth: { codepoint: "" }, // SMuFL rest8th U+E4E6
	restSixteenth: { codepoint: "" }, // SMuFL rest16th U+E4E7
	restThirtySecond: { codepoint: "" }, // SMuFL rest32nd U+E4E8

	/**
	 * Whole rest — a filled rectangle HUNG FROM a staff line (the line above the
	 * one it occupies). Hand-drawn; always renders even if the font fails.
	 */
	restWhole: { spec: { kind: "rect", width: 1, height: 0.5, hangs: true } },
	/**
	 * Half rest — a filled rectangle SITTING ON a staff line. Same primitive as
	 * the whole rest, sitting rather than hanging.
	 */
	restHalf: { spec: { kind: "rect", width: 1, height: 0.5, hangs: false } },

	// ── Accidentals (font). Indexable by `alter + 2` via the
	// `ACCIDENTAL_GLYPHS` array below so the layout layer can map a numeric
	// alteration straight to a glyph name. ──────────────────────────────────────
	accDoubleFlat: { codepoint: "" }, // SMuFL accidentalDoubleFlat U+E264
	accFlat: { codepoint: "" }, // SMuFL accidentalFlat U+E260
	accNatural: { codepoint: "" }, // SMuFL accidentalNatural U+E261
	accSharp: { codepoint: "" }, // SMuFL accidentalSharp U+E262
	accDoubleSharp: { codepoint: "" }, // SMuFL accidentalDoubleSharp U+E263

	// ── Flags (font). Up/down variants per beamable note value;
	// only un-beamed flagged notes use these. ───────────────────────────────────
	flagEighthUp: { codepoint: "" }, // SMuFL flag8thUp U+E240
	flagEighthDown: { codepoint: "" }, // SMuFL flag8thDown U+E241
	flag16Up: { codepoint: "" }, // SMuFL flag16thUp U+E242
	flag16Down: { codepoint: "" }, // SMuFL flag16thDown U+E243
	flag32Up: { codepoint: "" }, // SMuFL flag32ndUp U+E244
	flag32Down: { codepoint: "" }, // SMuFL flag32ndDown U+E245

	// ── Grand-staff brace (font). Spans both staves at the left. ────────────────
	brace: { codepoint: "" }, // SMuFL brace U+E000

	// ── Metronome note glyphs (font). The small note-value glyph in a
	// tempo mark "[note-glyph] = [bpm]"; a missing beatUnit defaults to the quarter
	// glyph. Keyed by note value via `TEMPO_NOTE_GLYPH` in the layout layer. ──────
	metNoteWhole: { codepoint: "" }, // SMuFL metNoteWhole U+ECA2
	metNoteHalf: { codepoint: "" }, // SMuFL metNoteHalfUp U+ECA3
	metNoteQuarter: { codepoint: "" }, // SMuFL metNoteQuarterUp U+ECA5
	metNoteEighth: { codepoint: "" }, // SMuFL metNote8thUp U+ECA7
	metNoteSixteenth: { codepoint: "" }, // SMuFL metNote16thUp U+ECA9
	metNote32nd: { codepoint: "" }, // SMuFL metNote32ndUp U+ECAB

	// ── Time-signature digits 0–9 (font). The layout layer composes
	// `beats` / `beatType` from these per-digit glyphs. ─────────────────────────
	timeSig0: { codepoint: "" }, // SMuFL timeSig0 U+E080
	timeSig1: { codepoint: "" }, // SMuFL timeSig1 U+E081
	timeSig2: { codepoint: "" }, // SMuFL timeSig2 U+E082
	timeSig3: { codepoint: "" }, // SMuFL timeSig3 U+E083
	timeSig4: { codepoint: "" }, // SMuFL timeSig4 U+E084
	timeSig5: { codepoint: "" }, // SMuFL timeSig5 U+E085
	timeSig6: { codepoint: "" }, // SMuFL timeSig6 U+E086
	timeSig7: { codepoint: "" }, // SMuFL timeSig7 U+E087
	timeSig8: { codepoint: "" }, // SMuFL timeSig8 U+E088
	timeSig9: { codepoint: "" }, // SMuFL timeSig9 U+E089

	// ── Hand-drawn / trivial glyphs (specs; the font-failure skeleton) ──────────

	/** Filled notehead (quarter and shorter) — a filled ellipse. */
	noteheadFilled: { spec: { kind: "ellipse", ...NOTEHEAD_SPEC, filled: true } },
	/** Open notehead (whole + half) — an unfilled (stroked) ellipse. */
	noteheadOpen: { spec: { kind: "ellipse", ...NOTEHEAD_SPEC, filled: false } },

	/** Augmentation dot — a small filled circle to the right of the notehead. */
	dot: { spec: { kind: "circle", r: 0.15 } },
};

/**
 * The five accidental glyph NAMES indexed by `alter + 2`: an
 * alteration of −2..+2 maps to a glyph via `ACCIDENTAL_GLYPHS[alter + 2]`.
 *
 *     alter:  -2            -1        0             +1         +2
 *     index:   0             1        2              3          4
 */
export const ACCIDENTAL_GLYPHS = [
	"accDoubleFlat",
	"accFlat",
	"accNatural",
	"accSharp",
	"accDoubleSharp",
];

/**
 * The single accessor the emit layer calls. Returns the glyph record (its
 * `codepoint` and/or hand-drawn `spec`) for `name`, or `undefined` if the name is
 * unknown. Codepoints live ONLY in `GLYPHS`, so this is the one read path.
 *
 * @param {string} name The symbolic glyph name (a key of `GLYPHS`).
 * @return {{ codepoint?: string, spec?: object } | undefined} The glyph record.
 */
export function glyphFor(name) {
	return GLYPHS[name];
}
