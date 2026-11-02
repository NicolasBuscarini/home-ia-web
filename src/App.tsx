import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AppHeader } from './components/AppHeader';
import type { AuthenticatedUser, CameraStatus, UserRole } from './domain/platform';
import { AuthenticationPanel } from './features/auth/AuthenticationPanel';
import { UserLanding } from './features/auth/UserLanding';
import { I18nProvider, isLocale, useI18n } from './i18n/i18n';
import { PortalModuleBoundary } from './portal/PortalModuleBoundary';
import { getPortalNavigation, getPortalPreferences, savePortalPreferences } from './portal/portalApi';
import { getOrCreateClientId } from './services/clientIdentity';
import { ApiError, getJson, postJson, request } from './services/http';
import { applyTheme, isThemeId, readSavedTheme, type ThemeId } from './theme/theme';

type ScreenState = 'loading' | 'anonymous' | 'authenticated' | 'error';

const RemoteMonitoringModule = lazy(() => import('monitoring/MonitoringModule'));

function validateRole(role: string): role is UserRole {
  return ['Administrator', 'Viewer', 'User'].includes(role);
}

function AppContent() {
  const { t, locale, setLocale } = useI18n();
  const [screen, setScreen] = useState<ScreenState>('loading');
  const [role, setRole] = useState<UserRole>();
  const [canMonitor, setCanMonitor] = useState(false);
  const [username, setUsername] = useState<string>();
  const [cameras, setCameras] = useState<CameraStatus[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>();
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<ThemeId>(readSavedTheme);
  const [clientCount, setClientCount] = useState<string>();
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [portalModuleIds, setPortalModuleIds] = useState<string[]>();
  const pollInFlight = useRef(false);
  const portalPreferencesReady = useRef(false);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (screen !== 'authenticated') {
      portalPreferencesReady.current = false;
      return;
    }
    if (!portalPreferencesReady.current) {
      portalPreferencesReady.current = true;
      return;
    }
    void savePortalPreferences(theme, locale).catch(() => {
      // The local preference remains active if the portal is unavailable.
    });
  }, [screen, theme, locale]);

  const loadPortalContext = useCallback(async (): Promise<void> => {
    try {
      const [navigation, preferences] = await Promise.all([getPortalNavigation(), getPortalPreferences()]);
      setPortalModuleIds(navigation.modules.map((module) => module.moduleId));
      if (!preferences.isDefault) {
        if (isThemeId(preferences.themeId)) setTheme(preferences.themeId);
        if (isLocale(preferences.languageTag)) setLocale(preferences.languageTag);
      }
    } catch {
      // The legacy dashboard remains usable if the portal projection is unavailable.
      setPortalModuleIds(undefined);
    }
  }, [setLocale]);

  const loadAuthenticatedState = useCallback(async (): Promise<void> => {
    const user = await getJson<AuthenticatedUser>('/api/v1/auth/me');
    if (!validateRole(user.role)) throw new Error('Papel de acesso não reconhecido.');
    setRole(user.role);
    setCanMonitor(user.role === 'Administrator' || user.canMonitor);
    setUsername(user.username);
    setError('');
    await loadPortalContext();
    if (user.role !== 'Administrator' && !user.canMonitor) {
      setCameras([]);
      setSelectedCameraId(undefined);
      setScreen('authenticated');
      return;
    }
    const cameraList = await getJson<CameraStatus[]>('/api/v1/cameras');
    setCameras(cameraList);
    setSelectedCameraId((current) =>
      current && cameraList.some((cameraItem) => cameraItem.cameraId === current)
        ? current
        : cameraList[0]?.cameraId,
    );
    setScreen('authenticated');
  }, [loadPortalContext]);

  const checkSession = useCallback(async () => {
    const session = await getJson<{ authenticated: boolean }>('/api/v1/auth/session');
    if (!session.authenticated) {
      setRole(undefined);
      setCanMonitor(false);
      setUsername(undefined);
      setCameras([]);
      setSelectedCameraId(undefined);
      setClientCount(undefined);
      setPortalModuleIds(undefined);
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
    if (screen !== 'authenticated' || !role || !canMonitor) return;
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
          setCanMonitor(false);
          setUsername(undefined);
          setCameras([]);
          setSelectedCameraId(undefined);
          setClientCount(undefined);
          setPortalModuleIds(undefined);
          return;
        }
        const cameraList = await getJson<CameraStatus[]>('/api/v1/cameras');
        if (!active) return;
        // Keep stable object references for unchanged items; the selected player must not restart
        // on each catalog poll.
        setCameras((current) => {
          const previousById = new Map(current.map((item) => [item.cameraId, item]));
          const next = cameraList.map((item) => {
            const previous = previousById.get(item.cameraId);
            return previous &&
              previous.status === item.status &&
              previous.streamEpoch === item.streamEpoch &&
              previous.liveUrl === item.liveUrl
              ? previous
              : item;
          });
          return current.length === next.length && next.every((item, index) => item === current[index])
            ? current
            : next;
        });
        setSelectedCameraId((current) =>
          current && cameraList.some((item) => item.cameraId === current) ? current : cameraList[0]?.cameraId,
        );
      } catch (failure) {
        if (active) {
          if (failure instanceof ApiError && failure.status === 401) {
            setScreen('anonymous');
            setRole(undefined);
            setCanMonitor(false);
            setUsername(undefined);
            setCameras([]);
            setSelectedCameraId(undefined);
            setClientCount(undefined);
            setPortalModuleIds(undefined);
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
  }, [screen, role, canMonitor, t]);

  useEffect(() => {
    if (screen !== 'authenticated' || !role || !canMonitor) return;
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
  }, [screen, role, canMonitor]);

  async function logout() {
    setLogoutBusy(true);
    try {
      await postJson('/api/v1/auth/logout', {});
    } catch {
      /* Cookie may already be expired. */
    }
    setRole(undefined);
    setCanMonitor(false);
    setUsername(undefined);
    setCameras([]);
    setSelectedCameraId(undefined);
    setClientCount(undefined);
    setPortalModuleIds(undefined);
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

  const selectedCamera = cameras.find((item) => item.cameraId === selectedCameraId);

  return (
    <main className="container app-shell py-4 py-md-5">
      <AppHeader
        role={screen === 'authenticated' ? role : undefined}
        username={screen === 'authenticated' ? username : undefined}
        activeClients={screen === 'authenticated' && canMonitor ? clientCount : undefined}
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
      {screen === 'authenticated' && role && !canMonitor && (
        <UserLanding canRequestAccess={role === 'User'} />
      )}
      {screen === 'authenticated' && role && canMonitor && (
        <PortalModuleBoundary moduleId="monitoring">
          <Suspense
            fallback={
              <section className="panel-card feedback-panel" role="status" aria-live="polite">
                <span className="eyebrow">{t('portal.module.error.eyebrow')}</span>
                <p className="mb-0 mt-2">{t('portal.module.loading')}</p>
              </section>
            }
          >
            <RemoteMonitoringModule
              locale={locale}
              cameras={cameras}
              selectedCameraId={selectedCamera?.cameraId}
              onCameraSelect={setSelectedCameraId}
              userRole={role}
              portalModuleIds={portalModuleIds}
            />
          </Suspense>
        </PortalModuleBoundary>
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
