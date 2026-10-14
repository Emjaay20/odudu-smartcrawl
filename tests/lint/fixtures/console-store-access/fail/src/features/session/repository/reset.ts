import { useToasts } from '#/shared/repository/useToasts';

export function clearToasts(): void {
  useToasts.setState({ toasts: [] });
}
