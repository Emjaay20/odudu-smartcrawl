import { useRecordActivity } from '#/shared/usecase/useRecordActivity';
import { ActivityTab } from '#/shared/view/ActivityTab';
import { recordTab } from '#/shared/view/RecordTab';

export function ActivityPanel({ tenant, id }: { tenant: string; id: string }) {
  const list = useRecordActivity('subject', tenant, id);
  return (
    <div className={recordTab.tab}>
      <p className={recordTab.rule}>
        Every change made to this subject, and every change refused. Its sign-ins are filed under
        the session they began, and the end of a single session under that session, so neither is
        listed here.
      </p>
      <ActivityTab list={list} noun="subject" />
    </div>
  );
}
