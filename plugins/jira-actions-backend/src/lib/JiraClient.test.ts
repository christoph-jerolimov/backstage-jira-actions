import { registerMswTestHooks } from '@backstage/backend-test-utils';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { JiraClient } from './JiraClient';
import { TtlCache } from './cache';
import { JiraConnection } from './connections';

const cloudConnection: JiraConnection = {
  type: 'jira',
  title: 'Jira Cloud',
  host: 'example.atlassian.net',
  apiBaseUrl: 'https://example.atlassian.net',
  product: 'cloud',
  auth: [
    { method: 'basic', username: 'me@example.com', apiToken: 'api-token' },
  ],
};

const datacenterConnection: JiraConnection = {
  type: 'jira',
  title: 'Jira DC',
  host: 'jira.example.com',
  apiBaseUrl: 'https://jira.example.com',
  product: 'datacenter',
  auth: [{ method: 'pat', token: 'pat-token' }],
};

describe('JiraClient', () => {
  const server = setupServer();
  registerMswTestHooks(server);

  it('creates an issue on Jira Cloud with v3 API, basic auth and ADF description', async () => {
    let received: { headers: Headers; body: any } | undefined;
    server.use(
      http.post(
        'https://example.atlassian.net/rest/api/3/issue',
        async ({ request }) => {
          received = { headers: request.headers, body: await request.json() };
          return HttpResponse.json(
            {
              id: '10001',
              key: 'PROJ-123',
              self: 'https://example.atlassian.net/rest/api/3/issue/10001',
            },
            { status: 201 },
          );
        },
      ),
    );

    const result = await new JiraClient(cloudConnection).createIssue({
      projectKey: 'PROJ',
      issueType: 'Bug',
      summary: 'Login fails on Safari',
      description: 'First line\nSecond line',
      labels: ['frontend', 'safari'],
      assignee: 'account-id-1',
      parentKey: 'PROJ-1',
    });

    expect(result).toEqual({
      id: '10001',
      key: 'PROJ-123',
      url: 'https://example.atlassian.net/browse/PROJ-123',
    });
    expect(received?.headers.get('authorization')).toBe(
      `Basic ${Buffer.from('me@example.com:api-token').toString('base64')}`,
    );
    expect(received?.body).toEqual({
      fields: {
        project: { key: 'PROJ' },
        issuetype: { name: 'Bug' },
        summary: 'Login fails on Safari',
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'First line' },
                { type: 'hardBreak' },
                { type: 'text', text: 'Second line' },
              ],
            },
          ],
        },
        labels: ['frontend', 'safari'],
        assignee: { id: 'account-id-1' },
        parent: { key: 'PROJ-1' },
      },
    });
  });

  it('creates an issue on Jira Data Center with v2 API, bearer auth and plain description', async () => {
    let received: { headers: Headers; body: any } | undefined;
    server.use(
      http.post(
        'https://jira.example.com/rest/api/2/issue',
        async ({ request }) => {
          received = { headers: request.headers, body: await request.json() };
          return HttpResponse.json(
            { id: '20002', key: 'OPS-7' },
            { status: 201 },
          );
        },
      ),
    );

    const result = await new JiraClient(datacenterConnection).createIssue({
      projectKey: 'OPS',
      issueType: 'Task',
      summary: 'Rotate certificates',
      description: 'Plain text',
      assignee: 'jdoe',
    });

    expect(result.url).toBe('https://jira.example.com/browse/OPS-7');
    expect(received?.headers.get('authorization')).toBe('Bearer pat-token');
    expect(received?.body.fields.description).toBe('Plain text');
    expect(received?.body.fields.assignee).toEqual({ name: 'jdoe' });
  });

  it('updates an issue with the provided fields', async () => {
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

    const result = await new JiraClient(cloudConnection).updateIssue(
      'PROJ-123',
      {
        summary: 'New summary',
        issueType: 'Story',
      },
    );

    expect(result).toEqual({
      key: 'PROJ-123',
      url: 'https://example.atlassian.net/browse/PROJ-123',
    });
    expect(received).toEqual({
      fields: { summary: 'New summary', issuetype: { name: 'Story' } },
    });
  });

  it.each([
    [
      400,
      'InputError',
      {
        errorMessages: [],
        errors: { issuetype: 'The issue type selected is invalid.' },
      },
      'issuetype: The issue type selected is invalid.',
    ],
    [
      401,
      'NotAllowedError',
      { errorMessages: ['Unauthorized'] },
      'Unauthorized',
    ],
    [403, 'NotAllowedError', { errorMessages: ['Forbidden'] }, 'Forbidden'],
    [
      404,
      'NotFoundError',
      {
        errorMessages: [
          'Issue does not exist or you do not have permission to see it.',
        ],
      },
      'Issue does not exist',
    ],
  ] as const)(
    'maps status %s to %s including Jira error details',
    async (status, errorName, body, detail) => {
      server.use(
        http.post('https://example.atlassian.net/rest/api/3/issue', () =>
          HttpResponse.json(body, { status }),
        ),
      );

      let error: Error | undefined;
      try {
        await new JiraClient(cloudConnection).createIssue({
          projectKey: 'PROJ',
          issueType: 'Nope',
          summary: 'x',
        });
      } catch (e) {
        error = e as Error;
      }

      expect(error?.name).toBe(errorName);
      expect(error?.message).toContain(`status ${status}`);
      expect(error?.message).toContain(detail);
      expect(error?.message).not.toContain('api-token');
      expect(error?.message).not.toContain('Authorization');
      expect(error?.message).not.toContain(
        Buffer.from('me@example.com:api-token').toString('base64'),
      );
    },
  );

  it('maps unexpected statuses to a generic error', async () => {
    server.use(
      http.post('https://example.atlassian.net/rest/api/3/issue', () =>
        HttpResponse.text('gateway timeout', { status: 504 }),
      ),
    );

    await expect(
      new JiraClient(cloudConnection).createIssue({
        projectKey: 'PROJ',
        issueType: 'Bug',
        summary: 'x',
      }),
    ).rejects.toThrow(/Failed to create Jira issue, status 504/);
  });

  describe('getIssue', () => {
    it('reads and normalizes an issue on cloud, rendering the ADF description', async () => {
      let requestedFields: string | null = null;
      server.use(
        http.get(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-123',
          ({ request }) => {
            requestedFields = new URL(request.url).searchParams.get('fields');
            return HttpResponse.json({
              key: 'PROJ-123',
              fields: {
                summary: 'Login fails on Safari',
                status: { name: 'In Progress' },
                issuetype: { name: 'Bug' },
                assignee: { accountId: 'account-id-1' },
                labels: ['frontend'],
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
                parent: { key: 'PROJ-1' },
                created: '2026-08-01T10:00:00.000+0000',
                updated: '2026-08-20T10:00:00.000+0000',
              },
            });
          },
        ),
      );

      const issue = await new JiraClient(cloudConnection).getIssue('PROJ-123');

      expect(requestedFields).toContain('description');
      expect(issue).toEqual({
        key: 'PROJ-123',
        summary: 'Login fails on Safari',
        status: 'In Progress',
        issueType: 'Bug',
        url: 'https://example.atlassian.net/browse/PROJ-123',
        description: 'Broken',
        assignee: 'account-id-1',
        labels: ['frontend'],
        parentKey: 'PROJ-1',
        created: '2026-08-01T10:00:00.000+0000',
        updated: '2026-08-20T10:00:00.000+0000',
      });
    });

    it('uses username assignee and string description on datacenter', async () => {
      server.use(
        http.get('https://jira.example.com/rest/api/2/issue/OPS-7', () =>
          HttpResponse.json({
            key: 'OPS-7',
            fields: {
              summary: 'Rotate certificates',
              status: { name: 'To Do' },
              issuetype: { name: 'Task' },
              assignee: { name: 'jdoe' },
              labels: [],
              description: 'Plain text',
            },
          }),
        ),
      );

      const issue = await new JiraClient(datacenterConnection).getIssue(
        'OPS-7',
      );

      expect(issue.assignee).toBe('jdoe');
      expect(issue.description).toBe('Plain text');
      expect(issue.labels).toBeUndefined();
      expect(issue.parentKey).toBeUndefined();
    });

    it('maps 404 to NotFoundError', async () => {
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
        new JiraClient(cloudConnection).getIssue('PROJ-999'),
      ).rejects.toThrow(/get Jira issue PROJ-999, status 404/);
    });
  });

  describe('searchIssues', () => {
    it('uses the search/jql endpoint on cloud', async () => {
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
                    status: { name: 'Done' },
                    issuetype: { name: 'Story' },
                    assignee: { accountId: 'account-id-1' },
                  },
                },
              ],
            });
          },
        ),
      );

      const result = await new JiraClient(cloudConnection).searchIssues({
        jql: 'project = "PROJ"',
        maxResults: 10,
      });

      expect(received).toEqual({
        jql: 'project = "PROJ"',
        maxResults: 10,
        fields: ['summary', 'status', 'issuetype', 'assignee'],
      });
      expect(result.items).toEqual([
        {
          key: 'PROJ-1',
          summary: 'First',
          status: 'Done',
          issueType: 'Story',
          url: 'https://example.atlassian.net/browse/PROJ-1',
          assignee: 'account-id-1',
        },
      ]);
    });

    it('uses the classic search endpoint on datacenter', async () => {
      let received: any;
      server.use(
        http.post(
          'https://jira.example.com/rest/api/2/search',
          async ({ request }) => {
            received = await request.json();
            return HttpResponse.json({
              issues: [
                {
                  key: 'OPS-2',
                  fields: {
                    summary: 'Second',
                    status: { name: 'To Do' },
                    issuetype: { name: 'Task' },
                    assignee: null,
                  },
                },
              ],
            });
          },
        ),
      );

      const result = await new JiraClient(datacenterConnection).searchIssues({
        jql: 'assignee = "jdoe"',
        maxResults: 5,
      });

      expect(received.jql).toBe('assignee = "jdoe"');
      expect(result.items).toEqual([
        {
          key: 'OPS-2',
          summary: 'Second',
          status: 'To Do',
          issueType: 'Task',
          url: 'https://jira.example.com/browse/OPS-2',
        },
      ]);
    });
  });

  describe('addComment', () => {
    it('sends an ADF body on cloud', async () => {
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

      const result = await new JiraClient(cloudConnection).addComment(
        'PROJ-123',
        'Working on it',
      );

      expect(received.body.type).toBe('doc');
      expect(result).toEqual({
        key: 'PROJ-123',
        commentId: '5001',
        url: 'https://example.atlassian.net/browse/PROJ-123',
      });
    });

    it('sends a string body on datacenter', async () => {
      let received: any;
      server.use(
        http.post(
          'https://jira.example.com/rest/api/2/issue/OPS-7/comment',
          async ({ request }) => {
            received = await request.json();
            return HttpResponse.json({ id: 42 }, { status: 201 });
          },
        ),
      );

      const result = await new JiraClient(datacenterConnection).addComment(
        'OPS-7',
        'Done',
      );

      expect(received.body).toBe('Done');
      expect(result.commentId).toBe('42');
    });
  });

  describe('transitions', () => {
    it('lists transitions with their target statuses', async () => {
      server.use(
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
      );

      const transitions = await new JiraClient(cloudConnection).listTransitions(
        'PROJ-123',
      );

      expect(transitions).toEqual([
        { id: '11', name: 'Start work', toStatus: 'In Progress' },
        { id: '21', name: 'Close', toStatus: 'Done' },
      ]);
    });

    it('executes a transition by id', async () => {
      let received: any;
      server.use(
        http.post(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-123/transitions',
          async ({ request }) => {
            received = await request.json();
            return new HttpResponse(null, { status: 204 });
          },
        ),
      );

      await new JiraClient(cloudConnection).transitionIssue('PROJ-123', '11');

      expect(received).toEqual({ transition: { id: '11' } });
    });
  });

  describe('projects', () => {
    it('lists projects via project/search on cloud', async () => {
      let maxResults: string | null = null;
      server.use(
        http.get(
          'https://example.atlassian.net/rest/api/3/project/search',
          ({ request }) => {
            maxResults = new URL(request.url).searchParams.get('maxResults');
            return HttpResponse.json({
              values: [{ id: 10000, key: 'PROJ', name: 'Project' }],
            });
          },
        ),
      );

      const projects = await new JiraClient(cloudConnection).listProjects({
        maxResults: 7,
      });

      expect(maxResults).toBe('7');
      expect(projects).toEqual([
        {
          id: '10000',
          key: 'PROJ',
          name: 'Project',
          url: 'https://example.atlassian.net/browse/PROJ',
        },
      ]);
    });

    it('lists projects via project on datacenter, truncated to maxResults', async () => {
      server.use(
        http.get('https://jira.example.com/rest/api/2/project', () =>
          HttpResponse.json([
            { id: '1', key: 'ONE', name: 'One' },
            { id: '2', key: 'TWO', name: 'Two' },
            { id: '3', key: 'THREE', name: 'Three' },
          ]),
        ),
      );

      const projects = await new JiraClient(datacenterConnection).listProjects({
        maxResults: 2,
      });

      expect(projects).toEqual([
        {
          id: '1',
          key: 'ONE',
          name: 'One',
          url: 'https://jira.example.com/browse/ONE',
        },
        {
          id: '2',
          key: 'TWO',
          name: 'Two',
          url: 'https://jira.example.com/browse/TWO',
        },
      ]);
    });

    it('reads issue types from the project', async () => {
      server.use(
        http.get('https://example.atlassian.net/rest/api/3/project/PROJ', () =>
          HttpResponse.json({
            key: 'PROJ',
            issueTypes: [
              { id: 1, name: 'Bug', subtask: false, description: 'A bug' },
              { id: 2, name: 'Sub-task', subtask: true, description: '' },
            ],
          }),
        ),
      );

      const issueTypes = await new JiraClient(
        cloudConnection,
      ).getProjectIssueTypes('PROJ');

      expect(issueTypes).toEqual([
        { id: '1', name: 'Bug', subtask: false, description: 'A bug' },
        { id: '2', name: 'Sub-task', subtask: true },
      ]);
    });

    it('maps unknown project to NotFoundError', async () => {
      server.use(
        http.get('https://example.atlassian.net/rest/api/3/project/NOPE', () =>
          HttpResponse.json(
            { errorMessages: ['No project could be found'] },
            { status: 404 },
          ),
        ),
      );

      await expect(
        new JiraClient(cloudConnection).getProjectIssueTypes('NOPE'),
      ).rejects.toThrow(/get Jira project NOPE, status 404/);
    });
  });
});

describe('JiraClient markdown handling', () => {
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
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: 'first' }] },
            ],
          },
        ],
      },
    ],
  };

  it('converts markdown descriptions to structured ADF on cloud', async () => {
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

    await new JiraClient(cloudConnection).createIssue({
      projectKey: 'PROJ',
      issueType: 'Bug',
      summary: 'x',
      description: '## Steps\n\n- first',
    });

    expect(received.fields.description).toEqual(formattedAdf);
  });

  it('reads descriptions back as markdown by default and text on request', async () => {
    server.use(
      http.get('https://example.atlassian.net/rest/api/3/issue/PROJ-1', () =>
        HttpResponse.json({
          key: 'PROJ-1',
          fields: {
            summary: 'x',
            status: { name: 'To Do' },
            issuetype: { name: 'Bug' },
            description: formattedAdf,
          },
        }),
      ),
    );

    const client = new JiraClient(cloudConnection);
    const asMarkdown = await client.getIssue('PROJ-1');
    expect(asMarkdown.description).toBe('## Steps\n\n- first');

    const asText = await client.getIssue('PROJ-1', {
      descriptionFormat: 'text',
    });
    expect(asText.description).toBe('Steps\nfirst');
  });
});

describe('JiraClient rich text formats', () => {
  const server = setupServer();
  registerMswTestHooks(server);

  const adfDoc = {
    type: 'doc',
    version: 1,
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'verbatim' }] },
    ],
  };

  it('writes literal text without markdown interpretation', async () => {
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

    await new JiraClient(cloudConnection).updateIssue('PROJ-1', {
      description: '# not a heading',
      descriptionFormat: 'text',
    });

    expect(received.fields.description).toEqual({
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '# not a heading' }],
        },
      ],
    });
  });

  it('writes adf documents verbatim, as object or JSON string', async () => {
    let received: any;
    server.use(
      http.post(
        'https://example.atlassian.net/rest/api/3/issue/PROJ-1/comment',
        async ({ request }) => {
          received = await request.json();
          return HttpResponse.json({ id: '1' }, { status: 201 });
        },
      ),
    );

    const client = new JiraClient(cloudConnection);
    await client.addComment('PROJ-1', adfDoc, 'adf');
    expect(received.body).toEqual(adfDoc);

    await client.addComment('PROJ-1', JSON.stringify(adfDoc), 'adf');
    expect(received.body).toEqual(adfDoc);
  });

  it('rejects adf writes on datacenter before any request', async () => {
    await expect(
      new JiraClient(datacenterConnection).addComment('OPS-1', adfDoc, 'adf'),
    ).rejects.toThrow(/"adf" requires a Jira Cloud connection/);
  });

  it('reads the raw adf document on request', async () => {
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

    const issue = await new JiraClient(cloudConnection).getIssue('PROJ-1', {
      descriptionFormat: 'adf',
    });
    expect(issue.description).toEqual(adfDoc);
  });
});

describe('JiraClient management operations', () => {
  const server = setupServer();
  registerMswTestHooks(server);

  describe('getComments', () => {
    it('reads comments with authors on cloud', async () => {
      let maxResults: string | null = null;
      server.use(
        http.get(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-1/comment',
          ({ request }) => {
            maxResults = new URL(request.url).searchParams.get('maxResults');
            return HttpResponse.json({
              comments: [
                {
                  id: 10,
                  author: { displayName: 'Jane Doe' },
                  body: {
                    type: 'doc',
                    version: 1,
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'On it' }],
                      },
                    ],
                  },
                  created: '2026-08-01T10:00:00.000+0000',
                  updated: '2026-08-02T10:00:00.000+0000',
                },
              ],
            });
          },
        ),
      );

      const { comments, nextPageToken } = await new JiraClient(
        cloudConnection,
      ).getComments('PROJ-1', { maxResults: 25 });

      expect(maxResults).toBe('25');
      expect(comments).toHaveLength(1);
      expect(comments[0].id).toBe('10');
      expect(comments[0].author).toBe('Jane Doe');
      expect(comments[0].created).toBe('2026-08-01T10:00:00.000+0000');
      expect(nextPageToken).toBeUndefined();
    });

    it('reads string bodies on datacenter and maps 404', async () => {
      server.use(
        http.get(
          'https://jira.example.com/rest/api/2/issue/OPS-1/comment',
          () =>
            HttpResponse.json({
              comments: [{ id: '5', body: 'plain comment' }],
            }),
        ),
        http.get(
          'https://jira.example.com/rest/api/2/issue/OPS-9/comment',
          () =>
            HttpResponse.json(
              { errorMessages: ['Issue does not exist'] },
              { status: 404 },
            ),
        ),
      );

      const client = new JiraClient(datacenterConnection);
      const { comments } = await client.getComments('OPS-1', {
        maxResults: 50,
      });
      expect(comments[0].body).toBe('plain comment');
      expect(comments[0].author).toBeUndefined();

      await expect(
        client.getComments('OPS-9', { maxResults: 50 }),
      ).rejects.toThrow(/get comments of Jira issue OPS-9, status 404/);
    });
  });

  describe('labels and parent', () => {
    it('edits labels incrementally and reads back the result', async () => {
      let putBody: any;
      server.use(
        http.put(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-1',
          async ({ request }) => {
            putBody = await request.json();
            return new HttpResponse(null, { status: 204 });
          },
        ),
        http.get('https://example.atlassian.net/rest/api/3/issue/PROJ-1', () =>
          HttpResponse.json({
            key: 'PROJ-1',
            fields: { labels: ['kept', 'added'] },
          }),
        ),
      );

      const labels = await new JiraClient(cloudConnection).editLabels(
        'PROJ-1',
        { add: ['added'], remove: ['dropped'] },
      );

      expect(putBody).toEqual({
        update: { labels: [{ add: 'added' }, { remove: 'dropped' }] },
      });
      expect(labels).toEqual(['kept', 'added']);
    });

    it('combines field updates with label edits in a single request', async () => {
      let putBody: any;
      server.use(
        http.put(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-1',
          async ({ request }) => {
            putBody = await request.json();
            return new HttpResponse(null, { status: 204 });
          },
        ),
      );

      await new JiraClient(cloudConnection).updateIssue(
        'PROJ-1',
        { summary: 'New summary' },
        { add: ['triage'] },
      );

      expect(putBody).toEqual({
        fields: { summary: 'New summary' },
        update: { labels: [{ add: 'triage' }] },
      });
    });

    it('sets the parent of an issue', async () => {
      let putBody: any;
      server.use(
        http.put(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-2',
          async ({ request }) => {
            putBody = await request.json();
            return new HttpResponse(null, { status: 204 });
          },
        ),
      );

      await new JiraClient(cloudConnection).setParent('PROJ-2', 'PROJ-1');

      expect(putBody).toEqual({ fields: { parent: { key: 'PROJ-1' } } });
    });
  });

  describe('listProjects with filter and expansion', () => {
    it('passes the query and expand on cloud and returns url/description', async () => {
      let params: URLSearchParams | undefined;
      server.use(
        http.get(
          'https://example.atlassian.net/rest/api/3/project/search',
          ({ request }) => {
            params = new URL(request.url).searchParams;
            return HttpResponse.json({
              values: [
                { id: 1, key: 'PAY', name: 'Payments', description: 'Money' },
                { id: 2, key: 'OPS', name: 'Operations' },
              ],
            });
          },
        ),
      );

      const projects = await new JiraClient(cloudConnection).listProjects({
        maxResults: 10,
        name: 'pay',
      });

      expect(params?.get('query')).toBe('pay');
      expect(params?.get('expand')).toBe('description');
      expect(projects).toEqual([
        {
          id: '1',
          key: 'PAY',
          name: 'Payments',
          url: 'https://example.atlassian.net/browse/PAY',
          description: 'Money',
        },
      ]);
    });

    it('filters client-side on datacenter', async () => {
      server.use(
        http.get(
          'https://jira.example.com/rest/api/2/project',
          ({ request }) => {
            expect(new URL(request.url).searchParams.get('expand')).toBe(
              'description',
            );
            return HttpResponse.json([
              { id: '1', key: 'PAY', name: 'Payments' },
              {
                id: '2',
                key: 'OPS',
                name: 'Operations',
                description: 'Run it',
              },
            ]);
          },
        ),
      );

      const projects = await new JiraClient(datacenterConnection).listProjects({
        maxResults: 10,
        name: 'oper',
      });

      expect(projects).toEqual([
        {
          id: '2',
          key: 'OPS',
          name: 'Operations',
          url: 'https://jira.example.com/browse/OPS',
          description: 'Run it',
        },
      ]);
    });
  });
});

describe('JiraClient coverage expansion', () => {
  const server = setupServer();
  registerMswTestHooks(server);

  describe('user search', () => {
    it('searches users on cloud via query and maps account ids', async () => {
      let params: URLSearchParams | undefined;
      server.use(
        http.get(
          'https://example.atlassian.net/rest/api/3/user/search',
          ({ request }) => {
            params = new URL(request.url).searchParams;
            return HttpResponse.json([
              {
                accountId: 'acc-1',
                displayName: 'Jane Doe',
                emailAddress: 'jane@example.com',
                active: true,
              },
              { accountId: 'acc-2', displayName: 'Inactive', active: false },
            ]);
          },
        ),
      );

      const users = await new JiraClient(cloudConnection).searchUsers('jane', {
        maxResults: 10,
      });

      expect(params?.get('query')).toBe('jane');
      expect(params?.get('username')).toBeNull();
      expect(users).toEqual([
        {
          id: 'acc-1',
          displayName: 'Jane Doe',
          email: 'jane@example.com',
          active: true,
        },
        {
          id: 'acc-2',
          displayName: 'Inactive',
          email: undefined,
          active: false,
        },
      ]);
    });

    it('searches users on datacenter via username and maps names', async () => {
      let params: URLSearchParams | undefined;
      server.use(
        http.get(
          'https://jira.example.com/rest/api/2/user/search',
          ({ request }) => {
            params = new URL(request.url).searchParams;
            return HttpResponse.json([
              { name: 'jdoe', displayName: 'Jane Doe', active: true },
            ]);
          },
        ),
      );

      const users = await new JiraClient(datacenterConnection).searchUsers(
        'jane',
        { maxResults: 10 },
      );

      expect(params?.get('username')).toBe('jane');
      expect(users[0].id).toBe('jdoe');
    });
  });

  describe('issue links', () => {
    const linkTypes = {
      issueLinkTypes: [
        { id: '1', name: 'Blocks', inward: 'is blocked by', outward: 'blocks' },
        {
          id: '2',
          name: 'Relates',
          inward: 'relates to',
          outward: 'relates to',
        },
      ],
    };

    it('lists link types', async () => {
      server.use(
        http.get('https://example.atlassian.net/rest/api/3/issueLinkType', () =>
          HttpResponse.json(linkTypes),
        ),
      );

      const types = await new JiraClient(cloudConnection).listLinkTypes();
      expect(types).toEqual([
        { id: '1', name: 'Blocks', inward: 'is blocked by', outward: 'blocks' },
        {
          id: '2',
          name: 'Relates',
          inward: 'relates to',
          outward: 'relates to',
        },
      ]);
    });

    it('links issues by name with issueKey as the outward issue', async () => {
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

      const result = await new JiraClient(cloudConnection).linkIssues(
        'PROJ-1',
        'PROJ-2',
        'blocks',
      );

      expect(result).toEqual({ linkType: 'Blocks' });
      expect(received).toEqual({
        type: { name: 'Blocks' },
        outwardIssue: { key: 'PROJ-1' },
        inwardIssue: { key: 'PROJ-2' },
      });
    });

    it('reverses the direction for an inward description match', async () => {
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

      await new JiraClient(cloudConnection).linkIssues(
        'PROJ-1',
        'PROJ-2',
        'Is Blocked By',
      );

      expect(received).toEqual({
        type: { name: 'Blocks' },
        outwardIssue: { key: 'PROJ-2' },
        inwardIssue: { key: 'PROJ-1' },
      });
    });

    it('rejects an unknown link type listing the available ones', async () => {
      let posted = false;
      server.use(
        http.get('https://example.atlassian.net/rest/api/3/issueLinkType', () =>
          HttpResponse.json(linkTypes),
        ),
        http.post('https://example.atlassian.net/rest/api/3/issueLink', () => {
          posted = true;
          return new HttpResponse(null, { status: 201 });
        }),
      );

      await expect(
        new JiraClient(cloudConnection).linkIssues('PROJ-1', 'PROJ-2', 'nope'),
      ).rejects.toThrow(/Unknown Jira issue link type "nope".*Blocks.*Relates/);
      expect(posted).toBe(false);
    });

    it('includes links in getIssue with per-direction descriptions', async () => {
      server.use(
        http.get('https://example.atlassian.net/rest/api/3/issue/PROJ-1', () =>
          HttpResponse.json({
            key: 'PROJ-1',
            fields: {
              summary: 'Linked',
              status: { name: 'To Do' },
              issuetype: { name: 'Story' },
              issuelinks: [
                {
                  type: {
                    name: 'Blocks',
                    inward: 'is blocked by',
                    outward: 'blocks',
                  },
                  outwardIssue: { key: 'PROJ-2' },
                },
                {
                  type: {
                    name: 'Blocks',
                    inward: 'is blocked by',
                    outward: 'blocks',
                  },
                  inwardIssue: { key: 'PROJ-3' },
                },
              ],
            },
          }),
        ),
      );

      const issue = await new JiraClient(cloudConnection).getIssue('PROJ-1');
      expect(issue.links).toEqual([
        { type: 'Blocks', direction: 'blocks', key: 'PROJ-2' },
        { type: 'Blocks', direction: 'is blocked by', key: 'PROJ-3' },
      ]);
    });
  });

  describe('fields and custom fields', () => {
    it('lists fields with a client-side name filter', async () => {
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

      const client = new JiraClient(cloudConnection);
      const all = await client.listFields();
      expect(all).toHaveLength(2);

      const filtered = await client.listFields({ name: 'story point' });
      expect(filtered).toEqual([
        {
          id: 'customfield_10020',
          name: 'Story Points',
          custom: true,
          type: 'number',
        },
      ]);
    });

    it('passes custom fields verbatim on create and update', async () => {
      let createBody: any;
      let updateBody: any;
      server.use(
        http.post(
          'https://example.atlassian.net/rest/api/3/issue',
          async ({ request }) => {
            createBody = await request.json();
            return HttpResponse.json(
              { id: '1', key: 'PROJ-1' },
              { status: 201 },
            );
          },
        ),
        http.put(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-1',
          async ({ request }) => {
            updateBody = await request.json();
            return new HttpResponse(null, { status: 204 });
          },
        ),
      );

      const client = new JiraClient(cloudConnection);
      await client.createIssue({
        projectKey: 'PROJ',
        issueType: 'Story',
        summary: 'x',
        customFields: { customfield_10020: 5 },
      });
      await client.updateIssue('PROJ-1', {
        customFields: { customfield_10020: 8 },
      });

      expect(createBody.fields.customfield_10020).toBe(5);
      expect(updateBody).toEqual({ fields: { customfield_10020: 8 } });
    });

    it('reads selected custom fields on getIssue', async () => {
      let params: URLSearchParams | undefined;
      server.use(
        http.get(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-1',
          ({ request }) => {
            params = new URL(request.url).searchParams;
            return HttpResponse.json({
              key: 'PROJ-1',
              fields: {
                summary: 'x',
                status: { name: 'To Do' },
                issuetype: { name: 'Story' },
                customfield_10020: 5,
              },
            });
          },
        ),
      );

      const issue = await new JiraClient(cloudConnection).getIssue('PROJ-1', {
        customFields: ['customfield_10020'],
      });

      expect(params?.get('fields')).toContain('customfield_10020');
      expect(issue.customFields).toEqual({ customfield_10020: 5 });
    });
  });

  describe('worklogs', () => {
    it('reads worklogs with authors and raw comments', async () => {
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
                  comment: {
                    type: 'doc',
                    version: 1,
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'pairing' }],
                      },
                    ],
                  },
                },
              ],
            }),
        ),
      );

      const worklogs = await new JiraClient(cloudConnection).getWorklogs(
        'PROJ-1',
        { maxResults: 50 },
      );

      expect(worklogs).toHaveLength(1);
      expect(worklogs[0].id).toBe('100');
      expect(worklogs[0].author).toBe('Jane Doe');
      expect(worklogs[0].timeSpent).toBe('2h');
      expect(worklogs[0].timeSpentSeconds).toBe(7200);
    });

    it('adds a worklog with a markdown comment converted to ADF', async () => {
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

      const result = await new JiraClient(cloudConnection).addWorklog(
        'PROJ-1',
        { timeSpent: '2h 30m', comment: 'pairing session' },
      );

      expect(result).toEqual({ worklogId: '101' });
      expect(received.timeSpent).toBe('2h 30m');
      expect(received.started).toBeUndefined();
      expect(received.comment.type).toBe('doc');
    });
  });

  describe('watchers and delete', () => {
    it('adds a watcher as a bare JSON string body', async () => {
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

      await new JiraClient(cloudConnection).addWatcher('PROJ-1', 'acc-1');
      expect(rawBody).toBe('"acc-1"');
    });

    it('removes a watcher via the per-product query parameter', async () => {
      let cloudParams: URLSearchParams | undefined;
      let dcParams: URLSearchParams | undefined;
      server.use(
        http.delete(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-1/watchers',
          ({ request }) => {
            cloudParams = new URL(request.url).searchParams;
            return new HttpResponse(null, { status: 204 });
          },
        ),
        http.delete(
          'https://jira.example.com/rest/api/2/issue/OPS-1/watchers',
          ({ request }) => {
            dcParams = new URL(request.url).searchParams;
            return new HttpResponse(null, { status: 204 });
          },
        ),
      );

      await new JiraClient(cloudConnection).removeWatcher('PROJ-1', 'acc-1');
      await new JiraClient(datacenterConnection).removeWatcher('OPS-1', 'jdoe');

      expect(cloudParams?.get('accountId')).toBe('acc-1');
      expect(dcParams?.get('username')).toBe('jdoe');
    });

    it('deletes an issue with the deleteSubtasks flag', async () => {
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

      await new JiraClient(cloudConnection).deleteIssue('PROJ-1', {
        deleteSubtasks: true,
      });
      expect(params?.get('deleteSubtasks')).toBe('true');
    });
  });

  describe('agile API', () => {
    it('lists boards under /rest/agile/1.0 with filters', async () => {
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

      const boards = await new JiraClient(cloudConnection).listBoards({
        maxResults: 50,
        projectKey: 'PROJ',
      });

      expect(params?.get('projectKeyOrId')).toBe('PROJ');
      expect(boards).toEqual([
        { id: '7', name: 'Platform board', type: 'scrum' },
      ]);
    });

    it('lists sprints of a board with a state filter', async () => {
      let params: URLSearchParams | undefined;
      server.use(
        http.get(
          'https://example.atlassian.net/rest/agile/1.0/board/7/sprint',
          ({ request }) => {
            params = new URL(request.url).searchParams;
            return HttpResponse.json({
              values: [
                {
                  id: 42,
                  name: 'Sprint 12',
                  state: 'active',
                  startDate: '2026-08-20T00:00:00.000Z',
                  endDate: '2026-09-03T00:00:00.000Z',
                  goal: 'Ship it',
                },
              ],
            });
          },
        ),
      );

      const sprints = await new JiraClient(cloudConnection).listSprints('7', {
        maxResults: 50,
        state: 'active',
      });

      expect(params?.get('state')).toBe('active');
      expect(sprints[0]).toEqual({
        id: '42',
        name: 'Sprint 12',
        state: 'active',
        startDate: '2026-08-20T00:00:00.000Z',
        endDate: '2026-09-03T00:00:00.000Z',
        goal: 'Ship it',
      });
    });

    it('moves issues to a sprint and maps 404', async () => {
      let received: any;
      server.use(
        http.post(
          'https://example.atlassian.net/rest/agile/1.0/sprint/42/issue',
          async ({ request }) => {
            received = await request.json();
            return new HttpResponse(null, { status: 204 });
          },
        ),
        http.post(
          'https://example.atlassian.net/rest/agile/1.0/sprint/99/issue',
          () =>
            HttpResponse.json(
              { errorMessages: ['Sprint does not exist'] },
              { status: 404 },
            ),
        ),
      );

      const client = new JiraClient(cloudConnection);
      await client.moveToSprint('42', ['PROJ-1', 'PROJ-2']);
      expect(received).toEqual({ issues: ['PROJ-1', 'PROJ-2'] });

      await expect(client.moveToSprint('99', ['PROJ-1'])).rejects.toThrow(
        /move Jira issues to sprint 99, status 404/,
      );
    });
  });

  describe('pagination tokens', () => {
    it('passes the cloud search token through and returns the next one', async () => {
      let received: any;
      server.use(
        http.post(
          'https://example.atlassian.net/rest/api/3/search/jql',
          async ({ request }) => {
            received = await request.json();
            return HttpResponse.json({
              issues: [{ key: 'PROJ-3', fields: { summary: 'third' } }],
              nextPageToken: 'token-2',
            });
          },
        ),
      );

      const result = await new JiraClient(cloudConnection).searchIssues({
        jql: 'project = PROJ',
        maxResults: 1,
        pageToken: 'token-1',
      });

      expect(received.nextPageToken).toBe('token-1');
      expect(received.startAt).toBeUndefined();
      expect(result.nextPageToken).toBe('token-2');
    });

    it('encodes datacenter search offsets as tokens', async () => {
      let received: any;
      server.use(
        http.post(
          'https://jira.example.com/rest/api/2/search',
          async ({ request }) => {
            received = await request.json();
            return HttpResponse.json({
              issues: [{ key: 'OPS-3', fields: { summary: 'third' } }],
              total: 5,
            });
          },
        ),
      );

      const client = new JiraClient(datacenterConnection);
      const result = await client.searchIssues({
        jql: 'project = OPS',
        maxResults: 1,
        pageToken: '2',
      });

      expect(received.startAt).toBe(2);
      expect(result.nextPageToken).toBe('3');

      await expect(
        client.searchIssues({
          jql: 'project = OPS',
          maxResults: 1,
          pageToken: 'not-a-number',
        }),
      ).rejects.toThrow(/Invalid pageToken "not-a-number"/);
    });

    it('pages comments by offset and omits the token on the last page', async () => {
      let params: URLSearchParams | undefined;
      server.use(
        http.get(
          'https://example.atlassian.net/rest/api/3/issue/PROJ-1/comment',
          ({ request }) => {
            params = new URL(request.url).searchParams;
            const startAt = Number(params.get('startAt'));
            return HttpResponse.json({
              comments: [{ id: startAt + 1, body: 'c' }],
              total: 2,
            });
          },
        ),
      );

      const client = new JiraClient(cloudConnection);
      const first = await client.getComments('PROJ-1', { maxResults: 1 });
      expect(params?.get('startAt')).toBe('0');
      expect(first.nextPageToken).toBe('1');

      const second = await client.getComments('PROJ-1', {
        maxResults: 1,
        pageToken: first.nextPageToken,
      });
      expect(params?.get('startAt')).toBe('1');
      expect(second.comments[0].id).toBe('2');
      expect(second.nextPageToken).toBeUndefined();
    });
  });
});

describe('JiraClient versions and components', () => {
  const server = setupServer();
  registerMswTestHooks(server);

  it('lists versions of a project', async () => {
    server.use(
      http.get(
        'https://example.atlassian.net/rest/api/3/project/PROJ/versions',
        () =>
          HttpResponse.json([
            {
              id: 10,
              name: '1.2.0',
              released: false,
              archived: false,
              releaseDate: '2026-09-01',
              description: 'Next release',
            },
            { id: 11, name: '1.1.0', released: true, archived: true },
          ]),
      ),
    );

    const versions = await new JiraClient(cloudConnection).listVersions('PROJ');
    expect(versions).toEqual([
      {
        id: '10',
        name: '1.2.0',
        released: false,
        archived: false,
        startDate: undefined,
        releaseDate: '2026-09-01',
        description: 'Next release',
      },
      {
        id: '11',
        name: '1.1.0',
        released: true,
        archived: true,
        startDate: undefined,
        releaseDate: undefined,
        description: undefined,
      },
    ]);
  });

  it('lists components of a project and maps 404', async () => {
    server.use(
      http.get(
        'https://example.atlassian.net/rest/api/3/project/PROJ/components',
        () =>
          HttpResponse.json([
            {
              id: 1,
              name: 'backend',
              description: 'The backend',
              lead: { displayName: 'Jane Doe' },
            },
          ]),
      ),
      http.get(
        'https://example.atlassian.net/rest/api/3/project/NOPE/components',
        () =>
          HttpResponse.json(
            { errorMessages: ['No project could be found'] },
            { status: 404 },
          ),
      ),
    );

    const client = new JiraClient(cloudConnection);
    expect(await client.listComponents('PROJ')).toEqual([
      {
        id: '1',
        name: 'backend',
        description: 'The backend',
        lead: 'Jane Doe',
      },
    ]);
    await expect(client.listComponents('NOPE')).rejects.toThrow(
      /components of Jira project NOPE, status 404/,
    );
  });

  it('creates a version after resolving the project id', async () => {
    let received: any;
    server.use(
      http.get('https://example.atlassian.net/rest/api/3/project/PROJ', () =>
        HttpResponse.json({ id: '10000', key: 'PROJ' }),
      ),
      http.post(
        'https://example.atlassian.net/rest/api/3/version',
        async ({ request }) => {
          received = await request.json();
          return HttpResponse.json({ id: 42, name: '1.2.0' }, { status: 201 });
        },
      ),
    );

    const result = await new JiraClient(cloudConnection).createVersion({
      projectKey: 'PROJ',
      name: '1.2.0',
      releaseDate: '2026-09-01',
    });

    expect(received).toEqual({
      projectId: 10000,
      name: '1.2.0',
      releaseDate: '2026-09-01',
    });
    expect(result).toEqual({ id: '42', name: '1.2.0' });
  });

  it('maps version and component fields on create and read', async () => {
    let createBody: any;
    server.use(
      http.post(
        'https://example.atlassian.net/rest/api/3/issue',
        async ({ request }) => {
          createBody = await request.json();
          return HttpResponse.json({ id: '1', key: 'PROJ-1' }, { status: 201 });
        },
      ),
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

    const client = new JiraClient(cloudConnection);
    await client.createIssue({
      projectKey: 'PROJ',
      issueType: 'Story',
      summary: 'x',
      fixVersions: ['1.2.0'],
      affectsVersions: ['1.1.0'],
      components: ['backend'],
    });
    expect(createBody.fields.fixVersions).toEqual([{ name: '1.2.0' }]);
    expect(createBody.fields.versions).toEqual([{ name: '1.1.0' }]);
    expect(createBody.fields.components).toEqual([{ name: 'backend' }]);

    const issue = await client.getIssue('PROJ-1');
    expect(issue.fixVersions).toEqual(['1.2.0']);
    expect(issue.affectsVersions).toEqual(['1.1.0']);
    expect(issue.components).toEqual(['backend']);
  });
});

describe('JiraClient rate limit retries', () => {
  const server = setupServer();
  registerMswTestHooks(server);

  const withSleep = () => {
    const waits: number[] = [];
    const client = new JiraClient(cloudConnection, {
      sleep: async ms => {
        waits.push(ms);
      },
    });
    return { client, waits };
  };

  it('retries a 429 honoring Retry-After seconds and succeeds', async () => {
    let calls = 0;
    server.use(
      http.get('https://example.atlassian.net/rest/api/3/issueLinkType', () => {
        calls += 1;
        if (calls === 1) {
          return new HttpResponse(null, {
            status: 429,
            headers: { 'Retry-After': '3' },
          });
        }
        return HttpResponse.json({ issueLinkTypes: [] });
      }),
    );

    const { client, waits } = withSleep();
    expect(await client.listLinkTypes()).toEqual([]);
    expect(calls).toBe(2);
    expect(waits).toEqual([3000]);
  });

  it('caps excessive Retry-After values at ten seconds', async () => {
    let calls = 0;
    server.use(
      http.get('https://example.atlassian.net/rest/api/3/issueLinkType', () => {
        calls += 1;
        if (calls === 1) {
          return new HttpResponse(null, {
            status: 429,
            headers: { 'Retry-After': '9999' },
          });
        }
        return HttpResponse.json({ issueLinkTypes: [] });
      }),
    );

    const { client, waits } = withSleep();
    await client.listLinkTypes();
    expect(waits).toEqual([10000]);
  });

  it('falls back to a short backoff without a Retry-After header', async () => {
    let calls = 0;
    server.use(
      http.get('https://example.atlassian.net/rest/api/3/issueLinkType', () => {
        calls += 1;
        if (calls <= 2) {
          return new HttpResponse(null, { status: 429 });
        }
        return HttpResponse.json({ issueLinkTypes: [] });
      }),
    );

    const { client, waits } = withSleep();
    await client.listLinkTypes();
    expect(calls).toBe(3);
    expect(waits).toEqual([1000, 2000]);
  });

  it('fails with a rate limit error after exhausting retries', async () => {
    let calls = 0;
    server.use(
      http.get('https://example.atlassian.net/rest/api/3/issueLinkType', () => {
        calls += 1;
        return new HttpResponse(null, {
          status: 429,
          headers: { 'Retry-After': '1' },
        });
      }),
    );

    const { client, waits } = withSleep();
    await expect(client.listLinkTypes()).rejects.toThrow(
      /Jira rate-limited the request after retries/,
    );
    expect(calls).toBe(3);
    expect(waits).toEqual([1000, 1000]);
  });

  it('does not retry other statuses', async () => {
    let calls = 0;
    server.use(
      http.get('https://example.atlassian.net/rest/api/3/issueLinkType', () => {
        calls += 1;
        return HttpResponse.json({ errorMessages: ['boom'] }, { status: 500 });
      }),
    );

    const { client, waits } = withSleep();
    await expect(client.listLinkTypes()).rejects.toThrow(/status 500/);
    expect(calls).toBe(1);
    expect(waits).toEqual([]);
  });
});

describe('JiraClient discovery caching', () => {
  const server = setupServer();
  registerMswTestHooks(server);

  const linkTypesHandler = (counter: { calls: number }) =>
    http.get('https://example.atlassian.net/rest/api/3/issueLinkType', () => {
      counter.calls += 1;
      return HttpResponse.json({
        issueLinkTypes: [
          {
            id: '1',
            name: 'Blocks',
            inward: 'is blocked by',
            outward: 'blocks',
          },
        ],
      });
    });

  it('serves repeated discovery reads from the cache within the TTL', async () => {
    const counter = { calls: 0 };
    server.use(linkTypesHandler(counter));

    const cache = new TtlCache(60_000);
    const client = new JiraClient(cloudConnection, { cache });

    await client.listLinkTypes();
    const second = await client.listLinkTypes();
    expect(counter.calls).toBe(1);
    expect(second[0].name).toBe('Blocks');
  });

  it('reuses the cache for link resolution', async () => {
    const counter = { calls: 0 };
    let linked = false;
    server.use(
      linkTypesHandler(counter),
      http.post('https://example.atlassian.net/rest/api/3/issueLink', () => {
        linked = true;
        return new HttpResponse(null, { status: 201 });
      }),
    );

    const cache = new TtlCache(60_000);
    const client = new JiraClient(cloudConnection, { cache });

    await client.listLinkTypes();
    await client.linkIssues('PROJ-1', 'PROJ-2', 'blocks');
    expect(counter.calls).toBe(1);
    expect(linked).toBe(true);
  });

  it('expires entries after the TTL', async () => {
    const counter = { calls: 0 };
    server.use(
      http.get('https://example.atlassian.net/rest/api/3/field', () => {
        counter.calls += 1;
        return HttpResponse.json([
          { id: 'summary', name: 'Summary', custom: false },
        ]);
      }),
    );

    let nowMs = 1_000_000;
    const cache = new TtlCache(60_000, () => nowMs);
    const client = new JiraClient(cloudConnection, { cache });

    await client.listFields();
    nowMs += 30_000;
    await client.listFields({ name: 'summary' });
    expect(counter.calls).toBe(1);

    nowMs += 60_000;
    await client.listFields();
    expect(counter.calls).toBe(2);
  });

  it('caches per host', async () => {
    const cloudCounter = { calls: 0 };
    const dcCounter = { calls: 0 };
    server.use(
      linkTypesHandler(cloudCounter),
      http.get('https://jira.example.com/rest/api/2/issueLinkType', () => {
        dcCounter.calls += 1;
        return HttpResponse.json({ issueLinkTypes: [] });
      }),
    );

    const cache = new TtlCache(60_000);
    await new JiraClient(cloudConnection, { cache }).listLinkTypes();
    await new JiraClient(datacenterConnection, { cache }).listLinkTypes();
    expect(cloudCounter.calls).toBe(1);
    expect(dcCounter.calls).toBe(1);
  });
});
