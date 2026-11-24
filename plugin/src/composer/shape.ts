/**
 * Claude desktop's composer as an omp composer style: a rounded card around the prompt with
 * omp's status bar right-aligned in the bottom border.
 *
 * ```
 * ╭────────────────────────────────────────╮
 * │  refactor the parser so it keeps       │
 * │  comments                              │
 * ╰─── opus-4.5 · plan ────────────── 12% ─╯
 * ```
 *
 * Pure: no omp state, only the `@oh-my-pi/pi-tui` width helpers, so tests can drive it.
 */
import {
	type ComposerChromeContext,
	type ComposerRowContext,
	type ComposerStyle,
	padding,
	truncateToWidth,
	visibleWidth,
} from "@oh-my-pi/pi-tui";

/** Cells between the side border and the text. */
const PADDING_X = 2;

/** Bottom border: `╰` + rule, the status right-aligned, one rule cell, `╯`. */
function renderBottomBorder(ctx: ComposerChromeContext): string {
	const { box, width, paddingX, borderColor, topBorder } = ctx;
	// Left: corner plus at least one rule cell (as many as the padding); right: one rule cell
	// and the corner. omp pads each status group with a space, so none are added here.
	const leftRule = Math.max(1, paddingX);
	const room = width - 1 - leftRule - 2;
	if (!topBorder || topBorder.width <= 0 || room < 1) {
		return borderColor(`${box.bottomLeft}${box.horizontal.repeat(Math.max(0, width - 2))}${box.bottomRight}`);
	}

	let { content, width: statusWidth } = topBorder;
	if (statusWidth > room) {
		content = truncateToWidth(content, room);
		statusWidth = visibleWidth(content);
	}
	const fill = leftRule + Math.max(0, room - statusWidth);
	return (
		borderColor(`${box.bottomLeft}${box.horizontal.repeat(fill)}`) +
		content +
		borderColor(`${box.horizontal}${box.bottomRight}`)
	);
}

/**
 * One content row: `│`, padding, gutter (omp passes none to side-bordered shapes), text,
 * padding, `│`. An end-of-line caret that spills
 * past the text takes cells from the right padding, never the border (omp's `box` rule).
 */
function renderContentRow(ctx: ComposerRowContext, filled: boolean): string[] {
	const { box, paddingX, borderColor, gutter, text, pad } = ctx;
	const paint = filled ? ctx.surfaceColor : (s: string) => s;
	const left = borderColor(box.vertical);
	const leftFill = padding(paddingX) + gutter + text;
	// IME preedit is drawn by the terminal after the caret; leave the right side empty so it can't
	// push the border onto the next row.
	if (ctx.imeSafeCursorTail) return [left + paint(leftFill)];

	const rightChromeCells = Math.max(1, paddingX + 1 - ctx.cursorOverflow);
	const rightGlyph = ctx.scrollbarThumb ? "█" : box.vertical;
	return [left + paint(leftFill + pad + padding(rightChromeCells - 1)) + borderColor(rightGlyph)];
}

function claudeDesktopStyle(id: string, filled: boolean): ComposerStyle {
	return {
		id,
		filledSurface: filled,
		sideBorders: true,
		verticalChrome: 2,
		statusAttachment: "top-border",
		bottomBar: "none",
		bottomBarGap: false,
		// omp gives side-bordered shapes no prompt gutter (`Editor.#getEffectivePromptGutter`).
		defaultPromptGutter: undefined,
		defaultPaddingX: () => PADDING_X,
		sideChromeWidth: paddingX => paddingX + 1,
		renderTop: ({ box, width, borderColor }) =>
			borderColor(`${box.topLeft}${box.horizontal.repeat(Math.max(0, width - 2))}${box.topRight}`),
		renderRow: ctx => renderContentRow(ctx, filled),
		renderBottom: renderBottomBorder,
	};
}

/** Outline card; the default. */
export const claudeDesktopShape: ComposerStyle = claudeDesktopStyle("claude-desktop", false);

/** Same card with rows painted in the composer surface (the theme's `userMessageBg`). */
export const claudeDesktopFilledShape: ComposerStyle = claudeDesktopStyle("claude-desktop-filled", true);
