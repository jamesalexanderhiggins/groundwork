import { LoginForm } from '@/components/auth/LoginForm';
import { getTranslations } from 'next-intl/server';

export default async function LoginPage() {
  const t = await getTranslations('auth');
  return (
    <div>
      <h2 className="text-xl font-semibold text-[var(--color-text)] mb-6">{t('welcome_back')}</h2>
      <LoginForm />
    </div>
  );
}
