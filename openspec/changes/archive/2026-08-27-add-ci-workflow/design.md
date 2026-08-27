# Design: CI Workflow

## Context

The repo is a Yarn 4.13 (corepack) workspace on Node 22 (`engines: 22 || 24`), with the verification suite already codified as root scripts: `tsc`, `lint:all`, `test:all`, `prettier:check`, `build:backend`. `prettier:check` currently fails on eleven tool-owned files under `.claude/` and `openspec/config.yaml`; everything else is kept formatted by the development flow.

## Goals / Non-Goals

**Goals:** one required check that runs the whole local verification suite on every PR and on `main`. **Non-Goals:** the boot smoke test (needs a running backend and ~a minute of wall clock — stays a local/apply-time check), Playwright e2e, release/publish workflows, matrix builds across Node versions (22 suffices; 24 can join later).

## Decisions

- **D1 One `verify` job** on `ubuntu-latest` (timeout 15 min): checkout → `corepack enable` → `actions/setup-node@v4` (Node 22, `cache: yarn`) → `yarn install --immutable` → `yarn prettier:check` → `yarn tsc` → `yarn lint:all` → `yarn test:all` (backstage-cli runs Jest in CI mode with coverage) → `yarn build:backend`. Sequential in one job: the steps share the install, and fail-fast ordering puts the cheap checks first.
- **D2 Triggers:** `pull_request` (any base) and `push` to `main`, with a concurrency group cancelling superseded runs per ref.
- **D3 Prettier scope:** add `.claude/` and `openspec/config.yaml` to `.prettierignore` rather than reformatting them — they are written by tools whose formatting this repo does not own; everything the project authors stays checked.
- **D4 Verification:** the workflow YAML is parse-checked locally and every step's command is run locally before pushing; the real proof is the change's own PR, whose check run must complete green before the merge (checked via the PR's check runs rather than merging blind).

## Risks / Trade-offs

- [`lint:all`/`test:all` cover the app package too, not just the plugin] → Deliberate: main should be green repo-wide; today the whole repo passes.
- [No boot smoke in CI] → Accepted; it needs SQLite/backend startup time and stays part of the change workflow.

## Migration Plan

Additive; the first run happens on this change's own PR.

## Open Questions

None.
