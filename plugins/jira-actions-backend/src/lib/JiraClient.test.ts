import { registerMswTestHooks } from '@backstage/backend-test-utils';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { JiraClient } from './JiraClient';
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
      expect(projects).toEqual([{ id: '10000', key: 'PROJ', name: 'Project' }]);
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
        { id: '1', key: 'ONE', name: 'One' },
        { id: '2', key: 'TWO', name: 'Two' },
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
