import { isHexColor, normalizeHex, type ThemeColor, useI18n } from 'home-ia-shared';
import { type PointerEvent, useEffect, useId, useRef, useState } from 'react';
import { type ColorPosition, colorPosition, matrixPosition, positionColor } from './colorPicker';

interface ColorPickerProps {
  value: ThemeColor;
  onChange: (color: ThemeColor) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const { t } = useI18n();
  const id = useId();
  const saturationRef = useRef<HTMLInputElement>(null);
  const activePointer = useRef<number | null>(null);
  const [selection, setSelection] = useState(() => ({
    hex: value.primary,
    position: colorPosition(value.primary),
  }));
  const [draft, setDraft] = useState(value.primary);
  const [invalid, setInvalid] = useState(false);
  // Retain hue/saturation while selecting black or grey (RGB alone cannot retain them).
  const position = selection.hex === value.primary ? selection.position : colorPosition(value.primary);

  useEffect(() => {
    setDraft(value.primary);
    setInvalid(false);
  }, [value.primary]);

  function select(next: ColorPosition) {
    const hex = positionColor(next);
    setSelection({ hex, position: next });
    onChange({ ...value, primary: hex });
  }

  function point(event: PointerEvent<HTMLFieldSetElement>) {
    const next = matrixPosition(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
    if (next) select({ ...position, ...next });
  }

  function commitHex() {
    if (!isHexColor(draft.trim())) {
      setInvalid(true);
      return;
    }
    const primary = normalizeHex(draft.trim());
    setDraft(primary);
    setInvalid(false);
    onChange({ ...value, primary });
  }

  return (
    <div className="theme-color-picker">
      <fieldset
        className="theme-color-matrix"
        aria-label={t('theme.color.matrix')}
        aria-describedby={`${id}-help`}
        style={{ backgroundColor: positionColor({ hue: position.hue, saturation: 100, brightness: 100 }) }}
        onPointerDown={(event) => {
          if (event.button !== 0 || event.isPrimary === false) return;
          event.preventDefault();
          saturationRef.current?.focus({ preventScroll: true });
          activePointer.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          point(event);
        }}
        onPointerMove={(event) => {
          if (activePointer.current === event.pointerId) point(event);
        }}
        onPointerUp={(event) => {
          if (activePointer.current !== event.pointerId) return;
          point(event);
          activePointer.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          activePointer.current = null;
        }}
        onLostPointerCapture={() => {
          activePointer.current = null;
        }}
      >
        <span
          className="theme-color-cursor"
          aria-hidden="true"
          style={{
            left: `${position.saturation}%`,
            top: `${100 - position.brightness}%`,
            backgroundColor: value.primary,
          }}
        />
        <input
          ref={saturationRef}
          className="visually-hidden theme-color-axis"
          type="range"
          min={0}
          max={100}
          step="any"
          value={position.saturation}
          aria-label={t('theme.color.saturation')}
          aria-valuetext={`${Math.round(position.saturation)}%`}
          aria-describedby={`${id}-help`}
          onChange={(event) => select({ ...position, saturation: Number(event.currentTarget.value) })}
        />
        <input
          className="visually-hidden theme-color-axis"
          type="range"
          min={0}
          max={100}
          step="any"
          value={position.brightness}
          aria-label={t('theme.color.brightness')}
          aria-valuetext={`${Math.round(position.brightness)}%`}
          aria-describedby={`${id}-help`}
          onChange={(event) => select({ ...position, brightness: Number(event.currentTarget.value) })}
        />
      </fieldset>
      <div className="theme-color-values" aria-hidden="true">
        <span>
          {t('theme.color.saturation')}: {Math.round(position.saturation)}%
        </span>
        <span>
          {t('theme.color.brightness')}: {Math.round(position.brightness)}%
        </span>
      </div>
      <label className="theme-color-hue">
        <span>{t('theme.color.hue')}</span>
        <input
          type="range"
          min={0}
          max={359}
          value={position.hue}
          onChange={(event) => select({ ...position, hue: Number(event.currentTarget.value) })}
        />
      </label>
      <p className="theme-color-help" id={`${id}-help`}>
        {t('theme.color.matrixHelp')}
      </p>
      <div className="theme-color-preview-row">
        <output
          className="theme-color-preview"
          aria-label={t('theme.color.preview')}
          style={{ backgroundColor: value.primary }}
        >
          <span className="visually-hidden">{value.primary}</span>
        </output>
        <label className="theme-color-hex-field">
          <span>{t('theme.color.hex')}</span>
          <input
            className="form-control"
            type="text"
            value={draft}
            maxLength={7}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={invalid}
            aria-describedby={invalid ? `${id}-error` : undefined}
            onChange={(event) => {
              setDraft(event.currentTarget.value);
              setInvalid(false);
            }}
            onBlur={commitHex}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitHex();
              }
              if (event.key === 'Escape') {
                event.stopPropagation();
                setDraft(value.primary);
                setInvalid(false);
              }
            }}
          />
        </label>
      </div>
      {invalid && (
        <p className="theme-color-error" id={`${id}-error`} role="alert">
          {t('theme.color.invalidHex')}
        </p>
      )}
    </div>
  );
}
