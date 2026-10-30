import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, DEFAULT_THEME, readSavedTheme } from '../src/theme/theme';

describe('theme preference', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-bs-theme');
    localStorage.clear();
    document.head.innerHTML = '<meta name="theme-color" content="#101615">';
  });

  it('uses the forest default for absent or invalid stored preferences', () => {
    expect(readSavedTheme()).toBe(DEFAULT_THEME);
    localStorage.setItem('garage-watch.theme.v1', 'not-a-theme');
    expect(readSavedTheme()).toBe(DEFAULT_THEME);
  });

  it('applies and persists a selected theme and its color scheme', () => {
    applyTheme('light');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(document.documentElement).toHaveAttribute('data-bs-theme', 'light');
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#f3f5f2');
    expect(readSavedTheme()).toBe('light');
  });

  it('still applies when local storage is blocked', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => applyTheme('ocean')).not.toThrow();
    expect(document.documentElement).toHaveAttribute('data-theme', 'ocean');
    setItem.mockRestore();
  });

  it('recognizes and persists every theme, including the added palettes', () => {
    for (const theme of [
      'forest',
      'graphite',
      'ocean',
      'light',
      'lavender',
      'sunset',
      'amber',
      'rose',
    ] as const) {
      applyTheme(theme);
      expect(document.documentElement).toHaveAttribute('data-theme', theme);
      expect(readSavedTheme()).toBe(theme);
    }
  });
});
