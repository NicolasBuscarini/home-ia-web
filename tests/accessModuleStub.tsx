import type { AccessModuleProps } from '../src/portal/platformContract';

export default function AccessModuleStub({ userRole, portalModuleIds }: AccessModuleProps) {
  return (
    <section
      aria-label="Módulo de acesso remoto"
      data-module-ids={portalModuleIds?.join(',') ?? ''}
      data-testid="access-module"
    >
      <p>{userRole}</p>
    </section>
  );
}
