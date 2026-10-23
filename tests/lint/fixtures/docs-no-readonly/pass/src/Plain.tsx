interface Props {
  label: string;
  items: string[];
  pair: [number, number];
  lookup: Map<string, number>;
  unique: Set<string>;
  onPick: (value: string) => void;
}

export function Plain({ label, items, pair, lookup, unique, onPick }: Props): string {
  onPick(label);
  return `${label}${items.join('')}${String(pair[0])}${String(lookup.size)}${String(unique.size)}`;
}
