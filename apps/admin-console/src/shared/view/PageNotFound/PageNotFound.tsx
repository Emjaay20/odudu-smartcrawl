import { EmptyState } from '#/shared/view/EmptyState';
import { LostArt } from '#/shared/view/LostArt';
import { PageHeader } from '#/shared/view/PageHeader';

export function PageNotFound() {
  return (
    <>
      <PageHeader title="Page not found" />
      <LostArt />
      <EmptyState variant="nothing-matches" title="No page has this address">
        Check the address, or choose an area from the menu.
      </EmptyState>
    </>
  );
}
