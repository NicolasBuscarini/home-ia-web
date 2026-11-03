import type { SystemsModuleProps } from '../src/portal/platformContract';

export default function SystemsModuleStub({ userRole, portalModuleIds }: SystemsModuleProps) {
  return (
    <section
      aria-label="Módulo de sistemas remoto"
      data-module-ids={portalModuleIds?.join(',') ?? ''}
      data-testid="systems-module"
    >
      <p>{userRole}</p>
    </section>
  );
}
