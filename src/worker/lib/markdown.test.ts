import { describe, it, expect } from 'vitest';
import { markdownToHtml } from './markdown';

describe('markdownToHtml', () => {
  it('converts h1 heading', () => {
    expect(markdownToHtml('# Hello')).toContain('<h1>Hello</h1>');
  });

  it('converts h2 heading', () => {
    expect(markdownToHtml('## Section')).toContain('<h2>Section</h2>');
  });

  it('converts h6 heading', () => {
    expect(markdownToHtml('###### Tiny')).toContain('<h6>Tiny</h6>');
  });

  it('converts paragraph text', () => {
    expect(markdownToHtml('Hello world')).toContain('<p>Hello world</p>');
  });

  it('converts bold text', () => {
    expect(markdownToHtml('**bold**')).toContain('<strong>bold</strong>');
  });

  it('converts italic text', () => {
    expect(markdownToHtml('*italic*')).toContain('<em>italic</em>');
  });

  it('converts bold-italic text', () => {
    expect(markdownToHtml('***both***')).toContain('<strong><em>both</em></strong>');
  });

  it('converts inline code', () => {
    expect(markdownToHtml('`code`')).toContain('<code>code</code>');
  });

  it('converts link', () => {
    const result = markdownToHtml('[text](https://example.com)');
    expect(result).toContain('<a href="https://example.com"');
    expect(result).toContain('text</a>');
  });

  it('converts unordered list', () => {
    const result = markdownToHtml('- item1\n- item2');
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>item1</li>');
    expect(result).toContain('<li>item2</li>');
    expect(result).toContain('</ul>');
  });

  it('converts ordered list', () => {
    const result = markdownToHtml('1. first\n2. second');
    expect(result).toContain('<ol>');
    expect(result).toContain('<li>first</li>');
    expect(result).toContain('<li>second</li>');
    expect(result).toContain('</ol>');
  });

  it('converts code block', () => {
    const result = markdownToHtml('```\nconst x = 1;\n```');
    expect(result).toContain('<pre><code>');
    expect(result).toContain('</code></pre>');
    expect(result).toContain('const x = 1;');
  });

  it('escapes HTML inside code blocks', () => {
    const result = markdownToHtml('```\n<script>alert(1)</script>\n```');
    expect(result).toContain('&lt;script&gt;');
    expect(result).not.toContain('<script>');
  });

  it('handles empty string', () => {
    expect(markdownToHtml('')).toBe('');
  });

  it('handles empty lines between paragraphs', () => {
    const result = markdownToHtml('para1\n\npara2');
    expect(result).toContain('<p>para1</p>');
    expect(result).toContain('<p>para2</p>');
  });

  it('closes list before heading', () => {
    const result = markdownToHtml('- item\n# Heading');
    expect(result).toContain('</ul>');
    expect(result).toContain('<h1>Heading</h1>');
  });

  it('handles asterisk-prefixed unordered list item', () => {
    const result = markdownToHtml('* item');
    expect(result).toContain('<li>item</li>');
  });
});
