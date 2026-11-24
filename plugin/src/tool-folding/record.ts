/**
 * Recorder for real transcript blocks: with `OMP_FOLD_RECORD=<file>` set, the presenter appends
 * each distinct block it is asked about as one JSON line and answers `undefined`, so the
 * transcript draws as usual. The lines feed `test/fixtures/blocks.jsonl`.
 *
 * A line holds the block's shape: args with values shortened, the result's content types and
 * detail keys. The home directory becomes `~` as lines are written.
 */
import { appendFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import type { TranscriptBlock, TranscriptPresenter } from "@oh-my-pi/pi-coding-agent";

const MAX_STRING = 160;
const MAX_ITEMS = 3;
const MAX_DEPTH = 4;

/** The home directory as written in paths, longest spelling first (`/var/home/x` before `/home/x`). */
function homeSpellings(): string[] {
	const home = homedir();
	let real = home;
	try {
		real = realpathSync(home);
	} catch {}
	return [...new Set([real, home])].sort((a, b) => b.length - a.length);
}

/** `value` reduced to its shape: strings shortened, arrays cut to a few items, depth bounded. */
function summarize(value: unknown, homes: readonly string[], depth = 0): unknown {
	if (typeof value === "string") {
		const scrubbed = homes.reduce((s, home) => s.replaceAll(home, "~"), value);
		return scrubbed.length > MAX_STRING ? `${scrubbed.slice(0, MAX_STRING)}…(${scrubbed.length})` : scrubbed;
	}
	if (value === null || typeof value !== "object") return value;
	if (depth >= MAX_DEPTH) return Array.isArray(value) ? `[array ${value.length}]` : "[object]";
	if (Array.isArray(value)) {
		const items = value.slice(0, MAX_ITEMS).map(item => summarize(item, homes, depth + 1));
		return value.length > MAX_ITEMS ? [...items, `…(${value.length} items)`] : items;
	}
	const out: Record<string, unknown> = {};
	for (const [key, item] of Object.entries(value)) out[key] = summarize(item, homes, depth + 1);
	return out;
}

/** One recording line for a block, or `undefined` for block types this recorder doesn't know. */
export function recordBlock(
	block: TranscriptBlock,
	homes: readonly string[] = homeSpellings(),
): Record<string, unknown> | undefined {
	switch (block.type) {
		case "toolCall": {
			const { result } = block;
			const details = result?.details;
			return {
				type: block.type,
				toolName: block.toolName,
				isError: block.isError,
				isPartial: block.isPartial,
				args: summarize(block.args, homes),
				result:
					result === undefined
						? undefined
						: {
								content: result.content.map(part =>
									part !== null && typeof part === "object" && "type" in part ? part.type : typeof part,
								),
								details:
									details !== null && typeof details === "object" ? Object.keys(details).sort() : typeof details,
							},
			};
		}
		case "message": {
			const { message } = block;
			return { type: block.type, role: message.role, customType: "customType" in message ? message.customType : undefined };
		}
		case "event":
			return { type: block.type, event: block.event.type };
		default:
			return undefined;
	}
}

/** A presenter that appends each distinct recorded block to `file` and always defers. */
export function createRecorder(file: string): TranscriptPresenter {
	const seen = new Set<string>();
	const homes = homeSpellings();
	return block => {
		const record = recordBlock(block, homes);
		if (record === undefined) return undefined;
		const line = JSON.stringify(record);
		if (seen.has(line)) return undefined;
		seen.add(line);
		try {
			appendFileSync(file, `${line}\n`);
		} catch {
			// A recording that can't be written must not break the transcript.
		}
		return undefined;
	};
}
