import { describe, expect, it } from 'vitest';
import { at, fencedBlocks, jsonObjectsIn, loadPages, PROTOCOL_PAGES } from './markdown.js';

// `auth_time` names a decoded ID token payload wherever it appears in this
// document — it is never shown on anything else. That is what lets this
// check find every such payload without hand-listing line numbers, and
// catch the next one a future edit adds.
describe('every decoded ID token payload in the protocol pages states amr and acr', () => {
  it('carries both claims wherever it carries auth_time', () => {
    const document = loadPages(PROTOCOL_PAGES);
    const payloads = fencedBlocks(document)
      .filter((block) => block.language === 'json')
      .flatMap((block) =>
        jsonObjectsIn(block.body).map((object) => ({ object, startLine: block.startLine })),
      )
      .filter(({ object }) => 'auth_time' in object);

    if (payloads.length === 0) {
      throw new Error(
        'the protocol pages no longer show a decoded ID token payload — ' +
          'no JSON object in it carries auth_time. It moved, or the transcript ' +
          'this check reads was replaced with something else.',
      );
    }

    for (const { object, startLine } of payloads) {
      expect(object, `${at(document, startLine)} decodes an ID token with no acr`).toHaveProperty(
        'acr',
      );
      expect(
        object,
        `${at(document, startLine)} decodes an ID token with no amr — ` +
          'every login this document walks through used a real authenticator, ' +
          'so amr should never be empty here',
      ).toHaveProperty('amr');
    }
  });
});
