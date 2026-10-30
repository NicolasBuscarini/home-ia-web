export const THEMES = [
  { id: 'forest', label: 'Bosque', colorScheme: 'dark' },
  { id: 'graphite', label: 'Grafite', colorScheme: 'dark' },
  { id: 'ocean', label: 'Oceano', colorScheme: 'dark' },
  { id: 'light', label: 'Claro', colorScheme: 'light' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export const DEFAULT_THEME: ThemeId = 'forest';
const STORAGE_KEY = 'garage-watch.theme.v1';

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}

export function readSavedTheme(): ThemeId {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return isThemeId(saved) ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyTheme(themeId: ThemeId): void {
  const theme = THEMES.find((candidate) => candidate.id === themeId) ?? THEMES[0];
  document.documentElement.dataset.theme = theme.id;
  document.documentElement.dataset.bsTheme = theme.colorScheme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute(
      'content',
      themeId === 'light'
        ? '#f3f5f2'
        : themeId === 'ocean'
          ? '#101a29'
          : themeId === 'graphite'
            ? '#17191d'
            : '#101615',
    );
  try {
    window.localStorage.setItem(STORAGE_KEY, theme.id);
  } catch {
    // Tema ainda funciona nesta página quando armazenamento local está bloqueado.
  }
}
