import type Hls from 'hls.js';
import { useEffect, useRef, useState } from 'react';
import { StatusBadge } from '../../components/StatusBadge';
import type { CameraStatus } from '../../domain/platform';
import { useI18n } from '../../i18n/i18n';
import { PLAYER_BUFFER_LIMITS, selectPlaybackMode } from './playback';

interface LivePlayerProps {
  camera: CameraStatus;
  onStatusChange: (status: string) => void;
}

function availability(status: string, t: ReturnType<typeof useI18n>['t']) {
  const labels = {
    starting: ['player.availability.starting', 'pending'],
    connecting: ['player.availability.connecting', 'pending'],
    reconnecting: ['player.availability.reconnecting', 'degraded'],
    'spool-unavailable': ['player.availability.spoolUnavailable', 'failed'],
    stopped: ['player.availability.stopped', 'failed'],
  } as const;
  const item = labels[status as keyof typeof labels];
  return item
    ? { text: t(item[0]), state: item[1] }
    : status === 'capturing'
      ? undefined
      : { text: t('player.availability.unknown'), state: 'failed' as const };
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
  const { t } = useI18n();
  const translateRef = useRef(t);
  translateRef.current = t;
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | undefined>(undefined);
  const urlRef = useRef<string | undefined>(undefined);
  const sourceSetupActiveRef = useRef(false);
  const playerInitializedRef = useRef(false);
  const wasPlayingRef = useRef(false);
  const pendingLiveSyncRef = useRef(false);
  const lastCaptureStatus = useRef<string | undefined>(undefined);
  const [playerStatus, setPlayerStatus] = useState(t('player.status.notStarted'));
  const [playerState, setPlayerState] = useState<'healthy' | 'pending' | 'degraded' | 'failed'>('pending');
  const [message, setMessage] = useState(t('player.message.controls'));
  const [playing, setPlaying] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [{ position, length, live }, setPlayback] = useState({ position: 0, length: 0, live: false });
  const playbackRef = useRef({ position: 0, length: 0, live: false });

  useEffect(() => onStatusChange(playerStatus), [onStatusChange, playerStatus]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const oldEpoch = video.dataset.streamEpoch ?? '';
    const oldCameraId = video.dataset.cameraId ?? '';
    const returnedToCapture =
      camera.status === 'capturing' &&
      lastCaptureStatus.current !== undefined &&
      lastCaptureStatus.current !== 'capturing';
    lastCaptureStatus.current = camera.status;
    if (
      camera.liveUrl === urlRef.current &&
      oldCameraId === camera.cameraId &&
      camera.status === 'capturing' &&
      oldEpoch === (camera.streamEpoch ?? '') &&
      sourceSetupActiveRef.current &&
      !returnedToCapture
    )
      return;
    setMediaReady(false);
    sourceSetupActiveRef.current = false;
    const cameraChanged = oldCameraId !== camera.cameraId;
    const restart =
      playerInitializedRef.current &&
      camera.status === 'capturing' &&
      (cameraChanged || oldEpoch !== camera.streamEpoch || returnedToCapture);
    const resume = restart && wasPlayingRef.current && !video.ended;
    const shouldAutoplay = !playerInitializedRef.current || resume;
    pendingLiveSyncRef.current = false;
    hlsRef.current?.destroy();
    hlsRef.current = undefined;
    video.pause();
    video.removeAttribute('src');
    video.load();
    urlRef.current = camera.liveUrl;
    video.dataset.cameraId = camera.cameraId;
    video.dataset.streamEpoch = camera.streamEpoch ?? '';
    if (camera.status !== 'capturing') return;

    setPlayerState('pending');
    setPlayerStatus(translateRef.current('player.status.preparing'));
    let cancelled = false;
    let mediaReadyHandler: (() => void) | undefined;
    mediaReadyHandler = () => {
      video.dataset.playerInitState = 'media-ready';
      setMediaReady(true);
      setPlayerState('healthy');
      setPlayerStatus(translateRef.current('player.status.playlistReceived'));
      if (!shouldAutoplay) return;
      const range = seekRange(video);
      const hlsTarget = hlsRef.current?.liveSyncPosition;
      const target = Number.isFinite(hlsTarget) ? hlsTarget : range ? range.end - 0.5 : undefined;
      if (Number.isFinite(target)) video.currentTime = target as number;
      void video.play().catch(() => setMessage(translateRef.current('player.message.autoplayBlocked')));
    };
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.dataset.playerInitState = 'native-source';
      video.addEventListener('canplay', mediaReadyHandler, { once: true });
      video.src = camera.liveUrl;
      sourceSetupActiveRef.current = true;
      playerInitializedRef.current = true;
    } else {
      video.dataset.playerInitState = 'loading-hlsjs';
      void import('hls.js')
        .then(({ default: HlsRuntime }) => {
          if (cancelled) return;
          video.dataset.playerInitState = 'hlsjs-imported';
          const supported = HlsRuntime.isSupported();
          video.dataset.hlsSupported = String(supported);
          if (selectPlaybackMode(supported, false) === 'unsupported') {
            video.dataset.playerInitState = 'hlsjs-unsupported';
            setPlayerState('failed');
            setPlayerStatus(translateRef.current('player.status.unsupported'));
            setMessage(translateRef.current('player.message.unsupported'));
            return;
          }
          const hls = new HlsRuntime({
            lowLatencyMode: false,
            ...PLAYER_BUFFER_LIMITS,
            xhrSetup: (xhr) => {
              xhr.withCredentials = true;
            },
          });
          hlsRef.current = hls;
          video.addEventListener('canplay', mediaReadyHandler as () => void, { once: true });
          video.dataset.playerInitState = 'hlsjs-initialized';
          hls.on(HlsRuntime.Events.MEDIA_ATTACHED, () => {
            video.dataset.playerInitState = 'hlsjs-media-attached';
          });
          hls.on(HlsRuntime.Events.MANIFEST_PARSED, () => {
            video.dataset.playerInitState = 'hlsjs-manifest-parsed';
            setPlayerStatus(translateRef.current('player.status.playlistReceived'));
          });
          hls.on(HlsRuntime.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;
            const network = data.type === HlsRuntime.ErrorTypes.NETWORK_ERROR;
            video.dataset.playerInitState = network ? 'hlsjs-fatal-network' : 'hlsjs-fatal-media';
            setPlayerState('failed');
            setPlayerStatus(
              network
                ? translateRef.current('player.status.networkError')
                : translateRef.current('player.status.decodeError'),
            );
            const code = data.response?.code;
            const responseCode = code && code > 0 ? ` HTTP ${code}` : '';
            setMessage(
              translateRef.current('player.message.hlsError', {
                details: data.details,
                status: responseCode,
              }),
            );
            if (network) hls.startLoad();
            else hls.recoverMediaError();
          });
          video.dataset.playerInitState = 'hlsjs-loading-source';
          hls.loadSource(camera.liveUrl);
          video.dataset.playerInitState = 'hlsjs-attaching-media';
          hls.attachMedia(video);
          sourceSetupActiveRef.current = true;
          playerInitializedRef.current = true;
        })
        .catch(() => {
          if (!cancelled) {
            sourceSetupActiveRef.current = false;
            video.dataset.playerInitState = 'hlsjs-init-failed';
            setPlayerState('failed');
            setPlayerStatus(translateRef.current('player.status.unavailable'));
            setMessage(translateRef.current('player.message.loadFailed'));
          }
        });
    }
    return () => {
      cancelled = true;
      sourceSetupActiveRef.current = false;
      if (mediaReadyHandler) video.removeEventListener('canplay', mediaReadyHandler);
      hlsRef.current?.destroy();
      hlsRef.current = undefined;
    };
  }, [camera.cameraId, camera.liveUrl, camera.status, camera.streamEpoch]);

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
    const nextPosition = Math.round(
      Math.max(0, Math.min(1000, ((video.currentTime - range.start) / (range.end - range.start)) * 1000)),
    );
    const nextLength = Math.floor(range.end - range.start);
    const nextLive = Math.abs((hlsRef.current?.liveSyncPosition ?? range.end - 0.5) - video.currentTime) <= 3;
    const current = playbackRef.current;
    if (current.position === nextPosition && current.length === nextLength && current.live === nextLive)
      return;
    const next = { position: nextPosition, length: nextLength, live: nextLive };
    playbackRef.current = next;
    setPlayback(next);
  }

  function completePendingLiveSync() {
    if (!pendingLiveSyncRef.current) return;
    const video = videoRef.current;
    if (!video) return;
    const range = seekRange(video);
    const hlsTarget = hlsRef.current?.liveSyncPosition;
    const target = Number.isFinite(hlsTarget) ? hlsTarget : range ? range.end - 0.5 : undefined;
    if (!Number.isFinite(target)) return;
    pendingLiveSyncRef.current = false;
    video.currentTime = target as number;
    setPlayerStatus(t('player.status.liveSync'));
  }

  async function syncLive() {
    const video = videoRef.current;
    if (!video) return;
    const range = seekRange(video);
    const target = hlsRef.current?.liveSyncPosition ?? (range ? range.end - 0.5 : undefined);
    if (!Number.isFinite(target)) {
      pendingLiveSyncRef.current = true;
      setMessage(t('player.message.liveWaiting'));
      try {
        await video.play();
      } catch {
        setMessage(t('player.message.autoplayBlocked'));
      }
      return;
    }
    video.currentTime = target as number;
    wasPlayingRef.current = true;
    setPlayerStatus(t('player.status.liveSync'));
    try {
      await video.play();
    } catch {
      setMessage(t('player.message.liveSelected'));
    }
  }

  async function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) {
      wasPlayingRef.current = false;
      video.pause();
    } else {
      try {
        wasPlayingRef.current = true;
        await video.play();
      } catch (failure) {
        wasPlayingRef.current = false;
        const reason = failure instanceof DOMException ? failure.name : '';
        setMessage(
          reason === 'NotAllowedError'
            ? t('player.message.autoplayBlocked')
            : reason === 'NotSupportedError'
              ? t('player.message.unsupported')
              : t('player.message.playFailed'),
        );
      }
    }
  }

  async function toggleFullscreen() {
    const shell = videoRef.current?.closest('.player-shell');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (shell instanceof HTMLElement && shell.requestFullscreen) await shell.requestFullscreen();
      else setMessage(t('player.message.fullscreenUnsupported'));
    } catch {
      setMessage(t('player.message.fullscreenFailed'));
    }
  }

  const warning = availability(camera.status, t);
  const range = videoRef.current ? seekRange(videoRef.current) : undefined;
  const canControl = camera.status === 'capturing' && playerState !== 'failed';
  const canStartPlayback = canControl && mediaReady;

  return (
    <section className="panel-card live-panel mb-3" aria-labelledby="live-title">
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-3">
        <div>
          <p className="eyebrow mb-1">{t('player.aria.monitoring')}</p>
          <h2 id="live-title" className="h5 mb-0">
            {t('player.title')}
          </h2>
        </div>
        <span className="live-indicator">
          <span aria-hidden="true" /> {t('player.live')}
        </span>
      </div>
      <div className="player-shell">
        <div className="player-frame">
          <video
            ref={videoRef}
            className="live-video"
            muted={muted}
            playsInline
            preload="none"
            aria-label={t('player.aria.video')}
            onPlaying={() => {
              setPlaying(true);
              wasPlayingRef.current = true;
              setPlayerState('healthy');
              setPlayerStatus(t('player.status.playing'));
              setMessage(t('player.message.active'));
            }}
            onPause={() => {
              setPlaying(false);
            }}
            onWaiting={() => {
              setPlayerState('degraded');
              setPlayerStatus(t('player.status.buffering'));
            }}
            onTimeUpdate={() => {
              completePendingLiveSync();
              updateTime();
            }}
            onProgress={() => {
              completePendingLiveSync();
              updateTime();
            }}
            onLoadedMetadata={() => {
              completePendingLiveSync();
              updateTime();
            }}
            onDurationChange={() => {
              completePendingLiveSync();
              updateTime();
            }}
            onCanPlay={completePendingLiveSync}
            onVolumeChange={(event) => {
              setMuted(event.currentTarget.muted);
              setVolume(event.currentTarget.volume);
            }}
            onError={() => {
              setPlayerState('failed');
              setPlayerStatus(t('player.status.mediaUnavailable'));
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
          <legend className="visually-hidden">{t('player.aria.controls')}</legend>
          <button
            className="btn-player"
            type="button"
            onClick={() => void togglePlayback()}
            disabled={!canStartPlayback}
            aria-label={playing ? t('player.button.pause') : t('player.button.play')}
          >
            {playing ? t('player.button.pauseShort') : t('player.button.playShort')}
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
            aria-label={t('player.button.back10')}
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
            aria-label={t('player.button.forward10')}
          >
            +10
          </button>
          <output className="player-time" aria-label={t('player.aria.position')}>
            {clock(range && videoRef.current ? videoRef.current.currentTime - range.start : 0)}
          </output>
          <input
            className="player-seek"
            type="range"
            min="0"
            max="1000"
            value={position}
            aria-label={t('player.aria.timeline')}
            disabled={!range}
            onChange={(event) => {
              const v = videoRef.current;
              const r = v && seekRange(v);
              if (v && r)
                v.currentTime = r.start + (Number(event.currentTarget.value) / 1000) * (r.end - r.start);
            }}
          />
          <output className="player-time" aria-label={t('player.aria.duration')}>
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
            aria-label={muted ? t('player.button.unmute') : t('player.button.mute')}
          >
            {muted ? t('player.button.muted') : t('player.button.audio')}
          </button>
          <input
            className="player-volume"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            aria-label={t('player.aria.volume')}
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
            aria-label={
              document.fullscreenElement
                ? t('player.button.exitFullscreen')
                : t('player.button.enterFullscreen')
            }
          >
            ⛶
          </button>
          <button
            className={`btn-live-sync${live ? ' is-live' : ''}`}
            type="button"
            onClick={() => void syncLive()}
            disabled={!canControl}
            aria-label={live ? t('player.button.atLive') : t('player.button.goLive')}
          >
            <span className="live-sync-dot" aria-hidden="true" />
            {live ? t('player.button.live') : t('player.button.goLiveShort')}
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
