# Tasks: Sprint Work Item Views and Insights

## 1. Implementation

- [ ] 1.1 Add `getSprint`, `listSprintIssues` (offset cursor, status category, assignee display name), and `moveToBacklog` to `JiraClient`; implement and register `list-sprint-work-items`, `get-sprint-insights` (paged aggregation per D2), and `move-to-backlog`; update the discovery test (36 actions, 17 read-only); verify with msw and registry-mock tests covering the spec scenarios.

## 2. Templates, docs & verification

- [ ] 2.1 Create the three templates (items table, insights summary + Name/Count tables, backlog array input), update `all.yaml`, fixture tests (36 templates, new table/section assertions), and the README; verify renders via nunjitsu, run the verification suite, and boot-smoke-test (36 actions, 36 templates).
