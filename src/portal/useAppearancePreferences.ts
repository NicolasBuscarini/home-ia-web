import {
  applyAppearance,
  isHexColor,
  isLocale,
  isThemeStyleId,
  normalizeHex,
  presetColor,
  presetForColor,
  readSavedColor,
  readSavedThemeStyle,
  type ThemeColor,
  type ThemeStyleId,
  useI18n,
} from 'home-ia-shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getPortalPreferences, type PortalPreferenceUpdate, savePortalPreferences } from './portalApi';

function pendingState() {
  return {
    ready: false,
    running: false,
    acknowledged: '',
    desired: null as PortalPreferenceUpdate | null,
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
    controller: undefined as AbortController | undefined,
  };
}

/** Account state is hydrated before writes; one active request plus one latest snapshot. */
export function useAppearancePreferences() {
  const { locale, setLocale } = useI18n();
  const [color, updateColor] = useState<ThemeColor>(readSavedColor);
  const [themeStyle, updateStyle] = useState<ThemeStyleId>(readSavedThemeStyle);
  const [failed, setFailed] = useState(false);
  const sync = useRef(pendingState());

  const reset = useCallback(() => {
    clearTimeout(sync.current.timer);
    sync.current.controller?.abort();
    sync.current = pendingState();
    setFailed(false);
  }, []);

  useEffect(
    () => () => {
      clearTimeout(sync.current.timer);
      sync.current.controller?.abort();
      sync.current = pendingState();
    },
    [],
  );

  useEffect(() => applyAppearance(color, themeStyle), [color, themeStyle]);

  const flush = useCallback(async () => {
    const state = sync.current;
    if (!state.ready || state.running || !state.desired) return;
    state.running = true;
    try {
      while (sync.current === state && JSON.stringify(state.desired) !== state.acknowledged) {
        const snapshot = state.desired;
        state.controller = new AbortController();
        await savePortalPreferences(snapshot, state.controller.signal);
        if (sync.current !== state) return;
        state.acknowledged = JSON.stringify(snapshot);
      }
      if (sync.current === state) setFailed(false);
    } catch {
      if (sync.current === state) setFailed(true);
    } finally {
      state.running = false;
    }
  }, []);

  const schedule = useCallback(() => {
    clearTimeout(sync.current.timer);
    sync.current.timer = setTimeout(() => void flush(), 350);
  }, [flush]);

  const load = useCallback(async () => {
    reset();
    const state = sync.current;
    try {
      const preferences = await getPortalPreferences();
      if (sync.current !== state) return;
      const legacy = presetColor(preferences.themeId);
      const appearance = preferences.appearance ?? (legacy && { ...legacy, style: 'classic' });
      if (
        !appearance ||
        !isHexColor(appearance.primary) ||
        (appearance.mode !== 'dark' && appearance.mode !== 'light') ||
        !isThemeStyleId(appearance.style) ||
        !isLocale(preferences.languageTag)
      ) {
        throw new Error('Invalid portal preferences');
      }
      const selected = { ...appearance, primary: normalizeHex(appearance.primary) };
      state.desired = {
        themeId: preferences.themeId,
        languageTag: preferences.languageTag,
        appearance: selected,
      };
      state.acknowledged = JSON.stringify(state.desired);
      updateColor({ primary: selected.primary, mode: selected.mode });
      updateStyle(appearance.style);
      setLocale(preferences.languageTag);
      state.ready = true;
    } catch {
      if (sync.current === state) setFailed(true);
    }
  }, [reset, setLocale]);

  const setColor = useCallback(
    (selected: ThemeColor) => {
      updateColor(selected);
      const state = sync.current;
      if (!state.ready || !state.desired) return;
      state.desired = {
        ...state.desired,
        themeId: presetForColor(selected) ?? state.desired.themeId,
        appearance: { ...state.desired.appearance, ...selected },
      };
      schedule();
    },
    [schedule],
  );

  const setThemeStyle = useCallback(
    (style: ThemeStyleId) => {
      updateStyle(style);
      const state = sync.current;
      if (!state.ready || !state.desired) return;
      state.desired = { ...state.desired, appearance: { ...state.desired.appearance, style } };
      schedule();
    },
    [schedule],
  );

  useEffect(() => {
    const state = sync.current;
    if (!state.ready || !state.desired || state.desired.languageTag === locale) return;
    state.desired = { ...state.desired, languageTag: locale };
    schedule();
  }, [locale, schedule]);

  const retry = () => (sync.current.ready ? flush() : load());
  return { color, themeStyle, setColor, setThemeStyle, failed, load, reset, retry };
}
