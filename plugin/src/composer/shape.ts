/**
 * Claude desktop's composer as an omp composer shape: a rounded card around the prompt with
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
import type { ComposerChromeContext, ComposerRowContext, ComposerShape } from "@oh-my-pi/pi-coding-agent";
import { truncate, visibleWidth } from "@oh-my-pi/pi-tui/text/width";

/** Cells between the side border and the text. */
const PADDING_X = 2;

/** Bottom border: `╰` + rule, the status right-aligned, one rule cell, `╯`. */
function renderBottomBorder(cx: ComposerChromeContext): string {
	const { box, width, paddingX, status } = cx;
	// Left: corner plus at least one rule cell (as many as the padding); right: one rule cell
	// and the corner. omp pads each status group with a space, so none are added here.
	const leftRule = Math.max(1, paddingX);
	const room = width - 1 - leftRule - 2;
	if (!status || status.width <= 0 || room < 1) {
		return cx.border(`${box.bottomLeft}${box.horizontal.repeat(Math.max(0, width - 2))}${box.bottomRight}`);
	}

	let { content, width: statusWidth } = status;
	if (statusWidth > room) {
		content = truncate(content, room);
		statusWidth = visibleWidth(content);
	}
	const fill = leftRule + Math.max(0, room - statusWidth);
	return (
		cx.border(`${box.bottomLeft}${box.horizontal.repeat(fill)}`) + content + cx.border(`${box.horizontal}${box.bottomRight}`)
	);
}

/**
 * One content row: `│`, padding, gutter (none for this shape), text, padding, `│`. An
 * end-of-line caret that spills past the text takes cells from the right padding, never the
 * border (omp's `box` rule).
 */
function renderContentRow(cx: ComposerRowContext, filled: boolean): string[] {
	const { box, paddingX, gutter, text, pad } = cx;
	const paint = filled ? cx.surface : (s: string) => s;
	const rightCells = Math.max(1, paddingX + 1 - cx.overflow);
	const inside = `${" ".repeat(paddingX)}${gutter}${text}${pad}${" ".repeat(rightCells - 1)}`;
	return [cx.border(box.vertical) + paint(inside) + cx.border(box.vertical)];
}

function claudeDesktopShape(id: string, label: string, description: string, filled: boolean) {
	return {
		id,
		label,
		description,
		statusAttachment: "top-border",
		bottomBar: "none",
		bottomBarGap: false,
		filled,
		sideBorders: true,
		paddingX: PADDING_X,
		sideWidth: paddingX => paddingX + 1,
		top: ({ box, width, border }) =>
			border(`${box.topLeft}${box.horizontal.repeat(Math.max(0, width - 2))}${box.topRight}`),
		row: cx => renderContentRow(cx, filled),
		bottom: renderBottomBorder,
	} satisfies ComposerShape & { readonly label: string };
}

/** Outline card; the default. */
export const claudeDesktop = claudeDesktopShape(
	"claude-desktop",
	"Claude Desktop",
	"Rounded card around the prompt, status in the bottom border",
	false,
);

/** Same card with rows painted in the composer surface (the theme's `userMessageBg`). */
export const claudeDesktopFilled = claudeDesktopShape(
	"claude-desktop-filled",
	"Claude Desktop (filled)",
	"Claude Desktop card with the rows painted in the composer surface",
	true,
);
