import { describe, expect, it } from 'vitest';
import { stampCompose } from '#/stamp';

const COMPOSE = [
  'services:',
  '  setup:',
  '    image: ${ODUDU_IMAGE:-ghcr.io/wizzywit/odudu:0.0.0}',
  "    command: ['odudu', 'init']",
  '  odudu:',
  '    image: ${ODUDU_IMAGE:-ghcr.io/wizzywit/odudu:0.0.0}',
  '  postgres:',
  '    image: postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24',
  '',
].join('\n');

describe('stampCompose', () => {
  it('puts the release into both services that run the image, and nothing else', () => {
    const stamped = stampCompose(COMPOSE, '1.2.3');
    const before = COMPOSE.split('\n');
    const after = stamped.split('\n');
    expect(after).toHaveLength(before.length);
    const changed = after.filter((line, index) => line !== before[index]);
    expect(changed).toEqual([
      '    image: ${ODUDU_IMAGE:-ghcr.io/wizzywit/odudu:1.2.3}',
      '    image: ${ODUDU_IMAGE:-ghcr.io/wizzywit/odudu:1.2.3}',
    ]);
    expect(stamped).not.toContain('odudu:0.0.0');
  });

  it('keeps a candidate tag whole', () => {
    expect(stampCompose(COMPOSE, '0.1.0-rc.2')).toContain('odudu:0.1.0-rc.2}');
  });

  it('refuses a file with no placeholder, so a release never ships an unstamped one', () => {
    expect(() => stampCompose('services: {}\n', '1.0.0')).toThrow(/placeholder/u);
    expect(() => stampCompose(stampCompose(COMPOSE, '1.0.0'), '1.0.1')).toThrow(/placeholder/u);
  });

  it('refuses a version that is not one, which would write anything into the file', () => {
    expect(() => stampCompose(COMPOSE, '1.0.0}\n  evil: x')).toThrow(/version/u);
    expect(() => stampCompose(COMPOSE, 'latest')).toThrow(/version/u);
  });
});
