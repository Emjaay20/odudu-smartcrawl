import type { AuditEvent } from '@odudu/contracts/admin';

export function auditEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: 'a1',
    occurred_at: '2026-09-28T13:41:05Z',
    event_type: 'admin_mutation',
    action: 'client.update',
    outcome: 'allowed',
    actor_tenant_id: 't1',
    actor_subject_id: '0192f7a4-5c1e-7b3a-9d2e-6f8a1b2c3d4e',
    actor_client_id: null,
    actor_name: null,
    actor_origin: 'tenant',
    resource_type: 'client',
    resource_id: 'c1',
    request_id: 'req-7f3a9c',
    ip: '203.0.113.9',
    detail: {},
    ...overrides,
  };
}
