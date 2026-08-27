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
  unassign?: boolean;
  issueType?: string;
  fixVersions?: string[];
  affectsVersions?: string[];
  components?: string[];
  customFields?: JsonObject;
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
  fixVersions?: string[];
  affectsVersions?: string[];
  components?: string[];
  links?: JiraIssueLink[];
  customFields?: JsonObject;
};

/**
 * An issue link as seen from one issue: the relation direction description
 * reads from that issue towards the linked key (e.g. "blocks PROJ-2").
 */
export type JiraIssueLink = {
  type: string;
  direction: string;
  key: string;
};

export type JiraUser = {
  id: string;
  displayName: string;
  email?: string;
  active: boolean;
};

export type JiraLinkType = {
  id: string;
  name: string;
  inward: string;
  outward: string;
};

export type JiraField = {
  id: string;
  name: string;
  custom: boolean;
  type?: string;
};

export type JiraWorklog = {
  id: string;
  author?: string;
  timeSpent?: string;
  timeSpentSeconds?: number;
  started?: string;
  comment?: unknown;
};

export type JiraBoard = {
  id: string;
  name: string;
  type?: string;
};

export type JiraSprint = {
  id: string;
  name: string;
  state?: string;
  startDate?: string;
  endDate?: string;
  goal?: string;
};

export type JiraVersion = {
  id: string;
  name: string;
  released: boolean;
  archived: boolean;
  startDate?: string;
  releaseDate?: string;
  description?: string;
};

export type JiraProjectComponent = {
  id: string;
  name: string;
  description?: string;
  lead?: string;
};

export type JiraSprintIssue = JiraSearchItem & {
  statusCategory?: string;
  assigneeName?: string;
};

export type JiraRemoteLink = {
  id: string;
  title: string;
  url: string;
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

type RawIssueLink = {
  type?: { name?: string; inward?: string; outward?: string };
  inwardIssue?: { key: string };
  outwardIssue?: { key: string };
};

type RawIssue = {
  key: string;
  fields?: {
    summary?: string;
    status?: { name?: string; statusCategory?: { key?: string } };
    issuetype?: { name?: string };
    assignee?: {
      accountId?: string;
      name?: string;
      displayName?: string;
    } | null;
    labels?: string[];
    description?: unknown;
    parent?: { key?: string };
    created?: string;
    updated?: string;
    issuelinks?: RawIssueLink[];
    fixVersions?: Array<{ name?: string }>;
    versions?: Array<{ name?: string }>;
    components?: Array<{ name?: string }>;
  } & Record<string, unknown>;
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

  private toCreateFields(request: JiraCreateWorkItemRequest): JsonObject {
    const fields: JsonObject = {
      project: { key: request.projectKey },
      issuetype: { name: request.issueType },
      summary: request.summary,
      ...this.toOptionalFields(request),
    };
    if (request.parentKey !== undefined) {
      fields.parent = { key: request.parentKey };
    }
    return fields;
  }

  async createIssue(
    request: JiraCreateWorkItemRequest,
  ): Promise<{ id: string; key: string; url: string }> {
    const fields = this.toCreateFields(request);

    const response = await this.request('POST', '/issue', { body: { fields } });
    if (!response.ok) {
      await this.throwForResponse(response, 'create Jira issue');
    }
    const body = (await response.json()) as { id: string; key: string };
    return { id: body.id, key: body.key, url: this.browseUrl(body.key) };
  }

  /**
   * Creates up to fifty issues in one bulk call. Jira's bulk endpoint is
   * not transactional: on partial failure the thrown error names the failed
   * entries and any issues that were created.
   */
  async createIssuesBulk(
    requests: JiraCreateWorkItemRequest[],
  ): Promise<Array<{ id: string; key: string; url: string }>> {
    const response = await this.request('POST', '/issue/bulk', {
      body: {
        issueUpdates: requests.map(request => ({
          fields: this.toCreateFields(request),
        })),
      },
    });
    if (!response.ok) {
      await this.throwForResponse(response, 'bulk-create Jira issues');
    }
    const body = (await response.json()) as {
      issues?: Array<{ id: string | number; key: string }>;
      errors?: Array<{
        failedElementNumber?: number;
        elementErrors?: {
          errorMessages?: string[];
          errors?: Record<string, string>;
        };
      }>;
    };
    const created = (body.issues ?? []).map(issue => ({
      id: String(issue.id),
      key: issue.key,
      url: this.browseUrl(issue.key),
    }));
    if (body.errors && body.errors.length > 0) {
      const details = body.errors
        .map(error => {
          const messages = [
            ...(error.elementErrors?.errorMessages ?? []),
            ...Object.entries(error.elementErrors?.errors ?? {}).map(
              ([field, message]) => `${field}: ${message}`,
            ),
          ].join('; ');
          return `entry ${error.failedElementNumber ?? '?'}: ${messages}`;
        })
        .join(' | ');
      const createdNote =
        created.length > 0
          ? `; created before the failure: ${created
              .map(issue => issue.key)
              .join(', ')}`
          : '';
      throw new InputError(
        `Failed to bulk-create Jira issues (${details})${createdNote}`,
      );
    }
    return created;
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
    options?: { descriptionFormat?: RichTextFormat; customFields?: string[] },
  ): Promise<JiraWorkItem> {
    const customFieldIds = options?.customFields ?? [];
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
            'issuelinks',
            'fixVersions',
            'versions',
            'components',
            ...customFieldIds,
          ].join(','),
        },
      },
    );
    if (!response.ok) {
      await this.throwForResponse(response, `get Jira issue ${issueKey}`);
    }
    const issue = (await response.json()) as RawIssue;
    const fields = issue.fields ?? {};
    const links = (fields.issuelinks ?? []).map(link => this.toIssueLink(link));
    const customFields: JsonObject = {};
    for (const id of customFieldIds) {
      if (fields[id] !== undefined) {
        customFields[id] = fields[id] as JsonObject[string];
      }
    }
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
      fixVersions: this.toNames(fields.fixVersions),
      affectsVersions: this.toNames(fields.versions),
      components: this.toNames(fields.components),
      links: links.length > 0 ? links : undefined,
      customFields: customFieldIds.length > 0 ? customFields : undefined,
    };
  }

  async searchIssues(options: {
    jql: string;
    maxResults: number;
    pageToken?: string;
  }): Promise<{ items: JiraSearchItem[]; nextPageToken?: string }> {
    // Jira Cloud deprecated the classic /search endpoint in favor of the
    // token-paged /search/jql endpoint; Data Center still uses /search,
    // which pages by startAt offsets (encoded as the opaque page token).
    if (this.isCloud) {
      const response = await this.request('POST', '/search/jql', {
        body: {
          jql: options.jql,
          maxResults: options.maxResults,
          fields: SEARCH_FIELDS,
          ...(options.pageToken !== undefined
            ? { nextPageToken: options.pageToken }
            : {}),
        },
      });
      if (!response.ok) {
        await this.throwForResponse(response, 'search Jira issues');
      }
      const body = (await response.json()) as {
        issues?: RawIssue[];
        nextPageToken?: string;
      };
      return {
        items: (body.issues ?? []).map(issue => this.toSearchItem(issue)),
        nextPageToken: body.nextPageToken || undefined,
      };
    }

    const startAt = this.parseOffsetToken(options.pageToken);
    const response = await this.request('POST', '/search', {
      body: {
        jql: options.jql,
        maxResults: options.maxResults,
        fields: SEARCH_FIELDS,
        startAt,
      },
    });
    if (!response.ok) {
      await this.throwForResponse(response, 'search Jira issues');
    }
    const body = (await response.json()) as {
      issues?: RawIssue[];
      total?: number;
    };
    const issues = body.issues ?? [];
    return {
      items: issues.map(issue => this.toSearchItem(issue)),
      nextPageToken: this.nextOffsetToken(startAt, issues.length, body.total),
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

  async updateComment(
    issueKey: string,
    commentId: string,
    commentBody: string | JsonObject,
    bodyFormat: RichTextFormat = 'markdown',
  ): Promise<void> {
    const response = await this.request(
      'PUT',
      `/issue/${encodeURIComponent(issueKey)}/comment/${encodeURIComponent(
        commentId,
      )}`,
      { body: { body: toWriteValue(commentBody, bodyFormat, this.isCloud) } },
    );
    if (!response.ok) {
      await this.throwForResponse(
        response,
        `update comment ${commentId} on Jira issue ${issueKey}`,
      );
    }
  }

  async deleteComment(issueKey: string, commentId: string): Promise<void> {
    const response = await this.request(
      'DELETE',
      `/issue/${encodeURIComponent(issueKey)}/comment/${encodeURIComponent(
        commentId,
      )}`,
    );
    if (!response.ok) {
      await this.throwForResponse(
        response,
        `delete comment ${commentId} on Jira issue ${issueKey}`,
      );
    }
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
    options: { maxResults: number; pageToken?: string },
  ): Promise<{ comments: JiraComment[]; nextPageToken?: string }> {
    const startAt = this.parseOffsetToken(options.pageToken);
    const response = await this.request(
      'GET',
      `/issue/${encodeURIComponent(issueKey)}/comment`,
      {
        query: {
          maxResults: String(options.maxResults),
          startAt: String(startAt),
        },
      },
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
      total?: number;
    };
    const comments = body.comments ?? [];
    return {
      comments: comments.map(comment => ({
        id: String(comment.id),
        author: comment.author?.displayName || undefined,
        body: comment.body,
        created: comment.created,
        updated: comment.updated,
      })),
      nextPageToken: this.nextOffsetToken(startAt, comments.length, body.total),
    };
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

  async listVersions(projectKey: string): Promise<JiraVersion[]> {
    const response = await this.request(
      'GET',
      `/project/${encodeURIComponent(projectKey)}/versions`,
    );
    if (!response.ok) {
      await this.throwForResponse(
        response,
        `list versions of Jira project ${projectKey}`,
      );
    }
    const body = (await response.json()) as Array<{
      id: string | number;
      name?: string;
      released?: boolean;
      archived?: boolean;
      startDate?: string;
      releaseDate?: string;
      description?: string;
    }>;
    return body.map(version => ({
      id: String(version.id),
      name: version.name ?? '',
      released: version.released ?? false,
      archived: version.archived ?? false,
      startDate: version.startDate,
      releaseDate: version.releaseDate,
      description: version.description || undefined,
    }));
  }

  async listComponents(projectKey: string): Promise<JiraProjectComponent[]> {
    const response = await this.request(
      'GET',
      `/project/${encodeURIComponent(projectKey)}/components`,
    );
    if (!response.ok) {
      await this.throwForResponse(
        response,
        `list components of Jira project ${projectKey}`,
      );
    }
    const body = (await response.json()) as Array<{
      id: string | number;
      name?: string;
      description?: string;
      lead?: { displayName?: string } | null;
    }>;
    return body.map(component => ({
      id: String(component.id),
      name: component.name ?? '',
      description: component.description || undefined,
      lead: component.lead?.displayName || undefined,
    }));
  }

  async createVersion(options: {
    projectKey: string;
    name: string;
    description?: string;
    startDate?: string;
    releaseDate?: string;
  }): Promise<{ id: string; name: string }> {
    // POST /version requires the numeric project id.
    const projectResponse = await this.request(
      'GET',
      `/project/${encodeURIComponent(options.projectKey)}`,
    );
    if (!projectResponse.ok) {
      await this.throwForResponse(
        projectResponse,
        `get Jira project ${options.projectKey}`,
      );
    }
    const project = (await projectResponse.json()) as { id: string | number };

    const response = await this.request('POST', '/version', {
      body: {
        projectId: Number(project.id),
        name: options.name,
        ...(options.description !== undefined
          ? { description: options.description }
          : {}),
        ...(options.startDate !== undefined
          ? { startDate: options.startDate }
          : {}),
        ...(options.releaseDate !== undefined
          ? { releaseDate: options.releaseDate }
          : {}),
      },
    });
    if (!response.ok) {
      await this.throwForResponse(
        response,
        `create version in Jira project ${options.projectKey}`,
      );
    }
    const body = (await response.json()) as {
      id: string | number;
      name?: string;
    };
    return { id: String(body.id), name: body.name ?? options.name };
  }

  async addRemoteLink(
    issueKey: string,
    link: { url: string; title: string },
  ): Promise<{ remoteLinkId: string }> {
    const response = await this.request(
      'POST',
      `/issue/${encodeURIComponent(issueKey)}/remotelink`,
      { body: { object: { url: link.url, title: link.title } } },
    );
    if (!response.ok) {
      await this.throwForResponse(
        response,
        `add remote link to Jira issue ${issueKey}`,
      );
    }
    const body = (await response.json()) as { id: string | number };
    return { remoteLinkId: String(body.id) };
  }

  async getRemoteLinks(issueKey: string): Promise<JiraRemoteLink[]> {
    const response = await this.request(
      'GET',
      `/issue/${encodeURIComponent(issueKey)}/remotelink`,
    );
    if (!response.ok) {
      await this.throwForResponse(
        response,
        `get remote links of Jira issue ${issueKey}`,
      );
    }
    const body = (await response.json()) as Array<{
      id: string | number;
      object?: { url?: string; title?: string };
    }>;
    return body.map(link => ({
      id: String(link.id),
      title: link.object?.title ?? '',
      url: link.object?.url ?? '',
    }));
  }

  async searchUsers(
    query: string,
    options: { maxResults: number },
  ): Promise<JiraUser[]> {
    // Cloud matches display names/emails via `query`; Data Center uses
    // `username` for the same fuzzy matching.
    const response = await this.request('GET', '/user/search', {
      query: {
        maxResults: String(options.maxResults),
        ...(this.isCloud ? { query } : { username: query }),
      },
    });
    if (!response.ok) {
      await this.throwForResponse(response, 'search Jira users');
    }
    const body = (await response.json()) as Array<{
      accountId?: string;
      name?: string;
      displayName?: string;
      emailAddress?: string;
      active?: boolean;
    }>;
    return body.map(user => ({
      id: (this.isCloud ? user.accountId : user.name) ?? '',
      displayName: user.displayName ?? '',
      email: user.emailAddress || undefined,
      active: user.active ?? true,
    }));
  }

  async listLinkTypes(): Promise<JiraLinkType[]> {
    const response = await this.request('GET', '/issueLinkType');
    if (!response.ok) {
      await this.throwForResponse(response, 'list Jira issue link types');
    }
    const body = (await response.json()) as {
      issueLinkTypes?: Array<{
        id: string | number;
        name?: string;
        inward?: string;
        outward?: string;
      }>;
    };
    return (body.issueLinkTypes ?? []).map(type => ({
      id: String(type.id),
      name: type.name ?? '',
      inward: type.inward ?? '',
      outward: type.outward ?? '',
    }));
  }

  /**
   * Links two issues, resolving the link type case-insensitively by name,
   * outward, or inward description. The outward issue is the subject of the
   * outward description ("A blocks B" means outward=A, inward=B), so a match
   * on the inward description swaps the direction.
   */
  async linkIssues(
    issueKey: string,
    targetKey: string,
    linkType: string,
  ): Promise<{ linkType: string }> {
    const types = await this.listLinkTypes();
    const wanted = linkType.toLocaleLowerCase('en-US');
    const match = types.find(
      type =>
        type.name.toLocaleLowerCase('en-US') === wanted ||
        type.outward.toLocaleLowerCase('en-US') === wanted ||
        type.inward.toLocaleLowerCase('en-US') === wanted,
    );
    if (!match) {
      const available = types
        .map(
          type =>
            `"${type.name}" (outward: "${type.outward}", inward: "${type.inward}")`,
        )
        .join(', ');
      throw new InputError(
        `Unknown Jira issue link type "${linkType}"; available types: ${available}`,
      );
    }
    const reversed = match.inward.toLocaleLowerCase('en-US') === wanted;
    const response = await this.request('POST', '/issueLink', {
      body: {
        type: { name: match.name },
        outwardIssue: { key: reversed ? targetKey : issueKey },
        inwardIssue: { key: reversed ? issueKey : targetKey },
      },
    });
    if (!response.ok) {
      await this.throwForResponse(
        response,
        `link Jira issues ${issueKey} and ${targetKey}`,
      );
    }
    return { linkType: match.name };
  }

  async listFields(options?: { name?: string }): Promise<JiraField[]> {
    const response = await this.request('GET', '/field');
    if (!response.ok) {
      await this.throwForResponse(response, 'list Jira fields');
    }
    const body = (await response.json()) as Array<{
      id: string;
      name?: string;
      custom?: boolean;
      schema?: { type?: string };
    }>;
    const filter = options?.name?.toLocaleLowerCase('en-US');
    return body
      .filter(
        field =>
          !filter ||
          field.id.toLocaleLowerCase('en-US').includes(filter) ||
          (field.name ?? '').toLocaleLowerCase('en-US').includes(filter),
      )
      .map(field => ({
        id: field.id,
        name: field.name ?? '',
        custom: field.custom ?? false,
        type: field.schema?.type,
      }));
  }

  async getWorklogs(
    issueKey: string,
    options: { maxResults: number },
  ): Promise<JiraWorklog[]> {
    const response = await this.request(
      'GET',
      `/issue/${encodeURIComponent(issueKey)}/worklog`,
      { query: { maxResults: String(options.maxResults) } },
    );
    if (!response.ok) {
      await this.throwForResponse(
        response,
        `get worklogs of Jira issue ${issueKey}`,
      );
    }
    const body = (await response.json()) as {
      worklogs?: Array<{
        id: string | number;
        author?: { displayName?: string } | null;
        timeSpent?: string;
        timeSpentSeconds?: number;
        started?: string;
        comment?: unknown;
      }>;
    };
    return (body.worklogs ?? []).map(worklog => ({
      id: String(worklog.id),
      author: worklog.author?.displayName || undefined,
      timeSpent: worklog.timeSpent,
      timeSpentSeconds: worklog.timeSpentSeconds,
      started: worklog.started,
      comment: worklog.comment,
    }));
  }

  async addWorklog(
    issueKey: string,
    entry: {
      timeSpent: string;
      started?: string;
      comment?: string | JsonObject;
      commentFormat?: RichTextFormat;
    },
  ): Promise<{ worklogId: string }> {
    const response = await this.request(
      'POST',
      `/issue/${encodeURIComponent(issueKey)}/worklog`,
      {
        body: {
          timeSpent: entry.timeSpent,
          ...(entry.started !== undefined ? { started: entry.started } : {}),
          ...(entry.comment !== undefined
            ? {
                comment: toWriteValue(
                  entry.comment,
                  entry.commentFormat ?? 'markdown',
                  this.isCloud,
                ),
              }
            : {}),
        },
      },
    );
    if (!response.ok) {
      await this.throwForResponse(
        response,
        `add worklog to Jira issue ${issueKey}`,
      );
    }
    const body = (await response.json()) as { id: string | number };
    return { worklogId: String(body.id) };
  }

  async addWatcher(issueKey: string, user: string): Promise<void> {
    // The watchers endpoint takes the bare user id as a JSON string body.
    const response = await this.request(
      'POST',
      `/issue/${encodeURIComponent(issueKey)}/watchers`,
      { body: user },
    );
    if (!response.ok) {
      await this.throwForResponse(
        response,
        `add watcher to Jira issue ${issueKey}`,
      );
    }
  }

  async removeWatcher(issueKey: string, user: string): Promise<void> {
    const response = await this.request(
      'DELETE',
      `/issue/${encodeURIComponent(issueKey)}/watchers`,
      { query: this.isCloud ? { accountId: user } : { username: user } },
    );
    if (!response.ok) {
      await this.throwForResponse(
        response,
        `remove watcher from Jira issue ${issueKey}`,
      );
    }
  }

  async deleteIssue(
    issueKey: string,
    options?: { deleteSubtasks?: boolean },
  ): Promise<void> {
    const response = await this.request(
      'DELETE',
      `/issue/${encodeURIComponent(issueKey)}`,
      {
        query: { deleteSubtasks: String(options?.deleteSubtasks ?? false) },
      },
    );
    if (!response.ok) {
      await this.throwForResponse(response, `delete Jira issue ${issueKey}`);
    }
  }

  async listBoards(options: {
    maxResults: number;
    name?: string;
    projectKey?: string;
  }): Promise<JiraBoard[]> {
    const response = await this.request('GET', '/board', {
      api: 'agile',
      query: {
        maxResults: String(options.maxResults),
        ...(options.name ? { name: options.name } : {}),
        ...(options.projectKey ? { projectKeyOrId: options.projectKey } : {}),
      },
    });
    if (!response.ok) {
      await this.throwForResponse(response, 'list Jira boards');
    }
    const body = (await response.json()) as {
      values?: Array<{ id: string | number; name?: string; type?: string }>;
    };
    return (body.values ?? []).map(board => ({
      id: String(board.id),
      name: board.name ?? '',
      type: board.type,
    }));
  }

  async listSprints(
    boardId: string,
    options: { maxResults: number; state?: string },
  ): Promise<JiraSprint[]> {
    const response = await this.request(
      'GET',
      `/board/${encodeURIComponent(boardId)}/sprint`,
      {
        api: 'agile',
        query: {
          maxResults: String(options.maxResults),
          ...(options.state ? { state: options.state } : {}),
        },
      },
    );
    if (!response.ok) {
      await this.throwForResponse(
        response,
        `list sprints of Jira board ${boardId}`,
      );
    }
    const body = (await response.json()) as {
      values?: Array<{
        id: string | number;
        name?: string;
        state?: string;
        startDate?: string;
        endDate?: string;
        goal?: string;
      }>;
    };
    return (body.values ?? []).map(sprint => ({
      id: String(sprint.id),
      name: sprint.name ?? '',
      state: sprint.state,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      goal: sprint.goal || undefined,
    }));
  }

  async createSprint(options: {
    boardId: string;
    name: string;
    startDate?: string;
    endDate?: string;
    goal?: string;
  }): Promise<JiraSprint> {
    const response = await this.request('POST', '/sprint', {
      api: 'agile',
      body: {
        originBoardId: Number(options.boardId),
        name: options.name,
        ...(options.startDate !== undefined
          ? { startDate: options.startDate }
          : {}),
        ...(options.endDate !== undefined ? { endDate: options.endDate } : {}),
        ...(options.goal !== undefined ? { goal: options.goal } : {}),
      },
    });
    if (!response.ok) {
      await this.throwForResponse(
        response,
        `create sprint on Jira board ${options.boardId}`,
      );
    }
    return this.toSprint((await response.json()) as JsonObject);
  }

  /**
   * Partially updates a sprint; `state` transitions ('active'/'closed')
   * start and complete the sprint, with Jira enforcing the lifecycle rules.
   */
  async updateSprint(
    sprintId: string,
    update: {
      name?: string;
      goal?: string;
      startDate?: string;
      endDate?: string;
      state?: 'active' | 'closed';
    },
  ): Promise<JiraSprint> {
    const body: JsonObject = {};
    for (const key of [
      'name',
      'goal',
      'startDate',
      'endDate',
      'state',
    ] as const) {
      if (update[key] !== undefined) {
        body[key] = update[key]!;
      }
    }
    const response = await this.request(
      'POST',
      `/sprint/${encodeURIComponent(sprintId)}`,
      { api: 'agile', body },
    );
    if (!response.ok) {
      await this.throwForResponse(response, `update Jira sprint ${sprintId}`);
    }
    return this.toSprint((await response.json()) as JsonObject);
  }

  private toSprint(body: JsonObject): JiraSprint {
    const sprint = body as {
      id: string | number;
      name?: string;
      state?: string;
      startDate?: string;
      endDate?: string;
      goal?: string;
    };
    return {
      id: String(sprint.id),
      name: sprint.name ?? '',
      state: sprint.state,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      goal: sprint.goal || undefined,
    };
  }

  async getSprint(sprintId: string): Promise<JiraSprint> {
    const response = await this.request(
      'GET',
      `/sprint/${encodeURIComponent(sprintId)}`,
      { api: 'agile' },
    );
    if (!response.ok) {
      await this.throwForResponse(response, `get Jira sprint ${sprintId}`);
    }
    const body = (await response.json()) as {
      id: string | number;
      name?: string;
      state?: string;
      startDate?: string;
      endDate?: string;
      goal?: string;
    };
    return {
      id: String(body.id),
      name: body.name ?? '',
      state: body.state,
      startDate: body.startDate,
      endDate: body.endDate,
      goal: body.goal || undefined,
    };
  }

  async listSprintIssues(
    sprintId: string,
    options: { maxResults: number; pageToken?: string },
  ): Promise<{ items: JiraSprintIssue[]; nextPageToken?: string }> {
    const startAt = this.parseOffsetToken(options.pageToken);
    const response = await this.request(
      'GET',
      `/sprint/${encodeURIComponent(sprintId)}/issue`,
      {
        api: 'agile',
        query: {
          maxResults: String(options.maxResults),
          startAt: String(startAt),
          fields: SEARCH_FIELDS.join(','),
        },
      },
    );
    if (!response.ok) {
      await this.throwForResponse(
        response,
        `list issues of Jira sprint ${sprintId}`,
      );
    }
    const body = (await response.json()) as {
      issues?: RawIssue[];
      total?: number;
    };
    const issues = body.issues ?? [];
    return {
      items: issues.map(issue => ({
        ...this.toSearchItem(issue),
        statusCategory: issue.fields?.status?.statusCategory?.key,
        assigneeName: issue.fields?.assignee?.displayName || undefined,
      })),
      nextPageToken: this.nextOffsetToken(startAt, issues.length, body.total),
    };
  }

  async moveToBacklog(issueKeys: string[]): Promise<void> {
    const response = await this.request('POST', '/backlog/issue', {
      api: 'agile',
      body: { issues: issueKeys },
    });
    if (!response.ok) {
      await this.throwForResponse(response, 'move Jira issues to the backlog');
    }
  }

  async moveToSprint(sprintId: string, issueKeys: string[]): Promise<void> {
    const response = await this.request(
      'POST',
      `/sprint/${encodeURIComponent(sprintId)}/issue`,
      { api: 'agile', body: { issues: issueKeys } },
    );
    if (!response.ok) {
      await this.throwForResponse(
        response,
        `move Jira issues to sprint ${sprintId}`,
      );
    }
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

  private toNames(entries?: Array<{ name?: string }>): string[] | undefined {
    const names = (entries ?? [])
      .map(entry => entry.name)
      .filter((name): name is string => Boolean(name));
    return names.length > 0 ? names : undefined;
  }

  private toIssueLink(link: RawIssueLink): JiraIssueLink {
    // The direction description reads from the issue the link was fetched
    // for: an outwardIssue entry means "this issue <outward> that key".
    const linked = link.outwardIssue ?? link.inwardIssue;
    return {
      type: link.type?.name ?? '',
      direction:
        (link.outwardIssue ? link.type?.outward : link.type?.inward) ?? '',
      key: linked?.key ?? '',
    };
  }

  private parseOffsetToken(token?: string): number {
    if (token === undefined) {
      return 0;
    }
    if (!/^\d+$/.test(token)) {
      throw new InputError(
        `Invalid pageToken "${token}"; pass the nextPageToken of a previous invocation`,
      );
    }
    return parseInt(token, 10);
  }

  private nextOffsetToken(
    startAt: number,
    returned: number,
    total?: number,
  ): string | undefined {
    const next = startAt + returned;
    return returned > 0 && total !== undefined && next < total
      ? String(next)
      : undefined;
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
    // Jira clears the assignee only with an explicit null.
    if (input.unassign) {
      fields.assignee = null;
    }
    // Versions and components are referenced by name; Jira resolves them
    // and rejects unknown names. "affectsVersions" maps to Jira's "versions".
    if (input.fixVersions !== undefined) {
      fields.fixVersions = input.fixVersions.map(name => ({ name }));
    }
    if (input.affectsVersions !== undefined) {
      fields.versions = input.affectsVersions.map(name => ({ name }));
    }
    if (input.components !== undefined) {
      fields.components = input.components.map(name => ({ name }));
    }
    // Custom field values are passed to Jira verbatim, keyed by field id;
    // spread last so an explicit custom value wins an id collision.
    if (input.customFields !== undefined) {
      Object.assign(fields, input.customFields);
    }
    return fields;
  }

  private get agileBase(): string {
    // The Agile API lives under the same unversioned path on both products.
    return `${this.connection.apiBaseUrl.replace(/\/$/, '')}/rest/agile/1.0`;
  }

  private async request(
    method: string,
    path: string,
    options?: {
      body?: JsonObject | string;
      query?: Record<string, string>;
      api?: 'core' | 'agile';
    },
  ): Promise<Response> {
    const base = options?.api === 'agile' ? this.agileBase : this.apiBase;
    const url = new URL(`${base}${path}`);
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
