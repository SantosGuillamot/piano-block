/**
 * Unit tests for the shared inspector emit helpers.
 *
 * `omitEmpty` (optional object blocks) and `omitFalsy` (optional scalars) are the
 * two omit rules the canvas-first panels share; this pins their set-or-drop
 * behavior and that they never mutate the source object. `emitBlock` is the
 * song-level convenience that applies `omitEmpty` and forwards to `onChange`.
 */
import { emitBlock, omitEmpty, omitFalsy } from "../inspector/emit.js";

describe("omitEmpty (optional object blocks)", () => {
	it("sets the key when the value has at least one own key", () => {
		expect(omitEmpty({ a: 1 }, "b", { x: 1 })).toEqual({ a: 1, b: { x: 1 } });
	});

	it("deletes the key when the value is an empty object", () => {
		expect(omitEmpty({ a: 1, b: { x: 1 } }, "b", {})).toEqual({ a: 1 });
	});

	it("deletes the key when the value is falsy (undefined / null)", () => {
		expect(omitEmpty({ a: 1, b: { x: 1 } }, "b", undefined)).toEqual({ a: 1 });
		expect(omitEmpty({ a: 1, b: { x: 1 } }, "b", null)).toEqual({ a: 1 });
	});

	it("does not mutate the source object", () => {
		const source = { a: 1, b: { x: 1 } };
		const next = omitEmpty(source, "b", {});
		expect(source).toEqual({ a: 1, b: { x: 1 } });
		expect(next).not.toBe(source);
	});
});

describe("omitFalsy (optional scalars)", () => {
	it("sets the key when the value is truthy", () => {
		expect(omitFalsy({}, "barlineStart", "double")).toEqual({
			barlineStart: "double",
		});
		expect(omitFalsy({}, "dots", 2)).toEqual({ dots: 2 });
	});

	it("sets the verbatim (untrimmed) value when a string trims non-blank", () => {
		expect(omitFalsy({}, "name", "  My name  ")).toEqual({
			name: "  My name  ",
		});
	});

	it("deletes the key when a string is empty or whitespace-only", () => {
		expect(omitFalsy({ name: "x" }, "name", "")).toEqual({});
		expect(omitFalsy({ name: "x" }, "name", "   ")).toEqual({});
	});

	it("deletes the key when a scalar is falsy (0 dots drops the key)", () => {
		expect(omitFalsy({ dots: 2 }, "dots", 0)).toEqual({});
	});

	it("does not mutate the source object", () => {
		const source = { name: "x" };
		const next = omitFalsy(source, "name", "");
		expect(source).toEqual({ name: "x" });
		expect(next).not.toBe(source);
	});
});

describe("emitBlock (song-level omit-empty then onChange)", () => {
	it("sets the block when it has set fields", () => {
		const onChange = jest.fn();
		emitBlock({ sections: [] }, "metadata", { title: "T" }, onChange);
		expect(onChange).toHaveBeenCalledWith({
			sections: [],
			metadata: { title: "T" },
		});
	});

	it("drops the block when it empties", () => {
		const onChange = jest.fn();
		emitBlock(
			{ sections: [], metadata: { title: "T" } },
			"metadata",
			{},
			onChange,
		);
		expect(onChange).toHaveBeenCalledWith({ sections: [] });
	});
});
