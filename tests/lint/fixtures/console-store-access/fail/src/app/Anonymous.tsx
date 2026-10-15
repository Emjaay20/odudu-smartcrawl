import { useToasts } from '#/shared/repository/useToasts';

export default function () {
  useToasts.getState().push('a');
  return null;
}
