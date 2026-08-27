# Tasks: Attachment Reads, Idempotent Remote Links, and Backlog View

## 1. Implementation

- [ ] 1.1 Add `getAttachments`, the `globalId` pass-through on `addRemoteLink`/`getRemoteLinks`, and `listBacklogIssues` to `JiraClient`; implement and register `get-attachments` (new module) and `list-backlog-work-items` (agile module) with examples, and extend the remote-link action schemas; update the discovery test (43 actions, 19 read-only); verify with msw and registry-mock tests covering all spec scenarios.

## 2. Templates, docs & verification

- [ ] 2.1 Create the two templates (linked-filename attachments table, backlog work-items table), add the `globalId` parameter to the add-remote-link template, update `all.yaml`, fixture tests (43 templates, new tables), and the README; verify renders via nunjitsu, run the verification suite, and boot-smoke-test (43 actions, 43 templates).
