declare function useState<T>(initial: T): [T, (next: T) => void];
declare function reasonOf(busy: boolean): string;

export function useForm(base: Record<string, string>, edits: Record<string, string>) {
  const [busy] = useState(false);
  const [name] = useState<string | null>(null);
  const shown = name === null ? 'none' : name;
  const one = { ...base, extra: busy };
  const submit = () => {
    const body = { ...base, ...edits };
    const sent = busy ? { ...body, again: true } : body;
    return sent;
  };
  return {
    shown,
    one,
    reason: reasonOf(busy),
    submit,
    cancel: () => (busy ? 'busy' : 'idle'),
    plain: name ?? 'unnamed',
    guarded: busy && name !== null,
  };
}
