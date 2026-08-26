# Tasks: Expand Jira Action Coverage

## 1. Client extensions

- [ ] 1.1 Add the core-API methods: `searchUsers` (per-product query params, normalized assignable `id`), `listTransitions` (extracted so the transition action shares it), `listLinkTypes`, `linkIssues` (name/outward/inward resolution with direction swap, unknown-type error listing available types), `listFields` (client-side name/id filter), `getWorklogs`/`addWorklog` (rich-text comments via the existing helpers), `addWatcher`/`removeWatcher` (per-product body/query param), and `deleteIssue`; verify with msw tests per endpoint on both products where behavior differs.
- [ ] 1.2 Add the Agile API support: `api: 'core' | 'agile'` option on the request helper (`/rest/agile/1.0` on both products), `listBoards`, `listSprints`, `moveToSprint`; verify with msw tests for the agile paths, filters, and error cases.
- [ ] 1.3 Add the pagination cursor (`pageToken`/`nextPageToken`: Cloud search pass-through, offset encoding for DC search and comments per D3, numeric-token validation), `issuelinks` + requested custom fields on `getIssue` (link direction mapping), and verbatim `customFields` spreading on `createIssue`/`updateIssue`; verify with msw tests for token round-trips on both models, link mapping, and custom-field request bodies.

## 2. Permissions (spec: jira-work-item-actions)

- [ ] 2.1 Create `src/permissions.ts` (read/write/delete permissions + list), register them via `coreServices.permissionsRegistry` in `plugin.ts`, add the shared `assertPermission` helper, and wire the permissions service plus the matching permission check into every existing action handler (before any Jira/catalog call); verify with registry-mock tests: a DENY decision fails with NotAllowed before any HTTP call, and the default ALLOW leaves existing tests passing.

## 3. New actions (spec: jira-work-item-actions)

- [ ] 3.1 Implement and register the discovery reads: `search-users`, `list-transitions`, `list-link-types`, `list-fields` (read permission, readOnly attributes); verify with registry-mock tests covering each spec scenario.
- [ ] 3.2 Implement and register `link-work-items` (write permission; type resolution and direction semantics per D1); verify with registry-mock tests for name match, inward-description reversal, unknown type, and unknown issue.
- [ ] 3.3 Implement and register `get-worklogs` (read) and `add-worklog` (write, `commentFormat` rich text); verify with registry-mock tests covering the spec scenarios.
- [ ] 3.4 Implement and register `add-watcher` and `remove-watcher` (write); verify with registry-mock tests covering the spec scenarios on both products.
- [ ] 3.5 Implement and register the agile actions: `list-boards`, `list-sprints` (read), `move-to-sprint` (write, 1–50 issue keys); verify with registry-mock tests covering the spec scenarios.
- [ ] 3.6 Implement and register `delete-work-item` (delete permission, `destructive: true`, `deleteSubtasks` default false); verify with registry-mock tests for delete, subtask rejection passthrough, and unknown issue.

## 4. Extended actions (spec: jira-work-item-actions)

- [ ] 4.1 Add `customFields` to `create-work-item` and `update-work-item` (record input, counts as updatable, verbatim pass-through); verify with registry-mock tests asserting the request bodies and the lone-customFields update.
- [ ] 4.2 Add `links` output and the `customFields` read selection to `get-work-item`; verify with registry-mock tests for link direction rendering and selected custom field values.
- [ ] 4.3 Add `pageToken`/`nextPageToken` to `search-work-items` and `get-comments`; verify with registry-mock tests for next-page fetches, last-page absence of the token, and the invalid-token error.
- [ ] 4.4 Update the registration and discovery test: twenty-six actions, twelve read-only, `delete-work-item` the only destructive one.

## 5. Templates, docs & verification

- [ ] 5.1 Create the thirteen new template files, add them to `all.yaml`, with table first-blocks (per-spec columns) for the six new list actions, sections for `get-worklogs`, and an array parameter for `move-to-sprint`; verify all files parse and the new first blocks render via `nunjitsu` with sample and empty outputs.
- [ ] 5.2 Update the template fixture tests (twenty-six-template inventory, required-input/format/entity metadata, new table and section assertions) and the plugin `README.md` (action table, permission section, custom-fields and pagination notes); verify the suite and `yarn prettier --check` pass.
- [ ] 5.3 Run the verification suite — `yarn tsc`, plugin lint and tests, `yarn build:backend` — and boot-smoke-test the backend confirming twenty-six actions register and twenty-six templates ingest; verify all pass.
