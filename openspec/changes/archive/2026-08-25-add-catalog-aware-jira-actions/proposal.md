# Catalog-Aware Jira Actions

## Why

The Jira actions require callers to know raw Jira project keys, but in Backstage the software catalog is the source of truth for what a service is. Reading the `jira/project-key` annotation from catalog entities lets a caller say "create a bug for component X" with an entity ref instead of a project key — the idiomatic Backstage move, and it ties tickets to the services they belong to.

## What Changes

- The project-scoped actions — `create-work-item`, `search-work-items`, and `list-issue-types` — accept a new optional `entityRef` input (e.g. `component:default/my-service`) as an alternative to `projectKey`. Exactly one of the two must identify the project: `entityRef` resolves through the catalog to the entity's `jira/project-key` annotation.
- The entity's optional `jira/host` annotation selects the Jira connection when the action's `host` input is not given, so multi-Jira setups can be modeled per service in the catalog.
- Clear errors: an unknown entity ref fails as not-found; an entity without the `jira/project-key` annotation fails with a message naming the annotation; providing both `projectKey` and `entityRef` (or neither) is rejected as invalid input.
- The plugin depends on the catalog service (`catalogServiceRef`) and resolves entities with the caller's credentials, so catalog permissions keep applying.
- The three affected test templates gain an `Entity` parameter (an `EntityPicker` field) wired to the new input; the plugin README documents the annotations.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `jira-work-item-actions`: a new requirement for resolving project keys (and optionally hosts) from catalog entity annotations, and modified requirements for `create-work-item`, `search-work-items`, and `list-issue-types` whose inputs gain the `entityRef` alternative.
- `jira-action-templates`: the create-work-item parameter-mirroring scenario changes because `projectKey` is no longer unconditionally required (either it or `entityRef` is provided), and the affected templates expose the entity input.

## Impact

- **Modified code**: `plugins/jira-actions-backend` — new `src/lib/entityProject.ts` resolver, input/validation changes in the three action modules, plugin wiring gains the catalog dependency, README, and tests. `examples/jira-actions-templates/` — the three affected templates plus fixture-test expectations in `plugins/scaffolder-backend-module-jira-actions`.
- **Dependencies**: `@backstage/plugin-catalog-node` (already installed transitively; becomes a direct dependency of the jira-actions plugin).
- **Config surface**: none. The contract with catalog entities is the `jira/project-key` and optional `jira/host` annotations on any entity kind.
- **Security**: entity lookups run with the invoking caller's credentials via the catalog service, so catalog visibility rules are honored; no new credential handling.
