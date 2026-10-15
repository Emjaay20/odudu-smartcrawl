import { useDrafts } from '#/shared/repository/useDrafts';
import { useToasts } from '#/shared/repository/useToasts';

export function Leave() {
  const { forgetAll } = useDrafts.getState();
  forgetAll();
  return null;
}

export function Everything() {
  const queue = useToasts();
  return <p>{queue.toasts.length}</p>;
}

export function Whole() {
  const count = useDrafts().count;
  return <p>{count}</p>;
}
