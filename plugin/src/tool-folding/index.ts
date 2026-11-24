import { cfgExtensionTranscriptPresenters, type ExtensionAPI, settings } from "@oh-my-pi/pi-coding-agent";
import { FOLD_MODES, type FoldMode, homeSpellings, Labeler, parseFoldMode } from "./labels";
import { createRecorder } from "./record";

const OFF_NOTICE =
	"Tool folding is inactive: turn on Extension Transcript Presenters " +
	"(omp config set extensionRenderers.transcriptPresenters true)";

export default function toolFolding(pi: ExtensionAPI): void {
	const recordFile = process.env.OMP_FOLD_RECORD;
	if (recordFile) pi.registerTranscriptPresenter(createRecorder(recordFile));

	const labeler = new Labeler(homeSpellings());
	let mode: FoldMode = parseFoldMode(process.env.OMP_FOLD) ?? "tools";
	// Every block this presenter was asked about, so a mode change can have them all redrawn.
	const asked = new Set<string>();

	pi.registerTranscriptPresenter(block => {
		asked.add(block.id);
		return labeler.present(block, mode);
	});

	pi.registerCommand("fold", {
		description: "Fold finished tool calls into one-line summaries: /fold tools | all | off",
		getArgumentCompletions: prefix =>
			FOLD_MODES.filter(m => m.startsWith(prefix.trim())).map(m => ({ value: m, label: m })),
		handler: async (args, ctx) => {
			const next = parseFoldMode(args);
			if (args.trim() === "") {
				ctx.ui.notify(`Tool folding: ${mode} (/fold tools | all | off)`, "info");
				return;
			}
			if (next === undefined) {
				ctx.ui.notify(`Unknown fold mode "${args.trim()}": use tools, all or off`, "warning");
				return;
			}
			if (next === mode) return;
			mode = next;
			ctx.ui.refreshTranscript([...asked]);
			if (!cfgExtensionTranscriptPresenters.get(settings)) {
				ctx.ui.notify(OFF_NOTICE, "warning");
			}
		},
	});

	pi.on("session_start", (_event, ctx) => {
		if (mode !== "off" && !cfgExtensionTranscriptPresenters.get(settings)) ctx.ui.notify(OFF_NOTICE, "info");
	});
}
