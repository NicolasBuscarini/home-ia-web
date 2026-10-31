# Dependências e licenças

As versões npm são exatas em `package.json` e `package-lock.json`. Licenças abaixo identificam os componentes diretos; dependências transitivas devem ser auditadas no lockfile antes de distribuição. O repositório ainda não concede licença de reutilização para o código do produto.

| Dependência direta                            |                  Versão | Licença declarada |
| --------------------------------------------- | ----------------------: | ----------------- |
| React / React DOM                             |                  19.3.1 | MIT               |
| Bootstrap CSS                                 |                   5.3.8 | MIT               |
| @fontsource-variable/inter (fonte Inter)      |                   5.3.0 | MIT / OFL-1.1     |
| HLS.js                                        |                   1.7.3 | Apache-2.0        |
| Vite / plugin React                           |           8.3.5 / 6.1.2 | MIT               |
| TypeScript                                    |                   7.0.2 | Apache-2.0        |
| Vitest                                        |                   5.0.5 | MIT               |
| Testing Library React / user-event / jest-dom | 16.3.3 / 14.6.8 / 7.0.1 | MIT               |
| jsdom                                         |                  30.1.3 | MIT               |
| Biome                                         |                   2.6.4 | MIT OR Apache-2.0 |

Bootstrap e HLS.js são empacotados localmente; não há CDN. A fonte Inter é servida pelo bundle local via Fontsource (código do pacote MIT; arquivos da fonte sob SIL OFL 1.1). A imagem Node usada pelo Compose é `node:24.22.2-bookworm-slim` fixada também pelo digest no `compose.yaml`.
