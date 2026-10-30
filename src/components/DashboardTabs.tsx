import { type KeyboardEvent, useRef } from 'react';

export type DashboardTab = 'monitor' | 'health' | 'dependencies' | 'capture';

interface TabDefinition {
  id: DashboardTab;
  label: string;
}

const ADMIN_TABS: TabDefinition[] = [
  { id: 'monitor', label: 'Monitoramento' },
  { id: 'health', label: 'Saúde do sistema' },
  { id: 'dependencies', label: 'Dependências' },
  { id: 'capture', label: 'Segmentos e lacunas' },
];

interface DashboardTabsProps {
  active: DashboardTab;
  isAdmin: boolean;
  onChange: (tab: DashboardTab) => void;
}

export function DashboardTabs({ active, isAdmin, onChange }: DashboardTabsProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabs = isAdmin ? ADMIN_TABS : ADMIN_TABS.slice(0, 1);

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
    <div className="view-tabs mb-3" role="tablist" aria-label="Telas do painel" onKeyDown={onKeyDown}>
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
