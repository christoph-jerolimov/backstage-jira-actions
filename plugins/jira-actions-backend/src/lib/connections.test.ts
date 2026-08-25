import { mockServices } from '@backstage/backend-test-utils';
import { JiraConnectionsReader } from './connections';

function readerFor(connections: unknown) {
  return JiraConnectionsReader.fromConfig(
    mockServices.rootConfig({ data: { connections } as any }),
  );
}

describe('JiraConnectionsReader', () => {
  const basicAuth = {
    method: 'basic',
    username: 'me@example.com',
    apiToken: 'secret-api-token',
  };
  const patAuth = { method: 'pat', token: 'secret-pat-token' };

  it('resolves a valid connection with defaults applied', () => {
    const reader = readerFor([
      { type: 'jira', host: 'example.atlassian.net', auth: [basicAuth] },
    ]);

    expect(reader.find()).toEqual({
      type: 'jira',
      title: 'Jira (example.atlassian.net)',
      host: 'example.atlassian.net',
      apiBaseUrl: 'https://example.atlassian.net',
      product: 'cloud',
      auth: [
        {
          method: 'basic',
          username: 'me@example.com',
          apiToken: 'secret-api-token',
        },
      ],
    });
  });

  it('keeps explicit title, apiBaseUrl and product', () => {
    const reader = readerFor([
      {
        type: 'jira',
        title: 'Team Jira',
        host: 'jira.internal.example.com',
        apiBaseUrl: 'https://jira.internal.example.com/jira',
        product: 'datacenter',
        auth: [patAuth],
      },
    ]);

    const connection = reader.find();
    expect(connection.title).toBe('Team Jira');
    expect(connection.apiBaseUrl).toBe(
      'https://jira.internal.example.com/jira',
    );
    expect(connection.product).toBe('datacenter');
    expect(connection.auth).toEqual([
      { method: 'pat', token: 'secret-pat-token' },
    ]);
  });

  it('ignores connections of other types without error', () => {
    const reader = readerFor([
      {
        type: 'github',
        host: 'github.com',
        auth: [{ method: 'token', token: 'gh-token' }],
      },
      { type: 'jira', host: 'example.atlassian.net', auth: [basicAuth] },
    ]);

    expect(reader.find().host).toBe('example.atlassian.net');
  });

  it('rejects a jira connection without host', () => {
    expect(() => readerFor([{ type: 'jira', auth: [basicAuth] }])).toThrow(
      /Invalid connection of type "jira" \(index 0\).*host/,
    );
  });

  it('rejects a jira connection without auth entries', () => {
    expect(() =>
      readerFor([{ type: 'jira', host: 'example.atlassian.net', auth: [] }]),
    ).toThrow(
      /Invalid connection of type "jira" \(host "example.atlassian.net"\).*auth/,
    );
  });

  it('rejects an unknown auth method without leaking credentials', () => {
    let error: Error | undefined;
    try {
      readerFor([
        {
          type: 'jira',
          host: 'example.atlassian.net',
          auth: [{ method: 'oauth', token: 'super-secret-value' }],
        },
      ]);
    } catch (e) {
      error = e as Error;
    }

    expect(error?.name).toBe('InputError');
    expect(error?.message).toMatch(/Invalid connection of type "jira"/);
    expect(error?.message).not.toContain('super-secret-value');
  });

  describe('find', () => {
    const twoConnections = [
      { type: 'jira', host: 'first.atlassian.net', auth: [basicAuth] },
      {
        type: 'jira',
        host: 'second.example.com',
        product: 'datacenter',
        auth: [patAuth],
      },
    ];

    it('returns the first configured connection without a query', () => {
      expect(readerFor(twoConnections).find().host).toBe('first.atlassian.net');
    });

    it('returns the connection matching a host query', () => {
      expect(
        readerFor(twoConnections).find({ host: 'second.example.com' }).host,
      ).toBe('second.example.com');
    });

    it('narrows auth entries to acceptable methods', () => {
      const reader = readerFor([
        {
          type: 'jira',
          host: 'first.atlassian.net',
          auth: [basicAuth, patAuth],
        },
      ]);
      expect(reader.find({ authMethods: ['pat'] }).auth).toEqual([
        { method: 'pat', token: 'secret-pat-token' },
      ]);
    });

    it('skips connections without an acceptable auth method', () => {
      const reader = readerFor(twoConnections);
      expect(reader.find({ authMethods: ['pat'] }).host).toBe(
        'second.example.com',
      );
    });

    it('fails when no jira connection is configured', () => {
      expect(() => readerFor([]).find()).toThrow(
        /No Jira connection is configured.*"connections" section/,
      );
      expect(() =>
        JiraConnectionsReader.fromConfig(
          mockServices.rootConfig({ data: {} }),
        ).find(),
      ).toThrow(/No Jira connection is configured/);
    });

    it('fails when no connection matches the query', () => {
      expect(() =>
        readerFor(twoConnections).find({ host: 'other.example.com' }),
      ).toThrow(/No Jira connection matches host "other.example.com"/);
    });
  });
});
