// The item at an index a test knows is there, so it need not assert it.
export function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`no item at ${String(index)} of ${String(items.length)}`);
  return item;
}
