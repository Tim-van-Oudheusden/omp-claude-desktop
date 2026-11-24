# claude-desktop-extensions

Three extensions that bring an omp-in-Herdr setup closer to the Claude desktop app. The colors
already come from the sibling theme repos (`omp-claude-theme`, `herdr-claude-theme`); these add
what a theme can't: the composer's shape, how tool activity reads, and a real chat view.

| # | Extension | Runs in | Spec | Size |
|---|---|---|---|---|
| 2 | **Claude composer**: a rounded card around the prompt, model chip in its lower edge | omp (extension) | [specs/02-claude-composer.md](specs/02-claude-composer.md) | Small |
| 3 | **Folded tool calls**: finished tool calls collapse to one-line summaries ("Read src/app.ts") | omp (extension) | [specs/03-folded-tool-calls.md](specs/03-folded-tool-calls.md) | Small |
| 1 | **omp in herdr-chat**: an omp provider for ChmaraX/herdr-chat, so omp gets the native chat view | herdr-chat (fork, upstream PR) | [specs/01-herdr-chat-omp-provider.md](specs/01-herdr-chat-omp-provider.md) | Large |

**Build order: 2, then 3, then 1.** 2 and 3 are independent, a day or two each, and useful on
their own. 1 is a multi-week port into someone else's codebase and should start with an upstream
conversation.

## Layout

```
README.md                  this file
AGENTS.md / CLAUDE.md      how an agent works in this repo (read first)
specs/                     one spec per extension + shared references
plugin/                    extensions 2 and 3 as one omp plugin package (built by the agent)
  package.json             "omp": { "extensions": [...] }
  src/composer/            extension 2
  src/tool-folding/        extension 3
  test/                    bun tests
herdr-chat/                extension 1: git submodule of Tim's fork of ChmaraX/herdr-chat
docs/versions.md           the omp, Herdr and herdr-chat versions this was built and checked against
```

`plugin/` and `herdr-chat/` don't exist yet; the specs say how to create them.

## Before an agent starts (Tim)

1. Record versions in `docs/versions.md`: `omp --version`, `herdr-app --version`, `hc --version`.
   The specs were written against omp `main` at v19.1.1 and herdr-chat 0.6.0; an older omp may
   lack APIs they use (each spec lists the ones it depends on).
2. For extension 1 only: fork `ChmaraX/herdr-chat` to your account and add it as a submodule
   (`git submodule add git@github.com:<you>/herdr-chat.git herdr-chat`). Consider opening an
   issue upstream first ("omp provider: interested?") so the work lands as a PR rather than a
   fork you maintain.

## Install (once built)

```sh
omp plugin link ./plugin                                  # extensions 2 and 3 (exact form: omp plugin --help)
omp config set composer.shape claude-desktop              # extension 2
omp config set extensionRenderers.transcriptPresenters true  # extension 3
```

Extension 1 installs the way herdr-chat does (`cd herdr-chat && ./install.sh --app`).

## Kickoff prompt

Paste to the agent working in this repo, one spec per session:

> Read AGENTS.md and README.md, then specs/02-claude-composer.md. Fill in docs/versions.md from
> the installed tools, answer the spec's open questions with spikes, then work through its
> milestones in order, committing after each one's acceptance checks pass. Stop and ask me
> before anything the AGENTS.md "stop and ask" list covers.

Swap in `specs/03-folded-tool-calls.md`, then `specs/01-herdr-chat-omp-provider.md`, for the
next sessions.
