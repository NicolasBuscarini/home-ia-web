import type { UserRole } from 'home-ia-shared';

export interface BiometricsModuleProps {
  locale: string;
  userRole: UserRole;
  portalModuleIds?: string[];
  activeView?: string;
}
