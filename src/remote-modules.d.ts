declare module 'monitoring/MonitoringModule' {
  import type { ComponentType } from 'react';
  import type { MonitoringModuleProps } from './portal/monitoringContract';

  const MonitoringModule: ComponentType<MonitoringModuleProps>;
  export default MonitoringModule;
}

declare module 'platform/AccessModule' {
  import type { ComponentType } from 'react';
  import type { AccessModuleProps } from './portal/platformContract';

  const AccessModule: ComponentType<AccessModuleProps>;
  export default AccessModule;
}

declare module 'activitywatch/ActivityWatchModule' {
  import type { ComponentType } from 'react';
  import type { ActivityWatchModuleProps } from './portal/activitywatchContract';

  const ActivityWatchModule: ComponentType<ActivityWatchModuleProps>;
  export default ActivityWatchModule;
}

declare module 'platform/SystemsModule' {
  import type { ComponentType } from 'react';
  import type { SystemsModuleProps } from './portal/platformContract';

  const SystemsModule: ComponentType<SystemsModuleProps>;
  export default SystemsModule;
}
