interface Props {
  readonly label: string;
  readonly onPick?: (value: string) => void;
}

export function Interface({ label, onPick }: Props): string {
  onPick?.(label);
  return label;
}
