import { PermissionsService } from '@backstage/backend-plugin-api';
import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { JiraClient } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';
import { assertPermission, jiraWorkItemWritePermission } from '../permissions';

function registerLabelAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
  mode: 'add' | 'remove';
}) {
  const { actionsRegistry, connections, permissions, mode } = options;

  actionsRegistry.register({
    name: `${mode}-label`,
    title:
      mode === 'add'
        ? 'Add Label to Jira Work Item'
        : 'Remove Label from Jira Work Item',
    description:
      mode === 'add'
        ? 'Adds a single label to a Jira work item (issue) without affecting its other labels. Adding an existing label is a no-op.'
        : 'Removes a single label from a Jira work item (issue) without affecting its other labels. Removing an absent label is a no-op.',
    attributes: {
      readOnly: false,
      destructive: false,
      idempotent: true,
    },
    examples: [
      {
        title: mode === 'add' ? 'Add a label' : 'Remove a label',
        input: { issueKey: 'PROJ-123', label: 'needs-review' },
      },
    ],
    schema: {
      input: z =>
        z.object({
          issueKey: z
            .string()
            .describe('The key of the issue, e.g. "PROJ-123"'),
          label: z.string().describe(`The label to ${mode}`),
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
          labels: z
            .array(z.string())
            .describe("The issue's labels after the change"),
        }),
    },
    action: async ({ input, credentials, logger }) => {
      await assertPermission(
        permissions,
        jiraWorkItemWritePermission,
        credentials,
      );
      const connection = connections.find({ host: input.host });
      const client = new JiraClient(connection);
      const labels = await client.editLabels(
        input.issueKey,
        mode === 'add' ? { add: [input.label] } : { remove: [input.label] },
      );
      logger.info(
        `${mode === 'add' ? 'Added' : 'Removed'} label "${
          input.label
        }" on Jira issue ${input.issueKey}`,
      );
      return {
        output: {
          key: input.issueKey,
          url: client.browseUrl(input.issueKey),
          labels,
        },
      };
    },
  });
}

export function registerAddLabelAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
}) {
  registerLabelAction({ ...options, mode: 'add' });
}

export function registerRemoveLabelAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
}) {
  registerLabelAction({ ...options, mode: 'remove' });
}
