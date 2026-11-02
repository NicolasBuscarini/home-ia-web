import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';

const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => {
  cleanup();
  if (originalScrollIntoView) {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView);
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  }
  vi.restoreAllMocks();
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('garage-watch.locale.v1', 'pt-BR');
});

describe('application shell', () => {
  it('restores an unauthenticated session and allows choosing a persistent theme', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ authenticated: false }));
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Entre no painel' })).toBeInTheDocument();
    await user.click(screen.getByText('Bosque', { selector: 'strong' }));
    await user.click(screen.getByRole('button', { name: 'Usar o tema Oceano' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'ocean');
    expect(localStorage.getItem('garage-watch.theme.v1')).toBe('ocean');
  });

  it('shows color previews for all available themes and applies a selected preview', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ authenticated: false }));
    document.head.innerHTML = '<meta name="theme-color" content="#101615">';
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Entre no painel' });
    expect(screen.getByRole('heading', { name: 'Monitoramento', level: 1 })).toBeInTheDocument();
    await user.click(screen.getByText('Bosque', { selector: 'strong' }));
    expect(document.querySelector('.theme-selector')).toHaveAttribute('open');
    expect(screen.getByText('Bosque', { selector: 'strong' })).toBeVisible();
    expect(screen.getAllByRole('button', { name: /^Usar o tema/ })).toHaveLength(8);
    await user.click(screen.getByRole('button', { name: 'Usar o tema Lavanda' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'lavender');
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#191526');
  });

  it('changes all shell language strings and persists the locale selection', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ authenticated: false }));
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Entre no painel' })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Idioma' }), 'en-US');
    expect(await screen.findByRole('heading', { name: 'Sign in to the dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Monitoring', level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(localStorage.getItem('garage-watch.locale.v1')).toBe('en-US');
    expect(document.documentElement).toHaveAttribute('lang', 'en-US');
  });

  it('keeps the base User role away from camera, readiness, and presence endpoints', async () => {
    const calls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input);
      calls.push(path);
      if (path === '/api/v1/auth/session') return json({ authenticated: false });
      if (path === '/api/v1/auth/login') return new Response(null, { status: 204 });
      if (path === '/api/v1/auth/me') return json({ username: 'local-user', role: 'User' });
      if (path === '/api/v1/access-requests/mine') return json({ request: null });
      throw new Error(`Unexpected request ${path}`);
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Entre no painel' });
    await user.type(screen.getByLabelText('Usuário'), 'local-user');
    await user.type(screen.getByLabelText('Senha'), '123456');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('heading', { name: 'Conta ativa' })).toBeInTheDocument();
    expect(await screen.findByText('local-user', { selector: '.user-identity-name' })).toBeInTheDocument();
    expect(screen.getByText('Usuário', { selector: '.user-identity-role' })).toBeInTheDocument();
    expect(calls).not.toContain('/api/v1/cameras');
    expect(calls).not.toContain('/health/ready');
    expect(calls).not.toContain('/api/v1/clients/presence');
  });

  it('does not create duplicate presence clients when an authenticated tab reloads', async () => {
    const clientIds: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input);
      if (path === '/api/v1/auth/session') return json({ authenticated: false });
      if (path === '/api/v1/auth/login') return new Response(null, { status: 204 });
      if (path === '/api/v1/auth/me') return json({ username: 'admin', role: 'Administrator' });
      if (path === '/api/v1/cameras')
        return json([
          {
            cameraId: 'garage-01',
            status: 'starting',
            streamEpoch: null,
            liveUrl: '/api/v1/live/garage-01/index.m3u8',
          },
        ]);
      if (path === '/api/v1/clients/presence') {
        clientIds.push(JSON.parse(String(init?.body)).clientId);
        return json({ activeClients: 1 });
      }
      throw new Error(`Unexpected request ${path}`);
    });

    async function signIn(expectedHeartbeatCount: number) {
      const user = userEvent.setup();
      render(<App />);
      await screen.findByRole('heading', { name: 'Entre no painel' });
      await user.type(screen.getByLabelText('Usuário'), 'admin');
      await user.type(screen.getByLabelText('Senha'), '123456');
      await user.click(screen.getByRole('button', { name: 'Entrar' }));
      await vi.waitFor(() => expect(clientIds).toHaveLength(expectedHeartbeatCount));
    }

    await signIn(1);
    const firstTabId = clientIds[0];
    cleanup();
    await signIn(2);

    expect(clientIds[1]).toBe(firstTabId);
  });

  it('mounts the remote monitoring module with the authorized camera collection', async () => {
    let authenticated = false;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input);
      if (path === '/api/v1/auth/session') return json({ authenticated });
      if (path === '/api/v1/auth/login') {
        authenticated = true;
        return new Response(null, { status: 204 });
      }
      if (path === '/api/v1/auth/me') return json({ username: 'admin', role: 'Administrator' });
      if (path === '/api/v1/cameras')
        return json([
          {
            cameraId: 'garage-01',
            status: 'capturing',
            streamEpoch: 'epoch-1',
            liveUrl: '/api/v1/live/garage-01/index.m3u8',
          },
          {
            cameraId: 'side-entry',
            status: 'reconnecting',
            streamEpoch: 'epoch-2',
            liveUrl: '/api/v1/live/side-entry/index.m3u8',
          },
        ]);
      if (path === '/api/v1/clients/presence') return json({ activeClients: 1 });
      throw new Error(`Unexpected request ${path}`);
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Entre no painel' });
    await user.type(screen.getByLabelText('Usuário'), 'admin');
    await user.type(screen.getByLabelText('Senha'), '123456');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('admin', { selector: '.user-identity-name' })).toBeInTheDocument();
    expect(screen.getByText('Administrador', { selector: '.user-identity-role' })).toBeInTheDocument();
    expect(screen.getByText('AD', { selector: '.user-avatar' })).toHaveAttribute('aria-hidden', 'true');

    const clientIndicator = await screen.findByRole('status', { name: '1 cliente conectado' });
    expect(clientIndicator.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(clientIndicator.querySelector('.client-count-value')).toHaveTextContent('1');
    expect(clientIndicator).not.toHaveTextContent('cliente conectado');

    const module = await screen.findByTestId('monitoring-module');
    expect(within(module).getByText('Administrator')).toBeInTheDocument();
    expect(within(module).getByRole('button', { name: 'garage-01' })).toBeInTheDocument();
    expect(within(module).getByRole('button', { name: 'side-entry' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Vídeo ao vivo da câmera')).not.toBeInTheDocument();
  });

  it('shows retry feedback when the initial same-origin session call fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Confirme se a plataforma está iniciada');
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });

  it('announces failure from registration generically for rate limiting', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input) === '/api/v1/auth/session') return json({ authenticated: false });
      if (String(input) === '/api/v1/auth/register') return new Response(null, { status: 429 });
      throw new Error('unexpected');
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Entre no painel' });
    await user.click(screen.getByRole('button', { name: 'Criar conta local' }));
    await user.type(screen.getByLabelText('Usuário'), 'viewer-test');
    await user.type(screen.getByLabelText('Senha', { exact: true }), '123456');
    await user.type(screen.getByLabelText('Confirmar senha'), '123456');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(
      await screen.findByText('Muitas tentativas. Aguarde um minuto e tente novamente.'),
    ).toBeInTheDocument();
  });
});
