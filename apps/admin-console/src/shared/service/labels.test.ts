import { TENANT_NAME_RULE } from '@odudu/contracts';
import { describe, expect, it } from 'vitest';
import { TENANT_NAME_RULE_TEXT } from '#/shared/service/labels';

describe('the tenant name rule', () => {
  it("states the contract's own rule, as a sentence", () => {
    expect(TENANT_NAME_RULE_TEXT.toLowerCase()).toBe(`${TENANT_NAME_RULE}.`);
    expect(TENANT_NAME_RULE_TEXT.startsWith('A tenant name')).toBe(true);
  });
});
