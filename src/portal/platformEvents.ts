/**
 * Emissor de eventos de navegação do shell (T17-G).
 *
 * O navegador é fonte complementar do EventStore: o portal deriva ator/sessão e só aceita
 * `navigation.*`/`ui.*` de sessão same-origin. A emissão é melhor esforço — nunca bloqueia a
 * navegação, não altera a UI e uma falha fica visível apenas em `getStats()`.
 */
import {
  createCorrelationId,
  createPlatformEventEmitter,
  type PlatformEventEmitterOptions,
  type PlatformEventEmitterStats,
} from 'home-ia-shared';

export interface ShellNavigationInput {
  module: string;
  view?: string;
}

export type ShellEventEmitterOptions = PlatformEventEmitterOptions;

export interface ShellEventEmitter {
  /** Emite `navigation.viewed` e devolve a correlação usada. */
  navigationViewed(input: ShellNavigationInput): string;
  getStats(): PlatformEventEmitterStats;
}

/**
 * Resolve o `fetch` global no momento do envio: a criação do emissor no carregamento do bundle
 * não fixa uma implementação antiga nem quebra quando o ambiente não oferece `fetch`.
 */
function globalFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return globalThis.fetch(input, init);
}

export function createShellEventEmitter(options: ShellEventEmitterOptions = {}): ShellEventEmitter {
  const emitter = createPlatformEventEmitter({
    ...options,
    fetch: options.fetch ?? globalFetch,
  });

  return {
    navigationViewed({ module, view }) {
      // A allowlist de metadados de `navigation.viewed` é vazia, então módulo e submódulo vão na
      // referência do recurso, que a consulta administrativa já filtra por tipo e ID.
      const publicId = view ? `${module}.${view}` : module;
      const correlationId = createCorrelationId(options.createId);
      emitter.emit({
        eventType: 'navigation.viewed',
        correlationId,
        resource: { type: 'portal.module', publicId },
      });
      return correlationId;
    },
    getStats: () => emitter.getStats(),
  };
}

/** Instância usada pelo shell; testes exercitam `createShellEventEmitter` com `fetch` injetado. */
export const shellEvents = createShellEventEmitter();
