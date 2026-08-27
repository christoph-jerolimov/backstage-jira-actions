# Tasks: Version, Component and Field Support

## 1. Client

- [ ] 1.1 Add `listVersions`, `listComponents`, `createVersion` (project-id resolution) and the fixVersions/affectsVersions/components field mapping in `toOptionalFields`/`getIssue`; verify with msw tests for the mappings, the two-step create, and error cases.

## 2. Actions

- [ ] 2.1 Implement and register `list-versions`, `list-components` (read, catalog-aware), and `create-version` (write, catalog-aware); extend `create-work-item`/`update-work-item` inputs and `get-work-item` outputs; update the discovery test (29 actions, 14 read-only); verify with registry-mock tests covering the spec scenarios.

## 3. Templates, docs & verification

- [ ] 3.1 Create the three new templates (tables for the two list actions), extend the create/update templates with the new array parameters, update `all.yaml`, fixture tests (29 templates, new tables, entity pickers), and the README; verify renders via nunjitsu, then run the full verification suite (tsc, lint, tests, prettier, build) and the boot smoke test (29 actions, 29 templates).
