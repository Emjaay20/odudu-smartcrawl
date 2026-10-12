import { TENANT_SETTING_RANGES } from '@odudu/contracts/admin';
import { formatDuration } from '#/shared/service/format';
import type { SettingField } from '#/features/settings/service/sections';

function amount(field: SettingField, value: number): string {
  if (field.control === 'seconds') return formatDuration(value);
  return field.unit === undefined ? String(value) : `${String(value)} ${field.unit}`;
}

// The range the server holds the setting to, as it reports it in a refusal.
export function rangeRule(field: SettingField): string | null {
  const range = TENANT_SETTING_RANGES[field.name];
  if (range === undefined) return null;
  if (range.max === undefined) return `At least ${amount(field, range.min)}.`;
  if (field.control === 'seconds') {
    return `Between ${formatDuration(range.min)} and ${formatDuration(range.max)}.`;
  }
  const unit = field.unit === undefined ? '' : ` ${field.unit}`;
  return `Between ${String(range.min)} and ${String(range.max)}${unit}.`;
}

export function fieldDescription(field: SettingField): string | undefined {
  const rule = rangeRule(field);
  const parts = [field.description, rule].filter(
    (part): part is string => part !== undefined && part !== null,
  );
  return parts.length === 0 ? undefined : parts.join(' ');
}
