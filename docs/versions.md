# Versions

Fill in before work starts, and update when any of these changes. Specs are checked against the
versions here, not against `main`.

| Component | Version | Checked on |
|---|---|---|
| omp (`omp --version`) | 19.1.1 (tag `v19.1.1`, commit 31ffee5) | 2026-11-24 |
| Herdr app (`herdr-app --version`) | 0.1.18 | 2026-11-24 |
| herdr-core (`hc --version`) | 0.1.22 | 2026-11-24 |
| herdr-chat (submodule commit) | not added yet (spec 01) | 2026-11-24 |
| Bun bundled with omp | 1.4.4 (from the `omp` binary's strings) | 2026-11-24 |

The global `@oh-my-pi/*` packages under `~/.bun/install/global/node_modules` are 18.13.3 and are
not what runs: `~/.bun/bin/omp` is a standalone compiled binary. Read sources at the tag above.

## Internal omp imports in use

Type-only imports from paths other than `@oh-my-pi/pi-coding-agent` / `@oh-my-pi/pi-tui` roots,
with the omp version they were checked on:

| Import | Used by | Checked on |
|---|---|---|
| none | | |
