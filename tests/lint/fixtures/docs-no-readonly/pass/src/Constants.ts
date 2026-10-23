export const ROUTES = ['a', 'b'] as const;
export const POINT = [1, 2] as const;
export const WORD = 'readonly in a string and a comment: readonly';

export function copy(items: string[]): string[] {
  return [...items];
}
