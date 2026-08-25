# Design: Expand Jira Actions

## Context

See proposal.md for motivation. This builds directly on the archived `add-jira-workitem-actions` change: `JiraConnectionsReader`, `JiraClient` (v3 for Cloud / v2 for Data Center, typed error mapping, no credential leakage), the `textToAdf` helper, per-action registration modules, and the msw + `actionsRegistryServiceMock` test setup all exist and are reused. One relevant external constraint: Jira Cloud deprecated the classic `GET/POST /rest/api/3/search` endpoint in favor of `/rest/api/3/search/jql` (token-paged, requires an explicit `fields` list), while Data Center still uses `POST /rest/api/2/search` (offset-paged). Cloud rich-text fields (description, comment bodies) are ADF documents; Data Center uses plain strings.

## Goals / Non-Goals

**Goals:**

- Six new actions on the existing plugin, each in its own `src/actions/*.ts` module following the established `register*Action({ actionsRegistry, connections })` pattern.
- All Jira specifics (endpoints, product differences, ADF conversion) stay in `JiraClient`/`lib`; action modules only map inputs to client calls and shape outputs.
- Outputs stay flat and plain-text so MCP/AI consumers can use them without understanding Jira's response shapes.
- A manual test surface in the Backstage UI: one software template per action (all eight), each running the real registry action end-to-end.

**Non-Goals:**

- No pagination cursors surfaced to callers (bounded `maxResults` only; a follow-up can add token/offset paging if needed).
- No comment reading/listing, attachment handling, custom fields, or issue linking.
- No changes to `jira-connections` behavior or the connections config surface.
- The templates are test/demo fixtures, not production workflows — no fetch/publish steps, no entity registration, no per-template access control.

## Decisions

### D1: Client methods per endpoint, product differences resolved inside the client

`JiraClient` gains `getIssue`, `searchIssues`, `addComment`, `listTransitions` + `transitionIssue`, `listProjects`, and `getProject` (for issue types). The existing `request` helper is generalized to support GET (no body) and query parameters; error mapping via `throwForResponse` is reused unchanged.

Product-specific handling, mirroring the existing description logic:

- **Search**: Cloud → `POST {apiBase}/search/jql` with `{ jql, maxResults, fields: [...] }`; Data Center → `POST {apiBase}/search` with `{ jql, maxResults, fields: [...] }`. Both return `issues[]`; the client normalizes to one result shape. The deprecated Cloud endpoint is not used.
- **Projects**: Cloud → `GET /project/search?maxResults=N` (reads `values[]`); Data Center → `GET /project` (full array, truncated to `maxResults` client-side).
- **Issue types**: `GET /project/{projectKey}` on both products; the response's `issueTypes[]` is normalized to `{id, name, subtask, description?}`.
- **Comment body / description reading**: ADF on Cloud, strings on Data Center (see D2).

_Alternative considered_: a generic `search`-only client method with callers building URLs — rejected; keeping endpoint knowledge in the client is what made the first change easy to test and would keep a future framework-connections migration contained.

### D2: `adf.ts` gains `adfToText`

The inverse of the existing `textToAdf`: recursively collect `text` node values, joining block-level nodes (`paragraph`, `heading`, `listItem`, `codeBlock`, …) with newlines. Lossy by design — formatting, mentions, and media are dropped, matching the plain-text contract of the action outputs. Used by `getIssue` for Cloud descriptions; Data Center strings pass through. A field that is neither string nor ADF object yields `undefined` rather than throwing.

### D3: Simplified search filters compile to JQL in the action module

`search-work-items` accepts either `jql` or filters (`projectKey`, `text`, `status`, `issueType`, `assignee`, `labels`). The action module builds JQL from filters — `project = "PROJ" AND status = "In Progress" AND text ~ "..." AND labels IN (...) ORDER BY updated DESC` — quoting values by escaping embedded quotes/backslashes. Providing both `jql` and filters is an `InputError` (ambiguous intent), as is providing neither. JQL construction lives in a small exported helper (`buildJql`) so it is unit-testable without HTTP.

_Alternative considered_: always require raw JQL — rejected; JQL syntax errors are the most common agent failure mode, and the filter path removes it for the typical queries.

### D4: Transition resolution with idempotent no-op

`transition-work-item` first calls `getIssue` (one extra request) to learn the current status; if it already equals the target (case-insensitive) the action returns success without transitioning, making repeated invocations safe (`idempotent: true`). Otherwise it fetches `GET /issue/{key}/transitions`, matches the target against each transition's `to.name` first and its `name` second (case-insensitive), and executes `POST /issue/{key}/transitions` with the matched id. No match → `InputError` listing the reachable status names, which gives an agent exactly what it needs to retry correctly.

### D5: Action attributes

| action               | readOnly | idempotent | destructive |
| -------------------- | -------- | ---------- | ----------- |
| get-work-item        | true     | true       | false       |
| search-work-items    | true     | true       | false       |
| list-projects        | true     | true       | false       |
| list-issue-types     | true     | true       | false       |
| add-comment          | false    | false      | false       |
| transition-work-item | false    | true       | false       |

### D6: One generic scaffolder bridge action, in a separate scaffolder module

Template steps run scaffolder actions, not registry actions, so testing registry actions from templates needs a bridge. A new package `plugins/scaffolder-backend-module-jira-actions` (role `backend-plugin-module`, pluginId `scaffolder`, moduleId `jira-actions`) registers **one** generic scaffolder action `jira:action:invoke` via `scaffolderActionsExtensionPoint`, with input `{actionId, input?}`. It depends on `actionsServiceRef` (`@backstage/backend-plugin-api/alpha`) — the same service the MCP backend uses — and calls `actions.invoke({ id: actionId, input, credentials: await ctx.getInitiatorCredentials() })`, writing the returned output to the step output `result`. Since the module runs inside the scaffolder plugin, the actions service resolves actions from the plugins in `backend.actions.pluginSources`, which already includes `jira-actions`.

Guardrail: `actionId` must start with `jira-actions:` — anything else is an `InputError` before invocation. The bridge exists to test this plugin's actions, not to become a generic invoke-anything scaffolder action.

_Alternative considered_: eight dedicated scaffolder actions (one per registry action) — rejected: pure duplication of the registry's schemas; the registry already validates input, and the templates provide the per-action typed surface. Also considered registering scaffolder actions from inside `jira-actions-backend` — rejected: scaffolder actions must be contributed by a module of the scaffolder plugin, not by another plugin.

### D7: Template fixtures under `examples/`, one per action

Eight `Template` entities live in `examples/jira-actions-templates/` (`create-work-item.yaml`, …, `list-issue-types.yaml`), plus an `all.yaml` `Location` entity listing them, registered once in `app-config.yaml` under `catalog.locations` with a `Template, Location` rule — same pattern as the existing example template. Each template follows one shape:

- `metadata`: name `jira-test-<action>`, tagged `jira` + `test`, title/description taken from the action.
- `parameters`: one form page mirroring the action's input schema — required fields required, optional fields optional, same descriptions; array inputs (`labels`) as string arrays, `maxResults` as number with the action's default.
- `steps`: a single step `id: invoke` running `jira:action:invoke` with the hardcoded `actionId` for that template and `input` assembled from `${{ parameters.* }}`.
- `output`: `text` block rendering the step's `result` as pretty-printed JSON, and for the issue-scoped actions (create, update, get, comment, transition) a `links` entry pointing at `${{ steps.invoke.output.result.url }}`.

Optional parameters left empty in the form are omitted from `input` via the scaffolder's `${{ ... }}` handling so the registry's zod validation sees them as absent, not empty strings — templates use conditional includes where needed.

### D8: Testing strategy

Same pattern as the existing suites: msw handlers asserting method/path/query/body per product for the new client methods (including the Cloud `search/jql` vs Data Center `search` split), pure unit tests for `adfToText` and `buildJql`, and action-level tests through `actionsRegistryServiceMock` covering each spec scenario (including transition no-op, unreachable status listing, and the jql/filters conflict). The `lists both actions` discovery test is updated to expect all eight actions and assert the read-only attributes.

For the bridge: unit tests with `createMockActionContext` from `@backstage/plugin-scaffolder-node-test-utils` and a mocked actions service, covering invocation pass-through, the namespace guardrail, and error propagation. For the templates: a jest test that loads each YAML fixture, checks it parses as a `Template` with a `jira:action:invoke` step whose `actionId` matches the file, and asserts required action inputs appear as required template parameters; full-form UI behavior is covered by the boot smoke test plus manual runs rather than e2e automation.

## Risks / Trade-offs

- [Cloud `search/jql` endpoint behavior differs subtly from the legacy endpoint (no `total`, token paging)] → The action's contract deliberately omits totals and paging; only `maxResults` items are requested, so the difference is invisible to callers.
- [`transition-work-item` costs two to three requests] → Accepted for the idempotent no-op and better error messages; all calls are to the same host.
- [JQL built from filters could mis-handle exotic values (quotes, reserved words)] → Values are escaped and always quoted; `buildJql` unit tests cover quoting edge cases. Raw `jql` input remains the escape hatch.
- [`GET /project/{key}` issue types include workflow-invalid types in some Jira setups] → Accepted; `create-work-item` still surfaces Jira's 400 with details if an unusable type is chosen.
- [ADF→text is lossy for complex documents (tables, media)] → By design; documented in the README as plain-text rendering.

- [The bridge lets any template author invoke Jira write actions with the service credential] → Same trust boundary as the actions/MCP endpoints today (allow-all permission policy); the `jira-actions:` namespace restriction keeps the blast radius to this plugin, and real permission policies remain the documented follow-up.
- [Scaffolder templating of empty optional parameters could send empty strings to the registry] → Templates conditionally include optional inputs; the template fixture tests assert required-vs-optional wiring.

## Migration Plan

Additive: merge, `yarn install` (new workspace package), restart backend. Config changes are limited to the new `catalog.locations` entry for the templates; existing actions are untouched. Rollback = revert the commit (removing the module from `packages/backend/src/index.ts` and the catalog location with it).

## Open Questions

None — naming (`search-work-items` plural), scope, and the template test surface were settled in the proposal.
