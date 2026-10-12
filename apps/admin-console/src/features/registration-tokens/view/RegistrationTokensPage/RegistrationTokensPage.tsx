import type { RegistrationToken } from '@odudu/contracts/admin';
import { useEffect, useId, useRef, type SubmitEvent } from 'react';
import { AreaGate, areaAt } from '#/features/shell';
import { NOTHING_YET, NOUN, TITLE, TOKENS_RULE } from '#/features/registration-tokens/service';
import {
  useRegistrationTokensPage,
  type RegistrationTokensPage as Page,
} from '#/features/registration-tokens/usecase/useRegistrationTokensPage';
import { Button } from '#/shared/view/Button';
import { ConfirmDialog } from '#/shared/view/ConfirmDialog';
import type { Column } from '#/shared/view/DataTable';
import { NumberWithUnitField } from '#/shared/view/Field';
import { FieldGrid, GridCell } from '#/shared/view/FieldGrid';
import { ResourceListPage } from '#/shared/view/ResourceListPage';
import { SecretDialog } from '#/shared/view/SecretDialog';
import { Timestamp } from '#/shared/view/Timestamp';
import styles from '#/features/registration-tokens/view/RegistrationTokensPage/RegistrationTokensPage.module.css';

function columns(page: Page): readonly Column<RegistrationToken>[] {
  return [
    {
      id: 'id',
      header: 'Token',
      isRowHeader: true,
      cell: (token) => <code className={styles.id}>{token.id}</code>,
    },
    { id: 'remaining_uses', header: 'Uses left', cell: (token) => token.remaining_uses },
    {
      id: 'created_at',
      header: 'Minted',
      secondary: true,
      cell: (token) => <Timestamp value={token.created_at} />,
    },
    {
      id: 'expires_at',
      header: 'Expires',
      cell: (token) => <Timestamp value={token.expires_at} />,
    },
    {
      id: 'revoke',
      header: 'Revoke',
      cell: (token) => (
        <Button
          size="small"
          variant="quiet"
          aria-label={`Revoke ${token.id}`}
          onPress={() => {
            page.ask(token);
          }}
        >
          Revoke
        </Button>
      ),
    },
  ];
}

function Mint({ page }: { page: Page }) {
  const heading = useId();
  const submit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    page.mint();
  };
  return (
    <section aria-labelledby={heading} className={styles.mint}>
      <h2 id={heading} className={styles.heading}>
        Mint a registration token
      </h2>
      <p className={styles.rule}>{TOKENS_RULE}</p>
      <form noValidate onSubmit={submit} className={styles.mint}>
        <FieldGrid>
          <GridCell>
            <NumberWithUnitField
              label="Uses"
              description="How many clients may register with it."
              unit="uses"
              value={page.uses}
              error={page.errors.uses}
              onChange={page.editUses}
            />
          </GridCell>
          <GridCell>
            <NumberWithUnitField
              label="Lifetime"
              description="How long it stays live."
              unit="seconds"
              value={page.lifetime}
              error={page.errors.ttl_seconds}
              onChange={page.editLifetime}
            />
          </GridCell>
        </FieldGrid>
        <div className={styles.actions}>
          <Button type="submit" variant="primary" isDisabled={page.minting}>
            {page.minting ? 'Minting…' : 'Mint token'}
          </Button>
        </div>
        <p role="status" aria-label="Last mint" className={styles.message}>
          {page.message}
        </p>
      </form>
    </section>
  );
}

function List({ tenant }: { tenant: string }) {
  const page = useRegistrationTokensPage(tenant);
  const notice = useRef<HTMLParagraphElement>(null);
  // The revoked row took the focus with it, so the line saying so holds it
  // once the dialog that held it is gone.
  useEffect(() => {
    if (page.revoked > 0) notice.current?.focus();
  }, [page.revoked]);
  return (
    <>
      <ResourceListPage
        list={page.list}
        kicker={tenant}
        title={TITLE}
        description="Initial access tokens for dynamic client registration."
        lead={<Mint page={page} />}
        noun={NOUN}
        columns={columns(page)}
        rowKey={(token) => token.id}
        capability="manage-clients"
        nothingYet={NOTHING_YET}
        notice={
          <p
            ref={notice}
            tabIndex={-1}
            role="status"
            aria-label="Last revoke"
            className={styles.notice}
          >
            {page.notice}
          </p>
        }
      />
      <SecretDialog
        secret={page.secret}
        title="New registration token"
        label="registration token"
        onClose={page.closeSecret}
      >
        A client presents it to register itself.
      </SecretDialog>
      <ConfirmDialog
        isOpen={page.revoking !== null}
        title="Revoke this token?"
        consequence={page.consequence}
        confirmLabel="Revoke token"
        tone="danger"
        busy={page.revokeBusy}
        problem={page.revokeProblem}
        onConfirm={() => {
          page.confirm().catch(() => undefined);
        }}
        onCancel={page.cancel}
      />
    </>
  );
}

export function RegistrationTokensPage({ tenant }: { tenant: string }) {
  return (
    <AreaGate tenant={tenant} area={areaAt('registration-tokens')} title={TITLE}>
      <List tenant={tenant} />
    </AreaGate>
  );
}
