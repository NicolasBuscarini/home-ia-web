import {
  buildDeepLink,
  moduleDeepLinkParams,
  parseDeepLink,
  serializeDeepLink,
  withDeepLinkParam,
} from 'home-ia-shared';
import { describe, expect, it } from 'vitest';

describe('shared deep link contract', () => {
  it('parses shell and module keys while dropping empty values', () => {
    expect(parseDeepLink('?module=monitoring&view=clips&clip=CLP1&empty=')).toEqual({
      module: 'monitoring',
      view: 'clips',
      clip: 'CLP1',
    });
    expect(parseDeepLink('')).toEqual({});
  });

  it('serializes only defined values and keeps a stable query string', () => {
    expect(serializeDeepLink({ module: 'monitoring', view: 'clips', clip: undefined })).toBe(
      '?module=monitoring&view=clips',
    );
    expect(serializeDeepLink({ clip: 'a b/c' })).toBe('?clip=a+b%2Fc');
    expect(serializeDeepLink({})).toBe('');
  });

  it('builds an absolute link and separates module-scoped params', () => {
    const params = { module: 'monitoring', view: 'clips', clip: 'CLP1' };
    expect(buildDeepLink({ origin: 'http://localhost:8084', pathname: '/' }, params)).toBe(
      'http://localhost:8084/?module=monitoring&view=clips&clip=CLP1',
    );
    expect(moduleDeepLinkParams(params)).toEqual({ clip: 'CLP1' });
    expect(withDeepLinkParam({ clip: 'A' }, 'clip', undefined)).toEqual({});
    expect(withDeepLinkParam({}, 'clip', 'B')).toEqual({ clip: 'B' });
  });
});
