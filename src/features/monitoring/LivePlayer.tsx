import type Hls from 'hls.js';
import { useEffect, useRef, useState } from 'react';
import { StatusBadge } from '../../components/StatusBadge';
import type { CameraStatus } from '../../domain/platform';

interface LivePlayerProps {
  camera: CameraStatus;
  onStatusChange: (status: string) => void;
}

function availability(
  status: string,
): { text: string; state: 'pending' | 'degraded' | 'failed' } | undefined {
  const labels: Record<string, { text: string; state: 'pending' | 'degraded' | 'failed' }> = {
    starting: { text: 'Iniciando a captura da câmera…', state: 'pending' },
    connecting: { text: 'Conectando à câmera…', state: 'pending' },
    reconnecting: { text: 'Câmera sem sinal. Tentando reconectar automaticamente…', state: 'degraded' },
    'spool-unavailable': {
      text: 'Captura temporariamente indisponível. Tentando recuperar o armazenamento local…',
      state: 'failed',
    },
    stopped: { text: 'Captura parada. O vídeo ao vivo está indisponível.', state: 'failed' },
  };
  return (
    labels[status] ??
    (status === 'capturing'
      ? undefined
      : { text: 'Captura indisponível. O player será atualizado quando a fonte voltar.', state: 'failed' })
  );
}

function seekRange(video: HTMLVideoElement) {
  if (video.seekable.length) {
    const index = video.seekable.length - 1;
    return { start: video.seekable.start(index), end: video.seekable.end(index) };
  }
  return Number.isFinite(video.duration) && video.duration > 0
    ? { start: 0, end: video.duration }
    : undefined;
}

function clock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function LivePlayer({ camera, onStatusChange }: LivePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | undefined>(undefined);
  const urlRef = useRef<string | undefined>(undefined);
  const wasPlayingRef = useRef(false);
  const lastCaptureStatus = useRef<string | undefined>(undefined);
  const [playerStatus, setPlayerStatus] = useState('Player ainda não iniciado');
  const [playerState, setPlayerState] = useState<'healthy' | 'pending' | 'degraded' | 'failed'>('pending');
  const [message, setMessage] = useState('Use os controles do painel para iniciar áudio e vídeo.');
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [position, setPosition] = useState(0);
  const [length, setLength] = useState(0);
  const [live, setLive] = useState(true);

  useEffect(() => onStatusChange(playerStatus), [onStatusChange, playerStatus]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const oldEpoch = video.dataset.streamEpoch ?? '';
    const returnedToCapture =
      camera.status === 'capturing' &&
      lastCaptureStatus.current !== undefined &&
      lastCaptureStatus.current !== 'capturing';
    lastCaptureStatus.current = camera.status;
    if (
      camera.liveUrl === urlRef.current &&
      camera.status === 'capturing' &&
      oldEpoch === (camera.streamEpoch ?? '') &&
      !returnedToCapture
    )
      return;
    const restart =
      Boolean(urlRef.current) &&
      camera.status === 'capturing' &&
      (oldEpoch !== camera.streamEpoch || returnedToCapture);
    const resume = restart && !video.paused && !video.ended;
    wasPlayingRef.current = resume || wasPlayingRef.current;
    hlsRef.current?.destroy();
    hlsRef.current = undefined;
    video.pause();
    video.removeAttribute('src');
    video.load();
    urlRef.current = camera.liveUrl;
    video.dataset.streamEpoch = camera.streamEpoch ?? '';
    if (camera.status !== 'capturing') return;

    setPlayerState('pending');
    setPlayerStatus('Preparando player');
    let cancelled = false;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = camera.liveUrl;
      if (resume)
        video.addEventListener(
          'loadedmetadata',
          () => {
            const range = seekRange(video);
            if (range) video.currentTime = Math.max(range.start, range.end - 0.5);
            void video
              .play()
              .catch(() => setMessage('Playlist recuperada. Pressione reproduzir para continuar.'));
          },
          { once: true },
        );
    } else {
      void import('hls.js')
        .then(({ default: HlsRuntime }) => {
          if (cancelled) return;
          if (!HlsRuntime.isSupported()) {
            setPlayerState('failed');
            setPlayerStatus('Formato não suportado neste navegador');
            setMessage('Este navegador não oferece reprodução HLS/MSE compatível.');
            return;
          }
          const hls = new HlsRuntime({
            lowLatencyMode: false,
            maxBufferLength: 12,
            backBufferLength: 6,
            maxMaxBufferLength: 18,
            xhrSetup: (xhr) => {
              xhr.withCredentials = true;
            },
          });
          hlsRef.current = hls;
          hls.loadSource(camera.liveUrl);
          hls.attachMedia(video);
          hls.on(HlsRuntime.Events.MANIFEST_PARSED, () => {
            setPlayerStatus('Playlist recebida · pressione play');
            setPlayerState('healthy');
            if (resume) {
              const target = hls.liveSyncPosition;
              if (Number.isFinite(target)) video.currentTime = target as number;
              void video
                .play()
                .catch(() => setMessage('Playlist recuperada. Pressione reproduzir para continuar.'));
            }
          });
          hls.on(HlsRuntime.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;
            const network = data.type === HlsRuntime.ErrorTypes.NETWORK_ERROR;
            setPlayerState('failed');
            setPlayerStatus(network ? 'Falha de rede no player' : 'Falha ao decodificar vídeo');
            const code = data.response?.code;
            const responseCode = code && code > 0 ? ` HTTP ${code}` : '';
            setMessage(`Falha HLS (${data.details}${responseCode}).`);
            if (network) hls.startLoad();
            else hls.recoverMediaError();
          });
        })
        .catch(() => {
          if (!cancelled) {
            setPlayerState('failed');
            setPlayerStatus('Player indisponível');
            setMessage('Não foi possível carregar o player HLS local.');
          }
        });
    }
    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = undefined;
    };
  }, [camera.liveUrl, camera.status, camera.streamEpoch]);

  useEffect(
    () => () => {
      hlsRef.current?.destroy();
    },
    [],
  );

  function updateTime() {
    const video = videoRef.current;
    if (!video) return;
    const range = seekRange(video);
    if (!range || range.end <= range.start) return;
    setPosition(
      Math.max(0, Math.min(1000, ((video.currentTime - range.start) / (range.end - range.start)) * 1000)),
    );
    setLength(range.end - range.start);
    setLive(Math.abs((hlsRef.current?.liveSyncPosition ?? range.end - 0.5) - video.currentTime) <= 3);
  }

  async function syncLive() {
    const video = videoRef.current;
    if (!video) return;
    const range = seekRange(video);
    const target = hlsRef.current?.liveSyncPosition ?? (range ? range.end - 0.5 : undefined);
    if (!Number.isFinite(target)) {
      setMessage('O ponto ao vivo ainda não está disponível; aguarde a playlist e tente novamente.');
      return;
    }
    video.currentTime = target as number;
    setPlayerStatus('Sincronizando ao vivo');
    try {
      await video.play();
    } catch {
      setMessage('Ponto ao vivo selecionado. Pressione reproduzir para continuar.');
    }
  }

  async function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) video.pause();
    else {
      try {
        await video.play();
      } catch {
        setMessage('Não foi possível iniciar a reprodução. Tente novamente.');
      }
    }
  }

  async function toggleFullscreen() {
    const shell = videoRef.current?.closest('.player-shell');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (shell instanceof HTMLElement && shell.requestFullscreen) await shell.requestFullscreen();
      else setMessage('Tela cheia não é suportada neste navegador.');
    } catch {
      setMessage('Não foi possível abrir o vídeo em tela cheia.');
    }
  }

  const warning = availability(camera.status);
  const range = videoRef.current ? seekRange(videoRef.current) : undefined;
  const canControl = camera.status === 'capturing' && playerState !== 'failed';

  return (
    <section className="panel-card live-panel mb-3" aria-labelledby="live-title">
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-3">
        <div>
          <p className="eyebrow mb-1">MONITORAMENTO</p>
          <h2 id="live-title" className="h5 mb-0">
            Ao vivo
          </h2>
        </div>
        <span className="live-indicator">
          <span aria-hidden="true" /> LIVE
        </span>
      </div>
      <div className="player-shell">
        <div className="player-frame">
          {/* biome-ignore lint/a11y/useMediaCaption: live camera audio has no transcription source or caption contract. */}
          <video
            ref={videoRef}
            className="live-video"
            playsInline
            preload="none"
            aria-label="Vídeo ao vivo da câmera"
            onPlaying={() => {
              setPlaying(true);
              wasPlayingRef.current = true;
              setPlayerState('healthy');
              setPlayerStatus('Reproduzindo');
              setMessage('Reprodução HLS ativa.');
            }}
            onPause={() => {
              setPlaying(false);
              wasPlayingRef.current = false;
            }}
            onWaiting={() => {
              setPlayerState('degraded');
              setPlayerStatus('Bufferizando');
            }}
            onTimeUpdate={updateTime}
            onProgress={updateTime}
            onLoadedMetadata={updateTime}
            onDurationChange={updateTime}
            onVolumeChange={(event) => {
              setMuted(event.currentTarget.muted);
              setVolume(event.currentTarget.volume);
            }}
            onError={() => {
              setPlayerState('failed');
              setPlayerStatus('Mídia indisponível');
            }}
          />
          {warning && (
            <div
              className={`camera-availability ${warning.state}`}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {warning.text}
            </div>
          )}
        </div>
        <fieldset className="player-toolbar">
          <legend className="visually-hidden">Controles do player</legend>
          <button
            className="btn-player"
            type="button"
            onClick={() => void togglePlayback()}
            disabled={!canControl}
            aria-label={playing ? 'Pausar vídeo' : 'Reproduzir vídeo'}
          >
            {playing ? 'Ⅱ Pausar' : '▶ Reproduzir'}
          </button>
          <button
            className="btn-player btn-player-icon"
            type="button"
            onClick={() => {
              const v = videoRef.current;
              const r = v && seekRange(v);
              if (v && r) v.currentTime = Math.max(r.start, v.currentTime - 10);
            }}
            disabled={!range}
            aria-label="Voltar 10 segundos"
          >
            −10
          </button>
          <button
            className="btn-player btn-player-icon"
            type="button"
            onClick={() => {
              const v = videoRef.current;
              const r = v && seekRange(v);
              if (v && r) v.currentTime = Math.min(r.end, v.currentTime + 10);
            }}
            disabled={!range}
            aria-label="Avançar 10 segundos"
          >
            +10
          </button>
          <output className="player-time" aria-label="Posição atual">
            {clock(range && videoRef.current ? videoRef.current.currentTime - range.start : 0)}
          </output>
          <input
            className="player-seek"
            type="range"
            min="0"
            max="1000"
            value={position}
            aria-label="Posição do vídeo"
            disabled={!range}
            onChange={(event) => {
              const v = videoRef.current;
              const r = v && seekRange(v);
              if (v && r)
                v.currentTime = r.start + (Number(event.currentTarget.value) / 1000) * (r.end - r.start);
            }}
          />
          <output className="player-time" aria-label="Duração ou janela disponível">
            {length ? clock(length) : '—'}
          </output>
          <button
            className="btn-player btn-player-icon"
            type="button"
            onClick={() => {
              const v = videoRef.current;
              if (v) {
                if (v.muted || v.volume === 0) {
                  v.muted = false;
                  if (v.volume === 0) v.volume = 1;
                } else v.muted = true;
              }
            }}
            disabled={!canControl}
            aria-label={muted ? 'Ativar áudio' : 'Silenciar áudio'}
          >
            {muted ? 'Mudo' : 'Áudio'}
          </button>
          <input
            className="player-volume"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            aria-label="Volume"
            disabled={!canControl}
            onChange={(event) => {
              const v = videoRef.current;
              if (v) {
                v.volume = Number(event.currentTarget.value);
                v.muted = v.volume === 0;
              }
            }}
          />
          <button
            className="btn-player btn-player-icon"
            type="button"
            onClick={() => void toggleFullscreen()}
            disabled={!canControl}
            aria-label={document.fullscreenElement ? 'Sair da tela cheia' : 'Abrir em tela cheia'}
          >
            ⛶
          </button>
          <button
            className={`btn-live-sync${live ? ' is-live' : ''}`}
            type="button"
            onClick={() => void syncLive()}
            disabled={!canControl}
            aria-label={live ? 'Você está no ponto ao vivo' : 'Ir ao ponto mais recente do vídeo'}
          >
            <span className="live-sync-dot" aria-hidden="true" />
            {live ? 'AO VIVO' : 'IR AO VIVO'}
          </button>
        </fieldset>
      </div>
      <div className="player-feedback">
        <p className="small text-secondary mt-2 mb-0" role="status" aria-live="polite">
          {message}
        </p>
        <StatusBadge label={playerStatus} state={playerState} live />
      </div>
    </section>
  );
}
