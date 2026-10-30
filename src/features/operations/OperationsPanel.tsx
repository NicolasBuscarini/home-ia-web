import { useEffect, useRef, useState } from 'react';
import { StatusBadge } from '../../components/StatusBadge';
import type { CameraStatus, ReadinessResponse, SystemProfile } from '../../domain/platform';
import { getJson, request } from '../../services/http';

interface OperationsPanelProps {
  camera: CameraStatus;
  view: 'health' | 'dependencies' | 'capture';
  playerStatus: string;
}
type State = 'healthy' | 'pending' | 'degraded' | 'failed' | 'neutral';
interface HealthItem {
  label: string;
  state: State;
}

function captureState(state?: string): HealthItem {
  const labels: Record<string, HealthItem> = {
    capturing: { label: 'Capturando', state: 'healthy' },
    connecting: { label: 'Conectando à fonte', state: 'pending' },
    starting: { label: 'Iniciando', state: 'pending' },
    reconnecting: { label: 'Reconectando', state: 'degraded' },
    'spool-unavailable': { label: 'Spool indisponível', state: 'failed' },
    stopped: { label: 'Parado', state: 'failed' },
  };
  return labels[state ?? ''] ?? { label: 'Estado não reconhecido', state: 'neutral' };
}

function safeCaptureError(code?: string | null) {
  const labels: Record<string, string> = {
    capture_source_unavailable: 'Fonte de vídeo indisponível.',
    capture_segment_timeout: 'Nenhum segmento foi confirmado dentro do prazo.',
    capture_codec_unsupported: 'O codec publicado não é compatível.',
    spool_unavailable: 'O armazenamento local da captura está indisponível.',
  };
  return code ? (labels[code] ?? 'Falha operacional registrada; detalhe interno omitido.') : '';
}

export function OperationsPanel({ camera, view, playerStatus }: OperationsPanelProps) {
  const [apiHealth, setApiHealth] = useState<HealthItem>({ label: 'Consultando', state: 'pending' });
  const [readiness, setReadiness] = useState<ReadinessResponse>();
  const [profile, setProfile] = useState<SystemProfile>();
  const [gateway, setGateway] = useState<HealthItem>({ label: 'Aguardando', state: 'pending' });
  const [gatewayDetail, setGatewayDetail] = useState('Verificação autenticada da playlist');
  const [gatewayDependency, setGatewayDependency] = useState<HealthItem>({
    label: 'Aguardando',
    state: 'pending',
  });
  const [updated, setUpdated] = useState('Consultando…');
  const profileLoaded = useRef(false);
  const lastGatewayCheck = useRef(0);

  useEffect(() => {
    let active = true;
    let updateInFlight = false;
    const controller = new AbortController();
    const update = async () => {
      if (updateInFlight) return;
      updateInFlight = true;
      try {
        const [liveResult, readyResult] = await Promise.allSettled([
          getJson<{ status: string }>('/health/live', controller.signal),
          request('/health/ready', { signal: controller.signal }),
        ]);
        if (!active) return;
        setApiHealth(
          liveResult.status === 'fulfilled'
            ? { label: 'Operacional', state: 'healthy' }
            : { label: 'Indisponível', state: 'failed' },
        );
        if (
          readyResult.status === 'fulfilled' &&
          (readyResult.value.ok || readyResult.value.status === 503)
        ) {
          try {
            setReadiness((await readyResult.value.json()) as ReadinessResponse);
          } catch {
            setReadiness(undefined);
          }
        } else setReadiness(undefined);

        if (!profileLoaded.current) {
          try {
            setProfile(await getJson<SystemProfile>('/api/v1/system-profile', controller.signal));
            profileLoaded.current = true;
          } catch {
            /* Admin profile is optional presentation data. */
          }
        }
        if (Date.now() - lastGatewayCheck.current < 15000) {
          if (active) setUpdated(`Atualizado ${new Date().toLocaleTimeString('pt-BR')}`);
          return;
        }
        lastGatewayCheck.current = Date.now();
        const started = performance.now();
        try {
          const response = await request(camera.liveUrl, { signal: controller.signal });
          if (!active) return;
          const body = await response.text();
          if (response.status === 401) {
            setGateway({ label: 'Sessão expirada', state: 'failed' });
            setGatewayDependency({ label: 'Sem sessão', state: 'failed' });
          } else if (response.ok && body.startsWith('#EXTM3U')) {
            setGateway({ label: 'Disponível', state: 'healthy' });
            setGatewayDetail(`Playlist autenticada · ${Math.round(performance.now() - started)} ms`);
            setGatewayDependency({ label: 'Disponível', state: 'healthy' });
          } else if (response.status === 503) {
            setGateway({ label: 'Aguardando segmentos', state: 'degraded' });
            setGatewayDetail('A fonte ainda não publicou segmentos para o live.');
            setGatewayDependency({ label: 'Sem segmentos', state: 'degraded' });
          } else {
            setGateway({ label: `HTTP ${response.status}`, state: 'failed' });
            setGatewayDetail('Resposta inesperada do gateway local.');
            setGatewayDependency({ label: `HTTP ${response.status}`, state: 'failed' });
          }
        } catch {
          if (active) {
            setGateway({ label: 'Sem conexão', state: 'failed' });
            setGatewayDetail('Não foi possível consultar a playlist local.');
            setGatewayDependency({ label: 'Sem conexão', state: 'failed' });
          }
        }
        if (active) setUpdated(`Atualizado ${new Date().toLocaleTimeString('pt-BR')}`);
      } finally {
        updateInFlight = false;
      }
    };
    void update();
    const timer = window.setInterval(() => void update(), 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
      controller.abort();
    };
  }, [camera.liveUrl]);

  const capture = readiness?.capture;
  const captureHealth = captureState(capture?.state ?? camera.status);
  const count = capture?.spool?.segments ?? capture?.segments;
  const spoolHealth: HealthItem =
    capture?.spool?.status === 'available'
      ? { label: 'Disponível', state: 'healthy' }
      : capture?.spool?.status === 'unavailable'
        ? { label: 'Indisponível', state: 'failed' }
        : { label: 'Sem dados', state: 'pending' };

  return (
    <div className="operations-content">
      {view === 'health' && (
        <>
          <div className="d-flex align-items-end justify-content-between gap-2 mb-3">
            <div>
              <p className="eyebrow mb-1">OPERAÇÃO</p>
              <h2 className="h4 mb-0">Saúde do sistema</h2>
            </div>
            <span className="small text-secondary text-end" aria-live="polite">
              {updated}
            </span>
          </div>
          <section className="row g-3 mb-3" aria-label="Servidores e conexões">
            <div className="col-12 col-md-4">
              <article className="panel-card health-card h-100">
                <div className="d-flex align-items-center justify-content-between gap-2">
                  <h3 className="h6 mb-0">API da plataforma</h3>
                  <StatusBadge {...apiHealth} />
                </div>
                <p className="health-detail mt-3 mb-1">{profile?.serviceName ?? '—'}</p>
                <p className="small text-secondary mb-0">
                  {profile ? `${profile.environment} · versão ${profile.applicationVersion}` : '—'}
                </p>
              </article>
            </div>
            <div className="col-12 col-md-4">
              <article className="panel-card health-card h-100">
                <div className="d-flex align-items-center justify-content-between gap-2">
                  <h3 className="h6 mb-0">Captura de vídeo</h3>
                  <StatusBadge {...captureHealth} />
                </div>
                <p className="health-detail mt-3 mb-1">{capture?.adapter ?? '—'}</p>
                <p className="small text-secondary mb-0">{safeCaptureError(capture?.lastErrorCode)}</p>
              </article>
            </div>
            <div className="col-12 col-md-4">
              <article className="panel-card health-card h-100">
                <div className="d-flex align-items-center justify-content-between gap-2">
                  <h3 className="h6 mb-0">Gateway HLS</h3>
                  <StatusBadge {...gateway} />
                </div>
                <p className="health-detail mt-3 mb-1">{gatewayDetail}</p>
                <p className="small text-secondary mb-0" role="status" aria-live="polite">
                  {playerStatus}
                </p>
              </article>
            </div>
          </section>
          <section className="panel-card system-details mb-3" aria-labelledby="details-title">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
              <div>
                <p className="eyebrow mb-1">TELEMETRIA DISPONÍVEL</p>
                <h3 id="details-title" className="h5 mb-0">
                  Processos e conexões
                </h3>
              </div>
              <span className="scope-label">Perfil local</span>
            </div>
            <div className="row g-3">
              <Detail
                label="Serviço"
                value={profile?.serviceName ?? '—'}
                caption={`Ambiente ${profile?.environment ?? '—'} · versão ${profile?.applicationVersion ?? '—'}`}
              />
              <Detail
                label="Adaptador de captura"
                value={capture?.adapter ?? '—'}
                caption={`Versão ${capture?.adapterVersion ?? '—'}`}
              />
              <Detail
                label="Capacidades reportadas"
                value={capture?.capabilities?.join(' · ') || 'Não informadas'}
                caption="Declaradas pelo adaptador ativo"
              />
              <Detail
                label="Sessão do stream"
                value={capture?.streamEpoch ? `…${capture.streamEpoch.slice(-8)}` : 'Sem epoch ativo'}
                caption="Referência curta do epoch, sem endereço RTSP"
              />
            </div>
          </section>
        </>
      )}
      {view === 'dependencies' && (
        <section className="panel-card dependencies-panel mb-3" aria-labelledby="dependencies-title">
          <div className="mb-3">
            <p className="eyebrow mb-1">MAPA DO PERFIL ATIVO</p>
            <h3 id="dependencies-title" className="h5 mb-1">
              Dependências
            </h3>
            <p className="small text-secondary mb-0">
              Mostramos somente estados observados ou limites conhecidos deste perfil.
            </p>
          </div>
          <div className="dependency-list">
            <Dependency
              name="API e painel"
              detail="Servidor local e interface autenticada"
              status={apiHealth}
            />
            <Dependency
              name="Fonte de vídeo → worker"
              detail="Adaptador e reconexão reportados pelo processo"
              status={captureHealth}
            />
            <Dependency
              name="Spool local"
              detail="Armazenamento usado pela captura local"
              status={spoolHealth}
            />
            <Dependency
              name="Gateway de vídeo HLS"
              detail="Playlist autenticada no mesmo host"
              status={gatewayDependency}
            />
            <Dependency
              name="IA, NAS, banco e broker"
              detail="Não fazem parte da fundação local ativa"
              status={{ label: 'Não configurados', state: 'neutral' }}
            />
          </div>
          <p className="operational-note mt-3 mb-0">
            A contagem do spool não representa capacidade livre de disco. Serviços não configurados não são
            sondados nem tratados como saudáveis.
          </p>
        </section>
      )}
      {view === 'capture' && (
        <>
          <div className="d-flex flex-wrap align-items-baseline justify-content-between gap-2 mb-3">
            <div>
              <p className="eyebrow mb-1">CAPTURA LOCAL</p>
              <h2 className="h4 mb-0">Segmentos e lacunas</h2>
            </div>
          </div>
          <section className="row g-3" aria-label="Métricas de captura">
            <div className="col-6">
              <article className="panel-card metric-card h-100">
                <p className="eyebrow mb-2">SEGMENTOS</p>
                <strong className="metric-value">{count ?? '—'}</strong>
                <span className="metric-caption">
                  retidos no spool local
                  {capture?.spool?.segmentLimit !== undefined && (
                    <>
                      {' '}
                      · limite <strong>{capture.spool.segmentLimit}</strong>
                    </>
                  )}
                </span>
              </article>
            </div>
            <div className="col-6">
              <article className="panel-card metric-card h-100">
                <p className="eyebrow mb-2">LACUNAS</p>
                <strong className="metric-value">{capture?.gaps ?? '—'}</strong>
                <span className="metric-caption">de captura</span>
              </article>
            </div>
          </section>
          <p className="operational-note mt-4 mb-0">
            Ambiente local de desenvolvimento. A reprodução não homologa latência, qualidade ou estabilidade
            da câmera.
          </p>
        </>
      )}
      <span className="visually-hidden" aria-live="polite">
        {playerStatus}
      </span>
    </div>
  );
}

function Detail({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="col-12 col-md-6">
      <div className="detail-item h-100">
        <span className="detail-label">{label}</span>
        <strong>{value}</strong>
        <span className="detail-caption">{caption}</span>
      </div>
    </div>
  );
}

function Dependency({ name, detail, status }: { name: string; detail: string; status: HealthItem }) {
  return (
    <div className="dependency-item">
      <span
        className={`dependency-icon ${status.state === 'neutral' ? 'inactive-icon' : 'active-icon'}`}
        aria-hidden="true"
      >
        {status.state === 'neutral' ? '○' : '●'}
      </span>
      <div>
        <strong>{name}</strong>
        <span>{detail}</span>
      </div>
      <span
        className={`dependency-state ${status.state}${status.state === 'neutral' ? ' neutral-state' : ''}`}
      >
        {status.label}
      </span>
    </div>
  );
}
