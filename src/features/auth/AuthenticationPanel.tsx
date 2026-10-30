import { type FormEvent, useState } from 'react';
import { postJson, safeApiMessage } from '../../services/http';

type AuthMode = 'login' | 'register';

interface AuthenticationPanelProps {
  onAuthenticated: (username: string) => Promise<void>;
}

export function AuthenticationPanel({ onAuthenticated }: AuthenticationPanelProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [busy, setBusy] = useState(false);
  const [loginMessage, setLoginMessage] = useState('');
  const [loginError, setLoginError] = useState('');
  const [registerMessage, setRegisterMessage] = useState('');
  const [registrationComplete, setRegistrationComplete] = useState('');

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const username = String(data.get('username') ?? '');
    const password = String(data.get('password') ?? '');
    setLoginError('');
    setLoginMessage('');
    setBusy(true);
    try {
      const response = await postJson('/api/v1/auth/login', { username, password });
      if (!response.ok) {
        setLoginError('Acesso não autorizado. Confira usuário e senha.');
        return;
      }
      form.reset();
      await onAuthenticated(username);
    } catch {
      setLoginError('Não foi possível acessar o serviço local. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const username = String(data.get('username') ?? '');
    setRegisterMessage('');
    setBusy(true);
    try {
      const response = await postJson('/api/v1/auth/register', {
        username,
        password: String(data.get('password') ?? ''),
        confirmPassword: String(data.get('confirmPassword') ?? ''),
      });
      if (response.status === 202) {
        form.reset();
        setRegistrationComplete(username);
        setLoginMessage(
          'Se os dados forem válidos e o usuário estiver disponível, o cadastro foi processado. Tente entrar; não informamos se o nome já existe.',
        );
        setMode('login');
        return;
      }
      setRegisterMessage(
        response.status === 400
          ? 'Confira o nome de usuário e informe uma senha com pelo menos 6 caracteres.'
          : response.status === 403
            ? 'O cadastro só pode ser enviado pela interface local.'
            : response.status === 429
              ? 'Muitas tentativas. Aguarde um minuto e tente novamente.'
              : safeApiMessage(
                  new Error(`HTTP ${response.status}`),
                  'Não foi possível processar o cadastro local.',
                ),
      );
    } catch {
      setRegisterMessage('Não foi possível acessar o serviço local. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'register') {
    return (
      <section className="panel-card login-panel mx-auto" aria-labelledby="register-title">
        <div className="login-heading mb-4">
          <span className="eyebrow">CONTA LOCAL</span>
          <h2 id="register-title" className="h4 mt-2 mb-2">
            Criar conta
          </h2>
          <p className="text-secondary mb-0">
            A conta começa sem acesso a câmeras. Este cadastro local não verifica e-mail e não oferece
            recuperação de senha.
          </p>
        </div>
        <form onSubmit={submitRegistration}>
          <div className="mb-3">
            <label className="form-label" htmlFor="register-username">
              Usuário
            </label>
            <input
              id="register-username"
              className="form-control"
              name="username"
              autoComplete="username"
              required
              minLength={3}
              maxLength={64}
              pattern="[A-Za-z0-9._@+-]+"
              aria-describedby="register-username-help"
            />
            <div id="register-username-help" className="form-text">
              3–64 caracteres: letras, números, ponto, hífen, sublinhado, @ ou +.
            </div>
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="register-password">
              Senha
            </label>
            <input
              id="register-password"
              className="form-control"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              maxLength={256}
              aria-describedby="register-password-help"
            />
            <div id="register-password-help" className="form-text">
              Mínimo de 6 caracteres. Senhas somente com números são aceitas.
            </div>
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="register-confirm-password">
              Confirmar senha
            </label>
            <input
              id="register-confirm-password"
              className="form-control"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              maxLength={256}
            />
          </div>
          <button className="btn btn-primary w-100" type="submit" disabled={busy}>
            {busy ? 'Processando…' : 'Criar conta'}
          </button>
          <button
            className="btn btn-link w-100 mt-2"
            type="button"
            onClick={() => {
              setMode('login');
              setRegisterMessage('');
            }}
          >
            Voltar para entrar
          </button>
          <p className="feedback error-text mt-3 mb-0" role="status" aria-live="polite">
            {registerMessage}
          </p>
        </form>
      </section>
    );
  }

  return (
    <section className="panel-card login-panel mx-auto" aria-labelledby="login-title">
      <div className="login-heading mb-4">
        <span className="eyebrow">ACESSO PROTEGIDO</span>
        <h2 id="login-title" className="h4 mt-2 mb-2">
          Entre no painel
        </h2>
        <p className="text-secondary mb-0">Entre com suas credenciais de acesso local.</p>
      </div>
      <form onSubmit={submitLogin}>
        <div className="mb-3">
          <label className="form-label" htmlFor="username">
            Usuário
          </label>
          <input
            id="username"
            className="form-control"
            name="username"
            autoComplete="username"
            required
            maxLength={64}
            defaultValue={registrationComplete}
          />
        </div>
        <div className="mb-4">
          <label className="form-label" htmlFor="password">
            Senha
          </label>
          <input
            id="password"
            className="form-control"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={256}
          />
        </div>
        <button className="btn btn-primary w-100" type="submit" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
        <button
          className="btn btn-link w-100 mt-2"
          type="button"
          onClick={() => {
            setMode('register');
            setRegisterMessage('');
            setLoginError('');
          }}
        >
          Criar conta local
        </button>
        <p className="feedback error-text mt-3 mb-0" role="status" aria-live="polite">
          {loginError}
        </p>
        <p className="feedback mt-2 mb-0" role="status" aria-live="polite">
          {loginMessage}
        </p>
      </form>
    </section>
  );
}
