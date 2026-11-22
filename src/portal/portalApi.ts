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
  appearance?: PortalAppearance;
  supportedStyles?: string[];
}

export interface PortalAppearance {
  primary: string;
  mode: 'dark' | 'light';
  style: string;
}

export interface PortalPreferenceUpdate {
  themeId: string;
  languageTag: string;
  appearance: PortalAppearance;
}

export function getPortalNavigation(): Promise<PortalNavigation> {
  return getJson<PortalNavigation>('/api/v1/portal/navigation');
}

export function getPortalPreferences(): Promise<PortalPreferences> {
  return getJson<PortalPreferences>('/api/v1/portal/preferences');
}

export async function savePortalPreferences(
  preferences: PortalPreferenceUpdate,
  signal?: AbortSignal,
): Promise<void> {
  const response = await request('/api/v1/portal/preferences', {
    method: 'PUT',
    body: JSON.stringify(preferences),
    signal,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const saved = (await response.json()) as PortalPreferences;
  if (
    saved.appearance?.primary !== preferences.appearance.primary ||
    saved.appearance.mode !== preferences.appearance.mode ||
    saved.appearance.style !== preferences.appearance.style ||
    saved.languageTag !== preferences.languageTag
  ) {
    // An older API can return 200 while ignoring the new fields. Do not report that as saved.
    throw new Error('Appearance was not confirmed by the portal');
  }
}
