import { expect, it } from 'vitest';
import { disableFixed } from '#/shared/service/tenantEnabled';

it('says why the system tenant cannot be switched off, and nothing for another', () => {
  expect(disableFixed('system')).toMatch(/^system cannot be disabled/u);
  expect(disableFixed('acme')).toBeNull();
});
