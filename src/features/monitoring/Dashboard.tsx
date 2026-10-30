import { useState } from 'react';
import { type DashboardTab, DashboardTabs } from '../../components/DashboardTabs';
import { StatusBadge } from '../../components/StatusBadge';
import type { CameraStatus, UserRole } from '../../domain/platform';
import { useI18n } from '../../i18n/i18n';
import { OperationsPanel } from '../operations/OperationsPanel';
import { LivePlayer } from './LivePlayer';

interface DashboardProps {
  camera: CameraStatus;
  userRole: UserRole;
}

export function Dashboard({ camera, userRole }: DashboardProps) {
  const { t } = useI18n();
  const [active, setActive] = useState<DashboardTab>('monitor');
  const [playerStatus, setPlayerStatus] = useState('Player ainda não iniciado');
  const isAdmin = userRole === 'Administrator';
  const states = {
    capturing: ['capture.state.capturing', 'healthy'],
    connecting: ['capture.state.connecting', 'pending'],
    starting: ['capture.state.starting', 'pending'],
    reconnecting: ['capture.state.reconnecting', 'degraded'],
    'spool-unavailable': ['capture.state.spoolUnavailable', 'failed'],
    stopped: ['capture.state.stopped', 'failed'],
  } as const;
  const item = states[camera.status as keyof typeof states];
  const status = { text: t(item?.[0] ?? 'capture.state.unknown'), state: item?.[1] ?? 'pending' };
  return (
    <section aria-label={t('dashboard.aria.garageState')}>
      <DashboardTabs active={active} isAdmin={isAdmin} onChange={setActive} />
      <div id="view-monitor" role="tabpanel" aria-labelledby="tab-monitor" hidden={active !== 'monitor'}>
        <section className="panel-card camera-summary mb-3" aria-label={t('dashboard.aria.cameraState')}>
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div>
              <p className="eyebrow mb-1">{t('header.cameraActive')}</p>
              <h2 className="h5 mb-0">{camera.cameraId}</h2>
            </div>
            <StatusBadge label={status.text} state={status.state} live />
          </div>
          <p className="small text-secondary mb-0 mt-3">{t('header.cameraStatusNote')}</p>
        </section>
        <LivePlayer camera={camera} onStatusChange={setPlayerStatus} />
      </div>
      {isAdmin && active !== 'monitor' && (
        <section id={`view-${active}`} role="tabpanel" aria-labelledby={`tab-${active}`}>
          <OperationsPanel camera={camera} view={active} playerStatus={playerStatus} />
        </section>
      )}
      {isAdmin &&
        (['health', 'dependencies', 'capture'] as const)
          .filter((tab) => tab !== active)
          .map((tab) => (
            <section key={tab} id={`view-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} hidden />
          ))}
    </section>
  );
}
