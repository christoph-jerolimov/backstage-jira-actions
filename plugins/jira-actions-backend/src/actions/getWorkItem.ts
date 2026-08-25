import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { JiraClient } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';

export function registerGetWorkItemAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
}) {
  const { actionsRegistry, connections } = options;

  actionsRegistry.register({
    name: 'get-work-item',
    title: 'Get Jira Work Item',
    description:
      'Reads a single Jira work item (issue) by its key, returning its summary, status, type, and other fields with the description rendered as Markdown (or plain text on request).',
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
          descriptionFormat: z
            .enum(['markdown', 'text'])
            .optional()
            .describe(
              'How to render the description: "markdown" (default) or "text" for plain text with formatting dropped',
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
          summary: z.string().describe('The issue summary (title)'),
          status: z.string().describe('The current status name'),
          issueType: z.string().describe('The issue type name'),
          url: z.string().describe('A browseable URL of the issue'),
          description: z
            .string()
            .optional()
            .describe(
              'The issue description, rendered as Markdown by default or plain text when descriptionFormat is "text"',
            ),
          assignee: z
            .string()
            .optional()
            .describe(
              'The assignee: a Jira account ID for Jira Cloud, or a username for Jira Data Center',
            ),
          labels: z.array(z.string()).optional().describe('The issue labels'),
          parentKey: z
            .string()
            .optional()
            .describe('The key of the parent issue, if any'),
          created: z.string().optional().describe('When the issue was created'),
          updated: z
            .string()
            .optional()
            .describe('When the issue was last updated'),
        }),
    },
    action: async ({ input }) => {
      const connection = connections.find({ host: input.host });
      const client = new JiraClient(connection);
      return {
        output: await client.getIssue(input.issueKey, {
          descriptionFormat: input.descriptionFormat ?? 'markdown',
        }),
      };
    },
  });
}
