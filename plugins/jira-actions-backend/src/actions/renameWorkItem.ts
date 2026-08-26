import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { JiraClient } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';

export function registerRenameWorkItemAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
}) {
  const { actionsRegistry, connections } = options;

  actionsRegistry.register({
    name: 'rename-work-item',
    title: 'Rename Jira Work Item',
    description:
      'Changes only the summary (title) of a Jira work item (issue).',
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
            .describe('The key of the issue to rename, e.g. "PROJ-123"'),
          summary: z.string().describe('The new summary (title) of the issue'),
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
          summary: z.string().describe('The new summary of the issue'),
          url: z.string().describe('A browseable URL of the issue'),
        }),
    },
    action: async ({ input, logger }) => {
      const connection = connections.find({ host: input.host });
      const client = new JiraClient(connection);
      const result = await client.updateIssue(input.issueKey, {
        summary: input.summary,
      });
      logger.info(`Renamed Jira issue ${result.key} on ${connection.host}`);
      return {
        output: { key: result.key, summary: input.summary, url: result.url },
      };
    },
  });
}
