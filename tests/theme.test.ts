import {
  applyAppearance,
  DEFAULT_THEME_COLOR,
  derivePalette,
  readSavedColor,
  readSavedThemeStyle,
  THEME_PRESETS,
} from 'home-ia-shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('appearance preference', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('style');
    document.documentElement.removeAttribute('data-bs-theme');
    document.documentElement.removeAttribute('data-theme-style');
    localStorage.clear();
    document.head.innerHTML = '<meta name="theme-color" content="#101615">';
  });

  it('uses the default for absent, malformed or invalid saved colors', () => {
    expect(readSavedColor()).toEqual(DEFAULT_THEME_COLOR);
    for (const invalid of ['{', 'null', '{"primary":"not-a-color","mode":"light"}']) {
      localStorage.setItem('garage-watch.color.v1', invalid);
      expect(readSavedColor()).toEqual(DEFAULT_THEME_COLOR);
    }
  });

  it('applies and persists custom RGB color, mode and style together', () => {
    const color = { primary: '#184a86', mode: 'light' } as const;
    applyAppearance(color, 'claymorphism');
    const palette = derivePalette(color.primary, color.mode, 'pastel');
    expect(document.documentElement).toHaveAttribute('data-bs-theme', 'light');
    expect(document.documentElement).toHaveAttribute('data-theme-style', 'claymorphism');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe(palette.variables['--accent']);
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      palette.variables['--app-bg'],
    );
    expect(readSavedColor()).toEqual(color);
    expect(readSavedThemeStyle()).toBe('claymorphism');
  });

  it('still applies when local storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => applyAppearance({ primary: '#123456', mode: 'dark' }, 'modern')).not.toThrow();
    expect(document.documentElement).toHaveAttribute('data-bs-theme', 'dark');
    expect(document.documentElement).toHaveAttribute('data-theme-style', 'modern');
  });

  it('recognizes and persists all eight presets with their mode', () => {
    for (const { primary, mode } of THEME_PRESETS) {
      const color = { primary, mode };
      applyAppearance(color, 'classic');
      expect(document.documentElement).toHaveAttribute('data-bs-theme', mode);
      expect(readSavedColor()).toEqual(color);
    }
  });
});
