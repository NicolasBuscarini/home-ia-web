import type { ActivityWatchModuleProps } from '../src/portal/activitywatchContract';

export default function ActivityWatchModuleStub({ portalModuleIds }: ActivityWatchModuleProps) {
  return <div data-testid="activitywatch-module" data-module-ids={portalModuleIds?.join(',')} />;
}
