# Tasks: CI Workflow

## 1. Implementation

- [x] 1.1 Add `.github/workflows/ci.yaml` (verify job per D1, triggers and concurrency per D2) and extend `.prettierignore` per D3; verify the YAML parses, `yarn prettier:check` now exits clean, and every workflow step passes locally.
- [x] 1.2 Push, open the PR, and confirm the workflow's check run completes green on the PR before merging (the PR is the end-to-end test).
