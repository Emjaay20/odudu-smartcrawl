import type { SubmitEvent } from 'react';
import { AreaGate, areaAt } from '#/features/shell';
import { copyingText, scopesTrail } from '#/features/scopes/service';
import { useNewScope, type Copying } from '#/features/scopes/usecase/useNewScope.ts';
import { Button } from '#/shared/view/Button';
import { ButtonLink } from '#/shared/view/ButtonLink';
import { TextAreaField, TextField } from '#/shared/view/Field';
import { PageHeader } from '#/shared/view/PageHeader';
import styles from '#/features/scopes/view/NewScopePage/NewScopePage.module.css';

function CopyNote({ copying }: { copying: Copying }) {
  switch (copying.status) {
    case 'none':
      return null;
    case 'loading':
      return <p className={styles.rule}>Reading the scope to copy…</p>;
    case 'failed':
      return (
        <p className={styles.error}>
          The scope to copy could not be read, so this makes a new scope with nothing mapped or
          bound.
        </p>
      );
    case 'ready':
      return (
        <div className={styles.rule}>
          <span className={styles.place}>{copyingText(copying)}</span> Its token flags, consent text
          and default assignment come along. Roles and mappers are added after the copy is made, so
          a refusal of one leaves the rest in place. The clients that carry it are not copied.
          {copying.left.length === 0 ? null : (
            <>
              {' '}
              Not copied, since you could not give it:
              <ul aria-label="Not copied" className={styles.left}>
                {copying.left.map((each) => (
                  <li key={each.name}>
                    <code>{each.name}</code> · {each.why}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      );
  }
}

function Form({ tenant }: { tenant: string }) {
  const page = useNewScope(tenant);
  const submit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    page.submit();
  };
  return (
    <form noValidate onSubmit={submit} className={styles.form}>
      <CopyNote copying={page.copying} />
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
        {page.partial !== null ? (
          <ButtonLink href={page.partial.href} variant="primary">
            {`Open ${page.partial.name}`}
          </ButtonLink>
        ) : page.unconfirmed ? (
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
        {page.partial?.text ?? page.message}
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
