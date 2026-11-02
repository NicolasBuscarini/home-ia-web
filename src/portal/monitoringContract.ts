import type { CameraStatus, UserRole } from '../domain/platform';

export interface MonitoringModuleProps {
  locale: string;
  cameras: CameraStatus[];
  selectedCameraId?: string;
  onCameraSelect: (cameraId: string) => void;
  userRole: UserRole;
  portalModuleIds?: string[];
}
