# Tasks: Remove the Scaffolder Bridge Module

## 1. Templates & tests

- [x] 1.1 Update all eight templates in `examples/jira-actions-templates/` to invoke their registry action directly (step `action: jira-actions:<name>`, parameters as the step input, outputs referencing `steps.<id>.output.*` and dumping the step output as the result text); verify all files still parse as valid YAML.
- [x] 1.2 Move `templates.test.ts` into `plugins/jira-actions-backend/src/`, adapt its assertions to the direct step shape, and add the `yaml` devDependency there; verify the relocated suite passes.

## 2. Package removal

- [x] 2.1 Delete `plugins/scaffolder-backend-module-jira-actions`, remove its dependency from `packages/backend/package.json` and its registration from `packages/backend/src/index.ts`, grep for any remaining references, and run `yarn install`; verify `yarn tsc` passes.
- [x] 2.2 Edit the main spec `openspec/specs/jira-action-templates/spec.md` Purpose to drop the bridge mention; verify `openspec validate` still accepts the change.

## 3. Verification

- [x] 3.1 Run the verification suite — `yarn tsc`, lint and tests for `plugins/jira-actions-backend`, `yarn prettier:check` scoped to changed paths, `yarn build:backend` — and boot-smoke-test the backend: catalog ingests the eight templates and the scaffolder actions list contains the `jira-actions:*` actions but no `jira:action:invoke`; verify all pass.
