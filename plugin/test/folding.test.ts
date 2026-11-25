import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { TranscriptBlock, TranscriptPresentation } from "@oh-my-pi/pi-coding-agent";
import { visibleWidth } from "@oh-my-pi/pi-tui/text/width";
import { type FoldMode, Labeler } from "../src/tool-folding/labels";

const labeler = new Labeler(["/var/home/tim", "/home/tim"]);

type ToolCall = Extract<TranscriptBlock, { type: "toolCall" }>;

/** Real blocks recorded from resumed sessions (M1), ids added. */
const fixture: TranscriptBlock[] = readFileSync(new URL("./fixtures/blocks.jsonl", import.meta.url), "utf8")
	.trim()
	.split("\n")
	.map((line, index) => ({ id: `fixture-${index}`, ...JSON.parse(line) }));

const recorded = (toolName: string, isError = false): ToolCall[] =>
	fixture.filter((b): b is ToolCall => b.type === "toolCall" && b.toolName === toolName && b.isError === isError);

function call(toolName: string, args: unknown, extra: Partial<ToolCall> = {}): ToolCall {
	return { type: "toolCall", id: `${toolName}-1`, toolName, args, isError: false, isPartial: false, ...extra };
}

/** The label a person reads, or the mode name when the block isn't compact. */
function shown(presentation: TranscriptPresentation): string | undefined {
	if (presentation === undefined || typeof presentation === "string") return presentation;
	const label = presentation.compact.label;
	return typeof label === "string" ? label : (label ?? []).map(span => span.t).join("");
}

const show = (block: TranscriptBlock, mode: FoldMode = "tools") => shown(labeler.present(block, mode));

function deepFreeze<T>(value: T): T {
	if (value !== null && typeof value === "object") {
		for (const item of Object.values(value)) deepFreeze(item);
		Object.freeze(value);
	}
	return value;
}

describe("recorded blocks", () => {
	test("finished reads, searches and commands fold to one row", () => {
		expect(show(recorded("read").find(b => !b.isPartial)!)).toBe("Read data/themes/ribbon/theme.css");
		expect(show(recorded("grep")[0]!)).toBe(
			"Searched for CREDITS.md|SuperTuxKart|fullscreen-1-ho… in docs;README.md;data/sc…",
		);
		expect(show(recorded("glob")[0]!)).toBe("Found files matching **/*changelog*;**/*release*md");
		expect(show(recorded("find")[0]!)).toBe("Searched the code for fullscreen panorama ribbon theme librar…");
		expect(show(recorded("bash")[2]!)).toBe("Ran ~/.cache/pindu-work/merge-when-green.sh 845");
		expect(show(recorded("eval")[0]!)).toBe("Ran JavaScript · Selecting README screenshot changes");
		expect(show(recorded("todo")[0]!)).toBe("Updated the plan");
		expect(show(recorded("wait")[0]!)).toBe("Waited for cargo gates");
	});

	test("a finished subagent run folds to its count and first name", () => {
		expect(show(recorded("task")[0]!)).toBe("Ran 1 subagent: Issue196QuickAccessSettings");
	});

	test("failures, questions and (by default) edits and writes stay full", () => {
		for (const name of ["bash", "edit", "eval"]) {
			for (const block of recorded(name, true)) expect(show(block, "all")).toBe("full");
		}
		for (const block of recorded("ask")) expect(show(block, "all")).toBe("full");
		for (const block of [...recorded("edit"), ...recorded("write")]) expect(show(block)).toBe("full");
	});

	test("/fold all folds edits and writes, with the file as the model wrote it", () => {
		const [hashline, , patch] = recorded("edit");
		expect(show(hashline!, "all")).toBe("Edited data/ui/home_page.blp");
		expect(show(patch!, "all")).toBe("Edited _build/readme-capture.sh");
		expect(show(recorded("write")[1]!, "all")).toBe("Wrote /tmp/pindu-issue.md");
	});

	test("message blocks are left to omp", () => {
		const messages = fixture.filter(b => b.type !== "toolCall");
		expect(messages.length).toBeGreaterThan(0);
		for (const block of messages) expect(labeler.present(block, "all")).toBeUndefined();
	});

	test("/fold off leaves every block to omp", () => {
		for (const block of fixture) expect(labeler.present(block, "off")).toBeUndefined();
	});

	test("asking twice gives the same answer, and the block is never written to", () => {
		for (const block of fixture) deepFreeze(block);
		for (const mode of ["tools", "all", "off"] as const) {
			for (const block of fixture) expect(labeler.present(block, mode)).toEqual(labeler.present(block, mode));
		}
	});

	test("no label is wider than 80 cells", () => {
		for (const block of fixture) {
			for (const mode of ["tools", "all"] as const) {
				const label = show(block, mode);
				if (label && label !== "full") expect(visibleWidth(label)).toBeLessThanOrEqual(80);
			}
		}
	});
});

describe("labels", () => {
	test("running calls read in the present tense", () => {
		expect(show(call("read", { path: "src/parser.ts" }, { isPartial: true }))).toBe("Reading src/parser.ts");
		expect(show(call("bash", { command: "npm test" }, { isPartial: true }))).toBe("Running npm test");
		expect(show(call("wait", { i: "Waiting for CI" }, { isPartial: true }))).toBe("Waiting for CI");
		expect(show(call("edit", { path: "a.ts" }, { isPartial: true }), "all")).toBe("Editing a.ts");
	});

	test("a running subagent run stays full so its progress shows", () => {
		expect(show(call("task", { tasks: [{ name: "A" }] }, { isPartial: true }))).toBe("full");
	});

	test("tools the spec names but the recording missed", () => {
		expect(show(call("web_search", { query: "bun test timeout" }))).toBe("Searched the web for bun test timeout");
		expect(show(call("lsp", { action: "references", file: "src/a.ts" }))).toBe("Looked up references in src/a.ts");
		expect(show(call("lsp", { action: "diagnostics", file: "*" }))).toBe("Looked up diagnostics");
		expect(show(call("ast_grep", { pat: "foo($A)", path: "src" }))).toBe("Searched for foo($A) in src");
		expect(show(call("ast_edit", { ops: [], paths: ["src/a.ts", "src/b.ts"] }), "all")).toBe(
			"Edited src/a.ts and 1 more",
		);
	});

	test("an unknown tool names itself", () => {
		expect(show(call("mcp__linear__get_issue", { id: "X-1" }))).toBe("Used mcp__linear__get_issue");
	});

	test("grep leaves out `in` for the working directory", () => {
		expect(show(call("grep", { pattern: "parseComment", path: "." }))).toBe("Searched for parseComment");
		expect(show(call("grep", { pattern: "parseComment" }))).toBe("Searched for parseComment");
	});

	test("paths under home start with ~, whichever way home is spelled", () => {
		expect(show(call("read", { path: "/var/home/tim/Git/a.ts:120-140" }))).toBe("Read ~/Git/a.ts:120-140");
		expect(show(call("read", { path: "/home/tim/Git/a.ts" }))).toBe("Read ~/Git/a.ts");
		expect(show(call("read", { path: "/home/timothy/a.ts" }))).toBe("Read /home/timothy/a.ts");
	});

	test("commands show home as ~ too, without touching look-alike paths", () => {
		expect(show(call("bash", { command: "cd /var/home/tim/Git/app; ls /home/tim" }))).toBe("Ran cd ~/Git/app; ls ~");
		expect(show(call("bash", { command: "ls /home/timothy /srv/var/home/tim/x" }))).toBe(
			"Ran ls /home/timothy /srv/var/home/tim/x",
		);
	});

	test("a long path keeps its file name; a long command keeps its start", () => {
		const deep = `/srv/${"very-long-directory/".repeat(6)}parser.ts`;
		const read = show(call("read", { path: deep }))!;
		expect(read.startsWith("Read …")).toBe(true);
		expect(read.endsWith("/parser.ts")).toBe(true);
		expect(visibleWidth(read)).toBeLessThanOrEqual(80);

		const bash = show(call("bash", { command: `cargo test --workspace ${"--features x ".repeat(10)}` }))!;
		expect(bash.startsWith("Ran cargo test --workspace")).toBe(true);
		expect(bash.endsWith("…")).toBe(true);
		expect(visibleWidth(bash)).toBeLessThanOrEqual("Ran ".length + 60);
	});

	test("a multi-line command shows its first line", () => {
		expect(show(call("bash", { command: "cd app\nnpm test" }))).toBe("Ran cd app …");
	});

	test("/fold all counts an edit's added and removed lines from its diff", () => {
		const block = call(
			"edit",
			{ input: "[src/parser.ts#AB12]\nPUT 3.=3:\n+keep comments" },
			{ result: { content: [], details: { diff: " 2|a\n-3|old\n+3|new\n+4|more\n 5|b" } } },
		);
		expect(show(block, "all")).toBe("Edited src/parser.ts +2 −1");
		const [, , , plus, , minus] = (labeler.present(block, "all") as { compact: { label: { s?: string }[] } })
			.compact.label;
		expect([plus!.s, minus!.s]).toEqual(["ins", "del"]);
	});

	test("an edit's file comes from its headers, else from its result", () => {
		const twoFiles = call("edit", { input: "[a.ts#AB12]\nPUT 1.=1:\n+x\n[b.ts#CD34]\nCUT 2.=2" });
		expect(show(twoFiles, "all")).toBe("Edited a.ts and 1 more");
		const applyPatch = call("edit", { input: "*** Begin Patch\n*** Update File: src/c.ts\n@@\n-x\n+y\n*** End Patch" });
		expect(show(applyPatch, "all")).toBe("Edited src/c.ts");
		const fromResult = call("edit", { input: "garbled" }, { result: { content: [], details: { path: "/home/tim/d.ts" } } });
		expect(show(fromResult, "all")).toBe("Edited ~/d.ts");
	});

	test("labels style verbs dim, paths muted and code in the inline-code color", () => {
		expect(labeler.present(call("grep", { pattern: "x", path: "src" }), "tools")).toEqual({
			compact: {
				label: [
					{ t: "Searched for ", s: "dim" },
					{ t: "x", s: "mdCode" },
					{ t: " in ", s: "dim" },
					{ t: "src", s: "muted" },
				],
			},
		});
	});
});
