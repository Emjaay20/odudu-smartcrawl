import type { ErrorComponentProps } from '@tanstack/react-router';
import {
  PANEL_WORDING,
  BACK_TO_OVERVIEW_LABEL,
  RELOAD_LABEL,
  ROUTE_FAILURE_TEXT,
  SHELL_FAILURE_TEXT,
  TRY_AGAIN_LABEL,
} from '#/features/failure/service';
import { useRouteFailure } from '#/features/failure/usecase/useRouteFailure';
import { PRODUCT_NAME } from '#/shared/service/product';
import { Button } from '#/shared/view/Button';
import { FailurePanel } from '#/shared/view/FailurePanel';
import { ButtonLink } from '#/shared/view/ButtonLink';
import { LostFrame } from '#/shared/view/LostFrame';

// Inside the shell, which stays around it, or, where the shell itself is
// what failed, alone on the page under the product's name.
export function RouteFailure({
  error,
  reset,
  standalone = false,
}: ErrorComponentProps & { standalone?: boolean }) {
  const failure = useRouteFailure(error);
  const panel = (
    <FailurePanel
      {...PANEL_WORDING}
      text={standalone ? SHELL_FAILURE_TEXT : ROUTE_FAILURE_TEXT}
      message={failure.message}
      details={failure.details}
      actions={
        <>
          <Button variant="primary" onPress={reset}>
            {TRY_AGAIN_LABEL}
          </Button>
          <ButtonLink href={failure.overviewHref}>{BACK_TO_OVERVIEW_LABEL}</ButtonLink>
          <Button onPress={failure.reload}>{RELOAD_LABEL}</Button>
        </>
      }
    />
  );
  return standalone ? <LostFrame brand={PRODUCT_NAME}>{panel}</LostFrame> : panel;
}
