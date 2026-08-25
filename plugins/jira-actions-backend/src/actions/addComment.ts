import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { JiraClient } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';

export function registerAddCommentAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
}) {
  const { actionsRegistry, connections } = options;

  actionsRegistry.register({
    name: 'add-comment',
    title: 'Add Comment to Jira Work Item',
    description:
      'Adds a plain-text comment to an existing Jira work item (issue).',
    attributes: {
      readOnly: false,
      destructive: false,
      idempotent: false,
    },
    schema: {
      input: z =>
        z.object({
          issueKey: z
            .string()
            .describe('The key of the issue to comment on, e.g. "PROJ-123"'),
          body: z.string().describe('The plain-text comment body'),
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
          commentId: z.string().describe('The ID of the created comment'),
          url: z.string().describe('A browseable URL of the issue'),
        }),
    },
    action: async ({ input, logger }) => {
      const connection = connections.find({ host: input.host });
      const client = new JiraClient(connection);
      const result = await client.addComment(input.issueKey, input.body);
      logger.info(
        `Added comment ${result.commentId} to Jira issue ${result.key} on ${connection.host}`,
      );
      return { output: result };
    },
  });
}
