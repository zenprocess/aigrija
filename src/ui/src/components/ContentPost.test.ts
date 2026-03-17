import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const filePath = join(process.cwd(), 'src/ui/src/components/ContentPost.jsx');
const source = readFileSync(filePath, 'utf-8');

describe('ContentPost XSS prevention', () => {
  it('imports DOMPurify', () => {
    expect(source).toContain("import DOMPurify from 'dompurify'");
  });

  it('imports html-react-parser', () => {
    expect(source).toContain("import parse from 'html-react-parser'");
  });

  it('sanitizes string body with DOMPurify before parsing', () => {
    expect(source).toContain('DOMPurify.sanitize(body)');
  });

  it('parses sanitized HTML through html-react-parser, not dangerouslySetInnerHTML', () => {
    expect(source).toContain('parse(DOMPurify.sanitize(body))');
    expect(source).not.toContain('dangerouslySetInnerHTML');
  });

  it('does not use dangerouslySetInnerHTML anywhere', () => {
    expect(source).not.toContain('dangerouslySetInnerHTML');
  });

  it('PortableTextRenderer uses React elements for inline marks, not dangerouslySetInnerHTML', () => {
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
