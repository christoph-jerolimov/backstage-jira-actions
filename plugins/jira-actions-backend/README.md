# backstage-plugin-jira-actions-backend

A Backstage backend plugin (plugin ID `jira-actions`) that registers Jira work item
actions in the Backstage [Actions Registry](https://backstage.io/docs/backend-system/core-services/actions-registry/),
so that they can be invoked through the actions service and — via
`@backstage/plugin-mcp-actions-backend` — exposed as MCP tools to AI agents.

## Actions

| Action ID                             | Description                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `jira-actions:create-work-item`       | Creates a work item (issue) such as a Story, Bug or Task in a Jira project.                      |
| `jira-actions:update-work-item`       | Modifies fields (summary, description, labels, assignee, issue type) of an existing Jira issue.  |
| `jira-actions:rename-work-item`       | Changes only the summary (title) of an issue.                                                    |
| `jira-actions:set-work-item-parent`   | Changes only the parent of an issue, e.g. to move it under a different epic.                     |
| `jira-actions:delete-work-item`       | Permanently deletes an issue. The only action marked destructive.                                |
| `jira-actions:get-work-item`          | Reads a single issue by key, including its links and selected custom fields. Read-only.          |
| `jira-actions:search-work-items`      | Searches issues by raw JQL or simplified filters, with page cursors. Read-only.                  |
| `jira-actions:search-users`           | Finds users and returns the identity value usable as assignee or watcher. Read-only.             |
| `jira-actions:add-comment`            | Adds a Markdown comment to an issue.                                                             |
| `jira-actions:get-comments`           | Reads the comments of an issue with page cursors, bodies as Markdown by default. Read-only.      |
| `jira-actions:update-comment`         | Replaces the body of an existing comment on an issue.                                            |
| `jira-actions:delete-comment`         | Permanently deletes a comment. Destructive.                                                      |
| `jira-actions:add-label`              | Adds a single label to an issue without affecting its other labels.                              |
| `jira-actions:remove-label`           | Removes a single label from an issue without affecting its other labels.                         |
| `jira-actions:add-remote-link`        | Attaches a titled web link (e.g. a PR or Backstage entity page) to an issue.                     |
| `jira-actions:get-remote-links`       | Reads the web links attached to an issue. Read-only.                                             |
| `jira-actions:link-work-items`        | Links two issues with a relation such as "blocks" or "duplicates".                               |
| `jira-actions:list-link-types`        | Lists the available issue link types with their relation descriptions. Read-only.                |
| `jira-actions:list-transitions`       | Lists the statuses an issue can currently move to. Read-only.                                    |
| `jira-actions:transition-work-item`   | Moves an issue to a target status by name via the matching workflow transition.                  |
| `jira-actions:list-projects`          | Lists the visible Jira projects with URLs and descriptions, optionally name-filtered. Read-only. |
| `jira-actions:list-issue-types`       | Lists the issue types available in a project. Read-only.                                         |
| `jira-actions:list-fields`            | Lists the instance's fields, including custom fields with their IDs. Read-only.                  |
| `jira-actions:list-versions`          | Lists the versions of a project, e.g. valid fixVersions names. Read-only.                        |
| `jira-actions:list-components`        | Lists the components of a project. Read-only.                                                    |
| `jira-actions:create-version`         | Creates a version in a project, e.g. for an upcoming release.                                    |
| `jira-actions:get-worklogs`           | Reads the work log entries of an issue. Read-only.                                               |
| `jira-actions:add-worklog`            | Logs work on an issue with a Jira duration such as "2h 30m".                                     |
| `jira-actions:add-watcher`            | Adds a user as a watcher of an issue.                                                            |
| `jira-actions:remove-watcher`         | Removes a user from the watchers of an issue.                                                    |
| `jira-actions:list-boards`            | Lists the visible agile boards, optionally filtered by name or project. Read-only.               |
| `jira-actions:list-sprints`           | Lists the sprints of a board, optionally filtered by state. Read-only.                           |
| `jira-actions:list-sprint-work-items` | Lists the work items of a sprint, with page cursors. Read-only.                                  |
| `jira-actions:get-sprint-insights`    | Summarizes a sprint: totals, completion, and status/type/assignee breakdowns. Read-only.         |
| `jira-actions:move-to-sprint`         | Moves up to fifty issues into a sprint.                                                          |
| `jira-actions:move-to-backlog`        | Moves up to fifty issues out of their sprints into the backlog.                                  |

Every action declares typed input/output schemas and at least one usage
example, both of which flow to consumers such as the MCP endpoint.

All actions accept an optional `host` input to select a specific Jira
connection when more than one is configured; without it, the first configured
Jira connection is used.

Usage notes:

- `search-work-items` takes either a raw `jql` input or simplified filters
  (`projectKey`, `text`, `status`, `issueType`, `assignee`, `labels`) — not
  both. Filters are compiled to JQL ordered by most recently updated.
- `search-work-items`, `get-comments`, and `list-sprint-work-items` page
  with an opaque cursor: pass a
  previous run's `nextPageToken` output as the `pageToken` input to fetch
  the next page; the token is absent once no further results remain.
- `fixVersions`, `affectsVersions`, and `components` on create/update take
  version/component _names_ (Jira resolves them; unknown names fail with
  Jira's error). `list-versions` and `list-components` discover valid names,
  and `get-work-item` returns the names on read.
- `create-work-item`, `update-work-item`, and `get-work-item` handle custom
  fields via `customFields` (values keyed by field id on create/update,
  a list of field ids to read on get); `list-fields` discovers the ids.
  Values are passed to Jira verbatim — Jira validates them.
- `link-work-items` accepts the link type by name (`Blocks`) or by either
  relation description (`blocks`, `is blocked by`); an inward description
  reverses the link direction so the relation reads correctly. Unknown
  types fail with the list of available ones (see `list-link-types`).
- `assignee`, `user` (watchers), and search-user `id` values are account
  IDs on Jira Cloud and usernames on Data Center; `search-users` returns
  exactly the value the other inputs expect. All of these identity inputs
  also accept the reserved value `me`, resolved to the invoking user via
  their catalog profile email and Jira's user search (requires a user
  caller and a matching Jira account). `update-work-item` additionally
  takes `unassign: true` to clear the assignee.
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
  add-comment/get-comments/update-comment):
  `markdown` (default), `adf`, or `text`. With `markdown`, a supported
  subset — headings, bullet/ordered lists, fenced code blocks (with
  language), blockquotes, and inline bold/italic/code/links — is converted
  to real ADF on Jira Cloud, and anything outside the subset degrades to
  plain text. With `text`, the string is stored literally with no Markdown
  interpretation. With `adf`, the input is an ADF document (an object, or a
  JSON-encoded string) sent to Jira verbatim — Jira Cloud only. On Jira
  Data Center strings pass through unchanged and `adf` is rejected.
- Discovery caching: link types and the field catalog are cached per
  connection for sixty seconds (also serving `link-work-items`' internal
  type resolution), so repeated discovery calls don't hit Jira.
- Rate limits: a Jira 429 response is retried up to two times, honoring
  the `Retry-After` header (capped at ten seconds per wait); a request
  still rate-limited afterwards fails with an explicit rate-limit error.
- `get-work-item` renders Cloud descriptions back per `descriptionFormat`:
  Markdown by default, the raw ADF document for `adf`, or plain text for
  `text` (ADF nodes outside the Markdown subset, such as tables and
  mentions, degrade to their text content in the string renderings).
  Worklog comments carry the same selector as `commentFormat` on
  `get-worklogs`/`add-worklog`.

## Permissions

The plugin registers three permissions with the Backstage
[permission framework](https://backstage.io/docs/permissions/overview) and
authorizes the caller before every Jira call:

| Permission              | Covers                              |
| ----------------------- | ----------------------------------- |
| `jira.work-item.read`   | All read-only actions               |
| `jira.work-item.write`  | All modifying actions except delete |
| `jira.work-item.delete` | `delete-work-item`                  |

Under Backstage's default allow-all policy nothing changes; a custom
permission policy can deny any of the three (for example withholding
`jira.work-item.delete` from everyone but admins) and the affected actions
fail with a NotAllowed error before Jira is contacted.

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

The project-scoped actions (`create-work-item`, `create-work-items`,
`search-work-items`, `list-issue-types`, `list-versions`,
`list-components`, `create-version`)
accept an `entityRef` input (e.g.
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
