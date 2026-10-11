import type { SubmitEvent } from 'react';
import { AreaGate, areaAt } from '#/features/shell';
import { scopesTrail } from '#/features/scopes/service';
import { useNewScope } from '#/features/scopes/usecase/useNewScope.ts';
import { Button } from '#/shared/view/Button';
import { ButtonLink } from '#/shared/view/ButtonLink';
import { TextAreaField, TextField } from '#/shared/view/Field';
import { PageHeader } from '#/shared/view/PageHeader';
import styles from '#/features/scopes/view/NewScopePage/NewScopePage.module.css';

function Form({ tenant }: { tenant: string }) {
  const page = useNewScope(tenant);
  const submit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    page.submit();
  };
  return (
    <form noValidate onSubmit={submit} className={styles.form}>
      <TextField
        label="Name"
        description="Fixed once the scope is made: a client asks for it by this name and a token carries it. Unique in the tenant."
        value={page.name}
        error={page.errors.name}
        onChange={page.editName}
        mono
        autoFocus
      />
      <TextAreaField
        label="Description"
        description={page.descriptionRule}
        value={page.description}
        error={page.errors.description}
        onChange={page.editDescription}
      />
      <div className={styles.actions}>
        {page.unconfirmed ? (
          <Button variant="primary" isDisabled={page.busy} onPress={page.check}>
            {`Look for ${page.name}`}
          </Button>
        ) : (
          <Button type="submit" variant="primary" isDisabled={page.busy}>
            {page.busy ? 'Creating…' : 'Create scope'}
          </Button>
        )}
        <ButtonLink href={page.listHref}>Cancel</ButtonLink>
      </div>
      <p role="status" className={styles.message}>
        {page.message}
      </p>
    </form>
  );
}

export function NewScopePage({ tenant }: { tenant: string }) {
  const trail = scopesTrail(tenant, 'Create a scope');
  return (
    <AreaGate tenant={tenant} area={areaAt('scopes')} title="Create a scope" breadcrumb={trail}>
      <PageHeader
        breadcrumb={trail}
        title="Create a scope"
        description="Its token flags, consent text and roles are set on its page once it is made."
      />
      <Form tenant={tenant} />
    </AreaGate>
  );
}
