export function Wrapped({ text }: Readonly<{ text: string }>): string {
  return text;
}

export function noProps(): string {
  return [1, 2].map((item) => String(item)).join('');
}
