import { InputError, NotAllowedError, NotFoundError } from '@backstage/errors';
import { JsonObject } from '@backstage/types';
import { adfToMarkdown, adfToText, RichTextFormat, toWriteValue } from './adf';
import { JiraConnection } from './connections';

/**
 * Work item fields shared between creation and update.
 */
export type JiraWorkItemFields = {
  summary?: string;
  description?: string | JsonObject;
  descriptionFormat?: RichTextFormat;
  labels?: string[];
  assignee?: string;
  issueType?: string;
};

export type JiraCreateWorkItemRequest = JiraWorkItemFields & {
  projectKey: string;
  issueType: string;
  summary: string;
  parentKey?: string;
};

/**
 * A single issue as read back from Jira, normalized to plain values.
 */
export type JiraWorkItem = {
  key: string;
  summary: string;
  status: string;
  issueType: string;
  url: string;
  description?: string | JsonObject;
  assignee?: string;
  labels?: string[];
  parentKey?: string;
  created?: string;
  updated?: string;
};

export type JiraSearchItem = {
  key: string;
  summary: string;
  status: string;
  issueType: string;
  url: string;
  assignee?: string;
};

export type JiraTransition = {
  id: string;
  name: string;
  toStatus?: string;
};

export type JiraProject = {
  id: string;
  key: string;
  name: string;
  url: string;
  description?: string;
};

export type JiraComment = {
  id: string;
  author?: string;
  body?: unknown;
  created?: string;
  updated?: string;
};

export type JiraIssueType = {
  id: string;
  name: string;
  subtask: boolean;
  description?: string;
};

type RawIssue = {
  key: string;
  fields?: {
    summary?: string;
    status?: { name?: string };
    issuetype?: { name?: string };
    assignee?: { accountId?: string; name?: string } | null;
    labels?: string[];
    description?: unknown;
    parent?: { key?: string };
    created?: string;
    updated?: string;
  };
};

const SEARCH_FIELDS = ['summary', 'status', 'issuetype', 'assignee'];

/**
 * A minimal Jira REST API client bound to a resolved Jira connection.
 * Uses API v3 for Jira Cloud and v2 for Jira Data Center.
 */
export class JiraClient {
  constructor(private readonly connection: JiraConnection) {}

  private get isCloud(): boolean {
    return this.connection.product === 'cloud';
  }

  private get apiBase(): string {
    const version = this.isCloud ? '3' : '2';
    return `${this.connection.apiBaseUrl.replace(
      /\/$/,
      '',
    )}/rest/api/${version}`;
  }

  private get authorizationHeader(): string {
    const auth = this.connection.auth[0];
    if (auth.method === 'basic') {
      const encoded = Buffer.from(`${auth.username}:${auth.apiToken}`).toString(
        'base64',
      );
      return `Basic ${encoded}`;
    }
    return `Bearer ${auth.token}`;
  }

  browseUrl(issueKey: string): string {
    return `https://${this.connection.host}/browse/${issueKey}`;
  }

  async createIssue(
    request: JiraCreateWorkItemRequest,
  ): Promise<{ id: string; key: string; url: string }> {
    const fields: JsonObject = {
      project: { key: request.projectKey },
      issuetype: { name: request.issueType },
      summary: request.summary,
      ...this.toOptionalFields(request),
    };
    if (request.parentKey !== undefined) {
      fields.parent = { key: request.parentKey };
    }

    const response = await this.request('POST', '/issue', { body: { fields } });
    if (!response.ok) {
      await this.throwForResponse(response, 'create Jira issue');
    }
    const body = (await response.json()) as { id: string; key: string };
    return { id: body.id, key: body.key, url: this.browseUrl(body.key) };
  }

  async updateIssue(
    issueKey: string,
    update: JiraWorkItemFields,
    labelEdits?: { add?: string[]; remove?: string[] },
  ): Promise<{ key: string; url: string }> {
    const fields: JsonObject = { ...this.toOptionalFields(update) };
    if (update.summary !== undefined) {
      fields.summary = update.summary;
    }

    const response = await this.request(
      'PUT',
      `/issue/${encodeURIComponent(issueKey)}`,
      {
        body: {
          fields,
          ...(labelEdits ? { update: this.toLabelUpdate(labelEdits) } : {}),
        },
      },
    );
    if (!response.ok) {
      await this.throwForResponse(response, `update Jira issue ${issueKey}`);
    }
    return { key: issueKey, url: this.browseUrl(issueKey) };
  }

  async getIssue(
    issueKey: string,
    options?: { descriptionFormat?: RichTextFormat },
  ): Promise<JiraWorkItem> {
    const response = await this.request(
      'GET',
      `/issue/${encodeURIComponent(issueKey)}`,
      {
        query: {
          fields: [
            ...SEARCH_FIELDS,
            'labels',
            'description',
            'parent',
            'created',
            'updated',
          ].join(','),
        },
      },
    );
    if (!response.ok) {
      await this.throwForResponse(response, `get Jira issue ${issueKey}`);
    }
    const issue = (await response.json()) as RawIssue;
    const fields = issue.fields ?? {};
    return {
      ...this.toSearchItem(issue),
      description: this.readRichText(
        fields.description,
        options?.descriptionFormat ?? 'markdown',
      ),
      labels:
        fields.labels && fields.labels.length > 0 ? fields.labels : undefined,
      parentKey: fields.parent?.key,
      created: fields.created,
      updated: fields.updated,
    };
  }

  async searchIssues(options: {
    jql: string;
    maxResults: number;
  }): Promise<{ items: JiraSearchItem[] }> {
    // Jira Cloud deprecated the classic /search endpoint in favor of the
    // token-paged /search/jql endpoint; Data Center still uses /search.
    const path = this.isCloud ? '/search/jql' : '/search';
    const response = await this.request('POST', path, {
      body: {
        jql: options.jql,
        maxResults: options.maxResults,
        fields: SEARCH_FIELDS,
      },
    });
    if (!response.ok) {
      await this.throwForResponse(response, 'search Jira issues');
    }
    const body = (await response.json()) as { issues?: RawIssue[] };
    return {
      items: (body.issues ?? []).map(issue => this.toSearchItem(issue)),
    };
  }

  async addComment(
    issueKey: string,
    commentBody: string | JsonObject,
    bodyFormat: RichTextFormat = 'markdown',
  ): Promise<{ key: string; commentId: string; url: string }> {
    const response = await this.request(
      'POST',
      `/issue/${encodeURIComponent(issueKey)}/comment`,
      {
        body: {
          body: toWriteValue(commentBody, bodyFormat, this.isCloud),
        },
      },
    );
    if (!response.ok) {
      await this.throwForResponse(
        response,
        `add comment to Jira issue ${issueKey}`,
      );
    }
    const body = (await response.json()) as { id: string | number };
    return {
      key: issueKey,
      commentId: String(body.id),
      url: this.browseUrl(issueKey),
    };
  }

  async listTransitions(issueKey: string): Promise<JiraTransition[]> {
    const response = await this.request(
      'GET',
      `/issue/${encodeURIComponent(issueKey)}/transitions`,
    );
    if (!response.ok) {
      await this.throwForResponse(
        response,
        `list transitions of Jira issue ${issueKey}`,
      );
    }
    const body = (await response.json()) as {
      transitions?: Array<{
        id: string | number;
        name?: string;
        to?: { name?: string };
      }>;
    };
    return (body.transitions ?? []).map(transition => ({
      id: String(transition.id),
      name: transition.name ?? '',
      toStatus: transition.to?.name,
    }));
  }

  async transitionIssue(issueKey: string, transitionId: string): Promise<void> {
    const response = await this.request(
      'POST',
      `/issue/${encodeURIComponent(issueKey)}/transitions`,
      { body: { transition: { id: transitionId } } },
    );
    if (!response.ok) {
      await this.throwForResponse(
        response,
        `transition Jira issue ${issueKey}`,
      );
    }
  }

  async getComments(
    issueKey: string,
    options: { maxResults: number },
  ): Promise<JiraComment[]> {
    const response = await this.request(
      'GET',
      `/issue/${encodeURIComponent(issueKey)}/comment`,
      { query: { maxResults: String(options.maxResults) } },
    );
    if (!response.ok) {
      await this.throwForResponse(
        response,
        `get comments of Jira issue ${issueKey}`,
      );
    }
    const body = (await response.json()) as {
      comments?: Array<{
        id: string | number;
        author?: { displayName?: string } | null;
        body?: unknown;
        created?: string;
        updated?: string;
      }>;
    };
    return (body.comments ?? []).map(comment => ({
      id: String(comment.id),
      author: comment.author?.displayName || undefined,
      body: comment.body,
      created: comment.created,
      updated: comment.updated,
    }));
  }

  /**
   * Adds and/or removes labels incrementally via Jira's update section,
   * never replacing the full list, and returns the resulting labels.
   */
  async editLabels(
    issueKey: string,
    edits: { add?: string[]; remove?: string[] },
  ): Promise<string[]> {
    const response = await this.request(
      'PUT',
      `/issue/${encodeURIComponent(issueKey)}`,
      { body: { update: this.toLabelUpdate(edits) } },
    );
    if (!response.ok) {
      await this.throwForResponse(
        response,
        `edit labels of Jira issue ${issueKey}`,
      );
    }

    const readBack = await this.request(
      'GET',
      `/issue/${encodeURIComponent(issueKey)}`,
      { query: { fields: 'labels' } },
    );
    if (!readBack.ok) {
      await this.throwForResponse(readBack, `get Jira issue ${issueKey}`);
    }
    const issue = (await readBack.json()) as RawIssue;
    return issue.fields?.labels ?? [];
  }

  async setParent(issueKey: string, parentKey: string): Promise<void> {
    const response = await this.request(
      'PUT',
      `/issue/${encodeURIComponent(issueKey)}`,
      { body: { fields: { parent: { key: parentKey } } } },
    );
    if (!response.ok) {
      await this.throwForResponse(
        response,
        `set parent of Jira issue ${issueKey}`,
      );
    }
  }

  async listProjects(options: {
    maxResults: number;
    name?: string;
  }): Promise<JiraProject[]> {
    type RawProject = {
      id: string | number;
      key: string;
      name: string;
      description?: string;
    };
    let projects: RawProject[];
    if (this.isCloud) {
      const response = await this.request('GET', '/project/search', {
        query: {
          maxResults: String(options.maxResults),
          expand: 'description',
          ...(options.name ? { query: options.name } : {}),
        },
      });
      if (!response.ok) {
        await this.throwForResponse(response, 'list Jira projects');
      }
      const body = (await response.json()) as { values?: RawProject[] };
      projects = body.values ?? [];
    } else {
      const response = await this.request('GET', '/project', {
        query: { expand: 'description' },
      });
      if (!response.ok) {
        await this.throwForResponse(response, 'list Jira projects');
      }
      projects = (await response.json()) as RawProject[];
    }
    // Uniform name/key filtering on both products; on Cloud the server-side
    // query only pre-narrows the result.
    const filter = options.name?.toLocaleLowerCase('en-US');
    if (filter) {
      projects = projects.filter(
        project =>
          project.name.toLocaleLowerCase('en-US').includes(filter) ||
          project.key.toLocaleLowerCase('en-US').includes(filter),
      );
    }
    return projects.slice(0, options.maxResults).map(project => ({
      id: String(project.id),
      key: project.key,
      name: project.name,
      url: this.browseUrl(project.key),
      description: project.description || undefined,
    }));
  }

  async getProjectIssueTypes(projectKey: string): Promise<JiraIssueType[]> {
    const response = await this.request(
      'GET',
      `/project/${encodeURIComponent(projectKey)}`,
    );
    if (!response.ok) {
      await this.throwForResponse(response, `get Jira project ${projectKey}`);
    }
    const body = (await response.json()) as {
      issueTypes?: Array<{
        id: string | number;
        name?: string;
        subtask?: boolean;
        description?: string;
      }>;
    };
    return (body.issueTypes ?? []).map(issueType => ({
      id: String(issueType.id),
      name: issueType.name ?? '',
      subtask: issueType.subtask ?? false,
      description: issueType.description || undefined,
    }));
  }

  /**
   * Renders a rich-text value read from Jira (a description or comment
   * body) in the requested format.
   */
  readRichText(
    description: unknown,
    format: RichTextFormat,
  ): string | JsonObject | undefined {
    if (format === 'adf') {
      if (typeof description === 'string') {
        return description;
      }
      return typeof description === 'object' && description !== null
        ? (description as JsonObject)
        : undefined;
    }
    return format === 'text'
      ? adfToText(description)
      : adfToMarkdown(description);
  }

  private toLabelUpdate(edits: {
    add?: string[];
    remove?: string[];
  }): JsonObject {
    return {
      labels: [
        ...(edits.add ?? []).map(label => ({ add: label })),
        ...(edits.remove ?? []).map(label => ({ remove: label })),
      ],
    };
  }

  private toSearchItem(issue: RawIssue): JiraSearchItem {
    const fields = issue.fields ?? {};
    const assignee = this.isCloud
      ? fields.assignee?.accountId
      : fields.assignee?.name;
    return {
      key: issue.key,
      summary: fields.summary ?? '',
      status: fields.status?.name ?? '',
      issueType: fields.issuetype?.name ?? '',
      url: this.browseUrl(issue.key),
      ...(assignee ? { assignee } : {}),
    };
  }

  private toOptionalFields(input: JiraWorkItemFields): JsonObject {
    const fields: JsonObject = {};
    if (input.issueType !== undefined) {
      fields.issuetype = { name: input.issueType };
    }
    if (input.description !== undefined) {
      fields.description = toWriteValue(
        input.description,
        input.descriptionFormat ?? 'markdown',
        this.isCloud,
      );
    }
    if (input.labels !== undefined) {
      fields.labels = input.labels;
    }
    if (input.assignee !== undefined) {
      fields.assignee = this.isCloud
        ? { id: input.assignee }
        : { name: input.assignee };
    }
    return fields;
  }

  private async request(
    method: string,
    path: string,
    options?: { body?: JsonObject; query?: Record<string, string> },
  ): Promise<Response> {
    const url = new URL(`${this.apiBase}${path}`);
    for (const [name, value] of Object.entries(options?.query ?? {})) {
      url.searchParams.set(name, value);
    }
    return fetch(url, {
      method,
      headers: {
        Authorization: this.authorizationHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      ...(options?.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
    });
  }

  private async throwForResponse(
    response: Response,
    action: string,
  ): Promise<never> {
    // Jira error payloads carry `errorMessages` and a field-keyed `errors`
    // object; both are safe to surface, credentials never appear in them.
    let details = '';
    try {
      const body = (await response.json()) as {
        errorMessages?: string[];
        errors?: Record<string, string>;
      };
      details = [
        ...(body.errorMessages ?? []),
        ...Object.entries(body.errors ?? {}).map(
          ([field, message]) => `${field}: ${message}`,
        ),
      ].join('; ');
    } catch {
      details = '';
    }

    const message = `Failed to ${action}, status ${response.status}${
      details ? `: ${details}` : ''
    }`;
    switch (response.status) {
      case 400:
        throw new InputError(message);
      case 401:
      case 403:
        throw new NotAllowedError(message);
      case 404:
        throw new NotFoundError(message);
      default:
        throw new Error(message);
    }
  }
}
