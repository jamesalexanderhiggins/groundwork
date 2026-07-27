import { RegisterForm } from '@/components/auth/RegisterForm';
import { getTranslations } from 'next-intl/server';

export default async function RegisterPage() {
  const t = await getTranslations('auth');
  return (
    <div>
      <h2 className="text-xl font-semibold text-[var(--color-text)] mb-6">{t('create_account')}</h2>
      <RegisterForm />
    </div>
  );
}
