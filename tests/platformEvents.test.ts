import { describe, expect, it, vi } from 'vitest';
import { createShellEventEmitter } from '../src/portal/platformEvents';

describe('shell platform events', () => {
  it('emits navigation.viewed with correlation, resource and same-origin credentials', async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetchStub = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ input: String(input), init });
      return new Response(null, { status: 201 });
    }) as typeof fetch;
    let counter = 0;
    const emitter = createShellEventEmitter({
      fetch: fetchStub,
      createId: () => `id-${++counter}`,
      now: () => Date.parse('2026-11-05T12:00:00Z'),
    });

    const correlationId = emitter.navigationViewed({ module: 'monitoring', view: 'clips' });
    await vi.waitFor(() => expect(calls).toHaveLength(1));

    expect(correlationId).toBe('id-1');
    const call = calls[0];
    expect(call?.input).toBe('/api/v1/events');
    const init = call?.init ?? {};
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('same-origin');
    expect((init.headers as Record<string, string>)['X-Correlation-Id']).toBe('id-1');

    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      schemaVersion: '1.0',
      eventId: 'id-2',
      eventType: 'navigation.viewed',
      category: 'navigation',
      severity: 'info',
      outcome: 'success',
      occurredAtUtc: '2026-11-05T12:00:00.000Z',
      source: 'shell',
      emitter: 'browser',
      correlationId: 'id-1',
      resource: { type: 'portal.module', publicId: 'monitoring.clips' },
    });
    expect(body).not.toHaveProperty('actor');
    expect(body).not.toHaveProperty('metadata');
    expect(emitter.getStats()).toMatchObject({ sent: 1, failed: 0, dropped: 0 });
  });

  it('uses the bare module id when the area has no submodule', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const emitter = createShellEventEmitter({
      fetch: (async (_input: RequestInfo | URL, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return new Response(null, { status: 201 });
      }) as typeof fetch,
    });

    emitter.navigationViewed({ module: 'systems' });
    await vi.waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]?.resource).toEqual({ type: 'portal.module', publicId: 'systems' });
  });

  it('stays silent and counts the failure when the portal rejects the event', async () => {
    const emitter = createShellEventEmitter({
      fetch: (async () => new Response(null, { status: 503 })) as typeof fetch,
    });

    emitter.navigationViewed({ module: 'audit' });

    await vi.waitFor(() => expect(emitter.getStats().failed).toBe(1));
    expect(emitter.getStats().sent).toBe(0);
  });
});
