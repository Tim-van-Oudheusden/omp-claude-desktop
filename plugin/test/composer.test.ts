import { describe, expect, test } from "bun:test";
import {
	type ComposerChromeContext,
	type ComposerRowContext,
	type ComposerStyle,
	type EditorTopBorder,
	visibleWidth,
} from "@oh-my-pi/pi-tui";
import { claudeDesktopFilledShape, claudeDesktopShape } from "../src/composer/shape";

const BOX = {
	topLeft: "╭",
	topRight: "╮",
	bottomLeft: "╰",
	bottomRight: "╯",
	horizontal: "─",
	vertical: "│",
};
const identity = (s: string) => s;
const plain = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

function chrome(width: number, topBorder?: EditorTopBorder, overrides: Partial<ComposerChromeContext> = {}) {
	return {
		width,
		paddingX: claudeDesktopShape.defaultPaddingX(undefined),
		borderColor: identity,
		accentColor: identity,
		surfaceColor: identity,
		box: BOX,
		topBorder,
		...overrides,
	} satisfies ComposerChromeContext;
}

function status(text: string): EditorTopBorder {
	return { content: text, width: visibleWidth(text) };
}

/**
 * Draw a whole composer the way omp's editor feeds a side-bordered style: no gutter, text padded
 * to the content width. A line ending in the caret may be one cell wider than the content; that
 * cell comes out of the right padding (`cursorOverflow`).
 */
function frame(
	style: ComposerStyle,
	width: number,
	lines: string[],
	opts: { status?: EditorTopBorder; caretOverflowRow?: number; ctx?: Partial<ComposerChromeContext> } = {},
): string[] {
	const ctx = chrome(width, opts.status, opts.ctx);
	const contentWidth = width - 2 * style.sideChromeWidth(ctx.paddingX);
	const rows: string[] = [];
	const top = style.renderTop(ctx);
	if (top !== undefined) rows.push(top);
	lines.forEach((text, i) => {
		const overflow = i === opts.caretOverflowRow ? Math.max(0, visibleWidth(text) - contentWidth) : 0;
		const row: ComposerRowContext = {
			...ctx,
			text,
			pad: " ".repeat(Math.max(0, contentWidth - visibleWidth(text))),
			gutter: "",
			isLastRow: i === lines.length - 1,
			cursorOverflow: overflow,
			imeSafeCursorTail: false,
			scrollbarThumb: false,
		};
		rows.push(...style.renderRow(row));
	});
	const bottom = style.renderBottom(ctx);
	if (bottom !== undefined) rows.push(bottom);
	return rows;
}

describe("Claude Desktop composer", () => {
	test("draws the card from the spec: rounded border, roomy padding, status bottom right", () => {
		// omp lays the status out to width - 2 * sideChromeWidth = 32 cells.
		const rows = frame(claudeDesktopShape, 38, ["refactor the parser so it", "keeps comments"], {
			status: status(` opus-4.5 · plan ${"─".repeat(10)} 12% `),
		});
		expect(rows).toEqual([
			"╭────────────────────────────────────╮",
			"│  refactor the parser so it         │",
			"│  keeps comments                    │",
			"╰─── opus-4.5 · plan ────────── 12% ─╯",
		]);
	});

	for (const style of [claudeDesktopShape, claudeDesktopFilledShape]) {
		test(`${style.id}: every row is exactly the pane width`, () => {
			for (const width of [12, 20, 40, 80, 200]) {
				const room = width - 2 * style.sideChromeWidth(2);
				const cases = [
					frame(style, width, ["hi"]),
					frame(style, width, ["hi"], { status: status(" opus · plan ") }),
					frame(style, width, ["hi"], { status: status(` ${"x".repeat(Math.max(1, room - 2))} `) }),
					frame(style, width, ["one", "two", "three"], { status: status(` ${"y".repeat(width * 2)} `) }),
				];
				for (const rows of cases) {
					for (const row of rows) expect({ width, row, cells: visibleWidth(row) }).toEqual({ width, row, cells: width });
				}
			}
		});
	}

	test("a short status sits at the right with one border cell after it", () => {
		const rows = frame(claudeDesktopShape, 40, [""], { status: status(" opus · plan ") });
		expect(rows.at(-1)).toBe(`╰${"─".repeat(24)} opus · plan ─╯`);
	});

	test("a status as wide as omp lays it out fills the border between ╰─── and ─╯", () => {
		// omp sizes the status to width - 2 * sideChromeWidth.
		const rows = frame(claudeDesktopShape, 30, [""], { status: status(` model ${"─".repeat(13)} 9% `) });
		expect(rows.at(-1)).toBe(`╰─── model ${"─".repeat(13)} 9% ─╯`);
	});

	test("a status longer than the room is cut with … and keeps both corners", () => {
		const rows = frame(claudeDesktopShape, 20, [""], { status: status(" opus-4.5 · high · 12% of 200k ") });
		const bottom = rows.at(-1)!;
		expect(visibleWidth(bottom)).toBe(20);
		expect(bottom.startsWith("╰──")).toBe(true);
		expect(bottom.endsWith("…─╯")).toBe(true);
		expect(bottom).toContain(" opus-4.5");
	});

	test("no status draws a plain bottom rule", () => {
		expect(frame(claudeDesktopShape, 16, [""]).at(-1)).toBe(`╰${"─".repeat(14)}╯`);
		expect(frame(claudeDesktopShape, 16, [""], { status: { content: "", width: 0 } }).at(-1)).toBe(
			`╰${"─".repeat(14)}╯`,
		);
	});

	test("a styled status is measured by visible cells", () => {
		const styled = "\x1b[48;2;31;30;29m\x1b[38;2;217;119;87m opus \x1b[0m";
		const bottom = frame(claudeDesktopShape, 20, [""], { status: status(styled) }).at(-1)!;
		expect(visibleWidth(bottom)).toBe(20);
		expect(plain(bottom)).toBe(`╰${"─".repeat(11)} opus ─╯`);
	});

	test("an end-of-line caret takes a padding cell, not the border, on the last and a middle row", () => {
		// Content width at 20 columns: 20 - 2 * 3 = 14.
		const caret = `${"abcdefghijklmn"}█`;
		for (const row of [0, 1]) {
			const lines = row === 0 ? [caret, "next"] : ["first", caret];
			const rows = frame(claudeDesktopShape, 20, lines, { caretOverflowRow: row });
			for (const r of rows) expect(visibleWidth(r)).toBe(20);
			expect(rows[1 + row]).toBe(`│  ${caret} │`);
		}
		// No overflow: the caret fits inside the text and both padding cells stay.
		const rows = frame(claudeDesktopShape, 20, ["abc█"], { caretOverflowRow: 0 });
		expect(rows[1]).toBe(`│  abc█${" ".repeat(10)}  │`);
	});

	test("wrapped rows line up under the first, with no prompt glyph", () => {
		const rows = frame(claudeDesktopShape, 24, ["one", "two", "three"]);
		expect(rows.slice(1, 4)).toEqual([
			"│  one                 │",
			"│  two                 │",
			"│  three               │",
		]);
	});

	test("styled text is measured by visible cells, not string length", () => {
		const text = "\x1b[1mbold\x1b[22m \x1b[38;5;203mred\x1b[39m";
		const rows = frame(claudeDesktopShape, 30, [text]);
		expect(rows[1].length).toBeGreaterThan(30);
		expect(visibleWidth(rows[1])).toBe(30);
		expect(plain(rows[1])).toBe(`│  bold red${" ".repeat(16)}  │`);
	});

	test("the border takes omp's state color; text and status keep their own", () => {
		const red = (s: string) => `<${s}>`;
		const rows = frame(claudeDesktopShape, 16, ["hi"], { status: status(" m "), ctx: { borderColor: red } });
		expect(rows).toEqual([
			`<╭${"─".repeat(14)}╮>`,
			"<│>  hi          <│>",
			`<╰${"─".repeat(10)}> m <─╯>`,
		]);
	});

	test("filled variant paints the inside of each row, not the border", () => {
		const surface = (s: string) => `\x1b[48;5;236m${s}\x1b[49m`;
		const rows = frame(claudeDesktopFilledShape, 16, ["hi"], { ctx: { surfaceColor: surface } });
		expect(rows[1]).toBe(`│${surface("  hi          ")}│`);
		// The outline variant leaves the inside alone.
		expect(frame(claudeDesktopShape, 16, ["hi"], { ctx: { surfaceColor: surface } })[1]).toBe("│  hi          │");
	});

	test("IME-safe caret row ends at the caret; the bottom border stays separate", () => {
		const rows = claudeDesktopShape.renderRow({
			...chrome(16),
			text: "hi█",
			pad: "",
			gutter: "",
			isLastRow: true,
			cursorOverflow: 0,
			imeSafeCursorTail: true,
			scrollbarThumb: false,
		});
		expect(rows).toEqual(["│  hi█"]);
	});

	test("scrollbar thumb replaces the right border on its rows", () => {
		const [row] = claudeDesktopShape.renderRow({
			...chrome(12),
			text: "x",
			pad: "     ",
			gutter: "",
			isLastRow: false,
			cursorOverflow: 0,
			imeSafeCursorTail: false,
			scrollbarThumb: true,
		});
		expect(row).toBe("│  x       █");
	});
});
