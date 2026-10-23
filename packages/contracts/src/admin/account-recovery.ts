import { z } from 'zod';
import { booleanFlagSchema, dateTimeSchema } from '#/admin/shared';

// The only place an issued password is ever written down: never stored in
// the clear, never logged, never in an audit row.
export const issuePasswordResponseSchema = z.object({
  password: z.string(),
});
export type IssuePasswordResponse = z.infer<typeof issuePasswordResponseSchema>;

// The run of failed sign-ins on record. `locked` is judged by the server's
// clock, so a caller never compares `locked_until` against its own. A
// subject that has never failed answers a zero count and nulls.
export const lockoutSchema = z.object({
  locked: z.boolean(),
  locked_until: dateTimeSchema.nullable(),
  failure_count: z.number().int(),
  last_failure_at: dateTimeSchema.nullable(),
});
export type Lockout = z.infer<typeof lockoutSchema>;

// `require_new_set` defaults to true: revoking a set while a second factor
// remains leaves the subject with no way back unless one is asked of them.
export const revokeRecoveryCodesQuerySchema = z
  .object({ require_new_set: booleanFlagSchema.optional() })
  .strict();
export type RevokeRecoveryCodesQuery = z.infer<typeof revokeRecoveryCodesQuerySchema>;

// `end_sessions` defaults to false: whether the factor was lost or stolen is
// something only the operator knows, so nothing ends unless asked.
export const removeCredentialQuerySchema = z
  .object({ end_sessions: booleanFlagSchema.optional() })
  .strict();
export type RemoveCredentialQuery = z.infer<typeof removeCredentialQuerySchema>;

/** The `403` detail of an `end_sessions` request from a caller without `manage-sessions`. */
export const END_SESSIONS_NEEDS_MANAGE_SESSIONS = 'end_sessions needs manage-sessions';
