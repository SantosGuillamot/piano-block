/**
 * The single home for the staff-space (sp) and layout constants shared by the
 * pure layout layer (`layout.js`) and the thin SVG-emit layer (`svg.js`), so the
 * magic numbers live in one place.
 *
 * The drawing uses the standard engraving unit, the **staff space (sp)** — the
 * distance between adjacent staff lines; the 5-line staff spans 4 sp. EVERY value
 * here is expressed in staff spaces EXCEPT `SP_PX` (the sp→px scale the emit layer
 * applies) and the integer count/multiplier tables. Keeping all geometry in sp
 * means the layout layer never touches pixels and resize is a pure re-wrap.
 *
 * The starting values may be tuned within the documented ranges. This module is
 * pure data — no DOM, no imports, no side effects, so importing it is free.
 */

// ── Coordinate / staff sizing ──────────────────────────────────────────────────

/** sp→px scale: one staff space in SVG pixels. Staff height = 4 sp = 32 px. */
export const SP_PX = 8;

/** Number of lines in a single 5-line staff. */
export const STAFF_LINE_COUNT = 5;

/** Height of one 5-line staff, in sp (4 spaces between the 5 lines). */
export const STAFF_HEIGHT_SP = 4;

/**
 * Generous vertical margin, in sp, the editor-only per-event hit-rect extends ABOVE
 * and BELOW the staff (added to the `STAFF_HEIGHT_SP` staff span on each side), so a
 * ledgered note, its stem, and a stack of accidentals all fall inside the clickable
 * zone. Used only by the `interactive` hit-rect emit in `svg.js`; the front-end emit
 * never reads it. Tunable.
 */
export const HIT_RECT_VERTICAL_MARGIN_SP = 4;

// ── Noteheads / stems / flags / beams ──────────────────────────────────────────

/** Notehead ellipse horizontal radius (≈ 1.18 sp wide notehead). */
export const NOTEHEAD_RX = 0.6;

/** Notehead ellipse vertical radius (~1 sp tall notehead). */
export const NOTEHEAD_RY = 0.5;

/** Stem stroke thickness. */
export const STEM_THICKNESS = 0.13;

/** Default stem length; extended so far ledger notes still cross the middle line. */
export const STEM_LENGTH = 3.5;

/** Beam (primary) thickness. */
export const BEAM_THICKNESS = 0.5;

/** Vertical gap added per stacked beam level (secondary/tertiary beams). */
export const BEAM_GAP = 0.75;

/** Inset of secondary beams toward the noteheads, parallel to the primary beam. */
export const SECONDARY_BEAM_INSET = 0.28;

// ── Augmentation dots ──────────────────────────────────────────────────────────

/** Augmentation-dot circle radius. */
export const DOT_RADIUS = 0.15;

/** Horizontal offset of the first dot to the right of the notehead. */
export const DOT_OFFSET = 0.5;

/** Horizontal gap between successive dots (second dot further right). */
export const DOT_GAP = 0.5;

// ── Horizontal spacing ─────────────────────────────────────────────────────────

/** Minimum advance between adjacent onsets; raised per-column for glyph clearance. */
export const MIN_ADV = 2.2;

/** Compressive-spacing coefficient: `advance(Δ) = MIN_ADV + ADV_K · sqrt(Δ)`. */
export const ADV_K = 3.0;

/** Floor width for an empty measure (no events on either hand). */
export const EMPTY_MEASURE_WIDTH = 3.3;

/**
 * Opening clearance, in sp, reserved at the start of EVERY measure before its first
 * note column, so the opening note has room to breathe instead of hugging the
 * barline / measure boundary. Applied uniformly on both staves and unscaled by
 * justify. Composes with the opening accidental's lead by max() (they share the
 * same pre-column slot), not by stacking.
 */
export const MEASURE_START_PAD = 1.0;

// ── System wrapping / justify / vertical gaps ──────────────────────────────────

/** Maximum justify stretch applied to internal grid advances (whitespace only). */
export const MAX_STRETCH = 1.6;

/** Vertical gap between the RH and LH staves within one grand-staff band. */
export const INTRA_STAFF_GAP = 8;

/** Vertical gap between stacked grand-staff systems. */
export const INTER_SYSTEM_GAP = 10;

/** Base top margin of a system (room for ledgers) when it carries no text lanes. */
export const SYSTEM_TOP_MARGIN = 5;

/** Bottom margin of a system (room for dynamics / low ledgers). */
export const SYSTEM_BOTTOM_MARGIN = 5;

/**
 * Clearance, in sp, between the high-note/ledger zone and the first stacked text lane
 * above the staff (and above the topmost lane). Part of the flexible top stack that
 * only reserves space for the lanes actually present.
 */
export const ABOVE_STAFF_PAD = 1;

/**
 * Vertical gap between two stacked above-staff text lanes (chord / ottava / tempo).
 * Also reused as the per-note stack gap, so one stack step is
 * `NOTE_SIZE + TEXT_LANE_GAP` = 3.4 sp.
 */
export const TEXT_LANE_GAP = 0.6;

/**
 * Horizontal inset on each side of a system, in sp: keeps the staff lines, the brace,
 * and the final barline inside the rendered box instead of bleeding past it.
 */
export const STAFF_MARGIN_X = 1.5;

// ── Barlines ───────────────────────────────────────────────────────────────────

/** Thin barline stroke thickness (regular bar / first stroke of a double). */
export const BARLINE_THIN = 0.13;

/** Thick barline stroke thickness (final bar / repeat heavy stroke). */
export const BARLINE_THICK = 0.5;

/**
 * Whitespace after a barline before the next measure's first note CENTER, in sp. Kept
 * small — more than the notehead radius so the head still clears the line — while the
 * measure's own lead-in (`MEASURE_START_PAD`) supplies the breathing room before the
 * opening note.
 */
export const BARLINE_POST_PAD = 0.7;

// ── Accidentals / ledger lines ─────────────────────────────────────────────────

/** Ledger-line segment width, centered on the notehead. */
export const LEDGER_WIDTH = 2;

/**
 * Gap between an accidental glyph's center and the notehead center it sits left of.
 * Must clear the notehead (`NOTEHEAD_RX`) plus the glyph's own half-width so the
 * accidental reads as a separate symbol and never overlaps the head.
 */
export const ACCIDENTAL_GAP = 1.2;

/** Horizontal step pushing a chord accidental into a further-left column. */
export const ACCIDENTAL_COL_STEP = 1.3;

/**
 * The accidental's claim on a measure's opening slot, in sp: when the opening note draws
 * an accidental, this is the leading room that note needs so the glyph fits between the
 * measure boundary and the notehead. It does not stack on top of the uniform opening
 * lead-in (`MEASURE_START_PAD`) — the two compose by max(), so they share one opening
 * slot and a plain opening note and an accidental one land at the SAME opening position.
 * The accidental glyph simply occupies that slot, drawn to the left of the notehead.
 */
export const ACCIDENTAL_LEAD_EXTRA = 1;

/** Gap between the end of the key-signature cluster and the time signature. */
export const KEYSIG_TIMESIG_GAP = 0.8;

/**
 * Vertical clearance, in sp, between a notehead center and a tie's endpoint, so the
 * tie arcs clear of the noteheads (above or below) instead of through them.
 */
export const TIE_NOTE_CLEARANCE = 0.9;

// ── Text sizes, in sp ──────────────────────────────────────────────────────────

/** Dynamics (bold-italic) text size. */
export const DYNAMIC_SIZE = 2.8;

/** Note-annotation text size (free author text placed around the staves). */
export const NOTE_SIZE = 2.8;

/** Tempo marking text size ("[note-glyph] = [bpm]"). */
export const TEMPO_SIZE = 2.8;

/** Measure-number text size (above-left of each system's first measure). */
export const MEASURE_NUMBER_SIZE = 2.2;

/** Ottava-bracket label text size ("8va" / "8vb" / "15ma" / "15mb"). */
export const OTTAVA_SIZE = 2.2;

/** Clearance, in sp, between a staff line and the nearest note baseline. */
export const NOTE_GAP_STAFF = 1;

/**
 * Clearance, in sp, between the below-RH and above-LH note sub-bands inside the
 * inter-staff gap, applied only when both sub-bands are present.
 */
export const MID_GAP = 1.2;

/**
 * Below-staff dynamics-region depth, in sp, that a below-RH/below-LH annotation
 * dodges when its hand carries a below-staff dynamics occupant — a point dynamic
 * glyph AND/OR a gradual-dynamic hairpin lane (both live in this region). Serves as
 * the `baseOffset` for such a below band, feeding BOTH the per-annotation baseline
 * and the gap/bottom-margin flex.
 *
 * Set to the dynamic baseline (3.5 sp below the staff) plus one full `STACK_STEP`
 * (`NOTE_SIZE + TEXT_LANE_GAP` = 3.4 sp), so a dodged annotation sits a whole text
 * lane below the dynamic — its TOP clears the dynamic glyph's BODY, not merely its
 * baseline (the prior 4.5 separated only the baselines by 1 sp, so the ~2.8 sp
 * glyphs still overlapped). 6.9 also clears the hairpin lane's lower edge
 * (`HAIRPIN_LANE_DY + HAIRPIN_APERTURE / 2` = 3.5). Tunable.
 */
export const DYNAMICS_LANE_RESERVE = 6.9;

/**
 * Horizontal back-off, in sp, from the trailing barline used when clamping an
 * over-content `beat`-anchored note so it stays inside the measure.
 */
export const NOTE_CLAMP_INSET = 1;

// ── Hairpins (crescendo / decrescendo wedges) ───────────────────────────────────

/**
 * Hairpin wedge open-mouth height: the vertical distance between the two stroke
 * ends at the wedge's open side. A FIXED constant — never derived from the span's
 * width — so a degenerate (near-zero-width) two-note span stays finite instead of
 * dividing by `(x2 - x1)`.
 */
export const HAIRPIN_APERTURE = 1.0;

/**
 * Hairpin lane center offset below a hand's staff BOTTOM line (positive Y is
 * downward). Places the wedge in the same below-staff dynamic band where point
 * dynamics already sit.
 */
export const HAIRPIN_LANE_DY = 3.0;

/**
 * The light horizontal gap (sp) at a messa-di-voce hinge: when a crescendo's open
 * tip and a decrescendo's open mouth meet on a shared hinge note, each is inset by
 * half of this so a small space shows between the `<` and the `>`.
 */
export const HAIRPIN_HINGE_GAP = 0.6;

/**
 * Horizontal clearance (sp) between a point dynamic glyph and a hairpin that begins
 * on the same note. A hairpin and a dynamic share the below-staff dynamics line, so
 * a hairpin starting where a dynamic sits is shifted right to clear it (standard
 * engraving) rather than drawn across it.
 */
export const HAIRPIN_DYNAMIC_GAP = 0.6;

/**
 * Approximate per-character advance, in em, of the bold-italic dynamic glyphs. Used
 * only to estimate where a dynamic glyph ends so an adjacent hairpin can clear it
 * (dynamics are center-anchored, so no exact metrics are otherwise needed).
 */
export const DYNAMIC_ADVANCE_EM = 0.6;

// ── Duration tables ────────────────────────────────────────────────────────────

/**
 * Base duration of each note value in quarter-beats. Used by both the beaming
 * `pos` walk and the union-grid onset arithmetic:
 * `dur(e) = BASE_DUR[duration] × DOT_MUL[dots]`.
 */
export const BASE_DUR = {
	whole: 4,
	half: 2,
	quarter: 1,
	eighth: 0.5,
	sixteenth: 0.25,
	"thirty-second": 0.125,
};

/** Dot multiplier keyed by dot count: 1 dot ×1.5, 2 dots ×1.75. */
export const DOT_MUL = {
	0: 1,
	1: 1.5,
	2: 1.75,
};

/** Number of beams/flags per beamable note value (`beamCount`). */
export const BEAM_COUNT = {
	eighth: 1,
	sixteenth: 2,
	"thirty-second": 3,
};
