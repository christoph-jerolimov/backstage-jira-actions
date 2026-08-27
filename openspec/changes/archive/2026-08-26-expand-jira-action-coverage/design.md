# Design: Expand Jira Action Coverage

## Context

See proposal.md. Everything builds on the established seams: `JiraClient` owns endpoints and Cloud/Data-Center differences, `toWriteValue`/`readRichText` own rich text, actions live one-per-module with `register*Action({actionsRegistry, connections, catalog?})`, and templates follow a fixed fixture-tested shape. New Jira surface used here: `GET /user/search` (Cloud `query=`, DC `username=`), `GET /issue/{key}/transitions`, `GET /issueLinkType`, `POST /issueLink`, `GET /field`, `GET|POST /issue/{key}/worklog`, `POST|DELETE /issue/{key}/watchers`, `DELETE /issue/{key}`, and the Agile API under `/rest/agile/1.0` (`GET /board`, `GET /board/{id}/sprint`, `POST /sprint/{id}/issue`) which uses the same path on both products. Pagination: Cloud's enhanced search (`POST /search/jql`) pages with `nextPageToken`; DC search and comments on both products page with `startAt`/`total`. Feasibility verified in this repo's Backstage version: `coreServices.permissions` and `coreServices.permissionsRegistry` exist, `@backstage/plugin-permission-common` (`createPermission`) is installed, and the actions-registry handler context carries `credentials`.

## Goals / Non-Goals

**Goals:**

- Thirteen new thin actions over new `JiraClient` methods; per-product differences stay inside the client.
- One opaque `pageToken` cursor abstraction for both pagination models, so agents page the same way everywhere.
- Coarse permission gating (read/write/delete) that is a no-op under the default allow-all policy.
- `customFields` as a verbatim pass-through keyed by field id — no schema knowledge in the plugin; `list-fields` provides discovery.

**Non-Goals:**

- No sprint/board management (create/close sprints, board config) — read and move only.
- No attachments, no comment/worklog editing or deletion, no bulk delete.
- No per-project or conditional permission rules — three coarse permissions only; policies can refine later.
- No validation or coercion of custom field values (Jira validates; errors propagate).

## Decisions

### D1: Client methods (core API)

- `searchUsers(query, {maxResults})` — Cloud `GET /user/search?query=`, DC `GET /user/search?username=`; normalize to `{id: accountId|name, displayName, email?, active}`.
- `listTransitions(issueKey)` — extracted from the existing transition lookup so `transition-work-item` and `list-transitions` share it; returns `{id, name, toStatus}`.
- `listLinkTypes()` — `GET /issueLinkType`; `linkIssues(issueKey, targetKey, linkType)` resolves the type case-insensitively against name/outward/inward. Jira semantics: the outward issue is the subject of the outward description ("PROJ-1 blocks PROJ-2" → outward=PROJ-1, inward=PROJ-2). Name/outward match → `outwardIssue: issueKey, inwardIssue: targetKey`; inward match → swapped. Unknown type → error listing available types (name/outward/inward), no POST.
- `listFields({name?})` — `GET /field`, client-side case-insensitive substring filter on name and id; maps `{id, name, custom, type: schema?.type}`.
- `getWorklogs(issueKey, {maxResults})` / `addWorklog(issueKey, {timeSpent, started?, comment?})` — comment written via `toWriteValue` and read via `readRichText`, exactly like descriptions.
- `addWatcher`/`removeWatcher` — `POST /issue/{key}/watchers` with the bare JSON-string user id; `DELETE /issue/{key}/watchers?accountId=` (Cloud) / `?username=` (DC).
- `deleteIssue(issueKey, {deleteSubtasks})` — `DELETE /issue/{key}?deleteSubtasks=…`, 204 on success.
- `getIssue` additionally requests `issuelinks` plus any caller-listed custom field ids; links map to `{type: link.type.name, direction: outwardIssue ? type.outward : type.inward, key: (outwardIssue ?? inwardIssue).key}`; custom field values returned raw under their ids.
- `createIssue`/`updateIssue` spread `customFields` into the request `fields` verbatim (after the standard fields, so an id collision favors the explicit custom value).

### D2: Agile API

The `request` helper gains an `api: 'core' | 'agile'` option (default `core`): `core` keeps the versioned base (`/rest/api/3|2`), `agile` uses `/rest/agile/1.0` on both products. New methods: `listBoards({name?, projectKey?, maxResults})` (`GET /board`, server-side `name`/`projectKeyOrId` params), `listSprints(boardId, {state?, maxResults})` (`GET /board/{id}/sprint`), `moveToSprint(sprintId, issueKeys)` (`POST /sprint/{id}/issue {issues}}`, max 50 keys enforced in the input schema).

### D3: Pagination cursor

One abstraction for both models: input `pageToken?: string`, output `nextPageToken?: string`, combined with the existing `maxResults`. Cloud search passes the token through to `POST /search/jql` and returns Jira's `nextPageToken` (absent on the last page). Offset-based endpoints (DC search, comments on both products) encode the next offset as a decimal string: token in → `startAt = parseInt`, token out → `String(startAt + returned)` only when `total` shows more remain. A non-numeric token on an offset-based endpoint is an InputError. The action layer just forwards `pageToken` and surfaces `nextPageToken`; which model applies stays inside the client.

### D4: Permissions

`src/permissions.ts` exports three basic permissions via `createPermission`: `jira.work-item.read`, `jira.work-item.write`, `jira.work-item.delete`, plus a `jiraActionsPermissions` list. `plugin.ts` adds `permissions: coreServices.permissions` and `permissionsRegistry: coreServices.permissionsRegistry` deps, registers the list on init, and passes the permissions service into every `register*Action`. A shared helper `assertPermission(permissions, permission, credentials)` calls `authorize` with the handler's `credentials` and throws `NotAllowedError` on DENY — invoked first in every handler: read actions check read, writes check write, `delete-work-item` checks delete. Under the default policy `authorize` returns ALLOW, so behavior is unchanged; tests exercise DENY via a mocked permissions service.

### D5: New action shapes

| action           | inputs                                                         | output                        | attributes           |
| ---------------- | -------------------------------------------------------------- | ----------------------------- | -------------------- |
| search-users     | query, maxResults?, host?                                      | users[]                       | readOnly, idempotent |
| list-transitions | issueKey, host?                                                | key, transitions[]            | readOnly, idempotent |
| list-link-types  | host?                                                          | linkTypes[]                   | readOnly, idempotent |
| link-work-items  | issueKey, targetKey, linkType, host?                           | key, targetKey, linkType, url | idempotent           |
| list-fields      | name?, host?                                                   | fields[]                      | readOnly, idempotent |
| get-worklogs     | issueKey, commentFormat?, maxResults?, host?                   | key, url, worklogs[]          | readOnly, idempotent |
| add-worklog      | issueKey, timeSpent, comment?, commentFormat?, started?, host? | key, worklogId, url           | not idempotent       |
| add-watcher      | issueKey, user, host?                                          | key, url                      | idempotent           |
| remove-watcher   | issueKey, user, host?                                          | key, url                      | idempotent           |
| list-boards      | name?, projectKey?, maxResults?, host?                         | boards[]                      | readOnly, idempotent |
| list-sprints     | boardId, state?, maxResults?, host?                            | sprints[]                     | readOnly, idempotent |
| move-to-sprint   | sprintId, issueKeys[1..50], host?                              | sprintId, issueKeys           | idempotent           |
| delete-work-item | issueKey, deleteSubtasks?, host?                               | key                           | **destructive**      |

All keep `destructive: false` except `delete-work-item`. Existing actions change only as specced (customFields, links, pagination).

### D6: Templates

Thirteen new template files following the fixed shape; `all.yaml` grows to twenty-six targets. Table first-blocks (same `{% for %}` pattern as the existing three) for search-users, list-transitions, list-link-types, list-fields, list-boards, and list-sprints with the columns from the spec; get-worklogs renders sections like get-comments; move-to-sprint takes `issueKeys` as an array parameter; delete-work-item is a plain result template (its destructiveness lives in the action attributes, and running the template is already an explicit manual act). Rendering of every new/first block is verified against the `nunjitsu` renderer with sample and empty outputs, as before. Fixture tests: inventory of twenty-six, required-input map, table-column and section assertions, format-selector map gains `get-worklogs`/`add-worklog` (`commentFormat`), issue-link outputs extended.

### D7: Testing

- Client: msw tests per new endpoint on both products where behavior differs (user search params, watcher remove query param, worklog rich text, agile paths, link direction resolution, pagination token round-trips including the DC offset encoding).
- Actions: registry-mock tests covering each spec scenario, including the permission-denial test (mocked permissions service returning DENY → NotAllowedError and no msw hit) and the destructive/read-only discovery assertions (26 ids, 12 read-only, 1 destructive).
- Templates: fixture suite over twenty-six templates; nunjitsu render checks for the new first blocks; boot smoke test asserting 26 registered actions and 26 ingested templates.

## Risks / Trade-offs

- [Verbatim customFields can name standard fields] → Accepted: Jira validates field ids/values and errors propagate; the plugin adds no schema knowledge.
- [Cloud `/user/search` requires Browse-users permission] → Errors propagate with Jira's details; nothing to work around client-side.
- [Two pagination models behind one token] → The opaque-token contract hides the difference; the only observable constraint (numeric token on offset endpoints) is validated with a clear error.
- [Coarse three-permission model] → Deliberate first step; finer resource-scoped rules can be layered in a later change without breaking the permission ids.
- [`delete-work-item` is irreversible] → Marked destructive so MCP clients can require confirmation; delete permission is separate from write so policies can withhold it specifically.

## Migration Plan

Purely additive: merge, restart backend (templates re-ingest, permissions register). Rollback = revert the commit. Existing action inputs/outputs only gain optional fields.

## Open Questions

None.
