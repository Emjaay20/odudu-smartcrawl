import { describe, expect, it } from 'vitest';
import { captureAddress, sizeOf } from '@site/src/shared/service/consoleShot';

describe('the console picture service', () => {
  it('reads a picture size from the manifest and names its two captures', () => {
    expect(sizeOf('clients')).toEqual({ width: 1100, height: 900 });
    expect(captureAddress('clients', 'dark')).toBe('/console/clients-dark.webp');
  });
});
