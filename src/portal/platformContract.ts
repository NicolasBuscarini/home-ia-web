import type { UserRole } from 'home-ia-shared';

export interface AccessModuleProps {
  locale: string;
  userRole: UserRole;
  portalModuleIds?: string[];
}

export interface SystemsModuleProps {
  locale: string;
  userRole: UserRole;
  portalModuleIds?: string[];
}
