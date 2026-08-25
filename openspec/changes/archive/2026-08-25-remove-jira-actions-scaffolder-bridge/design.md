# Design: Remove the Scaffolder Bridge Module

## Context

See proposal.md for motivation. Verified behavior in this Backstage version (boot smoke test): the scaffolder's `/api/scaffolder/v2/actions` endpoint lists all `jira-actions:*` registry actions alongside its native actions, with no extra configuration beyond the existing `backend.actions.pluginSources: [..., jira-actions]` entry. The bridge module (`plugins/scaffolder-backend-module-jira-actions`) currently owns two things beyond the bridge itself: the template fixture test suite and the `yaml` devDependency it uses.

## Goals / Non-Goals

**Goals:**

- Delete the bridge package and its backend wiring with no loss of template functionality or test coverage.
- Flatten every template step to direct action invocation and direct step outputs.
- Keep the template fixture tests alive by relocating them into `plugins/jira-actions-backend`.

**Non-Goals:**

- No changes to the registry actions, connections handling, or catalog awareness.
- No replacement guardrail for the bridge's `jira-actions:*` namespace restriction — which actions templates may call is the framework's concern (`backend.actions.pluginSources`), not this plugin's.

## Decisions

### D1: Direct step output references, verified against the scaffolder's exposure

The scaffolder exposes a registry action's output fields as the step's output fields. Templates change from `${{ steps.invoke.output.result.url }}` to `${{ steps.invoke.output.url }}`, and the "Result" text block dumps `${{ steps.invoke.output | dump }}`. The boot smoke test in the verification task confirms a template run's output rendering against the real scaffolder rather than trusting this mapping blindly — if the exposure turns out to differ (e.g. outputs nested differently), the templates are adjusted to match reality and the spec scenario stays satisfied (it prescribes "the step output as text", not a specific shape).

### D2: Fixture tests move to `plugins/jira-actions-backend`

`templates.test.ts` moves to `plugins/jira-actions-backend/src/templates.test.ts` with its relative fixture path updated and the `yaml` devDependency added to that package. The assertions change with the new step shape: `step.action === 'jira-actions:<name>'` and the parameters map directly onto `step.input` (no more `step.input.input`/`actionId`). The EntityPicker and required-parameter assertions carry over unchanged. This package is the natural owner — the templates exist to exercise its actions.

### D3: Clean package removal

Delete the package directory, remove the `backstage-plugin-scaffolder-backend-module-jira-actions` dependency from `packages/backend/package.json`, remove the `backend.add(...)` line from `packages/backend/src/index.ts`, and run `yarn install` to prune the lockfile. Nothing else references the package (verified by grep in the implementation task).

## Risks / Trade-offs

- [The direct exposure of registry actions in the scaffolder is itself an alpha-era behavior and could change shape in a future Backstage upgrade] → Accepted: it is the framework's documented direction for the actions registry; if it regresses, templates fail loudly at run time and the git history contains the bridge for reference.
- [Losing the namespace guard means templates can call any exposed registry action] → Accepted per proposal; this matches the platform's standard trust model and is governed by `backend.actions.pluginSources` plus permission policies.

## Migration Plan

Merge, `yarn install`, restart backend. Template behavior is unchanged for users. Rollback = revert the commit (restores the package and wiring). During implementation the main spec's Purpose for `jira-action-templates` is edited directly to drop the bridge mention (delta Purposes are ignored by the tooling).

## Open Questions

None.
