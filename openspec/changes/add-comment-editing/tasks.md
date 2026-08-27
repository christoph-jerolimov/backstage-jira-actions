# Tasks: Comment Editing

## 1. Implementation

- [ ] 1.1 Add `updateComment`/`deleteComment` to `JiraClient`, the `commentEditing.ts` action module (write/delete permissions, destructive delete), and registration; update the discovery test (33 actions, destructive pair); verify with msw and registry-mock tests covering the spec scenarios.

## 2. Templates, docs & verification

- [ ] 2.1 Create the two templates, update `all.yaml`, fixture tests (33 templates, format param for update-comment), and the README (action table + permissions note); run the verification suite and boot-smoke-test (33 actions, 33 templates).
