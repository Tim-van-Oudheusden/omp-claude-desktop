# claude-desktop-extensions

Three extensions that make omp inside the Herdr desktop app look and work more like the Claude
desktop app. Read `README.md` for the list and build order, then the spec for the extension you
are working on (`specs/0N-*.md`). `specs/references.md` lists every external source and API the
specs rely on.

## How to work through a spec

- Work one spec at a time, milestone by milestone, in the order the spec gives. Each milestone
  ends with its acceptance checks passing and a commit.
- Each spec has an "Open questions" section. Answer them with a spike (a throwaway script or a
  recorded probe) before building on the answer, and write what you found into the spec under
  "Findings" in the same commit. If a finding changes the design, update the spec first.
- Stop and ask Tim when: a spec's assumption turns out false and there are several ways forward;
  a step would publish anything (push to an upstream repo, open a PR or issue on someone else's
  repo, publish a package); or a step would change his live omp or Herdr configuration.
- Out of scope unless a spec says otherwise: new settings in omp itself, changes to omp's or
  Herdr's source, and theme colors (those live in the sibling theme repos).

## Sources of truth

- **omp**: the installed version is the truth (`omp --version`, recorded in `docs/versions.md`).
  Read APIs at that tag of `can1357/oh-my-pi`, not `main`: `docs/extensions.md`,
  `docs/rpc.md`, `packages/coding-agent/src/extensibility/extensions/types.ts`,
  `packages/coding-agent/src/ui/styles/composer/shapes.ts`. `main` runs ahead. If an API a spec
  needs is missing at the installed tag, stop and say which.
- **omp's own authoring guide**: `docs/skills/authoring-extensions.md` in the omp repo (factory
  signature, imports, local testing).
- **Herdr**: `~/.config/herdr-app/AGENTS.md` (written by the running app). Never edit it or the
  shipped mods/layouts in the Herdr home.
- **herdr-chat**: its `CONTRIBUTING.md`, `docs/dev/providers.md` (the adapter
  seam) and `docs/dev/protocol.md`. Inside `herdr-chat/`, its conventions beat this file's.

## You are probably running inside omp, inside Herdr

Keep the person's own setup intact:

- Never write `~/.omp/agent/config.yml` or `~/.omp/agent/extensions/`. Test with a throwaway agent
  dir (`PI_CODING_AGENT_DIR=$(mktemp -d)`) or a config overlay (`omp --config overlay.yml`), and
  load an extension under test with `omp -e <path>` rather than installing it.
- Test omp in a new Herdr tab, never in the terminal you run in. Drive it with `hc keys`;
  `hc send` delivers an agent message and starts a model turn (it costs money and changes the
  session). Screenshot with `herdr-app shot <file.png>` and look at the picture.
- Use a copy of a session for visual checks (`omp --session-dir <tmp> --resume <copy>`), never a
  live one.
- Model calls cost money: prefer recorded fixtures and fakes; a live run uses the cheapest model
  and is opt-in (`LIVE=1`).

## Code

- omp extensions are TypeScript run by omp's bundled Bun. Import host values from
  `@oh-my-pi/pi-coding-agent` and UI from `@oh-my-pi/pi-tui` only (their root exports); deeper
  paths are internal and break across versions. Type-only imports from internal paths are
  acceptable when the root doesn't export a type, and must be listed in `docs/versions.md`.
- Keep each extension in its own folder with an `index.ts` default-exporting the factory, and no
  module-level mutable state (omp shares module globals between parent and subagent bindings:
  keep state in the factory closure).
- Tests: `bun test` under `plugin/test/`. Test what a person would see (the rows drawn, the labels
  chosen), not internals.

## Verify every change

1. `bun test` (plugin) or `npm test` + `npm run typecheck` (herdr-chat) pass.
2. omp loads the extension without errors: `PI_CODING_AGENT_DIR=$(mktemp -d) omp -e <path>`,
   then check for an extension error notice. A broken extension does not stop omp; it reports.
3. Visual changes: a Herdr screenshot in dark and light (`COLORFGBG=0;15` makes a non-TTY omp
   pick the light theme), at a wide (≥160 columns) and a narrow (≈60 columns) pane. Attach both
   to the commit's PR description or `docs/screens/`.

## Commits

Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`), scoped by extension:
`feat(composer): …`, `feat(folding): …`, `feat(omp-provider): …`. Straight to `main` here; inside
`herdr-chat/` use a branch (`feat/omp-provider`) and that repo's rules.
