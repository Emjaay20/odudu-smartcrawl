import { PANEL_WORDING, RELOAD_LABEL, ROOT_FAILURE_TEXT } from '#/features/failure/service';
import { useRootFailure } from '#/features/failure/usecase/useRootFailure';
import { PRODUCT_NAME } from '#/shared/service/product';
import { Button } from '#/shared/view/Button';
import { FailurePanel } from '#/shared/view/FailurePanel';
import { LostFrame } from '#/shared/view/LostFrame';

// Drawn when everything above the router failed, so it reads no context the
// failed tree provided: only the design tokens and what its props carry.
export function RootFailure({ error, route }: { error: unknown; route: string }) {
  const failure = useRootFailure(error, route);
  return (
    <LostFrame brand={PRODUCT_NAME}>
      <FailurePanel
        {...PANEL_WORDING}
        text={ROOT_FAILURE_TEXT}
        message={failure.message}
        details={failure.details}
        actions={
          <Button variant="primary" onPress={failure.reload}>
            {RELOAD_LABEL}
          </Button>
        }
      />
    </LostFrame>
  );
}
