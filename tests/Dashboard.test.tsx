import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from '../src/features/monitoring/Dashboard';
import { I18nProvider } from '../src/i18n/i18n';

afterEach(() => cleanup());

const camera = {
  cameraId: 'garage-01',
  status: 'capturing',
  streamEpoch: 'epoch-123456789',
  liveUrl: '/api/v1/live/garage-01/index.m3u8',
};

function renderDashboard(
  userRole: 'Viewer' | 'Administrator',
  cameras = [camera],
  selectedCameraId = cameras[0]?.cameraId,
  onCameraSelect = () => {},
) {
  return render(
    <I18nProvider>
      <Dashboard
        cameras={cameras}
        selectedCameraId={selectedCameraId}
        onCameraSelect={onCameraSelect}
        userRole={userRole}
      />
    </I18nProvider>,
  );
}

describe('dashboard navigation', () => {
  it('exposes only monitoring to Viewer', () => {
    renderDashboard('Viewer');
    const menu = screen.getByRole('navigation', { name: 'Navegação principal' });
    expect(within(menu).getAllByRole('button')).toHaveLength(1);
    expect(within(menu).getByRole('button', { name: 'Monitoramento' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('region', { name: 'Monitoramento' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reproduzir vídeo' })).toBeDisabled();
  });

  it('groups system views under Sistema and management screens under Gestão', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input);
      if (path === '/api/v1/admin/access-rules') return new Response('[]', { status: 200 });
      if (path === '/api/v1/admin/permission-catalog') return new Response('[]', { status: 200 });
      if (path.startsWith('/api/v1/admin/users?page='))
        return new Response(JSON.stringify({ items: [], page: 1, pageSize: 25, totalCount: 0 }), {
          status: 200,
        });
      if (path === '/api/v1/admin/cameras?page=1&pageSize=100')
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      throw new Error(`Unexpected request: ${path}`);
    });
    renderDashboard('Administrator');
    const menu = screen.getByRole('navigation', { name: 'Navegação principal' });
    expect(within(menu).getAllByRole('button')).toHaveLength(3);
    const system = within(menu).getByRole('button', { name: 'Sistema' });
    await userEvent.setup().click(system);
    expect(system).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(system).toHaveAttribute('aria-expanded', 'false');
    expect(system).toHaveFocus();
    await userEvent.setup().click(system);
    const healthMenuItem = within(menu).getByRole('button', { name: 'Saúde do sistema' });
    await userEvent.setup().click(healthMenuItem);
    expect(screen.getByRole('region', { name: 'Saúde do sistema' })).toBeInTheDocument();

    const management = within(menu).getByRole('button', { name: 'Gestão' });
    await userEvent.setup().click(management);
    expect(within(menu).getByRole('button', { name: 'Usuários' })).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: 'Perfis e permissões' })).toBeInTheDocument();
    await userEvent.setup().click(within(menu).getByRole('button', { name: 'Usuários' }));
    expect(await screen.findByRole('heading', { name: 'Gestão de usuários' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Perfis e permissões' })).not.toBeInTheDocument();

    await userEvent.setup().click(management);
    await userEvent.setup().click(within(menu).getByRole('button', { name: 'Perfis e permissões' }));
    expect(await screen.findByRole('heading', { name: 'Perfis e permissões' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Gestão de usuários' })).not.toBeInTheDocument();
  });

  it('presents one camera without adding a redundant selector', () => {
    renderDashboard('Viewer');
    expect(screen.getByText('garage-01')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /garage-01/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reproduzir vídeo' })).toBeInTheDocument();
  });

  it('shows per-camera states and selects only one live camera accessibly', async () => {
    const cameras = [
      camera,
      {
        cameraId: 'side-entry',
        status: 'reconnecting',
        streamEpoch: 'epoch-2',
        liveUrl: '/api/v1/live/side-entry/index.m3u8',
      },
    ];
    const onCameraSelect = vi.fn();
    renderDashboard('Viewer', cameras, 'garage-01', onCameraSelect);
    const healthy = screen.getByRole('button', { name: /garage-01/ });
    const degraded = screen.getByRole('button', { name: /side-entry/ });
    expect(healthy).toHaveAttribute('aria-pressed', 'true');
    expect(degraded).toHaveAttribute('aria-pressed', 'false');
    expect(within(degraded).getByRole('status')).toHaveTextContent('Reconectando');
    expect(screen.getAllByLabelText('Vídeo ao vivo da câmera')).toHaveLength(1);

    degraded.focus();
    await userEvent.setup().keyboard('{Enter}');
    expect(onCameraSelect).toHaveBeenCalledWith('side-entry');
  });

  it('shows an explicit empty state without creating a player', () => {
    renderDashboard('Viewer', [], undefined);
    expect(screen.getByRole('status')).toHaveTextContent('Nenhuma câmera disponível');
    expect(screen.queryByLabelText('Vídeo ao vivo da câmera')).not.toBeInTheDocument();
  });
});
