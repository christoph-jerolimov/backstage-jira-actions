import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { JiraClient } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';

export function registerGetCommentsAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
}) {
  const { actionsRegistry, connections } = options;

  actionsRegistry.register({
    name: 'get-comments',
    title: 'Get Jira Work Item Comments',
    description:
      'Reads the comments of a Jira work item (issue), with each body rendered as Markdown by default.',
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
            .describe('The key of the issue to read, e.g. "PROJ-123"'),
          bodyFormat: z
            .enum(['markdown', 'adf', 'text'])
            .optional()
            .describe(
              'How to render each comment body: "markdown" (default), "adf" for the raw ADF document, or "text" for plain text',
            ),
          maxResults: z
            .number()
            .int()
            .min(1)
            .max(100)
            .optional()
            .describe('Maximum number of comments to return, default 50'),
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
          url: z.string().describe('A browseable URL of the issue'),
          comments: z
            .array(
              z.object({
                id: z.string().describe('The comment ID'),
                author: z
                  .string()
                  .optional()
                  .describe("The comment author's display name"),
                body: z
                  .union([z.string(), z.record(z.any())])
                  .optional()
                  .describe('The comment body in the requested format'),
                created: z
                  .string()
                  .optional()
                  .describe('When the comment was created'),
                updated: z
                  .string()
                  .optional()
                  .describe('When the comment was last updated'),
              }),
            )
            .describe('The comments of the issue, oldest first'),
        }),
    },
    action: async ({ input }) => {
      const connection = connections.find({ host: input.host });
      const client = new JiraClient(connection);
      const comments = await client.getComments(input.issueKey, {
        maxResults: input.maxResults ?? 50,
      });
      return {
        output: {
          key: input.issueKey,
          url: client.browseUrl(input.issueKey),
          comments: comments.map(comment => ({
            ...comment,
            body: client.readRichText(
              comment.body,
              input.bodyFormat ?? 'markdown',
            ),
          })),
        },
      };
    },
  });
}
