import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { JiraClient } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';

export function registerCreateWorkItemAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
}) {
  const { actionsRegistry, connections } = options;

  actionsRegistry.register({
    name: 'create-work-item',
    title: 'Create Jira Work Item',
    description:
      'Creates a new work item (issue) such as a Story, Bug or Task in a Jira project, and returns its key and URL.',
    attributes: {
      readOnly: false,
      destructive: false,
      idempotent: false,
    },
    schema: {
      input: z =>
        z.object({
          projectKey: z
            .string()
            .describe(
              'The key of the Jira project to create the issue in, e.g. "PROJ"',
            ),
          issueType: z
            .string()
            .describe(
              'The name of the issue type, e.g. "Story", "Bug" or "Task"',
            ),
          summary: z.string().describe('The summary (title) of the issue'),
          description: z
            .string()
            .optional()
            .describe('A plain-text description of the issue'),
          labels: z
            .array(z.string())
            .optional()
            .describe('Labels to set on the issue'),
          assignee: z
            .string()
            .optional()
            .describe(
              'The assignee: a Jira account ID for Jira Cloud, or a username for Jira Data Center',
            ),
          parentKey: z
            .string()
            .optional()
            .describe(
              'The key of a parent issue, for sub-tasks or issues under an epic',
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
          key: z
            .string()
            .describe('The key of the created issue, e.g. "PROJ-123"'),
          id: z.string().describe('The internal Jira ID of the created issue'),
          url: z.string().describe('A browseable URL of the created issue'),
        }),
    },
    action: async ({ input, logger }) => {
      const connection = connections.find({ host: input.host });
      const client = new JiraClient(connection);
      const issue = await client.createIssue(input);
      logger.info(`Created Jira issue ${issue.key} on ${connection.host}`);
      return { output: issue };
    },
  });
}
