function createReader(base: string) {
  const prefix = '/x';
  let local = 0;
  local += 1;
  const start = local;
  return (id: string) => prefix + base + id + String(start);
}

export const read = createReader('a');
