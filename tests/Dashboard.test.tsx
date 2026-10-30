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
  it('exposes only monitor view to Viewer and switches panels using keyboard', () => {
    renderDashboard('Viewer');
    const tabs = screen.getByRole('tablist', { name: 'Telas do painel' });
    expect(within(tabs).getAllByRole('tab')).toHaveLength(1);
    expect(screen.getByRole('tabpanel', { name: 'Monitoramento' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reproduzir vídeo' })).toBeDisabled();
  });

  it('shows operational tabs only for Administrator and maintains tab selection', () => {
    renderDashboard('Administrator');
    const tabs = screen.getByRole('tablist', { name: 'Telas do painel' });
    expect(within(tabs).getAllByRole('tab')).toHaveLength(5);
    for (const tab of within(tabs).getAllByRole('tab')) {
      expect(document.getElementById(tab.getAttribute('aria-controls') ?? '')).toBeInTheDocument();
    }
    const healthTab = screen.getByRole('tab', { name: 'Saúde do sistema' });
    healthTab.focus();
    fireEvent.keyDown(tabs, { key: 'ArrowRight' });
    expect(healthTab).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(tabs, { key: 'ArrowRight' });
    const dependenciesTab = screen.getByRole('tab', { name: 'Dependências' });
    expect(dependenciesTab).toHaveFocus();
    expect(dependenciesTab).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(tabs, { key: 'End' });
    const usersTab = screen.getByRole('tab', { name: 'Usuários' });
    expect(usersTab).toHaveFocus();
    expect(usersTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Usuários' })).toBeInTheDocument();
    fireEvent.click(healthTab);
    expect(healthTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Saúde do sistema' })).toBeInTheDocument();
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
