import type { Client, Subject } from '@odudu/contracts/admin';
import {
  EVALUATE_CAPABILITY,
  EVALUATE_HEADING,
  EVALUATE_LABEL,
  EVALUATE_RULE,
  NO_ID_TOKEN,
  SCOPE_LABEL,
  SCOPE_RULE,
  SUBJECT_PICKER_LABEL,
} from '#/features/clients/service';
import {
  useClientEvaluate,
  useEvaluateAllowed,
  type ClientEvaluate,
} from '#/features/clients/usecase/useClientEvaluate';
import { Button } from '#/shared/view/Button';
import { CapabilityNote } from '#/shared/view/CapabilityNote';
import { CopyValue } from '#/shared/view/CopyValue';
import { TextField } from '#/shared/view/Field';
import { Problem } from '#/shared/view/Message';
import { Panel } from '#/shared/view/Panel';
import { Picker } from '#/shared/view/Picker';
import { recordTab } from '#/shared/view/RecordTab';
import styles from '#/features/clients/view/Evaluate/Evaluate.module.css';

function Form({ page }: { page: ClientEvaluate }) {
  return (
    <>
      <Picker<Subject>
        label={SUBJECT_PICKER_LABEL}
        noun={{ one: 'subject', other: 'subjects' }}
        picker={page.picker}
        idOf={(subject) => subject.id}
        nameOf={(subject) => subject.username ?? subject.id}
        detailOf={(subject) => subject.email ?? subject.type}
        searchBy="username"
        capability={EVALUATE_CAPABILITY}
        selected={page.chosen === null ? [] : [page.chosen.id]}
        selectionMode="single"
        onChange={page.choose}
      />
      <TextField
        label={SCOPE_LABEL}
        description={SCOPE_RULE}
        mono
        value={page.scope}
        onChange={page.setScope}
      />
      <div className={recordTab.actions}>
        <Button
          variant="primary"
          isDisabled={page.chosen === null || page.busy}
          onPress={page.evaluate}
        >
          {EVALUATE_LABEL}
        </Button>
      </div>
      <Problem>{page.problem}</Problem>
      {page.worked === null ? null : (
        <div className={styles.claims}>
          <p role="status" className={recordTab.text}>{`Claims for ${page.worked}.`}</p>
          {page.artefacts.map((artefact) => (
            <div key={artefact.label} className={styles.artefact}>
              <h3 className={styles.heading}>{artefact.heading}</h3>
              {artefact.text === null ? (
                <p className={recordTab.rule}>{NO_ID_TOKEN}</p>
              ) : (
                <CopyValue label={artefact.label} value={artefact.text} block />
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Asked({ tenant, client }: { tenant: string; client: Client }) {
  return <Form page={useClientEvaluate(tenant, client)} />;
}

export function Evaluate({ tenant, client }: { tenant: string; client: Client }) {
  const allowed = useEvaluateAllowed(tenant);
  return (
    <Panel title={EVALUATE_HEADING}>
      <p className={recordTab.rule}>{EVALUATE_RULE}</p>
      {allowed ? (
        <Asked tenant={tenant} client={client} />
      ) : (
        <CapabilityNote capability={EVALUATE_CAPABILITY}>Evaluating a subject</CapabilityNote>
      )}
    </Panel>
  );
}
