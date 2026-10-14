export const STATUS_FILTER = [
  { id: 'any', label: 'Any status' },
  { id: 'true', label: 'Enabled' },
  { id: 'false', label: 'Disabled' },
];

export const NAME_SEARCH = [{ id: 'name', label: 'Name' }];

// A filter that is sent only once it names something: `{ status }`, or nothing.
export function optionalFilter(
  name: string,
  value: string | null | undefined,
): Record<string, string> {
  return value === null || value === undefined ? {} : { [name]: value };
}
