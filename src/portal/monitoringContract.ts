import type { CameraStatus, UserRole } from 'home-ia-shared';

export interface MonitoringModuleProps {
  locale: string;
  cameras: CameraStatus[];
  selectedCameraId?: string;
  onCameraSelect: (cameraId: string) => void;
  userRole: UserRole;
  portalModuleIds?: string[];
  activeView?: string;
  deepLinkParams?: Record<string, string>;
  onDeepLinkParamsChange?: (params: Record<string, string>) => void;
}
