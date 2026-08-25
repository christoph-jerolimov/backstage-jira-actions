# Design: Jira Work Item Actions Plugin

## Context

See proposal.md for motivation. Facts that shape the design:

- Repo is a standard Backstage 1.54 monorepo (`packages/*`, `plugins/*`), backend on the new backend system (`@backstage/backend-defaults` 0.17.7, `@backstage/backend-plugin-api` ^1.10.0).
- The Actions Registry is alpha: `actionsRegistryServiceRef` and `ActionsRegistryService` are exported from `@backstage/backend-plugin-api/alpha` in the version range this repo already resolves. `@backstage/plugin-mcp-actions-backend` is already installed, and `app-config.yaml` already lists `backend.actions.pluginSources: [auth, catalog, scaffolder]` — actions from a plugin become MCP tools when its plugin ID is listed there.
- The new connections framework (`@backstage/connections` 0.3.0, BEP-14) defines a top-level `connections:` config array with entries `{type, title?, match?, auth: [{method, ...}], ...typeFields}`. As of 0.3.0:
  - Only a fixed set of connection types exists (github, gitlab, aws, azure, bitbucket, …) — **no `jira` type**.
  - `createConnectionType` is internal; there is no public API to register custom types, and `buildConnectionsFromConfig` throws on unknown types.
  - The backend service ref (`connectionsServiceRef`) was made internal and is not exported by any stable package in this repo's dependency range — the framework does not read `connections` config at all in this Backstage version.
- Jira REST: Cloud uses API v3 (`/rest/api/3`, Basic auth with email + API token, ADF or plain-text description via v2-compat), Data Center uses v2 (`/rest/api/2`, PAT bearer auth, plain-text/wiki markup description).

## Goals / Non-Goals

**Goals:**

- One small backend plugin, `plugins/jira-actions-backend`, plugin ID `jira`, following standard `backstage-cli new` layout.
- Connection resolution that reads the `connections` config section today and can be swapped for the framework `ConnectionsService` with minimal churn once Jira is a supported type.
- Action input/output schemas that are self-describing for AI agents (MCP is the primary expected consumer).
- Unit-testable Jira client with no real network in tests.

**Non-Goals:**

- No frontend plugin, no catalog integration, no issue search/read actions, no status transitions or comments (can be follow-up actions).
- No support for Jira OAuth 2.0 (3LO) or per-user credential forwarding — a single service credential per connection.
- No contribution of a `jira` connection type upstream (out of scope here, though the shape is chosen to match what upstream would likely look like).
- No proxying through `@backstage/plugin-proxy-backend` — the plugin calls Jira directly.

## Decisions

### D1: Package layout — single backend plugin created with `backstage-cli new`

`plugins/jira-actions-backend`, package name `backstage-plugin-jira-actions-backend` (repo uses `UNLICENSED` private packages), plugin ID `jira`. A `node` library split (`jira-actions-node`) is not warranted for this size; the connection service and client live inside the plugin's `src/lib/`.

_Alternative considered_: separate `jira-actions-common`/`-node` packages — rejected as premature for two actions.

### D2: Read `connections` config directly, mirroring the framework contract

A `JiraConnectionsReader` parses the top-level `connections` array from the root config:

- Filter entries to `type === 'jira'`; all other types are ignored (the framework owns them).
- Validate `jira` entries with zod schemas that copy the framework's conventions: connection fields (`host` required, `apiBaseUrl`, `product: 'cloud' | 'datacenter'` default `cloud`, `title`) plus a non-empty `auth` array with methods `basic` (`username`, `apiToken`) and `pat` (`token`). Invalid entries throw `InputError` at plugin init, failing startup loudly (matches `buildConnectionsFromConfig` behavior).
- Expose `find(options: { host?: string; authMethods?: ('basic' | 'pat')[] })` returning a resolved connection; no `host` → first configured Jira connection; no match → `NotFoundError` with a config-pointing message. This mirrors `ConnectionsService.find({type, query, authMethods})` from `@backstage/connections`, so migrating later means deleting the reader and delegating to the framework service.
- Config schema: the plugin ships `config.d.ts` declaring the `connections` array loosely (`type: string` + passthrough) with `@visibility secret` on `apiToken`/`token`, so `config:check` accepts the section and secrets are masked. Deep visibility declarations only apply to the jira-specific fields we declare.

_Alternatives considered_:

- Plugin-scoped config like `jira.connections` — rejected: the user explicitly asked for the new connections configuration, and top-level `connections` is where operators will expect all external connections to live.
- Depending on `@backstage/connections` and calling `buildConnectionsFromConfig` — rejected: it throws `Unrecognised connection type "jira"`, and the package's exports are churning (0.3.0 made the service internal).

### D3: Actions via `actionsRegistryServiceRef` (alpha)

The plugin depends on `actionsRegistryServiceRef` from `@backstage/backend-plugin-api/alpha` and registers two actions in `registerInit`:

- `create-work-item` — zod input per spec (`projectKey`, `issueType`, `summary`, `description?`, `labels?`, `assignee?`, `parentKey?`, `host?`); output `{key, id, url}`. Attributes: `{ destructive: false, idempotent: false, readOnly: false }`.
- `update-work-item` — input `issueKey` + optional updatable fields + `host?`, with a zod `refine` requiring at least one updatable field; output `{key, url}`. Attributes: `{ destructive: false, idempotent: true, readOnly: false }`.

Action names are registered unprefixed; the registry namespaces them with the plugin ID (final IDs like `jira:create-work-item`). `app-config.yaml` adds `jira` to `backend.actions.pluginSources` so the actions surface through the actions service and MCP.

_Alternative considered_: scaffolder actions — rejected: scaffolder actions only run inside templates; the actions registry is what MCP consumes and what the user asked for.

### D4: Minimal hand-rolled Jira REST client

`JiraClient` wraps `fetch` with a resolved connection: base URL `apiBaseUrl` + `/rest/api/3` (cloud) or `/rest/api/2` (datacenter); `Authorization` header from the auth entry (`Basic base64(username:apiToken)` or `Bearer token`). Methods: `createIssue(fields)`, `updateIssue(key, fields)`.

Field mapping details:

- `description`: plain text in → cloud wraps it in a minimal ADF document (`{type: 'doc', version: 1, content: [{type: 'paragraph', content: [{type: 'text', text}]}]}` per non-empty line); datacenter passes the string through.
- `assignee`: cloud → `{id: accountId}`; datacenter → `{name: username}`.
- `parentKey` → `parent: {key}`.
- Error handling: non-2xx responses raise typed errors from `@backstage/errors` (404 → `NotFoundError`, 400 → `InputError` including Jira's `errors`/`errorMessages` payload, 401/403 → `NotAllowedError`), never echoing the Authorization header.
- Output `url`: `https://<host>/browse/<key>`.

_Alternative considered_: `jira.js` npm SDK — rejected: large dependency for two endpoints, and its auth/model types fight the connection abstraction.

### D5: Testing strategy

- `JiraConnectionsReader` unit tests over `mockServices.rootConfig` fixtures (valid, multiple, invalid, non-jira types present).
- `JiraClient` tests with `msw` (already available transitively via backend test utils; otherwise add as devDependency) asserting method, path, auth header shape, ADF wrapping, and error mapping.
- Action tests via `startTestBackend` from `@backstage/backend-test-utils` plus `actionsRegistryServiceMock` (exported from `@backstage/backend-test-utils/alpha`) to invoke actions end-to-end against an msw-mocked Jira.

## Risks / Trade-offs

- [Framework later wires `connections` and rejects unknown `jira` type at startup] → Accepted, documented in README: risk only materializes on a Backstage upgrade that ships the connections service reading this section; by then either Jira is a built-in/custom-registrable type (migrate the reader to the framework service, D2 keeps this cheap) or the entry moves under a plugin-scoped key as a fallback. The reader is the single seam.
- [Actions Registry is alpha; API may break on upgrade] → Pinned via the repo's existing `@backstage/backend-plugin-api` range; the two registration call sites are trivial to adapt.
- [Description ADF conversion is lossy (plain text only)] → Acceptable for agent-driven ticket creation; document that rich formatting is out of scope.
- [Cloud vs Data Center assignee semantics differ (accountId vs username)] → Exposed as one `assignee` input; the client maps per `product`, and the input description tells callers which identifier to pass.
- [Registry namespacing means final action IDs depend on plugin ID `jira`] → Keep plugin ID `jira` stable; renaming it would rename the MCP tools.

## Migration Plan

New additive plugin: deploy = merge + `yarn install` + backend restart with a `connections` entry configured. Rollback = remove the plugin from `packages/backend/src/index.ts` (or the whole package); no data or schema migrations. When upstream ships a Jira connection type, replace `JiraConnectionsReader` internals with the framework `ConnectionsService` without touching action code.

## Open Questions

- Whether to also expose a `transition-work-item` (status change) and `add-comment` action — natural follow-ups once this lands.
- Whether upstream's eventual `jira` connection type will use the same auth method names (`basic`/`pat`); if it differs, a config rename may be needed at migration time.
