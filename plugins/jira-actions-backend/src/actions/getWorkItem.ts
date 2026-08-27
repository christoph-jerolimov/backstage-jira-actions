import { PermissionsService } from '@backstage/backend-plugin-api';
import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { JiraClient } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';
import { assertPermission, jiraWorkItemReadPermission } from '../permissions';

export function registerGetWorkItemAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
}) {
  const { actionsRegistry, connections, permissions } = options;

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
            .enum(['markdown', 'adf', 'text'])
            .optional()
            .describe(
              'How to render the description: "markdown" (default), "adf" for the raw ADF document, or "text" for plain text with formatting dropped',
            ),
          customFields: z
            .array(z.string())
            .optional()
            .describe(
              'Jira field IDs (e.g. "customfield_10020", discoverable via list-fields) to read in addition to the standard fields',
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
            .union([z.string(), z.record(z.any())])
            .optional()
            .describe(
              'The issue description in the requested format: Markdown by default, the raw ADF document for "adf", or plain text for "text"',
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
          links: z
            .array(
              z.object({
                type: z.string().describe('The link type name, e.g. "Blocks"'),
                direction: z
                  .string()
                  .describe(
                    'The relation as it reads from this issue, e.g. "blocks" or "is blocked by"',
                  ),
                key: z.string().describe('The linked issue key'),
              }),
            )
            .optional()
            .describe("The issue's links to other issues"),
          customFields: z
            .record(z.any())
            .optional()
            .describe(
              'The requested custom field values, keyed by field ID; present when custom fields were requested',
            ),
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
      return {
        output: await client.getIssue(input.issueKey, {
          descriptionFormat: input.descriptionFormat ?? 'markdown',
          customFields: input.customFields,
        }),
      };
    },
  });
}
