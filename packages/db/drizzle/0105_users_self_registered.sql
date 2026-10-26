-- Whether the account was made by its own registration form. A reset of one
-- whose address was never verified clears the factors a stranger may have
-- enrolled; an account an administrator or the seed command made is not
-- touched. A constant default, so no table rewrite.
ALTER TABLE users ADD COLUMN self_registered boolean NOT NULL DEFAULT false;
