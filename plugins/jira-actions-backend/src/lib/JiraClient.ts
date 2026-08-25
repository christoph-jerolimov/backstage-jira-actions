import { InputError, NotAllowedError, NotFoundError } from '@backstage/errors';
import { JsonObject } from '@backstage/types';
import { textToAdf } from './adf';
import { JiraConnection } from './connections';

/**
 * Work item fields shared between creation and update.
 */
export type JiraWorkItemFields = {
  summary?: string;
  description?: string;
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
 * A minimal Jira REST API client bound to a resolved Jira connection.
 * Uses API v3 for Jira Cloud and v2 for Jira Data Center.
 */
export class JiraClient {
  constructor(private readonly connection: JiraConnection) {}

  private get apiBase(): string {
    const version = this.connection.product === 'cloud' ? '3' : '2';
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

    const response = await this.request('POST', '/issue', { fields });
    if (!response.ok) {
      await this.throwForResponse(response, 'create Jira issue');
    }
    const body = (await response.json()) as { id: string; key: string };
    return { id: body.id, key: body.key, url: this.browseUrl(body.key) };
  }

  async updateIssue(
    issueKey: string,
    update: JiraWorkItemFields,
  ): Promise<{ key: string; url: string }> {
    const fields: JsonObject = { ...this.toOptionalFields(update) };
    if (update.summary !== undefined) {
      fields.summary = update.summary;
    }

    const response = await this.request(
      'PUT',
      `/issue/${encodeURIComponent(issueKey)}`,
      { fields },
    );
    if (!response.ok) {
      await this.throwForResponse(response, `update Jira issue ${issueKey}`);
    }
    return { key: issueKey, url: this.browseUrl(issueKey) };
  }

  private toOptionalFields(input: JiraWorkItemFields): JsonObject {
    const fields: JsonObject = {};
    if (input.issueType !== undefined) {
      fields.issuetype = { name: input.issueType };
    }
    if (input.description !== undefined) {
      fields.description =
        this.connection.product === 'cloud'
          ? textToAdf(input.description)
          : input.description;
    }
    if (input.labels !== undefined) {
      fields.labels = input.labels;
    }
    if (input.assignee !== undefined) {
      fields.assignee =
        this.connection.product === 'cloud'
          ? { id: input.assignee }
          : { name: input.assignee };
    }
    return fields;
  }

  private async request(
    method: string,
    path: string,
    body: JsonObject,
  ): Promise<Response> {
    return fetch(`${this.apiBase}${path}`, {
      method,
      headers: {
        Authorization: this.authorizationHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
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
