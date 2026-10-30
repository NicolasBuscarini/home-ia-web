import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Dashboard } from '../src/features/monitoring/Dashboard';
import { I18nProvider } from '../src/i18n/i18n';

afterEach(() => cleanup());

const camera = {
  cameraId: 'garage-01',
  status: 'capturing',
  streamEpoch: 'epoch-123456789',
  liveUrl: '/api/v1/live/garage-01/index.m3u8',
};

function renderDashboard(userRole: 'Viewer' | 'Administrator') {
  return render(
    <I18nProvider>
      <Dashboard camera={camera} userRole={userRole} />
    </I18nProvider>,
  );
}

describe('dashboard navigation', () => {
  it('exposes only monitor view to Viewer and switches panels using keyboard', () => {
    renderDashboard('Viewer');
    const tabs = screen.getByRole('tablist', { name: 'Telas do painel' });
    expect(within(tabs).getAllByRole('tab')).toHaveLength(1);
    expect(screen.getByRole('tabpanel', { name: 'Monitoramento' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reproduzir vídeo' })).toBeEnabled();
  });

  it('shows operational tabs only for Administrator and maintains tab selection', () => {
    renderDashboard('Administrator');
    const tabs = screen.getByRole('tablist', { name: 'Telas do painel' });
    expect(within(tabs).getAllByRole('tab')).toHaveLength(4);
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
    const captureTab = screen.getByRole('tab', { name: 'Segmentos e lacunas' });
    expect(captureTab).toHaveFocus();
    expect(captureTab).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(healthTab);
    expect(healthTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Saúde do sistema' })).toBeInTheDocument();
  });
});
