# Tasks: Catalog-Aware Jira Actions

## 1. Entity project resolver

- [ ] 1.1 Implement `resolveEntityProject` in `plugins/jira-actions-backend/src/lib/entityProject.ts` (catalog lookup with caller credentials, `jira/project-key` required, `jira/host` optional, NotFound/InputError contract per spec); verify with unit tests against a mocked CatalogService covering all five resolver scenarios.
- [ ] 1.2 Add `@backstage/plugin-catalog-node` as a dependency and wire `catalogServiceRef` into `plugin.ts`, passing the catalog service to the three project-scoped register functions; verify `yarn tsc` passes.

## 2. Action input changes (spec: jira-work-item-actions)

- [ ] 2.1 Extend `create-work-item`: optional `projectKey` + optional `entityRef` with exactly-one handler validation, entity resolution, and host precedence (input > `jira/host` annotation > default); verify with registry-mock tests for entityRef create, both-given and neither-given rejections, unknown entity, missing annotation, and annotation-based host selection with input override.
- [ ] 2.2 Extend `search-work-items`: `entityRef` as an additional simplified filter (conflicts with `projectKey`, counts for the jql/filters rules, resolved key feeds `buildJql`); verify with registry-mock tests for the entityRef search and conflict scenarios.
- [ ] 2.3 Extend `list-issue-types`: `projectKey` or `entityRef` with exactly-one validation and host precedence; verify with registry-mock tests for the entityRef listing and validation scenarios.

## 3. Templates & docs (spec: jira-action-templates)

- [ ] 3.1 Add the optional `entityRef` parameter with `ui:field: EntityPicker` to the `create-work-item`, `search-work-items`, and `list-issue-types` templates (projectKey demoted to optional where needed, descriptions stating the either/or rule); verify the updated fixture tests pass, including a new assertion that the three templates carry the EntityPicker field.
- [ ] 3.2 Update the plugin `README.md` with the `jira/project-key` and `jira/host` annotation contract and an example catalog entity snippet; verify `yarn prettier --check` passes on the changed files.

## 4. Verification

- [ ] 4.1 Run the verification suite — `yarn tsc`, lint and tests for both plugin packages, `yarn build:backend` — and boot-smoke-test the backend (templates ingest, actions register); verify all pass.
