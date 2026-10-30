import type { UserRole } from '../domain/platform';
import { useI18n } from '../i18n/i18n';
import { LOCALES, type Locale } from '../i18n/messages';
import type { ThemeId } from '../theme/theme';
import { ThemeSelector } from './ThemeSelector';

interface AppHeaderProps {
  role?: UserRole;
  activeClients?: string;
  theme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
  onLogout: () => void;
  busy?: boolean;
}

export function AppHeader({
  role,
  activeClients,
  theme,
  onThemeChange,
  onLogout,
  busy = false,
}: AppHeaderProps) {
  const { locale, setLocale, t } = useI18n();
  return (
    <header className="app-header d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 mb-lg-5">
      <div className="d-flex align-items-center gap-3">
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none">
            <title>Garagem IA</title>
            <path
              d="M4 14.2 16 5l12 9.2v12.3a1.5 1.5 0 0 1-1.5 1.5h-21A1.5 1.5 0 0 1 4 26.5V14.2Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M10 28v-8h12v8M10 14h.01M16 14h.01M22 14h.01"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <div>
          <p className="eyebrow mb-1">
            GARAGEM IA <span className="brand-separator">/</span> LOCAL
          </p>
          <h1 className="h3 mb-0">{t('app.title')}</h1>
        </div>
      </div>
      <div className="header-actions d-flex align-items-center justify-content-end gap-2">
        <label className="visually-hidden" htmlFor="language-select">
          {t('language.label')}
        </label>
        <select
          id="language-select"
          className="form-select form-select-sm"
          aria-label={t('language.label')}
          value={locale}
          onChange={(event) => setLocale(event.currentTarget.value as Locale)}
        >
          {LOCALES.map((option) => (
            <option key={option} value={option}>
              {t(`language.${option}`)}
            </option>
          ))}
        </select>
        <ThemeSelector value={theme} onChange={onThemeChange} />
        {activeClients !== undefined && (
          <span
            className="client-count"
            role="status"
            aria-label={t('header.clients.other', { count: activeClients })}
            aria-live="polite"
          >
            <span aria-hidden="true">●</span> {t('header.clients.other', { count: activeClients })}
          </span>
        )}
        {role && (
          <button
            className="btn btn-outline-light btn-sm px-3"
            type="button"
            onClick={onLogout}
            disabled={busy}
          >
            {busy ? t('header.logoutBusy') : t('header.logout')}
          </button>
        )}
      </div>
    </header>
  );
}
