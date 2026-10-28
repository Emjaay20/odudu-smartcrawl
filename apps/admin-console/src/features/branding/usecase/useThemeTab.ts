import type { ThemeView } from '@odudu/contracts/admin';
import { useThemeWrites } from '#/features/branding/repository/useThemeWrites';
import {
  contrastReport,
  themeRecord,
  unsavedSections,
  type ContrastReport,
  type ThemeScope,
} from '#/features/branding/service';
import { useColours, type Colours } from '#/features/branding/usecase/useColours';
import { useImageDeletion, type ImageAsk } from '#/features/branding/usecase/useImageDeletion';
import { useImages, type Images } from '#/features/branding/usecase/useImages';
import { usePublication, type Publication } from '#/features/branding/usecase/usePublication';
import { useThemeReset } from '#/features/branding/usecase/useThemeReset';
import { useVersions, type Versions } from '#/features/branding/usecase/useVersions';
import { useDirtySections } from '#/shared/repository/useDirtySections';
import type { Confirming, Removal } from '#/shared/usecase/useConfirmedChange';

export interface ThemeTab {
  colours: Colours;
  images: Images;
  deletion: Confirming<ImageAsk>;
  report: ContrastReport;
  publication: Publication;
  versions: Versions;
  reset: Removal;
}

export function useThemeTab({
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
}): ThemeTab {
  const colours = useColours({ tenant, scope, view, tag, gone });
  const images = useImages({ tenant, scope, view, tag, gone });
  const deletion = useImageDeletion(tenant, images.forget);
  const writes = useThemeWrites(tenant, scope);
  const report = contrastReport(colours.save.values);
  const dirty = useDirtySections(tenant, themeRecord(scope));
  return {
    colours,
    images,
    deletion,
    report,
    publication: usePublication({
      tenant,
      view,
      tag,
      unsaved: unsavedSections(dirty),
      contrast: report.hold,
      writes,
    }),
    versions: useVersions(tenant, scope, writes),
    reset: useThemeReset(tenant, writes),
  };
}
