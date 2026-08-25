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

const BLOCK_NODE_TYPES = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'bulletList',
  'orderedList',
  'listItem',
  'panel',
  'rule',
  'table',
  'tableRow',
  'tableCell',
  'tableHeader',
  'mediaGroup',
  'mediaSingle',
]);

type AdfNode = {
  type?: unknown;
  text?: unknown;
  content?: unknown;
};

function renderNodes(nodes: unknown[]): string {
  let out = '';
  for (const value of nodes) {
    const node = (value ?? {}) as AdfNode;
    let text = '';
    if (typeof node.text === 'string') {
      text = node.text;
    } else if (node.type === 'hardBreak') {
      text = '\n';
    } else if (Array.isArray(node.content)) {
      text = renderNodes(node.content);
    }
    if (typeof node.type === 'string' && BLOCK_NODE_TYPES.has(node.type)) {
      out = out.length > 0 ? `${out}\n${text}` : text;
    } else {
      out += text;
    }
  }
  return out;
}

/**
 * Renders a Jira rich-text field to plain text: Atlassian Document Format
 * documents (Jira Cloud) have their text content extracted with block nodes
 * separated by newlines, plain strings (Jira Data Center) pass through, and
 * anything else yields `undefined`. Lossy by design — formatting, mentions,
 * and media are dropped.
 */
export function adfToText(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const doc = value as AdfNode;
  if (doc.type !== 'doc' || !Array.isArray(doc.content)) {
    return undefined;
  }
  return renderNodes(doc.content);
}
