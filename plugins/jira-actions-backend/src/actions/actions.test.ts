import {
  mockCredentials,
  mockServices,
  registerMswTestHooks,
} from '@backstage/backend-test-utils';
import { actionsRegistryServiceMock } from '@backstage/backend-test-utils/alpha';
import { Entity } from '@backstage/catalog-model';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import { catalogServiceMock } from '@backstage/plugin-catalog-node/testUtils';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { registerAddCommentAction } from './addComment';
import {
  registerListBoardsAction,
  registerListSprintsAction,
  registerListSprintWorkItemsAction,
  registerMoveToBacklogAction,
  registerMoveToSprintAction,
} from './agile';
import {
  registerDeleteCommentAction,
  registerUpdateCommentAction,
} from './commentEditing';
import { registerCreateWorkItemAction } from './createWorkItem';
import { registerDeleteWorkItemAction } from './deleteWorkItem';
import { registerGetCommentsAction } from './getComments';
import { registerGetWorkItemAction } from './getWorkItem';
import {
  registerLinkWorkItemsAction,
  registerListLinkTypesAction,
} from './issueLinks';
import { registerAddLabelAction, registerRemoveLabelAction } from './labels';
import { registerListFieldsAction } from './listFields';
import { registerListIssueTypesAction } from './listIssueTypes';
import { registerListProjectsAction } from './listProjects';
import { registerListTransitionsAction } from './listTransitions';
import {
  registerAddRemoteLinkAction,
  registerGetRemoteLinksAction,
} from './remoteLinks';
import { registerRenameWorkItemAction } from './renameWorkItem';
import { registerSearchUsersAction } from './searchUsers';
import { registerGetSprintInsightsAction } from './sprintInsights';
import { registerSearchWorkItemsAction } from './searchWorkItems';
import { registerSetWorkItemParentAction } from './setWorkItemParent';
import { registerTransitionWorkItemAction } from './transitionWorkItem';
import { registerUpdateWorkItemAction } from './updateWorkItem';
import {
  registerCreateVersionAction,
  registerListComponentsAction,
  registerListVersionsAction,
} from './versions';
import {
  registerAddWatcherAction,
  registerRemoveWatcherAction,
} from './watchers';
import {
  registerAddWorklogAction,
  registerGetWorklogsAction,
} from './worklogs';
import { JiraConnectionsReader } from '../lib/connections';

function makeRegistry(
  connections: unknown,
  entities: Entity[] = [],
  permissions = mockServices.permissions(),
) {
  const actionsRegistry = actionsRegistryServiceMock();
  const reader = JiraConnectionsReader.fromConfig(
    mockServices.rootConfig({ data: { connections } as any }),
  );
  const catalog = catalogServiceMock({ entities });
  registerCreateWorkItemAction({
    actionsRegistry,
    connections: reader,
    catalog,
    permissions,
  });
  registerUpdateWorkItemAction({
    actionsRegistry,
    connections: reader,
    permissions,
    catalog,
  });
  registerRenameWorkItemAction({
    actionsRegistry,
    connections: reader,
    permissions,
  });
  registerSetWorkItemParentAction({
    actionsRegistry,
    connections: reader,
    permissions,
  });
  registerAddLabelAction({ actionsRegistry, connections: reader, permissions });
  registerRemoveLabelAction({
    actionsRegistry,
    connections: reader,
    permissions,
  });
  registerGetWorkItemAction({
    actionsRegistry,
    connections: reader,
    permissions,
  });
  registerGetCommentsAction({
    actionsRegistry,
    connections: reader,
    permissions,
  });
  registerSearchWorkItemsAction({
    actionsRegistry,
    connections: reader,
    catalog,
    permissions,
  });
  registerAddCommentAction({
    actionsRegistry,
    connections: reader,
    permissions,
  });
  registerTransitionWorkItemAction({
    actionsRegistry,
    connections: reader,
    permissions,
  });
  registerListProjectsAction({
    actionsRegistry,
    connections: reader,
    permissions,
  });
  registerListIssueTypesAction({
    actionsRegistry,
    connections: reader,
    catalog,
    permissions,
  });
  const common = { actionsRegistry, connections: reader, permissions };
  registerUpdateCommentAction(common);
  registerDeleteCommentAction(common);
  registerAddRemoteLinkAction(common);
  registerGetRemoteLinksAction(common);
  registerListVersionsAction({ ...common, catalog });
  registerListComponentsAction({ ...common, catalog });
  registerCreateVersionAction({ ...common, catalog });
  registerDeleteWorkItemAction(common);
  registerSearchUsersAction(common);
  registerLinkWorkItemsAction(common);
  registerListLinkTypesAction(common);
  registerListTransitionsAction(common);
  registerListFieldsAction(common);
  registerGetWorklogsAction(common);
  registerAddWorklogAction(common);
  registerAddWatcherAction({ ...common, catalog });
  registerRemoveWatcherAction({ ...common, catalog });
  registerListBoardsAction(common);
  registerListSprintsAction(common);
  registerMoveToSprintAction(common);
  registerListSprintWorkItemsAction(common);
  registerGetSprintInsightsAction(common);
  registerMoveToBacklogAction(common);
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

    it('adds and removes labels incrementally in a single request', async () => {
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
        input: {
          issueKey: 'PROJ-123',
          summary: 'New summary',
          addLabels: ['backend'],
          removeLabels: ['frontend'],
        },
      });

      expect(received).toEqual({
        fields: { summary: 'New summary' },
        update: { labels: [{ add: 'backend' }, { remove: 'frontend' }] },
      });
      expect(result).toEqual({
        output: {
          key: 'PROJ-123',
          url: 'https://example.atlassian.net/browse/PROJ-123',
        },
      });
    });

    it('rejects labels combined with addLabels or removeLabels before calling Jira', async () => {
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
          input: {
            issueKey: 'PROJ-123',
            labels: ['a'],
            addLabels: ['b'],
          },
        }),
      ).rejects.toThrow(/cannot be combined with "addLabels"/);
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

  describe('rename-work-item', () => {
    it('changes only the summary of an issue', async () => {
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
        id: 'test:rename-work-item',
        input: { issueKey: 'PROJ-123', summary: 'Better title' },
      });

      expect(received).toEqual({ fields: { summary: 'Better title' } });
      expect(result).toEqual({
        output: {
          key: 'PROJ-123',
          summary: 'Better title',
          url: 'https://example.atlassian.net/browse/PROJ-123',
        },
      });
    });

    it('fails with NotFound for an unknown issue', async () => {
      server.use(
        http.put(
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
          id: 'test:rename-work-item',
          input: { issueKey: 'PROJ-999', summary: 'x' },
        }),
      ).rejects.toThrow(/status 404.*Issue does not exist/);
    });
  });

  describe('set-work-item-parent', () => {
    it('changes only the parent of an issue', async () => {
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
        id: 'test:set-work-item-parent',
        input: { issueKey: 'PROJ-123', parentKey: 'PROJ-1' },
      });

      expect(received).toEqual({ fields: { parent: { key: 'PROJ-1' } } });
      expect(result).toEqual({
        output: {
          key: 'PROJ-123',
          parentKey: 'PROJ-1',
          url: 'https://example.atlassian.net/browse/PROJ-123',
        },
      });
    });

    it('propagates Jira errors for an invalid parent', async () => {
      server.use(
        http.put(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-123',
          () =>
            HttpResponse.json(
              { errors: { parent: 'The parent issue is not valid.' } },
              { status: 400 },
            ),
        ),
      );

      await expect(
        makeRegistry([cloudConnection]).invoke({
          id: 'test:set-work-item-parent',
          input: { issueKey: 'PROJ-123', parentKey: 'PROJ-999' },
        }),
      ).rejects.toThrow(/parent.*not valid/);
    });
  });

  describe('add-label and remove-label', () => {
    it('adds a single label and returns the resulting labels', async () => {
      let received: any;
      server.use(
        http.put(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-123',
          async ({ request }) => {
            received = await request.json();
            return new HttpResponse(null, { status: 204 });
          },
        ),
        http.get(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-123',
          () =>
            HttpResponse.json({
              key: 'PROJ-123',
              fields: { labels: ['backend', 'urgent'] },
            }),
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:add-label',
        input: { issueKey: 'PROJ-123', label: 'urgent' },
      });

      expect(received).toEqual({
        update: { labels: [{ add: 'urgent' }] },
      });
      expect(result).toEqual({
        output: {
          key: 'PROJ-123',
          url: 'https://example.atlassian.net/browse/PROJ-123',
          labels: ['backend', 'urgent'],
        },
      });
    });

    it('removes a single label and returns the resulting labels', async () => {
      let received: any;
      server.use(
        http.put(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-123',
          async ({ request }) => {
            received = await request.json();
            return new HttpResponse(null, { status: 204 });
          },
        ),
        http.get(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-123',
          () =>
            HttpResponse.json({
              key: 'PROJ-123',
              fields: { labels: ['backend'] },
            }),
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:remove-label',
        input: { issueKey: 'PROJ-123', label: 'urgent' },
      });

      expect(received).toEqual({
        update: { labels: [{ remove: 'urgent' }] },
      });
      expect(result).toEqual({
        output: {
          key: 'PROJ-123',
          url: 'https://example.atlassian.net/browse/PROJ-123',
          labels: ['backend'],
        },
      });
    });

    it('fails with NotFound for an unknown issue', async () => {
      server.use(
        http.put(
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
          id: 'test:add-label',
          input: { issueKey: 'PROJ-999', label: 'urgent' },
        }),
      ).rejects.toThrow(/status 404.*Issue does not exist/);
    });
  });

  describe('get-comments', () => {
    const adfBody = {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Looks good to me' }],
        },
      ],
    };

    it('reads comments with markdown bodies by default', async () => {
      server.use(
        http.get(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-123/comment',
          () =>
            HttpResponse.json({
              comments: [
                {
                  id: 10001,
                  author: { displayName: 'Jane Doe' },
                  body: adfBody,
                  created: '2026-08-01T10:00:00.000+0000',
                  updated: '2026-08-02T10:00:00.000+0000',
                },
              ],
            }),
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:get-comments',
        input: { issueKey: 'PROJ-123' },
      });

      expect(result).toEqual({
        output: {
          key: 'PROJ-123',
          url: 'https://example.atlassian.net/browse/PROJ-123',
          comments: [
            {
              id: '10001',
              author: 'Jane Doe',
              body: 'Looks good to me',
              created: '2026-08-01T10:00:00.000+0000',
              updated: '2026-08-02T10:00:00.000+0000',
            },
          ],
        },
      });
    });

    it('returns the raw adf document on request', async () => {
      server.use(
        http.get(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-123/comment',
          () => HttpResponse.json({ comments: [{ id: 1, body: adfBody }] }),
        ),
      );

      const result: any = await makeRegistry([cloudConnection]).invoke({
        id: 'test:get-comments',
        input: { issueKey: 'PROJ-123', bodyFormat: 'adf' },
      });

      expect(result.output.comments).toEqual([{ id: '1', body: adfBody }]);
    });

    it('fails with NotFound for an unknown issue', async () => {
      server.use(
        http.get(
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
          id: 'test:get-comments',
          input: { issueKey: 'PROJ-999' },
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
        output: {
          projects: [
            {
              id: '10000',
              key: 'PROJ',
              name: 'Project',
              url: 'https://example.atlassian.net/browse/PROJ',
            },
          ],
        },
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
        output: {
          projects: [
            {
              id: '1',
              key: 'OPS',
              name: 'Operations',
              url: 'https://jira.example.com/browse/OPS',
            },
          ],
        },
      });
    });

    it('filters projects by name and returns descriptions', async () => {
      let query: URLSearchParams | undefined;
      server.use(
        http.get(
          'https://example.atlassian.net/rest/api/3/project/search',
          ({ request }) => {
            query = new URL(request.url).searchParams;
            return HttpResponse.json({
              values: [
                {
                  id: 10000,
                  key: 'PLAT',
                  name: 'Platform',
                  description: 'The platform project',
                },
                { id: 10001, key: 'OTHER', name: 'Other' },
              ],
            });
          },
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:list-projects',
        input: { name: 'plat' },
      });

      expect(query?.get('query')).toBe('plat');
      expect(query?.get('expand')).toBe('description');
      expect(result).toEqual({
        output: {
          projects: [
            {
              id: '10000',
              key: 'PLAT',
              name: 'Platform',
              description: 'The platform project',
              url: 'https://example.atlassian.net/browse/PLAT',
            },
          ],
        },
      });
    });

    it('filters projects client-side on datacenter', async () => {
      server.use(
        http.get('https://jira.example.com/rest/api/2/project', () =>
          HttpResponse.json([
            { id: '1', key: 'OPS', name: 'Operations' },
            { id: '2', key: 'PLAT', name: 'Platform' },
          ]),
        ),
      );

      const result = await makeRegistry([datacenterConnection]).invoke({
        id: 'test:list-projects',
        input: { name: 'plat' },
      });

      expect(result).toEqual({
        output: {
          projects: [
            {
              id: '2',
              key: 'PLAT',
              name: 'Platform',
              url: 'https://jira.example.com/browse/PLAT',
            },
          ],
        },
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

  describe('search-users', () => {
    it('finds users and returns assignable ids', async () => {
      server.use(
        http.get('https://example.atlassian.net/rest/api/3/user/search', () =>
          HttpResponse.json([
            {
              accountId: 'acc-1',
              displayName: 'Jane Doe',
              emailAddress: 'jane@example.com',
              active: true,
            },
          ]),
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:search-users',
        input: { query: 'jane' },
      });

      expect(result).toEqual({
        output: {
          users: [
            {
              id: 'acc-1',
              displayName: 'Jane Doe',
              email: 'jane@example.com',
              active: true,
            },
          ],
        },
      });
    });

    it('returns an empty array when nothing matches', async () => {
      server.use(
        http.get('https://example.atlassian.net/rest/api/3/user/search', () =>
          HttpResponse.json([]),
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:search-users',
        input: { query: 'nobody' },
      });

      expect(result).toEqual({ output: { users: [] } });
    });
  });

  describe('list-transitions', () => {
    it('lists the currently available transitions', async () => {
      server.use(
        http.get(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-1/transitions',
          () =>
            HttpResponse.json({
              transitions: [
                { id: 11, name: 'Start', to: { name: 'In Progress' } },
                { id: 21, name: 'Finish', to: { name: 'Done' } },
              ],
            }),
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:list-transitions',
        input: { issueKey: 'PROJ-1' },
      });

      expect(result).toEqual({
        output: {
          key: 'PROJ-1',
          transitions: [
            { id: '11', name: 'Start', toStatus: 'In Progress' },
            { id: '21', name: 'Finish', toStatus: 'Done' },
          ],
        },
      });
    });

    it('fails with NotFound for an unknown issue', async () => {
      server.use(
        http.get(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-999/transitions',
          () =>
            HttpResponse.json(
              { errorMessages: ['Issue does not exist'] },
              { status: 404 },
            ),
        ),
      );

      await expect(
        makeRegistry([cloudConnection]).invoke({
          id: 'test:list-transitions',
          input: { issueKey: 'PROJ-999' },
        }),
      ).rejects.toThrow(/status 404.*Issue does not exist/);
    });
  });

  describe('issue links', () => {
    const linkTypes = {
      issueLinkTypes: [
        { id: '1', name: 'Blocks', inward: 'is blocked by', outward: 'blocks' },
      ],
    };

    it('lists link types', async () => {
      server.use(
        http.get('https://example.atlassian.net/rest/api/3/issueLinkType', () =>
          HttpResponse.json(linkTypes),
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:list-link-types',
        input: {},
      });

      expect(result).toEqual({
        output: {
          linkTypes: [
            {
              id: '1',
              name: 'Blocks',
              inward: 'is blocked by',
              outward: 'blocks',
            },
          ],
        },
      });
    });

    it('links two issues by type name', async () => {
      let received: any;
      server.use(
        http.get('https://example.atlassian.net/rest/api/3/issueLinkType', () =>
          HttpResponse.json(linkTypes),
        ),
        http.post(
          'https://example.atlassian.net/rest/api/3/issueLink',
          async ({ request }) => {
            received = await request.json();
            return new HttpResponse(null, { status: 201 });
          },
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:link-work-items',
        input: { issueKey: 'PROJ-1', targetKey: 'PROJ-2', linkType: 'Blocks' },
      });

      expect(received).toEqual({
        type: { name: 'Blocks' },
        outwardIssue: { key: 'PROJ-1' },
        inwardIssue: { key: 'PROJ-2' },
      });
      expect(result).toEqual({
        output: {
          key: 'PROJ-1',
          targetKey: 'PROJ-2',
          linkType: 'Blocks',
          url: 'https://example.atlassian.net/browse/PROJ-1',
        },
      });
    });

    it('reverses the direction for an inward description', async () => {
      let received: any;
      server.use(
        http.get('https://example.atlassian.net/rest/api/3/issueLinkType', () =>
          HttpResponse.json(linkTypes),
        ),
        http.post(
          'https://example.atlassian.net/rest/api/3/issueLink',
          async ({ request }) => {
            received = await request.json();
            return new HttpResponse(null, { status: 201 });
          },
        ),
      );

      await makeRegistry([cloudConnection]).invoke({
        id: 'test:link-work-items',
        input: {
          issueKey: 'PROJ-1',
          targetKey: 'PROJ-2',
          linkType: 'is blocked by',
        },
      });

      expect(received).toEqual({
        type: { name: 'Blocks' },
        outwardIssue: { key: 'PROJ-2' },
        inwardIssue: { key: 'PROJ-1' },
      });
    });

    it('rejects an unknown link type listing the available ones', async () => {
      server.use(
        http.get('https://example.atlassian.net/rest/api/3/issueLinkType', () =>
          HttpResponse.json(linkTypes),
        ),
      );

      await expect(
        makeRegistry([cloudConnection]).invoke({
          id: 'test:link-work-items',
          input: { issueKey: 'PROJ-1', targetKey: 'PROJ-2', linkType: 'nope' },
        }),
      ).rejects.toThrow(/Unknown Jira issue link type "nope".*Blocks/);
    });

    it('propagates Jira errors for unknown issues', async () => {
      server.use(
        http.get('https://example.atlassian.net/rest/api/3/issueLinkType', () =>
          HttpResponse.json(linkTypes),
        ),
        http.post('https://example.atlassian.net/rest/api/3/issueLink', () =>
          HttpResponse.json(
            { errorMessages: ['Issue does not exist'] },
            { status: 404 },
          ),
        ),
      );

      await expect(
        makeRegistry([cloudConnection]).invoke({
          id: 'test:link-work-items',
          input: {
            issueKey: 'PROJ-1',
            targetKey: 'PROJ-999',
            linkType: 'Blocks',
          },
        }),
      ).rejects.toThrow(/status 404.*Issue does not exist/);
    });
  });

  describe('list-fields', () => {
    it('lists fields and filters by name', async () => {
      server.use(
        http.get('https://example.atlassian.net/rest/api/3/field', () =>
          HttpResponse.json([
            {
              id: 'customfield_10020',
              name: 'Story Points',
              custom: true,
              schema: { type: 'number' },
            },
            { id: 'summary', name: 'Summary', custom: false },
          ]),
        ),
      );

      const registry = makeRegistry([cloudConnection]);
      const all: any = await registry.invoke({
        id: 'test:list-fields',
        input: {},
      });
      expect(all.output.fields).toHaveLength(2);

      const filtered = await registry.invoke({
        id: 'test:list-fields',
        input: { name: 'story' },
      });
      expect(filtered).toEqual({
        output: {
          fields: [
            {
              id: 'customfield_10020',
              name: 'Story Points',
              custom: true,
              type: 'number',
            },
          ],
        },
      });
    });
  });

  describe('worklogs', () => {
    const adfComment = {
      type: 'doc',
      version: 1,
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'pairing' }] },
      ],
    };

    it('reads worklogs with markdown comments by default', async () => {
      server.use(
        http.get(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-1/worklog',
          () =>
            HttpResponse.json({
              worklogs: [
                {
                  id: 100,
                  author: { displayName: 'Jane Doe' },
                  timeSpent: '2h',
                  timeSpentSeconds: 7200,
                  started: '2026-08-01T09:00:00.000+0000',
                  comment: adfComment,
                },
              ],
            }),
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:get-worklogs',
        input: { issueKey: 'PROJ-1' },
      });

      expect(result).toEqual({
        output: {
          key: 'PROJ-1',
          url: 'https://example.atlassian.net/browse/PROJ-1',
          worklogs: [
            {
              id: '100',
              author: 'Jane Doe',
              timeSpent: '2h',
              timeSpentSeconds: 7200,
              started: '2026-08-01T09:00:00.000+0000',
              comment: 'pairing',
            },
          ],
        },
      });
    });

    it('logs time with a markdown comment', async () => {
      let received: any;
      server.use(
        http.post(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-1/worklog',
          async ({ request }) => {
            received = await request.json();
            return HttpResponse.json({ id: 101 }, { status: 201 });
          },
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:add-worklog',
        input: { issueKey: 'PROJ-1', timeSpent: '2h 30m', comment: 'pairing' },
      });

      expect(received.timeSpent).toBe('2h 30m');
      expect(received.comment.type).toBe('doc');
      expect(result).toEqual({
        output: {
          key: 'PROJ-1',
          worklogId: '101',
          url: 'https://example.atlassian.net/browse/PROJ-1',
        },
      });
    });

    it('propagates an invalid duration error', async () => {
      server.use(
        http.post(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-1/worklog',
          () =>
            HttpResponse.json(
              { errors: { timeLogged: 'Invalid time duration entered' } },
              { status: 400 },
            ),
        ),
      );

      await expect(
        makeRegistry([cloudConnection]).invoke({
          id: 'test:add-worklog',
          input: { issueKey: 'PROJ-1', timeSpent: 'nonsense' },
        }),
      ).rejects.toThrow(/Invalid time duration/);
    });

    it('fails with NotFound for an unknown issue', async () => {
      server.use(
        http.get(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-999/worklog',
          () =>
            HttpResponse.json(
              { errorMessages: ['Issue does not exist'] },
              { status: 404 },
            ),
        ),
      );

      await expect(
        makeRegistry([cloudConnection]).invoke({
          id: 'test:get-worklogs',
          input: { issueKey: 'PROJ-999' },
        }),
      ).rejects.toThrow(/status 404.*Issue does not exist/);
    });
  });

  describe('watchers', () => {
    it('adds a watcher on cloud', async () => {
      let rawBody: string | undefined;
      server.use(
        http.post(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-1/watchers',
          async ({ request }) => {
            rawBody = await request.text();
            return new HttpResponse(null, { status: 204 });
          },
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:add-watcher',
        input: { issueKey: 'PROJ-1', user: 'acc-1' },
      });

      expect(rawBody).toBe('"acc-1"');
      expect(result).toEqual({
        output: {
          key: 'PROJ-1',
          url: 'https://example.atlassian.net/browse/PROJ-1',
        },
      });
    });

    it('removes a watcher on datacenter via username', async () => {
      let params: URLSearchParams | undefined;
      server.use(
        http.delete(
          'https://jira.example.com/rest/api/2/issue/OPS-1/watchers',
          ({ request }) => {
            params = new URL(request.url).searchParams;
            return new HttpResponse(null, { status: 204 });
          },
        ),
      );

      const result = await makeRegistry([datacenterConnection]).invoke({
        id: 'test:remove-watcher',
        input: { issueKey: 'OPS-1', user: 'jdoe' },
      });

      expect(params?.get('username')).toBe('jdoe');
      expect(result).toEqual({
        output: { key: 'OPS-1', url: 'https://jira.example.com/browse/OPS-1' },
      });
    });

    it('fails with NotFound for an unknown issue', async () => {
      server.use(
        http.post(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-999/watchers',
          () =>
            HttpResponse.json(
              { errorMessages: ['Issue does not exist'] },
              { status: 404 },
            ),
        ),
      );

      await expect(
        makeRegistry([cloudConnection]).invoke({
          id: 'test:add-watcher',
          input: { issueKey: 'PROJ-999', user: 'acc-1' },
        }),
      ).rejects.toThrow(/status 404.*Issue does not exist/);
    });
  });

  describe('agile actions', () => {
    it('lists boards filtered by project', async () => {
      let params: URLSearchParams | undefined;
      server.use(
        http.get(
          'https://example.atlassian.net/rest/agile/1.0/board',
          ({ request }) => {
            params = new URL(request.url).searchParams;
            return HttpResponse.json({
              values: [{ id: 7, name: 'Platform board', type: 'scrum' }],
            });
          },
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:list-boards',
        input: { projectKey: 'PROJ' },
      });

      expect(params?.get('projectKeyOrId')).toBe('PROJ');
      expect(result).toEqual({
        output: {
          boards: [{ id: '7', name: 'Platform board', type: 'scrum' }],
        },
      });
    });

    it('lists active sprints of a board', async () => {
      let params: URLSearchParams | undefined;
      server.use(
        http.get(
          'https://example.atlassian.net/rest/agile/1.0/board/7/sprint',
          ({ request }) => {
            params = new URL(request.url).searchParams;
            return HttpResponse.json({
              values: [{ id: 42, name: 'Sprint 12', state: 'active' }],
            });
          },
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:list-sprints',
        input: { boardId: '7', state: 'active' },
      });

      expect(params?.get('state')).toBe('active');
      expect(result).toEqual({
        output: {
          sprints: [{ id: '42', name: 'Sprint 12', state: 'active' }],
        },
      });
    });

    it('fails with NotFound for an unknown board', async () => {
      server.use(
        http.get(
          'https://example.atlassian.net/rest/agile/1.0/board/99/sprint',
          () =>
            HttpResponse.json(
              { errorMessages: ['Board does not exist'] },
              { status: 404 },
            ),
        ),
      );

      await expect(
        makeRegistry([cloudConnection]).invoke({
          id: 'test:list-sprints',
          input: { boardId: '99' },
        }),
      ).rejects.toThrow(/board 99.*status 404/);
    });

    it('moves issues into a sprint', async () => {
      let received: any;
      server.use(
        http.post(
          'https://example.atlassian.net/rest/agile/1.0/sprint/42/issue',
          async ({ request }) => {
            received = await request.json();
            return new HttpResponse(null, { status: 204 });
          },
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:move-to-sprint',
        input: { sprintId: '42', issueKeys: ['PROJ-1', 'PROJ-2'] },
      });

      expect(received).toEqual({ issues: ['PROJ-1', 'PROJ-2'] });
      expect(result).toEqual({
        output: { sprintId: '42', issueKeys: ['PROJ-1', 'PROJ-2'] },
      });
    });

    it('fails with NotFound for an unknown sprint', async () => {
      server.use(
        http.post(
          'https://example.atlassian.net/rest/agile/1.0/sprint/99/issue',
          () =>
            HttpResponse.json(
              { errorMessages: ['Sprint does not exist'] },
              { status: 404 },
            ),
        ),
      );

      await expect(
        makeRegistry([cloudConnection]).invoke({
          id: 'test:move-to-sprint',
          input: { sprintId: '99', issueKeys: ['PROJ-1'] },
        }),
      ).rejects.toThrow(/sprint 99.*status 404/);
    });
  });

  describe('delete-work-item', () => {
    it('deletes an issue', async () => {
      let params: URLSearchParams | undefined;
      server.use(
        http.delete(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-1',
          ({ request }) => {
            params = new URL(request.url).searchParams;
            return new HttpResponse(null, { status: 204 });
          },
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:delete-work-item',
        input: { issueKey: 'PROJ-1' },
      });

      expect(params?.get('deleteSubtasks')).toBe('false');
      expect(result).toEqual({ output: { key: 'PROJ-1' } });
    });

    it('propagates a sub-task rejection', async () => {
      server.use(
        http.delete(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-1',
          () =>
            HttpResponse.json(
              { errorMessages: ['The issue has sub-tasks'] },
              { status: 400 },
            ),
        ),
      );

      await expect(
        makeRegistry([cloudConnection]).invoke({
          id: 'test:delete-work-item',
          input: { issueKey: 'PROJ-1' },
        }),
      ).rejects.toThrow(/sub-tasks/);
    });

    it('fails with NotFound for an unknown issue', async () => {
      server.use(
        http.delete(
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
          id: 'test:delete-work-item',
          input: { issueKey: 'PROJ-999' },
        }),
      ).rejects.toThrow(/status 404.*Issue does not exist/);
    });
  });

  describe('custom fields', () => {
    it('creates with custom fields passed verbatim', async () => {
      let received: any;
      server.use(
        http.post(
          'https://example.atlassian.net/rest/api/3/issue',
          async ({ request }) => {
            received = await request.json();
            return HttpResponse.json(
              { id: '1', key: 'PROJ-1' },
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
          summary: 'x',
          customFields: { customfield_10020: 5 },
        },
      });

      expect(received.fields.customfield_10020).toBe(5);
    });

    it('accepts an update with only custom fields', async () => {
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

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:update-work-item',
        input: {
          issueKey: 'PROJ-1',
          customFields: { customfield_10020: 8 },
        },
      });

      expect(received).toEqual({ fields: { customfield_10020: 8 } });
      expect(result).toEqual({
        output: {
          key: 'PROJ-1',
          url: 'https://example.atlassian.net/browse/PROJ-1',
        },
      });
    });

    it('reads selected custom fields and links on get-work-item', async () => {
      server.use(
        http.get('https://example.atlassian.net/rest/api/3/issue/PROJ-1', () =>
          HttpResponse.json({
            key: 'PROJ-1',
            fields: {
              summary: 'x',
              status: { name: 'To Do' },
              issuetype: { name: 'Story' },
              customfield_10020: 5,
              issuelinks: [
                {
                  type: {
                    name: 'Blocks',
                    inward: 'is blocked by',
                    outward: 'blocks',
                  },
                  outwardIssue: { key: 'PROJ-2' },
                },
              ],
            },
          }),
        ),
      );

      const result: any = await makeRegistry([cloudConnection]).invoke({
        id: 'test:get-work-item',
        input: { issueKey: 'PROJ-1', customFields: ['customfield_10020'] },
      });

      expect(result.output.customFields).toEqual({ customfield_10020: 5 });
      expect(result.output.links).toEqual([
        { type: 'Blocks', direction: 'blocks', key: 'PROJ-2' },
      ]);
    });
  });

  describe('pagination', () => {
    it('pages search results with tokens', async () => {
      let received: any;
      server.use(
        http.post(
          'https://example.atlassian.net/rest/api/3/search/jql',
          async ({ request }) => {
            received = await request.json();
            return HttpResponse.json({
              issues: [{ key: 'PROJ-2', fields: { summary: 'second' } }],
              nextPageToken: 'token-2',
            });
          },
        ),
      );

      const result: any = await makeRegistry([cloudConnection]).invoke({
        id: 'test:search-work-items',
        input: { projectKey: 'PROJ', pageToken: 'token-1' },
      });

      expect(received.nextPageToken).toBe('token-1');
      expect(result.output.nextPageToken).toBe('token-2');
    });

    it('pages comments and omits the token on the last page', async () => {
      server.use(
        http.get(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-1/comment',
          ({ request }) => {
            const startAt = Number(
              new URL(request.url).searchParams.get('startAt'),
            );
            return HttpResponse.json({
              comments: [{ id: startAt + 1, body: 'c' }],
              total: 2,
            });
          },
        ),
      );

      const registry = makeRegistry([cloudConnection]);
      const first: any = await registry.invoke({
        id: 'test:get-comments',
        input: { issueKey: 'PROJ-1', maxResults: 1 },
      });
      expect(first.output.nextPageToken).toBe('1');

      const second: any = await registry.invoke({
        id: 'test:get-comments',
        input: {
          issueKey: 'PROJ-1',
          maxResults: 1,
          pageToken: first.output.nextPageToken,
        },
      });
      expect(second.output.comments[0].id).toBe('2');
      expect(second.output.nextPageToken).toBeUndefined();
    });

    it('rejects an invalid page token on offset-based paging', async () => {
      await expect(
        makeRegistry([cloudConnection]).invoke({
          id: 'test:get-comments',
          input: { issueKey: 'PROJ-1', pageToken: 'garbage' },
        }),
      ).rejects.toThrow(/Invalid pageToken "garbage"/);
    });
  });

  describe('versions and components', () => {
    it('lists versions of a project', async () => {
      server.use(
        http.get(
          'https://example.atlassian.net/rest/api/3/project/PROJ/versions',
          () =>
            HttpResponse.json([
              { id: 10, name: '1.2.0', released: false, archived: false },
            ]),
        ),
      );

      const result: any = await makeRegistry([cloudConnection]).invoke({
        id: 'test:list-versions',
        input: { projectKey: 'PROJ' },
      });

      expect(result.output.versions).toEqual([
        { id: '10', name: '1.2.0', released: false, archived: false },
      ]);
    });

    it('lists versions via entity ref', async () => {
      server.use(
        http.get(
          'https://example.atlassian.net/rest/api/3/project/PROJ/versions',
          () => HttpResponse.json([{ id: 10, name: '1.2.0' }]),
        ),
      );

      const result: any = await makeRegistry(
        [cloudConnection],
        [componentEntity('my-service', { 'jira/project-key': 'PROJ' })],
      ).invoke({
        id: 'test:list-versions',
        input: { entityRef: 'component:default/my-service' },
      });

      expect(result.output.versions[0].name).toBe('1.2.0');
    });

    it('lists components of a project', async () => {
      server.use(
        http.get(
          'https://example.atlassian.net/rest/api/3/project/PROJ/components',
          () =>
            HttpResponse.json([
              { id: 1, name: 'backend', lead: { displayName: 'Jane Doe' } },
            ]),
        ),
      );

      const result: any = await makeRegistry([cloudConnection]).invoke({
        id: 'test:list-components',
        input: { projectKey: 'PROJ' },
      });

      expect(result.output.components).toEqual([
        { id: '1', name: 'backend', lead: 'Jane Doe' },
      ]);
    });

    it('fails with NotFound for an unknown project', async () => {
      server.use(
        http.get(
          'https://example.atlassian.net/rest/api/3/project/NOPE/versions',
          () =>
            HttpResponse.json(
              { errorMessages: ['No project could be found'] },
              { status: 404 },
            ),
        ),
      );

      await expect(
        makeRegistry([cloudConnection]).invoke({
          id: 'test:list-versions',
          input: { projectKey: 'NOPE' },
        }),
      ).rejects.toThrow(/NOPE.*status 404/);
    });

    it('creates a version', async () => {
      server.use(
        http.get('https://example.atlassian.net/rest/api/3/project/PROJ', () =>
          HttpResponse.json({ id: '10000', key: 'PROJ' }),
        ),
        http.post('https://example.atlassian.net/rest/api/3/version', () =>
          HttpResponse.json({ id: 42, name: '1.2.0' }, { status: 201 }),
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:create-version',
        input: { projectKey: 'PROJ', name: '1.2.0' },
      });

      expect(result).toEqual({ output: { id: '42', name: '1.2.0' } });
    });

    it('propagates a duplicate version error', async () => {
      server.use(
        http.get('https://example.atlassian.net/rest/api/3/project/PROJ', () =>
          HttpResponse.json({ id: '10000', key: 'PROJ' }),
        ),
        http.post('https://example.atlassian.net/rest/api/3/version', () =>
          HttpResponse.json(
            { errors: { name: 'A version with this name already exists' } },
            { status: 400 },
          ),
        ),
      );

      await expect(
        makeRegistry([cloudConnection]).invoke({
          id: 'test:create-version',
          input: { projectKey: 'PROJ', name: '1.2.0' },
        }),
      ).rejects.toThrow(/already exists/);
    });

    it('updates versions and components as name references', async () => {
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
          fixVersions: ['1.2.0'],
          components: ['backend'],
        },
      });

      expect(received).toEqual({
        fields: {
          fixVersions: [{ name: '1.2.0' }],
          components: [{ name: 'backend' }],
        },
      });
    });

    it('reads versions and components on get-work-item', async () => {
      server.use(
        http.get('https://example.atlassian.net/rest/api/3/issue/PROJ-1', () =>
          HttpResponse.json({
            key: 'PROJ-1',
            fields: {
              summary: 'x',
              status: { name: 'To Do' },
              issuetype: { name: 'Story' },
              fixVersions: [{ name: '1.2.0' }],
              versions: [{ name: '1.1.0' }],
              components: [{ name: 'backend' }],
            },
          }),
        ),
      );

      const result: any = await makeRegistry([cloudConnection]).invoke({
        id: 'test:get-work-item',
        input: { issueKey: 'PROJ-1' },
      });

      expect(result.output.fixVersions).toEqual(['1.2.0']);
      expect(result.output.affectsVersions).toEqual(['1.1.0']);
      expect(result.output.components).toEqual(['backend']);
    });
  });

  describe('assignee conveniences', () => {
    const mockUser: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'User',
      metadata: { name: 'mock', namespace: 'default' },
      spec: { profile: { email: 'jane@example.com' } },
    };

    it('resolves "me" to the caller for updates', async () => {
      let received: any;
      server.use(
        http.get(
          'https://example.atlassian.net/rest/api/3/user/search',
          ({ request }) => {
            const query = new URL(request.url).searchParams.get('query');
            expect(query).toBe('jane@example.com');
            return HttpResponse.json([
              {
                accountId: 'acc-jane',
                displayName: 'Jane Doe',
                emailAddress: 'jane@example.com',
                active: true,
              },
            ]);
          },
        ),
        http.put(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-1',
          async ({ request }) => {
            received = await request.json();
            return new HttpResponse(null, { status: 204 });
          },
        ),
      );

      await makeRegistry([cloudConnection], [mockUser]).invoke({
        id: 'test:update-work-item',
        input: { issueKey: 'PROJ-1', assignee: 'me' },
        credentials: mockCredentials.user(),
      });

      expect(received).toEqual({ fields: { assignee: { id: 'acc-jane' } } });
    });

    it('watches as the invoking user', async () => {
      let rawBody: string | undefined;
      server.use(
        http.get('https://example.atlassian.net/rest/api/3/user/search', () =>
          HttpResponse.json([
            { accountId: 'acc-jane', emailAddress: 'jane@example.com' },
          ]),
        ),
        http.post(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-1/watchers',
          async ({ request }) => {
            rawBody = await request.text();
            return new HttpResponse(null, { status: 204 });
          },
        ),
      );

      await makeRegistry([cloudConnection], [mockUser]).invoke({
        id: 'test:add-watcher',
        input: { issueKey: 'PROJ-1', user: 'me' },
        credentials: mockCredentials.user(),
      });

      expect(rawBody).toBe('"acc-jane"');
    });

    it('fails when no Jira user matches the email', async () => {
      let written = false;
      server.use(
        http.get('https://example.atlassian.net/rest/api/3/user/search', () =>
          HttpResponse.json([]),
        ),
        http.put(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-1',
          () => {
            written = true;
            return new HttpResponse(null, { status: 204 });
          },
        ),
      );

      await expect(
        makeRegistry([cloudConnection], [mockUser]).invoke({
          id: 'test:update-work-item',
          input: { issueKey: 'PROJ-1', assignee: 'me' },
          credentials: mockCredentials.user(),
        }),
      ).rejects.toThrow(/jane@example.com.*cannot be resolved/);
      expect(written).toBe(false);
    });

    it('rejects "me" for a non-user caller', async () => {
      await expect(
        makeRegistry([cloudConnection], [mockUser]).invoke({
          id: 'test:update-work-item',
          input: { issueKey: 'PROJ-1', assignee: 'me' },
          credentials: mockCredentials.service(),
        }),
      ).rejects.toThrow(/requires a user caller/);
    });

    it('unassigns an issue with an explicit null', async () => {
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
        input: { issueKey: 'PROJ-1', unassign: true },
      });

      expect(received).toEqual({ fields: { assignee: null } });
    });

    it('rejects assignee combined with unassign', async () => {
      await expect(
        makeRegistry([cloudConnection]).invoke({
          id: 'test:update-work-item',
          input: { issueKey: 'PROJ-1', assignee: 'acc-1', unassign: true },
        }),
      ).rejects.toThrow(/cannot be combined with "unassign"/);
    });
  });

  describe('remote links', () => {
    it('attaches a titled web link to an issue', async () => {
      let received: any;
      server.use(
        http.post(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-1/remotelink',
          async ({ request }) => {
            received = await request.json();
            return HttpResponse.json({ id: 10000 }, { status: 201 });
          },
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:add-remote-link',
        input: {
          issueKey: 'PROJ-1',
          url: 'https://backstage.example.com/catalog/default/component/my-service',
          title: 'Backstage: my-service',
        },
      });

      expect(received).toEqual({
        object: {
          url: 'https://backstage.example.com/catalog/default/component/my-service',
          title: 'Backstage: my-service',
        },
      });
      expect(result).toEqual({
        output: {
          key: 'PROJ-1',
          remoteLinkId: '10000',
          url: 'https://example.atlassian.net/browse/PROJ-1',
        },
      });
    });

    it('reads the remote links of an issue', async () => {
      server.use(
        http.get(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-1/remotelink',
          () =>
            HttpResponse.json([
              {
                id: 10000,
                object: { url: 'https://pr.example.com/42', title: 'PR #42' },
              },
            ]),
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:get-remote-links',
        input: { issueKey: 'PROJ-1' },
      });

      expect(result).toEqual({
        output: {
          key: 'PROJ-1',
          url: 'https://example.atlassian.net/browse/PROJ-1',
          remoteLinks: [
            { id: '10000', title: 'PR #42', url: 'https://pr.example.com/42' },
          ],
        },
      });
    });

    it('fails with NotFound for an unknown issue', async () => {
      server.use(
        http.post(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-999/remotelink',
          () =>
            HttpResponse.json(
              { errorMessages: ['Issue does not exist'] },
              { status: 404 },
            ),
        ),
      );

      await expect(
        makeRegistry([cloudConnection]).invoke({
          id: 'test:add-remote-link',
          input: { issueKey: 'PROJ-999', url: 'https://x', title: 'x' },
        }),
      ).rejects.toThrow(/status 404.*Issue does not exist/);
    });
  });

  describe('comment editing', () => {
    it('updates a comment with a markdown body', async () => {
      let received: any;
      server.use(
        http.put(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-1/comment/10',
          async ({ request }) => {
            received = await request.json();
            return HttpResponse.json({ id: 10 });
          },
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:update-comment',
        input: { issueKey: 'PROJ-1', commentId: '10', body: 'Corrected' },
      });

      expect(received.body.type).toBe('doc');
      expect(result).toEqual({
        output: {
          key: 'PROJ-1',
          commentId: '10',
          url: 'https://example.atlassian.net/browse/PROJ-1',
        },
      });
    });

    it('deletes a comment', async () => {
      let deleted = false;
      server.use(
        http.delete(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-1/comment/10',
          () => {
            deleted = true;
            return new HttpResponse(null, { status: 204 });
          },
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:delete-comment',
        input: { issueKey: 'PROJ-1', commentId: '10' },
      });

      expect(deleted).toBe(true);
      expect(result).toEqual({
        output: { key: 'PROJ-1', commentId: '10' },
      });
    });

    it('fails with NotFound for an unknown comment', async () => {
      server.use(
        http.put(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-1/comment/99',
          () =>
            HttpResponse.json(
              { errorMessages: ['Comment does not exist'] },
              { status: 404 },
            ),
        ),
      );

      await expect(
        makeRegistry([cloudConnection]).invoke({
          id: 'test:update-comment',
          input: { issueKey: 'PROJ-1', commentId: '99', body: 'x' },
        }),
      ).rejects.toThrow(/comment 99.*status 404/);
    });
  });

  describe('sprint views and insights', () => {
    const sprintIssue = (
      key: string,
      status: string,
      category: string,
      type: string,
      assignee?: string,
    ) => ({
      key,
      fields: {
        summary: `Issue ${key}`,
        status: { name: status, statusCategory: { key: category } },
        issuetype: { name: type },
        ...(assignee
          ? {
              assignee: { accountId: `acc-${assignee}`, displayName: assignee },
            }
          : {}),
      },
    });

    it('lists the work items of a sprint with paging', async () => {
      let params: URLSearchParams | undefined;
      server.use(
        http.get(
          'https://example.atlassian.net/rest/agile/1.0/sprint/42/issue',
          ({ request }) => {
            params = new URL(request.url).searchParams;
            return HttpResponse.json({
              issues: [sprintIssue('PROJ-1', 'To Do', 'new', 'Story', 'Jane')],
              total: 2,
            });
          },
        ),
      );

      const result: any = await makeRegistry([cloudConnection]).invoke({
        id: 'test:list-sprint-work-items',
        input: { sprintId: '42', maxResults: 1 },
      });

      expect(params?.get('startAt')).toBe('0');
      expect(result.output.items).toEqual([
        {
          key: 'PROJ-1',
          summary: 'Issue PROJ-1',
          status: 'To Do',
          issueType: 'Story',
          url: 'https://example.atlassian.net/browse/PROJ-1',
          assignee: 'acc-Jane',
        },
      ]);
      expect(result.output.nextPageToken).toBe('1');
    });

    it('fails with NotFound for an unknown sprint', async () => {
      server.use(
        http.get(
          'https://example.atlassian.net/rest/agile/1.0/sprint/99/issue',
          () =>
            HttpResponse.json(
              { errorMessages: ['Sprint does not exist'] },
              { status: 404 },
            ),
        ),
      );

      await expect(
        makeRegistry([cloudConnection]).invoke({
          id: 'test:list-sprint-work-items',
          input: { sprintId: '99' },
        }),
      ).rejects.toThrow(/sprint 99.*status 404/);
    });

    it('moves issues to the backlog', async () => {
      let received: any;
      server.use(
        http.post(
          'https://example.atlassian.net/rest/agile/1.0/backlog/issue',
          async ({ request }) => {
            received = await request.json();
            return new HttpResponse(null, { status: 204 });
          },
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:move-to-backlog',
        input: { issueKeys: ['PROJ-1', 'PROJ-2'] },
      });

      expect(received).toEqual({ issues: ['PROJ-1', 'PROJ-2'] });
      expect(result).toEqual({ output: { issueKeys: ['PROJ-1', 'PROJ-2'] } });
    });

    it('summarizes a sprint', async () => {
      server.use(
        http.get('https://example.atlassian.net/rest/agile/1.0/sprint/42', () =>
          HttpResponse.json({
            id: 42,
            name: 'Sprint 12',
            state: 'active',
            goal: 'Ship it',
          }),
        ),
        http.get(
          'https://example.atlassian.net/rest/agile/1.0/sprint/42/issue',
          () =>
            HttpResponse.json({
              issues: [
                sprintIssue('PROJ-1', 'Done', 'done', 'Story', 'Jane'),
                sprintIssue('PROJ-2', 'Done', 'done', 'Bug', 'Jane'),
                sprintIssue('PROJ-3', 'In Progress', 'indeterminate', 'Story'),
              ],
              total: 3,
            }),
        ),
      );

      const result = await makeRegistry([cloudConnection]).invoke({
        id: 'test:get-sprint-insights',
        input: { sprintId: '42' },
      });

      expect(result).toEqual({
        output: {
          sprint: {
            id: '42',
            name: 'Sprint 12',
            state: 'active',
            goal: 'Ship it',
          },
          totalItems: 3,
          completedItems: 2,
          byStatus: [
            { name: 'Done', count: 2 },
            { name: 'In Progress', count: 1 },
          ],
          byIssueType: [
            { name: 'Story', count: 2 },
            { name: 'Bug', count: 1 },
          ],
          byAssignee: [
            { name: 'Jane', count: 2 },
            { name: 'Unassigned', count: 1 },
          ],
        },
      });
    });

    it('summarizes an empty sprint', async () => {
      server.use(
        http.get('https://example.atlassian.net/rest/agile/1.0/sprint/42', () =>
          HttpResponse.json({ id: 42, name: 'Sprint 12' }),
        ),
        http.get(
          'https://example.atlassian.net/rest/agile/1.0/sprint/42/issue',
          () => HttpResponse.json({ issues: [], total: 0 }),
        ),
      );

      const result: any = await makeRegistry([cloudConnection]).invoke({
        id: 'test:get-sprint-insights',
        input: { sprintId: '42' },
      });

      expect(result.output.totalItems).toBe(0);
      expect(result.output.completedItems).toBe(0);
      expect(result.output.byStatus).toEqual([]);
    });

    it('fails with NotFound for insights on an unknown sprint', async () => {
      server.use(
        http.get('https://example.atlassian.net/rest/agile/1.0/sprint/99', () =>
          HttpResponse.json(
            { errorMessages: ['Sprint does not exist'] },
            { status: 404 },
          ),
        ),
      );

      await expect(
        makeRegistry([cloudConnection]).invoke({
          id: 'test:get-sprint-insights',
          input: { sprintId: '99' },
        }),
      ).rejects.toThrow(/sprint 99.*status 404/);
    });
  });

  describe('permission gating', () => {
    it('rejects a denied caller before any Jira call', async () => {
      let called = false;
      server.use(
        http.post('https://example.atlassian.net/rest/api/3/issue', () => {
          called = true;
          return HttpResponse.json({ id: '1', key: 'PROJ-1' }, { status: 201 });
        }),
      );

      const registry = makeRegistry(
        [cloudConnection],
        [],
        mockServices.permissions({ result: AuthorizeResult.DENY }),
      );

      await expect(
        registry.invoke({
          id: 'test:create-work-item',
          input: { projectKey: 'PROJ', issueType: 'Bug', summary: 'x' },
        }),
      ).rejects.toThrow(/not allowed.*jira\.work-item\.write/);
      await expect(
        registry.invoke({ id: 'test:list-projects', input: {} }),
      ).rejects.toThrow(/jira\.work-item\.read/);
      expect(called).toBe(false);
    });

    it('allows all actions under the default policy', async () => {
      server.use(
        http.get(
          'https://example.atlassian.net/rest/api/3/project/search',
          () => HttpResponse.json({ values: [] }),
        ),
      );

      const result: any = await makeRegistry([cloudConnection]).invoke({
        id: 'test:list-projects',
        input: {},
      });
      expect(result.output.projects).toEqual([]);
    });
  });

  it('lists all thirty-six actions with schemas and attributes', async () => {
    const { actions } = await makeRegistry([cloudConnection]).list();
    const ids = actions.map(a => a.id).sort();
    expect(ids).toEqual([
      'test:add-comment',
      'test:add-label',
      'test:add-remote-link',
      'test:add-watcher',
      'test:add-worklog',
      'test:create-version',
      'test:create-work-item',
      'test:delete-comment',
      'test:delete-work-item',
      'test:get-comments',
      'test:get-remote-links',
      'test:get-sprint-insights',
      'test:get-work-item',
      'test:get-worklogs',
      'test:link-work-items',
      'test:list-boards',
      'test:list-components',
      'test:list-fields',
      'test:list-issue-types',
      'test:list-link-types',
      'test:list-projects',
      'test:list-sprint-work-items',
      'test:list-sprints',
      'test:list-transitions',
      'test:list-versions',
      'test:move-to-backlog',
      'test:move-to-sprint',
      'test:remove-label',
      'test:remove-watcher',
      'test:rename-work-item',
      'test:search-users',
      'test:search-work-items',
      'test:set-work-item-parent',
      'test:transition-work-item',
      'test:update-comment',
      'test:update-work-item',
    ]);
    const readOnlyActions = actions
      .filter(a => a.attributes.readOnly)
      .map(a => a.id)
      .sort();
    expect(readOnlyActions).toEqual([
      'test:get-comments',
      'test:get-remote-links',
      'test:get-sprint-insights',
      'test:get-work-item',
      'test:get-worklogs',
      'test:list-boards',
      'test:list-components',
      'test:list-fields',
      'test:list-issue-types',
      'test:list-link-types',
      'test:list-projects',
      'test:list-sprint-work-items',
      'test:list-sprints',
      'test:list-transitions',
      'test:list-versions',
      'test:search-users',
      'test:search-work-items',
    ]);
    const destructiveActions = actions
      .filter(a => a.attributes.destructive)
      .map(a => a.id);
    expect(destructiveActions).toEqual([
      'test:delete-comment',
      'test:delete-work-item',
    ]);
    for (const action of actions) {
      expect(action.schema.input).toBeDefined();
      expect(action.schema.output).toBeDefined();
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
