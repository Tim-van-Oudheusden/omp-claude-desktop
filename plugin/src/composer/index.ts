import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { claudeDesktop, claudeDesktopFilled } from "./shape";

export default function claudeComposer(pi: ExtensionAPI): void {
	pi.registerComposerShape(claudeDesktop);
	pi.registerComposerShape(claudeDesktopFilled);
}
