import { InputError } from '@backstage/errors';
import { JsonObject } from '@backstage/types';
import { Lexer, Token, Tokens } from 'marked';

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

type AdfMark = { type: string; attrs?: JsonObject };

function textNode(text: string, marks: AdfMark[]): JsonObject {
  return marks.length > 0
    ? { type: 'text', text, marks: marks as unknown as JsonObject[] }
    : { type: 'text', text };
}

function paragraph(content: JsonObject[]): JsonObject {
  return { type: 'paragraph', content };
}

function tokenText(token: Token): string {
  if ('text' in token && typeof token.text === 'string') {
    return token.text;
  }
  return token.raw ?? '';
}

function inlineTokensToAdf(tokens: Token[], marks: AdfMark[]): JsonObject[] {
  const out: JsonObject[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case 'text': {
        const text = token as Tokens.Text;
        if (text.tokens && text.tokens.length > 0) {
          out.push(...inlineTokensToAdf(text.tokens, marks));
        } else if (text.text.length > 0) {
          out.push(textNode(text.text, marks));
        }
        break;
      }
      case 'escape':
        out.push(textNode((token as Tokens.Escape).text, marks));
        break;
      case 'strong':
        out.push(
          ...inlineTokensToAdf((token as Tokens.Strong).tokens, [
            ...marks,
            { type: 'strong' },
          ]),
        );
        break;
      case 'em':
        out.push(
          ...inlineTokensToAdf((token as Tokens.Em).tokens, [
            ...marks,
            { type: 'em' },
          ]),
        );
        break;
      case 'codespan':
        out.push(
          textNode((token as Tokens.Codespan).text, [
            ...marks,
            { type: 'code' },
          ]),
        );
        break;
      case 'link': {
        const link = token as Tokens.Link;
        out.push(
          ...inlineTokensToAdf(link.tokens, [
            ...marks,
            { type: 'link', attrs: { href: link.href } },
          ]),
        );
        break;
      }
      case 'br':
        out.push({ type: 'hardBreak' });
        break;
      default: {
        // Inline constructs outside the subset (images, inline html, ...)
        // degrade to their text content.
        const text = tokenText(token);
        if (text.length > 0) {
          out.push(textNode(text, marks));
        }
      }
    }
  }
  return out;
}

function listItemToAdf(item: Tokens.ListItem): JsonObject {
  const content: JsonObject[] = [];
  for (const token of item.tokens) {
    if (token.type === 'text') {
      const text = token as Tokens.Text;
      content.push(paragraph(inlineTokensToAdf(text.tokens ?? [text], [])));
    } else {
      content.push(...blockTokensToAdf([token]));
    }
  }
  return {
    type: 'listItem',
    content: content.length > 0 ? content : [paragraph([])],
  };
}

function blockTokensToAdf(tokens: Token[]): JsonObject[] {
  const out: JsonObject[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case 'space':
        break;
      case 'heading': {
        const heading = token as Tokens.Heading;
        out.push({
          type: 'heading',
          attrs: { level: heading.depth },
          content: inlineTokensToAdf(heading.tokens, []),
        });
        break;
      }
      case 'paragraph':
        out.push(
          paragraph(inlineTokensToAdf((token as Tokens.Paragraph).tokens, [])),
        );
        break;
      case 'code': {
        const code = token as Tokens.Code;
        out.push({
          type: 'codeBlock',
          ...(code.lang ? { attrs: { language: code.lang } } : {}),
          content:
            code.text.length > 0 ? [{ type: 'text', text: code.text }] : [],
        });
        break;
      }
      case 'blockquote':
        out.push({
          type: 'blockquote',
          content: blockTokensToAdf((token as Tokens.Blockquote).tokens),
        });
        break;
      case 'list': {
        const list = token as Tokens.List;
        out.push({
          type: list.ordered ? 'orderedList' : 'bulletList',
          content: list.items.map(item => listItemToAdf(item)),
        });
        break;
      }
      case 'hr':
        out.push({ type: 'rule' });
        break;
      default: {
        // Block constructs outside the subset (tables, html, ...) degrade
        // to their text content.
        const text = tokenText(token).trim();
        if (text.length > 0) {
          out.push(paragraph([textNode(text, [])]));
        }
      }
    }
  }
  return out;
}

/**
 * Converts a Markdown string to an Atlassian Document Format document for
 * the Jira Cloud REST API v3. Supports headings, paragraphs, bullet and
 * ordered lists, fenced code blocks (with language), blockquotes, hard
 * breaks, and inline bold/italic/code/links; constructs outside the subset
 * degrade to their plain text. Plain text yields simple paragraphs.
 */
export function markdownToAdf(markdown: string): JsonObject {
  const tokens = Lexer.lex(markdown, { gfm: true, breaks: true });
  return { type: 'doc', version: 1, content: blockTokensToAdf(tokens) };
}

function renderMarkdownInline(nodes: unknown[]): string {
  let out = '';
  for (const value of nodes) {
    const node = (value ?? {}) as AdfNode & { marks?: unknown };
    if (node.type === 'hardBreak') {
      out += '\n';
      continue;
    }
    if (typeof node.text === 'string') {
      let text = node.text;
      const marks = Array.isArray(node.marks) ? node.marks : [];
      const markTypes = new Map(
        marks
          .map(mark => (mark ?? {}) as { type?: string; attrs?: JsonObject })
          .filter(mark => typeof mark.type === 'string')
          .map(mark => [mark.type as string, mark]),
      );
      if (markTypes.has('code')) {
        text = `\`${text}\``;
      }
      if (markTypes.has('em')) {
        text = `*${text}*`;
      }
      if (markTypes.has('strong')) {
        text = `**${text}**`;
      }
      const link = markTypes.get('link');
      const href = (link?.attrs as { href?: unknown } | undefined)?.href;
      if (typeof href === 'string') {
        text = `[${text}](${href})`;
      }
      out += text;
      continue;
    }
    if (Array.isArray(node.content)) {
      out += renderMarkdownInline(node.content);
    }
  }
  return out;
}

function renderMarkdownBlocks(nodes: unknown[]): string {
  const blocks: string[] = [];
  for (const value of nodes) {
    const node = (value ?? {}) as AdfNode & {
      attrs?: { level?: unknown; language?: unknown };
    };
    const content = Array.isArray(node.content) ? node.content : [];
    switch (node.type) {
      case 'heading': {
        const level =
          typeof node.attrs?.level === 'number' ? node.attrs.level : 1;
        blocks.push(`${'#'.repeat(level)} ${renderMarkdownInline(content)}`);
        break;
      }
      case 'paragraph': {
        const text = renderMarkdownInline(content);
        if (text.length > 0) {
          blocks.push(text);
        }
        break;
      }
      case 'codeBlock': {
        const language =
          typeof node.attrs?.language === 'string' ? node.attrs.language : '';
        blocks.push(
          `\`\`\`${language}\n${renderMarkdownInline(content)}\n\`\`\``,
        );
        break;
      }
      case 'blockquote':
        blocks.push(
          renderMarkdownBlocks(content)
            .split('\n')
            .map(line => `> ${line}`.trimEnd())
            .join('\n'),
        );
        break;
      case 'bulletList':
      case 'orderedList': {
        const ordered = node.type === 'orderedList';
        const items = content.map((item, index) => {
          const marker = ordered ? `${index + 1}. ` : '- ';
          const itemNode = (item ?? {}) as AdfNode;
          const inner = renderMarkdownBlocks(
            Array.isArray(itemNode.content) ? itemNode.content : [],
          );
          return inner
            .split('\n')
            .map((line, lineIndex) =>
              lineIndex === 0
                ? `${marker}${line}`
                : `${' '.repeat(marker.length)}${line}`,
            )
            .join('\n');
        });
        blocks.push(items.join('\n'));
        break;
      }
      case 'rule':
        blocks.push('---');
        break;
      default: {
        // Nodes outside the subset (tables, media, mentions, ...) degrade
        // to their text content.
        const text = renderNodes([node]).trim();
        if (text.length > 0) {
          blocks.push(text);
        }
      }
    }
  }
  return blocks.join('\n\n');
}

/**
 * Renders a Jira rich-text field to Markdown: Atlassian Document Format
 * documents (Jira Cloud) are rendered to the supported Markdown subset with
 * nodes outside the subset degrading to their text content, plain strings
 * (Jira Data Center) pass through, and anything else yields `undefined`.
 */
export function adfToMarkdown(value: unknown): string | undefined {
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
  return renderMarkdownBlocks(doc.content);
}

/**
 * The formats a rich-text input (description, comment body) can be given in.
 */
export type RichTextFormat = 'markdown' | 'adf' | 'text';

/**
 * Parses and structurally validates an ADF document input, given either as
 * an object or as a JSON-encoded string.
 */
export function parseAdfInput(value: string | JsonObject): JsonObject {
  let doc: unknown = value;
  if (typeof value === 'string') {
    try {
      doc = JSON.parse(value);
    } catch (error) {
      throw new InputError(
        `Rich text input with format "adf" is not valid JSON: ${error}`,
      );
    }
  }
  const candidate = doc as { type?: unknown; content?: unknown } | null;
  if (
    typeof candidate !== 'object' ||
    candidate === null ||
    Array.isArray(candidate) ||
    candidate.type !== 'doc' ||
    !Array.isArray(candidate.content)
  ) {
    throw new InputError(
      'Rich text input with format "adf" must be an ADF document: an object with type "doc" and a content array',
    );
  }
  return candidate as JsonObject;
}

/**
 * Converts a rich-text input to the value written to Jira, according to the
 * selected format and the target product. On Jira Cloud, markdown is
 * converted to ADF, text becomes literal paragraphs, and adf documents are
 * validated and passed through; on Jira Data Center strings pass through
 * unchanged and adf is rejected, since Data Center has no ADF.
 */
export function toWriteValue(
  value: string | JsonObject,
  format: RichTextFormat,
  isCloud: boolean,
): string | JsonObject {
  if (format === 'adf') {
    if (!isCloud) {
      throw new InputError(
        'Rich text format "adf" requires a Jira Cloud connection',
      );
    }
    return parseAdfInput(value);
  }
  if (typeof value !== 'string') {
    throw new InputError(
      `Rich text format "${format}" requires a string value`,
    );
  }
  if (!isCloud) {
    return value;
  }
  return format === 'text' ? textToAdf(value) : markdownToAdf(value);
}
