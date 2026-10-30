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

  it('reduces animation and transition duration when requested by the OS', () => {
    expect(stylesheet).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation-duration: 0\.01ms/,
    );
    expect(stylesheet).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?transition-duration: 0\.01ms/,
    );
    expect(stylesheet).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?transform: none/);
  });
});
