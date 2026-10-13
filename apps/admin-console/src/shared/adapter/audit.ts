import { listAuditResponseSchema } from '@odudu/contracts/admin';
import { listReader } from '#/shared/adapter/route';

// Shared by the Audit trail and every record's Activity tab, which is the
// same list narrowed to one resource.
export const readAuditPage = listReader('audit', listAuditResponseSchema);
