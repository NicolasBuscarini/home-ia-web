import { THEMES, type ThemeId } from '../theme/theme';

interface ThemeSelectorProps {
  value: ThemeId;
  onChange: (theme: ThemeId) => void;
}

export function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  return (
    <div className="theme-selector">
      <label className="form-label visually-hidden" htmlFor="theme-select">
        Tema visual
      </label>
      <select
        className="form-select form-select-sm"
        id="theme-select"
        aria-label="Tema visual"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value as ThemeId)}
      >
        {THEMES.map((theme) => (
          <option key={theme.id} value={theme.id}>
            Tema: {theme.label}
          </option>
        ))}
      </select>
    </div>
  );
}
