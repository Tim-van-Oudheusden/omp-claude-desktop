# Spec 02: Claude composer shape

## Goal

Draw omp's prompt the way the Claude desktop app draws its composer: a **rounded card** around
the text, roomy padding, and the **model chip at the lower right edge** of the card instead of a
status band above it. One omp extension, registered as a composer shape so it appears in
**Appearance → Composer Shape** next to omp's built-ins.

Not a goal: placeholder text, attachment buttons, a clickable send button, or colors (the theme
repo owns colors; this shape only uses theme tokens).

## Target look

Claude desktop's composer, translated to terminal cells. The bottom border carries omp's whole
status bar (the same content the built-in `box` shape puts in its top border: left group, a rule,
right group). Wide pane, empty prompt, the omp-claude-theme preset (left `model mode status`,
right `context_pct`):

```
╭────────────────────────────────────────────────────────────────╮
│                                                                │
╰─── opus-4.5 · plan ────────────────────────────────────── 12% ─╯
```

Two lines typed, narrow pane (omp drops right-group segments itself when the bar doesn't fit the
width it is given; the shape truncates with `…` only if it still doesn't fit):

```
╭────────────────────────────────────╮
│  refactor the parser so it keeps   │
│  comments                          │
╰─── opus-4.5 · plan ────────────────╯
```

- Corners and rules: the theme's rounded box glyphs (`ctx.box`), colored with
  `ctx.borderColor(...)` so omp's state coloring (focus, bash mode, plan mode) still shows on the
  border.
- Status: omp's status content (`statusAttachment: "top-border"`), right-aligned in the bottom
  border with one border cell after it, truncated with `…` when longer than the room. omp pads each
  segment group with a space on both sides, so the shape adds no spaces of its own (the built-in
  `box` top border doesn't either). Whatever segments the person configured appear there
  (`statusLine.*` settings decide). Decided 2026-11-24 (Tim) over a right-group-only chip
  (`top-rule-chip` drops the left group, which holds the model in the preset) and over collapsing
  omp's rule between the groups (depends on undocumented bar internals).
- No prompt glyph: omp gives side-bordered shapes no gutter (see Findings), and Claude desktop's
  composer has none either. Wrapped rows line up under the first.
- Padding: 2 cells inside each side border (`defaultPaddingX` → 2).
- No status band above, no status bar below (`bottomBar: "none"`).

A second, filled variant, `claude-desktop-filled`, paints the rows with the composer surface
(`filledSurface: true`, rows wrapped in `ctx.surfaceColor`). Register both. The surface color comes
from the theme's `userMessageBg`, which in the Claude themes is the user-bubble color, not Claude's
composer card color; that's why the outline variant is the default.

## API (checked at the installed tag, omp v19.1.1)

The spec was first written against an API shape (`ComposerShape`, `row(cx)`, `cx.status`) that
omp v19.1.1 doesn't have. At the tag the same capability is named differently:

- `pi.registerComposerShape({ label, description?, style })` in the factory
  (`docs/extensions.md` "Composer shape renderer"; type `ComposerShapeDefinition`, re-exported from
  the `@oh-my-pi/pi-coding-agent` root). `style.id` is the persisted `composer.shape` value.
- `style: ComposerStyle` (exported from the `@oh-my-pi/pi-tui` root): `id`, `filledSurface?`,
  `sideBorders`, `verticalChrome` (`0 | 1 | 2`), `statusAttachment`
  (`"top-border" | "top-band" | "top-rule-chip" | "none"`), `bottomBar` (`"none" | "left" | "full"`),
  `bottomBarGap`, `defaultPromptGutter`, `defaultPaddingX(themePaddingX)`,
  `sideChromeWidth(paddingX)`, `renderTop(ctx)`, `renderRow(ctx)` (returns `string[]`),
  `renderBottom(ctx)`.
- Chrome context (`ComposerChromeContext`): `width`, `paddingX`, `borderColor(s)`,
  `accentColor(s)`, `surfaceColor(s)`, `box` (`topLeft`, `topRight`, `bottomLeft`, `bottomRight`,
  `horizontal`, `vertical`), `topBorder?` (`{ content, width }`, already styled).
- Row context (`ComposerRowContext`) adds `text` (styled, caret included), `pad`, `gutter`,
  `isLastRow`, `cursorOverflow` (cells an end-of-row caret took from the right chrome),
  `imeSafeCursorTail` (emit no right chrome after the caret), `scrollbarThumb`.
- Hard rule: every normal row a shape returns is exactly `width` visible cells (the IME-safe row
  is the documented exception).
- Reference implementation: the built-in `box` style in
  `packages/tui/src/components/composer/box.ts` (its `rightChromeCells` handles caret overflow);
  filled reference: `field.ts`.
- Width helpers: `truncateToWidth`, `visibleWidth` and `padding` from the `@oh-my-pi/pi-tui` root
  (`@oh-my-pi/pi-tui/text/width` doesn't exist at the tag).

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
- `plugin/test/composer.test.ts` with a fake context (identity `borderColor`/`surfaceColor`/
  `accentColor`, plain box glyphs, `visibleWidth` from the real helper):
  - every row of `renderTop`/`renderRow`/`renderBottom` is exactly `width` cells for widths 12,
    20, 40, 80, 200;
  - status shorter than the room: right-aligned with one border cell after it;
  - status longer than the room: truncated with `…`, still `width` cells, border corners intact;
  - no status: a plain bottom rule;
  - caret overflow 0 and 1 on the last row and a middle row;
  - multi-row input: wrapped rows line up under the first;
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

Checked on omp 19.1.1 (tag `v19.1.1`, commit 31ffee5), 2026-11-24, with a throwaway extension
registering two spike styles and logging every `ctx.topBorder` to a file, run in a Herdr tab
with a copied config (`PI_CODING_AGENT_DIR=<tmp>`).

- **API at the tag differs from the one this spec was drafted against** (see "API" above, now
  rewritten). The capability is all there; only names and the registration shape changed.
- **Q1: yes.** The editor builds one `ComposerChromeContext` per frame and passes the same
  object, `topBorder` included, to `renderTop`, every `renderRow` and `renderBottom`
  (`packages/tui/src/components/editor.ts` `render()`); the settings preview does the same
  (`overlays/composer-shape-preview.ts`). Logged at 160 columns: `renderBottom` got
  `{ width: 154 }`, identical to `renderTop`.
  What the content *is* depends on `statusAttachment`, which changed the design:
  - `"top-border"`: the whole bar (left group, a rule, right group, each group a padded chip on
    `statusLineBg`), laid out by omp to exactly the width it's offered,
    `width - 2 * sideChromeWidth(paddingX)`.
  - `"top-rule-chip"`: the right group only, as one compact chip (12 cells for `◫ 8.3K/? ⟲`).
    The left group then shows only on a bar below the editor (`bottomBar: "left"`) or nowhere.
  - With the omp-claude-theme preset (left `model mode status`, right `context_pct`), the chip
    variant would show only the context figure. Tim chose the whole bar (`"top-border"`).
- **Q2: no double status.** With `statusAttachment: "top-border"` and `bottomBar: "none"`
  nothing renders above or below the card; the status line's standalone bar is off
  (`StatusLineComponent.setComposerStyle`: `bottomBar: "none"` → no standalone bar).
- **Q3: Tern doesn't use composer shapes.** On a TSP terminal (Tern) omp sends a native
  `editor` node and the terminal draws the composer itself; `ComposerShapePreview.describe()`
  says so ("A TSP terminal draws the composer itself, so the shape's glyph chrome has no native
  twin"). No work needed.
- Extensions import `@oh-my-pi/pi-tui` root values (`visibleWidth`) with no `node_modules`
  next to them: the compiled omp resolves the specifier to its bundled copy.
- **The `❯ ` gutter isn't possible on a side-bordered shape.** `Editor.#getEffectivePromptGutter()`
  returns nothing when `style.sideBorders` is true ("The box frame never renders a gutter"), so
  `defaultPromptGutter` is ignored and `ctx.gutter` is always `""`. Alternatives were drawing the
  glyph in the shape (needs a per-frame row counter, because the row context has no "first row"
  flag, and symmetric side chrome makes the right padding 4 cells) or `sideBorders: false` (loses
  the caret reserve, the IME-safe layout and the scrollbar). Tim chose no gutter (2026-11-25).
- **M2 in omp 19.1.1 (2026-11-25)**, Herdr 0.1.18, copied config with `composer.shape:
  claude-desktop`, `--model anthropic/claude-opus-5-5` (no credentials, no model calls).
  Screens: `docs/screens/composer-{dark,light}-{wide,bash,plan,narrow,filled}.png`,
  `composer-dark-empty.png` and `composer-dark-selector.png` (the plan shots are empty prompts
  too).
  - Both shapes appear in Appearance → Composer Shape with their labels and live preview;
    picking one rewrites `composer.shape` and every omp sharing that config redraws.
  - Widths checked live: 20, 40, 113 and 160 columns. No row wraps or overflows. At 20 columns
    omp drops the right group and the left group still fits (`╰─── ◒ Opus 5.5 ───╯`).
  - Bash mode (`!`) turns the whole frame green. Plan mode shows as the `Plan` status segment
    only: omp's `updateEditorBorderColor` has no plan-mode branch, so no shape recolors for it.
  - The rule *between* the two status groups belongs to the status content and keeps the
    status line's color, so in bash mode that stretch of the bottom border stays gray while the
    rest turns green. The built-in `box` top border behaves the same; fixing it would mean
    rewriting omp's status content (the option Tim turned down).
  - Light: Herdr follows the GNOME color scheme and omp reads the background over OSC 11 (which
    beats `COLORFGBG`), so the light shots were taken by switching
    `org.gnome.desktop.interface color-scheme` to `default` for a minute (with Tim's OK) and
    adding `theme.light: claude-desktop-light` to the copied config. omp switched themes live.
  - Driving it: `hc keys` has no key name for `!`; typed it through `hc attach` from a pty sized
    to the terminal. `ctrl+j` inserts a newline. Plan mode toggles with `alt+shift+p`.
  - No Claude desktop screenshot was available to compare against, so the comparison is against
    this spec's target. The card and status position match. The model sits lower-left because
    the preset puts it in the left group; Claude desktop puts the model picker lower-right.
- **M3 (2026-11-25): `omp plugin link ./plugin` is the exact form at 19.1.1.** It symlinks into
  the *user plugins root* (`~/.omp/plugins/node_modules`), which `PI_CODING_AGENT_DIR` doesn't
  move. To keep Tim's setup untouched it was run with `HOME=<tmp>` (the whole `~/.omp` tree,
  plugins included, then lives in the temp dir). omp started from that HOME with no `-e` drew the
  Claude Desktop card, logged no extension errors and showed no error notice.
  `omp config set composer.shape claude-desktop` / `band` both validate and stick.
