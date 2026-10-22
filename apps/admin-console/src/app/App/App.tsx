import type { QueryClient } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { RootBoundary, routeTemplate } from '#/features/failure';
import { Providers } from '#/app/Providers';
import type { ConsoleRouter } from '#/app/router';
import { ToastLayer } from '#/app/ToastLayer';
import { UnsavedGuardLayer } from '#/app/UnsavedGuardLayer';
import type { Transport } from '#/shared/transport/transport';

export function App({
  router,
  transport,
  queryClient,
}: {
  router: ConsoleRouter;
  transport?: Transport;
  queryClient?: QueryClient;
}) {
  return (
    <RootBoundary route={() => routeTemplate(router.state.matches)}>
      <Providers
        {...(transport === undefined ? {} : { transport })}
        {...(queryClient === undefined ? {} : { queryClient })}
      >
        <RouterProvider router={router} />
        <ToastLayer />
        <UnsavedGuardLayer />
      </Providers>
    </RootBoundary>
  );
}
