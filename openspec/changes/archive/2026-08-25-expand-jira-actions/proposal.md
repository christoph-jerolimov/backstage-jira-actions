# Expand Jira Actions: Read, Search, Comment, Transition, Discovery

## Why

The `jira-actions` plugin can create and update work items, but an AI agent driving Jira through MCP cannot yet run a complete ticket workflow: it cannot read a ticket before changing it, check for duplicates before creating one, move a ticket through its workflow, report progress as a comment, or discover valid project keys and issue types instead of guessing them. This change closes that loop with six new actions on the existing plugin.

## What Changes

Six new actions registered by the existing `jira-actions` backend plugin, reusing the existing connection resolution and Jira REST client:

- `get-work-item`: read a single issue by key (summary, status, type, assignee, labels, description as plain text, parent, timestamps). Read-only.
- `search-work-items`: search issues by raw JQL or by simplified filters (project, free text, status, issue type, assignee, labels) with bounded result counts. Read-only. (Named plural — a search returns a list — while the other names follow the requested naming.)
- `add-comment`: add a plain-text comment to an issue.
- `transition-work-item`: move an issue to a target status by name, resolving the matching workflow transition; succeeds as a no-op when the issue is already in the target status, and reports the available transitions when the target is unreachable.
- `list-projects`: list visible Jira projects (key, name, id). Read-only.
- `list-issue-types`: list the issue types available in a given project. Read-only.

Supporting changes: the Jira client gains the corresponding endpoints (per-product v3/v2 handling as today), an ADF→plain-text conversion for reading Cloud descriptions and comments, and the plugin README documents the new actions.

In addition, every action — the six new ones and the two existing ones — gets a software template so each action can be tested end-to-end from the Backstage UI:

- A new scaffolder backend module (`scaffolder-backend-module-jira-actions`) registers a bridge scaffolder action `jira:action:invoke` that invokes a Jira registry action by id via the actions service — necessary because template steps run scaffolder actions, not registry actions. The bridge only accepts action ids of the `jira-actions` plugin.
- Eight test templates (one per action: `create-work-item`, `update-work-item`, `get-work-item`, `search-work-items`, `add-comment`, `transition-work-item`, `list-projects`, `list-issue-types`) under `examples/jira-actions-templates/`, registered in the catalog. Each template's parameters mirror the action's input schema, its single step invokes the action through the bridge, and its output shows the action result (with a link to the issue where the output contains one).

## Capabilities

### New Capabilities

- `jira-action-templates`: The scaffolder bridge action `jira:action:invoke` and the per-action software templates that let each Jira registry action be exercised from the Backstage software templates UI.

### Modified Capabilities

- `jira-work-item-actions`: gains six new action requirements (get, search, comment, transition, list projects, list issue types), and the existing "actions are registered" requirement is updated to cover the full action set with read-only attributes on the read actions.

## Impact

- **Modified code**: `plugins/jira-actions-backend` — new action modules under `src/actions/`, extensions to `src/lib/JiraClient.ts` and `src/lib/adf.ts`, registration in `src/plugin.ts`, README, and tests.
- **New code**: `plugins/scaffolder-backend-module-jira-actions` (bridge scaffolder action + tests) and `examples/jira-actions-templates/` (eight template YAML files plus a location file).
- **Wiring/config**: the scaffolder module is added to `packages/backend` (package.json + `src/index.ts`), and the template location is registered under `catalog.locations` in `app-config.yaml`. The existing `jira-actions` plugin registration and `backend.actions.pluginSources` entry are unchanged.
- **APIs used**: Jira REST `GET /issue/{key}`, search (`POST /rest/api/3/search/jql` on Cloud, `POST /rest/api/2/search` on Data Center), `POST /issue/{key}/comment`, `GET`+`POST /issue/{key}/transitions`, project listing (`GET /project/search` on Cloud, `GET /project` on Data Center), `GET /project/{key}` for issue types.
- **Dependencies**: none added.
- **Security**: read actions are marked `readOnly` in their registry attributes; all actions keep the existing rule that credentials never appear in inputs, outputs, logs, or errors. Search results and issue contents become readable by any client that can invoke actions — same exposure surface as the existing actions, worth noting for permission policies later.
