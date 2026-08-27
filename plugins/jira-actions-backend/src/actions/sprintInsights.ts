import { PermissionsService } from '@backstage/backend-plugin-api';
import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { JiraClient, JiraSprintIssue } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';
import { assertPermission, jiraWorkItemReadPermission } from '../permissions';

const MAX_INSIGHT_ITEMS = 500;

function toBreakdown(
  items: JiraSprintIssue[],
  key: (item: JiraSprintIssue) => string,
) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const name = key(item);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function registerGetSprintInsightsAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
}) {
  const { actionsRegistry, connections, permissions } = options;

  actionsRegistry.register({
    name: 'get-sprint-insights',
    title: 'Get Jira Sprint Insights',
    description:
      'Summarizes a sprint: its metadata, total and completed work item counts, and breakdowns by status, issue type, and assignee.',
    attributes: {
      readOnly: true,
      destructive: false,
      idempotent: true,
    },
    examples: [
      {
        title: 'Summarize the sprint',
        input: {
          sprintId: '42',
        },
      },
    ],
    schema: {
      input: z =>
        z.object({
          sprintId: z
            .string()
            .describe('The ID of the sprint, as returned by list-sprints'),
          host: z
            .string()
            .optional()
            .describe(
              'The Jira host to target when multiple Jira connections are configured; defaults to the first configured connection',
            ),
        }),
      output: z => {
        const breakdown = z
          .array(
            z.object({
              name: z.string(),
              count: z.number(),
            }),
          )
          .describe('Counts by name, largest first');
        return z.object({
          sprint: z
            .object({
              id: z.string(),
              name: z.string(),
              state: z.string().optional(),
              startDate: z.string().optional(),
              endDate: z.string().optional(),
              goal: z.string().optional(),
            })
            .describe('The sprint metadata'),
          totalItems: z
            .number()
            .describe('The number of work items in the sprint'),
          completedItems: z
            .number()
            .describe('The number of work items whose status category is done'),
          byStatus: breakdown,
          byIssueType: breakdown,
          byAssignee: breakdown,
        });
      },
    },
    action: async ({ input, credentials }) => {
      await assertPermission(
        permissions,
        jiraWorkItemReadPermission,
        credentials,
      );
      const connection = connections.find({ host: input.host });
      const client = new JiraClient(connection);
      const sprint = await client.getSprint(input.sprintId);

      const items: JiraSprintIssue[] = [];
      let pageToken: string | undefined;
      do {
        const page = await client.listSprintIssues(input.sprintId, {
          maxResults: 100,
          pageToken,
        });
        items.push(...page.items);
        pageToken = page.nextPageToken;
      } while (pageToken && items.length < MAX_INSIGHT_ITEMS);

      return {
        output: {
          sprint,
          totalItems: items.length,
          completedItems: items.filter(item => item.statusCategory === 'done')
            .length,
          byStatus: toBreakdown(items, item => item.status || 'Unknown'),
          byIssueType: toBreakdown(items, item => item.issueType || 'Unknown'),
          byAssignee: toBreakdown(
            items,
            item => item.assigneeName ?? 'Unassigned',
          ),
        },
      };
    },
  });
}
