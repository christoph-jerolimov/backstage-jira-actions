import {
  BackstageCredentials,
  PermissionsService,
} from '@backstage/backend-plugin-api';
import { NotAllowedError } from '@backstage/errors';
import {
  AuthorizeResult,
  BasicPermission,
  createPermission,
} from '@backstage/plugin-permission-common';

/**
 * Permission covering the read-only Jira actions.
 *
 * @public
 */
export const jiraWorkItemReadPermission = createPermission({
  name: 'jira.work-item.read',
  attributes: { action: 'read' },
});

/**
 * Permission covering the modifying Jira actions.
 *
 * @public
 */
export const jiraWorkItemWritePermission = createPermission({
  name: 'jira.work-item.write',
  attributes: { action: 'update' },
});

/**
 * Permission covering the destructive delete-work-item action.
 *
 * @public
 */
export const jiraWorkItemDeletePermission = createPermission({
  name: 'jira.work-item.delete',
  attributes: { action: 'delete' },
});

/**
 * All permissions of the jira-actions plugin.
 *
 * @public
 */
export const jiraActionsPermissions = [
  jiraWorkItemReadPermission,
  jiraWorkItemWritePermission,
  jiraWorkItemDeletePermission,
];

/**
 * Authorizes the caller against a permission, throwing NotAllowedError on a
 * denied decision. Called first in every action handler, before any Jira or
 * catalog call.
 */
export async function assertPermission(
  permissions: PermissionsService,
  permission: BasicPermission,
  credentials: BackstageCredentials,
): Promise<void> {
  const [decision] = await permissions.authorize([{ permission }], {
    credentials,
  });
  if (decision.result !== AuthorizeResult.ALLOW) {
    throw new NotAllowedError(
      `The caller is not allowed to perform this action (permission ${permission.name} denied)`,
    );
  }
}
