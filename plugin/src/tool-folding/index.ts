import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { createRecorder } from "./record";

export default function toolFolding(pi: ExtensionAPI): void {
	const recordFile = process.env.OMP_FOLD_RECORD;
	if (recordFile) pi.registerTranscriptPresenter(createRecorder(recordFile));
}
