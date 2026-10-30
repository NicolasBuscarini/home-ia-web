import { describe, expect, it, vi } from 'vitest';
import { getJson, request } from '../src/services/http';

describe('same-origin HTTP client', () => {
  it('uses the session cookie, disables caching, and sends JSON headers for a body', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    await request('/api/v1/auth/logout', { method: 'POST', body: '{}' });
    const call = fetchSpy.mock.calls[0];
    expect(call).toBeDefined();
    const options = call?.[1];
    expect(options?.credentials).toBe('same-origin');
    expect(options?.cache).toBe('no-store');
    expect(new Headers(options?.headers).get('Content-Type')).toBe('application/json');
  });

  it('surfaces HTTP status instead of treating an error payload as success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 401 }));
    await expect(getJson('/api/v1/cameras')).rejects.toMatchObject({ status: 401 });
  });
});
