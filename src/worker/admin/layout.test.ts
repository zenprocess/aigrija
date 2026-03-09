import { describe, it, expect } from 'vitest';
import { adminLayout } from './layout';

describe('adminLayout', () => {
  it('renders HTML with title', () => {
    const html = adminLayout('Test Title', '<p>content</p>');
    expect(html).toContain('Test Title');
    expect(html).toContain('<p>content</p>');
    expect(html).toContain('<!DOCTYPE html>');
  });

  it('highlights active nav item', () => {
    const html = adminLayout('Dashboard', '', 'dashboard');
    expect(html).toContain('bg-blue-700 text-white');
  });

  it('includes admin email', () => {
    const html = adminLayout('Test', '', '', 'admin@test.ro');
    expect(html).toContain('admin@test.ro');
  });

  it('renders all nav items', () => {
    const html = adminLayout('Test', '');
    expect(html).toContain('/admin');
    expect(html).toContain('/admin/campaigns');
    expect(html).toContain('/admin/drafts');
    expect(html).toContain('/admin/weights');
    expect(html).toContain('/admin/translations');
    expect(html).toContain('/admin/config');
  });

  it('marks Studio as external link', () => {
    const html = adminLayout('Test', '');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('/studio');
  });
});
