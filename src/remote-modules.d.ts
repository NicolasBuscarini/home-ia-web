declare module 'monitoring/MonitoringModule' {
  import type { ComponentType } from 'react';
  import type { MonitoringModuleProps } from './portal/monitoringContract';

  const MonitoringModule: ComponentType<MonitoringModuleProps>;
  export default MonitoringModule;
}
