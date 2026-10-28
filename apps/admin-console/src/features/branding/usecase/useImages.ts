import type { ThemeView } from '@odudu/contracts/admin';
import { useState } from 'react';
import { useRefusal } from '#/features/session';
import { useAssetUpload } from '#/features/branding/repository/useThemeAssets';
import { imageSave } from '#/features/branding/repository/themeSaves';
import {
  altChanged,
  altEdited,
  IDLE_SLOTS,
  imageField,
  imageFields,
  imageValues,
  imagesHold,
  IMAGES_TITLE,
  slotAfterUpload,
  slotNames,
  themeRecord,
  uploadedImage,
  uploadStart,
  type ImageValues,
  type ImageSlot,
  type SlotStates,
  type ThemeScope,
} from '#/features/branding/service';
import { useLatest } from '#/shared/repository/useLatest';
import { failureOf } from '#/shared/service/settled';
import { useSectionSave, type SectionSave } from '#/shared/repository/useSectionSave';
import { writeRefusal } from '#/shared/service/capabilities';

export interface Images {
  save: SectionSave<ImageValues>;
  blocked: string | undefined;
  slots: SlotStates;
  upload: (slot: ImageSlot, file: File) => void;
  setAlt: (slot: 'logo' | 'darkLogo', alt: string) => void;
  remove: (slot: ImageSlot) => void;
  // Takes a deleted image out of the slot that still names it.
  forget: (slot: ImageSlot, assetId: string) => void;
  // Whether a logo's alt text differs from the saved one.
  altChanged: (slot: ImageSlot) => boolean;
}

export function useImages({
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
}): Images {
  const refusal = useRefusal(tenant);
  const uploading = useAssetUpload(tenant);
  const [slots, setSlots] = useState(IDLE_SLOTS);
  const saved = imageValues(view);
  const save = useSectionSave({
    tenant,
    record: themeRecord(scope),
    section: 'images',
    label: IMAGES_TITLE,
    etag: tag,
    capability: 'manage-tenant',
    gone,
    refusal,
    explain: writeRefusal,
    fields: imageFields(imageValues(view)),
    save: imageSave(tenant, scope, view),
  });
  const latestValues = useLatest(save.values);
  return {
    save,
    blocked: imagesHold(save.values),
    slots,
    upload: (slot, file) => {
      const start = uploadStart(slots, slot, file);
      setSlots(start.slots);
      if (!start.send) return;
      uploading
        .run({ kind: slot, file })
        .then((result) => {
          setSlots((was) => slotAfterUpload(was, slot, result));
          const image = uploadedImage(slot, result, latestValues());
          if (image !== null) save.edit(imageField(slot), image);
          const failure = failureOf(result);
          if (failure !== null) refusal.report(failure, 'manage-tenant');
        })
        .catch(() => {
          setSlots((was) => slotAfterUpload(was, slot, { ok: false, kind: 'defect' }));
        });
    },
    setAlt: (slot, alt) => {
      const logo = altEdited(save.values, slot, alt);
      if (logo !== null) save.edit(imageField(slot), logo);
    },
    remove: (slot) => {
      save.edit(imageField(slot), null);
    },
    forget: (slot, assetId) => {
      if (slotNames(latestValues(), slot, assetId)) save.edit(imageField(slot), null);
    },
    altChanged: (slot) => altChanged(saved, save.values, slot),
  };
}
