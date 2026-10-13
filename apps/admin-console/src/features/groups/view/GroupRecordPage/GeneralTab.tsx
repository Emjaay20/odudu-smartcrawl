import type { GroupRecord } from '@odudu/contracts/admin';
import { NAME_FIXED } from '#/features/groups/service';
import {
  useGroupGeneral,
  type Defaults,
  type Deletion,
  type GroupGeneral,
  type Place,
} from '#/features/groups/usecase/useGroupGeneral';
import type { Ceiling } from '#/features/groups/usecase/useGroupRecordPage';
import { DeleteZone } from '#/shared/view/DeleteZone';
import { Panel } from '#/shared/view/Panel';
import { AskedDialog } from '#/shared/view/ConfirmDialog';
import { TextAreaField, ToggleField } from '#/shared/view/Field';
import { GroupPicker } from '#/shared/view/GroupPicker';
import { SaveSection } from '#/shared/view/SaveSection';
import { Timestamp } from '#/shared/view/Timestamp';
import { recordTab } from '#/shared/view/RecordTab';

function Fixed({ group }: { group: GroupRecord }) {
  return (
    <Panel title="Name">
      <dl className={recordTab.fixed}>
        <div>
          <dt>Name</dt>
          <dd>
            <code>{group.name}</code>
          </dd>
        </div>
        <div>
          <dt>Path</dt>
          <dd>
            <code>{group.path}</code>
          </dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>
            <Timestamp value={group.created_at} />
          </dd>
        </div>
      </dl>
      <p className={recordTab.rule}>{NAME_FIXED}</p>
    </Panel>
  );
}

function Description({ general }: { general: GroupGeneral }) {
  const s = general.description;
  return (
    <SaveSection
      title="Description"
      description="What the group is for, shown wherever it is chosen."
      save={s}
    >
      <TextAreaField
        label="Description"
        description={general.descriptionRule}
        limit={general.descriptionLimit}
        value={s.values.description}
        error={s.fieldErrors.description}
        changed={s.changed.includes('description')}
        onChange={(value) => {
          s.edit('description', value);
        }}
      />
    </SaveSection>
  );
}

function PlaceSection({ place }: { place: Place }) {
  const s = place.save;
  return (
    <SaveSection
      title="Place in the tree"
      description="Its members receive the roles of every group above it, so a move changes what they hold."
      save={s}
    >
      <p className={recordTab.text}>{place.current}</p>
      {place.state === 'checking' ? (
        <p className={recordTab.rule}>Checking what the groups above it hand down…</p>
      ) : null}
      {place.state === 'ready' && place.held === null ? (
        <>
          <GroupPicker
            label="Parent"
            picker={place.picker}
            selected={s.values.parent_id === null ? [] : [s.values.parent_id]}
            onChange={place.choose}
            selectionMode="single"
            unavailableOf={place.unavailableOf}
          />
          <p className={recordTab.rule}>Choose the parent again to move it to the top level.</p>
        </>
      ) : null}
      <AskedDialog
        asked={place.asking}
        confirmLabel="Save Place in the tree"
        onConfirm={place.confirm}
        onCancel={place.cancel}
      />
    </SaveSection>
  );
}

function DefaultSection({ defaults }: { defaults: Defaults }) {
  const s = defaults.save;
  let body;
  if (defaults.state === 'checking') {
    body = <p className={recordTab.rule}>Checking what it hands out…</p>;
  } else if (defaults.state === 'failed') {
    body = null;
  } else if (defaults.fixed === null) {
    body = (
      <ToggleField
        label="Joined by every new subject"
        description="Every subject created from now on joins it, by the admin API, registration and seeding alike. Nobody who already exists is changed."
        value={s.values.default_for_new_subjects}
        changed={s.changed.includes('default_for_new_subjects')}
        onChange={(value) => {
          s.edit('default_for_new_subjects', value);
        }}
      />
    );
  } else {
    body = <p className={recordTab.rule}>{defaults.fixed}</p>;
  }
  return (
    <SaveSection title="New subjects" save={s}>
      {body}
    </SaveSection>
  );
}

// Left out where the ceiling rules it out; the page's one line says why.
function Danger({ path, deletion }: { path: string; deletion: Deletion }) {
  if (deletion.held !== null || deletion.state === 'failed') return null;
  return (
    <DeleteZone
      name={path}
      deletion={deletion}
      consequence={deletion.consequence}
      typed={path}
      label={`Delete ${path} and every group beneath it`}
      lead={
        <p className={recordTab.text}>
          A delete takes the whole subtree: no group beneath it survives as a new top-level group.
        </p>
      }
      note={
        deletion.state === 'checking' ? (
          <p className={recordTab.rule}>Checking what its members hold through it…</p>
        ) : undefined
      }
    />
  );
}

export function GeneralTab({
  tenant,
  group,
  etag,
  gone,
  ceiling,
}: {
  tenant: string;
  group: GroupRecord;
  etag: string;
  gone: boolean;
  ceiling: Ceiling;
}) {
  const general = useGroupGeneral({ tenant, group, etag, gone, ceiling });
  return (
    <div className={recordTab.tab}>
      <Fixed group={group} />
      <Description general={general} />
      <PlaceSection place={general.place} />
      <DefaultSection defaults={general.defaults} />
      <Danger path={group.path} deletion={general.deletion} />
    </div>
  );
}
