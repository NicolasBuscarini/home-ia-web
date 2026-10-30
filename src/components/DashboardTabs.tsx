import { type KeyboardEvent, useRef } from 'react';
import { useI18n } from '../i18n/i18n';

export type DashboardTab = 'monitor' | 'health' | 'dependencies' | 'capture';

interface DashboardTabsProps {
  active: DashboardTab;
  isAdmin: boolean;
  onChange: (tab: DashboardTab) => void;
}

export function DashboardTabs({ active, isAdmin, onChange }: DashboardTabsProps) {
  const { t } = useI18n();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const allTabs: Array<{ id: DashboardTab; label: string }> = [
    { id: 'monitor', label: t('dashboard.tabs.monitor') },
    { id: 'health', label: t('dashboard.tabs.health') },
    { id: 'dependencies', label: t('dashboard.tabs.dependencies') },
    { id: 'capture', label: t('dashboard.tabs.capture') },
  ];
  const tabs = isAdmin ? allTabs : allTabs.slice(0, 1);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = tabs.findIndex((tab) => tab.id === active);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : event.key === 'ArrowRight'
            ? (current + 1) % tabs.length
            : event.key === 'ArrowLeft'
              ? (current + tabs.length - 1) % tabs.length
              : -1;
    const target = tabs[next];
    if (!target) return;
    event.preventDefault();
    onChange(target.id);
    refs.current[next]?.focus();
  }

  return (
    <div
      className="view-tabs mb-3"
      role="tablist"
      aria-label={t('dashboard.tabs.label')}
      onKeyDown={onKeyDown}
    >
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          ref={(element) => {
            refs.current[index] = element;
          }}
          id={`tab-${tab.id}`}
          className="view-tab"
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          aria-controls={`view-${tab.id}`}
          tabIndex={active === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
