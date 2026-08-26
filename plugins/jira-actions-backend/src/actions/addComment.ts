import { PermissionsService } from '@backstage/backend-plugin-api';
import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { JiraClient } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';
import { assertPermission, jiraWorkItemWritePermission } from '../permissions';

export function registerAddCommentAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
}) {
  const { actionsRegistry, connections, permissions } = options;

  actionsRegistry.register({
    name: 'add-comment',
    title: 'Add Comment to Jira Work Item',
    description:
      'Adds a comment to an existing Jira work item (issue). The body is Markdown, converted to ADF on Jira Cloud.',
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
          body: z
            .union([z.string(), z.record(z.any())])
            .describe(
              'The comment body: a Markdown string by default, or per "bodyFormat" an ADF document (object or JSON string) or literal plain text',
            ),
          bodyFormat: z
            .enum(['markdown', 'adf', 'text'])
            .optional()
            .describe(
              'How to interpret "body": "markdown" (default, converted to ADF on Jira Cloud), "adf" (an ADF document, Jira Cloud only), or "text" (literal plain text)',
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
          key: z.string().describe('The issue key'),
          commentId: z.string().describe('The ID of the created comment'),
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
      const result = await client.addComment(
        input.issueKey,
        input.body,
        input.bodyFormat ?? 'markdown',
      );
      logger.info(
        `Added comment ${result.commentId} to Jira issue ${result.key} on ${connection.host}`,
      );
      return { output: result };
    },
  });
}
