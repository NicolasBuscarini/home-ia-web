# garage-watch-web

Frontend React/TypeScript da Garagem IA, mantido neste repositório independente e integrado à API `garage-watch-platform`. A aplicação continua same-origin em produção: ASP.NET Core serve o bundle estático, API, cookie de sessão e gateway HLS. Este projeto não implementa autenticação/autorização próprias.

## Tecnologias

- React + TypeScript e Vite para módulos/componentes e build estático.
- Bootstrap CSS 5.3.8 e HLS.js 1.7.3 locais, sem CDN ou JavaScript de Bootstrap.
- Fonte Inter Variable empacotada localmente por `@fontsource-variable/inter` (SIL OFL 1.1), também sem CDN.
- Vitest + Testing Library para comportamento de componentes; Biome para lint/formatação.
- Microinterações e entrada de painéis respeitam `prefers-reduced-motion`; animações evitam mudanças de layout e não acompanham o polling do player.
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

Temas disponíveis: Bosque (padrão), Grafite, Oceano, Claro, Lavanda, Pôr do sol, Âmbar e Rosa. O seletor apresenta amostras de fundo, painel e cor de destaque junto a uma mini prévia; a seleção é local ao browser e não afeta configurações/contas no servidor.

No monitoramento autenticado, o vídeo ao vivo inicia automaticamente sem áudio; o usuário pode ativar o som nos controles. O player usa HLS nativo quando declarado pelo navegador e recorre ao HLS.js quando necessário; os buffers limitados se aplicam ao caminho HLS.js (meta 12 s, máximo 18 s, 6 s anteriores e limite de 48 MB). Isso não é um histórico de 15 minutos. A identidade efêmera de presença fica em `sessionStorage` para manter a mesma aba ao recarregar, sem cookie/localStorage nem persistência no servidor.

O painel trata câmeras como coleção: com uma câmera, apresenta o estado diretamente; com várias, permite escolher qual monitorar por teclado ou toque. Somente a câmera selecionada abre o player, evitando streams de vídeo concorrentes no browser. Isso prepara a interface, mas não ativa captura multicâmera: a API e a operação continuam limitadas ao perfil ativo, e a expansão exige catálogo/autorização e benchmark próprios.

O painel autentica e organiza a navegação principal como **Monitoramento**, **Sistema** e **Gestão**. Sistema abre telas de saúde, dependências e captura; Gestão abre telas independentes de Usuários, Perfis e permissões e Pedidos de acesso. Usuários mostra contas e atribui perfis existentes com escopos de câmera; a tela separada de perfis configura permissões do catálogo, agrupadas por domínio e com nome/descrição traduzidos, e publica versões imutáveis sem alterar atribuições já feitas. Listas paginadas de contas e pedidos têm filtros em tela que atuam sobre os itens carregados na página, com contagem explícita e botão para limpar. Administrator é reservado e não recebe perfis; desativação preserva conta/auditoria e revoga atribuições/sessões. A autorização continua sendo revalidada pelo servidor. Uma conta sem acesso live permanece na landing e não consulta catálogo, readiness ou mídia.

Um `User` pode enviar um pedido de acesso categorizado; seu estado pendente é carregado ao entrar na landing. A solicitação é auditada e persistida, mas nunca concede câmera por si só. Administrators podem marcar o pedido como analisado e precisam atribuir o perfil/escopo separadamente. E-mail de pedido não está configurado; UI informa essa limitação.

Idiomas disponíveis: Português (Brasil) e English (US). A seleção fica salva no browser; na primeira visita, o idioma do navegador escolhe inglês quando compatível e, nos demais casos, usa pt-BR. Componentes obtêm `t()` e o idioma por `useI18n()`; novas mensagens são adicionadas uma única vez por locale ao catálogo tipado em `src/i18n/messages.ts`, com interpolação de valores, sem ramificações de interface duplicadas.

Execute as verificações a partir do repositório de contexto com `./garage verify-web`; ele encaminha ao Compose fixado do projeto web.

O ensaio browser automatizado parcial de CT02 roda com `./garage test-ct02-web`: por padrão, usa Chromium headless em desktop e viewport mobile emulado, autentica pela UI, confirma negação anônima de catálogo/playlist e observa playback decodificado por 10 min. Credenciais vêm de `CT02_USERNAME`/`CT02_PASSWORD` no ambiente ou `AUTH_USERNAME`/`AUTH_PASSWORD` no `.env` raiz; nunca são impressas. `CT02_BASE_URL` e `CT02_DURATION_SECONDS` podem ajustar destino e duração. Não reinicia serviços. Mobile emulado não é celular físico, e sem timestamp de origem validado o teste não mede latência fonte→tela nem p95; portanto não conclui CT02.

## Limites

Cadastro local aceita senha mínima de 6 caracteres conforme ADR042, inclusive números; isso é permitido somente no perfil loopback e não habilita acesso LAN. OTP/e-mail não está implementado. O frontend não homologa câmera, HLS em browser real, rede ou operação prolongada.

Este repositório público ainda não concede licença de reutilização. Licenças de dependências estão registradas separadamente.
