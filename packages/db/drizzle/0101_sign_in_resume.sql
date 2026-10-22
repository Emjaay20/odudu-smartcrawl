-- A mailed link that came out of a sign-in names that sign-in, so a browser
-- that still holds it can be sent back to the original request. The row of
-- the sign-in keeps the hash of the secret the browser was handed when the
-- request was parked; the token keeps which sign-in it came out of. Neither
-- is a foreign key: the sign-in's row is reaped long before the token's, and
-- a reference to a row that is gone reads as "nothing to resume".
ALTER TABLE authentication_sessions ADD COLUMN browser_secret_hash text;
ALTER TABLE action_tokens ADD COLUMN authentication_session_id uuid;
