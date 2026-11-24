/**
 * How each transcript block is drawn: a pure function of the block and the fold mode, so omp gets
 * the same answer whenever it asks (live, rebuilt or resumed).
 *
 * Finished, successful reads, searches and commands become one quiet row ("Read src/parser.ts",
 * "Ran `npm test`"). Failures, questions to the person and (by default) edits stay full.
 */
import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import {
	type TranscriptBlock,
	type TranscriptPresentation,
	unwrapHashlineHeaderPath,
} from "@oh-my-pi/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@oh-my-pi/pi-tui";

/** The home directory as paths spell it, longest first (`/var/home/x` before `/home/x`). */
export function homeSpellings(): string[] {
	const home = homedir();
	let real = home;
	try {
		real = realpathSync(home);
	} catch {}
	return [...new Set([real, home])].sort((a, b) => b.length - a.length);
}

/** `tools`: fold reads, searches and commands. `all`: edits and writes too. `off`: omp's own drawing. */
export type FoldMode = "tools" | "all" | "off";

export const FOLD_MODES: readonly FoldMode[] = ["tools", "all", "off"];

export function parseFoldMode(value: string | undefined): FoldMode | undefined {
	const mode = value?.trim().toLowerCase();
	return FOLD_MODES.find(candidate => candidate === mode);
}

/** One styled run of a label (omp's `TspSpan`): `s` is a semantic token or theme token name. */
interface Span {
	t: string;
	s?: string;
}

type ToolCallBlock = Extract<TranscriptBlock, { type: "toolCall" }>;

const LABEL_CELLS = 80;
const COMMAND_CELLS = 60;
const PATH_CELLS = 60;
const PATTERN_CELLS = 40;

const verb = (t: string): Span => ({ t, s: "dim" });
const path = (t: string): Span => ({ t, s: "muted" });
const code = (t: string): Span => ({ t, s: "mdCode" });

/** Present-tense intents turned into past tense for `wait`, whose only argument is the intent. */
const PAST_TENSE: Readonly<Record<string, string>> = {
	Waiting: "Waited",
	Watching: "Watched",
	Polling: "Polled",
	Checking: "Checked",
	Letting: "Let",
	Giving: "Gave",
	Holding: "Held",
	Pausing: "Paused",
	Blocking: "Blocked",
	Monitoring: "Monitored",
	Collecting: "Collected",
	Gathering: "Gathered",
};

const LANGUAGES: Readonly<Record<string, string>> = { py: "Python", python: "Python", js: "JavaScript", ts: "TypeScript" };

function str(value: unknown): string | undefined {
	return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

/** `value[key]` when `value` is an object; omp's args are the model's plain JSON. */
function field(value: unknown, key: string): unknown {
	return value !== null && typeof value === "object" ? Reflect.get(value, key) : undefined;
}

/** `text` cut to `cells` from the right with `…`. */
function clip(text: string, cells: number): string {
	return visibleWidth(text) > cells ? truncateToWidth(text, cells) : text;
}

/** `text` cut to `cells` from the left with `…`, keeping its end (a path's file name). */
function clipStart(text: string, cells: number): string {
	if (visibleWidth(text) <= cells) return text;
	const chars = [...text];
	let kept = "";
	for (let i = chars.length - 1; i >= 0; i--) {
		const next = chars[i] + kept;
		if (visibleWidth(next) > cells - 1) break;
		kept = next;
	}
	return `…${kept}`;
}

/** Single line: the first line, with `…` when more follow. */
function firstLine(text: string): string {
	const lines = text.trim().split(/\r?\n/);
	return lines.length > 1 ? `${lines[0]} …` : lines[0]!;
}

export class Labeler {
	readonly #homes: readonly string[];

	/** `homes`: the home directory's spellings, longest first (real path before `$HOME`). */
	constructor(homes: readonly string[]) {
		this.#homes = homes;
	}

	/** How `block` is drawn in `mode`. */
	present(block: TranscriptBlock, mode: FoldMode): TranscriptPresentation {
		if (mode === "off" || block.type !== "toolCall") return undefined;
		if (block.isError) return "full";
		const running = block.isPartial;
		switch (block.toolName) {
			case "ask":
				return "full";
			case "edit":
			case "ast_edit":
			case "write":
				return mode === "all" ? this.#compact(this.#fileChange(block, running)) : "full";
			case "task":
				return running ? "full" : this.#compact(this.#task(block.args));
			default:
				return this.#compact(this.#label(block, running));
		}
	}

	#compact(spans: Span[]): TranscriptPresentation {
		return { compact: { label: fit(spans) } };
	}

	#path(value: string): string {
		for (const home of this.#homes) {
			if (value === home) return "~";
			if (value.startsWith(`${home}/`)) return `~${value.slice(home.length)}`;
		}
		return value;
	}

	#shownPath(value: string): string {
		return clipStart(this.#path(value), PATH_CELLS);
	}

	#label(block: ToolCallBlock, running: boolean): Span[] {
		const { args } = block;
		const tense = (finished: string, ongoing: string) => verb(running ? ongoing : finished);
		switch (block.toolName) {
			case "read":
				return [tense("Read ", "Reading "), path(this.#shownPath(str(field(args, "path")) ?? "."))];
			case "grep":
			case "ast_grep":
				return this.#search(
					tense("Searched for ", "Searching for "),
					str(field(args, block.toolName === "grep" ? "pattern" : "pat")),
					str(field(args, "path")),
				);
			case "glob":
				return [tense("Found files matching ", "Finding files matching "), code(clip(str(field(args, "path")) ?? "*", PATTERN_CELLS))];
			case "find":
				return [tense("Searched the code for ", "Searching the code for "), code(clip(str(field(args, "query")) ?? "", PATTERN_CELLS))];
			case "web_search":
				return [tense("Searched the web for ", "Searching the web for "), code(clip(str(field(args, "query")) ?? "", PATTERN_CELLS))];
			case "lsp": {
				const action = str(field(args, "action")) ?? "symbols";
				const file = str(field(args, "file"));
				const spans = [tense("Looked up ", "Looking up "), { t: action }];
				return file && file !== "*" ? [...spans, verb(" in "), path(this.#shownPath(file))] : spans;
			}
			case "bash":
				return [tense("Ran ", "Running "), code(clip(firstLine(str(field(args, "command")) ?? ""), COMMAND_CELLS))];
			case "eval": {
				const language = str(field(args, "language"));
				const title = str(field(args, "title"));
				const name = language ? (LANGUAGES[language.toLowerCase()] ?? language) : "code";
				const spans = [tense("Ran ", "Running "), { t: name }];
				return title ? [...spans, verb(" · "), path(firstLine(title))] : spans;
			}
			case "todo":
				return [verb(running ? "Updating the plan" : "Updated the plan")];
			case "wait":
				return [verb(this.#waited(str(field(args, "i")), running))];
			default:
				return [tense("Used ", "Using "), { t: block.toolName }];
		}
	}

	#search(lead: Span, pattern: string | undefined, where: string | undefined): Span[] {
		const spans = [lead, code(clip(pattern ?? "", PATTERN_CELLS))];
		return where && where !== "." ? [...spans, verb(" in "), path(this.#shownPath(where))] : spans;
	}

	#waited(intent: string | undefined, running: boolean): string {
		if (!intent) return running ? "Waiting for background jobs" : "Waited for background jobs";
		const line = firstLine(intent);
		if (running) return line;
		const [first, ...rest] = line.split(" ");
		const past = PAST_TENSE[first!];
		return past ? [past, ...rest].join(" ") : line;
	}

	#fileChange(block: ToolCallBlock, running: boolean): Span[] {
		const isWrite = block.toolName === "write";
		const lead = verb(isWrite ? (running ? "Writing " : "Wrote ") : running ? "Editing " : "Edited ");
		const targets = isWrite ? [str(field(block.args, "path"))].filter(t => t !== undefined) : editTargets(block);
		const spans: Span[] = [lead, path(targets.length > 0 ? this.#shownPath(targets[0]!) : "a file")];
		if (targets.length > 1) spans.push(verb(` and ${targets.length - 1} more`));
		if (!isWrite && !running) {
			const counts = diffCounts(field(block.result?.details, "diff"));
			if (counts) spans.push({ t: " " }, { t: `+${counts.added}`, s: "ins" }, { t: " " }, { t: `−${counts.removed}`, s: "del" });
		}
		return spans;
	}

	#task(args: unknown): Span[] {
		const tasks = field(args, "tasks");
		const list = Array.isArray(tasks) ? tasks : [];
		const names = list.map(task => str(field(task, "name"))).filter(name => name !== undefined);
		const spans = [verb(`Ran ${list.length} subagent${list.length === 1 ? "" : "s"}`)];
		if (names.length === 0) return spans;
		return [...spans, verb(": "), path(names.length > 1 ? `${names[0]}, …` : names[0]!)];
	}
}

/** Files an `edit` or `ast_edit` call targets, as the model wrote them when it did. */
function editTargets(block: ToolCallBlock): string[] {
	const { args } = block;
	const found: string[] = [];
	const paths = field(args, "paths");
	if (Array.isArray(paths)) found.push(...paths.filter(p => typeof p === "string"));
	const single = str(field(args, "path"));
	if (single) found.push(single);
	const input = str(field(args, "input"));
	if (input && found.length === 0) {
		for (const line of input.split(/\r?\n/)) {
			const header = /^\[.+\]$/.test(line) ? unwrapHashlineHeaderPath(line) : undefined;
			const patch = /^\*\*\* (?:Update|Add|Delete|Edit) File: (.+)$/.exec(line)?.[1];
			const target = header !== undefined && header !== line ? header : patch;
			if (target) found.push(target.trim());
		}
	}
	if (found.length === 0) {
		const details = block.result?.details;
		const perFile = field(details, "perFileResults");
		if (Array.isArray(perFile)) for (const file of perFile) {
			const p = str(field(file, "path"));
			if (p) found.push(p);
		}
		const p = str(field(details, "path"));
		if (found.length === 0 && p) found.push(p);
	}
	return [...new Set(found)];
}

/** Added and removed lines of a diff (`+12|new`, `-12|old`, or unified `+new`/`-old`). */
function diffCounts(diff: unknown): { added: number; removed: number } | undefined {
	if (typeof diff !== "string" || diff.length === 0) return undefined;
	let added = 0;
	let removed = 0;
	for (const line of diff.split("\n")) {
		if (line.startsWith("+") && !line.startsWith("+++")) added++;
		else if (line.startsWith("-") && !line.startsWith("---")) removed++;
	}
	return added + removed > 0 ? { added, removed } : undefined;
}

/** Spans cut to the label width: the run that crosses the limit ends in `…`, later runs drop. */
function fit(spans: Span[]): Span[] {
	const out: Span[] = [];
	let room = LABEL_CELLS;
	for (const span of spans) {
		if (room <= 0) break;
		const width = visibleWidth(span.t);
		if (width <= room) {
			out.push(span);
			room -= width;
		} else {
			out.push({ ...span, t: truncateToWidth(span.t, room) });
			break;
		}
	}
	return out;
}
