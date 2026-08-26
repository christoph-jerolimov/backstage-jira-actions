import { PermissionsService } from '@backstage/backend-plugin-api';
import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { JiraClient } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';
import { assertPermission, jiraWorkItemWritePermission } from '../permissions';

export function registerSetWorkItemParentAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
}) {
  const { actionsRegistry, connections, permissions } = options;

  actionsRegistry.register({
    name: 'set-work-item-parent',
    title: 'Set Jira Work Item Parent',
    description:
      'Changes only the parent of a Jira work item (issue), e.g. to move it under a different epic.',
    attributes: {
      readOnly: false,
      destructive: false,
      idempotent: true,
    },
    schema: {
      input: z =>
        z.object({
          issueKey: z
            .string()
            .describe('The key of the issue to re-parent, e.g. "PROJ-123"'),
          parentKey: z
            .string()
            .describe('The key of the new parent issue, e.g. "PROJ-1"'),
          host: z
            .string()
            .optional()
            .describe(
              'The Jira host to target when multiple Jira connections are configured; defaults to the first configured connection',
            ),
        }),
      output: z =>
        z.object({
          key: z.string().describe('The issue key'),
          parentKey: z.string().describe('The key of the new parent issue'),
          url: z.string().describe('A browseable URL of the issue'),
        }),
    },
    action: async ({ input, credentials, logger }) => {
      await assertPermission(
        permissions,
        jiraWorkItemWritePermission,
        credentials,
      );
      const connection = connections.find({ host: input.host });
      const client = new JiraClient(connection);
      await client.setParent(input.issueKey, input.parentKey);
      logger.info(
        `Set parent of Jira issue ${input.issueKey} to ${input.parentKey}`,
      );
      return {
        output: {
          key: input.issueKey,
          parentKey: input.parentKey,
          url: client.browseUrl(input.issueKey),
        },
      };
    },
  });
}
