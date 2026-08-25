# backstage-plugin-jira-actions-backend

A Backstage backend plugin (plugin ID `jira`) that registers Jira work item
actions in the Backstage [Actions Registry](https://backstage.io/docs/backend-system/core-services/actions-registry/),
so that they can be invoked through the actions service and — via
`@backstage/plugin-mcp-actions-backend` — exposed as MCP tools to AI agents.

## Actions

| Action ID               | Description                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| `jira:create-work-item` | Creates a work item (issue) such as a Story, Bug or Task in a Jira project.                     |
| `jira:update-work-item` | Modifies fields (summary, description, labels, assignee, issue type) of an existing Jira issue. |

Both actions accept an optional `host` input to select a specific Jira
connection when more than one is configured; without it, the first configured
Jira connection is used.

## Configuration

Jira connections are read from the top-level `connections` section of the
app-config, following the Backstage connections convention (BEP-14):

```yaml
connections:
  # Jira Cloud, authenticated with an account email + API token
  - type: jira
    host: mycompany.atlassian.net
    auth:
      - method: basic
        username: ${JIRA_USERNAME}
        apiToken: ${JIRA_API_TOKEN}

  # Jira Data Center, authenticated with a personal access token
  - type: jira
    host: jira.mycompany.com
    product: datacenter
    apiBaseUrl: https://jira.mycompany.com # optional, defaults to https://<host>
    auth:
      - method: pat
        token: ${JIRA_TOKEN}
```

- `product` selects the REST API flavor: `cloud` (default, API v3) or
  `datacenter` (API v2). It also decides how the `assignee` input is
  interpreted: an account ID on Cloud, a username on Data Center.
- Supported auth methods are `basic` (username + `apiToken`) and `pat`
  (bearer `token`). At least one auth entry is required.
- Invalid `type: jira` entries fail backend startup with a descriptive error;
  entries of other connection types are ignored by this plugin.

To expose the actions over MCP, add the plugin ID to the actions sources:

```yaml
backend:
  actions:
    pluginSources:
      - jira
```

## Installation

The plugin is wired into the backend in `packages/backend/src/index.ts`:

```ts
backend.add(import('backstage-plugin-jira-actions-backend'));
```

## Note on the connections framework

The upstream connections framework (`@backstage/connections`) does not yet
ship a `jira` connection type or a public API for registering custom types,
and the Backstage version in this repo does not read the `connections`
section itself. This plugin therefore parses `type: jira` entries on its own,
mirroring the framework's `find({ type, query, authMethods })` lookup
contract. Once Jira is supported by the framework's connections service, the
internal reader (`src/lib/connections.ts`) is the single seam to replace.
Should a future framework upgrade start validating the `connections` section
strictly before custom types are supported, the `jira` entries may need to
move to a plugin-scoped config key.
