# Proposal: Comment Editing

## Why

Comments can be added and read but never corrected or removed — an agent that posted a wrong or outdated comment has no way to fix it. Editing and deletion round out the comment lifecycle.

## What Changes

- New `update-comment` action: replaces a comment's body (rich-text format selector as on add-comment).
- New `delete-comment` action: permanently removes a comment — the second destructive action, guarded by the delete permission.
- Registration grows to thirty-three actions; the destructive set becomes the two delete actions. One template per new action (33 templates).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `jira-work-item-actions`: two ADDED action requirements; MODIFIED registration and permission-gating requirements (delete permission now covers both delete actions).
- `jira-action-templates`: MODIFIED one-template-per-action requirement (33 templates).

## Impact

- `JiraClient`: `updateComment`, `deleteComment`; new `commentEditing.ts` action module; `plugin.ts`; two templates + `all.yaml`; fixture and discovery tests (destructive set assertion changes); README.
