# Tasks: Add Jira Work Item Actions Plugin

## 1. Plugin scaffolding

- [x] 1.1 Scaffold the backend plugin with `yarn new` (backend-plugin, ID `jira-actions`, plugin ID `jira-actions` in `createBackendPlugin`) at `plugins/jira-actions-backend`; verify `yarn install` succeeds and the package appears in the workspace (`yarn workspaces info` or `yarn workspace backstage-plugin-jira-actions-backend lint` runs).
- [x] 1.2 Trim the scaffold to this plugin's needs (remove generated router/todo example code, keep `plugin.ts`/`index.ts`), add `zod` dependency; verify `yarn tsc` passes.

## 2. Jira connections (spec: jira-connections)

- [x] 2.1 Implement zod schemas and types for `type: jira` entries of the `connections` config (host, apiBaseUrl default `https://<host>`, product default `cloud`, title default, auth methods `basic` {username, apiToken} and `pat` {token}); verify with unit tests covering defaults and each auth method.
- [x] 2.2 Implement `JiraConnectionsReader` with `find({host?, authMethods?})` semantics per spec (first-connection default, host match, `NotFoundError` when nothing matches, `InputError` at init for invalid entries, non-jira types ignored); verify with unit tests using `mockServices.rootConfig` fixtures for each spec scenario.
- [x] 2.3 Add `config.d.ts` declaring the `connections` section with `@visibility secret` on `apiToken` and `token`, and wire it via the package `configSchema` field; verify `yarn backstage-cli config:check` (with a sample jira connection in local config) reports no errors and masks secrets in `config:print`.

## 3. Jira REST client (spec: jira-work-item-actions)

- [x] 3.1 Implement `JiraClient` (createIssue/updateIssue) with per-product API version (v3 cloud, v2 datacenter), auth header construction, plain-text→ADF description wrapping for cloud, assignee mapping (accountId vs username), `parent: {key}` mapping, and browse URL construction; verify with msw-based unit tests asserting request method, path, headers, and body for both products.
- [x] 3.2 Implement error mapping (400→`InputError` with Jira error payload, 404→`NotFoundError`, 401/403→`NotAllowedError`) and assert no Authorization/credential material appears in error messages; verify with msw-based unit tests per status code.

## 4. Actions (spec: jira-work-item-actions)

- [x] 4.1 Register `create-work-item` in the plugin's `registerInit` via `actionsRegistryServiceRef` with the spec'd input/output zod schemas and descriptions suitable for AI consumers; verify with a `startTestBackend` + `actionsRegistryServiceMock` test creating an issue against an msw-mocked Jira (minimal input and full-input scenarios).
- [x] 4.2 Register `update-work-item` with the spec'd schemas, including the "at least one updatable field" refinement; verify with tests for a successful summary update, the no-fields rejection (no HTTP call made), and the unknown-issue NotFound scenario.
- [x] 4.3 Cover connection selection in action tests: default connection used without `host` input, `host` input selects the matching connection, and a config-pointing error when no jira connection is configured; verify all three spec scenarios pass.

## 5. Backend wiring & docs

- [x] 5.1 Add the plugin to `packages/backend/package.json` and `packages/backend/src/index.ts`, and add `jira-actions` to `backend.actions.pluginSources` plus a commented example `connections` entry in `app-config.yaml`; verify `yarn tsc` and `yarn build:backend` succeed.
- [x] 5.2 Write the plugin `README.md` (configuration example for cloud and datacenter, action reference, MCP exposure note, forward-compat note on the connections framework from design.md); verify the README's config example round-trips through `config:check`.
- [x] 5.3 Run the repo verification suite — `yarn tsc`, `yarn lint:all`, `yarn prettier:check`, `yarn test` for the new plugin — and verify all pass; optionally smoke-test `yarn start` boots with a dummy jira connection configured.
