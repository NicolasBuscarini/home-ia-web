# garage-watch-web

Frontend React/TypeScript do **Home IA**, mantido neste repositório independente e integrado à API `home-ia-portal`.

## Portal (T16-D concluída no escopo local)

A UI atual passou a consumir a projeção do portal: após autenticar, busca `GET /api/v1/portal/navigation` para decidir quais módulos/grupos de menu exibir e `GET /api/v1/portal/preferences` para aplicar tema/idioma persistidos; mudanças de tema/idioma são enviadas por `PUT /api/v1/portal/preferences`. O painel de monitoramento é montado atrás de `PortalModuleBoundary`, que contém falhas do módulo sem derrubar o cabeçalho/menu do portal. A marca visível e o título passam a ser **Home IA**; o código de monitoramento continua no mesmo bundle e repositório nesta fase.

O shell carrega o módulo de Monitoramento e o módulo de topo **Biometria** por **Module Federation** a partir de `home-ia-monitoring-web` (`./MonitoringModule` e `./BiometricsModule`, via `VITE_MONITORING_REMOTE_URL`, default `http://127.0.0.1:5174/remoteEntry.js`). O código de monitoramento foi removido do shell e os testes de domínio foram movidos para o remote; uma falha de carregamento mostra o estado de módulo indisponível do `PortalModuleBoundary`. A autorização continua no servidor.

Links profundos (`?module=<id>&view=<id>&<parâmetro>=<valor>`) abertos sem sessão permanecem na barra de endereço durante o login. Após autenticar, o shell revalida o módulo/view contra a projeção do portal e as permissões do perfil: se autorizado, restaura o destino e os parâmetros do módulo; caso contrário, abre a primeira área permitida e descarta os parâmetros do link. A restauração é feita no próprio SPA (`history.replaceState`), sem reload; o servidor continua sendo a autoridade de sessão e autorização.

A composição federada usa `home-ia-shared` para i18n, tema, HTTP, tipos, `StatusBadge` e CSS global, compartilhado como singleton. Os módulos administrativos vêm do remote `home-ia-platform-web` (`./AccessModule`, `./SystemsModule` e `./AuditModule`). A área **Auditoria** aparece como item de topo somente quando a projeção do portal inclui o submenu `audit` (permissão `events.read`), inclusive para perfis delegados que não são Administrator; sem projeção, o fallback local a mantém apenas para Administrator e o servidor continua autorizando cada consulta. Os textos da auditoria vêm do catálogo compartilhado (`audit.*`) em `home-ia-shared`. `./garage test-federation-web` builda shared, os remotes de Monitoramento, Atividade e Plataforma e o shell, sobe previews isolados (shell 5183, Monitoramento 5184, ActivityWatch 5185, Plataforma 5186) e valida o carregamento federado dos três módulos em Chromium com axe WCAG 2.0 A/AA (com contraste), foco por teclado, reflow em 320 px e capturas de tela, incluindo o agregado de saúde do portal com estados saudável/degradado e erro sanitizado. A inspeção humana em dispositivo físico/leitor de tela e o CT02 continuam pendentes. A renomeação do repositório GitHub/submodule/URLs pertence a `T16-F`. A aplicação continua same-origin em produção: ASP.NET Core serve o bundle estático, API, cookie de sessão e gateway HLS. Este projeto não implementa autenticação/autorização próprias.

O shell emite eventos de navegação do EventStore (`T17-G`): ao entrar em uma área ou submódulo, incluindo o destino inicial de um deep link, envia `navigation.viewed` a `POST /api/v1/events` pelo emissor de `home-ia-shared`, com correlação própria e `resource={type:'portal.module', publicId:'<módulo>[.<submódulo>]'}` (a allowlist de metadados do tipo é vazia). É melhor esforço: fila limitada, deduplicação do mesmo destino e falha silenciosa para o usuário; o servidor deriva ator/sessão e continua autoridade de autorização. `ui.action` e os demais emissores seguem pendentes em `T17-G`.

## Tecnologias

- React + TypeScript e Vite para módulos/componentes e build estático.
- Bootstrap CSS 5.3.8 e HLS.js 1.7.3 locais, sem CDN ou JavaScript de Bootstrap.
- Fonte Inter Variable empacotada localmente por `@fontsource-variable/inter` (SIL OFL 1.1), também sem CDN.
- Vitest + Testing Library para comportamento de componentes; Biome para lint/formatação.
- Microinterações e entrada de painéis respeitam `prefers-reduced-motion`; animações evitam mudanças de layout e não acompanham o polling do player.
- Compose com Node LTS fixado por digest; lockfile npm obrigatório.

## Desenvolvimento

Clone `home-ia-portal` com seus submódulos (`git clone --recurse-submodules ...`). Para desenvolver com HMR e API real, inicie o profile `web-dev` documentado no runbook da plataforma. O proxy do Vite encaminha `/api/*` e `/health/*` ao host API sem mudar o Host do navegador; o browser continua usando uma única origem local e o cookie HttpOnly.

Verificações isoladas deste repositório, via Compose:

```bash
docker compose --profile verify run --rm verify
```

O comando instala somente conforme `package-lock.json`, verifica lint/formatação, executa testes e gera `dist/`. Não instale Node no host como requisito do projeto.

## Integração de produção

`home-ia-portal` fixa este projeto como submódulo Git em um commit revisado. O build Docker executa `npm ci`/Vite e copia apenas os arquivos estáticos para o webroot do host API. Atualizações de UI exigem atualizar o ponteiro do submódulo e passar também pelos testes de integração da API.

Temas disponíveis: Bosque (padrão), Grafite, Oceano, Claro, Lavanda, Pôr do sol, Âmbar e Rosa. O seletor apresenta amostras de fundo, painel e cor de destaque junto a uma mini prévia; a seleção é local ao browser e não afeta configurações/contas no servidor.

No monitoramento autenticado, o vídeo ao vivo inicia automaticamente sem áudio; o usuário pode ativar o som nos controles. O player usa HLS nativo quando declarado pelo navegador e recorre ao HLS.js quando necessário; os buffers limitados se aplicam ao caminho HLS.js (meta 12 s, máximo 18 s, 6 s anteriores e limite de 48 MB). Isso não é um histórico de 15 minutos. A identidade efêmera de presença fica em `sessionStorage` para manter a mesma aba ao recarregar, sem cookie/localStorage nem persistência no servidor.

O painel trata câmeras como coleção: com uma câmera, apresenta o estado diretamente; com várias, permite escolher qual monitorar por teclado ou toque. Somente a câmera selecionada abre o player, evitando streams de vídeo concorrentes no browser. Isso prepara a interface, mas não ativa captura multicâmera: a API e a operação continuam limitadas ao perfil ativo, e a expansão exige catálogo/autorização e benchmark próprios.

O painel autentica e organiza a navegação principal como **Monitoramento**, **Clipes**, **Sistema** e **Gestão**. Clipes apresenta timeline paginada com filtro por data UTC/estado, thumbnail limitada a 112×63 px em telas maiores e 80×45 px em telas estreitas, detalhe de metadados e playback local; a API revalida `clips.read` por câmera e valida hash da mídia. Administrators configuram retenção em dias e limite opcional em GB por câmera e podem usar **Preservar clipe**; o estado de preservação e a política vêm da API/IAM, que também protege o clipe de expurgo. O limite conta mídia+thumbnail no arquivo local commitado, não o spool temporário; cópias expiradas são sinalizadas na timeline e a origem/spool permanece intacta. Sem legendas/transcrição no contrato de clipe, a UI informa essa limitação. Sistema abre telas de saúde, dependências e captura; Gestão abre Câmeras, Usuários, Perfis e permissões e Pedidos de acesso. A tela Câmeras renomeia itens do catálogo e, no modo `camera-integration`, consulta/aplica o endereço local da única câmera capturada; mudar o host pede confirmação e pode criar uma breve lacuna ao reconectar. Credenciais nunca são pedidas/exibidas e câmeras adicionais não iniciam captura. Usuários mostra contas e atribui perfis existentes com escopos de câmera; a tela separada de perfis configura permissões do catálogo, agrupadas por domínio e com nome/descrição traduzidos, e publica versões imutáveis sem alterar atribuições já feitas. Listas paginadas de contas e pedidos têm filtros em tela que atuam sobre os itens carregados na página, com contagem explícita e botão para limpar. Administrator é reservado e não recebe perfis; desativação preserva conta/auditoria e revoga atribuições/sessões. A autorização continua sendo revalidada pelo servidor. Gestão também abre **Pessoas**, com o roster mínimo de pessoas autorizadas (nome, finalidade e confirmação de autorização, sem imagem/vetor), a lista de candidatos de extrator facial com seleção apenas para avaliação (`runtimeEnabled`/`sampleCollectionEnabled` sempre falsos) e a tela **Minha biometria**, que envia apenas arquivo JPEG/PNG, exige o aceite do consentimento `biometric-consent.v1` e mostra estado, expiração e revogação do cadastro cifrado. Contas sem monitoramento também veem **Minha biometria** na landing. Com o adapter de extração ativo, rejeições de imagem (nenhum rosto, vários rostos, rosto pequeno, arquivo ilegível) aparecem com mensagem específica; sem pesos verificados ou chave, o cadastro é recusado com mensagem explícita e nada é gravado. A seção de extrator também mostra o estado do adapter real. Uma conta sem acesso live permanece na landing e não consulta catálogo, readiness ou mídia.

Um `User` pode enviar um pedido de acesso categorizado; seu estado pendente é carregado ao entrar na landing. A solicitação é auditada e persistida, mas nunca concede câmera por si só. Administrators podem marcar o pedido como analisado e precisam atribuir o perfil/escopo separadamente. E-mail de pedido não está configurado; UI informa essa limitação.

Gestão e clipes consomem IDs públicos da API (`publicId`, `profileVersionPublicId` e IDs públicos de câmera/contexto); não constroem URLs ou filtros com PKs internas. A API permanece autoridade de validação e autorização. O formato e a migração são documentados no contrato local da Platform.

Idiomas disponíveis: Português (Brasil) e English (US). A seleção fica salva no browser; na primeira visita, o idioma do navegador escolhe inglês quando compatível e, nos demais casos, usa pt-BR. Componentes obtêm `t()` e o idioma por `useI18n()`; novas mensagens são adicionadas uma única vez por locale ao catálogo tipado em `src/i18n/messages.ts`, com interpolação de valores, sem ramificações de interface duplicadas.

Execute as verificações a partir do repositório de contexto com `./garage verify-web`; ele encaminha ao Compose fixado do projeto web.

O ensaio browser automatizado parcial de CT02 roda com `./garage test-ct02-web`: por padrão, usa Chromium headless em desktop e viewport mobile emulado, autentica pela UI, confirma negação anônima de catálogo/playlist e observa playback decodificado por 10 min. Credenciais vêm de `CT02_USERNAME`/`CT02_PASSWORD` no ambiente ou `AUTH_USERNAME`/`AUTH_PASSWORD` no `.env` raiz; nunca são impressas. `CT02_BASE_URL` e `CT02_DURATION_SECONDS` podem ajustar destino e duração. Não reinicia serviços. Mobile emulado não é celular físico, e sem timestamp de origem validado o teste não mede latência fonte→tela nem p95; portanto não conclui CT02.

## Limites

Cadastro local aceita senha mínima de 6 caracteres conforme ADR042, inclusive números; isso é permitido somente no perfil loopback e não habilita acesso LAN. OTP/e-mail não está implementado. O frontend não homologa câmera, HLS em browser real, rede ou operação prolongada.

Este repositório público ainda não concede licença de reutilização. Licenças de dependências estão registradas separadamente.
