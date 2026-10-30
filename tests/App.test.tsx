import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('application shell', () => {
  it('restores an unauthenticated session and allows choosing a persistent theme', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ authenticated: false }));
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Entre no painel' })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tema visual' }), 'ocean');
    expect(document.documentElement).toHaveAttribute('data-theme', 'ocean');
    expect(localStorage.getItem('garage-watch.theme.v1')).toBe('ocean');
  });

  it('keeps the base User role away from camera, readiness, and presence endpoints', async () => {
    const calls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input);
      calls.push(path);
      if (path === '/api/v1/auth/session') return json({ authenticated: false });
      if (path === '/api/v1/auth/login') return new Response(null, { status: 204 });
      if (path === '/api/v1/auth/me') return json({ username: 'local-user', role: 'User' });
      throw new Error(`Unexpected request ${path}`);
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Entre no painel' });
    await user.type(screen.getByLabelText('Usuário'), 'local-user');
    await user.type(screen.getByLabelText('Senha'), '123456');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('heading', { name: 'Conta ativa' })).toBeInTheDocument();
    expect(calls).not.toContain('/api/v1/cameras');
    expect(calls).not.toContain('/health/ready');
    expect(calls).not.toContain('/api/v1/clients/presence');
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
