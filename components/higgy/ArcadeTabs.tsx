'use client';

import { useState, useTransition } from 'react';
import { ScreenTimeSelector } from './ScreenTimeSelector';
import { buyPrivilege }       from '@/app/actions/arcade';
import { Button }             from '@/components/shared/Button';
import type { FamilyRates }   from '@/lib/economy';

interface Privilege {
  id:          string;
  title:       string;
  description: string | null;
  cost_large:  number;
  cost_small:  number;
  type:        string;
}

interface ArcadeTabsProps {
  profileId:    string;
  familyRates:  FamilyRates;
  largeName:    string;
  smallName:    string;
  todayCap:     number;
  minutesUsed:  number;
  privileges:   Privilege[];
}

export function ArcadeTabs(props: ArcadeTabsProps) {
  const [tab, setTab] = useState<'screen' | 'store'>('screen');
  const [pending, startTransition] = useTransition();
  const [bought,  setBought]       = useState<string | null>(null);
  const [error,   setError]        = useState('');

  function handleBuyPrivilege(id: string) {
    setError(''); setBought(null);
    startTransition(async () => {
      const result = await buyPrivilege(id, props.profileId);
      if ('error' in result && result.error) { setError(result.error); return; }
      setBought(id);
      setTimeout(() => setBought(null), 3000);
    });
  }

  return (
    <div>
      <div className="flex gap-1 p-1 bg-[var(--color-bg-card)] rounded-[var(--border-radius)] mb-6 shadow-sm">
        {(['screen', 'store'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-[calc(var(--border-radius)-2px)] text-sm font-semibold transition-all ${
              tab === t
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'text-[var(--color-text)] opacity-50 hover:opacity-80'
            }`}
          >
            {t === 'screen' ? '🕹️ Screen Time' : '🏪 Store'}
          </button>
        ))}
      </div>

      {tab === 'screen' && (
        <ScreenTimeSelector
          profileId={props.profileId}
          familyRates={props.familyRates}
          largeName={props.largeName}
          smallName={props.smallName}
          todayCap={props.todayCap}
          minutesUsed={props.minutesUsed}
        />
      )}

      {tab === 'store' && (
        <div className="flex flex-col gap-3">
          {props.privileges.length === 0 && (
            <p className="text-center py-10 opacity-50 text-[var(--color-text)]">
              No privileges set up yet. Ask a parent!
            </p>
          )}
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
          {props.privileges.map(priv => (
            <div
              key={priv.id}
              className="bg-[var(--color-bg-card)] rounded-[var(--border-radius)] p-4 shadow-sm flex items-center justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[var(--color-text)] truncate">{priv.title}</p>
                {priv.description && (
                  <p className="text-sm opacity-60 text-[var(--color-text)] mt-0.5 truncate">{priv.description}</p>
                )}
                <p className="text-sm font-medium text-[var(--color-primary)] mt-1">
                  {priv.cost_large > 0 && `${priv.cost_large} ${props.largeName} `}
                  {priv.cost_small > 0 && `${priv.cost_small} ${props.smallName}`}
                </p>
              </div>
              {bought === priv.id ? (
                <span className="text-green-600 font-semibold text-sm">✓ Done!</span>
              ) : (
                <Button
                  onClick={() => handleBuyPrivilege(priv.id)}
                  loading={pending}
                  className="flex-shrink-0 !px-4 !py-2 text-sm"
                >
                  Buy
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
