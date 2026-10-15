-- The admin API lists a tenant's mail by status, most recent first. A status
-- the rows rarely hold (a queued message among a million sent ones, or a
-- sent one in a queue a down relay has filled) was found by walking every
-- newer row of the tenant through email_outbox_recent. Each state has its
-- own index ending in the listing's order, so a page stops at its LIMIT.
CREATE INDEX email_outbox_unsent_recent ON email_outbox (tenant_id, created_at, id)
  WHERE sent_at IS NULL;
CREATE INDEX email_outbox_sent_recent ON email_outbox (tenant_id, created_at, id)
  WHERE sent_at IS NOT NULL;
