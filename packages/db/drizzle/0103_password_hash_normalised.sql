-- Whether a password's hash was made from its NFC form. Null is a hash made
-- before passwords were normalised, which a sign-in may also try against the
-- password as typed; true is every hash written since, which it may not. No
-- rewrite: a row becomes true when its owner next signs in.
ALTER TABLE user_credentials ADD COLUMN hash_nfc boolean;
