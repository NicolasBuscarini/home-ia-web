import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../i18n/i18n';
import type { TranslationKey } from '../../i18n/messages';
import { ApiError, getJson, request } from '../../services/http';

interface AccessRequestSummary {
  id: string;
  username: string;
  purpose: 'live_monitoring' | 'camera_access';
  status: 'pending' | 'reviewed';
  createdAtUtc: string;
}

interface AccessRequestPage {
  items: AccessRequestSummary[];
  page: number;
  pageSize: number;
  totalCount: number;
}

const purposeLabels: Record<AccessRequestSummary['purpose'], TranslationKey> = {
  live_monitoring: 'accessRequest.purpose.live',
  camera_access: 'accessRequest.purpose.camera',
};
const statusLabels: Record<AccessRequestSummary['status'], TranslationKey> = {
  pending: 'admin.accessRequests.status.pending',
  reviewed: 'admin.accessRequests.status.reviewed',
};

export function AdminAccessRequestsPanel() {
  const { t } = useI18n();
  const [pageNumber, setPageNumber] = useState(1);
  const [page, setPage] = useState<AccessRequestPage>();
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError('');
      try {
        setPage(
          await getJson<AccessRequestPage>(
            `/api/v1/admin/access-requests?page=${pageNumber}&pageSize=25`,
            signal,
          ),
        );
      } catch (failure) {
        setError(
          failure instanceof ApiError && failure.status === 403
            ? t('admin.accessRequests.error.forbidden')
            : t('admin.accessRequests.error.load'),
        );
      } finally {
        setLoading(false);
      }
    },
    [pageNumber, t],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function review(item: AccessRequestSummary) {
    setBusyId(item.id);
    setError('');
    setNotice('');
    try {
      const response = await request(`/api/v1/admin/access-requests/${item.id}/review`, { method: 'POST' });
      if (!response.ok) throw new ApiError(`HTTP ${response.status}`, response.status);
      setNotice(t('admin.accessRequests.notice.reviewed'));
      await load();
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.status === 403
          ? t('admin.accessRequests.error.forbidden')
          : t('admin.accessRequests.error.review'),
      );
    } finally {
      setBusyId(undefined);
    }
  }

  const totalPages = page ? Math.max(1, Math.ceil(page.totalCount / page.pageSize)) : 1;
  return (
    <section className="panel-card" aria-labelledby="admin-access-requests-title">
      <span className="eyebrow">{t('admin.accessRequests.eyebrow')}</span>
      <h2 id="admin-access-requests-title" className="h4 mt-2">
        {t('admin.accessRequests.title')}
      </h2>
      <p className="text-secondary">{t('admin.accessRequests.description')}</p>
      {error && (
        <div className="error-text" role="alert">
          <p>{error}</p>
          <button className="btn btn-outline-light btn-sm" type="button" onClick={() => void load()}>
            {t('admin.accessRequests.retry')}
          </button>
        </div>
      )}
      {notice && (
        <p role="status" aria-live="polite">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">{t('admin.accessRequests.loading')}</p>
      ) : page?.items.length === 0 ? (
        <p role="status">{t('admin.accessRequests.empty')}</p>
      ) : (
        <>
          <ul className="admin-grant-list">
            {page?.items.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.username}</strong>
                  <p className="small mb-1">{t(purposeLabels[item.purpose])}</p>
                  <p className="small text-secondary mb-0">
                    {t(statusLabels[item.status])} · {new Date(item.createdAtUtc).toLocaleString()}
                  </p>
                </div>
                {item.status === 'pending' && (
                  <button
                    className="btn btn-outline-light btn-sm"
                    type="button"
                    disabled={!!busyId}
                    onClick={() => void review(item)}
                  >
                    {busyId === item.id
                      ? t('admin.accessRequests.reviewing')
                      : t('admin.accessRequests.review')}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <nav className="admin-pagination mt-3" aria-label={t('admin.accessRequests.pagination')}>
              <button
                className="btn btn-outline-light btn-sm"
                type="button"
                disabled={loading || pageNumber <= 1}
                onClick={() => setPageNumber((value) => value - 1)}
              >
                {t('admin.accessRequests.previous')}
              </button>
              <span>{t('admin.accessRequests.page', { current: pageNumber, total: totalPages })}</span>
              <button
                className="btn btn-outline-light btn-sm"
                type="button"
                disabled={loading || pageNumber >= totalPages}
                onClick={() => setPageNumber((value) => value + 1)}
              >
                {t('admin.accessRequests.next')}
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
