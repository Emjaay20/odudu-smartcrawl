// A short unified diff of two records, so a failed check says what differs.
export function unifiedDiff(
  committed: string,
  captured: string,
  names: { readonly left: string; readonly right: string },
  context = 2,
): string {
  const a = committed.split('\n');
  const b = captured.split('\n');
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      const row = table[i] ?? [];
      row[j] =
        a[i] === b[j]
          ? (table[i + 1]?.[j + 1] ?? 0) + 1
          : Math.max(table[i + 1]?.[j] ?? 0, row[j + 1] ?? 0);
    }
  }
  const lines: { mark: ' ' | '-' | '+'; text: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      lines.push({ mark: ' ', text: a[i] ?? '' });
      i += 1;
      j += 1;
    } else if (
      j >= b.length ||
      (i < a.length && (table[i + 1]?.[j] ?? 0) >= (table[i]?.[j + 1] ?? 0))
    ) {
      lines.push({ mark: '-', text: a[i] ?? '' });
      i += 1;
    } else {
      lines.push({ mark: '+', text: b[j] ?? '' });
      j += 1;
    }
  }
  const keep = lines.map((line, at) =>
    lines.slice(Math.max(0, at - context), at + context + 1).some((near) => near.mark !== ' '),
  );
  const shown = lines.flatMap((line, at) =>
    keep[at] === true ? [`${line.mark}${line.text}`] : [],
  );
  return shown.length === 0 ? '' : [`--- ${names.left}`, `+++ ${names.right}`, ...shown].join('\n');
}
