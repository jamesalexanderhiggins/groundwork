'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { seedTemplateItems } from '@/app/actions/life-items';
import { Button } from '@/components/shared/Button';

/**
 * Seeds a starter set of common household admin tasks.
 * The action existed from the start but was never reachable from the UI.
 */
export function SeedTemplatesButton({ profileId }: { profileId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const router = useRouter();

  function handleClick() {
    setError('');
    start(async () => {
      const result = await seedTemplateItems(profileId);
      if (result && 'error' in result && result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
          {error}
        </p>
      )}
      <Button variant="secondary" onClick={handleClick} loading={pending}>
        Start with common tasks
      </Button>
    </div>
  );
}
