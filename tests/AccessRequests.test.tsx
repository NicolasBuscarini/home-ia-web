import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminAccessRequestsPanel } from '../src/features/admin/AdminAccessRequestsPanel';
import { UserLanding } from '../src/features/auth/UserLanding';
import { I18nProvider } from '../src/i18n/i18n';

function response(body: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('access request screens', () => {
  it('lets a base User submit an idempotent request and clearly confirms it grants no access', async () => {
    const calls: Array<{ path: string; method: string; body?: string }> = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ path, method, body: init?.body ? String(init.body) : undefined });
      if (path === '/api/v1/access-requests/mine') return response({ request: null });
      if (path === '/api/v1/access-requests' && method === 'POST') {
        return response(
          {
            id: 'request-1',
            purpose: 'live_monitoring',
            status: 'pending',
            createdAtUtc: '2026-10-30T00:00:00Z',
          },
          202,
        );
      }
      throw new Error(`Unexpected request: ${method} ${path}`);
    });
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <UserLanding canRequestAccess />
      </I18nProvider>,
    );
    await user.click(await screen.findByRole('button', { name: 'Enviar pedido de acesso' }));
    expect(await screen.findByText(/aguarda análise do administrador/i)).toBeInTheDocument();
    expect(screen.getByText(/não concede acesso automaticamente/i)).toBeInTheDocument();
    const submitted = calls.find((call) => call.method === 'POST');
    expect(submitted?.path).toBe('/api/v1/access-requests');
    expect(JSON.parse(submitted?.body ?? '{}')).toMatchObject({ purpose: 'live_monitoring' });
    expect(JSON.parse(submitted?.body ?? '{}').idempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('shows request state to administrators and marks review without an access grant action', async () => {
    let status = 'pending';
    const calls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input);
      calls.push(`${init?.method ?? 'GET'} ${path}`);
      if (path.startsWith('/api/v1/admin/access-requests?')) {
        return response({
          items: [
            {
              id: 'request-1',
              username: 'local-user',
              purpose: 'live_monitoring',
              status,
              createdAtUtc: '2026-10-30T00:00:00Z',
            },
          ],
          page: 1,
          pageSize: 25,
          totalCount: 1,
        });
      }
      if (path === '/api/v1/admin/access-requests/request-1/review' && init?.method === 'POST') {
        status = 'reviewed';
        return response(null, 204);
      }
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${path}`);
    });
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <AdminAccessRequestsPanel />
      </I18nProvider>,
    );
    expect(await screen.findByText('local-user')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Marcar como analisado' }));
    expect(await screen.findByText(/Analisado/)).toBeInTheDocument();
    expect(screen.getByText(/as permissões do usuário não foram alteradas/i)).toBeInTheDocument();
    expect(calls).toContain('POST /api/v1/admin/access-requests/request-1/review');
    expect(calls.some((call) => call.includes('/access-rules') || call.includes('/access-profiles'))).toBe(
      false,
    );
  });
});
