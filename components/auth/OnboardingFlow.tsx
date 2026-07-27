'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Button } from '@/components/shared/Button';
import { Input } from '@/components/shared/Input';

type Step = 'family' | 'economy' | 'profile' | 'done';

interface FamilyData {
  familyName:      string;
  bankName:        string;
  largeCoinName:   string;
  smallCoinName:   string;
  goldenCoinName:  string;
  displayName:     string;
}

const STEPS: Step[] = ['family', 'economy', 'profile', 'done'];

export function OnboardingFlow() {
  const t = useTranslations('onboarding');
  const tc = useTranslations('common');
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep]     = useState<Step>('family');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [data, setData]     = useState<FamilyData>({
    familyName:     '',
    bankName:       'Higgy Bank',
    largeCoinName:  'Higg',
    smallCoinName:  'Ginsey',
    goldenCoinName: 'Golden Higg',
    displayName:    '',
  });

  function update(field: keyof FamilyData, value: string) {
    setData(prev => ({ ...prev, [field]: value }));
  }

  async function handleFinish() {
    setLoading(true);
    setError('');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Session expired. Please sign in again.');
      setLoading(false);
      return;
    }

    const { data: family, error: familyErr } = await supabase
      .from('families')
      .insert({
        name:             data.familyName,
        bank_name:        data.bankName,
        large_coin_name:  data.largeCoinName,
        small_coin_name:  data.smallCoinName,
        golden_coin_name: data.goldenCoinName,
      })
      .select()
      .single();

    if (familyErr || !family) {
      setError(familyErr?.message ?? 'Failed to create family.');
      setLoading(false);
      return;
    }

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .insert({
        user_id:      user.id,
        family_id:    family.id,
        display_name: data.displayName,
        life_stage:   'adult',
        role:         'parent',
        locale:       navigator.language.split('-')[0] || 'en',
      })
      .select()
      .single();

    if (profileErr || !profile) {
      setError(profileErr?.message ?? 'Failed to create profile.');
      setLoading(false);
      return;
    }

    await supabase.from('family_members').insert({
      family_id:  family.id,
      user_id:    user.id,
      profile_id: profile.id,
      role:       'parent',
    });

    await supabase.rpc('seed_higgins_tasks', {
      p_family_id:  family.id,
      p_created_by: profile.id,
    });

    setLoading(false);
    setStep('done');
    setTimeout(() => router.push('/dashboard'), 1500);
  }

  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-[var(--color-text)]">{t('welcome')}</h2>
        <p className="text-sm opacity-60 mt-1 text-[var(--color-text)]">{t('lets_set_up')}</p>
      </div>

      <div className="flex gap-1 mb-2">
        {STEPS.filter(s => s !== 'done').map((s, i) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              i <= stepIndex - (step === 'done' ? 0 : 0) ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-accent)]/30'
            }`}
          />
        ))}
      </div>

      {error && (
        <div role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>
      )}

      {step === 'family' && (
        <div className="flex flex-col gap-4">
          <Input
            label={t('family_name')}
            placeholder={t('family_name_placeholder')}
            value={data.familyName}
            onChange={e => update('familyName', e.target.value)}
            required
          />
          <Input
            label={t('bank_name')}
            placeholder={t('bank_name_placeholder')}
            value={data.bankName}
            onChange={e => update('bankName', e.target.value)}
          />
          <p className="text-xs opacity-50 text-[var(--color-text)]">{t('bank_name_hint')}</p>
          <Button
            onClick={() => setStep('economy')}
            disabled={!data.familyName.trim()}
            className="w-full"
          >
            {tc('next')}
          </Button>
        </div>
      )}

      {step === 'economy' && (
        <div className="flex flex-col gap-4">
          <Input
            label={t('large_coin_name')}
            placeholder={t('large_coin_placeholder')}
            value={data.largeCoinName}
            onChange={e => update('largeCoinName', e.target.value)}
          />
          <Input
            label={t('small_coin_name')}
            placeholder={t('small_coin_placeholder')}
            value={data.smallCoinName}
            onChange={e => update('smallCoinName', e.target.value)}
          />
          <Input
            label={t('golden_coin_name')}
            placeholder={t('golden_coin_placeholder')}
            value={data.goldenCoinName}
            onChange={e => update('goldenCoinName', e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep('family')} className="flex-1">
              {tc('back')}
            </Button>
            <Button onClick={() => setStep('profile')} className="flex-1">
              {tc('next')}
            </Button>
          </div>
        </div>
      )}

      {step === 'profile' && (
        <div className="flex flex-col gap-4">
          <Input
            label={t('your_name')}
            placeholder={t('your_name_placeholder')}
            value={data.displayName}
            onChange={e => update('displayName', e.target.value)}
            required
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep('economy')} className="flex-1">
              {tc('back')}
            </Button>
            <Button
              onClick={handleFinish}
              loading={loading}
              disabled={!data.displayName.trim()}
              className="flex-1"
            >
              {tc('done')}
            </Button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="text-center py-6">
          <div className="text-5xl mb-4">🎉</div>
          <h3 className="text-lg font-semibold text-[var(--color-text)]">{t('setup_complete')}</h3>
          <p className="text-sm opacity-60 mt-1 text-[var(--color-text)]">{t('family_created')}</p>
        </div>
      )}
    </div>
  );
}
