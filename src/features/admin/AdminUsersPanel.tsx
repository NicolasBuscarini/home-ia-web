import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../i18n/i18n';
import { ApiError, getJson, request } from '../../services/http';

type ErrorKind = 'load' | 'support' | 'save' | 'deactivate' | 'forbidden' | 'conflict' | 'session';
interface UserSummary {
  id: string;
  userName: string;
  isActive: boolean;
}
interface Camera {
  cameraId: string;
  contextId: string;
  name: string;
  isEnabled: boolean;
}
interface Profile {
  id: string;
  currentVersionId: string;
  name: string;
  isActive: boolean;
  version: number;
  updatedAtUtc: string;
  permissionKeys: string[];
}
interface Scope {
  contextId: string;
  cameraId: string;
}
interface Assignment {
  assignmentId: string;
  profileId: string;
  profileVersionId: string;
  profileName: string;
  profileVersion: number;
  scopes: Scope[];
}
interface UserDetails extends UserSummary {
  isAdministrator: boolean;
  accessProfiles: Assignment[];
}
interface Page {
  items: UserSummary[];
  page: number;
  pageSize: number;
  totalCount: number;
}
interface DraftAssignment {
  profileId: string;
  profileVersionId: string;
  profileVersion: number;
  scopes: string[];
}

function errorKind(error: unknown, fallback: ErrorKind): ErrorKind {
  if (error instanceof ApiError && error.status === 401) return 'session';
  if (error instanceof ApiError && error.status === 403) return 'forbidden';
  if (error instanceof ApiError && error.status === 409) return 'conflict';
  return fallback;
}

export function AdminUsersPanel() {
  const { t } = useI18n();
  const [page, setPage] = useState<Page>();
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [expandedId, setExpandedId] = useState<string>();
  const [detail, setDetail] = useState<UserDetails>();
  const [assignments, setAssignments] = useState<DraftAssignment[]>([]);
  const [supportReady, setSupportReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorKind | ''>('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (requestedPage: number, signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    setSupportReady(false);
    try {
      const [usersResult, catalogResult, profilesResult] = await Promise.allSettled([
        getJson<Page>(`/api/v1/admin/users?page=${requestedPage}&pageSize=25`, signal),
        getJson<{ items: Camera[] }>('/api/v1/admin/cameras?page=1&pageSize=100', signal),
        getJson<Profile[]>('/api/v1/admin/access-rules', signal),
      ]);
      if (usersResult.status === 'rejected') throw usersResult.reason;
      setPage(usersResult.value);
      const available = catalogResult.status === 'fulfilled' && profilesResult.status === 'fulfilled';
      setSupportReady(available);
      if (catalogResult.status === 'fulfilled') setCameras(catalogResult.value.items);
      if (profilesResult.status === 'fulfilled') setProfiles(profilesResult.value);
      if (!available && !signal?.aborted) setError('support');
    } catch (failure) {
      if (!signal?.aborted) setError(errorKind(failure, 'load'));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(pageNumber, controller.signal);
    return () => controller.abort();
  }, [load, pageNumber]);

  async function openDetails(user: UserSummary) {
    setNotice('');
    if (expandedId === user.id) {
      setExpandedId(undefined);
      setDetail(undefined);
      return;
    }
    setExpandedId(user.id);
    setDetail(undefined);
    setBusy(true);
    setError('');
    try {
      const result = await getJson<UserDetails>(`/api/v1/admin/users/${user.id}`);
      setDetail(result);
      setAssignments(
        result.accessProfiles.map((item) => ({
          profileId: item.profileId,
          profileVersionId: item.profileVersionId,
          profileVersion: item.profileVersion,
          scopes: item.scopes.map((scope) => `${scope.contextId}\u0000${scope.cameraId}`),
        })),
      );
    } catch (failure) {
      setError(errorKind(failure, 'load'));
      setExpandedId(undefined);
    } finally {
      setBusy(false);
    }
  }

  function selectProfile(profile: Profile, selected: boolean) {
    setAssignments((current) =>
      selected
        ? [
            ...current,
            {
              profileId: profile.id,
              profileVersionId: profile.currentVersionId,
              profileVersion: profile.version,
              scopes: [],
            },
          ]
        : current.filter((item) => item.profileId !== profile.id),
    );
  }

  function toggleScope(profileVersionId: string, scopeId: string, selected: boolean) {
    setAssignments((current) =>
      current.map((item) =>
        item.profileVersionId !== profileVersionId
          ? item
          : {
              ...item,
              scopes: selected ? [...item.scopes, scopeId] : item.scopes.filter((value) => value !== scopeId),
            },
      ),
    );
  }

  async function saveAssignments() {
    if (!detail || !supportReady || assignments.some((item) => item.scopes.length === 0)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await request(`/api/v1/admin/users/${detail.id}/access-rules`, {
        method: 'PUT',
        body: JSON.stringify({
          assignments: assignments.map((item) => ({
            profileVersionId: item.profileVersionId,
            scopes: item.scopes.map((value) => {
              const [contextId, cameraId] = value.split('\u0000');
              return { contextId, cameraId };
            }),
          })),
        }),
      });
      if (!response.ok) throw new ApiError(`HTTP ${response.status}`, response.status);
      const updated = await getJson<UserDetails>(`/api/v1/admin/users/${detail.id}`);
      setDetail(updated);
      setAssignments(
        updated.accessProfiles.map((item) => ({
          profileId: item.profileId,
          profileVersionId: item.profileVersionId,
          profileVersion: item.profileVersion,
          scopes: item.scopes.map((scope) => `${scope.contextId}\u0000${scope.cameraId}`),
        })),
      );
      setNotice(t('admin.users.notice.saved'));
    } catch (failure) {
      setError(errorKind(failure, 'save'));
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(user: UserSummary) {
    if (!window.confirm(t('admin.users.confirmDeactivate', { username: user.userName }))) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await request(`/api/v1/admin/users/${user.id}`, { method: 'DELETE' });
      if (!response.ok) throw new ApiError(`HTTP ${response.status}`, response.status);
      setExpandedId(undefined);
      setDetail(undefined);
      setNotice(t('admin.users.notice.deactivated'));
      await load(pageNumber);
    } catch (failure) {
      setError(errorKind(failure, 'deactivate'));
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
          <p>{t(`admin.users.error.${error}`)}</p>
          {(error === 'load' || error === 'support') && (
            <button
              className="btn btn-outline-light btn-sm"
              type="button"
              onClick={() => void load(pageNumber)}
            >
              {t('admin.users.retry')}
            </button>
          )}
        </div>
      )}
      {notice && (
        <p className="admin-notice" role="status" aria-live="polite">
          {notice}
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
                        {detail.isAdministrator ? (
                          <p className="small text-secondary">{t('admin.users.adminReserved')}</p>
                        ) : (
                          <fieldset className="admin-fieldset">
                            <legend>{t('admin.users.assignedProfiles')}</legend>
                            {profiles.length === 0 && (
                              <p className="small text-secondary">{t('admin.users.noProfiles')}</p>
                            )}
                            {profiles
                              .filter((profile) => profile.isActive)
                              .map((profile) => {
                                const draft = assignments.find((item) => item.profileId === profile.id);
                                return (
                                  <div className="admin-profile-assignment" key={profile.id}>
                                    <label className="form-check">
                                      <input
                                        className="form-check-input"
                                        type="checkbox"
                                        checked={!!draft}
                                        disabled={busy || !user.isActive}
                                        onChange={(event) => selectProfile(profile, event.target.checked)}
                                      />
                                      <span className="form-check-label">
                                        {profile.name} · v{draft?.profileVersion ?? profile.version}
                                      </span>
                                    </label>
                                    {draft && draft.profileVersionId !== profile.currentVersionId && (
                                      <button
                                        className="btn btn-outline-light btn-sm ms-3"
                                        type="button"
                                        disabled={busy || !user.isActive}
                                        onClick={() =>
                                          setAssignments((current) =>
                                            current.map((item) =>
                                              item.profileId === profile.id
                                                ? {
                                                    ...item,
                                                    profileVersionId: profile.currentVersionId,
                                                    profileVersion: profile.version,
                                                  }
                                                : item,
                                            ),
                                          )
                                        }
                                      >
                                        {t('admin.users.applyCurrentVersion')}
                                      </button>
                                    )}
                                    {draft && (
                                      <fieldset className="admin-fieldset ms-3">
                                        <legend className="small">{t('admin.users.scopeForProfile')}</legend>
                                        {cameras
                                          .filter((camera) => camera.isEnabled)
                                          .map((camera) => {
                                            const scopeId = `${camera.contextId}\u0000${camera.cameraId}`;
                                            return (
                                              <label className="form-check" key={camera.cameraId}>
                                                <input
                                                  className="form-check-input"
                                                  type="checkbox"
                                                  checked={draft.scopes.includes(scopeId)}
                                                  disabled={busy || !user.isActive}
                                                  onChange={(event) =>
                                                    toggleScope(
                                                      draft.profileVersionId,
                                                      scopeId,
                                                      event.target.checked,
                                                    )
                                                  }
                                                />
                                                <span className="form-check-label">
                                                  {camera.name} ({camera.contextId} · {camera.cameraId})
                                                </span>
                                              </label>
                                            );
                                          })}
                                      </fieldset>
                                    )}
                                  </div>
                                );
                              })}
                            <p className="small text-secondary">
                              {t('admin.users.permissionsFromProfileOnly')}
                            </p>
                            <button
                              className="btn btn-primary btn-sm"
                              type="button"
                              onClick={() => void saveAssignments()}
                              disabled={
                                busy ||
                                !supportReady ||
                                !user.isActive ||
                                assignments.some((item) => item.scopes.length === 0)
                              }
                            >
                              {t('admin.users.saveProfiles')}
                            </button>
                          </fieldset>
                        )}
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
            onClick={() => setPageNumber((value) => value - 1)}
          >
            {t('admin.users.previous')}
          </button>
          <span aria-live="polite">{t('admin.users.page', { current: pageNumber, total: totalPages })}</span>
          <button
            className="btn btn-outline-light btn-sm"
            type="button"
            disabled={loading || pageNumber >= totalPages}
            onClick={() => setPageNumber((value) => value + 1)}
          >
            {t('admin.users.next')}
          </button>
        </nav>
      )}
    </section>
  );
}
