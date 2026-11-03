import type { MonitoringModuleProps } from '../src/portal/monitoringContract';

export default function MonitoringModuleStub({
  cameras,
  onCameraSelect,
  userRole,
  portalModuleIds,
  activeView,
}: MonitoringModuleProps) {
  return (
    <section
      aria-label="Módulo de monitoramento remoto"
      data-module-ids={portalModuleIds?.join(',') ?? ''}
      data-active-view={activeView ?? ''}
      data-testid="monitoring-module"
    >
      <p>{userRole}</p>
      {cameras.map((camera) => (
        <button key={camera.cameraId} type="button" onClick={() => onCameraSelect(camera.cameraId)}>
          {camera.cameraId}
        </button>
      ))}
    </section>
  );
}
