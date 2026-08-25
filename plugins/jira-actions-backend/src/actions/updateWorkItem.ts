import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { InputError } from '@backstage/errors';
import { JiraClient } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';

const UPDATABLE_FIELDS = [
  'summary',
  'description',
  'labels',
  'assignee',
  'issueType',
] as const;

export function registerUpdateWorkItemAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
}) {
  const { actionsRegistry, connections } = options;

  actionsRegistry.register({
    name: 'update-work-item',
    title: 'Update Jira Work Item',
    description:
      'Modifies fields of an existing Jira work item (issue) identified by its key. At least one field to update must be provided.',
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
            .describe('The key of the issue to update, e.g. "PROJ-123"'),
          summary: z
            .string()
            .optional()
            .describe('The new summary (title) of the issue'),
          description: z
            .string()
            .optional()
            .describe('The new plain-text description of the issue'),
          labels: z
            .array(z.string())
            .optional()
            .describe('The full new list of labels, replacing existing labels'),
          assignee: z
            .string()
            .optional()
            .describe(
              'The new assignee: a Jira account ID for Jira Cloud, or a username for Jira Data Center',
            ),
          issueType: z
            .string()
            .optional()
            .describe('The new issue type name, e.g. "Story", "Bug" or "Task"'),
          host: z
            .string()
            .optional()
            .describe(
              'The Jira host to target when multiple Jira connections are configured; defaults to the first configured connection',
            ),
        }),
      output: z =>
        z.object({
          key: z.string().describe('The key of the updated issue'),
          url: z.string().describe('A browseable URL of the updated issue'),
        }),
    },
    action: async ({ input, logger }) => {
      if (UPDATABLE_FIELDS.every(field => input[field] === undefined)) {
        throw new InputError(
          `At least one field to update must be provided, one of: ${UPDATABLE_FIELDS.join(
            ', ',
          )}`,
        );
      }
      const connection = connections.find({ host: input.host });
      const client = new JiraClient(connection);
      const result = await client.updateIssue(input.issueKey, input);
      logger.info(`Updated Jira issue ${result.key} on ${connection.host}`);
      return { output: result };
    },
  });
}
