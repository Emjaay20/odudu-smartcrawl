import { cleanup } from '@testing-library/react';
import { useDialogHost } from '#/shared/repository/useDialogHost';
import { useDrafts } from '#/shared/repository/useDrafts';
import { useToasts } from '#/shared/repository/useToasts';
import { useUnsavedGuard } from '#/shared/repository/useUnsavedGuard';

// The stores outlive a render. Whatever is mounted comes down first: a dialog
// closing after the reset would take the host's count below zero.
export function resetConsole(): void {
  cleanup();
  useToasts.setState(useToasts.getInitialState(), true);
  useDialogHost.setState(useDialogHost.getInitialState(), true);
  useUnsavedGuard.setState(useUnsavedGuard.getInitialState(), true);
  useDrafts.getState().reset();
}
