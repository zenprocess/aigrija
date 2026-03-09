const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: '🏠', key: 'dashboard' },
  { href: '/admin/campanii', label: 'Campaigns', icon: '📋', key: 'campanii' },
  { href: '/admin/drafturi', label: 'Drafts', icon: '✏️', key: 'drafturi' },
  { href: '/admin/scrapere', label: 'Scrapers', icon: '🔍', key: 'scrapere' },
  { href: '/admin/ponderi', label: 'Weights', icon: '⚖️', key: 'ponderi' },
  { href: '/admin/traduceri', label: 'Translations', icon: '🌐', key: 'traduceri' },
  { href: '/admin/config', label: 'Config', icon: '⚙️', key: 'config' },
  { href: '/admin/rapoarte-traduceri', label: 'Translation Reports', icon: '🗒️', key: 'rapoarte-traduceri' },
  { href: '/admin/generare-continut', label: 'AI Generation', icon: '🤖', key: 'generare-continut' },
  { href: '/studio', label: 'Studio', icon: '🎨', key: 'studio', external: true },
] as const;

export function adminLayout(title: string, content: string, activeNav = '', adminEmail = ''): string {
  const navItems = NAV_ITEMS.map(item => {
    const isActive = item.key === activeNav;
    const activeClasses = isActive
      ? 'bg-blue-700 text-white'
      : 'text-blue-100 hover:bg-blue-700 hover:text-white';
    const target = 'external' in item && item.external ? ' target="_blank" rel="noopener noreferrer"' : '';
    const extIcon = 'external' in item && item.external ? '<span class="ml-auto text-xs opacity-60">↗</span>' : '';
    return `
      <a href="${item.href}"${target}
         class="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeClasses}">
        <span>${item.icon}</span>
        <span>${item.label}</span>
        ${extIcon}
      </a>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — ai-grija Admin</title>
  <link rel="stylesheet" href="/admin-assets/tailwind.css">
  <script src="https://unpkg.com/htmx.org@1.9.12"></script>
  <style>
    .severity-critical { color: #dc2626; }
    .severity-high     { color: #ea580c; }
    .severity-medium   { color: #ca8a04; }
    .severity-low      { color: #16a34a; }
    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.125rem 0.625rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 500;
    }
    .status-pending  { background: #fef9c3; color: #854d0e; }
    .status-approved { background: #dcfce7; color: #166534; }
    .status-rejected { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">

  <div class="fixed inset-y-0 left-0 w-56 bg-blue-800 flex flex-col z-10">
    <div class="flex items-center gap-2 px-4 py-4 border-b border-blue-700">
      <span class="text-xl">🛡️</span>
      <div>
        <div class="text-white font-semibold text-sm">ai-grija.ro</div>
        <div class="text-blue-300 text-xs">Admin Panel</div>
      </div>
    </div>
    <nav class="flex-1 p-3 space-y-1 overflow-y-auto">
      ${navItems}
    </nav>
    <div class="p-3 border-t border-blue-700">
      <div class="text-blue-300 text-xs truncate">${adminEmail || 'admin'}</div>
    </div>
  </div>

  <div class="ml-56 flex flex-col min-h-screen">
    <header class="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <h1 class="text-gray-800 font-semibold text-lg">${title}</h1>
      <div class="flex items-center gap-4 text-sm text-gray-500">
        <span>${adminEmail}</span>
        <a href="https://ai-grija.ro" target="_blank" class="text-blue-600 hover:underline">↗ Site</a>
      </div>
    </header>
    <main class="flex-1 p-6">
      ${content}
    </main>
  </div>

</body>
</html>`;
}
