import { PermissionsService } from '@backstage/backend-plugin-api';
import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { JiraClient } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';
import {
  assertPermission,
  jiraWorkItemReadPermission,
  jiraWorkItemWritePermission,
} from '../permissions';

export function registerListBoardsAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
}) {
  const { actionsRegistry, connections, permissions } = options;

  actionsRegistry.register({
    name: 'list-boards',
    title: 'List Jira Boards',
    description:
      'Lists the agile boards visible to the configured credentials, optionally filtered by name or project.',
    attributes: {
      readOnly: true,
      destructive: false,
      idempotent: true,
    },
    schema: {
      input: z =>
        z.object({
          name: z
            .string()
            .optional()
            .describe('A filter matched against the board name'),
          projectKey: z
            .string()
            .optional()
            .describe('Restrict to boards of this project'),
          maxResults: z
            .number()
            .int()
            .min(1)
            .max(100)
            .optional()
            .describe('Maximum number of boards to return, default 50'),
          host: z
            .string()
            .optional()
            .describe(
              'The Jira host to target when multiple Jira connections are configured; defaults to the first configured connection',
            ),
        }),
      output: z =>
        z.object({
          boards: z
            .array(
              z.object({
                id: z.string().describe('The board ID'),
                name: z.string().describe('The board name'),
                type: z
                  .string()
                  .optional()
                  .describe('The board type, e.g. "scrum" or "kanban"'),
              }),
            )
            .describe('The visible agile boards'),
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
      const boards = await client.listBoards({
        maxResults: input.maxResults ?? 50,
        name: input.name,
        projectKey: input.projectKey,
      });
      return { output: { boards } };
    },
  });
}

export function registerListSprintsAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
}) {
  const { actionsRegistry, connections, permissions } = options;

  actionsRegistry.register({
    name: 'list-sprints',
    title: 'List Jira Sprints',
    description:
      'Lists the sprints of an agile board, optionally filtered by state (active, future, or closed).',
    attributes: {
      readOnly: true,
      destructive: false,
      idempotent: true,
    },
    schema: {
      input: z =>
        z.object({
          boardId: z
            .string()
            .describe('The ID of the board, as returned by list-boards'),
          state: z
            .enum(['active', 'future', 'closed'])
            .optional()
            .describe('Only return sprints in this state'),
          maxResults: z
            .number()
            .int()
            .min(1)
            .max(100)
            .optional()
            .describe('Maximum number of sprints to return, default 50'),
          host: z
            .string()
            .optional()
            .describe(
              'The Jira host to target when multiple Jira connections are configured; defaults to the first configured connection',
            ),
        }),
      output: z =>
        z.object({
          sprints: z
            .array(
              z.object({
                id: z.string().describe('The sprint ID'),
                name: z.string().describe('The sprint name'),
                state: z
                  .string()
                  .optional()
                  .describe('The sprint state: active, future, or closed'),
                startDate: z
                  .string()
                  .optional()
                  .describe('When the sprint starts'),
                endDate: z.string().optional().describe('When the sprint ends'),
                goal: z.string().optional().describe('The sprint goal'),
              }),
            )
            .describe("The board's sprints"),
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
      const sprints = await client.listSprints(input.boardId, {
        maxResults: input.maxResults ?? 50,
        state: input.state,
      });
      return { output: { sprints } };
    },
  });
}

export function registerMoveToSprintAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
}) {
  const { actionsRegistry, connections, permissions } = options;

  actionsRegistry.register({
    name: 'move-to-sprint',
    title: 'Move Jira Work Items to Sprint',
    description: 'Moves up to fifty Jira work items (issues) into a sprint.',
    attributes: {
      readOnly: false,
      destructive: false,
      idempotent: true,
    },
    schema: {
      input: z =>
        z.object({
          sprintId: z
            .string()
            .describe('The ID of the sprint, as returned by list-sprints'),
          issueKeys: z
            .array(z.string())
            .min(1)
            .max(50)
            .describe('The keys of the issues to move, at most fifty'),
          host: z
            .string()
            .optional()
            .describe(
              'The Jira host to target when multiple Jira connections are configured; defaults to the first configured connection',
            ),
        }),
      output: z =>
        z.object({
          sprintId: z.string().describe('The sprint ID'),
          issueKeys: z
            .array(z.string())
            .describe('The keys of the moved issues'),
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
      await client.moveToSprint(input.sprintId, input.issueKeys);
      logger.info(
        `Moved ${input.issueKeys.length} Jira issue(s) to sprint ${input.sprintId}`,
      );
      return {
        output: { sprintId: input.sprintId, issueKeys: input.issueKeys },
      };
    },
  });
}

export function registerListSprintWorkItemsAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
}) {
  const { actionsRegistry, connections, permissions } = options;

  actionsRegistry.register({
    name: 'list-sprint-work-items',
    title: 'List Jira Sprint Work Items',
    description:
      'Lists the work items (issues) of a sprint, with the same item shape as search-work-items.',
    attributes: {
      readOnly: true,
      destructive: false,
      idempotent: true,
    },
    schema: {
      input: z =>
        z.object({
          sprintId: z
            .string()
            .describe('The ID of the sprint, as returned by list-sprints'),
          maxResults: z
            .number()
            .int()
            .min(1)
            .max(100)
            .optional()
            .describe('Maximum number of items to return, default 50'),
          pageToken: z
            .string()
            .optional()
            .describe(
              'An opaque cursor from a previous invocation to fetch the next page of items',
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
            .describe("The sprint's work items"),
          nextPageToken: z
            .string()
            .optional()
            .describe(
              'Cursor for the next page of items; absent when no further items remain',
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
      const { items, nextPageToken } = await client.listSprintIssues(
        input.sprintId,
        { maxResults: input.maxResults ?? 50, pageToken: input.pageToken },
      );
      return {
        output: {
          items: items.map(({ statusCategory, assigneeName, ...item }) => item),
          nextPageToken,
        },
      };
    },
  });
}

export function registerMoveToBacklogAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
}) {
  const { actionsRegistry, connections, permissions } = options;

  actionsRegistry.register({
    name: 'move-to-backlog',
    title: 'Move Jira Work Items to Backlog',
    description:
      'Moves up to fifty Jira work items (issues) out of their sprints into the backlog.',
    attributes: {
      readOnly: false,
      destructive: false,
      idempotent: true,
    },
    schema: {
      input: z =>
        z.object({
          issueKeys: z
            .array(z.string())
            .min(1)
            .max(50)
            .describe('The keys of the issues to move, at most fifty'),
          host: z
            .string()
            .optional()
            .describe(
              'The Jira host to target when multiple Jira connections are configured; defaults to the first configured connection',
            ),
        }),
      output: z =>
        z.object({
          issueKeys: z
            .array(z.string())
            .describe('The keys of the moved issues'),
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
      await client.moveToBacklog(input.issueKeys);
      logger.info(
        `Moved ${input.issueKeys.length} Jira issue(s) to the backlog`,
      );
      return { output: { issueKeys: input.issueKeys } };
    },
  });
}
