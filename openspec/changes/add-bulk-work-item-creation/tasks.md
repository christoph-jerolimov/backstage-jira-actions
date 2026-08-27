# Tasks: Bulk Work Item Creation

## 1. Implementation

- [ ] 1.1 Add `createIssuesBulk` to `JiraClient` (shared field building, partial-failure error naming created keys); implement and register `create-work-items` (epic-first wiring, parentKey conflict, catalog + "me" resolution); update the discovery test (41 actions); verify with msw and registry-mock tests covering the spec scenarios.

## 2. Templates, docs & verification

- [ ] 2.1 Create the `create-work-items` template (object-array items, epic object, entity picker), update `all.yaml`, fixture tests (41 templates), and the README; run the verification suite and boot-smoke-test (41 actions, 41 templates).
