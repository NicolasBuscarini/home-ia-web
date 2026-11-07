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
  window.history.replaceState(null, '', '/');
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

const biometricsItems = (
  [
    ['enrollments', 'dashboard.menu.biometricEnrollments'],
    ['observations', 'dashboard.menu.biometricObservations'],
    ['calibration', 'dashboard.menu.biometricCalibration'],
    ['model', 'dashboard.menu.biometricModel'],
  ] as const
).map(([itemId, labelKey], index) => ({ itemId, labelKey, sortOrder: (index + 1) * 10 }));

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
    events?: Array<Record<string, unknown>>;
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
    if (path === '/api/v1/events') {
      options.events?.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
      return json({ publicId: 'EVT000000000001' }, 201);
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

  it('emits navigation events for the landing area and for module changes', async () => {
    const events: Array<Record<string, unknown>> = [];
    installFetch({ events });
    render(<App />);
    const user = userEvent.setup();

    await waitFor(() => expect(events).toHaveLength(1));
    expect(events[0]).toMatchObject({
      eventType: 'navigation.viewed',
      category: 'navigation',
      source: 'shell',
      emitter: 'browser',
      resource: { type: 'portal.module', publicId: 'monitoring.monitor' },
    });

    const nav = await screen.findByRole('navigation');
    await user.click(within(nav).getByRole('button', { name: /Systems|Sistemas/ }));

    await waitFor(() => expect(events).toHaveLength(2));
    expect(events[1]).toMatchObject({
      eventType: 'navigation.viewed',
      resource: { type: 'portal.module', publicId: 'systems' },
    });
    expect(events[1]?.correlationId).not.toBe(events[0]?.correlationId);
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

  it('opens the audit area only when the portal projects the audit submodule', async () => {
    localStorage.setItem('garage-watch.locale.v1', 'pt-BR');
    installFetch({
      modules: ['monitoring', 'administration'],
      items: {
        administration: [
          { itemId: 'users', labelKey: 'dashboard.menu.users', sortOrder: 10 },
          { itemId: 'profiles', labelKey: 'dashboard.menu.profiles', sortOrder: 20 },
          { itemId: 'requests', labelKey: 'dashboard.menu.accessRequests', sortOrder: 30 },
          { itemId: 'audit', labelKey: 'dashboard.menu.audit', sortOrder: 40 },
        ],
      },
    });
    render(<App />);
    const user = userEvent.setup();
    await screen.findByTestId('monitoring-module');

    const nav = screen.getByRole('navigation', { name: 'Módulos da plataforma' });
    await user.click(within(nav).getByRole('button', { name: 'Auditoria' }));
    expect(await screen.findByTestId('audit-module')).toHaveAttribute(
      'data-module-ids',
      'monitoring,administration',
    );

    await user.click(within(nav).getByRole('button', { name: 'Acessos' }));
    const accessNav = within(nav).getByRole('list', { name: 'Submódulos de Acessos' });
    expect(within(accessNav).queryByRole('button', { name: 'Auditoria' })).not.toBeInTheDocument();
    expect(within(accessNav).getAllByRole('button')).toHaveLength(3);

    cleanup();
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
    installFetch({ modules: ['monitoring', 'administration'] });
    render(<App />);
    await screen.findByTestId('monitoring-module');
    expect(
      within(screen.getByRole('navigation', { name: 'Módulos da plataforma' })).queryByRole('button', {
        name: 'Auditoria',
      }),
    ).not.toBeInTheDocument();

    cleanup();
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
    installFetch({
      modules: ['monitoring', 'administration'],
      role: 'Viewer',
      items: {
        administration: [{ itemId: 'audit', labelKey: 'dashboard.menu.audit', sortOrder: 40 }],
      },
    });
    render(<App />);
    await screen.findByTestId('monitoring-module');
    const viewerNav = screen.getByRole('navigation', { name: 'Módulos da plataforma' });
    expect(within(viewerNav).getByRole('button', { name: 'Auditoria' })).toBeInTheDocument();
    expect(within(viewerNav).queryByRole('button', { name: 'Acessos' })).not.toBeInTheDocument();
    expect(within(viewerNav).queryByRole('button', { name: 'Sistemas' })).not.toBeInTheDocument();
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

  it('opens the Biometrics module and its projected submodules', async () => {
    localStorage.setItem('garage-watch.locale.v1', 'pt-BR');
    installFetch({
      modules: ['monitoring', 'biometrics'],
      items: { biometrics: biometricsItems },
    });
    render(<App />);
    const user = userEvent.setup();
    await screen.findByTestId('monitoring-module');

    const nav = screen.getByRole('navigation', { name: 'Módulos da plataforma' });
    await user.click(within(nav).getByRole('button', { name: 'Biometria' }));
    expect(await screen.findByRole('region', { name: 'Biometria' })).toHaveTextContent('enrollments');
    expect(within(nav).getByRole('button', { name: 'Calibração' })).toBeInTheDocument();

    await user.click(within(nav).getByRole('button', { name: 'Calibração' }));
    expect(await screen.findByRole('region', { name: 'Biometria' })).toHaveTextContent('calibration');
    expect(window.location.search).toContain('module=biometrics');
    expect(window.location.search).toContain('view=calibration');

    cleanup();
    vi.restoreAllMocks();
    installFetch({ modules: ['monitoring'] });
    render(<App />);
    await screen.findByTestId('monitoring-module');
    expect(screen.queryByRole('button', { name: 'Biometria' })).not.toBeInTheDocument();
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

  it('opens a module, view and module-specific selection from the URL', async () => {
    localStorage.setItem('garage-watch.locale.v1', 'pt-BR');
    window.history.replaceState(null, '', '/?module=monitoring&view=clips&clip=CLP000000000001');
    installFetch({ modules: ['monitoring', 'administration'] });
    render(<App />);

    const monitoring = await screen.findByTestId('monitoring-module');
    expect(monitoring).toHaveAttribute('data-active-view', 'clips');
    expect(JSON.parse(monitoring.getAttribute('data-deep-link') ?? '{}')).toEqual({
      clip: 'CLP000000000001',
    });
  });

  it('returns to the requested deep link after an anonymous login', async () => {
    localStorage.setItem('garage-watch.locale.v1', 'pt-BR');
    window.history.replaceState(null, '', '/?module=monitoring&view=clips&clip=CLP000000000001');
    let authenticated = false;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input);
      const method = init?.method ?? 'GET';
      if (path === '/api/v1/auth/session') return json({ authenticated });
      if (path === '/api/v1/auth/login') {
        authenticated = true;
        return new Response(null, { status: 204 });
      }
      if (path === '/api/v1/auth/me')
        return json({ username: 'admin', role: 'Administrator', canMonitor: true });
      if (path === '/api/v1/cameras') return json([camera]);
      if (path === '/api/v1/clients/presence') return json({ activeClients: 1 });
      if (path === '/api/v1/portal/navigation') return json(navigation(['monitoring', 'administration']));
      if (path === '/api/v1/portal/preferences' && method === 'GET') return json(preferences());
      throw new Error(`Unexpected request ${method} ${path}`);
    });
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole('heading', { name: 'Entre no painel' });
    expect(window.location.search).toBe('?module=monitoring&view=clips&clip=CLP000000000001');

    await user.type(screen.getByLabelText('Usuário'), 'admin');
    await user.type(screen.getByLabelText('Senha'), '123456');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    const monitoring = await screen.findByTestId('monitoring-module');
    expect(monitoring).toHaveAttribute('data-active-view', 'clips');
    expect(JSON.parse(monitoring.getAttribute('data-deep-link') ?? '{}')).toEqual({
      clip: 'CLP000000000001',
    });
    await waitFor(() =>
      expect(window.location.search).toBe('?module=monitoring&view=clips&clip=CLP000000000001'),
    );
  });

  it('falls back when the linked module is not authorized for the profile', async () => {
    localStorage.setItem('garage-watch.locale.v1', 'pt-BR');
    window.history.replaceState(null, '', '/?module=access&view=users');
    let authenticated = false;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input);
      if (path === '/api/v1/auth/session') return json({ authenticated });
      if (path === '/api/v1/auth/login') {
        authenticated = true;
        return new Response(null, { status: 204 });
      }
      if (path === '/api/v1/auth/me') return json({ username: 'viewer', role: 'Viewer', canMonitor: true });
      if (path === '/api/v1/cameras') return json([camera]);
      if (path === '/api/v1/clients/presence') return json({ activeClients: 1 });
      if (path === '/api/v1/portal/navigation') return json(navigation(['monitoring'], 'Viewer'));
      if (path === '/api/v1/portal/preferences') return json(preferences());
      throw new Error(`Unexpected request ${path}`);
    });
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole('heading', { name: 'Entre no painel' });
    await user.type(screen.getByLabelText('Usuário'), 'viewer');
    await user.type(screen.getByLabelText('Senha'), '123456');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    const monitoring = await screen.findByTestId('monitoring-module');
    expect(monitoring).toHaveAttribute('data-active-view', 'monitor');
    expect(screen.queryByRole('button', { name: /Access|Acessos/ })).not.toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toBe('?module=monitoring&view=monitor'));
  });

  it('keeps the browser URL in sync with the selected module and view', async () => {
    localStorage.setItem('garage-watch.locale.v1', 'pt-BR');
    installFetch({ modules: ['monitoring', 'administration'] });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByTestId('monitoring-module');

    const nav = screen.getByRole('navigation', { name: 'Módulos da plataforma' });
    const subnav = within(nav).getByRole('list', { name: 'Submódulos de Monitoramento' });
    await user.click(within(subnav).getByRole('button', { name: 'Clipes' }));

    await waitFor(() => expect(window.location.search).toBe('?module=monitoring&view=clips'));
  });
});
