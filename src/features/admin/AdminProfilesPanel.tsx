import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../i18n/i18n';
import { ApiError, getJson, request } from '../../services/http';

interface Profile {
  id: string;
  currentVersionId: string;
  name: string;
  isActive: boolean;
  version: number;
  updatedAtUtc: string;
  permissionKeys: string[];
}

interface Permission {
  key: string;
  description: string;
  isDelegable: boolean;
}

type ErrorKind = 'load' | 'permissions' | 'save' | 'forbidden' | 'conflict' | 'session';

function errorKind(error: unknown, fallback: ErrorKind): ErrorKind {
  if (error instanceof ApiError && error.status === 401) return 'session';
  if (error instanceof ApiError && error.status === 403) return 'forbidden';
  if (error instanceof ApiError && error.status === 409) return 'conflict';
  return fallback;
}

export function AdminProfilesPanel() {
  const { t } = useI18n();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [profileName, setProfileName] = useState('');
  const [editingProfileId, setEditingProfileId] = useState('');
  const [permissionKeys, setPermissionKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorKind | ''>('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const [profilesResult, permissionsResult] = await Promise.allSettled([
        getJson<Profile[]>('/api/v1/admin/access-rules', signal),
        getJson<Permission[]>('/api/v1/admin/permission-catalog', signal),
      ]);
      if (profilesResult.status === 'rejected') throw profilesResult.reason;
      setProfiles(profilesResult.value);
      if (permissionsResult.status === 'fulfilled') {
        setPermissions(permissionsResult.value.filter((permission) => permission.isDelegable));
      } else {
        setPermissions([]);
        if (!signal?.aborted) setError('permissions');
      }
    } catch (failure) {
      if (!signal?.aborted) setError(errorKind(failure, 'load'));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function saveProfile() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const editing = profiles.find((item) => item.id === editingProfileId);
      const response = await request(
        editing ? `/api/v1/admin/access-rules/${editing.id}/versions` : '/api/v1/admin/access-rules',
        {
          method: 'POST',
          body: JSON.stringify(
            editing
              ? { expectedVersion: editing.version, permissionKeys }
              : { name: profileName, permissionKeys },
          ),
        },
      );
      if (!response.ok) throw new ApiError(`HTTP ${response.status}`, response.status);
      setProfileName('');
      setEditingProfileId('');
      setPermissionKeys([]);
      await load();
      setNotice(t('admin.profiles.notice.saved'));
    } catch (failure) {
      setError(errorKind(failure, 'save'));
    } finally {
      setBusy(false);
    }
  }

  const editing = profiles.find((profile) => profile.id === editingProfileId);

  return (
    <section className="panel-card admin-profiles-panel" aria-labelledby="admin-profiles-title">
      <div className="admin-users-heading">
        <div>
          <span className="eyebrow">{t('admin.profiles.eyebrow')}</span>
          <h2 id="admin-profiles-title" className="h4 mt-2">
            {t('admin.profiles.title')}
          </h2>
          <p className="text-secondary mb-0">{t('admin.profiles.description')}</p>
        </div>
      </div>

      {loading && (
        <p role="status" aria-live="polite">
          {t('admin.profiles.loading')}
        </p>
      )}
      {error && (
        <div className="error-text" role="alert">
          <p>{t(`admin.profiles.error.${error}`)}</p>
          {(error === 'load' || error === 'permissions') && (
            <button className="btn btn-outline-light btn-sm" type="button" onClick={() => void load()}>
              {t('admin.profiles.retry')}
            </button>
          )}
        </div>
      )}
      {notice && (
        <p className="admin-notice" role="status" aria-live="polite">
          {notice}
        </p>
      )}

      <fieldset className="admin-fieldset mt-3">
        <legend>{t('admin.profiles.editor')}</legend>
        <label className="form-label" htmlFor="access-profile-name">
          {t('admin.profiles.name')}
        </label>
        <input
          id="access-profile-name"
          className="form-control"
          value={profileName}
          onChange={(event) => setProfileName(event.currentTarget.value)}
          disabled={busy || !!editingProfileId}
          placeholder={t('admin.profiles.namePlaceholder')}
        />
        <label className="form-label mt-2" htmlFor="access-profile-edit">
          {t('admin.profiles.editExisting')}
        </label>
        <select
          id="access-profile-edit"
          className="form-select"
          value={editingProfileId}
          disabled={busy}
          onChange={(event) => {
            const id = event.currentTarget.value;
            const selected = profiles.find((profile) => profile.id === id);
            setEditingProfileId(id);
            setProfileName(selected?.name ?? '');
            setPermissionKeys(selected?.permissionKeys ?? []);
          }}
        >
          <option value="">{t('admin.profiles.newProfile')}</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id} disabled={!profile.isActive}>
              {profile.name} · v{profile.version}
            </option>
          ))}
        </select>
        {editing && (
          <p className="small text-secondary mt-2">
            {t('admin.profiles.versionNotice', { version: editing.version })}
          </p>
        )}
        <div className="admin-role-list">
          {permissions.map((permission) => (
            <label className="form-check" key={permission.key}>
              <input
                className="form-check-input"
                type="checkbox"
                checked={permissionKeys.includes(permission.key)}
                disabled={busy}
                onChange={(event) =>
                  setPermissionKeys((current) =>
                    event.target.checked
                      ? [...current, permission.key]
                      : current.filter((key) => key !== permission.key),
                  )
                }
              />
              <span className="form-check-label">
                <strong>{permission.key}</strong> — {permission.description}
              </span>
            </label>
          ))}
        </div>
        <button
          className="btn btn-primary btn-sm mt-2"
          type="button"
          onClick={() => void saveProfile()}
          disabled={busy || (!editingProfileId && !profileName.trim())}
        >
          {editingProfileId ? t('admin.profiles.publishVersion') : t('admin.profiles.create')}
        </button>
        {editingProfileId && (
          <button
            className="btn btn-outline-light btn-sm mt-2 ms-2"
            type="button"
            disabled={busy}
            onClick={() => {
              setEditingProfileId('');
              setProfileName('');
              setPermissionKeys([]);
            }}
          >
            {t('admin.profiles.cancelEdit')}
          </button>
        )}
      </fieldset>

      <section className="mt-4" aria-labelledby="admin-profile-list-title">
        <h3 id="admin-profile-list-title" className="h5">
          {t('admin.profiles.listTitle')}
        </h3>
        {!loading && profiles.length === 0 && (
          <p className="small text-secondary" role="status">
            {t('admin.profiles.empty')}
          </p>
        )}
        <ul className="admin-profile-list">
          {profiles.map((profile) => (
            <li className="admin-profile-card" key={profile.id}>
              <div className="admin-user-summary">
                <div>
                  <h4 className="h6 mb-1">
                    {profile.name} · v{profile.version}
                  </h4>
                  <span className={`admin-account-state${profile.isActive ? ' is-active' : ''}`}>
                    {profile.isActive ? t('admin.profiles.active') : t('admin.profiles.inactive')}
                  </span>
                </div>
                {profile.isActive && (
                  <button
                    className="btn btn-outline-light btn-sm"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEditingProfileId(profile.id);
                      setProfileName(profile.name);
                      setPermissionKeys(profile.permissionKeys);
                    }}
                  >
                    {t('admin.profiles.edit')}
                  </button>
                )}
              </div>
              <p className="small text-secondary mb-1">{t('admin.profiles.permissions')}</p>
              {profile.permissionKeys.length > 0 ? (
                <ul className="admin-profile-permissions">
                  {profile.permissionKeys.map((key) => (
                    <li key={key}>
                      <code>{key}</code>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="small text-secondary mb-0">{t('admin.profiles.noPermissions')}</p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
