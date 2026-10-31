import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { catalogs, LOCALES, type Locale, type TranslationKey, type TranslationValues } from './messages';

const STORAGE_KEY = 'garage-watch.locale.v1';
interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, values?: TranslationValues) => string;
}
const I18nContext = createContext<I18nValue | undefined>(undefined);

function isLocale(value: unknown): value is Locale {
  return LOCALES.some((locale) => locale === value);
}

export function readSavedLocale(): Locale {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
    const browserLocales = navigator.languages?.length ? navigator.languages : [navigator.language];
    return browserLocales.some(
      (locale) => locale.toLowerCase() === 'en-us' || locale.toLowerCase().startsWith('en-'),
    )
      ? 'en-US'
      : 'pt-BR';
  } catch {
    return 'pt-BR';
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readSavedLocale);
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Language selection remains available when browser storage is disabled.
    }
  }, []);
  const t = useCallback(
    (key: TranslationKey, values: TranslationValues = {}) =>
      (catalogs[localeRef.current][key] ?? catalogs['pt-BR'][key] ?? key).replace(
        /\{([^}]+)\}/g,
        (token, name: string) => (Object.hasOwn(values, name) ? String(values[name]) : token),
      ),
    [],
  );
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = `Garagem IA · ${t('app.title')}`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', t('app.metaDescription'));
  }, [locale, t]);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}
