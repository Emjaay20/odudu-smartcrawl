import type { ThemeView } from '@odudu/contracts/admin';
import {
  DELETE_BODY,
  DELETE_LABEL,
  DELETE_TITLE,
  type ThemeScope,
} from '#/features/branding/service';
import { useThemeTab } from '#/features/branding/usecase/useThemeTab';
import { ColoursSection, ContrastPanel } from '#/features/branding/view/ColoursSection';
import { ImagesSection } from '#/features/branding/view/ImagesSection';
import {
  PublishPanel,
  ResetPanel,
  StatusPanel,
  VersionsPanel,
} from '#/features/branding/view/PublicationPanels';
import { ConfirmDialog } from '#/shared/view/ConfirmDialog';
import styles from '#/features/branding/view/ThemeTab/ThemeTab.module.css';

export function ThemeTab({
  tenant,
  scope,
  view,
  tag,
  gone,
}: {
  tenant: string;
  scope: ThemeScope;
  view: ThemeView;
  tag: string;
  gone: boolean;
}) {
  const theme = useThemeTab({ tenant, scope, view, tag, gone });
  const { deletion } = theme;
  return (
    <div className={styles.tab}>
      <StatusPanel view={view} />
      <ColoursSection scope={scope} view={view} colours={theme.colours} />
      <ContrastPanel report={theme.report} />
      <ImagesSection scope={scope} view={view} images={theme.images} onDelete={deletion.ask} />
      <PublishPanel publication={theme.publication} />
      <VersionsPanel versions={theme.versions} />
      <ResetPanel scope={scope} reset={theme.reset} />
      <ConfirmDialog
        isOpen={deletion.asking !== null}
        title={DELETE_TITLE}
        consequence={DELETE_BODY}
        confirmLabel={DELETE_LABEL}
        tone="danger"
        busy={deletion.busy}
        problem={deletion.problem}
        onConfirm={deletion.confirm}
        onCancel={deletion.cancel}
      />
    </div>
  );
}
