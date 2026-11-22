import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(resolve(process.cwd(), '../home-ia-shared/src/styles.css'), 'utf8');

describe('UI motion accessibility contract', () => {
  it('bounds clip card media so intrinsic image dimensions cannot expand the grid', () => {
    expect(stylesheet).toMatch(/\.clip-card-media\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9;/s);
    expect(stylesheet).toMatch(
      /\.clip-thumbnail\s*\{[^}]*height:\s*100%;[^}]*object-fit:\s*cover;[^}]*width:\s*100%;/s,
    );
    expect(stylesheet).toMatch(
      /@media \(max-width: 575\.98px\)[\s\S]*?\.clip-card-grid\s*\{[^}]*grid-template-columns:\s*1fr;/,
    );
  });

  it('provides lightweight feedback for common controls and panel entry', () => {
    expect(stylesheet).toContain('.btn:hover:not(:disabled)');
    expect(stylesheet).toContain('.view-tab:hover:not([aria-current="page"])');
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
    expect(stylesheet).toContain('animation: var(--style-ambient-animation);');
    expect(stylesheet).toContain('animation: var(--style-light-animation);');
    expect(stylesheet).toContain('@keyframes light-drift');
    expect(stylesheet).toContain('color-mix(in srgb, var(--accent) 27%, transparent)');
    expect(stylesheet).toContain('color-mix(in srgb, var(--accent-strong) 22%, transparent)');
    expect(stylesheet).toContain('opacity: 0.7');
    expect(stylesheet).toContain('--style-brand-animation: brand-glow 7s ease-in-out');
    expect(stylesheet).toContain('0 0 34px color-mix(in srgb, var(--accent) 12%, transparent)');
  });

  it('keeps long dynamic labels inside cards, badges, buttons, and narrow layouts', () => {
    expect(stylesheet).toContain('.panel-card :is(h1, h2, h3, h4, h5, h6, p, span, strong, small, label)');
    expect(stylesheet).toContain('overflow-wrap: anywhere');
    expect(stylesheet).toContain('.health-pill');
    expect(stylesheet).toContain('grid-template-columns: 1.25rem minmax(0, 1fr) minmax(0, 135px)');
    expect(stylesheet).toContain('grid-template-columns: 1rem minmax(0, 1fr) minmax(0, 112px)');
    expect(stylesheet).toContain('.header-toolbar {\n    display: grid;\n    width: 100%;');
    expect(stylesheet).toMatch(/\.header-logout \{[\s\S]*?flex: 0 0 auto;[\s\S]*?white-space: nowrap;/);
    expect(stylesheet).toContain('.user-identity-name {');
    expect(stylesheet).toContain('overflow-wrap: anywhere;');
    expect(stylesheet).toContain('@media (max-width: 900px)');
    expect(stylesheet).toContain('.monitor-player-anchor {\n  scroll-margin-top: 0.75rem;');
    expect(stylesheet).toContain('calc(177.78vh - 24.9rem)');
    expect(stylesheet).toContain('calc(177.78dvh - 24.9rem)');
  });

  it('layers the header and its open theme menu above the dashboard navigation', () => {
    const headerLayer = Number(/\.app-header\s*\{[^}]*z-index:\s*(\d+)/s.exec(stylesheet)?.[1] ?? Number.NaN);
    const menuLayer = Number(
      /\.dashboard-menu\s*\{[^}]*z-index:\s*(\d+)/s.exec(stylesheet)?.[1] ?? Number.NaN,
    );
    expect(headerLayer).toBeGreaterThan(menuLayer);
    expect(stylesheet).toMatch(/\.theme-selector\[open\]\s*\{[^}]*z-index:\s*\d+;/);
    expect(stylesheet).toMatch(/\.theme-menu\s*\{[^}]*position:\s*absolute;[^}]*z-index:\s*\d+;/);
    expect(stylesheet).toContain('max-height: min(70vh, 34rem);');
    expect(stylesheet).toContain('overflow-y: auto;');
  });

  it('keeps dashboard submenus above the monitoring cards', () => {
    const menuLayer = Number(
      /\.dashboard-menu\s*\{[^}]*z-index:\s*(\d+)/s.exec(stylesheet)?.[1] ?? Number.NaN,
    );
    const submenuLayer = Number(
      /\.dashboard-submenu\s*\{[^}]*z-index:\s*(\d+)/s.exec(stylesheet)?.[1] ?? Number.NaN,
    );
    expect(submenuLayer).toBeGreaterThan(menuLayer);
  });

  it('stacks the open theme popup over the header contents', () => {
    const themeLayer = Number(
      /\.theme-selector\[open\]\s*\{[^}]*z-index:\s*(\d+)/s.exec(stylesheet)?.[1] ?? Number.NaN,
    );
    const menuLayer = Number(/\.theme-menu\s*\{[^}]*z-index:\s*(\d+)/s.exec(stylesheet)?.[1] ?? Number.NaN);
    expect(themeLayer).toBeGreaterThan(100);
    expect(menuLayer).toBeGreaterThan(themeLayer);
  });

  it('reduces animation and transition duration when requested by the OS', () => {
    expect(stylesheet).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation-duration: 0\.01ms/,
    );
    expect(stylesheet).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?body::before,[\s\S]*?body::after,[\s\S]*?\.brand-mark\s*\{\s*animation: none;/,
    );
    expect(stylesheet).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?transition-duration: 0\.01ms/,
    );
    expect(stylesheet).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?transform: none/);
  });
});

describe('Theme style contract', () => {
  const styles = [
    'classic',
    'modern',
    'rustic',
    'corporate',
    'minimal',
    'frutiger-aero',
    'neo-brutalism',
    'glassmorphism',
    'neumorphism',
    'retro-pixel',
    'claymorphism',
  ];

  const block = (style) =>
    new RegExp(`\\[data-theme-style="${style}"\\]\\s*\\{([^}]*)\\}`, 's').exec(stylesheet)?.[1] ?? '';

  const token = (style, name) => new RegExp(`${name}:\\s*([^;]+);`).exec(block(style))?.[1]?.trim();

  it('defines a distinct token block for every selectable style', () => {
    for (const style of styles) {
      expect(stylesheet).toContain(`[data-theme-style="${style}"]`);
      expect(token(style, '--style-radius-card')).toBeTruthy();
    }
  });

  it('makes the style families visibly different in shape, border and motion', () => {
    const motions = styles.map((style) => token(style, '--style-motion'));
    expect(new Set(motions).size).toBe(styles.length);
    expect(token('rustic', '--style-border-width')).toBe('2px');
    expect(token('corporate', '--style-border-width-strong')).toBe('2px');
    expect(token('minimal', '--style-radius-card')).toBe('0px');
    expect(token('modern', '--style-button-radius')).toBe('999px');
    expect(token('corporate', '--style-button-transform')).toBe('uppercase');
    expect(token('classic', '--style-hover-lift')).toBe('-1px');
    expect(token('minimal', '--style-hover-lift')).toBe('0px');
  });

  it('fully re-skins surfaces for the new Frutiger Aero and Neo Brutalism styles', () => {
    expect(token('neo-brutalism', '--style-radius-card')).toBe('0px');
    expect(token('neo-brutalism', '--style-border-width')).toBe('2px');
    expect(token('neo-brutalism', '--style-border-color')).toBe('var(--text-primary)');
    expect(token('neo-brutalism', '--style-surface-bg')).toBe('var(--panel-bg)');
    expect(token('neo-brutalism', '--style-panel-blur')).toBe('0px');
    expect(token('neo-brutalism', '--style-shadow-panel')).toContain('0.4rem 0.4rem 0 0');

    expect(token('frutiger-aero', '--style-radius-card')).toBe('1.75rem');
    expect(token('frutiger-aero', '--style-panel-blur')).toBe('26px');
    expect(token('frutiger-aero', '--style-surface-bg')).toContain('74%');
    expect(token('frutiger-aero', '--style-button-radius')).toBe('999px');
    expect(token('frutiger-aero', '--style-panel-texture')).toContain('linear-gradient');
  });

  it('re-skins surfaces for Glassmorphism, Neumorphism, Retro Pixel and Claymorphism', () => {
    expect(token('glassmorphism', '--style-surface-bg')).toContain('58%');
    expect(token('glassmorphism', '--style-panel-blur')).toBe('30px');
    expect(token('glassmorphism', '--style-radius-card')).toBe('1.5rem');

    expect(token('neumorphism', '--style-surface-bg')).toBe('var(--panel-bg)');
    expect(token('neumorphism', '--style-panel-blur')).toBe('0px');
    expect(token('neumorphism', '--style-shadow-panel')).toContain('-6px -6px');

    expect(token('retro-pixel', '--style-radius-card')).toBe('0px');
    expect(token('retro-pixel', '--style-font-body')).toContain('monospace');
    expect(token('retro-pixel', '--style-easing')).toContain('steps');
    expect(token('retro-pixel', '--style-border-color')).toBe('var(--text-primary)');

    expect(token('claymorphism', '--style-radius-card')).toBe('2rem');
    expect(token('claymorphism', '--style-surface-bg')).toBe('var(--panel-bg)');
    expect(token('claymorphism', '--style-shadow-panel')).toContain('inset 0 4px');
  });

  it('runs component form through shared tokens instead of per-style component copies', () => {
    expect(stylesheet).toContain('--style-border-style');
    expect(stylesheet).toContain('--style-radius-card');
    expect(stylesheet).toContain('--style-button-radius');
    expect(stylesheet).toContain('--style-motion');
    expect(stylesheet).toContain('--style-surface-bg');
    expect(stylesheet).toContain('--style-border-color');
    expect(stylesheet).toContain('background: var(--style-surface-bg);');
    expect(stylesheet).toContain('border: 1px solid var(--style-border-color);');
    expect(stylesheet).toMatch(/\.btn\s*\{[^}]*border-radius:\s*var\(--style-button-radius\);/s);
    expect(stylesheet).toMatch(/\.panel-card[\s\S]*?border-width:\s*var\(--style-border-width\);/);
  });

  it('keeps focus and reduced-motion guarantees for every style', () => {
    expect(stylesheet).toMatch(
      /:is\([^)]*\):focus-visible\s*\{[^}]*outline-width:\s*var\(--style-focus-width\);/s,
    );
    expect(stylesheet).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
