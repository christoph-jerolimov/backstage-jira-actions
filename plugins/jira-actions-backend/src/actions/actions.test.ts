import {
  mockServices,
  registerMswTestHooks,
} from '@backstage/backend-test-utils';
import { actionsRegistryServiceMock } from '@backstage/backend-test-utils/alpha';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { registerCreateWorkItemAction } from './createWorkItem';
import { registerUpdateWorkItemAction } from './updateWorkItem';
import { JiraConnectionsReader } from '../lib/connections';

function makeRegistry(connections: unknown) {
  const actionsRegistry = actionsRegistryServiceMock();
  const reader = JiraConnectionsReader.fromConfig(
    mockServices.rootConfig({ data: { connections } as any }),
  );
  registerCreateWorkItemAction({ actionsRegistry, connections: reader });
  registerUpdateWorkItemAction({ actionsRegistry, connections: reader });
  return actionsRegistry;
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

  it('lists both actions with input and output schemas', async () => {
    const { actions } = await makeRegistry([cloudConnection]).list();
    const ids = actions.map(a => a.id).sort();
    expect(ids).toEqual(['test:create-work-item', 'test:update-work-item']);
    for (const action of actions) {
      expect(action.schema.input).toBeDefined();
      expect(action.schema.output).toBeDefined();
      expect(action.attributes.readOnly).toBe(false);
    }
  });
});
