import type { TranslationKey } from 'home-ia-shared';
import { contrastRatio, THEME_STYLES, type ThemeColor, type ThemeStyleId, useI18n } from 'home-ia-shared';
import { useRef } from 'react';
import { ColorPicker } from './ColorPicker';

interface ThemeSelectorProps {
  value: ThemeColor;
  onChange: (color: ThemeColor) => void;
  style: ThemeStyleId;
  onStyleChange: (style: ThemeStyleId) => void;
}

export function ThemeSelector({ value, onChange, style, onStyleChange }: ThemeSelectorProps) {
  const { t } = useI18n();
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const selectedStyle = THEME_STYLES.find((candidate) => candidate.id === style) ?? THEME_STYLES[0];
  const selectedStyleName = t(`theme.style.${selectedStyle.id}` as TranslationKey);

  return (
    <details
      className="theme-selector"
      ref={detailsRef}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && detailsRef.current) {
          detailsRef.current.open = false;
          detailsRef.current.querySelector('summary')?.focus();
        }
      }}
    >
      <summary className="theme-trigger">
        <span className="theme-trigger-swatches" aria-hidden="true">
          <i style={{ backgroundColor: value.primary }} />
        </span>
        <span className="theme-trigger-copy">
          <span className="theme-trigger-label">{t('theme.color.label')}</span>
          <strong>{value.primary}</strong>
          <span className="theme-trigger-style">{selectedStyleName}</span>
        </span>
        <span className="theme-trigger-chevron" aria-hidden="true">
          ⌄
        </span>
      </summary>
      <div className="theme-menu">
        <fieldset className="theme-menu-section">
          <legend className="theme-menu-title">{t('theme.color.label')}</legend>
          <ColorPicker value={value} onChange={onChange} />
        </fieldset>
        <fieldset className="theme-menu-section">
          <legend className="theme-menu-title">{t('theme.mode.label')}</legend>
          <label className="theme-appearance-switch">
            <input
              className="visually-hidden"
              type="checkbox"
              role="switch"
              aria-label={t('theme.mode.darkToggle')}
              aria-checked={value.mode === 'dark'}
              checked={value.mode === 'dark'}
              onChange={(event) =>
                onChange({ ...value, mode: event.currentTarget.checked ? 'dark' : 'light' })
              }
            />
            <span className="theme-appearance-track" aria-hidden="true">
              <span>☀</span>
              <span>☾</span>
              <i className="theme-appearance-thumb">{value.mode === 'dark' ? '☾' : '☀'}</i>
            </span>
            <span>{t(value.mode === 'dark' ? 'theme.mode.dark' : 'theme.mode.light')}</span>
          </label>
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
                      color:
                        contrastRatio('#000000', candidate.preview.background) >=
                        contrastRatio('#ffffff', candidate.preview.background)
                          ? '#000000'
                          : '#ffffff',
                      borderColor: candidate.preview.accent,
                      borderRadius: candidate.preview.radius,
                      borderWidth: candidate.preview.borderWidth,
                      fontFamily: candidate.preview.fontFamily,
                      fontWeight: candidate.preview.fontWeight,
                      letterSpacing: candidate.preview.letterSpacing,
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
