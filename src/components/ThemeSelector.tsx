import type { TranslationKey } from 'home-ia-shared';
import { THEME_STYLES, THEMES, type ThemeId, type ThemeStyleId, useI18n } from 'home-ia-shared';
import { useRef } from 'react';

interface ThemeSelectorProps {
  value: ThemeId;
  onChange: (theme: ThemeId) => void;
  style: ThemeStyleId;
  onStyleChange: (style: ThemeStyleId) => void;
}

export function ThemeSelector({ value, onChange, style, onStyleChange }: ThemeSelectorProps) {
  const { t } = useI18n();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const selected = THEMES.find((theme) => theme.id === value) ?? THEMES[0];
  const selectedName = t(`theme.${selected.id}` as TranslationKey);
  const selectedStyle = THEME_STYLES.find((candidate) => candidate.id === style) ?? THEME_STYLES[0];
  const selectedStyleName = t(`theme.style.${selectedStyle.id}` as TranslationKey);

  return (
    <details className="theme-selector" ref={detailsRef}>
      <summary className="theme-trigger" aria-label={t('theme.current', { name: selectedName })}>
        <span className="theme-trigger-swatches" aria-hidden="true">
          <i style={{ backgroundColor: selected.preview.background }} />
          <i style={{ backgroundColor: selected.preview.accent }} />
          <i style={{ backgroundColor: selected.preview.panel }} />
        </span>
        <span className="theme-trigger-copy">
          <span className="theme-trigger-label">{t('theme.label')}</span>
          <strong>{selectedName}</strong>
          <span className="theme-trigger-style">{selectedStyleName}</span>
        </span>
        <span className="theme-trigger-chevron" aria-hidden="true">
          ⌄
        </span>
      </summary>
      <div className="theme-menu">
        <fieldset className="theme-menu-section">
          <legend className="theme-menu-title">{t('theme.label')}</legend>
          {THEMES.map((theme) => {
            const name = t(`theme.${theme.id}` as TranslationKey);
            const selectedTheme = theme.id === value;
            return (
              <button
                key={theme.id}
                className={`theme-option${selectedTheme ? ' selected' : ''}`}
                type="button"
                aria-pressed={selectedTheme}
                aria-label={t('theme.selectOption', { name })}
                onClick={() => {
                  onChange(theme.id);
                  if (detailsRef.current) detailsRef.current.open = false;
                }}
              >
                <span className="theme-option-preview" aria-hidden="true">
                  <span
                    className="theme-preview-card"
                    style={{ backgroundColor: theme.preview.background, borderColor: theme.preview.panel }}
                  >
                    <i style={{ backgroundColor: theme.preview.panel }} />
                    <i style={{ backgroundColor: theme.preview.text }} />
                    <i style={{ backgroundColor: theme.preview.accent }} />
                  </span>
                  <span className="theme-color-dots">
                    {[theme.preview.background, theme.preview.panel, theme.preview.accent].map((color) => (
                      <i key={color} style={{ backgroundColor: color }} />
                    ))}
                  </span>
                </span>
                <span className="theme-option-name">{name}</span>
                <span className="theme-option-check" aria-hidden="true">
                  {selectedTheme ? '✓' : ''}
                </span>
              </button>
            );
          })}
        </fieldset>
        <fieldset className="theme-menu-section">
          <legend className="theme-menu-title">{t('theme.style.label')}</legend>
          {THEME_STYLES.map((candidate) => {
            const name = t(`theme.style.${candidate.id}` as TranslationKey);
            const selectedStyleOption = candidate.id === style;
            return (
              <button
                key={candidate.id}
                className={`theme-option${selectedStyleOption ? ' selected' : ''}`}
                type="button"
                aria-pressed={selectedStyleOption}
                aria-label={t('theme.style.selectOption', { name })}
                onClick={() => {
                  onStyleChange(candidate.id);
                  if (detailsRef.current) detailsRef.current.open = false;
                }}
              >
                <span className="theme-option-preview" aria-hidden="true">
                  <span
                    className="theme-style-preview"
                    style={{
                      backgroundColor: candidate.preview.background,
                      borderColor: candidate.preview.accent,
                      borderRadius: candidate.preview.radius,
                    }}
                  >
                    {candidate.preview.label}
                  </span>
                </span>
                <span className="theme-option-name">{name}</span>
                <span className="theme-option-check" aria-hidden="true">
                  {selectedStyleOption ? '✓' : ''}
                </span>
              </button>
            );
          })}
        </fieldset>
      </div>
    </details>
  );
}
