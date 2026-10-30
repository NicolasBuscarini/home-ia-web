import { beforeEach, describe, expect, it } from 'vitest';
import { getOrCreateClientId } from '../src/services/clientIdentity';

describe('client presence identity', () => {
  beforeEach(() => sessionStorage.clear());

  it('reuses one ephemeral UUID for reloads in the same tab', () => {
    const first = getOrCreateClientId();
    const afterReload = getOrCreateClientId();

    expect(first).toMatch(/^[0-9a-f-]{36}$/i);
    expect(afterReload).toBe(first);
    expect(sessionStorage.getItem('garage-watch.client-id.v1')).toBe(first);
  });

  it('replaces invalid stored values instead of sending them as client IDs', () => {
    sessionStorage.setItem('garage-watch.client-id.v1', 'invalid');

    const clientId = getOrCreateClientId();

    expect(clientId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(sessionStorage.getItem('garage-watch.client-id.v1')).toBe(clientId);
  });
});
