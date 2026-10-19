import { createDatabase } from '@odudu/db';
import { consoleBaseUrl, loadConfig, ModuleRegistry, systemClock } from '@odudu/kernel';
import closeWithGrace from 'close-with-grace';
import { buildApp } from '#/app';
import {
  assertConsoleConfigured,
  assertProductionAppDatabaseUrl,
  assertProductionKekNotExample,
  assertProductionNoPrivateClientUrls,
  assertProductionPasskeyRelyingParty,
  assertProductionTls,
  warnIfConsoleCookieFallback,
  warnIfTlsDisabled,
} from '#/config-guard';
import { buildEmailSender, resolveSender, smtpDestinationPolicyFor } from '#/email';
import { loadConsoleKeys } from '#/console-key';
import { createLogger } from '#/logger';
import { createLogoutDeliveryTransport } from '#/logout-delivery-transport';
import { throttleSettingsFrom } from '#/throttle-settings';
import { databaseModule } from '#/modules/database';
import { httpModule } from '#/modules/http';
import { logoutSenderModule } from '#/modules/logout-sender';
import { outboxModule } from '#/modules/outbox';
import { reapModule } from '#/modules/reap';

const config = loadConfig();
const logger = createLogger(config);

assertProductionAppDatabaseUrl(config);
assertProductionKekNotExample(config);
assertProductionTls(config);
assertProductionPasskeyRelyingParty(config);
assertProductionNoPrivateClientUrls(config);
assertConsoleConfigured(config);
const consoleKeys = await loadConsoleKeys(config);
warnIfTlsDisabled(config, (message) => {
  logger.warn({}, message);
});
warnIfConsoleCookieFallback(config, (message) => {
  logger.warn({}, message);
});

const owner = createDatabase(config.ODUDU_DATABASE_URL);
const runtime = config.ODUDU_APP_DATABASE_URL
  ? createDatabase(config.ODUDU_APP_DATABASE_URL)
  : owner;

if (runtime === owner) {
  logger.warn(
    {},
    'ODUDU_APP_DATABASE_URL is unset; serving as the owner role, which can switch ' +
      'row-level security off and escapes it outright where that role is a superuser',
  );
}

const emailFallback = buildEmailSender(config, logger);

const app = buildApp({
  database: runtime,
  ownerDatabase: owner,
  kek: config.ODUDU_KEK,
  logger,
  ...(config.ODUDU_PUBLIC_BASE_URL !== undefined
    ? { publicBaseUrl: config.ODUDU_PUBLIC_BASE_URL }
    : {}),
  consoleBaseUrl: consoleBaseUrl(config),
  consoleKeys,
  consoleDir: config.ODUDU_CONSOLE_DIR,
  instrumentDir: config.ODUDU_INSTRUMENT_DIR,
  trustProxy: config.ODUDU_TRUST_PROXY,
  tlsClientCertHeader: config.ODUDU_TLS_CLIENT_CERT_HEADER,
  ...throttleSettingsFrom(config),
  allowPrivateClientUrls: config.ODUDU_ALLOW_PRIVATE_CLIENT_URLS,
  allowPrivateSmtpHosts: config.ODUDU_ALLOW_PRIVATE_SMTP_HOSTS,
  deploymentSmtp: emailFallback.kind === 'smtp',
  outboxMaxAttempts: config.ODUDU_OUTBOX_MAX_ATTEMPTS,
});

const smtpDestination = smtpDestinationPolicyFor(config);

const registry = new ModuleRegistry()
  .register(databaseModule(owner, runtime))
  .register(reapModule({ database: runtime, ownerDatabase: owner }))
  .register(
    outboxModule({
      database: runtime,
      ownerDatabase: owner,
      resolveSender: (tenantId) =>
        resolveSender(
          {
            database: runtime.db,
            kek: config.ODUDU_KEK,
            fallback: emailFallback,
            smtpDestination,
          },
          tenantId,
        ),
    }),
  )
  .register(
    logoutSenderModule({
      database: runtime,
      ownerDatabase: owner,
      transport: createLogoutDeliveryTransport({
        allowPrivate: config.ODUDU_ALLOW_PRIVATE_CLIENT_URLS,
      }),
    }),
  )
  .register(httpModule(app));

closeWithGrace({ delay: 10_000 }, async ({ err }) => {
  if (err) logger.error({ err }, 'shutting down after an unhandled error');
  await registry.stop();
});

await registry.start({ config, clock: systemClock, logger });
logger.info({ port: config.ODUDU_HTTP_PORT }, 'odudu is listening');
