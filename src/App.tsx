import type { AuthenticatedUser, CameraStatus, TranslationKey, UserRole } from 'home-ia-shared';
import {
  ApiError,
  applyTheme,
  applyThemeStyle,
  getJson,
  I18nProvider,
  isLocale,
  isThemeId,
  moduleDeepLinkParams,
  parseDeepLink,
  postJson,
  readSavedTheme,
  readSavedThemeStyle,
  request,
  serializeDeepLink,
  type ThemeId,
  type ThemeStyleId,
  useI18n,
} from 'home-ia-shared';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { AuthenticationPanel } from './features/auth/AuthenticationPanel';
import { UserLanding } from './features/auth/UserLanding';
import { PortalModuleBoundary } from './portal/PortalModuleBoundary';
import { shellEvents } from './portal/platformEvents';
import { getPortalNavigation, getPortalPreferences, savePortalPreferences } from './portal/portalApi';
import { getOrCreateClientId } from './services/clientIdentity';

type ScreenState = 'loading' | 'anonymous' | 'authenticated' | 'error';
type ModuleView = 'monitoring' | 'activitywatch' | 'access' | 'systems' | 'audit';

const RemoteMonitoringModule = lazy(() => import('monitoring/MonitoringModule'));
const RemoteActivityWatchModule = lazy(() => import('activitywatch/ActivityWatchModule'));
const RemoteAccessModule = lazy(() => import('platform/AccessModule'));
const RemoteSystemsModule = lazy(() => import('platform/SystemsModule'));
const RemoteAuditModule = lazy(() => import('platform/AuditModule'));

function ModuleLoading() {
  const { t } = useI18n();
  return (
    <section className="panel-card feedback-panel" role="status" aria-live="polite">
      <span className="eyebrow">{t('portal.module.error.eyebrow')}</span>
      <p className="mb-0 mt-2">{t('portal.module.loading')}</p>
    </section>
  );
}

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
  const [themeStyle, setThemeStyle] = useState<ThemeStyleId>(readSavedThemeStyle);
  const [clientCount, setClientCount] = useState<string>();
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [portalModuleIds, setPortalModuleIds] = useState<string[]>();
  const [portalSubmodules, setPortalSubmodules] =
    useState<Record<string, Array<{ id: string; labelKey: string }>>>();
  const [initialLink] = useState(() => parseDeepLink(window.location.search));
  const [activeModule, setActiveModule] = useState<ModuleView>(() => {
    const requested = initialLink.module;
    return requested === 'monitoring' ||
      requested === 'activitywatch' ||
      requested === 'access' ||
      requested === 'systems' ||
      requested === 'audit'
      ? requested
      : 'monitoring';
  });
  const [monitoringView, setMonitoringView] = useState(() => initialLink.view ?? 'monitor');
  const [moduleParams, setModuleParams] = useState<Record<string, string>>(() =>
    moduleDeepLinkParams(initialLink),
  );
  const [accessView, setAccessView] = useState(() => initialLink.view ?? 'users');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem('garage-watch.sidebar-collapsed.v1') === 'true';
    } catch {
      return false;
    }
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pollInFlight = useRef(false);
  const portalPreferencesReady = useRef(false);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    applyThemeStyle(themeStyle);
  }, [themeStyle]);

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
      setPortalSubmodules(
        Object.fromEntries(
          navigation.modules.map((module) => [
            module.moduleId,
            module.items.map((item) => ({ id: item.itemId, labelKey: item.labelKey })),
          ]),
        ),
      );
      if (!preferences.isDefault) {
        if (isThemeId(preferences.themeId)) setTheme(preferences.themeId);
        if (isLocale(preferences.languageTag)) setLocale(preferences.languageTag);
      }
    } catch {
      // The legacy dashboard remains usable if the portal projection is unavailable. Keep the
      // requested module parameters so a deep link survives a portal outage window too.
      setPortalModuleIds(undefined);
      setPortalSubmodules(undefined);
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
      setPortalSubmodules(undefined);
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
          setPortalSubmodules(undefined);
          setModuleParams({});
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
            setPortalSubmodules(undefined);
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
    setPortalSubmodules(undefined);
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
  const isAdministrator = role === 'Administrator';
  const monitoringAllowed = canMonitor && (!portalModuleIds || portalModuleIds.includes('monitoring'));
  const activityWatchAllowed =
    isAdministrator && (!portalModuleIds || portalModuleIds.includes('activitywatch'));
  const administrationAllowed =
    isAdministrator && (!portalModuleIds || portalModuleIds.includes('administration'));
  // The portal projects submodules after permission filtering; `audit` therefore only exists in the
  // navigation when the account holds `events.read`, even for a delegated non-Administrator profile.
  // The local fallback keeps the area reachable for an Administrator while the projection is
  // unavailable, and the server still enforces the permission on every query.
  const auditAllowed =
    (!portalModuleIds || portalModuleIds.includes('administration')) &&
    (portalSubmodules
      ? (portalSubmodules.administration ?? []).some((view) => view.id === 'audit')
      : isAdministrator);

  useEffect(() => {
    const available: ModuleView[] = [];
    if (monitoringAllowed) available.push('monitoring');
    if (activityWatchAllowed) available.push('activitywatch');
    if (administrationAllowed) available.push('access', 'systems');
    if (auditAllowed) available.push('audit');
    if (available.length > 0 && !available.includes(activeModule)) {
      setActiveModule(available[0] ?? 'monitoring');
    }
  }, [activeModule, activityWatchAllowed, administrationAllowed, auditAllowed, monitoringAllowed]);

  useEffect(() => {
    if (screen !== 'authenticated') return;
    const allowed =
      activeModule === 'monitoring'
        ? monitoringAllowed
        : activeModule === 'activitywatch'
          ? activityWatchAllowed
          : activeModule === 'access' || activeModule === 'systems'
            ? administrationAllowed
            : activeModule === 'audit'
              ? auditAllowed
              : false;
    if (allowed) return;

    // The requested link belongs to a module/profile the account cannot access. Drop its
    // module-scoped parameters; the effect above then selects the first authorized area and the
    // URL sync rewrites the address bar. Re-running after a later login also covers a different
    // account without leaking parameters from the previous session.
    setModuleParams({});
    if (monitoringAllowed) setMonitoringView('monitor');
    if (administrationAllowed) setAccessView('users');
  }, [screen, activeModule, monitoringAllowed, activityWatchAllowed, administrationAllowed, auditAllowed]);

  useEffect(() => {
    try {
      window.localStorage.setItem('garage-watch.sidebar-collapsed.v1', String(sidebarCollapsed));
    } catch {
      // Local preference is optional; storage can be unavailable in private mode.
    }
  }, [sidebarCollapsed]);

  const managementSubmodules = role === 'Administrator' && administrationAllowed;
  // Submodule menus are a portal projection. The local lists remain only as a fallback for an
  // unreachable or older portal, so the dashboard never loses navigation during an outage.
  const monitoringViews = portalSubmodules
    ? (portalSubmodules.monitoring ?? [])
    : managementSubmodules
      ? [
          { id: 'monitor', labelKey: 'dashboard.menu.monitor' },
          { id: 'clips', labelKey: 'dashboard.menu.clips' },
          { id: 'clip-settings', labelKey: 'dashboard.menu.clipSettings' },
          { id: 'health', labelKey: 'dashboard.menu.health' },
          { id: 'dependencies', labelKey: 'dashboard.menu.dependencies' },
          { id: 'capture', labelKey: 'dashboard.menu.capture' },
          { id: 'cameras', labelKey: 'dashboard.menu.cameras' },
          { id: 'people', labelKey: 'dashboard.menu.people' },
        ]
      : [
          { id: 'monitor', labelKey: 'dashboard.menu.monitor' },
          { id: 'clips', labelKey: 'dashboard.menu.clips' },
        ];
  const accessViews = portalSubmodules
    ? (portalSubmodules.administration ?? []).filter((view) => view.id !== 'audit')
    : [
        { id: 'users', labelKey: 'dashboard.menu.users' },
        { id: 'profiles', labelKey: 'dashboard.menu.profiles' },
        { id: 'requests', labelKey: 'dashboard.menu.accessRequests' },
      ];
  useEffect(() => {
    // While anonymous, keep the requested deep link in the address bar so a login (or a reload on
    // the login screen) can return to it after the server validates the session.
    if (screen !== 'authenticated') return;
    const search = serializeDeepLink({
      module: activeModule,
      view:
        activeModule === 'monitoring' ? monitoringView : activeModule === 'access' ? accessView : undefined,
      ...moduleParams,
    });
    const next = `${window.location.pathname}${search}`;
    if (`${window.location.pathname}${window.location.search}` !== next) {
      window.history.replaceState(null, '', next);
    }
  }, [screen, activeModule, monitoringView, accessView, moduleParams]);

  // Uma navegação real (módulo ou submódulo, incluindo o destino inicial de um deep link) gera um
  // evento de melhor esforço. A chave evita duplicar o mesmo destino em re-renderizações e o
  // evento não é fonte autoritativa: o portal deriva ator, sessão e rota.
  const emittedNavigation = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (screen !== 'authenticated') {
      emittedNavigation.current = undefined;
      return;
    }
    const view =
      activeModule === 'monitoring' ? monitoringView : activeModule === 'access' ? accessView : undefined;
    const key = `${activeModule}:${view ?? ''}`;
    if (emittedNavigation.current === key) return;
    emittedNavigation.current = key;
    shellEvents.navigationViewed({ module: activeModule, view });
  }, [screen, activeModule, monitoringView, accessView]);

  const appliedLink = useRef(false);
  useEffect(() => {
    if (appliedLink.current || !portalSubmodules || screen !== 'authenticated') return;
    appliedLink.current = true;
    const views =
      activeModule === 'monitoring' ? monitoringViews : activeModule === 'access' ? accessViews : [];
    if (views.length === 0) return;
    const current = activeModule === 'monitoring' ? monitoringView : accessView;
    if (views.some((view) => view.id === current)) return;
    if (activeModule === 'monitoring') setMonitoringView(views[0]?.id ?? 'monitor');
    if (activeModule === 'access') setAccessView(views[0]?.id ?? 'users');
  }, [screen, portalSubmodules, activeModule, monitoringViews, accessViews, monitoringView, accessView]);

  const moduleItems: Array<{
    id: ModuleView;
    icon: string;
    labelKey: TranslationKey;
    visible: boolean;
    views: Array<{ id: string; labelKey: TranslationKey }>;
  }> = [
    {
      id: 'monitoring',
      icon: '◉',
      labelKey: 'shell.modules.monitoring',
      visible: monitoringAllowed,
      views: monitoringViews.map((view) => ({ id: view.id, labelKey: view.labelKey as TranslationKey })),
    },
    {
      id: 'activitywatch',
      icon: '◔',
      labelKey: 'shell.modules.activitywatch',
      visible: activityWatchAllowed,
      views: [],
    },
    {
      id: 'access',
      icon: '◫',
      labelKey: 'shell.modules.access',
      visible: administrationAllowed,
      views: accessViews.map((view) => ({ id: view.id, labelKey: view.labelKey as TranslationKey })),
    },
    {
      id: 'systems',
      icon: '⚙',
      labelKey: 'shell.modules.systems',
      visible: administrationAllowed,
      views: [],
    },
    {
      id: 'audit',
      icon: '▤',
      labelKey: 'shell.modules.audit',
      visible: auditAllowed,
      views: [],
    },
  ];

  function selectModule(module: ModuleView) {
    setActiveModule(module);
    setModuleParams({});
    if (module === 'monitoring') setMonitoringView('monitor');
    if (module === 'access') setAccessView('users');
    setMobileNavOpen(false);
  }

  function selectSubmodule(module: ModuleView, view: string) {
    setActiveModule(module);
    setModuleParams({});
    if (module === 'monitoring') setMonitoringView(view);
    if (module === 'access') setAccessView(view);
    setMobileNavOpen(false);
  }

  return (
    <main className={`container app-shell py-4 py-md-5${sidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <AppHeader
        role={screen === 'authenticated' ? role : undefined}
        username={screen === 'authenticated' ? username : undefined}
        activeClients={screen === 'authenticated' && canMonitor ? clientCount : undefined}
        theme={theme}
        onThemeChange={setTheme}
        themeStyle={themeStyle}
        onThemeStyleChange={setThemeStyle}
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
      {screen === 'authenticated' &&
        role &&
        (monitoringAllowed || activityWatchAllowed || administrationAllowed) && (
          <>
            <button
              className="module-menu-button"
              type="button"
              aria-expanded={mobileNavOpen}
              aria-controls="module-navigation"
              onClick={() => setMobileNavOpen((open) => !open)}
            >
              <span aria-hidden="true">☰</span> {t('shell.modules.label')}
            </button>
            <nav
              id="module-navigation"
              className={`module-nav${mobileNavOpen ? ' is-open' : ''}`}
              aria-label={t('shell.modules.label')}
            >
              <button
                className="module-nav-toggle"
                type="button"
                aria-pressed={sidebarCollapsed}
                aria-label={t(sidebarCollapsed ? 'shell.modules.expand' : 'shell.modules.collapse')}
                title={t(sidebarCollapsed ? 'shell.modules.expand' : 'shell.modules.collapse')}
                onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
              >
                <span aria-hidden="true">{sidebarCollapsed ? '»' : '«'}</span>
              </button>
              <ul className="nav nav-pills">
                {moduleItems
                  .filter((item) => item.visible)
                  .map((item) => {
                    const isActive = activeModule === item.id;
                    const activeView =
                      item.id === 'monitoring'
                        ? monitoringView
                        : item.id === 'access'
                          ? accessView
                          : undefined;
                    return (
                      <li
                        className={`nav-item${item.views.length > 0 ? ' module-nav-group' : ''}`}
                        key={item.id}
                      >
                        <button
                          className={`nav-link ${isActive ? 'active' : ''}`}
                          type="button"
                          aria-label={t(item.labelKey)}
                          title={t(item.labelKey)}
                          aria-current={isActive ? 'page' : undefined}
                          onClick={() => selectModule(item.id)}
                        >
                          <span className="module-nav-icon" aria-hidden="true">
                            {item.icon}
                          </span>
                          <span className="module-nav-label">{t(item.labelKey)}</span>
                        </button>
                        {isActive && item.views.length > 0 && (
                          <ul
                            className="nav module-subnav"
                            aria-label={t('shell.modules.submodules', { module: t(item.labelKey) })}
                          >
                            {item.views.map((view) => (
                              <li className="nav-item" key={view.id}>
                                <button
                                  className={`nav-link ${activeView === view.id ? 'active' : ''}`}
                                  type="button"
                                  id={`module-subnav-${item.id}-${view.id}`}
                                  aria-current={activeView === view.id ? 'page' : undefined}
                                  onClick={() => selectSubmodule(item.id, view.id)}
                                >
                                  {t(view.labelKey)}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </nav>
          </>
        )}
      <div className="app-content">
        {screen === 'authenticated' && role && activeModule === 'monitoring' && monitoringAllowed && (
          <PortalModuleBoundary moduleId="monitoring">
            <Suspense fallback={<ModuleLoading />}>
              <RemoteMonitoringModule
                locale={locale}
                cameras={cameras}
                selectedCameraId={selectedCamera?.cameraId}
                onCameraSelect={setSelectedCameraId}
                userRole={role}
                portalModuleIds={portalModuleIds}
                activeView={monitoringView}
                deepLinkParams={moduleParams}
                onDeepLinkParamsChange={setModuleParams}
              />
            </Suspense>
          </PortalModuleBoundary>
        )}
        {screen === 'authenticated' && role && activeModule === 'activitywatch' && activityWatchAllowed && (
          <PortalModuleBoundary moduleId="activitywatch">
            <Suspense fallback={<ModuleLoading />}>
              <RemoteActivityWatchModule locale={locale} userRole={role} portalModuleIds={portalModuleIds} />
            </Suspense>
          </PortalModuleBoundary>
        )}
        {screen === 'authenticated' && role && activeModule === 'access' && administrationAllowed && (
          <PortalModuleBoundary moduleId="access">
            <Suspense fallback={<ModuleLoading />}>
              <RemoteAccessModule
                locale={locale}
                userRole={role}
                portalModuleIds={portalModuleIds}
                activeView={accessView}
                onViewChange={setAccessView}
              />
            </Suspense>
          </PortalModuleBoundary>
        )}
        {screen === 'authenticated' && role && activeModule === 'systems' && administrationAllowed && (
          <PortalModuleBoundary moduleId="systems">
            <Suspense fallback={<ModuleLoading />}>
              <RemoteSystemsModule locale={locale} userRole={role} portalModuleIds={portalModuleIds} />
            </Suspense>
          </PortalModuleBoundary>
        )}
        {screen === 'authenticated' && role && activeModule === 'audit' && auditAllowed && (
          <PortalModuleBoundary moduleId="audit">
            <Suspense fallback={<ModuleLoading />}>
              <RemoteAuditModule locale={locale} userRole={role} portalModuleIds={portalModuleIds} />
            </Suspense>
          </PortalModuleBoundary>
        )}
      </div>
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
