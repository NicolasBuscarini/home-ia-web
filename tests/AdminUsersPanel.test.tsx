import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminUsersPanel } from '../src/features/admin/AdminUsersPanel';
import { I18nProvider } from '../src/i18n/i18n';

const viewer = { id: 'viewer-id', userName: 'new-viewer', isActive: true };
const camera = { cameraId: 'garage-01', contextId: 'garage', name: 'Garagem', isEnabled: true };

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

describe('administrative user management', () => {
  it('loads account details, changes roles and grants, revokes, and confirms deactivation', async () => {
    let viewerActive = true;
    let currentRoles = ['User'];
    let hasGrant = false;
    const requests: Array<{ path: string; method: string; body?: string }> = [];
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input);
      const method = init?.method ?? 'GET';
      requests.push({ path, method, body: init?.body ? String(init.body) : undefined });
      if (path.startsWith('/api/v1/admin/users?page=')) {
        return response({
          items: [{ ...viewer, isActive: viewerActive }],
          page: 1,
          pageSize: 25,
          totalCount: 1,
        });
      }
      if (path === '/api/v1/admin/cameras?page=1&pageSize=100') return response({ items: [camera] });
      if (path === '/api/v1/admin/users/viewer-id' && method === 'GET') {
        return response({
          ...viewer,
          isActive: viewerActive,
          roles: currentRoles,
          cameraGrants: hasGrant
            ? [
                {
                  contextId: 'garage',
                  cameraId: 'garage-01',
                  cameraName: 'Garagem',
                  grantedAtUtc: '2026-10-30T00:00:00Z',
                  revokedAtUtc: null,
                },
              ]
            : [],
        });
      }
      if (method === 'PUT' && path.endsWith('/roles')) {
        currentRoles = JSON.parse(String(init?.body)).roles;
        return response(undefined, 204);
      }
      if (method === 'PUT' && path.endsWith('/cameras/garage-01')) {
        hasGrant = true;
        return response(undefined, 204);
      }
      if (method === 'DELETE' && path.endsWith('/cameras/garage-01')) {
        hasGrant = false;
        return response(undefined, 204);
      }
      if (method === 'DELETE' && path === '/api/v1/admin/users/viewer-id') {
        viewerActive = false;
        return response(undefined, 204);
      }
      throw new Error(`Unexpected request: ${method} ${path}`);
    });

    const user = userEvent.setup();
    render(
      <I18nProvider>
        <AdminUsersPanel />
      </I18nProvider>,
    );
    expect(await screen.findByRole('heading', { name: 'Gestão de usuários' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Detalhes' }));
    expect(await screen.findByRole('group', { name: 'Papéis' })).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Visualizador' }));
    await user.click(screen.getByRole('button', { name: 'Salvar papéis' }));
    expect(await screen.findByText('Papéis atualizados e sessões existentes revogadas.')).toBeInTheDocument();
    expect(requests).toContainEqual({
      path: '/api/v1/admin/users/viewer-id/roles',
      method: 'PUT',
      body: JSON.stringify({ roles: ['User', 'Viewer'] }),
    });

    await user.click(screen.getByRole('button', { name: 'Conceder acesso' }));
    expect(await screen.findByRole('button', { name: 'Revogar acesso' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Revogar acesso' }));
    expect(
      await screen.findByText('Acesso à câmera revogado e sessões existentes invalidadas.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Desativar conta' }));
    expect(window.confirm).toHaveBeenCalledWith(
      'Desativar a conta “new-viewer”? As sessões existentes serão revogadas.',
    );
    await waitFor(() => expect(screen.getByText('Desativada')).toBeInTheDocument());
    expect(
      requests.some(
        (request) => request.method === 'DELETE' && request.path === '/api/v1/admin/users/viewer-id',
      ),
    ).toBe(true);
  });

  it('shows a retryable load error without exposing exception detail', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('private-error-detail'));
    render(
      <I18nProvider>
        <AdminUsersPanel />
      </I18nProvider>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar as contas. Tente novamente.',
    );
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
    expect(screen.queryByText('private-error-detail')).not.toBeInTheDocument();
  });

  it('leaves account state untouched when deactivation confirmation is cancelled', async () => {
    const requests: Array<{ path: string; method: string }> = [];
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input);
      const method = init?.method ?? 'GET';
      requests.push({ path, method });
      if (path.startsWith('/api/v1/admin/users?page='))
        return response({ items: [viewer], page: 1, pageSize: 25, totalCount: 1 });
      if (path === '/api/v1/admin/cameras?page=1&pageSize=100') return response({ items: [] });
      if (path === '/api/v1/admin/users/viewer-id')
        return response({ ...viewer, roles: ['User'], cameraGrants: [] });
      throw new Error(`Unexpected request: ${method} ${path}`);
    });

    const user = userEvent.setup();
    render(
      <I18nProvider>
        <AdminUsersPanel />
      </I18nProvider>,
    );
    await screen.findByRole('heading', { name: 'Gestão de usuários' });
    await user.click(screen.getByRole('button', { name: 'Detalhes' }));
    await user.click(await screen.findByRole('button', { name: 'Desativar conta' }));

    expect(requests.some((request) => request.method === 'DELETE')).toBe(false);
    expect(screen.getByText('Ativa')).toBeInTheDocument();
  });
});
