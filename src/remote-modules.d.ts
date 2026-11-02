declare module 'monitoring/MonitoringModule' {
  import type { ComponentType } from 'react';
  import type { MonitoringModuleProps } from './features/monitoring/MonitoringModuleFallback';

  const MonitoringModule: ComponentType<MonitoringModuleProps>;
  export default MonitoringModule;
}
