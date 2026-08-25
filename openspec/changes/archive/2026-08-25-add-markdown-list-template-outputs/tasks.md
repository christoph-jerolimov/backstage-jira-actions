# Tasks: Markdown List Outputs for Read-Operation Templates

## 1. Templates & tests

- [x] 1.1 Rework the output of `list-projects.yaml`, `list-issue-types.yaml`, and `search-work-items.yaml` to two text blocks — a Markdown list (per-item bullets per design D1) first and the retitled `JSON` dump second; verify each file parses as YAML and the list block renders correctly against the `nunjitsu` renderer with sample and empty step outputs.
- [x] 1.2 Extend the template fixture tests with the two-block output assertions for the three list templates; verify the suite passes.

## 2. Verification

- [x] 2.1 Run `yarn tsc`, the plugin tests, `yarn prettier --check` on changed paths, and a backend boot smoke test confirming the templates still ingest; verify all pass.
