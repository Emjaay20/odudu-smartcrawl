import { describe, expect, it } from 'vitest';
import {
  generateRecoveryCodes,
  normaliseRecoveryCode,
  RECOVERY_CODE_ALPHABET,
  RECOVERY_CODE_COUNT,
} from '../../packages/authn-flows/src/service/authenticators/recovery.js';
import { at, loadSource, PROTOCOL_PAGES } from './markdown.js';

const GUIDE = PROTOCOL_PAGES;

// Every code the transcript prints is one the generator could have printed:
// the alphabet, the length and the printed grouping are all claims the page
// makes in prose beside them, and a change to any of the three would
// otherwise leave the transcript asserting a shape the server stopped
// producing.
describe('the recovery codes in the protocol pages have the shape the generator produces', () => {
  const document = loadSource(GUIDE);
  const shown = document.lines
    .map((line, index) => ({ text: line.trim(), lineNumber: index + 1 }))
    .flatMap(({ text, lineNumber }) => {
      const match = /^<li><bdi dir="ltr"><code>([^<]+)<\/code><\/bdi><\/li>$/u.exec(text);
      return match?.[1] === undefined ? [] : [{ code: match[1], lineNumber }];
    });

  it('shows a full set of them', () => {
    expect(shown).toHaveLength(RECOVERY_CODE_COUNT);
  });

  it('shows only codes drawn from the generator’s alphabet, at its own length', () => {
    const [sample = ''] = generateRecoveryCodes(1);
    const separatorAt = sample.indexOf('-');
    for (const { code, lineNumber } of shown) {
      const where = at(document, lineNumber);
      expect(`${where}: ${String(code.length)}`).toBe(`${where}: ${String(sample.length)}`);
      expect(`${where}: ${String(code.indexOf('-'))}`).toBe(`${where}: ${String(separatorAt)}`);
      for (const character of normaliseRecoveryCode(code)) {
        expect(`${where}: ${character}`).toBe(
          `${where}: ${RECOVERY_CODE_ALPHABET.includes(character) ? character : '(not in the alphabet)'}`,
        );
      }
    }
  });
});
