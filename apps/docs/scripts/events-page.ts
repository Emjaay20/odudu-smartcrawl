import { AUDIT_ACTIONS, AUDIT_EVENT_TYPES, type VocabularyEventType } from '@odudu/domain-audit';
import {
  ADMIN_MUTATION_ACTION_DOCS,
  AUDIT_ACTION_DOCS,
  AUDIT_EVENT_TYPE_DOCS,
  AUDIT_OUTCOME_DOCS,
  AUDIT_REASON_DOCS,
} from '@odudu/domain-audit/docs';
import { cell, codeCell, page, table } from './markdown.ts';

function actionRows(type: VocabularyEventType): string[][] {
  return AUDIT_ACTIONS[type].map((action) => [codeCell(action), cell(AUDIT_ACTION_DOCS[action])]);
}

function isVocabulary(type: string): type is VocabularyEventType {
  return type in AUDIT_ACTIONS;
}

export function renderEventsPage(): string {
  const types = AUDIT_EVENT_TYPES.map((type) => [
    codeCell(type),
    cell(AUDIT_EVENT_TYPE_DOCS[type]),
  ]);
  const typed = AUDIT_EVENT_TYPES.filter(isVocabulary).flatMap((type) => [
    `### ${type}`,
    table(['Action', 'Meaning'], actionRows(type)),
  ]);
  const mutations = Object.entries(ADMIN_MUTATION_ACTION_DOCS)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([action, summary]) => [codeCell(action), cell(summary)]);
  const body = [
    'Odudu records what happens to a tenant as audit events. Each event has an `event_type`, an ' +
      '`action`, an `outcome`, who did it and to what, the request’s `request_id` and `ip`, ' +
      'and a `detail` object that never holds a secret. Read them with `GET /admin/tenants/{tenant}/audit` ' +
      '(see the [audit operations](./admin-api/audit.md)); a tenant’s `audit_event_types` ' +
      'setting chooses which types it stores.',
    '## Event types',
    table(['Event type', 'What it records'], types),
    '## Actions by event type',
    'These types have a fixed vocabulary of actions.',
    ...typed,
    '## Admin mutations',
    'The `admin_mutation` type has one action for each write the admin API makes, named ' +
      '`<resource>.<verb>`.',
    table(['Action', 'Meaning'], mutations),
    '## Outcomes',
    table(
      ['Outcome', 'Meaning'],
      Object.entries(AUDIT_OUTCOME_DOCS).map(([outcome, summary]) => [
        codeCell(outcome),
        cell(summary),
      ]),
    ),
    '## Reasons',
    'A refused or failed event may carry a `reason` in its `detail`.',
    table(
      ['Reason', 'Meaning'],
      Object.entries(AUDIT_REASON_DOCS).map(([reason, summary]) => [
        codeCell(reason),
        cell(summary),
      ]),
    ),
  ].join('\n\n');
  return page(
    'Audit events',
    'The audit trail vocabulary: every event type, action, outcome and reason Odudu records, and what each means.',
    body,
  );
}
