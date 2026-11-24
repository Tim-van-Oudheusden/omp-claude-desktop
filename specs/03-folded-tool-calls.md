# Spec 03: Folded tool calls

## Goal

Make omp's transcript read like a Claude desktop conversation: the assistant's prose stays in
front, and its tool activity shrinks to **one quiet line per finished call** ("Read
src/parser.ts", "Searched for `parseComment`", "Ran `npm test`"). Edits stay visible as diffs,
failures stay loud, and any folded line opens in full with omp's own expand key (`Ctrl+O`).

One omp extension built on the **transcript presenter** API. Display only: the session file,
`/export` and the model's context are unchanged.

## Target behavior

| Block | Shown as |
|---|---|
| Read, search, list, fetch, web search, LSP lookups; finished, ok | one compact row: verb + object (table below) |
| Same, still running (`isPartial`) | one compact row, present tense: "Reading src/parser.ts" |
| `bash` / `eval`, finished, ok | compact: "Ran `npm test`" (first line of the command, ≤ 60 cells) |
| `bash` / `eval`, failed (`isError`) | **full** (omp's own card), so the error is in front of you |
| `edit`, `write`, `ast_edit` | **full** by default (the diff is what you review); compact "Edited src/parser.ts" only in `/fold all` mode |
| `task` (subagents) | compact: "Ran 3 subagents: <first name>…"; full while running so live progress shows |
| `todo` | compact: "Updated the plan" |
| `ask` | **full** always (it's a question to you) |
| Any failed call | **full** |
| Unknown tool | compact with the tool's name: "Used mcp__linear__get_issue" |
| Message blocks (`advisor`, `async-result`, `bashExecution`, …) and event blocks | `undefined` (omp's default drawing) |

Compact blocks pack together without blank rows (omp does this for consecutive compact blocks),
which already gives Claude's "a few quiet lines between paragraphs" rhythm.

### Labels (finished / running)

| Tool | Finished | Running | Object |
|---|---|---|---|
| `read` | Read `<path>` | Reading `<path>` | `args.path`, home → `~`, selector kept (`a.ts:120-140`) |
| `grep` | Searched for "`<pattern>`" in `<path>` | Searching for … | `args.pattern`, `args.path` (omit "in" when absent or `.`) |
| `glob` / `find` | Found files matching "`<pattern or query>`" | Finding files … | first of `args.pattern`, `args.query` |
| `web_search` | Searched the web for "`<query>`" | Searching the web … | `args.query` |
| `browser` | Opened `<url>` | Opening `<url>` | `args.url` |
| `lsp` | Looked up `<action>` in `<file>` | Looking up … | `args.action`, `args.file` |
| `bash` | Ran `` `<cmd>` `` | Running `` `<cmd>` `` | first line of `args.command`, truncated with `…` |
| `eval` | Ran `<language>` | Running `<language>` | `args.language`, `args.title` when given |
| `edit`, `ast_edit` | Edited `<path>` | Editing `<path>` | target path (see open question 2) |
| `write` | Wrote `<path>` | Writing `<path>` | `args.path` |
| `task` | Ran `<n>` subagent(s) | (full) | `args.tasks.length` |
| `todo` | Updated the plan | Updating the plan | — |

Labels use theme-token spans: the verb in `dim`, paths in `muted`, commands and patterns in
`mdCode` (the theme's inline-code color, red in the Claude themes, as in Claude's chat). The
presenter gets no width, so cap labels at 80 cells and let omp cut the rest.

The argument names above come from `docs/tools/*.md` on omp `main` and **must be confirmed** at
the installed tag (M1 records real blocks). Tool names: `packages/coding-agent/src/tools/builtin-names.ts`
(`ast_edit` and `ast_grep` use underscores). `browser` isn't in that list at v19.1.1; keep its row
only if M1 sees it.

### Modes

A slash command, `/fold`, switches mode for the session (in memory; default from the env var
`OMP_FOLD`, else `tools`):

- `/fold tools`: the table above (default).
- `/fold all`: edits and writes fold too ("Edited src/parser.ts" with `+a −b` when the result
  carries line counts).
- `/fold off`: the presenter answers `undefined` for everything (omp's normal transcript).

Changing mode calls `ctx.ui.refreshTranscript(ids)` for every block id the extension has
answered for, so the transcript redraws once.

## API (omp main, v19.1.1; confirm at the installed tag)

- `pi.registerTranscriptPresenter(block => TranscriptPresentation | undefined)` returns a
  disposer (`docs/extensions.md` "Transcript presenter"; `types.ts` around
  `registerTranscriptPresenter`).
- Blocks: `{ type: "toolCall", id, toolName, args, result?, isError, isPartial }`,
  `{ type: "message", id, message }`, `{ type: "event", id, event }`. Return `undefined` for any
  other `type` (later omp versions add types).
- Answers: `undefined` (next presenter / default), `"full"`, `"hidden"`, `"compact"` (omp's own
  one-row summary), or `{ compact: { label, rows } }` where `label` and each of `rows` is a
  `TspText` (a string or theme-token spans).
- `ansiSpans` from `@oh-my-pi/pi-coding-agent` turns ANSI text into spans if needed.
- `ctx.ui.refreshTranscript(ids)` re-asks for those blocks.
- `pi.registerCommand("fold", …)` for the mode command.
- Only active while the setting `extensionRenderers.transcriptPresenters` is `true` (default
  `false`). The extension must say so at session start when it's off: one `ctx.ui.notify` per
  session, with the command to turn it on.

Rules from the docs that shape the code:

- Answer synchronously and cheaply; a Promise or a misspelt mode draws the block full and is
  reported once.
- Never mutate `args`, `result` or `message`: they are omp's live objects.
- The same block must get the same answer whenever omp asks (rebuilds, resumes): answer from the
  block plus state keyed by block `id`, never from "the current run".
- A block the person expanded is always drawn full; `display.hideToolActivity` still wins.
- Main transcript only: subagent views and overlays draw stock cards.

## Open questions (spike first)

1. The real `args` shapes per tool at the installed omp version (M1's recorder answers this).
2. Where `edit` (hashline mode) keeps its target path: in `args`, or only in `result.details`?
   `unwrapHashlineHeaderPath` (root export) turns a `[path#TAG]` target into its path.
3. Does `result` carry anything usable for a "+a −b" count on edits/writes, or an exit code on
   `bash`? If not, `/fold all` labels skip the counts.
4. How does Tern draw `{ compact: { label, rows } }` (the docs say: one inline collapsed row, the
   rows as one text node)? Check once if Tern is available; otherwise note it.

## Milestones

### M1: recorder

- `plugin/src/tool-folding/record.ts`: when `OMP_FOLD_RECORD=<file>` is set, the presenter
  appends each distinct block it sees (`type`, `toolName`, `isError`, `isPartial`, keys and
  truncated values of `args`, keys of `result`) as JSON lines, and answers `undefined`.
- Run one cheap live session in a throwaway agent dir that uses read, grep, glob/find, bash (ok
  and failing), edit, write, todo and one subagent. Commit the recording (scrubbed of anything
  personal) as `plugin/test/fixtures/blocks.jsonl` and answer open questions 1–3 in Findings.

Accept: fixture committed, Findings filled, the label table above corrected where it was wrong.

### M2: presenter, unit-tested

- `plugin/src/tool-folding/labels.ts`: pure `labelFor(block, mode)` → presentation.
- `plugin/src/tool-folding/index.ts`: factory registering the presenter, the `/fold` command and
  the session-start notice.
- `plugin/test/folding.test.ts`, driven by `fixtures/blocks.jsonl` plus hand-written edge cases:
  every row of the behavior table; running vs finished; failed → `"full"`; unknown tool;
  non-toolCall blocks → `undefined`; `/fold off` → `undefined` everywhere; same block asked twice
  → same answer; long command and path truncation; home-dir shortening; no mutation of the input
  (deep-freeze it in the test).

Accept: `bun test` green.

### M3: in omp

- Load with `omp -e`, the setting on, on a copy of a real session (`--resume <copy>`):
  screenshot before and after in a Herdr tab, dark and light. Expand one folded call with
  `Ctrl+O`. Switch `/fold off` and `/fold all` and screenshot each.
- Check a resumed session draws the same as it did live (stable answers).

Accept: screenshots in `docs/screens/folding-*.png`; no "presenter failed" report in the session.

### M4: package and docs

- Add to `plugin/package.json` `omp.extensions`.
- README section with a before/after screenshot, the setting to enable, and `/fold`.

## Later (not in this spec)

Grouping consecutive same-kind calls into one row ("Read 3 files", the other two `"hidden"`)
needs the order of calls, which the presenter doesn't get. It's possible by recording order from
`tool_execution_start` events keyed by call id, but a resumed session replays no events, so the
grouping would differ between live and resumed views. Leave it until omp's block carries a
position or a group.

## Findings

(Fill in while working.)
