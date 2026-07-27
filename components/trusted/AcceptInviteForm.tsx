'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/shared/Button';
import { Input }  from '@/components/shared/Input';
import { acceptInvitation } from '@/app/actions/trusted';

export function AcceptInviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [name,    setName]    = useState('');
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Please enter your display name.'); return; }
    setLoading(true);
    setError(null);
    const res = await acceptInvitation(token, name.trim());
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    router.push('/trusted');
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Your display name"
        placeholder="Grandma Sue"
        value={name}
        onChange={e => setName(e.target.value)}
        required
      />

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Button type="submit" loading={loading} className="w-full">
        Accept & join
      </Button>

      <p className="text-xs text-center text-gray-400">
        By accepting you can view progress and send Golden Higgs to the children in this family.
      </p>
    </form>
  );
}
