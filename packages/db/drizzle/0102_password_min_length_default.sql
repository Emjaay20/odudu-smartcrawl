-- NIST SP 800-63B-4 asks fifteen characters of a password used alone. A new
-- tenant starts there; a tenant that exists keeps the length it has, and the
-- bounds of 0035 (8 to 256) are unchanged, so a tenant that asks a second
-- factor of every sign-in can still choose eight.
ALTER TABLE tenants ALTER COLUMN password_min_length SET DEFAULT 15;
