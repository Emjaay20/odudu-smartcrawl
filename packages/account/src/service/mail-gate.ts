// Whether a mail may be queued for an address now. The composition root backs
// it with a bounded in-process limiter (apps/server/src/mail-limiter.ts). It
// decides only whether the mail is queued: the response a person gets never
// depends on it.
export type MailGate = (tenantId: string, address: string) => boolean;
