import { useVanilla } from '#/shared/repository/vanilla';

export function UsesVanilla() {
  useVanilla.getState().go();
  return null;
}
