import type { Settings } from '@odudu/contracts/admin';
import { useRefusal } from '#/features/session';
import { flowSaves, type OtpValues } from '#/features/flow/repository/useFlowRecord';
import {
  describeOtp,
  OTP_FIELD_LABEL,
  OTP_TITLE,
  otpReading,
  otpRequired,
} from '#/features/flow/service';
import { useSectionSave, type SectionSave } from '#/shared/repository/useSectionSave';
import { writeRefusal } from '#/shared/service/capabilities';
import { TENANT_SETTINGS_RECORD } from '#/shared/service/tenantSettings';

export interface OtpRequirement {
  save: SectionSave<OtpValues>;
  // Whom the step asks, as the saved setting has it.
  reading: string;
}

export function useOtpRequirement({
  tenant,
  data,
  etag,
  gone,
}: {
  tenant: string;
  data: Settings;
  etag: string;
  gone: boolean;
}): OtpRequirement {
  const refusal = useRefusal(tenant);
  const saves = flowSaves(tenant);
  const save = useSectionSave({
    tenant,
    record: TENANT_SETTINGS_RECORD,
    section: 'otp',
    label: OTP_TITLE,
    etag,
    capability: 'manage-tenant',
    gone,
    onRefused: (failure) => {
      refusal.report(failure, 'manage-tenant');
    },
    explain: writeRefusal,
    fields: {
      otp_required: {
        value: otpRequired(data),
        label: OTP_FIELD_LABEL,
        kind: 'plain',
        describe: describeOtp,
      },
    },
    save: saves.otp,
  });
  return { save, reading: otpReading(otpRequired(data)) };
}
