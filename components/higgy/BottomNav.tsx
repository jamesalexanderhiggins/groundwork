'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/dashboard', label: 'Home',   icon: '🏠' },
  { href: '/tasks',     label: 'Tasks',  icon: '✅' },
  { href: '/arcade',    label: 'Arcade', icon: '🕹️' },
  { href: '/bulletin',  label: 'Bonus',  icon: '📌' },
  { href: '/quests',    label: 'Quests', icon: '⚔️' },
  { href: '/profile',   label: 'Me',     icon: '⭐' },
] as const;

// Strip the locale prefix so /en/tasks and /tasks both match.
function normalise(pathname: string) {
  return pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '') || '/';
}

export function BottomNav() {
  const path = normalise(usePathname());

  return (
    <nav
      aria-label="Main"
      className="fixed bottom-0 inset-x-0 z-20 bg-[var(--color-bg-card)] border-t border-[var(--color-border)] safe-area-bottom"
    >
      <div className="flex max-w-lg mx-auto">
        {NAV.map(({ href, label, icon }) => {
          // Exact match, or a route nested beneath it. The previous
          // endsWith() check made /parent/quests light up the child
          // Quests tab.
          const active = path === href || path.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`
                flex-1 flex flex-col items-center justify-center gap-0.5
                py-2.5 min-h-[56px] text-xs font-medium transition-colors
                ${active
                  ? 'text-[var(--color-primary)]'
                  : 'text-[var(--color-text)] opacity-45 hover:opacity-80'
                }
              `}
            >
              <span className="text-xl leading-none" aria-hidden="true">{icon}</span>
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
