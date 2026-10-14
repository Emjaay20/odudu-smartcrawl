let renders = 0;

export function counted(): number {
  renders += 1;
  return renders;
}
