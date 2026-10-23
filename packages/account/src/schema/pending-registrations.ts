import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from '@odudu/db';

// Policy in packages/db/drizzle/0104_pending_registrations.sql, as for every
// tenant-scoped table.
export const pendingRegistrations = pgTable('pending_registrations', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  username: text('username').notNull(),
  email: text('email').notNull(),
  emailSearch: text('email_search')
    .notNull()
    .generatedAlwaysAs(sql`lower(email)`),
  passwordHash: text('password_hash').notNull(),
  authenticationSessionId: uuid('authentication_session_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}).enableRLS();
