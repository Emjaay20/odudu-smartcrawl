// A display name is trimmed, and a blank or absent one is none: readers show
// `display_name ?? name`, so a stored blank would show as nothing at all.
export function normalizeDisplayName(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}
