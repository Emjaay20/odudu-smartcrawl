import { loadConfig, OduduError } from '@odudu/kernel';
import { describe, expect, it } from 'vitest';
import {
  assertConsoleConfigured,
  assertProductionAppDatabaseUrl,
  assertProductionTls,
} from '#/config-guard';

const BASE = {
  ODUDU_DATABASE_URL: 'postgres://u:p@localhost:5432/odudu',
  ODUDU_KEK: Buffer.alloc(32, 7).toString('base64'),
};

// The configuration reference says when each of these is required. Each
// claim is held here to the guard that enforces it.
describe('the conditions the configuration reference gives for a required variable', () => {
  it('requires the public base URL and the console key while the console is on', () => {
    expect(() => {
      assertConsoleConfigured(loadConfig(BASE));
    }).toThrow(/ODUDU_PUBLIC_BASE_URL/u);
    expect(() => {
      assertConsoleConfigured(
        loadConfig({ ...BASE, ODUDU_PUBLIC_BASE_URL: 'http://localhost:3000' }),
      );
    }).toThrow(/ODUDU_CONSOLE_CLIENT_KEY/u);
    expect(() => {
      assertConsoleConfigured(loadConfig({ ...BASE, ODUDU_CONSOLE: 'false' }));
    }).not.toThrow();
  });

  it('requires the service database URL and TLS in production', () => {
    const production = loadConfig({ ...BASE, NODE_ENV: 'production' });
    expect(() => {
      assertProductionAppDatabaseUrl(production);
    }).toThrow(OduduError);
    expect(() => {
      assertProductionTls(production);
    }).toThrow(/ODUDU_TLS/u);
    expect(() => {
      assertProductionAppDatabaseUrl(loadConfig(BASE));
    }).not.toThrow();
  });

  it('requires a sender when an SMTP host is set', () => {
    expect(() => loadConfig({ ...BASE, ODUDU_SMTP_HOST: 'smtp.example' })).toThrow(
      /ODUDU_SMTP_FROM/u,
    );
  });
});
