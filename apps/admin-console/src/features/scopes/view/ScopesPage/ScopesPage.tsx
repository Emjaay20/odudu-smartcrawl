import type { ClientScope } from '@odudu/contracts/admin';
import { AreaGate, areaAt } from '#/features/shell';
import { useScopesList } from '#/features/scopes/usecase/useScopesList';
import { RestoreScopes } from '#/features/scopes/view/ScopesPage/RestoreScopes';
import { ButtonLink } from '#/shared/view/ButtonLink';
import type { Column } from '#/shared/view/DataTable';
import { ResourceListPage } from '#/shared/view/ResourceListPage';
import { Timestamp } from '#/shared/view/Timestamp';
import styles from '#/features/scopes/view/ScopesPage/ScopesPage.module.css';
import { NAME_SEARCH } from '#/shared/service/filters';

const COLUMNS: readonly Column<ClientScope>[] = [
  {
    id: 'name',
    header: 'Scope',
    isRowHeader: true,
    cell: (scope) => <code className={styles.name}>{scope.name}</code>,
  },
  { id: 'description', header: 'Description', cell: (scope) => scope.description ?? '—' },
  {
    id: 'created_at',
    header: 'Created',
    secondary: true,
    cell: (scope) => <Timestamp value={scope.created_at} />,
  },
];

function List({ tenant }: { tenant: string }) {
  const page = useScopesList(tenant);
  return (
    <ResourceListPage
      list={page.list}
      kicker={tenant}
      title="Scopes"
      description="A scope is what a client asks to be let do, and what a token says it was granted. A search matches the start of a name."
      actions={
        <>
          <RestoreScopes tenant={tenant} />
          <ButtonLink href={page.createHref} variant="primary">
            Create a scope
          </ButtonLink>
        </>
      }
      noun={{ one: 'scope', other: 'scopes' }}
      searchFields={NAME_SEARCH}
      columns={COLUMNS}
      rowKey={(scope) => scope.id}
      onRowAction={page.open}
      capability="manage-tenant"
      nothingYet="A scope names something a client may be let do, such as reading invoices."
    />
  );
}

export function ScopesPage({ tenant }: { tenant: string }) {
  return (
    <AreaGate tenant={tenant} area={areaAt('scopes')} title="Scopes">
      <List tenant={tenant} />
    </AreaGate>
  );
}
