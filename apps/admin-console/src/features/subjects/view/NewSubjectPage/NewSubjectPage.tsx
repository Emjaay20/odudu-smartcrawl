import { subjectsTrail } from '#/features/subjects/service';
import { useNewSubject } from '#/features/subjects/usecase/useNewSubject';
import { SubjectsGate } from '#/features/subjects/view/SubjectsGate';
import { CapabilityNote } from '#/shared/view/CapabilityNote';
import { CreationActions, CreationForm } from '#/shared/view/CreationForm';
import { TextField } from '#/shared/view/Field';
import { PageHeader } from '#/shared/view/PageHeader';

function Form({ tenant }: { tenant: string }) {
  const page = useNewSubject(tenant);
  if (page.refused !== null) {
    return <CapabilityNote capability={page.refused}>Creating a subject</CapabilityNote>;
  }
  return (
    <CreationForm submit={page.submit}>
      <TextField
        label="Username"
        description={page.rule}
        value={page.username}
        error={page.usernameError}
        onChange={page.editUsername}
        autoComplete="username"
        mono
        autoFocus
      />
      <TextField
        label="Email"
        description="Optional. Unverified until the subject proves it or you mark it verified on the Profile tab."
        type="email"
        value={page.email}
        error={page.emailError}
        autoComplete="email"
        onChange={page.editEmail}
      />
      <CreationActions
        noun="subject"
        lookFor={page.username}
        busy={page.busy}
        unconfirmed={page.unconfirmed}
        onCheck={page.check}
        listHref={page.listHref}
        message={page.message}
      />
    </CreationForm>
  );
}

export function NewSubjectPage({ tenant }: { tenant: string }) {
  return (
    <SubjectsGate
      tenant={tenant}
      title="Create a subject"
      breadcrumb={subjectsTrail(tenant, 'Create a subject')}
    >
      <PageHeader
        breadcrumb={subjectsTrail(tenant, 'Create a subject')}
        title="Create a subject"
        description="A subject created here has no password: it owes a password change, and you issue it a one-time password from its Credentials tab."
      />
      <Form tenant={tenant} />
    </SubjectsGate>
  );
}
