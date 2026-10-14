declare function useState<T>(initial: T): [T, (next: T) => void];

export function useRow(id: string | null) {
  const [busy] = useState(false);
  return {
    id,
    label: id === null ? 'none' : id,
    action: busy ? undefined : () => id,
    nested: { phase: busy ? 'saving' : 'idle' },
  };
}

export const useBadge = (count: number) => ({ shown: count > 0 ? count : null });
