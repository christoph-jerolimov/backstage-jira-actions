# Add Jira Work Item Actions Plugin

## Why

This Backstage instance already exposes registered backend actions to AI agents and other clients through `@backstage/plugin-mcp-actions-backend`, but there is no way to create or modify Jira work items (stories, bugs, tasks) from Backstage. A backend plugin that registers Jira actions in the Actions Registry makes Jira ticket management available to every consumer of the registry — including the MCP endpoint — with a single, centrally configured Jira connection.

## What Changes

- New backend plugin `jira-actions` (workspace package `plugins/jira-actions-backend`, plugin ID `jira-actions`) built on the new backend system.
- The plugin registers actions in the Backstage Actions Registry (`actionsRegistryServiceRef` from `@backstage/backend-plugin-api/alpha`):
  - `create-work-item`: create a Jira issue (story, bug, task, …) in a given project.
  - `update-work-item`: modify fields of an existing Jira issue by its key.
- Jira connection details (host, API base URL, product variant, credentials) are read from the new Backstage `connections` configuration section (BEP-14 style: a top-level `connections:` array with `type`, `title`, and `auth` entries), using a plugin-provided `jira` connection type. The framework does not yet ship a `jira` connection type or a public API for custom types, so the plugin parses `type: jira` entries from the `connections` config itself, mirroring the `@backstage/connections` contract (`find({ type, query, authMethods })`) so it can migrate to the framework service once Jira is supported there.
- Supported auth methods: `basic` (email/username + API token, Jira Cloud) and `pat` (personal access token bearer auth, Jira Data Center/Server).
- Backend wiring: the plugin is added to `packages/backend/src/index.ts`, and `backend.actions.pluginSources` in `app-config.yaml` gains the `jira-actions` entry so the actions are discoverable (and therefore exposed over MCP).

## Capabilities

### New Capabilities

- `jira-connections`: Resolving Jira connection configuration (host, base URL, product variant, auth credentials) from the Backstage `connections` configuration section, including validation and error behavior when no usable connection is configured.
- `jira-work-item-actions`: The `create-work-item` and `update-work-item` actions registered in the Actions Registry — their input/output schemas, Jira REST API interaction, and error handling.

### Modified Capabilities

None — this change only introduces new capabilities; no existing spec requirements change.

## Impact

- **New code**: `plugins/jira-actions-backend` (backend plugin, config schema, Jira REST client, action implementations, tests).
- **Modified code**: `packages/backend/package.json` + `packages/backend/src/index.ts` (register the plugin), `app-config.yaml` (`backend.actions.pluginSources` gains `jira-actions`; example `connections` entry documented).
- **Dependencies**: `@backstage/backend-plugin-api` (alpha actions registry API), `zod` for schemas. No new third-party Jira SDK — the plugin calls the Jira REST API (v3 for Cloud, v2 for Data Center) via `fetch`.
- **Config surface**: introduces `connections` entries with `type: jira`. Note: the framework's own `buildConnectionsFromConfig` (not yet wired into this Backstage version) currently rejects unknown connection types; this forward-compatibility risk is accepted and documented in the design, and the parsing is isolated behind a small service so it can be swapped for the framework `ConnectionsService` later.
- **Security**: credentials stay backend-only; action inputs never contain secrets. Actions are exposed to whatever clients can reach the actions/MCP endpoints, guarded by the existing auth setup.
