import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { JiraClient } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';

export function registerListIssueTypesAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
}) {
  const { actionsRegistry, connections } = options;

  actionsRegistry.register({
    name: 'list-issue-types',
    title: 'List Jira Issue Types',
    description:
      'Lists the issue types available in a given Jira project, e.g. Story, Bug, Task.',
    attributes: {
      readOnly: true,
      destructive: false,
      idempotent: true,
    },
    schema: {
      input: z =>
        z.object({
          projectKey: z
            .string()
            .describe('The Jira project key to list issue types for'),
          host: z
            .string()
            .optional()
            .describe(
              'The Jira host to target when multiple Jira connections are configured; defaults to the first configured connection',
            ),
        }),
      output: z =>
        z.object({
          issueTypes: z
            .array(
              z.object({
                id: z.string().describe('The internal Jira issue type ID'),
                name: z.string().describe('The issue type name, e.g. "Bug"'),
                subtask: z
                  .boolean()
                  .describe('Whether this is a sub-task issue type'),
                description: z
                  .string()
                  .optional()
                  .describe('The issue type description'),
              }),
            )
            .describe("The project's issue types"),
        }),
    },
    action: async ({ input }) => {
      const connection = connections.find({ host: input.host });
      const client = new JiraClient(connection);
      const issueTypes = await client.getProjectIssueTypes(input.projectKey);
      return { output: { issueTypes } };
    },
  });
}
