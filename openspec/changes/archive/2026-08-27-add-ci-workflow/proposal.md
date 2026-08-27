# Proposal: CI Workflow

## Why

Every PR so far has been merged without any automated gate — the 551-test suite, typecheck, lint, formatting, and backend build only run when someone remembers to run them locally. A CI workflow makes the verification suite the merge gate it should be.

## What Changes

- A GitHub Actions workflow (`.github/workflows/ci.yaml`) runs on pull requests and pushes to `main`: install (immutable), prettier check, typecheck, full-repo lint, full test suite, and the backend build.
- `.prettierignore` gains the pre-existing unformatted paths (`.claude/`, `openspec/config.yaml`) so `prettier:check` — and therefore CI — is green without reformatting files this repo treats as tool-owned.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None — tooling only, no runtime behavior changes (`skip_specs: true`).

## Impact

- New `.github/workflows/ci.yaml`; one line added to `.prettierignore`. No plugin code changes.
- The PR for this change is itself the end-to-end test: its checks must run and pass before merging.
