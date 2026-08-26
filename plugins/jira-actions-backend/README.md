# backstage-plugin-jira-actions-backend

A Backstage backend plugin (plugin ID `jira-actions`) that registers Jira work item
actions in the Backstage [Actions Registry](https://backstage.io/docs/backend-system/core-services/actions-registry/),
so that they can be invoked through the actions service and — via
`@backstage/plugin-mcp-actions-backend` — exposed as MCP tools to AI agents.

## Actions

| Action ID                           | Description                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| `jira-actions:create-work-item`     | Creates a work item (issue) such as a Story, Bug or Task in a Jira project.                      |
| `jira-actions:update-work-item`     | Modifies fields (summary, description, labels, assignee, issue type) of an existing Jira issue.  |
| `jira-actions:rename-work-item`     | Changes only the summary (title) of an issue.                                                    |
| `jira-actions:set-work-item-parent` | Changes only the parent of an issue, e.g. to move it under a different epic.                     |
| `jira-actions:get-work-item`        | Reads a single issue by key, with the description rendered as Markdown (or text). Read-only.     |
| `jira-actions:search-work-items`    | Searches issues by raw JQL or simplified filters. Read-only.                                     |
| `jira-actions:add-comment`          | Adds a Markdown comment to an issue.                                                             |
| `jira-actions:get-comments`         | Reads the comments of an issue, bodies rendered as Markdown by default. Read-only.               |
| `jira-actions:add-label`            | Adds a single label to an issue without affecting its other labels.                              |
| `jira-actions:remove-label`         | Removes a single label from an issue without affecting its other labels.                         |
| `jira-actions:transition-work-item` | Moves an issue to a target status by name via the matching workflow transition.                  |
| `jira-actions:list-projects`        | Lists the visible Jira projects with URLs and descriptions, optionally name-filtered. Read-only. |
| `jira-actions:list-issue-types`     | Lists the issue types available in a project. Read-only.                                         |

All actions accept an optional `host` input to select a specific Jira
connection when more than one is configured; without it, the first configured
Jira connection is used.

Usage notes:

- `search-work-items` takes either a raw `jql` input or simplified filters
  (`projectKey`, `text`, `status`, `issueType`, `assignee`, `labels`) — not
  both. Filters are compiled to JQL ordered by most recently updated.
- `update-work-item` edits labels either wholesale via `labels` (replacing
  the full list) or incrementally via `addLabels`/`removeLabels` — the two
  styles cannot be combined in one call. The dedicated `add-label` and
  `remove-label` actions edit one label at a time and return the issue's
  resulting labels; adding an existing or removing an absent label is a
  no-op.
- `list-projects` takes an optional `name` input, matched case-insensitively
  against project names and keys.
- `transition-work-item` matches the target status name (case-insensitively)
  against the issue's currently available transitions. If the issue already
  has the target status the action succeeds without changes; if the status is
  unreachable, the error lists the statuses that are reachable.
- Descriptions and comment bodies carry a format selector
  (`descriptionFormat` on create/update, `bodyFormat` on
  add-comment/get-comments):
  `markdown` (default), `adf`, or `text`. With `markdown`, a supported
  subset — headings, bullet/ordered lists, fenced code blocks (with
  language), blockquotes, and inline bold/italic/code/links — is converted
  to real ADF on Jira Cloud, and anything outside the subset degrades to
  plain text. With `text`, the string is stored literally with no Markdown
  interpretation. With `adf`, the input is an ADF document (an object, or a
  JSON-encoded string) sent to Jira verbatim — Jira Cloud only. On Jira
  Data Center strings pass through unchanged and `adf` is rejected.
- `get-work-item` renders Cloud descriptions back per `descriptionFormat`:
  Markdown by default, the raw ADF document for `adf`, or plain text for
  `text` (ADF nodes outside the Markdown subset, such as tables and
  mentions, degrade to their text content in the string renderings).

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

## Catalog annotations

The project-scoped actions (`create-work-item`, `search-work-items`,
`list-issue-types`) accept an `entityRef` input (e.g.
`component:default/my-service`) as an alternative to `projectKey` — provide
exactly one of the two. The entity is looked up in the software catalog with
the caller's credentials and must carry the `jira/project-key` annotation:

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: my-service
  annotations:
    jira/project-key: PROJ
    # Optional, for setups with multiple Jira connections: selects the
    # connection when the action's "host" input is not given.
    jira/host: jira.mycompany.com
spec:
  type: service
  owner: my-team
  lifecycle: production
```

An explicit `host` input always wins over the `jira/host` annotation. The
annotation value is treated as a single project key.

To expose the actions over MCP, add the plugin ID to the actions sources:

```yaml
backend:
  actions:
    pluginSources:
      - jira-actions
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
