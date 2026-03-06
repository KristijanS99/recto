import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';

const NAV_ITEMS = [
  { to: '/', label: 'Timeline', icon: '\u25A1' },
  { to: '/search', label: 'Search', icon: '\u25CB' },
  { to: '/tags', label: 'Tags', icon: '#' },
];

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen flex">
      {/* Mobile hamburger */}
      <button
        type="button"
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-lg bg-sand-200 dark:bg-sand-800"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle navigation"
      >
        <span className="block w-5 h-0.5 bg-sand-700 dark:bg-sand-200 mb-1" />
        <span className="block w-5 h-0.5 bg-sand-700 dark:bg-sand-200 mb-1" />
        <span className="block w-5 h-0.5 bg-sand-700 dark:bg-sand-200" />
      </button>

      {/* Overlay */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black/30 z-30 md:hidden cursor-default"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-40 h-screen w-56 bg-sand-100 dark:bg-sand-800 border-r border-sand-200 dark:border-sand-700 p-6 flex flex-col transition-transform md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <h1 className="text-xl font-semibold mb-8 text-sand-800 dark:text-sand-100">recto</h1>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ to, label, icon }) => {
            const active =
              location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-sand-200 dark:bg-sand-700 text-sand-900 dark:text-sand-50 font-medium'
                    : 'text-sand-600 dark:text-sand-400 hover:bg-sand-200/50 dark:hover:bg-sand-700/50'
                }`}
              >
                <span className="text-base">{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 p-6 md:p-10 max-w-3xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
