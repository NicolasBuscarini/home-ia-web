import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../i18n/i18n';
import { ApiError, getJson, request } from '../../services/http';

type AssignableRole = 'User' | 'Viewer' | 'Administrator';
type AdminUserError =
  | 'load'
  | 'detail'
  | 'save'
  | 'grant'
  | 'deactivate'
  | 'forbidden'
  | 'conflict'
  | 'session';
type AdminUserNotice = 'saved' | 'granted' | 'revoked' | 'deactivated';

const errorKeys = {
  load: 'admin.users.error.load',
  detail: 'admin.users.error.detail',
  save: 'admin.users.error.save',
  grant: 'admin.users.error.grant',
  deactivate: 'admin.users.error.deactivate',
  forbidden: 'admin.users.error.forbidden',
  conflict: 'admin.users.error.conflict',
  session: 'admin.users.error.session',
} as const;

const noticeKeys = {
  saved: 'admin.users.notice.saved',
  granted: 'admin.users.notice.granted',
  revoked: 'admin.users.notice.revoked',
  deactivated: 'admin.users.notice.deactivated',
} as const;

interface AdminUserSummary {
  id: string;
  userName: string;
  isActive: boolean;
}

interface AdminUserDetails extends AdminUserSummary {
  roles: AssignableRole[];
  cameraGrants: Array<{
    contextId: string;
    cameraId: string;
    cameraName: string | null;
    grantedAtUtc: string;
    revokedAtUtc: string | null;
  }>;
}

interface UserPage {
  items: AdminUserSummary[];
  page: number;
  pageSize: number;
  totalCount: number;
}

interface CameraPage {
  items: Array<{
    cameraId: string;
    contextId: string;
    name: string;
    isEnabled: boolean;
  }>;
}

const roles: AssignableRole[] = ['User', 'Viewer', 'Administrator'];

function errorMessage(error: unknown, fallback: AdminUserError): AdminUserError {
  if (error instanceof ApiError && error.status === 401) return 'session';
  if (error instanceof ApiError && error.status === 403) return 'forbidden';
  if (error instanceof ApiError && error.status === 409) return 'conflict';
  return fallback;
}

export function AdminUsersPanel() {
  const { t } = useI18n();
  const [page, setPage] = useState<UserPage>();
  const [cameras, setCameras] = useState<CameraPage['items']>([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [expandedId, setExpandedId] = useState<string>();
  const [detail, setDetail] = useState<AdminUserDetails>();
  const [selectedRoles, setSelectedRoles] = useState<AssignableRole[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AdminUserError | ''>('');
  const [notice, setNotice] = useState<AdminUserNotice | ''>('');

  const loadPage = useCallback(async (requestedPage: number, signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const [users, catalog] = await Promise.all([
        getJson<UserPage>(`/api/v1/admin/users?page=${requestedPage}&pageSize=25`, signal),
        getJson<CameraPage>('/api/v1/admin/cameras?page=1&pageSize=100', signal),
      ]);
      setPage(users);
      setCameras(catalog.items);
    } catch (failure) {
      if (!signal?.aborted) setError(errorMessage(failure, 'load'));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadPage(pageNumber, controller.signal);
    return () => controller.abort();
  }, [loadPage, pageNumber]);

  async function openDetails(user: AdminUserSummary) {
    setNotice('');
    if (expandedId === user.id) {
      setExpandedId(undefined);
      setDetail(undefined);
      setSelectedCameraId('');
      return;
    }
    setExpandedId(user.id);
    setDetail(undefined);
    setBusy(true);
    try {
      const result = await getJson<AdminUserDetails>(`/api/v1/admin/users/${user.id}`);
      setDetail(result);
      setSelectedRoles(result.roles);
      setSelectedCameraId('');
    } catch (failure) {
      setError(errorMessage(failure, 'detail'));
      setExpandedId(undefined);
    } finally {
      setBusy(false);
    }
  }

  async function updateRoles() {
    if (!detail || selectedRoles.length === 0) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await request(`/api/v1/admin/users/${detail.id}/roles`, {
        method: 'PUT',
        body: JSON.stringify({ roles: selectedRoles }),
      });
      if (!response.ok) throw new ApiError(`HTTP ${response.status}`, response.status);
      const updated = await getJson<AdminUserDetails>(`/api/v1/admin/users/${detail.id}`);
      setDetail(updated);
      setSelectedRoles(updated.roles);
      setNotice('saved');
    } catch (failure) {
      setError(errorMessage(failure, 'save'));
    } finally {
      setBusy(false);
    }
  }

  async function changeCameraGrant(cameraId: string, granted: boolean) {
    if (!detail) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await request(
        `/api/v1/admin/users/${detail.id}/cameras/${encodeURIComponent(cameraId)}`,
        { method: granted ? 'PUT' : 'DELETE' },
      );
      if (!response.ok) throw new ApiError(`HTTP ${response.status}`, response.status);
      const updated = await getJson<AdminUserDetails>(`/api/v1/admin/users/${detail.id}`);
      setDetail(updated);
      setNotice(granted ? 'granted' : 'revoked');
    } catch (failure) {
      setError(errorMessage(failure, 'grant'));
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(user: AdminUserSummary) {
    if (!window.confirm(t('admin.users.confirmDeactivate', { username: user.userName }))) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await request(`/api/v1/admin/users/${user.id}`, { method: 'DELETE' });
      if (!response.ok) throw new ApiError(`HTTP ${response.status}`, response.status);
      setExpandedId(undefined);
      setDetail(undefined);
      setNotice('deactivated');
      await loadPage(pageNumber);
    } catch (failure) {
      setError(errorMessage(failure, 'deactivate'));
    } finally {
      setBusy(false);
    }
  }

  const totalPages = page ? Math.max(1, Math.ceil(page.totalCount / page.pageSize)) : 1;

  return (
    <section className="panel-card admin-users-panel" aria-labelledby="admin-users-title">
      <div className="admin-users-heading">
        <div>
          <span className="eyebrow">{t('admin.users.eyebrow')}</span>
          <h2 id="admin-users-title" className="h4 mt-2">
            {t('admin.users.title')}
          </h2>
          <p className="text-secondary mb-0">{t('admin.users.description')}</p>
        </div>
        <span className="small text-secondary">
          {t('admin.users.total', { count: page?.totalCount ?? 0 })}
        </span>
      </div>

      {loading && (
        <p role="status" aria-live="polite">
          {t('admin.users.loading')}
        </p>
      )}
      {error && (
        <div className="error-text" role="alert">
          <p>{t(errorKeys[error])}</p>
          {error === 'load' && (
            <button
              className="btn btn-outline-light btn-sm"
              type="button"
              onClick={() => void loadPage(pageNumber)}
            >
              {t('admin.users.retry')}
            </button>
          )}
        </div>
      )}
      {notice && (
        <p className="admin-notice" role="status" aria-live="polite">
          {t(noticeKeys[notice])}
        </p>
      )}

      {!loading && page?.items.length === 0 && (
        <p className="small text-secondary" role="status">
          {t('admin.users.empty')}
        </p>
      )}
      {page && page.items.length > 0 && (
        <div className="admin-user-list">
          {page.items.map((user) => {
            const expanded = expandedId === user.id;
            const activeGrants =
              detail?.id === user.id ? detail.cameraGrants.filter((grant) => !grant.revokedAtUtc) : [];
            const availableCameras = cameras.filter(
              (camera) =>
                camera.isEnabled && !activeGrants.some((grant) => grant.cameraId === camera.cameraId),
            );
            const grantCameraId = availableCameras.some((camera) => camera.cameraId === selectedCameraId)
              ? selectedCameraId
              : (availableCameras[0]?.cameraId ?? '');
            return (
              <article className="admin-user-card" key={user.id}>
                <div className="admin-user-summary">
                  <div>
                    <h3 className="h6 mb-1">{user.userName}</h3>
                    <span className={`admin-account-state${user.isActive ? ' is-active' : ''}`}>
                      {user.isActive ? t('admin.users.active') : t('admin.users.inactive')}
                    </span>
                  </div>
                  <button
                    className="btn btn-outline-light btn-sm"
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={`admin-user-detail-${user.id}`}
                    onClick={() => void openDetails(user)}
                    disabled={busy}
                  >
                    {expanded ? t('admin.users.collapse') : t('admin.users.expand')}
                  </button>
                </div>

                {expanded && (
                  <div id={`admin-user-detail-${user.id}`} className="admin-user-detail">
                    {!detail && <p role="status">{t('admin.users.loadingDetail')}</p>}
                    {detail?.id === user.id && (
                      <>
                        <fieldset className="admin-fieldset">
                          <legend>{t('admin.users.roles')}</legend>
                          <div className="admin-role-list">
                            {roles.map((role) => (
                              <label className="form-check" key={role}>
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  checked={selectedRoles.includes(role)}
                                  onChange={(event) =>
                                    setSelectedRoles((current) =>
                                      event.target.checked
                                        ? [...current, role]
                                        : current.filter((item) => item !== role),
                                    )
                                  }
                                  disabled={busy || !user.isActive}
                                />
                                <span className="form-check-label">{t(`admin.users.role.${role}`)}</span>
                              </label>
                            ))}
                          </div>
                          <button
                            className="btn btn-primary btn-sm mt-2"
                            type="button"
                            onClick={() => void updateRoles()}
                            disabled={busy || !user.isActive || selectedRoles.length === 0}
                          >
                            {t('admin.users.saveRoles')}
                          </button>
                        </fieldset>

                        <fieldset className="admin-fieldset">
                          <legend>{t('admin.users.cameraAccess')}</legend>
                          {activeGrants.length === 0 ? (
                            <p className="small text-secondary">{t('admin.users.noActiveGrants')}</p>
                          ) : (
                            <ul className="admin-grant-list">
                              {activeGrants.map((grant) => (
                                <li key={`${grant.contextId}-${grant.cameraId}`}>
                                  <span>
                                    {grant.cameraName ?? grant.cameraId}{' '}
                                    <small>
                                      ({grant.contextId} · {grant.cameraId})
                                    </small>
                                  </span>
                                  <button
                                    className="btn btn-outline-light btn-sm"
                                    type="button"
                                    onClick={() => void changeCameraGrant(grant.cameraId, false)}
                                    disabled={busy || !user.isActive}
                                  >
                                    {t('admin.users.revoke')}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                          {availableCameras.length > 0 ? (
                            <div className="admin-grant-create mt-3">
                              <label className="form-label" htmlFor={`admin-camera-${user.id}`}>
                                {t('admin.users.grantCamera')}
                              </label>
                              <div className="d-flex flex-wrap gap-2">
                                <select
                                  id={`admin-camera-${user.id}`}
                                  className="form-select admin-camera-select"
                                  value={grantCameraId}
                                  onChange={(event) => setSelectedCameraId(event.currentTarget.value)}
                                  disabled={busy || !user.isActive}
                                >
                                  {availableCameras.map((camera) => (
                                    <option key={camera.cameraId} value={camera.cameraId}>
                                      {camera.name} ({camera.contextId} · {camera.cameraId})
                                    </option>
                                  ))}
                                </select>
                                <button
                                  className="btn btn-primary btn-sm"
                                  type="button"
                                  onClick={() => void changeCameraGrant(grantCameraId, true)}
                                  disabled={busy || !user.isActive || !grantCameraId}
                                >
                                  {t('admin.users.grant')}
                                </button>
                              </div>
                            </div>
                          ) : cameras.length === 0 ? (
                            <p className="small text-secondary">{t('admin.users.noCameras')}</p>
                          ) : (
                            <p className="small text-secondary">{t('admin.users.allCamerasGranted')}</p>
                          )}
                        </fieldset>

                        {user.isActive && (
                          <div className="admin-danger-zone">
                            <p className="small text-secondary mb-2">{t('admin.users.deactivateHelp')}</p>
                            <button
                              className="btn btn-outline-danger btn-sm"
                              type="button"
                              onClick={() => void deactivate(user)}
                              disabled={busy}
                            >
                              {t('admin.users.deactivate')}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {page && totalPages > 1 && (
        <nav className="admin-pagination mt-3" aria-label={t('admin.users.pagination')}>
          <button
            className="btn btn-outline-light btn-sm"
            type="button"
            disabled={loading || pageNumber <= 1}
            onClick={() => setPageNumber((current) => current - 1)}
          >
            {t('admin.users.previous')}
          </button>
          <span aria-live="polite">{t('admin.users.page', { current: pageNumber, total: totalPages })}</span>
          <button
            className="btn btn-outline-light btn-sm"
            type="button"
            disabled={loading || pageNumber >= totalPages}
            onClick={() => setPageNumber((current) => current + 1)}
          >
            {t('admin.users.next')}
          </button>
        </nav>
      )}
    </section>
  );
}
