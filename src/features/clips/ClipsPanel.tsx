import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../i18n/i18n';
import type { TranslationKey } from '../../i18n/messages';
import { ApiError, getJson } from '../../services/http';

interface ClipItem {
  clipId: string;
  cameraId: string;
  startedAtUtc: string;
  endedAtUtc: string;
  state: string;
  archiveStatus: string;
  analysisStatus: string;
  thumbnailUrl: string | null;
  sizeBytes: number | null;
  triggerReason: string | null;
  triggerConfigVersion: string | null;
}
interface ClipPage {
  items: ClipItem[];
  page: number;
  pageSize: number;
  total: number;
}
interface ClipDetails {
  clip: ClipItem;
  mediaUrl: string | null;
  mediaSha256: string | null;
  thumbnailSha256: string | null;
  segmentIds: string[];
  attemptCount: number;
  updatedAtUtc: string;
}

const PAGE_SIZE = 20;
const stateKeys: Record<string, TranslationKey> = {
  collecting: 'clips.state.collecting',
  ready: 'clips.state.ready',
  failed: 'clips.state.failed',
  lost_capacity: 'clips.state.lost_capacity',
};
const archiveKeys: Record<string, TranslationKey> = {
  not_requested: 'clips.archive.not_requested',
  pending: 'clips.archive.pending',
  copying: 'clips.archive.copying',
  verifying: 'clips.archive.verifying',
  archived: 'clips.archive.archived',
  retry_wait: 'clips.archive.retry_wait',
  failed: 'clips.archive.failed',
};
const analysisKeys: Record<string, TranslationKey> = {
  not_requested: 'clips.analysisState.not_requested',
  analysis_pending: 'clips.analysisState.analysis_pending',
  processing: 'clips.analysisState.processing',
  retry_wait: 'clips.analysisState.retry_wait',
  failed: 'clips.analysisState.failed',
};
export function ClipsPanel({ cameraId }: { cameraId?: string }) {
  const { t, locale } = useI18n();
  const [items, setItems] = useState<ClipItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [state, setState] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<ClipDetails>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (targetPage = 1) => {
      setBusy(true);
      setError('');
      try {
        const query = new URLSearchParams({ page: String(targetPage), pageSize: String(PAGE_SIZE) });
        if (cameraId) query.set('cameraId', cameraId);
        if (state) query.set('state', state);
        if (from) query.set('fromUtc', new Date(`${from}T00:00:00Z`).toISOString());
        if (to) query.set('toUtc', new Date(`${to}T23:59:59.999Z`).toISOString());
        const result = await getJson<ClipPage>(`/api/v1/clips?${query}`);
        setItems(result.items);
        setTotal(result.total);
        setPage(result.page);
      } catch (failure) {
        setError(
          failure instanceof ApiError && failure.status === 403
            ? t('clips.error.denied')
            : t('clips.error.load'),
        );
        setItems([]);
        setTotal(0);
      } finally {
        setBusy(false);
      }
    },
    [cameraId, from, state, t, to],
  );

  useEffect(() => {
    setSelected(undefined);
    void load(1);
  }, [load]);

  async function openClip(clipId: string) {
    setSelected(undefined);
    setError('');
    try {
      setSelected(await getJson<ClipDetails>(`/api/v1/clips/${encodeURIComponent(clipId)}`));
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.status === 403
          ? t('clips.error.denied')
          : t('clips.error.detail'),
      );
    }
  }

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));

  return (
    <section className="panel-card clips-panel" aria-labelledby="clips-title">
      <span className="eyebrow">{t('clips.eyebrow')}</span>
      <h2 id="clips-title" className="h5 mt-2">
        {t('clips.title')}
      </h2>
      <p className="small text-secondary">{t('clips.description')}</p>
      <form
        className="row g-2 align-items-end mb-3"
        onSubmit={(event) => {
          event.preventDefault();
          void load(1);
        }}
      >
        <div className="col-12 col-sm-6 col-lg-3">
          <label className="form-label" htmlFor="clips-from">
            {t('clips.from')}
          </label>
          <input
            className="form-control"
            id="clips-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>
        <div className="col-12 col-sm-6 col-lg-3">
          <label className="form-label" htmlFor="clips-to">
            {t('clips.to')}
          </label>
          <input
            className="form-control"
            id="clips-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
        <div className="col-12 col-sm-6 col-lg-3">
          <label className="form-label" htmlFor="clips-state">
            {t('clips.state.label')}
          </label>
          <select
            className="form-select"
            id="clips-state"
            value={state}
            onChange={(event) => setState(event.target.value)}
          >
            <option value="">{t('clips.state.all')}</option>
            {(['collecting', 'ready', 'failed', 'lost_capacity'] as const).map((item) => (
              <option key={item} value={item}>
                {t(`clips.state.${item}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="col-12 col-lg-3">
          <button className="btn btn-secondary w-100" type="submit" disabled={busy}>
            {t('clips.filter')}
          </button>
        </div>
      </form>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {busy && (
        <p role="status" aria-live="polite">
          {t('clips.loading')}
        </p>
      )}
      {!busy && !error && items.length === 0 && <p role="status">{t('clips.empty')}</p>}
      {items.length > 0 && (
        <>
          <ol className="clip-timeline" aria-label={t('clips.timeline')}>
            {items.map((clip) => (
              <li className="clip-timeline-item" key={clip.clipId}>
                {clip.thumbnailUrl && (
                  <img src={clip.thumbnailUrl} alt="" loading="lazy" className="clip-thumbnail" />
                )}
                <div className="clip-summary">
                  <strong>{formatDate(clip.startedAtUtc)}</strong>
                  <span>
                    {clip.cameraId} · {t(stateKeys[clip.state] ?? 'clips.unknown')} ·{' '}
                    {t(archiveKeys[clip.archiveStatus] ?? 'clips.unknown')}
                  </span>
                  <span>
                    {t('clips.analysis')}: {t(analysisKeys[clip.analysisStatus] ?? 'clips.unknown')}
                  </span>
                </div>
                <button
                  className="btn btn-outline-primary"
                  type="button"
                  onClick={() => void openClip(clip.clipId)}
                >
                  {t('clips.details')}
                </button>
              </li>
            ))}
          </ol>
          <div className="d-flex align-items-center justify-content-between gap-2 mt-3">
            <span aria-live="polite">
              {t('clips.page', { current: page, total: Math.max(1, Math.ceil(total / PAGE_SIZE)) })}
            </span>
            <div className="d-flex gap-2">
              <button
                className="btn btn-outline-secondary"
                type="button"
                disabled={busy || page <= 1}
                onClick={() => void load(page - 1)}
              >
                {t('clips.previous')}
              </button>
              <button
                className="btn btn-outline-secondary"
                type="button"
                disabled={busy || page * PAGE_SIZE >= total}
                onClick={() => void load(page + 1)}
              >
                {t('clips.next')}
              </button>
            </div>
          </div>
        </>
      )}
      {selected && (
        <section className="clip-detail panel-card mt-4" aria-labelledby="clip-detail-title">
          <h3 id="clip-detail-title" className="h6">
            {t('clips.detailTitle')}
          </h3>
          <p>
            {formatDate(selected.clip.startedAtUtc)} – {formatDate(selected.clip.endedAtUtc)}
          </p>
          <dl className="clip-metadata">
            <dt>{t('clips.camera')}</dt>
            <dd>{selected.clip.cameraId}</dd>
            <dt>{t('clips.mediaState')}</dt>
            <dd>{t(stateKeys[selected.clip.state] ?? 'clips.unknown')}</dd>
            <dt>{t('clips.archiveState')}</dt>
            <dd>{t(archiveKeys[selected.clip.archiveStatus] ?? 'clips.unknown')}</dd>
            <dt>{t('clips.analysis')}</dt>
            <dd>{t(analysisKeys[selected.clip.analysisStatus] ?? 'clips.unknown')}</dd>
            <dt>{t('clips.trigger')}</dt>
            <dd>{selected.clip.triggerReason ?? t('clips.unknown')}</dd>
            <dt>{t('clips.segments')}</dt>
            <dd>{selected.segmentIds.length}</dd>
            <dt>{t('clips.updated')}</dt>
            <dd>{formatDate(selected.updatedAtUtc)}</dd>
          </dl>
          {selected.mediaUrl && (
            <>
              <p className="small text-secondary">{t('clips.captionsUnavailable')}</p>
              {/* biome-ignore lint/a11y/useMediaCaption: The clip contract has no caption track; explicitly disclose this limitation. */}
              <video className="clip-video" controls preload="metadata" src={selected.mediaUrl}>
                {t('clips.videoFallback')}
              </video>
            </>
          )}
          {!selected.mediaUrl && <p role="status">{t('clips.mediaUnavailable')}</p>}
        </section>
      )}
    </section>
  );
}
