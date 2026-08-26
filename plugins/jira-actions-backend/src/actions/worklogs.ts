import { PermissionsService } from '@backstage/backend-plugin-api';
import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { JiraClient } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';
import {
  assertPermission,
  jiraWorkItemReadPermission,
  jiraWorkItemWritePermission,
} from '../permissions';

export function registerGetWorklogsAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
}) {
  const { actionsRegistry, connections, permissions } = options;

  actionsRegistry.register({
    name: 'get-worklogs',
    title: 'Get Jira Work Item Worklogs',
    description:
      'Reads the work log entries of a Jira work item (issue), with each comment rendered as Markdown by default.',
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
          commentFormat: z
            .enum(['markdown', 'adf', 'text'])
            .optional()
            .describe(
              'How to render each worklog comment: "markdown" (default), "adf" for the raw ADF document, or "text" for plain text',
            ),
          maxResults: z
            .number()
            .int()
            .min(1)
            .max(100)
            .optional()
            .describe('Maximum number of worklogs to return, default 50'),
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
          worklogs: z
            .array(
              z.object({
                id: z.string().describe('The worklog ID'),
                author: z
                  .string()
                  .optional()
                  .describe("The author's display name"),
                timeSpent: z
                  .string()
                  .optional()
                  .describe('The time spent, e.g. "2h 30m"'),
                timeSpentSeconds: z
                  .number()
                  .optional()
                  .describe('The time spent in seconds'),
                started: z
                  .string()
                  .optional()
                  .describe('When the work was started'),
                comment: z
                  .union([z.string(), z.record(z.any())])
                  .optional()
                  .describe('The worklog comment in the requested format'),
              }),
            )
            .describe('The work log entries of the issue'),
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
      const worklogs = await client.getWorklogs(input.issueKey, {
        maxResults: input.maxResults ?? 50,
      });
      return {
        output: {
          key: input.issueKey,
          url: client.browseUrl(input.issueKey),
          worklogs: worklogs.map(worklog => ({
            ...worklog,
            comment: client.readRichText(
              worklog.comment,
              input.commentFormat ?? 'markdown',
            ),
          })),
        },
      };
    },
  });
}

export function registerAddWorklogAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
}) {
  const { actionsRegistry, connections, permissions } = options;

  actionsRegistry.register({
    name: 'add-worklog',
    title: 'Add Jira Work Item Worklog',
    description:
      'Logs work on a Jira work item (issue) with a Jira duration such as "2h 30m" and an optional comment.',
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
            .describe('The key of the issue, e.g. "PROJ-123"'),
          timeSpent: z
            .string()
            .describe('The time spent as a Jira duration, e.g. "2h 30m"'),
          comment: z
            .union([z.string(), z.record(z.any())])
            .optional()
            .describe(
              'An optional comment: a Markdown string by default, or per "commentFormat" an ADF document (object or JSON string) or literal plain text',
            ),
          commentFormat: z
            .enum(['markdown', 'adf', 'text'])
            .optional()
            .describe(
              'How to interpret "comment": "markdown" (default, converted to ADF on Jira Cloud), "adf" (Jira Cloud only), or "text" (literal plain text)',
            ),
          started: z
            .string()
            .optional()
            .describe(
              "When the work was started, as an ISO timestamp; defaults to Jira's own default",
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
          worklogId: z.string().describe('The ID of the created worklog'),
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
      const { worklogId } = await client.addWorklog(input.issueKey, {
        timeSpent: input.timeSpent,
        started: input.started,
        comment: input.comment,
        commentFormat: input.commentFormat,
      });
      logger.info(`Logged ${input.timeSpent} on Jira issue ${input.issueKey}`);
      return {
        output: {
          key: input.issueKey,
          worklogId,
          url: client.browseUrl(input.issueKey),
        },
      };
    },
  });
}
