# Tasks: Assignee Conveniences

## 1. Implementation

- [ ] 1.1 Add the `resolveJiraUser` helper (`lib/selfUser.ts`) and the client `unassign` support in `toOptionalFields`; wire `me` resolution into create-work-item, update-work-item, add-watcher, remove-watcher (catalog deps + plugin.ts) and the `unassign` input/conflict into update-work-item; verify with registry-mock tests covering all spec scenarios (assign/watch as me, no-match, non-user caller, unassign body, conflict) plus a client msw test for the null-assignee body.

## 2. Templates, docs & verification

- [ ] 2.1 Add the `unassign` parameter to the update-work-item template, update the README (me/unassign notes), run the verification suite (tsc, lint, tests, prettier, build) and confirm the fixture suite passes; boot smoke test unchanged counts (29/29).
