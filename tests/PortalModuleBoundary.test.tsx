import { cleanup, render, screen } from '@testing-library/react';
import { I18nProvider } from 'home-ia-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PortalModuleBoundary } from '../src/portal/PortalModuleBoundary';

afterEach(() => cleanup());

function BrokenModule(): never {
  throw new Error('module failed');
}

describe('portal module boundary', () => {
  it('contains a module failure and keeps the portal shell available', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <I18nProvider>
        <header>Portal shell</header>
        <PortalModuleBoundary moduleId="monitoring">
          <BrokenModule />
        </PortalModuleBoundary>
      </I18nProvider>,
    );

    expect(screen.getByText('Portal shell')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Módulo indisponível');
    expect(screen.getByRole('alert')).toHaveTextContent('monitoring');
  });
});
