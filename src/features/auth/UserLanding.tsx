export function UserLanding() {
  return (
    <section className="panel-card user-landing mx-auto" aria-labelledby="user-landing-title" tabIndex={-1}>
      <span className="eyebrow">CONTA LOCAL</span>
      <h2 id="user-landing-title" className="h4 mt-2">
        Conta ativa
      </h2>
      <p>
        Seu papel é <strong>User</strong>. Nenhuma câmera foi concedida a esta conta, então o monitoramento
        não está disponível.
      </p>
      <p className="text-secondary mb-0">
        Solicitação de acesso e recuperação de senha ainda não estão disponíveis neste perfil local.
      </p>
    </section>
  );
}
