import { logOut } from '#/features/session/adapter/logout';
import { sessionGone, signOutDestination } from '#/features/session/service';
import { useDrafts } from '#/shared/repository/useDrafts';
import { useLeaveConsole } from '#/shared/repository/useLeaveConsole';
import { useTransport } from '#/shared/transport/useTransport';

// Once the session is gone this tab's drafts are dropped and the page left;
// true if it was.
export function useGatewaySignOut(): () => Promise<boolean> {
  const { auth } = useTransport();
  const leave = useLeaveConsole();
  return async () => {
    const result = await logOut(auth);
    if (!sessionGone(result)) return false;
    useDrafts.getState().forgetAll();
    leave(signOutDestination(result));
    return true;
  };
}
