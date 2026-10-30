import { useCallback, useEffect, useRef, useState } from 'react';
import { AppHeader } from './components/AppHeader';
import type { AuthenticatedUser, CameraStatus, UserRole } from './domain/platform';
import { AuthenticationPanel } from './features/auth/AuthenticationPanel';
import { UserLanding } from './features/auth/UserLanding';
import { Dashboard } from './features/monitoring/Dashboard';
import { ApiError, getJson, postJson, request } from './services/http';
import { applyTheme, readSavedTheme, type ThemeId } from './theme/theme';

type ScreenState = 'loading' | 'anonymous' | 'authenticated' | 'error';

function createClientId(): string | undefined {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
    if (!globalThis.crypto?.getRandomValues) return undefined;
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
    const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } catch {
    return undefined;
  }
}

function validateRole(role: string): role is UserRole {
  return ['Administrator', 'Viewer', 'User'].includes(role);
}

export default function App() {
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
        setError('Não foi possível consultar o serviço local. Confirme se a plataforma está iniciada.');
      }
    });
    return () => {
      active = false;
    };
  }, [checkSession]);

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
          } else setError('Sem resposta da plataforma. O painel tentará atualizar novamente.');
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
  }, [screen, role]);

  useEffect(() => {
    if (screen !== 'authenticated' || !role || role === 'User') return;
    const id = createClientId();
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
      setError('A sessão foi criada, mas não foi possível carregar o painel. Tente atualizar a página.');
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
          <span className="eyebrow">INICIANDO</span>
          <p className="mb-0 mt-2">Consultando sessão local…</p>
        </section>
      )}
      {screen === 'anonymous' && <AuthenticationPanel onAuthenticated={handleAuthenticated} />}
      {screen === 'authenticated' && role === 'User' && <UserLanding />}
      {screen === 'authenticated' && role && role !== 'User' && camera && (
        <Dashboard camera={camera} userRole={role} />
      )}
      {screen === 'error' && (
        <section className="panel-card feedback-panel" aria-labelledby="service-error-title">
          <span className="eyebrow">SERVIÇO LOCAL</span>
          <h2 id="service-error-title" className="h5 mt-2">
            Não foi possível abrir o painel
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
                setError(
                  'Não foi possível consultar o serviço local. Confirme se a plataforma está iniciada.',
                );
              });
            }}
          >
            Tentar novamente
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
