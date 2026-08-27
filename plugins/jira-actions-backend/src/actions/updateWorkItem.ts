import { PermissionsService } from '@backstage/backend-plugin-api';
import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { InputError } from '@backstage/errors';
import { CatalogService } from '@backstage/plugin-catalog-node';
import { JiraClient } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';
import { resolveJiraUser } from '../lib/selfUser';
import { assertPermission, jiraWorkItemWritePermission } from '../permissions';

const UPDATABLE_FIELDS = [
  'summary',
  'description',
  'labels',
  'addLabels',
  'removeLabels',
  'assignee',
  'unassign',
  'issueType',
  'fixVersions',
  'affectsVersions',
  'components',
  'customFields',
] as const;

export function registerUpdateWorkItemAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
  catalog: CatalogService;
}) {
  const { actionsRegistry, connections, permissions, catalog } = options;

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
    examples: [
      {
        title: 'Update the summary and add a label',
        input: {
          issueKey: 'PROJ-123',
          summary: 'Login fails on Safari 18',
          addLabels: ['triaged'],
        },
      },
    ],
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
            .union([z.string(), z.record(z.any())])
            .optional()
            .describe(
              'The new issue description: a Markdown string by default, or per "descriptionFormat" an ADF document (object or JSON string) or literal plain text',
            ),
          descriptionFormat: z
            .enum(['markdown', 'adf', 'text'])
            .optional()
            .describe(
              'How to interpret "description": "markdown" (default, converted to ADF on Jira Cloud), "adf" (an ADF document, Jira Cloud only), or "text" (literal plain text)',
            ),
          labels: z
            .array(z.string())
            .optional()
            .describe('The full new list of labels, replacing existing labels'),
          addLabels: z
            .array(z.string())
            .optional()
            .describe(
              'Labels to add to the existing labels; cannot be combined with "labels"',
            ),
          removeLabels: z
            .array(z.string())
            .optional()
            .describe(
              'Labels to remove from the existing labels; cannot be combined with "labels"',
            ),
          assignee: z
            .string()
            .optional()
            .describe(
              'The new assignee: a Jira account ID for Jira Cloud, a username for Jira Data Center, or "me" for the invoking user',
            ),
          unassign: z
            .boolean()
            .optional()
            .describe('Clear the assignee; cannot be combined with "assignee"'),
          issueType: z
            .string()
            .optional()
            .describe('The new issue type name, e.g. "Story", "Bug" or "Task"'),
          fixVersions: z
            .array(z.string())
            .optional()
            .describe(
              'The full new list of fix version names, replacing existing ones (see list-versions)',
            ),
          affectsVersions: z
            .array(z.string())
            .optional()
            .describe(
              'The full new list of affected version names, replacing existing ones (see list-versions)',
            ),
          components: z
            .array(z.string())
            .optional()
            .describe(
              'The full new list of component names, replacing existing ones (see list-components)',
            ),
          customFields: z
            .record(z.any())
            .optional()
            .describe(
              'New values for additional issue fields keyed by Jira field ID (e.g. "customfield_10020", discoverable via list-fields), passed to Jira verbatim',
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
          key: z.string().describe('The key of the updated issue'),
          url: z.string().describe('A browseable URL of the updated issue'),
        }),
    },
    action: async ({ input, credentials, logger }) => {
      await assertPermission(
        permissions,
        jiraWorkItemWritePermission,
        credentials,
      );
      if (UPDATABLE_FIELDS.every(field => input[field] === undefined)) {
        throw new InputError(
          `At least one field to update must be provided, one of: ${UPDATABLE_FIELDS.join(
            ', ',
          )}`,
        );
      }
      if (
        input.labels !== undefined &&
        (input.addLabels !== undefined || input.removeLabels !== undefined)
      ) {
        throw new InputError(
          'The "labels" field replaces all labels and cannot be combined with "addLabels" or "removeLabels"',
        );
      }
      if (input.assignee !== undefined && input.unassign) {
        throw new InputError(
          'The "assignee" field cannot be combined with "unassign"',
        );
      }
      const connection = connections.find({ host: input.host });
      const client = new JiraClient(connection);
      const assignee =
        input.assignee !== undefined
          ? await resolveJiraUser({
              client,
              catalog,
              credentials,
              value: input.assignee,
            })
          : undefined;
      const labelEdits =
        input.addLabels !== undefined || input.removeLabels !== undefined
          ? { add: input.addLabels, remove: input.removeLabels }
          : undefined;
      const result = await client.updateIssue(
        input.issueKey,
        { ...input, assignee },
        labelEdits,
      );
      logger.info(`Updated Jira issue ${result.key} on ${connection.host}`);
      return { output: result };
    },
  });
}
