import { getJson, request } from 'home-ia-shared';

export interface PortalNavigationItem {
  itemId: string;
  labelKey: string;
  sortOrder: number;
}

export interface PortalNavigationModule {
  moduleId: string;
  displayNameKey: string;
  contractVersion: string;
  menuGroup: string;
  menuOrder: number;
  menuIcon: string;
  menuLabelKey: string;
  route: string;
  items: PortalNavigationItem[];
}

export interface PortalNavigation {
  residenceId: string;
  generatedAtUtc: string;
  modules: PortalNavigationModule[];
}

export interface PortalPreferences {
  themeId: string;
  languageTag: string;
  isDefault: boolean;
  updatedAtUtc: string | null;
  supportedThemes: string[];
  supportedLanguages: string[];
}

export function getPortalNavigation(): Promise<PortalNavigation> {
  return getJson<PortalNavigation>('/api/v1/portal/navigation');
}

export function getPortalPreferences(): Promise<PortalPreferences> {
  return getJson<PortalPreferences>('/api/v1/portal/preferences');
}

export async function savePortalPreferences(themeId: string, languageTag: string): Promise<void> {
  const response = await request('/api/v1/portal/preferences', {
    method: 'PUT',
    body: JSON.stringify({ themeId, languageTag }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}
