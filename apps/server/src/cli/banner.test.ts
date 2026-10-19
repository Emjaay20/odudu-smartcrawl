import { describe, expect, it } from 'vitest';
import { renderBanner } from '#/cli/banner';

const generated = {
  consoleUrl: 'http://localhost:3000/console/',
  adminEmail: 'ada@example.com',
  generatedPassword: 'Zq3-very-secret-7Lk',
  created: true,
};

describe('renderBanner', () => {
  it('shows the console, the email, the password once and how to remove it', () => {
    const banner = renderBanner(generated);
    const lines = banner.split('\n');

    expect(banner).toContain('http://localhost:3000/console/');
    expect(banner).toContain('ada@example.com');
    expect(lines.filter((line) => line.startsWith(' password: '))).toEqual([
      ' password: Zq3-very-secret-7Lk',
    ]);
    expect(banner.split(generated.generatedPassword)).toHaveLength(2);
    expect(banner).toContain('shown once');
    expect(banner).toContain('docker compose rm -f setup');
  });

  it('prints no password for a chosen one', () => {
    const chosen = {
      consoleUrl: generated.consoleUrl,
      adminEmail: generated.adminEmail,
      created: true,
    };

    const banner = renderBanner(chosen);

    expect(banner).not.toContain('password:');
    expect(banner).not.toContain('docker compose rm');
    expect(banner).toContain('ada@example.com');
  });

  it('keeps every line within 72 columns', () => {
    for (const report of [generated, { ...generated, generatedPassword: 'x'.repeat(40) }]) {
      for (const line of renderBanner(report).split('\n')) {
        expect(line.length, line).toBeLessThanOrEqual(72);
      }
    }
  });
});
