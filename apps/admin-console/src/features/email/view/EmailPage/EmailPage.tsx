import type { SmtpConfig } from '@odudu/contracts/admin';
import { useId } from 'react';
import { AreaGate, areaAt } from '#/features/shell';
import { useEmailPage } from '#/features/email/usecase/useEmailPage';
import {
  effectiveLabel,
  effectiveReading,
  effectiveTone,
  PORT_RULE,
  RELAY_LABELS,
  removeConsequence,
} from '#/features/email/service';
import {
  RELAY_TITLE,
  useRelaySection,
  type RelaySection,
} from '#/features/email/usecase/useRelaySection';
import { useRelayRemoval } from '#/features/email/usecase/useRelayRemoval';
import { useTestSend } from '#/features/email/usecase/useTestSend';
import { Button } from '#/shared/view/Button';
import { ConfirmDialog } from '#/shared/view/ConfirmDialog';
import { EmptyState } from '#/shared/view/EmptyState';
import { TextField, ToggleField } from '#/shared/view/Field';
import { FieldGrid, GridCell } from '#/shared/view/FieldGrid';
import { PageHeader } from '#/shared/view/PageHeader';
import { Section } from '#/shared/view/Section';
import { SectionNoticeOf } from '#/shared/view/SectionNoticeOf';
import { FormSkeleton } from '#/shared/view/Skeleton';
import { StatusTag } from '#/shared/view/StatusTag';
import styles from '#/features/email/view/EmailPage/EmailPage.module.css';

const TITLE = 'Email';

function RelayForm({ relay, config }: { relay: RelaySection; config: SmtpConfig }) {
  const s = relay.save;
  const field = (name: 'host' | 'port' | 'from_address' | 'username') => ({
    value: s.values[name],
    error: s.fieldErrors[name],
    changed: s.changed.includes(name),
    onChange: (value: string) => {
      s.edit(name, value);
    },
  });
  return (
    <Section
      title={RELAY_TITLE}
      description="The server this tenant's verification and reset mail is sent through. Saving replaces the whole relay."
      dirty={s.dirty}
      saving={s.saving}
      onSave={s.submit}
      onDiscard={s.discard}
      restored={s.restored}
      blocked={relay.blocked}
      notice={<SectionNoticeOf title={RELAY_TITLE} save={s} />}
    >
      <FieldGrid>
        <GridCell span="wide">
          <TextField label={RELAY_LABELS.host} mono {...field('host')} />
        </GridCell>
        <GridCell>
          <TextField
            label={RELAY_LABELS.port}
            mono
            inputMode="numeric"
            description={PORT_RULE}
            {...field('port')}
          />
        </GridCell>
        <GridCell span="wide">
          <TextField
            label={RELAY_LABELS.from_address}
            description="What the From line of each message says."
            {...field('from_address')}
          />
        </GridCell>
        <GridCell>
          <TextField
            label={RELAY_LABELS.username}
            description="Leave it empty if the relay needs no login."
            {...field('username')}
          />
        </GridCell>
        <GridCell span="wide">
          <TextField
            label={RELAY_LABELS.password}
            type="password"
            description={relay.passwordNote}
            isDisabled={s.values.remove_password}
            value={s.values.password}
            error={s.fieldErrors.password}
            changed={s.changed.includes('password')}
            onChange={(value) => {
              s.edit('password', value);
            }}
          />
        </GridCell>
        {config.password_set ? (
          <GridCell>
            <ToggleField
              label={RELAY_LABELS.remove_password}
              value={s.values.remove_password}
              changed={s.changed.includes('remove_password')}
              onChange={relay.removePassword}
            />
          </GridCell>
        ) : null}
        <GridCell span="wide">
          <ToggleField
            label={RELAY_LABELS.starttls}
            description="Required while a username or password is set, so they are not sent in the clear."
            value={s.values.starttls}
            error={s.fieldErrors.starttls}
            changed={s.changed.includes('starttls')}
            onChange={(value) => {
              s.edit('starttls', value);
            }}
          />
        </GridCell>
      </FieldGrid>
    </Section>
  );
}

function TestMessage({
  tenant,
  configured,
  unsaved,
}: {
  tenant: string;
  configured: boolean;
  unsaved: boolean;
}) {
  const test = useTestSend(tenant, configured);
  const heading = useId();
  return (
    <section aria-labelledby={heading} className={styles.panel}>
      <h2 id={heading} className={styles.heading}>
        Test message
      </h2>
      <p className={styles.rule}>
        Sends one message through the saved relay and tells what the server answered.
        {unsaved ? ' The test uses the saved relay, not the changes above.' : ''}
      </p>
      <form
        className={styles.test}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          test.send();
        }}
      >
        <TextField label="Send to" type="email" value={test.to} onChange={test.setTo} />
        <Button type="submit" isDisabled={test.busy || test.blocked !== undefined}>
          {test.busy ? 'Sending…' : 'Send test message'}
        </Button>
      </form>
      {test.blocked === undefined ? null : <p className={styles.rule}>{test.blocked}</p>}
      <p role="status" className={styles.outcome} data-tone={test.outcome?.tone}>
        {test.outcome?.text}
      </p>
    </section>
  );
}

function Removal({ tenant, reread }: { tenant: string; reread: () => void }) {
  const removal = useRelayRemoval(tenant, reread);
  const heading = useId();
  return (
    <section aria-labelledby={heading} className={styles.panel}>
      <h2 id={heading} className={styles.heading}>
        Remove the relay
      </h2>
      <p className={styles.rule}>Goes back to the deployment’s sender, if it has one.</p>
      <div className={styles.actions}>
        <Button variant="danger" onPress={removal.ask}>
          Remove the relay
        </Button>
      </div>
      <p role="status" className={styles.outcome}>
        {removal.message}
      </p>
      <ConfirmDialog
        isOpen={removal.confirming}
        title="Remove this tenant’s relay?"
        consequence={removeConsequence()}
        confirmLabel="Remove the relay"
        tone="danger"
        busy={removal.busy}
        onConfirm={removal.confirm}
        onCancel={removal.cancel}
      />
    </section>
  );
}

// The test panel sits with the form because it says when edits are not yet used.
function RelayAndTest({
  tenant,
  config,
  etag,
  gone,
}: {
  tenant: string;
  config: SmtpConfig;
  etag: string;
  gone: boolean;
}) {
  const relay = useRelaySection({ tenant, config, etag, gone });
  return (
    <>
      <RelayForm relay={relay} config={config} />
      <TestMessage tenant={tenant} configured={config.configured} unsaved={relay.save.dirty} />
    </>
  );
}

function Email({ tenant }: { tenant: string }) {
  const record = useEmailPage(tenant);
  if (record.status === 'loading')
    return <FormSkeleton label="Loading the mail relay" fields={4} />;
  if (record.data === undefined || record.etag === null) {
    return (
      <EmptyState
        variant="failed"
        title="The mail relay could not be loaded"
        action={<Button onPress={record.retry}>Try again</Button>}
      >
        The gateway did not answer, or answered with an error.
      </EmptyState>
    );
  }
  const config = record.data;
  return (
    <div className={styles.page}>
      <p className={styles.effective}>
        <StatusTag tone={effectiveTone(config.effective)}>
          {effectiveLabel(config.effective)}
        </StatusTag>{' '}
        {effectiveReading(config.effective)}
      </p>
      <RelayAndTest tenant={tenant} config={config} etag={record.etag} gone={record.gone} />
      {config.configured ? <Removal tenant={tenant} reread={record.retry} /> : null}
    </div>
  );
}

export function EmailPage({ tenant }: { tenant: string }) {
  return (
    <AreaGate tenant={tenant} area={areaAt('email')} title={TITLE}>
      <PageHeader
        kicker={tenant}
        title={TITLE}
        description="The relay this tenant's verification and reset mail goes through."
      />
      <Email tenant={tenant} />
    </AreaGate>
  );
}
