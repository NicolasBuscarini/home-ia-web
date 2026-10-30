# garage-watch-web

Frontend React/TypeScript da Garagem IA, mantido neste repositório independente e integrado à API `garage-watch-platform`. A aplicação continua same-origin em produção: ASP.NET Core serve o bundle estático, API, cookie de sessão e gateway HLS. Este projeto não implementa autenticação/autorização próprias.

## Tecnologias

- React + TypeScript e Vite para módulos/componentes e build estático.
- Bootstrap CSS 5.3.8 e HLS.js 1.7.3 locais, sem CDN ou JavaScript de Bootstrap.
- Vitest + Testing Library para comportamento de componentes; Biome para lint/formatação.
- Compose com Node LTS fixado por digest; lockfile npm obrigatório.

## Desenvolvimento

Clone `garage-watch-platform` com seus submódulos (`git clone --recurse-submodules ...`). Para desenvolver com HMR e API real, inicie o profile `web-dev` documentado no runbook da plataforma. O proxy do Vite encaminha `/api/*` e `/health/*` ao host API sem mudar o Host do navegador; o browser continua usando uma única origem local e o cookie HttpOnly.

Verificações isoladas deste repositório, via Compose:

```bash
docker compose --profile verify run --rm verify
```

O comando instala somente conforme `package-lock.json`, verifica lint/formatação, executa testes e gera `dist/`. Não instale Node no host como requisito do projeto.

## Integração de produção

`garage-watch-platform` fixa este projeto como submódulo Git em um commit revisado. O build Docker executa `npm ci`/Vite e copia apenas os arquivos estáticos para o webroot do host API. Atualizações de UI exigem atualizar o ponteiro do submódulo e passar também pelos testes de integração da API.

Temas disponíveis: Bosque (padrão), Grafite, Oceano e Claro. A seleção é local ao browser e não afeta configurações/contas no servidor.

## Limites

Cadastro local aceita senha mínima de 6 caracteres conforme ADR042, inclusive números; isso é permitido somente no perfil loopback e não habilita acesso LAN. OTP/e-mail não está implementado. O frontend não homologa câmera, HLS em browser real, rede ou operação prolongada.

Este repositório público ainda não concede licença de reutilização. Licenças de dependências estão registradas separadamente.
