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

const monitoringAdminItems = [
  ['monitor', 'dashboard.menu.monitor'],
  ['clips', 'dashboard.menu.clips'],
  ['clip-settings', 'dashboard.menu.clipSettings'],
  ['health', 'dashboard.menu.health'],
  ['dependencies', 'dashboard.menu.dependencies'],
  ['capture', 'dashboard.menu.capture'],
  ['cameras', 'dashboard.menu.cameras'],
  ['people', 'dashboard.menu.people'],
].map(([itemId, labelKey], index) => ({ itemId, labelKey, sortOrder: (index + 1) * 10 }));

const administrationItems = [
  ['users', 'dashboard.menu.users'],
  ['profiles', 'dashboard.menu.profiles'],
  ['requests', 'dashboard.menu.accessRequests'],
].map(([itemId, labelKey], index) => ({ itemId, labelKey, sortOrder: (index + 1) * 10 }));

function navigation(
  moduleIds: string[],
  role: 'Administrator' | 'Viewer' = 'Administrator',
  items: Record<string, Array<{ itemId: string; labelKey: string; sortOrder: number }>> = {},
) {
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
      items:
        items[moduleId] ??
        (moduleId === 'monitoring'
          ? role === 'Administrator' && moduleIds.includes('administration')
            ? monitoringAdminItems
            : monitoringAdminItems.slice(0, 2)
          : moduleId === 'administration'
            ? administrationItems
            : []),
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
    role?: 'Administrator' | 'Viewer';
    items?: Record<string, Array<{ itemId: string; labelKey: string; sortOrder: number }>>;
    failNavigation?: boolean;
    portalPreferences?: ReturnType<typeof preferences>;
    writes?: Array<Record<string, unknown>>;
  } = {},
) {
  const {
    authenticated = true,
    modules = ['monitoring', 'administration'],
    role = 'Administrator',
    writes = [],
  } = options;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const path = String(input);
    const method = init?.method ?? 'GET';
    if (path === '/api/v1/auth/session') return json({ authenticated });
    if (path === '/api/v1/auth/login') return new Response(null, { status: 204 });
    if (path === '/api/v1/auth/me') return json({ username: 'admin', role, canMonitor: true });
    if (path === '/api/v1/cameras') return json([camera]);
    if (path === '/api/v1/clients/presence') return json({ activeClients: 1 });
    if (path === '/api/v1/portal/navigation') {
      if (options.failNavigation) return json({ error: 'unavailable' }, 503);
      return json(navigation(modules, role, options.items ?? {}));
    }
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

    const module = await screen.findByTestId('monitoring-module');
    expect(module).toHaveAttribute('data-module-ids', 'monitoring');
  });

  it('switches between the monitoring, access and systems modules', async () => {
    installFetch({ modules: ['monitoring', 'administration'] });
    render(<App />);
    const user = userEvent.setup();

    const monitoring = await screen.findByTestId('monitoring-module');
    expect(monitoring).toHaveAttribute('data-module-ids', 'monitoring,administration');

    await user.click(screen.getByRole('button', { name: /Access|Acessos/ }));
    expect(await screen.findByTestId('access-module')).toHaveAttribute(
      'data-module-ids',
      'monitoring,administration',
    );

    await user.click(screen.getByRole('button', { name: /Systems|Sistemas/ }));
    expect(await screen.findByTestId('systems-module')).toHaveAttribute(
      'data-module-ids',
      'monitoring,administration',
    );
  });

  it('navigates user-facing sections as sidebar submodules and closes the mobile drawer on selection', async () => {
    localStorage.setItem('garage-watch.locale.v1', 'pt-BR');
    installFetch({ modules: ['monitoring', 'administration'] });
    render(<App />);
    const user = userEvent.setup();
    const monitoring = await screen.findByTestId('monitoring-module');
    expect(monitoring).toHaveAttribute('data-active-view', 'monitor');

    const nav = screen.getByRole('navigation', { name: 'Módulos da plataforma' });
    const subnav = within(nav).getByRole('list', { name: 'Submódulos de Monitoramento' });
    expect(within(subnav).getByRole('button', { name: 'Monitoramento' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(subnav).getAllByRole('button')).toHaveLength(8);
    for (const label of [
      'Regras de clipe',
      'Saúde do sistema',
      'Dependências',
      'Captura e segmentos',
      'Câmeras',
      'Pessoas',
    ]) {
      expect(within(subnav).getByRole('button', { name: label })).toBeInTheDocument();
    }
    await user.click(within(subnav).getByRole('button', { name: 'Clipes' }));
    expect(screen.getByTestId('monitoring-module')).toHaveAttribute('data-active-view', 'clips');
    await user.click(within(subnav).getByRole('button', { name: 'Regras de clipe' }));
    expect(screen.getByTestId('monitoring-module')).toHaveAttribute('data-active-view', 'clip-settings');

    await user.click(within(nav).getByRole('button', { name: 'Acessos' }));
    const access = await screen.findByTestId('access-module');
    expect(access).toHaveAttribute('data-active-view', 'users');
    const accessNav = within(nav).getByRole('list', { name: 'Submódulos de Acessos' });
    await user.click(within(accessNav).getByRole('button', { name: 'Pedidos de acesso' }));
    expect(screen.getByTestId('access-module')).toHaveAttribute('data-active-view', 'requests');

    const menuButton = screen.getByRole('button', { name: 'Módulos da plataforma' });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    await user.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    expect(nav).toHaveClass('is-open');
    await user.click(within(nav).getByRole('button', { name: 'Sistemas' }));
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(nav).not.toHaveClass('is-open');
  });

  it('keeps administrative submodules out of the sidebar for viewers', async () => {
    localStorage.setItem('garage-watch.locale.v1', 'pt-BR');
    installFetch({ modules: ['monitoring'], role: 'Viewer' });
    render(<App />);
    await screen.findByTestId('monitoring-module');

    const nav = screen.getByRole('navigation', { name: 'Módulos da plataforma' });
    const subnav = within(nav).getByRole('list', { name: 'Submódulos de Monitoramento' });
    expect(within(subnav).getAllByRole('button')).toHaveLength(2);
    expect(within(subnav).getByRole('button', { name: 'Monitoramento' })).toBeInTheDocument();
    expect(within(subnav).getByRole('button', { name: 'Clipes' })).toBeInTheDocument();
    expect(within(subnav).queryByRole('button', { name: 'Pessoas' })).not.toBeInTheDocument();
    expect(within(subnav).queryByRole('button', { name: 'Regras de clipe' })).not.toBeInTheDocument();
  });

  it('renders submodules projected by the portal catalog instead of local defaults', async () => {
    localStorage.setItem('garage-watch.locale.v1', 'pt-BR');
    installFetch({
      modules: ['monitoring', 'administration'],
      items: {
        monitoring: [
          { itemId: 'monitor', labelKey: 'dashboard.menu.monitor', sortOrder: 10 },
          { itemId: 'cameras', labelKey: 'dashboard.menu.cameras', sortOrder: 20 },
        ],
        administration: [{ itemId: 'users', labelKey: 'dashboard.menu.users', sortOrder: 10 }],
      },
    });
    render(<App />);
    await screen.findByTestId('monitoring-module');

    const nav = screen.getByRole('navigation', { name: 'Módulos da plataforma' });
    const subnav = within(nav).getByRole('list', { name: 'Submódulos de Monitoramento' });
    expect(within(subnav).getAllByRole('button')).toHaveLength(2);
    expect(within(subnav).getByRole('button', { name: 'Câmeras' })).toBeInTheDocument();
    expect(within(subnav).queryByRole('button', { name: 'Clipes' })).not.toBeInTheDocument();
  });

  it('keeps local navigation usable when the portal projection is unavailable', async () => {
    localStorage.setItem('garage-watch.locale.v1', 'pt-BR');
    installFetch({ modules: ['monitoring', 'administration'], role: 'Administrator', failNavigation: true });
    render(<App />);
    await screen.findByTestId('monitoring-module');

    const nav = screen.getByRole('navigation', { name: 'Módulos da plataforma' });
    const subnav = within(nav).getByRole('list', { name: 'Submódulos de Monitoramento' });
    expect(within(subnav).getAllByRole('button')).toHaveLength(8);
  });

  it('collapses and expands the desktop module rail', async () => {
    installFetch({ modules: ['monitoring', 'administration'] });
    render(<App />);
    const user = userEvent.setup();
    await screen.findByTestId('monitoring-module');

    const shell = document.querySelector('.app-shell');
    expect(shell).not.toHaveClass('is-sidebar-collapsed');
    await user.click(screen.getByRole('button', { name: /Collapse module menu|Recolher menu de módulos/ }));
    expect(shell).toHaveClass('is-sidebar-collapsed');
    expect(localStorage.getItem('garage-watch.sidebar-collapsed.v1')).toBe('true');
    expect(
      screen.getByRole('button', { name: /Expand module menu|Expandir menu de módulos/ }),
    ).toBeInTheDocument();
  });

  it('opens the ActivityWatch module only when the portal navigation authorizes it', async () => {
    localStorage.setItem('garage-watch.locale.v1', 'pt-BR');
    installFetch({ modules: ['monitoring', 'activitywatch'] });
    render(<App />);
    const user = userEvent.setup();
    await screen.findByTestId('monitoring-module');

    const nav = screen.getByRole('navigation', { name: 'Módulos da plataforma' });
    await user.click(within(nav).getByRole('button', { name: 'Atividade' }));
    expect(await screen.findByTestId('activitywatch-module')).toHaveAttribute(
      'data-module-ids',
      'monitoring,activitywatch',
    );

    cleanup();
    vi.restoreAllMocks();
    installFetch({ modules: ['monitoring'] });
    render(<App />);
    await screen.findByTestId('monitoring-module');
    expect(screen.queryByRole('button', { name: 'Atividade' })).not.toBeInTheDocument();
  });

  it('persists theme and language changes through the portal API', async () => {
    localStorage.setItem('garage-watch.locale.v1', 'pt-BR');
    const writes = installFetch({ modules: ['monitoring', 'administration'] });
    render(<App />);
    const user = userEvent.setup();
    await screen.findByText('admin', { selector: '.user-identity-name' });

    const module = await screen.findByTestId('monitoring-module');
    expect(module).toHaveAttribute('data-module-ids', 'monitoring,administration');

    await user.click(screen.getByText(/Bosque|Forest/, { selector: 'strong' }));
    await user.click(screen.getByRole('button', { name: /Use Claro theme|Usar o tema Claro/ }));
    await waitFor(() => expect(writes.some((body) => body.themeId === 'light')).toBe(true));

    fireEvent.change(document.getElementById('language-select') as HTMLSelectElement, {
      target: { value: 'en-US' },
    });
    await waitFor(() => expect(writes.some((body) => body.languageTag === 'en-US')).toBe(true));
  });
});
