import type { UserRole } from 'home-ia-shared';

export interface ActivityWatchModuleProps {
  locale: string;
  userRole?: UserRole;
  portalModuleIds?: string[];
}
