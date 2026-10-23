-- A registration waiting for its mailed link, when a tenant verifies email
-- addresses: the account is created when the link is used, so a request for
-- an address that already has an account and one for a free address leave
-- the same trace and a username is held by neither. The password is kept as
-- the hash made on the spot. One row per address a tenant has been asked to
-- register (a repeat replaces it), found by the digest of the link's key, and
-- reaped by `odudu reap` once expired.
CREATE TABLE pending_registrations (
  id                        uuid PRIMARY KEY,
  tenant_id                 uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  token_hash                text NOT NULL,
  username                  text NOT NULL,
  email                     text NOT NULL,
  email_search              text COLLATE "C" NOT NULL GENERATED ALWAYS AS (lower(email)) STORED,
  password_hash             text NOT NULL,
  -- The sign-in the person registered from, as on action_tokens: never in the link.
  authentication_session_id uuid,
  created_at                timestamptz NOT NULL DEFAULT now(),
  expires_at                timestamptz NOT NULL,
  CONSTRAINT pending_registrations_hash_unique UNIQUE (token_hash),
  CONSTRAINT pending_registrations_address_unique UNIQUE (tenant_id, email_search)
);

CREATE INDEX pending_registrations_by_expiry ON pending_registrations (tenant_id, expires_at);

ALTER TABLE pending_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_registrations FORCE ROW LEVEL SECURITY;
CREATE POLICY pending_registrations_isolation ON pending_registrations
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
