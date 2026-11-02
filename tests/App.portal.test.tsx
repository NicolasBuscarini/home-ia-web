import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-bs-theme');
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const camera = {
  cameraId: 'garage-01',
  status: 'capturing',
  streamEpoch: 'epoch-1',
  liveUrl: '/api/v1/live/garage-01/index.m3u8',
};

function navigation(moduleIds: string[]) {
  return {
    residenceId: 'home',
    generatedAtUtc: '2026-11-02T12:00:00Z',
    modules: moduleIds.map((moduleId, index) => ({
      moduleId,
      displayNameKey: `modules.${moduleId}.name`,
      contractVersion: '1.0',
      menuGroup: index === 0 ? 'overview' : 'administration',
      menuOrder: index * 10,
      menuIcon: 'module',
      menuLabelKey: `modules.${moduleId}.menu`,
      route: `/modules/${moduleId}`,
    })),
  };
}

function preferences(overrides: Record<string, unknown> = {}) {
  return {
    themeId: 'forest',
    languageTag: 'pt-BR',
    isDefault: true,
    updatedAtUtc: null,
    supportedThemes: ['forest', 'graphite', 'ocean', 'light'],
    supportedLanguages: ['pt-BR', 'en-US'],
    ...overrides,
  };
}

function installFetch(
  options: {
    authenticated?: boolean;
    modules?: string[];
    portalPreferences?: ReturnType<typeof preferences>;
    writes?: Array<Record<string, unknown>>;
  } = {},
) {
  const { authenticated = true, modules = ['monitoring', 'administration'], writes = [] } = options;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const path = String(input);
    const method = init?.method ?? 'GET';
    if (path === '/api/v1/auth/session') return json({ authenticated });
    if (path === '/api/v1/auth/login') return new Response(null, { status: 204 });
    if (path === '/api/v1/auth/me') return json({ username: 'admin', role: 'Administrator' });
    if (path === '/api/v1/cameras') return json([camera]);
    if (path === '/api/v1/clients/presence') return json({ activeClients: 1 });
    if (path === '/api/v1/portal/navigation') return json(navigation(modules));
    if (path === '/api/v1/portal/preferences' && method === 'GET')
      return json(options.portalPreferences ?? preferences());
    if (path === '/api/v1/portal/preferences' && method === 'PUT') {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      writes.push(body);
      return json(preferences({ ...body, isDefault: false, updatedAtUtc: '2026-11-02T12:01:00Z' }));
    }
    throw new Error(`Unexpected request ${method} ${path}`);
  });
  return writes;
}

describe('portal shell integration', () => {
  it('uses portal navigation and preferences after login', async () => {
    installFetch({
      modules: ['monitoring'],
      portalPreferences: preferences({
        themeId: 'light',
        languageTag: 'en-US',
        isDefault: false,
        updatedAtUtc: '2026-11-02T12:00:00Z',
      }),
    });
    render(<App />);
    await screen.findByText('admin', { selector: '.user-identity-name' });
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'light'));
    expect(screen.getByRole('combobox', { name: /Language|Idioma/ })).toHaveValue('en-US');

    const menu = screen.getByRole('navigation', { name: /Main navigation|Navegação principal/ });
    expect(within(menu).getByRole('button', { name: /Monitoring|Monitoramento/ })).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: /Clips|Clipes/ })).toBeInTheDocument();
    expect(within(menu).queryByRole('button', { name: /System|Sistema/ })).not.toBeInTheDocument();
    expect(within(menu).queryByRole('button', { name: /Management|Gestão/ })).not.toBeInTheDocument();
  });

  it('persists theme and language changes through the portal API', async () => {
    localStorage.setItem('garage-watch.locale.v1', 'pt-BR');
    const writes = installFetch({ modules: ['monitoring', 'administration'] });
    render(<App />);
    const user = userEvent.setup();
    await screen.findByText('admin', { selector: '.user-identity-name' });

    const menu = screen.getByRole('navigation', { name: /Main navigation|Navegação principal/ });
    expect(within(menu).getByRole('button', { name: /System|Sistema/ })).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: /Management|Gestão/ })).toBeInTheDocument();

    await user.click(screen.getByText(/Bosque|Forest/, { selector: 'strong' }));
    await user.click(screen.getByRole('button', { name: /Use Claro theme|Usar o tema Claro/ }));
    await waitFor(() => expect(writes.some((body) => body.themeId === 'light')).toBe(true));

    fireEvent.change(document.getElementById('language-select') as HTMLSelectElement, {
      target: { value: 'en-US' },
    });
    await waitFor(() => expect(writes.some((body) => body.languageTag === 'en-US')).toBe(true));
  });
});
