'use client';

import { useState } from 'react';
import { Button } from '@/components/shared/Button';
import { Input }  from '@/components/shared/Input';
import { inviteTrustedAdult } from '@/app/actions/trusted';

export function InviteTrustedForm() {
  const [email,   setEmail]   = useState('');
  const [link,    setLink]    = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied,  setCopied]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setLink(null);
    setError(null);
    const res = await inviteTrustedAdult(email);
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    if (res.inviteUrl) setLink(res.inviteUrl);
  }

  async function handleCopy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          label=""
          type="email"
          placeholder="grandma@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <div className="pt-0 flex items-end">
          <Button type="submit" loading={loading}>Invite</Button>
        </div>
      </form>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {link && (
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg p-3">
          <p className="text-xs text-[var(--color-text)] opacity-60 mb-2">
            Invitation link (also emailed if configured):
          </p>
          <p className="text-xs font-mono break-all text-[var(--color-text)] mb-2">{link}</p>
          <Button onClick={handleCopy} className="text-sm py-1 px-3">
            {copied ? 'Copied!' : 'Copy link'}
          </Button>
        </div>
      )}
    </div>
  );
}
