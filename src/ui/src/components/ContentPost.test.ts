import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const filePath = join(process.cwd(), 'src/ui/src/components/ContentPost.jsx');
const source = readFileSync(filePath, 'utf-8');

describe('ContentPost XSS prevention', () => {
  it('imports DOMPurify', () => {
    expect(source).toContain("import DOMPurify from 'dompurify'");
  });

  it('sanitizes string body before rendering as HTML', () => {
    expect(source).toContain('DOMPurify.sanitize(body)');
  });

  it('does not render string body as raw unsanitized HTML', () => {
    // The only dangerouslySetInnerHTML usage should wrap DOMPurify.sanitize
    const rawHtmlPattern = /dangerouslySetInnerHTML=\{\{ __html: body \}\}/;
    expect(rawHtmlPattern.test(source)).toBe(false);
  });

  it('PortableTextRenderer uses React elements for inline marks, not dangerouslySetInnerHTML', () => {
    // The span used for inline block content must not use dangerouslySetInnerHTML
    expect(source).not.toContain('<span dangerouslySetInnerHTML');
  });

  it('renders strong marks as React elements', () => {
    expect(source).toContain('marks.includes(\'strong\')');
    expect(source).toContain('<strong>');
  });

  it('renders em marks as React elements', () => {
    expect(source).toContain('marks.includes(\'em\')');
    expect(source).toContain('<em>');
  });

  it('exports a default function ContentPost', () => {
    expect(source).toContain('export default function ContentPost');
  });
});
