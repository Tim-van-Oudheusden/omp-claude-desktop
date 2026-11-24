# Spec 02: Claude composer shape

## Goal

Draw omp's prompt the way the Claude desktop app draws its composer: a **rounded card** around
the text, roomy padding, and the **model chip at the lower right edge** of the card instead of a
status band above it. One omp extension, registered as a composer shape so it appears in
**Appearance → Composer Shape** next to omp's built-ins.

Not a goal: placeholder text, attachment buttons, a clickable send button, or colors (the theme
repo owns colors; this shape only uses theme tokens).

## Target look

Claude desktop's composer, translated to terminal cells. Wide pane, empty prompt:

```
╭────────────────────────────────────────────────────────────────╮
│  ❯                                                             │
╰──────────────────────────────────── opus-4.5 · high · 12% ─────╯
```

Two lines typed, status longer than the room:

```
╭────────────────────────────────────╮
│  ❯ refactor the parser so it       │
│    keeps comments                  │
╰──────────── opus-4.5 · high · 1… ──╯
```

- Corners and rules: the theme's rounded box glyphs (`cx.box`), colored with `cx.border(...)` so
  omp's state coloring (focus, bash mode, plan mode) still shows on the border.
- Status chip: the composer's status content, right-aligned in the bottom border, one border cell
  after it, one space on each side. Whatever segments the person configured appear there
  (`statusLine.*` settings decide; the omp-claude-theme preset makes it model · mode · context).
- Gutter `❯ ` on the first row, blanks under it on later rows.
- Padding: 2 cells inside each side border (`paddingX: 2`).
- No status band above, no status bar below (`bottomBar: "none"`).

A second, filled variant, `claude-desktop-filled`, paints the rows with the composer surface
(`filled: true`). Register both. The surface color comes from the theme's `userMessageBg`
(omp's `ui/styles/composer/frame.ts`), which in the Claude themes is the user-bubble color, not
Claude's composer card color; that's why the outline variant is the default.

## API (omp main, v19.1.1; confirm at the installed tag)

- `pi.registerComposerShape(shape: ComposerShape & { label: string })` in the factory
  (`docs/extensions.md` "Composer shape renderer").
- `ComposerShape` fields: `id`, `label`, `description`, `statusAttachment?`
  (`"top-border" | "top-band" | "top-rule-chip"`), `bottomBar?` (`"full" | "left" | "none"`),
  `bottomBarGap?`, `filled?`, `sideBorders`, `gutter?`, `paddingX`, `sideWidth(paddingX)`,
  `top?(cx)`, `row(cx)`, `bottom?(cx)`.
- Chrome context: `width`, `paddingX`, `theme`, `border(t)`, `accent(t)`, `surface(t)`, `box`
  (`topLeft`, `topRight`, `bottomLeft`, `bottomRight`, `horizontal`, `vertical`), `status?`
  (`{ content, width }`, already styled).
- Row context adds `text` (styled, caret included), `pad`, `gutter`, `first`, `last`, `overflow`
  (cells an end-of-row caret took from the right padding).
- Hard rule: every row a shape returns is exactly `width` visible cells.
- Reference implementation to copy from: the built-in `box` shape in
  `packages/coding-agent/src/ui/styles/composer/shapes.ts` (its `rightCells(cx)` handles the
  caret overflow; reuse that logic, it's not exported).
- Width helpers: `truncate` and `visibleWidth` from `@oh-my-pi/pi-tui/text/width` (named in the
  extension docs' migration table as the supported path).

## Open questions (spike first)

1. **Is `cx.status` given to `bottom(cx)`?** The type puts `status` on every chrome context, but
   the composer may fill it only for the attachment's own row. Spike: a shape with
   `statusAttachment: "top-border"` whose `top()` draws a plain rule and whose `bottom()` logs
   `cx.status`. If `bottom()` gets nothing, fall back to the status right-aligned in the **top**
   border (`╭──── opus-4.5 · high ─╮`) and say so in Findings.
2. Does setting `statusAttachment` suppress omp's own status placement elsewhere (so the chip
   doesn't show twice)? Check with `bottomBar: "none"`.
3. Does Tern (omp's native terminal) use composer shapes at all? If not, note it; no work needed.

## Milestones

### M1: outline shape, unit-tested

- `plugin/src/composer/shape.ts`: a pure `claudeDesktopShape` (no omp imports beyond types and
  width helpers) so tests can drive it.
- `plugin/src/composer/index.ts`: the factory registering both shapes with labels
  "Claude Desktop" and "Claude Desktop (filled)" and one-line descriptions.
- `plugin/test/composer.test.ts` with a fake context (identity `border`/`surface`/`accent`, plain
  box glyphs, `visibleWidth` from the real helper):
  - every row of `top`/`row`/`bottom` is exactly `width` cells for widths 12, 20, 40, 80, 200;
  - status shorter than the room: chip right-aligned with one border cell after it;
  - status longer than the room: truncated with `…`, still `width` cells, border corners intact;
  - no status: a plain bottom rule;
  - caret overflow 0 and 1 on the last row and a middle row;
  - multi-row input: gutter only on row one, blanks after;
  - a styled `text` (ANSI escapes) measures by visible cells, not string length.

Accept: `bun test` green.

### M2: in omp, both themes

- Load with `PI_CODING_AGENT_DIR=$(mktemp -d) omp -e plugin/src/composer/index.ts`, pick the
  shape in Appearance → Composer Shape, and screenshot in a Herdr tab: empty prompt, three typed
  lines, bash mode (`!`), plan mode, a narrow pane (≈40 columns). Dark and light.
- Compare against a Claude desktop screenshot: card proportions, chip position.

Accept: screenshots in `docs/screens/composer-*.png`; no row overflow or wrap at any width; the
border recolors with omp's states.

### M3: package and docs

- Add both entries to `plugin/package.json` `omp.extensions`.
- README section: what it looks like (one screenshot), `omp config set composer.shape
  claude-desktop`, how to go back (`band` is omp's default).

Accept: `omp plugin link ./plugin` (or the installed version's equivalent) loads it in a
throwaway agent dir with no extension errors.

## Findings

(Fill in while working: answers to the open questions, with the omp version they were checked on.)
