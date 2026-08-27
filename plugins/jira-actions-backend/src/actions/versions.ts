import {
  BackstageCredentials,
  PermissionsService,
} from '@backstage/backend-plugin-api';
import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { InputError } from '@backstage/errors';
import { CatalogService } from '@backstage/plugin-catalog-node';
import { JiraClient } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';
import { resolveEntityProject } from '../lib/entityProject';
import {
  assertPermission,
  jiraWorkItemReadPermission,
  jiraWorkItemWritePermission,
} from '../permissions';

type ProjectScopedOptions = {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
  catalog: CatalogService;
};

async function resolveProjectClient(options: {
  connections: JiraConnectionsReader;
  catalog: CatalogService;
  credentials: BackstageCredentials;
  projectKey?: string;
  entityRef?: string;
  host?: string;
}): Promise<{ client: JiraClient; projectKey: string }> {
  if (
    (options.projectKey === undefined) ===
    (options.entityRef === undefined)
  ) {
    throw new InputError('Provide exactly one of "projectKey" and "entityRef"');
  }
  let projectKey = options.projectKey;
  let annotationHost: string | undefined;
  if (options.entityRef !== undefined) {
    const resolved = await resolveEntityProject({
      catalog: options.catalog,
      entityRef: options.entityRef,
      credentials: options.credentials,
    });
    projectKey = resolved.projectKey;
    annotationHost = resolved.host;
  }
  const connection = options.connections.find({
    host: options.host ?? annotationHost,
  });
  return { client: new JiraClient(connection), projectKey: projectKey! };
}

const projectInputs = (z: any) => ({
  projectKey: z
    .string()
    .optional()
    .describe('The Jira project key, e.g. "PROJ"; alternative to "entityRef"'),
  entityRef: z
    .string()
    .optional()
    .describe(
      'A catalog entity ref, e.g. "component:default/my-service", whose "jira/project-key" annotation identifies the project; alternative to "projectKey"',
    ),
  host: z
    .string()
    .optional()
    .describe(
      'The Jira host to target when multiple Jira connections are configured; defaults to the entity\'s "jira/host" annotation or the first configured connection',
    ),
});

export function registerListVersionsAction(options: ProjectScopedOptions) {
  const { actionsRegistry, connections, permissions, catalog } = options;

  actionsRegistry.register({
    name: 'list-versions',
    title: 'List Jira Versions',
    description:
      'Lists the versions of a Jira project, e.g. to discover valid fixVersions names.',
    attributes: {
      readOnly: true,
      destructive: false,
      idempotent: true,
    },
    examples: [
      {
        title: 'List the versions of a project',
        input: {
          projectKey: 'PROJ',
        },
      },
    ],
    schema: {
      input: z => z.object(projectInputs(z)),
      output: z =>
        z.object({
          versions: z
            .array(
              z.object({
                id: z.string().describe('The version ID'),
                name: z.string().describe('The version name, e.g. "1.2.0"'),
                released: z
                  .boolean()
                  .describe('Whether the version is released'),
                archived: z
                  .boolean()
                  .describe('Whether the version is archived'),
                startDate: z
                  .string()
                  .optional()
                  .describe('The version start date'),
                releaseDate: z
                  .string()
                  .optional()
                  .describe('The version release date'),
                description: z
                  .string()
                  .optional()
                  .describe('The version description'),
              }),
            )
            .describe("The project's versions"),
        }),
    },
    action: async ({ input, credentials }) => {
      await assertPermission(
        permissions,
        jiraWorkItemReadPermission,
        credentials,
      );
      const { client, projectKey } = await resolveProjectClient({
        connections,
        catalog,
        credentials,
        ...input,
      });
      const versions = await client.listVersions(projectKey);
      return { output: { versions } };
    },
  });
}

export function registerListComponentsAction(options: ProjectScopedOptions) {
  const { actionsRegistry, connections, permissions, catalog } = options;

  actionsRegistry.register({
    name: 'list-components',
    title: 'List Jira Components',
    description:
      'Lists the components of a Jira project, e.g. to discover valid component names.',
    attributes: {
      readOnly: true,
      destructive: false,
      idempotent: true,
    },
    examples: [
      {
        title: 'List the components of a project',
        input: {
          projectKey: 'PROJ',
        },
      },
    ],
    schema: {
      input: z => z.object(projectInputs(z)),
      output: z =>
        z.object({
          components: z
            .array(
              z.object({
                id: z.string().describe('The component ID'),
                name: z.string().describe('The component name'),
                description: z
                  .string()
                  .optional()
                  .describe('The component description'),
                lead: z
                  .string()
                  .optional()
                  .describe("The component lead's display name"),
              }),
            )
            .describe("The project's components"),
        }),
    },
    action: async ({ input, credentials }) => {
      await assertPermission(
        permissions,
        jiraWorkItemReadPermission,
        credentials,
      );
      const { client, projectKey } = await resolveProjectClient({
        connections,
        catalog,
        credentials,
        ...input,
      });
      const components = await client.listComponents(projectKey);
      return { output: { components } };
    },
  });
}

export function registerCreateVersionAction(options: ProjectScopedOptions) {
  const { actionsRegistry, connections, permissions, catalog } = options;

  actionsRegistry.register({
    name: 'create-version',
    title: 'Create Jira Version',
    description:
      'Creates a version in a Jira project, e.g. for an upcoming release.',
    attributes: {
      readOnly: false,
      destructive: false,
      idempotent: false,
    },
    examples: [
      {
        title: 'Create a release version',
        input: {
          projectKey: 'PROJ',
          name: '1.2.0',
          releaseDate: '2026-09-30',
        },
      },
    ],
    schema: {
      input: z =>
        z.object({
          ...projectInputs(z),
          name: z.string().describe('The version name, e.g. "1.2.0"'),
          description: z
            .string()
            .optional()
            .describe('The version description'),
          startDate: z
            .string()
            .optional()
            .describe('The start date as "YYYY-MM-DD"'),
          releaseDate: z
            .string()
            .optional()
            .describe('The planned release date as "YYYY-MM-DD"'),
        }),
      output: z =>
        z.object({
          id: z.string().describe('The ID of the created version'),
          name: z.string().describe('The name of the created version'),
        }),
    },
    action: async ({ input, logger, credentials }) => {
      await assertPermission(
        permissions,
        jiraWorkItemWritePermission,
        credentials,
      );
      const { client, projectKey } = await resolveProjectClient({
        connections,
        catalog,
        credentials,
        projectKey: input.projectKey,
        entityRef: input.entityRef,
        host: input.host,
      });
      const version = await client.createVersion({
        projectKey,
        name: input.name,
        description: input.description,
        startDate: input.startDate,
        releaseDate: input.releaseDate,
      });
      logger.info(
        `Created Jira version ${version.name} in project ${projectKey}`,
      );
      return { output: version };
    },
  });
}
