import type { AuditModuleProps } from '../src/portal/platformContract';

export default function AuditModuleStub({ userRole, portalModuleIds }: AuditModuleProps) {
  return (
    <section
      aria-label="Módulo de auditoria remoto"
      data-module-ids={portalModuleIds?.join(',') ?? ''}
      data-testid="audit-module"
    >
      <p>{userRole}</p>
    </section>
  );
}
