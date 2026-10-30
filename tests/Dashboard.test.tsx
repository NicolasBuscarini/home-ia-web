import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Dashboard } from '../src/features/monitoring/Dashboard';

afterEach(() => cleanup());

const camera = {
  cameraId: 'garage-01',
  status: 'capturing',
  streamEpoch: 'epoch-123456789',
  liveUrl: '/api/v1/live/garage-01/index.m3u8',
};

describe('dashboard navigation', () => {
  it('exposes only monitor view to Viewer and switches panels using keyboard', () => {
    render(<Dashboard camera={camera} userRole="Viewer" />);
    const tabs = screen.getByRole('tablist', { name: 'Telas do painel' });
    expect(within(tabs).getAllByRole('tab')).toHaveLength(1);
    expect(screen.getByRole('tabpanel', { name: 'Monitoramento' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reproduzir vídeo' })).toBeEnabled();
  });

  it('shows operational tabs only for Administrator and maintains tab selection', () => {
    render(<Dashboard camera={camera} userRole="Administrator" />);
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
