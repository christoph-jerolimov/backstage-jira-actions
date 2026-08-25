# Design: Catalog-Aware Jira Actions

## Context

See proposal.md for motivation. Relevant current state: the three project-scoped actions (`create-work-item`, `search-work-items`, `list-issue-types`) take a raw `projectKey`; action handlers already receive the caller's `credentials` in their context; `@backstage/plugin-catalog-node` (installed, v2.2.4) exports `catalogServiceRef` whose `getEntityByRef(entityRef, { credentials })` returns the entity or `undefined`. The annotation names follow the convention established by the existing community Jira plugins: `jira/project-key`, plus `jira/host` for multi-Jira setups.

## Goals / Non-Goals

**Goals:**

- `entityRef` as a first-class alternative to `projectKey` on the three project-scoped actions, resolved via the catalog with the caller's credentials.
- One small, unit-testable resolver owning the annotation contract (`jira/project-key`, `jira/host`), shared by all three actions.
- Templates keep mirroring action inputs, using the scaffolder's built-in `EntityPicker` for the new input.

**Non-Goals:**

- No annotation-based routing for issue-scoped actions (`get-work-item`, `update-work-item`, etc. operate on issue keys, which already encode the project).
- No new annotations beyond `jira/project-key` and `jira/host`, and no fallback conventions (e.g. deriving keys from entity names).
- No catalog writes or entity decoration; the catalog is read-only input.

## Decisions

### D1: A single `resolveEntityProject` helper in `src/lib/entityProject.ts`

```ts
resolveEntityProject(options: {
  catalog: CatalogService;
  entityRef: string;
  credentials: BackstageCredentials;
}): Promise<{ projectKey: string; host?: string }>
```

It calls `catalog.getEntityByRef(entityRef, { credentials })`; `undefined` → `NotFoundError` naming the entity ref (this also covers entities the caller may not see — the catalog's permission filtering is preserved by passing the caller's credentials through). A resolved entity without `metadata.annotations['jira/project-key']` → `InputError` naming the annotation. `jira/host` is returned when present. The helper is the only place that knows the annotation names.

_Alternative considered_: inlining the lookup per action — rejected: three copies of the same error contract, and the annotation names would be scattered.

### D2: Input shape — optional `projectKey` + optional `entityRef`, exactly-one enforced in the handler

The registry input schemas must stay plain zod objects (no `.refine`, same constraint as the existing update-work-item validation), so `projectKey` becomes optional on `create-work-item` and `list-issue-types`, `entityRef` is added to all three, and the handlers enforce:

- `create-work-item`, `list-issue-types`: exactly one of `projectKey`/`entityRef`, else `InputError` before any catalog or Jira call.
- `search-work-items`: `entityRef` joins the simplified-filter set (counts as a filter for the "jql XOR filters" and "at least one filter" rules); `projectKey` + `entityRef` together is an `InputError`. After resolution the entity's project key feeds `buildJql` exactly like an input `projectKey` — `buildJql` itself is unchanged.

Host precedence in all three: explicit `host` input > entity's `jira/host` annotation > default connection. Input descriptions spell out the either/or rule so MCP/AI callers self-serve.

### D3: Plugin wiring — catalog service as a plugin dependency

`plugin.ts` adds `catalog: catalogServiceRef` to `registerInit` deps and passes the instance to the three register functions (the other five are untouched). `@backstage/plugin-catalog-node` becomes a direct dependency of the plugin package. Register-function signatures grow an explicit `catalog` option rather than a context object, matching the existing `{ actionsRegistry, connections }` style.

### D4: Templates use `EntityPicker`, projectKey demoted to optional

The `create-work-item`, `search-work-items`, and `list-issue-types` templates add an `entityRef` string parameter with `ui:field: EntityPicker` (built into the scaffolder frontend; no new packages) placed next to `projectKey`, both optional, with descriptions stating that exactly one is expected — the actions validate, so the form stays simple rather than encoding oneOf logic in JSON Schema. The fixture test's `REQUIRED_INPUTS` drops `projectKey` for `create-work-item` and `list-issue-types`, and a new fixture assertion checks the three templates carry the `EntityPicker` field for `entityRef`.

### D5: Testing strategy

- `resolveEntityProject` unit tests with a mocked `CatalogService` (found with both annotations, found with only `jira/project-key`, missing annotation → `InputError`, unresolved ref → `NotFoundError`, credentials passed through).
- Action tests (existing registry-mock + msw setup) using `catalogServiceMock` from `@backstage/plugin-catalog-node/testUtils` seeded with fixture entities: entityRef create, entityRef search restricting JQL, entityRef list-issue-types, `jira/host` connection selection with and without an explicit `host` input, both-inputs and neither-input rejections, unknown entity.
- Template fixture tests updated per D4.

## Risks / Trade-offs

- [Exactly-one validation lives in handlers, not the JSON schema, so schema-only consumers see two optional fields] → Accepted (same pattern as update-work-item's "at least one field" rule); descriptions document the rule and the error message is immediate and precise.
- [Annotation drift: other Jira plugins may read `jira/project-key` values with different formats (e.g. comma-separated lists)] → The resolver takes the value verbatim and treats it as a single key; a multi-key annotation fails in Jira with a clear error. Documented in the README; splitting on comma (first entry) can be added later without spec change if needed.
- [Catalog lookups add latency to project-scoped calls] → One `getEntityByRef` per invocation, only when `entityRef` is used.

## Migration Plan

Purely additive and backward compatible: existing invocations with `projectKey` behave identically (the create/list required-ness relaxation only widens accepted inputs; the handlers reject the previously-impossible empty case with a clear error). Merge, restart backend. Rollback = revert the commit.

## Open Questions

None.
