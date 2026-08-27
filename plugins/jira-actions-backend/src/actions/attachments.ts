import { PermissionsService } from '@backstage/backend-plugin-api';
import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { JiraClient } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';
import { assertPermission, jiraWorkItemReadPermission } from '../permissions';

export function registerGetAttachmentsAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
}) {
  const { actionsRegistry, connections, permissions } = options;

  actionsRegistry.register({
    name: 'get-attachments',
    title: 'Get Jira Work Item Attachments',
    description:
      'Reads the attachments of a Jira work item (issue): filenames, sizes, types, authors, and download URLs. Metadata only — downloading the content requires Jira credentials.',
    attributes: {
      readOnly: true,
      destructive: false,
      idempotent: true,
    },
    examples: [
      {
        title: 'Read the attachments of an issue',
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
          url: z.string().describe('A browseable URL of the issue'),
          attachments: z
            .array(
              z.object({
                id: z.string().describe('The attachment ID'),
                filename: z.string().describe('The attachment filename'),
                downloadUrl: z
                  .string()
                  .describe(
                    'The download URL; fetching it requires Jira credentials',
                  ),
                size: z
                  .number()
                  .optional()
                  .describe('The attachment size in bytes'),
                mimeType: z
                  .string()
                  .optional()
                  .describe('The attachment MIME type'),
                author: z
                  .string()
                  .optional()
                  .describe("The uploader's display name"),
                created: z
                  .string()
                  .optional()
                  .describe('When the attachment was added'),
              }),
            )
            .describe("The issue's attachments"),
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
      const attachments = await client.getAttachments(input.issueKey);
      return {
        output: {
          key: input.issueKey,
          url: client.browseUrl(input.issueKey),
          attachments,
        },
      };
    },
  });
}
