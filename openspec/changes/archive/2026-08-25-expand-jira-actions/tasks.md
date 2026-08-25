# Tasks: Expand Jira Actions

## 1. Library extensions

- [x] 1.1 Add `adfToText` to `src/lib/adf.ts` (recursive text extraction, block nodes joined with newlines, `undefined` for non-string/non-ADF values); verify with unit tests covering paragraphs, headings, lists, code blocks, and a non-ADF value.
- [x] 1.2 Generalize the `JiraClient` request helper for GET requests and query parameters, and add `getIssue` (normalized output incl. plain-text description via `adfToText` on cloud) plus `addComment` (ADF body on cloud, string on datacenter); verify with msw tests for both products including the 404 case.
- [x] 1.3 Add `searchIssues` to `JiraClient` — cloud `POST /rest/api/3/search/jql`, datacenter `POST /rest/api/2/search`, both with explicit `fields` list and normalized items; verify with msw tests asserting the per-product endpoint, request body, and normalized results.
- [x] 1.4 Add `listTransitions`/`transitionIssue`, `listProjects` (cloud `/project/search` vs datacenter `/project`, truncated to maxResults), and `getProject` (issue types) to `JiraClient`; verify with msw tests per product.

## 2. Read actions (spec: jira-work-item-actions)

- [x] 2.1 Implement and register `get-work-item` (`src/actions/getWorkItem.ts`, readOnly/idempotent attributes, spec'd input/output schemas); verify with registry-mock tests for the existing-issue, ADF-description, and unknown-issue scenarios.
- [x] 2.2 Implement `buildJql` helper (filters → JQL with escaping and `ORDER BY updated DESC`) and the `search-work-items` action, rejecting jql+filters together and neither; verify with unit tests for JQL quoting/escaping and registry-mock tests for the filter, raw-JQL, no-criteria, and invalid-JQL scenarios.
- [x] 2.3 Implement and register `list-projects` and `list-issue-types` (readOnly attributes, maxResults default/cap for projects, unknown-project NotFound); verify with registry-mock tests for both products' listing scenarios and the unknown-project case.

## 3. Write actions (spec: jira-work-item-actions)

- [x] 3.1 Implement and register `add-comment` (plain-text body, output `{key, commentId, url}`); verify with registry-mock tests for the comment and unknown-issue scenarios, asserting the ADF body on cloud and string body on datacenter.
- [x] 3.2 Implement and register `transition-work-item` (current-status no-op, case-insensitive match on transition target then transition name, InputError listing reachable statuses on no match, idempotent attribute); verify with registry-mock tests for the transition, no-op, and unreachable-status scenarios.

## 4. Registration, docs & verification

- [x] 4.1 Register all new actions in `src/plugin.ts` and update the discovery test to expect all eight actions with read-only attributes on the four read actions; verify the updated test passes.
- [x] 4.2 Update the plugin `README.md` action table and add usage notes (JQL vs filters, transition semantics, plain-text ADF rendering); verify `yarn prettier --check` passes on the plugin.
- [x] 4.3 Run the verification suite — `yarn tsc`, plugin lint and tests, `yarn build:backend` — and boot-smoke-test the backend confirming all eight actions register; verify all pass.

## 5. Test templates (spec: jira-action-templates)

- [x] 5.1 Create the `plugins/scaffolder-backend-module-jira-actions` package (role `backend-plugin-module`, pluginId `scaffolder`, moduleId `jira-actions`) registering the `jira:action:invoke` scaffolder action that invokes registry actions via `actionsServiceRef` with initiator credentials, guarded to the `jira-actions:` namespace; verify with `createMockActionContext` unit tests for pass-through, namespace rejection, and error propagation.
- [x] 5.2 Write the eight template fixtures in `examples/jira-actions-templates/` (one per action, parameters mirroring the action inputs, single `jira:action:invoke` step, JSON result text output and issue link where the output has a `url`) plus the `all.yaml` location file; verify with a jest test that parses each fixture and asserts the step actionId and required-parameter wiring.
- [x] 5.3 Wire the module into `packages/backend` (package.json + `src/index.ts`) and register the template location in `app-config.yaml` under `catalog.locations`; verify `yarn tsc` and `yarn build:backend` pass.
- [x] 5.4 Boot-smoke-test the backend and verify the scaffolder lists the `jira:action:invoke` action (installed-actions endpoint or startup logs) and the catalog ingests the eight templates without errors.
