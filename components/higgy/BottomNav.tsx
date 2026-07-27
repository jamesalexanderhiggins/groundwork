'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/tasks',    label: 'Tasks',   icon: '✅' },
  { href: '/arcade',   label: 'Arcade',  icon: '🕹️' },
  { href: '/quests',   label: 'Quests',  icon: '⚔️' },
  { href: '/profile',  label: 'Profile', icon: '⭐' },
  { href: '/dashboard',label: 'Home',    icon: '🏠' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 bg-[var(--color-bg-card)] border-t border-[var(--color-accent)]/20 safe-area-bottom">
      <div className="flex max-w-lg mx-auto">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname.endsWith(href) || pathname.includes(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors min-h-[56px] justify-center ${
                active
                  ? 'text-[var(--color-primary)]'
                  : 'text-[var(--color-text)] opacity-40 hover:opacity-70'
              }`}
            >
              <span className="text-xl leading-none">{icon}</span>
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
