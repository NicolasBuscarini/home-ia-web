import type { UserRole } from 'home-ia-shared';

export interface AccessModuleProps {
  locale: string;
  userRole: UserRole;
  portalModuleIds?: string[];
  activeView?: string;
  onViewChange?: (view: string) => void;
}

export interface SystemsModuleProps {
  locale: string;
  userRole: UserRole;
  portalModuleIds?: string[];
}
