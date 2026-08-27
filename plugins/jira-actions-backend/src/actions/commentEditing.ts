import { PermissionsService } from '@backstage/backend-plugin-api';
import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { JiraClient } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';
import {
  assertPermission,
  jiraWorkItemDeletePermission,
  jiraWorkItemWritePermission,
} from '../permissions';

export function registerUpdateCommentAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
}) {
  const { actionsRegistry, connections, permissions } = options;

  actionsRegistry.register({
    name: 'update-comment',
    title: 'Update Jira Work Item Comment',
    description:
      'Replaces the body of an existing comment on a Jira work item (issue).',
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
            .describe('The key of the issue, e.g. "PROJ-123"'),
          commentId: z
            .string()
            .describe('The ID of the comment, as returned by get-comments'),
          body: z
            .union([z.string(), z.record(z.any())])
            .describe(
              'The new comment body: a Markdown string by default, or per "bodyFormat" an ADF document (object or JSON string) or literal plain text',
            ),
          bodyFormat: z
            .enum(['markdown', 'adf', 'text'])
            .optional()
            .describe(
              'How to interpret "body": "markdown" (default, converted to ADF on Jira Cloud), "adf" (Jira Cloud only), or "text" (literal plain text)',
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
          commentId: z.string().describe('The ID of the updated comment'),
          url: z.string().describe('A browseable URL of the issue'),
        }),
    },
    action: async ({ input, logger, credentials }) => {
      await assertPermission(
        permissions,
        jiraWorkItemWritePermission,
        credentials,
      );
      const connection = connections.find({ host: input.host });
      const client = new JiraClient(connection);
      await client.updateComment(
        input.issueKey,
        input.commentId,
        input.body,
        input.bodyFormat ?? 'markdown',
      );
      logger.info(
        `Updated comment ${input.commentId} on Jira issue ${input.issueKey}`,
      );
      return {
        output: {
          key: input.issueKey,
          commentId: input.commentId,
          url: client.browseUrl(input.issueKey),
        },
      };
    },
  });
}

export function registerDeleteCommentAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
}) {
  const { actionsRegistry, connections, permissions } = options;

  actionsRegistry.register({
    name: 'delete-comment',
    title: 'Delete Jira Work Item Comment',
    description:
      'Permanently deletes a comment from a Jira work item (issue). This cannot be undone.',
    attributes: {
      readOnly: false,
      destructive: true,
      idempotent: false,
    },
    schema: {
      input: z =>
        z.object({
          issueKey: z
            .string()
            .describe('The key of the issue, e.g. "PROJ-123"'),
          commentId: z
            .string()
            .describe('The ID of the comment, as returned by get-comments'),
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
          commentId: z.string().describe('The ID of the deleted comment'),
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
      await client.deleteComment(input.issueKey, input.commentId);
      logger.info(
        `Deleted comment ${input.commentId} on Jira issue ${input.issueKey}`,
      );
      return {
        output: { key: input.issueKey, commentId: input.commentId },
      };
    },
  });
}
