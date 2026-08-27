import { PermissionsService } from '@backstage/backend-plugin-api';
import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { JiraClient } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';
import { assertPermission, jiraWorkItemDeletePermission } from '../permissions';

export function registerDeleteWorkItemAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
}) {
  const { actionsRegistry, connections, permissions } = options;

  actionsRegistry.register({
    name: 'delete-work-item',
    title: 'Delete Jira Work Item',
    description:
      'Permanently deletes a Jira work item (issue). This cannot be undone.',
    attributes: {
      readOnly: false,
      destructive: true,
      idempotent: false,
    },
    examples: [
      {
        title: 'Delete an issue',
        input: {
          issueKey: 'PROJ-123',
        },
      },
    ],
    schema: {
      input: z =>
        z.object({
          issueKey: z
            .string()
            .describe('The key of the issue to delete, e.g. "PROJ-123"'),
          deleteSubtasks: z
            .boolean()
            .optional()
            .describe(
              "Also delete the issue's sub-tasks; without it, deleting an issue that has sub-tasks fails (default false)",
            ),
          host: z
            .string()
            .optional()
            .describe(
              'The Jira host to target when multiple Jira connections are configured; defaults to the first configured connection',
            ),
        }),
      output: z =>
        z.object({
          key: z.string().describe('The key of the deleted issue'),
        }),
    },
    action: async ({ input, logger, credentials }) => {
      await assertPermission(
        permissions,
        jiraWorkItemDeletePermission,
        credentials,
      );
      const connection = connections.find({ host: input.host });
      const client = new JiraClient(connection);
      await client.deleteIssue(input.issueKey, {
        deleteSubtasks: input.deleteSubtasks,
      });
      logger.info(`Deleted Jira issue ${input.issueKey}`);
      return { output: { key: input.issueKey } };
    },
  });
}
