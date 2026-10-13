import type { ReactNode } from 'react';
import { useRecordActivity } from '#/shared/usecase/useRecordActivity';
import { ActivityTab } from '#/shared/view/ActivityTab';
import { CapabilityNote } from '#/shared/view/CapabilityNote';
import { recordTab } from '#/shared/view/RecordTab';

function Trail({ resource, tenant, id }: { resource: string; tenant: string; id: string }) {
  return <ActivityTab list={useRecordActivity(resource, tenant, id)} noun={resource} />;
}

// A record's Activity tab: what the trail holds, and the trail itself. Where
// `readable` is false nothing is read, since the audit would refuse it.
export function RecordActivity({
  resource,
  tenant,
  id,
  lead,
  readable = true,
}: {
  // The audit log's name for the record, and what the empty trail calls it.
  resource: string;
  tenant: string;
  id: string;
  lead: ReactNode;
  readable?: boolean;
}) {
  return (
    <div className={recordTab.tab}>
      <p className={recordTab.rule}>{lead}</p>
      {readable ? (
        <Trail resource={resource} tenant={tenant} id={id} />
      ) : (
        <CapabilityNote capability="view-audit">Activity</CapabilityNote>
      )}
    </div>
  );
}
