import type { CameraStatus, UserRole } from '../../domain/platform';
import { Dashboard } from './Dashboard';

export interface MonitoringModuleProps {
  locale: string;
  cameras: CameraStatus[];
  selectedCameraId?: string;
  onCameraSelect: (cameraId: string) => void;
  userRole: UserRole;
  portalModuleIds?: string[];
}

export default function MonitoringModuleFallback({
  cameras,
  selectedCameraId,
  onCameraSelect,
  userRole,
  portalModuleIds,
}: MonitoringModuleProps) {
  return (
    <Dashboard
      cameras={cameras}
      selectedCameraId={selectedCameraId}
      onCameraSelect={onCameraSelect}
      userRole={userRole}
      portalModuleIds={portalModuleIds}
    />
  );
}
