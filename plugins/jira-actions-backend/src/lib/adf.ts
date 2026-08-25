import { JsonObject } from '@backstage/types';

/**
 * Wraps plain text into a minimal Atlassian Document Format document, as
 * required by the Jira Cloud REST API v3 for rich-text fields. Each line
 * becomes a paragraph; rich formatting is out of scope.
 */
export function textToAdf(text: string): JsonObject {
  return {
    type: 'doc',
    version: 1,
    content: text.split('\n').map(line => ({
      type: 'paragraph',
      content: line.length > 0 ? [{ type: 'text', text: line }] : [],
    })),
  };
}
