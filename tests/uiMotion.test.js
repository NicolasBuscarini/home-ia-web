import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

describe('UI motion accessibility contract', () => {
  it('provides lightweight feedback for common controls and panel entry', () => {
    expect(stylesheet).toContain('.btn:hover:not(:disabled)');
    expect(stylesheet).toContain('.view-tab:hover:not([aria-selected="true"])');
    expect(stylesheet).toContain('.theme-option:hover');
    expect(stylesheet).toContain('[role="tabpanel"]:not([hidden])');
    expect(stylesheet).toContain('@keyframes ui-enter');
  });

  it('limits decorative hover motion to hover-capable devices', () => {
    expect(stylesheet).toContain('@media (hover: hover) and (prefers-reduced-motion: no-preference)');
  });

  it('adds theme-driven ambient lighting and neon accents without a runtime dependency', () => {
    expect(stylesheet).toContain('body::before');
    expect(stylesheet).toContain('ellipse 42rem 34rem at 8% 6%');
    expect(stylesheet).toContain('animation: ambient-drift 28s ease-in-out');
    expect(stylesheet).toContain('animation: brand-glow 7s ease-in-out');
    expect(stylesheet).toContain('0 0 34px color-mix(in srgb, var(--accent) 12%, transparent)');
  });

  it('keeps long dynamic labels inside cards, badges, buttons, and narrow layouts', () => {
    expect(stylesheet).toContain('.panel-card :is(h1, h2, h3, h4, h5, h6, p, span, strong, small, label)');
    expect(stylesheet).toContain('overflow-wrap: anywhere');
    expect(stylesheet).toContain('.health-pill');
    expect(stylesheet).toContain('grid-template-columns: 1.25rem minmax(0, 1fr) minmax(0, 135px)');
    expect(stylesheet).toContain('grid-template-columns: 1rem minmax(0, 1fr) minmax(0, 112px)');
    expect(stylesheet).toContain('.header-actions {\n    width: 100%;\n    flex-wrap: wrap;');
  });

  it('reduces animation and transition duration when requested by the OS', () => {
    expect(stylesheet).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation-duration: 0\.01ms/,
    );
    expect(stylesheet).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?body::before,[\s\S]*?\.brand-mark\s*\{\s*animation: none;/,
    );
    expect(stylesheet).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?transition-duration: 0\.01ms/,
    );
    expect(stylesheet).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?transform: none/);
  });
});
