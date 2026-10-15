import { useToasts } from '#/shared/repository/useToasts';

export function Probe() {
  useToasts.setState({ toasts: [] });
  const queue = useToasts();
  useToasts.getState().push('x');
  return queue;
}
