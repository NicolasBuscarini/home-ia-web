import { useCallback, useEffect, useRef, useState } from 'react';
import { AppHeader } from './components/AppHeader';
import type { AuthenticatedUser, CameraStatus, UserRole } from './domain/platform';
import { AuthenticationPanel } from './features/auth/AuthenticationPanel';
import { UserLanding } from './features/auth/UserLanding';
import { Dashboard } from './features/monitoring/Dashboard';
import { I18nProvider, useI18n } from './i18n/i18n';
import { getOrCreateClientId } from './services/clientIdentity';
import { ApiError, getJson, postJson, request } from './services/http';
import { applyTheme, readSavedTheme, type ThemeId } from './theme/theme';

type ScreenState = 'loading' | 'anonymous' | 'authenticated' | 'error';

function validateRole(role: string): role is UserRole {
  return ['Administrator', 'Viewer', 'User'].includes(role);
}

function AppContent() {
  const { t } = useI18n();
  const [screen, setScreen] = useState<ScreenState>('loading');
  const [role, setRole] = useState<UserRole>();
  const [camera, setCamera] = useState<CameraStatus>();
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<ThemeId>(readSavedTheme);
  const [clientCount, setClientCount] = useState<string>();
  const [logoutBusy, setLogoutBusy] = useState(false);
  const pollInFlight = useRef(false);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const loadAuthenticatedState = useCallback(async (): Promise<void> => {
    const user = await getJson<AuthenticatedUser>('/api/v1/auth/me');
    if (!validateRole(user.role)) throw new Error('Papel de acesso não reconhecido.');
    setRole(user.role);
    setError('');
    if (user.role === 'User') {
      setCamera(undefined);
      setScreen('authenticated');
      return;
    }
    const cameras = await getJson<CameraStatus[]>('/api/v1/cameras');
    const activeCamera = cameras[0];
    if (!activeCamera) throw new Error('Nenhuma câmera está disponível para esta conta.');
    setCamera(activeCamera);
    setScreen('authenticated');
  }, []);

  const checkSession = useCallback(async () => {
    const session = await getJson<{ authenticated: boolean }>('/api/v1/auth/session');
    if (!session.authenticated) {
      setRole(undefined);
      setCamera(undefined);
      setClientCount(undefined);
      setScreen('anonymous');
      return;
    }
    await loadAuthenticatedState();
  }, [loadAuthenticatedState]);

  useEffect(() => {
    let active = true;
    void checkSession().catch(() => {
      if (active) {
        setScreen('error');
        setError(t('app.error.session'));
      }
    });
    return () => {
      active = false;
    };
  }, [checkSession, t]);

  useEffect(() => {
    if (screen !== 'authenticated' || !role || role === 'User') return;
    let active = true;
    const poll = async () => {
      if (pollInFlight.current) return;
      pollInFlight.current = true;
      try {
        const session = await getJson<{ authenticated: boolean }>('/api/v1/auth/session');
        if (!active) return;
        setError('');
        if (!session.authenticated) {
          setScreen('anonymous');
          setRole(undefined);
          setCamera(undefined);
          setClientCount(undefined);
          return;
        }
        const cameras = await getJson<CameraStatus[]>('/api/v1/cameras');
        if (!active) return;
        const next = cameras[0];
        if (!next) throw new Error('Nenhuma câmera está disponível para esta conta.');
        // Updating only on changed camera fields avoids restarting HLS during every poll.
        setCamera((current) =>
          current &&
          current.cameraId === next.cameraId &&
          current.status === next.status &&
          current.streamEpoch === next.streamEpoch &&
          current.liveUrl === next.liveUrl
            ? current
            : next,
        );
      } catch (failure) {
        if (active) {
          if (failure instanceof ApiError && failure.status === 401) {
            setScreen('anonymous');
            setRole(undefined);
            setCamera(undefined);
            setClientCount(undefined);
          } else setError(t('app.error.offline'));
        }
      } finally {
        pollInFlight.current = false;
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [screen, role, t]);

  useEffect(() => {
    if (screen !== 'authenticated' || !role || role === 'User') return;
    const id = getOrCreateClientId();
    if (!id) {
      setClientCount('—');
      return;
    }
    let active = true;
    let inFlight = false;
    const heartbeat = async () => {
      if (!active || inFlight) return;
      inFlight = true;
      try {
        const response = await request('/api/v1/clients/presence', {
          method: 'PUT',
          body: JSON.stringify({ clientId: id }),
        });
        if (!active) return;
        if (response.status === 429) {
          setClientCount('64+');
          return;
        }
        if (response.status === 401) {
          setClientCount(undefined);
          setScreen('anonymous');
          return;
        }
        const body = (await response.json()) as { activeClients?: number };
        setClientCount(
          response.ok && Number.isInteger(body.activeClients) ? String(body.activeClients) : '—',
        );
      } catch {
        if (active) setClientCount('—');
      } finally {
        inFlight = false;
      }
    };
    void heartbeat();
    const timer = window.setInterval(() => void heartbeat(), 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [screen, role]);

  async function logout() {
    setLogoutBusy(true);
    try {
      await postJson('/api/v1/auth/logout', {});
    } catch {
      /* Cookie may already be expired. */
    }
    setRole(undefined);
    setCamera(undefined);
    setClientCount(undefined);
    setError('');
    setScreen('anonymous');
    setLogoutBusy(false);
  }

  async function handleAuthenticated() {
    try {
      await loadAuthenticatedState();
    } catch {
      setScreen('error');
      setError(t('app.error.sessionCreated'));
    }
  }

  return (
    <main className="container app-shell py-4 py-md-5">
      <AppHeader
        role={screen === 'authenticated' ? role : undefined}
        activeClients={screen === 'authenticated' && role !== 'User' ? clientCount : undefined}
        theme={theme}
        onThemeChange={setTheme}
        onLogout={() => void logout()}
        busy={logoutBusy}
      />
      {screen === 'loading' && (
        <section className="panel-card feedback-panel" role="status" aria-live="polite">
          <span className="eyebrow">{t('app.loading.eyebrow')}</span>
          <p className="mb-0 mt-2">{t('app.loading.message')}</p>
        </section>
      )}
      {screen === 'anonymous' && <AuthenticationPanel onAuthenticated={handleAuthenticated} />}
      {screen === 'authenticated' && role === 'User' && <UserLanding />}
      {screen === 'authenticated' && role && role !== 'User' && camera && (
        <Dashboard camera={camera} userRole={role} />
      )}
      {screen === 'error' && (
        <section className="panel-card feedback-panel" aria-labelledby="service-error-title">
          <span className="eyebrow">{t('app.error.eyebrow')}</span>
          <h2 id="service-error-title" className="h5 mt-2">
            {t('app.error.title')}
          </h2>
          <p className="error-text mb-3" role="alert">
            {error}
          </p>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              setScreen('loading');
              void checkSession().catch(() => {
                setScreen('error');
                setError(t('app.error.session'));
              });
            }}
          >
            {t('app.error.retry')}
          </button>
        </section>
      )}
      {error && screen === 'authenticated' && (
        <p className="feedback error-text mt-3" role="status" aria-live="polite">
          {error}
        </p>
      )}
    </main>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}
