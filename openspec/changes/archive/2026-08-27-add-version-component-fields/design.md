# Design: Version, Component and Field Support

## Context

Builds directly on the established seams (see the archived expand-jira-action-coverage design). Jira endpoints used: `GET /project/{key}/versions`, `GET /project/{key}/components`, `POST /version` (which requires the numeric `projectId` — resolved via `GET /project/{key}`, whose response already carries `id`). Versions and components on issues are name-referenced arrays: `fixVersions: [{name}]`, `versions: [{name}]` (Jira's field name for affected versions), `components: [{name}]`; unknown names are rejected by Jira with field errors.

## Goals / Non-Goals

**Goals:** first-class standard fields (fixVersions/affectsVersions/components) on create/update/get; discovery (`list-versions`, `list-components`) and creation (`create-version`) with the same projectKey/entityRef ergonomics as `list-issue-types`.

**Non-Goals:** version editing/release/archive operations; component creation; incremental version/component edits on update (full replacement only, matching `labels`).

## Decisions

- **D1 Client:** `listVersions(projectKey)` and `listComponents(projectKey)` map to normalized arrays (string ids; `lead: lead.displayName`; empty descriptions dropped). `createVersion({projectKey, name, description?, startDate?, releaseDate?})` first resolves the project id via the existing project GET, then posts `{projectId, name, ...}`. `toOptionalFields` maps `fixVersions`→`fixVersions:[{name}]`, `affectsVersions`→`versions:[{name}]`, `components`→`components:[{name}]`. `getIssue` requests `fixVersions,versions,components` and returns name arrays (omitted when empty).
- **D2 Actions:** `list-versions`/`list-components` follow the `list-issue-types` module shape (catalog + read permission); `create-version` follows it with the write permission. Field mapping notes (`affectsVersions` ↔ Jira `versions`) stay inside the client.
- **D3 Templates:** three new templates (tables per the spec columns; create-version is a plain result template with no issue link since its output has no issue `url`); create/update templates gain the three array parameters, get-work-item output is JSON-carried as before.
- **D4 Testing:** msw client tests (version/component mapping, createVersion two-step id resolution, request bodies for the field mapping), registry-mock tests per scenario (including entityRef resolution for `list-versions`), fixture tests for 29 templates, discovery test 29/14 read-only, boot smoke 29/29.

## Risks / Trade-offs

- [Name-referenced versions/components can race with renames] → Accepted; Jira validates and errors propagate. `list-versions`/`list-components` give agents fresh names.
- [`affectsVersions` name differs from Jira's `versions` field] → Deliberate: the action vocabulary favors clarity; the client owns the mapping.

## Migration Plan

Purely additive; merge and restart.

## Open Questions

None.
