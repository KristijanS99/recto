import type { LucideIcon } from 'lucide-react';
import { Clock, Menu, Search, Settings, Tag, X } from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';

const NAV_ITEMS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Timeline', icon: Clock },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/tags', label: 'Tags', icon: Tag },
];

const BOTTOM_NAV_ITEMS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Mobile top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 md:hidden flex items-center justify-between h-14 px-4 bg-sand-50/80 dark:bg-sand-900/80 backdrop-blur-sm border-b border-sand-200 dark:border-sand-700">
        <button
          type="button"
          className="p-2 -ml-2 rounded-lg hover:bg-sand-200 dark:hover:bg-sand-800 transition-colors active:scale-[0.95]"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle navigation"
        >
          {sidebarOpen ? (
            <X className="w-5 h-5 text-sand-700 dark:text-sand-200" />
          ) : (
            <Menu className="w-5 h-5 text-sand-700 dark:text-sand-200" />
          )}
        </button>
        <img src="/logo.png" alt="Recto" className="h-8 w-8 rounded-lg" />
        <div className="w-9" />
      </header>

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
        className={`fixed md:sticky top-14 md:top-0 left-0 z-40 h-[calc(100vh-3.5rem)] md:h-screen w-56 bg-sand-50 dark:bg-sand-900 md:bg-sand-100 md:dark:bg-sand-800 border-r border-sand-200 dark:border-sand-700 p-6 flex flex-col transition-transform duration-200 ease-out md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Desktop logo */}
        <Link to="/" className="hidden md:flex items-center gap-3 mb-8">
          <img src="/logo.png" alt="Recto" className="h-9 w-9 rounded-lg" />
          <span className="text-lg font-semibold text-sand-800 dark:text-sand-100">Recto</span>
        </Link>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
            const active =
              location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                  active
                    ? 'bg-sand-200 dark:bg-sand-700 text-sand-900 dark:text-sand-50 font-medium'
                    : 'text-sand-600 dark:text-sand-400 hover:bg-sand-200/50 dark:hover:bg-sand-700/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <nav className="mt-auto flex flex-col gap-1">
          {BOTTOM_NAV_ITEMS.map(({ to, label, icon: Icon }) => {
            const active = location.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                  active
                    ? 'bg-sand-200 dark:bg-sand-700 text-sand-900 dark:text-sand-50 font-medium'
                    : 'text-sand-600 dark:text-sand-400 hover:bg-sand-200/50 dark:hover:bg-sand-700/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 p-6 md:p-10 pt-20 md:pt-10 max-w-3xl mx-auto w-full">
        <div className="animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
