# jira-work-item-actions Delta

## ADDED Requirements

### Requirement: Self identity resolution

The identity inputs — `assignee` on `create-work-item` and `update-work-item`, and `user` on `add-watcher` and `remove-watcher` — SHALL accept the special value `me` (case-insensitive). When given, the action SHALL resolve the invoking user's Jira identity before the write: the caller's credentials MUST belong to a user principal, the user's catalog entity is looked up with those credentials, its profile email is matched against Jira's user search, and the matching user's assignable id (account ID on Cloud, username on Data Center) is used in place of `me`. Resolution failures SHALL fail the action before any Jira write with an error naming the missing piece — a non-user caller, a catalog user entity without a profile email, or no (or no unambiguous) Jira user matching the email.

#### Scenario: Assign to the invoking user

- **WHEN** `update-work-item` is invoked with `assignee: me` by a user whose catalog profile email matches exactly one Jira user
- **THEN** the issue is assigned to that Jira user

#### Scenario: Watch as the invoking user

- **WHEN** `add-watcher` is invoked with `user: me`
- **THEN** the invoking user's resolved Jira identity is added as the watcher

#### Scenario: No matching Jira user

- **WHEN** the invoking user's profile email matches no Jira user
- **THEN** the action fails with an error naming the email, and no Jira write is made

#### Scenario: Caller is not a user

- **WHEN** an action is invoked with `me` by a non-user (service) caller
- **THEN** the action fails with an error explaining that `me` requires a user caller, and no Jira write is made

## MODIFIED Requirements

### Requirement: Update work item action

The system SHALL provide an `update-work-item` action that modifies an existing Jira issue identified by its issue key. The input SHALL accept:

- `issueKey` (required): the key of the issue to update, e.g. `PROJ-123`.
- `summary` (optional): new summary.
- `description` (optional): the new description — a string, or an ADF document when `descriptionFormat` is `adf`.
- `descriptionFormat` (optional): how to interpret `description` — `markdown` (default), `adf`, or `text`, per the rich text conversion requirement.
- `labels` (optional): full replacement list of labels.
- `addLabels` (optional): labels to add incrementally, preserving the rest.
- `removeLabels` (optional): labels to remove incrementally, preserving the rest.
- `assignee` (optional): new assignee (account ID or username, or `me` per the self identity resolution requirement).
- `unassign` (optional boolean): clear the assignee; counts as an updatable field and MUST NOT be combined with `assignee`.
- `issueType` (optional): new issue type name.
- `fixVersions` (optional): full replacement list of fix version names.
- `affectsVersions` (optional): full replacement list of affected version names.
- `components` (optional): full replacement list of component names.
- `customFields` (optional): an object mapping Jira field ids to new values, passed to Jira verbatim as issue fields; counts as an updatable field.
- `host` (optional): the Jira host to target when multiple connections are configured.

The version and component inputs count as updatable fields. At least one updatable field MUST be provided; an invocation naming only `issueKey` (with or without `descriptionFormat`) SHALL be rejected as invalid input. Combining `labels` with `addLabels` or `removeLabels` SHALL be rejected as invalid input, since a full replacement and incremental edits conflict; so SHALL combining `assignee` with `unassign`. On success, the output SHALL include the issue `key` and a browseable `url`.

#### Scenario: Update the summary of an issue

- **WHEN** the action is invoked with `issueKey: PROJ-123` and a new `summary`
- **THEN** the Jira issue PROJ-123 has its summary replaced and the output contains the issue key and URL

#### Scenario: Update with a literal text description

- **WHEN** the action is invoked with a `description` and `descriptionFormat: text` on a Jira Cloud connection
- **THEN** the description is stored as literal paragraphs without Markdown interpretation

#### Scenario: Incremental label edits

- **WHEN** the action is invoked with `addLabels` and/or `removeLabels`
- **THEN** those labels are added and removed incrementally without affecting the issue's other labels

#### Scenario: Full replacement conflicts with incremental edits

- **WHEN** the action is invoked with `labels` together with `addLabels` or `removeLabels`
- **THEN** the action fails with an input validation error before any Jira API call is made

#### Scenario: Update custom fields

- **WHEN** the action is invoked with only `issueKey` and `customFields`
- **THEN** the update is accepted and the request sent to Jira carries the custom field values verbatim

#### Scenario: Update versions and components

- **WHEN** the action is invoked with only `issueKey` and `fixVersions`
- **THEN** the update is accepted and the request carries the name-referenced fixVersions field

#### Scenario: Unassign an issue

- **WHEN** the action is invoked with only `issueKey` and `unassign: true`
- **THEN** the update is accepted and the request sent to Jira clears the assignee (an explicit null assignee field)

#### Scenario: Assignee conflicts with unassign

- **WHEN** the action is invoked with both `assignee` and `unassign: true`
- **THEN** the action fails with an input validation error before any Jira API call is made

#### Scenario: No fields to update

- **WHEN** the action is invoked with only `issueKey` and no updatable fields
- **THEN** the action fails with an input validation error before any Jira API call is made

#### Scenario: Issue does not exist

- **WHEN** the action is invoked with an issue key that Jira does not know
- **THEN** the action fails with a NotFound-style error naming the issue key
