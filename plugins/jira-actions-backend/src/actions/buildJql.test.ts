import { buildJql } from './searchWorkItems';

describe('buildJql', () => {
  it('builds a query from a single filter', () => {
    expect(buildJql({ projectKey: 'PROJ' })).toBe(
      'project = "PROJ" ORDER BY updated DESC',
    );
  });

  it('joins multiple filters with AND', () => {
    expect(
      buildJql({
        projectKey: 'PROJ',
        text: 'login bug',
        status: 'In Progress',
        issueType: 'Bug',
        assignee: 'jdoe',
      }),
    ).toBe(
      'project = "PROJ" AND text ~ "login bug" AND status = "In Progress" AND issuetype = "Bug" AND assignee = "jdoe" ORDER BY updated DESC',
    );
  });

  it('builds an IN clause for labels', () => {
    expect(buildJql({ labels: ['one', 'two'] })).toBe(
      'labels IN ("one", "two") ORDER BY updated DESC',
    );
  });

  it('escapes quotes and backslashes in values', () => {
    expect(buildJql({ text: 'say "hi" \\ bye' })).toBe(
      'text ~ "say \\"hi\\" \\\\ bye" ORDER BY updated DESC',
    );
  });

  it('rejects an empty filter set', () => {
    expect(() => buildJql({})).toThrow(
      /At least one search filter must be provided/,
    );
    expect(() => buildJql({ labels: [] })).toThrow(
      /At least one search filter must be provided/,
    );
  });
});
