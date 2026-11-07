import type { BiometricsModuleProps } from '../src/portal/biometricsContract';

export default function BiometricsModuleStub({
  locale,
  userRole,
  portalModuleIds,
  activeView,
}: BiometricsModuleProps) {
  return (
    <section aria-label="Biometria">
      <h2>Biometria</h2>
      <p>
        {locale} · {userRole} · {portalModuleIds?.join(',') ?? 'sem projeção'} · {activeView ?? 'enrollments'}
      </p>
    </section>
  );
}
