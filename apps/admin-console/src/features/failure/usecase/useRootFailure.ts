import { useFailureReport, type FailureShown } from '#/features/failure/usecase/useFailureReport';
import { reloadWindow } from '#/features/failure/repository/failureReport';

export interface RootFailureShown extends FailureShown {
  reload: () => void;
}

export function useRootFailure(error: unknown, route: string): RootFailureShown {
  return { ...useFailureReport(error, route), reload: reloadWindow };
}
