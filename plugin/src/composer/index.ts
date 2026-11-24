import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { claudeDesktopFilledShape, claudeDesktopShape } from "./shape";

export default function claudeComposer(pi: ExtensionAPI): void {
	pi.registerComposerShape({
		label: "Claude Desktop",
		description: "Rounded card around the prompt, status in the bottom border",
		style: claudeDesktopShape,
	});
	pi.registerComposerShape({
		label: "Claude Desktop (filled)",
		description: "Claude Desktop card with the rows painted in the composer surface",
		style: claudeDesktopFilledShape,
	});
}
