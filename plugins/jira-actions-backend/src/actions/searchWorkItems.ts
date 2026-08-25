import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { InputError } from '@backstage/errors';
import { JiraClient } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';

export type JiraSearchFilters = {
  projectKey?: string;
  text?: string;
  status?: string;
  issueType?: string;
  assignee?: string;
  labels?: string[];
};

function quote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Builds a JQL query from the simplified search filters. At least one filter
 * must be set; results are ordered by most recently updated.
 */
export function buildJql(filters: JiraSearchFilters): string {
  const clauses: string[] = [];
  if (filters.projectKey !== undefined) {
    clauses.push(`project = ${quote(filters.projectKey)}`);
  }
  if (filters.text !== undefined) {
    clauses.push(`text ~ ${quote(filters.text)}`);
  }
  if (filters.status !== undefined) {
    clauses.push(`status = ${quote(filters.status)}`);
  }
  if (filters.issueType !== undefined) {
    clauses.push(`issuetype = ${quote(filters.issueType)}`);
  }
  if (filters.assignee !== undefined) {
    clauses.push(`assignee = ${quote(filters.assignee)}`);
  }
  if (filters.labels !== undefined && filters.labels.length > 0) {
    clauses.push(`labels IN (${filters.labels.map(quote).join(', ')})`);
  }
  if (clauses.length === 0) {
    throw new InputError('At least one search filter must be provided');
  }
  return `${clauses.join(' AND ')} ORDER BY updated DESC`;
}

export function registerSearchWorkItemsAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
}) {
  const { actionsRegistry, connections } = options;

  actionsRegistry.register({
    name: 'search-work-items',
    title: 'Search Jira Work Items',
    description:
      'Searches Jira work items (issues) either with a raw JQL query or with simplified filters (project, free text, status, issue type, assignee, labels). Provide either "jql" or filters, not both.',
    attributes: {
      readOnly: true,
      destructive: false,
      idempotent: true,
    },
    schema: {
      input: z =>
        z.object({
          jql: z
            .string()
            .optional()
            .describe(
              'A raw JQL query, used as-is. Must not be combined with the simplified filters.',
            ),
          projectKey: z
            .string()
            .optional()
            .describe('Filter: the Jira project key, e.g. "PROJ"'),
          text: z
            .string()
            .optional()
            .describe('Filter: free-text match on summary and description'),
          status: z
            .string()
            .optional()
            .describe('Filter: the status name, e.g. "In Progress"'),
          issueType: z
            .string()
            .optional()
            .describe('Filter: the issue type name, e.g. "Bug"'),
          assignee: z
            .string()
            .optional()
            .describe(
              'Filter: the assignee (account ID on Jira Cloud, username on Jira Data Center)',
            ),
          labels: z
            .array(z.string())
            .optional()
            .describe('Filter: issues carrying any of these labels'),
          maxResults: z
            .number()
            .int()
            .min(1)
            .max(100)
            .optional()
            .describe('Maximum number of results to return, default 25'),
          host: z
            .string()
            .optional()
            .describe(
              'The Jira host to target when multiple Jira connections are configured; defaults to the first configured connection',
            ),
        }),
      output: z =>
        z.object({
          items: z
            .array(
              z.object({
                key: z.string(),
                summary: z.string(),
                status: z.string(),
                issueType: z.string(),
                url: z.string(),
                assignee: z.string().optional(),
              }),
            )
            .describe('The matching issues, most recently updated first'),
        }),
    },
    action: async ({ input }) => {
      const filters: JiraSearchFilters = {
        projectKey: input.projectKey,
        text: input.text,
        status: input.status,
        issueType: input.issueType,
        assignee: input.assignee,
        labels: input.labels,
      };
      const hasFilters = Object.values(filters).some(
        value => value !== undefined,
      );
      if (input.jql !== undefined && hasFilters) {
        throw new InputError(
          'Provide either "jql" or the simplified filters, not both',
        );
      }
      if (input.jql === undefined && !hasFilters) {
        throw new InputError(
          'Provide either "jql" or at least one simplified filter',
        );
      }
      const jql = input.jql ?? buildJql(filters);

      const connection = connections.find({ host: input.host });
      const client = new JiraClient(connection);
      return {
        output: await client.searchIssues({
          jql,
          maxResults: input.maxResults ?? 25,
        }),
      };
    },
  });
}
