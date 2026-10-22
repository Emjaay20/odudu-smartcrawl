import { useParams, useRouterState } from '@tanstack/react-router';
import { useFailureReport, type FailureShown } from '#/features/failure/usecase/useFailureReport';
import { overviewAddress, routeTemplate } from '#/features/failure/service';
import { useReloadConsole } from '#/features/session';

export interface RouteFailureShown extends FailureShown {
  overviewHref: string;
  reload: () => void;
}

export function useRouteFailure(error: unknown): RouteFailureShown {
  const route = useRouterState({
    select: (state) => routeTemplate(state.matches),
  });
  const tenant = useParams({ strict: false, select: (params) => params.tenant });
  return {
    ...useFailureReport(error, route),
    overviewHref: overviewAddress(tenant),
    reload: useReloadConsole(),
  };
}
