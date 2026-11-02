import { Component, type ReactNode } from 'react';
import { useI18n } from '../i18n/i18n';

interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

class PortalErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function PortalModuleBoundary({ moduleId, children }: { moduleId: string; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <PortalErrorBoundary
      fallback={
        <section className="panel-card feedback-panel" role="alert" aria-live="assertive">
          <span className="eyebrow">{t('portal.module.error.eyebrow')}</span>
          <h2 className="h5 mt-2">{t('portal.module.error.title')}</h2>
          <p className="small text-secondary mb-0">{t('portal.module.error.message', { moduleId })}</p>
        </section>
      }
    >
      {children}
    </PortalErrorBoundary>
  );
}
