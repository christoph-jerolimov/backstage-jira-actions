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
              content: [{ type: 'text', text: 'First line' }],
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Second line' }],
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
});
