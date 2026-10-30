import { useState } from 'react';
import { type DashboardTab, DashboardTabs } from '../../components/DashboardTabs';
import { StatusBadge } from '../../components/StatusBadge';
import type { CameraStatus, UserRole } from '../../domain/platform';
import { OperationsPanel } from '../operations/OperationsPanel';
import { LivePlayer } from './LivePlayer';

interface DashboardProps {
  camera: CameraStatus;
  userRole: UserRole;
}

function captureLabel(status: string) {
  const values: Record<string, { text: string; state: 'healthy' | 'pending' | 'degraded' | 'failed' }> = {
    capturing: { text: 'Capturando', state: 'healthy' },
    connecting: { text: 'Conectando', state: 'pending' },
    starting: { text: 'Iniciando', state: 'pending' },
    reconnecting: { text: 'Reconectando', state: 'degraded' },
    'spool-unavailable': { text: 'Spool indisponível', state: 'failed' },
    stopped: { text: 'Parado', state: 'failed' },
  };
  return values[status] ?? { text: 'Estado desconhecido', state: 'pending' as const };
}

export function Dashboard({ camera, userRole }: DashboardProps) {
  const [active, setActive] = useState<DashboardTab>('monitor');
  const [playerStatus, setPlayerStatus] = useState('Player ainda não iniciado');
  const isAdmin = userRole === 'Administrator';
  const status = captureLabel(camera.status);
  return (
    <section aria-label="Estado da garagem">
      <DashboardTabs active={active} isAdmin={isAdmin} onChange={setActive} />
      <div id="view-monitor" role="tabpanel" aria-labelledby="tab-monitor" hidden={active !== 'monitor'}>
        <section className="panel-card camera-summary mb-3" aria-label="Estado da câmera">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div>
              <p className="eyebrow mb-1">CÂMERA ATIVA</p>
              <h2 className="h5 mb-0">{camera.cameraId}</h2>
            </div>
            <StatusBadge label={status.text} state={status.state} live />
          </div>
          <p className="small text-secondary mb-0 mt-3">
            Estado informado pela captura local; não confirma qualidade ou estabilidade física.
          </p>
        </section>
        <LivePlayer camera={camera} onStatusChange={setPlayerStatus} />
      </div>
      {isAdmin && active !== 'monitor' && (
        <section id={`view-${active}`} role="tabpanel" aria-labelledby={`tab-${active}`}>
          <OperationsPanel camera={camera} view={active} playerStatus={playerStatus} />
        </section>
      )}
    </section>
  );
}
