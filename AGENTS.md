# Instruções do projeto garage-watch-web

## Autoridade e fronteiras

- Repositório público independente da interface React do Home IA; `../../docs/` no repositório de contexto é a autoridade de produto, segurança e arquitetura.
- Em `T16-D`, a UI consome a projeção do portal (`/api/v1/portal/navigation`, `/api/v1/portal/preferences`) e carrega o módulo de Monitoramento por Module Federation a partir de `home-ia-monitoring-web` (`VITE_MONITORING_REMOTE_URL`). O `PortalModuleBoundary` isola falhas e o código local de monitoramento permanece como fallback de migração; não remover o fallback nem renomear repositórios sem a fase `T16-F`.
- A API em `garage-watch-platform` continua autoridade de sessão, papéis, câmera, health e mídia. Não duplicar regras de autorização nem incorporar segredos no bundle.
- Em produção, o bundle é servido pelo host da API same-origin; manter cookies, HLS, cadastro e Origin no mesmo host. Vite usa proxy somente para desenvolvimento local.
- Usuário `User` não recebe câmera. Não chamar catálogo/ready/live para a landing sem acesso; esconder UI nunca substitui autorização do servidor.
- Mídia, credenciais, dados pessoais e `.env` não entram no repositório.

## Engenharia

- React + TypeScript, Vite, Bootstrap CSS local e HLS.js local. Não adicionar CDN, backend paralelo ou estado global/framework sem necessidade comprovada.
- Componentes coesos por funcionalidade; dados remotos passam por cliente HTTP same-origin tipado, com timeout, erros explícitos e sem armazenar senha/cookie em JavaScript.
- Tratar UI como comportamento: teclado/foco, semântica/ARIA, responsividade, estados de loading/empty/error, mensagens em português e preferências visuais persistidas sem dados sensíveis.
- Temas usam tokens CSS próprios e Bootstrap local; testar persistência e seleção. Respeitar `prefers-reduced-motion` e contraste.
- O player HLS deve manter os limites existentes de buffer curtos e finitos (`maxBufferLength: 12`, `maxMaxBufferLength: 18`, `backBufferLength: 6`, `maxBufferSize: 48_000_000` bytes de mídia comprimida), destruir instâncias/handlers ao trocar epoch ou desmontar, e não agendar render React se posição/duração/estado live visíveis não mudarem. Isso limita o buffer de mídia gerenciado pelo HLS.js, não a memória total de vídeo/decoder do browser; não atribuir aumento de RSS a histórico ilimitado sem medição. Não configurar janela de 15 min como buffer de browser: retenção/spool e janela seekable são conceitos distintos. Para câmera capturando, tentar autoplay no live edge sem áudio; autoplay é best-effort e requer fallback acessível se bloqueado. Áudio exige ação explícita.
- O ID de presença é um UUID aleatório, efêmero por aba, guardado somente em `sessionStorage` para sobreviver a reloads da mesma aba e evitar leases duplicados durante o TTL do servidor. Nunca é credencial nem deve ir a localStorage/cookie/API de perfil; se sessionStorage estiver indisponível, a estabilidade fica limitada ao carregamento atual. Não alterar sem decisão o heartbeat/TTL/contagem server-side.
- Todo texto visível/ARIA deve vir do catálogo tipado `src/i18n/messages.ts`; usar `useI18n()` em componentes sem propagar idioma manualmente. Ao adicionar chave, preencher `pt-BR` e `en-US`; manter interpolação para valores e evitar lógica/código duplicado por idioma. Persistência e detecção de idioma ficam centralizadas em `src/i18n/i18n.tsx`.
- Testar fluxos observáveis com Vitest/Testing Library. Os testes deste projeto complementam, não substituem, a integração da API real em `garage-watch-platform`.
- Fixar Node, dependências e imagens por versão/hash quando selecionados; Compose é o ambiente documentado de instalação/verificação.

## Verificações

- Executar dentro de Compose: `npm ci`, Biome, Vitest e build Vite.
- Atualizar `README.md`, contratos locais e instruções compartilhadas ao mudar fluxo/API, tema, build ou integração com a plataforma.
- Para validar performance real do player, executar a observação de 10 min desktop/celular de CT38 e registrar browser/dispositivo e condições; testes automatizados e os caps HLS não comprovam estabilidade de RSS/decoder nem compatibilidade de autoplay em hardware real.
