import type { AccessModuleProps } from '../src/portal/platformContract';

export default function AccessModuleStub({ userRole, portalModuleIds, activeView }: AccessModuleProps) {
  return (
    <section
      aria-label="Módulo de acesso remoto"
      data-module-ids={portalModuleIds?.join(',') ?? ''}
      data-active-view={activeView ?? ''}
      data-testid="access-module"
    >
      <p>{userRole}</p>
    </section>
  );
}
