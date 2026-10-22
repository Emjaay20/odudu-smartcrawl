// A form refused in place says what is wrong in one alert above it, and each
// field at fault points at its own entry there, so the problem is announced
// once and read again only where the person is working. A problem names the
// fields it is about, none when it is about the form as a whole. `html` arrives
// already escaped.
export interface Problem {
  readonly fields: readonly string[];
  readonly html: string;
}

const entryId = (index: number): string => `form-error-${String(index)}`;

export function problemSummary(problems: readonly Problem[]): string {
  if (problems.length === 0) return '';
  const items = problems.map((problem, index) => `<li id="${entryId(index)}">${problem.html}</li>`);
  return `<div class="alert" role="alert" id="form-error">\n<ul>\n${items.join('\n')}\n</ul>\n</div>\n`;
}

export function invalidAttributes(problems: readonly Problem[], field: string): string {
  const ids = problems.flatMap((problem, index) =>
    problem.fields.includes(field) ? [entryId(index)] : [],
  );
  return ids.length === 0 ? '' : ` aria-invalid="true" aria-describedby="${ids.join(' ')}"`;
}

// The field a re-rendered form puts the cursor in: the first, in the order
// the form lays them out, that has a problem.
export function firstInvalidField(
  problems: readonly Problem[],
  order: readonly string[],
): string | null {
  return order.find((field) => problems.some((problem) => problem.fields.includes(field))) ?? null;
}

// Reflection is bounded, not validated: a value past this many code points is
// not given back at all, because half of a megabyte string is still reflected
// input. The length test short-circuits so a huge value is never walked.
const MAX_ECHOED_LENGTH = 254;

export function echoedValue(value: string): string | undefined {
  if (value.length === 0 || value.length > MAX_ECHOED_LENGTH * 2) return undefined;
  return Array.from(value).length <= MAX_ECHOED_LENGTH ? value : undefined;
}
