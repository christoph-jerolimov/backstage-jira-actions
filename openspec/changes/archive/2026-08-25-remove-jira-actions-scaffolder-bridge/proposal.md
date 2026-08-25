# Remove the Scaffolder Bridge Module

## Why

The scaffolder already exposes Actions Registry actions directly as template actions (they appear in the scaffolder's installed-actions list for every plugin in `backend.actions.pluginSources`), so template steps can call `jira-actions:list-issue-types` and friends without any indirection. The `jira:action:invoke` bridge module duplicates that mechanism, adds a level of nesting to every template step, and is an extra package to maintain — it should go.

## What Changes

- **BREAKING** (for template authors): the `jira:action:invoke` scaffolder action is removed. Template steps call the registry actions directly:

  ```yaml
  - id: list
    name: 'List issue types'
    action: jira-actions:list-issue-types
    input:
      projectKey: ${{ parameters.projectKey }}
      host: ${{ parameters.host }}
  ```

  instead of wrapping `actionId`/`input` in a `jira:action:invoke` step. Step outputs are the action's output fields directly (e.g. `${{ steps.list.output.url }}`) rather than a nested `result` object.

- The `plugins/scaffolder-backend-module-jira-actions` package is deleted, along with its wiring in `packages/backend` (package.json dependency and `src/index.ts` registration).
- All eight test templates in `examples/jira-actions-templates/` are updated to invoke their action directly and to reference the flattened step outputs.
- The template fixture tests move from the deleted module package into `plugins/jira-actions-backend`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `jira-action-templates`: the bridge-action requirement is removed (templates invoke registry actions directly), and the per-action template requirement changes to direct invocation with flattened step outputs. The capability's Purpose is updated in the main spec to drop the bridge mention.

## Impact

- **Removed code**: `plugins/scaffolder-backend-module-jira-actions` (entire package).
- **Modified code**: `packages/backend/package.json` + `src/index.ts` (drop the module), all files in `examples/jira-actions-templates/`, and `plugins/jira-actions-backend` (gains the relocated template fixture tests and the `yaml` devDependency).
- **Dependencies**: net removal — `@backstage/plugin-scaffolder-node` and its test utils leave the workspace.
- **Behavior/compat**: the eight test templates behave identically for users; only the internal step wiring changes. Anyone who wrote their own templates against `jira:action:invoke` (unlikely — it was introduced in the same unmerged branch) must switch to direct action ids.
- **Security note**: the bridge's `jira-actions:*` namespace guard disappears with it; template steps can in principle call any registry action the scaffolder exposes, which is the framework's standard behavior and governed by `backend.actions.pluginSources`.
