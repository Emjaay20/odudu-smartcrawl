import type { ScopeMappers } from '@odudu/contracts/admin';
import { useRefusal } from '#/features/session';
import {
  useScopeMappersRecord,
  useScopeSaves,
  type MapperValues,
} from '#/features/scopes/repository/useScopeRecord';
import {
  describeMappers,
  mapperOptions,
  mappersFailure,
  mappersSummary,
  scopeMappersRecord,
} from '#/features/scopes/service';
import type { RecordState } from '#/shared/repository/useRecord';
import { useSectionSave, type SectionSave } from '#/shared/repository/useSectionSave';
import { writeRefusal } from '#/shared/service/capabilities';
import { inOrderOf } from '#/shared/service/ids';
import type { Choice } from '#/shared/service/choice';

export function useScopeMappersRead(tenant: string, id: string): RecordState<ScopeMappers> {
  return useScopeMappersRecord(tenant, id);
}

export interface ScopeMapperSet {
  save: SectionSave<MapperValues>;
  options: readonly Choice[];
  summary: string;
  choose: (names: readonly string[]) => void;
}

export function useScopeMapperSet({
  tenant,
  id,
  data,
  etag,
  gone,
}: {
  tenant: string;
  id: string;
  data: ScopeMappers;
  etag: string;
  gone: boolean;
}): ScopeMapperSet {
  const refusal = useRefusal(tenant);
  const saves = useScopeSaves(tenant, id);
  const save = useSectionSave({
    tenant,
    record: scopeMappersRecord(id),
    section: 'mappers',
    label: 'Claim mappers',
    etag,
    capability: 'manage-tenant',
    gone,
    refusal,
    explain: writeRefusal,
    fields: {
      mapper_names: {
        value: inOrderOf(data.available, data.bound),
        label: 'Claim mappers',
        kind: 'plain',
        describe: describeMappers,
      },
    },
    save: async (gateway, input) => {
      const result = await saves.mappers(gateway, input);
      return result.ok ? result : mappersFailure(result);
    },
  });
  return {
    save,
    options: mapperOptions(data.available),
    summary: mappersSummary(data.bound, data.declared),
    choose: (names) => {
      save.edit('mapper_names', inOrderOf(data.available, names));
    },
  };
}
