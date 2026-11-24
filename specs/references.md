# References

Pinned to what the specs were written against (2026-11-24). Re-read at the versions recorded in
`docs/versions.md` before relying on any of it.

## omp (can1357/oh-my-pi), `main` at v19.1.1 (commit d1d9269)

| What | Where |
|---|---|
| Extension API, all render hooks | `docs/extensions.md` ("Composer shape renderer", "Transcript presenter", "Constraints and pitfalls") |
| Extension types | `packages/coding-agent/src/extensibility/extensions/types.ts` (`registerComposerShape`, `registerTranscriptPresenter`, `ExtensionUIContext`) |
| Composer shapes, built-ins to copy from | `packages/coding-agent/src/ui/styles/composer/shapes.ts` (`box`, `claude`, `rule`, `field`, `rail`) |
| Composer surface color | `packages/coding-agent/src/ui/styles/composer/frame.ts` (`userMessageBg`) |
| How extensions load | `docs/extension-loading.md`; authoring guide `docs/skills/authoring-extensions.md` |
| Plugins (`omp.extensions` in package.json, `omp plugin link`) | `docs/marketplace.md`, `docs/plugin-manager-installer-plumbing.md` |
| Settings named in the specs | `packages/coding-agent/src/modes/settings.ts`: `composer.shape` (default `band`), `extensionRenderers.transcriptPresenters` (default `false`), `display.hideToolActivity`, `terminal.programStatus` |
| Tool docs (argument names) | `docs/tools/*.md` |
| RPC protocol | `docs/rpc.md` (framing v1/v2, commands, events, "Available commands", "Pi-compatible history/tree commands", extension UI sub-protocol) |
| Approvals | `docs/approval-mode.md` |
| Sessions on disk, leases | `docs/session.md` |
| CLI flags | `docs/cli-reference.md` (`--mode rpc`, `--session`, `--resume`, `-e`, `--config`, `--session-dir`) |
| Theme tokens | `docs/theme.md`, `packages/tui/src/theme/schema.ts` |

## herdr-chat (ChmaraX/herdr-chat), v0.6.0 (commit 2bc8de7)

| What | Where |
|---|---|
| Adapter seam, adding an agent | `docs/dev/providers.md` |
| Host architecture, wire protocol to the mod | `docs/dev/architecture.md`, `docs/dev/protocol.md` |
| Adapter interface | `host/providers/types.ts` |
| Pi adapter (closest model) | `host/providers/pi/` (`adapter.ts`, `rpc.ts`, `sessions.ts`, `tools.ts`, `tui.ts`) |
| Pi lock extension | `extension/herdr-chat-lock.ts` |
| Probe and fixtures | `docs/dev/research/rpc-probe/probe.mjs`, `tests/fixtures/`, `tests/fake-pi/` |
| Tests and conventions | `CONTRIBUTING.md`, `tests/host/FAILURE-MODES.md`, `tests/box/README.md` |

## Herdr desktop app (herdrdev/herdr-app)

| What | Where |
|---|---|
| Manual (layouts, mods, commands, `hc`) | `~/.config/herdr-app/AGENTS.md` on the machine (shipped from `defaults/AGENTS.md`) |
| omp icon and license | `defaults/icons/omp.svg`, `defaults/icons/LICENSE-oh-my-pi.txt` |

## Sibling repos

- `Tim-van-Oudheusden/omp-claude-theme`: the omp themes; issue #1 proposes a settings preset that
  pairs with spec 02 (`composer.shape`).
- `Tim-van-Oudheusden/herdr-claude-theme`: the Herdr layout and themes.
