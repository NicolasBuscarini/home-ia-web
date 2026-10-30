import { useI18n } from '../../i18n/i18n';

export function UserLanding() {
  const { t } = useI18n();
  return (
    <section className="panel-card user-landing mx-auto" aria-labelledby="user-landing-title" tabIndex={-1}>
      <span className="eyebrow">{t('auth.user.eyebrow')}</span>
      <h2 id="user-landing-title" className="h4 mt-2">
        {t('auth.user.title')}
      </h2>
      <p>{t('auth.user.role', { role: t('role.user') })}</p>
      <p className="text-secondary mb-0">{t('auth.user.limits')}</p>
    </section>
  );
}
