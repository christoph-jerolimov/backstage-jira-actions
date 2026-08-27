import { PermissionsService } from '@backstage/backend-plugin-api';
import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { JiraClient } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';
import { assertPermission, jiraWorkItemReadPermission } from '../permissions';

export function registerListTransitionsAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
}) {
  const { actionsRegistry, connections, permissions } = options;

  actionsRegistry.register({
    name: 'list-transitions',
    title: 'List Jira Work Item Transitions',
    description:
      'Lists the workflow transitions currently available on a Jira work item (issue), i.e. the statuses it can move to.',
    attributes: {
      readOnly: true,
      destructive: false,
      idempotent: true,
    },
    schema: {
      input: z =>
        z.object({
          issueKey: z
            .string()
            .describe('The key of the issue, e.g. "PROJ-123"'),
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
          transitions: z
            .array(
              z.object({
                id: z.string().describe('The transition ID'),
                name: z.string().describe('The transition name'),
                toStatus: z
                  .string()
                  .optional()
                  .describe('The status the transition leads to'),
              }),
            )
            .describe('The currently available transitions'),
        }),
    },
    action: async ({ input, credentials }) => {
      await assertPermission(
        permissions,
        jiraWorkItemReadPermission,
        credentials,
      );
      const connection = connections.find({ host: input.host });
      const client = new JiraClient(connection);
      const transitions = await client.listTransitions(input.issueKey);
      return { output: { key: input.issueKey, transitions } };
    },
  });
}
