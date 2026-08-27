# Tasks: Remote Links

## 1. Implementation

- [ ] 1.1 Add `addRemoteLink`/`getRemoteLinks` to `JiraClient`, the `remoteLinks.ts` action module (write/read permissions), and registration; update the discovery test (31 actions, 15 read-only); verify with msw client tests and registry-mock tests covering the spec scenarios.

## 2. Templates, docs & verification

- [ ] 2.1 Create the two templates (linked-title table for get-remote-links), update `all.yaml`, fixture tests (31 templates, new table), and the README; verify renders via nunjitsu, run the verification suite, and boot-smoke-test (31 actions, 31 templates).
