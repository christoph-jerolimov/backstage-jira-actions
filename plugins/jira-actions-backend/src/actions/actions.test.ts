import {
  mockServices,
  registerMswTestHooks,
} from '@backstage/backend-test-utils';
import { actionsRegistryServiceMock } from '@backstage/backend-test-utils/alpha';
import { Entity } from '@backstage/catalog-model';
import { catalogServiceMock } from '@backstage/plugin-catalog-node/testUtils';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { registerAddCommentAction } from './addComment';
import { registerCreateWorkItemAction } from './createWorkItem';
import { registerGetWorkItemAction } from './getWorkItem';
import { registerListIssueTypesAction } from './listIssueTypes';
import { registerListProjectsAction } from './listProjects';
import { registerSearchWorkItemsAction } from './searchWorkItems';
import { registerTransitionWorkItemAction } from './transitionWorkItem';
import { registerUpdateWorkItemAction } from './updateWorkItem';
import { JiraConnectionsReader } from '../lib/connections';

function makeRegistry(connections: unknown, entities: Entity[] = []) {
  const actionsRegistry = actionsRegistryServiceMock();
  const reader = JiraConnectionsReader.fromConfig(
    mockServices.rootConfig({ data: { connections } as any }),
  );
  const catalog = catalogServiceMock({ entities });
  registerCreateWorkItemAction({
    actionsRegistry,
    connections: reader,
    catalog,
  });
  registerUpdateWorkItemAction({ actionsRegistry, connections: reader });
  registerGetWorkItemAction({ actionsRegistry, connections: reader });
  registerSearchWorkItemsAction({
    actionsRegistry,
    connections: reader,
    catalog,
  });
  registerAddCommentAction({ actionsRegistry, connections: reader });
  registerTransitionWorkItemAction({ actionsRegistry, connections: reader });
  registerListProjectsAction({ actionsRegistry, connections: reader });
  registerListIssueTypesAction({
    actionsRegistry,
    connections: reader,
    catalog,
  });
  return actionsRegistry;
}

function componentEntity(
  name: string,
  annotations: Record<string, string>,
): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: { name, namespace: 'default', annotations },
  };
}

const cloudConnection = {
  type: 'jira',
  host: 'example.atlassian.net',
  auth: [
    { method: 'basic', username: 'me@example.com', apiToken: 'api-token' },
  ],
};

const datacenterConnection = {
  type: 'jira',
  host: 'jira.example.com',
  product: 'datacenter',
  auth: [{ method: 'pat', token: 'pat-token' }],
};

describe('jira work item actions', () => {
  const server = setupServer();
  registerMswTestHooks(server);

  describe('create-work-item', () => {
    it('creates a bug with minimal input', async () => {
      server.use(
        http.post('https://example.atlassian.net/rest/api/3/issue', () =>
          HttpResponse.json({ id: '10001', key: 'PROJ-123' }, { status: 201 }),
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:create-work-item',
        input: {
          projectKey: 'PROJ',
          issueType: 'Bug',
          summary: 'Login fails on Safari',
        },
      });

      expect(result).toEqual({
        output: {
          id: '10001',
          key: 'PROJ-123',
          url: 'https://example.atlassian.net/browse/PROJ-123',
        },
      });
    });

    it('passes optional fields through to Jira', async () => {
      let received: any;
      server.use(
        http.post(
          'https://example.atlassian.net/rest/api/3/issue',
          async ({ request }) => {
            received = await request.json();
            return HttpResponse.json(
              { id: '10002', key: 'PROJ-124' },
              { status: 201 },
            );
          },
        ),
      );

      await makeRegistry([cloudConnection]).invoke({
        id: 'test:create-work-item',
        input: {
          projectKey: 'PROJ',
          issueType: 'Story',
          summary: 'A story',
          description: 'Some details',
          labels: ['label-1'],
          assignee: 'account-id-1',
        },
      });

      expect(received.fields.labels).toEqual(['label-1']);
      expect(received.fields.assignee).toEqual({ id: 'account-id-1' });
      expect(received.fields.description.type).toBe('doc');
    });

    it('propagates Jira errors', async () => {
      server.use(
        http.post('https://example.atlassian.net/rest/api/3/issue', () =>
          HttpResponse.json(
            { errors: { project: 'Project with key NOPE does not exist' } },
            { status: 400 },
          ),
        ),
      );

      await expect(
        makeRegistry([cloudConnection]).invoke({
          id: 'test:create-work-item',
          input: { projectKey: 'NOPE', issueType: 'Bug', summary: 'x' },
        }),
      ).rejects.toThrow(/Project with key NOPE does not exist/);
    });

    it('fails with a config-pointing error when no jira connection is configured', async () => {
      await expect(
        makeRegistry([]).invoke({
          id: 'test:create-work-item',
          input: { projectKey: 'PROJ', issueType: 'Bug', summary: 'x' },
        }),
      ).rejects.toThrow(
        /No Jira connection is configured.*"connections" section/,
      );
    });

    it('targets the connection selected by the host input', async () => {
      let authorization: string | null = null;
      server.use(
        http.post(
          'https://jira.example.com/rest/api/2/issue',
          ({ request }) => {
            authorization = request.headers.get('authorization');
            return HttpResponse.json(
              { id: '20001', key: 'OPS-1' },
              { status: 201 },
            );
          },
        ),
      );

      const result = await makeRegistry([
        cloudConnection,
        datacenterConnection,
      ]).invoke({
        id: 'test:create-work-item',
        input: {
          projectKey: 'OPS',
          issueType: 'Task',
          summary: 'x',
          host: 'jira.example.com',
        },
      });

      expect(authorization).toBe('Bearer pat-token');
      expect(result).toEqual({
        output: {
          id: '20001',
          key: 'OPS-1',
          url: 'https://jira.example.com/browse/OPS-1',
        },
      });
    });
  });

  describe('update-work-item', () => {
    it('updates the summary of an issue', async () => {
      let received: any;
      server.use(
        http.put(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-123',
          async ({ request }) => {
            received = await request.json();
            return new HttpResponse(null, { status: 204 });
          },
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:update-work-item',
        input: { issueKey: 'PROJ-123', summary: 'New summary' },
      });

      expect(received).toEqual({ fields: { summary: 'New summary' } });
      expect(result).toEqual({
        output: {
          key: 'PROJ-123',
          url: 'https://example.atlassian.net/browse/PROJ-123',
        },
      });
    });

    it('rejects an update without any updatable field before calling Jira', async () => {
      let called = false;
      server.use(
        http.put(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-123',
          () => {
            called = true;
            return new HttpResponse(null, { status: 204 });
          },
        ),
      );

      await expect(
        makeRegistry([cloudConnection]).invoke({
          id: 'test:update-work-item',
          input: { issueKey: 'PROJ-123' },
        }),
      ).rejects.toThrow(/At least one field to update must be provided/);
      expect(called).toBe(false);
    });

    it('fails with NotFound for an unknown issue', async () => {
      server.use(
        http.put(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-999',
          () =>
            HttpResponse.json(
              {
                errorMessages: [
                  'Issue does not exist or you do not have permission to see it.',
                ],
              },
              { status: 404 },
            ),
        ),
      );

      await expect(
        makeRegistry([cloudConnection]).invoke({
          id: 'test:update-work-item',
          input: { issueKey: 'PROJ-999', summary: 'x' },
        }),
      ).rejects.toThrow(/status 404.*Issue does not exist/);
    });
  });

  describe('get-work-item', () => {
    it('reads an issue with plain-text ADF description', async () => {
      server.use(
        http.get(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-123',
          () =>
            HttpResponse.json({
              key: 'PROJ-123',
              fields: {
                summary: 'Login fails on Safari',
                status: { name: 'In Progress' },
                issuetype: { name: 'Bug' },
                description: {
                  type: 'doc',
                  version: 1,
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Broken' }],
                    },
                  ],
                },
              },
            }),
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:get-work-item',
        input: { issueKey: 'PROJ-123' },
      });

      expect(result).toEqual({
        output: {
          key: 'PROJ-123',
          summary: 'Login fails on Safari',
          status: 'In Progress',
          issueType: 'Bug',
          url: 'https://example.atlassian.net/browse/PROJ-123',
          description: 'Broken',
        },
      });
    });

    it('fails with NotFound for an unknown issue', async () => {
      server.use(
        http.get(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-999',
          () =>
            HttpResponse.json(
              { errorMessages: ['Issue does not exist'] },
              { status: 404 },
            ),
        ),
      );

      await expect(
        makeRegistry([cloudConnection]).invoke({
          id: 'test:get-work-item',
          input: { issueKey: 'PROJ-999' },
        }),
      ).rejects.toThrow(/PROJ-999.*status 404/);
    });
  });

  describe('search-work-items', () => {
    it('searches by simplified filters', async () => {
      let received: any;
      server.use(
        http.post(
          'https://example.atlassian.net/rest/api/3/search/jql',
          async ({ request }) => {
            received = await request.json();
            return HttpResponse.json({
              issues: [
                {
                  key: 'PROJ-1',
                  fields: {
                    summary: 'First',
                    status: { name: 'In Progress' },
                    issuetype: { name: 'Story' },
                  },
                },
              ],
            });
          },
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:search-work-items',
        input: { projectKey: 'PROJ', status: 'In Progress' },
      });

      expect(received.jql).toBe(
        'project = "PROJ" AND status = "In Progress" ORDER BY updated DESC',
      );
      expect(received.maxResults).toBe(25);
      expect(result).toEqual({
        output: {
          items: [
            {
              key: 'PROJ-1',
              summary: 'First',
              status: 'In Progress',
              issueType: 'Story',
              url: 'https://example.atlassian.net/browse/PROJ-1',
            },
          ],
        },
      });
    });

    it('passes raw JQL through unchanged', async () => {
      let received: any;
      server.use(
        http.post(
          'https://example.atlassian.net/rest/api/3/search/jql',
          async ({ request }) => {
            received = await request.json();
            return HttpResponse.json({ issues: [] });
          },
        ),
      );

      await makeRegistry([cloudConnection]).invoke({
        id: 'test:search-work-items',
        input: { jql: 'labels = spike ORDER BY created ASC', maxResults: 5 },
      });

      expect(received.jql).toBe('labels = spike ORDER BY created ASC');
      expect(received.maxResults).toBe(5);
    });

    it('rejects jql combined with filters', async () => {
      await expect(
        makeRegistry([cloudConnection]).invoke({
          id: 'test:search-work-items',
          input: { jql: 'project = PROJ', projectKey: 'PROJ' },
        }),
      ).rejects.toThrow(/either "jql" or the simplified filters, not both/);
    });

    it('rejects a search without any criteria', async () => {
      await expect(
        makeRegistry([cloudConnection]).invoke({
          id: 'test:search-work-items',
          input: {},
        }),
      ).rejects.toThrow(/either "jql" or at least one simplified filter/);
    });

    it('propagates invalid JQL errors', async () => {
      server.use(
        http.post('https://example.atlassian.net/rest/api/3/search/jql', () =>
          HttpResponse.json(
            { errorMessages: ['Field "bogus" does not exist'] },
            { status: 400 },
          ),
        ),
      );

      await expect(
        makeRegistry([cloudConnection]).invoke({
          id: 'test:search-work-items',
          input: { jql: 'bogus = 1' },
        }),
      ).rejects.toThrow(/Field "bogus" does not exist/);
    });
  });

  describe('add-comment', () => {
    it('adds a comment and returns its id', async () => {
      let received: any;
      server.use(
        http.post(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-123/comment',
          async ({ request }) => {
            received = await request.json();
            return HttpResponse.json({ id: '5001' }, { status: 201 });
          },
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:add-comment',
        input: { issueKey: 'PROJ-123', body: 'Working on it' },
      });

      expect(received.body.type).toBe('doc');
      expect(result).toEqual({
        output: {
          key: 'PROJ-123',
          commentId: '5001',
          url: 'https://example.atlassian.net/browse/PROJ-123',
        },
      });
    });

    it('fails with NotFound for an unknown issue', async () => {
      server.use(
        http.post(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-999/comment',
          () =>
            HttpResponse.json(
              { errorMessages: ['Issue does not exist'] },
              { status: 404 },
            ),
        ),
      );

      await expect(
        makeRegistry([cloudConnection]).invoke({
          id: 'test:add-comment',
          input: { issueKey: 'PROJ-999', body: 'x' },
        }),
      ).rejects.toThrow(/PROJ-999.*status 404/);
    });
  });

  describe('transition-work-item', () => {
    const issueInStatus = (status: string) =>
      http.get('https://example.atlassian.net/rest/api/3/issue/PROJ-123', () =>
        HttpResponse.json({
          key: 'PROJ-123',
          fields: {
            summary: 'x',
            status: { name: status },
            issuetype: { name: 'Bug' },
          },
        }),
      );

    it('executes the transition matching the target status', async () => {
      let executed: any;
      server.use(
        issueInStatus('To Do'),
        http.get(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-123/transitions',
          () =>
            HttpResponse.json({
              transitions: [
                { id: '11', name: 'Start work', to: { name: 'In Progress' } },
                { id: '21', name: 'Close', to: { name: 'Done' } },
              ],
            }),
        ),
        http.post(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-123/transitions',
          async ({ request }) => {
            executed = await request.json();
            return new HttpResponse(null, { status: 204 });
          },
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:transition-work-item',
        input: { issueKey: 'PROJ-123', status: 'in progress' },
      });

      expect(executed).toEqual({ transition: { id: '11' } });
      expect(result).toEqual({
        output: {
          key: 'PROJ-123',
          status: 'In Progress',
          url: 'https://example.atlassian.net/browse/PROJ-123',
        },
      });
    });

    it('succeeds without transitioning when already in the target status', async () => {
      let transitionsCalled = false;
      server.use(
        issueInStatus('Done'),
        http.get(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-123/transitions',
          () => {
            transitionsCalled = true;
            return HttpResponse.json({ transitions: [] });
          },
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:transition-work-item',
        input: { issueKey: 'PROJ-123', status: 'done' },
      });

      expect(transitionsCalled).toBe(false);
      expect(result).toEqual({
        output: {
          key: 'PROJ-123',
          status: 'Done',
          url: 'https://example.atlassian.net/browse/PROJ-123',
        },
      });
    });

    it('lists reachable statuses when the target is unreachable', async () => {
      server.use(
        issueInStatus('To Do'),
        http.get(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-123/transitions',
          () =>
            HttpResponse.json({
              transitions: [
                { id: '11', name: 'Start work', to: { name: 'In Progress' } },
              ],
            }),
        ),
      );

      await expect(
        makeRegistry([cloudConnection]).invoke({
          id: 'test:transition-work-item',
          input: { issueKey: 'PROJ-123', status: 'Rejected' },
        }),
      ).rejects.toThrow(
        /Cannot transition PROJ-123 to status "Rejected". Reachable statuses: In Progress/,
      );
    });
  });

  describe('list-projects and list-issue-types', () => {
    it('lists projects on cloud', async () => {
      server.use(
        http.get(
          'https://example.atlassian.net/rest/api/3/project/search',
          () =>
            HttpResponse.json({
              values: [{ id: 10000, key: 'PROJ', name: 'Project' }],
            }),
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:list-projects',
        input: {},
      });

      expect(result).toEqual({
        output: { projects: [{ id: '10000', key: 'PROJ', name: 'Project' }] },
      });
    });

    it('lists projects on datacenter via the host input', async () => {
      server.use(
        http.get('https://jira.example.com/rest/api/2/project', () =>
          HttpResponse.json([{ id: '1', key: 'OPS', name: 'Operations' }]),
        ),
      );

      const result = await makeRegistry([
        cloudConnection,
        datacenterConnection,
      ]).invoke({
        id: 'test:list-projects',
        input: { host: 'jira.example.com' },
      });

      expect(result).toEqual({
        output: { projects: [{ id: '1', key: 'OPS', name: 'Operations' }] },
      });
    });

    it('lists the issue types of a project', async () => {
      server.use(
        http.get('https://example.atlassian.net/rest/api/3/project/PROJ', () =>
          HttpResponse.json({
            key: 'PROJ',
            issueTypes: [{ id: 1, name: 'Bug', subtask: false }],
          }),
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:list-issue-types',
        input: { projectKey: 'PROJ' },
      });

      expect(result).toEqual({
        output: { issueTypes: [{ id: '1', name: 'Bug', subtask: false }] },
      });
    });

    it('fails with NotFound for an unknown project', async () => {
      server.use(
        http.get('https://example.atlassian.net/rest/api/3/project/NOPE', () =>
          HttpResponse.json(
            { errorMessages: ['No project could be found'] },
            { status: 404 },
          ),
        ),
      );

      await expect(
        makeRegistry([cloudConnection]).invoke({
          id: 'test:list-issue-types',
          input: { projectKey: 'NOPE' },
        }),
      ).rejects.toThrow(/NOPE.*status 404/);
    });
  });

  describe('catalog entity resolution', () => {
    const annotatedEntity = componentEntity('my-service', {
      'jira/project-key': 'PROJ',
    });

    it('creates a work item for a catalog entity', async () => {
      let received: any;
      server.use(
        http.post(
          'https://example.atlassian.net/rest/api/3/issue',
          async ({ request }) => {
            received = await request.json();
            return HttpResponse.json(
              { id: '10001', key: 'PROJ-123' },
              { status: 201 },
            );
          },
        ),
      );

      const result = await makeRegistry(
        [cloudConnection],
        [annotatedEntity],
      ).invoke({
        id: 'test:create-work-item',
        input: {
          entityRef: 'component:default/my-service',
          issueType: 'Bug',
          summary: 'x',
        },
      });

      expect(received.fields.project).toEqual({ key: 'PROJ' });
      expect(result).toEqual({
        output: {
          id: '10001',
          key: 'PROJ-123',
          url: 'https://example.atlassian.net/browse/PROJ-123',
        },
      });
    });

    it('rejects both projectKey and entityRef before any call', async () => {
      await expect(
        makeRegistry([cloudConnection], [annotatedEntity]).invoke({
          id: 'test:create-work-item',
          input: {
            projectKey: 'PROJ',
            entityRef: 'component:default/my-service',
            issueType: 'Bug',
            summary: 'x',
          },
        }),
      ).rejects.toThrow(/exactly one of "projectKey" and "entityRef"/);
    });

    it('rejects neither projectKey nor entityRef', async () => {
      await expect(
        makeRegistry([cloudConnection]).invoke({
          id: 'test:create-work-item',
          input: { issueType: 'Bug', summary: 'x' },
        }),
      ).rejects.toThrow(/exactly one of "projectKey" and "entityRef"/);
    });

    it('fails with NotFound for an unknown entity', async () => {
      await expect(
        makeRegistry([cloudConnection]).invoke({
          id: 'test:create-work-item',
          input: {
            entityRef: 'component:default/nope',
            issueType: 'Bug',
            summary: 'x',
          },
        }),
      ).rejects.toThrow(
        /Entity "component:default\/nope" was not found in the catalog/,
      );
    });

    it('fails when the entity lacks the project-key annotation', async () => {
      await expect(
        makeRegistry([cloudConnection], [componentEntity('bare', {})]).invoke({
          id: 'test:create-work-item',
          input: {
            entityRef: 'component:default/bare',
            issueType: 'Bug',
            summary: 'x',
          },
        }),
      ).rejects.toThrow(/has no "jira\/project-key" annotation/);
    });

    it('selects the connection from the jira/host annotation', async () => {
      let received: any;
      server.use(
        http.post(
          'https://jira.example.com/rest/api/2/issue',
          async ({ request }) => {
            received = await request.json();
            return HttpResponse.json(
              { id: '20001', key: 'OPS-1' },
              { status: 201 },
            );
          },
        ),
      );

      await makeRegistry(
        [cloudConnection, datacenterConnection],
        [
          componentEntity('ops-service', {
            'jira/project-key': 'OPS',
            'jira/host': 'jira.example.com',
          }),
        ],
      ).invoke({
        id: 'test:create-work-item',
        input: {
          entityRef: 'component:default/ops-service',
          issueType: 'Task',
          summary: 'x',
        },
      });

      expect(received.fields.project).toEqual({ key: 'OPS' });
    });

    it('prefers an explicit host input over the annotation', async () => {
      let received: any;
      server.use(
        http.post(
          'https://example.atlassian.net/rest/api/3/issue',
          async ({ request }) => {
            received = await request.json();
            return HttpResponse.json(
              { id: '10002', key: 'OPS-2' },
              { status: 201 },
            );
          },
        ),
      );

      await makeRegistry(
        [cloudConnection, datacenterConnection],
        [
          componentEntity('ops-service', {
            'jira/project-key': 'OPS',
            'jira/host': 'jira.example.com',
          }),
        ],
      ).invoke({
        id: 'test:create-work-item',
        input: {
          entityRef: 'component:default/ops-service',
          issueType: 'Task',
          summary: 'x',
          host: 'example.atlassian.net',
        },
      });

      expect(received.fields.project).toEqual({ key: 'OPS' });
    });

    it('restricts a search to the entity project', async () => {
      let received: any;
      server.use(
        http.post(
          'https://example.atlassian.net/rest/api/3/search/jql',
          async ({ request }) => {
            received = await request.json();
            return HttpResponse.json({ issues: [] });
          },
        ),
      );

      await makeRegistry([cloudConnection], [annotatedEntity]).invoke({
        id: 'test:search-work-items',
        input: {
          entityRef: 'component:default/my-service',
          status: 'In Progress',
        },
      });

      expect(received.jql).toBe(
        'project = "PROJ" AND status = "In Progress" ORDER BY updated DESC',
      );
    });

    it('rejects a search with both projectKey and entityRef', async () => {
      await expect(
        makeRegistry([cloudConnection], [annotatedEntity]).invoke({
          id: 'test:search-work-items',
          input: {
            projectKey: 'PROJ',
            entityRef: 'component:default/my-service',
          },
        }),
      ).rejects.toThrow(/either "projectKey" or "entityRef", not both/);
    });

    it('lists issue types via entity ref', async () => {
      server.use(
        http.get('https://example.atlassian.net/rest/api/3/project/PROJ', () =>
          HttpResponse.json({
            key: 'PROJ',
            issueTypes: [{ id: 1, name: 'Bug', subtask: false }],
          }),
        ),
      );

      const result = await makeRegistry(
        [cloudConnection],
        [annotatedEntity],
      ).invoke({
        id: 'test:list-issue-types',
        input: { entityRef: 'component:default/my-service' },
      });

      expect(result).toEqual({
        output: { issueTypes: [{ id: '1', name: 'Bug', subtask: false }] },
      });
    });

    it('rejects list-issue-types without projectKey or entityRef', async () => {
      await expect(
        makeRegistry([cloudConnection]).invoke({
          id: 'test:list-issue-types',
          input: {},
        }),
      ).rejects.toThrow(/exactly one of "projectKey" and "entityRef"/);
    });
  });

  it('lists all eight actions with schemas and read-only attributes', async () => {
    const { actions } = await makeRegistry([cloudConnection]).list();
    const ids = actions.map(a => a.id).sort();
    expect(ids).toEqual([
      'test:add-comment',
      'test:create-work-item',
      'test:get-work-item',
      'test:list-issue-types',
      'test:list-projects',
      'test:search-work-items',
      'test:transition-work-item',
      'test:update-work-item',
    ]);
    const readOnlyActions = actions
      .filter(a => a.attributes.readOnly)
      .map(a => a.id)
      .sort();
    expect(readOnlyActions).toEqual([
      'test:get-work-item',
      'test:list-issue-types',
      'test:list-projects',
      'test:search-work-items',
    ]);
    for (const action of actions) {
      expect(action.schema.input).toBeDefined();
      expect(action.schema.output).toBeDefined();
      expect(action.attributes.destructive).toBe(false);
    }
  });
});

describe('markdown descriptions', () => {
  const server = setupServer();
  registerMswTestHooks(server);

  const formattedAdf = {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Steps' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'reproduce it' }],
      },
    ],
  };

  it('create-work-item converts a markdown description to ADF', async () => {
    let received: any;
    server.use(
      http.post(
        'https://example.atlassian.net/rest/api/3/issue',
        async ({ request }) => {
          received = await request.json();
          return HttpResponse.json({ id: '1', key: 'PROJ-9' }, { status: 201 });
        },
      ),
    );

    await makeRegistry([cloudConnection]).invoke({
      id: 'test:create-work-item',
      input: {
        projectKey: 'PROJ',
        issueType: 'Bug',
        summary: 'x',
        description: '## Steps\n\nreproduce it',
      },
    });

    expect(received.fields.description).toEqual(formattedAdf);
  });

  it('get-work-item returns markdown by default and text on request', async () => {
    server.use(
      http.get('https://example.atlassian.net/rest/api/3/issue/PROJ-9', () =>
        HttpResponse.json({
          key: 'PROJ-9',
          fields: {
            summary: 'x',
            status: { name: 'To Do' },
            issuetype: { name: 'Bug' },
            description: formattedAdf,
          },
        }),
      ),
    );

    const registry = makeRegistry([cloudConnection]);
    const asMarkdown = (await registry.invoke({
      id: 'test:get-work-item',
      input: { issueKey: 'PROJ-9' },
    })) as { output: { description?: string } };
    expect(asMarkdown.output.description).toBe('## Steps\n\nreproduce it');

    const asText = (await registry.invoke({
      id: 'test:get-work-item',
      input: { issueKey: 'PROJ-9', descriptionFormat: 'text' },
    })) as { output: { description?: string } };
    expect(asText.output.description).toBe('Steps\nreproduce it');
  });
});

describe('rich text format inputs', () => {
  const server = setupServer();
  registerMswTestHooks(server);

  const adfDoc = {
    type: 'doc',
    version: 1,
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'verbatim' }] },
    ],
  };

  it('create-work-item writes an adf description verbatim', async () => {
    let received: any;
    server.use(
      http.post(
        'https://example.atlassian.net/rest/api/3/issue',
        async ({ request }) => {
          received = await request.json();
          return HttpResponse.json({ id: '1', key: 'PROJ-1' }, { status: 201 });
        },
      ),
    );

    await makeRegistry([cloudConnection]).invoke({
      id: 'test:create-work-item',
      input: {
        projectKey: 'PROJ',
        issueType: 'Bug',
        summary: 'x',
        description: adfDoc,
        descriptionFormat: 'adf',
      },
    });

    expect(received.fields.description).toEqual(adfDoc);
  });

  it('add-comment accepts a JSON-string adf body', async () => {
    let received: any;
    server.use(
      http.post(
        'https://example.atlassian.net/rest/api/3/issue/PROJ-1/comment',
        async ({ request }) => {
          received = await request.json();
          return HttpResponse.json({ id: '5' }, { status: 201 });
        },
      ),
    );

    await makeRegistry([cloudConnection]).invoke({
      id: 'test:add-comment',
      input: {
        issueKey: 'PROJ-1',
        body: JSON.stringify(adfDoc),
        bodyFormat: 'adf',
      },
    });

    expect(received.body).toEqual(adfDoc);
  });

  it('update-work-item writes literal text without markdown parsing', async () => {
    let received: any;
    server.use(
      http.put(
        'https://example.atlassian.net/rest/api/3/issue/PROJ-1',
        async ({ request }) => {
          received = await request.json();
          return new HttpResponse(null, { status: 204 });
        },
      ),
    );

    await makeRegistry([cloudConnection]).invoke({
      id: 'test:update-work-item',
      input: {
        issueKey: 'PROJ-1',
        description: '# not a heading',
        descriptionFormat: 'text',
      },
    });

    expect(received.fields.description.content).toEqual([
      {
        type: 'paragraph',
        content: [{ type: 'text', text: '# not a heading' }],
      },
    ]);
  });

  it('rejects adf on a datacenter connection', async () => {
    await expect(
      makeRegistry([datacenterConnection]).invoke({
        id: 'test:add-comment',
        input: { issueKey: 'OPS-1', body: adfDoc, bodyFormat: 'adf' },
      }),
    ).rejects.toThrow(/"adf" requires a Jira Cloud connection/);
  });

  it('rejects an update with only descriptionFormat as a modifier', async () => {
    await expect(
      makeRegistry([cloudConnection]).invoke({
        id: 'test:update-work-item',
        input: { issueKey: 'PROJ-1', descriptionFormat: 'text' },
      }),
    ).rejects.toThrow(/At least one field to update must be provided/);
  });

  it('get-work-item returns the raw adf document on request', async () => {
    server.use(
      http.get('https://example.atlassian.net/rest/api/3/issue/PROJ-1', () =>
        HttpResponse.json({
          key: 'PROJ-1',
          fields: {
            summary: 'x',
            status: { name: 'To Do' },
            issuetype: { name: 'Bug' },
            description: adfDoc,
          },
        }),
      ),
    );

    const result = (await makeRegistry([cloudConnection]).invoke({
      id: 'test:get-work-item',
      input: { issueKey: 'PROJ-1', descriptionFormat: 'adf' },
    })) as { output: { description?: unknown } };

    expect(result.output.description).toEqual(adfDoc);
  });
});
